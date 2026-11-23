import type Database from 'better-sqlite3';
import { todayLocalISO } from '../../shared/dates.js';
import type {
  Circle,
  CircleColorToken,
  Interaction,
  InteractionKind,
  LifeDate,
  PersonRecord
} from '../../shared/types.js';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cadence_days INTEGER NOT NULL CHECK (cadence_days >= 1),
  target_size INTEGER NOT NULL CHECK (target_size >= 1),
  description TEXT NOT NULL DEFAULT '',
  color_token TEXT NOT NULL DEFAULT 'amber',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE RESTRICT,
  custom_cadence_days INTEGER CHECK (custom_cadence_days IS NULL OR custom_cadence_days >= 1),
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  how_we_met TEXT NOT NULL DEFAULT '',
  shared_interests TEXT NOT NULL DEFAULT '[]',
  preferred_vibe TEXT NOT NULL DEFAULT '',
  pinned_context TEXT NOT NULL DEFAULT '',
  snoozed_until TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS life_dates (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  date_month INTEGER NOT NULL CHECK (date_month BETWEEN 1 AND 12),
  date_day INTEGER NOT NULL CHECK (date_day BETWEEN 1 AND 31),
  date_year INTEGER,
  recurring_annual INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  location TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  follow_up TEXT NOT NULL DEFAULT '',
  raw_input TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_person_date
  ON interactions (person_id, occurred_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_life_dates_person
  ON life_dates (person_id);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const DEFAULT_CIRCLES: Array<Omit<Circle, 'createdAt'>> = [
  {
    id: 'circle-inner-5',
    name: 'Inner 5',
    slug: 'inner-5',
    cadenceDays: 14,
    targetSize: 5,
    description:
      'Your closest everyday anchors — unhurried check-ins every couple of weeks.',
    colorToken: 'terracotta',
    sortOrder: 1
  },
  {
    id: 'circle-close-15',
    name: 'Close 15',
    slug: 'close-15',
    cadenceDays: 30,
    targetSize: 15,
    description:
      'Dear friends you want to share real meals, walks, and life chapters with monthly.',
    colorToken: 'amber',
    sortOrder: 2
  },
  {
    id: 'circle-extended-50',
    name: 'Extended 50',
    slug: 'extended-50',
    cadenceDays: 90,
    targetSize: 50,
    description:
      'Warm kindred spirits and old friends to catch up with each season.',
    colorToken: 'sage',
    sortOrder: 3
  },
  {
    id: 'circle-family',
    name: 'Family',
    slug: 'family',
    cadenceDays: 21,
    targetSize: 12,
    description:
      'Parents, siblings, cousins, and elders who matter deeply.',
    colorToken: 'plum',
    sortOrder: 4
  }
];

export function applySchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

export function ensureDefaultCircles(db: Database.Database): void {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM circles')
    .get() as { count: number };
  if (row.count > 0) return;

  const now = todayLocalISO();
  const insert = db.prepare(`
    INSERT INTO circles (id, name, slug, cadence_days, target_size, description, color_token, sort_order, created_at)
    VALUES (@id, @name, @slug, @cadenceDays, @targetSize, @description, @colorToken, @sortOrder, @createdAt)
  `);

  const tx = db.transaction(() => {
    for (const c of DEFAULT_CIRCLES) {
      insert.run({ ...c, createdAt: now });
    }
  });
  tx();
}

export function getMeta(db: Database.Database, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export interface CircleRow {
  id: string;
  name: string;
  slug: string;
  cadence_days: number;
  target_size: number;
  description: string;
  color_token: string;
  sort_order: number;
  created_at: string;
}

export interface PersonRow {
  id: string;
  name: string;
  nickname: string;
  circle_id: string;
  custom_cadence_days: number | null;
  city: string;
  neighborhood: string;
  how_we_met: string;
  shared_interests: string;
  preferred_vibe: string;
  pinned_context: string;
  snoozed_until: string | null;
  archived: number;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

export interface LifeDateRow {
  id: string;
  person_id: string;
  label: string;
  date_month: number;
  date_day: number;
  date_year: number | null;
  recurring_annual: number;
  note: string;
}

export interface InteractionRow {
  id: string;
  person_id: string;
  occurred_at: string;
  kind: string;
  location: string;
  summary: string;
  follow_up: string;
  raw_input: string;
  created_at: string;
}

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

export function mapCircleRow(row: CircleRow): Circle {
  const colorToken: CircleColorToken = VALID_COLORS.has(
    row.color_token as CircleColorToken
  )
    ? (row.color_token as CircleColorToken)
    : 'amber';

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    cadenceDays: row.cadence_days,
    targetSize: row.target_size,
    description: row.description,
    colorToken,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

export function parseSharedInterests(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
  } catch {
    // Fallback below
  }
  return [];
}

export function mapPersonRow(row: PersonRow): PersonRecord {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    circleId: row.circle_id,
    customCadenceDays: row.custom_cadence_days,
    city: row.city,
    neighborhood: row.neighborhood,
    howWeMet: row.how_we_met,
    sharedInterests: parseSharedInterests(row.shared_interests),
    preferredVibe: row.preferred_vibe,
    pinnedContext: row.pinned_context,
    snoozedUntil: row.snoozed_until,
    archived: row.archived === 1,
    isSample: row.is_sample === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapLifeDateRow(row: LifeDateRow): LifeDate {
  return {
    id: row.id,
    personId: row.person_id,
    label: row.label,
    dateMonth: row.date_month,
    dateDay: row.date_day,
    dateYear: row.date_year,
    recurringAnnual: row.recurring_annual === 1,
    note: row.note
  };
}

export function mapInteractionRow(row: InteractionRow): Interaction {
  const kind: InteractionKind = VALID_KINDS.has(row.kind as InteractionKind)
    ? (row.kind as InteractionKind)
    : 'note';

  return {
    id: row.id,
    personId: row.person_id,
    occurredAt: row.occurred_at,
    kind,
    location: row.location,
    summary: row.summary,
    followUp: row.follow_up,
    rawInput: row.raw_input,
    createdAt: row.created_at
  };
}
