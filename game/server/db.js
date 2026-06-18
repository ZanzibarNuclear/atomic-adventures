import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = join(here, "..", "content", "atomic-adventures.sqlite");
const migrationsDir = join(here, "migrations");

export function openDatabase(path = DEFAULT_DB_PATH) {
  const db = new DatabaseSync(path, { timeout: 2000 });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrateDatabase(db);
  return db;
}

export function migrateDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id),
  );
  for (const filename of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(join(migrationsDir, filename), "utf8");
    transaction(db, () => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations(id, applied_at) VALUES (?, ?)")
        .run(filename, new Date().toISOString());
    });
  }
}

export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
