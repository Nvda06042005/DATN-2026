/**
 * Nhận diện của một trường: logo chính thức (lấy từ website của Sở GD&ĐT, xem scripts/fetch-school-logos.py), tên + khu vực ở trang đăng nhập riêng,
 * và hộp đường dẫn riêng để quản trị tổng chép gửi cho trường. Trường chưa có logo chính thức chỉ hiện khung trống trung tính, không vẽ logo giả.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import { Check, Copy, ExternalLink, School } from 'lucide-react-native';
import { Btn, Inset, Txt, useToast } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { copyText } from '@/lib/clipboard';
import { schoolLogoUrl } from '@/lib/school-logos';
import { API_BASE_URL } from '@/api/client';
import type { SchoolLink } from '@/types/api';

/** Logo chính thức của trường: logo riêng đã đặt ở mục Sửa thì ưu tiên, nếu không thì logo lấy từ website Sở GD&ĐT; chưa có thì khung trống trung tính */
export const SchoolEmblem: React.FC<{ name: string; code: string; logoUrl?: string | null; size?: number }> = ({ name, code, logoUrl, size = 56 }) => {
  const { c } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const source = logoUrl || schoolLogoUrl(code);
  const src = source?.startsWith('/api/') ? `${API_BASE_URL}${source}` : source;
  if (src && failed !== src) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={`Logo ${name}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: '#ffffff', borderWidth: 1, borderColor: c.vien, padding: Math.max(2, Math.round(size * 0.06)) }}>
        <Image source={{ uri: src }} onError={() => setFailed(src)} accessibilityIgnoresInvertColors resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${name} (chưa có logo)`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: c.dichNhat, borderWidth: 1, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
      <School size={Math.round(size * 0.5)} color={c.muc3} strokeWidth={1.6} />
    </View>
  );
};

export interface SchoolBrandInfo { school_code: string; name: string; region: string | null; city: string | null; logo_url: string | null }

/** Tên trường ở góc trang đăng nhập riêng: huy hiệu + tên + khu vực */
export const SchoolBadge: React.FC<{ school: SchoolBrandInfo; light?: boolean }> = ({ school, light }) => {
  const { c } = useTheme();
  const place = [school.region, school.city].filter(Boolean).join(' · ');
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${school.name}${place ? `, ${place}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 360 }}>
      <SchoolEmblem name={school.name} code={school.school_code} logoUrl={school.logo_url} size={52} />
      <View style={{ flexShrink: 1 }}>
        <Txt f="bold" size={18} color={light ? c.trang : c.logoInk} numberOfLines={2}>{school.name}</Txt>
        {place ? <Txt f="semibold" size={11} color={light ? 'rgba(255,255,255,0.85)' : c.muc2} numberOfLines={2}>{place}</Txt> : null}
      </View>
    </View>
  );
};

/** Đường dẫn riêng của trường: chép hoặc mở ngay, để quản trị tổng gửi cho trường dùng */
export const SchoolLinkBox: React.FC<{ link: SchoolLink }> = ({ link }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // phản hồi ngay tại nút (nhãn đổi thành "Đã sao chép") và bằng thông báo, vì thông báo chỉ là phần phụ
  const copyLink = async () => {
    const ok = await copyText(link.url);
    setCopy(ok ? 'done' : 'failed');
    toast(ok ? 'Đã sao chép đường dẫn của trường' : 'Không sao chép tự động được, hãy chọn đường dẫn rồi chép thủ công.');
    if (timer.current) clearTimeout(timer.current);
    if (ok) timer.current = setTimeout(() => setCopy('idle'), 2500);
  };
  return (
    <Inset style={{ gap: 8 }}>
      <Txt f="bold" size={13} color={c.muc2}>Đường dẫn riêng của trường</Txt>
      <Txt size={14} selectable testID="school-link-url" style={{ fontFamily: FONT.mono }}>{link.url}</Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {Platform.OS === 'web' && <Btn title={copy === 'done' ? 'Đã sao chép' : 'Sao chép'} icon={copy === 'done' ? Check : Copy} tone="giay" size="sm" onPress={copyLink} testID="school-link-copy" />}
        <Btn title="Mở trang" icon={ExternalLink} tone="giay" size="sm" onPress={() => { void Linking.openURL(link.url); }} testID="school-link-open" />
      </View>
      {copy === 'failed' ? <Txt size={12} f="semibold" color={c.sonChu} testID="school-link-copy-failed">Trình duyệt chặn sao chép tự động. Hãy chọn đường dẫn ở trên rồi chép thủ công.</Txt> : null}
      <Txt size={12} color={c.muc3}>Học sinh, giáo viên và quản trị viên của trường dùng đường dẫn này để đăng nhập; tài khoản của trường khác không vào được.</Txt>
    </Inset>
  );
};
