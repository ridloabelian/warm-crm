import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { applySchema, ensureDefaultCircles } from './schema.js';

export function resolveDefaultDbPath(): string {
  return process.env.WARM_CRM_DB_PATH || path.resolve(process.cwd(), 'data', 'warm-crm.db');
}

export function openDatabase(dbPath: string = resolveDefaultDbPath()): Database.Database {
  const isMemory = dbPath === ':memory:';
  if (!isMemory) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  applySchema(db);
  ensureDefaultCircles(db);
  return db;
}
