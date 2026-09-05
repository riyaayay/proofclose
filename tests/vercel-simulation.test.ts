import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { loadFixtureInputs, saveRun, getRun, loadTruth } from "@/core/audit";
import { reconcile } from "@/core/reconcile";
import { evaluate } from "@/core/evaluate";
import os from "node:os";

describe("vercel serverless simulation", () => {
  it("runs end-to-end with VERCEL=1", async () => {
    process.env.VERCEL = "1";

    const db = getDb();
    expect(db).toBeDefined();
    // Verify db is hosted in os.tmpdir() when VERCEL=1
    expect(db.name).toContain(os.tmpdir());

    const { settlementRows, ledgerRows, bankCredits } = await loadFixtureInputs();
    expect(settlementRows.length).toBe(122);
    expect(ledgerRows.length).toBeGreaterThan(0);
    expect(bankCredits.length).toBeGreaterThan(0);

    const run = reconcile(settlementRows, ledgerRows, bankCredits);
    expect(run.results.length).toBe(122);

    const closedCount = run.results.filter(r => r.decision === "CLOSED").length;
    const exceptionCount = run.results.filter(r => r.decision === "EXCEPTION").length;
    expect(closedCount).toBe(97);
    expect(exceptionCount).toBe(25);

    await saveRun(run);

    const retrieved = await getRun(run.runId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.runId).toBe(run.runId);
    expect(retrieved!.results.length).toBe(122);

    const truth = await loadTruth();
    expect(truth.length).toBe(122);

    const metrics = evaluate(run.results, truth);
    expect(metrics.predictedClosed).toBe(97);
    expect(metrics.novelPatternSafeAbstentions).toBe(2);
    expect(metrics.novelPatternFalseClosures).toBe(0);
    expect(metrics.autoCloseMatchRate).toBeCloseTo(0.8083, 3);
  });
});
