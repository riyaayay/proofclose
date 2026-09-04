import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateBenchmarkCohort } from "@/core/fixtures";
import { reconcile } from "@/core/reconcile";
import { evaluate } from "@/core/evaluate";
import { saveRun } from "@/core/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = performance.now();

  try {
    let seed = 20260904;

    try {
      const body = await request.json().catch(() => ({}));
      if (typeof body.seed === "number" && Number.isFinite(body.seed)) {
        seed = body.seed;
      } else {
        seed = Math.floor(Math.random() * 90000000) + 10000000;
      }
    } catch {
      seed = Math.floor(Math.random() * 90000000) + 10000000;
    }

    const {
      settlementRows,
      ledgerRows,
      bankCredits,
      truthRows,
      inputSha256,
      settlementCsv,
      ledgerCsv,
      bankCsv,
      truthCsv,
    } = generateBenchmarkCohort(seed);

    // Attempt to write CSV fixtures if filesystem is writable; gracefully ignore on read-only serverless environments
    try {
      mkdirSync("data/input", { recursive: true });
      mkdirSync("data/truth", { recursive: true });
      writeFileSync("data/input/settlement_recon.csv", settlementCsv);
      writeFileSync("data/input/merchant_ledger.csv", ledgerCsv);
      writeFileSync("data/input/bank_credits.csv", bankCsv);
      writeFileSync("data/truth/expected_outcomes.csv", truthCsv);
    } catch {
      // Read-only filesystem (e.g. Vercel Lambda)
    }

    const run = reconcile(settlementRows, ledgerRows, bankCredits);
    try {
      await saveRun(run);
    } catch (saveErr) {
      console.warn("Failed to persist cohort run:", saveErr);
    }

    // Evaluate metrics
    const metrics = evaluate(run.results, truthRows);
    const metricsPayload = {
      ...metrics,
      runId: run.runId,
      algorithmVersion: run.algorithmVersion,
      inputSha256,
      cohortSeed: seed,
      cohortRows: 120,
      generatedAt: new Date().toISOString(),
    };

    try {
      mkdirSync("docs", { recursive: true });
      writeFileSync("docs/metrics.json", JSON.stringify(metricsPayload, null, 2));
    } catch {
      // Read-only filesystem
    }

    return NextResponse.json({
      runId: run.runId,
      seed,
      inputSha256,
      durationMs: Math.round(performance.now() - started),
      total: 120,
      closed: run.results.filter(r => r.decision === "CLOSED").length,
      exceptions: run.results.filter(r => r.decision === "EXCEPTION").length,
    });
  } catch (err) {
    console.error("Cohort generation endpoint error:", err);
    return NextResponse.json(
      {
        error: "Cohort generation failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
