import Link from "next/link";
import { MetricsCard, type Metrics } from "@/components/MetricsCard";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateBenchmarkCohort } from "@/core/fixtures";
import { reconcile } from "@/core/reconcile";
import { evaluate } from "@/core/evaluate";

function loadMetrics(): Metrics | null {
  const path = join(process.cwd(), "docs/metrics.json");
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as Metrics;
    } catch {
      // Fallback to dynamic computation
    }
  }

  // Dynamic fallback when docs/metrics.json is not bundled or missing (e.g. serverless cold start)
  try {
    const fixture = generateBenchmarkCohort(20260904);
    const run = reconcile(fixture.settlementRows, fixture.ledgerRows, fixture.bankCredits);
    const evaluated = evaluate(run.results, fixture.truthRows);
    return {
      ...evaluated,
      runId: run.runId,
      algorithmVersion: run.algorithmVersion,
      inputSha256: fixture.inputSha256,
      cohortSeed: 20260904,
      cohortRows: 122,
      generatedAt: new Date().toISOString(),
    } as Metrics;
  } catch {
    return null;
  }
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
          Razorpay Settlement Controller • v1.0.0
        </div>
      </nav>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 600, margin: "0 0 8px", color: "var(--text-primary)" }}>
            Evaluation Metrics
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: 680, margin: 0, lineHeight: 1.6 }}>
            Empirical evaluation against the synthetic {metrics?.total ?? 122}-record cohort
            ({metrics?.taxonomyTotal ?? 120} standard-taxonomy rows + {metrics?.novelPatternRows ?? 2} out-of-taxonomy novel-pattern rows).
            Metrics reflect strict financial safety constraints: auto-close operations require complete, deterministic evidence;
            ambiguous or disputed entries are routed to exceptions.
          </p>
        </div>

        {metrics ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <MetricsCard metrics={metrics} />

            {/* Exception Taxonomy */}
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>
                Exception Code Taxonomy & Safe Resolution Procedures
              </h2>
              <div style={{ display: "grid", gap: 12 }}>
                {EXCEPTION_TAXONOMY.map(item => (
                  <div key={item.code} className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                      <code className="id-pill" style={{ color: "var(--exception-text)", background: "rgba(224, 92, 66, 0.12)", border: "1px solid rgba(224, 92, 66, 0.28)" }}>
                        {item.code}
                      </code>
                    </div>
                    <div style={{ color: "var(--text-primary)", fontSize: "0.85rem", marginBottom: 6, fontWeight: 500 }}>
                      {item.description}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      <strong style={{ color: "var(--text-secondary)" }}>Safe resolution: </strong>
                      {item.safeResolution}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <p>No evaluation metrics found. Run a reconciliation on the home page first.</p>
            <Link href="/" className="btn btn-primary" style={{ display: "inline-flex", marginTop: 12 }}>
              Go to reconciliation
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
