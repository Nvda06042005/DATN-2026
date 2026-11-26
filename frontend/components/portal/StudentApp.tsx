/**
 * Trang học sinh (/hoc-sinh và đường dẫn riêng của trường với role=student) – "Binh thư Sát Thát" (25/11/2026, theo bản vẽ người dùng gửi; thay sảnh mở đầu
 * và thanh đầu cũ). Năm mục chính: Doanh trại · Chiến dịch (bốn khối 6–9) · Binh thư · Tiểu Tướng · Bảng vàng – điện thoại là thanh dưới đáy, máy tính là thanh đầu chữ.
 * Mỗi chặng 5 bước: Quân lệnh → Thám sử → Hội đồng quân sự → Xuất trận → Sử quan tổng kết (thế giới khối 3D là phần thêm, mục Nhập vai).
 * Các mục phụ: Hồ sơ, Chợ phiên Thăng Long, Giao diện, Luyện binh riêng, Trợ giúp, Lớp học. Mọi điểm, sao, vàng, phần thưởng và việc mở khóa do máy chủ quyết định
 * (/api/saga, /api/game); giao diện chỉ gửi lệnh và vẽ lại. Giao diện màu (Thăng Long / Sông Bạch Đằng / Đêm Đông Bộ Đầu / Hoàng thành) lấy từ trang bị đã lưu.
 * Mục đang mở nằm trên URL (tab, c = khối, s = chặng, v = bước) nên Back / Forward / tải lại giữ đúng chỗ; đường dẫn cũ (trang-chu, hoi, v=hoc/luyen/tran/tong-ket,
 * c=1–3) được chuyển sang mục mới tương ứng. Mỗi lần chuyển mục, bộ điều hướng dựng một màn mới và giữ màn cũ ẩn bên dưới: màn không còn được xem thì gỡ hết
 * nội dung (game, đồng hồ, phím tắt, hộp thoại) để lúc nào cũng chỉ có một màn chơi đang chạy.
 * Chưa vào lớp nào: chỉ có danh sách lớp (đăng ký bằng mã), Hồ sơ, Giao diện và Trợ giúp.
 * 26/11/2026 (người dùng chọn "Lớp học trước, rồi Doanh trại"): đăng nhập xong luôn mở trang LỚP HỌC trước (băng rôn + thẻ lớp), bấm VÀO LỚP mới tới Doanh trại;
 * tải lại trang vẫn ở lớp đang vào, đăng nhập lại thì bắt đầu từ trang Lớp học. Không còn tự vào lớp đầu tiên.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useNavigation, usePathname, useRouter, type Href } from 'expo-router';
import { KeyRound, LogOut } from 'lucide-react-native';
import { StudentCatalog } from '@/components/portal/StudentClasses';
import { FramedAvatar, ProfileScreen, ShopScreen, ThemeScreen } from '@/components/portal/SagaLook';
import * as authApi from '@/api/authApi';
import * as game from '@/api/gameApi';
import * as platform from '@/api/platformApi';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import { useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ProfileSheet } from '@/components/profile';
import { HelpPage } from '@/components/portal/HelpCenter';
import { DetailSheet } from '@/components/portal/Library';
import { NoticeBell, SettingsButton } from '@/components/portal/NoticeCenter';
import { AskScreen } from '@/components/portal/SagaAsk';
import { BoardScreen, CampaignScreen, HomeScreen, OrderScreen, RolePlayScreen } from '@/components/portal/SagaHome';
import { num, type SagaNav, type SagaRoute, type SagaStep, type SagaTab } from '@/components/portal/SagaKit';
import { BinhThuScreen, HoiDongScreen, LuyenBinhScreen, SuQuanScreen, ThamSuScreen } from '@/components/portal/SagaLearn';
import { BattleScreen, ExploreScreen } from '@/components/portal/SagaPlay';
import { StudentWorkspace, type StudentLink } from '@/components/portal/StudentWorkspace';
import { BtButton, BtProvider, themeOf, themePalette } from '@/components/portal/StudentDesign';
import { AdminUiContext, Sheet, Txt, useToast } from '@/components/ui';
import { usePortalTab } from '@/hooks/use-portal-tab';
import { ThemeContext } from '@/hooks/use-theme';
import { play, setSound, soundEnabled } from '@/lib/saga-sound';
import type { ProfilePatch } from '@/types/api';
import type { Prefs } from '@/types/platform';
import type { Completion, SagaHome } from '@/types/saga';

const TABS: readonly SagaTab[] = ['doanh-trai', 'chien-dich', 'binh-thu', 'tieu-tuong', 'bang-vang', 'ho-so', 'cua-hang', 'giao-dien', 'luyen-binh', 'tro-giup', 'lop-hoc', 'nhap-vai'];
/** Chưa vào lớp nào: ngoài danh sách lớp chỉ có Hồ sơ, Giao diện và Trợ giúp */
const BEFORE_CLASS: readonly SagaTab[] = ['lop-hoc', 'ho-so', 'giao-dien', 'tro-giup'];
const STEPS: readonly SagaStep[] = ['quan-lenh', 'tham-su', 'hoi-dong', 'xuat-tran', 'su-quan', 'kham-pha'];
/** Năm mục chính (thanh dưới đáy trên điện thoại, thanh đầu chữ trên máy tính) */
const NAV: ReadonlyArray<StudentLink<SagaTab>> = [
  { id: 'doanh-trai', label: 'Doanh trại' },
  { id: 'chien-dich', label: 'Chiến dịch' },
  { id: 'binh-thu', label: 'Binh thư' },
  { id: 'tieu-tuong', label: 'Tiểu Tướng' },
  { id: 'bang-vang', label: 'Bảng vàng' },
];
/** Đường dẫn cũ (trước 25/11/2026) → mục / bước mới */
const LEGACY_TAB: Record<string, SagaTab> = { 'trang-chu': 'doanh-trai', hoi: 'tieu-tuong', ai: 'tieu-tuong' };
const LEGACY_STEP: Record<string, SagaStep> = { hoc: 'tham-su', luyen: 'hoi-dong', tran: 'xuat-tran', 'tong-ket': 'su-quan' };
/** Mục phụ: ẩn thanh dưới đáy (có nút quay lại ở đầu màn) */
const NO_TABBAR: readonly SagaTab[] = ['ho-so', 'cua-hang', 'giao-dien', 'luyen-binh'];
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const idOf = (v: string | undefined): number | null => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);

/**
 * Dữ liệu dùng chung giữa các màn của cùng một phiên đăng nhập. Mỗi lần điều hướng là một màn mới (trạng thái React bắt đầu lại), nên:
 *  - Doanh trại (cấp độ, vàng, chuỗi ngày, giao diện) được nhớ theo token để số liệu và màu không nháy về mặc định rồi mới tải lại;
 *  - phần thưởng của chặng vừa hoàn thành được giữ tới khi màn Sử quan hiển thị xong.
 */
const HOME_CACHE = new Map<string, SagaHome>();
let pendingReward: { token: string; stageId: number; completion: Completion } | null = null;
/** Giao diện màu đã dùng lần trước (chỉ là tiện ích hiển thị của máy này; giao diện thật do máy chủ lưu trong trang bị) */
const THEME_KEY = 'donga.student.theme';
const readTheme = (): string | null => { try { return globalThis.localStorage?.getItem(THEME_KEY) ?? null; } catch { return null; } };
const writeTheme = (code: string): void => { try { globalThis.localStorage?.setItem(THEME_KEY, code); } catch { /* trình duyệt chặn lưu trữ */ } };
/**
 * Lớp em đã bấm VÀO LỚP: nhớ trong bộ nhớ và sessionStorage của thẻ trình duyệt (mã người dùng, mã lớp và dấu của lần đăng nhập – không có token) để chuyển mục
 * hay tải lại trang vẫn ở trong lớp. Dấu lần đăng nhập là băm ngắn của token: đăng nhập lại (token mới) thì dấu khác nên mở trang Lớp học trước.
 * Ứng dụng gốc nhúng thế giới khối ghi sẵn lớp không kèm dấu (lib/world-map.ts) – vẫn nhận.
 */
let enteredClass: { user: number; classId: number; login: string } | null = null;
const ENTER_KEY = 'donga.student.entered-class';
const loginMark = (token: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) { h ^= token.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
};
function readEntered(user: number, login: string): number | null {
  if (enteredClass) return enteredClass.user === user && enteredClass.login === login ? enteredClass.classId : null;
  try {
    const v = JSON.parse(globalThis.sessionStorage?.getItem(ENTER_KEY) ?? 'null') as { user?: unknown; classId?: unknown; login?: unknown } | null;
    if (v && v.user === user && Number.isInteger(v.classId) && (v.login === undefined || v.login === login)) { enteredClass = { user, classId: Number(v.classId), login }; return enteredClass.classId; }
  } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong bộ nhớ */ }
  return null;
}
function writeEntered(user: number, login: string, classId: number | null): void {
  enteredClass = classId ? { user, classId, login } : null;
  try { if (classId) globalThis.sessionStorage?.setItem(ENTER_KEY, JSON.stringify({ user, classId, login })); else globalThis.sessionStorage?.removeItem(ENTER_KEY); } catch { /* như trên */ }
}

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

export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string | string[]; c?: string | string[]; s?: string | string[]; v?: string | string[]; embed?: string | string[] }>();
  // ứng dụng điện thoại gốc nhúng trang này trong WebView (embed=1): chỉ hiện nội dung, không thanh đầu / thanh dưới; chuyển màn giữ embed
  const embed = Platform.OS === 'web' && one(params.embed) === '1';
  const [tab, setTab] = usePortalTab<SagaTab>(embed ? 'chien-dich' : 'doanh-trai', TABS);
  // đường dẫn cũ: đổi sang mục / bước / khối mới (thay đường dẫn, không thêm lịch sử)
  useEffect(() => {
    const rawTab = one(params.tab), rawV = one(params.v), rawC = idOf(one(params.c));
    const nextTab = rawTab ? LEGACY_TAB[rawTab] : undefined;
    const nextV = rawV ? LEGACY_STEP[rawV] : undefined;
    const oldC = rawC !== null && rawC >= 1 && rawC <= 3 && (rawTab === 'chien-dich' || !rawTab);
    if (!nextTab && !nextV && !oldC) return;
    const keep = Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([k, val]) => k !== 'school' && val !== undefined));
    router.replace({ pathname, params: { ...keep, ...(nextTab ? { tab: nextTab } : {}), ...(nextV ? { v: nextV } : {}), ...(oldC ? { c: String(rawC! + 5) } : {}) } } as Href);
  }, [params, pathname, router]);
  const focused = useIsFocused();
  const navigation = useNavigation();
  const home = useHome(session, focused);
  const [classTick, setClassTick] = useState(0);
  const myClasses = useLoad(() => authApi.myClasses(session.token), [session.token, classTick], session.expired);
  const gated = Boolean(myClasses.data) && !(myClasses.data ?? []).some((k) => k.is_active);
  // trang Lớp học trước (26/11/2026): chỉ vào lớp khi em bấm VÀO LỚP; đổi lớp ở Doanh trại (Đổi lớp) hoặc Hồ sơ → Lớp học của em
  const login = useMemo(() => loginMark(session.token), [session.token]);
  const [entered, setEnteredState] = useState<number | null>(() => readEntered(session.user.id, loginMark(session.token)));
  const enter = useCallback((id: number | null) => { writeEntered(session.user.id, login, id); setEnteredState(id); }, [session.user.id, login]);
  const cls = (myClasses.data ?? []).find((k) => k.is_active && k.id === entered) ?? null;
  // chỉ nhận phần thưởng đang chờ của chính phiên này (đăng xuất rồi tài khoản khác đăng nhập trên cùng máy thì không thấy)
  const [reward, setRewardState] = useState<{ stageId: number; completion: Completion } | null>(() => (pendingReward && pendingReward.token === session.token ? { stageId: pendingReward.stageId, completion: pendingReward.completion } : null));
  const setReward = useCallback((r: { stageId: number; completion: Completion } | null) => { pendingReward = r ? { token: session.token, ...r } : null; setRewardState(r); }, [session.token]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => { if (focused) platform.prefs(session.token).then(setPrefs).catch(() => undefined); }, [focused, session.token]);
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  // âm thanh trò chơi luôn tắt (16/11/2026, bỏ nút loa theo yêu cầu)
  useEffect(() => { if (soundEnabled()) setSound(false); }, []);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);
  const [cite, setCite] = useState<{ type: string; id: number } | null>(null);
  const [account, setAccount] = useState(false);
  // giao diện màu: lựa chọn vừa đổi (chờ Doanh trại tải lại) → trang bị máy chủ lưu → lần trước trên máy này → Thăng Long
  const [picked, setPicked] = useState<string | null>(null);
  const serverTheme = home.data?.look?.theme ?? null;
  useEffect(() => { setPicked(null); if (serverTheme) writeTheme(String(serverTheme)); }, [serverTheme]);
  const [stored] = useState<string | null>(readTheme);
  const bt = themeOf(picked ?? serverTheme ?? stored);
  const palette = useMemo(() => themePalette(bt), [bt]);

  const cNo = idOf(one(params.c)), stageId = idOf(one(params.s)), v = one(params.v);
  const route: SagaRoute = useMemo(() => ({ tab, c: cNo && cNo >= 6 && cNo <= 9 ? cNo : null, s: stageId, v: STEPS.includes(v as SagaStep) ? (v as SagaStep) : null }), [tab, cNo, stageId, v]);

  const go = useCallback<SagaNav['go']>((next, to = {}, mode = 'push') => {
    const target = { c: to.c ?? null, s: to.s ?? null, v: to.v ?? null };
    if (next === route.tab && target.c === route.c && target.s === route.s && target.v === route.v) return; // đang ở đúng màn này
    const extra = { c: target.c ? String(target.c) : undefined, s: target.s ? String(target.s) : undefined, v: target.v ?? undefined, embed: embed ? '1' : undefined };
    if (mode === 'params') { router.setParams({ ...extra, tab: next }); return; }
    if (mode === 'push') { setTab(next, extra); return; }
    const keep = Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([k, val]) => !['school', 'tab', 'c', 's', 'v'].includes(k) && val !== undefined));
    router.replace({ pathname, params: { ...keep, ...extra, tab: next } } as Href);
  }, [embed, params, pathname, route, router, setTab]);

  const back = useCallback<SagaNav['back']>((tabTo, to = {}) => {
    const st = navigation.getState() as { index: number; routes: Array<{ name: string; params?: Record<string, string | string[] | undefined> }> } | undefined;
    const cur = st?.routes[st.index], prev = st && st.index > 0 ? st.routes[st.index - 1] : undefined;
    const p = prev?.params ?? {}, q = cur?.params ?? {};
    const prevTab = TABS.includes(one(p.tab) as SagaTab) ? one(p.tab) : 'doanh-trai';
    const same = Boolean(prev && cur) && prev!.name === cur!.name && one(p.school) === one(q.school) && one(p.role) === one(q.role) && prevTab === tabTo
      && idOf(one(p.c)) === (to.c ?? null) && idOf(one(p.s)) === (to.s ?? null) && (one(p.v) || null) === (to.v ?? null);
    if (same && router.canGoBack()) router.back(); else go(tabTo, to, 'replace');
  }, [go, navigation, router]);

  const classId = cls?.id ?? entered;
  const setTheme = useCallback((code: string) => { setPicked(code); writeTheme(code); }, []);
  const openAccount = useCallback(() => setAccount(true), []);
  const nav: SagaNav = useMemo(() => ({ route, go, back, home: home.data, refresh: home.reload, reward, setReward, classId, theme: bt.code, setTheme, openAccount }),
    [route, go, back, home.data, home.reload, reward, setReward, classId, bt.code, setTheme, openAccount]);

  // chúc mừng do máy chủ ghi lại (lên cấp, nhiệm vụ, huy hiệu, mốc chuỗi ngày): hiện một lần rồi báo đã xem
  const seen = useRef(false);
  const unseen = home.data?.hud.unseen_celebrations ?? 0;
  // đang học, bàn hội đồng hay đánh trận thì chưa báo (không chen ngang màn chơi); tới màn Sử quan hoặc màn khác mới hiện
  const midStep = route.v !== null && route.v !== 'su-quan' && route.v !== 'quan-lenh';
  useEffect(() => {
    if (!unseen || seen.current || !focused || midStep) return;
    seen.current = true;
    game.celebrations(session.token).then((list) => {
      const up = list.filter((x) => x.kind === 'level_up').sort((a, b) => Number(b.payload.level ?? 0) - Number(a.payload.level ?? 0))[0];
      if (up) { setLevelUp({ level: Number(up.payload.level ?? 1), title: String(up.payload.title ?? '') }); play('reward'); }
      const streak = list.find((x) => x.kind === 'goal' && x.payload.milestone);
      const note = streak ?? list.find((x) => x.kind === 'quest') ?? list.find((x) => x.kind === 'badge') ?? list.find((x) => x.kind === 'goal');
      if (note) {
        const pl = note.payload as Record<string, unknown>;
        toast(note === streak ? `Chuỗi ${String(pl.milestone)} ngày!${pl.gold ? ` +${String(pl.gold)} vàng` : pl.unlock ? ` Mở ${String(pl.unlock)}` : ''}`
          : note.kind === 'quest' ? `Xong nhiệm vụ “${String(pl.title ?? '')}”` : note.kind === 'badge' ? `Huy hiệu mới: ${String(pl.name ?? '')}` : 'Đạt mục tiêu hôm nay!');
      }
      if (list.length) return game.ackCelebrations(session.token, list.map((x) => x.id));
      return undefined;
    }).catch(() => undefined).finally(() => { seen.current = false; });
  }, [unseen, focused, midStep, session.token, toast]);

  const pick = (id: SagaTab): void => go(id, { c: null, s: null, v: null });
  const stage = route.s !== null && route.v !== null ? { session, nav, stageId: route.s, campaignNo: route.c ?? home.data?.grade ?? 6 } : null;
  // trang Lớp học: lớp của em thì VÀO LỚP, lớp khác đăng ký bằng mã. Vào lớp xong mở Doanh trại; nếu em đến từ một đường dẫn tới thẳng mục / chặng
  // (thông báo, liên kết) thì mở đúng chỗ đó
  const afterEnter = (): void => { if (route.tab === 'lop-hoc') pick('doanh-trai'); };
  const catalog = (
    <StudentCatalog session={session} home={home.data}
      onJoined={(k) => { setClassTick((n) => n + 1); nav.refresh(); enter(k.id); afterEnter(); }} onEnter={(k) => { enter(k.id); afterEnter(); }} />
  );
  // màn đang nằm ẩn dưới một màn khác: không dựng gì để game, đồng hồ, phím tắt và hộp thoại của nó được gỡ sạch
  if (!focused) return <View style={{ flex: 1 }} testID="student-app-hidden" />;
  const inClass = entered !== null && (!myClasses.data || cls !== null); // đang tải danh sách lớp thì vẫn coi như trong lớp, tránh nháy
  const needClass = (gated || !inClass) && !BEFORE_CLASS.includes(route.tab);
  const className = cls?.name ?? home.data?.learner.class_name ?? null;

  const body = needClass || route.tab === 'lop-hoc' ? catalog
    : route.tab === 'chien-dich'
    ? stage && route.v === 'quan-lenh' ? <OrderScreen key={`ql${stage.stageId}`} {...stage} />
      : stage && route.v === 'tham-su' ? <ThamSuScreen key={`ts${stage.stageId}`} {...stage} />
      : stage && route.v === 'hoi-dong' ? <HoiDongScreen key={`hd${stage.stageId}`} {...stage} />
      : stage && route.v === 'kham-pha' ? <ExploreScreen key={`kp${stage.stageId}`} {...stage} />
      : stage && route.v === 'xuat-tran' ? <BattleScreen key={`xt${stage.stageId}`} {...stage} />
      : stage && route.v === 'su-quan' ? <SuQuanScreen key={`sq${stage.stageId}`} {...stage} />
      : <CampaignScreen key="campaign" session={session} nav={nav} />
    : route.tab === 'binh-thu' ? <BinhThuScreen session={session} nav={nav} />
    : route.tab === 'tieu-tuong' ? <AskScreen session={session} nav={nav} onOpen={(type, id) => setCite({ type, id })} />
    : route.tab === 'bang-vang' ? <BoardScreen session={session} nav={nav} classId={classId} className={className} />
    : route.tab === 'ho-so' ? <ProfileScreen session={session} nav={nav} schoolName={profile.data?.school?.name ?? null} className={className} />
    : route.tab === 'cua-hang' ? <ShopScreen session={session} nav={nav} />
    : route.tab === 'giao-dien' ? <ThemeScreen session={session} nav={nav} />
    : route.tab === 'luyen-binh' ? <LuyenBinhScreen session={session} nav={nav} />
    : route.tab === 'nhap-vai' ? <RolePlayScreen session={session} nav={nav} />
    : route.tab === 'tro-giup' ? <HelpPage session={session} />
    : <HomeScreen session={session} nav={nav} loading={home.loading} error={home.error} className={className} onRetry={home.reload} />;

  const extra = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <SettingsButton session={session} prefs={prefs} onSaved={setPrefs} />
      <NoticeBell session={session} onGo={(n) => pick(n.kind === 'support' ? 'tro-giup' : 'doanh-trai')} />
    </View>
  );
  const look = home.data?.look;
  const avatar = <FramedAvatar name={session.user.full_name} uri={session.user.avatar_url} size={34} frame={look?.frame} preset={look?.avatar} flag={look?.flag} testID="top-framed-avatar" />;
  const active: SagaTab | null = NAV.some((it) => it.id === route.tab) ? route.tab : route.tab === 'luyen-binh' || route.tab === 'ho-so' || route.tab === 'cua-hang' || route.tab === 'giao-dien' ? 'doanh-trai' : route.tab === 'nhap-vai' ? 'chien-dich' : null;
  const navItems = needClass || gated ? [] : NAV;
  // trang Lớp học khi đã ở trong lớp (Đổi lớp) vẫn có thanh dưới đáy để quay về; chưa vào lớp thì điện thoại dùng thanh gọn (logo, Hồ sơ, Đăng xuất)
  const tabBar = !needClass && route.v === null && !NO_TABBAR.includes(route.tab) && navItems.length > 0;

  return (
    <ThemeContext.Provider value={{ c: palette, dark: bt.dark }}>
    <BtProvider value={bt}>
    <AdminUiContext.Provider value={false}>
      <View style={{ flex: 1, backgroundColor: bt.bg }} testID="student-app">
        {embed ? <View style={{ flex: 1, minHeight: 0, backgroundColor: bt.bg }} testID="student-embed">{body}</View> : (
          <StudentWorkspace session={session} nav={navItems} active={active} onSelect={pick} home={home.data} extra={extra} avatar={avatar}
            onProfile={() => pick('ho-so')} tabBar={tabBar} phoneBar={needClass} schoolName={profile.data?.school?.name}>
            {body}
          </StudentWorkspace>
        )}
        {levelUp && !reward ? (
          <Sheet open onClose={() => setLevelUp(null)} title={`Lên cấp ${levelUp.level}`} subtitle={levelUp.title || undefined} footer={<BtButton title="Tiếp tục" full onPress={() => setLevelUp(null)} testID="level-up-close" />}>
            <View style={{ alignItems: 'center', gap: 8 }} testID="level-up">
              <View style={{ width: 88, height: 88, borderRadius: 18, backgroundColor: bt.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Txt f="serifBold" size={44} color={bt.accent}>{levelUp.level}</Txt>
              </View>
              <Txt size={15} color={bt.ink} center>Chúc mừng em đã lên cấp {levelUp.level}{levelUp.title ? ` – ${levelUp.title}` : ''}.</Txt>
              {home.data ? <Txt size={13} color={bt.muted} center>Tổng kinh nghiệm: {num(home.data.hud.xp)} KN</Txt> : null}
            </View>
          </Sheet>
        ) : null}
        {account ? (
          <ProfileSheet onClose={() => setAccount(false)} load={() => authApi.getProfile(session.token)} save={(patch: ProfilePatch) => authApi.updateProfile(session.token, patch)}
            upload={(img: { data: string }) => authApi.uploadAvatar(session.token, img)} onSaved={session.updateUser}>
            <BtButton title="Đổi mật khẩu" icon={KeyRound} tone="ghost" onPress={() => { setAccount(false); session.changePassword(); }} testID="account-password" />
            <BtButton title="Đăng xuất" icon={LogOut} tone="muted" onPress={() => { setAccount(false); session.logout(); }} testID="account-logout" />
          </ProfileSheet>
        ) : null}
        {cite ? <DetailSheet session={session} type={cite.type} id={cite.id} onClose={() => setCite(null)} onOpen={(type, id) => setCite({ type, id })} /> : null}
      </View>
    </AdminUiContext.Provider>
    </BtProvider>
    </ThemeContext.Provider>
  );
};
