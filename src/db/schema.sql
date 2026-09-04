CREATE TABLE IF NOT EXISTS reconciliation_runs (
  run_id TEXT PRIMARY KEY,
  algorithm_version TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_decisions (
  run_id TEXT NOT NULL REFERENCES reconciliation_runs(run_id),
  settlement_row_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('CLOSED','EXCEPTION')),
  exception_code TEXT,
  ledger_id TEXT,
  bank_txn_id TEXT,
  evidence_json TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
    CHECK (review_status IN ('UNREVIEWED','REVIEWED','ESCALATED')),
  reviewer_id TEXT,
  review_reason TEXT,
  action_category TEXT,
  reviewed_at TEXT,
  PRIMARY KEY (run_id, settlement_row_id)
);

CREATE TABLE IF NOT EXISTS reviewer_action_audit (
  action_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  settlement_row_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  action_category TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
