import { describe, expect, it } from 'vitest';
import {
  parseQuickLog,
  type QuickLogPersonCandidate
} from '../src/shared/quickLogParser.js';

const samplePeople: QuickLogPersonCandidate[] = [
  { id: 'p-maya', name: 'Maya Lin', nickname: 'May', archived: false },
  { id: 'p-arif', name: 'Arif Pratama', nickname: '', archived: false },
  { id: 'p-elena', name: 'Auntie Elena', nickname: 'Tita Elena', archived: false },
  { id: 'p-jonah', name: 'Jonah Reyes', nickname: '', archived: false },
  { id: 'p-samira', name: 'Samira Patel', nickname: 'Sam', archived: false }
];

describe('Quick Log natural-language parser', () => {
  const refDate = '2026-11-24';

  it('parses the Arif dinner example accurately', () => {
    const parsed = parseQuickLog(
      "Had dinner with Arif — he's moving apartments next month",
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBe('p-arif');
    expect(parsed.matchedPersonName).toBe('Arif Pratama');
    expect(parsed.confidence).toBe('exact');
    expect(parsed.kind).toBe('meal');
    expect(parsed.occurredAt).toBe(refDate);
    expect(parsed.location).toBe('');
    expect(parsed.summary).toBe("He's moving apartments next month");
  });

  it('extracts venue, explicit month/day date, and summary for Maya', () => {
    const parsed = parseQuickLog(
      "Met Maya at Heart Coffee Oct 12 — talked about her new pottery studio and dad's surgery",
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBe('p-maya');
    expect(parsed.kind).toBe('coffee');
    expect(parsed.occurredAt).toBe('2026-10-12');
    expect(parsed.location).toBe('Heart Coffee');
    expect(parsed.summary).toBe(
      "Talked about her new pottery studio and dad's surgery"
    );
  });

  it('does NOT misclassify activity words like "coffee" as a venue', () => {
    const parsed = parseQuickLog(
      'Met at coffee with Maya — swapped sourdough starters',
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBe('p-maya');
    expect(parsed.kind).toBe('coffee');
    expect(parsed.location).toBe('');
  });

  it('handles yesterday, colons, nicknames, and follow-up extraction', () => {
    const parsed = parseQuickLog(
      "Called Tita Elena yesterday: she's visiting in December; follow up: bake pandan cake",
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBe('p-elena');
    expect(parsed.kind).toBe('call');
    expect(parsed.occurredAt).toBe('2026-11-23');
    expect(parsed.summary).toBe("She's visiting in December");
    expect(parsed.followUp).toBe('Bake pandan cake');
  });

  it('parses relative N days ago and Park locations', () => {
    const parsed = parseQuickLog(
      'Long walk with Jonah in Prospect Park 3 days ago — training for a half marathon',
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBe('p-jonah');
    expect(parsed.kind).toBe('walk');
    expect(parsed.location).toBe('Prospect Park');
    expect(parsed.occurredAt).toBe('2026-11-21');
    expect(parsed.summary).toBe('Training for a half marathon');
  });

  it('suggests candidatePersonName when person is not yet in circles', () => {
    const parsed = parseQuickLog(
      'Dinner with Tariq at Noodle Bar — just moved to town',
      samplePeople,
      refDate
    );

    expect(parsed.matchedPersonId).toBeNull();
    expect(parsed.confidence).toBe('unmatched');
    expect(parsed.candidatePersonName).toBe('Tariq');
    expect(parsed.kind).toBe('meal');
    expect(parsed.location).toBe('Noodle Bar');
    expect(parsed.summary).toBe('Just moved to town');
  });
});
