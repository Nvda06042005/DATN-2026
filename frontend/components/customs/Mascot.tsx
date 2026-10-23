import React from 'react';
import type { MascotAccessory, MascotMood } from '@/types/mascotType';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  accessory?: MascotAccessory;
  className?: string;
  /** Nhún nhảy nhẹ liên tục */
  bob?: boolean;
  title?: string;
}

const M_INK = '#134e48';

const M_BODY = '#2bb3a0';

const M_HEAD = '#34c4b0';

const M_SNOUT = '#9be7d9';

const M_GOLD = '#d97706';

const M_RED = '#dc2626';

/**
 * Rồng Con — linh vật của Đông A, lấy cảm hứng từ hình rồng thời Trần.
 * Vẽ thuần SVG để sắc nét ở mọi kích thước; không mô phỏng nhân vật lịch sử có thật.
 */
export const Mascot: React.FC<MascotProps> = ({ size = 120, mood = 'happy', accessory = 'none', className = '', bob = false, title = 'Rồng Con' }) => {
  const eyes = () => {
    switch (mood) {
      case 'excited':
        return (
          <g stroke={M_INK} strokeWidth="6" strokeLinecap="round" fill="none">
            <path d="M66 82 q12 -15 24 0" />
            <path d="M110 82 q12 -15 24 0" />
          </g>
        );
      case 'sleepy':
        return (
          <g stroke={M_INK} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M66 82 q12 8 24 0" />
            <path d="M110 82 q12 8 24 0" />
          </g>
        );
      case 'love':
        return (
          <g fill={M_RED}>
            <path d="M78 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
            <path d="M122 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
          </g>
        );
      default: {
        const dx = mood === 'thinking' ? 4 : 0;
        const dy = mood === 'thinking' ? -4 : mood === 'sad' ? 3 : 0;
        return (
          <g>
            <ellipse cx="78" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <ellipse cx="122" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <circle cx={78 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <circle cx={122 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <circle cx={81 + dx} cy={78 + dy} r="3" fill="#fff" />
            <circle cx={125 + dx} cy={78 + dy} r="3" fill="#fff" />
            {mood === 'sad' && (
              <g stroke={M_INK} strokeWidth="4" strokeLinecap="round">
                <path d="M64 62 l18 6" />
                <path d="M136 62 l-18 6" />
              </g>
            )}
            {mood === 'thinking' && <path d="M110 60 q12 -6 24 2" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />}
          </g>
        );
      }
    }
  };

  const mouth = () => {
    if (mood === 'excited' || mood === 'love')
      return (
        <g>
          <path d="M86 116 q14 18 28 0 z" fill="#7f1d1d" stroke={M_INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M93 121 q7 6 14 0" fill="#fb7185" />
        </g>
      );
    if (mood === 'sad') return <path d="M88 124 q12 -10 24 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
    if (mood === 'sleepy') return <ellipse cx="100" cy="120" rx="5" ry="4" fill={M_INK} />;
    if (mood === 'thinking') return <path d="M90 120 h18" stroke={M_INK} strokeWidth="4" strokeLinecap="round" />;
    return <path d="M86 116 q14 12 28 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
  };

  const showCrest = accessory !== 'helmet' && accessory !== 'conical';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`${bob ? 'animate-pig-bob' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <ellipse cx="100" cy="188" rx="54" ry="8" fill="rgba(0,0,0,0.12)" />
      {/* Đuôi cuộn với ngọn lửa */}
      <path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_BODY} strokeWidth="10" strokeLinecap="round" />
      <path d="M168 112 c-10 -6 -6 -20 4 -24 c-2 8 6 10 8 4 c6 10 0 22 -12 20 z" fill={M_RED} stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Thân */}
      <ellipse cx="100" cy="150" rx="46" ry="36" fill={M_BODY} stroke={M_INK} strokeWidth="4" />
      <ellipse cx="100" cy="157" rx="27" ry="24" fill="#fce7b8" />
      <g stroke="#e3c27f" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M82 146 q18 8 36 0" />
        <path d="M80 158 q20 8 40 0" />
        <path d="M84 170 q16 6 32 0" />
      </g>
      <ellipse cx="74" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <ellipse cx="126" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <path d="M58 138 q-10 10 -4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M58 138 q-10 10 -4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M142 138 q10 10 4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M142 138 q10 10 4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Sừng */}
      {accessory !== 'conical' && (
        <g stroke="#92400e" strokeWidth="3" strokeLinejoin="round" fill={M_GOLD}>
          <path d="M70 46 l-10 -24 l8 2 l2 -10 l8 16 z" />
          <path d="M130 46 l10 -24 l-8 2 l-2 -10 l-8 16 z" />
        </g>
      )}
      {/* Bờm lửa */}
      {showCrest && (
        <g stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M84 40 c-4 -14 6 -24 14 -28 c-2 10 8 12 6 2 c10 8 10 22 2 28 z" fill={M_RED} />
          <path d="M92 38 c0 -8 4 -12 8 -14 c0 6 4 6 4 0 c4 6 2 12 -2 16 z" fill="#f59e0b" stroke="none" />
        </g>
      )}
      {/* Đầu */}
      <ellipse cx="100" cy="84" rx="58" ry="50" fill={M_HEAD} stroke={M_INK} strokeWidth="4" />
      <ellipse cx="100" cy="66" rx="34" ry="14" fill="rgba(255,255,255,0.18)" />
      {/* Mõm & râu */}
      <ellipse cx="100" cy="106" rx="30" ry="18" fill={M_SNOUT} stroke={M_INK} strokeWidth="3" />
      <ellipse cx="91" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <ellipse cx="109" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <g stroke={M_GOLD} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M72 106 c-14 -2 -22 -10 -30 -4" />
        <path d="M128 106 c14 -2 22 -10 30 -4" />
      </g>
      <ellipse cx="58" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      <ellipse cx="142" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      {eyes()}
      {mouth()}
      {mood === 'sad' && <path d="M66 98 q-3 8 0 12 q3 -4 0 -12" fill="#7dd3fc" />}
      {mood === 'sleepy' && (
        <text x="150" y="44" fontSize="22" fontWeight="800" fill={M_INK}>
          z
        </text>
      )}
      {/* Phụ kiện */}
      {accessory === 'helmet' && (
        <g stroke="#78350f" strokeWidth="3" strokeLinejoin="round">
          <path d="M48 62 C52 22 148 22 152 62 Z" fill="#b45309" />
          <path d="M44 62 h112 a6 6 0 0 1 0 10 h-112 a6 6 0 0 1 0 -10 z" fill="#d97706" />
          <path d="M100 26 v-10" stroke="#78350f" strokeWidth="4" />
          <path d="M92 10 c4 -8 12 -8 16 0 c-4 6 -12 6 -16 0 z" fill={M_RED} />
          <path d="M70 52 q30 -22 60 0" fill="none" stroke="#fde68a" strokeWidth="3" opacity="0.7" />
        </g>
      )}
      {accessory === 'conical' && (
        <g strokeLinejoin="round">
          <path d="M34 60 L100 4 L166 60 Q100 74 34 60 Z" fill="#ead39a" stroke="#a07b3a" strokeWidth="3" />
          <g stroke="#c9a85f" strokeWidth="2" fill="none">
            <path d="M58 54 L100 16" />
            <path d="M80 58 L100 12" />
            <path d="M120 58 L100 12" />
            <path d="M142 54 L100 16" />
          </g>
        </g>
      )}
      {accessory === 'crown' && (
        <g stroke="#92400e" strokeWidth="3" strokeLinejoin="round">
          <path d="M66 46 L72 18 L88 34 L100 10 L112 34 L128 18 L134 46 Z" fill="#fbbf24" />
          <circle cx="100" cy="36" r="5" fill={M_RED} />
        </g>
      )}
      {accessory === 'scholar' && (
        <g stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M66 50 C70 24 130 24 134 50 Z" fill="#1f2937" />
          <ellipse cx="54" cy="44" rx="16" ry="6" fill="#1f2937" />
          <ellipse cx="146" cy="44" rx="16" ry="6" fill="#1f2937" />
          <path d="M70 46 h60" stroke="#d97706" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
};
