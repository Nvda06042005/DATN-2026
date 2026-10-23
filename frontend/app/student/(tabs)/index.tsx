import React, { useState } from 'react';
import { AlertTriangle, Shield, Siren, Wheat } from 'lucide-react';
import { FarmBoardArt } from '@/components/customs/game/art/FarmBoardArt';
import { BuildingButton } from '@/components/customs/game/farm/BuildingButton';
import { BuildingSheet } from '@/components/customs/game/farm/BuildingSheet';
import { DailyPanel } from '@/components/customs/game/farm/DailyPanel';
import { RaidEvent } from '@/components/customs/game/farm/RaidEvent';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/section-title';
import { BUILDINGS, storeCap, troopCap } from '@/constants/game/buildings';
import { useGame } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { levelOf, raidDue } from '@/store/game.store';
import type { BuildingId, GameTab } from '@/types/gameType';
import { fmt } from '@/utils/format';

export const FarmTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, dark, progress } = useGame();
  const now = useNow(1000);
  const [open, setOpen] = useState<BuildingId | null>(null);
  const [raid, setRaid] = useState(false);
  const due = raidDue(state);
  const lvl = levelOf(progress.xp);
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <div className="space-y-4 min-w-0">
        <SectionTitle title="Điền Trang Đông A" subtitle="Ngụ binh ư nông: thời bình làm ruộng, có giặc thì ra trận." action={<span className="g-chip bg-son text-white !text-sm">Cấp {lvl}</span>} />
        {due && (
          <div className="rounded-3xl border-2 border-son bg-son-nhat p-4 flex flex-wrap items-center gap-3 animate-pop-in" role="alert">
            <span className="w-12 h-12 rounded-2xl bg-son text-white flex items-center justify-center animate-alarm">
              <Siren className="w-7 h-7" aria-hidden={true} />
            </span>
            <div className="flex-1 min-w-[180px]">
              <p className="font-display font-extrabold text-lg text-son-chu">Giặc Mông – Nguyên kéo đến cướp lương!</p>
              <p className="text-sm text-muc">Ứng phó ngay để bảo vệ {fmt(state.luong)} Lương Thảo.</p>
            </div>
            <GBtn onClick={() => setRaid(true)}>
              <AlertTriangle className="w-5 h-5" aria-hidden={true} /> Ứng phó
            </GBtn>
          </div>
        )}
        <div className="relative w-full max-w-[640px] mx-auto aspect-square rounded-[36px] overflow-visible">
          <div className="absolute inset-0 rounded-[36px] overflow-hidden border-4 border-vien" style={{ boxShadow: '0 8px 0 var(--color-vien-2)' }}>
            <FarmBoardArt dark={dark} />
          </div>
          {BUILDINGS.map((def) => (
            <BuildingButton key={def.id} def={def} now={now} onOpen={() => setOpen(def.id)} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="g-card-flat p-3">
            <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
              <Wheat className="w-4 h-4 text-dong-chu" aria-hidden={true} /> Lương Thảo
            </p>
            <p className="font-display font-extrabold text-xl tabular">
              {fmt(state.luong)} <span className="text-sm text-muc-2">/ {fmt(storeCap(state.buildings.kho.level))}</span>
            </p>
          </div>
          <div className="g-card-flat p-3">
            <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-son-chu" aria-hidden={true} /> Quân Lực
            </p>
            <p className="font-display font-extrabold text-xl tabular">
              {fmt(state.quan)} <span className="text-sm text-muc-2">/ {fmt(troopCap(state.buildings.trai.level))}</span>
            </p>
          </div>
        </div>
      </div>
      <aside className="space-y-4">
        <DailyPanel />
        <section className="g-card p-4 space-y-2">
          <h3 className="font-display font-extrabold text-lg">Mẹo của Rồng Con</h3>
          <div className="flex items-start gap-3">
            <Mascot size={64} mood="happy" accessory="conical" className="shrink-0" />
            <p className="text-sm text-muc leading-relaxed">
              Chạm vào công trình để thu hoạch hoặc nâng cấp. Mỗi lần nâng cấp phải trả lời đúng một câu – <strong>kiến thức là vũ khí</strong>! Ấn Tín chỉ có khi em trả lời đúng ở
              server.
            </p>
          </div>
        </section>
      </aside>
      <BuildingSheet id={open} now={now} onClose={() => setOpen(null)} onGoto={onGoto} />
      {raid && <RaidEvent onDone={() => setRaid(false)} />}
    </div>
  );
};
