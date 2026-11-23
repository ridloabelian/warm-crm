import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import {
  addCalendarDays,
  isValidISODate,
  todayLocalISO
} from '../shared/dates.js';
import { parseQuickLog } from '../shared/quickLogParser.js';
import type {
  CircleColorToken,
  InteractionKind
} from '../shared/types.js';
import { clearSampleData, seedSampleData } from './db/sampleData.js';
import {
  type CircleRow,
  type InteractionRow,
  type PersonRow,
  ensureDefaultCircles,
  mapCircleRow,
  mapInteractionRow,
  mapPersonRow,
  setMeta
} from './db/schema.js';
import {
  exportCsvBackup,
  exportJsonBackup,
  exportSqliteBackup,
  importCsvBackup,
  importJsonBackup,
  importSqliteBackup,
  type ImportMode
} from './domain/backup.js';
import {
  buildBootstrapResponse,
  buildEnrichedPeople,
  buildRecentInteractions,
  buildWeeklyRitual,
  listCircles,
  listPeopleRecords
} from './domain/enrich.js';

export interface CreateAppOptions {
  dbPath?: string;
  clientDistDir?: string;
}

const VALID_KINDS = new Set<InteractionKind>([
  'coffee',
  'meal',
  'walk',
  'call',
  'visit',
  'meetup',
  'note'
]);

const VALID_COLORS = new Set<CircleColorToken>([
  'terracotta',
  'amber',
  'sage',
  'plum'
]);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function resolveRefDate(raw?: string | null): string {
  if (raw && isValidISODate(raw)) {
    return raw.slice(0, 10);
  }
  return todayLocalISO();
}

function isLocalOrigin(origin: string): boolean {
  return (
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://localhost:') ||
    origin === 'http://127.0.0.1' ||
    origin === 'http://localhost' ||
    origin === 'tauri://localhost' ||
    origin === 'http://tauri.localhost' ||
    origin === 'https://tauri.localhost'
  );
}

function normalizeInterests(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createApp(
  db: Database.Database,
  options: CreateAppOptions = {}
): Hono {
  const app = new Hono();
  const dbPath = options.dbPath ?? ':memory:';

  // Local-only CORS for Vite dev and Tauri WebView
  app.use('/api/*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && isLocalOrigin(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }
    await next();
  });

  app.get('/api/health', (c) => {
    return c.json({
      ok: true,
      app: 'warm-crm',
      version: '0.1.0',
      offlineOnly: true
    });
  });

  app.get('/api/bootstrap', (c) => {
    const refDate = resolveRefDate(c.req.query('date'));
    return c.json(buildBootstrapResponse(db, dbPath, refDate));
  });

  app.get('/api/ritual', (c) => {
    const refDate = resolveRefDate(c.req.query('date'));
    const limitParam = Number(c.req.query('limit') ?? 3);
    const limit =
      Number.isFinite(limitParam) && limitParam >= 1
        ? Math.min(10, Math.round(limitParam))
        : 3;
    const people = buildEnrichedPeople(db, refDate, false);
    return c.json(buildWeeklyRitual(people, refDate, limit));
  });

  // Circles
  app.get('/api/circles', (c) => {
    return c.json({ circles: listCircles(db) });
  });

  app.post('/api/circles', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !String(body.name || '').trim()) {
      return c.json({ error: 'Circle name is required.' }, 400);
    }
    const name = String(body.name).trim();
    const id = `circle-${slugify(name) || crypto.randomUUID()}`;
    const baseSlug = slugify(name) || id;
    const cadenceDays = Math.max(1, Math.round(Number(body.cadenceDays) || 30));
    const targetSize = Math.max(1, Math.round(Number(body.targetSize) || 15));
    const colorToken: CircleColorToken = VALID_COLORS.has(body.colorToken)
      ? body.colorToken
      : 'amber';
    const maxSort = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM circles').get() as {
        m: number;
      }
    ).m;

    const existingSlug = db
      .prepare('SELECT id FROM circles WHERE slug = ?')
      .get(baseSlug);
    const slug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    db.prepare(`
      INSERT INTO circles (id, name, slug, cadence_days, target_size, description, color_token, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      slug,
      cadenceDays,
      targetSize,
      String(body.description || '').trim(),
      colorToken,
      maxSort + 1,
      todayLocalISO()
    );

    const row = db.prepare('SELECT * FROM circles WHERE id = ?').get(id) as CircleRow;
    return c.json({ circle: mapCircleRow(row) }, 201);
  });

  app.patch('/api/circles/:id', async (c) => {
    const id = c.req.param('id');
    const existing = db
      .prepare('SELECT * FROM circles WHERE id = ?')
      .get(id) as CircleRow | undefined;
    if (!existing) {
      return c.json({ error: 'Circle not found.' }, 404);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const name =
      body.name !== undefined ? String(body.name).trim() || existing.name : existing.name;
    const cadenceDays =
      body.cadenceDays !== undefined
        ? Math.max(1, Math.round(Number(body.cadenceDays) || existing.cadence_days))
        : existing.cadence_days;
    const targetSize =
      body.targetSize !== undefined
        ? Math.max(1, Math.round(Number(body.targetSize) || existing.target_size))
        : existing.target_size;
    const description =
      body.description !== undefined
        ? String(body.description).trim()
        : existing.description;
    const colorToken: CircleColorToken = VALID_COLORS.has(body.colorToken)
      ? body.colorToken
      : (existing.color_token as CircleColorToken);

    db.prepare(`
      UPDATE circles
      SET name = ?, cadence_days = ?, target_size = ?, description = ?, color_token = ?
      WHERE id = ?
    `).run(name, cadenceDays, targetSize, description, colorToken, id);

    const updated = db
      .prepare('SELECT * FROM circles WHERE id = ?')
      .get(id) as CircleRow;
    return c.json({ circle: mapCircleRow(updated) });
  });

  // People
  app.get('/api/people', (c) => {
    const refDate = resolveRefDate(c.req.query('date'));
    const includeArchived = c.req.query('includeArchived') === 'true';
    const people = buildEnrichedPeople(db, refDate, includeArchived);
    return c.json({ people });
  });

  app.post('/api/people', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !String(body.name || '').trim()) {
      return c.json({ error: 'Person name is required.' }, 400);
    }

    const circles = listCircles(db);
    const defaultCircle =
      circles.find((cr) => cr.slug === 'close-15') ?? circles[0];
    const requestedCircleId = body.circleId
      ? String(body.circleId)
      : defaultCircle.id;
    const circleExists = circles.some((cr) => cr.id === requestedCircleId);
    if (!circleExists) {
      return c.json({ error: 'Specified circle does not exist.' }, 400);
    }

    const now = todayLocalISO();
    const id = `person-${crypto.randomUUID()}`;
    const customCadence =
      body.customCadenceDays !== undefined &&
      body.customCadenceDays !== null &&
      body.customCadenceDays !== ''
        ? Math.max(1, Math.round(Number(body.customCadenceDays)))
        : null;

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO people (
          id, name, nickname, circle_id, custom_cadence_days, city, neighborhood,
          how_we_met, shared_interests, preferred_vibe, pinned_context,
          snoozed_until, archived, is_sample, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, ?)
      `).run(
        id,
        String(body.name).trim(),
        String(body.nickname || '').trim(),
        requestedCircleId,
        customCadence,
        String(body.city || '').trim(),
        String(body.neighborhood || '').trim(),
        String(body.howWeMet || '').trim(),
        JSON.stringify(normalizeInterests(body.sharedInterests)),
        String(body.preferredVibe || '').trim(),
        String(body.pinnedContext || '').trim(),
        now,
        now
      );

      if (Array.isArray(body.lifeDates)) {
        const insertLd = db.prepare(`
          INSERT INTO life_dates (id, person_id, label, date_month, date_day, date_year, recurring_annual, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ld of body.lifeDates) {
          if (!ld || !String(ld.label || '').trim()) continue;
          insertLd.run(
            `ld-${crypto.randomUUID()}`,
            id,
            String(ld.label).trim(),
            Math.min(12, Math.max(1, Number(ld.dateMonth) || 1)),
            Math.min(31, Math.max(1, Number(ld.dateDay) || 1)),
            ld.dateYear ? Number(ld.dateYear) : null,
            ld.recurringAnnual === false ? 0 : 1,
            String(ld.note || '').trim()
          );
        }
      }
    });
    tx();

    const refDate = resolveRefDate(body.referenceDate);
    const enriched = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === id
    );
    return c.json({ person: enriched }, 201);
  });

  app.get('/api/people/:id', (c) => {
    const id = c.req.param('id');
    const refDate = resolveRefDate(c.req.query('date'));
    const person = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === id
    );
    if (!person) {
      return c.json({ error: 'Person not found.' }, 404);
    }

    const interactions = (
      db
        .prepare(
          'SELECT * FROM interactions WHERE person_id = ? ORDER BY occurred_at DESC, created_at DESC'
        )
        .all(id) as InteractionRow[]
    ).map(mapInteractionRow);

    return c.json({ person, interactions });
  });

  app.patch('/api/people/:id', async (c) => {
    const id = c.req.param('id');
    const existingRow = db
      .prepare('SELECT * FROM people WHERE id = ?')
      .get(id) as PersonRow | undefined;
    if (!existingRow) {
      return c.json({ error: 'Person not found.' }, 404);
    }
    const existing = mapPersonRow(existingRow);

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const circleId =
      body.circleId !== undefined ? String(body.circleId) : existing.circleId;
    const circleExists = db
      .prepare('SELECT id FROM circles WHERE id = ?')
      .get(circleId);
    if (!circleExists) {
      return c.json({ error: 'Specified circle does not exist.' }, 400);
    }

    let customCadenceDays = existing.customCadenceDays;
    if (body.customCadenceDays !== undefined) {
      customCadenceDays =
        body.customCadenceDays === null || body.customCadenceDays === ''
          ? null
          : Math.max(1, Math.round(Number(body.customCadenceDays)));
    }

    const sharedInterests =
      body.sharedInterests !== undefined
        ? normalizeInterests(body.sharedInterests)
        : existing.sharedInterests;

    const now = todayLocalISO();

    db.prepare(`
      UPDATE people SET
        name = ?,
        nickname = ?,
        circle_id = ?,
        custom_cadence_days = ?,
        city = ?,
        neighborhood = ?,
        how_we_met = ?,
        shared_interests = ?,
        preferred_vibe = ?,
        pinned_context = ?,
        snoozed_until = ?,
        archived = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      body.name !== undefined
        ? String(body.name).trim() || existing.name
        : existing.name,
      body.nickname !== undefined
        ? String(body.nickname).trim()
        : existing.nickname,
      circleId,
      customCadenceDays,
      body.city !== undefined ? String(body.city).trim() : existing.city,
      body.neighborhood !== undefined
        ? String(body.neighborhood).trim()
        : existing.neighborhood,
      body.howWeMet !== undefined
        ? String(body.howWeMet).trim()
        : existing.howWeMet,
      JSON.stringify(sharedInterests),
      body.preferredVibe !== undefined
        ? String(body.preferredVibe).trim()
        : existing.preferredVibe,
      body.pinnedContext !== undefined
        ? String(body.pinnedContext).trim()
        : existing.pinnedContext,
      body.snoozedUntil !== undefined
        ? body.snoozedUntil || null
        : existing.snoozedUntil,
      body.archived !== undefined
        ? body.archived
          ? 1
          : 0
        : existing.archived
          ? 1
          : 0,
      now,
      id
    );

    const refDate = resolveRefDate(body.referenceDate);
    const updated = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === id
    );
    return c.json({ person: updated });
  });

  app.delete('/api/people/:id', (c) => {
    const id = c.req.param('id');
    const result = db.prepare('DELETE FROM people WHERE id = ?').run(id);
    if (result.changes === 0) {
      return c.json({ error: 'Person not found.' }, 404);
    }
    return c.json({ ok: true });
  });

  app.post('/api/people/:id/snooze', async (c) => {
    const id = c.req.param('id');
    const existing = db.prepare('SELECT id FROM people WHERE id = ?').get(id);
    if (!existing) {
      return c.json({ error: 'Person not found.' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const refDate = resolveRefDate(body?.referenceDate);

    let snoozedUntil: string | null;
    if (body?.until === null || body?.days === 0) {
      snoozedUntil = null;
    } else if (typeof body?.until === 'string' && isValidISODate(body.until)) {
      snoozedUntil = body.until.slice(0, 10);
    } else {
      const days = Math.max(1, Math.min(90, Math.round(Number(body?.days) || 7)));
      snoozedUntil = addCalendarDays(refDate, days);
    }

    db.prepare('UPDATE people SET snoozed_until = ?, updated_at = ? WHERE id = ?').run(
      snoozedUntil,
      todayLocalISO(),
      id
    );

    const person = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === id
    );
    return c.json({ person });
  });

  // Life Dates
  app.post('/api/people/:id/life-dates', async (c) => {
    const personId = c.req.param('id');
    const existing = db
      .prepare('SELECT id FROM people WHERE id = ?')
      .get(personId);
    if (!existing) {
      return c.json({ error: 'Person not found.' }, 404);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || !String(body.label || '').trim()) {
      return c.json({ error: 'Life date label is required.' }, 400);
    }

    const dateMonth = Math.min(12, Math.max(1, Math.round(Number(body.dateMonth) || 1)));
    const dateDay = Math.min(31, Math.max(1, Math.round(Number(body.dateDay) || 1)));
    const dateYear =
      body.dateYear !== undefined && body.dateYear !== null && body.dateYear !== ''
        ? Math.round(Number(body.dateYear))
        : null;
    const recurringAnnual = body.recurringAnnual === false ? 0 : 1;

    const ldId = `ld-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO life_dates (id, person_id, label, date_month, date_day, date_year, recurring_annual, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ldId,
      personId,
      String(body.label).trim(),
      dateMonth,
      dateDay,
      dateYear,
      recurringAnnual,
      String(body.note || '').trim()
    );

    const refDate = resolveRefDate(body.referenceDate);
    const person = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === personId
    );
    return c.json({ person }, 201);
  });

  app.delete('/api/life-dates/:id', (c) => {
    const id = c.req.param('id');
    const res = db.prepare('DELETE FROM life_dates WHERE id = ?').run(id);
    if (res.changes === 0) {
      return c.json({ error: 'Life date not found.' }, 404);
    }
    return c.json({ ok: true });
  });

  // Interactions
  app.get('/api/interactions', (c) => {
    const personId = c.req.query('personId');
    const limitParam = Number(c.req.query('limit') ?? 50);
    const limit =
      Number.isFinite(limitParam) && limitParam >= 1
        ? Math.min(200, Math.round(limitParam))
        : 50;

    if (personId) {
      const rows = (
        db
          .prepare(
            'SELECT * FROM interactions WHERE person_id = ? ORDER BY occurred_at DESC, created_at DESC LIMIT ?'
          )
          .all(personId, limit) as InteractionRow[]
      ).map(mapInteractionRow);
      return c.json({ interactions: rows });
    }

    return c.json({ interactions: buildRecentInteractions(db, limit) });
  });

  app.post('/api/interactions', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !body.personId) {
      return c.json({ error: 'personId is required.' }, 400);
    }

    const personExists = db
      .prepare('SELECT id FROM people WHERE id = ?')
      .get(String(body.personId));
    if (!personExists) {
      return c.json({ error: 'Person not found.' }, 404);
    }

    const summary = String(body.summary || '').trim();
    if (!summary) {
      return c.json({ error: 'Interaction summary is required.' }, 400);
    }

    const refDate = resolveRefDate(body.referenceDate);
    const occurredAt = isValidISODate(String(body.occurredAt || ''))
      ? String(body.occurredAt).slice(0, 10)
      : refDate;
    const kind: InteractionKind = VALID_KINDS.has(body.kind)
      ? body.kind
      : 'note';

    const id = `int-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO interactions (id, person_id, occurred_at, kind, location, summary, follow_up, raw_input, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(body.personId),
        occurredAt,
        kind,
        String(body.location || '').trim(),
        summary,
        String(body.followUp || '').trim(),
        String(body.rawInput || '').trim(),
        nowIso
      );

      db.prepare(
        'UPDATE people SET snoozed_until = NULL, updated_at = ? WHERE id = ?'
      ).run(todayLocalISO(), String(body.personId));
    });
    tx();

    const interactionRow = db
      .prepare('SELECT * FROM interactions WHERE id = ?')
      .get(id) as InteractionRow;
    const person = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === String(body.personId)
    );

    return c.json(
      {
        interaction: mapInteractionRow(interactionRow),
        person
      },
      201
    );
  });

  app.delete('/api/interactions/:id', (c) => {
    const id = c.req.param('id');
    const res = db.prepare('DELETE FROM interactions WHERE id = ?').run(id);
    if (res.changes === 0) {
      return c.json({ error: 'Interaction not found.' }, 404);
    }
    return c.json({ ok: true });
  });

  // Quick Log
  app.post('/api/quick-log/parse', async (c) => {
    const body = await c.req.json().catch(() => null);
    const text = String(body?.text || '');
    const refDate = resolveRefDate(body?.referenceDate);
    const people = listPeopleRecords(db, true);
    const parsed = parseQuickLog(text, people, refDate);
    return c.json({ parsed });
  });

  app.post('/api/quick-log', async (c) => {
    const body = await c.req.json().catch(() => null);
    const rawText = String(body?.text || '').trim();
    if (!rawText && !String(body?.summary || '').trim()) {
      return c.json({ error: 'Quick log text is required.' }, 400);
    }

    const refDate = resolveRefDate(body?.referenceDate);
    const people = listPeopleRecords(db, true);
    const parsed = parseQuickLog(rawText, people, refDate);

    let targetPersonId: string | null = body?.personId
      ? String(body.personId)
      : parsed.matchedPersonId;

    if (targetPersonId) {
      const exists = db
        .prepare('SELECT id FROM people WHERE id = ?')
        .get(targetPersonId);
      if (!exists) {
        return c.json({ error: 'Selected person was not found.' }, 404);
      }
    } else {
      const newPersonName = String(
        body?.createPersonName ||
          (body?.createIfMissing ? parsed.candidatePersonName || '' : '')
      ).trim();

      if (!newPersonName) {
        return c.json(
          {
            error:
              'Could not match an existing person. Pick someone or create them inline.',
            parsed
          },
          400
        );
      }

      const circles = listCircles(db);
      const fallbackCircle =
        circles.find((cr) => cr.slug === 'close-15') ?? circles[0];
      const requestedCircleId = body?.circleId
        ? String(body.circleId)
        : fallbackCircle.id;
      const circleExists = circles.some((cr) => cr.id === requestedCircleId);
      const finalCircleId = circleExists ? requestedCircleId : fallbackCircle.id;

      targetPersonId = `person-${crypto.randomUUID()}`;
      const now = todayLocalISO();
      db.prepare(`
        INSERT INTO people (
          id, name, nickname, circle_id, custom_cadence_days, city, neighborhood,
          how_we_met, shared_interests, preferred_vibe, pinned_context,
          snoozed_until, archived, is_sample, created_at, updated_at
        ) VALUES (?, ?, '', ?, NULL, '', '', '', '[]', '', '', NULL, 0, 0, ?, ?)
      `).run(targetPersonId, newPersonName, finalCircleId, now, now);
    }

    const finalKind: InteractionKind = VALID_KINDS.has(body?.kind)
      ? body.kind
      : parsed.kind;
    const finalOccurredAt = isValidISODate(String(body?.occurredAt || ''))
      ? String(body.occurredAt).slice(0, 10)
      : parsed.occurredAt;
    const finalLocation =
      body?.location !== undefined
        ? String(body.location).trim()
        : parsed.location;
    const finalSummary =
      String(body?.summary || '').trim() || parsed.summary || rawText;
    const finalFollowUp =
      body?.followUp !== undefined
        ? String(body.followUp).trim()
        : parsed.followUp;

    const interactionId = `int-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO interactions (id, person_id, occurred_at, kind, location, summary, follow_up, raw_input, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        interactionId,
        targetPersonId,
        finalOccurredAt,
        finalKind,
        finalLocation,
        finalSummary,
        finalFollowUp,
        rawText,
        nowIso
      );

      db.prepare(
        'UPDATE people SET snoozed_until = NULL, updated_at = ? WHERE id = ?'
      ).run(todayLocalISO(), targetPersonId);
    });
    tx();

    const interactionRow = db
      .prepare('SELECT * FROM interactions WHERE id = ?')
      .get(interactionId) as InteractionRow;
    const person = buildEnrichedPeople(db, refDate, true).find(
      (p) => p.id === targetPersonId
    );

    return c.json(
      {
        interaction: mapInteractionRow(interactionRow),
        person,
        parsed
      },
      201
    );
  });

  // Sample data toggle & workspace reset
  app.post('/api/sample-data', async (c) => {
    const body = await c.req.json().catch(() => null);
    const enabled = Boolean(body?.enabled);
    const refDate = resolveRefDate(body?.referenceDate);

    if (enabled) {
      seedSampleData(db, refDate);
    } else {
      clearSampleData(db);
    }

    return c.json({
      ok: true,
      bootstrap: buildBootstrapResponse(db, dbPath, refDate)
    });
  });

  app.post('/api/workspace/reset', (c) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM interactions').run();
      db.prepare('DELETE FROM life_dates').run();
      db.prepare('DELETE FROM people').run();
      db.prepare('DELETE FROM circles').run();
      ensureDefaultCircles(db);
      setMeta(db, 'sample_data_enabled', 'false');
      setMeta(db, 'initialized', 'true');
    });
    tx();
    return c.json({ ok: true });
  });

  // Backups: JSON, CSV, SQLite
  app.get('/api/backup/json', (c) => {
    const backup = exportJsonBackup(db);
    const dateStamp = todayLocalISO();
    return c.json(backup, 200, {
      'Content-Disposition': `attachment; filename="warm-crm-backup-${dateStamp}.json"`
    });
  });

  app.post('/api/backup/json', async (c) => {
    try {
      const body = await c.req.json();
      const queryMode = c.req.query('mode');
      const mode: ImportMode =
        body?.mode === 'merge' || queryMode === 'merge' ? 'merge' : 'replace';
      const payload = body?.backup ?? body;
      const imported = importJsonBackup(db, payload, mode);
      return c.json({ ok: true, imported });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid JSON backup.' },
        400
      );
    }
  });

  app.get('/api/backup/csv', (c) => {
    const csv = exportCsvBackup(db);
    const dateStamp = todayLocalISO();
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="warm-crm-contacts-${dateStamp}.csv"`
    });
  });

  app.post('/api/backup/csv', async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      const queryMode = c.req.query('mode');
      let csvText = '';
      let mode: ImportMode = queryMode === 'merge' ? 'merge' : 'replace';

      if (contentType.includes('application/json')) {
        const body = await c.req.json();
        csvText = String(body?.csv || '');
        if (body?.mode === 'merge') mode = 'merge';
      } else {
        csvText = await c.req.text();
      }

      const imported = importCsvBackup(db, csvText, mode);
      return c.json({ ok: true, imported });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid CSV backup.' },
        400
      );
    }
  });

  app.get('/api/backup/sqlite', (c) => {
    const buffer = exportSqliteBackup(db);
    const dateStamp = todayLocalISO();
    return c.body(new Uint8Array(buffer), 200, {
      'Content-Type': 'application/vnd.sqlite3',
      'Content-Disposition': `attachment; filename="warm-crm-${dateStamp}.sqlite"`
    });
  });

  app.post('/api/backup/sqlite', async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let bytes: Uint8Array;

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const file = formData.get('file');
        if (!file || typeof file === 'string') {
          return c.json({ error: 'Missing SQLite file upload.' }, 400);
        }
        bytes = new Uint8Array(await file.arrayBuffer());
      } else {
        bytes = new Uint8Array(await c.req.arrayBuffer());
      }

      const imported = importSqliteBackup(db, bytes);
      return c.json({ ok: true, imported });
    } catch (err) {
      return c.json(
        {
          error:
            err instanceof Error ? err.message : 'Invalid SQLite database file.'
        },
        400
      );
    }
  });

  // Static client bundle + SPA fallback (for production & `npm start`)
  if (options.clientDistDir && fs.existsSync(options.clientDistDir)) {
    const distRoot = path.resolve(options.clientDistDir);
    const indexHtmlPath = path.join(distRoot, 'index.html');

    app.get('*', (c) => {
      const reqPath = c.req.path;
      if (reqPath.startsWith('/api/')) {
        return c.json({ error: 'API route not found.' }, 404);
      }

      const relPath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const candidatePath = path.resolve(distRoot, relPath);

      const isInsideDist =
        candidatePath === distRoot ||
        candidatePath.startsWith(distRoot + path.sep);

      if (
        isInsideDist &&
        fs.existsSync(candidatePath) &&
        fs.statSync(candidatePath).isFile()
      ) {
        const ext = path.extname(candidatePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const data = fs.readFileSync(candidatePath);
        return c.body(new Uint8Array(data), 200, { 'Content-Type': mime });
      }

      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, 'utf8');
        return c.html(html);
      }

      return c.text('Client build not found.', 404);
    });
  }

  return app;
}
