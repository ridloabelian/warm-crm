import { diffCalendarDays, formatShortISODate } from '../../shared/dates.js';
import type {
  CadenceMetrics,
  Circle,
  Interaction,
  InteractionKind,
  PersonRecord,
  WarmthStatus
} from '../../shared/types.js';

export function computeCadenceMetrics(
  person: Pick<PersonRecord, 'customCadenceDays' | 'snoozedUntil' | 'createdAt'>,
  circle: Pick<Circle, 'cadenceDays'>,
  lastInteraction: Pick<Interaction, 'occurredAt'> | null,
  referenceDateStr: string
): CadenceMetrics {
  const effectiveCadenceDays = Math.max(
    1,
    person.customCadenceDays ?? circle.cadenceDays
  );

  const isSnoozed = Boolean(
    person.snoozedUntil &&
      diffCalendarDays(referenceDateStr, person.snoozedUntil) > 0
  );

  if (lastInteraction) {
    const daysSinceLastContact = Math.max(
      0,
      diffCalendarDays(lastInteraction.occurredAt, referenceDateStr)
    );
    const overdueDays = daysSinceLastContact - effectiveCadenceDays;
    const daysUntilDue = effectiveCadenceDays - daysSinceLastContact;
    const elapsedRatio = daysSinceLastContact / effectiveCadenceDays;

    let warmthScore: number;
    if (elapsedRatio <= 1) {
      warmthScore = Math.round(100 - 50 * elapsedRatio);
    } else {
      warmthScore = Math.max(5, Math.round(50 - 30 * (elapsedRatio - 1)));
    }

    let status: WarmthStatus;
    if (elapsedRatio < 0.75) {
      status = 'warm';
    } else if (elapsedRatio <= 1.0) {
      status = 'due-soon';
    } else if (elapsedRatio <= 1.75) {
      status = 'overdue';
    } else {
      status = 'drifting';
    }

    return {
      effectiveCadenceDays,
      daysSinceLastContact,
      overdueDays,
      daysUntilDue,
      warmthScore,
      status,
      isOverdue: overdueDays > 0,
      isSnoozed
    };
  }

  const daysSinceAdded = Math.max(
    0,
    diffCalendarDays(person.createdAt.slice(0, 10), referenceDateStr)
  );
  if (daysSinceAdded >= effectiveCadenceDays) {
    return {
      effectiveCadenceDays,
      daysSinceLastContact: null,
      overdueDays: daysSinceAdded - effectiveCadenceDays + 1,
      daysUntilDue: effectiveCadenceDays - daysSinceAdded,
      warmthScore: 35,
      status: 'overdue',
      isOverdue: true,
      isSnoozed
    };
  }

  return {
    effectiveCadenceDays,
    daysSinceLastContact: null,
    overdueDays: 0,
    daysUntilDue: effectiveCadenceDays - daysSinceAdded,
    warmthScore: 70,
    status: 'new',
    isOverdue: false,
    isSnoozed
  };
}

function kindPhrase(kind: InteractionKind): string {
  switch (kind) {
    case 'coffee':
      return 'met for coffee';
    case 'meal':
      return 'shared a meal';
    case 'walk':
      return 'went for a walk';
    case 'call':
      return 'caught up by phone';
    case 'visit':
      return 'visited';
    case 'meetup':
      return 'caught up';
    case 'note':
    default:
      return 'noted';
  }
}

function formatSnippet(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return '';
  if (trimmed.length >= 2 && trimmed[0] === 'I' && trimmed[1] === ' ') {
    return trimmed;
  }
  if (
    trimmed.length >= 2 &&
    /[A-Z]/.test(trimmed[0]) &&
    /[a-z]/.test(trimmed[1])
  ) {
    return trimmed[0].toLowerCase() + trimmed.slice(1);
  }
  return trimmed;
}

export function formatLastInteractionLine(
  lastInteraction: Interaction | null
): string {
  if (!lastInteraction) {
    return 'No catch-ups logged yet — add a quick memory whenever you connect.';
  }

  const parts: string[] = [`Last ${kindPhrase(lastInteraction.kind)}`];
  if (lastInteraction.location.trim()) {
    parts.push(`at ${lastInteraction.location.trim()}`);
  }
  parts.push(formatShortISODate(lastInteraction.occurredAt));

  const snippet = formatSnippet(lastInteraction.summary);
  if (snippet) {
    return `${parts.join(' ')} — ${snippet}`;
  }
  return parts.join(' ');
}
