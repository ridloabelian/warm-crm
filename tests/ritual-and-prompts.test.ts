import { describe, expect, it } from 'vitest';
import { formatLastInteractionLine } from '../src/server/domain/cadence.js';
import { generateMeetupPrompt } from '../src/server/domain/prompts.js';
import { selectWeeklyRitual } from '../src/server/domain/ritual.js';
import type { Interaction, PersonEnriched } from '../src/shared/types.js';

function makeEnriched(
  id: string,
  name: string,
  warmthScore: number,
  options: {
    isOverdue?: boolean;
    isSnoozed?: boolean;
    archived?: boolean;
    cadenceDays?: number;
    overdueDays?: number;
    upcomingDaysUntil?: number | null;
  } = {}
): PersonEnriched {
  const cadenceDays = options.cadenceDays ?? 30;
  return {
    id,
    name,
    nickname: '',
    circleId: 'c1',
    customCadenceDays: null,
    city: 'Portland',
    neighborhood: 'Division',
    howWeMet: '',
    sharedInterests: ['pottery', 'pour-over coffee'],
    preferredVibe: '',
    pinnedContext: '',
    snoozedUntil: null,
    archived: options.archived ?? false,
    isSample: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    circleName: 'Close 15',
    circleSlug: 'close-15',
    circleColor: 'amber',
    cadence: {
      effectiveCadenceDays: cadenceDays,
      daysSinceLastContact: 40,
      overdueDays: options.overdueDays ?? 10,
      daysUntilDue: -10,
      warmthScore,
      status: 'overdue',
      isOverdue: options.isOverdue ?? true,
      isSnoozed: options.isSnoozed ?? false
    },
    lastInteraction: null,
    lastInteractionLine: 'No catch-ups logged yet.',
    lifeDates: [],
    upcomingLifeDate:
      options.upcomingDaysUntil != null
        ? {
            id: 'ld1',
            personId: id,
            label: 'Birthday',
            dateMonth: 11,
            dateDay: 30,
            dateYear: null,
            recurringAnnual: true,
            note: '',
            daysUntil: options.upcomingDaysUntil,
            formattedDate: 'Nov 30'
          }
        : null,
    meetupPrompt: {
      activityIdea: '',
      rationale: '',
      starters: []
    },
    interactionCount: 1
  };
}

describe('weekly ritual prioritization', () => {
  it('surfaces at most 3 overdue people ordered by warmth decay and excludes snoozed/warm/archived', () => {
    const people: PersonEnriched[] = [
      makeEnriched('p1', 'Warm Friend', 85, { isOverdue: false }),
      makeEnriched('p2', 'Snoozed Friend', 10, { isSnoozed: true }),
      makeEnriched('p3', 'Archived Friend', 5, { archived: true }),
      makeEnriched('p4', 'Mildly Overdue', 42),
      makeEnriched('p5', 'Most Decayed', 18),
      makeEnriched('p6', 'Second Decayed', 29),
      makeEnriched('p7', 'Third Decayed', 35)
    ];

    const result = selectWeeklyRitual(people, 3);
    expect(result.totalOverdueCount).toBe(4);
    expect(result.snoozedCount).toBe(1);
    expect(result.items.map((p) => p.name)).toEqual([
      'Most Decayed',
      'Second Decayed',
      'Third Decayed'
    ]);
  });

  it('uses upcoming life date within 14 days to break warmth score ties', () => {
    const a = makeEnriched('p1', 'Alex', 30, { upcomingDaysUntil: null });
    const b = makeEnriched('p2', 'Bella', 30, { upcomingDaysUntil: 5 });

    const result = selectWeeklyRitual([a, b], 3);
    expect(result.items[0].name).toBe('Bella');
  });
});

describe('interaction context formatting & low-pressure IRL prompts', () => {
  it('formats natural memory line with venue, date, and lowercase summary', () => {
    const interaction: Interaction = {
      id: 'i1',
      personId: 'p1',
      occurredAt: '2026-10-12',
      kind: 'coffee',
      location: 'Heart Roasters',
      summary: "Talked about her new pottery studio and dad's surgery",
      followUp: '',
      rawInput: '',
      createdAt: '2026-10-12'
    };

    expect(formatLastInteractionLine(interaction)).toBe(
      "Last met for coffee at Heart Roasters Oct 12 — talked about her new pottery studio and dad's surgery"
    );
  });

  it('generates grounded IRL suggestions without robotic copy', () => {
    const prompt = generateMeetupPrompt(
      {
        name: 'Maya Lin',
        city: 'Portland',
        neighborhood: 'Division',
        sharedInterests: ['pottery', 'pour-over coffee'],
        preferredVibe: ''
      },
      { slug: 'inner-5', name: 'Inner 5' },
      {
        id: 'i1',
        personId: 'p1',
        occurredAt: '2026-10-12',
        kind: 'coffee',
        location: 'Heart Roasters',
        summary: 'Talked about ceramics',
        followUp: "Ask how her dad's physical therapy is going",
        rawInput: '',
        createdAt: '2026-10-12'
      },
      {
        id: 'ld1',
        personId: 'p1',
        label: 'Birthday',
        dateMonth: 11,
        dateDay: 30,
        dateYear: null,
        recurringAnnual: true,
        note: '',
        daysUntil: 6,
        formattedDate: 'Nov 30'
      }
    );

    expect(prompt.activityIdea.toLowerCase()).toContain('division');
    expect(prompt.rationale).toContain('Division');
    expect(prompt.starters.length).toBeGreaterThanOrEqual(2);
    expect(prompt.starters.join(' ')).toContain('Maya');
  });
});
