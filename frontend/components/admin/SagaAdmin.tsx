/**
 * Hành trình Đông A ở các cổng quản lý:
 *  - Quản trị tổng (SagaAdmin): đổi ảnh nền bản đồ, đặt vị trí từng chặng ngay trên ảnh (lưu theo tỉ lệ 0–1 nên đổi ảnh không phải nhập lại), sửa thông tin và ngưỡng đạt,
 *    duyệt / công bố, sửa nội dung chặng và câu luyện tập (máy chủ kiểm tra cấu trúc, lưu phiên bản cũ, đưa chặng về Nháp cho tới khi duyệt lại).
 *  - Giáo viên (SagaClassReport): tiến độ của lớp mình dạy, mức hiểu bài theo chặng và những câu học sinh thường sai.
 * Mọi thay đổi đi qua /api/saga/admin/* (chỉ quản trị tổng); báo cáo lớp chỉ trả dữ liệu của lớp giáo viên đang phụ trách.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import * as analytics from '@/api/analyticsApi';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { mapSource } from '@/components/portal/SagaKit';
import { Bar, Btn, Card, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AdminStage, SagaMapInfo } from '@/types/saga';

const STATUS: Record<AdminStage['status'], { text: string; kind: 'on' | 'info' | 'muted' }> = { published: { text: 'Công bố', kind: 'on' }, reviewed: { text: 'Đã duyệt', kind: 'info' }, draft: { text: 'Nháp', kind: 'muted' } };
const KIND: Record<string, string> = { battle: 'Trận đánh', council: 'Hội nghị', strategy: 'Kế sách', prepare: 'Chuẩn bị' };
const NODE_COLOR: Record<AdminStage['status'], string> = { published: '#2f9b4b', reviewed: '#2b7fd0', draft: '#7b8499' };
const pct = (v: number | null): string => (v === null ? '' : String(Math.round(v * 1000) / 10));
const ratio = (text: string): number | null => { const n = Number(text.replace(',', '.')); return text.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : null; };
const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa học');

// ---------------------------------------------------------------------- bản đồ: đặt vị trí chặng
interface Draft { id: number; map_x: number; map_y: number; anchor_x: number | null; anchor_y: number | null }

const MapEditor: React.FC<{ map: SagaMapInfo; stages: AdminStage[]; draft: Draft | null; target: 'node' | 'anchor'; onPlace: (x: number, y: number) => void; onSelect: (st: AdminStage) => void }> = ({ map, stages, draft, target, onPlace, onSelect }) => {
  const [w, setW] = useState(0);
  const k = map.image_w / Math.max(1, map.image_h);
  const width = Math.min(w, 820, 620 * k), height = width / k;
  const place = (e: GestureResponderEvent): void => {
    // điện thoại: locationX / locationY; trình duyệt: sự kiện bấm chuột chỉ có offsetX / offsetY (tính từ góc trên trái của lớp phủ bản đồ)
    const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
    const px = ne.locationX ?? ne.offsetX, py = ne.locationY ?? ne.offsetY;
    if (typeof px !== 'number' || typeof py !== 'number') return;
    const x = px / Math.max(1, width), y = py / Math.max(1, height);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPlace(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
  };
  const posOf = (st: AdminStage): Draft => (draft && draft.id === st.id ? draft : { id: st.id, map_x: st.map_x, map_y: st.map_y, anchor_x: st.anchor_x, anchor_y: st.anchor_y });
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }} testID="saga-admin-map">
      {w > 0 ? (
        <View style={{ width, height, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#c9c5cf' }}>
          <Image source={mapSource(map)} style={{ width, height }} resizeMode="stretch" accessibilityLabel={`Ảnh bản đồ ${map.title}`} />
          {draft ? (
            <Pressable onPress={place} accessibilityRole="button" testID="saga-admin-place"
              accessibilityLabel={target === 'node' ? 'Bấm lên bản đồ để đặt vị trí nút của chặng đang chọn' : 'Bấm lên bản đồ để đặt điểm địa danh của chặng đang chọn'}
              style={{ position: 'absolute', left: 0, top: 0, width, height, cursor: 'crosshair' } as object} />
          ) : null}
          <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            {stages.map((st) => { const p = posOf(st); return p.anchor_x !== null && p.anchor_y !== null ? <React.Fragment key={st.id}><Line x1={p.map_x * width} y1={p.map_y * height} x2={p.anchor_x * width} y2={p.anchor_y * height} stroke="#1e2a4a" strokeWidth={2} /><Circle cx={p.anchor_x * width} cy={p.anchor_y * height} r={5} fill="#1e2a4a" stroke="#ffffff" strokeWidth={2} /></React.Fragment> : null; })}
          </Svg>
          {stages.map((st, i) => {
            const p = posOf(st), on = draft?.id === st.id;
            return (
              <Pressable key={st.id} disabled={Boolean(draft)} onPress={() => onSelect(st)} accessibilityRole="button" accessibilityLabel={`Chặng ${i + 1}: ${st.title}. Bấm để chỉnh vị trí`} testID={`saga-admin-node-${st.code}`}
                pointerEvents={draft ? 'none' : 'auto'}
                style={{ position: 'absolute', left: p.map_x * width - 18, top: p.map_y * height - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: NODE_COLOR[st.status], borderWidth: 3, borderColor: on ? '#ffc93c' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                <Txt f="heavy" size={15} color="#ffffff">{i + 1}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- nội dung chặng và câu luyện tập (dạng JSON, máy chủ kiểm tra cấu trúc)
const ContentSheet: React.FC<{ session: Session; stage: AdminStage; onClose: () => void; onSaved: () => void }> = ({ session, stage, onClose, onSaved }) => {
  const { c } = useTheme();
  const detail = useLoad(() => saga.adminStage(session.token, stage.id), [session.token, stage.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [item, setItem] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => { if (detail.data) setText(JSON.stringify(detail.data.content, null, 2)); }, [detail.data]);
  const parse = (raw: string): unknown | undefined => { try { setProblem(null); return JSON.parse(raw); } catch (e) { setProblem(`JSON chưa hợp lệ: ${errorMessage(e)}`); return undefined; } };
  const saveContent = async (): Promise<void> => {
    const content = parse(text);
    if (content === undefined) return;
    if (await run(() => saga.adminUpdateStage(session.token, stage.id, { content }), 'Đã lưu nội dung. Chặng trở về Nháp cho tới khi duyệt lại.')) { onSaved(); onClose(); }
  };
  const saveItem = async (): Promise<void> => {
    if (!item) return;
    const body = parse(item.text);
    if (body === undefined || typeof body !== 'object' || body === null) return;
    if (await run(() => saga.adminUpdateItem(session.token, item.id, body as Record<string, unknown>), 'Đã lưu câu luyện tập')) { setItem(null); detail.reload(); onSaved(); }
  };
  const d = detail.data;
  return (
    <Sheet open onClose={onClose} wide title={`Nội dung: ${stage.title}`} subtitle={`Phiên bản ${d?.version ?? stage.version} · ${STATUS[d?.status ?? stage.status].text}`}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Đóng" tone="giay" onPress={onClose} />
        {item ? <Btn title="Lưu câu luyện tập" tone="son" loading={busy} onPress={() => { void saveItem(); }} testID="saga-admin-item-save" /> : <Btn title="Lưu nội dung chặng" tone="son" loading={busy} disabled={!d} onPress={() => { void saveContent(); }} testID="saga-admin-content-save" />}
      </View>}>
      <ErrorNote message={detail.error ?? problem} />
      {!d ? <Spinner label="Đang tải nội dung…" /> : item ? (
        <View style={{ gap: 10 }}>
          <Btn title="Quay lại nội dung chặng" tone="giay" size="sm" onPress={() => { setItem(null); setProblem(null); }} />
          <Field label="Câu luyện tập (đề bài, giải thích, dữ liệu, bật / tắt)" value={item.text} onChangeText={(t) => setItem({ id: item.id, text: t })} multiline autoCapitalize="none" autoCorrect={false} inputStyle={{ fontFamily: FONT.mono, fontSize: 13, minHeight: 380, textAlignVertical: 'top' }} testID="saga-admin-item-json" />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <InfoNote><Txt size={13}>Nội dung gồm mục tiêu học, thẻ kiến thức, nguồn, cảnh nhập vai, kịch bản trận đánh và phần tổng kết. Khi lưu, máy chủ kiểm tra cấu trúc, giữ bản cũ trong lịch sử phiên bản và đưa chặng về Nháp (học sinh không thấy) cho tới khi duyệt và công bố lại. Dữ kiện lịch sử cần có nguồn; lời thoại và chỉ số trò chơi là phần sáng tạo.</Txt></InfoNote>
          <Field label="Nội dung chặng (JSON)" value={text} onChangeText={setText} multiline autoCapitalize="none" autoCorrect={false} inputStyle={{ fontFamily: FONT.mono, fontSize: 13, minHeight: 360, textAlignVertical: 'top' }} testID="saga-admin-content-json" />
          <Txt f="bold" size={15} accessibilityRole="header">Câu luyện tập và ôn tập ({d.items.length})</Txt>
          {d.items.map((it) => (
            <View key={String(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.adminLine, borderRadius: 6, padding: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt f="semibold" size={14} numberOfLines={2}>{String(it.prompt)}</Txt>
                <Txt size={12} color={c.muc2}>{String(it.kind)} · dùng cho: {String(it.usage)} · mục tiêu {String(it.objective)}{it.is_active ? '' : ' · đang tắt'}</Txt>
              </View>
              <Btn title="Sửa" tone="giay" size="sm" onPress={() => { setProblem(null); setItem({ id: Number(it.id), text: JSON.stringify({ prompt: it.prompt, explanation: it.explanation, data: it.data, is_active: it.is_active }, null, 2) }); }} testID={`saga-admin-item-${it.id}`} />
            </View>
          ))}
          {d.versions.length ? <Txt size={12} color={c.muc2}>Phiên bản đã lưu: {d.versions.map((v) => `v${v.version} (${STATUS[v.status as AdminStage['status']]?.text ?? v.status}, ${when(v.saved_at)})`).join('; ')}</Txt> : null}
        </View>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- quản trị tổng
export const SagaAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const { data, error, loading, reload } = useLoad(() => saga.adminOverview(token), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [no, setNo] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<'node' | 'anchor'>('node');
  const [editing, setEditing] = useState<AdminStage | null>(null);
  const [status, setStatus] = useState<AdminStage | null>(null);
  const [content, setContent] = useState<AdminStage | null>(null);
  const [image, setImage] = useState(false);
  const map = data?.maps.find((m) => m.campaign_no === no) ?? null;
  const stages = useMemo(() => (data?.stages ?? []).filter((s) => s.campaign_no === no), [data, no]);
  const picked = draft ? stages.find((s) => s.id === draft.id) ?? null : null;
  const select = (st: AdminStage): void => { setTarget('node'); setDraft({ id: st.id, map_x: st.map_x, map_y: st.map_y, anchor_x: st.anchor_x, anchor_y: st.anchor_y }); };
  const place = (x: number, y: number): void => setDraft((d) => (d ? (target === 'node' ? { ...d, map_x: x, map_y: y } : { ...d, anchor_x: x, anchor_y: y }) : d));
  const savePosition = async (): Promise<void> => {
    if (!draft) return;
    if (await run(() => saga.adminMoveStage(token, draft.id, { map_x: draft.map_x, map_y: draft.map_y, anchor_x: draft.anchor_x, anchor_y: draft.anchor_y }), 'Đã lưu vị trí chặng')) { setDraft(null); reload(); }
  };
  const setRatio = (key: keyof Omit<Draft, 'id'>, text: string): void => { const v = ratio(text); if (v !== null) setDraft((d) => (d ? { ...d, [key]: v } : d)); };
  return (
    <Page>
      <PageHeader title="Hành trình Đông A" subtitle="Bản đồ ba cuộc kháng chiến của trang học sinh: ảnh nền, vị trí từng chặng, ngưỡng đạt, phần thưởng, trạng thái duyệt và nội dung. Vị trí lưu theo tỉ lệ trên ảnh nên đổi ảnh không phải đặt lại." />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải…" /> : null}
      {data ? (
        <>
          <Segmented<1 | 2 | 3> label="Cuộc kháng chiến" value={no} onChange={(v) => { setNo(v); setDraft(null); }}
            options={data.maps.map((m) => ({ value: m.campaign_no as 1 | 2 | 3, label: `${m.short_title} · ${m.years}` }))} />
          {map ? (
            <Card flat pad={14} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 240 }}>
                  <Txt f="bold" size={16} accessibilityRole="header">{map.title}</Txt>
                  <Txt size={13} color={c.muc2}>Ảnh: {map.image_url ? 'liên kết riêng' : map.image_key} · {map.image_w} × {map.image_h} px. {map.credit}</Txt>
                </View>
                <Btn title="Đổi ảnh bản đồ" tone="giay" size="sm" onPress={() => setImage(true)} testID="saga-admin-image" />
                {map.credit_url ? <Btn title="Trang gốc của ảnh" tone="ghost" size="sm" onPress={() => { void Linking.openURL(map.credit_url!); }} /> : null}
              </View>
              <MapEditor map={map} stages={stages} draft={draft} target={target} onPlace={place} onSelect={select} />
              {draft && picked ? (
                <View style={{ gap: 10, borderWidth: 1, borderColor: c.adminLine, borderRadius: 6, padding: 12 }} testID="saga-admin-position">
                  <Txt f="bold" size={15}>Đang đặt vị trí: {picked.title}</Txt>
                  <Txt size={13} color={c.muc2}>Bấm lên bản đồ để đặt {target === 'node' ? 'nút của chặng' : 'điểm địa danh (nút sẽ nối tới điểm này bằng một đường dẫn, dùng khi nhiều địa danh nằm sát nhau)'}; hoặc nhập tỉ lệ phần trăm tính từ mép trái và mép trên của ảnh.</Txt>
                  <Segmented<'node' | 'anchor'> label="Đang đặt" value={target} onChange={setTarget} options={[{ value: 'node', label: 'Nút của chặng' }, { value: 'anchor', label: 'Điểm địa danh' }]} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <Field label="Nút: ngang (%)" value={pct(draft.map_x)} onChangeText={(t) => setRatio('map_x', t)} keyboardType="decimal-pad" style={{ width: 130 }} testID="saga-admin-x" />
                    <Field label="Nút: dọc (%)" value={pct(draft.map_y)} onChangeText={(t) => setRatio('map_y', t)} keyboardType="decimal-pad" style={{ width: 130 }} testID="saga-admin-y" />
                    <Field label="Địa danh: ngang (%)" value={pct(draft.anchor_x)} placeholder="Không dùng" onChangeText={(t) => setRatio('anchor_x', t)} keyboardType="decimal-pad" style={{ width: 150 }} />
                    <Field label="Địa danh: dọc (%)" value={pct(draft.anchor_y)} placeholder="Không dùng" onChangeText={(t) => setRatio('anchor_y', t)} keyboardType="decimal-pad" style={{ width: 150 }} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Btn title="Lưu vị trí" tone="son" loading={busy} onPress={() => { void savePosition(); }} testID="saga-admin-save-position" />
                    {draft.anchor_x !== null ? <Btn title="Bỏ điểm địa danh" tone="giay" onPress={() => setDraft({ ...draft, anchor_x: null, anchor_y: null })} /> : null}
                    <Btn title="Hủy" tone="giay" onPress={() => setDraft(null)} />
                  </View>
                </View>
              ) : <Txt size={13} color={c.muc2}>Bấm một nút trên bản đồ (hoặc nút “Vị trí” trong bảng) để chỉnh vị trí. Màu nút: xanh lá = Công bố, xanh dương = Đã duyệt, xám = Nháp.</Txt>}
            </Card>
          ) : null}
          <DataTable rows={stages} rowKey={(s) => s.id} empty="Cuộc kháng chiến này chưa có chặng nào." paginate={false} actionsWidth={300}
            columns={[
              { key: 'title', label: 'Chặng', flex: 2.2, render: (s) => <Cell main={`${stages.indexOf(s) + 1}. ${s.title}`} sub={`${s.date_label} · ${KIND[s.kind] ?? s.kind}${s.has_battle ? ' · có trận' : ''}`} /> },
              { key: 'items', label: 'Câu hỏi', render: (s) => <Txt size={14}>{s.items}</Txt> },
              { key: 'players', label: 'Học sinh', render: (s) => <Cell main={`${s.done} xong`} sub={`${s.started} đã bắt đầu`} /> },
              { key: 'rule', label: 'Ngưỡng / thưởng', flex: 1.3, render: (s) => <Cell main={`Đạt ${s.pass_percent}%`} sub={`+${s.reward_xp} điểm · +${s.reward_gold} vàng`} /> },
              { key: 'status', label: 'Trạng thái', render: (s) => <View style={{ gap: 2 }}><StatusChip kind={STATUS[s.status].kind} text={`${STATUS[s.status].text} · v${s.version}`} /></View> },
            ]}
            actions={(s) => (<>
              <Btn title="Vị trí" tone="giay" size="sm" onPress={() => select(s)} testID={`saga-admin-pos-${s.code}`} />
              <Btn title="Sửa" tone="giay" size="sm" onPress={() => setEditing(s)} testID={`saga-admin-edit-${s.code}`} />
              <Btn title="Duyệt" tone="giay" size="sm" onPress={() => setStatus(s)} testID={`saga-admin-status-${s.code}`} />
              <Btn title="Nội dung" tone="giay" size="sm" onPress={() => setContent(s)} testID={`saga-admin-content-${s.code}`} />
            </>)} />
          <InfoNote><Txt size={13}>Học sinh chỉ thấy chặng ở trạng thái Công bố. Nội dung khởi tạo do nhóm phát triển biên soạn từ các nguồn ghi trong từng chặng; giáo viên Lịch sử nên rà lại trước khi dùng chính thức.</Txt></InfoNote>
        </>
      ) : null}

      {editing ? (
        <FormSheet title={`Sửa chặng: ${editing.title}`} subtitle="Tên, thời gian, tóm tắt, ngưỡng đạt phần luyện tập và phần thưởng khi hoàn thành lần đầu" wide
          fields={[
            { name: 'title', label: 'Tên chặng', required: true }, { name: 'place', label: 'Địa điểm', required: true }, { name: 'date_label', label: 'Thời gian', required: true },
            { name: 'summary', label: 'Tóm tắt', type: 'textarea', required: true },
            { name: 'pass_percent', label: 'Ngưỡng đạt phần luyện tập (%)', type: 'number', required: true, hint: 'Từ 40 đến 100; mặc định 70.' },
            { name: 'reward_xp', label: 'Điểm kinh nghiệm thưởng', type: 'number', required: true }, { name: 'reward_gold', label: 'Vàng thưởng', type: 'number', required: true },
          ]}
          initial={{ title: editing.title, place: editing.place, date_label: editing.date_label, summary: editing.summary, pass_percent: String(editing.pass_percent), reward_xp: String(editing.reward_xp), reward_gold: String(editing.reward_gold) }}
          onSubmit={async (v) => { await saga.adminUpdateStage(token, editing.id, { title: v.title, place: v.place, date_label: v.date_label, summary: v.summary, pass_percent: Number(v.pass_percent), reward_xp: Number(v.reward_xp), reward_gold: Number(v.reward_gold) }); setEditing(null); reload(); }}
          onClose={() => setEditing(null)} />
      ) : null}
      {status ? (
        <FormSheet title={`Duyệt chặng: ${status.title}`} subtitle="Học sinh chỉ thấy chặng đã Công bố. Công bố cần nội dung đúng cấu trúc và ít nhất 3 câu luyện tập."
          fields={[
            { name: 'status', label: 'Trạng thái', type: 'select', required: true, options: [{ value: 'draft', label: 'Nháp (ẩn với học sinh)' }, { value: 'reviewed', label: 'Đã duyệt nội dung (chưa công bố)' }, { value: 'published', label: 'Công bố cho học sinh' }] },
            { name: 'note', label: 'Ghi chú duyệt', type: 'textarea', hint: 'Ví dụ: người rà nội dung, ngày rà, điểm cần sửa.' },
          ]}
          initial={{ status: status.status, note: status.review_note ?? '' }}
          onSubmit={async (v) => { await saga.adminSetStatus(token, status.id, v.status as AdminStage['status'], String(v.note || '') || undefined); setStatus(null); reload(); }}
          onClose={() => setStatus(null)} />
      ) : null}
      {image && map ? (
        <FormSheet title={`Ảnh bản đồ: ${map.short_title}`} subtitle="Dùng ảnh có sẵn trong ứng dụng hoặc một liên kết https. Nhập đúng kích thước ảnh để giữ tỉ lệ; vị trí các chặng tự khớp theo tỉ lệ." wide
          fields={[
            { name: 'image_key', label: 'Ảnh có sẵn', type: 'select', required: true, options: [1, 2, 3].map((n) => ({ value: `ban-do-khang-chien-${n}`, label: `Bản đồ gốc lần ${n} (Wikipedia tiếng Việt)` })) },
            { name: 'image_url', label: 'Liên kết ảnh riêng (https, không bắt buộc)', hint: 'Để trống để dùng ảnh có sẵn. Chỉ dùng ảnh nhà trường có quyền sử dụng.' },
            { name: 'image_w', label: 'Chiều rộng ảnh (px)', type: 'number', required: true }, { name: 'image_h', label: 'Chiều cao ảnh (px)', type: 'number', required: true },
            { name: 'credit', label: 'Ghi nguồn ảnh', type: 'textarea', required: true }, { name: 'credit_url', label: 'Liên kết nguồn (https)' },
          ]}
          initial={{ image_key: map.image_key, image_url: map.image_url ?? '', image_w: String(map.image_w), image_h: String(map.image_h), credit: map.credit, credit_url: map.credit_url ?? '' }}
          onSubmit={async (v) => { await saga.adminUpdateMap(token, map.campaign_no, { image_key: String(v.image_key), image_url: String(v.image_url || '') || null, image_w: Number(v.image_w), image_h: Number(v.image_h), credit: String(v.credit), credit_url: String(v.credit_url || '') || null }); setImage(false); reload(); }}
          onClose={() => setImage(false)} />
      ) : null}
      {content ? <ContentSheet session={session} stage={content} onClose={() => setContent(null)} onSaved={reload} /> : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- giáo viên: tiến độ lớp
export const SagaClassReport: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const classes = useLoad(() => analytics.classes(token), [token], session.expired);
  const [classId, setClassId] = useState<number | null>(null);
  const list = classes.data ?? [];
  const current = classId ?? list.find((x) => x.is_active)?.id ?? list[0]?.id ?? null;
  const report = useLoad(() => (current ? saga.classReport(token, current) : Promise.resolve(null)), [token, current], session.expired);
  const r = report.data;
  const started = r ? r.students.filter((s) => s.done > 0 || s.knowledge_percent > 0).length : 0;
  return (
    <Page>
      <PageHeader title="Hành trình Đông A" subtitle="Tiến độ của lớp trên bản đồ ba cuộc kháng chiến chống quân Mông – Nguyên: số chặng đã hoàn thành, mức hiểu bài (phần luyện tập, tách khỏi điểm trận đánh) và những câu học sinh thường sai." />
      <ErrorNote message={classes.error ?? report.error} />
      {classes.loading && !classes.data ? <Spinner label="Đang tải danh sách lớp…" /> : null}
      {classes.data && !list.length ? <EmptyState mood="thinking" title="Chưa có lớp nào" text="Thầy cô sẽ thấy báo cáo ở đây khi được phân công lớp." /> : null}
      {list.length ? <View style={{ maxWidth: 360 }}><AdminSelect label="Lớp" value={current ?? 0} options={list.map((x) => ({ value: x.id, label: `${x.name}${x.year_label ? ` · ${x.year_label}` : ''} (${x.students} học sinh)` }))} onChange={(v) => setClassId(Number(v))} testID="saga-class-select" /></View> : null}
      {report.loading && current ? <Spinner label="Đang tải báo cáo lớp…" /> : null}
      {r ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} testID="saga-class-summary">
            {[{ label: 'Học sinh', value: String(r.students.length) }, { label: 'Đã bắt đầu học', value: String(started) }, { label: 'Chặng hoàn thành (trung bình)', value: r.students.length ? `${(r.students.reduce((n, s) => n + s.done, 0) / r.students.length).toFixed(1)} / ${r.total_stages}` : '0' }].map((m) => (
              <Card key={m.label} flat pad={14} style={{ flexGrow: 1, flexBasis: 180 }}><Txt size={13} color={c.muc2}>{m.label}</Txt><Txt f="displayHeavy" size={24}>{m.value}</Txt></Card>
            ))}
          </View>
          <DataTable rows={r.students} rowKey={(s) => s.id} empty="Lớp chưa có học sinh."
            columns={[
              { key: 'name', label: 'Học sinh', flex: 2, render: (s) => <Cell main={s.full_name} sub={s.user_code} /> },
              { key: 'done', label: 'Chặng xong', flex: 1.4, render: (s) => <View style={{ gap: 4 }}><Txt size={14}>{s.done}/{r.total_stages}</Txt><Bar value={s.done} max={r.total_stages} height={8} label={`${s.full_name}: ${s.done} trên ${r.total_stages} chặng`} /></View> },
              { key: 'stars', label: 'Sao', render: (s) => <Txt size={14}>{s.stars}</Txt> },
              { key: 'knowledge', label: 'Hiểu bài', render: (s) => <Txt size={14}>{s.knowledge_percent ? `${s.knowledge_percent}%` : 'Chưa có'}</Txt> },
              { key: 'hints', label: 'Gợi ý đã xem', render: (s) => <Txt size={14}>{s.hints}</Txt> },
              { key: 'last', label: 'Học gần nhất', render: (s) => <Txt size={13} color={c.muc2}>{when(s.last_at)}</Txt> },
            ]} />
          <Card flat pad={14} style={{ gap: 10 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Theo từng chặng</Txt>
            {r.stages.map((st) => (
              <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt size={14} style={{ width: 220 }} numberOfLines={1}>Lần {st.campaign_no} · {st.title}</Txt>
                <Bar value={st.done} max={Math.max(1, r.students.length)} height={10} style={{ flex: 1 }} label={`${st.title}: ${st.done} trên ${r.students.length} học sinh đã hoàn thành`} />
                <Txt size={13} color={c.muc2} style={{ width: 150, textAlign: 'right' }}>{st.done}/{r.students.length} xong{st.knowledge_percent ? ` · hiểu ${st.knowledge_percent}%` : ''}</Txt>
              </View>
            ))}
          </Card>
          <Card flat pad={14} style={{ gap: 8 }} testID="saga-class-wrong">
            <Txt f="bold" size={16} accessibilityRole="header">Câu học sinh thường sai</Txt>
            {r.often_wrong.length ? r.often_wrong.map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 8 }}>
                <View style={{ flex: 1 }}><Txt f="semibold" size={14}>{w.prompt}</Txt><Txt size={12} color={c.muc2}>{w.kind_label} · chặng {w.stage_title}</Txt></View>
                <Txt f="bold" size={14} color={c.sonChu}>{w.wrong_percent}% sai</Txt>
                <Txt size={12} color={c.muc2}>{w.students} học sinh · {w.answers} lượt</Txt>
              </View>
            )) : <Txt size={14} color={c.muc2}>Chưa có câu nào bị trả lời sai.</Txt>}
          </Card>
        </>
      ) : null}
    </Page>
  );
};
