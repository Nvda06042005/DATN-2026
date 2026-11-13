/**
 * Trình phát bài mẫu CHỈ dùng ở local (__DEV__) khi xem bản demo lộ trình:
 * cho phép đọc thẻ kiến thức ngắn, chọn đáp án trắc nghiệm và trải nghiệm trọn vẹn
 * luồng ăn mừng 3 bước kiểu Duolingo mà không cần tạo dữ liệu trên server.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CheckCircle2, Heart, XCircle } from 'lucide-react-native';
import { LessonCelebrationView } from '@/components/portal/LessonCelebrationView';
import { Bar, Btn, Card, Chip, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { accuracyTagFor, computeQuestDeltas, type QuestDeltaItem } from '@/lib/learning-celebration';
import { completeDemoNode, getDemoLessonScript } from '@/lib/learning-path-demo';
import type { NodeResult, PathNode } from '@/types/learning';

export const DemoActivityPlayer: React.FC<{
  node: PathNode;
  onClose: () => void;
}> = ({ node, onClose }) => {
  const { c } = useTheme();
  const script = useMemo(() => getDemoLessonScript(node), [node]);
  const totalSteps = script.cards.length + script.questions.length;

  const isChest = node.kind === 'chest';
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [firstTryRight, setFirstTryRight] = useState(0);
  const [hadWrongOnCurrent, setHadWrongOnCurrent] = useState(false);
  const startedAt = useRef(Date.now());

  const [celebration, setCelebration] = useState<{
    deltas: QuestDeltaItem[];
    nodeResult: NodeResult;
    xpEarned: number;
    accuracy: number;
    elapsedMs: number;
  } | null>(() => {
    if (!isChest) return null;
    const xpEarned = node.reward_points || 50;
    const res = completeDemoNode({ node, xpEarned, correctCount: 1 });
    return {
      deltas: computeQuestDeltas(res.beforeQuests, res.afterQuests),
      nodeResult: res.nodeResult,
      xpEarned,
      accuracy: 100,
      elapsedMs: 0,
    };
  });

  if (celebration) {
    return (
      <LessonCelebrationView
        skipSummary={isChest}
        summary={{
          headline: node.kind === 'quiz' || node.kind === 'gate_test' ? 'Hoàn thành thử thách!' : 'Hoàn thành bài học!',
          subtitle: `${node.title} (bản xem trước local)`,
          xpEarned: celebration.xpEarned,
          accuracyPercent: celebration.accuracy,
          accuracyTag: accuracyTagFor(celebration.accuracy, true),
          stars: celebration.accuracy >= 90 ? 3 : celebration.accuracy >= 70 ? 2 : 1,
          elapsedMs: celebration.elapsedMs,
          nextNodeTitle: celebration.nodeResult.next_node?.title ?? null,
        }}
        questDeltas={celebration.deltas}
        nodeResult={celebration.nodeResult}
        onDone={onClose}
      />
    );
  }

  const isCard = step < script.cards.length;
  const card = isCard ? script.cards[step] : null;
  const question = !isCard ? script.questions[step - script.cards.length] : null;
  const isCorrect = question !== null && picked === question.correctIndex;

  const checkQuestion = () => {
    if (!question || picked === null) return;
    setChecked(true);
    if (picked === question.correctIndex) {
      if (!hadWrongOnCurrent) setFirstTryRight((n) => n + 1);
    } else {
      setHadWrongOnCurrent(true);
    }
  };

  const retryQuestion = () => {
    setChecked(false);
    setPicked(null);
  };

  const advance = () => {
    if (step + 1 < totalSteps) {
      setStep((s) => s + 1);
      setPicked(null);
      setChecked(false);
      setHadWrongOnCurrent(false);
      return;
    }
    const accuracy = script.questions.length
      ? Math.round((firstTryRight / script.questions.length) * 100)
      : 100;
    const xpEarned = node.reward_points || 100;
    const res = completeDemoNode({
      node,
      xpEarned,
      correctCount: script.questions.length,
    });
    setCelebration({
      deltas: computeQuestDeltas(res.beforeQuests, res.afterQuests),
      nodeResult: res.nodeResult,
      xpEarned,
      accuracy,
      elapsedMs: Date.now() - startedAt.current,
    });
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.giay }}>
        <View
          style={{
            minHeight: 56,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: c.the,
            borderBottomWidth: 2,
            borderBottomColor: c.vien,
          }}
        >
          <Btn icon={ArrowLeft} label="Thoát bài học mẫu" tone="ghost" size="sm" onPress={onClose} />
          <Txt f="bold" size={15} numberOfLines={1} style={{ flex: 1 }}>
            {node.title}
          </Txt>
          <Chip text="Xem trước" bg={c.vangNhat} fg={c.vangChu} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 56,
            maxWidth: 760,
            width: '100%',
            alignSelf: 'center',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Bar value={step} max={totalSteps} height={12} fill={c.ngoc} label={`Bước ${step + 1} trên ${totalSteps}`} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Heart size={20} color={c.son} fill={c.son} />
              <Txt f="display" size={16}>5</Txt>
            </View>
          </View>

          <Txt size={12} color={c.muc3}>
            Bước {step + 1}/{totalSteps} · hoàn thành để xem hiệu ứng 3 bước sau bài học
          </Txt>

          {card ? (
            <View style={{ gap: 16 }}>
              {step === 0 ? (
                <View style={{ gap: 6 }}>
                  <Txt f="displayHeavy" size={26}>{node.title}</Txt>
                  <Txt size={15} color={c.muc2}>{script.summary}</Txt>
                </View>
              ) : null}
              <Card pad={18} style={{ gap: 8 }}>
                <Txt f="displayHeavy" size={20}>{card.heading}</Txt>
                <Txt size={16} style={{ lineHeight: 26 }}>{card.text}</Txt>
              </Card>
              <Btn title="Tiếp tục" tone="ngoc" size="lg" full onPress={advance} testID="demo-step-next" />
            </View>
          ) : null}

          {question ? (
            <View style={{ gap: 14 }}>
              <Chip text="Kiểm tra nhanh" bg={c.thuyNhat} fg={c.thuyChu} style={{ alignSelf: 'flex-start' }} />
              <Txt f="bold" size={19}>{question.prompt}</Txt>

              <View style={{ gap: 10 }}>
                {question.options.map((opt, idx) => {
                  const selected = picked === idx;
                  const bg = checked
                    ? idx === question.correctIndex
                      ? c.ngocNhat
                      : selected
                        ? c.sonNhat
                        : c.the
                    : selected
                      ? c.thuyNhat
                      : c.the;
                  const border = checked
                    ? idx === question.correctIndex
                      ? c.ngoc
                      : selected
                        ? c.son
                        : c.vien
                    : selected
                      ? c.thuy
                      : c.vien;
                  return (
                    <Pressable
                      key={idx}
                      disabled={checked && isCorrect}
                      onPress={() => !checked && setPicked(idx)}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: border,
                        backgroundColor: bg,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Txt f={selected ? 'bold' : 'medium'} size={15} color={c.muc} style={{ flex: 1 }}>
                        {opt}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>

              {checked ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: isCorrect ? c.ngocNhat : c.sonNhat,
                  }}
                >
                  {isCorrect ? <CheckCircle2 size={22} color={c.ngocChu} /> : <XCircle size={22} color={c.sonChu} />}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt f="bold" size={16} color={isCorrect ? c.ngocChu : c.sonChu}>
                      {isCorrect ? 'Chính xác!' : 'Chưa đúng, em thử lại nhé.'}
                    </Txt>
                    <Txt size={14} color={c.muc}>{question.explanation}</Txt>
                  </View>
                </View>
              ) : null}

              {!checked ? (
                <Btn title="Kiểm tra" tone="dong" size="lg" full disabled={picked === null} onPress={checkQuestion} testID="demo-check" />
              ) : isCorrect ? (
                <Btn
                  title={step + 1 >= totalSteps ? 'Hoàn thành bài' : 'Tiếp tục'}
                  tone="ngoc"
                  size="lg"
                  full
                  onPress={advance}
                  testID="demo-finish"
                />
              ) : (
                <Btn title="Thử lại" tone="son" size="lg" full onPress={retryQuestion} />
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
