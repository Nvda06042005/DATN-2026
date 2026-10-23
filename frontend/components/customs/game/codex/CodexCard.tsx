import React from 'react';
import { Lock, ScrollText } from 'lucide-react';
import type { CodexEntry } from '@/types/learningType';

export const CodexCard: React.FC<{ entry: CodexEntry; unlocked: boolean; onOpen: () => void }> = ({ entry, unlocked, onOpen }) => (
  <button type="button" onClick={onOpen} className={`g-card w-full p-3 text-left flex items-start gap-3 hover:-translate-y-0.5 transition ${unlocked ? '' : 'opacity-75'}`}>
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${unlocked ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>
      {unlocked ? <ScrollText className="w-6 h-6" aria-hidden={true} /> : <Lock className="w-5 h-5" aria-hidden={true} />}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-display font-bold leading-tight">{entry.topic}</span>
      <span className="block text-xs text-muc-2 mt-0.5">{unlocked ? entry.event : 'Trả lời 1 câu về chủ đề này để mở thẻ'}</span>
    </span>
  </button>
);
