/**
 * Tùy chọn cá nhân (Sprint 11): giao diện sáng / tối lưu theo tài khoản (HK.HS.016) và cài đặt nhắc học qua thông báo trên web hoặc email (HK.HS.015).
 * Giao diện áp dụng cho học sinh; trang giáo viên và quản trị luôn dùng bảng màu sáng (xem constants/theme.ts) nên chỉ lưu lựa chọn, chưa tác dụng ở đó.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService, UserRow } from '../database/database.service';

export interface Prefs { theme: 'light' | 'dark' | 'system'; reminder_enabled: boolean; reminder_hour: number; reminder_channel: 'web' | 'email' | 'both' }
const DEFAULTS: Prefs = { theme: 'system', reminder_enabled: false, reminder_hour: 19, reminder_channel: 'web' };

@Injectable()
export class PrefsService {
  constructor(private readonly db: DatabaseService) {}

  async get(user: UserRow): Promise<Prefs & { has_email: boolean; can_remind: boolean }> {
    const row = (await this.db.query<Prefs>('SELECT theme, reminder_enabled, reminder_hour, reminder_channel FROM hk_user_prefs WHERE user_id = $1', [user.id]))[0];
    return { ...DEFAULTS, ...row, has_email: Boolean(user.email), can_remind: user.role === 'student' };
  }

  async put(user: UserRow, body: Record<string, unknown>) {
    const cur = await this.get(user);
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const theme = has('theme') ? String(body.theme) : cur.theme;
    if (!['light', 'dark', 'system'].includes(theme)) throw new BadRequestException('Giao diện là light, dark hoặc system');
    const channel = has('reminder_channel') ? String(body.reminder_channel) : cur.reminder_channel;
    if (!['web', 'email', 'both'].includes(channel)) throw new BadRequestException('Kênh nhắc là web, email hoặc both');
    const hour = has('reminder_hour') ? Number(body.reminder_hour) : cur.reminder_hour;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new BadRequestException('Giờ nhắc là số nguyên từ 0 đến 23');
    const enabled = has('reminder_enabled') ? Boolean(body.reminder_enabled) : cur.reminder_enabled;
    if (enabled && user.role !== 'student') throw new BadRequestException('Nhắc học dành cho học sinh');
    if (enabled && channel !== 'web' && !user.email) throw new BadRequestException('Hồ sơ chưa có email nên chưa nhận được nhắc học qua email; hãy chọn nhắc trên web hoặc cập nhật email trong hồ sơ');
    await this.db.query(
      `INSERT INTO hk_user_prefs (user_id, theme, reminder_enabled, reminder_hour, reminder_channel, updated_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, reminder_enabled = EXCLUDED.reminder_enabled, reminder_hour = EXCLUDED.reminder_hour, reminder_channel = EXCLUDED.reminder_channel, updated_at = now()`,
      [user.id, theme, enabled, hour, channel]);
    return this.get(user);
  }
}
