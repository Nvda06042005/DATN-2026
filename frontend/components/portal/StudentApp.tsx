/**
 * Trang học sinh (/hoc-sinh và đường dẫn riêng của trường với role=student) – Hành trình Đông A (xây dựng lại 15/11/2026).
 * Vòng chơi: chọn cuộc kháng chiến → chọn chặng trên bản đồ → học kiến thức ngắn → minigame luyện tập → nhập vai khám phá → chạm trán (nếu có) → tổng kết, ôn tập → nhận thưởng,
 * lưu tiến độ, mở chặng tiếp theo. Mọi điểm, sao, phần thưởng và việc mở khóa do máy chủ quyết định (/api/saga); giao diện chỉ gửi lệnh và vẽ lại.
 * Khung trang (yêu cầu 16/11/2026: "trang học sinh lấy giao diện của quản trị tổng, quản trị trường và giáo viên"): dùng chung AdminWorkspace và giao diện phẳng
 * (AdminUiContext) với các cổng quản trị: thanh trên cùng (logo, đường dẫn, thông báo, hồ sơ, đăng xuất), menu bên trái (Chiến dịch, Nhập vai, Câu hỏi ôn tập,
 * Tư liệu, Bộ thẻ, Hỏi Tiểu Tướng, Trợ giúp), giao diện sáng như các cổng quản trị. Theo yêu cầu cùng ngày, trang học sinh không có logo ở thanh đầu
 * và không có mục Khảo sát (xóa hẳn; đường dẫn cũ `tab=khao-sat` mở trang Chiến dịch).
 * Mục đang mở nằm trên URL (tab, c = cuộc kháng chiến, s = chặng, v = bước) nên Back / Forward / tải lại giữ đúng chỗ.
 * Mỗi lần chuyển mục, bộ điều hướng dựng một màn mới và giữ màn cũ ẩn bên dưới: màn không còn được xem thì gỡ hết nội dung (game Phaser, đồng hồ, phím tắt, hộp thoại)
 * để lúc nào cũng chỉ có một màn chơi đang chạy; khi quay lại, màn đó tải lại trạng thái chuẩn từ máy chủ.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useNavigation, usePathname, useRouter, type Href } from 'expo-router';
import { CircleQuestionMark, ClipboardCheck, GalleryHorizontalEnd, Gamepad2, LifeBuoy, Mail, Map as MapIcon, ScrollText, Sparkles } from 'lucide-react-native';
import * as learningApi from '@/api/learningApi';
import { StudentCatalog, StudentInbox } from '@/components/portal/StudentClasses';
import { StudentExams } from '@/components/admin/LibraryExams';
import * as authApi from '@/api/authApi';
import * as game from '@/api/gameApi';
import * as platform from '@/api/platformApi';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import { AdminWorkspace, type NavLeaf } from '@/components/admin/AdminWorkspace';
import { useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { HelpPage } from '@/components/portal/HelpCenter';
import { DetailSheet } from '@/components/portal/Library';
import { NoticeBell, SettingsButton } from '@/components/portal/NoticeCenter';
import { ArchiveScreen, CollectionScreen, ReviewScreen } from '@/components/portal/SagaExtras';
import { CampaignScreen, HomeScreen, RolePlayScreen } from '@/components/portal/SagaHome';
import { SagaHeader, SagaPage, num, type SagaNav, type SagaRoute, type SagaStep, type SagaTab } from '@/components/portal/SagaKit';
import { LessonScreen, PracticeScreen, SummaryScreen } from '@/components/portal/SagaLearn';
import { BattleScreen, ExploreScreen } from '@/components/portal/SagaPlay';
import { StudentAiHub } from '@/components/ai/StudentAiHub';
import { AdminUiContext, Btn, Sheet, Txt, useToast } from '@/components/ui';
import { usePortalTab } from '@/hooks/use-portal-tab';
import { useTheme } from '@/hooks/use-theme';
import { play, setSound, soundEnabled } from '@/lib/saga-sound';
import type { Prefs } from '@/types/platform';
import type { Completion, SagaHome } from '@/types/saga';

/** `lop-hoc` chỉ còn cho đường dẫn cũ: danh sách lớp nay là bước đầu của Chiến dịch (16/11/2026 đợt 5) */
const TABS: readonly SagaTab[] = ['chien-dich', 'nhap-vai', 'cau-hoi', 'ky-thi', 'tu-lieu', 'bo-the', 'hoi', 'lop-hoc', 'tin-nhan', 'tro-giup'];
/** Chưa vào lớp nào: chỉ có Chiến dịch (danh sách lớp, đăng ký bằng mã), Tin nhắn (mã lớp thầy cô gửi), Trợ giúp (16/11/2026) */
const BEFORE_CLASS: readonly SagaTab[] = ['chien-dich', 'tin-nhan', 'tro-giup'];
const STEPS: readonly SagaStep[] = ['hoc', 'luyen', 'kham-pha', 'tran', 'tong-ket'];
/** Menu bên trái, cùng kiểu với menu của quản trị tổng, quản trị trường và giáo viên */
const NAV: ReadonlyArray<NavLeaf<SagaTab>> = [
  { id: 'chien-dich', label: 'Chiến dịch', icon: MapIcon },
  { id: 'nhap-vai', label: 'Nhập vai', icon: Gamepad2 },
  { id: 'cau-hoi', label: 'Câu hỏi ôn tập', icon: CircleQuestionMark },
  { id: 'ky-thi', label: 'Kỳ thi', icon: ClipboardCheck },
  { id: 'tu-lieu', label: 'Tư liệu', icon: ScrollText },
  { id: 'bo-the', label: 'Bộ thẻ', icon: GalleryHorizontalEnd },
  { id: 'hoi', label: 'Hỏi Tiểu Tướng', icon: Sparkles },
  { id: 'tin-nhan', label: 'Tin nhắn', icon: Mail },
  { id: 'tro-giup', label: 'Trợ giúp', icon: LifeBuoy },
];
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const idOf = (v: string | undefined): number | null => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);

/**
 * Dữ liệu dùng chung giữa các màn của cùng một phiên đăng nhập. Mỗi lần điều hướng là một màn mới (trạng thái React bắt đầu lại), nên:
 *  - trang chủ (cấp độ, vàng, chuỗi ngày) được nhớ theo token để số liệu không nháy về 0 rồi mới tải lại;
 *  - phần thưởng của chặng vừa hoàn thành được giữ tới khi màn tổng kết hiển thị xong.
 */
const HOME_CACHE = new Map<string, SagaHome>();
let pendingReward: { token: string; stageId: number; completion: Completion } | null = null;
/** Mã lớp mở từ tin nhắn: chuyển mục tạo màn mới nên giữ ngoài thành phần, như `pendingReward` (16/11/2026) */
let pendingJoin: { token: string; classId: number; code: string } | null = null;
/**
 * Lớp em đã chọn ở danh sách lớp (bước đầu của Chiến dịch, đợt 5): nhớ trong bộ nhớ và sessionStorage của thẻ trình duyệt (chỉ mã người dùng và mã lớp,
 * không có token) để chuyển mục hay tải lại trang vẫn ở ba phần; đăng nhập lại thì bắt đầu từ danh sách lớp.
 */
let enteredClass: { user: number; classId: number } | null = null;
const ENTER_KEY = 'donga.student.entered-class';
function readEntered(user: number): number | null {
  if (enteredClass) return enteredClass.user === user ? enteredClass.classId : null;
  try {
    const v = JSON.parse(globalThis.sessionStorage?.getItem(ENTER_KEY) ?? 'null') as { user?: unknown; classId?: unknown } | null;
    if (v && v.user === user && Number.isInteger(v.classId)) { enteredClass = { user, classId: Number(v.classId) }; return enteredClass.classId; }
  } catch { /* trình duyệt chặn lưu trữ: chỉ nhớ trong bộ nhớ */ }
  return null;
}
function writeEntered(user: number, classId: number | null): void {
  enteredClass = classId ? { user, classId } : null;
  try { if (classId) globalThis.sessionStorage?.setItem(ENTER_KEY, JSON.stringify({ user, classId })); else globalThis.sessionStorage?.removeItem(ENTER_KEY); } catch { /* như trên */ }
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
  const { c } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string | string[]; c?: string | string[]; s?: string | string[]; v?: string | string[] }>();
  const [tab, setTab] = usePortalTab<SagaTab>('chien-dich', TABS);
  useEffect(() => {
    if (one(params.tab) === 'ai') {
      const keep = Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([k, val]) => k !== 'school' && k !== 'tab' && val !== undefined));
      router.replace({ pathname, params: { ...keep, tab: 'hoi' } } as Href);
    }
  }, [params, pathname, router]);
  const focused = useIsFocused();
  const navigation = useNavigation();
  const home = useHome(session, focused);
  // lớp của em, tin nhắn và mã lớp điền sẵn (mở từ tin nhắn) – 16/11/2026
  const [classTick, setClassTick] = useState(0);
  const [inboxTick, setInboxTick] = useState(0);
  const [prefill, setPrefillState] = useState<{ classId: number; code: string } | null>(() => (pendingJoin && pendingJoin.token === session.token ? { classId: pendingJoin.classId, code: pendingJoin.code } : null));
  const setPrefill = useCallback((p: { classId: number; code: string } | null) => { pendingJoin = p ? { token: session.token, ...p } : null; setPrefillState(p); }, [session.token]);
  const myClasses = useLoad(() => authApi.myClasses(session.token), [session.token, classTick], session.expired);
  const inbox = useLoad(() => learningApi.messageInbox(session.token), [session.token, inboxTick, focused], session.expired);
  const gated = Boolean(myClasses.data) && !(myClasses.data ?? []).some((k) => k.is_active);
  const [entered, setEnteredState] = useState<number | null>(() => readEntered(session.user.id));
  const enter = useCallback((id: number | null) => { writeEntered(session.user.id, id); setEnteredState(id); }, [session.user.id]);
  const cls = (myClasses.data ?? []).find((k) => k.is_active && k.id === entered) ?? null;
  const inClass = entered !== null && (!myClasses.data || cls !== null); // đang tải danh sách lớp thì vẫn ở ba phần, tránh nháy
  // chỉ nhận phần thưởng đang chờ của chính phiên này (đăng xuất rồi tài khoản khác đăng nhập trên cùng máy thì không thấy)
  const [reward, setRewardState] = useState<{ stageId: number; completion: Completion } | null>(() => (pendingReward && pendingReward.token === session.token ? { stageId: pendingReward.stageId, completion: pendingReward.completion } : null));
  const setReward = useCallback((r: { stageId: number; completion: Completion } | null) => { pendingReward = r ? { token: session.token, ...r } : null; setRewardState(r); }, [session.token]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => { if (focused) platform.prefs(session.token).then(setPrefs).catch(() => undefined); }, [focused, session.token]);
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  // 16/11/2026: bỏ nút loa ở thanh đầu theo yêu cầu – âm thanh trò chơi luôn tắt (tắt luôn cả lựa chọn đã bật trước đây)
  useEffect(() => { if (soundEnabled()) setSound(false); }, []);
  const [levelUp, setLevelUp] = useState<{ level: number; title: string } | null>(null);
  const [cite, setCite] = useState<{ type: string; id: number } | null>(null);

  const cNo = idOf(one(params.c)), stageId = idOf(one(params.s)), v = one(params.v);
  const route: SagaRoute = useMemo(() => ({ tab, c: cNo && cNo >= 1 && cNo <= 3 ? cNo : null, s: stageId, v: STEPS.includes(v as SagaStep) ? (v as SagaStep) : null }), [tab, cNo, stageId, v]);

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

  const pick = (id: SagaTab): void => go(id, { c: null, s: null, v: null });
  const stage = route.s !== null && route.c !== null && route.v !== null ? { session, nav, stageId: route.s, campaignNo: route.c } : null;
  // Chiến dịch bắt đầu từ danh sách lớp: lớp của em thì vào học, lớp khác đăng ký bằng mã; vào lớp rồi mới tới ba phần (16/11/2026 đợt 5)
  const catalog = (
    <StudentCatalog session={session} prefill={prefill} onPrefillUsed={() => setPrefill(null)}
      onJoined={(k) => { setClassTick((n) => n + 1); nav.refresh(); enter(k.id); pick('chien-dich'); }} onEnter={(k) => { enter(k.id); pick('chien-dich'); }} />
  );
  // màn đang nằm ẩn dưới một màn khác: không dựng gì để game, đồng hồ, phím tắt và hộp thoại của nó được gỡ sạch
  if (!focused) return <View style={{ flex: 1 }} testID="student-app-hidden" />;

  const body = (gated && !BEFORE_CLASS.includes(route.tab)) || route.tab === 'lop-hoc' ? catalog
    : route.tab === 'tin-nhan' ? <StudentInbox session={session} onRead={() => setInboxTick((n) => n + 1)} onJoinCode={(classId, code) => { setPrefill({ classId, code }); enter(null); pick('chien-dich'); }} />
    : route.tab === 'chien-dich'
    ? gated ? catalog
      : stage && route.v === 'hoc' ? <LessonScreen key={`hoc${stage.stageId}`} {...stage} />
      : stage && route.v === 'luyen' ? <PracticeScreen key={`luyen${stage.stageId}`} {...stage} />
      : stage && route.v === 'kham-pha' ? <ExploreScreen key={`kp${stage.stageId}`} {...stage} />
      : stage && route.v === 'tran' ? <BattleScreen key={`tran${stage.stageId}`} {...stage} />
      : stage && route.v === 'tong-ket' ? <SummaryScreen key={`tk${stage.stageId}`} {...stage} />
      : route.c !== null ? <CampaignScreen key="campaign" session={session} nav={nav} no={route.c} />
      : inClass ? <HomeScreen nav={nav} loading={home.loading} error={home.error} cls={cls} onLeave={() => enter(null)} /> : catalog
    : route.tab === 'nhap-vai' ? <RolePlayScreen session={session} nav={nav} />
    : route.tab === 'cau-hoi' ? <ReviewScreen session={session} nav={nav} />
    : route.tab === 'ky-thi' ? <StudentExams session={session} />
    : route.tab === 'tu-lieu' ? <ArchiveScreen session={session} nav={nav} />
    : route.tab === 'bo-the' ? <CollectionScreen session={session} nav={nav} />
    : route.tab === 'hoi' ? (
      <SagaPage testID="saga-ask">
        <SagaHeader title="Hỏi Tiểu Tướng" subtitle="Trợ lý AI Sử học Đông A: Hỏi đáp Sử liệu, Lộ trình Cá nhân hóa, Flash Cards và Chẩn đoán BKT." />
        <StudentAiHub session={session} onOpen={(type, id) => setCite({ type, id })} onPractice={() => pick('cau-hoi')} onLearn={() => pick('chien-dich')} />
      </SagaPage>
    ) : <HelpPage session={session} />;

  const unread = (inbox.data ?? []).filter((m) => !m.read_at).length;
  const navItems = NAV.filter((it) => !gated || BEFORE_CLASS.includes(it.id)).map((it) => (it.id === 'cau-hoi' && home.data?.review_due ? { ...it, count: home.data.review_due } : it.id === 'tin-nhan' && unread ? { ...it, count: unread } : it));
  const extra = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <SettingsButton session={session} prefs={prefs} onSaved={setPrefs} />
      <NoticeBell session={session} onGo={(n) => pick(n.kind === 'support' ? 'tro-giup' : n.kind === 'exam' ? 'ky-thi' : n.kind === 'message' ? 'tin-nhan' : 'chien-dich')} />
    </View>
  );

  return (
    <AdminUiContext.Provider value>
      <View style={{ flex: 1 }} testID="student-app">
        <AdminWorkspace session={session} nav={navItems} active={route.tab === 'lop-hoc' ? 'chien-dich' : route.tab} onSelect={pick} schoolName={profile.data?.school?.name} extra={extra}>
          {body}
        </AdminWorkspace>
        {levelUp && !reward ? (
          <Sheet open onClose={() => setLevelUp(null)} title={`Lên cấp ${levelUp.level}`} subtitle={levelUp.title || undefined} footer={<Btn title="Tiếp tục" tone="son" full onPress={() => setLevelUp(null)} testID="level-up-close" />}>
            <View style={{ alignItems: 'center', gap: 8 }} testID="level-up">
              <View style={{ width: 88, height: 88, borderRadius: 16, backgroundColor: c.sonNhat, alignItems: 'center', justifyContent: 'center' }}>
                <Txt f="displayHeavy" size={44} color={c.son}>{levelUp.level}</Txt>
              </View>
              <Txt size={15} center>Chúc mừng em đã lên cấp {levelUp.level}{levelUp.title ? ` – ${levelUp.title}` : ''}.</Txt>
              {home.data ? <Txt size={13} color={c.muc2} center>Tổng điểm kinh nghiệm: {num(home.data.hud.xp)}</Txt> : null}
            </View>
          </Sheet>
        ) : null}
        {cite ? <DetailSheet session={session} type={cite.type} id={cite.id} onClose={() => setCite(null)} onOpen={(type, id) => setCite({ type, id })} /> : null}
      </View>
    </AdminUiContext.Provider>
  );
};
