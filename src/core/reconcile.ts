import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type { BankCredit, LedgerRow, ReconciliationRun, RowResult, SettlementRow } from "./types";

const allowedAdjustments = new Set(["gateway_fee_correction", "refund_reversal"]);
const sameMoney = (a: number, b: number) => a === b;

function indexByEntity(rows: LedgerRow[]) {
  const index = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!row.razorpayEntityId) continue;
    index.set(row.razorpayEntityId, [...(index.get(row.razorpayEntityId) ?? []), row]);
  }
  return index;
}

function groupBySettlement(rows: SettlementRow[]) {
  const out = new Map<string, SettlementRow[]>();
  for (const row of rows) out.set(row.settlementId, [...(out.get(row.settlementId) ?? []), row]);
  return out;
}

export function reconcile(
  settlementRows: SettlementRow[], ledgerRows: LedgerRow[], bankCredits: BankCredit[],
): ReconciliationRun {
  const startedAt = new Date().toISOString();
  const ledgerIndex = indexByEntity(ledgerRows);
  const bySettlement = groupBySettlement(settlementRows);
  const bankBySettlement = new Map<string, BankCredit[]>();

  for (const [settlementId, rows] of bySettlement) {
    const expectedCredit = rows.reduce((sum, r) => sum + r.netPaise, 0);
    // Production code also constrains bookedAt to the settlement date ±2 business days.
    const candidates = bankCredits.filter(b => sameMoney(b.creditPaise, expectedCredit));
    bankBySettlement.set(settlementId, candidates);
  }

  const results: RowResult[] = settlementRows.map((row) => {
    const evidence = [{ rule: "INPUT_ROW_HASHED", sourceIds: [row.rawSourceId], facts: { entityId: row.entityId, settlementId: row.settlementId } }];
    const candidates = ledgerIndex.get(row.entityId) ?? [];
    if (candidates.length === 0) return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "MISSING_LEDGER_RECORD", evidence } as RowResult;
    if (candidates.length > 1) return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "DUPLICATE_LEDGER_CANDIDATE", evidence: [...evidence, { rule: "EXACT_ID_MULTIPLE_LEDGER_ROWS", sourceIds: candidates.map(c => c.ledgerId), facts: { count: candidates.length } }] } as RowResult;

    const ledger = candidates[0];
    if (ledger.entityType !== row.entityType || !sameMoney(ledger.grossPaise, row.grossPaise) || !sameMoney(ledger.netPaise, row.netPaise) || !sameMoney(ledger.feePaise, row.feePaise) || !sameMoney(ledger.taxPaise, row.taxPaise)) {
      return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "AMOUNT_DELTA", evidence: [...evidence, { rule: "EXACT_AMOUNT_COMPARISON_FAILED", sourceIds: [ledger.ledgerId], facts: { settlementNet: row.netPaise, ledgerNet: ledger.netPaise } }] } as RowResult;
    }
    if (row.entityType === "adjustment" && !allowedAdjustments.has(ledger.adjustmentReason ?? "")) {
      return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "UNKNOWN_ADJUSTMENT", evidence: [...evidence, { rule: "ADJUSTMENT_REASON_NOT_ALLOWLISTED", sourceIds: [ledger.ledgerId], facts: { reason: ledger.adjustmentReason ?? "" } }] } as RowResult;
    }

    const bankCandidates = bankBySettlement.get(row.settlementId) ?? [];
    if (bankCandidates.length === 0) return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "MISSING_BANK_CREDIT", evidence: [...evidence, { rule: "SETTLEMENT_CONTROL_TOTAL_HAS_NO_BANK_CREDIT", sourceIds: [], facts: { settlementId: row.settlementId } }] } as RowResult;
    if (bankCandidates.length !== 1) return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "AMBIGUOUS_BANK_CREDIT", evidence: [...evidence, { rule: "SETTLEMENT_CONTROL_TOTAL_HAS_MULTIPLE_BANK_CREDITS", sourceIds: bankCandidates.map(b => b.bankTxnId), facts: { settlementId: row.settlementId, candidateCount: bankCandidates.length } }] } as RowResult;
    const bank = bankCandidates[0];
    if (!/(?:RAZORPAY|RZP)/i.test(bank.narration)) return { settlementRowId: row.rawSourceId, decision: "EXCEPTION", exceptionCode: "UNVERIFIED_BANK_NARRATION", evidence: [...evidence, { rule: "UNIQUE_AMOUNT_BUT_NARRATION_CANNOT_PROVE_SOURCE", sourceIds: [bank.bankTxnId], facts: { narration: bank.narration } }] } as RowResult;

    return { settlementRowId: row.rawSourceId, decision: "CLOSED", ledgerId: ledger.ledgerId, bankTxnId: bank.bankTxnId, evidence: [...evidence, { rule: "EXACT_ENTITY_TYPE_AND_ALL_PAISE_FIELDS_MATCH", sourceIds: [ledger.ledgerId], facts: { netPaise: row.netPaise } }, { rule: "UNIQUE_SETTLEMENT_CONTROL_TOTAL_MATCHES_BANK", sourceIds: [bank.bankTxnId], facts: { settlementId: row.settlementId } }] } as RowResult;
  });

  const inputSha256 = createHash("sha256").update(JSON.stringify({ settlementRows, ledgerRows, bankCredits })).digest("hex");
  return { runId: `run_${nanoid(12)}`, algorithmVersion: "1.0.0", inputSha256, startedAt, finishedAt: new Date().toISOString(), results };
}
