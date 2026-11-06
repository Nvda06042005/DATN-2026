/**
 * Duolingo-style Right Panel Widget (Cột thứ 3 trên Web - Chuẩn giao diện Duolingo)
 * Tương ứng với bố cục 3 cột trong ảnh tham khảo:
 * 1. Top HUD: Tim, Cấp độ / XP, Vàng, Chuỗi ngày học Streak
 * 2. Promo Card AI: "Trợ lý AI Hào Khí Đông A" (tương đương card Super Duolingo)
 * 3. League Widget: Giải đấu tuần & Thứ hạng của em (tương đương Amethyst League)
 * 4. Daily Quests Widget: Nhiệm vụ hằng ngày với thanh tiến độ & rương thưởng (tương đương Daily Quests)
 * 5. Footer links
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Award,
  Coins,
  Flame,
  Gift,
  Heart,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react-native';
import * as gameApi from '@/api/gameApi';
import type { Session } from '@/components/auth';
import type { Tab } from '@/components/portal/StudentNav';
import { Bar, Btn, Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { GameQuest, Hud, LeagueView } from '@/types/gamification';

interface RightPanelProps {
  session: Session;
  hud: Hud | null;
  refreshKey: number;
  onGoTab: (tab: Tab) => void;
}

export const DuolingoRightPanel: React.FC<RightPanelProps> = ({ session, hud, refreshKey, onGoTab }) => {
  const { c } = useTheme();
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [quests, setQuests] = useState<GameQuest[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      gameApi.leagueView(session.token).catch(() => null),
      gameApi.gameQuests(session.token).catch(() => null),
    ])
      .then(([lg, q]) => {
        if (!mounted) return;
        if (lg) setLeague(lg);
        if (q?.daily) setQuests(q.daily);
      });
    return () => {
      mounted = false;
    };
  }, [session.token, refreshKey]);

  const h = hud?.hearts;
  const myLeagueEntry = league?.entries.find((e) => e.me);

  return (
    <View
      style={{
        width: 360,
        backgroundColor: c.the,
        borderLeftWidth: 2,
        borderLeftColor: c.vien,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        {/* --- 1. TOP HUD STATS ROW --- */}
        {hud ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: c.the2,
              borderWidth: 2,
              borderColor: c.vien,
            }}
          >
            {/* Tim */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Số tim"
              onPress={() => onGoTab('practice')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Heart size={20} color={h && h.current <= 1 && h.enabled ? c.son : c.sonChu} fill={h && h.current <= 1 && h.enabled ? c.son : c.sonChu} />
              <Txt f="bold" size={14} color={h && h.current <= 1 && h.enabled ? c.son : c.muc}>
                {h ? (h.enabled ? `${h.current}/${h.max}` : '∞') : '5'}
              </Txt>
            </Pressable>

            {/* Streak */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chuỗi ngày học"
              onPress={() => onGoTab('mine')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Flame size={20} color={hud.streak.at_risk ? c.dich : c.hoa} fill={hud.streak.at_risk ? c.dich : c.hoa} />
              <Txt f="bold" size={14} color={hud.streak.at_risk ? c.dich : c.hoa}>
                {hud.streak.current}
              </Txt>
            </Pressable>

            {/* Vàng */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Số vàng"
              onPress={() => onGoTab('shop')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Coins size={20} color={c.vangDam} />
              <Txt f="bold" size={14} color={c.vangChu}>
                {hud.gold}
              </Txt>
            </Pressable>

            {/* Cấp độ & XP */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cấp độ và XP"
              onPress={() => onGoTab('mine')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Award size={20} color={c.dong} />
              <Txt f="bold" size={14} color={c.dongChu}>
                Cấp {hud.level.level}
              </Txt>
            </Pressable>
          </View>
        ) : null}

        {/* --- 2. CARD AI ASSISTANT HUB (Tương đương card Super Duolingo trong ảnh 1) --- */}
        <Card
          pad={16}
          style={{
            gap: 10,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: c.vangDam,
            backgroundColor: c.the2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: c.vangNhat,
              }}
            >
              <Sparkles size={14} color={c.vangChu} />
              <Txt f="bold" size={11} color={c.vangChu} upper>
                TRỢ LÝ AI HÀO KHÍ
              </Txt>
            </View>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.vangNhat, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color={c.vangChu} />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Txt f="displayHeavy" size={18} color={c.muc}>
              Hỏi đáp & Luyện đề thông minh
            </Txt>
            <Txt size={13} color={c.muc2} numberOfLines={3}>
              Gia sư AI RAG 1.083 đoạn DVSKTT, sinh đề trắc nghiệm chuẩn SGK 7 Bloom và lật thẻ ghi nhớ.
            </Txt>
          </View>

          <Btn
            title="Mở AI Hub ngay"
            icon={Sparkles}
            tone="vang"
            size="md"
            full
            onPress={() => onGoTab('ai')}
          />
        </Card>

        {/* --- 3. CARD LEAGUE WIDGET (Tương đương card Amethyst League trong ảnh 1 & 2) --- */}
        <Card pad={16} style={{ gap: 12, borderRadius: 20, borderWidth: 2, borderColor: c.vien }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Trophy size={20} color={c.vangDam} />
              <Txt f="bold" size={16} color={c.muc}>
                {league ? `Giải đấu ${league.tier_name}` : 'Giải đấu tuần'}
              </Txt>
            </View>
            <Pressable onPress={() => onGoTab('ranking')} accessibilityRole="link" accessibilityLabel="Xem bảng đấu">
              <Txt f="bold" size={12} color={c.ngocChu} upper>
                XEM BẢNG ĐẤU
              </Txt>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: c.thuyNhat,
                borderWidth: 2,
                borderColor: c.thuy,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={26} color={c.thuyChu} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="bold" size={15} color={c.muc}>
                {myLeagueEntry ? `Em đang xếp hạng #${myLeagueEntry.rank}` : 'Hạng thi đua tuần'}
              </Txt>
              <Txt size={13} color={c.muc2}>
                {myLeagueEntry ? `Đã đạt ${myLeagueEntry.xp} XP tuần này` : (hud ? `${hud.xp} điểm kinh nghiệm` : 'Học để thăng hạng')}
              </Txt>
            </View>
          </View>

          {league ? (
            <View style={{ padding: 10, borderRadius: 12, backgroundColor: c.the2, gap: 4 }}>
              <Txt size={12} color={c.muc2}>
                ⚡ <Txt f="bold" size={12} color={c.muc}>{league.promote} bạn đứng đầu</Txt> sẽ được thăng hạng tuần tới!
              </Txt>
            </View>
          ) : null}
        </Card>

        {/* --- 4. CARD DAILY QUESTS (Tương đương card Daily Quests trong ảnh 1 & 3) --- */}
        <Card pad={16} style={{ gap: 12, borderRadius: 20, borderWidth: 2, borderColor: c.vien }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Target size={20} color={c.dong} />
              <Txt f="bold" size={16} color={c.muc}>
                Nhiệm vụ hôm nay
              </Txt>
            </View>
            <Pressable onPress={() => onGoTab('quests')} accessibilityRole="link" accessibilityLabel="Xem tất cả nhiệm vụ">
              <Txt f="bold" size={12} color={c.ngocChu} upper>
                XEM TẤT CẢ
              </Txt>
            </Pressable>
          </View>

          {quests.length > 0 ? (
            <View style={{ gap: 10 }}>
              {quests.slice(0, 3).map((q) => {
                const done = Boolean(q.completed_at);
                const current = Math.min(q.progress, q.target);
                return (
                  <View key={q.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Txt size={13} f={done ? 'body' : 'semibold'} color={done ? c.muc3 : c.muc} numberOfLines={1} style={{ flex: 1, paddingRight: 8 }}>
                        {q.title}
                      </Txt>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Gift size={14} color={done ? c.ngocChu : c.dongChu} />
                        <Txt size={12} f="bold" color={done ? c.ngocChu : c.dongChu}>
                          {current}/{q.target}
                        </Txt>
                      </View>
                    </View>
                    <Bar
                      value={current}
                      max={q.target}
                      height={8}
                      fill={done ? c.ngoc : c.vangDam}
                      label={`${q.title}: ${current}/${q.target}`}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt size={13} color={c.muc}>Đạt mục tiêu điểm hôm nay</Txt>
                  <Txt size={12} f="bold" color={c.vangDam}>
                    {hud ? `${Math.min(hud.daily.xp, hud.daily.goal)}/${hud.daily.goal}` : '0/50'}
                  </Txt>
                </View>
                <Bar
                  value={hud ? Math.min(hud.daily.xp, hud.daily.goal) : 0}
                  max={hud ? hud.daily.goal : 50}
                  height={8}
                  fill={c.vangDam}
                />
              </View>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt size={13} color={c.muc}>Hoàn thành 1 bài học lịch sử</Txt>
                  <Txt size={12} f="bold" color={c.thuy}>1/1</Txt>
                </View>
                <Bar value={1} max={1} height={8} fill={c.thuy} />
              </View>
            </View>
          )}
        </Card>

        {/* --- 5. FOOTER LINKS --- */}
        <View style={{ paddingTop: 8, alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <Txt size={11} color={c.muc3}>Hào Khí Đông A</Txt>
            <Txt size={11} color={c.muc3}>•</Txt>
            <Txt size={11} color={c.muc3}>Lịch sử lớp 7</Txt>
            <Txt size={11} color={c.muc3}>•</Txt>
            <Txt size={11} color={c.muc3}>Điều khoản</Txt>
            <Txt size={11} color={c.muc3}>•</Txt>
            <Txt size={11} color={c.muc3}>Trợ giúp</Txt>
          </View>
          <Txt size={10} color={c.muc3}>© 2026 Nền tảng học tập Lịch sử thời Trần</Txt>
        </View>
      </ScrollView>
    </View>
  );
};
