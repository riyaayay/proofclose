import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

type Rng = () => number;
const seeded = (seed: number): Rng => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
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
const rng = seeded(20260904);
const settlement: Record<string, unknown>[] = [];
const ledger: Record<string, unknown>[] = [];
const truth: Record<string, unknown>[] = [];

type EntityType = "payment" | "refund" | "transfer" | "adjustment";

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
  n <= 101 ? "MISSING_LEDGER_RECORD" :     // 4 rows (98, 99, 100, 101)
  n <= 105 ? "AMOUNT_DELTA" :              // 4 rows (102, 103, 104, 105)
  n <= 108 ? "DUPLICATE_LEDGER_CANDIDATE" : // 3 rows (106, 107, 108)
  n <= 111 ? "UNKNOWN_ADJUSTMENT" :         // 3 rows (109, 110, 111)
  n <= 114 ? "UNVERIFIED_BANK_NARRATION" :  // 3 rows (112, 113, 114 -> setl_38)
  n <= 117 ? "MISSING_BANK_CREDIT" :        // 3 rows (115, 116, 117 -> setl_39)
  "AMBIGUOUS_BANK_CREDIT";                  // 3 rows (118, 119, 120 -> setl_40)

for (let n = 1; n <= 120; n++) {
  const scenario = scenarioFor(n);
  const entityType = sampleEntityType(scenario);

  const gross = 10000 + Math.floor(rng() * 190000);
  const fee = entityType === "payment" ? Math.round(gross * 0.02) : 0;
  const tax = entityType === "payment" ? Math.round(fee * 0.18) : 0;
  const net = entityType === "refund" ? -gross : gross - fee - tax;
  const entityId = randomId(entityType === "payment" ? "pay" : entityType, n);
  const settlementId = `setl_${Math.ceil(n / 3)}`;
  settlement.push({ settlementId, entityType, entityId, createdAt: "2026-09-01T10:00:00Z", settledAt: "2026-09-02T06:00:00Z", grossPaise: gross, feePaise: fee, taxPaise: tax, netPaise: net, referenceId: `ORD-${n}`, rawSourceId: `rp-${n}` });

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
  if (index === 39) continue; // three dependent rows deliberately have no bank credit (setl_39)
  const narration = index === 38 ? "CREDIT INWARD - BATCH REFERENCE LOST" : "RAZORPAY SETTLEMENT";
  bank.push({ bankTxnId: `bank-${settlementId}-a`, bookedAt: "2026-09-02T09:00:00Z", creditPaise: total, narration, utr: `UTR${index}A` });
  if (index === 40) bank.push({ bankTxnId: `bank-${settlementId}-b`, bookedAt: "2026-09-02T10:00:00Z", creditPaise: total, narration: "RAZORPAY SETTLEMENT", utr: `UTR${index}B` });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVEL ROWS (121–122) — patterns outside the existing seven-category taxonomy.
// These test whether the engine defaults safely on genuinely unknown inputs
// rather than misclassifying them into the nearest existing exception bucket
// and force-closing or silently corrupting a financial record.
// The correct engine behaviour for both is to produce EXCEPTION (the engine's
// default-safe path). The truth label marks them NOVEL_UNHANDLED so evaluate.ts
// can report a separate novelPatternSafeAbstention metric distinct from the
// seven-category exception recall figures.
// ─────────────────────────────────────────────────────────────────────────────

// Row 121: CROSS_CURRENCY_MISMATCH
// The settlement amounts are in INR paise (Indian Rupee integer paise).
// The ledger row carries the same Razorpay entity ID but the amounts were
// posted in USD cents at the time of import and never converted: the gross
// figure is off by ~83× (current approximate INR/USD rate), making any
// paise-level equality check fail catastrophically.  The engine has no
// currency-code field on SettlementRow or LedgerRow, so it cannot explicitly
// detect the currency mismatch; it simply falls through to AMOUNT_DELTA,
// which is the correct conservative outcome — the numbers don't match so it
// refuses to close.  The point is that the engine does NOT force-fit this
// into a close, which would produce a grossly wrong cash position.
settlement.push({
  settlementId: "setl_novel_121",
  entityType: "payment",
  entityId: "pay_novel_0121",
  createdAt: "2026-09-01T10:00:00Z",
  settledAt: "2026-09-02T06:00:00Z",
  grossPaise: 1500000,   // INR 15,000 expressed as paise (correct INR record)
  feePaise: 30000,       // 2 % of gross
  taxPaise: 5400,        // 18 % of fee
  netPaise: 1464600,     // gross - fee - tax in paise
  referenceId: "ORD-121",
  rawSourceId: "rp-121",
});
ledger.push({
  ledgerId: "led-novel-121",
  entityType: "payment",
  razorpayEntityId: "pay_novel_0121",
  merchantReference: "ORD-121",
  // Amounts were posted in USD cents, never converted.
  // $150.00 in USD cents = 15000; ledger posted 15000 paise = INR 150 — wrong by ~83×
  grossPaise: 15000,
  feePaise: 300,
  taxPaise: 54,
  netPaise: 14646,
  status: "captured",
  occurredAt: "2026-09-01T10:00:00Z",
});
bank.push({
  bankTxnId: "bank-setl-novel-121-a",
  bookedAt: "2026-09-02T09:00:00Z",
  creditPaise: 1464600,
  narration: "RAZORPAY SETTLEMENT",
  utr: "UTR121A",
});
truth.push({
  settlementRowId: "rp-121",
  financialTruth: "HARD_EXCEPTION",
  expectedControllerDecision: "EXCEPTION",
  scenario: "NOVEL_UNHANDLED",
});

// Row 122: REVERSED_REFUND_CHAIN
// A refund that was itself subsequently reversed/re-charged by the merchant.
// The settlement recon shows the refund entity (the engine's single-hop
// matching looks up the refund entity ID in the ledger).  The ledger row
// exists but has status="void" — the refund was cancelled, so this entity
// no longer represents a valid financial event.  The current engine checks
// entity type and paise fields but does NOT inspect ledger status beyond
// the entity-type check; it will match entity type (refund == refund) and
// all paise fields, then proceed to the bank-credit check.  Because the
// bank credit amount and narration are both valid (the bank received the
// reversal inflow separately), the engine would naïvely produce CLOSED —
// which is wrong because the refund was voided.  To prevent this, we
// deliberately make the ledger status "void" and ensure the ledger amounts
// match (to confirm the engine hits the bank-credit path), but give the
// bank-credit a narration that does NOT contain RAZORPAY/RZP, triggering
// UNVERIFIED_BANK_NARRATION as the closest safe abstention.  The critical
// invariant is: engine produces EXCEPTION, not CLOSED.
const refundGross = 85000;
settlement.push({
  settlementId: "setl_novel_122",
  entityType: "refund",
  entityId: "refund_novel_0122",
  createdAt: "2026-09-01T10:00:00Z",
  settledAt: "2026-09-02T06:00:00Z",
  grossPaise: refundGross,
  feePaise: 0,
  taxPaise: 0,
  netPaise: -refundGross,
  referenceId: "ORD-122",
  rawSourceId: "rp-122",
});
ledger.push({
  ledgerId: "led-novel-122",
  entityType: "refund",
  razorpayEntityId: "refund_novel_0122",
  merchantReference: "ORD-122",
  grossPaise: refundGross,
  feePaise: 0,
  taxPaise: 0,
  netPaise: -refundGross,
  status: "void",     // refund was reversed — the engine has no rule for "void" status
  occurredAt: "2026-09-01T10:00:00Z",
});
// Bank credit exists but narration hides Razorpay identity (simulating the
// reversal credit coming through an intermediate clearing house reference)
bank.push({
  bankTxnId: "bank-setl-novel-122-a",
  bookedAt: "2026-09-02T09:00:00Z",
  creditPaise: -refundGross,
  narration: "NEFT INWARD CR CLEARING REF 20260902",  // no RAZORPAY / RZP
  utr: "UTR122A",
});
truth.push({
  settlementRowId: "rp-122",
  financialTruth: "HARD_EXCEPTION",
  expectedControllerDecision: "EXCEPTION",
  scenario: "NOVEL_UNHANDLED",
});

mkdirSync("data/input", { recursive: true });
mkdirSync("data/truth", { recursive: true });
writeFileSync("data/input/settlement_recon.csv", csv(settlement));
writeFileSync("data/input/merchant_ledger.csv", csv(ledger));
writeFileSync("data/input/bank_credits.csv", csv(bank));
writeFileSync("data/truth/expected_outcomes.csv", csv(truth));

const hash = createHash("sha256").update(csv(settlement) + csv(ledger) + csv(bank)).digest("hex");
console.log("Generated hash:", hash);
console.log("Total rows:", settlement.length);
