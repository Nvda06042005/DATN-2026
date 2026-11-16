/**
 * Cầu nối giữa giao diện React và cảnh game Phaser. Hai bên chỉ trao đổi theo sự kiện (bấm, tới gần, chạy xong hoạt ảnh…), không cập nhật theo từng khung hình.
 * Giá trị đặt bằng `set` là giá trị "dính": cảnh game được tạo sau (Phaser tải chậm hơn giao diện) vẫn đọc được trạng thái mới nhất bằng `get`.
 * `game:calm` = người dùng chọn giảm chuyển động: các cảnh không rung, không chớp màn hình.
 */
type Fn = (payload: any) => void;

export class GameBridge {
  private readonly handlers = new Map<string, Set<Fn>>();
  private readonly values = new Map<string, unknown>();

  /** Đăng ký nghe một sự kiện; trả về hàm hủy đăng ký (gọi khi rời màn) */
  on(event: string, fn: Fn): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => { this.handlers.get(event)?.delete(fn); };
  }

  emit(event: string, payload?: unknown): void {
    for (const fn of [...(this.handlers.get(event) ?? [])]) fn(payload);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
    this.emit(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }
}

export type GameKind = 'explore' | 'tactics' | 'bachdang';
