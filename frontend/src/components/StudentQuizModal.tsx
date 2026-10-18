import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, BookOpen, ChevronRight, Award, RotateCcw, Sparkles } from 'lucide-react';
import type { QuizQuestion } from '../types/roles';
import { API_BASE_URL } from '../config/api';

interface StudentQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (score: number) => void;
}

interface BKTUpdateInfo {
  old_p_l: number;
  new_p_l: number;
  p_l_delta: number;
  mastery_status: string;
}

const sampleQuestions: QuizQuestion[] = [
  {
    id: 1,
    unit_id: 'BINH_THAN_CONFERENCE',
    question: 'Hội nghị Bình Than (tháng 10/1282) do vua Trần Nhân Tông triệu tập thành phần nào tham gia?',
    options: [
      'A. Toàn thể nhân dân và các bô lão trong cả nước',
      'B. Các vương hầu, quý tộc và tướng lĩnh trong hoàng tộc',
      'C. Đội quân gia nô hơn 1.000 người của Trần Quốc Toản',
      'D. Các sứ giả và quan lại của triều Lý cũ',
    ],
    correctAnswer: 1,
    explanation: 'Theo SGK Lịch sử 7 (trang 68), Hội nghị Bình Than triệu tập các vương hầu và tướng lĩnh để bàn kế sách tác chiến, phân công phòng thủ.',
    citation: 'SGK Lịch sử 7 (KNTT), tr. 68',
  },
  {
    id: 2,
    unit_id: 'TQT_WHY_ORANGE',
    question: 'Hoài Văn hầu Trần Quốc Toản vì không được dự bàn việc quân đã có hành động nổi tiếng nào?',
    options: [
      'A. Làm thơ khắc lên vách đá trên bờ sông Lục Đầu',
      'B. Bỏ về quê hương ở Thanh Hóa không tham gia kháng chiến',
      'C. Hổ thẹn, phẫn uất, tay bóp nát quả cam vua ban lúc nào không biết',
      'D. Xin vua cho chỉ huy cánh quân thủy binh ở Vạn Kiếp',
    ],
    correctAnswer: 2,
    explanation: 'Quốc Toản vì còn nhỏ tuổi nên chỉ được đứng ngoài, uất ức bóp nát quả cam rồi về chiêu mộ 1.000 gia nô, thêu cờ 6 chữ vàng.',
    citation: 'SGK Lịch sử 7 (KNTT), tr. 68',
  },
  {
    id: 3,
    unit_id: 'CHUONG_DUONG_1285',
    question: 'Chiến thắng Chương Dương Độ (hè năm 1285) do vị tướng nào chỉ huy có ý nghĩa gì đối với cuộc kháng chiến?',
    options: [
      'A. Trần Quang Khải chỉ huy, tạo bước ngoặt quyết định tiến tới giải phóng Thăng Long',
      'B. Trần Thủ Độ chỉ huy, đánh tan hoàn toàn cánh quân Thoát Hoan',
      'C. Trần Khánh Dư chỉ huy, đốt cháy toàn bộ đoàn thuyền lương giặc',
      'D. Yết Kiêu chỉ huy, lặn đục thủng thuyền Ô Mã Nhi',
    ],
    correctAnswer: 0,
    explanation: 'Trận Chương Dương Độ do Thượng tướng Thái sư Trần Quang Khải chỉ huy đã đập tan phòng tuyến giặc, mở đường cho đại quân ta giải phóng kinh thành Thăng Long.',
    citation: 'SGK Lịch sử 7 (KNTT), tr. 69',
  },
];

export const StudentQuizModal: React.FC<StudentQuizModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [bktUpdate, setBktUpdate] = useState<BKTUpdateInfo | null>(null);

  if (!isOpen) return null;

  const currentQ = sampleQuestions[currentIdx];

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
  };

  const handleCheckAnswer = async () => {
    if (selectedOption === null) return;
    setIsAnswerSubmitted(true);
    const isCorrect = selectedOption === currentQ.correctAnswer;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/quiz/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: 'student_nguyen_van_long',
          unit_id: currentQ.unit_id || 'TQT_WHY_ORANGE',
          is_correct: isCorrect,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBktUpdate(data);
      }
    } catch (e) {
      console.warn('Lỗi gọi API BKT:', e);
    }
  };

  const handleNext = () => {
    if (currentIdx < sampleQuestions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setBktUpdate(null);
    } else {
      setIsFinished(true);
      onComplete(score + (selectedOption === currentQ.correctAnswer ? 1 : 0));
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setIsFinished(false);
    setBktUpdate(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black">
              ⚔️
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                Chặng 3: Trận Chương Dương Độ (1285)
              </h3>
              <p className="text-[11px] text-emerald-100">
                Câu {currentIdx + 1} / {sampleQuestions.length} • Trả lời để nhận +180 điểm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-2">
          <div
            className="bg-emerald-500 h-2 transition-all duration-300"
            style={{ width: `${((currentIdx + (isAnswerSubmitted ? 1 : 0)) / sampleQuestions.length) * 100}%` }}
          ></div>
        </div>

        {/* Quiz Body */}
        {!isFinished ? (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Question Title */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mb-2">
                Câu hỏi trắc nghiệm
              </span>
              <h4 className="font-bold text-slate-900 text-sm leading-relaxed">
                {currentQ.question}
              </h4>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQ.correctAnswer;
                let optionStyle = 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-800';

                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    optionStyle = 'bg-emerald-100/80 border-emerald-500 text-emerald-950 font-bold';
                  } else if (isSelected && !isCorrect) {
                    optionStyle = 'bg-red-100/80 border-red-500 text-red-950';
                  } else {
                    optionStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                  }
                } else if (isSelected) {
                  optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-500/20';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    disabled={isAnswerSubmitted}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition text-xs flex items-center justify-between ${optionStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswerSubmitted && isCorrect && (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                    )}
                    {isAnswerSubmitted && isSelected && !isCorrect && (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation box after submission */}
            {isAnswerSubmitted && (
              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed animate-fade-in ${
                  selectedOption === currentQ.correctAnswer
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {selectedOption === currentQ.correctAnswer
                      ? 'Chính xác! Giỏi lắm em!'
                      : 'Chưa chính xác! Hãy đọc lại tư liệu SGK:'}
                  </span>
                </div>
                <p className="text-[11px] mb-1">{currentQ.explanation}</p>
                <span className="text-[10px] font-bold text-slate-500 block">
                  Căn cứ: {currentQ.citation}
                </span>

                {/* Phản hồi cập nhật tiến trình BKT thời gian thực */}
                {bktUpdate && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[11px] font-bold text-indigo-900">
                        Nắm vững BKT: {(bktUpdate.old_p_l * 100).toFixed(0)}% ➔{' '}
                        <strong className="text-emerald-700">{(bktUpdate.new_p_l * 100).toFixed(0)}%</strong>{' '}
                        <span className="text-[10px] text-slate-500">
                          ({bktUpdate.p_l_delta >= 0 ? `+${(bktUpdate.p_l_delta * 100).toFixed(0)}%` : `${(bktUpdate.p_l_delta * 100).toFixed(0)}%`})
                        </span>
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      bktUpdate.new_p_l >= 0.8
                        ? 'bg-emerald-100 text-emerald-800'
                        : bktUpdate.new_p_l >= 0.6
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {bktUpdate.mastery_status}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Finished Screen */
          <div className="p-8 text-center space-y-4 flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-inner animate-bounce">
              🏆
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Chúc mừng em đã hoàn thành chặng 3!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Trận Chương Dương Độ thắng lợi vang dội, hào khí Đông A sáng ngời!
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 w-full max-w-sm flex justify-around text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Số câu đúng</span>
                <strong className="text-lg font-black text-emerald-600">
                  {score}/{sampleQuestions.length}
                </strong>
              </div>
              <div className="border-r border-slate-200"></div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Điểm thưởng</span>
                <strong className="text-lg font-black text-amber-500">
                  +{score * 60} Điểm
                </strong>
              </div>
              <div className="border-r border-slate-200"></div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Chuỗi ngày</span>
                <strong className="text-lg font-black text-rose-500">
                  🔥 7 Ngày
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm lại</span>
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition"
              >
                <Award className="w-4 h-4" />
                <span>Nhận thưởng & Về lộ trình</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer with action buttons */}
        {!isFinished && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              Điểm hiện tại: <strong className="text-emerald-600 font-bold">{score * 60} điểm</strong>
            </span>

            {!isAnswerSubmitted ? (
              <button
                onClick={handleCheckAnswer}
                disabled={selectedOption === null}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  selectedOption !== null
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Kiểm tra đáp án
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
              >
                <span>
                  {currentIdx < sampleQuestions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
