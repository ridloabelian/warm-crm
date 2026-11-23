import { useMemo, useState } from 'react';
import {
  BookHeart,
  Coffee,
  Footprints,
  Home,
  MapPin,
  NotebookPen,
  Phone,
  Sparkles,
  Trash2,
  Users,
  Utensils
} from 'lucide-react';
import { formatShortISODate } from '../../shared/dates.js';
import type {
  InteractionKind,
  RecentInteractionItem
} from '../../shared/types.js';
import { CIRCLE_PALETTES, INTERACTION_KIND_LABELS } from '../lib/api.js';

interface MomentsViewProps {
  interactions: RecentInteractionItem[];
  onOpenPerson: (personId: string) => void;
  onDeleteInteraction: (id: string) => Promise<void>;
  onOpenQuickLog: () => void;
}

const KIND_ICONS: Record<InteractionKind, typeof Coffee> = {
  coffee: Coffee,
  meal: Utensils,
  walk: Footprints,
  call: Phone,
  visit: Home,
  meetup: Users,
  note: NotebookPen
};

export function MomentsView({
  interactions,
  onOpenPerson,
  onDeleteInteraction,
  onOpenQuickLog
}: MomentsViewProps) {
  const [kindFilter, setKindFilter] = useState<'all' | InteractionKind>('all');

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return interactions;
    return interactions.filter((item) => item.kind === kindFilter);
  }, [interactions, kindFilter]);

  return (
    <div className="space-y-6">
      <section className="warm-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EDE3] px-2.5 py-1 text-xs font-medium text-[#5E5048]">
            <BookHeart className="h-3.5 w-3.5 text-[#C86D51]" />
            Moments Journal
          </div>
          <h2 className="mt-2 font-editorial text-2xl font-semibold text-[#2B2420]">
            Real-Life Catch-Ups &amp; Memories
          </h2>
          <p className="mt-1 text-sm text-[#6F6158]">
            A quiet chronological log of coffees, dinners, walks, and phone calls — never scraped from social feeds.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenQuickLog}
          className="inline-flex items-center gap-2 rounded-xl bg-[#C86D51] px-4 py-2 text-sm font-medium text-[#FFFDF9] hover:bg-[#B55E43]"
        >
          <Sparkles className="h-4 w-4" />
          Quick Log (⌘K)
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setKindFilter('all')}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            kindFilter === 'all'
              ? 'bg-[#2B2420] text-[#FFFDF9]'
              : 'bg-[#FFFDF9] text-[#5E5048] border border-[#E8DFD3] hover:bg-[#F4EDE3]'
          }`}
        >
          All ({interactions.length})
        </button>
        {(Object.keys(INTERACTION_KIND_LABELS) as InteractionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              kindFilter === k
                ? 'bg-[#C86D51] text-[#FFFDF9]'
                : 'bg-[#FFFDF9] text-[#5E5048] border border-[#E8DFD3] hover:bg-[#F4EDE3]'
            }`}
          >
            {INTERACTION_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="warm-card rounded-2xl p-10 text-center">
          <p className="font-editorial text-lg font-medium text-[#2B2420]">
            No logged moments here yet
          </p>
          <p className="mt-1 text-sm text-[#6F6158]">
            Press <kbd className="rounded border px-1.5 py-0.5 text-xs">⌘K</kbd> anytime to log a catch-up in under 10 seconds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const Icon = KIND_ICONS[item.kind];
            const palette = CIRCLE_PALETTES[item.circleColor];
            return (
              <article
                key={item.id}
                className="warm-card flex items-start justify-between gap-4 rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4EDE3] text-[#9A4329]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPerson(item.personId)}
                        className="font-editorial text-base font-semibold text-[#2B2420] hover:text-[#C86D51]"
                      >
                        {item.personName}
                      </button>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${palette.badge}`}
                      >
                        {item.circleName}
                      </span>
                      <span className="text-xs text-[#6F6158]">
                        {formatShortISODate(item.occurredAt, true)}
                      </span>
                      {item.location && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#6F6158]">
                          <MapPin className="h-3 w-3 text-[#8C7B70]" />
                          {item.location}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#2B2420]">
                      {item.summary}
                    </p>
                    {item.followUp && (
                      <p className="mt-2 inline-block rounded-lg bg-[#F9EEDB]/70 px-2.5 py-1 text-xs text-[#7D4F18]">
                        <strong>Follow-up:</strong> {item.followUp}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onDeleteInteraction(item.id)}
                  className="shrink-0 rounded-lg p-1.5 text-[#9B8B7E] hover:bg-[#F8E7E0] hover:text-[#9A4329]"
                  title="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
