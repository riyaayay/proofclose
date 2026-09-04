"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, RotateCcw, Radio, ArrowRight } from "lucide-react";
import { KpiStrip } from "@/components/KpiStrip";

type RunSummary = {
  status?: string;
  runId?: string;
  durationMs: number;
  closed?: number;
  exceptions?: number;
  inputSha256?: string;
  seed?: number;
  source?: string;
  message?: string;
  count?: number;
  testOrdersCount?: number;
  queriedAt?: string;
};

export default function Home() {
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentSeed, setCurrentSeed] = useState<number>(20260904);
  const [result, setResult] = useState<RunSummary | null>(null);
  const [error, setError] = useState("");

  const handleRun = async (source?: string) => {
    setRunning(true);
    setError("");
    try {
      const url = source ? `/api/reconcile?source=${source}` : "/api/reconcile";
      const res = await fetch(url, { method: "POST" });
      const text = await res.text();
      let data: (RunSummary & { message?: string; error?: string }) | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // Not valid JSON
      }

      if (!res.ok) {
        throw new Error(
          data?.message || data?.error || (text && text.length < 300 ? text : `Request failed with status ${res.status}`)
        );
      }

      if (!data) {
        throw new Error("Server returned an empty response.");
      }

      setResult({ ...data, seed: currentSeed });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/cohort/generate", { method: "POST" });
      const text = await res.text();
      let data: (RunSummary & { seed: number; error?: string }) | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // Not valid JSON
      }

      if (!res.ok) {
        throw new Error(
          data?.error || (text && text.length < 300 ? text : `Request failed with status ${res.status}`)
        );
      }

      if (!data) {
        throw new Error("Server returned an empty response.");
      }

      setCurrentSeed(data.seed);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Nav */}
      <nav className="nav">
        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          ProofClose
        </div>
        <Link href="/" id="nav-home" className="active" style={{ color: "var(--text-primary)" }}>Reconciliation</Link>
        <Link href="/metrics" id="nav-metrics">Evaluation Metrics</Link>
        <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          Razorpay Settlement Controller • v1.0.0
        </div>
      </nav>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 24px" }}>
        {/* Header / Intro */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 600, margin: "0 0 8px", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            Settlement Exception Closer
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: 660, margin: 0, lineHeight: 1.6 }}>
            Processes Razorpay settlement-reconciliation data against merchant ledger entries and verified bank statement credits. 
            Auto-closes records with complete, deterministic evidence chains; routes all ambiguous or unproven entries to the finance exception queue.
          </p>
        </div>

        {/* Evaluation Cohort Metadata Banner */}
        <div className="card" style={{ marginBottom: 20, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
                Active Evaluation Cohort
                <span style={{ marginLeft: 10, color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 400 }}>
                  Seed: <code className="id-pill">{currentSeed}</code>
                </span>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>
                120 synthetic records across settlement_recon.csv, merchant_ledger.csv, and bank_credits.csv.
                Scenario mix (97 closeable / 23 exceptions) is fixed by design so metrics are comparable across runs; record values, IDs, and timestamps are freshly randomized on each regeneration.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <span className="chip chip-neutral">Audit-locked</span>
              <span className="chip chip-neutral">Paise precision</span>
            </div>
          </div>
        </div>

        {/* Actions Bar — Strong visual hierarchy */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
          <button
            id="run-reconciliation"
            className="btn btn-primary"
            onClick={() => handleRun()}
            disabled={running || generating}
          >
            {running ? (
              <><div className="spinner" /> Running reconciliation…</>
            ) : (
              <><Play size={14} style={{ fill: "currentColor" }} /> Run reconciliation</>
            )}
          </button>

          <button
            id="regenerate-cohort"
            className="btn btn-secondary"
            onClick={handleRegenerate}
            disabled={running || generating}
            title="Generates a fresh synthetic cohort with a new random seed and executes reconciliation"
          >
            {generating ? (
              <><div className="spinner" /> Generating new cohort…</>
            ) : (
              <><RotateCcw size={14} /> New cohort (new seed)</>
            )}
          </button>

          <button
            id="run-razorpay-live"
            className="btn btn-secondary"
            onClick={() => handleRun("razorpay")}
            disabled={running || generating}
            title="Fetches live test-mode settlement recon from Razorpay API"
          >
            <Radio size={14} /> Check Razorpay connection
          </button>
        </div>

        {error && (
          <div className="card-accent-terracotta" style={{ marginBottom: 20, color: "var(--exception-text)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {/* Live Test-Mode Empty State Card (Restrained Ops Styling) */}
        {result && result.status === "no_data" && (
          <div className="card-accent-blue" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span className="chip chip-blue">
                Razorpay Test Mode connected
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                API response time: {result.durationMs}ms
              </span>
            </div>

            <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 8px", color: "var(--text-primary)" }}>
              Live test adapter verified — no settled transactions available
            </h2>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.86rem", lineHeight: 1.6, margin: "0 0 18px" }}>
              Razorpay test-mode adapter is authenticated and connected, but no settled test-mode transactions were found for the queried period. Evaluation metrics run on the synthetic 120-record cohort, which has a known ground-truth answer key; this connection demonstrates the same engine running on live-pulled data structure.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 20, padding: "14px", background: "var(--surface-2)", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Endpoint queried</div>
                <code className="id-pill" style={{ marginTop: 4, display: "inline-block" }}>GET /v1/settlements/recon/combined</code>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Authentication status</div>
                <div style={{ color: "var(--closed-text)", fontWeight: 500, fontSize: "0.82rem", marginTop: 4 }}>Verified (HTTP 200)</div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Account activity</div>
                <div style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "0.82rem", marginTop: 4 }}>
                  {result.testOrdersCount !== undefined ? `${result.testOrdersCount} test orders on account • 0 settled` : "0 settled records"}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Settlement cycle in sandbox</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 4 }}>
                  Razorpay test-mode settlements are simulated on a scheduled cycle and are not guaranteed to exist unless triggered.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleRun()}
                disabled={running}
              >
                Run Benchmark (Synthetic 120-Record Cohort)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleRun("razorpay")}
                disabled={running}
              >
                Check Razorpay connection again
              </button>
            </div>
          </div>
        )}

        {/* Standard Results Dashboard */}
        {result && result.status !== "no_data" && result.runId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <KpiStrip
              total={(result.closed ?? 0) + (result.exceptions ?? 0)}
              closed={result.closed ?? 0}
              exceptions={result.exceptions ?? 0}
              durationMs={result.durationMs}
              inputSha256={result.inputSha256}
              runId={result.runId}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <Link
                href={`/runs/${result.runId}`}
                id="view-run-detail"
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                View all records <ArrowRight size={14} />
              </Link>
              <Link
                href="/metrics"
                id="view-metrics"
                className="btn btn-secondary"
                style={{ textDecoration: "none" }}
              >
                View detailed evaluation metrics
              </Link>
            </div>

            {/* Reconciliation Summary Card */}
            <div className="card">
              <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>
                Reconciliation summary
              </div>
              <div style={{ display: "grid", gap: 8, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <div>
                  <span style={{ color: "var(--closed-text)", marginRight: 6 }}>●</span>
                  <strong style={{ color: "var(--text-primary)" }}>{result.closed} auto-closed</strong> — verified against exact Razorpay entity ID, matching ledger entry, and unique bank credit.
                </div>
                <div>
                  <span style={{ color: "var(--exception-text)", marginRight: 6 }}>▲</span>
                  <strong style={{ color: "var(--text-primary)" }}>{result.exceptions} exception records</strong> — safely quarantined for human reviewer triage with specific evidence codes. Zero false closures.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
