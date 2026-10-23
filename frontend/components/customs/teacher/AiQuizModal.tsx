import { useState } from 'react';
import { AlertCircle, Award, BookOpen, Check, RefreshCw, X } from 'lucide-react';
import * as quizApi from '@/api/quizApi';
import { KahootShape } from '@/components/customs/KahootShape';
import { Mascot } from '@/components/customs/Mascot';
import { ANSWER_STYLES } from '@/constants/theme';
import { stripOptionPrefix } from '@/utils/format';

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuestions: (count: number) => void;
}

interface QuestionItem {
  id: string | number;
  q: string;
  options: string[];
  correct: number;
  citation: string;
  cognitiveLevel?: string;
  explanation?: string;
}

export const AiQuizModal = ({
  isOpen,
  onClose,
  onSaveQuestions,
}: AiQuizModalProps) => {
  const [topic, setTopic] = useState('Chương 2: 1285 - Hội nghị Bình Than vs Diên Hồng');
  const [count, setCount] = useState(3);
  const [cognitiveLevel, setCognitiveLevel] = useState('Thông hiểu');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionItem[]>([
    {
      id: 'init-1',
      q: 'Hội nghị Bình Than (1282) do ai chủ trì và đối tượng tham gia là ai?',
      options: [
        'A. Vua Trần Nhân Tông - Vương hầu, quý tộc, tướng lĩnh',
        'B. Thượng hoàng Trần Thánh Tông - Bô lão cả nước',
        'C. Trần Quốc Toản - Đội quân gia nô 1.000 người',
        'D. Trần Thủ Độ - Quan lại triều Lý cũ'
      ],
      correct: 0,
      cognitiveLevel: 'Nhận biết',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 68',
      explanation: 'Tháng 10 năm 1282, vua Trần Nhân Tông mở hội nghị Bình Than (Hải Dương) triệu tập các vương hầu và quan lại cao cấp để bàn kế sách đánh giặc.'
    },
    {
      id: 'init-2',
      q: 'Tại Hội nghị Diên Hồng (đầu 1285), khi Thượng hoàng hỏi "Nên đánh hay nên hòa?", các bô lão đã đồng thanh hô vang điều gì?',
      options: [
        'A. Hòa!',
        'B. Đánh!',
        'C. Rút lui về Vạn Kiếp!',
        'D. Cầu viện phương Bắc!'
      ],
      correct: 1,
      cognitiveLevel: 'Thông hiểu',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 69',
      explanation: 'Hội nghị Diên Hồng triệu tập các bô lão đại diện cho toàn dân. Tiếng hô ĐÁNH đồng thanh thể hiện khối đại đoàn kết dân tộc triều Trần.'
    },
    {
      id: 'init-3',
      q: 'Hành động bóp nát quả cam vua ban của Hoài Văn hầu Trần Quốc Toản thể hiện điều gì?',
      options: [
        'A. Nỗi giận dữ vì quả cam bị hỏng',
        'B. Uất ức vì chưa đủ tuổi dự bàn việc quân, nung nấu ý chí giết giặc',
        'C. Muốn thách đấu với các tướng già',
        'D. Không đồng ý với kế sách rút lui'
      ],
      correct: 1,
      cognitiveLevel: 'Vận dụng',
      citation: 'Đại Việt Sử Ký Toàn Thư (tr. 560)',
      explanation: 'Trần Quốc Toản vì chưa đủ tuổi dự hội nghị Bình Than nên vừa hờn vừa tủi, vô tình bóp nát quả cam, rồi về chiêu mộ gia nô thêu cờ 6 chữ vàng.'
    }
  ]);

  if (!isOpen) return null;

  const quickTopics = [
    'Hội nghị Diên Hồng & Tiếng hô ĐÁNH (1285)',
    'Kháng chiến lần 1 (1258): Vườn không nhà trống & Đông Bộ Đầu',
    'Trận phục kích thuyền lương Vân Đồn (1288)',
    'Đại thắng Bạch Đằng Giang & Bãi cọc lim (1288)'
  ];

  const handleGenerate = async (targetTopic = topic, targetCount = count, targetLevel = cognitiveLevel) => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const data = await quizApi.generateQuiz(targetTopic, targetCount, targetLevel);
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const mapped: QuestionItem[] = data.questions.map((q: any, idx: number) => ({
          id: q.id || `gen-${idx + 1}`,
          q: q.question,
          options: q.options,
          correct: q.correct_index,
          cognitiveLevel: q.cognitive_level || targetLevel,
          citation: q.curriculum_reference || 'SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư',
          explanation: q.explanation || 'Căn cứ theo tư liệu lịch sử chính thống triều Trần.'
        }));
        setGeneratedQuestions(mapped);
      } else {
        throw new Error('Dữ liệu câu hỏi trả về rỗng');
      }
    } catch (err) {
      console.warn('Lỗi gọi API AI Quiz, chuyển sang bộ câu hỏi dự phòng cục bộ:', err);
      // Fallback xáo trộn hoặc giữ danh sách chuẩn
      setErrorMessage('Không thể kết nối Backend AI, đang hiển thị câu hỏi mẫu từ Dữ liệu vàng.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 animate-in" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-duo-purple text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center shrink-0">
              <Mascot size={52} accessory="scholar" mood="excited" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg">Trợ lý AI soạn câu hỏi</h3>
                <span className="chip bg-white text-duo-purple-dark">
                  RAG Grounded
                </span>
              </div>
              <p className="text-xs font-bold text-white/85">
                Đối chiếu 105 bản ghi Sử liệu vàng SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition"
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-5 border-b-2 border-duo-swan space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs font-black text-duo-wolf block mb-1.5">
                Chủ đề sự kiện lịch sử:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nhập sự kiện hoặc nhân vật lịch sử..."
                className="input-duo"
              />
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className="text-xs font-black text-duo-wolf block mb-1.5">Mức độ:</label>
                <select
                  value={cognitiveLevel}
                  onChange={(e) => setCognitiveLevel(e.target.value)}
                  className="input-duo !w-auto !py-2.5"
                >
                  <option value="Nhận biết">Nhận biết</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-duo-wolf block mb-1.5">Số câu:</label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="input-duo !w-auto !py-2.5"
                >
                  <option value={3}>3 câu</option>
                  <option value={4}>4 câu</option>
                  <option value={5}>5 câu</option>
                </select>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  className="btn-3d btn-purple"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Đang tạo...' : 'Tạo AI'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick topic pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-1">
            <span className="text-duo-hare font-semibold shrink-0 text-[10px]">Gợi ý:</span>
            {quickTopics.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTopic(t);
                  handleGenerate(t, count, cognitiveLevel);
                }}
                className="px-3 py-1.5 bg-white hover:bg-duo-purple-light hover:text-duo-purple-dark hover:border-duo-purple border-2 border-duo-swan rounded-xl whitespace-nowrap text-duo-wolf font-bold transition shrink-0"
              >
                {t}
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-duo-gold-dark bg-duo-gold-light px-3 py-2 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Questions Preview List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-black text-duo-hare uppercase tracking-widest text-[11px]">
              Danh sách {generatedQuestions.length} câu hỏi AI tạo lập (Khảo thí Lịch sử 7):
            </p>
            {isGenerating && (
              <span className="text-duo-purple-dark font-black text-xs flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang đối chiếu sử liệu...
              </span>
            )}
          </div>

          {generatedQuestions.map((item, idx) => (
            <div key={item.id} className="card-duo p-4 space-y-3 transition hover:border-duo-purple">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-black text-sm text-duo-ink leading-snug">
                  Câu {idx + 1}: {item.q}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.cognitiveLevel && (
                    <span className="chip bg-duo-purple-light text-duo-purple-dark">
                      <Award className="w-3 h-3" />
                      {item.cognitiveLevel}
                    </span>
                  )}
                  <span className="chip bg-duo-green-light text-duo-green-dark">
                    <BookOpen className="w-3 h-3" />
                    {item.citation}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {item.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 ${
                      oIdx === item.correct ? 'ring-4 ring-duo-green ring-offset-1' : 'opacity-70'
                    }`}
                    style={{ background: ANSWER_STYLES[oIdx % 4].bg, color: ANSWER_STYLES[oIdx % 4].fg }}
                  >
                    <KahootShape shape={ANSWER_STYLES[oIdx % 4].shape} size={14} color={ANSWER_STYLES[oIdx % 4].fg} />
                    <span className="flex-1">{stripOptionPrefix(opt)}</span>
                    {oIdx === item.correct && <Check className="w-4 h-4 stroke-[4]" />}
                  </div>
                ))}
              </div>

              {item.explanation && (
                <div className="text-xs font-semibold bg-duo-polar rounded-xl p-3 text-duo-wolf leading-relaxed">
                  <strong className="text-duo-ink">Căn cứ sử liệu:</strong> {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-white border-t-2 border-duo-swan flex items-center justify-between gap-2">
          <span className="text-xs text-duo-wolf font-bold hidden sm:inline">
            Tổng cộng: <strong>{generatedQuestions.length} câu hỏi</strong> chuẩn kiến thức kỹ năng
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-3d btn-ghost"
            >
              Đóng
            </button>
            <button
              onClick={() => onSaveQuestions(generatedQuestions.length)}
              className="btn-3d btn-green"
            >
              <Check className="w-4 h-4" />
              <span>Thêm {generatedQuestions.length} câu vào bài</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
