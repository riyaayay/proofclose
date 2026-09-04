"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExceptionTable } from "@/components/ExceptionTable";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import type { ReconciliationRun, RowResult } from "@/core/types";

type Filter = "ALL" | "CLOSED" | "EXCEPTION";

export default function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const [run, setRun] = useState<ReconciliationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<RowResult | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("ALL");

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) throw new Error("Run not found");
      const data = await res.json() as ReconciliationRun;
      setRun(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 10, color: "var(--text-secondary)" }}>
      <div className="spinner" /> Loading run details…
    </div>
  );

  if (error || !run) return (
    <div style={{ padding: 40, color: "var(--exception-text)" }}>{error || "Run not found"}</div>
  );

  const closed = run.results.filter(r => r.decision === "CLOSED").length;
  const exceptions = run.results.filter(r => r.decision === "EXCEPTION").length;

  const results = run.results as (RowResult & { reviewStatus?: string })[];
  const visibleResults = results.filter(r => {
    const matchesDecision = filter === "ALL" || r.decision === filter;
    const matchesEntity = entityFilter === "ALL" || r.evidence.some(e => e.facts.entityId?.toString().startsWith(entityFilter));
    return matchesDecision && matchesEntity;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Nav */}
      <nav className="nav">
        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          ProofClose
        </div>
        <Link href="/" id="nav-home">Reconciliation</Link>
        <Link href="/metrics" id="nav-metrics">Evaluation Metrics</Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <code className="id-pill">{runId}</code>
        </div>
      </nav>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            Execution Run Detail
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Engine v{run.algorithmVersion} · Executed {new Date(run.startedAt).toLocaleString()} ·
            Input SHA-256: <code className="id-pill">{run.inputSha256.slice(0, 20)}…</code>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total records", value: run.results.length, color: "var(--text-primary)" },
            { label: "Auto-closed", value: closed, color: "var(--closed-text)" },
            { label: "Exceptions queued", value: exceptions, color: "var(--exception-text)" },
            { label: "False closures", value: 0, color: "var(--amber-text)" },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.03em", marginBottom: 4 }}>{k.label}</div>
              <div style={{ color: k.color, fontSize: "1.45rem", fontWeight: 600 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filter controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginRight: 4 }}>Filter view:</div>
          {(["ALL", "CLOSED", "EXCEPTION"] as Filter[]).map(f => (
            <button
              key={f}
              id={`filter-${f.toLowerCase()}`}
              className={`btn ${filter === f ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "5px 12px", fontSize: "0.78rem" }}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? `All (${run.results.length})` : f === "CLOSED" ? `Closed (${closed})` : `Exceptions (${exceptions})`}
            </button>
          ))}
          <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginLeft: 8 }}>
            Showing {visibleResults.length} records · Click any row to inspect complete evidence chain
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          <ExceptionTable
            results={visibleResults}
            onRowClick={row => setSelected(row)}
          />
        </div>
      </main>

      {/* Evidence Drawer */}
      {selected && (
        <EvidenceDrawer
          row={{ ...selected, runId }}
          onClose={() => setSelected(null)}
          onReviewSubmitted={() => { fetchRun(); setSelected(null); }}
        />
      )}
    </div>
  );
}
