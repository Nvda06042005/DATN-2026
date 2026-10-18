import React, { useState } from 'react';
import {
  X,
  Check,
  BookOpen,
  Settings,
  MessageSquare,
  ListFilter,
  CheckCircle2,
  Clock,
  Sparkles,
  Coins,
  Home,
  MapPin,
  Flag,
} from 'lucide-react';
import type { QuestObjective, OutcomeStatus } from '../types/quest';
import daiVietMapImg from '../assets/dai_viet_campaign_map.jpg';
import bachDangImg1 from '../assets/bach_dang_battle_1.png';
import bachDangImg2 from '../assets/bach_dang_battle_2.jpg';

interface QuestObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  questTitle: string;
  objectives: QuestObjective[];
  currentObjectiveId: string;
  onSelectObjective: (id: string) => void;
  onUpdateObjective: (updated: QuestObjective) => void;
  onShowToast: (msg: string) => void;
}

export const QuestObjectiveModal: React.FC<QuestObjectiveModalProps> = ({
  isOpen,
  onClose,
  questTitle,
  objectives,
  currentObjectiveId,
  onSelectObjective,
  onUpdateObjective,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'story' | 'task' | 'settings'>('overview');
  const [editingFeedbackStudentId, setEditingFeedbackStudentId] = useState<string | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');

  if (!isOpen) return null;

  const currentObj = objectives.find((o) => o.id === currentObjectiveId) || objectives[0];
  if (!currentObj) return null;

  const nextObj = objectives.find((o) => o.id === currentObj.nextObjectiveId);

  // Toggle outcome status for a student
  const handleToggleStudentOutcome = (studentId: string, newOutcome: OutcomeStatus) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => {
      if (st.studentId === studentId) {
        return {
          ...st,
          outcome: st.outcome === newOutcome ? ('pending' as OutcomeStatus) : newOutcome,
        };
      }
      return st;
    });

    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });

    const targetStudent = currentObj.studentsProgress.find((s) => s.studentId === studentId);
    if (newOutcome === 'passed') {
      onShowToast(`✅ Đã duyệt hoàn thành ải cho học sinh "${targetStudent?.studentName}" (+${currentObj.rewards.xp} XP)!`);
    } else {
      onShowToast(`⚠️ Đã đánh dấu cần làm lại cho học sinh "${targetStudent?.studentName}".`);
    }
  };

  // Apply outcome to all students
  const handleApplyToAllStudents = (outcome: OutcomeStatus) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => ({
      ...st,
      outcome,
    }));
    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });
    onShowToast(`🎯 Đã áp dụng trạng thái "${outcome === 'passed' ? 'Hoàn thành' : 'Chưa đạt'}" cho toàn bộ 35 học sinh.`);
  };

  // Save student feedback
  const handleSaveFeedback = (studentId: string) => {
    const updatedStudents = currentObj.studentsProgress.map((st) => {
      if (st.studentId === studentId) {
        return {
          ...st,
          feedback: feedbackInput.trim() || undefined,
        };
      }
      return st;
    });
    onUpdateObjective({
      ...currentObj,
      studentsProgress: updatedStudents,
    });
    setEditingFeedbackStudentId(null);
    setFeedbackInput('');
    onShowToast('💬 Đã lưu lời nhận xét cho học sinh.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-7xl h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* Top Header Bar (Khớp ảnh 3, 4, 5) */}
        {/* ======================================================== */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Lớp 7A1
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate">
              <span className="font-bold text-slate-700">Nhiệm vụ</span>
              <span>/</span>
              <span className="font-semibold text-slate-600 truncate">{questTitle}</span>
              <span>/</span>
              <span className="font-black text-[#1368ce] truncate">{currentObj.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Đóng"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Main Body: 2 Columns (Cột trái Mini-map & Danh sách ải, Cột phải Nội dung) */}
        {/* ======================================================== */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Cột trái (Left Sidebar) */}
          <div className="w-72 sm:w-80 border-r border-slate-200 bg-[#fafbfe] flex flex-col shrink-0">
            {/* Mini-map Thumbnail */}
            <div className="p-3 border-b border-slate-200">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-2xs h-32 bg-slate-900 group">
                <img
                  src={daiVietMapImg}
                  alt="Mini Map Đại Việt"
                  className="w-full h-full object-cover object-center opacity-90 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                {/* Current node pin highlight on mini-map */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300"
                  style={{ left: `${currentObj.coords.x}%`, top: `${currentObj.coords.y}%` }}
                >
                  <span className="absolute w-6 h-6 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-black text-white/90 drop-shadow-md">
                  <span>Hành trình: 13 ải</span>
                  <span className="bg-emerald-500/80 px-1.5 py-0.5 rounded text-[9px]">
                    Đang ở ải #{objectives.findIndex((o) => o.id === currentObj.id) + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách các ải (Objectives List) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              <div className="px-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Các chặng thử thách
              </div>
              {objectives.map((obj, index) => {
                const isActive = obj.id === currentObj.id;
                return (
                  <button
                    key={obj.id}
                    onClick={() => {
                      onSelectObjective(obj.id);
                      setEditingFeedbackStudentId(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center gap-3 my-0.5 ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-2xs font-black border-l-4 border-emerald-500'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {obj.type === 'start' ? (
                        <Home className="w-3.5 h-3.5" />
                      ) : obj.type === 'boss' ? (
                        <Flag className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate leading-snug">
                        {index + 1}. {obj.title}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal truncate">
                        +{obj.rewards.xp} XP • +{obj.rewards.gp} GP
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cột phải (Right Main Content) */}
          <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
            {/* Title & Tabs Navigation */}
            <div className="border-b border-slate-200 px-8 pt-6 pb-0 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {currentObj.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentObj.shortDescription || 'Mục tiêu thử thách trong cuộc thám hiểm Tháp Pha Lê'}
                  </p>
                </div>
              </div>

              {/* 4 Tabs (OVERVIEW | STORY | TASK | SETTINGS) */}
              <div className="flex items-center gap-8 text-xs font-black select-none">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'overview'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ListFilter className="w-4 h-4" />
                  <span>TỔNG QUAN (OVERVIEW)</span>
                </button>

                <button
                  onClick={() => setActiveTab('story')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'story'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>CÂU CHUYỆN (STORY)</span>
                </button>

                <button
                  onClick={() => setActiveTab('task')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'task'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NHIỆM VỤ (TASK)</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition ${
                    activeTab === 'settings'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>CÀI ĐẶT (SETTINGS)</span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-8 bg-[#f8f9fc]">
              {/* ==================================================== */}
              {/* TAB 1: OVERVIEW (Khớp chuẩn Ảnh 3 & Ảnh 4) */}
              {/* ==================================================== */}
              {activeTab === 'overview' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* Top Cards: Proceed to Success, Proceed to Failure, Assignments */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Thẻ 1: Proceed to khi thành công */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          Mở ải tiếp theo (Proceed to):
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-700 truncate">
                          📍 {nextObj ? nextObj.title : 'Về đích vinh quang'}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />+{currentObj.rewards.xp} XP
                          </span>
                          <span className="text-[11px] font-black text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-200/60 flex items-center gap-1">
                            <Coins className="w-3 h-3" />+{currentObj.rewards.gp} GP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thẻ 2: Proceed to khi chưa đạt */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          Khi chưa đạt (Proceed to):
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-medium">
                          Chưa mở khoá ải mới cho đến khi học sinh hoàn thành.
                        </div>
                        <span className="inline-block mt-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Giữ nguyên vị trí hiện tại
                        </span>
                      </div>
                    </div>

                    {/* Thẻ 3: Assignments Reward */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          Thưởng nộp bài (Assignments):
                        </span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Đúng hạn (On Time):</span>
                          <span className="font-black text-slate-700">
                            +{currentObj.rewards.xp} XP • +{currentObj.rewards.gp} GP
                          </span>
                        </div>
                        {currentObj.enableEarlyReward && (
                          <div className="flex items-center justify-between text-emerald-700 font-bold">
                            <span>Nộp sớm (Early):</span>
                            <span>
                              +{currentObj.earlyRewards?.xp || 100} XP • +{currentObj.earlyRewards?.gp || 50} GP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bảng Tiến độ tự học (Self-Paced Progress Table - Khớp ảnh 3 & 4) */}
                  <div className="rounded-2xl border-2 border-blue-500 bg-white overflow-hidden shadow-sm">
                    {/* Blue Ribbon Header */}
                    <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-black">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>⚡ Tiến độ tự học (Self-Paced Progress)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplyToAllStudents('passed')}
                          className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Duyệt đạt cả lớp
                        </button>
                      </div>
                    </div>

                    {/* Action Bar inside table container */}
                    <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-slate-500 font-medium">
                        <span>Đang theo dõi 35 học sinh lớp 7A1</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-bold">
                          {currentObj.studentsProgress.filter((s) => s.outcome === 'passed').length} em đã hoàn thành
                        </span>
                      </div>
                      <button
                        onClick={() => handleApplyToAllStudents('pending')}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Đặt lại trạng thái
                      </button>
                    </div>

                    {/* Table Data (Khớp chuẩn cột ảnh 4) */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-6 py-3">Họ và tên (NAME)</th>
                            <th className="px-3 py-3 text-center">Nộp sớm (EARLY)</th>
                            <th className="px-3 py-3 text-center">Đúng hạn (ON TIME)</th>
                            <th className="px-3 py-3 text-center">Trễ hạn (LATE)</th>
                            <th className="px-4 py-3 text-center">Nhận xét (FEEDBACK)</th>
                            <th className="px-6 py-3 text-right">Kết quả (OUTCOME)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentObj.studentsProgress.map((student) => {
                            const isPassed = student.outcome === 'passed';
                            const isFailed = student.outcome === 'failed';

                            return (
                              <tr key={student.studentId} className="hover:bg-slate-50/80 transition">
                                <td className="px-6 py-3.5 font-bold text-slate-900">
                                  {student.studentName}
                                </td>

                                {/* Early indicator */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'early' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                                      ✓
                                    </span>
                                  )}
                                </td>

                                {/* On Time indicator */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'on_time' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
                                      ✓
                                    </span>
                                  )}
                                </td>

                                {/* Late indicator (Red cross like Toby in screenshot) */}
                                <td className="px-3 py-3.5 text-center">
                                  {student.status === 'late' && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-black">
                                      ✕
                                    </span>
                                  )}
                                </td>

                                {/* Feedback Chat Icon */}
                                <td className="px-4 py-3.5 text-center">
                                  <button
                                    onClick={() => {
                                      setEditingFeedbackStudentId(student.studentId);
                                      setFeedbackInput(student.feedback || '');
                                    }}
                                    className={`p-1.5 rounded-lg transition inline-flex items-center gap-1 ${
                                      student.feedback
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                    title={student.feedback || 'Thêm nhận xét'}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    {student.feedback && (
                                      <span className="text-[10px] font-bold max-w-[100px] truncate hidden sm:inline">
                                        {student.feedback}
                                      </span>
                                    )}
                                  </button>
                                </td>

                                {/* Outcome Action Buttons (✓ and ✕) */}
                                <td className="px-6 py-3.5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    {/* Nút Hoàn thành ✓ */}
                                    <button
                                      onClick={() => handleToggleStudentOutcome(student.studentId, 'passed')}
                                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                                        isPassed
                                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                                          : 'border-slate-300 bg-white text-slate-300 hover:border-emerald-500 hover:text-emerald-500'
                                      }`}
                                      title="Duyệt hoàn thành ải"
                                    >
                                      <Check className="w-4 h-4 stroke-[3]" />
                                    </button>

                                    {/* Nút Chưa đạt ✕ */}
                                    <button
                                      onClick={() => handleToggleStudentOutcome(student.studentId, 'failed')}
                                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition ${
                                        isFailed
                                          ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                                          : 'border-slate-300 bg-white text-slate-300 hover:border-rose-500 hover:text-rose-500'
                                      }`}
                                      title="Đánh dấu chưa đạt"
                                    >
                                      <X className="w-4 h-4 stroke-[3]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Modal / Popup nhập nhận xét nhanh cho học sinh */}
                  {editingFeedbackStudentId && (
                    <div className="p-4 bg-white border border-blue-200 rounded-2xl shadow-md animate-in fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800">
                          Nhận xét cho học sinh:{' '}
                          <span className="text-blue-600">
                            {currentObj.studentsProgress.find((s) => s.studentId === editingFeedbackStudentId)?.studentName}
                          </span>
                        </span>
                        <button
                          onClick={() => setEditingFeedbackStudentId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="Nhập lời góp ý, động viên học sinh..."
                          className="flex-1 text-xs border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleSaveFeedback(editingFeedbackStudentId)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 2: STORY (Dẫn truyện nhập vai) */}
              {/* ==================================================== */}
              {activeTab === 'story' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Lời dẫn truyện chặng: {currentObj.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Học sinh sẽ được đọc nội dung này khi bước chân vào ải thử thách
                      </p>
                    </div>
                  </div>

                  {/* Tranh sơn dầu tư liệu lịch sử Đại chiến Bạch Đằng (Người dùng cung cấp) */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <img
                      src={currentObj.id.includes('12') || currentObj.id.includes('13') ? bachDangImg1 : bachDangImg2}
                      alt="Trận Đại Chiến Bạch Đằng Giang"
                      className="w-full h-56 sm:h-72 object-cover object-center hover:scale-102 transition duration-500"
                    />
                    <div className="bg-slate-900 text-white px-4 py-2.5 text-xs flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <span>⚔️</span>
                        <span>Tư liệu lịch sử: Đại thắng quân Nguyên Mông trên sông Bạch Đằng (1288)</span>
                      </span>
                      <span className="text-amber-400 font-extrabold text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                        Tranh sơn dầu lịch sử
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-6 text-sm text-amber-950 leading-relaxed font-serif italic">
                    "{currentObj.storyContent}"
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700">
                      Chỉnh sửa cốt truyện nhập vai:
                    </label>
                    <textarea
                      rows={5}
                      value={currentObj.storyContent}
                      onChange={(e) =>
                        onUpdateObjective({ ...currentObj, storyContent: e.target.value })
                      }
                      className="w-full text-xs p-4 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 font-sans leading-relaxed"
                      placeholder="Viết lời dẫn nhập vai cho học sinh..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => onShowToast('📖 Đã lưu nội dung dẫn truyện!')}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                    >
                      Lưu cốt truyện
                    </button>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 3: TASK (Nhiệm vụ & Bài tập) */}
              {/* ==================================================== */}
              {activeTab === 'task' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Nhiệm vụ học tập cần nộp
                      </h3>
                      <p className="text-xs text-slate-500">
                        Yêu cầu bài tập học sinh cần hoàn thành để được duyệt qua ải
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="text-xs font-extrabold text-slate-800">Yêu cầu hiện tại:</div>
                    <div className="text-xs text-slate-600 leading-relaxed font-medium">
                      {currentObj.taskContent}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700">
                      Cập nhật nội dung nhiệm vụ:
                    </label>
                    <textarea
                      rows={4}
                      value={currentObj.taskContent}
                      onChange={(e) =>
                        onUpdateObjective({ ...currentObj, taskContent: e.target.value })
                      }
                      className="w-full text-xs p-4 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-sans leading-relaxed"
                      placeholder="Nhập yêu cầu nhiệm vụ hoặc câu hỏi..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => onShowToast('🎯 Đã lưu yêu cầu nhiệm vụ!')}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                    >
                      Lưu nhiệm vụ
                    </button>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* TAB 4: SETTINGS (Cài đặt chi tiết - Khớp chuẩn Ảnh 5) */}
              {/* ==================================================== */}
              {activeTab === 'settings' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-2xs space-y-8">
                  {/* Mục 1: Self-Paced Progress */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentObj.selfPaced}
                        onChange={(e) =>
                          onUpdateObjective({ ...currentObj, selfPaced: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        ⚡ Tiến độ tự học (Self-Paced Progress)
                      </span>
                    </label>
                    <p className="text-xs text-slate-500 pl-7">
                      Cho phép học sinh tự động tiến tới ải tiếp theo ngay sau khi hoàn thành bài tập hoặc nhiệm vụ.
                    </p>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Mục 2: Assignment */}
                  <div className="space-y-5">
                    <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      A+ Bài tập (Assignment)
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentObj.enableAssignments}
                          onChange={(e) =>
                            onUpdateObjective({ ...currentObj, enableAssignments: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span className="text-sm font-extrabold text-slate-800">
                          Bật nộp bài tập (Enable Assignments)
                        </span>
                      </label>
                      <p className="text-xs text-slate-500 pl-7">
                        Cho phép học sinh nộp sản phẩm bài làm và nhận điểm kinh nghiệm cùng phần thưởng.
                      </p>
                    </div>

                    {/* Due Date & Rewards */}
                    {currentObj.enableAssignments && (
                      <div className="pl-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Hạn chót nộp bài (Due Date):
                            </label>
                            <input
                              type="text"
                              value={currentObj.dueDate}
                              onChange={(e) =>
                                onUpdateObjective({ ...currentObj, dueDate: e.target.value })
                              }
                              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Phần thưởng đúng hạn (Student Reward):
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                                <span className="text-[11px] font-black text-amber-700">XP</span>
                                <input
                                  type="number"
                                  value={currentObj.rewards.xp}
                                  onChange={(e) =>
                                    onUpdateObjective({
                                      ...currentObj,
                                      rewards: { ...currentObj.rewards, xp: Number(e.target.value) },
                                    })
                                  }
                                  className="w-14 text-xs font-bold bg-transparent text-amber-900 outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-200">
                                <span className="text-[11px] font-black text-yellow-700">GP</span>
                                <input
                                  type="number"
                                  value={currentObj.rewards.gp}
                                  onChange={(e) =>
                                    onUpdateObjective({
                                      ...currentObj,
                                      rewards: { ...currentObj.rewards, gp: Number(e.target.value) },
                                    })
                                  }
                                  className="w-14 text-xs font-bold bg-transparent text-yellow-900 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Early Submission Reward */}
                        <div className="pt-2 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentObj.enableEarlyReward}
                              onChange={(e) =>
                                onUpdateObjective({ ...currentObj, enableEarlyReward: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                            />
                            <span className="text-xs font-extrabold text-slate-800">
                              Bật thưởng nộp sớm (Enable Early Submission Reward)
                            </span>
                          </label>
                          <p className="text-xs text-slate-500 pl-7">
                            Tặng thêm điểm thưởng đặc biệt cho những học sinh hoàn thành trước hạn quy định.
                          </p>

                          {currentObj.enableEarlyReward && (
                            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Hạn chót nộp sớm (Early Due Date):
                                </label>
                                <input
                                  type="text"
                                  value={currentObj.earlyDueDate || '2026-10-12 16:00'}
                                  onChange={(e) =>
                                    onUpdateObjective({ ...currentObj, earlyDueDate: e.target.value })
                                  }
                                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Thưởng nộp sớm (Early Reward):
                                </label>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    <span className="text-[11px] font-black text-emerald-700">XP</span>
                                    <input
                                      type="number"
                                      value={currentObj.earlyRewards?.xp || 100}
                                      onChange={(e) =>
                                        onUpdateObjective({
                                          ...currentObj,
                                          earlyRewards: {
                                            xp: Number(e.target.value),
                                            gp: currentObj.earlyRewards?.gp || 50,
                                          },
                                        })
                                      }
                                      className="w-14 text-xs font-bold bg-transparent text-emerald-900 outline-none"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-200">
                                    <span className="text-[11px] font-black text-yellow-700">GP</span>
                                    <input
                                      type="number"
                                      value={currentObj.earlyRewards?.gp || 50}
                                      onChange={(e) =>
                                        onUpdateObjective({
                                          ...currentObj,
                                          earlyRewards: {
                                            xp: currentObj.earlyRewards?.xp || 100,
                                            gp: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-14 text-xs font-bold bg-transparent text-yellow-900 outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-100" />

                  {/* Mục 3: Discussion */}
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      💬 Thảo luận (Discussion)
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentObj.allowDiscussion}
                        onChange={(e) =>
                          onUpdateObjective({ ...currentObj, allowDiscussion: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-sm font-extrabold text-slate-800">
                        Thảo luận lớp học (Class Discussion)
                      </span>
                    </label>
                    <p className="text-xs text-slate-500 pl-7">
                      Cho phép 35 học sinh trong lớp trao đổi, đặt câu hỏi và bình luận về ải thử thách này.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => onShowToast('⚙️ Đã cập nhật cài đặt ải thành công!')}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs"
                    >
                      Lưu tất cả thay đổi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
