"use client";

import type { RowResult } from "@/core/types";
import { inr } from "@/core/money";

type ExceptionTableProps = {
  results: (RowResult & { reviewStatus?: string })[];
  filter?: "ALL" | "CLOSED" | "EXCEPTION";
  onRowClick?: (row: RowResult) => void;
};

const CODE_LABELS: Record<string, string> = {
  MISSING_LEDGER_RECORD: "Missing ledger record",
  AMOUNT_DELTA: "Amount mismatch (paise)",
  DUPLICATE_LEDGER_CANDIDATE: "Duplicate ledger candidates",
  MISSING_BANK_CREDIT: "No bank credit found",
  AMBIGUOUS_BANK_CREDIT: "Multiple bank credits (ambiguous)",
  UNVERIFIED_BANK_NARRATION: "Narration cannot prove source",
  UNKNOWN_ADJUSTMENT: "Adjustment reason not allowlisted",
  SETTLEMENT_CONTROL_TOTAL_MISMATCH: "Settlement control total mismatch",
  UNSUPPORTED_ENTITY_TYPE: "Unsupported entity type",
};

const REVIEW_LABELS: Record<string, string> = {
  UNREVIEWED: "Unreviewed",
  REVIEWED: "Reviewed",
  ESCALATED: "Escalated",
};

function getNetPaise(result: RowResult): number | undefined {
  for (const ev of result.evidence) {
    if (typeof ev.facts.netPaise === "number") return ev.facts.netPaise;
    if (typeof ev.facts.settlementNet === "number") return ev.facts.settlementNet;
  }
}

/** Returns the numeric suffix of a row ID like "rp-42" → 42.
 *  Non-matching IDs return NaN, which floats to the end. */
const rowIdNum = (id: string): number => {
  const m = id.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : NaN;
};

export function ExceptionTable({ results, filter = "ALL", onRowClick }: ExceptionTableProps) {
  const visible = (filter === "ALL" ? results : results.filter(r => r.decision === filter))
    .slice()
    .sort((a, b) => rowIdNum(a.settlementRowId) - rowIdNum(b.settlementRowId));

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Row ID</th>
            <th>Decision</th>
            <th>Exception / Reason</th>
            <th>Ledger ID</th>
            <th>Bank Txn</th>
            <th>Net (₹)</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(row => {
            const net = getNetPaise(row);
            return (
              <tr key={row.settlementRowId} onClick={() => onRowClick?.(row)}>
                <td>
                  <code className="id-pill">{row.settlementRowId}</code>
                </td>
                <td>
                  <span className={row.decision === "CLOSED" ? "chip chip-closed" : "chip chip-exception"}>
                    {row.decision}
                  </span>
                </td>
                <td style={{ color: "var(--text-secondary)", maxWidth: 280 }}>
                  {row.exceptionCode
                    ? <span title={row.exceptionCode}>{CODE_LABELS[row.exceptionCode] ?? row.exceptionCode}</span>
                    : row.decision === "CLOSED"
                    ? <span style={{ color: "var(--text-muted)" }}>Exact entity, paise fields &amp; unique bank total</span>
                    : "—"}
                </td>
                <td>
                  {row.ledgerId
                    ? <code className="id-pill">{row.ledgerId}</code>
                    : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td>
                  {row.bankTxnId
                    ? <code className="id-pill">{row.bankTxnId}</code>
                    : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem" }}>
                  {net !== undefined ? (
                    <span title={`${net} paise`}>{inr(net)}</span>
                  ) : "—"}
                </td>
                <td>
                  <span className={
                    (row as { reviewStatus?: string }).reviewStatus === "REVIEWED" ? "chip chip-closed" :
                    (row as { reviewStatus?: string }).reviewStatus === "ESCALATED" ? "chip chip-amber" :
                    "chip chip-neutral"
                  } style={{ fontSize: "0.68rem" }}>
                    {REVIEW_LABELS[(row as { reviewStatus?: string }).reviewStatus ?? "UNREVIEWED"]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {visible.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
          No records match this filter.
        </div>
      )}
    </div>
  );
}
