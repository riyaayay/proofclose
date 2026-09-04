export type EntityType = "payment" | "refund" | "transfer" | "adjustment";

export type SettlementRow = {
  settlementId: string;
  entityType: EntityType;
  entityId: string;
  createdAt: string;
  settledAt: string;
  grossPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  referenceId?: string;
  rawSourceId: string;
};

export type LedgerRow = {
  ledgerId: string;
  entityType: EntityType;
  razorpayEntityId?: string;
  merchantReference?: string;
  grossPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  status: "captured" | "refunded" | "transferred" | "adjusted" | "void";
  occurredAt: string;
  adjustmentReason?: string;
};

export type BankCredit = {
  bankTxnId: string;
  bookedAt: string;
  creditPaise: number;
  narration: string;
  utr?: string;
};

export type Decision = "CLOSED" | "EXCEPTION";
export type ExceptionCode =
  | "MISSING_LEDGER_RECORD"
  | "AMOUNT_DELTA"
  | "DUPLICATE_LEDGER_CANDIDATE"
  | "MISSING_BANK_CREDIT"
  | "AMBIGUOUS_BANK_CREDIT"
  | "UNVERIFIED_BANK_NARRATION"
  | "UNKNOWN_ADJUSTMENT"
  | "SETTLEMENT_CONTROL_TOTAL_MISMATCH"
  | "UNSUPPORTED_ENTITY_TYPE";

export type Evidence = {
  rule: string;
  sourceIds: string[];
  facts: Record<string, string | number | boolean>;
};

export type RowResult = {
  settlementRowId: string;
  decision: Decision;
  exceptionCode?: ExceptionCode;
  ledgerId?: string;
  bankTxnId?: string;
  evidence: Evidence[];
  reviewStatus?: "UNREVIEWED" | "REVIEWED" | "ESCALATED";
  reviewerId?: string;
  reviewReason?: string;
  actionCategory?: string;
  reviewedAt?: string;
};

export type ReconciliationRun = {
  runId: string;
  algorithmVersion: string;
  inputSha256: string;
  startedAt: string;
  finishedAt: string;
  results: RowResult[];
};
