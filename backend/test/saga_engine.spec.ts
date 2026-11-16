/**
 * Luật chơi của Hành trình Đông A (hàm thuần, không cần cơ sở dữ liệu): minigame luyện tập, nhiệm vụ khám phá, trận đánh theo lượt và màn Bạch Đằng.
 * Kịch bản lấy từ nội dung khởi tạo (backend/scripts/saga-seed), tức đúng những gì học sinh sẽ chơi: mỗi trận phải thắng được bằng cách chơi đúng
 * và thua được khi chơi sai; dạng gửi cho học sinh không bao giờ chứa đáp án.
 */
import { applyBachDang, bachDangResult, BdAction, BdScenario, BdState, createBachDang, normalizeBachDang, publicBachDang, tideOf } from '../src/saga/bachdang';
import { normalizeStage, StageContent } from '../src/saga/content';
import { applyExplore, ExploreScript, newExplore, publicExplore } from '../src/saga/explore';
import { gradeItem, ItemRow, newSlot, normalizeItem, publicItem, tally } from '../src/saga/practice';
import { applyTactics, autoTactics, createTactics, publicTactics, reachable, TacticsScenario, tacticsResult, TAction, TState } from '../src/saga/tactics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SEED: Array<Record<string, any>> = [...require('../scripts/saga-seed/stages-1.cjs'), ...require('../scripts/saga-seed/stages-2.cjs'), ...require('../scripts/saga-seed/stages-3.cjs')];
type SeedStage = Record<string, any> & { content: StageContent };
const stages: SeedStage[] = SEED.map((s) => ({ ...s, content: normalizeStage(JSON.parse(JSON.stringify(s.content))) }) as SeedStage);
const stage = (code: string) => stages.find((s) => s.code === code)!;
const item = (raw: Record<string, any>, id = 1): ItemRow => ({ id, kind: raw.kind, prompt: raw.prompt, data: normalizeItem(raw.kind, JSON.parse(JSON.stringify(raw.data))) as any, explanation: raw.explanation, objective: raw.objective, source: raw.source });

/** Mọi khóa xuất hiện trong một đối tượng (kể cả lồng nhau): dùng để chắc rằng đáp án không lọt ra ngoài */
function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

describe('Nội dung khởi tạo', () => {
  it('có 13 chặng của ba cuộc kháng chiến, thứ tự liên tục và mở khóa tuần tự trong từng cuộc', () => {
    expect(stages.map((s) => s.position)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect([1, 2, 3].map((n) => stages.filter((s) => s.campaign_no === n).length)).toEqual([3, 6, 4]);
    for (const s of stages) {
      const first = stages.filter((x) => x.campaign_no === s.campaign_no)[0];
      if (s === first) expect(s.unlock_after).toBeNull();
      else expect(s.unlock_after).toBe(stages[stages.indexOf(s) - 1].code);
      expect(s.map_x).toBeGreaterThan(0); expect(s.map_x).toBeLessThan(1); expect(s.map_y).toBeGreaterThan(0); expect(s.map_y).toBeLessThan(1);
    }
  });

  it('mỗi chặng có 3–5 thẻ kiến thức gắn mục tiêu và nguồn, ít nhất 6 câu luyện tập đủ dạng, và mọi câu gắn mục tiêu + nguồn của chặng', () => {
    const kinds = new Set<string>();
    for (const s of stages) {
      expect(s.content.cards.length).toBeGreaterThanOrEqual(3);
      expect(s.content.cards.length).toBeLessThanOrEqual(5);
      expect(s.items.length).toBeGreaterThanOrEqual(6);
      for (const raw of s.items) {
        kinds.add(raw.kind);
        expect(() => item(raw)).not.toThrow();
        expect(s.content.objectives.map((o) => o.id)).toContain(raw.objective);
        expect(s.content.sources.map((x) => x.key)).toContain(raw.source);
      }
      // sự kiện chuẩn bị (hội nghị, bố trí lực lượng) không bị ép thành trận đánh
      if (s.kind === 'council' || s.kind === 'prepare') expect(s.content.battle).toBeNull();
      if (s.kind === 'battle') expect(s.content.battle).not.toBeNull();
    }
    expect([...kinds].sort()).toEqual(['locate', 'pairs', 'quiz', 'sequence', 'tactic']);
    expect(stage('bach-dang').content.battle!.mode).toBe('bachdang');
  });
});

describe('Minigame luyện tập', () => {
  const raws = stage('bach-dang').items as Array<Record<string, any>>;
  const of = (kind: string) => item(raws.find((r) => r.kind === kind)!);

  it('dạng gửi cho học sinh không chứa đáp án, phản hồi hay điểm của phương án', () => {
    for (const raw of stages.flatMap((s) => s.items as Array<Record<string, any>>)) {
      const it0 = item(raw);
      const view = publicItem(it0, newSlot(it0, 12345));
      const keys = keysOf(view);
      for (const secret of ['correct', 'feedback', 'score', 'pairs', 'label', 'when', 'explanation']) expect([raw.code, secret, keys.has(secret)]).toEqual([raw.code, secret, false]);
    }
  });

  it('trắc nghiệm và chọn địa điểm: đúng được 1 điểm, sai 0 điểm và trả về đáp án sau khi đã trả lời', () => {
    const quiz = of('quiz');
    const right = gradeItem(quiz, newSlot(quiz, 1), { choice: (quiz.data as any).correct });
    expect(right).toMatchObject({ done: true, correct: true, score: 1 });
    const wrong = gradeItem(quiz, newSlot(quiz, 1), { choice: 'zz' });
    expect(wrong).toMatchObject({ done: true, correct: false, score: 0 });
    expect(wrong.detail.correct_id).toBe((quiz.data as any).correct);
    const locate = of('locate');
    expect(gradeItem(locate, newSlot(locate, 1), { choice: (locate.data as any).correct }).score).toBe(1);
    expect(gradeItem(locate, newSlot(locate, 1), {}).score).toBe(0);
  });

  it('quyết định chiến thuật: phương án tốt nhất 1 điểm, phương án chấp nhận được nửa điểm, kèm phản hồi', () => {
    const raw = stage('vuon-khong-nha-trong').items.find((r: any) => r.kind === 'tactic');
    const t = item(raw);
    const options = (t.data as any).options as Array<{ id: string; score: number }>;
    expect(gradeItem(t, newSlot(t, 1), { choice: options.find((o) => o.score === 2)!.id })).toMatchObject({ score: 1, correct: true });
    const half = gradeItem(t, newSlot(t, 1), { choice: options.find((o) => o.score === 1)!.id });
    expect(half).toMatchObject({ score: 0.5, correct: false });
    expect(typeof half.detail.feedback).toBe('string');
    expect(gradeItem(t, newSlot(t, 1), { choice: options.find((o) => o.score === 0)!.id }).score).toBe(0);
  });

  it('xếp trình tự: chỉ đúng khi mọi vị trí đúng; đề gửi đi luôn khác thứ tự gốc', () => {
    const seq = of('sequence');
    const ids = (seq.data as any).items.map((i: any) => i.id) as string[];
    for (let seed = 1; seed < 30; seed++) expect((publicItem(seq, newSlot(seq, seed)).items as any[]).map((i) => i.id)).not.toEqual(ids);
    expect(gradeItem(seq, newSlot(seq, 1), { order: ids }).score).toBe(1);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const bad = gradeItem(seq, newSlot(seq, 1), { order: swapped });
    expect(bad.score).toBe(0);
    expect((bad.detail.right as boolean[]).slice(0, 2)).toEqual([false, false]);
  });

  it('lật thẻ ghép cặp: mã thẻ ngẫu nhiên theo phiên, ghép sai được vài lần, sai nhiều thì mất điểm; ghép lại thẻ đã ghép bị từ chối', () => {
    const p = of('pairs');
    const slot = newSlot(p, 777);
    const tokens = slot.tokens!;
    const left = Object.keys(tokens).filter((k) => k.startsWith('l'));
    const rightOf = (l: string) => Object.keys(tokens).find((k) => k.startsWith('r') && tokens[k] === tokens[l])!;
    const wrongOf = (l: string) => Object.keys(tokens).find((k) => k.startsWith('r') && tokens[k] !== tokens[l])!;
    expect(gradeItem(p, slot, { left: left[0], right: wrongOf(left[0]) })).toMatchObject({ done: false, correct: false });
    for (const l of left.slice(0, -1)) expect(gradeItem(p, slot, { left: l, right: rightOf(l) })).toMatchObject({ done: false, correct: true });
    expect(() => gradeItem(p, slot, { left: left[0], right: rightOf(left[0]) })).toThrow();
    const last = left[left.length - 1];
    expect(gradeItem(p, slot, { left: last, right: rightOf(last) })).toMatchObject({ done: true, score: 1 }); // một lần sai vẫn đủ điểm
    const sloppy = newSlot(p, 778);
    const t2 = sloppy.tokens!;
    const l2 = Object.keys(t2).filter((k) => k.startsWith('l'));
    for (let i = 0; i < 6; i++) gradeItem(p, sloppy, { left: l2[0], right: Object.keys(t2).find((k) => k.startsWith('r') && t2[k] !== t2[l2[0]])! });
    for (const l of l2) gradeItem(p, sloppy, { left: l, right: Object.keys(t2).find((k) => k.startsWith('r') && t2[k] === t2[l])! });
    expect(sloppy).toMatchObject({ done: true, score: 0 });
  });

  it('tổng kết: ngưỡng đạt mặc định 70% và chỉnh được; câu đã trả lời không trả lời lại được', () => {
    const quiz = of('quiz');
    const slots = Array.from({ length: 10 }, (_, i) => newSlot({ ...quiz, id: i + 1 }, i));
    slots.forEach((s, i) => gradeItem({ ...quiz, id: s.item_id }, s, { choice: i < 7 ? (quiz.data as any).correct : 'zz' }));
    expect(tally(slots, 70)).toMatchObject({ percent: 70, passed: true, stars: 1, right: 7, total: 10 });
    expect(tally(slots, 80)).toMatchObject({ passed: false, stars: 0 });
    expect(() => gradeItem(quiz, slots[0], { choice: 'a' })).toThrow();
  });
});

describe('Nhập vai khám phá', () => {
  /** Đi hết nhiệm vụ của một cảnh bằng đúng thao tác của người chơi; trả về số lần sai và số lần xem gợi ý */
  function walk(script: ExploreScript, opts: { battleWon?: boolean } = {}) {
    const s = newExplore();
    let guard = 0;
    while (!s.done && guard++ < 60) {
      const step = script.steps[s.step];
      if (step.type === 'talk' || step.type === 'find' || step.type === 'give') applyExplore(script, s, { type: 'interact', target: `npc:${step.npc}` }, false);
      else if (step.type === 'pickup') applyExplore(script, s, { type: 'interact', target: `item:${step.item}` }, false);
      else if (step.type === 'ask') { if (!s.asking) applyExplore(script, s, { type: 'interact', target: `npc:${step.npc}` }, false); applyExplore(script, s, { type: 'answer', choice: step.correct }, false); }
      else applyExplore(script, s, { type: 'interact', target: `zone:${step.zone}` }, step.type === 'battle' ? Boolean(opts.battleWon) : false);
      if (step.type === 'battle' && !opts.battleWon) break;
    }
    return s;
  }

  it('mọi cảnh đi hết được bằng thao tác đúng; cảnh có trận đánh dừng ở điểm chạm trán cho tới khi thắng trận', () => {
    for (const st of stages) {
      const script = st.content.explore;
      const hasBattle = script.steps.some((x) => x.type === 'battle');
      if (hasBattle) {
        const stopped = walk(script);
        expect([st.code, stopped.done, script.steps[stopped.step].type]).toEqual([st.code, false, 'battle']);
      }
      const finished = walk(script, { battleWon: true });
      expect([st.code, finished.done, finished.mistakes, finished.hints]).toEqual([st.code, true, 0, 0]);
    }
  });

  it('chỉ qua bước khi đủ điều kiện: hỏi nhầm người, giao vật chưa nhặt, trả lời sai đều không qua; xem lại manh mối được ghi nhận', () => {
    const script = stage('binh-le-nguyen').content.explore;
    const s = newExplore();
    // chưa nhận lệnh mà đi hỏi người khác: chỉ nhận câu chào, không qua bước
    expect(applyExplore(script, s, { type: 'interact', target: 'npc:cook' }, false)[0].t).toBe('say');
    expect(s.step).toBe(0);
    applyExplore(script, s, { type: 'interact', target: 'npc:letan' }, false);
    expect(s.step).toBe(1);
    // nhiệm vụ "tìm đúng người": hỏi nhầm tính một lần sai
    expect(applyExplore(script, s, { type: 'interact', target: 'npc:mahout' }, false)[0].t).toBe('wrong');
    expect([s.step, s.mistakes]).toEqual([1, 1]);
    applyExplore(script, s, { type: 'interact', target: 'npc:keeper' }, false);
    // bước nhắc lại quân lệnh: phải mở câu hỏi rồi mới trả lời; sai thì ở lại, được xem lại manh mối
    expect(() => applyExplore(script, s, { type: 'answer', choice: 'b' }, false)).toThrow();
    const asked = applyExplore(script, s, { type: 'interact', target: 'npc:keeper' }, false)[0];
    expect(asked.t).toBe('ask');
    expect(keysOf(asked).has('correct')).toBe(false);
    expect(applyExplore(script, s, { type: 'answer', choice: 'a' }, false)[0].t).toBe('wrong');
    expect(applyExplore(script, s, { type: 'hint' }, false)[0]).toMatchObject({ t: 'clue' });
    expect([s.step, s.mistakes, s.hints]).toEqual([2, 2, 1]);
    applyExplore(script, s, { type: 'answer', choice: 'b' }, false);
    expect(s.step).toBe(3);
    // chưa nhặt ván thuyền thì không giao được
    expect(applyExplore(script, s, { type: 'interact', target: 'npc:letan' }, false)[0].t).toBe('say');
    expect(s.step).toBe(3);
    applyExplore(script, s, { type: 'interact', target: 'item:plank' }, false);
    expect(s.inventory).toEqual(['plank']);
    applyExplore(script, s, { type: 'interact', target: 'npc:letan' }, false);
    expect([s.step, s.inventory]).toEqual([5, []]);
    // chạm vùng địch: mở trận, chưa thắng thì chưa qua; thắng rồi mới đi tiếp
    expect(applyExplore(script, s, { type: 'interact', target: 'zone:front' }, false)).toEqual([{ t: 'battle' }]);
    expect(s.step).toBe(5);
    applyExplore(script, s, { type: 'interact', target: 'zone:front' }, true);
    expect(s.step).toBe(6);
  });

  it('phần gửi cho trình duyệt chỉ có mục tiêu của bước đang làm, không có đáp án và không lộ các bước sau', () => {
    const script = stage('bach-dang').content.explore;
    const view = publicExplore(script, newExplore()) as Record<string, any>;
    expect(keysOf(view).has('correct')).toBe(false);
    expect(keysOf(view).has('steps')).toBe(false);
    expect(view.current).toMatchObject({ type: 'talk', marker: 'npc:elder' });
    expect(view.grid).toHaveLength(13);
  });
});

describe('Trận đánh theo lượt', () => {
  const play = (scn: TacticsScenario, policy: (s: TState) => TAction, knowledge = 100) => {
    const { state } = createTactics(scn, knowledge);
    let guard = 0;
    while (state.status === 'active' && guard++ < 400) { try { applyTactics(scn, state, policy(state)); } catch { applyTactics(scn, state, { type: 'defend' }); } }
    return { state, result: tacticsResult(scn, state) };
  };
  const battles = stages.filter((s) => s.content.battle?.mode === 'tactics').map((s) => ({ code: s.code as string, scn: s.content.battle as TacticsScenario }));

  it('có 7 trận; trận nào cũng thắng được bằng cách chơi đúng (dùng mưu kế, kỹ năng, nhắm đúng mục tiêu)', () => {
    expect(battles).toHaveLength(7);
    for (const b of battles) {
      const { state, result } = play(b.scn, (s) => autoTactics(b.scn, s));
      expect([b.code, state.status]).toEqual([b.code, 'won']);
      expect(result.stars).toBeGreaterThanOrEqual(1);
    }
  });

  it('người chơi có thể thua thật: chỉ phòng thủ thì thua mọi trận cần tấn công; đánh bừa thì thua các trận có mục tiêu riêng', () => {
    const turtle = (): TAction => ({ type: 'defend' });
    for (const code of ['dong-bo-dau', 'ham-tu', 'chuong-duong', 'tay-ket', 'van-don']) expect([code, play(battles.find((b) => b.code === code)!.scn, turtle).state.status]).toEqual([code, 'lost']);
    const naive = (scn: TacticsScenario) => (s: TState): TAction => {
      if (s.stratagem === 'ready' && scn.stratagem) return { type: 'stratagem', answer: scn.stratagem.options.find((o) => o.id !== scn.stratagem!.correct)!.id };
      const u = s.units[s.queue[0]];
      const foes = reachable(s, u);
      return u.atk > 0 && foes.length ? { type: 'attack', target: foes[0].id } : { type: 'defend' };
    };
    for (const code of ['binh-le-nguyen', 'chuong-duong', 'van-don']) { const b = battles.find((x) => x.code === code)!; expect([code, play(b.scn, naive(b.scn), 70).state.status]).toEqual([code, 'lost']); }
  });

  it('kiến thức ảnh hưởng tới trận đánh: mưu kế trả lời đúng mạnh hơn trả lời sai, điểm luyện tập cao được thêm quân lương', () => {
    const scn = battles.find((b) => b.code === 'van-don')!.scn;
    const high = createTactics(scn, 95).state, low = createTactics(scn, 0).state;
    expect(high.supply.ally).toBe(low.supply.ally + 2);
    expect(high.atkBonus).toBeGreaterThan(low.atkBonus);
    const strong = createTactics(scn, 70).state, weak = createTactics(scn, 70).state;
    applyTactics(scn, strong, { type: 'stratagem', answer: scn.stratagem!.correct });
    applyTactics(scn, weak, { type: 'stratagem', answer: scn.stratagem!.options.find((o) => o.id !== scn.stratagem!.correct)!.id });
    expect([strong.supply.enemy, strong.cut, strong.stats.stratagem]).toEqual([0, 2, 'strong']);
    expect([weak.cut, weak.stats.stratagem]).toEqual([1, 'weak']);
    expect(() => applyTactics(scn, strong, { type: 'stratagem', answer: scn.stratagem!.correct })).toThrow(); // mưu kế chỉ dùng một lần
  });

  it('máy chủ kiểm tra lệnh: sai lượt, sai mục tiêu, cận chiến không với tới hàng sau, kỹ năng thiếu quân lương hoặc đang hồi chiêu', () => {
    const scn = battles.find((b) => b.code === 'binh-le-nguyen')!.scn;
    const { state: s } = createTactics(scn, 0);
    const actor = s.units[s.queue[0]];
    expect(actor.side).toBe('ally');
    const other = scn.allies.find((u) => u.id !== actor.id)!;
    expect(() => applyTactics(scn, s, { type: 'attack', unit: other.id, target: 'tiendo' })).toThrow(/lượt/);
    expect(() => applyTactics(scn, s, { type: 'attack', target: actor.id })).toThrow(); // không đánh quân mình
    expect(() => applyTactics(scn, s, { type: 'attack', target: 'khong_co' })).toThrow();
    // hàng trước của địch còn người: đơn vị cận chiến không đánh được kỵ xạ ở hàng sau
    if (!actor.ranged) expect(() => applyTactics(scn, s, { type: 'attack', target: 'atruat' })).toThrow(/hàng trước/);
    s.supply.ally = 0;
    expect(() => applyTactics(scn, s, { type: 'skill', target: 'tiendo' })).toThrow();
    // lệnh hợp lệ: phòng thủ hồi 1 quân lương và chuyển lượt
    const before = s.queue[0];
    const events = applyTactics(scn, s, { type: 'defend' });
    expect(events[0]).toMatchObject({ t: 'defend', unit: before });
    expect(s.supply.ally).toBe(1);
    expect(s.queue[0]).not.toBe(before);
  });

  it('khắc chế binh chủng và tiếp tế: giáo thắng kỵ binh; thuyền lương còn nổi thì địch được thêm quân lương', () => {
    const scn = battles.find((b) => b.code === 'van-don')!.scn;
    const a = createTactics(scn, 0).state, b = createTactics(scn, 0).state;
    for (const id of ['luong1', 'luong2', 'luong3']) { b.units[id].alive = false; b.units[id].hp = 0; }
    b.queue = b.queue.filter((id) => !id.startsWith('luong'));
    const round = (s: TState) => { const r = s.round; let g = 0; while (s.status === 'active' && s.round === r && g++ < 40) applyTactics(scn, s, { type: 'defend' }); };
    round(a); round(b);
    expect(a.supply.enemy).toBeGreaterThan(b.supply.enemy);
    const view = publicTactics(scn, createTactics(scn, 0).state) as Record<string, any>;
    expect(keysOf(view).has('correct')).toBe(false);
    expect(view.stratagem.options.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Màn Bạch Đằng 1288', () => {
  const scn = stage('bach-dang').content.battle as BdScenario;
  const GOOD: Array<[number, number]> = [[5, 1], [6, 1], [7, 1], [8, 1], [7, 0], [8, 0]];
  const LURE: BdAction[] = [{ type: 'provoke' }, { type: 'move', to: [5, 1] }, { type: 'move', to: [6, 1] }, { type: 'move', to: [7, 1] }, { type: 'move', to: [8, 0] }];

  function prepare(stakes: Array<[number, number]>): BdState {
    const { state } = createBachDang(scn);
    const todo = [...stakes];
    let guard = 0;
    while (state.phase === 'prepare' && guard++ < 40) {
      if (tideOf(scn, state).level === 0 && todo.length && state.placed < scn.stakes.per_turn) { applyBachDang(scn, state, { type: 'stake', at: todo.shift()! }); continue; }
      applyBachDang(scn, state, todo.length ? { type: 'wait' } : { type: 'ready' });
    }
    expect(todo).toEqual([]);
    return state;
  }
  function lure(state: BdState, acts: BdAction[]): BdState {
    for (const a of acts) if (state.status === 'active' && state.phase === 'lure') applyBachDang(scn, state, a);
    let guard = 0;
    while (state.status === 'active' && state.phase === 'lure' && guard++ < 10) applyBachDang(scn, state, { type: 'wait' });
    return state;
  }
  /** Phản công theo lối đơn giản: thả bè lửa vào thuyền mất cơ động, đánh thuyền vướng cọc, chặn lạch sâu trước thuyền còn chạy */
  function counter(state: BdState): BdState {
    let guard = 0;
    while (state.status === 'active' && guard++ < 200) {
      const view = publicBachDang(scn, state) as Record<string, any>;
      const allies = view.options.allies as Array<{ unit: string; moves: Array<{ to: [number, number]; attack: string[]; fire: string[] }> }>;
      if (!allies.length) { applyBachDang(scn, state, { type: 'end_turn' }); continue; }
      const units = Object.fromEntries((view.units as any[]).map((u) => [u.id, u]));
      const foes = (view.units as any[]).filter((u) => u.side === 'enemy' && ['free', 'slow', 'stuck'].includes(u.state));
      const runners = foes.filter((e) => e.state !== 'stuck');
      let best: { sc: number; act: BdAction } | null = null;
      const consider = (sc: number, act: BdAction) => { if (!best || sc > best.sc) best = { sc, act }; };
      for (const a of allies) for (const m of a.moves) {
        for (const t of m.fire) if (units[t].state !== 'free' && units[t].burn === 0) consider(70 + (units[t].flagship ? 8 : 0), { type: 'order', unit: a.unit, to: m.to, fire: t });
        let block = 0;
        for (const r of runners) if (scn.grid[m.to[1]][m.to[0]] === 'd' && m.to[0] > r.x && m.to[0] - r.x <= 3) block = Math.max(block, r.flagship ? 30 : 12);
        for (const t of m.attack) consider((units[t].state === 'stuck' ? 50 : 45) + (units[t].flagship ? 8 : 0) - units[t].hp * 0.5 + block, { type: 'order', unit: a.unit, to: m.to, attack: t });
        if (!m.attack.length) consider(block ? block + 5 : 10 - Math.min(...foes.map((e) => Math.abs(m.to[0] - e.x) + Math.abs(m.to[1] - e.y))), { type: 'order', unit: a.unit, to: m.to });
      }
      applyBachDang(scn, state, best!.act);
    }
    return state;
  }

  it('giai đoạn chuẩn bị: nước cao chưa thấy địa hình và chưa đóng được cọc; chỉ đóng trên bãi cạn lúc nước thấp, có hạn mức mỗi con nước', () => {
    const { state } = createBachDang(scn);
    expect(tideOf(scn, state)).toMatchObject({ level: 2, label: 'Cao' });
    const hidden = publicBachDang(scn, state) as Record<string, any>;
    expect(hidden.grid.revealed).toBe(false);
    expect(hidden.grid.cells.join('')).not.toMatch(/[ds]/); // bãi cạn và lạch sâu trông như nhau khi nước cao
    expect(hidden.tide.forecast.length).toBeGreaterThanOrEqual(5); // quy tắc con nước được công bố trước
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [6, 1] })).toThrow(/chờ nước thấp/);
    applyBachDang(scn, state, { type: 'wait' });
    expect(tideOf(scn, state).label).toBe('Đang rút');
    expect((publicBachDang(scn, state) as any).grid.revealed).toBe(true);
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [6, 1] })).toThrow();
    applyBachDang(scn, state, { type: 'wait' });
    expect(tideOf(scn, state).level).toBe(0);
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [6, 2] })).toThrow(/quá sâu/);
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [9, 0] })).toThrow(/Ghềnh đá/);
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [0, 0] })).toThrow(/bờ sông/);
    expect(() => applyBachDang(scn, state, { type: 'ready' })).toThrow(/Chưa có cụm cọc/);
    for (const at of [[5, 1], [6, 1], [7, 1]] as Array<[number, number]>) applyBachDang(scn, state, { type: 'stake', at });
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [8, 1] })).toThrow(/Mỗi con nước thấp/);
    // cọc ở cửa sông nhánh được phép nhưng có cảnh báo: sẽ chắn đường của chính quân mai phục
    applyBachDang(scn, state, { type: 'unstake', at: [7, 1] });
    expect(applyBachDang(scn, state, { type: 'stake', at: [5, 0] }).map((e) => e.t)).toEqual(['stake', 'warn']);
    expect(state.stakes).toHaveLength(3);
  });

  it('chơi đúng thì thắng 3 sao: cọc trên bãi cạn, nhử cả đoàn thuyền qua bãi cọc đúng lúc nước rút, phản công dứt điểm', () => {
    const state = lure(prepare(GOOD), LURE);
    expect(state.phase).toBe('counter');
    expect([...state.flags.stranded].sort()).toEqual(['hauquan', 'omanhi', 'phantiep']);
    expect(state.flags.hits).toBe(0);
    for (const id of ['omanhi', 'phantiep', 'hauquan']) expect(state.units[id].state).toBe('stuck');
    expect(['free']).toContain(state.units.hungdao.state); // cửa sông nhánh thông nên quân mai phục đổ ra được
    const end = counter(state);
    const r = bachDangResult(scn, end);
    expect([end.status, end.reason, r.stars, r.escaped]).toEqual(['won', 'destroyed', 3, 0]);
    expect(r.mistakes).toEqual([]);
    expect(r.good.length).toBeGreaterThanOrEqual(2);
  });

  it('thua khi không khiêu chiến hoặc đứng yên cho địch áp sát (mất đội thuyền nhẹ)', () => {
    const idle = lure(prepare(GOOD), []);
    expect([idle.status, idle.reason]).toEqual(['lost', 'bait_lost']);
    expect(bachDangResult(scn, idle).mistakes.map((m) => m.code)).toEqual(expect.arrayContaining(['not_provoked', 'bait_lost']));
    const still = lure(prepare(GOOD), [{ type: 'provoke' }]);
    expect([still.status, still.reason]).toEqual(['lost', 'bait_lost']);
  });

  it('thua khi nhử địch theo lạch sâu: nước rút không thuyền nào vướng cọc, có lời giải thích sai lầm', () => {
    const state = lure(prepare(GOOD), [{ type: 'provoke' }, { type: 'move', to: [5, 2] }, { type: 'move', to: [7, 2] }, { type: 'move', to: [9, 2] }, { type: 'move', to: [10, 2] }]);
    expect(state.flags.stranded).toEqual([]);
    const end = counter(state);
    expect(end.status).toBe('lost');
    const r = bachDangResult(scn, end);
    expect(r.stars).toBe(0);
    expect(r.mistakes.map((m) => m.code)).toContain('no_strand');
  });

  it('thua khi đặt trận địa sai: cọc chắn cửa sông nhánh khóa quân mai phục, thuyền chỉ huy địch chạy thoát', () => {
    const state = lure(prepare([[5, 0], [6, 0], [7, 0], [8, 4], [7, 4], [9, 4]]), LURE.slice(0, 4).concat([{ type: 'move', to: [8, 1] }]));
    expect([...state.flags.blocked].sort()).toEqual(['haivua', 'hungdao']);
    expect(state.units.hungdao.state).toBe('blocked');
    const end = counter(state);
    expect(end.status).toBe('lost');
    expect(bachDangResult(scn, end).mistakes.map((m) => m.code)).toEqual(expect.arrayContaining(['mouth_blocked', 'no_strand']));
  });

  it('thủy triều, mắc cạn và sát thương là thật: thuyền vướng cọc đứng yên và hư hại, bè lửa trượt thuyền còn cơ động, nước lên lại thì hết thời cơ', () => {
    const state = lure(prepare(GOOD), LURE);
    const hp = state.units.omanhi.hp;
    expect(hp).toBe(scn.enemies[0].hp - scn.strand_damage);
    const at = [state.units.omanhi.x, state.units.omanhi.y];
    // bỏ lượt liên tục: thuyền vướng cọc không rời vị trí, cung thủ hai bờ vẫn bắn; hết các lượt nước ròng thì thua vì nước lên lại
    let guard = 0;
    while (state.status === 'active' && guard++ < 20) applyBachDang(scn, state, { type: 'end_turn' });
    expect([state.units.omanhi.x, state.units.omanhi.y]).toEqual(at);
    expect(state.units.omanhi.hp).toBeLessThan(hp);
    expect([state.status, state.reason]).toEqual(['lost', 'tide']);
    // bè lửa vào thuyền còn cơ động thì trượt
    const free = lure(prepare(GOOD), [{ type: 'provoke' }, { type: 'move', to: [5, 2] }, { type: 'move', to: [7, 2] }, { type: 'move', to: [9, 2] }, { type: 'move', to: [10, 2] }]);
    const target = Object.values(free.units).find((u) => u.side === 'enemy' && u.state === 'free')!;
    const fleet = Object.values(free.units).find((u) => u.role === 'fleet' && u.state === 'free' && Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= 4);
    if (fleet) {
      const ev = applyBachDang(scn, free, { type: 'order', unit: fleet.id, fire: target.id });
      expect(ev.find((e) => e.t === 'fire')).toMatchObject({ ok: false });
      expect(free.flags.fire_missed).toBe(true);
    }
  });

  it('máy chủ từ chối lệnh không hợp lệ: đi quá tầm, khiêu chiến ngoài tầm, lệnh sai giai đoạn, ra lệnh hai lần trong một lượt', () => {
    const state = prepare(GOOD);
    expect(() => applyBachDang(scn, state, { type: 'move', to: [11, 1] })).toThrow(/không tới được/);
    expect(() => applyBachDang(scn, state, { type: 'stake', at: [6, 3] })).toThrow();
    expect(() => applyBachDang(scn, state, { type: 'order', unit: 'thanhduc' } as BdAction)).toThrow();
    expect(() => applyBachDang(scn, state, { type: 'move', to: [3, 9] as any })).toThrow();
    // đã khiêu chiến cả đoàn rồi thì không khiêu chiến lại được (lệnh thừa không làm mất lượt)
    const twice = prepare(GOOD);
    applyBachDang(scn, twice, { type: 'provoke' });
    expect(Object.values(twice.units).filter((u) => u.side === 'enemy').every((u) => u.chasing)).toBe(true);
    const turn = twice.turn;
    expect(() => applyBachDang(scn, twice, { type: 'provoke' })).toThrow(/đã đuổi theo/);
    expect(twice.turn).toBe(turn);
    const c = lure(prepare(GOOD), LURE);
    applyBachDang(scn, c, { type: 'order', unit: 'thanhduc' });
    expect(() => applyBachDang(scn, c, { type: 'order', unit: 'thanhduc' })).toThrow(/đã ra lệnh/);
    expect(() => applyBachDang(scn, c, { type: 'order', unit: 'omanhi' })).toThrow();
    expect(() => applyBachDang(scn, c, { type: 'provoke' })).toThrow();
  });

  it('kịch bản sai cấu trúc bị từ chối khi lưu', () => {
    const raw = JSON.parse(JSON.stringify(stage('bach-dang').content.battle));
    expect(() => normalizeBachDang({ ...raw, tide: { ...raw.tide, lure: [2, 1, 2] } })).toThrow();
    expect(() => normalizeBachDang({ ...raw, tide: { ...raw.tide, prepare: [2, 2, 1] } })).toThrow();
    expect(() => normalizeBachDang({ ...raw, grid: raw.grid.slice(0, 4) })).toThrow();
    expect(() => normalizeBachDang({ ...raw, enemies: raw.enemies.map((e: any) => ({ ...e, flagship: false })) })).toThrow();
    expect(() => normalizeBachDang({ ...raw, fleets: [{ ...raw.fleets[0], mouth: [6, 2] }] })).toThrow();
  });
});
