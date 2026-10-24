/**
 * Sử Ký: dòng thời gian 1258 – 1288 trên lược đồ, thẻ tri thức (mở bằng một câu trả lời đúng) và Quân Sư AI –
 * chatbot trả lời dựa trên kho tri thức Lịch sử 7 (truy xuất RAG + LLM), có trích nguồn.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { Clock, Lock, MapPin, MessageSquare, ScrollText, Send, Target } from 'lucide-react-native';
import * as studentApi from '@/api/studentApi';
import { Mascot, SchematicMap } from '@/components/art';
import { LoreChip, QuizPanel } from '@/components/game/quiz';
import { Btn, Card, Chip, EmptyState, PressCard, RichText, SectionTitle, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { CATEGORY_LABEL, CATEGORY_ORDER, MAP_PLACES, TIMELINE } from '@/constants/game';
import { FONT } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { shortName } from '@/lib/format';
import type { CodexEntry } from '@/types/api';
import type { PlaceId } from '@/types/game';

export const CodexTab: React.FC<{ sub: string; onSub: (s: string) => void; pendingQuestion: string | null; onConsumed: () => void }> = ({ sub, onSub, pendingQuestion, onConsumed }) => {
  const { codex, state, update, dark, bumpDaily } = useGame();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<CodexEntry | null>(null);
  const [place, setPlace] = useState<PlaceId | null>(null);
  const byUnit = useMemo(() => Object.fromEntries(codex.map((e) => [e.unit_id, e])), [codex]);
  const unlockedSet = new Set(state.codex);
  const unlockedCount = codex.filter((e) => unlockedSet.has(e.unit_id)).length;

  const openEntry = (e: CodexEntry) => {
    setOpen(e);
    if (unlockedSet.has(e.unit_id)) bumpDaily('codex');
  };

  return (
    <View style={{ gap: 14 }}>
      <SectionTitle title="Sử Ký" subtitle="Bách khoa thu nhỏ về ba lần kháng chiến – nội dung khớp kho tri thức của Quân Sư" />
      <Segmented
        label="Sử Ký"
        options={[
          { value: 'timeline', label: 'Dòng thời gian' },
          { value: 'cards', label: `Thẻ Sử Ký (${unlockedCount}/${codex.length})` },
          { value: 'advisor', label: 'Quân Sư AI' },
        ]}
        value={sub}
        onChange={onSub}
      />

      {sub === 'advisor' ? (
        <AdvisorChat pending={pendingQuestion} onConsumed={onConsumed} />
      ) : sub === 'cards' ? (
        <View style={{ gap: 16 }}>
          {CATEGORY_ORDER.map((cat) => {
            const list = codex.filter((e) => e.category === cat);
            if (!list.length) return null;
            return (
              <View key={cat} style={{ gap: 8 }}>
                <Txt f="displayHeavy" size={18}>
                  {CATEGORY_LABEL[cat]}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {list.map((e) => {
                    const unlocked = unlockedSet.has(e.unit_id);
                    return (
                      <PressCard key={e.unit_id} onPress={() => openEntry(e)} label={`${e.topic}${unlocked ? '' : ', đang khóa'}`} pad={12} style={{ flexGrow: 1, flexBasis: 260, flexDirection: 'row', gap: 10, opacity: unlocked ? 1 : 0.8 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: unlocked ? c.dong : c.giay2 }}>
                          {unlocked ? <ScrollText size={24} color="#1c1917" /> : <Lock size={20} color={c.muc3} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt f="display" size={15}>
                            {e.topic}
                          </Txt>
                          <Txt size={12} color={c.muc2}>
                            {unlocked ? e.event : 'Trả lời 1 câu về chủ đề này để mở thẻ'}
                          </Txt>
                        </View>
                      </PressCard>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {!codex.length && <EmptyState mood="sad" title="Chưa tải được Sử Ký" text="Kiểm tra kết nối với máy chủ rồi mở lại nhé." />}
        </View>
      ) : (
        <View style={{ flexDirection: width >= 1024 ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
          <Card pad={0} style={{ flex: 9, width: '100%', overflow: 'hidden' }}>
            <SchematicMap dark={dark} pins={TIMELINE.flatMap((t) => (t.place ? [t.place] : []))} highlight={place} title="Lược đồ các địa danh trong dòng thời gian" />
          </Card>
          <View style={{ flex: 11, width: '100%', borderLeftWidth: 4, borderLeftColor: c.vien, marginLeft: 12, gap: 12 }}>
            {TIMELINE.map((t, i) => {
              const entries = t.units.map((u) => byUnit[u]).filter(Boolean) as CodexEntry[];
              return (
                <View key={i} style={{ paddingLeft: 18 }}>
                  <View style={{ position: 'absolute', left: -12, top: 14, width: 20, height: 20, borderRadius: 10, backgroundColor: c.son, borderWidth: 4, borderColor: c.giay }} />
                  <Pressable onPress={() => setPlace(t.place ?? null)} accessible={false}>
                    <Card pad={12} style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color={c.dongChu} />
                        <Txt f="bold" size={12} color={c.dongChu}>
                          {t.date}
                        </Txt>
                        {t.place && (
                          <>
                            <MapPin size={14} color={c.muc2} />
                            <Txt f="semibold" size={12} color={c.muc2}>
                              {MAP_PLACES[t.place].name}
                            </Txt>
                          </>
                        )}
                      </View>
                      <Txt f="displayHeavy" size={16}>
                        {t.title}
                      </Txt>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {entries.map((e) => {
                          const unlocked = unlockedSet.has(e.unit_id);
                          return (
                            <Pressable
                              key={e.unit_id}
                              onPress={() => {
                                setPlace(t.place ?? null);
                                openEntry(e);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`${e.topic}${unlocked ? '' : ', đang khóa'}`}
                              style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: unlocked ? c.dong : c.vien, backgroundColor: unlocked ? c.dongNhat : c.giay2, maxWidth: '100%' }}
                            >
                              {unlocked ? <ScrollText size={14} color={c.dongChu} /> : <Lock size={14} color={c.muc2} />}
                              <Txt f="bold" size={13} color={unlocked ? c.dongChu : c.muc2} style={{ flexShrink: 1 }}>
                                {e.topic}
                              </Txt>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Card>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <CodexSheet
        entry={open}
        unlocked={!!open && unlockedSet.has(open.unit_id)}
        onClose={() => setOpen(null)}
        onUnlocked={(unit) => {
          update((s) => ({ ...s, codex: [...new Set([...s.codex, unit])] }));
          bumpDaily('codex');
        }}
      />
    </View>
  );
};

const CodexSheet: React.FC<{ entry: CodexEntry | null; unlocked: boolean; onClose: () => void; onUnlocked: (unit: string) => void }> = ({ entry, unlocked, onClose, onUnlocked }) => {
  const { askAdvisor } = useGame();
  const { c } = useTheme();
  const [quiz, setQuiz] = useState(false);
  useEffect(() => setQuiz(false), [entry?.unit_id]);
  if (!entry) return null;
  return (
    <Sheet
      open
      onClose={quiz ? () => setQuiz(false) : onClose}
      wide
      title={quiz ? (unlocked ? 'Ôn chủ đề' : 'Mở thẻ Sử Ký') : entry.topic}
      subtitle={quiz ? entry.topic : entry.event}
      icon={
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.dong, alignItems: 'center', justifyContent: 'center' }}>
          <ScrollText size={24} color="#1c1917" />
        </View>
      }
    >
      {quiz ? (
        <QuizPanel
          request={{ units: [entry.unit_id], count: unlocked ? 3 : 1 }}
          passMark={1}
          sessionKind={unlocked ? 'practice' : null}
          finishLabel={unlocked ? 'Hoàn thành' : 'Đọc thẻ'}
          onClose={() => setQuiz(false)}
          onFinish={(sum) => {
            if (!unlocked && sum.correct > 0) onUnlocked(entry.unit_id);
          }}
        />
      ) : unlocked ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <LoreChip lore={entry.label} />
            {entry.badge && <Chip text={entry.badge} bg={c.dongNhat} fg={c.dongChu} />}
            <Chip text={CATEGORY_LABEL[entry.category] ?? entry.category} bg={c.giay2} fg={c.muc2} />
          </View>
          <View style={{ borderLeftWidth: 4, borderLeftColor: c.dong, backgroundColor: c.the, borderRadius: 16, padding: 16 }}>
            <Txt f="serif" size={17}>
              {entry.fact_chunk}
            </Txt>
          </View>
          {entry.answer ? <RichText text={entry.answer} color={c.muc} /> : null}
          {entry.entity ? (
            <Txt size={14} color={c.muc2}>
              Nhân vật: {entry.entity}
            </Txt>
          ) : null}
          {entry.source ? (
            <Txt f="semibold" size={12} color={c.muc2}>
              Nguồn: {entry.source}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn title="Hỏi Quân Sư" icon={MessageSquare} tone="ngoc" onPress={() => askAdvisor(`Quân Sư kể thêm về ${entry.topic} cho em nhé`)} />
            <Btn title="Ôn 3 câu" icon={Target} tone="giay" onPress={() => setQuiz(true)} />
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
          <Mascot size={96} mood="thinking" accessory="scholar" />
          <Txt f="semibold">Thẻ Sử Ký này đang khóa.</Txt>
          <Txt size={14} color={c.muc2} center>
            Trả lời đúng 1 câu về “{entry.topic}” để mở thẻ và đọc tư liệu.
          </Txt>
          <Btn title="Mở thẻ" icon={Lock} onPress={() => setQuiz(true)} />
        </View>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- Quân Sư AI
interface AdvisorMessage {
  id: number;
  from: 'me' | 'advisor';
  text: string;
  source?: string | null;
}

const ADVISOR_QUICK = ['Vì sao gọi là “vườn không nhà trống”?', 'Trận Bạch Đằng 1288 diễn ra thế nào?', 'Trần Khánh Dư đã làm gì ở Vân Đồn?', 'Nguyên nhân thắng lợi của ba lần kháng chiến?'];

const AdvisorChat: React.FC<{ pending: string | null; onConsumed: () => void }> = ({ pending, onConsumed }) => {
  const { user, request, bumpDaily } = useGame();
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const [messages, setMessages] = useState<AdvisorMessage[]>(() => [
    { id: 0, from: 'advisor', text: `Chào ${shortName(user.full_name)}! Ta là Quân Sư của Đông A. Em muốn hỏi gì về ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)?` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const idRef = useRef(1);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      setMessages((m) => [...m, { id: idRef.current++, from: 'me', text: q }]);
      setInput('');
      setLoading(true);
      bumpDaily('ask');
      request(studentApi.countAiQuestion).catch(() => undefined);
      try {
        const data = await request((t) => studentApi.askAdvisor(t, q, `student_${user.id}`, 'advisor'));
        const src = data.grounding_sources?.[0];
        setMessages((m) => [...m, { id: idRef.current++, from: 'advisor', text: data.answer, source: src?.curriculum_match ?? src?.doc_name ?? null }]);
      } catch {
        setMessages((m) => [...m, { id: idRef.current++, from: 'advisor', text: 'Quân Sư đang bận một chút. Em đọc thẻ Sử Ký liên quan hoặc thử hỏi lại sau ít phút nhé.' }]);
      } finally {
        setLoading(false);
      }
    },
    [request, user.id, bumpDaily],
  );

  useEffect(() => {
    if (pending) {
      send(pending);
      onConsumed();
    }
  }, [pending, send, onConsumed]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
      <Card pad={0} style={{ height: Math.min(height * 0.7, 640), overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: c.vien }}>
          <Mascot size={44} mood="happy" accessory="scholar" />
          <View>
            <Txt f="displayHeavy" size={16}>
              Quân Sư Đông A
            </Txt>
            <Txt size={12} color={c.muc2}>
              Trả lời dựa trên kho tri thức Lịch sử 7 (RAG)
            </Txt>
          </View>
        </View>
        <ScrollView ref={listRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
          <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
            {messages.map((m) => (
              <View key={m.id} style={{ alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: m.from === 'me' ? c.son : c.the,
                    borderWidth: m.from === 'me' ? 0 : 2, borderColor: c.vien, borderBottomRightRadius: m.from === 'me' ? 6 : 18, borderBottomLeftRadius: m.from === 'me' ? 18 : 6,
                  }}
                >
                  {m.from === 'me' ? <Txt color="#ffffff">{m.text}</Txt> : <RichText text={m.text} color={c.muc} />}
                  {m.source && (
                    <Txt f="semibold" size={12} color={c.muc2} style={{ marginTop: 4 }}>
                      Nguồn: {m.source}
                    </Txt>
                  )}
                </View>
              </View>
            ))}
            {loading && <Spinner label="Quân Sư đang suy nghĩ…" />}
          </View>
        </ScrollView>
        <View style={{ borderTopWidth: 2, borderTopColor: c.vien, padding: 12, gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {ADVISOR_QUICK.map((q) => (
              <Btn key={q} title={q} tone="giay" size="sm" disabled={loading} onPress={() => send(q)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              nativeID="advisor-input"
              value={input}
              onChangeText={setInput}
              placeholder="Hỏi Quân Sư về lịch sử…"
              placeholderTextColor={c.muc3}
              maxLength={300}
              accessibilityLabel="Câu hỏi cho Quân Sư"
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              style={{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the2, paddingHorizontal: 14, fontFamily: FONT.semibold, fontSize: 16, color: c.muc }}
            />
            <Btn tone="ngoc" icon={Send} label="Gửi câu hỏi" loading={loading} disabled={!input.trim()} onPress={() => send(input)} />
          </View>
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
};
