import React, { useEffect, useState } from 'react';
import { ChevronRight, HelpCircle, KeyRound, LogOut, Medal, Monitor, Moon, Sparkles, Sun, Timer, Volume2, VolumeX } from 'lucide-react';
import * as studentApi from '@/api/studentApi';
import { GBtn } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Toggle } from '@/components/ui/toggle';
import { PHASES } from '@/constants/game/campaigns';
import { HEROES } from '@/constants/game/heroes';
import { useGame } from '@/hooks/use-game';
import { levelOf } from '@/store/game.store';
import type { GameSettings } from '@/types/gameType';
import type { LeaderboardEntry } from '@/types/learningType';
import { avatarColor, fmt, initialsOf } from '@/utils/format';

export const ProfileSheet: React.FC<{ open: boolean; onClose: () => void; onLogout: () => void; onChangePassword: () => void; onTutorial: () => void }> = ({ open, onClose, onLogout, onChangePassword, onTutorial }) => {
  const { user, progress, state, update, request } = useGame();
  const [tab, setTab] = useState<'rank' | 'settings'>('rank');
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const lvl = levelOf(progress.xp);
  const heroes = Object.keys(state.heroes).length;
  const stars = PHASES.reduce((s, p) => s + (state.campaign[p.id] ?? 0), 0);

  useEffect(() => {
    if (!open || tab !== 'rank') return;
    let alive = true;
    setBoard(null);
    request(studentApi.getLeaderboard)
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setBoard([]));
    return () => {
      alive = false;
    };
  }, [open, tab, request]);

  const setSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  return (
    <Sheet open={open} onClose={onClose} title={user.full_name} subtitle={`${user.username}${user.class_name ? ` · Lớp ${user.class_name}` : ''}`} wide icon={<span className="w-12 h-12 rounded-full text-white font-display font-extrabold text-lg flex items-center justify-center" style={{ background: avatarColor(user.username) }}>{initialsOf(user.full_name)}</span>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Cấp độ', value: `Cấp ${lvl}` },
            { label: 'XP tuần này', value: fmt(progress.week_xp) },
            { label: 'Sao chiến dịch', value: `${stars}/27` },
            { label: 'Tướng', value: `${heroes}/${HEROES.length}` },
          ].map((x) => (
            <div key={x.label} className="g-card-flat p-3">
              <p className="text-xs font-semibold text-muc-2">{x.label}</p>
              <p className="font-display font-extrabold text-lg tabular">{x.value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-2xl bg-giay-2 w-fit" role="tablist" aria-label="Hồ sơ">
          {(
            [
              ['rank', 'Bảng xếp hạng tuần'],
              ['settings', 'Cài đặt'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-[44px] px-4 rounded-xl font-display font-bold ${tab === id ? 'bg-the text-son-chu shadow-[0_2px_0_var(--color-vien-2)]' : 'text-muc-2'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'rank' ? (
          board === null ? (
            <Spinner />
          ) : board.length === 0 ? (
            <p className="text-sm text-muc-2">Chưa có dữ liệu xếp hạng của lớp.</p>
          ) : (
            <ol className="grid gap-2">
              {board.map((e, i) => (
                <li key={e.id} className={`flex items-center gap-3 rounded-2xl p-2.5 border-2 ${e.is_me ? 'border-dong bg-dong-nhat' : 'border-vien bg-the'}`}>
                  <span className={`w-8 text-center font-display font-extrabold ${i < 3 ? 'text-dong-chu' : 'text-muc-2'}`}>{i < 3 ? <Medal className="w-5 h-5 mx-auto" aria-label={`Hạng ${i + 1}`} /> : i + 1}</span>
                  <span className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center" style={{ background: avatarColor(e.full_name) }} aria-hidden="true">
                    {initialsOf(e.full_name)}
                  </span>
                  <span className="flex-1 min-w-0 font-semibold truncate">
                    {e.full_name}
                    {e.is_me && <span className="ml-1 text-xs text-dong-chu">(em)</span>}
                  </span>
                  <span className="text-right">
                    <span className="block font-display font-extrabold tabular">{fmt(e.week_xp)} XP</span>
                    <span className="block text-xs text-muc-2 tabular">tổng {fmt(e.xp)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )
        ) : (
          <div className="g-card-flat px-4 py-2 divide-y-2 divide-vien">
            <div className="py-2">
              <p className="font-semibold mb-2">Giao diện</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Chế độ màu">
                {(
                  [
                    ['system', 'Theo máy', Monitor],
                    ['light', 'Giấy dó', Sun],
                    ['dark', 'Đêm Bạch Đằng', Moon],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={state.settings.theme === id}
                    onClick={() => setSetting('theme', id)}
                    className={`min-h-[64px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-sm font-semibold ${state.settings.theme === id ? 'border-son bg-son-nhat text-son-chu' : 'border-vien bg-the text-muc-2'}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden={true} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle Icon={Timer} label="Đồng hồ đếm giờ khi trả lời" desc="Tắt nếu em cần đọc chậm" checked={state.settings.timer} onChange={(v) => setSetting('timer', v)} />
            <Toggle Icon={state.settings.sound ? Volume2 : VolumeX} label="Âm thanh" desc="Mặc định tắt khi học trên lớp" checked={state.settings.sound} onChange={(v) => setSetting('sound', v)} />
            <Toggle Icon={Sparkles} label="Giảm chuyển động" desc="Tắt rung, hạt và hiệu ứng chuyển động" checked={state.settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
            <button type="button" onClick={onTutorial} className="w-full flex items-center gap-3 min-h-[56px] text-left">
              <span className="w-10 h-10 rounded-xl bg-giay-2 text-muc-2 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" aria-hidden={true} />
              </span>
              <span className="font-semibold flex-1">Xem lại hướng dẫn chơi</span>
              <ChevronRight className="w-5 h-5 text-muc-3" aria-hidden={true} />
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <GBtn variant="giay" onClick={onChangePassword}>
            <KeyRound className="w-4 h-4" aria-hidden={true} /> Đổi mật khẩu
          </GBtn>
          <GBtn variant="son" className="ml-auto" onClick={onLogout}>
            <LogOut className="w-4 h-4" aria-hidden={true} /> Đăng xuất
          </GBtn>
        </div>
      </div>
    </Sheet>
  );
};
