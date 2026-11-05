/**
 * Trình soạn Quiz kiểu Kahoot (HK.GV.085–094, ver0.2 Sprint 8): tạo Quiz từ nút "+ Tạo" với tên, mô tả, ảnh bìa; cột trái liệt kê câu (số, loại, thời gian, ảnh thu nhỏ;
 * thêm, sao chép, xóa có hỏi lại, đổi thứ tự bằng kéo thả hoặc nút); giữa là ô nhập câu hỏi và bốn đáp án gắn hình – màu (▲ đỏ, ◆ xanh lá, ● vàng, ■ xanh đậm)
 * với vòng tròn đánh dấu đáp án đúng; bên phải là loại câu (trắc nghiệm / đúng sai), một hay nhiều đáp án, thời gian trả lời, điểm, ảnh – video minh họa và giao diện.
 * Tự lưu bản nháp trên máy chủ, xem trước như học sinh, rồi lưu chính thức vào ngân hàng câu hỏi và bộ đề; từ Quiz mở phòng thi đấu hoặc giao bài làm ở nhà.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { ArrowDown, Sparkles, ArrowUp, Check, Copy, Eye, GripVertical, ImagePlus, Palette, Pencil, Plus, Radio, Save, Send, Trash2, X } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import * as classroom from '@/api/classroomApi';
import { errorMessage, type PickedFile } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import type { GeneratedQuizQuestion } from '@/types/ai';
import { useCampaignOptions } from '@/components/admin/ContentKit';
import { ErrorNote, FormSheet, fromVn, Page, pickFile, toVn, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LiveChoice } from '@/components/portal/LiveKit';
import { LIVE_BACKGROUNDS, LIVE_MUSIC } from '@/components/portal/LiveTheme';
import { MediaView, mediaUri } from '@/components/portal/Media';
import { readImage } from '@/components/portal/HelpCenter';
import { Btn, Card, Chip, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, ToggleRow, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { QuizDetail } from '@/types/learning';
import {
  blankQuestion, newUid, problemOf, SCORE_TEXT, SOURCE_KIND_TEXT, STUDIO_SECONDS, type MediaLibrary, type ScoreMode, type StudioDraft, type StudioPayload, type StudioQType, type StudioQuestion,
} from '@/types/studio';

const QTYPE_TEXT: Record<StudioQType, string> = { single: 'Trắc nghiệm', multiple: 'Nhiều đáp án', truefalse: 'Đúng / Sai', poll: 'Bình chọn' };
const SHAPE_COLOR = ['son', 'ngoc', 'vangDam', 'thuy'] as const;
const SHAPE_MARK = ['▲', '◆', '●', '■'] as const;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

// ---------------------------------------------------------------------- chèn ảnh / video (HK.GV.092)
/** Video và nhạc tải lên (HK.GV.092, HK.GV.093): giới hạn trùng với máy chủ để báo lỗi sớm trước khi gửi tệp lớn */
const FILE_KIND = {
  video: { max: 8 * 1024 * 1024, types: ['video/mp4', 'video/webm'], label: 'Video', hint: 'MP4 hoặc WebM, tối đa 8 MB, mỗi tài khoản tối đa 5 video' },
  audio: { max: 4 * 1024 * 1024, types: ['audio/mpeg', 'audio/ogg'], label: 'Tệp nhạc', hint: 'MP3 hoặc OGG, tối đa 4 MB, mỗi tài khoản tối đa 5 tệp nhạc' },
} as const;
async function readFileData(picked: PickedFile, kind: keyof typeof FILE_KIND): Promise<{ name: string; data: string }> {
  const blob: Blob = (picked.file as Blob | undefined) ?? (await (await fetch(picked.uri)).blob());
  if (blob.size > FILE_KIND[kind].max) throw new Error(`${FILE_KIND[kind].label} tối đa ${FILE_KIND[kind].max / 1048576} MB. Hãy chọn tệp nhỏ hơn.`);
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được tệp.'));
    r.readAsDataURL(blob);
  });
  return { name: picked.name || kind, data };
}

const MediaSheet: React.FC<{ session: Session; target: 'question' | 'cover'; initial: { image: string | null; video: string | null }; onClose: () => void; onPick: (image: string | null, video: string | null) => void }> = ({ session, target, initial, onClose, onPick }) => {
  const { c } = useTheme();
  const [tab, setTab] = useState<'upload' | 'library' | 'video' | 'link'>('upload');
  const [q, setQ] = useState('');
  const [image, setImage] = useState(initial.image && !initial.image.startsWith('/') ? initial.image : '');
  const [video, setVideo] = useState(initial.video ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lib = useLoad<MediaLibrary>(() => api.mediaLibrary(session.token, q.trim()), [session.token, q, tab], session.expired);
  const upload = async () => {
    setError(null);
    try {
      const picked = await pickFile(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
      if (!picked) return;
      setBusy(true);
      const img = await readImage(picked);
      const res = await api.uploadMedia(session.token, img);
      onPick(res.url, target === 'question' ? initial.video : null);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const uploadVideo = async () => {
    setError(null);
    try {
      const picked = await pickFile([...FILE_KIND.video.types]);
      if (!picked) return;
      setBusy(true);
      const res = await api.uploadMedia(session.token, await readFileData(picked, 'video'));
      onPick(initial.image, res.url);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const removeFile = async (token: string) => {
    setError(null);
    try { await api.deleteMedia(session.token, token); lib.reload(); } catch (e) { setError(errorMessage(e)); }
  };
  const tile = (key: string, url: string, title: string, sub?: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Chọn ảnh ${title}`} onPress={() => onPick(url, target === 'question' ? initial.video : null)} testID={`media-pick-${key}`}
      style={({ pressed }) => ({ width: 132, gap: 4, padding: 6, borderRadius: 12, borderWidth: 2, borderColor: pressed ? c.son : c.vien, backgroundColor: c.the })}>
      <Image source={{ uri: mediaUri(url) }} accessibilityLabel={title} resizeMode="cover" style={{ width: '100%', height: 84, borderRadius: 8, backgroundColor: c.giay2 }} />
      <Txt size={12} numberOfLines={2}>{title}</Txt>
      {sub ? <Txt size={11} color={c.muc3}>{sub}</Txt> : null}
    </Pressable>
  );
  return (
    <Sheet open onClose={onClose} title={target === 'question' ? 'Tìm và chèn phương tiện truyền thông' : 'Chọn ảnh bìa'} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>{initial.image || initial.video ? <Btn icon={Trash2} title="Gỡ ảnh / video" tone="giay" onPress={() => onPick(null, null)} testID="media-clear" /> : null}<Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={error} />
      <Segmented<'upload' | 'library' | 'video' | 'link'> label="Nguồn ảnh" value={tab} onChange={setTab} options={[{ value: 'upload', label: 'Tải ảnh lên' }, { value: 'library', label: 'Kho tư liệu' }, ...(target === 'question' ? [{ value: 'video' as const, label: 'Tải video lên' }] : []), ...(target === 'question' ? [{ value: 'link' as const, label: 'Liên kết' }] : [{ value: 'link' as const, label: 'Liên kết' }])]} />
      {tab === 'upload' ? (
        <View style={{ gap: 8 }}>
          <Txt size={14} color={c.muc2}>Chọn ảnh PNG, JPEG, WEBP hoặc GIF (tối đa 1,5 MB). Ảnh được lưu trên máy chủ và dùng cho học sinh xem.</Txt>
          <Btn icon={ImagePlus} title="Chọn ảnh từ máy" tone="son" loading={busy} onPress={upload} testID="media-upload" />
        </View>
      ) : null}
      {tab === 'library' ? (
        <View style={{ gap: 10 }}>
          <Field label="Tìm ảnh theo tên" value={q} onChangeText={setQ} placeholder="Ví dụ: Bạch Đằng, Trần Hưng Đạo…" autoCapitalize="none" nativeID="media-search" />
          {lib.loading && !lib.data ? <Spinner /> : null}
          {lib.data?.uploads.length ? <><Txt f="bold" size={14}>Ảnh tôi đã tải lên</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{lib.data.uploads.map((u) => tile(`up-${u.token}`, u.url, u.name ?? 'Ảnh đã tải lên'))}</View></> : null}
          <Txt f="bold" size={14}>Ảnh sử liệu trong kho tư liệu</Txt>
          {lib.data && !lib.data.library.length ? <Txt size={13} color={c.muc3}>Không có ảnh phù hợp.</Txt> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{lib.data?.library.map((l) => tile(`${l.kind}-${l.id}`, l.url, l.title, SOURCE_KIND_TEXT[l.kind]))}</View>
        </View>
      ) : null}
      {tab === 'video' && target === 'question' ? (
        <View style={{ gap: 10 }} testID="media-video-tab">
          <Txt size={14} color={c.muc2}>{FILE_KIND.video.hint}. Video được lưu trên máy chủ, học sinh xem ngay trong câu hỏi và tua được.</Txt>
          <Btn icon={ImagePlus} title="Chọn video từ máy" tone="son" loading={busy} onPress={uploadVideo} testID="media-video-upload" />
          {lib.data?.videos.length ? (
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={14}>Video tôi đã tải lên</Txt>
              {lib.data.videos.map((v) => (
                <View key={v.token} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Txt size={14} style={{ flex: 1, minWidth: 160 }} numberOfLines={1}>{v.name ?? 'Video đã tải lên'} · {(v.size_bytes / 1048576).toFixed(1)} MB</Txt>
                  <Btn title="Dùng video này" tone="giay" size="sm" onPress={() => onPick(initial.image, v.url)} testID={`media-video-pick-${v.token}`} />
                  <Btn icon={Trash2} label={`Xóa video ${v.name ?? ''}`} tone="giay" size="sm" onPress={() => removeFile(v.token)} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {tab === 'link' ? (
        <View style={{ gap: 10 }}>
          <Field label="Liên kết ảnh (https)" value={image} onChangeText={setImage} autoCapitalize="none" placeholder="https://…" nativeID="media-image-url" />
          {target === 'question' ? <Field label="Liên kết video (YouTube, Vimeo hoặc tệp .mp4)" value={video} onChangeText={setVideo} autoCapitalize="none" placeholder="https://www.youtube.com/watch?v=…" nativeID="media-video-url" /> : null}
          <Btn icon={Check} title="Dùng liên kết này" tone="son" onPress={() => onPick(image.trim() || null, target === 'question' ? (video.trim() || null) : null)} testID="media-link-ok" />
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- giao bài (HK.GV.094)
const AssignSheet: React.FC<{ session: Session; quiz: QuizDetail; onClose: () => void }> = ({ session, quiz, onClose }) => {
  const classes = useLoad(() => classroom.teacherClasses(session.token), [session.token], session.expired);
  const toast = useToast();
  return (
    <FormSheet title="Giao bài làm ở nhà" subtitle={quiz.title} submitLabel="Giao bài" onClose={onClose}
      fields={[
        { name: 'class_id', label: 'Lớp', type: 'select', required: true, options: [{ value: '', label: '— Chọn lớp —' }, ...(classes.data ?? []).filter((k) => k.is_active).map((k) => ({ value: String(k.id), label: `${k.name} · ${k.students} học sinh` }))] },
        { name: 'title', label: 'Tên bài tập', required: true }, { name: 'due_at', label: 'Hạn nộp (giờ Việt Nam)', required: true, placeholder: '2026-11-20 23:59', hint: 'Dạng YYYY-MM-DD HH:mm' },
        { name: 'max_attempts', label: 'Số lần làm tối đa (1–10)', type: 'number' }, { name: 'bonus_points', label: 'Điểm thưởng khi nộp đúng hạn (0–500)', type: 'number' },
      ]}
      initial={{ class_id: '', title: quiz.title, due_at: `${toVn(new Date(Date.now() + 7 * 86_400_000).toISOString()).slice(0, 10)} 23:59`, max_attempts: '3', bonus_points: '30' }}
      onSubmit={async (v) => {
        const due = fromVn(String(v.due_at));
        if (!due) throw new Error('Nhập hạn nộp theo dạng 2026-11-20 23:59 (giờ Việt Nam).');
        await classroom.createAssignment(session.token, Number(v.class_id), { title: String(v.title).trim(), kind: 'quiz', quiz_id: quiz.id, audience: 'class', due_at: due, max_attempts: Number(v.max_attempts) || 1, bonus_points: Number(v.bonus_points) || 0 });
        toast('Đã giao bài cho lớp');
        onClose();
      }} />
  );
};

/** Mục trong danh sách câu: kéo thả trên web để đổi thứ tự */
const DragRow: React.FC<{ index: number; onMove: (from: number, to: number) => void; children: React.ReactNode }> = ({ index, onMove, children }) => {
  if (Platform.OS !== 'web') return <>{children}</>;
  return React.createElement('div', {
    draggable: true, style: { cursor: 'grab' }, onDragStart: (e: React.DragEvent) => e.dataTransfer.setData('text/plain', String(index)),
    onDragOver: (e: React.DragEvent) => e.preventDefault(), onDrop: (e: React.DragEvent) => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from !== index) onMove(from, index); },
  }, children);
};

// ---------------------------------------------------------------------- trình soạn
export const QuizStudio: React.FC<{ session: Session; draftId: number; onClose: () => void; onOpenRoom?: (quizId: number) => void }> = ({ session, draftId, onClose, onOpenRoom }) => {
  const { c } = useTheme();
  const toast = useToast();
  const campaigns = useCampaignOptions(session);
  const [payload, setPayload] = useState<StudioPayload | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [sel, setSel] = useState(0);
  const [state, setState] = useState<{ kind: 'loading' | 'saved' | 'saving' | 'dirty' | 'error'; at?: string }>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [media, setMedia] = useState<'question' | 'cover' | null>(null);
  const [musicTick, setMusicTick] = useState(0);
  const [musicBusy, setMusicBusy] = useState(false);
  // Mọi hook phải nằm trước lệnh return sớm bên dưới: để sau thì lần dựng đầu (chưa có bản nháp) ít hook hơn lần sau và React báo lỗi #310 làm sập trình soạn
  const [aiModalOpen, setAiModalOpen] = useState(false);
  // Tệp nhạc đã tải lên của giáo viên (HK.GV.093): đặt trước lệnh return sớm để thứ tự hook không đổi
  const files = useLoad<MediaLibrary>(() => api.mediaLibrary(session.token, ''), [session.token, musicTick], session.expired);
  const [assign, setAssign] = useState<QuizDetail | null>(null);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    api.getStudioDraft(session.token, draftId).then((d: StudioDraft) => { if (alive) { setPayload(d.payload); setQuizId(d.quiz_id); setState({ kind: 'saved', at: d.updated_at }); } })
      .catch((e) => { if (alive) { setError(errorMessage(e)); setState({ kind: 'error' }); } });
    return () => { alive = false; };
  }, [session.token, draftId]);

  const save = useCallback(async (p: StudioPayload) => {
    setState({ kind: 'saving' });
    try { const r = await api.saveStudioDraft(session.token, draftId, p); setState({ kind: 'saved', at: r.updated_at }); } catch (e) { setState({ kind: 'error' }); setError(errorMessage(e)); }
  }, [session.token, draftId]);

  // Tự lưu bản nháp 1,2 giây sau lần sửa cuối
  useEffect(() => {
    if (!payload) return undefined;
    if (first.current) { first.current = false; return undefined; }
    setState((s) => (s.kind === 'saving' ? s : { kind: 'dirty', at: s.at }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(payload); }, 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!payload) return <Page><ErrorNote message={error} />{state.kind === 'loading' ? <Spinner label="Đang mở trình soạn Quiz…" /> : <Btn title="Quay lại" tone="giay" onPress={onClose} />}</Page>;
  const qs = payload.questions;
  const cur = qs[Math.min(sel, qs.length - 1)];
  const idx = qs.indexOf(cur);
  const set = (patch: Partial<StudioPayload>) => setPayload((p) => (p ? { ...p, ...patch } : p));
  // Tệp nhạc đã tải lên của giáo viên (HK.GV.093): chọn lại được mà không phải tải lại
  const uploadMusic = async () => {
    try {
      const picked = await pickFile([...FILE_KIND.audio.types]);
      if (!picked) return;
      setMusicBusy(true);
      const res = await api.uploadMedia(session.token, await readFileData(picked, 'audio'));
      setMusicTick((t) => t + 1);
      set({ theme: { bg: payload!.theme.bg, music: 'upload', music_url: res.url } });
      toast('Đã tải nhạc chờ lên');
    } catch (e) { toast(errorMessage(e)); } finally { setMusicBusy(false); }
  };
  const setQ = (patch: Partial<StudioQuestion>) => setPayload((p) => (p ? { ...p, questions: p.questions.map((x, i) => (i === idx ? { ...x, ...patch } : x)) } : p));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= qs.length) return;
    const next = [...qs];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    set({ questions: next });
    setSel(to);
  };
  const handleInsertAiQuestions = (newQuestions: GeneratedQuizQuestion[]) => {
    const converted: StudioQuestion[] = newQuestions.map((gq) => {
      const opts = [...gq.options];
      while (opts.length < 4) opts.push('');
      return {
        uid: newUid(),
        question_id: null,
        qtype: 'single' as const,
        prompt: gq.question,
        options: opts.slice(0, 4),
        correct: [Math.min(3, Math.max(0, gq.correct_index))],
        tf: true,
        seconds: 30,
        score_mode: 'standard' as const,
        image_url: null,
        video_url: null,
        explanation: gq.explanation ? `${gq.explanation} [${gq.curriculum_reference}]` : gq.curriculum_reference,
      };
    });
    let nextQs: StudioQuestion[];
    if (qs.length === 1 && !qs[0].prompt.trim() && qs[0].options.every((o) => !o.trim())) {
      nextQs = converted;
    } else {
      nextQs = [...qs, ...converted];
    }
    set({ questions: nextQs });
    setSel(qs.length === 1 && !qs[0].prompt.trim() ? 0 : qs.length);
  };
  const addQuestion = () => { set({ questions: [...qs, blankQuestion()] }); setSel(qs.length); };
  const copyQuestion = () => { set({ questions: [...qs.slice(0, idx + 1), { ...cur, uid: newUid(), question_id: null }, ...qs.slice(idx + 1)] }); setSel(idx + 1); };
  const removeQuestion = () => { const next = qs.filter((_, i) => i !== idx); set({ questions: next.length ? next : [blankQuestion()] }); setSel(Math.max(0, idx - 1)); setRemoving(false); };
  const changeType = (t: StudioQType) => setQ({ qtype: t, correct: t === 'poll' ? [] : t === 'single' ? (cur.correct.slice(0, 1).length ? cur.correct.slice(0, 1) : [0]) : cur.correct, ...(t === 'poll' ? { score_mode: 'none' as ScoreMode } : cur.qtype === 'poll' ? { score_mode: 'standard' as ScoreMode } : {}) });
  const toggleCorrect = (i: number) => {
    if (cur.qtype === 'single') setQ({ correct: [i] });
    else setQ({ correct: cur.correct.includes(i) ? cur.correct.filter((x) => x !== i) : [...cur.correct, i].sort() });
  };

  const commit = async (): Promise<QuizDetail | null> => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    setError(null);
    try {
      await api.saveStudioDraft(session.token, draftId, payload);
      const res = await api.commitStudio(session.token, draftId);
      setPayload(res.draft.payload);
      setQuizId(res.quiz.id);
      first.current = true;
      setState({ kind: 'saved', at: new Date().toISOString() });
      return res.quiz;
    } catch (e) {
      const msg = errorMessage(e);
      const n = /^Câu (\d+):/.exec(msg);
      if (n) setSel(Math.min(qs.length - 1, Number(n[1]) - 1));
      setError(msg);
      return null;
    } finally { setBusy(false); }
  };
  const saveClose = async () => { const q = await commit(); if (q) { toast('Đã lưu Quiz vào ngân hàng câu hỏi và bộ đề'); await api.deleteStudio(session.token, draftId).catch(() => undefined); onClose(); } };
  const toRoom = async () => { const q = await commit(); if (q && onOpenRoom) onOpenRoom(q.id); };
  const toAssign = async () => { const q = await commit(); if (q) setAssign(q); };

  const bgSpec = LIVE_BACKGROUNDS.find((b) => b.id === payload.theme.bg) ?? LIVE_BACKGROUNDS[0];
  const problems = qs.map(problemOf);
  const statusText = state.kind === 'saving' ? 'Đang lưu nháp…' : state.kind === 'dirty' ? 'Có thay đổi chưa lưu nháp' : state.kind === 'error' ? 'Chưa lưu được nháp' : state.at ? `Đã lưu nháp lúc ${hhmm(state.at)}` : '';

  return (
    <Page>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <Field label="Tên Quiz" value={payload.title} onChangeText={(v) => set({ title: v })} placeholder="Ví dụ: Ba lần kháng chiến chống Nguyên – Mông" style={{ flexGrow: 3, flexBasis: 260 }} nativeID="studio-title" maxLength={160} />
        <Btn icon={ImagePlus} title={payload.cover_url ? 'Đổi ảnh bìa' : 'Ảnh bìa'} tone="giay" size="sm" onPress={() => setMedia('cover')} testID="studio-cover" />
        {payload.cover_url ? <Image source={{ uri: mediaUri(payload.cover_url) }} accessibilityLabel="Ảnh bìa Quiz" style={{ width: 64, height: 44, borderRadius: 8, backgroundColor: c.giay2 }} /> : null}
      </View>
      <Field label="Mô tả" value={payload.description} onChangeText={(v) => set({ description: v })} multiline numberOfLines={2} inputStyle={{ minHeight: 56, textAlignVertical: 'top' }} maxLength={1000} nativeID="studio-description" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip text={statusText} bg={state.kind === 'error' ? c.sonNhat : state.kind === 'saved' ? c.ngocNhat : c.vangNhat} fg={state.kind === 'error' ? c.sonChu : state.kind === 'saved' ? c.ngocChu : c.vangChu} />
        <Btn icon={preview ? Pencil : Eye} title={preview ? 'Quay lại soạn' : 'Xem trước như học sinh'} tone="giay" size="sm" onPress={() => { setPreview(!preview); setReveal(false); }} testID="studio-preview" />
        <Btn icon={Save} title="Lưu Quiz" tone="son" size="sm" loading={busy} onPress={saveClose} testID="studio-save" />
        {onOpenRoom ? <Btn icon={Radio} title="Tổ chức thi đấu" tone="ngoc" size="sm" disabled={busy} onPress={toRoom} testID="studio-live" /> : null}
        <Btn icon={Send} title="Giao bài" tone="ngoc" size="sm" disabled={busy} onPress={toAssign} testID="studio-assign" />
        <Btn icon={X} title="Đóng (giữ bản nháp)" tone="giay" size="sm" disabled={busy} onPress={() => { void save(payload).then(onClose); }} testID="studio-close" />
      </View>
      <ErrorNote message={error} />
      {quizId ? <InfoNote>Quiz đã lưu và dùng chung dữ liệu với ngân hàng câu hỏi và bộ đề. Sửa xong bấm “Lưu Quiz” để cập nhật; Quiz đã giao hoặc đã có học sinh làm thì khóa chỉnh sửa (hãy nhân bản ở mục Bộ đề).</InfoNote> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {/* cột trái: danh sách câu (HK.GV.086) */}
        <View style={{ flexGrow: 1, flexBasis: 230, maxWidth: 320, gap: 8 }} testID="studio-list">
          <Txt f="bold" size={15}>Các câu hỏi ({qs.length})</Txt>
          {qs.map((q, i) => (
            <DragRow key={q.uid} index={i} onMove={move}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: i === idx }} accessibilityLabel={`Câu ${i + 1}, ${QTYPE_TEXT[q.qtype]}, ${q.seconds} giây${problems[i] ? `, chưa hoàn chỉnh: ${problems[i]}` : ''}`} onPress={() => setSel(i)} testID={`studio-q-${i}`}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 8, minHeight: 56, borderRadius: 12, borderWidth: 2, borderColor: i === idx ? c.son : problems[i] ? c.vangDam : c.vien, backgroundColor: pressed ? c.the2 : c.the })}>
                {Platform.OS === 'web' ? <GripVertical size={16} color={c.muc3} /> : null}
                <Txt f="displayHeavy" size={18} style={{ width: 26 }}>{i + 1}</Txt>
                {q.image_url ? <Image source={{ uri: mediaUri(q.image_url) }} accessibilityLabel="" style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: c.giay2 }} /> : null}
                <View style={{ flex: 1 }}>
                  <Txt size={13} numberOfLines={2}>{q.prompt.trim() || 'Chưa có nội dung'}</Txt>
                  <Txt size={11} color={problems[i] ? c.vangChu : c.muc3}>{problems[i] ?? `${QTYPE_TEXT[q.qtype]} · ${q.seconds}s · ${q.score_mode === 'none' ? 'không điểm' : q.score_mode === 'double' ? 'x2 điểm' : '1000 điểm'}`}</Txt>
                </View>
              </Pressable>
            </DragRow>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Btn icon={Plus} title="Thêm câu" tone="son" size="sm" onPress={addQuestion} disabled={qs.length >= 50} testID="studio-add" />
            <Btn icon={Sparkles} title="Soạn bằng AI" tone="ngoc" size="sm" onPress={() => setAiModalOpen(true)} disabled={qs.length >= 50} testID="studio-ai" />
            <Btn icon={Copy} label="Sao chép câu này" tone="giay" size="sm" onPress={copyQuestion} disabled={qs.length >= 50} testID="studio-copy" />
            <Btn icon={ArrowUp} label="Đưa câu lên" tone="giay" size="sm" onPress={() => move(idx, idx - 1)} disabled={idx === 0} testID="studio-up" />
            <Btn icon={ArrowDown} label="Đưa câu xuống" tone="giay" size="sm" onPress={() => move(idx, idx + 1)} disabled={idx === qs.length - 1} testID="studio-down" />
            <Btn icon={Trash2} label="Xóa câu này" tone="giay" size="sm" onPress={() => setRemoving(true)} testID="studio-delete" />
          </View>
        </View>

        {/* giữa: nhập câu hỏi hoặc xem trước (HK.GV.087) */}
        <View style={{ flexGrow: 3, flexBasis: 360, gap: 12, minWidth: 280 }} testID="studio-editor">
          {preview ? (
            <Card pad={16} style={{ gap: 12, backgroundColor: bgSpec.bg ?? c.the }}>
              <Txt size={13} color={bgSpec.bg ? '#ffffff' : c.muc3}>Xem trước câu {idx + 1}/{qs.length} · {cur.seconds} giây · {SCORE_TEXT[cur.score_mode]}</Txt>
              <Card style={{ gap: 8 }}>
                <Txt f="displayHeavy" size={24} accessibilityRole="header">{cur.prompt || 'Chưa có nội dung câu hỏi'}</Txt>
                <MediaView image={cur.image_url} video={cur.video_url} label={cur.prompt} />
              </Card>
              <View style={{ gap: 8 }}>
                {(cur.qtype === 'truefalse' ? ['Đúng', 'Sai'] : cur.options).map((text, i) => (text.trim() || cur.qtype === 'truefalse' ? (
                  <LiveChoice key={i} index={i} text={text} revealed={reveal && cur.qtype !== 'poll'} correct={cur.qtype === 'truefalse' ? (i === 0) === cur.tf : cur.correct.includes(i)} />
                ) : null))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {cur.qtype === 'poll' ? null : <Btn title={reveal ? 'Ẩn đáp án đúng' : 'Hiện đáp án đúng'} tone="giay" size="sm" onPress={() => setReveal(!reveal)} />}
                <Btn icon={ArrowUp} label="Câu trước" tone="giay" size="sm" disabled={idx === 0} onPress={() => { setSel(idx - 1); setReveal(false); }} />
                <Btn icon={ArrowDown} label="Câu sau" tone="giay" size="sm" disabled={idx === qs.length - 1} onPress={() => { setSel(idx + 1); setReveal(false); }} />
              </View>
              {reveal && cur.explanation ? <InfoNote>{cur.explanation}</InfoNote> : null}
            </Card>
          ) : (
            <>
              <Field label={`Câu ${idx + 1}: Bắt đầu nhập câu hỏi`} value={cur.prompt} onChangeText={(v) => setQ({ prompt: v })} multiline numberOfLines={3} inputStyle={{ minHeight: 84, textAlignVertical: 'top', fontSize: 18 }} maxLength={1000} nativeID="studio-prompt" />
              <View style={{ gap: 8 }}>
                {cur.image_url || cur.video_url ? <MediaView image={cur.image_url} video={cur.video_url} label={cur.prompt} height={180} /> : null}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Btn icon={ImagePlus} title={cur.image_url || cur.video_url ? 'Thay ảnh / video' : 'Tìm và chèn phương tiện truyền thông'} tone="giay" size="sm" onPress={() => setMedia('question')} testID="studio-media" />
                  {cur.image_url || cur.video_url ? <Btn icon={Trash2} title="Xóa ảnh / video" tone="giay" size="sm" onPress={() => setQ({ image_url: null, video_url: null })} testID="studio-media-clear" /> : null}
                </View>
              </View>
              {cur.qtype === 'truefalse' ? (
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  {[true, false].map((v, i) => (
                    <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: cur.tf === v }} accessibilityLabel={`${v ? 'Đúng' : 'Sai'}${cur.tf === v ? ', là đáp án đúng' : ''}`} onPress={() => setQ({ tf: v })} testID={`studio-tf-${v ? 'true' : 'false'}`}
                      style={{ flexGrow: 1, flexBasis: 200, minHeight: 84, borderRadius: 16, borderWidth: 3, borderColor: cur.tf === v ? c.muc : c[SHAPE_COLOR[i]], backgroundColor: c[SHAPE_COLOR[i]], alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
                      <Txt f="displayHeavy" size={26} color="#ffffff">{SHAPE_MARK[i]} {v ? 'Đúng' : 'Sai'}</Txt>
                      {cur.tf === v ? <Check size={28} color="#ffffff" /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {cur.qtype === 'poll' ? <Txt size={13} color={c.muc2} style={{ width: '100%' }}>Bình chọn không có đáp án đúng: không tính điểm, mỗi học sinh chọn một lựa chọn và cả lớp xem kết quả. Chỉ dùng khi thi đấu trực tiếp.</Txt> : null}
                  {cur.options.map((text, i) => (
                    <View key={i} style={{ flexGrow: 1, flexBasis: 240, borderRadius: 14, borderWidth: 3, borderColor: c[SHAPE_COLOR[i]], backgroundColor: c.the, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8, overflow: 'hidden' }}>
                      <View style={{ width: 44, alignSelf: 'stretch', backgroundColor: c[SHAPE_COLOR[i]], alignItems: 'center', justifyContent: 'center' }}><Txt f="displayHeavy" size={22} color="#ffffff">{SHAPE_MARK[i]}</Txt></View>
                      <Field label={`${cur.qtype === 'poll' ? 'Lựa chọn' : 'Đáp án'} ${i + 1}${i < 2 ? ' (bắt buộc)' : ' (không bắt buộc)'}`} value={text} onChangeText={(v) => setQ({ options: cur.options.map((o, j) => (j === i ? v : o)) })} style={{ flex: 1 }} maxLength={200} nativeID={`studio-option-${i}`} />
                      {cur.qtype === 'poll' ? null : (
                      <Pressable accessibilityRole={cur.qtype === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ checked: cur.correct.includes(i) }} accessibilityLabel={`Đánh dấu đáp án ${i + 1} là đáp án đúng`} onPress={() => toggleCorrect(i)} hitSlop={6} testID={`studio-correct-${i}`}
                        style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: cur.correct.includes(i) ? c.ngocChu : c.vien2, backgroundColor: cur.correct.includes(i) ? c.ngoc : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {cur.correct.includes(i) ? <Check size={24} color="#ffffff" /> : null}
                      </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <Field label="Giải thích đáp án (hiện sau khi trả lời, không bắt buộc)" value={cur.explanation} onChangeText={(v) => setQ({ explanation: v })} multiline numberOfLines={2} inputStyle={{ minHeight: 56, textAlignVertical: 'top' }} maxLength={2000} nativeID="studio-explanation" />
            </>
          )}
        </View>

        {/* cột phải: thiết lập (HK.GV.088–091, 093) */}
        <View style={{ flexGrow: 1, flexBasis: 250, maxWidth: 340, gap: 12 }} testID="studio-settings">
          <Card flat pad={12} style={{ gap: 8 }}>
            <Txt f="bold" size={15}>Loại câu hỏi</Txt>
            <Segmented<StudioQType> label="Loại câu hỏi" value={cur.qtype === 'truefalse' ? 'truefalse' : cur.qtype === 'poll' ? 'poll' : 'single'} onChange={(v) => changeType(v === 'truefalse' || v === 'poll' ? v : cur.qtype === 'multiple' ? 'multiple' : 'single')} options={[{ value: 'single', label: 'Trắc nghiệm' }, { value: 'truefalse', label: 'Đúng / Sai' }, { value: 'poll', label: 'Bình chọn' }]} />
            {cur.qtype !== 'truefalse' && cur.qtype !== 'poll' ? (
              <>
                <Txt f="bold" size={15}>Phương án trả lời</Txt>
                <Segmented<StudioQType> label="Phương án trả lời" value={cur.qtype} onChange={changeType} options={[{ value: 'single', label: 'Một đáp án' }, { value: 'multiple', label: 'Nhiều đáp án' }]} />
                {cur.qtype === 'multiple' ? <Txt size={12} color={c.muc3}>Học sinh phải chọn đúng và đủ các đáp án đúng mới được điểm.</Txt> : null}
              </>
            ) : null}
          </Card>
          <Card flat pad={12} style={{ gap: 8 }}>
            <AdminSelect label="Giới hạn thời gian trả lời" value={String(cur.seconds)} onChange={(v) => setQ({ seconds: Number(v) })} testID="studio-seconds" options={STUDIO_SECONDS.map((s) => ({ value: String(s), label: `${s} giây${s === 20 ? ' (mặc định)' : ''}` }))} />
            <Btn title="Áp dụng cho tất cả câu hỏi" tone="giay" size="sm" onPress={() => { set({ questions: qs.map((x) => ({ ...x, seconds: cur.seconds })) }); toast(`Đã đặt ${cur.seconds} giây cho cả ${qs.length} câu`); }} testID="studio-seconds-all" />
            <Txt f="bold" size={15}>Điểm của câu</Txt>
            {cur.qtype === 'poll' ? <Txt size={13} color={c.muc3}>Câu bình chọn không có đáp án đúng nên không tính điểm.</Txt> : (
            <Segmented<ScoreMode> label="Điểm của câu" value={cur.score_mode} onChange={(v) => setQ({ score_mode: v })} options={[{ value: 'standard', label: '1000' }, { value: 'double', label: 'Gấp đôi' }, { value: 'none', label: 'Không điểm' }]} />
            )}
            <Txt size={12} color={c.muc3}>{SCORE_TEXT[cur.score_mode]}; trả lời càng nhanh điểm thực nhận càng cao (từ 50% đến 100%).</Txt>
          </Card>
          <Card flat pad={12} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Palette size={18} color={c.muc2} /><Txt f="bold" size={15}>Giao diện</Txt></View>
            <Txt size={13} color={c.muc2}>Nền (hiện ở màn hình chiếu khi thi đấu)</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {LIVE_BACKGROUNDS.map((b) => <Btn key={b.id} title={b.label} tone={payload.theme.bg === b.id ? 'son' : 'giay'} size="sm" onPress={() => set({ theme: { ...payload.theme, bg: b.id } })} testID={`studio-bg-${b.id}`} />)}
            </View>
            <Txt size={13} color={c.muc2}>Nhạc chờ (phòng chờ thi đấu)</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {LIVE_MUSIC.map((m) => <Btn key={m.id} title={m.label} tone={payload.theme.music === m.id ? 'son' : 'giay'} size="sm" onPress={() => set({ theme: { bg: payload.theme.bg, music: m.id } })} testID={`studio-music-${m.id}`} />)}
            </View>
            <Txt size={13} color={c.muc2}>Hoặc dùng tệp nhạc của em: {FILE_KIND.audio.hint}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(files.data?.audios ?? []).map((a) => <Btn key={a.token} title={a.name ?? 'Nhạc tải lên'} tone={payload.theme.music === 'upload' && payload.theme.music_url === a.url ? 'son' : 'giay'} size="sm" onPress={() => set({ theme: { bg: payload.theme.bg, music: 'upload', music_url: a.url } })} testID={`studio-music-file-${a.token}`} />)}
              <Btn icon={ImagePlus} title="Tải nhạc lên" tone="giay" size="sm" loading={musicBusy} onPress={uploadMusic} testID="studio-music-upload" />
            </View>
            {payload.theme.music === 'upload' && payload.theme.music_url && Platform.OS === 'web' ? React.createElement('audio', { src: mediaUri(payload.theme.music_url), controls: true, preload: 'none', 'aria-label': 'Nghe thử nhạc chờ', style: { width: '100%' } }) : null}
          </Card>
          <Card flat pad={12} style={{ gap: 8 }}>
            <AdminSelect label="Chủ đề lịch sử" value={payload.campaign_id ? String(payload.campaign_id) : ''} options={campaigns} onChange={(v) => set({ campaign_id: v ? Number(v) : null })} />
            <ToggleRow icon={Radio} checked={payload.shuffle_questions} onChange={(v) => set({ shuffle_questions: v })} label="Xáo thứ tự câu hỏi" desc="Mỗi lượt thi / làm bài có thứ tự câu khác nhau" />
            <ToggleRow icon={Radio} checked={payload.shuffle_options} onChange={(v) => set({ shuffle_options: v })} label="Xáo thứ tự đáp án" desc="Hình – màu của đáp án đi theo đáp án" />
          </Card>
        </View>
      </View>

      <ConfirmSheet open={removing} title={`Xóa câu ${idx + 1}?`} message="Câu hỏi bị gỡ khỏi Quiz này. Nếu đã lưu trước đó, câu vẫn còn trong ngân hàng câu hỏi." confirmLabel="Xóa câu" onCancel={() => setRemoving(false)} onConfirm={removeQuestion} />
      {media ? <MediaSheet session={session} target={media} initial={media === 'cover' ? { image: payload.cover_url, video: null } : { image: cur.image_url, video: cur.video_url }} onClose={() => setMedia(null)}
        onPick={(image, video) => { if (media === 'cover') set({ cover_url: image }); else setQ({ image_url: image, video_url: video }); setMedia(null); }} /> : null}
            {aiModalOpen ? (
        <AiQuizModal
          open={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          session={session}
          onInsertQuestions={handleInsertAiQuestions}
        />
      ) : null}
      {assign ? <AssignSheet session={session} quiz={assign} onClose={() => setAssign(null)} /> : null}
    </Page>
  );
};
