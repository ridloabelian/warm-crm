import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Circle, PersonEnriched } from '../../shared/types.js';

interface PersonModalProps {
  isOpen: boolean;
  circles: Circle[];
  editingPerson: PersonEnriched | null;
  defaultCircleId?: string;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
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
  }) => Promise<void>;
}

export function PersonModal({
  isOpen,
  circles,
  editingPerson,
  defaultCircleId,
  onClose,
  onSave
}: PersonModalProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [circleId, setCircleId] = useState('');
  const [customCadence, setCustomCadence] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [preferredVibe, setPreferredVibe] = useState('');
  const [pinnedContext, setPinnedContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPerson) {
      setName(editingPerson.name);
      setNickname(editingPerson.nickname);
      setCircleId(editingPerson.circleId);
      setCustomCadence(
        editingPerson.customCadenceDays != null
          ? String(editingPerson.customCadenceDays)
          : ''
      );
      setCity(editingPerson.city);
      setNeighborhood(editingPerson.neighborhood);
      setHowWeMet(editingPerson.howWeMet);
      setInterestsText(editingPerson.sharedInterests.join(', '));
      setPreferredVibe(editingPerson.preferredVibe);
      setPinnedContext(editingPerson.pinnedContext);
    } else {
      const fallback =
        defaultCircleId ||
        circles.find((c) => c.slug === 'close-15')?.id ||
        circles[0]?.id ||
        '';
      setName('');
      setNickname('');
      setCircleId(fallback);
      setCustomCadence('');
      setCity('');
      setNeighborhood('');
      setHowWeMet('');
      setInterestsText('');
      setPreferredVibe('');
      setPinnedContext('');
    }
    setError(null);
  }, [isOpen, editingPerson, defaultCircleId, circles]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter their name.');
      return;
    }

    const parsedCustom =
      customCadence.trim() !== ''
        ? Math.max(1, Math.round(Number(customCadence)))
        : null;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: editingPerson?.id,
        name: name.trim(),
        nickname: nickname.trim(),
        circleId,
        customCadenceDays:
          parsedCustom != null && Number.isFinite(parsedCustom)
            ? parsedCustom
            : null,
        city: city.trim(),
        neighborhood: neighborhood.trim(),
        howWeMet: howWeMet.trim(),
        sharedInterests: interestsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredVibe: preferredVibe.trim(),
        pinnedContext: pinnedContext.trim()
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save person.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B2420]/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="warm-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-xl font-semibold text-[#2B2420]">
            {editingPerson ? `Edit ${editingPerson.name}` : 'Add Someone to Your Circles'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8C7B70] hover:bg-[#F4EDE3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Nickname (optional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. May"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Circle
              </label>
              <select
                value={circleId}
                onChange={(e) => setCircleId(e.target.value)}
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              >
                {circles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (every {c.cadenceDays}d)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Custom Cadence Override (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={customCadence}
                onChange={(e) => setCustomCadence(e.target.value)}
                placeholder="Use circle default"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Portland"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Neighborhood
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. Division"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#5E5048]">
              Shared Interests (comma-separated)
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="e.g. pottery, pour-over coffee, park walks"
              className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                Preferred Catch-Up Vibe
              </label>
              <input
                type="text"
                value={preferredVibe}
                onChange={(e) => setPreferredVibe(e.target.value)}
                placeholder="e.g. Morning coffee or Sunday walk"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5E5048]">
                How You Met
              </label>
              <input
                type="text"
                value={howWeMet}
                onChange={(e) => setHowWeMet(e.target.value)}
                placeholder="e.g. Ceramics studio in 2021"
                className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#5E5048]">
              Pinned Context / Notes
            </label>
            <textarea
              rows={2}
              value={pinnedContext}
              onChange={(e) => setPinnedContext(e.target.value)}
              placeholder="Little human details worth remembering..."
              className="w-full rounded-xl border border-[#DFD2C2] bg-[#FAF6F0] px-3 py-2 text-sm text-[#2B2420]"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-[#F8E7E0] px-3 py-2 text-xs font-medium text-[#9A4329]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-[#6F6158] hover:bg-[#F4EDE3]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#C86D51] px-4 py-2 text-xs font-semibold text-[#FFFDF9] hover:bg-[#B55E43] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingPerson ? 'Save Changes' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
