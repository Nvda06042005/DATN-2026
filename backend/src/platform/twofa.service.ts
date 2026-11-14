/**
 * Xác thực hai lớp cho tài khoản quản trị (Sprint 11, HK.AD.002): bật tùy chọn, quản trị tổng và quản trị trường nhập thêm mã khi đăng nhập.
 * Hai cách: mã 6 chữ số gửi qua email (hiệu lực 5 phút, tối đa 5 lần thử) hoặc ứng dụng xác thực TOTP theo RFC 6238 (SHA-1, 30 giây, 6 chữ số, lệch ±1 bước).
 * Kèm 8 mã dự phòng dùng một lần (chỉ lưu băm). Bí mật TOTP lưu mã hóa AES-256-GCM, khóa dẫn xuất từ AUTH_SECRET_KEY nên chỉ bật TOTP khi biến này đã đặt
 * (không thì khóa đổi mỗi lần khởi động và mã bị mất). Khẩn cấp: đặt TWO_FACTOR_BYPASS=true trên máy chủ để tạm bỏ bước này, hoặc quản trị tổng cấp 1 đặt lại cho tài khoản khác.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import { MailService } from '../admin/mail.service';
import { passwordFingerprint, verifyPassword } from '../auth/passwords';
import { config } from '../config';
import { DatabaseService, UserRow } from '../database/database.service';
import { assertSystemAdmin } from './system.service';

const ELIGIBLE = ['root_admin', 'school_admin'];
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const EMAIL_TTL_MIN = 5;
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const same = (a: string, b: string): boolean => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export const base32 = (buf: Buffer): string => {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};
export const unbase32 = (text: string): Buffer => {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of text.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
};

/** Mã TOTP tại một bước thời gian (RFC 6238 / RFC 4226) */
export function totp(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', secret).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: Buffer, code: string, now = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const step = Math.floor(now / 30_000);
  for (let d = -window; d <= window; d += 1) if (same(totp(secret, step + d), code)) return true;
  return false;
}

interface Row { user_id: number; method: 'email' | 'totp'; totp_secret_enc: string | null; enabled: boolean; backup_hashes: string[] }

/** Hộp thư nhận mã đăng nhập hai lớp: email chính và email khôi phục (nếu có, migration 061), không trùng nhau */
export const loginMailboxes = (user: Pick<UserRow, 'email' | 'recovery_email'>): string[] =>
  [...new Set([user.email, user.recovery_email].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];

@Injectable()
export class TwoFactorService {
  private readonly key = createHash('sha256').update(`dong-a-2fa:${config.authSecret}`).digest();
  private readonly failed = new Map<number, { fails: number; since: number }>();

  constructor(private readonly db: DatabaseService, private readonly mail: MailService) {}

  private encrypt(plain: string): string {
    const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
  }

  private decrypt(text: string | null): string | null {
    if (!text) return null;
    try {
      const raw = Buffer.from(text, 'base64'), d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    } catch { return null; }
  }

  private async row(userId: number): Promise<Row | null> {
    return (await this.db.query<Row>('SELECT user_id, method, totp_secret_enc, enabled, backup_hashes FROM hk_two_factor WHERE user_id = $1', [userId]))[0] ?? null;
  }

  /** Khi đăng nhập: tài khoản này có phải nhập mã thứ hai không (và bằng cách nào) */
  async requirement(user: UserRow): Promise<{ method: 'email' | 'totp' } | null> {
    if (process.env.TWO_FACTOR_BYPASS === 'true' || !ELIGIBLE.includes(user.role)) return null;
    const r = await this.row(user.id);
    return r?.enabled ? { method: r.method } : null;
  }

  async status(user: UserRow) {
    if (!ELIGIBLE.includes(user.role)) return { eligible: false, enabled: false, method: null, backup_codes_left: 0, has_email: Boolean(user.email), totp_available: config.authSecretFromEnv };
    const r = await this.row(user.id);
    return { eligible: true, enabled: Boolean(r?.enabled), method: r?.method ?? null, pending: Boolean(r && !r.enabled), backup_codes_left: r?.enabled ? r.backup_hashes.length : 0, has_email: Boolean(user.email), totp_available: config.authSecretFromEnv };
  }

  // ---------------------------------------------------------------------- bật hai lớp
  async setup(user: UserRow, methodRaw: unknown) {
    if (!ELIGIBLE.includes(user.role)) throw new ForbiddenException('Chỉ tài khoản quản trị dùng xác thực hai lớp');
    if ((await this.row(user.id))?.enabled) throw new ConflictException('Xác thực hai lớp đã bật; hãy tắt trước khi đổi cách');
    const method = String(methodRaw);
    if (method === 'email') {
      if (!user.email) throw new BadRequestException('Tài khoản chưa có email trong hồ sơ nên không nhận được mã');
      if (!this.mail.configured) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư nên chưa dùng được mã qua email');
      await this.db.query(`INSERT INTO hk_two_factor (user_id, method, enabled) VALUES ($1, 'email', false) ON CONFLICT (user_id) DO UPDATE SET method = 'email', totp_secret_enc = NULL, enabled = false`, [user.id]);
      await this.sendEmailCode(user, true);
      return { method, sent_to: loginMailboxes(user).map((e) => e.replace(/^(.).*(@.*)$/, '$1***$2')).join(' và ') };
    }
    if (method === 'totp') {
      if (!config.authSecretFromEnv) throw new ServiceUnavailableException('Máy chủ chưa đặt AUTH_SECRET_KEY cố định nên chưa bật được ứng dụng xác thực');
      const secret = randomBytes(20), text = base32(secret);
      await this.db.query(`INSERT INTO hk_two_factor (user_id, method, totp_secret_enc, enabled) VALUES ($1, 'totp', $2, false) ON CONFLICT (user_id) DO UPDATE SET method = 'totp', totp_secret_enc = $2, enabled = false`, [user.id, this.encrypt(text)]);
      const uri = `otpauth://totp/${encodeURIComponent('Đông A EDU')}:${encodeURIComponent(user.username)}?secret=${text}&issuer=${encodeURIComponent('Đông A EDU')}&algorithm=SHA1&digits=6&period=30`;
      return { method, secret: text, otpauth_uri: uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
    }
    throw new BadRequestException('Cách xác thực là email hoặc totp');
  }

  /** Xác nhận mã đầu tiên để bật; trả 8 mã dự phòng (chỉ hiện một lần) */
  async enable(user: UserRow, code: string) {
    const r = await this.row(user.id);
    if (!r) throw new BadRequestException('Hãy chọn cách xác thực trước');
    if (r.enabled) throw new ConflictException('Xác thực hai lớp đã bật');
    if (!(await this.checkCode(user, r, code, false))) throw new BadRequestException('Mã không đúng hoặc đã hết hạn');
    const codes = this.newBackupCodes();
    await this.db.query('UPDATE hk_two_factor SET enabled = true, confirmed_at = now(), backup_hashes = $2 WHERE user_id = $1', [user.id, codes.map((c) => sha(`${user.id}:${c}`))]);
    await this.db.query('DELETE FROM hk_two_factor_codes WHERE user_id = $1', [user.id]);
    return { enabled: true, method: r.method, backup_codes: codes };
  }

  /** Tắt cần cả mật khẩu hiện tại và một mã hợp lệ (kể cả mã dự phòng) */
  async disable(user: UserRow, password: string, code: string) {
    const r = await this.row(user.id);
    if (!r) return { enabled: false };
    if (!(await verifyPassword(String(password ?? ''), user.password_hash))) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    if (r.enabled && !(await this.verify(user, code))) throw new BadRequestException('Mã không đúng hoặc đã hết hạn');
    await this.db.query('DELETE FROM hk_two_factor WHERE user_id = $1', [user.id]);
    return { enabled: false };
  }

  async regenerateBackup(user: UserRow, code: string) {
    const r = await this.row(user.id);
    if (!r?.enabled) throw new BadRequestException('Chưa bật xác thực hai lớp');
    if (!(await this.checkCode(user, r, code, false))) throw new BadRequestException('Mã không đúng hoặc đã hết hạn');
    const codes = this.newBackupCodes();
    await this.db.query('UPDATE hk_two_factor SET backup_hashes = $2 WHERE user_id = $1', [user.id, codes.map((c) => sha(`${user.id}:${c}`))]);
    return { backup_codes: codes };
  }

  /** Quản trị tổng cấp 1 đặt lại hai lớp cho tài khoản quản trị khác (khi họ mất thiết bị và mã dự phòng) */
  async reset(actor: UserRow, targetId: number) {
    assertSystemAdmin(actor);
    if (actor.id === targetId) throw new BadRequestException('Hãy tự tắt bằng mật khẩu và mã của bạn');
    const target = await this.db.getById(targetId);
    if (!target || !ELIGIBLE.includes(target.role)) throw new NotFoundException('Không tìm thấy tài khoản quản trị');
    await this.db.query('DELETE FROM hk_two_factor WHERE user_id = $1', [targetId]);
    return { reset: true };
  }

  private newBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => { const h = randomBytes(4).toString('hex'); return `${h.slice(0, 4)}-${h.slice(4)}`; });
  }

  // ---------------------------------------------------------------------- mã qua email
  async sendEmailCode(user: UserRow, force = false): Promise<void> {
    if (!user.email) throw new BadRequestException('Tài khoản chưa có email');
    const last = (await this.db.query<{ age: number }>('SELECT EXTRACT(EPOCH FROM now() - created_at)::int AS age FROM hk_two_factor_codes WHERE user_id = $1', [user.id]))[0];
    if (last && last.age < 30 && !force) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.query(
      `INSERT INTO hk_two_factor_codes (user_id, code_hash, expires_at, attempts, created_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval, 0, now())
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now()`, [user.id, sha(`${user.id}:${code}`), String(EMAIL_TTL_MIN)]);
    // một mã, gửi cùng lúc tới email chính và email khôi phục (yêu cầu 14/11/2026): ai giữ một trong hai hộp thư đều đăng nhập được
    for (const to of loginMailboxes(user)) await this.mail.sendPasswordOtp(to, user.full_name, code, EMAIL_TTL_MIN, 'login');
  }

  // ---------------------------------------------------------------------- kiểm tra mã khi đăng nhập
  private lock(userId: number): void {
    const f = this.failed.get(userId);
    if (f && f.fails >= 5 && Date.now() - f.since < 15 * 60_000) throw new UnauthorizedException('Nhập sai mã quá nhiều lần. Thử lại sau 15 phút.');
  }

  /** Đúng nếu là mã hiện hành (email / TOTP) hoặc một mã dự phòng chưa dùng; `consume` = dùng xong thì thu hồi mã dự phòng và mã email */
  private async checkCode(user: UserRow, r: Row, raw: string, consume: boolean): Promise<boolean> {
    const code = String(raw ?? '').trim().toLowerCase();
    if (!code) return false;
    if (/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(code) && r.enabled) {
      const h = sha(`${user.id}:${code}`);
      if (r.backup_hashes.includes(h)) {
        if (consume) await this.db.query('UPDATE hk_two_factor SET backup_hashes = array_remove(backup_hashes, $2) WHERE user_id = $1', [user.id, h]);
        return true;
      }
      return false;
    }
    if (!/^\d{6}$/.test(code)) return false;
    if (r.method === 'totp') {
      const secret = this.decrypt(r.totp_secret_enc);
      return secret ? verifyTotp(unbase32(secret), code) : false;
    }
    const row = (await this.db.query<{ code_hash: string; attempts: number; ok: boolean }>('SELECT code_hash, attempts, expires_at > now() AS ok FROM hk_two_factor_codes WHERE user_id = $1', [user.id]))[0];
    if (!row || !row.ok || row.attempts >= 5) return false;
    if (same(row.code_hash, sha(`${user.id}:${code}`))) {
      await this.db.query('DELETE FROM hk_two_factor_codes WHERE user_id = $1', [user.id]);
      return true;
    }
    await this.db.query('UPDATE hk_two_factor_codes SET attempts = attempts + 1 WHERE user_id = $1', [user.id]);
    return false;
  }

  /** Dùng ở bước đăng nhập thứ hai và khi tắt: đúng thì xóa bộ đếm sai, sai thì tính một lần */
  async verify(user: UserRow, code: string): Promise<boolean> {
    this.lock(user.id);
    const r = await this.row(user.id);
    if (!r?.enabled) return false;
    const ok = await this.checkCode(user, r, code, true);
    if (ok) this.failed.delete(user.id);
    else this.failed.set(user.id, { fails: (this.failed.get(user.id)?.fails ?? 0) + 1, since: this.failed.get(user.id)?.since ?? Date.now() });
    return ok;
  }

  /** Phát hành mã thử thách ngắn hạn cho bước hai (ký bằng cùng khóa phiên nhưng không dùng được làm token phiên vì thiếu vai trò) */
  fingerprint(user: UserRow): string { return passwordFingerprint(user.password_hash); }
}
