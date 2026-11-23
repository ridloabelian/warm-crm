import { todayLocalISO } from '../../shared/dates.js';
import type {
  BootstrapResponse,
  Circle,
  CircleColorToken,
  Interaction,
  InteractionKind,
  PersonEnriched,
  WarmthStatus
} from '../../shared/types.js';

const API_BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? '';

async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData || typeof init?.body === 'string'
        ? {}
        : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errData = (await res.json()) as { error?: string };
      if (errData?.error) message = errData.error;
    } catch {
      // ignore non-json error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export const api = {
  getBootstrap(date: string = todayLocalISO()): Promise<BootstrapResponse> {
    return requestJson<BootstrapResponse>(
      `/api/bootstrap?date=${encodeURIComponent(date)}`
    );
  },

  updateCircle(
    id: string,
    payload: Partial<
      Pick<Circle, 'name' | 'cadenceDays' | 'targetSize' | 'description' | 'colorToken'>
    >
  ): Promise<{ circle: Circle }> {
    return requestJson<{ circle: Circle }>(`/api/circles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  createPerson(payload: {
    name: string;
    nickname?: string;
    circleId: string;
    customCadenceDays?: number | null;
    city?: string;
    neighborhood?: string;
    howWeMet?: string;
    sharedInterests?: string[];
    preferredVibe?: string;
    pinnedContext?: string;
  }): Promise<{ person: PersonEnriched }> {
    return requestJson<{ person: PersonEnriched }>('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, referenceDate: todayLocalISO() })
    });
  },

  updatePerson(
    id: string,
    payload: Partial<{
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
      archived: boolean;
    }>
  ): Promise<{ person: PersonEnriched }> {
    return requestJson<{ person: PersonEnriched }>(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, referenceDate: todayLocalISO() })
    });
  },

  deletePerson(id: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/people/${id}`, {
      method: 'DELETE'
    });
  },

  getPersonDetail(id: string): Promise<{
    person: PersonEnriched;
    interactions: Interaction[];
  }> {
    return requestJson<{ person: PersonEnriched; interactions: Interaction[] }>(
      `/api/people/${id}?date=${encodeURIComponent(todayLocalISO())}`
    );
  },

  snoozePerson(id: string, days: number): Promise<{ person: PersonEnriched }> {
    return requestJson<{ person: PersonEnriched }>(`/api/people/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, referenceDate: todayLocalISO() })
    });
  },

  addLifeDate(
    personId: string,
    payload: {
      label: string;
      dateMonth: number;
      dateDay: number;
      dateYear: number | null;
      recurringAnnual: boolean;
      note: string;
    }
  ): Promise<{ person: PersonEnriched }> {
    return requestJson<{ person: PersonEnriched }>(
      `/api/people/${personId}/life-dates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, referenceDate: todayLocalISO() })
      }
    );
  },

  deleteLifeDate(id: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/life-dates/${id}`, {
      method: 'DELETE'
    });
  },

  createInteraction(payload: {
    personId: string;
    occurredAt: string;
    kind: InteractionKind;
    location: string;
    summary: string;
    followUp: string;
  }): Promise<{ interaction: Interaction; person: PersonEnriched }> {
    return requestJson<{ interaction: Interaction; person: PersonEnriched }>(
      '/api/interactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, referenceDate: todayLocalISO() })
      }
    );
  },

  deleteInteraction(id: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(`/api/interactions/${id}`, {
      method: 'DELETE'
    });
  },

  submitQuickLog(payload: {
    text: string;
    personId?: string | null;
    createPersonName?: string | null;
    circleId?: string;
    kind?: InteractionKind;
    occurredAt?: string;
    location?: string;
    summary?: string;
    followUp?: string;
  }): Promise<{ interaction: Interaction; person: PersonEnriched }> {
    return requestJson<{ interaction: Interaction; person: PersonEnriched }>(
      '/api/quick-log',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, referenceDate: todayLocalISO() })
      }
    );
  },

  setSampleData(enabled: boolean): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>('/api/sample-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, referenceDate: todayLocalISO() })
    });
  },

  resetWorkspace(): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>('/api/workspace/reset', {
      method: 'POST'
    });
  },

  async importJsonBackup(
    jsonText: string,
    mode: 'replace' | 'merge'
  ): Promise<{ ok: boolean; imported: Record<string, number> }> {
    const parsed = JSON.parse(jsonText);
    return requestJson(`/api/backup/json?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: parsed, mode })
    });
  },

  importCsvBackup(
    csvText: string,
    mode: 'replace' | 'merge'
  ): Promise<{ ok: boolean; imported: Record<string, number> }> {
    return requestJson(`/api/backup/csv?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      body: csvText
    });
  },

  importSqliteBackup(
    buffer: ArrayBuffer
  ): Promise<{ ok: boolean; imported: Record<string, number> }> {
    return requestJson('/api/backup/sqlite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer
    });
  },

  downloadUrl(path: string): string {
    return `${API_BASE}${path}`;
  }
};

export async function triggerDownload(
  path: string,
  fallbackFilename: string
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] || fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const CIRCLE_PALETTES: Record<
  CircleColorToken,
  { badge: string; border: string; dot: string; subtleBg: string }
> = {
  terracotta: {
    badge: 'bg-[#F8E7E0] text-[#9A4329] border-[#E8C4B6]',
    border: 'border-t-[#C86D51]',
    dot: 'bg-[#C86D51]',
    subtleBg: 'bg-[#FBF2EE]'
  },
  amber: {
    badge: 'bg-[#F9EEDB] text-[#8A561B] border-[#E7CFA7]',
    border: 'border-t-[#C9873E]',
    dot: 'bg-[#C9873E]',
    subtleBg: 'bg-[#FCF6EC]'
  },
  sage: {
    badge: 'bg-[#E7F0E9] text-[#3B5941] border-[#C1D6C5]',
    border: 'border-t-[#5D7A63]',
    dot: 'bg-[#5D7A63]',
    subtleBg: 'bg-[#F2F7F3]'
  },
  plum: {
    badge: 'bg-[#F1E8EE] text-[#6B4357] border-[#D8C2CE]',
    border: 'border-t-[#8A6275]',
    dot: 'bg-[#8A6275]',
    subtleBg: 'bg-[#F8F3F6]'
  }
};

export const WARMTH_STYLE: Record<
  WarmthStatus,
  { label: string; pill: string; bar: string }
> = {
  warm: {
    label: 'Warm',
    pill: 'bg-[#E7F0E9] text-[#3B5941]',
    bar: 'bg-[#5D7A63]'
  },
  'due-soon': {
    label: 'Due soon',
    pill: 'bg-[#F9EEDB] text-[#8A561B]',
    bar: 'bg-[#C9873E]'
  },
  overdue: {
    label: 'Ready for a catch-up',
    pill: 'bg-[#F8E7E0] text-[#9A4329]',
    bar: 'bg-[#C86D51]'
  },
  drifting: {
    label: 'Needs warmth',
    pill: 'bg-[#F3DCD6] text-[#873420]',
    bar: 'bg-[#B34F36]'
  },
  new: {
    label: 'Recently added',
    pill: 'bg-[#EFE9E1] text-[#6F6158]',
    bar: 'bg-[#9E8B7E]'
  }
};

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  coffee: 'Coffee / Tea',
  meal: 'Meal',
  walk: 'Walk',
  call: 'Phone Call',
  visit: 'Visit',
  meetup: 'IRL Meetup',
  note: 'Quick Note'
};
