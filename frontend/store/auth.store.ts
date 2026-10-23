export const readToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const saveToken = (key: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    // Trình duyệt chặn lưu trữ: phiên chỉ tồn tại tới khi tải lại trang
  }
};
