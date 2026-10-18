import { useState } from 'react';
import { X, Sparkles, Check, BookOpen, RefreshCw, AlertCircle, Award } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

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
      const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetTopic,
          num_questions: targetCount,
          cognitive_level: targetLevel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Máy chủ AI phản hồi lỗi: ${response.status}`);
      }

      const data = await response.json();
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Trợ lý AI Soạn Câu Hỏi - Đông A Studio</h3>
                <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  RAG Grounded
                </span>
              </div>
              <p className="text-[11px] text-indigo-200">
                Đối chiếu 105 bản ghi Sử liệu vàng SGK Lịch sử 7 & Đại Việt Sử Ký Toàn Thư
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[260px]">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Chủ đề sự kiện lịch sử:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nhập sự kiện hoặc nhân vật lịch sử..."
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Mức độ:</label>
                <select
                  value={cognitiveLevel}
                  onChange={(e) => setCognitiveLevel(e.target.value)}
                  className="text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
                >
                  <option value="Nhận biết">Nhận biết</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Số câu:</label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
                >
                  <option value={3}>3 câu</option>
                  <option value={4}>4 câu</option>
                  <option value={5}>5 câu</option>
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={() => handleGenerate()}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Đang tạo...' : 'Tạo AI'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick topic pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-1">
            <span className="text-slate-400 font-semibold shrink-0 text-[10px]">Gợi ý:</span>
            {quickTopics.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTopic(t);
                  handleGenerate(t, count, cognitiveLevel);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-lg whitespace-nowrap text-slate-600 font-medium transition shrink-0"
              >
                {t}
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Questions Preview List */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              Danh sách {generatedQuestions.length} câu hỏi AI tạo lập (Khảo thí Lịch sử 7):
            </p>
            {isGenerating && (
              <span className="text-indigo-600 font-bold text-[11px] flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang đối chiếu sử liệu...
              </span>
            )}
          </div>

          {generatedQuestions.map((item, idx) => (
            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 transition hover:border-indigo-200">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900 leading-snug">
                  Câu {idx + 1}: {item.q}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.cognitiveLevel && (
                    <span className="flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-bold px-2 py-0.5 rounded-full">
                      <Award className="w-3 h-3 text-indigo-600" />
                      {item.cognitiveLevel}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    {item.citation}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {item.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`p-2 rounded-lg text-[11px] font-medium border flex items-center justify-between ${
                      oIdx === item.correct
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{opt}</span>
                    {oIdx === item.correct && (
                      <span className="text-emerald-600 text-[10px] font-bold">✓ Đúng</span>
                    )}
                  </div>
                ))}
              </div>

              {item.explanation && (
                <div className="text-[11px] bg-white border border-slate-200/80 rounded-lg p-2 text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">Căn cứ sử liệu:</strong> {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 font-medium pl-2">
            Tổng cộng: <strong>{generatedQuestions.length} câu hỏi</strong> chuẩn kiến thức kỹ năng
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              Đóng
            </button>
            <button
              onClick={() => onSaveQuestions(generatedQuestions.length)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>Thêm {generatedQuestions.length} câu này vào bài học</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

