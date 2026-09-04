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

    // 1. Prediction conservation
    expect(m.predictedClosed + m.predictedExceptions).toBe(m.total);
    expect(m.expectedClosed + m.expectedExceptions).toBe(m.total);

    // 2. Closed precision consistency: closePrecision * predictedClosed === correctClosed
    expect(m.closePrecision).not.toBeNull();
    expect(Math.round(m.closePrecision! * m.predictedClosed)).toBe(m.correctClosed);

    // 3. Close recall consistency: closeRecall * expectedClosed === correctClosed
    expect(m.closeRecall).not.toBeNull();
    expect(Math.round(m.closeRecall! * m.expectedClosed)).toBe(m.correctClosed);

    // 4. Financial accuracy consistency:
    // (correctClosed + correctHardExceptions) === financialStateAccuracy * total
    expect(m.financialStateAccuracy).not.toBeNull();
    expect(m.correctClosed + m.correctHardExceptions).toBe(
      Math.round(m.financialStateAccuracy! * m.total)
    );

    // 5. Zero false closures safety invariant
    expect(m.falseClosures).toBe(0);

    // 6. Conservative abstention breakdown:
    // predictedExceptions = correctHardExceptions + conservativeAbstentions + (any missed exceptions)
    expect(m.predictedExceptions).toBe(m.correctHardExceptions + m.conservativeAbstentions);
  });
});
