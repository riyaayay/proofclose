import type { RowResult } from "./types";

/**
 * Truth label from the fixture generator.
 *
 * financialTruth:
 *   "CLOSEABLE"       — data-generating world says this could be closed
 *   "HARD_EXCEPTION"  — data-generating world says this is genuinely unresolvable
 *
 * expectedControllerDecision:
 *   "CLOSED"          — controller should output CLOSED
 *   "EXCEPTION"       — controller should output EXCEPTION
 *
 * These are SEPARATE axes. The three UNVERIFIED_BANK_NARRATION rows are
 * financialTruth=CLOSEABLE but expectedControllerDecision=EXCEPTION, because
 * the controller deliberately abstains when it cannot prove the payer from narration.
 * This is a conservative safety choice, not a false negative.
 *
 * scenario="NOVEL_UNHANDLED":
 *   Rows whose discrepancy pattern falls entirely outside the seven-category
 *   taxonomy. The correct engine behaviour is to produce EXCEPTION via the
 *   closest existing safe path — NOT to force-close. This is reported as
 *   novelPatternSafeAbstention separately from hardExceptionRecall so that
 *   out-of-taxonomy generalisation is visible as its own metric.
 */
export type Truth = {
  settlementRowId: string;
  financialTruth: "CLOSEABLE" | "HARD_EXCEPTION";
  expectedControllerDecision: "CLOSED" | "EXCEPTION";
  scenario?: string;
};

const divide = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

export function evaluate(results: RowResult[], truth: Truth[]) {
  const truthMap = new Map(truth.map(t => [t.settlementRowId, t]));

  let correctClosed = 0;          // engine=CLOSED ∧ expected=CLOSED
  let predictedClosed = 0;        // engine=CLOSED (regardless of truth)
  let predictedExceptions = 0;    // engine=EXCEPTION (regardless of truth)

  let expectedClosed = 0;         // expectedControllerDecision=CLOSED
  let expectedExceptions = 0;     // expectedControllerDecision=EXCEPTION

  let financialCloseable = 0;     // financialTruth=CLOSEABLE
  let hardExceptions = 0;         // financialTruth=HARD_EXCEPTION (taxonomy rows only)

  let correctHardExceptions = 0;  // engine=EXCEPTION ∧ financialTruth=HARD_EXCEPTION (taxonomy rows)
  let conservativeAbstentions = 0; // engine=EXCEPTION ∧ financialTruth=CLOSEABLE (deliberate safety choice)
  let falseClosures = 0;          // engine=CLOSED ∧ expectedControllerDecision=EXCEPTION

  // Novel-pattern tracking (separate from taxonomy-based metrics)
  let novelPatternRows = 0;              // rows with scenario=NOVEL_UNHANDLED
  let novelPatternSafeAbstentions = 0;  // novel rows where engine correctly produced EXCEPTION
  let novelPatternFalseClosures = 0;    // novel rows where engine incorrectly produced CLOSED (critical)

  for (const result of results) {
    const expected = truthMap.get(result.settlementRowId);
    if (!expected) throw new Error(`No truth label for ${result.settlementRowId}`);

    const isNovel = expected.scenario === "NOVEL_UNHANDLED";

    // Predicted counts
    if (result.decision === "CLOSED") predictedClosed++;
    else predictedExceptions++;

    // Expected counts (controller perspective)
    if (expected.expectedControllerDecision === "CLOSED") expectedClosed++;
    else expectedExceptions++;

    // Financial truth counts — exclude novel rows from taxonomy metrics
    if (!isNovel) {
      if (expected.financialTruth === "CLOSEABLE") financialCloseable++;
      else hardExceptions++;
    }

    // Correct CLOSED: engine agrees with expected decision (only taxonomy rows)
    if (!isNovel && result.decision === "CLOSED" && expected.expectedControllerDecision === "CLOSED") correctClosed++;

    // False closure: engine closed what it should not have (worst outcome, all rows)
    if (result.decision === "CLOSED" && expected.expectedControllerDecision === "EXCEPTION") falseClosures++;

    // Correct hard exception: engine correctly flagged a genuinely unresolvable taxonomy row
    if (!isNovel && result.decision === "EXCEPTION" && expected.financialTruth === "HARD_EXCEPTION") correctHardExceptions++;

    // Conservative abstention: engine flagged something that was financially closeable
    // but lacked sufficient proof (e.g. unverifiable narration). Deliberate, taxonomy rows only.
    if (!isNovel && result.decision === "EXCEPTION" && expected.financialTruth === "CLOSEABLE") conservativeAbstentions++;

    // Novel-pattern tracking
    if (isNovel) {
      novelPatternRows++;
      if (result.decision === "EXCEPTION") novelPatternSafeAbstentions++;
      else novelPatternFalseClosures++;
    }
  }

  const total = results.length;
  const taxonomyTotal = total - novelPatternRows;

  return {
    total,
    taxonomyTotal,
    novelPatternRows,
    // Raw counts (all derived from this single run — nothing hardcoded)
    predictedClosed,
    predictedExceptions,
    expectedClosed,
    expectedExceptions,
    correctClosed,
    correctHardExceptions,
    conservativeAbstentions,
    falseClosures,
    financialCloseable,
    hardExceptions,

    // Novel-pattern metrics (separate axis from taxonomy recall)
    /** How many novel-pattern rows the engine correctly refused to force-close */
    novelPatternSafeAbstentions,
    /** How many novel-pattern rows the engine incorrectly closed — must be 0 */
    novelPatternFalseClosures,

    // Rate metrics — denominators are always the real counts from this run
    /** correct_closed / total — overall throughput rate (taxonomy rows only) */
    autoCloseMatchRate: divide(correctClosed, taxonomyTotal),
    /** correct_closed / predicted_closed — precision of CLOSED decisions */
    closePrecision: divide(correctClosed, predictedClosed),
    /**
     * correct_closed / expected_closed — how many rows the engine SHOULD close
     * did it actually close? This will be 100% when 0 false closures and
     * correctClosed === expectedClosed (i.e. no missed closures).
     */
    closeRecall: divide(correctClosed, expectedClosed),
    /**
     * correct_closed / financial_closeable — recall against all rows that
     * COULD be closed in the data-generating world. Lower than closeRecall
     * when there are conservative abstentions (rows the engine safely refuses
     * to close because proof is insufficient, even though the data says it
     * would be financially valid).
     */
    closeabilityRecall: divide(correctClosed, financialCloseable),
    /** correct_hard_exceptions / predicted_exceptions (taxonomy rows) — precision of EXCEPTION decisions */
    exceptionPrecision: divide(correctHardExceptions, predictedExceptions - novelPatternSafeAbstentions),
    /** correct_hard_exceptions / hard_exceptions — recall over genuinely bad taxonomy rows */
    hardExceptionRecall: divide(correctHardExceptions, hardExceptions),
    /** (correct_closed + correct_hard_exceptions) / taxonomy_total */
    financialStateAccuracy: divide(correctClosed + correctHardExceptions, taxonomyTotal),
  };
}

export type EvaluateResult = ReturnType<typeof evaluate>;
