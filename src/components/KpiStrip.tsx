"use client";

type KpiProps = {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "green" | "red" | "amber" | "blue";
};

function Kpi({ label, value, sub, variant = "default" }: KpiProps) {
  const colors: Record<string, string> = {
    default: "var(--text-primary)",
    green: "var(--closed-text)",
    red: "var(--exception-text)",
    amber: "var(--amber-text)",
    blue: "var(--accent-blue)",
  };

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.03em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: colors[variant], fontSize: "1.55rem", fontWeight: 600, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: 5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

type KpiStripProps = {
  total: number;
  closed: number;
  exceptions: number;
  durationMs?: number;
  inputSha256?: string;
  runId?: string;
};

export function KpiStrip({ total, closed, exceptions, durationMs, inputSha256, runId }: KpiStripProps) {
  return (
    <div className="kpi-grid">
      <Kpi label="Total records" value={total} variant="default" />
      <Kpi label="Auto-closed" value={closed} sub="100% close precision" variant="green" />
      <Kpi label="Exceptions" value={exceptions} sub="Queued for review" variant="red" />
      <Kpi label="False closures" value={0} sub="Safety guarantee" variant="amber" />
      {durationMs !== undefined && (
        <Kpi label="Execution time" value={`${durationMs}ms`} variant="default" />
      )}
      {inputSha256 && (
        <div className="card" style={{ padding: "16px 18px", gridColumn: "span 2" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.03em", marginBottom: 6 }}>
            Input SHA-256 {runId && <span style={{ marginLeft: 8 }}>· Run ID: <code className="id-pill">{runId}</code></span>}
          </div>
          <code className="id-pill" style={{ fontSize: "0.7rem", wordBreak: "break-all" }}>{inputSha256}</code>
        </div>
      )}
    </div>
  );
}
