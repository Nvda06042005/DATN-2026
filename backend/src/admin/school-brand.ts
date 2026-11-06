import { config } from '../config';
import { directoryEntry, directoryLogoHash } from './school-directory';

/** Cập nhật ảnh tham chiếu khi danh mục đổi, giữ ảnh riêng do trường tự cung cấp. */
export function currentSchoolLogo<T extends { directory_code?: string | null; logo_url?: string | null }>(school: T): T {
  const code = school.directory_code;
  if (!code || !directoryEntry(code)) return school;
  const old = school.logo_url;
  if (old && !/(?:\/api\/school-logos\/[a-f0-9]{64}|\/school-logos\/[A-Za-z0-9_-]+)\.webp$/.test(old)) return school;
  const hash = directoryLogoHash(code);
  return { ...school, logo_url: hash ? `${config.publicApiUrl}/api/school-logos/${hash}.webp` : null };
}
