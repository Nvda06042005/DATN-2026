import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { BookOpen, Compass, Flag, MapPin, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react-native';
import { Btn, Sheet, Txt } from '@/components/ui';
import { GameButton } from './StudentDesign';
import { HistoryAtlas } from './HistoryAtlas';
import { useReduceMotion } from '@/hooks/use-motion';
import { HISTORY_SOURCES, ROLEPLAY_CHAPTERS } from '@/lib/roleplay-story';
import { advanceAtlas, type AtlasPlayback } from '@/lib/atlas-playback';
import { findAtlasPlace } from '@/lib/roleplay-atlas';

export function RolePlayMapIntro({onDone}:{onDone:()=>void}) {
  const {width}=useWindowDimensions(), calm=useReduceMotion(), compact=width<700;
  const [player,setPlayer]=useState<AtlasPlayback>({index:0,elapsed:0,playing:false});
  const [selected,setSelected]=useState<string|null>(null), [sources,setSources]=useState(false), [zoom,setZoom]=useState(1);
  const current=ROLEPLAY_CHAPTERS[player.index], progress=current.duration ? Math.min(1,player.elapsed/current.duration) : 1, place=selected?findAtlasPlace(selected):undefined;
  useEffect(()=>{
    if(!player.playing||calm) return;
    let frame=0,last=0;
    const tick=(now:number):void=>{
      if(last && (typeof document==='undefined'||!document.hidden)) setPlayer(state=>advanceAtlas(state,(now-last)/1000,ROLEPLAY_CHAPTERS.map(ch=>ch.duration)));
      last=now; frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick); return()=>cancelAnimationFrame(frame);
  },[player.playing,calm]);
  useEffect(()=>{setSelected(null);setZoom(1);},[player.index]);
  useEffect(()=>{if(calm) setPlayer(state=>({...state,playing:false}));},[calm]);
  const go=(index:number):void=>{const next=Math.max(0,Math.min(ROLEPLAY_CHAPTERS.length-1,index));setPlayer({index:next,elapsed:ROLEPLAY_CHAPTERS[next].duration,playing:false});};
  const toggle=():void=>setPlayer(state=>state.playing?{...state,playing:false}:{...state,elapsed:state.elapsed>=current.duration?0:state.elapsed,playing:current.duration>0});
  return <View testID="roleplay-intro" style={{flex:1,backgroundColor:'#17271e'}}>
    <ScrollView contentContainerStyle={{maxWidth:1460,width:'100%',alignSelf:'center',padding:compact?12:24,paddingBottom:36,gap:16}} keyboardShouldPersistTaps="handled">
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'space-between',alignItems:'center'}}>
        <View style={{gap:4,flexShrink:1}}><Txt f="bold" size={12} color="#dfbd78" style={{letterSpacing:2}}>ĐÔNG A · BẢN ĐỒ KỂ CHUYỆN</Txt><Txt f="heavy" size={compact?23:30} color="#faf0d4" accessibilityRole="header">Từ thảo nguyên đến cửa ngõ Đại Việt</Txt></View>
        <Btn title="Chọn chặng đã mở" icon={Compass} tone="giay" onPress={onDone} testID="intro-skip"/>
      </View>
      <View style={{borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#85734c',backgroundColor:'#24372c'}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:compact?12:16,borderBottomWidth:1,borderColor:'#83714b',backgroundColor:'#25372c'}}>
          <View style={{backgroundColor:'#e4c382',borderRadius:7,paddingHorizontal:14,paddingVertical:7}}><Txt testID="intro-year" f="heavy" size={compact?17:22} color="#332a1c">{current.time}</Txt></View>
          <Txt f="bold" size={compact?15:20} color="#fff0cd" style={{flex:1}} accessibilityLiveRegion="polite">{current.title}</Txt>
        </View>
        <HistoryAtlas chapter={current} progress={calm?1:progress} selected={selected} onSelect={setSelected} pixelWidth={Math.min(1410,width-(compact?26:50))} zoom={zoom} calm={calm}/>
        <View style={{paddingHorizontal:12,paddingVertical:9,backgroundColor:'#1c2e24',flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}><Txt size={12} color="#edcf99">● Vùng bành trướng minh họa</Txt><Txt size={12} color="#d5dfcd">┄ Hướng tiến quân khái quát</Txt></View>
          <View style={{flexDirection:'row',gap:5}}>{([{key:'out',label:'Thu nhỏ bản đồ',Icon:Minus},{key:'in',label:'Phóng to bản đồ',Icon:Plus},{key:'reset',label:'Đặt lại bản đồ',Icon:RotateCcw}] as const).map(({key,label,Icon})=><Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={()=>setZoom(value=>key==='reset'?1:Math.max(1,Math.min(1.8,value+(key==='in'?0.2:-0.2))))} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:8,backgroundColor:'#384c3b'}}><Icon size={18} color="#f1d8a2"/></Pressable>)}</View>
        </View>
        <View style={{height:4,backgroundColor:'#54664b'}}><View style={{height:4,width:`${progress*100}%`,backgroundColor:'#e9c77b'}}/></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:3}} accessibilityRole="tablist" accessibilityLabel="Dòng thời gian câu chuyện">
        {ROLEPLAY_CHAPTERS.map((chapter,index)=><Pressable key={chapter.id} testID={`intro-chapter-${chapter.id}`} accessibilityRole="tab" accessibilityLabel={`${chapter.time}: ${chapter.title}`} accessibilityState={{selected:player.index===index}} onPress={()=>go(index)} style={{minHeight:44,paddingHorizontal:15,paddingVertical:11,borderRadius:9,borderWidth:1,borderBottomWidth:3,borderColor:player.index===index?'#b59555':'#607155',backgroundColor:player.index===index?'#e9cd90':'#2c4332'}}><Txt f="bold" size={14} color={player.index===index?'#342f22':'#e2e8d5'}>{chapter.id==='mission'?'Nhận vai':chapter.time}</Txt></Pressable>)}
      </ScrollView>
      <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <View style={{flexDirection:'row',gap:9,flexWrap:'wrap'}}>
          <Btn title="Cảnh trước" tone="giay" disabled={player.index===0} onPress={()=>go(player.index-1)} testID="intro-prev"/>
          {!calm&&current.duration>0?<GameButton title={player.playing?'Tạm dừng':'Phát câu chuyện'} icon={player.playing?Pause:Play} light onPress={toggle} testID="intro-play"/>:null}
          <Btn title="Xem từ đầu" icon={RotateCcw} tone="giay" onPress={()=>setPlayer({index:0,elapsed:0,playing:false})}/>
        </View>
        <GameButton title={player.index===ROLEPLAY_CHAPTERS.length-1?'Nhận quân lệnh':'Cảnh tiếp theo'} icon={player.index===ROLEPLAY_CHAPTERS.length-1?Flag:BookOpen} light onPress={()=>player.index===ROLEPLAY_CHAPTERS.length-1?onDone():go(player.index+1)} testID="intro-next"/>
      </View>
      <View style={{flexDirection:width>=1000?'row':'column',gap:16}}>
        <View style={{flex:width>=1000?1:undefined,padding:compact?18:23,borderRadius:16,backgroundColor:'#f7efd9',gap:11}}>
          <Txt f="bold" size={12} color="#846239" style={{letterSpacing:1.5}}>LỜI DẪN · {player.index+1}/{ROLEPLAY_CHAPTERS.length}</Txt>
          <Txt testID="intro-narration" size={compact?16:18} color="#344330" style={{lineHeight:compact?27:30}}>{current.body}</Txt>
          <View style={{borderTopWidth:1,borderColor:'#d7c9aa',paddingTop:12}}><Txt f="semibold" size={16} color="#69502f">{current.question}</Txt></View>
        </View>
        <View style={{width:width>=1000?360:'100%',padding:19,borderRadius:16,borderWidth:1,borderColor:'#5e7255',gap:12}}>
          <Txt f="bold" size={13} color="#eed39c">CHẠM ĐỊA DANH ĐỂ KHÁM PHÁ</Txt>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{current.places.map(id=>{const point=findAtlasPlace(id)!;return <Pressable key={id} testID={`intro-place-${id}`} accessibilityRole="button" accessibilityState={{selected:selected===id}} accessibilityLabel={`Khám phá ${point.name}`} onPress={()=>setSelected(id)} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:9,borderRadius:9,backgroundColor:selected===id?'#eed19a':'#3d5540'}}><MapPin size={16} color={selected===id?'#4b3c23':'#eadbb6'}/><Txt size={14} f="bold" color={selected===id?'#4b3c23':'#eadbb6'}>{point.name}</Txt></Pressable>;})}</View>
          {place?<View testID="intro-place-detail" style={{gap:5}}><Txt f="bold" size={16} color="#ffdda1">{place.name}</Txt><Txt size={15} color="#e0e6d5" style={{lineHeight:25}}>{place.text}</Txt></View>:<Txt size={15} color="#c6d2bc" style={{lineHeight:25}}>Theo dõi màu đỏ, mũi tên và đoàn kỵ binh để hiểu không gian của câu chuyện.</Txt>}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Xem nguồn lịch sử và bản đồ" onPress={()=>setSources(true)} testID="intro-sources" style={{minHeight:44,justifyContent:'center',alignSelf:'flex-start'}}><Txt size={13} color="#cddac3" style={{textDecorationLine:'underline'}}>Nguồn sử liệu và bản đồ · Natural Earth, bảo tàng, SGK Bài 14</Txt></Pressable>
    </ScrollView>
    <Sheet open={sources} onClose={()=>setSources(false)} title="Nguồn lịch sử và bản đồ 2D">
      <View style={{gap:15}}><Txt f="bold" size={17}>Cảnh đang xem</Txt><Txt size={16}>{current.source}</Txt>
        {Object.entries(HISTORY_SOURCES).filter(([key])=>current.sources.includes(key)).map(([key,source])=><View key={key} style={{gap:5}}><Txt size={16}>{source.title}</Txt>{source.url?<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(source.url!)} style={{minHeight:44,justifyContent:'center'}}><Txt size={15} color="#237363" style={{textDecorationLine:'underline'}}>Mở nguồn đối chiếu</Txt></Pressable>:null}</View>)}
        <Txt f="bold" size={17}>Nền địa hình</Txt><Txt size={16}>Made with Natural Earth. Dữ liệu địa hình thuộc public domain, giới hạn 10°Đ–150°Đ, 5°B–70°B. Đây là nền địa lý để định hướng, không có biên giới quốc gia hiện đại.</Txt>
        <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.naturalearthdata.com/downloads/50m-raster-data/50m-cross-blend-hypso/')} style={{minHeight:44,justifyContent:'center'}}><Txt size={15} color="#237363" style={{textDecorationLine:'underline'}}>Nguồn Natural Earth</Txt></Pressable>
        <Txt size={16}>Các vùng tô đỏ, hướng tiến quân, hình kỵ binh và thành thị là lớp minh họa khái quát; không thể hiện biên giới hay quân số chính xác. Không dùng hình, logo hoặc âm thanh từ video. Vai liên lạc và nhiệm vụ nhập vai là hư cấu. Xem đoạn dẫn không cộng điểm hoặc mở khóa chặng.</Txt>
      </View>
    </Sheet>
  </View>;
}
