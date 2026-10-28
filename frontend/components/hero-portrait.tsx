/**
 * Tranh minh họa danh tướng nhà Trần (react-native-svg, sắc nét ở mọi kích thước): bán thân nhìn thẳng, vẽ cách điệu theo màu logo.
 * Không có chân dung đương thời của các nhân vật này nên mặt chỉ vẽ tối giản (không mô phỏng gương mặt thật); trang phục, mũ và vật
 * biểu trưng lấy từ sử liệu (mũ miện, mũ phốc đầu, giáp trụ, cờ sáu chữ vàng, quả cam, cây giáo, chữ "Sát Thát"...).
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

type Age = 'young' | 'mid' | 'old';
type Beard = 'none' | 'stubble' | 'goatee' | 'full' | 'long';
type Mustache = 'none' | 'thin' | 'full';
type Head = 'crown' | 'futou' | 'helmet' | 'prince' | 'band' | 'topknot' | 'wrap';
type Body = 'imperial' | 'official' | 'armor' | 'robe' | 'bare' | 'tunic';
type Prop = 'none' | 'spear' | 'banner' | 'plank' | 'scroll' | 'orange' | 'waves' | 'tattoo' | 'halo' | 'sword' | 'flag' | 'chisel';

interface Look {
  age: Age;
  brow: 'calm' | 'stern';
  mustache: Mustache;
  beard: Beard;
  /** Màu râu tóc: mặc định đen, người cao tuổi dùng xám */
  hair?: string;
  skin?: 'light' | 'tan';
  head: Head;
  headColor: string;
  body: Body;
  bodyColor: string;
  cape?: string;
  props?: Prop[];
}

const INK = '#1d2a24';
const GOLD = '#dfb66f';
const GOLD_D = '#b88a3e';
const GOLD_L = '#f4dfa8';
const RED = '#b53520';
const PAPER = '#faf4e7';

const SKIN = {
  light: { base: '#e8bd92', shade: '#c98f63', light: '#f5d6b0' },
  tan: { base: '#d9a272', shade: '#b97b4d', light: '#e8b98a' },
};

/** Pha màu a sang b theo tỉ lệ t (0 – 1) */
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const h = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${h(r1, r2)}${h(g1, g2)}${h(b1, b2)}`;
};
const dark = (c: string, t = 0.3) => mix(c, '#0e1512', t);
const light = (c: string, t = 0.3) => mix(c, '#ffffff', t);

/** Từng nhân vật (khóa là id trong constants/heroes.ts): tuổi, râu, mũ, trang phục và vật biểu trưng */
const LOOK: Record<string, Look> = {
  tran_thai_tong: { age: 'mid', brow: 'calm', mustache: 'thin', beard: 'goatee', head: 'crown', headColor: '#6b1d1a', body: 'imperial', bodyColor: '#d9a622' },
  tran_thu_do: { age: 'old', brow: 'stern', mustache: 'full', beard: 'goatee', hair: '#7d7a74', head: 'futou', headColor: '#3b3650', body: 'official', bodyColor: '#8a2a2a' },
  le_phu_tran: { age: 'mid', brow: 'stern', mustache: 'full', beard: 'stubble', head: 'helmet', headColor: '#6f6a5c', body: 'armor', bodyColor: '#5e5646', props: ['plank'] },
  thanh_duc: { age: 'young', brow: 'stern', mustache: 'none', beard: 'none', head: 'helmet', headColor: '#8a2a1f', body: 'armor', bodyColor: '#a2321f', props: ['flag'] },
  tran_nhan_tong: { age: 'mid', brow: 'calm', mustache: 'thin', beard: 'goatee', head: 'crown', headColor: '#6b1d1a', body: 'imperial', bodyColor: '#e0b32a', props: ['halo'] },
  tran_hung_dao: { age: 'old', brow: 'stern', mustache: 'full', beard: 'long', hair: '#8b8780', head: 'helmet', headColor: '#a23a22', body: 'armor', bodyColor: '#7a1f1a', cape: RED, props: ['sword'] },
  tran_quang_khai: { age: 'mid', brow: 'calm', mustache: 'thin', beard: 'goatee', head: 'futou', headColor: '#34406a', body: 'official', bodyColor: '#5b3a7a' },
  tran_binh_trong: { age: 'young', brow: 'stern', mustache: 'thin', beard: 'none', head: 'helmet', headColor: '#6e4a2a', body: 'armor', bodyColor: '#9a3b1a', cape: '#6a2418', props: ['sword'] },
  tran_nhat_duat: { age: 'mid', brow: 'calm', mustache: 'thin', beard: 'goatee', head: 'prince', headColor: GOLD, body: 'robe', bodyColor: '#a2761f', props: ['scroll'] },
  tran_quoc_toan: { age: 'young', brow: 'stern', mustache: 'none', beard: 'none', head: 'topknot', headColor: RED, body: 'tunic', bodyColor: '#8a3a1e', props: ['banner', 'orange'] },
  tran_khanh_du: { age: 'mid', brow: 'stern', mustache: 'full', beard: 'goatee', head: 'helmet', headColor: '#1f5a7a', body: 'armor', bodyColor: '#1d5f86', props: ['waves'] },
  yet_kieu: { age: 'young', brow: 'stern', mustache: 'none', beard: 'none', skin: 'tan', head: 'wrap', headColor: '#2f6f8a', body: 'bare', bodyColor: '#2f6f8a', props: ['waves', 'chisel'] },
  pham_ngu_lao: { age: 'mid', brow: 'stern', mustache: 'full', beard: 'stubble', head: 'helmet', headColor: '#4a6a3a', body: 'armor', bodyColor: '#3f6a34', props: ['spear'] },
  quan_sat_that: { age: 'young', brow: 'stern', mustache: 'none', beard: 'none', skin: 'tan', head: 'band', headColor: RED, body: 'bare', bodyColor: '#6a4a2a', props: ['tattoo'] },
};

/** Sáu ký hiệu cách điệu như nét chữ Hán (14 × 16), thay cho sáu chữ "Phá cường địch, báo hoàng ân" trên cờ */
const GLYPHS = [
  'M2 3L12 3M7 3L7 15M2 8L12 8M3 13L11 13',
  'M3 2L3 15M3 2L12 2L12 15M3 8L12 8M3 15L12 15',
  'M2 5L12 5M7 2L7 15M3 15L11 15M4 10L10 10',
  'M2 3L12 3M3 3L3 15M11 3L11 15M3 9L11 9M7 3L7 15',
  'M7 2L7 15M2 6L12 6M3 12L11 12M3 15L5 12M11 15L9 12',
  'M2 2L12 2M2 2L2 15M2 9L12 9M12 9L12 15M7 2L7 9',
];

const W = 240;
const H = 288;
/** Tâm khuôn mặt */
const CX = 120;
const CY = 132;

/** Mặt, tai, cổ, dùng chung cho mọi nhân vật */
const FACE = 'M-38 -4C-38 -34 -22 -50 0 -50C22 -50 38 -34 38 -4C38 22 28 40 14 48C8 52 4 54 0 54C-4 54 -8 52 -14 48C-28 40 -38 22 -38 -4Z';

/** size là chiều rộng; accent là màu ánh sáng phía sau (màu hệ của nhân vật) */
export const HeroPortrait: React.FC<{ id: string; size: number; accent?: string; glow?: boolean }> = ({ id, size, accent, glow = true }) => {
  const look = LOOK[id];
  const gid = React.useId().replace(/:/g, '');
  if (!look) return null;
  const tone = SKIN[look.skin ?? 'light'];
  const hair = look.hair ?? '#2a211c';
  const bodyColor = look.bodyColor;
  const bd = dark(bodyColor, 0.35);
  const old = look.age === 'old';
  const young = look.age === 'young';
  const has = (p: Prop) => !!look.props?.includes(p);
  const q = (n: string) => `${n}-${gid}`;
  const url = (n: string) => `url(#${q(n)})`;
  const faceScale = young ? 0.94 : 1;

  /* ------------------------------------------------------------------ lớp sau lưng */
  const behind = (
    <G>
      {look.cape && (
        <G>
          <Path d="M2 288C2 234 34 194 80 184L120 200L160 184C206 194 238 234 238 288Z" fill={look.cape} />
          <Path d="M2 288C2 234 34 194 80 184L120 200L160 184C206 194 238 234 238 288Z" fill={url('capeShade')} />
        </G>
      )}
      {has('halo') && (
        <G>
          <Circle cx={CX} cy={CY - 6} r={92} fill={GOLD} opacity={0.14} />
          <Circle cx={CX} cy={CY - 6} r={92} fill="none" stroke={GOLD} strokeWidth={2.2} opacity={0.75} />
          <Circle cx={CX} cy={CY - 6} r={80} fill="none" stroke={GOLD_L} strokeWidth={1} opacity={0.5} />
        </G>
      )}
      {has('spear') && (
        <G>
          <Rect x={190} y={36} width={6} height={260} rx={2} fill="#6a4524" />
          <Rect x={190} y={36} width={2.4} height={260} fill="#8b6035" />
          <Path d="M193 4L203 40L193 46L183 40Z" fill="#cfd5d2" />
          <Path d="M193 4L193 46L183 40Z" fill="#9aa5a1" />
          <Path d="M186 46L200 46L204 74C198 66 188 66 182 74Z" fill={RED} />
        </G>
      )}
      {has('banner') && (
        <G>
          <Rect x={30} y={14} width={5} height={282} rx={2} fill="#6a4524" />
          <Circle cx={32.5} cy={14} r={5} fill={GOLD} />
          <Path d="M35 22L74 22L74 140L54.5 124L35 140Z" fill={RED} />
          <Path d="M35 22L74 22L74 140L54.5 124L35 140Z" fill="none" stroke={GOLD} strokeWidth={2} />
          {[0, 1, 2].map((i) => (
            <G key={i} fill="none" stroke={GOLD_L} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <Path transform={`translate(58 ${34 + i * 29})`} d={GLYPHS[i]} />
              <Path transform={`translate(41 ${34 + i * 29})`} d={GLYPHS[i + 3]} />
            </G>
          ))}
        </G>
      )}
      {has('flag') && (
        <G>
          <Rect x={196} y={20} width={5} height={276} rx={2} fill="#6a4524" />
          <Path d="M201 28L236 36L226 56L236 76L201 70Z" fill={RED} />
          <Circle cx={216} cy={52} r={8} fill={GOLD} />
          <Circle cx={216} cy={52} r={4} fill={RED} />
        </G>
      )}
    </G>
  );

  /** Mặt trời tỏa tia: vòng vàng, tám cánh và tâm màu áo */
  const rosette = (x: number, y: number, r: number) => (
    <G key={`${x}-${y}`}>
      <Circle cx={x} cy={y} r={r} fill={bd} />
      <Circle cx={x} cy={y} r={r} fill="none" stroke={GOLD} strokeWidth={r / 10} />
      {Array.from({ length: 8 }, (_, i) => (
        <Ellipse key={i} cx={x} cy={y - r * 0.58} rx={r * 0.15} ry={r * 0.27} fill={GOLD} transform={`rotate(${i * 45} ${x} ${y})`} />
      ))}
      <Circle cx={x} cy={y} r={r * 0.36} fill={bodyColor} stroke={GOLD_L} strokeWidth={r / 15} />
      <Circle cx={x} cy={y} r={r * 0.13} fill={GOLD_L} />
    </G>
  );

  /* ------------------------------------------------------------------ thân và cổ */
  const bodyPath = 'M6 288C6 244 30 214 78 202C92 210 106 214 120 214C134 214 148 210 162 202C210 214 234 244 234 288Z';
  const body = (
    <G>
      {/* cổ */}
      <Path d="M102 176L102 214C102 222 138 222 138 214L138 176Z" fill={tone.base} />
      <Path d="M102 176L138 176L138 196C128 204 112 204 102 196Z" fill={tone.shade} opacity={0.5} />
      {/* thân */}
      <Path d={bodyPath} fill={look.body === 'bare' ? tone.base : bodyColor} />
      {look.body === 'bare' && (
        <G>
          <Path d="M78 202C92 210 106 214 120 214C134 214 148 210 162 202C150 224 138 232 120 232C102 232 90 224 78 202Z" fill={tone.shade} opacity={0.5} />
          <Path d="M70 236C86 230 100 232 112 246M170 236C154 230 140 232 128 246" fill="none" stroke={tone.shade} strokeWidth={2} opacity={0.55} strokeLinecap="round" />
          {/* dây đai chéo ngực */}
          <Path d="M52 220L196 288L152 288L40 232Z" fill={look.headColor} />
          <Path d="M52 220L196 288L186 288L48 224Z" fill={light(look.headColor, 0.25)} opacity={0.8} />
        </G>
      )}
      {look.body === 'armor' && (
        <G>
          <Path d="M84 218L156 218L170 288L70 288Z" fill={bd} />
          <Path d="M84 218L156 218L170 288L70 288Z" fill={url('scale')} />
          <Path d="M120 218L120 288" stroke={GOLD} strokeWidth={2.4} />
          {/* giáp vai hình mặt trời tỏa tia (họa tiết trống đồng Đông Sơn) */}
          {[62, 178].map((x) => rosette(x, 226, 30))}
          {/* cổ giáp */}
          <Path d="M90 204Q120 230 150 204L152 218Q120 246 88 218Z" fill={GOLD} />
          <Path d="M90 204Q120 230 150 204" fill="none" stroke={GOLD_L} strokeWidth={2} />
          <Path d="M96 222Q120 244 144 222" fill="none" stroke={GOLD_D} strokeWidth={1.6} />
        </G>
      )}
      {look.body === 'imperial' && (
        <G>
          <Path d="M92 204L120 246L148 204L156 212L120 262L84 212Z" fill={light(bodyColor, 0.3)} />
          <Path d="M92 204L120 246L148 204" fill="none" stroke={dark(bodyColor, 0.35)} strokeWidth={2} />
          <Circle cx={120} cy={262} r={22} fill={dark(bodyColor, 0.25)} />
          <Circle cx={120} cy={262} r={22} fill="none" stroke={GOLD_L} strokeWidth={2} />
          {/* rồng cuộn tròn */}
          <Path d="M104 266C104 252 124 250 124 260C124 268 112 268 112 262C112 258 118 258 118 261M124 258C130 252 138 256 136 264" fill="none" stroke={GOLD_L} strokeWidth={2.6} strokeLinecap="round" />
          {[56, 184].map((x) => rosette(x, 238, 17))}
          <Path d="M8 288C10 266 20 252 34 244L34 288Z M232 288C230 266 220 252 206 244L206 288Z" fill={dark(bodyColor, 0.25)} opacity={0.8} />
        </G>
      )}
      {look.body === 'official' && (
        <G>
          <Path d="M90 204Q120 230 150 204L156 214Q120 246 84 214Z" fill={light(bodyColor, 0.35)} />
          <Path d="M90 204Q120 230 150 204" fill="none" stroke={dark(bodyColor, 0.4)} strokeWidth={2} />
          {/* bổ tử (ô vuông chức vị) */}
          <Rect x={94} y={246} width={52} height={42} rx={3} fill={dark(bodyColor, 0.28)} stroke={GOLD} strokeWidth={2.4} />
          <Path d="M104 276C108 258 120 254 120 262C120 268 112 268 114 262M132 276C128 258 120 254 120 262" fill="none" stroke={GOLD_L} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M8 288C10 268 22 254 38 246L38 288Z M232 288C230 268 218 254 202 246L202 288Z" fill={dark(bodyColor, 0.22)} opacity={0.7} />
        </G>
      )}
      {look.body === 'robe' && (
        <G>
          <Path d="M88 204L120 252L152 204L160 210L120 270L80 210Z" fill={light(bodyColor, 0.55)} />
          <Path d="M88 204L120 252L152 204" fill="none" stroke={dark(bodyColor, 0.35)} strokeWidth={2.2} />
          <Path d="M82 214L120 272L158 214" fill="none" stroke={GOLD} strokeWidth={2.4} />
          <Path d="M8 288C10 266 22 252 40 244L40 288Z M232 288C230 266 218 252 200 244L200 288Z" fill={dark(bodyColor, 0.2)} opacity={0.75} />
        </G>
      )}
      {look.body === 'tunic' && (
        <G>
          <Path d="M92 204L120 236L148 204L158 210L120 250L82 210Z" fill={light(bodyColor, 0.5)} />
          <Path d="M96 236L144 236L152 288L88 288Z" fill={dark(bodyColor, 0.2)} />
          <Path d="M96 250L144 250" stroke={GOLD} strokeWidth={3} />
          <Path d="M8 288C10 266 24 250 44 242L44 288Z M232 288C230 266 216 250 196 242L196 288Z" fill={dark(bodyColor, 0.22)} opacity={0.7} />
        </G>
      )}
    </G>
  );

  /* ------------------------------------------------------------------ mặt */
  const brow = look.brow === 'stern' ? ['M-28 -16Q-16 -17 -5 -10', 'M28 -16Q16 -17 5 -10'] : ['M-28 -13Q-16 -19 -5 -13', 'M28 -13Q16 -19 5 -13'];
  const face = (
    <G transform={`translate(${CX} ${CY}) scale(${faceScale})`}>
      {/* tai */}
      <Ellipse cx={-39} cy={4} rx={5.5} ry={11} fill={tone.shade} />
      <Ellipse cx={39} cy={4} rx={5.5} ry={11} fill={tone.shade} />
      <Path d={FACE} fill={url('skin')} />
      {/* bóng má và dưới chân tóc */}
      <Ellipse cx={-22} cy={20} rx={11} ry={8} fill="#d9704f" opacity={young ? 0.2 : 0.12} />
      <Ellipse cx={22} cy={20} rx={11} ry={8} fill="#d9704f" opacity={young ? 0.2 : 0.12} />
      <Path d="M-38 -4C-38 22 -28 40 -14 48C-26 40 -34 24 -34 -4Z" fill={tone.shade} opacity={0.35} />
      {/* mắt */}
      {[-16, 16].map((x) => (
        <G key={x}>
          <Path d={`M${x - 10} -4Q${x} -10 ${x + 10} -4Q${x} 0.5 ${x - 10} -4Z`} fill="#f6ede0" />
          <Circle cx={x} cy={-4.2} r={2.8} fill={INK} />
          <Circle cx={x + 0.9} cy={-5} r={0.9} fill="#fff" />
          <Path d={`M${x - 11} -4.5Q${x} -12.5 ${x + 11} -4.5`} fill="none" stroke={dark(tone.shade, 0.5)} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      ))}
      {/* lông mày */}
      {brow.map((d) => (
        <Path key={d} d={d} fill="none" stroke={old ? hair : mix(hair, '#000000', 0.2)} strokeWidth={old ? 4.4 : 3.6} strokeLinecap="round" />
      ))}
      {/* mũi */}
      <Path d="M0 -2C-1 10 -3 18 -8 21C-3 24 3 24 8 21C3 18 1 10 0 -2Z" fill={tone.shade} opacity={0.32} />
      <Path d="M-7 21Q0 25 7 21" fill="none" stroke={dark(tone.shade, 0.35)} strokeWidth={1.6} strokeLinecap="round" />
      {/* nếp nhăn người cao tuổi */}
      {old && (
        <G fill="none" stroke={dark(tone.shade, 0.3)} strokeWidth={1.3} strokeLinecap="round" opacity={0.6}>
          <Path d="M-16 -28Q0 -33 16 -28M-12 -23Q0 -26 12 -23" />
          <Path d="M-22 14Q-24 24 -18 32M22 14Q24 24 18 32" />
        </G>
      )}
      {/* miệng */}
      {look.mustache === 'none' && <Path d="M-9 33Q0 37 9 33" fill="none" stroke="#8a4636" strokeWidth={2.4} strokeLinecap="round" />}
      {/* râu */}
      {look.beard === 'stubble' && <Path d="M-34 8C-34 30 -22 46 0 52C22 46 34 30 34 8C30 28 20 38 0 40C-20 38 -30 28 -34 8Z" fill={hair} opacity={0.45} />}
      {look.beard === 'goatee' && (
        <G fill={hair}>
          <Path d="M-11 40C-12 54 -6 66 0 70C6 66 12 54 11 40C6 44 -6 44 -11 40Z" />
        </G>
      )}
      {look.beard === 'full' && <Path d="M-38 4C-38 38 -22 62 0 68C22 62 38 38 38 4C34 28 22 40 0 42C-22 40 -34 28 -38 4Z" fill={hair} />}
      {look.beard === 'long' && (
        <G fill={hair}>
          <Path d="M-38 2C-40 40 -26 70 -8 96C-4 102 4 102 8 96C26 70 40 40 38 2C34 28 22 42 0 44C-22 42 -34 28 -38 2Z" />
          <Path d="M-4 52C-6 70 -4 86 0 96C4 86 6 70 4 52Z" fill={light(hair, 0.18)} opacity={0.7} />
        </G>
      )}
      {look.mustache !== 'none' && (
        <Path
          d={look.mustache === 'full'
            ? 'M0 26C-8 23 -20 25 -28 33C-30 36 -26 38 -22 36C-14 32 -6 33 0 31C6 33 14 32 22 36C26 38 30 36 28 33C20 25 8 23 0 26Z'
            : 'M0 27C-6 25 -15 26 -22 31C-18 33 -8 31 0 30C8 31 18 33 22 31C15 26 6 25 0 27Z'}
          fill={hair}
        />
      )}
      {look.mustache !== 'none' && <Path d="M-6 36Q0 38 6 36" fill="none" stroke="#8a4636" strokeWidth={2} strokeLinecap="round" />}
    </G>
  );

  /* ------------------------------------------------------------------ mũ */
  const g = look.headColor;
  const headgear = (
    <G transform={`translate(${CX} ${CY})`}>
      {look.head === 'crown' && (
        <G>
          <Path d="M-38 -6C-40 -36 -22 -50 0 -50C22 -50 40 -36 38 -6C34 -24 18 -34 0 -34C-18 -34 -34 -24 -38 -6Z" fill={hair} />
          <Path d="M-36 -34L-30 -76L30 -76L36 -34Q0 -44 -36 -34Z" fill={g} />
          <Path d="M-30 -76L30 -76L32 -66Q0 -60 -32 -66Z" fill={light(g, 0.12)} />
          <Path d="M-12 -72L-12 -42M12 -72L12 -42" stroke={GOLD} strokeWidth={1.6} opacity={0.7} />
          <Path d="M-36 -34Q0 -44 36 -34L36 -28Q0 -38 -36 -28Z" fill={GOLD} />
          <Path d="M-36 -34Q0 -44 36 -34" fill="none" stroke={GOLD_L} strokeWidth={1.2} />
          <Rect x={-58} y={-90} width={116} height={13} rx={3} fill={dark(g, 0.05)} />
          <Rect x={-58} y={-90} width={116} height={13} rx={3} fill="none" stroke={GOLD} strokeWidth={2.2} />
          <Path d="M-14 -92L-9 -100L0 -94L9 -100L14 -92Z" fill={GOLD} />
          {Array.from({ length: 11 }, (_, i) => -50 + i * 10).map((x) => (
            <G key={x}>
              <Path d={`M${x} -77L${x} -54`} stroke={GOLD_L} strokeWidth={1.1} />
              <Circle cx={x} cy={-52} r={2.5} fill={PAPER} />
              <Circle cx={x} cy={-64} r={1.5} fill={GOLD_L} />
            </G>
          ))}
        </G>
      )}
      {look.head === 'futou' && (
        <G>
          {[-1, 1].map((s) => (
            <G key={s}>
              <Path d={`M${s * 30} -66L${s * 92} -70Q${s * 99} -67 ${s * 92} -63L${s * 30} -58Z`} fill={g} />
              <Path d={`M${s * 30} -66L${s * 92} -70Q${s * 99} -67 ${s * 92} -63`} fill="none" stroke={GOLD} strokeWidth={1.8} />
            </G>
          ))}
          <Path d="M-34 -42C-36 -64 -18 -78 0 -78C18 -78 36 -64 34 -42C22 -48 -22 -48 -34 -42Z" fill={g} />
          <Path d="M-36 -38Q0 -50 36 -38L36 -31Q0 -43 -36 -31Z" fill={GOLD} />
          <Path d="M-26 -62Q0 -68 26 -62" fill="none" stroke={light(g, 0.2)} strokeWidth={2} opacity={0.6} />
        </G>
      )}
      {look.head === 'helmet' && (
        <G>
          {/* mang tai */}
          {[-1, 1].map((s) => (
            <Path key={s} d={`M${s * 38} -30L${s * 46} 8L${s * 36} 14L${s * 33} -24Z`} fill={dark(g, 0.15)} stroke={GOLD_D} strokeWidth={1.2} />
          ))}
          <Path d="M-40 -30C-42 -62 -22 -78 0 -78C22 -78 42 -62 40 -30L38 -26C36 -44 20 -54 0 -54C-20 -54 -36 -44 -38 -26Z" fill={g} />
          <Path d="M-30 -62Q0 -74 30 -62" fill="none" stroke={light(g, 0.3)} strokeWidth={2.4} opacity={0.6} />
          <Path d="M-42 -36Q0 -52 42 -36L42 -28Q0 -44 -42 -28Z" fill={GOLD} />
          <Path d="M-42 -36Q0 -52 42 -36" fill="none" stroke={GOLD_L} strokeWidth={1.4} />
          <Circle cx={0} cy={-41} r={4.6} fill={RED} stroke={GOLD_L} strokeWidth={1.2} />
          <Path d="M-6 -78L6 -78L5 -90L-5 -90Z" fill={GOLD_D} />
          <Circle cx={0} cy={-93} r={5.5} fill={GOLD} />
          {has('sword') || look.cape ? (
            <Path d="M0 -97C-12 -108 -12 -124 2 -130C0 -118 10 -110 8 -99Z" fill={RED} />
          ) : (
            <Path d="M0 -97C-9 -105 -9 -116 1 -121C0 -112 7 -106 6 -99Z" fill={RED} />
          )}
        </G>
      )}
      {look.head === 'prince' && (
        <G>
          <Path d="M-38 -6C-40 -38 -22 -52 0 -52C22 -52 40 -38 38 -6C34 -26 18 -38 0 -38C-18 -38 -34 -26 -38 -6Z" fill={hair} />
          <Circle cx={0} cy={-64} r={15} fill={hair} />
          <Path d="M-16 -56Q0 -72 16 -56L12 -45L-12 -45Z" fill={GOLD} />
          <Path d="M-16 -56Q0 -72 16 -56" fill="none" stroke={GOLD_L} strokeWidth={1.4} />
          <Rect x={-30} y={-62} width={60} height={4.5} rx={2.2} fill={GOLD} />
          <Circle cx={-30} cy={-60} r={3.4} fill={GOLD_L} />
          <Circle cx={30} cy={-60} r={3.4} fill={GOLD_L} />
          <Circle cx={0} cy={-51} r={2.8} fill={RED} />
        </G>
      )}
      {look.head === 'topknot' && (
        <G>
          <Path d="M-38 -6C-40 -38 -22 -52 0 -52C22 -52 40 -38 38 -6C34 -26 18 -38 0 -38C-18 -38 -34 -26 -38 -6Z" fill={hair} />
          <Circle cx={0} cy={-63} r={13} fill={hair} />
          <Path d="M-38 -28Q0 -44 38 -28L38 -19Q0 -35 -38 -19Z" fill={g} />
          <Path d="M38 -24C54 -24 62 -10 56 6C60 -8 50 -16 38 -16Z" fill={g} />
          <Path d="M36 -20C48 -14 52 -2 46 12C48 -2 42 -10 34 -14Z" fill={dark(g, 0.2)} />
          <Circle cx={0} cy={-27} r={4.2} fill={GOLD} />
        </G>
      )}
      {look.head === 'wrap' && (
        <G>
          <Path d="M-38 -6C-40 -38 -22 -54 0 -54C22 -54 40 -38 38 -6C34 -28 18 -40 0 -40C-18 -40 -34 -28 -38 -6Z" fill={hair} />
          <Path d="M-38 -30Q0 -46 38 -30L38 -21Q0 -37 -38 -21Z" fill={g} />
          <Path d="M38 -26C54 -26 60 -10 52 4C56 -10 48 -18 38 -18Z" fill={g} />
          {/* tóc ướt nhỏ nước */}
          <Path d="M-38 -6C-40 6 -38 16 -34 22" fill="none" stroke={hair} strokeWidth={5} strokeLinecap="round" />
        </G>
      )}
      {look.head === 'band' && (
        <G>
          <Path d="M-38 -6C-40 -38 -22 -54 0 -54C22 -54 40 -38 38 -6C34 -28 18 -40 0 -40C-18 -40 -34 -28 -38 -6Z" fill={hair} />
          <Path d="M-38 -30Q0 -46 38 -30L38 -21Q0 -37 -38 -21Z" fill={g} />
          <Path d="M-38 -26C-54 -26 -60 -10 -52 4C-56 -10 -48 -18 -38 -18Z" fill={g} />
          <Circle cx={0} cy={-33} r={5} fill={PAPER} />
          <Circle cx={0} cy={-33} r={2.4} fill={g} />
        </G>
      )}
    </G>
  );

  /* ------------------------------------------------------------------ vật biểu trưng phía trước */
  const front = (
    <G>
      {has('plank') && (
        <G transform="rotate(-24 50 236)">
          <Rect x={4} y={196} width={110} height={34} rx={3} fill="#9a7345" />
          <Rect x={4} y={196} width={110} height={34} rx={3} fill="none" stroke="#5e4422" strokeWidth={2} />
          <Path d="M10 207L108 207M10 219L108 219" stroke="#7d5a32" strokeWidth={1.6} />
          <Circle cx={14} cy={213} r={2.2} fill="#4a3519" />
          <Circle cx={104} cy={213} r={2.2} fill="#4a3519" />
        </G>
      )}
      {has('sword') && (
        <G>
          <Path d="M190 176L206 198L198 206L180 188Z" fill={GOLD} />
          <Rect x={168} y={186} width={34} height={7} rx={3} transform="rotate(42 185 190)" fill={GOLD_D} />
          <Path d="M178 190L150 218L156 224L184 196Z" fill="#cfd5d2" />
          <Circle cx={198} cy={178} r={6} fill={RED} stroke={GOLD_L} strokeWidth={1.6} />
        </G>
      )}
      {has('orange') && (
        <G>
          <Circle cx={190} cy={256} r={19} fill="#ee8a1c" />
          <Circle cx={190} cy={256} r={19} fill="none" stroke="#b85f08" strokeWidth={1.6} />
          <Path d="M178 250Q184 244 192 246" fill="none" stroke="#ffd08a" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
          <Path d="M190 238C190 232 196 230 200 232C198 238 194 240 190 238Z" fill="#3f8a3a" />
          <Rect x={189} y={234} width={2.6} height={6} rx={1} fill="#5a3a1a" />
        </G>
      )}
      {has('scroll') && (
        <G>
          <Rect x={150} y={242} width={74} height={26} rx={13} transform="rotate(-12 187 255)" fill="#f2e6c4" />
          <Rect x={150} y={242} width={74} height={26} rx={13} transform="rotate(-12 187 255)" fill="none" stroke={GOLD_D} strokeWidth={2.2} />
          <Circle cx={158} cy={258} r={11} fill={GOLD} transform="rotate(-12 187 255)" />
          <Path d="M174 252L212 244M176 260L214 252" stroke="#6a4a2a" strokeWidth={1.6} opacity={0.7} />
        </G>
      )}
      {has('chisel') && (
        <G>
          <Path d="M184 200L204 176L212 182L192 206Z" fill="#cfd5d2" />
          <Rect x={176} y={198} width={22} height={9} rx={3} transform="rotate(-40 187 202)" fill="#6a4524" />
        </G>
      )}
      {has('waves') && (
        <G opacity={0.95}>
          <Path d="M0 252C20 242 40 262 60 252C80 242 100 262 120 252C140 242 160 262 180 252C200 242 220 262 240 252L240 288L0 288Z" fill="#1d6f9a" opacity={0.85} />
          <Path d="M0 266C20 256 40 276 60 266C80 256 100 276 120 266C140 256 160 276 180 266C200 256 220 276 240 266L240 288L0 288Z" fill="#27a0c0" opacity={0.85} />
          <Path d="M10 252C16 246 26 246 32 252M96 252C102 246 112 246 118 252M170 252C176 246 186 246 192 252" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </G>
      )}
      {has('tattoo') && (
        <G transform="translate(30 236) rotate(12)" fill="none" stroke="#2a1a16" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
          <Path transform="translate(0 0) scale(1.2)" d={GLYPHS[4]} />
          <Path transform="translate(0 22) scale(1.2)" d={GLYPHS[1]} />
        </G>
      )}
    </G>
  );

  return (
    <View aria-hidden pointerEvents="none">
    <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <RadialGradient id={q('glow')} cx="50%" cy="46%" r="50%">
          <Stop offset="0" stopColor={accent ?? GOLD} stopOpacity={0.5} />
          <Stop offset="0.6" stopColor={accent ?? GOLD} stopOpacity={0.14} />
          <Stop offset="1" stopColor={accent ?? GOLD} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={q('skin')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={tone.shade} />
          <Stop offset="0.28" stopColor={tone.light} />
          <Stop offset="0.62" stopColor={tone.base} />
          <Stop offset="1" stopColor={tone.shade} />
        </LinearGradient>
        <LinearGradient id={q('fade')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" />
          <Stop offset="0.8" stopColor="#fff" />
          <Stop offset="1" stopColor="#000" />
        </LinearGradient>
        <LinearGradient id={q('capeShade')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </LinearGradient>
        <Pattern id={q('scale')} width="16" height="14" patternUnits="userSpaceOnUse">
          <Rect width="16" height="14" fill="none" />
          <Path d="M0 7Q8 18 16 7M-8 0Q0 11 8 0M8 0Q16 11 24 0" fill="none" stroke={GOLD_D} strokeWidth={1.2} opacity={0.75} />
        </Pattern>
        <Mask id={q('mask')} x="0" y="0" width={W} height={H} maskUnits="userSpaceOnUse">
          <Rect width={W} height={H} fill={url('fade')} />
        </Mask>
      </Defs>
      {glow && <Circle cx={CX} cy={CY + 6} r={118} fill={url('glow')} />}
      <G mask={url('mask')}>
        {behind}
        {body}
        {face}
        {headgear}
        {front}
      </G>
    </Svg>
    </View>
  );
};
