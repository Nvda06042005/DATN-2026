/**
 * Bộ thành phần dùng chung của các cổng quản trị: tải dữ liệu, bảng/danh sách thích ứng, thanh lọc, phân trang, biểu mẫu từ mô tả,
 * chọn nhiều, hiển thị mật khẩu tạm một lần, nhập Excel có xem trước. Giao diện phẳng (AdminUiContext) theo bảng màu sáng của dự án.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AlertTriangle, Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Download, FileUp, Funnel, Info, Search, SlidersHorizontal, Square, X } from 'lucide-react-native';
import { ApiError, errorMessage, type PickedFile } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Btn, Card, Chip, EmptyState, Field, Inset, Sheet, Spinner, Txt, useToast, PhoneField } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { copyText } from '@/lib/clipboard';
import { DEFAULT_PAGE_SIZE, getPageSize, PAGE_SIZES, pageWindow, setPageSize, subscribePageSize, TABLE_MIN_WIDTH } from '@/lib/paging';
import { splitTitle } from '@/lib/title-split';
import { normalizePhone, phoneError } from '@/lib/phone';
import { acceptNote, checkPickedFile, checkTemplateFilename, XLSM_MIME } from '@/lib/upload-rules';
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
/** Khi chữ phải xuống dòng thì chia đều hai dòng (không để lẻ một từ ở dòng cuối); chỉ có tác dụng trên web. */
export const WRAP_BALANCE = (Platform.OS === 'web' ? { textWrap: 'balance' } : null) as object;
export const WRAP_PRETTY = (Platform.OS === 'web' ? { textWrap: 'pretty' } : null) as object;

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => {
  const { c } = useTheme();
  // hai nửa đều nhau như tiêu đề ở trang chủ: nửa đầu chữ đậm màu mực, nửa sau chữ nghiêng màu đỏ ("Trường | học", "Thống kê | hệ thống")
  const [head, tail] = splitTitle(title);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexShrink: 1, minWidth: 220, gap: 2 }}>
        <Txt f="displayHeavy" size={26} color={c.logoInk} accessibilityRole="header" style={[{ lineHeight: 34 }, WRAP_BALANCE]}>{head}{tail ? ' ' : ''}{tail ? <Txt f="serifItalic" size={26} color={c.logoRed} style={{ lineHeight: 34 }}>{tail}</Txt> : null}</Txt>
        {subtitle ? <Txt size={14} color={c.muc2} style={WRAP_PRETTY}>{subtitle}</Txt> : null}
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }}>{actions}</View> : null}
    </View>
  );
};

export const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16, maxWidth: 1120, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
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
  <View style={{ flexGrow: flex, flexBasis: 180, minWidth: 160, maxWidth: flex > 1 ? 360 : 280 }}>{children}</View>
);

export interface SearchFilter {
  key: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  testID?: string;
  /** Cột có giá trị tự do: ô tìm trong danh sách luôn hiện, gõ chữ rồi chọn dòng "Lọc theo …" để lọc theo chữ vừa gõ */
  custom?: boolean;
}

/**
 * Thanh tìm kiếm kèm lọc. Trên màn hình đủ rộng để hiện bảng, mỗi bộ lọc nằm ngay tiêu đề cột tương ứng (nút mũi tên ở `Column.filter`, như bộ lọc của Excel) nên thanh
 * này chỉ có ô tìm kiếm và nút "Xóa lọc" khi đang lọc. Trên màn hẹp (danh sách thẻ, không có tiêu đề cột) vẫn có nút "Bộ lọc" liền bên phải ô tìm kiếm, bấm mở khung
 * chọn các bộ lọc; khi khung đóng, bộ lọc đang bật hiện thành nhãn bấm để bỏ từng cái. Giá trị rỗng nghĩa là không lọc.
 */
export const SearchFilterBar: React.FC<{ placeholder: string; value: string; onChange: (value: string) => void; filters?: SearchFilter[]; extra?: React.ReactNode; searchId?: string }> = ({ placeholder, value, onChange, filters = [], extra, searchId }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const inHeader = width >= TABLE_MIN_WIDTH;
  const [open, setOpen] = useState(false);
  const active = filters.filter((f) => f.value !== '');
  const chip = (f: SearchFilter) => `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <View accessibilityRole="search" style={{ flex: 1, minWidth: 260, maxWidth: 520, minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: open ? c.logoRed : c.bienXanh, backgroundColor: c.the, paddingLeft: 16, overflow: 'hidden' }}>
          <Search size={18} color={c.muc3} />
          <TextInput nativeID={searchId} testID={searchId} accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={c.muc3} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            style={[{ flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 12, fontFamily: FONT.medium, fontSize: 14, color: c.logoInk }, Platform.OS === 'web' ? ({ outlineStyle: 'solid', outlineWidth: 0 } as object) : null]} />
          {value ? <Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm" onPress={() => onChange('')} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={16} color={c.muc3} /></Pressable> : null}
          {filters.length && !inHeader ? (
            <Pressable testID="filter-toggle" accessibilityRole="button" accessibilityLabel={active.length ? `Bộ lọc, đang bật ${active.length}` : 'Bộ lọc'} accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderLeftWidth: 1, borderLeftColor: c.bienXanh, backgroundColor: open ? c.adminTint : pressed ? c.adminCanvas : c.the })}>
              <SlidersHorizontal size={17} color={active.length || open ? c.logoRed : c.logoInk} />
              <Txt f="bold" size={14} color={active.length || open ? c.logoRed : c.logoInk}>Bộ lọc</Txt>
              {active.length ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.logoRed, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={11} color={c.trang}>{active.length}</Txt></View> : null}
              <ChevronDown size={16} color={c.muc3} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>
          ) : null}
        </View>
        {inHeader && active.length ? (
          <Pressable testID="filter-clear-all" accessibilityRole="button" accessibilityLabel="Xóa mọi bộ lọc" onPress={() => active.forEach((f) => f.onChange(''))}
            style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.logoRed, backgroundColor: pressed ? c.sonNhat : c.adminTint, flexDirection: 'row', alignItems: 'center', gap: 6 })}>
            <Funnel size={14} color={c.logoRed} />
            <Txt f="semibold" size={13} color={c.logoRed}>Xóa lọc ({active.length})</Txt>
          </Pressable>
        ) : null}
        {extra}
      </View>
      {!inHeader && open && filters.length ? (
        <View testID="filter-panel" style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 680, borderWidth: 1, borderColor: c.adminLine, borderRadius: 16, backgroundColor: c.the, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {filters.map((f) => <FilterBox key={f.key}><AdminSelect<string> label={f.label} value={f.value} options={f.options} onChange={f.onChange} testID={f.testID ?? `filter-${f.key}`} /></FilterBox>)}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            {active.length ? <Btn testID="filter-clear" title="Xóa bộ lọc" tone="giay" size="sm" onPress={() => active.forEach((f) => f.onChange(''))} /> : null}
            <Btn title="Xong" tone="son" size="sm" onPress={() => setOpen(false)} />
          </View>
        </View>
      ) : null}
      {!inHeader && !open && active.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {active.map((f) => (
            <Pressable key={f.key} testID={`filter-chip-${f.key}`} accessibilityRole="button" accessibilityLabel={`Bỏ bộ lọc ${chip(f)}`} onPress={() => f.onChange('')}
              style={({ pressed }) => ({ minHeight: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 999, borderWidth: 1, borderColor: c.logoRed, backgroundColor: pressed ? c.sonNhat : c.adminTint, flexDirection: 'row', alignItems: 'center', gap: 6 })}>
              <Txt f="semibold" size={12} color={c.logoRed}>{chip(f)}</Txt>
              <X size={14} color={c.logoRed} />
            </Pressable>
          ))}
          <Pressable testID="filter-clear-all" accessibilityRole="button" accessibilityLabel="Xóa mọi bộ lọc" onPress={() => active.forEach((f) => f.onChange(''))} style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 }}><Txt f="semibold" size={12} color={c.muc2}>Xóa tất cả</Txt></Pressable>
        </View>
      ) : null}
    </View>
  );
};

/** Số dòng mỗi trang do người dùng chọn ở ô chọn cạnh nút chuyển trang (5, 10, 25, 30 hoặc 50); dùng chung cho mọi bảng và danh sách của cả bốn cổng (cách lưu ở lib/paging.ts) */
export const usePageSize = (): number => useSyncExternalStore(subscribePageSize, getPageSize, () => DEFAULT_PAGE_SIZE);

/** Ô chọn số dòng mỗi trang; đổi thì mọi bảng đổi theo và quay về trang 1 */
const PageSizeSelect: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { c } = useTheme();
  const size = usePageSize();
  return (
    <View testID="page-size" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Txt size={12} color={c.muc2}>Số dòng</Txt>
      <View style={{ width: 76 }}>
        <AdminSelect<number> compact bare label="Số dòng mỗi trang" value={size} options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))} testID="page-size-select" onChange={(n) => { setPageSize(n); onChanged(); }} />
      </View>
    </View>
  );
};

/** Nút chuyển trang: Trước, các số trang, Sau và ô chọn số dòng mỗi trang; luôn hiện, kể cả khi chỉ có một trang */
export const Pager: React.FC<{ page: number; limit: number; total: number; onPage: (page: number) => void }> = ({ page, limit, total, onPage }) => {
  const { c } = useTheme();
  const pages = Math.max(1, Math.ceil(total / limit));
  // luôn hiện đủ nút Trước, số trang, Sau và ô chọn số dòng, kể cả khi chỉ có một trang hoặc chưa có kết quả
  const sizeSelect = <PageSizeSelect onChanged={() => onPage(1)} />;
  const from = total ? (page - 1) * limit + 1 : 0, to = Math.min(total, page * limit);
  const pill = (props: { key: string; testID: string; label: string; disabled?: boolean; on?: boolean; onPress: () => void; children: React.ReactNode }) => (
    <Pressable key={props.key} testID={props.testID} accessibilityRole="button" accessibilityLabel={props.label} accessibilityState={{ disabled: props.disabled, selected: props.on }} disabled={props.disabled} onPress={props.onPress}
      style={({ pressed }) => ({ minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: props.on ? c.den : c.bienXanh, backgroundColor: props.on ? c.den : pressed ? c.adminCanvas : c.the, opacity: props.disabled ? 0.4 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 })}>
      {props.children}
    </Pressable>
  );
  return (
    <View testID="pager" accessibilityRole="toolbar" accessibilityLabel="Chuyển trang" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 8 }}>
      <Txt size={12} color={c.muc2}>{total ? `Hiển thị ${from}–${to} / ${total} kết quả` : 'Không có kết quả'}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        {pill({ key: 'prev', testID: 'pager-prev', label: 'Trang trước', disabled: page <= 1, onPress: () => onPage(page - 1), children: <><ChevronLeft size={14} color={c.logoInk} /><Txt f="bold" size={12}>Trước</Txt></> })}
        {pageWindow(page, pages).map((n, i) => n === '…'
          ? <Txt key={`gap${i}`} size={12} color={c.muc3} style={{ paddingHorizontal: 2 }}>…</Txt>
          : pill({ key: `p${n}`, testID: `pager-page-${n}`, label: `Trang ${n}`, on: n === page, onPress: () => onPage(n), children: <Txt f="bold" size={12} color={n === page ? c.trang : c.logoInk}>{n}</Txt> }))}
        {pill({ key: 'next', testID: 'pager-next', label: 'Trang sau', disabled: page >= pages, onPress: () => onPage(page + 1), children: <><Txt f="bold" size={12}>Sau</Txt><ChevronRight size={14} color={c.logoInk} /></> })}
      </View>
      {sizeSelect}
    </View>
  );
};

// ---------------------------------------------------------------------- bảng thích ứng
export interface Column<T> {
  key: string;
  label: string;
  /** Độ rộng tương đối trên bảng */
  flex?: number;
  /** Độ rộng tối thiểu (px): cột không hẹp hơn mức này dù bảng bị co (mã giáo viên, mã học sinh không được rớt dòng); phần còn lại chia theo `flex` */
  minWidth?: number;
  render: (row: T) => React.ReactNode;
  /** Ẩn cột trên danh sách thẻ (điện thoại) */
  hideOnCard?: boolean;
  /** Bộ lọc của cột: hiện nút mũi tên ở tiêu đề cột (kiểu Excel); bấm mở danh sách giá trị, chọn một giá trị để lọc, chọn dòng đầu ("Tất cả") để bỏ lọc */
  filter?: SearchFilter;
}

/**
 * Bảng "chia đều" (DataTable `equal`): mọi cột rộng bằng nhau (1/số cột của bảng), mỗi cột không hẹp hơn EQUAL_COLUMN_MIN (đủ cho mã 18 ký tự ở cỡ chữ 10);
 * màn hẹp hơn tổng mức tối thiểu thì bảng cuộn ngang thay vì bóp chữ. Khoảng cách cột và lề trong nhỏ hơn bảng thường để mỗi cột rộng được tối đa.
 */
export const EQUAL_COLUMN_MIN = 112;
const EQUAL_GAP = 6;
const EQUAL_PAD = 10;

/** Nút lọc ở tiêu đề cột: ô vuông nhỏ có mũi tên (đỏ kèm phễu khi đang lọc), bấm mở danh sách giá trị ngay dưới nút. Danh sách dài có ô tìm trong danh sách. */
const ColumnFilter: React.FC<{ filter: SearchFilter }> = ({ filter }) => {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [term, setTerm] = useState('');
  const on = filter.value !== '';
  const close = () => { setAnchor(null); setTerm(''); };
  const needle = term.trim().toLowerCase();
  const shown = needle ? filter.options.filter((o) => o.label.toLowerCase().includes(needle)) : filter.options;
  const menuWidth = Math.min(264, width - 16);
  const left = anchor ? Math.max(8, Math.min(anchor.x + anchor.w - menuWidth, width - menuWidth - 8)) : 0;
  const top = anchor ? anchor.y + anchor.h + 6 : 0;
  const customValue = filter.custom && filter.value && !filter.options.some((o) => o.value === filter.value) ? filter.value : '';
  const chosen = filter.options.find((o) => o.value === filter.value)?.label ?? (customValue || undefined);
  const typed = filter.custom ? term.trim() : '';
  const canUseTyped = !!typed && typed.toLowerCase() !== customValue.toLowerCase() && !filter.options.some((o) => o.label.toLowerCase() === typed.toLowerCase());
  return (
    <>
      <Pressable ref={ref} testID={`col-filter-${filter.key}`} accessibilityRole="button" accessibilityLabel={on ? `Lọc theo ${filter.label}, đang lọc: ${chosen ?? filter.value}` : `Lọc theo ${filter.label}`} accessibilityState={{ expanded: !!anchor }}
        onPress={() => ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }))}
        style={({ pressed }) => ({ width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: on ? c.logoRed : c.bienXanh, backgroundColor: on ? c.logoRed : pressed ? c.adminTint : c.the, alignItems: 'center', justifyContent: 'center' })}>
        {on ? <Funnel size={13} color={c.trang} /> : <ChevronDown size={14} color={c.logoInk} />}
      </Pressable>
      {anchor ? (
        <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng danh sách lọc" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View testID="col-filter-menu" accessibilityViewIsModal style={{ position: 'absolute', left, top, width: menuWidth, maxHeight: Math.max(180, Math.min(400, height - top - 16)), borderRadius: 10, borderWidth: 1, borderColor: c.adminLine, backgroundColor: c.the, padding: 6, boxShadow: '0 12px 32px rgba(35, 56, 47, 0.18)' } as object}>
            <Txt f="bold" size={12} color={c.muc3} style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 }}>Lọc theo {filter.label.toLowerCase()}</Txt>
            {filter.options.length > 8 || filter.custom ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 4, paddingHorizontal: 10, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: c.adminLine }}>
                <Search size={15} color={c.muc3} />
                <TextInput testID="col-filter-search" accessibilityLabel={`Tìm trong danh sách ${filter.label.toLowerCase()}`} placeholder={filter.custom ? 'Gõ để lọc hoặc tìm' : 'Tìm trong danh sách'} placeholderTextColor={c.muc3} value={term} onChangeText={setTerm} autoCapitalize="none" autoCorrect={false}
                  style={[{ flex: 1, minWidth: 0, minHeight: 36, fontFamily: FONT.medium, fontSize: 13, color: c.logoInk }, Platform.OS === 'web' ? ({ outlineStyle: 'solid', outlineWidth: 0 } as object) : null]} />
              </View>
            ) : null}
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {canUseTyped ? (
                <Pressable testID={`col-filter-${filter.key}-option-custom`} accessibilityRole="button" onPress={() => { filter.onChange(typed); close(); }}
                  style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? c.adminCanvas : c.adminTint })}>
                  <View style={{ width: 16 }}><Search size={14} color={c.logoRed} /></View>
                  <Txt f="semibold" size={14} color={c.logoRed} numberOfLines={2} style={{ flex: 1 }}>Lọc theo “{typed}”</Txt>
                </Pressable>
              ) : null}
              {customValue ? (
                <Pressable testID={`col-filter-${filter.key}-option-current`} accessibilityRole="radio" accessibilityState={{ checked: true }} onPress={close}
                  style={{ minHeight: 40, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.adminTint }}>
                  <View style={{ width: 16 }}><Check size={16} color={c.logoRed} /></View>
                  <Txt f="bold" size={14} color={c.logoRed} numberOfLines={2} style={{ flex: 1 }}>{customValue}</Txt>
                </Pressable>
              ) : null}
              {shown.map((o) => {
                const picked = o.value === filter.value;
                return (
                  <Pressable key={o.value || '__all'} testID={`col-filter-${filter.key}-option-${o.value || 'all'}`} accessibilityRole="radio" accessibilityState={{ checked: picked }} onPress={() => { filter.onChange(o.value); close(); }}
                    style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: picked ? c.adminTint : pressed ? c.adminCanvas : 'transparent' })}>
                    <View style={{ width: 16 }}>{picked ? <Check size={16} color={c.logoRed} /> : null}</View>
                    <Txt f={picked ? 'bold' : 'medium'} size={14} color={picked ? c.logoRed : c.logoInk} numberOfLines={2} style={{ flex: 1 }}>{o.label}</Txt>
                  </Pressable>
                );
              })}
              {!shown.length ? <Txt size={13} color={c.muc3} style={{ padding: 12 }}>Không có giá trị nào khớp.</Txt> : null}
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </>
  );
};

/** Bảng khi đủ rộng; danh sách thẻ "nhãn: giá trị" trên màn hẹp. Hàng có thể bấm để mở chi tiết. */
export function DataTable<T>({ columns, rows, rowKey, onRowPress, empty, actions, actionsWidth = 150, paginate = true, equal = false }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; onRowPress?: (row: T) => void; empty: string; actions?: (row: T) => React.ReactNode; actionsWidth?: number;
  /** Tự chia trang theo màn hình khi nhiều dòng hơn một trang (mặc định bật). Tắt khi bảng đã được chia trang ở máy chủ và có nút Pager riêng. */
  paginate?: boolean;
  /** Mọi cột rộng bằng nhau (xem EQUAL_COLUMN_MIN); bỏ qua `flex` và `minWidth` của từng cột */
  equal?: boolean;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const size = usePageSize();
  const [page, setPage] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0);
  const table = width >= TABLE_MIN_WIDTH;
  const paged = paginate && rows.length > size;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const filterable = table && columns.some((col) => col.filter);
  if (!rows.length && !filterable) return <EmptyState mood="thinking" title={empty} />;
  const shown = paged ? rows.slice((current - 1) * size, current * size) : rows;
  // bảng có dòng nào cũng có thanh chuyển trang và ô chọn số dòng, kể cả khi chỉ có một trang
  const pager = paginate ? <Pager page={current} limit={size} total={rows.length} onPage={setPage} /> : null;
  if (!table) {
    return (
      <View style={{ gap: 10 }}>
        {shown.map((row) => (
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
        {pager}
      </View>
    );
  }
  const pad = equal ? EQUAL_PAD : 14;
  const gap = equal ? EQUAL_GAP : 12;
  // chia đều: độ rộng cơ sở 0px (không phải 0%) để chữ trong ô không làm bảng phình rộng hơn tổng mức tối thiểu khi khung chưa có chiều rộng cố định
  const cellStyle = (col: Column<T>) => (equal ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: EQUAL_COLUMN_MIN } : { flex: col.flex ?? 1, minWidth: col.minWidth ?? 0 });
  const grid = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingVertical: filterable ? 8 : 10, backgroundColor: c.adminCanvas, borderBottomWidth: 1, borderBottomColor: c.adminLine, gap }}>
        {columns.map((col) => (
          <View key={col.key} style={[cellStyle(col), { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Txt f="bold" size={12} color={col.filter?.value ? c.logoRed : c.muc2} style={{ flexShrink: 1 }}>{col.label}</Txt>
            {col.filter ? <ColumnFilter filter={col.filter} /> : null}
          </View>
        ))}
        {actions ? <View style={{ width: actionsWidth }} /> : null}
      </View>
      {!rows.length ? <View style={{ padding: 8 }}><EmptyState mood="thinking" title={empty} /></View> : null}
      {shown.map((row, i) => (
        <Pressable key={rowKey(row)} accessibilityRole={onRowPress ? 'button' : undefined} disabled={!onRowPress} onPress={() => onRowPress?.(row)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, minHeight: 52, paddingVertical: 8, gap, borderTopWidth: i ? 1 : 0, borderTopColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the })}>
          {columns.map((col) => <View key={col.key} style={cellStyle(col)}>{col.render(row)}</View>)}
          {actions ? <View style={{ width: actionsWidth, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>{actions(row)}</View> : null}
        </Pressable>
      ))}
    </>
  );
  // bảng chia đều: tiêu đề và các hàng cùng nằm trong một khung cuộn ngang. Chiều rộng bảng là số cố định = max(khung chứa, tổng mức tối thiểu của các cột);
  // không để trình duyệt tự suy từ độ dài chữ trong ô, vì như vậy bảng phình rộng hơn khung và các cột không còn đều.
  const equalMin = columns.length * EQUAL_COLUMN_MIN + (columns.length - 1) * gap + 2 * pad + (actions ? actionsWidth + gap : 0);
  return (
    <View style={{ gap: 10 }}>
      <View onLayout={equal ? (e) => setBoxWidth(Math.round(e.nativeEvent.layout.width)) : undefined} style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, backgroundColor: c.the, overflow: 'hidden' }}>
        {equal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: Math.max(boxWidth - 2, equalMin) }}>{grid}</View>
          </ScrollView>
        ) : grid}
      </View>
      {pager}
    </View>
  );
}

export const Cell: React.FC<{ main: string; sub?: string | null }> = ({ main, sub }) => {
  const { c } = useTheme();
  return (
    <View style={{ minWidth: 0 }}>
      <Txt f="semibold" size={14} numberOfLines={2} style={WRAP_BALANCE}>{main}</Txt>
      {sub ? <Txt size={12} color={c.muc3} numberOfLines={2} style={WRAP_BALANCE}>{sub}</Txt> : null}
    </View>
  );
};

export const StatusChip: React.FC<{ kind: 'on' | 'off' | 'warn' | 'info' | 'muted'; text: string }> = ({ kind, text }) => {
  const { c } = useTheme();
  const map = { on: [c.mocNhat, c.mocChu], off: [c.sonNhat, c.sonChu], warn: [c.vangNhat, c.vangChu], info: [c.thuyNhat, c.thuyChu], muted: [c.dichNhat, c.dich] } as const;
  // nhãn dài ("Chưa đổi mật khẩu") trong ô bảng hẹp xuống dòng trong khung của ô thay vì bị cắt ở mép bảng
  return <Chip text={text} bg={map[kind][0]} fg={map[kind][1]} wrap style={{ alignSelf: 'flex-start', maxWidth: '100%' }} />;
};

// ---------------------------------------------------------------------- biểu mẫu từ mô tả
export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'phone' | 'date' | 'number' | 'textarea' | 'select' | 'multi';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Ẩn ô theo giá trị hiện tại của biểu mẫu */
  when?: (values: Record<string, string | string[]>) => boolean;
  readOnly?: boolean;
  /** Ô ngày (type 'date') chọn bằng lịch của trình duyệt trên web; điện thoại vẫn gõ YYYY-MM-DD. `min`/`max` dạng YYYY-MM-DD */
  calendar?: boolean;
  min?: string;
  max?: string;
  /** Ô tùy biến (ví dụ bản đồ chọn tọa độ): tự vẽ và tự ghi vào các giá trị khác */
  render?: (values: Record<string, string | string[]>, set: (name: string, value: string | string[]) => void) => React.ReactNode;
}

type Values = Record<string, string | string[]>;

/** Hộp thoại biểu mẫu: kiểm tra trường bắt buộc, hiện lỗi máy chủ ngay trong hộp thoại; giữ nguyên dữ liệu đã nhập khi lỗi */
export const FormSheet: React.FC<{
  title: string; subtitle?: string; fields: FieldDef[]; initial?: Values; submitLabel?: string; wide?: boolean; footerExtra?: React.ReactNode;
  onSubmit: (values: Values) => Promise<void>; onClose: () => void;
}> = ({ title, subtitle, fields, initial, submitLabel = 'Lưu', wide, footerExtra, onSubmit, onClose }) => {
  // ô số điện thoại (quản trị, giáo viên, học sinh): số cũ có dấu cách mà đủ 10 chữ số thì làm sạch, số lạ giữ nguyên để người dùng thấy cảnh báo và tự sửa
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, f.type === 'phone' ? normalizePhone(String(initial?.[f.name] ?? '')) : initial?.[f.name] ?? (f.type === 'multi' ? [] : '')])));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const visible = fields.filter((f) => !f.when || f.when(values));
  const set = (name: string, value: string | string[]) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async () => {
    const gaps = Object.fromEntries(visible.filter((f) => f.required && !f.readOnly && !f.render && (f.type === 'multi' ? !(values[f.name] as string[]).length : !String(values[f.name] ?? '').trim())).map((f) => [f.name, true]));
    setMissing(gaps);
    if (Object.keys(gaps).length) return setError('Hãy điền các ô bắt buộc (đánh dấu *).');
    const badPhone = visible.map((f) => (f.type === 'phone' ? phoneError(String(values[f.name] ?? '')) : null)).find(Boolean);
    if (badPhone) return setError(badPhone);
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
    <Sheet open onClose={onClose} title={title} subtitle={subtitle} wide={wide} panelStyle={wide ? { maxWidth: 720 } : undefined}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>{footerExtra}<Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={submitLabel} tone="son" onPress={submit} loading={busy} testID="form-submit" /></View>}>
      <ErrorNote message={error} />
      {/* hai cột khi đủ rộng (ô dài, ô tùy biến và danh sách chọn nhiều chiếm cả hàng) để hộp thấp, không phải cuộn dài */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {visible.map((f) => {
          const full = Boolean(f.render) || f.type === 'textarea' || f.type === 'multi';
          return (
            <View key={f.name} style={{ flexGrow: 1, flexBasis: full ? '100%' : 240, minWidth: 0 }}>
              {f.render ? f.render(values, set) : <FormField def={f} value={values[f.name]} error={missing[f.name] ? 'Ô này bắt buộc.' : null} onChange={(v) => set(f.name, v)} />}
            </View>
          );
        })}
      </View>
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
  if (def.type === 'date' && def.calendar && Platform.OS === 'web') return <CalendarInput def={def} label={label} value={String(value ?? '')} error={error} onChange={onChange} />;
  if (def.type === 'phone') return <PhoneField label={label} hint={def.hint} error={error} value={String(value ?? '')} onChange={(v) => onChange(v)} placeholder={def.placeholder} nativeID={`field-${def.name}`} editable={!def.readOnly} />;
  return (
    <Field label={label} hint={def.hint} error={error} value={String(value ?? '')} onChangeText={(v) => onChange(v)} placeholder={def.placeholder ?? (def.type === 'date' ? 'YYYY-MM-DD' : undefined)}
      editable={!def.readOnly} multiline={def.type === 'textarea'} numberOfLines={def.type === 'textarea' ? 4 : 1} inputStyle={def.type === 'textarea' ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
      autoCapitalize={def.type === 'email' ? 'none' : 'sentences'} keyboardType={def.type === 'email' ? 'email-address' : def.type === 'tel' ? 'phone-pad' : def.type === 'number' ? 'numeric' : 'default'} nativeID={`field-${def.name}`} />
  );
};

/** Ô ngày chọn bằng lịch (web): thẻ input type="date" của trình duyệt, giá trị YYYY-MM-DD như ô gõ tay; chỉ chọn trong khoảng min–max */
export const CalendarInput: React.FC<{ def: FieldDef; label: string; value: string; error: string | null; onChange: (v: string) => void }> = ({ def, label, value, error, onChange }) => {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  const input = React.createElement('input', {
    type: 'date', id: `field-${def.name}`, 'data-testid': `field-${def.name}`, 'aria-label': label, value, min: def.min, max: def.max, disabled: def.readOnly,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onFocus: () => setFocus(true), onBlur: () => setFocus(false),
    style: { minHeight: 44, boxSizing: 'border-box', width: '100%', padding: '0 12px', borderRadius: 5, border: `1px solid ${error ? c.son : focus ? c.son : c.adminLine}`, backgroundColor: c.the, color: c.logoInk, fontFamily: FONT.body, fontSize: 14, outline: 'none' },
  });
  return (
    <View style={{ gap: 6 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      {input}
      {error ? <Txt size={13} f="semibold" color={c.sonChu}>{error}</Txt> : def.hint ? <Txt size={13} color={c.muc2}>{def.hint}</Txt> : <Txt size={13} color={c.muc3}>Bấm vào ô rồi chọn ngày trên lịch.</Txt>}
    </View>
  );
};

// ---------------------------------------------------------------------- mật khẩu tạm (chỉ hiện một lần)
const MAIL_NOTE = { queued: 'Thư thông tin đăng nhập đã được xếp vào hàng đợi gửi.', no_email: 'Tài khoản chưa có email nên chưa gửi thư: hãy chuyển thông tin này cho người dùng.', not_configured: 'Máy chủ chưa cấu hình gửi thư: hãy chuyển thông tin này cho người dùng.' } as const;

export const CredentialSheet: React.FC<{ title: string; account: { full_name: string; username: string; temporary_password: string; mail: keyof typeof MAIL_NOTE }; onClose: () => void; extra?: React.ReactNode }> = ({ title, account, onClose, extra }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyText(`Tên đăng nhập: ${account.username}\nMật khẩu tạm: ${account.temporary_password}`);
    setCopied(ok);
    toast(ok ? 'Đã sao chép' : 'Không sao chép tự động được, hãy chọn và chép thủ công.');
  };
  return (
    <Sheet open onClose={onClose} title={title} subtitle={account.full_name} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>{Platform.OS === 'web' && <Btn title={copied ? 'Đã sao chép' : 'Sao chép'} tone="giay" onPress={copy} testID="credential-copy" />}<Btn title="Đã ghi lại" tone="son" onPress={onClose} /></View>}>
      <Inset style={{ gap: 6 }}>
        <Txt size={13} color={c.muc2}>Tên đăng nhập</Txt>
        <Txt f="bold" size={18} selectable testID="credential-username">{account.username}</Txt>
        <Txt size={13} color={c.muc2} style={{ marginTop: 6 }}>Mật khẩu tạm</Txt>
        <Txt f="bold" size={22} selectable testID="credential-password">{account.temporary_password}</Txt>
      </Inset>
      <Txt size={14} color={c.muc2}>{MAIL_NOTE[account.mail]} Mật khẩu này chỉ hiện một lần; người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.</Txt>
      {extra}
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
  title: string; hint: string; template?: { fetchBlob: () => Promise<Blob>; filename: string }; types?: string[]; expectedFilename?:string; legacyFilename?:string; acceptMacro?:boolean;
  run: (file: PickedFile, commit: boolean) => Promise<ImportResult | { committed: boolean; total: number; errors: number; created: number; updated: number; report: Array<{ entity: string; slug: string; action: string; message?: string }> }>;
  onClose: () => void; onDone: () => void;
}> = ({ title, hint, template, types: baseTypes = XLSX_TYPES, expectedFilename, legacyFilename, acceptMacro=false, run, onClose, onDone }) => {
  const { c } = useTheme();
  const toast = useToast();
  const types=acceptMacro?[...XLSX_TYPES,XLSM_MIME]:baseTypes;
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
    setResult(null);
    const wrong = checkPickedFile(picked, types);
    if (wrong) { setFile(null); setError(wrong); return; }
    const wrongName=checkTemplateFilename(picked.name,expectedFilename,legacyFilename);
    if(wrongName){setFile(null);setError(wrongName);return;}
    setFile(picked);
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
      <View testID="import-accept-note">
        <Inset style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Info size={16} color={c.muc2} style={{ marginTop: 2 }} />
          <Txt size={13} style={{ flex: 1 }}>{acceptNote(types)}</Txt>
        </Inset>
      </View>
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
          {rows.filter((r) => r.status !== 'error').length ? <Txt size={13} color={c.muc2}>{rows.filter((r) => r.status !== 'error').length} dòng hợp lệ{committed ? ' đã được xử lý; danh sách trong trang đã tự cập nhật.' : ' sẽ được lưu khi bạn bấm nút bên dưới.'}</Txt> : null}
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

/**
 * Chia trang phía máy khách cho danh sách đã tải đủ (thư viện, thông báo…): trả về các phần tử của trang đang xem và thanh chuyển trang
 * (cùng ô chọn số dòng 5-10-25-30-50 với mọi bảng). `resetKey` đổi (đổi bộ lọc, đổi mục) thì quay về trang 1.
 */
export function usePaged<T>(items: T[], resetKey: string | number = ''): { shown: T[]; pager: React.ReactElement; page: number; pages: number } {
  const size = usePageSize();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [resetKey]);
  return { shown: items.slice((current - 1) * size, current * size), pager: <Pager page={current} limit={size} total={items.length} onPage={setPage} />, page: current, pages };
}

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

/** Giờ Việt Nam <-> ISO: học sinh và nhà trường đều nhập giờ Việt Nam (UTC+7) */
export const toVn = (iso: string): string => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
export const fromVn = (text: string): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(text.trim());
  const date = m ? new Date(`${m[1]}T${m[2]}:00+07:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};
