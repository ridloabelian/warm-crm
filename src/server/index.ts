import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { todayLocalISO } from '../shared/dates.js';
import { createApp } from './app.js';
import { openDatabase, resolveDefaultDbPath } from './db/connection.js';
import { seedSampleData } from './db/sampleData.js';
import { getMeta, setMeta } from './db/schema.js';

export interface StartServerOptions {
  dbPath?: string;
  host?: string;
  port?: number;
  clientDistDir?: string;
}

function resolveClientDistDir(explicit?: string): string {
  if (explicit) return explicit;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const siblingClient = path.resolve(currentDir, '../client');
  if (fs.existsSync(path.join(siblingClient, 'index.html'))) {
    return siblingClient;
  }
  return path.resolve(process.cwd(), 'dist', 'client');
}

export function startServer(options: StartServerOptions = {}) {
  const dbPath = options.dbPath ?? resolveDefaultDbPath();
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const port = options.port ?? Number(process.env.PORT || 3333);
  const clientDistDir = resolveClientDistDir(options.clientDistDir);

  const db = openDatabase(dbPath);

  const initialized = getMeta(db, 'initialized');
  const peopleCount = (
    db.prepare('SELECT COUNT(*) AS count FROM people').get() as { count: number }
  ).count;

  if (initialized !== 'true' && peopleCount === 0) {
    if (process.env.WARM_CRM_NO_INITIAL_SAMPLE === '1') {
      setMeta(db, 'sample_data_enabled', 'false');
      setMeta(db, 'initialized', 'true');
    } else {
      seedSampleData(db, todayLocalISO());
    }
  }

  const app = createApp(db, { dbPath, clientDistDir });
  const server = serve(
    {
      fetch: app.fetch,
      hostname: host,
      port
    },
    (info) => {
      console.log(`Warm CRM running locally at http://${host}:${info.port}`);
      console.log(`SQLite database: ${dbPath}`);
      console.log('100% offline-first — zero cloud sync, zero telemetry.');
    }
  );

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { server, db, app };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  startServer();
}
