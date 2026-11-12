/**
 * Động cơ Lộ trình Học tập Cá nhân hóa theo từng ngày (kết hợp mô hình VSTEP Owl + BKT 4 tham số Đông A).
 * Cho phép thiết lập qua 4 bước (Mục tiêu, Lịch học, Tự đánh giá, Xác định trình độ), sinh nhiệm vụ theo ngày
 * vừa khít quỹ thời gian rảnh, tự động đánh dấu hoàn thành, chỉnh sửa/ghim nhiệm vụ và cập nhật bằng AI/BKT.
 */
import type { BktRecommendationItem, BktRecommendationsResponse } from '@/types/ai';

export type GoalTier = 'foundation' | 'exam_ready' | 'mastery';
export type DurationMode = 'days' | 'exam_date';
export type StudyPurpose = 'kiem_tra_15p' | 'thi_hoc_ky' | 'boi_duong_hsg' | 'yeu_thich';
export type StudySlot = 'sang' | 'trua' | 'chieu' | 'toi';
export type FoundationLevel = 'mat_goc' | 'co_ban' | 'kha' | 'tot';
export type AssessmentMode = 'existing_data' | 'quick_check' | 'full_mock' | 'skip';
export type GenerationMode = 'ai_bkt' | 'rule_basic';
export type PillarKey = 'KC1' | 'KC2' | 'KC3' | 'NV_NT';
export type RoadmapTaskKind = 'reading' | 'quiz' | 'flashcard' | 'wrong_review' | 'ai_tutor' | 'checkpoint';

export interface RoadmapWizardConfig {
  goalTier: GoalTier;
  durationMode: DurationMode;
  durationDays: number;
  examDateIso: string | null;
  purpose: StudyPurpose;
  dailyMinutes: number;
  weekendCustom: boolean;
  weekendMinutes: number;
  studySlots: StudySlot[];
  restDays: number[]; // 0 = CN, 1 = T2 ... 6 = T7
  selfRatings: Record<PillarKey, number>; // 1..5
  foundationLevel: FoundationLevel;
  includeIntro: boolean;
  concerns: string[];
  assessmentMode: AssessmentMode;
  generationMode: GenerationMode;
}

export interface RoadmapReadingGuide {
  title: string;
  categoryLabel: string;
  sgkRef: string;
  overview: string[];
  tactics: string[];
  commonMistakes: string[];
  keyQuestion: string;
}

export interface RoadmapDayTask {
  id: string;
  title: string;
  typeLabel: string;
  pillar: PillarKey;
  kind: RoadmapTaskKind;
  minutes: number;
  status: 'todo' | 'done' | 'skipped';
  pinned: boolean;
  reason: string;
  unitId?: string;
  topicType?: string;
  topicId?: number;
  nodeId?: number;
  guide?: RoadmapReadingGuide;
}

export interface RoadmapDayPlan {
  date: string; // YYYY-MM-DD
  dayIndex: number; // 1..N
  isRestDay: boolean;
  isCheckpointDay: boolean;
  targetMinutes: number;
  themeTitle: string;
  tasks: RoadmapDayTask[];
}

export interface PersonalizedRoadmapPlan {
  version: number;
  createdAt: string;
  updatedAt: string;
  config: RoadmapWizardConfig;
  pillarWeights: Record<PillarKey, number>; // tổng = 100 (%)
  strategySummary: string;
  lastAiChangeNotes: string[];
  days: RoadmapDayPlan[];
}

export const PILLAR_META: Record<PillarKey, { label: string; shortLabel: string; color: string; sgkSection: string }> = {
  KC1: {
    label: 'Kháng chiến lần 1 (1258)',
    shortLabel: 'KC lần 1',
    color: '#2563EB',
    sgkSection: 'SGK Lịch sử 7 - Bài 15, Mục 1',
  },
  KC2: {
    label: 'Kháng chiến lần 2 (1285)',
    shortLabel: 'KC lần 2',
    color: '#059669',
    sgkSection: 'SGK Lịch sử 7 - Bài 15, Mục 2',
  },
  KC3: {
    label: 'Kháng chiến lần 3 (1287–1288)',
    shortLabel: 'KC lần 3',
    color: '#D97706',
    sgkSection: 'SGK Lịch sử 7 - Bài 15, Mục 3',
  },
  NV_NT: {
    label: 'Nhân vật & Nghệ thuật Quân sự',
    shortLabel: 'Nhân vật & NTQS',
    color: '#7C3AED',
    sgkSection: 'SGK Lịch sử 7 - Bài 15, Mục 4',
  },
};

export const GOAL_TIER_META: Record<GoalTier, { badge: string; title: string; subtitle: string; targetScore: number }> = {
  foundation: { badge: 'Bậc 1', title: 'Nền tảng vững', subtitle: 'Từ 6.5 điểm (Nắm chắc mốc năm & sự kiện)', targetScore: 65 },
  exam_ready: { badge: 'Bậc 2', title: 'Bứt phá Điểm 8+', subtitle: 'Từ 8.0 điểm (Hiểu sâu diễn biến & nguyên nhân)', targetScore: 80 },
  mastery: { badge: 'Bậc 3', title: 'Thống lĩnh Đông A', subtitle: 'Từ 9.0 điểm (Vận dụng & liên hệ lịch sử)', targetScore: 90 },
};

const INTRO_GUIDES: Record<PillarKey, RoadmapReadingGuide> = {
  KC1: {
    title: 'Hướng dẫn ôn tập: Kháng chiến chống Mông Cổ lần 1 (1258)',
    categoryLabel: 'Mục 1 · Kháng chiến 1258',
    sgkRef: 'SGK Lịch sử 7 (KNTT) - Bài 15, tr. 54–55 & ĐVSKTT Quyển V',
    overview: [
      'Tháng 1/1258, 3 vạn kị binh Mông Cổ do Ngột Lương Hợp Thai chỉ huy tràn vào Đại Việt theo đường sông Thao.',
      'Vua Trần Thái Tông và Thái sư Trần Thủ Độ trực tiếp chỉ huy chặn giặc tại Bình Lệ Nguyên (Vĩnh Phúc), sau đó chủ động rút lui để bảo toàn lực lượng.',
      'Triều đình thực hiện kế sách “Vườn không nhà trống” tại Thăng Long khiến quân Mông Cổ rơi vào cảnh thiếu lương thảo trầm trọng sau chưa đầy nửa tháng.',
      'Ngày 29/1/1258, quân Trần mở cuộc phản công quyết định tại Đông Bộ Đầu (bến sông Hồng, Hà Nội), quét sạch quân xâm lược khỏi bờ cõi.',
    ],
    tactics: [
      'Ghi nhớ chuỗi 3 địa danh theo đúng trình tự thời gian: Bình Lệ Nguyên (chặn giặc) → Thăng Long (Vườn không nhà trống) → Đông Bộ Đầu (phản công thắng lợi).',
      'Nắm chắc câu nói lịch sử của Thái sư Trần Thủ Độ: “Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”.',
    ],
    commonMistakes: [
      'Hay nhầm tướng giặc lần 1 (Ngột Lương Hợp Thai) với tướng giặc lần 2 và 3 (Thoát Hoan, Ô Mã Nhi).',
      'Nhầm trận Đông Bộ Đầu (1258) với trận Chương Dương – Hàm Tử (1285).',
    ],
    keyQuestion: 'Vì sao việc quân nhà Trần rút khỏi Thăng Long năm 1258 không phải là thất bại mà là bước chuyển thế trận thông minh?',
  },
  KC2: {
    title: 'Hướng dẫn ôn tập: Kháng chiến chống quân Nguyên lần 2 (1285)',
    categoryLabel: 'Mục 2 · Kháng chiến 1285',
    sgkRef: 'SGK Lịch sử 7 (KNTT) - Bài 15, tr. 55–57 & ĐVSKTT Quyển V',
    overview: [
      'Trước nguy cơ 50 vạn quân Nguyên do Thoát Hoan cầm đầu kết hợp cánh quân Toa Đô từ phía Nam đánh lên, nhà Trần triệu tập Hội nghị Bình Than (1282) và Hội nghị Diên Hồng (đầu 1285).',
      'Quốc công Tiết chế Trần Quốc Tuấn soạn “Hịch tướng sĩ” khích lệ tinh thần “Sát Thát” toàn quân.',
      'Sau giai đoạn rút lui chiến lược và thực hiện “Vườn không nhà trống”, tháng 5–6/1285 quân Trần phản công vang dội tại Tây Kết, Hàm Tử, Chương Dương và giải phóng Thăng Long.',
      'Thoát Hoan phải chui vào ống đồng chạy về nước; Toa Đô bị tiêu diệt tại Tây Kết.',
    ],
    tactics: [
      'Phân biệt rõ mục đích 2 hội nghị: Bình Than (bàn kế sách quân sự cùng vương hầu) và Diên Hồng (hỏi ý các bô lão, khẳng định ý chí toàn dân đồng lòng hô “Đánh!”).',
      'Nhớ cặp chiến thắng phản công sông Hồng tháng 5–6/1285: Hàm Tử – Chương Dương – Tây Kết.',
    ],
    commonMistakes: [
      'Nhầm mốc năm Hội nghị Bình Than (1282) và Hội nghị Diên Hồng (1285).',
      'Quên mất gọng kìm phía Nam của tướng giặc Toa Đô từ Chăm-pa đánh ra Nghệ An – Thanh Hóa.',
    ],
    keyQuestion: 'Tinh thần đoàn kết của quân dân nhà Trần trước cuộc kháng chiến lần 2 (1285) được thể hiện qua những sự kiện tiêu biểu nào?',
  },
  KC3: {
    title: 'Hướng dẫn ôn tập: Kháng chiến lần 3 & Đại thắng Bạch Đằng (1287–1288)',
    categoryLabel: 'Mục 3 · Kháng chiến 1287–1288',
    sgkRef: 'SGK Lịch sử 7 (KNTT) - Bài 15, tr. 57–58 & ĐVSKTT Quyển V',
    overview: [
      'Cuối năm 1287, quân Nguyên xâm lược lần 3 kèm đoàn thuyền lương 70 vạn thạch của Trương Văn Hổ nhằm khắc phục điểm yếu thiếu lương ở 2 lần trước.',
      'Tháng 2/1288, Nhân Huệ vương Trần Khánh Dư phục kích tiêu diệt đoàn thuyền lương giặc tại Vân Đồn (Quảng Ninh), bẻ gãy hoàn toàn hậu cần của Thoát Hoan.',
      'Tháng 4/1288, Trần Quốc Tuấn bố trí trận địa cọc ngầm trên sông Bạch Đằng, lợi dụng thủy triều lên xuống nhử thủy quân Ô Mã Nhi vào bẫy, bắt sống Ô Mã Nhi và Phàn Tiếp.',
    ],
    tactics: [
      'Luôn liên kết cặp trận quyết định năm 1288: Vân Đồn (Trần Khánh Dư diệt thuyền lương) → Bạch Đằng (Trần Hưng Đạo diệt thủy quân Ô Mã Nhi).',
      'So sánh nét độc đáo của trận Bạch Đằng năm 1288 với chiến thắng Bạch Đằng năm 938 của Ngô Quyền.',
    ],
    commonMistakes: [
      'Nhầm người chỉ huy trận Vân Đồn (Trần Khánh Dư) với Trần Quang Khải (Chương Dương).',
      'Chỉ nêu diễn biến trận Bạch Đằng mà quên phân tích ý nghĩa chiến lược của chiến thắng Vân Đồn trước đó.',
    ],
    keyQuestion: 'Chiến thắng Vân Đồn và chiến thắng Bạch Đằng năm 1288 có mối quan hệ nhân quả như thế nào trong việc đánh bại quân Nguyên?',
  },
  NV_NT: {
    title: 'Chiến lược làm bài: Nhân vật, Nguyên nhân thắng lợi & Ý nghĩa lịch sử',
    categoryLabel: 'Mục 4 · Tổng kết & Vận dụng',
    sgkRef: 'SGK Lịch sử 7 (KNTT) - Bài 15, tr. 58–59',
    overview: [
      'Ba lần kháng chiến thắng lợi nhờ lòng yêu nước, khối đại đoàn kết toàn dân (vua tôi đồng lòng, anh em hòa thuận, cả nước góp sức).',
      'Đường lối chiến lược, chiến thuật đúng đắn, sáng tạo: “Lấy đoản binh thắng trường trận”, “Vườn không nhà trống”, tránh chỗ mạnh đánh chỗ yếu.',
      'Tài năng kiệt xuất của các vua Trần (Thái Tông, Thánh Tông, Nhân Tông) và các danh tướng: Trần Thủ Độ, Trần Quốc Tuấn, Trần Quang Khải, Trần Khánh Dư, Trần Bình Trọng, Trần Quốc Toản, Phạm Ngũ Lão, Yết Kiêu.',
    ],
    tactics: [
      'Khi gặp câu hỏi Vận dụng / Nguyên nhân thắng lợi, luôn chia câu trả lời thành 3 ý: (1) Tinh thần đoàn kết toàn dân, (2) Nghệ thuật quân sự sáng tạo, (3) Bộ chỉ huy tài giỏi.',
      'Ghép đúng mỗi nhân vật với câu nói và chiến công tiêu biểu (Trần Thủ Độ - 1258, Trần Quốc Toản - Bình Than, Trần Bình Trọng - 1285, Trần Hưng Đạo - Hịch tướng sĩ & Bạch Đằng).',
    ],
    commonMistakes: [
      'Trả lời thiếu ý nghĩa quốc tế: bảo vệ độc lập Đại Việt đồng thời chặn đứng làn sóng xâm lược của đế quốc Mông - Nguyên xuống Đông Nam Á.',
    ],
    keyQuestion: 'Bài học lớn nhất từ ba lần kháng chiến chống quân Mông - Nguyên đối với sự nghiệp bảo vệ Tổ quốc hiện nay là gì?',
  },
};

export function createDefaultWizardConfig(bktData?: BktRecommendationsResponse | null): RoadmapWizardConfig {
  const summary = bktData?.profile_summary;
  const upcoming = summary?.upcoming_assignment;
  const defaultDays = upcoming && upcoming.days_left >= 3 && upcoming.days_left <= 60 ? upcoming.days_left : 14;
  return {
    goalTier: 'exam_ready',
    durationMode: upcoming ? 'exam_date' : 'days',
    durationDays: defaultDays,
    examDateIso: upcoming?.due_at ? upcoming.due_at.slice(0, 10) : null,
    purpose: upcoming ? 'kiem_tra_15p' : 'thi_hoc_ky',
    dailyMinutes: summary?.daily_goal && summary.daily_goal >= 15 ? Math.min(90, Math.max(15, summary.daily_goal)) : 30,
    weekendCustom: false,
    weekendMinutes: 45,
    studySlots: ['toi'],
    restDays: [0], // Chủ nhật mặc định
    selfRatings: {
      KC1: 4,
      KC2: 3,
      KC3: 3,
      NV_NT: 3,
    },
    foundationLevel: summary?.has_activity ? 'kha' : 'co_ban',
    includeIntro: true,
    concerns: ['nho_moc_nam', 'kho_hoc_deu'],
    assessmentMode: summary?.has_activity ? 'existing_data' : 'quick_check',
    generationMode: 'ai_bkt',
  };
}

function classifyUnitPillar(rec: Pick<BktRecommendationItem, 'unit_id' | 'topic'>): PillarKey {
  const uid = (rec.unit_id || '').toUpperCase();
  const topic = (rec.topic || '').toLowerCase();
  if (uid.startsWith('KC1') || topic.includes('1258') || topic.includes('lần 1') || topic.includes('bình lệ nguyên') || topic.includes('đông bộ đầu')) {
    return 'KC1';
  }
  if (uid.startsWith('KC2') || topic.includes('1285') || topic.includes('lần 2') || topic.includes('hàm tử') || topic.includes('chương dương') || topic.includes('thoát hoan')) {
    return 'KC2';
  }
  if (uid.startsWith('KC3') || topic.includes('1288') || topic.includes('1287') || topic.includes('lần 3') || topic.includes('bạch đằng') || topic.includes('vân đồn')) {
    return 'KC3';
  }
  return 'NV_NT';
}

export function computePillarWeights(
  config: RoadmapWizardConfig,
  bktData?: BktRecommendationsResponse | null,
): Record<PillarKey, number> {
  const gaps: Record<PillarKey, number> = { KC1: 1, KC2: 1, KC3: 1, NV_NT: 1 };
  const pillars: PillarKey[] = ['KC1', 'KC2', 'KC3', 'NV_NT'];

  // 1. Từ tự đánh giá của học sinh (1..5 -> độ hổng 5..1)
  for (const p of pillars) {
    const rating = Math.min(5, Math.max(1, config.selfRatings[p] ?? 3));
    gaps[p] = 6 - rating;
  }

  // 2. Nếu có dữ liệu BKT hoặc tạo bằng AI/BKT -> cộng trọng số cho mảng có P(L) thấp
  const recs = bktData?.recommendations ?? [];
  if (config.generationMode === 'ai_bkt' && recs.length > 0) {
    for (const r of recs) {
      const p = classifyUnitPillar(r);
      const mastery = r.current_mastery ?? r.current_p_l ?? 0.35;
      gaps[p] += Math.max(0.4, (1 - mastery) * 2.5) + (r.due_urgent ? 1.2 : 0);
    }
  }

  const totalGap = pillars.reduce((acc, p) => acc + gaps[p], 0) || 4;
  const raw: Record<PillarKey, number> = {
    KC1: Math.max(12, Math.round((gaps.KC1 / totalGap) * 100)),
    KC2: Math.max(12, Math.round((gaps.KC2 / totalGap) * 100)),
    KC3: Math.max(12, Math.round((gaps.KC3 / totalGap) * 100)),
    NV_NT: Math.max(12, Math.round((gaps.NV_NT / totalGap) * 100)),
  };
  const diff = 100 - (raw.KC1 + raw.KC2 + raw.KC3 + raw.NV_NT);
  // Cộng phần dư vào mảng có độ ưu tiên cao nhất
  const topPillar = [...pillars].sort((a, b) => gaps[b] - gaps[a])[0];
  raw[topPillar] += diff;
  return raw;
}

function addDaysIso(baseDate: Date, offsetDays: number): string {
  const d = new Date(baseDate.getTime() + offsetDays * 86_400_000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function generatePersonalizedRoadmap(
  config: RoadmapWizardConfig,
  bktData?: BktRecommendationsResponse | null,
  nowDate: Date = new Date(),
): PersonalizedRoadmapPlan {
  const weights = computePillarWeights(config, bktData);
  const pillarsByPriority = (['KC1', 'KC2', 'KC3', 'NV_NT'] as PillarKey[]).sort((a, b) => weights[b] - weights[a]);
  const recs = bktData?.recommendations ?? [];
  const totalDays = Math.min(90, Math.max(3, config.durationDays || 14));
  const introActiveDays = config.includeIntro ? Math.max(1, Math.min(4, Math.ceil(totalDays * 0.28))) : 0;

  const days: RoadmapDayPlan[] = [];
  let activeStudyIndex = 0;

  for (let i = 0; i < totalDays; i += 1) {
    const dateStr = addDaysIso(nowDate, i);
    const weekday = new Date(`${dateStr}T00:00:00`).getDay();
    const isLastDay = i === totalDays - 1;
    const isRestDay = !isLastDay && config.restDays.includes(weekday) && totalDays > 4;
    const isWeekend = weekday === 0 || weekday === 6;
    const dayBudget = isRestDay
      ? 0
      : config.weekendCustom && isWeekend
        ? config.weekendMinutes
        : config.dailyMinutes;

    if (isRestDay) {
      days.push({
        date: dateStr,
        dayIndex: i + 1,
        isRestDay: true,
        isCheckpointDay: false,
        targetMinutes: 0,
        themeTitle: 'Ngày nghỉ ngơi & phục hồi trí nhớ',
        tasks: [],
      });
      continue;
    }

    const focusPillar = pillarsByPriority[activeStudyIndex % pillarsByPriority.length];
    const pMeta = PILLAR_META[focusPillar];
    const isCheckpointDay = !isLastDay && activeStudyIndex > 0 && (activeStudyIndex + 1) % 5 === 0;
    const tasks: RoadmapDayTask[] = [];
    let usedMinutes = 0;

    // 1. Nhiệm vụ khởi động Flashcard (5-10 phút) giúp chống suy giảm trí nhớ Ebbinghaus
    const fcMins = dayBudget >= 45 ? 10 : 5;
    tasks.push({
      id: `d${i + 1}-fc`,
      title: `Ôn thẻ nhớ Sử liệu đến hạn (${pMeta.shortLabel})`,
      typeLabel: `Ôn thẻ nhớ (${fcMins} phút)`,
      pillar: focusPillar,
      kind: 'flashcard',
      minutes: fcMins,
      status: 'todo',
      pinned: false,
      reason: `Duy trì trí nhớ dài hạn theo đường cong Ebbinghaus cho mảng ${pMeta.label}.`,
    });
    usedMinutes += fcMins;

    // 2. Những ngày đầu: Học kỹ thuật & Hướng dẫn ôn SGK trước khi luyện đề (như VSTEP Owl)
    if (activeStudyIndex < introActiveDays) {
      const guide = INTRO_GUIDES[focusPillar];
      const readMins = Math.min(15, Math.max(8, Math.floor(dayBudget * 0.4)));
      tasks.push({
        id: `d${i + 1}-guide-${focusPillar}`,
        title: guide.title,
        typeLabel: `Tài liệu (${readMins} phút)`,
        pillar: focusPillar,
        kind: 'reading',
        minutes: readMins,
        status: 'todo',
        pinned: false,
        reason: `Bật chế độ “Tìm hiểu kiến thức trọng tâm trước khi luyện”: nắm chắc cấu trúc bài & bẫy hay sai của ${pMeta.shortLabel}.`,
        guide,
      });
      usedMinutes += readMins;
    }

    // 3. Nhiệm vụ chính từ BKT hoặc kiểm tra giữa chặng
    const remaining = Math.max(10, dayBudget - usedMinutes);
    const matchedRec = recs.find((r) => classifyUnitPillar(r) === focusPillar) ?? recs[activeStudyIndex % Math.max(1, recs.length)];

    if (isLastDay) {
      tasks.push({
        id: `d${i + 1}-final-review`,
        title: 'Tổng duyệt kiến thức & Luyện đề tổng hợp trước ngày kiểm tra',
        typeLabel: `Đề tổng hợp (${remaining} phút)`,
        pillar: pillarsByPriority[0],
        kind: 'checkpoint',
        minutes: remaining,
        status: 'todo',
        pinned: true,
        reason: 'Ngày học cuối của lộ trình: ôn nhẹ các mốc năm cốt lõi và rà soát toàn bộ 3 cuộc kháng chiến.',
      });
    } else if (isCheckpointDay) {
      tasks.push({
        id: `d${i + 1}-checkpoint`,
        title: `Kiểm tra giữa chặng (Đo tiến bộ 4 mảng Đông A)`,
        typeLabel: `Kiểm tra định kỳ (${remaining} phút)`,
        pillar: focusPillar,
        kind: 'checkpoint',
        minutes: remaining,
        status: 'todo',
        pinned: true,
        reason: 'Buổi kiểm tra giữa chặng giúp hệ thống BKT đo lại độ chính xác thực tế và tự điều chỉnh những ngày tiếp theo.',
        topicType: matchedRec?.topic_type,
        topicId: matchedRec?.topic_id,
      });
    } else if (matchedRec) {
      const quizMins = Math.max(10, Math.min(20, remaining));
      const masteryPct = Math.round((matchedRec.current_mastery ?? matchedRec.current_p_l ?? 0.3) * 100);
      tasks.push({
        id: `d${i + 1}-bkt-${matchedRec.unit_id}`,
        title: matchedRec.topic,
        typeLabel: `Luyện chuyên đề (${quizMins} phút)`,
        pillar: focusPillar,
        kind: matchedRec.action_kind === 'practice_wrong' ? 'wrong_review' : 'quiz',
        minutes: quizMins,
        status: 'todo',
        pinned: false,
        reason: matchedRec.reason || `Mức nắm vững BKT hiện tại ${masteryPct}% — ưu tiên luyện để đạt mục tiêu ${GOAL_TIER_META[config.goalTier].title}.`,
        unitId: matchedRec.unit_id,
        topicType: matchedRec.topic_type,
        topicId: matchedRec.topic_id,
        nodeId: matchedRec.node_id,
      });
      usedMinutes += quizMins;

      if (dayBudget - usedMinutes >= 8) {
        const tutorMins = dayBudget - usedMinutes;
        tasks.push({
          id: `d${i + 1}-tutor-${focusPillar}`,
          title: `Đàm đạo cùng Thầy Đông A: Giải đáp sâu về ${pMeta.shortLabel}`,
          typeLabel: `Hỏi đáp AI (${tutorMins} phút)`,
          pillar: focusPillar,
          kind: 'ai_tutor',
          minutes: tutorMins,
          status: 'todo',
          pinned: false,
          reason: `Củng cố câu hỏi vận dụng “Vì sao / Ý nghĩa” cho mảng ${pMeta.label} (${weights[focusPillar]}% thời lượng lộ trình).`,
        });
      }
    } else {
      tasks.push({
        id: `d${i + 1}-practice-${focusPillar}`,
        title: `Luyện tập trọng tâm: ${pMeta.label}`,
        typeLabel: `Bài luyện (${remaining} phút)`,
        pillar: focusPillar,
        kind: 'quiz',
        minutes: remaining,
        status: 'todo',
        pinned: false,
        reason: `Phân bổ ${weights[focusPillar]}% quỹ bài luyện cho ${pMeta.label} dựa trên đánh giá năng lực của em.`,
        guide: INTRO_GUIDES[focusPillar],
      });
    }

    const themeTitle = isLastDay
      ? 'Tổng ôn nhẹ & Hệ thống hóa trước kỳ thi'
      : isCheckpointDay
        ? `Kiểm tra giữa chặng & Củng cố ${pMeta.shortLabel}`
        : activeStudyIndex < introActiveDays
          ? `Tìm hiểu trọng tâm SGK: ${pMeta.label} & Chiến thuật làm bài`
          : `Luyện chuyên sâu: ${pMeta.label}`;

    days.push({
      date: dateStr,
      dayIndex: i + 1,
      isRestDay: false,
      isCheckpointDay,
      targetMinutes: dayBudget,
      themeTitle,
      tasks,
    });
    activeStudyIndex += 1;
  }

  const topP1 = PILLAR_META[pillarsByPriority[0]].shortLabel;
  const topP2 = PILLAR_META[pillarsByPriority[1]].shortLabel;
  const goalMeta = GOAL_TIER_META[config.goalTier];
  const strategySummary =
    `Lộ trình ${totalDays} ngày hướng tới ${goalMeta.title} (${goalMeta.badge}), dành nhiều thời lượng hơn cho ${topP1} (${weights[pillarsByPriority[0]]}%) và ${topP2} (${weights[pillarsByPriority[1]]}%). ` +
    (config.includeIntro
      ? 'Những ngày đầu mở đầu bằng tài liệu hướng dẫn SGK & chiến thuật tránh bẫy trắc nghiệm. '
      : '') +
    'Duy trì ôn thẻ nhớ xen kẽ mỗi ngày và kiểm tra giữa chặng định kỳ.';

  return {
    version: 1,
    createdAt: nowDate.toISOString(),
    updatedAt: nowDate.toISOString(),
    config,
    pillarWeights: weights,
    strategySummary,
    lastAiChangeNotes: [],
    days,
  };
}

export function getRoadmapStats(plan: PersonalizedRoadmapPlan) {
  let totalTasks = 0;
  let doneTasks = 0;
  for (const d of plan.days) {
    for (const t of d.tasks) {
      if (t.status === 'skipped') continue;
      totalTasks += 1;
      if (t.status === 'done') doneTasks += 1;
    }
  }
  const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  return { totalTasks, doneTasks, percent, totalDays: plan.days.length };
}

export function toggleRoadmapTaskDone(plan: PersonalizedRoadmapPlan, date: string, taskId: string): PersonalizedRoadmapPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d) =>
      d.date !== date
        ? d
        : {
            ...d,
            tasks: d.tasks.map((t) =>
              t.id !== taskId ? t : { ...t, status: t.status === 'done' ? 'todo' : 'done' },
            ),
          },
    ),
  };
}

export function toggleRoadmapTaskPin(plan: PersonalizedRoadmapPlan, date: string, taskId: string): PersonalizedRoadmapPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d) =>
      d.date !== date
        ? d
        : {
            ...d,
            tasks: d.tasks.map((t) => (t.id !== taskId ? t : { ...t, pinned: !t.pinned })),
          },
    ),
  };
}

export function moveRoadmapTaskOrder(
  plan: PersonalizedRoadmapPlan,
  date: string,
  taskId: string,
  direction: -1 | 1,
): PersonalizedRoadmapPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d) => {
      if (d.date !== date) return d;
      const idx = d.tasks.findIndex((t) => t.id === taskId);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= d.tasks.length) return d;
      const copy = [...d.tasks];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return { ...d, tasks: copy };
    }),
  };
}

export function removeOrSkipRoadmapTask(
  plan: PersonalizedRoadmapPlan,
  date: string,
  taskId: string,
  action: 'skip' | 'delete',
): PersonalizedRoadmapPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d) => {
      if (d.date !== date) return d;
      return {
        ...d,
        tasks:
          action === 'delete'
            ? d.tasks.filter((t) => t.id !== taskId)
            : d.tasks.map((t) => (t.id !== taskId ? t : { ...t, status: 'skipped' })),
      };
    }),
  };
}

export function moveRoadmapTaskToNextDay(
  plan: PersonalizedRoadmapPlan,
  fromDate: string,
  taskId: string,
): PersonalizedRoadmapPlan {
  const dayIdx = plan.days.findIndex((d) => d.date === fromDate);
  if (dayIdx < 0) return plan;
  const task = plan.days[dayIdx].tasks.find((t) => t.id === taskId);
  if (!task) return plan;
  const targetDayIdx = plan.days.findIndex((d, idx) => idx > dayIdx && !d.isRestDay);
  if (targetDayIdx < 0) return plan;

  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d, idx) => {
      if (idx === dayIdx) return { ...d, tasks: d.tasks.filter((t) => t.id !== taskId) };
      if (idx === targetDayIdx) return { ...d, tasks: [...d.tasks, { ...task, pinned: true }] };
      return d;
    }),
  };
}

export function addCustomRoadmapTask(
  plan: PersonalizedRoadmapPlan,
  date: string,
  input: { title: string; pillar: PillarKey; minutes: number; kind?: RoadmapTaskKind },
): PersonalizedRoadmapPlan {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return plan;
  const mins = Math.max(5, Math.min(90, Number(input.minutes) || 15));
  const kind = input.kind ?? 'quiz';
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    days: plan.days.map((d) =>
      d.date !== date
        ? d
        : {
            ...d,
            tasks: [
              ...d.tasks,
              {
                id: `custom-${Date.now()}`,
                title: cleanTitle,
                typeLabel: `Tự thêm (${mins} phút)`,
                pillar: input.pillar,
                kind,
                minutes: mins,
                status: 'todo',
                pinned: true,
                reason: 'Nhiệm vụ do em tự thêm và ghim cố định vào lịch học.',
                guide: INTRO_GUIDES[input.pillar],
              },
            ],
          },
    ),
  };
}

/**
 * Cập nhật lộ trình bằng AI & BKT:
 * Giữ nguyên nhiệm vụ đã xong (done) và nhiệm vụ đã ghim (pinned),
 * cập nhật tỷ lệ phân bổ luyện tập và thay thế nhiệm vụ chưa làm theo điểm yếu BKT mới nhất.
 */
export function rebalanceRoadmapWithAiBkt(
  plan: PersonalizedRoadmapPlan,
  bktData?: BktRecommendationsResponse | null,
): PersonalizedRoadmapPlan {
  const nextConfig: RoadmapWizardConfig = { ...plan.config, generationMode: 'ai_bkt' };
  const newWeights = computePillarWeights(nextConfig, bktData);
  const recs = bktData?.recommendations ?? [];
  const notes: string[] = [];

  for (const p of ['KC1', 'KC2', 'KC3', 'NV_NT'] as PillarKey[]) {
    const delta = newWeights[p] - (plan.pillarWeights[p] ?? 25);
    if (Math.abs(delta) >= 3) {
      notes.push(
        `${delta > 0 ? 'Tăng' : 'Giảm'} phân bổ ${PILLAR_META[p].shortLabel} (${plan.pillarWeights[p]}% → ${newWeights[p]}%) theo kết quả làm bài mới nhất.`,
      );
    }
  }
  if (recs[0]) {
    notes.push(`Ưu tiên bổ sung chủ điểm cần củng cố: “${recs[0].topic}”.`);
  }
  if (!notes.length) {
    notes.push('Đã đồng bộ điểm BKT mới nhất; giữ nguyên các nhiệm vụ đã hoàn thành và đã ghim.');
  }

  let recCursor = 0;
  const updatedDays = plan.days.map((d, dIdx) => {
    if (d.isRestDay || dIdx === 0) {
      // Giữ nguyên ngày đầu/hôm nay cho các việc đã xong hoặc ghim, nhưng cập nhật bài quiz chưa làm nếu có BKT mới
      return {
        ...d,
        tasks: d.tasks.map((t) => {
          if (t.status === 'done' || t.pinned || t.kind !== 'quiz' || !recs.length) return t;
          const r = recs[recCursor % recs.length];
          recCursor += 1;
          return {
            ...t,
            title: r.topic,
            pillar: classifyUnitPillar(r),
            reason: r.reason || `Cập nhật AI/BKT: ưu tiên củng cố chủ điểm (${Math.round((r.current_mastery ?? 0.35) * 100)}%).`,
            unitId: r.unit_id,
            topicType: r.topic_type,
            topicId: r.topic_id,
          };
        }),
      };
    }
    return {
      ...d,
      tasks: d.tasks.map((t) => {
        if (t.status === 'done' || t.pinned || t.kind !== 'quiz' || !recs.length) return t;
        const r = recs[recCursor % recs.length];
        recCursor += 1;
        return {
          ...t,
          title: r.topic,
          pillar: classifyUnitPillar(r),
          reason: r.reason || `Cập nhật AI/BKT: ưu tiên củng cố chủ điểm (${Math.round((r.current_mastery ?? 0.35) * 100)}%).`,
          unitId: r.unit_id,
          topicType: r.topic_type,
          topicId: r.topic_id,
        };
      }),
    };
  });

  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    config: nextConfig,
    pillarWeights: newWeights,
    lastAiChangeNotes: notes,
    days: updatedDays,
  };
}
