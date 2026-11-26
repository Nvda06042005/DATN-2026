/**
 * Hỏi Tiểu Tướng (bản vẽ màn 12, "Binh thư Sát Thát" 25/11/2026): khung hỏi đáp với trợ lý AI Sử học, câu trả lời kèm nguồn sử liệu (chạm để mở tư liệu),
 * câu hỏi gợi ý / hỏi tiếp dạng nút, nói thay gõ (trình duyệt có nhận dạng giọng nói tiếng Việt), báo câu trả lời chưa chính xác.
 * Nút "Trung tâm AI" mở các công cụ AI sẵn có của học sinh (Lộ trình cá nhân hóa, Flash Cards, Chẩn đoán BKT – StudentAiHub).
 * Thẻ Binh thư / màn học gọi `askTieuTuong(câu hỏi)` rồi chuyển sang mục này: câu hỏi được gửi ngay khi màn mở.
 * Hội thoại đang dở được nhớ theo phiên đăng nhập để chuyển mục rồi quay lại vẫn còn. Máy chủ đếm lượt hỏi cho nhiệm vụ "Hỏi Tiểu Tướng".
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { BookOpen, ChevronLeft, Flag, Mic, MicOff, RotateCcw, SendHorizontal, Sparkles } from 'lucide-react-native';
import * as ai from '@/api/aiApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { StudentAiHub } from '@/components/ai/StudentAiHub';
import { useLoad, type SagaNav } from '@/components/portal/SagaKit';
import { MarkdownText, ReportSheet } from '@/components/portal/TieuTuong';
import { BtButton, BtCard, BtPage, Columns, Eyebrow, Pill, SerifTitle, TtMark, TtSays, useBT } from '@/components/portal/StudentDesign';
import { Txt, useToast } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { REFUSAL_TEXT, type AiMessage, type AiStatus } from '@/types/ai';

/** Câu hỏi chờ gửi khi mở mục Tiểu Tướng (đặt từ thẻ Binh thư, Doanh trại…) */
let pendingAsk: string | null = null;
export function askTieuTuong(question: string): void { pendingAsk = question.trim() || null; }

/** Hội thoại đang dở theo phiên đăng nhập (chỉ trong bộ nhớ của thẻ trình duyệt) */
const CHAT = new Map<string, { conversation: number | null; messages: AiMessage[] }>();
const SAMPLES = [
  'Vì sao quân Trần cắm cọc trên sông Bạch Đằng?',
  'Hội nghị Diên Hồng bàn chuyện gì?',
  'Kế “vườn không nhà trống” là gì?',
  'Ngô Quyền đánh quân Nam Hán năm 938 thế nào?',
  'Trần Quốc Toản là ai?',
];

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const speechCtor = (): (new () => Recognition) | null => {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
};

/** Một tin nhắn: em (bên phải, màu nhấn) hoặc Tiểu Tướng (bên trái, có nguồn và câu hỏi tiếp) */
const Bubble: React.FC<{ msg: AiMessage; onOpen: (kind: string, id: number) => void; onAsk: (q: string) => void; onReport: (m: AiMessage) => void; busy: boolean }> = ({ msg, onOpen, onAsk, onReport, busy }) => {
  const t = useBT();
  if (msg.role === 'user') {
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: t.accent, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 13, paddingVertical: 10 }}>
        <Txt size={15} color={t.onAccent} style={{ lineHeight: 22 }}>{msg.content}</Txt>
      </View>
    );
  }
  const refused = Boolean(msg.refused);
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '96%', flexDirection: 'row', gap: 8 }} accessibilityLiveRegion="polite">
      <TtMark size={32} />
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ backgroundColor: refused ? t.goldSoft : t.card, borderWidth: 1, borderColor: refused ? t.line2 : t.line, borderRadius: 16, borderTopLeftRadius: 4, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Txt f="heavy" size={12.5} color={t.teal}>{msg.character_name || 'Tiểu Tướng'}</Txt>
            {refused && msg.refusal_reason ? <Pill text={REFUSAL_TEXT[msg.refusal_reason] ?? 'Ngoài phạm vi'} bg={t.card2} fg={t.muted} /> : null}
            {msg.answer_mode === 'extractive' ? <Pill text="Trích nguyên văn tư liệu" /> : null}
          </View>
          <MarkdownText content={msg.content} size={15} lineHeight={23} color={t.ink} />
          {msg.citations?.length ? (
            <View style={{ gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: t.line }}>
              <Eyebrow text="Nguồn sử liệu" color={t.muted} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {msg.citations.map((ct) => (ct.openable ? (
                  <Pressable key={`${ct.kind}${ct.id}`} onPress={() => onOpen(ct.kind, ct.id)} accessibilityRole="button" accessibilityLabel={`Mở ${ct.kind_label}: ${ct.title}`}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.tealSoft, opacity: pressed ? 0.8 : 1 })}>
                    <BookOpen size={13} color={t.teal} /><Txt f="heavy" size={12} color={t.teal} numberOfLines={1}>[{ct.n}] {ct.title}</Txt>
                  </Pressable>
                ) : <Pill key={`${ct.kind}${ct.id}`} text={`[${ct.n}] ${ct.title}`} />))}
              </View>
            </View>
          ) : null}
        </View>
        {msg.followups?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {msg.followups.map((q) => (
              <Pressable key={q} onPress={() => onAsk(q)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Hỏi tiếp: ${q}`}
                style={({ pressed }) => ({ minHeight: 40, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: t.line2, backgroundColor: pressed ? t.card2 : t.card, justifyContent: 'center' })}>
                <Txt f="semibold" size={13} color={t.ink} style={{ flexShrink: 1 }}>{q}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!refused && msg.id > 0 ? (
          <Pressable onPress={() => onReport(msg)} disabled={msg.reported} accessibilityRole="button" accessibilityLabel="Báo câu trả lời chưa chính xác"
            style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
            <Flag size={13} color={msg.reported ? t.green : t.muted} />
            <Txt size={12} color={msg.reported ? t.green : t.muted}>{msg.reported ? 'Đã báo, cảm ơn em' : 'Câu trả lời chưa chính xác?'}</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

/** Hỏi Tiểu Tướng: hỏi đáp kèm nguồn; nút sang Trung tâm AI */
export const AskScreen: React.FC<{ session: Session; nav: SagaNav; onOpen: (kind: string, id: number) => void }> = ({ session, nav, onOpen }) => {
  const t = useBT();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const status = useLoad<AiStatus>(session, (tk) => ai.aiStatus(tk), []);
  const saved = CHAT.get(session.token);
  const [conversation, setConversation] = useState<number | null>(saved?.conversation ?? null);
  const [messages, setMessages] = useState<AiMessage[]>(saved?.messages ?? []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [hub, setHub] = useState(false);
  const [report, setReport] = useState<AiMessage | null>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const scroller = useRef<ScrollViewInstance | null>(null);
  const Speech = speechCtor();
  useEffect(() => { CHAT.set(session.token, { conversation, messages }); }, [session.token, conversation, messages]);
  useEffect(() => {
    if (!messages.length) return undefined;
    const tm = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(tm);
  }, [messages.length, busy]);
  useEffect(() => () => rec.current?.stop(), []);
  const send = useCallback(async (raw: string): Promise<void> => {
    const question = raw.trim();
    if (!question || busy) return;
    setBusy(true);
    setText('');
    const temp: AiMessage = { id: -Date.now(), role: 'user', content: question, created_at: new Date().toISOString() };
    setMessages((list) => [...list, temp]);
    try {
      const res = await ai.aiAsk(session.token, { question, conversation_id: conversation ?? undefined, mode: 'tutor' });
      setConversation(res.conversation.id);
      setMessages((list) => [...list.filter((m) => m.id !== temp.id), res.user_message, res.message]);
      status.reload();
      nav.refresh();
    } catch (e) {
      if ((e as { status?: number }).status === 401) session.expired();
      setMessages((list) => list.filter((m) => m.id !== temp.id));
      setText(question);
      toast(errorMessage(e, 'Tiểu Tướng chưa trả lời được. Thử lại sau ít phút.'));
    } finally { setBusy(false); }
  }, [busy, conversation, nav, session, status, toast]);
  // câu hỏi đặt từ màn khác (thẻ Binh thư…): gửi ngay khi mở
  useEffect(() => {
    const q = pendingAsk;
    if (!q) return;
    pendingAsk = null;
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mic = (): void => {
    if (!Speech) return;
    if (listening) { rec.current?.stop(); return; }
    try {
      const r = new Speech();
      r.lang = 'vi-VN'; r.interimResults = true; r.continuous = false;
      r.onresult = (e) => { const parts = Array.from(e.results).map((x) => x[0]?.transcript ?? ''); setText(parts.join(' ').trim()); };
      r.onend = () => setListening(false);
      r.onerror = () => { setListening(false); toast('Chưa nghe được, em thử nói lại hoặc gõ câu hỏi nhé.'); };
      rec.current = r;
      r.start();
      setListening(true);
    } catch { setListening(false); }
  };
  const reset = (): void => {
    if (conversation) ai.aiResetSession(session.token, conversation).catch(() => undefined);
    setConversation(null); setMessages([]); setText('');
  };
  const quota = status.data?.quota;
  if (hub) {
    return (
      <BtPage testID="saga-ai-hub" max={1180}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BtButton icon={ChevronLeft} tone="ghost" size="sm" label="Quay lại hỏi đáp" onPress={() => setHub(false)} testID="ai-hub-back" />
          <View style={{ flex: 1 }}><Eyebrow text="Tiểu Tướng" /><SerifTitle size={20}>Trung tâm AI</SerifTitle></View>
        </View>
        <StudentAiHub session={session} onOpen={onOpen} onPractice={() => nav.go('luyen-binh')} onLearn={() => nav.go('chien-dich')} />
      </BtPage>
    );
  }
  const chat = (
    <BtCard pad={12} testID="ask-chat" style={{ gap: 12, minHeight: 320 }}>
      {!messages.length ? (
        <View style={{ gap: 10 }} testID="ask-empty">
          <TtSays>
            <Txt f="heavy" size={13} color={t.teal}>Tiểu Tướng</Txt>
            <Txt size={14} color={t.ink} style={{ lineHeight: 21 }}>Chào em! Ta là Tiểu Tướng. Hỏi ta về các trận đánh, nhân vật, kế sách thời Trần và trận Bạch Đằng năm 938 – ta trả lời kèm nguồn sử liệu.</Txt>
          </TtSays>
          <Eyebrow text="Em có thể hỏi" color={t.muted} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SAMPLES.map((q) => (
              <Pressable key={q} onPress={() => { void send(q); }} disabled={busy} accessibilityRole="button" testID={`ask-sample-${SAMPLES.indexOf(q)}`}
                style={({ pressed }) => ({ minHeight: 40, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: t.line2, backgroundColor: pressed ? t.card2 : t.card, justifyContent: 'center' })}>
                <Txt f="semibold" size={13.5} color={t.ink} style={{ flexShrink: 1 }}>{q}</Txt>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }} testID="ask-messages">
          {messages.map((m) => <Bubble key={m.id} msg={m} onOpen={onOpen} onAsk={(q) => { void send(q); }} onReport={setReport} busy={busy} />)}
          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
              <TtMark size={32} /><Txt size={13.5} color={t.muted}>Tiểu Tướng đang lật sử sách…</Txt>
            </View>
          ) : null}
        </View>
      )}
    </BtCard>
  );
  const input = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }} testID="ask-input-row">
      <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: t.line2, backgroundColor: t.card, paddingHorizontal: 12, justifyContent: 'center' }}>
        <TextInput value={text} onChangeText={setText} placeholder={listening ? 'Đang nghe em nói…' : 'Hỏi Tiểu Tướng một câu…'} placeholderTextColor={t.muted} multiline maxLength={500}
          accessibilityLabel="Câu hỏi cho Tiểu Tướng" testID="ask-input" onSubmitEditing={() => { void send(text); }} blurOnSubmit
          style={{ color: t.ink, fontSize: 15, fontFamily: FONT.medium, paddingVertical: 12, maxHeight: 120, outlineStyle: 'none' } as object} />
      </View>
      {Speech ? <BtButton icon={listening ? MicOff : Mic} tone={listening ? 'accent' : 'ghost'} label={listening ? 'Dừng nghe' : 'Nói câu hỏi'} onPress={mic} testID="ask-mic" /> : null}
      <BtButton icon={SendHorizontal} label="Gửi câu hỏi" onPress={() => { void send(text); }} disabled={!text.trim()} loading={busy} testID="ask-send" />
    </View>
  );
  return (
    <BtPage testID="saga-ask" max={1180}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TtMark size={46} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Eyebrow text="Tiểu Tướng · trợ lý AI Sử học" />
          <SerifTitle size={width < 400 ? 21 : 24}>Hỏi Tiểu Tướng</SerifTitle>
          {quota && !quota.unlimited && quota.remaining !== null && width < 640 ? <View style={{ alignSelf: 'flex-start' }}><Pill text={`Còn ${quota.remaining} lượt hôm nay`} bg={t.goldSoft} fg={t.goldInk} strong testID="ask-quota" /></View> : null}
        </View>
        {quota && !quota.unlimited && quota.remaining !== null && width >= 640 ? <Pill text={`Còn ${quota.remaining} lượt hôm nay`} bg={t.goldSoft} fg={t.goldInk} strong testID="ask-quota" /> : null}
      </View>
      <Columns split={1.7} left={<>{chat}{input}</>} right={(
        <>
          <BtCard tone="night" testID="ask-hub-card">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Sparkles size={18} color={t.gold} /><Txt f="heavy" size={15} color={t.onNight}>Trung tâm AI</Txt></View>
            <Txt size={13} color={t.onNightMuted} style={{ lineHeight: 19 }}>Lộ trình học riêng cho em, thẻ ghi nhớ (Flash Cards) và đánh giá năng lực theo từng chủ đề.</Txt>
            <BtButton title="Mở Trung tâm AI" tone="gold" size="sm" onPress={() => setHub(true)} testID="ask-open-hub" />
          </BtCard>
          {messages.length ? <BtButton title="Cuộc hỏi đáp mới" icon={RotateCcw} tone="ghost" onPress={reset} testID="ask-reset" /> : null}
          <TtSays tone="light"><Txt size={12.5} color={t.soft} style={{ lineHeight: 18 }}>Tiểu Tướng chỉ trả lời trong phạm vi Lịch sử Việt Nam thời Ngô – Trần và luôn ghi nguồn. Câu trả lời có thể chưa đúng hết: hãy đối chiếu với nguồn và báo lại nếu thấy sai.</Txt></TtSays>
        </>
      )} />
      {report ? <ReportSheet session={session} message={report} onClose={() => setReport(null)} onDone={() => { setMessages((list) => list.map((m) => (m.id === report.id ? { ...m, reported: true } : m))); setReport(null); }} /> : null}
    </BtPage>
  );
};
