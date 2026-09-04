import Link from "next/link";
import { MetricsCard, type Metrics } from "@/components/MetricsCard";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadMetrics(): Metrics | null {
  const path = join(process.cwd(), "docs/metrics.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Metrics;
}

const EXCEPTION_TAXONOMY = [
  {
    code: "MISSING_LEDGER_RECORD",
    description: "No merchant ledger entry references the Razorpay entity ID present in the settlement record.",
    safeResolution: "Locate and post the missing order/refund in merchant ERP before retrying reconciliation.",
  },
  {
    code: "AMOUNT_DELTA",
    description: "Ledger entry matched by entity ID, but at least one paise field (gross, fee, tax, net) differs.",
    safeResolution: "Review fee/tax posting in ledger against Razorpay settlement component breakdown.",
  },
  {
    code: "DUPLICATE_LEDGER_CANDIDATE",
    description: "Multiple merchant ledger rows claim the same Razorpay entity ID. Ambiguous ledger state.",
    safeResolution: "Deduplicate ledger records. Only one ledger entry may bind to each external entity ID.",
  },
  {
    code: "MISSING_BANK_CREDIT",
    description: "No bank statement credit equals the net settlement control total for this payout batch.",
    safeResolution: "Check bank statement for late deposit, transfer delay, or posting to an alternate account.",
  },
  {
    code: "AMBIGUOUS_BANK_CREDIT",
    description: "Multiple bank statement credits share the exact same amount. Unsafe to auto-match on amount alone.",
    safeResolution: "Review UTR reference numbers on bank credits to match the specific Razorpay payout ID.",
  },
  {
    code: "UNVERIFIED_BANK_NARRATION",
    description: "Single bank credit matches amount, but narration does not verify Razorpay as the remitter.",
    safeResolution: "Verify credit source with bank or cross-check UTR against Razorpay transfer records.",
  },
  {
    code: "UNKNOWN_ADJUSTMENT",
    description: "Adjustment reason is not in the approved financial controller allowlist.",
    safeResolution: "Review adjustment cause with accounting lead before clearing.",
  },
];

export const metadata = {
  title: "Evaluation Metrics — ProofClose",
  description: "Evaluation metrics and exception taxonomy for the ProofClose settlement controller.",
};

export default function MetricsPage() {
  const metrics = loadMetrics();

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Nav */}
      <nav className="nav">
        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          ProofClose
        </div>
        <Link href="/" id="nav-home">Reconciliation</Link>
        <Link href="/metrics" id="nav-metrics" className="active" style={{ color: "var(--text-primary)" }}>Evaluation Metrics</Link>
        <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          Razorpay Settlement Controller · v1.0.0
        </div>
      </nav>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px" }}>
        <h1 style={{ fontSize: "1.65rem", fontWeight: 600, margin: "0 0 8px", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
          Evaluation Metrics &amp; Provenance
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 28px", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Metrics computed on the benchmark 120-record synthetic cohort. All values are evaluated live from run outputs against pre-committed truth labels. Re-running <code className="id-pill">npm run evaluate</code> validates metrics consistency.
        </p>

        {metrics ? (
          <div style={{ marginBottom: 36 }}>
            <MetricsCard metrics={metrics} />
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 36, borderStyle: "dashed", textAlign: "center", padding: 28 }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Metrics not yet generated. Run <code className="id-pill">npm run evaluate</code> to produce{" "}
              <code className="id-pill">docs/metrics.json</code>.
            </div>
          </div>
        )}

        {/* Exception taxonomy */}
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 14px", color: "var(--text-primary)" }}>Exception Taxonomy</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
          {EXCEPTION_TAXONOMY.map(ex => (
            <div key={ex.code} className="card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <code className="chip chip-exception" style={{ whiteSpace: "nowrap", marginTop: 2 }}>{ex.code}</code>
                <div>
                  <p style={{ margin: "0 0 6px", color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {ex.description}
                  </p>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                    <span style={{ color: "var(--closed-text)", fontWeight: 500 }}>Action:</span> {ex.safeResolution}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dataset limitations */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <h3 style={{ margin: "0 0 10px", color: "var(--text-primary)", fontSize: "0.92rem", fontWeight: 600 }}>Dataset &amp; Benchmark Scope</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", fontSize: "0.84rem", lineHeight: 1.7 }}>
            <li>The 120 benchmark records are synthetic and generated with seed 20260904 to ensure deterministic answer-key validation.</li>
            <li>The three conservative abstentions (UNVERIFIED_BANK_NARRATION) are financially closeable; the controller prioritizes proof certainty over throughput.</li>
            <li>In production deployments, precision depends on bank statement feed completeness, UTR availability, and ERP ledger posting hygiene.</li>
            <li>The Razorpay adapter operates in read-only test mode; it never performs fund transfers, chargebacks, or writes.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
