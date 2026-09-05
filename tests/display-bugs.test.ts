import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Numeric row-ID sort ──────────────────────────────────────────────────────
// Mirrors the rowIdNum helper defined in src/components/ExceptionTable.tsx
const rowIdNum = (id: string): number => {
  const m = id.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : NaN;
};
const numericSort = (ids: string[]) =>
  ids.slice().sort((a, b) => rowIdNum(a) - rowIdNum(b));

describe("ExceptionTable — row-ID numeric sort", () => {
  it('sorts ["rp-2","rp-10","rp-1"] as ["rp-1","rp-2","rp-10"]', () => {
    expect(numericSort(["rp-2", "rp-10", "rp-1"])).toEqual([
      "rp-1",
      "rp-2",
      "rp-10",
    ]);
  });

  it("handles a lexicographically-misleading full sequence", () => {
    const input = ["rp-100", "rp-2", "rp-10", "rp-1", "rp-11", "rp-9"];
    const expected = ["rp-1", "rp-2", "rp-9", "rp-10", "rp-11", "rp-100"];
    expect(numericSort(input)).toEqual(expected);
  });

  it("does not mutate or reorder an already-sorted sequence", () => {
    const ids = ["rp-1", "rp-2", "rp-3", "rp-10", "rp-11"];
    expect(numericSort(ids)).toEqual(ids);
  });

  it("ExceptionTable.tsx uses rowIdNum sort expression (source guard)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/ExceptionTable.tsx"),
      "utf-8"
    );
    expect(src).toContain("rowIdNum");
    expect(src).toContain(".sort((a, b) => rowIdNum(a.settlementRowId) - rowIdNum(b.settlementRowId))");
    // Must NOT still use the unsorted raw visible list
    expect(src).not.toContain(
      'const visible = filter === "ALL" ? results : results.filter(r => r.decision === filter);'
    );
  });

  it('column header reads "Net (\u20B9)" not "Net (paise)"', () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/ExceptionTable.tsx"),
      "utf-8"
    );
    expect(src).not.toContain("Net (paise)");
  });
});

// ── Metrics footer / header cohort-total consistency ─────────────────────────
describe("Metrics page — footer/header cohort-total consistency", () => {
  it("taxonomyTotal + novelPatternRows equals docs/metrics.json total", () => {
    const metricsPath = join(process.cwd(), "docs/metrics.json");
    expect(existsSync(metricsPath), "docs/metrics.json must be committed").toBe(
      true
    );
    const m = JSON.parse(readFileSync(metricsPath, "utf-8"));
    const taxonomyTotal: number = m.taxonomyTotal ?? m.total;
    const novelRows: number = m.novelPatternRows ?? 0;
    // The footer now renders (taxonomyTotal + novelRows): assert this equals the
    // grand total that the page header also reports.
    expect(taxonomyTotal + novelRows).toBe(m.total);
  });

  it("MetricsCard.tsx footer uses dynamic (taxonomyTotal + novelRows), not old cohortRows literal", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/MetricsCard.tsx"),
      "utf-8"
    );
    // Must use the derived sum expression
    expect(src).toContain("taxonomyTotal + novelRows");
    // Must NOT use the old hardcoded-fallback cohortRows expression for the leading count
    expect(src).not.toContain("{metrics.cohortRows ?? 122} rows");
  });
});
