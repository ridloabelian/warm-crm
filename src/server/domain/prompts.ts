import { formatShortMonthDay } from '../../shared/dates.js';
import type {
  Circle,
  Interaction,
  LifeDate,
  MeetupPrompt,
  PersonRecord
} from '../../shared/types.js';

function firstName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length >= 2 && /^(aunt|auntie|uncle|cousin|mom|dad)$/i.test(tokens[0])) {
    return `${tokens[0]} ${tokens[1]}`;
  }
  return tokens[0] || fullName;
}

function wherePhrase(neighborhood: string, city: string): string {
  if (neighborhood.trim() && city.trim()) {
    return `around ${neighborhood.trim()} (${city.trim()})`;
  }
  if (neighborhood.trim()) {
    return `around ${neighborhood.trim()}`;
  }
  if (city.trim()) {
    return `in ${city.trim()}`;
  }
  return '';
}

function hasAny(haystack: string[], keywords: string[]): boolean {
  const joined = haystack.join(' ').toLowerCase();
  return keywords.some((kw) => joined.includes(kw));
}

export function generateMeetupPrompt(
  person: Pick<
    PersonRecord,
    'name' | 'city' | 'neighborhood' | 'sharedInterests' | 'preferredVibe'
  >,
  circle: Pick<Circle, 'slug' | 'name'>,
  lastInteraction: Interaction | null,
  upcomingLifeDate: LifeDate | null
): MeetupPrompt {
  const shortName = firstName(person.name);
  const place = wherePhrase(person.neighborhood, person.city);
  const interests = person.sharedInterests;
  const vibe = person.preferredVibe.toLowerCase();
  const signals = [...interests, person.preferredVibe];

  let activityIdea: string;
  if (vibe.includes('call') || vibe.includes('phone') || vibe.includes('sunday')) {
    activityIdea = `Unhurried Sunday phone walk — put headphones in and catch up with ${shortName} for 20 minutes`;
  } else if (hasAny(signals, ['pottery', 'ceramic', 'art', 'gallery', 'museum'])) {
    activityIdea = place
      ? `Grab a slow coffee and wander a local gallery or studio ${place}`
      : `Grab a slow coffee and check out a neighborhood gallery or open studio`;
  } else if (hasAny(signals, ['coffee', 'espresso', 'pour-over', 'tea', 'matcha', 'cafe'])) {
    activityIdea = place
      ? `Low-key morning coffee or tea at a favorite spot ${place}`
      : `Low-key morning coffee or tea at a quiet corner table`;
  } else if (hasAny(signals, ['walk', 'hike', 'park', 'trail', 'dog', 'running'])) {
    activityIdea = place
      ? `Casual 30-minute neighborhood walk ${place} — no reservations needed`
      : `Casual 30-minute loop walk in a nearby park`;
  } else if (hasAny(signals, ['ramen', 'dinner', 'cooking', 'bake', 'food', 'tacos'])) {
    activityIdea = place
      ? `Weeknight noodles or an easy casual dinner ${place}`
      : `Easy weeknight dinner or home-cooked meal together`;
  } else if (hasAny(signals, ['book', 'reading', 'vinyl', 'record'])) {
    activityIdea = place
      ? `Browse a neighborhood bookstore or record shop ${place}, then grab tea`
      : `Browse an indie bookstore or record shop together`;
  } else if (circle.slug === 'family') {
    activityIdea = `Low-pressure Sunday check-in call or drop-by tea with ${shortName}`;
  } else {
    activityIdea = place
      ? `Quick coffee or a 25-minute walk ${place}`
      : `Low-pressure coffee or a short neighborhood walk`;
  }

  const rationaleBits: string[] = [];
  if (person.neighborhood.trim()) {
    rationaleBits.push(`${person.neighborhood.trim()} neighborhood`);
  } else if (person.city.trim()) {
    rationaleBits.push(person.city.trim());
  }
  if (interests.length > 0) {
    rationaleBits.push(interests.slice(0, 2).join(' & '));
  } else if (person.preferredVibe.trim()) {
    rationaleBits.push(person.preferredVibe.trim());
  }
  const rationale =
    rationaleBits.length > 0
      ? `Tailored to ${rationaleBits.join(' · ')}`
      : `Simple offline catch-up idea for ${circle.name}`;

  const starters: string[] = [];

  if (upcomingLifeDate && upcomingLifeDate.daysUntil != null && upcomingLifeDate.daysUntil <= 21) {
    const dateLabel = formatShortMonthDay(
      upcomingLifeDate.dateMonth,
      upcomingLifeDate.dateDay
    );
    starters.push(
      `Hey ${shortName}! Saw ${upcomingLifeDate.label.toLowerCase()} (${dateLabel}) is coming up — would love to catch up properly soon if you're free.`
    );
  }

  if (lastInteraction?.followUp.trim()) {
    starters.push(
      `Hey ${shortName}, been thinking of you — wanted to check in on ${lastInteraction.followUp
        .trim()
        .replace(/^[A-Z]/, (c) => c.toLowerCase())
        .replace(/^(ask|check in on)\s+/i, '')}.`
    );
  }

  if (vibe.includes('call') || circle.slug === 'family') {
    starters.push(
      `Hey ${shortName}! Free for a relaxed 15-minute phone walk sometime this weekend? Would love to hear how things are going.`
    );
  } else if (person.neighborhood.trim()) {
    starters.push(
      `Hey ${shortName} — I'll be around ${person.neighborhood.trim()} this week. Want to grab a quick coffee or go for a walk if you have 30 minutes?`
    );
  } else {
    starters.push(
      `Hey ${shortName}! Been a minute — want to grab a casual coffee or take a walk sometime this week? Zero rush if you're swamped.`
    );
  }

  if (starters.length < 2 && interests.length > 0) {
    starters.push(
      `Hey ${shortName}, something reminded me of ${interests[0].toLowerCase()} today — let's catch up soon!`
    );
  }

  return {
    activityIdea,
    rationale,
    starters: starters.slice(0, 3)
  };
}
