/**
 * Bộ Giải nén & Bóc tách Đề thi Tổng quát từ File Word (.docx) / Text / Bảng tính
 * Hoạt động độc lập 100% với mọi file .docx bất kỳ do người dùng tải lên (không cần biết trước nội dung):
 * 1. Giải nén trực tiếp `word/document.xml`, `word/_rels/document.xml.rels` và ảnh `word/media/*` bằng Web Streams API (không bao giờ bị treo backpressure).
 * 2. Nhận diện cả dấu hiệu định dạng inline trong Word (gạch chân <w:u>, tô màu <w:color>, tô sáng <w:highlight> tại chữ cái A/B/C/D hoặc a/b/c/d)
 *    lẫn Bảng đáp án ở cuối tài liệu (nếu có).
 * 3. Tự động nhận diện các Khối Tiêu đề nhóm (PHẦN I, PHẦN II...) và 9 dạng câu hỏi chuẩn 2048.vn:
 *    - Trắc nghiệm (mcq)
 *    - Đúng sai (truefalse_4)
 *    - Trả lời ngắn (short_answer)
 *    - Tự luận (essay)
 *    - Điền vào chỗ trống (blank)
 *    - Kéo và thả (drag_drop)
 *    - Danh sách thả xuống (dropdown)
 *    - Đoạn văn (paragraph)
 *    - Tiêu đề nhóm (title_group)
 */

export type ExamQuestionType =
  | 'mcq'
  | 'truefalse_4'
  | 'short_answer'
  | 'essay'
  | 'blank'
  | 'drag_drop'
  | 'dropdown'
  | 'paragraph'
  | 'title_group';

export type BloomLevel = 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';

export interface AiQualityWarning {
  id: string;
  kind: 'duplicate_options' | 'historical_fact' | 'missing_explanation' | 'missing_answer';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  autoFixPatch?: Partial<ParsedExamQuestion>;
}

export interface ParsedExamQuestion {
  uid: string;
  globalIndex: number;
  localIndex: number;
  section: string;
  subSection: string;
  qtype: ExamQuestionType;
  subject: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  correctIndices?: number[];
  multiSelect?: boolean;
  tfStatements: string[];
  tfCorrect: boolean[];
  shortAnswer: string;
  points: number;
  seconds: number;
  bloomLevel: BloomLevel;
  unitTitle: string;
  explanation: string;
  hidden?: boolean;
  imageUrl?: string | null;
  audioUrl?: string | null;
  warnings: AiQualityWarning[];
}

export interface ParsedExamDocument {
  title: string;
  subtitle: string;
  subject: string;
  grade: string;
  durationMinutes: number;
  questions: ParsedExamQuestion[];
  totalPoints: number;
  stats: {
    mcqCount: number;
    tfCount: number;
    shortCount: number;
    essayCount: number;
    historyCount: number;
    geoCount: number;
    bloomCounts: Record<BloomLevel, number>;
    warningsCount: number;
  };
}

export interface MixedExamVariant {
  code: string;
  title: string;
  questions: ParsedExamQuestion[];
  answerKey: Array<{
    questionNumber: number;
    qtype: ExamQuestionType;
    answerText: string;
    points: number;
  }>;
}

// ============================================================================
// 1. GIẢI NÉN FILE .DOCX (ZIP + XML + MEDIA IMAGES) KHÔNG BỊ DEADLOCK STREAM
// ============================================================================

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    // QUAN TRỌNG: Phải khởi tạo reader (Response.arrayBuffer) TRƯỚC khi write để tránh deadlock backpressure khi XML > 16KB
    const readPromise = new Response(ds.readable).arrayBuffer();
    const writer = ds.writable.getWriter();
    writer.write(compressed as unknown as BufferSource).catch(() => {});
    writer.close().catch(() => {});
    const ab = await readPromise;
    return new Uint8Array(ab);
  }
  throw new Error('Trình duyệt không hỗ trợ giải nén trực tiếp.');
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return '';
}

interface ZipEntryMap {
  [fileName: string]: Uint8Array;
}

async function extractZipEntries(buffer: ArrayBuffer | Uint8Array): Promise<ZipEntryMap> {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntryMap = {};

  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, uint8.length - 65557);
  for (let i = uint8.length - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const cdEntries = view.getUint16(eocdOffset + 10, true);
    let cdOffset = view.getUint32(eocdOffset + 16, true);

    for (let e = 0; e < cdEntries && cdOffset + 46 <= uint8.length; e++) {
      if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
      const compression = view.getUint16(cdOffset + 10, true);
      const compressedSize = view.getUint32(cdOffset + 20, true);
      const fileNameLen = view.getUint16(cdOffset + 28, true);
      const extraLen = view.getUint16(cdOffset + 30, true);
      const commentLen = view.getUint16(cdOffset + 32, true);
      const localHeaderOffset = view.getUint32(cdOffset + 42, true);

      const fileName = decoder.decode(uint8.subarray(cdOffset + 46, cdOffset + 46 + fileNameLen));
      if (
        fileName === 'word/document.xml' ||
        fileName === 'word/_rels/document.xml.rels' ||
        fileName.startsWith('word/media/') ||
        fileName === 'xl/sharedStrings.xml' ||
        fileName === 'xl/worksheets/sheet1.xml'
      ) {
        const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
        const compressedData = uint8.subarray(dataStart, dataStart + compressedSize);
        if (compression === 0) {
          entries[fileName] = compressedData;
        } else if (compression === 8) {
          entries[fileName] = await inflateRawBytes(compressedData);
        }
      }

      cdOffset += 46 + fileNameLen + extraLen + commentLen;
    }
    if (entries['word/document.xml'] || entries['xl/worksheets/sheet1.xml']) {
      return entries;
    }
  }

  // Fallback quét Local File Header tuần tự
  let offset = 0;
  while (offset + 30 <= uint8.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const fileName = decoder.decode(uint8.subarray(offset + 30, offset + 30 + fileNameLen));
    const dataStart = offset + 30 + fileNameLen + extraLen;
    if (compressedSize === 0) break;
    const compressedData = uint8.subarray(dataStart, dataStart + compressedSize);

    if (
      fileName === 'word/document.xml' ||
      fileName === 'word/_rels/document.xml.rels' ||
      fileName.startsWith('word/media/')
    ) {
      entries[fileName] = compression === 0 ? compressedData : await inflateRawBytes(compressedData);
    }
    offset = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Đọc `word/document.xml` từ bộ đệm nhị phân của bất kỳ tệp `.docx` nào
 */
export async function extractXmlFromDocxBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const entries = await extractZipEntries(buffer);
  const docBytes = entries['word/document.xml'];
  if (!docBytes) {
    throw new Error('Không tìm thấy cấu trúc văn bản word/document.xml trong tệp .docx');
  }
  return new TextDecoder('utf-8').decode(docBytes);
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Chuyển đổi XML của Word thành văn bản từng đoạn văn (`<w:p>`).
 * Nhận diện:
 * - Gạch chân `<w:u>`, tô màu `<w:color>`, highlight `<w:highlight>` trên chữ cái A/B/C/D hoặc a/b/c/d -> gắn dấu `*` (ví dụ `*D.`, `*b)`)
 * - Hình ảnh đính kèm `<a:blip r:embed="rId..."/>` -> gắn thẻ `[IMAGE:rId...]`
 */
export function convertDocxXmlToText(xml: string): string {
  const paragraphs: string[] = [];
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    const tokenRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>|<a:blip[^>]*r:embed="([^"]+)"[^>]*\/?>|<v:imagedata[^>]*r:id="([^"]+)"[^>]*\/?>/g;
    let rMatch: RegExpExecArray | null;
    let lineText = '';
    const imageIds: string[] = [];

    while ((rMatch = tokenRegex.exec(pContent)) !== null) {
      const fullToken = rMatch[0];
      if (fullToken.startsWith('<w:tab')) {
        lineText += ' ';
      } else if (fullToken.startsWith('<w:br')) {
        lineText += '\n';
      } else if (rMatch[2] || rMatch[3]) {
        imageIds.push(rMatch[2] || rMatch[3]);
      } else if (rMatch[1] !== undefined) {
        const runXml = rMatch[1];

        // Kiểm tra ảnh nằm bên trong <w:r>
        const blipMatch = runXml.match(/r:(?:embed|id)="([^"]+)"/);
        if (blipMatch && (runXml.includes('<a:blip') || runXml.includes('<v:imagedata'))) {
          imageIds.push(blipMatch[1]);
        }

        const hasUnderline = /<w:u(?:\s+w:val="(?!none)[^"]*")?\s*\/?>/i.test(runXml);
        const hasHighlight = /<w:highlight(?:\s+w:val="(?!none)[^"]*")?\s*\/?>/i.test(runXml);
        const hasColor = /<w:color\s+w:val="(?!000000|auto)[0-9A-Fa-f]{6}"[^>]*\/?>/i.test(runXml);
        const isMarked = hasUnderline || hasHighlight || hasColor;

        const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
        let tMatch: RegExpExecArray | null;
        let runStr = '';
        while ((tMatch = tRegex.exec(runXml)) !== null) {
          runStr += decodeXmlEntities(tMatch[1]);
        }

        if (isMarked && runStr) {
          const trimmed = runStr.trim();
          // Trường hợp 1: Run chỉ chứa ký tự đáp án "A", "B.", "a", "b)"
          if (/^[A-Da-d](?:[.:)])?$/.test(trimmed)) {
            const leadingSpace = /^\s/.test(runStr) ? ' ' : '';
            const trailingSpace = /\s$/.test(runStr) ? ' ' : '';
            lineText += `${leadingSpace}*${trimmed}${trailingSpace}`;
          } else if (/^\s*[A-Da-d][.:)]\s+/.test(runStr)) {
            // Trường hợp 2: Run chứa cả chữ cái và nội dung phương án được gạch chân/tô màu
            lineText += runStr.replace(/^(\s*)([A-Da-d][.:)])/, '$1*$2');
          } else {
            lineText += runStr;
          }
        } else {
          lineText += runStr;
        }
      }
    }

    // Chuẩn hóa trường hợp "*D ." -> "*D.", "*b )" -> "*b)", hoặc "D*." -> "*D."
    const normalized = lineText
      .replace(/\u00A0/g, ' ')
      .replace(/(\*[A-Da-d])\s+([.:)])/g, '$1$2')
      .replace(/\b([A-Da-d])\*\s*([.:)])/g, '*$1$2')
      .trim();

    if (normalized) {
      paragraphs.push(normalized);
    }
    for (const rId of imageIds) {
      paragraphs.push(`[IMAGE:${rId}]`);
    }
  }

  return paragraphs.join('\n');
}

// ============================================================================
// 2. BỘ PHÂN TÁCH PHƯƠNG ÁN & BÓC TÁCH ĐỀ THI TỔNG QUÁT CHO MỌI FILE WORD
// ============================================================================

export function splitFourOptionsWithCorrectFlag(rawText: string): {
  options: string[];
  markedCorrectIndex: number | null;
} | null {
  const labels = ['A', 'B', 'C', 'D'];
  const indices: Array<{
    label: string;
    markerStart: number;
    contentStart: number;
    isMarkedCorrect: boolean;
  }> = [];
  let searchFrom = 0;

  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    const re = new RegExp('(?:^|[\\s.;])(\\*?' + lbl + ')\\s*[.:)]\\s*', 'g');
    re.lastIndex = searchFrom;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const token = m[1];
      const prefixLen = m[0].indexOf(token);
      const markerStart = m.index + prefixLen;
      const contentStart = re.lastIndex;
      if (i === 0 || markerStart - indices[i - 1].contentStart >= 1) {
        indices.push({
          label: lbl,
          markerStart,
          contentStart,
          isMarkedCorrect: token.startsWith('*'),
        });
        searchFrom = contentStart;
        break;
      }
    }
  }

  if (indices.length >= 2) {
    let markedCorrectIndex: number | null = null;
    const options = indices.map((item, idx) => {
      if (item.isMarkedCorrect) markedCorrectIndex = idx;
      const end = idx + 1 < indices.length ? indices[idx + 1].markerStart : rawText.length;
      return rawText.slice(item.contentStart, end).trim();
    });
    return { options, markedCorrectIndex };
  }
  return null;
}

export function splitFourOptionsFromLine(rawText: string): string[] | null {
  const res = splitFourOptionsWithCorrectFlag(rawText);
  return res ? res.options : null;
}

export function auditQuestionQuality(q: ParsedExamQuestion): AiQualityWarning[] {
  const warnings: AiQualityWarning[] = [];
  if (q.qtype === 'mcq' && q.options.length >= 2) {
    const normalized = q.options.map((o) => o.trim().toLowerCase().replace(/[.;]+$/, ''));
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (normalized[i] && normalized[i] === normalized[j]) {
          const letterA = String.fromCharCode(65 + i);
          const letterB = String.fromCharCode(65 + j);
          const fixedOptions = [...q.options];
          fixedOptions[i === q.correctIndex ? j : i] = `${q.options[j].replace(/\.$/, '')} (Phương án khác).`;
          warnings.push({
            id: `${q.uid}-dup-${i}-${j}`,
            kind: 'duplicate_options',
            severity: 'error',
            message: `Phương án ${letterA} và ${letterB} trùng nội dung: "${q.options[i]}"`,
            suggestion: `Nên chỉnh lại một trong hai phương án.`,
            autoFixPatch: { options: fixedOptions },
          });
        }
      }
    }
  }
  return warnings;
}

/**
 * Hàm bóc tách tổng quát mọi cấu trúc Đề thi Word / Text bất kỳ
 */
export function parseExamDocumentText(
  rawText: string,
  fileName = '',
  mediaMap: Record<string, string> = {},
): ParsedExamDocument {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  let title = fileName ? fileName.replace(/\.(docx|pdf|xlsx|txt|csv)$/i, '') : 'Đề kiểm tra mới';
  const subtitle = '';
  let subject = 'Tổng hợp';
  const grade = '';
  let durationMinutes = 45;

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const l = lines[i];
    if (/^(ĐỀ\s+(KIỂM TRA|THI|ÔN TẬP)|BÀI\s+KIỂM\s+TRA)/i.test(l) && !fileName) {
      title = l;
    }
    const subjMatch = l.match(/^Môn(?:\s+học)?\s*[:\-–]\s*(.+)$/i);
    if (subjMatch && subjMatch[1].trim() !== '…' && subjMatch[1].trim() !== '...') {
      subject = subjMatch[1].trim();
    }
    const timeMatch = l.match(/Thời gian[^:\d]*[:\-–]?\s*(\d+)\s*phút/i);
    if (timeMatch) {
      durationMinutes = Number(timeMatch[1]) || 45;
    }
  }

  // 1. Xác định điểm kết thúc phần câu hỏi (nếu có chữ HẾT, ĐÁP ÁN, HƯỚNG DẪN CHẤM, MA TRẬN)
  let endExamIdx = lines.findIndex(
    (l) =>
      /^-{2,}\s*HẾT/i.test(l) ||
      /^\.*HẾT\.*$/i.test(l) ||
      /^ĐÁP ÁN[\s,.:]/i.test(l) ||
      /^ĐÁP ÁN$/i.test(l) ||
      /^BẢNG ĐÁP ÁN/i.test(l) ||
      /^HƯỚNG DẪN CHẤM/i.test(l),
  );
  if (endExamIdx === -1) endExamIdx = lines.length;

  const ansStartIdx = lines.findIndex(
    (l, idx) =>
      idx >= Math.max(0, endExamIdx - 2) &&
      (/^ĐÁP ÁN/i.test(l) || /^BẢNG ĐÁP ÁN/i.test(l) || /^HƯỚNG DẪN CHẤM/i.test(l)),
  );

  const matrixStartIdx = lines.findIndex(
    (l, idx) =>
      idx >= (ansStartIdx !== -1 ? ansStartIdx : 0) &&
      (/^MA TRẬN/i.test(l) || /^BẢNG ĐẶC TẢ/i.test(l) || /^BẢN ĐẶC TẢ/i.test(l)),
  );

  const bodyLines = lines.slice(0, endExamIdx);
  const answerLines =
    ansStartIdx !== -1
      ? lines.slice(ansStartIdx, matrixStartIdx !== -1 ? matrixStartIdx : lines.length)
      : [];

  // 2. Bóc tách Bảng đáp án cuối file
  const mcqAnswers: Record<number, number> = {};
  const tfAnswers: Record<number, boolean[]> = {};
  const shortAnswers: Record<number, string> = {};
  const essayRubrics: Record<number, string> = {};

  if (answerLines.length > 0) {
    let ansSection: 'mcq' | 'tf' | 'short' | 'essay' = 'mcq';
    const numBuffer: number[] = [];
    const letterBuffer: number[] = [];
    let currentTfQ: number | null = null;
    let currentEssayQ: number | null = null;

    for (let i = 0; i < answerLines.length; i++) {
      const line = answerLines[i];
      if (/nhiều lựa chọn|nhiều phương án|trắc nghiệm khách quan/i.test(line)) {
        ansSection = 'mcq';
        continue;
      }
      if (/đúng\s*[-–/]?\s*sai/i.test(line)) {
        ansSection = 'tf';
        continue;
      }
      if (/trả lời ngắn|điền khuyết/i.test(line)) {
        ansSection = 'short';
        continue;
      }
      if (/^(II\.|PHẦN II|2\.|B\.)\s*Tự luận/i.test(line)) {
        ansSection = 'essay';
        continue;
      }

      if (ansSection === 'mcq') {
        const inlineMatches = [...line.matchAll(/(?:Câu\s*)?(\d+)\s*[.:\-–)\s]\s*([A-D])\b/gi)];
        if (inlineMatches.length > 0) {
          for (const m of inlineMatches) {
            mcqAnswers[Number(m[1])] = m[2].toUpperCase().charCodeAt(0) - 65;
          }
        } else {
          const cellNumMatch = line.match(/^(?:Câu\s*)?(\d+)\.?$/i);
          if (cellNumMatch) {
            numBuffer.push(Number(cellNumMatch[1]));
          } else if (/^[A-D]\.?$/i.test(line)) {
            letterBuffer.push(line[0].toUpperCase().charCodeAt(0) - 65);
          }
        }
      } else if (ansSection === 'tf') {
        const qMatch = line.match(/^Câu\s*(\d+)/i);
        if (qMatch) {
          currentTfQ = Number(qMatch[1]);
          if (!tfAnswers[currentTfQ]) tfAnswers[currentTfQ] = [];
          const dsMatches = [...line.matchAll(/\b(Đúng|Sai)\b/gi)];
          for (const dm of dsMatches) {
            if (tfAnswers[currentTfQ].length < 4) {
              tfAnswers[currentTfQ].push(/^đúng$/i.test(dm[1]));
            }
          }
          // Hỗ trợ định dạng "a-Đ, b-S, c-Đ, d-S"
          if (tfAnswers[currentTfQ].length === 0) {
            const shortTfMatches = [...line.matchAll(/[a-d]\s*[:\-–.)]\s*(Đ|S)\b/gi)];
            for (const sm of shortTfMatches) {
              if (tfAnswers[currentTfQ].length < 4) {
                tfAnswers[currentTfQ].push(sm[1].toUpperCase() === 'Đ');
              }
            }
          }
        } else if (currentTfQ !== null && /^(?:[a-d][).:\-–\s]+)?(Đúng|Sai)$/i.test(line)) {
          if (tfAnswers[currentTfQ].length < 4) {
            tfAnswers[currentTfQ].push(/đúng/i.test(line));
          }
        }
      } else if (ansSection === 'short') {
        const sMatch = line.match(/^(?:Câu\s*)?(\d+)\s*[:.)\-–]\s*(.+)$/i);
        if (sMatch) {
          shortAnswers[Number(sMatch[1])] = sMatch[2].trim();
        }
      } else if (ansSection === 'essay') {
        const eMatch = line.match(/^Câu\s*(\d+)/i);
        if (eMatch) {
          currentEssayQ = Number(eMatch[1]);
          essayRubrics[currentEssayQ] = '';
        } else if (
          currentEssayQ !== null &&
          !/^\d+[,.]\d+\s*đ$/i.test(line) &&
          !/^(Câu|Nội dung|Điểm)/i.test(line)
        ) {
          essayRubrics[currentEssayQ] =
            (essayRubrics[currentEssayQ] ? essayRubrics[currentEssayQ] + '\n' : '') + line;
        }
      }
    }

    if (numBuffer.length > 0 && letterBuffer.length === numBuffer.length) {
      numBuffer.forEach((qNum, idx) => {
        mcqAnswers[qNum] = letterBuffer[idx];
      });
    }
  }

  // 3. Bóc tách danh sách câu hỏi từ bất kỳ cấu trúc file Word nào
  const questions: ParsedExamQuestion[] = [];
  let currentSection = 'PHẦN I. TRẮC NGHIỆM (7,0 điểm)';
  let currentSubSection = '';
  let subMode: 'mcq' | 'tf' | 'short' | 'essay' = 'mcq';

  interface WorkingQuestion extends ParsedExamQuestion {
    rawOptionLines: string[];
    inlineMarkedCorrect: number | null;
    tfStarredFlags: boolean[];
    hasAnyTfStar: boolean;
  }
  let curQ: WorkingQuestion | null = null;

  const flushQuestion = () => {
    if (!curQ) return;

    // Nếu câu hỏi đang ở chế độ mcq nhưng có đủ các mệnh đề a), b), c), d) và không có phương án A. B. C. D. -> Tự chuyển sang Đúng/Sai
    if (curQ.qtype === 'mcq' && curQ.tfStatements.length >= 2 && curQ.rawOptionLines.length === 0) {
      curQ.qtype = 'truefalse_4';
    }

    if (curQ.qtype === 'mcq') {
      const combinedOpts = curQ.rawOptionLines.join(' ');
      const splitRes = splitFourOptionsWithCorrectFlag(combinedOpts);
      if (splitRes && splitRes.options.length >= 2) {
        curQ.options = splitRes.options.slice(0, 4);
        while (curQ.options.length < 4) curQ.options.push('');
        if (splitRes.markedCorrectIndex !== null) {
          curQ.inlineMarkedCorrect = splitRes.markedCorrectIndex;
        }
      } else if (curQ.rawOptionLines.length >= 2) {
        curQ.options = curQ.rawOptionLines.slice(0, 4).map((l, idx) => {
          if (/^\*[A-D]\s*[.:)]/i.test(l)) curQ!.inlineMarkedCorrect = idx;
          return l.replace(/^\*?[A-D]\s*[.:)]\s*/i, '').trim();
        });
        while (curQ.options.length < 4) curQ.options.push('');
      } else if (curQ.tfStatements.length === 0 && curQ.rawOptionLines.length === 0) {
        curQ.qtype = subMode === 'short' ? 'short_answer' : 'essay';
      }

      if (curQ.inlineMarkedCorrect !== null) {
        curQ.correctIndex = curQ.inlineMarkedCorrect;
      } else {
        const keyAns = mcqAnswers[curQ.localIndex] ?? mcqAnswers[questions.length + 1];
        if (typeof keyAns === 'number') {
          curQ.correctIndex = keyAns;
        }
      }
      curQ.correctIndices = [curQ.correctIndex];
    } else if (curQ.qtype === 'truefalse_4') {
      while (curQ.tfStatements.length < 4) {
        curQ.tfStatements.push(`Mệnh đề ${String.fromCharCode(97 + curQ.tfStatements.length)}`);
      }
      if (curQ.hasAnyTfStar) {
        curQ.tfCorrect = [0, 1, 2, 3].map((i) => Boolean(curQ!.tfStarredFlags[i]));
      } else {
        const tfAns = tfAnswers[curQ.localIndex];
        if (tfAns && tfAns.length === 4) {
          curQ.tfCorrect = tfAns;
        }
      }
    } else if (curQ.qtype === 'short_answer') {
      const sAns = shortAnswers[curQ.localIndex];
      if (sAns) {
        curQ.shortAnswer = sAns;
        curQ.explanation = `Đáp án: ${sAns}`;
      }
    } else if (curQ.qtype === 'essay') {
      if (essayRubrics[curQ.localIndex]) {
        curQ.explanation = essayRubrics[currentEssayIndex(curQ.localIndex)];
      }
    }

    const { rawOptionLines: _, inlineMarkedCorrect: __, tfStarredFlags: ___, hasAnyTfStar: ____, ...cleanQ } = curQ;
    cleanQ.warnings = auditQuestionQuality(cleanQ);
    questions.push(cleanQ);
    curQ = null;
  };

  function currentEssayIndex(idx: number): number {
    return idx;
  }

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];

    // Xử lý thẻ [IMAGE:rId...] đính kèm vào câu hỏi hiện tại
    const imgMatch = line.match(/^\[IMAGE:([^\]]+)\]$/);
    if (imgMatch) {
      const rId = imgMatch[1];
      if (curQ && mediaMap[rId]) {
        curQ.imageUrl = mediaMap[rId];
      }
      continue;
    }

    // Bỏ qua các dòng tiêu đề hành chính đầu trang (Khối, Môn, Họ tên thí sinh, Số báo danh, đường kẻ ---)
    if (
      !curQ &&
      (/^(Khối|Môn|Thời gian làm bài|Họ\s*(và\s*)?tên|Số báo danh|Lớp|Trường|Điểm|Lời phê)/i.test(line) ||
        /^[-_.…]{4,}$/.test(line))
    ) {
      continue;
    }

    // Nhận diện tiêu đề Phần lớn (PHẦN I, PHẦN II, PHẦN III, A. TRẮC NGHIỆM, B. TỰ LUẬN, I. TRẮC NGHIỆM, II. TỰ LUẬN)
    if (/^(PHẦN\s+[IVX1-9]+|[AB]\.\s*(TRẮC NGHIỆM|TỰ LUẬN)|[IVX]+\.\s*(PHẦN\s*)?(TRẮC NGHIỆM|TỰ LUẬN))/i.test(line)) {
      flushQuestion();
      currentSection = line;
      if (/tự luận/i.test(line)) {
        subMode = 'essay';
      } else if (/đúng\s*[-–/]?\s*sai/i.test(line)) {
        subMode = 'tf';
      } else if (/trả lời ngắn|điền khuyết/i.test(line)) {
        subMode = 'short';
      } else {
        subMode = 'mcq';
      }
      continue;
    }

    // Nhận diện tiểu mục trong PHẦN I (1. Phần trắc nghiệm nhiều lựa chọn, 2. Phần trắc nghiệm đúng - sai, 3. Phần trắc nghiệm trả lời ngắn)
    if (/^\d+\.\s*(Phần\s*)?trắc nghiệm nhiều (lựa chọn|phương án)/i.test(line)) {
      flushQuestion();
      currentSubSection = line;
      subMode = 'mcq';
      continue;
    }
    if (/^\d+\.\s*(Phần\s*)?trắc nghiệm đúng\s*[-–/]?\s*sai/i.test(line)) {
      flushQuestion();
      currentSubSection = line;
      subMode = 'tf';
      continue;
    }
    if (/^\d+\.\s*(Phần\s*)?(trắc nghiệm\s*)?trả lời ngắn/i.test(line)) {
      flushQuestion();
      currentSubSection = line;
      subMode = 'short';
      continue;
    }

    // Nhận diện bắt đầu một câu hỏi:
    // - "Câu 1.", "Câu 1:", "Câu 1 (Lịch sử).", "Question 1:", "Bài 1:"
    // - Hoặc câu đánh số trực tiếp "1. Nội dung...", "2. Nội dung..." (không phải tiểu mục "1. Phần...")
    const qStart =
      line.match(/^(?:Câu|Question|Bài)\s*(\d+)\s*(?:\(([^)]+)\))?\s*[.:)\-–]?\s*(.*)$/i) ||
      (!/^\d+\.\s*Phần\s/i.test(line) ? line.match(/^(\d{1,3})\s*(?:\(([^)]+)\))?\s*[.)]\s+([A-ZÀ-Ỹa-zà-ỹ(“"].*)$/) : null);

    if (qStart) {
      flushQuestion();
      const localIndex = Number(qStart[1]);
      const tagRaw = (qStart[2] || '').trim();
      let promptRest = (qStart[3] || '').trim();
      promptRest = promptRest.replace(/Trả lời\s*:\s*\.+$/i, '').trim();

      const fullPromptPrefix = tagRaw ? `(${tagRaw}). ${promptRest}` : promptRest;
      const qtype: ExamQuestionType =
        subMode === 'mcq'
          ? 'mcq'
          : subMode === 'tf'
          ? 'truefalse_4'
          : subMode === 'short'
          ? 'short_answer'
          : 'essay';

      let points = 1;
      if (qtype === 'mcq' && /0[,.]25\s*điểm/i.test(currentSubSection)) points = 0.25;
      if (qtype === 'short_answer' && /0[,.]5\s*điểm/i.test(currentSubSection)) points = 0.5;
      const ptMatch = tagRaw.match(/(\d+(?:[,.]\d+)?)\s*điểm/i);
      if (ptMatch) points = Number(ptMatch[1].replace(',', '.')) || 1;

      curQ = {
        uid: `q-${questions.length + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        globalIndex: questions.length + 1,
        localIndex,
        section: currentSection,
        subSection: currentSubSection,
        qtype,
        subject: tagRaw || subject,
        prompt: fullPromptPrefix,
        options: qtype === 'mcq' ? ['', '', '', ''] : [],
        correctIndex: 0,
        correctIndices: [0],
        multiSelect: false,
        tfStatements: [],
        tfCorrect: [true, false, true, false],
        shortAnswer: '',
        points,
        seconds: 0,
        bloomLevel: 'Nhận biết',
        unitTitle: '',
        explanation: '',
        warnings: [],
        rawOptionLines: [],
        inlineMarkedCorrect: null,
        tfStarredFlags: [],
        hasAnyTfStar: false,
      };
      continue;
    }

    if (curQ) {
      const inlineAnsMatch = line.match(/^(?:Đáp án|ĐA)\s*[:.]\s*([A-D])\b/i);
      if (inlineAnsMatch && curQ.qtype === 'mcq') {
        curQ.inlineMarkedCorrect = inlineAnsMatch[1].toUpperCase().charCodeAt(0) - 65;
        continue;
      }
      const inlineExpMatch = line.match(/^(?:Lời giải|Giải thích|Hướng dẫn)\s*[:.]\s*(.+)$/i);
      if (inlineExpMatch) {
        curQ.explanation = inlineExpMatch[1].trim();
        continue;
      }

      if (curQ.qtype === 'mcq') {
        // Kiểm tra nếu dòng là mệnh đề đúng/sai kiểu a) b) c) d)
        const tfLowerMatch = line.match(/^(\*?)([a-d])\)\s*(.+)$/);
        if (tfLowerMatch && curQ.rawOptionLines.length === 0) {
          const isStar = tfLowerMatch[1] === '*';
          if (isStar) curQ.hasAnyTfStar = true;
          curQ.tfStarredFlags.push(isStar);
          curQ.tfStatements.push(tfLowerMatch[3].trim());
        } else if (/^\*?[A-D]\s*[.:)]\s*/.test(line) || curQ.rawOptionLines.length > 0) {
          curQ.rawOptionLines.push(line);
        } else {
          curQ.prompt += (curQ.prompt ? ' ' : '') + line;
        }
      } else if (curQ.qtype === 'truefalse_4') {
        if (/^(Mệnh đề|Đúng|Sai)$/i.test(line)) continue;
        const stMatch = line.match(/^(\*?)([A-Da-d])\s*[.:)]\s*(.+)$/);
        if (stMatch) {
          const isStar = stMatch[1] === '*';
          if (isStar) curQ.hasAnyTfStar = true;
          curQ.tfStarredFlags.push(isStar);
          curQ.tfStatements.push(stMatch[3].trim());
        } else {
          curQ.prompt += (curQ.prompt ? '\n' : '') + line;
        }
      } else if (curQ.qtype === 'short_answer') {
        const cleaned = line.replace(/^Trả lời\s*:\s*\.+$/i, '').trim();
        if (cleaned) curQ.prompt += (curQ.prompt ? '\n' : '') + cleaned;
      } else if (curQ.qtype === 'essay') {
        curQ.prompt += (curQ.prompt ? '\n' : '') + line;
      }
    }
  }
  flushQuestion();

  // Fallback thông minh: Nếu tài liệu Word là đề cương / bài tập tự do không có tiền tố "Câu 1",
  // tự động gom các đoạn văn có nội dung thành câu hỏi để người dùng luôn mở được trình biên tập!
  if (questions.length === 0 && bodyLines.length > 0) {
    const meaningfulLines = bodyLines.filter(
      (l) => !/^\[IMAGE:/.test(l) && l.length > 3 && !/^[-_.…]{3,}$/.test(l),
    );
    const chunkSize = 4;
    for (let i = 0; i < meaningfulLines.length && questions.length < 30; i += chunkSize) {
      const chunk = meaningfulLines.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const idx = questions.length + 1;
      questions.push({
        uid: `q-auto-${idx}-${Date.now().toString(36)}`,
        globalIndex: idx,
        localIndex: idx,
        section: currentSection,
        subSection: '',
        qtype: 'essay',
        subject,
        prompt: chunk.join('\n'),
        options: [],
        correctIndex: 0,
        correctIndices: [0],
        multiSelect: false,
        tfStatements: [],
        tfCorrect: [true, false, true, false],
        shortAnswer: '',
        points: 1,
        seconds: 0,
        bloomLevel: 'Thông hiểu',
        unitTitle: '',
        explanation: '',
        warnings: [],
      });
    }
  }

  return computeExamStats({
    title,
    subtitle,
    subject,
    grade,
    durationMinutes,
    questions,
  });
}

export function computeExamStats(
  doc: Omit<ParsedExamDocument, 'totalPoints' | 'stats'>,
): ParsedExamDocument {
  const bloomCounts: Record<BloomLevel, number> = {
    'Nhận biết': 0,
    'Thông hiểu': 0,
    'Vận dụng': 0,
    'Vận dụng cao': 0,
  };
  let mcqCount = 0;
  let tfCount = 0;
  let shortCount = 0;
  let essayCount = 0;
  let historyCount = 0;
  let geoCount = 0;
  let warningsCount = 0;
  let totalPoints = 0;

  doc.questions.forEach((q, idx) => {
    q.globalIndex = idx + 1;
    q.warnings = auditQuestionQuality(q);
    totalPoints += Number(q.points) || 0;
    bloomCounts[q.bloomLevel] = (bloomCounts[q.bloomLevel] || 0) + 1;
    if (q.qtype === 'mcq') mcqCount++;
    else if (q.qtype === 'truefalse_4') tfCount++;
    else if (q.qtype === 'short_answer') shortCount++;
    else essayCount++;

    if (/địa/i.test(q.subject)) geoCount++;
    else historyCount++;

    warningsCount += q.warnings.filter((w) => w.severity !== 'info').length;
  });

  return {
    ...doc,
    totalPoints: Math.round(totalPoints * 100) / 100,
    stats: {
      mcqCount,
      tfCount,
      shortCount,
      essayCount,
      historyCount,
      geoCount,
      bloomCounts,
      warningsCount,
    },
  };
}

// ============================================================================
// 3. TRỘN ĐỀ THI TỰ ĐỘNG (MIX QUIZ VARIANTS) & XUẤT FILE WORD
// ============================================================================

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = Math.floor((s / 4294967296) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateMixedExamVariants(
  doc: ParsedExamDocument,
  codes: string[] = ['101', '102', '103', '104'],
  options: { shuffleQuestions: boolean; shuffleOptions: boolean } = {
    shuffleQuestions: true,
    shuffleOptions: true,
  },
): MixedExamVariant[] {
  return codes.map((code, cIdx) => {
    const baseSeed = Number(code) || (cIdx + 1) * 101;
    const mcqs = doc.questions.filter((q) => q.qtype === 'mcq');
    const tfs = doc.questions.filter((q) => q.qtype === 'truefalse_4');
    const shorts = doc.questions.filter((q) => q.qtype === 'short_answer');
    const essays = doc.questions.filter(
      (q) => q.qtype !== 'mcq' && q.qtype !== 'truefalse_4' && q.qtype !== 'short_answer',
    );

    const mixGroup = (group: ParsedExamQuestion[], groupSeedOffset: number) => {
      const ordered = options.shuffleQuestions
        ? seededShuffle(group, baseSeed + groupSeedOffset)
        : [...group];

      return ordered.map((q, qIdx) => {
        if (q.qtype === 'mcq' && options.shuffleOptions) {
          const pairs = q.options.map((text, idx) => ({
            text,
            isCorrect: idx === q.correctIndex,
          }));
          const shuffledPairs = seededShuffle(pairs, baseSeed + groupSeedOffset + qIdx * 31);
          return {
            ...q,
            localIndex: qIdx + 1,
            options: shuffledPairs.map((p) => p.text),
            correctIndex: Math.max(0, shuffledPairs.findIndex((p) => p.isCorrect)),
          };
        }
        return {
          ...q,
          localIndex: qIdx + 1,
        };
      });
    };

    const mixedQuestions = [
      ...mixGroup(mcqs, 10),
      ...mixGroup(tfs, 200),
      ...mixGroup(shorts, 300),
      ...mixGroup(essays, 400),
    ].map((q, idx) => ({ ...q, globalIndex: idx + 1 }));

    const answerKey = mixedQuestions.map((q) => {
      let answerText = '';
      if (q.qtype === 'mcq') {
        answerText = String.fromCharCode(65 + q.correctIndex);
      } else if (q.qtype === 'truefalse_4') {
        answerText = q.tfCorrect.map((v, i) => `${String.fromCharCode(65 + i)}-${v ? 'Đ' : 'S'}`).join(', ');
      } else if (q.qtype === 'short_answer') {
        answerText = q.shortAnswer || q.explanation;
      } else {
        answerText = 'Tự luận';
      }
      return {
        questionNumber: q.globalIndex,
        qtype: q.qtype,
        answerText,
        points: q.points,
      };
    });

    return {
      code,
      title: `${doc.title} — Mã đề ${code}`,
      questions: mixedQuestions,
      answerKey,
    };
  });
}

export function buildPrintableWordHtml(doc: ParsedExamDocument, variants: MixedExamVariant[]): string {
  const sectionsHtml = variants
    .map((v) => {
      const qHtml = v.questions
        .map((q) => {
          if (q.qtype === 'mcq') {
            const optsHtml = q.options
              .map((opt, idx) => `<td><b>${String.fromCharCode(65 + idx)}.</b> ${opt}</td>`)
              .join('');
            return `<p style="margin-bottom:4px;"><b>Câu ${q.globalIndex} (${q.points}đ):</b> ${q.prompt}</p>
            <table style="width:100%;margin-bottom:10px;border:none;"><tr>${optsHtml}</tr></table>`;
          }
          if (q.qtype === 'truefalse_4') {
            const rows = q.tfStatements
              .map(
                (st, idx) =>
                  `<tr><td style="border:1px solid #ccc;padding:4px;"><b>${String.fromCharCode(97 + idx)})</b> ${st}</td><td style="border:1px solid #ccc;padding:4px;text-align:center;width:60px;">[ &nbsp; ] Đúng</td><td style="border:1px solid #ccc;padding:4px;text-align:center;width:60px;">[ &nbsp; ] Sai</td></tr>`,
              )
              .join('');
            return `<p style="margin-bottom:4px;"><b>Câu ${q.globalIndex} (Đúng/Sai - ${q.points}đ):</b> ${q.prompt.replace(/\n/g, '<br/>')}</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">${rows}</table>`;
          }
          return `<p style="margin-bottom:8px;"><b>Câu ${q.globalIndex} (${q.points}đ):</b> ${q.prompt.replace(/\n/g, '<br/>')}<br/><i>Trả lời: ..........................................................................................................</i></p>`;
        })
        .join('\n');

      return `<div style="page-break-after:always;font-family:'Times New Roman',serif;font-size:13pt;line-height:1.4;">
        <h2 style="text-align:center;margin:0;">${doc.title.toUpperCase()}</h2>
        <p style="text-align:center;margin:4px 0;"><b>Thời gian: ${doc.durationMinutes} phút | MÃ ĐỀ: ${v.code}</b></p>
        <hr/>
        ${qHtml}
        <p style="text-align:center;font-weight:bold;">--- HẾT MÃ ĐỀ ${v.code} ---</p>
      </div>`;
    })
    .join('\n');

  const keyHtml = variants
    .map((v) => {
      const cells = v.answerKey
        .map(
          (k) =>
            `<tr><td style="border:1px solid #999;padding:4px;text-align:center;">Câu ${k.questionNumber}</td><td style="border:1px solid #999;padding:4px;"><b>${k.answerText}</b></td><td style="border:1px solid #999;padding:4px;text-align:center;">${k.points}đ</td></tr>`,
        )
        .join('');
      return `<div style="margin-bottom:20px;">
        <h3>BẢNG ĐÁP ÁN MÃ ĐỀ ${v.code}</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#eee;"><th style="border:1px solid #999;padding:4px;">Câu</th><th style="border:1px solid #999;padding:4px;">Đáp án</th><th style="border:1px solid #999;padding:4px;">Điểm</th></tr>
          ${cells}
        </table>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body>${sectionsHtml}<div style="font-family:'Times New Roman',serif;"><h2>BẢNG ĐÁP ÁN TỔNG HỢP</h2>${keyHtml}</div></body></html>`;
}

export async function parseDocxBufferToExam(
  buffer: ArrayBuffer | Uint8Array,
  fallbackTitle = 'Đề kiểm tra mới',
): Promise<ParsedExamDocument> {
  const entries = await extractZipEntries(buffer);
  const docBytes = entries['word/document.xml'];
  if (!docBytes) {
    throw new Error('Không tìm thấy cấu trúc văn bản word/document.xml trong tệp .docx');
  }
  const decoder = new TextDecoder('utf-8');
  const xml = decoder.decode(docBytes);

  // Giải mã hình ảnh đính kèm trong file Word (nếu có) qua word/_rels/document.xml.rels
  const mediaMap: Record<string, string> = {};
  const relsBytes = entries['word/_rels/document.xml.rels'];
  if (relsBytes) {
    const relsXml = decoder.decode(relsBytes);
    const relRegex = /<Relationship\b[^>]*>/g;
    let rm: RegExpExecArray | null;
    while ((rm = relRegex.exec(relsXml)) !== null) {
      const tag = rm[0];
      const idMatch = tag.match(/\bId="([^"]+)"/);
      const targetMatch = tag.match(/\bTarget="([^"]+)"/);
      if (idMatch && targetMatch) {
        const rId = idMatch[1];
        const target = targetMatch[1].replace(/^\/+/, '');
        const fullKey = target.startsWith('word/') ? target : `word/${target}`;
        const imgBytes = entries[fullKey];
        if (imgBytes) {
          const ext = fullKey.split('.').pop()?.toLowerCase() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
          const b64 = uint8ToBase64(imgBytes);
          if (b64) {
            mediaMap[rId] = `data:${mime};base64,${b64}`;
          }
        }
      }
    }
  }

  const text = convertDocxXmlToText(xml);
  const parsed = parseExamDocumentText(text, fallbackTitle, mediaMap);
  if (fallbackTitle && (!parsed.title || parsed.title === 'ĐỀ KIỂM TRA ĐỊNH KÌ')) {
    parsed.title = fallbackTitle;
  }
  return parsed;
}

/**
 * Đọc file Bảng tính Excel (.xlsx) và chuyển thành danh sách câu hỏi
 */
export async function parseXlsxBufferToExam(
  buffer: ArrayBuffer | Uint8Array,
  fallbackTitle = 'Đề kiểm tra từ Excel',
): Promise<ParsedExamDocument> {
  const entries = await extractZipEntries(buffer);
  const decoder = new TextDecoder('utf-8');
  const sharedStrings: string[] = [];

  if (entries['xl/sharedStrings.xml']) {
    const ssXml = decoder.decode(entries['xl/sharedStrings.xml']);
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      let cellText = '';
      while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
        cellText += decodeXmlEntities(tMatch[1]);
      }
      sharedStrings.push(cellText.trim());
    }
  }

  const lines: string[] = [];
  if (entries['xl/worksheets/sheet1.xml']) {
    const sheetXml = decoder.decode(entries['xl/worksheets/sheet1.xml']);
    const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const cells: string[] = [];
      const cRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cRegex.exec(rowMatch[1])) !== null) {
        const attrs = cMatch[1];
        const inner = cMatch[2];
        const isShared = /\bt="s"/.test(attrs);
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        const tMatch = inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
        if (isShared && vMatch) {
          const idx = Number(vMatch[1]);
          if (sharedStrings[idx]) cells.push(sharedStrings[idx]);
        } else if (tMatch) {
          cells.push(decodeXmlEntities(tMatch[1]).trim());
        } else if (vMatch) {
          cells.push(decodeXmlEntities(vMatch[1]).trim());
        }
      }
      if (cells.length > 0) {
        const first = cells[0];
        if (/^(STT|Câu hỏi|Question)$/i.test(first)) continue;
        if (cells.length >= 5) {
          const qNum = /^\d+$/.test(first) ? `Câu ${first}. ${cells[1]}` : `Câu ${lines.length + 1}. ${first}`;
          const startOpt = /^\d+$/.test(first) ? 2 : 1;
          const opts = cells
            .slice(startOpt, startOpt + 4)
            .map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o.replace(/^[A-D][.:)]\s*/i, '')}`)
            .join(' ');
          const ansCol = cells[startOpt + 4];
          const ansLine = ansCol && /^[A-D]$/i.test(ansCol.trim()) ? `\nĐáp án: ${ansCol.trim().toUpperCase()}` : '';
          lines.push(`${qNum}\n${opts}${ansLine}`);
        } else {
          lines.push(cells.join(' '));
        }
      }
    }
  }

  return parseExamDocumentText(lines.join('\n'), fallbackTitle);
}

/**
 * Bóc tách văn bản câu hỏi từ file PDF (.pdf) bằng giải nén luồng FlateDecode + PDF Text Operators
 */
export async function parsePdfBufferToExam(
  buffer: ArrayBuffer | Uint8Array,
  fallbackTitle = 'Đề kiểm tra PDF',
): Promise<ParsedExamDocument> {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(uint8);
  const extractedChunks: string[] = [];

  const decodePdfLiteral = (raw: string): string =>
    raw
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');

  const decodeHexUtf16 = (hexStr: string): string => {
    const clean = hexStr.replace(/\s+/g, '');
    if (clean.toUpperCase().startsWith('FEFF')) {
      let out = '';
      for (let i = 4; i + 3 < clean.length; i += 4) {
        const code = parseInt(clean.slice(i, i + 4), 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
      }
      return out;
    }
    const bytes = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 32;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  };

  const parseContentStream = (content: string) => {
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch: RegExpExecArray | null;
    while ((btMatch = btRegex.exec(content)) !== null) {
      const block = btMatch[1];
      let line = '';
      const tokenRe = /\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f\s]+)>|T\*|Td|TD|'/g;
      let tm: RegExpExecArray | null;
      while ((tm = tokenRe.exec(block)) !== null) {
        const tok = tm[0];
        if (tok === 'T*' || tok === 'Td' || tok === 'TD' || tok === "'") {
          if (line.trim()) {
            extractedChunks.push(line.trim());
            line = '';
          }
        } else if (tok.startsWith('(') && tok.endsWith(')')) {
          line += decodePdfLiteral(tok.slice(1, -1));
        } else if (tm[1]) {
          line += decodeHexUtf16(tm[1]);
        }
      }
      if (line.trim()) extractedChunks.push(line.trim());
    }
  };

  // Quét các stream trong PDF và giải nén nếu là FlateDecode
  const streamRegex = /stream\r?\n/g;
  let sm: RegExpExecArray | null;
  while ((sm = streamRegex.exec(latin1)) !== null) {
    const startOffset = sm.index + sm[0].length;
    const endIdx = latin1.indexOf('endstream', startOffset);
    if (endIdx === -1) break;
    let sliceEnd = endIdx;
    if (latin1[sliceEnd - 1] === '\n') sliceEnd--;
    if (latin1[sliceEnd - 1] === '\r') sliceEnd--;
    const rawStreamBytes = uint8.subarray(startOffset, sliceEnd);

    if (typeof DecompressionStream !== 'undefined' && rawStreamBytes.length > 2) {
      for (const fmt of ['deflate', 'deflate-raw'] as const) {
        try {
          const ds = new DecompressionStream(fmt);
          const readPromise = new Response(ds.readable).arrayBuffer();
          const writer = ds.writable.getWriter();
          writer.write(rawStreamBytes as unknown as BufferSource).catch(() => {});
          writer.close().catch(() => {});
          const decompressed = new Uint8Array(await readPromise);
          const text = new TextDecoder('utf-8', { fatal: false }).decode(decompressed);
          if (text.includes('BT') && text.includes('ET')) {
            parseContentStream(text);
          }
          break;
        } catch {
          // Thử định dạng tiếp theo
        }
      }
    }
  }

  if (extractedChunks.length === 0) {
    parseContentStream(latin1);
  }

  const finalText = extractedChunks.join('\n').trim();
  return parseExamDocumentText(
    finalText || `Câu 1. Nội dung trích xuất từ tệp PDF: ${fallbackTitle}`,
    fallbackTitle,
  );
}

/**
 * Gộp (nối tiếp) danh sách câu hỏi mới vào danh sách câu hỏi hiện có và đánh lại số thứ tự liên tục
 */
export function mergeExamQuestions(
  existingQuestions: ParsedExamQuestion[],
  incomingQuestions: ParsedExamQuestion[],
): ParsedExamQuestion[] {
  const combined = [...existingQuestions, ...incomingQuestions];
  return combined.map((q, idx) => ({
    ...q,
    uid: `${q.uid}-m${idx + 1}`,
    globalIndex: idx + 1,
    localIndex: idx + 1,
  }));
}

export function recomputeExamStats(questions: ParsedExamQuestion[]): ParsedExamDocument['stats'] {
  return computeExamStats({
    title: 'Đề kiểm tra',
    subtitle: '',
    subject: 'Lịch sử & Địa lí',
    grade: '7',
    durationMinutes: 45,
    questions,
  }).stats;
}

export function createBlankQuestion(
  qtype: ExamQuestionType,
  indexNumber: number,
  section = 'PHẦN I. TRẮC NGHIỆM (7,0 điểm)',
): ParsedExamQuestion {
  return {
    uid: `q-new-${indexNumber}-${Date.now().toString(36)}`,
    globalIndex: indexNumber,
    localIndex: indexNumber,
    section,
    subSection: '',
    qtype,
    subject: 'Lịch sử',
    prompt: `Nhập nội dung câu hỏi số ${indexNumber}...`,
    options:
      qtype === 'mcq' || qtype === 'dropdown'
        ? ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D']
        : [],
    correctIndex: 0,
    correctIndices: [0],
    multiSelect: false,
    tfStatements:
      qtype === 'truefalse_4'
        ? ['Mệnh đề a', 'Mệnh đề b', 'Mệnh đề c', 'Mệnh đề d']
        : [],
    tfCorrect: [true, false, true, false],
    shortAnswer: qtype === 'short_answer' || qtype === 'blank' || qtype === 'drag_drop' ? 'Đáp án mẫu' : '',
    points: qtype === 'essay' ? 1.5 : 1,
    seconds: 0,
    bloomLevel: 'Nhận biết',
    unitTitle: '',
    explanation: '',
    warnings: [],
  };
}

export const SAMPLE_DOCX_RAW_TEXT_GIUA_HK1 = `ĐỀ KIỂM TRA GIỮA HỌC KÌ I
NĂM HỌC 2026-2027
Môn: Lịch sử và Địa lí – Lớp 7
Thời gian làm bài: 90 phút
PHẦN I. TRẮC NGHIỆM (7,0 điểm)
Câu 1 (Lịch sử). Hai giai cấp cơ bản được hình thành trong xã hội phong kiến ở Tây Âu là
A. Lãnh chủ phong kiến và nông nô.B. Lãnh chủ phong kiến và nông nô.C. Chủ nô và nô lệ.D. Tư sản và vô sản.`;

export const SAMPLE_DOCX_RAW_TEXT_NHA_TRAN = SAMPLE_DOCX_RAW_TEXT_GIUA_HK1;
