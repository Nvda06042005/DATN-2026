import React, { useState } from 'react';
import { BarChart2, BookOpen, Check, CheckCircle2, ChevronRight, Compass, EyeOff, FileSpreadsheet, RotateCcw, Sparkles, User, X } from 'lucide-react';
import type { TodoTask } from '@/types/teacherType';

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
          <div className="w-8 h-8 rounded-full bg-[#b8bcc8] flex items-center justify-center text-white shrink-0">
            <User className="w-4 h-4 fill-white text-white" />
          </div>
        );
      case 'report':
        return (
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
        );
      case 'ai':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      case 'lesson':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
        );
      case 'excel':
        return (
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-duo-wolf shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col min-h-[520px] max-h-[85vh] zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* 1. Modal Header (Khớp chuẩn ảnh: Tiêu đề + Nút đóng ✕) */}
        {/* ======================================================== */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-black text-duo-ink tracking-tight">
            Danh sách việc cần làm
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
            title="Đóng"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* 2. Thanh Tabs dạng viên thuốc đen/tím (Khớp chuẩn ảnh) */}
        {/* ======================================================== */}
        <div className="px-8 pb-5 shrink-0">
          <div className="inline-flex items-center bg-duo-polar border-2 border-duo-swan p-1 rounded-2xl gap-1 select-none">
            {/* Tab 1: Đang hoạt động */}
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'active'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
              }`}
            >
              Đang hoạt động ({activeTasks.length})
            </button>

            {/* Tab 2: Đã hoàn thành */}
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'completed'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
              }`}
            >
              Đã hoàn thành ({completedTasks.length})
            </button>

            {/* Tab 3: Đã bỏ qua */}
            <button
              onClick={() => setActiveTab('skipped')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'skipped'
                  ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                  : 'text-duo-hare hover:text-duo-wolf'
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
            <div className="py-20 text-center bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-duo-hare mx-auto mb-2" />
              <p className="text-sm font-bold text-duo-wolf">
                {activeTab === 'active'
                  ? 'Tuyệt vời! Bạn đã hoàn thành tất cả việc cần làm.'
                  : activeTab === 'completed'
                  ? 'Chưa có đầu việc nào được đánh dấu hoàn thành.'
                  : 'Không có đầu việc nào bị bỏ qua.'}
              </p>
              <p className="text-xs text-duo-hare mt-1">
                Các đầu việc mới sẽ xuất hiện tự động theo tiến độ giảng dạy.
              </p>
            </div>
          ) : (
            displayedTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-2xl border-2 border-duo-swan hover:bg-duo-polar transition flex items-center justify-between gap-4 group"
              >
                {/* Left: Icon tròn + Nội dung tiêu đề và mô tả */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Icon trong vòng tròn */}
                  {getTaskIcon(task)}

                  {/* Chi tiết đầu việc */}
                  <div className="min-w-0">
                    <h4
                      className={`text-xs md:text-sm font-extrabold text-duo-ink leading-snug truncate ${
                        task.status === 'completed' ? 'text-duo-ink' : ''
                      }`}
                    >
                      {task.title}
                    </h4>
                    <p className="text-xs text-duo-wolf mt-0.5 leading-relaxed line-clamp-1">
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
                          className="hidden sm:inline-flex btn-3d btn-outline btn-sm btn-normal-case !text-duo-ink"
                        >
                          <span>{task.actionLabel}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-duo-hare" />
                        </button>
                      )}

                      {/* Nút Hoàn thành (Checkmark) */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="btn-3d btn-green btn-sm"
                        title="Đánh dấu hoàn thành"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="hidden md:inline">Xong</span>
                      </button>

                      {/* Nút Bỏ qua */}
                      <button
                        onClick={() => onSkipTask(task.id)}
                        className="p-2 text-duo-hare hover:text-duo-wolf hover:bg-white rounded-xl transition"
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
                      className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
                      title="Mở lại việc này"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-duo-wolf" />
                      <span>Mở lại</span>
                    </button>
                  )}

                  {/* Nếu đã bỏ qua: Nút Khôi phục */}
                  {task.status === 'skipped' && (
                    <button
                      onClick={() => onRestoreTask(task.id)}
                      className="btn-3d btn-outline btn-sm btn-normal-case"
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
