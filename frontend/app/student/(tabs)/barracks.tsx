import React from 'react';
import { HeroesPanel } from '@/components/customs/game/barracks/HeroesPanel';
import { RecruitPanel } from '@/components/customs/game/barracks/RecruitPanel';
import { RelicsPanel } from '@/components/customs/game/barracks/RelicsPanel';
import { SectionTitle } from '@/components/ui/section-title';

export const BarracksTab: React.FC<{ sub: string; onSub: (s: string) => void }> = ({ sub, onSub }) => {
  const tabs: Array<{ id: string; label: string }> = [
    { id: 'heroes', label: 'Tướng' },
    { id: 'recruit', label: 'Hội Quán Vạn Kiếp' },
    { id: 'relics', label: 'Cổ vật' },
  ];
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Doanh Trại" subtitle="Năm hệ quân theo địa danh, chiêu mộ tướng và cổ vật" />
      <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-full sm:w-fit overflow-x-auto" role="tablist" aria-label="Doanh Trại">
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
      <div role="tabpanel">{sub === 'recruit' ? <RecruitPanel /> : sub === 'relics' ? <RelicsPanel /> : <HeroesPanel />}</div>
    </div>
  );
};
