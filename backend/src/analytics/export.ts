/**
 * Xuất báo cáo (Sprint 10, HK.GV.071, HK.QT.048): Excel nhiều trang tính và PDF A4 ngang (chữ Manrope có dấu tiếng Việt) từ các bảng đã tính sẵn.
 * Chuỗi do người dùng nhập (tên, nhận xét) được làm sạch để Excel không hiểu nhầm là công thức.
 */
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { BRAND_LOGO_SIZE, brandLogo, vnDayLabel } from '../admin/excel';

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
export interface ReportSchool { name: string; code: string | null; region: string | null }
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
  return school.region ? [`UBND ${upper(school.region)}`, line, school.code ? `Mã trường: ${school.code}` : ''] : [line, school.code ? `Mã trường: ${school.code}` : '', ''];
}
/** "Phú Mỹ, Thứ Sáu, ngày 14 tháng 11 năm 2026": địa danh bỏ chữ Phường/Xã… ở đầu (trừ khi chỉ còn số như Quận 2) */
function placeLine(school: ReportSchool | null, now: Date): string {
  const day = vnDayLabel(now);
  const region = (school?.region ?? '').trim();
  const stripped = region.replace(/^(phường|xã|quận|huyện|thị trấn|thị xã|thành phố)\s+/i, '').trim();
  const place = (/^\d+$/.test(stripped) ? region : stripped) || '……………';
  return `${place}, ${day.slice(12, -1)}, ngày ${day.slice(0, 2)} tháng ${day.slice(3, 5)} năm ${day.slice(6, 10)}`;
}
/** Giá trị một ô của bảng báo cáo dạng chữ (PDF) */
const cellText = (col: ReportCol, v: unknown): string => (v === null || v === undefined || v === '' ? (col.pct ? '–' : '') : col.pct && typeof v === 'number' ? `${v}%` : String(v));

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

export function reportPdf(head: ReportHead, sections: ReportSection[]): Promise<Buffer> {
  const now = head.now ?? new Date();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: head.title, Author: 'Hào Khí Đông A' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', join(FONT_DIR, 'Manrope-Regular.ttf'));
    doc.registerFont('bold', join(FONT_DIR, 'Manrope-Bold.ttf'));
    const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right, half = width / 2;
    const bottom = () => doc.page.height - doc.page.margins.bottom - 14; // chừa chân trang
    // logo và dòng nhận diện
    const logo = brandLogo();
    let y = doc.page.margins.top;
    if (logo) { doc.image(logo, left, y, { height: 34 }); y += 38; }
    else { doc.font('bold').fontSize(18).fillColor('#b91c1c').text('Đông A', left, y); y = doc.y + 2; }
    doc.font('regular').fontSize(8.5).fillColor('#6b7280').text(head.identity, left, y, { width });
    y = doc.y + 8;
    // phần đầu như văn bản của nhà trường
    const lb = leftBlock(head.school);
    const pair = (l: string, r: string, opts: { lb?: boolean; rb?: boolean; lu?: boolean; ru?: boolean; li?: boolean; ri?: boolean; size?: number }) => {
      const size = opts.size ?? 10;
      doc.font(opts.lb ? 'bold' : 'regular').fontSize(size).fillColor(opts.li ? '#4b5563' : '#111111').text(l, left, y, { width: half, align: 'center', underline: !!opts.lu && !!l });
      const h1 = doc.y - y;
      doc.font(opts.rb ? 'bold' : 'regular').fontSize(size).fillColor('#111111').text(r, left + half, y, { width: half, align: 'center', underline: !!opts.ru, oblique: opts.ri ? 12 : false });
      y += Math.max(h1, doc.y - y) + 1;
    };
    pair(lb[0], 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { lb: true, rb: true });
    pair(lb[1], 'Độc lập - Tự do - Hạnh phúc', { lb: !!head.school?.region || !head.school, rb: true, lu: !!head.school?.region || !head.school, ru: true });
    pair(lb[2], placeLine(head.school, now), { li: true, ri: true, size: 9.5 });
    y += 10;
    doc.font('bold').fontSize(16).fillColor('#111111').text(upper(head.title), left, y, { width, align: 'center' });
    y = doc.y + 2;
    if (head.subtitle) { doc.font('bold').fontSize(10.5).fillColor('#374151').text(head.subtitle, left, y, { width, align: 'center' }); y = doc.y; }
    y += 8;
    // các dòng "nhãn: giá trị"
    for (const m of head.meta) {
      doc.font('bold').fontSize(9.5).fillColor('#111111').text(`${m.label}:`, left, y, { width: 150, align: 'right' });
      doc.font('bold').fontSize(9.5).fillColor('#b91c1c').text(m.value, left + 158, y, { width: width - 158 });
      y = doc.y + 2;
    }
    doc.y = y + 4;
    sections.forEach((sec, si) => {
      const cols: ReportCol[] = [{ header: 'STT', key: '__i', width: 5, center: true }, ...sec.cols];
      const total = cols.reduce((n, c) => n + (c.width ?? 16), 0);
      const widths = cols.map((c) => ((c.width ?? 16) / total) * width);
      if (doc.y + 100 > bottom()) doc.addPage(); // tiêu đề phần đi cùng dòng tiêu đề bảng và ít nhất hai dòng
      doc.font('bold').fontSize(11.5).fillColor('#b91c1c').text(`${ROMAN[si] ?? si + 1}. ${upper(sec.title)}`, left, doc.y + 8, { width });
      if (sec.note) doc.font('regular').fontSize(8.5).fillColor('#92400e').text(sec.note, left, doc.y + 1, { width });
      doc.y += 4;
      const line = (cells: string[], header: boolean): void => {
        doc.font(header ? 'bold' : 'regular').fontSize(8.5);
        const h = Math.max(...cells.map((t, i) => doc.heightOfString(t || ' ', { width: widths[i] - 8 }))) + 8;
        if (doc.y + h > bottom()) {
          doc.addPage();
          if (!header) line(cols.map((c) => c.header), true); // lặp dòng tiêu đề bảng ở trang mới
        }
        const top = doc.y;
        if (header) doc.rect(left, top, width, h).fill('#fbead7');
        let x = left;
        cells.forEach((t, i) => {
          const c = cols[i];
          doc.rect(x, top, widths[i], h).lineWidth(0.6).strokeColor('#d1d5db').stroke();
          doc.font(header ? 'bold' : 'regular').fontSize(8.5).fillColor('#111111')
            .text(t, x + 4, top + 4, { width: widths[i] - 8, align: header || c.center || c.pct || c.key === '__i' ? 'center' : c.right ? 'right' : 'left' });
          x += widths[i];
        });
        doc.x = left;
        doc.y = top + h;
      };
      line(cols.map((c) => c.header), true);
      if (!sec.rows.length) {
        doc.font('regular').fontSize(8.5);
        const top = doc.y, h = 20;
        doc.rect(left, top, width, h).lineWidth(0.6).strokeColor('#d1d5db').stroke();
        doc.fillColor('#6b7280').text(sec.empty ?? 'Không có dữ liệu trong khoảng thời gian này.', left, top + 5, { width, align: 'center' });
        doc.x = left; doc.y = top + h;
      }
      sec.rows.forEach((row, ri) => line(cols.map((c) => (c.key === '__i' ? String(ri + 1) : cellText(c, row[c.key]))), false));
    });
    // chỗ ký của người lập báo cáo
    if (head.signer) {
      if (doc.y + 90 > bottom()) doc.addPage();
      const sy = doc.y + 16;
      doc.font('bold').fontSize(10.5).fillColor('#111111').text('NGƯỜI LẬP BÁO CÁO', left + half, sy, { width: half, align: 'center' });
      doc.font('regular').fontSize(9).fillColor('#374151').text('(Ký và ghi rõ họ tên)', left + half, doc.y + 1, { width: half, align: 'center', oblique: 12 });
      doc.font('bold').fontSize(10.5).fillColor('#111111').text(head.signer, left + half, doc.y + 40, { width: half, align: 'center' });
    }
    // chân trang mỗi trang: nguồn, ngày xuất và số trang
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const keep = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const fy = doc.page.height - keep + 10;
      doc.font('regular').fontSize(8).fillColor('#6b7280').text(`Báo cáo xuất từ hệ thống Hào Khí Đông A · ${vnDayLabel(now)}`, left, fy, { width: half, lineBreak: false });
      doc.text(`Trang ${i - range.start + 1}/${range.count}`, left + half, fy, { width: half, align: 'right', lineBreak: false });
      doc.page.margins.bottom = keep;
    }
    doc.end();
  });
}

/** Tên cột Excel (1 → A, 27 → AA) */
function sheetCol(n: number): string { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; }
