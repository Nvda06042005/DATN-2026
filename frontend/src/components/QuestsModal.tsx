import React from 'react';
import { X, CheckCircle, Award } from 'lucide-react';

interface QuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuestsModal: React.FC<QuestsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const quests = [
    {
      id: 1,
      title: 'Hoàn thành bài tập Chương Dương Độ',
      description: 'Trả lời đúng tối thiểu 8/10 câu hỏi trắc nghiệm của chặng 3.',
      progress: 8,
      total: 10,
      reward: '+100 Điểm',
      completed: false,
    },
    {
      id: 2,
      title: 'Đạt chuỗi 5 câu đúng liên tiếp',
      description: 'Giữ vững sự tập trung và trả lời đúng không ngắt quãng.',
      progress: 5,
      total: 5,
      reward: '+50 Điểm',
      completed: true,
    },
    {
      id: 3,
      title: 'Hỗ trợ bạn học trong lớp',
      description: 'Sử dụng tính năng cộng điểm hỗ trợ cho bạn học có điểm tham gia thấp.',
      progress: 1,
      total: 1,
      reward: '+30 Điểm',
      completed: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide uppercase">Nhiệm Vụ Học Tập</h3>
              <p className="text-[11px] text-amber-100 font-medium">Hoàn thành để nhận điểm thưởng mỗi ngày</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quest List */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {quests.map((quest) => (
            <div
              key={quest.id}
              className={`p-4 rounded-2xl border transition ${
                quest.completed
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">{quest.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {quest.description}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                    quest.completed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {quest.reward}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>Tiến độ</span>
                  <span>
                    {quest.progress}/{quest.total}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quest.completed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min((quest.progress / quest.total) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {quest.completed && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Đã hoàn thành! Đã cộng vào điểm số cá nhân.</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
