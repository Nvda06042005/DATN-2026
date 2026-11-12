/** Ảnh đại diện chỉ nhận ảnh. Máy chủ kiểm tra lại bằng nội dung thật; ở đây chặn sớm để báo ngay khi chọn nhầm tệp. */
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const AVATAR_MAX = 1572864;
export const AVATAR_ONLY_IMAGES = 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF. Tệp Word, Excel, PowerPoint, PDF và các tệp khác không được nhận.';

/** Tệp có phải ảnh hợp lệ không: loại tệp do trình duyệt khai là ảnh, hoặc không khai loại nhưng đuôi tệp là đuôi ảnh */
export function isAvatarImage(mimeType: string | undefined, name: string | undefined): boolean {
  const type = (mimeType || '').toLowerCase();
  if (AVATAR_TYPES.includes(type)) return true;
  return (type === '' || type === 'application/octet-stream') && /\.(png|jpe?g|webp|gif)$/i.test(name || '');
}
