import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import type { BankCredit, LedgerRow, SettlementRow } from "@/core/types";

function parseNum(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${v}`);
  return n;
}

export function parseSettlementCSV(content: string): SettlementRow[] {
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r) => ({
    settlementId: r.settlementId,
    entityType: r.entityType as SettlementRow["entityType"],
    entityId: r.entityId,
    createdAt: r.createdAt,
    settledAt: r.settledAt,
    grossPaise: parseNum(r.grossPaise),
    feePaise: parseNum(r.feePaise),
    taxPaise: parseNum(r.taxPaise),
    netPaise: parseNum(r.netPaise),
    referenceId: r.referenceId || undefined,
    rawSourceId: r.rawSourceId,
  }));
}

export function parseLedgerCSV(content: string): LedgerRow[] {
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r) => ({
    ledgerId: r.ledgerId,
    entityType: r.entityType as LedgerRow["entityType"],
    razorpayEntityId: r.razorpayEntityId || undefined,
    merchantReference: r.merchantReference || undefined,
    grossPaise: parseNum(r.grossPaise),
    feePaise: parseNum(r.feePaise),
    taxPaise: parseNum(r.taxPaise),
    netPaise: parseNum(r.netPaise),
    status: r.status as LedgerRow["status"],
    occurredAt: r.occurredAt,
    adjustmentReason: r.adjustmentReason || undefined,
  }));
}

export function parseBankCreditsCSV(content: string): BankCredit[] {
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r) => ({
    bankTxnId: r.bankTxnId,
    bookedAt: r.bookedAt,
    creditPaise: parseNum(r.creditPaise),
    narration: r.narration,
    utr: r.utr || undefined,
  }));
}

export function parseTruthCSV(content: string) {
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r) => ({
    settlementRowId: r.settlementRowId,
    financialTruth: r.financialTruth as "CLOSEABLE" | "HARD_EXCEPTION",
    expectedControllerDecision: r.expectedControllerDecision as "CLOSED" | "EXCEPTION",
    scenario: r.scenario,
  }));
}

export function readCSV(path: string): string {
  return readFileSync(path, "utf-8");
}
