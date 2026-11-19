/**
 * Danh sách lớp và "Tin nhắn" của học sinh (16/11/2026):
 * - Danh sách lớp là bước đầu của mục Chiến dịch (đợt 5: không còn menu Lớp học riêng): các lớp của trường như danh mục khóa học (nhóm theo năm học – học kỳ,
 *   thẻ lớp có khối, giáo viên, sĩ số). Lớp của em: bấm để vào học (tới ba phần của Hành trình). Lớp khác: mở trang đăng ký với ô "Mã tham gia lớp"
 *   (mã thầy cô gửi trong Tin nhắn); đăng ký xong vào học ngay. Chưa vào lớp nào thì học sinh chưa có các menu học tập khác.
 * - Tin nhắn: hộp thư đến (thầy cô, quản trị trường gửi); tin nhắn kèm mã lớp có nút mở trang đăng ký lớp với mã điền sẵn.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Flag, Inbox, KeyRound, LogIn, Mail, Play, Search, ShieldCheck, Users } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, Page, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Avatar, Btn, Card, EmptyState, Field, InfoNote, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogClass, InboxMessage } from '@/types/learning';
import type { SagaHome } from '@/types/saga';
import { AdventureHero, AdventureScene, GameButton, LearnerStats, RookieGuide, STUDENT as S } from '@/components/portal/StudentDesign';
import { SagaHeader, SagaPage } from '@/components/portal/SagaKit';

const BANNER = ['#266d59', '#2d6c83', '#6b5b94', '#92582e', '#266d59', '#2d6c83'];
const bannerOf = (k: CatalogClass) => BANNER[((k.grade ?? 6) - 6 + BANNER.length) % BANNER.length];
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const searchable = (value: string) => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

const ClassCard: React.FC<{ k: CatalogClass; onPress: () => void; preview?: boolean }> = ({ k, onPress, preview = false }) => {
  return (
    <Pressable onPress={onPress} disabled={preview} accessibilityRole={preview ? 'summary' : 'button'} accessibilityLabel={`Lớp ${k.name}${preview ? '' : k.mine ? ', em đã ở trong lớp. Bấm để vào học' : '. Bấm để đăng ký tham gia'}`} testID={`catalog-class-${k.id}`}
      style={({ pressed }) => ({ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, maxWidth: 430, borderRadius: 21, overflow: 'hidden', borderWidth: 1, borderBottomWidth: 5, borderColor: k.mine ? '#b4d7cb' : S.line, backgroundColor: S.white, opacity: pressed ? 0.92 : 1 })}>
      <View style={{ height: 151, backgroundColor: bannerOf(k), padding: 16, justifyContent: 'space-between', overflow: 'hidden' }}>
        <AdventureScene variant={((k.grade ?? 6) - 6) % 3 + 1} style={{ position: 'absolute', right: -31, bottom: -22, width: 242, height: 172, opacity: 0.85 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}><Txt f="bold" size={12} color={bannerOf(k)}>Khối {k.grade ?? '?'} · HK{k.semester}</Txt></View>
          <View style={{ width: 31, height: 31, borderRadius: 11, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            {k.mine ? <ShieldCheck size={19} color={S.teal} /> : <KeyRound size={17} color={bannerOf(k)} />}
          </View>
        </View>
        <View style={{ gap: 2 }}><Txt f="bold" size={11} color="#e2f1ec" style={{ letterSpacing: 1.6 }}>CÙNG ĐỒNG ĐỘI</Txt><Txt f="heavy" size={30} color="#ffffff">Lớp {k.name}</Txt></View>
      </View>
      <View style={{ padding: 17, gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Txt f="bold" size={16}>Hành trình Đông A</Txt>
          {k.mine ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Check size={14} color={S.teal} /><Txt f="bold" size={12} color={S.teal}>Lớp của em</Txt></View> : null}
        </View>
        {k.teachers.length ? k.teachers.map((t) => (
          <View key={t.full_name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={t.full_name} size={32} />
            <View style={{ flex: 1 }}><Txt f="semibold" size={14}>{t.full_name}</Txt><Txt size={12} color={S.muted}>Giáo viên đồng hành</Txt></View>
          </View>
        )) : <Txt size={14} color={S.muted}>Chưa phân công giáo viên</Txt>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Users size={16} color={S.muted} /><Txt size={13} color={S.muted}>{k.members} học sinh · {k.year_label}</Txt>
        </View>
        {!preview ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 46, gap: 8, borderRadius: 13, backgroundColor: k.mine ? S.teal : S.mint, borderBottomWidth: 3, borderBottomColor: k.mine ? S.deep : '#c6e4d6' }}>
          {k.mine ? <Play size={17} color="#ffffff" fill="#ffffff" /> : <KeyRound size={17} color={S.teal} />}<Txt f="bold" size={14} color={k.mine ? '#ffffff' : S.teal}>{k.mine ? 'Vào hành trình' : 'Tham gia bằng mã lớp'}</Txt>
        </View> : null}
      </View>
    </Pressable>
  );
};

/** Trang đăng ký một lớp: thông tin lớp, giáo viên, ô mã tham gia */
const EnrolPage: React.FC<{ session: Session; k: CatalogClass; code?: string; onBack: () => void; onJoined: () => void; onEnter: () => void }> = ({ session, k, code: initialCode, onBack, onJoined, onEnter }) => {
  const { c } = useTheme();
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const join = async () => {
    if (busy || k.mine || !k.join_open || code.trim().length < 6) return;
    setProblem(null); setBusy(true);
    try { await authApi.joinClass(session.token, code.trim(), k.id); onJoined(); } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Page>
      <Btn icon={ArrowLeft} title="Danh sách lớp" tone="ghost" size="sm" onPress={onBack} style={{ marginLeft: -10, alignSelf: 'flex-start' }} testID="enrol-back" />
      <SagaHeader title={`Lớp ${k.name}`} subtitle={`${k.year_label ?? ''} · Học kỳ ${k.semester} · Khối ${k.grade ?? '?'}`} />
      <Txt f="bold" size={20}>Tùy chọn tham gia</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }} testID="enrol-page">
        <View style={{ flexGrow: 1, flexBasis: 300, maxWidth: 460 }}><ClassCard k={k} preview onPress={() => undefined} /></View>
        <Card flat pad={18} style={{ flexGrow: 2, flexBasis: 320, gap: 12, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ChevronDown size={18} color={c.muc} /><Txt f="bold" size={18}>Tự đăng ký bằng mã lớp</Txt></View>
          {k.mine ? <View style={{ gap: 10 }}><InfoNote>Em đã ở trong lớp này.</InfoNote><Btn icon={Play} title="Vào học" tone="son" size="sm" style={{ alignSelf: 'flex-start' }} onPress={onEnter} testID="enrol-enter" /></View> : !k.join_open ? <InfoNote>Thầy cô đang tạm đóng việc tham gia bằng mã. Em hỏi thầy cô nhé.</InfoNote> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <Field label="Mã tham gia lớp" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))} autoCapitalize="characters" autoCorrect={false} maxLength={80}
              placeholder="Mã thầy cô gửi trong Tin nhắn" style={{ flexGrow: 1, flexBasis: 240 }} onSubmitEditing={() => { void join(); }} testID="enrol-code" />
            <Btn icon={LogIn} title="Tham gia lớp" tone="son" loading={busy} disabled={k.mine || !k.join_open || code.trim().length < 6} onPress={() => { void join(); }} testID="enrol-submit" />
          </View>
          <ErrorNote message={problem} />
          <Txt size={12} color={c.muc3}>Chưa có mã? Mở mục Tin nhắn: thầy cô gửi mã tham gia lớp ở đó.</Txt>
        </Card>
      </View>
    </Page>
  );
};

/** Danh sách lớp của trường, nhóm theo năm học – học kỳ (bước đầu của Chiến dịch): lớp của em thì vào học, lớp khác thì đăng ký bằng mã */
export const StudentCatalog: React.FC<{ session: Session; home?: SagaHome | null; onInbox?: () => void; prefill?: { classId: number; code: string } | null; onPrefillUsed?: () => void; onJoined: (k: CatalogClass) => void; onEnter: (k: CatalogClass) => void }> = ({ session, home, onInbox, prefill, onPrefillUsed, onJoined, onEnter }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 1280;
  const list = useLoad(() => authApi.classCatalog(session.token), [session.token], session.expired);
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const target = prefill ? (list.data ?? []).find((k) => k.id === prefill.classId) ?? null : null;
  const current = target ?? (list.data ?? []).find((k) => k.id === openId) ?? null;
  const term = searchable(q.trim());
  const mine = (list.data ?? []).filter((k) => k.mine);
  const name = home?.learner.name ?? session.user.full_name.trim().split(/\s+/).pop() ?? 'em';
  const groups = useMemo(() => {
    const out: Array<[string, CatalogClass[]]> = [];
    const filtered = (list.data ?? []).filter((x) => (!onlyMine || x.mine) && (!term || searchable(`${x.name} ${x.teachers.map((t) => t.full_name).join(' ')}`).includes(term)));
    for (const k of filtered) {
      const key = `Học kỳ ${k.semester} · ${k.year_label ?? ''}`;
      const g = out.find((x) => x[0] === key);
      if (g) g[1].push(k); else out.push([key, [k]]);
    }
    out.forEach(([, items]) => items.sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name, 'vi', { numeric: true })));
    return out;
  }, [list.data, term, onlyMine]);
  if (current) {
    return <EnrolPage session={session} k={current} code={target ? prefill?.code : undefined} onBack={() => { setOpenId(null); onPrefillUsed?.(); }} onJoined={() => { onPrefillUsed?.(); setOpenId(null); list.reload(); onJoined(current); }} onEnter={() => { onPrefillUsed?.(); setOpenId(null); onEnter(current); }} />;
  }
  return (
    <SagaPage testID="student-lobby" max={1320}>
      <AdventureHero title={`Chào ${name},\ncùng khám phá Đông A!`} subtitle="Học lịch sử qua những chuyến phiêu lưu. Vào lớp, chinh phục thử thách và ghi dấu thành tích của em."
        action={mine[0] ? <GameButton title={`Vào hành trình · Lớp ${mine[0].name}`} icon={Play} light onPress={() => onEnter(mine[0])} testID="lobby-continue" /> : onInbox ? <GameButton title="Lấy mã lớp từ Tin nhắn" icon={Mail} light onPress={onInbox} /> : undefined}
        footnote={home ? `${home.totals.done}/${home.totals.stages} chặng đã hoàn thành · Mỗi chặng là một khám phá mới` : 'Cùng Rồng Con học, luyện tập và khám phá lịch sử'} />
      {home && width < 1320 ? <LearnerStats home={home} compact={width < 600} /> : null}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 43, height: 43, borderRadius: 14, backgroundColor: S.mint, alignItems: 'center', justifyContent: 'center' }}><Flag size={23} color={S.teal} /></View>
          <View style={{ flex: 1 }}><Txt f="heavy" size={22} accessibilityRole="header">Lớp học của em</Txt><Txt size={16} color={S.muted}>Chọn lớp của em, bắt đầu khám phá.</Txt></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="tablist" accessibilityLabel="Lọc danh sách lớp">
          {[{ title: 'Tất cả lớp', value: false }, { title: `Lớp đã tham gia${list.data ? ` (${mine.length})` : ''}`, value: true }].map((filter) => (
            <Pressable key={filter.title} accessibilityRole="tab" accessibilityState={{ selected: onlyMine === filter.value }} onPress={() => setOnlyMine(filter.value)} testID={filter.value ? 'catalog-filter-mine' : 'catalog-filter-all'}
              style={{ minHeight: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: onlyMine === filter.value ? S.teal : S.white, borderWidth: 1, borderColor: onlyMine === filter.value ? S.teal : S.line }}><Txt f="bold" size={14} color={onlyMine === filter.value ? '#ffffff' : S.muted}>{filter.title}</Txt></Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
          <Search size={21} color={S.muted} />
          <Field label="Tìm lớp hoặc giáo viên" value={q} onChangeText={setQ} placeholder="Ví dụ: 7A3 hoặc tên thầy cô" style={{ flex: 1 }} testID="catalog-search" />
        </View>
        <ErrorNote message={list.error} />
        {list.error ? <Btn title="Tải lại danh sách lớp" tone="giay" onPress={list.reload} /> : null}
        {list.loading && !list.data ? <Spinner /> : null}
        {list.data && !list.data.length ? <EmptyState mood="thinking" title="Lớp học đang chờ em" text="Khi nhà trường mở lớp, em sẽ thấy lớp của mình tại đây." /> : null}
        {Boolean(list.data?.length) && groups.length === 0 ? <EmptyState title={onlyMine && !term ? 'Em chưa tham gia lớp nào' : 'Chưa tìm thấy lớp phù hợp'} text={onlyMine && !term ? 'Chọn Tất cả lớp và nhập mã thầy cô gửi để tham gia.' : 'Thử tên lớp hoặc tên giáo viên khác nhé.'} action={<GameButton title="Xem tất cả lớp" onPress={() => { setQ(''); setOnlyMine(false); }} />} /> : null}
      <View style={{ gap: 18 }} testID="catalog">
        {groups.map(([key, items]) => {
          const shut = closed.includes(key);
          return (
            <View key={key} style={{ gap: 10 }}>
              <Pressable onPress={() => setClosed((x) => (shut ? x.filter((y) => y !== key) : [...x, key]))} accessibilityRole="button" accessibilityState={{ expanded: !shut }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                {shut ? <ChevronRight size={17} color={S.teal} /> : <ChevronDown size={17} color={S.teal} />}
                <Txt f="bold" size={14} color={S.ink}>{key}</Txt>
                <Txt size={13} color={S.muted}> · {items.length} lớp</Txt>
              </Pressable>
              {shut ? null : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {items.map((k) => <ClassCard key={k.id} k={k} onPress={() => (k.mine ? onEnter(k) : setOpenId(k.id))} />)}
                </View>
              )}
            </View>
          );
        })}
      </View>
      </View>
      <View style={{ width: wide ? 290 : '100%', gap: 18 }}>
        {home?.daily ? <View testID="lobby-daily-quest" style={{ padding: 20, borderRadius: 21, borderWidth: 1, borderBottomWidth: 4, borderColor: S.line, backgroundColor: S.white, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Flag size={20} color={S.teal} /><Txt f="bold" size={17}>Nhiệm vụ hôm nay</Txt></View>
          <Txt f="semibold" size={14}>{home.daily.title}</Txt>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={home.daily.title} accessibilityValue={{ min: 0, max: home.daily.target, now: Math.min(home.daily.progress, home.daily.target) }} style={{ height: 11, borderRadius: 6, backgroundColor: S.mint, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.max(0, Math.min(100, home.daily.progress / Math.max(1, home.daily.target) * 100))}%`, borderRadius: 6, backgroundColor: S.teal }} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Txt size={13} color={S.muted}>{Math.min(home.daily.progress, home.daily.target)}/{home.daily.target} · {home.daily.done ? 'Đã hoàn thành' : 'Đang chinh phục'}</Txt><Txt f="bold" size={13} color={S.teal}>+{home.daily.reward_xp} XP</Txt></View>
          {home.daily.reward_gold > 0 ? <Txt size={13} color={S.goldInk}>Phần thưởng kèm {home.daily.reward_gold} vàng</Txt> : null}
        </View> : null}
        <RookieGuide onInbox={onInbox} />
        {home ? <View style={{ padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e5d49a', backgroundColor: '#fff8e2', gap: 10 }}>
          <Txt f="bold" size={16} color={S.goldInk}>Từng bước trở thành sử gia</Txt>
          <Txt size={16} color={S.goldInk}>{home.totals.done === 0 ? 'Bắt đầu chặng đầu tiên để nhận những ngôi sao của em.' : `Em đã hoàn thành ${home.totals.done} chặng. Tiếp tục khám phá để ghi thêm dấu ấn nhé!`}</Txt>
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Tiến độ Hành trình Đông A" accessibilityValue={{ min: 0, max: home.totals.stages, now: home.totals.done }} style={{ height: 11, borderRadius: 6, backgroundColor: '#f0e3b8', overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.min(100, home.totals.done / Math.max(1, home.totals.stages) * 100)}%`, backgroundColor: '#c48c20', borderRadius: 6 }} /></View>
          <Txt f="bold" size={13} color={S.goldInk}>{home.totals.done}/{home.totals.stages} chặng hoàn thành</Txt>
        </View> : null}
      </View>
      </View>
    </SagaPage>
  );
};

/** Hộp thư đến của học sinh: tin nhắn của thầy cô; tin nhắn kèm mã lớp có nút mở trang đăng ký lớp */
export const StudentInbox: React.FC<{ session: Session; onJoinCode: (classId: number, code: string) => void; onRead?: () => void }> = ({ session, onJoinCode, onRead }) => {
  const { c } = useTheme();
  const list = useLoad(() => learning.messageInbox(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<InboxMessage | null>(null);
  const read = (m: InboxMessage) => {
    setOpen(m);
    if (!m.read_at) learning.readMessage(session.token, m.id).then(() => { list.reload(); onRead?.(); }).catch(() => undefined);
  };
  if (open) {
    return (
      <Page>
        <Btn icon={ArrowLeft} title="Hộp thư" tone="ghost" size="sm" onPress={() => setOpen(null)} style={{ marginLeft: -10, alignSelf: 'flex-start' }} />
        <Card flat pad={20} style={{ gap: 14, borderRadius: 12 }} testID="inbox-view">
          <Txt f="bold" size={20} accessibilityRole="header">{open.subject}</Txt>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Avatar name={open.sender ?? 'Thầy cô'} size={40} />
            <View style={{ flex: 1 }}><Txt f="bold" size={14}>{open.sender ?? 'Thầy cô'}</Txt><Txt size={12} color={c.muc3}>{open.sender_role === 'school_admin' ? 'Quản trị trường' : 'Giáo viên'} · {when(open.created_at)}</Txt></View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 14 }}>
            {open.body ? <Txt size={15} style={{ lineHeight: 24 }} selectable>{open.body}</Txt> : <Txt size={14} color={c.muc3} style={{ fontStyle: 'italic' }}>(Tin nhắn không có nội dung)</Txt>}
          </View>
          {open.class_id && open.join_code ? (
            <Card flat pad={14} style={{ gap: 8, borderRadius: 12, borderWidth: 2, borderColor: c.logoRed }} testID="inbox-class-code">
              <Txt size={13} color={c.muc2}>Mã tham gia lớp {open.class_name}</Txt>
              <Txt f="heavy" size={22} selectable style={{ letterSpacing: 1 }}>{open.join_code}</Txt>
              <Btn icon={LogIn} title={`Vào lớp ${open.class_name ?? ''}`} tone="son" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => onJoinCode(open.class_id!, open.join_code!)} testID="inbox-join" />
            </Card>
          ) : null}
        </Card>
      </Page>
    );
  }
  const rows = list.data ?? [];
  return (
    <Page>
      <SagaHeader title="Tin nhắn" subtitle="Tin nhắn thầy cô và nhà trường gửi cho em." />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <Card flat pad={0} style={{ borderRadius: 12, overflow: 'hidden' }} testID="inbox-list">
        {rows.length ? rows.map((m) => (
          <Pressable key={m.id} onPress={() => read(m)} accessibilityRole="button" accessibilityLabel={`${m.read_at ? '' : 'Chưa đọc. '}${m.subject}, từ ${m.sender ?? 'thầy cô'}`} testID={`inbox-row-${m.id}`}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, minHeight: 64, borderBottomWidth: 1, borderBottomColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : m.read_at ? c.the : c.adminTint })}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: m.class_id ? c.sonNhat : c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
              {m.class_id ? <KeyRound size={17} color={c.sonChu} /> : <Mail size={17} color={c.thuyChu} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Txt f={m.read_at ? 'semibold' : 'bold'} size={14} numberOfLines={1} style={{ flex: 1 }}>{m.sender ?? 'Thầy cô'}</Txt>
                <Txt size={12} color={c.muc3}>{when(m.created_at)}</Txt>
              </View>
              <Txt f={m.read_at ? 'semibold' : 'bold'} size={14} numberOfLines={1}>{m.subject}</Txt>
              <Txt size={13} color={c.muc3} numberOfLines={1}>{(m.body ?? '').replace(/\s+/g, ' ') || (m.class_id ? `Mã tham gia lớp ${m.class_name ?? ''}` : '')}</Txt>
            </View>
          </Pressable>
        )) : (
          <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
            <Inbox size={28} color={c.muc3} />
            <Txt size={14} color={c.muc2} center>Chưa có tin nhắn nào.</Txt>
          </View>
        )}
      </Card>
    </Page>
  );
};
