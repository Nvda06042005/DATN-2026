/**
 * Kiểm thử đơn vị: đồng bộ hồ sơ học tập PostgreSQL vào mô hình BKT & lộ trình AI cá nhân hóa (không cần CSDL).
 */
import { AnalyticsService, StudentAiProfile } from '../src/analytics/analytics.service';
import { AiTutorService } from '../src/ai/ai-tutor.service';
import {
  buildNodeBktRecommendations,
  buildProfilePromptContext,
  enrichBktResponse,
  estimateTopicMastery,
} from '../src/ai/bkt-profile';
import type { UserRow } from '../src/database/database.service';

const STUDENT = {
  id: 42,
  email: 'hs@example.com',
  username: 'hs42',
  full_name: 'Trần Minh An',
  nickname: null,
  avatar_url: null,
  role: 'student',
  school_id: 1,
  grade: 7,
  user_code: 'HS0042',
  is_active: true,
} as unknown as UserRow;

function makeEmptyProfile(): StudentAiProfile {
  return {
    has_activity: false,
    student: { id: 42, full_name: 'Trần Minh An', grade: 7, school_id: 1 },
    stats: {
      xp: 0, level: 1, streak_current: 0, daily_goal: 30, progress: null, nodes_done: 0, nodes_total: 4,
      avg_percent: null, attempts: 0, answered: 0, correct: 0, accuracy: null, study_minutes: 0, active_days: 0, last_active_at: null, days_idle: null,
    },
    current_journey: {
      title: 'Kháng chiến lần 1 (1258)',
      next_node: { journey_id: 1, journey_title: 'Kháng chiến lần 1 (1258)', node_id: 10, title: 'Bình Lệ Nguyên', kind: 'lesson' },
      review_nodes: [],
    },
    topics: { strong: [], weak: [], all: [] },
    recent_wrong_questions: [],
    upcoming_assignments: [],
    ai_history: { questions_30d: 0, recent_questions: [] },
  };
}

function makeActiveProfile(): StudentAiProfile {
  const daysAgoIso = new Date(Date.now() - 8 * 86_400_000).toISOString();
  return {
    ...makeEmptyProfile(),
    has_activity: true,
    stats: {
      xp: 320, level: 3, streak_current: 4, daily_goal: 30, progress: 50, nodes_done: 2, nodes_total: 4,
      avg_percent: 62, attempts: 5, answered: 20, correct: 11, accuracy: 55, study_minutes: 35, active_days: 4, last_active_at: new Date().toISOString(), days_idle: 0,
    },
    topics: {
      strong: [{ type: 'figure', id: 2, name: 'Trần Thủ Độ', answered: 6, correct: 6, percent: 100, last_at: new Date().toISOString(), level: 'strong' }],
      weak: [{ type: 'battle', id: 7, name: 'Đại thắng Bạch Đằng (1288)', answered: 5, correct: 1, percent: 20, last_at: daysAgoIso, level: 'weak' }],
      all: [
        { type: 'figure', id: 2, name: 'Trần Thủ Độ', answered: 6, correct: 6, percent: 100, last_at: new Date().toISOString(), level: 'strong' },
        { type: 'battle', id: 7, name: 'Đại thắng Bạch Đằng (1288)', answered: 5, correct: 1, percent: 20, last_at: daysAgoIso, level: 'weak' },
      ],
    },
    recent_wrong_questions: [
      { question_id: 99, prompt: 'Chiến thắng Bạch Đằng năm 1288 do ai chỉ huy?', difficulty: 2, wrong_count: 2, last_wrong_at: daysAgoIso, campaign_title: 'Kháng chiến lần 3' },
    ],
    upcoming_assignments: [
      {
        assignment_id: 15, title: 'Kiểm tra 15 phút: Ba lần kháng chiến', class_name: '7A1',
        due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), days_left: 2,
        weak_topics: [{ type: 'battle', id: 7, name: 'Đại thắng Bạch Đằng (1288)', percent: 20 }],
      },
    ],
    ai_history: { questions_30d: 3, recent_questions: ['Trận Bạch Đằng 1288 diễn ra thế nào?'] },
  };
}

describe('BKT & AI Student Profile Sync', () => {
  test('estimateTopicMastery phản ánh đúng đúng/sai và suy giảm trí nhớ Ebbinghaus theo thời gian', () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const masteredRecent = estimateTopicMastery({ answered: 6, correct: 6, last_at: now });
    const masteredStale = estimateTopicMastery({ answered: 6, correct: 6, last_at: old });
    const struggling = estimateTopicMastery({ answered: 6, correct: 1, last_at: now });

    expect(masteredRecent).toBeGreaterThan(0.8);
    expect(masteredStale).toBeLessThan(masteredRecent);
    expect(struggling).toBeLessThan(0.45);
  });

  test('học sinh chưa có dữ liệu không bị gán hồ sơ mẫu giả, được gợi ý nút tiếp theo trên bản đồ', () => {
    const res = buildNodeBktRecommendations('user_42', makeEmptyProfile(), 6);
    expect(res.profile_summary.has_activity).toBe(false);
    expect(res.profile_summary.data_source).toBe('node_bkt+db');
    expect(res.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(res.recommendations[0].action_kind).toBe('journey_node');
    expect(res.recommendations[0].node_id).toBe(10);
  });

  test('học sinh có điểm yếu, câu sai và bài kiểm tra sắp hạn nhận đề xuất gắn topic_type/topic_id & due_urgent', () => {
    const res = buildNodeBktRecommendations('user_42', makeActiveProfile(), 6);
    expect(res.profile_summary.has_activity).toBe(true);
    expect(res.profile_summary.accuracy).toBe(55);
    expect(res.profile_summary.upcoming_assignment?.days_left).toBe(2);

    const wrongCard = res.recommendations.find((r) => r.action_kind === 'practice_wrong');
    const topicCard = res.recommendations.find((r) => r.action_kind === 'practice_topic');
    expect(wrongCard).toBeDefined();
    expect(topicCard).toBeDefined();
    expect(topicCard?.topic_type).toBe('battle');
    expect(topicCard?.topic_id).toBe(7);
    expect(topicCard?.due_urgent).toBe(true);
    expect(topicCard?.reason).toContain('20%');
  });

  test('enrichBktResponse gắn được topic DB & upcoming_assignment vào kết quả từ Python BKT', () => {
    const pyRaw = {
      student_id: 'user_42',
      bkt_parameters: { p_l0: 0.3, p_t: 0.15, p_g: 0.25, p_s: 0.1, mastery_threshold: 0.6 },
      recommendations: [
        { unit_id: 'KC3_BACH_DANG_HOW', topic: 'Đại thắng sông Bạch Đằng (Tháng 4/1288)', current_mastery: 0.28 },
      ],
    };
    const out = enrichBktResponse(pyRaw, makeActiveProfile(), 'python_bkt+db');
    expect(out.profile_summary.data_source).toBe('python_bkt+db');
    expect(out.recommendations[0].action_kind).toBe('practice_topic');
    expect(out.recommendations[0].topic_type).toBe('battle');
    expect(out.recommendations[0].topic_id).toBe(7);
    expect(out.recommendations[0].due_urgent).toBe(true);
  });

  test('buildProfilePromptContext tạo snapshot gọn gồm topics, assignments và wrong questions', () => {
    const ctx = buildProfilePromptContext(makeActiveProfile());
    expect(ctx.has_activity).toBe(true);
    expect(ctx.streak_current).toBe(4);
    expect(Array.isArray(ctx.weak_topics)).toBe(true);
    expect(Array.isArray(ctx.recent_wrong_questions)).toBe(true);
  });

  test('AnalyticsService.studentAiProfile & AiTutorService.bktRecommendations hoạt động an toàn khi không có DB/Python', async () => {
    const fakeDb = { ready: false } as any;
    const fakeReco = {} as any;
    const analytics = new AnalyticsService(fakeDb, fakeReco);
    const offlineProfile = await analytics.studentAiProfile(STUDENT);
    expect(offlineProfile.has_activity).toBe(false);
    expect(offlineProfile.student.id).toBe(42);

    const tutor = new AiTutorService(
      fakeDb,
      {} as any,
      {} as any,
      {} as any,
      { studentAiProfile: async () => makeActiveProfile() } as unknown as AnalyticsService,
    );
    jest.spyOn(tutor as any, 'callPythonBridge').mockResolvedValue(null);
    const bkt = await tutor.bktRecommendations(STUDENT, 4);
    expect(bkt.total_recommendations).toBeGreaterThan(0);
    expect((bkt as any).profile_summary.data_source).toBe('node_bkt+db');
  });
});
