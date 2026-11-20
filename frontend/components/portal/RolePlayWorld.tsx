/** Original voxel illustration. This imaginary diorama never replaces a historical/geographical map. */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { IntroChapter } from '@/lib/roleplay-story';

const point = (x: number, z: number): [number, number] => [450 + (x - z) * 30, 95 + (x + z) * 15];
const Cube: React.FC<{ x: number; y: number; w?: number; d?: number; h: number; top: string; left: string; right: string }> = ({ x, y, w = 30, d = 15, h, top, left, right }) => <G>
  <Path d={`M${x},${y-h}l${w},${d} -${w},${d} -${w},-${d}Z`} fill={top} />
  <Path d={`M${x-w},${y+d-h}l${w},${d}v${h}l-${w},-${d}Z`} fill={left} />
  <Path d={`M${x},${y+2*d-h}l${w},-${d}v${h}l-${w},${d}Z`} fill={right} />
</G>;
export const BlockPerson: React.FC<{ x: number; y: number; robe?: string; scale?: number }> = ({ x, y, robe = '#bd5140', scale = 1 }) => <G transform={`translate(${x},${y}) scale(${scale})`}>
  <Ellipse cy={11} rx={19} ry={8} fill="#142c24" opacity={0.25} />
  <Rect x={-11} y={-9} width={9} height={23} fill="#3e3a36" /><Rect x={3} y={-9} width={9} height={23} fill="#55504a" />
  <Cube x={0} y={-23} w={14} d={6} h={22} top="#e08c64" left={robe} right="#8e3d34" />
  <Rect x={-20} y={-39} width={7} height={24} fill={robe} /><Rect x={14} y={-35} width={7} height={24} fill={robe} />
  <Rect x={-20} y={-17} width={7} height={7} fill="#e8b68a" /><Rect x={14} y={-13} width={7} height={7} fill="#e8b68a" />
  <Cube x={0} y={-50} w={16} d={7} h={22} top="#3d3027" left="#f1c398" right="#d4a077" />
  <Path d="M-16-65l16 7 16-7v7l-16 7-16-7z" fill="#d7aa4c" />
  <Rect x={-11} y={-55} width={4} height={4} fill="#2c2d2b" /><Rect x={-4} y={-52} width={4} height={4} fill="#2c2d2b" />
  <Path d="M-5-40l10 4" stroke="#9c6246" strokeWidth={2} />
  <Path d="M-14-25l14 6 14-6v5l-14 6-14-6z" fill="#edc264" />
</G>;

export const RolePlayWorld: React.FC<{ mood?: IntroChapter['mood']; player?: [number, number]; small?: boolean }> = ({ mood = 'village', player = [6, 6], small = false }) => {
  const night = mood === 'empire' || mood === 'border';
  return <View style={{ width: '100%', height: small ? 180 : undefined, aspectRatio: small ? undefined : 900 / 480, minHeight: small ? undefined : 240 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width="100%" height="100%" viewBox="0 0 900 480" preserveAspectRatio="xMidYMid meet">
      <Rect width={900} height={480} fill={night ? '#192e36' : '#254e4b'} />
      <Circle cx={740} cy={74} r={39} fill={night ? '#d7e0cf' : '#ffe3a0'} opacity={0.8} />
      <Path d="M0 200l110-97 76 53L290 47l106 124 88-76 113 75L727 60l173 124v118H0Z" fill={night ? '#27464b' : '#3b6860'} />
      <Path d="M0 242l126-78 140 63 131-88 140 105 107-78 112 65 144-95v210H0Z" fill={night ? '#345352' : '#47796a'} />
      <Ellipse cx={451} cy={438} rx={322} ry={28} fill="#102c2b" opacity={0.55} />
      {Array.from({ length: 21 }, (_, sum) => Array.from({ length: 11 }, (__, x) => {
        const z = sum-x;
        if (z < 0 || z > 10) return null;
        const [px, py] = point(x,z);
        const water = (x === 7 || x === 8) && z < 8;
        const path = z === 5 || (x === 5 && z > 4);
        const stone = x >= 2 && x <= 5 && z <= 3;
        return <Cube key={`${x}-${z}`} x={px} y={py} h={water ? 5 : 15} top={water ? '#4fadb5' : stone ? '#a8aa91' : path ? '#cdb27d' : (x+z)%3 ? '#80a665' : '#98b276'} left={water ? '#347e8e' : '#93754e'} right={water ? '#29697a' : '#705b42'} />;
      }))}
      {[0,1,2,3,4].map(i => { const [x,y]=point(1+i,1); return <Cube key={`wall${i}`} x={x} y={y} h={43} top="#d1c4a4" left="#a39578" right="#81745c" />; })}
      {[1,5].map(i => { const [x,y]=point(i,1); return <G key={`tower${i}`}><Cube x={x} y={y} w={34} d={17} h={86} top="#c7b899" left="#c0ac88" right="#978366" /><Cube x={x} y={y-80} w={39} d={20} h={12} top="#a75b45" left="#884434" right="#693a31" /><Path d={`M${x},${y-80}v-40h34l-8 9 8 9h-34`} fill="#cb5c43" stroke="#705039" strokeWidth={3} /></G>; })}
      {[[2,8],[3,8],[4,9],[9,8]].map(([a,b],i)=>{ const[x,y]=point(a,b);return <G key={`house${i}`}><Cube x={x} y={y} w={27} d={14} h={36} top="#d5c195" left="#c1a272" right="#94734d" /><Cube x={x} y={y-34} w={34} d={18} h={12} top="#b8774c" left="#955e3b" right="#734b32" /><Path d={`M${x-14},${y-15}l8 4v22l-8-4z`} fill="#4e4738" /></G>;})}
      {[[0,3],[1,9],[10,9],[10,2],[0,7],[9,10]].map(([a,b],i)=>{const[x,y]=point(a,b);return <G key={`tree${i}`}><Cube x={x} y={y} w={7} d={4} h={35} top="#ab8556" left="#846440" right="#5d4831" /><Cube x={x} y={y-25} w={24} d={12} h={27} top="#59965e" left="#3c7b51" right="#2b5e44" /><Cube x={x} y={y-48} w={18} d={9} h={17} top="#78aa69" left="#548953" right="#376d47" /></G>;})}
      {[5,6,7,8].map(a=>{const[x,y]=point(a,5);return <Cube key={`bridge${a}`} x={x} y={y} h={18} top="#c29962" left="#866343" right="#684d36" />;})}
      <BlockPerson x={point(3,3)[0]} y={point(3,3)[1]} robe="#3c6e89" scale={0.68} />
      <BlockPerson x={point(6,8)[0]} y={point(6,8)[1]} robe="#aa884b" scale={0.6} />
      <BlockPerson x={point(player[0],player[1])[0]} y={point(player[0],player[1])[1]} scale={0.87} />
      {(mood === 'empire' || mood === 'border') ? <G>{[0,1,2].map(i => <G key={i} transform={`translate(${175+i*46},${101-i*8})`}><Path d="M0 34V-15h28l-7 9 7 8H0" stroke="#b7a187" strokeWidth={3} fill="#a54f3f" /><BlockPerson x={14} y={43} scale={0.4} robe="#57677a" /></G>)}</G> : null}
    </Svg>
  </View>;
};
