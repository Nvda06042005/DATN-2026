import React, { useState } from 'react';
import {
  Plus,
  Filter,
  Maximize2,
  ChevronDown,
  MapPin,
  Compass,
} from 'lucide-react';
import { mockQuests } from '../data/questMockData';
import type { Quest } from '../types/quest';
import { QuestDetailMapView } from './QuestDetailMapView';
import daiVietMapImg from '../assets/dai_viet_campaign_map.jpg';

interface QuestWorldMapViewProps {
  onShowToast: (msg: string) => void;
}

export const QuestWorldMapView: React.FC<QuestWorldMapViewProps> = ({ onShowToast }) => {
  const [quests, setQuests] = useState<Quest[]>(mockQuests);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // If a quest is clicked, drill down to Level 2: QuestDetailMapView (Ảnh 2)
  if (selectedQuest) {
    return (
      <QuestDetailMapView
        quest={selectedQuest}
        onBackToWorldMap={() => setSelectedQuest(null)}
        onShowToast={onShowToast}
      />
    );
  }

  const filteredQuests = quests.filter((q) => {
    if (filterType === 'all') return true;
    return q.status === filterType;
  });

  const handleCreateNewQuest = () => {
    const newQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: 'Chiến dịch Hàm Tử - Tây Kết (Năm 1285)',
      subtitle: 'Nhiệm vụ Lịch sử 7',
      description: 'Hành trình 8 ải phản công mùa hè năm 1285 đập tan đạo quân Thoát Hoan.',
      coords: { x: 62, y: 52 },
      status: 'active',
      totalStudents: 35,
      objectives: mockQuests[0].objectives.slice(0, 8),
    };

    setQuests((prev) => [...prev, newQuest]);
    onShowToast(`🎉 Đã tạo nhiệm vụ mới: "${newQuest.title}" cắm trên Bản đồ thế giới!`);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* ======================================================== */}
      {/* 1. Header Bar trên cùng (Khớp chuẩn Ảnh 1) */}
      {/* ======================================================== */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-2.5 flex items-center justify-between z-30 shadow-2xs shrink-0">
        {/* Left: Logo/Class selector & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Class Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer transition text-xs font-black text-slate-800">
            <span>Lớp 7A1</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </div>

          <span className="text-slate-300">|</span>

          {/* Breadcrumb: Quêtes / Nhiệm vụ */}
          <h1 className="text-sm font-black text-slate-900 tracking-tight">
            Nhiệm vụ (Quêtes)
          </h1>
        </div>

        {/* Right Action Tools: + (Tạo nhiệm vụ), Lọc nhiệm vụ (Khớp ảnh 1) */}
        <div className="flex items-center gap-3">
          {/* Nút Tạo nhiệm vụ mới (+) màu xanh lá */}
          <button
            onClick={handleCreateNewQuest}
            className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shadow-xs active:scale-95"
            title="Tạo nhiệm vụ mới trên bản đồ"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Dropdown Lọc nhiệm vụ (Filtrer les quêtes) */}
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {filterType === 'all'
                  ? 'Tất cả nhiệm vụ'
                  : filterType === 'active'
                  ? 'Đang diễn ra'
                  : 'Đã hoàn thành'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 text-xs font-semibold">
                <button
                  onClick={() => {
                    setFilterType('all');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                    filterType === 'all' ? 'text-emerald-600 font-black' : 'text-slate-700'
                  }`}
                >
                  Tất cả nhiệm vụ ({quests.length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('active');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                    filterType === 'active' ? 'text-emerald-600 font-black' : 'text-slate-700'
                  }`}
                >
                  Đang diễn ra ({quests.filter((q) => q.status === 'active').length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('completed');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                    filterType === 'completed' ? 'text-emerald-600 font-black' : 'text-slate-700'
                  }`}
                >
                  Đã hoàn thành (0)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Canvas: Bản đồ thế giới (World Map - Khớp Ảnh 1) */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* Bản đồ nền nghệ thuật kỳ vĩ (World Map Artwork) */}
        <img
          src={daiVietMapImg}
          alt="Sa bàn Chiến dịch Đại Việt"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-100 transition duration-700"
        />

        {/* Hiệu ứng mây khói / Khí quyển bao quanh */}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/30 pointer-events-none" />

        {/* Các điểm ghim Nhiệm vụ lớn trên Bản đồ thế giới (Khớp Ảnh 1) */}
        <div className="absolute inset-0 z-20 pointer-events-auto">
          {filteredQuests.map((q) => {
            return (
              <div
                key={q.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300"
                style={{ left: `${q.coords.x}%`, top: `${q.coords.y}%` }}
                onClick={() => setSelectedQuest(q)}
              >
                {/* Vòng tròn gợn sóng phát sáng (Glowing Ping Pulse) */}
                <span className="absolute -inset-4 rounded-full bg-emerald-400 animate-ping opacity-60 pointer-events-none" />
                <span className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse pointer-events-none" />

                {/* Biểu tượng Ghim nhiệm vụ màu xanh lá (Khớp chuẩn Ảnh 1) */}
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 border-[3px] border-white flex items-center justify-center text-white shadow-2xl transition-transform duration-200 group-hover:scale-125 group-active:scale-95">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 fill-white text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Nhãn tên nhiệm vụ hình hộp trắng phía dưới (Khớp chuẩn Ảnh 1) */}
                <div className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-slate-200/90 whitespace-nowrap text-center transition-all duration-200 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-800">
                  <div className="text-xs font-black text-slate-900 group-hover:text-white flex items-center gap-1.5">
                    <span>{q.title}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-emerald-300 font-semibold mt-0.5">
                    {q.objectives.length} ải thử thách • Bấm để mở bản đồ
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hướng dẫn thao tác góc dưới bên trái */}
        <div className="absolute bottom-5 left-5 z-20 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-white rounded-2xl p-4 shadow-xl text-xs space-y-1 max-w-sm hidden sm:block">
          <div className="font-black text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            <span>Hệ thống Bản đồ Nhiệm vụ (Quests)</span>
          </div>
          <div className="text-slate-300 text-[11px] leading-relaxed">
            Bấm vào điểm ghim xanh lá <span className="text-emerald-400 font-bold">"{quests[0].title}"</span> để mở Bản đồ hành trình chi tiết 13 ải thử thách của lớp 7A1.
          </div>
        </div>

        {/* Nút Phóng to toàn màn hình góc dưới bên phải */}
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
          <button
            onClick={() => onShowToast('🔍 Đang bật chế độ toàn cảnh bản đồ.')}
            className="w-10 h-10 rounded-2xl bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-lg transition"
            title="Toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
