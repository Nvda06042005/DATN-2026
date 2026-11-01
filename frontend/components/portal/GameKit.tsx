/**
 * Thành phần trò chơi hóa dùng chung (Sprint 5): biểu tượng theo tên, nhân vật ghép từ trang phục – vũ khí – cờ hiệu, thanh chỉ số HUD (tim, điểm và cấp, vàng,
 * chuỗi ngày, mục tiêu hôm nay), mặt thẻ nhân vật theo độ hiếm, mô tả điều kiện huy hiệu. Trạng thái luôn kèm chữ, không chỉ dựa vào màu.
 */
import React from 'react';
import { View } from 'react-native';
import {
  Award, BookOpen, Coins, Crown, Flag, Flame, Gem, Heart, Lightbulb, ScrollText, Shield, Shirt, Snowflake, Sparkles, Star, Swords, Target, Trophy, Zap,
} from 'lucide-react-native';
import { Bar, HudPill, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { BadgeRule, Hud, Rarity } from '@/types/gamification';
import { RARITY_TEXT } from '@/types/gamification';

export const GAME_ICON: Record<string, IconType> = {
  swords: Swords, scroll: ScrollText, heart: Heart, shield: Shield, shirt: Shirt, flag: Flag, award: Award, star: Star, crown: Crown, gem: Gem, sparkles: Sparkles,
  flame: Flame, snowflake: Snowflake, lightbulb: Lightbulb, coins: Coins, target: Target, book: BookOpen, trophy: Trophy,
};
export const iconOf = (name?: string | null): IconType => GAME_ICON[name ?? ''] ?? Star;

/** Nhân vật: nền theo màu lớp nhân vật, trang phục ở giữa, vũ khí phía dưới bên phải, cờ hiệu phía trên bên trái, biểu tượng lớp phía dưới bên trái */
export const AvatarFigure: React.FC<{ hud: Pick<Hud, 'class' | 'appearance'>; size?: number }> = ({ hud, size = 96 }) => {
  const { c } = useTheme();
  const base = hud.class?.color ?? c.muc3;
  const Outfit = iconOf(hud.appearance.outfit?.icon ?? 'shirt');
  const Weapon = iconOf(hud.appearance.weapon?.icon ?? 'swords');
  const Banner = iconOf(hud.appearance.banner?.icon ?? 'flag');
  const Class = iconOf(hud.class?.icon ?? 'star');
  const small = size * 0.3;
  const label = `Nhân vật${hud.class ? ` ${hud.class.name}` : ''}, mặc ${hud.appearance.outfit?.name ?? 'áo mặc định'}, cầm ${hud.appearance.weapon?.name ?? 'vũ khí mặc định'}, cờ ${hud.appearance.banner?.name ?? 'mặc định'}`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${base}22`, borderWidth: 3, borderColor: base, alignItems: 'center', justifyContent: 'center' }}>
        <Outfit size={size * 0.46} color={hud.appearance.outfit?.color ?? base} strokeWidth={2.2} />
      </View>
      <View style={{ position: 'absolute', right: -2, bottom: 0, width: small + 10, height: small + 10, borderRadius: (small + 10) / 2, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
        <Weapon size={small} color={hud.appearance.weapon?.color ?? c.muc2} />
      </View>
      <View style={{ position: 'absolute', left: -2, top: 0, width: small + 10, height: small + 10, borderRadius: (small + 10) / 2, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
        <Banner size={small} color={hud.appearance.banner?.color ?? c.son} />
      </View>
      <View style={{ position: 'absolute', left: 0, bottom: -2, width: small + 6, height: small + 6, borderRadius: (small + 6) / 2, backgroundColor: base, alignItems: 'center', justifyContent: 'center' }}>
        <Class size={small * 0.8} color="#ffffff" />
      </View>
    </View>
  );
};

const minutesText = (ms: number | null): string => {
  if (ms === null) return '';
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60 ? `${m % 60} phút` : ''}`.trim() : `${m} phút`;
};

/** Thanh chỉ số hiện ở mọi màn hình học (HK.HS.013) */
export const HudBar: React.FC<{ hud: Hud | null }> = ({ hud }) => {
  const { c } = useTheme();
  if (!hud) return null;
  const h = hud.hearts;
  return (
    <View accessibilityLabel="Chỉ số nhân vật" style={{ backgroundColor: c.the2, borderBottomWidth: 2, borderBottomColor: c.vien, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <HudPill icon={Heart} value={h.enabled ? `${h.current}/${h.max}` : 'Không giới hạn'} label={h.enabled ? 'Tim' : 'Lớp đã tắt cơ chế tim'} tone={h.current <= 1 && h.enabled ? c.son : c.sonChu} />
        <HudPill icon={Award} value={`Cấp ${hud.level.level}`} label={`Cấp ${hud.level.level} ${hud.level.title}, ${hud.xp} điểm`} tone={c.dong} />
        <HudPill icon={Coins} value={String(hud.gold)} label="Vàng" tone={c.vangDam} />
        {hud.ap ? <HudPill icon={Zap} value={`${hud.ap.current}/${hud.ap.max}`} label={`Điểm hành động hôm nay ${hud.ap.current} trên ${hud.ap.max}${hud.buffs && Object.keys(hud.buffs).length ? ', có hiệu ứng kỹ năng đang chờ' : ''}`} tone={c.thuy} /> : null}
        <HudPill icon={Flame} value={String(hud.streak.current)} label={hud.streak.at_risk ? 'Chuỗi ngày học, hôm nay chưa đạt mục tiêu' : 'Chuỗi ngày học'} tone={hud.streak.at_risk ? c.dich : c.hoa} />
        <HudPill icon={Target} value={`${Math.min(hud.daily.xp, hud.daily.goal)}/${hud.daily.goal}`} label={hud.daily.reached ? 'Đã đạt mục tiêu hôm nay' : 'Điểm hôm nay trên mục tiêu'} tone={hud.daily.reached ? c.ngocDam : c.thuy} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><Bar value={hud.level.progress} max={100} height={8} fill={c.dong} label={`Tiến tới cấp ${hud.level.level + 1}: ${hud.level.progress}%`} /></View>
        <Txt size={12} color={c.muc2} numberOfLines={1} style={{ maxWidth: 260 }}>
          {hud.level.title} · {hud.level.next_xp !== null ? `${hud.xp}/${hud.level.next_xp} điểm` : `${hud.xp} điểm (cấp cao nhất)`}
          {h.enabled && h.next_in_ms !== null ? ` · tim hồi sau ${minutesText(h.next_in_ms)}` : ''}
        </Txt>
      </View>
    </View>
  );
};

export const RARITY_COLOR = (c: ReturnType<typeof useTheme>['c'], rarity: Rarity) =>
  rarity === 'legendary' ? { fg: c.vangChu, bg: c.vangNhat, edge: c.vangDam } : rarity === 'rare' ? { fg: c.thuyChu, bg: c.thuyNhat, edge: c.thuy } : { fg: c.dich, bg: c.dichNhat, edge: c.vien2 };

/** Mặt thẻ nhân vật: viền và nhãn theo độ hiếm; thẻ chưa có chỉ lộ độ hiếm */
export const CardFace: React.FC<{ rarity: Rarity; name: string | null; owned: boolean; copies?: number | null; size?: number }> = ({ rarity, name, owned, copies, size = 150 }) => {
  const { c } = useTheme();
  const col = RARITY_COLOR(c, rarity);
  const Icon = rarity === 'legendary' ? Crown : rarity === 'rare' ? Gem : Swords;
  return (
    <View style={{ width: size, minHeight: size * 1.3, borderRadius: 16, borderWidth: 3, borderColor: owned ? col.edge : c.vien, backgroundColor: owned ? col.bg : c.giay2, padding: 10, alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: owned ? 1 : 0.85 }}>
      <Txt f="bold" size={11} color={owned ? col.fg : c.muc3} upper>{RARITY_TEXT[rarity]}</Txt>
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: owned ? col.edge : c.vien, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={size * 0.26} color={owned ? '#ffffff' : c.muc3} />
      </View>
      <Txt f="displayHeavy" size={15} center numberOfLines={2} color={owned ? c.muc : c.muc3}>{owned ? name : 'Chưa sưu tầm'}</Txt>
      {owned && copies && copies > 1 ? <Txt size={11} color={col.fg}>x{copies}</Txt> : <View style={{ height: 14 }} />}
    </View>
  );
};

/** Điều kiện tự trao của một huy hiệu bằng chữ */
export const ruleText = (rule: BadgeRule | null, campaigns: Record<number, string> = {}): string => {
  if (!rule) return 'Giáo viên hoặc nhà trường trao tặng';
  const v = rule.value ?? 0;
  switch (rule.type) {
    case 'campaign_complete': return `Hoàn thành hành trình ${rule.campaign_id && campaigns[rule.campaign_id] ? campaigns[rule.campaign_id] : 'của một cuộc kháng chiến'}`;
    case 'streak_days': return `Giữ chuỗi học ${v} ngày liên tiếp`;
    case 'correct_answers': return `Trả lời đúng ${v} câu`;
    case 'nodes_completed': return `Hoàn thành ${v} nút trên bản đồ`;
    case 'level': return `Đạt cấp ${v}`;
    case 'cards_collected': return `Sưu tầm ${v} thẻ nhân vật khác nhau`;
    case 'perfect_quizzes': return v > 1 ? `Đạt 100% ở ${v} bài làm` : 'Đạt 100% một bài làm';
    case 'xp_total': return `Tích lũy ${v} điểm`;
    default: return 'Điều kiện đặc biệt';
  }
};
