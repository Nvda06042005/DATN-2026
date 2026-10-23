import React, { useState } from 'react';
import { ArrowUpCircle, BicepsFlexed, Check, ChevronRight, Clock, Hammer, Sailboat, Shield, Stamp, Users, Wheat } from 'lucide-react';
import { BuildingSprite } from '@/components/customs/game/art/BuildingSprite';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Bar } from '@/components/ui/progress-bar';
import { Sheet } from '@/components/ui/sheet';
import { BUILDING_BY_ID, UPGRADE_SECONDS, farmCap, farmRate, storeCap, troopCap, upgradeCost } from '@/constants/game/buildings';
import { useGame } from '@/hooks/use-game';
import { farmReady } from '@/store/game.store';
import type { BuildingId, GameState, GameTab } from '@/types/gameType';
import { fmt, fmtClock } from '@/utils/format';

export const BuildingSheet: React.FC<{ id: BuildingId | null; now: number; onClose: () => void; onGoto: (tab: GameTab, sub?: string) => void }> = ({ id, now, onClose, onGoto }) => {
  const { state, update, progress, spendGems, toast, bumpDaily } = useGame();
  const [quiz, setQuiz] = useState(false);
  const def = id ? BUILDING_BY_ID[id] : null;
  if (!def) return null;
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const toLevel = b.level + 1;
  const maxed = b.level >= def.maxLevel;
  const cost = b.level === 0 ? { luong: def.buildCost, gems: 0 } : upgradeCost(def, toLevel);
  const canPay = state.luong >= cost.luong && progress.gems >= cost.gems;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const storeLeft = storeCap(state.buildings.kho.level) - state.luong;

  const startUpgrade = async () => {
    if (cost.gems > 0 && !(await spendGems(cost.gems, `nang_cap:${def.id}:${toLevel}`))) return;
    const seconds = b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)];
    update((s) => ({
      ...s,
      luong: Math.max(0, s.luong - cost.luong),
      buildings: { ...s.buildings, [def.id]: { ...s.buildings[def.id], upgradeEnds: Date.now() + seconds * 1000 } },
    }));
    toast(b.level === 0 ? `Bắt đầu xây ${def.name}` : `Bắt đầu nâng ${def.name} lên cấp ${toLevel}`);
  };

  const harvest = () => {
    const take = Math.min(ready, Math.max(0, storeLeft));
    if (take <= 0) {
      toast(storeLeft <= 0 ? 'Kho Bí Mật đã đầy – hãy nâng cấp kho' : 'Ruộng chưa có lúa chín');
      return;
    }
    const rate = farmRate(b.level);
    update((s) => ({
      ...s,
      luong: s.luong + take,
      buildings: {
        ...s.buildings,
        ruong: { ...s.buildings.ruong, lastCollect: take >= ready ? Date.now() : s.buildings.ruong.lastCollect + (take / rate) * 3_600_000 },
      },
      stats: { ...s.stats, harvests: s.stats.harvests + 1 },
    }));
    bumpDaily('harvest');
    toast(`Thu hoạch +${fmt(take)} Lương Thảo`);
  };

  const trade = (luong: number, effect: (s: GameState) => GameState, msg: string) => {
    if (state.luong < luong) {
      toast('Chưa đủ Lương Thảo');
      return;
    }
    update((s) => effect({ ...s, luong: s.luong - luong }));
    toast(msg);
  };
  const quanCap = troopCap(state.buildings.trai.level);
  const batch = 5 * state.buildings.trai.level;

  return (
    <>
      <Sheet
        open={!!id && !quiz}
        onClose={onClose}
        title={def.name}
        subtitle={b.level === 0 ? 'Chưa xây' : `Cấp ${b.level}/${def.maxLevel} · ${def.levelText(b.level)}`}
        icon={<BuildingSprite id={def.id} level={Math.max(1, b.level)} className="w-16 h-14" />}
      >
        <div className="space-y-4">
          <p className="text-muc leading-relaxed">{def.desc}</p>

          {def.id === 'ruong' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muc-2">Lúa chín chờ thu</span>
                <span className="font-display font-extrabold text-xl text-ngoc-chu tabular">
                  {fmt(ready)} / {fmt(farmCap(b.level))}
                </span>
              </div>
              <Bar value={ready} max={farmCap(b.level)} fill="bg-ngoc" label="Lúa chín trên ruộng" />
              <GBtn variant="ngoc" size="lg" className="w-full" onClick={harvest} disabled={ready < 1}>
                <Wheat className="w-5 h-5" aria-hidden={true} /> Thu hoạch
              </GBtn>
              <InfoNote>Ruộng vẫn sinh lúa khi em tắt máy, tối đa 8 giờ sản lượng. Thời bình binh lính về làm ruộng – đó là “ngụ binh ư nông”.</InfoNote>
            </div>
          )}

          {def.id === 'trai' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muc-2">Quân Lực</span>
                <span className="font-display font-extrabold text-xl tabular">
                  {fmt(state.quan)} / {fmt(quanCap)}
                </span>
              </div>
              <GBtn
                variant="son"
                className="w-full"
                disabled={state.quan >= quanCap}
                onClick={() =>
                  trade(batch * 10, (s) => ({ ...s, quan: Math.min(quanCap, s.quan + batch) }), `Đã gọi ${batch} Quân Lực ra trận`)
                }
              >
                <Shield className="w-5 h-5" aria-hidden={true} /> Gọi {batch} Quân Lực ({batch * 10} Lương Thảo)
              </GBtn>
              <GBtn variant="giay" className="w-full" onClick={() => trade(60, (s) => ({ ...s, cards: { ...s.cards, dan_binh: (s.cards.dan_binh ?? 0) + 1 } }), 'Nhận thẻ Dân binh Ngụ Binh')}>
                <Users className="w-5 h-5" aria-hidden={true} /> Gọi Dân binh Ngụ Binh (60 Lương Thảo)
              </GBtn>
              {state.heroes.quan_sat_that && (
                <GBtn variant="giay" className="w-full" onClick={() => trade(120, (s) => ({ ...s, cards: { ...s.cards, quan_sat_that: (s.cards.quan_sat_that ?? 0) + 1 } }), 'Nhận thẻ Quân Sát Thát')}>
                  <BicepsFlexed className="w-5 h-5" aria-hidden={true} /> Huấn luyện Quân Sát Thát (120 Lương Thảo)
                </GBtn>
              )}
              <p className="text-sm text-muc-2">Thẻ đang có: Dân binh ×{state.cards.dan_binh ?? 0}{state.heroes.quan_sat_that ? ` · Quân Sát Thát ×${state.cards.quan_sat_that ?? 0}` : ''}</p>
            </div>
          )}

          {def.id === 'kho' && (
            <div className="g-card-flat p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muc-2">Lương Thảo trong kho</span>
                <span className="font-display font-extrabold text-xl tabular">
                  {fmt(state.luong)} / {fmt(storeCap(b.level))}
                </span>
              </div>
              <Bar value={state.luong} max={storeCap(b.level)} fill="bg-dong" label="Lương Thảo trong kho" />
              <InfoNote>Khi giặc kéo đến cướp lương, chọn “Vườn không nhà trống” để giấu hết lương vào kho – giặc vào điền trang trống sẽ kiệt sức mà rút.</InfoNote>
            </div>
          )}

          {def.id === 'xuong' && (
            <ol className="grid gap-2">
              {['Cọc gỗ đẽo nhọn', 'Cọc gỗ đầu bịt sắt', 'Trận địa cọc kết hợp mai phục (4/1288)'].map((t, i) => (
                <li key={t} className={`g-card-flat p-3 flex items-center gap-3 ${b.level >= i + 1 ? '' : 'opacity-60'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${b.level >= i + 1 ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>{i + 1}</span>
                  <span className="font-semibold">{t}</span>
                  {b.level >= i + 1 && <Check className="w-5 h-5 text-ngoc-chu ml-auto" aria-label="Đã có" />}
                </li>
              ))}
              <InfoNote>Cấp xưởng càng cao, tuyệt chiêu “Đại trận Bạch Đằng” càng mạnh (Màn 3).</InfoNote>
            </ol>
          )}

          {def.id === 'ben' && b.level > 0 && (
            <div className="g-card-flat p-4 space-y-2">
              <GBtn variant="giay" className="w-full" onClick={() => trade(80, (s) => ({ ...s, cards: { ...s.cards, thuy_binh: (s.cards.thuy_binh ?? 0) + 1 } }), 'Nhận thẻ Thủy binh')}>
                <Sailboat className="w-5 h-5" aria-hidden={true} /> Gọi Thủy binh (80 Lương Thảo)
              </GBtn>
              <p className="text-sm text-muc-2">Thẻ Thủy binh: ×{state.cards.thuy_binh ?? 0}. Nâng bến lên cấp 3 để nhận cổ vật Nón Ma Lôi.</p>
            </div>
          )}

          {(def.id === 'doanh' || def.id === 'hoiquan' || def.id === 'qtg') && b.level > 0 && (
            <GBtn
              variant="ngoc"
              size="lg"
              className="w-full"
              onClick={() => {
                onClose();
                onGoto(def.id === 'qtg' ? 'exam' : 'barracks', def.id === 'hoiquan' ? 'recruit' : 'heroes');
              }}
            >
              {def.id === 'qtg' ? 'Vào Quốc Tử Giám' : def.id === 'hoiquan' ? 'Vào Hội Quán Vạn Kiếp' : 'Vào Doanh Trại'} <ChevronRight className="w-5 h-5" aria-hidden={true} />
            </GBtn>
          )}

          <div className="g-inset p-4 space-y-3">
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <ArrowUpCircle className="w-5 h-5 text-dong-chu" aria-hidden={true} />
              {maxed ? 'Đã đạt cấp tối đa' : b.level === 0 ? 'Xây công trình' : `Nâng lên cấp ${toLevel}`}
            </div>
            {upgrading ? (
              <div className="space-y-2">
                <p className="font-semibold">
                  Đang thi công · còn <span className="tabular">{fmtClock(((b.upgradeEnds ?? now) - now) / 1000)}</span>
                </p>
                <Bar value={1 - ((b.upgradeEnds ?? now) - now) / ((b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)]) * 1000)} max={1} fill="bg-dong" label="Tiến độ thi công" />
              </div>
            ) : (
              !maxed && (
                <>
                  <p className="text-sm text-muc-2">{def.levelText(toLevel)}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`g-chip !text-sm ${state.luong >= cost.luong ? 'bg-the text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Wheat className="w-4 h-4" aria-hidden={true} /> {fmt(cost.luong)} Lương Thảo
                    </span>
                    {cost.gems > 0 && (
                      <span className={`g-chip !text-sm ${progress.gems >= cost.gems ? 'bg-the text-muc' : 'bg-son-nhat text-son-chu'}`}>
                        <Stamp className="w-4 h-4" aria-hidden={true} /> {cost.gems} Ấn Tín
                      </span>
                    )}
                    <span className="g-chip !text-sm bg-the text-muc-2">
                      <Clock className="w-4 h-4" aria-hidden={true} /> {fmtClock(b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)])}
                    </span>
                  </div>
                  <GBtn variant="dong" size="lg" className="w-full" disabled={!canPay} onClick={() => setQuiz(true)}>
                    <Hammer className="w-5 h-5" aria-hidden={true} /> Trả lời 1 câu để {b.level === 0 ? 'xây' : 'nâng cấp'}
                  </GBtn>
                  {!canPay && <p className="text-sm text-son-chu font-semibold">Chưa đủ tài nguyên. Thu hoạch ruộng hoặc trả lời đúng ở Quốc Tử Giám để có thêm.</p>}
                </>
              )
            )}
          </div>
        </div>
      </Sheet>
      <QuizSheet
        open={quiz}
        onClose={() => setQuiz(false)}
        title={`${b.level === 0 ? 'Xây' : 'Nâng cấp'} ${def.name}`}
        subtitle="Trả lời đúng để bắt đầu thi công"
        request={{ units: [def.unit], count: 1 }}
        passMark={1}
        sessionKind={null}
        finishLabel="Tiếp tục"
        onFinish={(sum) => {
          if (sum.passed) startUpgrade();
          else toast('Chưa trả lời đúng – công trình chưa được thi công. Thử lại nhé!');
        }}
      />
    </>
  );
};
