/**
 * Xuất báo cáo trận đấu (Sprint 8, HK.GV.057): Excel (nhiều trang tính) và PDF (một khổ A4 ngang, chữ Manrope có dấu tiếng Việt).
 * Mọi chuỗi do người dùng nhập (biệt danh, nội dung câu hỏi) được làm sạch để Excel không hiểu nhầm là công thức.
 */
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

export type LiveReport = Awaited<ReturnType<import('./live.service').LiveService['report']>>;

const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');
const MODE = { solo: 'Cá nhân', team: 'Theo đội', boss: 'Đánh trùm cả lớp' } as const;
const QTYPE: Record<string, string> = { single: 'Một đáp án', multiple: 'Nhiều đáp án', truefalse: 'Đúng / sai', fill: 'Điền khuyết', order: 'Sắp xếp', map: 'Bản đồ', poll: 'Bình chọn' };
const when = (d: Date | string | null): string => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
/** Chuỗi bắt đầu bằng = + - @ bị Excel coi là công thức: thêm dấu nháy đơn phía trước */
const safe = (v: unknown): string | number => (typeof v === 'number' ? v : /^[=+\-@\t\r]/.test(String(v ?? '')) ? `'${String(v)}` : String(v ?? ''));

export async function reportWorkbook(r: LiveReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hào Khí Đông A';
  const style = (sheet: ExcelJS.Worksheet) => { sheet.getRow(1).font = { bold: true }; sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; };

  const overview = wb.addWorksheet('Tổng quan');
  overview.columns = [{ header: 'Mục', key: 'k', width: 28 }, { header: 'Giá trị', key: 'v', width: 60 }];
  for (const [k, v] of [
    ['Tên phòng thi', r.room.title], ['Lớp', r.room.class_name], ['Chế độ', MODE[r.room.mode]], ['Bắt đầu', when(r.room.started_at)], ['Kết thúc', when(r.room.ended_at)],
    ['Kết thúc sớm', r.room.ended_early ? 'Có' : 'Không'], ['Số câu đã diễn ra', `${r.room.played}/${r.room.total}`], ['Số học sinh', r.summary.players], ['Điểm trung bình', r.summary.avg_score],
    ['Tỉ lệ tham gia trả lời (%)', r.summary.participation_rate], ['Số câu bị bỏ qua', r.summary.skipped], ['Câu khó nhất', r.hardest ? `Câu ${r.hardest.number} (đúng ${r.hardest.correct_rate}%): ${r.hardest.prompt}` : ''],
  ] as Array<[string, unknown]>) overview.addRow({ k, v: safe(v) });
  style(overview);

  const players = wb.addWorksheet('Học sinh');
  players.columns = [
    { header: 'Hạng', key: 'rank', width: 8 }, { header: 'Họ và tên', key: 'full_name', width: 28 }, { header: 'Mã học sinh', key: 'user_code', width: 14 }, { header: 'Biệt danh', key: 'nickname', width: 20 },
    { header: 'Đội', key: 'team_name', width: 18 }, { header: 'Điểm', key: 'score', width: 10 }, { header: 'Số câu đúng', key: 'correct_count', width: 12 }, { header: 'Số câu đã trả lời', key: 'answered_count', width: 16 },
    { header: 'Tỉ lệ đúng trên số câu đã thi (%)', key: 'accuracy', width: 26 }, { header: 'Thời gian trung bình (giây)', key: 'avg_seconds', width: 22 }, { header: 'Điểm cộng vào tài khoản', key: 'xp_awarded', width: 22 }, { header: 'Số lần chuyển tab khi đang trả lời', key: 'tab_switches', width: 30 },
  ];
  for (const p of r.players) players.addRow({ ...p, full_name: safe(p.full_name), nickname: safe(p.nickname), team_name: safe(p.team_name ?? ''), user_code: safe(p.user_code ?? '') });
  style(players);

  const questions = wb.addWorksheet('Câu hỏi');
  questions.columns = [
    { header: 'Câu', key: 'number', width: 6 }, { header: 'Nội dung', key: 'prompt', width: 70 }, { header: 'Dạng', key: 'qtype', width: 14 }, { header: 'Đã trả lời', key: 'answered', width: 11 },
    { header: 'Đúng', key: 'correct', width: 8 }, { header: 'Sai', key: 'wrong', width: 8 }, { header: 'Chưa trả lời', key: 'none', width: 12 }, { header: 'Tỉ lệ đúng (%)', key: 'correct_rate', width: 14 },
    { header: 'Thời gian trung bình (giây)', key: 'avg_seconds', width: 22 }, { header: 'Bị bỏ qua', key: 'skipped', width: 10 }, { header: 'Kết quả bình chọn', key: 'votes', width: 50 },
  ];
  for (const x of r.questions) questions.addRow({ ...x, prompt: safe(x.prompt), qtype: QTYPE[x.qtype] ?? x.qtype, skipped: x.skipped ? 'Có' : '', votes: x.votes ? safe(x.votes.map((v) => `${v.text}: ${v.count}`).join('; ')) : '' });
  style(questions);

  if (r.teams) {
    const teams = wb.addWorksheet('Đội');
    teams.columns = [{ header: 'Hạng', key: 'rank', width: 8 }, { header: 'Đội', key: 'name', width: 24 }, { header: 'Số thành viên', key: 'members', width: 14 }, { header: 'Điểm đội (trung bình)', key: 'score', width: 22 }, { header: 'Tổng điểm', key: 'total', width: 12 }];
    for (const t of r.teams) teams.addRow({ ...t, name: safe(t.name) });
    style(teams);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function reportPdf(r: LiveReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: `Báo cáo thi đấu – ${r.room.title}`, Author: 'Hào Khí Đông A' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', join(FONT_DIR, 'Manrope-Regular.ttf'));
    doc.registerFont('bold', join(FONT_DIR, 'Manrope-Bold.ttf'));
    const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right;

    const table = (title: string, cols: Array<{ h: string; w: number; get: (row: any) => string; right?: boolean }>, rows: any[]) => {
      doc.font('bold').fontSize(13).fillColor('#111111').text(title, left, doc.y + 8);
      doc.moveDown(0.3);
      const total = cols.reduce((n, c) => n + c.w, 0);
      const widths = cols.map((c) => (c.w / total) * width);
      const line = (cells: string[], bold: boolean) => {
        const y = doc.y;
        doc.font(bold ? 'bold' : 'regular').fontSize(9);
        const heights = cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 6 }));
        const h = Math.max(...heights) + 6;
        if (y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); return line(cells, bold); }
        if (bold) doc.rect(left, y, width, h).fill('#efe7d6');
        doc.fillColor('#111111');
        let x = left;
        cells.forEach((t, i) => { doc.font(bold ? 'bold' : 'regular').fontSize(9).text(t, x + 3, y + 3, { width: widths[i] - 6, align: cols[i].right ? 'right' : 'left' }); x += widths[i]; });
        doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor('#d8cfba').lineWidth(0.5).stroke();
        doc.x = left;
        doc.y = y + h;
      };
      line(cols.map((c) => c.h), true);
      for (const row of rows) line(cols.map((c) => c.get(row)), false);
    };

    doc.font('bold').fontSize(18).fillColor('#9b1c1c').text('Báo cáo trận đấu trực tiếp', left, doc.y);
    doc.font('bold').fontSize(13).fillColor('#111111').text(r.room.title);
    doc.font('regular').fontSize(10).fillColor('#444444').text(
      `Lớp ${r.room.class_name} · ${MODE[r.room.mode]} · ${when(r.room.started_at || r.room.created_at)}${r.room.ended_at ? ` – ${when(r.room.ended_at)}` : ''}${r.room.ended_early ? ' · kết thúc sớm' : ''}`);
    doc.text(`${r.summary.players} học sinh · điểm trung bình ${r.summary.avg_score} · tỉ lệ tham gia trả lời ${r.summary.participation_rate}% · ${r.room.played}/${r.room.total} câu đã diễn ra${r.summary.skipped ? ` · ${r.summary.skipped} câu bị bỏ qua` : ''}`);
    if (r.hardest) doc.fillColor('#111111').text(`Câu khó nhất: câu ${r.hardest.number} (đúng ${r.hardest.correct_rate}%) – ${r.hardest.prompt}`, { width });

    table('Kết quả từng học sinh', [
      { h: 'Hạng', w: 6, get: (p) => String(p.rank) }, { h: 'Họ và tên', w: 24, get: (p) => p.full_name }, { h: 'Biệt danh', w: 16, get: (p) => p.nickname }, { h: 'Đội', w: 14, get: (p) => p.team_name ?? '' },
      { h: 'Điểm', w: 9, get: (p) => String(p.score), right: true }, { h: 'Đúng / đã trả lời', w: 13, get: (p) => `${p.correct_count}/${p.answered_count}`, right: true },
      { h: 'Tỉ lệ đúng (số câu đã thi)', w: 12, get: (p) => `${p.accuracy}%`, right: true }, { h: 'TB giây', w: 8, get: (p) => (p.avg_seconds === null ? '' : String(p.avg_seconds)), right: true },
    ], r.players);
    table('Kết quả từng câu hỏi', [
      { h: 'Câu', w: 5, get: (x) => String(x.number) }, { h: 'Nội dung', w: 50, get: (x) => x.prompt }, { h: 'Dạng', w: 12, get: (x) => QTYPE[x.qtype] ?? x.qtype },
      { h: 'Đúng', w: 7, get: (x) => (x.poll ? '–' : String(x.correct)), right: true }, { h: 'Sai', w: 7, get: (x) => (x.poll ? '–' : String(x.wrong)), right: true }, { h: 'Chưa trả lời', w: 9, get: (x) => String(x.none), right: true },
      { h: 'Tỉ lệ đúng', w: 9, get: (x) => (x.skipped ? 'Bỏ qua' : x.correct_rate === null ? '' : `${x.correct_rate}%`), right: true },
    ], r.questions);
    if (r.teams) table('Bảng xếp hạng đội', [
      { h: 'Hạng', w: 8, get: (t) => String(t.rank) }, { h: 'Đội', w: 40, get: (t) => t.name }, { h: 'Thành viên', w: 14, get: (t) => String(t.members), right: true }, { h: 'Điểm đội (trung bình)', w: 22, get: (t) => String(t.score), right: true },
    ], r.teams);
    doc.end();
  });
}
