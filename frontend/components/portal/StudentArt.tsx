/**
 * Hình vẽ của sảnh học sinh (20/11/2026, theo yêu cầu "kiểu như VL-LEGEND" – chỉ lấy thể loại, không dùng hình / tên / bố cục của trang mẫu):
 *  - Scholar: nhân vật chibi nam / nữ trong năm bộ trang phục theo danh hiệu Học trò → Thái học sinh → Thám hoa → Bảng nhãn → Trạng nguyên;
 *  - PalaceScene: cung điện tưởng tượng cho màn mở đầu;
 *  - RankScene: năm bức tranh phong tục khoa cử (đèn sách, lều chõng, xướng danh, bảng vàng, vinh quy).
 * Tất cả do nhóm tự vẽ bằng SVG, là tranh cách điệu – không phục dựng trang phục, kiến trúc hay nghi lễ của riêng một triều đại.
 * Không dùng màu vàng hoàng bào cho áo Trạng nguyên (màu dành cho vua); áo đỏ son, đai vàng chỉ là cách điệu.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type Gender = 'nam' | 'nu';

const HAIR = '#211915', SKIN = '#f9d8bb', SKIN_D = '#edbf9c', INK = '#2a1c15', CHEEK = '#f29d93', HAT = '#18181f';
/** Trang phục theo bậc: áo, viền tối, nẹp cổ, đai, kiểu mũ, vật cầm tay */
export const RANK_LOOK: ReadonlyArray<{ robe: string; dark: string; trim: string; sash: string; hat: 'knot' | 'khan' | 'wing'; hold: 'book' | 'scroll' | 'hot'; soft: string; flower?: boolean }> = [
  { robe: '#8b6b4c', dark: '#6a4f37', trim: '#ecdcbc', sash: '#4a3828', hat: 'knot', hold: 'book', soft: '#f4e7d6' },
  { robe: '#2f5f8f', dark: '#21466c', trim: '#ecd8ad', sash: '#b9853a', hat: 'khan', hold: 'scroll', soft: '#e2ecf6' },
  { robe: '#6a4c9c', dark: '#4e3776', trim: '#f0d79a', sash: '#cfa24a', hat: 'wing', hold: 'hot', soft: '#ece5f6' },
  { robe: '#1d7a68', dark: '#145a4c', trim: '#f0d79a', sash: '#cfa24a', hat: 'wing', hold: 'scroll', soft: '#dcefe9' },
  { robe: '#b8261b', dark: '#8a1b13', trim: '#f2cf6b', sash: '#e3b244', hat: 'wing', hold: 'scroll', soft: '#fbe2dd', flower: true },
];

const clampRank = (r: number): number => Math.max(0, Math.min(RANK_LOOK.length - 1, Math.round(r)));

/** Nhân vật chibi (khung 120 × 160, chân ở đáy) dưới dạng nhóm SVG để ghép vào cảnh: (x, y) là điểm giữa hai chân */
export function scholarG(key: string, rank: number, gender: Gender, x: number, y: number, s = 1, flip = false): React.ReactElement {
  const L = RANK_LOOK[clampRank(rank)];
  const nu = gender === 'nu';
  const hands: [number, number] = L.hold === 'hot' ? [55, 65] : [49, 71];
  return (
    <G key={key} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) translate(-60 -160)`}>
      <Ellipse cx={60} cy={156} rx={31} ry={5} fill="#3c1e0a" opacity={0.18} />
      {nu ? <Path d="M33 62 Q27 98 40 118 L80 118 Q93 98 87 62 Z" fill={HAIR} /> : null}
      <Ellipse cx={50} cy={154} rx={8} ry={4} fill="#2f241d" />
      <Ellipse cx={70} cy={154} rx={8} ry={4} fill="#2f241d" />
      <Path d="M42 94 Q34 122 28 150 Q60 159 92 150 Q86 122 78 94 Q60 88 42 94 Z" fill={L.robe} />
      <Path d="M29 146 Q60 155 91 146 L92 150 Q60 159 28 150 Z" fill={L.dark} />
      <Path d="M60 104 L60 150" stroke={L.dark} strokeWidth={1.5} opacity={0.55} />
      <Path d="M49 93 L60 108 L71 93 Z" fill="#fff6e6" />
      <Path d="M47 93 L63 113 M73 93 L58 106" stroke={L.trim} strokeWidth={4} strokeLinecap="round" />
      <Rect x={37} y={113} width={46} height={7} rx={3.5} fill={L.sash} />
      <Path d="M57 119 L54 135 L60 131 L66 135 L63 119 Z" fill={L.sash} />
      <Path d="M44 97 Q27 108 27 128 Q37 136 51 130 Q49 112 47 99 Z" fill={L.robe} stroke={L.dark} strokeWidth={1.2} />
      <Path d="M76 97 Q93 108 93 128 Q83 136 69 130 Q71 112 73 99 Z" fill={L.robe} stroke={L.dark} strokeWidth={1.2} />
      <Path d="M28 126 Q38 133 51 128 M92 126 Q82 133 69 128" stroke={L.trim} strokeWidth={3} fill="none" strokeLinecap="round" />
      {L.hold === 'book' ? (
        <G><Rect x={47} y={117} width={26} height={17} rx={2} fill="#2f6150" stroke="#1e4337" strokeWidth={1.2} /><Path d="M60 118 V133" stroke="#e9dcc0" strokeWidth={1.4} /></G>
      ) : L.hold === 'hot' ? (
        <Rect x={56} y={103} width={8} height={31} rx={3} fill="#efe2c4" stroke="#b58c52" strokeWidth={1.2} />
      ) : (
        <G><Rect x={43} y={120} width={34} height={10} rx={5} fill="#f4e6c6" stroke="#b58c52" strokeWidth={1.2} /><Rect x={58} y={119} width={4} height={12} fill={L.flower ? '#c0392b' : '#b58c52'} /></G>
      )}
      <Circle cx={hands[0]} cy={127} r={5} fill={SKIN} /><Circle cx={hands[1]} cy={127} r={5} fill={SKIN} />
      <Rect x={55} y={84} width={10} height={11} fill={SKIN_D} />
      <Circle cx={31} cy={64} r={5.5} fill={SKIN} /><Circle cx={89} cy={64} r={5.5} fill={SKIN} />
      <Circle cx={60} cy={60} r={30} fill={SKIN} />
      <Path d="M30 62 Q29 30 60 29 Q91 30 90 62 Q86 47 74 44 Q64 52 50 46 Q38 47 30 62 Z" fill={HAIR} />
      {nu ? <Path d="M31 60 Q27 84 35 97 L40 95 Q35 80 37 62 Z M89 60 Q93 84 85 97 L80 95 Q85 80 83 62 Z" fill={HAIR} /> : null}
      <Path d="M43 56 Q48 53 53 56 M67 56 Q72 53 77 56" stroke={HAIR} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Ellipse cx={48} cy={66} rx={4.2} ry={5.2} fill={INK} /><Ellipse cx={72} cy={66} rx={4.2} ry={5.2} fill={INK} />
      <Circle cx={49.6} cy={64} r={1.6} fill="#ffffff" /><Circle cx={73.6} cy={64} r={1.6} fill="#ffffff" />
      <Ellipse cx={41} cy={75} rx={5} ry={3} fill={CHEEK} opacity={0.55} /><Ellipse cx={79} cy={75} rx={5} ry={3} fill={CHEEK} opacity={0.55} />
      <Path d="M55 77 Q60 82 65 77" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {L.hat === 'knot' ? (nu ? (
        <G>
          <Circle cx={60} cy={26} r={11} fill={HAIR} />
          <Path d="M49 30 Q40 25 37 34 Q46 37 51 33 Z M71 30 Q80 25 83 34 Q74 37 69 33 Z" fill="#d9577a" />
          <Circle cx={60} cy={31} r={3} fill="#f3c55a" />
        </G>
      ) : (
        <G>
          <Circle cx={60} cy={27} r={9.5} fill={HAIR} />
          <Rect x={53} y={33} width={14} height={4} rx={2} fill="#7b5a3a" />
          <Path d="M49 22 L71 30" stroke="#c9a46a" strokeWidth={2.2} strokeLinecap="round" />
        </G>
      )) : L.hat === 'khan' ? (
        <G>
          <Path d="M86 40 Q99 46 95 59 Q90 51 84 49 Z" fill={HAT} />
          <Path d="M29 54 Q30 22 60 20 Q90 22 91 54 Q60 44 29 54 Z" fill="#1f2a33" />
          <Path d="M29 54 Q60 44 91 54 L91 58 Q60 48 29 58 Z" fill={L.trim} />
        </G>
      ) : (
        <G>
          <Path d="M17 40 L36 45 M103 40 L84 45" stroke={HAT} strokeWidth={3} />
          <Ellipse cx={11} cy={39} rx={9} ry={5.5} fill={HAT} transform="rotate(-12 11 39)" />
          <Ellipse cx={109} cy={39} rx={9} ry={5.5} fill={HAT} transform="rotate(12 109 39)" />
          <Path d="M32 50 Q32 24 60 22 Q88 24 88 50 Z" fill={HAT} />
          <Rect x={44} y={11} width={32} height={20} rx={9} fill={HAT} />
          <Rect x={31} y={45} width={58} height={7} rx={3.5} fill={L.trim} />
          <Circle cx={60} cy={40} r={3.5} fill={L.trim} />
          {L.flower ? (
            <G>
              <Path d="M76 20 Q90 6 99 14" stroke="#2f7a46" strokeWidth={2} fill="none" />
              <Circle cx={98} cy={13} r={6} fill="#d8343a" /><Circle cx={98} cy={13} r={2.4} fill="#f6d36b" />
              <Circle cx={88} cy={9} r={5} fill="#e85d5f" /><Circle cx={88} cy={9} r={2} fill="#f6d36b" />
            </G>
          ) : null}
        </G>
      )}
    </G>
  );
}

/** Một nhân vật đứng riêng (trang trí; nhãn trợ năng nằm ở thẻ chứa) */
export const Scholar: React.FC<{ rank: number; gender?: Gender; size?: number; flip?: boolean }> = ({ rank, gender = 'nam', size = 120, flip = false }) => (
  <Svg width={size} height={(size * 4) / 3} viewBox="0 0 120 160" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {scholarG('s', rank, gender, 60, 160, 1, flip)}
  </Svg>
);

/** Cặp nhân vật nam – nữ cùng một bậc (thẻ thang danh hiệu, bục bảng vàng) */
export const ScholarPair: React.FC<{ rank: number; size?: number }> = ({ rank, size = 150 }) => (
  <Svg width={size} height={(size * 160) / 224} viewBox="0 0 224 160" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {scholarG('a', rank, 'nam', 62, 160, 1)}
    {scholarG('b', rank, 'nu', 162, 160, 1, true)}
  </Svg>
);

// ---------------------------------------------------------------------- chi tiết dùng lại trong các cảnh
const cloud = (key: string, x: number, y: number, s = 1, fill = '#fff8ec', opacity = 0.95): React.ReactElement => (
  <Path key={key} transform={`translate(${x} ${y}) scale(${s})`} fill={fill} opacity={opacity}
    d="M0 0 Q4 -16 22 -10 Q30 -26 50 -16 Q66 -24 74 -8 Q90 -6 86 6 Q76 12 60 8 Q48 16 34 8 Q16 14 0 0 Z" />
);
/** Mái ngói cong hai đầu: (x, y) góc trên trái của mái, rộng w, cao h */
const roof = (key: string, x: number, y: number, w: number, h: number, color = '#2e3d45', tip = '#d6a64a'): React.ReactElement => (
  <G key={key}>
    <Path d={`M${x} ${y + h} L${x + w} ${y + h} L${x + w - h} ${y} L${x + h} ${y} Z`} fill={color} />
    <Path d={`M${x + 8} ${y + h} Q${x - 12} ${y + h + 2} ${x - 20} ${y + h - 18} Q${x - 6} ${y + h - 8} ${x + 12} ${y + h - 7} Z`} fill={color} />
    <Path d={`M${x + w - 8} ${y + h} Q${x + w + 12} ${y + h + 2} ${x + w + 20} ${y + h - 18} Q${x + w + 6} ${y + h - 8} ${x + w - 12} ${y + h - 7} Z`} fill={color} />
    <Rect x={x - 2} y={y + h - 3} width={w + 4} height={5} fill="#1f2a30" />
    <Circle cx={x - 20} cy={y + h - 18} r={3} fill={tip} /><Circle cx={x + w + 20} cy={y + h - 18} r={3} fill={tip} />
  </G>
);
/** Người đứng xem (bóng giản lược, phía sau nhân vật chính) */
const bystander = (key: string, x: number, y: number, robe: string, s = 1): React.ReactElement => (
  <G key={key} transform={`translate(${x} ${y}) scale(${s})`}>
    <Path d="M-11 0 Q-9 -20 -6 -26 Q0 -29 6 -26 Q9 -20 11 0 Z" fill={robe} />
    <Circle cx={0} cy={-33} r={8} fill="#f1cfae" />
    <Path d="M-8 -35 Q-7 -43 0 -43 Q7 -43 8 -35 Q4 -39 0 -38 Q-4 -39 -8 -35 Z" fill={HAIR} />
  </G>
);
const bamboo = (key: string, x: number, y: number, h: number): React.ReactElement => (
  <G key={key}>
    {[0, 9, 17].map((dx, i) => <Path key={i} d={`M${x + dx} ${y} Q${x + dx + (i - 1) * 6} ${y - h / 2} ${x + dx + (i - 1) * 12} ${y - h}`} stroke={i === 1 ? '#3f7a4a' : '#4f8c55'} strokeWidth={4} fill="none" />)}
    {[0.35, 0.55, 0.75, 0.92].map((t, i) => (
      <Path key={`l${i}`} d={`M${x + 8} ${y - h * t} q${i % 2 ? 16 : -16} -4 ${i % 2 ? 24 : -24} 4 q${i % 2 ? -12 : 12} 2 ${i % 2 ? -24 : 24} -4 Z`} fill="#5f9f5c" />
    ))}
  </G>
);

// ---------------------------------------------------------------------- màn mở đầu: cung điện tưởng tượng
export const PalaceScene: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const pillars = Array.from({ length: 7 }, (_, i) => 368 + i * 76);
  const side = (
    <G>
      <Rect x={36} y={358} width={228} height={18} fill="#d5c3a0" />
      <Rect x={56} y={300} width={188} height={60} fill="#7c2a20" />
      {[56, 108, 160, 212].map((x) => <Rect key={x} x={x} y={300} width={12} height={60} fill="#a8382a" />)}
      {roof('sr', 44, 262, 212, 38)}
      <Rect x={84} y={254} width={132} height={9} rx={4} fill="#22303a" />
    </G>
  );
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      <Svg width="100%" height="100%" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="hallSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f3b97f" /><Stop offset="0.55" stopColor="#fde3bd" /><Stop offset="1" stopColor="#fff4e0" />
          </LinearGradient>
          <RadialGradient id="hallHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff3cc" stopOpacity="0.95" /><Stop offset="1" stopColor="#fff3cc" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={1200} height={520} fill="url(#hallSky)" />
        <Circle cx={600} cy={200} r={280} fill="url(#hallHalo)" />
        <Path d="M0 330 L120 252 L220 300 L330 222 L450 300 L560 262 L700 300 L820 232 L950 300 L1060 252 L1200 312 V400 H0 Z" fill="#d6ad80" opacity={0.42} />
        <Path d="M0 362 Q150 302 300 350 T600 340 T900 350 T1200 340 V420 H0 Z" fill="#b6c39f" opacity={0.55} />
        {cloud('c1', 70, 96, 1.5)}{cloud('c2', 300, 62, 1)}{cloud('c3', 860, 76, 1.4)}{cloud('c4', 1040, 128, 1)}{cloud('c5', 200, 188, 0.9, '#fff8ec', 0.8)}{cloud('c6', 940, 196, 0.8, '#fff8ec', 0.8)}
        {side}
        <G transform="translate(1200 0) scale(-1 1)">{side}</G>
        <Rect x={0} y={400} width={1200} height={120} fill="#ecdcbc" />
        {[430, 468, 506].map((y) => <Path key={y} d={`M0 ${y} H1200`} stroke="#dcc7a0" strokeWidth={2} />)}
        {[-520, -360, -200, -60, 60, 200, 360, 520].map((dx) => <Path key={dx} d={`M${600 + dx * 0.35} 400 L${600 + dx * 1.3} 520`} stroke="#dcc7a0" strokeWidth={2} />)}
        <Rect x={290} y={366} width={620} height={8} fill="#e2d1ae" />
        <Rect x={300} y={372} width={600} height={30} fill="#cdb894" />
        <Path d="M524 400 H676 L716 520 H484 Z" fill="#dccaa6" />
        {[418, 438, 458, 478, 498].map((y) => { const t = (y - 400) / 120; return <Path key={y} d={`M${524 - 40 * t} ${y} H${676 + 40 * t}`} stroke="#c8b58e" strokeWidth={3} />; })}
        <Rect x={360} y={262} width={480} height={104} fill="#6e1c15" />
        {pillars.slice(0, 6).map((x) => (
          <G key={`d${x}`}>
            <Rect x={x + 18} y={276} width={54} height={80} fill="#8a2a1d" />
            <Path d={`M${x + 36} 276 V356 M${x + 54} 276 V356 M${x + 18} 302 H${x + 72} M${x + 18} 330 H${x + 72}`} stroke="#d9a94a" strokeWidth={2} opacity={0.55} />
          </G>
        ))}
        {pillars.map((x) => (
          <G key={`p${x}`}>
            <Rect x={x} y={262} width={14} height={104} fill="#b52b1f" />
            <Rect x={x} y={262} width={4} height={104} fill="#cf4a33" />
            <Rect x={x - 3} y={356} width={20} height={10} fill="#e4c88f" />
          </G>
        ))}
        {roof('lr', 316, 226, 568, 42)}
        {Array.from({ length: 34 }, (_, i) => <Path key={`t${i}`} d={`M${362 + i * 14.5} 230 V264`} stroke="#41555e" strokeWidth={2} />)}
        <Rect x={330} y={270} width={540} height={3} fill="#d6a64a" />
        {[410, 790].map((x) => (
          <G key={`lt${x}`}>
            <Path d={`M${x} 272 V290`} stroke="#4a2a1a" strokeWidth={2} />
            <Rect x={x - 5} y={288} width={10} height={4} fill="#d6a64a" />
            <Ellipse cx={x} cy={305} rx={12} ry={15} fill="#d23a2a" />
            <Path d={`M${x - 6} 292 Q${x - 9} 305 ${x - 6} 318 M${x + 6} 292 Q${x + 9} 305 ${x + 6} 318`} stroke="#f0c55a" strokeWidth={1.5} fill="none" />
            <Rect x={x - 5} y={318} width={10} height={4} fill="#d6a64a" />
            <Path d={`M${x} 322 V334`} stroke="#d23a2a" strokeWidth={2} />
          </G>
        ))}
        <Rect x={430} y={178} width={340} height={52} fill="#86241a" />
        {[452, 500, 660, 708].map((x) => <Rect key={`w${x}`} x={x} y={188} width={36} height={30} fill="#5d1a12" stroke="#d9a94a" strokeWidth={1.5} />)}
        <Rect x={556} y={186} width={88} height={32} rx={3} fill="#1d3b35" stroke="#e2b24a" strokeWidth={3} />
        <Path d="M578 202 H622 M600 194 V210" stroke="#e2b24a" strokeWidth={2} opacity={0.65} />
        {roof('ur', 404, 132, 392, 52)}
        {Array.from({ length: 22 }, (_, i) => <Path key={`u${i}`} d={`M${462 + i * 13} 136 V181`} stroke="#41555e" strokeWidth={2} />)}
        <Rect x={446} y={122} width={308} height={12} rx={5} fill="#22303a" />
        <Path d="M452 128 Q430 124 432 100 Q444 112 460 116 Z" fill="#d6a64a" />
        <Path d="M748 128 Q770 124 768 100 Q756 112 740 116 Z" fill="#d6a64a" />
        <Circle cx={600} cy={113} r={10} fill="#e2b24a" />
        <Path d="M600 78 Q611 92 605 100 Q614 100 600 112 Q586 100 595 100 Q589 92 600 78 Z" fill="#f0c55a" />
        {[300, 900].map((x) => (
          <G key={`f${x}`}>
            <Path d={`M${x} 168 V404`} stroke="#5a3a24" strokeWidth={5} />
            <Path d={`M${x + (x < 600 ? 2 : -2)} 176 L${x + (x < 600 ? 62 : -62)} 196 L${x + (x < 600 ? 2 : -2)} 218 Z`} fill="#b8261b" stroke="#e3b244" strokeWidth={3} />
            <Circle cx={x} cy={166} r={5} fill="#e3b244" />
          </G>
        ))}
        <Path d="M0 46 Q70 62 130 40 Q180 22 236 36" stroke="#5b3a28" strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d="M90 54 Q110 82 150 88 M170 30 Q196 54 230 58" stroke="#5b3a28" strokeWidth={5} fill="none" strokeLinecap="round" />
        {[[30, 52], [64, 40], [102, 60], [128, 84], [152, 92], [176, 40], [204, 28], [222, 58], [238, 36], [84, 72]].map(([cx, cy], i) => (
          <G key={`b${i}`}><Circle cx={cx} cy={cy} r={i % 3 === 0 ? 9 : 7} fill={i % 2 ? '#f6b3c3' : '#f08fa8'} /><Circle cx={cx} cy={cy} r={2.5} fill="#fff1c4" /></G>
        ))}
        <G>
          <Path d="M1150 404 Q1146 330 1158 250" stroke="#5b3a28" strokeWidth={12} fill="none" />
          {[[1120, 300, 70], [1160, 262, 60], [1110, 236, 54], [1170, 210, 46], [1140, 330, 64]].map(([cx, cy, rx], i) => <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={16} fill={i % 2 ? '#2f6b4f' : '#3e7d5a'} />)}
        </G>
      </Svg>
    </View>
  );
};

// ---------------------------------------------------------------------- tranh phong tục khoa cử (thư viện tranh)
function sceneBody(rank: number): React.ReactElement {
  switch (clampRank(rank)) {
    case 0: return (
      <G>
        <Rect width={400} height={250} fill="#27324b" />
        <Rect width={400} height={190} fill="#2e3a57" />
        <Circle cx={300} cy={86} r={52} fill="#1d2a47" />
        <Circle cx={318} cy={72} r={18} fill="#fff0bf" />
        <Path d="M270 140 Q274 90 282 40 M292 140 Q296 96 300 50" stroke="#2d5a46" strokeWidth={4} fill="none" />
        <Path d="M282 70 q14 -6 22 2 q-12 4 -22 -2 Z M296 96 q-14 -6 -22 2 q12 4 22 -2 Z" fill="#3d7258" />
        <Circle cx={300} cy={86} r={52} fill="none" stroke="#8b6844" strokeWidth={8} />
        <Path d="M248 86 H352 M300 34 V138" stroke="#8b6844" strokeWidth={3} />
        <Circle cx={128} cy={138} r={100} fill="url(#sceneLamp)" />
        <Rect y={190} width={400} height={60} fill="#6b4a35" />
        {[202, 214, 226, 238].map((y) => <Path key={y} d={`M0 ${y} H400`} stroke="#7c5840" strokeWidth={2} />)}
        <Rect x={40} y={158} width={160} height={12} rx={3} fill="#8a5432" />
        <Rect x={52} y={170} width={10} height={26} fill="#6e4127" /><Rect x={178} y={170} width={10} height={26} fill="#6e4127" />
        <Rect x={56} y={142} width={40} height={8} fill="#3b6e5c" /><Rect x={60} y={134} width={34} height={8} fill="#a2453a" /><Rect x={58} y={126} width={38} height={8} fill="#d7b56b" />
        <Rect x={102} y={150} width={36} height={8} rx={2} fill="#f1e2bf" />
        <Ellipse cx={162} cy={155} rx={14} ry={4} fill="#c9a15a" />
        <Rect x={159} y={141} width={6} height={14} fill="#9b7a44" />
        <Path d="M162 118 Q171 131 162 141 Q153 131 162 118 Z" fill="#ffcf5a" />
        <Path d="M162 127 Q166 133 162 138 Q158 133 162 127 Z" fill="#fff6d0" />
        {scholarG('a', 0, 'nam', 222, 240, 1.15)}
        {scholarG('b', 0, 'nu', 336, 240, 1.15, true)}
      </G>
    );
    case 1: {
      let fence = 'M0 168 V128';
      for (let x = 0; x <= 400; x += 10) fence += ` L${x + 5} 120 L${x + 10} 128`;
      fence += ' V168 Z';
      const tent = (k: string, x: number, y: number, s: number): React.ReactElement => (
        <G key={k} transform={`translate(${x} ${y}) scale(${s})`}>
          <Path d="M-32 0 L0 -36 L32 0 Z" fill="#efe1bf" stroke="#9c7a4a" strokeWidth={2} />
          <Path d="M-9 0 L0 -13 L9 0 Z" fill="#7a5a36" />
          <Path d="M0 -36 V-44" stroke="#7a5a36" strokeWidth={2} />
        </G>
      );
      return (
        <G>
          <Rect width={400} height={250} fill="#fbeed6" />
          <Path d="M0 120 Q100 88 200 112 T400 104 V170 H0 Z" fill="#dcc79e" opacity={0.7} />
          {cloud('c1', 30, 40, 0.8)}{cloud('c2', 280, 30, 0.9)}
          <Path d={fence} fill="#a77d4e" />
          <Rect y={166} width={400} height={84} fill="#e2cfa3" />
          {tent('t1', 40, 186, 0.7)}{tent('t2', 110, 182, 0.65)}{tent('t3', 176, 186, 0.7)}{tent('t4', 236, 180, 0.6)}
          {tent('t5', 70, 226, 1)}{tent('t6', 166, 230, 0.95)}
          <Path d="M372 196 V64" stroke="#5a3a24" strokeWidth={4} />
          <Path d="M370 70 L326 84 L370 100 Z" fill="#b8261b" stroke="#e3b244" strokeWidth={2} />
          {scholarG('a', 1, 'nam', 262, 242, 1.15)}
          {scholarG('b', 1, 'nu', 340, 242, 1.05, true)}
        </G>
      );
    }
    case 2: return (
      <G>
        <Rect width={400} height={250} fill="#f7e3c4" />
        {cloud('c1', 250, 36, 1)}
        <Rect x={0} y={112} width={400} height={64} fill="#cdb48c" />
        <Path d="M0 112 H400" stroke="#9c3a2a" strokeWidth={6} />
        <Rect y={174} width={400} height={76} fill="#e6d2a8" />
        <Rect x={90} y={86} width={120} height={92} fill="#7c2a20" />
        <Rect x={90} y={86} width={14} height={92} fill="#b52b1f" /><Rect x={196} y={86} width={14} height={92} fill="#b52b1f" />
        <Path d="M120 178 V120 Q150 98 180 120 V178 Z" fill="#3a1d14" />
        {roof('g', 74, 54, 152, 34)}
        <Rect x={104} y={98} width={10} height={58} fill="#c0392b" /><Rect x={186} y={98} width={10} height={58} fill="#c0392b" />
        {[[30, 220, '#7a6a5a'], [56, 214, '#5f7a8a'], [86, 222, '#8a6a7a'], [196, 216, '#6f7f5a'], [222, 222, '#7a6a5a'], [150, 210, '#5f7a8a']].map(([x, y, col], i) => bystander(`p${i}`, x as number, y as number, col as string, 1.15))}
        {scholarG('a', 2, 'nam', 290, 242, 1.2)}
        {scholarG('b', 2, 'nu', 360, 242, 1.05, true)}
      </G>
    );
    case 3: return (
      <G>
        <Rect width={400} height={250} fill="#f4e6cd" />
        <Rect y={0} width={400} height={180} fill="#efdfc0" />
        {cloud('c1', 280, 40, 0.9)}
        <Rect y={178} width={400} height={72} fill="#dfcca6" />
        <Rect x={60} y={66} width={10} height={148} fill="#5a3822" /><Rect x={230} y={66} width={10} height={148} fill="#5a3822" />
        {roof('b', 46, 34, 208, 32, '#2e3d45')}
        <Rect x={70} y={72} width={160} height={110} fill="#8a2a1d" />
        <Rect x={78} y={80} width={144} height={94} fill="#f3d98f" />
        <Rect x={78} y={80} width={144} height={14} fill="#c2902f" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <Path key={i} d={`M${88 + i * 14} 102 V${102 + 38 + ((i * 17) % 28)}`} stroke="#5a3a20" strokeWidth={3} strokeLinecap="round" />)}
        {bystander('p1', 40, 226, '#7a6a5a', 1.1)}{bystander('p2', 250, 222, '#5f7a8a', 1)}
        {scholarG('a', 3, 'nam', 300, 244, 1.2)}
        {scholarG('b', 3, 'nu', 366, 244, 1.05, true)}
      </G>
    );
    default: return (
      <G>
        <Rect width={400} height={250} fill="#fbe6c3" />
        {cloud('c1', 40, 40, 0.9)}{cloud('c2', 300, 54, 0.8)}
        <Path d="M0 130 Q90 96 190 124 T400 116 V170 H0 Z" fill="#a9c08a" />
        <Path d="M0 150 L400 140 V250 H0 Z" fill="#9cc46e" />
        <Path d="M0 176 L400 162 V250 H0 Z" fill="#b6d27f" />
        <Path d="M0 206 L400 190 V250 H0 Z" fill="#8ab35c" />
        <Path d="M160 250 Q190 200 120 170 Q100 160 92 150 L104 150 Q124 162 150 172 Q220 204 230 250 Z" fill="#e8d4a2" />
        <Rect x={58} y={104} width={12} height={50} fill="#9c3a2a" /><Rect x={118} y={104} width={12} height={50} fill="#9c3a2a" />
        {roof('v', 50, 80, 88, 26)}
        {bamboo('bb1', 10, 170, 120)}{bamboo('bb2', 370, 180, 130)}
        <Path d="M262 238 V72" stroke="#5a3a24" strokeWidth={4} />
        <Path d="M210 96 Q262 54 314 96 Z" fill="#c8281e" />
        <Rect x={210} y={94} width={104} height={8} fill="#e3b244" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Path key={i} d={`M${213 + i * 13} 102 q6 9 12 0`} fill="#e3b244" />)}
        <Circle cx={262} cy={64} r={5} fill="#e3b244" />
        {[176, 352].map((x) => <G key={x}><Path d={`M${x} 236 V112`} stroke="#5a3a24" strokeWidth={3} /><Path d={`M${x + 2} 116 L${x + 40} 128 L${x + 2} 142 Z`} fill="#b8261b" stroke="#e3b244" strokeWidth={2} /></G>)}
        {scholarG('a', 4, 'nam', 232, 244, 1.2)}
        {scholarG('b', 4, 'nu', 298, 244, 1.08, true)}
      </G>
    );
  }
}

/** Tranh của một bậc danh hiệu (khung 400 × 250, cắt phủ khung chứa) */
export const RankScene: React.FC<{ rank: number; style?: StyleProp<ViewStyle> }> = ({ rank, style }) => (
  <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
    <Svg width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="sceneLamp" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffd77a" stopOpacity="0.55" /><Stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {sceneBody(rank)}
    </Svg>
  </View>
);
