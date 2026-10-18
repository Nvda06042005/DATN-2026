import { useState } from 'react';
import type { UserRole } from './types/roles';
import { RoleSwitcher } from './components/RoleSwitcher';
import { TeacherView } from './views/TeacherView';
import { StudentView } from './views/StudentView';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('teacher');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'teacher') {
      showToast('👨‍🏫 Đã chuyển sang giao diện Giảng viên (Quản lý & Điều phối tiết học)');
    } else {
      showToast('🎓 Đã chuyển sang giao diện Học sinh (Lộ trình bài học, làm bài trắc nghiệm)');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans bg-[#f4f5fa]">
      {/* Thanh phân quyền & chuyển đổi góc nhìn Giảng viên / Học sinh */}
      <RoleSwitcher
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
      />

      {/* Hiển thị giao diện tương ứng theo vai trò */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {currentRole === 'teacher' ? (
          <TeacherView onShowToast={showToast} />
        ) : (
          <StudentView onShowToast={showToast} />
        )}
      </div>

      {/* Toast thông báo toàn cục */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
