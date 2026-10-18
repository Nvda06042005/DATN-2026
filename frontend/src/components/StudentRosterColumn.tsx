import { useState } from 'react';
import { Users, Search, Sparkles, Heart, Zap, AlertTriangle, Shield, Eye } from 'lucide-react';
import type { Student } from '../types/dashboard';

interface StudentRosterColumnProps {
  students: Student[];
  onHealStudent: (id: string) => void;
  onRestoreAll: () => void;
  onBuffMorale: () => void;
}

export const StudentRosterColumn = ({
  students,
  onHealStudent,
  onRestoreAll,
  onBuffMorale,
}: StudentRosterColumnProps) => {
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredStudents = students.filter((s) => {
    const matchesRole = filterRole === 'all' || s.role === filterRole;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.roleTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Danh sách học sinh</h2>
              <span className="bg-purple-100 text-purple-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                35 Em
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Theo dõi điểm và mức độ tham gia</p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="my-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm học sinh..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 text-[11px] font-bold">
        <button
          onClick={() => setFilterRole('all')}
          className={`px-3 py-1 rounded-lg transition whitespace-nowrap ${
            filterRole === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tất cả (35)
        </button>
        <button
          onClick={() => setFilterRole('Quân sư')}
          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
            filterRole === 'Quân sư'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Quân sư (10)
        </button>
        <button
          onClick={() => setFilterRole('Thủy binh')}
          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
            filterRole === 'Thủy binh'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Thủy binh (12)
        </button>
        <button
          onClick={() => setFilterRole('Tiên phong')}
          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
            filterRole === 'Tiên phong'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tiên phong (13)
        </button>
      </div>

      {/* Student List (Scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[580px]">
        {filteredStudents.map((student) => {
          const hpPercentage = Math.round((student.hp / student.maxHp) * 100);
          const apPercentage = Math.round((student.ap / student.maxAp) * 100);

          if (student.isCritical) {
            return (
              <div
                key={student.id}
                className="bg-red-50/70 border-2 border-red-300 rounded-xl p-3 shadow-xs relative transition hover:shadow-md animate-pulse"
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative">
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className="w-10 h-10 rounded-xl object-cover border-2 border-red-500"
                    />
                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      !
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-xs truncate">{student.name}</h3>
                      <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                        Cấp bách
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-semibold mt-0.5">
                      <span className="text-slate-600">{student.roleTitle}</span>
                      <span>•</span>
                      <span>{student.alertText}</span>
                    </div>

                    {/* Critical HP Alert */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] font-black text-red-700 mb-0.5">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600 inline" />
                          Điểm tham gia thấp!
                        </span>
                        <span>
                          {student.hp} / {student.maxHp}
                        </span>
                      </div>
                      <div className="w-full bg-red-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-red-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${hpPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Quick Heal Action */}
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-red-200/60">
                      <span className="text-[10px] text-slate-500 font-medium">
                        Điểm tương tác: {student.ap}/{student.maxAp}
                      </span>
                      <button
                        onClick={() => onHealStudent(student.id)}
                        className="flex items-center gap-1 bg-[#d32f2f] hover:bg-[#b71c1c] text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-sm active:scale-95 transition"
                      >
                        <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                        <span>Cộng điểm hỗ trợ (+15)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={student.id}
              className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-xl p-3 transition hover:shadow-xs group"
            >
              <div className="flex items-start gap-2.5">
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-xs truncate group-hover:text-purple-700 transition">
                      {student.name}
                    </h3>
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                      Lv.{student.level}
                    </span>
                  </div>

                  <p className="text-[11px] font-semibold text-blue-600 mt-0.5">{student.roleTitle}</p>

                  {/* HP & AP Bars */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {/* HP Bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 font-medium mb-0.5">
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                          Điểm tham gia
                        </span>
                        <span className="font-bold font-mono">
                          {student.hp}/{student.maxHp}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${hpPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* AP Bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 font-medium mb-0.5">
                        <span className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                          Điểm tương tác
                        </span>
                        <span className="font-bold font-mono">
                          {student.ap}/{student.maxAp}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{ width: `${apPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Skills & XP */}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/50 text-[10px]">
                    <div className="flex items-center gap-1 text-purple-700 font-medium">
                      {student.role === 'Quân sư' ? (
                        <Eye className="w-3 h-3 text-purple-500" />
                      ) : (
                        <Shield className="w-3 h-3 text-cyan-500" />
                      )}
                      <span>
                        {student.powerName} ({student.powerDesc})
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono">
                      Điểm: {student.xp.toLocaleString()} / {student.maxXp.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={onRestoreAll}
          className="flex items-center justify-center gap-1.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-xs transition active:scale-95 border border-purple-200"
        >
          <Heart className="w-3.5 h-3.5 text-purple-600" />
          <span>Đặt lại điểm cả lớp</span>
        </button>
        <button
          onClick={onBuffMorale}
          className="flex items-center justify-center gap-1.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs transition active:scale-95 border border-amber-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Thưởng +50 điểm</span>
        </button>
      </div>
    </div>
  );
};
