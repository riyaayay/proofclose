import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/db/client";
import { parseBankCreditsCSV, parseLedgerCSV, parseSettlementCSV, parseTruthCSV } from "@/adapters/csv";
import type { ReconciliationRun } from "./types";

export async function loadFixtureInputs() {
  const base = join(process.cwd(), "data/input");
  const settlementRows = parseSettlementCSV(readFileSync(join(base, "settlement_recon.csv"), "utf-8"));
  const ledgerRows = parseLedgerCSV(readFileSync(join(base, "merchant_ledger.csv"), "utf-8"));
  const bankCredits = parseBankCreditsCSV(readFileSync(join(base, "bank_credits.csv"), "utf-8"));
  return { settlementRows, ledgerRows, bankCredits };
}

export async function loadTruth() {
  const content = readFileSync(join(process.cwd(), "data/truth/expected_outcomes.csv"), "utf-8");
  return parseTruthCSV(content);
}

export async function saveRun(run: ReconciliationRun): Promise<void> {
  const db = getDb();
  const insertRun = db.prepare(`
    INSERT OR REPLACE INTO reconciliation_runs (run_id, algorithm_version, input_sha256, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertDecision = db.prepare(`
    INSERT OR REPLACE INTO reconciliation_decisions
      (run_id, settlement_row_id, decision, exception_code, ledger_id, bank_txn_id, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const saveAll = db.transaction(() => {
    insertRun.run(run.runId, run.algorithmVersion, run.inputSha256, run.startedAt, run.finishedAt);
    for (const result of run.results) {
      insertDecision.run(
        run.runId,
        result.settlementRowId,
        result.decision,
        result.exceptionCode ?? null,
        result.ledgerId ?? null,
        result.bankTxnId ?? null,
        JSON.stringify(result.evidence),
      );
    }
  });
  saveAll();
}

export async function getRun(runId: string): Promise<ReconciliationRun | null> {
  const db = getDb();
  const runRow = db.prepare("SELECT * FROM reconciliation_runs WHERE run_id = ?").get(runId) as Record<string, string> | undefined;
  if (!runRow) return null;

  const decisions = db.prepare("SELECT * FROM reconciliation_decisions WHERE run_id = ?").all(runId) as Record<string, string>[];
  return {
    runId: runRow.run_id,
    algorithmVersion: runRow.algorithm_version,
    inputSha256: runRow.input_sha256,
    startedAt: runRow.started_at,
    finishedAt: runRow.finished_at,
    results: decisions.map(d => ({
      settlementRowId: d.settlement_row_id,
      decision: d.decision as "CLOSED" | "EXCEPTION",
      exceptionCode: d.exception_code as never ?? undefined,
      ledgerId: d.ledger_id ?? undefined,
      bankTxnId: d.bank_txn_id ?? undefined,
      evidence: JSON.parse(d.evidence_json),
      reviewStatus: (d.review_status as "UNREVIEWED" | "REVIEWED" | "ESCALATED") ?? undefined,
      reviewerId: d.reviewer_id ?? undefined,
      reviewReason: d.review_reason ?? undefined,
      actionCategory: d.action_category ?? undefined,
      reviewedAt: d.reviewed_at ?? undefined,
    })),
  };
}

export async function getAllRuns(): Promise<Array<{ runId: string; algorithmVersion: string; inputSha256: string; startedAt: string; finishedAt: string; closed: number; exceptions: number }>> {
  const db = getDb();
  const runs = db.prepare("SELECT * FROM reconciliation_runs ORDER BY created_at DESC").all() as Record<string, string>[];
  return runs.map(r => {
    const counts = db.prepare("SELECT decision, COUNT(*) as cnt FROM reconciliation_decisions WHERE run_id = ? GROUP BY decision").all(r.run_id) as { decision: string; cnt: number }[];
    const closed = counts.find(c => c.decision === "CLOSED")?.cnt ?? 0;
    const exceptions = counts.find(c => c.decision === "EXCEPTION")?.cnt ?? 0;
    return { runId: r.run_id, algorithmVersion: r.algorithm_version, inputSha256: r.input_sha256, startedAt: r.started_at, finishedAt: r.finished_at, closed, exceptions };
  });
}

export async function markDecisionReviewed(params: {
  runId: string;
  settlementRowId: string;
  reviewerId: string;
  status: "REVIEWED" | "ESCALATED";
  reason: string;
  actionCategory?: string;
  reviewedAt: string;
}): Promise<void> {
  const db = getDb();
  const category = params.actionCategory ?? "flag_for_followup";

  const tx = db.transaction(() => {
    // Record immutable audit history entry
    db.prepare(`
      INSERT INTO reviewer_action_audit
        (run_id, settlement_row_id, reviewer_id, status, action_category, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.runId,
      params.settlementRowId,
      params.reviewerId,
      params.status,
      category,
      params.reason,
      params.reviewedAt,
    );

    // Update current disposition on the decision record (engine decision remains immutable)
    db.prepare(`
      UPDATE reconciliation_decisions
      SET review_status = ?, reviewer_id = ?, review_reason = ?, action_category = ?, reviewed_at = ?
      WHERE run_id = ? AND settlement_row_id = ?
    `).run(
      params.status,
      params.reviewerId,
      params.reason,
      category,
      params.reviewedAt,
      params.runId,
      params.settlementRowId,
    );
  });

  tx();
}
