import fs from 'node:fs';
import type Database from 'better-sqlite3';
import {
  daysUntilLifeDate,
  formatShortMonthDay,
  todayLocalISO
} from '../../shared/dates.js';
import type {
  BootstrapResponse,
  Circle,
  Interaction,
  LifeDate,
  PersonEnriched,
  PersonRecord,
  RecentInteractionItem,
  UpcomingLifeDateItem,
  WeeklyRitualResponse,
  WorkspaceStats
} from '../../shared/types.js';
import {
  type CircleRow,
  type InteractionRow,
  type LifeDateRow,
  type PersonRow,
  getMeta,
  mapCircleRow,
  mapInteractionRow,
  mapLifeDateRow,
  mapPersonRow
} from '../db/schema.js';
import { computeCadenceMetrics, formatLastInteractionLine } from './cadence.js';
import { generateMeetupPrompt } from './prompts.js';
import { selectWeeklyRitual } from './ritual.js';

export function listCircles(db: Database.Database): Circle[] {
  const rows = db
    .prepare('SELECT * FROM circles ORDER BY sort_order ASC, name ASC')
    .all() as CircleRow[];
  return rows.map(mapCircleRow);
}

export function listPeopleRecords(
  db: Database.Database,
  includeArchived = false
): PersonRecord[] {
  const rows = (
    includeArchived
      ? db.prepare('SELECT * FROM people ORDER BY name ASC').all()
      : db
          .prepare('SELECT * FROM people WHERE archived = 0 ORDER BY name ASC')
          .all()
  ) as PersonRow[];
  return rows.map(mapPersonRow);
}

export function listAllLifeDates(db: Database.Database): LifeDate[] {
  const rows = db
    .prepare('SELECT * FROM life_dates ORDER BY date_month ASC, date_day ASC')
    .all() as LifeDateRow[];
  return rows.map(mapLifeDateRow);
}

export function listAllInteractions(db: Database.Database): Interaction[] {
  const rows = db
    .prepare(
      'SELECT * FROM interactions ORDER BY occurred_at DESC, created_at DESC'
    )
    .all() as InteractionRow[];
  return rows.map(mapInteractionRow);
}

export function buildEnrichedPeople(
  db: Database.Database,
  referenceDateStr: string = todayLocalISO(),
  includeArchived = false
): PersonEnriched[] {
  const circles = listCircles(db);
  const circleMap = new Map(circles.map((c) => [c.id, c]));
  const fallbackCircle = circles[0];

  const people = listPeopleRecords(db, includeArchived);
  const lifeDates = listAllLifeDates(db);
  const interactions = listAllInteractions(db);

  const lifeDatesByPerson = new Map<string, LifeDate[]>();
  for (const ld of lifeDates) {
    const daysUntil = daysUntilLifeDate(ld, referenceDateStr);
    const enrichedLd: LifeDate = {
      ...ld,
      daysUntil,
      formattedDate: formatShortMonthDay(
        ld.dateMonth,
        ld.dateDay,
        ld.recurringAnnual ? null : ld.dateYear
      )
    };
    const arr = lifeDatesByPerson.get(ld.personId);
    if (arr) {
      arr.push(enrichedLd);
    } else {
      lifeDatesByPerson.set(ld.personId, [enrichedLd]);
    }
  }

  const interactionsByPerson = new Map<string, Interaction[]>();
  for (const inter of interactions) {
    const arr = interactionsByPerson.get(inter.personId);
    if (arr) {
      arr.push(inter);
    } else {
      interactionsByPerson.set(inter.personId, [inter]);
    }
  }

  return people.map((person) => {
    const circle = circleMap.get(person.circleId) ?? fallbackCircle;
    const personInteractions = interactionsByPerson.get(person.id) ?? [];
    const lastInteraction = personInteractions[0] ?? null;
    const personLifeDates = [...(lifeDatesByPerson.get(person.id) ?? [])].sort(
      (a, b) => {
        const aDays = a.daysUntil ?? 9999;
        const bDays = b.daysUntil ?? 9999;
        return aDays - bDays;
      }
    );

    const upcomingLifeDate =
      personLifeDates.find(
        (ld) => ld.daysUntil != null && ld.daysUntil >= 0 && ld.daysUntil <= 45
      ) ?? null;

    const cadence = computeCadenceMetrics(
      person,
      circle,
      lastInteraction,
      referenceDateStr
    );

    return {
      ...person,
      circleName: circle.name,
      circleSlug: circle.slug,
      circleColor: circle.colorToken,
      cadence,
      lastInteraction,
      lastInteractionLine: formatLastInteractionLine(lastInteraction),
      lifeDates: personLifeDates,
      upcomingLifeDate,
      meetupPrompt: generateMeetupPrompt(
        person,
        circle,
        lastInteraction,
        upcomingLifeDate
      ),
      interactionCount: personInteractions.length
    };
  });
}

export function buildWeeklyRitual(
  enrichedPeople: PersonEnriched[],
  referenceDateStr: string,
  limit = 3
): WeeklyRitualResponse {
  const { items, totalOverdueCount, snoozedCount } = selectWeeklyRitual(
    enrichedPeople,
    limit
  );

  const upcomingLifeDates: UpcomingLifeDateItem[] = [];
  for (const p of enrichedPeople) {
    if (p.archived) continue;
    for (const ld of p.lifeDates) {
      if (ld.daysUntil != null && ld.daysUntil >= 0 && ld.daysUntil <= 30) {
        upcomingLifeDates.push({
          ...ld,
          personName: p.name,
          circleName: p.circleName,
          circleColor: p.circleColor
        });
      }
    }
  }

  upcomingLifeDates.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));

  return {
    referenceDate: referenceDateStr,
    items,
    totalOverdueCount,
    snoozedCount,
    upcomingLifeDates
  };
}

export function buildRecentInteractions(
  db: Database.Database,
  limit = 40
): RecentInteractionItem[] {
  const circles = listCircles(db);
  const circleMap = new Map(circles.map((c) => [c.id, c]));
  const people = listPeopleRecords(db, true);
  const peopleMap = new Map(people.map((p) => [p.id, p]));

  const rows = db
    .prepare(
      'SELECT * FROM interactions ORDER BY occurred_at DESC, created_at DESC LIMIT ?'
    )
    .all(limit) as InteractionRow[];

  return rows.map((row) => {
    const inter = mapInteractionRow(row);
    const person = peopleMap.get(inter.personId);
    const circle = person ? circleMap.get(person.circleId) : undefined;
    return {
      ...inter,
      personName: person?.name ?? 'Unknown',
      circleName: circle?.name ?? 'Circle',
      circleColor: circle?.colorToken ?? 'amber'
    };
  });
}

export function buildWorkspaceStats(
  db: Database.Database,
  dbPath: string
): WorkspaceStats {
  const circleCount = (
    db.prepare('SELECT COUNT(*) AS count FROM circles').get() as { count: number }
  ).count;
  const peopleCount = (
    db.prepare('SELECT COUNT(*) AS count FROM people WHERE archived = 0').get() as {
      count: number;
    }
  ).count;
  const interactionCount = (
    db.prepare('SELECT COUNT(*) AS count FROM interactions').get() as {
      count: number;
    }
  ).count;
  const lifeDateCount = (
    db.prepare('SELECT COUNT(*) AS count FROM life_dates').get() as {
      count: number;
    }
  ).count;

  let dbSizeBytes = 0;
  if (dbPath !== ':memory:') {
    try {
      dbSizeBytes = fs.statSync(dbPath).size;
    } catch {
      dbSizeBytes = 0;
    }
  }

  const sampleMeta = getMeta(db, 'sample_data_enabled');
  const sampleCount = (
    db.prepare('SELECT COUNT(*) AS count FROM people WHERE is_sample = 1').get() as {
      count: number;
    }
  ).count;

  return {
    dbPath,
    dbSizeBytes,
    circleCount,
    peopleCount,
    interactionCount,
    lifeDateCount,
    sampleDataEnabled: sampleMeta === 'true' || sampleCount > 0
  };
}

export function buildBootstrapResponse(
  db: Database.Database,
  dbPath: string,
  referenceDateStr: string = todayLocalISO()
): BootstrapResponse {
  const circles = listCircles(db);
  const people = buildEnrichedPeople(db, referenceDateStr, false);
  const ritual = buildWeeklyRitual(people, referenceDateStr, 3);
  const recentInteractions = buildRecentInteractions(db, 40);
  const stats = buildWorkspaceStats(db, dbPath);

  return {
    referenceDate: referenceDateStr,
    circles,
    people,
    ritual,
    recentInteractions,
    stats
  };
}
