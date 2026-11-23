export type InteractionKind =
  | 'coffee'
  | 'meal'
  | 'walk'
  | 'call'
  | 'visit'
  | 'meetup'
  | 'note';

export type WarmthStatus = 'warm' | 'due-soon' | 'overdue' | 'drifting' | 'new';

export type CircleColorToken = 'terracotta' | 'amber' | 'sage' | 'plum';

export interface Circle {
  id: string;
  name: string;
  slug: string;
  cadenceDays: number;
  targetSize: number;
  description: string;
  colorToken: CircleColorToken;
  sortOrder: number;
  createdAt: string;
}

export interface PersonRecord {
  id: string;
  name: string;
  nickname: string;
  circleId: string;
  customCadenceDays: number | null;
  city: string;
  neighborhood: string;
  howWeMet: string;
  sharedInterests: string[];
  preferredVibe: string;
  pinnedContext: string;
  snoozedUntil: string | null;
  archived: boolean;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifeDate {
  id: string;
  personId: string;
  label: string;
  dateMonth: number;
  dateDay: number;
  dateYear: number | null;
  recurringAnnual: boolean;
  note: string;
  daysUntil?: number | null;
  formattedDate?: string;
}

export interface Interaction {
  id: string;
  personId: string;
  occurredAt: string;
  kind: InteractionKind;
  location: string;
  summary: string;
  followUp: string;
  rawInput: string;
  createdAt: string;
}

export interface CadenceMetrics {
  effectiveCadenceDays: number;
  daysSinceLastContact: number | null;
  overdueDays: number;
  daysUntilDue: number | null;
  warmthScore: number;
  status: WarmthStatus;
  isOverdue: boolean;
  isSnoozed: boolean;
}

export interface MeetupPrompt {
  activityIdea: string;
  rationale: string;
  starters: string[];
}

export interface PersonEnriched extends PersonRecord {
  circleName: string;
  circleSlug: string;
  circleColor: CircleColorToken;
  cadence: CadenceMetrics;
  lastInteraction: Interaction | null;
  lastInteractionLine: string;
  lifeDates: LifeDate[];
  upcomingLifeDate: LifeDate | null;
  meetupPrompt: MeetupPrompt;
  interactionCount: number;
}

export interface UpcomingLifeDateItem extends LifeDate {
  personName: string;
  circleName: string;
  circleColor: CircleColorToken;
}

export interface WeeklyRitualResponse {
  referenceDate: string;
  items: PersonEnriched[];
  totalOverdueCount: number;
  snoozedCount: number;
  upcomingLifeDates: UpcomingLifeDateItem[];
}

export interface QuickLogParseResult {
  matchedPersonId: string | null;
  matchedPersonName: string | null;
  candidatePersonName: string | null;
  kind: InteractionKind;
  occurredAt: string;
  location: string;
  summary: string;
  followUp: string;
  confidence: 'exact' | 'partial' | 'unmatched';
}

export interface WarmCrmBackupV1 {
  format: 'warm-crm-backup';
  version: 1;
  exportedAt: string;
  circles: Circle[];
  people: PersonRecord[];
  lifeDates: LifeDate[];
  interactions: Interaction[];
  meta: {
    sampleDataEnabled: boolean;
  };
}

export interface WorkspaceStats {
  dbPath: string;
  dbSizeBytes: number;
  circleCount: number;
  peopleCount: number;
  interactionCount: number;
  lifeDateCount: number;
  sampleDataEnabled: boolean;
}

export interface RecentInteractionItem extends Interaction {
  personName: string;
  circleName: string;
  circleColor: CircleColorToken;
}

export interface BootstrapResponse {
  referenceDate: string;
  circles: Circle[];
  people: PersonEnriched[];
  ritual: WeeklyRitualResponse;
  recentInteractions: RecentInteractionItem[];
  stats: WorkspaceStats;
}
