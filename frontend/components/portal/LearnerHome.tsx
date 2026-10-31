/**
 * Trang của học sinh (/hoc-sinh) và giáo viên (/giao-vien) trong Sprint 1: hồ sơ, đổi mật khẩu, đăng xuất (thanh trên cùng),
 * học sinh tham gia lớp bằng mã 6 ký tự và xem các lớp đã tham gia (HK.HS.008), giáo viên xem lớp được phân công kèm mã tham gia (HK.GV.005).
 * Các chức năng học tập, hành trình, bài tập sẽ bổ sung ở các sprint sau.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LogIn } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { TopBar, type Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, PaperBg, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export const LearnerHome: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const student = session.user.role === 'student';
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  const classes = profile.data?.classes ?? [];
  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <TopBar session={session} subtitle={student ? 'Học lịch sử cùng Hào Khí Đông A' : 'Các lớp được phân công'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16, maxWidth: 880, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Txt f="displayHeavy" size={26} accessibilityRole="header">Xin chào, {session.user.nickname || session.user.full_name}!</Txt>
          <Txt size={14} color={c.muc2}>
            {profile.data?.school ? `${profile.data.school.name}${profile.data.school_year ? ` · Năm học ${profile.data.school_year.label}` : ''}` : student ? 'Tài khoản tự học – chưa thuộc trường nào' : 'Chưa gán trường'}
          </Txt>
        </View>
        {student ? <JoinClass session={session} onJoined={profile.reload} disabled={!session.user.school_id} /> : null}
        <ErrorNote message={profile.error} />
        {profile.loading && !profile.data ? <Spinner label="Đang tải…" /> : null}
        <Txt f="bold" size={18}>{student ? 'Lớp của em' : 'Lớp phụ trách'}</Txt>
        {profile.data && classes.length === 0 ? (
          <EmptyState mood="thinking" title={student ? 'Em chưa tham gia lớp nào' : 'Bạn chưa được phân công lớp nào'}
            text={student ? 'Nhập mã lớp 6 ký tự do giáo viên cung cấp để vào lớp. Một học sinh có thể thuộc nhiều lớp.' : 'Quản trị viên nhà trường phân công giáo viên cho từng lớp theo năm học.'} />
        ) : null}
        {classes.map((k) => (
          <Card key={k.id} flat pad={14} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Txt f="displayHeavy" size={20}>{k.name}</Txt>
              <Chip text={`Khối ${k.grade ?? '?'}`} bg={c.thuyNhat} fg={c.thuyChu} />
              <Chip text={k.school_year} bg={c.dichNhat} fg={c.dich} />
              {!k.is_active ? <Chip text="Đã lưu trữ" bg={c.vangNhat} fg={c.vangChu} /> : null}
            </View>
            {k.teachers?.length ? <Txt size={14} color={c.muc2}>Giáo viên: {k.teachers.join(', ')}</Txt> : null}
            {!student && k.join_code ? (
              <View style={{ gap: 2 }}>
                <Txt size={12} color={c.muc3}>Mã tham gia lớp (đọc cho học sinh nhập)</Txt>
                <Txt f="bold" size={26} selectable style={{ letterSpacing: 5 }}>{k.join_code}</Txt>
              </View>
            ) : null}
          </Card>
        ))}
        <InfoNote>Hành trình học, bài tập, thi đấu và trợ lý AI sẽ được mở ở các giai đoạn tiếp theo của dự án.</InfoNote>
      </ScrollView>
    </View>
  );
};

const JoinClass: React.FC<{ session: Session; onJoined: () => void; disabled: boolean }> = ({ session, onJoined, disabled }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) return setError('Mã lớp gồm 6 ký tự.');
    setBusy(true);
    setError(null);
    try {
      const cls = await authApi.joinClass(session.token, clean);
      toast(`Đã vào lớp ${cls.name}`);
      setCode('');
      onJoined();
    } catch (e) {
      setError(errorMessage(e, 'Chưa vào được lớp.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card flat pad={16} style={{ gap: 10 }}>
      <Txt f="bold" size={16}>Tham gia lớp bằng mã</Txt>
      {disabled ? <Txt size={14} color={c.muc2}>Tài khoản tự học không thuộc trường nên chưa tham gia lớp được. Hãy nhờ giáo viên hoặc nhà trường cấp tài khoản.</Txt> : (
        <>
          <Field label="Mã lớp 6 ký tự" value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} autoCapitalize="characters" autoCorrect={false} placeholder="vd: K7M3PX" error={error} onSubmitEditing={join} inputStyle={{ letterSpacing: 4, fontSize: 18 }} nativeID="join-code" />
          <Btn title="Vào lớp" icon={LogIn} tone="son" loading={busy} onPress={join} testID="join-submit" />
        </>
      )}
    </Card>
  );
};
