/**
 * Logic thuần cho luồng ăn mừng kết thúc bài học kiểu Duolingo (3 bước: Tổng kết -> Tiến độ nhiệm vụ -> Mở rương)
 * và tính toán đếm ngược / thử thách tháng trên màn Nhiệm vụ. Tách riêng để kiểm thử đơn vị nhanh.
 */
import type { GameQuest } from '@/types/gamification';
import type { NodeResult } from '@/types/learning';

export interface QuestDeltaItem {
  id: number;
  title: string;
  metric: string;
  target: number;
  prevProgress: number;
  nextProgress: number;
  rewardXp: number;
  rewardGold: number;
  justCompleted: boolean;
  alreadyDone: boolean;
}

export interface CelebrationSummaryData {
  headline: string;
  subtitle?: string | null;
  xpEarned: number;
  accuracyPercent: number;
  accuracyTag: string;
  stars?: number;
  elapsedMs?: number | null;
  passed?: boolean;
  nextNodeTitle?: string | null;
  journeyCompleted?: boolean;
}

export interface EarnedRewardsSummary {
  totalGold: number;
  totalBinhThu: number;
  questBonusXp: number;
  badge: string | null;
  card: boolean;
  fragments: Array<{ card: string; qty: number; merged: boolean }>;
  unlockedSources: Array<{ id: number; title: string }>;
  hasChestReward: boolean;
}

export type CelebrationStep = 'summary' | 'quests' | 'chest';

export function accuracyTagFor(percent: number, passed = true): string {
  if (!passed) return 'CỐ GẮNG NHÉ!';
  if (percent >= 90) return 'TUYỆT VỜI!';
  if (percent >= 75) return 'RẤT TỐT!';
  return 'HOÀN THÀNH!';
}

export function formatClockMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return '0:00';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function computeQuestDeltas(
  before: GameQuest[] | null | undefined,
  after: GameQuest[] | null | undefined,
): QuestDeltaItem[] {
  if (!after || after.length === 0) return [];
  const beforeById = new Map((before ?? []).map((q) => [q.id, q]));
  return after.map((q) => {
    const prev = beforeById.get(q.id);
    const nextProgress = Math.min(q.target, Math.max(0, q.progress));
    const alreadyDone = Boolean(prev?.completed_at);
    const prevProgress = prev
      ? Math.min(nextProgress, Math.max(0, prev.progress))
      : nextProgress;
    const justCompleted = (Boolean(q.completed_at) || nextProgress >= q.target) && !alreadyDone;
    return {
      id: q.id,
      title: q.title,
      metric: q.metric,
      target: q.target,
      prevProgress,
      nextProgress,
      rewardXp: q.reward_xp,
      rewardGold: q.reward_gold,
      justCompleted,
      alreadyDone,
    };
  });
}

export function summarizeEarnedRewards(input: {
  nodeResult?: NodeResult | null;
  questDeltas?: QuestDeltaItem[];
  extraGold?: number;
}): EarnedRewardsSummary {
  const deltas = input.questDeltas ?? [];
  const nr = input.nodeResult ?? null;
  const r = nr?.rewards;

  const questGold = deltas.filter((d) => d.justCompleted).reduce((s, d) => s + d.rewardGold, 0);
  const questBonusXp = deltas.filter((d) => d.justCompleted).reduce((s, d) => s + d.rewardXp, 0);

  const totalGold = (r?.gold ?? 0) + questGold + (input.extraGold ?? 0);
  const totalBinhThu = r?.binh_thu ?? 0;
  const badge = r?.badge ?? null;
  const card = Boolean(r?.card);
  const fragments = r?.fragments ?? [];
  const unlockedSources = nr?.unlocked_sources ?? [];

  const hasChestReward = Boolean(
    totalGold > 0 ||
      totalBinhThu > 0 ||
      badge ||
      card ||
      fragments.length > 0 ||
      unlockedSources.length > 0,
  );

  return {
    totalGold,
    totalBinhThu,
    questBonusXp,
    badge,
    card,
    fragments,
    unlockedSources,
    hasChestReward,
  };
}

export function buildCelebrationSteps(input: {
  skipSummary?: boolean;
  questDeltas: QuestDeltaItem[];
  rewards: EarnedRewardsSummary;
}): CelebrationStep[] {
  const steps: CelebrationStep[] = [];
  if (!input.skipSummary) steps.push('summary');
  if (input.questDeltas.length > 0) steps.push('quests');
  if (input.rewards.hasChestReward || input.questDeltas.some((d) => d.justCompleted)) {
    steps.push('chest');
  }
  if (steps.length === 0) steps.push('summary');
  return steps;
}

export function questsStepHeadline(deltas: QuestDeltaItem[]): string {
  const completedCount = deltas.filter((d) => d.justCompleted || d.alreadyDone).length;
  const anyNew = deltas.some((d) => d.justCompleted);
  if (deltas.length > 0 && completedCount === deltas.length && anyNew) {
    return 'Hoàn thành tất cả nhiệm vụ hôm nay!';
  }
  if (anyNew) return 'Hoàn thành nhiệm vụ hôm nay!';
  return 'Tiến độ Nhiệm vụ hôm nay';
}

export function chestPrimaryHeadline(rewards: EarnedRewardsSummary): string {
  if (rewards.totalGold > 0) return `+${rewards.totalGold} vàng`;
  if (rewards.totalBinhThu > 0) return `+${rewards.totalBinhThu} Binh thư`;
  if (rewards.fragments.length > 0) {
    const f = rewards.fragments[0];
    return `+${f.qty} mảnh thẻ ${f.card}`;
  }
  if (rewards.badge) return `Huy hiệu “${rewards.badge}”`;
  if (rewards.card) return '+1 Thẻ nhân vật';
  return 'Phần thưởng hoàn thành!';
}

/** Số giờ/ngày còn lại theo ngày lịch Việt Nam (yyyy-mm-dd) */
export function timeLeftLabel(targetIsoDay: string, nowMs = Date.now()): string {
  const ms = new Date(`${targetIsoDay}T00:00:00+07:00`).getTime() - nowMs;
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  if (hours >= 48) return `${Math.ceil(hours / 24)} ngày`;
  return `${hours} giờ`;
}

/** Thông tin thử thách tháng theo múi giờ Việt Nam */
export function monthlyChallengeInfo(
  completedThisMonth: number,
  nowMs = Date.now(),
): {
  monthLabel: string;
  title: string;
  daysLeft: number;
  done: number;
  target: number;
} {
  // Chuyển sang giờ VN (UTC+7)
  const vn = new Date(nowMs + 7 * 3600_000);
  const year = vn.getUTCFullYear();
  const month = vn.getUTCMonth() + 1;
  const day = vn.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysLeft = Math.max(1, lastDay - day + 1);
  const target = 20;
  return {
    monthLabel: `THÁNG ${month}`,
    title: `Thử thách Tháng ${month}`,
    daysLeft,
    done: Math.min(target, Math.max(0, completedThisMonth)),
    target,
  };
}
