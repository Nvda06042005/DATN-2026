/** Trạng thái game của học sinh: tạo mới, khôi phục bản lưu trên server, các phép tính Điền Trang và chiến dịch */
import { PHASES, PHASE_BY_ID } from '@/constants/campaigns';
import { HEROES, HERO_BY_ID } from '@/constants/heroes';
import type { DailyTaskDef, GameState, HeroState, PhaseDef } from '@/types/game';
import { BUILDINGS, CARDS, DAILY_TASKS, RECIPES, RELICS, farmCap, farmRate } from '@/constants/game';
import { newWorld, restoreWorld } from '@/lib/world-engine';

export const todayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const newGameState = (now = Date.now()): GameState => ({
  v: 1,
  createdAt: now,
  buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, { level: b.start, lastCollect: now, upgradeEnds: null }])) as GameState['buildings'],
  luong: 200,
  quan: 15,
  heroes: Object.fromEntries(HEROES.filter((h) => h.join === 'start').map((h) => [h.id, { stage: 1, battles: 0 }])),
  cards: { dan_binh: 1 },
  relics: [],
  relic: null,
  recruit: null,
  campaign: {},
  tower: 0,
  codex: [],
  daily: { day: todayKey(), progress: {}, claimed: [] },
  raid: { sessions: 0, lastDay: '' },
  stats: { sessions: 0, battles: 0, wins: 0, harvests: 0 },
  seen: [],
  tutorial: false,
  settings: { theme: 'system', timer: true, sound: false, reduceMotion: false },
  world: newWorld(),
});

/** Đọc trạng thái đã lưu, bổ sung trường mới và loại bỏ dữ liệu hỏng */
export const restoreGameState = (raw: unknown): GameState => {
  const base = newGameState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<GameState>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const buildings = { ...base.buildings };
  for (const b of BUILDINGS) {
    const saved = s.buildings?.[b.id];
    if (saved) {
      buildings[b.id] = {
        level: Math.max(0, Math.min(b.maxLevel, Math.round(num(saved.level, b.start)))),
        lastCollect: num(saved.lastCollect, base.createdAt),
        upgradeEnds: typeof saved.upgradeEnds === 'number' ? saved.upgradeEnds : null,
      };
    }
  }
  const heroes: Record<string, HeroState> = { ...base.heroes };
  for (const [id, h] of Object.entries(s.heroes ?? {})) {
    if (HERO_BY_ID[id] && h) heroes[id] = { stage: (Math.max(1, Math.min(3, Math.round(num(h.stage, 1)))) as 1 | 2 | 3), battles: Math.max(0, Math.round(num(h.battles, 0))) };
  }
  const cards: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.cards ?? {})) if (CARDS[id]) cards[id] = Math.max(0, Math.round(num(n, 0)));
  const campaign: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.campaign ?? {})) if (PHASE_BY_ID[id]) campaign[id] = Math.max(0, Math.min(3, Math.round(num(n, 0))));
  return {
    ...base,
    createdAt: num(s.createdAt, base.createdAt),
    buildings,
    luong: Math.max(0, Math.round(num(s.luong, base.luong))),
    quan: Math.max(0, Math.round(num(s.quan, base.quan))),
    heroes,
    cards,
    relics: (s.relics ?? []).filter((r) => RELICS[r]),
    relic: s.relic && RELICS[s.relic] ? s.relic : null,
    recruit: s.recruit && RECIPES.some((r) => r.id === s.recruit?.recipe) ? { recipe: s.recruit.recipe, endsAt: num(s.recruit.endsAt, Date.now()) } : null,
    campaign,
    tower: Math.max(0, Math.min(10, Math.round(num(s.tower, 0)))),
    codex: (s.codex ?? []).filter((c) => typeof c === 'string').slice(0, 80),
    daily: s.daily && typeof s.daily.day === 'string' ? { day: s.daily.day, progress: { ...(s.daily.progress ?? {}) }, claimed: [...(s.daily.claimed ?? [])] } : base.daily,
    raid: { sessions: Math.max(0, Math.round(num(s.raid?.sessions, 0))), lastDay: typeof s.raid?.lastDay === 'string' ? s.raid.lastDay : '' },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    seen: (s.seen ?? []).filter((q) => typeof q === 'string').slice(-60),
    tutorial: Boolean(s.tutorial),
    settings: { ...base.settings, ...(s.settings ?? {}) },
    world: restoreWorld(s.world),
  };
};

/** 3 nhiệm vụ của ngày (đổi theo ngày, giống nhau với mọi học sinh) */
export const dailyTasksFor = (day: string) => {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_TASKS];
  const picked: DailyTaskDef[] = [];
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(h % pool.length, 1)[0]);
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return picked;
};

/** Sao của một màn (tối đa 9) và việc đã hoàn thành màn hay chưa */
export const campaignStars = (state: GameState, c: 1 | 2 | 3) => PHASES.filter((p) => p.campaign === c).reduce((sum, p) => sum + (state.campaign[p.id] ?? 0), 0);

export const campaignDone = (state: GameState, c: 1 | 2 | 3) => PHASES.filter((p) => p.campaign === c).every((p) => (state.campaign[p.id] ?? 0) > 0);

export const phaseUnlocked = (state: GameState, p: PhaseDef) => {
  if (p.campaign > 1 && !campaignDone(state, (p.campaign - 1) as 1 | 2)) return false;
  const list = PHASES.filter((x) => x.campaign === p.campaign);
  const idx = list.findIndex((x) => x.id === p.id);
  return idx === 0 || (state.campaign[list[idx - 1].id] ?? 0) > 0;
};

/** Cấp độ người chơi theo XP (server) */
export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;

export const levelXp = (level: number) => (level - 1) * (level - 1) * 40;

/** Lương Thảo đang chờ thu trên ruộng (tính theo mốc thời gian, có trần) */
export const farmReady = (state: GameState, now: number) => {
  const b = state.buildings.ruong;
  if (b.level <= 0) return 0;
  const produced = ((now - b.lastCollect) / 3_600_000) * farmRate(b.level);
  return Math.max(0, Math.min(farmCap(b.level), Math.floor(produced)));
};

export const raidDue = (state: GameState) => state.raid.sessions >= 3 && state.raid.lastDay !== todayKey() && state.luong >= 60;

/** Hoàn tất các công trình đã nâng cấp xong */
export const finalizeUpgrades = (s: GameState, now: number): GameState => {
  let changed = false;
  const buildings = { ...s.buildings };
  for (const b of BUILDINGS) {
    const cur = buildings[b.id];
    if (cur.upgradeEnds && cur.upgradeEnds <= now) {
      changed = true;
      buildings[b.id] = { ...cur, level: Math.min(b.maxLevel, cur.level + 1), upgradeEnds: null, lastCollect: b.id === 'ruong' && cur.level === 0 ? now : cur.lastCollect };
    }
  }
  if (!changed) return s;
  const relics = [...s.relics];
  if (buildings.ben.level >= 3 && !relics.includes('non_ma_loi')) relics.push('non_ma_loi');
  return { ...s, buildings, relics };
};
