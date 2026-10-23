const LIVE_ROOM_KEY = 'donga_live_room';

/** Nhớ phòng đang chơi trong phiên trình duyệt để tải lại trang vẫn vào lại được */
export const rememberLiveRoom = (pin: string | null) => {
  try {
    if (pin) sessionStorage.setItem(LIVE_ROOM_KEY, pin);
    else sessionStorage.removeItem(LIVE_ROOM_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: chỉ mất khả năng tự vào lại sau khi tải lại trang
  }
};

export const readLiveRoom = (): string | null => {
  try {
    return sessionStorage.getItem(LIVE_ROOM_KEY);
  } catch {
    return null;
  }
};

/** Mã PIN trong đường link thầy cô gửi (…/hoc-sinh?pin=123456) */
export const readPinFromUrl = (): string | null => {
  try {
    const pin = (new URLSearchParams(window.location.search).get('pin') ?? '').replace(/\D/g, '');
    return pin.length === 6 ? pin : null;
  } catch {
    return null;
  }
};

export const stripPinFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('pin')) return;
    params.delete('pin');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  } catch {
    // file:// có thể chặn replaceState: giữ nguyên địa chỉ
  }
};
