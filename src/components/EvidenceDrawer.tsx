"use client";

import { useState } from "react";
import type { RowResult } from "@/core/types";
import { inr } from "@/core/money";

type EvidenceDrawerProps = {
  row: RowResult & { reviewStatus?: string; runId: string };
  onClose: () => void;
  onReviewSubmitted?: () => void;
};

const CODE_LABELS: Record<string, string> = {
  MISSING_LEDGER_RECORD: "Missing ledger record",
  AMOUNT_DELTA: "Amount mismatch across paise-level fields",
  DUPLICATE_LEDGER_CANDIDATE: "Multiple ledger candidates match entity ID",
  MISSING_BANK_CREDIT: "No bank statement credit matches net settlement total",
  AMBIGUOUS_BANK_CREDIT: "Multiple bank statement credits share the exact same total",
  UNVERIFIED_BANK_NARRATION: "Bank credit narration cannot verify Razorpay remitter",
  UNKNOWN_ADJUSTMENT: "Adjustment reason not on approved allowlist",
  SETTLEMENT_CONTROL_TOTAL_MISMATCH: "Settlement control total mismatch",
  UNSUPPORTED_ENTITY_TYPE: "Unsupported entity type",
};

export function EvidenceDrawer({ row, onClose, onReviewSubmitted }: EvidenceDrawerProps) {
  const [reviewerId, setReviewerId] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"REVIEWED" | "ESCALATED">("REVIEWED");
  const [actionCategory, setActionCategory] = useState("flag_for_followup");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleReview = async () => {
    if (!reviewerId.trim() || reason.trim().length < 3) {
      setError("Reviewer ID and a reason (≥3 chars) are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const encodedId = encodeURIComponent(row.settlementRowId);
      const res = await fetch(`/api/runs/${row.runId}/decisions/${encodedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerId: reviewerId.trim(),
          status: reviewStatus,
          actionCategory,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitted(true);
      onReviewSubmitted?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer">
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>Evidence Verification Chain</div>
            <code className="id-pill" style={{ marginTop: 4, display: "inline-block" }}>{row.settlementRowId}</code>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: "0.78rem" }}>Close</button>
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Decision */}
          <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Engine decision (immutable)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={row.decision === "CLOSED" ? "chip chip-closed" : "chip chip-exception"}>
                {row.decision}
              </span>
              {row.exceptionCode && (
                <span style={{ color: "var(--exception-text)", fontSize: "0.82rem" }}>
                  {CODE_LABELS[row.exceptionCode] ?? row.exceptionCode}
                </span>
              )}
            </div>
          </div>

          {/* Linked IDs */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Linked Source IDs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {row.ledgerId && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Merchant ledger ID</span>
                  <code className="id-pill">{row.ledgerId}</code>
                </div>
              )}
              {row.bankTxnId && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Bank transaction ID</span>
                  <code className="id-pill">{row.bankTxnId}</code>
                </div>
              )}
              {!row.ledgerId && !row.bankTxnId && (
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>No external records linked.</span>
              )}
            </div>
          </div>

          {/* Evidence rules */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Evidence rules evaluated ({row.evidence.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {row.evidence.map((ev, i) => (
                <div key={i} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
                  <div style={{ fontWeight: 500, fontSize: "0.78rem", marginBottom: 4, color: "var(--accent-blue)" }}>{ev.rule}</div>
                  {ev.sourceIds.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      {ev.sourceIds.map(id => <code key={id} className="id-pill" style={{ marginRight: 4 }}>{id}</code>)}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(ev.facts).map(([k, v]) => (
                      <div key={k} style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{k}: </span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                          {typeof v === "number" && (k.includes("Paise") || k.includes("Net") || k.includes("Credit"))
                            ? `${v} (${inr(v)})`
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Review section */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Reviewer action
              <span style={{ marginLeft: 6, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                (logs disposition audit trail; does not alter engine decision)
              </span>
            </div>

            {submitted ? (
              <div className="chip chip-closed" style={{ padding: "6px 12px" }}>✓ Review action logged</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ color: "var(--text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Reviewer identifier</label>
                  <input
                    id="reviewer-id"
                    className="input"
                    placeholder="e.g. auditor@company.com"
                    value={reviewerId}
                    onChange={e => setReviewerId(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label style={{ color: "var(--text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Disposition status</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["REVIEWED", "ESCALATED"] as const).map(s => (
                      <button
                        key={s}
                        id={`status-${s.toLowerCase()}`}
                        className={`btn ${reviewStatus === s ? "btn-primary" : "btn-secondary"}`}
                        style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                        onClick={() => setReviewStatus(s)}
                      >
                        {s === "REVIEWED" ? "Reviewed" : "Escalate"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: "var(--text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Action category</label>
                  <select
                    id="action-category"
                    className="input"
                    value={actionCategory}
                    onChange={e => setActionCategory(e.target.value)}
                  >
                    <option value="flag_for_followup">Flag for Follow-up</option>
                    <option value="reissue_recon_t2">Reissue Recon (T+2)</option>
                    <option value="escalate_finance_lead">Escalate to Finance Lead</option>
                    <option value="insufficient_information">Insufficient Information</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: "var(--text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Audit reason (min 3 chars)</label>
                  <textarea
                    id="review-reason"
                    className="input"
                    style={{ minHeight: 70, resize: "vertical" }}
                    placeholder="Document explanation for audit trail..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
                {error && <div style={{ color: "var(--exception-text)", fontSize: "0.78rem" }}>{error}</div>}
                <button
                  id="submit-review"
                  className="btn btn-primary"
                  onClick={handleReview}
                  disabled={submitting}
                >
                  {submitting ? <><div className="spinner" /> Recording…</> : "Submit Review"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
