import {
  addCalendarDays,
  clampDayToMonth,
  dayOfWeekUTC,
  diffCalendarDays,
  formatYMD,
  isValidISODate,
  parseISODateParts,
  todayLocalISO
} from './dates.js';
import type {
  InteractionKind,
  PersonRecord,
  QuickLogParseResult
} from './types.js';

export type QuickLogPersonCandidate = Pick<
  PersonRecord,
  'id' | 'name' | 'nickname' | 'archived'
>;

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const NON_LOCATION_WORDS = new Set([
  'coffee',
  'tea',
  'matcha',
  'espresso',
  'latte',
  'dinner',
  'lunch',
  'brunch',
  'breakfast',
  'supper',
  'drinks',
  'ramen',
  'tacos',
  'pizza',
  'meal',
  'walk',
  'phone',
  'call',
  'facetime',
  'home',
  'town',
  'work',
  'today',
  'yesterday',
  'tonight',
  'morning',
  'afternoon',
  'evening',
  'person',
  'irl',
  'jan',
  'january',
  'feb',
  'february',
  'mar',
  'march',
  'apr',
  'april',
  'may',
  'jun',
  'june',
  'jul',
  'july',
  'aug',
  'august',
  'sep',
  'sept',
  'september',
  'oct',
  'october',
  'nov',
  'november',
  'dec',
  'december',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]);

const NON_PERSON_LEADING_WORDS = new Set([
  'had',
  'met',
  'called',
  'saw',
  'visited',
  'walked',
  'caught',
  'coffee',
  'dinner',
  'lunch',
  'brunch',
  'breakfast',
  'walk',
  'call',
  'phone',
  'long',
  'quick',
  'short',
  'today',
  'yesterday',
  'grabbed',
  'shared',
  'talked',
  'spoke',
  'dropped',
  'stopped',
  'hosted',
  'went',
  'at',
  'in',
  'on',
  'with'
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitHeaderAndBody(raw: string): {
  header: string;
  body: string;
  hasExplicitSplit: boolean;
} {
  const separators = [/\s+[—–]\s+/, /\s+--\s+/, /\s+-\s+/, /:\s+/];
  let bestIndex = -1;
  let bestLength = 0;

  for (const sep of separators) {
    const match = sep.exec(raw);
    if (match && (bestIndex === -1 || match.index < bestIndex)) {
      bestIndex = match.index;
      bestLength = match[0].length;
    }
  }

  if (bestIndex === -1) {
    return { header: raw.trim(), body: '', hasExplicitSplit: false };
  }

  return {
    header: raw.slice(0, bestIndex).trim(),
    body: raw.slice(bestIndex + bestLength).trim(),
    hasExplicitSplit: true
  };
}

function detectKind(text: string): InteractionKind {
  const lower = text.toLowerCase();
  if (/\b(coffee|espresso|latte|tea|matcha|cafe|café)\b/.test(lower)) {
    return 'coffee';
  }
  if (
    /\b(dinner|lunch|brunch|breakfast|meal|ramen|tacos|drinks|supper|pizza|bite)\b/.test(
      lower
    )
  ) {
    return 'meal';
  }
  if (/\b(walk|walked|stroll|hike|hiked|run|ran|jog)\b/.test(lower)) {
    return 'walk';
  }
  if (/\b(call|called|phone|facetime|voice|rang|spoke)\b/.test(lower)) {
    return 'call';
  }
  if (/\b(visit|visited|dropped by|stopped by|hosted|house)\b/.test(lower)) {
    return 'visit';
  }
  if (/\b(met|caught up|hung out|meetup|saw)\b/.test(lower)) {
    return 'meetup';
  }
  return 'note';
}

function extractOccurredAt(
  header: string,
  fullText: string,
  referenceDateStr: string
): string {
  const target = `${header} ${fullText}`;

  const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(target);
  if (isoMatch && isValidISODate(isoMatch[1])) {
    return isoMatch[1];
  }

  if (/\b(yesterday|last night)\b/i.test(header) || /\b(yesterday|last night)\b/i.test(fullText)) {
    return addCalendarDays(referenceDateStr, -1);
  }

  const daysAgoMatch = /\b(\d{1,3})\s+days?\s+ago\b/i.exec(target);
  if (daysAgoMatch) {
    const n = Number(daysAgoMatch[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 3650) {
      return addCalendarDays(referenceDateStr, -n);
    }
  }

  const monthDayRegex =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i;
  const monthMatch = monthDayRegex.exec(header) ?? monthDayRegex.exec(fullText);
  if (monthMatch) {
    const monthKey = monthMatch[1].toLowerCase().replace(/\.$/, '');
    const month = MONTH_MAP[monthKey];
    const rawDay = Number(monthMatch[2]);
    const refParts = parseISODateParts(referenceDateStr);
    if (month && rawDay >= 1 && rawDay <= 31) {
      if (monthMatch[3]) {
        const explicitYear = Number(monthMatch[3]);
        const day = clampDayToMonth(explicitYear, month, rawDay);
        return formatYMD(explicitYear, month, day);
      }
      const candidateThisYear = formatYMD(
        refParts.year,
        month,
        clampDayToMonth(refParts.year, month, rawDay)
      );
      if (diffCalendarDays(referenceDateStr, candidateThisYear) > 0) {
        const prevYear = refParts.year - 1;
        return formatYMD(
          prevYear,
          month,
          clampDayToMonth(prevYear, month, rawDay)
        );
      }
      return candidateThisYear;
    }
  }

  const weekdayMatch =
    /\b(?:on|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(
      header
    );
  if (weekdayMatch) {
    const desiredDow = WEEKDAY_MAP[weekdayMatch[1].toLowerCase()];
    const currentDow = dayOfWeekUTC(referenceDateStr);
    let diff = (currentDow - desiredDow + 7) % 7;
    if (diff === 0) diff = 7;
    return addCalendarDays(referenceDateStr, -diff);
  }

  if (/\b(today|this morning|this afternoon|tonight)\b/i.test(target)) {
    return referenceDateStr;
  }

  return referenceDateStr;
}

function stripTrailingDateTokens(venue: string): string {
  return venue
    .replace(
      /\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?$/i,
      ''
    )
    .replace(/\s+\d{4}-\d{2}-\d{2}$/, '')
    .replace(/\s+\d{1,3}\s+days?\s+ago$/i, '')
    .replace(/\s+(?:today|yesterday|last night|tonight|this morning)$/i, '')
    .replace(/\s+(?:on|last)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i, '')
    .trim();
}

function extractLocation(header: string): string {
  const prepRegex =
    /\b(?:at|in)\s+([A-Za-z0-9'’&.\-]+(?:\s+[A-Za-z0-9'’&.\-]+){0,4})/gi;

  let match: RegExpExecArray | null;
  while ((match = prepRegex.exec(header)) !== null) {
    let candidate = match[1]
      .replace(
        /\s+\b(?:with|for|about|to|on|and)\b.*$/i,
        ''
      )
      .trim();
    candidate = stripTrailingDateTokens(candidate);
    if (!candidate) continue;

    const words = candidate.split(/\s+/).filter(Boolean);
    const cleanedWords = words.filter(
      (w) => !/^(?:the|a|an)$/i.test(w)
    );
    if (cleanedWords.length === 0) continue;

    const firstLower = cleanedWords[0].toLowerCase().replace(/[.,!?]+$/, '');
    if (cleanedWords.length === 1 && NON_LOCATION_WORDS.has(firstLower)) {
      continue;
    }

    const allNonLocation = cleanedWords.every((w) =>
      NON_LOCATION_WORDS.has(w.toLowerCase().replace(/[.,!?]+$/, ''))
    );
    if (allNonLocation) continue;

    // Require at least one capitalized word (proper venue/neighborhood name)
    const hasCapitalized = cleanedWords.some((w) => /^[A-Z]/.test(w));
    if (!hasCapitalized) continue;

    return candidate.replace(/[.,;!?]+$/, '').trim();
  }

  return '';
}

function matchWordPhrase(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(trimmed.toLowerCase())}(?:'s|’s)?(?:$|[^a-z0-9])`,
    'i'
  );
  return pattern.test(haystack.toLowerCase());
}

function matchPerson(
  header: string,
  fullText: string,
  people: QuickLogPersonCandidate[]
): {
  matchedPersonId: string | null;
  matchedPersonName: string | null;
  confidence: 'exact' | 'partial' | 'unmatched';
} {
  const activeFirst = [...people].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return b.name.length - a.name.length;
  });

  const searchSpaces = [header, fullText];

  // 1. Exact full-name or nickname match
  for (const space of searchSpaces) {
    for (const p of activeFirst) {
      if (matchWordPhrase(space, p.name)) {
        return {
          matchedPersonId: p.id,
          matchedPersonName: p.name,
          confidence: 'exact'
        };
      }
      if (p.nickname.trim() && matchWordPhrase(space, p.nickname)) {
        return {
          matchedPersonId: p.id,
          matchedPersonName: p.name,
          confidence: 'exact'
        };
      }
    }
  }

  // 2. First-name (or primary token) match
  for (const space of searchSpaces) {
    const firstNameMatches: QuickLogPersonCandidate[] = [];
    for (const p of activeFirst) {
      const tokens = p.name.trim().split(/\s+/);
      const primaryToken =
        tokens.length >= 2 && /^(aunt|auntie|uncle|cousin|dr\.?)$/i.test(tokens[0])
          ? `${tokens[0]} ${tokens[1]}`
          : tokens[0];
      if (primaryToken && primaryToken.length >= 2 && matchWordPhrase(space, primaryToken)) {
        firstNameMatches.push(p);
      }
    }
    if (firstNameMatches.length === 1) {
      return {
        matchedPersonId: firstNameMatches[0].id,
        matchedPersonName: firstNameMatches[0].name,
        confidence: 'exact'
      };
    }
    if (firstNameMatches.length > 1) {
      return {
        matchedPersonId: firstNameMatches[0].id,
        matchedPersonName: firstNameMatches[0].name,
        confidence: 'partial'
      };
    }
  }

  return {
    matchedPersonId: null,
    matchedPersonName: null,
    confidence: 'unmatched'
  };
}

function extractCandidatePersonName(header: string): string | null {
  const prepPattern =
    /\b(?:with|called|met|saw|visited|rang|texted|hosted|for)\s+([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)/;
  const prepMatch = prepPattern.exec(header);
  if (prepMatch) {
    const cleaned = prepMatch[1]
      .replace(/\s+\b(?:at|in|on|yesterday|today|last)\b.*$/i, '')
      .trim();
    if (cleaned && !NON_LOCATION_WORDS.has(cleaned.toLowerCase())) {
      return cleaned;
    }
  }

  const leadingPattern =
    /^([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)(?:\s|$)/;
  const leadingMatch = leadingPattern.exec(header.trim());
  if (leadingMatch) {
    const firstWord = leadingMatch[1].split(/\s+/)[0].toLowerCase();
    if (!NON_PERSON_LEADING_WORDS.has(firstWord)) {
      return leadingMatch[1].trim();
    }
  }

  return null;
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractFollowUpAndSummary(
  body: string,
  header: string,
  hasExplicitSplit: boolean
): { summary: string; followUp: string } {
  const rawBody = hasExplicitSplit ? body : header;
  const followUpRegex =
    /(?:^|[.;])\s*(?:follow[- ]?up|next time|remember to)\s*:\s*(.+)$/i;
  const match = followUpRegex.exec(rawBody);

  let followUp = '';
  let mainText = rawBody;
  if (match) {
    followUp = sentenceCase(match[1].replace(/[.;\s]+$/, ''));
    mainText = rawBody.slice(0, match.index).trim();
  }

  const summary = sentenceCase(mainText) || sentenceCase(header);
  return { summary, followUp };
}

export function parseQuickLog(
  rawText: string,
  people: QuickLogPersonCandidate[],
  referenceDateStr: string = todayLocalISO()
): QuickLogParseResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      matchedPersonId: null,
      matchedPersonName: null,
      candidatePersonName: null,
      kind: 'note',
      occurredAt: referenceDateStr,
      location: '',
      summary: '',
      followUp: '',
      confidence: 'unmatched'
    };
  }

  const { header, body, hasExplicitSplit } = splitHeaderAndBody(trimmed);
  const kind = detectKind(header || trimmed);
  const occurredAt = extractOccurredAt(header, trimmed, referenceDateStr);
  const location = extractLocation(header);
  const personMatch = matchPerson(header, trimmed, people);
  const candidatePersonName = personMatch.matchedPersonId
    ? null
    : extractCandidatePersonName(header);
  const { summary, followUp } = extractFollowUpAndSummary(
    body,
    header,
    hasExplicitSplit
  );

  return {
    matchedPersonId: personMatch.matchedPersonId,
    matchedPersonName: personMatch.matchedPersonName,
    candidatePersonName,
    kind,
    occurredAt,
    location,
    summary,
    followUp,
    confidence: personMatch.confidence
  };
}
