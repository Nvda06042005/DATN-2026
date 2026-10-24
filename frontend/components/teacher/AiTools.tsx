/**
 * Công cụ AI cho giáo viên (dịch vụ AI Python: RAG trên kho tri thức + LLM):
 * soạn câu hỏi trắc nghiệm theo chủ đề / mức độ, soạn một màn truyện lịch sử có câu hỏi thử thách.
 * Kết quả sao chép hoặc chia sẻ được để đưa vào bài giảng.
 */
import React, { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Award, BookOpen, Check, ClipboardCopy, RefreshCw, Share2, Sparkles } from 'lucide-react-native';
import * as teacherApi from '@/api/teacherApi';
import { ApiError, errorMessage } from '@/api/client';
import { KahootShape, Mascot } from '@/components/art';
import { Btn, Card, Chip, EmptyState, Field, Inset, RichText, Segmented, Sheet, Txt, useToast } from '@/components/ui';
import { ANSWER_STYLES } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { stripOptionPrefix } from '@/lib/format';
import type { GeneratedQuizQuestion, GeneratedStory } from '@/types/api';

const LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng'];
const QUICK_TOPICS = [
  'Hội nghị Diên Hồng & tiếng hô “Đánh!” (1285)',
  'Kháng chiến lần 1 (1258): Vườn không nhà trống & Đông Bộ Đầu',
  'Trận phục kích thuyền lương Vân Đồn (1288)',
  'Đại thắng Bạch Đằng & trận địa cọc ngầm (1288)',
];

const shareText = async (title: string, text: string, toast: (m: string) => void) => {
  if (Platform.OS === 'web') {
    try {
      await Clipboard.setStringAsync(text);
      toast('Đã sao chép – dán vào giáo án hoặc Google Docs');
    } catch {
      toast('Không sao chép được');
    }
    return;
  }
  await Share.share({ title, message: text }).catch(() => undefined);
};

// ---------------------------------------------------------------------- soạn đề
export const AiQuizSheet: React.FC<{ open: boolean; onClose: () => void; token: string; onExpired: () => void }> = ({ open, onClose, token, onExpired }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [topic, setTopic] = useState(QUICK_TOPICS[0]);
  const [count, setCount] = useState(4);
  const [level, setLevel] = useState('Thông hiểu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const generate = async (t = topic) => {
    if (!t.trim()) return setError('Hãy nhập chủ đề.');
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.generateQuiz(token, t.trim(), count, level);
      if (!data.questions?.length) throw new Error('AI chưa soạn được câu hỏi cho chủ đề này – thử diễn đạt khác.');
      setQuestions(data.questions);
      setNote(data.generation_notes ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onExpired();
      else setError(errorMessage(err, 'Không gọi được dịch vụ AI.'));
    } finally {
      setLoading(false);
    }
  };

  const asText = () =>
    [`ĐỀ TRẮC NGHIỆM – ${topic} (${level})`, '']
      .concat(
        questions.flatMap((q, i) => [
          `Câu ${i + 1}: ${q.question}`,
          ...q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${stripOptionPrefix(o)}`),
          `   Đáp án: ${String.fromCharCode(65 + q.correct_index)}${q.explanation ? ` – ${q.explanation}` : ''}`,
          q.curriculum_reference ? `   Nguồn: ${q.curriculum_reference}` : '',
          '',
        ]),
      )
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="Trợ lý AI soạn câu hỏi"
      subtitle="Đối chiếu kho tri thức SGK Lịch sử 7 & Đại Việt sử ký toàn thư (RAG)"
      icon={<Mascot size={48} accessory="scholar" mood="excited" />}
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Đóng" tone="giay" onPress={onClose} />
          <Btn
            title={Platform.OS === 'web' ? 'Sao chép đề' : 'Chia sẻ đề'}
            icon={Platform.OS === 'web' ? ClipboardCopy : Share2}
            tone="ngoc"
            disabled={!questions.length}
            onPress={() => shareText('Đề trắc nghiệm Lịch sử 7', asText(), toast)}
          />
        </View>
      }
    >
      <Field label="Chủ đề sự kiện lịch sử" value={topic} onChangeText={setTopic} placeholder="Nhập sự kiện hoặc nhân vật lịch sử…" returnKeyType="go" onSubmitEditing={() => generate()} />
      <View style={{ gap: 6 }}>
        <Txt f="bold" size={14} color={c.muc2}>
          Gợi ý
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_TOPICS.map((t) => (
            <Btn
              key={t}
              title={t}
              tone="giay"
              size="sm"
              onPress={() => {
                setTopic(t);
                generate(t);
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={14} color={c.muc2}>
            Mức độ
          </Txt>
          <Segmented label="Mức độ nhận thức" options={LEVELS.map((l) => ({ value: l, label: l }))} value={level} onChange={setLevel} />
        </View>
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={14} color={c.muc2}>
            Số câu
          </Txt>
          <Segmented label="Số câu" options={[3, 4, 5].map((n) => ({ value: n, label: `${n} câu` }))} value={count} onChange={setCount} />
        </View>
      </View>
      <Btn title={loading ? 'Đang đối chiếu sử liệu…' : 'Soạn bằng AI'} icon={loading ? RefreshCw : Sparkles} tone="thong" loading={loading} onPress={() => generate()} />
      {error && (
        <Inset style={{ backgroundColor: c.dongNhat }}>
          <Txt f="bold" size={14} color={c.dongChu} accessibilityRole="alert">
            {error}
          </Txt>
        </Inset>
      )}
      {note && (
        <Txt size={13} color={c.muc2}>
          {note}
        </Txt>
      )}
      {questions.length === 0 && !loading ? (
        <EmptyState title="Chưa có câu hỏi" text="Chọn một chủ đề gợi ý hoặc nhập chủ đề rồi bấm “Soạn bằng AI”." />
      ) : (
        questions.map((q, i) => (
          <Card key={q.id ?? i} flat style={{ gap: 10 }}>
            <Txt f="bold">
              Câu {i + 1}: {q.question}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {q.cognitive_level && <Chip text={q.cognitive_level} icon={Award} bg={c.thongNhat} fg={c.thongChu} />}
              {q.curriculum_reference && <Chip text={q.curriculum_reference} icon={BookOpen} bg={c.ngocNhat} fg={c.ngocDam} />}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {q.options.map((opt, j) => {
                const s = ANSWER_STYLES[j % 4];
                const right = j === q.correct_index;
                return (
                  <View
                    key={j}
                    accessible
                    accessibilityLabel={`${stripOptionPrefix(opt)}${right ? ' (đáp án đúng)' : ''}`}
                    style={{
                      flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: s.bg,
                      opacity: right ? 1 : 0.7, borderWidth: right ? 3 : 0, borderColor: c.ngoc,
                    }}
                  >
                    <KahootShape shape={s.shape} size={14} color={s.fg} />
                    <Txt f="bold" size={14} color={s.fg} style={{ flex: 1 }}>
                      {stripOptionPrefix(opt)}
                    </Txt>
                    {right && <Check size={18} color={s.fg} strokeWidth={4} />}
                  </View>
                );
              })}
            </View>
            {q.explanation && (
              <Inset>
                <Txt size={14} color={c.muc2}>
                  <Txt f="bold" size={14}>
                    Căn cứ sử liệu:{' '}
                  </Txt>
                  {q.explanation}
                </Txt>
              </Inset>
            )}
          </Card>
        ))
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- soạn truyện
export const AiStorySheet: React.FC<{ open: boolean; onClose: () => void; token: string; onExpired: () => void }> = ({ open, onClose, token, onExpired }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [campaign, setCampaign] = useState('Kháng chiến chống Mông - Nguyên');
  const [stage, setStage] = useState('Hội nghị Diên Hồng');
  const [event, setEvent] = useState('Thượng hoàng hỏi kế sách, các bô lão đồng thanh hô vang “Đánh!”');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<GeneratedStory | null>(null);

  const generate = async () => {
    if (!stage.trim()) return setError('Hãy nhập tên màn / sự kiện.');
    setLoading(true);
    setError(null);
    try {
      setStory(await teacherApi.generateStory(token, campaign.trim(), stage.trim(), event.trim()));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onExpired();
      else setError(errorMessage(err, 'Không gọi được dịch vụ AI.'));
    } finally {
      setLoading(false);
    }
  };

  const asText = () =>
    story
      ? [`${story.stage_title ?? stage}`, '', story.story_narrative ?? '', '', `Tư liệu lịch sử: ${story.historical_fact ?? ''}`, '', `Thử thách: ${story.challenge_question ?? ''}`].join('\n')
      : '';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title="AI soạn truyện lịch sử"
      subtitle="Một màn truyện ngắn bám sát sử liệu, kèm câu hỏi thử thách cho học sinh"
      icon={<Mascot size={48} accessory="conical" mood="happy" />}
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Đóng" tone="giay" onPress={onClose} />
          <Btn
            title={Platform.OS === 'web' ? 'Sao chép truyện' : 'Chia sẻ truyện'}
            icon={Platform.OS === 'web' ? ClipboardCopy : Share2}
            tone="ngoc"
            disabled={!story}
            onPress={() => shareText('Truyện lịch sử', asText(), toast)}
          />
        </View>
      }
    >
      <Field label="Chiến dịch" value={campaign} onChangeText={setCampaign} />
      <Field label="Tên màn / sự kiện" value={stage} onChangeText={setStage} />
      <Field label="Sự kiện chính (tùy chọn)" value={event} onChangeText={setEvent} multiline inputStyle={{ minHeight: 72 }} textAlignVertical="top" />
      <Btn title={loading ? 'Đang soạn…' : 'Soạn truyện bằng AI'} icon={Sparkles} tone="thong" loading={loading} onPress={generate} />
      {error && (
        <Inset style={{ backgroundColor: c.dongNhat }}>
          <Txt f="bold" size={14} color={c.dongChu} accessibilityRole="alert">
            {error}
          </Txt>
        </Inset>
      )}
      {story && (
        <Card flat style={{ gap: 12 }}>
          <Txt f="displayHeavy" size={20}>
            {story.stage_title ?? stage}
          </Txt>
          {story.story_narrative ? <RichText text={story.story_narrative} /> : null}
          {story.historical_fact ? (
            <Inset style={{ backgroundColor: c.ngocNhat }}>
              <Txt f="bold" size={14} color={c.ngocDam}>
                Tư liệu lịch sử
              </Txt>
              <Txt f="serif" size={15} color={c.ngocDam}>
                {story.historical_fact}
              </Txt>
            </Inset>
          ) : null}
          {story.challenge_question ? (
            <Inset style={{ backgroundColor: c.dongNhat }}>
              <Txt f="bold" size={14} color={c.dongChu}>
                Thử thách sử học
              </Txt>
              <Txt size={15} color={c.dongChu}>
                {story.challenge_question}
              </Txt>
            </Inset>
          ) : null}
        </Card>
      )}
    </Sheet>
  );
};
