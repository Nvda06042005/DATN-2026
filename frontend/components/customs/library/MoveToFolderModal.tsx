import React, { useState } from 'react';
import { Check, Folder, X } from 'lucide-react';
import type { FolderItem } from '@/types/libraryType';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  itemType: 'quiz' | 'story';
  folders: FolderItem[];
  currentFolderId?: string | null;
  onMoveToFolder: (folderId: string | null) => void;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  itemTitle,
  itemType,
  folders,
  currentFolderId,
  onMoveToFolder,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-duo-swan flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-duo-blue">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-duo-ink">Chuyển vào thư mục</h3>
              <p className="text-[11px] text-duo-wolf truncate max-w-[240px]">
                {itemType === 'quiz' ? 'Quiz: ' : 'Câu chuyện: '} {itemTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-duo-hare hover:text-slate-700 hover:bg-duo-polar transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Folder List */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {/* Option: Không thuộc thư mục nào */}
          <div
            onClick={() => setSelectedFolderId(null)}
            className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
              selectedFolderId === null
                ? 'border-blue-500 bg-blue-50/60'
                : 'border-duo-swan hover:bg-duo-polar'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-duo-wolf">
                <Folder className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-duo-ink">Không đưa vào thư mục (Chung)</span>
            </div>
            {selectedFolderId === null && <Check className="w-4 h-4 text-duo-blue" />}
          </div>

          {/* List of folders */}
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-duo-swan hover:bg-duo-polar'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: folder.color }}
                  >
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-duo-ink">{folder.name}</h4>
                    {folder.description && (
                      <p className="text-[10px] text-duo-hare truncate max-w-[200px]">
                        {folder.description}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-duo-blue" />}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-duo-polar border-t-2 border-duo-swan flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-outline btn-normal-case !text-duo-wolf"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onMoveToFolder(selectedFolderId);
              onClose();
            }}
            className="px-5 py-2 btn-3d btn-blue btn-normal-case rounded-xl text-xs font-bold transition"
          >
            Xác nhận chuyển
          </button>
        </div>
      </div>
    </div>
  );
};
