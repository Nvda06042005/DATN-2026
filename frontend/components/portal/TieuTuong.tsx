/**
 * AI Tutor "Tiểu Tướng" (Sprint 9, HK.HS.086–093; HK.GV.073): khung hỏi đáp có trích dẫn nguồn mở được, gợi ý câu hỏi tiếp theo, báo cáo câu trả lời sai, nhập vai nhân vật,
 * tóm tắt bài học / trận đánh, lịch sử trò chuyện theo ngày (xóa từng cuộc), và tờ "Hỏi Tiểu Tướng" giải thích câu làm sai ở màn xem lại bài.
 * Máy chủ kiểm soát phạm vi, hạn mức và nội dung; giao diện chỉ hiển thị. Khi chưa nối mô hình AI, câu trả lời là trích nguyên văn tư liệu và được ghi chú rõ.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BookOpen, Flag, History as HistoryIcon, Plus, Search, SendHorizontal, ShieldQuestion, Sparkles, Trash2 } from 'lucide-react-native';
import * as api from '@/api/aiApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { REFUSAL_TEXT, type AiConversation, type AiMessage, type AiReply, type Citation } from '@/types/ai';

export type OpenSource = (kind: string, id: number) => void;
const SAMPLES = ['Trần Hưng Đạo là ai?', 'Trận Bạch Đằng diễn ra như thế nào?', 'Hội nghị Diên Hồng là gì?', 'Vì sao quân Trần chiến thắng quân Nguyên?'];

/** Gợi ý câu hỏi: chữ dài xuống dòng trong khung thay vì tràn khỏi màn hình điện thoại */
const Suggest: React.FC<{ text: string; onPress: () => void }> = ({ text, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, justifyContent: 'center' })}>
      <Txt f="semibold" size={14} style={{ flexShrink: 1 }}>{text}</Txt>
    </Pressable>
  );
};

// ---------------------------------------------------------------------- một tin nhắn
// ---------------------------------------------------------------------- hiển thị Markdown / Text định dạng (bóc tách ký tự ** thành chữ in đậm)
export const renderFormattedInline = (text: string, defaultColor?: string) => {
  if (!text) return null;
  if (!text.includes('**')) {
    return text;
  }

  const parts = text.split('**');
  const hasUnpaired = parts.length % 2 === 0;

  return parts.map((part, idx) => {
    if (!part) return null;
    const isBold = idx % 2 === 1 && (!hasUnpaired || idx < parts.length - 1);
    if (isBold) {
      return (
        <Txt key={idx} f="bold" color={defaultColor}>
          {part}
        </Txt>
      );
    }
    return (
      <Txt key={idx} color={defaultColor}>
        {part}
      </Txt>
    );
  });
};

export const MarkdownText: React.FC<{
  content: string;
  size?: number;
  lineHeight?: number;
  color?: string;
  selectable?: boolean;
}> = ({ content, size = 15, lineHeight = 23, color, selectable = true }) => {
  const { c } = useTheme();
  const textColor = color ?? c.muc;

  if (!content) return null;

  const lines = content.split('\n');

  return (
    <View style={{ gap: 4 }}>
      {lines.map((rawLine, lIdx) => {
        const line = rawLine.trimEnd();

        if (!line.trim()) {
          return <View key={lIdx} style={{ height: 4 }} />;
        }

        // Ordered list (1. 2. 3.)
        const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const body = numMatch[2];
          return (
            <View key={lIdx} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Txt f="bold" size={size} color={c.dongChu} style={{ lineHeight }}>
                {num}.
              </Txt>
              <Txt size={size} color={textColor} style={{ flex: 1, lineHeight }} selectable={selectable}>
                {renderFormattedInline(body, textColor)}
              </Txt>
            </View>
          );
        }

        // Bullet list (•, -, *)
        const bulletMatch = line.match(/^[-•*]\s+(.*)$/);
        if (bulletMatch) {
          const body = bulletMatch[1];
          return (
            <View key={lIdx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Txt size={size} color={c.dongChu} style={{ lineHeight }}>
                •
              </Txt>
              <Txt size={size} color={textColor} style={{ flex: 1, lineHeight }} selectable={selectable}>
                {renderFormattedInline(body, textColor)}
              </Txt>
            </View>
          );
        }

        // Heading (###, ##, #)
        const headingMatch = line.match(/^#{1,4}\s+(.*)$/);
        if (headingMatch) {
          return (
            <Txt key={lIdx} f="bold" size={size + 1} color={c.dongChu} style={{ lineHeight: lineHeight + 2, marginTop: 4 }} selectable={selectable}>
              {renderFormattedInline(headingMatch[1], c.dongChu)}
            </Txt>
          );
        }

        // Paragraph line
        return (
          <Txt key={lIdx} size={size} color={textColor} style={{ lineHeight }} selectable={selectable}>
            {renderFormattedInline(line, textColor)}
          </Txt>
        );
      })}
    </View>
  );
};

export const AiBubble: React.FC<{ msg: AiMessage; onOpen?: OpenSource; onAsk?: (q: string) => void; onReport?: (m: AiMessage) => void }> = ({ msg, onOpen, onAsk, onReport }) => {
  const { c } = useTheme();
  if (msg.role === 'user') {
    return <View style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: 12, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: c.thuyNhat }}><Txt size={15} style={{ lineHeight: 22 }}>{msg.content}</Txt></View>;
  }
  const refused = Boolean(msg.refused);
  return (
    <View accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', maxWidth: '96%', gap: 8 }}>
      <View style={{ padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 2, borderColor: refused ? c.dong : c.vien, backgroundColor: refused ? c.dongNhat : c.the, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Sparkles size={16} color={c.dongChu} />
          <Txt f="bold" size={13} color={c.dongChu}>Tiểu Tướng</Txt>
          {refused && msg.refusal_reason ? <Chip text={REFUSAL_TEXT[msg.refusal_reason] ?? 'Từ chối'} bg={c.dongNhat} fg={c.dongChu} /> : null}
          {msg.answer_mode === 'extractive' ? <Chip text="Trích nguyên văn tư liệu" bg={c.the2} fg={c.muc2} /> : null}
        </View>
        <MarkdownText content={msg.content} size={15} lineHeight={23} />
        {msg.citations?.length ? (
          <View style={{ gap: 6 }}>
            <Txt f="bold" size={12} color={c.muc3}>Nguồn tư liệu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {msg.citations.map((ct: Citation) => ct.openable && onOpen
                ? <Btn key={`${ct.kind}${ct.id}`} icon={BookOpen} title={`[${ct.n}] ${ct.title}`} label={`Mở ${ct.kind_label}: ${ct.title}`} tone="thuy" size="sm" onPress={() => onOpen(ct.kind, ct.id)} />
                : <Chip key={`${ct.kind}${ct.id}`} text={`[${ct.n}] ${ct.kind_label}: ${ct.title}`} bg={c.the2} fg={c.muc2} />)}
            </View>
          </View>
        ) : null}
      </View>
      {msg.followups?.length && onAsk ? (
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={12} color={c.muc3}>{refused ? 'Em có thể hỏi' : 'Hỏi tiếp'}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {msg.followups.map((q) => <Suggest key={q} text={q} onPress={() => onAsk(q)} />)}
          </View>
        </View>
      ) : null}
      {onReport && !refused ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Báo cáo câu trả lời chưa chính xác" disabled={msg.reported} onPress={() => onReport(msg)} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
          <Flag size={14} color={msg.reported ? c.ngocChu : c.muc3} />
          <Txt size={12} color={msg.reported ? c.ngocChu : c.muc3}>{msg.reported ? 'Đã báo cáo, cảm ơn em' : 'Câu trả lời chưa chính xác?'}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
};

export const ReportSheet: React.FC<{ session: Session; message: AiMessage; onClose: () => void; onDone: () => void }> = ({ session, message, onClose, onDone }) => {
  const { busy, run } = useAction(session.expired);
  const [reason, setReason] = useState('');
  const send = async () => { if (await run(() => api.aiReport(session.token, message.id, reason), 'Đã gửi báo cáo cho quản trị viên')) { onDone(); onClose(); } };
  return (
    <Sheet open onClose={onClose} title="Báo cáo câu trả lời" subtitle="Giúp thầy cô kiểm tra lại tư liệu"
      footer={<View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn title="Gửi báo cáo" tone="son" loading={busy} disabled={reason.trim().length < 3} onPress={send} testID="ai-report-send" /></View>}>
      <Field label="Câu trả lời sai ở đâu?" value={reason} onChangeText={setReason} placeholder="Ví dụ: sai năm diễn ra, thiếu tên người chỉ huy…" multiline numberOfLines={4} inputStyle={{ minHeight: 100, textAlignVertical: 'top' }} maxLength={500} nativeID="ai-report-reason" />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- khung trò chuyện
interface ChatProps { session: Session; mode: 'tutor' | 'roleplay' | 'teacher'; figure?: { id: number; name: string } | null; initial?: { id: number; messages: AiMessage[] } | null; onOpen?: OpenSource; onChanged?: () => void; samples?: string[]; placeholder?: string; onScrollToEnd?: () => void }

export const ChatPanel: React.FC<ChatProps> = ({ session, mode, figure, initial, onOpen, onChanged, samples = SAMPLES, placeholder = 'Em muốn hỏi gì về lịch sử thời Trần?', onScrollToEnd }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [conversation, setConversation] = useState<number | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<AiMessage[]>(initial?.messages ?? []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<AiMessage | null>(null);

  useEffect(() => {
    if (messages.length > 0 || busy) {
      const t = setTimeout(() => onScrollToEnd?.(), 80);
      return () => clearTimeout(t);
    }
  }, [messages.length, busy, onScrollToEnd]);

  const send = useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setError(null); setText('');
    const pending: AiMessage = { id: -Date.now(), role: 'user', content: question, created_at: new Date().toISOString() };
    setMessages((m) => [...m, pending]);
    setTimeout(() => onScrollToEnd?.(), 40);
    try {
      const res: AiReply = await api.aiAsk(session.token, { question, conversation_id: conversation ?? undefined, mode, figure_id: figure?.id });
      setConversation(res.conversation.id);
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), res.user_message, res.message]);
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) session.expired();
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setText(question);
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }, [busy, conversation, figure?.id, mode, onChanged, onScrollToEnd, session]);

  const last = messages[messages.length - 1];
  return (
    <View style={{ gap: 12 }}>
      {!messages.length ? (
        <Card flat pad={14} style={{ gap: 10 }}>
          <Txt f="bold" size={15}>{figure ? `Em đang trò chuyện với ${figure.name}` : 'Xin chào, Tiểu Tướng đây!'}</Txt>
          <Txt size={14} color={c.muc2}>{figure ? 'Nhân vật chỉ nói điều có trong tư liệu đã kiểm chứng. Em thử hỏi về cuộc đời, trận đánh hoặc suy nghĩ của ông nhé.' : 'Em hỏi bằng lời của mình về nhân vật, sự kiện, trận đánh thời Trần. Tiểu Tướng trả lời dựa trên tư liệu đã kiểm chứng và cho em xem nguồn.'}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{samples.map((q) => <Suggest key={q} text={q} onPress={() => send(q)} />)}</View>
        </Card>
      ) : null}
      <View style={{ gap: 12 }}>
        {messages.map((m) => <AiBubble key={m.id} msg={m} onOpen={onOpen} onAsk={m === last ? send : undefined} onReport={mode === 'roleplay' ? undefined : setReporting} />)}
        {busy ? <View style={{ alignSelf: 'flex-start' }}><Spinner label="Tiểu Tướng đang tìm tư liệu…" /></View> : null}
      </View>
      <ErrorNote message={error} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="Câu hỏi của em" value={text} onChangeText={setText} placeholder={placeholder} maxLength={500} multiline numberOfLines={2} inputStyle={{ minHeight: 56, textAlignVertical: 'top' }} editable={!busy}
            onSubmitEditing={() => send(text)} nativeID="ai-input" />
        </View>
        <Btn icon={SendHorizontal} label="Gửi câu hỏi" tone="ngoc" size="lg" disabled={busy || text.trim().length < 2} onPress={() => send(text)} testID="ai-send" />
      </View>
      <Txt size={12} color={c.muc3}>Tiểu Tướng có thể nhầm. Em hãy mở nguồn để đối chiếu và báo cáo nếu thấy sai.</Txt>
      {reporting ? <ReportSheet session={session} message={reporting} onClose={() => setReporting(null)} onDone={() => { setMessages((m) => m.map((x) => (x.id === reporting.id ? { ...x, reported: true } : x))); toast('Đã gửi báo cáo'); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- lịch sử trò chuyện (HK.HS.092)
const dayOf = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Hôm nay';
  const y = new Date(today); y.setDate(today.getDate() - 1);
  return same(d, y) ? 'Hôm qua' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const HistorySheet: React.FC<{ session: Session; onClose: () => void; onPick: (id: number) => void; reloadKey?: number }> = ({ session, onClose, onPick, reloadKey }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.aiConversations(session.token), [session.token, reloadKey], session.expired);
  const { run } = useAction(session.expired);
  const [remove, setRemove] = useState<AiConversation | null>(null);
  const groups: Array<[string, AiConversation[]]> = [];
  for (const cv of list.data ?? []) { const k = dayOf(cv.updated_at); const g = groups.find((x) => x[0] === k); if (g) g[1].push(cv); else groups.push([k, [cv]]); }
  return (
    <Sheet open onClose={onClose} title="Lịch sử trò chuyện" subtitle="Theo ngày; em có thể xóa từng cuộc" wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Chưa có cuộc trò chuyện nào" text="Hãy hỏi Tiểu Tướng một câu để bắt đầu." /> : null}
      {groups.map(([day, items]) => (
        <View key={day} style={{ gap: 6 }}>
          <Txt f="bold" size={13} color={c.muc3}>{day}</Txt>
          {items.map((cv) => (
            <View key={cv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Mở cuộc trò chuyện: ${cv.title}`} onPress={() => { onPick(cv.id); onClose(); }} style={({ pressed }) => ({ flex: 1, minHeight: 48, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 2 })}>
                <Txt f="semibold" size={14} numberOfLines={2}>{cv.title}</Txt>
                <Txt size={12} color={c.muc3}>{cv.questions ?? 0} câu hỏi</Txt>
              </Pressable>
              <Btn icon={Trash2} label={`Xóa cuộc trò chuyện ${cv.title}`} tone="giay" size="sm" onPress={() => setRemove(cv)} />
            </View>
          ))}
        </View>
      ))}
      <ConfirmSheet open={Boolean(remove)} title="Xóa cuộc trò chuyện này?" message="Cuộc trò chuyện sẽ biến mất khỏi danh sách của em." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.aiDeleteConversation(session.token, remove.id).then(() => true), 'Đã xóa')) { setRemove(null); list.reload(); } }} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- tab Tiểu Tướng
const SUMMARY_KINDS: Array<{ value: 'lessons' | 'battles' | 'events' | 'figures' | 'campaigns'; label: string; kind: string }> = [
  { value: 'lessons', label: 'Bài học', kind: 'lesson' }, { value: 'battles', label: 'Trận đánh', kind: 'battle' }, { value: 'events', label: 'Sự kiện', kind: 'event' },
  { value: 'figures', label: 'Nhân vật', kind: 'figure' }, { value: 'campaigns', label: 'Cuộc kháng chiến', kind: 'campaign' },
];

export const TieuTuongTab: React.FC<{ session: Session; onOpen: OpenSource; onChanged?: () => void }> = ({ session, onOpen, onChanged }) => {
  const { c } = useTheme();
  const status = useLoad(() => api.aiStatus(session.token), [session.token], session.expired);
  const [part, setPart] = useState<'chat' | 'roleplay' | 'summary'>('chat');
  const [fresh, setFresh] = useState(0);
  const [history, setHistory] = useState(false);
  const [initial, setInitial] = useState<{ id: number; messages: AiMessage[] } | null>(null);
  const [figure, setFigure] = useState<{ id: number; name: string } | null>(null);
  const st = status.data;

  const openConversation = async (id: number) => {
    try {
      const cv = await api.aiConversation(session.token, id);
      setInitial({ id: cv.id, messages: cv.messages });
      if (cv.mode === 'roleplay' && cv.figure_id) { setPart('roleplay'); setFigure({ id: cv.figure_id, name: cv.title.replace(/^Trò chuyện với /, '') }); } else setPart('chat');
      setFresh((k) => k + 1);
    } catch (e) { if (e instanceof ApiError && e.status === 401) session.expired(); }
  };
  const quota = st?.quota;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ShieldQuestion size={28} color={c.dongChu} />
        <Txt f="displayHeavy" size={24} accessibilityRole="header" style={{ flex: 1 }}>Tiểu Tướng</Txt>
        <Btn icon={HistoryIcon} title="Lịch sử" tone="giay" size="sm" onPress={() => setHistory(true)} testID="ai-history" />
        <Btn icon={Plus} title="Cuộc mới" tone="giay" size="sm" onPress={() => { setInitial(null); setFigure(null); setFresh((k) => k + 1); }} testID="ai-new" />
      </View>
      <ErrorNote message={status.error} />
      {st ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip text={st.mode === 'llm' ? 'Trợ lý AI' : 'Chế độ tra cứu tư liệu'} bg={st.mode === 'llm' ? c.ngocNhat : c.the2} fg={st.mode === 'llm' ? c.ngocChu : c.muc2} />
          {quota && !quota.unlimited ? <Chip text={`Còn ${quota.remaining ?? 0} lượt hỏi hôm nay`} bg={(quota.remaining ?? 0) > 0 ? c.thuyNhat : c.sonNhat} fg={(quota.remaining ?? 0) > 0 ? c.thuyChu : c.sonChu} /> : null}
        </View>
      ) : null}
      {st && !st.ready ? <InfoNote><Txt size={14}>Kho tư liệu của Tiểu Tướng còn trống: quản trị viên cần công bố nội dung lịch sử và lập chỉ mục thì Tiểu Tướng mới trả lời được.</Txt></InfoNote> : null}
      {st && st.mode === 'extractive' ? <Txt size={12} color={c.muc3}>Tiểu Tướng đang trích nguyên văn các đoạn tư liệu phù hợp (chưa nối mô hình AI viết lời giải thích).</Txt> : null}
      <Segmented<'chat' | 'roleplay' | 'summary'> label="Tiểu Tướng làm gì?" value={part} onChange={(v) => { setPart(v); setInitial(null); setFresh((k) => k + 1); }}
        options={[{ value: 'chat', label: 'Hỏi đáp' }, { value: 'roleplay', label: 'Nhập vai' }, { value: 'summary', label: 'Tóm tắt' }]} />
      {part === 'chat' ? <ChatPanel key={`chat${fresh}`} session={session} mode="tutor" initial={initial} onOpen={onOpen} onChanged={() => { status.reload(); onChanged?.(); }} /> : null}
      {part === 'roleplay' ? <RoleplayPart key={`rp${fresh}`} session={session} enabled={Boolean(st?.roleplay)} figure={figure} setFigure={setFigure} initial={initial} onOpen={onOpen} onChanged={() => status.reload()} /> : null}
      {part === 'summary' ? <SummaryPart key={`sm${fresh}`} session={session} onOpen={onOpen} onChanged={() => status.reload()} /> : null}
      {history ? <HistorySheet session={session} onClose={() => setHistory(false)} onPick={openConversation} reloadKey={fresh} /> : null}
    </View>
  );
};

const RoleplayPart: React.FC<{ session: Session; enabled: boolean; figure: { id: number; name: string } | null; setFigure: (f: { id: number; name: string } | null) => void; initial: { id: number; messages: AiMessage[] } | null; onOpen: OpenSource; onChanged: () => void }> = ({ session, enabled, figure, setFigure, initial, onOpen, onChanged }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.aiFigures(session.token), [session.token], session.expired);
  if (!enabled) return <InfoNote><Txt size={14}>Trò chuyện nhập vai cần bật mô hình AI. Em nhờ thầy cô hoặc quản trị viên cấu hình giúp nhé; trong lúc chờ, em vẫn dùng mục “Hỏi đáp” bình thường.</Txt></InfoNote>;
  if (figure) {
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip text={`Đang nhập vai: ${figure.name}`} bg={c.dongNhat} fg={c.dongChu} />
          <Btn title="Chọn nhân vật khác" tone="giay" size="sm" onPress={() => setFigure(null)} />
        </View>
        <ChatPanel session={session} mode="roleplay" figure={figure} initial={initial} onOpen={onOpen} onChanged={onChanged} samples={['Ông là ai?', 'Ông nghĩ gì về giặc Nguyên?', 'Ông đã làm gì để chuẩn bị đánh giặc?']} placeholder="Em muốn hỏi nhân vật điều gì?" />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Chọn một nhân vật để trò chuyện. Nhân vật chỉ nói điều có trong tư liệu đã kiểm chứng.</Txt>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Chưa có nhân vật nào" text="Nhân vật xuất hiện khi hồ sơ được công bố và lập chỉ mục." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(list.data ?? []).map((f) => <Btn key={f.id} icon={Search} title={f.name} tone="dong" size="sm" onPress={() => setFigure({ id: f.id, name: f.name })} testID={`ai-figure-${f.id}`} />)}
      </View>
    </View>
  );
};

const SummaryPart: React.FC<{ session: Session; onOpen: OpenSource; onChanged: () => void }> = ({ session, onOpen, onChanged }) => {
  const { c } = useTheme();
  const options = useLoad(() => api.aiSummaryOptions(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [kind, setKind] = useState<(typeof SUMMARY_KINDS)[number]['value']>('lessons');
  const [results, setResults] = useState<Array<{ title: string; message: AiMessage }>>([]);
  const def = SUMMARY_KINDS.find((k) => k.value === kind)!;
  const go = async (id: number, title: string) => {
    const res = await run(() => api.aiSummarize(session.token, def.kind, id));
    if (res) { setResults((r) => [{ title, message: res.message }, ...r]); onChanged(); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color={c.muc2}>Chọn một mục để Tiểu Tướng tóm tắt thành vài ý ngắn gọn, dễ nhớ.</Txt>
      <Segmented<typeof kind> label="Loại nội dung" value={kind} onChange={setKind} options={SUMMARY_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      <ErrorNote message={options.error} />
      {options.loading && !options.data ? <Spinner /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(options.data?.[kind] ?? []).map((o) => <Btn key={o.id} title={o.title} tone="giay" size="sm" disabled={busy} onPress={() => go(o.id, o.title)} />)}
      </View>
      {busy ? <Spinner label="Tiểu Tướng đang tóm tắt…" /> : null}
      {results.map((r, i) => (
        <View key={`${r.message.id}${i}`} style={{ gap: 6 }}>
          <Txt f="bold" size={15}>Tóm tắt: {r.title}</Txt>
          <AiBubble msg={r.message} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- "Hỏi Tiểu Tướng" ở màn xem lại bài (HK.HS.089)
export const ExplainSheet: React.FC<{ session: Session; attemptId: number; questionId: number; onClose: () => void; onOpen: OpenSource }> = ({ session, attemptId, questionId, onClose, onOpen }) => {
  const res = useLoad(() => api.aiExplain(session.token, attemptId, questionId), [session.token, attemptId, questionId], session.expired);
  return (
    <Sheet open onClose={onClose} title="Hỏi Tiểu Tướng" subtitle="Vì sao em chưa đúng?" wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} testID="explain-close" /></View>}>
      <ErrorNote message={res.error} />
      {res.loading && !res.data ? <Spinner label="Tiểu Tướng đang xem lại câu hỏi…" /> : null}
      {res.data ? <AiBubble msg={res.data.message} onOpen={(k, id) => { onClose(); onOpen(k, id); }} /> : null}
    </Sheet>
  );
};
