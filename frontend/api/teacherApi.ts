import type { TeacherClass } from '@/types/teacherType';
import { apiRequest } from '@/utils/http';

/** Lớp phụ trách: học sinh thật, tóm tắt, câu sai nhiều, mức nắm vững, học sinh cần hỗ trợ */
export const getMyClass = (token: string) => apiRequest<TeacherClass>('/api/teacher/class', { token });
