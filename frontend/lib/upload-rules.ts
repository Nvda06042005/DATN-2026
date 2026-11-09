/**
 * Quy tắc file tải lên ở hộp "Nhập từ Excel": báo cho người dùng biết trước chỉ nhận loại file nào, và chặn ngay file sai loại hoặc quá lớn
 * mà không phải gửi lên máy chủ (máy chủ vẫn kiểm tra lại chữ ký zip, loại mẫu và tối đa 2 MB).
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLSM_MIME = 'application/vnd.ms-excel.sheet.macroEnabled.12';
export const JSON_MIME = 'application/json';
/** Giới hạn của máy chủ cho file Excel nhập danh sách */
export const MAX_XLSX_BYTES = 2 * 1024 * 1024;

export function checkTemplateFilename(actual:string,expected?:string,legacy?:string):string|null {
  return expected && actual!==expected && actual!==legacy ? `Sai tên file. Chỉ nhận ${expected}${legacy?` hoặc ${legacy}`:''}. Hãy giữ đúng tên file mẫu của trường.` : null;
}

const EXTENSION: Record<string, string> = { [XLSX_MIME]: '.xlsx', [XLSM_MIME]: '.xlsm', [JSON_MIME]: '.json' };

/** Đuôi file được nhận theo danh sách loại (MIME) của hộp chọn file */
export const acceptedExtensions = (types: string[]): string[] => [...new Set(types.map((t) => EXTENSION[t]).filter((x): x is string => !!x))];

/** Câu báo trước chỗ nút "Chọn file"; .xlsm chỉ được bật cho hộp nhập danh sách thành viên. */
export function acceptNote(types: string[]): string {
  const ext = acceptedExtensions(types);
  const excelOnly = ext.length === 1 && ext[0] === '.xlsx';
  if (excelOnly) return 'Chỉ nhận file Excel (.xlsx), tối đa 2 MB. Các loại file khác (PDF, Word, ảnh, .xls, .csv…) sẽ bị từ chối.';
  if (ext.length && ext.every(e=>e==='.xlsx'||e==='.xlsm') && ext.includes('.xlsm')) return 'Chỉ nhận file mẫu Excel (.xlsm hoặc .xlsx), tối đa 2 MB. Dùng Microsoft Excel trên Windows để chọn ngày trên lịch.';
  if (ext.includes('.xlsx') && ext.includes('.json')) return 'Chỉ nhận file Excel (.xlsx) hoặc JSON (.json). Các loại file khác sẽ bị từ chối.';
  return `Chỉ nhận file ${ext.join(', ') || 'đúng định dạng của mẫu'}.`;
}

/** null nếu file hợp lệ, ngược lại là lời báo lỗi tiếng Việt để hiện ngay */
export function checkPickedFile(file: { name: string; size?: number | null }, types: string[]): string | null {
  const ext = acceptedExtensions(types);
  if (ext.length) {
    const name = file.name.trim().toLowerCase();
    if (!ext.some((e) => name.endsWith(e))) {
      const excelOnly = ext.length === 1 && ext[0] === '.xlsx';
      return excelOnly
        ? `Chỉ nhận file Excel (.xlsx). File "${file.name}" không đúng loại: hãy tải file mẫu, điền rồi lưu lại dạng .xlsx.`
        : `Chỉ nhận file ${ext.join(' hoặc ')}. File "${file.name}" không đúng loại.`;
    }
  }
  if (ext.length && ext.every(e=>e==='.xlsx'||e==='.xlsm') && typeof file.size === 'number' && file.size > MAX_XLSX_BYTES) return `File "${file.name}" quá lớn (tối đa 2 MB). Hãy chia nhỏ danh sách rồi nhập từng lần.`;
  return null;
}
