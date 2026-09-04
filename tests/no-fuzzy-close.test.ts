import { describe, expect, it } from "vitest";
import { reconcile } from "@/core/reconcile";

describe("financial safety", () => {
  it("never closes a one-paise mismatch", () => {
    const result = reconcile(
      [{ settlementId: "s1", entityType: "payment", entityId: "pay_1", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, rawSourceId: "rp-1" }],
      [{ ledgerId: "l1", entityType: "payment", razorpayEntityId: "pay_1", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9763, status: "captured", occurredAt: "2026-09-01T00:00:00Z" }],
      [{ bankTxnId: "b1", bookedAt: "2026-09-02T00:00:00Z", creditPaise: 9764, narration: "RAZORPAY SETTLEMENT" }],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("AMOUNT_DELTA");
  });

  it("never closes when narration is unrecognisable", () => {
    const result = reconcile(
      [{ settlementId: "s1", entityType: "payment", entityId: "pay_1", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, rawSourceId: "rp-1" }],
      [{ ledgerId: "l1", entityType: "payment", razorpayEntityId: "pay_1", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, status: "captured", occurredAt: "2026-09-01T00:00:00Z" }],
      [{ bankTxnId: "b1", bookedAt: "2026-09-02T00:00:00Z", creditPaise: 9764, narration: "CREDIT INWARD - BATCH REFERENCE LOST" }],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("UNVERIFIED_BANK_NARRATION");
  });

  it("never closes when there is no bank credit", () => {
    const result = reconcile(
      [{ settlementId: "s1", entityType: "payment", entityId: "pay_1", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, rawSourceId: "rp-1" }],
      [{ ledgerId: "l1", entityType: "payment", razorpayEntityId: "pay_1", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, status: "captured", occurredAt: "2026-09-01T00:00:00Z" }],
      [],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("MISSING_BANK_CREDIT");
  });

  it("never closes when bank credit is ambiguous", () => {
    const result = reconcile(
      [{ settlementId: "s1", entityType: "payment", entityId: "pay_1", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, rawSourceId: "rp-1" }],
      [{ ledgerId: "l1", entityType: "payment", razorpayEntityId: "pay_1", grossPaise: 10000, feePaise: 200, taxPaise: 36, netPaise: 9764, status: "captured", occurredAt: "2026-09-01T00:00:00Z" }],
      [
        { bankTxnId: "b1", bookedAt: "2026-09-02T00:00:00Z", creditPaise: 9764, narration: "RAZORPAY SETTLEMENT" },
        { bankTxnId: "b2", bookedAt: "2026-09-02T01:00:00Z", creditPaise: 9764, narration: "RAZORPAY SETTLEMENT" },
      ],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("AMBIGUOUS_BANK_CREDIT");
  });

  it("never closes an unknown adjustment", () => {
    const result = reconcile(
      [{ settlementId: "s1", entityType: "adjustment", entityId: "adjustment_1", createdAt: "2026-09-01T00:00:00Z", settledAt: "2026-09-02T00:00:00Z", grossPaise: 5000, feePaise: 0, taxPaise: 0, netPaise: 5000, rawSourceId: "rp-1" }],
      [{ ledgerId: "l1", entityType: "adjustment", razorpayEntityId: "adjustment_1", grossPaise: 5000, feePaise: 0, taxPaise: 0, netPaise: 5000, status: "adjusted", occurredAt: "2026-09-01T00:00:00Z", adjustmentReason: "manual_adjustment_without_evidence" }],
      [{ bankTxnId: "b1", bookedAt: "2026-09-02T00:00:00Z", creditPaise: 5000, narration: "RAZORPAY SETTLEMENT" }],
    );
    expect(result.results[0].decision).toBe("EXCEPTION");
    expect(result.results[0].exceptionCode).toBe("UNKNOWN_ADJUSTMENT");
  });
});
