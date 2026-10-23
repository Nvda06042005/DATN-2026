import React from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { ROLE_CHIP, ROLE_LABEL } from '@/constants/roles';
import type { AuthUser } from '@/types/authType';
import { avatarColor, initialsOf } from '@/utils/format';

interface TopBarProps {
  user: AuthUser;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ user, onChangePassword, onLogout }) => {
  const isAdmin = user.role === 'admin';
  return (
    <div className="bg-white border-b-2 border-duo-swan px-3 sm:px-5 py-2 flex items-center justify-between gap-3 z-50 relative shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {isAdmin ? (
          <span className="chip bg-duo-gold text-[#6b4400] shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> TRANG QUẢN TRỊ
          </span>
        ) : (
          <span className="chip bg-duo-green-light text-duo-green-dark shrink-0">ĐÔNG A STUDIO</span>
        )}
        <span className="hidden md:inline text-xs font-bold text-duo-hare truncate">
          {isAdmin
            ? 'Cấp tài khoản và theo dõi toàn bộ giáo viên, học sinh của trường'
            : user.role === 'teacher'
            ? `Không gian Giảng viên${user.class_name ? ` • Lớp ${user.class_name}` : ''}: theo dõi học sinh, tổ chức thi đấu & soạn học liệu AI`
            : `Không gian Học sinh${user.class_name ? ` • Lớp ${user.class_name}` : ''}: game Hào Khí Đông A`}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center" style={{ background: avatarColor(user.username) }}>
          {initialsOf(user.full_name)}
        </span>
        <div className="hidden lg:block leading-tight">
          <span className="block text-sm font-black text-duo-ink max-w-[180px] truncate">{user.full_name}</span>
          <span className={`chip !py-0 !text-[10px] ${ROLE_CHIP[user.role]}`}>{ROLE_LABEL[user.role]}</span>
        </div>
        <button onClick={onChangePassword} className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf" title="Đổi mật khẩu">
          <KeyRound className="w-4 h-4" />
        </button>
        <button onClick={onLogout} className="btn-3d btn-outline btn-sm !text-duo-red" title="Đăng xuất" aria-label="Đăng xuất">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
};
