/**
 * Lịch chốt giải đấu tuần (HK.AD.054): hàm thuần nên kiểm tra không cần cơ sở dữ liệu. Mặc định (thứ Hai) phải trùng khóa tuần cũ để dữ liệu đã lưu không đổi;
 * đổi ngày chốt không cắt ngang tuần đang chạy mà có hiệu lực từ tuần kế tiếp, tuần đầu của lịch mới có thể ngắn hơn 7 ngày.
 */
import { addDays, DEFAULT_LEAGUE_SCHEDULE, isoWeekday, lastWeekday, leagueWeekOf, LeagueSchedule, nextWeekday, reconcileSchedule, sameSchedule, settleSchedule, weekKey } from '../src/game/clock';

/** Thời điểm theo giờ Việt Nam */
const at = (key: string, time = '12:00:00'): Date => new Date(`${key}T${time}+07:00`);

describe('thứ trong tuần', () => {
  test('1 = thứ Hai … 7 = Chủ nhật; ngày gần nhất / kế tiếp mang một thứ nhất định', () => {
    expect(isoWeekday('2026-11-02')).toBe(1); // thứ Hai
    expect(isoWeekday('2026-11-08')).toBe(7); // Chủ nhật
    expect(lastWeekday('2026-11-04', 1)).toBe('2026-11-02');
    expect(lastWeekday('2026-11-02', 1)).toBe('2026-11-02'); // chính ngày đó nếu trùng thứ
    expect(lastWeekday('2026-11-04', 6)).toBe('2026-10-31'); // thứ Bảy gần nhất trước thứ Tư
    expect(nextWeekday('2026-11-02', 1)).toBe('2026-11-09'); // sau, không tính chính ngày đó
    expect(nextWeekday('2026-11-04', 4)).toBe('2026-11-05');
    expect(nextWeekday('2026-11-08', 1)).toBe('2026-11-09');
  });
});

describe('lịch mặc định (thứ Hai) trùng khóa tuần cũ', () => {
  test('mọi thời điểm trong 60 ngày, kể cả sát nửa đêm giờ Việt Nam, cho cùng khóa và tuần dài 7 ngày', () => {
    for (let i = 0; i < 60; i += 1) {
      for (const time of ['00:00:00', '12:30:00', '23:59:59']) {
        const day = addDays('2026-09-01', i);
        const w = leagueWeekOf(DEFAULT_LEAGUE_SCHEDULE, at(day, time));
        expect([day, time, w.key]).toEqual([day, time, weekKey(at(day, time))]);
        expect(w.ends_on).toBe(addDays(w.key, 7));
      }
    }
  });
  test('ranh giới đúng lúc 0 giờ thứ Hai giờ Việt Nam', () => {
    expect(leagueWeekOf(DEFAULT_LEAGUE_SCHEDULE, new Date('2026-11-01T16:59:59Z')).key).toBe('2026-10-26'); // 23:59:59 Chủ nhật
    expect(leagueWeekOf(DEFAULT_LEAGUE_SCHEDULE, new Date('2026-11-01T17:00:00Z')).key).toBe('2026-11-02'); // 00:00:00 thứ Hai
  });
});

describe('lịch chốt vào thứ khác', () => {
  const saturday: LeagueSchedule = { weekday: 6, from: null, next: null };
  test('tuần bắt đầu vào thứ Bảy và kết thúc vào thứ Bảy kế tiếp', () => {
    for (const day of ['2026-10-31', '2026-11-02', '2026-11-04', '2026-11-06']) expect(leagueWeekOf(saturday, at(day))).toEqual({ key: '2026-10-31', ends_on: '2026-11-07' });
    expect(leagueWeekOf(saturday, at('2026-11-07'))).toEqual({ key: '2026-11-07', ends_on: '2026-11-14' });
  });
});

describe('đổi ngày chốt có hiệu lực từ tuần kế tiếp', () => {
  const wednesday = at('2026-11-04');
  test('hẹn lịch mới từ hết tuần đang chạy; tuần đang chạy không đổi khóa, không đổi ngày kết thúc', () => {
    const s = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 4, wednesday); // thứ Năm
    expect(s).toEqual({ weekday: 1, from: null, next: { weekday: 4, from: '2026-11-09' } });
    expect(leagueWeekOf(s, wednesday)).toEqual({ key: '2026-11-02', ends_on: '2026-11-09' });
    expect(leagueWeekOf(s, at('2026-11-08'))).toEqual({ key: '2026-11-02', ends_on: '2026-11-09' }); // Chủ nhật vẫn tuần cũ
  });
  test('tuần đầu của lịch mới ngắn (từ thứ Hai tới thứ Năm), rồi các tuần sau đủ 7 ngày theo thứ mới', () => {
    const s = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 4, wednesday);
    expect(leagueWeekOf(s, at('2026-11-09'))).toEqual({ key: '2026-11-09', ends_on: '2026-11-12' });
    expect(leagueWeekOf(s, at('2026-11-11'))).toEqual({ key: '2026-11-09', ends_on: '2026-11-12' });
    expect(leagueWeekOf(s, at('2026-11-12'))).toEqual({ key: '2026-11-12', ends_on: '2026-11-19' });
    expect(leagueWeekOf(s, at('2026-11-18'))).toEqual({ key: '2026-11-12', ends_on: '2026-11-19' });
    expect(leagueWeekOf(s, at('2026-11-19'))).toEqual({ key: '2026-11-19', ends_on: '2026-11-26' });
  });
  test('khóa tuần luôn tăng dần qua lúc chuyển lịch (để việc chốt "các tuần trước tuần hiện tại" đúng)', () => {
    const s = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 6, wednesday);
    let prev = '';
    for (let i = 0; i < 40; i += 1) {
      const key = leagueWeekOf(s, at(addDays('2026-11-02', i))).key;
      expect(key >= prev).toBe(true);
      prev = key;
    }
    expect(prev > '2026-11-02').toBe(true);
  });
  test('đổi lại như cũ trước khi có hiệu lực thì hủy lịch chờ; đổi sang thứ khác thì thay lịch chờ', () => {
    const s = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 4, wednesday);
    expect(reconcileSchedule(s, 1, at('2026-11-05'))).toEqual(DEFAULT_LEAGUE_SCHEDULE);
    expect(reconcileSchedule(s, 6, at('2026-11-05'))).toEqual({ weekday: 1, from: null, next: { weekday: 6, from: '2026-11-09' } });
    expect(reconcileSchedule(s, 4, at('2026-11-05'))).toBe(s); // đã khớp thì giữ nguyên
  });
  test('đối chiếu nhiều lần cho cùng kết quả (nhiều yêu cầu cùng lúc ghi cùng giá trị)', () => {
    const once = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 4, wednesday);
    const again = reconcileSchedule(once, 4, at('2026-11-06'));
    expect(sameSchedule(once, again)).toBe(true);
  });
  test('lịch chờ tới hạn thì thành lịch hiện tại (giữ ngày bắt đầu), lần đổi sau hẹn từ hết tuần lúc đó', () => {
    const s = reconcileSchedule(DEFAULT_LEAGUE_SCHEDULE, 4, wednesday);
    expect(settleSchedule(s, '2026-11-08')).toBe(s);
    expect(settleSchedule(s, '2026-11-09')).toEqual({ weekday: 4, from: '2026-11-09', next: null });
    // thứ Sáu 13/11: tuần đang chạy bắt đầu từ thứ Năm 12/11, hết vào thứ Năm 19/11
    const next = reconcileSchedule(s, 6, at('2026-11-13'));
    expect(next).toEqual({ weekday: 4, from: '2026-11-09', next: { weekday: 6, from: '2026-11-19' } });
    expect(leagueWeekOf(next, at('2026-11-13'))).toEqual({ key: '2026-11-12', ends_on: '2026-11-19' });
    expect(leagueWeekOf(next, at('2026-11-19'))).toEqual({ key: '2026-11-19', ends_on: '2026-11-21' }); // thứ Bảy 21/11 mới sang tuần đủ 7 ngày
    expect(leagueWeekOf(next, at('2026-11-21'))).toEqual({ key: '2026-11-21', ends_on: '2026-11-28' });
  });
});
