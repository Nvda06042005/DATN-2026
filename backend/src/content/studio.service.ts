/**
 * Kho tệp tải lên (HK.GV.085, 092–093): ảnh nhỏ (PNG, JPEG, WEBP, GIF, tối đa 1,5 MB), video (MP4, WebM) và nhạc (MP3, OGG) lưu trong cơ sở dữ liệu và
 * phục vụ ở đường dẫn công khai chứa mã ngẫu nhiên; ảnh đại diện; kho ảnh gồm ảnh đã tải lên và ảnh sử liệu đã công bố.
 * Trình soạn "Quiz (Kahoot-style)" (bản nháp `hk_quiz_drafts`, /api/content/studio) đã xóa hẳn theo yêu cầu 16/11/2026; bảng bản nháp cũ giữ nguyên dữ liệu.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService, searchText, UserRow } from '../database/database.service';

const MAX_IMAGE_BYTES = 1_572_864;
const MAX_IMAGES_PER_USER = 60;
const MAX_IMAGE_TOTAL = 30 * 1024 * 1024;

// ---------------------------------------------------------------------- tệp tải lên: ảnh, video, nhạc
/** Loại tệp nhận được, xác định bằng nội dung thật (không tin tên tệp hay loại do trình duyệt khai) */
export type MediaKind = 'image' | 'video' | 'audio';
const SIGNATURES: Array<{ mime: string; kind: MediaKind; test: (b: Buffer) => boolean }> = [
  { mime: 'image/png', kind: 'image', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', kind: 'image', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', kind: 'image', test: (b) => b.length > 6 && b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { mime: 'image/webp', kind: 'image', test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  // MP4: khối "ftyp" ở byte 4–8; WebM: tiêu đề EBML (1A 45 DF A3) có khai báo kiểu tài liệu "webm"
  { mime: 'video/mp4', kind: 'video', test: (b) => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' },
  { mime: 'video/webm', kind: 'video', test: (b) => b.length > 16 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && b.subarray(0, 64).includes('webm') },
  // MP3: thẻ ID3 hoặc khung đồng bộ MPEG (11 bit 1); OGG: "OggS"
  { mime: 'audio/mpeg', kind: 'audio', test: (b) => b.length > 4 && (b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) },
  { mime: 'audio/ogg', kind: 'audio', test: (b) => b.length > 4 && b.subarray(0, 4).toString('latin1') === 'OggS' },
];
/** Giới hạn mỗi tệp, số tệp và tổng dung lượng mỗi giáo viên theo loại; `label` dùng trong thông báo */
export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; files: number; total: number; label: string; max: string }> = {
  image: { maxBytes: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_USER, total: MAX_IMAGE_TOTAL, label: 'ảnh', max: '1,5 MB' },
  video: { maxBytes: 8 * 1024 * 1024, files: 5, total: 32 * 1024 * 1024, label: 'video', max: '8 MB' },
  audio: { maxBytes: 4 * 1024 * 1024, files: 5, total: 16 * 1024 * 1024, label: 'tệp nhạc', max: '4 MB' },
};
/** Tổng dung lượng mọi tệp tải lên của cả hệ thống: tệp nằm trong cơ sở dữ liệu nên cần một trần chung để không làm đầy cơ sở dữ liệu */
export const MEDIA_SYSTEM_TOTAL = 200 * 1024 * 1024;
/** Ảnh đại diện của người dùng nằm cùng kho nhưng có tên riêng: không tính vào hạn mức ảnh Quiz và không hiện trong thư viện của giáo viên */
export const AVATAR_NAME = 'avatar:user';
/**
 * Chuỗi base64 chuẩn (có thể thiếu dấu "="). Duyệt từng ký tự thay vì dùng biểu thức chính quy: với chuỗi dài hàng MB (video 8 MB mã hóa thành ~11 MB)
 * bộ máy biểu thức chính quy của V8 có thể báo "Maximum call stack size exceeded" ngẫu nhiên và làm yêu cầu trả 500.
 */
export function isBase64(raw: string): boolean {
  let end = raw.length;
  while (end > 0 && raw.charCodeAt(end - 1) === 61) end -= 1;
  if (end === 0 || raw.length - end > 2) return false;
  for (let i = 0; i < end; i += 1) {
    const c = raw.charCodeAt(i);
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47)) return false;
  }
  return true;
}
const kindOfMime = (mime: string): MediaKind => (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'audio');

@Injectable()
export class MediaService {
  constructor(private readonly db: DatabaseService) {}

  /** `data` là chuỗi base64 hoặc data URL; loại tệp được xác định bằng nội dung thật chứ không tin tên tệp */
  async upload(user: UserRow, body: { name?: unknown; data?: unknown }) {
    const raw = typeof body.data === 'string' ? body.data.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '') : '';
    if (!isBase64(raw)) throw new BadRequestException('Hãy chọn một tệp ảnh, video hoặc nhạc');
    if (raw.length > Math.ceil((MEDIA_LIMITS.video.maxBytes * 4) / 3) + 8) throw new BadRequestException('Tệp quá lớn: ảnh tối đa 1,5 MB, nhạc 4 MB, video 8 MB');
    const bytes = Buffer.from(raw, 'base64');
    if (!bytes.length) throw new BadRequestException('Hãy chọn một tệp ảnh, video hoặc nhạc');
    const kind = SIGNATURES.find((s) => s.test(bytes));
    if (!kind) throw new BadRequestException('Chỉ nhận ảnh PNG, JPEG, WEBP, GIF; video MP4, WebM; nhạc MP3, OGG');
    const limit = MEDIA_LIMITS[kind.kind];
    if (bytes.length > limit.maxBytes) throw new BadRequestException(`${limit.label[0].toUpperCase()}${limit.label.slice(1)} tối đa ${limit.max}`);
    const like = `${kind.kind}/%`;
    const used = (await this.db.query<{ n: string; bytes: string }>('SELECT count(*) AS n, COALESCE(sum(size_bytes), 0) AS bytes FROM hk_media WHERE owner_id = $1 AND mime LIKE $2 AND name IS DISTINCT FROM $3', [user.id, like, AVATAR_NAME]))[0];
    if (Number(used.n) >= limit.files || Number(used.bytes) + bytes.length > limit.total) {
      throw new ConflictException(`Mỗi tài khoản tải lên tối đa ${limit.files} ${limit.label} (tổng ${Math.round(limit.total / 1048576)} MB); hãy dùng lại tệp đã tải hoặc xóa bớt tệp không còn dùng`);
    }
    const all = Number((await this.db.query<{ bytes: string }>('SELECT COALESCE(sum(size_bytes), 0) AS bytes FROM hk_media'))[0].bytes);
    if (all + bytes.length > MEDIA_SYSTEM_TOTAL) throw new ConflictException('Kho tải lên của hệ thống đã đầy; hãy liên hệ quản trị viên');
    const token = randomBytes(16).toString('hex');
    const asked = typeof body.name === 'string' ? body.name.trim().slice(0, 120) || null : null;
    const name = asked === AVATAR_NAME ? null : asked; // tên dành riêng cho ảnh đại diện
    await this.db.query('INSERT INTO hk_media (token, owner_id, mime, name, size_bytes, data) VALUES ($1, $2, $3, $4, $5, $6)', [token, user.id, kind.mime, name, bytes.length, bytes]);
    return { token, url: `/api/content/media/${token}`, mime: kind.mime, kind: kind.kind, size_bytes: bytes.length, name };
  }

  /**
   * Ảnh đại diện của chính người dùng (mọi vai trò): chỉ nhận ảnh PNG, JPEG, WEBP, GIF tối đa 1,5 MB; loại tệp xác định bằng nội dung thật nên đổi đuôi
   * tệp Word, Excel, PowerPoint, PDF… thành .png vẫn bị từ chối. Mỗi người chỉ giữ một ảnh: ảnh cũ bị xóa khi đổi ảnh mới.
   */
  async setAvatar(user: UserRow, body: { data?: unknown }) {
    const raw = typeof body.data === 'string' ? body.data.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '') : '';
    if (!isBase64(raw)) throw new BadRequestException('Hãy chọn một tệp ảnh làm ảnh đại diện');
    const limit = MEDIA_LIMITS.image;
    if (raw.length > Math.ceil((limit.maxBytes * 4) / 3) + 8) throw new BadRequestException(`Ảnh đại diện tối đa ${limit.max}`);
    const bytes = Buffer.from(raw, 'base64');
    const kind = SIGNATURES.find((s) => s.test(bytes));
    if (!kind || kind.kind !== 'image') throw new BadRequestException('Ảnh đại diện chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF; không nhận tệp Word, Excel, PowerPoint, PDF hay tệp khác');
    if (bytes.length > limit.maxBytes) throw new BadRequestException(`Ảnh đại diện tối đa ${limit.max}`);
    const all = Number((await this.db.query<{ bytes: string }>('SELECT COALESCE(sum(size_bytes), 0) AS bytes FROM hk_media'))[0].bytes);
    if (all + bytes.length > MEDIA_SYSTEM_TOTAL) throw new ConflictException('Kho tải lên của hệ thống đã đầy; hãy liên hệ quản trị viên');
    const token = randomBytes(16).toString('hex');
    const url = `/api/content/media/${token}`;
    await this.db.tx(async (q) => {
      await q('INSERT INTO hk_media (token, owner_id, mime, name, size_bytes, data) VALUES ($1, $2, $3, $4, $5, $6)', [token, user.id, kind.mime, AVATAR_NAME, bytes.length, bytes]);
      await q('UPDATE app_users SET avatar_url = $2 WHERE id = $1', [user.id, url]);
      await q('DELETE FROM hk_media WHERE owner_id = $1 AND name = $2 AND token <> $3', [user.id, AVATAR_NAME, token]);
    });
    return { avatar_url: url };
  }

  /** Bỏ ảnh đại diện: về lại chữ cái đầu, xóa tệp ảnh đã tải lên */
  async removeAvatar(user: UserRow) {
    await this.db.tx(async (q) => {
      await q('UPDATE app_users SET avatar_url = NULL WHERE id = $1', [user.id]);
      await q('DELETE FROM hk_media WHERE owner_id = $1 AND name = $2', [user.id, AVATAR_NAME]);
    });
  }

  /** Thông tin tệp (không kèm nội dung) để trả lời yêu cầu `Range` mà không phải đọc cả tệp */
  async meta(token: string): Promise<{ mime: string; size: number }> {
    const row = /^[0-9a-f]{32}$/.test(token) ? (await this.db.query<{ mime: string; size_bytes: number }>('SELECT mime, size_bytes FROM hk_media WHERE token = $1', [token]))[0] : undefined;
    if (!row) throw new NotFoundException('Không tìm thấy tệp');
    return { mime: row.mime, size: row.size_bytes };
  }

  async file(token: string): Promise<{ mime: string; data: Buffer }> {
    const row = /^[0-9a-f]{32}$/.test(token) ? (await this.db.query<{ mime: string; data: Buffer }>('SELECT mime, data FROM hk_media WHERE token = $1', [token]))[0] : undefined;
    if (!row) throw new NotFoundException('Không tìm thấy tệp');
    return row;
  }

  /** Một đoạn của tệp (byte `start` tới `start + length - 1`) cho phát video có tua: trình duyệt, nhất là Safari, đòi trả lời `Range` */
  async slice(token: string, start: number, length: number): Promise<Buffer> {
    const row = (await this.db.query<{ chunk: Buffer }>('SELECT substring(data FROM $2::int FOR $3::int) AS chunk FROM hk_media WHERE token = $1', [token, start + 1, length]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy tệp');
    return row.chunk;
  }

  /** Xóa tệp của chính mình khi không còn dùng ở câu hỏi, ảnh bìa, nhạc chờ hay bản nháp nào */
  async remove(user: UserRow, token: string) {
    const row = /^[0-9a-f]{32}$/.test(token) ? (await this.db.query<{ owner_id: number | null }>('SELECT owner_id FROM hk_media WHERE token = $1', [token]))[0] : undefined;
    if (!row || row.owner_id !== user.id) throw new NotFoundException('Không tìm thấy tệp');
    const url = `/api/content/media/${token}`;
    const used = Number((await this.db.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM hk_questions WHERE image_url = $1 OR video_url = $1) + (SELECT count(*) FROM hk_quizzes WHERE cover_url = $1 OR theme->>'music_url' = $1)
            + (SELECT count(*) FROM hk_quiz_drafts WHERE payload::text LIKE '%' || $1 || '%') + (SELECT count(*) FROM app_users WHERE avatar_url = $1) AS n`, [url]))[0].n);
    if (used) throw new ConflictException('Tệp đang được dùng trong câu hỏi, Quiz, bản nháp hoặc làm ảnh đại diện; hãy gỡ khỏi nơi đó trước');
    await this.db.query('DELETE FROM hk_media WHERE token = $1', [token]);
    return { deleted: true };
  }

  /** Tệp để chèn vào câu hỏi: ảnh, video, nhạc tôi đã tải lên và ảnh sử liệu đã công bố trong kho tư liệu (tranh, bản đồ, hiện vật, chân dung, địa danh) */
  async library(user: UserRow, q?: string) {
    // tìm không phân biệt hoa thường và dấu (lọc ở máy chủ ứng dụng vì chữ hoa có dấu phụ thuộc bộ ký tự của cơ sở dữ liệu)
    const term = searchText(String(q ?? ''));
    const mineAll = await this.db.query<{ token: string; name: string | null; mime: string; size_bytes: number }>('SELECT token, name, mime, size_bytes FROM hk_media WHERE owner_id = $1 AND name IS DISTINCT FROM $2 ORDER BY created_at DESC LIMIT 60', [user.id, AVATAR_NAME]);
    const withUrl = (m: { token: string; name: string | null; mime: string; size_bytes: number }) => ({ ...m, url: `/api/content/media/${m.token}` });
    const mine = mineAll.filter((m) => kindOfMime(m.mime) === 'image').slice(0, 24);
    const items = await this.db.query<{ kind: string; id: number; title: string; url: string }>(
      `SELECT * FROM (
         SELECT 'source' AS kind, id, title, attachment_url AS url FROM hist_sources WHERE status = 'published' AND kind IN ('hinh_anh', 'ban_do_co') AND attachment_url IS NOT NULL
         UNION ALL SELECT 'figure', id, name, image_url FROM hist_figures WHERE status = 'published' AND image_url IS NOT NULL
         UNION ALL SELECT 'place', id, name, image_url FROM hist_places WHERE status = 'published' AND image_url IS NOT NULL
         UNION ALL SELECT 'campaign', id, title, image_url FROM hist_campaigns WHERE status = 'published' AND image_url IS NOT NULL
       ) t ORDER BY t.kind, t.title LIMIT 600`);
    const library = items.filter((i) => !term || searchText(i.title).includes(term)).slice(0, 40);
    return {
      uploads: mine.map(withUrl),
      videos: mineAll.filter((m) => kindOfMime(m.mime) === 'video').map(withUrl),
      audios: mineAll.filter((m) => kindOfMime(m.mime) === 'audio').map(withUrl),
      library,
    };
  }
}
