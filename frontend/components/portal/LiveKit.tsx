/**
 * Thành phần chung của thi đấu trực tiếp (Sprint 8), dùng ở màn hình giáo viên và học sinh: hình đại diện, đồng hồ đếm ngược, đáp án có hình khối và chữ cái
 * (không chỉ dựa vào màu), nút hình – màu trên thiết bị khi giáo viên ẩn nội dung câu hỏi, thanh máu trùm, bảng xếp hạng, bục vinh quang có hiệu ứng (tắt khi người dùng chọn giảm chuyển động).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { Check, Circle, Clock, Crown, Diamond, Shield, Square, Swords, Triangle } from 'lucide-react-native';
import { iconOf } from '@/components/portal/GameKit';
import { Bar, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LIVE_AVATARS, type BossHit, type BossView, type LiveOption, type LiveTop } from '@/types/live';

export const LiveAvatar: React.FC<{ avatar: string; size?: number; label?: string }> = ({ avatar, size = 40, label }) => {
  const { c } = useTheme();
  const Icon = iconOf(avatar);
  const tint = [c.son, c.thuy, c.ngoc, c.vangDam][Math.max(0, LIVE_AVATARS.indexOf(avatar as (typeof LIVE_AVATARS)[number])) % 4];
  return (
    <View accessible={Boolean(label)} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}22`, borderWidth: 2, borderColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.5} color={tint} />
    </View>
  );
};

/** Chọn hình đại diện trong phòng (nhóm nút chọn một, có tên đọc được cho trình đọc màn hình) */
export const LiveAvatarPicker: React.FC<{ value: string; onChange: (avatar: string) => void }> = ({ value, onChange }) => {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Chọn hình đại diện" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {LIVE_AVATARS.map((a) => (
        <Pressable key={a} accessibilityRole="radio" accessibilityState={{ selected: a === value }} accessibilityLabel={`Hình đại diện ${a}`} onPress={() => onChange(a)} hitSlop={4}
          style={{ padding: 3, borderRadius: 999, borderWidth: 3, borderColor: a === value ? c.ngoc : 'transparent' }}>
          <LiveAvatar avatar={a} size={44} />
        </Pressable>
      ))}
    </View>
  );
};

/** Đồng hồ đếm ngược: thanh + số giây lớn; chuyển đỏ khi còn dưới 5 giây */
export const LiveCountdown: React.FC<{ remaining: number; total: number; paused?: boolean; big?: boolean }> = ({ remaining, total, paused, big }) => {
  const { c } = useTheme();
  const s = Math.ceil(remaining / 1000);
  const hurry = remaining <= 5000 && !paused;
  return (
    <View accessibilityRole="timer" accessibilityLabel={paused ? 'Đang tạm dừng' : `Còn ${s} giây`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Clock size={big ? 28 : 20} color={hurry ? c.sonChu : c.muc2} />
      <View style={{ flex: 1 }}><Bar value={remaining} max={Math.max(1, total * 1000)} height={big ? 18 : 12} fill={paused ? c.vangDam : hurry ? c.son : c.ngoc} /></View>
      <Txt f="displayHeavy" size={big ? 40 : 24} color={hurry ? c.sonChu : c.muc} style={{ minWidth: big ? 84 : 56, textAlign: 'right' }}>{paused ? 'Tạm dừng' : `${s}s`}</Txt>
    </View>
  );
};

/** ▲ đỏ, ◆ xanh lá, ● vàng, ■ xanh đậm (HK.GV.087); mỗi đáp án giữ nguyên hình – màu theo vị trí trên màn chiếu */
const SHAPES = [
  { Shape: Triangle, edge: 'son', bg: 'sonNhat' }, { Shape: Diamond, edge: 'ngoc', bg: 'ngocNhat' }, { Shape: Circle, edge: 'vangDam', bg: 'vangNhat' }, { Shape: Square, edge: 'thuy', bg: 'thuyNhat' },
] as const;
export const SHAPE_NAMES = ['tam giác đỏ', 'hình thoi xanh lá', 'hình tròn vàng', 'hình vuông xanh đậm'] as const;

/** Một đáp án: hình khối + chữ cái + nội dung; có thể bấm (học sinh) hoặc chỉ hiển thị với số lượt chọn và dấu đáp án đúng (giáo viên) */
export const LiveChoice: React.FC<{
  index: number; shape?: number; text: string; onPress?: () => void; disabled?: boolean; selected?: boolean; chosen?: boolean; correct?: boolean; count?: number; total?: number; revealed?: boolean; big?: boolean; testID?: string;
}> = ({ index, shape, text, onPress, disabled, selected, chosen, correct, count, total, revealed, big, testID }) => {
  const { c } = useTheme();
  const slot = (shape ?? index) % 4;
  const spec = SHAPES[slot];
  // Khi công bố kết quả: đáp án đúng chuyển sang xanh lá, các đáp án còn lại xám (màu theo thứ tự đáp án không còn ý nghĩa)
  const edge = revealed ? (correct ? c.ngoc : c.vien2) : c[spec.edge], bg = revealed ? (correct ? c.ngocNhat : c.giay2) : c[spec.bg];
  const dim = revealed && !correct;
  const Shape = spec.Shape;
  const body = (
    <View style={{ minHeight: big ? 76 : 64, borderRadius: 16, borderWidth: 3, borderColor: selected || (revealed && correct) ? c.muc : edge, backgroundColor: dim ? c.giay2 : bg, opacity: dim ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
      {count !== undefined && total ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((count / total) * 100)}%`, backgroundColor: `${edge}30` }} /> : null}
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: edge, alignItems: 'center', justifyContent: 'center' }}>
        <Shape size={18} color="#ffffff" fill="#ffffff" />
      </View>
      <Txt f="displayHeavy" size={big ? 22 : 18} color={c.muc} style={{ width: 22 }}>{String.fromCharCode(65 + slot)}</Txt>
      <Txt f="semibold" size={big ? 22 : 17} color={c.muc} style={{ flex: 1 }}>{text}</Txt>
      {count !== undefined ? <Txt f="displayHeavy" size={big ? 28 : 20} color={c.muc}>{count}</Txt> : null}
      {revealed && correct ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Check size={22} color={c.ngocChu} /><Txt f="bold" size={13} color={c.ngocChu}>Đúng</Txt></View> : null}
      {chosen && !(revealed && correct) ? <Txt f="bold" size={13} color={c.muc2}>Em chọn</Txt> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Đáp án ${String.fromCharCode(65 + slot)}: ${text}`} accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      {body}
    </Pressable>
  );
};

/** Nút hình – màu lớn trên thiết bị học sinh khi nội dung câu hỏi chỉ hiện trên màn chiếu (HK.HS.139); có tên hình cho trình đọc màn hình */
export const LiveShapeButton: React.FC<{ shape: number; onPress: () => void; disabled?: boolean; selected?: boolean; testID?: string }> = ({ shape, onPress, disabled, selected, testID }) => {
  const { c } = useTheme();
  const spec = SHAPES[shape % 4];
  const Shape = spec.Shape;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Đáp án ${String.fromCharCode(65 + (shape % 4))}: ${SHAPE_NAMES[shape % 4]}`} accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minHeight: 104, borderRadius: 20, borderWidth: 4, borderColor: selected ? c.muc : c[spec.edge], backgroundColor: c[spec.edge], opacity: disabled ? 0.55 : pressed ? 0.85 : 1, alignItems: 'center', justifyContent: 'center', gap: 4, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Shape size={48} color="#ffffff" fill="#ffffff" />
      <Txt f="displayHeavy" size={20} color="#ffffff">{String.fromCharCode(65 + (shape % 4))}</Txt>
      {selected ? <View style={{ position: 'absolute', top: 8, right: 8 }}><Check size={24} color="#ffffff" /></View> : null}
    </Pressable>
  );
};

/** Thanh máu trùm và máu cả lớp (HK.GV.101, HK.HS.142); rung nhẹ mỗi khi có đòn đánh mới (không rung nếu người dùng giảm chuyển động) */
export const BossPanel: React.FC<{ boss: BossView; hit?: BossHit | null; big?: boolean }> = ({ boss, hit, big }) => {
  const { c } = useTheme();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hit) return;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!reduce) Animated.sequence([-8, 8, -6, 6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, useNativeDriver: true }))).start();
    }).catch(() => undefined);
  }, [hit?.q]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, boss.max_hp ?? 1), classMax = Math.max(1, boss.class_max_hp ?? 1);
  return (
    <Animated.View accessibilityLabel={`Trùm ${boss.name}: còn ${boss.hp ?? 0} trên ${boss.max_hp ?? 0} máu. Cả lớp còn ${boss.class_hp ?? 0} trên ${boss.class_max_hp ?? 0} máu`} style={{ transform: [{ translateX: shake }], gap: 8, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: c.son, backgroundColor: c.sonNhat }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Swords size={big ? 34 : 26} color={c.sonChu} />
        <Txt f="displayHeavy" size={big ? 26 : 19} color={c.sonChu} style={{ flex: 1 }}>{boss.name}</Txt>
        <Txt f="bold" size={big ? 20 : 15} color={c.sonChu}>{boss.hp ?? 0}/{boss.max_hp ?? 0}</Txt>
      </View>
      <Bar value={boss.hp ?? 0} max={max} height={big ? 22 : 14} fill={c.son} label={`Máu trùm ${boss.hp ?? 0}`} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Shield size={big ? 24 : 18} color={c.ngocChu} />
        <View style={{ flex: 1 }}><Bar value={boss.class_hp ?? 0} max={classMax} height={big ? 16 : 10} fill={c.ngoc} label={`Máu cả lớp ${boss.class_hp ?? 0}`} /></View>
        <Txt f="bold" size={big ? 16 : 13} color={c.ngocChu}>Cả lớp {boss.class_hp ?? 0}/{boss.class_max_hp ?? 0}</Txt>
      </View>
      {hit ? <Txt size={big ? 18 : 14} color={c.muc}>Đòn vừa rồi: trùm mất {hit.damage} máu{hit.wrong ? ` · cả lớp mất ${hit.wrong} máu vì câu sai / bỏ trống` : ''}{hit.top.length ? ` · mạnh nhất: ${hit.top.map((t) => `${t.nickname} (${t.damage})`).join(', ')}` : ''}</Txt> : null}
      {boss.outcome ? <Txt f="displayHeavy" size={big ? 26 : 20} color={boss.outcome === 'win' ? c.ngocChu : c.sonChu}>{boss.outcome === 'win' ? 'Trùm đã gục! Cả lớp chiến thắng' : 'Cả lớp hết máu hoặc trùm còn sống – lần sau cố gắng hơn nhé'}</Txt> : null}
    </Animated.View>
  );
};

/** Kết quả của câu: các đáp án kèm số người chọn */
export const LiveDistribution: React.FC<{ options: LiveOption[]; total: number; big?: boolean; poll?: boolean }> = ({ options, total, big, poll }) => (
  <View style={{ gap: 10 }}>
    {options.map((o, i) => <LiveChoice key={o.id} index={i} text={o.text} count={o.count} total={Math.max(1, total)} correct={o.correct} revealed={!poll} big={big} />)}
  </View>
);

export const LiveBoard: React.FC<{ rows: LiveTop[]; me?: string | null; big?: boolean }> = ({ rows, me, big }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => {
        const mine = me !== null && me !== undefined && r.nickname === me;
        return (
          <View key={`${r.rank}-${r.nickname}`} accessibilityLabel={`Hạng ${r.rank}, ${r.nickname}, ${r.score} điểm${mine ? ', là em' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: big ? 60 : 50, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: mine ? c.ngoc : c.vien, backgroundColor: mine ? c.ngocNhat : c.the }}>
            <Txt f="displayHeavy" size={big ? 26 : 20} style={{ width: 34 }}>{r.rank}</Txt>
            <LiveAvatar avatar={r.avatar} size={big ? 40 : 34} />
            <View style={{ flex: 1 }}>
              <Txt f="bold" size={big ? 20 : 16} numberOfLines={1}>{r.nickname}{mine ? ' (em)' : ''}</Txt>
              {r.team_name ? <Txt size={12} color={c.muc3} numberOfLines={1}>{r.team_name}</Txt> : null}
            </View>
            <Txt f="displayHeavy" size={big ? 26 : 20} color={c.dongChu}>{r.score}</Txt>
          </View>
        );
      })}
    </View>
  );
};

/** Bục vinh quang: hạng 2 – 1 – 3, các bục dâng lên lần lượt (không chuyển động nếu người dùng giảm chuyển động) */
export const LivePodium: React.FC<{ items: Array<{ rank: number; name: string; avatar?: string; score: number; sub?: string | null }>; big?: boolean }> = ({ items, big }) => {
  const { c } = useTheme();
  const [still, setStill] = useState(false);
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let off = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (off) return;
      if (reduce) { setStill(true); grow.setValue(1); return; }
      Animated.timing(grow, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.2)), useNativeDriver: false }).start();
    }).catch(() => grow.setValue(1));
    return () => { off = true; };
  }, [grow]);
  const order = [2, 1, 3].map((rank) => items.find((i) => i.rank === rank)).filter(Boolean) as typeof items;
  const height = (rank: number) => (rank === 1 ? 170 : rank === 2 ? 125 : 95) * (big ? 1.25 : 1);
  const tint = (rank: number) => (rank === 1 ? c.vangDam : rank === 2 ? c.muc3 : c.dong);
  return (
    <View accessibilityLabel="Bục vinh quang" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, paddingTop: 36 }}>
      {order.map((p) => (
        <View key={p.rank} style={{ flex: 1, maxWidth: big ? 240 : 170, alignItems: 'center', gap: 6 }}>
          {p.rank === 1 ? <Crown size={big ? 40 : 30} color={c.vangDam} /> : null}
          {p.avatar ? <LiveAvatar avatar={p.avatar} size={big ? 64 : 48} /> : null}
          <Txt f="bold" size={big ? 20 : 15} center numberOfLines={2} accessibilityLabel={`Hạng ${p.rank}: ${p.name}, ${p.score} điểm`}>{p.name}</Txt>
          {p.sub ? <Txt size={12} color={c.muc3} center numberOfLines={1}>{p.sub}</Txt> : null}
          <Animated.View style={{ width: '100%', height: still ? height(p.rank) : grow.interpolate({ inputRange: [0, 1], outputRange: [0, height(p.rank)] }), backgroundColor: tint(p.rank), borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }}>
            <Txt f="displayHeavy" size={big ? 40 : 30} color="#ffffff">{p.rank}</Txt>
            <Txt f="bold" size={big ? 20 : 16} color="#ffffff">{p.score} điểm</Txt>
          </Animated.View>
        </View>
      ))}
    </View>
  );
};
