/**
 * Trang "Lớp học" và "Tin nhắn" của học sinh (16/11/2026):
 * - Lớp học: danh mục các lớp của trường như danh mục khóa học (nhóm theo năm học – học kỳ, thẻ lớp có khối, giáo viên, sĩ số); bấm một lớp mở trang
 *   đăng ký: thông tin lớp, giáo viên và ô "Mã tham gia lớp" (mã thầy cô gửi trong Tin nhắn). Vào lớp xong học sinh mới có đủ menu học tập.
 * - Tin nhắn: hộp thư đến (thầy cô, quản trị trường gửi); tin nhắn kèm mã lớp có nút mở trang đăng ký lớp với mã điền sẵn.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Inbox, KeyRound, LogIn, Mail, Search, Users } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, Page, PageHeader, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Avatar, Btn, Card, Chip, EmptyState, Field, InfoNote, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogClass, InboxMessage } from '@/types/learning';

const BANNER = ['#1d6f42', '#b45309', '#7e22ce', '#0369a1', '#b91c1c', '#0f766e'];
const bannerOf = (k: CatalogClass) => BANNER[((k.grade ?? 6) - 6 + BANNER.length) % BANNER.length];
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ClassCard: React.FC<{ k: CatalogClass; onPress: () => void }> = ({ k, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Lớp ${k.name}${k.mine ? ', em đã ở trong lớp' : ''}`} testID={`catalog-class-${k.id}`}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 280, maxWidth: 420, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.adminLine, backgroundColor: c.the, opacity: pressed ? 0.92 : 1 })}>
      <View style={{ height: 120, backgroundColor: bannerOf(k), padding: 12, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Txt f="bold" size={11} color={bannerOf(k)}>Khối {k.grade ?? '?'} · {k.year_label ?? ''}</Txt></View>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            {k.mine ? <Check size={16} color={c.mocChu} /> : <KeyRound size={15} color={c.logoRed} />}
          </View>
        </View>
        <Txt f="heavy" size={28} color="#ffffff" style={{ letterSpacing: 1 }}>LỚP {k.name.toLocaleUpperCase('vi')}</Txt>
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <Txt f="bold" size={15} color={c.logoRed}>Lớp {k.name} · Học kỳ {k.semester}</Txt>
        {k.teachers.length ? k.teachers.map((t) => (
          <View key={t.full_name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={t.full_name} size={32} />
            <View><Txt f="semibold" size={13} color={c.logoRed}>{t.full_name}</Txt><Txt size={11} color={c.muc3}>Giáo viên</Txt></View>
          </View>
        )) : <Txt size={13} color={c.muc3}>Chưa phân công giáo viên</Txt>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Users size={13} color={c.muc3} /><Txt size={12} color={c.muc3}>{k.members} học sinh</Txt>
          {k.mine ? <Chip text="Em đã ở trong lớp" bg={c.mocNhat} fg={c.mocChu} /> : null}
        </View>
      </View>
    </Pressable>
  );
};

/** Trang đăng ký một lớp: thông tin lớp, giáo viên, ô mã tham gia */
const EnrolPage: React.FC<{ session: Session; k: CatalogClass; code?: string; onBack: () => void; onJoined: () => void }> = ({ session, k, code: initialCode, onBack, onJoined }) => {
  const { c } = useTheme();
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const join = async () => {
    setProblem(null); setBusy(true);
    try { await authApi.joinClass(session.token, code.trim(), k.id); onJoined(); } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Page>
      <Btn icon={ArrowLeft} title="Danh sách lớp" tone="ghost" size="sm" onPress={onBack} style={{ marginLeft: -10, alignSelf: 'flex-start' }} testID="enrol-back" />
      <PageHeader title={`Lớp ${k.name}`} subtitle={`${k.year_label ?? ''} · Học kỳ ${k.semester} · Khối ${k.grade ?? '?'}`} />
      <Txt f="bold" size={20}>Tùy chọn tham gia</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }} testID="enrol-page">
        <View style={{ flexGrow: 1, flexBasis: 300, maxWidth: 460 }}><ClassCard k={k} onPress={() => undefined} /></View>
        <Card flat pad={18} style={{ flexGrow: 2, flexBasis: 320, gap: 12, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ChevronDown size={18} color={c.muc} /><Txt f="bold" size={18}>Tự đăng ký bằng mã lớp</Txt></View>
          {k.mine ? <InfoNote>Em đã ở trong lớp này.</InfoNote> : !k.join_open ? <InfoNote>Thầy cô đang tạm đóng việc tham gia bằng mã. Em hỏi thầy cô nhé.</InfoNote> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <Field label="Mã tham gia lớp" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))} autoCapitalize="characters" autoCorrect={false} maxLength={80}
              placeholder="Mã thầy cô gửi trong Tin nhắn" style={{ flexGrow: 1, flexBasis: 240 }} onSubmitEditing={() => { void join(); }} testID="enrol-code" />
            <Btn icon={LogIn} title="Tham gia lớp" tone="son" loading={busy} disabled={k.mine || code.trim().length < 6} onPress={() => { void join(); }} testID="enrol-submit" />
          </View>
          <ErrorNote message={problem} />
          <Txt size={12} color={c.muc3}>Chưa có mã? Mở mục Tin nhắn: thầy cô gửi mã tham gia lớp ở đó.</Txt>
        </Card>
      </View>
    </Page>
  );
};

/** Danh mục lớp của trường, nhóm theo năm học – học kỳ */
export const StudentCatalog: React.FC<{ session: Session; prefill?: { classId: number; code: string } | null; onPrefillUsed?: () => void; onJoined: () => void }> = ({ session, prefill, onPrefillUsed, onJoined }) => {
  const { c } = useTheme();
  const list = useLoad(() => authApi.classCatalog(session.token), [session.token], session.expired);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const target = prefill ? (list.data ?? []).find((k) => k.id === prefill.classId) ?? null : null;
  const current = target ?? (list.data ?? []).find((k) => k.id === openId) ?? null;
  const term = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const out: Array<[string, CatalogClass[]]> = [];
    for (const k of (list.data ?? []).filter((x) => !term || `${x.name} ${x.teachers.map((t) => t.full_name).join(' ')}`.toLowerCase().includes(term))) {
      const key = `HK${k.semester}-${k.year_label ?? ''}`;
      const g = out.find((x) => x[0] === key);
      if (g) g[1].push(k); else out.push([key, [k]]);
    }
    return out;
  }, [list.data, term]);
  if (current) {
    return <EnrolPage session={session} k={current} code={target ? prefill?.code : undefined} onBack={() => { setOpenId(null); onPrefillUsed?.(); }} onJoined={() => { onPrefillUsed?.(); setOpenId(null); list.reload(); onJoined(); }} />;
  }
  return (
    <Page>
      <PageHeader title="Lớp học" subtitle="Các lớp của trường. Chọn lớp của em rồi nhập mã tham gia thầy cô gửi trong Tin nhắn." />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: 520 }}>
        <Field label="Tìm lớp" value={q} onChangeText={setQ} placeholder="Tên lớp hoặc giáo viên" style={{ flex: 1 }} testID="catalog-search" />
        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.logoRed, alignItems: 'center', justifyContent: 'center' }}><Search size={18} color="#ffffff" /></View>
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Trường chưa có lớp nào" text="Khi nhà trường mở lớp, danh sách lớp sẽ hiện ở đây." /> : null}
      <View style={{ gap: 14 }} testID="catalog">
        {groups.map(([key, items]) => {
          const shut = closed.includes(key);
          return (
            <View key={key} style={{ gap: 10 }}>
              <Pressable onPress={() => setClosed((x) => (shut ? x.filter((y) => y !== key) : [...x, key]))} accessibilityRole="button" accessibilityState={{ expanded: !shut }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                {shut ? <ChevronRight size={16} color={c.logoRed} /> : <ChevronDown size={16} color={c.logoRed} />}
                <Txt f="semibold" size={15} color={c.logoRed}>{key}</Txt>
                <Txt size={12} color={c.muc3}> · {items.length} lớp</Txt>
              </Pressable>
              {shut ? null : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {items.map((k) => <ClassCard key={k.id} k={k} onPress={() => setOpenId(k.id)} />)}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Page>
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
      <PageHeader title="Tin nhắn" subtitle="Tin nhắn thầy cô và nhà trường gửi cho em." />
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
