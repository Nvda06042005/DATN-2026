/** Tệp tải lên (ảnh, video, nhạc) và kho ảnh của giáo viên, khớp với backend/src/content/studio.service.ts (/api/content/media, /api/content/media-library).
 * Trình soạn "Quiz (Kahoot-style)" và các kiểu dữ liệu của nó đã xóa hẳn theo yêu cầu 16/11/2026. */
export interface UploadedFile { token: string; name: string | null; url: string; mime: string; size_bytes: number }
export interface MediaLibrary {
  uploads: UploadedFile[];
  /** Video và nhạc tải lên (HK.GV.092, 093) */
  videos: UploadedFile[]; audios: UploadedFile[];
  library: Array<{ kind: 'source' | 'figure' | 'place' | 'campaign'; id: number; title: string; url: string }>;
}
