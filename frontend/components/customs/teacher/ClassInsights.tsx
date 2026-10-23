import React from 'react';
import type { TeacherClass } from '@/types/teacherType';
import { avatarColor, initialsOf, pct } from '@/utils/format';

export const ClassInsights: React.FC<{ cls: TeacherClass | null; loading: boolean }> = ({ cls, loading }) => {
  if (!cls) return loading ? <div className="card-duo p-5 text-sm font-bold text-duo-wolf">Đang tải tiến độ của lớp…</div> : null;
  const weakest = cls.unit_mastery.slice(0, 6);
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Tiến độ học tập của lớp">
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Câu cả lớp sai nhiều nhất</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Do server ghi lại khi chấm từng câu trả lời</p>
        {cls.top_wrong.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Chưa có câu trả lời sai nào.</p>
        ) : (
          <ol className="space-y-3">
            {cls.top_wrong.map((w, i) => (
              <li key={w.question_id} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-duo-red-light text-duo-red-dark font-black text-sm flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-duo-ink leading-snug">{w.prompt}</p>
                  <p className="text-xs font-semibold text-duo-wolf mt-0.5">
                    Sai {w.wrong}/{w.attempts} lượt · {w.students} học sinh · {w.topic}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Mức nắm vững theo chủ đề</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Trung bình P(L) của mô hình BKT – yếu nhất ở trên</p>
        {weakest.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Học sinh chưa làm câu hỏi nào.</p>
        ) : (
          <ul className="space-y-3">
            {weakest.map((m) => (
              <li key={m.unit_id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-duo-ink leading-snug">{m.topic}</span>
                  <span className="font-black text-duo-wolf shrink-0">{pct(m.avg_p_l)}</span>
                </div>
                <div className="progress-duo progress-sm mt-1">
                  <div className="progress-fill" style={{ width: `${m.avg_p_l * 100}%`, background: m.avg_p_l >= 0.8 ? '#0f766e' : m.avg_p_l >= 0.6 ? '#0369a1' : '#d97706' }} />
                </div>
                <p className="text-[11px] font-semibold text-duo-hare mt-0.5">{m.students} học sinh đã làm</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card-duo p-5">
        <h3 className="font-black text-lg text-duo-ink mb-1">Học sinh cần hỗ trợ</h3>
        <p className="text-xs font-bold text-duo-wolf mb-3">Vắng học, tỉ lệ đúng hoặc mức nắm vững thấp</p>
        {cls.needs_support.length === 0 ? (
          <p className="text-sm font-semibold text-duo-wolf">Chưa có học sinh nào cần lưu ý.</p>
        ) : (
          <ul className="space-y-2.5">
            {cls.needs_support.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(n.full_name) }}>
                  {initialsOf(n.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-duo-ink">{n.full_name}</p>
                  <p className="text-xs font-semibold text-duo-wolf">{n.reasons.join(' · ')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
