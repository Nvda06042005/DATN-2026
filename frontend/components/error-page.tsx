/**
 * Trang báo lỗi thân thiện (Sprint 11, HK.HS.112, HK.GV.082, HK.QT.055): 404 khi địa chỉ không tồn tại và trang lỗi khi một màn hình bị sự cố.
 * Luôn có nút quay về trang chủ; không hiện chi tiết kỹ thuật cho người dùng cuối (chi tiết chỉ in ra bảng điều khiển để người phát triển xem).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Home, RotateCcw } from 'lucide-react-native';
import { Btn, EmptyState, Screen, Txt } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useTheme } from '@/hooks/use-theme';

const PORTALS = [{ href: '/hoc-sinh', label: 'Trang học sinh' }, { href: '/giao-vien', label: 'Trang giáo viên' }] as const;

export const ErrorPage: React.FC<{ kind: 'not-found' | 'crash'; onRetry?: () => void; detail?: string }> = ({ kind, onRetry, detail }) => {
  const router = useRouter();
  const { c } = useTheme();
  useDocumentTitle(kind === 'not-found' ? 'Không tìm thấy trang – Hào Khí Đông A' : 'Có sự cố – Hào Khí Đông A');
  useEffect(() => { if (kind === 'crash' && detail) console.error(detail); }, [kind, detail]);
  return (
    <Screen maxWidth={560}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 18, minHeight: 420 }}>
        <EmptyState mood={kind === 'not-found' ? 'thinking' : 'sad'} title={kind === 'not-found' ? 'Ôi, không tìm thấy trang này' : 'Rất tiếc, đã có sự cố'}
          text={kind === 'not-found' ? 'Đường dẫn có thể đã gõ sai hoặc trang không còn nữa. Bạn quay về trang chủ rồi đi tiếp nhé.' : 'Màn hình này gặp lỗi. Hãy thử tải lại; nếu vẫn lỗi, quay về trang chủ và báo cho thầy cô hoặc quản trị viên ở mục Trợ giúp.'} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <Btn icon={Home} title="Về trang chủ" tone="ngoc" onPress={() => router.replace('/')} testID="error-home" />
          {onRetry ? <Btn icon={RotateCcw} title="Thử lại" tone="giay" onPress={onRetry} testID="error-retry" /> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {PORTALS.map((p) => <Txt key={p.href} size={14} color={c.thuyChu} accessibilityRole="link" onPress={() => router.replace(p.href)}>{p.label}</Txt>)}
        </View>
      </View>
    </Screen>
  );
};
