/**
 * Trợ giúp (Sprint 11): hướng dẫn sử dụng và câu hỏi thường gặp theo vai trò, có ảnh và video minh họa (HK.HS.110, HK.GV.080, HK.QT.054); gửi phản hồi / báo lỗi kèm ảnh chụp màn hình
 * và theo dõi trạng thái xử lý Mới / Đang xử lý / Đã xong (HK.HS.111, HK.GV.081, HK.QT.052). Dùng chung cho học sinh, giáo viên và quản trị trường.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp, ImagePlus, PlayCircle, Send, X } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import type { PickedFile } from '@/api/client';
import { ErrorNote, Page, PageHeader, pickFile, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, RichText, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { TICKET_CATEGORY_TEXT, TICKET_STATUS_TEXT, type FaqItem, type Ticket } from '@/types/platform';

const MAX_IMAGE = 1_500_000;
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/** Đọc ảnh đã chọn thành chuỗi base64 (trình duyệt và điện thoại đều có FileReader) */
export async function readImage(picked: PickedFile): Promise<{ name: string; data: string }> {
  const blob: Blob = (picked.file as Blob | undefined) ?? (await (await fetch(picked.uri)).blob());
  if (blob.size > MAX_IMAGE) throw new Error('Ảnh tối đa 1,5 MB. Hãy chọn ảnh nhỏ hơn hoặc chụp lại vùng cần báo.');
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được ảnh.'));
    r.readAsDataURL(blob);
  });
  return { name: picked.name || 'anh-chup-man-hinh', data };
}

// ---------------------------------------------------------------------- hướng dẫn và câu hỏi thường gặp
const Faq: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const data = useLoad(() => api.faq(session.token), [session.token], session.expired);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = (data.data?.items ?? []).filter((i) => !q || `${i.question} ${i.answer} ${i.category}`.toLowerCase().includes(q));
    const map = new Map<string, FaqItem[]>();
    for (const i of items) map.set(i.category, [...(map.get(i.category) ?? []), i]);
    return [...map.entries()];
  }, [data.data, query]);
  return (
    <View style={{ gap: 12 }}>
      <Field label="Tìm trong hướng dẫn" value={query} onChangeText={setQuery} placeholder="Ví dụ: mật khẩu, lớp, thi đấu…" autoCapitalize="none" nativeID="faq-search" />
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data && !groups.length ? <EmptyState mood="thinking" title={query ? 'Không tìm thấy mục nào' : 'Chưa có hướng dẫn'} text={query ? 'Thử từ khóa khác, hoặc gửi câu hỏi ở mục “Gửi phản hồi”.' : undefined} /> : null}
      {groups.map(([category, items]) => (
        <View key={category} style={{ gap: 8 }}>
          <Txt f="bold" size={16} accessibilityRole="header">{category}</Txt>
          {items.map((i) => {
            const on = open === i.id;
            return (
              <Card key={i.id} flat pad={0} style={{ overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(on ? null : i.id)} testID={`faq-${i.id}`}
                  style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? c.the2 : c.the })}>
                  <Txt f="semibold" size={15} style={{ flex: 1 }}>{i.question}</Txt>
                  {on ? <ChevronUp size={18} color={c.muc2} /> : <ChevronDown size={18} color={c.muc2} />}
                </Pressable>
                {on ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                    <RichText text={i.answer} size={14} />
                    {i.image_url ? <Image source={{ uri: i.image_url }} accessibilityLabel={`Hình minh họa: ${i.question}`} resizeMode="contain" style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: c.the2 }} /> : null}
                    {i.video_url ? <Btn icon={PlayCircle} title="Xem video hướng dẫn" tone="thuy" size="sm" onPress={() => void Linking.openURL(i.video_url!)} /> : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- gửi phản hồi / báo lỗi
const SendForm: React.FC<{ session: Session; onSent: () => void }> = ({ session, onSent }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    try {
      const picked = await pickFile(['image/png', 'image/jpeg', 'image/webp']);
      if (picked) setImage(await readImage(picked));
    } catch (e) { setError((e as Error).message); }
  };
  const valid = subject.trim().length >= 3 && text.trim().length >= 5;
  const send = async () => {
    const out = await run(() => api.createTicket(session.token, { category, subject: subject.trim(), body: text.trim(), attachment: image }), 'Đã gửi yêu cầu. Bạn theo dõi trạng thái ở mục “Yêu cầu của tôi”.');
    if (out) { setSubject(''); setText(''); setImage(null); onSent(); }
  };
  return (
    <Card pad={14} style={{ gap: 12 }}>
      <Txt f="bold" size={16} accessibilityRole="header">Gửi phản hồi hoặc báo lỗi</Txt>
      <Segmented<string> label="Loại yêu cầu" value={category} onChange={setCategory} options={Object.entries(TICKET_CATEGORY_TEXT).map(([value, label]) => ({ value, label }))} />
      <Field label="Tiêu đề" value={subject} onChangeText={setSubject} maxLength={160} placeholder="Ví dụ: Nút Làm bài không bấm được" nativeID="ticket-subject" />
      <Field label="Mô tả chi tiết" value={text} onChangeText={setText} multiline numberOfLines={5} maxLength={3000} inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} hint="Bạn đang làm gì, điều gì xảy ra và bạn mong muốn điều gì?" nativeID="ticket-body" />
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ImagePlus} title={image ? 'Chọn ảnh khác' : 'Đính kèm ảnh chụp màn hình'} tone="giay" size="sm" onPress={pick} testID="ticket-attach" />
          {image ? <><Chip text={image.name} bg={c.the2} fg={c.muc2} /><Pressable accessibilityRole="button" accessibilityLabel="Bỏ ảnh đính kèm" onPress={() => setImage(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={c.muc2} /></Pressable></> : null}
        </View>
        <Txt size={12} color={c.muc3}>Ảnh png, jpeg hoặc webp, tối đa 1,5 MB. Đừng chụp mật khẩu hay thông tin cá nhân.</Txt>
      </View>
      <ErrorNote message={error} />
      <View style={{ flexDirection: 'row' }}><Btn icon={Send} title="Gửi yêu cầu" tone="ngoc" disabled={!valid} loading={busy} onPress={send} testID="ticket-send" /></View>
    </Card>
  );
};

// ---------------------------------------------------------------------- yêu cầu của tôi
export const TicketImage: React.FC<{ session: Session; id: number; name: string | null }> = ({ session, id, name }) => {
  const { c } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    let url: string | null = null;
    let alive = true;
    api.ticketImage(session.token, id).then((b) => { if (alive) { url = URL.createObjectURL(b); setUri(url); } }).catch(() => undefined);
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [session.token, id]);
  if (!uri) return <Txt size={13} color={c.muc3}>Ảnh đính kèm: {name ?? 'ảnh chụp màn hình'}{Platform.OS === 'web' ? ' (đang tải…)' : ' (xem trên bản web)'}</Txt>;
  return <Image source={{ uri }} accessibilityLabel={`Ảnh đính kèm ${name ?? ''}`} resizeMode="contain" style={{ width: '100%', height: 240, borderRadius: 10, backgroundColor: c.the2 }} />;
};

const TicketSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const t = useLoad(() => api.ticket(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [text, setText] = useState('');
  const d = t.data;
  const reply = async () => {
    const out = await run(() => api.replyTicket(session.token, id, text.trim()), 'Đã gửi trả lời');
    if (out) { setText(''); t.setData(out); onChanged(); }
  };
  return (
    <Sheet open onClose={onClose} title={d?.subject ?? 'Yêu cầu hỗ trợ'} subtitle={d ? `${TICKET_CATEGORY_TEXT[d.category] ?? d.category} · ${when(d.created_at)}` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={t.error} />
      {t.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Chip text={TICKET_STATUS_TEXT[d.status]} bg={d.status === 'done' ? c.ngocNhat : d.status === 'processing' ? c.thuyNhat : c.vangNhat} fg={d.status === 'done' ? c.ngocChu : d.status === 'processing' ? c.thuyChu : c.vangChu} /></View>
          <Txt size={15} style={{ lineHeight: 22 }} selectable>{d.body}</Txt>
          {d.has_attachment ? <TicketImage session={session} id={d.id} name={d.attachment_name} /> : null}
          {d.messages.map((m) => (
            <View key={m.id} style={{ alignSelf: m.author_role === 'root_admin' ? 'flex-start' : 'flex-end', maxWidth: '92%', padding: 10, borderRadius: 12, backgroundColor: m.author_role === 'root_admin' ? c.the2 : c.thuyNhat, gap: 2 }}>
              <Txt f="bold" size={12} color={c.muc3}>{m.author_role === 'root_admin' ? 'Quản trị viên' : 'Bạn'} · {when(m.created_at)}</Txt>
              <Txt size={14} selectable>{m.body}</Txt>
            </View>
          ))}
          <Field label="Trả lời thêm" value={text} onChangeText={setText} multiline numberOfLines={3} maxLength={3000} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} nativeID="ticket-reply" />
          <View style={{ flexDirection: 'row' }}><Btn icon={Send} title="Gửi trả lời" tone="ngoc" size="sm" disabled={!text.trim()} loading={busy} onPress={reply} testID="ticket-reply-send" /></View>
        </View>
      ) : null}
    </Sheet>
  );
};

const Mine: React.FC<{ session: Session; reloadKey: number }> = ({ session, reloadKey }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.myTickets(session.token), [session.token, reloadKey], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="happy" title="Bạn chưa gửi yêu cầu nào" text="Gặp lỗi hoặc có góp ý? Chọn “Gửi phản hồi”." /> : null}
      {list.data?.map((t: Ticket) => (
        <Pressable key={t.id} accessibilityRole="button" onPress={() => setOpen(t.id)} testID={`ticket-${t.id}`}>
          <Card flat pad={12} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip text={TICKET_STATUS_TEXT[t.status]} bg={t.status === 'done' ? c.ngocNhat : t.status === 'processing' ? c.thuyNhat : c.vangNhat} fg={t.status === 'done' ? c.ngocChu : t.status === 'processing' ? c.thuyChu : c.vangChu} />
              <Chip text={TICKET_CATEGORY_TEXT[t.category] ?? t.category} bg={c.the2} fg={c.muc2} />
              <Txt size={12} color={c.muc3}>{when(t.created_at)}</Txt>
              {t.replies ? <Txt size={12} color={c.thuyChu}>{t.replies} phản hồi</Txt> : null}
            </View>
            <Txt f="bold" size={15}>{t.subject}</Txt>
          </Card>
        </Pressable>
      ))}
      {open !== null ? <TicketSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={() => list.reload()} /> : null}
    </View>
  );
};

type Part = 'faq' | 'send' | 'mine';
export const HelpCenter: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<Part>('faq');
  const [key, setKey] = useState(0);
  return (
    <View style={{ gap: 14 }}>
      <Segmented<Part> label="Trợ giúp" value={part} onChange={setPart} options={[{ value: 'faq', label: 'Hướng dẫn' }, { value: 'send', label: 'Gửi phản hồi' }, { value: 'mine', label: 'Yêu cầu của tôi' }]} />
      {part === 'faq' ? <Faq session={session} /> : null}
      {part === 'send' ? <SendForm session={session} onSent={() => { setKey((k) => k + 1); setPart('mine'); }} /> : null}
      {part === 'mine' ? <Mine session={session} reloadKey={key} /> : null}
      {part === 'faq' ? <InfoNote><Txt size={13}>Không thấy câu trả lời? Chọn “Gửi phản hồi” để hỏi quản trị viên.</Txt></InfoNote> : null}
    </View>
  );
};

/** Trang Trợ giúp trong khung quản trị (giáo viên, quản trị trường) */
export const HelpPage: React.FC<{ session: Session }> = ({ session }) => (
  <Page>
    <PageHeader title="Trợ giúp" subtitle="Hướng dẫn sử dụng, câu hỏi thường gặp và gửi yêu cầu hỗ trợ tới quản trị viên" />
    <HelpCenter session={session} />
  </Page>
);

