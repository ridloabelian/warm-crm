import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { todayLocalISO } from '../../shared/dates.js';
import type {
  Circle,
  CircleColorToken,
  Interaction,
  InteractionKind,
  LifeDate,
  PersonRecord,
  WarmCrmBackupV1
} from '../../shared/types.js';
import {
  type CircleRow,
  type InteractionRow,
  type LifeDateRow,
  type PersonRow,
  ensureDefaultCircles,
  getMeta,
  mapCircleRow,
  mapInteractionRow,
  mapLifeDateRow,
  mapPersonRow,
  setMeta
} from '../db/schema.js';
import {
  listAllInteractions,
  listAllLifeDates,
  listCircles,
  listPeopleRecords
} from './enrich.js';

export type ImportMode = 'replace' | 'merge';

const VALID_COLORS = new Set<CircleColorToken>([
  'terracotta',
  'amber',
  'sage',
  'plum'
]);

const VALID_KINDS = new Set<InteractionKind>([
  'coffee',
  'meal',
  'walk',
  'call',
  'visit',
  'meetup',
  'note'
]);

export function exportJsonBackup(db: Database.Database): WarmCrmBackupV1 {
  const circles = listCircles(db);
  const people = listPeopleRecords(db, true);
  const lifeDates = listAllLifeDates(db);
  const interactions = listAllInteractions(db);
  const sampleDataEnabled =
    getMeta(db, 'sample_data_enabled') === 'true' ||
    people.some((p) => p.isSample);

  return {
    format: 'warm-crm-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    circles,
    people,
    lifeDates,
    interactions,
    meta: {
      sampleDataEnabled
    }
  };
}

function validateBackupShape(payload: unknown): asserts payload is WarmCrmBackupV1 {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup payload must be a JSON object.');
  }
  const obj = payload as Record<string, unknown>;
  if (obj.format !== 'warm-crm-backup') {
    throw new Error('Unsupported backup format; expected "warm-crm-backup".');
  }
  if (obj.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(obj.version)}.`);
  }
  if (
    !Array.isArray(obj.circles) ||
    !Array.isArray(obj.people) ||
    !Array.isArray(obj.lifeDates) ||
    !Array.isArray(obj.interactions)
  ) {
    throw new Error(
      'Backup must contain circles, people, lifeDates, and interactions arrays.'
    );
  }
}

export function importJsonBackup(
  db: Database.Database,
  payload: unknown,
  mode: ImportMode = 'replace'
): { circles: number; people: number; lifeDates: number; interactions: number } {
  validateBackupShape(payload);

  const tx = db.transaction(() => {
    if (mode === 'replace') {
      db.prepare('DELETE FROM interactions').run();
      db.prepare('DELETE FROM life_dates').run();
      db.prepare('DELETE FROM people').run();
      db.prepare('DELETE FROM circles').run();
    }

    const existingCircles = listCircles(db);
    const circleSlugToExistingId = new Map(
      existingCircles.map((c) => [c.slug, c.id])
    );
    const remappedCircleIds = new Map<string, string>();

    const upsertCircle = db.prepare(`
      INSERT INTO circles (
        id, name, slug, cadence_days, target_size, description, color_token, sort_order, created_at
      ) VALUES (
        @id, @name, @slug, @cadenceDays, @targetSize, @description, @colorToken, @sortOrder, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        cadence_days = excluded.cadence_days,
        target_size = excluded.target_size,
        description = excluded.description,
        color_token = excluded.color_token,
        sort_order = excluded.sort_order
    `);

    for (const c of payload.circles) {
      const slug = String(c.slug || c.name || c.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const existingBySlug = circleSlugToExistingId.get(slug);
      const targetId =
        mode === 'merge' && existingBySlug ? existingBySlug : c.id;
      remappedCircleIds.set(c.id, targetId);

      const colorToken: CircleColorToken = VALID_COLORS.has(c.colorToken)
        ? c.colorToken
        : 'amber';

      upsertCircle.run({
        id: targetId,
        name: String(c.name || 'Circle'),
        slug: slug || targetId,
        cadenceDays: Math.max(1, Math.round(Number(c.cadenceDays) || 30)),
        targetSize: Math.max(1, Math.round(Number(c.targetSize) || 15)),
        description: String(c.description || ''),
        colorToken,
        sortOrder: Number(c.sortOrder) || 0,
        createdAt: c.createdAt || todayLocalISO()
      });
    }

    ensureDefaultCircles(db);
    const allCirclesNow = listCircles(db);
    const validCircleIds = new Set(allCirclesNow.map((c) => c.id));
    const fallbackCircleId = allCirclesNow[0].id;

    const upsertPerson = db.prepare(`
      INSERT INTO people (
        id, name, nickname, circle_id, custom_cadence_days, city, neighborhood,
        how_we_met, shared_interests, preferred_vibe, pinned_context,
        snoozed_until, archived, is_sample, created_at, updated_at
      ) VALUES (
        @id, @name, @nickname, @circleId, @customCadenceDays, @city, @neighborhood,
        @howWeMet, @sharedInterests, @preferredVibe, @pinnedContext,
        @snoozedUntil, @archived, @isSample, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        nickname = excluded.nickname,
        circle_id = excluded.circle_id,
        custom_cadence_days = excluded.custom_cadence_days,
        city = excluded.city,
        neighborhood = excluded.neighborhood,
        how_we_met = excluded.how_we_met,
        shared_interests = excluded.shared_interests,
        preferred_vibe = excluded.preferred_vibe,
        pinned_context = excluded.pinned_context,
        snoozed_until = excluded.snoozed_until,
        archived = excluded.archived,
        is_sample = excluded.is_sample,
        updated_at = excluded.updated_at
    `);

    const validPeopleIds = new Set<string>(
      mode === 'merge' ? listPeopleRecords(db, true).map((p) => p.id) : []
    );

    for (const p of payload.people) {
      const mappedCircleId =
        remappedCircleIds.get(p.circleId) ?? p.circleId;
      const safeCircleId = validCircleIds.has(mappedCircleId)
        ? mappedCircleId
        : fallbackCircleId;

      upsertPerson.run({
        id: p.id,
        name: String(p.name || 'Unnamed'),
        nickname: String(p.nickname || ''),
        circleId: safeCircleId,
        customCadenceDays:
          p.customCadenceDays != null
            ? Math.max(1, Math.round(Number(p.customCadenceDays)))
            : null,
        city: String(p.city || ''),
        neighborhood: String(p.neighborhood || ''),
        howWeMet: String(p.howWeMet || ''),
        sharedInterests: JSON.stringify(
          Array.isArray(p.sharedInterests)
            ? p.sharedInterests.map((s) => String(s).trim()).filter(Boolean)
            : []
        ),
        preferredVibe: String(p.preferredVibe || ''),
        pinnedContext: String(p.pinnedContext || ''),
        snoozedUntil: p.snoozedUntil || null,
        archived: p.archived ? 1 : 0,
        isSample: p.isSample ? 1 : 0,
        createdAt: p.createdAt || todayLocalISO(),
        updatedAt: p.updatedAt || todayLocalISO()
      });
      validPeopleIds.add(p.id);
    }

    const upsertLifeDate = db.prepare(`
      INSERT INTO life_dates (
        id, person_id, label, date_month, date_day, date_year, recurring_annual, note
      ) VALUES (
        @id, @personId, @label, @dateMonth, @dateDay, @dateYear, @recurringAnnual, @note
      )
      ON CONFLICT(id) DO UPDATE SET
        person_id = excluded.person_id,
        label = excluded.label,
        date_month = excluded.date_month,
        date_day = excluded.date_day,
        date_year = excluded.date_year,
        recurring_annual = excluded.recurring_annual,
        note = excluded.note
    `);

    let importedLifeDates = 0;
    for (const ld of payload.lifeDates) {
      if (!validPeopleIds.has(ld.personId)) continue;
      upsertLifeDate.run({
        id: ld.id,
        personId: ld.personId,
        label: String(ld.label || 'Milestone'),
        dateMonth: Math.min(12, Math.max(1, Number(ld.dateMonth) || 1)),
        dateDay: Math.min(31, Math.max(1, Number(ld.dateDay) || 1)),
        dateYear: ld.dateYear != null ? Number(ld.dateYear) : null,
        recurringAnnual: ld.recurringAnnual ? 1 : 0,
        note: String(ld.note || '')
      });
      importedLifeDates += 1;
    }

    const upsertInteraction = db.prepare(`
      INSERT INTO interactions (
        id, person_id, occurred_at, kind, location, summary, follow_up, raw_input, created_at
      ) VALUES (
        @id, @personId, @occurredAt, @kind, @location, @summary, @followUp, @rawInput, @createdAt
      )
      ON CONFLICT(id) DO UPDATE SET
        person_id = excluded.person_id,
        occurred_at = excluded.occurred_at,
        kind = excluded.kind,
        location = excluded.location,
        summary = excluded.summary,
        follow_up = excluded.follow_up,
        raw_input = excluded.raw_input
    `);

    let importedInteractions = 0;
    for (const inter of payload.interactions) {
      if (!validPeopleIds.has(inter.personId)) continue;
      const safeKind: InteractionKind = VALID_KINDS.has(inter.kind)
        ? inter.kind
        : 'note';
      upsertInteraction.run({
        id: inter.id,
        personId: inter.personId,
        occurredAt: String(inter.occurredAt || todayLocalISO()),
        kind: safeKind,
        location: String(inter.location || ''),
        summary: String(inter.summary || ''),
        followUp: String(inter.followUp || ''),
        rawInput: String(inter.rawInput || ''),
        createdAt: String(inter.createdAt || todayLocalISO())
      });
      importedInteractions += 1;
    }

    const sampleEnabled =
      payload.meta?.sampleDataEnabled ??
      payload.people.some((p) => Boolean(p.isSample));
    setMeta(db, 'sample_data_enabled', sampleEnabled ? 'true' : 'false');
    setMeta(db, 'initialized', 'true');

    return {
      circles: payload.circles.length,
      people: payload.people.length,
      lifeDates: importedLifeDates,
      interactions: importedInteractions
    };
  });

  return tx();
}

const CSV_HEADERS = [
  'id',
  'name',
  'nickname',
  'circle_name',
  'circle_slug',
  'circle_cadence_days',
  'custom_cadence_days',
  'city',
  'neighborhood',
  'how_we_met',
  'shared_interests',
  'preferred_vibe',
  'pinned_context',
  'snoozed_until',
  'archived',
  'is_sample',
  'last_interaction_at',
  'last_interaction_kind',
  'last_interaction_summary',
  'life_dates_json',
  'interactions_json',
  'created_at',
  'updated_at'
] as const;

export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\r\n');
}

export function parseCsv(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field.');
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter(
    (r) => !(r.length === 1 && r[0].trim() === '')
  );
}

export function exportCsvBackup(db: Database.Database): string {
  const circles = listCircles(db);
  const circleMap = new Map(circles.map((c) => [c.id, c]));
  const people = listPeopleRecords(db, true);
  const lifeDates = listAllLifeDates(db);
  const interactions = listAllInteractions(db);

  const ldByPerson = new Map<string, LifeDate[]>();
  for (const ld of lifeDates) {
    const arr = ldByPerson.get(ld.personId) ?? [];
    arr.push(ld);
    ldByPerson.set(ld.personId, arr);
  }

  const interByPerson = new Map<string, Interaction[]>();
  for (const inter of interactions) {
    const arr = interByPerson.get(inter.personId) ?? [];
    arr.push(inter);
    interByPerson.set(inter.personId, arr);
  }

  const matrix: string[][] = [[...CSV_HEADERS]];

  for (const p of people) {
    const circle = circleMap.get(p.circleId);
    const pInteractions = interByPerson.get(p.id) ?? [];
    const last = pInteractions[0] ?? null;
    const pLifeDates = ldByPerson.get(p.id) ?? [];

    matrix.push([
      p.id,
      p.name,
      p.nickname,
      circle?.name ?? '',
      circle?.slug ?? '',
      String(circle?.cadenceDays ?? 30),
      p.customCadenceDays != null ? String(p.customCadenceDays) : '',
      p.city,
      p.neighborhood,
      p.howWeMet,
      p.sharedInterests.join('; '),
      p.preferredVibe,
      p.pinnedContext,
      p.snoozedUntil ?? '',
      p.archived ? 'true' : 'false',
      p.isSample ? 'true' : 'false',
      last?.occurredAt ?? '',
      last?.kind ?? '',
      last?.summary ?? '',
      JSON.stringify(pLifeDates),
      JSON.stringify(pInteractions),
      p.createdAt,
      p.updatedAt
    ]);
  }

  return serializeCsv(matrix);
}

export function importCsvBackup(
  db: Database.Database,
  csvText: string,
  mode: ImportMode = 'replace'
): { circles: number; people: number; lifeDates: number; interactions: number } {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headerRow.indexOf('name');
  if (nameIdx === -1) {
    throw new Error('CSV header must include a "name" column.');
  }

  ensureDefaultCircles(db);
  const existingCircles = listCircles(db);
  const circleBySlug = new Map(
    existingCircles.map((c) => [c.slug.toLowerCase(), c])
  );
  const circleByName = new Map(
    existingCircles.map((c) => [c.name.toLowerCase(), c])
  );
  const fallbackCircle =
    circleBySlug.get('close-15') ?? existingCircles[0];

  const getVal = (row: string[], col: string): string => {
    const idx = headerRow.indexOf(col);
    return idx >= 0 && idx < row.length ? row[idx].trim() : '';
  };

  const circlesMap = new Map<string, Circle>(
    existingCircles.map((c) => [c.id, c])
  );
  const people: PersonRecord[] = [];
  const lifeDates: LifeDate[] = [];
  const interactions: Interaction[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const name = getVal(row, 'name');
    if (!name) continue;

    const personId = getVal(row, 'id') || crypto.randomUUID();
    const circleSlugRaw = getVal(row, 'circle_slug').toLowerCase();
    const circleNameRaw = getVal(row, 'circle_name') || getVal(row, 'circle');
    const cadenceRaw = Number(getVal(row, 'circle_cadence_days'));

    let matchedCircle =
      (circleSlugRaw ? circleBySlug.get(circleSlugRaw) : undefined) ??
      (circleNameRaw ? circleByName.get(circleNameRaw.toLowerCase()) : undefined);

    if (!matchedCircle && circleNameRaw) {
      const slug = circleNameRaw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      matchedCircle = circleBySlug.get(slug);
      if (!matchedCircle) {
        const createdCircle: Circle = {
          id: `circle-${slug || crypto.randomUUID()}`,
          name: circleNameRaw,
          slug: slug || `circle-${i}`,
          cadenceDays:
            Number.isFinite(cadenceRaw) && cadenceRaw >= 1 ? cadenceRaw : 30,
          targetSize: 15,
          description: '',
          colorToken: 'amber',
          sortOrder: circlesMap.size + 1,
          createdAt: todayLocalISO()
        };
        circlesMap.set(createdCircle.id, createdCircle);
        circleBySlug.set(createdCircle.slug, createdCircle);
        circleByName.set(createdCircle.name.toLowerCase(), createdCircle);
        matchedCircle = createdCircle;
      }
    }

    const finalCircle = matchedCircle ?? fallbackCircle;
    const customCadenceRaw = getVal(row, 'custom_cadence_days');
    const customCadenceNum = Number(customCadenceRaw);
    const customCadenceDays =
      customCadenceRaw !== '' && Number.isFinite(customCadenceNum) && customCadenceNum >= 1
        ? Math.round(customCadenceNum)
        : null;

    const interestsRaw = getVal(row, 'shared_interests');
    const sharedInterests = interestsRaw
      ? interestsRaw
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const now = todayLocalISO();
    const person: PersonRecord = {
      id: personId,
      name,
      nickname: getVal(row, 'nickname'),
      circleId: finalCircle.id,
      customCadenceDays,
      city: getVal(row, 'city'),
      neighborhood: getVal(row, 'neighborhood'),
      howWeMet: getVal(row, 'how_we_met'),
      sharedInterests,
      preferredVibe: getVal(row, 'preferred_vibe'),
      pinnedContext: getVal(row, 'pinned_context'),
      snoozedUntil: getVal(row, 'snoozed_until') || null,
      archived: getVal(row, 'archived').toLowerCase() === 'true',
      isSample: getVal(row, 'is_sample').toLowerCase() === 'true',
      createdAt: getVal(row, 'created_at') || now,
      updatedAt: getVal(row, 'updated_at') || now
    };
    people.push(person);

    const lifeDatesJsonRaw = getVal(row, 'life_dates_json');
    if (lifeDatesJsonRaw) {
      const parsedLds = JSON.parse(lifeDatesJsonRaw);
      if (Array.isArray(parsedLds)) {
        for (const ld of parsedLds) {
          lifeDates.push({
            id: String(ld.id || crypto.randomUUID()),
            personId: person.id,
            label: String(ld.label || 'Milestone'),
            dateMonth: Number(ld.dateMonth) || 1,
            dateDay: Number(ld.dateDay) || 1,
            dateYear: ld.dateYear != null ? Number(ld.dateYear) : null,
            recurringAnnual: ld.recurringAnnual !== false,
            note: String(ld.note || '')
          });
        }
      }
    }

    const interactionsJsonRaw = getVal(row, 'interactions_json');
    if (interactionsJsonRaw) {
      const parsedInts = JSON.parse(interactionsJsonRaw);
      if (Array.isArray(parsedInts)) {
        for (const inter of parsedInts) {
          const kind = VALID_KINDS.has(inter.kind) ? inter.kind : 'note';
          interactions.push({
            id: String(inter.id || crypto.randomUUID()),
            personId: person.id,
            occurredAt: String(inter.occurredAt || now),
            kind,
            location: String(inter.location || ''),
            summary: String(inter.summary || ''),
            followUp: String(inter.followUp || ''),
            rawInput: String(inter.rawInput || ''),
            createdAt: String(inter.createdAt || now)
          });
        }
      }
    } else {
      const lastSummary = getVal(row, 'last_interaction_summary');
      const lastAt = getVal(row, 'last_interaction_at');
      const lastKindRaw = getVal(row, 'last_interaction_kind').toLowerCase();
      if (lastSummary || lastAt) {
        const safeKind: InteractionKind = VALID_KINDS.has(
          lastKindRaw as InteractionKind
        )
          ? (lastKindRaw as InteractionKind)
          : 'note';
        interactions.push({
          id: crypto.randomUUID(),
          personId: person.id,
          occurredAt: lastAt || now,
          kind: safeKind,
          location: '',
          summary: lastSummary || 'Catch-up',
          followUp: '',
          rawInput: '',
          createdAt: now
        });
      }
    }
  }

  const backup: WarmCrmBackupV1 = {
    format: 'warm-crm-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    circles: Array.from(circlesMap.values()),
    people,
    lifeDates,
    interactions,
    meta: {
      sampleDataEnabled: people.some((p) => p.isSample)
    }
  };

  return importJsonBackup(db, backup, mode);
}

export function exportSqliteBackup(db: Database.Database): Buffer {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warm-crm-export-'));
  const tempPath = path.join(tempDir, 'warm-crm-backup.sqlite');
  try {
    db.prepare('VACUUM INTO ?').run(tempPath);
    return fs.readFileSync(tempPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function importSqliteBackup(
  db: Database.Database,
  bytes: Uint8Array
): { circles: number; people: number; lifeDates: number; interactions: number } {
  const buf = Buffer.from(bytes);
  if (
    buf.length < 100 ||
    buf.subarray(0, 16).toString('utf8') !== 'SQLite format 3\0'
  ) {
    throw new Error('Invalid SQLite database file header.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warm-crm-import-'));
  const tempPath = path.join(tempDir, 'uploaded.sqlite');
  let sourceDb: Database.Database | null = null;

  try {
    fs.writeFileSync(tempPath, buf);
    sourceDb = new Database(tempPath, { readonly: true, fileMustExist: true });

    const integrity = sourceDb.pragma('quick_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error('Uploaded SQLite database failed integrity check.');
    }

    const tables = new Set(
      (
        sourceDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as Array<{ name: string }>
      ).map((t) => t.name)
    );

    for (const required of ['circles', 'people', 'life_dates', 'interactions']) {
      if (!tables.has(required)) {
        throw new Error(
          `Uploaded SQLite file is missing required table "${required}".`
        );
      }
    }

    const circles = (
      sourceDb.prepare('SELECT * FROM circles ORDER BY sort_order ASC').all() as CircleRow[]
    ).map(mapCircleRow);

    const people = (
      sourceDb.prepare('SELECT * FROM people').all() as PersonRow[]
    ).map(mapPersonRow);

    const lifeDates = (
      sourceDb.prepare('SELECT * FROM life_dates').all() as LifeDateRow[]
    ).map(mapLifeDateRow);

    const interactions = (
      sourceDb.prepare('SELECT * FROM interactions').all() as InteractionRow[]
    ).map(mapInteractionRow);

    let sampleDataEnabled = people.some((p) => p.isSample);
    if (tables.has('app_meta')) {
      const metaRow = sourceDb
        .prepare("SELECT value FROM app_meta WHERE key = 'sample_data_enabled'")
        .get() as { value: string } | undefined;
      if (metaRow) {
        sampleDataEnabled = metaRow.value === 'true';
      }
    }

    const backup: WarmCrmBackupV1 = {
      format: 'warm-crm-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      circles,
      people,
      lifeDates,
      interactions,
      meta: { sampleDataEnabled }
    };

    sourceDb.close();
    sourceDb = null;

    return importJsonBackup(db, backup, 'replace');
  } finally {
    if (sourceDb) {
      sourceDb.close();
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
