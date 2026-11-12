/**
 * Giao diện Lộ trình Học tập Cá nhân hóa (theo thiết kế VSTEP Owl + BKT 4 tham số Hào Khí Đông A):
 * - Màn giới thiệu (Ảnh 1) với thẻ xem trước "Hôm nay" và 4 bước lập lộ trình
 * - Wizard 5 màn hình: 1. Mục tiêu → 2. Lịch học → 3. Tự đánh giá → 4. Xác định trình độ → 5. Tạo lộ trình
 * - Dashboard lộ trình: chế độ Hôm nay / Tuần / Tháng, nút Cập nhật bằng AI, nút Tạo lại (về Ảnh 1),
 *   menu nhiệm vụ (⋯), thêm nhiệm vụ, thẻ Chiến lược & Phân bổ luyện tập, và trình đọc Tài liệu Hướng dẫn ôn tập (Ảnh 9).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Layers,
  MoreHorizontal,
  Pin,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react-native';
import { Btn, Card, Chip, Field, Sheet, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import {
  addCustomRoadmapTask,
  createDefaultWizardConfig,
  generatePersonalizedRoadmap,
  getRoadmapStats,
  GOAL_TIER_META,
  moveRoadmapTaskOrder,
  moveRoadmapTaskToNextDay,
  PILLAR_META,
  rebalanceRoadmapWithAiBkt,
  removeOrSkipRoadmapTask,
  toggleRoadmapTaskDone,
  toggleRoadmapTaskPin,
  type AssessmentMode,
  type FoundationLevel,
  type GoalTier,
  type PersonalizedRoadmapPlan,
  type PillarKey,
  type RoadmapDayTask,
  type RoadmapReadingGuide,
  type RoadmapWizardConfig,
  type StudyPurpose,
  type StudySlot,
} from '@/lib/personalized-roadmap';
import type { BktRecommendationItem, BktRecommendationsResponse } from '@/types/ai';

export interface PersonalizedRoadmapViewProps {
  userId: number;
  bktData?: BktRecommendationsResponse | null;
  onBackToHub?: () => void;
  onStartPractice?: (rec: BktRecommendationItem) => void;
  onOpenFlashcards?: () => void;
  onAskTutor?: (question: string) => void;
  onGoLearn?: (nodeId?: number) => void;
}

type Stage = 'landing' | 'wizard' | 'dashboard';
type ViewScope = 'today' | 'week' | 'month';

const WEEKDAY_VN = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const REST_DAY_BUTTONS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'T2' },
  { day: 2, label: 'T3' },
  { day: 3, label: 'T4' },
  { day: 4, label: 'T5' },
  { day: 5, label: 'T6' },
  { day: 6, label: 'T7' },
  { day: 0, label: 'CN' },
];

const CONCERN_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'nho_moc_nam', label: 'Hay quên mốc năm & địa danh' },
  { id: 'nham_nhan_vat', label: 'Dễ nhầm tên danh tướng / tướng giặc' },
  { id: 'phan_tich_nguyen_nhan', label: 'Khó làm câu hỏi Vận dụng / Nguyên nhân' },
  { id: 'it_thoi_gian', label: 'Ít thời gian ôn trước kỳ thi' },
  { id: 'kho_hoc_deu', label: 'Khó duy trì học đều mỗi ngày' },
];

function formatVnDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = WEEKDAY_VN[d.getDay()] ?? '';
  return `${wd}, ${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
}

function formatShortRange(days: PersonalizedRoadmapPlan['days']): string {
  if (!days.length) return '';
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const fmt = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return `${fmt(first)} – ${fmt(last)}`;
}

function storageKey(userId: number): string {
  return `dong_a_personalized_roadmap_v1_${userId || 1}`;
}

export const PersonalizedRoadmapView: React.FC<PersonalizedRoadmapViewProps> = ({
  userId,
  bktData,
  onBackToHub,
  onStartPractice,
  onOpenFlashcards,
  onAskTutor,
  onGoLearn,
}) => {
  const { c } = useTheme();
  const toast = useToast();

  const [plan, setPlan] = useState<PersonalizedRoadmapPlan | null>(null);
  const [stage, setStage] = useState<Stage>('landing');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [quickGoalEditOnly, setQuickGoalEditOnly] = useState(false);
  const [config, setConfig] = useState<RoadmapWizardConfig>(() => createDefaultWizardConfig(bktData));

  const [viewScope, setViewScope] = useState<ViewScope>('today');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [expandedReasonIds, setExpandedReasonIds] = useState<Set<string>>(new Set());
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPillar, setNewTaskPillar] = useState<PillarKey>('KC3');
  const [newTaskMinutes, setNewTaskMinutes] = useState('15');
  const [activeGuide, setActiveGuide] = useState<{ dayDate: string; task: RoadmapDayTask; guide: RoadmapReadingGuide } | null>(null);

  // Khôi phục lộ trình đã lưu trên máy
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as PersonalizedRoadmapPlan;
        if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
          setPlan(parsed);
          setConfig(parsed.config);
          setStage('dashboard');
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }, [userId]);

  const savePlan = (next: PersonalizedRoadmapPlan | null) => {
    setPlan(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (next) window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
        else window.localStorage.removeItem(storageKey(userId));
      } catch {
        // ignore quota errors
      }
    }
  };

  const currentDay = useMemo(() => {
    if (!plan || !plan.days.length) return null;
    const idx = Math.min(plan.days.length - 1, Math.max(0, selectedDayIdx));
    return plan.days[idx];
  }, [plan, selectedDayIdx]);

  const handleCreateRoadmap = () => {
    const generated = generatePersonalizedRoadmap(config, bktData);
    savePlan(generated);
    setSelectedDayIdx(0);
    setQuickGoalEditOnly(false);
    setStage('dashboard');
    toast('Đã khởi tạo lộ trình học tập cá nhân hóa!');
  };

  const handleAiRebalance = () => {
    if (!plan) return;
    const updated = rebalanceRoadmapWithAiBkt(plan, bktData);
    savePlan(updated);
    toast('Đã cập nhật lộ trình theo điểm BKT & tiến độ mới nhất!');
  };

  const handleStartTask = (dayDate: string, task: RoadmapDayTask) => {
    if (task.kind === 'reading' || task.guide) {
      const guide = task.guide ?? {
        title: task.title,
        categoryLabel: PILLAR_META[task.pillar].label,
        sgkRef: PILLAR_META[task.pillar].sgkSection,
        overview: [task.reason],
        tactics: ['Đọc kỹ mục tương ứng trong SGK Lịch sử 7 - Bài 15 và ghi nhớ mốc năm, nhân vật chính.'],
        commonMistakes: ['Chú ý phân biệt diễn biến giữa 3 lần kháng chiến (1258, 1285, 1287–1288).'],
        keyQuestion: `Trình bày nội dung cốt lõi của chủ điểm: ${task.title}?`,
      };
      setActiveGuide({ dayDate, task, guide });
      return;
    }
    // Đánh dấu hoàn thành khi bắt đầu làm bài giống VSTEP Owl
    if (plan && task.status !== 'done') {
      savePlan(toggleRoadmapTaskDone(plan, dayDate, task.id));
    }
    if (task.kind === 'flashcard' && onOpenFlashcards) {
      onOpenFlashcards();
      return;
    }
    if (task.kind === 'ai_tutor' && onAskTutor) {
      onAskTutor(`Thầy giảng kỹ giúp em về chủ đề: ${task.title}`);
      return;
    }
    if ((task.kind === 'quiz' || task.kind === 'wrong_review' || task.kind === 'checkpoint') && onStartPractice) {
      onStartPractice({
        unit_id: task.unitId || task.id,
        topic: task.title,
        action_kind: task.kind === 'wrong_review' ? 'practice_wrong' : 'practice_topic',
        topic_type: task.topicType,
        topic_id: task.topicId,
        node_id: task.nodeId,
      });
      return;
    }
    if (onGoLearn) {
      onGoLearn(task.nodeId);
    }
  };

  // ============================================================================
  // TRÌNH ĐỌC TÀI LIỆU HƯỚNG DẪN ÔN TẬP (ẢNH 9)
  // ============================================================================
  if (activeGuide) {
    const { dayDate, task, guide } = activeGuide;
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16, maxWidth: 1020, alignSelf: 'center', width: '100%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Btn icon={ArrowLeft} title="Quay lại Lộ trình" tone="giay" size="sm" onPress={() => setActiveGuide(null)} />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Chip text={guide.categoryLabel} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={guide.sgkRef} bg={c.giay2} fg={c.muc2} />
          </View>
        </View>

        <Card style={{ padding: 22, borderRadius: 20, gap: 18 }}>
          <View style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: c.vien, paddingBottom: 14 }}>
            <Txt f="displayHeavy" size={22} color={c.muc}>{guide.title}</Txt>
            <Txt size={13} color={c.muc2}>
              Hướng dẫn chi tiết kiến thức trọng tâm, chiến thuật làm bài trắc nghiệm và các lỗi thường gặp ({guide.sgkRef}).
            </Txt>
          </View>

          {/* Khung banner minh họa giống Learning Pack ở Ảnh 9 */}
          <View
            style={{
              padding: 18,
              borderRadius: 16,
              backgroundColor: c.vangNhat,
              borderWidth: 1.5,
              borderColor: c.dong,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
              <Chip text="HÀO KHÍ ĐÔNG A · CẨM NANG ÔN THI" bg={c.sonNhat} fg={c.sonChu} />
              <Txt f="bold" size={17} color={c.muc}>Học nhanh hơn với bộ tóm tắt chính sử chọn lọc</Txt>
              <Txt size={13} color={c.muc2}>Nắm vững sự kiện – nhân vật – nguyên nhân chỉ trong {task.minutes} phút trước khi vào làm đề.</Txt>
            </View>
            {onAskTutor ? (
              <Btn
                icon={Sparkles}
                title="Hỏi Thầy Đông A phần này"
                tone="son"
                size="sm"
                onPress={() => {
                  setActiveGuide(null);
                  onAskTutor(guide.keyQuestion);
                }}
              />
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Txt f="bold" size={16} color={c.muc}>I. Tổng quan kiến thức trọng tâm</Txt>
            {guide.overview.map((line, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Txt f="bold" size={14} color={c.sonChu}>•</Txt>
                <Txt size={14} color={c.muc} style={{ flex: 1, lineHeight: 21 }}>{line}</Txt>
              </View>
            ))}
          </View>

          <View style={{ gap: 10 }}>
            <Txt f="bold" size={16} color={c.muc}>II. Chiến thuật làm bài & Mẹo ghi nhớ nhanh</Txt>
            {guide.tactics.map((line, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Txt f="bold" size={14} color={c.ngocChu}>✓</Txt>
                <Txt size={14} color={c.muc} style={{ flex: 1, lineHeight: 21 }}>{line}</Txt>
              </View>
            ))}
          </View>

          <View style={{ gap: 10 }}>
            <Txt f="bold" size={16} color={c.muc}>III. Các lỗi thường gặp cần tránh</Txt>
            {guide.commonMistakes.map((line, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Txt f="bold" size={14} color={c.dongChu}>⚠</Txt>
                <Txt size={14} color={c.muc} style={{ flex: 1, lineHeight: 21 }}>{line}</Txt>
              </View>
            ))}
          </View>

          <View style={{ padding: 14, borderRadius: 12, backgroundColor: c.giay2, borderWidth: 1, borderColor: c.vien, gap: 6 }}>
            <Txt f="bold" size={13} color={c.thuyChu}>Câu hỏi trọng tâm tự kiểm tra:</Txt>
            <Txt f="semibold" size={14} color={c.muc}>{guide.keyQuestion}</Txt>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <Btn title="Đóng" tone="giay" onPress={() => setActiveGuide(null)} />
            <Btn
              icon={Check}
              title={task.status === 'done' ? 'Đã hoàn thành bài đọc' : 'Đánh dấu Đã xong & Quay lại'}
              tone="ngoc"
              onPress={() => {
                if (plan && task.status !== 'done') {
                  savePlan(toggleRoadmapTaskDone(plan, dayDate, task.id));
                }
                setActiveGuide(null);
              }}
            />
          </View>
        </Card>
      </ScrollView>
    );
  }

  // ============================================================================
  // MÀN HÌNH 1: TRANG GIỚI THIỆU LỘ TRÌNH CÁ NHÂN HÓA (ẢNH 1 - KHI CHƯA LẬP HOẶC BẤM "TẠO LẠI")
  // ============================================================================
  if (stage === 'landing') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18, maxWidth: 1020, alignSelf: 'center', width: '100%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {onBackToHub ? (
            <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={onBackToHub} />
          ) : <View />}
          {plan ? (
            <Btn
              icon={Calendar}
              title="Quay lại lộ trình đang học"
              tone="thuy"
              size="sm"
              onPress={() => setStage('dashboard')}
            />
          ) : null}
        </View>

        {/* Card Hero 2 cột giống hệt Ảnh 1 */}
        <Card
          style={{
            padding: 26,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: c.vien,
            backgroundColor: c.the,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Cột trái: Tiêu đề + 4 bước + Nút Bắt đầu lập lộ trình */}
          <View style={{ flex: 1.2, minWidth: 280, gap: 14 }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Chip text="✨ Lộ trình cá nhân" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            <Txt f="displayHeavy" size={26} color={c.muc}>
              Lộ trình Sử học Đông A cá nhân hóa
            </Txt>
            <Txt size={14} color={c.muc2} style={{ lineHeight: 22 }}>
              Trả lời vài câu hỏi ngắn, hệ thống AI & BKT sẽ lập lộ trình ôn tập Lịch sử 7 theo từng ngày — vừa khít với mục tiêu điểm số, thời gian rảnh và các chủ điểm em còn yếu.
            </Txt>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { n: '1', label: 'Mục tiêu' },
                { n: '2', label: 'Lịch học' },
                { n: '3', label: 'Tự đánh giá' },
                { n: '4', label: 'Xác định trình độ' },
              ].map((s) => (
                <View
                  key={s.n}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: c.giay2,
                    borderWidth: 1,
                    borderColor: c.vien,
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt f="bold" size={11} color={c.muc}>{s.n}</Txt>
                  </View>
                  <Txt f="semibold" size={12.5} color={c.muc}>{s.label}</Txt>
                </View>
              ))}
            </View>

            <View style={{ alignSelf: 'flex-start', paddingTop: 4 }}>
              <Btn
                icon={ArrowRight}
                title="Bắt đầu lập lộ trình"
                tone="ngoc"
                size="md"
                onPress={() => {
                  setQuickGoalEditOnly(false);
                  setWizardStep(1);
                  setStage('wizard');
                }}
                testID="roadmap-start-wizard-btn"
              />
            </View>

            <Txt size={12} color={c.muc3}>
              Kết hợp hồ sơ làm bài thật trên hệ thống với mô hình BKT 4 tham số; hoạt động tức thì cả khi ngoại tuyến.
            </Txt>
          </View>

          {/* Cột phải: Thẻ Preview "HÔM NAY · NGÀY 3/14" giống Ảnh 1 */}
          <View
            style={{
              flex: 1,
              minWidth: 270,
              maxWidth: 380,
              padding: 18,
              borderRadius: 18,
              backgroundColor: c.giay2,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Txt size={11} f="bold" color={c.muc3}>HÔM NAY · NGÀY 3/14</Txt>
                <Txt f="bold" size={15} color={c.muc}>Mục tiêu Bứt phá Điểm 8+</Txt>
              </View>
              <Chip text="30 phút" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>

            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.vien, overflow: 'hidden' }}>
              <View style={{ width: '66%', height: '100%', backgroundColor: c.thuy }} />
            </View>

            {[
              { title: 'Ôn thẻ nhớ: Kháng chiến lần 1 (1258)', mins: '5 phút', done: true },
              { title: 'Tài liệu SGK: Đại thắng Bạch Đằng 1288', mins: '10 phút', done: true },
              { title: 'Luyện 6 câu trắc nghiệm: Trận Vân Đồn', mins: '15 phút', done: false },
            ].map((item, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: c.the,
                  borderWidth: 1,
                  borderColor: item.done ? c.ngoc : c.vien,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt
                    f="semibold"
                    size={13}
                    color={item.done ? c.muc2 : c.muc}
                    style={item.done ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {item.title}
                  </Txt>
                  <Txt size={11} color={c.muc3}>⏱ {item.mins}</Txt>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: item.done ? c.ngoc : 'transparent',
                    borderWidth: 1.5,
                    borderColor: item.done ? c.ngoc : c.vien,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.done ? <Check size={13} color="#FFF" /> : null}
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* 3 thẻ lợi ích bên dưới giống Ảnh 1 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[
            {
              icon: Calendar,
              title: 'Lịch học từng ngày',
              desc: 'Tự động chia bài vừa khít thời gian rảnh mỗi ngày, mục tiêu và các mảng kiến thức còn yếu của riêng em.',
            },
            {
              icon: BookOpen,
              title: 'Bài học & Đề luyện có sẵn',
              desc: 'Mỗi nhiệm vụ mở thẳng tài liệu hướng dẫn SGK, bộ thẻ Flashcard, câu hỏi ôn tập hoặc hỏi đáp cùng Thầy Đông A.',
            },
            {
              icon: RefreshCw,
              title: 'Tự điều chỉnh khi em bận',
              desc: 'Làm xong bài tự đánh dấu hoàn thành; có thể ghim, dời nhiệm vụ sang ngày sau hoặc cập nhật lại bằng AI/BKT.',
            },
          ].map((feat, idx) => (
            <Card key={idx} style={{ flex: 1, minWidth: 260, padding: 16, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                <feat.icon size={18} color={c.thuyChu} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt f="bold" size={14} color={c.muc}>{feat.title}</Txt>
                <Txt size={12.5} color={c.muc2} style={{ lineHeight: 18 }}>{feat.desc}</Txt>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ============================================================================
  // MÀN HÌNH 2: WIZARD 5 BƯỚC LẬP LỘ TRÌNH (ẢNH 2, 3, 4, 5, 6)
  // ============================================================================
  if (stage === 'wizard') {
    const stepLabels = [
      { step: 1, label: '1. Mục tiêu' },
      { step: 2, label: '2. Lịch học' },
      { step: 3, label: '3. Tự đánh giá' },
      { step: 4, label: '4. Xác định trình độ' },
    ];

    const toggleSlot = (slot: StudySlot) => {
      setConfig((prev) => {
        const exists = prev.studySlots.includes(slot);
        const next = exists ? prev.studySlots.filter((s) => s !== slot) : [...prev.studySlots, slot];
        return { ...prev, studySlots: next.length ? next : [slot] };
      });
    };

    const toggleRestDay = (day: number) => {
      setConfig((prev) => {
        const exists = prev.restDays.includes(day);
        if (exists) return { ...prev, restDays: prev.restDays.filter((d) => d !== day) };
        if (prev.restDays.length >= 3) {
          toast('Chỉ chọn tối đa 3 ngày nghỉ trong tuần');
          return prev;
        }
        return { ...prev, restDays: [...prev.restDays, day] };
      });
    };

    const toggleConcern = (id: string) => {
      setConfig((prev) => {
        const exists = prev.concerns.includes(id);
        return {
          ...prev,
          concerns: exists ? prev.concerns.filter((x) => x !== id) : [...prev.concerns, id],
        };
      });
    };

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, maxWidth: 760, alignSelf: 'center', width: '100%' }}>
        <Card style={{ padding: 22, borderRadius: 22, gap: 20 }}>
          {/* Thanh tiến trình 4 bước + nút Thoát ở góc phải */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              {stepLabels.map((s) => {
                const done = wizardStep > s.step;
                const active = wizardStep === s.step;
                return (
                  <View key={s.step} style={{ flex: 1, gap: 6 }}>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: done || active ? c.thuy : c.vien,
                      }}
                    />
                    <Txt size={11.5} f={active ? 'bold' : 'body'} color={done || active ? c.thuyChu : c.muc3}>
                      {done ? `✓ ${s.label.slice(3)}` : s.label}
                    </Txt>
                  </View>
                );
              })}
            </View>
            <Btn
              icon={X}
              title="Thoát"
              tone="giay"
              size="sm"
              onPress={() => setStage(plan ? 'dashboard' : 'landing')}
            />
          </View>

          {/* BƯỚC 1: MỤC TIÊU (ẢNH 2) */}
          {wizardStep === 1 ? (
            <View style={{ gap: 18 }} testID="roadmap-step-1">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={20} color={c.thuyChu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={18} color={c.muc}>Mục tiêu</Txt>
                  <Txt size={13} color={c.muc2}>Em muốn đạt mức độ nào và còn bao nhiêu thời gian để ôn tập?</Txt>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Bạn muốn đạt bậc mục tiêu nào? *</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(['foundation', 'exam_ready', 'mastery'] as GoalTier[]).map((tier) => {
                    const meta = GOAL_TIER_META[tier];
                    const selected = config.goalTier === tier;
                    return (
                      <Pressable
                        key={tier}
                        onPress={() => setConfig((p) => ({ ...p, goalTier: tier }))}
                        style={{
                          flex: 1,
                          minWidth: 190,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          gap: 4,
                        }}
                      >
                        <Chip text={meta.badge} bg={c.giay2} fg={c.muc} />
                        <Txt f="bold" size={15} color={c.muc}>{meta.title}</Txt>
                        <Txt size={12} color={c.muc2}>{meta.subtitle}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Bạn tính thời hạn theo cách nào?</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    { id: 'days' as const, title: 'Chọn số ngày', sub: 'Học trong một khoảng thời gian cố định' },
                    { id: 'exam_date' as const, title: 'Tôi đã có ngày kiểm tra', sub: 'Lộ trình kết thúc ngay trước ngày thi' },
                  ].map((m) => {
                    const selected = config.durationMode === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setConfig((p) => ({ ...p, durationMode: m.id }))}
                        style={{
                          flex: 1,
                          minWidth: 220,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          gap: 2,
                        }}
                      >
                        <Txt f="bold" size={14} color={c.muc}>{m.title}</Txt>
                        <Txt size={12} color={c.muc2}>{m.sub}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Bạn muốn ôn trong bao lâu?</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[7, 14, 21, 30, 60, 90].map((d) => {
                    const selected = config.durationDays === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setConfig((p) => ({ ...p, durationDays: d }))}
                        style={{
                          minWidth: 96,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          alignItems: 'center',
                        }}
                      >
                        <Txt f="bold" size={13.5} color={selected ? c.thuyChu : c.muc}>{d} ngày</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Bạn ôn tập để làm gì?</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'kiem_tra_15p' as StudyPurpose, label: 'Kiểm tra 15p / 1 tiết' },
                    { id: 'thi_hoc_ky' as StudyPurpose, label: 'Thi giữa / cuối kỳ' },
                    { id: 'boi_duong_hsg' as StudyPurpose, label: 'Bồi dưỡng HSG Sử' },
                    { id: 'yeu_thich' as StudyPurpose, label: 'Yêu thích Lịch sử' },
                  ].map((p) => {
                    const selected = config.purpose === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setConfig((prev) => ({ ...prev, purpose: p.id }))}
                        style={{
                          flex: 1,
                          minWidth: 140,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          alignItems: 'center',
                        }}
                      >
                        <Txt f="semibold" size={13} color={selected ? c.thuyChu : c.muc}>{p.label}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Btn icon={ArrowRight} title="Tiếp tục" tone="thuy" onPress={() => setWizardStep(2)} />
              </View>
            </View>
          ) : null}

          {/* BƯỚC 2: LỊCH HỌC (ẢNH 3) */}
          {wizardStep === 2 ? (
            <View style={{ gap: 18 }} testID="roadmap-step-2">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} color={c.thuyChu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={18} color={c.muc}>Lịch học</Txt>
                  <Txt size={13} color={c.muc2}>Lộ trình chỉ xếp bài vừa với thời gian rảnh mỗi ngày của bạn.</Txt>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Mỗi ngày bạn học được bao lâu?</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[15, 30, 45, 60, 90].map((m) => {
                    const selected = config.dailyMinutes === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setConfig((p) => ({ ...p, dailyMinutes: m }))}
                        style={{
                          minWidth: 96,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          alignItems: 'center',
                        }}
                      >
                        <Txt f="bold" size={13.5} color={selected ? c.thuyChu : c.muc}>{m} phút</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => setConfig((p) => ({ ...p, weekendCustom: !p.weekendCustom }))}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: config.weekendCustom ? c.thuy : c.vien,
                  backgroundColor: c.giay2,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={14} color={c.muc}>Cuối tuần học thời lượng khác</Txt>
                  <Txt size={12} color={c.muc2}>Ví dụ: ngày thường {config.dailyMinutes} phút, Thứ 7 & Chủ nhật {config.weekendMinutes} phút.</Txt>
                </View>
                <Chip text={config.weekendCustom ? 'Đang bật' : 'Tắt'} bg={config.weekendCustom ? c.thuyNhat : c.the} fg={config.weekendCustom ? c.thuyChu : c.muc3} />
              </Pressable>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Bạn thường học vào lúc nào? (chọn được nhiều khung giờ)</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'sang' as StudySlot, label: '🌅 Sáng' },
                    { id: 'trua' as StudySlot, label: '☀️ Trưa' },
                    { id: 'chieu' as StudySlot, label: '🌤 Chiều' },
                    { id: 'toi' as StudySlot, label: '🌙 Tối' },
                  ].map((s) => {
                    const selected = config.studySlots.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => toggleSlot(s.id)}
                        style={{
                          flex: 1,
                          minWidth: 110,
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          alignItems: 'center',
                        }}
                      >
                        <Txt f="semibold" size={13} color={selected ? c.thuyChu : c.muc}>{s.label}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Ngày nghỉ trong tuần (tối đa 3 ngày — lộ trình không xếp bài)</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {REST_DAY_BUTTONS.map((b) => {
                    const selected = config.restDays.includes(b.day);
                    return (
                      <Pressable
                        key={b.day}
                        onPress={() => toggleRestDay(b.day)}
                        style={{
                          minWidth: 68,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          alignItems: 'center',
                        }}
                      >
                        <Txt f="bold" size={13} color={selected ? c.thuyChu : c.muc}>{b.label}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn icon={ArrowLeft} title="Quay lại" tone="giay" onPress={() => setWizardStep(1)} />
                {quickGoalEditOnly ? (
                  <Btn icon={Check} title="Lưu & Cập nhật lộ trình" tone="ngoc" onPress={handleCreateRoadmap} />
                ) : (
                  <Btn icon={ArrowRight} title="Tiếp tục" tone="thuy" onPress={() => setWizardStep(3)} />
                )}
              </View>
            </View>
          ) : null}

          {/* BƯỚC 3: TỰ ĐÁNH GIÁ (ẢNH 4) */}
          {wizardStep === 3 ? (
            <View style={{ gap: 18 }} testID="roadmap-step-3">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                  <Compass size={20} color={c.thuyChu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={18} color={c.muc}>Tự đánh giá</Txt>
                  <Txt size={13} color={c.muc2}>Cho biết điểm mạnh, điểm yếu để lộ trình ưu tiên đúng mảng kiến thức (1 là rất yếu, 5 là rất tốt).</Txt>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                {(['KC1', 'KC2', 'KC3', 'NV_NT'] as PillarKey[]).map((pKey) => {
                  const meta = PILLAR_META[pKey];
                  const val = config.selfRatings[pKey] ?? 3;
                  return (
                    <View
                      key={pKey}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: c.vien,
                        backgroundColor: c.giay2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Txt f="bold" size={13.5} color={c.muc}>{meta.label}</Txt>
                        <Txt size={11.5} color={c.muc3}>
                          {val <= 2 ? 'Cần củng cố nhiều' : val === 3 ? 'Trung bình' : 'Khá vững'}
                        </Txt>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((score) => {
                          const active = val === score;
                          return (
                            <Pressable
                              key={score}
                              onPress={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  selfRatings: { ...prev.selfRatings, [pKey]: score },
                                }))
                              }
                              style={{
                                width: 40,
                                height: 34,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                borderColor: active ? c.thuy : c.vien,
                                backgroundColor: active ? c.thuy : c.the,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Txt f="bold" size={13} color={active ? '#FFF' : c.muc}>{score}</Txt>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Nền tảng mốc thời gian & nhân vật lịch sử *</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { id: 'mat_goc' as FoundationLevel, title: 'Chưa nhớ rõ', sub: 'Cần học lại từ đầu' },
                    { id: 'co_ban' as FoundationLevel, title: 'Cơ bản', sub: 'Nhớ được các trận chính' },
                    { id: 'kha' as FoundationLevel, title: 'Khá', sub: 'Nắm được mạch sự kiện' },
                    { id: 'tot' as FoundationLevel, title: 'Vững vàng', sub: 'Nhớ rõ năm, tướng, ý nghĩa' },
                  ].map((lv) => {
                    const selected = config.foundationLevel === lv.id;
                    return (
                      <Pressable
                        key={lv.id}
                        onPress={() => setConfig((p) => ({ ...p, foundationLevel: lv.id }))}
                        style={{
                          flex: 1,
                          minWidth: 140,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          gap: 2,
                        }}
                      >
                        <Txt f="bold" size={13.5} color={c.muc}>{lv.title}</Txt>
                        <Txt size={11.5} color={c.muc2}>{lv.sub}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => setConfig((p) => ({ ...p, includeIntro: !p.includeIntro }))}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: config.includeIntro ? c.thuy : c.vien,
                  backgroundColor: c.giay2,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={14} color={c.muc}>Tìm hiểu tóm tắt SGK & chiến thuật trước khi luyện đề</Txt>
                  <Txt size={12} color={c.muc2}>
                    Những ngày đầu của lộ trình sẽ mở đầu bằng bài Hướng dẫn ôn tập & bẫy trắc nghiệm thường gặp của từng cuộc kháng chiến.
                  </Txt>
                </View>
                <Chip text={config.includeIntro ? 'Bật' : 'Tắt'} bg={config.includeIntro ? c.thuyNhat : c.the} fg={config.includeIntro ? c.thuyChu : c.muc3} />
              </Pressable>

              <View style={{ gap: 8 }}>
                <Txt f="semibold" size={14} color={c.muc}>Điều bạn lo nhất (chọn được nhiều mục)</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CONCERN_OPTIONS.map((item) => {
                    const selected = config.concerns.includes(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => toggleConcern(item.id)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          borderWidth: 1.5,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                        }}
                      >
                        <Txt f="semibold" size={12.5} color={selected ? c.thuyChu : c.muc}>
                          {selected ? `✓ ${item.label}` : item.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn icon={ArrowLeft} title="Quay lại" tone="giay" onPress={() => setWizardStep(2)} />
                <Btn icon={ArrowRight} title="Tiếp tục" tone="thuy" onPress={() => setWizardStep(4)} />
              </View>
            </View>
          ) : null}

          {/* BƯỚC 4: XÁC ĐỊNH TRÌNH ĐỘ (ẢNH 5) */}
          {wizardStep === 4 ? (
            <View style={{ gap: 18 }} testID="roadmap-step-4">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={20} color={c.thuyChu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={18} color={c.muc}>Xác định trình độ</Txt>
                  <Txt size={13} color={c.muc2}>Có điểm thật từ hồ sơ học tập, lộ trình bắt đầu đúng mức của bạn ngay từ ngày đầu.</Txt>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Txt f="semibold" size={14} color={c.muc}>Chọn cách xác định trình độ</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    {
                      id: 'existing_data' as AssessmentMode,
                      title: 'Dùng dữ liệu sẵn có',
                      sub: bktData?.profile_summary?.has_activity
                        ? `Đọc từ ${bktData.profile_summary.answered ?? 0} câu đã làm (chính xác ${bktData.profile_summary.accuracy ?? 0}%)`
                        : 'Kết hợp hồ sơ BKT & các lượt làm bài gần đây trên hệ thống',
                      badge: bktData?.profile_summary?.has_activity ? 'Đã sẵn sàng' : undefined,
                    },
                    {
                      id: 'quick_check' as AssessmentMode,
                      title: 'Kiểm tra nhanh',
                      sub: 'Khoảng 10 phút, rà soát nhanh 4 mảng kháng chiến thời Trần',
                      badge: 'Khuyên dùng',
                    },
                    {
                      id: 'full_mock' as AssessmentMode,
                      title: 'Thi thử tổng hợp 4 mảng',
                      sub: 'Khoảng 25 phút, đánh giá toàn diện Nhận biết – Thông hiểu – Vận dụng',
                    },
                    {
                      id: 'skip' as AssessmentMode,
                      title: 'Bỏ qua kiểm tra',
                      sub: 'Dựa trên phần tự đánh giá ở bước 3 và kiểm tra sớm vào ngày thứ 3',
                    },
                  ].map((opt) => {
                    const selected = config.assessmentMode === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setConfig((p) => ({ ...p, assessmentMode: opt.id }))}
                        style={{
                          width: '48%',
                          flexGrow: 1,
                          minWidth: 240,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: selected ? c.thuy : c.vien,
                          backgroundColor: selected ? c.thuyNhat : c.the,
                          gap: 4,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <Txt f="bold" size={14} color={c.muc}>{opt.title}</Txt>
                          {opt.badge ? <Chip text={opt.badge} bg={c.ngocNhat} fg={c.ngocChu} /> : null}
                        </View>
                        <Txt size={12} color={c.muc2}>{opt.sub}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn icon={ArrowLeft} title="Quay lại" tone="giay" onPress={() => setWizardStep(3)} />
                <Btn icon={ArrowRight} title="Tiếp tục tạo lộ trình" tone="thuy" onPress={() => setWizardStep(5)} />
              </View>
            </View>
          ) : null}

          {/* BƯỚC 5: CHỌN CÁCH LẬP LỘ TRÌNH (ẢNH 6) */}
          {wizardStep === 5 ? (
            <View style={{ gap: 18 }} testID="roadmap-step-5">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={20} color={c.thuyChu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={18} color={c.muc}>Tạo lộ trình của bạn</Txt>
                  <Txt size={13} color={c.muc2}>Chọn cách lập lộ trình. Bạn có thể lập lại hoặc cập nhật bằng AI bất cứ lúc nào.</Txt>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {[
                  {
                    id: 'ai_bkt' as const,
                    title: 'Lập bằng AI & BKT 4 tham số',
                    sub: 'Phân tích hồ sơ làm bài thật, suy giảm trí nhớ Ebbinghaus và tự điều chỉnh theo tiến độ',
                  },
                  {
                    id: 'rule_basic' as const,
                    title: 'Lộ trình cơ bản',
                    sub: 'Lập ngay theo quy tắc phân bổ chuẩn SGK và tự đánh giá của bạn',
                  },
                ].map((g) => {
                  const selected = config.generationMode === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setConfig((p) => ({ ...p, generationMode: g.id }))}
                      style={{
                        flex: 1,
                        minWidth: 240,
                        padding: 16,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: selected ? c.thuy : c.vien,
                        backgroundColor: selected ? c.thuyNhat : c.the,
                        gap: 6,
                      }}
                    >
                      <Txt f="bold" size={15} color={c.muc}>{g.title}</Txt>
                      <Txt size={12.5} color={c.muc2}>{g.sub}</Txt>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn icon={ArrowLeft} title="Quay lại" tone="giay" onPress={() => setWizardStep(4)} />
                <Btn icon={Sparkles} title="Tạo lộ trình" tone="thuy" onPress={handleCreateRoadmap} testID="roadmap-confirm-create-btn" />
              </View>
            </View>
          ) : null}
        </Card>
      </ScrollView>
    );
  }

  // ============================================================================
  // MÀN HÌNH 3: DASHBOARD LỘ TRÌNH ĐÃ TẠO (ẢNH 7, 8, 10)
  // ============================================================================
  if (!plan || !currentDay) return null;
  const stats = getRoadmapStats(plan);
  const goalMeta = GOAL_TIER_META[plan.config.goalTier];
  const dayActiveTasks = currentDay.tasks.filter((t) => t.status !== 'skipped');
  const dayDoneMinutes = dayActiveTasks.filter((t) => t.status === 'done').reduce((acc, t) => acc + t.minutes, 0);
  const dayPlanMinutes = dayActiveTasks.reduce((acc, t) => acc + t.minutes, 0) || currentDay.targetMinutes || 30;
  const dayPct = dayPlanMinutes > 0 ? Math.min(100, Math.round((dayDoneMinutes / dayPlanMinutes) * 100)) : 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 70, gap: 16, maxWidth: 1080, alignSelf: 'center', width: '100%' }}>
      {onBackToHub ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={onBackToHub} />
        </View>
      ) : null}

      {/* HEADER TỔNG QUAN LỘ TRÌNH (ẢNH 7, 8, 10) */}
      <Card style={{ padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 5,
              borderColor: stats.percent > 0 ? c.ngoc : c.vien,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.giay2,
            }}
          >
            <Txt f="bold" size={17} color={c.muc}>{stats.percent}%</Txt>
            <Txt size={10} color={c.muc3}>hoàn thành</Txt>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Txt f="displayHeavy" size={20} color={c.muc}>
              Lộ trình {goalMeta.title} của bạn
            </Txt>
            <Txt size={12.5} color={c.muc2}>{formatShortRange(plan.days)}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
              <Chip text={`📅 Ngày ${currentDay.dayIndex}/${stats.totalDays}`} bg={c.thuyNhat} fg={c.thuyChu} />
              <Chip text={`✓ ${stats.doneTasks}/${stats.totalTasks} nhiệm vụ`} bg={c.ngocNhat} fg={c.ngocChu} />
            </View>
          </View>
        </View>

        {/* Cụm nút: Cập nhật bằng AI + Tạo lại (về Ảnh 1) + Menu ⋯ (Ảnh 10) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            icon={Sparkles}
            title="Cập nhật bằng AI"
            tone="thuy"
            size="sm"
            onPress={handleAiRebalance}
            testID="roadmap-ai-update-btn"
          />
          <Btn
            icon={RotateCcw}
            title="Tạo lại"
            tone="dong"
            size="sm"
            onPress={() => setStage('landing')}
            testID="roadmap-recreate-btn"
          />
          <Pressable
            onPress={() => setHeaderMenuOpen(true)}
            testID="roadmap-more-menu-btn"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.vien,
              backgroundColor: c.giay2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoreHorizontal size={18} color={c.muc} />
          </Pressable>
        </View>
      </Card>

      {/* Thông báo thay đổi sau khi bấm Cập nhật bằng AI */}
      {plan.lastAiChangeNotes.length > 0 ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.thuyNhat, borderWidth: 1, borderColor: c.thuy, gap: 4 }}>
          <Txt f="bold" size={12.5} color={c.thuyChu}>✨ AI & BKT vừa cập nhật lộ trình của bạn:</Txt>
          {plan.lastAiChangeNotes.map((note, idx) => (
            <Txt key={idx} size={12} color={c.muc}>• {note}</Txt>
          ))}
        </View>
      ) : null}

      {/* Switcher Hôm nay / Tuần / Tháng */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { id: 'today' as ViewScope, label: '📅 Hôm nay' },
          { id: 'week' as ViewScope, label: '🗓 Tuần' },
          { id: 'month' as ViewScope, label: '📆 Tháng' },
        ].map((tab) => {
          const active = viewScope === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setViewScope(tab.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: active ? c.thuy : c.the,
                borderWidth: 1,
                borderColor: active ? c.thuy : c.vien,
              }}
            >
              <Txt f="bold" size={13} color={active ? '#FFF' : c.muc}>{tab.label}</Txt>
            </Pressable>
          );
        })}
      </View>

      {/* BỐ CỤC 2 CỘT: TRÁI (NHIỆM VỤ HÔM NAY / TUẦN / THÁNG) - PHẢI (CHIẾN LƯỢC & PHÂN BỔ LUYỆN TẬP) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* CỘT TRÁI */}
        <View style={{ flex: 2, minWidth: 320, gap: 12 }}>
          {viewScope === 'today' ? (
            <>
              {/* Điều hướng ngày < Hôm nay - Thứ ..., DD/MM > */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                <Btn
                  title="‹"
                  tone="giay"
                  size="sm"
                  disabled={selectedDayIdx <= 0}
                  onPress={() => setSelectedDayIdx((i) => Math.max(0, i - 1))}
                />
                <View style={{ alignItems: 'center' }}>
                  <Txt f="bold" size={16} color={c.muc}>
                    {selectedDayIdx === 0 ? `Hôm nay - ${formatVnDate(currentDay.date)}` : formatVnDate(currentDay.date)}
                  </Txt>
                  <Txt size={12} color={c.muc3}>
                    Ngày {currentDay.dayIndex}/{stats.totalDays} · {currentDay.isRestDay ? 'Ngày nghỉ' : 'Ngày học'}
                  </Txt>
                </View>
                <Btn
                  title="›"
                  tone="giay"
                  size="sm"
                  disabled={selectedDayIdx >= plan.days.length - 1}
                  onPress={() => setSelectedDayIdx((i) => Math.min(plan.days.length - 1, i + 1))}
                />
              </View>

              {/* Thanh tiến độ phút trong ngày */}
              <Card style={{ padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: 4,
                    borderColor: dayPct > 0 ? c.ngoc : c.vien,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt f="bold" size={12} color={c.muc}>{dayPct}%</Txt>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Txt f="bold" size={13.5} color={c.muc} numberOfLines={1}>{currentDay.themeTitle}</Txt>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: c.vien, overflow: 'hidden' }}>
                    <View style={{ width: `${dayPct}%`, height: '100%', backgroundColor: c.ngoc }} />
                  </View>
                  <Txt size={11.5} color={c.muc3}>
                    Đã học {dayDoneMinutes}/{currentDay.targetMinutes} phút hôm nay · kế hoạch {dayPlanMinutes} phút
                  </Txt>
                </View>
              </Card>

              {/* Danh sách nhiệm vụ trong ngày */}
              {currentDay.isRestDay && dayActiveTasks.length === 0 ? (
                <Card style={{ padding: 20, borderRadius: 16, alignItems: 'center', gap: 8 }}>
                  <Txt f="bold" size={15} color={c.muc}>🛌 Hôm nay là ngày nghỉ trong lịch của bạn</Txt>
                  <Txt size={13} color={c.muc2} center>
                    Bạn có thể nghỉ ngơi để não bộ củng cố trí nhớ, hoặc bấm “+ Thêm nhiệm vụ” nếu muốn ôn nhẹ.
                  </Txt>
                </Card>
              ) : (
                dayActiveTasks.map((task) => {
                  const isDone = task.status === 'done';
                  const pMeta = PILLAR_META[task.pillar];
                  const reasonOpen = expandedReasonIds.has(task.id);
                  const menuOpen = openTaskMenuId === task.id;

                  return (
                    <Card
                      key={task.id}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: isDone ? c.ngoc : c.vien,
                        backgroundColor: isDone ? c.ngocNhat : c.the,
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: c.giay2,
                              borderWidth: 1,
                              borderColor: pMeta.color,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BookOpen size={17} color={pMeta.color} />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Txt f="bold" size={14} color={c.muc}>{task.title}</Txt>
                              {task.pinned ? <Chip text="📌 Đã ghim" bg={c.giay2} fg={c.muc2} /> : null}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Txt size={12} color={c.muc2}>{task.typeLabel}</Txt>
                              <Txt f="semibold" size={12} color={isDone ? c.ngocChu : c.muc3}>
                                {isDone ? 'Đã xong' : 'Chưa làm'}
                              </Txt>
                            </View>
                          </View>
                        </View>

                        {/* Nút Bắt đầu + Đánh dấu xong + ⋯ giống Ảnh 7 & 8 */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Btn
                            icon={Play}
                            title={task.kind === 'flashcard' ? 'Ôn ngay' : 'Bắt đầu'}
                            tone="ngoc"
                            size="sm"
                            onPress={() => handleStartTask(currentDay.date, task)}
                          />
                          <Btn
                            icon={Check}
                            title={isDone ? 'Đã xong' : 'Đánh dấu xong'}
                            tone="giay"
                            size="sm"
                            onPress={() => savePlan(toggleRoadmapTaskDone(plan, currentDay.date, task.id))}
                          />
                          <Pressable
                            onPress={() => setOpenTaskMenuId(menuOpen ? null : task.id)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: c.vien,
                              backgroundColor: c.the,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MoreHorizontal size={16} color={c.muc2} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Dòng "> Vì sao có nhiệm vụ này?" */}
                      <Pressable
                        onPress={() =>
                          setExpandedReasonIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id);
                            else next.add(task.id);
                            return next;
                          })
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <ChevronRight size={13} color={c.muc3} />
                        <Txt size={12} color={c.muc3}>Vì sao có nhiệm vụ này?</Txt>
                      </Pressable>
                      {reasonOpen ? (
                        <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.giay2, borderWidth: 1, borderColor: c.vien }}>
                          <Txt size={12} color={c.muc2}>{task.reason}</Txt>
                        </View>
                      ) : null}

                      {/* Menu của từng nhiệm vụ (⋯) giống hệt Ảnh 8 */}
                      {menuOpen ? (
                        <View
                          style={{
                            padding: 8,
                            borderRadius: 12,
                            backgroundColor: c.giay2,
                            borderWidth: 1,
                            borderColor: c.vien,
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          <Btn
                            icon={Check}
                            title={isDone ? 'Đánh dấu chưa làm' : 'Đánh dấu đã xong'}
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(toggleRoadmapTaskDone(plan, currentDay.date, task.id));
                              setOpenTaskMenuId(null);
                            }}
                          />
                          <Btn
                            icon={Pin}
                            title={task.pinned ? 'Bỏ ghim' : 'Ghim (AI không đổi)'}
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(toggleRoadmapTaskPin(plan, currentDay.date, task.id));
                              setOpenTaskMenuId(null);
                            }}
                          />
                          <Btn
                            icon={ArrowUp}
                            title="Lên trên"
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(moveRoadmapTaskOrder(plan, currentDay.date, task.id, -1));
                              setOpenTaskMenuId(null);
                            }}
                          />
                          <Btn
                            icon={ArrowDown}
                            title="Xuống dưới"
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(moveRoadmapTaskOrder(plan, currentDay.date, task.id, 1));
                              setOpenTaskMenuId(null);
                            }}
                          />
                          <Btn
                            icon={Calendar}
                            title="Chuyển sang ngày kế"
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(moveRoadmapTaskToNextDay(plan, currentDay.date, task.id));
                              setOpenTaskMenuId(null);
                              toast('Đã dời nhiệm vụ sang ngày học tiếp theo');
                            }}
                          />
                          <Btn
                            title="Bỏ qua nhiệm vụ"
                            tone="giay"
                            size="sm"
                            onPress={() => {
                              savePlan(removeOrSkipRoadmapTask(plan, currentDay.date, task.id, 'skip'));
                              setOpenTaskMenuId(null);
                            }}
                          />
                          <Btn
                            icon={Trash2}
                            title="Xoá nhiệm vụ"
                            tone="son"
                            size="sm"
                            onPress={() => {
                              savePlan(removeOrSkipRoadmapTask(plan, currentDay.date, task.id, 'delete'));
                              setOpenTaskMenuId(null);
                            }}
                          />
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              )}

              <View style={{ alignSelf: 'flex-start' }}>
                <Btn icon={Plus} title="Thêm nhiệm vụ" tone="giay" size="sm" onPress={() => setAddSheetOpen(true)} />
              </View>
            </>
          ) : null}

          {/* CHẾ ĐỘ XEM TUẦN */}
          {viewScope === 'week' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {plan.days.slice(Math.floor(selectedDayIdx / 7) * 7, Math.floor(selectedDayIdx / 7) * 7 + 7).map((d) => {
                const activeTasks = d.tasks.filter((t) => t.status !== 'skipped');
                const doneCnt = activeTasks.filter((t) => t.status === 'done').length;
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => {
                      setSelectedDayIdx(d.dayIndex - 1);
                      setViewScope('today');
                    }}
                    style={{
                      width: '48%',
                      flexGrow: 1,
                      minWidth: 220,
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: d.dayIndex - 1 === selectedDayIdx ? c.thuy : c.vien,
                      backgroundColor: c.the,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Txt f="bold" size={13.5} color={c.muc}>Ngày {d.dayIndex} · {d.date.slice(8, 10)}/{d.date.slice(5, 7)}</Txt>
                      <Chip
                        text={d.isRestDay ? '🛌 Nghỉ' : `${doneCnt}/${activeTasks.length} xong`}
                        bg={d.isRestDay ? c.giay2 : c.thuyNhat}
                        fg={d.isRestDay ? c.muc3 : c.thuyChu}
                      />
                    </View>
                    <Txt size={12} color={c.muc2} numberOfLines={2}>{d.themeTitle}</Txt>
                    <Txt size={11} color={c.muc3}>⏱ Kế hoạch {d.targetMinutes} phút</Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* CHẾ ĐỘ XEM THÁNG */}
          {viewScope === 'month' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {plan.days.map((d) => {
                const activeTasks = d.tasks.filter((t) => t.status !== 'skipped');
                const doneCnt = activeTasks.filter((t) => t.status === 'done').length;
                const pct = activeTasks.length ? Math.round((doneCnt / activeTasks.length) * 100) : 0;
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => {
                      setSelectedDayIdx(d.dayIndex - 1);
                      setViewScope('today');
                    }}
                    style={{
                      width: 112,
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: d.dayIndex - 1 === selectedDayIdx ? c.thuy : c.vien,
                      backgroundColor: pct === 100 ? c.ngocNhat : c.the,
                      gap: 3,
                    }}
                  >
                    <Txt f="bold" size={12} color={c.muc}>Ngày {d.dayIndex}</Txt>
                    <Txt size={11} color={c.muc3}>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</Txt>
                    <Txt f="semibold" size={11} color={d.isRestDay ? c.muc3 : c.thuyChu}>
                      {d.isRestDay ? 'Nghỉ' : `${d.targetMinutes}p · ${pct}%`}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* CỘT PHẢI: THẺ CHIẾN LƯỢC & PHÂN BỔ LUYỆN TẬP (ẢNH 7 & 8) */}
        <View style={{ flex: 1, minWidth: 270, gap: 12 }}>
          <Card style={{ padding: 16, borderRadius: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Compass size={16} color={c.thuyChu} />
                <Txt f="bold" size={14.5} color={c.muc}>Chiến lược</Txt>
              </View>
              <Chip
                text={plan.config.generationMode === 'ai_bkt' ? '✨ Lộ trình AI & BKT' : '🪄 Lộ trình cơ bản'}
                bg={c.thuyNhat}
                fg={c.thuyChu}
              />
            </View>

            <Txt size={12.5} color={c.muc2} style={{ lineHeight: 19 }}>
              {plan.strategySummary}
            </Txt>

            <View style={{ height: 1, backgroundColor: c.vien }} />

            <View style={{ gap: 8 }}>
              <Txt f="bold" size={13.5} color={c.muc}>Phân bổ luyện tập</Txt>
              <Txt size={11.5} color={c.muc3}>
                Tỷ lệ lượng bài luyện của mỗi chuyên đề (chuyên đề còn xa mục tiêu được ưu tiên luyện nhiều hơn).
              </Txt>
              {(['KC1', 'KC2', 'KC3', 'NV_NT'] as PillarKey[]).map((pKey) => {
                const meta = PILLAR_META[pKey];
                const w = plan.pillarWeights[pKey] ?? 25;
                return (
                  <View key={pKey} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt size={12} f="semibold" color={c.muc}>{meta.shortLabel}</Txt>
                      <Txt size={12} f="bold" color={c.muc2}>{w}%</Txt>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.vien, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.min(100, w)}%`, height: '100%', backgroundColor: meta.color }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          {onGoLearn ? (
            <Card style={{ padding: 16, borderRadius: 16, gap: 8 }}>
              <Chip text="🎁 Miễn phí trên Đông A" bg={c.ngocNhat} fg={c.ngocChu} />
              <Txt f="bold" size={14} color={c.muc}>Bản đồ Hành trình Ba lần Kháng chiến</Txt>
              <Txt size={12} color={c.muc2}>
                Kết hợp lộ trình ôn tập hằng ngày với bản đồ vượt cửa tương tác để nhận thêm XP và Huy hiệu.
              </Txt>
              <View style={{ alignSelf: 'flex-start' }}>
                <Btn icon={ArrowRight} title="Học ngay" tone="thuy" size="sm" onPress={() => onGoLearn()} />
              </View>
            </Card>
          ) : null}
        </View>
      </View>

      {/* MENU ⋯ GÓC TRÊN PHẢI CỦA LỘ TRÌNH (ẢNH 10: Chỉnh mục tiêu & lịch học / Xoá và tạo lộ trình mới) */}
      <Sheet
        open={headerMenuOpen}
        onClose={() => setHeaderMenuOpen(false)}
        title="Tùy chọn lộ trình"
      >
        <View style={{ gap: 10 }}>
          <Btn
            icon={Clock}
            title="Chỉnh mục tiêu & lịch học"
            tone="giay"
            onPress={() => {
              setHeaderMenuOpen(false);
              setQuickGoalEditOnly(true);
              setWizardStep(1);
              setStage('wizard');
            }}
          />
          <Btn
            icon={Trash2}
            title="Xoá và tạo lộ trình mới"
            tone="son"
            onPress={() => {
              setHeaderMenuOpen(false);
              savePlan(null);
              setConfig(createDefaultWizardConfig(bktData));
              setStage('landing');
              toast('Đã xoá lộ trình cũ. Bạn có thể lập lộ trình mới.');
            }}
          />
        </View>
      </Sheet>

      {/* SHEET THÊM NHIỆM VỤ MỚI VÀO NGÀY */}
      <Sheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title="Thêm nhiệm vụ vào ngày học"
        footer={
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Btn title="Hủy" tone="giay" onPress={() => setAddSheetOpen(false)} />
            <Btn
              title="Thêm vào ngày này"
              tone="ngoc"
              onPress={() => {
                if (!newTaskTitle.trim()) {
                  toast('Hãy nhập tên nhiệm vụ');
                  return;
                }
                savePlan(
                  addCustomRoadmapTask(plan, currentDay.date, {
                    title: newTaskTitle,
                    pillar: newTaskPillar,
                    minutes: Number(newTaskMinutes) || 15,
                  }),
                );
                setNewTaskTitle('');
                setAddSheetOpen(false);
              }}
            />
          </View>
        }
      >
        <View style={{ gap: 12 }}>
          <Field label="Tên nhiệm vụ *" value={newTaskTitle} onChangeText={setNewTaskTitle} placeholder="Ví dụ: Ôn 10 câu trận Bạch Đằng 1288" />
          <Field label="Thời lượng (phút)" value={newTaskMinutes} onChangeText={setNewTaskMinutes} keyboardType="numeric" />
          <View style={{ gap: 6 }}>
            <Txt f="semibold" size={13} color={c.muc}>Chuyên đề</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['KC1', 'KC2', 'KC3', 'NV_NT'] as PillarKey[]).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setNewTaskPillar(p)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: newTaskPillar === p ? c.thuy : c.vien,
                    backgroundColor: newTaskPillar === p ? c.thuyNhat : c.the,
                  }}
                >
                  <Txt f="semibold" size={12.5} color={newTaskPillar === p ? c.thuyChu : c.muc}>
                    {PILLAR_META[p].shortLabel}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Sheet>
    </ScrollView>
  );
};
