/** Intro narration and the roleplay mission lobby. Narrative exploration never awards server progress. */
import { useState } from 'react';
import { View } from 'react-native';
import { Footprints, Lock, Play, RotateCcw, Swords } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { canExploreStage, canReplayBattle } from '@/lib/roleplay-story';
import type { Session } from '@/components/auth';
import { RolePlayMapIntro as RolePlayIntro } from '@/components/portal/RolePlayMapIntro';
export { RolePlayMapIntro as RolePlayIntro } from '@/components/portal/RolePlayMapIntro';
import { LoadState, SagaHeader, SagaPage, StarRow, TONE, useLoad, type SagaNav } from '@/components/portal/SagaKit';
import { GameButton, STUDENT as S } from '@/components/portal/StudentDesign';
import { Btn, Card, Txt } from '@/components/ui';
import type { CampaignView } from '@/types/saga';

// A narrative preference for this authenticated session only; never an unlock or a stored credential.
const INTRO_SEEN = new Set<string>();

export function RolePlayLobby({ session, nav }: { session: Session; nav: SagaNav }) {
  const [intro, setIntro] = useState(() => !INTRO_SEEN.has(session.token));
  const data = useLoad<CampaignView[]>(session, (t) => Promise.all([1,2,3].map((n) => saga.campaign(t,n))), []);
  const next = nav.home?.next ?? null;
  if (intro) return <RolePlayIntro onDone={() => { INTRO_SEEN.add(session.token); setIntro(false); }} />;
  return <SagaPage testID="saga-roleplay" max={1320}>
    <SagaHeader title="Doanh trại nhập vai" subtitle="Theo bản đồ 2D, tìm hiểu bối cảnh và bước vào những chặng lịch sử đã mở."
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
    <Txt size={14} color={S.muted}>Nhân vật, lời thoại và các cảnh địa phương minh họa là phần sáng tạo phục vụ học tập. Diễn biến, kết quả lịch sử xem trong sử liệu có nguồn của từng chặng.</Txt>
  </SagaPage>;
}
