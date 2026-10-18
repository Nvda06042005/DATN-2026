import React, { useState } from 'react';
import {
  X,
  User,
  BarChart2,
  Sparkles,
  Compass,
  FileSpreadsheet,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  Check,
  EyeOff,
} from 'lucide-react';

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  category: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'assignment';
  status: 'active' | 'completed' | 'skipped';
  actionLabel?: string;
  actionType?: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'library';
}

interface TodoListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TodoTask[];
  onToggleComplete: (id: string) => void;
  onSkipTask: (id: string) => void;
  onRestoreTask: (id: string) => void;
  onExecuteAction: (actionType?: string) => void;
}

export const TodoListModal: React.FC<TodoListModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onToggleComplete,
  onSkipTask,
  onRestoreTask,
  onExecuteAction,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'skipped'>('active');

  if (!isOpen) return null;

  const activeTasks = tasks.filter((t) => t.status === 'active');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const skippedTasks = tasks.filter((t) => t.status === 'skipped');

  const displayedTasks =
    activeTab === 'active'
      ? activeTasks
      : activeTab === 'completed'
      ? completedTasks
      : skippedTasks;

  const getTaskIcon = (task: TodoTask) => {
    switch (task.category) {
      case 'profile':
        return (
          <div className="w-8 h-8 rounded-full bg-[#b8bcc8] flex items-center justify-center text-white shrink-0 shadow-2xs">
            <User className="w-4 h-4 fill-white text-white" />
          </div>
        );
      case 'report':
        return (
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0 shadow-2xs">
            <BarChart2 className="w-4 h-4" />
          </div>
        );
      case 'ai':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      case 'lesson':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <Compass className="w-4 h-4" />
          </div>
        );
      case 'excel':
        return (
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 shrink-0 shadow-2xs">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
            <BookOpen className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[520px] max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* 1. Modal Header (Khớp chuẩn ảnh: Tiêu đề + Nút đóng ✕) */}
        {/* ======================================================== */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Danh sách việc cần làm
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* 2. Thanh Tabs dạng viên thuốc đen/tím (Khớp chuẩn ảnh) */}
        {/* ======================================================== */}
        <div className="px-8 pb-5 shrink-0">
          <div className="inline-flex items-center bg-[#131226] p-1 rounded-xl shadow-xs gap-1 select-none">
            {/* Tab 1: Đang hoạt động */}
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'active'
                  ? 'bg-[#828dfe] text-[#131226] shadow-xs'
                  : 'text-white hover:text-slate-200'
              }`}
            >
              Đang hoạt động ({activeTasks.length})
            </button>

            {/* Tab 2: Đã hoàn thành */}
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'completed'
                  ? 'bg-[#828dfe] text-[#131226] shadow-xs'
                  : 'text-white hover:text-slate-200'
              }`}
            >
              Đã hoàn thành ({completedTasks.length})
            </button>

            {/* Tab 3: Đã bỏ qua */}
            <button
              onClick={() => setActiveTab('skipped')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'skipped'
                  ? 'bg-[#828dfe] text-[#131226] shadow-xs'
                  : 'text-white hover:text-slate-200'
              }`}
            >
              Đã bỏ qua ({skippedTasks.length})
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. Danh sách các đầu việc (Khớp chuẩn nền xám nhạt như ảnh) */}
        {/* ======================================================== */}
        <div className="px-8 pb-8 overflow-y-auto flex-1 space-y-3">
          {displayedTasks.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">
                {activeTab === 'active'
                  ? 'Tuyệt vời! Bạn đã hoàn thành tất cả việc cần làm.'
                  : activeTab === 'completed'
                  ? 'Chưa có đầu việc nào được đánh dấu hoàn thành.'
                  : 'Không có đầu việc nào bị bỏ qua.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Các đầu việc mới sẽ xuất hiện tự động theo tiến độ giảng dạy.
              </p>
            </div>
          ) : (
            displayedTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-[#f2f3f5] hover:bg-[#e9ebed] transition flex items-center justify-between gap-4 group"
              >
                {/* Left: Icon tròn + Nội dung tiêu đề và mô tả */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Icon trong vòng tròn */}
                  {getTaskIcon(task)}

                  {/* Chi tiết đầu việc */}
                  <div className="min-w-0">
                    <h4
                      className={`text-xs md:text-sm font-extrabold text-slate-900 leading-snug truncate ${
                        task.status === 'completed' ? 'text-slate-800' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-1">
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Right: Các nút tương tác */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Nếu đang hoạt động: Nút Thực hiện + Nút Hoàn tất + Nút Bỏ qua */}
                  {task.status === 'active' && (
                    <>
                      {task.actionLabel && (
                        <button
                          onClick={() => onExecuteAction(task.actionType)}
                          className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
                        >
                          <span>{task.actionLabel}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}

                      {/* Nút Hoàn thành (Checkmark) */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 active:scale-95"
                        title="Đánh dấu hoàn thành"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="hidden md:inline">Xong</span>
                      </button>

                      {/* Nút Bỏ qua */}
                      <button
                        onClick={() => onSkipTask(task.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition"
                        title="Bỏ qua việc này"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* Nếu đã hoàn thành: Nút Làm lại */}
                  {task.status === 'completed' && (
                    <button
                      onClick={() => onToggleComplete(task.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
                      title="Mở lại việc này"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Mở lại</span>
                    </button>
                  )}

                  {/* Nếu đã bỏ qua: Nút Khôi phục */}
                  {task.status === 'skipped' && (
                    <button
                      onClick={() => onRestoreTask(task.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-[#1368ce] border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Khôi phục</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
