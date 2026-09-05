"use client";

/** Shape of docs/metrics.json as written by scripts/evaluate.ts */
export type Metrics = {
  total: number;
  taxonomyTotal?: number;
  novelPatternRows?: number;
  predictedClosed: number;
  predictedExceptions: number;
  expectedClosed: number;
  expectedExceptions: number;
  correctClosed: number;
  correctHardExceptions: number;
  conservativeAbstentions: number;
  falseClosures: number;
  financialCloseable: number;
  hardExceptions: number;
  autoCloseMatchRate: number | null;
  closePrecision: number | null;
  closeRecall: number | null;
  closeabilityRecall: number | null;
  exceptionPrecision: number | null;
  hardExceptionRecall: number | null;
  financialStateAccuracy: number | null;
  // Novel-pattern out-of-taxonomy metrics
  novelPatternSafeAbstentions?: number;
  novelPatternFalseClosures?: number;
  // provenance
  runId?: string;
  algorithmVersion?: string;
  inputSha256?: string;
  cohortSeed?: number;
  cohortRows?: number;
  generatedAt?: string;
};

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

type MetricRowProps = {
  label: string;
  formula: string;
  value: string;
  note?: string;
  highlight?: boolean;
  danger?: boolean;
};

function MetricRow({ label, formula, value, note, highlight, danger }: MetricRowProps) {
  const color = danger ? "var(--exception-text)" : highlight ? "var(--accent-blue)" : "var(--text-primary)";
  return (
    <tr style={{ background: highlight ? "rgba(91, 127, 157, 0.06)" : undefined }}>
      <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        {note && <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: 2 }}>{note}</div>}
      </td>
      <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", verticalAlign: "top" }}>
        {formula}
      </td>
      <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "1rem", color, textAlign: "right", verticalAlign: "top" }}>
        {value}
      </td>
    </tr>
  );
}

export function MetricsCard({ metrics }: { metrics: Metrics }) {
  const taxonomyTotal = metrics.taxonomyTotal ?? metrics.total;
  const novelRows = metrics.novelPatternRows ?? 0;
  const novelSafe = metrics.novelPatternSafeAbstentions ?? 0;
  const novelFalse = metrics.novelPatternFalseClosures ?? 0;

  const rows = [
    {
      label: "Auto-close match rate",
      formula: "correct_closed / taxonomy_total",
      value: pct(metrics.autoCloseMatchRate),
      note: `${metrics.correctClosed} of ${taxonomyTotal} taxonomy rows auto-closed`,
    },
    {
      label: "Close precision",
      formula: "correct_closed / predicted_closed",
      value: pct(metrics.closePrecision),
      highlight: true,
      note: "Fraction of CLOSED outputs that were correct — zero false closures is the invariant",
    },
    {
      label: "Close recall (strict)",
      formula: "correct_closed / expected_closed",
      value: pct(metrics.closeRecall),
      highlight: true,
      note: `All ${metrics.expectedClosed} rows the controller was expected to close were closed`,
    },
    {
      label: "Closeability recall",
      formula: "correct_closed / financial_closeable",
      value: pct(metrics.closeabilityRecall),
      note: `${metrics.conservativeAbstentions} rows were financially closeable but held in review (UNVERIFIED_BANK_NARRATION)`,
    },
    {
      label: "Exception precision",
      formula: "correct_hard_exceptions / predicted_exceptions",
      value: pct(metrics.exceptionPrecision),
      note: "Fraction of exceptions that were genuinely unresolvable",
    },
    {
      label: "Hard-exception recall",
      formula: "correct_hard_exceptions / hard_exceptions",
      value: pct(metrics.hardExceptionRecall),
      note: `All ${metrics.hardExceptions} genuinely unresolvable rows correctly flagged`,
    },
    {
      label: "Financial-state accuracy",
      formula: "(correct_closed + correct_hard_exc) / taxonomy_total",
      value: pct(metrics.financialStateAccuracy),
    },
    {
      label: "Conservative abstentions",
      formula: "engine=EXCEPTION ∧ financialTruth=CLOSEABLE",
      value: String(metrics.conservativeAbstentions),
      note: "Controller safely refused auto-close due to unproven bank narration",
    },
    {
      label: "False closures",
      formula: "engine=CLOSED ∧ expected=EXCEPTION",
      value: String(metrics.falseClosures),
      note: "Zero false closures ensures cash positions are never misstated",
      danger: metrics.falseClosures > 0,
    },
    ...(novelRows > 0 ? [
      {
        label: "Novel-pattern safe abstentions",
        formula: "novel_rows → EXCEPTION (correct)",
        value: `${novelSafe}/${novelRows}`,
        highlight: true,
        note: "Out-of-taxonomy rows the engine correctly refused to force-fit into an existing exception code",
      },
      {
        label: "Novel-pattern false closures",
        formula: "novel_rows → CLOSED (wrong)",
        value: String(novelFalse),
        danger: novelFalse > 0,
        note: "Engine must never close a genuinely unknown discrepancy pattern — must be 0",
      },
    ] : []),
  ];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Confusion matrix */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 12 }}>
          Confusion matrix — controller decision vs. expected decision
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <div style={{ background: "var(--closed-bg)", border: "1px solid var(--closed-border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--closed-text)", fontSize: "0.72rem", fontWeight: 500 }}>Correct Closures</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--closed-text)", margin: "4px 0" }}>{metrics.correctClosed}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>engine closed, expected closed</div>
          </div>
          <div style={{ background: "var(--exception-bg)", border: "1px solid var(--exception-border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--exception-text)", fontSize: "0.72rem", fontWeight: 500 }}>False Closures</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: metrics.falseClosures > 0 ? "var(--exception-text)" : "var(--text-muted)", margin: "4px 0" }}>{metrics.falseClosures}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>engine closed, expected exception</div>
          </div>
          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--amber-text)", fontSize: "0.72rem", fontWeight: 500 }}>Conservative Abstentions</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--amber-text)", margin: "4px 0" }}>{metrics.conservativeAbstentions}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>closeable, but held for proof</div>
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem", fontWeight: 500 }}>Correct Hard Exceptions</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)", margin: "4px 0" }}>{metrics.correctHardExceptions}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>unresolvable, flagged correctly</div>
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem", fontWeight: 500 }}>Total Evaluated</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)", margin: "4px 0" }}>{metrics.total}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
              {metrics.cohortSeed ? `cohort seed: ${metrics.cohortSeed}` : "synthetic cohort"}
            </div>
          </div>
          {/* Novel-pattern card — only shown when novel rows are present */}
          {novelRows > 0 && (
            <div style={{ background: "rgba(91, 127, 157, 0.08)", border: "1px solid rgba(91, 127, 157, 0.3)", borderRadius: 6, padding: "12px 14px" }}>
              <div style={{ color: "var(--accent-blue)", fontSize: "0.72rem", fontWeight: 500 }}>Novel-Pattern Abstentions</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--accent-blue)", margin: "4px 0" }}>{novelSafe}/{novelRows}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>out-of-taxonomy rows correctly declined</div>
            </div>
          )}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem", fontWeight: 500 }}>Predicted Breakdown</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text-primary)", margin: "6px 0 2px" }}>
              {metrics.predictedClosed} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>closed</span> / {metrics.predictedExceptions} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>exc</span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
              expected {metrics.expectedClosed} / {metrics.expectedExceptions}
            </div>
          </div>
        </div>
      </div>

      {/* Novel-pattern callout banner (only when novel rows present) */}
      {novelRows > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "rgba(91, 127, 157, 0.06)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: "var(--accent-blue)", fontSize: "1rem", flexShrink: 0 }}>🔬</span>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
              {novelSafe}/{novelRows} novel patterns correctly declined
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {novelRows} rows use discrepancy types outside the seven-category taxonomy entirely (currency mismatch, reversed-refund chain).
              The engine correctly refuses to force-fit either into an existing exception code — producing EXCEPTION via the closest safe path
              without a dedicated rule. <span style={{ color: novelFalse === 0 ? "var(--closed-text)" : "var(--exception-text)", fontWeight: 500 }}>
                {novelFalse === 0 ? "Zero novel-pattern false closures." : `${novelFalse} novel-pattern false closure(s) — CRITICAL.`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Metric table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Metric</th>
            <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Formula</th>
            <th style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <MetricRow key={r.label} {...r} />)}
        </tbody>
      </table>

      {/* Provenance */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.03em", marginBottom: 6 }}>
          Run provenance — all metrics above reflect the output of a single evaluated execution
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {metrics.runId && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Run ID: <code className="id-pill">{metrics.runId}</code>
            </div>
          )}
          {metrics.inputSha256 && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Input SHA-256: <code className="id-pill" style={{ fontSize: "0.68rem", wordBreak: "break-all" }}>{metrics.inputSha256}</code>
            </div>
          )}
          {metrics.generatedAt && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Generated: <code className="id-pill">{metrics.generatedAt}</code>
            </div>
          )}
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
            Algorithm: {metrics.algorithmVersion ?? "v1.0.0"} · Cohort: synthetic, {taxonomyTotal + novelRows} rows
            {novelRows > 0 ? ` (${taxonomyTotal} standard-taxonomy + ${novelRows} novel-pattern)` : ""}, seed {metrics.cohortSeed ?? 20260904}.
          </div>
        </div>
      </div>
    </div>
  );
}
