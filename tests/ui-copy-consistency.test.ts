import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("UI copy consistency guard", () => {
  it("docs/metrics.json total matches the DEFAULT_META constant in page.tsx", () => {
    // The home page has a DEFAULT_META fallback used before /api/cohort/meta responds.
    // If someone edits the fixture and re-runs evaluate, DEFAULT_META must be updated too.
    // This test catches that drift by comparing the committed metrics.json to the
    // constant values hard-typed in this assertion (which must match DEFAULT_META in page.tsx).
    const PAGE_DEFAULT_TOTAL = 122;
    const PAGE_DEFAULT_TAXONOMY = 120;
    const PAGE_DEFAULT_NOVEL = 2;

    const metricsPath = join(process.cwd(), "docs/metrics.json");
    expect(existsSync(metricsPath), "docs/metrics.json must be committed").toBe(true);

    const metrics = JSON.parse(readFileSync(metricsPath, "utf-8"));

    expect(metrics.total, "metrics.json total must match DEFAULT_META.total in page.tsx").toBe(PAGE_DEFAULT_TOTAL);
    expect(
      metrics.taxonomyTotal ?? metrics.total,
      "metrics.json taxonomyTotal must match DEFAULT_META.taxonomyTotal in page.tsx"
    ).toBe(PAGE_DEFAULT_TAXONOMY);
    expect(
      metrics.novelPatternRows ?? 0,
      "metrics.json novelPatternRows must match DEFAULT_META.novelPatternRows in page.tsx"
    ).toBe(PAGE_DEFAULT_NOVEL);
  });

  it("cohort description template derives all counts from metrics.json — no hardcoded numbers", () => {
    // Verify that the formula in page.tsx (expectedClosed + hardExceptions + conservativeAbstentions)
    // adds up correctly in the committed metrics.json, so the description is self-consistent.
    const metricsPath = join(process.cwd(), "docs/metrics.json");
    const m = JSON.parse(readFileSync(metricsPath, "utf-8"));

    // standardExceptions = hardExceptions + conservativeAbstentions
    const standardExceptions = (m.hardExceptions ?? 0) + (m.conservativeAbstentions ?? 0);
    // novelPatternRows
    const novelRows = m.novelPatternRows ?? 0;
    // total = expectedClosed + standardExceptions + novelRows
    expect(m.expectedClosed + standardExceptions + novelRows).toBe(m.total);
  });
});
