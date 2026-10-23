import { TIDE_CYCLE, TIDE_LABEL } from '@/constants/game/battle';
import { ENEMY_TYPES } from '@/constants/game/elements';
import { ENEMIES } from '@/constants/game/enemies';
import { HERO_BY_ID } from '@/constants/game/heroes';
import { heroStats } from '@/lib/game/heroes';
import type { BattleState, Fighter, FighterStatus, TideState } from '@/types/battleType';
import type { EnemyDef, GameState, IntentId, PhaseDef } from '@/types/gameType';

const tideFor = (round: number): TideState => TIDE_CYCLE[(round - 1) % TIDE_CYCLE.length];

const blankStatus = (): FighterStatus => ({
  atkUp: 0,
  atkUpTurns: 0,
  defUp: 0,
  defUpTurns: 0,
  taunt: 0,
  tauntDr: 0,
  shield: 0,
  evade: 0,
  fear: false,
  stun: 0,
  weaken: 0,
  weakenTurns: 0,
  defDown: 0,
  ko: false,
  fled: false,
  captured: false,
  acted: false,
  exhausted: false,
});

let fxSeq = 1;

let logSeq = 1;

const pickIntent = (def: EnemyDef, drain: number): IntentId => {
  const pool = def.intents.flatMap((i) => (i === 'forage' && drain > 0 ? [] : i === 'strike' ? [i, i] : [i]));
  return pool[Math.floor(Math.random() * pool.length)] ?? 'strike';
};

export const createBattle = (phase: PhaseDef, team: string[], state: GameState): BattleState => {
  const allies: Fighter[] = team.map((id, i) => {
    const h = HERO_BY_ID[id];
    const s = heroStats(h, state.heroes[id]?.stage ?? 1, state.buildings.doanh.level);
    return { uid: `a${i}`, side: 'ally', ref: id, name: h.name, element: h.element, boss: false, maxHp: s.hp, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, stamina: 100, st: blankStatus(), intents: [], defeatText: '' };
  });
  const enemies: Fighter[] = phase.enemies.map((e, i) => {
    const d = ENEMIES[e.id];
    const hp = Math.round(d.base.hp * (e.hp ?? 1));
    const f: Fighter = {
      uid: `e${i}`,
      side: 'enemy',
      ref: d.id,
      name: d.name,
      etype: d.type,
      boss: !!d.boss,
      maxHp: hp,
      hp,
      atk: d.base.atk,
      def: d.base.def,
      spd: d.base.spd,
      stamina: phase.rules.startStamina ?? 100,
      st: blankStatus(),
      intents: [],
      fleeAt: e.fleeAt ?? d.fleeAt,
      capture: d.capture,
      defeatText: e.defeatText ?? d.defeatText,
    };
    f.intents = [pickIntent(d, 0), pickIntent(d, 0)];
    return f;
  });
  return {
    phase,
    round: 1,
    allies,
    enemies,
    turn: 'ally',
    active: 0,
    haoKhi: 0,
    fearImmune: 0,
    drain: 0,
    supplyDestroyed: false,
    stratUsed: false,
    stratGood: false,
    tide: phase.rules.tide ? tideFor(1) : null,
    relic: state.relic,
    relicUsed: false,
    answered: 0,
    correct: 0,
    log: [{ id: logSeq++, text: phase.objective, tone: 'info' }],
    fx: [],
    result: null,
    endText: '',
    xuong: state.buildings.xuong.level,
    ben: state.buildings.ben.level,
  };
};

const aliveEnemies = (b: BattleState) => b.enemies.filter((e) => !e.st.ko && !e.st.fled && !e.st.captured);

const aliveAllies = (b: BattleState) => b.allies.filter((a) => !a.st.ko);

const cloneB = (b: BattleState): BattleState => ({
  ...b,
  allies: b.allies.map((f) => ({ ...f, st: { ...f.st }, intents: [...f.intents] })),
  enemies: b.enemies.map((f) => ({ ...f, st: { ...f.st }, intents: [...f.intents] })),
  log: [...b.log],
  fx: [],
});

const say = (b: BattleState, text: string, tone: BattleState['log'][number]['tone']) => {
  b.log.push({ id: logSeq++, text, tone });
  if (b.log.length > 40) b.log.splice(0, b.log.length - 40);
};

/** Sát thương: hệ khắc chế ×1,5; địch kiệt sức nhận thêm 25% và đánh yếu đi một nửa */
const calcDamage = (from: Fighter, to: Fighter, power: number) => {
  let atk = from.atk * (1 + from.st.atkUp);
  if (from.side === 'enemy') {
    atk *= 1 - from.st.weaken;
    if (from.st.exhausted) atk *= 0.5;
  }
  // Cân bằng: một trận khoảng 5 – 7 lượt
  let mult = power * (from.side === 'ally' ? 1.6 : 0.85);
  if (from.side === 'ally' && to.etype) {
    if (from.element && ENEMY_TYPES[to.etype].weak.includes(from.element)) mult *= 1.5;
    if (from.element === 'hoa') mult *= 1.1;
    if (to.st.exhausted) mult *= 1.25;
  }
  const def = Math.max(0, to.def * (1 + to.st.defUp) - to.st.defDown);
  const raw = atk * mult - def * 0.6;
  const variance = 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.round(raw * variance));
};

const hurtEnemy = (b: BattleState, target: Fighter, amount: number) => {
  target.hp = Math.max(0, target.hp - amount);
  b.fx.push({ uid: target.uid, kind: 'hit', amount, seq: fxSeq++ });
  if (target.fleeAt && target.hp > 0 && target.hp / target.maxHp <= target.fleeAt) {
    target.st.fled = true;
    say(b, `${target.defeatText}!`, 'good');
  } else if (target.hp <= 0) {
    if (target.capture) target.st.captured = true;
    else target.st.ko = true;
    say(b, `${target.defeatText}!`, 'good');
  }
};

const hurtAlly = (b: BattleState, target: Fighter, amount: number) => {
  if (target.st.evade > 0 || (b.relic === 'non_ma_loi' && target.element === 'thuy' && Math.random() < 0.25)) {
    if (target.st.evade > 0) target.st.evade -= 1;
    b.fx.push({ uid: target.uid, kind: 'miss', seq: fxSeq++ });
    say(b, `${target.name} né được đòn đánh.`, 'ally');
    return;
  }
  let dmg = amount;
  if (target.st.taunt > 0) dmg = Math.round(dmg * (1 - target.st.tauntDr));
  if (target.st.shield > 0) {
    const absorb = Math.min(target.st.shield, dmg);
    target.st.shield -= absorb;
    dmg -= absorb;
  }
  target.hp = Math.max(0, target.hp - dmg);
  b.fx.push({ uid: target.uid, kind: 'hit', amount: dmg, seq: fxSeq++ });
  if (target.hp <= 0) {
    target.st.ko = true;
    say(b, `${target.name} kiệt sức, lui về hậu tuyến.`, 'bad');
  }
};

const healAlly = (b: BattleState, target: Fighter, amount: number) => {
  if (target.st.ko) return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.round(amount));
  b.fx.push({ uid: target.uid, kind: 'heal', amount: target.hp - before, seq: fxSeq++ });
};

const checkEnd = (b: BattleState) => {
  if (b.result) return b;
  const foes = aliveEnemies(b);
  if (!foes.length) {
    b.result = 'win';
    b.turn = 'over';
    b.endText = 'Quân ta toàn thắng!';
  } else if (b.phase.rules.winWhenExhausted && foes.every((e) => e.st.exhausted)) {
    b.result = 'win';
    b.turn = 'over';
    b.endText = 'Giặc đói kiệt, mất hết sức bền và phải rút lui!';
    say(b, b.endText, 'good');
  } else if (!aliveAllies(b).length) {
    b.result = 'lose';
    b.turn = 'over';
    b.endText = 'Đội ta đã lui về hậu tuyến.';
  }
  return b;
};

const nextActive = (b: BattleState) => {
  const idx = b.allies.findIndex((a) => !a.st.ko && !a.st.acted);
  if (idx === -1) b.turn = 'enemy';
  else b.active = idx;
  return b;
};

const pickTarget = (b: BattleState, targetUid: string | null) => {
  const foes = aliveEnemies(b);
  return foes.find((e) => e.uid === targetUid) ?? foes.find((e) => e.boss) ?? foes[0];
};

/** Một tướng hành động: đánh thường, kế sách (sau câu hỏi) hoặc tuyệt chiêu */
export const allyAct = (prev: BattleState, kind: 'basic' | 'strat' | 'ult', targetUid: string | null, correct = true): BattleState => {
  const b = cloneB(prev);
  const me = b.allies[b.active];
  if (!me || me.st.ko || b.turn !== 'ally') return prev;
  const hero = HERO_BY_ID[me.ref];
  const skill = kind === 'basic' ? hero.basic : kind === 'strat' ? hero.strat : hero.ult;
  const factor = kind === 'strat' ? (correct ? 1.5 : 0.5) : 1;
  const target = pickTarget(b, targetUid);
  b.fx.push({ uid: me.uid, kind: 'act', seq: fxSeq++ });
  if (kind === 'ult') b.haoKhi = Math.max(0, b.haoKhi - 3);
  if (kind === 'strat') {
    b.answered += 1;
    if (correct) {
      b.correct += 1;
      b.haoKhi = Math.min(3, b.haoKhi + 1);
    }
  }
  const allies = aliveAllies(b);
  const foes = aliveEnemies(b);
  const tag = kind === 'strat' ? (correct ? ' (trả lời đúng: mạnh gấp rưỡi)' : ' (trả lời chưa đúng: còn nửa sức)') : '';
  switch (skill.kind) {
    case 'strike':
    case 'ambush':
    case 'ship_hunter': {
      if (!target) break;
      let power = skill.power * factor;
      if (skill.kind === 'ambush' && target.etype === 'luong') power *= 2 * (1 + (b.ben - 1) * 0.2);
      if (skill.kind === 'ship_hunter' && target.etype === 'thuyen') {
        power *= 2;
        target.st.defDown += 4;
      }
      if (me.ref === 'tran_binh_trong' && me.hp / me.maxHp < 0.3) power *= 2;
      const dmg = calcDamage(me, target, power);
      say(b, `${me.name} dùng ${skill.name}${tag}: ${target.name} mất ${dmg} binh lực.`, 'ally');
      hurtEnemy(b, target, dmg);
      break;
    }
    case 'multi': {
      for (let i = 0; i < 3; i++) {
        const t = pickTarget(b, i === 0 ? targetUid : null);
        if (!t) break;
        const dmg = calcDamage(me, t, skill.power * factor);
        hurtEnemy(b, t, dmg);
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: liên tiếp ba đòn!`, 'ally');
      break;
    }
    case 'aoe':
    case 'debuff':
    case 'cut_supply':
    case 'stakes': {
      let power = skill.power * factor;
      let note = '';
      if (skill.kind === 'stakes' && b.tide) {
        if (b.tide === 'rut') {
          power *= 2.2 * (1 + Math.max(0, b.xuong - 1) * 0.25);
          note = ' Triều rút, thuyền giặc mắc cọc!';
        } else {
          power *= 0.6;
          note = ' Cọc ngầm chỉ phát huy khi thủy triều rút.';
        }
      }
      for (const t of foes) {
        let p = power;
        if (me.ref === 'tran_thai_tong' && t.st.exhausted) p *= 2;
        const dmg = calcDamage(me, t, p);
        hurtEnemy(b, t, dmg);
        if (skill.kind === 'debuff') {
          t.st.weaken = 0.25;
          t.st.weakenTurns = 2;
        }
        if (skill.kind === 'stakes' && b.tide === 'rut' && t.etype === 'thuyen') t.st.stun = Math.max(t.st.stun, 1);
      }
      if (skill.kind === 'cut_supply') {
        b.supplyDestroyed = true;
        b.drain = Math.max(b.drain, 12);
        note = ' Nguồn lương của giặc bị cắt đứt!';
      }
      say(b, `${me.name} dùng ${skill.name}${tag}.${note}`, 'ally');
      break;
    }
    case 'buff_atk': {
      for (const a of allies) {
        a.st.atkUp = Math.max(a.st.atkUp, skill.power * factor);
        a.st.atkUpTurns = 2;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội tăng tấn công.`, 'ally');
      break;
    }
    case 'self_atk': {
      me.st.atkUp = Math.max(me.st.atkUp, skill.power * factor);
      me.st.atkUpTurns = 3;
      if (target) {
        const dmg = calcDamage(me, target, 1);
        hurtEnemy(b, target, dmg);
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: khí thế bừng bừng!`, 'ally');
      break;
    }
    case 'buff_def': {
      for (const a of allies) {
        a.st.defUp = Math.max(a.st.defUp, skill.power * factor);
        a.st.defUpTurns = 2;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội vững phòng thủ.`, 'ally');
      break;
    }
    case 'heal': {
      for (const a of allies) healAlly(b, a, a.maxHp * skill.power * factor);
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội hồi khí lực.`, 'ally');
      break;
    }
    case 'taunt': {
      me.st.taunt = 2;
      me.st.tauntDr = Math.min(0.7, skill.power * factor);
      if (me.ref === 'tran_binh_trong') {
        me.st.defUp = Math.max(me.st.defUp, 0.5);
        me.st.defUpTurns = 2;
      }
      b.fx.push({ uid: me.uid, kind: 'buff', seq: fxSeq++ });
      say(b, `${me.name} dùng ${skill.name}${tag}: thu hút đòn đánh của giặc.`, 'ally');
      break;
    }
    case 'shield': {
      for (const a of allies) {
        a.st.shield += Math.round(a.maxHp * skill.power * factor);
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      say(b, `${me.name} dùng ${skill.name}${tag}: cả đội được che chắn.`, 'ally');
      break;
    }
    case 'fear_immune': {
      b.fearImmune = 3;
      for (const a of allies) healAlly(b, a, a.maxHp * skill.power * factor);
      say(b, `${me.name}: “Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”${tag} Cả đội vững lòng.`, 'ally');
      break;
    }
    case 'evade': {
      if (kind === 'ult' || me.ref === 'le_phu_tran') {
        for (const a of allies) a.st.evade = Math.max(a.st.evade, 1);
        say(b, `${me.name} dùng ${skill.name}: cả đội né đòn ở lượt tới.`, 'ally');
      } else {
        me.st.evade = Math.max(me.st.evade, 1);
        if (target) {
          const dmg = calcDamage(me, target, skill.power * factor);
          hurtEnemy(b, target, dmg);
        }
        say(b, `${me.name} dùng ${skill.name}${tag}.`, 'ally');
      }
      break;
    }
  }
  if (me.ref === 'tran_hung_dao' && kind === 'strat' && correct) b.haoKhi = Math.min(3, b.haoKhi + 1);
  me.st.acted = true;
  checkEnd(b);
  if (!b.result) nextActive(b);
  return b;
};

/** Kế sách của màn (dùng một lần, sau câu hỏi) */
export const applyPhaseStrat = (prev: BattleState, correct: boolean): BattleState => {
  const b = cloneB(prev);
  if (b.stratUsed || b.result) return prev;
  b.stratUsed = true;
  b.answered += 1;
  if (correct) {
    b.correct += 1;
    b.haoKhi = Math.min(3, b.haoKhi + 1);
  }
  const p = b.phase;
  const heroIn = !!p.strat.hero && b.allies.some((a) => a.ref === p.strat.hero && !a.st.ko);
  const bonus = heroIn ? 1.25 : 1;
  const foes = aliveEnemies(b);
  const noKo = b.allies.every((a) => !a.st.ko);
  const lead = b.allies.find((a) => !a.st.ko) ?? b.allies[0];
  const hit = (t: Fighter, power: number) => hurtEnemy(b, t, calcDamage(lead, t, power));
  switch (p.strat.effect) {
    case 'retreat':
    case 'rear_guard': {
      b.stratGood = correct && noKo;
      b.result = 'win';
      b.turn = 'over';
      b.endText =
        p.strat.effect === 'retreat'
          ? 'Quân ta rút lui an toàn, bảo toàn lực lượng chờ thời cơ phản công.'
          : 'Cánh quân chặn hậu giữ chân giặc, hai vua và triều đình rút lui an toàn.';
      say(b, b.endText, 'good');
      return b;
    }
    case 'vuon_khong': {
      b.drain = correct ? 18 : 9;
      for (const e of foes) e.stamina = Math.max(0, e.stamina - (correct ? 20 : 10));
      b.stratGood = correct && b.round <= 2;
      say(b, `Vườn không nhà trống!${correct ? '' : ' (chưa trả lời đúng nên sơ tán chậm hơn)'} Giặc không cướp được lương, sức bền tụt dần mỗi lượt.`, 'good');
      break;
    }
    case 'counter': {
      const anyTired = foes.some((e) => e.st.exhausted || e.stamina <= 30);
      for (const a of aliveAllies(b)) {
        a.st.atkUp = Math.max(a.st.atkUp, (correct ? 0.5 : 0.2) * bonus);
        a.st.atkUpTurns = 3;
        b.fx.push({ uid: a.uid, kind: 'buff', seq: fxSeq++ });
      }
      b.stratGood = correct && anyTired;
      say(b, `Phản công Đông Bộ Đầu! Cả đội tăng mạnh tấn công.${anyTired ? '' : ' (Nên đợi giặc kiệt sức rồi mới phản công.)'}`, 'good');
      break;
    }
    case 'chuong_duong': {
      for (const t of foes) {
        hit(t, (correct ? 1.6 : 0.8) * bonus);
        t.st.weaken = 0.25;
        t.st.weakenTurns = 2;
      }
      b.stratGood = correct;
      say(b, `Đoạt sáo Chương Dương độ!${heroIn ? ' Trần Quang Khải dẫn đầu.' : ''} Quân giặc giữ bến tan vỡ.`, 'good');
      break;
    }
    case 'van_kiep': {
      const boss = foes.find((e) => e.ref === 'thoat_hoan') ?? foes[0];
      if (boss) {
        hit(boss, (correct ? 2.6 : 1.2) * bonus);
        boss.st.stun = Math.max(boss.st.stun, 1);
      }
      b.stratGood = correct;
      say(b, 'Chặn đánh ở Vạn Kiếp! Đường tháo chạy của giặc bị chặn.', 'good');
      break;
    }
    case 'van_don': {
      for (const t of foes) hit(t, (t.etype === 'luong' ? 3 : 0.8) * (correct ? 1 : 0.5) * bonus * (1 + Math.max(0, b.ben - 1) * 0.2));
      b.supplyDestroyed = true;
      b.drain = Math.max(b.drain, 12);
      b.stratGood = correct && b.round === 1;
      say(b, 'Phục kích Vân Đồn! Thuyền lương bị đánh đắm, giặc mất nguồn hồi phục.', 'good');
      break;
    }
    case 'bach_dang': {
      const good = b.tide === 'rut';
      for (const t of foes) {
        hit(t, (good ? 2.5 : 0.7) * (correct ? 1 : 0.5) * bonus * (1 + Math.max(0, b.xuong - 1) * 0.25));
        if (good) t.st.stun = Math.max(t.st.stun, 1);
      }
      b.stratGood = correct && good;
      say(b, good ? 'Đại trận Bạch Đằng! Triều rút, thuyền giặc va cọc, vỡ đắm.' : 'Tung trận khi triều chưa rút: cọc còn chìm sâu nên chưa phát huy. Hãy chờ “Triều rút”.', good ? 'good' : 'bad');
      break;
    }
    case 'capture': {
      const target = foes.find((e) => e.ref === 'o_ma_nhi') ?? foes[0];
      if (target) {
        hit(target, (correct ? 2.6 : 1.2) * bonus);
        target.st.stun = Math.max(target.st.stun, 2);
      }
      b.stratGood = correct;
      say(b, 'Vây chặt thuyền chỉ huy của giặc!', 'good');
      break;
    }
  }
  checkEnd(b);
  return b;
};

export const applyRelic = (prev: BattleState): BattleState => {
  if (!prev.relic || prev.relicUsed || prev.result) return prev;
  const b = cloneB(prev);
  if (b.relic === 'hich') {
    for (const a of aliveAllies(b)) healAlly(b, a, a.maxHp);
    say(b, 'Hịch tướng sĩ vang lên: cả đội hồi đầy khí lực!', 'good');
  } else if (b.relic === 'co_sau_chu') {
    const down = b.allies.find((a) => a.st.ko);
    if (!down) return prev;
    down.st.ko = false;
    down.hp = Math.round(down.maxHp * 0.5);
    say(b, `Cờ “Phá cường địch, báo hoàng ân” tung bay: ${down.name} trở lại trận!`, 'good');
  } else if (b.relic === 'tung_gia') {
    for (const a of b.allies) a.st.acted = false;
    nextActive(b);
    b.turn = 'ally';
    say(b, 'Hành quân thần tốc: cả đội được hành động thêm một lượt!', 'good');
  } else return prev;
  b.relicUsed = true;
  return b;
};

/** Một lượt của quân địch, trả về từng bước để hiển thị lần lượt */
export const enemyTurnSteps = (prev: BattleState): BattleState[] => {
  const steps: BattleState[] = [];
  let b = cloneB(prev);
  const order = aliveEnemies(b).sort((x, y) => y.spd - x.spd).map((e) => e.uid);
  for (const uid of order) {
    if (b.result) break;
    b = cloneB(b);
    const e = b.enemies.find((x) => x.uid === uid);
    if (!e || e.st.ko || e.st.fled || e.st.captured) continue;
    const def = ENEMIES[e.ref];
    const convoy = !b.supplyDestroyed && b.enemies.some((x) => x.etype === 'luong' && !x.st.ko && !x.st.fled);
    e.stamina = Math.max(0, Math.min(100, e.stamina - 5 - b.drain + (convoy ? 6 : 0)));
    if (e.stamina <= 0 && !e.st.exhausted) {
      e.st.exhausted = true;
      say(b, `${e.name} kiệt sức vì thiếu lương!`, 'good');
    }
    const intent = e.intents.shift() ?? 'strike';
    e.intents.push(pickIntent(def, b.drain));
    if (e.st.stun > 0) {
      e.st.stun -= 1;
      say(b, `${e.name} bị chặn đứng, không ra đòn được.`, 'good');
      steps.push(checkEnd(b));
      continue;
    }
    const allies = aliveAllies(b);
    if (!allies.length) break;
    const taunter = allies.find((a) => a.st.taunt > 0);
    const randomAlly = () => taunter ?? allies[Math.floor(Math.random() * allies.length)];
    b.fx.push({ uid: e.uid, kind: 'act', seq: fxSeq++ });
    switch (intent) {
      case 'strike': {
        const t = randomAlly();
        const dmg = calcDamage(e, t, 1);
        say(b, `${e.name} tấn công ${t.name}.`, 'enemy');
        hurtAlly(b, t, dmg);
        break;
      }
      case 'charge': {
        const t = taunter ?? [...allies].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        const dmg = calcDamage(e, t, 1.6);
        say(b, `${e.name} càn quét vào ${t.name}!`, 'enemy');
        hurtAlly(b, t, dmg);
        break;
      }
      case 'volley': {
        say(b, `${e.name} bắn mưa tên vào đội ta!`, 'enemy');
        for (const t of allies) hurtAlly(b, t, calcDamage(e, t, 0.55));
        break;
      }
      case 'forage': {
        if (b.drain > 0) {
          e.stamina = Math.max(0, e.stamina - 10);
          say(b, `${e.name} đi cướp lương nhưng làng mạc trống không!`, 'good');
        } else {
          e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.12));
          e.stamina = Math.min(100, e.stamina + 20);
          b.fx.push({ uid: e.uid, kind: 'heal', seq: fxSeq++ });
          say(b, `${e.name} cướp lương, hồi sức.`, 'enemy');
        }
        break;
      }
      case 'roar': {
        if (b.fearImmune > 0) say(b, `${e.name} hò hét nhưng đội ta vẫn vững lòng.`, 'good');
        else {
          const t = randomAlly();
          t.st.fear = true;
          say(b, `${e.name} hò hét: ${t.name} hoảng sợ, mất lượt tới.`, 'enemy');
        }
        break;
      }
      case 'supply': {
        if (b.supplyDestroyed) say(b, 'Thuyền lương đã bị đánh đắm – giặc không còn tiếp lương.', 'good');
        else {
          for (const x of aliveEnemies(b)) {
            x.hp = Math.min(x.maxHp, x.hp + Math.round(x.maxHp * 0.08));
            x.stamina = Math.min(100, x.stamina + 10);
          }
          say(b, `${e.name} tiếp lương cho cả đạo quân.`, 'enemy');
        }
        break;
      }
      case 'brace': {
        e.st.defUp = 0.5;
        e.st.defUpTurns = 1;
        say(b, `${e.name} thủ thế.`, 'enemy');
        break;
      }
    }
    steps.push(checkEnd(b));
  }
  // Sang lượt mới
  b = cloneB(b);
  if (!b.result) {
    b.round += 1;
    if (b.phase.rules.tide) {
      b.tide = tideFor(b.round);
      say(b, `${TIDE_LABEL[b.tide]}${b.tide === 'rut' ? ' – thời cơ tung Đại trận Bạch Đằng!' : ''}`, b.tide === 'rut' ? 'good' : 'info');
    }
    if (b.fearImmune > 0) b.fearImmune -= 1;
    for (const f of [...b.allies, ...b.enemies]) {
      if (f.st.atkUpTurns > 0 && --f.st.atkUpTurns === 0) f.st.atkUp = 0;
      if (f.st.defUpTurns > 0 && --f.st.defUpTurns === 0) f.st.defUp = 0;
      if (f.st.weakenTurns > 0 && --f.st.weakenTurns === 0) f.st.weaken = 0;
      if (f.st.taunt > 0) f.st.taunt -= 1;
      f.st.acted = false;
    }
    for (const a of b.allies) {
      if (a.st.fear && !a.st.ko) {
        a.st.acted = true;
        a.st.fear = false;
      }
    }
    if (b.phase.rules.retreatAfter && b.round === b.phase.rules.retreatAfter + 1) say(b, `Đã cầm cự đủ ${b.phase.rules.retreatAfter} lượt – có thể dùng kế sách “${b.phase.strat.name}”.`, 'info');
    b.turn = 'ally';
    nextActive(b);
    checkEnd(b);
  }
  steps.push(b);
  return steps;
};

export const starsOf = (b: BattleState) => (b.result !== 'win' ? 0 : 1 + (b.stratGood ? 1 : 0) + (b.answered > 0 && b.correct / b.answered >= 0.8 ? 1 : 0));
