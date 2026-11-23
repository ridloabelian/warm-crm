import { useEffect, useState } from 'react';
import {
  CalendarHeart,
  Clock,
  Coffee,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import {
  SHORT_MONTH_NAMES,
  formatShortISODate,
  todayLocalISO
} from '../../shared/dates.js';
import type {
  Interaction,
  InteractionKind,
  PersonEnriched
} from '../../shared/types.js';
import {
  CIRCLE_PALETTES,
  INTERACTION_KIND_LABELS,
  WARMTH_STYLE,
  api
} from '../lib/api.js';

interface PersonDetailDrawerProps {
  personId: string | null;
  onClose: () => void;
  onEditPerson: (person: PersonEnriched) => void;
  onDeletedPerson: () => Promise<void>;
  onUpdated: () => Promise<void>;
}

export function PersonDetailDrawer({
  personId,
  onClose,
  onEditPerson,
  onDeletedPerson,
  onUpdated
}: PersonDetailDrawerProps) {
  const [person, setPerson] = useState<PersonEnriched | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Add interaction form
  const [kind, setKind] = useState<InteractionKind>('coffee');
  const [occurredAt, setOccurredAt] = useState(todayLocalISO());
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [followUp, setFollowUp] = useState('');

  // Add life date form
  const [showAddDate, setShowAddDate] = useState(false);
  const [ldLabel, setLdLabel] = useState('');
  const [ldMonth, setLdMonth] = useState(1);
  const [ldDay, setLdDay] = useState(1);
  const [ldYear, setLdYear] = useState('');
  const [ldAnnual, setLdAnnual] = useState(true);
  const [ldNote, setLdNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadDetail = async (id: string) => {
    setLoading(true);
    try {
      const data = await api.getPersonDetail(id);
      setPerson(data.person);
      setInteractions(data.interactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setInteractions([]);
      setConfirmDelete(false);
      return;
    }
    setOccurredAt(todayLocalISO());
    setConfirmDelete(false);
    void loadDetail(personId);
  }, [personId]);

  if (!personId) return null;

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person || !summary.trim()) return;
    await api.createInteraction({
      personId: person.id,
      occurredAt,
      kind,
      location: location.trim(),
      summary: summary.trim(),
      followUp: followUp.trim()
    });
    setLocation('');
    setSummary('');
    setFollowUp('');
    await loadDetail(person.id);
    await onUpdated();
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!person) return;
    await api.deleteInteraction(id);
    await loadDetail(person.id);
    await onUpdated();
  };

  const handleAddLifeDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person || !ldLabel.trim()) return;
    await api.addLifeDate(person.id, {
      label: ldLabel.trim(),
      dateMonth: ldMonth,
      dateDay: ldDay,
      dateYear: ldYear.trim() ? Number(ldYear) : null,
      recurringAnnual: ldAnnual,
      note: ldNote.trim()
    });
    setLdLabel('');
    setLdYear('');
    setLdNote('');
    setShowAddDate(false);
    await loadDetail(person.id);
    await onUpdated();
  };

  const handleDeleteLifeDate = async (id: string) => {
    if (!person) return;
    await api.deleteLifeDate(id);
    await loadDetail(person.id);
    await onUpdated();
  };

  const handleSnooze = async (days: number) => {
    if (!person) return;
    await api.snoozePerson(person.id, days);
    await loadDetail(person.id);
    await onUpdated();
  };

  const handleDeletePerson = async () => {
    if (!person) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await api.deletePerson(person.id);
    onClose();
    await onDeletedPerson();
  };

  const palette = person ? CIRCLE_PALETTES[person.circleColor] : null;
  const warmth = person ? WARMTH_STYLE[person.cadence.status] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#2B2420]/35 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#E8DFD3] bg-[#FAF6F0] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E8DFD3] pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7B70]">
            Relationship Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8C7B70] hover:bg-[#EFE7DC] hover:text-[#2B2420]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && !person ? (
          <div className="py-12 text-center text-sm text-[#6F6158]">
            Loading profile...
          </div>
        ) : person && palette && warmth ? (
          <div className="mt-5 space-y-6">
            {/* Identity Header */}
            <div className="warm-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-editorial text-2xl font-semibold text-[#2B2420]">
                    {person.name}
                    {person.nickname && (
                      <span className="ml-2 text-base font-normal text-[#7D6C62]">
                        ({person.nickname})
                      </span>
                    )}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${palette.badge}`}
                    >
                      {person.circleName} · every {person.cadence.effectiveCadenceDays}d
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${warmth.pill}`}
                    >
                      {person.cadence.isSnoozed
                        ? `Snoozed until ${person.snoozedUntil}`
                        : warmth.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditPerson(person)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-3 py-1.5 text-xs font-medium text-[#2B2420] hover:bg-[#F4EDE3]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSnooze(person.cadence.isSnoozed ? 0 : 7)
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-3 py-1.5 text-xs font-medium text-[#5E5048] hover:bg-[#F4EDE3]"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {person.cadence.isSnoozed ? 'Unsnooze' : 'Snooze 1w'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeletePerson()}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium ${
                      confirmDelete
                        ? 'bg-[#B34F36] text-white'
                        : 'text-[#9A4329] hover:bg-[#F8E7E0]'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDelete ? 'Confirm delete' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-[#5E5048]">
                {(person.neighborhood || person.city) && (
                  <p className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#8C7B70]" />
                    {[person.neighborhood, person.city]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {person.howWeMet && (
                  <p>
                    <strong className="text-[#2B2420]">How you met:</strong>{' '}
                    {person.howWeMet}
                  </p>
                )}
                {person.preferredVibe && (
                  <p>
                    <strong className="text-[#2B2420]">Preferred vibe:</strong>{' '}
                    {person.preferredVibe}
                  </p>
                )}
                {person.pinnedContext && (
                  <p className="rounded-xl bg-[#FAF6F0] p-3 text-sm leading-relaxed text-[#2B2420]">
                    {person.pinnedContext}
                  </p>
                )}
              </div>

              {person.sharedInterests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {person.sharedInterests.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-[#F4EDE3] px-2.5 py-1 text-xs text-[#5E5048]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-[#E5DCCF] bg-[#FCF9F4] p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3B5941]">
                  <Coffee className="h-3.5 w-3.5" />
                  Low-pressure IRL meetup idea
                </div>
                <p className="mt-1 text-sm font-medium text-[#2B2420]">
                  {person.meetupPrompt.activityIdea}
                </p>
              </div>
            </div>

            {/* Life Dates */}
            <div className="warm-card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarHeart className="h-4 w-4 text-[#C9873E]" />
                  <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
                    Important Life Dates
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddDate((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#F4EDE3] px-3 py-1.5 text-xs font-medium text-[#5E5048] hover:bg-[#EAE0D2]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Date
                </button>
              </div>

              {showAddDate && (
                <form
                  onSubmit={handleAddLifeDate}
                  className="mt-3 space-y-2.5 rounded-xl border border-[#E8DFD3] bg-[#FAF6F0] p-3.5"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      value={ldLabel}
                      onChange={(e) => setLdLabel(e.target.value)}
                      placeholder="Label (e.g. Birthday)"
                      className="rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2.5 py-1.5 text-xs"
                    />
                    <select
                      value={ldMonth}
                      onChange={(e) => setLdMonth(Number(e.target.value))}
                      className="rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2.5 py-1.5 text-xs"
                    >
                      {SHORT_MONTH_NAMES.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={ldDay}
                        onChange={(e) => setLdDay(Number(e.target.value))}
                        placeholder="Day"
                        className="w-16 rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        value={ldYear}
                        onChange={(e) => setLdYear(e.target.value)}
                        placeholder="Year (opt)"
                        className="w-24 rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      value={ldNote}
                      onChange={(e) => setLdNote(e.target.value)}
                      placeholder="Gift idea or note (optional)"
                      className="flex-1 rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2.5 py-1.5 text-xs"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#5E5048]">
                      <input
                        type="checkbox"
                        checked={ldAnnual}
                        onChange={(e) => setLdAnnual(e.target.checked)}
                      />
                      Annual
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#C86D51] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              {person.lifeDates.length === 0 ? (
                <p className="mt-2.5 text-xs text-[#7D6C62]">
                  No birthdays, anniversaries, or big milestones saved yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {person.lifeDates.map((ld) => (
                    <div
                      key={ld.id}
                      className="flex items-center justify-between rounded-xl border border-[#EDE5DA] bg-[#FCF9F4] px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#2B2420]">
                          {ld.label}
                        </span>{' '}
                        <span className="text-[#7D4F18]">
                          · {ld.formattedDate}
                          {ld.daysUntil != null && ld.daysUntil >= 0
                            ? ` (in ${ld.daysUntil}d)`
                            : ''}
                        </span>
                        {ld.note && (
                          <p className="mt-0.5 text-[#6F6158]">{ld.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteLifeDate(ld.id)}
                        className="rounded-md p-1 text-[#9B8B7E] hover:bg-[#F8E7E0] hover:text-[#9A4329]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Log a catch-up form */}
            <form
              onSubmit={handleAddInteraction}
              className="warm-card space-y-3 rounded-2xl p-5"
            >
              <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
                Log a Catch-Up
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as InteractionKind)}
                  className="rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-xs text-[#2B2420]"
                >
                  {(
                    Object.keys(INTERACTION_KIND_LABELS) as InteractionKind[]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {INTERACTION_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-xs text-[#2B2420]"
                />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where? (optional)"
                  className="rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-xs text-[#2B2420]"
                />
              </div>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What did you talk about or share?"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Optional follow-up thread for next time"
                  className="min-w-[200px] flex-1 rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-xs text-[#2B2420]"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#C86D51] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B55E43]"
                >
                  Save Catch-Up
                </button>
              </div>
            </form>

            {/* History */}
            <div className="warm-card rounded-2xl p-5">
              <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
                Catch-Up Timeline ({interactions.length})
              </h3>
              {interactions.length === 0 ? (
                <p className="mt-2 text-xs text-[#7D6C62]">
                  No moments logged yet with {person.name}.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {interactions.map((inter) => (
                    <div
                      key={inter.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[#EDE5DA] bg-[#FCF9F4] p-3.5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F6158]">
                          <span className="font-semibold text-[#9A4329]">
                            {INTERACTION_KIND_LABELS[inter.kind]}
                          </span>
                          <span>
                            · {formatShortISODate(inter.occurredAt, true)}
                          </span>
                          {inter.location && <span>· {inter.location}</span>}
                        </div>
                        <p className="mt-1 text-sm text-[#2B2420]">
                          {inter.summary}
                        </p>
                        {inter.followUp && (
                          <p className="mt-1.5 text-xs text-[#7D4F18]">
                            <strong>Follow-up:</strong> {inter.followUp}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteInteraction(inter.id)}
                        className="rounded-md p-1 text-[#9B8B7E] hover:bg-[#F8E7E0] hover:text-[#9A4329]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
