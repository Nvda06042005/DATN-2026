/**
 * Thẻ tương tác kiểu Duolingo khi chạm vào một nút hoặc rương trên lộ trình:
 *  - Áp dụng đúng bảng màu của Cửa hiện tại.
 *  - Tải chi tiết nút từ máy chủ (mục tiêu, số câu, điểm XP, Binh thư, tư liệu mở khóa, màn Ra trận bằng thẻ tướng).
 *  - Nút hành động nổi khối 3D màu trắng trên nền màu Cửa ("Bắt đầu +50 XP", "Ôn tập", "Mở rương", ...).
 */
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { BookOpen, Lock, Play, RotateCcw, Sparkles, Swords, X } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { STATE_TEXT, type NodeActions } from '@/components/portal/QuestMap';
import { Chip, InfoNote, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { nodeActionLabel, type UnitTheme } from '@/lib/learning-path';
import { buildDemoNodeDetail, isDemoNodeId } from '@/lib/learning-path-demo';
import type { NodeDetail, PathNode } from '@/types/learning';

interface PathNodePopoverProps {
  session: Session;
  node: PathNode;
  gateTitle: string;
  gateNo: number;
  theme: UnitTheme;
  refreshKey: number;
  actions: NodeActions;
  onStartDemo?: (node: PathNode) => void;
  onClose: () => void;
}

export const PathNodePopover: React.FC<PathNodePopoverProps> = ({
  session,
  node,
  gateTitle,
  gateNo,
  theme,
  refreshKey,
  actions,
  onStartDemo,
  onClose,
}) => {
  const { c, dark } = useTheme();
  const demo = __DEV__ && isDemoNodeId(node.id);
  const detail = useLoad(
    () => (demo ? Promise.resolve(buildDemoNodeDetail(node, gateTitle)) : api.nodeDetail(session.token, node.id)),
    [session.token, node.id, refreshKey, demo, gateTitle],
    session.expired,
  );
  const d = detail.data;
  const locked = (d?.state ?? node.state) === 'locked';
  const done = (d?.state ?? node.state) === 'done';

  const start = (item: NodeDetail) => {
    if (demo && onStartDemo) {
      onClose();
      onStartDemo(node);
      return;
    }
    const ref = { id: item.id, title: item.title };
    onClose();
    if (item.kind === 'lesson') actions.onLesson(ref);
    else if (item.kind === 'listen') actions.onListen(ref);
    else if (item.kind === 'chest') actions.onChest(ref);
    else if (item.kind === 'battle' && item.has_sim && item.scenario_id) actions.onSim({ ...ref, scenarioId: item.scenario_id });
    else if (item.needs_quiz) actions.onQuiz(ref);
    else if (item.kind === 'battle' && item.content?.battle) actions.onRead({ ...ref, kind: 'battle', refId: item.content.battle.id, done: item.state === 'done' });
    else if (item.kind === 'source' && item.content?.source) actions.onRead({ ...ref, kind: 'source', refId: item.content.source.id, done: item.state === 'done' });
  };

  const cardBg = locked ? (dark ? '#1f2937' : '#64748b') : theme.bg;
  const cardEdge = locked ? (dark ? '#0f172a' : '#475569') : theme.edge;
  const actionDisabled = !d || !d.can_start || (d.kind === 'chest' && done);
  const ctaText = d ? (d.state === 'done' || d.state === 'locked' ? nodeActionLabel(d) : `${nodeActionLabel(d)} · +${d.reward_points} XP`) : 'Đang tải…';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.scrim,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <Pressable accessibilityLabel="Đóng thẻ bài học" onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        <View
          accessibilityRole="summary"
          testID="path-node-popover"
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 24,
            backgroundColor: cardBg,
            borderWidth: 2,
            borderColor: cardEdge,
            borderBottomWidth: 6,
            padding: 20,
            gap: 14,
          }}
        >
          {/* Phần đầu thẻ màu theo Cửa */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt f="bold" size={12} color="rgba(255,255,255,0.88)" upper>
                Cửa {gateNo} · {node.kind_label} · {STATE_TEXT[d?.state ?? node.state]}
              </Txt>
              <Txt f="displayHeavy" size={21} color="#ffffff">
                {d?.title ?? node.title}
              </Txt>
              <Txt size={13} color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {gateTitle}
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              testID="node-close"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <X size={18} color="#ffffff" />
            </Pressable>
          </View>

          <ErrorNote message={detail.error} />
          {detail.loading && !d ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Spinner label="Đang tải thông tin bài…" />
            </View>
          ) : null}

          {d ? (
            <View
              style={{
                backgroundColor: dark ? 'rgba(11,18,32,0.88)' : 'rgba(255,253,247,0.96)',
                borderRadius: 16,
                padding: 14,
                gap: 10,
              }}
            >
              {d.objective ? <Txt size={14} color={c.muc}>{d.objective}</Txt> : null}
              {d.hint ? <InfoNote>{d.hint}</InfoNote> : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {done ? <Stars n={d.stars} size={18} /> : null}
                <Chip text={`+${d.reward_points} XP`} bg={c.dongNhat} fg={c.dongChu} icon={Sparkles} />
                {d.reward_binh_thu ? <Chip text={`+${d.reward_binh_thu} Binh thư`} bg={c.thuyNhat} fg={c.thuyChu} icon={BookOpen} /> : null}
                {d.reward_gold ? <Chip text={`+${d.reward_gold} vàng`} bg={c.vangNhat} fg={c.vangChu} /> : null}
                {d.question_count ? <Chip text={`${d.question_count} câu hỏi`} bg={c.dichNhat} fg={c.dich} /> : null}
              </View>

              {d.content?.lesson ? (
                <Txt size={13} color={c.muc2}>
                  Bài đọc khoảng {d.content.lesson.read_minutes} phút, xen kẽ thẻ kiến thức và câu kiểm tra nhanh.
                </Txt>
              ) : null}
              {(d.kind === 'practice' || d.kind === 'gate_test') && !d.content?.quiz ? (
                <Txt size={13} color={c.muc2}>
                  {d.kind === 'gate_test'
                    ? `Đạt từ ${d.pass_percent ?? 70}% trở lên để qua Cửa và mở Cửa tiếp theo.`
                    : 'Ôn tập câu hỏi trong Cửa. Trả lời sai không bị mất tim.'}
                </Txt>
              ) : null}
              {d.content?.quiz ? (
                <Txt size={13} color={c.muc2}>
                  {d.content.quiz.questions} câu · cần đạt {d.pass_percent ?? d.content.quiz.pass_percent}% để hoàn thành.
                </Txt>
              ) : null}
              {d.content?.battle ? (
                <Txt size={13} color={c.muc2}>
                  Trận đánh: {d.content.battle.name} ({d.content.battle.year})
                </Txt>
              ) : null}
              {d.unlocks.length ? (
                <View style={{ gap: 4 }}>
                  <Txt f="semibold" size={12} color={c.muc3}>
                    Tư liệu mở khóa
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {d.unlocks.map((u) => (
                      <Chip
                        key={u.id}
                        text={u.unlocked ? `${u.title} · đã mở` : u.title}
                        bg={u.unlocked ? c.ngocNhat : c.dongNhat}
                        fg={u.unlocked ? c.ngocChu : c.dongChu}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Nút hành động nổi khối trắng đặc trưng Duolingo */}
          {d ? (
            <View style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ctaText}
                disabled={actionDisabled}
                onPress={() => start(d)}
                testID="node-start"
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: actionDisabled ? 'rgba(255,255,255,0.22)' : '#ffffff',
                  borderBottomWidth: actionDisabled ? 2 : pressed ? 2 : 5,
                  borderBottomColor: actionDisabled ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.22)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingHorizontal: 18,
                })}
              >
                {locked ? (
                  <Lock size={18} color="#ffffff" />
                ) : done ? (
                  <RotateCcw size={18} color={theme.textLight} />
                ) : (
                  <Play size={18} color={theme.textLight} fill={theme.textLight} />
                )}
                <Txt f="displayHeavy" size={15} color={actionDisabled ? '#ffffff' : theme.textLight} upper>
                  {ctaText}
                </Txt>
              </Pressable>

              {d.stage_id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ra trận bằng thẻ tướng"
                  onPress={() => {
                    onClose();
                    actions.onStage(d.stage_id!, d.march);
                  }}
                  testID="node-stage"
                  style={({ pressed }) => ({
                    minHeight: 42,
                    borderRadius: 14,
                    backgroundColor: pressed ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.35)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingHorizontal: 14,
                  })}
                >
                  <Swords size={16} color="#ffffff" />
                  <Txt f="bold" size={14} color="#ffffff">
                    Ra trận bằng thẻ tướng
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
