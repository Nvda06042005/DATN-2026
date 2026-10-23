import React, { useEffect, useRef, useState } from 'react';
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
        className="btn-3d btn-green"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span className="hidden sm:inline">Tạo mới</span>
      </button>

      {/* Menu thả xuống (Khớp chuẩn chi tiết theo ảnh 4) */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-88 bg-white rounded-3xl shadow-[0_6px_0_#e7d9bc] border-2 border-duo-swan p-2 z-50 animate-pop-in">
          {/* Mục 1: Quiz (Trắc nghiệm tương tác) */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateQuiz();
            }}
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Kahoot / Quiz */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-6 rounded-md bg-[#115e59] flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-white transform rotate-45"></div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition">
                Quiz
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
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
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Câu chuyện */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-purple-300 group-hover:bg-purple-50/50 transition">
              <div className="w-6 h-7 rounded-sm bg-white border-2 border-duo-swan flex flex-col overflow-hidden">
                <div className="h-2.5 bg-[#115e59] w-full"></div>
                <div className="flex-1 p-1 flex flex-col justify-center gap-0.5">
                  <div className="h-0.5 bg-slate-300 rounded w-full"></div>
                  <div className="h-0.5 bg-slate-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition">
                Câu chuyện
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
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
            className="w-full px-3 py-3 rounded-2xl flex items-start gap-3.5 hover:bg-duo-polar transition text-left group"
          >
            {/* Biểu tượng Khoá học */}
            <div className="w-12 h-12 rounded-xl bg-duo-polar border-2 border-dashed border-duo-swan flex items-center justify-center shrink-0 group-hover:border-blue-300 group-hover:bg-blue-50/50 transition">
              <div className="w-7 h-6 rounded-md bg-white border-2 border-duo-swan relative flex flex-col items-center justify-center">
                <div className="w-4 h-1 bg-[#1368ce] rounded-full mb-1"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border-2 border-[#1368ce] flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#1368ce] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#1368ce] transition">
                Khoá học
              </h4>
              <p className="text-xs text-duo-wolf leading-snug mt-0.5">
                Phù hợp nhất cho các phiên dài, bao gồm video, tài liệu và đánh giá
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
