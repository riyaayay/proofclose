import { describe, expect, it } from "vitest";
import { loadFixtureInputs, loadTruth } from "@/core/audit";
import { reconcile } from "@/core/reconcile";
import { evaluate } from "@/core/evaluate";

describe("metrics mathematical consistency guard", () => {
  it("satisfies fundamental metric identities on actual run output", async () => {
    const input = await loadFixtureInputs();
    const run = reconcile(input.settlementRows, input.ledgerRows, input.bankCredits);
    const truth = await loadTruth();
    const m = evaluate(run.results, truth);

    // 1. Prediction conservation (all 122 rows)
    expect(m.predictedClosed + m.predictedExceptions).toBe(m.total);
    expect(m.expectedClosed + m.expectedExceptions).toBe(m.total);

    // 2. Novel-row partition is consistent
    expect(m.taxonomyTotal + m.novelPatternRows).toBe(m.total);
    expect(m.novelPatternSafeAbstentions + m.novelPatternFalseClosures).toBe(m.novelPatternRows);

    // 3. Closed precision consistency
    expect(m.closePrecision).not.toBeNull();
    expect(Math.round(m.closePrecision! * m.predictedClosed)).toBe(m.correctClosed);

    // 4. Close recall consistency
    expect(m.closeRecall).not.toBeNull();
    expect(Math.round(m.closeRecall! * m.expectedClosed)).toBe(m.correctClosed);

    // 5. Financial accuracy over taxonomy rows only
    expect(m.financialStateAccuracy).not.toBeNull();
    expect(m.correctClosed + m.correctHardExceptions).toBe(
      Math.round(m.financialStateAccuracy! * m.taxonomyTotal)
    );

    // 6. Zero false closures (all rows including novel)
    expect(m.falseClosures).toBe(0);
    expect(m.novelPatternFalseClosures).toBe(0);

    // 7. Exception breakdown over taxonomy rows
    const taxonomyPredictedExceptions = m.predictedExceptions - m.novelPatternSafeAbstentions;
    expect(taxonomyPredictedExceptions).toBe(m.correctHardExceptions + m.conservativeAbstentions);
  });
});