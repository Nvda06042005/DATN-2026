/**
 * Ô nhập thông tin trường dùng chung cho quản trị tổng (Thêm / Sửa trường) và quản trị trường (Sửa thông tin trường), 18/11/2026:
 * - PlaceFields: tỉnh / thành phố (34 đơn vị hiện hành), phường / xã / đặc khu tìm theo chữ gõ (không còn quận / huyện từ 01/07/2025),
 *   số nhà – tên đường, và Địa chỉ tự ghép "đường, phường / xã, tỉnh / thành" (chỉ đọc). Ghi vào các giá trị city, region, street, address của biểu mẫu.
 * - SchoolLogoField: logo trường bằng ảnh tải lên (thay ô "Logo riêng (liên kết https…)"), đổi ngay khi tải, có nút bỏ logo.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ImagePlus, MapPin, Trash2 } from 'lucide-react-native';
import { errorMessage, type PickedFile } from '@/api/client';
import { pickFile, type FieldDef } from '@/components/admin/kit';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { SchoolEmblem } from '@/components/school-brand';
import { Btn, Field, Inset, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { type AdminProvince, composeAddress, filterWards, isNewUnit, isOldDistrict, loadProvinces, loadWards, matchProvince } from '@/lib/admin-units';
import { AVATAR_ONLY_IMAGES, AVATAR_TYPES, isAvatarImage } from '@/lib/avatar';

type Values = Record<string, string | string[]>;
type Setter = (name: string, value: string | string[]) => void;

/** Các ô khu vực cho FormSheet: một ô hiển thị PlaceFields, các ô ẩn chỉ để biểu mẫu giữ giá trị (quận / huyện cũ của danh mục, gợi ý phường / xã) */
export const placeFields = (token: string): FieldDef[] => [
  { name: 'city', label: 'Khu vực', render: (values, set) => <PlaceFields token={token} values={values} set={set} /> },
  ...['region', 'street', 'address', 'district', 'suggested_region'].map((name): FieldDef => ({ name, label: name, when: () => false })),
];

/** Tỉnh / thành, phường / xã / đặc khu, số nhà – đường và địa chỉ tự ghép */
export const PlaceFields: React.FC<{ token: string; values: Values; set: Setter }> = ({ token, values, set }) => {
  const { c } = useTheme();
  const city = String(values.city ?? ''), region = String(values.region ?? ''), street = String(values.street ?? '');
  const suggested = String(values.suggested_region ?? ''), district = String(values.district ?? '');
  const [provinces, setProvinces] = useState<AdminProvince[] | null>(null);
  const [wards, setWards] = useState<string[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  useEffect(() => {
    let live = true;
    loadProvinces(token).then((p) => { if (live) setProvinces(p); }).catch((e) => { if (live) setFailed(errorMessage(e, 'Chưa tải được danh sách tỉnh / thành phố.')); });
    return () => { live = false; };
  }, [token]);
  const province = provinces ? matchProvince(provinces, city) : null;
  useEffect(() => {
    if (!province) { setWards(null); return undefined; }
    let live = true;
    loadWards(token, province.name).then((w) => { if (live) setWards(w); }).catch((e) => { if (live) setFailed(errorMessage(e, 'Chưa tải được danh sách phường / xã.')); });
    return () => { live = false; };
  }, [token, province?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Đổi tỉnh / thành, phường / xã hoặc đường thì địa chỉ ghép lại ngay (quận / huyện cũ không đưa vào địa chỉ) */
  const update = (patch: { city?: string; region?: string; street?: string }) => {
    const next = { city, region, street, ...patch };
    for (const [k, v] of Object.entries(patch)) set(k, v);
    set('address', composeAddress(next.street, isNewUnit(next.region) ? next.region : null, next.city));
  };
  const options = [
    { value: '', label: provinces ? 'Chọn tỉnh / thành phố' : 'Đang tải…' },
    ...(city && !province ? [{ value: city, label: `${city} (không còn từ 01/07/2025)` }] : []),
    ...(provinces ?? []).map((p) => ({ value: p.name, label: p.name })),
  ];
  const picked = isNewUnit(region) ? region : '';
  const matches = open && wards ? filterWards(wards, query) : [];
  const choose = (ward: string) => { update({ region: ward }); setQuery(''); setOpen(false); };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ flexBasis: 240, flexGrow: 1, minWidth: 0 }}>
          <AdminSelect label="Tỉnh / thành phố" value={province?.name ?? city} options={options} testID="field-city"
            onChange={(v) => { if (v === (province?.name ?? city)) return; set('suggested_region', ''); update({ city: String(v), region: '' }); }} />
        </View>
        <View style={{ flexBasis: 240, flexGrow: 1, minWidth: 0, gap: 6 }}>
          <Field label="Phường / xã / đặc khu" nativeID="field-region" accessibilityRole="combobox" accessibilityState={{ expanded: open }}
            value={open ? query : picked} editable={!!province} placeholder={province ? 'Gõ để tìm, ví dụ Thạnh Mỹ Tây' : 'Chọn tỉnh / thành phố trước'}
            hint={province && wards ? `${wards.length} phường / xã / đặc khu của ${province.name}` : undefined}
            onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setQuery(''); setOpen(true); }}
            onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 180); }}
            onChangeText={(t) => { setQuery(t); setOpen(true); }}
            onKeyPress={(e) => { if (e.nativeEvent.key === 'Escape') setOpen(false); if (e.nativeEvent.key === 'Enter' && matches.length) choose(matches[0]); }} />
          {open && wards ? (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" accessibilityRole="list" testID="ward-list"
              style={{ maxHeight: 240, borderWidth: 1, borderColor: c.adminLine, borderRadius: 7, backgroundColor: c.the }}>
              {matches.length ? matches.map((w) => (
                <Pressable key={w} accessibilityRole="button" accessibilityLabel={`Chọn ${w}`} onPress={() => choose(w)} testID={`ward-${w}`}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: pressed || w === picked ? c.adminCanvas : c.the })}>
                  <Txt size={14} f={w === picked ? 'semibold' : 'body'}>{w}</Txt>
                </Pressable>
              )) : <Txt size={13} color={c.muc3} style={{ padding: 12 }}>Không có phường / xã nào khớp “{query}”.</Txt>}
            </ScrollView>
          ) : null}
        </View>
      </View>
      {failed ? <Txt size={13} color={c.sonChu}>{failed}</Txt> : null}
      {isOldDistrict(region) || (!picked && district) ? (
        <View testID="old-district-note"><Inset style={{ backgroundColor: c.vangNhat, gap: 2 }}>
          <Txt f="bold" size={13} color={c.vangChu}>{isOldDistrict(region) ? `Đang lưu khu vực cũ: ${region}` : `Danh mục cũ ghi: ${district}`}</Txt>
          <Txt size={13} color={c.muc}>Từ 01/07/2025 không còn cấp quận / huyện / thị xã. Hãy chọn phường / xã / đặc khu mới để địa chỉ đúng theo đơn vị hành chính hiện hành.</Txt>
        </Inset></View>
      ) : null}
      {suggested && !picked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt size={13} color={c.muc2}>Gợi ý theo tên / địa chỉ cũ của trường:</Txt>
          <Btn title={suggested} icon={MapPin} tone="giay" size="sm" label={`Chọn gợi ý ${suggested}`} onPress={() => choose(suggested)} testID="ward-suggestion" />
        </View>
      ) : null}
      <Field label="Số nhà, tên đường (thôn, ấp)" nativeID="field-street" value={street} placeholder="Ví dụ 120B Ngô Tất Tố" onChangeText={(t) => update({ street: t })} />
      <Field label="Địa chỉ (tự cập nhật)" nativeID="field-address" value={String(values.address ?? '')} editable={false}
        placeholder="Chọn tỉnh / thành, phường / xã và nhập đường để ghép địa chỉ" hint="Ghép từ số nhà – đường, phường / xã và tỉnh / thành ở trên." />
    </View>
  );
};

const LOGO_MAX = 2 * 1024 * 1024;

async function readLogo(picked: PickedFile): Promise<string> {
  if (!isAvatarImage(picked.mimeType, picked.name)) throw new Error(AVATAR_ONLY_IMAGES);
  const blob: Blob = (picked.file as Blob | undefined) ?? (await (await fetch(picked.uri)).blob());
  if (blob.size > LOGO_MAX) throw new Error('Logo tối đa 2 MB. Hãy chọn ảnh nhỏ hơn.');
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được ảnh.'));
    r.readAsDataURL(blob);
  });
}

/** Logo tải lên của trường (đường dẫn /api/school-logos/u/…) – khác logo chính thức của danh mục */
export const isUploadedLogo = (url: string | null | undefined): boolean => /\/api\/school-logos\/u\/[a-f0-9]{64}\.webp$/.test(String(url ?? ''));

/** Logo trường: xem trước, tải ảnh lên (đổi ngay), bỏ logo tải lên */
export const SchoolLogoField: React.FC<{
  name: string; code: string; logoUrl: string | null;
  upload: (data: string) => Promise<{ logo_url: string | null }>; remove: () => Promise<{ logo_url: string | null }>; onChanged?: () => void;
}> = ({ name, code, logoUrl, upload, remove, onChanged }) => {
  const { c } = useTheme();
  const [url, setUrl] = useState(logoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<{ logo_url: string | null } | null>) => {
    setBusy(true); setError(null);
    try { const next = await fn(); if (next) { setUrl(next.logo_url); onChanged?.(); } } catch (e) { setError(errorMessage(e, 'Không đổi được logo.')); } finally { setBusy(false); }
  };
  const pick = () => act(async () => {
    const picked = await pickFile(AVATAR_TYPES);
    return picked ? upload(await readLogo(picked)) : null;
  });
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={14} color={c.muc2}>Logo trường</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <SchoolEmblem name={name} code={code} logoUrl={url} size={64} />
        <View style={{ flex: 1, minWidth: 200, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn title={isUploadedLogo(url) ? 'Đổi logo' : 'Tải logo lên'} icon={ImagePlus} tone="giay" size="sm" loading={busy} onPress={pick} testID="school-logo-pick" label="Logo trường: chọn ảnh từ máy" />
            {isUploadedLogo(url) ? <Btn title="Bỏ logo tải lên" icon={Trash2} tone="giay" size="sm" disabled={busy} onPress={() => act(remove)} testID="school-logo-remove" /> : null}
          </View>
          <Txt size={12} color={c.muc3}>PNG, JPG, WEBP hoặc GIF, tối đa 2 MB; hệ thống tự thu nhỏ. Logo đổi ngay khi tải lên{isUploadedLogo(url) ? '; bỏ logo tải lên thì trường trong danh mục dùng lại logo chính thức.' : '.'}</Txt>
        </View>
      </View>
      {error ? <Txt size={13} f="semibold" color={c.sonChu} accessibilityRole="alert">{error}</Txt> : null}
    </View>
  );
};
