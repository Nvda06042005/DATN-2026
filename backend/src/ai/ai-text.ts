/**
 * Phần thuần của RAG (Sprint 9, HK.SYS.009–011): tách từ không dấu, chia đoạn tư liệu, xếp hạng BM25 kèm điểm "độ phủ" để biết câu hỏi có nằm trong phạm vi tư liệu,
 * độ tương đồng cosine cho vector nhúng, trộn hai bảng xếp hạng (RRF), lọc nội dung và mã hóa khóa API. Không đụng cơ sở dữ liệu hay mạng nên kiểm thử trực tiếp được.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { searchText } from '../database/database.service';

/**
 * Từ hỏi và từ nối tiếng Việt không mang nội dung tra cứu. Lọc theo chữ CÓ dấu ("đang" bị bỏ nhưng tên "Bạch Đằng" thì giữ vì bỏ dấu hai từ trùng nhau);
 * chữ gõ không dấu chỉ bỏ các từ nối không gây nhầm.
 */
const STOP_ACCENTED = new Set([
  'là', 'và', 'của', 'các', 'những', 'một', 'có', 'được', 'trong', 'cho', 'với', 'này', 'đó', 'khi', 'thì', 'ra', 'đã', 'không', 'nào', 'gì', 'sao', 'tại', 'ở', 'bị', 'cũng', 'như', 'vì', 'nên', 'để',
  'hay', 'hoặc', 'em', 'ơi', 'hỏi', 'biết', 'ai', 'bao', 'nhiêu', 'thế', 'từ', 'đến', 'về', 'người', 'kể', 'nói', 'giúp', 'xin', 'mình', 'tôi', 'bạn', 'hơn', 'rất', 'sẽ', 'đang', 'còn', 'lại', 'làm',
  'thấy', 'à', 'nhé', 'vậy', 'mà', 'nếu', 'trên', 'dưới', 'sau', 'trước', 'lúc', 'năm', 'ngày', 'tháng', 'hãy', 'cần', 'muốn', 'thử',
]);
const STOP_PLAIN = new Set(['la', 'va', 'cua', 'cac', 'nhung', 'mot', 'duoc', 'trong', 'cho', 'voi', 'nay', 'khi', 'thi', 'khong', 'nao', 'tai', 'nhu', 'nen', 'hay', 'hoac', 'em', 'hoi', 'biet', 'bao', 'nhieu', 'the', 'sao', 'gi', 'ai']);

export const fold = (s: string): string => searchText(s);

/** Tách chữ gốc thành các từ đã bỏ dấu, kèm cờ "từ nối" */
function split(text: string): Array<{ w: string; raw: string; accented: boolean; stop: boolean }> {
  return text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((raw) => {
    const w = fold(raw);
    const accented = w !== raw;
    return { w, raw, accented, stop: STOP_ACCENTED.has(raw) || (!accented && STOP_PLAIN.has(raw)) };
  });
}

/** Các từ đơn (không dấu, bỏ từ nối) của một chuỗi, để so khớp từ khóa */
export function words(text: string): string[] {
  return split(text).filter((t) => !t.stop && t.w).map((t) => t.w);
}

/**
 * Mã tra cứu của văn bản đưa vào chỉ mục: từ đơn không dấu, từ đơn giữ dấu (tiền tố "a:") và cặp từ liền nhau (cả hai đều là từ nội dung).
 * Câu hỏi gõ CÓ dấu chỉ khớp từ có dấu (nên "phở" không khớp "phó"), câu hỏi gõ không dấu khớp mọi biến thể.
 */
export function tokens(text: string): string[] {
  const all = split(text).filter((t) => t.w);
  const out: string[] = [];
  for (const t of all) if (!t.stop) { out.push(t.w); if (t.accented) out.push(`a:${t.raw}`); }
  for (let i = 0; i + 1 < all.length; i += 1) if (!all[i].stop && !all[i + 1].stop) out.push(`${all[i].w}_${all[i + 1].w}`);
  return out;
}

/** Mã tra cứu của câu hỏi: từ đơn (có dấu thì dùng dạng có dấu) và cặp từ không dấu; `uni` là các từ đơn dùng tính độ phủ */
export function queryKeys(text: string): { keys: string[]; uni: string[] } {
  const all = split(text).filter((t) => t.w);
  const uni = [...new Set(all.filter((t) => !t.stop).map((t) => (t.accented ? `a:${t.raw}` : t.w)))];
  const keys = [...uni];
  for (let i = 0; i + 1 < all.length; i += 1) if (!all[i].stop && !all[i + 1].stop) keys.push(`${all[i].w}_${all[i + 1].w}`);
  return { keys: [...new Set(keys)], uni };
}

// ---------------------------------------------------------------------- chia đoạn
export const CHUNK_CHARS = 650;

/** Tách thành câu (giữ dấu câu); câu quá dài bị cắt ở dấu phẩy hoặc khoảng trắng */
export function sentences(text: string): string[] {
  const raw = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?;:…])\s+(?=[A-ZÀ-Ỹ0-9"“(])/u);
  const out: string[] = [];
  for (const s of raw) {
    if (s.length <= CHUNK_CHARS) { if (s) out.push(s); continue; }
    let rest = s;
    while (rest.length > CHUNK_CHARS) {
      let cut = rest.lastIndexOf(', ', CHUNK_CHARS);
      if (cut < CHUNK_CHARS / 3) cut = rest.lastIndexOf(' ', CHUNK_CHARS);
      if (cut < 1) cut = CHUNK_CHARS;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/** Ghép câu thành đoạn tối đa ~650 ký tự, đoạn sau lặp lại câu cuối của đoạn trước để không mất mạch */
export function chunkText(text: string): string[] {
  const sents = sentences(text);
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const s of sents) {
    if (len + s.length > CHUNK_CHARS && cur.length) {
      chunks.push(cur.join(' '));
      const keep = cur[cur.length - 1];
      cur = keep.length < CHUNK_CHARS / 3 ? [keep] : [];
      len = cur.reduce((n, x) => n + x.length + 1, 0);
    }
    cur.push(s);
    len += s.length + 1;
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks;
}

export const hashOf = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 32);

// ---------------------------------------------------------------------- xếp hạng
export interface Indexed { id: number; tf: Map<string, number>; len: number }
export interface Corpus { docs: Indexed[]; df: Map<string, number>; avgLen: number }

export function buildCorpus(texts: Array<{ id: number; text: string }>): Corpus {
  const docs: Indexed[] = [];
  const df = new Map<string, number>();
  for (const t of texts) {
    const tf = new Map<string, number>();
    const toks = tokens(t.text);
    for (const w of toks) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    docs.push({ id: t.id, tf, len: toks.length });
  }
  const avgLen = docs.length ? docs.reduce((n, d) => n + d.len, 0) / docs.length : 1;
  return { docs, df, avgLen: avgLen || 1 };
}

const K1 = 1.2;
const B = 0.75;
export interface Hit { id: number; bm25: number; coverage: number }

/**
 * BM25 và "độ phủ": phần trọng số (idf) của các từ trong câu hỏi mà đoạn tư liệu có. Từ không hề có trong kho tư liệu được tính trọng số lớn nhất nên câu hỏi
 * ngoài phạm vi (bóng đá, game…) có độ phủ thấp dù vài từ phổ thông trùng khớp.
 */
export function rank(corpus: Corpus, query: string): Hit[] {
  const { keys: q, uni: uniList } = queryKeys(query);
  const uni = new Set(uniList);
  if (!q.length || !corpus.docs.length) return [];
  const n = corpus.docs.length;
  const idf = (w: string): number => { const d = corpus.df.get(w); return d ? Math.log(1 + (n - d + 0.5) / (d + 0.5)) : Math.log(1 + n); };
  const total = [...uni].reduce((sum, w) => sum + (corpus.df.has(w) ? idf(w) : 0.7 * idf(w)), 0) || 1;
  const hits: Hit[] = [];
  for (const d of corpus.docs) {
    let bm25 = 0, matched = 0;
    for (const w of q) {
      const f = d.tf.get(w);
      if (!f) continue;
      const i = idf(w);
      if (uni.has(w)) matched += i;
      bm25 += i * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / corpus.avgLen)));
    }
    if (bm25 > 0) hits.push({ id: d.id, bm25, coverage: Math.min(1, matched / total) });
  }
  return hits.sort((a, b) => b.bm25 - a.bm25);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Trộn nhiều bảng xếp hạng theo thứ hạng (Reciprocal Rank Fusion) */
export function fuse(lists: number[][], k = 60): Map<number, number> {
  const out = new Map<number, number>();
  for (const list of lists) list.forEach((id, i) => out.set(id, (out.get(id) ?? 0) + 1 / (k + i + 1)));
  return out;
}

// ---------------------------------------------------------------------- an toàn nội dung (HK.SYS.010)
/**
 * Từ ngữ không phù hợp lứa tuổi. Từ có sẵn so khớp theo chữ CÓ dấu và ranh giới từ để không chặn nhầm "lớn", "các", "buổi", "từ từ";
 * từ quản trị bổ sung so khớp không dấu.
 */
const BUILTIN_BANNED = ['địt', 'đụ', 'đéo', 'lồn', 'cặc', 'buồi', 'đm', 'đmm', 'dcm', 'vcl', 'vkl', 'khiêu dâm', 'porn', 'sex', 'ma túy', 'tự tử', 'tự sát', 'giết người', 'chế tạo bom', 'làm bom', 'dit me', 'dit con me'];
const INJECTION = /(bo qua|quen) (moi |tat ca )?(huong dan|chi dan|quy tac|lenh)|ignore (all |the )?(previous|above|prior)|system prompt|prompt he thong|developer mode|jailbreak/;
const hasTerm = (text: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text);
};

export function unsafeReason(text: string, extra: string[] = []): 'unsafe' | 'injection' | null {
  if (BUILTIN_BANNED.some((t) => hasTerm(text.toLowerCase(), t))) return 'unsafe';
  const f = fold(text).replace(/[^a-z0-9]+/g, ' ').trim();
  for (const t of extra) {
    const term = fold(t).replace(/[^a-z0-9]+/g, ' ').trim();
    if (term && hasTerm(f, term)) return 'unsafe';
  }
  return INJECTION.test(f) ? 'injection' : null;
}

// ---------------------------------------------------------------------- khóa API
const keyOf = (secret: string): Buffer => createHash('sha256').update(`ai-key:${secret}`).digest();

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}

/** Trả null nếu khóa mã hóa đã đổi (AUTH_SECRET_KEY khác) hoặc dữ liệu hỏng; khi đó phải nhập lại khóa */
export function decryptSecret(blob: string | null, secret: string): string | null {
  if (!blob) return null;
  try {
    const [v, iv, tag, body] = blob.split('.');
    if (v !== 'v1') return null;
    const d = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Số đoạn [n] được nhắc trong câu trả lời (theo thứ tự xuất hiện) */
export function citedNumbers(answer: string, max: number): number[] {
  const seen: number[] = [];
  for (const m of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= max && !seen.includes(n)) seen.push(n);
  }
  return seen;
}
