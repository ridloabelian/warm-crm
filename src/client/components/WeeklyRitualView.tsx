import { useState } from 'react';
import {
  CalendarHeart,
  Check,
  Clock,
  Coffee,
  Copy,
  MapPin,
  MessageCircleHeart,
  Sparkles,
  Sun
} from 'lucide-react';
import type {
  PersonEnriched,
  WeeklyRitualResponse
} from '../../shared/types.js';
import { CIRCLE_PALETTES, WARMTH_STYLE } from '../lib/api.js';

interface WeeklyRitualViewProps {
  ritual: WeeklyRitualResponse;
  totalPeopleCount: number;
  onLogCatchUp: (person: PersonEnriched) => void;
  onSnoozeWeek: (personId: string) => void;
  onOpenPerson: (personId: string) => void;
  onGoToData: () => void;
  onOpenNewPerson: () => void;
}

export function WeeklyRitualView({
  ritual,
  totalPeopleCount,
  onLogCatchUp,
  onSnoozeWeek,
  onOpenPerson,
  onGoToData,
  onOpenNewPerson
}: WeeklyRitualViewProps) {
  const [copiedStarter, setCopiedStarter] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStarter(key);
      window.setTimeout(() => {
        setCopiedStarter((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      // Clipboard may be restricted in headless contexts
    }
  };

  return (
    <div className="space-y-8">
      <section className="warm-card rounded-2xl p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8E7E0] px-3 py-1 text-xs font-medium text-[#9A4329]">
              <Sun className="h-3.5 w-3.5" />
              Warm Weekly Ritual
            </div>
            <h2 className="font-editorial text-2xl font-semibold tracking-tight text-[#2B2420] sm:text-3xl">
              Who to Reach Out To This Week
            </h2>
            <p className="text-sm leading-relaxed text-[#6F6158]">
              We surface at most <strong>3 people</strong> at a time, ordered by warmth decay relative to their circle cadence — never an overwhelming guilt list.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right text-xs text-[#6F6158]">
            <span>
              Showing {ritual.items.length} of {ritual.totalOverdueCount} waiting
            </span>
            {ritual.snoozedCount > 0 && (
              <span className="text-[#8C7B70]">
                {ritual.snoozedCount} snoozed for later
              </span>
            )}
          </div>
        </div>
      </section>

      {totalPeopleCount === 0 ? (
        <div className="warm-card rounded-2xl p-8 text-center">
          <p className="font-editorial text-xl font-medium text-[#2B2420]">
            Your circles are waiting for the people who matter most.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6F6158]">
            Add a few close friends or family members, or load the optional sample dataset to explore how the weekly ritual feels.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onOpenNewPerson}
              className="rounded-xl bg-[#C86D51] px-4 py-2 text-sm font-medium text-[#FFFDF9] hover:bg-[#B55E43]"
            >
              Add your first person
            </button>
            <button
              type="button"
              onClick={onGoToData}
              className="rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-4 py-2 text-sm font-medium text-[#2B2420] hover:bg-[#F5EDE2]"
            >
              Load sample data or import backup
            </button>
          </div>
        </div>
      ) : ritual.items.length === 0 ? (
        <div className="warm-card rounded-2xl p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F0E9] text-[#3B5941]">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-editorial text-xl font-semibold text-[#2B2420]">
            Everyone in your circles is warm right now
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#6F6158]">
            No overdue catch-ups today. Close the screen and go enjoy real life offline.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {ritual.items.map((person, index) => {
            const palette = CIRCLE_PALETTES[person.circleColor];
            const warmth = WARMTH_STYLE[person.cadence.status];
            return (
              <article
                key={person.id}
                className={`warm-card flex flex-col justify-between rounded-2xl border-t-4 p-5 transition hover:shadow-md ${palette.border}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7B70]">
                          #{index + 1} this week
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.badge}`}
                        >
                          {person.circleName} · {person.cadence.effectiveCadenceDays}d
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPerson(person.id)}
                        className="mt-1.5 text-left font-editorial text-xl font-semibold text-[#2B2420] hover:text-[#C86D51]"
                      >
                        {person.name}
                      </button>
                      {(person.neighborhood || person.city) && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#6F6158]">
                          <MapPin className="h-3.5 w-3.5 text-[#8C7B70]" />
                          {[person.neighborhood, person.city]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${warmth.pill}`}
                    >
                      {person.cadence.daysSinceLastContact != null
                        ? `${person.cadence.daysSinceLastContact}d ago`
                        : 'New'}
                    </span>
                  </div>

                  {/* Warmth decay bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#6F6158]">
                      <span>Warmth meter</span>
                      <span>
                        {person.cadence.overdueDays > 0
                          ? `${person.cadence.overdueDays}d past ${person.cadence.effectiveCadenceDays}d cadence`
                          : 'Due now'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDE4D8]">
                      <div
                        className={`h-full rounded-full ${warmth.bar}`}
                        style={{
                          width: `${Math.max(8, person.cadence.warmthScore)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Last interaction context */}
                  <div className="warm-soft rounded-xl p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7D6C62]">
                      Where you left off
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[#2B2420]">
                      {person.lastInteractionLine}
                    </p>
                    {person.lastInteraction?.followUp && (
                      <p className="mt-2 rounded-lg bg-[#FFFDF9] px-2.5 py-1.5 text-xs text-[#6F6158]">
                        <span className="font-semibold text-[#9A4329]">
                          Thread:{' '}
                        </span>
                        {person.lastInteraction.followUp}
                      </p>
                    )}
                  </div>

                  {/* Upcoming life date */}
                  {person.upcomingLifeDate && (
                    <div className="flex items-center gap-2 rounded-xl border border-[#E7CFA7] bg-[#FCF6EC] px-3 py-2 text-xs text-[#7D4F18]">
                      <CalendarHeart className="h-4 w-4 shrink-0 text-[#C9873E]" />
                      <div>
                        <span className="font-semibold">
                          {person.upcomingLifeDate.label}
                        </span>{' '}
                        · {person.upcomingLifeDate.formattedDate}{' '}
                        {person.upcomingLifeDate.daysUntil === 0
                          ? '(today!)'
                          : `(in ${person.upcomingLifeDate.daysUntil}d)`}
                      </div>
                    </div>
                  )}

                  {/* Low-pressure IRL Meetup Prompt */}
                  <div className="rounded-xl border border-[#E5DCCF] bg-[#FCF9F4] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B5941]">
                        <Coffee className="h-3.5 w-3.5" />
                        Low-pressure IRL idea
                      </span>
                      <span className="text-[10px] text-[#8C7B70]">
                        Never auto-sent
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#2B2420]">
                      {person.meetupPrompt.activityIdea}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#7D6C62]">
                      {person.meetupPrompt.rationale}
                    </p>

                    <div className="mt-2.5 space-y-1.5">
                      {person.meetupPrompt.starters.map((starter, sIdx) => {
                        const key = `${person.id}-${sIdx}`;
                        const isCopied = copiedStarter === key;
                        return (
                          <div
                            key={key}
                            className="group flex items-start justify-between gap-2 rounded-lg border border-[#EDE5DA] bg-[#FFFDF9] p-2 text-xs text-[#4A3F39]"
                          >
                            <span className="leading-relaxed">“{starter}”</span>
                            <button
                              type="button"
                              onClick={() => void handleCopy(starter, key)}
                              title="Copy starter text"
                              className="shrink-0 rounded-md p-1 text-[#8C7B70] hover:bg-[#F3ECE2] hover:text-[#2B2420]"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-[#3B5941]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#EFE7DC] pt-4">
                  <button
                    type="button"
                    onClick={() => onLogCatchUp(person)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#C86D51] px-3 py-2 text-xs font-semibold text-[#FFFDF9] transition hover:bg-[#B55E43]"
                  >
                    <MessageCircleHeart className="h-3.5 w-3.5" />
                    Log catch-up
                  </button>
                  <button
                    type="button"
                    onClick={() => onSnoozeWeek(person.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-3 py-2 text-xs font-medium text-[#5E5048] hover:bg-[#F4EDE3]"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Snooze 1w
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPerson(person.id)}
                    className="rounded-xl px-2.5 py-2 text-xs font-medium text-[#6F6158] hover:bg-[#F4EDE3] hover:text-[#2B2420]"
                  >
                    Details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {ritual.upcomingLifeDates.length > 0 && (
        <section className="warm-card rounded-2xl p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#C9873E]" />
            <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
              Upcoming Life Dates (Next 30 Days)
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ritual.upcomingLifeDates.map((ld) => {
              const palette = CIRCLE_PALETTES[ld.circleColor];
              return (
                <button
                  key={ld.id}
                  type="button"
                  onClick={() => onOpenPerson(ld.personId)}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#E8DFD3] bg-[#FCF9F4] p-3.5 text-left transition hover:border-[#C86D51]/50 hover:bg-[#FFFDF9]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#2B2420]">
                        {ld.personName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${palette.badge}`}
                      >
                        {ld.circleName}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[#7D4F18]">
                      {ld.label} · {ld.formattedDate}
                    </p>
                    {ld.note && (
                      <p className="mt-1 text-xs text-[#6F6158]">{ld.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#F9EEDB] px-2 py-1 text-xs font-semibold text-[#8A561B]">
                    {ld.daysUntil === 0 ? 'Today' : `${ld.daysUntil}d`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
