import { NextResponse } from "next/server";
import { reconcile } from "@/core/reconcile";
import { loadFixtureInputs, saveRun } from "@/core/audit";
import { fetchSettlementRecon, fetchOrdersCount } from "@/adapters/razorpay";
import { mapRazorpayReconToSettlementRow } from "@/core/canonicalise";
import type { SettlementRow } from "@/core/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = performance.now();

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source");

    if (source === "razorpay") {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return NextResponse.json(
          {
            error: "Missing Razorpay test credentials",
            message: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local to run on live test-mode API data.",
          },
          { status: 400 }
        );
      }

      try {
        const now = new Date();
        const reconData = await fetchSettlementRecon(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          now.getUTCDate()
        );

        const items = (reconData.items ?? reconData.entity?.items ?? []) as Record<string, unknown>[];
        const settlementRows: SettlementRow[] = items.map((item, idx) =>
          mapRazorpayReconToSettlementRow(item, `rzp-live-${idx + 1}`)
        );

        // Explicitly handle empty test-mode settlement data without running reconcile
        if (settlementRows.length === 0) {
          const testOrdersCount = await fetchOrdersCount();
          return NextResponse.json({
            status: "no_data",
            source: "razorpay_test_mode",
            count: 0,
            testOrdersCount,
            message:
              "Razorpay test-mode adapter is authenticated and connected, but no settled test-mode transactions were found for the queried period. Evaluation metrics run on the synthetic 120-record cohort, which has a known ground-truth answer key; this connection demonstrates the same engine running on live-pulled data structure.",
            durationMs: Math.round(performance.now() - started),
            queriedAt: now.toISOString(),
          });
        }

        const { ledgerRows, bankCredits } = await loadFixtureInputs();
        const run = reconcile(settlementRows, ledgerRows, bankCredits);
        try {
          await saveRun(run);
        } catch (saveErr) {
          console.warn("Failed to persist live test run:", saveErr);
        }

        return NextResponse.json({
          status: "success",
          runId: run.runId,
          source: "razorpay_test_mode",
          durationMs: Math.round(performance.now() - started),
          total: settlementRows.length,
          closed: run.results.filter(r => r.decision === "CLOSED").length,
          exceptions: run.results.filter(r => r.decision === "EXCEPTION").length,
          inputSha256: run.inputSha256,
        });
      } catch (err) {
        return NextResponse.json(
          { error: "Razorpay recon fetch failed", details: String(err) },
          { status: 502 }
        );
      }
    }

    // Default: Evaluated benchmark synthetic cohort
    const { settlementRows, ledgerRows, bankCredits } = await loadFixtureInputs();
    const run = reconcile(settlementRows, ledgerRows, bankCredits);
    try {
      await saveRun(run);
    } catch (saveErr) {
      console.warn("Failed to persist benchmark run:", saveErr);
    }

    return NextResponse.json({
      runId: run.runId,
      source: "synthetic_benchmark",
      durationMs: Math.round(performance.now() - started),
      total: settlementRows.length,
      closed: run.results.filter(r => r.decision === "CLOSED").length,
      exceptions: run.results.filter(r => r.decision === "EXCEPTION").length,
      inputSha256: run.inputSha256,
    });
  } catch (err) {
    console.error("Reconciliation endpoint error:", err);
    return NextResponse.json(
      {
        error: "Reconciliation failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
