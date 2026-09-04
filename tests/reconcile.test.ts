import { describe, expect, it } from "vitest";
import { reconcile } from "@/core/reconcile";

describe("reconcile engine — happy path", () => {
  const makeSettlement = (overrides = {}) => ({
    settlementId: "s1",
    entityType: "payment" as const,
    entityId: "pay_1",
    createdAt: "2026-09-01T00:00:00Z",
    settledAt: "2026-09-02T00:00:00Z",
    grossPaise: 10000,
    feePaise: 200,
    taxPaise: 36,
    netPaise: 9764,
    rawSourceId: "rp-1",
    ...overrides,
  });

  const makeLedger = (overrides = {}) => ({
    ledgerId: "l1",
    entityType: "payment" as const,
    razorpayEntityId: "pay_1",
    grossPaise: 10000,
    feePaise: 200,
    taxPaise: 36,
    netPaise: 9764,
    status: "captured" as const,
    occurredAt: "2026-09-01T00:00:00Z",
    ...overrides,
  });

  const makeBank = (overrides = {}) => ({
    bankTxnId: "b1",
    bookedAt: "2026-09-02T00:00:00Z",
    creditPaise: 9764,
    narration: "RAZORPAY SETTLEMENT",
    ...overrides,
  });

  it("closes a fully evidenced payment", () => {
    const result = reconcile([makeSettlement()], [makeLedger()], [makeBank()]);
    expect(result.results[0].decision).toBe("CLOSED");
    expect(result.results[0].ledgerId).toBe("l1");
    expect(result.results[0].bankTxnId).toBe("b1");
    expect(result.results[0].evidence.length).toBeGreaterThan(0);
  });

  it("closes a payment where narration contains RZP", () => {
    const result = reconcile([makeSettlement()], [makeLedger()], [makeBank({ narration: "RZP SETL 2026" })]);
    expect(result.results[0].decision).toBe("CLOSED");
  });

  it("returns MISSING_LEDGER_RECORD when no ledger row matches", () => {
    const result = reconcile([makeSettlement()], [], [makeBank()]);
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("MISSING_LEDGER_RECORD");
  });

  it("returns DUPLICATE_LEDGER_CANDIDATE when two ledger rows match the entity ID", () => {
    const result = reconcile(
      [makeSettlement()],
      [makeLedger(), makeLedger({ ledgerId: "l2" })],
      [makeBank()],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("DUPLICATE_LEDGER_CANDIDATE");
  });

  it("produces a run ID and input hash", () => {
    const result = reconcile([makeSettlement()], [makeLedger()], [makeBank()]);
    expect(result.runId).toMatch(/^run_/);
    expect(result.inputSha256).toHaveLength(64);
    expect(result.algorithmVersion).toBe("1.0.0");
  });

  it("closes a known-good adjustment", () => {
    const result = reconcile(
      [makeSettlement({ entityType: "adjustment", entityId: "adjustment_1", feePaise: 0, taxPaise: 0, netPaise: 10000, rawSourceId: "rp-adj" })],
      [makeLedger({ entityType: "adjustment", razorpayEntityId: "adjustment_1", feePaise: 0, taxPaise: 0, netPaise: 10000, status: "adjusted", adjustmentReason: "gateway_fee_correction" })],
      [makeBank({ creditPaise: 10000 })],
    );
    expect(result.results[0].decision).toBe("CLOSED");
  });
});
