import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { BootstrapResponse, PersonEnriched } from '../shared/types.js';
import { CirclesView } from './components/CirclesView.js';
import { DataOwnershipView } from './components/DataOwnershipView.js';
import { type ActiveTab, Header } from './components/Header.js';
import { MomentsView } from './components/MomentsView.js';
import { PersonDetailDrawer } from './components/PersonDetailDrawer.js';
import { PersonModal } from './components/PersonModal.js';
import { QuickLogModal } from './components/QuickLogModal.js';
import { WeeklyRitualView } from './components/WeeklyRitualView.js';
import { api } from './lib/api.js';

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ritual');
  const [toast, setToast] = useState<string | null>(null);

  // Modals & Drawers
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogTarget, setQuickLogTarget] = useState<PersonEnriched | null>(
    null
  );
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonEnriched | null>(
    null
  );
  const [defaultCircleId, setDefaultCircleId] = useState<string | undefined>(
    undefined
  );
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3200);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api.getBootstrap();
    setBootstrap(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Global Cmd+K / Ctrl+K shortcut for Quick Log
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickLogTarget(null);
        setQuickLogOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setQuickLogOpen(false);
        setPersonModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenQuickLog = (person?: PersonEnriched) => {
    setQuickLogTarget(person ?? null);
    setQuickLogOpen(true);
  };

  const handleOpenNewPerson = (circleId?: string) => {
    setEditingPerson(null);
    setDefaultCircleId(circleId);
    setPersonModalOpen(true);
  };

  const handleSnoozeWeek = async (personId: string) => {
    await api.snoozePerson(personId, 7);
    await refresh();
    notify('Snoozed gently for 7 days.');
  };

  const handleUpdateCircleCadence = async (
    circleId: string,
    cadenceDays: number
  ) => {
    await api.updateCircle(circleId, { cadenceDays });
    await refresh();
    notify(`Updated circle cadence to every ${cadenceDays} days.`);
  };

  const handleSavePerson = async (payload: {
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
  }) => {
    if (payload.id) {
      await api.updatePerson(payload.id, payload);
      notify(`Updated ${payload.name}.`);
    } else {
      await api.createPerson(payload);
      notify(`Added ${payload.name} to your circles.`);
    }
    await refresh();
  };

  const handleClearSampleData = async () => {
    await api.setSampleData(false);
    await refresh();
    notify('Sample data removed — ready for your own circle.');
  };

  if (loading || !bootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F0] text-sm text-[#6F6158]">
        Opening your local Warm CRM notebook...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2B2420]">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        ritualCount={bootstrap.ritual.items.length}
        sampleDataEnabled={bootstrap.stats.sampleDataEnabled}
        onOpenQuickLog={() => handleOpenQuickLog()}
        onOpenNewPerson={() => handleOpenNewPerson()}
        onClearSampleData={() => void handleClearSampleData()}
      />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        {activeTab === 'ritual' && (
          <WeeklyRitualView
            ritual={bootstrap.ritual}
            totalPeopleCount={bootstrap.people.length}
            onLogCatchUp={(p) => handleOpenQuickLog(p)}
            onSnoozeWeek={(id) => void handleSnoozeWeek(id)}
            onOpenPerson={(id) => setDrawerPersonId(id)}
            onGoToData={() => setActiveTab('data')}
            onOpenNewPerson={() => handleOpenNewPerson()}
          />
        )}

        {activeTab === 'circles' && (
          <CirclesView
            circles={bootstrap.circles}
            people={bootstrap.people}
            onUpdateCircleCadence={handleUpdateCircleCadence}
            onOpenPerson={(id) => setDrawerPersonId(id)}
            onLogCatchUp={(p) => handleOpenQuickLog(p)}
            onOpenNewPerson={handleOpenNewPerson}
          />
        )}

        {activeTab === 'moments' && (
          <MomentsView
            interactions={bootstrap.recentInteractions}
            onOpenPerson={(id) => setDrawerPersonId(id)}
            onDeleteInteraction={async (id) => {
              await api.deleteInteraction(id);
              await refresh();
              notify('Removed catch-up entry.');
            }}
            onOpenQuickLog={() => handleOpenQuickLog()}
          />
        )}

        {activeTab === 'data' && (
          <DataOwnershipView
            stats={bootstrap.stats}
            onRefresh={refresh}
            onNotify={notify}
          />
        )}
      </main>

      <QuickLogModal
        isOpen={quickLogOpen}
        people={bootstrap.people}
        circles={bootstrap.circles}
        initialPerson={quickLogTarget}
        onClose={() => setQuickLogOpen(false)}
        onSubmit={async (payload) => {
          const result = await api.submitQuickLog(payload);
          await refresh();
          notify(`Logged catch-up with ${result.person.name}.`);
        }}
      />

      <PersonModal
        isOpen={personModalOpen}
        circles={bootstrap.circles}
        editingPerson={editingPerson}
        defaultCircleId={defaultCircleId}
        onClose={() => setPersonModalOpen(false)}
        onSave={handleSavePerson}
      />

      <PersonDetailDrawer
        personId={drawerPersonId}
        onClose={() => setDrawerPersonId(null)}
        onEditPerson={(p) => {
          setDrawerPersonId(null);
          setEditingPerson(p);
          setPersonModalOpen(true);
        }}
        onDeletedPerson={async () => {
          await refresh();
          notify('Removed profile from local database.');
        }}
        onUpdated={refresh}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-[#C1D6C5] bg-[#EFF5F0] px-4 py-2.5 text-xs font-semibold text-[#3B5941] shadow-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
