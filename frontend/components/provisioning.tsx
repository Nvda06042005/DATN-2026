/**
 * Cấp tài khoản bằng file Excel mẫu và các bảng dùng chung của cổng quản trị tổng, quản trị trường và giáo viên:
 * tải file mẫu công khai, nhập file .xlsx (báo cáo từng dòng), dòng thiếu thông tin, hàng đợi thư, thùng rác 45 ngày,
 * duyệt yêu cầu mở lớp và chuông thông báo trong app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Share, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AlertTriangle, Bell, Check, Download, FileSpreadsheet, Hourglass, Mail, RefreshCw, RotateCcw, Trash2, Upload, X } from 'lucide-react-native';
import * as adminApi from '@/api/adminApi';
import * as authApi from '@/api/authApi';
import { ApiError, EXCEL_TEMPLATE_URL, errorMessage, type PickedFile } from '@/api/client';
import { GradeBadge, Mascot } from '@/components/art';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, Segmented, Sheet, Skeleton, Txt, useToast } from '@/components/ui';
import type { Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fmt, formatDateTime } from '@/lib/format';
import type { AppNotification, ClassRequest, ClassStatus, ImportBatch, ImportResult, ImportStatus, IncompleteLog, OutboxItem, TrashUser } from '@/types/api';
import type { IconType } from '@/types/game';

// ---------------------------------------------------------------------- tiện ích
/** Lỗi API: hết phiên (401) thì về màn đăng nhập, lỗi khác hiện thông báo nhanh */
export const useFail = (session: Session) => {
  const toast = useToast();
  const expired = useRef(session.expired);
  useEffect(() => {
    expired.current = session.expired;
  });
  return useCallback(
    (err: unknown, fallback?: string) => {
      if (err instanceof ApiError && err.status === 401) expired.current();
      else toast(errorMessage(err, fallback));
    },
    [toast],
  );
};

/** Lưu văn bản thành file: web tải xuống, điện thoại mở bảng chia sẻ */
export const saveTextFile = async (fileName: string, text: string) => {
  if (Platform.OS !== 'web') {
    await Share.share({ title: fileName, message: text.replace(/^﻿/, '') }).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const today = () => new Date().toISOString().slice(0, 10);

const ErrorLines: React.FC<{ text: string | null }> = ({ text }) => {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}>
      <AlertTriangle size={16} color={c.sonChu} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {text.split('\n').map((line, i) => (
          <Txt key={i} f="bold" size={14} color={c.sonChu} accessibilityRole={i === 0 ? 'alert' : undefined}>
            {line}
          </Txt>
        ))}
      </View>
    </Inset>
  );
};

const PanelHead: React.FC<{ icon: IconType; title: string; text?: string; color: string; action?: React.ReactNode }> = ({ icon: Icon, title, text, color, action }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.18)' }}>
        <Icon size={22} color="#ffffff" />
      </View>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Txt f="display" size={19} accessibilityRole="header">
          {title}
        </Txt>
        {text && (
          <Txt size={13} color={c.muc2}>
            {text}
          </Txt>
        )}
      </View>
      {action}
    </View>
  );
};

// ---------------------------------------------------------------------- file mẫu
/** 11 cột của file mẫu theo đúng thứ tự; file thêm, bớt, đổi tên hoặc đổi thứ tự cột bị từ chối */
export const TEMPLATE_COLUMNS = ['Mã số người dùng', 'Trường', 'Mã số trường', 'Khu vực', 'Thành phố', 'Tên', 'Ngày tháng năm sinh', 'Năm học', 'Email', 'Khối', 'Vai trò'] as const;

/** Tải file mẫu công khai (không cần đăng nhập) */
export const downloadTemplate = () => Linking.openURL(EXCEL_TEMPLATE_URL).catch(() => undefined);

export const TemplateGuide: React.FC = () => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TEMPLATE_COLUMNS.map((col, i) => (
          <Chip key={col} text={`${i + 1}. ${col}`} bg={c.vangNhat} fg={c.vangChu} />
        ))}
      </View>
      <Txt size={13} color={c.muc2}>
        Ngày sinh dạng DD/MM/YYYY · Năm học dạng 2025-2026 · Khối 6, 7, 8 hoặc 9 · Vai trò GV hoặc HS. Giữ nguyên 11 cột của file mẫu: file tự tạo, file không phải .xlsx hoặc đã
        thêm, xóa, đổi tên, đổi thứ tự cột đều bị từ chối.
      </Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- nhập file Excel
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BYTES = 2 * 1024 * 1024;

const STATUS: Record<ImportStatus, { label: string; tone: (c: Palette) => { bg: string; fg: string; solid: string } }> = {
  created: { label: 'Cấp mới', tone: (c) => ({ bg: c.ngocNhat, fg: c.ngocChu, solid: c.ngoc }) },
  delta: { label: 'Vừa bổ sung', tone: (c) => ({ bg: c.vangNhat, fg: c.vangChu, solid: c.vang }) },
  existing: { label: 'Đã có tài khoản', tone: (c) => ({ bg: c.thuyNhat, fg: c.thuyChu, solid: c.thuy }) },
  incomplete: { label: 'Thiếu thông tin', tone: (c) => ({ bg: c.dongNhat, fg: c.dongChu, solid: c.dong }) },
  error: { label: 'Lỗi', tone: (c) => ({ bg: c.sonNhat, fg: c.sonChu, solid: c.son }) },
};

/** Chọn file .xlsx (kiểm đuôi, kích thước ngay trên máy; server kiểm lại MIME, chữ ký nhị phân và chữ ký mẫu) */
async function pickXlsx(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: [XLSX_MIME, 'application/octet-stream'], multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { name: a.name, mimeType: a.mimeType || XLSX_MIME, uri: a.uri, size: a.size, file: a.file };
}

export const ImportPanel: React.FC<{
  session: Session;
  /** Ai đang nhập và nhập cho trường nào */
  scope: string;
  upload: (token: string, file: PickedFile) => Promise<ImportResult>;
  history: (token: string) => Promise<ImportBatch[]>;
  /** Quản trị: tải tài khoản chưa gửi được thư (khi chưa cấu hình SMTP) */
  credentialsCsv?: (token: string, batchId?: number) => Promise<string>;
  onImported?: () => void;
}> = ({ session, scope, upload, history, credentialsCsv, onImported }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[] | null>(null);

  const loadHistory = useCallback(() => {
    history(session.token)
      .then(setBatches)
      .catch((err) => {
        setBatches([]);
        fail(err);
      });
  }, [history, session.token, fail]);

  useEffect(loadHistory, [loadHistory]);

  const choose = async () => {
    setError(null);
    let file: PickedFile | null;
    try {
      file = await pickXlsx();
    } catch {
      return setError('Không mở được trình chọn file.');
    }
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return setError('Chỉ nhận file .xlsx tải từ trang chủ (không nhận .xls, .csv, .ods).');
    if (file.size && file.size > MAX_BYTES) return setError('File quá lớn (tối đa 2 MB).');
    setBusy(file.name);
    try {
      const r = await upload(session.token, file);
      setResult(r);
      toast(`Đã xử lý ${r.totals.total} dòng: ${r.totals.created + r.totals.delta} tài khoản mới`);
      loadHistory();
      onImported?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) fail(err);
      else setError(errorMessage(err, 'Không nhập được file.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 14 }}>
        <PanelHead icon={FileSpreadsheet} color={c.ngocDam} title="Nhập file Excel mẫu" text={scope} />
        <TemplateGuide />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Btn title="Tải file mẫu" icon={Download} tone="giay" onPress={downloadTemplate} />
          <Btn title={busy ? 'Đang xử lý…' : 'Chọn file .xlsx để nhập'} icon={Upload} tone="ngoc" loading={!!busy} onPress={choose} testID="import-pick" />
        </View>
        {busy && (
          <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mascot size={44} mood="thinking" />
            <Txt f="semibold" size={14} color={c.muc2} style={{ flex: 1 }}>
              Đang kiểm tra chữ ký file mẫu và cấp tài khoản cho {busy}…
            </Txt>
          </Inset>
        )}
        <ErrorLines text={error} />
        <Txt size={13} color={c.muc3}>
          Dòng đủ 11 cột được cấp tài khoản và gửi thư thông tin đăng nhập. Dòng thiếu được ghi lại để báo cáo; bổ sung vào file rồi nhập lại – hệ thống chỉ cấp tài
          khoản và gửi thư cho các dòng vừa đủ, không gửi lại cho người đã có tài khoản.
        </Txt>
      </Card>
      {result && <ImportReport result={result} session={session} credentialsCsv={credentialsCsv} />}
      <Card style={{ gap: 10 }}>
        <PanelHead icon={Hourglass} color={c.thuy} title="Các lượt nhập gần đây" action={<Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={loadHistory} />} />
        {batches === null ? (
          <Skeleton height={56} />
        ) : batches.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Chưa có lượt nhập nào.
          </Txt>
        ) : (
          batches.map((b) => (
            <Inset key={b.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <View style={{ flexGrow: 1, flexBasis: 220 }}>
                <Txt f="bold" size={14} numberOfLines={1}>
                  {b.file_name}
                </Txt>
                <Txt size={12} color={c.muc2}>
                  {formatDateTime(b.created_at)} · {b.school_name} ({b.school_code}){b.uploaded_by ? ` · ${b.uploaded_by}` : ''}
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                <Chip text={`${b.created_count} mới`} bg={c.ngocNhat} fg={c.ngocChu} />
                {b.delta_count > 0 && <Chip text={`${b.delta_count} bổ sung`} bg={c.vangNhat} fg={c.vangChu} />}
                {b.existing_count > 0 && <Chip text={`${b.existing_count} đã có`} bg={c.thuyNhat} fg={c.thuyChu} />}
                {b.incomplete_count > 0 && <Chip text={`${b.incomplete_count} thiếu`} bg={c.dongNhat} fg={c.dongChu} />}
                {b.error_count > 0 && <Chip text={`${b.error_count} lỗi`} bg={c.sonNhat} fg={c.sonChu} />}
              </View>
            </Inset>
          ))
        )}
      </Card>
    </View>
  );
};

const SHOW_ROWS = 300;

/** Báo cáo một lượt nhập: "chiến lợi phẩm" theo trạng thái và kết quả từng dòng */
export const ImportReport: React.FC<{ result: ImportResult; session: Session; credentialsCsv?: (token: string, batchId?: number) => Promise<string> }> = ({ result, session, credentialsCsv }) => {
  const { c } = useTheme();
  const fail = useFail(session);
  const [filter, setFilter] = useState<'all' | ImportStatus>('all');
  const [csvBusy, setCsvBusy] = useState(false);
  const t = result.totals;
  const done = t.created + t.delta + t.existing;
  const rows = filter === 'all' ? result.rows : result.rows.filter((r) => r.status === filter);
  const statuses = (Object.keys(STATUS) as ImportStatus[]).filter((s) => t[s] > 0);

  const downloadCsv = async () => {
    if (!credentialsCsv) return;
    setCsvBusy(true);
    try {
      const batchId = result.batches.length === 1 ? result.batches[0].id : undefined;
      await saveTextFile(`tai-khoan-chua-gui-thu-${today()}.csv`, await credentialsCsv(session.token, batchId));
    } catch (err) {
      fail(err);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <Card style={{ gap: 14 }}>
      <PanelHead icon={Check} color={c.ngocDam} title="Kết quả nhập file" text={result.batches.map((b) => `${b.school_name} (${b.school_code})`).join(' · ') || undefined} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt f="bold" size={14}>
            Dòng đã có tài khoản
          </Txt>
          <Txt f="display" size={15} style={{ fontVariant: ['tabular-nums'] }}>
            {done}/{t.total}
          </Txt>
        </View>
        <Bar value={done} max={t.total} height={16} fill={c.ngoc} label={`${done} trên ${t.total} dòng đã có tài khoản`} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(Object.keys(STATUS) as ImportStatus[]).map((s) => {
          const tone = STATUS[s].tone(c);
          return (
            <View key={s} accessible accessibilityLabel={`${STATUS[s].label}: ${t[s]}`} style={{ flexGrow: 1, flexBasis: 120, padding: 12, borderRadius: 16, backgroundColor: tone.bg, borderBottomWidth: 4, borderBottomColor: tone.solid }}>
              <Txt f="displayHeavy" size={24} color={tone.fg}>
                {fmt(t[s])}
              </Txt>
              <Txt f="bold" size={12} color={tone.fg}>
                {STATUS[s].label}
              </Txt>
            </View>
          );
        })}
      </View>
      {result.emails_queued > 0 && (
        <Inset style={{ backgroundColor: result.smtp ? c.ngocNhat : c.dongNhat, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Mail size={18} color={result.smtp ? c.ngocChu : c.dongChu} />
          <Txt f="bold" size={14} color={result.smtp ? c.ngocChu : c.dongChu} style={{ flex: 1, minWidth: 200 }}>
            {result.smtp
              ? `Đã xếp ${result.emails_queued} thư thông tin đăng nhập vào hàng đợi gửi.`
              : `Máy chủ chưa cấu hình gửi thư: ${result.emails_queued} thư đang chờ. ${credentialsCsv ? 'Tải danh sách để phát tay cho từng người.' : 'Quản trị trường tải danh sách để phát tay.'}`}
          </Txt>
          {!result.smtp && credentialsCsv && <Btn title="Tải danh sách (CSV)" icon={Download} tone="dong" size="sm" loading={csvBusy} onPress={downloadCsv} />}
        </Inset>
      )}
      {statuses.length > 1 && (
        <Segmented
          label="Lọc kết quả"
          options={[{ value: 'all' as const, label: `Tất cả (${t.total})` }, ...statuses.map((s) => ({ value: s, label: `${STATUS[s].label} (${t[s]})` }))]}
          value={filter}
          onChange={setFilter}
        />
      )}
      <View style={{ gap: 6 }}>
        {rows.slice(0, SHOW_ROWS).map((r) => {
          const tone = STATUS[r.status].tone(c);
          return (
            <View key={`${r.row}-${r.status}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.vien }}>
              <Txt f="mono" size={12} color={c.muc3} style={{ width: 52 }}>
                Dòng {r.row}
              </Txt>
              <View style={{ flexGrow: 1, flexBasis: 180 }}>
                <Txt f="bold" size={14} numberOfLines={1}>
                  {r.full_name || '(chưa có tên)'}
                  {r.role ? ` · ${r.role === 'teacher' ? 'GV' : 'HS'}` : ''}
                </Txt>
                {r.username ? (
                  <Txt f="mono" size={12} color={c.thuyChu} selectable>
                    {r.username}
                  </Txt>
                ) : r.missing?.length ? (
                  <Txt size={12} color={c.dongChu}>
                    Thiếu: {r.missing.join(', ')}
                  </Txt>
                ) : null}
                {r.message && (
                  <Txt size={12} color={r.status === 'error' ? c.sonChu : c.muc2}>
                    {r.message}
                  </Txt>
                )}
              </View>
              <Chip text={STATUS[r.status].label} bg={tone.bg} fg={tone.fg} />
            </View>
          );
        })}
        {rows.length > SHOW_ROWS && (
          <Txt size={13} color={c.muc2} center>
            … và {rows.length - SHOW_ROWS} dòng nữa
          </Txt>
        )}
      </View>
    </Card>
  );
};

// ---------------------------------------------------------------------- dòng thiếu thông tin (quản trị)
export const IncompletePanel: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const fail = useFail(session);
  const [items, setItems] = useState<IncompleteLog[] | null>(null);
  const load = useCallback(() => {
    adminApi
      .getIncomplete(session.token)
      .then(setItems)
      .catch((err) => {
        setItems([]);
        fail(err);
      });
  }, [session.token, fail]);
  useEffect(load, [load]);
  return (
    <Card style={{ gap: 10 }}>
      <PanelHead
        icon={AlertTriangle}
        color={c.dong}
        title="Dòng thiếu thông tin"
        text="Chưa cấp tài khoản. Bổ sung vào file Excel rồi nhập lại: hệ thống nhận ra dòng cũ và chỉ cấp tài khoản cho dòng vừa đủ thông tin."
        action={<Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={load} />}
      />
      {items === null ? (
        <Skeleton height={56} />
      ) : items.length === 0 ? (
        <Txt size={14} color={c.muc2}>
          Không còn dòng nào thiếu thông tin.
        </Txt>
      ) : (
        items.map((l) => (
          <Inset key={l.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <Txt f="bold" size={14}>
                {l.full_name || '(chưa có tên)'} · dòng {l.row_number}
              </Txt>
              <Txt size={12} color={c.muc2}>
                Trường {l.school_code}
                {l.user_code ? ` · Mã ${l.user_code}` : ''}
                {l.email ? ` · ${l.email}` : ''} · cập nhật {formatDateTime(l.updated_at)}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {l.missing_fields.map((f) => (
                <Chip key={f} text={f} bg={c.dongNhat} fg={c.dongChu} />
              ))}
            </View>
          </Inset>
        ))
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------- hàng đợi thư (quản trị)
const MAIL_STATUS: Record<OutboxItem['status'], { label: string; tone: (c: Palette) => { bg: string; fg: string } }> = {
  queued: { label: 'Chờ gửi', tone: (c) => ({ bg: c.vangNhat, fg: c.vangChu }) },
  sending: { label: 'Đang gửi', tone: (c) => ({ bg: c.thuyNhat, fg: c.thuyChu }) },
  sent: { label: 'Đã gửi', tone: (c) => ({ bg: c.ngocNhat, fg: c.ngocChu }) },
  failed: { label: 'Gửi lỗi', tone: (c) => ({ bg: c.sonNhat, fg: c.sonChu }) },
  cancelled: { label: 'Đã hủy', tone: (c) => ({ bg: c.giay2, fg: c.muc2 }) },
};
const MAIL_KIND: Record<OutboxItem['kind'], string> = { bulk: 'Cấp hàng loạt', delta: 'Bổ sung', class: 'Duyệt lớp' };

export const OutboxPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.getOutbox>> | null>(null);
  const [busy, setBusy] = useState<null | 'retry' | 'csv' | 'test'>(null);
  const [testOpen, setTestOpen] = useState(false);
  const load = useCallback(() => {
    adminApi
      .getOutbox(session.token)
      .then(setData)
      .catch((err) => {
        setData({ smtp: false, worker: false, test_recipient: null, items: [] });
        fail(err);
      });
  }, [session.token, fail]);
  useEffect(load, [load]);

  const retry = async () => {
    setBusy('retry');
    try {
      const r = await adminApi.retryOutbox(session.token);
      toast(r.requeued ? `Đã xếp lại ${r.requeued} thư lỗi để gửi` : 'Không có thư lỗi cần gửi lại');
      load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const csv = async () => {
    setBusy('csv');
    try {
      await saveTextFile(`tai-khoan-chua-gui-thu-${today()}.csv`, await adminApi.pendingCredentialsCsv(session.token));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      const r = await adminApi.sendTestMail(session.token);
      toast(`Máy chủ thư đã nhận email kiểm tra gửi đến ${r.recipient}. Hãy kiểm tra hộp thư và mục Thư rác.`);
      setTestOpen(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const items = data?.items ?? [];
  const waiting = items.filter((i) => i.status === 'queued' || i.status === 'failed' || i.status === 'sending').length;
  return (
    <Card style={{ gap: 12 }}>
      <PanelHead
        icon={Mail}
        color={c.thuy}
        title="Thư thông tin đăng nhập"
        text="Mỗi tài khoản được gửi thư đúng một lần; nội dung thư được mã hóa khi chờ gửi và xóa sau khi gửi xong."
        action={<Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={load} />}
      />
      {data && (
        <Inset style={{ backgroundColor: data.smtp && data.worker ? c.ngocNhat : c.dongNhat, gap: 4 }}>
          <Txt f="bold" size={14} color={data.smtp && data.worker ? c.ngocChu : c.dongChu}>
            {data.smtp ? (data.worker ? 'Máy chủ thư đã cấu hình: gửi tự động đã bật, thử lại khi lỗi.' : 'Máy chủ thư đã cấu hình. Gửi tự động đang tạm dừng.') : 'Máy chủ chưa cấu hình gửi thư (SMTP): thư nằm chờ trong hàng đợi.'}
          </Txt>
          {!data.smtp && (
            <Txt size={13} color={c.dongChu}>
              Tải danh sách tài khoản đang chờ để in hoặc phát tay; thư sẽ tự gửi khi máy chủ thư hoạt động.
            </Txt>
          )}
        </Inset>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {session.user.role === 'root_admin' && data?.smtp && data.test_recipient && (
          <Btn title="Gửi thư kiểm tra" icon={Mail} tone="thuy" size="sm" disabled={busy !== null} onPress={() => setTestOpen(true)} />
        )}
        <Btn title="Gửi lại thư lỗi" icon={RotateCcw} tone="giay" size="sm" loading={busy === 'retry'} onPress={retry} />
        <Btn title={`Tải tài khoản chưa gửi thư${waiting ? ` (${waiting})` : ''}`} icon={Download} tone="dong" size="sm" loading={busy === 'csv'} onPress={csv} />
      </View>
      {data === null ? (
        <Skeleton height={56} />
      ) : items.length === 0 ? (
        <Txt size={14} color={c.muc2}>
          Chưa có thư nào.
        </Txt>
      ) : (
        items.slice(0, 100).map((m) => {
          const tone = MAIL_STATUS[m.status].tone(c);
          return (
            <View key={m.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.vien }}>
              <View style={{ flexGrow: 1, flexBasis: 220 }}>
                <Txt f="bold" size={14} numberOfLines={1}>
                  {m.full_name ?? m.to_email}
                </Txt>
                <Txt size={12} color={c.muc2} numberOfLines={1}>
                  {m.to_email} · {MAIL_KIND[m.kind]} · {formatDateTime(m.sent_at ?? m.created_at)}
                  {m.attempts > 1 ? ` · thử ${m.attempts} lần` : ''}
                </Txt>
                {m.status === 'failed' && m.last_error && (
                  <Txt size={12} color={c.sonChu} numberOfLines={2}>
                    {m.last_error}
                  </Txt>
                )}
              </View>
              <Chip text={MAIL_STATUS[m.status].label} bg={tone.bg} fg={tone.fg} />
            </View>
          );
        })
      )}
      <ConfirmSheet
        open={testOpen}
        title="Gửi thư kiểm tra?"
        message={`Gửi 1 email kiểm tra đến ${data?.test_recipient ?? 'địa chỉ người gửi đã cấu hình'}. Sau khi gửi, kiểm tra hộp thư và trạng thái giao thư trên dịch vụ email.`}
        confirmLabel="Gửi thư kiểm tra"
        tone="thuy"
        busy={busy === 'test'}
        onConfirm={sendTest}
        onCancel={() => setTestOpen(false)}
      />
    </Card>
  );
};

// ---------------------------------------------------------------------- thùng rác (quản trị)
const TRASH_DAYS = 45;

export const TrashPanel: React.FC<{ session: Session; onChanged?: () => void }> = ({ session, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const [items, setItems] = useState<TrashUser[] | null>(null);
  const [purge, setPurge] = useState<TrashUser | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => {
    adminApi
      .getTrash(session.token)
      .then(setItems)
      .catch((err) => {
        setItems([]);
        fail(err);
      });
  }, [session.token, fail]);
  useEffect(load, [load]);

  const restore = async (u: TrashUser) => {
    setBusy(u.id);
    try {
      await adminApi.restoreUser(session.token, u.id);
      toast(`Đã khôi phục ${u.full_name}`);
      load();
      onChanged?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const purgeNow = async () => {
    if (!purge) return;
    setBusy(purge.id);
    try {
      await adminApi.purgeUser(session.token, purge.id);
      toast(`Đã xóa vĩnh viễn ${purge.full_name}`);
      setPurge(null);
      load();
      onChanged?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <PanelHead
        icon={Trash2}
        color={c.son}
        title="Thùng rác"
        text={`Tài khoản bị xóa nằm ở đây ${TRASH_DAYS} ngày (không đăng nhập được) rồi tự xóa vĩnh viễn lúc 00:00.`}
        action={<Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={load} />}
      />
      {items === null ? (
        <Skeleton height={56} />
      ) : items.length === 0 ? (
        <EmptyState mood="happy" title="Thùng rác trống" text="Tài khoản bị xóa sẽ nằm ở đây để khôi phục khi cần." />
      ) : (
        items.map((u) => (
          <Inset key={u.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <View style={{ flexGrow: 1, flexBasis: 220, gap: 4 }}>
              <Txt f="bold" size={14}>
                {u.full_name}
              </Txt>
              <Txt f="mono" size={12} color={c.muc3}>
                {u.username}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bar value={u.days_left} max={TRASH_DAYS} height={8} fill={u.days_left <= 7 ? c.son : c.dong} style={{ flex: 1 }} label={`Còn ${u.days_left} ngày`} />
                <Txt f="bold" size={12} color={u.days_left <= 7 ? c.sonChu : c.dongChu}>
                  Còn {u.days_left} ngày
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Btn title="Khôi phục" icon={RotateCcw} tone="ngoc" size="sm" loading={busy === u.id && !purge} onPress={() => restore(u)} />
              <Btn icon={X} tone="giay" size="sm" label={`Xóa vĩnh viễn ${u.full_name}`} onPress={() => setPurge(u)} />
            </View>
          </Inset>
        ))
      )}
      <ConfirmSheet
        open={!!purge}
        title="Xóa vĩnh viễn?"
        message={purge ? `Tài khoản ${purge.full_name} (${purge.username}) cùng toàn bộ tiến độ học tập sẽ bị xóa ngay, không khôi phục được.` : ''}
        confirmLabel="Xóa vĩnh viễn"
        busy={busy !== null}
        onConfirm={purgeNow}
        onCancel={() => setPurge(null)}
      />
    </Card>
  );
};

// ---------------------------------------------------------------------- duyệt lớp (quản trị)
const CLASS_STATUS: Record<ClassStatus, { label: string; tone: (c: Palette) => { bg: string; fg: string } }> = {
  PENDING: { label: 'Chờ duyệt', tone: (c) => ({ bg: c.vangNhat, fg: c.vangChu }) },
  APPROVED: { label: 'Đã duyệt', tone: (c) => ({ bg: c.ngocNhat, fg: c.ngocChu }) },
  REJECTED: { label: 'Từ chối', tone: (c) => ({ bg: c.sonNhat, fg: c.sonChu }) },
};

export const classStatusChip = (c: Palette, s: ClassStatus) => ({ text: CLASS_STATUS[s].label, ...CLASS_STATUS[s].tone(c) });

export const ClassReviewPanel: React.FC<{ session: Session; onChanged?: () => void }> = ({ session, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const [status, setStatus] = useState<ClassStatus | 'all'>('PENDING');
  const [items, setItems] = useState<ClassRequest[] | null>(null);
  const [review, setReview] = useState<{ cls: ClassRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const system = session.user.role === 'root_admin';

  const load = useCallback(() => {
    setItems(null);
    adminApi
      .getClasses(session.token, status === 'all' ? undefined : status)
      .then(setItems)
      .catch((err) => {
        setItems([]);
        fail(err);
      });
  }, [session.token, status, fail]);
  useEffect(load, [load]);

  const submit = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await adminApi.reviewClass(session.token, review.cls.id, review.approve, note.trim() || null);
      toast(review.approve ? `Đã duyệt lớp ${review.cls.class_code} – giáo viên nhận thông báo và email` : `Đã từ chối lớp ${review.cls.class_code}`);
      setReview(null);
      setNote('');
      load();
      onChanged?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <PanelHead
        icon={Check}
        color={c.ngocDam}
        title="Duyệt yêu cầu mở lớp"
        text="Giáo viên gửi mã lớp, năm học, tên lớp và mật khẩu lớp. Duyệt xong, giáo viên nhận thông báo trong app và email để phát cho học sinh."
        action={<Btn tone="giay" size="sm" icon={RefreshCw} label="Tải lại" onPress={load} />}
      />
      <Segmented
        label="Lọc theo trạng thái"
        options={[
          { value: 'PENDING' as const, label: 'Chờ duyệt' },
          { value: 'APPROVED' as const, label: 'Đã duyệt' },
          { value: 'REJECTED' as const, label: 'Từ chối' },
          { value: 'all' as const, label: 'Tất cả' },
        ]}
        value={status}
        onChange={setStatus}
      />
      {items === null ? (
        <Skeleton height={56} />
      ) : items.length === 0 ? (
        <Txt size={14} color={c.muc2}>
          {status === 'PENDING' ? 'Không có yêu cầu nào đang chờ duyệt.' : 'Không có lớp nào.'}
        </Txt>
      ) : (
        items.map((k) => {
          const chip = classStatusChip(c, k.status);
          return (
            <Inset key={k.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
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
                  GV {k.teacher_name}
                  {system && k.school_name ? ` · ${k.school_name}` : ''} · gửi {formatDateTime(k.created_at)}
                  {k.status === 'APPROVED' ? ` · ${k.members} học sinh` : ''}
                </Txt>
                {k.review_note && (
                  <Txt size={12} color={c.muc3}>
                    Ghi chú: {k.review_note}
                  </Txt>
                )}
              </View>
              {k.status === 'PENDING' ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Btn title="Duyệt" icon={Check} tone="ngoc" size="sm" onPress={() => setReview({ cls: k, approve: true })} />
                  <Btn title="Từ chối" icon={X} tone="giay" size="sm" onPress={() => setReview({ cls: k, approve: false })} />
                </View>
              ) : (
                <Chip text={chip.text} bg={chip.bg} fg={chip.fg} />
              )}
            </Inset>
          );
        })
      )}
      <Sheet
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.approve ? `Duyệt lớp ${review.cls.class_code}?` : `Từ chối lớp ${review?.cls.class_code ?? ''}?`}
        subtitle={review ? `${review.cls.name} · ${review.cls.school_year} · GV ${review.cls.teacher_name}` : undefined}
        footer={
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Btn title="Hủy" tone="giay" onPress={() => setReview(null)} disabled={busy} />
            <Btn title={review?.approve ? 'Duyệt lớp' : 'Từ chối'} tone={review?.approve ? 'ngoc' : 'son'} loading={busy} onPress={submit} />
          </View>
        }
      >
        <Field
          label={review?.approve ? 'Lời nhắn cho giáo viên (không bắt buộc)' : 'Lý do từ chối'}
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
          inputStyle={{ minHeight: 80 }}
          textAlignVertical="top"
        />
      </Sheet>
    </Card>
  );
};

// ---------------------------------------------------------------------- chuông thông báo
const POLL_MS = 20_000;

/** Thông báo trong app (duyệt lớp, yêu cầu mở lớp, học sinh vào lớp): tự cập nhật mỗi 20 giây và khi quay lại app */
export const NotificationBell: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const fail = useFail(session);
  const [data, setData] = useState<{ unread: number; items: AppNotification[] }>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const token = session.token;

  const load = useCallback(() => {
    authApi
      .getNotifications(token)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) fail(err);
      });
  }, [token, fail]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);

  const show = () => {
    setOpen(true);
    if (data.unread) {
      authApi
        .markNotificationsRead(token)
        .then(() => setData((d) => ({ unread: 0, items: d.items.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) })))
        .catch(() => undefined);
    }
  };

  return (
    <>
      <View>
        <Btn tone="giay" size="sm" icon={Bell} label={data.unread ? `Thông báo: ${data.unread} chưa đọc` : 'Thông báo'} onPress={show} testID="notify-bell" />
        {data.unread > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center' }}>
            <Txt f="bold" size={11} color="#ffffff">
              {data.unread > 9 ? '9+' : data.unread}
            </Txt>
          </View>
        )}
      </View>
      <Sheet open={open} onClose={() => setOpen(false)} title="Thông báo" icon={<Mascot size={40} mood="excited" />}>
        {data.items.length === 0 ? (
          <Txt color={c.muc2}>Chưa có thông báo nào.</Txt>
        ) : (
          data.items.map((n) => (
            <Inset key={n.id} style={{ gap: 2, backgroundColor: n.kind === 'class_approved' ? c.ngocNhat : n.kind === 'class_rejected' ? c.sonNhat : c.giay2 }}>
              <Txt f="bold" size={14}>
                {n.title}
              </Txt>
              <Txt size={14} color={c.muc2}>
                {n.body}
              </Txt>
              <Txt size={12} color={c.muc3}>
                {formatDateTime(n.created_at)}
              </Txt>
            </Inset>
          ))
        )}
      </Sheet>
    </>
  );
};

/** Hàng huy hiệu Khối 6 – 9 kèm số học sinh */
export const GradeRow: React.FC<{ grades: Record<6 | 7 | 8 | 9, number>; size?: number }> = ({ grades, size = 40 }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
    {([6, 7, 8, 9] as const).map((g) => (
      <View key={g} style={{ flexGrow: 1, flexBasis: 120 }}>
        <GradeBadge grade={g} size={size} count={grades[g] ?? 0} />
      </View>
    ))}
  </View>
);
