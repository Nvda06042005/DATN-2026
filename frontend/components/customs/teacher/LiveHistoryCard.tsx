import React from 'react';
import { Radio, Trophy } from 'lucide-react';
import type { LiveSessionSummary } from '@/types/teacherType';
import { formatDateTime, pct, shortName } from '@/utils/format';

export const LiveHistoryCard: React.FC<{ sessions: LiveSessionSummary[] | null; onLaunch: () => void }> = ({ sessions, onLaunch }) => (
  <section className="card-duo p-5" aria-labelledby="live-history-title">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h3 id="live-history-title" className="font-black text-lg text-duo-ink">
          Thi đấu gần đây
        </h3>
        <p className="text-xs font-bold text-duo-wolf">Kết quả các trận thi đấu trực tiếp của lớp – server chấm từng câu</p>
      </div>
      <button type="button" onClick={onLaunch} className="btn-3d btn-gold btn-sm">
        <Radio className="w-4 h-4" aria-hidden="true" /> Mở phòng
      </button>
    </div>
    {sessions === null ? (
      <p className="text-sm font-bold text-duo-wolf">Đang tải lịch sử thi đấu…</p>
    ) : sessions.length === 0 ? (
      <p className="text-sm font-semibold text-duo-wolf">Lớp chưa có trận thi đấu nào. Bấm “Mở phòng”, đọc mã PIN cho cả lớp và bắt đầu.</p>
    ) : (
      <ul className="divide-y-2 divide-duo-swan">
        {sessions.map((s) => {
          const hardest = s.questions
            .filter((q) => q.answered > 0)
            .sort((a, b) => a.correct / a.answered - b.correct / b.answered)[0];
          return (
            <li key={s.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-black text-duo-ink truncate">{s.title}</p>
                <p className="text-xs font-bold text-duo-wolf">
                  {formatDateTime(s.finished_at)} · {s.player_count} học sinh · {s.question_count} câu · đúng {pct(s.accuracy)}
                </p>
                {hardest && (
                  <p className="text-xs font-semibold text-duo-wolf mt-1">
                    Câu khó nhất: “{hardest.prompt}” – {hardest.correct}/{hardest.answered} bạn đúng
                  </p>
                )}
              </div>
              <ol className="flex flex-wrap gap-2 shrink-0" aria-label={`Ba bạn dẫn đầu trận ${s.title}`}>
                {s.results.slice(0, 3).map((r) => (
                  <li key={r.user_id} className="chip bg-duo-gold-light text-duo-gold-dark">
                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" /> {r.rank}. {shortName(r.full_name)} · {r.score.toLocaleString('vi-VN')}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
