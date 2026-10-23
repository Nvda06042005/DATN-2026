import React, { useState } from 'react';
import { ChevronDown, Compass, Filter, MapPin, Maximize2, Plus } from 'lucide-react';
import daiVietMapImg from '@/assets/images/dai_viet_campaign_map.jpg';
import { QuestDetailMapView } from '@/app/teacher/quests/detail/index';
import { mockQuests } from '@/constants/teacher/quests';
import type { Quest } from '@/types/questType';

interface QuestWorldMapViewProps {
  onShowToast: (msg: string) => void;
  /** Học sinh thật của lớp – thay cho danh sách mẫu trong bảng duyệt ải */
  roster?: Array<{ id: string; name: string }>;
}

const withRoster = (quest: Quest, roster?: Array<{ id: string; name: string }>): Quest =>
  roster
    ? {
        ...quest,
        totalStudents: roster.length,
        objectives: quest.objectives.map((o) => ({
          ...o,
          studentsProgress: roster.map((r) => ({ studentId: r.id, studentName: r.name, status: 'not_submitted' as const, outcome: 'pending' as const })),
        })),
      }
    : quest;

export const QuestWorldMapView: React.FC<QuestWorldMapViewProps> = ({ onShowToast, roster }) => {
  const [quests, setQuests] = useState<Quest[]>(mockQuests);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'completed'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // If a quest is clicked, drill down to Level 2: QuestDetailMapView (Ảnh 2)
  if (selectedQuest) {
    return (
      <QuestDetailMapView
        quest={withRoster(selectedQuest, roster)}
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
      <header className="bg-white border-b-2 border-duo-swan px-4 sm:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        {/* Left: Logo/Class selector & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Class Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-duo-purple-light cursor-pointer transition text-xs font-black text-kh-purple">
            <span>Lớp 7A1</span>
            <ChevronDown className="w-3 h-3 text-duo-wolf" />
          </div>

          <span className="text-duo-hare">|</span>

          {/* Breadcrumb: Quêtes / Nhiệm vụ */}
          <h1 className="text-lg font-black text-duo-ink tracking-tight">
            Nhiệm vụ (Quêtes)
          </h1>
        </div>

        {/* Right Action Tools: + (Tạo nhiệm vụ), Lọc nhiệm vụ (Khớp ảnh 1) */}
        <div className="flex items-center gap-3">
          {/* Nút Tạo nhiệm vụ mới (+) màu xanh lá */}
          <button
            onClick={handleCreateNewQuest}
            className="btn-3d btn-green btn-sm btn-icon"
            title="Tạo nhiệm vụ mới trên bản đồ"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Dropdown Lọc nhiệm vụ (Filtrer les quêtes) */}
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
            >
              <Filter className="w-3.5 h-3.5 text-duo-wolf" />
              <span>
                {filterType === 'all'
                  ? 'Tất cả nhiệm vụ'
                  : filterType === 'active'
                  ? 'Đang diễn ra'
                  : 'Đã hoàn thành'}
              </span>
              <ChevronDown className="w-3 h-3 text-duo-hare" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_4px_0_#e7d9bc] border-2 border-duo-swan p-1.5 z-40 text-sm font-bold animate-pop-in">
                <button
                  onClick={() => {
                    setFilterType('all');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'all' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
                  }`}
                >
                  Tất cả nhiệm vụ ({quests.length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('active');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'active' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
                  }`}
                >
                  Đang diễn ra ({quests.filter((q) => q.status === 'active').length})
                </button>
                <button
                  onClick={() => {
                    setFilterType('completed');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-duo-polar ${
                    filterType === 'completed' ? 'text-duo-green font-black' : 'text-[#4b4b4b]'
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
                <span className="absolute -inset-4 rounded-full bg-duo-green/60 animate-ping opacity-60 pointer-events-none" />


                {/* Biểu tượng Ghim nhiệm vụ màu xanh lá (Khớp chuẩn Ảnh 1) */}
                <div className="relative w-14 h-14 rounded-full bg-duo-green border-4 border-white flex items-center justify-center text-white shadow-[0_6px_0_#134e4a] transition-transform duration-200 group-hover:scale-110 group-active:translate-y-1">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 fill-white text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Nhãn tên nhiệm vụ hình hộp trắng phía dưới (Khớp chuẩn Ảnh 1) */}
                <div className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 bg-white/95 px-4 py-2 rounded-2xl shadow-xl border-2 border-duo-swan whitespace-nowrap text-center transition-all duration-200 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-800">
                  <div className="text-xs font-black text-duo-ink group-hover:text-white flex items-center gap-1.5">
                    <span>{q.title}</span>
                  </div>
                  <div className="text-[10px] text-duo-wolf group-hover:text-emerald-300 font-semibold mt-0.5">
                    {q.objectives.length} ải thử thách • Bấm để mở bản đồ
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hướng dẫn thao tác góc dưới bên trái */}
        <div className="absolute bottom-5 left-5 z-20 bg-white text-duo-ink rounded-2xl p-4 shadow-[0_5px_0_rgba(0,0,0,0.25)] text-xs space-y-1 max-w-sm hidden sm:block">
          <div className="font-black text-xs text-duo-green uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            <span>Hệ thống Bản đồ Nhiệm vụ (Quests)</span>
          </div>
          <div className="text-duo-wolf font-bold text-xs leading-relaxed">
            Bấm vào điểm ghim xanh lá <span className="text-duo-green font-black">"{quests[0].title}"</span> để mở Bản đồ hành trình chi tiết 13 ải thử thách của lớp 7A1.
          </div>
        </div>

        {/* Nút Phóng to toàn màn hình góc dưới bên phải */}
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
          <button
            onClick={() => onShowToast('🔍 Đang bật chế độ toàn cảnh bản đồ.')}
            className="btn-3d btn-white btn-icon !text-duo-wolf"
            title="Toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
