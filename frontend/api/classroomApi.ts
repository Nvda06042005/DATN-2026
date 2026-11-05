/** API lớp học (/api/classroom, Sprint 7): giáo viên quản lý lớp – đội – thưởng/phạt – bài tập; học sinh xem lớp, làm bài tập, dùng kỹ năng, đọc thông báo. */
import { apiBlob, apiRequest, apiUpload, type PickedFile } from '@/api/client';
import type {
  AdjustInput, AdjustResult, AdjustRow, AnnouncementRow, AssignmentDetail, AssignmentInput, AssignmentRow, BadgeAwardResult, BoardView, ClassDetail, ClassRow, ClassRule, ClassSettings, ClassStudent,
  GoalRow, LeaveRow, LessonSubmit, MyAssignment, MyClassDetail, MyClassRow, Notices, PoolStudent, ProgressView, RandomEvent, RandomEventResult, SkillRequestRow, SkillUseResult, SkillView,
  StartedAssignment, TeamBoard, TeamRow,
} from '@/types/classroom';

const qs = (query: Record<string, string | number | undefined | null>): string => {
  const parts = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};
const base = '/api/classroom';

// ---------------------------------------------------------------------- giáo viên: lớp (HK.GV.007–011)
export const teacherClasses = (token: string) => apiRequest<ClassRow[]>(`${base}/classes`, { token });
export const classDetail = (token: string, id: number) => apiRequest<ClassDetail>(`${base}/classes/${id}`, { token });
export const createClass = (token: string, body: { name: string; grade: number; description?: string | null }) => apiRequest<ClassDetail>(`${base}/classes`, { token, body });
export const updateClass = (token: string, id: number, body: { name?: string; description?: string | null; cover_url?: string | null }) => apiRequest<ClassDetail>(`${base}/classes/${id}`, { token, method: 'PATCH', body });
export const archiveClass = (token: string, id: number, archived: boolean) => apiRequest<ClassDetail>(`${base}/classes/${id}/archive`, { token, body: { archived } });
export const deleteClass = (token: string, id: number) => apiRequest<void>(`${base}/classes/${id}`, { token, method: 'DELETE' });
export const regenerateCode = (token: string, id: number) => apiRequest<ClassDetail>(`${base}/classes/${id}/regenerate-code`, { token, body: {} });
export const setJoinOpen = (token: string, id: number, open: boolean) => apiRequest<ClassDetail>(`${base}/classes/${id}/join`, { token, body: { open } });

// ---------------------------------------------------------------------- giáo viên: học sinh (HK.GV.012–015)
export const classStudents = (token: string, id: number, q?: string) => apiRequest<ClassStudent[]>(`${base}/classes/${id}/students${qs({ q })}`, { token });
export const studentPool = (token: string, id: number, q?: string) => apiRequest<PoolStudent[]>(`${base}/classes/${id}/student-pool${qs({ q })}`, { token });
export const addStudents = (token: string, id: number, studentIds: number[]) => apiRequest<{ added: number; skipped: number }>(`${base}/classes/${id}/students`, { token, body: { student_ids: studentIds } });
export const importStudents = (token: string, id: number, file: PickedFile) =>
  apiUpload<{ added: number; skipped: number; errors: Array<{ row: number; code: string; message: string }> }>(`${base}/classes/${id}/students/import`, file, token);
export const studentsTemplate = (token: string) => apiBlob(`${base}/students-template`, token);
export const removeStudent = (token: string, id: number, userId: number) => apiRequest<void>(`${base}/classes/${id}/students/${userId}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- đội, rời lớp, thông báo
export const classTeams = (token: string, id: number) => apiRequest<TeamRow[]>(`${base}/classes/${id}/teams`, { token });
export const autoTeams = (token: string, id: number, size: number) => apiRequest<TeamRow[]>(`${base}/classes/${id}/teams/auto`, { token, body: { size } });
export const setTeams = (token: string, id: number, teams: Array<{ name: string; icon?: string; member_ids: number[] }>) => apiRequest<TeamRow[]>(`${base}/classes/${id}/teams`, { token, method: 'PUT', body: { teams } });
export const leaveRequests = (token: string, id: number) => apiRequest<LeaveRow[]>(`${base}/classes/${id}/leave-requests`, { token });
export const decideLeave = (token: string, requestId: number, approve: boolean) => apiRequest<{ id: number; status: string }>(`${base}/leave-requests/${requestId}/decide`, { token, body: { approve } });
export const announce = (token: string, id: number, body: { title: string; body: string; team_id?: number | null }) => apiRequest<{ sent: number }>(`${base}/classes/${id}/announcements`, { token, body });
export const announcements = (token: string, id: number) => apiRequest<AnnouncementRow[]>(`${base}/classes/${id}/announcements`, { token });

// ---------------------------------------------------------------------- luật lớp, thưởng/phạt, sự kiện, hộp quà, huy hiệu, xếp hạng, tiến độ
export const classRules = (token: string, id: number) => apiRequest<ClassSettings>(`${base}/classes/${id}/rules`, { token });
export const saveRules = (token: string, id: number, body: Partial<Omit<ClassSettings, 'rules' | 'rules_default'>> & { rules?: Array<Partial<ClassRule>> }) => apiRequest<ClassSettings>(`${base}/classes/${id}/rules`, { token, method: 'PUT', body });
export const adjustClass = (token: string, id: number, body: AdjustInput) => apiRequest<AdjustResult>(`${base}/classes/${id}/adjust`, { token, body });
export const adjustHistory = (token: string, id: number) => apiRequest<AdjustRow[]>(`${base}/classes/${id}/history`, { token });
export const randomEvents = (token: string) => apiRequest<RandomEvent[]>(`${base}/random-events`, { token });
export const spinEvent = (token: string, id: number, body: { target: 'class' | 'team'; team_id?: number }) => apiRequest<RandomEventResult>(`${base}/classes/${id}/random-event`, { token, body });
export const classGoals = (token: string, id: number) => apiRequest<GoalRow[]>(`${base}/classes/${id}/goals`, { token });
export const createGoal = (token: string, id: number, body: { title: string; target_xp: number; reward_gold?: number; reward_xp?: number }) => apiRequest<GoalRow[]>(`${base}/classes/${id}/goals`, { token, body });
export const openGoal = (token: string, goalId: number) => apiRequest<{ opened: boolean; students: number }>(`${base}/goals/${goalId}/open`, { token, body: {} });
export const deleteGoal = (token: string, goalId: number) => apiRequest<void>(`${base}/goals/${goalId}`, { token, method: 'DELETE' });
export const awardBadge = (token: string, id: number, badgeId: number, body: { user_ids?: number[]; team_ids?: number[] }) => apiRequest<BadgeAwardResult>(`${base}/classes/${id}/badges/${badgeId}/award`, { token, body });
export const classBoard = (token: string, id: number, period: string) => apiRequest<BoardView>(`${base}/classes/${id}/board${qs({ period })}`, { token });
export const classProgress = (token: string, id: number, journeyId?: number) => apiRequest<ProgressView>(`${base}/classes/${id}/progress${qs({ journey_id: journeyId })}`, { token });

// ---------------------------------------------------------------------- giáo viên: bài tập và duyệt kỹ năng (HK.GV.045–050, 063)
export const assignmentList = (token: string, classId: number) => apiRequest<AssignmentRow[]>(`${base}/classes/${classId}/assignments`, { token });
export const createAssignment = (token: string, classId: number, body: AssignmentInput) => apiRequest<AssignmentDetail>(`${base}/classes/${classId}/assignments`, { token, body });
export const assignmentDetail = (token: string, id: number) => apiRequest<AssignmentDetail>(`${base}/assignments/${id}`, { token });
export const updateAssignment = (token: string, id: number, body: Partial<AssignmentInput>) => apiRequest<AssignmentDetail>(`${base}/assignments/${id}`, { token, method: 'PUT', body });
export const revokeAssignment = (token: string, id: number) => apiRequest<AssignmentDetail>(`${base}/assignments/${id}/revoke`, { token, body: {} });
export const gradeAssignment = (token: string, id: number, body: { user_id: number; score: number; feedback?: string | null }) =>
  apiRequest<{ user_id: number; teacher_score: number; grade: string; feedback: string | null }>(`${base}/assignments/${id}/grade`, { token, body });
export const remindAssignment = (token: string, id: number) => apiRequest<{ sent: number }>(`${base}/assignments/${id}/remind`, { token, body: {} });
/** Báo cáo riêng cho một bài tập (HK.GV.071): Excel hoặc PDF */
export const exportAssignment = (token: string, id: number, format: 'xlsx' | 'pdf') => apiBlob(`${base}/assignments/${id}/export${qs({ format })}`, token);
export const skillRequests = (token: string, classId: number) => apiRequest<SkillRequestRow[]>(`${base}/classes/${classId}/skill-requests`, { token });
export const decideSkill = (token: string, id: number, approve: boolean) => apiRequest<{ id: number; status: string; note: string | null }>(`${base}/skill-requests/${id}/decide`, { token, body: { approve } });

// ---------------------------------------------------------------------- học sinh
export const myClasses = (token: string) => apiRequest<MyClassRow[]>(`${base}/my-classes`, { token });
export const myClassDetail = (token: string, id: number) => apiRequest<MyClassDetail>(`${base}/my-classes/${id}`, { token });
export const teamBoard = (token: string, id: number, period = 'week') => apiRequest<TeamBoard>(`${base}/my-classes/${id}/team-board${qs({ period })}`, { token });
export const requestLeave = (token: string, classId: number, reason?: string) => apiRequest<{ id: number; status: string }>(`${base}/leave-requests`, { token, body: { class_id: classId, reason } });
export const myAssignments = (token: string) => apiRequest<MyAssignment[]>(`${base}/my-assignments`, { token });
export const startAssignment = (token: string, id: number) => apiRequest<StartedAssignment>(`${base}/my-assignments/${id}/start`, { token, body: {} });
export const assignmentLessonProgress = (token: string, id: number, readPercent: number) => apiRequest<{ read_percent: number }>(`${base}/my-assignments/${id}/lesson/progress`, { token, body: { read_percent: readPercent } });
export const completeAssignmentLesson = (token: string, id: number, answers: Array<{ question_id: number; answer: unknown }>) => apiRequest<LessonSubmit>(`${base}/my-assignments/${id}/lesson/complete`, { token, body: { answers } });
export const mySkills = (token: string) => apiRequest<SkillView>(`${base}/skills`, { token });
export const castSkill = (token: string, body: { skill: string; target_id?: number; attempt_id?: number }) => apiRequest<SkillUseResult>(`${base}/skills/use`, { token, body });

// ---------------------------------------------------------------------- thông báo (mọi vai trò)
export const notices = (token: string) => apiRequest<Notices>(`${base}/notifications`, { token });
export const markNoticesRead = (token: string, ids?: number[]) => apiRequest<{ ok: boolean }>(`${base}/notifications/read`, { token, body: { ids } });
