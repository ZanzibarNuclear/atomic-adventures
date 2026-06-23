import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = join(here, "..", "..", "..", "content", "atomic-adventures.sqlite");

function readDocument(table, id, column = "document_json") {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db.prepare(`SELECT ${column} FROM ${table} WHERE id = ?`).get(id);
    if (!row) throw new Error(`Missing content document ${table}.${id}`);
    return JSON.parse(row[column]);
  } finally {
    db.close();
  }
}

export const mapData = readDocument("world_documents", "outdoor-main");
export const utilityData = readDocument("world_documents", "utility-station");
export const characterDefinitions = readDocument("character_documents", "character-main");
