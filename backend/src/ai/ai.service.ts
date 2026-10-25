import { Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

export interface BktResult {
  state: Record<string, unknown>;
  unit_id: string;
  topic: string;
  old_p_l: number;
  new_p_l: number;
  p_l_delta: number;
  mastery_status: string;
  attempts: number;
}

export interface AiQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source: string;
}

/** Một dòng của file Excel mẫu sau khi dịch vụ Python kiểm tra và chuẩn hóa */
export interface ExcelRow {
  row: number;
  values: {
    user_code: string;
    school_name: string;
    school_code: string;
    region: string;
    city: string;
    full_name: string;
    /** YYYY-MM-DD */
    birth_date: string | null;
    school_year: string;
    email: string;
    grade: number | null;
    role: 'GV' | 'HS' | null;
  };
  /** Tên cột còn trống hoặc sai định dạng */
  missing: string[];
  invalid: Array<{ field: string; message: string }>;
  complete: boolean;
  /** Vector đặc trưng hồ sơ (đối chiếu dòng bổ sung bằng pgvector / cosine) */
  embedding: number[];
  /** Chỉ có khi dòng đủ thông tin: tên đăng nhập (chưa có 3 số thứ tự và @miền) và mật khẩu mặc định */
  credentials: { username_prefix: string; password: string } | null;
}

export interface ExcelValidation {
  ok: boolean;
  errors: string[];
  template_id: string | null;
  rows: ExcelRow[];
}

/** Ứng viên lấy từ nhật ký dòng thiếu (truy xuất bằng pgvector hoặc khớp chính xác) */
export interface MatchCandidate {
  id: number;
  user_code: string | null;
  email: string | null;
  full_name: string | null;
  school_code: string | null;
  row_data: Record<string, unknown>;
  embedding: number[] | null;
}

export interface MatchDecision {
  row: number;
  log_id: number | null;
  score: number;
  reason: string;
}

/** Gọi dịch vụ AI Python (ai/server.py): chatbot RAG, soạn đề, soạn truyện, Bayesian Knowledge Tracing, file Excel mẫu. */
@Injectable()
export class AiService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AI');

  /** Đánh thức dịch vụ AI (gói miễn phí của Render ngủ sau 15 phút không dùng) */
  onApplicationBootstrap(): void {
    this.health().catch(() => undefined);
  }

  private async request<T>(path: string, body: unknown | undefined, timeoutMs: number): Promise<T> {
    const res = await fetch(`${config.aiServiceUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.aiServiceToken ? { 'X-AI-Token': config.aiServiceToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    return (await res.json()) as T;
  }

  /** File Excel mẫu có chữ ký HMAC ẩn (mỗi lần tải là một mã mẫu mới) */
  async excelTemplate(): Promise<Buffer> {
    try {
      const res = await fetch(`${config.aiServiceUrl}/excel/template`, {
        headers: config.aiServiceToken ? { 'X-AI-Token': config.aiServiceToken } : {},
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`AI service ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch {
      throw new ServiceUnavailableException('Chưa tạo được file mẫu, thử lại sau ít phút');
    }
  }

  /** Kiểm duyệt file: định dạng .xlsx, chữ ký mẫu, cấu trúc cột; đọc và chuẩn hóa từng dòng */
  async excelValidate(fileBase64: string, filename: string, mime: string): Promise<ExcelValidation> {
    return this.forward<ExcelValidation>('/excel/validate', { file_b64: fileBase64, filename, mime }, 90_000);
  }

  /** RAG Smart Delta: dòng đủ thông tin nào bổ sung cho dòng thiếu nào trong lịch sử nhập */
  async provisionMatch(rows: Array<{ row: number; values: ExcelRow['values']; embedding: number[]; candidates: MatchCandidate[] }>): Promise<MatchDecision[]> {
    if (!rows.length) return [];
    return (await this.forward<{ decisions: MatchDecision[] }>('/provision/match', { rows }, 60_000)).decisions;
  }

  async health(): Promise<boolean> {
    try {
      await this.request('/health', undefined, 3000);
      return true;
    } catch {
      return false;
    }
  }

  /** Cập nhật BKT sau một câu trả lời; dịch vụ AI không trả lời kịp thì giữ nguyên trạng thái (trả null) */
  async bktUpdate(state: Record<string, unknown>, unitId: string, isCorrect: boolean): Promise<BktResult | null> {
    try {
      return await this.request<BktResult>('/bkt/update', { state, unit_id: unitId, is_correct: isCorrect }, 4000);
    } catch (exc) {
      this.logger.warn(`Không cập nhật được BKT (${(exc as Error).name})`);
      return null;
    }
  }

  async bktRecommend(state: Record<string, unknown>, topK: number): Promise<Array<Record<string, unknown>>> {
    try {
      return (await this.request<{ recommendations: Array<Record<string, unknown>> }>('/bkt/recommend', { state, top_k: topK }, 4000)).recommendations;
    } catch {
      return [];
    }
  }

  async generateQuestions(unitId: string, topic: string, count: number): Promise<AiQuestion[]> {
    try {
      return (await this.request<{ questions: AiQuestion[] }>('/questions/generate', { unit_id: unitId, topic, count }, 25_000)).questions;
    } catch {
      this.logger.warn(`Không sinh được câu hỏi AI cho ${unitId}`);
      return [];
    }
  }

  /** Chuyển tiếp yêu cầu của người dùng (chat, soạn đề, soạn truyện); AI bận thì báo 503 */
  async forward<T>(path: string, body: unknown, timeoutMs = 40_000): Promise<T> {
    try {
      return await this.request<T>(path, body, timeoutMs);
    } catch {
      throw new ServiceUnavailableException('Dịch vụ AI đang bận, thử lại sau ít phút');
    }
  }
}
