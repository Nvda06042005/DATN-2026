/**
 * Làm bài (HK.HS.043–046, 048, 050; HK.GV.044): mỗi lần một câu, đồng hồ đếm ngược do máy chủ giữ (giao diện chỉ hiển thị), sáu dạng câu hỏi,
 * kết quả từng câu kèm đáp án – giải thích – mục lịch sử liên quan, tổng kết có sao và điểm, xem lại từng câu.
 * Máy chủ chấm điểm; trình duyệt chỉ gửi câu trả lời.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, CircleDot, Clock, Lightbulb, ListChecks, MapPin, RotateCcw, Sparkles, Square, SquareCheck, Trophy, XCircle } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { requestHint } from '@/api/gameApi';
import { castSkill, mySkills } from '@/api/classroomApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LeafletMap, type MapCircle, type MapLine, type MapMarker } from '@/components/portal/LeafletMap';
import { Bar, Btn, Card, Inset, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { SkillView } from '@/types/classroom';
import type { AnswerResult, AttemptReview, AttemptState, AttemptSummary, PlayQuestion, QData, QType, ReviewItem } from '@/types/learning';
import { QTYPE_TEXT } from '@/types/learning';

type Placement = Record<string, { lat: number; lng: number }>;
export type Draft = string | string[] | boolean | Placement | null;

export const initialDraft = (q: PlayQuestion): Draft => {
  if (q.qtype === 'multiple') return [];
  if (q.qtype === 'fill') return Array.from({ length: q.blanks ?? 1 }, () => '');
  if (q.qtype === 'order') return (q.items ?? []).map((i) => i.id);
  if (q.qtype === 'map') return {};
  return null;
};

export const buildAnswer = (qtype: QType, draft: Draft): unknown => {
  switch (qtype) {
    case 'single': return { choice: draft };
    case 'multiple': return { choices: draft };
    case 'truefalse': return { value: draft };
    case 'fill': return { blanks: draft };
    case 'order': return { order: draft };
    default: return { placements: draft };
  }
};

export const ready = (q: PlayQuestion, draft: Draft): boolean => {
  if (q.qtype === 'single') return typeof draft === 'string';
  if (q.qtype === 'multiple') return Array.isArray(draft) && draft.length > 0;
  if (q.qtype === 'truefalse') return typeof draft === 'boolean';
  if (q.qtype === 'fill') return Array.isArray(draft) && (draft as string[]).every((s) => s.trim());
  if (q.qtype === 'map') return Object.keys((draft ?? {}) as Placement).length === (q.targets?.length ?? 0);
  return true;
};

/** Mô tả đáp án đúng bằng chữ (không chỉ dựa vào màu) */
export const keyLines = (qtype: QType, key: QData): string[] => {
  if (qtype === 'single') return [key.options?.find((o) => o.id === key.correct)?.text ?? ''];
  if (qtype === 'multiple') return (key.options ?? []).filter((o) => (key.correct as string[]).includes(o.id)).map((o) => o.text);
  if (qtype === 'truefalse') return [key.correct ? 'Đúng' : 'Sai'];
  if (qtype === 'fill') return (key.blanks ?? []).map((b, i) => `Chỗ trống ${i + 1}: ${b.accept.join(' / ')}`);
  if (qtype === 'order') return (key.items ?? []).map((it, i) => `${i + 1}. ${it.text}`);
  return (key.targets ?? []).map((t) => `${t.label} (cho phép lệch ${t.radius_km} km)`);
};

const answerLines = (qtype: QType, key: QData, answer: Record<string, unknown> | null): string[] => {
  if (!answer) return ['(không trả lời)'];
  if (qtype === 'single') return [key.options?.find((o) => o.id === answer.choice)?.text ?? '(không chọn)'];
  if (qtype === 'multiple') return ((answer.choices as string[]) ?? []).map((id) => key.options?.find((o) => o.id === id)?.text ?? id);
  if (qtype === 'truefalse') return [answer.value === true ? 'Đúng' : answer.value === false ? 'Sai' : '(không chọn)'];
  if (qtype === 'fill') return ((answer.blanks as string[]) ?? []).map((b, i) => `Chỗ trống ${i + 1}: ${b || '(bỏ trống)'}`);
  if (qtype === 'order') return ((answer.order as string[]) ?? []).map((id, i) => `${i + 1}. ${key.items?.find((o) => o.id === id)?.text ?? id}`);
  return Object.keys((answer.placements as object) ?? {}).map((id) => `Đã đặt: ${key.targets?.find((t) => t.id === id)?.label ?? id}`);
};

// ---------------------------------------------------------------------- nhập câu trả lời
const Choice: React.FC<{ text: string; selected: boolean; multi?: boolean; disabled?: boolean; onPress: () => void }> = ({ text, selected, multi, disabled, onPress }) => {
  const { c } = useTheme();
  const Icon = multi ? (selected ? SquareCheck : Square) : selected ? CircleDot : null;
  return (
    <Pressable accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 2, borderColor: selected ? c.ngoc : c.vien, backgroundColor: selected ? c.ngocNhat : pressed ? c.giay2 : c.the })}>
      {Icon ? <Icon size={20} color={selected ? c.ngocChu : c.muc3} /> : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.muc3 }} />}
      <Txt f={selected ? 'bold' : 'medium'} size={16} style={{ flex: 1 }}>{text}</Txt>
    </Pressable>
  );
};

const PlacementInput: React.FC<{ q: PlayQuestion; draft: Placement; setDraft: (v: Placement) => void }> = ({ q, draft, setDraft }) => {
  const { c } = useTheme();
  const targets = q.targets ?? [];
  const [selected, setSelected] = useState<string>(targets[0]?.id ?? '');
  const markers: MapMarker[] = Object.entries(draft).map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, label: targets.find((t) => t.id === id)?.label ?? id, tone: 'thuy' }));
  const place = (lat: number, lng: number) => {
    if (!selected) return;
    const next = { ...draft, [selected]: { lat, lng } };
    setDraft(next);
    const after = targets.find((t) => !next[t.id]);
    if (after) setSelected(after.id);
  };
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Chọn một địa danh bên dưới, rồi bấm vào bản đồ để đặt. Bấm lại để dời vị trí.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {targets.map((t) => {
          const on = t.id === selected, done = Boolean(draft[t.id]);
          return (
            <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${t.label}${done ? ', đã đặt' : ', chưa đặt'}`} onPress={() => setSelected(t.id)}
              style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 2, borderColor: on ? c.thuy : c.vien, backgroundColor: on ? c.thuyNhat : c.the }}>
              {done ? <CheckCircle2 size={16} color={c.mocChu} /> : <MapPin size={16} color={c.muc3} />}
              <Txt f="semibold" size={14}>{t.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      <LeafletMap label="Bản đồ Việt Nam: bấm để đặt địa danh đã chọn" markers={markers} onMapPress={place} height={320} />
    </View>
  );
};

const OrderInput: React.FC<{ q: PlayQuestion; draft: string[]; setDraft: (v: string[]) => void }> = ({ q, draft, setDraft }) => {
  const { c } = useTheme();
  const text = (id: string) => q.items?.find((i) => i.id === id)?.text ?? id;
  const move = (index: number, delta: number) => {
    const next = [...draft];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} color={c.muc2}>Dùng mũi tên để đưa các mục về đúng thứ tự (sớm nhất ở trên cùng).</Txt>
      {draft.map((id, i) => (
        <View key={id} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={14} color={c.dongChu}>{i + 1}</Txt></View>
          <Txt f="medium" size={16} style={{ flex: 1 }}>{text(id)}</Txt>
          <Btn icon={ArrowUp} label={`Đưa lên: ${text(id)}`} tone="giay" size="sm" disabled={i === 0} onPress={() => move(i, -1)} />
          <Btn icon={ArrowDown} label={`Đưa xuống: ${text(id)}`} tone="giay" size="sm" disabled={i === draft.length - 1} onPress={() => move(i, 1)} />
        </View>
      ))}
    </View>
  );
};

export const QuestionInput: React.FC<{ q: PlayQuestion; draft: Draft; setDraft: (v: Draft) => void; disabled?: boolean }> = ({ q, draft, setDraft, disabled }) => {
  const { c } = useTheme();
  if (q.qtype === 'single') return <View style={{ gap: 10 }} accessibilityRole="radiogroup">{(q.options ?? []).map((o) => <Choice key={o.id} text={o.text} selected={draft === o.id} disabled={disabled} onPress={() => setDraft(o.id)} />)}</View>;
  if (q.qtype === 'multiple') {
    const picked = (draft as string[]) ?? [];
    return (
      <View style={{ gap: 10 }}>
        <Txt size={14} color={c.muc2}>Chọn tất cả đáp án đúng.</Txt>
        {(q.options ?? []).map((o) => <Choice key={o.id} text={o.text} multi selected={picked.includes(o.id)} disabled={disabled} onPress={() => setDraft(picked.includes(o.id) ? picked.filter((x) => x !== o.id) : [...picked, o.id])} />)}
      </View>
    );
  }
  if (q.qtype === 'truefalse') {
    return (
      <View style={{ flexDirection: 'row', gap: 12 }} accessibilityRole="radiogroup">
        {[{ v: true, t: 'Đúng' }, { v: false, t: 'Sai' }].map((o) => (
          <View key={o.t} style={{ flex: 1 }}><Choice text={o.t} selected={draft === o.v} disabled={disabled} onPress={() => setDraft(o.v)} /></View>
        ))}
      </View>
    );
  }
  if (q.qtype === 'fill') {
    const values = (draft as string[]) ?? [];
    return (
      <View style={{ gap: 10 }}>
        {values.map((v, i) => (
          <View key={i} style={{ gap: 4 }}>
            <Txt f="bold" size={13} color={c.muc2}>Chỗ trống {i + 1}</Txt>
            <TextInput value={v} editable={!disabled} onChangeText={(t) => setDraft(values.map((x, j) => (j === i ? t : x)))} accessibilityLabel={`Chỗ trống ${i + 1}`} autoCorrect={false} autoCapitalize="none" placeholder="Nhập đáp án"
              placeholderTextColor={c.muc3} style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: v ? c.ngoc : c.vien, backgroundColor: c.the, color: c.muc, fontSize: 17 }} />
          </View>
        ))}
      </View>
    );
  }
  if (q.qtype === 'order') return <OrderInput q={q} draft={draft as string[]} setDraft={setDraft} />;
  return <PlacementInput q={q} draft={(draft ?? {}) as Placement} setDraft={setDraft} />;
};

// ---------------------------------------------------------------------- kết quả từng câu
const RevealMap: React.FC<{ key_: QData; placements: Placement | null }> = ({ key_, placements }) => {
  const targets = key_.targets ?? [];
  const markers: MapMarker[] = [
    ...targets.map((t) => ({ id: `k${t.id}`, lat: t.lat, lng: t.lng, label: `Đúng: ${t.label}`, tone: 'ngoc' as const })),
    ...Object.entries(placements ?? {}).map(([id, p]) => ({ id: `p${id}`, lat: p.lat, lng: p.lng, label: `Bạn đặt: ${targets.find((t) => t.id === id)?.label ?? id}`, tone: 'thuy' as const })),
  ];
  const circles: MapCircle[] = targets.map((t) => ({ lat: t.lat, lng: t.lng, radiusKm: t.radius_km, tone: 'ngoc' }));
  const lines: MapLine[] = Object.entries(placements ?? {}).flatMap(([id, p]) => { const t = targets.find((x) => x.id === id); return t ? [{ from: [p.lat, p.lng] as [number, number], to: [t.lat, t.lng] as [number, number], tone: 'son' as const }] : []; });
  return <LeafletMap label="Bản đồ đáp án: vòng xanh là vùng chấp nhận" markers={markers} circles={circles} lines={lines} height={300} />;
};

const Links: React.FC<{ links: Array<{ ref_type: string; ref_id: number; label: string }>; onOpen?: (type: string, id: number) => void }> = ({ links, onOpen }) => {
  const { c } = useTheme();
  if (!links.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Txt f="bold" size={13} color={c.muc2}>Xem thêm trong kho lịch sử</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {links.map((l) => <Btn key={`${l.ref_type}${l.ref_id}`} title={l.label} tone="thuy" size="sm" disabled={!onOpen || l.ref_type === 'campaign'} onPress={() => onOpen?.(l.ref_type, l.ref_id)} />)}
      </View>
    </View>
  );
};

const Feedback: React.FC<{ res: AnswerResult['result']; qtype: QType; answer: Draft; onOpen?: (type: string, id: number) => void }> = ({ res, qtype, answer, onOpen }) => {
  const { c } = useTheme();
  const tone = res.correct ? { bg: c.ngocNhat, fg: c.ngocChu, icon: CheckCircle2, text: 'Chính xác!' } : res.timed_out ? { bg: c.vangNhat, fg: c.vangChu, icon: Clock, text: 'Hết giờ' } : { bg: c.sonNhat, fg: c.sonChu, icon: XCircle, text: 'Chưa đúng' };
  const Icon = tone.icon;
  return (
    <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
      <Inset style={{ backgroundColor: tone.bg, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon size={24} color={tone.fg} />
        <View style={{ flex: 1 }}>
          <Txt f="displayHeavy" size={20} color={tone.fg}>{tone.text}</Txt>
          {res.correct ? <Txt size={14} color={tone.fg}>+{res.base_points} điểm{res.bonus_points ? `, +${res.bonus_points} thưởng tốc độ` : ''}</Txt> : null}
        </View>
      </Inset>
      {!res.correct || qtype === 'map' ? (
        <Card flat pad={14} style={{ gap: 6 }}>
          <Txt f="bold" size={14} color={c.muc2}>Đáp án đúng</Txt>
          {keyLines(qtype, res.answer_key).map((line, i) => <Txt key={i} size={16} f="semibold">{line}</Txt>)}
        </Card>
      ) : null}
      {qtype === 'map' ? <RevealMap key_={res.answer_key} placements={answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Placement) : null} /> : null}
      {res.explanation ? <Card flat pad={14} style={{ gap: 4 }}><Txt f="bold" size={14} color={c.muc2}>Giải thích</Txt><Txt size={15}>{res.explanation}</Txt></Card> : null}
      <Links links={res.links} onOpen={onOpen} />
    </View>
  );
};

// ---------------------------------------------------------------------- tổng kết và xem lại
const Summary: React.FC<{ summary: AttemptSummary; mode: AttemptState['mode']; onReview: () => void; onClose: () => void; onRetry?: () => void; onOpen?: (type: string, id: number) => void }> = ({ summary, mode, onReview, onClose, onRetry, onOpen }) => {
  const { c } = useTheme();
  const r = summary.node_result;
  const passed = Boolean(summary.passed);
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 8, backgroundColor: passed ? c.ngocNhat : c.the2 }}>
        <Trophy size={40} color={passed ? c.ngocChu : c.muc3} />
        <Txt f="displayHeavy" size={26} center accessibilityRole="header">{mode === 'preview' ? 'Kết quả làm thử' : mode === 'practice' ? 'Hoàn thành luyện tập' : passed ? (r?.campaign_final ? 'Chiến thắng!' : 'Hoàn thành!') : 'Chưa đạt, thử lại nhé'}</Txt>
        <Txt f="displayHeavy" size={44}>{summary.percent}%</Txt>
        <Txt size={14} color={c.muc2}>Đúng {summary.correct}/{summary.total} câu · Cần đạt {summary.pass_percent}%</Txt>
        {mode === 'node' ? <Stars n={summary.stars} size={30} /> : null}
        <Txt f="bold" size={16}>{summary.base_points + summary.bonus_points} điểm{summary.bonus_points ? ` (gồm ${summary.bonus_points} thưởng tốc độ)` : ''}</Txt>
      </Card>
      {summary.assignment ? (
        <Card flat pad={14} style={{ gap: 4, backgroundColor: c.thuyNhat }}>
          <Txt f="bold" size={15} color={c.thuyChu}>Đã nộp bài tập của lớp</Txt>
          <Txt size={14} color={c.thuyChu}>{summary.assignment.on_time ? 'Em nộp đúng hạn.' : 'Em nộp sau hạn nên không có điểm thưởng.'}{summary.assignment.bonus ? ` Em nhận +${summary.assignment.bonus} điểm thưởng.` : ''} Điểm cao nhất của các lần làm được tính.</Txt>
        </Card>
      ) : null}
      {r && (r.points_awarded > 0 || r.passed || r.unlocked_sources.length > 0) ? (
        <Card flat pad={14} style={{ gap: 6 }}>
          {r.points_awarded > 0 ? <Txt f="bold" size={15} color={c.ngocChu}>+{r.points_awarded} điểm vào tài khoản của em</Txt> : r.passed ? <Txt size={14} color={c.muc2}>Em đã nhận thưởng nút này, điểm chỉ tăng khi vượt kỷ lục cũ.</Txt> : null}
          {r.unlocked_sources.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Mở khóa tư liệu mới</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{r.unlocked_sources.map((s) => <Btn key={s.id} title={s.title} tone="dong" size="sm" onPress={() => onOpen?.('source', s.id)} />)}</View>
            </View>
          ) : null}
          {r.journey_completed ? <Txt f="bold" size={15} color={c.dongChu}>Em đã hoàn thành cả hành trình của cuộc kháng chiến này!</Txt> : r.next_node && r.passed ? <Txt size={14} color={c.muc2}>Nút tiếp theo đã mở: {r.next_node.title}</Txt> : null}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Btn icon={ListChecks} title="Xem lại từng câu" tone="giay" onPress={onReview} />
        {onRetry && (mode === 'node' || mode === 'assignment') && !passed ? <Btn icon={RotateCcw} title="Làm lại" tone="dong" onPress={onRetry} /> : null}
        <Btn iconRight={ArrowRight} title={mode === 'node' ? 'Về bản đồ' : 'Xong'} tone="ngoc" onPress={onClose} />
      </View>
    </View>
  );
};

const Review: React.FC<{ review: AttemptReview; onBack?: () => void; onOpen?: (type: string, id: number) => void; onExplain?: (attemptId: number, questionId: number) => void }> = ({ review, onBack, onOpen, onExplain }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {onBack ? <Btn title="Quay lại kết quả" tone="giay" size="sm" onPress={onBack} /> : null}
      {review.items.map((it: ReviewItem) => (
        <Card key={it.question_id} flat pad={14} style={{ gap: 8, borderLeftWidth: 5, borderLeftColor: it.correct ? c.ngoc : it.timed_out ? c.vang : c.son }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt f="bold" size={13} color={c.muc2}>Câu {it.index + 1} · {QTYPE_TEXT[it.qtype]}</Txt>
            <Txt f="bold" size={13} color={it.correct ? c.ngocChu : it.timed_out ? c.vangChu : c.sonChu}>{it.correct ? 'Đúng' : it.timed_out ? 'Hết giờ' : 'Sai'}</Txt>
            <Txt size={13} color={c.muc3}>{it.base_points + it.bonus_points} điểm · {Math.round(it.time_ms / 1000)}s/{it.seconds}s</Txt>
          </View>
          <Txt f="semibold" size={16}>{it.prompt}</Txt>
          <Txt size={14} color={c.muc2}>Em trả lời: {answerLines(it.qtype, it.answer_key, it.answer).join('; ')}</Txt>
          {!it.correct ? <Txt size={14} f="semibold" color={c.ngocChu}>Đáp án đúng: {keyLines(it.qtype, it.answer_key).join('; ')}</Txt> : null}
          {it.qtype === 'map' ? <RevealMap key_={it.answer_key} placements={(it.answer?.placements as Placement) ?? null} /> : null}
          {it.explanation ? <Txt size={14}>{it.explanation}</Txt> : null}
          <Links links={it.links} onOpen={onOpen} />
          {onExplain && !it.correct ? <View style={{ flexDirection: 'row' }}><Btn icon={Sparkles} title="Hỏi Tiểu Tướng" label={`Hỏi Tiểu Tướng vì sao câu ${it.index + 1} chưa đúng`} tone="dong" size="sm" onPress={() => onExplain(review.id, it.question_id)} testID={`ask-ai-${it.question_id}`} /></View> : null}
        </Card>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- khung làm bài
export const QuizPlayer: React.FC<{
  session: Session; initial: AttemptState; title: string; onClose: (summary?: AttemptSummary) => void; onRetry?: () => void; onOpenLink?: (type: string, id: number) => void;
  /** Số gợi ý 50/50 em đang có (HK.HS.070) và hàm gọi khi tim, vàng hay gợi ý thay đổi để cập nhật thanh chỉ số */
  hints?: number; onGameChanged?: () => void;
  /** Hỏi Tiểu Tướng vì sao một câu chưa đúng (HK.HS.089) */
  onExplain?: (attemptId: number, questionId: number) => void;
}> = ({ session, initial, title, onClose, onRetry, onOpenLink, hints = 0, onGameChanged, onExplain }) => {
  const { c } = useTheme();
  const { token } = session;
  const [state, setState] = useState<AttemptState>(initial);
  const [hintsLeft, setHintsLeft] = useState(hints);
  const [skills, setSkills] = useState<SkillView | null>(null);
  const [seen, setSeen] = useState<Array<{ ref_type: string; ref_id: number; label: string }>>([]);
  const [draft, setDraft] = useState<Draft>(null);
  const [feedback, setFeedback] = useState<{ res: AnswerResult; sent: Draft } | null>(null);
  const [summary, setSummary] = useState<AttemptSummary | null>(initial.summary ?? null);
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initial.current?.remaining_ms ?? 0);
  const [announce, setAnnounce] = useState('');
  const deadline = useRef(Date.now() + (initial.current?.remaining_ms ?? 0));
  const submitting = useRef(false);
  const current = state.current;
  const q = current?.question;

  const guard = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) session.expired();
    setError(errorMessage(e));
  }, [session]);

  const adopt = useCallback((next: AttemptState) => {
    setState(next);
    setFeedback(null);
    setError(null);
    if (next.status === 'done' && next.summary) { setSummary(next.summary); return; }
    if (next.current) {
      deadline.current = Date.now() + next.current.remaining_ms;
      setRemaining(next.current.remaining_ms);
      setDraft(initialDraft(next.current.question));
      setSeen([]);
      setAnnounce('');
    }
  }, []);

  // Bắt đầu: nếu lượt đang chờ sang câu kế thì xin câu kế
  useEffect(() => {
    if (initial.status === 'done') return;
    if (initial.waiting_next) api.nextQuestion(token, initial.id).then(adopt).catch(guard);
    else if (initial.current) setDraft(initialDraft(initial.current.question));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    if (!q || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const sent = draft ?? initialDraft(q);
      const res = await api.answerAttempt(token, state.id, q.id, buildAnswer(q.qtype, sent));
      setFeedback({ res, sent });
      setState((s) => ({ ...s, position: res.attempt.position, base_points: res.attempt.base_points, bonus_points: res.attempt.bonus_points }));
      if (res.summary) setSummary(res.summary);
      onGameChanged?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Câu hiện tại đã đổi (ví dụ hết giờ): tải lại trạng thái từ máy chủ
        try { adopt(await api.getAttempt(token, state.id)); } catch (e2) { guard(e2); }
      } else guard(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [q, draft, token, state.id, adopt, guard, onGameChanged]);

  // Gợi ý 50/50: máy chủ loại bớt đáp án sai và trừ một gợi ý; chỉ dùng cho câu một đáp án từ 3 lựa chọn trở lên
  const askHint = async () => {
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { removed } = await requestHint(token, state.id);
      setState((s) => (s.current ? { ...s, current: { ...s.current, question: { ...s.current.question, options: (s.current.question.options ?? []).filter((o) => !removed.includes(o.id)) } } } : s));
      setDraft((d) => (typeof d === 'string' && removed.includes(d) ? null : d));
      setHintsLeft((n) => Math.max(0, n - 1));
      setAnnounce(`Đã bỏ ${removed.length} đáp án sai`);
      onGameChanged?.();
    } catch (e) { guard(e); } finally { setBusy(false); }
  };

  // Kỹ năng nhân vật dùng trong lúc làm bài (HK.HS.072): Mưu kế loại bớt đáp án sai, Trận đồ mở mục lịch sử liên quan; chỉ khi em thuộc một lớp học
  useEffect(() => {
    if (state.mode === 'preview') return;
    mySkills(token).then(setSkills).catch(() => undefined);
  }, [token, state.mode]);
  const castQuizSkill = async (code: string) => {
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await castSkill(token, { skill: code, attempt_id: state.id });
      if (res.removed) {
        const removed = res.removed;
        setState((s) => (s.current ? { ...s, current: { ...s.current, question: { ...s.current.question, options: (s.current.question.options ?? []).filter((o) => !removed.includes(o.id)) } } } : s));
        setDraft((d) => (typeof d === 'string' && removed.includes(d) ? null : d));
      }
      if (res.links) setSeen(res.links);
      setAnnounce(res.message);
      setSkills((v) => (v ? { ...v, ap: res.ap } : v));
      onGameChanged?.();
    } catch (e) { guard(e); } finally { setBusy(false); }
  };

  // Đồng hồ: tính từ mốc hết giờ, không cộng dồn để không trôi khi tab nền chạy chậm
  useEffect(() => {
    if (!current || feedback || summary) return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, deadline.current - Date.now());
      setRemaining(left);
      const s = Math.ceil(left / 1000);
      if (s === 10 || s === 5) setAnnounce(`Còn ${s} giây`);
      if (left <= 0) { clearInterval(timer); submit(); }
    }, 200);
    return () => clearInterval(timer);
  }, [current?.index, feedback, summary, submit]); // eslint-disable-line react-hooks/exhaustive-deps

  const proceed = async () => {
    if (feedback?.res.finished) { setFeedback(null); return; }
    setBusy(true);
    try { adopt(await api.nextQuestion(token, state.id)); } catch (e) { guard(e); } finally { setBusy(false); }
  };

  const openReview = async () => {
    setBusy(true);
    try { setReview(await api.attemptReview(token, state.id)); } catch (e) { guard(e); } finally { setBusy(false); }
  };

  const seconds = Math.ceil(remaining / 1000);
  const total = (current?.seconds ?? 1) * 1000;
  const hurry = remaining <= 5000;

  const body = useMemo(() => {
    if (review) return <Review review={review} onBack={() => setReview(null)} onOpen={onOpenLink} onExplain={onExplain} />;
    if (summary && !feedback) return <Summary summary={summary} mode={state.mode} onReview={openReview} onClose={() => onClose(summary)} onRetry={onRetry} onOpen={onOpenLink} />;
    if (!q || !current) return <Spinner label="Đang chuẩn bị câu hỏi…" />;
    return (
      <View style={{ gap: 14 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt f="bold" size={14} color={c.muc2}>Câu {current.index + 1}/{state.total} · {QTYPE_TEXT[q.qtype]}</Txt>
            <Txt f="bold" size={14} color={c.dongChu}>{state.base_points + state.bonus_points} điểm</Txt>
          </View>
          <Bar value={current.index + (feedback ? 1 : 0)} max={state.total} height={10} label={`Tiến độ: câu ${current.index + 1} trên ${state.total}`} />
        </View>
        {!feedback ? (
          <View accessibilityRole="timer" accessibilityLabel={`Còn ${seconds} giây`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Clock size={20} color={hurry ? c.sonChu : c.muc2} />
            <View style={{ flex: 1 }}><Bar value={remaining} max={total} height={12} fill={hurry ? c.son : c.ngoc} /></View>
            <Txt f="displayHeavy" size={22} color={hurry ? c.sonChu : c.muc} style={{ minWidth: 48, textAlign: 'right' }}>{seconds}s</Txt>
          </View>
        ) : null}
        <Card style={{ gap: 10 }}>
          <Txt f="displayHeavy" size={22} accessibilityRole="header">{q.prompt}</Txt>
          {q.image_url ? <Txt size={13} color={c.thuyChu} selectable>Hình minh họa: {q.image_url}</Txt> : null}
        </Card>
        {!feedback ? <QuestionInput q={q} draft={draft} setDraft={setDraft} disabled={busy} /> : <Feedback res={feedback.res.result} qtype={q.qtype} answer={feedback.sent} onOpen={onOpenLink} />}
        {!feedback && q.qtype === 'single' && (q.options?.length ?? 0) >= 3 && state.mode !== 'preview' && hintsLeft > 0
          ? <Btn icon={Lightbulb} title={`Gợi ý 50/50 (còn ${hintsLeft})`} tone="thuy" size="sm" disabled={busy} onPress={askHint} testID="quiz-hint" /> : null}
        {!feedback && skills?.in_class ? skills.skills.filter((k) => k.in_quiz).map((k) => (
          <Btn key={k.code} icon={Lightbulb} title={`${k.name} (${k.cost} điểm hành động, còn ${skills.ap.current})`} tone="dong" size="sm" disabled={busy || skills.ap.current < k.cost || (k.code === 'muu_ke' && (q.qtype !== 'single' || (q.options?.length ?? 0) < 3))} onPress={() => castQuizSkill(k.code)} testID={`quiz-skill-${k.code}`} />
        )) : null}
        {seen.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{seen.map((l) => <Btn key={`${l.ref_type}${l.ref_id}`} title={l.label} tone="thuy" size="sm" onPress={() => onOpenLink?.(l.ref_type, l.ref_id)} />)}</View> : null}
        <ErrorNote message={error} />
        {!feedback
          ? <Btn title="Trả lời" tone="ngoc" size="lg" full loading={busy} disabled={!ready(q, draft)} onPress={submit} testID="quiz-submit" />
          : <Btn iconRight={ArrowRight} title={feedback.res.finished ? 'Xem kết quả' : 'Câu tiếp theo'} tone="ngoc" size="lg" full loading={busy} onPress={proceed} testID="quiz-next" />}
      </View>
    );
  }, [review, summary, feedback, q, current, state, draft, busy, error, seconds, remaining, hurry, hintsLeft, skills, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ gap: 12 }}>
      <Txt f="bold" size={13} color={c.muc3} upper numberOfLines={2}>{title}{state.mode === 'preview' ? ' · làm thử' : ''}</Txt>
      <Txt accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>{announce}</Txt>
      {body}
    </View>
  );
};

/** Xem lại một lượt làm bài đã xong từ lịch sử làm bài (HK.HS.049) */
export const ReviewScreen: React.FC<{ session: Session; id: number; onOpenLink?: (type: string, id: number) => void; onExplain?: (attemptId: number, questionId: number) => void }> = ({ session, id, onOpenLink, onExplain }) => {
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.attemptReview(session.token, id).then(setReview).catch((e) => setError(errorMessage(e))); }, [session.token, id]);
  if (error) return <ErrorNote message={error} />;
  if (!review) return <Spinner label="Đang mở bài đã làm…" />;
  return (
    <View style={{ gap: 12 }}>
      <Card flat pad={14} style={{ gap: 4 }}>
        <Txt f="displayHeavy" size={24}>{review.summary.percent}%{review.summary.passed ? ' · Đạt' : ''}</Txt>
        <Txt size={14}>Đúng {review.summary.correct}/{review.summary.total} câu · {review.summary.base_points + review.summary.bonus_points} điểm</Txt>
      </Card>
      <Review review={review} onOpen={onOpenLink} onExplain={onExplain} />
    </View>
  );
};
