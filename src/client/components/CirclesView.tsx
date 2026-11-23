import { useMemo, useState } from 'react';
import {
  Check,
  MapPin,
  MessageCircleHeart,
  Pencil,
  Search,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import type { Circle, PersonEnriched, WarmthStatus } from '../../shared/types.js';
import { CIRCLE_PALETTES, WARMTH_STYLE } from '../lib/api.js';

interface CirclesViewProps {
  circles: Circle[];
  people: PersonEnriched[];
  onUpdateCircleCadence: (circleId: string, cadenceDays: number) => Promise<void>;
  onOpenPerson: (personId: string) => void;
  onLogCatchUp: (person: PersonEnriched) => void;
  onOpenNewPerson: (circleId?: string) => void;
}

export function CirclesView({
  circles,
  people,
  onUpdateCircleCadence,
  onOpenPerson,
  onLogCatchUp,
  onOpenNewPerson
}: CirclesViewProps) {
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'warm'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCircleId, setEditingCircleId] = useState<string | null>(null);
  const [cadenceDraft, setCadenceDraft] = useState<string>('');

  const memberStatsByCircle = useMemo(() => {
    const map = new Map<string, { total: number; overdue: number }>();
    for (const c of circles) {
      map.set(c.id, { total: 0, overdue: 0 });
    }
    for (const p of people) {
      const entry = map.get(p.circleId) ?? { total: 0, overdue: 0 };
      entry.total += 1;
      if (p.cadence.isOverdue && !p.cadence.isSnoozed) {
        entry.overdue += 1;
      }
      map.set(p.circleId, entry);
    }
    return map;
  }, [circles, people]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return people
      .filter((p) => {
        if (selectedCircleId !== 'all' && p.circleId !== selectedCircleId) {
          return false;
        }
        if (statusFilter === 'overdue' && !p.cadence.isOverdue) {
          return false;
        }
        if (statusFilter === 'warm' && p.cadence.isOverdue) {
          return false;
        }
        if (!q) return true;
        const searchable = [
          p.name,
          p.nickname,
          p.city,
          p.neighborhood,
          p.circleName,
          p.pinnedContext,
          ...p.sharedInterests
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(q);
      })
      .sort((a, b) => a.cadence.warmthScore - b.cadence.warmthScore);
  }, [people, selectedCircleId, statusFilter, searchQuery]);

  const startEditCadence = (circle: Circle) => {
    setEditingCircleId(circle.id);
    setCadenceDraft(String(circle.cadenceDays));
  };

  const saveCadence = async (circleId: string) => {
    const parsed = Math.max(1, Math.round(Number(cadenceDraft) || 14));
    await onUpdateCircleCadence(circleId, parsed);
    setEditingCircleId(null);
  };

  return (
    <div className="space-y-6">
      {/* Circle Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {circles.map((circle) => {
          const palette = CIRCLE_PALETTES[circle.colorToken];
          const stat = memberStatsByCircle.get(circle.id) ?? {
            total: 0,
            overdue: 0
          };
          const isSelected = selectedCircleId === circle.id;
          const isEditing = editingCircleId === circle.id;

          return (
            <div
              key={circle.id}
              className={`warm-card flex flex-col justify-between rounded-2xl border-t-4 p-4 transition ${
                palette.border
              } ${isSelected ? 'ring-2 ring-[#C86D51]/50' : ''}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCircleId((prev) =>
                        prev === circle.id ? 'all' : circle.id
                      )
                    }
                    className="text-left"
                  >
                    <h3 className="font-editorial text-lg font-semibold text-[#2B2420] hover:text-[#C86D51]">
                      {circle.name}
                    </h3>
                  </button>
                  <span className="rounded-full bg-[#F4EDE3] px-2 py-0.5 text-xs font-medium text-[#5E5048]">
                    {stat.total}/{circle.targetSize}
                  </span>
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-[#6F6158]">
                  {circle.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EFE7DC] pt-3">
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#6F6158]">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={cadenceDraft}
                      onChange={(e) => setCadenceDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveCadence(circle.id);
                        if (e.key === 'Escape') setEditingCircleId(null);
                      }}
                      className="w-16 rounded-lg border border-[#D8CBB9] bg-[#FFFDF9] px-2 py-1 text-xs font-semibold text-[#2B2420]"
                      autoFocus
                    />
                    <span className="text-xs text-[#6F6158]">days</span>
                    <button
                      type="button"
                      onClick={() => void saveCadence(circle.id)}
                      className="rounded-lg bg-[#5D7A63] p-1 text-white hover:bg-[#4B6551]"
                      title="Save cadence"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditCadence(circle)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#5E5048] hover:bg-[#F4EDE3]"
                    title="Click to customize catch-up cadence"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#8C7B70]" />
                    <span>Every {circle.cadenceDays}d</span>
                    <Pencil className="h-3 w-3 text-[#8C7B70]" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenNewPerson(circle.id)}
                  className="text-xs font-medium text-[#9A4329] hover:underline"
                >
                  + Add
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Search & Filters */}
      <section className="warm-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7B70]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, city, neighborhood, or shared interest..."
            className="w-full rounded-xl border border-[#E2D6C5] bg-[#FAF6F0] py-2 pl-9 pr-3 text-sm text-[#2B2420] placeholder-[#9B8B7E] focus:border-[#C86D51] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCircleId('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              selectedCircleId === 'all'
                ? 'bg-[#2B2420] text-[#FFFDF9]'
                : 'bg-[#F4EDE3] text-[#5E5048] hover:bg-[#EAE0D2]'
            }`}
          >
            All Circles ({people.length})
          </button>

          {(['all', 'overdue', 'warm'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === status
                  ? 'bg-[#C86D51] text-[#FFFDF9]'
                  : 'bg-[#F4EDE3] text-[#5E5048] hover:bg-[#EAE0D2]'
              }`}
            >
              {status === 'all'
                ? 'All Warmth'
                : status === 'overdue'
                  ? 'Needs Catch-Up'
                  : 'Warm'}
            </button>
          ))}
        </div>
      </section>

      {/* People Grid */}
      {filteredPeople.length === 0 ? (
        <div className="warm-card rounded-2xl p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-[#9E8B7E]" />
          <p className="mt-2 font-editorial text-lg font-medium text-[#2B2420]">
            No matching people in this view
          </p>
          <p className="mt-1 text-sm text-[#6F6158]">
            Try clearing your filter or add someone into one of your intentional circles.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => {
            const palette = CIRCLE_PALETTES[person.circleColor];
            const warmth = WARMTH_STYLE[person.cadence.status as WarmthStatus];

            return (
              <article
                key={person.id}
                className="warm-card flex flex-col justify-between rounded-2xl p-5 transition hover:border-[#C86D51]/50 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => onOpenPerson(person.id)}
                        className="text-left font-editorial text-lg font-semibold text-[#2B2420] hover:text-[#C86D51]"
                      >
                        {person.name}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${palette.badge}`}
                        >
                          {person.circleName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${warmth.pill}`}
                        >
                          {person.cadence.isSnoozed
                            ? 'Snoozed'
                            : warmth.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs text-[#6F6158]">
                      <div className="font-semibold text-[#2B2420]">
                        {person.cadence.daysSinceLastContact != null
                          ? `${person.cadence.daysSinceLastContact}d ago`
                          : 'New'}
                      </div>
                      <div className="text-[11px] text-[#8C7B70]">
                        {person.cadence.effectiveCadenceDays}d cadence
                      </div>
                    </div>
                  </div>

                  {(person.neighborhood || person.city) && (
                    <p className="inline-flex items-center gap-1 text-xs text-[#6F6158]">
                      <MapPin className="h-3.5 w-3.5 text-[#8C7B70]" />
                      {[person.neighborhood, person.city]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}

                  <p className="line-clamp-3 text-xs leading-relaxed text-[#4A3F39]">
                    {person.lastInteractionLine}
                  </p>

                  {person.sharedInterests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {person.sharedInterests.slice(0, 4).map((interest) => (
                        <span
                          key={interest}
                          className="rounded-lg bg-[#F4EDE3] px-2 py-0.5 text-[11px] text-[#5E5048]"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EFE7DC] pt-3">
                  <button
                    type="button"
                    onClick={() => onLogCatchUp(person)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8E7E0] px-2.5 py-1.5 text-xs font-semibold text-[#9A4329] hover:bg-[#F2D6CA]"
                  >
                    <MessageCircleHeart className="h-3.5 w-3.5" />
                    Log catch-up
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPerson(person.id)}
                    className="text-xs font-medium text-[#6F6158] hover:text-[#2B2420]"
                  >
                    Open profile →
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
