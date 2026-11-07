import { getSchoolLink } from '@/api/authApi';
import { ApiError } from '@/api/client';
import { isSchoolSlug } from '@/lib/school-link';
import { PORTAL_PATH } from '@/lib/school-portal';
import { saveToken } from '@/lib/storage';
import type { AuthUser } from '@/types/api';

/** Chỉ lấy đường dẫn chuẩn từ máy chủ; tên trường trong token hoặc URL cũ không quyết định nhận diện. */
export async function schoolSessionPath(token: string, user: AuthUser): Promise<string> {
  if (!user.school_code || user.role === 'root_admin') return PORTAL_PATH[user.role];
  const school = await getSchoolLink(`donga_${user.school_code}`);
  if (!isSchoolSlug(school.slug) || school.school_code !== user.school_code) throw new ApiError(502, 'Chưa xác định được đường dẫn đúng của trường. Hãy thử lại.');
  await saveToken(user.role, token, school.school_code);
  return `/${school.slug}?role=${user.role}`;
}
