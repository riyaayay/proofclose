import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseSettlementCSV, parseLedgerCSV, parseBankCreditsCSV, parseTruthCSV } from "@/adapters/csv";
import { reconcile } from "@/core/reconcile";
import { evaluate } from "@/core/evaluate";
import { saveRun } from "@/core/audit";

export const runtime = "nodejs";

type Rng = () => number;
const seeded = (seed: number): Rng => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const csv = (rows: Record<string, unknown>[]) => {
  const headers = Object.keys(rows[0]);
  const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map(r => headers.map(h => quote(r[h])).join(","))].join("\n");
};

const randomId = (prefix: string, n: number) => `${prefix}_${String(n).padStart(4, "0")}`;

type EntityType = "payment" | "refund" | "transfer" | "adjustment";

export async function POST(request: Request) {
  const started = performance.now();
  let seed = 20260904;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.seed === "number" && Number.isFinite(body.seed)) {
      seed = body.seed;
    } else {
      seed = Math.floor(Math.random() * 90000000) + 10000000;
    }
  } catch {
    seed = Math.floor(Math.random() * 90000000) + 10000000;
  }

  const rng = seeded(seed);
  const settlement: Record<string, unknown>[] = [];
  const ledger: Record<string, unknown>[] = [];
  const truth: Record<string, unknown>[] = [];

  const sampleEntityType = (scenario: string): EntityType => {
    if (scenario === "UNKNOWN_ADJUSTMENT") return "adjustment";
    const r = rng();
    if (r < 0.55) return "payment";
    if (r < 0.75) return "refund";
    if (r < 0.90) return "transfer";
    return "adjustment";
  };

  const scenarioFor = (n: number) =>
    n <= 97 ? "CLOSE" :
    n <= 101 ? "MISSING_LEDGER_RECORD" :
    n <= 105 ? "AMOUNT_DELTA" :
    n <= 108 ? "DUPLICATE_LEDGER_CANDIDATE" :
    n <= 111 ? "UNKNOWN_ADJUSTMENT" :
    n <= 114 ? "UNVERIFIED_BANK_NARRATION" :
    n <= 117 ? "MISSING_BANK_CREDIT" :
    "AMBIGUOUS_BANK_CREDIT";

  for (let n = 1; n <= 120; n++) {
    const scenario = scenarioFor(n);
    const entityType = sampleEntityType(scenario);

    const gross = 10000 + Math.floor(rng() * 190000);
    const fee = entityType === "payment" ? Math.round(gross * 0.02) : 0;
    const tax = entityType === "payment" ? Math.round(fee * 0.18) : 0;
    const net = entityType === "refund" ? -gross : gross - fee - tax;
    const entityId = randomId(entityType === "payment" ? "pay" : entityType, n);
    const settlementId = `setl_${Math.ceil(n / 3)}`;
    settlement.push({
      settlementId,
      entityType,
      entityId,
      createdAt: "2026-09-01T10:00:00Z",
      settledAt: "2026-09-02T06:00:00Z",
      grossPaise: gross,
      feePaise: fee,
      taxPaise: tax,
      netPaise: net,
      referenceId: `ORD-${n}`,
      rawSourceId: `rp-${n}`,
    });

    if (scenario !== "MISSING_LEDGER_RECORD") {
      ledger.push({
        ledgerId: `led-${n}`,
        entityType,
        razorpayEntityId: entityId,
        merchantReference: `ORD-${n}`,
        grossPaise: scenario === "AMOUNT_DELTA" ? gross - 100 : gross,
        feePaise: fee,
        taxPaise: tax,
        netPaise: scenario === "AMOUNT_DELTA" ? net - 100 : net,
        status: entityType === "payment" ? "captured" : entityType === "refund" ? "refunded" : entityType === "transfer" ? "transferred" : "adjusted",
        occurredAt: "2026-09-01T10:00:00Z",
        adjustmentReason: entityType === "adjustment"
          ? (scenario === "UNKNOWN_ADJUSTMENT" ? "manual_adjustment_without_evidence" : "gateway_fee_correction")
          : undefined,
      });
    }
    if (scenario === "DUPLICATE_LEDGER_CANDIDATE") ledger.push({ ...ledger.at(-1)!, ledgerId: `led-duplicate-${n}` });
    truth.push({
      settlementRowId: `rp-${n}`,
      financialTruth: n <= 97 || scenario === "UNVERIFIED_BANK_NARRATION" ? "CLOSEABLE" : "HARD_EXCEPTION",
      expectedControllerDecision: scenario === "CLOSE" ? "CLOSED" : "EXCEPTION",
      scenario,
    });
  }

  const bank: Record<string, unknown>[] = [];
  for (const settlementId of [...new Set(settlement.map(r => String(r.settlementId)))]) {
    const rows = settlement.filter(r => r.settlementId === settlementId);
    const total = rows.reduce((sum, r) => sum + Number(r.netPaise), 0);
    const index = Number(settlementId.replace("setl_", ""));
    if (index === 39) continue;
    const narration = index === 38 ? "CREDIT INWARD - BATCH REFERENCE LOST" : "RAZORPAY SETTLEMENT";
    bank.push({ bankTxnId: `bank-${settlementId}-a`, bookedAt: "2026-09-02T09:00:00Z", creditPaise: total, narration, utr: `UTR${index}A` });
    if (index === 40) bank.push({ bankTxnId: `bank-${settlementId}-b`, bookedAt: "2026-09-02T10:00:00Z", creditPaise: total, narration: "RAZORPAY SETTLEMENT", utr: `UTR${index}B` });
  }

  const settlementCsv = csv(settlement);
  const ledgerCsv = csv(ledger);
  const bankCsv = csv(bank);
  const truthCsv = csv(truth);

  mkdirSync("data/input", { recursive: true });
  mkdirSync("data/truth", { recursive: true });
  writeFileSync("data/input/settlement_recon.csv", settlementCsv);
  writeFileSync("data/input/merchant_ledger.csv", ledgerCsv);
  writeFileSync("data/input/bank_credits.csv", bankCsv);
  writeFileSync("data/truth/expected_outcomes.csv", truthCsv);

  const inputSha256 = createHash("sha256").update(settlementCsv + ledgerCsv + bankCsv).digest("hex");

  // Run reconciliation immediately
  const settlementRows = parseSettlementCSV(settlementCsv);
  const ledgerRows = parseLedgerCSV(ledgerCsv);
  const bankCredits = parseBankCreditsCSV(bankCsv);
  const truthRows = parseTruthCSV(truthCsv);

  const run = reconcile(settlementRows, ledgerRows, bankCredits);
  await saveRun(run);

  // Evaluate and update docs/metrics.json
  const metrics = evaluate(run.results, truthRows);
  const metricsPayload = {
    ...metrics,
    runId: run.runId,
    algorithmVersion: run.algorithmVersion,
    inputSha256,
    cohortSeed: seed,
    cohortRows: 120,
    generatedAt: new Date().toISOString(),
  };

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/metrics.json", JSON.stringify(metricsPayload, null, 2));

  return NextResponse.json({
    runId: run.runId,
    seed,
    inputSha256,
    durationMs: Math.round(performance.now() - started),
    total: 120,
    closed: run.results.filter(r => r.decision === "CLOSED").length,
    exceptions: run.results.filter(r => r.decision === "EXCEPTION").length,
  });
}
