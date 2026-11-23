import type { PersonEnriched } from '../../shared/types.js';

export function selectWeeklyRitual(
  people: PersonEnriched[],
  limit = 3
): {
  items: PersonEnriched[];
  totalOverdueCount: number;
  snoozedCount: number;
} {
  const active = people.filter((p) => !p.archived);
  const snoozedCount = active.filter((p) => p.cadence.isSnoozed).length;
  const overdue = active.filter(
    (p) => !p.cadence.isSnoozed && p.cadence.isOverdue
  );

  const sorted = [...overdue].sort((a, b) => {
    if (a.cadence.warmthScore !== b.cadence.warmthScore) {
      return a.cadence.warmthScore - b.cadence.warmthScore;
    }

    const aUpcoming =
      a.upcomingLifeDate?.daysUntil != null && a.upcomingLifeDate.daysUntil <= 14
        ? 1
        : 0;
    const bUpcoming =
      b.upcomingLifeDate?.daysUntil != null && b.upcomingLifeDate.daysUntil <= 14
        ? 1
        : 0;
    if (aUpcoming !== bUpcoming) {
      return bUpcoming - aUpcoming;
    }

    if (a.cadence.effectiveCadenceDays !== b.cadence.effectiveCadenceDays) {
      return a.cadence.effectiveCadenceDays - b.cadence.effectiveCadenceDays;
    }

    if (a.cadence.overdueDays !== b.cadence.overdueDays) {
      return b.cadence.overdueDays - a.cadence.overdueDays;
    }

    return a.name.localeCompare(b.name);
  });

  return {
    items: sorted.slice(0, Math.max(0, limit)),
    totalOverdueCount: overdue.length,
    snoozedCount
  };
}
