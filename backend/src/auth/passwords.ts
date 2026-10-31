/** Bcrypt for new passwords; PBKDF2 verification preserves existing accounts. */
import { BadRequestException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHash, pbkdf2, randomInt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
const pbkdf2Async = promisify(pbkdf2);
export const TEMP_ITERATIONS = 10;
export const needsPasswordUpgrade = (stored: string) => stored.startsWith('pbkdf2_sha256$');
export async function hashPassword(password: string, rounds = 12): Promise<string> {
  if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Mật khẩu tối đa 72 byte UTF-8 (ký tự có dấu có thể chiếm nhiều byte).');
  return hash(password, rounds);
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (/^\$2[aby]\$/.test(stored)) return Buffer.byteLength(password, 'utf8') <= 72 && compare(password, stored);
  const [algo, iterations, salt, digest] = stored.split('$');
  const rounds = Number(iterations);
  if (algo !== 'pbkdf2_sha256' || !salt || !digest || !Number.isInteger(rounds) || rounds < 1 || rounds > 2000000) return false;
  const expected = Buffer.from(digest, 'base64url');
  if (expected.length !== 32) return false;
  const candidate = await pbkdf2Async(password, Buffer.from(salt, 'base64url'), rounds, expected.length, 'sha256');
  return timingSafeEqual(candidate, expected);
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
