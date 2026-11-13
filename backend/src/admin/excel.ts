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

export const plainAscii = (text: string) => text.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
/**
 * Mã tham gia theo quy ước (yêu cầu 12/11/2026): DongA + lớp + giáo viên phụ trách (tên đệm và tên, bỏ dấu, viết liền) + HK + học kỳ + năm học,
 * ví dụ "6A5", "Nguyễn Đức Anh", học kỳ 1, "2025-2026" → DongA6A5DucAnhHK12025-2026. Trùng với lớp khác thì thêm -2, -3… (app_free_join_code).
 * Học sinh gõ hoa/thường, có hay không dấu gạch đều được (so khớp dạng chuẩn hóa).
 */
export function joinCodeFor(className: string, teacherName: string, semester: number, yearLabel: string): string {
  const cls = plainAscii(className).replace(/[^A-Za-z0-9]/g, '');
  const words = plainAscii(teacherName).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const teacher = (words.length > 1 ? words.slice(1) : words).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return `DongA${cls}${teacher}HK${semester}${yearLabel.replace(/[^0-9-]/g, '')}`.slice(0, 70);
}

/** Tên gọi trong họ tên: từ cuối, bỏ dấu, chữ đ thành d, viết hoa, chỉ giữ chữ và số. "Nguyễn Hoài An" → "AN" */
export function givenNameUpper(fullName: string): string {
  const last = fullName.trim().split(/\s+/).pop() ?? '';
  return last.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Tên đăng nhập và mật khẩu ban đầu của giáo viên / học sinh theo quy ước (yêu cầu 11/11/2026), cùng cách cấp và gửi thư như quản trị viên trường:
 * tên đăng nhập = GV (giáo viên) hoặc HS (học sinh) + tên gọi (từ cuối của họ tên, bỏ dấu, viết hoa chữ đầu) + 4 số cuối điện thoại + ngày sinh ddmmyyyy,
 * ví dụ GVAnh672010042005. mật khẩu = DongA + GV/HS + tên gọi + ngày sinh ddmmyyyy, ví dụ DongAGVAnh10042005.
 * Chỉ dùng cho lần đăng nhập đầu: tài khoản bị buộc đổi mật khẩu.
 * Trả null khi thiếu SĐT 10 số, ngày sinh hoặc họ tên không có tên gọi: đủ hết mới tạo tài khoản, không còn cách cũ (tên tự sinh, mật khẩu ngẫu nhiên).
 * Tên đăng nhập lưu chữ thường (đăng nhập không phân biệt hoa thường); hiển thị và gửi thư đúng như ví dụ.
 */
export function memberCredentials(role: 'teacher' | 'student', fullName: string, phone: string | null | undefined, birthDate: string | null | undefined): { username: string; password: string } | null {
  const upper = givenNameUpper(fullName);
  const born = birthDate ? parseDate(birthDate) : null;
  const digits = (phone ?? '').trim();
  if (!upper || !born || !/^[0-9]{10}$/.test(digits)) return null;
  const given = upper[0] + upper.slice(1).toLowerCase();
  const prefix = role === 'teacher' ? 'GV' : 'HS';
  const tail = digits.slice(-4);
  const dob = `${born.slice(8, 10)}${born.slice(5, 7)}${born.slice(0, 4)}`;
  return { username: `${prefix}${given}${tail}${dob}`, password: `DongA${prefix}${given}${dob}` };
}

/** Tên đăng nhập để hiển thị/gửi thư: dạng quy ước (hoa thường như ví dụ) cộng phần số thêm vào khi trùng; không theo quy ước thì đúng tên đã lưu */
export const shownUsername = (stored: string, conventional: string | null | undefined): string =>
  conventional && stored.startsWith(conventional.toLowerCase()) ? conventional + stored.slice(conventional.length) : stored;

/** Số ngày của Excel hệ 1900 (ví dụ 31121 = 15/03/1985) thành YYYY-MM-DD; số không hợp lệ giữ nguyên dạng chữ để báo lỗi */
export const excelSerialDate = (serial: number): string =>
  Number.isFinite(serial) && serial >= 1 && serial < 2958466 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10) : String(serial);

/** Ngày (UTC) thành số ngày của Excel hệ 1900 */
export const excelSerial = (date: Date): number => Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);

/**
 * Kiểm tra ô ngày sinh (dạng chữ) trong mẫu: nhận ngày dạng số của Excel trong khoảng [min, max] (ví dụ do tiện ích lịch ghi), hoặc chữ dd/mm/yyyy là ngày có thật
 * trong khoảng. Chữ được ghép thành yyyy-mm-dd rồi để Excel đổi thành ngày: dạng ISO được hiểu ở mọi cài đặt vùng, ngày không có thật (30/02, tháng 13) báo lỗi.
 * Không dùng DATEVALUE hay TEXT để không phụ thuộc cài đặt vùng của Windows. Công thức kiểm tra dữ liệu của Excel tối đa 255 ký tự.
 */
export const birthDateRule = (a: string, min: number, max: number): string => {
  const iso = `--(RIGHT(${a},4)&"-"&MID(${a},4,2)&"-"&LEFT(${a},2))`;
  return `OR(MEDIAN(${min},${a},${max})=${a},IFERROR(AND(LEN(${a})=10,MID(${a},3,1)&MID(${a},6,1)="//",MEDIAN(${min},${iso},${max})=${iso}),FALSE))`;
};

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

export function checkUpload(file: UploadedXlsx | undefined,allowMacro=false): UploadedXlsx {
  if (!file) throw new BadRequestException('Hãy chọn file Excel (.xlsx)');
  if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeException('File quá lớn (tối đa 2 MB)');
  if (!(allowMacro?/\.xls[mx]$/i:/\.xlsx$/i).test(file.originalname) || !(ACCEPTED_MIMES.includes(file.mimetype)||(allowMacro&&file.mimetype==='application/vnd.ms-excel.sheet.macroEnabled.12')) || file.buffer.subarray(0, 2).toString('latin1') !== 'PK') {
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
export async function readSheet(file: UploadedXlsx, columns: Column[], sheetName?: string, teacherCodes = false, inspect?: (sheet: ExcelJS.Worksheet) => void): Promise<Array<{ row: number; values: Record<string, string> }>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Không đọc được file Excel. Hãy dùng đúng file mẫu .xlsx.');
  }
  const sheet = (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('File Excel không có sheet nào');
  inspect?.(sheet);
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
  const requireEmail=columns.find(c=>c.key==='email')?.required===true;
  let teacherIndex = 0, completedTeacherIndex = 0;
  for (let r = header.row + 1; r <= Math.min(sheet.rowCount, header.row + MAX_SCAN_ROWS); r += 1) {
    const values: Record<string, string> = {};
    let any = false;
    for (const c of cols) {
      const raw = c.col ? sheet.getRow(r).getCell(c.col).value : null;
      // ô ngày sinh định dạng chữ có thể chứa ngày dạng số của Excel (ví dụ do tiện ích lịch ghi vào): đổi số ngày thành YYYY-MM-DD
      const text = c.key === 'birth_date' && typeof raw === 'number' ? excelSerialDate(raw) : cellText(raw);
      values[c.key] = text;
      if (text) any = true;
    }
    if (teacherCodes && values.full_name) {
      teacherIndex += 1;
      if((!requireEmail||values.email) && values.birth_date) completedTeacherIndex+=1;
      const codeCol = cols.find(c => c.key === 'user_code')?.col;
      const nameCol = cols.find(c => c.key === 'full_name')?.col;
      const birthCol = cols.find(c => c.key === 'birth_date')?.col;
      const indexCol = header.byHeader.get(normHeader('Số thứ tự'));
      const cell = codeCol ? sheet.getCell(r, codeCol) : null;
      // Excel lưu công thức điền xuống nhiều dòng dạng "công thức dùng chung": ô con chỉ trỏ về ô gốc, còn ExcelJS tự dịch công thức gốc sang dòng của ô con
      // và dịch luôn chữ "GOT26" trong dấu nháy như một địa chỉ ô (thành GOT28). Vì vậy đọc công thức và số dòng từ ô gốc.
      const shared = (cell?.value as { sharedFormula?: string } | null | undefined)?.sharedFormula;
      const formulaCell = shared ? sheet.getCell(shared) : cell;
      const formula = formulaCell?.formula;
      const formulaRow = formulaCell ? Number(formulaCell.row) : r;
      const prefix = formula?.match(/,"([A-Z0-9]+)"&TEXT\(/)?.[1];
      // Chỉ tính đúng công thức do mẫu tạo; không chạy/eval công thức tùy ý từ file tải lên.
      const offset = Number(formula?.match(/TEXT\(\([A-Z]+\d+\+(\d{1,9})\),"000"\)/)?.[1]??0);
      const indexRef=indexCol?`${colLetter(indexCol)}${formulaRow}`:'';
      const formulaArgs = nameCol && birthCol && indexCol ? [`${colLetter(nameCol)}${formulaRow}`, `${colLetter(birthCol)}${formulaRow}`, offset?`(${indexRef}+${offset})`:indexRef] as const : null;
      if (prefix && formulaArgs && indexCol && (formula === teacherCodeFormula(prefix, ...formulaArgs) || formula === teacherCodeFormula(prefix, ...formulaArgs, false) || formula === legacyTeacherCodeFormula(prefix, ...formulaArgs))) {
        const born = parseDate(values.birth_date);
        const indexCell = sheet.getCell(r, indexCol);
        const storedIndex = Number(cellText(indexCell.value));
        const emailCol=cols.find(c=>c.key==='email')?.col;
        const readyFormula=emailCol&&nameCol&&birthCol?completedIndexFormula(`${colLetter(nameCol)}${r}`,`${colLetter(emailCol)}${r}`,`${colLetter(birthCol)}${r}`,header.row+1,!requireEmail):null;
        const conditional=indexCell.formula===readyFormula;
        if(conditional && ((requireEmail&&!values.email) || !values.birth_date)){values.user_code='';if(any) rows.push({row:r,values});continue;}
        // Mẫu mới tính theo dòng đã hoàn tất; vẫn đọc STT đánh sẵn và công thức mẫu cũ.
        const serial = conditional?completedTeacherIndex:indexCell.formula && !storedIndex ? teacherIndex : storedIndex;
        if (!Number.isInteger(serial) || serial < 1 || serial > MAX_ROWS) throw new BadRequestException(`Số thứ tự ở dòng ${r} phải là số nguyên từ 1 đến ${MAX_ROWS}.`);
        values.user_code = born ? `${prefix}${born.slice(8,10)}${born.slice(5,7)}${born.slice(0,4)}${String(serial+offset).padStart(3,'0')}` : '';
      }
    }
    if (any) rows.push({ row: r, values });
  }
  if (rows.length > MAX_ROWS) throw new BadRequestException(`File có quá ${MAX_ROWS} dòng; hãy chia nhỏ`);
  return rows;
}

/** Các sheet của file tải lên: tên, trạng thái hiện/ẩn và dòng A2 (dòng nhận diện của file mẫu) */
export async function workbookSheets(file: UploadedXlsx): Promise<Array<{ name: string; state: string; a2: string }>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Không đọc được file Excel. Hãy dùng đúng file mẫu .xlsx.');
  }
  return workbook.worksheets.map((w) => ({ name: w.name, state: w.state ?? 'visible', a2: cellText(w.getCell('A2').value) }));
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
 * Cột của file mẫu/danh sách. `index`: số thứ tự đánh sẵn theo dòng; `autoIndex`: số thứ tự là công thức, trống cho đến khi dòng có họ tên (cột `watch`) rồi tự hiện khi người dùng
 * nhập xong và nhấn Enter (mẫu học sinh); `text`/`phone`: ô văn bản (giữ số 0 đầu);
 * `list`: chọn trong danh sách `options`; `date`: ô ngày dd/mm/yyyy chỉ nhận ngày hợp lệ, kèm gợi ý chọn ngày.
 */
export interface FormColumn extends Column { kind: 'index' | 'text' | 'phone' | 'list' | 'date' | 'teacher-code'; options?: string[]; watch?: string; prompt?: string; codePrefix?: string; codeOffset?:number; birthKey?: string; autoIndex?: boolean }

/** Tên riêng của trường, không gồm tiền tố cấp học; dùng chữ Latin viết hoa. */
export function schoolInitials(name: string): string {
  const plain = normHeader(name).replace(/^(truong\s+)?(trung hoc co so|trung hoc pho thong|tieu hoc|thcs|thpt|th)(\s+|$)/, '');
  return plain.split(/\s+/).filter(Boolean).map(word => word[0]).join('').toUpperCase().slice(0, 12) || 'GV';
}

/**
 * Tiền tố mã học sinh: `HS` + viết tắt tên riêng của trường + hai số cuối của năm (giờ Việt Nam), ví dụ HSGOT26. Có thêm HS ở đầu nên mã học sinh không bao giờ trùng mã giáo viên.
 * Giáo viên dùng bộ sinh mã riêng trong cơ sở dữ liệu (xem docs/MA_GIAO_VIEN.md), không dùng hàm này.
 */
export const studentCodePrefix = (school: string | null | undefined, now: Date = new Date()): string => `HS${schoolInitials(school ?? '')}${vnDayLabel(now).slice(8, 10)}`;
/** Mã đầy đủ: tiền tố + ngày sinh ddmmyyyy + số thứ tự tối thiểu 3 chữ số, ví dụ HSGOT2602042013001 */
export const memberCode = (prefix: string, birthIso: string, serial: number): string => `${prefix}${birthIso.slice(8, 10)}${birthIso.slice(5, 7)}${birthIso.slice(0, 4)}${String(serial).padStart(3, '0')}`;

export function teacherTemplateFilename(name:string):string {
  const school=normHeader(name).replace(/^(truong\s+)?(trung hoc co so|trung hoc pho thong|tieu hoc|thcs|thpt|th)(\s+|$)/,'').replace(/\s+/g,'-');
  return `file_mau_giao-vien_truong_${school||'chua-dat-ten'}.xlsx`;
}

export const studentTemplateFilename=(name:string):string=>teacherTemplateFilename(name).replace("file_mau_giao-vien_","file_mau_hoc-sinh_");
/** File mẫu xếp lớp theo trường và năm học, ví dụ file_mau_xep-lop_truong_giong-ong-to_2026-2027.xlsx */
export const classTemplateFilename=(name:string,yearLabel:string):string=>teacherTemplateFilename(name).replace("file_mau_giao-vien_","file_mau_xep-lop_").replace(/\.xlsx$/,`_${yearLabel.replace(/[^0-9-]/g,'')}.xlsx`);

const completedIndexFormula=(name:string,email:string,birth:string,first:number,optionalEmail=false):string=>{
  const col=(ref:string)=>ref.replace(/\d+$/,'');
  if(optionalEmail) return `IF(AND(${name}<>"",${birth}<>""),COUNTIFS($${col(name)}$${first}:${name},"?*",$${col(birth)}$${first}:${birth},"<>"),"")`;
  return `IF(AND(${name}<>"",${email}<>"",${birth}<>""),COUNTIFS($${col(name)}$${first}:${name},"?*",$${col(email)}$${first}:${email},"?*",$${col(birth)}$${first}:${birth},"<>"),"")`;
};

const legacyTeacherCodeFormula = (prefix: string, name: string, birth: string, index: string): string =>
  `IF(AND(${name}<>"",ISNUMBER(${birth})),"${prefix}"&TEXT(${birth},"ddmmyyyy")&TEXT(${index},"000"),"")`;

/** Excel/WPS có thể giữ ngày được dán vào dưới dạng chữ. Đọc theo đúng định dạng, không phụ thuộc locale của DATEVALUE. */
const teacherCodeFormula = (prefix: string, name: string, birth: string, index: string, requireIndex=true): string => {
  const text = `TRIM(${birth})`;
  const code = (date: string) => `"${prefix}"&TEXT(${date},"ddmmyyyy")&TEXT(${index},"000")`;
  const iso = `DATE(VALUE(LEFT(${text},4)),VALUE(MID(${text},6,2)),VALUE(RIGHT(${text},2)))`;
  const dmy = `DATE(VALUE(RIGHT(${text},4)),VALUE(MID(${text},4,2)),VALUE(LEFT(${text},2)))`;
  const parsedCode = (date: string, format: string) => `IFERROR(IF(TEXT(${date},"${format}")=${text},${code(date)},""),"")`;
  const ready=requireIndex?`,${index.match(/[A-Z]+\d+/)?.[0]??index}<>""`:'';
  return `IF(AND(${name}<>"",${birth}<>""${ready}),IF(ISNUMBER(${birth}),${code(birth)},IF(MID(${text},5,1)="-",${parsedCode(iso,'yyyy-mm-dd')},${parsedCode(dmy,'dd\\/mm\\/yyyy')})),"")`;
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
  entryNote?:string;
  /** STT chỉ hiện khi đủ các ô bắt buộc của dòng nhập. */
  completedIndex?:boolean;
  optionalIndexEmail?:boolean;
  columns: FormColumn[];
  /** Dữ liệu có sẵn (danh sách xuất); không có thì là file mẫu trống với `blankRows` dòng định dạng sẵn */
  rows?: Array<Record<string, unknown>>;
  blankRows?: number;
  /** Khối ví dụ riêng phía trên bảng nhập, không nằm trong dữ liệu được đọc khi import. `title` thay dòng đầu của khối (mặc định nói rõ không tạo tài khoản). */
  example?: { values: Record<string, string | number>; explanation: string; title?: string };
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
    banner(start, spec.example.title ?? 'VÍ DỤ CÁCH ĐIỀN · Chỉ minh họa, không tạo tài khoản', 20);
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
    banner(start + 4, spec.entryNote??'DANH SÁCH CỦA BẠN', 24);
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
        const watched = nameLetter(c.watch);
        cell.value = !spec.rows && spec.completedIndex ? {formula:completedIndexFormula(`${nameLetter('full_name')}${rowNo}`,`${nameLetter('email')}${rowNo}`,`${nameLetter('birth_date')}${rowNo}`,headerRow+1,spec.optionalIndexEmail),result:''}
          // autoIndex: đếm các dòng đã có họ tên, kể cả khi có dòng trống ở giữa; danh sách xuất luôn đánh số sẵn
          : !spec.rows && c.autoIndex ? { formula: `IF(${watched}${rowNo}="","",COUNTIFS($${watched}$${headerRow + 1}:${watched}${rowNo},"?*"))`, result: '' } : i + 1;
        cell.numFmt = '0';
      } else if (c.kind === 'teacher-code') {
        const name = `${nameLetter(c.watch)}${rowNo}`, birth = `${nameLetter(c.birthKey)}${rowNo}`, index = `${nameLetter('stt')}${rowNo}`;
        const prefix = (c.codePrefix ?? 'GV').replace(/[^A-Z0-9]/g, '');
        cell.numFmt = '@';
        cell.value = { formula: teacherCodeFormula(prefix, name, birth, c.codeOffset?`(${index}+${c.codeOffset})`:index), result: '' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.note = 'Tự ghép từ tên trường viết tắt, năm nhập, ngày sinh và số thứ tự. Nhập họ tên và ngày sinh để hiện mã.';
      } else if (c.kind === 'date') {
        // Mẫu để trống: ô dạng chữ (@) để Excel giữ nguyên ngày gõ dd/mm/yyyy. Ô dạng ngày thì Excel đọc theo cài đặt vùng của Windows: máy kiểu Mỹ
        // (tháng/ngày) báo lỗi với 15/03/2005 và lặng lẽ đổi 05/03/2005 thành ngày 3 tháng 5. Danh sách xuất (có sẵn dữ liệu) vẫn là ô ngày.
        cell.numFmt = spec.rows ? 'dd/mm/yyyy' : '@';
        const iso = typeof raw === 'string' ? parseDate(raw) : null;
        if (iso) cell.value = new Date(`${iso}T00:00:00.000Z`);
        if (!spec.rows) {
          cell.dataValidation = {
            type: 'custom', allowBlank: true, formulae: [birthDateRule(`${nameLetter(c.key)}${rowNo}`, excelSerial(dateMin), excelSerial(dateMax))],
            showInputMessage: true, promptTitle: c.header.replace(/\*/g, '').trim(), prompt: c.prompt ?? 'Gõ ngày/tháng/năm, ví dụ 05/03/1985.',
            showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Ngày không hợp lệ', error: 'Gõ ngày/tháng/năm đủ 2 số ngày, 2 số tháng, 4 số năm, ví dụ 05/03/1985; từ 01/01/1940 đến ngày tải mẫu.',
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
      } else if (c.kind === 'phone') {
        cell.numFmt = '@';
        if (raw !== undefined && raw !== null && raw !== '') cell.value = String(raw);
        // số điện thoại đúng 10 chữ số (ô văn bản nên giữ số 0 đầu); gõ sai độ dài bị chặn ngay trong ô
        if (!spec.rows) {
          cell.dataValidation = {
            type: 'textLength', operator: 'equal', allowBlank: true, formulae: [10],
            showInputMessage: true, promptTitle: 'Số điện thoại', prompt: 'Nhập đúng 10 chữ số, ví dụ 0901234567',
            showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Số điện thoại', error: 'Số điện thoại gồm đúng 10 chữ số.',
          };
        }
      } else {
        cell.numFmt = '@';
        if (raw !== undefined && raw !== null && raw !== '') cell.value = String(raw);
      }
    });
  }
  // Mẫu trống: ô ngày sinh dạng chữ mà chứa ngày dạng số (ví dụ tiện ích lịch ghi vào) vẫn hiện dd/mm/yyyy thay vì số như 38426.
  // Định dạng có điều kiện chỉ áp cho ô chứa số, chữ gõ tay giữ nguyên như đã gõ.
  if (!spec.rows) {
    for (const c of cols.filter((x) => x.kind === 'date')) {
      const letter = nameLetter(c.key), first = headerRow + 1, last = headerRow + total;
      sheet.addConditionalFormatting({ ref: `${letter}${first}:${letter}${last}`, rules: [{ type: 'expression', priority: 1, formulae: [`ISNUMBER(${letter}${first})`], style: { numFmt: 'dd/mm/yyyy' } }] });
    }
  }
  if (spec.guide?.length) {
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.getColumn(1).width = 110;
    guide.getCell('A1').value = 'Hướng dẫn';
    guide.getCell('A1').font = { size: 16, bold: true, color: { argb: BRAND } };
    spec.guide.forEach((line, i) => { guide.getCell(i + 3, 1).value = line; guide.getCell(i + 3, 1).alignment = { wrapText: true, vertical: 'top' }; guide.getRow(i+3).height=Math.ceil(line.length/100)*16+4; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------- danh sách xếp lớp: mỗi lớp một file, trình bày như danh sách lớp của nhà trường
/** Dòng đầu của bảng học sinh trong file xếp lớp (tiêu đề bảng ở dòng ngay trên) */
export const CLASS_LIST_FIRST_ROW = 17;

export interface ClassListSpec {
  /** Dòng A2 dùng để nhận đúng file khi nhập (loại mẫu, năm học, tên và mã trường) */
  identity: string;
  school: string; schoolCode: string; region: string | null;
  yearLabel: string; semester: number;
  /** Giáo viên để chọn ở ô Giáo viên phụ trách, dạng "Mã giáo viên · Họ tên" */
  teachers: string[];
  /** Lớp đang có của năm học, gợi ý ở ô Lớp (vẫn gõ được lớp mới) */
  classes: string[];
  /** Học sinh của trường để chọn ở cột Mã học sinh / Họ và tên; ngày sinh (dd/mm/yyyy) và giới tính (Nam/Nữ) tự điền theo học sinh đã chọn */
  students: Array<{ code: string; name: string; birth: string; gender: string }>;
  guide: string[];
  rows?: number;
  now?: Date;
}

const upperVn = (text: string) => text.toLocaleUpperCase('vi');

/**
 * File danh sách học sinh của một lớp (yêu cầu 12/11/2026, theo mẫu danh sách lớp in của trường THCS Phú Mỹ):
 * logo Đông A và dòng nhận diện file; "UBND <phường> / TRƯỜNG <tên>" bên trái, quốc hiệu và "<địa danh>, ngày … tháng … năm …" bên phải;
 * tiêu đề "DANH SÁCH HỌC SINH LỚP <ô Lớp>" và "NĂM HỌC … · HỌC KỲ <ô Học kỳ>"; ô Lớp (gõ, có gợi ý lớp đã có), Khối (6–9), Học kỳ (1/2), Giáo viên phụ trách (chọn mã · họ tên),
 * Sĩ số và Nam/Nữ tự đếm; bảng STT, MÃ HỌC SINH, HỌ VÀ TÊN, NGÀY SINH, GIỚI TÍNH, LỚP. Mã học sinh chọn trong danh sách học sinh của trường; chọn mã thì họ tên,
 * ngày sinh, giới tính tự hiện (yêu cầu 13/11/2026: chỉ chọn mã, họ tên không còn danh sách chọn); STT, cột LỚP và sĩ số tự cập nhật khi nhấn Enter.
 * Danh sách chọn nằm ở sheet ẩn "Danh mục".
 * Muốn nhiều lớp trong một file: chép sheet (Move or Copy → Create a copy), mỗi sheet một lớp.
 */
function drawClassSheet(workbook: ExcelJS.Workbook, sheetName: string, spec: ClassListSpec, fill?: ClassRosterFill): void {
  const now = spec.now ?? new Date();
  const today = vnDayLabel(now);
  const total = fill ? Math.max(fill.students.length, 1) : spec.rows ?? 60, first = CLASS_LIST_FIRST_ROW, last = first + total - 1, head = first - 1;
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: head }] });
  [6, 25, 27, 15, 12, 17].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  const font = (size: number, extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: 'Times New Roman', size, ...extra });
  const put = (range: string, value: ExcelJS.CellValue, f: Partial<ExcelJS.Font>, align: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' }) => {
    if (range.includes(':')) sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.font = f;
    cell.alignment = align;
    return cell;
  };

  // logo và dòng nhận diện file (giống mẫu giáo viên/học sinh)
  const logo = brandLogo();
  if (logo) {
    sheet.addImage(workbook.addImage({ buffer: logo, extension: 'png' }), { tl: { col: 0.05, row: 0.08 }, ext: BRAND_LOGO_SIZE, editAs: 'oneCell' });
    sheet.getRow(1).height = 46;
  } else put('A1', 'Đông A', { name: 'Calibri', size: 22, bold: true, color: { argb: BRAND } }, { horizontal: 'left' });
  put('A2', spec.identity, { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } }, { horizontal: 'left' });
  sheet.getRow(3).height = 6;

  // phần đầu như văn bản của nhà trường
  const schoolLine = /^trường\s/i.test(spec.school) ? upperVn(spec.school) : `TRƯỜNG ${upperVn(spec.school)}`;
  const left = spec.region ? [`UBND ${upperVn(spec.region)}`, schoolLine] : [schoolLine, ''];
  // địa danh: bỏ chữ Phường/Xã… ở đầu, trừ khi phần còn lại chỉ là số (Quận 2 giữ nguyên, không thành "2, ngày …")
  const stripped = (spec.region ?? '').replace(/^(phường|xã|quận|huyện|thị trấn|thị xã|thành phố)\s+/i, '').trim();
  const place = (/^\d+$/.test(stripped) ? (spec.region ?? '').trim() : stripped) || '……………';
  const [d, m, y] = [today.slice(0, 2), today.slice(3, 5), today.slice(6, 10)];
  const weekday = today.slice(12, -1); // "12/11/2026 (Thứ Năm)" → "Thứ Năm"
  put('A4:C4', left[0], font(11, { bold: true }));
  put('D4:F4', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font(11, { bold: true }));
  put('A5:C5', left[1], font(11, { bold: true, underline: true }));
  put('D5:F5', 'Độc lập - Tự do - Hạnh phúc', font(11, { bold: true, underline: true }));
  put('A6:C6', `Mã trường: ${spec.schoolCode}`, font(10, { color: { argb: 'FF4B5563' } }));
  put('D6:F6', `${place}, ${weekday}, ngày ${d} tháng ${m} năm ${y}`, font(11, { italic: true }), { horizontal: 'center', vertical: 'middle', shrinkToFit: true });
  sheet.getRow(7).height = 8;
  put('A8:F8', fill ? `DANH SÁCH HỌC SINH LỚP ${upperVn(fill.name)}` : { formula: `"DANH SÁCH HỌC SINH LỚP "&IF(TRIM($C$11)="","……",UPPER(TRIM($C$11)))`, result: 'DANH SÁCH HỌC SINH LỚP ……' }, font(15, { bold: true }));
  sheet.getRow(8).height = 24;
  put('A9:F9', fill ? `NĂM HỌC ${spec.yearLabel} · HỌC KỲ ${fill.semester}` : { formula: `"NĂM HỌC ${spec.yearLabel} · HỌC KỲ "&IF($C$12="","…",$C$12)`, result: `NĂM HỌC ${spec.yearLabel} · HỌC KỲ ${spec.semester}` }, font(13, { bold: true }));
  sheet.getRow(10).height = 8;

  // các ô điền ở đầu danh sách
  const label = (ref: string, text: string) => put(ref, text, font(12, { bold: true }), { horizontal: 'right', vertical: 'middle' });
  const input = (ref: string) => {
    const cell = sheet.getCell(ref.split(':')[0]);
    if (ref.includes(':')) sheet.mergeCells(ref);
    cell.font = font(12, { bold: true, color: { argb: BRAND } });
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
    cell.border = BORDER;
    cell.numFmt = '@';
    return cell;
  };

  label('B11', 'Lớp *:');
  const classCell = input('C11');
  if (fill) classCell.value = fill.name;
  else classCell.dataValidation = spec.classes.length
    ? { type: 'list', allowBlank: true, formulae: [`'Danh mục'!$B$1:$B$${spec.classes.length}`], showInputMessage: true, promptTitle: 'Lớp', prompt: 'Gõ tên lớp (ví dụ 6A1) hoặc bấm mũi tên chọn lớp đã có. Lớp chưa có sẽ được tạo khi nhập.', showErrorMessage: false, errorStyle: 'information' }
    : { type: 'textLength', operator: 'lessThanOrEqual', allowBlank: true, formulae: [30], showInputMessage: true, promptTitle: 'Lớp', prompt: 'Gõ tên lớp, ví dụ 6A1. Lớp chưa có sẽ được tạo khi nhập.' };
  label('D11', 'Khối *:');
  const gradeCell = input('E11');
  if (fill) gradeCell.value = fill.grade ? String(fill.grade) : '';
  else gradeCell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"6,7,8,9"'], showInputMessage: true, promptTitle: 'Khối', prompt: 'Bấm mũi tên chọn khối 6, 7, 8 hoặc 9.', showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Khối', error: 'Chọn khối 6, 7, 8 hoặc 9.' };
  label('B12', 'Học kỳ *:');
  const semesterCell = input('C12');
  semesterCell.value = String(fill ? fill.semester : spec.semester);
  if (!fill) semesterCell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"1,2"'], showInputMessage: true, promptTitle: 'Học kỳ', prompt: 'Một năm học có hai học kỳ: chọn 1 hoặc 2.', showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Học kỳ', error: 'Chọn học kỳ 1 hoặc 2.' };
  label('B13', 'Giáo viên phụ trách:');
  const teacherCell = input('C13:F13');
  if (fill) teacherCell.value = fill.teacher ?? 'Chưa phân công';
  else if (spec.teachers.length) {
    teacherCell.dataValidation = { type: 'list', allowBlank: true, formulae: [`'Danh mục'!$A$1:$A$${spec.teachers.length}`], showInputMessage: true, promptTitle: 'Giáo viên phụ trách', prompt: 'Bấm mũi tên chọn giáo viên (mã giáo viên · họ tên); để trống nếu chưa phân công.', showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Giáo viên phụ trách', error: 'Hãy chọn giáo viên trong danh sách.' };
  }
  const filled = `(($B$${first}:$B$${last}<>"")+($C$${first}:$C$${last}<>""))>0`;
  label('B14', 'Sĩ số:');
  const male = fill ? fill.students.filter((x) => x.gender === 'Nam').length : 0, female = fill ? fill.students.filter((x) => x.gender === 'Nữ').length : 0;
  put('C14', fill ? `${fill.students.length} học sinh` : { formula: `SUMPRODUCT(--(${filled}))&" học sinh"`, result: '0 học sinh' }, font(12, { bold: true }), { horizontal: 'left', vertical: 'middle' });
  label('D14', 'Nam / Nữ:');
  put('E14:F14', fill ? `${male} / ${female}` : { formula: `COUNTIF($E$${first}:$E$${last},"Nam")&" / "&COUNTIF($E$${first}:$E$${last},"Nữ")`, result: '0 / 0' }, font(12, { bold: true }), { horizontal: 'left', vertical: 'middle' });
  put('A15:F15', fill ? `Danh sách xuất từ hệ thống Đông A lúc ${vnDayLabel(now)}${fill.joinCode ? ` · Mã tham gia lớp: ${fill.joinCode}` : ''}.`
    : 'Điền đủ 4 ô có dấu * (thiếu một ô là file bị báo lỗi). Mỗi học sinh một dòng: bấm mũi tên chọn mã học sinh, họ và tên, ngày sinh, giới tính tự hiện; nhấn Enter, STT, cột LỚP và sĩ số tự cập nhật.',
    { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF92400E' } }, { horizontal: 'left', vertical: 'middle', wrapText: true });
  sheet.getRow(15).height = 30;

  // bảng học sinh
  const headers = ['STT', 'MÃ HỌC SINH', 'HỌ VÀ TÊN', 'NGÀY SINH', 'GIỚI TÍNH', 'LỚP'];
  sheet.getRow(head).height = 30;
  headers.forEach((text, i) => {
    const cell = sheet.getCell(head, i + 1);
    cell.value = text;
    cell.font = font(12, { bold: true });
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEAD7' } };
    cell.border = BORDER;
  });
  const dateMin = new Date(Date.UTC(1990, 0, 1));
  const dateMax = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  for (let r = first; r <= last; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 6; c += 1) {
      const cell = row.getCell(c);
      cell.border = BORDER;
      cell.font = font(12);
      cell.alignment = { vertical: 'middle', horizontal: c === 2 || c === 3 ? 'left' : 'center', shrinkToFit: c === 2 };
      cell.numFmt = '@';
    }
    if (fill) {
      const st = fill.students[r - first];
      if (st) [r - first + 1, st.code, st.name, st.birth, st.gender, fill.name].forEach((v, k) => { row.getCell(k + 1).value = v; });
      row.getCell(1).numFmt = '0';
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      continue;
    }
    const empty = `AND(B${r}="",C${r}="")`;
    row.getCell(1).value = { formula: `IF(${empty},"",SUMPRODUCT(--((($B$${first}:B${r}<>"")+($C$${first}:C${r}<>""))>0)))`, result: '' };
    row.getCell(1).numFmt = '0';
    const n = spec.students.length;
    if (n) {
      const col = (letter: string) => `'Danh mục'!$${letter}$1:$${letter}$${n}`;
      const byCode = (letter: string) => `IFERROR(INDEX(${col(letter)},MATCH($B${r},${col('C')},0)),"")`;
      const byName = (letter: string) => `IFERROR(INDEX(${col(letter)},MATCH($C${r},${col('D')},0)),"")`;
      row.getCell(2).dataValidation = { type: 'list', allowBlank: true, formulae: [col('C')], showInputMessage: true, promptTitle: 'Mã học sinh', prompt: 'Bấm mũi tên chọn mã học sinh; họ và tên, ngày sinh, giới tính tự hiện.', showErrorMessage: false, errorStyle: 'information' };
      // họ và tên tự hiện theo mã đã chọn (không có danh sách chọn riêng)
      row.getCell(3).value = { formula: `IF($B${r}="","",${byCode('D')})`, result: '' };
      row.getCell(4).value = { formula: `IF($B${r}<>"",${byCode('E')},IF($C${r}<>"",${byName('E')},""))`, result: '' };
      row.getCell(5).value = { formula: `IF($B${r}<>"",${byCode('F')},IF($C${r}<>"",${byName('F')},""))`, result: '' };
    }
    row.getCell(4).dataValidation = {
      type: 'custom', allowBlank: true, formulae: [birthDateRule(`D${r}`, excelSerial(dateMin), excelSerial(dateMax))],
      showInputMessage: true, promptTitle: 'Ngày sinh', prompt: 'Gõ ngày/tháng/năm, ví dụ 01/07/2015.',
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Ngày không hợp lệ', error: 'Gõ ngày/tháng/năm đủ 2 số ngày, 2 số tháng, 4 số năm, ví dụ 01/07/2015.',
    };
    row.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Nam,Nữ"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Giới tính', error: 'Hãy chọn Nam hoặc Nữ.' };
    row.getCell(6).value = { formula: `IF(${empty},"",UPPER(TRIM($C$11)))`, result: '' };
    row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  }
  if (!fill) sheet.addConditionalFormatting({ ref: `D${first}:D${last}`, rules: [{ type: 'expression', priority: 1, formulae: [`ISNUMBER(D${first})`], style: { numFmt: 'dd/mm/yyyy' } }] });
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:F${last}`, horizontalCentered: true, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };

}

/** Một lớp trong file xuất: giá trị có sẵn thay cho ô điền và công thức */
export interface ClassRosterFill {
  name: string; grade: number | null; semester: number; teacher: string | null; joinCode?: string | null;
  students: Array<{ code: string; name: string; birth: string; gender: string }>;
}

export async function buildClassListSheet(spec: ClassListSpec): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hào Khí Đông A';
  workbook.created = spec.now ?? new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  drawClassSheet(workbook, 'Xếp lớp', spec);
  if (spec.guide.length) {
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.getColumn(1).width = 110;
    guide.getCell('A1').value = 'Hướng dẫn';
    guide.getCell('A1').font = { size: 16, bold: true, color: { argb: BRAND } };
    spec.guide.forEach((line, i) => { guide.getCell(i + 3, 1).value = line; guide.getCell(i + 3, 1).alignment = { wrapText: true, vertical: 'top' }; guide.getRow(i + 3).height = Math.ceil(line.length / 100) * 16 + 4; });
  }
  // danh sách chọn ở sheet ẩn cuối cùng (Xếp lớp, Hướng dẫn, Danh mục): A giáo viên, B lớp, C–F học sinh (mã, họ tên, ngày sinh, giới tính)
  const catalog = workbook.addWorksheet('Danh mục', { state: 'hidden' });
  spec.teachers.forEach((t, i) => { catalog.getCell(i + 1, 1).value = t; });
  spec.classes.forEach((c, i) => { catalog.getCell(i + 1, 2).value = c; });
  spec.students.forEach((st, i) => { [st.code, st.name, st.birth, st.gender].forEach((v, k) => { const cell = catalog.getCell(i + 1, 3 + k); cell.value = v; cell.numFmt = '@'; }); });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Xuất danh sách lớp (yêu cầu 13/11/2026): cùng bố cục với file mẫu xếp lớp, mỗi lớp một sheet ghi sẵn lớp, khối, học kỳ, giáo viên phụ trách,
 * sĩ số, Nam/Nữ, mã tham gia và danh sách học sinh. Xuất cả năm học thì có thêm sheet "Danh sách lớp" tổng hợp ở đầu.
 * Dòng A2 ghi "Danh sách lớp năm học …" (không phải dòng nhận diện file mẫu) nên file xuất không bị nhầm là file mẫu khi nhập.
 */
export async function buildClassRosterBook(spec: Omit<ClassListSpec, 'teachers' | 'classes' | 'students' | 'guide' | 'rows'>, classes: ClassRosterFill[], summary: boolean): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hào Khí Đông A';
  workbook.created = spec.now ?? new Date();
  const base: ClassListSpec = { ...spec, teachers: [], classes: [], students: [], guide: [] };
  if (summary) {
    const sheet = workbook.addWorksheet('Danh sách lớp', { views: [{ state: 'frozen', ySplit: 5 }] });
    [6, 12, 8, 34, 9, 7, 7, 30].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
    const logo = brandLogo();
    if (logo) { sheet.addImage(workbook.addImage({ buffer: logo, extension: 'png' }), { tl: { col: 0.05, row: 0.08 }, ext: BRAND_LOGO_SIZE, editAs: 'oneCell' }); sheet.getRow(1).height = 46; }
    else { sheet.getCell('A1').value = 'Đông A'; sheet.getCell('A1').font = { name: 'Calibri', size: 22, bold: true, color: { argb: BRAND } }; }
    sheet.getCell('A2').value = spec.identity;
    sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
    sheet.mergeCells('A3:H3');
    sheet.getCell('A3').value = `DANH SÁCH LỚP NĂM HỌC ${spec.yearLabel} · ${upperVn(spec.school)}`;
    sheet.getCell('A3').font = { name: 'Times New Roman', size: 15, bold: true };
    sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 26;
    sheet.mergeCells('A4:H4');
    sheet.getCell('A4').value = `Xuất lúc ${vnDayLabel(spec.now ?? new Date())} · ${classes.length} lớp · ${classes.reduce((n, c) => n + c.students.length, 0)} học sinh. Mỗi lớp xem chi tiết ở sheet cùng tên.`;
    sheet.getCell('A4').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF92400E' } };
    const headers = ['STT', 'LỚP', 'KHỐI', 'GIÁO VIÊN PHỤ TRÁCH', 'HỌC KỲ', 'SĨ SỐ', 'NAM', 'MÃ THAM GIA'];
    headers.forEach((text, i) => {
      const cell = sheet.getCell(5, i + 1);
      cell.value = text;
      cell.font = { name: 'Times New Roman', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEAD7' } };
      cell.border = BORDER;
    });
    sheet.getRow(5).height = 26;
    classes.forEach((c, i) => {
      const row = sheet.getRow(6 + i);
      [i + 1, c.name, c.grade ?? '', c.teacher ?? 'Chưa phân công', c.semester, c.students.length, c.students.filter((x) => x.gender === 'Nam').length, c.joinCode ?? ''].forEach((v, k) => {
        const cell = row.getCell(k + 1);
        cell.value = v;
        cell.border = BORDER;
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: k === 3 || k === 7 ? 'left' : 'center' };
      });
    });
  }
  const used = new Set<string>();
  for (const c of classes) {
    // tên sheet: tên lớp, bỏ ký tự Excel không cho phép, tối đa 31 ký tự, không trùng
    let name = c.name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Lớp';
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${c.name.slice(0, 27)} (${n})`;
    used.add(name.toLowerCase());
    drawClassSheet(workbook, name, base, c);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
