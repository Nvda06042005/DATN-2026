/**
 * Bộ thành phần dùng chung của các cổng quản trị: tải dữ liệu, bảng/danh sách thích ứng, thanh lọc, phân trang, biểu mẫu từ mô tả,
 * chọn nhiều, hiển thị mật khẩu tạm một lần, nhập Excel có xem trước. Giao diện phẳng (AdminUiContext) theo bảng màu sáng của dự án.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AlertTriangle, Check, CheckSquare, ChevronLeft, ChevronRight, Download, FileUp, Square } from 'lucide-react-native';
import { ApiError, errorMessage, type PickedFile } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Btn, Card, Chip, EmptyState, Field, Inset, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ImportResult } from '@/types/api';

// ---------------------------------------------------------------------- tải dữ liệu
/** Tải dữ liệu khi `deps` đổi; 401 báo phiên hết hạn; trả về hàm tải lại */
export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList, onExpired?: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const alive = useRef(0);
  useEffect(() => {
    const id = ++alive.current;
    setLoading(true);
    load()
      .then((value) => { if (id === alive.current) { setData(value); setError(null); } })
      .catch((e) => {
        if (id !== alive.current) return;
        if (e instanceof ApiError && e.status === 401) onExpired?.();
        setError(errorMessage(e, 'Không tải được dữ liệu.'));
      })
      .finally(() => { if (id === alive.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Chạy một thao tác ghi: hiện lỗi dưới dạng thông báo, trả true nếu thành công */
export function useAction(onExpired?: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, done?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const result = await fn();
      if (done) toast(done);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onExpired?.();
      toast(errorMessage(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast, onExpired]);
  return { busy, run };
}

// ---------------------------------------------------------------------- bố cục trang
export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexShrink: 1, minWidth: 220 }}>
        <Txt f="displayHeavy" size={24} accessibilityRole="header">{title}</Txt>
        {subtitle ? <Txt size={14} color={c.muc2}>{subtitle}</Txt> : null}
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }}>{actions}</View> : null}
    </View>
  );
};

export const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16, maxWidth: 1240, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) => {
  const { c } = useTheme();
  if (!message) return null;
  return (
    <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}>
      <AlertTriangle size={16} color={c.sonChu} style={{ marginTop: 2 }} />
      <Txt f="bold" size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">{message}</Txt>
    </Inset>
  );
};

/** Thanh lọc: các ô nhập/chọn xếp hàng, tự xuống dòng */
export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>{children}</View>
);

export const FilterBox: React.FC<{ children: React.ReactNode; flex?: number }> = ({ children, flex = 1 }) => (
  <View style={{ flexGrow: flex, flexBasis: 180, minWidth: 160, maxWidth: 360 }}>{children}</View>
);

export const Pager: React.FC<{ page: number; limit: number; total: number; onPage: (page: number) => void }> = ({ page, limit, total, onPage }) => {
  const { c } = useTheme();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return <Txt size={13} color={c.muc3}>{total} kết quả</Txt>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Btn icon={ChevronLeft} label="Trang trước" tone="giay" size="sm" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <Txt size={13} color={c.muc2}>Trang {page}/{pages} · {total} kết quả</Txt>
      <Btn icon={ChevronRight} label="Trang sau" tone="giay" size="sm" disabled={page >= pages} onPress={() => onPage(page + 1)} />
    </View>
  );
};

// ---------------------------------------------------------------------- bảng thích ứng
export interface Column<T> {
  key: string;
  label: string;
  /** Độ rộng tương đối trên bảng */
  flex?: number;
  render: (row: T) => React.ReactNode;
  /** Ẩn cột trên danh sách thẻ (điện thoại) */
  hideOnCard?: boolean;
}

/** Bảng khi đủ rộng; danh sách thẻ "nhãn: giá trị" trên màn hẹp. Hàng có thể bấm để mở chi tiết. */
export function DataTable<T>({ columns, rows, rowKey, onRowPress, empty, actions }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; onRowPress?: (row: T) => void; empty: string; actions?: (row: T) => React.ReactNode;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const table = width >= 1000;
  if (!rows.length) return <EmptyState mood="thinking" title={empty} />;
  if (!table) {
    return (
      <View style={{ gap: 10 }}>
        {rows.map((row) => (
          <Card key={rowKey(row)} flat pad={14} style={{ gap: 6 }}>
            <Pressable accessibilityRole={onRowPress ? 'button' : undefined} disabled={!onRowPress} onPress={() => onRowPress?.(row)} style={{ gap: 6 }}>
              {columns.filter((col) => !col.hideOnCard).map((col, index) => (
                <View key={col.key} style={{ flexDirection: index === 0 ? 'column' : 'row', gap: 8, alignItems: 'flex-start' }}>
                  {index > 0 && <Txt size={12} f="bold" color={c.muc3} style={{ width: 96 }}>{col.label}</Txt>}
                  <View style={{ flex: 1, minWidth: 0 }}>{col.render(row)}</View>
                </View>
              ))}
            </Pressable>
            {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>{actions(row)}</View> : null}
          </Card>
        ))}
      </View>
    );
  }
  return (
    <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, backgroundColor: c.the, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.adminCanvas, borderBottomWidth: 1, borderBottomColor: c.adminLine, gap: 12 }}>
        {columns.map((col) => <Txt key={col.key} f="bold" size={12} color={c.muc2} style={{ flex: col.flex ?? 1 }}>{col.label}</Txt>)}
        {actions ? <View style={{ width: 150 }} /> : null}
      </View>
      {rows.map((row, i) => (
        <Pressable key={rowKey(row)} accessibilityRole={onRowPress ? 'button' : undefined} disabled={!onRowPress} onPress={() => onRowPress?.(row)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 52, paddingVertical: 8, gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the })}>
          {columns.map((col) => <View key={col.key} style={{ flex: col.flex ?? 1, minWidth: 0 }}>{col.render(row)}</View>)}
          {actions ? <View style={{ width: 150, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>{actions(row)}</View> : null}
        </Pressable>
      ))}
    </View>
  );
}

export const Cell: React.FC<{ main: string; sub?: string | null }> = ({ main, sub }) => {
  const { c } = useTheme();
  return (
    <View style={{ minWidth: 0 }}>
      <Txt f="semibold" size={14} numberOfLines={2}>{main}</Txt>
      {sub ? <Txt size={12} color={c.muc3} numberOfLines={2}>{sub}</Txt> : null}
    </View>
  );
};

export const StatusChip: React.FC<{ kind: 'on' | 'off' | 'warn' | 'info' | 'muted'; text: string }> = ({ kind, text }) => {
  const { c } = useTheme();
  const map = { on: [c.mocNhat, c.mocChu], off: [c.sonNhat, c.sonChu], warn: [c.vangNhat, c.vangChu], info: [c.thuyNhat, c.thuyChu], muted: [c.dichNhat, c.dich] } as const;
  return <Chip text={text} bg={map[kind][0]} fg={map[kind][1]} style={{ alignSelf: 'flex-start' }} />;
};

// ---------------------------------------------------------------------- biểu mẫu từ mô tả
export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'multi';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Ẩn ô theo giá trị hiện tại của biểu mẫu */
  when?: (values: Record<string, string | string[]>) => boolean;
  readOnly?: boolean;
  /** Ô tùy biến (ví dụ bản đồ chọn tọa độ): tự vẽ và tự ghi vào các giá trị khác */
  render?: (values: Record<string, string | string[]>, set: (name: string, value: string | string[]) => void) => React.ReactNode;
}

type Values = Record<string, string | string[]>;

/** Hộp thoại biểu mẫu: kiểm tra trường bắt buộc, hiện lỗi máy chủ ngay trong hộp thoại; giữ nguyên dữ liệu đã nhập khi lỗi */
export const FormSheet: React.FC<{
  title: string; subtitle?: string; fields: FieldDef[]; initial?: Values; submitLabel?: string; wide?: boolean; footerExtra?: React.ReactNode;
  onSubmit: (values: Values) => Promise<void>; onClose: () => void;
}> = ({ title, subtitle, fields, initial, submitLabel = 'Lưu', wide, footerExtra, onSubmit, onClose }) => {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? (f.type === 'multi' ? [] : '')])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const visible = fields.filter((f) => !f.when || f.when(values));
  const set = (name: string, value: string | string[]) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async () => {
    const gaps = Object.fromEntries(visible.filter((f) => f.required && !f.readOnly && !f.render && (f.type === 'multi' ? !(values[f.name] as string[]).length : !String(values[f.name] ?? '').trim())).map((f) => [f.name, true]));
    setMissing(gaps);
    if (Object.keys(gaps).length) return setError('Hãy điền các ô bắt buộc (đánh dấu *).');
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={title} subtitle={subtitle} wide={wide}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>{footerExtra}<Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={submitLabel} tone="son" onPress={submit} loading={busy} testID="form-submit" /></View>}>
      <ErrorNote message={error} />
      {visible.map((f) => f.render ? <View key={f.name}>{f.render(values, set)}</View> : <FormField key={f.name} def={f} value={values[f.name]} error={missing[f.name] ? 'Ô này bắt buộc.' : null} onChange={(v) => set(f.name, v)} />)}
    </Sheet>
  );
};

const FormField: React.FC<{ def: FieldDef; value: string | string[]; error: string | null; onChange: (v: string | string[]) => void }> = ({ def, value, error, onChange }) => {
  const { c } = useTheme();
  const label = def.required ? `${def.label} *` : def.label;
  if (def.type === 'select') {
    return <AdminSelect label={label} value={String(value ?? '')} options={def.options ?? []} onChange={(v) => onChange(String(v))} testID={`field-${def.name}`} />;
  }
  if (def.type === 'multi') {
    const picked = (value as string[]) ?? [];
    return (
      <View style={{ gap: 6 }}>
        <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
        {def.hint ? <Txt size={13} color={c.muc3}>{def.hint}</Txt> : null}
        <View style={{ borderWidth: 1, borderColor: error ? c.son : c.adminLine, borderRadius: 5, maxHeight: 220, backgroundColor: c.the }}>
          <ScrollView nestedScrollEnabled>
            {(def.options ?? []).length === 0 && <Txt size={13} color={c.muc3} style={{ padding: 12 }}>Chưa có lựa chọn nào.</Txt>}
            {(def.options ?? []).map((o) => {
              const on = picked.includes(o.value);
              return (
                <Pressable key={o.value} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onChange(on ? picked.filter((p) => p !== o.value) : [...picked, o.value])}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? c.adminCanvas : c.the })}>
                  {on ? <CheckSquare size={18} color={c.son} /> : <Square size={18} color={c.muc3} />}
                  <Txt size={14} style={{ flex: 1 }}>{o.label}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {error ? <Txt size={13} f="semibold" color={c.sonChu}>{error}</Txt> : null}
      </View>
    );
  }
  return (
    <Field label={label} hint={def.hint} error={error} value={String(value ?? '')} onChangeText={(v) => onChange(v)} placeholder={def.placeholder ?? (def.type === 'date' ? 'YYYY-MM-DD' : undefined)}
      editable={!def.readOnly} multiline={def.type === 'textarea'} numberOfLines={def.type === 'textarea' ? 4 : 1} inputStyle={def.type === 'textarea' ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
      autoCapitalize={def.type === 'email' ? 'none' : 'sentences'} keyboardType={def.type === 'email' ? 'email-address' : def.type === 'tel' ? 'phone-pad' : def.type === 'number' ? 'numeric' : 'default'} nativeID={`field-${def.name}`} />
  );
};

// ---------------------------------------------------------------------- mật khẩu tạm (chỉ hiện một lần)
const MAIL_NOTE = { queued: 'Thư thông tin đăng nhập đã được xếp vào hàng đợi gửi.', no_email: 'Tài khoản chưa có email nên chưa gửi thư: hãy chuyển thông tin này cho người dùng.', not_configured: 'Máy chủ chưa cấu hình gửi thư: hãy chuyển thông tin này cho người dùng.' } as const;

export const CredentialSheet: React.FC<{ title: string; account: { full_name: string; username: string; temporary_password: string; mail: keyof typeof MAIL_NOTE }; onClose: () => void }> = ({ title, account, onClose }) => {
  const { c } = useTheme();
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Tên đăng nhập: ${account.username}\nMật khẩu tạm: ${account.temporary_password}`);
      toast('Đã sao chép');
    } catch {
      toast('Không sao chép tự động được, hãy chọn và chép thủ công.');
    }
  };
  return (
    <Sheet open onClose={onClose} title={title} subtitle={account.full_name} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>{Platform.OS === 'web' && <Btn title="Sao chép" tone="giay" onPress={copy} />}<Btn title="Đã ghi lại" tone="son" onPress={onClose} /></View>}>
      <Inset style={{ gap: 6 }}>
        <Txt size={13} color={c.muc2}>Tên đăng nhập</Txt>
        <Txt f="bold" size={18} selectable testID="credential-username">{account.username}</Txt>
        <Txt size={13} color={c.muc2} style={{ marginTop: 6 }}>Mật khẩu tạm</Txt>
        <Txt f="bold" size={22} selectable testID="credential-password">{account.temporary_password}</Txt>
      </Inset>
      <Txt size={14} color={c.muc2}>{MAIL_NOTE[account.mail]} Mật khẩu này chỉ hiện một lần; người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.</Txt>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- tệp
export const pickFile = async (types: string[]): Promise<PickedFile | null> => {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', uri: a.uri, size: a.size, file: (a as { file?: Blob }).file };
};

/** Lưu tệp tải về (web); trên điện thoại báo chưa hỗ trợ */
export function saveBlob(blob: Blob, filename: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export const DownloadButton: React.FC<{ title: string; fetchBlob: () => Promise<Blob>; filename: string; tone?: 'giay' | 'son' }> = ({ title, fetchBlob, filename, tone = 'giay' }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Btn title={title} icon={Download} tone={tone} size="sm" loading={busy} onPress={async () => {
      setBusy(true);
      try {
        const blob = await fetchBlob();
        if (!saveBlob(blob, filename)) toast('Tải tệp hiện hỗ trợ trên trình duyệt web.');
      } catch (e) {
        toast(errorMessage(e));
      } finally {
        setBusy(false);
      }
    }} />
  );
};

// ---------------------------------------------------------------------- nhập Excel có xem trước (HK.QT.017/027/039, HK.AD.041)
const XLSX_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export const ImportSheet: React.FC<{
  title: string; hint: string; template?: { fetchBlob: () => Promise<Blob>; filename: string }; types?: string[];
  run: (file: PickedFile, commit: boolean) => Promise<ImportResult | { committed: boolean; total: number; errors: number; created: number; updated: number; report: Array<{ entity: string; slug: string; action: string; message?: string }> }>;
  onClose: () => void; onDone: () => void;
}> = ({ title, hint, template, types = XLSX_TYPES, run, onClose, onDone }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof run>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committed = !!result?.committed;

  const go = async (commit: boolean, chosen = file) => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await run(chosen, commit);
      setResult(res);
      if (commit) { toast('Đã lưu dữ liệu'); onDone(); }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const choose = async () => {
    const picked = await pickFile(types);
    if (!picked) return;
    setFile(picked);
    setResult(null);
    await go(false, picked);
  };

  const rows = result && 'rows' in result ? result.rows : [];
  const report = result && 'report' in result ? result.report : [];
  const valid = result ? (('valid' in result ? result.valid : result.total - result.errors) as number) : 0;
  const credentials = result && 'credentials' in result ? result.credentials ?? [] : [];
  const saveCsv = () => {
    const csv = '﻿' + ['Họ và tên,Tên đăng nhập,Mật khẩu tạm,Email', ...credentials.map((x) => [x.full_name, x.username, x.password, x.email ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    if (!saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'tai-khoan-moi.csv')) toast('Tải tệp hiện hỗ trợ trên trình duyệt web.');
  };

  return (
    <Sheet open onClose={onClose} title={title} subtitle="Xem trước và báo lỗi từng dòng trước khi lưu" wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <Btn title={committed ? 'Đóng' : 'Hủy'} tone="giay" onPress={onClose} disabled={busy} />
        {!committed && file ? <Btn title={valid ? `Lưu ${valid} dòng hợp lệ${result && result.errors ? `, bỏ qua ${result.errors} dòng lỗi` : ''}` : 'Không có dòng hợp lệ'} tone="son" disabled={!result || !valid} loading={busy} onPress={() => go(true)} testID="import-commit" /> : null}
      </View>}>
      <Txt size={14} color={c.muc2}>{hint}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {template ? <DownloadButton title="Tải file mẫu" fetchBlob={template.fetchBlob} filename={template.filename} /> : null}
        <Btn title={file ? `Chọn file khác (${file.name})` : 'Chọn file'} icon={FileUp} tone="giay" size="sm" onPress={choose} disabled={busy || committed} testID="import-choose" />
      </View>
      <ErrorNote message={error} />
      {busy && !result ? <Spinner label="Đang kiểm tra file…" /> : null}
      {result ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip kind="info" text={`${result.total} dòng`} />
            <StatusChip kind="on" text={committed ? `${('created' in result && result.created) || ('added' in result && result.added) || 0} đã lưu` : `${valid} hợp lệ`} />
            {result.errors ? <StatusChip kind="off" text={`${result.errors} lỗi`} /> : null}
          </View>
          {rows.filter((r) => r.status === 'error').map((r) => (
            <Inset key={r.row} style={{ backgroundColor: c.sonNhat, gap: 2 }}>
              <Txt f="bold" size={13} color={c.sonChu}>Dòng {r.row}{r.full_name ? ` · ${r.full_name}` : r.user_code ? ` · ${r.user_code}` : ''}</Txt>
              {r.errors.map((e) => <Txt key={e} size={13} color={c.sonChu}>• {e}</Txt>)}
            </Inset>
          ))}
          {report.filter((r) => r.action === 'error').map((r) => (
            <Inset key={`${r.entity}-${r.slug}`} style={{ backgroundColor: c.sonNhat, gap: 2 }}>
              <Txt f="bold" size={13} color={c.sonChu}>{r.entity} · {r.slug || '(thiếu slug)'}</Txt>
              <Txt size={13} color={c.sonChu}>• {r.message}</Txt>
            </Inset>
          ))}
          {rows.filter((r) => r.status !== 'error').length ? <Txt size={13} color={c.muc2}>{rows.filter((r) => r.status !== 'error').length} dòng hợp lệ{committed ? ' đã được xử lý.' : ' sẽ được lưu khi bạn bấm nút bên dưới.'}</Txt> : null}
          {committed && credentials.length ? (
            <Inset style={{ gap: 8 }}>
              <Txt f="bold" size={14}><Check size={14} color={c.mocChu} /> Mật khẩu tạm của {credentials.length} tài khoản mới chỉ hiện một lần.</Txt>
              <Btn title="Tải danh sách tài khoản (CSV)" icon={Download} tone="giay" size="sm" onPress={saveCsv} />
            </Inset>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};

/** Chọn id từ danh sách và đổi sang dạng chuỗi/ngược lại cho FormSheet */
export const idsToValues = (ids: number[] | undefined) => (ids ?? []).map(String);
export const valuesToIds = (values: string | string[] | undefined) => (Array.isArray(values) ? values.map(Number) : []);
export const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
};
export const memoOptions = <T,>(items: T[] | undefined, map: (item: T) => { value: string; label: string }) => (items ?? []).map(map);
export const useMemoOptions = <T,>(items: T[] | undefined, map: (item: T) => { value: string; label: string }) => useMemo(() => memoOptions(items, map), [items]); // eslint-disable-line react-hooks/exhaustive-deps

export const YEAR_TEXT = { planned: 'Chưa bắt đầu', active: 'Đang hoạt động', ended: 'Đã kết thúc' } as const;
export const yearOptions = (years: Array<{ id: number; label: string; status: keyof typeof YEAR_TEXT }>) => years.map((y) => ({ value: String(y.id), label: `${y.label} · ${YEAR_TEXT[y.status]}` }));
