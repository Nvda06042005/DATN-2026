import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import type { FolderItem } from '@/types/libraryType';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFolder: (folder: FolderItem) => void;
}

const COLOR_OPTIONS = [
  { label: 'Tím Đông A', value: '#115e59' },
  { label: 'Xanh Lam', value: '#1368ce' },
  { label: 'Xanh Lá', value: '#059669' },
  { label: 'Cam Hổ Phách', value: '#d97706' },
  { label: 'Đỏ San Hô', value: '#e11d48' },
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSaveFolder,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0].value);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
      createdAt: 'Hôm nay',
    };

    onSaveFolder(newFolder);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: selectedColor }}
            >
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Tạo thư mục mới</h3>
              <p className="text-[11px] text-duo-wolf">Lưu trữ các bài Quiz và Câu chuyện lịch sử</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Tên thư mục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Lịch sử lớp 7A1 - Kháng chiến 1285"
              className="input-duo w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5">
              Mô tả (Tuỳ chọn)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú ngắn về mục đích hoặc chuyên đề của thư mục..."
              className="input-duo w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4b4b4b] mb-2">
              Màu biểu tượng
            </label>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-7 h-7 rounded-full transition transform ${
                    selectedColor === c.value
                      ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 btn-3d btn-blue btn-normal-case disabled:opacity-50 rounded-xl text-xs font-bold transition"
            >
              Tạo thư mục
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
