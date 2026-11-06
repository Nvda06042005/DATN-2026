/**
 * Thành phần dùng chung cho soạn nội dung học tập (câu hỏi, bộ đề, bài học, hành trình): danh sách cuộc kháng chiến, chọn mục lịch sử để gắn liên kết,
 * hộp chọn nhiều câu hỏi, nhãn kho. Dùng trong trang giáo viên và các cổng quản trị (giao diện phẳng AdminUiContext).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, Pager, StatusChip, useDebounced, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Field, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryLink, QuestionItem, Scope } from '@/types/learning';
import { QTYPE_TEXT, SCOPE_TEXT } from '@/types/learning';

export const useCampaignOptions = (session: Session) => {
  const campaigns = useLoad(async () => (await api.historyOptions(session.token, 'campaign')).map((o) => ({ value: String(o.id), label: o.label })), [session.token], session.expired);
  return useMemo(() => [{ value: '', label: 'Chưa gắn cuộc kháng chiến' }, ...(campaigns.data ?? [])], [campaigns.data]);
};

export const ScopeChip: React.FC<{ scope: Scope }> = ({ scope }) => <StatusChip kind={scope === 'system' ? 'info' : scope === 'school' ? 'warn' : 'muted'} text={SCOPE_TEXT[scope]} />;
export const DIFFICULTY_TEXT = ['', 'Dễ', 'Vừa', 'Khó'];

const LINK_TYPES: Array<{ value: string; label: string }> = [
  { value: 'campaign', label: 'Cuộc kháng chiến' }, { value: 'figure', label: 'Nhân vật' }, { value: 'event', label: 'Sự kiện' },
  { value: 'place', label: 'Địa điểm' }, { value: 'battle', label: 'Trận đánh' }, { value: 'source', label: 'Tư liệu' },
];

/** Gắn nội dung với mục trong kho lịch sử (HK.GV.037, HK.AD.044): chọn loại, tìm theo tên, thêm; mỗi nội dung tối đa 12 mục */
export const LinksEditor: React.FC<{ session: Session; value: HistoryLink[]; onChange: (links: HistoryLink[]) => void; allowTerm?: boolean }> = ({ session, value, onChange, allowTerm }) => {
  const { c } = useTheme();
  const [type, setType] = useState('figure');
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const found = useLoad(() => api.historyOptions(session.token, type, { q: term }), [session.token, type, term], session.expired);
  const types = allowTerm ? [...LINK_TYPES, { value: 'term', label: 'Thuật ngữ' }] : LINK_TYPES;
  const add = (id: number, label: string) => {
    if (value.some((l) => l.ref_type === type && l.ref_id === id) || value.length >= 12) return;
    onChange([...value, { ref_type: type, ref_id: id, label }]);
  };
  return (
    <View style={{ gap: 10 }}>
      <Txt f="bold" size={14} color={c.muc2}>Gắn với dữ liệu lịch sử</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {value.length === 0 ? <Txt size={13} color={c.muc3}>Chưa gắn mục nào.</Txt> : null}
        {value.map((l) => (
          <Pressable key={`${l.ref_type}${l.ref_id}`} accessibilityRole="button" accessibilityLabel={`Bỏ liên kết ${l.label ?? l.ref_id}`} onPress={() => onChange(value.filter((x) => x !== l))}
            style={{ minHeight: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 5, backgroundColor: c.thuyNhat }}>
            <Txt size={13} color={c.thuyChu}>{types.find((t) => t.value === l.ref_type)?.label}: {l.label ?? `#${l.ref_id}`}</Txt><X size={14} color={c.thuyChu} />
          </Pressable>
        ))}
      </View>
      <FilterBar>
        <FilterBox><AdminSelect label="Loại" value={type} options={types} onChange={setType} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm theo tên" value={q} onChangeText={setQ} placeholder="Gõ để lọc" /></FilterBox>
      </FilterBar>
      {found.loading ? <Spinner /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(found.data ?? []).slice(0, 12).map((o) => <Btn key={o.id} icon={Plus} title={o.label} tone="giay" size="sm" onPress={() => add(o.id, o.label)} />)}
        {found.data && found.data.length === 0 ? <Txt size={13} color={c.muc3}>Không có mục phù hợp (giáo viên chỉ chọn được mục đã công bố).</Txt> : null}
      </View>
    </View>
  );
};

/** Hộp chọn câu hỏi từ ngân hàng để đưa vào bộ đề hoặc làm câu kiểm tra nhanh */
export const QuestionPicker: React.FC<{ session: Session; title: string; exclude: number[]; scopeFilter?: 'system'; multi?: boolean; onPick: (items: QuestionItem[]) => void; onClose: () => void }> = ({ session, title, exclude, scopeFilter, multi = true, onPick, onClose }) => {
  const [store, setStore] = useState<string>(scopeFilter ?? 'all');
  const [q, setQ] = useState('');
  const [qtype, setQtype] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<QuestionItem[]>([]);
  const term = useDebounced(q.trim(), 300);
  const list = useLoad(() => api.listQuestions(session.token, { store, q: term, qtype, page, limit: 10 }), [session.token, store, term, qtype, page], session.expired);
  const has = (id: number) => picked.some((p) => p.id === id);
  return (
    <Sheet open onClose={onClose} title={title} subtitle={`Đã chọn ${picked.length} câu`} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn title={`Thêm ${picked.length} câu`} tone="son" disabled={!picked.length} onPress={() => onPick(picked)} testID="picker-add" /></View>}>
      <FilterBar>
        {scopeFilter ? null : <FilterBox><AdminSelect label="Kho" value={store} options={[{ value: 'all', label: 'Tất cả kho' }, { value: 'mine', label: 'Của tôi' }, { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }]} onChange={(v) => { setStore(v); setPage(1); }} /></FilterBox>}
        <FilterBox><AdminSelect label="Dạng" value={qtype} options={[{ value: '', label: 'Mọi dạng' }, ...Object.entries(QTYPE_TEXT).map(([value, label]) => ({ value, label }))]} onChange={(v) => { setQtype(v); setPage(1); }} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm câu hỏi" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable<QuestionItem> paginate={false} rows={(list.data?.items ?? []).filter((x) => !exclude.includes(x.id))} rowKey={(r) => r.id} empty="Không có câu hỏi phù hợp"
        onRowPress={(r) => setPicked(multi ? (has(r.id) ? picked.filter((p) => p.id !== r.id) : [...picked, r]) : [r])}
        columns={[
          { key: 'pick', label: '', flex: 0.3, render: (r) => <StatusChip kind={has(r.id) ? 'on' : 'muted'} text={has(r.id) ? 'Đã chọn' : 'Chọn'} /> },
          { key: 'prompt', label: 'Câu hỏi', flex: 3, render: (r) => <Cell main={r.prompt} sub={`${r.qtype_label} · ${DIFFICULTY_TEXT[r.difficulty]}${r.campaign_title ? ` · ${r.campaign_title}` : ''}`} /> },
          { key: 'scope', label: 'Kho', render: (r) => <ScopeChip scope={r.scope} /> },
        ]} />
      {list.data ? <Pager page={page} limit={10} total={list.data.total} onPage={setPage} /> : null}
    </Sheet>
  );
};
