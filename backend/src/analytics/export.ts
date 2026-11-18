/**
 * Xuất báo cáo (Sprint 10, HK.GV.071, HK.QT.048): Excel nhiều trang tính và PDF A4 ngang (chữ Manrope có dấu tiếng Việt) từ các bảng đã tính sẵn.
 * Chuỗi do người dùng nhập (tên, nhận xét) được làm sạch để Excel không hiểu nhầm là công thức.
 */
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { BRAND_LOGO_SIZE, brandLogo, vnDayLabel } from '../admin/excel';
import { letterhead } from '../admin/admin-units';
import { officialPdf } from '../admin/pdf';

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');

export interface Col { header: string; key: string; width?: number; right?: boolean }
export interface Section { title: string; cols: Col[]; rows: Array<Record<string, unknown>>; note?: string }

const safe = (v: unknown): string | number => (typeof v === 'number' ? v : /^[=+\-@\t\r]/.test(String(v ?? '')) ? `'${String(v)}` : String(v ?? ''));
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export async function toXlsx(title: string, sections: Section[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hào Khí Đông A';
  wb.title = title;
  for (const sec of sections) {
    const sheet = wb.addWorksheet(sec.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    sheet.columns = sec.cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
    for (const r of sec.rows) sheet.addRow(Object.fromEntries(sec.cols.map((c) => [c.key, safe(r[c.key])])));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (sec.note) { sheet.addRow({}); sheet.addRow({ [sec.cols[0].key]: safe(sec.note) }); }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPdf(title: string, subtitle: string, sections: Section[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: title, Author: 'Hào Khí Đông A' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', join(FONT_DIR, 'Manrope-Regular.ttf'));
    doc.registerFont('bold', join(FONT_DIR, 'Manrope-Bold.ttf'));
    const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right;
    doc.font('bold').fontSize(18).fillColor('#9b1c1c').text(title, left, doc.y);
    doc.font('regular').fontSize(10).fillColor('#444444').text(subtitle);
    for (const sec of sections) {
      doc.font('bold').fontSize(13).fillColor('#111111').text(sec.title, left, doc.y + 10);
      if (sec.note) doc.font('regular').fontSize(9).fillColor('#555555').text(sec.note, { width });
      doc.moveDown(0.3);
      const total = sec.cols.reduce((n, c) => n + (c.width ?? 16), 0);
      const widths = sec.cols.map((c) => ((c.width ?? 16) / total) * width);
      const line = (cells: string[], bold: boolean): void => {
        const y = doc.y;
        doc.font(bold ? 'bold' : 'regular').fontSize(9);
        const h = Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 6 }))) + 6;
        if (y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); line(cells, bold); return; }
        if (bold) doc.rect(left, y, width, h).fill('#efe7d6');
        doc.fillColor('#111111');
        let x = left;
        cells.forEach((t, i) => { doc.font(bold ? 'bold' : 'regular').fontSize(9).text(t, x + 3, y + 3, { width: widths[i] - 6, align: sec.cols[i].right ? 'right' : 'left' }); x += widths[i]; });
        doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor('#d8cfba').lineWidth(0.5).stroke();
        doc.x = left;
        doc.y = y + h;
      };
      line(sec.cols.map((c) => c.header), true);
      if (!sec.rows.length) line(['Không có dữ liệu'].concat(sec.cols.slice(1).map(() => '')), false);
      for (const r of sec.rows) line(sec.cols.map((c) => text(r[c.key])), false);
    }
    doc.end();
  });
}

// ---------------------------------------------------------------------- báo cáo chính thức (yêu cầu 14/11/2026)
/**
 * Báo cáo thống kê trình bày như file xuất của menu Giáo viên, Học sinh và Lớp học: logo Đông A và dòng nhận diện, phần đầu như văn bản của nhà trường
 * (UBND phường/xã, tên trường, mã trường bên trái; quốc hiệu, tiêu ngữ, địa danh và ngày bên phải), tiêu đề in hoa, các dòng "nhãn: giá trị" (Ngày xuất, Khoảng thời gian…),
 * bảng có cột STT, dòng tiêu đề tô màu, kẻ khung, và chỗ ký của người lập báo cáo. Excel: mỗi phần một sheet đủ phần đầu, in vừa khổ A4 ngang, lặp dòng tiêu đề khi sang trang.
 * PDF: phần đầu ở trang 1, các phần đánh số La Mã, dòng tiêu đề bảng lặp lại khi sang trang, chân trang ghi số trang.
 */
export interface ReportSchool { name: string; code: string | null; region: string | null; city?: string | null; address?: string | null }
export interface ReportHead {
  /** Dòng nhận diện dưới logo, ví dụ "Báo cáo thống kê lớp · Trường THCS A · Mã trường 79000001" */
  identity: string;
  /** Trường của báo cáo; `null` là báo cáo toàn hệ thống (quản trị tổng) */
  school: ReportSchool | null;
  title: string;
  subtitle?: string | null;
  meta: Array<{ label: string; value: string }>;
  /** Người lập báo cáo (ký ở cuối) */
  signer?: string | null;
  /** Người duyệt ký bên phải (Hiệu trưởng khi quản trị trường xuất) */
  approver?: string | null;
  now?: Date;
}
/** Cột báo cáo: `pct` là số phần trăm (0–100) hiện kèm dấu %, ô trống hiện "–"; `center` căn giữa */
export interface ReportCol extends Col { pct?: boolean; center?: boolean }
export interface ReportSection { title: string; cols: ReportCol[]; rows: Array<Record<string, unknown>>; note?: string; empty?: string }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const upper = (s: string) => s.toLocaleUpperCase('vi');
const REPORT_RED = 'FFB91C1C';
const RLINE = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
const RBORDER = { top: RLINE, left: RLINE, bottom: RLINE, right: RLINE };

/** Ba dòng bên trái phần đầu: UBND phường/xã, tên trường, mã trường (báo cáo toàn hệ thống: tên hệ thống) */
function leftBlock(school: ReportSchool | null): [string, string, string] {
  if (!school) return ['HỆ THỐNG HỌC TẬP', 'HÀO KHÍ ĐÔNG A', ''];
  const line = /^trường\s/i.test(school.name) ? upper(school.name) : `TRƯỜNG ${upper(school.name)}`;
  const parent = letterhead(school).parent; // UBND phường / xã (chính quyền hai cấp); khu vực cũ quận / huyện thì không ghi
  return parent ? [parent, line, school.code ? `Mã trường: ${school.code}` : ''] : [line, school.code ? `Mã trường: ${school.code}` : '', ''];
}
/** "Phú Mỹ, Thứ Sáu, ngày 14 tháng 11 năm 2026": địa danh là phường / xã của trường bỏ chữ chỉ cấp (khu vực cũ quận / huyện thì là tỉnh / thành) */
function placeLine(school: ReportSchool | null, now: Date): string {
  const day = vnDayLabel(now);
  const place = school ? letterhead(school).place : '……………';
  return `${place}, ${day.slice(12, -1)}, ngày ${day.slice(0, 2)} tháng ${day.slice(3, 5)} năm ${day.slice(6, 10)}`;
}

export async function reportXlsx(head: ReportHead, sections: ReportSection[]): Promise<Buffer> {
  const now = head.now ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hào Khí Đông A';
  wb.created = now;
  wb.title = head.title;
  const logo = brandLogo();
  const logoId = logo ? wb.addImage({ buffer: logo, extension: 'png' }) : null; // một ảnh dùng chung cho mọi sheet
  const used = new Set<string>();
  sections.forEach((sec, si) => {
    let name = sec.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${sec.title.slice(0, 26)} (${n})`;
    used.add(name.toLowerCase());
    const cols: ReportCol[] = [{ header: 'STT', key: '__i', width: 6, center: true }, ...sec.cols];
    const widths = cols.map((c) => c.width ?? 16);
    const total = widths.reduce((a, b) => a + b, 0);
    if (total < 96) widths[widths.length - 1] += 96 - total; // đủ rộng cho phần đầu hai bên
    const n = cols.length, mid = Math.max(2, Math.floor(n / 2)), L = (i: number) => sheetCol(i);
    const metaRows = head.meta.length;
    const headerRow = 11 + metaRows + 2 + (sec.note ? 1 : 0) + 1;
    const sheet = wb.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: headerRow }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: si === 0 ? 1 : 0, // trang tổng hợp in gọn một trang kèm chỗ ký
         printTitlesRow: `${headerRow}:${headerRow}`, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });
    widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
    sheet.headerFooter.oddFooter = `&L&8Báo cáo xuất từ hệ thống Hào Khí Đông A · ${vnDayLabel(now)}&R&8Trang &P/&N`;
    const put = (range: string, value: ExcelJS.CellValue, font: Partial<ExcelJS.Font>, align: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' }) => {
      if (range.includes(':')) sheet.mergeCells(range);
      const cell = sheet.getCell(range.split(':')[0]);
      cell.value = value;
      cell.font = font;
      cell.alignment = align;
      return cell;
    };
    const tnr = (size: number, extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: 'Times New Roman', size, ...extra });
    // logo và dòng nhận diện (giống file xuất Giáo viên / Học sinh)
    if (logoId !== null) { sheet.addImage(logoId, { tl: { col: 0.05, row: 0.08 }, ext: BRAND_LOGO_SIZE, editAs: 'oneCell' }); sheet.getRow(1).height = 46; }
    else put('A1', 'Đông A', { name: 'Calibri', size: 22, bold: true, color: { argb: REPORT_RED } }, { horizontal: 'left' });
    put(`A2:${L(n)}2`, head.identity, { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } }, { horizontal: 'left', vertical: 'middle' });
    sheet.getRow(3).height = 6;
    // phần đầu như văn bản của nhà trường (giống file danh sách lớp)
    const left = leftBlock(head.school);
    put(`A4:${L(mid)}4`, left[0], tnr(11, { bold: true }));
    put(`${L(mid + 1)}4:${L(n)}4`, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', tnr(11, { bold: true }));
    put(`A5:${L(mid)}5`, left[1], tnr(11, { bold: !!head.school?.region || !head.school, underline: !!head.school?.region || !head.school }));
    put(`${L(mid + 1)}5:${L(n)}5`, 'Độc lập - Tự do - Hạnh phúc', tnr(11, { bold: true, underline: true }));
    put(`A6:${L(mid)}6`, left[2], tnr(10, { color: { argb: 'FF4B5563' } }));
    put(`${L(mid + 1)}6:${L(n)}6`, placeLine(head.school, now), tnr(11, { italic: true }), { horizontal: 'center', vertical: 'middle', shrinkToFit: true });
    sheet.getRow(7).height = 8;
    put(`A8:${L(n)}8`, upper(head.title), tnr(15, { bold: true }), { horizontal: 'center', vertical: 'middle', wrapText: true });
    sheet.getRow(8).height = 24;
    if (head.subtitle) put(`A9:${L(n)}9`, head.subtitle, tnr(12, { bold: true }), { horizontal: 'center', vertical: 'middle', wrapText: true });
    sheet.getRow(10).height = 8;
    // các dòng "nhãn: giá trị" như file xuất Giáo viên / Học sinh
    head.meta.forEach((m, i) => {
      const r = 11 + i;
      put(`A${r}:${L(Math.max(2, mid - 1))}${r}`, `${m.label}:`, { name: 'Calibri', size: 11, bold: true }, { horizontal: 'right', vertical: 'middle' });
      put(`${L(Math.max(3, mid))}${r}:${L(n)}${r}`, safe(m.value), { name: 'Calibri', size: 11, bold: true, color: { argb: REPORT_RED } }, { horizontal: 'left', vertical: 'middle' });
    });
    let r = 11 + metaRows;
    sheet.getRow(r).height = 8;
    r += 1;
    put(`A${r}:${L(n)}${r}`, `${ROMAN[si] ?? si + 1}. ${upper(sec.title)}`, tnr(12, { bold: true, color: { argb: REPORT_RED } }), { horizontal: 'left', vertical: 'middle' });
    sheet.getRow(r).height = 22;
    r += 1;
    if (sec.note) { put(`A${r}:${L(n)}${r}`, sec.note, { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF92400E' } }, { horizontal: 'left', vertical: 'middle', wrapText: true }); sheet.getRow(r).height = 30; r += 1; }
    // bảng: dòng tiêu đề tô màu, kẻ khung, STT đánh sẵn
    const hr = sheet.getRow(headerRow);
    hr.height = 30;
    cols.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.header;
      cell.font = tnr(11, { bold: true });
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEAD7' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = RBORDER;
    });
    if (!sec.rows.length) {
      put(`A${headerRow + 1}:${L(n)}${headerRow + 1}`, sec.empty ?? 'Không có dữ liệu trong khoảng thời gian này.', tnr(11, { italic: true, color: { argb: 'FF6B7280' } }));
      for (let i = 1; i <= n; i += 1) sheet.getCell(headerRow + 1, i).border = RBORDER;
    }
    sec.rows.forEach((row, ri) => {
      const xr = sheet.getRow(headerRow + 1 + ri);
      cols.forEach((c, ci) => {
        const cell = xr.getCell(ci + 1);
        const raw = c.key === '__i' ? ri + 1 : row[c.key];
        cell.border = RBORDER;
        cell.font = tnr(11);
        if (c.pct) {
          if (typeof raw === 'number') { cell.value = raw; cell.numFmt = '0"%"'; } else cell.value = '–';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.value = raw === null || raw === undefined ? '' : safe(raw);
          cell.alignment = { horizontal: c.center || c.key === '__i' ? 'center' : c.right ? 'right' : 'left', vertical: 'middle', wrapText: true };
        }
      });
    });
    // chỗ ký ở cuối sheet đầu tiên (trang tổng hợp in ra để ký)
    if (si === 0 && head.signer) {
      const at = headerRow + Math.max(1, sec.rows.length) + 2;
      put(`${L(mid + 1)}${at}:${L(n)}${at}`, 'NGƯỜI LẬP BÁO CÁO', tnr(12, { bold: true }));
      put(`${L(mid + 1)}${at + 1}:${L(n)}${at + 1}`, '(Ký và ghi rõ họ tên)', tnr(11, { italic: true }));
      sheet.getRow(at + 2).height = 44;
      put(`${L(mid + 1)}${at + 3}:${L(n)}${at + 3}`, head.signer, tnr(12, { bold: true }));
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * PDF của báo cáo thống kê (14/11/2026): cùng thể thức văn bản với danh sách giáo viên, học sinh, lớp (`officialPdf` trong admin/pdf.ts) — phần đầu nhà trường và Quốc hiệu,
 * tên báo cáo, các dòng thông tin (khoảng thời gian, giáo viên phụ trách…), từng phần đánh số La Mã với bảng kẻ khung, chỗ ký Người lập báo cáo (và Hiệu trưởng khi quản trị trường xuất).
 */
export function reportPdf(head: ReportHead, sections: ReportSection[]): Promise<Buffer> {
  return officialPdf({
    title: head.title, now: head.now, footer: head.school?.code ? `Mã trường ${head.school.code}` : undefined,
    parts: [{
      school: head.school, title: head.title, subtitle: head.subtitle ?? null,
      facts: head.meta.filter((m) => m.label !== 'Ngày xuất'),
      tables: sections.map((sec, i) => ({
        heading: `${ROMAN[i] ?? i + 1}. ${upper(sec.title)}`, note: sec.note, rows: sec.rows, empty: sec.empty ?? 'Không có dữ liệu trong khoảng thời gian này.',
        cols: sec.cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, pct: c.pct, align: c.pct || c.center ? 'center' as const : c.right ? 'right' as const : 'left' as const })),
      })),
      signers: [{ title: 'Người lập báo cáo', name: head.signer ?? null }, ...(head.approver ? [{ title: head.approver, hint: '(Ký tên, đóng dấu)' }] : [])],
    }],
  });
}

/** Tên cột Excel (1 → A, 27 → AA) */
function sheetCol(n: number): string { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; }
