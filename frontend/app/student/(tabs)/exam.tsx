import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Brain, Building2, Check, ChevronRight, Flame, Landmark, Layers, Radio, Snowflake, Sparkles, Stamp,
  Target, Trophy, Zap
} from 'lucide-react';
import * as studentApi from '@/api/studentApi';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Bar } from '@/components/ui/progress-bar';
import { SectionTitle } from '@/components/ui/section-title';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABEL, CATEGORY_ORDER, TOWER_FLOORS } from '@/constants/game/exam';
import { RELICS } from '@/constants/game/relics';
import { useGame } from '@/hooks/use-game';
import type { QuestionRequest, Recommendation } from '@/types/learningType';
import { fmt, pct } from '@/utils/format';

export const ExamTab: React.FC = () => {
  const { state, update, progress, codex, request, reward, toast, openLive } = useGame();
  const [quiz, setQuiz] = useState<null | { title: string; subtitle?: string; req: QuestionRequest; pass?: number; kind: 'practice' | 'tower'; floor?: number; timer?: boolean }>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);

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

  const modes = [
    {
      id: 'quick',
      title: 'Luyện nhanh',
      desc: '5 câu ngẫu nhiên, khoảng 2 phút.',
      Icon: Zap,
      tone: 'bg-son',
      onClick: () => setQuiz({ title: 'Luyện nhanh', subtitle: '5 câu về ba lần kháng chiến', req: { count: 5 }, kind: 'practice', timer: true }),
    },
    { id: 'topic', title: 'Theo chủ đề', desc: 'Chọn một chủ đề trong bài học để luyện.', Icon: Layers, tone: 'bg-thuy', onClick: () => setTopicOpen(true) },
    {
      id: 'weak',
      title: 'Ôn điểm yếu',
      desc: 'Câu hỏi thuộc các chủ đề em cần củng cố (theo BKT). Ấn Tín thưởng cao hơn.',
      Icon: Target,
      tone: 'bg-ngoc',
      onClick: () => setQuiz({ title: 'Ôn điểm yếu', subtitle: 'Câu hỏi chọn theo mức nắm vững của em', req: { count: 5, mode: 'weak' }, kind: 'practice' }),
    },
    {
      id: 'ai',
      title: 'Đề của Quân Sư AI',
      desc: 'Quân Sư soạn 3 câu mới từ kho tri thức (RAG).',
      Icon: Sparkles,
      tone: 'bg-thong',
      onClick: () => setQuiz({ title: 'Đề của Quân Sư AI', subtitle: 'Câu hỏi do AI soạn, server chấm', req: { count: 3, ai: true }, kind: 'practice' }),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-5">
      <SectionTitle title="Quốc Tử Giám" subtitle="Khảo thí – trả lời đúng để nhận Ấn Tín, Lương Thảo và XP" />
      <section className="g-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4" aria-labelledby="live-entry-title">
        <span className="w-14 h-14 rounded-2xl bg-son text-white flex items-center justify-center shrink-0">
          <Radio className="w-7 h-7" aria-hidden={true} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 id="live-entry-title" className="font-display font-extrabold text-lg leading-tight">
            Thi đấu cả lớp
          </h3>
          <p className="text-sm text-muc-2">Thầy cô mở phòng và đọc mã PIN – em nhập mã để thi đấu trực tiếp cùng cả lớp. Trả lời đúng và nhanh để giành điểm cao.</p>
        </div>
        <GBtn size="lg" className="w-full sm:w-auto" onClick={() => openLive()}>
          <Radio className="w-5 h-5" aria-hidden={true} /> Vào phòng
        </GBtn>
      </section>
      <section>
        <h3 className="font-display font-extrabold text-lg mb-2">Chế độ khảo thí</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {modes.map((m) => (
            <button key={m.id} type="button" onClick={m.onClick} className="g-card p-4 text-left flex flex-col gap-2 hover:-translate-y-0.5 transition min-h-[150px]">
              <span className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center ${m.tone}`}>
                <m.Icon className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg leading-tight">{m.title}</p>
              <p className="text-sm text-muc-2">{m.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Stamp className="w-4 h-4 text-dong-chu" aria-hidden={true} /> Ấn Tín hôm nay
          </p>
          <p className="font-display font-extrabold text-2xl tabular">
            {progress.day_gems}/{progress.daily_gem_cap}
          </p>
          <Bar value={progress.day_gems} max={progress.daily_gem_cap} fill="bg-dong" label="Ấn Tín đã nhận hôm nay" className="mt-1" />
        </div>
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-ngoc-chu" aria-hidden={true} /> Độ chính xác
          </p>
          <p className="font-display font-extrabold text-2xl tabular">{pct(progress.accuracy)}</p>
          <p className="text-sm text-muc-2">
            {progress.questions_correct}/{progress.questions_answered} câu · hôm nay {progress.day_correct} câu đúng
          </p>
        </div>
        <div className="g-card p-4">
          <p className="text-sm font-semibold text-muc-2 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-hoa-chu" aria-hidden={true} /> Chuỗi ngày học
          </p>
          <p className="font-display font-extrabold text-2xl tabular">{progress.streak} ngày</p>
          <p className="text-sm text-muc-2 flex items-center gap-1">
            <Snowflake className="w-3.5 h-3.5" aria-hidden={true} />
            {progress.freeze_available ? 'Còn 1 ngày nghỉ phép tuần này' : 'Đã dùng ngày nghỉ phép tuần này'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="g-card p-4 space-y-3" aria-labelledby="tower-title">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-son text-white flex items-center justify-center">
              <Landmark className="w-6 h-6" aria-hidden={true} />
            </span>
            <div className="flex-1">
              <h3 id="tower-title" className="font-display font-extrabold text-lg leading-tight">
                Tháp Khảo Thí
              </h3>
              <p className="text-sm text-muc-2">10 tầng, khó dần từ Nhận biết đến Vận dụng. Tầng 5 và 10 là Đình thí.</p>
            </div>
          </div>
          <ol className="grid grid-cols-5 gap-2" aria-label="Các tầng tháp">
            {TOWER_FLOORS.map((f) => {
              const cleared = state.tower >= f.floor;
              const current = state.tower + 1 === f.floor;
              return (
                <li
                  key={f.floor}
                  className={`rounded-xl border-2 aspect-square flex flex-col items-center justify-center font-display font-extrabold ${
                    cleared ? 'bg-ngoc text-white border-ngoc-dam' : current ? 'bg-dong-nhat text-dong-chu border-dong' : 'bg-giay-2 text-muc-3 border-vien'
                  }`}
                  aria-label={`Tầng ${f.floor}${f.boss ? ' (Đình thí)' : ''}${cleared ? ', đã vượt' : current ? ', tầng hiện tại' : ''}`}
                >
                  {f.boss ? <Trophy className="w-4 h-4" aria-hidden={true} /> : null}
                  {f.floor}
                </li>
              );
            })}
          </ol>
          {state.tower >= 10 ? (
            <p className="font-semibold text-ngoc-chu">Em đã chinh phục cả 10 tầng! Có thể thử lại tầng 10 để luyện thêm.</p>
          ) : (
            <p className="text-sm text-muc-2">
              Tầng {nextFloor.floor}: {nextFloor.count} câu mức {nextFloor.levelText}, cần đúng {nextFloor.pass}. Thưởng {fmt(nextFloor.luong)} Lương Thảo
              {nextFloor.relic ? ` và cổ vật ${RELICS[nextFloor.relic].name}` : ''}.
            </p>
          )}
          <GBtn
            variant="son"
            size="lg"
            className="w-full"
            onClick={() =>
              setQuiz({
                title: `Tháp Khảo Thí – Tầng ${nextFloor.floor}${nextFloor.boss ? ' (Đình thí)' : ''}`,
                subtitle: `Mức ${nextFloor.levelText} · cần đúng ${nextFloor.pass}/${nextFloor.count}`,
                req: { count: nextFloor.count, levels: nextFloor.levels },
                pass: nextFloor.pass,
                kind: 'tower',
                floor: nextFloor.floor,
                timer: true,
              })
            }
          >
            <Building2 className="w-5 h-5" aria-hidden={true} /> {state.tower >= 10 ? 'Thử lại tầng 10' : `Leo tầng ${nextFloor.floor}`}
          </GBtn>
          <p className="text-xs text-muc-2">Trả lời sai không bị rớt tầng – chỉ dừng lượt, em thử lại khi sẵn sàng.</p>
        </section>

        <section className="g-card p-4 space-y-3" aria-labelledby="weak-title">
          <h3 id="weak-title" className="font-display font-extrabold text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-ngoc-chu" aria-hidden={true} /> Chủ đề cần củng cố
          </h3>
          {recs === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : recs.length === 0 ? (
            <p className="text-sm text-muc-2">Em đang nắm vững các chủ đề đã học. Tiếp tục khảo thí để mở rộng nhé!</p>
          ) : (
            <ul className="grid gap-2">
              {recs.map((r) => (
                <li key={r.unit_id} className="g-card-flat p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-tight">{r.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Bar value={r.current_mastery} max={1} fill={r.current_mastery >= 0.6 ? 'bg-ngoc' : 'bg-dong'} className="flex-1 !h-2" label={`Mức nắm vững ${r.topic}`} />
                      <span className="text-xs font-bold text-muc-2 tabular">{Math.round(r.current_mastery * 100)}%</span>
                    </div>
                  </div>
                  <GBtn variant="giay" size="sm" onClick={() => setQuiz({ title: 'Ôn chủ đề', subtitle: r.topic, req: { units: [r.unit_id], count: 3 }, kind: 'practice' })}>
                    Ôn <ChevronRight className="w-4 h-4" aria-hidden={true} />
                  </GBtn>
                </li>
              ))}
            </ul>
          )}
          <InfoNote>Mức nắm vững tính bằng mô hình Bayesian Knowledge Tracing (BKT) từ các câu em đã trả lời.</InfoNote>
        </section>
      </div>

      <section className="g-card-flat p-4 flex items-start gap-3">
        <Radio className="w-6 h-6 text-muc-2 shrink-0" aria-hidden={true} />
        <div>
          <p className="font-display font-bold">Thi đấu lớp</p>
          <p className="text-sm text-muc-2">Thầy cô mở phòng thi đấu trực tiếp trên máy chiếu ở trang giáo viên; cả lớp trả lời cùng lúc.</p>
        </div>
      </section>
      <InfoNote>Quốc Tử Giám được dựng từ năm 1076 (thời Lý) và tiếp tục được coi trọng dưới thời Trần.</InfoNote>

      <Sheet open={topicOpen} onClose={() => setTopicOpen(false)} title="Luyện theo chủ đề" subtitle="Chọn một chủ đề trong bài học">
        <ul className="grid gap-2">
          {CATEGORY_ORDER.filter((c) => byCategory[c]?.length).map((c) => (
            <li key={c}>
              <button
                type="button"
                className="ans-btn"
                onClick={() => {
                  setTopicOpen(false);
                  setQuiz({ title: 'Luyện theo chủ đề', subtitle: CATEGORY_LABEL[c], req: { units: byCategory[c], count: 5 }, kind: 'practice', timer: true });
                }}
              >
                <BookOpen className="w-5 h-5 text-ngoc-chu shrink-0" aria-hidden={true} />
                <span className="flex-1">{CATEGORY_LABEL[c]}</span>
                <ChevronRight className="w-5 h-5 text-muc-3" aria-hidden={true} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {quiz && (
        <QuizSheet
          open
          onClose={() => setQuiz(null)}
          title={quiz.title}
          subtitle={quiz.subtitle}
          request={quiz.req}
          passMark={quiz.pass}
          timer={quiz.timer}
          sessionKind={quiz.kind}
          onFinish={(sum) => {
            if (quiz.kind !== 'tower' || !quiz.floor) {
              if (sum.correct > 0) reward(sum.correct * 3, 0);
              return;
            }
            if (!sum.passed) return toast(`Chưa vượt tầng ${quiz.floor}. Thử lại nhé – câu hỏi sẽ khác!`);
            const f = TOWER_FLOORS[quiz.floor - 1];
            const firstTime = state.tower < f.floor;
            update((s) => ({ ...s, tower: Math.max(s.tower, f.floor), relics: f.relic && !s.relics.includes(f.relic) ? [...s.relics, f.relic] : s.relics }));
            if (firstTime) reward(f.luong, 2);
            toast(firstTime ? `Vượt tầng ${f.floor}! +${fmt(f.luong)} Lương Thảo${f.relic ? `, nhận cổ vật ${RELICS[f.relic].name}` : ''}` : `Đã vượt lại tầng ${f.floor}`);
          }}
        />
      )}
    </div>
  );
};
