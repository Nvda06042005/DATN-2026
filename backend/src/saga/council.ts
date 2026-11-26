/**
 * Trận "Hội đồng" của Hành trình Đông A (25/11/2026, bản vẽ "Binh thư Sát Thát"): trận bằng lời nói và quyết định thay cho đánh nhau.
 * Dùng cho Hội nghị Diên Hồng (đưa thẻ thuyết phục các bô lão), Vườn không nhà trống (sơ tán, giấu lương), Vạn Kiếp (cắt đường lương),
 * Hội đồng Đại cục (chỉ huy cả cuộc chiến qua nhiều lượt) và Thử thách lịch sử ("Nếu… thì…") của Khối 9.
 *
 *  - Mỗi lượt là một tình huống (ai hỏi, hỏi gì) với 2–4 thẻ / phương án. Mỗi phương án có điểm 0–2 (2 = đúng như lịch sử / cách tốt nhất)
 *    và tác động lên các thanh chỉ số (ví dụ "Đồng lòng kháng chiến"). Thanh chỉ số giữ trong khoảng 0–100.
 *  - Máy chủ giữ trạng thái và chấm: dạng gửi cho học sinh không có điểm, tác động hay lời đáp của phương án chưa chọn.
 *  - Thắng khi sau lượt cuối mọi thanh chỉ số đạt ngưỡng. Sao theo tổng điểm các phương án đã chọn (chọn đúng như lịch sử mọi lượt = 3 sao).
 * Hàm thuần: cùng trạng thái, cùng lệnh cho cùng kết quả. Lời thoại và chỉ số là phần sáng tạo; dữ kiện lịch sử nằm ở dòng `history` của từng lượt.
 */
import { BadRequestException } from '@nestjs/common';

export interface CouncilMeter { id: string; label: string; start: number; win: number }
export interface CouncilOption { id: string; tag: string; text: string; say: string | null; reply: string; score: 0 | 1 | 2; effect: Record<string, number> }
export interface CouncilRound { id: string; who: string; ask: string; label: string; history: string; options: CouncilOption[] }
export interface CouncilCast { id: string; name: string; role: string; fictional: boolean }
export interface CouncilScenario {
  mode: 'council'; style: 'persuade' | 'command' | 'whatif'; title: string; intro: string; cast: CouncilCast[];
  meters: CouncilMeter[]; rounds: CouncilRound[]; tips: string[]; win_text: string; lose_text: string;
}
export interface CState {
  v: 1; round: number; meters: Record<string, number>; status: 'active' | 'won' | 'lost';
  picks: Array<{ round: string; option: string; score: number }>;
}
export type CAction = { type: 'play'; option: string };
export interface CEvent {
  t: 'play' | 'end'; round?: string; option?: string; tag?: string; text?: string; say?: string | null; reply?: string; score?: number;
  effect?: Record<string, number>; meters?: Record<string, number>; won?: boolean;
}
export interface CompareRow { label: string; mine: string; history: string; ok: boolean }

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9_]{1,16}$/;
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim().replace(/\s+/g, ' ');
};
const list = (v: unknown, label: string, min: number, max: number): any[] => (Array.isArray(v) && v.length >= min && v.length <= max ? v : bad(`${label}: cần từ ${min} đến ${max} mục`));
const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : bad(`${label} phải là số nguyên từ ${min} đến ${max}`);
};
const uniq = (ids: string[], label: string): void => { if (new Set(ids).size !== ids.length) bad(`${label}: mã bị trùng`); };
const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Kiểm tra kịch bản khi lưu (nội dung khởi tạo hoặc migration): sai cấu trúc thì báo lỗi tiếng Việt, không lưu */
export function normalizeCouncil(raw: unknown): CouncilScenario {
  if (!isObj(raw) || raw.mode !== 'council') return bad('Trận hội đồng không hợp lệ');
  const style = ['persuade', 'command', 'whatif'].includes(raw.style) ? raw.style as CouncilScenario['style'] : bad('Kiểu trận hội đồng không hợp lệ');
  const meters: CouncilMeter[] = list(raw.meters, 'Thanh chỉ số', 1, 3).map((m, i) => ({
    id: ID.test(String(m?.id)) ? String(m.id) : bad(`Thanh chỉ số ${i + 1}: mã không hợp lệ`), label: text(m?.label, `Thanh chỉ số ${i + 1}`, 40),
    start: int(m?.start, `Thanh chỉ số ${i + 1}: giá trị đầu`, 0, 100), win: int(m?.win, `Thanh chỉ số ${i + 1}: ngưỡng thắng`, 1, 100),
  }));
  uniq(meters.map((m) => m.id), 'Thanh chỉ số');
  const cast: CouncilCast[] = list(raw.cast ?? [], 'Nhân vật', 0, 5).map((c, i) => ({
    id: ID.test(String(c?.id)) ? String(c.id) : bad(`Nhân vật ${i + 1}: mã không hợp lệ`), name: text(c?.name, `Nhân vật ${i + 1}: tên`, 40),
    role: text(c?.role, `Nhân vật ${i + 1}: vai trò`, 60), fictional: Boolean(c?.fictional),
  }));
  const rounds: CouncilRound[] = list(raw.rounds, 'Lượt', 2, 6).map((r, i) => {
    const options: CouncilOption[] = list(r?.options, `Lượt ${i + 1}: phương án`, 2, 4).map((o, j) => {
      const effect: Record<string, number> = {};
      for (const [k, v] of Object.entries(isObj(o?.effect) ? o.effect : {})) {
        if (!meters.some((m) => m.id === k)) bad(`Lượt ${i + 1}, phương án ${j + 1}: không có thanh chỉ số "${k}"`);
        effect[k] = int(v, `Lượt ${i + 1}, phương án ${j + 1}: tác động`, -60, 60);
      }
      return {
        id: ID.test(String(o?.id)) ? String(o.id) : bad(`Lượt ${i + 1}, phương án ${j + 1}: mã không hợp lệ`), tag: text(o?.tag, `Lượt ${i + 1}, phương án ${j + 1}: loại thẻ`, 30),
        text: text(o?.text, `Lượt ${i + 1}, phương án ${j + 1}`, 160), say: o?.say ? text(o.say, 'Lời em nói', 240) : null, reply: text(o?.reply, 'Lời đáp', 320),
        score: ([0, 1, 2].includes(Number(o?.score)) ? Number(o.score) : bad('Điểm phương án phải là 0, 1 hoặc 2')) as 0 | 1 | 2, effect,
      };
    });
    uniq(options.map((o) => o.id), `Lượt ${i + 1}`);
    if (options.filter((o) => o.score === 2).length !== 1) bad(`Lượt ${i + 1}: cần đúng một phương án như lịch sử (2 điểm)`);
    return {
      id: ID.test(String(r?.id)) ? String(r.id) : `r${i + 1}`, who: text(r?.who, `Lượt ${i + 1}: người hỏi`, 60), ask: text(r?.ask, `Lượt ${i + 1}: tình huống`, 400),
      label: text(r?.label, `Lượt ${i + 1}: tên quyết định`, 40), history: text(r?.history, `Lượt ${i + 1}: lịch sử`, 300), options,
    };
  });
  uniq(rounds.map((r) => r.id), 'Lượt');
  // kịch bản phải thắng được khi chọn đúng như lịch sử mọi lượt
  const best = Object.fromEntries(meters.map((m) => [m.id, m.start]));
  for (const r of rounds) for (const [k, v] of Object.entries(r.options.find((o) => o.score === 2)!.effect)) best[k] = clamp(best[k] + v);
  if (meters.some((m) => best[m.id] < m.win)) bad('Chọn đúng như lịch sử mọi lượt vẫn chưa đạt ngưỡng thắng: hãy chỉnh tác động hoặc ngưỡng');
  return {
    mode: 'council', style, title: text(raw.title, 'Tên trận', 80), intro: text(raw.intro, 'Lời dẫn', 500), cast, meters, rounds,
    tips: list(raw.tips ?? [], 'Mẹo', 0, 4).map((t) => text(t, 'Mẹo', 200)), win_text: text(raw.win_text, 'Lời thắng', 300), lose_text: text(raw.lose_text, 'Lời thua', 300),
  };
}

export function createCouncil(scn: CouncilScenario): { state: CState; events: CEvent[] } {
  return { state: { v: 1, round: 0, meters: Object.fromEntries(scn.meters.map((m) => [m.id, m.start])), status: 'active', picks: [] }, events: [] };
}

/** Một lượt: đưa thẻ / chọn phương án của lượt hiện tại; lượt cuối thì kết thúc trận */
export function applyCouncil(scn: CouncilScenario, s: CState, a: CAction): CEvent[] {
  if (s.status !== 'active') bad('Trận đã kết thúc');
  if (!isObj(a) || a.type !== 'play') bad('Lệnh không hợp lệ trong trận hội đồng');
  const round = scn.rounds[s.round];
  const opt = round.options.find((o) => o.id === a.option) ?? bad('Phương án này không thuộc lượt hiện tại');
  for (const [k, v] of Object.entries(opt.effect)) s.meters[k] = clamp((s.meters[k] ?? 0) + v);
  s.picks.push({ round: round.id, option: opt.id, score: opt.score });
  s.round += 1;
  const events: CEvent[] = [{ t: 'play', round: round.id, option: opt.id, tag: opt.tag, text: opt.text, say: opt.say, reply: opt.reply, score: opt.score, effect: opt.effect, meters: { ...s.meters } }];
  if (s.round >= scn.rounds.length) {
    s.status = scn.meters.every((m) => (s.meters[m.id] ?? 0) >= m.win) ? 'won' : 'lost';
    events.push({ t: 'end', won: s.status === 'won', meters: { ...s.meters } });
  }
  return events;
}

/** Bảng so sánh "Quyết định / Của em / Lịch sử" cho màn Sử quan tổng kết */
export function councilCompare(scn: CouncilScenario, s: CState): CompareRow[] {
  return s.picks.map((p) => {
    const r = scn.rounds.find((x) => x.id === p.round)!;
    const mine = r.options.find((o) => o.id === p.option)!;
    return { label: r.label, mine: mine.text, history: r.history, ok: mine.score === 2 };
  });
}

export function councilResult(scn: CouncilScenario, s: CState): { won: boolean; stars: number; score: number; rounds: number; historic: number; compare: CompareRow[] } {
  const won = s.status === 'won';
  const sum = s.picks.reduce((n, p) => n + p.score, 0), max = scn.rounds.length * 2;
  const ratio = sum / Math.max(1, max);
  const stars = !won ? 0 : ratio >= 0.99 ? 3 : ratio >= 0.66 ? 2 : 1;
  const score = Math.round(ratio * 600) + (won ? 300 : 0) + Math.round(scn.meters.reduce((n, m) => n + (s.meters[m.id] ?? 0), 0) / scn.meters.length);
  return { won, stars, score, rounds: scn.rounds.length, historic: s.picks.filter((p) => p.score === 2).length, compare: councilCompare(scn, s) };
}

/** Trạng thái gửi cho trình duyệt: lượt hiện tại chỉ có loại thẻ và nội dung phương án; điểm, tác động, lời đáp chỉ có ở các lượt đã chơi */
export function publicCouncil(scn: CouncilScenario, s: CState): Record<string, unknown> {
  const current = s.status === 'active' ? scn.rounds[s.round] : null;
  return {
    mode: 'council', style: scn.style, title: scn.title, intro: scn.intro, cast: scn.cast, tips: scn.tips, status: s.status,
    round: Math.min(s.round + 1, scn.rounds.length), rounds: scn.rounds.length,
    meters: scn.meters.map((m) => ({ id: m.id, label: m.label, value: s.meters[m.id] ?? m.start, win: m.win })),
    current: current ? { id: current.id, who: current.who, ask: current.ask, options: current.options.map((o) => ({ id: o.id, tag: o.tag, text: o.text })) } : null,
    history: s.picks.map((p) => {
      const r = scn.rounds.find((x) => x.id === p.round)!;
      const o = r.options.find((x) => x.id === p.option)!;
      return { round: r.id, who: r.who, ask: r.ask, option: o.id, tag: o.tag, text: o.text, say: o.say, reply: o.reply, score: o.score };
    }),
    result: s.status === 'active' ? null : { ...councilResult(scn, s), text: s.status === 'won' ? scn.win_text : scn.lose_text },
  };
}

/** Người chơi máy để kiểm thử: chọn phương án đúng như lịch sử (hoặc phương án kém nhất khi `worst`) */
export function autoCouncil(scn: CouncilScenario, s: CState, worst = false): CAction {
  const r = scn.rounds[s.round];
  const pick = worst ? [...r.options].sort((a, b) => a.score - b.score)[0] : r.options.find((o) => o.score === 2)!;
  return { type: 'play', option: pick.id };
}
