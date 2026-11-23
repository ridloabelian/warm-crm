import { useRef, useState } from 'react';
import {
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload
} from 'lucide-react';
import { todayLocalISO } from '../../shared/dates.js';
import type { WorkspaceStats } from '../../shared/types.js';
import { api, triggerDownload } from '../lib/api.js';

interface DataOwnershipViewProps {
  stats: WorkspaceStats;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'In-memory / 0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DataOwnershipView({
  stats,
  onRefresh,
  onNotify
}: DataOwnershipViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExport = async (kind: 'json' | 'csv' | 'sqlite') => {
    setError(null);
    const stamp = todayLocalISO();
    try {
      if (kind === 'json') {
        await triggerDownload('/api/backup/json', `warm-crm-backup-${stamp}.json`);
        onNotify('Exported full JSON backup.');
      } else if (kind === 'csv') {
        await triggerDownload('/api/backup/csv', `warm-crm-contacts-${stamp}.csv`);
        onNotify('Exported contacts & history CSV.');
      } else {
        await triggerDownload('/api/backup/sqlite', `warm-crm-${stamp}.sqlite`);
        onNotify('Exported standalone SQLite database file.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      const lower = file.name.toLowerCase();
      let result: { ok: boolean; imported: Record<string, number> };

      if (lower.endsWith('.json')) {
        const text = await file.text();
        result = await api.importJsonBackup(text, importMode);
      } else if (lower.endsWith('.csv')) {
        const text = await file.text();
        result = await api.importCsvBackup(text, importMode);
      } else if (
        lower.endsWith('.sqlite') ||
        lower.endsWith('.sqlite3') ||
        lower.endsWith('.db')
      ) {
        const buf = await file.arrayBuffer();
        result = await api.importSqliteBackup(buf);
      } else {
        throw new Error(
          'Unsupported file type. Choose a .json, .csv, or .sqlite / .db backup.'
        );
      }

      await onRefresh();
      onNotify(
        `Restored ${result.imported.people ?? 0} people and ${result.imported.interactions ?? 0} moments.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggleSampleData = async () => {
    setBusy(true);
    setError(null);
    try {
      const target = !stats.sampleDataEnabled;
      await api.setSampleData(target);
      await onRefresh();
      onNotify(
        target
          ? 'Sample friends & family loaded locally.'
          : 'Sample data removed (your own contacts remain intact).'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle sample data.');
    } finally {
      setBusy(false);
    }
  };

  const handleBlankReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetWorkspace();
      setConfirmReset(false);
      await onRefresh();
      onNotify('Workspace cleared to a clean blank slate.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset workspace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Local SQLite Ownership Banner */}
      <section className="warm-card rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF5F0] px-3 py-1 text-xs font-medium text-[#3B5941]">
              <ShieldCheck className="h-3.5 w-3.5" />
              True Local Data Ownership
            </div>
            <h2 className="font-editorial text-2xl font-semibold text-[#2B2420]">
              Your Relationships Stay on Your Machine
            </h2>
            <p className="max-w-2xl text-sm text-[#6F6158]">
              Warm CRM stores everything in a single local SQLite file with zero cloud sync, zero analytics, and zero account lock-in. Take your data anywhere in one click.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="warm-soft rounded-xl p-3.5 sm:col-span-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6F6158]">
              <HardDrive className="h-3.5 w-3.5 text-[#C86D51]" />
              Local SQLite File
            </div>
            <p className="mt-1 break-all font-mono text-xs text-[#2B2420]">
              {stats.dbPath}
            </p>
            <p className="mt-1 text-[11px] text-[#7D6C62]">
              Size on disk: {formatBytes(stats.dbSizeBytes)}
            </p>
          </div>

          <div className="warm-soft rounded-xl p-3.5">
            <div className="text-xs font-semibold text-[#6F6158]">People</div>
            <div className="mt-1 font-editorial text-2xl font-semibold text-[#2B2420]">
              {stats.peopleCount}
            </div>
            <div className="text-[11px] text-[#7D6C62]">
              across {stats.circleCount} circles
            </div>
          </div>

          <div className="warm-soft rounded-xl p-3.5">
            <div className="text-xs font-semibold text-[#6F6158]">Memories</div>
            <div className="mt-1 font-editorial text-2xl font-semibold text-[#2B2420]">
              {stats.interactionCount}
            </div>
            <div className="text-[11px] text-[#7D6C62]">
              + {stats.lifeDateCount} life dates
            </div>
          </div>
        </div>
      </section>

      {/* 1-Click Exports */}
      <section className="warm-card rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-[#C86D51]" />
          <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
            1-Click Full Backup Export
          </h3>
        </div>
        <p className="mt-1 text-sm text-[#6F6158]">
          Download a complete snapshot at any time for safekeeping, spreadsheet editing, or moving machines.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void handleExport('json')}
            className="flex items-start gap-3 rounded-2xl border border-[#E5DCCF] bg-[#FCF9F4] p-4 text-left transition hover:border-[#C86D51]/60 hover:bg-[#FFFDF9]"
          >
            <FileJson className="mt-0.5 h-5 w-5 shrink-0 text-[#C86D51]" />
            <div>
              <div className="text-sm font-semibold text-[#2B2420]">
                Full JSON Backup
              </div>
              <p className="mt-0.5 text-xs text-[#6F6158]">
                Lossless circles, people, life dates, and catch-up history.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('csv')}
            className="flex items-start gap-3 rounded-2xl border border-[#E5DCCF] bg-[#FCF9F4] p-4 text-left transition hover:border-[#C86D51]/60 hover:bg-[#FFFDF9]"
          >
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-[#5D7A63]" />
            <div>
              <div className="text-sm font-semibold text-[#2B2420]">
                Spreadsheet CSV
              </div>
              <p className="mt-0.5 text-xs text-[#6F6158]">
                Open in Numbers, Excel, or LibreOffice — preserves full history too.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('sqlite')}
            className="flex items-start gap-3 rounded-2xl border border-[#E5DCCF] bg-[#FCF9F4] p-4 text-left transition hover:border-[#C86D51]/60 hover:bg-[#FFFDF9]"
          >
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#8A6275]" />
            <div>
              <div className="text-sm font-semibold text-[#2B2420]">
                Raw SQLite Database
              </div>
              <p className="mt-0.5 text-xs text-[#6F6158]">
                Clean single-file <code className="text-[11px]">.sqlite</code> archive via VACUUM INTO.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Import & Restore */}
      <section className="warm-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#5D7A63]" />
              <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
                Import or Restore Backup
              </h3>
            </div>
            <p className="mt-1 text-sm text-[#6F6158]">
              Restore from a <code className="text-xs">.json</code>,{' '}
              <code className="text-xs">.csv</code>, or{' '}
              <code className="text-xs">.sqlite</code> /{' '}
              <code className="text-xs">.db</code> file.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[#F4EDE3] p-1 text-xs">
            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                importMode === 'replace'
                  ? 'bg-[#FFFDF9] text-[#2B2420] shadow-xs'
                  : 'text-[#6F6158]'
              }`}
            >
              Replace all
            </button>
            <button
              type="button"
              onClick={() => setImportMode('merge')}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                importMode === 'merge'
                  ? 'bg-[#FFFDF9] text-[#2B2420] shadow-xs'
                  : 'text-[#6F6158]'
              }`}
            >
              Merge (JSON/CSV)
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.sqlite,.sqlite3,.db"
            onChange={(e) => void handleFileChange(e)}
            disabled={busy}
            className="hidden"
            id="warm-crm-backup-upload"
          />
          <label
            htmlFor="warm-crm-backup-upload"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#2B2420] px-4 py-2.5 text-xs font-semibold text-[#FFFDF9] hover:bg-[#3F3630]"
          >
            <Upload className="h-4 w-4" />
            {busy ? 'Importing...' : 'Choose Backup File (.json, .csv, .sqlite)'}
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#F8E7E0] px-3.5 py-2 text-xs font-medium text-[#9A4329]">
            {error}
          </p>
        )}
      </section>

      {/* Sample Data & Reset */}
      <section className="warm-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#C9873E]" />
              <h3 className="font-editorial text-lg font-semibold text-[#2B2420]">
                Sample Data &amp; Blank Slate
              </h3>
            </div>
            <p className="mt-1 text-sm text-[#6F6158]">
              Toggle realistic sample friends &amp; family on or off at any time without erasing the real people you&apos;ve added.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleSampleData()}
              className="rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#2B2420] hover:bg-[#F4EDE3]"
            >
              {stats.sampleDataEnabled
                ? 'Remove Sample Data'
                : 'Load Sample Data'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBlankReset()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
                confirmReset
                  ? 'bg-[#B34F36] text-white'
                  : 'border border-[#E8C4B6] bg-[#F8E7E0] text-[#9A4329] hover:bg-[#F2D6CA]'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {confirmReset
                ? 'Click again to wipe all local data'
                : 'Reset to Blank Slate'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
