import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface CreateDropdownProps {
  onCreateQuiz: () => void;
  onCreateStory: () => void;
  onCreateCourse: () => void;
  className?: string;
}

export const CreateDropdown: React.FC<CreateDropdownProps> = ({
  onCreateQuiz,
  onCreateStory,
  onCreateCourse,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Nút Tạo (Phong cách chuẩn Kahoot ảnh 4) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1.5 px-5 py-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/15 active:scale-95 transition"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>Tạo</span>
      </button>

      {/* Menu thả xuống (Khớp chuẩn chi tiết theo ảnh 4) */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-88 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Mục 1: Quiz (Trắc nghiệm tương tác) */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateQuiz();
            }}
            className="w-full px-4 py-3 flex items-start gap-3.5 hover:bg-slate-50 transition text-left group"
          >
            {/* Biểu tượng Kahoot / Quiz */}
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-6 rounded-md bg-[#46178f] flex items-center justify-center shadow-xs">
                <div className="w-2.5 h-2.5 bg-white transform rotate-45"></div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#46178f] transition">
                Quiz
              </h4>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Bài học tương tác ngắn với các câu hỏi bình chọn và trắc nghiệm
              </p>
            </div>
          </button>

          {/* Mục 2: Câu chuyện (Story) */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateStory();
            }}
            className="w-full px-4 py-3 flex items-start gap-3.5 hover:bg-slate-50 transition text-left group"
          >
            {/* Biểu tượng Câu chuyện */}
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-7 rounded-sm bg-white border border-slate-300 shadow-2xs flex flex-col overflow-hidden">
                <div className="h-2.5 bg-[#46178f] w-full"></div>
                <div className="flex-1 p-1 flex flex-col justify-center gap-0.5">
                  <div className="h-0.5 bg-slate-300 rounded w-full"></div>
                  <div className="h-0.5 bg-slate-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#46178f] transition">
                Câu chuyện
              </h4>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Kể một câu chuyện cho khán giả bằng cách sử dụng các khối nội dung khác nhau
              </p>
            </div>
          </button>

          {/* Mục 3: Khoá học */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateCourse();
            }}
            className="w-full px-4 py-3 flex items-start gap-3.5 hover:bg-slate-50 transition text-left group"
          >
            {/* Biểu tượng Khoá học */}
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0 group-hover:border-blue-300 group-hover:bg-blue-50/50 transition">
              <div className="w-7 h-6 rounded-md bg-white border border-slate-300 shadow-2xs relative flex flex-col items-center justify-center">
                <div className="w-4 h-1 bg-[#1368ce] rounded-full mb-1"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-[#1368ce] flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#1368ce] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#1368ce] transition">
                Khoá học
              </h4>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                Phù hợp nhất cho các phiên dài, bao gồm video, tài liệu và đánh giá
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
