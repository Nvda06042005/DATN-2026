/** Đọc và ghi file Excel (.xlsx) cho nhập/xuất danh sách giáo viên, học sinh, phân lớp và kho dữ liệu lịch sử (ExcelJS). */
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
export interface Column { key: string; header: string; width?: number; required?: boolean }

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

/** Đọc sheet đầu tiên: dòng 1 là tiêu đề (đủ các cột bắt buộc), mỗi dòng sau thành một đối tượng theo khóa cột; bỏ qua dòng trống */
export async function readSheet(file: UploadedXlsx, columns: Column[], sheetName?: string): Promise<Array<{ row: number; values: Record<string, string> }>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Không đọc được file Excel. Hãy dùng đúng file mẫu .xlsx.');
  }
  const sheet = (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('File Excel không có sheet nào');
  const headerRow = sheet.getRow(1);
  const byHeader = new Map<string, number>();
  headerRow.eachCell((cell, col) => { byHeader.set(normHeader(cellText(cell.value)), col); });
  const missing = columns.filter((c) => c.required && !byHeader.has(normHeader(c.header)));
  if (missing.length) throw new BadRequestException(`File thiếu cột bắt buộc: ${missing.map((c) => c.header.replace(/\*/g, '')).join(', ')}. Hãy dùng đúng file mẫu.`);
  if (sheet.rowCount - 1 > MAX_ROWS) throw new BadRequestException(`File có quá ${MAX_ROWS} dòng; hãy chia nhỏ`);
  const rows: Array<{ row: number; values: Record<string, string> }> = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const values: Record<string, string> = {};
    let any = false;
    for (const c of columns) {
      const col = byHeader.get(normHeader(c.header));
      const text = col ? cellText(sheet.getRow(r).getCell(col).value) : '';
      values[c.key] = text;
      if (text) any = true;
    }
    if (any) rows.push({ row: r, values });
  }
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
