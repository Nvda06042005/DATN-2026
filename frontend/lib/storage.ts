/**
 * Lưu phiên đăng nhập: trên điện thoại dùng kho bảo mật của hệ điều hành (Keychain / Keystore qua expo-secure-store),
 * trên web dùng localStorage. Mỗi trang (học sinh, giáo viên, quản trị) giữ một phiên riêng.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Portal } from '@/types/api';
import { forgetVerifiedUser } from '@/lib/verified-session';

const tokenKey = (portal: Portal, schoolCode?: string) => `donga_token_${portal}${schoolCode ? `_school_${schoolCode}` : ''}`;

const webStore = (kind: 'local' | 'session'): Storage | null => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // trình duyệt chặn lưu trữ: phiên chỉ còn tới khi tải lại trang
  }
};

export async function readToken(portal: Portal, schoolCode?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStore('local')?.getItem(tokenKey(portal, schoolCode)) ?? null;
    return await SecureStore.getItemAsync(tokenKey(portal, schoolCode));
  } catch {
    return null;
  }
}

/** Khôi phục tức thì trên web, chỉ kết hợp với user đã được API xác minh trong bộ nhớ. */
export function readTokenNow(portal: Portal, schoolCode?: string): string | null {
  try { return Platform.OS === 'web' ? webStore('local')?.getItem(tokenKey(portal, schoolCode)) ?? null : null; }
  catch { return null; }
}

export async function saveToken(portal: Portal, token: string | null, schoolCode?: string): Promise<void> {
  try {
    const previous = await readToken(portal, schoolCode);
    if (previous && previous !== token) forgetVerifiedUser(previous);
    if (Platform.OS === 'web') {
      const store = webStore('local');
      if (token) store?.setItem(tokenKey(portal, schoolCode), token);
      else store?.removeItem(tokenKey(portal, schoolCode));
    } else if (token) await SecureStore.setItemAsync(tokenKey(portal, schoolCode), token);
    else await SecureStore.deleteItemAsync(tokenKey(portal, schoolCode));
  } catch {
    // Không lưu được: người dùng đăng nhập lại ở lần mở sau
  }
}

/** Phòng thi đấu đang chơi (chỉ trên web): tải lại trang vẫn vào lại được */
const LIVE_ROOM_KEY = 'donga_live_room';
let memoryRoom: string | null = null;

export const rememberLiveRoom = (pin: string | null) => {
  memoryRoom = pin;
  const store = Platform.OS === 'web' ? webStore('session') : null;
  try {
    if (pin) store?.setItem(LIVE_ROOM_KEY, pin);
    else store?.removeItem(LIVE_ROOM_KEY);
  } catch {
    // bỏ qua
  }
};

export const readLiveRoom = (): string | null => {
  if (Platform.OS !== 'web') return memoryRoom;
  try {
    return webStore('session')?.getItem(LIVE_ROOM_KEY) ?? memoryRoom;
  } catch {
    return memoryRoom;
  }
};
