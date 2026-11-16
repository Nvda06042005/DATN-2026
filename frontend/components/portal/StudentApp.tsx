/**
 * Trang học sinh (/hoc-sinh và đường dẫn riêng của trường với role=student) – Hành trình Đông A (xây dựng lại 15/11/2026).
 * Vòng chơi: chọn cuộc kháng chiến → chọn chặng trên bản đồ → học kiến thức ngắn → minigame luyện tập → nhập vai khám phá → chạm trán (nếu có) → tổng kết, ôn tập → nhận thưởng,
 * lưu tiến độ, mở chặng tiếp theo. Mọi điểm, sao, phần thưởng và việc mở khóa do máy chủ quyết định (/api/saga); giao diện chỉ gửi lệnh và vẽ lại.
 * Khung trang: thanh trên cùng (tên, cấp độ, kinh nghiệm, chuỗi ngày, vàng, thông báo, trình đơn tài khoản) và năm mục: Chiến dịch, Nhập vai, Câu hỏi, Tư liệu, Bộ thẻ.
 * Mục đang mở nằm trên URL (tab, c = cuộc kháng chiến, s = chặng, v = bước) nên Back / Forward / tải lại giữ đúng chỗ. Giữ chế độ sáng / tối của tài khoản.
 * Mỗi lần chuyển mục, bộ điều hướng dựng một màn mới và giữ màn cũ ẩn bên dưới: màn không còn được xem thì gỡ hết nội dung (game Phaser, đồng hồ, phím tắt, hộp thoại)
 * để lúc nào cũng chỉ có một màn chơi đang chạy; khi quay lại, màn đó tải lại trạng thái chuẩn từ máy chủ.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useIsFocused, useLocalSearchParams, useNavigation, usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleQuestionMark, ClipboardList, Coins, Flame, GalleryHorizontalEnd, Gamepad2, KeyRound, LifeBuoy, LogOut, Map as MapIcon, Menu, MessageCircleQuestionMark, ScrollText, User, Volume2, VolumeX } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import * as game from '@/api/gameApi';
import * as platform from '@/api/platformApi';
import * as saga from '@/api/sagaApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { HelpCenter } from '@/components/portal/HelpCenter';
import { DetailSheet } from '@/components/portal/Library';
import { NoticeBell, SettingsButton } from '@/components/portal/NoticeCenter';
import { ArchiveScreen, CollectionScreen, ReviewScreen } from '@/components/portal/SagaExtras';
import { CampaignScreen, HomeScreen, RolePlayScreen } from '@/components/portal/SagaHome';
import { Confetti, GameBtn, Meter, Overlay, RoundIcon, SG, ScreenHead, Sunburst, TieuTuongArt, num, useSaga, type SagaNav, type SagaRoute, type SagaStep, type SagaTab } from '@/components/portal/SagaKit';
import { LessonScreen, PracticeScreen, SummaryScreen } from '@/components/portal/SagaLearn';
import { BattleScreen, ExploreScreen } from '@/components/portal/SagaPlay';
import { SurveyCenter } from '@/components/portal/SurveyCenter';
import { TieuTuongTab } from '@/components/portal/TieuTuong';
import { ProfileSheet } from '@/components/profile';
import { Avatar, PaperBg, Txt, useToast } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { ThemeContext } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';
import { play, setSound, soundEnabled } from '@/lib/saga-sound';
import type { IconType } from '@/types/game';
import type { ProfilePatch } from '@/types/api';
import type { Prefs } from '@/types/platform';
import type { Completion, SagaHome } from '@/types/saga';

const TABS: readonly SagaTab[] = ['chien-dich', 'nhap-vai', 'cau-hoi', 'tu-lieu', 'bo-the', 'hoi', 'tro-giup', 'khao-sat'];
const STEPS: readonly SagaStep[] = ['hoc', 'luyen', 'kham-pha', 'tran', 'tong-ket'];
/** Năm mục chính (màu và biểu tượng theo video giới thiệu); trợ lý, trợ giúp và khảo sát mở từ trình đơn tài khoản */
const NAV: Array<{ id: SagaTab; label: string; icon: IconType; bg: string; edge: string }> = [
  { id: 'chien-dich', label: 'Chiến dịch', icon: MapIcon, bg: SG.green, edge: SG.greenEdge },
  { id: 'nhap-vai', label: 'Nhập vai', icon: Gamepad2, bg: SG.red, edge: SG.redEdge },
  { id: 'cau-hoi', label: 'Câu hỏi', icon: CircleQuestionMark, bg: SG.purple, edge: SG.purpleEdge },
  { id: 'tu-lieu', label: 'Tư liệu', icon: ScrollText, bg: SG.blue, edge: SG.blueEdge },
  { id: 'bo-the', label: 'Bộ thẻ', icon: GalleryHorizontalEnd, bg: SG.orange, edge: SG.orangeEdge },
];
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const idOf = (v: string | undefined): number | null => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);

/**
 * Dữ liệu dùng chung giữa các màn của cùng một phiên đăng nhập. Mỗi lần điều hướng là một màn mới (trạng thái React bắt đầu lại), nên:
 *  - trang chủ (cấp độ, vàng, chuỗi ngày) được nhớ theo token để thanh trên cùng không nháy về 0 rồi mới tải lại;
 *  - phần thưởng của chặng vừa hoàn thành được giữ tới khi màn tổng kết hiển thị xong.
 */
const HOME_CACHE = new Map<string, SagaHome>();
let pendingReward: { token: string; stageId: number; completion: Completion } | null = null;

function useHome(session: Session, active: boolean): { data: SagaHome | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<SagaHome | null>(() => HOME_CACHE.get(session.token) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(data === null);
  const [tick, setTick] = useState(0);
  const expired = useRef(session.expired);
  expired.current = session.expired;
  useEffect(() => {
    if (!active) return undefined; // màn đang ẩn không gọi máy chủ; khi được xem lại thì tải mới
    let live = true;
    setLoading(true);
    saga.home(session.token).then((d) => { HOME_CACHE.set(session.token, d); if (live) { setData(d); setError(null); setLoading(false); } }).catch((e) => {
      if (!live) return;
      if ((e as { status?: number }).status === 401) expired.current();
      setError(errorMessage(e, 'Chưa tải được dữ liệu. Thử lại sau ít phút.'));
      setLoading(false);
    });
    return () => { live = false; };
  }, [session.token, tick, active]);
  return { data, error, loading, reload: useCallback(() => setTick((n) => n + 1), []) };
}

type FillIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
const Stat: React.FC<{ icon: FillIcon; value: string; label: string; color: string; fill?: string }> = ({ icon: Icon, value, label, color, fill }) => {
  const s = useSaga();
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 8, borderRadius: 999, backgroundColor: s.card2 }}>
      <Icon size={18} color={color} fill={fill ?? 'none'} strokeWidth={2.4} />
      <Txt f="heavy" size={14} color={s.ink}>{value}</Txt>
    </View>
  );
};

const MenuRow: React.FC<{ icon: IconType; title: string; onPress: () => void; testID: string; danger?: boolean }> = ({ icon: Icon, title, onPress, testID, danger }) => {
  const s = useSaga();
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={title} onPress={onPress} testID={testID}
      style={({ pressed }) => ({ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? s.card2 : 'transparent' })}>
      <Icon size={20} color={danger ? SG.red : s.sub} strokeWidth={2.4} />
      <Txt f="bold" size={15} color={danger ? SG.red : s.ink}>{title}</Txt>
    </Pressable>
  );
};

/** Trang phụ dùng bộ thành phần chung (trợ lý AI, trợ giúp, khảo sát): nền giấy, tiêu đề và nút về trang chiến dịch */
const SubPage: React.FC<{ title: string; subtitle: string; onBack: () => void; children: React.ReactNode }> = ({ title, subtitle, onBack, children }) => (
  <View style={{ flex: 1 }}>
    <PaperBg />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: 900, gap: 14 }}>
        <ScreenHead title={title} subtitle={subtitle} onBack={onBack} backLabel="Về trang chiến dịch" />
        {children}
      </View>
    </ScrollView>
  </View>
);

const Shell: React.FC<{ session: Session; prefs: Prefs | null; setPrefs: (p: Prefs) => void }> = ({ session, prefs, setPrefs }) => {
  const s = useSaga();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ c?: string | string[]; s?: string | string[]; v?: string | string[] }>();
  const [tab, setTab] = usePortalTab<SagaTab>('chien-dich', TABS);
  const focused = useIsFocused();
  const navigation = useNavigation();
  const home = useHome(session, focused);
  // chỉ nhận phần thưởng đang chờ của chính phiên này (đăng xuất rồi tài khoản khác đăng nhập trên cùng máy thì không thấy)
  const [reward, setRewardState] = useState<{ stageId: number; completion: Completion } | null>(() => (pendingReward && pendingReward.token === session.token ? { stageId: pendingReward.stageId, completion: pendingReward.completion } : null));
  const setReward = useCallback((r: { stageId: number; completion: Completion } | null) => { pendingReward = r ? { token: session.token, ...r } : null; setRewardState(r); }, [session.token]);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [sound, setSoundOn] = useState(() => soundEnabled());
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);
  const [cite, setCite] = useState<{ type: string; id: number } | null>(null);

  const c = idOf(one(params.c)), stageId = idOf(one(params.s)), v = one(params.v);
  const route: SagaRoute = useMemo(() => ({ tab, c: c && c >= 1 && c <= 3 ? c : null, s: stageId, v: STEPS.includes(v as SagaStep) ? (v as SagaStep) : null }), [tab, c, stageId, v]);

  const go = useCallback<SagaNav['go']>((next, to = {}, mode = 'push') => {
    const target = { c: to.c ?? null, s: to.s ?? null, v: to.v ?? null };
    if (next === route.tab && target.c === route.c && target.s === route.s && target.v === route.v) return; // đang ở đúng màn này
    const extra = { c: target.c ? String(target.c) : undefined, s: target.s ? String(target.s) : undefined, v: target.v ?? undefined };
    if (mode === 'params') { router.setParams({ ...extra, tab: next }); return; }
    if (mode === 'push') { setTab(next, extra); return; }
    const keep = Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([k, val]) => !['school', 'tab', 'c', 's', 'v'].includes(k) && val !== undefined));
    router.replace({ pathname, params: { ...keep, ...extra, tab: next } } as Href);
  }, [params, pathname, route, router, setTab]);

  const back = useCallback<SagaNav['back']>((tabTo, to = {}) => {
    const st = navigation.getState() as { index: number; routes: Array<{ name: string; params?: Record<string, string | string[] | undefined> }> } | undefined;
    const cur = st?.routes[st.index], prev = st && st.index > 0 ? st.routes[st.index - 1] : undefined;
    const p = prev?.params ?? {}, q = cur?.params ?? {};
    const prevTab = TABS.includes(one(p.tab) as SagaTab) ? one(p.tab) : 'chien-dich';
    const same = Boolean(prev && cur) && prev!.name === cur!.name && one(p.school) === one(q.school) && one(p.role) === one(q.role) && prevTab === tabTo
      && idOf(one(p.c)) === (to.c ?? null) && idOf(one(p.s)) === (to.s ?? null) && (one(p.v) || null) === (to.v ?? null);
    if (same && router.canGoBack()) router.back(); else go(tabTo, to, 'replace');
  }, [go, navigation, router]);

  const nav: SagaNav = useMemo(() => ({ route, go, back, home: home.data, refresh: home.reload, reward, setReward }), [route, go, back, home.data, home.reload, reward, setReward]);

  // chúc mừng do máy chủ ghi lại (lên cấp, nhiệm vụ, huy hiệu): hiện một lần rồi báo đã xem
  const seen = useRef(false);
  const unseen = home.data?.hud.unseen_celebrations ?? 0;
  // đang học, luyện tập, nhập vai hay đánh trận thì chưa báo (không chen ngang màn chơi); tới màn tổng kết hoặc màn khác mới hiện
  const midStep = route.v !== null && route.v !== 'tong-ket';
  useEffect(() => {
    if (!unseen || seen.current || !focused || midStep) return;
    seen.current = true;
    game.celebrations(session.token).then((list) => {
      const up = list.filter((x) => x.kind === 'level_up').sort((a, b) => Number(b.payload.level ?? 0) - Number(a.payload.level ?? 0))[0];
      if (up) { setLevelUp({ level: Number(up.payload.level ?? 1), title: String(up.payload.title ?? '') }); play('reward'); }
      const note = list.find((x) => x.kind === 'quest') ?? list.find((x) => x.kind === 'badge') ?? list.find((x) => x.kind === 'goal');
      if (note) toast(note.kind === 'quest' ? `Xong nhiệm vụ “${String(note.payload.title ?? '')}”` : note.kind === 'badge' ? `Huy hiệu mới: ${String(note.payload.name ?? '')}` : 'Đạt mục tiêu điểm hôm nay!');
      if (list.length) return game.ackCelebrations(session.token, list.map((x) => x.id));
      return undefined;
    }).catch(() => undefined).finally(() => { seen.current = false; });
  }, [unseen, focused, midStep, session.token, toast]);

  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);

  const wide = width >= 860;
  const hud = home.data?.hud ?? null;
  const inGame = route.tab === 'chien-dich' && (route.v === 'kham-pha' || route.v === 'tran');
  const pick = (id: SagaTab): void => { setMenu(false); go(id, { c: null, s: null, v: null }); };
  const stage = route.s !== null && route.c !== null && route.v !== null ? { session, nav, stageId: route.s, campaignNo: route.c } : null;
  // màn đang nằm ẩn dưới một màn khác: không dựng gì để game, đồng hồ, phím tắt và hộp thoại của nó được gỡ sạch
  if (!focused) return <View style={{ flex: 1 }} testID="student-app-hidden" />;

  const body = route.tab === 'chien-dich'
    ? stage && route.v === 'hoc' ? <LessonScreen key={`hoc${stage.stageId}`} {...stage} />
      : stage && route.v === 'luyen' ? <PracticeScreen key={`luyen${stage.stageId}`} {...stage} />
      : stage && route.v === 'kham-pha' ? <ExploreScreen key={`kp${stage.stageId}`} {...stage} />
      : stage && route.v === 'tran' ? <BattleScreen key={`tran${stage.stageId}`} {...stage} />
      : stage && route.v === 'tong-ket' ? <SummaryScreen key={`tk${stage.stageId}`} {...stage} />
      : route.c !== null ? <CampaignScreen key={`c${route.c}`} session={session} nav={nav} no={route.c} />
      : <HomeScreen nav={nav} loading={home.loading} error={home.error} />
    : route.tab === 'nhap-vai' ? <RolePlayScreen session={session} nav={nav} />
    : route.tab === 'cau-hoi' ? <ReviewScreen session={session} nav={nav} />
    : route.tab === 'tu-lieu' ? <ArchiveScreen session={session} nav={nav} />
    : route.tab === 'bo-the' ? <CollectionScreen session={session} nav={nav} />
    : route.tab === 'hoi' ? (
      <SubPage title="Hỏi Tiểu Tướng" subtitle="Trợ lý chỉ trả lời theo tư liệu lịch sử đã được nhà trường công bố, có ghi nguồn." onBack={() => pick('chien-dich')}>
        <TieuTuongTab session={session} onOpen={(type, id) => setCite({ type, id })} />
      </SubPage>
    ) : route.tab === 'tro-giup' ? (
      <SubPage title="Trợ giúp" subtitle="Hướng dẫn sử dụng và gửi câu hỏi tới quản trị viên." onBack={() => pick('chien-dich')}><HelpCenter session={session} /></SubPage>
    ) : (
      <SubPage title="Khảo sát" subtitle="Khảo sát do nhà trường gửi; trả lời ẩn danh và chỉ một lần." onBack={() => pick('chien-dich')}><SurveyCenter session={session} /></SubPage>
    );

  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#0b1220' : '#eef6ff' }} testID="student-app">
      <View role="banner" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: insets.top + 8, paddingBottom: 8, backgroundColor: s.card, borderBottomWidth: 2, borderBottomColor: s.line, zIndex: 20 }} testID="student-hud">
        <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => setProfile(true)} testID="hud-profile" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={40} />
        </Pressable>
        <View style={{ width: wide ? 210 : undefined, flex: wide ? undefined : 1, gap: 3 }}>
          <Txt f="heavy" size={14} color={s.ink} numberOfLines={1}>{home.data?.learner.name ?? session.user.full_name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ backgroundColor: SG.orange, borderRadius: 999, paddingHorizontal: 7 }}><Txt f="heavy" size={11} color="#ffffff">Cấp {hud?.level.level ?? 1}</Txt></View>
            <Meter value={hud ? hud.level.progress / 100 : 0} fill={SG.yellow} height={9} style={{ flex: 1 }}
              label={hud ? `Cấp ${hud.level.level}, ${hud.level.title}. ${num(hud.xp)} điểm kinh nghiệm${hud.level.next_xp ? `, cần ${num(hud.level.next_xp)} để lên cấp` : ''}` : 'Cấp độ'} />
          </View>
        </View>
        {wide ? (
          <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
            {NAV.map((it) => <RoundIcon key={it.id} icon={it.icon} bg={it.bg} edge={it.edge} size={44} label={it.label} caption={it.label} active={route.tab === it.id} onPress={() => pick(it.id)} testID={`nav-${it.id}`} dot={it.id === 'cau-hoi' && Boolean(home.data?.review_due)} />)}
          </View>
        ) : null}
        <Stat icon={Flame} value={String(hud?.streak.current ?? 0)} label={`Chuỗi ${hud?.streak.current ?? 0} ngày học liên tiếp`} color={SG.orangeEdge} fill={SG.orange} />
        <Stat icon={Coins} value={num(hud?.gold ?? 0)} label={`${num(hud?.gold ?? 0)} vàng`} color={SG.yellowEdge} fill={SG.yellow} />
        {width >= 520 ? <NoticeBell session={session} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Trình đơn tài khoản" accessibilityState={{ expanded: menu }} onPress={() => setMenu((m) => !m)} testID="hud-menu" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Menu size={24} color={s.ink} strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>{body}</View>

      {!wide && !inGame ? (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6, paddingBottom: insets.bottom + 6, backgroundColor: s.card, borderTopWidth: 2, borderTopColor: s.line }} testID="student-nav">
          {NAV.map((it) => <RoundIcon key={it.id} icon={it.icon} bg={it.bg} edge={it.edge} size={40} label={it.label} caption={it.label} active={route.tab === it.id} onPress={() => pick(it.id)} testID={`nav-${it.id}`} dot={it.id === 'cau-hoi' && Boolean(home.data?.review_due)} />)}
        </View>
      ) : null}

      {route.v === null && ['chien-dich', 'tu-lieu', 'bo-the'].includes(route.tab) ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Hỏi Tiểu Tướng, trợ lý lịch sử" onPress={() => pick('hoi')} testID="ask-tieu-tuong"
          style={({ pressed }) => ({ position: 'absolute', right: 14, bottom: (wide ? 16 : 84) + insets.bottom, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', borderWidth: 3, borderColor: SG.yellow, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ scale: pressed ? 0.94 : 1 }], zIndex: 15 })}>
          <TieuTuongArt size={52} bust />
          <View style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: SG.purple, alignItems: 'center', justifyContent: 'center' }}><MessageCircleQuestionMark size={12} color="#ffffff" strokeWidth={3} /></View>
        </Pressable>
      ) : null}

      {menu ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]} testID="account-menu">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel="Đóng trình đơn" accessibilityRole="button" />
          <View accessibilityRole="menu" style={{ position: 'absolute', right: 8, top: insets.top + 60, width: 288, maxWidth: '96%', backgroundColor: s.card, borderRadius: 18, borderWidth: 2, borderColor: s.line, borderBottomWidth: 5, padding: 8, gap: 2 }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Txt f="heavy" size={15} color={s.ink} numberOfLines={1}>{session.user.full_name}</Txt>
              <Txt size={13} color={s.sub}>Học sinh{session.user.class_name ? ` · Lớp ${session.user.class_name}` : ''}{hud ? ` · ${hud.level.title}` : ''}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
              {width < 520 ? <NoticeBell session={session} /> : null}
              <SettingsButton session={session} prefs={prefs} onSaved={setPrefs} />
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: sound }} accessibilityLabel={sound ? 'Âm thanh đang bật, bấm để tắt' : 'Âm thanh đang tắt, bấm để bật'} testID="sound-toggle"
                onPress={() => { const on = !sound; setSound(on); setSoundOn(on); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: s.card2 }}>
                {sound ? <Volume2 size={20} color={SG.greenEdge} strokeWidth={2.4} /> : <VolumeX size={20} color={s.sub} strokeWidth={2.4} />}
                <Txt f="bold" size={14} color={s.ink}>Âm thanh: {sound ? 'bật' : 'tắt'}</Txt>
              </Pressable>
            </View>
            <MenuRow icon={User} title="Hồ sơ cá nhân" onPress={() => { setMenu(false); setProfile(true); }} testID="menu-profile" />
            <MenuRow icon={KeyRound} title="Đổi mật khẩu" onPress={() => { setMenu(false); session.changePassword(); }} testID="menu-password" />
            <MenuRow icon={MessageCircleQuestionMark} title="Hỏi Tiểu Tướng" onPress={() => pick('hoi')} testID="menu-ask" />
            <MenuRow icon={LifeBuoy} title="Trợ giúp" onPress={() => pick('tro-giup')} testID="menu-help" />
            <MenuRow icon={ClipboardList} title="Khảo sát" onPress={() => pick('khao-sat')} testID="menu-survey" />
            <MenuRow icon={LogOut} title="Đăng xuất" onPress={() => { setMenu(false); session.logout(); }} testID="menu-logout" danger />
          </View>
        </View>
      ) : null}

      {levelUp && !reward ? (
        <Overlay label="Lên cấp" onClose={() => setLevelUp(null)} testID="level-up" maxWidth={380}>
          <View style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: SG.yellow, alignItems: 'center', padding: 22, gap: 8 }}>
            <Sunburst color="#5632c0" ray="#6a45d6" size={800} />
            <Confetti />
            <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: SG.yellow, borderWidth: 5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }], marginVertical: 14 }}>
              <View style={{ transform: [{ rotate: '-45deg' }] }}><Txt f="heavy" size={44} color={SG.onYellow}>{levelUp.level}</Txt></View>
            </View>
            <Txt f="heavy" size={28} color="#ffffff" accessibilityRole="header">LÊN CẤP!</Txt>
            {levelUp.title ? <Txt f="bold" size={16} color="#ffe9a8" center>{levelUp.title}</Txt> : null}
            <GameBtn title="Tuyệt vời" tone="yellow" size="lg" onPress={() => setLevelUp(null)} testID="level-up-close" style={{ alignSelf: 'center', marginTop: 6 }} />
          </View>
        </Overlay>
      ) : null}

      {profile ? <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} /> : null}
      {cite ? <DetailSheet session={session} type={cite.type} id={cite.id} onClose={() => setCite(null)} onOpen={(type, id) => setCite({ type, id })} /> : null}
    </View>
  );
};

/** Trang học sinh: giữ chế độ sáng / tối đã chọn của tài khoản rồi mở Hành trình Đông A */
export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => { platform.prefs(session.token).then(setPrefs).catch(() => undefined); }, [session.token]);
  const dark = prefs?.theme === 'dark' || (prefs?.theme === 'system' && system === 'dark');
  const value = useMemo(() => ({ c: dark ? PALETTES.dark : PALETTES.light, dark: Boolean(dark) }), [dark]);
  return (
    <ThemeContext.Provider value={value}>
      <Shell session={session} prefs={prefs} setPrefs={setPrefs} />
    </ThemeContext.Provider>
  );
};
