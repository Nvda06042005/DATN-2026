import { Search, Sparkles, Settings, Bell, Rocket, Shield } from 'lucide-react';

interface HeaderProps {
  onOpenAiModal: () => void;
  onLaunchBattle: () => void;
}

export const Header = ({ onOpenAiModal, onLaunchBattle }: HeaderProps) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand & Class Info */}
      <div className="flex items-center gap-4">
        {/* Brand Tag */}
        <div className="flex items-center gap-1.5 bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-black text-sm tracking-wide shadow-xs">
          <span className="text-base font-bold">Đông A</span>
          <span className="bg-amber-500 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ml-0.5 text-white">
            EDU
          </span>
        </div>

        {/* Lesson Info */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Lịch sử 7 - Hào khí Đông A</span>
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                Lớp 7A1
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Chủ đề: Kháng chiến chống Mông - Nguyên (1285)</p>
          </div>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm học sinh, câu hỏi, tài liệu..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition"
          />
        </div>
      </div>

      {/* Right: Actions & Teacher Profile */}
      <div className="flex items-center gap-3">
        {/* AI Generator Button */}
        <button
          onClick={onOpenAiModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
          <span>Tạo câu hỏi AI</span>
        </button>

        {/* Icons */}
        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition" title="Cài đặt">
          <Settings className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition relative" title="Thông báo">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Teacher Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
            alt="Thầy Nguyễn Văn Long"
            className="w-8 h-8 rounded-full border-2 border-amber-500/80 object-cover"
          />
          <div className="text-left leading-tight hidden lg:block">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-xs">Thầy Nguyễn Văn Long</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                Giáo viên
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Giáo viên phụ trách</p>
          </div>
        </div>

        {/* Start Lesson Button */}
        <button
          onClick={onLaunchBattle}
          className="flex items-center gap-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
        >
          <Rocket className="w-4 h-4" />
          <span>Bắt đầu bài học</span>
        </button>
      </div>
    </header>
  );
};
