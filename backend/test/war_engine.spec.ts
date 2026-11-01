/**
 * Động cơ đánh theo lượt bằng thẻ tướng (HK.HS.131–136, HK.SYS.022): hàm thuần nên kiểm tra không cần cơ sở dữ liệu.
 * Cùng hạt giống cho cùng kết quả; chiêu thức, nộ, tuyệt kỹ, địa hình, báo trước chiêu lớn, thẻ chiến thuật, tự động đánh, sao.
 */
import { advance, autoPlay, AllyInput, cardStats, createBattle, publicView, resolveUltimate, starsOf, MoveDef, WaveDef } from '../src/battle/war-engine';

const normal: MoveDef = { slot: 'normal', name: 'Đánh thường', target: 'enemy_one', power: 1, rage_cost: 0, cooldown: 0 };
const active: MoveDef = { slot: 'active', name: 'Xung phong', target: 'enemy_one', power: 1.8, rage_cost: 40, cooldown: 2 };
const ultimate: MoveDef = { slot: 'ultimate', name: 'Tổng tấn công', target: 'enemy_all', power: 1.5, rage_cost: 100, cooldown: 0 };
const heal: MoveDef = { slot: 'active', name: 'Hịch', target: 'ally_all', power: 0, effect: { type: 'heal', value: 0.3 }, rage_cost: 40, cooldown: 2 };

const ally = (i: number, over: Partial<AllyInput> = {}): AllyInput => ({
  id: `a${i}`, name: `Tướng ${i}`, card_id: i, code: `t${i}`, branch: 'bo', level: 1, stars: 1,
  stats: cardStats({ atk: 100, def: 60, hp: 800, spd: 10 + i }, 1, 1), moves: [normal, active, ultimate], ...over,
});
const easy: WaveDef[] = [{ label: 'Quân tiền phong', units: [{ name: 'Lính Nguyên', hp: 400, atk: 60, def: 30, spd: 8 }, { name: 'Lính Nguyên', hp: 400, atk: 60, def: 30, spd: 8 }] }];
const commanderWave: WaveDef[] = [{ units: [{ name: 'Thoát Hoan', hp: 2500, atk: 120, def: 60, spd: 9, commander: true }] }];

describe('chỉ số thẻ theo cấp và sao', () => {
  test('mỗi cấp +10% và mỗi sao +20% so với cấp 1, 1 sao', () => {
    expect(cardStats({ atk: 100, def: 60, hp: 800, spd: 10 }, 1, 1)).toEqual({ atk: 100, def: 60, hp: 800, spd: 10 });
    expect(cardStats({ atk: 100, def: 60, hp: 800, spd: 10 }, 3, 1)).toEqual({ atk: 120, def: 72, hp: 960, spd: 10 });
    expect(cardStats({ atk: 100, def: 60, hp: 800, spd: 10 }, 1, 5)).toEqual({ atk: 180, def: 108, hp: 1440, spd: 10 });
  });
});

describe('trận đánh theo lượt', () => {
  test('cùng hạt giống thì cùng diễn biến (để máy chủ phát lại và kiểm tra)', () => {
    const run = () => autoPlay(createBattle({ allies: [ally(1), ally(2), ally(3)], waves: easy, seed: 42 }), 1);
    const a = run(), b = run();
    expect(a.log).toEqual(b.log);
    expect(a.status).toBe(b.status);
    const other = autoPlay(createBattle({ allies: [ally(1), ally(2), ally(3)], waves: easy, seed: 43 }), 1);
    expect(other.log).not.toEqual(a.log);
  });

  test('ba tướng thắng một đợt quân thường trong vài vòng; ba sao khi không ai ngã và thắng nhanh', () => {
    const s = autoPlay(createBattle({ allies: [ally(1), ally(2), ally(3)], waves: easy, seed: 7 }), 1);
    expect(s.status).toBe('won');
    expect(s.turn).toBeLessThanOrEqual(5);
    expect(starsOf(s)).toBe(3);
  });

  test('người chơi chọn từng đòn: đòn thường tăng nộ, chiêu chủ động tốn nộ và có hồi chiêu, không đủ nộ bị từ chối', () => {
    const s = createBattle({ allies: [ally(1), ally(2)], waves: easy, seed: 1 });
    expect(advance(s, null).ok).toBe(true);
    const first = s.units[s.actor!];
    expect(first.side).toBe('ally');
    expect(publicView(s).available).toEqual(['normal']);
    expect(advance(s, { type: 'move', slot: 'active', target: 'e1-1' })).toMatchObject({ ok: false });
    expect(advance(s, { type: 'move', slot: 'normal', target: 'e1-1' }).ok).toBe(true);
    expect(first.rage).toBe(25);
    expect(s.units['e1-1'].hp).toBeLessThan(400);
    // đánh thêm cho đủ nộ rồi dùng chiêu chủ động
    first.rage = 60;
    s.actor = first.id; s.awaiting = true;
    const hp = s.units['e1-2'].hp;
    expect(advance(s, { type: 'move', slot: 'active', target: 'e1-2' }).ok).toBe(true);
    expect(s.units['e1-2'].hp).toBeLessThan(hp - 100);
    expect(first.rage).toBeLessThan(60); // tốn 40 nộ
    expect(first.cd.active).toBeGreaterThan(0); // đang hồi chiêu (giảm dần mỗi lượt)
    expect(publicView(s).available).not.toContain('active');
  });

  test('tuyệt kỹ cần nộ đầy và một câu hỏi: trả lời đúng kịp giờ gây sát thương gần gấp ba so với trả lời sai', () => {
    const dmg = (correct: boolean) => {
      const s = createBattle({ allies: [ally(1)], waves: [{ units: [{ name: 'Địch', hp: 100000, atk: 1, def: 50, spd: 1 }] }], seed: 5 });
      advance(s, null);
      s.units.a1.rage = 100;
      expect(advance(s, { type: 'move', slot: 'ultimate', target: 'e1-1' }).ok).toBe(true);
      expect(s.pending).toMatchObject({ unit: 'a1', slot: 'ultimate' });
      expect(advance(s, { type: 'move', slot: 'normal' }).ok).toBe(false); // chờ trả lời
      resolveUltimate(s, { correct, inTime: true });
      expect(s.pending).toBeNull();
      expect(s.units.a1.rage).toBeLessThan(100);
      return 100000 - s.units['e1-1'].hp;
    };
    const strong = dmg(true), weak = dmg(false);
    expect(strong / weak).toBeGreaterThan(2.3);
    expect(strong / weak).toBeLessThan(3.1);
  });

  test('chỉ huy địch báo trước chiêu lớn một lượt; phòng thủ giảm một nửa sát thương của chiêu đó', () => {
    const run = (guard: boolean) => {
      const s = createBattle({ allies: [ally(1, { stats: { atk: 10, def: 60, hp: 50000, spd: 5 } })], waves: commanderWave, seed: 3 });
      let telegraphSeen = false, hitBefore = 0;
      for (let i = 0; i < 40 && s.status === 'active'; i += 1) {
        advance(s, null);
        if (s.telegraph && !telegraphSeen) { telegraphSeen = true; expect(s.telegraph.targets).toContain('a1'); hitBefore = s.units.a1.hp; }
        if (!s.awaiting) break;
        if (telegraphSeen && guard) advance(s, { type: 'guard' }); else advance(s, { type: 'move', slot: 'normal', target: 'e1-1' });
        if (telegraphSeen && !s.telegraph) return { lost: hitBefore - s.units.a1.hp, seen: true };
      }
      return { lost: 0, seen: telegraphSeen };
    };
    const open = run(false), guarded = run(true);
    expect(open.seen).toBe(true);
    expect(guarded.lost).toBeLessThan(open.lost * 0.75);
  });

  test('địa hình: thiếu lương làm địch mất máu mỗi vòng; cọc ngầm khi nước rút chỉ hại thuyền; thủy binh mạnh hơn trên sông', () => {
    const waves: WaveDef[] = [{ units: [{ name: 'Thuyền chiến', branch: 'thuy', hp: 1000, atk: 1, def: 30, spd: 1 }, { name: 'Kỵ binh', branch: 'ky', hp: 1000, atk: 1, def: 30, spd: 1 }] }];
    const s = createBattle({ allies: [ally(1, { branch: 'thuy' })], waves, terrain: { tide: { cycle: 4 }, stakes: { pct: 0.1 }, hunger: { pct: 0.05, from_turn: 3 }, water_bonus: { thuy: 0.25 } }, seed: 9 });
    expect(publicView(s).tide).toBe('high');
    const logText = () => s.log.map((l) => l.text).join('\n');
    for (let i = 0; i < 12 && s.status === 'active'; i += 1) { advance(s, null); if (s.awaiting) advance(s, { type: 'guard' }); }
    expect(logText()).toMatch(/Bãi cọc ngầm làm thuyền Thuyền chiến/);
    expect(logText()).not.toMatch(/Bãi cọc ngầm làm thuyền Kỵ binh/);
    expect(logText()).toMatch(/Thiếu lương, Kỵ binh yếu đi/);
    // thủy binh có thưởng địa hình: cùng chỉ số thì gây sát thương nhiều hơn bộ binh
    const hit = (branch: 'thuy' | 'bo') => {
      const t = createBattle({ allies: [ally(1, { branch })], waves: [{ units: [{ name: 'Địch', hp: 10000, atk: 1, def: 50, spd: 1 }] }], terrain: { water_bonus: { thuy: 0.25 } }, seed: 11 });
      advance(t, null); advance(t, { type: 'move', slot: 'normal', target: 'e1-1' });
      return 10000 - t.units['e1-1'].hp;
    };
    expect(hit('thuy') / hit('bo')).toBeGreaterThan(1.15);
  });

  test('thẻ chiến thuật dùng một lần mỗi trận và không mất lượt; Vườn không nhà trống làm địch thiếu lương', () => {
    const s = createBattle({ allies: [ally(1)], waves: easy, tactic: { name: 'Vườn không nhà trống', effect: 'hunger', value: 0.1, turns: 3 }, seed: 2 });
    advance(s, null);
    expect(advance(s, { type: 'tactic' }).ok).toBe(true);
    expect(s.awaiting).toBe(true); // vẫn đang chờ chọn đòn của tướng
    expect(s.units['e1-1'].fx.some((e) => e.type === 'hunger')).toBe(true);
    expect(advance(s, { type: 'tactic' })).toMatchObject({ ok: false });
    const none = createBattle({ allies: [ally(1)], waves: easy, seed: 2 });
    expect(advance(none, { type: 'tactic' }).ok).toBe(false);
  });

  test('quá số vòng mà địch còn thì thua; hết quân ta thì thua; nhiều đợt quân xuất hiện lần lượt', () => {
    const slow = createBattle({ allies: [ally(1, { stats: { atk: 1, def: 999, hp: 999999, spd: 5 } })], waves: commanderWave, maxTurns: 4, seed: 4 });
    autoPlay(slow, 1);
    expect(slow.status).toBe('lost');
    expect(starsOf(slow)).toBe(0);
    const weak = createBattle({ allies: [ally(1, { stats: { atk: 1, def: 1, hp: 50, spd: 5 } })], waves: commanderWave, seed: 4 });
    autoPlay(weak, 1);
    expect(weak.status).toBe('lost');
    const two: WaveDef[] = [easy[0], { label: 'Quân tiếp viện', units: [{ name: 'Lính tiếp viện', hp: 300, atk: 40, def: 20, spd: 7 }] }];
    const waves = createBattle({ allies: [ally(1), ally(2), ally(3)], waves: two, seed: 8 });
    autoPlay(waves, 1);
    expect(waves.status).toBe('won');
    expect(waves.wave).toBe(1);
    expect(waves.log.some((l) => l.kind === 'wave' && /Đợt quân 2\/2/.test(l.text))).toBe(true);
  });

  test('nội tại có hiệu lực từ đầu trận; "Hào khí" tăng 10% chỉ số của tướng từng tham gia trận đó', () => {
    const passive: MoveDef = { slot: 'passive', name: 'Phá cường địch', target: 'ally_all', power: 0, effect: { type: 'atk_up', value: 0.1 }, rage_cost: 0, cooldown: 0 };
    const s = createBattle({ allies: [ally(1, { moves: [normal, passive], haoKhi: true }), ally(2)], waves: easy, seed: 1 });
    expect(s.units.a2.fx.some((e) => e.type === 'atk_up')).toBe(true);
    expect(s.units.a1.maxHp).toBe(880);
    expect(s.units.a2.maxHp).toBe(800);
    const healer = createBattle({ allies: [ally(1, { moves: [normal, heal] })], waves: easy, seed: 1 });
    expect(healer.units.a1.moves.map((m) => m.slot)).toEqual(['normal', 'active']);
  });
});
