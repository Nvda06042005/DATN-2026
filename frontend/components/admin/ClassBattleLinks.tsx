/**
 * Gắn cửa học với trận đánh trên bản đồ hành quân của lớp (HK.GV.083): với mỗi trận, giáo viên chọn cửa học sinh của lớp phải hoàn thành mới được ra trận,
 * độ khó của trận (thay độ khó gốc của màn chơi) và bật / tắt câu hỏi kích hoạt tuyệt kỹ. Không chọn gì thì trận giữ nguyên cách mở như hành trình học.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Swords } from 'lucide-react-native';
import * as war from '@/api/warApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, InfoNote, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDetail } from '@/types/classroom';

interface Draft { gate: string; difficulty: string; skill: boolean }
const LEVELS = [{ value: '', label: 'Theo độ khó gốc của màn' }, { value: '1', label: '1 – Dễ' }, { value: '2', label: '2 – Vừa' }, { value: '3', label: '3 – Khó' }];

export const ClassBattleLinks: React.FC<{ session: Session; cls: ClassDetail }> = ({ session, cls }) => {
  const { c } = useTheme();
  const opts = useLoad(() => war.classBattleLinks(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [draft, setDraft] = useState<Record<number, Draft>>({});
  useEffect(() => {
    if (!opts.data) return;
    setDraft(Object.fromEntries(opts.data.stages.map((s) => {
      const l = opts.data!.links.find((x) => x.stage_id === s.id);
      return [s.id, { gate: l?.gate_id ? String(l.gate_id) : '', difficulty: l?.difficulty ? String(l.difficulty) : '', skill: l ? l.skill_questions : true }];
    })));
  }, [opts.data]);
  const set = (id: number, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const gateOptions = [{ value: '', label: 'Không đòi hỏi cửa (mở theo hành trình)' }, ...(opts.data?.gates ?? []).map((g) => ({ value: String(g.id), label: `${g.journey_title} – Cửa ${g.position}: ${g.title}` }))];
  const save = async () => {
    const links = Object.entries(draft).filter(([, d]) => d.gate || d.difficulty || !d.skill).map(([id, d]) => ({ stage_id: Number(id), gate_id: d.gate ? Number(d.gate) : null, difficulty: d.difficulty ? Number(d.difficulty) : null, skill_questions: d.skill }));
    const next = await run(() => war.saveClassBattleLinks(session.token, cls.id, links), 'Đã lưu cấu hình trận đánh của lớp');
    if (next) opts.setData(next);
  };
  return (
    <View style={{ gap: 12 }}>
      <InfoNote>Chọn cửa học nào mở trận đánh nào trên bản đồ hành quân của lớp {cls.name}, độ khó của trận và việc bật / tắt câu hỏi kích hoạt tuyệt kỹ. Học sinh của lớp chưa xong cửa đã gắn sẽ thấy trận bị khóa kèm lý do.</InfoNote>
      <ErrorNote message={opts.error} />
      {opts.loading && !opts.data ? <Spinner /> : null}
      {opts.data && !opts.data.stages.length ? <EmptyState mood="thinking" title="Chưa có trận đánh nào được phát hành" text="Quản trị tổng cần phát hành màn chơi trước khi gắn với cửa học." /> : null}
      {opts.data?.stages.map((s) => {
        const d = draft[s.id];
        if (!d) return null;
        return (
          <Card key={s.id} flat pad={14} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Swords size={20} color={c.sonChu} />
              <Txt f="bold" size={16} style={{ flex: 1, minWidth: 160 }}>{s.title}</Txt>
              {s.year ? <Chip text={`Năm ${s.year}`} bg={c.thuyNhat} fg={c.thuyChu} /> : null}
              <Chip text={`Độ khó gốc ${s.difficulty}`} bg={c.dichNhat} fg={c.dich} />
              {s.point_name ? <Chip text={`Điểm đến: ${s.point_name}`} bg={c.ngocNhat} fg={c.ngocChu} /> : <Chip text="Chưa có trên bản đồ hành quân" bg={c.vangNhat} fg={c.vangChu} />}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flexGrow: 2, flexBasis: 260 }}><AdminSelect label="Cửa phải hoàn thành" value={d.gate} options={gateOptions} onChange={(v) => set(s.id, { gate: String(v) })} testID={`bl-gate-${s.id}`} /></View>
              <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="Độ khó của trận" value={d.difficulty} options={LEVELS} onChange={(v) => set(s.id, { difficulty: String(v) })} testID={`bl-level-${s.id}`} /></View>
            </View>
            <ToggleRow icon={Swords} checked={d.skill} onChange={(v) => set(s.id, { skill: v })} label="Câu hỏi kích hoạt tuyệt kỹ" desc={s.has_quiz ? 'Tắt thì tuyệt kỹ phát huy đủ mà học sinh không cần trả lời.' : 'Màn này chưa có bộ câu hỏi nên tuyệt kỹ luôn phát huy đủ.'} />
          </Card>
        );
      })}
      {opts.data?.stages.length ? <Btn title="Lưu cấu hình trận đánh" tone="son" loading={busy} disabled={!cls.is_active} onPress={save} testID="battle-links-save" /> : null}
    </View>
  );
};
