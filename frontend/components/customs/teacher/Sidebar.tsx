import React, { useState } from 'react';
import { BarChart2, ChevronLeft, ChevronRight, Compass, FolderOpen, HelpCircle, Home, MapPin, Radio, Sparkles, Users } from 'lucide-react';
import { BrandLogo } from '@/components/customs/BrandLogo';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenAiModal: () => void;
}

const NAV_ITEMS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  isAi?: boolean;
}> = [
  { id: 'home', label: 'Trang chủ', icon: Home, color: '#0f766e' },
  { id: 'live', label: 'Thi đấu', icon: Radio, color: '#e21b3c', badge: 'LIVE' },
  { id: 'quests', label: 'Nhiệm vụ', icon: MapPin, color: '#c2410c', badge: 'Mới' },
  { id: 'discover', label: 'Khám phá', icon: Compass, color: '#0369a1' },
  { id: 'library', label: 'Thư viện', icon: FolderOpen, color: '#d97706' },
  { id: 'reports', label: 'Báo cáo', icon: BarChart2, color: '#b91c1c' },
  { id: 'groups', label: 'Nhóm lớp', icon: Users, color: '#2b70c9', badge: '7A1' },
  { id: 'ai_tools', label: 'Học liệu AI', icon: Sparkles, color: '#7e22ce', isAi: true, badge: 'AI' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onOpenAiModal }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  return (
    <aside
      className={`bg-white border-r-2 border-duo-swan flex flex-col justify-between transition-all duration-300 z-40 shrink-0 h-full py-5 ${
        isCollapsed ? 'w-[88px] px-3' : 'w-64 px-4'
      }`}
    >
      <div className="min-h-0 flex flex-col">
        <div className={`flex items-center mb-6 px-1 ${isCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
          <BrandLogo compact={isCollapsed} subtitle="Giảng viên" />
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl text-duo-hare hover:text-duo-wolf hover:bg-duo-polar transition hidden md:block"
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => (item.isAi ? onOpenAiModal() : onSelectTab(item.id))}
                className={`nav-duo ${isCollapsed ? 'justify-center' : ''} ${isActive ? 'is-active' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.6} />
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`chip ${
                          item.badge === 'LIVE' ? 'bg-kh-red text-white' : item.isAi ? 'bg-duo-purple text-white' : 'bg-duo-polar text-duo-wolf'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={() => onSelectTab('help')}
        className={`nav-duo ${isCollapsed ? 'justify-center' : ''}`}
        title={isCollapsed ? 'Trợ giúp' : undefined}
      >
        <span className="w-8 h-8 rounded-xl bg-duo-polar flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-duo-hare" />
        </span>
        {!isCollapsed && <span>Trợ giúp & SGK 7</span>}
      </button>
    </aside>
  );
};
