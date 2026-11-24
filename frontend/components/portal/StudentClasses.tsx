/**
 * Danh sách lớp và "Tin nhắn" của học sinh (16/11/2026):
 * - Danh sách lớp là bước đầu của mục Chiến dịch (đợt 5: không còn menu Lớp học riêng): các lớp của trường như danh mục khóa học (nhóm theo năm học – học kỳ,
 *   thẻ lớp có khối, giáo viên, sĩ số). Lớp của em: bấm để vào học (tới ba phần của Hành trình). Lớp khác: mở trang đăng ký với ô "Mã tham gia lớp"
 *   (mã thầy cô gửi trong Tin nhắn); đăng ký xong vào học ngay. Chưa vào lớp nào thì học sinh chưa có các menu học tập khác.
 * - Tin nhắn: hộp thư đến (thầy cô, quản trị trường gửi); tin nhắn kèm mã lớp có nút mở trang đăng ký lớp với mã điền sẵn.
 */
import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Inbox, KeyRound, LogIn, Mail, Play, Search } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, Page, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { HALL_ART } from '@/components/portal/HallMedia';
import { Avatar, Btn, Card, EmptyState, Field, InfoNote, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogClass, InboxMessage } from '@/types/learning';
import type { SagaHome } from '@/types/saga';
import { BlockCard, GameButton, IconBadge, STUDENT as S } from '@/components/portal/StudentDesign';
import { SagaHeader } from '@/components/portal/SagaKit';

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const searchable = (value: string) => value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

/** Nền vách gỗ dọc giống bố cục chọn lớp mẫu */
const woodWallStyle = Platform.OS === 'web'
  ? ({
    backgroundColor: '#b38f68',
    backgroundImage: [
      'linear-gradient(180deg, rgba(46,24,10,0.24) 0px, rgba(46,24,10,0) 32px)',
      'repeating-linear-gradient(90deg, rgba(94,58,28,0.06) 0px, rgba(94,58,28,0.06) 2px, transparent 2px, transparent 11px, rgba(255,235,205,0.06) 11px, rgba(255,235,205,0.06) 13px, transparent 13px, transparent 23px)',
      'repeating-linear-gradient(90deg, #b8956e 0px, #b8956e 124px, #6e4c2e 124px, #6e4c2e 126px, #cca882 126px, #cca882 128px, #ab8760 128px, #ab8760 252px, #6e4c2e 252px, #6e4c2e 254px, #c6a37c 254px, #c6a37c 256px, #bf9c76 256px, #bf9c76 380px, #6e4c2e 380px, #6e4c2e 382px, #cda982 382px, #cda982 384px, #a58059 384px, #a58059 508px, #6e4c2e 508px, #6e4c2e 510px, #c8a680 510px, #c8a680 512px)',
    ].join(', '),
  } as object)
  : { backgroundColor: '#b38f68' };

/** Thẻ lớp học dùng khung Khuê Văn Các & Bia Tiến Sĩ (786×1010, nền trong suốt) */
const ClassCard: React.FC<{ k: CatalogClass; onPress: () => void; preview?: boolean; cardWidth?: number }> = ({ k, onPress, preview = false, cardWidth }) => {
  const teacherText = k.teachers.length ? `GV: ${k.teachers.map((t) => t.full_name).join(', ')}` : 'Chưa phân công giáo viên';
  const metaText = `Khối ${k.grade ?? '?'} · HK${k.semester} · ${k.members} học sinh`;
  const compact = (cardWidth ?? 330) < 280;
  return (
    <Pressable onPress={onPress} disabled={preview} accessibilityRole={preview ? 'summary' : 'button'}
      accessibilityLabel={`Lớp ${k.name}${preview ? '' : k.mine ? ', em đã ở trong lớp. Bấm để vào học' : '. Bấm để đăng ký tham gia'}`}
      testID={`catalog-class-${k.id}`}
      style={({ pressed }) => ([
        {
          width: cardWidth ?? '100%', maxWidth: 344, aspectRatio: 786 / 1010,
          position: 'relative', alignSelf: 'center',
          transform: [{ translateY: pressed ? 2 : 0 }, { scale: pressed ? 0.985 : 1 }],
        },
        Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 12px 16px rgba(34, 18, 6, 0.36))' } as object) : null,
      ])}>
      <Image source={HALL_ART.classCardFrame} style={{ width: '100%', height: '100%' }} resizeMode="stretch" accessibilityLabel={`Khung thẻ Lớp ${k.name}`} />

      {/* Biển đỏ trên mái: Tên lớp */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '24%', right: '24%', top: '18.2%', height: '8.4%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
        <Txt f="heavy" size={compact ? 17 : 20} color="#fff4d2" numberOfLines={1}
          style={{ letterSpacing: 0.6, textShadowColor: 'rgba(52,12,6,0.65)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 2 }}>
          Lớp {k.name}
        </Txt>
      </View>

      {/* Khung giấy dó dưới: Giáo viên, trạng thái & sĩ số */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '11%', right: '11%', top: '78.2%', height: '12.6%', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' }}>
          <Txt f="heavy" size={compact ? 12 : 13.5} color="#3a1e10" numberOfLines={1} style={{ flexShrink: 1 }}>
            {teacherText}
          </Txt>
          {k.mine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1.5, borderWidth: 1, borderColor: '#86efac', flexShrink: 0 }}>
              <Check size={10} color="#166534" strokeWidth={3} />
              <Txt f="heavy" size={10} color="#166534">Của em</Txt>
            </View>
          ) : null}
        </View>
        <Txt f="semibold" size={compact ? 10.5 : 11.5} color="#6e4b30" numberOfLines={1}>
          {metaText}
        </Txt>
      </View>

      {/* Biển đỏ đáy: Nút hành động */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '31%', right: '31%', top: '92.0%', height: '6.2%', alignItems: 'center', justifyContent: 'center' }}>
        <Txt f="heavy" size={compact ? 11.5 : 13} color="#fff4d2" numberOfLines={1} style={{ letterSpacing: 0.9 }}>
          {preview ? `KHỐI ${k.grade ?? '?'}` : k.mine ? 'VÀO LỚP' : 'XEM LỚP'}
        </Txt>
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
        <BlockCard pad={18} style={{ flexGrow: 2, flexBasis: 320, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><IconBadge icon={KeyRound} color={S.red} size={34} /><Txt f="heavy" size={18}>Tự đăng ký bằng mã lớp</Txt></View>
          {k.mine ? <View style={{ gap: 10 }}><InfoNote>Em đã ở trong lớp này.</InfoNote><Btn icon={Play} title="Vào học" tone="son" size="sm" style={{ alignSelf: 'flex-start' }} onPress={onEnter} testID="enrol-enter" /></View> : !k.join_open ? <InfoNote>Thầy cô đang tạm đóng việc tham gia bằng mã. Em hỏi thầy cô nhé.</InfoNote> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <Field label="Mã tham gia lớp" value={code} onChangeText={(v) => setCode(v.replace(/\s/g, ''))} autoCapitalize="characters" autoCorrect={false} maxLength={80}
              placeholder="Mã thầy cô gửi trong Tin nhắn" style={{ flexGrow: 1, flexBasis: 240 }} onSubmitEditing={() => { void join(); }} testID="enrol-code" />
            <Btn icon={LogIn} title="Tham gia lớp" tone="son" loading={busy} disabled={k.mine || !k.join_open || code.trim().length < 6} onPress={() => { void join(); }} testID="enrol-submit" />
          </View>
          <ErrorNote message={problem} />
          <Txt size={12} color={c.muc3}>Chưa có mã? Mở mục Tin nhắn: thầy cô gửi mã tham gia lớp ở đó.</Txt>
        </BlockCard>
      </View>
    </Page>
  );
};

/** Danh sách lớp của trường trên nền vách gỗ dọc với thẻ Khuê Văn Các – Bia Tiến Sĩ (lớp của em thì vào học, lớp khác đăng ký bằng mã) */
export const StudentCatalog: React.FC<{ session: Session; home?: SagaHome | null; onInbox?: () => void; prefill?: { classId: number; code: string } | null; onPrefillUsed?: () => void; onJoined: (k: CatalogClass) => void; onEnter: (k: CatalogClass) => void }> = ({ session, home: _home, onInbox: _onInbox, prefill, onPrefillUsed, onJoined, onEnter }) => {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const cols = width >= 1020 ? 3 : width >= 660 ? 2 : 1;
  const gap = compact ? 18 : 26;
  const padX = compact ? 16 : 32;
  const innerW = Math.min(width - padX * 2, 1120);
  const cardWidth = Math.min(340, Math.floor((innerW - gap * (cols - 1)) / cols));

  const list = useLoad(() => authApi.classCatalog(session.token), [session.token], session.expired);
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const target = prefill ? (list.data ?? []).find((k) => k.id === prefill.classId) ?? null : null;
  const current = target ?? (list.data ?? []).find((k) => k.id === openId) ?? null;
  const term = searchable(q.trim());
  const mine = (list.data ?? []).filter((k) => k.mine);
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
    <ScrollView testID="student-lobby" style={[{ flex: 1 }, woodWallStyle]} contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {/* Banner mở đầu lớp học thời Trần phủ mờ nhẹ + tiêu đề tiếng Việt căn giữa giống trang mẫu */}
      <View testID="catalog-hero" style={{ width: '100%', aspectRatio: 2, backgroundColor: '#3a2210', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={HALL_ART.classroomBanner}
          style={[
            { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
            Platform.OS === 'web' ? ({ filter: 'blur(1.5px) brightness(0.74)', transform: [{ scale: 1.02 }] } as object) : { opacity: 0.78 },
          ]}
          resizeMode="cover"
          accessibilityLabel="Lớp học lịch sử Đông A với ba chiến dịch 1258, 1285 và 1288"
        />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14, 10, 6, 0.34)' }} />

        <View pointerEvents="none" style={{ paddingHorizontal: 20, alignItems: 'center', gap: compact ? 8 : 12, maxWidth: 820 }}>
          <View style={{ backgroundColor: '#1890ff', paddingHorizontal: compact ? 18 : 26, paddingVertical: compact ? 6 : 8, borderRadius: 4, boxShadow: '0 6px 18px rgba(0,0,0,0.32)' } as object}>
            <Txt f="heavy" size={compact ? 24 : 42} color="#ffffff" center accessibilityRole="header" style={{ letterSpacing: 2 }}>
              LỚP HỌC
            </Txt>
          </View>
          <View style={{ backgroundColor: '#1890ff', paddingHorizontal: compact ? 12 : 18, paddingVertical: compact ? 5 : 6, borderRadius: 4, boxShadow: '0 4px 14px rgba(0,0,0,0.28)' } as object}>
            <Txt f="semibold" size={compact ? 12 : 15} color="#ffffff" center style={{ lineHeight: compact ? 18 : 22 }}>
              Chào mừng em đến với lớp học, tại đây em có thể xem thông tin chi tiết và danh sách các lớp học
            </Txt>
          </View>
        </View>
      </View>

      {/* Viền xà gỗ ngang ngăn cách banner lớp học và vách gỗ danh sách lớp */}
      <View pointerEvents="none" style={{ height: 14, backgroundColor: '#5c381c', borderTopWidth: 2, borderTopColor: '#7c4d26', borderBottomWidth: 3, borderBottomColor: '#3b210d' }} />

      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', paddingHorizontal: padX, paddingTop: compact ? 22 : 34, gap: 22 }}>
        {/* Thanh tìm kiếm trắng căn giữa giống trang mẫu + bộ lọc gọn ngay dưới */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{
            width: '100%', maxWidth: 460, height: 46, backgroundColor: '#ffffff', borderRadius: 6,
            flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 12,
            borderWidth: 1, borderColor: 'rgba(66,38,16,0.28)',
            boxShadow: '0 4px 12px rgba(42,22,8,0.24)',
          } as object}>
            <TextInput
              testID="catalog-search"
              value={q}
              onChangeText={setQ}
              placeholder="Tìm tên lớp hoặc giáo viên..."
              placeholderTextColor="#8c7a69"
              accessibilityLabel="Tìm lớp hoặc giáo viên"
              style={{ flex: 1, fontSize: 15, color: '#2b1d16', paddingVertical: 8, outlineStyle: 'none' } as object}
            />
            <Search size={19} color="#7a6450" />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }} accessibilityRole="tablist" accessibilityLabel="Lọc danh sách lớp">
            {[{ title: 'Tất cả lớp', value: false }, { title: `Lớp đã tham gia${list.data ? ` (${mine.length})` : ''}`, value: true }].map((filter) => {
              const on = onlyMine === filter.value;
              return (
                <Pressable key={filter.title} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setOnlyMine(filter.value)} testID={filter.value ? 'catalog-filter-mine' : 'catalog-filter-all'}
                  style={({ pressed }) => ({
                    minHeight: 38, borderRadius: 999, paddingHorizontal: 18, justifyContent: 'center',
                    backgroundColor: on ? '#fff5dc' : pressed ? 'rgba(46,24,10,0.68)' : 'rgba(46,24,10,0.52)',
                    borderWidth: 2, borderColor: on ? '#e3b244' : 'rgba(255,232,188,0.38)',
                  })}>
                  <Txt f="heavy" size={13} color={on ? '#5a2210' : '#fff5dc'}>{filter.title}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {list.error ? (
          <View style={{ maxWidth: 540, width: '100%', alignSelf: 'center', backgroundColor: '#fffaf0', borderRadius: 16, padding: 16, gap: 10 }}>
            <ErrorNote message={list.error} />
            <Btn title="Tải lại danh sách lớp" tone="giay" onPress={list.reload} />
          </View>
        ) : null}

        {list.loading && !list.data ? <Spinner /> : null}

        {list.data && !list.data.length ? (
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', backgroundColor: 'rgba(255,250,240,0.95)', borderRadius: 20, padding: 16 }}>
            <EmptyState mood="thinking" title="Lớp học đang chờ em" text="Khi nhà trường mở lớp, em sẽ thấy lớp của mình tại đây." />
          </View>
        ) : null}

        {Boolean(list.data?.length) && groups.length === 0 ? (
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', backgroundColor: 'rgba(255,250,240,0.95)', borderRadius: 20, padding: 16 }}>
            <EmptyState title={onlyMine && !term ? 'Em chưa tham gia lớp nào' : 'Chưa tìm thấy lớp phù hợp'} text={onlyMine && !term ? 'Chọn Tất cả lớp và nhập mã thầy cô gửi để tham gia.' : 'Thử tên lớp hoặc tên giáo viên khác nhé.'} action={<GameButton title="Xem tất cả lớp" onPress={() => { setQ(''); setOnlyMine(false); }} />} />
          </View>
        ) : null}

        <View style={{ gap: 26 }} testID="catalog">
          {groups.map(([key, items]) => {
            const shut = closed.includes(key);
            return (
              <View key={key} style={{ gap: 16 }}>
                <Pressable onPress={() => setClosed((x) => (shut ? x.filter((y) => y !== key) : [...x, key]))} accessibilityRole="button" accessibilityState={{ expanded: !shut }}
                  style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(46,24,10,0.58)', borderWidth: 1, borderColor: 'rgba(255,226,168,0.35)' }}>
                  {shut ? <ChevronRight size={16} color="#ffc75f" strokeWidth={2.8} /> : <ChevronDown size={16} color="#ffc75f" strokeWidth={2.8} />}
                  <Txt f="heavy" size={13.5} color="#fff5dc">{key}</Txt>
                  <Txt size={12.5} color="#f2d6a2"> · {items.length} lớp</Txt>
                </Pressable>
                {shut ? null : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, justifyContent: items.length < cols ? 'center' : 'flex-start', alignItems: 'flex-start' }}>
                    {items.map((k) => <ClassCard key={k.id} k={k} cardWidth={cardWidth} onPress={() => (k.mine ? onEnter(k) : setOpenId(k.id))} />)}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
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
        <BlockCard pad={20} style={{ gap: 14 }} testID="inbox-view">
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
        </BlockCard>
      </Page>
    );
  }
  const rows = list.data ?? [];
  return (
    <Page>
      <SagaHeader title="Tin nhắn" subtitle="Tin nhắn thầy cô và nhà trường gửi cho em." />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <BlockCard pad={0} style={{ overflow: 'hidden' }} testID="inbox-list">
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
      </BlockCard>
    </Page>
  );
};
