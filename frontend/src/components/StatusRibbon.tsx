import { useState, useEffect } from 'react';
import { Clock, Users, Flame, RefreshCw } from 'lucide-react';

interface StatusRibbonProps {
  classCode: string;
  activeStudents: number;
  totalStudents: number;
  onSync: () => void;
}

export const StatusRibbon = ({
  classCode,
  activeStudents,
  totalStudents,
  onSync
}: StatusRibbonProps) => {
  const [secondsLeft, setSecondsLeft] = useState(28 * 60 + 45); // 28:45
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSyncClick = () => {
    setIsSyncing(true);
    onSync();
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const percentage = Math.round((activeStudents / totalStudents) * 100);

  return (
    <div className="bg-slate-900 text-white px-6 py-2.5 flex flex-wrap items-center justify-between text-xs font-medium shadow-inner">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Room Code */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80"></span>
          <span className="text-slate-300">Mã phòng học:</span>
          <span className="font-bold tracking-wider font-mono bg-white/10 px-2 py-0.5 rounded text-white border border-white/10">
            {classCode}
          </span>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center gap-1.5 text-slate-200">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>Thời gian còn lại:</span>
          <span className="font-bold font-mono text-amber-300 text-sm tracking-wide">
            {formatTime(secondsLeft)}
          </span>
        </div>

        {/* Active Students */}
        <div className="flex items-center gap-1.5 text-slate-200">
          <Users className="w-3.5 h-3.5 text-blue-300" />
          <span>Học sinh tham gia:</span>
          <span className="font-bold text-white">
            {activeStudents} / {totalStudents} em ({percentage}%)
          </span>
        </div>
      </div>

      {/* Right Side: Engagement & Sync */}
      <div className="flex items-center gap-4 mt-1 sm:mt-0">
        <div className="flex items-center gap-1 bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-bold">
          <span>Không khí lớp học: Sôi nổi</span>
          <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
        </div>

        <button
          onClick={handleSyncClick}
          className="flex items-center gap-1 bg-white/10 hover:bg-white/20 active:scale-95 transition px-2.5 py-1 rounded-lg text-white border border-white/10 font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Đồng bộ dữ liệu</span>
        </button>
      </div>
    </div>
  );
};
