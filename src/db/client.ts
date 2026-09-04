import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.DATABASE_PATH ?? "./data/proofclose.db";
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(process.cwd(), "src/db/schema.sql"), "utf-8");
  _db.exec(schema);
  try {
    _db.exec("ALTER TABLE reconciliation_decisions ADD COLUMN action_category TEXT");
  } catch {
    // Column already exists
  }
  return _db;
}
