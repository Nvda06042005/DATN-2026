/** Đọc và ghi file Excel (.xlsx) cho nhập/xuất danh sách giáo viên, học sinh, phân lớp và kho dữ liệu lịch sử (ExcelJS). */
import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as ExcelJS from 'exceljs';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 1000;
/** Nhận file tối đa 2 MB trong bộ nhớ (không ghi ra đĩa) */
export const XLSX_UPLOAD = FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
/** Trình duyệt gửi MIME chuẩn của .xlsx; app điện thoại có thể gửi application/octet-stream */
const ACCEPTED_MIMES = [XLSX_MIME, 'application/octet-stream'];

export interface UploadedXlsx { buffer: Buffer; originalname: string; mimetype: string; size: number }
/** `aliases`: tên cột khác cũng được nhận (ví dụ "SĐT" hay "Số điện thoại"), so khớp không dấu và không phân biệt hoa thường */
export interface Column { key: string; header: string; width?: number; required?: boolean; aliases?: string[] }

/** Bỏ dấu, chữ thường, bỏ dấu sao/ngoặc: so khớp tiêu đề cột mà không phụ thuộc cách gõ */
export const normHeader = (text: string): string =>
  text.replace(/\(.*?\)/g, '').replace(/\*/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Giá trị ô thành chuỗi (ô công thức, ô định dạng, ngày giờ, văn bản có định dạng) */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as Array<{ text: string }>).map((t) => t.text).join('').trim();
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if (typeof v.text === 'string') return v.text.trim();
    if (typeof v.hyperlink === 'string') return v.hyperlink;
    return '';
  }
  return String(value).trim();
}

/** Ngày dạng dd/mm/yyyy, yyyy-mm-dd hoặc ô ngày của Excel -> YYYY-MM-DD; null nếu sai định dạng */
export function parseDate(text: string): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function checkUpload(file: UploadedXlsx | undefined): UploadedXlsx {
  if (!file) throw new BadRequestException('Hãy chọn file Excel (.xlsx)');
  if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeException('File quá lớn (tối đa 2 MB)');
  if (!/\.xlsx$/i.test(file.originalname) || !ACCEPTED_MIMES.includes(file.mimetype) || file.buffer.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new BadRequestException('Chỉ nhận file Excel .xlsx tải từ mẫu của hệ thống');
  }
  return file;
}

/** Số dòng đầu của sheet được dò tìm dòng tiêu đề (file mẫu có khối tiêu đề "Đông A", ngày nhập… phía trên bảng) */
const HEADER_SCAN_ROWS = 30;
/** Quét tối đa từng này dòng dưới tiêu đề: file chỉ có định dạng trống kéo dài hàng triệu dòng không làm treo máy chủ */
const MAX_SCAN_ROWS = 10_000;
const headerNames = (c: Column): string[] => [c.header, ...(c.aliases ?? [])].map(normHeader);

/**
 * Đọc sheet đầu tiên. Dòng tiêu đề là dòng đầu tiên (trong 30 dòng đầu) có đủ các cột bắt buộc, nên đọc được cả file mẫu có khối tiêu đề phía trên lẫn file cũ có tiêu đề ở dòng 1.
 * Mỗi dòng dưới tiêu đề thành một đối tượng theo khóa cột; bỏ qua dòng trống; `row` là số dòng thật trong Excel để báo lỗi đúng chỗ.
 */
export async function readSheet(file: UploadedXlsx, columns: Column[], sheetName?: string, teacherCodes = false): Promise<Array<{ row: number; values: Record<string, string> }>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Không đọc được file Excel. Hãy dùng đúng file mẫu .xlsx.');
  }
  const sheet = (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('File Excel không có sheet nào');
  let header: { row: number; byHeader: Map<string, number> } | null = null;
  let closest: { found: number; missing: Column[] } | null = null;
  for (let r = 1; r <= Math.min(sheet.rowCount, HEADER_SCAN_ROWS) && !header; r += 1) {
    const byHeader = new Map<string, number>();
    sheet.getRow(r).eachCell((cell, col) => { const key = normHeader(cellText(cell.value)); if (key && !byHeader.has(key)) byHeader.set(key, col); });
    const found = columns.filter((c) => headerNames(c).some((h) => byHeader.has(h)));
    const missing = columns.filter((c) => c.required && !found.includes(c));
    if (!missing.length) header = { row: r, byHeader };
    else if (!closest || found.length > closest.found) closest = { found: found.length, missing };
  }
  if (!header) {
    const missing = (closest?.missing ?? columns.filter((c) => c.required)).map((c) => c.header.replace(/\*/g, '').trim());
    throw new BadRequestException(`File thiếu cột bắt buộc: ${missing.join(', ')}. Hãy dùng đúng file mẫu.`);
  }
  const cols = columns.map((c) => ({ key: c.key, col: headerNames(c).map((h) => header!.byHeader.get(h)).find((n) => n !== undefined) }));
  const rows: Array<{ row: number; values: Record<string, string> }> = [];
  let teacherIndex = 0;
  for (let r = header.row + 1; r <= Math.min(sheet.rowCount, header.row + MAX_SCAN_ROWS); r += 1) {
    const values: Record<string, string> = {};
    let any = false;
    for (const c of cols) {
      const text = c.col ? cellText(sheet.getRow(r).getCell(c.col).value) : '';
      values[c.key] = text;
      if (text) any = true;
    }
    if (teacherCodes && values.full_name) {
      teacherIndex += 1;
      const codeCol = cols.find(c => c.key === 'user_code')?.col;
      const nameCol = cols.find(c => c.key === 'full_name')?.col;
      const birthCol = cols.find(c => c.key === 'birth_date')?.col;
      const indexCol = header.byHeader.get(normHeader('Số thứ tự'));
      const cell = codeCol ? sheet.getCell(r, codeCol) : null;
      const formula = cell?.formula;
      const prefix = formula?.match(/,"([A-Z0-9]+)"&TEXT\(/)?.[1];
      // Chỉ tính đúng công thức do mẫu tạo; không chạy/eval công thức tùy ý từ file tải lên.
      const offset = Number(formula?.match(/TEXT\(\([A-Z]+\d+\+(\d{1,9})\),"000"\)/)?.[1]??0);
      const indexRef=indexCol?`${colLetter(indexCol)}${r}`:'';
      const formulaArgs = nameCol && birthCol && indexCol ? [`${colLetter(nameCol)}${r}`, `${colLetter(birthCol)}${r}`, offset?`(${indexRef}+${offset})`:indexRef] as const : null;
      if (prefix && formulaArgs && indexCol && (formula === teacherCodeFormula(prefix, ...formulaArgs) || formula === legacyTeacherCodeFormula(prefix, ...formulaArgs))) {
        const born = parseDate(values.birth_date);
        const indexCell = sheet.getCell(r, indexCol);
        const storedIndex = Number(cellText(indexCell.value));
        // Mẫu cũ tính STT theo tên; mẫu mới đánh số sẵn theo dòng, kể cả dòng còn trống.
        const serial = indexCell.formula && !storedIndex ? teacherIndex : storedIndex;
        if (!Number.isInteger(serial) || serial < 1 || serial > MAX_ROWS) throw new BadRequestException(`Số thứ tự ở dòng ${r} phải là số nguyên từ 1 đến ${MAX_ROWS}.`);
        values.user_code = born ? `${prefix}${born.slice(8,10)}${born.slice(5,7)}${born.slice(0,4)}${String(serial+offset).padStart(3,'0')}` : '';
      }
    }
    if (any) rows.push({ row: r, values });
  }
  if (rows.length > MAX_ROWS) throw new BadRequestException(`File có quá ${MAX_ROWS} dòng; hãy chia nhỏ`);
  return rows;
}

/** Tạo file .xlsx: một sheet, dòng 1 là tiêu đề đậm, cố định hàng đầu; `note` (nếu có) nằm ở sheet "Hướng dẫn" */
export async function buildWorkbook(sheetName: string, columns: Column[], rows: Array<Record<string, unknown>>, note?: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hào Khí Đông A';
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF8FF' } };
  for (const row of rows) sheet.addRow(columns.map((c) => row[c.key] ?? ''));
  if (note?.length) {
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.getColumn(1).width = 100;
    for (const line of note) guide.addRow([line]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------- mẫu nhập / danh sách xuất theo bố cục chuẩn của Đông A
const WEEKDAY_VN = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] as const;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Ngày Việt Nam (UTC+7) dạng "08/11/2026 (Chủ Nhật)": ngày tự cập nhật theo lúc tải file */
export function vnDayLabel(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 7 * 3_600_000);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} (${WEEKDAY_VN[d.getUTCDay()]})`;
}

/**
 * Cột của file mẫu/danh sách. `index`: số thứ tự đánh sẵn theo dòng; `text`/`phone`: ô văn bản (giữ số 0 đầu);
 * `list`: chọn trong danh sách `options`; `date`: ô ngày dd/mm/yyyy chỉ nhận ngày hợp lệ, kèm gợi ý chọn ngày.
 */
export interface FormColumn extends Column { kind: 'index' | 'text' | 'phone' | 'list' | 'date' | 'teacher-code'; options?: string[]; watch?: string; prompt?: string; codePrefix?: string; codeOffset?:number; birthKey?: string }

/** Tên riêng của trường, không gồm tiền tố cấp học; dùng chữ Latin viết hoa. */
export function schoolInitials(name: string): string {
  const plain = normHeader(name).replace(/^(truong\s+)?(trung hoc co so|trung hoc pho thong|tieu hoc|thcs|thpt|th)(\s+|$)/, '');
  return plain.split(/\s+/).filter(Boolean).map(word => word[0]).join('').toUpperCase().slice(0, 12) || 'GV';
}

const legacyTeacherCodeFormula = (prefix: string, name: string, birth: string, index: string): string =>
  `IF(AND(${name}<>"",ISNUMBER(${birth})),"${prefix}"&TEXT(${birth},"ddmmyyyy")&TEXT(${index},"000"),"")`;

/** Excel/WPS có thể giữ ngày được dán vào dưới dạng chữ. Đọc theo đúng định dạng, không phụ thuộc locale của DATEVALUE. */
const teacherCodeFormula = (prefix: string, name: string, birth: string, index: string): string => {
  const text = `TRIM(${birth})`;
  const code = (date: string) => `"${prefix}"&TEXT(${date},"ddmmyyyy")&TEXT(${index},"000")`;
  const iso = `DATE(VALUE(LEFT(${text},4)),VALUE(MID(${text},6,2)),VALUE(RIGHT(${text},2)))`;
  const dmy = `DATE(VALUE(RIGHT(${text},4)),VALUE(MID(${text},4,2)),VALUE(LEFT(${text},2)))`;
  const parsedCode = (date: string, format: string) => `IFERROR(IF(TEXT(${date},"${format}")=${text},${code(date)},""),"")`;
  return `IF(AND(${name}<>"",${birth}<>""),IF(ISNUMBER(${birth}),${code(birth)},IF(MID(${text},5,1)="-",${parsedCode(iso,'yyyy-mm-dd')},${parsedCode(dmy,'dd/mm/yyyy')})),"")`;
};

/**
 * Logo ngang của Đông A (biểu tượng chiến binh + chữ "Đông A edu" gốc, giống thanh đầu trang): Excel không nhúng được phông chữ riêng nên chữ được vẽ sẵn trong ảnh.
 * Tạo lại bằng scripts/build-brand-lockup.cjs; cùng thư mục assets với phông chữ của báo cáo PDF nên chạy được cả khi triển khai.
 */
export const BRAND_LOGO_SIZE = { width: 222, height: 56 };
let logoFile: Buffer | null | undefined;
export function brandLogo(): Buffer | null {
  if (logoFile === undefined) {
    try { logoFile = readFileSync(join(__dirname, '..', '..', 'assets', 'brand', 'dong-a-edu-lockup.png')); } catch { logoFile = null; }
  }
  return logoFile;
}

export interface FormSheetSpec {
  sheetName: string;
  /** Chữ thay cho logo khi không đọc được ảnh logo */
  title: string;
  /** Ảnh logo PNG đặt ở đầu file; bỏ trống thì dùng logo của hệ thống, `null` thì chỉ dùng chữ `title` */
  logo?: Buffer | null;
  subtitle: string;
  /** Các dòng "nhãn: giá trị" dưới tiêu đề, ví dụ Ngày bắt đầu nhập */
  meta: Array<{ label: string; value: string }>;
  note?: string;
  columns: FormColumn[];
  /** Dữ liệu có sẵn (danh sách xuất); không có thì là file mẫu trống với `blankRows` dòng định dạng sẵn */
  rows?: Array<Record<string, unknown>>;
  blankRows?: number;
  /** Khối ví dụ riêng phía trên bảng nhập, không nằm trong dữ liệu được đọc khi import. */
  example?: { values: Record<string, string | number>; explanation: string };
  guide?: string[];
  now?: Date;
}

const LINE = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const BRAND = 'FFB91C1C';
const colLetter = (n: number): string => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };

/**
 * File Excel theo bố cục: "Đông A" (tên), tên trường, ngày (tự cập nhật khi tải), rồi bảng có tiêu đề cố định.
 * Mẫu trống có sẵn ô chọn danh sách cho cột `list`, ô ngày cho cột `date`, số thứ tự tự hiện; cột điện thoại và mã là văn bản để không mất số 0 đầu.
 */
export async function buildFormSheet(spec: FormSheetSpec): Promise<Buffer> {
  const now = spec.now ?? new Date();
  const today = vnDayLabel(now);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hào Khí Đông A';
  workbook.created = now;
  workbook.calcProperties.fullCalcOnLoad = true;
  const baseHeaderRow = 3 + spec.meta.length + (spec.note ? 1 : 0) + 1;
  const headerRow = baseHeaderRow + (spec.example ? 5 : 0);
  const sheet = workbook.addWorksheet(spec.sheetName, { views: [{ state: 'frozen', ySplit: headerRow }] });
  const cols = spec.columns;
  cols.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width ?? 22; });

  const logo = spec.logo === undefined ? brandLogo() : spec.logo;
  if (logo) {
    const image = workbook.addImage({ buffer: logo, extension: 'png' });
    sheet.addImage(image, { tl: { col: 0.05, row: 0.08 }, ext: BRAND_LOGO_SIZE, editAs: 'oneCell' });
    sheet.getRow(1).height = 46;
  } else {
    sheet.getCell('A1').value = spec.title;
    sheet.getCell('A1').font = { name: 'Calibri', size: 22, bold: true, color: { argb: BRAND } };
    sheet.getRow(1).height = 34;
  }
  sheet.getCell('A2').value = spec.subtitle;
  sheet.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: 'FF4B5563' } };
  let r = 3;
  for (const m of spec.meta) {
    const label = sheet.getCell(r, 2), value = sheet.getCell(r, 3);
    label.value = `${m.label}:`;
    label.font = { name: 'Calibri', size: 11, bold: true };
    label.alignment = { horizontal: 'right' };
    value.value = m.value;
    value.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BRAND } };
    value.alignment = { horizontal: 'left' };
    r += 1;
  }
  if (spec.note) {
    sheet.getCell(r, 1).value = spec.note;
    sheet.getCell(r, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    r += 1;
  }
  sheet.getRow(r).height = 8;

  if (spec.example) {
    const start = baseHeaderRow, end = colLetter(cols.length);
    const banner = (n: number, text: string, height: number) => {
      sheet.mergeCells(`A${n}:${end}${n}`);
      const cell = sheet.getCell(n, 1);
      cell.value = text;
      cell.font = { name: 'Calibri', size: 10, bold: n !== start + 3, color: { argb: 'FF92400E' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      sheet.getRow(n).height = height;
    };
    banner(start, 'VÍ DỤ CÁCH ĐIỀN · Chỉ minh họa, không tạo tài khoản', 20);
    cols.forEach((c, i) => {
      const title = sheet.getCell(start + 1, i + 1), cell = sheet.getCell(start + 2, i + 1);
      // Không dùng lại đúng nhãn cột bắt buộc: bộ đọc phải tìm dòng tiêu đề bảng nhập bên dưới.
      title.value = `Ví dụ ${c.header.replace(/\s*\*/g, '')}`;
      title.font = { name: 'Calibri', size: 9, bold: true };
      title.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      title.border = BORDER;
      const raw = spec.example!.values[c.key] ?? '';
      cell.value = c.kind === 'date' && typeof raw === 'string' && parseDate(raw) ? new Date(`${parseDate(raw)}T00:00:00.000Z`) : raw;
      cell.numFmt = c.kind === 'date' ? 'dd/mm/yyyy' : c.kind === 'index' ? '0' : '@';
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8EB' } };
      cell.alignment = { vertical: 'middle', horizontal: c.kind === 'index' || c.kind === 'date' || c.kind === 'list' ? 'center' : 'left' };
      cell.border = BORDER;
    });
    sheet.getRow(start + 1).height = 28;
    sheet.getRow(start + 2).height = 22;
    banner(start + 3, spec.example.explanation, 28);
    banner(start + 4, `DANH SÁCH CỦA BẠN · Nhập giáo viên từ dòng ${headerRow + 1}. STT đã đánh sẵn; mã tự hiện khi điền họ tên và ngày sinh.`, 24);
  }

  // dòng tiêu đề của bảng
  const head = sheet.getRow(headerRow);
  head.height = 26;
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEAD7' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });

  const nameLetter = (key?: string) => { const i = cols.findIndex((c) => c.key === key); return i < 0 ? 'A' : colLetter(i + 1); };
  const dateMin = new Date(Date.UTC(1940, 0, 1));
  const dateMax = new Date(Date.UTC(Number(today.slice(6, 10)), Number(today.slice(3, 5)) - 1, Number(today.slice(0, 2))));
  const data = spec.rows ?? [];
  const total = spec.rows ? data.length : spec.blankRows ?? 200;
  for (let i = 0; i < total; i += 1) {
    const rowNo = headerRow + 1 + i;
    const row = sheet.getRow(rowNo);
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const raw = data[i]?.[c.key];
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: c.kind === 'index' || c.kind === 'list' || c.kind === 'date' ? 'center' : 'left' };
      if (c.kind === 'index') {
        cell.value = i + 1;
        cell.numFmt = '0';
      } else if (c.kind === 'teacher-code') {
        const name = `${nameLetter(c.watch)}${rowNo}`, birth = `${nameLetter(c.birthKey)}${rowNo}`, index = `${nameLetter('stt')}${rowNo}`;
        const prefix = (c.codePrefix ?? 'GV').replace(/[^A-Z0-9]/g, '');
        cell.numFmt = '@';
        cell.value = { formula: teacherCodeFormula(prefix, name, birth, c.codeOffset?`(${index}+${c.codeOffset})`:index), result: '' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.note = 'Tự ghép từ tên trường viết tắt, năm nhập, ngày sinh và số thứ tự. Nhập họ tên và ngày sinh để hiện mã.';
      } else if (c.kind === 'date') {
        cell.numFmt = 'dd/mm/yyyy';
        const iso = typeof raw === 'string' ? parseDate(raw) : null;
        if (iso) cell.value = new Date(`${iso}T00:00:00.000Z`);
        if (!spec.rows) {
          cell.dataValidation = {
            type: 'date', operator: 'between', allowBlank: true, formulae: [dateMin, dateMax],
            showInputMessage: true, promptTitle: c.header.replace(/\*/g, '').trim(), prompt: c.prompt ?? 'Nhập ngày dd/mm/yyyy; chọn trên lịch nếu phần mềm hỗ trợ.',
            showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Ngày không hợp lệ', error: 'Nhập ngày dd/mm/yyyy từ 01/01/1940 đến ngày tải mẫu.',
          };
        }
      } else if (c.kind === 'list') {
        if (raw !== undefined && raw !== null && raw !== '') cell.value = String(raw);
        if (!spec.rows) {
          cell.dataValidation = {
            type: 'list', allowBlank: true, formulae: [`"${(c.options ?? []).join(',')}"`],
            showInputMessage: true, promptTitle: c.header.replace(/\*/g, '').trim(), prompt: c.prompt ?? `Bấm mũi tên để chọn: ${(c.options ?? []).join(' hoặc ')}`,
            showErrorMessage: true, errorStyle: 'stop', errorTitle: c.header.replace(/\*/g, '').trim(), error: `Hãy chọn ${(c.options ?? []).join(' hoặc ')} trong danh sách.`,
          };
        }
      } else {
        cell.numFmt = '@';
        if (raw !== undefined && raw !== null && raw !== '') cell.value = String(raw);
      }
    });
  }
  if (spec.guide?.length) {
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.getColumn(1).width = 110;
    guide.getCell('A1').value = 'Hướng dẫn';
    guide.getCell('A1').font = { size: 16, bold: true, color: { argb: BRAND } };
    spec.guide.forEach((line, i) => { guide.getCell(i + 3, 1).value = line; guide.getCell(i + 3, 1).alignment = { wrapText: true, vertical: 'top' }; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
