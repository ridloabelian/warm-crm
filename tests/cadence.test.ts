import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  daysUntilLifeDate,
  diffCalendarDays
} from '../src/shared/dates.js';
import { computeCadenceMetrics } from '../src/server/domain/cadence.js';
import type { Circle, Interaction, PersonRecord } from '../src/shared/types.js';

const baseCircle: Circle = {
  id: 'circle-close-15',
  name: 'Close 15',
  slug: 'close-15',
  cadenceDays: 30,
  targetSize: 15,
  description: '',
  colorToken: 'amber',
  sortOrder: 2,
  createdAt: '2026-01-01'
};

function makePerson(overrides: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id: 'p1',
    name: 'Arif Pratama',
    nickname: '',
    circleId: 'circle-close-15',
    customCadenceDays: null,
    city: 'Brooklyn',
    neighborhood: 'Park Slope',
    howWeMet: '',
    sharedInterests: [],
    preferredVibe: '',
    pinnedContext: '',
    snoozedUntil: null,
    archived: false,
    isSample: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides
  };
}

function makeInteraction(occurredAt: string): Interaction {
  return {
    id: 'i1',
    personId: 'p1',
    occurredAt,
    kind: 'meal',
    location: '',
    summary: 'Had dinner',
    followUp: '',
    rawInput: '',
    createdAt: occurredAt
  };
}

describe('calendar dates and life dates', () => {
  it('computes calendar day differences accurately across month/year boundaries', () => {
    expect(diffCalendarDays('2026-12-28', '2027-01-04')).toBe(7);
    expect(addCalendarDays('2026-11-24', -14)).toBe('2026-11-10');
  });

  it('handles annual recurring life dates wrapping across New Year', () => {
    const days = daysUntilLifeDate(
      { dateMonth: 1, dateDay: 4, dateYear: null, recurringAnnual: true },
      '2026-12-28'
    );
    expect(days).toBe(7);
  });

  it('clamps Feb 29 recurring birthdays cleanly on non-leap years', () => {
    const days = daysUntilLifeDate(
      { dateMonth: 2, dateDay: 29, dateYear: 1996, recurringAnnual: true },
      '2026-02-20'
    );
    expect(days).toBe(8);
  });
});

describe('cadence calculation & warmth decay', () => {
  it('computes warm, due-soon, overdue, and drifting bands from circle cadence', () => {
    const person = makePerson();

    const warm = computeCadenceMetrics(
      person,
      baseCircle,
      makeInteraction('2026-11-14'),
      '2026-11-24'
    );
    expect(warm.daysSinceLastContact).toBe(10);
    expect(warm.overdueDays).toBe(-20);
    expect(warm.isOverdue).toBe(false);
    expect(warm.status).toBe('warm');
    expect(warm.warmthScore).toBeGreaterThan(75);

    const dueSoon = computeCadenceMetrics(
      person,
      baseCircle,
      makeInteraction('2026-10-30'),
      '2026-11-24'
    );
    expect(dueSoon.daysSinceLastContact).toBe(25);
    expect(dueSoon.isOverdue).toBe(false);
    expect(dueSoon.status).toBe('due-soon');

    const overdue = computeCadenceMetrics(
      person,
      baseCircle,
      makeInteraction('2026-10-12'),
      '2026-11-24'
    );
    expect(overdue.daysSinceLastContact).toBe(43);
    expect(overdue.overdueDays).toBe(13);
    expect(overdue.isOverdue).toBe(true);
    expect(overdue.status).toBe('overdue');
    expect(overdue.warmthScore).toBeLessThan(50);

    const drifting = computeCadenceMetrics(
      person,
      baseCircle,
      makeInteraction('2026-07-01'),
      '2026-11-24'
    );
    expect(drifting.status).toBe('drifting');
    expect(drifting.warmthScore).toBe(5); // floor respected
  });

  it('uses person customCadenceDays instead of circle default when set', () => {
    const person = makePerson({ customCadenceDays: 7 });
    const metrics = computeCadenceMetrics(
      person,
      baseCircle,
      makeInteraction('2026-11-12'),
      '2026-11-24'
    );
    expect(metrics.effectiveCadenceDays).toBe(7);
    expect(metrics.daysSinceLastContact).toBe(12);
    expect(metrics.overdueDays).toBe(5);
    expect(metrics.isOverdue).toBe(true);
  });

  it('tracks snoozed state cleanly', () => {
    const snoozed = computeCadenceMetrics(
      makePerson({ snoozedUntil: '2026-12-01' }),
      baseCircle,
      makeInteraction('2026-10-01'),
      '2026-11-24'
    );
    expect(snoozed.isSnoozed).toBe(true);

    const expiredSnooze = computeCadenceMetrics(
      makePerson({ snoozedUntil: '2026-11-24' }),
      baseCircle,
      makeInteraction('2026-10-01'),
      '2026-11-24'
    );
    expect(expiredSnooze.isSnoozed).toBe(false);
  });
});
