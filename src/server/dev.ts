import { createServer as createHttpServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { todayLocalISO } from '../shared/dates.js';
import { createApp } from './app.js';
import { openDatabase, resolveDefaultDbPath } from './db/connection.js';
import { seedSampleData } from './db/sampleData.js';
import { getMeta, setMeta } from './db/schema.js';

async function main() {
  const dbPath = resolveDefaultDbPath();
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT || 3333);

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

  const app = createApp(db, { dbPath });
  const apiListener = getRequestListener(app.fetch);
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  const server = createHttpServer((req, res) => {
    if (req.url && req.url.startsWith('/api/')) {
      void apiListener(req, res);
      return;
    }
    vite.middlewares(req, res);
  });

  server.listen(port, host, () => {
    console.log(`Warm CRM dev server running at http://${host}:${port}`);
    console.log(`SQLite database: ${dbPath}`);
  });

  const shutdown = async () => {
    await vite.close();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('Failed to start Warm CRM dev server:', err);
  process.exit(1);
});
