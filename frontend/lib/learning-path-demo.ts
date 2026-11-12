/**
 * Dữ liệu & trạng thái lộ trình mẫu CHỈ dùng khi chạy local (__DEV__) để xem trước tab Học,
 * làm thử một bài ngắn và trải nghiệm luồng ăn mừng 3 bước + tab Nhiệm vụ kiểu Duolingo
 * khi tài khoản hiện tại chưa có hành trình được công bố trên server. Không ghi DB.
 */
import { useSyncExternalStore } from 'react';
import type { GameQuest } from '@/types/gamification';
import type { LearningPath, NodeDetail, NodeKind, NodeResult, NodeState, PathGate, PathNode } from '@/types/learning';

const KIND_LABEL: Record<NodeKind, string> = {
  lesson: 'Bài học', quiz: 'Câu hỏi', battle: 'Trận đánh', source: 'Tư liệu', final: 'Quyết chiến',
  practice: 'Luyện tập', listen: 'Nghe kể', chest: 'Rương', gate_test: 'Kiểm tra cửa',
};

let seq = 9000;
const makeNode = (kind: NodeKind, title: string, state: NodeState, stars = 0): PathNode => ({
  id: ++seq,
  position: 0,
  kind,
  kind_label: KIND_LABEL[kind],
  title,
  icon: null,
  state,
  stars,
  best_percent: state === 'done' ? 100 : 0,
  reward_points: kind === 'chest' ? 50 : 100,
  lock_reason: state === 'locked' ? 'Hoàn thành bài trước' : null,
  steps: { done: state === 'done' ? 1 : 0, total: 1 },
});

const makeGate = (id: number, no: number, title: string, summary: string, nodes: PathNode[]): PathGate => {
  nodes.forEach((n, i) => { n.position = i + 1; });
  const done = nodes.filter((n) => n.state === 'done').length;
  return {
    id,
    no,
    title,
    summary,
    nodes,
    done,
    state: done === nodes.length ? 'done' : nodes.some((n) => n.state !== 'locked') ? 'current' : 'locked',
  };
};

const lockedGate = (id: number, no: number, title: string, summary: string, titles: string[]): PathGate =>
  makeGate(
    id,
    no,
    title,
    summary,
    titles.map((t, i) =>
      makeNode(
        i === 3 ? 'chest' : i === titles.length - 1 ? 'gate_test' : i % 2 ? 'quiz' : 'lesson',
        t,
        'locked',
      ),
    ),
  );

const BASE_PARTS: LearningPath['parts'] = [
  {
    no: 1,
    campaign: { id: 1, title: 'Kháng chiến lần I (1258)', year_label: 'Năm 1258', summary: 'Chiến lược Vườn không nhà trống và trận phản công Đông Bộ Đầu.' },
    journey: { id: 1, title: 'Hào khí Đông A – Kháng chiến lần thứ nhất', from_class: false },
    totals: { nodes: 0, done: 0 },
    gates: [
      makeGate(9001, 1, 'Bình Lệ Nguyên', 'Quân Mông Cổ tràn sang, vua Trần Thái Tông thân chinh.', [
        makeNode('lesson', 'Giặc Mông Cổ tràn sang', 'done', 3),
        makeNode('quiz', 'Thử tài: Bình Lệ Nguyên', 'done', 3),
        makeNode('listen', 'Nghe kể: Lê Tần cứu vua', 'done', 2),
        makeNode('chest', 'Rương thần Đông A', 'done'),
        makeNode('lesson', 'Rút lui bảo toàn lực lượng', 'done', 3),
        makeNode('practice', 'Ôn nhanh mốc thời gian', 'done', 2),
        makeNode('gate_test', 'Kiểm tra Cửa 1', 'done', 3),
      ]),
      makeGate(9002, 2, 'Vườn không nhà trống', 'Thăng Long bỏ ngỏ, giặc rơi vào cảnh thiếu lương.', [
        makeNode('lesson', 'Chiến lược vườn không nhà trống', 'done', 3),
        makeNode('quiz', 'Thử tài: Thăng Long bỏ ngỏ', 'available'),
        makeNode('source', 'Tư liệu: Đại Việt sử ký', 'locked'),
        makeNode('chest', 'Rương lương thảo', 'locked'),
        makeNode('battle', 'Trận Đông Bộ Đầu', 'locked'),
        makeNode('practice', 'Luyện tập nhân vật', 'locked'),
        makeNode('gate_test', 'Kiểm tra Cửa 2', 'locked'),
      ]),
      lockedGate(9003, 3, 'Đại thắng Đông Bộ Đầu', 'Phản công thần tốc, quét sạch quân Mông Cổ.', [
        'Đêm phản công', 'Thử tài: Đông Bộ Đầu', 'Nghe kể: giặc Phật', 'Rương chiến thắng', 'Bài học lịch sử', 'Kiểm tra Cửa 3',
      ]),
    ],
  },
  {
    no: 2,
    campaign: { id: 2, title: 'Kháng chiến lần II (1285)', year_label: 'Năm 1285', summary: 'Hội nghị Diên Hồng, Hịch tướng sĩ và đại thắng Chương Dương – Hàm Tử.' },
    journey: { id: 2, title: 'Hào khí Chương Dương', from_class: false },
    totals: { nodes: 0, done: 0 },
    gates: [
      lockedGate(9011, 1, 'Từ Bình Than đến Diên Hồng', 'Vua tôi và bô lão Đại Việt đồng lòng.', [
        'Hội nghị Bình Than', 'Thử tài: Diên Hồng', 'Hịch tướng sĩ', 'Rương hào khí', 'Kiểm tra Cửa 1',
      ]),
      lockedGate(9012, 2, 'Chương Dương – Hàm Tử', 'Phản công giải phóng Thăng Long.', [
        'Trận Hàm Tử', 'Thử tài: Chương Dương', 'Nghe kể: Trần Quang Khải', 'Rương khải hoàn', 'Kiểm tra Cửa 2',
      ]),
    ],
  },
  {
    no: 3,
    campaign: { id: 3, title: 'Kháng chiến lần III (1288)', year_label: 'Năm 1288', summary: 'Trận Vân Đồn cắt đường lương và thủy chiến Bạch Đằng giang lịch sử.' },
    journey: { id: 3, title: 'Bạch Đằng giang', from_class: false },
    totals: { nodes: 0, done: 0 },
    gates: [
      lockedGate(9021, 1, 'Vân Đồn – Bạch Đằng', 'Đánh tan thuyền lương, nhấn chìm thủy quân Nguyên.', [
        'Trận Vân Đồn', 'Thử tài: cắm cọc', 'Nghe kể: Trần Khánh Dư', 'Rương Bạch Đằng', 'Kiểm tra Cửa 1',
      ]),
    ],
  },
];

// ---------------------------------------------------------------------- trạng thái demo cục bộ
interface DemoStoreState {
  active: boolean;
  completedIds: Set<number>;
  dailyQuests: GameQuest[];
  monthlyDone: number;
}

const INITIAL_DAILY_QUESTS: GameQuest[] = [
  { id: 9501, title: 'Kiếm 100 điểm học tập', metric: 'xp_earned', target: 100, progress: 60, reward_xp: 20, reward_gold: 10, completed_at: null, period: 'daily' },
  { id: 9502, title: 'Hoàn thành 1 bài học trên lộ trình', metric: 'nodes_completed', target: 1, progress: 0, reward_xp: 20, reward_gold: 5, completed_at: null, period: 'daily' },
  { id: 9503, title: 'Trả lời đúng 3 câu hỏi lịch sử', metric: 'correct_answers', target: 3, progress: 1, reward_xp: 30, reward_gold: 10, completed_at: null, period: 'daily' },
];

const state: DemoStoreState = {
  active: false,
  completedIds: new Set<number>(),
  dailyQuests: INITIAL_DAILY_QUESTS.map((q) => ({ ...q })),
  monthlyDone: 11,
};

let snapshotVersion = 0;
const listeners = new Set<() => void>();
const notify = () => {
  snapshotVersion += 1;
  listeners.forEach((fn) => fn());
};

export function isDemoNodeId(id: number): boolean {
  return id >= 9001 && id <= 9300;
}

export function activateDemoMode(on = true): void {
  if (!__DEV__) return;
  if (state.active === on) return;
  state.active = on;
  notify();
}

export function resetDemoProgress(): void {
  state.completedIds.clear();
  state.dailyQuests = INITIAL_DAILY_QUESTS.map((q) => ({ ...q }));
  state.monthlyDone = 11;
  notify();
}

export function buildDemoLearningPath(): LearningPath {
  let unlockedNext = false;
  let currentRef: LearningPath['current'] = null;

  const parts = BASE_PARTS.map((part) => {
    const gates = part.gates.map((gate) => {
      const nodes = gate.nodes.map((node) => {
        const baseDone = node.state === 'done';
        const doneNow = baseDone || state.completedIds.has(node.id);
        let nextState: NodeState = doneNow ? 'done' : node.state;
        if (!doneNow && unlockedNext) {
          nextState = 'available';
          unlockedNext = false;
        }
        // Khi nút gốc đang 'available' vừa hoàn thành thì mở nút kế tiếp
        if (node.state === 'available' && state.completedIds.has(node.id)) {
          unlockedNext = true;
        }
        if (doneNow && state.completedIds.has(node.id) && node.state === 'locked') {
          unlockedNext = true;
        }
        if (!currentRef && nextState === 'available') {
          currentRef = { part_no: part.no, gate_no: gate.no, gate_title: gate.title, node_id: node.id };
        }
        return {
          ...node,
          state: nextState,
          stars: doneNow ? Math.max(node.stars, 3) : node.stars,
          best_percent: doneNow ? 100 : node.best_percent,
          lock_reason: nextState === 'locked' ? node.lock_reason : null,
          steps: { done: doneNow ? node.steps.total : 0, total: node.steps.total },
        };
      });
      const doneCount = nodes.filter((n) => n.state === 'done').length;
      const gState: PathGate['state'] = doneCount === nodes.length ? 'done' : nodes.some((n) => n.state !== 'locked') ? 'current' : 'locked';
      return { ...gate, nodes, done: doneCount, state: gState };
    });

    const totalNodes = gates.reduce((s, g) => s + g.nodes.length, 0);
    const totalDone = gates.reduce((s, g) => s + g.done, 0);
    return { ...part, gates, totals: { nodes: totalNodes, done: totalDone } };
  });

  return { parts, current: currentRef };
}

export const DEMO_LEARNING_PATH: LearningPath = buildDemoLearningPath();

export function buildDemoNodeDetail(node: PathNode, gateTitle: string): NodeDetail {
  const locked = node.state === 'locked';
  return {
    id: node.id,
    position: node.position,
    kind: node.kind,
    kind_label: node.kind_label,
    title: node.title,
    icon: node.icon,
    objective:
      node.kind === 'chest'
        ? 'Mở rương kho báu để nhận vàng, Binh thư và mảnh thẻ danh tướng thời Trần.'
        : `Khám phá nội dung “${node.title}” và trả lời nhanh các câu hỏi kiểm tra để mở chặng tiếp theo.`,
    state: node.state,
    stars: node.stars,
    best_percent: node.best_percent,
    attempts: node.state === 'done' ? 1 : 0,
    reward_points: node.reward_points,
    completed_at: node.state === 'done' ? new Date().toISOString() : null,
    pos_x: null,
    pos_y: null,
    preds: [],
    lock_reason: node.lock_reason,
    min_percent: null,
    min_stars: null,
    opens_at: null,
    reward_gold: node.kind === 'chest' ? 25 : 15,
    has_reward_card: false,
    has_reward_badge: false,
    content: node.kind === 'lesson'
      ? { lesson: { id: node.id, title: node.title, read_minutes: 3 } }
      : node.kind === 'quiz' || node.kind === 'gate_test' || node.kind === 'practice'
        ? { quiz: { id: node.id, title: node.title, pass_percent: 70, questions: 2, total_seconds: 120 } }
        : node.kind === 'battle' || node.kind === 'final'
          ? { battle: { id: node.id, name: node.title, year: 1258 } }
          : null,
    unlocks: [],
    can_start: !locked,
    pass_percent: 70,
    hint: locked ? 'Hoàn thành nút trước để mở khóa.' : 'Chế độ xem trước local: bấm Bắt đầu để làm bài mẫu và xem luồng ăn mừng 3 bước.',
    has_quiz: node.kind !== 'chest',
    needs_quiz: node.kind === 'quiz' || node.kind === 'gate_test',
    question_count: node.kind === 'chest' ? 0 : 2,
    reward_binh_thu: node.kind === 'chest' ? 2 : 1,
    gate: { id: 1, title: gateTitle },
  };
}

export interface DemoQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DemoLessonScript {
  summary: string;
  cards: Array<{ heading: string; text: string }>;
  questions: DemoQuestion[];
}

export function getDemoLessonScript(node: PathNode): DemoLessonScript {
  return {
    summary: `Bài xem trước tại local cho nút “${node.title}”. Trả lời xong sẽ mở luồng ăn mừng 3 bước kiểu Duolingo.`,
    cards: [
      {
        heading: 'Bối cảnh lịch sử',
        text: 'Đầu năm 1258, trước thế giặc Mông Cổ mạnh như vũ bão, triều đình nhà Trần đã chọn kế sách “Vườn không nhà trống”, tạm rút khỏi kinh thành Thăng Long để bảo toàn lực lượng và làm tiêu hao sinh lực địch.',
      },
      {
        heading: 'Thời cơ phản công',
        text: 'Khi quân Mông Cổ rơi vào cảnh thiếu lương thảo trầm trọng, vua Trần Thái Tông và Thái sư Trần Thủ Độ lệnh cho quân dân tổng phản công tại Đông Bộ Đầu (29/1/1258), đánh tan giặc khỏi Thăng Long.',
      },
    ],
    questions: [
      {
        id: node.id * 10 + 1,
        prompt: 'Trong cuộc kháng chiến lần thứ nhất (1258), nhà Trần đã thực hiện kế sách nào tại kinh thành Thăng Long?',
        options: ['Vườn không nhà trống', 'Đóng cọc trên sông Bạch Đằng', 'Tấn công trước sang đất Tống'],
        correctIndex: 0,
        explanation: 'Nhà Trần chủ động rút dân và lương thực khỏi Thăng Long (Vườn không nhà trống), khiến giặc rơi vào thế đói khát.',
      },
      {
        id: node.id * 10 + 2,
        prompt: 'Trận phản công quyết định đánh đuổi quân Mông Cổ khỏi Thăng Long năm 1258 diễn ra ở đâu?',
        options: ['Chương Dương', 'Đông Bộ Đầu', 'Vân Đồn'],
        correctIndex: 1,
        explanation: 'Chiến thắng Đông Bộ Đầu (bến sông Hồng) đã buộc quân Mông Cổ phải rút chạy về nước.',
      },
    ],
  };
}

export function completeDemoNode(input: {
  node: PathNode;
  xpEarned: number;
  correctCount: number;
}): {
  beforeQuests: GameQuest[];
  afterQuests: GameQuest[];
  nodeResult: NodeResult;
} {
  const beforeQuests = state.dailyQuests.map((q) => ({ ...q }));
  state.completedIds.add(input.node.id);

  let newlyCompleted = 0;
  const nowIso = new Date().toISOString();
  state.dailyQuests = state.dailyQuests.map((q) => {
    const delta =
      q.metric === 'xp_earned'
        ? input.xpEarned
        : q.metric === 'nodes_completed'
          ? 1
          : q.metric === 'correct_answers'
            ? Math.max(1, input.correctCount)
            : 0;
    const prevDone = Boolean(q.completed_at);
    const nextProgress = Math.min(q.target, q.progress + delta);
    const finishedNow = !prevDone && nextProgress >= q.target;
    if (finishedNow) newlyCompleted += 1;
    return {
      ...q,
      progress: nextProgress,
      completed_at: prevDone ? q.completed_at : finishedNow ? nowIso : null,
    };
  });
  state.monthlyDone = Math.min(20, state.monthlyDone + newlyCompleted);

  const afterQuests = state.dailyQuests.map((q) => ({ ...q }));
  const pathAfter = buildDemoLearningPath();
  const nextNode = pathAfter.current ? { id: pathAfter.current.node_id, title: pathAfter.current.gate_title } : null;

  const nodeResult: NodeResult = {
    first_completion: true,
    passed: true,
    stars: 3,
    percent: 100,
    points_awarded: input.xpEarned,
    unlocked_sources: [],
    rewards: {
      gold: input.node.kind === 'chest' ? 25 : 0,
      card: false,
      badge: null,
      binh_thu: input.node.kind === 'chest' ? 2 : 1,
      fragments: input.node.kind === 'chest' ? [{ card: 'Trần Quốc Toản', qty: 2, merged: false }] : undefined,
    },
    next_node: nextNode,
    journey_completed: false,
    campaign_final: false,
  };

  notify();
  return { beforeQuests, afterQuests, nodeResult };
}

let cachedSnapshot = {
  version: -1,
  active: false,
  path: DEMO_LEARNING_PATH,
  dailyQuests: state.dailyQuests,
  monthlyDone: state.monthlyDone,
};

function getSnapshot() {
  if (cachedSnapshot.version !== snapshotVersion) {
    cachedSnapshot = {
      version: snapshotVersion,
      active: state.active,
      path: buildDemoLearningPath(),
      dailyQuests: state.dailyQuests,
      monthlyDone: state.monthlyDone,
    };
  }
  return cachedSnapshot;
}

export function useDemoLearningState() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot,
    getSnapshot,
  );
}
