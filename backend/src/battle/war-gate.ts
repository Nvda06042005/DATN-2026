/**
 * Kiểm soát việc chơi game mô phỏng trận đánh (HK.QT.056 và công tắc toàn hệ thống): bật/tắt cho toàn hệ thống, cho trường (theo khối lớp),
 * khung giờ được chơi và thời gian tối đa mỗi ngày. Quy tắc khi nhiều cấp đặt khác nhau: **cấp nào chặt hơn thì thắng** (giới hạn thời gian lấy giá trị nhỏ nhất).
 * Mốc ngày và giờ tính theo giờ Việt Nam; học và làm bài vẫn bình thường khi game đóng. Chỉ áp dụng cho học sinh.
 */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Q, UserRow } from '../database/database.service';
import { dayKey, GameClock } from '../game/clock';
import { SettingsService } from '../game/settings';

export interface WarStatus { open: boolean; reason: string | null; used_minutes: number; limit_minutes: number | null }
interface SchoolWar { war_enabled: boolean; war_grades: number[]; war_from: string | null; war_to: string | null; war_minutes: number | null }

/** Số giây tối đa tính cho mỗi hành động để việc để máy chạy không "ăn" hết thời gian chơi */
const MAX_STEP_SECONDS = 120;
const hm = (t: string): number => { const [h, m] = t.split(':'); return Number(h) * 60 + Number(m); };

@Injectable()
export class WarGate {
  constructor(private readonly settings: SettingsService, private readonly clock: GameClock) {}

  private async school(q: Q, schoolId: number | null): Promise<SchoolWar | null> {
    if (!schoolId) return null;
    return (await q<SchoolWar>('SELECT war_enabled, war_grades, war_from::text AS war_from, war_to::text AS war_to, war_minutes FROM hk_school_settings WHERE school_id = $1', [schoolId]))[0] ?? null;
  }

  /** Lý do game đang đóng với học sinh này, hoặc null nếu được chơi */
  async status(q: Q, user: UserRow): Promise<WarStatus> {
    const s = await this.settings.get();
    const used = Number((await q<{ s: string }>('SELECT COALESCE(sum(seconds), 0) AS s FROM hk_war_play WHERE user_id = $1 AND day = $2', [user.id, dayKey(this.clock.now())]))[0].s);
    const closed = (reason: string, limit: number | null = null): WarStatus => ({ open: false, reason, used_minutes: Math.floor(used / 60), limit_minutes: limit });
    if (user.role !== 'student') return { open: true, reason: null, used_minutes: 0, limit_minutes: null };
    if (!s.war.enabled) return closed('Game trận đánh đang tạm tắt trên toàn hệ thống.');
    const sch = await this.school(q, user.school_id);
    let limit = s.war.daily_minutes > 0 ? s.war.daily_minutes : null;
    if (sch) {
      if (!sch.war_enabled) return closed('Nhà trường đang tắt game trận đánh.');
      if (sch.war_grades?.length) {
        const grades = (await q<{ grade: number | null }>('SELECT c.grade FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1', [user.id])).map((r) => r.grade).filter((g): g is number => g !== null);
        if (grades.length && !grades.some((g) => sch.war_grades.includes(g))) return closed(`Game trận đánh của trường mở cho khối ${sch.war_grades.join(', ')}.`);
      }
      if (sch.war_from && sch.war_to) {
        const vn = new Date(this.clock.now().getTime() + 7 * 3600_000);
        const now = vn.getUTCHours() * 60 + vn.getUTCMinutes();
        const from = hm(sch.war_from), to = hm(sch.war_to);
        const inside = from <= to ? now >= from && now < to : now >= from || now < to;
        if (!inside) return closed(`Game trận đánh chỉ mở từ ${sch.war_from.slice(0, 5)} đến ${sch.war_to.slice(0, 5)}.`);
      }
      if (sch.war_minutes) limit = limit === null ? sch.war_minutes : Math.min(limit, sch.war_minutes);
    }
    if (limit !== null && used >= limit * 60) return closed('Hôm nay em đã chơi đủ thời gian. Em vẫn học và làm bài bình thường nhé!', limit);
    return { open: true, reason: null, used_minutes: Math.floor(used / 60), limit_minutes: limit };
  }

  async assertOpen(q: Q, user: UserRow): Promise<void> {
    const st = await this.status(q, user);
    if (!st.open) throw new ForbiddenException(st.reason);
  }

  /** Ghi thời gian chơi: số giây từ lần thao tác trước (tối đa MAX_STEP_SECONDS mỗi lần) */
  async addPlay(q: Q, user: UserRow, sinceMs: number): Promise<void> {
    if (user.role !== 'student') return;
    const seconds = Math.max(5, Math.min(MAX_STEP_SECONDS, Math.round(sinceMs / 1000)));
    await q('INSERT INTO hk_war_play (user_id, day, seconds) VALUES ($1, $2, $3) ON CONFLICT (user_id, day) DO UPDATE SET seconds = hk_war_play.seconds + $3', [user.id, dayKey(this.clock.now()), seconds]);
  }
}
