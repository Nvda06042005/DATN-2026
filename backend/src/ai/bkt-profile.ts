/**
 * Chuyển đổi & đồng bộ hồ sơ học tập thực tế từ PostgreSQL (StudentAiProfile) sang mô hình BKT 4 tham số + Ebbinghaus.
 * Dùng cho cả fallback thuần Node (khi Python bridge không chạy / môi trường cloud) và làm giàu kết quả từ Python BKT.
 */
import type { StudentAiProfile } from '../analytics/analytics.service';
import type { TopicRow, TopicType } from '../analytics/topics';

export const BKT_DEFAULTS = {
  p_l0: 0.3,
  p_t: 0.15,
  p_g: 0.25,
  p_s: 0.1,
  mastery_threshold: 0.6,
} as const;

const FORGET_LAMBDA = 0.04;

export interface BktRecommendationPayload {
  unit_id: string;
  topic: string;
  category?: string;
  current_p_l: number;
  current_mastery: number;
  cognitive_level: 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG';
  difficulty: number;
  attempts: number;
  reason: string;
  suggested_action: string;
  action_kind: 'practice_topic' | 'practice_wrong' | 'journey_node' | 'tutor';
  topic_type?: TopicType;
  topic_id?: number;
  node_id?: number;
  sgk_reference: string;
  study_method: string;
  key_takeaways: string[];
  due_urgent?: boolean;
}

export interface ProfileSummaryForAi {
  has_activity: boolean;
  data_source: 'python_bkt+db' | 'node_bkt+db';
  grade: number | null;
  accuracy: number | null;
  answered: number;
  streak_current: number;
  daily_goal: number;
  days_idle: number | null;
  weak_topics_count: number;
  wrong_questions_count: number;
  next_node: { node_id: number; title: string; kind: string } | null;
  upcoming_assignment: { title: string; days_left: number; due_at: string } | null;
}

interface SgkHint {
  unit_id: string;
  keywords: string[];
  sgk_reference: string;
  cognitive_level: 'NHAN_BIET' | 'THONG_HIEU' | 'VAN_DUNG';
  study_method: string;
}

const SGK_HINTS: SgkHint[] = [
  {
    unit_id: 'KC1_OVERVIEW',
    keywords: ['lan 1', '1258', 'binh le nguyen', 'dong bo dau', 'tran thai tong', 'tran thu do', 'vuon khong nha trong'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 1: Kháng chiến lần 1 (1258)',
    cognitive_level: 'NHAN_BIET',
    study_method: 'Lập sơ đồ 3 mốc: Bình Lệ Nguyên → Vườn không nhà trống → Đông Bộ Đầu (1258).',
  },
  {
    unit_id: 'TQT_WHY_ORANGE',
    keywords: ['tran quoc toan', 'binh than', 'qua cam', 'sau chu vang', '1282'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 2: Chuẩn bị kháng chiến lần 2 (1282–1284)',
    cognitive_level: 'THONG_HIEU',
    study_method: 'Gắn câu chuyện lịch sử (Hội nghị Bình Than, bóp nát quả cam) với tinh thần quyết chiến.',
  },
  {
    unit_id: 'DIEN_HONG_CONFERENCE',
    keywords: ['dien hong', 'hich tuong si', 'sat that', 'tran hung dao', 'tran quoc tuan', '1284'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 2: Hội nghị Diên Hồng & Hịch tướng sĩ',
    cognitive_level: 'VAN_DUNG',
    study_method: 'Phân tích mối liên hệ giữa ý chí đoàn kết triều đình – bô lão – tướng sĩ.',
  },
  {
    unit_id: 'KC2_HAM_TU_CHUONG_DUONG',
    keywords: ['lan 2', '1285', 'ham tu', 'chuong duong', 'tay ket', 'thoat hoan', 'tran binh trong', 'van kiep', 'thang long'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 2: Kháng chiến chống quân Nguyên lần 2 (1285)',
    cognitive_level: 'THONG_HIEU',
    study_method: 'Đối chiếu hướng rút lui chiến lược và loạt trận phản công Hàm Tử – Chương Dương.',
  },
  {
    unit_id: 'KC3_VAN_DON',
    keywords: ['van don', 'tran khanh du', 'truong van ho', 'thuyen luong'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 3: Trận Vân Đồn (1288)',
    cognitive_level: 'THONG_HIEU',
    study_method: 'Hiểu chiến thuật đánh cắt nguồn hậu cần: diệt đoàn thuyền lương Trương Văn Hổ.',
  },
  {
    unit_id: 'KC3_BACH_DANG_HOW',
    keywords: ['lan 3', '1287', '1288', 'bach dang', 'o ma nhi', 'coc go', 'thuy trieu', 'ngo quyen'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 3: Đại thắng Bạch Đằng (1288)',
    cognitive_level: 'VAN_DUNG',
    study_method: 'Vẽ lại sơ đồ thủy triều sông Bạch Đằng và cách nhử quân Ô Mã Nhi vào bãi cọc.',
  },
  {
    unit_id: 'CAUSES_OF_VICTORY',
    keywords: ['nguyen nhan', 'y nghia', 'nghe thuat', 'hao khi', 'dong a', 'ngu binh u nong', 'nha tran'],
    sgk_reference: 'SGK Lịch sử 7 (KNTT) - Bài 15, Mục 4: Nguyên nhân thắng lợi & Ý nghĩa lịch sử',
    cognitive_level: 'VAN_DUNG',
    study_method: 'Tổng hợp 3 nhóm nguyên nhân: Vua tôi đồng lòng, toàn dân đánh giặc, đường lối đúng đắn.',
  },
];

export function stripVn(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function matchSgkHint(name: string): SgkHint {
  const norm = stripVn(name);
  let best = SGK_HINTS[SGK_HINTS.length - 1];
  let bestHits = 0;
  for (const h of SGK_HINTS) {
    const hits = h.keywords.filter((kw) => norm.includes(kw)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = h;
    }
  }
  return best;
}

/** Cập nhật P(L) tuần tự từ số lần trả lời đúng/sai + suy giảm trí nhớ Ebbinghaus theo last_at */
export function estimateTopicMastery(topic: Pick<TopicRow, 'answered' | 'correct' | 'last_at'>): number {
  const answered = Math.max(0, topic.answered);
  const correct = Math.min(answered, Math.max(0, topic.correct));
  const wrong = answered - correct;
  let pL: number = BKT_DEFAULTS.p_l0;
  const step = (isCorrect: boolean) => {
    const num = isCorrect ? pL * (1 - BKT_DEFAULTS.p_s) : pL * BKT_DEFAULTS.p_s;
    const den = isCorrect
      ? num + (1 - pL) * BKT_DEFAULTS.p_g
      : num + (1 - pL) * (1 - BKT_DEFAULTS.p_g);
    const posterior = den > 0 ? num / den : pL;
    pL = Math.min(0.98, Math.max(0.05, posterior + (1 - posterior) * BKT_DEFAULTS.p_t));
  };
  // Phân bổ đều lượt đúng/sai (tránh dồn hết lượt đúng về cuối làm lệch P(L) quá cao)
  const wTotal = Math.min(wrong, 10);
  const cTotal = Math.min(correct, 10);
  const total = wTotal + cTotal;
  let wUsed = 0;
  let cUsed = 0;
  for (let i = 1; i <= total; i += 1) {
    const targetC = Math.round((i * cTotal) / total);
    if (cUsed < targetC && cUsed < cTotal) {
      step(true);
      cUsed += 1;
    } else if (wUsed < wTotal) {
      step(false);
      wUsed += 1;
    } else {
      step(true);
      cUsed += 1;
    }
  }

  if (topic.last_at) {
    const days = Math.max(0, (Date.now() - new Date(topic.last_at).getTime()) / 86_400_000);
    if (days > 0.25) {
      pL = Math.max(0.15, pL * Math.exp(-FORGET_LAMBDA * Math.min(days, 60)));
    }
  }
  return Math.round(pL * 10000) / 10000;
}

function findMatchingDbTopic(topics: TopicRow[], label: string): TopicRow | undefined {
  const norm = stripVn(label);
  if (!norm) return undefined;
  const tokens = norm.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  let best: TopicRow | undefined;
  let bestScore = 0;
  for (const t of topics) {
    const tNorm = stripVn(t.name);
    if (tNorm === norm) return t;
    let score = 0;
    for (const tok of tokens) {
      if (tNorm.includes(tok)) score += 1;
    }
    if (tNorm.includes(norm) || norm.includes(tNorm)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 2 ? best : undefined;
}

export function buildProfileSummary(
  profile: StudentAiProfile,
  source: 'python_bkt+db' | 'node_bkt+db',
): ProfileSummaryForAi {
  const next = profile.current_journey.next_node;
  const assign = profile.upcoming_assignments[0] ?? null;
  return {
    has_activity: profile.has_activity,
    data_source: source,
    grade: profile.student.grade,
    accuracy: profile.stats.accuracy,
    answered: profile.stats.answered,
    streak_current: profile.stats.streak_current,
    daily_goal: profile.stats.daily_goal,
    days_idle: profile.stats.days_idle,
    weak_topics_count: profile.topics.weak.length,
    wrong_questions_count: profile.recent_wrong_questions.length,
    next_node: next ? { node_id: next.node_id, title: next.title, kind: next.kind } : null,
    upcoming_assignment: assign
      ? { title: assign.title, days_left: assign.days_left, due_at: assign.due_at }
      : null,
  };
}

/** Trích xuất gợi ý hành động & liên kết chủ đề DB cho danh sách đề xuất từ Python BKT */
export function enrichBktResponse(
  raw: Record<string, any>,
  profile: StudentAiProfile,
  source: 'python_bkt+db' | 'node_bkt+db',
) {
  const allTopics = profile.topics.all;
  const urgentTopicKeys = new Set<string>();
  for (const ex of profile.upcoming_assignments) {
    for (const wt of ex.weak_topics) urgentTopicKeys.add(`${wt.type}:${wt.id}`);
  }

  const recs: BktRecommendationPayload[] = Array.isArray(raw.recommendations)
    ? raw.recommendations.map((item: Record<string, any>) => {
        const matched = item.topic_type && item.topic_id
          ? allTopics.find((t) => t.type === item.topic_type && t.id === item.topic_id)
          : findMatchingDbTopic(allTopics, String(item.topic ?? ''));
        const actionKind: BktRecommendationPayload['action_kind'] = item.action_kind
          ?? (matched ? 'practice_topic' : profile.recent_wrong_questions.length > 0 ? 'practice_wrong' : 'tutor');
        const dueUrgent = Boolean(item.due_urgent) || (matched ? urgentTopicKeys.has(`${matched.type}:${matched.id}`) : false);

        return {
          ...(item as BktRecommendationPayload),
          action_kind: actionKind,
          topic_type: item.topic_type ?? matched?.type,
          topic_id: item.topic_id ?? matched?.id,
          due_urgent: dueUrgent,
        };
      })
    : [];

  return {
    ...raw,
    recommendations: recs,
    total_recommendations: recs.length,
    profile_summary: buildProfileSummary(profile, source),
  };
}

/** Tính lộ trình BKT 4 tham số trực tiếp từ dữ liệu DB của học sinh (không dùng profile mẫu giả lập) */
export function buildNodeBktRecommendations(
  studentId: string,
  profile: StudentAiProfile,
  topK = 6,
) {
  const limit = Math.max(1, Math.min(10, topK));
  const recs: BktRecommendationPayload[] = [];
  const urgentKeys = new Set<string>();
  for (const ex of profile.upcoming_assignments) {
    for (const wt of ex.weak_topics) urgentKeys.add(`${wt.type}:${wt.id}`);
  }

  // 1. Ưu tiên chủ đề yếu & chủ đề cần ôn từ kết quả làm bài thật trong DB
  const scoredTopics = profile.topics.all
    .filter((t) => t.answered > 0)
    .map((t) => {
      const pL = estimateTopicMastery(t);
      const urgent = urgentKeys.has(`${t.type}:${t.id}`);
      const score = pL - (urgent ? 0.15 : 0);
      return { topic: t, pL, urgent, score };
    })
    .sort((a, b) => a.score - b.score);

  for (const entry of scoredTopics) {
    if (recs.length >= limit) break;
    if (entry.pL >= 0.78 && recs.length >= 2) continue;
    const hint = matchSgkHint(entry.topic.name);
    const pct = entry.topic.percent;
    const daysIdle = entry.topic.last_at
      ? Math.floor((Date.now() - new Date(entry.topic.last_at).getTime()) / 86_400_000)
      : null;
    const reasonParts = [
      `Độ chính xác ${pct}% (${entry.topic.correct}/${entry.topic.answered} câu), ước lượng BKT ${Math.round(entry.pL * 100)}%`,
    ];
    if (entry.urgent) reasonParts.push('Liên quan bài kiểm tra sắp tới');
    if (daysIdle !== null && daysIdle >= 5) reasonParts.push(`Chưa ôn lại ${daysIdle} ngày (suy giảm trí nhớ)`);

    recs.push({
      unit_id: `DB_${entry.topic.type.toUpperCase()}_${entry.topic.id}`,
      topic: entry.topic.name,
      current_p_l: entry.pL,
      current_mastery: entry.pL,
      cognitive_level: hint.cognitive_level,
      difficulty: entry.pL < 0.45 ? 0.4 : 0.6,
      attempts: entry.topic.answered,
      reason: reasonParts.join(' • '),
      suggested_action: entry.urgent ? 'Ưu tiên luyện chủ đề sắp thi' : 'Luyện tập 6–8 câu trọng tâm',
      action_kind: 'practice_topic',
      topic_type: entry.topic.type,
      topic_id: entry.topic.id,
      sgk_reference: hint.sgk_reference,
      study_method: hint.study_method,
      key_takeaways: [entry.topic.name, `Đã làm ${entry.topic.answered} câu`, `${pct}% chính xác`],
      due_urgent: entry.urgent,
    });
  }

  // 2. Nếu có câu sai chưa gỡ → thêm thẻ "Luyện lại câu sai"
  if (recs.length < limit && profile.recent_wrong_questions.length > 0) {
    const topWrong = profile.recent_wrong_questions[0];
    recs.unshift({
      unit_id: `DB_WRONG_${topWrong.question_id}`,
      topic: `Ôn tập ${profile.recent_wrong_questions.length} câu làm sai gần đây`,
      current_p_l: 0.32,
      current_mastery: 0.32,
      cognitive_level: 'THONG_HIEU',
      difficulty: 0.5,
      attempts: topWrong.wrong_count,
      reason: `Còn ${profile.recent_wrong_questions.length} câu sai chưa gỡ (sai gần nhất: “${topWrong.prompt.slice(0, 65)}…”)`,
      suggested_action: 'Làm lại ngân hàng câu sai để gỡ lỗi',
      action_kind: 'practice_wrong',
      sgk_reference: topWrong.campaign_title || 'SGK Lịch sử 7 - Bài 15',
      study_method: 'Làm lại từng câu sai và nhờ Thầy Đông A giải thích phần chưa nhớ.',
      key_takeaways: [`${profile.recent_wrong_questions.length} câu cần gỡ`, topWrong.campaign_title || 'Kháng chiến thời Trần'],
      due_urgent: true,
    });
  }

  // 3. Nếu học sinh chưa có bài làm hoặc còn slot → gợi ý nút học tiếp trên bản đồ / chẩn đoán khởi đầu
  if (!recs.length && profile.current_journey.next_node) {
    const next = profile.current_journey.next_node;
    recs.push({
      unit_id: `DB_NODE_${next.node_id}`,
      topic: `Khởi động chặng tiếp theo: ${next.title}`,
      current_p_l: 0.3,
      current_mastery: 0.3,
      cognitive_level: 'NHAN_BIET',
      difficulty: 0.35,
      attempts: 0,
      reason: `Thuộc hành trình “${next.journey_title}” — học nút này để AI đo năng lực thật của em`,
      suggested_action: 'Mở bản đồ học ngay',
      action_kind: 'journey_node',
      node_id: next.node_id,
      sgk_reference: 'Lộ trình Hào Khí Đông A trên Bản đồ Học',
      study_method: 'Đọc phần lý thuyết ngắn rồi hoàn thành 3–5 câu kiểm tra nhanh.',
      key_takeaways: [next.journey_title, next.title],
    });
  }

  // 4. Fallback nhẹ khi tài khoản hoàn toàn mới (chưa mở hành trình lẫn quiz)
  if (!recs.length) {
    const starter = SGK_HINTS.slice(0, Math.min(3, limit));
    const starterTitles: Record<string, string> = {
      KC1_OVERVIEW: 'Khởi động: Kháng chiến chống Mông Cổ lần 1 (1258)',
      TQT_WHY_ORANGE: 'Nhân vật trọng tâm: Trần Quốc Toản & Hội nghị Bình Than (1282)',
      DIEN_HONG_CONFERENCE: 'Điểm tựa tinh thần: Hội nghị Diên Hồng & Hịch tướng sĩ',
    };
    for (const h of starter) {
      recs.push({
        unit_id: h.unit_id,
        topic: starterTitles[h.unit_id] || h.unit_id,
        current_p_l: BKT_DEFAULTS.p_l0,
        current_mastery: BKT_DEFAULTS.p_l0,
        cognitive_level: h.cognitive_level,
        difficulty: 0.4,
        attempts: 0,
        reason: 'Chưa có dữ liệu làm bài — bắt đầu chủ điểm nền tảng để AI xây dựng hồ sơ cá nhân',
        suggested_action: 'Hỏi Thầy Đông A hoặc làm bài đầu tiên',
        action_kind: 'tutor',
        sgk_reference: h.sgk_reference,
        study_method: h.study_method,
        key_takeaways: ['Khởi tạo hồ sơ BKT'],
      });
    }
  }

  const weakNames = profile.topics.weak.map((t) => t.name).slice(0, 4);
  const strongNames = profile.topics.strong.map((t) => t.name).slice(0, 4);
  const overall = profile.stats.accuracy !== null
    ? Math.round((profile.stats.accuracy / 100) * 100) / 100
    : BKT_DEFAULTS.p_l0;
  const masteryRank = !profile.has_activity
    ? 'Khởi động hồ sơ (Chưa có lượt làm bài)'
    : overall >= 0.75
      ? 'Thống lĩnh Đại Việt (Thành thạo cao)'
      : overall >= 0.5
        ? 'Chiến binh Thăng Long (Đang tiến bộ)'
        : 'Tân binh Đông A (Cần củng cố nền tảng)';

  const rawResult = {
    student_id: studentId,
    bkt_parameters: { ...BKT_DEFAULTS },
    total_recommendations: recs.slice(0, limit).length,
    recommendations: recs.slice(0, limit),
    profile: {
      student_id: studentId,
      overall_mastery: overall,
      mastery_rank: masteryRank,
      total_quiz_attempts: profile.stats.attempts,
      total_chat_questions: profile.ai_history.questions_30d,
      strengths: strongNames,
      weaknesses: weakNames,
      ai_diagnosis: profile.has_activity
        ? `Hồ sơ thật: đã trả lời ${profile.stats.answered} câu (độ chính xác ${profile.stats.accuracy ?? 0}%), chuỗi ${profile.stats.streak_current} ngày, ${profile.topics.weak.length} chủ đề cần củng cố.`
        : 'Tài khoản chưa có lượt làm bài hoặc hỏi đáp AI. Hãy hoàn thành 1 bài học trên Bản đồ Học hoặc Luyện tập để lộ trình BKT đo chính xác năng lực của em.',
    },
  };

  return enrichBktResponse(rawResult, profile, 'node_bkt+db');
}

/** Tạo chuỗi ngữ cảnh ngắn gọn từ hồ sơ thật để gửi kèm sang Python bridge khi Ask AI */
export function buildProfilePromptContext(profile: StudentAiProfile): Record<string, unknown> {
  return {
    has_activity: profile.has_activity,
    grade: profile.student.grade,
    streak_current: profile.stats.streak_current,
    days_idle: profile.stats.days_idle,
    accuracy: profile.stats.accuracy,
    answered: profile.stats.answered,
    weak_topics: profile.topics.weak.slice(0, 5).map((t) => ({ name: t.name, percent: t.percent, type: t.type, id: t.id, last_at: t.last_at })),
    strong_topics: profile.topics.strong.slice(0, 3).map((t) => ({ name: t.name, percent: t.percent })),
    all_topics: profile.topics.all.filter((t) => t.answered > 0).slice(0, 20).map((t) => ({
      type: t.type, id: t.id, name: t.name, answered: t.answered, correct: t.correct, percent: t.percent, last_at: t.last_at,
    })),
    next_node: profile.current_journey.next_node,
    recent_wrong_questions: profile.recent_wrong_questions.slice(0, 5),
    upcoming_assignments: profile.upcoming_assignments.slice(0, 3),
    ai_questions_30d: profile.ai_history.questions_30d,
  };
}
