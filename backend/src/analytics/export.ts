/**
 * Xuất báo cáo (Sprint 10, HK.GV.071, HK.QT.048): Excel nhiều trang tính và PDF A4 ngang (chữ Manrope có dấu tiếng Việt) từ các bảng đã tính sẵn.
 * Chuỗi do người dùng nhập (tên, nhận xét) được làm sạch để Excel không hiểu nhầm là công thức.
 */
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

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
