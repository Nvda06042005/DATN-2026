/**
 * Quản trị AI Tutor (Sprint 9, HK.AD.055–062, 064): nguồn tri thức và chỉ mục (chọn loại nội dung, tải PDF / DOCX / TXT, xem trạng thái, lập lại chỉ mục), mô hình và khóa API,
 * prompt hệ thống – phạm vi trả lời – từ cấm, thử câu hỏi (xem các đoạn tư liệu được truy xuất), nhật ký hội thoại ẩn danh, xử lý báo cáo sai, gắn nhãn đúng / sai để xây bộ đánh giá,
 * hạn mức sử dụng theo trường. Khóa API chỉ gửi lên một chiều: máy chủ lưu mã hóa và không bao giờ trả lại.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Database, FileUp, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import * as api from '@/api/aiApi';
import { Cell, DataTable, DownloadButton, ErrorNote, FormSheet, Page, PageHeader, pickFile, StatusChip, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { REFUSAL_TEXT, type AiReport, type AiSettingsView, type LogItem, type Playground, type SyncResult, type TestResult } from '@/types/ai';

type Part = 'sources' | 'model' | 'prompt' | 'play' | 'logs' | 'reports' | 'limits';
const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : 'chưa lần nào');
const DOC_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

// ---------------------------------------------------------------------- nguồn và chỉ mục (HK.AD.055–056)
const Sources: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const st = useLoad(() => api.aiSources(token), [token], session.expired);
  const settings = useLoad(() => api.aiSettings(token), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [paste, setPaste] = useState(false);
  const [remove, setRemove] = useState<{ id: number; title: string } | null>(null);
  const d = st.data;
  const reindex = async (force: boolean) => { const r = await run(() => api.aiReindex(token, force)); if (r) { setResult(r); st.reload(); } };
  const toggle = async (kind: string, on: boolean) => {
    const cur = settings.data?.index_kinds ?? [];
    const next = on ? [...cur, kind] : cur.filter((k) => k !== kind);
    if (await run(() => api.aiSaveSettings(token, { index_kinds: next }), on ? 'Đã bật nguồn tri thức' : 'Đã tắt nguồn tri thức')) { settings.reload(); await reindex(false); }
  };
  const upload = async () => {
    const f = await pickFile(DOC_TYPES);
    if (!f) return;
    const r = await run(() => api.aiUploadDoc(token, f), 'Đã tải và lập chỉ mục tài liệu');
    if (r) st.reload();
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Tiểu Tướng chỉ trả lời dựa trên nội dung <Txt f="bold" size={14}>đã công bố</Txt> của kho lịch sử và bài học, cộng thêm tài liệu thầy cô tải lên. Nội dung được lập chỉ mục tự động khi công bố hoặc sửa; nút bên dưới để lập lại thủ công.</Txt>
      <ErrorNote message={st.error ?? settings.error} />
      {st.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Chip text={`${d.totals.chunks} đoạn tư liệu`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`${d.totals.embedded} đoạn có vector nhúng`} bg={d.totals.embedded ? c.ngocNhat : c.the2} fg={d.totals.embedded ? c.ngocChu : c.muc2} />
            <Txt size={13} color={c.muc3}>Lập chỉ mục lần cuối: {when(d.last_index_at)}{d.last_index_ms ? ` (${d.last_index_ms} ms)` : ''}</Txt>
          </View>
          {d.last_index_error ? <InfoNote><Txt size={13} color={c.sonChu}>Lỗi lần lập chỉ mục gần nhất: {d.last_index_error}</Txt></InfoNote> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn icon={RefreshCw} title="Lập lại chỉ mục" tone="son" loading={busy} onPress={() => reindex(false)} testID="ai-reindex" />
            <Btn title="Lập lại toàn bộ (tính lại vector)" tone="giay" size="sm" loading={busy} onPress={() => reindex(true)} />
          </View>
          {result ? <Txt size={13} color={c.ngocChu} accessibilityLiveRegion="polite">Kết quả: thêm {result.added}, cập nhật {result.updated}, gỡ {result.removed}, nhúng {result.embedded} đoạn{result.failed ? `, lỗi ${result.failed}` : ''}; tổng {result.chunks} đoạn trong {result.ms} ms.{result.error ? ` Lỗi: ${result.error}` : ''}</Txt> : null}
          <DataTable rows={d.kinds} rowKey={(r) => r.kind} empty="Chưa có nguồn"
            columns={[
              { key: 'k', label: 'Loại nội dung', flex: 2, render: (r) => <Cell main={r.label} sub={r.kind === 'doc' ? 'Tải lên ở bên dưới' : 'Chỉ nội dung đã công bố'} /> },
              { key: 'on', label: 'Dùng cho AI', render: (r) => (r.kind === 'doc' ? <StatusChip kind="info" text="Luôn bật" /> : (
                <View style={{ gap: 6, alignItems: 'flex-start' }}>
                  <StatusChip kind={r.enabled ? 'on' : 'muted'} text={r.enabled ? 'Đang bật' : 'Đã tắt'} />
                  <Btn icon={Database} title={r.enabled ? 'Tắt' : 'Bật'} label={`${r.enabled ? 'Tắt' : 'Bật'} nguồn ${r.label}`} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r.kind, !r.enabled)} />
                </View>
              )) },
              { key: 'p', label: 'Đã công bố', render: (r) => <Txt size={13}>{r.published}</Txt> },
              { key: 's', label: 'Đã lập chỉ mục', render: (r) => <Txt size={13}>{r.sources}</Txt> },
              { key: 'c', label: 'Đoạn', render: (r) => <Txt size={13}>{r.chunks}{r.embedded ? ` (${r.embedded} có vector)` : ''}</Txt> },
            ]} />
          <Txt f="bold" size={16}>Tài liệu tải lên</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn icon={FileUp} title="Tải PDF / DOCX / TXT" tone="giay" onPress={upload} loading={busy} testID="ai-doc-upload" />
            <Btn icon={Plus} title="Dán văn bản" tone="giay" onPress={() => setPaste(true)} testID="ai-doc-paste" />
          </View>
          <DataTable rows={d.docs} rowKey={(r) => r.id} empty="Chưa có tài liệu tải lên"
            columns={[
              { key: 't', label: 'Tài liệu', flex: 3, render: (r) => <Cell main={r.title} sub={`${r.file_kind.toUpperCase()} · ${r.char_count.toLocaleString('vi-VN')} ký tự · ${r.chunks} đoạn`} /> },
              { key: 's', label: 'Trạng thái', render: (r) => <StatusChip kind={r.status === 'indexed' ? 'on' : r.status === 'error' ? 'off' : 'muted'} text={r.status === 'indexed' ? 'Đang dùng' : r.status === 'error' ? 'Lỗi' : 'Đã tắt'} /> },
            ]}
            actions={(r) => (<>
              <Btn title={r.status === 'disabled' ? 'Bật' : 'Tắt'} tone="giay" size="sm" onPress={async () => { if (await run(() => api.aiDocStatus(token, r.id, r.status === 'disabled' ? 'indexed' : 'disabled'))) st.reload(); }} />
              <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove({ id: r.id, title: r.title })} />
            </>)} />
        </>
      ) : null}
      {paste ? (
        <FormSheet wide title="Thêm văn bản làm tư liệu cho AI" fields={[{ name: 'title', label: 'Tên tài liệu', required: true }, { name: 'text', label: 'Nội dung (tối thiểu 40 ký tự)', type: 'textarea', required: true, hint: 'Chỉ dán nội dung đã được kiểm chứng; AI sẽ trích dẫn nguyên văn.' }]} onClose={() => setPaste(false)}
          onSubmit={async (v) => { await api.aiAddText(token, String(v.title).trim(), String(v.text)); setPaste(false); st.reload(); }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa tài liệu “${remove?.title ?? ''}”?`} message="Các đoạn của tài liệu bị gỡ khỏi chỉ mục; câu trả lời cũ vẫn giữ nguồn đã trích." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.aiDeleteDoc(token, remove.id).then(() => true), 'Đã xóa tài liệu')) { setRemove(null); st.reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- mô hình và khóa API (HK.AD.057)
const Model: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const cfg = useLoad(() => api.aiSettings(token), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [f, setF] = useState({ provider: 'none', base_url: '', chat_model: '', embed_model: '', api_key: '', temperature: '0.3', max_tokens: '700', top_k: '5', price_in: '0', price_out: '0' });
  const [test, setTest] = useState<TestResult | null>(null);
  const d: AiSettingsView | null = cfg.data;
  useEffect(() => { if (d) setF({ provider: d.provider, base_url: d.base_url ?? '', chat_model: d.chat_model ?? '', embed_model: d.embed_model ?? '', api_key: '', temperature: String(d.temperature), max_tokens: String(d.max_tokens), top_k: String(d.top_k), price_in: String(d.price_in), price_out: String(d.price_out) }); }, [d]);
  const save = async () => {
    const body: Record<string, unknown> = { provider: f.provider, base_url: f.base_url, chat_model: f.chat_model, embed_model: f.embed_model, temperature: Number(f.temperature), max_tokens: Number(f.max_tokens), top_k: Number(f.top_k), price_in: Number(f.price_in.replace(',', '.')), price_out: Number(f.price_out.replace(',', '.')) };
    if (f.api_key.trim()) body.api_key = f.api_key.trim();
    const out = await run(() => api.aiSaveSettings(token, body), 'Đã lưu cấu hình mô hình');
    if (out) { cfg.setData(out); setTest(null); }
  };
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={cfg.error} />
      {cfg.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <InfoNote><Txt size={14}>Chưa chọn nhà cung cấp thì Tiểu Tướng chạy ở <Txt f="bold" size={14}>chế độ trích tư liệu</Txt> (trả lời bằng nguyên văn tư liệu, không cần khóa API). Chọn nhà cung cấp và nhập khóa để AI viết lời giải thích, nhập vai và soạn câu hỏi.</Txt></InfoNote>
          {d.env_overrides.length ? <InfoNote><Txt size={13}>Các biến môi trường {d.env_overrides.join(', ')} đang ghi đè cấu hình ở trang này.</Txt></InfoNote> : null}
          <Segmented<string> label="Nhà cung cấp" value={f.provider} onChange={(v) => setF({ ...f, provider: v })} options={[{ value: 'none', label: 'Không (trích tư liệu)' }, { value: 'anthropic', label: 'Anthropic (Claude)' }, { value: 'openai', label: 'API tương thích OpenAI' }]} />
          <Field label="Địa chỉ API (để trống dùng mặc định)" value={f.base_url} onChangeText={(v) => setF({ ...f, base_url: v })} placeholder={f.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'} autoCapitalize="none" nativeID="ai-base-url" />
          <Field label="Mô hình trả lời" value={f.chat_model} onChangeText={(v) => setF({ ...f, chat_model: v })} placeholder={f.provider === 'anthropic' ? d.default_chat_model.anthropic : d.default_chat_model.openai} autoCapitalize="none" nativeID="ai-chat-model" />
          {f.provider === 'openai' ? <Field label="Mô hình nhúng (để trống thì chỉ tra cứu theo từ khóa)" value={f.embed_model} onChangeText={(v) => setF({ ...f, embed_model: v })} placeholder="text-embedding-3-small" autoCapitalize="none" nativeID="ai-embed-model" hint="Anthropic không có API nhúng nên chỉ dùng tra cứu theo từ khóa." /> : null}
          <Field label={d.has_key ? `Khóa API (đang lưu ${d.key_hint}, nguồn: ${d.key_source === 'env' ? 'biến môi trường' : 'cơ sở dữ liệu, đã mã hóa'}; bỏ trống để giữ nguyên)` : 'Khóa API'} value={f.api_key} onChangeText={(v) => setF({ ...f, api_key: v })} secureTextEntry autoCapitalize="none" autoComplete="off" nativeID="ai-api-key"
            hint={d.key_unreadable ? 'Khóa đã lưu không đọc được (khóa bí mật máy chủ đã đổi): hãy nhập lại.' : 'Khóa không bao giờ hiển thị lại sau khi lưu.'} />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 140 }}><Field label="Nhiệt độ (0–1)" value={f.temperature} onChangeText={(v) => setF({ ...f, temperature: v })} keyboardType="numeric" /></View>
            <View style={{ flex: 1, minWidth: 140 }}><Field label="Giới hạn token trả lời" value={f.max_tokens} onChangeText={(v) => setF({ ...f, max_tokens: v })} keyboardType="numeric" /></View>
            <View style={{ flex: 1, minWidth: 140 }}><Field label="Số đoạn tư liệu truy xuất" value={f.top_k} onChangeText={(v) => setF({ ...f, top_k: v })} keyboardType="numeric" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 200 }}><Field label="Giá token vào (USD / 1 triệu token)" value={f.price_in} onChangeText={(v) => setF({ ...f, price_in: v })} keyboardType="decimal-pad" hint="Chỉ dùng để ước tính chi phí ở mục Thống kê hệ thống." nativeID="ai-price-in" /></View>
            <View style={{ flex: 1, minWidth: 200 }}><Field label="Giá token ra (USD / 1 triệu token)" value={f.price_out} onChangeText={(v) => setF({ ...f, price_out: v })} keyboardType="decimal-pad" nativeID="ai-price-out" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Btn title="Lưu cấu hình" tone="son" loading={busy} onPress={save} testID="ai-save-model" />
            <Btn icon={Play} title="Kiểm tra kết nối" tone="giay" loading={busy} onPress={async () => { const r = await run(() => api.aiTest(token)); if (r) setTest(r); }} testID="ai-test" />
          </View>
          {test ? (
            <Card flat pad={12} style={{ gap: 4 }}>
              {!test.configured ? <Txt size={14}>{test.message}</Txt> : (
                <>
                  <Txt f="bold" size={14} color={test.chat?.ok ? c.ngocChu : c.sonChu}>Trả lời: {test.chat?.ok ? `thành công (${test.chat.ms} ms, ${test.chat.model})` : `lỗi – ${test.chat?.error}`}</Txt>
                  {test.embed ? <Txt f="bold" size={14} color={test.embed.ok ? c.ngocChu : c.sonChu}>Nhúng: {test.embed.ok ? `thành công (${test.embed.dimensions} chiều, ${test.embed.ms} ms)` : `lỗi – ${test.embed.error}`}</Txt> : null}
                </>
              )}
            </Card>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- prompt và phạm vi (HK.AD.058)
const Prompt: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const cfg = useLoad(() => api.aiSettings(token), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [f, setF] = useState({ system_prompt: '', refusal_message: '', banned_terms: '', min_score: '0.4' });
  const d = cfg.data;
  useEffect(() => { if (d) setF({ system_prompt: d.system_prompt, refusal_message: d.refusal_message, banned_terms: d.banned_terms.join('\n'), min_score: String(d.min_score) }); }, [d]);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={cfg.error} />
      {cfg.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <Field label="Prompt hệ thống (vai “Tiểu Tướng”, ngôn ngữ, quy tắc từ chối)" value={f.system_prompt} onChangeText={(v) => setF({ ...f, system_prompt: v })} multiline numberOfLines={8} inputStyle={{ minHeight: 180, textAlignVertical: 'top' }} nativeID="ai-system-prompt" />
          <Field label="Lời từ chối khi câu hỏi ngoài phạm vi" value={f.refusal_message} onChangeText={(v) => setF({ ...f, refusal_message: v })} multiline numberOfLines={3} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} nativeID="ai-refusal" />
          <Field label="Ngưỡng liên quan tối thiểu (0–1)" value={f.min_score} onChangeText={(v) => setF({ ...f, min_score: v })} keyboardType="numeric" hint="Độ phủ từ khóa của câu hỏi với đoạn tư liệu tốt nhất; càng cao càng dễ từ chối. Dùng ‘Thử câu hỏi’ để chọn giá trị phù hợp (mặc định 0,4)." nativeID="ai-min-score" />
          <Field label="Từ ngữ cấm bổ sung (mỗi dòng một từ; đã có sẵn danh sách mặc định)" value={f.banned_terms} onChangeText={(v) => setF({ ...f, banned_terms: v })} multiline numberOfLines={4} inputStyle={{ minHeight: 100, textAlignVertical: 'top' }} nativeID="ai-banned" />
          <View style={{ flexDirection: 'row' }}><Btn title="Lưu prompt và phạm vi" tone="son" loading={busy} onPress={async () => { const o = await run(() => api.aiSaveSettings(token, { system_prompt: f.system_prompt, refusal_message: f.refusal_message, banned_terms: f.banned_terms.split('\n'), min_score: Number(f.min_score) }), 'Đã lưu'); if (o) cfg.setData(o); }} testID="ai-save-prompt" /></View>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Playground (HK.AD.059)
const Play_: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Playground | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Thử một câu hỏi để xem các đoạn tư liệu được truy xuất (kèm điểm) và câu trả lời. Thử nghiệm ở đây không lưu hội thoại và không tính vào hạn mức.</Txt>
      <Field label="Câu hỏi thử" value={q} onChangeText={setQ} maxLength={500} nativeID="ai-play-q" onSubmitEditing={async () => { const r = await run(() => api.aiPlayground(session.token, q)); if (r) setRes(r); }} />
      <View style={{ flexDirection: 'row' }}><Btn icon={Play} title="Thử" tone="son" loading={busy} disabled={q.trim().length < 2} onPress={async () => { const r = await run(() => api.aiPlayground(session.token, q)); if (r) setRes(r); }} testID="ai-play-run" /></View>
      {res ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip text={res.refused ? `Từ chối: ${REFUSAL_TEXT[res.reason ?? ''] ?? res.reason}` : res.mode === 'llm' ? `Mô hình ${res.model}` : 'Trích tư liệu'} bg={res.refused ? c.dongNhat : c.ngocNhat} fg={res.refused ? c.dongChu : c.ngocChu} />
            <Chip text={`${res.ms} ms`} bg={c.the2} fg={c.muc2} />
            <Chip text={`Độ phủ tốt nhất ${res.top_score ?? 0} / ngưỡng ${res.min_score}`} bg={c.thuyNhat} fg={c.thuyChu} />
            {res.tokens_in ? <Chip text={`${res.tokens_in} + ${res.tokens_out} token`} bg={c.the2} fg={c.muc2} /> : null}
          </View>
          <Card flat pad={12}><Txt size={14} style={{ lineHeight: 22 }} selectable>{res.answer}</Txt></Card>
          <Txt f="bold" size={14}>Các đoạn tư liệu truy xuất ({res.passages.length})</Txt>
          {res.passages.map((p) => (
            <Card key={`${p.n}${p.source_id}`} flat pad={10} style={{ gap: 2 }}>
              <Txt f="bold" size={13}>[{p.n}] {p.title} <Txt size={12} color={c.muc3}>({p.kind} #{p.source_id}) · phủ {p.coverage} · cosine {p.cosine}</Txt></Txt>
              <Txt size={13} color={c.muc2}>{p.snippet}</Txt>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- nhật ký (HK.AD.060) và đánh giá (HK.AD.062)
const LogDetail: React.FC<{ session: Session; item: LogItem; onClose: () => void; onLabeled: () => void }> = ({ session, item, onClose, onLabeled }) => {
  const { run } = useAction(session.expired);
  const [label, setLabel] = useState(item.admin_label);
  const set = async (v: 'correct' | 'incorrect' | null) => { if (await run(() => api.aiLabel(session.token, item.id, v), v ? 'Đã gắn nhãn' : 'Đã bỏ nhãn')) { setLabel(v); onLabeled(); } };
  return (
    <Sheet open onClose={onClose} title="Chi tiết câu trả lời" subtitle={`${item.school ?? 'Không rõ trường'} · người hỏi ${item.who}`} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <View style={{ gap: 10 }}>
        <Txt f="bold" size={14}>Câu hỏi</Txt><Txt size={14} selectable>{item.question ?? '(không có)'}</Txt>
        <Txt f="bold" size={14}>Câu trả lời {item.refused ? `(từ chối: ${REFUSAL_TEXT[item.refusal_reason ?? ''] ?? ''})` : item.answer_mode === 'llm' ? `(mô hình ${item.model})` : '(trích tư liệu)'}</Txt>
        <Txt size={14} style={{ lineHeight: 22 }} selectable>{item.answer}</Txt>
        {item.citations.length ? <Txt size={13}>Nguồn: {item.citations.map((c) => `[${c.n}] ${c.title}`).join('; ')}</Txt> : null}
        <Txt size={12}>{item.tokens_in} + {item.tokens_out} token · {item.latency_ms} ms{item.top_score !== null ? ` · độ phủ ${item.top_score}` : ''}</Txt>
        <Txt f="bold" size={14}>Đánh giá chất lượng</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn title="Đúng" tone={label === 'correct' ? 'ngoc' : 'giay'} size="sm" onPress={() => set(label === 'correct' ? null : 'correct')} testID="label-correct" />
          <Btn title="Sai" tone={label === 'incorrect' ? 'son' : 'giay'} size="sm" onPress={() => set(label === 'incorrect' ? null : 'incorrect')} testID="label-incorrect" />
        </View>
      </View>
    </Sheet>
  );
};

const Logs: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const limits = useLoad(() => api.aiLimits(token), [token], session.expired);
  const [school, setSchool] = useState<number | undefined>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reported, setReported] = useState(false);
  const [refused, setRefused] = useState(false);
  const [page, setPage] = useState(1);
  const logs = useLoad(() => api.aiLogs(token, { school_id: school, from, to, reported, refused, page }), [token, school, from, to, reported, refused, page], session.expired);
  const [open, setOpen] = useState<LogItem | null>(null);
  const d = logs.data;
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Nhật ký ẩn danh: không có tên học sinh, chỉ mã người hỏi ngắn để nhận ra cùng một người. Cuộc trò chuyện học sinh đã xóa vẫn hiện ở đây (đánh dấu) để kiểm tra báo cáo sai.</Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Mọi trường" tone={school === undefined ? 'ngoc' : 'giay'} size="sm" onPress={() => { setSchool(undefined); setPage(1); }} />
        {(limits.data?.schools ?? []).map((s) => <Btn key={s.id} title={s.name} tone={school === s.id ? 'ngoc' : 'giay'} size="sm" onPress={() => { setSchool(s.id); setPage(1); }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <View style={{ minWidth: 150 }}><Field label="Từ ngày (YYYY-MM-DD)" value={from} onChangeText={(v) => { setFrom(v); setPage(1); }} autoCapitalize="none" nativeID="ai-log-from" /></View>
        <View style={{ minWidth: 150 }}><Field label="Đến ngày (YYYY-MM-DD)" value={to} onChangeText={(v) => { setTo(v); setPage(1); }} autoCapitalize="none" nativeID="ai-log-to" /></View>
        <Btn title={reported ? 'Chỉ câu bị báo cáo ✓' : 'Chỉ câu bị báo cáo'} tone={reported ? 'son' : 'giay'} size="sm" onPress={() => { setReported(!reported); setPage(1); }} />
        <Btn title={refused ? 'Chỉ câu bị từ chối ✓' : 'Chỉ câu bị từ chối'} tone={refused ? 'son' : 'giay'} size="sm" onPress={() => { setRefused(!refused); setPage(1); }} />
      </View>
      <ErrorNote message={logs.error} />
      {logs.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <Txt size={13}>{d.total} câu trả lời</Txt>
          <DataTable rows={d.items} rowKey={(r) => r.id} empty="Chưa có hội thoại nào" onRowPress={setOpen}
            columns={[
              { key: 'q', label: 'Câu hỏi và trả lời', flex: 4, render: (r) => <Cell main={r.question ?? '(không có)'} sub={r.answer.slice(0, 120)} /> },
              { key: 'w', label: 'Người hỏi', render: (r) => <Cell main={r.who} sub={r.school} /> },
              { key: 's', label: 'Trạng thái', render: (r) => <View style={{ gap: 4 }}><StatusChip kind={r.refused ? 'warn' : r.answer_mode === 'llm' ? 'on' : 'info'} text={r.refused ? REFUSAL_TEXT[r.refusal_reason ?? ''] ?? 'Từ chối' : r.answer_mode === 'llm' ? 'AI' : 'Trích tư liệu'} />{r.reports ? <StatusChip kind="off" text={`${r.reports} báo cáo`} /> : null}{r.admin_label ? <StatusChip kind={r.admin_label === 'correct' ? 'on' : 'off'} text={r.admin_label === 'correct' ? 'Đã đánh giá: đúng' : 'Đã đánh giá: sai'} /> : null}</View> },
              { key: 't', label: 'Token', hideOnCard: true, render: (r) => <Txt size={13}>{r.tokens_in + r.tokens_out}</Txt> },
            ]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Trang trước" tone="giay" size="sm" disabled={page <= 1} onPress={() => setPage(page - 1)} />
            <Txt size={13}>Trang {page}/{Math.max(1, Math.ceil(d.total / d.limit))}</Txt>
            <Btn title="Trang sau" tone="giay" size="sm" disabled={page * d.limit >= d.total} onPress={() => setPage(page + 1)} />
          </View>
        </>
      ) : null}
      {open ? <LogDetail session={session} item={open} onClose={() => setOpen(null)} onLabeled={logs.reload} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- báo cáo sai (HK.AD.061)
const Reports: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const [status, setStatus] = useState<'open' | 'reviewing' | 'resolved' | 'dismissed' | ''>('open');
  const reports = useLoad(() => api.aiReports(token, status || undefined), [token, status], session.expired);
  const evalSum = useLoad(() => api.aiEval(token), [token], session.expired);
  const [edit, setEdit] = useState<AiReport | null>(null);
  const fields: FieldDef[] = [
    { name: 'status', label: 'Trạng thái xử lý', type: 'select', options: [{ value: 'open', label: 'Chưa xử lý' }, { value: 'reviewing', label: 'Đang kiểm tra tư liệu' }, { value: 'resolved', label: 'Đã xử lý (đã sửa tư liệu)' }, { value: 'dismissed', label: 'Bỏ qua (câu trả lời đúng)' }] },
    { name: 'resolution', label: 'Ghi chú xử lý', type: 'textarea', hint: 'Ví dụ: đã sửa năm trong tư liệu #12, đã lập lại chỉ mục.' },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Học sinh báo câu trả lời chưa chính xác. Kiểm tra tư liệu nguồn ở “Kho dữ liệu lịch sử”, sửa nếu cần rồi đóng báo cáo.</Txt>
      {evalSum.data ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip text={`Đã đánh giá ${evalSum.data.labeled}/${evalSum.data.total} câu`} bg={c.thuyNhat} fg={c.thuyChu} />
          {evalSum.data.accuracy !== null ? <Chip text={`Tỉ lệ đúng ${Math.round(evalSum.data.accuracy * 100)}%`} bg={c.ngocNhat} fg={c.ngocChu} /> : null}
          <DownloadButton title="Tải bộ dữ liệu đánh giá (JSON)" fetchBlob={() => api.aiEvalExport(token)} filename="bo-danh-gia-tieu-tuong.json" />
        </View>
      ) : null}
      <Segmented<typeof status> label="Lọc báo cáo" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Chưa xử lý' }, { value: 'reviewing', label: 'Đang kiểm tra' }, { value: 'resolved', label: 'Đã xử lý' }, { value: 'dismissed', label: 'Bỏ qua' }, { value: '', label: 'Tất cả' }]} />
      <ErrorNote message={reports.error} />
      {reports.loading && !reports.data ? <Spinner /> : null}
      {reports.data && !reports.data.length ? <EmptyState mood="thinking" title="Không có báo cáo nào" /> : null}
      {(reports.data ?? []).map((r) => (
        <Card key={r.id} flat pad={12} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip kind={r.status === 'resolved' ? 'on' : r.status === 'dismissed' ? 'muted' : r.status === 'reviewing' ? 'info' : 'off'} text={{ open: 'Chưa xử lý', reviewing: 'Đang kiểm tra', resolved: 'Đã xử lý', dismissed: 'Bỏ qua' }[r.status]} />
            <Txt size={12} color={c.muc3}>{r.school ?? 'Không rõ trường'} · người hỏi {r.who} · {when(r.created_at)}</Txt>
          </View>
          <Txt f="bold" size={14}>Học sinh báo: {r.reason}</Txt>
          <Txt size={13} color={c.muc2}>Câu hỏi: {r.question ?? '(không có)'}</Txt>
          <Txt size={13} numberOfLines={5}>Trả lời: {r.answer}</Txt>
          {r.citations.length ? <Txt size={12} color={c.muc3}>Nguồn: {r.citations.map((x) => `${x.kind_label}: ${x.title}`).join('; ')}</Txt> : null}
          {r.resolution ? <Txt size={13} color={c.ngocChu}>Xử lý: {r.resolution}</Txt> : null}
          <View style={{ flexDirection: 'row' }}><Btn icon={Pencil} title="Xử lý" tone="giay" size="sm" onPress={() => setEdit(r)} testID={`report-handle-${r.id}`} /></View>
        </Card>
      ))}
      {edit ? (
        <FormSheet title="Xử lý báo cáo" subtitle={edit.question ?? undefined} fields={fields} initial={{ status: edit.status === 'open' ? 'reviewing' : edit.status, resolution: edit.resolution ?? '' }} onClose={() => setEdit(null)}
          onSubmit={async (v) => { await api.aiUpdateReport(token, edit.id, String(v.status), String(v.resolution ?? '')); setEdit(null); reports.reload(); }} />
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- hạn mức (HK.AD.064)
const Limits: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const limits = useLoad(() => api.aiLimits(token), [token], session.expired);
  const { run } = useAction(session.expired);
  const [edit, setEdit] = useState<{ id: number; name: string; u: number | null; s: number | null } | null>(null);
  const [defaults, setDefaults] = useState(false);
  const d = limits.data;
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Hạn mức tính theo ngày (giờ Việt Nam). Giáo viên được gấp ba lần mức của học sinh. Trường có mức riêng thì dùng mức riêng; để trống là dùng mặc định.</Txt>
      <ErrorNote message={limits.error} />
      {limits.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip text={`Mặc định: ${d.defaults.daily_per_user} câu/người/ngày · ${d.defaults.daily_per_school} câu/trường/ngày`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Btn icon={Pencil} title="Sửa mặc định" tone="giay" size="sm" onPress={() => setDefaults(true)} />
          </View>
          <DataTable rows={d.schools} rowKey={(r) => r.id} empty="Chưa có trường nào"
            columns={[
              { key: 'n', label: 'Trường', flex: 3, render: (r) => <Cell main={r.name} sub={r.school_code} /> },
              { key: 'u', label: 'Mỗi người/ngày', render: (r) => <Txt size={13}>{r.daily_per_user ?? 'mặc định'}</Txt> },
              { key: 's', label: 'Cả trường/ngày', render: (r) => <Txt size={13}>{r.daily_per_school ?? 'mặc định'}</Txt> },
              { key: 'x', label: 'Đã dùng hôm nay', render: (r) => <Txt size={13}>{r.used_today}</Txt> },
            ]}
            actions={(r) => <Btn icon={Pencil} label={`Sửa hạn mức ${r.name}`} tone="giay" size="sm" onPress={() => setEdit({ id: r.id, name: r.name, u: r.daily_per_user, s: r.daily_per_school })} />} />
        </>
      ) : null}
      {edit ? (
        <FormSheet title="Hạn mức riêng của trường" subtitle={edit.name} onClose={() => setEdit(null)} initial={{ u: edit.u === null ? '' : String(edit.u), s: edit.s === null ? '' : String(edit.s) }}
          fields={[{ name: 'u', label: 'Số câu hỏi mỗi người mỗi ngày (1–500)', type: 'number' }, { name: 's', label: 'Số câu hỏi cả trường mỗi ngày (1–100000)', type: 'number' }]}
          onSubmit={async (v) => { await api.aiSetLimit(token, edit.id, { daily_per_user: String(v.u).trim() ? Number(v.u) : null, daily_per_school: String(v.s).trim() ? Number(v.s) : null }); setEdit(null); limits.reload(); }} />
      ) : null}
      {defaults && d ? (
        <FormSheet title="Hạn mức mặc định" onClose={() => setDefaults(false)} initial={{ u: String(d.defaults.daily_per_user), s: String(d.defaults.daily_per_school) }}
          fields={[{ name: 'u', label: 'Số câu hỏi mỗi người mỗi ngày (1–500)', type: 'number', required: true }, { name: 's', label: 'Số câu hỏi mỗi trường mỗi ngày (1–100000)', type: 'number', required: true }]}
          onSubmit={async (v) => { if (await run(() => api.aiSaveSettings(token, { daily_per_user: Number(v.u), daily_per_school: Number(v.s) }), 'Đã lưu hạn mức mặc định')) { setDefaults(false); limits.reload(); } }} />
      ) : null}
    </View>
  );
};

export const AiAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<Part>('sources');
  return (
    <Page>
      <PageHeader title="AI Tutor “Tiểu Tướng”" subtitle="Nguồn tri thức, mô hình, prompt, nhật ký, báo cáo sai và hạn mức sử dụng. Tiểu Tướng chỉ trả lời từ nội dung đã công bố và có trích dẫn." />
      <Segmented<Part> label="Mục quản trị AI" value={part} onChange={setPart}
        options={[{ value: 'sources', label: 'Nguồn và chỉ mục' }, { value: 'model', label: 'Mô hình' }, { value: 'prompt', label: 'Prompt và phạm vi' }, { value: 'play', label: 'Thử câu hỏi' }, { value: 'logs', label: 'Nhật ký' }, { value: 'reports', label: 'Báo cáo và đánh giá' }, { value: 'limits', label: 'Hạn mức' }]} />
      {part === 'sources' ? <Sources session={session} /> : part === 'model' ? <Model session={session} /> : part === 'prompt' ? <Prompt session={session} /> : part === 'play' ? <Play_ session={session} />
        : part === 'logs' ? <Logs session={session} /> : part === 'reports' ? <Reports session={session} /> : <Limits session={session} />}
    </Page>
  );
};
