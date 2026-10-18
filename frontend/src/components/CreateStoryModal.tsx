import React, { useState } from 'react';
import { X, BookOpen, Clock, Folder } from 'lucide-react';
import type { StoryItem, FolderItem } from '../types/library';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveStory: (story: StoryItem) => void;
}

const SAMPLE_THUMBNAILS = [
  { label: 'Trần Quốc Toản', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80' },
  { label: 'Điện Diên Hồng', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=400&q=80' },
  { label: 'Bạch Đằng giang', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80' },
  { label: 'Thành Thăng Long', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80' },
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId,
  onSaveStory,
}) => {
  const [title, setTitle] = useState('');
  const [readingTime, setReadingTime] = useState('1 phút đọc');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || '');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [thumbnail, setThumbnail] = useState(SAMPLE_THUMBNAILS[0].url);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newStory: StoryItem = {
      id: `story-${Date.now()}`,
      title: title.trim(),
      readingTime,
      status,
      folderId: selectedFolderId || null,
      thumbnail,
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      summary: summary.trim() || 'Tóm tắt câu chuyện lịch sử...',
      content: content.trim() || summary.trim() || 'Nội dung câu chuyện đang được cập nhật.',
      tags: ['Lịch sử 7', 'GDPT 2018'],
    };

    onSaveStory(newStory);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-[#46178f]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Tạo câu chuyện mới</h3>
              <p className="text-[11px] text-slate-500">Kể lại câu chuyện lịch sử sinh động cho học sinh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tiêu đề câu chuyện <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Quả cam vua ban và lá cờ thêu sáu chữ vàng"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 focus:border-[#46178f] transition"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Thời gian đọc
              </label>
              <select
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 transition"
              >
                <option value="1 phút đọc">1 phút đọc</option>
                <option value="2 phút đọc">2 phút đọc</option>
                <option value="3 phút đọc">3 phút đọc</option>
                <option value="5 phút đọc">5 phút đọc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                Lưu vào thư mục
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 transition"
              >
                <option value="">-- Chưa phân loại --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ảnh minh họa
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SAMPLE_THUMBNAILS.map((img) => (
                <div
                  key={img.url}
                  onClick={() => setThumbnail(img.url)}
                  className={`relative rounded-xl overflow-hidden cursor-pointer border-2 aspect-video transition ${
                    thumbnail === img.url
                      ? 'border-[#46178f] ring-2 ring-purple-300'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate">
                    {img.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tóm tắt ngắn (1-2 câu)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="VD: Hoài Văn Hầu vì tuổi nhỏ không được vào dự bàn việc quân, uất ức bóp nát quả cam..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nội dung chi tiết câu chuyện
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung câu chuyện lịch sử tại đây..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
              <button
                type="button"
                onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}
                className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${
                  status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-5 py-2 bg-[#1368ce] hover:bg-[#0f52a5] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition"
              >
                Lưu câu chuyện
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
