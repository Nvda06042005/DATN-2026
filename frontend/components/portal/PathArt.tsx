/**
 * Đồ họa SVG cho lộ trình học tập phong cách Duolingo:
 *  - Rương báu 3 trạng thái (khóa / chờ mở rực sáng / đã mở nắp) thay thế nút tròn đơn điệu.
 *  - Khung linh vật Rồng Con (Tiểu Tướng) đặt dọc hai bên đường cong S-curve với bệ màu hài hòa.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Mascot, type MascotAccessory, type MascotMood } from '@/components/art';
import type { NodeState } from '@/types/learning';

export const TreasureChestArt: React.FC<{ state: NodeState; size?: number; unitBg?: string }> = ({
  state,
  size = 76,
}) => {
  const locked = state === 'locked';
  const done = state === 'done';

  const bodyMain = locked ? '#94a3b8' : '#d97706';
  const bodyDark = locked ? '#64748b' : '#92400e';
  const lidTop = locked ? '#cbd5e1' : '#fcd34d';
  const lidMid = locked ? '#94a3b8' : '#f59e0b';
  const trim = locked ? '#475569' : '#78350f';
  const metal = locked ? '#e2e8f0' : '#fef08a';
  const basePad = locked ? 'rgba(100,116,139,0.22)' : 'rgba(217,119,6,0.20)';

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id="chestLidGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lidTop} />
          <Stop offset="1" stopColor={lidMid} />
        </LinearGradient>
        <LinearGradient id="chestGlow" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#fef08a" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Đế bóng mờ */}
      <Rect x="16" y="70" width="64" height="14" rx="7" fill={basePad} />
      <Ellipse cx="48" cy="75" rx="28" ry="6" fill="rgba(0,0,0,0.16)" />

      {/* Tia sáng khi sẵn sàng mở hoặc đã mở */}
      {!locked ? (
        <G opacity={done ? 0.85 : 0.6}>
          <Path d="M24 22 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" fill="#fde047" />
          <Path d="M74 16 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z" fill="#fef08a" />
        </G>
      ) : null}

      {/* Nắp mở khi đã hoàn thành */}
      {done ? (
        <G>
          {/* Nắp gập ra sau */}
          <Path
            d="M21 44 L25 22 Q48 14 71 22 L75 44 Z"
            fill={bodyDark}
            stroke={trim}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Path d="M27 25 Q48 18 69 25" stroke={metal} strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Ánh vàng tỏa từ lòng rương */}
          <Path d="M24 46 L18 28 L78 28 L72 46 Z" fill="url(#chestGlow)" />
          <Circle cx="40" cy="40" r="5" fill="#fef08a" stroke={trim} strokeWidth="2" />
          <Circle cx="52" cy="38" r="6" fill="#fde047" stroke={trim} strokeWidth="2" />
          <Circle cx="60" cy="42" r="4.5" fill="#fef08a" stroke={trim} strokeWidth="2" />
        </G>
      ) : null}

      {/* Thân rương */}
      <Rect
        x="20"
        y="44"
        width="56"
        height="31"
        rx="6"
        fill={bodyMain}
        stroke={trim}
        strokeWidth="3"
      />
      {/* Đường vân dọc khung rương */}
      <Rect x="29" y="45" width="7" height="29" fill={metal} opacity={locked ? 0.55 : 0.85} />
      <Rect x="60" y="45" width="7" height="29" fill={metal} opacity={locked ? 0.55 : 0.85} />
      {/* Bóng đậm chân rương */}
      <Rect x="21.5" y="65" width="53" height="8.5" rx="4" fill={bodyDark} opacity={0.55} />

      {/* Nắp đóng (khóa hoặc chưa mở) */}
      {!done ? (
        <G>
          <Path
            d="M17 44 C17 26, 79 26, 79 44 L79 49 L17 49 Z"
            fill="url(#chestLidGrad)"
            stroke={trim}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Rect x="28" y="30" width="8" height="18" rx="3" fill={metal} opacity={locked ? 0.6 : 0.9} />
          <Rect x="60" y="30" width="8" height="18" rx="3" fill={metal} opacity={locked ? 0.6 : 0.9} />
          {/* Vệt sáng trên nắp */}
          <Path d="M26 33 Q48 26 70 33" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity={locked ? 0.25 : 0.6} fill="none" />
        </G>
      ) : null}

      {/* Ổ khóa trung tâm */}
      <Rect
        x="41"
        y="43"
        width="14"
        height="16"
        rx="4"
        fill={metal}
        stroke={trim}
        strokeWidth="2.5"
      />
      <Circle cx="48" cy="49" r="2.3" fill={trim} />
      <Rect x="46.8" y="50.5" width="2.4" height="4.2" rx="1" fill={trim} />
    </Svg>
  );
};

export const PathMascotVignette: React.FC<{
  size?: number;
  mood?: MascotMood;
  accessory?: MascotAccessory;
  tintBg: string;
  bob?: boolean;
  title?: string;
}> = ({ size = 96, mood = 'happy', accessory = 'helmet', tintBg, bob = false, title = 'Tiểu Tướng' }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 4,
        width: size * 0.86,
        height: size * 0.28,
        borderRadius: 999,
        backgroundColor: tintBg,
      }}
    />
    <Mascot size={size} mood={mood} accessory={accessory} bob={bob} title={title} />
  </View>
);

/** Chùm tia pháo hoa tối giản phía trên linh vật trong màn ăn mừng hoàn thành bài */
export const FireworkBurstArt: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M32 6 V19" stroke="#facc15" strokeWidth="3.2" strokeLinecap="round" />
    <Path d="M32 45 V58" stroke="#ec4899" strokeWidth="3.2" strokeLinecap="round" />
    <Path d="M6 32 H19" stroke="#facc15" strokeWidth="3.2" strokeLinecap="round" />
    <Path d="M45 32 H58" stroke="#ec4899" strokeWidth="3.2" strokeLinecap="round" />
    <Path d="M13 13 L23 23" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
    <Path d="M41 41 L51 51" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
    <Path d="M51 13 L41 23" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
    <Path d="M23 41 L13 51" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

/** Rương báu mở nắp đầy ngọc quý (dùng ở bước Mở rương nhận thưởng sau bài học) */
export const OpenGemChestArt: React.FC<{ size?: number }> = ({ size = 148 }) => (
  <Svg width={size} height={size} viewBox="0 0 128 128">
    <Defs>
      <LinearGradient id="openChestWood" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#b45309" />
        <Stop offset="1" stopColor="#7c2d12" />
      </LinearGradient>
      <LinearGradient id="openChestGlow" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.45" />
        <Stop offset="1" stopColor="#bae6fd" stopOpacity="0" />
      </LinearGradient>
    </Defs>

    {/* Bóng đổ dưới rương */}
    <Ellipse cx="64" cy="108" rx="44" ry="8" fill="rgba(0,0,0,0.28)" />

    {/* Tia sáng tỏa ra quanh rương */}
    <Path d="M26 30 l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z" fill="#fde047" opacity="0.9" />
    <Path d="M104 34 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 z" fill="#7dd3fc" opacity="0.95" />

    {/* Nắp rương gập phía sau */}
    <Path d="M26 56 L31 28 Q64 20 97 28 L102 56 Z" fill="#9a3412" stroke="#5b1e0c" strokeWidth="3" strokeLinejoin="round" />
    <Path d="M33 32 H95" stroke="#c2410c" strokeWidth="5" strokeLinecap="round" />
    <Rect x="25" y="48" width="78" height="10" rx="4" fill="#d97706" stroke="#7c2d12" strokeWidth="2.5" />

    {/* Ánh sáng từ lòng rương */}
    <Path d="M28 58 L20 34 L108 34 L100 58 Z" fill="url(#openChestGlow)" />

    {/* Đá quý và vàng chất đầy miệng rương */}
    <Path d="M36 58 L44 39 L55 47 L49 60 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
    <Path d="M51 58 L62 34 L75 42 L68 60 Z" fill="#7dd3fc" stroke="#0369a1" strokeWidth="2" />
    <Path d="M68 58 L80 38 L92 48 L86 60 Z" fill="#0ea5e9" stroke="#075985" strokeWidth="2" />
    <Path d="M44 59 L56 44 L68 59 Z" fill="#bae6fd" opacity="0.85" />
    <Path d="M74 59 L84 44 L94 59 Z" fill="#38bdf8" opacity="0.9" />

    {/* Thân rương phía trước */}
    <Rect x="26" y="56" width="76" height="46" rx="8" fill="url(#openChestWood)" stroke="#431407" strokeWidth="3" />
    {/* Dải kim loại xám/bạc hai bên và ở giữa */}
    <Rect x="26" y="56" width="12" height="46" rx="5" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" />
    <Rect x="90" y="56" width="12" height="46" rx="5" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" />
    <Path d="M39 74 H89" stroke="#5b1e0c" strokeWidth="2.5" />
    <Path d="M39 89 H89" stroke="#5b1e0c" strokeWidth="2.5" />

    {/* Ổ khóa bạc nổi bật ở giữa */}
    <Rect x="54" y="56" width="20" height="24" rx="5" fill="#e2e8f0" stroke="#475569" strokeWidth="2.5" />
    <Circle cx="64" cy="65.5" r="3.4" fill="#334155" />
    <Path d="M64 67 V73" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

/** Biểu tượng rương nhỏ gắn ở cuối thanh tiến độ Nhiệm vụ (3 bậc: đồng / bạc / vàng) */
export const QuestChestBadge: React.FC<{
  tier?: 0 | 1 | 2;
  done: boolean;
  highlight?: boolean;
  size?: number;
}> = ({ tier = 0, done, highlight = false, size = 34 }) => {
  const palette =
    tier === 2
      ? { body: '#eab308', lid: '#fde047', trim: '#713f12', metal: '#fef9c3' }
      : tier === 1
        ? { body: '#92400e', lid: '#d97706', trim: '#451a03', metal: '#e2e8f0' }
        : { body: '#9a3412', lid: '#b45309', trim: '#431407', metal: '#fcd34d' };

  return (
    <View
      style={{
        width: size + 8,
        height: size + 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: highlight ? 'rgba(250, 204, 21, 0.24)' : 'transparent',
        borderWidth: highlight ? 2 : 0,
        borderColor: highlight ? '#facc15' : 'transparent',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {done ? (
          <>
            <Path d="M10 21 L12 10 Q24 6 36 10 L38 21 Z" fill={palette.trim} stroke={palette.trim} strokeWidth="2" />
            <Path d="M12 22 L9 13 L39 13 L36 22 Z" fill="#fde047" opacity="0.85" />
          </>
        ) : (
          <Path d="M8 21 C8 12, 40 12, 40 21 Z" fill={palette.lid} stroke={palette.trim} strokeWidth="2.2" />
        )}
        <Rect x="9" y="21" width="30" height="19" rx="4" fill={palette.body} stroke={palette.trim} strokeWidth="2.2" />
        <Rect x="14" y="22" width="4" height="17" fill={palette.metal} opacity={0.85} />
        <Rect x="30" y="22" width="4" height="17" fill={palette.metal} opacity={0.85} />
        <Rect x="20" y="20" width="8" height="10" rx="2.5" fill={palette.metal} stroke={palette.trim} strokeWidth="1.8" />
        <Circle cx="24" cy="24.5" r="1.4" fill={palette.trim} />
      </Svg>
    </View>
  );
};
