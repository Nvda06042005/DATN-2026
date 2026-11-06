/**
 * Chép văn bản vào clipboard trên web. Ưu tiên Clipboard API (cần trang https hoặc localhost và thao tác bấm của người dùng);
 * nếu trình duyệt không có hoặc từ chối thì dùng ô nhập tạm với lệnh sao chép cũ. Trả về true khi chép được.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // bị từ chối quyền hoặc trang không an toàn: thử cách dự phòng
  }
  try {
    if (typeof document === 'undefined') return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    // đặt ngay cạnh phần tử đang được chọn để hộp thoại giữ tiêu điểm không kéo tiêu điểm đi trước khi chép
    const host = document.activeElement?.parentElement ?? document.body;
    host.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    const done = document.execCommand('copy');
    host.removeChild(area);
    return done;
  } catch {
    return false;
  }
}
