import React, { useState } from 'react';
import {
  Home,
  Compass,
  FolderOpen,
  BarChart2,
  Users,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenAiModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenAiModal,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: 'home',
      label: 'Trang chủ 3D',
      icon: Home,
    },
    {
      id: 'quests',
      label: 'Bản đồ Nhiệm vụ',
      icon: MapPin,
      badge: 'Mới',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'discover',
      label: 'Khám phá bài học',
      icon: Compass,
    },
    {
      id: 'library',
      label: 'Thư viện',
      icon: FolderOpen,
    },
    {
      id: 'reports',
      label: 'Báo cáo',
      icon: BarChart2,
    },
    {
      id: 'groups',
      label: 'Nhóm lớp',
      icon: Users,
      badge: 'Lớp 7A1',
    },
    {
      id: 'ai_tools',
      label: 'Học liệu AI',
      icon: Sparkles,
      isAi: true,
      badge: 'AI',
    },
  ];

  return (
    <aside
      className={`bg-white/95 backdrop-blur-xl border-r border-slate-200/80 flex flex-col justify-between transition-all duration-300 z-40 shrink-0 ${
        isCollapsed ? 'w-20' : 'w-60'
      } h-full shadow-xs`}
    >
      <div>
        {/* Logo / Header Branding */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-gradient-to-br from-[#46178f] to-indigo-800 text-white px-2.5 py-1.5 rounded-xl font-black text-sm tracking-tight shadow-md shadow-purple-900/15">
                <span>Đông A</span>
                <span className="bg-gradient-to-r from-[#ff3355] to-amber-500 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">
                  EDU
                </span>
              </div>
              <div className="leading-tight">
                <span className="text-xs font-extrabold text-slate-900 block">Lịch sử 7</span>
                <span className="text-[10px] text-slate-400 font-semibold">Command Center</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#46178f] to-indigo-800 text-white rounded-xl font-black text-sm shadow-md">
              ĐA
            </div>
          )}

          {/* Nút thu gọn / mở rộng */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition hidden md:block"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Danh sách mục menu chính */}
        <nav className="p-2.5 space-y-1 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isAi) {
                    onOpenAiModal();
                  } else {
                    onSelectTab(item.id);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[#46178f] to-indigo-700 text-white shadow-md shadow-purple-900/20'
                    : item.isAi
                    ? 'bg-purple-50/70 text-purple-800 hover:bg-purple-100/80 border border-purple-200/60'
                    : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : item.isAi ? 'text-purple-600' : 'text-slate-500'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between text-left">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.isAi
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Chân trang Sidebar (Trợ giúp) */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={() => onSelectTab('help')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
          title={isCollapsed ? 'Trợ giúp' : undefined}
        >
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
          {!isCollapsed && <span>Trợ giúp & SGK 7</span>}
        </button>
      </div>
    </aside>
  );
};
