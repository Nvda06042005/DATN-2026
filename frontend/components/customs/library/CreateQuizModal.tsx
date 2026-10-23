import React, { useState } from 'react';
import { Folder, HelpCircle, Plus, Trash2, X } from 'lucide-react';
import type { FolderItem, QuizItem } from '@/types/libraryType';

interface CreateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveQuiz: (quiz: QuizItem) => void;
  onOpenAiGenerator: () => void;
}

interface QuestionDraft {
  question: string;
  options: string[];
  correctIndex: number;
}

export const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId,
  onSaveQuiz,
  onOpenAiGenerator,
}) => {
  const [title, setTitle] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || '');
  const [status, setStatus] = useState<'draft' | 'ready'>('ready');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question: 'Tại sao Trần Quốc Toản lại bóp nát quả cam tại Hội nghị Bình Than?',
      options: [
        'Vì uất ức do tuổi còn nhỏ không được vào dự bàn việc nước',
        'Vì quả cam bị hỏng',
        'Vì muốn chứng tỏ sức mạnh với các tướng',
        'Vì vua Trần giáng chức',
      ],
      correctIndex: 0,
    },
  ]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: `Câu hỏi số ${questions.length + 1}...`,
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctIndex: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (idx: number, text: string) => {
    const updated = [...questions];
    updated[idx].question = text;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = val;
    setQuestions(updated);
  };

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    const updated = [...questions];
    updated[qIdx].correctIndex = optIdx;
    setQuestions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newQuiz: QuizItem = {
      id: `quiz-${Date.now()}`,
      title: title.trim(),
      questionCount: questions.length,
      status,
      folderId: selectedFolderId || null,
      thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      questions: questions.map((q, idx) => ({
        id: `q-${idx}`,
        question: q.question,
        type: 'quiz',
        timeLimit: 20,
        points: 'standard',
        answerMode: 'single',
        options: q.options.map((opt, optIdx) => ({
          text: opt,
          isCorrect: optIdx === q.correctIndex,
        })),
      })),
    };

    onSaveQuiz(newQuiz);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-kh-purple">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Tạo bộ câu hỏi Quiz mới</h3>
              <p className="text-[11px] text-duo-wolf">Bài học tương tác với câu hỏi trắc nghiệm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick AI Trigger Banner */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-purple-900">
              <span className="font-extrabold">Gợi ý:</span> Bạn có thể dùng Trình tạo AI để tự động tạo đề từ SGK Lịch sử 7 nhanh chóng!
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAiGenerator();
              }}
              className="px-3 py-1.5 btn-3d btn-purple btn-normal-case rounded-lg text-xs font-bold shrink-0 transition"
            >
              Dùng AI tạo đề
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tiêu đề bài Quiz <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Bài 13: Ba lần kháng chiến chống Mông - Nguyên..."
              className="input-duo w-full"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-duo-hare" />
                Lưu vào thư mục
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="input-duo w-full"
              >
                <option value="">-- Chưa phân loại --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
                Trạng thái lưu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'ready')}
                className="input-duo w-full"
              >
                <option value="ready">Sẵn sàng giảng dạy</option>
                <option value="draft">Bản nháp</option>
              </select>
            </div>
          </div>

          {/* Question List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold text-duo-ink">
                Danh sách câu hỏi ({questions.length})
              </h4>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1 text-xs font-bold text-duo-blue hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="bg-duo-polar border-2 border-duo-swan rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-purple-700">Câu {qIdx + 1}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1 text-duo-hare hover:text-red-600 transition"
                        title="Xoá câu hỏi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="input-duo w-full"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 text-xs transition ${
                          q.correctIndex === optIdx
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                            : 'bg-white border-duo-swan text-[#4b4b4b]'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                          className="accent-emerald-600 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 btn-3d btn-blue btn-normal-case disabled:opacity-50 rounded-xl text-xs font-bold transition"
            >
              Lưu bài Quiz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
