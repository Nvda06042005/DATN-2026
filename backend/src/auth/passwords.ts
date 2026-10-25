/** Băm mật khẩu (PBKDF2-SHA256, tương thích tài khoản đã tạo bằng backend Python cũ), sinh mật khẩu tạm và tên đăng nhập. */
import { createHash, pbkdf2, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 240_000;
/**
 * Mật khẩu mặc định cấp hàng loạt từ file Excel (bắt buộc đổi ở lần đăng nhập đầu): ít vòng hơn để nhập hàng trăm dòng
 * không quá lâu trên máy chủ gói miễn phí; mật khẩu người dùng tự đặt luôn băm 240.000 vòng.
 */
export const TEMP_ITERATIONS = 20_000;

export async function hashPassword(password: string, iterations = ITERATIONS): Promise<string> {
  const salt = randomBytes(16);
  const digest = await pbkdf2Async(password, salt, iterations, 32, 'sha256');
  return `pbkdf2_sha256$${iterations}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterations, salt, digest] = stored.split('$');
  if (algo !== 'pbkdf2_sha256' || !salt || !digest || !Number(iterations)) return false;
  const expected = Buffer.from(digest, 'base64url');
  const candidate = await pbkdf2Async(password, Buffer.from(salt, 'base64url'), Number(iterations), expected.length, 'sha256');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Dấu vân tay của mật khẩu hiện tại: đổi/đặt lại mật khẩu thì token cũ tự mất hiệu lực. */
export const passwordFingerprint = (passwordHash: string): string => createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // bỏ ký tự dễ nhầm: i, l, o, 0, 1

/** Mật khẩu tạm dễ đọc cho học sinh, ví dụ k7m3-px9q */
export function generatePassword(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** "Nguyễn Văn Long" -> học sinh: long.nv, giáo viên: gv.long.nv */
export function baseUsername(fullName: string, role: string): string {
  const slug = fullName
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .split('')
    .filter((c) => /[\p{L}\p{N} ]/u.test(c))
    .join('')
    .trim();
  const parts = slug.split(/\s+/).filter(Boolean);
  let base = !parts.length ? 'user' : parts.length === 1 ? parts[0] : `${parts[parts.length - 1]}.${parts.slice(0, -1).map((p) => p[0]).join('')}`;
  base = base.slice(0, 24);
  return role === 'teacher' ? `gv.${base}` : base;
}
