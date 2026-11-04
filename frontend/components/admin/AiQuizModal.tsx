/**
 * Modal Soạn đề trắc nghiệm bằng AI cho giáo viên (Sprint 9 + Hoàn thiện Khảo thí AI):
 * Cho phép giáo viên chọn 1 trong 5 nhóm chủ đề khảo thí chuẩn SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư,
 * lựa chọn phân bổ mức độ nhận thức Bloom (Nhận biết, Thông hiểu, Vận dụng, Phân bổ ma trận),
 * và số lượng câu hỏi để AI sinh bộ câu hỏi trắc nghiệm hoàn chỉnh kèm căn cứ sử liệu, lời giải thích.
 * Hỗ trợ chèn trực tiếp vào Quiz Studio (Kahoot-style) hoặc lưu vào Ngân hàng câu hỏi của giáo viên.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BookOpen, Check, CheckCircle2, Save, Sparkles } from 'lucide-react-native';
import * as aiApi from '@/api/aiApi';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, Field, InfoNote, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { GeneratedQuizQuestion, TopicGroupMeta } from '@/types/ai';

const DEFAULT_TOPIC_GROUPS: TopicGroupMeta[] = [
  {
    id: 'KHANG_CHIEN_1',
    title: 'Kháng chiến chống Mông Cổ lần thứ nhất (1258)',
    short_title: 'Kháng chiến lần 1 (1258)',
    badge: '1258 - Bình Lệ Nguyên & Đông Bộ Đầu',
    description: 'Âm mưu xâm lược của Mông Cổ, Trận Bình Lệ Nguyên, Kế sách Vườn không nhà trống tại Thăng Long, Thái sư Trần Thủ Độ và Đại thắng Đông Bộ Đầu.',
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 1, Tr. 66–67 & DVSKTT Quyển V',
    unit_ids: [],
  },
  {
    id: 'KHANG_CHIEN_2',
    title: 'Kháng chiến chống quân Nguyên lần thứ hai (1285)',
    short_title: 'Kháng chiến lần 2 (1285)',
    badge: '1285 - Bình Than, Diên Hồng & Hàm Tử',
    description: 'Hội nghị Bình Than, Trần Quốc Toản bóp nát quả cam, Hội nghị Diên Hồng (tiếng hô ĐÁNH), Hịch tướng sĩ & chữ Sát Thát, Trần Bình Trọng, Hàm Tử - Chương Dương.',
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 2, Tr. 68–71 & DVSKTT Quyển V',
    unit_ids: [],
  },
  {
    id: 'KHANG_CHIEN_3',
    title: 'Kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)',
    short_title: 'Kháng chiến lần 3 (1287 - 1288)',
    badge: '1287-1288 - Vân Đồn & Bạch Đằng',
    description: 'Hải chiến Vân Đồn (Trần Khánh Dư tiêu diệt đoàn thuyền lương Trương Văn Hổ), Đại thắng Bạch Đằng 1288 (bãi cọc ngầm, bắt Ô Mã Nhi).',
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 3, Tr. 71–73 & DVSKTT Quyển V',
    unit_ids: [],
  },
  {
    id: 'NHAN_VAT_QUAN_SU',
    title: 'Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự thời Trần',
    short_title: 'Nhân vật & Nghệ thuật Quân sự',
    badge: 'Hào khí Đông A & Bài học lịch sử',
    description: 'Phạm Ngũ Lão, Yết Kiêu - Dã Tượng, Phật Hoàng Trần Nhân Tông, Ngụ binh ư nông, Quân Thánh Dực, Vạn Kiếp - Thiên Trường, Bài học Khoan thư sức dân.',
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 14 & 15, Tr. 62–75 & DVSKTT Quyển VI',
    unit_ids: [],
  },
  {
    id: 'TONG_HOP_TOAN_KHOA',
    title: 'Tổng hợp Toàn khóa 3 lần Kháng chiến (1258 - 1288)',
    short_title: 'Đề Tổng hợp Toàn khóa',
    badge: 'Ma trận Bloom chuẩn GDPT 2018',
    description: 'Đề khảo thí tích hợp toàn diện bao quát 3 cuộc kháng chiến chống Mông - Nguyên và tư liệu gốc Đại Việt Sử Ký Toàn Thư, chuẩn phân bổ nhận thức.',
    sgk_reference: 'Toàn bộ Chương trình Lịch sử 7 & Đại Việt Sử Ký Toàn Thư',
    unit_ids: [],
  },
];

const BLOOM_LEVELS = [
  { value: 'Phân bổ ma trận', label: 'Ma trận chuẩn' },
  { value: 'Nhận biết', label: 'Nhận biết' },
  { value: 'Thông hiểu', label: 'Thông hiểu' },
  { value: 'Vận dụng', label: 'Vận dụng' },
];

const COUNT_OPTIONS = [
  { value: '4', label: '4 câu' },
  { value: '8', label: '8 câu' },
  { value: '10', label: '10 câu' },
  { value: '15', label: '15 câu' },
];

export interface AiQuizModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  initialTopicGroupId?: string;
  onInsertQuestions?: (questions: GeneratedQuizQuestion[]) => void;
}

export const AiQuizModal: React.FC<AiQuizModalProps> = ({
  open,
  onClose,
  session,
  initialTopicGroupId,
  onInsertQuestions,
}) => {
  const { c } = useTheme();
  const toast = useToast();

  const [topicGroups, setTopicGroups] = useState<TopicGroupMeta[]>(DEFAULT_TOPIC_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialTopicGroupId || 'TONG_HOP_TOAN_KHOA');
  const [cognitiveLevel, setCognitiveLevel] = useState<string>('Phân bổ ma trận');
  const [numQuestions, setNumQuestions] = useState<string>('8');
  const [customTopic, setCustomTopic] = useState<string>('');

  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [generationNote, setGenerationNote] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState<boolean>(false);

  // Tải danh sách nhóm chủ đề từ backend
  useEffect(() => {
    if (!open) return;
    let active = true;
    aiApi.aiTopicGroups(session.token)
      .then((res) => {
        if (active && res?.groups?.length) {
          setTopicGroups(res.groups);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [open, session.token]);

  const currentGroup = topicGroups.find((g) => g.id === selectedGroupId) || topicGroups[0];

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerationNote(null);
    try {
      const res = await aiApi.aiGenerateQuiz(session.token, {
        topic_group_id: selectedGroupId,
        topic: customTopic.trim() || currentGroup?.title,
        cognitive_level: cognitiveLevel,
        num_questions: Number(numQuestions) || 5,
      });

      if (res && res.questions && res.questions.length > 0) {
        setGeneratedQuestions(res.questions);
        setGenerationNote(res.generation_notes || `Đã sinh thành công ${res.questions.length} câu hỏi chuẩn.`);
        toast(`Đã sinh ${res.questions.length} câu hỏi thành công!`);
      } else {
        toast('Không thể sinh câu hỏi cho chủ đề này.');
      }
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveQuestion = async (q: GeneratedQuizQuestion) => {
    try {
      await learning.createQuestion(session.token, {
        qtype: 'single',
        prompt: q.question,
        explanation: `${q.explanation} [Trích dẫn: ${q.curriculum_reference}]`,
        difficulty: q.cognitive_level === 'Vận dụng' ? 3 : q.cognitive_level === 'Thông hiểu' ? 2 : 1,
        data: {
          options: q.options.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
          correct: String.fromCharCode(97 + q.correct_index),
        } as never,
      });
      setSavedIds((prev) => new Set([...prev, q.id]));
      toast('Đã lưu câu hỏi vào Ngân hàng!');
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const handleSaveAll = async () => {
    if (!generatedQuestions.length) return;
    setSavingAll(true);
    let successCount = 0;
    try {
      for (const q of generatedQuestions) {
        if (!savedIds.has(q.id)) {
          await learning.createQuestion(session.token, {
            qtype: 'single',
            prompt: q.question,
            explanation: `${q.explanation} [Trích dẫn: ${q.curriculum_reference}]`,
            difficulty: q.cognitive_level === 'Vận dụng' ? 3 : q.cognitive_level === 'Thông hiểu' ? 2 : 1,
            data: {
              options: q.options.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
              correct: String.fromCharCode(97 + q.correct_index),
            } as never,
          });
          setSavedIds((prev) => new Set([...prev, q.id]));
          successCount++;
        }
      }
      toast(`Đã lưu ${successCount} câu hỏi mới vào Ngân hàng!`);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setSavingAll(false);
    }
  };

  const handleInsertToStudio = () => {
    if (!generatedQuestions.length || !onInsertQuestions) return;
    onInsertQuestions(generatedQuestions);
    toast(`Đã chèn ${generatedQuestions.length} câu vào Quiz Studio!`);
    onClose();
  };

  const getBloomColors = (lvl: string): { bg: string; fg: string } => {
    if (lvl.includes('Nhận biết')) return { bg: c.thuyNhat, fg: c.thuyChu };
    if (lvl.includes('Thông hiểu')) return { bg: c.ngocNhat, fg: c.ngocChu };
    return { bg: c.vangNhat, fg: c.vangChu };
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Soạn đề trắc nghiệm bằng AI"
      wide
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {onInsertQuestions && generatedQuestions.length > 0 ? (
            <Btn
              icon={Sparkles}
              title={`Chèn ${generatedQuestions.length} câu vào Quiz`}
              tone="ngoc"
              onPress={handleInsertToStudio}
            />
          ) : null}
          {generatedQuestions.length > 0 ? (
            <Btn
              icon={Save}
              title={savingAll ? 'Đang lưu...' : 'Lưu tất cả vào ngân hàng'}
              tone="son"
              loading={savingAll}
              onPress={handleSaveAll}
            />
          ) : null}
          <Btn title="Đóng" tone="giay" onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: 16 }}>
        {/* Hướng dẫn ngắn */}
        <InfoNote>
          <Txt size={13}>Công cụ khảo thí thông minh: Tự động trích xuất sử liệu từ SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư để sinh câu hỏi trắc nghiệm 4 đáp án theo chuẩn ma trận nhận thức Bloom.</Txt>
        </InfoNote>

        {/* Cấu hình sinh đề */}
        <Card style={{ padding: 14, gap: 12, backgroundColor: c.the, borderColor: c.vien }}>
          <Txt f="bold" size={15} color={c.muc}>
            1. Chọn nhóm chủ đề khảo thí chuẩn
          </Txt>

          <AdminSelect
            label="Nhóm chủ đề"
            value={selectedGroupId}
            options={topicGroups.map((g) => ({
              value: g.id,
              label: `${g.short_title} - ${g.badge}`,
            }))}
            onChange={setSelectedGroupId}
          />

          {/* Chi tiết nhóm chủ đề được chọn */}
          {currentGroup ? (
            <View
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: c.giay2,
                borderLeftWidth: 4,
                borderLeftColor: c.son,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt f="bold" size={13} color={c.muc}>{currentGroup.title}</Txt>
                <Chip text={currentGroup.badge} bg={c.sonNhat} fg={c.sonChu} />
              </View>
              <Txt size={12} color={c.muc2} numberOfLines={3}>{currentGroup.description}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <BookOpen size={12} color={c.muc3} />
                <Txt size={11} color={c.muc3}>Căn cứ: {currentGroup.sgk_reference}</Txt>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, minWidth: 200, gap: 6 }}>
              <Txt f="medium" size={13} color={c.muc2}>Mức độ nhận thức (Bloom):</Txt>
              <Segmented
                label="Mức độ nhận thức"
                value={cognitiveLevel}
                options={BLOOM_LEVELS}
                onChange={setCognitiveLevel}
              />
            </View>

            <View style={{ width: 140, gap: 6 }}>
              <Txt f="medium" size={13} color={c.muc2}>Số lượng câu:</Txt>
              <Segmented
                label="Số lượng câu"
                value={numQuestions}
                options={COUNT_OPTIONS}
                onChange={setNumQuestions}
              />
            </View>
          </View>

          <Field
            label="Yêu cầu trọng tâm bổ sung (tùy chọn)"
            value={customTopic}
            onChangeText={setCustomTopic}
            placeholder="Ví dụ: Tập trung vào chiến thuật dùng cọc ngầm của Trần Quốc Tuấn..."
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn
              icon={Sparkles}
              title={generating ? 'AI đang sinh câu hỏi...' : 'Bắt đầu soạn bằng AI'}
              tone="son"
              loading={generating}
              onPress={handleGenerate}
            />
          </View>
        </Card>

        {/* Kết quả sinh câu hỏi */}
        {generating ? (
          <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <Spinner />
            <Txt size={14} color={c.muc2}>
              Đang đối chiếu sử liệu SGK 7 và Đại Việt Sử Ký Toàn Thư để tạo đề...
            </Txt>
          </View>
        ) : null}

        {generationNote && !generating ? (
          <View
            style={{
              padding: 10,
              borderRadius: 8,
              backgroundColor: c.ngocNhat,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} color={c.ngoc} />
            <Txt size={13} color={c.ngoc} style={{ flex: 1 }}>{generationNote}</Txt>
          </View>
        ) : null}

        {generatedQuestions.length > 0 && !generating ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="bold" size={15} color={c.muc}>
                Danh sách {generatedQuestions.length} câu hỏi đã sinh:
              </Txt>
              <Txt size={12} color={c.muc3}>
                Đã lưu {savedIds.size}/{generatedQuestions.length} câu
              </Txt>
            </View>

            {generatedQuestions.map((q, idx) => {
              const isSaved = savedIds.has(q.id);
              const bloomColor = getBloomColors(q.cognitive_level);
              return (
                <Card
                  key={q.id || idx}
                  style={{
                    padding: 14,
                    gap: 10,
                    backgroundColor: c.the,
                    borderColor: isSaved ? c.ngoc : c.vien,
                    borderWidth: isSaved ? 1.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                      <Chip text={`Câu ${idx + 1}`} bg={c.giay2} fg={c.muc} />
                      <Chip text={q.cognitive_level} bg={bloomColor.bg} fg={bloomColor.fg} />
                      {q.curriculum_reference ? (
                        <Txt size={11} color={c.muc3} numberOfLines={1}>
                          {q.curriculum_reference}
                        </Txt>
                      ) : null}
                    </View>

                    <Btn
                      icon={isSaved ? Check : Save}
                      title={isSaved ? 'Đã lưu' : 'Lưu câu này'}
                      tone={isSaved ? 'ngoc' : 'giay'}
                      size="sm"
                      disabled={isSaved}
                      onPress={() => handleSaveQuestion(q)}
                    />
                  </View>

                  <Txt f="bold" size={14} color={c.muc}>
                    {q.question}
                  </Txt>

                  {/* 4 Đáp án */}
                  <View style={{ gap: 6 }}>
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correct_index;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <View
                          key={optIdx}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 6,
                            backgroundColor: isCorrect ? c.ngocNhat : c.giay2,
                            borderWidth: 1,
                            borderColor: isCorrect ? c.ngoc : c.vien,
                          }}
                        >
                          <Txt f="bold" size={13} color={isCorrect ? c.ngoc : c.muc2}>
                            {letter}.
                          </Txt>
                          <Txt size={13} color={isCorrect ? c.ngoc : c.muc} style={{ flex: 1 }}>
                            {opt}
                          </Txt>
                          {isCorrect ? <Check size={14} color={c.ngoc} /> : null}
                        </View>
                      );
                    })}
                  </View>

                  {/* Lời giải & Căn cứ sử liệu */}
                  {q.explanation ? (
                    <View style={{ padding: 8, borderRadius: 6, backgroundColor: c.giay2, gap: 2 }}>
                      <Txt size={12} color={c.muc2}>
                        <Txt f="bold" size={12} color={c.muc}>Giải thích: </Txt>
                        {q.explanation}
                      </Txt>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
};
