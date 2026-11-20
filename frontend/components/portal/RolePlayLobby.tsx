/** Intro narration and the roleplay mission lobby. Narrative exploration never awards server progress. */
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { BookOpen, Check, Compass, Flag, Footprints, Lock, Play, RotateCcw, ScrollText, Shield, Swords } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { canExploreStage, canReplayBattle, INTRO_PLACES, ROLEPLAY_CHAPTERS } from '@/lib/roleplay-story';
import type { Session } from '@/components/auth';
import { RolePlayWorld } from '@/components/portal/RolePlayWorld';
import { LoadState, SagaHeader, SagaPage, StarRow, TONE, useLoad, type SagaNav } from '@/components/portal/SagaKit';
import { GameButton, STUDENT as S } from '@/components/portal/StudentDesign';
import { Btn, Card, Sheet, Txt } from '@/components/ui';
import type { CampaignView } from '@/types/saga';

// A narrative preference for this authenticated session only; never an unlock or a stored credential.
const INTRO_SEEN = new Set<string>();

export function RolePlayIntro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1060;
  const [chapter, setChapter] = useState(0);
  const [place, setPlace] = useState<typeof INTRO_PLACES[number] | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [sources, setSources] = useState(false);
  const current = ROLEPLAY_CHAPTERS[chapter];
  return <View testID="roleplay-intro" style={{ flex: 1, backgroundColor: '#142c32' }}>
    <ScrollView contentContainerStyle={{ maxWidth: 1440, width: '100%', alignSelf: 'center', padding: width < 640 ? 16 : 26, paddingBottom: 38, gap: 20 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <View style={{ gap: 5 }}><Txt f="bold" size={12} color="#edc978" style={{ letterSpacing: 2 }}>ĐÔNG A · BIÊN NIÊN KÍ</Txt><Txt f="heavy" size={width < 600 ? 26 : 32} color="#ffffff" accessibilityRole="header">Hào khí từ những điều bình dị</Txt></View>
        <Btn title="Chọn chặng đã mở" icon={Compass} tone="giay" onPress={onDone} testID="intro-skip" />
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0, borderWidth: 1, borderColor: '#3d6364', borderRadius: 22, overflow: 'hidden', backgroundColor: '#254e4b' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#1b3c40' }}><Compass size={19} color="#edc978" /><Txt f="bold" size={14} color="#e3eee6" style={{ flex: 1 }}>Thế giới khối Đông A</Txt><Txt size={12} color="#c2d7cd">Phối cảnh hư cấu</Txt></View>
          <RolePlayWorld mood={current.mood} player={place ? [place.x, place.z] : undefined} />
          <View style={{ padding: 15, gap: 11 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}><Txt size={14} color="#e1ede1">Chạm một địa điểm để khám phá bối cảnh</Txt><Txt f="bold" size={13} color="#ffdc8d">Đã xem {visited.length}/3</Txt></View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {INTRO_PLACES.map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Khám phá ${p.name}`} accessibilityState={{ selected: place?.id === p.id }} testID={`intro-place-${p.id}`} onPress={() => { setPlace(p); setVisited((v) => v.includes(p.id) ? v : [...v, p.id]); }}
                style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: place?.id === p.id ? '#edc978' : '#365e5b', borderWidth: 1, borderBottomWidth: 3, borderColor: place?.id === p.id ? '#ae8542' : '#4b7870', borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {visited.includes(p.id) ? <Check size={15} color={place?.id === p.id ? '#40341d' : '#ddede3'} /> : <Flag size={15} color={place?.id === p.id ? '#40341d' : '#ddede3'} />}<Txt f="bold" size={14} color={place?.id === p.id ? '#40341d' : '#ddede3'}>{p.name}</Txt>
              </Pressable>)}
            </View>
            {place ? <View testID="intro-place-detail" style={{ padding: 14, borderRadius: 13, backgroundColor: '#1b3e40', gap: 5 }}><Txt f="bold" size={15} color="#ffdc8d">{place.name}</Txt><Txt size={16} color="#e2eee5" style={{ lineHeight: 25 }}>{place.text}</Txt></View> : null}
          </View>
        </View>
        <View style={{ width: wide ? 360 : '100%', padding: wide ? 24 : 20, borderRadius: 22, backgroundColor: '#f7f0dc', gap: 17, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}><ScrollText size={18} color="#9a6635" /><Txt f="bold" size={12} color="#79562f" style={{ flex: 1, letterSpacing: 0.8 }}>{current.time}</Txt></View>
          <Txt testID="intro-chapter-title" f="heavy" size={26} color="#273e36" accessibilityRole="header" accessibilityLiveRegion="polite">{current.title}</Txt>
          <Txt testID="intro-narration" size={17} color="#3d5043" style={{ lineHeight: 28 }}>{current.body}</Txt>
          <View style={{ gap: 9, borderTopWidth: 1, borderTopColor: '#d7c9a9', paddingTop: 15 }}><Txt f="bold" size={13} color="#79562f">MANG THEO MỘT CÂU HỎI</Txt><Txt f="semibold" size={16} color="#384d3b" style={{ lineHeight: 25 }}>{current.question}</Txt></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Shield size={22} color="#7b603a" /><Txt size={13} color="#6a614c" style={{ flex: 1 }}>Vai của em: tân binh liên lạc. Nhân vật và nhiệm vụ nhập vai là hư cấu.</Txt></View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} accessibilityRole="tablist" accessibilityLabel="Các cảnh mở đầu">
          {ROLEPLAY_CHAPTERS.map((ch, i) => <Pressable key={ch.id} testID={`intro-chapter-${ch.id}`} accessibilityRole="tab" accessibilityLabel={`Cảnh ${i+1}: ${ch.title}`} accessibilityState={{ selected: chapter === i }} onPress={() => setChapter(i)} style={{ minWidth: 36, minHeight: 44, justifyContent: 'center' }}><View style={{ width: 30, height: 7, borderRadius: 3, backgroundColor: chapter === i ? '#f1cc75' : i < chapter ? '#83b3a1' : '#42615f' }} /></Pressable>)}
          <Txt size={13} color="#d5e7dc">{chapter+1}/{ROLEPLAY_CHAPTERS.length}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}><Btn title="Cảnh trước" tone="giay" disabled={chapter === 0} onPress={() => setChapter((i) => Math.max(0,i-1))} testID="intro-prev" />
          <GameButton title={chapter === ROLEPLAY_CHAPTERS.length-1 ? 'Nhận quân lệnh' : 'Tiếp câu chuyện'} icon={chapter === ROLEPLAY_CHAPTERS.length-1 ? Flag : BookOpen} light onPress={() => chapter === ROLEPLAY_CHAPTERS.length-1 ? onDone() : setChapter((i) => Math.min(ROLEPLAY_CHAPTERS.length-1,i+1))} testID="intro-next" />
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Xem nguồn lịch sử và phân biệt phần sáng tạo" onPress={() => setSources(true)} testID="intro-sources" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Txt size={13} color="#d0e2d5" style={{ textDecorationLine: 'underline' }}>Nguồn: Bài 14, SGK tr. 68–73 và bản Tổng hợp lịch sử · Xem chi tiết</Txt></Pressable>
    </ScrollView>
    {sources ? <Sheet open onClose={() => setSources(false)} title="Nguồn lịch sử và phần sáng tạo">
      <View style={{ gap: 15 }}><Txt size={16}>Nguồn chính: Lịch sử và Địa lí 7 – Kết nối tri thức với cuộc sống, Bài 14, trang in 68–73 (trang 69–74 của tệp PDF bạn cung cấp).</Txt><Txt size={16}>Đối chiếu: Tổng hợp lịch sử, phần 1 (các vua), phần 2 (ba cuộc kháng chiến). Các hướng tiến quân không được tự gọi thành “đường lớn, đường nhỏ”.</Txt><Txt f="bold" size={16}>Cảnh đang xem</Txt><Txt size={16}>{current.source}</Txt><Txt size={16}>Làng, doanh trại, nhân vật liên lạc và lời giao nhiệm vụ là sáng tạo của trò chơi. Sa bàn khối minh họa bối cảnh; bản đồ địa lý và sử liệu của chặng vẫn dùng nguồn đã ghi công. Khám phá intro không cộng điểm hay mở khóa chặng.</Txt></View>
    </Sheet> : null}
  </View>;
}

export function RolePlayLobby({ session, nav }: { session: Session; nav: SagaNav }) {
  const [intro, setIntro] = useState(() => !INTRO_SEEN.has(session.token));
  const data = useLoad<CampaignView[]>(session, (t) => Promise.all([1,2,3].map((n) => saga.campaign(t,n))), []);
  const next = nav.home?.next ?? null;
  if (intro) return <RolePlayIntro onDone={() => { INTRO_SEEN.add(session.token); setIntro(false); }} />;
  return <SagaPage testID="saga-roleplay" max={1320}>
    <SagaHeader title="Doanh trại nhập vai" subtitle="Nhận quân lệnh, tìm nhân vật và khám phá bối cảnh trong thế giới khối Đông A."
      actions={<Btn title="Xem lại mở đầu" icon={RotateCcw} tone="giay" onPress={() => setIntro(true)} testID="roleplay-intro-replay" />} />
    <View style={{ borderRadius: 21, overflow: 'hidden', backgroundColor: '#244a45', flexDirection: 'row', alignItems: 'center', padding: 18, gap: 18 }}>
      <View style={{ flex: 1, gap: 9 }}><Txt f="heavy" size={23} color="#fff5d6">Quân lệnh đang chờ em</Txt><Txt size={16} color="#d7e9db" style={{ lineHeight: 25 }}>Học kiến thức và hoàn thành luyện tập để mở cảnh nhập vai. Trong cảnh, dùng WASD / phím mũi tên hoặc chạm để đi, nhấn E để tương tác.</Txt>{next ? <GameButton title={`Mở chặng: ${next.title}`} light icon={Play} onPress={() => nav.go('chien-dich',{ c: next.campaign_no,s: next.stage_id,v: null })} testID="roleplay-next" /> : null}</View>
    </View>
    {!data.data ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : data.data.map((cv) => {
      const tone = TONE[cv.map.campaign_no] ?? TONE[1];
      return <View key={cv.map.campaign_no} style={{ gap: 15 }} testID={`roleplay-campaign-${cv.map.campaign_no}`}>
        <View style={{ gap: 4 }}><Txt f="bold" size={13} color={tone.text}>{tone.label} · {tone.years}</Txt><Txt f="heavy" size={22} accessibilityRole="header">{cv.map.title}</Txt></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{cv.stages.map((st) => {
          const canExplore = canExploreStage(st), canBattle = canReplayBattle(st);
          return <Card key={st.id} flat pad={17} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 410, borderRadius: 18, borderBottomWidth: 4, gap: 13 }} testID={`roleplay-stage-${st.code}`}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{canExplore ? <Footprints size={22} color={S.teal} /> : <Lock size={22} color={S.muted} />}<Txt f="bold" size={13} color={canExplore ? S.teal : S.muted}>{st.steps.explore === 'done' ? 'Đã hoàn thành' : canExplore ? 'Sẵn sàng nhận lệnh' : 'Chưa mở'}</Txt></View>
            <Txt f="heavy" size={18}>{st.title}</Txt><Txt size={13} color={S.muted}>{st.date_label} · {st.place}</Txt>
            <Txt size={16} color={S.muted}>{canExplore ? st.summary : st.lock_reason ?? 'Hoàn thành phần học và luyện tập của chặng để mở cảnh nhập vai.'}</Txt>
            {st.battle_stars > 0 ? <StarRow n={st.battle_stars} /> : null}
            <View style={{ marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn title={st.steps.explore === 'done' ? 'Khám phá lại' : 'Nhập vai'} icon={Footprints} tone="son" disabled={!canExplore} onPress={() => { if (canExplore) nav.go('chien-dich',{ c: st.campaign_no,s: st.id,v: 'kham-pha' }); }} testID={`roleplay-explore-${st.code}`} />
              {st.has_battle ? <Btn title="Đánh lại trận" icon={Swords} tone="giay" disabled={!canBattle} onPress={() => { if (canBattle) nav.go('chien-dich',{ c: st.campaign_no,s: st.id,v: 'tran' }); }} testID={`roleplay-battle-${st.code}`} /> : null}
            </View>
          </Card>;
        })}</View>
      </View>;
    })}
    <Txt size={14} color={S.muted}>Nhân vật, lời thoại và thế giới khối là phần sáng tạo phục vụ học tập. Diễn biến, kết quả lịch sử xem trong sử liệu có nguồn của từng chặng.</Txt>
  </SagaPage>;
}
