import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import os from "node:os";

let _db: Database.Database | null = null;

export const SCHEMA_SQL = `
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
`;

export function getDb(): Database.Database {
  if (_db) return _db;

  let dbPath = process.env.DATABASE_PATH;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (!dbPath) {
    if (isServerless) {
      dbPath = join(os.tmpdir(), "proofclose.db");
    } else {
      dbPath = "./data/proofclose.db";
    }
  }

  // Ensure target directory exists if possible
  try {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch {
    // If making directory fails (e.g. read-only filesystem), fallback to /tmp
    if (!dbPath.includes(os.tmpdir())) {
      dbPath = join(os.tmpdir(), "proofclose.db");
    }
  }

  try {
    _db = new Database(dbPath);
    try {
      _db.pragma("journal_mode = WAL");
    } catch {
      // WAL mode not supported on some virtual filesystems, fallback gracefully
    }
  } catch (err) {
    console.warn("Falling back to in-memory SQLite database:", err);
    _db = new Database(":memory:");
  }

  try {
    _db.exec(SCHEMA_SQL);
  } catch (err) {
    console.warn("Schema initialization notice:", err);
  }

  try {
    _db.exec("ALTER TABLE reconciliation_decisions ADD COLUMN action_category TEXT");
  } catch {
    // Column already exists
  }

  return _db;
}
