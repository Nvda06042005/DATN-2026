/**
 * Hook đồng bộ tiến độ nhiệm vụ trước và sau khi hoàn thành một bài học / bài tập / mở rương,
 * đồng thời đánh dấu đã xem các thông báo nhiệm vụ/mục tiêu vừa ăn mừng để CelebrationHost không hiện lặp.
 */
import { useCallback, useEffect, useRef } from 'react';
import * as gameApi from '@/api/gameApi';
import { computeQuestDeltas, type QuestDeltaItem } from '@/lib/learning-celebration';
import type { GameQuest } from '@/types/gamification';

export interface CapturedCelebration {
  questDeltas: QuestDeltaItem[];
  ackIds: number[];
}

export function useQuestSnapshot(token: string, disabled = false, refreshKey = 0) {
  const beforeRef = useRef<GameQuest[] | null>(null);
  const seenCelebIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (disabled) return undefined;
    let alive = true;
    gameApi.gameQuests(token).then((res) => {
      if (alive) beforeRef.current = res.daily;
    }).catch(() => undefined);
    gameApi.celebrations(token).then((list) => {
      if (alive) list.forEach((x) => seenCelebIdsRef.current.add(x.id));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [token, disabled, refreshKey]);

  const captureAfter = useCallback(async (): Promise<CapturedCelebration> => {
    if (disabled) return { questDeltas: [], ackIds: [] };
    const [afterRes, celebList] = await Promise.all([
      gameApi.gameQuests(token).catch(() => null),
      gameApi.celebrations(token).catch(() => []),
    ]);
    const daily = afterRes?.daily ?? [];
    const questDeltas = computeQuestDeltas(beforeRef.current ?? daily, daily);
    // Đã ăn mừng trực tiếp nhiệm vụ/mục tiêu ngày trong màn 3 bước -> tránh CelebrationHost lặp lại
    const ackIds = celebList
      .filter((c) => !seenCelebIdsRef.current.has(c.id) && (c.kind === 'quest' || c.kind === 'goal'))
      .map((c) => c.id);
    if (afterRes?.daily) beforeRef.current = afterRes.daily;
    ackIds.forEach((id) => seenCelebIdsRef.current.add(id));
    return { questDeltas, ackIds };
  }, [token, disabled]);

  const acknowledge = useCallback((ids: number[]) => {
    if (!disabled && ids.length) {
      gameApi.ackCelebrations(token, ids).catch(() => undefined);
    }
  }, [token, disabled]);

  return { captureAfter, acknowledge };
}
