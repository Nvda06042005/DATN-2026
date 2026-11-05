/**
 * Lộ trình học dạng đường đi (HK.HS.117–118, 120–123): các bài nối thành đường uốn lượn, chia theo Phần (cuộc kháng chiến) và Cửa (chủ đề);
 * băng tiêu đề "Phần 1, Cửa 4 – tên cửa" luôn hiện khi cuộn, kèm nút Hướng dẫn mở Cẩm nang; nút đã xong / đang học / bị khóa khác màu;
 * nút hiện tại có nhãn "BẮT ĐẦU" và vòng tiến độ; linh vật đứng dọc đường. Chạm vào nút để xem tên bài, số câu, điểm thưởng rồi vào học.
 * Bố cục dùng chiều cao hàng cố định nên vị trí mọi nút và chấm nối được tính trước, không cần đo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BookMarked, Check, Lock, Play, RotateCcw, Swords } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Mascot } from '@/components/art';
import { NODE_ICON, NodeSheet, STATE_TEXT, type NodeActions } from '@/components/portal/QuestMap';
import { Bar, Btn, Card, Chip, EmptyState, InfoNote, Sheet, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { GateGuide, LearningPath, NodeIcon, PathGate, PathNode, PathPart } from '@/types/learning';

const PART_H = 112, GATE_H = 116, ROW_H = 132, CIRCLE = 72, CENTER_Y = 56, BANNER_H = 64;
/** Độ lệch ngang (px) của từng nút so với giữa đường: uốn lượn qua lại */
const WAVE = [0, 46, 72, 46, 0, -46, -72, -46];
const KIND_ICON: Record<PathNode['kind'], NodeIcon> = {
  lesson: 'book', quiz: 'quiz', battle: 'sword', source: 'scroll', final: 'crown', practice: 'dumbbell', listen: 'headphones', chest: 'chest', gate_test: 'trophy',
};

type Item =
  | { type: 'part'; part: PathPart; top: number }
  | { type: 'gate'; part: PathPart; gate: PathGate; top: number }
  | { type: 'node'; part: PathPart; gate: PathGate; node: PathNode; top: number; x: number; first: boolean; last: boolean };

/** Xếp phẳng Phần → Cửa → nút thành danh sách có tọa độ dọc tính sẵn */
function layoutItems(path: LearningPath): { items: Item[]; height: number } {
  const items: Item[] = [];
  let top = 8;
  let n = 0;
  for (const part of path.parts) {
    items.push({ type: 'part', part, top });
    top += PART_H;
    for (const gate of part.gates) {
      items.push({ type: 'gate', part, gate, top });
      top += GATE_H;
      gate.nodes.forEach((node, i) => {
        items.push({ type: 'node', part, gate, node, top, x: WAVE[n % WAVE.length], first: i === 0, last: i === gate.nodes.length - 1 });
        top += ROW_H;
        n += 1;
      });
    }
  }
  return { items, height: top + 80 };
}

const stateTone = (s: PathGate['state']) => (s === 'done' ? 'Đã qua cửa' : s === 'current' ? 'Đang học' : 'Chưa mở');

// ---------------------------------------------------------------------- nút trên đường
const Ring: React.FC<{ done: number; total: number; color: string; track: string }> = ({ done, total, color, track }) => {
  const size = CIRCLE + 20, r = size / 2 - 4, len = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', left: -10, top: -10 }} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={6} fill="none" />
      {frac > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${len * frac} ${len}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
    </Svg>
  );
};

const PathButton: React.FC<{ node: PathNode; current: boolean; x: number; onPress: () => void }> = ({ node, current, x, onPress }) => {
  const { c } = useTheme();
  const done = node.state === 'done', locked = node.state === 'locked';
  const Icon = NODE_ICON[node.icon ?? KIND_ICON[node.kind]] ?? NODE_ICON.star;
  const bg = done ? c.ngoc : locked ? c.vien : node.kind === 'chest' ? c.vang : c.dong;
  const edge = done ? c.ngocDam : locked ? c.vien2 : node.kind === 'chest' ? c.vangDam : c.dongDam;
  const steps = node.steps ?? { done: 0, total: 1 };
  const label = `${node.kind_label}: ${node.title}. ${STATE_TEXT[node.state]}${done && node.stars ? `, ${node.stars} sao` : ''}${current ? '. Bài hiện tại, bấm để bắt đầu' : ''}${locked && node.lock_reason ? `. ${node.lock_reason}` : ''}`;
  return (
    <View style={{ height: ROW_H, alignItems: 'center' }}>
      <View style={{ marginTop: CENTER_Y - CIRCLE / 2, width: 168, alignItems: 'center', transform: [{ translateX: x }] }}>
        <View style={{ width: CIRCLE, height: CIRCLE }}>
          {!locked && !done && steps ? <Ring done={steps.done} total={steps.total} color={c.ngoc} track={c.vien} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={`path-node-${node.id}`}
            style={({ pressed }) => ({ width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6, borderBottomColor: edge, opacity: pressed ? 0.85 : 1 })}>
            {locked ? <Lock size={26} color={c.muc3} /> : <Icon size={32} color="#ffffff" />}
            {done ? <View style={{ position: 'absolute', right: -4, top: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.ngoc }}><Check size={15} color={c.ngocChu} /></View> : null}
          </Pressable>
          {current ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: -34, left: -18, width: CIRCLE + 36, alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 12, minHeight: 26, borderRadius: 13, backgroundColor: c.the, borderWidth: 2, borderColor: c.dong, justifyContent: 'center' }}>
                <Txt f="bold" size={12} color={c.dongChu} upper>Bắt đầu</Txt>
              </View>
            </View>
          ) : null}
        </View>
        <Txt f={current ? 'bold' : 'semibold'} size={13} center numberOfLines={2} color={locked ? c.muc3 : c.muc} style={{ marginTop: 6, width: 160 }}>{node.title}</Txt>
        {current && steps && steps.total > 1 ? <Txt size={11} color={c.muc2}>{steps.done}/{steps.total} bước</Txt> : done ? <Stars n={node.stars} size={13} /> : null}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- Cẩm nang (HK.HS.123)
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={{ gap: 6 }}><Txt f="bold" size={15}>{title}</Txt>{children}</View>
);

export const GuideSheet: React.FC<{ session: Session; gate: { id: number; title: string }; onClose: () => void; onOpenDetail: (type: string, id: number) => void }> = ({ session, gate, onClose, onOpenDetail }) => {
  const { c } = useTheme();
  const guide = useLoad(() => api.gateGuide(session.token, gate.id), [session.token, gate.id], session.expired);
  const g: GateGuide | null = guide.data;
  const empty = g && !g.milestones.length && !g.figures.length && !g.places.length && !g.terms.length && !g.quotes.length && !g.gate.guide_note;
  const open = (type: string, id: number) => { onClose(); onOpenDetail(type, id); };
  return (
    <Sheet open onClose={onClose} title="Cẩm nang" subtitle={gate.title} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="ngoc" onPress={onClose} testID="guide-close" /></View>}>
      <ErrorNote message={guide.error} />
      {guide.loading && !g ? <Spinner /> : null}
      {g ? (
        <View style={{ gap: 16 }}>
          {g.gate.summary ? <Txt size={15} color={c.muc2}>{g.gate.summary}</Txt> : null}
          {empty ? <EmptyState mood="thinking" title="Cửa này chưa có dữ liệu Cẩm nang" text="Cẩm nang được tạo từ nhân vật, sự kiện và địa danh gắn với các bài học trong cửa." /> : null}
          {g.milestones.length ? (
            <Section title="Mốc thời gian">
              {g.milestones.map((m) => (
                <Pressable key={`${m.type}${m.id}`} accessibilityRole="button" accessibilityLabel={`${m.date_text ?? m.year}: ${m.name}`} onPress={() => open(m.type, m.id)} style={{ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center' }}>
                  <Chip text={m.date_text ?? String(m.year)} bg={c.dongNhat} fg={c.dongChu} icon={m.type === 'battle' ? Swords : undefined} />
                  <Txt size={15} style={{ flex: 1 }}>{m.name}</Txt>
                </Pressable>
              ))}
            </Section>
          ) : null}
          {g.figures.length ? (
            <Section title="Nhân vật">
              {g.figures.map((f) => (
                <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`Nhân vật ${f.name}`} onPress={() => open('figure', f.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Txt f="semibold" size={15}>{f.name}{f.honorific ? ` (${f.honorific})` : ''}</Txt>
                  {f.role_text ? <Txt size={13} color={c.muc2}>{f.role_text}</Txt> : null}
                </Pressable>
              ))}
            </Section>
          ) : null}
          {g.places.length ? (
            <Section title="Địa danh">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.places.map((p) => <Btn key={p.id} title={p.old_name ? `${p.name} (${p.old_name})` : p.name} tone="thuy" size="sm" onPress={() => open('place', p.id)} />)}
              </View>
            </Section>
          ) : null}
          {g.terms.length ? (
            <Section title="Thuật ngữ">
              {g.terms.map((t) => <View key={t.id}><Txt f="semibold" size={15}>{t.term}</Txt><Txt size={14} color={c.muc2}>{t.definition}</Txt></View>)}
            </Section>
          ) : null}
          {g.quotes.length ? (
            <Section title="Câu nói nổi tiếng">
              {g.quotes.map((q, i) => <InfoNote key={i}>“{q.text}” — {q.by}</InfoNote>)}
            </Section>
          ) : null}
          {g.gate.guide_note ? <Section title="Lời nhắn của người biên soạn"><Txt size={14}>{g.gate.guide_note}</Txt></Section> : null}
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- màn Học
export const LearningPathTab: React.FC<{ session: Session; refreshKey: number; actions: NodeActions }> = ({ session, refreshKey, actions }) => {
  const { c } = useTheme();
  const load = useLoad(() => api.learningPath(session.token), [session.token, refreshKey], session.expired);
  const path = load.data;
  const { items, height } = useMemo(() => (path ? layoutItems(path) : { items: [] as Item[], height: 0 }), [path]);
  const [openNode, setOpenNode] = useState<number | null>(null);
  const [guide, setGuide] = useState<{ id: number; title: string } | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const jumped = useRef(false);

  const currentId = path?.current?.node_id ?? null;
  const currentTop = items.find((i) => i.type === 'node' && i.node.id === currentId)?.top ?? null;
  // Mở màn Học lần đầu thì cuộn tới nút hiện tại
  useEffect(() => {
    if (jumped.current || currentTop === null) return;
    jumped.current = true;
    const t = setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, currentTop - 220), animated: false }), 60);
    return () => clearTimeout(t);
  }, [currentTop]);

  // Băng tiêu đề: Cửa cuối cùng có tiêu đề đã cuộn qua mép trên
  const gates = items.filter((i): i is Extract<Item, { type: 'gate' }> => i.type === 'gate');
  const active = gates.filter((g) => g.top <= scrollY + 12).pop() ?? gates[0] ?? null;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrollY(e.nativeEvent.contentOffset.y);

  const currentItem = items.find((i): i is Extract<Item, { type: 'node' }> => i.type === 'node' && i.node.id === currentId) ?? null;
  const w = useRef(0);

  if (load.loading && !path) return <View style={{ padding: 16 }}><Spinner label="Đang mở lộ trình…" /></View>;
  return (
    <View style={{ flex: 1 }}>
      <ErrorNote message={load.error} />
      {path && !path.parts.some((p) => p.journey) ? (
        <View style={{ padding: 16 }}><EmptyState mood="thinking" title="Lộ trình đang được chuẩn bị" text="Các Phần và Cửa sẽ hiện ở đây khi nội dung học được công bố." /></View>
      ) : null}
      {path && path.parts.some((p) => p.journey) ? (
        <>
          {active ? (
            <View accessibilityRole="header" accessibilityLabel={`Phần ${active.part.no}, Cửa ${active.gate.no}: ${active.gate.title}`} testID="path-banner"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, height: BANNER_H, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.ngoc, borderBottomWidth: 4, borderBottomColor: c.ngocDam }}>
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={12} color="#ffffff" upper>Phần {active.part.no}, Cửa {active.gate.no}</Txt>
                <Txt f="displayHeavy" size={18} color="#ffffff" numberOfLines={1}>{active.gate.title}</Txt>
              </View>
              {active.gate.id !== null ? <Btn icon={BookMarked} title="Hướng dẫn" tone="giay" size="sm" onPress={() => setGuide({ id: active.gate.id as number, title: active.gate.title })} testID="path-guide" /> : null}
            </View>
          ) : null}
          <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={48} contentContainerStyle={{ paddingTop: BANNER_H }} showsVerticalScrollIndicator={false}>
            <View style={{ height, width: '100%', maxWidth: 460, alignSelf: 'center' }} onLayout={(e) => { w.current = e.nativeEvent.layout.width; }}>
              {/* Chấm nối giữa các nút liền nhau trong cùng một Cửa */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
                {items.map((it, idx) => {
                  const nxt = items[idx + 1];
                  if (it.type !== 'node' || it.last || !nxt || nxt.type !== 'node') return null;
                  const dots = [0.3, 0.5, 0.7];
                  return dots.map((t) => (
                    <View key={`${it.node.id}-${t}`} style={{ position: 'absolute', left: '50%', top: it.top + CENTER_Y + (nxt.top - it.top) * t - 5, marginLeft: it.x + (nxt.x - it.x) * t - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: it.node.state === 'done' ? c.ngoc : c.vien2 }} />
                  ));
                })}
              </View>
              {items.map((it) => {
                if (it.type === 'part') {
                  const { part } = it;
                  return (
                    <View key={`p${part.no}`} style={{ position: 'absolute', top: it.top, left: 16, right: 16, height: PART_H - 12, justifyContent: 'center', gap: 4 }}>
                      <Txt f="bold" size={12} color={c.dongChu} upper>Phần {part.no} · {part.campaign.year_label}</Txt>
                      <Txt f="displayHeavy" size={22} numberOfLines={2} accessibilityRole="header">{part.campaign.title}</Txt>
                      {part.journey ? <Bar value={part.totals.done} max={Math.max(1, part.totals.nodes)} height={8} label={`Phần ${part.no}: ${part.totals.done}/${part.totals.nodes} nút`} />
                        : <Txt size={13} color={c.muc3}>Phần này chưa có hành trình học.</Txt>}
                    </View>
                  );
                }
                if (it.type === 'gate') {
                  const { gate, part } = it;
                  return (
                    <View key={`g${part.no}-${gate.no}`} style={{ position: 'absolute', top: it.top, left: 16, right: 16, height: GATE_H - 12 }}>
                      <Card flat pad={12} style={{ flex: 1, justifyContent: 'center', gap: 4, borderColor: gate.state === 'done' ? c.ngoc : c.vien }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Chip text={`Cửa ${gate.no}`} bg={c.thuyNhat} fg={c.thuyChu} />
                          <Chip text={stateTone(gate.state)} bg={gate.state === 'done' ? c.ngocNhat : gate.state === 'current' ? c.dongNhat : c.dichNhat} fg={gate.state === 'done' ? c.ngocChu : gate.state === 'current' ? c.dongChu : c.dich} />
                          <Txt size={12} color={c.muc3} style={{ marginLeft: 'auto' }}>{gate.done}/{gate.nodes.length}</Txt>
                        </View>
                        <Txt f="bold" size={16} numberOfLines={1}>{gate.title}</Txt>
                        {gate.summary ? <Txt size={12} color={c.muc2} numberOfLines={1}>{gate.summary}</Txt> : null}
                      </Card>
                    </View>
                  );
                }
                const { node } = it;
                return (
                  <View key={`n${node.id}`} style={{ position: 'absolute', top: it.top, left: 0, right: 0 }}>
                    <PathButton node={node} current={node.id === currentId} x={it.x} onPress={() => setOpenNode(node.id)} />
                  </View>
                );
              })}
              {/* Linh vật đứng cạnh nút hiện tại, phía bên kia đường */}
              {currentItem ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: currentItem.top + 4, left: '50%', marginLeft: (currentItem.x >= 0 ? -1 : 1) * 118 - 40 }}>
                  <Mascot size={80} mood="happy" accessory="conical" bob title="Tiểu Tướng" />
                </View>
              ) : null}
            </View>
          </ScrollView>
          {currentId ? (
            <View style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 6 }}>
              <Btn icon={Play} title="Học tiếp" tone="dong" size="md" onPress={() => setOpenNode(currentId)} testID="path-continue" />
            </View>
          ) : path.current === null ? (
            <View style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 6 }}><Chip text="Em đã đi hết lộ trình" bg={c.ngocNhat} fg={c.ngocChu} icon={RotateCcw} /></View>
          ) : null}
        </>
      ) : null}
      {openNode !== null ? <NodeSheet session={session} nodeId={openNode} refreshKey={refreshKey} actions={actions} onClose={() => setOpenNode(null)} /> : null}
      {guide ? <GuideSheet session={session} gate={guide} onClose={() => setGuide(null)} onOpenDetail={actions.onOpenDetail} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- mục Luyện tập của thanh menu (HK.HS.125)
export const PracticeTab: React.FC<{ session: Session; refreshKey: number; onPractice: () => void; onGoLearn: () => void; onGoBattles: () => void }> = ({ session, refreshKey, onPractice, onGoLearn, onGoBattles }) => {
  const { c } = useTheme();
  const wrong = useLoad(() => api.practiceInfo(session.token), [session.token, refreshKey], session.expired);
  const list = wrong.data ?? [];
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Luyện tập</Txt>
      <ErrorNote message={wrong.error} />
      <Card style={{ gap: 10 }}>
        <Txt f="bold" size={17}>Luyện lại câu đã sai</Txt>
        {wrong.loading && !wrong.data ? <Spinner /> : null}
        {wrong.data && !list.length ? <Txt size={14} color={c.muc2}>Em chưa có câu nào cần luyện lại. Tuyệt vời!</Txt> : null}
        {list.slice(0, 5).map((w) => <Txt key={w.question_id} size={14} color={c.muc2} numberOfLines={2}>• {w.prompt}</Txt>)}
        {list.length > 5 ? <Txt size={13} color={c.muc3}>… và {list.length - 5} câu khác</Txt> : null}
        <Btn title={list.length ? `Luyện ngay ${Math.min(10, list.length)} câu` : 'Chưa có câu để luyện'} tone="dong" size="lg" full disabled={!list.length} onPress={onPractice} testID="practice-start" />
        <Txt size={12} color={c.muc3}>Luyện đúng một câu thì câu đó được gỡ khỏi danh sách, em còn được hồi tim.</Txt>
      </Card>
      <Card flat style={{ gap: 8 }}>
        <Txt f="bold" size={16}>Ôn theo từng cửa</Txt>
        <Txt size={14} color={c.muc2}>Mỗi cửa trên lộ trình có nút Luyện tập (biểu tượng tạ) ôn lại những gì em vừa học, làm sai không mất tim.</Txt>
        <Btn title="Về lộ trình học" tone="ngoc" size="sm" onPress={onGoLearn} />
      </Card>
      <Card flat style={{ gap: 8 }}>
        <Txt f="bold" size={16}>Trận đánh và mini-game</Txt>
        <Txt size={14} color={c.muc2}>Chơi mô phỏng trận đánh và các trò chơi ghép thẻ, sắp xếp dòng thời gian, ô chữ.</Txt>
        <Btn title="Mở trận đánh" tone="thuy" size="sm" onPress={onGoBattles} />
      </Card>
    </View>
  );
};
