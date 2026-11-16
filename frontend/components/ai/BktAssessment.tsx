/**
 * Đánh giá năng lực của học sinh (BKT – Bayesian Knowledge Tracing) ở mục Hỏi Tiểu Tướng (16/11/2026).
 * Lấy đúng khối "Chẩn đoán Năng lực BKT & Chủ điểm cần ôn" và bảng "Cơ chế AI Theo dõi Năng lực (BKT)" của `AiHubDashboard.tsx`
 * (nhánh feat/ai-engine-and-api-integration, commit 9f82487), dùng nguyên API `/api/ai/bkt-recommendations` sẵn có; không lấy Lộ trình cá nhân hóa,
 * Flash Cards hay các nút Luyện ngay / Học ngay (gắn với màn học cũ đã gỡ). Nút "Hỏi Tiểu Tướng" mở mục Hỏi đáp với câu hỏi về chủ điểm đó.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BookOpen, Info, RefreshCw, Sparkles, Target } from 'lucide-react-native';
import * as aiApi from '@/api/aiApi';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BktRecommendationItem, BktRecommendationsResponse } from '@/types/ai';

export const BktAssessment: React.FC<{ session: Session; onAsk: (question: string) => void }> = ({ session, onAsk }) => {
  const { c } = useTheme();
  const [bktData, setBktData] = useState<BktRecommendationsResponse | null>(null);
  const [bktLoading, setBktLoading] = useState<boolean>(false);
  const [bktExplainerOpen, setBktExplainerOpen] = useState<boolean>(false);

  const loadBktRecommendations = useCallback(async () => {
    setBktLoading(true);
    try {
      const res = await aiApi.aiBktRecommendations(session.token, 6);
      setBktData(res);
    } catch {
      // Bỏ qua nếu chưa có dữ liệu
    } finally {
      setBktLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    loadBktRecommendations();
  }, [loadBktRecommendations]);

  const handleAskFromBkt = (rec: BktRecommendationItem) => onAsk(`Giải thích chi tiết giúp em về chủ đề: ${rec.topic}`);

  const recs = bktData?.recommendations ?? [];
  const params = bktData?.bkt_parameters ?? { p_l0: 0.3, p_t: 0.15, p_g: 0.25, p_s: 0.1, mastery_threshold: 0.6 };
  const summary = bktData?.profile_summary;

  return (
    <View style={{ gap: 14 }} testID="bkt-assessment">
      {/* CHẨN ĐOÁN NĂNG LỰC BKT & CHỦ ĐIỂM GỢI Ý */}
      <Card style={{ padding: 18, gap: 14, borderRadius: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
              <Target size={19} color={c.dongChu} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Txt f="bold" size={16} color={c.muc} accessibilityRole="header">
                  Chẩn đoán Năng lực BKT & Chủ điểm cần ôn
                </Txt>
                {bktData?.profile?.mastery_rank ? (
                  <Chip text={bktData.profile.mastery_rank} bg={c.thuyNhat} fg={c.thuyChu} />
                ) : null}
              </View>
              <Txt size={12} color={c.muc2}>
                Đọc trực tiếp từ tiến độ làm bài và gợi ý các chủ điểm lịch sử cần củng cố
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn icon={Info} title="Cơ chế BKT" tone="giay" size="sm" onPress={() => setBktExplainerOpen(true)} testID="bkt-explain" />
            <Btn icon={RefreshCw} title="Làm mới" tone="giay" size="sm" loading={bktLoading} onPress={loadBktRecommendations} testID="bkt-refresh" />
          </View>
        </View>

        {summary ? (
          <View
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: summary.has_activity ? c.giay2 : c.vangNhat,
              borderWidth: 1,
              borderColor: c.vien,
              gap: 6,
            }}
          >
            <Txt size={12} f="semibold" color={c.muc2}>
              {summary.has_activity
                ? `Hồ sơ AI đang đọc từ tiến độ của em${summary.grade ? ` (Lớp ${summary.grade})` : ''}:`
                : 'Chưa có lượt làm bài — đang hiển thị các chủ điểm khởi động để AI đo năng lực thật:'}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {summary.has_activity ? (
                <>
                  <Chip text={`Chính xác: ${summary.accuracy ?? 0}% (${summary.answered ?? 0} câu)`} bg={c.thuyNhat} fg={c.thuyChu} />
                  <Chip text={`Chuỗi ${summary.streak_current ?? 0} ngày`} bg={c.ngocNhat} fg={c.ngocChu} />
                  {(summary.weak_topics_count ?? 0) > 0 ? (
                    <Chip text={`${summary.weak_topics_count} chủ đề cần ôn`} bg={c.dongNhat} fg={c.dongChu} />
                  ) : null}
                  {(summary.wrong_questions_count ?? 0) > 0 ? (
                    <Chip text={`${summary.wrong_questions_count} câu sai chưa gỡ`} bg={c.sonNhat} fg={c.sonChu} />
                  ) : null}
                </>
              ) : null}
              {summary.upcoming_assignment ? (
                <Chip
                  text={`Sắp thi: ${summary.upcoming_assignment.title} (còn ${summary.upcoming_assignment.days_left} ngày)`}
                  bg={c.sonNhat}
                  fg={c.sonChu}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {bktLoading && !recs.length ? (
          <Spinner label="Đang tải đánh giá năng lực…" />
        ) : recs.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} testID="bkt-topics">
            {recs.slice(0, 4).map((rec) => {
              const masteryVal = rec.current_mastery ?? rec.current_p_l ?? 0.3;
              const pct = Math.round(masteryVal * 100);
              const progressFill = pct >= 80 ? c.ngoc : pct >= 60 ? c.thuy : c.dong;

              return (
                <View
                  key={rec.unit_id}
                  style={{
                    width: '48%',
                    flexGrow: 1,
                    minWidth: 280,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: rec.due_urgent ? c.son : c.vien,
                    backgroundColor: c.the,
                    gap: 8,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Txt f="bold" size={14} color={c.muc} style={{ flex: 1 }} numberOfLines={2}>
                      {rec.topic}
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {rec.due_urgent ? <Chip text="Ưu tiên" bg={c.sonNhat} fg={c.sonChu} /> : null}
                      <Chip text={`${pct}%`} bg={pct >= 60 ? c.thuyNhat : c.dongNhat} fg={pct >= 60 ? c.thuyChu : c.dongChu} />
                    </View>
                  </View>

                  {/* Thanh mức nắm vững */}
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: c.vien, overflow: 'hidden' }} accessibilityLabel={`Mức nắm vững ${pct}%`}>
                    <View style={{ width: `${Math.min(100, Math.max(8, pct))}%`, height: '100%', backgroundColor: progressFill }} />
                  </View>

                  {rec.reason || rec.recommendation_reason ? (
                    <Txt size={11.5} color={c.muc2} numberOfLines={2}>
                      {rec.reason || rec.recommendation_reason}
                    </Txt>
                  ) : null}

                  {/* SGK tham chiếu + hỏi Tiểu Tướng về chủ điểm */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 }}>
                      <BookOpen size={12} color={c.muc3} />
                      <Txt size={11} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>
                        {rec.sgk_reference || 'SGK Lịch sử 7 - Bài 15'}
                      </Txt>
                    </View>
                    <Btn icon={Sparkles} title="Hỏi Tiểu Tướng" tone="thuy" size="sm" onPress={() => handleAskFromBkt(rec)} testID={`bkt-ask-${rec.unit_id}`} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : bktData?.profile_summary?.has_activity ? (
          <Txt size={13} color={c.muc2}>
            Tuyệt vời! Em đã nắm vững các chủ điểm trọng tâm.
          </Txt>
        ) : (
          <Txt size={13} color={c.muc2}>
            Em chưa có dữ liệu đánh giá năng lực. Em làm bài ở mục Kỳ thi hoặc hỏi Tiểu Tướng vài câu, rồi bấm “Làm mới” để AI đo năng lực của em nhé!
          </Txt>
        )}
      </Card>

      {/* Bảng giải thích thuật toán BKT */}
      {bktExplainerOpen ? (
        <Sheet
          open={bktExplainerOpen}
          onClose={() => setBktExplainerOpen(false)}
          title="Cơ chế AI Theo dõi Năng lực (BKT)"
          subtitle="Mô hình Bayesian Knowledge Tracing 4 tham số"
          footer={
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Btn title="Đã hiểu" tone="thuy" onPress={() => setBktExplainerOpen(false)} />
            </View>
          }
        >
          <View style={{ gap: 12 }}>
            <Txt size={14} color={c.muc} style={{ lineHeight: 21 }}>
              Hệ thống sử dụng mô hình <Txt f="bold" color={c.muc}>Bayesian Knowledge Tracing (BKT)</Txt> để tự động cập nhật xác suất nắm vững kiến thức của học sinh sau mỗi câu hỏi hoặc bài tập:
            </Txt>
            <View style={{ gap: 8 }}>
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                <Txt f="bold" size={13} color={c.muc}>1. Xác suất ban đầu P(L₀) = {Math.round(params.p_l0 * 100)}%</Txt>
              </View>
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                <Txt f="bold" size={13} color={c.muc}>2. Tốc độ tiếp thu P(T) = +{Math.round(params.p_t * 100)}%</Txt>
              </View>
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                <Txt f="bold" size={13} color={c.muc}>3. Hệ số loại trừ đoán mò P(G) = {Math.round(params.p_g * 100)}%</Txt>
              </View>
              <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                <Txt f="bold" size={13} color={c.muc}>4. Hệ số bù trừ sơ suất P(S) = {Math.round(params.p_s * 100)}%</Txt>
              </View>
            </View>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
};
