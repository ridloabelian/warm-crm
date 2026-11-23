import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';
import { openDatabase } from '../src/server/db/connection.js';
import { seedSampleData } from '../src/server/db/sampleData.js';
import { parseCsv } from '../src/server/domain/backup.js';

const tempDirs: string[] = [];

function createTestEnv(withSample = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warm-crm-test-'));
  tempDirs.push(dir);
  const dbPath = path.join(dir, 'test.db');
  const db = openDatabase(dbPath);
  if (withSample) {
    seedSampleData(db, '2026-11-24');
  }
  const app = createApp(db, { dbPath });
  return { dir, dbPath, db, app };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('API integration & full backup roundtrips', () => {
  it('seeds default intentional circles and updates circle cadence', async () => {
    const { db, app } = createTestEnv(false);
    try {
      const circlesRes = await app.request('/api/circles');
      expect(circlesRes.status).toBe(200);
      const { circles } = (await circlesRes.json()) as {
        circles: Array<{ id: string; name: string; cadenceDays: number }>;
      };
      expect(circles.map((c) => c.name)).toEqual([
        'Inner 5',
        'Close 15',
        'Extended 50',
        'Family'
      ]);

      const patchRes = await app.request('/api/circles/circle-inner-5', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadenceDays: 10 })
      });
      expect(patchRes.status).toBe(200);
      const updated = (await patchRes.json()) as {
        circle: { cadenceDays: number };
      };
      expect(updated.circle.cadenceDays).toBe(10);
    } finally {
      db.close();
    }
  });

  it('toggles sample data cleanly while preserving user-created contacts', async () => {
    const { db, app } = createTestEnv(true);
    try {
      const createRes = await app.request('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nadia Tan',
          circleId: 'circle-inner-5',
          city: 'Seattle',
          sharedInterests: ['hiking', 'tea'],
          referenceDate: '2026-11-24'
        })
      });
      expect(createRes.status).toBe(201);

      const offRes = await app.request('/api/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false, referenceDate: '2026-11-24' })
      });
      expect(offRes.status).toBe(200);
      const offJson = (await offRes.json()) as {
        bootstrap: {
          people: Array<{ name: string }>;
          stats: { sampleDataEnabled: boolean };
        };
      };
      expect(offJson.bootstrap.stats.sampleDataEnabled).toBe(false);
      expect(offJson.bootstrap.people.map((p) => p.name)).toEqual(['Nadia Tan']);
    } finally {
      db.close();
    }
  });

  it('logs a quick catch-up via API and refreshes weekly ritual priorities', async () => {
    const { db, app } = createTestEnv(true);
    try {
      const beforeRitualRes = await app.request(
        '/api/ritual?date=2026-11-24'
      );
      const beforeRitual = (await beforeRitualRes.json()) as {
        items: Array<{ id: string; name: string }>;
        totalOverdueCount: number;
      };
      expect(beforeRitual.items).toHaveLength(3);
      expect(beforeRitual.totalOverdueCount).toBe(4);
      const topIds = beforeRitual.items.map((i) => i.id);
      expect(topIds).toContain('sample-arif-pratama');

      const logRes = await app.request('/api/quick-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Had dinner with Arif — he's moving apartments next month",
          referenceDate: '2026-11-24'
        })
      });
      expect(logRes.status).toBe(201);
      const logged = (await logRes.json()) as {
        person: { id: string; cadence: { isOverdue: boolean } };
      };
      expect(logged.person.id).toBe('sample-arif-pratama');
      expect(logged.person.cadence.isOverdue).toBe(false);

      const afterRitualRes = await app.request('/api/ritual?date=2026-11-24');
      const afterRitual = (await afterRitualRes.json()) as {
        items: Array<{ id: string }>;
        totalOverdueCount: number;
      };
      expect(afterRitual.totalOverdueCount).toBe(3);
      expect(afterRitual.items.map((i) => i.id)).not.toContain(
        'sample-arif-pratama'
      );
      expect(afterRitual.items.map((i) => i.id)).toContain(
        'sample-samira-patel'
      );
    } finally {
      db.close();
    }
  });

  it('roundtrips JSON backup losslessly into a fresh database', async () => {
    const env1 = createTestEnv(true);
    const env2 = createTestEnv(false);
    try {
      const exportRes = await env1.app.request('/api/backup/json');
      expect(exportRes.status).toBe(200);
      const backupJson = await exportRes.json();

      const importRes = await env2.app.request('/api/backup/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: backupJson, mode: 'replace' })
      });
      expect(importRes.status).toBe(200);

      const boot1 = await (
        await env1.app.request('/api/bootstrap?date=2026-11-24')
      ).json();
      const boot2 = await (
        await env2.app.request('/api/bootstrap?date=2026-11-24')
      ).json();

      expect(boot2.circles.length).toBe(boot1.circles.length);
      expect(boot2.people.length).toBe(boot1.people.length);
      expect(boot2.recentInteractions.length).toBe(
        boot1.recentInteractions.length
      );
      expect(boot2.ritual.items.map((p: { id: string }) => p.id)).toEqual(
        boot1.ritual.items.map((p: { id: string }) => p.id)
      );
    } finally {
      env1.db.close();
      env2.db.close();
    }
  });

  it('roundtrips CSV backup with commas, quotes, and multiline notes losslessly', async () => {
    const env1 = createTestEnv(false);
    const env2 = createTestEnv(false);
    try {
      const personRes = await env1.app.request('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Elena "Leni" Cruz',
          circleId: 'circle-family',
          city: 'Chicago, IL',
          sharedInterests: ['gardening', 'baking'],
          pinnedContext: 'Loves spicy ramen,\nand rainy Sunday walks.'
        })
      });
      const { person } = (await personRes.json()) as {
        person: { id: string };
      };

      await env1.app.request('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.id,
          occurredAt: '2026-11-10',
          kind: 'call',
          location: 'Phone',
          summary: 'Talked about "holiday" plans, travel, and family recipes',
          followUp: 'Send recipe card'
        })
      });

      const csvRes = await env1.app.request('/api/backup/csv');
      expect(csvRes.status).toBe(200);
      const csvText = await csvRes.text();
      expect(parseCsv(csvText).length).toBe(2);

      const importRes = await env2.app.request('/api/backup/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        body: csvText
      });
      expect(importRes.status).toBe(200);

      const detailRes = await env2.app.request(`/api/people/${person.id}`);
      expect(detailRes.status).toBe(200);
      const detail = (await detailRes.json()) as {
        person: { name: string; city: string; pinnedContext: string };
        interactions: Array<{ summary: string; followUp: string }>;
      };

      expect(detail.person.name).toBe('Elena "Leni" Cruz');
      expect(detail.person.city).toBe('Chicago, IL');
      expect(detail.person.pinnedContext).toBe(
        'Loves spicy ramen,\nand rainy Sunday walks.'
      );
      expect(detail.interactions[0].summary).toBe(
        'Talked about "holiday" plans, travel, and family recipes'
      );
      expect(detail.interactions[0].followUp).toBe('Send recipe card');
    } finally {
      env1.db.close();
      env2.db.close();
    }
  });

  it('exports a valid standalone SQLite database and restores it into a clean instance', async () => {
    const env1 = createTestEnv(true);
    const env2 = createTestEnv(false);
    try {
      const exportRes = await env1.app.request('/api/backup/sqlite');
      expect(exportRes.status).toBe(200);
      const bytes = new Uint8Array(await exportRes.arrayBuffer());

      expect(
        Buffer.from(bytes.subarray(0, 16)).toString('utf8')
      ).toBe('SQLite format 3\0');

      const inspectPath = path.join(env1.dir, 'exported-inspect.sqlite');
      fs.writeFileSync(inspectPath, bytes);
      const standalone = new Database(inspectPath, { readonly: true });
      const countRow = standalone
        .prepare('SELECT COUNT(*) AS count FROM people')
        .get() as { count: number };
      standalone.close();
      expect(countRow.count).toBe(9);

      const importRes = await env2.app.request('/api/backup/sqlite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes
      });
      expect(importRes.status).toBe(200);

      const boot2 = (await (
        await env2.app.request('/api/bootstrap?date=2026-11-24')
      ).json()) as { people: unknown[]; recentInteractions: unknown[] };
      expect(boot2.people.length).toBe(9);
      expect(boot2.recentInteractions.length).toBe(10);
    } finally {
      env1.db.close();
      env2.db.close();
    }
  });
});
