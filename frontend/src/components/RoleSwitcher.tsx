import React from 'react';
import type { UserRole } from '../types/roles';
import { GraduationCap, BookOpen, Sparkles, Layers } from 'lucide-react';
import { ShinyText } from './reactbits';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, onRoleChange }) => {
  return (
    <div className="bg-gradient-to-r from-[#090d16] via-[#131129] to-[#090d16] text-white px-5 py-2 flex items-center justify-between border-b border-white/10 text-xs shadow-lg z-50 relative overflow-hidden">
      {/* Subtle top highlight line */}
      <div className="pointer-events-none absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-black text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-lg tracking-wider uppercase text-[10px]">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <ShinyText text="ĐÔNG A STUDIO • 3D INTERACTIVE" className="text-amber-300" />
        </span>
        <span className="text-slate-300/90 hidden md:flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          {currentRole === 'teacher'
            ? 'Không gian Giảng viên: Sa bàn chiến dịch 3D, Quản lý lớp 7A1 & Khởi tạo học liệu AI'
            : 'Không gian Học sinh: Sa bàn 3D Circular Carousel, Lộ trình BKT & Trợ lý AI Sử học'}
        </span>
      </div>

      {/* Awwwards Pill Segmented Switcher */}
      <div className="flex items-center gap-1 bg-white/[0.06] backdrop-blur-md p-1 rounded-xl border border-white/10">
        <button
          onClick={() => onRoleChange('teacher')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all duration-300 active:scale-95 ${
            currentRole === 'teacher'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30 ring-1 ring-white/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Giảng viên</span>
          {currentRole === 'teacher' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          onClick={() => onRoleChange('student')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all duration-300 active:scale-95 ${
            currentRole === 'student'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30 ring-1 ring-white/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Học sinh</span>
          {currentRole === 'student' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};
