/**
 * Trang giáo viên: tiến độ thật của lớp phụ trách (XP, sao chiến dịch, độ chính xác, mức nắm vững BKT, câu sai nhiều nhất,
 * học sinh cần hỗ trợ), lịch sử thi đấu cả lớp, mở phòng thi đấu trực tiếp, công cụ AI soạn đề / soạn truyện, xuất báo cáo CSV.
 * Mục Lớp học: lớp quản trị trường phân công (đặt/đổi mật khẩu lớp, đóng/mở đăng ký) hoặc xin mở lớp (quản trị trường duyệt), chọn lớp đang dạy, nhập tài khoản học sinh từ file Excel mẫu; chuông thông báo duyệt lớp.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart2, BookOpenText, Check, Eye, EyeOff, FileSpreadsheet, Flame, LayoutDashboard, Lock, Plus, Radio, RefreshCw, School, Sparkles, Star, Target, Trophy, Users } from 'lucide-react-native';
import * as teacherApi from '@/api/teacherApi';
import { ApiError, errorMessage } from '@/api/client';
import { KahootShape, Mascot } from '@/components/art';
import { TopBar, type Session } from '@/components/auth';
import { ImportPanel, NotificationBell, classStatusChip, useFail } from '@/components/provisioning';
import { AiQuizSheet, AiStorySheet } from '@/components/teacher/AiTools';
import { LiveHost } from '@/components/teacher/LiveHost';
import { Avatar, Bar, Btn, Card, Chip, EmptyState, Field, Inset, PaperBg, PressCard, Segmented, Sheet, Skeleton, Txt, useToast } from '@/components/ui';
import { ANSWER_STYLES, LIVE_BG, onFill } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentSchoolYear, fmt, formatDateTime, pct, shortName } from '@/lib/format';
import type { AuthUser, ClassRequest, LiveSessionSummary, RosterStudent, TeacherClass } from '@/types/api';
import type { IconType } from '@/types/game';

const DEFAULT_LESSON = 'Bài 14 (KNTT): Ba lần kháng chiến chống quân xâm lược Mông - Nguyên';
const STAGES = ['Màn 1 – Kháng chiến lần thứ nhất (1258)', 'Màn 2 – Kháng chiến lần thứ hai (1285)', 'Màn 3 – Kháng chiến lần thứ ba (1287 – 1288)'];
type Tab = 'home' | 'roster' | 'classes';

export const TeacherHome: React.FC<{ session: Session }> = ({ session }) => {
  const { token, user } = session;
  const { c } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('home');
  const [cls, setCls] = useState<TeacherClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<LiveSessionSummary[] | null>(null);
  const [live, setLive] = useState(false);
  const [aiQuiz, setAiQuiz] = useState(false);
  const [aiStory, setAiStory] = useState(false);

  const loadClass = useCallback(() => {
    setLoading(true);
    teacherApi
      .getMyClass(token)
      .then(setCls)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) session.expired();
        else toast(errorMessage(err, 'Không tải được danh sách lớp'));
      })
      .finally(() => setLoading(false));
  }, [token, session, toast]);

  const loadHistory = useCallback(() => {
    teacherApi
      .getLiveSessions(token, 5)
      .then(setHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) session.expired();
        else setHistory([]);
      });
  }, [token, session]);

  useEffect(() => {
    loadClass();
    loadHistory();
  }, [loadClass, loadHistory]);

  /** Trận vừa lưu: câu trả lời trong trận đã cộng vào tiến độ học sinh, nên tải lại cả lớp */
  const onLiveSaved = useCallback(() => {
    loadHistory();
    loadClass();
  }, [loadHistory, loadClass]);

  const roster = useMemo(() => cls?.students ?? [], [cls]);
  const exportCsv = () => {
    if (!roster.length) return toast('Lớp chưa có học sinh để xuất báo cáo.');
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: Array<Array<string | number>> = [
      ['STT', 'Họ tên', 'Tên đăng nhập', 'XP', 'XP tuần', 'Lượt học/trận', 'Lượt đạt 100%', 'Số câu đã làm', 'Độ chính xác', 'Nắm vững (BKT)', 'Sao Màn 1', 'Sao Màn 2', 'Sao Màn 3', 'Số tướng', 'Chuỗi ngày', 'Câu hỏi AI', 'Đăng nhập gần nhất'],
      ...roster.map((s, i) => [
        i + 1, s.full_name, s.username, s.xp, s.week_xp, s.lessons_completed, s.perfect_runs, s.questions_answered, pct(s.accuracy), pct(s.avg_mastery),
        s.campaign_stars?.[0] ?? 0, s.campaign_stars?.[1] ?? 0, s.campaign_stars?.[2] ?? 0, s.heroes, s.streak, s.ai_questions, formatDateTime(s.last_login_at),
      ]),
    ];
    const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n');
    if (Platform.OS !== 'web') {
      Share.share({ title: `Báo cáo lớp ${user.class_name ?? ''}`, message: csv }).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-lop-${user.class_name ?? 'chua-gan-lop'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Đã xuất báo cáo ${roster.length} học sinh (mở được bằng Excel)`);
  };

  const nav: Array<{ id: Tab; label: string; icon: IconType }> = [
    { id: 'home', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'roster', label: 'Học sinh', icon: Users },
    { id: 'classes', label: 'Lớp học', icon: School },
  ];
  const actions = [
    { label: 'Thi đấu trực tiếp', icon: Radio, onPress: () => setLive(true) },
    { label: 'Soạn đề bằng AI', icon: Sparkles, onPress: () => setAiQuiz(true) },
    { label: 'Soạn truyện bằng AI', icon: BookOpenText, onPress: () => setAiStory(true) },
    { label: 'Xuất báo cáo CSV', icon: FileSpreadsheet, onPress: exportCsv },
  ];

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <TopBar
        session={session}
        subtitle={`Không gian giáo viên${user.class_name ? ` · Lớp ${user.class_name}` : ''}: theo dõi học sinh, tổ chức thi đấu & soạn học liệu AI`}
        extra={<NotificationBell session={session} />}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {wide && (
          <View style={{ width: 240, padding: 16, gap: 8, borderRightWidth: 2, borderRightColor: c.vien, backgroundColor: c.the }}>
            {nav.map((n) => {
              const on = tab === n.id;
              const Icon = n.icon;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => setTab(n.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: on ? c.ngoc : 'transparent', backgroundColor: on ? c.ngocNhat : 'transparent' }}
                >
                  <Icon size={20} color={on ? c.ngocChu : c.muc2} />
                  <Txt f="display" size={15} upper color={on ? c.ngocChu : c.muc2}>
                    {n.label}
                  </Txt>
                </Pressable>
              );
            })}
            <View style={{ height: 2, backgroundColor: c.vien, marginVertical: 6 }} />
            {actions.map((a) => (
              <Btn key={a.label} title={a.label} icon={a.icon} tone="ghost" size="sm" onPress={a.onPress} />
            ))}
          </View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={false} onRefresh={onLiveSaved} />}>
          {!wide && <Segmented label="Mục" options={nav.map((n) => ({ value: n.id, label: n.label }))} value={tab} onChange={setTab} />}
          {tab === 'home' ? (
            <Dashboard
              cls={cls}
              loading={loading}
              history={history}
              teacherName={user.full_name}
              className={user.class_name}
              onLive={() => setLive(true)}
              onAiQuiz={() => setAiQuiz(true)}
              onAiStory={() => setAiStory(true)}
              onExport={exportCsv}
              onRoster={() => setTab('roster')}
              onClasses={() => setTab('classes')}
            />
          ) : tab === 'roster' ? (
            <Roster className={user.class_name} cls={cls} loading={loading} onRefresh={loadClass} onExport={exportCsv} onClasses={() => setTab('classes')} />
          ) : (
            <ClassesTab
              session={session}
              onActivated={(u) => {
                session.updateUser(u);
                loadClass();
              }}
            />
          )}
        </ScrollView>
      </View>
      <LiveHost open={live} onClose={() => setLive(false)} title={DEFAULT_LESSON} token={token} onExpired={session.expired} onSaved={onLiveSaved} classSize={roster.length} />
      <AiQuizSheet open={aiQuiz} onClose={() => setAiQuiz(false)} token={token} onExpired={session.expired} />
      <AiStorySheet open={aiStory} onClose={() => setAiStory(false)} token={token} onExpired={session.expired} />
    </View>
  );
};

// ---------------------------------------------------------------------- tổng quan
const Dashboard: React.FC<{
  cls: TeacherClass | null;
  loading: boolean;
  history: LiveSessionSummary[] | null;
  teacherName: string;
  className: string | null;
  onLive: () => void;
  onAiQuiz: () => void;
  onAiStory: () => void;
  onExport: () => void;
  onRoster: () => void;
  onClasses: () => void;
}> = ({ cls, loading, history, teacherName, className, onLive, onAiQuiz, onAiStory, onExport, onRoster, onClasses }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const roster = cls?.students ?? [];
  const summary = cls?.summary;
  const total = summary?.total ?? 0;
  const practiced = summary?.practiced ?? 0;
  const kpis: Array<{ label: string; value: string; icon: IconType; color: string }> = [
    { label: 'Hoạt động 7 ngày qua', value: summary ? `${summary.active_7d}/${summary.total}` : '—', icon: Users, color: c.ngoc },
    { label: 'Tỷ lệ đúng trung bình', value: pct(summary?.avg_accuracy), icon: Target, color: c.thuy },
    { label: 'Chuỗi học dài nhất', value: summary ? `${summary.best_streak} ngày` : '—', icon: Flame, color: c.hoa },
    { label: 'Sao chiến dịch cả lớp', value: summary ? `${fmt(summary.total_stars)} sao` : '—', icon: Star, color: c.dong },
  ];
  const tools: Array<{ title: string; desc: string; icon: IconType; color: string; edge: string; onPress: () => void }> = [
    { title: 'Thi đấu trực tiếp', desc: 'Cả lớp vào phòng bằng mã PIN, server chấm và cộng điểm từng câu.', icon: Radio, color: c.dong, edge: c.dongDam, onPress: onLive },
    { title: 'AI soạn đề', desc: 'Câu hỏi trắc nghiệm chuẩn SGK 7 theo chủ đề và mức độ.', icon: Sparkles, color: c.thong, edge: '#6b21a8', onPress: onAiQuiz },
    { title: 'AI soạn truyện', desc: 'Màn truyện lịch sử kèm tư liệu và câu hỏi thử thách.', icon: BookOpenText, color: c.thuy, edge: '#075985', onPress: onAiStory },
    { title: 'Báo cáo lớp học', desc: 'Xuất tiến độ, độ chính xác và mức nắm vững ra CSV (Excel).', icon: BarChart2, color: c.son, edge: c.sonDam, onPress: onExport },
  ];
  return (
    <>
      <LinearGradient colors={LIVE_BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22, overflow: 'hidden', borderBottomWidth: 6, borderBottomColor: '#0b3d3a' }}>
        {ANSWER_STYLES.map((s, i) => (
          <View key={s.shape} pointerEvents="none" style={{ position: 'absolute', right: `${6 + i * 9}%`, top: `${i % 2 ? 64 : 12}%`, opacity: 0.85 }}>
            <KahootShape shape={s.shape} size={24 + i * 4} color={s.bg} />
          </View>
        ))}
        <View style={{ flexDirection: width >= 760 ? 'row' : 'column', alignItems: width >= 760 ? 'center' : 'flex-start', gap: 16 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Chip text={`${className ? `LỚP ${className}` : 'CHƯA GÁN LỚP'} · LỊCH SỬ 7 · GDPT 2018`} bg="rgba(255,255,255,0.15)" fg="#ffffff" />
            <Txt f="displayHeavy" size={30} color="#ffffff" accessibilityRole="header">
              Xin chào, {teacherName}!
            </Txt>
            <Txt f="semibold" color="rgba(255,255,255,0.88)" style={{ maxWidth: 560 }}>
              {!className
                ? 'Bạn chưa có lớp đang dạy. Vào mục Lớp học để xin mở lớp; quản trị trường duyệt xong, phát mã lớp và mật khẩu lớp cho học sinh.'
                : total === 0
                  ? `Lớp ${className} chưa có học sinh nào. Phát mã lớp và mật khẩu lớp để học sinh tự vào lớp trong game.`
                  : `${practiced}/${total} học sinh lớp ${className} đã làm bài. Hôm nay tổ chức một trận thi đấu Sử cho cả lớp nhé?`}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
              {className ? (
                <Btn title="Thi đấu trực tiếp" icon={Radio} tone="dong" size="lg" onPress={onLive} />
              ) : (
                <Btn title="Xin mở lớp" icon={School} tone="dong" size="lg" onPress={onClasses} />
              )}
              <Btn title="Soạn đề bằng AI" icon={Sparkles} tone="giay" size="lg" onPress={onAiQuiz} />
            </View>
          </View>
          {width >= 760 && <Mascot size={140} accessory="helmet" mood="excited" bob title={total > 0 ? `Lớp mình có ${total} tráng sĩ nhỏ!` : 'Rồng Con'} />}
        </View>
      </LinearGradient>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} pad={14} style={{ flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: k.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} color={onFill(c, k.color)} />
              </View>
              <View style={{ flex: 1 }} accessible accessibilityLabel={`${k.label}: ${k.value}`}>
                {loading && !cls ? <Skeleton height={22} width={70} /> : <Txt f="displayHeavy" size={22}>{k.value}</Txt>}
                <Txt f="bold" size={12} color={c.muc2} numberOfLines={1}>
                  {k.label}
                </Txt>
              </View>
            </Card>
          );
        })}
      </View>

      {className && total > 0 && <ClassInsights cls={cls} />}
      {className && <LiveHistoryCard sessions={history} onLaunch={onLive} />}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 2, flexBasis: 340, gap: 12 }}>
          <Txt f="display" size={19}>
            Chiến dịch 3 màn của lớp
          </Txt>
          {STAGES.map((name, i) => {
            const done = roster.filter((s) => (s.campaign_stars?.[i] ?? 0) >= 3).length;
            const state = done === 0 ? 'locked' : total > 0 && done >= total ? 'done' : 'current';
            return (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: c.vien }}>
                <View style={{ width: 46, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'locked' ? c.vien : c.ngoc, borderBottomWidth: 4, borderBottomColor: state === 'locked' ? c.vien2 : c.ngocDam }}>
                  {state === 'locked' ? <Lock size={18} color={c.muc3} /> : state === 'done' ? <Check size={22} color="#ffffff" strokeWidth={3} /> : <Txt f="displayHeavy" color="#ffffff">{i + 1}</Txt>}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Txt f="bold" size={14}>
                    {name}
                  </Txt>
                  <Bar value={done} max={Math.max(1, total)} height={10} label={`${name}: ${done}/${total} học sinh đạt từ 3 sao`} />
                </View>
                <Txt f="bold" size={14} color={c.muc2}>
                  {done}/{total}
                </Txt>
              </View>
            );
          })}
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 280, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt f="display" size={19}>
              Top học sinh
            </Txt>
            <Btn title="Cả lớp" tone="ghost" size="sm" onPress={onRoster} />
          </View>
          {roster.length === 0 ? (
            <Txt size={14} color={c.muc2}>
              {loading ? 'Đang tải…' : 'Lớp chưa có học sinh nào.'}
            </Txt>
          ) : (
            roster.slice(0, 3).map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt f="displayHeavy" size={16} color={['#92400e', '#78716c', '#9a6b3c'][i]} style={{ width: 20, textAlign: 'center' }}>
                  {i + 1}
                </Txt>
                <Avatar name={s.full_name} size={36} />
                <Txt f="bold" size={14} numberOfLines={1} style={{ flex: 1 }}>
                  {s.full_name}
                </Txt>
                <Txt f="bold" size={14} color={c.muc2}>
                  {fmt(s.xp)} XP
                </Txt>
              </View>
            ))
          )}
          <View style={{ height: 2, backgroundColor: c.vien, marginVertical: 4 }} />
          <Txt f="bold" size={14}>
            {className ? `Lớp ${className} – Bài 14` : 'Lớp của bạn'} · đúng {pct(summary?.avg_accuracy)}
          </Txt>
          <Bar value={practiced} max={Math.max(1, total)} height={10} label={`${practiced}/${total} học sinh đã làm bài`} />
          <Txt size={13} color={c.muc2}>
            {practiced} / {total} học sinh đã làm bài
          </Txt>
          <Btn title="Xuất CSV" icon={FileSpreadsheet} tone="giay" size="sm" full onPress={onExport} />
        </Card>
      </View>

      <Txt f="display" size={19}>
        Công cụ cho giáo viên
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <PressCard key={t.title} onPress={t.onPress} label={t.title} hint={t.desc} style={{ flexGrow: 1, flexBasis: 220, gap: 10 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: t.edge }}>
                <Icon size={26} color="#ffffff" />
              </View>
              <Txt f="display" size={17}>
                {t.title}
              </Txt>
              <Txt size={14} color={c.muc2}>
                {t.desc}
              </Txt>
            </PressCard>
          );
        })}
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- tiến độ lớp
const masteryColor = (v: number) => (v >= 0.8 ? '#0f766e' : v >= 0.6 ? '#0369a1' : '#d97706');

export const ClassInsights: React.FC<{ cls: TeacherClass | null }> = ({ cls }) => {
  const { c } = useTheme();
  if (!cls) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }} accessibilityLabel="Tiến độ học tập của lớp">
      <Card style={{ flexGrow: 1, flexBasis: 300, gap: 10 }}>
        <View>
          <Txt f="display" size={18}>
            Câu cả lớp sai nhiều nhất
          </Txt>
          <Txt size={12} color={c.muc2}>
            Do server ghi lại khi chấm từng câu trả lời
          </Txt>
        </View>
        {cls.top_wrong.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Chưa có câu trả lời sai nào.
          </Txt>
        ) : (
          cls.top_wrong.map((w, i) => (
            <View key={w.question_id} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.sonNhat, alignItems: 'center', justifyContent: 'center' }}>
                <Txt f="displayHeavy" size={14} color={c.sonChu}>
                  {i + 1}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={14}>
                  {w.prompt}
                </Txt>
                <Txt size={12} color={c.muc2}>
                  Sai {w.wrong}/{w.attempts} lượt · {w.students} học sinh · {w.topic}
                </Txt>
              </View>
            </View>
          ))
        )}
      </Card>
      <Card style={{ flexGrow: 1, flexBasis: 300, gap: 10 }}>
        <View>
          <Txt f="display" size={18}>
            Mức nắm vững theo chủ đề
          </Txt>
          <Txt size={12} color={c.muc2}>
            Trung bình P(L) của mô hình BKT – yếu nhất ở trên
          </Txt>
        </View>
        {cls.unit_mastery.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Học sinh chưa làm câu hỏi nào.
          </Txt>
        ) : (
          cls.unit_mastery.slice(0, 6).map((m) => (
            <View key={m.unit_id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt f="bold" size={14} style={{ flex: 1 }}>
                  {m.topic}
                </Txt>
                <Txt f="bold" size={14} color={c.muc2}>
                  {pct(m.avg_p_l)}
                </Txt>
              </View>
              <Bar value={m.avg_p_l} max={1} fill={masteryColor(m.avg_p_l)} height={10} label={`${m.topic}: nắm vững ${pct(m.avg_p_l)}`} />
              <Txt size={11} color={c.muc3}>
                {m.students} học sinh đã làm
              </Txt>
            </View>
          ))
        )}
      </Card>
      <Card style={{ flexGrow: 1, flexBasis: 300, gap: 10 }}>
        <View>
          <Txt f="display" size={18}>
            Học sinh cần hỗ trợ
          </Txt>
          <Txt size={12} color={c.muc2}>
            Vắng học, tỉ lệ đúng hoặc mức nắm vững thấp
          </Txt>
        </View>
        {cls.needs_support.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Chưa có học sinh nào cần lưu ý.
          </Txt>
        ) : (
          cls.needs_support.slice(0, 8).map((n) => (
            <View key={n.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Avatar name={n.full_name} size={32} />
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={14}>
                  {n.full_name}
                </Txt>
                <Txt size={12} color={c.muc2}>
                  {n.reasons.join(' · ')}
                </Txt>
              </View>
            </View>
          ))
        )}
      </Card>
    </View>
  );
};

const LiveHistoryCard: React.FC<{ sessions: LiveSessionSummary[] | null; onLaunch: () => void }> = ({ sessions, onLaunch }) => {
  const { c } = useTheme();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt f="display" size={18}>
            Thi đấu gần đây
          </Txt>
          <Txt size={12} color={c.muc2}>
            Kết quả các trận thi đấu trực tiếp của lớp – server chấm từng câu
          </Txt>
        </View>
        <Btn title="Mở phòng" icon={Radio} tone="dong" size="sm" onPress={onLaunch} />
      </View>
      {sessions === null ? (
        <Skeleton height={44} />
      ) : sessions.length === 0 ? (
        <Txt size={14} color={c.muc2}>
          Lớp chưa có trận thi đấu nào. Bấm “Mở phòng”, đọc mã PIN cho cả lớp và bắt đầu.
        </Txt>
      ) : (
        sessions.map((s) => {
          const hardest = s.questions.filter((q) => q.answered > 0).sort((a, b) => a.correct / a.answered - b.correct / b.answered)[0];
          return (
            <View key={s.id} style={{ paddingVertical: 10, borderTopWidth: 2, borderTopColor: c.vien, gap: 6 }}>
              <Txt f="bold" numberOfLines={1}>
                {s.title}
              </Txt>
              <Txt size={12} color={c.muc2}>
                {formatDateTime(s.finished_at)} · {s.player_count} học sinh · {s.question_count} câu · đúng {pct(s.accuracy)}
              </Txt>
              {hardest && (
                <Txt size={12} color={c.muc2}>
                  Câu khó nhất: “{hardest.prompt}” – {hardest.correct}/{hardest.answered} bạn đúng
                </Txt>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={`Ba bạn dẫn đầu trận ${s.title}`}>
                {s.results.slice(0, 3).map((r) => (
                  <Chip key={r.user_id} icon={Trophy} text={`${r.rank}. ${shortName(r.full_name)} · ${fmt(r.score)}`} bg={c.dongNhat} fg={c.dongChu} />
                ))}
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------- danh sách học sinh
const Roster: React.FC<{ className: string | null; cls: TeacherClass | null; loading: boolean; onRefresh: () => void; onExport: () => void; onClasses: () => void }> = ({
  className, cls, loading, onRefresh, onExport, onClasses,
}) => {
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const roster = cls?.students ?? [];
  const summary = cls?.summary;
  const q = search.trim().toLowerCase();
  const rows = roster.filter((s) => !q || s.full_name.toLowerCase().includes(q) || s.username.includes(q));
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Txt f="displayHeavy" size={24} accessibilityRole="header">
            {className ? `Học sinh lớp ${className}` : 'Học sinh của lớp'}
          </Txt>
          <Txt f="semibold" size={14} color={c.muc2}>
            {summary ? `${summary.total} học sinh · ${summary.practiced} em đã làm bài · ${summary.active_7d} em hoạt động trong 7 ngày` : 'Đang tải…'}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="Làm mới" icon={RefreshCw} tone="giay" loading={loading} onPress={onRefresh} />
          <Btn title="Xuất CSV" icon={FileSpreadsheet} tone="ngoc" onPress={onExport} />
        </View>
      </View>
      {!className ? (
        <EmptyState
          title="Bạn chưa có lớp đang dạy"
          text="Xin mở lớp ở mục Lớp học; quản trị trường duyệt xong, chọn lớp để theo dõi học sinh."
          action={<Btn title="Đến mục Lớp học" icon={School} tone="ngoc" onPress={onClasses} />}
        />
      ) : (
        <>
          <ClassInsights cls={cls} />
          <Field label="Tìm học sinh" value={search} onChangeText={setSearch} placeholder="Họ tên hoặc tên đăng nhập…" autoCapitalize="none" style={{ maxWidth: 420 }} />
          {rows.length === 0 ? (
            <EmptyState
              title={roster.length === 0 ? 'Lớp chưa có học sinh nào' : 'Không tìm thấy học sinh phù hợp'}
              text={roster.length === 0 ? 'Phát mã lớp và mật khẩu lớp cho học sinh: các em vào lớp trong mục Hồ sơ của game.' : 'Thử từ khóa khác.'}
            />
          ) : (
            rows.map((s, i) => <StudentRow key={s.id} s={s} index={i} />)
          )}
        </>
      )}
    </>
  );
};

const StudentRow = React.memo<{ s: RosterStudent; index: number }>(({ s, index }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, opacity: s.is_active ? 1 : 0.55 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 240 }}>
        <Txt f="displayHeavy" color={c.muc3} style={{ width: 24, textAlign: 'center' }}>
          {index + 1}
        </Txt>
        <Avatar name={s.full_name} size={38} />
        <View style={{ flex: 1 }}>
          <Txt f="bold" numberOfLines={1}>
            {s.full_name}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Txt f="mono" size={12} color={c.muc3}>
              {s.username}
            </Txt>
            {s.must_change_password && <Chip text="Chưa đăng nhập" bg={c.dongNhat} fg={c.dongChu} />}
            {!s.is_active && <Chip text="Đã khóa" bg={c.sonNhat} fg={c.sonChu} />}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, flexGrow: 1, flexBasis: 300, alignItems: 'center' }}>
        <Stat label="XP" value={fmt(s.xp)} color={c.dongChu} />
        <Stat label="Sao" value={`${s.stars}/27`} />
        <Stat label="Chính xác" value={pct(s.accuracy)} />
        <Stat label="Chuỗi" value={s.streak > 0 ? `${s.streak} ngày` : '—'} color={c.hoaChu} />
        <View style={{ flexGrow: 1, minWidth: 120, gap: 4 }}>
          <Txt size={11} color={c.muc3}>
            Nắm vững (BKT)
          </Txt>
          {s.avg_mastery === null ? (
            <Txt f="semibold" size={12} color={c.muc3}>
              Chưa có dữ liệu
            </Txt>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Bar value={s.avg_mastery} max={1} fill={masteryColor(s.avg_mastery)} height={10} style={{ flex: 1 }} label={`Nắm vững ${pct(s.avg_mastery)}`} />
              <Txt f="bold" size={12} color={c.muc2}>
                {pct(s.avg_mastery)}
              </Txt>
            </View>
          )}
        </View>
      </View>
      <Txt size={12} color={c.muc3} style={{ flexBasis: 160, flexGrow: 1 }}>
        Đăng nhập gần nhất: {formatDateTime(s.last_login_at)}
      </Txt>
    </Card>
  );
});
StudentRow.displayName = 'StudentRow';

// ---------------------------------------------------------------------- lớp học: xin mở lớp, chọn lớp đang dạy, nhập tài khoản học sinh
const ClassesTab: React.FC<{ session: Session; onActivated: (user: AuthUser) => void }> = ({ session, onActivated }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const [items, setItems] = useState<ClassRequest[] | null>(null);
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<ClassRequest | null>(null);
  const active = session.user.class_name;

  const load = useCallback(() => {
    teacherApi
      .getClassRequests(session.token)
      .then(setItems)
      .catch((err) => {
        setItems([]);
        fail(err);
      });
  }, [session.token, fail]);

  useEffect(load, [load]);

  const activate = async (k: ClassRequest) => {
    setBusy(k.id);
    try {
      onActivated(await teacherApi.activateClass(session.token, k.id));
      toast(`Đang dạy lớp ${k.class_code}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const toggleJoin = async (k: ClassRequest) => {
    setBusy(k.id);
    try {
      await teacherApi.setClassJoinOpen(session.token, k.id, !k.join_open);
      toast(k.join_open ? `Đã đóng đăng ký vào lớp ${k.class_code}` : `Đã mở đăng ký vào lớp ${k.class_code}`);
      load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Txt f="displayHeavy" size={22} accessibilityRole="header">
              Lớp của tôi
            </Txt>
            <Txt size={13} color={c.muc2}>
              Quản trị trường tạo lớp và phân công cho bạn: hãy đặt mật khẩu lớp rồi phát mã lớp và mật khẩu cho học sinh tự vào lớp. Bạn cũng có thể gửi yêu cầu mở lớp để quản trị trường duyệt.
            </Txt>
          </View>
          <Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={load} />
          <Btn title="Xin mở lớp" icon={Plus} tone="ngoc" onPress={() => setForm(true)} testID="class-request" />
        </View>
        {items === null ? (
          <Skeleton height={56} />
        ) : items.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Chưa có lớp nào. Bấm Xin mở lớp để bắt đầu.
          </Txt>
        ) : (
          items.map((k) => {
            const chip = classStatusChip(c, k.status);
            const on = k.status === 'APPROVED' && active === k.class_code;
            return (
              <Inset key={k.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: on ? c.ngoc : 'transparent' }}>
                <View style={{ minWidth: 64, height: 44, paddingHorizontal: 8, borderRadius: 12, backgroundColor: c.vang, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: c.vangDam }}>
                  <Txt f="display" size={14} color="#3a2a00">
                    {k.class_code}
                  </Txt>
                </View>
                <View style={{ flexGrow: 1, flexBasis: 200 }}>
                  <Txt f="bold" size={14}>
                    {k.name} · {k.school_year}
                  </Txt>
                  <Txt size={12} color={c.muc2}>
                    Gửi {formatDateTime(k.created_at)}
                    {k.status === 'APPROVED' ? ` · ${k.members} học sinh đã vào lớp` : ''}
                  </Txt>
                  {k.review_note && (
                    <Txt size={12} color={k.status === 'REJECTED' ? c.sonChu : c.muc3}>
                      Ghi chú của quản trị: {k.review_note}
                    </Txt>
                  )}
                </View>
                <Chip text={on ? 'Đang dạy' : chip.text} bg={on ? c.ngocNhat : chip.bg} fg={on ? c.ngocChu : chip.fg} />
                {k.status === 'APPROVED' && !on && k.is_active !== false && <Btn title="Dạy lớp này" icon={Check} tone="ngoc" size="sm" loading={busy === k.id} onPress={() => activate(k)} />}
                {k.status === 'APPROVED' && k.is_active === false && <Chip text="Lớp đã đóng" bg={c.sonNhat} fg={c.sonChu} />}
                {k.status === 'APPROVED' && k.is_active !== false && (
                  <View style={{ flexBasis: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <Chip text={!k.has_password ? 'Chưa có mật khẩu lớp: học sinh chưa vào được' : k.join_open ? 'Đang mở đăng ký' : 'Đang đóng đăng ký'} bg={!k.has_password ? c.vangNhat : k.join_open ? c.thuyNhat : c.dichNhat} fg={!k.has_password ? c.vangChu : k.join_open ? c.thuyChu : c.muc2} />
                    <Btn title={k.has_password ? 'Đổi mật khẩu lớp' : 'Đặt mật khẩu lớp'} icon={Lock} tone="giay" size="sm" label={`${k.has_password ? 'Đổi' : 'Đặt'} mật khẩu lớp ${k.class_code}`} onPress={() => setPwFor(k)} />
                    {k.has_password && <Btn title={k.join_open ? 'Đóng đăng ký' : 'Mở đăng ký'} tone="giay" size="sm" loading={busy === k.id} label={`${k.join_open ? 'Đóng' : 'Mở'} đăng ký lớp ${k.class_code}`} onPress={() => toggleJoin(k)} />}
                  </View>
                )}
              </Inset>
            );
          })
        )}
      </Card>
      <ImportPanel
        session={session}
        scope="Giáo viên nhập tài khoản học sinh (vai trò HS) của trường mình; dòng giáo viên hoặc dòng của trường khác bị từ chối."
        upload={teacherApi.importStudents}
        history={teacherApi.getImports}
      />
      {pwFor && (
        <JoinPasswordSheet
          token={session.token}
          cls={pwFor}
          onClose={() => setPwFor(null)}
          onSaved={() => {
            setPwFor(null);
            load();
            toast('Đã lưu mật khẩu lớp. Mật khẩu cũ không còn dùng được.');
          }}
        />
      )}
      {form && (
        <ClassRequestSheet
          token={session.token}
          onClose={() => setForm(false)}
          onCreated={() => {
            setForm(false);
            load();
            toast('Đã gửi yêu cầu mở lớp – chờ quản trị trường duyệt');
          }}
        />
      )}
    </>
  );
};

/** Giáo viên được phân công đặt/đổi mật khẩu gia nhập lớp; máy chủ chỉ lưu băm và thu hồi mật khẩu cũ ngay */
const JoinPasswordSheet: React.FC<{ token: string; cls: ClassRequest; onClose: () => void; onSaved: () => void }> = ({ token, cls, onClose, onSaved }) => {
  const { c } = useTheme();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (password.length < 4) return setError('Mật khẩu lớp cần ít nhất 4 ký tự.');
    setLoading(true);
    setError(null);
    try {
      await teacherApi.setClassPassword(token, cls.id, password);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Không lưu được mật khẩu lớp.'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={cls.has_password ? `Đổi mật khẩu lớp ${cls.class_code}` : `Đặt mật khẩu lớp ${cls.class_code}`}
      subtitle="Học sinh nhập mã lớp và mật khẩu này để vào lớp"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title="Lưu mật khẩu" icon={Lock} tone="ngoc" loading={loading} onPress={submit} />
        </View>
      }
    >
      {error && (
        <Txt color={c.sonChu} accessibilityRole="alert">
          {error}
        </Txt>
      )}
      <Field label="Mật khẩu lớp mới" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} hint="Tối thiểu 4 ký tự. Mật khẩu cũ ngừng dùng được ngay." />
      <Btn title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} icon={show ? EyeOff : Eye} tone="giay" size="sm" onPress={() => setShow((v) => !v)} />
    </Sheet>
  );
};

const ClassRequestSheet: React.FC<{ token: string; onClose: () => void; onCreated: () => void }> = ({ token, onClose, onCreated }) => {
  const { c } = useTheme();
  const [code, setCode] = useState('');
  const [year, setYear] = useState(currentSchoolYear());
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const classCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(classCode)) return setError('Mã lớp gồm 2–20 chữ in hoa không dấu, số, dấu chấm, gạch (vd: 7A1).');
    const y = year.trim();
    if (!/^\d{4}-\d{4}$/.test(y) || Number(y.slice(5)) !== Number(y.slice(0, 4)) + 1) return setError('Năm học có dạng 2025-2026.');
    if (name.trim().length < 2) return setError('Tên lớp cần ít nhất 2 ký tự.');
    if (password.length < 4) return setError('Mật khẩu lớp cần ít nhất 4 ký tự.');
    setLoading(true);
    setError(null);
    try {
      await teacherApi.requestClass(token, { class_code: classCode, school_year: y, name: name.trim(), join_password: password });
      onCreated();
    } catch (err) {
      setError(errorMessage(err, 'Không gửi được yêu cầu mở lớp.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Xin mở lớp"
      subtitle="Quản trị trường duyệt trước khi học sinh vào được lớp"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title="Gửi yêu cầu" icon={School} tone="ngoc" loading={loading} onPress={submit} testID="class-submit" />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Field label="Mã số lớp *" value={code} onChangeText={setCode} placeholder="vd: 7A1" autoCapitalize="characters" autoCorrect={false} autoFocus style={{ flexGrow: 1, flexBasis: 140 }} nativeID="class-code" />
        <Field label="Năm học *" value={year} onChangeText={setYear} placeholder="2025-2026" style={{ flexGrow: 1, flexBasis: 140 }} nativeID="class-year" />
      </View>
      <Field label="Tên lớp *" value={name} onChangeText={setName} placeholder="vd: Lớp 7A1 – Lịch sử" nativeID="class-name" />
      <Field
        label="Mật khẩu mã lớp * (học sinh nhập khi vào lớp)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        nativeID="class-password"
        hint="Hãy ghi nhớ: hệ thống chỉ lưu bản mã hóa, không hiển thị lại mật khẩu lớp."
      />
      <Btn tone="ghost" size="sm" icon={show ? EyeOff : Eye} title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow((v) => !v)} selected={show} />
      {error && (
        <Inset style={{ backgroundColor: c.sonNhat }}>
          <Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">
            {error}
          </Txt>
        </Inset>
      )}
    </Sheet>
  );
};

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt size={11} color={c.muc3}>
        {label}
      </Txt>
      <Txt f="display" size={16} color={color ?? c.muc}>
        {value}
      </Txt>
    </View>
  );
};
