import React, { useState } from 'react';
import { FileSpreadsheet, RefreshCw, Search, Star } from 'lucide-react';
import { Mascot } from '@/components/customs/Mascot';
import { ClassInsights } from '@/components/customs/teacher/ClassInsights';
import type { ClassSummary, RosterStudent, TeacherClass } from '@/types/teacherType';
import { avatarColor, formatDateTime, initialsOf, pct } from '@/utils/format';

export const TeacherRosterPage: React.FC<{
  className: string | null;
  roster: RosterStudent[];
  summary: ClassSummary | undefined;
  cls: TeacherClass | null;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}> = ({ className, roster, summary, cls, loading, onRefresh, onExport }) => {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = roster.filter((s) => !q || s.full_name.toLowerCase().includes(q) || s.username.includes(q));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-duo-ink">{className ? `Học sinh lớp ${className}` : 'Học sinh của lớp'}</h2>
            <p className="text-sm font-bold text-duo-wolf">
              {summary ? `${summary.total} học sinh • ${summary.practiced} em đã làm bài • ${summary.active_7d} em hoạt động trong 7 ngày` : 'Đang tải…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh} className="btn-3d btn-outline !text-duo-wolf" title="Tải lại">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
            <button onClick={onExport} className="btn-3d btn-green">
              <FileSpreadsheet className="w-4 h-4" /> Xuất CSV
            </button>
          </div>
        </div>

        {!className ? (
          <div className="card-duo p-8 flex flex-col items-center text-center">
            <Mascot size={100} mood="thinking" />
            <p className="font-black text-duo-ink mt-2">Tài khoản của bạn chưa được gán lớp</p>
            <p className="text-sm font-bold text-duo-wolf">Nhờ quản trị viên cập nhật lớp phụ trách tại trang quản trị.</p>
          </div>
        ) : (
          <>
            <ClassInsights cls={cls} loading={loading} />
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học sinh…" className="input-duo !pl-10" />
            </div>
            <div className="card-duo overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3 font-black">#</th>
                      <th className="text-left px-4 py-3 font-black">Học sinh</th>
                      <th className="text-right px-4 py-3 font-black">KN</th>
                      <th className="text-right px-4 py-3 font-black">Sao chiến dịch</th>
                      <th className="text-right px-4 py-3 font-black">Chính xác</th>
                      <th className="text-left px-4 py-3 font-black w-40">Nắm vững (BKT)</th>
                      <th className="text-right px-4 py-3 font-black">Chuỗi</th>
                      <th className="text-left px-4 py-3 font-black">Đăng nhập gần nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-duo-swan">
                    {rows.map((s, i) => (
                      <tr key={s.id} className={s.is_active ? 'hover:bg-duo-polar/60' : 'opacity-50'}>
                        <td className="px-4 py-3 font-black text-duo-wolf">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(s.full_name) }}>
                              {initialsOf(s.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-duo-ink truncate">{s.full_name}</p>
                              <p className="text-xs font-bold text-duo-hare font-mono">
                                {s.username}
                                {s.must_change_password && <span className="ml-1.5 chip bg-duo-gold-light text-duo-gold-dark !text-[10px] !py-0 font-sans">Chưa đăng nhập</span>}
                                {!s.is_active && <span className="ml-1.5 chip bg-duo-red-light text-duo-red-dark !text-[10px] !py-0 font-sans">Đã khoá</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-gold-dark">{s.xp.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-right font-black text-duo-ink whitespace-nowrap" title={`Màn 1: ${s.campaign_stars?.[0] ?? 0}/9 · Màn 2: ${s.campaign_stars?.[1] ?? 0}/9 · Màn 3: ${s.campaign_stars?.[2] ?? 0}/9`}>
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-4 h-4 text-duo-gold fill-duo-gold" aria-hidden="true" /> {s.stars}/27
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-ink">{pct(s.accuracy)}</td>
                        <td className="px-4 py-3">
                          {s.avg_mastery === null ? (
                            <span className="text-xs font-bold text-duo-hare">Chưa có dữ liệu</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="progress-duo progress-sm flex-1">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${s.avg_mastery * 100}%`, background: s.avg_mastery >= 0.8 ? '#0f766e' : s.avg_mastery >= 0.6 ? '#0369a1' : '#c2410c' }}
                                />
                              </div>
                              <span className="text-xs font-black text-duo-wolf w-9 text-right">{pct(s.avg_mastery)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-duo-orange">{s.streak > 0 ? `${s.streak} ngày` : '—'}</td>
                        <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">{formatDateTime(s.last_login_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && (
                <div className="py-12 flex flex-col items-center text-center px-4">
                  <Mascot size={90} mood="thinking" />
                  <p className="font-black text-duo-ink mt-2">{roster.length === 0 ? 'Lớp chưa có học sinh nào' : 'Không tìm thấy học sinh phù hợp'}</p>
                  <p className="text-sm font-bold text-duo-wolf">
                    {roster.length === 0 ? 'Quản trị viên cấp tài khoản học sinh cho lớp tại trang quản trị (/admin).' : 'Thử từ khoá khác.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
};
