import React from 'react';

// 1. Icon Lộ trình / Bài học (Bản đồ xanh lá & mốc định vị)
export const LearnMapIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 8.5L9.5 5.5L18.5 8.5L24 5.5V20.5L18.5 23.5L9.5 20.5L4 23.5V8.5Z"
      fill="#22c55e"
    />
    <path
      d="M9.5 5.5V20.5M18.5 8.5V23.5"
      stroke="#15803d"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M4 8.5L9.5 5.5L18.5 8.5L24 5.5V20.5L18.5 23.5L9.5 20.5L4 23.5V8.5Z"
      stroke="#16a34a"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="14" cy="13.5" r="3.2" fill="#ffffff" stroke="#15803d" strokeWidth="1.5" />
    <circle cx="14" cy="13.5" r="1.3" fill="#15803d" />
  </svg>
);

// 2. Icon Nhiệm vụ (Rương kho báu vàng Quests)
export const QuestChestIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="11" width="20" height="12" rx="2" fill="#d97706" stroke="#b45309" strokeWidth="1.5" />
    <path
      d="M3.5 11C3.5 7.5 6.5 5.5 14 5.5C21.5 5.5 24.5 7.5 24.5 11H3.5Z"
      fill="#fbbf24"
      stroke="#d97706"
      strokeWidth="1.5"
    />
    <path d="M8 5.5V23M20 5.5V23" stroke="#fef3c7" strokeWidth="1.5" />
    <rect x="11.5" y="10" width="5" height="5" rx="1" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
    <circle cx="14" cy="12" r="0.8" fill="#78350f" />
    <line x1="14" y1="12.8" x2="14" y2="14.2" stroke="#78350f" strokeWidth="0.8" strokeLinecap="round" />
  </svg>
);

// 3. Icon Cửa hàng (Mái che đỏ trắng Shop)
export const ShopStoreIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="12" width="18" height="11" rx="1.5" fill="#854d0e" stroke="#713f12" strokeWidth="1" />
    <path d="M4 8L5.5 13H22.5L24 8L22 6H6L4 8Z" fill="#ef4444" />
    <path d="M8 6L9 13M14 6L14 13M19 6L20 13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    <rect x="7" y="15" width="5" height="5" rx="1" fill="#67e8f9" stroke="#0891b2" strokeWidth="0.8" />
    <rect x="15" y="15" width="5" height="8" rx="0.5" fill="#ffffff" />
  </svg>
);

// 4. Icon Hồ sơ (Vòng tròn nét đứt chữ N Profile)
export const ProfileDashedIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="11" stroke="#64748b" strokeWidth="1.8" strokeDasharray="3.5 3.5" />
    <text
      x="14"
      y="18"
      textAnchor="middle"
      fill="#475569"
      fontSize="12"
      fontWeight="900"
      fontFamily="sans-serif"
    >
      N
    </text>
  </svg>
);
