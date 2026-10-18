import {
  Flag,
  CheckCircle2,
  Swords,
  Flame,
  Lock,
  Info,
  Clock,
  HelpCircle,
  Award,
  Sparkles,
  Edit3,
  Users,
  Maximize2,
  Lock as LockIcon,
  LogOut,
} from 'lucide-react';
import type { BattleNode } from '../types/dashboard';

interface BattleCampaignColumnProps {
  nodes: BattleNode[];
  onOpenAiModal: () => void;
  onEditQuiz: () => void;
  onToggleGroupMode: () => void;
  onEndClass: () => void;
}

export const BattleCampaignColumn = ({
  nodes,
  onOpenAiModal,
  onEditQuiz,
  onToggleGroupMode,
  onEndClass,
}: BattleCampaignColumnProps) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Card 1: Tiến Trình Bài Học Chương 2 */}
      <div className="bg-gradient-to-br from-[#1e0842] via-[#2c0c59] to-[#3b1279] text-white rounded-2xl p-5 shadow-sm border border-purple-900/60 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300/80">
              TIẾN TRÌNH BÀI HỌC • CHƯƠNG 2
            </span>
            <h2 className="text-xl font-black text-white mt-0.5 tracking-tight">
              Kháng chiến chống Mông - Nguyên (1285)
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold text-emerald-300">
            <Flag className="w-3.5 h-3.5" />
            <span>Tiến độ: 2/4 chặng</span>
          </div>
        </div>

        {/* 4 Stepper Nodes */}
        <div className="grid grid-cols-4 gap-2.5 my-4 relative z-10">
          {nodes.map((node) => {
            if (node.status === 'completed') {
              return (
                <div
                  key={node.id}
                  className="bg-white/10 backdrop-blur-md border border-emerald-400/30 rounded-xl p-3 text-center transition hover:bg-white/15"
                >
                  <div className="w-9 h-9 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center mb-1.5 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-white truncate">{node.name}</h4>
                  <div className="flex justify-center text-amber-300 text-[10px] my-0.5">⭐⭐⭐</div>
                  <p className="text-[10px] text-emerald-300 font-semibold">{node.statusText}</p>
                </div>
              );
            }

            if (node.status === 'in_progress') {
              return (
                <div
                  key={node.id}
                  className="bg-white/10 backdrop-blur-md border border-blue-400/30 rounded-xl p-3 text-center transition hover:bg-white/15"
                >
                  <div className="w-9 h-9 mx-auto rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/40 flex items-center justify-center mb-1.5 shadow-sm">
                    <Swords className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-white truncate">{node.name}</h4>
                  <div className="flex justify-center text-amber-300 text-[10px] my-0.5">⭐⭐⭐</div>
                  <p className="text-[10px] text-blue-300 font-semibold">{node.statusText}</p>
                </div>
              );
            }

            if (node.status === 'active') {
              return (
                <div
                  key={node.id}
                  className="bg-gradient-to-b from-amber-500/20 to-purple-600/30 border-2 border-amber-400 rounded-xl p-3 text-center shadow-lg shadow-amber-500/10 relative scale-[1.02] transition"
                >
                  <span className="absolute -top-2 right-2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded uppercase tracking-wider">
                    HOT
                  </span>
                  <div className="w-9 h-9 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center mb-1.5 shadow-md shadow-amber-400/40 animate-bounce">
                    <Flame className="w-5 h-5 fill-slate-950" />
                  </div>
                  <h4 className="font-extrabold text-xs text-amber-200 truncate">{node.name}</h4>
                  <div className="inline-block bg-amber-400/90 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider my-0.5">
                    BÀI TẬP TRỌNG TÂM
                  </div>
                  <p className="text-[10px] text-amber-300 font-bold">Sẵn sàng làm bài</p>
                </div>
              );
            }

            return (
              <div
                key={node.id}
                className="bg-white/5 border border-white/5 rounded-xl p-3 text-center opacity-60 transition"
              >
                <div className="w-9 h-9 mx-auto rounded-full bg-white/10 text-slate-400 flex items-center justify-center mb-1.5">
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className="font-medium text-xs text-slate-300 truncate">{node.name}</h4>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">{node.statusText}</p>
              </div>
            );
          })}
        </div>

        {/* Context Historical Quote */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-start gap-2.5 text-xs text-purple-100/90 leading-relaxed relative z-10">
          <Info className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
          <p>
            Kiến thức trọng tâm: Sau hội nghị Bình Than và phòng tuyến Vạn Kiếp, chiến thắng{' '}
            <strong className="text-amber-300 font-bold">Chương Dương Độ</strong> có ý nghĩa quyết định,
            tạo bước ngoặt giải phóng Thăng Long.
          </p>
        </div>
      </div>

      {/* Card 2: Nhiệm Vụ Bài Học Đang Mở */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex-1 flex flex-col justify-between">
        <div>
          {/* Top Mission Meta */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
            <span className="flex items-center gap-1.5 text-purple-700 font-bold bg-purple-50 border border-purple-200/60 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              Bài tập đang mở
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Thời lượng dự kiến: 12 phút
            </span>
          </div>

          {/* Mission Title */}
          <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
            Chặng 3: Trận Chương Dương Độ (Năm 1285)
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Bộ câu hỏi trắc nghiệm tìm hiểu diễn biến cuộc phản công chiến lược của quân dân nhà Trần.
          </p>

          {/* 3 Stat Metric Boxes */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <Clock className="w-4 h-4 mx-auto text-blue-600 mb-1" />
              <span className="text-[10px] text-slate-500 font-medium block">Thời gian làm bài</span>
              <strong className="text-xs font-black text-slate-900">30 giây / câu</strong>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <HelpCircle className="w-4 h-4 mx-auto text-purple-600 mb-1" />
              <span className="text-[10px] text-slate-500 font-medium block">Số lượng câu hỏi</span>
              <strong className="text-xs font-black text-slate-900">10 câu trắc nghiệm</strong>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
              <Award className="w-4 h-4 mx-auto text-amber-600 mb-1" />
              <span className="text-[10px] text-slate-500 font-medium block">Điểm thưởng</span>
              <strong className="text-xs font-black text-slate-900">+180 điểm</strong>
            </div>
          </div>

          {/* Connected Students Stack */}
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar Stack */}
              <div className="flex -space-x-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white">
                  L
                </span>
                <span className="w-7 h-7 rounded-full bg-cyan-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white">
                  A
                </span>
                <span className="w-7 h-7 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white">
                  T
                </span>
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white">
                  Đ
                </span>
                <span className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white">
                  +28
                </span>
              </div>

              <div>
                <span className="font-bold text-xs text-slate-900 block leading-tight">
                  32 / 35 học sinh đã gia nhập
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  Tất cả thiết bị kết nối ổn định
                </span>
              </div>
            </div>

            <button className="text-xs font-bold text-purple-700 hover:text-purple-800 hover:underline">
              Xem danh sách phòng chờ
            </button>
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* Mode Indicator & Media Controls */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Lớp 7A1: Chế độ dạy học trực tiếp
            </span>

            <div className="flex items-center gap-1 text-slate-400">
              <button className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded transition" title="Toàn màn hình">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded transition" title="Khóa phòng học">
                <LockIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAiModal}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Tạo câu hỏi AI</span>
            </button>
            <button
              onClick={onEditQuiz}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Xem 10 câu hỏi</span>
            </button>
            <button
              onClick={onToggleGroupMode}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>Làm việc nhóm</span>
            </button>
            <button
              onClick={onEndClass}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Kết thúc tiết học</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
