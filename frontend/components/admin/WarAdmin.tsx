/**
 * Quản trị game trận đánh bằng thẻ tướng (Sprint 6 theo ver0.2, HK.AD.080–090): thẻ tướng – thẻ chiến thuật và chiêu thức kèm giai thoại, bản đồ hành quân (điểm, đường nối,
 * sự kiện), hội thoại cốt truyện (phát hành cần tư liệu nguồn), màn chơi (đợt quân, địa hình, thưởng) kèm chơi thử và chạy cân bằng chỉ số, chỉ huy đối phương, kho tài nguyên
 * (bắt buộc ghi nguồn và giấy phép). Phần phức tạp (bố cục bản đồ, đợt quân, lời thoại) soạn bằng JSON có mẫu; máy chủ kiểm tra mọi giới hạn và trả lỗi tiếng Việt.
 * Cài đặt của trường (bật/tắt, khối lớp, khung giờ, số phút mỗi ngày – HK.QT.056) nằm ở SchoolWarSettings.
 */
import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pencil, Play, Plus, Scale, Swords, Trash2 } from 'lucide-react-native';
import * as api from '@/api/warApi';
import { useCampaignOptions } from '@/components/admin/ContentKit';
import { Cell, DataTable, ErrorNote, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Overlay } from '@/components/portal/LessonReader';
import { WarBattleScreen } from '@/components/portal/WarPlay';
import { Btn, Card, ConfirmSheet, Field, Segmented, Sheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BRANCH_LABEL, RARITY_LABEL, SLOT_LABEL, type BattleView, type Branch, type Slot, type WarRarity } from '@/types/war';

type Row = Record<string, any>;
const num = (v: unknown): number => Number(String(v ?? '').trim());
const orNull = (v: unknown): string | null => String(v ?? '').trim() || null;
const json = (text: unknown, label: string): any => { try { return JSON.parse(String(text ?? '')); } catch (e) { throw new Error(`${label}: chưa phải JSON hợp lệ (${(e as Error).message})`); } };
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const STATUS: Record<string, [('on' | 'muted'), string]> = { published: ['on', 'Đã phát hành'], draft: ['muted', 'Nháp'] };
const TARGETS = [['enemy_one', 'Một kẻ địch'], ['enemy_all', 'Mọi kẻ địch'], ['ally_one', 'Một đồng đội'], ['ally_all', 'Cả đội'], ['self', 'Bản thân']];
const EFFECTS = [['', 'Không có hiệu ứng'], ['stun', 'Choáng'], ['shield', 'Khiên'], ['atk_up', 'Tăng công'], ['def_up', 'Tăng thủ'], ['atk_down', 'Giảm công'], ['heal', 'Trị liệu'], ['drain', 'Hút máu'], ['burn', 'Bỏng cháy'], ['hunger', 'Thiếu lương']];
const TACTICS = [['atk_up', 'Tăng công cả đội'], ['def_up', 'Tăng thủ cả đội'], ['hunger', 'Địch thiếu lương'], ['stakes', 'Cọc ngầm'], ['heal_all', 'Hồi máu cả đội'], ['stun_enemy', 'Làm choáng địch']];
const opts = (list: string[][]) => list.map(([value, label]) => ({ value, label }));

/** Ô soạn JSON nhiều dòng, có hướng dẫn và nút dùng mẫu */
const JsonBox: React.FC<{ label: string; hint: string; value: string; onChange: (v: string) => void; template?: unknown; height?: number; testID?: string }> = ({ label, hint, value, onChange, template, height = 220, testID }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      <Txt size={13} color={c.muc3}>{hint}</Txt>
      <TextInput value={value} onChangeText={onChange} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false} accessibilityLabel={label} testID={testID}
        style={{ minHeight: height, maxHeight: 520, borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, padding: 10, backgroundColor: c.the, color: c.muc, fontFamily: FONT.body, fontSize: 13, textAlignVertical: 'top' } as never} />
      {template !== undefined ? <View style={{ flexDirection: 'row' }}><Btn title="Dùng mẫu" tone="giay" size="sm" onPress={() => onChange(pretty(template))} /></View> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- thẻ và chiêu thức
const CardEditor: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const card = useLoad(() => api.adminCard(token, id), [token, id], session.expired);
  const { run } = useAction(session.expired);
  const [stats, setStats] = useState(false);
  const [move, setMove] = useState<{ slot: string; row?: Row } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const d = card.data;
  const tactic = d?.kind === 'tactic';
  const statFields: FieldDef[] = [
    { name: 'atk', label: 'Công (1–1000)', type: 'number', required: true }, { name: 'def', label: 'Thủ (0–1000)', type: 'number', required: true },
    { name: 'hp', label: 'Máu (50–20000)', type: 'number', required: true }, { name: 'spd', label: 'Tốc độ (1–100)', type: 'number', required: true },
    ...(tactic ? [] : [{ name: 'branch', label: 'Binh chủng', type: 'select' as const, options: [{ value: '', label: 'Chưa xác định' }, ...(Object.keys(BRANCH_LABEL) as Branch[]).map((b) => ({ value: b, label: BRANCH_LABEL[b] }))] }]),
    { name: 'fragments_needed', label: 'Số mảnh để ghép thẻ (1–50)', type: 'number', required: true },
    { name: 'source_text', label: 'Cách nhận thẻ (hiện cho học sinh)', hint: 'Tối đa 300 ký tự' },
    ...(tactic ? [{ name: 'tactic_effect', label: 'Hiệu ứng thẻ chiến thuật', type: 'select' as const, options: opts(TACTICS) }, { name: 'tactic_value', label: 'Giá trị (0–1)', type: 'number' as const }, { name: 'tactic_turns', label: 'Số lượt (1–10)', type: 'number' as const }, { name: 'tactic_text', label: 'Mô tả ngắn' }] : []),
  ];
  const moveFields = (slot: string): FieldDef[] => [
    { name: 'name', label: `Tên ${SLOT_LABEL[slot as Slot].toLowerCase()}`, required: true }, { name: 'description', label: 'Mô tả chiêu', type: 'textarea' },
    { name: 'anecdote', label: 'Giai thoại lịch sử (hiện ở mặt sau thẻ)', type: 'textarea', hint: 'Chỉ ghi điều có trong tư liệu đã kiểm chứng' },
    { name: 'target', label: 'Mục tiêu', type: 'select', options: opts(TARGETS) }, { name: 'power', label: 'Hệ số sát thương hoặc trị liệu (0–5)', type: 'number' },
    { name: 'rage_cost', label: 'Nộ cần (0–100)', type: 'number' }, { name: 'cooldown', label: 'Hồi chiêu (0–10 lượt)', type: 'number' },
    { name: 'effect_type', label: 'Hiệu ứng kèm theo', type: 'select', options: opts(EFFECTS) }, { name: 'effect_value', label: 'Giá trị hiệu ứng (0–5)', type: 'number' }, { name: 'effect_turns', label: 'Số lượt hiệu ứng (1–10)', type: 'number' },
    { name: 'anim', label: 'Mã hoạt ảnh (chữ thường, gạch dưới)' },
  ];
  return (
    <Sheet open onClose={onClose} title={d?.name ?? 'Thẻ'} subtitle={d ? `${d.code} · ${RARITY_LABEL[d.rarity as WarRarity] ?? d.rarity} · ${tactic ? 'chiến thuật' : 'tướng'}` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={card.error} />
      {card.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <Card flat pad={12} style={{ gap: 4 }}>
            <Txt f="bold" size={14}>Chỉ số gốc</Txt>
            <Txt size={14}>Công {d.base_stats.atk} · Thủ {d.base_stats.def} · Máu {d.base_stats.hp} · Tốc {d.base_stats.spd}{d.branch ? ` · ${BRANCH_LABEL[d.branch as Branch]}` : ''} · {d.fragments_needed} mảnh để ghép</Txt>
            {d.tactic ? <Txt size={13} color={c.muc2}>Chiến thuật: {d.tactic.effect} ({Math.round(d.tactic.value * 100)}%, {d.tactic.turns} lượt){d.tactic.text ? ` – ${d.tactic.text}` : ''}</Txt> : null}
            <View style={{ flexDirection: 'row' }}><Btn icon={Pencil} title="Sửa chỉ số" tone="giay" size="sm" onPress={() => setStats(true)} testID="card-edit-stats" /></View>
          </Card>
          {tactic ? null : (
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={14}>Chiêu thức</Txt>
              {(['normal', 'active', 'ultimate', 'passive'] as const).map((slot) => {
                const m = (d.moves as Row[]).find((x) => x.slot === slot);
                return (
                  <Card key={slot} flat pad={12} style={{ gap: 4 }}>
                    <Txt f="semibold" size={14}>{SLOT_LABEL[slot]}: {m ? m.name : 'chưa có'}</Txt>
                    {m?.description ? <Txt size={13}>{m.description}</Txt> : null}
                    {m?.anecdote ? <Txt size={12} color={c.muc2}>Giai thoại: {m.anecdote}</Txt> : null}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Btn icon={m ? Pencil : Plus} title={m ? 'Sửa' : 'Thêm'} tone="giay" size="sm" onPress={() => setMove({ slot, row: m })} testID={`move-${slot}`} />
                      {m ? <Btn icon={Trash2} label={`Xóa ${m.name}`} tone="giay" size="sm" onPress={() => setRemove(m)} /> : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      {stats && d ? (
        <FormSheet title="Sửa chỉ số thẻ" subtitle={d.name} fields={statFields} onClose={() => setStats(false)}
          initial={{ atk: String(d.base_stats.atk), def: String(d.base_stats.def), hp: String(d.base_stats.hp), spd: String(d.base_stats.spd), branch: d.branch ?? '', fragments_needed: String(d.fragments_needed), source_text: d.source_text ?? '', tactic_effect: d.tactic?.effect ?? 'atk_up', tactic_value: String(d.tactic?.value ?? 0.2), tactic_turns: String(d.tactic?.turns ?? 3), tactic_text: d.tactic?.text ?? '' }}
          onSubmit={async (v) => {
            const body: Row = { base_stats: { atk: num(v.atk), def: num(v.def), hp: num(v.hp), spd: num(v.spd) }, fragments_needed: num(v.fragments_needed), source_text: orNull(v.source_text) };
            if (tactic) body.tactic = { effect: v.tactic_effect, value: num(v.tactic_value), turns: num(v.tactic_turns), text: orNull(v.tactic_text) }; else body.branch = orNull(v.branch);
            card.setData(await api.updateCardWar(token, id, body)); setStats(false); onChanged();
          }} />
      ) : null}
      {move && d ? (
        <FormSheet wide title={`${move.row ? 'Sửa' : 'Thêm'} ${SLOT_LABEL[move.slot as Slot].toLowerCase()}`} subtitle={d.name} fields={moveFields(move.slot)} onClose={() => setMove(null)}
          initial={move.row ? { name: move.row.name, description: move.row.description ?? '', anecdote: move.row.anecdote ?? '', target: move.row.target, power: String(move.row.power), rage_cost: String(move.row.rage_cost), cooldown: String(move.row.cooldown), effect_type: move.row.effect?.type ?? '', effect_value: String(move.row.effect?.value ?? ''), effect_turns: String(move.row.effect?.turns ?? ''), anim: move.row.anim ?? '' }
            : { target: 'enemy_one', power: '1', rage_cost: move.slot === 'ultimate' ? '100' : move.slot === 'active' ? '40' : '0', cooldown: '0', effect_type: '' }}
          onSubmit={async (v) => {
            const body: Row = { name: String(v.name).trim(), description: orNull(v.description), anecdote: orNull(v.anecdote), target: v.target, power: num(v.power), rage_cost: num(v.rage_cost), cooldown: num(v.cooldown), anim: orNull(v.anim) };
            if (v.effect_type) body.effect = { type: v.effect_type, value: num(v.effect_value || 0), turns: num(v.effect_turns || 2) };
            card.setData(await api.upsertMove(token, id, move.slot, body)); setMove(null); onChanged();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa chiêu “${remove?.name ?? ''}”?`} message="Thẻ sẽ dùng chiêu cơ bản ở vị trí này." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; const res = await run(() => api.deleteMove(token, id, remove.slot), 'Đã xóa chiêu'); if (res) { card.setData(res); setRemove(null); onChanged(); } }} />
    </Sheet>
  );
};

const CardsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.adminCards(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Thẻ tướng và thẻ chiến thuật dùng chung toàn hệ thống. Thẻ mới được thêm ở mục “Trò chơi hóa → Danh mục → Thẻ”; ở đây chỉnh chỉ số, binh chủng, số mảnh và chiêu thức.</Txt>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có thẻ nào" onRowPress={(r) => setOpen(r.id)}
        columns={[
          { key: 'name', label: 'Thẻ', flex: 2, render: (r) => <Cell main={r.name} sub={r.code} /> },
          { key: 'rarity', label: 'Độ hiếm', render: (r) => <Txt size={13}>{RARITY_LABEL[r.rarity as WarRarity] ?? r.rarity}</Txt> },
          { key: 'kind', label: 'Loại', render: (r) => <Txt size={13}>{r.kind === 'tactic' ? 'Chiến thuật' : `Tướng${r.branch ? ` · ${BRANCH_LABEL[r.branch as Branch]}` : ''}`}</Txt> },
          { key: 'stats', label: 'Công / Thủ / Máu / Tốc', render: (r) => <Txt size={13}>{r.base_stats?.atk} / {r.base_stats?.def} / {r.base_stats?.hp} / {r.base_stats?.spd}</Txt> },
          { key: 'moves', label: 'Chiêu', render: (r) => <Txt size={13}>{r.moves}</Txt> },
        ]}
        actions={(r) => <Btn icon={Pencil} label={`Sửa ${r.name}`} tone="giay" size="sm" onPress={() => setOpen(r.id)} />} />
      {open !== null ? <CardEditor session={session} id={open} onClose={() => setOpen(null)} onChanged={list.reload} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- bản đồ hành quân
const LAYOUT_TEMPLATE = {
  points: [
    { code: 'xuat-phat', name: 'Xuất phát', kind: 'start', x: 10, y: 60, description: 'Điểm bắt đầu hành quân', payload: {} },
    { code: 'cot-truyen', name: 'Hội nghị', kind: 'story', x: 35, y: 40, payload: {} },
    { code: 'ruong', name: 'Kho lương', kind: 'chest', x: 55, y: 70, payload: { gold: 30, binh_thu: 3 } },
    { code: 'tran-danh', name: 'Chiến trường', kind: 'battle', x: 85, y: 45, payload: { stage_id: 1 } },
  ],
  edges: [{ from: 'xuat-phat', to: 'cot-truyen' }, { from: 'cot-truyen', to: 'ruong' }, { from: 'ruong', to: 'tran-danh' }],
};

const MapsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const list = useLoad(() => api.adminMaps(token), [token], session.expired);
  const campaigns = useCampaignOptions(session);
  const { run, busy } = useAction(session.expired);
  const [create, setCreate] = useState(false);
  const [layout, setLayout] = useState<Row | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const edit = async (row: Row) => {
    const full = await run(() => api.adminMap(token, row.id));
    if (full) { setProblems(full.problems ?? []); setLayout(full); }
  };
  const toggle = async (row: Row) => {
    if (await run(() => api.mapStatus(token, row.id, row.status === 'published' ? 'draft' : 'published'), row.status === 'published' ? 'Đã gỡ bản đồ về Nháp' : 'Đã phát hành bản đồ')) list.reload();
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Mỗi cuộc kháng chiến có một bản đồ hành quân. Vị trí x, y tính theo phần trăm bản đồ; mã điểm giữ nguyên thì giữ nguyên tiến độ của học sinh.</Txt>
        <Btn icon={Plus} title="Thêm bản đồ" tone="son" onPress={() => setCreate(true)} testID="map-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có bản đồ hành quân" actionsWidth={230}
        columns={[
          { key: 'title', label: 'Bản đồ', flex: 2, render: (r) => <Cell main={r.title} sub={r.campaign_title} /> },
          { key: 'points', label: 'Điểm', render: (r) => <Txt size={13}>{r.points}</Txt> },
          { key: 'players', label: 'Học sinh đã đi', render: (r) => <Txt size={13}>{r.players}</Txt> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={STATUS[r.status]?.[0] ?? 'muted'} text={STATUS[r.status]?.[1] ?? r.status} /> },
        ]}
        actions={(r) => (<>
          <Btn icon={Pencil} label={`Sửa bố cục ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => edit(r)} />
          <Btn title={r.status === 'published' ? 'Gỡ' : 'Phát hành'} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r)} />
          <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {create ? (
        <FormSheet title="Thêm bản đồ hành quân" onClose={() => setCreate(false)} initial={{}}
          fields={[{ name: 'campaign_id', label: 'Cuộc kháng chiến', type: 'select', required: true, options: campaigns }, { name: 'title', label: 'Tên bản đồ', required: true }, { name: 'background_url', label: 'Ảnh nền (liên kết https, cần ghi nguồn ở kho tài nguyên)' }]}
          onSubmit={async (v) => { await api.createMap(token, { campaign_id: num(v.campaign_id), title: String(v.title).trim(), background_url: orNull(v.background_url) }); setCreate(false); list.reload(); }} />
      ) : null}
      {layout ? (
        <FormSheet wide title="Sửa bố cục bản đồ" subtitle={`${layout.title} · ${layout.campaign_title}`} onClose={() => setLayout(null)}
          initial={{ title: layout.title, background_url: layout.background_url ?? '', layout: pretty({ points: (layout.points as Row[]).map((p) => ({ code: p.code, name: p.name, kind: p.kind, x: p.x, y: p.y, description: p.description ?? '', payload: p.payload ?? {} })), edges: (layout.edges as Row[]).map((e) => ({ from: e.from_code, to: e.to_code })) }) }}
          fields={[
            { name: 'title', label: 'Tên bản đồ', required: true }, { name: 'background_url', label: 'Ảnh nền (https)' },
            { name: 'problems', label: 'Cảnh báo', render: () => (problems.length ? <Txt size={13} color="#b45309">Cảnh báo: {problems.join('; ')}</Txt> : <Txt size={13}>Không có cảnh báo.</Txt>) },
            { name: 'layout', label: 'Bố cục', render: (values, set) => (
              <JsonBox label="Điểm và đường nối (JSON)" testID="map-layout" value={String(values.layout ?? '')} onChange={(t) => set('layout', t)} template={LAYOUT_TEMPLATE} height={320}
                hint="Loại điểm: start (đúng một), story, card {card_code, qty}, quiz {quiz_id, gold, binh_thu}, source {source_id}, battle {stage_id}, chest {gold, binh_thu, fragments}. Mọi điểm phải nối được tới điểm xuất phát." />
            ) },
          ]}
          onSubmit={async (v) => {
            await api.updateMap(token, layout.id, { title: String(v.title).trim(), background_url: orNull(v.background_url) });
            const body = json(v.layout, 'Bố cục');
            await api.saveLayout(token, layout.id, { points: body.points ?? [], edges: body.edges ?? [] });
            setLayout(null); list.reload();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa bản đồ “${remove?.title ?? ''}”?`} message="Tiến độ hành quân của học sinh trên bản đồ này cũng bị xóa. Nên gỡ về Nháp thay vì xóa." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteMap(token, remove.id).then(() => true), 'Đã xóa bản đồ')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- hội thoại cốt truyện
const LINES_TEMPLATE = [
  { speaker: 'Trần Hưng Đạo', text: 'Lời thoại của nhân vật, đối chiếu với tư liệu nguồn.', choices: [{ text: 'Em đồng ý', reply: 'Lời đáp lại, có thể kèm bài học lịch sử.' }] },
  { speaker: 'Người dẫn truyện', text: 'Câu kết của đoạn hội thoại.' },
];

const DialogsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const list = useLoad(() => api.adminDialogs(token), [token], session.expired);
  const points = useLoad(async () => {
    const maps = await api.adminMaps(token);
    const full = await Promise.all(maps.map((m) => api.adminMap(token, m.id)));
    return full.flatMap((m) => (m.points as Row[]).filter((p) => p.kind === 'story').map((p) => ({ value: String(p.id), label: `${m.title} – ${p.name}` })));
  }, [token], session.expired);
  const { run, busy } = useAction(session.expired);
  const [form, setForm] = useState<{ row?: Row } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const edit = async (row: Row) => { const full = await run(() => api.adminDialog(token, row.id)); if (full) setForm({ row: full }); };
  const toggle = async (row: Row) => {
    if (await run(() => api.dialogStatus(token, row.id, row.status === 'published' ? 'draft' : 'published'), row.status === 'published' ? 'Đã gỡ hội thoại về Nháp' : 'Đã phát hành hội thoại')) list.reload();
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Hội thoại gắn với điểm “cốt truyện” trên bản đồ. Chỉ phát hành được khi đã gắn ít nhất một tư liệu nguồn đã công bố để kiểm chứng lời thoại; sửa hội thoại đã phát hành sẽ đưa nó về Nháp.</Txt>
        <Btn icon={Plus} title="Thêm hội thoại" tone="son" onPress={() => setForm({})} testID="dialog-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có hội thoại nào" actionsWidth={230}
        columns={[
          { key: 'title', label: 'Hội thoại', flex: 2, render: (r) => <Cell main={r.title} sub={r.point_name ? `Điểm: ${r.point_name}` : 'Chưa gắn điểm'} /> },
          { key: 'lines', label: 'Câu', render: (r) => <Txt size={13}>{r.lines}</Txt> },
          { key: 'sources', label: 'Tư liệu nguồn', render: (r) => <StatusChip kind={r.sources ? 'on' : 'off'} text={r.sources ? `${r.sources} tư liệu` : 'Chưa có nguồn'} /> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={STATUS[r.status]?.[0] ?? 'muted'} text={STATUS[r.status]?.[1] ?? r.status} /> },
        ]}
        actions={(r) => (<>
          <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => edit(r)} />
          <Btn title={r.status === 'published' ? 'Gỡ' : 'Phát hành'} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r)} />
          <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {form ? (
        <FormSheet wide title={form.row ? 'Sửa hội thoại' : 'Thêm hội thoại'} onClose={() => setForm(null)}
          initial={form.row ? { title: form.row.title, point_id: form.row.point_id ? String(form.row.point_id) : '', source_ids: (form.row.source_ids as number[]).join(', '), lines: pretty(form.row.lines) } : { lines: pretty(LINES_TEMPLATE) }}
          fields={[
            { name: 'title', label: 'Tiêu đề', required: true },
            { name: 'point_id', label: 'Điểm cốt truyện trên bản đồ', type: 'select', options: [{ value: '', label: 'Chưa gắn điểm' }, ...(points.data ?? [])] },
            { name: 'source_ids', label: 'Mã tư liệu nguồn (cách nhau bằng dấu phẩy)', hint: 'Mã số tư liệu trong Kho dữ liệu lịch sử; cần ít nhất một để phát hành' },
            { name: 'lines', label: 'Lời thoại', render: (values, set) => <JsonBox label="Các câu thoại (JSON, tối đa 30 câu)" testID="dialog-lines" value={String(values.lines ?? '')} onChange={(t) => set('lines', t)} template={LINES_TEMPLATE} height={260} hint="Mỗi câu có speaker (≤60 ký tự), text (≤400 ký tự) và tùy chọn choices (tối đa 3) gồm text và reply." /> },
          ]}
          onSubmit={async (v) => {
            const ids = String(v.source_ids ?? '').split(/[,\s]+/).filter(Boolean).map(Number);
            if (ids.some((n) => !Number.isInteger(n))) throw new Error('Mã tư liệu nguồn phải là số nguyên, cách nhau bằng dấu phẩy');
            await api.saveDialog(token, form.row?.id ?? null, { title: String(v.title).trim(), point_id: v.point_id ? num(v.point_id) : null, source_ids: ids, lines: json(v.lines, 'Lời thoại') });
            setForm(null); list.reload();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa hội thoại “${remove?.title ?? ''}”?`} message="Nhật ký hành quân của học sinh vẫn giữ nội dung đã nghe." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteDialog(token, remove.id).then(() => true), 'Đã xóa hội thoại')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- màn chơi
const WAVES_TEMPLATE = [
  { label: 'Đợt 1: tiền quân', units: [{ name: 'Lính thủy địch', branch: 'thuy', level: 1, hp: 300, atk: 30, def: 8, spd: 10 }, { name: 'Lính bộ địch', branch: 'bo', level: 1, hp: 260, atk: 26, def: 10, spd: 9 }] },
  { label: 'Đợt 2: chủ lực', units: [{ name: 'Chỉ huy địch', branch: 'thuy', level: 2, hp: 700, atk: 45, def: 15, spd: 12, commander: true }] },
];
const TERRAIN_TEMPLATE = { tide: { cycle: 4 }, stakes: { pct: 0.1 }, water_bonus: { thuy: 0.15 }, hunger: { pct: 0.05, from_turn: 5 } };
const REWARDS_TEMPLATE = { gold: 100, binh_thu: 10, xp: 200, card_code: '', fragments: [{ card_code: '', qty: 2 }] };

const BalanceSheet: React.FC<{ session: Session; stage: Row; onClose: () => void }> = ({ session, stage, onClose }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [v, setV] = useState({ runs: '50', level: '5', stars: '1', answer_rate: '0.7' });
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.stageBalance>> | null>(null);
  return (
    <Sheet open onClose={onClose} title="Cân bằng chỉ số" subtitle={stage.title} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Đóng" tone="giay" onPress={onClose} /><Btn icon={Scale} title="Chạy thử" tone="son" loading={busy} onPress={async () => { const out = await run(() => api.stageBalance(session.token, stage.id, { runs: num(v.runs), level: num(v.level), stars: num(v.stars), answer_rate: num(v.answer_rate) })); if (out) setRes(out); }} testID="balance-run" /></View>}>
      <Txt size={13} color={c.muc3}>Máy tự đánh nhiều trận với đội hình mẫu (5 thẻ thường nếu không chỉ định) để xem tỉ lệ thắng. Mục tiêu gợi ý: 40–70% cho đội cấp vừa phải.</Txt>
      <View style={{ gap: 10 }}>
        <Field label="Số trận (1–200)" value={v.runs} onChangeText={(t) => setV({ ...v, runs: t })} keyboardType="numeric" />
        <Field label="Cấp thẻ (1–100)" value={v.level} onChangeText={(t) => setV({ ...v, level: t })} keyboardType="numeric" />
        <Field label="Số sao thẻ (1–5)" value={v.stars} onChangeText={(t) => setV({ ...v, stars: t })} keyboardType="numeric" />
        <Field label="Tỉ lệ trả lời đúng tuyệt kỹ (0–1)" value={v.answer_rate} onChangeText={(t) => setV({ ...v, answer_rate: t })} keyboardType="numeric" />
      </View>
      {res ? (
        <Card flat pad={12} style={{ gap: 2 }}>
          <Txt f="bold" size={16}>Tỉ lệ thắng: {Math.round(res.win_rate * 100)}% ({res.runs} trận)</Txt>
          <Txt size={14}>Trung bình {res.avg_turns} lượt · {res.avg_stars} sao · {res.avg_ally_down} tướng ngã xuống</Txt>
          <Txt size={13} color={c.muc2}>Đội hình: {res.cards.join(', ')} (cấp {res.level}, {res.stars} sao)</Txt>
        </Card>
      ) : null}
    </Sheet>
  );
};

const StagesPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const { c } = useTheme();
  const list = useLoad(() => api.adminStages(token), [token], session.expired);
  const options = useLoad(() => api.stageOptions(token), [token], session.expired);
  const commanders = useLoad(() => api.adminCommanders(token), [token], session.expired);
  const { run, busy } = useAction(session.expired);
  const [form, setForm] = useState<{ row?: Row } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [balance, setBalance] = useState<Row | null>(null);
  const [preview, setPreview] = useState<BattleView | null>(null);
  const edit = async (row: Row) => { const full = await run(() => api.adminStage(token, row.id)); if (full) setForm({ row: full }); };
  const play = async (row: Row) => { const battle = await run(() => api.previewStage(token, row.id)); if (battle) setPreview(battle); };
  const toggle = async (row: Row) => {
    if (await run(() => api.stageStatus(token, row.id, row.status === 'published' ? 'draft' : 'published'), row.status === 'published' ? 'Đã gỡ màn chơi về Nháp' : 'Đã phát hành màn chơi')) list.reload();
  };
  if (preview) return <Overlay title={`Chơi thử: ${preview.stage.title}`} onBack={() => setPreview(null)}><WarBattleScreen session={session} battleId={preview.id} initial={preview} onClose={() => setPreview(null)} onTruth={() => undefined} /></Overlay>;
  const fields = (row?: Row): FieldDef[] => [
    ...(row ? [] : [{ name: 'battle_id', label: 'Trận đánh trong kho lịch sử', type: 'select' as const, required: true, options: [{ value: '', label: 'Chọn trận đánh…' }, ...(options.data ?? []).filter((o) => !o.has_stage).map((o) => ({ value: String(o.id), label: `${o.name}${o.year ? ` (${o.year})` : ''}${o.status === 'published' ? '' : ' – hồ sơ còn Nháp'}` }))] }]),
    { name: 'title', label: 'Tên màn chơi', required: true }, { name: 'summary', label: 'Tóm tắt', type: 'textarea' }, { name: 'objective', label: 'Nhiệm vụ của người chơi' },
    { name: 'difficulty', label: 'Độ khó', type: 'select', options: [['1', 'Dễ'], ['2', 'Vừa'], ['3', 'Khó']].map(([value, label]) => ({ value, label })) },
    { name: 'max_turns', label: 'Số vòng tối đa (3–30)', type: 'number' }, { name: 'star_turns', label: 'Số vòng để đạt sao thứ ba (1–30)', type: 'number' },
    { name: 'commander_id', label: 'Chỉ huy đối phương (sổ tay)', type: 'select', options: [{ value: '', label: 'Không có' }, ...(commanders.data ?? []).map((k) => ({ value: String(k.id), label: String(k.name) }))] },
    { name: 'quiz_id', label: 'Mã bộ câu hỏi cho tuyệt kỹ', type: 'number', hint: 'Để trống thì tuyệt kỹ luôn phát huy đủ sức mạnh' },
    { name: 'background_url', label: 'Ảnh nền (https, cần ghi nguồn ở kho tài nguyên)' },
    { name: 'differences', label: 'Điểm khác lịch sử thật (mỗi dòng một ý, tối đa 8)', type: 'textarea', hint: 'Hiện trong “Sự thật lịch sử” sau khi học sinh chơi' },
    { name: 'waves', label: 'Đợt quân', render: (values, set) => <JsonBox label="Các đợt quân (JSON, 1–5 đợt, mỗi đợt 1–5 đơn vị)" testID="stage-waves" value={String(values.waves ?? '')} onChange={(t) => set('waves', t)} template={WAVES_TEMPLATE} height={260} hint="Mỗi đơn vị: name, branch (bo/thuy/ky), level, hp, atk, def, spd, commander. Chỉ huy địch sẽ báo trước chiêu lớn." /> },
    { name: 'terrain', label: 'Địa hình', render: (values, set) => <JsonBox label="Địa hình (JSON, có thể để {})" value={String(values.terrain ?? '')} onChange={(t) => set('terrain', t)} template={TERRAIN_TEMPLATE} height={120} hint="tide {cycle}, stakes {pct}, water_bonus {bo/thuy/ky}, hunger {pct, from_turn}." /> },
    { name: 'rewards', label: 'Phần thưởng', render: (values, set) => <JsonBox label="Phần thưởng lần đầu thắng (JSON)" value={String(values.rewards ?? '')} onChange={(t) => set('rewards', t)} template={REWARDS_TEMPLATE} height={140} hint="gold, binh_thu, xp (0–5000), card_code, fragments [{card_code, qty}]. Mã thẻ phải tồn tại." /> },
  ];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Mỗi trận đánh trong kho lịch sử có tối đa một màn chơi. Chỉ phát hành khi hồ sơ trận đánh đã công bố; nên chạy cân bằng chỉ số trước khi công bố.</Txt>
        <Btn icon={Plus} title="Thêm màn chơi" tone="son" onPress={() => setForm({})} testID="stage-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có màn chơi nào" actionsWidth={310}
        columns={[
          { key: 'title', label: 'Màn chơi', flex: 2, render: (r) => <Cell main={r.title} sub={`${r.battle_name}${r.year ? ` (${r.year})` : ''}`} /> },
          { key: 'waves', label: 'Đợt quân', render: (r) => <Txt size={13}>{r.waves}</Txt> },
          { key: 'players', label: 'Học sinh đã chơi', render: (r) => <Txt size={13}>{r.players}</Txt> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={STATUS[r.status]?.[0] ?? 'muted'} text={STATUS[r.status]?.[1] ?? r.status} /> },
        ]}
        actions={(r) => (<>
          <Btn icon={Play} label={`Chơi thử ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => play(r)} />
          <Btn icon={Scale} label={`Cân bằng ${r.title}`} tone="giay" size="sm" onPress={() => setBalance(r)} />
          <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => edit(r)} />
          <Btn title={r.status === 'published' ? 'Gỡ' : 'Phát hành'} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r)} />
          <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {form ? (
        <FormSheet wide title={form.row ? 'Sửa màn chơi' : 'Thêm màn chơi'} subtitle={form.row ? ((form.row.problems as string[] | undefined)?.length ? `Cảnh báo: ${(form.row.problems as string[]).join('; ')}` : undefined) : undefined} fields={fields(form.row)} onClose={() => setForm(null)}
          initial={form.row
            ? { title: form.row.title, summary: form.row.summary ?? '', objective: form.row.objective ?? '', difficulty: String(form.row.difficulty), max_turns: String(form.row.max_turns), star_turns: String(form.row.star_turns), commander_id: form.row.commander_id ? String(form.row.commander_id) : '', quiz_id: form.row.quiz_id ? String(form.row.quiz_id) : '', background_url: form.row.background_url ?? '', differences: (form.row.differences as string[]).join('\n'), waves: pretty(form.row.waves), terrain: pretty(form.row.terrain ?? {}), rewards: pretty(form.row.rewards ?? {}) }
            : { difficulty: '2', max_turns: '15', star_turns: '10', waves: pretty(WAVES_TEMPLATE), terrain: '{}', rewards: pretty({ gold: 100, binh_thu: 10, xp: 200 }), differences: '' }}
          onSubmit={async (v) => {
            const body: Row = {
              title: String(v.title).trim(), summary: orNull(v.summary), objective: orNull(v.objective), difficulty: num(v.difficulty), max_turns: num(v.max_turns), star_turns: num(v.star_turns),
              commander_id: v.commander_id ? num(v.commander_id) : null, quiz_id: String(v.quiz_id ?? '').trim() ? num(v.quiz_id) : null, background_url: orNull(v.background_url),
              differences: String(v.differences ?? '').split('\n').map((s) => s.trim()).filter(Boolean), waves: json(v.waves, 'Đợt quân'), terrain: json(v.terrain, 'Địa hình'), rewards: json(v.rewards, 'Phần thưởng'),
            };
            if (!form.row) body.battle_id = num(v.battle_id);
            await api.saveStage(token, form.row?.id ?? null, body);
            setForm(null); list.reload(); options.reload();
          }} />
      ) : null}
      {balance ? <BalanceSheet session={session} stage={balance} onClose={() => setBalance(null)} /> : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa màn chơi “${remove?.title ?? ''}”?`} message="Màn đã có học sinh chơi không xóa được; hãy gỡ về Nháp thay vì xóa." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteStage(token, remove.id).then(() => true), 'Đã xóa màn chơi')) { setRemove(null); list.reload(); options.reload(); } }} />
      <Txt size={12} color={c.muc3}>Chơi thử không ghi điểm hay phần thưởng của ai; đội hình thử gồm năm thẻ tướng đầu tiên.</Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- chỉ huy đối phương và tài nguyên
const CommandersPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const list = useLoad(() => api.adminCommanders(token), [token], session.expired);
  const { run, busy } = useAction(session.expired);
  const [form, setForm] = useState<{ row?: Row } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const fields = (row?: Row): FieldDef[] => [
    ...(row ? [] : [{ name: 'code', label: 'Mã (chữ thường không dấu, số, gạch ngang)', required: true }]),
    { name: 'name', label: 'Tên chỉ huy', required: true }, { name: 'role_text', label: 'Vai trò', type: 'textarea' }, { name: 'forces', label: 'Lực lượng', type: 'textarea' },
    { name: 'tactics', label: 'Chiến thuật', type: 'textarea' }, { name: 'outcome', label: 'Kết cục trong lịch sử', type: 'textarea' },
    { name: 'source_id', label: 'Mã tư liệu nguồn', type: 'number', hint: 'Nên gắn tư liệu để kiểm chứng' },
    { name: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'draft', label: 'Nháp' }, { value: 'published', label: 'Đã phát hành' }] },
  ];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Hồ sơ chỉ huy đối phương hiện trong “Sổ tay chỉ huy” của học sinh sau khi chạm trán; chỉ để tra cứu, không dùng làm thẻ.</Txt>
        <Btn icon={Plus} title="Thêm chỉ huy" tone="son" onPress={() => setForm({})} testID="commander-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có chỉ huy nào"
        columns={[
          { key: 'name', label: 'Chỉ huy', flex: 2, render: (r) => <Cell main={r.name} sub={r.code} /> },
          { key: 'source', label: 'Nguồn', render: (r) => <StatusChip kind={r.source_id ? 'on' : 'warn'} text={r.source_id ? `Tư liệu #${r.source_id}` : 'Chưa gắn nguồn'} /> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={STATUS[r.status]?.[0] ?? 'muted'} text={STATUS[r.status]?.[1] ?? r.status} /> },
        ]}
        actions={(r) => (<>
          <Btn icon={Pencil} label={`Sửa ${r.name}`} tone="giay" size="sm" disabled={busy} onPress={() => setForm({ row: r })} />
          <Btn icon={Trash2} label={`Xóa ${r.name}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {form ? (
        <FormSheet wide title={form.row ? 'Sửa chỉ huy' : 'Thêm chỉ huy'} fields={fields(form.row)} onClose={() => setForm(null)}
          initial={form.row ? { name: form.row.name, role_text: form.row.role_text ?? '', forces: form.row.forces ?? '', tactics: form.row.tactics ?? '', outcome: form.row.outcome ?? '', source_id: form.row.source_id ? String(form.row.source_id) : '', status: form.row.status } : { status: 'draft' }}
          onSubmit={async (v) => {
            const body: Row = { name: String(v.name).trim(), role_text: orNull(v.role_text), forces: orNull(v.forces), tactics: orNull(v.tactics), outcome: orNull(v.outcome), source_id: String(v.source_id ?? '').trim() ? num(v.source_id) : null, status: v.status };
            if (form.row) await api.saveCommander(token, form.row.id, body); else await api.saveCommander(token, null, { ...body, code: String(v.code).trim() });
            setForm(null); list.reload();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa chỉ huy “${remove?.name ?? ''}”?`} message="Các màn chơi đang dùng chỉ huy này sẽ mất liên kết." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteCommander(token, remove.id).then(() => true), 'Đã xóa chỉ huy')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

const ASSET_KINDS = [['sprite', 'Nhân vật (sprite)'], ['animation', 'Hoạt ảnh'], ['effect', 'Hiệu ứng'], ['music', 'Nhạc nền'], ['sfx', 'Âm thanh'], ['background', 'Ảnh nền'], ['model3d', 'Mô hình 3D']];

const AssetsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const list = useLoad(() => api.adminAssets(token), [token], session.expired);
  const { run } = useAction(session.expired);
  const [add, setAdd] = useState(false);
  const [remove, setRemove] = useState<Row | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Kho tài nguyên của game: bắt buộc ghi nguồn và giấy phép sử dụng. Chỉ dùng tài nguyên tự vẽ hoặc có giấy phép cho phép; không dùng ảnh người thật làm chân dung tướng khi chưa có nguồn.</Txt>
        <Btn icon={Plus} title="Thêm tài nguyên" tone="son" onPress={() => setAdd(true)} testID="asset-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có tài nguyên nào"
        columns={[
          { key: 'name', label: 'Tài nguyên', flex: 2, render: (r) => <Cell main={r.name} sub={r.url} /> },
          { key: 'kind', label: 'Loại', render: (r) => <Txt size={13}>{ASSET_KINDS.find(([k]) => k === r.kind)?.[1] ?? r.kind}</Txt> },
          { key: 'source', label: 'Nguồn', render: (r) => <Txt size={13}>{r.source}</Txt> },
          { key: 'license', label: 'Giấy phép', render: (r) => <Txt size={13}>{r.license}</Txt> },
        ]}
        actions={(r) => <Btn icon={Trash2} label={`Xóa ${r.name}`} tone="giay" size="sm" onPress={() => setRemove(r)} />} />
      {add ? (
        <FormSheet title="Thêm tài nguyên" onClose={() => setAdd(false)} initial={{ kind: 'background' }}
          fields={[{ name: 'kind', label: 'Loại', type: 'select', options: opts(ASSET_KINDS) }, { name: 'name', label: 'Tên', required: true }, { name: 'url', label: 'Liên kết https', required: true }, { name: 'source', label: 'Nguồn (tác giả hoặc trang web)', required: true }, { name: 'license', label: 'Giấy phép', required: true, hint: 'Ví dụ: CC BY 4.0, CC0, tự thực hiện' }, { name: 'note', label: 'Ghi chú', type: 'textarea' }]}
          onSubmit={async (v) => { await api.addAsset(token, { kind: v.kind, name: String(v.name).trim(), url: String(v.url).trim(), source: String(v.source).trim(), license: String(v.license).trim(), note: orNull(v.note) }); setAdd(false); list.reload(); }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa tài nguyên “${remove?.name ?? ''}”?`} message="Chỉ xóa bản ghi trong kho, không xóa tệp ở nơi lưu trữ." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteAsset(token, remove.id).then(() => true), 'Đã xóa tài nguyên')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

type Section = 'cards' | 'maps' | 'dialogs' | 'stages' | 'commanders' | 'assets';
export const WarAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<Section>('cards');
  return (
    <Page>
      <PageHeader title="Game thẻ tướng" subtitle="Thẻ và chiêu thức, bản đồ hành quân, hội thoại, màn chơi, chỉ huy đối phương và tài nguyên. Nội dung lịch sử do giáo viên Lịch sử kiểm chứng trước khi phát hành." />
      <Segmented<Section> label="Mục quản trị" value={view} onChange={setView}
        options={[{ value: 'cards', label: 'Thẻ và chiêu' }, { value: 'maps', label: 'Bản đồ hành quân' }, { value: 'dialogs', label: 'Hội thoại' }, { value: 'stages', label: 'Màn chơi' }, { value: 'commanders', label: 'Chỉ huy địch' }, { value: 'assets', label: 'Tài nguyên' }]} />
      {view === 'cards' ? <CardsPanel session={session} /> : view === 'maps' ? <MapsPanel session={session} /> : view === 'dialogs' ? <DialogsPanel session={session} />
        : view === 'stages' ? <StagesPanel session={session} /> : view === 'commanders' ? <CommandersPanel session={session} /> : <AssetsPanel session={session} />}
    </Page>
  );
};

// ---------------------------------------------------------------------- cài đặt của trường (HK.QT.056)
const GRADES = [6, 7, 8, 9];

/** Quản trị viên trường bật hoặc tắt game, giới hạn khối lớp, khung giờ và số phút mỗi ngày; học sinh chịu mức chặt nhất giữa hệ thống và trường */
export const SchoolWarSettings: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const cfg = useLoad(() => api.schoolWar(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [draft, setDraft] = useState<{ enabled: boolean; grades: number[]; from: string; to: string; minutes: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (cfg.data) setDraft({ enabled: cfg.data.war_enabled, grades: cfg.data.war_grades, from: cfg.data.war_from ?? '', to: cfg.data.war_to ?? '', minutes: cfg.data.war_minutes ? String(cfg.data.war_minutes) : '' }); }, [cfg.data]);
  if (!draft) return <>{cfg.error ? <ErrorNote message={cfg.error} /> : <Spinner />}</>;
  const save = async () => {
    setError(null);
    const out = await run(() => api.saveSchoolWar(session.token, { war_enabled: draft.enabled, war_grades: draft.grades, war_from: draft.from.trim() || null, war_to: draft.to.trim() || null, war_minutes: draft.minutes.trim() ? num(draft.minutes) : null }), 'Đã lưu cài đặt game thẻ tướng');
    if (out) cfg.reload(); else setError('Chưa lưu được, hãy kiểm tra lại các giá trị.');
  };
  return (
    <Card style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={18}>Game thẻ tướng của trường</Txt>
      <Txt size={13} color={c.muc3}>Học sinh chịu mức giới hạn chặt nhất giữa cài đặt chung của hệ thống và cài đặt của trường. Giờ tính theo giờ Việt Nam.</Txt>
      <ToggleRow icon={Swords} checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="Cho phép học sinh chơi game thẻ tướng" desc="Tắt thì học sinh trường này không vào được màn chơi và trận đánh, nhưng vẫn học bình thường." />
      <View style={{ gap: 6 }}>
        <Txt f="bold" size={14} color={c.muc2}>Khối lớp được chơi (không chọn là mọi khối)</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GRADES.map((g) => <Btn key={g} title={`Khối ${g}`} tone={draft.grades.includes(g) ? 'son' : 'giay'} size="sm" onPress={() => setDraft({ ...draft, grades: draft.grades.includes(g) ? draft.grades.filter((x) => x !== g) : [...draft.grades, g].sort() })} />)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}><Field label="Chơi từ giờ (HH:MM)" value={draft.from} onChangeText={(t) => setDraft({ ...draft, from: t })} placeholder="Ví dụ 17:00" /></View>
        <View style={{ flex: 1, minWidth: 140 }}><Field label="Đến giờ (HH:MM)" value={draft.to} onChangeText={(t) => setDraft({ ...draft, to: t })} placeholder="Ví dụ 21:00" /></View>
        <View style={{ flex: 1, minWidth: 140 }}><Field label="Số phút tối đa mỗi ngày (5–600)" value={draft.minutes} onChangeText={(t) => setDraft({ ...draft, minutes: t })} keyboardType="numeric" placeholder="Để trống là không giới hạn" /></View>
      </View>
      <ErrorNote message={error} />
      <View style={{ flexDirection: 'row' }}><Btn title="Lưu cài đặt" tone="son" loading={busy} onPress={save} testID="school-war-save" /></View>
    </Card>
  );
};
