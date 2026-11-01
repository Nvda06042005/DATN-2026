/**
 * Mô phỏng trận đánh của học sinh (Sprint 6, HK.HS.028, 051–057, 061): danh sách trận đánh có trạng thái mở khóa và điểm cao nhất, màn giới thiệu, chơi theo lượt
 * (quyết định, bố trí lực lượng trên bản đồ) với phản hồi lịch sử sau từng bước, kết quả – sao – điểm, chơi lại, tiếp tục lượt dở, hoạt ảnh diễn biến trên bản đồ.
 * Máy chủ giữ đáp án và chấm điểm; giao diện chỉ hiển thị và gửi lựa chọn. Trạng thái luôn kèm chữ, không chỉ dựa vào màu.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BookOpen, CheckCircle2, CircleDot, Clapperboard, Film, Lock, MapPin, MinusCircle, Pause, Play, RotateCcw, SkipBack, SkipForward, Swords, Trophy, XCircle } from 'lucide-react-native';
import * as api from '@/api/battleApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LeafletMap, type MapCircle, type MapLine, type MapMarker } from '@/components/portal/LeafletMap';
import { Bar, Btn, Card, Chip, EmptyState, Inset, Sheet, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BattleAnimation, BattleListItem, BattleRun, MiniListItem, PlacementView, ScenarioIntro, StepOutcome, StepView } from '@/types/battle';
import { DIFFICULTY_LABEL } from '@/types/battle';

export type OpenLink = (type: string, id: number) => void;
const seconds = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} giây`;

// ---------------------------------------------------------------------- danh sách (HK.HS.051)
export interface BattleOpeners { onPlay: (scenarioId: number, title: string, restart?: boolean) => void; onAnimation: (scenarioId: number, title: string) => void; onMini: (id: number, title: string, restart?: boolean) => void; onOpenLink: OpenLink }

const BattleCard: React.FC<{ item: BattleListItem; onPress: () => void }> = ({ item, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.battle_name}${item.year ? `, năm ${item.year}` : ''}. ${item.locked ? 'Chưa mở khóa' : item.active_run ? 'Đang chơi dở' : 'Đã mở'}${item.best.stars ? `, ${item.best.stars} sao` : ''}`} onPress={onPress} testID={`battle-card-${item.id}`}
      style={({ pressed }) => ({ borderRadius: 18, borderWidth: 2, borderColor: item.locked ? c.vien : c.dong, backgroundColor: pressed ? c.the2 : c.the, padding: 14, gap: 8, opacity: item.locked ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: item.locked ? c.vien : c.son, alignItems: 'center', justifyContent: 'center' }}>{item.locked ? <Lock size={24} color={c.muc3} /> : <Swords size={26} color="#ffffff" />}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt f="displayHeavy" size={18}>{item.battle_name}</Txt>
          <Txt size={13} color={c.muc2}>{[item.date_text ?? (item.year ? String(item.year) : null), item.campaign_title].filter(Boolean).join(' · ')}</Txt>
        </View>
      </View>
      {item.summary ? <Txt size={14} color={c.muc2} numberOfLines={2}>{item.summary}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip text={`Độ khó: ${DIFFICULTY_LABEL[item.difficulty] ?? 'Vừa'}`} bg={c.dichNhat} fg={c.dich} />
        <Chip text={`${item.steps} bước`} bg={c.thuyNhat} fg={c.thuyChu} />
        {item.locked ? <Chip text="Chưa mở khóa" bg={c.dichNhat} fg={c.dich} icon={Lock} /> : null}
        {item.active_run ? <Chip text="Đang chơi dở" bg={c.vangNhat} fg={c.vangChu} /> : null}
        {item.best.plays ? <><Stars n={item.best.stars} size={16} /><Txt size={13} color={c.muc2}>Cao nhất {item.best.points} điểm</Txt></> : null}
      </View>
    </Pressable>
  );
};

const MiniCard: React.FC<{ item: MiniListItem; onPress: () => void }> = ({ item, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.kind_label}: ${item.title}`} onPress={onPress} testID={`mini-card-${item.id}`}
      style={({ pressed }) => ({ borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, padding: 14, gap: 6 })}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip text={item.kind_label} bg={c.thuyNhat} fg={c.thuyChu} />
        <Txt size={12} color={c.muc3}>{Math.round(item.seconds / 60) >= 1 ? `${Math.round(item.seconds / 60)} phút` : `${item.seconds} giây`} · {item.points} điểm</Txt>
        {item.active_run ? <Chip text="Đang chơi dở" bg={c.vangNhat} fg={c.vangChu} /> : null}
      </View>
      <Txt f="bold" size={16}>{item.title}</Txt>
      {item.description ? <Txt size={14} color={c.muc2}>{item.description}</Txt> : null}
      {item.best.plays ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Stars n={item.best.stars} size={16} /><Txt size={13} color={c.muc2}>Cao nhất {item.best.percent}%</Txt></View> : null}
    </Pressable>
  );
};

export const BattlesTab: React.FC<{ session: Session; refreshKey: number } & BattleOpeners> = ({ session, refreshKey, onPlay, onAnimation, onMini, onOpenLink }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.battleList(session.token), [session.token, refreshKey], session.expired);
  const [intro, setIntro] = useState<number | null>(null);
  const data = list.data;
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Trận đánh mô phỏng</Txt>
      <Txt size={14} color={c.muc2}>Vào vai người chỉ huy, ra quyết định từng bước và bố trí lực lượng. Mỗi quyết định đều có phản hồi đối chiếu với diễn biến lịch sử thật.</Txt>
      <ErrorNote message={list.error} />
      {list.loading && !data ? <Spinner /> : null}
      {data && data.battles.length === 0 ? <EmptyState mood="thinking" title="Chưa có trận đánh mô phỏng" text="Các trận đánh sẽ xuất hiện khi nội dung được giáo viên Lịch sử duyệt và phát hành." /> : null}
      {(data?.battles ?? []).map((b) => <BattleCard key={b.id} item={b} onPress={() => setIntro(b.id)} />)}
      {data && data.minigames.length ? (
        <View style={{ gap: 10 }}>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">Mini-game lịch sử</Txt>
          {data.minigames.map((m) => <MiniCard key={m.id} item={m} onPress={() => onMini(m.id, m.title)} />)}
        </View>
      ) : null}
      {intro !== null ? <IntroSheet session={session} id={intro} onClose={() => setIntro(null)} onPlay={(id, title, restart) => { setIntro(null); onPlay(id, title, restart); }} onAnimation={(id, title) => { setIntro(null); onAnimation(id, title); }} onOpenLink={(t, id) => { setIntro(null); onOpenLink(t, id); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- giới thiệu (HK.HS.052)
const IntroSheet: React.FC<{ session: Session; id: number; onClose: () => void; onPlay: (id: number, title: string, restart?: boolean) => void; onAnimation: (id: number, title: string) => void; onOpenLink: OpenLink }> = ({ session, id, onClose, onPlay, onAnimation, onOpenLink }) => {
  const { c } = useTheme();
  const intro = useLoad(() => api.scenarioIntro(session.token, id), [session.token, id], session.expired);
  const d: ScenarioIntro | null = intro.data;
  return (
    <Sheet open onClose={onClose} title={d?.battle.name ?? 'Trận đánh'} subtitle={d ? [d.battle.date_text, d.battle.campaign_title].filter(Boolean).join(' · ') : undefined}
      footer={d ? (
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn title="Đóng" tone="giay" onPress={onClose} />
          {d.active_run ? <Btn icon={RotateCcw} title="Làm lại từ đầu" tone="giay" disabled={d.locked} onPress={() => onPlay(d.id, d.title, true)} /> : null}
          <Btn icon={d.active_run ? Play : d.replay ? RotateCcw : Swords} title={d.active_run ? 'Tiếp tục trận đánh' : d.replay ? 'Chơi lại' : 'Vào trận'} tone="ngoc" disabled={d.locked} onPress={() => onPlay(d.id, d.title)} testID="battle-start" />
        </View>
      ) : undefined}>
      <ErrorNote message={intro.error} />
      {intro.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          {d.locked ? <Inset style={{ backgroundColor: c.dichNhat, flexDirection: 'row', gap: 8, alignItems: 'center' }}><Lock size={18} color={c.dich} /><Txt size={14} style={{ flex: 1 }}>Trận này nằm trong hành trình của em. Hoàn thành các nút trước đó để mở khóa.</Txt></Inset> : null}
          <View><Txt f="bold" size={13} color={c.muc2}>Tình hình</Txt><Txt size={15} style={{ lineHeight: 23 }}>{d.intro.situation}</Txt></View>
          {d.intro.forces ? <View><Txt f="bold" size={13} color={c.muc2}>Lực lượng</Txt><Txt size={15} style={{ lineHeight: 23 }}>{d.intro.forces}</Txt></View> : null}
          <Card flat pad={12} style={{ borderColor: c.dong }}><Txt f="bold" size={13} color={c.dongChu}>Nhiệm vụ của người chỉ huy</Txt><Txt f="semibold" size={16}>{d.intro.objective}</Txt></Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`${d.steps} bước`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`Thắng khi đạt ${d.pass_percent}% điểm`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`Toàn thắng +${d.bonus_points} điểm`} bg={c.dongNhat} fg={c.dongChu} />
          </View>
          {d.best.plays ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Stars n={d.best.stars} size={22} /><Txt size={14}>Kỷ lục của em: {d.best.points} điểm ({d.best.percent}%) sau {d.best.plays} lượt</Txt></View> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {d.has_animation ? <Btn icon={Film} title="Xem hoạt ảnh diễn biến" tone="thuy" size="sm" onPress={() => onAnimation(d.id, d.title)} testID="battle-animation" /> : null}
            <Btn icon={BookOpen} title="Hồ sơ trận đánh" tone="giay" size="sm" onPress={() => onOpenLink('battle', d.battle.id)} />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- chơi (HK.HS.053–057, 061)
const Choice: React.FC<{ text: string; selected: boolean; disabled?: boolean; onPress: () => void }> = ({ text, selected, disabled, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 2, borderColor: selected ? c.ngoc : c.vien, backgroundColor: selected ? c.ngocNhat : pressed ? c.giay2 : c.the })}>
      {selected ? <CircleDot size={20} color={c.ngocChu} /> : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.muc3 }} />}
      <Txt f={selected ? 'bold' : 'medium'} size={16} style={{ flex: 1, lineHeight: 23 }}>{text}</Txt>
    </Pressable>
  );
};

const PlacementInput: React.FC<{ step: PlacementView; center: [number, number]; zoom: number; draft: Record<string, { lat: number; lng: number }>; setDraft: (v: Record<string, { lat: number; lng: number }>) => void; result?: StepOutcome | null }> = ({ step, center, zoom, draft, setDraft, result }) => {
  const { c } = useTheme();
  const [selected, setSelected] = useState(step.pieces[0]?.id ?? '');
  const place = (lat: number, lng: number) => {
    if (result || !selected) return;
    const next = { ...draft, [selected]: { lat, lng } };
    setDraft(next);
    const after = step.pieces.find((p) => !next[p.id]);
    if (after) setSelected(after.id);
  };
  const markers: MapMarker[] = [
    ...step.zones.map((z) => ({ id: `z${z.id}`, lat: z.lat, lng: z.lng, label: z.label, tone: 'dong' as const })),
    ...Object.entries(draft).map(([id, p]) => { const piece = step.pieces.find((x) => x.id === id); const ok = result?.pieces?.find((x) => x.id === id)?.ok; return { id: `p${id}`, lat: p.lat, lng: p.lng, label: `${piece?.label ?? id}${result ? (ok ? ' ✓' : ' ✗') : ''}`, tone: result ? (ok ? 'ngoc' as const : 'son' as const) : 'thuy' as const }; }),
  ];
  const circles: MapCircle[] = step.zones.map((z) => ({ lat: z.lat, lng: z.lng, radiusKm: z.radius_km, tone: 'dong' }));
  const fit = useMemo(() => step.zones.map((z) => [z.lat, z.lng] as [number, number]), [step]);
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Chọn một lực lượng, rồi bấm vào bản đồ (hoặc chọn một khu vực trong danh sách bên dưới) để đặt. Bấm lại để dời vị trí.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {step.pieces.map((p) => {
          const on = p.id === selected, done = Boolean(draft[p.id]);
          return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${p.label}${done ? ', đã đặt' : ', chưa đặt'}`} disabled={Boolean(result)} onPress={() => setSelected(p.id)}
              style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 2, borderColor: on ? c.thuy : c.vien, backgroundColor: on ? c.thuyNhat : c.the }}>
              {done ? <CheckCircle2 size={16} color={c.mocChu} /> : <MapPin size={16} color={c.muc3} />}
              <Txt f="semibold" size={14}>{p.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      <LeafletMap label="Bản đồ trận đánh: bấm để đặt lực lượng đã chọn" markers={markers} circles={circles} onMapPress={place} height={340} center={center} zoom={zoom} fit={fit} />
      {!result ? (
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={13} color={c.muc2}>Khu vực trên bản đồ</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {step.zones.map((z) => <Btn key={z.id} icon={MapPin} title={z.label} tone="giay" size="sm" onPress={() => place(z.lat, z.lng)} />)}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const FeedbackCard: React.FC<{ outcome: StepOutcome; onOpenLink: OpenLink }> = ({ outcome, onOpenLink }) => {
  const { c } = useTheme();
  const partial = !outcome.correct && outcome.score > 0;
  const tone = outcome.correct ? { bg: c.ngocNhat, fg: c.ngocChu, Icon: CheckCircle2, text: 'Phù hợp với lịch sử' } : partial ? { bg: c.vangNhat, fg: c.vangChu, Icon: MinusCircle, text: 'Đúng một phần' } : { bg: c.sonNhat, fg: c.sonChu, Icon: XCircle, text: 'Chưa phù hợp với lịch sử' };
  return (
    <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
      <Inset style={{ backgroundColor: tone.bg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <tone.Icon size={24} color={tone.fg} />
        <View style={{ flex: 1 }}><Txt f="displayHeavy" size={20} color={tone.fg}>{tone.text}</Txt><Txt size={14} color={tone.fg}>+{outcome.score}/{outcome.max} điểm</Txt></View>
      </Inset>
      <Card flat pad={14} style={{ gap: 6 }}><Txt f="bold" size={14} color={c.muc2}>Đối chiếu diễn biến thật</Txt><Txt size={15} style={{ lineHeight: 23 }}>{outcome.feedback}</Txt></Card>
      {outcome.consequence ? <Card flat pad={14} style={{ gap: 4 }}><Txt f="bold" size={14} color={c.muc2}>Hệ quả</Txt><Txt size={15}>{outcome.consequence}</Txt></Card> : null}
      {!outcome.correct && outcome.best ? <Card flat pad={14} style={{ gap: 4 }}><Txt f="bold" size={14} color={c.muc2}>Lựa chọn phù hợp nhất với lịch sử</Txt><Txt f="semibold" size={15}>{outcome.best}</Txt></Card> : null}
      {outcome.pieces ? <View style={{ gap: 4 }}>{outcome.pieces.map((p) => <Txt key={p.id} size={14} color={p.ok ? c.ngocChu : c.sonChu}>{p.ok ? '✓' : '✗'} {p.label}: {p.ok ? 'đặt đúng khu vực' : 'chưa đúng khu vực'}</Txt>)}</View> : null}
      {outcome.links.length ? (
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={13} color={c.muc2}>Xem thêm trong kho lịch sử</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{outcome.links.map((l) => <Btn key={`${l.ref_type}${l.ref_id}`} title={l.label} tone="thuy" size="sm" onPress={() => onOpenLink(l.ref_type, l.ref_id)} />)}</View>
        </View>
      ) : null}
    </View>
  );
};

const ResultCard: React.FC<{ run: BattleRun; onReplay: () => void; onClose: () => void; onAnimation?: () => void; onOpenLink: OpenLink }> = ({ run, onReplay, onClose, onAnimation, onOpenLink }) => {
  const { c } = useTheme();
  const r = run.result!;
  const title = r.outcome === 'full_win' ? 'Toàn thắng!' : r.outcome === 'win' ? 'Chiến thắng!' : 'Chưa thắng, thử lại nhé';
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 8, backgroundColor: r.passed ? c.ngocNhat : c.the2 }}>
        <Trophy size={40} color={r.passed ? c.ngocChu : c.muc3} />
        <Txt f="displayHeavy" size={26} center accessibilityRole="header">{title}</Txt>
        <Txt f="displayHeavy" size={44}>{r.percent}%</Txt>
        <Txt size={14} color={c.muc2} center>Em đạt {r.score}/{r.max} điểm · cần {run.pass_percent}% để thắng · {seconds(r.duration_ms)}</Txt>
        <Stars n={r.stars} size={30} />
        <Txt f="bold" size={16}>{r.score + r.bonus} điểm{r.bonus ? ` (gồm ${r.bonus} điểm thưởng toàn thắng)` : ''}</Txt>
      </Card>
      {run.mode === 'preview' ? <Chip text="Chơi thử: không ghi điểm hay tiến độ" bg={c.dichNhat} fg={c.dich} /> : null}
      {r.xp_awarded > 0 || r.card_drop || r.node_result ? (
        <Card flat pad={14} style={{ gap: 6 }}>
          {r.xp_awarded > 0 ? <Txt f="bold" size={15} color={c.ngocChu}>+{r.xp_awarded} điểm vào tài khoản của em</Txt> : r.passed && run.mode === 'play' ? <Txt size={14} color={c.muc2}>Điểm chỉ tăng khi em vượt kỷ lục cũ.</Txt> : null}
          {r.card_drop ? <Txt f="bold" size={15} color={c.dongChu}>Em nhận được một thẻ nhân vật! Hãy vào “Bộ sưu tập” để lật thẻ.</Txt> : null}
          {r.node_result?.unlocked_sources.length ? <Txt size={14}>Tư liệu mới mở khóa: {r.node_result.unlocked_sources.map((s) => s.title).join(', ')}</Txt> : null}
          {r.node_result?.next_node && r.passed ? <Txt size={14} color={c.muc2}>Nút tiếp theo đã mở: {r.node_result.next_node.title}</Txt> : null}
          {r.node_result?.journey_completed ? <Txt f="bold" size={15} color={c.dongChu}>Em đã hoàn thành cả hành trình!</Txt> : null}
        </Card>
      ) : null}
      <View style={{ gap: 8 }}>
        <Txt f="displayHeavy" size={20} accessibilityRole="header">Nhìn lại các quyết định</Txt>
        {run.history.map((h, i) => (
          <Card key={h.step_id} flat pad={12} style={{ gap: 6, borderLeftWidth: 5, borderLeftColor: h.correct ? c.ngoc : h.score > 0 ? c.vang : c.son }}>
            <Txt f="bold" size={13} color={c.muc2}>Bước {i + 1} · {h.title} · {h.score}/{h.max} điểm</Txt>
            <Txt size={14} style={{ lineHeight: 21 }}>{h.feedback}</Txt>
            {h.links.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{h.links.map((l) => <Btn key={`${l.ref_type}${l.ref_id}`} title={l.label} tone="thuy" size="sm" onPress={() => onOpenLink(l.ref_type, l.ref_id)} />)}</View> : null}
          </Card>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {onAnimation ? <Btn icon={Clapperboard} title="Xem diễn biến thật" tone="thuy" onPress={onAnimation} testID="battle-result-animation" /> : null}
        <Btn icon={RotateCcw} title="Chơi lại" tone="dong" onPress={onReplay} testID="battle-replay" />
        <Btn title="Xong" tone="ngoc" onPress={onClose} testID="battle-done" />
      </View>
    </View>
  );
};

/** Màn chơi một trận đánh: bắt đầu (hoặc tiếp tục lượt dở), từng bước, kết quả */
export const BattleScreen: React.FC<{ session: Session; scenarioId: number; restart?: boolean; preview?: boolean; hasAnimation?: boolean; onClose: (changed: boolean) => void; onAnimation?: () => void; onOpenLink: OpenLink }> = ({ session, scenarioId, restart, preview, hasAnimation, onClose, onAnimation, onOpenLink }) => {
  const { c } = useTheme();
  const { token } = session;
  const [run, setRun] = useState<BattleRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { lat: number; lng: number }>>({});
  const [feedback, setFeedback] = useState<{ outcome: StepOutcome; finished: boolean; step: StepView; placed?: Record<string, { lat: number; lng: number }> } | null>(null);
  const [changed, setChanged] = useState(false);
  const guard = useCallback((e: unknown) => { if (e instanceof ApiError && e.status === 401) session.expired(); setError(errorMessage(e)); }, [session]);
  const begin = useCallback(async (again?: boolean) => {
    setBusy(true); setError(null); setFeedback(null); setChoice(null); setDraft({});
    try { setRun(await api.startScenario(token, scenarioId, { restart: again ?? restart, preview })); setChanged(true); } catch (e) { guard(e); } finally { setBusy(false); }
  }, [token, scenarioId, restart, preview, guard]);
  useEffect(() => { void begin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = run?.step ?? null;
  const ready = step ? (step.type === 'decision' ? Boolean(choice) : step.pieces.every((p) => draft[p.id])) : false;
  const submit = async () => {
    if (!run || !step) return;
    setBusy(true); setError(null);
    try {
      const res = await api.answerBattle(token, run.id, step.type === 'decision' ? { step_id: step.id, choice } : { step_id: step.id, placements: draft });
      setFeedback({ outcome: res.feedback, finished: res.finished, step, placed: step.type === 'placement' ? draft : undefined });
      setRun(res.run);
    } catch (e) { guard(e); } finally { setBusy(false); }
  };
  const next = () => { setFeedback(null); setChoice(null); setDraft({}); };

  if (!run) return error ? <ErrorNote message={error} /> : <Spinner label="Đang chuẩn bị trận đánh…" />;
  const shownStep = feedback ? null : step;
  const answeredIndex = feedback ? run.index - 1 : run.index;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={13} color={c.muc3} upper numberOfLines={2}>{run.battle.name}{run.mode === 'preview' ? ' · chơi thử' : ''}</Txt>
          <Txt f="bold" size={14} color={c.dongChu}>{run.score}/{run.max_score} điểm</Txt>
        </View>
        {run.status === 'active' || feedback ? <Bar value={Math.min(run.total, answeredIndex + (feedback ? 1 : 0))} max={run.total} height={10} label={`Tiến độ: bước ${Math.min(run.total, answeredIndex + 1)} trên ${run.total}`} /> : null}
      </View>
      <ErrorNote message={error} />
      {run.status === 'done' && !feedback ? (
        <ResultCard run={run} onClose={() => onClose(changed)} onReplay={() => begin(true)} onAnimation={hasAnimation !== false ? onAnimation : undefined} onOpenLink={onOpenLink} />
      ) : feedback ? (
        <View style={{ gap: 14 }}>
          <Txt f="bold" size={13} color={c.muc2}>Bước {answeredIndex + 1}/{run.total} · {feedback.outcome.title}</Txt>
          {feedback.step.type === 'placement' && feedback.placed ? <PlacementInput step={feedback.step} center={run.map.center} zoom={run.map.zoom} draft={feedback.placed} setDraft={() => undefined} result={feedback.outcome} /> : null}
          <FeedbackCard outcome={feedback.outcome} onOpenLink={onOpenLink} />
          <Btn title={feedback.finished ? 'Xem kết quả' : 'Bước tiếp theo'} tone="ngoc" size="lg" full onPress={next} testID="battle-next" />
        </View>
      ) : shownStep ? (
        <View style={{ gap: 14 }}>
          {run.index === 0 && run.history.length === 0 ? (
            <Card flat pad={14} style={{ gap: 6, borderColor: c.dong }}>
              <Txt f="bold" size={13} color={c.dongChu}>Nhiệm vụ của người chỉ huy</Txt>
              <Txt size={15} style={{ lineHeight: 23 }}>{run.intro.objective}</Txt>
            </Card>
          ) : null}
          <Card style={{ gap: 8 }}>
            <Txt f="bold" size={13} color={c.muc2}>Bước {shownStep.index + 1}/{shownStep.total}</Txt>
            <Txt f="displayHeavy" size={22} accessibilityRole="header">{shownStep.title}</Txt>
            <Txt size={16} style={{ lineHeight: 25 }}>{shownStep.situation}</Txt>
          </Card>
          {shownStep.type === 'decision' ? (
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">{shownStep.options.map((o) => <Choice key={o.id} text={o.text} selected={choice === o.id} disabled={busy} onPress={() => setChoice(o.id)} />)}</View>
          ) : (
            <PlacementInput step={shownStep} center={run.map.center} zoom={run.map.zoom} draft={draft} setDraft={setDraft} />
          )}
          <Btn title={shownStep.type === 'decision' ? 'Chọn phương án này' : 'Xác nhận bố trí'} tone="ngoc" size="lg" full loading={busy} disabled={!ready} onPress={submit} testID="battle-submit" />
          <Txt size={12} color={c.muc3} center>Lượt chơi được lưu sau mỗi bước; em có thể thoát và tiếp tục sau.</Txt>
        </View>
      ) : <Spinner />}
    </View>
  );
};

// ---------------------------------------------------------------------- hoạt ảnh diễn biến (HK.HS.028)
export const AnimationScreen: React.FC<{ session: Session; scenarioId: number; onClose: () => void }> = ({ session, scenarioId, onClose }) => {
  const { c } = useTheme();
  const anim = useLoad(() => api.scenarioAnimation(session.token, scenarioId), [session.token, scenarioId], session.expired);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const data: BattleAnimation | null = anim.data;
  const last = (data?.frames.length ?? 1) - 1;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || !data) return undefined;
    timer.current = setInterval(() => setFrame((f) => { if (f >= data.frames.length - 1) { setPlaying(false); return f; } return f + 1; }), 2400);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, data]);
  const fit = useMemo(() => (data ? data.frames.flatMap((f) => f.units.map((u) => [u.lat, u.lng] as [number, number])) : []), [data]);
  if (!data) return anim.error ? <ErrorNote message={anim.error} /> : <Spinner label="Đang mở hoạt ảnh…" />;
  const current = data.frames[Math.min(frame, last)];
  const prev = frame > 0 ? data.frames[frame - 1] : null;
  const markers: MapMarker[] = current.units.map((u) => ({ id: `${u.id}`, lat: u.lat, lng: u.lng, label: u.label, tone: u.side === 'tran' ? 'thuy' : 'son' }));
  const lines: MapLine[] = prev ? current.units.flatMap((u) => { const before = prev.units.find((x) => x.id === u.id); return before && (before.lat !== u.lat || before.lng !== u.lng) ? [{ from: [before.lat, before.lng] as [number, number], to: [u.lat, u.lng] as [number, number], tone: u.side === 'tran' ? 'thuy' as const : 'son' as const }] : []; }) : [];
  return (
    <View style={{ gap: 12 }}>
      <Txt f="displayHeavy" size={22} accessibilityRole="header">{data.title}</Txt>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        <Chip text="Quân Trần: màu xanh" bg={c.thuyNhat} fg={c.thuyChu} />
        <Chip text="Đối phương: màu đỏ" bg={c.sonNhat} fg={c.sonChu} />
      </View>
      <LeafletMap label={`Hoạt ảnh diễn biến, khung ${frame + 1} trên ${data.frames.length}: ${current.label}`} markers={markers} lines={lines} height={360} center={data.map.center} zoom={data.map.zoom} fit={fit} />
      <Card flat pad={14} style={{ gap: 4 }} >
        <Txt f="bold" size={13} color={c.muc2}>Khung {frame + 1}/{data.frames.length}</Txt>
        <Txt f="displayHeavy" size={18}>{current.label}</Txt>
        {current.text ? <Txt size={15}>{current.text}</Txt> : null}
      </Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon={SkipBack} label="Khung trước" tone="giay" size="sm" disabled={frame === 0} onPress={() => { setPlaying(false); setFrame((f) => Math.max(0, f - 1)); }} />
        <Btn icon={playing ? Pause : Play} title={playing ? 'Tạm dừng' : frame >= last ? 'Xem lại' : 'Phát'} tone="dong" onPress={() => { if (frame >= last) setFrame(0); setPlaying((p) => !p); }} testID="animation-play" />
        <Btn icon={SkipForward} label="Khung sau" tone="giay" size="sm" disabled={frame >= last} onPress={() => { setPlaying(false); setFrame((f) => Math.min(last, f + 1)); }} />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {data.frames.map((f, i) => (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Khung ${i + 1}: ${f.label}`} accessibilityState={{ selected: i === frame }} onPress={() => { setPlaying(false); setFrame(i); }}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: i === frame ? c.dong : c.vien, backgroundColor: i === frame ? c.dongNhat : c.the }}>
              <Txt f="bold" size={13}>{i + 1}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <Txt size={12} color={c.muc3}>{data.note}</Txt>
      <Btn title="Đóng" tone="giay" onPress={onClose} />
    </View>
  );
};
