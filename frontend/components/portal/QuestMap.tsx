/**
 * Trang chủ và bản đồ nhiệm vụ của học sinh (HK.HS.017–022): ba cuộc kháng chiến với tiến độ, điểm, chuỗi ngày, gợi ý; bản đồ chiến dịch gồm các nút nối tiếp
 * (bài học, câu hỏi, trận đánh, tư liệu, Quyết chiến); nút mở theo thứ tự; chi tiết nút với sao, phần thưởng và nút bắt đầu.
 */
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { BookOpen, Castle, CircleHelp, Crown, Flag, Lock, Map as MapIcon, PawPrint, Play, RotateCcw, ScrollText, Ship, Star, Swords, Trophy, Check } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Avatar, Bar, Btn, Card, Chip, EmptyState, InfoNote, Sheet, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { CampaignCard, MapNode, NodeDetail, NodeIcon, NodeState } from '@/types/learning';

const NODE_ICON: Record<NodeIcon, IconType> = {
  book: BookOpen, quiz: CircleHelp, sword: Swords, scroll: ScrollText, flag: Flag, star: Star, castle: Castle, ship: Ship, horse: PawPrint, map: MapIcon, crown: Crown,
};
const STATE_TEXT: Record<NodeState, string> = { done: 'Đã hoàn thành', available: 'Đang mở', locked: 'Chưa mở' };

/** Hành động của một nút do StudentApp xử lý (mở bài học, làm bài, đọc hồ sơ) */
export interface NodeActions {
  onLesson: (node: { id: number; title: string }) => void;
  onQuiz: (node: { id: number; title: string }) => void;
  onRead: (node: { id: number; title: string; kind: 'battle' | 'source'; refId: number; done: boolean }) => void;
  onOpenDetail: (type: string, id: number) => void;
}

// ---------------------------------------------------------------------- trang chủ
export const HomeTab: React.FC<{ session: Session; refreshKey: number; onOpenCampaign: (id: number) => void; onPractice: () => void; onNode: (campaignId: number, nodeId: number) => void }> = ({ session, refreshKey, onOpenCampaign, onPractice, onNode }) => {
  const { c } = useTheme();
  const home = useLoad(() => api.studentHome(session.token), [session.token, refreshKey], session.expired);
  const data = home.data;
  if (home.loading && !data) return <Spinner label="Đang tải trang chủ…" />;
  return (
    <View style={{ gap: 16 }}>
      <ErrorNote message={home.error} />
      {data ? (
        <>
          <View style={{ gap: 10 }}>
            <Txt f="displayHeavy" size={26} accessibilityRole="header">Xin chào, {data.learner.nickname || data.learner.full_name}!</Txt>
          </View>
          {data.suggestions.length ? (
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={16}>Gợi ý cho em hôm nay</Txt>
              {data.suggestions.map((s, i) => s.type === 'node' ? (
                <Card key={i} flat pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Txt f="bold" size={13} color={c.muc2}>{s.kind_label} · {s.campaign_title}</Txt>
                    <Txt f="semibold" size={16}>{s.title}</Txt>
                  </View>
                  <Btn icon={Play} title="Học tiếp" tone="ngoc" size="sm" onPress={() => onNode(s.campaign_id, s.node_id)} />
                </Card>
              ) : (
                <Card key={i} flat pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Txt f="bold" size={13} color={c.muc2}>Luyện tập</Txt>
                    <Txt f="semibold" size={16}>Em có {s.count} câu đã sai cần luyện lại</Txt>
                  </View>
                  <Btn icon={RotateCcw} title="Luyện ngay" tone="dong" size="sm" onPress={onPractice} />
                </Card>
              ))}
            </View>
          ) : null}
          <Txt f="bold" size={18}>Ba cuộc kháng chiến</Txt>
          {data.campaigns.length === 0 ? (
            <EmptyState mood="thinking" title="Nội dung học đang được chuẩn bị" text="Các cuộc kháng chiến sẽ hiện ở đây khi nhà trường và đội ngũ biên soạn công bố nội dung đã kiểm chứng." />
          ) : data.campaigns.map((card) => <CampaignCardView key={card.id} card={card} onOpen={() => onOpenCampaign(card.id)} />)}
        </>
      ) : null}
    </View>
  );
};

const CampaignCardView: React.FC<{ card: CampaignCard; onOpen: () => void }> = ({ card, onOpen }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${card.title}, ${card.year_label}, hoàn thành ${card.percent}%`} onPress={onOpen}
      style={({ pressed }) => ({ borderRadius: 20, borderWidth: 2, borderColor: card.completed ? c.ngoc : c.vien, backgroundColor: pressed ? c.the2 : c.the, padding: 16, gap: 10 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Chip text={card.year_label} bg={c.dongNhat} fg={c.dongChu} />
        {card.completed ? <Chip text="Đã hoàn thành" bg={c.ngocNhat} fg={c.ngocChu} icon={Trophy} /> : null}
        {card.journey?.from_class ? <Chip text="Giáo viên giao" bg={c.thuyNhat} fg={c.thuyChu} /> : null}
      </View>
      <Txt f="displayHeavy" size={22}>{card.title}</Txt>
      {card.places.length ? <Txt size={14} color={c.muc2}>Địa danh tiêu biểu: {card.places.join(', ')}</Txt> : null}
      {card.nodes > 0 ? (
        <View style={{ gap: 6 }}>
          <Bar value={card.done} max={card.nodes} label={`Hoàn thành ${card.percent}%`} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt size={13} color={c.muc2}>{card.done}/{card.nodes} nút · {card.percent}%</Txt>
            <Stars n={Math.min(3, Math.round((card.stars / Math.max(1, card.max_stars)) * 3))} size={16} label={`${card.stars}/${card.max_stars} sao`} />
          </View>
        </View>
      ) : <Txt size={14} color={c.muc3}>Chưa có hành trình học cho cuộc kháng chiến này.</Txt>}
    </Pressable>
  );
};

// ---------------------------------------------------------------------- bản đồ chiến dịch
export const CampaignMapView: React.FC<{ session: Session; campaignId: number; refreshKey: number; focusNode?: number | null; actions: NodeActions; onBack: () => void }> = ({ session, campaignId, refreshKey, focusNode, actions, onBack }) => {
  const { c } = useTheme();
  const map = useLoad(() => api.campaignMap(session.token, campaignId), [session.token, campaignId, refreshKey], session.expired);
  const [open, setOpen] = useState<number | null>(focusNode ?? null);
  const data = map.data;
  return (
    <View style={{ gap: 14 }}>
      <Btn title="Tất cả cuộc kháng chiến" tone="giay" size="sm" onPress={onBack} />
      <ErrorNote message={map.error} />
      {map.loading && !data ? <Spinner label="Đang mở bản đồ…" /> : null}
      {data ? (
        <>
          {data.journey?.background_url ? <Image source={{ uri: data.journey.background_url }} accessibilityLabel={`Ảnh nền hành trình ${data.journey.title}`} resizeMode="cover" style={{ width: '100%', height: 150, borderRadius: 16, backgroundColor: c.dichNhat }} /> : null}
          <View style={{ gap: 6 }}>
            <Chip text={data.campaign.year_label} bg={c.dongNhat} fg={c.dongChu} style={{ alignSelf: 'flex-start' }} />
            <Txt f="displayHeavy" size={24} accessibilityRole="header">{data.campaign.title}</Txt>
            {data.journey ? <Txt size={14} color={c.muc2}>Hành trình: {data.journey.title}{data.journey.from_class ? ' (giáo viên giao)' : ''}</Txt> : null}
          </View>
          {!data.journey ? <EmptyState mood="thinking" title="Chưa có hành trình học" text="Cuộc kháng chiến này chưa có hành trình được phát hành. Em hãy quay lại sau hoặc hỏi giáo viên." /> : (
            <>
              <Card flat pad={14} style={{ gap: 8 }}>
                <Bar value={data.totals.done} max={data.totals.nodes} label={`Hoàn thành ${data.totals.percent}%`} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Txt size={13} color={c.muc2}>{data.totals.done}/{data.totals.nodes} nút · {data.totals.percent}%</Txt>
                  <Txt size={13} color={c.muc2}>{data.totals.stars}/{data.totals.max_stars} sao</Txt>
                </View>
              </Card>
              {data.journey.description ? <Txt size={14} color={c.muc2}>{data.journey.description}</Txt> : null}
              <View accessibilityLabel="Bản đồ nhiệm vụ" style={{ gap: 0 }}>
                {data.nodes.map((node, i) => (
                  <NodeRow key={node.id} node={node} last={i === data.nodes.length - 1} current={node.id === data.current_node_id} learner={session.user.full_name} onPress={() => setOpen(node.id)} />
                ))}
              </View>
              {data.totals.percent === 100 ? <InfoNote>Chúc mừng em đã hoàn thành cả hành trình! Em có thể chơi lại các nút để tăng số sao.</InfoNote> : null}
            </>
          )}
        </>
      ) : null}
      {open !== null ? <NodeSheet session={session} nodeId={open} refreshKey={refreshKey} actions={actions} onClose={() => setOpen(null)} /> : null}
    </View>
  );
};

const NodeRow: React.FC<{ node: MapNode; last: boolean; current: boolean; learner: string; onPress: () => void }> = ({ node, last, current, learner, onPress }) => {
  const { c } = useTheme();
  const Icon = NODE_ICON[node.icon ?? 'star'] ?? Star;
  const done = node.state === 'done', locked = node.state === 'locked';
  const bg = done ? c.ngoc : locked ? c.vien : c.dong;
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ width: 64, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${node.kind_label}: ${node.title}. ${STATE_TEXT[node.state]}${node.stars ? `, ${node.stars} sao` : ''}`} onPress={onPress}
          style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: done ? c.ngocDam : locked ? c.vien2 : c.dongDam, opacity: pressed ? 0.85 : 1, borderWidth: current ? 4 : 0, borderColor: current ? c.vang : 'transparent' })}>
          {locked ? <Lock size={24} color={c.muc3} /> : <Icon size={28} color="#ffffff" />}
          {done ? <View style={{ position: 'absolute', right: -2, top: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.ngoc }}><Check size={14} color={c.ngocChu} /></View> : null}
        </Pressable>
        {!last ? <View style={{ flex: 1, minHeight: 28, width: 0, borderLeftWidth: 4, borderStyle: 'dotted', borderColor: done ? c.ngoc : c.vien2, marginVertical: 4 }} /> : null}
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Xem chi tiết: ${node.title}`} style={{ flex: 1, paddingBottom: last ? 0 : 18, gap: 4, justifyContent: 'flex-start' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Chip text={node.kind_label} bg={locked ? c.dichNhat : c.thuyNhat} fg={locked ? c.dich : c.thuyChu} />
          <Txt size={12} color={c.muc3}>{STATE_TEXT[node.state]}</Txt>
        </View>
        <Txt f="bold" size={17} color={locked ? c.muc3 : c.muc}>{node.title}</Txt>
        {node.objective && !locked ? <Txt size={14} color={c.muc2} numberOfLines={2}>{node.objective}</Txt> : null}
        {done ? <Stars n={node.stars} size={16} /> : null}
        {current ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}><Avatar name={learner} size={28} /><Txt f="bold" size={13} color={c.dongChu}>Em đang ở đây</Txt></View> : null}
      </Pressable>
    </View>
  );
};

// ---------------------------------------------------------------------- chi tiết nút (HK.HS.021–022)
const NodeSheet: React.FC<{ session: Session; nodeId: number; refreshKey: number; actions: NodeActions; onClose: () => void }> = ({ session, nodeId, refreshKey, actions, onClose }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.nodeDetail(session.token, nodeId), [session.token, nodeId, refreshKey], session.expired);
  const d = detail.data;
  const go = (d: NodeDetail) => {
    const ref = { id: d.id, title: d.title };
    onClose();
    if (d.kind === 'lesson') actions.onLesson(ref);
    else if (d.needs_quiz) actions.onQuiz(ref);
    else if (d.kind === 'battle' && d.content?.battle) actions.onRead({ ...ref, kind: 'battle', refId: d.content.battle.id, done: d.state === 'done' });
    else if (d.kind === 'source' && d.content?.source) actions.onRead({ ...ref, kind: 'source', refId: d.content.source.id, done: d.state === 'done' });
  };
  const verb = !d ? '' : d.kind === 'lesson' ? 'Đọc bài học' : d.needs_quiz ? (d.state === 'done' ? 'Chơi lại' : 'Bắt đầu') : d.kind === 'battle' ? 'Đọc hồ sơ trận đánh' : 'Đọc tư liệu';
  return (
    <Sheet open onClose={onClose} title={d?.title ?? 'Chi tiết nút'} subtitle={d ? `${d.kind_label} · ${STATE_TEXT[d.state]}` : undefined}
      footer={d ? <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Btn title="Đóng" tone="giay" onPress={onClose} /><Btn icon={d.state === 'done' ? RotateCcw : Play} title={verb} tone="ngoc" disabled={!d.can_start} onPress={() => go(d)} testID="node-start" /></View> : undefined}>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          {d.objective ? <Txt size={15}>{d.objective}</Txt> : null}
          {d.hint ? <InfoNote>{d.hint}</InfoNote> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <View><Txt size={12} color={c.muc3}>Số sao đạt được</Txt><Stars n={d.stars} size={24} /></View>
            <View><Txt size={12} color={c.muc3}>Điểm thưởng</Txt><Txt f="bold" size={18} color={c.dongChu}>+{d.reward_points}</Txt></View>
            {d.attempts ? <View><Txt size={12} color={c.muc3}>Điểm cao nhất</Txt><Txt f="bold" size={18}>{d.best_percent}%</Txt></View> : null}
          </View>
          {d.content?.lesson ? <Txt size={14} color={c.muc2}>Bài học khoảng {d.content.lesson.read_minutes} phút, kèm câu kiểm tra nhanh cuối bài.</Txt> : null}
          {d.content?.quiz ? <Txt size={14} color={c.muc2}>{d.content.quiz.questions} câu · khoảng {Math.ceil(d.content.quiz.total_seconds / 60)} phút · cần đạt {d.pass_percent ?? d.content.quiz.pass_percent}% để hoàn thành. Trả lời đúng và nhanh được thưởng thêm điểm.</Txt> : null}
          {d.content?.battle ? <Txt size={14} color={c.muc2}>Trận đánh: {d.content.battle.name} ({d.content.battle.year})</Txt> : null}
          {d.unlocks.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Hoàn thành để mở khóa tư liệu</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {d.unlocks.map((u) => <Chip key={u.id} text={u.unlocked ? `${u.title} · đã mở khóa` : u.title} bg={u.unlocked ? c.ngocNhat : c.dongNhat} fg={u.unlocked ? c.ngocChu : c.dongChu} />)}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};
