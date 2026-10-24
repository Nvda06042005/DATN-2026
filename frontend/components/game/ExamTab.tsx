/**
 * Quốc Tử Giám: khảo thí (luyện nhanh, theo chủ đề, ôn điểm yếu theo BKT, đề do Quân Sư AI soạn), Tháp Khảo Thí 10 tầng,
 * chủ đề cần củng cố (gợi ý của mô hình BKT) và lối vào phòng thi đấu cả lớp.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { BookOpen, Brain, Building2, Check, ChevronRight, Flame, Landmark, Layers, Radio, Snowflake, Sparkles, Stamp, Target, Trophy, Zap } from 'lucide-react-native';
import * as studentApi from '@/api/studentApi';
import { QuizPanel } from '@/components/game/quiz';
import { Bar, Btn, Card, InfoNote, PressCard, SectionTitle, Sheet, Skeleton, Txt } from '@/components/ui';
import { CATEGORY_LABEL, CATEGORY_ORDER, RELICS, TOWER_FLOORS } from '@/constants/game';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { fmt, pct } from '@/lib/format';
import type { QuestionRequest, Recommendation } from '@/types/api';
import type { IconType } from '@/types/game';

type Quiz = { title: string; subtitle?: string; req: QuestionRequest; pass?: number; kind: 'practice' | 'tower'; floor?: number; timer?: boolean };

export const ExamTab: React.FC = () => {
  const { state, update, progress, codex, request, reward, toast, openLive } = useGame();
  const { c } = useTheme();
  const [panel, setPanel] = useState<null | { mode: 'topics' } | { mode: 'quiz'; quiz: Quiz }>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);

  useEffect(() => {
    let alive = true;
    request((t) => studentApi.getRecommendations(t, 4))
      .then((r) => alive && setRecs(r.recommendations ?? []))
      .catch(() => alive && setRecs([]));
    return () => {
      alive = false;
    };
  }, [request, progress.questions_answered]);

  const byCategory = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const e of codex) (m[e.category] ??= []).push(e.unit_id);
    return m;
  }, [codex]);
  const nextFloor = TOWER_FLOORS[Math.min(9, state.tower)];
  const quiz = (q: Quiz) => setPanel({ mode: 'quiz', quiz: q });

  const modes: Array<{ id: string; title: string; desc: string; icon: IconType; color: string; onPress: () => void }> = [
    { id: 'quick', title: 'Luyện nhanh', desc: '5 câu ngẫu nhiên, khoảng 2 phút.', icon: Zap, color: c.son, onPress: () => quiz({ title: 'Luyện nhanh', subtitle: '5 câu về ba lần kháng chiến', req: { count: 5 }, kind: 'practice', timer: true }) },
    { id: 'topic', title: 'Theo chủ đề', desc: 'Chọn một chủ đề trong bài học để luyện.', icon: Layers, color: c.thuy, onPress: () => setPanel({ mode: 'topics' }) },
    {
      id: 'weak', title: 'Ôn điểm yếu', desc: 'Câu hỏi thuộc các chủ đề em cần củng cố (theo BKT). Ấn Tín thưởng cao hơn.', icon: Target, color: c.ngoc,
      onPress: () => quiz({ title: 'Ôn điểm yếu', subtitle: 'Câu hỏi chọn theo mức nắm vững của em', req: { count: 5, mode: 'weak' }, kind: 'practice' }),
    },
    {
      id: 'ai', title: 'Đề của Quân Sư AI', desc: 'Quân Sư soạn 3 câu mới từ kho tri thức (RAG).', icon: Sparkles, color: c.thong,
      onPress: () => quiz({ title: 'Đề của Quân Sư AI', subtitle: 'Câu hỏi do AI soạn, server chấm', req: { count: 3, ai: true }, kind: 'practice' }),
    },
  ];

  const onFinish = (q: Quiz, sum: { correct: number; passed: boolean }) => {
    if (q.kind !== 'tower' || !q.floor) {
      if (sum.correct > 0) reward(sum.correct * 3, 0);
      return;
    }
    if (!sum.passed) return toast(`Chưa vượt tầng ${q.floor}. Thử lại nhé – câu hỏi sẽ khác!`);
    const f = TOWER_FLOORS[q.floor - 1];
    const firstTime = state.tower < f.floor;
    update((s) => ({ ...s, tower: Math.max(s.tower, f.floor), relics: f.relic && !s.relics.includes(f.relic) ? [...s.relics, f.relic] : s.relics }));
    if (firstTime) reward(f.luong, 2);
    toast(firstTime ? `Vượt tầng ${f.floor}! +${fmt(f.luong)} Lương Thảo${f.relic ? `, nhận cổ vật ${RELICS[f.relic].name}` : ''}` : `Đã vượt lại tầng ${f.floor}`);
  };

  return (
    <View style={{ gap: 16 }}>
      <SectionTitle title="Quốc Tử Giám" subtitle="Khảo thí – trả lời đúng để nhận Ấn Tín, Lương Thảo và XP" />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center' }}>
          <Radio size={28} color="#ffffff" />
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Txt f="displayHeavy" size={18} accessibilityRole="header">
            Thi đấu cả lớp
          </Txt>
          <Txt size={14} color={c.muc2}>
            Thầy cô mở phòng và đọc mã PIN – em nhập mã để thi đấu trực tiếp cùng cả lớp. Trả lời đúng và nhanh để giành điểm cao.
          </Txt>
        </View>
        <Btn title="Vào phòng" icon={Radio} size="lg" onPress={() => openLive()} testID="open-live" />
      </Card>

      <Txt f="displayHeavy" size={18}>
        Chế độ khảo thí
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <PressCard key={m.id} onPress={m.onPress} label={m.title} hint={m.desc} style={{ flexGrow: 1, flexBasis: 200, minHeight: 150, gap: 8 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} color="#ffffff" />
              </View>
              <Txt f="displayHeavy" size={18}>
                {m.title}
              </Txt>
              <Txt size={14} color={c.muc2}>
                {m.desc}
              </Txt>
            </PressCard>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Card style={{ flexGrow: 1, flexBasis: 200, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Stamp size={16} color={c.dongChu} />
            <Txt f="semibold" size={14} color={c.muc2}>
              Ấn Tín hôm nay
            </Txt>
          </View>
          <Txt f="displayHeavy" size={24}>
            {progress.day_gems}/{progress.daily_gem_cap}
          </Txt>
          <Bar value={progress.day_gems} max={progress.daily_gem_cap} fill={c.dong} label="Ấn Tín đã nhận hôm nay" />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 200, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={c.ngocChu} />
            <Txt f="semibold" size={14} color={c.muc2}>
              Độ chính xác
            </Txt>
          </View>
          <Txt f="displayHeavy" size={24}>
            {pct(progress.accuracy)}
          </Txt>
          <Txt size={14} color={c.muc2}>
            {progress.questions_correct}/{progress.questions_answered} câu · hôm nay {progress.day_correct} câu đúng
          </Txt>
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 200, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flame size={16} color={c.hoaChu} />
            <Txt f="semibold" size={14} color={c.muc2}>
              Chuỗi ngày học
            </Txt>
          </View>
          <Txt f="displayHeavy" size={24}>
            {progress.streak} ngày
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Snowflake size={14} color={c.muc2} />
            <Txt size={14} color={c.muc2}>
              {progress.freeze_available ? 'Còn 1 ngày nghỉ phép tuần này' : 'Đã dùng ngày nghỉ phép tuần này'}
            </Txt>
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 6, flexBasis: 320, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={24} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt f="displayHeavy" size={18} accessibilityRole="header">
                Tháp Khảo Thí
              </Txt>
              <Txt size={14} color={c.muc2}>
                10 tầng, khó dần từ Nhận biết đến Vận dụng. Tầng 5 và 10 là Đình thí.
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityLabel="Các tầng tháp">
            {TOWER_FLOORS.map((f) => {
              const cleared = state.tower >= f.floor;
              const current = state.tower + 1 === f.floor;
              return (
                <View
                  key={f.floor}
                  accessible
                  accessibilityLabel={`Tầng ${f.floor}${f.boss ? ' (Đình thí)' : ''}${cleared ? ', đã vượt' : current ? ', tầng hiện tại' : ''}`}
                  style={{
                    width: '17.5%', aspectRatio: 1, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: cleared ? c.ngoc : current ? c.dongNhat : c.giay2, borderColor: cleared ? c.ngocDam : current ? c.dong : c.vien,
                  }}
                >
                  {f.boss && <Trophy size={14} color={cleared ? '#ffffff' : current ? c.dongChu : c.muc3} />}
                  <Txt f="displayHeavy" size={16} color={cleared ? '#ffffff' : current ? c.dongChu : c.muc3}>
                    {f.floor}
                  </Txt>
                </View>
              );
            })}
          </View>
          {state.tower >= 10 ? (
            <Txt f="semibold" color={c.ngocChu}>
              Em đã chinh phục cả 10 tầng! Có thể thử lại tầng 10 để luyện thêm.
            </Txt>
          ) : (
            <Txt size={14} color={c.muc2}>
              Tầng {nextFloor.floor}: {nextFloor.count} câu mức {nextFloor.levelText}, cần đúng {nextFloor.pass}. Thưởng {fmt(nextFloor.luong)} Lương Thảo
              {nextFloor.relic ? ` và cổ vật ${RELICS[nextFloor.relic].name}` : ''}.
            </Txt>
          )}
          <Btn
            title={state.tower >= 10 ? 'Thử lại tầng 10' : `Leo tầng ${nextFloor.floor}`}
            icon={Building2}
            size="lg"
            full
            onPress={() =>
              quiz({
                title: `Tháp Khảo Thí – Tầng ${nextFloor.floor}${nextFloor.boss ? ' (Đình thí)' : ''}`,
                subtitle: `Mức ${nextFloor.levelText} · cần đúng ${nextFloor.pass}/${nextFloor.count}`,
                req: { count: nextFloor.count, levels: nextFloor.levels },
                pass: nextFloor.pass,
                kind: 'tower',
                floor: nextFloor.floor,
                timer: true,
              })
            }
          />
          <Txt size={12} color={c.muc2}>
            Trả lời sai không bị rớt tầng – chỉ dừng lượt, em thử lại khi sẵn sàng.
          </Txt>
        </Card>

        <Card style={{ flexGrow: 5, flexBasis: 300, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Brain size={20} color={c.ngocChu} />
            <Txt f="displayHeavy" size={18} accessibilityRole="header">
              Chủ đề cần củng cố
            </Txt>
          </View>
          {recs === null ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
            </View>
          ) : recs.length === 0 ? (
            <Txt size={14} color={c.muc2}>
              Em đang nắm vững các chủ đề đã học. Tiếp tục khảo thí để mở rộng nhé!
            </Txt>
          ) : (
            recs.map((r) => (
              <Card key={r.unit_id} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt f="semibold">{r.topic}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Bar value={r.current_mastery} max={1} fill={r.current_mastery >= 0.6 ? c.ngoc : c.dong} height={8} style={{ flex: 1 }} label={`Mức nắm vững ${r.topic}`} />
                    <Txt f="bold" size={12} color={c.muc2}>
                      {Math.round(r.current_mastery * 100)}%
                    </Txt>
                  </View>
                </View>
                <Btn title="Ôn" iconRight={ChevronRight} tone="giay" size="sm" label={`Ôn chủ đề ${r.topic}`} onPress={() => quiz({ title: 'Ôn chủ đề', subtitle: r.topic, req: { units: [r.unit_id], count: 3 }, kind: 'practice' })} />
              </Card>
            ))
          )}
          <InfoNote>Mức nắm vững tính bằng mô hình Bayesian Knowledge Tracing (BKT) từ các câu em đã trả lời.</InfoNote>
        </Card>
      </View>
      <InfoNote>Quốc Tử Giám được dựng từ năm 1076 (thời Lý) và tiếp tục được coi trọng dưới thời Trần.</InfoNote>

      <Sheet
        open={!!panel}
        onClose={() => setPanel(null)}
        wide={panel?.mode === 'quiz'}
        title={panel?.mode === 'quiz' ? panel.quiz.title : 'Luyện theo chủ đề'}
        subtitle={panel?.mode === 'quiz' ? panel.quiz.subtitle : 'Chọn một chủ đề trong bài học'}
      >
        {panel?.mode === 'topics' &&
          CATEGORY_ORDER.filter((cat) => byCategory[cat]?.length).map((cat) => (
            <PressCard
              key={cat}
              pad={14}
              label={CATEGORY_LABEL[cat]}
              onPress={() => quiz({ title: 'Luyện theo chủ đề', subtitle: CATEGORY_LABEL[cat], req: { units: byCategory[cat], count: 5 }, kind: 'practice', timer: true })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <BookOpen size={20} color={c.ngocChu} />
              <Txt f="semibold" style={{ flex: 1 }}>
                {CATEGORY_LABEL[cat]}
              </Txt>
              <ChevronRight size={20} color={c.muc3} />
            </PressCard>
          ))}
        {panel?.mode === 'quiz' && (
          <QuizPanel
            key={`${panel.quiz.title}-${panel.quiz.subtitle}`}
            request={panel.quiz.req}
            passMark={panel.quiz.pass}
            timer={panel.quiz.timer}
            sessionKind={panel.quiz.kind}
            onClose={() => setPanel(null)}
            onFinish={(sum) => onFinish(panel.quiz, sum)}
          />
        )}
      </Sheet>
    </View>
  );
};
