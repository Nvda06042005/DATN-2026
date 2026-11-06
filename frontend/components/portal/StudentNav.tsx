/**
 * Thanh menu chính của học sinh (HK.HS.125): thanh bên trái trên máy tính, thanh dưới trên điện thoại.
 * Mục chính: Học, Luyện tập, Bảng xếp hạng, Nhiệm vụ, Trợ lý AI, Cửa hàng, Hồ sơ, Chiến dịch, Xem thêm; chấm đỏ báo mục có việc mới.
 * Chuẩn bố cục Duolingo với AI Hub nằm trực tiếp trên thanh điều hướng chính.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Award, ClipboardList, Dumbbell, Ellipsis, GraduationCap, History as HistoryIcon, Library as LibraryIcon, Lightbulb, LifeBuoy, ListChecks, Map as MapIcon, Radio, Route, ScrollText, Shield, ShoppingBag, Sparkles, Swords, Trophy, UserRound, Users,
} from 'lucide-react-native';
import { Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';

export type Tab =
  | 'learn' | 'home' | 'collection' | 'practice' | 'ranking' | 'quests' | 'shop' | 'mine'
  | 'library' | 'timeline' | 'map' | 'sources' | 'class' | 'live' | 'battles' | 'character' | 'ai' | 'study' | 'survey' | 'help';

interface NavItem { id: Tab; label: string; icon: IconType }
/** Các mục của thanh menu chính theo đặc tả và phong cách Duolingo */
export const NAV_MAIN: NavItem[] = [
  { id: 'learn', label: 'Học', icon: GraduationCap },
  { id: 'practice', label: 'Luyện tập', icon: Dumbbell },
  { id: 'ranking', label: 'Bảng xếp hạng', icon: Trophy },
  { id: 'quests', label: 'Nhiệm vụ', icon: ListChecks },
  { id: 'ai', label: 'Trợ lý AI', icon: Sparkles },
  { id: 'shop', label: 'Cửa hàng', icon: ShoppingBag },
  { id: 'mine', label: 'Hồ sơ', icon: UserRound },
  { id: 'home', label: 'Chiến dịch', icon: Route },
];
export const NAV_MORE: NavItem[] = [
  { id: 'collection', label: 'Bộ thẻ', icon: Award },
  { id: 'study', label: 'Gợi ý học tập', icon: Lightbulb },
  { id: 'library', label: 'Thư viện', icon: LibraryIcon },
  { id: 'timeline', label: 'Dòng thời gian', icon: HistoryIcon },
  { id: 'map', label: 'Bản đồ', icon: MapIcon },
  { id: 'sources', label: 'Tư liệu', icon: ScrollText },
  { id: 'class', label: 'Lớp học', icon: Users },
  { id: 'live', label: 'Thi đấu', icon: Radio },
  { id: 'battles', label: 'Trận đánh', icon: Swords },
  { id: 'character', label: 'Nhân vật', icon: Shield },
  { id: 'survey', label: 'Khảo sát', icon: ClipboardList },
  { id: 'help', label: 'Trợ giúp', icon: LifeBuoy },
];
/** Năm mục ở thanh dưới trên điện thoại (chuẩn Duolingo) */
const PHONE_MAIN: Tab[] = ['learn', 'practice', 'ranking', 'quests', 'ai'];

export type Dots = Partial<Record<Tab | 'more', number>>;

const Dot: React.FC<{ n?: number }> = ({ n }) => {
  const { c } = useTheme();
  return n ? <View accessibilityLabel={`${n} việc mới`} style={{ minWidth: 10, height: 10, borderRadius: 5, backgroundColor: c.son, borderWidth: 2, borderColor: c.the }} /> : null;
};

export const StudentNav: React.FC<{ tab: Tab; wide: boolean; dots: Dots; onSelect: (t: Tab) => void; hidden?: Tab[] }> = ({ tab, wide, dots, onSelect, hidden = [] }) => {
  const { c } = useTheme();
  const [more, setMore] = useState(false);
  const main = NAV_MAIN.filter((i) => !hidden.includes(i.id)), extra = NAV_MORE.filter((i) => !hidden.includes(i.id));
  const moreTabs = wide ? [] : [...main.filter((i) => !PHONE_MAIN.includes(i.id)), ...extra];
  const moreActive = !wide && moreTabs.some((i) => i.id === tab);
  const moreDot = (dots.more ?? 0) + moreTabs.reduce((n, i) => n + (dots[i.id] ?? 0), 0);

  if (wide) {
    const row = (it: NavItem) => {
      const on = it.id === tab, Icon = it.icon;
      const isAi = it.id === 'ai';
      return (
        <Pressable key={it.id} testID={`student-tab-${it.id}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label} onPress={() => onSelect(it.id)}
          style={({ pressed }) => ({
            minHeight: 46,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: on ? (isAi ? c.vangDam : c.ngoc) : 'transparent',
            backgroundColor: on ? (isAi ? c.vangNhat : c.ngocNhat) : pressed ? c.the2 : 'transparent',
          })}>
          <Icon size={22} color={on ? (isAi ? c.vangChu : c.ngocChu) : isAi ? c.vangChu : c.muc2} />
          <Txt f={on ? 'bold' : 'semibold'} size={15} color={on ? (isAi ? c.vangChu : c.ngocChu) : c.muc2} style={{ flex: 1 }}>{it.label}</Txt>
          {isAi && !on ? <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.vangNhat }}><Txt f="bold" size={10} color={c.vangChu}>AI</Txt></View> : null}
          <Dot n={dots[it.id]} />
        </Pressable>
      );
    };
    return (
      <View accessibilityRole="tablist" accessibilityLabel="Menu chính" style={{ width: 232, backgroundColor: c.the, borderRightWidth: 2, borderRightColor: c.vien }}>
        <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
          {main.map(row)}
          <View style={{ height: 2, backgroundColor: c.vien, marginVertical: 8 }} />
          <Txt size={12} color={c.muc3} style={{ paddingHorizontal: 14, paddingBottom: 4 }}>Xem thêm</Txt>
          {extra.map(row)}
        </ScrollView>
      </View>
    );
  }

  const phone = [...main.filter((i) => PHONE_MAIN.includes(i.id))];
  const tile = (key: string, label: string, Icon: IconType, on: boolean, dot: number | undefined, press: () => void, testID: string) => {
    const isAi = key === 'ai';
    return (
      <Pressable key={key} testID={testID} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={press}
        style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 }}>
        <View>
          <Icon size={24} color={on ? (isAi ? c.vangChu : c.ngocChu) : isAi ? c.vangChu : c.muc2} />
          <View style={{ position: 'absolute', right: -6, top: -2 }}><Dot n={dot} /></View>
        </View>
        <Txt f={on ? 'bold' : 'semibold'} size={11} color={on ? (isAi ? c.vangChu : c.ngocChu) : c.muc2} numberOfLines={1}>{label}</Txt>
      </Pressable>
    );
  };
  return (
    <>
      <View accessibilityRole="tablist" accessibilityLabel="Menu chính" style={{ flexDirection: 'row', backgroundColor: c.the, borderTopWidth: 2, borderTopColor: c.vien }}>
        {phone.map((it) => tile(it.id, it.label, it.icon, it.id === tab, dots[it.id], () => onSelect(it.id), `student-tab-${it.id}`))}
        {tile('more', 'Xem thêm', Ellipsis, moreActive || more, moreDot, () => setMore(true), 'student-tab-more')}
      </View>
      <Sheet open={more} onClose={() => setMore(false)} title="Xem thêm" subtitle="Các mục học tập khác" wide>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {moreTabs.map((it) => {
            const on = it.id === tab, Icon = it.icon;
            return (
              <Pressable key={it.id} testID={`student-tab-${it.id}`} accessibilityRole="button" accessibilityLabel={it.label} onPress={() => { setMore(false); onSelect(it.id); }}
                style={({ pressed }) => ({ width: '47%', flexGrow: 1, minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 2, borderColor: on ? c.ngoc : c.vien, backgroundColor: on ? c.ngocNhat : pressed ? c.the2 : c.the })}>
                <Icon size={24} color={on ? c.ngocChu : c.muc2} />
                <Txt f="semibold" size={15} color={on ? c.ngocChu : c.muc} style={{ flex: 1 }}>{it.label}</Txt>
                <Dot n={dots[it.id]} />
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};
