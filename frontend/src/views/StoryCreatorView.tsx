import React, { useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Video,
  Volume2,
  Code2,
  Plus,
  Trash2,
  Copy,
  Maximize2,
  Minimize2,
  MoreVertical,
  Eye,
  Settings,
  ChevronLeft,
  Check,
  X,
  Music,
  Sparkles,
} from 'lucide-react';
import type { StoryItem, StoryBlock, StoryBlockType, FolderItem } from '../types/library';
import { API_BASE_URL } from '../config/api';

interface StoryCreatorViewProps {
  initialStory?: StoryItem | null;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveStory: (story: StoryItem) => void;
  onExit: () => void;
  onShowToast: (msg: string) => void;
}

const HISTORICAL_SAMPLE_IMAGES = [
  { label: 'Trần Quốc Toản', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=800&q=80' },
  { label: 'Điện Diên Hồng', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80' },
  { label: 'Bạch Đằng giang', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80' },
  { label: 'Kinh thành Thăng Long', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80' },
];

export const StoryCreatorView: React.FC<StoryCreatorViewProps> = ({
  initialStory,
  folders,
  defaultFolderId,
  onSaveStory,
  onExit,
  onShowToast,
}) => {
  // Title & Basic Info
  const [title, setTitle] = useState(initialStory?.title || '');
  const [readingTime, setReadingTime] = useState(initialStory?.readingTime || '1 phút đọc');
  const [folderId, setFolderId] = useState<string | null>(initialStory?.folderId || defaultFolderId || null);

  // Blocks
  const [blocks, setBlocks] = useState<StoryBlock[]>(
    initialStory?.blocks && initialStory.blocks.length > 0
      ? initialStory.blocks
      : []
  );

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeBlockMenuPopup, setActiveBlockMenuPopup] = useState<string | null>(null);

  // AI Story Generator States
  const [isAiStoryModalOpen, setIsAiStoryModalOpen] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [aiCampaignName, setAiCampaignName] = useState('Kháng chiến chống Mông - Nguyên');
  const [aiStageTitle, setAiStageTitle] = useState('Hội nghị Diên Hồng');
  const [aiKeyEvent, setAiKeyEvent] = useState('Thượng hoàng hỏi kế sách, các bô lão đồng thanh hô vang ĐÁNH');

  const handleGenerateAiStory = async (stage = aiStageTitle, event = aiKeyEvent, campaign = aiCampaignName) => {
    setIsGeneratingStory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: campaign,
          stage_title: stage,
          key_event: event,
        }),
      });

      if (!response.ok) throw new Error(`Lỗi phản hồi máy chủ: ${response.status}`);
      const data = await response.json();

      if (!title.trim()) {
        setTitle(`Hào Khí Đông A: ${stage}`);
      }

      const narrativeBlock: StoryBlock = {
        id: `block-${Date.now()}-narrative`,
        type: 'text',
        width: 'normal',
        content: data.story_narrative || '',
      };

      const sampleImg = HISTORICAL_SAMPLE_IMAGES.find((img) =>
        stage.toLowerCase().includes(img.label.toLowerCase()) ||
        img.label.toLowerCase().includes(stage.toLowerCase())
      ) || HISTORICAL_SAMPLE_IMAGES[0];

      const imgBlock: StoryBlock = {
        id: `block-${Date.now() + 1}-img`,
        type: 'image',
        width: 'normal',
        mediaUrl: sampleImg.url,
        caption: `Tư liệu sử sách: ${data.historical_fact || stage}`,
      };

      const challengeBlock: StoryBlock = {
        id: `block-${Date.now() + 2}-challenge`,
        type: 'text',
        width: 'normal',
        content: `⚔️ THỬ THÁCH SỬ HỌC:\n${data.challenge_question || 'Hãy giải mã chiến lược của tiền nhân tại ải này!'}`,
      };

      setBlocks((prev) => [...prev, narrativeBlock, imgBlock, challengeBlock]);
      setIsAiStoryModalOpen(false);
      onShowToast(`✨ Đã kiến tạo thành công cốt truyện AI cho "${stage}"!`);
    } catch (err) {
      console.warn('Lỗi gọi API AI Story:', err);
      if (!title.trim()) {
        setTitle(`Hào Khí Đông A: ${stage}`);
      }
      const fallbackBlock: StoryBlock = {
        id: `block-${Date.now()}-fallback`,
        type: 'text',
        width: 'normal',
        content: `Đoàn quân Đại Việt tiến đến khu vực ${stage}. Tiếng trống đồng âm vang trong sương sớm, ngọn cờ thêu sáu chữ vàng phất phới bay theo chiều gió. Các bô lão và tướng sĩ một lòng sát cánh, quyết bảo vệ từng tấc đất thiêng liêng của Tổ quốc!`,
      };
      setBlocks((prev) => [...prev, fallbackBlock]);
      setIsAiStoryModalOpen(false);
      onShowToast(`✨ Đã nạp cốt truyện sử liệu cho "${stage}"!`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Add Block Handler
  const handleAddBlock = (type: StoryBlockType, insertAfterIndex?: number) => {
    const newBlock: StoryBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      width: 'normal',
      content: type === 'text' ? '' : undefined,
      mediaUrl: undefined,
      caption: '',
      embedUrl: type === 'embed' ? '' : undefined,
    };

    if (insertAfterIndex !== undefined && insertAfterIndex >= 0) {
      setBlocks((prev) => [
        ...prev.slice(0, insertAfterIndex + 1),
        newBlock,
        ...prev.slice(insertAfterIndex + 1),
      ]);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }

    setActiveBlockId(newBlock.id);
    setIsBlockMenuOpen(false);
    onShowToast(`➕ Đã thêm khối: ${getBlockTypeName(type)}`);
  };

  const updateBlock = (id: string, partial: Partial<StoryBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setActiveBlockMenuPopup(null);
    onShowToast('🗑️ Đã xoá khối');
  };

  const duplicateBlock = (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    const cloned: StoryBlock = {
      ...target,
      id: `block-${Date.now()}`,
    };
    const idx = blocks.findIndex((b) => b.id === id);
    setBlocks((prev) => [...prev.slice(0, idx + 1), cloned, ...prev.slice(idx + 1)]);
    setActiveBlockMenuPopup(null);
    onShowToast('📋 Đã nhân bản khối');
  };

  const getBlockTypeName = (type: StoryBlockType) => {
    switch (type) {
      case 'text':
        return 'Văn bản';
      case 'image':
        return 'Hình ảnh';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Âm thanh';
      case 'embed':
        return 'Nhúng';
    }
  };

  const handleSave = () => {
    // Generate text summary & content from blocks
    const textBlocks = blocks.filter((b) => b.type === 'text' && b.content);
    const fullText = textBlocks.map((b) => b.content).join('\n\n');
    const firstImg = blocks.find((b) => b.type === 'image' && b.mediaUrl)?.mediaUrl;

    const readyStory: StoryItem = {
      id: initialStory?.id || `story-${Date.now()}`,
      title: title.trim() || 'Câu chuyện lịch sử không tên',
      readingTime,
      status: 'published',
      folderId,
      thumbnail:
        firstImg ||
        initialStory?.thumbnail ||
        'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      summary: fullText.slice(0, 150) || 'Câu chuyện kể về bài học lịch sử Hào khí Đông A.',
      content: fullText || 'Nội dung câu chuyện...',
      blocks,
      tags: ['Lịch sử 7', 'Hào khí Đông A'],
    };

    onSaveStory(readyStory);
    onShowToast(`💾 Đã lưu câu chuyện: "${readyStory.title}"`);
    onExit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#2e2e2e] text-slate-100 font-sans select-none overflow-hidden animate-in fade-in duration-150"
      onClick={() => {
        setActiveBlockMenuPopup(null);
      }}
    >
      {/* ======================================================== */}
      {/* 1. Header trên cùng (Khớp chuẩn Ảnh 3 & 5) */}
      {/* ======================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 z-20 text-slate-800 shadow-xs">
        {/* Left: Brand + Back button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#46178f] text-white px-2.5 py-1 rounded-lg font-black text-xs tracking-tight shadow-2xs">
            <span>Đông A</span>
            <span className="bg-[#ff3355] text-[9px] px-1 py-0.2 rounded font-bold uppercase">
              EDU
            </span>
          </div>

          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        </div>

        {/* Center: Title Input + Character count + Auto-saved status (Khớp ảnh 3, 5) */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thêm tên câu chuyện"
              maxLength={100}
              className="w-full px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
              {100 - title.length}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã tự động lưu</span>
          </div>
        </div>

        {/* Right: Settings + Preview + Save button (Khớp ảnh 3, 5) */}
        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => {
              if (folders.length > 0) {
                const nextIdx = (folders.findIndex((f) => f.id === folderId) + 1) % (folders.length + 1);
                const nextFolder = nextIdx < folders.length ? folders[nextIdx] : null;
                setFolderId(nextFolder ? nextFolder.id : null);
                onShowToast(nextFolder ? `📁 Đã lưu vào thư mục: ${nextFolder.name}` : '📁 Lưu vào Thư viện chung');
              } else {
                const times = ['1 phút đọc', '2 phút đọc', '3 phút đọc', '5 phút đọc'];
                const nextTime = times[(times.indexOf(readingTime) + 1) % times.length];
                setReadingTime(nextTime);
                onShowToast(`⏱️ Đã đặt thời gian đọc: ${nextTime}`);
              }
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title={`Cài đặt thư mục & thời gian đọc`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Nút Tạo cốt truyện bằng AI Đông A */}
          <button
            onClick={() => setIsAiStoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs active:scale-95 transition"
            title="Sinh cốt truyện lịch sử tương tác bằng AI Đông A"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>AI Cốt Truyện</span>
          </button>

          {/* Preview button */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Xem trước câu chuyện"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Save button (Xanh dương như ảnh 3, 5) */}
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            Lưu
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Content Canvas (Nền tối #2e2e2e chuẩn Ảnh 3, 4, 5) */}
      {/* ======================================================== */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Nút vuông màu xanh dương [+] cố định bên trái (Khớp chuẩn Ảnh 3, 5) */}
        <div className="absolute left-4 top-8 z-30 flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsBlockMenuOpen(!isBlockMenuOpen);
            }}
            className="w-8 h-8 rounded-lg bg-[#1368ce] hover:bg-[#0f52a5] text-white flex items-center justify-center shadow-lg active:scale-95 transition"
            title="Thêm khối câu chuyện"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Menu trôi nổi "Thêm khối câu chuyện" (Khớp chuẩn Ảnh 3, 5) */}
          {isBlockMenuOpen && (
            <div
              className="w-48 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2.5 text-slate-800 space-y-1 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-2 py-1">
                Thêm khối câu chuyện
              </h4>

              {/* 1. Văn bản */}
              <button
                onClick={() => handleAddBlock('text')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <span>Văn bản</span>
              </button>

              {/* 2. Hình ảnh */}
              <button
                onClick={() => handleAddBlock('image')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#1368ce] text-white flex items-center justify-center">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <span>Hình ảnh</span>
              </button>

              {/* 3. Video */}
              <button
                onClick={() => handleAddBlock('video')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#e21b3c] text-white flex items-center justify-center">
                  <Video className="w-3.5 h-3.5" />
                </div>
                <span>Video</span>
              </button>

              {/* 4. Âm thanh */}
              <button
                onClick={() => handleAddBlock('audio')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#26890c] text-white flex items-center justify-center">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <span>Âm thanh</span>
              </button>

              {/* 5. Nhúng */}
              <button
                onClick={() => handleAddBlock('embed')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <div className="w-6 h-6 rounded-md bg-[#f77f00] text-white flex items-center justify-center">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <span>Nhúng</span>
              </button>
            </div>
          )}
        </div>

        {/* Khung cuộn nội dung câu chuyện chính (Canvas) */}
        <div className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center">
          {/* ======================================================== */}
          {/* TRƯỜNG HỢP A: Khi chưa có khối nào (Khớp chuẩn Ảnh 3) */}
          {/* ======================================================== */}
          {blocks.length === 0 ? (
            <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-slate-800 text-center my-auto animate-in fade-in duration-200">
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto mb-8 leading-relaxed">
                Bắt đầu thêm các khối nội dung như văn bản, hình ảnh hoặc video để kể một câu chuyện cho khán giả.
              </p>

              {/* Lưới 5 thẻ chọn khối lớn (Khớp chuẩn Ảnh 3) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                {/* 1. Văn bản */}
                <button
                  onClick={() => handleAddBlock('text')}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-105 transition">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">Văn bản</span>
                </button>

                {/* 2. Hình ảnh */}
                <button
                  onClick={() => handleAddBlock('image')}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#1368ce] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">Hình ảnh</span>
                </button>

                {/* 3. Video */}
                <button
                  onClick={() => handleAddBlock('video')}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#e21b3c] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">Video</span>
                </button>

                {/* 4. Âm thanh */}
                <button
                  onClick={() => handleAddBlock('audio')}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#26890c] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">Âm thanh</span>
                </button>

                {/* 5. Nhúng */}
                <button
                  onClick={() => handleAddBlock('embed')}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-12 h-10 rounded-xl bg-[#f77f00] text-white flex items-center justify-center group-hover:scale-105 transition">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">Nhúng</span>
                </button>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* TRƯỜNG HỢP B: Danh sách các khối đã chèn (Khớp Ảnh 4 & 5) */
            /* ======================================================== */
            <div className="w-full max-w-3xl space-y-6">
              {blocks.map((block, idx) => {
                const isActive = block.id === activeBlockId;

                return (
                  <div
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBlockId(block.id);
                    }}
                    className={`relative rounded-2xl transition group flex items-start gap-3 ${
                      isActive ? 'ring-2 ring-[#1368ce]' : ''
                    }`}
                  >
                    {/* Thân Khối (Block Body) */}
                    <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden text-slate-800 border border-slate-200/80">
                      {/* Drag Handle trên đầu khối (Khớp ảnh 4) */}
                      <div className="h-5 flex items-center justify-center bg-slate-50/50 cursor-grab text-slate-300 hover:text-slate-500">
                        <span className="text-xs tracking-widest font-black leading-none">=</span>
                      </div>

                      {/* ======================================================== */}
                      {/* KHỐI 1: VĂN BẢN (Text - Khớp Ảnh 4 & 5) */}
                      {/* ======================================================== */}
                      {block.type === 'text' && (
                        <div className="p-5">
                          <textarea
                            value={block.content || ''}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                            placeholder="Nhập câu chuyện"
                            rows={3}
                            className="w-full bg-transparent border-none resize-none text-sm md:text-base font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                            autoFocus={isActive}
                          />
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 2: HÌNH ẢNH (Image - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'image' && (
                        <div className="p-6 flex flex-col items-center justify-center">
                          {block.mediaUrl ? (
                            <div className="relative w-full rounded-xl overflow-hidden group/img">
                              <img
                                src={block.mediaUrl}
                                alt="Ảnh câu chuyện"
                                className="w-full max-h-80 object-cover rounded-xl"
                              />
                              <button
                                onClick={() => updateBlock(block.id, { mediaUrl: undefined })}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-3 py-4 w-full">
                              <ImageIcon className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                              <button
                                onClick={() => {
                                  const sample =
                                    HISTORICAL_SAMPLE_IMAGES[
                                      Math.floor(Math.random() * HISTORICAL_SAMPLE_IMAGES.length)
                                    ];
                                  updateBlock(block.id, { mediaUrl: sample.url, caption: sample.label });
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>Thêm ảnh</span>
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={block.caption || ''}
                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                            placeholder="Chú thích ảnh (tuỳ chọn)..."
                            className="w-full mt-2 text-center text-xs text-slate-500 italic bg-transparent border-none focus:outline-none"
                          />
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 3: ÂM THANH (Audio - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'audio' && (
                        <div className="p-6 flex flex-col items-center justify-center gap-3">
                          <Volume2 className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                          {block.mediaUrl ? (
                            <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Music className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-bold text-slate-800">
                                  {block.caption || 'Thuyết minh Hào khí Đông A.mp3'}
                                </span>
                              </div>
                              <button
                                onClick={() => updateBlock(block.id, { mediaUrl: undefined })}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                updateBlock(block.id, {
                                  mediaUrl:
                                    'https://assets.mixkit.co/music/preview/mixkit-epic-heroic-cinematic-trailer-988.mp3',
                                  caption: 'Hào khí Đông A - Tiếng trống trận Diên Hồng',
                                });
                                onShowToast('🎵 Đã thêm đoạn âm thanh sử liệu mẫu!');
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-xs font-bold transition shadow-xs"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                              <span>Thêm</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 4: VIDEO (Video) */}
                      {/* ======================================================== */}
                      {block.type === 'video' && (
                        <div className="p-6 flex flex-col items-center justify-center gap-3">
                          <Video className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                          <button
                            onClick={() => {
                              updateBlock(block.id, {
                                mediaUrl: 'https://www.youtube.com/embed/sample',
                                caption: 'Phim tư liệu: 3 lần kháng chiến chống Nguyên Mông',
                              });
                              onShowToast('🎬 Đã liên kết video tư liệu lịch sử!');
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>Thêm video</span>
                          </button>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* KHỐI 5: NỘI DUNG NHÚNG (Embed - Khớp Ảnh 5) */}
                      {/* ======================================================== */}
                      {block.type === 'embed' && (
                        <div className="p-6 text-center space-y-3">
                          <span className="text-xs font-extrabold text-slate-700 block">
                            Nội dung nhúng
                          </span>

                          {/* Logo K! / Đông A EDU (Khớp ảnh 5) */}
                          <div className="text-2xl font-black text-[#46178f]">K!</div>

                          <div className="flex items-center gap-2 max-w-md mx-auto">
                            <input
                              type="text"
                              value={block.embedUrl || ''}
                              onChange={(e) => updateBlock(block.id, { embedUrl: e.target.value })}
                              placeholder="Dán link dẫn đến nội dung"
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => onShowToast('🔗 Đã xác nhận liên kết nhúng!')}
                              className="w-8 h-8 rounded-lg bg-[#1368ce] text-white flex items-center justify-center shrink-0 hover:bg-[#0f52a5] transition"
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </button>
                            <span className="text-xs text-slate-400 font-medium">hoặc</span>
                            <button
                              onClick={() => onShowToast('🌐 Mở danh mục học liệu số liên kết.')}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition whitespace-nowrap"
                            >
                              Khám phá nội dung
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Thanh công cụ dọc nổi bên phải của khối (Khớp chuẩn Ảnh 4) */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {/* Nút 1: 3 Chấm (Menu: Xoá, Nhân bản) */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveBlockMenuPopup(activeBlockMenuPopup === block.id ? null : block.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition shadow-xs"
                          title="Tuỳ chọn"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Popup dropdown */}
                        {activeBlockMenuPopup === block.id && (
                          <div
                            className="absolute left-8 top-0 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 text-xs text-slate-700 animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => duplicateBlock(block.id)}
                              className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 font-bold"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Nhân bản</span>
                            </button>
                            <button
                              onClick={() => removeBlock(block.id)}
                              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xoá khối</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Nút 2: Độ rộng (Mở rộng / Thu nhỏ) */}
                      <button
                        onClick={() =>
                          updateBlock(block.id, {
                            width: block.width === 'wide' ? 'normal' : 'wide',
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition shadow-xs"
                        title="Độ rộng khối"
                      >
                        {block.width === 'wide' ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Nút 3: Thêm khối bên dưới [+] */}
                      <button
                        onClick={() => handleAddBlock('text', idx)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition shadow-xs"
                        title="Thêm khối bên dưới"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal AI Soạn Cốt Truyện Đông A */}
      {isAiStoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Trợ lý AI Soạn Cốt Truyện Đông A</h3>
                  <p className="text-[11px] text-indigo-200">
                    Tự động tạo mạch truyện, hình ảnh & câu hỏi thử thách từ dữ liệu vàng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiStoryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên Chiến dịch:</label>
                <input
                  type="text"
                  value={aiCampaignName}
                  onChange={(e) => setAiCampaignName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên Ải / Địa danh lịch sử:</label>
                <input
                  type="text"
                  value={aiStageTitle}
                  onChange={(e) => setAiStageTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-600/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sự kiện lịch sử then chốt:</label>
                <textarea
                  value={aiKeyEvent}
                  onChange={(e) => setAiKeyEvent(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-600/20 resize-none"
                />
              </div>

              {/* Gợi ý chặng nhanh */}
              <div>
                <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1.5">
                  Chọn nhanh sự kiện tiêu biểu:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { stage: 'Hội nghị Diên Hồng (1285)', event: 'Thượng hoàng hỏi đánh hay hòa, các bô lão đồng thanh hô vang ĐÁNH!' },
                    { stage: 'Trận cọc Bạch Đằng (1288)', event: 'Bố trí cọc ngầm lim nhử thủy quân Ô Mã Nhi khi triều rút' },
                    { stage: 'Phục kích Vân Đồn (1288)', event: 'Trần Khánh Dư đánh chìm đoàn 17 vạn thạch thuyền lương Trương Văn Hổ' },
                    { stage: 'Vườn không nhà trống (1258)', event: 'Triệt thoái kinh thành Thăng Long khiến giặc rơi vào cảnh đói kiệt' },
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        setAiStageTitle(preset.stage);
                        setAiKeyEvent(preset.event);
                      }}
                      className="text-left p-2 rounded-xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 text-slate-700 transition"
                    >
                      <strong className="block text-slate-900 font-bold truncate">{preset.stage}</strong>
                      <span className="text-[10px] text-slate-500 line-clamp-1">{preset.event}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAiStoryModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                onClick={() => handleGenerateAiStory()}
                disabled={isGeneratingStory}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingStory ? 'animate-spin' : ''}`} />
                <span>{isGeneratingStory ? 'Đang tạo cốt truyện...' : 'Tạo cốt truyện'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem trước (Preview câu chuyện) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] text-slate-800">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-700">Xem trước câu chuyện</span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-5">
              <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
                {title || 'Tiêu đề câu chuyện'}
              </h2>
              {blocks.map((b) => (
                <div key={b.id}>
                  {b.type === 'text' && (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-serif">
                      {b.content}
                    </p>
                  )}
                  {b.type === 'image' && b.mediaUrl && (
                    <div className="my-2">
                      <img src={b.mediaUrl} alt="" className="rounded-xl w-full max-h-72 object-cover" />
                      {b.caption && (
                        <p className="text-xs text-center text-slate-500 mt-1">{b.caption}</p>
                      )}
                    </div>
                  )}
                  {b.type === 'audio' && b.mediaUrl && (
                    <div className="p-3 bg-slate-100 rounded-xl flex items-center gap-2">
                      <Music className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold">{b.caption}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
