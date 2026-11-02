/**
 * Trình chiếu Sa bàn 3D trận đánh trên lớp (HK.GV.084): nút "Mở Sa bàn 3D" trên thanh công cụ của giáo viên mở màn hình toàn cửa sổ, chọn một trận
 * để dựng địa hình 3D và phát lại hướng tiến quân / rút quân của hai bên khi giảng bài. Chữ lớn để chiếu lên lớp; máy yếu tự dùng bản vẽ 2D nhẹ.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, Cuboid, Maximize } from 'lucide-react-native';
import * as war from '@/api/warApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { SandTableView } from '@/components/portal/SandTableView';
import { Btn, Card, Chip, EmptyState, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { SandtableDetail } from '@/types/sandtable';

export const SandPresenter: React.FC<{ session: Session; onClose: () => void }> = ({ session, onClose }) => {
  const { c } = useTheme();
  const list = useLoad(() => war.sandtables(session.token), [session.token], session.expired);
  const [detail, setDetail] = useState<SandtableDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const open = async (id: number) => {
    setLoading(true);
    setError(null);
    try { setDetail(await war.sandtable(session.token, id)); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  };
  const fullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: c.giay }} accessibilityViewIsModal testID="sand-presenter">
      <View style={{ minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
        <Btn icon={ArrowLeft} title={detail ? 'Chọn trận khác' : 'Đóng'} tone="giay" size="sm" onPress={() => (detail ? setDetail(null) : onClose())} testID="sand-back" />
        <Cuboid size={22} color={c.sonChu} />
        <Txt f="bold" size={17} style={{ flex: 1 }} numberOfLines={1}>Sa bàn 3D trận đánh</Txt>
        <Btn icon={Maximize} label="Toàn màn hình" tone="giay" size="sm" onPress={fullscreen} />
        {detail ? <Btn title="Đóng" tone="giay" size="sm" onPress={onClose} testID="sand-close" /> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, maxWidth: 1100, width: '100%', alignSelf: 'center', gap: 16 }}>
        <ErrorNote message={error ?? list.error} />
        {(list.loading && !list.data) || loading ? <Spinner label="Đang tải sa bàn…" /> : null}
        {!detail && list.data && !list.data.length ? <EmptyState mood="thinking" title="Chưa có sa bàn nào" text="Quản trị tổng cần soạn sa bàn và phát hành màn chơi tương ứng." /> : null}
        {!detail ? (
          <View style={{ gap: 10 }}>
            {list.data?.length ? <Txt size={15} color={c.muc2}>Chọn một trận để trình chiếu địa hình 3D và phát lại hướng tiến quân – rút quân của hai bên.</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {list.data?.map((s) => (
                <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Mở sa bàn ${s.battle_name}`} onPress={() => open(s.id)} testID={`sand-pick-${s.id}`} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 280, maxWidth: 360, opacity: pressed ? 0.9 : 1 })}>
                  <Card style={{ gap: 6 }}>
                    <Txt f="displayHeavy" size={20}>{s.battle_name}</Txt>
                    <Txt size={14} color={c.muc2}>{s.year ? `Năm ${s.year}` : ''}{s.campaign_title ? ` · ${s.campaign_title}` : ''}</Txt>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Chip text={`${s.steps} bước diễn biến`} bg={c.thuyNhat} fg={c.thuyChu} />
                      {s.status === 'draft' ? <Chip text="Bản nháp (chỉ quản trị thấy)" bg={c.vangNhat} fg={c.vangChu} /> : null}
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        ) : <SandTableView detail={detail} start3d presenter />}
      </ScrollView>
    </View>
  );
};
