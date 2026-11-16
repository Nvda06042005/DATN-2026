/**
 * Trợ lý AI cho Giáo viên — Đồng bộ giao diện AI Hub Đông A (4 công cụ giảng dạy & khảo thí):
 * 1. Hỏi đáp tư liệu có trích dẫn SGK 7 & ĐVSKTT (HK.GV.073), có cột lịch sử trò chuyện như ChatGPT. 16/11/2026: Nhập vai danh tướng chuyển sang học sinh (Hỏi Tiểu Tướng)
 * 2. Số hóa Đề thi Word (.docx), Biên tập trực quan & Trộn mã đề 101–104 (SmartExamStudio)
 * 3. (Đã xóa 16/11/2026 theo yêu cầu: công cụ soạn câu hỏi AI và gợi ý kịch bản tiết học, hộp soạn đề bằng AI.)
 * 4. Thống kê ẩn danh "Học sinh hỏi gì" để giáo viên điều chỉnh trọng tâm giảng dạy (HK.GV.074)
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Bot, ChartColumn, History, ListChecks, MessageSquareText, RefreshCw, SquarePen } from 'lucide-react-native';
import * as api from '@/api/aiApi';
import { Cell, DataTable, ErrorNote, useLoad } from '@/components/admin/kit';
import { SmartExamStudio } from '@/components/admin/SmartExamStudio';
import type { Session } from '@/components/auth';
import { DetailSheet } from '@/components/portal/Library';
import { ChatPanel, ConversationSidebar, HistorySheet } from '@/components/portal/TieuTuong';
import type { AiMessage } from '@/types/ai';
import { Btn, Card, Chip, EmptyState, InfoNote, Segmented, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

type TeacherAiView = 'hub' | 'ask' | 'smart_exam' | 'topics';

const KIND_LABEL: Record<string, string> = {
  figure: 'Nhân vật',
  event: 'Sự kiện',
  place: 'Địa danh',
  battle: 'Trận đánh',
  source: 'Tư liệu',
  term: 'Thuật ngữ',
  lesson: 'Bài học',
  doc: 'Tài liệu',
};

// ---------------------------------------------------------------------- Tra cứu sử liệu của giáo viên, có cột lịch sử như ChatGPT (16/11/2026)
const TeacherAsk: React.FC<{ session: Session; onBack: () => void }> = ({ session, onBack }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [initial, setInitial] = useState<{ id: number; messages: AiMessage[] } | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [fresh, setFresh] = useState(0);
  const [listKey, setListKey] = useState(0);
  const [history, setHistory] = useState(false);
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  const startNew = () => { setInitial(null); setActiveId(null); setFresh((k) => k + 1); };
  const open = async (id: number) => {
    try { const cv = await api.aiConversation(session.token, id); setInitial({ id: cv.id, messages: cv.messages }); setActiveId(cv.id); setFresh((k) => k + 1); } catch { /* bỏ qua */ }
  };
  const chat = (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      <ChatPanel key={`teacher-chat-${fresh}`} session={session} mode="teacher" initial={initial} onConversation={(id) => { setActiveId(id); setListKey((k) => k + 1); }}
        onOpen={(kind, id) => setDetail({ type: kind, id })}
        samples={['Hội nghị Diên Hồng diễn ra khi nào?', 'Trận Bạch Đằng có những chi tiết nào đáng chú ý?', 'Hịch tướng sĩ do ai viết?']}
        placeholder="Thầy cô muốn tra cứu tư liệu lịch sử nào?" />
    </View>
  );
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1240, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={onBack} />
        <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Tra cứu Sử liệu</Txt>
        {wide ? null : <Btn icon={History} title="Lịch sử" tone="giay" size="sm" onPress={() => setHistory(true)} testID="teacher-ai-history" />}
        {wide ? null : <Btn icon={SquarePen} title="Cuộc mới" tone="giay" size="sm" onPress={startNew} />}
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ width: 270 }}><ConversationSidebar session={session} activeId={activeId} reloadKey={listKey} onPick={(id) => { void open(id); }} onNew={startNew} /></View>
          {chat}
        </View>
      ) : chat}
      {history ? <HistorySheet session={session} onClose={() => setHistory(false)} onPick={(id) => { void open(id); }} reloadKey={listKey} /> : null}
      {detail ? <DetailSheet session={session} type={detail.type} id={detail.id} onClose={() => setDetail(null)} onOpen={(type, id) => setDetail({ type, id })} /> : null}
    </ScrollView>
  );
};

// ---------------------------------------------------------------------- Chủ đề học sinh hỏi (HK.GV.074)
const Topics: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const [days, setDays] = useState(30);
  const topics = useLoad(() => api.aiTopics(session.token, days), [session.token, days], session.expired);
  const d = topics.data;
  return (
    <View style={{ gap: 12 }}>
      <Segmented<number>
        label="Khoảng thời gian"
        value={days}
        onChange={setDays}
        options={[7, 30, 90].map((n) => ({ value: n, label: `${n} ngày` }))}
      />
      <ErrorNote message={topics.error} />
      {topics.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`${d.questions} câu hỏi`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`${d.students} học sinh đã hỏi`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`${d.refused} câu ngoài phạm vi`} bg={c.the2} fg={c.muc2} />
          </View>
          <InfoNote><Txt size={13}>{d.note}</Txt></InfoNote>
          {!d.topics.length ? (
            <EmptyState
              mood="thinking"
              title="Chưa có câu hỏi nào trong khoảng thời gian này"
              text="Khi học sinh trong các lớp của thầy cô hỏi Trợ lý AI, các chủ đề được hỏi nhiều sẽ hiện ở đây."
            />
          ) : null}
          {d.topics.length ? (
            <DataTable
              rows={d.topics}
              rowKey={(r) => `${r.kind}${r.id}`}
              empty="Chưa có chủ đề"
              columns={[
                { key: 't', label: 'Chủ đề được nhắc tới', flex: 3, render: (r) => <Cell main={r.title} sub={KIND_LABEL[r.kind] ?? r.kind} /> },
                { key: 'n', label: 'Số lượt hỏi', render: (r) => <Txt f="bold" size={14}>{r.asked}</Txt> },
              ]}
            />
          ) : null}
          {d.keywords.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Từ khóa hay gặp trong câu hỏi</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {d.keywords.map((k) => (
                  <Chip key={k.word} text={`${k.word} · ${k.count}`} bg={c.dongNhat} fg={c.dongChu} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Component chính: AiTeacher (đồng bộ AI Hub Đông A)
export const AiTeacher: React.FC<{ session: Session; onGoLibrary?: () => void }> = ({ session, onGoLibrary }) => {
  const { c } = useTheme();
  const [activeView, setActiveView] = useState<TeacherAiView>('hub');
  const topicsSummary = useLoad(() => api.aiTopics(session.token, 30), [session.token], session.expired);

  // ======================================================================
  // 1. GIAO DIỆN HUB TRỢ LÝ AI GIÁO VIÊN (ĐỒNG BỘ PHONG CÁCH VỚI AI HUB HỌC SINH)
  // ======================================================================
  if (activeView === 'hub') {
    const td = topicsSummary.data;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 60, gap: 22, maxWidth: 980, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header chào mừng */}
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Txt size={22}>👋</Txt>
            <Txt f="displayHeavy" size={24} color={c.muc}>
              Trợ lý AI Giảng dạy Đông A — Hào Khí Đông A
            </Txt>
          </View>
          <Txt f="bold" size={20} center color={c.muc}>
            Tra cứu Sử liệu • Số hóa Đề Word
          </Txt>
          <Txt size={14} center color={c.muc2} style={{ maxWidth: 700 }}>
            Không gian AI dành riêng cho Thầy Cô Lịch sử 7: Hỏi đáp đối chiếu SGK & ĐVSKTT, bóc tách đề Word (.docx) & trộn mã đề và theo dõi câu hỏi học sinh.
          </Txt>
        </View>

        {/* Lưới 3 Thẻ Tính năng chính (Đồng bộ thiết kế 3 Card với Student AI Hub) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {/* Card 1: Hỏi đáp Sử liệu & Nhập vai */}
          <Pressable
            onPress={() => setActiveView('ask')}
            testID="teacher-ai-ask-card"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} color="#4F46E5" />
              </View>
              <Chip text="SGK 7 • ĐVSKTT" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Tra cứu Sử liệu</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tra cứu sử liệu có trích dẫn nguồn chính sử; các cuộc trò chuyện được lưu ở cột lịch sử để mở lại.
              </Txt>
            </View>
          </Pressable>

          {/* Card 2: Số hóa Đề Word (.docx) & Trộn đề */}
          <Pressable
            onPress={() => setActiveView('smart_exam')}
            testID="teacher-ai-smart-exam-card"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                <ListChecks size={22} color="#059669" />
              </View>
              <Chip text="Word .docx • Trộn đề" bg={c.ngocNhat} fg={c.ngocChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Số hóa Đề Word & Trộn đề</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tải lên đề thi .docx bất kỳ để tự động bóc tách 9 dạng câu hỏi, biên tập trực quan, trình chiếu và trộn mã đề 101–104.
              </Txt>
            </View>
          </Pressable>

        </View>

        {/* Thẻ Tổng hợp bên dưới: Nhu cầu Học tập Lớp học ("Học sinh hỏi gì") */}
        <Card style={{ padding: 18, gap: 14, borderRadius: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquareText size={19} color={c.dongChu} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Txt f="bold" size={16} color={c.muc}>
                    Tổng hợp Chủ đề Học sinh Hỏi AI (30 ngày)
                  </Txt>
                  <Chip text="Ẩn danh · Theo lớp" bg={c.thuyNhat} fg={c.thuyChu} />
                </View>
                <Txt size={12} color={c.muc2}>
                  Thống kê ẩn danh những chủ đề học sinh hay hỏi Trợ lý AI để thầy cô điều chỉnh trọng tâm bài giảng
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn
                icon={ChartColumn}
                title="Xem thống kê chi tiết"
                tone="ngoc"
                size="sm"
                onPress={() => setActiveView('topics')}
                testID="teacher-ai-topics-btn"
              />
              <Btn
                icon={RefreshCw}
                title="Làm mới"
                tone="giay"
                size="sm"
                loading={topicsSummary.loading}
                onPress={topicsSummary.reload}
              />
            </View>
          </View>

          {topicsSummary.loading && !td ? (
            <Spinner label="Đang tổng hợp câu hỏi học sinh trong 30 ngày qua…" />
          ) : td ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip text={`${td.questions} lượt hỏi`} bg={c.thuyNhat} fg={c.thuyChu} />
                <Chip text={`${td.students} học sinh đã hỏi`} bg={c.ngocNhat} fg={c.ngocChu} />
                <Chip text={`${td.refused} câu ngoài phạm vi`} bg={c.the2} fg={c.muc2} />
              </View>
              {td.topics.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {td.topics.slice(0, 4).map((tp) => (
                    <View
                      key={`${tp.kind}-${tp.id}`}
                      style={{
                        width: '48%',
                        flexGrow: 1,
                        minWidth: 260,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.vien,
                        backgroundColor: c.giay2,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Txt f="bold" size={14} color={c.muc}>{tp.title}</Txt>
                        <Txt size={12} color={c.muc3}>{KIND_LABEL[tp.kind] ?? tp.kind}</Txt>
                      </View>
                      <Chip text={`${tp.asked} lượt hỏi`} bg={c.dongNhat} fg={c.dongChu} />
                    </View>
                  ))}
                </View>
              ) : (
                <Txt size={13} color={c.muc2}>
                  Chưa có câu hỏi nào từ học sinh trong 30 ngày qua. Thầy cô có thể dùng “Số hóa Đề Word” ở trên để chuẩn bị học liệu cho lớp.
                </Txt>
              )}
            </View>
          ) : (
            <Txt size={13} color={c.muc2}>
              Bấm “Xem thống kê chi tiết” để kiểm tra báo cáo câu hỏi theo 7, 30 hoặc 90 ngày.
            </Txt>
          )}
        </Card>
      </ScrollView>
    );
  }

  // ======================================================================
  // 2. GIAO DIỆN CON: HỎI ĐÁP SỬ LIỆU & NHẬP VAI (CỦA GIÁO VIÊN)
  // ======================================================================
  if (activeView === 'ask') return <TeacherAsk session={session} onBack={() => setActiveView('hub')} />;

  // ======================================================================
  // 3. GIAO DIỆN CON: SỐ HÓA ĐỀ WORD (.DOCX) & TRỘN MÃ ĐỀ
  // ======================================================================
  if (activeView === 'smart_exam') {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1180, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Số hóa Đề thi Word (.docx) & Trộn mã đề 101–104</Txt>
        </View>
        <SmartExamStudio
          session={session}
          initialMode="upload"
          authorName={session.user.full_name}
          onClose={() => setActiveView('hub')}
          onPublishedToLibrary={() => {
            if (onGoLibrary) onGoLibrary();
            else setActiveView('hub');
          }}
        />
      </ScrollView>
    );
  }

  // ======================================================================
  // 5. GIAO DIỆN CON: THỐNG KÊ "HỌC SINH HỎI GÌ"
  // ======================================================================
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1020, alignSelf: 'center', width: '100%' }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
        <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Thống kê Chủ đề Học sinh Hỏi AI</Txt>
      </View>
      <Topics session={session} />
    </ScrollView>
  );
};
