/**
 * Thi đấu cả lớp (máy học sinh): nhập mã PIN thầy cô đọc, chọn đáp án trên ô màu, xem đúng/sai, điểm và hạng.
 * Server chấm từng câu và cộng XP, Ấn Tín như khi luyện tập; mất mạng thì tự nối lại đúng phòng.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Check, Clock, Info, Radio, Trophy, Users, WifiOff, X } from 'lucide-react-native';
import { KahootShape, Mascot } from '@/components/art';
import { LiveTimer } from '@/components/live';
import { Btn, Card, Chip, InlineSheet, PaperBg, Spinner, Txt } from '@/components/ui';
import { ANSWER_STYLES, FONT } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useLiveSocket } from '@/hooks/use-live-socket';
import { useTheme } from '@/hooks/use-theme';
import { useCountdown } from '@/hooks/use-timers';
import { fmt, formatPin, sameLiveKey, shortName } from '@/lib/format';
import { rememberLiveRoom } from '@/lib/storage';
import type { LiveKey, LivePlayerState } from '@/types/api';

export const LiveArena: React.FC<{
  token: string;
  initialPin: string | null;
  /** Mở lại sau khi tải trang: server báo không còn trong phòng thì đóng luôn */
  resume: boolean;
  onClose: () => void;
  onExpired: () => void;
}> = (props) => (
  <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={props.onClose} statusBarTranslucent>
    <ArenaBody {...props} />
  </Modal>
);

const ArenaBody: React.FC<React.ComponentProps<typeof LiveArena>> = ({ token, initialPin, resume, onClose, onExpired }) => {
  const { sound } = useGame();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<LivePlayerState | null>(null);
  const [ready, setReady] = useState(false);
  const [final, setFinal] = useState<LivePlayerState | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [pin, setPin] = useState(initialPin ?? '');
  const [joining, setJoining] = useState(false);
  const [seconds, startTimer] = useCountdown();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const autoPin = useRef(initialPin);
  const firstMessage = useRef(true);
  const cue = useRef('');

  const { status, send, reconnect } = useLiveSocket(token, (msg, sendNow) => {
    if (msg.type === 'state') {
      const s = msg.state;
      const first = firstMessage.current;
      firstMessage.current = false;
      setReady(true);
      setJoining(false);
      setState(s);
      startTimer(s?.phase === 'question' ? s.remaining_ms : null);
      if (s) {
        setNotice(null);
        setFinal(null);
        rememberLiveRoom(s.pin);
        const key = s.phase === 'reveal' ? `${s.pin}-${s.index}` : s.phase === 'podium' ? `${s.pin}-podium` : '';
        if (key && cue.current !== key) {
          cue.current = key;
          sound(s.phase === 'podium' ? (s.me.rank <= 3 ? 'win' : 'ok') : s.me.last_correct ? 'ok' : 'bad');
        }
        return;
      }
      rememberLiveRoom(null);
      if (autoPin.current) {
        const p = autoPin.current;
        autoPin.current = null;
        setJoining(sendNow({ type: 'join', pin: p }));
      } else if (first && resume) onClose();
    } else if (msg.type === 'error') {
      setJoining(false);
      setNotice({ tone: 'error', text: msg.message });
    } else if (msg.type === 'kicked') {
      rememberLiveRoom(null);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'error', text: 'Thầy cô đã mời em ra khỏi phòng thi đấu.' });
    } else if (msg.type === 'closed') {
      rememberLiveRoom(null);
      setFinal(state);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'info', text: msg.reason === 'expired' ? 'Phòng thi đấu đã hết hạn.' : 'Thầy cô đã đóng phòng thi đấu.' });
    }
  });

  useEffect(() => {
    if (status === 'expired') onExpired();
  }, [status, onExpired]);

  const close = () => {
    if (state) send({ type: 'leave' });
    rememberLiveRoom(null);
    onClose();
  };
  const requestClose = () => {
    if (state && state.phase !== 'podium') setConfirmLeave(true);
    else close();
  };
  const join = () => {
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) return setNotice({ tone: 'error', text: 'Mã PIN gồm 6 chữ số trên màn hình của thầy cô.' });
    setNotice(null);
    if (send({ type: 'join', pin: p })) setJoining(true);
    else setNotice({ tone: 'error', text: 'Chưa kết nối được máy chủ – em thử lại sau giây lát nhé.' });
  };
  const answer = (key: LiveKey) => {
    if (!state?.question || state.me.answered) return;
    if (!send({ type: 'answer', question_id: state.question.id, choice: key })) setNotice({ tone: 'error', text: 'Mất kết nối – đang nối lại, em bấm lại nhé.' });
  };

  const me = state?.me;
  const q = state?.question ?? null;
  const rightOption = q && state?.reveal ? q.options.find((o) => sameLiveKey(o.key, state.reveal?.key)) : undefined;
  const rightIndex = q && rightOption ? q.options.indexOf(rightOption) : -1;

  const NoticeBox = notice ? (
    <View
      accessibilityRole={notice.tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: 8, borderRadius: 16, padding: 12, backgroundColor: notice.tone === 'error' ? c.sonNhat : c.ngocNhat }}
    >
      {notice.tone === 'error' ? <AlertCircle size={20} color={c.sonChu} /> : <Info size={20} color={c.ngocChu} />}
      <Txt f="semibold" color={notice.tone === 'error' ? c.sonChu : c.ngocChu} style={{ flex: 1 }}>
        {notice.text}
      </Txt>
    </View>
  ) : null;

  const resultCard = (s: LivePlayerState, heading: string) => (
    <Card pad={20} style={{ alignItems: 'center', gap: 10 }}>
      <Mascot size={110} mood={s.me.rank <= 3 ? 'love' : 'happy'} accessory={s.me.rank === 1 ? 'crown' : 'helmet'} bob />
      <Txt f="displayHeavy" size={24} center accessibilityRole="header">
        {heading}
      </Txt>
      <Txt f="displayHeavy" size={46} color={c.sonChu}>
        Hạng {s.me.rank}
      </Txt>
      <Txt f="semibold" color={c.muc2} center>
        {fmt(s.me.score)} điểm · đúng {s.me.correct}/{s.me.answered_total} câu đã trả lời
      </Txt>
      {s.top.length > 0 && (
        <View style={{ alignSelf: 'stretch', maxWidth: 320, alignItems: 'stretch', gap: 6, marginHorizontal: 'auto' }} accessibilityLabel="Ba bạn dẫn đầu">
          {s.top.map((t, i) => (
            <View key={`${t.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ['#d97706', '#c0c0c0', '#cd7f32'][i] }}>
                <Txt f="displayHeavy" size={14} color="#1f1600">
                  {i + 1}
                </Txt>
              </View>
              <Txt f="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {shortName(t.name)}
              </Txt>
              <Txt f="semibold" color={c.muc2}>
                {fmt(t.score)}
              </Txt>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  let content: React.ReactNode;
  if (status === 'replaced') {
    content = (
      <Card pad={20} style={{ alignItems: 'center', gap: 10 }}>
        <Txt f="displayHeavy" size={20} center accessibilityRole="header">
          Phòng thi đấu đang mở ở nơi khác
        </Txt>
        <Txt color={c.muc2} center>
          Em vừa mở phòng thi đấu ở một tab hoặc thiết bị khác.
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <Btn title="Chơi ở đây" onPress={reconnect} />
          <Btn title="Đóng" tone="giay" onPress={onClose} />
        </View>
      </Card>
    );
  } else if (!ready) {
    content = (
      <View style={{ paddingVertical: 60 }}>
        <Spinner label={status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'} />
      </View>
    );
  } else if (!state) {
    content = (
      <View style={{ gap: 14 }}>
        {NoticeBox}
        {final ? (
          <>
            {resultCard(final, 'Kết quả của em')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn title="Vào phòng khác" tone="giay" full style={{ flex: 1 }} onPress={() => setFinal(null)} />
              <Btn title="Về Quốc Tử Giám" full style={{ flex: 1 }} onPress={close} />
            </View>
          </>
        ) : (
          <Card pad={20} style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot size={76} mood="excited" accessory="helmet" bob />
              <View style={{ flex: 1 }}>
                <Txt f="displayHeavy" size={24} accessibilityRole="header">
                  Vào phòng thi đấu
                </Txt>
                <Txt size={14} color={c.muc2}>
                  Nhập mã PIN 6 chữ số trên màn hình của thầy cô.
                </Txt>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Txt f="display" size={16}>
                Mã PIN
              </Txt>
              <TextInput
                nativeID="live-pin"
                value={pin}
                onChangeText={(v) => setPin(v.replace(/[^\d ]/g, ''))}
                inputMode="numeric"
                keyboardType="number-pad"
                autoComplete="off"
                maxLength={7}
                accessibilityLabel="Mã PIN"
                accessibilityHint="Câu trả lời được máy chủ chấm và cộng XP, Ấn Tín như khi luyện tập."
                returnKeyType="go"
                onSubmitEditing={join}
                autoFocus
                style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the, textAlign: 'center', fontFamily: FONT.displayHeavy, fontSize: 30, letterSpacing: 8, color: c.muc }}
              />
              <Txt size={12} color={c.muc2}>
                Câu trả lời được máy chủ chấm và cộng XP, Ấn Tín như khi luyện tập.
              </Txt>
            </View>
            <Btn title="Vào phòng" icon={Radio} size="lg" full loading={joining} disabled={status !== 'open'} onPress={join} testID="live-join" />
          </Card>
        )}
      </View>
    );
  } else if (state.phase === 'lobby' && me) {
    content = (
      <Card pad={24} style={{ alignItems: 'center', gap: 10 }}>
        <Mascot size={120} mood="excited" accessory="helmet" bob />
        <Txt f="displayHeavy" size={24} center accessibilityRole="header">
          Em đã vào phòng!
        </Txt>
        <Txt color={c.muc2} center>
          <Txt f="bold">{me.name}</Txt> – chờ thầy cô bắt đầu trận nhé.
        </Txt>
        <Chip text={`${state.players} bạn trong phòng`} icon={Users} bg={c.ngocNhat} fg={c.ngocChu} style={{ alignSelf: 'center' }} />
        <Txt size={14} color={c.muc2} center>
          Mỗi câu {Math.round(state.duration_ms / 1000)} giây · {state.total} câu · trả lời đúng và nhanh để được nhiều điểm
        </Txt>
      </Card>
    );
  } else if ((state.phase === 'question' || state.phase === 'reveal') && q && me) {
    const revealed = state.phase === 'reveal';
    const ok = me.last_correct;
    content = (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {!revealed && <LiveTimer seconds={seconds} total={state.duration_ms / 1000} size={64} />}
          <View style={{ flex: 1 }}>
            <Txt f="semibold" size={14} color={c.muc2}>
              Câu {state.index + 1}/{state.total}
            </Txt>
            <Txt f="semibold" size={14} color={c.muc2} numberOfLines={1}>
              {q.topic}
            </Txt>
          </View>
        </View>
        <Card pad={16}>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">
            {q.prompt}
          </Txt>
        </Card>
        {revealed ? (
          <View style={{ gap: 12 }}>
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, backgroundColor: ok ? c.ngoc : ok === false ? c.son : c.giay2 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                {ok ? <Check size={28} color="#ffffff" strokeWidth={3} /> : ok === false ? <X size={28} color="#ffffff" strokeWidth={3} /> : <Clock size={28} color={c.muc} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="displayHeavy" size={22} color={ok === null ? c.muc : '#ffffff'}>
                  {ok ? 'Chính xác!' : ok === false ? 'Chưa đúng' : 'Hết giờ'}
                </Txt>
                <Txt f="semibold" color={ok === null ? c.muc : '#ffffff'}>
                  {ok ? `+${me.last_gain} điểm` : 'Không có điểm câu này'}
                  {me.streak >= 2 ? ` · ${me.streak} câu đúng liên tiếp` : ''}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt f="displayHeavy" color={ok === null ? c.muc : '#ffffff'}>
                  Hạng {me.rank}
                </Txt>
                <Txt f="semibold" size={13} color={ok === null ? c.muc2 : 'rgba(255,255,255,0.9)'}>
                  {fmt(me.score)} điểm
                </Txt>
              </View>
            </View>
            {rightOption && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].bg }}>
                <KahootShape shape={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].shape} size={26} color={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg} />
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={12} color={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg}>
                    Đáp án đúng
                  </Txt>
                  <Txt f="displayHeavy" size={18} color={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg}>
                    {rightOption.text}
                  </Txt>
                </View>
              </View>
            )}
            {state.reveal && (
              <Card pad={16} style={{ flexDirection: 'row', gap: 8 }}>
                <Info size={16} color={c.ngocChu} style={{ marginTop: 3 }} />
                <Txt size={14} style={{ flex: 1 }}>
                  {state.reveal.explanation}
                </Txt>
              </Card>
            )}
            <Txt size={14} color={c.muc2} center>
              Chờ thầy cô chuyển sang bảng điểm…
            </Txt>
          </View>
        ) : (
          <>
            <Txt f="semibold" size={14} color={c.muc2} accessibilityLiveRegion="polite">
              {me.answered ? 'Đã chốt đáp án! Chờ cả lớp trả lời…' : 'Chọn một đáp án:'}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {q.options.map((o, i) => {
                const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                const chosen = sameLiveKey(me.choice, o.key);
                const two = q.options.length <= 2 || width >= 420;
                return (
                  <Pressable
                    key={String(o.key)}
                    disabled={me.answered || seconds === 0}
                    onPress={() => answer(o.key)}
                    accessibilityRole="button"
                    accessibilityLabel={o.text}
                    accessibilityState={{ selected: chosen, disabled: me.answered || seconds === 0 }}
                    style={({ pressed }) => ({
                      flexBasis: two ? '47%' : '100%', flexGrow: 1, minHeight: 88, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                      backgroundColor: s.bg, borderBottomWidth: pressed ? 2 : 5, borderBottomColor: s.shadow, marginTop: pressed ? 3 : 0, opacity: me.answered && !chosen ? 0.35 : 1,
                      borderWidth: chosen ? 4 : 0, borderColor: c.muc,
                    })}
                  >
                    <KahootShape shape={s.shape} size={30} color={s.fg} />
                    <Txt f="displayHeavy" size={18} color={s.fg} style={{ flex: 1 }}>
                      {o.text}
                    </Txt>
                    {chosen && <Check size={24} color={s.fg} strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>
            {notice?.tone === 'error' && NoticeBox}
          </>
        )}
      </View>
    );
  } else if (state.phase === 'scoreboard' && me) {
    content = (
      <View style={{ gap: 12 }}>
        {resultCard(state, 'Bảng điểm')}
        <Txt size={14} color={c.muc2} center>
          Chờ câu tiếp theo…
        </Txt>
      </View>
    );
  } else if (me) {
    content = (
      <View style={{ gap: 12 }}>
        {resultCard(state, 'Kết thúc trận!')}
        <Btn title="Về Quốc Tử Giám" size="lg" full onPress={close} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }} role="dialog" aria-label={state?.title ?? 'Thi đấu cả lớp'}>
      <PaperBg />
      <View style={{ borderBottomWidth: 2, borderBottomColor: c.vien, backgroundColor: c.the }}>
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center' }}>
            <Radio size={20} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt f="displayHeavy" size={16} numberOfLines={1}>
              {state?.title ?? final?.title ?? 'Thi đấu cả lớp'}
            </Txt>
            <Txt f="semibold" size={12} color={c.muc2} numberOfLines={1}>
              {state ? `Phòng ${formatPin(state.pin)} · ${state.players} bạn` : 'Cùng cả lớp trả lời câu hỏi của thầy cô'}
            </Txt>
          </View>
          {me && <Chip text={fmt(me.score)} icon={Trophy} bg={c.the} fg={c.muc} style={{ borderWidth: 2, borderColor: c.vien }} />}
          <Btn tone="ghost" icon={X} label={state && state.phase !== 'podium' ? 'Rời phòng thi đấu' : 'Đóng thi đấu cả lớp'} onPress={requestClose} />
        </View>
        {(status === 'reconnecting' || (state && !state.host_online)) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: c.dongNhat }} accessibilityLiveRegion="polite">
            <WifiOff size={16} color={c.dongChu} />
            <Txt f="semibold" size={14} color={c.dongChu}>
              {status === 'reconnecting' ? 'Mất kết nối – đang nối lại…' : 'Thầy cô đang mất kết nối – chờ một chút…'}
            </Txt>
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 760, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
      <InlineSheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Rời phòng thi đấu?" subtitle="Các câu em đã trả lời vẫn được tính. Muốn chơi tiếp thì nhập lại mã PIN.">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="Rời phòng" full style={{ flex: 1 }} onPress={close} />
          <Btn title="Ở lại" tone="giay" full style={{ flex: 1 }} onPress={() => setConfirmLeave(false)} />
        </View>
      </InlineSheet>
    </View>
  );
};
