import {
  BookHeart,
  Command,
  HardDrive,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Users
} from 'lucide-react';

export type ActiveTab = 'ritual' | 'circles' | 'moments' | 'data';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  ritualCount: number;
  sampleDataEnabled: boolean;
  onOpenQuickLog: () => void;
  onOpenNewPerson: () => void;
  onClearSampleData: () => void;
}

export function Header({
  activeTab,
  onSelectTab,
  ritualCount,
  sampleDataEnabled,
  onOpenQuickLog,
  onOpenNewPerson,
  onClearSampleData
}: HeaderProps) {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof Sun;
    badge?: number;
  }> = [
    { id: 'ritual', label: 'Weekly Ritual', icon: Sun, badge: ritualCount },
    { id: 'circles', label: 'Circles & People', icon: Users },
    { id: 'moments', label: 'Moments', icon: BookHeart },
    { id: 'data', label: 'Data Ownership', icon: HardDrive }
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E8DFD3] bg-[#FAF6F0]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C86D51] text-[#FFFDF9] shadow-sm">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-xl font-semibold tracking-tight text-[#2B2420]">
                  Warm CRM
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D4DFD5] bg-[#EFF5F0] px-2 py-0.5 text-[11px] font-medium text-[#3B5941]">
                  <ShieldCheck className="h-3 w-3" />
                  100% Local
                </span>
              </div>
              <p className="text-xs text-[#6F6158]">
                A quiet companion for staying genuinely close IRL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenQuickLog}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DFD2C2] bg-[#FFFDF9] px-3.5 py-2 text-sm font-medium text-[#2B2420] shadow-xs transition hover:border-[#C86D51]/60 hover:bg-[#FBF5ED]"
            >
              <span>Quick Log</span>
              <kbd className="inline-flex items-center gap-0.5 rounded-md border border-[#E6DACB] bg-[#F4EDE3] px-1.5 py-0.5 text-[11px] font-medium text-[#6F6158]">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>

            <button
              type="button"
              onClick={onOpenNewPerson}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C86D51] px-3.5 py-2 text-sm font-medium text-[#FFFDF9] shadow-xs transition hover:bg-[#B55E43]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Person</span>
            </button>
          </div>
        </div>

        <nav className="-mb-px flex items-center gap-1 overflow-x-auto pb-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-[#C86D51] text-[#2B2420]'
                    : 'border-transparent text-[#6F6158] hover:border-[#DFD2C2] hover:text-[#2B2420]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-[#C86D51]' : 'text-[#8C7B70]'
                  }`}
                />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="rounded-full bg-[#F8E7E0] px-2 py-0.5 text-xs font-semibold text-[#9A4329]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {sampleDataEnabled && (
        <div className="border-t border-[#E8DFD3] bg-[#F5EDE2]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-[#5E5048] sm:px-6">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#C9873E]" />
              Exploring with realistic sample friends &amp; family — stored locally on your machine.
            </span>
            <button
              type="button"
              onClick={onClearSampleData}
              className="font-medium text-[#9A4329] underline decoration-[#C86D51]/50 underline-offset-2 hover:text-[#7E321B]"
            >
              Remove sample data
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
