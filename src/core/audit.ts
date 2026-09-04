import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/db/client";
import { parseBankCreditsCSV, parseLedgerCSV, parseSettlementCSV, parseTruthCSV } from "@/adapters/csv";
import { generateBenchmarkCohort, type TruthRow } from "./fixtures";
import type { ReconciliationRun } from "./types";

// In-memory run cache as resilient fallback if SQLite storage is unavailable or wiped between serverless invocations
const memoryRuns = new Map<string, ReconciliationRun>();

export async function loadFixtureInputs() {
  try {
    const base = join(process.cwd(), "data/input");
    const sFile = join(base, "settlement_recon.csv");
    const lFile = join(base, "merchant_ledger.csv");
    const bFile = join(base, "bank_credits.csv");

    if (existsSync(sFile) && existsSync(lFile) && existsSync(bFile)) {
      const settlementRows = parseSettlementCSV(readFileSync(sFile, "utf-8"));
      const ledgerRows = parseLedgerCSV(readFileSync(lFile, "utf-8"));
      const bankCredits = parseBankCreditsCSV(readFileSync(bFile, "utf-8"));
      return { settlementRows, ledgerRows, bankCredits };
    }
  } catch {
    // Fall back to in-memory deterministic generation
  }

  const { settlementRows, ledgerRows, bankCredits } = generateBenchmarkCohort(20260904);
  return { settlementRows, ledgerRows, bankCredits };
}

export async function loadTruth(): Promise<TruthRow[]> {
  try {
    const path = join(process.cwd(), "data/truth/expected_outcomes.csv");
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      return parseTruthCSV(content);
    }
  } catch {
    // Fall back to in-memory deterministic truth
  }

  const { truthRows } = generateBenchmarkCohort(20260904);
  return truthRows;
}

export async function saveRun(run: ReconciliationRun): Promise<void> {
  // Always store in memory cache
  memoryRuns.set(run.runId, run);

  try {
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
  } catch (err) {
    console.warn("SQLite saveRun warning (kept in memory cache):", err);
  }
}

export async function getRun(runId: string): Promise<ReconciliationRun | null> {
  try {
    const db = getDb();
    const runRow = db.prepare("SELECT * FROM reconciliation_runs WHERE run_id = ?").get(runId) as Record<string, string> | undefined;
    if (runRow) {
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
          exceptionCode: (d.exception_code as never) ?? undefined,
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
  } catch (err) {
    console.warn("SQLite getRun warning:", err);
  }

  // Fallback to in-memory cache
  return memoryRuns.get(runId) ?? null;
}

export async function getAllRuns(): Promise<Array<{ runId: string; algorithmVersion: string; inputSha256: string; startedAt: string; finishedAt: string; closed: number; exceptions: number }>> {
  try {
    const db = getDb();
    const runs = db.prepare("SELECT * FROM reconciliation_runs ORDER BY created_at DESC").all() as Record<string, string>[];
    if (runs && runs.length > 0) {
      return runs.map(r => {
        const counts = db.prepare("SELECT decision, COUNT(*) as cnt FROM reconciliation_decisions WHERE run_id = ? GROUP BY decision").all(r.run_id) as { decision: string; cnt: number }[];
        const closed = counts.find(c => c.decision === "CLOSED")?.cnt ?? 0;
        const exceptions = counts.find(c => c.decision === "EXCEPTION")?.cnt ?? 0;
        return { runId: r.run_id, algorithmVersion: r.algorithm_version, inputSha256: r.input_sha256, startedAt: r.started_at, finishedAt: r.finished_at, closed, exceptions };
      });
    }
  } catch (err) {
    console.warn("SQLite getAllRuns warning:", err);
  }

  // Fallback to in-memory runs
  return Array.from(memoryRuns.values()).map(r => ({
    runId: r.runId,
    algorithmVersion: r.algorithmVersion,
    inputSha256: r.inputSha256,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    closed: r.results.filter(x => x.decision === "CLOSED").length,
    exceptions: r.results.filter(x => x.decision === "EXCEPTION").length,
  }));
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
  const category = params.actionCategory ?? "flag_for_followup";

  // Update in-memory record if present
  const memoryRun = memoryRuns.get(params.runId);
  if (memoryRun) {
    const row = memoryRun.results.find(r => r.settlementRowId === params.settlementRowId);
    if (row) {
      row.reviewStatus = params.status;
      row.reviewerId = params.reviewerId;
      row.reviewReason = params.reason;
      row.actionCategory = category;
      row.reviewedAt = params.reviewedAt;
    }
  }

  try {
    const db = getDb();
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
  } catch (err) {
    console.warn("SQLite markDecisionReviewed warning:", err);
  }
}
