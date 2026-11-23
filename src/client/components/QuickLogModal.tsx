import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  MapPin,
  Sparkles,
  UserPlus,
  X
} from 'lucide-react';
import { todayLocalISO } from '../../shared/dates.js';
import { parseQuickLog } from '../../shared/quickLogParser.js';
import type {
  Circle,
  InteractionKind,
  PersonEnriched
} from '../../shared/types.js';
import { INTERACTION_KIND_LABELS } from '../lib/api.js';

interface QuickLogModalProps {
  isOpen: boolean;
  people: PersonEnriched[];
  circles: Circle[];
  initialPerson?: PersonEnriched | null;
  onClose: () => void;
  onSubmit: (payload: {
    text: string;
    personId?: string | null;
    createPersonName?: string | null;
    circleId?: string;
    kind: InteractionKind;
    occurredAt: string;
    location: string;
    summary: string;
    followUp: string;
  }) => Promise<void>;
}

const EXAMPLE_PROMPTS = [
  "Had dinner with Arif — he's moving apartments next month",
  "Coffee with Maya at Heart Roasters yesterday — kiln firing went great",
  "Called Auntie Elena — cousin Mateo starts college; follow up: send recipe photos"
];

export function QuickLogModal({
  isOpen,
  people,
  circles,
  initialPerson,
  onClose,
  onSubmit
}: QuickLogModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [overridePersonId, setOverridePersonId] = useState<string | null>(null);
  const [createNewName, setCreateNewName] = useState<string | null>(null);
  const [newPersonCircleId, setNewPersonCircleId] = useState<string>(
    circles.find((c) => c.slug === 'close-15')?.id ?? circles[0]?.id ?? ''
  );
  const [overrideKind, setOverrideKind] = useState<InteractionKind | null>(null);
  const [overrideDate, setOverrideDate] = useState<string | null>(null);
  const [overrideLocation, setOverrideLocation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setText(initialPerson ? `${initialPerson.name.split(' ')[0]} — ` : '');
    setOverridePersonId(initialPerson ? initialPerson.id : null);
    setCreateNewName(null);
    setOverrideKind(null);
    setOverrideDate(null);
    setOverrideLocation(null);
    setError(null);
    setNewPersonCircleId(
      circles.find((c) => c.slug === 'close-15')?.id ?? circles[0]?.id ?? ''
    );
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);
  }, [isOpen, initialPerson, circles]);

  const parsed = useMemo(
    () => parseQuickLog(text, people, todayLocalISO()),
    [text, people]
  );

  const effectivePersonId =
    createNewName ? null : (overridePersonId ?? parsed.matchedPersonId);
  const effectivePerson = people.find((p) => p.id === effectivePersonId) ?? null;
  const effectiveKind = overrideKind ?? parsed.kind;
  const effectiveDate = overrideDate ?? parsed.occurredAt;
  const effectiveLocation = overrideLocation ?? parsed.location;
  const effectiveSummary = parsed.summary || text.trim();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Jot down a quick line first.');
      return;
    }

    if (!effectivePersonId && !createNewName && !parsed.candidatePersonName) {
      setError('Choose a person or type their name to add them.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        text: text.trim(),
        personId: effectivePersonId,
        createPersonName:
          createNewName ??
          (!effectivePersonId ? parsed.candidatePersonName : null),
        circleId: newPersonCircleId,
        kind: effectiveKind,
        occurredAt: effectiveDate,
        location: effectiveLocation,
        summary: effectiveSummary,
        followUp: parsed.followUp
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#2B2420]/40 p-4 pt-16 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="warm-card w-full max-w-2xl rounded-2xl p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8E7E0] text-[#C86D51]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-editorial text-lg font-semibold text-[#2B2420]">
                Quick Log a Moment
              </h2>
              <p className="text-xs text-[#6F6158]">
                Under 10 seconds — type naturally and hit Enter
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8C7B70] hover:bg-[#F4EDE3] hover:text-[#2B2420]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (createNewName) setCreateNewName(null);
            }}
            placeholder="e.g. Had dinner with Arif — he's moving apartments next month"
            className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-4 py-3 text-base text-[#2B2420] placeholder-[#9B8B7E] focus:border-[#C86D51] focus:outline-none"
          />

          {/* Live Parsed Preview */}
          <div className="rounded-xl border border-[#EAE0D2] bg-[#FCF9F4] p-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Person selector */}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#6F6158]">Who:</span>
                <select
                  value={
                    createNewName
                      ? '__new__'
                      : effectivePersonId ?? ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setCreateNewName(parsed.candidatePersonName || 'New Friend');
                      setOverridePersonId(null);
                    } else {
                      setCreateNewName(null);
                      setOverridePersonId(val || null);
                    }
                  }}
                  className="rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2.5 py-1 text-xs font-medium text-[#2B2420]"
                >
                  <option value="">
                    {parsed.candidatePersonName
                      ? `Select or create "${parsed.candidatePersonName}"...`
                      : 'Select person...'}
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.circleName})
                    </option>
                  ))}
                  {parsed.candidatePersonName && (
                    <option value="__new__">
                      + Create &quot;{parsed.candidatePersonName}&quot;
                    </option>
                  )}
                </select>

                {!effectivePerson && parsed.candidatePersonName && !createNewName && (
                  <button
                    type="button"
                    onClick={() => setCreateNewName(parsed.candidatePersonName)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#E7F0E9] px-2 py-1 text-[11px] font-semibold text-[#3B5941] hover:bg-[#D7E6DA]"
                  >
                    <UserPlus className="h-3 w-3" />
                    Add &quot;{parsed.candidatePersonName}&quot;
                  </button>
                )}
              </div>

              {createNewName && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#3B5941] font-medium">
                    Creating {createNewName} in
                  </span>
                  <select
                    value={newPersonCircleId}
                    onChange={(e) => setNewPersonCircleId(e.target.value)}
                    className="rounded-lg border border-[#C1D6C5] bg-[#EFF5F0] px-2 py-1 text-xs font-medium text-[#3B5941]"
                  >
                    {circles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date input */}
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#8C7B70]" />
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2 py-1 text-xs text-[#2B2420]"
                />
              </div>

              {/* Location input */}
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#8C7B70]" />
                <input
                  type="text"
                  value={effectiveLocation}
                  onChange={(e) => setOverrideLocation(e.target.value)}
                  placeholder="Place (optional)"
                  className="w-32 rounded-lg border border-[#DFD2C2] bg-[#FFFDF9] px-2 py-1 text-xs text-[#2B2420]"
                />
              </div>
            </div>

            {/* Kind pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {(Object.keys(INTERACTION_KIND_LABELS) as InteractionKind[]).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOverrideKind(k)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      effectiveKind === k
                        ? 'bg-[#C86D51] text-[#FFFDF9]'
                        : 'bg-[#EFE7DC] text-[#5E5048] hover:bg-[#E5DACB]'
                    }`}
                  >
                    {INTERACTION_KIND_LABELS[k]}
                  </button>
                )
              )}
            </div>

            {effectiveSummary && (
              <p className="mt-2.5 text-xs text-[#4A3F39]">
                <span className="font-semibold text-[#6F6158]">Note: </span>
                {effectiveSummary}
              </p>
            )}
            {parsed.followUp && (
              <p className="mt-1 text-xs text-[#7D4F18]">
                <span className="font-semibold">Follow-up: </span>
                {parsed.followUp}
              </p>
            )}
          </div>

          {!text.trim() && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-[#8C7B70]">
                Try a natural phrasing:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setText(sample)}
                    className="rounded-lg border border-[#E8DFD3] bg-[#FAF6F0] px-2.5 py-1 text-left text-[11px] text-[#5E5048] hover:border-[#C86D51]/50"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-[#F8E7E0] px-3 py-2 text-xs font-medium text-[#9A4329]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#8C7B70]">
              Stored directly in local SQLite · Esc to close
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-[#6F6158] hover:bg-[#F4EDE3]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#C86D51] px-4 py-2 text-xs font-semibold text-[#FFFDF9] hover:bg-[#B55E43] disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Save Catch-Up ↵'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
