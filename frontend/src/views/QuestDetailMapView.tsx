import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Eye,
  Users,
  Home,
  MapPin,
  Flag,
  Check,
  Maximize2,
  ChevronDown,
  Layers,
} from 'lucide-react';
import type { Quest, QuestObjective } from '../types/quest';
import { QuestObjectiveModal } from '../components/QuestObjectiveModal';
import daiVietMapImg from '../assets/dai_viet_campaign_map.jpg';

interface QuestDetailMapViewProps {
  quest: Quest;
  onBackToWorldMap: () => void;
  onShowToast: (msg: string) => void;
}

export const QuestDetailMapView: React.FC<QuestDetailMapViewProps> = ({
  quest,
  onBackToWorldMap,
  onShowToast,
}) => {
  const [objectives, setObjectives] = useState<QuestObjective[]>(quest.objectives);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const handleUpdateObjective = (updated: QuestObjective) => {
    setObjectives((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleAddNewObjective = () => {
    const newId = `obj-${objectives.length + 1}`;
    const lastObj = objectives[objectives.length - 1];
    const newObj: QuestObjective = {
      id: newId,
      title: `Chặng thử thách số ${objectives.length + 1}`,
      shortDescription: 'Ải bí mật mới được giáo viên khởi tạo',
      type: 'checkpoint',
      coords: {
        x: Math.min(85, Math.max(20, lastObj ? lastObj.coords.x + 4 : 50)),
        y: Math.min(85, Math.max(15, lastObj ? lastObj.coords.y - 4 : 50)),
      },
      connections: [],
      rewards: { xp: 50, gp: 20 },
      dueDate: '2026-11-15 16:00',
      storyContent: 'Một thử thách mới bất ngờ xuất hiện giữa hành trình...',
      taskContent: 'Hoàn thành bài tập mở rộng để nhận điểm thưởng.',
      enableAssignments: true,
      enableEarlyReward: false,
      allowDiscussion: true,
      selfPaced: true,
      studentsProgress: lastObj ? lastObj.studentsProgress : [],
    };

    setObjectives((prev) => [...prev, newObj]);
    setSelectedObjectiveId(newId);
    onShowToast(`✨ Đã thêm ải mới: "${newObj.title}"!`);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* ======================================================== */}
      {/* 1. Header Bar trên cùng (Khớp chuẩn Ảnh 2) */}
      {/* ======================================================== */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-2.5 flex items-center justify-between z-30 shadow-2xs shrink-0">
        {/* Left: Nút quay lại + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToWorldMap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs"
            title="Quay lại Bản đồ thế giới"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bản đồ thế giới</span>
          </button>

          <span className="text-slate-300">|</span>

          <span className="text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
            Lớp 7A1
          </span>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate">
            <span className="font-semibold text-slate-600">Nhiệm vụ (Quêtes)</span>
            <span>/</span>
            <span className="font-black text-slate-900 truncate">{quest.title}</span>
          </div>
        </div>

        {/* Right Action Tools: Add node, Edit, Preview, Students count (Khớp ảnh 2) */}
        <div className="flex items-center gap-2">
          {/* Nút thêm ải mới (+) */}
          <button
            onClick={handleAddNewObjective}
            className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shadow-xs"
            title="Thêm ải thử thách mới"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Nút Chỉnh sửa (Bút chì) */}
          <button
            onClick={() => onShowToast('✏️ Chế độ chỉnh sửa hành trình đang hoạt động.')}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
            title="Chỉnh sửa lộ trình"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Nút Xem trước (Con mắt) */}
          <button
            onClick={() => {
              setIsPreviewMode(!isPreviewMode);
              onShowToast(
                !isPreviewMode
                  ? '👁️ Đang xem trước theo góc nhìn của Học sinh.'
                  : '👨‍🏫 Đã trở về góc nhìn Giảng viên điều phối.'
              );
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              isPreviewMode
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Xem trước như học sinh"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isPreviewMode ? 'Góc nhìn Học sinh' : 'Xem trước'}
            </span>
          </button>

          {/* Dropdown Học sinh: (2) hoặc 35 học sinh */}
          <button
            onClick={() => onShowToast('👥 Lớp 7A1: 35 học sinh đang tham gia cuộc thám hiểm.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>(35)</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Canvas: Bản đồ cận cảnh + Đường nối các Ải (Khớp Ảnh 2) */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-slate-950">
        {/* Background Artwork Đại Việt Campaign Map */}
        <img
          src={daiVietMapImg}
          alt="Sa bàn Chiến dịch Đại Việt"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-95"
        />

        {/* Subtle Map Atmosphere Overlay */}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/40 pointer-events-none" />

        {/* SVG Path Layer (Vẽ các đường đứt nét nối các ải như ảnh 2) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.95" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Vẽ từng đường nối giữa 2 ải liên tiếp */}
          {objectives.map((obj, i) => {
            const next = objectives[i + 1];
            if (!next) return null;

            return (
              <g key={`path-${obj.id}-${next.id}`}>
                {/* Đường bóng mờ phát sáng */}
                <line
                  x1={`${obj.coords.x}%`}
                  y1={`${obj.coords.y}%`}
                  x2={`${next.coords.x}%`}
                  y2={`${next.coords.y}%`}
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeOpacity="0.3"
                  strokeLinecap="round"
                />
                {/* Đường nối chính màu trắng sáng */}
                <line
                  x1={`${obj.coords.x}%`}
                  y1={`${obj.coords.y}%`}
                  x2={`${next.coords.x}%`}
                  y2={`${next.coords.y}%`}
                  stroke="url(#pathGradient)"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                {/* Dấu tick nhỏ ở giữa đoạn nối (giống ảnh 2) */}
                <circle
                  cx={`${(obj.coords.x + next.coords.x) / 2}%`}
                  cy={`${(obj.coords.y + next.coords.y) / 2}%`}
                  r="5"
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        {/* Các nút ải thử thách (Nodes) trên bản đồ (Khớp chuẩn ảnh 2) */}
        <div className="absolute inset-0 z-20 pointer-events-auto">
          {objectives.map((obj, index) => {
            const isCompleted = index < 4; // Mẫu 4 ải đầu đã hoàn thành
            const isCurrent = index === 4; // Ải đang làm dở
            const isHovered = hoveredNodeId === obj.id;

            return (
              <div
                key={obj.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300"
                style={{ left: `${obj.coords.x}%`, top: `${obj.coords.y}%` }}
                onMouseEnter={() => setHoveredNodeId(obj.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => setSelectedObjectiveId(obj.id)}
              >
                {/* Hiệu ứng xung nhịp (Pulse) nếu là ải hiện tại */}
                {isCurrent && (
                  <span className="absolute -inset-3 rounded-full bg-emerald-400 animate-ping opacity-60 pointer-events-none" />
                )}

                {/* Vòng tròn Icon Ải (Khớp chuẩn viền xanh lá & icon trắng như ảnh 2) */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-[2.5px] border-white flex items-center justify-center shadow-xl transition-transform duration-200 group-hover:scale-125 ${
                    obj.type === 'start'
                      ? 'bg-emerald-600 text-white'
                      : obj.type === 'boss'
                      ? 'bg-amber-500 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#10b981] text-white'
                  }`}
                >
                  {obj.type === 'start' ? (
                    <Home className="w-4 h-4 stroke-[2.5]" />
                  ) : obj.type === 'boss' ? (
                    <Flag className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <MapPin className="w-4 h-4 stroke-[2.5]" />
                  )}
                </div>

                {/* Dấu Checkmark xanh nhỏ gắn góc phải nếu ải đã xong */}
                {isCompleted && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-emerald-600 border border-emerald-500 flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}

                {/* Nhãn tên ải phía dưới nút (Badge hiển thị như ảnh 2) */}
                <div
                  className={`absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap shadow-md transition-all duration-150 pointer-events-none ${
                    isHovered
                      ? 'bg-slate-900 text-white scale-110 z-30'
                      : 'bg-white/95 text-slate-800 border border-slate-200/80'
                  }`}
                >
                  <span>{obj.title}</span>
                  {isHovered && (
                    <div className="text-[9px] text-emerald-400 font-bold block">
                      +{obj.rewards.xp} XP • Bấm để quản lý
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Quick Legend ở góc dưới bên trái */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-950/85 backdrop-blur-md border border-amber-500/40 text-white rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 max-w-sm hidden sm:block">
          <div className="font-black text-[11px] text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Sa bàn: 3 Lần Kháng Chiến Chống Mông - Nguyên (1258 - 1288)</span>
          </div>
          <div className="text-[11px] text-slate-300 leading-relaxed">
            • 13 ải lịch sử liên hoàn: Lời thề Sát Thát, Vườn không nhà trống, Tiếng hô Diên Hồng, Hàm Tử, Chương Dương & Đại thắng Bạch Đằng.
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            • Bấm trực tiếp vào từng ải để duyệt điểm và quản lý tiến độ 35 học sinh lớp 7A1.
          </div>
        </div>

        {/* Nút toàn màn hình ở góc dưới bên phải */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => onShowToast('🔍 Đang bật chế độ toàn màn hình bản đồ.')}
            className="w-9 h-9 rounded-xl bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-lg transition"
            title="Toàn màn hình"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Modal Quản lý Chi tiết Ải (Level 3 - Khớp Ảnh 3, 4, 5) */}
      {/* ======================================================== */}
      {selectedObjectiveId && (
        <QuestObjectiveModal
          isOpen={true}
          onClose={() => setSelectedObjectiveId(null)}
          questTitle={quest.title}
          objectives={objectives}
          currentObjectiveId={selectedObjectiveId}
          onSelectObjective={(id) => setSelectedObjectiveId(id)}
          onUpdateObjective={handleUpdateObjective}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
