import React from 'react';
import { X, Clock, BookOpen, User, Tag } from 'lucide-react';
import type { StoryItem } from '../types/library';

interface StoryReaderModalProps {
  story: StoryItem | null;
  onClose: () => void;
}

export const StoryReaderModal: React.FC<StoryReaderModalProps> = ({ story, onClose }) => {
  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col">
        {/* Header Cover Banner */}
        <div className="relative h-48 sm:h-56 w-full bg-slate-900 shrink-0">
          <img
            src={story.thumbnail}
            alt={story.title}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition backdrop-blur-xs"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badges on cover */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="bg-purple-900/80 backdrop-blur-xs text-purple-200 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 border border-purple-500/30">
              <BookOpen className="w-3.5 h-3.5 text-purple-300" />
              Câu chuyện lịch sử
            </span>
            <span className="bg-black/70 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              {story.readingTime}
            </span>
          </div>

          {/* Title on cover */}
          <div className="absolute bottom-4 inset-x-6 text-white">
            <h2 className="text-xl font-extrabold tracking-tight leading-snug drop-shadow-md">
              {story.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {story.author}
              </span>
              <span>•</span>
              <span>{story.updatedAt}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-5">
          {/* Summary Box */}
          {story.summary && (
            <div className="p-4 bg-purple-50/70 border border-purple-200/60 rounded-xl text-xs text-purple-950 font-medium leading-relaxed italic">
              "{story.summary}"
            </div>
          )}

          {/* Full Content */}
          <div className="text-slate-700 text-sm leading-relaxed space-y-4 whitespace-pre-line font-serif">
            {story.content}
          </div>

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                <Tag className="w-3 h-3" /> Chủ đề:
              </span>
              {story.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">Học liệu GDPT 2018 • Đông A EDU</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#46178f] hover:bg-[#381075] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
