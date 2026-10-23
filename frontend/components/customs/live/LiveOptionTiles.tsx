import React from 'react';
import { Check } from 'lucide-react';
import { KahootShape } from '@/components/customs/KahootShape';
import { ANSWER_STYLES } from '@/constants/theme';
import type { LiveKey, LiveQuestion } from '@/types/liveType';
import { sameLiveKey } from '@/utils/live';

/** Bốn ô đáp án trên màn hình trình chiếu (chỉ hiển thị – học sinh bấm trên máy của mình) */
export const LiveOptionTiles: React.FC<{ q: LiveQuestion; correctKey?: LiveKey | null }> = ({ q, correctKey = null }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Các đáp án">
    {q.options.map((o, i) => {
      const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
      const isRight = correctKey !== null && sameLiveKey(o.key, correctKey);
      const dim = correctKey !== null && !isRight;
      return (
        <li
          key={String(o.key)}
          className={`rounded-xl px-5 py-4 flex items-center gap-4 font-black text-lg sm:text-xl transition-opacity ${dim ? 'opacity-40' : ''}`}
          style={{ background: s.bg, color: s.fg, boxShadow: `0 5px 0 ${s.shadow}` }}
        >
          <KahootShape shape={s.shape} size={32} color={s.fg} />
          <span className="flex-1 leading-snug">{o.text}</span>
          {isRight && (
            <>
              <Check className="w-8 h-8 stroke-[4]" aria-hidden="true" />
              <span className="sr-only">(đáp án đúng)</span>
            </>
          )}
        </li>
      );
    })}
  </ul>
);
