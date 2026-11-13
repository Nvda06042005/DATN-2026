/**
 * Màn ăn mừng kết thúc bài học kiểu Duolingo gồm tối đa 3 bước chuyển tiếp qua nút "TIẾP TỤC":
 *  1. Tổng kết bài học (linh vật + pháo hoa, thẻ Tổng điểm XP & Độ chính xác).
 *  2. Tiến độ Nhiệm vụ hôm nay (thanh tiến độ chạy mượt từ giá trị cũ -> mới + rương thưởng cuối thanh).
 *  3. Mở rương nhận thưởng (rương báu mở nắp tràn đá quý + tổng vàng / Binh thư / mảnh thẻ).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { BookOpen, Flame, ListChecks, RotateCcw, Sparkles, Swords, Target, Zap } from 'lucide-react-native';
import { Mascot } from '@/components/art';
import { FireworkBurstArt, OpenGemChestArt, QuestChestBadge } from '@/components/portal/PathArt';
import { Btn, Chip, Stars, Txt } from '@/components/ui';
import { ON_BRIGHT } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import {
  buildCelebrationSteps,
  chestPrimaryHeadline,
  formatClockMs,
  questsStepHeadline,
  summarizeEarnedRewards,
  type CelebrationStep,
  type CelebrationSummaryData,
  type EarnedRewardsSummary,
  type QuestDeltaItem,
} from '@/lib/learning-celebration';
import type { NodeResult } from '@/types/learning';

export interface LessonCelebrationProps {
  summary: CelebrationSummaryData;
  questDeltas: QuestDeltaItem[];
  nodeResult?: NodeResult | null;
  extraGold?: number;
  skipSummary?: boolean;
  extraLinks?: Array<{ ref_type: string; ref_id: number; label?: string | null }>;
  onOpenLink?: (type: string, id: number) => void;
  onReview?: () => void;
  onRetry?: () => void;
  continueLabel?: string;
  onDone: () => void;
}

const USE_NATIVE = Platform.OS !== 'web';

/** Thanh tiến độ nhiệm vụ tự động chạy mượt từ giá trị cũ sang giá trị mới */
const AnimatedQuestRow: React.FC<{
  quest: QuestDeltaItem;
  tier: 0 | 1 | 2;
  reduceMotion: boolean;
}> = ({ quest, tier, reduceMotion }) => {
  const { c, dark } = useTheme();
  const prevRatio = Math.min(1, Math.max(0, quest.prevProgress / Math.max(1, quest.target)));
  const nextRatio = Math.min(1, Math.max(0, quest.nextProgress / Math.max(1, quest.target)));
  const anim = useRef(new Animated.Value(reduceMotion ? nextRatio : prevRatio)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(nextRatio);
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: nextRatio,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 180);
    return () => clearTimeout(timer);
  }, [anim, nextRatio, reduceMotion]);

  const widthPct = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const icon = (() => {
    if (quest.metric === 'xp_earned') return <Zap size={24} color="#ffc800" fill="#ffc800" />;
    if (quest.metric === 'perfect_quizzes') return <Target size={24} color="#58cc02" />;
    if (quest.metric === 'battles_completed') return <Swords size={24} color="#ff9600" />;
    if (quest.metric === 'lessons_completed' || quest.metric === 'correct_answers') {
      return <Mascot size={32} mood="happy" accessory="none" />;
    }
    return <Flame size={24} color="#ff9600" fill="#ff9600" />;
  })();

  const done = quest.justCompleted || quest.alreadyDone || quest.nextProgress >= quest.target;

  return (
    <View
      testID={`celebration-quest-${quest.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: quest.justCompleted ? '#ffc800' : c.vien,
        backgroundColor: c.the,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : c.the2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Txt f="bold" size={15} color={c.muc} style={{ flex: 1 }}>
            {quest.title}
          </Txt>
          {quest.justCompleted ? (
            <Chip
              text={quest.rewardGold ? `+${quest.rewardGold} vàng` : 'Hoàn thành!'}
              bg={c.vangNhat}
              fg={c.vangChu}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: quest.target, now: quest.nextProgress }}
            style={{
              flex: 1,
              height: 22,
              borderRadius: 999,
              backgroundColor: dark ? '#263449' : c.vien,
              overflow: 'hidden',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: widthPct,
                borderRadius: 999,
                backgroundColor: '#ffc800',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  top: 4,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.38)',
                }}
              />
            </Animated.View>
            <Txt
              f="bold"
              size={12}
              center
              color={nextRatio > 0.45 ? ON_BRIGHT : c.muc2}
              style={{ zIndex: 1 }}
            >
              {quest.nextProgress} / {quest.target}
            </Txt>
          </View>

          <QuestChestBadge tier={tier} done={done} highlight={quest.justCompleted} size={32} />
        </View>
      </View>
    </View>
  );
};

export const LessonCelebrationView: React.FC<LessonCelebrationProps> = ({
  summary,
  questDeltas,
  nodeResult,
  extraGold = 0,
  skipSummary = false,
  extraLinks = [],
  onOpenLink,
  onReview,
  onRetry,
  continueLabel,
  onDone,
}) => {
  const { c, dark } = useTheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 600;

  const rewards: EarnedRewardsSummary = useMemo(
    () => summarizeEarnedRewards({ nodeResult, questDeltas, extraGold }),
    [nodeResult, questDeltas, extraGold],
  );
  const steps: CelebrationStep[] = useMemo(
    () => buildCelebrationSteps({ skipSummary, questDeltas, rewards }),
    [skipSummary, questDeltas, rewards],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];

  const bounce = useRef(new Animated.Value(reduceMotion ? 1 : 0.86)).current;
  useEffect(() => {
    if (reduceMotion) {
      bounce.setValue(1);
      return;
    }
    bounce.setValue(0.86);
    Animated.spring(bounce, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: USE_NATIVE,
    }).start();
  }, [currentStep, bounce, reduceMotion]);

  const handleContinue = () => {
    if (stepIndex + 1 < steps.length) {
      setStepIndex((i) => i + 1);
    } else {
      onDone();
    }
  };

  const goldColor = dark ? '#ffc800' : '#d97706';
  const greenColor = '#58cc02';
  const greenEdge = '#3f9a00';
  const chestHeroColor = dark ? '#38bdf8' : '#0284c7';

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onDone}>
      <View
        testID="lesson-celebration-view"
        style={{
          flex: 1,
          backgroundColor: dark ? '#131f24' : c.giay,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 32,
          }}
        >
          <View style={{ width: '100%', maxWidth: 520, alignItems: 'center', gap: 22 }}>
            {currentStep === 'summary' ? (
              <Animated.View
                testID="celebration-step-summary"
                style={{
                  width: '100%',
                  alignItems: 'center',
                  gap: 18,
                  transform: [{ scale: bounce }],
                }}
              >
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <FireworkBurstArt size={56} />
                  <Mascot
                    size={132}
                    mood={summary.passed === false ? 'thinking' : 'excited'}
                    accessory="crown"
                    bob={!reduceMotion}
                  />
                </View>

                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Txt
                    f="displayHeavy"
                    size={wide ? 32 : 27}
                    color={summary.passed === false ? c.sonChu : goldColor}
                    center
                    accessibilityRole="header"
                  >
                    {summary.headline}
                  </Txt>
                  {summary.subtitle ? (
                    <Txt size={15} color={c.muc2} center>
                      {summary.subtitle}
                    </Txt>
                  ) : null}
                </View>

                {/* Hai thẻ chỉ số cạnh nhau đúng mẫu Duolingo: Tổng điểm XP & Chính xác */}
                <View style={{ flexDirection: 'row', gap: 14, width: '100%', maxWidth: 380 }}>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      borderWidth: 2,
                      borderColor: '#ffc800',
                      backgroundColor: '#ffc800',
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ paddingVertical: 6, alignItems: 'center' }}>
                      <Txt f="displayHeavy" size={11} color={ON_BRIGHT} upper>
                        Tổng điểm XP
                      </Txt>
                    </View>
                    <View
                      style={{
                        backgroundColor: dark ? '#131f24' : c.the,
                        borderRadius: 14,
                        margin: 2,
                        marginTop: 0,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Zap size={22} color="#ffc800" fill="#ffc800" />
                      <Txt f="displayHeavy" size={22} color={dark ? '#ffc800' : c.dongChu}>
                        {summary.xpEarned}
                      </Txt>
                    </View>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      borderWidth: 2,
                      borderColor: summary.passed === false ? c.son : greenColor,
                      backgroundColor: summary.passed === false ? c.son : greenColor,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ paddingVertical: 6, alignItems: 'center' }}>
                      <Txt f="displayHeavy" size={11} color={summary.passed === false ? '#ffffff' : ON_BRIGHT} upper>
                        {summary.accuracyTag}
                      </Txt>
                    </View>
                    <View
                      style={{
                        backgroundColor: dark ? '#131f24' : c.the,
                        borderRadius: 14,
                        margin: 2,
                        marginTop: 0,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Target size={22} color={summary.passed === false ? c.sonChu : greenColor} />
                      <Txt f="displayHeavy" size={22} color={summary.passed === false ? c.sonChu : c.ngocChu}>
                        {summary.accuracyPercent}%
                      </Txt>
                    </View>
                  </View>
                </View>

                {/* Huy hiệu sao / thời gian / nút mở tiếp */}
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                    {typeof summary.stars === 'number' && summary.stars > 0 ? <Stars n={summary.stars} size={24} /> : null}
                    {typeof summary.elapsedMs === 'number' ? (
                      <Chip text={`Thời gian ${formatClockMs(summary.elapsedMs)}`} bg={c.the2} fg={c.muc2} />
                    ) : null}
                  </View>

                  {summary.journeyCompleted ? (
                    <Chip text="Em đã hoàn thành cả hành trình!" bg={c.ngocNhat} fg={c.ngocChu} icon={Sparkles} />
                  ) : summary.nextNodeTitle ? (
                    <Txt size={14} color={c.muc2} center>
                      Nút tiếp theo đã mở: <Txt f="bold" size={14} color={c.muc}>{summary.nextNodeTitle}</Txt>
                    </Txt>
                  ) : null}

                  {extraLinks.length && onOpenLink ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                      {extraLinks.map((l) => (
                        <Btn
                          key={`${l.ref_type}-${l.ref_id}`}
                          title={l.label ?? l.ref_type}
                          tone="thuy"
                          size="sm"
                          disabled={l.ref_type === 'campaign'}
                          onPress={() => onOpenLink(l.ref_type, l.ref_id)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            {currentStep === 'quests' ? (
              <Animated.View
                testID="celebration-step-quests"
                style={{
                  width: '100%',
                  alignItems: 'center',
                  gap: 18,
                  transform: [{ scale: bounce }],
                }}
              >
                <Txt f="displayHeavy" size={wide ? 30 : 25} color={goldColor} center accessibilityRole="header">
                  {questsStepHeadline(questDeltas)}
                </Txt>
                <View style={{ width: '100%', gap: 12 }}>
                  {questDeltas.slice(0, 3).map((q, idx) => (
                    <AnimatedQuestRow
                      key={q.id}
                      quest={q}
                      tier={(idx % 3) as 0 | 1 | 2}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {currentStep === 'chest' ? (
              <Animated.View
                testID="celebration-step-chest"
                style={{
                  width: '100%',
                  alignItems: 'center',
                  gap: 16,
                  transform: [{ scale: bounce }],
                }}
              >
                <Txt f="displayHeavy" size={wide ? 34 : 28} color={chestHeroColor} center accessibilityRole="header">
                  {chestPrimaryHeadline(rewards)}
                </Txt>
                <OpenGemChestArt size={158} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {rewards.questBonusXp > 0 ? (
                    <Chip text={`+${rewards.questBonusXp} XP nhiệm vụ`} bg={c.dongNhat} fg={c.dongChu} icon={Zap} />
                  ) : null}
                  {rewards.totalBinhThu > 0 ? (
                    <Chip text={`+${rewards.totalBinhThu} Binh thư`} bg={c.thuyNhat} fg={c.thuyChu} icon={BookOpen} />
                  ) : null}
                  {rewards.badge ? (
                    <Chip text={`Huy hiệu: ${rewards.badge}`} bg={c.vangNhat} fg={c.vangChu} icon={Sparkles} />
                  ) : null}
                  {rewards.card ? <Chip text="+1 Thẻ nhân vật" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
                  {rewards.fragments.map((f, i) => (
                    <Chip
                      key={i}
                      text={`${f.qty} mảnh thẻ ${f.card}${f.merged ? ' (đã ghép!)' : ''}`}
                      bg={c.thongNhat}
                      fg={c.thongChu}
                    />
                  ))}
                </View>
                {rewards.unlockedSources.length && onOpenLink ? (
                  <View style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Txt f="bold" size={14} color={c.muc2}>
                      Tư liệu lịch sử vừa mở khóa
                    </Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {rewards.unlockedSources.map((s) => (
                        <Btn key={s.id} title={s.title} tone="dong" size="sm" onPress={() => { onDone(); onOpenLink('source', s.id); }} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        </ScrollView>

        {/* Thanh đáy cố định chuẩn Duolingo với nút TIẾP TỤC nổi khối */}
        <View
          style={{
            borderTopWidth: 2,
            borderTopColor: c.vien,
            backgroundColor: dark ? '#131f24' : c.the,
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 860,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {currentStep === 'summary' && onReview ? (
                <Btn icon={ListChecks} title="Xem lại từng câu" tone="giay" size="md" onPress={onReview} testID="celebration-review" />
              ) : null}
              {currentStep === 'summary' && onRetry ? (
                <Btn icon={RotateCcw} title="Làm lại" tone="dong" size="md" onPress={onRetry} testID="celebration-retry" />
              ) : null}
              {steps.length > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {steps.map((s, idx) => (
                    <View
                      key={s}
                      style={{
                        width: idx === stepIndex ? 20 : 8,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: idx <= stepIndex ? greenColor : c.vien2,
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={continueLabel ?? 'Tiếp tục'}
              onPress={handleContinue}
              testID="celebration-continue"
              style={({ pressed }) => ({
                minWidth: 164,
                minHeight: 48,
                paddingHorizontal: 26,
                borderRadius: 16,
                backgroundColor: greenColor,
                borderBottomWidth: pressed ? 2 : 5,
                borderBottomColor: greenEdge,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <Txt f="displayHeavy" size={15} color={ON_BRIGHT} upper>
                {stepIndex + 1 < steps.length ? 'TIẾP TỤC' : (continueLabel ?? 'TIẾP TỤC')}
              </Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
