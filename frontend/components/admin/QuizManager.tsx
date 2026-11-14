/**
 * Quản lý bộ đề (HK.GV.040–044, HK.AD.045): danh sách bộ đề của tôi / trường / hệ thống, tạo (chọn câu hỏi, thứ tự, thời gian mỗi câu, điểm, xáo trộn),
 * sửa (khóa khi đang được giao hoặc đã có học sinh làm), nhân bản, xóa, làm thử như học sinh, gửi duyệt.
 * 14/11/2026: tạo đề theo ma trận chủ đề × mức độ (như MobiEdu, McMix, Công văn 7991), bảng ma trận của bộ đề và thống kê kết quả
 * (điểm trung bình, tỉ lệ đạt, phân bố điểm, câu nhiều học sinh sai) như báo cáo của Wayground, Moodle.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowUp, ChartNoAxesColumn, Copy, FileUp, Pencil, Play, Plus, Send, Shuffle, Sparkles, Table2, Trash2 } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { QuestionPicker, ScopeChip, useCampaignOptions } from '@/components/admin/ContentKit';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import { SmartExamStudio, type SmartStudioMode } from '@/components/admin/SmartExamStudio';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, Page, PageHeader, Pager, SearchFilterBar, StatusChip, useAction, useDebounced, useLoad, usePageSize, type SearchFilter } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Overlay } from '@/components/portal/LessonReader';
import { QuizPlayer } from '@/components/portal/QuizPlayer';
import { Bar, Btn, Card, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AttemptState, QuizDetail, QuizItem } from '@/types/learning';
import { LEVEL_TEXT, QTYPE_TEXT } from '@/types/learning';

interface Row { question_id: number; prompt: string; qtype_label: string; points: string; seconds: string }

const QuizForm: React.FC<{ session: Session; initial?: QuizDetail; onClose: () => void; onSaved: (q: QuizDetail) => void }> = ({ session, initial, onClose, onSaved }) => {
  const { c } = useTheme();
  const campaigns = useCampaignOptions(session);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [campaign, setCampaign] = useState(initial?.campaign_id ? String(initial.campaign_id) : '');
  const [seconds, setSeconds] = useState(String(initial?.seconds_per_question ?? 20));
  const [pass, setPass] = useState(String(initial?.pass_percent ?? 60));
  const [shuffleQ, setShuffleQ] = useState(initial?.shuffle_questions ?? false);
  const [shuffleO, setShuffleO] = useState(initial?.shuffle_options ?? false);
  const [rows, setRows] = useState<Row[]>(() => (initial?.items ?? []).map((i) => ({ question_id: i.question_id, prompt: i.prompt, qtype_label: i.qtype_label, points: String(i.points), seconds: i.seconds ? String(i.seconds) : '' })));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        title, description: description.trim() || null, campaign_id: campaign ? Number(campaign) : null, seconds_per_question: Number(seconds), pass_percent: Number(pass),
        shuffle_questions: shuffleQ, shuffle_options: shuffleO,
        items: rows.map((r) => ({ question_id: r.question_id, points: Number(r.points) || 100, seconds: r.seconds ? Number(r.seconds) : null })),
      };
      onSaved(initial ? await api.updateQuiz(session.token, initial.id, body) : await api.createQuiz(session.token, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được bộ đề.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={initial ? 'Sửa bộ đề' : 'Tạo bộ đề'} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Lưu bộ đề" tone="son" onPress={submit} loading={busy} testID="quiz-save" /></View>}>
      <ErrorNote message={error} />
      <Field label="Tên bộ đề *" value={title} onChangeText={setTitle} nativeID="quiz-title" />
      <Field label="Mô tả" value={description} onChangeText={setDescription} multiline numberOfLines={2} inputStyle={{ minHeight: 60, textAlignVertical: 'top' }} />
      <FilterBar>
        <FilterBox flex={2}><AdminSelect label="Chủ đề" value={campaign} options={campaigns} onChange={setCampaign} /></FilterBox>
        <FilterBox><Field label="Giây mỗi câu (5–300)" value={seconds} onChangeText={setSeconds} keyboardType="numeric" /></FilterBox>
        <FilterBox><Field label="Điểm đạt (%)" value={pass} onChangeText={setPass} keyboardType="numeric" /></FilterBox>
      </FilterBar>
      <FilterBar>
        <FilterBox><AdminSelect label="Xáo trộn thứ tự câu hỏi" value={shuffleQ ? 'yes' : 'no'} options={[{ value: 'no', label: 'Giữ nguyên thứ tự' }, { value: 'yes', label: 'Xáo trộn mỗi lượt' }]} onChange={(v) => setShuffleQ(v === 'yes')} /></FilterBox>
        <FilterBox><AdminSelect label="Xáo trộn đáp án" value={shuffleO ? 'yes' : 'no'} options={[{ value: 'no', label: 'Giữ nguyên thứ tự' }, { value: 'yes', label: 'Xáo trộn mỗi lượt' }]} onChange={(v) => setShuffleO(v === 'yes')} /></FilterBox>
      </FilterBar>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={15}>Các câu hỏi ({rows.length})</Txt>
          <Btn icon={Plus} title="Thêm câu hỏi" tone="son" size="sm" onPress={() => setPicking(true)} testID="quiz-add-questions" />
        </View>
        {rows.length === 0 ? <Txt size={13} color={c.muc3}>Chưa có câu hỏi nào. Bấm “Thêm câu hỏi” để chọn từ ngân hàng.</Txt> : null}
        {rows.map((r, i) => (
          <Card key={r.question_id} flat pad={12} style={{ gap: 8 }}>
            <Txt size={13} color={c.muc3}>Câu {i + 1} · {r.qtype_label}</Txt>
            <Txt f="semibold" size={14}>{r.prompt}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <View style={{ width: 110 }}><Field label="Điểm (10–1000)" value={r.points} onChangeText={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, points: v } : y)))} keyboardType="numeric" /></View>
              <View style={{ width: 130 }}><Field label="Giây riêng" value={r.seconds} placeholder={`mặc định ${seconds}`} onChangeText={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, seconds: v } : y)))} keyboardType="numeric" /></View>
              <Btn icon={ArrowUp} label="Đưa lên" tone="giay" size="sm" disabled={i === 0} onPress={() => move(i, -1)} />
              <Btn icon={ArrowDown} label="Đưa xuống" tone="giay" size="sm" disabled={i === rows.length - 1} onPress={() => move(i, 1)} />
              <Btn icon={Trash2} label={`Gỡ câu ${i + 1}`} tone="giay" size="sm" onPress={() => setRows((x) => x.filter((_, j) => j !== i))} />
            </View>
          </Card>
        ))}
      </View>
      {picking ? <QuestionPicker session={session} title="Chọn câu hỏi cho bộ đề" exclude={rows.map((r) => r.question_id)} onClose={() => setPicking(false)}
        onPick={(items) => { setRows((x) => [...x, ...items.map((q) => ({ question_id: q.id, prompt: q.prompt, qtype_label: q.qtype_label, points: '100', seconds: '' }))]); setPicking(false); }} /> : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- ma trận đề (14/11/2026)
const LEVELS = [1, 2, 3] as const;
const pct = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

/**
 * Tạo đề theo ma trận như MobiEdu, McMix: mỗi chủ đề (cuộc kháng chiến) ghi số câu cho từng mức độ Biết / Hiểu / Vận dụng (Công văn 7991),
 * hệ thống lấy ngẫu nhiên đủ số câu từ ngân hàng và xếp từ dễ đến khó. Mỗi ô hiện số câu đang có để không ghi quá.
 */
const MatrixSheet: React.FC<{ session: Session; onClose: () => void; onCreated: (id: number) => void }> = ({ session, onClose, onCreated }) => {
  const { c } = useTheme();
  const role = session.user.role;
  const [store, setStore] = useState('all');
  const stock = useLoad(() => api.quizMatrixStock(session.token, store), [session.token, store], session.expired);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [seconds, setSeconds] = useState('30');
  const [pass, setPass] = useState('50');
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleO, setShuffleO] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = (campaign: number | null, level: number) => `${campaign ?? 'none'}:${level}`;
  const value = (campaign: number | null, level: number) => Number(counts[key(campaign, level)] || 0) || 0;
  const topics = stock.data?.topics ?? [];
  const byLevel = LEVELS.map((l) => topics.reduce((n, t) => n + value(t.campaign_id, l), 0));
  const total = byLevel.reduce((a, b) => a + b, 0);
  const over = topics.flatMap((t) => LEVELS.filter((l) => value(t.campaign_id, l) > (t.levels[l] ?? 0)).map((l) => `${t.title} – ${LEVEL_TEXT[l]}`));
  const storeOptions = role === 'root_admin' ? [{ value: 'all', label: 'Kho hệ thống' }]
    : [{ value: 'all', label: 'Tất cả kho được dùng' }, ...(role === 'teacher' ? [{ value: 'mine', label: 'Của tôi' }] : []), { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }];
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const cells = topics.flatMap((t) => LEVELS.map((l) => ({ campaign_id: t.campaign_id, level: l, count: value(t.campaign_id, l) }))).filter((x) => x.count > 0);
      const quiz = await api.createQuizFromMatrix(session.token, { title, store, cells, seconds_per_question: Number(seconds), pass_percent: Number(pass), shuffle_questions: shuffleQ, shuffle_options: shuffleO });
      onCreated(quiz.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa tạo được bộ đề.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Tạo đề theo ma trận" subtitle="Ghi số câu cho từng chủ đề × mức độ; hệ thống lấy ngẫu nhiên từ ngân hàng câu hỏi và xếp từ Biết đến Vận dụng." wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={`Tạo bộ đề (${total} câu)`} tone="son" onPress={submit} loading={busy} disabled={!total || !title.trim() || over.length > 0} testID="matrix-create" /></View>}>
      <ErrorNote message={error ?? stock.error} />
      <Field label="Tên bộ đề *" value={title} onChangeText={setTitle} placeholder="Ví dụ: Kiểm tra giữa kì I – Lịch sử 7" nativeID="matrix-title" />
      <FilterBar>
        <FilterBox flex={2}><AdminSelect label="Lấy câu hỏi từ" value={store} options={storeOptions} onChange={setStore} testID="matrix-store" /></FilterBox>
        <FilterBox><Field label="Giây mỗi câu (5–300)" value={seconds} onChangeText={setSeconds} keyboardType="numeric" /></FilterBox>
        <FilterBox><Field label="Điểm đạt (%)" value={pass} onChangeText={setPass} keyboardType="numeric" /></FilterBox>
      </FilterBar>
      <FilterBar>
        <FilterBox><AdminSelect label="Xáo trộn thứ tự câu hỏi" value={shuffleQ ? 'yes' : 'no'} options={[{ value: 'yes', label: 'Xáo trộn mỗi lượt' }, { value: 'no', label: 'Giữ thứ tự Biết → Vận dụng' }]} onChange={(v) => setShuffleQ(v === 'yes')} /></FilterBox>
        <FilterBox><AdminSelect label="Xáo trộn đáp án" value={shuffleO ? 'yes' : 'no'} options={[{ value: 'yes', label: 'Xáo trộn mỗi lượt' }, { value: 'no', label: 'Giữ nguyên thứ tự' }]} onChange={(v) => setShuffleO(v === 'yes')} /></FilterBox>
      </FilterBar>
      {stock.loading && !stock.data ? <Spinner label="Đang đếm câu hỏi trong ngân hàng…" /> : null}
      {stock.data && !topics.length ? <Inset><Txt size={14}>Kho đã chọn chưa có câu hỏi nào. Hãy thêm câu hỏi ở Ngân hàng câu hỏi (ghi mức độ Biết / Hiểu / Vận dụng) rồi quay lại.</Txt></Inset> : null}
      {topics.length ? (
        <View style={{ gap: 8 }} testID="matrix-grid">
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            <Txt f="bold" size={13} color={c.muc2} style={{ flex: 2 }}>Chủ đề</Txt>
            {LEVELS.map((l) => <Txt key={l} f="bold" size={13} color={c.muc2} style={{ flex: 1 }}>{LEVEL_TEXT[l]}</Txt>)}
          </View>
          {topics.map((t) => (
            <Card key={String(t.campaign_id)} flat pad={10} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <View style={{ flex: 2, minWidth: 140 }}><Txt f="semibold" size={14}>{t.title}</Txt><Txt size={12} color={c.muc3}>{t.total} câu trong kho</Txt></View>
              {LEVELS.map((l) => {
                const have = t.levels[l] ?? 0, n = value(t.campaign_id, l);
                return (
                  <View key={l} style={{ flex: 1, minWidth: 84 }}>
                    <Field label={`${LEVEL_TEXT[l]} (có ${have})`} value={counts[key(t.campaign_id, l)] ?? ''} placeholder="0" keyboardType="numeric" editable={have > 0}
                      onChangeText={(v) => setCounts((x) => ({ ...x, [key(t.campaign_id, l)]: v.replace(/[^0-9]/g, '') }))} error={n > have ? `Chỉ có ${have}` : null} nativeID={`matrix-${t.campaign_id ?? 'none'}-${l}`} />
                  </View>
                );
              })}
            </Card>
          ))}
          <Inset style={{ gap: 4 }}>
            <Txt f="bold" size={14}>Tổng {total} câu{total > 50 ? ' (tối đa 50)' : ''}: {LEVELS.map((l, i) => `${LEVEL_TEXT[l]} ${byLevel[i]} (${pct(byLevel[i], total)}%)`).join(' · ')}</Txt>
            <Txt size={13} color={c.muc3}>Gợi ý theo Công văn 7991/BGDĐT-GDTrH: khoảng 70% Biết + Hiểu và 30% Vận dụng. Ma trận hiện tại: Biết + Hiểu {pct(byLevel[0] + byLevel[1], total)}%, Vận dụng {pct(byLevel[2], total)}%.</Txt>
            {over.length ? <Txt size={13} color={c.sonChu}>Vượt số câu có sẵn: {over.join(', ')}.</Txt> : null}
          </Inset>
        </View>
      ) : null}
    </Sheet>
  );
};

/** Bảng ma trận của một bộ đề: số câu theo chủ đề × mức độ và tỉ lệ từng mức độ (giống bản ma trận nộp kèm đề kiểm tra) */
const QuizMatrixTable: React.FC<{ items: QuizDetail['items'] }> = ({ items }) => {
  const { c } = useTheme();
  const topics = [...new Map(items.map((i) => [String(i.campaign_id), i.campaign_title ?? 'Chưa gắn chủ đề'])).entries()];
  const count = (topic: string, level: number) => items.filter((i) => String(i.campaign_id) === topic && i.cognitive_level === level).length;
  return (
    <Card flat pad={12} style={{ gap: 6 }} testID="quiz-matrix">
      <Txt f="bold" size={13} color={c.muc2}>Ma trận đề</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Txt f="bold" size={12} color={c.muc3} style={{ flex: 2 }}>Chủ đề</Txt>
        {LEVELS.map((l) => <Txt key={l} f="bold" size={12} color={c.muc3} style={{ flex: 1 }}>{LEVEL_TEXT[l]}</Txt>)}
        <Txt f="bold" size={12} color={c.muc3} style={{ flex: 0.7 }}>Tổng</Txt>
      </View>
      {topics.map(([id, name]) => (
        <View key={id} style={{ flexDirection: 'row', gap: 8 }}>
          <Txt size={13} style={{ flex: 2 }} numberOfLines={2}>{name}</Txt>
          {LEVELS.map((l) => <Txt key={l} size={13} style={{ flex: 1 }}>{count(id, l) || '–'}</Txt>)}
          <Txt f="bold" size={13} style={{ flex: 0.7 }}>{LEVELS.reduce((n, l) => n + count(id, l), 0)}</Txt>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 6 }}>
        <Txt f="bold" size={13} style={{ flex: 2 }}>Tỉ lệ</Txt>
        {LEVELS.map((l) => <Txt key={l} f="bold" size={13} style={{ flex: 1 }}>{pct(items.filter((i) => i.cognitive_level === l).length, items.length)}%</Txt>)}
        <Txt f="bold" size={13} style={{ flex: 0.7 }}>{items.length}</Txt>
      </View>
    </Card>
  );
};

/** Thống kê bộ đề từ bài làm thật (như báo cáo của Wayground, Moodle): điểm trung bình, tỉ lệ đạt, phân bố điểm, câu nhiều học sinh sai */
const QuizStatsPanel: React.FC<{ session: Session; id: number }> = ({ session, id }) => {
  const { c } = useTheme();
  const stats = useLoad(() => api.quizStats(session.token, id), [session.token, id], session.expired);
  const s = stats.data;
  if (!s) return stats.error ? <ErrorNote message={stats.error} /> : <Spinner label="Đang tổng hợp kết quả…" />;
  if (!s.attempts) return <Inset><Txt size={14}>Chưa có học sinh làm bộ đề này (lượt làm thử của giáo viên không tính).</Txt></Inset>;
  const top = Math.max(1, ...s.distribution.map((d) => d.count));
  const hardest = [...s.questions].filter((q) => q.answered).sort((a, b) => (a.correct_rate ?? 0) - (b.correct_rate ?? 0));
  const tile = (label: string, value: string) => <Card flat pad={10} style={{ flexGrow: 1, flexBasis: 120, gap: 2 }}><Txt size={12} color={c.muc3}>{label}</Txt><Txt f="bold" size={18}>{value}</Txt></Card>;
  return (
    <View style={{ gap: 10 }} testID="quiz-stats">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tile('Lượt làm', String(s.attempts))}
        {tile('Học sinh', String(s.students))}
        {tile('Điểm trung bình', s.avg_percent === null ? '—' : `${(s.avg_percent / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/10`)}
        {tile('Tỉ lệ đạt', s.pass_rate === null ? '—' : `${s.pass_rate}%`)}
        {s.avg_seconds !== null ? tile('Thời gian trung bình', `${Math.round(s.avg_seconds / 60 * 10) / 10} phút`) : null}
      </View>
      <Card flat pad={12} style={{ gap: 6 }}>
        <Txt f="bold" size={13} color={c.muc2}>Phân bố điểm (thang 10)</Txt>
        {s.distribution.map((d) => (
          <View key={d.key} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row' }}><Txt size={13} style={{ flex: 1 }}>{d.label}</Txt><Txt size={13} color={c.muc2}>{d.count} lượt</Txt></View>
            <Bar value={d.count} max={top} height={6} label={`${d.label}: ${d.count} lượt`} />
          </View>
        ))}
      </Card>
      <Card flat pad={12} style={{ gap: 6 }}>
        <Txt f="bold" size={13} color={c.muc2}>Tỉ lệ đúng từng câu (câu nhiều học sinh sai nhất ở trên)</Txt>
        {hardest.map((q) => (
          <View key={q.question_id} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Txt size={13} style={{ flex: 1 }} numberOfLines={2}>Câu {q.position}. {q.prompt}</Txt>
              <Txt f="bold" size={13} color={(q.correct_rate ?? 0) < 40 ? c.sonChu : (q.correct_rate ?? 0) >= 85 ? c.ngocChu : c.muc}>{q.correct_rate ?? 0}%</Txt>
            </View>
            <Txt size={12} color={c.muc3}>{q.level_label} · {q.qtype_label} · {q.answered} lượt{q.avg_seconds !== null ? ` · ${q.avg_seconds} giây` : ''}</Txt>
            <Bar value={q.correct_rate ?? 0} max={100} height={6} fill={(q.correct_rate ?? 0) < 40 ? c.son : c.ngoc} label={`Câu ${q.position}: ${q.correct_rate ?? 0}% đúng`} />
          </View>
        ))}
      </Card>
    </View>
  );
};

const QuizDetailSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void; onPreview: (a: AttemptState, title: string) => void; onStudio?: (quizId: number) => void }> = ({ session, id, onClose, onChanged, onPreview, onStudio }) => {
  const { c } = useTheme();
  const role = session.user.role;
  const detail = useLoad(() => api.getQuiz(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const d = detail.data;
  const shareTarget = role === 'teacher' && d?.scope === 'teacher' ? 'school' : role === 'school_admin' && d?.scope === 'school' ? 'system' : null;
  const shared = d?.shares.find((x) => x.target === shareTarget);
  const total = d ? d.items.reduce((n, i) => n + (i.seconds ?? d.seconds_per_question), 0) : 0;
  return (
    <Sheet open onClose={onClose} title={d?.title ?? 'Bộ đề'} subtitle={d ? `${d.items.length} câu · ${Math.ceil(total / 60)} phút · đạt từ ${d.pass_percent}%` : undefined} wide>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ScopeChip scope={d.scope} />
            {d.locked ? <StatusChip kind="warn" text="Đang khóa chỉnh sửa" /> : null}
            {d.shuffle_questions ? <StatusChip kind="muted" text="Xáo trộn câu hỏi" /> : null}
            {d.shuffle_options ? <StatusChip kind="muted" text="Xáo trộn đáp án" /> : null}
            {d.shares.map((x) => <StatusChip key={x.target} kind={x.status === 'approved' ? 'on' : x.status === 'pending' ? 'warn' : 'off'} text={`${x.target === 'school' ? 'Gửi trường' : 'Gửi hệ thống'}: ${x.status === 'approved' ? 'đã duyệt' : x.status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}`} />)}
          </View>
          {d.description ? <Txt size={14}>{d.description}</Txt> : null}
          {d.lock_reason ? <Inset style={{ backgroundColor: c.vangNhat }}><Txt size={13} color={c.vangChu}>{d.lock_reason}</Txt></Inset> : null}
          {shared?.review_note ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={13} color={c.sonChu}>Lý do từ chối: {shared.review_note}</Txt></Inset> : null}
          <View style={{ gap: 6 }}>
            {d.items.map((i) => <Txt key={i.question_id} size={14}>{i.position}. {i.prompt} <Txt size={12} color={c.muc3}>({QTYPE_TEXT[i.qtype]}, {i.level_label ?? LEVEL_TEXT[i.cognitive_level]}, {i.points} điểm, {i.seconds ?? d.seconds_per_question}s)</Txt></Txt>)}
          </View>
          {d.items.length ? <QuizMatrixTable items={d.items} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn icon={Play} title="Làm thử như học sinh" tone="ngoc" size="sm" loading={busy} onPress={async () => { const a = await run(() => api.previewQuiz(session.token, d.id)); if (a) { onPreview(a, d.title); onClose(); } }} testID="quiz-preview" />
            <Btn icon={ChartNoAxesColumn} title={showStats ? 'Ẩn thống kê' : 'Thống kê kết quả'} tone="giay" size="sm" onPress={() => setShowStats((x) => !x)} testID="quiz-stats-toggle" />
            {d.can_edit ? <Btn icon={Pencil} title="Sửa" tone="son" size="sm" disabled={d.locked} onPress={() => setEditing(true)} testID="quiz-edit" /> : null}
            {d.can_edit && onStudio ? <Btn icon={Sparkles} title="Sửa trong trình soạn Quiz" tone="ngoc" size="sm" disabled={d.locked} onPress={() => { onClose(); onStudio(d.id); }} testID="quiz-edit-studio" /> : null}
            {role === 'teacher' || role === 'school_admin' || role === 'root_admin' ? <Btn icon={Copy} title="Nhân bản" tone="giay" size="sm" loading={busy} onPress={async () => { if (await run(() => api.duplicateQuiz(session.token, d.id), 'Đã nhân bản bộ đề')) { onChanged(); onClose(); } }} /> : null}
            {shareTarget ? <Btn icon={Send} title={shareTarget === 'school' ? 'Gửi vào kho của trường' : 'Đề xuất lên kho hệ thống'} tone="giay" size="sm" loading={busy} disabled={shared?.status === 'pending'}
              onPress={async () => { if (await run(() => api.requestShare(session.token, 'quiz', d.id, shareTarget), 'Đã gửi đi duyệt')) detail.reload(); }} /> : null}
            {d.can_edit ? <Btn icon={Trash2} title="Xóa" tone="giay" size="sm" onPress={() => setRemoving(true)} /> : null}
          </View>
          {showStats ? <QuizStatsPanel session={session} id={d.id} /> : null}
        </View>
      ) : null}
      {editing && d ? <QuizForm session={session} initial={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); detail.reload(); onChanged(); }} /> : null}
      <ConfirmSheet open={removing} title="Xóa bộ đề?" message="Chỉ xóa được bộ đề chưa nằm trong hành trình và chưa có học sinh làm. Các câu hỏi vẫn được giữ trong ngân hàng." confirmLabel="Xóa" busy={busy}
        onCancel={() => setRemoving(false)} onConfirm={async () => { if (d) { const ok = await run(async () => { await api.deleteQuiz(session.token, d.id); return true; }, 'Đã xóa bộ đề'); setRemoving(false); if (ok) { onChanged(); onClose(); } } }} />
    </Sheet>
  );
};

export const QuizManager: React.FC<{ session: Session; onStudio?: (quizId?: number) => void }> = ({ session, onStudio }) => {
  const role = session.user.role;
  const [store, setStore] = useState(role === 'school_admin' ? 'school' : 'all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [smartMode, setSmartMode] = useState<SmartStudioMode | null>(null);
  const [preview, setPreview] = useState<{ attempt: AttemptState; title: string } | null>(null);
  const term = useDebounced(q.trim(), 300);
  const list = useLoad(() => api.listQuizzes(session.token, { store, q: term, page, limit: size }), [session.token, store, term, page, size], session.expired);
  const canWrite = role === 'teacher' || role === 'school_admin' || role === 'root_admin';
  const storeOptions = role === 'root_admin' ? [{ value: 'all', label: 'Kho hệ thống và đề xuất' }, { value: 'system', label: 'Kho hệ thống' }, { value: 'school', label: 'Kho của các trường' }]
    : [{ value: 'all', label: 'Tất cả kho' }, ...(role === 'teacher' ? [{ value: 'mine', label: 'Của tôi' }] : []), { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }];
  const f_store: SearchFilter = { key: 'store', label: 'Kho', value: store === 'all' ? '' : store, options: [{ value: '', label: storeOptions[0].label }, ...storeOptions.slice(1)], onChange: (v) => { setStore(v || 'all'); setPage(1); } };
  if (smartMode !== null) {
    return (
      <Page>
        <SmartExamStudio
          session={session}
          initialMode={smartMode}
          onClose={() => setSmartMode(null)}
          onSavedQuiz={(quizId) => {
            setSmartMode(null);
            list.reload();
            setOpen(quizId);
          }}
          onOpenKahootStudio={onStudio}
        />
      </Page>
    );
  }
  return (
    <>
    <Page>
      <PageHeader title="Bộ đề" subtitle="Bộ câu hỏi dùng ở các nút trên bản đồ hành trình. Bộ đề đang được giao hoặc đã có học sinh làm thì khóa chỉnh sửa; hãy nhân bản để thay đổi."
        actions={canWrite ? <><Btn icon={FileUp} title="Tải đề từ Word/PDF" tone="thuy" size="sm" onPress={() => setSmartMode('upload')} testID="quiz-word-import" /><Btn icon={Shuffle} title="Trộn đề thi" tone="thuy" size="sm" onPress={() => setSmartMode('mix')} testID="quiz-mix" /><Btn icon={Table2} title="Tạo đề theo ma trận" tone="thuy" size="sm" onPress={() => setMatrix(true)} testID="quiz-matrix-open" />{onStudio ? <Btn icon={Sparkles} title="Soạn Quiz kiểu Kahoot" tone="ngoc" size="sm" onPress={() => onStudio()} testID="quiz-studio" /> : null}<Btn icon={Plus} title="Tạo bộ đề" tone="son" size="sm" onPress={() => setCreating(true)} testID="quiz-create" /></> : undefined} />
      <SearchFilterBar placeholder="Tìm bộ đề" value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="quiz-search" filters={[f_store]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <DataTable<QuizItem> paginate={false} rows={list.data.items} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty="Chưa có bộ đề nào"
            columns={[
              { key: 'title', label: 'Bộ đề', flex: 3, render: (r) => <Cell main={r.title} sub={r.campaign_title ?? 'Chưa gắn chủ đề'} /> },
              { key: 'scope', filter: f_store, label: 'Kho', flex: 1.2, render: (r) => <ScopeChip scope={r.scope} /> },
              { key: 'n', label: 'Số câu', flex: 0.7, render: (r) => <Txt size={13}>{r.question_count}</Txt> },
              { key: 'time', label: 'Thời gian', flex: 0.9, render: (r) => <Txt size={13}>{Math.ceil(r.total_seconds / 60)} phút</Txt> },
              { key: 'used', label: 'Đã giao / làm', flex: 1, render: (r) => <Txt size={13}>{r.assigned} hành trình · {r.attempts} lượt{r.locked ? ' (khóa)' : ''}</Txt> },
              { key: 'owner', label: 'Người soạn', flex: 1.3, hideOnCard: true, render: (r) => <Cell main={r.owner_name ?? '—'} sub={dateText(r.updated_at)} /> },
            ]} />
          <Pager page={page} limit={size} total={list.data.total} onPage={setPage} />
        </>
      ) : null}
            {aiModal ? <AiQuizModal open={aiModal} onClose={() => { setAiModal(false); list.reload(); }} session={session} /> : null}
      {open !== null ? <QuizDetailSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={list.reload} onPreview={(attempt, title) => setPreview({ attempt, title })} onStudio={onStudio} /> : null}
      {creating ? <QuizForm session={session} onClose={() => setCreating(false)} onSaved={(d) => { setCreating(false); list.reload(); setOpen(d.id); }} /> : null}
      {matrix ? <MatrixSheet session={session} onClose={() => setMatrix(false)} onCreated={(id) => { setMatrix(false); list.reload(); setOpen(id); }} /> : null}
    </Page>
    {preview ? <Overlay title={`Làm thử: ${preview.title}`} onBack={() => setPreview(null)}><QuizPlayer session={session} initial={preview.attempt} title={preview.title} onClose={() => setPreview(null)} /></Overlay> : null}
    </>
  );
};
