/**
 * PDF danh sách / báo cáo theo thể thức văn bản hành chính (yêu cầu 14/11/2026: quản trị trường chỉ xuất PDF, trình bày chuẩn như danh sách in của nhà trường).
 * Theo Nghị định 30/2020/NĐ-CP, Phụ lục I: khổ A4; lề trên, dưới 20 mm, trái 30 mm, phải 15 mm (bảng nhiều cột thì trình bày khổ ngang);
 * phông Times New Roman (ở đây dùng Tinos, phông giấy phép OFL có cùng kích thước chữ với Times New Roman, đủ chữ tiếng Việt), chữ đen;
 * góc trái: cơ quan chủ quản (in hoa) và tên trường (in hoa, đậm, gạch dưới 1/3 dòng chữ); góc phải: Quốc hiệu (in hoa, đậm), Tiêu ngữ (đậm, gạch dưới bằng dòng chữ),
 * "địa danh, ngày … tháng … năm …" (nghiêng); tên văn bản in hoa đậm ở giữa; số trang ở giữa lề trên, không hiện ở trang đầu.
 * Bảng: kẻ khung đen mảnh, dòng tiêu đề đậm nền xám nhạt lặp lại mỗi trang, cột STT; không để dòng tiêu đề bảng nằm một mình cuối trang, không cắt đôi một dòng.
 * Cuối văn bản: chỗ ký (Người lập biểu, Hiệu trưởng…) giữ cùng một trang.
 */
import { join } from 'path';
import { readFileSync } from 'fs';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { DatabaseService } from '../database/database.service';
import { directoryLogoHash } from './school-directory';

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');
const MM = 72 / 25.4;
const MARGINS = {
  portrait: { top: 20 * MM, bottom: 20 * MM, left: 30 * MM, right: 15 * MM },
  landscape: { top: 20 * MM, bottom: 15 * MM, left: 20 * MM, right: 15 * MM },
} as const;
/** Bảng rộng hơn số đơn vị này (tính cả cột STT) thì trình bày khổ ngang */
const PORTRAIT_UNITS = 100;
const INK = '#000000';
const MUTED = '#555555';
const HEAD_FILL = '#ededed';
const BODY = 11.5;

export interface PdfSchool { name: string; code: string | null; region: string | null; city?: string | null; address?: string | null; logo?: Buffer | null }
const BRAND_LOGO = readFileSync(join(__dirname, '..', '..', 'assets', 'brand', 'dong-a-edu-lockup.png'));

/** Chỉ dùng ảnh đã lưu trong kho logo xác minh; không tải URL tùy ý khi xuất PDF. */
export async function schoolPdfLogo(db: DatabaseService, school: { directory_code?: string | null; logo_url?: string | null }): Promise<Buffer | null> {
  const storedHash = /\/api\/school-logos\/([a-f0-9]{64})\.webp(?:\?|$)/.exec(school.logo_url ?? '')?.[1];
  // Match the school's current directory logo even when a saved API URL is stale.
  // A custom URL must never silently fall back to a different directory logo.
  if (school.logo_url && !storedHash) return null;
  const hash = (school.directory_code ? directoryLogoHash(school.directory_code) : null) ?? storedHash;
  if (!hash) return null;
  const row = (await db.query<{ image_data: Buffer }>('SELECT image_data FROM public.app_school_logo_assets WHERE sha256=$1', [hash]))[0];
  return row?.image_data ? sharp(row.image_data).resize(160, 160, { fit: 'inside' }).png().toBuffer() : null;
}
/** `width` là độ rộng tương đối (xấp xỉ số chữ); `pct`: số phần trăm, ô trống hiện "–" */
export interface PdfCol { header: string; key: string; width: number; align?: 'left' | 'center' | 'right'; pct?: boolean; /** giữ cả ô trên một dòng (họ và tên) */ keep?: boolean }
export interface PdfTable {
  /** Tiêu đề phần (báo cáo nhiều phần), ví dụ "I. TỔNG QUAN" */
  heading?: string;
  note?: string;
  cols: PdfCol[];
  rows: Array<Record<string, unknown>>;
  empty?: string;
  /** Dòng ghi sau bảng, ví dụ "Danh sách có 30 học sinh." */
  total?: string;
  /** Mặc định có cột STT */
  index?: boolean;
}
export interface PdfSigner { title: string; hint?: string; name?: string | null }
export interface PdfPart {
  school: PdfSchool | null;
  title: string;
  subtitle?: string | null;
  /** Các dòng căn giữa dưới tiêu đề (nghiêng) */
  info?: string[];
  /** Các dòng "nhãn: giá trị" căn trái trước bảng */
  facts?: Array<{ label: string; value: string }>;
  tables: PdfTable[];
  signers?: PdfSigner[];
  orientation?: 'portrait' | 'landscape';
}
export interface PdfDoc { title: string; parts: PdfPart[]; now?: Date; footer?: string }

const upper = (s: string) => s.toLocaleUpperCase('vi');
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Ngày theo giờ Việt Nam */
const vnDate = (now: Date) => { const d = new Date(now.getTime() + 7 * 3_600_000); return { d: pad2(d.getUTCDate()), m: pad2(d.getUTCMonth() + 1), y: String(d.getUTCFullYear()), hh: pad2(d.getUTCHours()), mi: pad2(d.getUTCMinutes()) }; };
/** Địa danh: bỏ chữ Phường/Xã… ở đầu (trừ khi chỉ còn số như Quận 2) */
export const placeName = (region: string | null | undefined): string => {
  const r = (region ?? '').trim();
  const stripped = r.replace(/^(phường|xã|quận|huyện|thị trấn|thị xã|thành phố|đặc khu)\s+/i, '').trim();
  return (/^\d+$/.test(stripped) ? r : stripped) || '…………';
};
/** 2005-03-15 → 15/03/2005 */
export const dmyDate = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const cellText = (col: PdfCol, v: unknown): string => (v === null || v === undefined || v === '' ? (col.pct ? '–' : '') : col.pct && typeof v === 'number' ? `${v}%` : String(v));
const unitsOf = (t: PdfTable) => t.cols.reduce((n, c) => n + c.width, 0) + (t.index === false ? 0 : 5);

export function officialPdf(spec: PdfDoc): Promise<Buffer> {
  const now = spec.now ?? new Date();
  const day = vnDate(now);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Title: spec.title, Author: 'Hào Khí Đông A' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('r', join(FONT_DIR, 'Tinos-Regular.ttf'));
    doc.registerFont('b', join(FONT_DIR, 'Tinos-Bold.ttf'));
    doc.registerFont('i', join(FONT_DIR, 'Tinos-Italic.ttf'));
    /** trang đầu của từng phần (số trang đánh lại cho mỗi phần, ví dụ mỗi lớp một danh sách) */
    const partStarts: number[] = [];
    let pageCount = 0;

    for (const part of spec.parts) {
      const layout = part.orientation ?? (Math.max(0, ...part.tables.map(unitsOf)) > PORTRAIT_UNITS ? 'landscape' : 'portrait');
      const margins = MARGINS[layout];
      const addPage = () => { doc.addPage({ size: 'A4', layout, margins: { ...margins } }); pageCount += 1; };
      addPage();
      partStarts.push(pageCount - 1);
      const left = margins.left, W = doc.page.width - margins.left - margins.right;
      const bottom = () => doc.page.height - margins.bottom;
      /** cỡ chữ lớn nhất (không quá `size`, không dưới `min`) để dòng chữ vừa `width` */
      const fit = (text: string, font: string, size: number, width: number, min = 9) => { let s = size; doc.font(font); while (s > min && doc.fontSize(s).widthOfString(text) > width) s -= 0.25; return s; };
      const centered = (text: string, font: string, size: number, x: number, width: number, y: number) => { doc.font(font).fontSize(size).fillColor(INK).text(text, x, y, { width, align: 'center' }); return doc.y; };
      const rule = (x: number, width: number, textWidth: number, ratio: number, y: number) => {
        const w = Math.min(width, textWidth) * ratio;
        doc.moveTo(x + (width - w) / 2, y).lineTo(x + (width + w) / 2, y).lineWidth(0.6).strokeColor(INK).stroke();
      };

      // ---------------- phần đầu: cơ quan (trái), Quốc hiệu và Tiêu ngữ (phải), địa danh và ngày
      const leftW = W * (layout === 'portrait' ? 0.42 : 0.4), rightW = W - leftW, rightX = left + leftW;
      let y = margins.top;
      const school = part.school;
      if (school?.logo) doc.image(school.logo, left, y, { fit: [48, 48], align: 'center', valign: 'center' });
      doc.image(BRAND_LOGO, left + W - 112, y, { fit: [112, 48], align: 'right', valign: 'center' });
      y += 55;
      const schoolLine = school ? (/^trường\s/i.test(school.name) ? upper(school.name) : `TRƯỜNG ${upper(school.name)}`) : 'HÀO KHÍ ĐÔNG A';
      const parent = school ? (school.region ? `UBND ${upper(school.region)}` : null) : 'HỆ THỐNG HỌC TẬP';
      let ly = y;
      if (parent) { const s = fit(parent, 'r', 12.5, leftW - 14, 10); ly = centered(parent, 'r', s, left, leftW - 10, ly); }
      const ns = fit(schoolLine, 'b', 12.5, leftW - 14, 10.5);
      ly = centered(schoolLine, 'b', ns, left, leftW - 10, ly);
      rule(left, leftW - 10, doc.font('b').fontSize(ns).widthOfString(schoolLine), 1 / 3, ly + 2);
      ly += 4;
      if (school?.address) {
        doc.font('r').fontSize(9).fillColor(MUTED).text(school.address, left, ly + 2, { width: leftW - 10, align: 'center' });
        ly = doc.y;
      }
      const qh = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', tn = 'Độc lập - Tự do - Hạnh phúc';
      let ry = centered(qh, 'b', fit(qh, 'b', 12.5, rightW - 4, 10), rightX, rightW, y);
      const ts = fit(tn, 'b', 13, rightW - 4, 10.5);
      ry = centered(tn, 'b', ts, rightX, rightW, ry);
      rule(rightX, rightW, doc.font('b').fontSize(ts).widthOfString(tn), 1, ry + 1.5);
      const dateLine = `${placeName(school?.region)}, ngày ${day.d} tháng ${day.m} năm ${day.y}`;
      ry = centered(dateLine, 'i', fit(dateLine, 'i', 13, rightW - 4, 10), rightX, rightW, ry + 9);
      y = Math.max(ly, ry) + 20;

      // ---------------- tên văn bản, dòng phụ, thông tin
      y = centered(upper(part.title), 'b', 14, left, W, y);
      if (part.subtitle) y = centered(part.subtitle, 'b', 13, left, W, y + 1);
      for (const line of part.info ?? []) y = centered(line, 'i', 12.5, left, W, y + 1);
      y += 10;
      for (const f of part.facts ?? []) {
        doc.font('b').fontSize(12.5).fillColor(INK).text(`${f.label}: `, left, y, { continued: true, width: W }).font('r').text(f.value);
        y = doc.y + 1;
      }
      if (part.facts?.length) y += 6;
      doc.x = left; doc.y = y;

      // ---------------- bảng
      const SIGN_H = 128;
      for (const [ti, table] of part.tables.entries()) {
        const closing = ti === part.tables.length - 1 && !!part.signers?.length; // bảng cuối, sau nó là chỗ ký
        const cols: PdfCol[] = table.index === false ? table.cols : [{ header: 'STT', key: '__i', width: 5, align: 'center' }, ...table.cols];
        // Độ rộng cột theo nội dung:
        // - tối thiểu: cột căn giữa (mã, ngày, giới tính, trạng thái, lớp…) vừa cả ô trên một dòng; cột căn trái (họ tên, email, ghi chú) vừa từ dài nhất;
        //   tiêu đề cột ngắn (Sĩ số, Giới tính) một dòng. Tổng tối thiểu vẫn quá khổ giấy thì giảm cỡ chữ của riêng bảng đó (tối thiểu 9) thay vì cắt đôi mã;
        // - phần còn thừa trước hết để các cột chữ hiện trọn trên một dòng (họ tên không bị bẻ thành ba dòng), dư nữa mới chia cho cột chữ theo tỉ lệ `width`.
        const measure = (size: number) => {
          const token = (text: string, font: string) => { doc.font(font).fontSize(size); return Math.max(0, ...text.split(/\s+/).map((w) => doc.widthOfString(w))); };
          const whole = (text: string, font: string) => { doc.font(font).fontSize(size); return doc.widthOfString(text); };
          const headMin = (c: PdfCol) => { const t = token(c.header, 'b'); if ((c.align ?? 'left') !== 'center') return t; const all = whole(c.header, 'b'); return all <= 60 ? all : t; };
          const texts = (c: PdfCol) => table.rows.map((r) => (c.key === '__i' ? String(table.rows.length) : cellText(c, r[c.key])));
          const min = cols.map((c) => Math.max(headMin(c), ...texts(c).map((t) => ((c.align ?? 'left') === 'center' || c.keep ? whole(t, 'r') : token(t, 'r')))) + 13); // 8 điểm lề trong ô + chừa sai số đo chữ
          const pref = cols.map((c, i) => Math.max(min[i], Math.min(W * 0.45, Math.max(0, ...texts(c).map((t) => whole(t, 'r'))) + 13)));
          return { min, pref };
        };
        let fs = BODY, m = measure(fs);
        while (fs > 9 && m.min.reduce((n, x) => n + x, 0) > W) { fs -= 0.5; m = measure(fs); }
        const minW = m.min, needW = minW.reduce((n, x) => n + x, 0);
        const flex = cols.map((c) => ((c.align ?? 'left') === 'center' ? 0 : c.width));
        const flexUnits = flex.reduce((n, u) => n + u, 0);
        let widths: number[];
        if (needW >= W) widths = minW.map((x) => (x * W) / needW);
        else {
          const extra = W - needW;
          const deficit = m.pref.map((p, i) => p - minW[i]), totalDeficit = deficit.reduce((n, d) => n + d, 0);
          if (totalDeficit >= extra) widths = minW.map((x, i) => x + (totalDeficit ? (deficit[i] * extra) / totalDeficit : 0));
          else {
            const rest = extra - totalDeficit;
            widths = cols.map((c, i) => m.pref[i] + (rest * (flexUnits ? flex[i] : c.width)) / (flexUnits || cols.reduce((n, x) => n + x.width, 0)));
          }
        }
        const rowHeight = (cells: string[], font: string) => { doc.font(font).fontSize(fs); return Math.max(18, ...cells.map((t, i) => doc.heightOfString(t || ' ', { width: widths[i] - 8 }) + 7)); };
        const headCells = cols.map((c) => c.header);
        const headH = rowHeight(headCells, 'b');
        const drawRow = (cells: string[], header: boolean, h: number) => {
          const top = doc.y;
          if (header) doc.rect(left, top, W, h).fill(HEAD_FILL);
          let x = left;
          cells.forEach((t, i) => {
            const c = cols[i];
            doc.rect(x, top, widths[i], h).lineWidth(0.5).strokeColor(INK).stroke();
            const th = doc.font(header ? 'b' : 'r').fontSize(fs).heightOfString(t || ' ', { width: widths[i] - 8 });
            doc.fillColor(INK).text(t, x + 4, top + (h - th) / 2, { width: widths[i] - 8, align: header ? 'center' : c.align ?? 'left' });
            x += widths[i];
          });
          doc.x = left; doc.y = top + h;
        };
        const firstRows = table.rows.slice(0, 1).map((r) => cols.map((c) => (c.key === '__i' ? '1' : cellText(c, r[c.key]))));
        const need = (table.heading ? 24 : 0) + (table.note ? 16 : 0) + headH + (firstRows.length ? rowHeight(firstRows[0], 'r') : 20) + 4;
        if (doc.y + need > bottom()) { addPage(); doc.y = margins.top; }
        if (table.heading) { doc.font('b').fontSize(13).fillColor(INK).text(table.heading, left, doc.y + 6, { width: W }); doc.y += 3; }
        if (table.note) { doc.font('i').fontSize(11.5).fillColor(INK).text(table.note, left, doc.y, { width: W }); doc.y += 3; }
        drawRow(headCells, true, headH);
        if (!table.rows.length) {
          const top = doc.y, h = 22;
          doc.rect(left, top, W, h).lineWidth(0.5).strokeColor(INK).stroke();
          doc.font('i').fontSize(fs).fillColor(MUTED).text(table.empty ?? 'Không có dữ liệu.', left, top + 5, { width: W, align: 'center' });
          doc.x = left; doc.y = top + h;
        }
        const all = table.rows.map((r, ri) => cols.map((c) => (c.key === '__i' ? String(ri + 1) : cellText(c, r[c.key]))));
        const heights = all.map((cells) => rowHeight(cells, 'r'));
        let onPage = 0;
        all.forEach((cells, ri) => {
          const h = heights[ri];
          // không để chỗ ký đứng một mình ở trang cuối: hai dòng cuối của bảng sang trang mới cùng chỗ ký
          const carry = closing && ri === all.length - 2 && onPage > 2 && doc.y + h + heights[ri + 1] + (table.total ? 22 : 0) + SIGN_H > bottom() && doc.y + h + heights[ri + 1] <= bottom();
          if (doc.y + h > bottom() || carry) { addPage(); doc.y = margins.top; drawRow(headCells, true, headH); onPage = 0; } // lặp dòng tiêu đề bảng ở trang mới
          drawRow(cells, false, h);
          onPage += 1;
        });
        if (table.total) { doc.font('i').fontSize(12).fillColor(INK).text(table.total, left, doc.y + 5, { width: W }); }
        doc.y += 10;
      }

      // ---------------- chỗ ký: giữ cùng một trang
      const signers = part.signers ?? [];
      if (signers.length) {
        if (doc.y + SIGN_H - 8 > bottom()) { addPage(); doc.y = margins.top; }
        const sy = doc.y + 8, colW = W / 2;
        const slots = signers.length === 1 ? [{ s: signers[0], x: left + colW }] : signers.slice(0, 2).map((s, i) => ({ s, x: left + i * colW }));
        for (const { s, x } of slots) {
          let yy = centered(upper(s.title), 'b', 13, x, colW, sy);
          yy = centered(s.hint ?? '(Ký, ghi rõ họ tên)', 'i', 12, x, colW, yy);
          if (s.name) centered(s.name, 'b', 13, x, colW, yy + 62);
        }
        doc.y = sy + 110;
      }
    }

    // ---------------- số trang (giữa lề trên, từ trang thứ hai của mỗi phần) và dòng nguồn ở chân trang
    const range = doc.bufferedPageRange();
    const stamp = `${spec.footer ? `${spec.footer} · ` : ''}Xuất từ hệ thống Hào Khí Đông A lúc ${day.hh}:${day.mi} ngày ${day.d}/${day.m}/${day.y}`;
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const keep = { ...doc.page.margins };
      const w = doc.page.width - keep.left - keep.right;
      doc.page.margins = { ...keep, top: 0, bottom: 0 };
      const start = [...partStarts].reverse().find((p) => p <= i - range.start) ?? 0;
      const n = i - range.start - start + 1;
      if (n > 1) doc.font('r').fontSize(13).fillColor(INK).text(String(n), keep.left, keep.top / 2 - 6, { width: w, align: 'center', lineBreak: false });
      doc.font('i').fontSize(8.5).fillColor(MUTED).text(stamp, keep.left, doc.page.height - keep.bottom / 2 - 4, { width: w, align: 'left', lineBreak: false });
      doc.page.margins = keep;
    }
    doc.end();
  });
}
