/**
 * Trình thiết kế bản đồ nhiệm vụ (Sprint 7, HK.GV.022, 025): kéo nút đến vị trí mong muốn, nối đường giữa các nút để tạo nhánh rẽ (nút mở khi mọi nút nối vào đã xong),
 * thay thế bằng nhập số và chọn nút cho người không kéo thả được, xem trước bản đồ như học sinh với trạng thái do giáo viên đánh dấu.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Eraser, Link2, Move, Save, Wand2, X } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { autoLayout, MapGraph, type GraphEdge, type GraphNode } from '@/components/portal/MapGraph';
import { Btn, Card, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { JourneyDetail } from '@/types/learning';

const round = (n: number) => Math.round(n * 100) / 100;

export const JourneyDesigner: React.FC<{ session: Session; journey: JourneyDetail; onSaved: (j: JourneyDetail) => void; onEditNode: (id: number) => void }> = ({ session, journey, onSaved, onEditNode }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const editable = journey.can_edit;
  const nodes: GraphNode[] = useMemo(() => journey.nodes.map((n) => ({ id: n.id, title: n.title, icon: n.icon, pos_x: n.pos_x, pos_y: n.pos_y })), [journey.nodes]);
  const initEdges = (): GraphEdge[] => journey.edges.map((e) => ({ from: e.from_node, to: e.to_node }));
  const initPos = (): Record<number, { x: number; y: number }> => {
    const auto = autoLayout(nodes, initEdges());
    return Object.fromEntries(nodes.map((n) => [n.id, n.pos_x !== null && n.pos_y !== null ? { x: n.pos_x, y: n.pos_y } : auto[n.id]]));
  };
  const [edges, setEdges] = useState<GraphEdge[]>(initEdges);
  const [pos, setPos] = useState(initPos);
  const [dirty, setDirty] = useState(false);
  const [connect, setConnect] = useState(false);
  const [from, setFrom] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [numeric, setNumeric] = useState(false);
  const [pickFrom, setPickFrom] = useState('');
  const [pickTo, setPickTo] = useState('');
  const [preview, setPreview] = useState(false);
  const title = (id: number) => nodes.find((n) => n.id === id)?.title ?? `#${id}`;
  const touch = () => setDirty(true);

  const toggleEdge = (a: number, b: number) => {
    if (a === b) return;
    setEdges((es) => (es.some((e) => e.from === a && e.to === b) ? es.filter((e) => !(e.from === a && e.to === b)) : [...es.filter((e) => !(e.from === b && e.to === a)), { from: a, to: b }]));
    touch();
  };
  const press = (id: number) => {
    if (!editable) return;
    if (!connect) { setSelected(id); return; }
    if (from === null) { setFrom(id); setSelected(id); return; }
    toggleEdge(from, id);
    setFrom(null);
  };
  const save = async () => {
    const next = await run(() => api.saveJourneyLayout(session.token, journey.id, { nodes: nodes.map((n) => ({ id: n.id, x: round(pos[n.id].x), y: round(pos[n.id].y) })), edges }), 'Đã lưu bản đồ');
    if (next) { setDirty(false); onSaved(next); }
  };
  const graphEdges = edges;
  const chosen = selected !== null ? journey.nodes.find((n) => n.id === selected) : null;

  return (
    <View style={{ gap: 12 }}>
      <InfoNote>
        {edges.length
          ? 'Bản đồ rẽ nhánh: một nút mở khi mọi nút nối vào nó đã hoàn thành (và đủ điều kiện điểm/sao/giờ mở nếu có).'
          : 'Chưa có đường nối nào nên bản đồ chạy tuần tự theo thứ tự nút. Bật “Nối đường” để tạo nhánh rẽ.'}
        {editable ? ' Kéo nút để đổi vị trí.' : ' Bạn chỉ xem được bản đồ này; hãy nhân bản hành trình để chỉnh.'}
      </InfoNote>
      {editable ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn icon={Link2} title={connect ? 'Đang nối đường – bấm hai nút liên tiếp' : 'Nối đường'} tone={connect ? 'son' : 'giay'} size="sm" onPress={() => { setConnect(!connect); setFrom(null); }} testID="designer-connect" />
          <Btn icon={Wand2} title="Tự xếp lại vị trí" tone="giay" size="sm" onPress={() => { setPos(Object.fromEntries(nodes.map((n) => [n.id, autoLayout(nodes, edges)[n.id]]))); touch(); }} />
          <Btn icon={Eraser} title="Bỏ hết đường nối" tone="giay" size="sm" disabled={!edges.length} onPress={() => { setEdges([]); touch(); }} />
          <Btn icon={Move} title="Nhập vị trí bằng số" tone="giay" size="sm" onPress={() => setNumeric(true)} />
          <Btn icon={Save} title={dirty ? 'Lưu bản đồ' : 'Đã lưu'} tone="ngoc" size="sm" loading={busy} disabled={!dirty} onPress={save} testID="designer-save" />
        </View>
      ) : null}
      <Btn title="Xem trước như học sinh" tone="giay" size="sm" onPress={() => setPreview(true)} testID="designer-preview" />
      {connect && from !== null ? <Txt size={13} color={c.son}>Đã chọn “{title(from)}”. Bấm nút đích để nối (bấm lại cặp nút đã nối để bỏ đường).</Txt> : null}
      <MapGraph nodes={nodes} edges={graphEdges} editable={editable && !connect} selected={selected} positions={pos} onPress={press} onMove={(id, x, y) => { setPos((p) => ({ ...p, [id]: { x, y } })); touch(); }} />
      {chosen ? (
        <Card flat pad={12} style={{ gap: 6 }}>
          <Txt f="bold" size={15}>{chosen.title}</Txt>
          <Txt size={13} color={c.muc2}>{chosen.kind_label}{chosen.min_percent ? ` · cần ≥ ${chosen.min_percent}% ở nút trước` : ''}{chosen.min_stars ? ` · cần ≥ ${chosen.min_stars} sao` : ''}{chosen.opens_at ? ` · mở ${new Date(chosen.opens_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}{chosen.reward_gold ? ` · thưởng ${chosen.reward_gold} vàng` : ''}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {editable ? <Btn title="Sửa nút, điều kiện, phần thưởng" tone="giay" size="sm" onPress={() => onEditNode(chosen.id)} /> : null}
          </View>
        </Card>
      ) : null}
      <Txt f="bold" size={15}>Đường nối ({edges.length})</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {edges.map((e) => <Btn key={`${e.from}-${e.to}`} icon={editable ? X : undefined} title={`${title(e.from)} → ${title(e.to)}`} label={editable ? `Bỏ đường nối từ ${title(e.from)} đến ${title(e.to)}` : undefined} tone="giay" size="sm" disabled={!editable} onPress={() => toggleEdge(e.from, e.to)} />)}
        {!edges.length ? <Txt size={13} color={c.muc3}>Chưa có.</Txt> : null}
      </View>
      {editable ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="Nối từ nút" value={pickFrom} onChange={setPickFrom} options={[{ value: '', label: '— Chọn —' }, ...nodes.map((n) => ({ value: String(n.id), label: n.title }))]} /></View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="Đến nút" value={pickTo} onChange={setPickTo} options={[{ value: '', label: '— Chọn —' }, ...nodes.map((n) => ({ value: String(n.id), label: n.title }))]} /></View>
          <Btn title="Nối / bỏ nối" tone="giay" size="sm" disabled={!pickFrom || !pickTo || pickFrom === pickTo} onPress={() => toggleEdge(Number(pickFrom), Number(pickTo))} />
        </View>
      ) : null}
      <Sheet open={numeric} onClose={() => setNumeric(false)} title="Vị trí nút (phần trăm)" subtitle="0 là mép trái/trên, 100 là mép phải/dưới" footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Xong" tone="son" onPress={() => setNumeric(false)} /></View>}>
        {nodes.map((n) => (
          <View key={n.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Txt size={14} style={{ flex: 1.2 }} numberOfLines={2}>{n.title}</Txt>
            <Field label="Ngang" value={String(round(pos[n.id].x))} keyboardType="numeric" style={{ flex: 1 }} onChangeText={(v) => { const x = Math.max(0, Math.min(100, Number(v) || 0)); setPos((p) => ({ ...p, [n.id]: { ...p[n.id], x } })); touch(); }} />
            <Field label="Dọc" value={String(round(pos[n.id].y))} keyboardType="numeric" style={{ flex: 1 }} onChangeText={(v) => { const y = Math.max(0, Math.min(100, Number(v) || 0)); setPos((p) => ({ ...p, [n.id]: { ...p[n.id], y } })); touch(); }} />
          </View>
        ))}
      </Sheet>
      {preview ? <JourneyPreviewSheet session={session} journey={journey} onClose={() => setPreview(false)} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- xem trước như học sinh (HK.GV.025)
const HOURS = [{ value: 0, label: 'Bây giờ' }, { value: 24, label: 'Sau 1 ngày' }, { value: 72, label: 'Sau 3 ngày' }, { value: 168, label: 'Sau 1 tuần' }];

export const JourneyPreviewSheet: React.FC<{ session: Session; journey: JourneyDetail; onClose: () => void }> = ({ session, journey, onClose }) => {
  const { c } = useTheme();
  const [done, setDone] = useState<number[]>([]);
  const [hours, setHours] = useState(0);
  const view = useLoad(() => api.previewJourney(session.token, journey.id, done, hours), [session.token, journey.id, done.join(','), hours], session.expired);
  const d = view.data;
  const toggle = (id: number) => setDone((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const nodes: GraphNode[] = (d?.nodes ?? []).map((n) => ({ id: n.id, title: n.title, icon: n.icon, pos_x: n.pos_x, pos_y: n.pos_y, state: n.state, stars: n.stars }));
  const graphEdges: GraphEdge[] = (d?.edges ?? []).map((e) => ({ from: e.from_node, to: e.to_node }));
  return (
    <Sheet open onClose={onClose} title="Xem trước như học sinh" subtitle={journey.title} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Bỏ hết đánh dấu" tone="giay" onPress={() => setDone([])} disabled={!done.length} /><Btn title="Đóng" tone="son" onPress={onClose} /></View>}>
      <InfoNote>Chạm vào một nút để đánh dấu “đã hoàn thành” và xem các nút tiếp theo mở ra thế nào. Không có dữ liệu nào của học sinh bị thay đổi.</InfoNote>
      <Segmented label="Thời điểm xem" options={HOURS} value={hours} onChange={setHours} />
      <ErrorNote message={view.error} />
      {view.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <MapGraph nodes={nodes} edges={graphEdges} onPress={toggle} currentId={d.nodes.find((n) => n.state === 'available')?.id ?? null} />
          <Txt size={13} color={c.muc2}>{d.totals.done}/{d.totals.nodes} nút đã hoàn thành.</Txt>
          {d.nodes.filter((n) => n.state === 'locked').map((n) => <Txt key={n.id} size={13} color={c.muc3}>Chưa mở · {n.title}: {n.lock_reason}</Txt>)}
        </>
      ) : null}
    </Sheet>
  );
};
