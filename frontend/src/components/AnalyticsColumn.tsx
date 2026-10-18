import {
  TrendingUp,
  Award,
  AlertTriangle,
  BookOpen,
  Sparkles,
  FileSpreadsheet,
  BarChart2,
  ChevronRight,
  Flame,
} from 'lucide-react';
import type { ClassStats, AiDiagnosticAlert } from '../types/dashboard';

interface AnalyticsColumnProps {
  stats: ClassStats;
  aiAlert: AiDiagnosticAlert;
  onOpenTextbook: () => void;
  onGenerateRemedial: () => void;
  onExportExcel: () => void;
  onViewDetailedAnalytics: () => void;
}

export const AnalyticsColumn = ({
  stats,
  aiAlert,
  onOpenTextbook,
  onGenerateRemedial,
  onExportExcel,
  onViewDetailedAnalytics,
}: AnalyticsColumnProps) => {
  const participationRate = Math.round((stats.activeStudents / stats.totalStudents) * 100);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Card 1: Chỉ Số Lớp 7A1 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Chỉ số học tập lớp 7A1</h3>
          </div>
          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Trực tiếp
          </span>
        </div>

        {/* 2 Circular Progress Gauges */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Gauge 1: Participation */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600"
                  strokeDasharray={`${participationRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-slate-900">
                {participationRate}%
              </span>
            </div>
            <div className="leading-tight">
              <span className="text-[10px] text-slate-500 font-medium block">Tỷ lệ tham gia</span>
              <strong className="text-xs font-black text-slate-800">
                {stats.activeStudents} / {stats.totalStudents} em
              </strong>
            </div>
          </div>

          {/* Gauge 2: Average Engagement */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${stats.averageMorale}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-slate-900">
                {stats.averageMorale}%
              </span>
            </div>
            <div className="leading-tight">
              <span className="text-[10px] text-slate-500 font-medium block">Mức độ tích cực</span>
              <strong className="text-xs font-black text-emerald-700 flex items-center gap-0.5">
                Rất tích cực <Flame className="w-3 h-3 text-amber-500 fill-amber-500 inline" />
              </strong>
            </div>
          </div>
        </div>

        {/* Rank 1 Trophy Card */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                HỌC SINH ĐIỂM CAO NHẤT
              </span>
              <p className="text-xs font-black text-slate-900 leading-tight">
                {stats.topStudent.name} ({stats.topStudent.xp.toLocaleString()} điểm - Chuỗi 6 câu đúng)
              </p>
            </div>
          </div>
          <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
            Hạng 1
          </span>
        </div>
      </div>

      {/* Card 2: Gợi Ý AI */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-xs">
              🤖
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Gợi ý hỗ trợ từ AI</h3>
          </div>
          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">
            Cần lưu ý
          </span>
        </div>

        {/* Warning Alert Box */}
        <div className="bg-red-50/60 border border-red-200 rounded-xl p-3 mb-3 text-xs leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-red-700 block font-bold mb-0.5">
                {aiAlert.title}
              </strong>
              <p className="text-slate-600 text-[11px]">{aiAlert.description}</p>
            </div>
          </div>
        </div>

        {/* Action 1: Open Textbook */}
        <button
          onClick={onOpenTextbook}
          className="w-full mb-2 flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition group active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            Xem trang {aiAlert.citationPage} SGK Lịch sử 7
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
        </button>

        {/* Action 2: Create Remedial Quiz */}
        <button
          onClick={onGenerateRemedial}
          className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            Tạo 3 câu hỏi ôn tập bằng AI
          </span>
          <span className="bg-indigo-700 text-white text-[10px] px-2 py-0.5 rounded font-bold">
            Tạo ngay
          </span>
        </button>
      </div>

      {/* Card 3: Báo Cáo & Tổng Kết Học Tập */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase mb-3">
          BÁO CÁO & TỔNG KẾT HỌC TẬP
        </h3>

        <div className="space-y-2">
          {/* Action 1: Export Excel */}
          <button
            onClick={onExportExcel}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-800 transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Xuất bảng điểm lớp (.xlsx)
            </span>
            <span className="text-[11px] text-slate-400">📥</span>
          </button>

          {/* Action 2: View Detailed Question Analytics */}
          <button
            onClick={onViewDetailedAnalytics}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-800 transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              Xem phân tích chi tiết từng câu hỏi
            </span>
            <span className="text-[11px] text-slate-400">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
};
