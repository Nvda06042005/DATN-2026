import React, { useMemo, useState } from 'react';
import { Clock, Lock, MapPin, ScrollText } from 'lucide-react';
import { SchematicMap } from '@/components/customs/game/art/SchematicMap';
import { AdvisorChat } from '@/components/customs/game/codex/AdvisorChat';
import { CodexCard } from '@/components/customs/game/codex/CodexCard';
import { CodexSheet } from '@/components/customs/game/codex/CodexSheet';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/ui/section-title';
import { TIMELINE } from '@/constants/game/codex';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@/constants/game/exam';
import { MAP_PLACES } from '@/constants/game/places';
import { useGame } from '@/hooks/use-game';
import type { PlaceId } from '@/types/gameType';
import type { CodexEntry } from '@/types/learningType';

export const CodexTab: React.FC<{ sub: string; onSub: (s: string) => void; pendingQuestion: string | null; onConsumed: () => void }> = ({ sub, onSub, pendingQuestion, onConsumed }) => {
  const { codex, state, update, dark, bumpDaily } = useGame();
  const [open, setOpen] = useState<CodexEntry | null>(null);
  const [place, setPlace] = useState<PlaceId | null>(null);
  const byUnit = useMemo(() => Object.fromEntries(codex.map((e) => [e.unit_id, e])), [codex]);
  const unlockedSet = new Set(state.codex);
  const unlockedCount = codex.filter((e) => unlockedSet.has(e.unit_id)).length;

  const openEntry = (e: CodexEntry) => {
    setOpen(e);
    if (unlockedSet.has(e.unit_id)) bumpDaily('codex');
  };

  const tabs = [
    { id: 'timeline', label: 'Dòng thời gian' },
    { id: 'cards', label: `Thẻ Sử Ký (${unlockedCount}/${codex.length})` },
    { id: 'advisor', label: 'Quân Sư AI' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Sử Ký" subtitle="Bách khoa thu nhỏ về ba lần kháng chiến – nội dung khớp kho tri thức của Quân Sư" />
      <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-full sm:w-fit overflow-x-auto" role="tablist" aria-label="Sử Ký">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={sub === t.id}
            onClick={() => onSub(t.id)}
            className={`min-h-[44px] px-4 rounded-xl font-display font-bold whitespace-nowrap ${sub === t.id ? 'bg-the text-son-chu shadow-[0_2px_0_var(--color-vien-2)]' : 'text-muc-2'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'advisor' ? (
        <AdvisorChat pending={pendingQuestion} onConsumed={onConsumed} />
      ) : sub === 'cards' ? (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((c) => {
            const list = codex.filter((e) => e.category === c);
            if (!list.length) return null;
            return (
              <section key={c}>
                <h3 className="font-display font-extrabold text-lg mb-2">{CATEGORY_LABEL[c]}</h3>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {list.map((e) => (
                    <li key={e.unit_id}>
                      <CodexCard entry={e} unlocked={unlockedSet.has(e.unit_id)} onOpen={() => openEntry(e)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {!codex.length && <EmptyState mood="sad" title="Chưa tải được Sử Ký" text="Kiểm tra kết nối với máy chủ rồi mở lại trang nhé." />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 items-start">
          <div className="g-card overflow-hidden lg:sticky lg:top-4">
            <SchematicMap dark={dark} className="w-full h-auto" pins={TIMELINE.flatMap((t) => (t.place ? [t.place] : []))} highlight={place} title="Lược đồ các địa danh trong dòng thời gian" />
          </div>
          <ol className="relative border-l-4 border-vien ml-3 space-y-3">
            {TIMELINE.map((t, i) => {
              const entries = t.units.map((u) => byUnit[u]).filter(Boolean) as CodexEntry[];
              return (
                <li key={i} className="pl-5 relative">
                  <span className="absolute -left-[12px] top-3 w-5 h-5 rounded-full bg-son border-4 border-giay" aria-hidden="true" />
                  <div className="g-card p-3 space-y-2" onMouseEnter={() => setPlace(t.place ?? null)} onFocus={() => setPlace(t.place ?? null)}>
                    <p className="text-xs font-bold text-dong-chu flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden={true} /> {t.date}
                      {t.place && (
                        <span className="text-muc-2 font-semibold flex items-center gap-1">
                          · <MapPin className="w-3.5 h-3.5" aria-hidden={true} /> {MAP_PLACES[t.place].name}
                        </span>
                      )}
                    </p>
                    <p className="font-display font-extrabold leading-tight">{t.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map((e) => (
                        <button
                          key={e.unit_id}
                          type="button"
                          onClick={() => openEntry(e)}
                          className={`g-chip !min-h-[36px] !px-3 !whitespace-normal text-left border-2 ${unlockedSet.has(e.unit_id) ? 'bg-dong-nhat text-dong-chu border-dong' : 'bg-giay-2 text-muc-2 border-vien'}`}
                        >
                          {unlockedSet.has(e.unit_id) ? <ScrollText className="w-3.5 h-3.5" aria-hidden={true} /> : <Lock className="w-3.5 h-3.5" aria-hidden={true} />}
                          {e.topic}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <CodexSheet
        entry={open}
        unlocked={!!open && unlockedSet.has(open.unit_id)}
        onClose={() => setOpen(null)}
        onUnlocked={(unit) => {
          update((s) => ({ ...s, codex: [...new Set([...s.codex, unit])] }));
          bumpDaily('codex');
        }}
      />
    </div>
  );
};
