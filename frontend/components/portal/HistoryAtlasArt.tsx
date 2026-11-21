/** Original 2D cartographic symbols over authentic geographic relief. No video imagery is used. */
import React from 'react';
import { Circle, Defs, Ellipse, G, Image, Marker, Path, Rect, Symbol as SvgSymbol, Text, Use } from 'react-native-svg';
import { ATLAS_CAMERA, ATLAS_PLACES, ATLAS_REGIONS, ATLAS_ROUTES, findAtlasPlace, geoPath, geoPoint, routePosition } from '@/lib/roleplay-atlas';
import type { IntroChapter } from '@/lib/roleplay-story';

export interface AtlasArtProps { chapter: IntroChapter; progress: number; selected: string | null; onSelect: (id: string) => void; pixelWidth: number; zoom?: number; interactive?: boolean }
export function atlasCamera(chapter: IntroChapter, zoom = 1): readonly number[] {
  const [x,y,w,h] = ATLAS_CAMERA[chapter.id] ?? ATLAS_CAMERA.foundation;
  const focus=findAtlasPlace(chapter.id==='warning'?'dai-viet':chapter.places[0]);
  const [cx,cy]=zoom>1&&focus?geoPoint(focus.at):[x+w/2,y+h/2];
  return [cx-w/zoom/2,cy-h/zoom/2,w/zoom,h/zoom];
}
export const HistoryAtlasArt: React.FC<AtlasArtProps> = ({ chapter, progress, selected, onSelect, pixelWidth, zoom = 1, interactive = false }) => {
  const camera = atlasCamera(chapter,zoom), s = 1400/camera[2], unit = 1400/Math.max(300,pixelWidth);
  const route = chapter.route ? ATLAS_ROUTES[chapter.route] : null;
  const position = route ? routePosition(route,progress) : geoPoint([107,47.3]);
  const next = route ? routePosition(route,Math.min(1,progress+0.01)) : position;
  const previous = route ? routePosition(route,Math.max(0,progress-0.01)) : position;
  const forward = route && (progress>=0.99?position[0]<previous[0]:next[0]<position[0]) ? -1 : 1;
  const places = ATLAS_PLACES.filter(place => chapter.places.includes(place.id));
  const size = unit/s;
  const compact=pixelWidth<600, primary=selected??chapter.places[0];
  return <G>
    <Defs>
      <Marker id="atlas-arrow" markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto"><Path d="M0,0 L7,3.5 L0,7 L2,3.5Z" fill="#ffe7b0" /></Marker>
      <SvgSymbol id="atlas-rider" viewBox="0 0 30 32">
        <Ellipse cx={15} cy={29} rx={13} ry={2.3} fill="#1d2015" opacity={0.28}/>
        <Path d="M4 17Q0 12 1 22L5 20M7 22L5 28H8L12 22M17 22L19 28H22L21 21M21 17L23 10 28 11 30 15 25 17 23 22H10L6 18 9 14Z" fill="#5b3a25" stroke="#312c20" strokeWidth={0.8}/>
        <Path d="M23 10L23 6 25 9 28 9 27 12M10 16L12 23H17L17 18" fill="#232b28"/>
        <Path d="M10 14L11 7 17 7 20 15 17 18 12 17Z" fill="#788080" stroke="#272d2b" strokeWidth={0.7}/>
        <Path d="M11 8L10 14 18 15M11 11L18 12M11 13L18 14" fill="none" stroke="#c4b99b" strokeWidth={0.6}/>
        <Circle cx={14} cy={5.5} r={2.8} fill="#b99971"/><Path d="M11 5L11 3 14 1 17 3V5Z" fill="#4a5351"/><Path d="M14 1L14 0" stroke="#a14e38" strokeWidth={1.5}/>
        <Path d="M17 9L21 13 24 13" fill="none" stroke="#b99971" strokeWidth={1.6}/><Path d="M19 13L24 1" stroke="#d7c7a4" strokeWidth={0.75}/>
        <Path d="M8 15L15 16 19 15 18 20 11 20Z" fill="#a94535" stroke="#dfc27c" strokeWidth={0.6}/>
      </SvgSymbol>
      <SvgSymbol id="atlas-city" viewBox="0 0 40 34">
        <Path d="M2 32V18H8V12H13V18H27V12H32V18H38V32Z" fill="#d7ccb0" stroke="#484c35" strokeWidth={1.5}/>
        <Path d="M0 19L5 12 10 19M25 19L30 12 40 19M11 14L20 5 29 14Z" fill="#705044" stroke="#453d31" strokeWidth={1.2}/>
        <Path d="M13 31V15H27V31M17 32V25Q20 20 23 25V32" fill="#af9b73" stroke="#484c35" strokeWidth={1.3}/>
        <Path d="M5 24V27M10 24V27M30 24V27M35 24V27M18 18V20M23 18V20" stroke="#3a4233" strokeWidth={2}/>
        <Path d="M20 5V0L29 2 20 4" fill="#ad4937" stroke="#634132" strokeWidth={0.6}/>
      </SvgSymbol>
    </Defs>
    <Image href={require('@/assets/roleplay-atlas/eurasia-relief.webp')} x={0} y={0} width={1400} height={650} preserveAspectRatio="none" />
    <Rect width={1400} height={650} fill="#294a34" opacity={0.06}/>
    {ATLAS_REGIONS.filter(region=>region.from<=chapter.year).map(region=><Path key={region.from} d={geoPath(region.points,true)} fill="#c73426" fillOpacity={region.from===chapter.year ? 0.25+progress*0.32 : 0.45} stroke="#f8d1a0" strokeWidth={0.8*size} strokeOpacity={0.8} strokeDasharray={`${5*size} ${2*size}`} />)}
    {chapter.year>=1238 && ['moscow','kyiv'].filter(id=>id==='moscow'||chapter.year>=1240).map(id=>{
      const place=ATLAS_PLACES.find(p=>p.id===id)!; const [x,y]=geoPoint(place.at);
      return <Ellipse key={id} cx={x} cy={y} rx={id==='moscow'?40:25} ry={id==='moscow'?24:18} fill="#ad3c2c" opacity={0.22}/>;
    })}
    {[
      {text:'THẢO NGUYÊN MÔNG CỔ',at:[104,54.8] as const}, {text:'TRUNG Á',at:[77,48] as const},
      {text:'CÁC CÔNG QUỐC RUS’',at:[39,60] as const}, {text:'BIỂN ĐEN',at:[34,42.7] as const}, {text:'BIỂN CASPI',at:[51.4,41.5] as const},
    ].map(label=>{ const [x,y]=geoPoint(label.at); if(x<camera[0]||x>camera[0]+camera[2]||y<camera[1]||y>camera[1]+camera[3]) return null;
      return <Text key={label.text} x={x} y={y} fill="#172f28" fillOpacity={0.77} fontSize={12*size} letterSpacing={1.6*size} fontWeight="700" textAnchor="middle">{label.text}</Text>;
    })}
    {route && <G>
      <Path d={geoPath(route)} fill="none" stroke="#643128" strokeOpacity={0.7} strokeWidth={6*size} />
      <Path d={geoPath(route)} fill="none" stroke="#ffe1a1" strokeWidth={2.8*size} strokeDasharray={`${8*size} ${5*size}`} markerEnd="url(#atlas-arrow)" />
    </G>}
    {(route || chapter.id==='foundation') && <G transform={`translate(${position[0]},${position[1]+30*size}) scale(${size*(compact?0.6:0.78)})`}>
      {Array.from({length:compact?12:24},(_,i)=><Use key={i} href="#atlas-rider" x={(i%(compact?4:6)-(compact?1.5:2.5))*21} y={(Math.floor(i/(compact?4:6))-1.5)*22} width={30} height={32} transform={forward<0?'scale(-1,1)':undefined}/>)}
    </G>}
    {places.map(place=>{
      const [x,y]=geoPoint(place.at), active=selected===place.id, end=x>camera[0]+camera[2]*0.63;
      const name=place.id==='kalka'?'Kalka · khu vực ước lệ':place.name, labelWidth=name.length*7.7+20;
      const showLabel=!compact||primary===place.id;
      return <G key={place.id} id={`atlas-place-${place.id}`} transform={`translate(${x},${y}) scale(${size})`} onPress={interactive?()=>onSelect(place.id):undefined}>
        <Circle r={place.kind==='battle'?18:9} fill={place.kind==='home'?'#1e6652':'#4e3324'} fillOpacity={0.35} stroke={active?'#fff3be':'#fff0c6'} strokeWidth={active?3:1.5} strokeDasharray={place.kind==='battle'?'4 3':undefined}/>
        {place.kind==='city'&&showLabel?<Use href="#atlas-city" x={-20} y={-32} width={40} height={34}/>:<Circle r={4} fill={place.kind==='home'?'#b9f0b0':'#ffe4a3'} />}
        {showLabel&&<G><Rect x={end?-labelWidth-15:15} y={-12} width={labelWidth} height={29} rx={4} fill={active?'#fff0bd':'#f5edce'} fillOpacity={0.96} stroke="#7e6c44" strokeWidth={0.7}/>
        <Text x={end?-25:25} y={7} fill="#29392b" fontFamily="Georgia, serif" fontWeight="700" fontSize={14} textAnchor={end?'end':'start'}>{name}</Text></G>}
        {place.kind==='home' && <Circle r={22} fill="none" stroke="#e8e9a4" strokeWidth={1.5} />}
      </G>;
    })}
    {(chapter.id==='moscow'||chapter.id==='kyiv') && progress>0.6 && <G opacity={0.25+progress*0.2}>
      {Array.from({length:5},(_,i)=>{const [x,y]=geoPoint(places[0].at);return <Ellipse key={i} cx={x+(i-2)*4*size} cy={y-(15+i*6)*size} rx={(6+i*2)*size} ry={(9+i*2)*size} fill="#453c32" opacity={0.36}/>;})}
    </G>}
  </G>;
};
