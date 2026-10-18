import React from 'react';
import { X, Award, BookOpen, Clock, ShieldCheck } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-800 to-indigo-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=140&q=80"
                alt="Thầy Nguyễn Văn Long"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/80 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-white">
                Lv.12
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-white">Thầy Nguyễn Văn Long</h3>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">Giáo viên môn Lịch sử • THCS Đông A</p>
              <span className="inline-block mt-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                Tài khoản Giáo viên
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 grid grid-cols-3 gap-2.5 bg-slate-50 border-b border-slate-200 text-center">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
            <BookOpen className="w-4 h-4 mx-auto text-indigo-600 mb-1" />
            <span className="text-[10px] text-slate-500 block">Số tiết giảng</span>
            <strong className="text-xs font-black text-slate-900">24 tiết</strong>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
            <Clock className="w-4 h-4 mx-auto text-blue-600 mb-1" />
            <span className="text-[10px] text-slate-500 block">Thời gian dạy</span>
            <strong className="text-xs font-black text-slate-900">18.5 giờ</strong>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
            <Award className="w-4 h-4 mx-auto text-amber-600 mb-1" />
            <span className="text-[10px] text-slate-500 block">Điểm trung bình</span>
            <strong className="text-xs font-black text-slate-900">8.8 / 10</strong>
          </div>
        </div>

        {/* Badges and Info */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs">
          <div>
            <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
              Huy hiệu danh dự
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <div>
                  <strong className="text-[11px] font-bold text-amber-900 block leading-tight">
                    Giáo Viên Tích Cực
                  </strong>
                  <span className="text-[10px] text-amber-700">Tỷ lệ tham gia &gt;90%</span>
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <div>
                  <strong className="text-[11px] font-bold text-indigo-900 block leading-tight">
                    Chủ Soái Đông A
                  </strong>
                  <span className="text-[10px] text-indigo-700">Hoàn thành 4 chặng</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <h4 className="font-bold text-slate-800 text-[11px] mb-1">Thông tin lớp đang phụ trách:</h4>
            <p className="text-slate-600 text-[11px]">
              • <strong>Lớp:</strong> 7A1 (Sĩ số: 35 học sinh)<br />
              • <strong>Chương trình:</strong> Lịch sử & Địa lí 7 - Bộ sách Kết nối tri thức<br />
              • <strong>Bài học hiện tại:</strong> Bài 13: Ba lần kháng chiến chống Mông - Nguyên
            </p>
          </div>
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
