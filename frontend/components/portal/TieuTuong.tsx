/**
 * AI Tutor "Tiểu Tướng" & Hệ thống Trợ lý AI Sử học Đông A (Sprint 9, HK.HS.086–093; HK.GV.073):
 * Kết nối trực tiếp với Model NLP Đông A (81 chủ điểm chuyên sâu, Giải quyết đồng tham chiếu đa lượt,
 * Kiểm chứng Đồ thị Tri thức, Nhập vai danh tướng & Hồ sơ BKT).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { BookOpen, Flag, History as HistoryIcon, Plus, RotateCcw, Search, SendHorizontal, ShieldQuestion, Sparkles, SquarePen, Trash2 } from 'lucide-react-native';
import * as api from '@/api/aiApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { REFUSAL_TEXT, type AiConversation, type AiMessage, type AiReply, type Citation } from '@/types/ai';
import { BktAssessment } from '@/components/ai/BktAssessment';

export type OpenSource = (kind: string, id: number) => void;
const SAMPLES = [
  'Trần Hưng Đạo là ai?',
  'Trận Bạch Đằng diễn ra như thế nào?',
  'Hội nghị Diên Hồng là gì?',
  'Vì sao quân Trần chiến thắng quân Nguyên?',
  'Vì sao Trần Quốc Toản lại bóp nát quả cam?',
  'Tại sao Thoát Hoan phải chui vào ống đồng?',
];

/** Gợi ý câu hỏi: chữ dài xuống dòng trong khung thay vì tràn khỏi màn hình điện thoại */
const Suggest: React.FC<{ text: string; onPress: () => void }> = ({ text, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, justifyContent: 'center' })}>
      <Txt f="semibold" size={14} style={{ flexShrink: 1 }}>{text}</Txt>
    </Pressable>
  );
};

// ---------------------------------------------------------------------- hiển thị Markdown / Text định dạng (bóc tách ký tự **, *, ` thành chữ định dạng)
export const renderFormattedInline = (rawText: string, defaultColor?: string) => {
  if (!rawText) return null;
  const cleaned = rawText
    .replace(/\$P\(L_0\)\$/g, 'P(L₀)')
    .replace(/\$P\(L\)\$/g, 'P(L)');

  if (!cleaned.includes('*') && !cleaned.includes('`')) {
    return cleaned;
  }

  // **đậm**, *nghiêng* (cả khi nằm giữa câu, vd. *'Nên đánh hay nên hòa?'*) và `mã` (hiện đậm); trước đây dấu * của chữ nghiêng giữa câu bị lộ ra
  const parts = cleaned.split(/(\*\*[\s\S]+?\*\*|`[^`]+`|\*[^*\s](?:[^*]*?[^*\s])?\*)/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <Txt key={idx} f="bold" color={defaultColor}>{part.slice(2, -2).replace(/`/g, '').replace(/^\*([\s\S]+)\*$/, '$1')}</Txt>;
    }
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return <Txt key={idx} f="bold" color={defaultColor}>{part.slice(1, -1)}</Txt>;
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <Txt key={idx} color={defaultColor} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Txt>;
    }
    // dấu ** lẻ (không có cặp) thì bỏ, để không hiện ký tự thừa
    return <Txt key={idx} color={defaultColor}>{part.replace(/\*\*/g, '')}</Txt>;
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
    <View style={{ gap: 5 }}>
      {lines.map((rawLine, lIdx) => {
        const line = rawLine.trimEnd();

        if (!line.trim()) {
          return <View key={lIdx} style={{ height: 4 }} />;
        }

        if (line.trim() === '---') {
          return <View key={lIdx} style={{ height: 1, backgroundColor: c.vien, marginVertical: 6 }} />;
        }

        // Ordered list (1. 2. 3.)
        const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const body = numMatch[2];
          return (
            <View key={lIdx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 2 }}>
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
        const bulletMatch = line.match(/^\s*[-•*]\s+(.*)$/);
        if (bulletMatch) {
          const body = bulletMatch[1];
          return (
            <View key={lIdx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 1 }}>
              <Txt f="bold" size={size} color={c.dongChu} style={{ lineHeight }}>
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
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: 12, borderRadius: 16, borderBottomRightRadius: 4, backgroundColor: c.thuyNhat }}>
        <Txt size={15} style={{ lineHeight: 22 }}>{msg.content}</Txt>
      </View>
    );
  }
  const refused = Boolean(msg.refused);
  const speakerName = msg.character_name || 'Thầy — Trợ lý AI Sử học Đông A';
  const mastery = msg.student_mastery_summary;

  return (
    <View accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', maxWidth: '96%', gap: 8 }}>
      <View style={{ padding: 14, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 2, borderColor: refused ? c.dong : c.vien, backgroundColor: refused ? c.dongNhat : c.the, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Sparkles size={16} color={c.dongChu} />
          <Txt f="bold" size={13} color={c.dongChu}>{speakerName}</Txt>
          {refused && msg.refusal_reason ? <Chip text={REFUSAL_TEXT[msg.refusal_reason] ?? 'Ngoài phạm vi'} bg={c.dongNhat} fg={c.dongChu} /> : null}
          {!refused && msg.answer_mode === 'llm' ? <Chip text="SGK Lịch sử 7 • ĐVSKTT" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
          {msg.answer_mode === 'extractive' ? <Chip text="Trích nguyên văn tư liệu" bg={c.the2} fg={c.muc2} /> : null}
          {mastery ? (
            <Chip
              text={`Độ hiểu bài: ${Math.round(mastery.new_p_l * 100)}% (${mastery.mastery_status})`}
              bg={c.thuyNhat}
              fg={c.thuyChu}
            />
          ) : null}
        </View>
        <MarkdownText content={msg.content} size={15} lineHeight={23} />
        {msg.citations?.length ? (
          <View style={{ gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.vien }}>
            <Txt f="bold" size={12} color={c.muc3}>📚 Nguồn sử liệu đối chiếu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {msg.citations.map((ct: Citation) => ct.openable && onOpen
                ? <Btn key={`${ct.kind}${ct.id}`} icon={BookOpen} title={`[${ct.n}] ${ct.title}`} label={`Mở ${ct.kind_label}: ${ct.title}`} tone="thuy" size="sm" onPress={() => onOpen(ct.kind, ct.id)} />
                : <Chip key={`${ct.kind}${ct.id}`} text={`${ct.kind_label || ct.title}`} bg={c.the2} fg={c.muc2} />)}
            </View>
          </View>
        ) : null}
      </View>
      {msg.followups?.length && onAsk ? (
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={12} color={c.muc3}>{refused ? 'Em có thể hỏi' : '💡 Gợi ý câu hỏi tiếp theo'}</Txt>
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
interface ChatProps {
  session: Session;
  mode: 'tutor' | 'roleplay' | 'teacher';
  figure?: { id: number; name: string } | null;
  initial?: { id: number; messages: AiMessage[] } | null;
  initialQuestion?: string | null;
  onInitialQuestionConsumed?: () => void;
  onOpen?: OpenSource;
  onChanged?: () => void;
  samples?: string[];
  placeholder?: string;
  onScrollToEnd?: () => void;
  /** Báo id cuộc trò chuyện khi máy chủ tạo / tiếp tục cuộc (cột lịch sử tô đúng cuộc) */
  onConversation?: (id: number) => void;
}

export const ChatPanel: React.FC<ChatProps> = ({
  session,
  mode,
  figure,
  initial,
  initialQuestion,
  onInitialQuestionConsumed,
  onOpen,
  onChanged,
  samples = SAMPLES,
  placeholder = 'Nhập câu hỏi lịch sử thời Trần (VD: Vì sao Trần Quốc Toản bóp nát quả cam?)...',
  onScrollToEnd,
  onConversation,
}) => {
  const { c } = useTheme();
  const toast = useToast();
  const [conversation, setConversation] = useState<number | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<AiMessage[]>(initial?.messages ?? []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<AiMessage | null>(null);
  const consumedInitRef = useRef<string | null>(null);

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
      onConversation?.(res.conversation.id);
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), res.user_message, res.message]);
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) session.expired();
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setText(question);
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }, [busy, conversation, figure?.id, mode, onChanged, onConversation, onScrollToEnd, session]);

  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && consumedInitRef.current !== initialQuestion) {
      consumedInitRef.current = initialQuestion;
      onInitialQuestionConsumed?.();
      send(initialQuestion);
    }
  }, [initialQuestion, onInitialQuestionConsumed, send]);

  const handleResetChat = async () => {
    setMessages([]);
    setError(null);
    try {
      await api.aiResetSession(session.token, conversation ?? undefined);
    } catch {}
    setConversation(null);
    toast('Đã làm mới bộ nhớ hội thoại');
  };

  const last = messages[messages.length - 1];
  return (
    <View style={{ gap: 12 }}>
      {!messages.length ? (
        <Card flat pad={16} style={{ gap: 12 }}>
          <Txt f="bold" size={16}>
            {figure
              ? `Đang đàm đạo cùng ${figure.name}`
              : mode === 'teacher'
                ? 'Xin chào Thầy Cô! Tôi là Trợ lý AI Sử học Đông A'
                : 'Xin chào! Thầy là Trợ lý AI Sử học Đông A'}
          </Txt>
          <Txt size={14} color={c.muc2}>
            {figure
              ? 'Nhân vật hóa thân dựa trên chính sử Đại Việt Sử Ký Toàn Thư và SGK Lịch sử 7. Hãy đặt câu hỏi để đàm đạo cùng danh tướng!'
              : 'Hệ thống AI hiểu câu hỏi tự nhiên đa lượt (nhớ ngữ cảnh ông ấy, trận đó), tự động sửa lỗi chính tả và đối chiếu trực tiếp với SGK Lịch sử 7.'}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {samples.map((q) => <Suggest key={q} text={q} onPress={() => send(q)} />)}
          </View>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Btn icon={RotateCcw} title="Làm mới hội thoại" tone="giay" size="sm" disabled={busy} onPress={handleResetChat} />
        </View>
      )}
      <View style={{ gap: 12 }}>
        {messages.map((m) => <AiBubble key={m.id} msg={m} onOpen={onOpen} onAsk={m === last ? send : undefined} onReport={mode === 'roleplay' ? undefined : setReporting} />)}
        {busy ? <View style={{ alignSelf: 'flex-start' }}><Spinner label="Trợ lý AI Đông A đang phân tích & đối chiếu sử liệu…" /></View> : null}
      </View>
      <ErrorNote message={error} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label={mode === 'teacher' ? 'Nội dung tra cứu của thầy cô' : 'Câu hỏi của em'} value={text} onChangeText={setText} placeholder={placeholder} maxLength={500} multiline numberOfLines={2} inputStyle={{ minHeight: 56, textAlignVertical: 'top' }} editable={!busy}
            onSubmitEditing={() => send(text)} nativeID="ai-input" />
        </View>
        <Btn icon={SendHorizontal} label="Gửi câu hỏi" tone="ngoc" size="lg" disabled={busy || text.trim().length < 2} onPress={() => send(text)} testID="ai-send" />
      </View>
      <Txt size={12} color={c.muc3}>Mọi câu trả lời đều được đối chiếu trực tiếp với SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư.</Txt>
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

/**
 * Cột lịch sử trò chuyện bên trái như ChatGPT (16/11/2026): nút "Cuộc trò chuyện mới", các cuộc đã lưu nhóm theo ngày (Hôm nay, Hôm qua, ngày…),
 * cuộc đang mở được tô nổi, xóa từng cuộc. Dùng cho Tiểu Tướng (học sinh) và Tra cứu sử liệu (giáo viên).
 */
export const ConversationSidebar: React.FC<{ session: Session; activeId: number | null; reloadKey: number; onPick: (id: number) => void; onNew: () => void; filter?: (cv: AiConversation) => boolean }> = ({ session, activeId, reloadKey, onPick, onNew, filter }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.aiConversations(session.token), [session.token, reloadKey], session.expired);
  const { run } = useAction(session.expired);
  const [remove, setRemove] = useState<AiConversation | null>(null);
  const groups: Array<[string, AiConversation[]]> = [];
  for (const cv of (list.data ?? []).filter((x) => !filter || filter(x))) { const k = dayOf(cv.updated_at); const g = groups.find((x) => x[0] === k); if (g) g[1].push(cv); else groups.push([k, [cv]]); }
  return (
    <Card flat pad={10} style={{ gap: 8, borderRadius: 12, maxHeight: 680 }} testID="ai-sidebar">
      <Btn icon={SquarePen} title="Cuộc trò chuyện mới" tone="giay" size="sm" onPress={onNew} testID="ai-sidebar-new" />
      <Txt f="bold" size={12} color={c.muc3} style={{ paddingHorizontal: 6, marginTop: 4 }}>Gần đây</Txt>
      <ScrollView style={{ maxHeight: 600 }} contentContainerStyle={{ gap: 2, paddingBottom: 6 }}>
        <ErrorNote message={list.error} />
        {list.loading && !list.data ? <Spinner /> : null}
        {list.data && !groups.length ? <Txt size={13} color={c.muc3} style={{ paddingHorizontal: 6 }}>Chưa có cuộc trò chuyện nào.</Txt> : null}
        {groups.map(([day, items]) => (
          <View key={day} style={{ gap: 2, marginBottom: 6 }}>
            <Txt size={11} color={c.muc3} style={{ paddingHorizontal: 6, paddingTop: 4 }}>{day}</Txt>
            {items.map((cv) => {
              const on = cv.id === activeId;
              return (
                <View key={cv.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: on ? c.adminTint : 'transparent' }}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Mở cuộc trò chuyện: ${cv.title}`} onPress={() => onPick(cv.id)} testID={`ai-conv-${cv.id}`}
                    style={({ pressed }) => ({ flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed && !on ? c.adminCanvas : 'transparent' })}>
                    <Txt f={on ? 'bold' : 'semibold'} size={13} numberOfLines={1} color={on ? c.logoRed : c.muc}>{cv.title}</Txt>
                  </Pressable>
                  <Btn icon={Trash2} label={`Xóa cuộc trò chuyện ${cv.title}`} tone="ghost" size="sm" onPress={() => setRemove(cv)} />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <ConfirmSheet open={Boolean(remove)} title="Xóa cuộc trò chuyện này?" message="Cuộc trò chuyện sẽ biến mất khỏi lịch sử." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; const gone = remove.id; if (await run(() => api.aiDeleteConversation(session.token, gone).then(() => true), 'Đã xóa')) { setRemove(null); list.reload(); if (gone === activeId) onNew(); } }} />
    </Card>
  );
};

/** Danh tướng nhập vai (chuyển từ trang giáo viên sang học sinh 16/11/2026): danh hiệu và câu nói tiêu biểu để chọn nhân vật */
const FIGURE_INFO: Record<string, { role: string; quote: string }> = {
  'Trần Hưng Đạo': { role: 'Quốc Công Tiết Chế', quote: 'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!' },
  'Trần Quốc Toản': { role: 'Hoài Văn Hầu', quote: 'Phá cường địch, báo hoàng ân!' },
  'Trần Thủ Độ': { role: 'Thái Sư', quote: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!' },
  'Trần Bình Trọng': { role: 'Bảo Nghĩa Vương', quote: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!' },
  'Trần Nhân Tông': { role: 'Phật Hoàng Trúc Lâm', quote: 'Xã tắc hai phen chồn ngựa đá / Non sông nghìn thuở vững âu vàng.' },
  'Trần Khánh Dư': { role: 'Nhân Huệ Vương', quote: 'Đánh đắm đoàn thuyền lương Vân Đồn, bẻ gãy dạ dày giặc Nguyên!' },
  'Phạm Ngũ Lão': { role: 'Điện Súy', quote: 'Múa giáo non sông trải mấy thu / Ba quân khí mạnh nuốt trôi trâu.' },
  'Yết Kiêu': { role: 'Danh tướng thủy chiến', quote: 'Dưới làn nước sâu sông Bạch Đằng, một lòng đục thuyền giặc giữ non sông!' },
};

// ---------------------------------------------------------------------- tab Tiểu Tướng (Đã bỏ tab Tóm tắt theo Note 3)
export const TieuTuongTab: React.FC<{ session: Session; onOpen: OpenSource; onChanged?: () => void }> = ({ session, onOpen, onChanged }) => {
  const { c } = useTheme();
  const status = useLoad(() => api.aiStatus(session.token), [session.token], session.expired);
  const [part, setPart] = useState<'chat' | 'roleplay' | 'nang-luc'>('chat');
  // câu hỏi gửi từ mục Đánh giá năng lực ("Hỏi Tiểu Tướng" về một chủ điểm cần ôn) – 16/11/2026
  const [ask, setAsk] = useState<string | null>(null);
  const [fresh, setFresh] = useState(0);
  const [history, setHistory] = useState(false);
  const [initial, setInitial] = useState<{ id: number; messages: AiMessage[] } | null>(null);
  const [figure, setFigure] = useState<{ id: number; name: string } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [listKey, setListKey] = useState(0);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const st = status.data;
  const startNew = () => { setInitial(null); setFigure(null); setActiveId(null); setFresh((k) => k + 1); };
  const seen = (id: number) => { setActiveId(id); setListKey((k) => k + 1); };

  const openConversation = async (id: number) => {
    try {
      const cv = await api.aiConversation(session.token, id);
      setInitial({ id: cv.id, messages: cv.messages });
      setActiveId(cv.id);
      if (cv.mode === 'roleplay' && cv.figure_id) { setPart('roleplay'); setFigure({ id: cv.figure_id, name: cv.title.replace(/^Trò chuyện với /, '') }); } else setPart('chat');
      setFresh((k) => k + 1);
    } catch (e) { if (e instanceof ApiError && e.status === 401) session.expired(); }
  };
  const quota = st?.quota;
  const body = (
    <View style={{ gap: 14, flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ShieldQuestion size={28} color={c.dongChu} />
        <Txt f="displayHeavy" size={24} accessibilityRole="header" style={{ flex: 1 }}>Tiểu Tướng</Txt>
        {wide ? null : <Btn icon={HistoryIcon} title="Lịch sử" tone="giay" size="sm" onPress={() => setHistory(true)} testID="ai-history" />}
        {wide ? null : <Btn icon={Plus} title="Cuộc mới" tone="giay" size="sm" onPress={startNew} testID="ai-new" />}
      </View>
      <ErrorNote message={status.error} />
      {st ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip text={st.mode === 'llm' || st.mode === 'grounded' ? 'Trợ lý AI Sử học Đông A' : 'Chế độ tra cứu tư liệu'} bg={st.mode === 'llm' || st.mode === 'grounded' ? c.ngocNhat : c.the2} fg={st.mode === 'llm' || st.mode === 'grounded' ? c.ngocChu : c.muc2} />
          {quota && !quota.unlimited ? <Chip text={`Còn ${quota.remaining ?? 0} lượt hỏi hôm nay`} bg={(quota.remaining ?? 0) > 0 ? c.thuyNhat : c.sonNhat} fg={(quota.remaining ?? 0) > 0 ? c.thuyChu : c.sonChu} /> : null}
        </View>
      ) : null}
      {st && !st.ready ? <InfoNote><Txt size={14}>Kho tư liệu của Tiểu Tướng còn trống: quản trị viên cần công bố nội dung lịch sử và lập chỉ mục thì Tiểu Tướng mới trả lời được.</Txt></InfoNote> : null}
      <Segmented<'chat' | 'roleplay' | 'nang-luc'> label="Tiểu Tướng làm gì?" value={part} onChange={(v) => { setPart(v); setInitial(null); setFresh((k) => k + 1); }}
        options={[{ value: 'chat', label: 'Hỏi đáp' }, { value: 'roleplay', label: 'Nhập vai danh tướng' }, { value: 'nang-luc', label: 'Đánh giá năng lực' }]} />
      {part === 'chat' ? <ChatPanel key={`chat${fresh}`} session={session} mode="tutor" initial={initial} initialQuestion={ask} onInitialQuestionConsumed={() => setAsk(null)} onOpen={onOpen} onConversation={seen} onChanged={() => { status.reload(); onChanged?.(); }} /> : null}
      {part === 'nang-luc' ? <BktAssessment session={session} onAsk={(q) => { setInitial(null); setActiveId(null); setAsk(q); setPart('chat'); setFresh((k) => k + 1); }} /> : null}
      {part === 'roleplay' ? <RoleplayPart key={`rp${fresh}`} session={session} enabled={Boolean(st?.roleplay)} figure={figure} setFigure={setFigure} initial={initial} onOpen={onOpen} onConversation={seen} onChanged={() => status.reload()} /> : null}
      {history ? <HistorySheet session={session} onClose={() => setHistory(false)} onPick={openConversation} reloadKey={fresh} /> : null}
    </View>
  );
  if (!wide) return body;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <View style={{ width: 270 }}><ConversationSidebar session={session} activeId={activeId} reloadKey={listKey} onPick={(id) => { void openConversation(id); }} onNew={startNew} /></View>
      {body}
    </View>
  );
};

const RoleplayPart: React.FC<{ session: Session; enabled: boolean; figure: { id: number; name: string } | null; setFigure: (f: { id: number; name: string } | null) => void; initial: { id: number; messages: AiMessage[] } | null; onOpen: OpenSource; onChanged: () => void; onConversation?: (id: number) => void }> = ({ session, enabled, figure, setFigure, initial, onOpen, onChanged, onConversation }) => {
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
        <ChatPanel session={session} mode="roleplay" figure={figure} initial={initial} onOpen={onOpen} onChanged={onChanged} onConversation={onConversation} samples={['Ông là ai?', 'Ông nghĩ gì về giặc Nguyên?', 'Kế sách đánh giặc quan trọng nhất của nhà Trần là gì?']} placeholder={`Em muốn hỏi ${figure.name} điều gì?`} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Chọn một danh tướng thời Trần để trò chuyện. Nhân vật hóa thân dựa trên chính sử, chỉ nói điều có trong tư liệu đã kiểm chứng.</Txt>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Chưa có nhân vật nào" text="Nhân vật xuất hiện khi hồ sơ được công bố và lập chỉ mục." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(list.data ?? []).map((f) => {
          const info = FIGURE_INFO[f.name];
          return (
            <Pressable key={f.id} onPress={() => setFigure({ id: f.id, name: f.name })} accessibilityRole="button" accessibilityLabel={`Nhập vai ${f.name}${info ? `, ${info.role}` : ''}`} testID={`ai-figure-${f.id}`}
              style={({ pressed }) => ({ flexGrow: 1, flexBasis: 240, minHeight: 92, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the, gap: 6 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Search size={15} color={c.logoRed} />
                <Txt f="bold" size={15}>{f.name}</Txt>
                {info ? <Chip text={info.role} bg={c.dongNhat} fg={c.dongChu} /> : null}
              </View>
              {info ? <Txt size={12} color={c.muc3} style={{ fontStyle: 'italic' }}>“{info.quote}”</Txt> : null}
            </Pressable>
          );
        })}
      </View>
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
