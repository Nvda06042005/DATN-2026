/**
 * Lưu phiên đăng nhập: trên điện thoại dùng kho bảo mật của hệ điều hành (Keychain / Keystore qua expo-secure-store),
 * trên web dùng localStorage. Mỗi trang (học sinh, giáo viên, quản trị) giữ một phiên riêng.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Portal } from '@/types/api';

const tokenKey = (portal: Portal) => `donga_token_${portal}`;

const webStore = (kind: 'local' | 'session'): Storage | null => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // trình duyệt chặn lưu trữ: phiên chỉ còn tới khi tải lại trang
  }
};

export async function readToken(portal: Portal): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStore('local')?.getItem(tokenKey(portal)) ?? null;
    return await SecureStore.getItemAsync(tokenKey(portal));
  } catch {
    return null;
  }
}

export async function saveToken(portal: Portal, token: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const store = webStore('local');
      if (token) store?.setItem(tokenKey(portal), token);
      else store?.removeItem(tokenKey(portal));
    } else if (token) await SecureStore.setItemAsync(tokenKey(portal), token);
    else await SecureStore.deleteItemAsync(tokenKey(portal));
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


/** Âm thanh hiệu ứng của trang chủ: bật mặc định, nhớ lựa chọn trên web (xem lib/sfx.ts) */
const HOME_SOUND_KEY = 'donga_home_sound';

export const readHomeSound = (): boolean | null => {
  if (Platform.OS !== 'web') return null;
  try {
    const v = webStore('local')?.getItem(HOME_SOUND_KEY);
    return v === 'on' ? true : v === 'off' ? false : null;
  } catch {
    return null;
  }
};

export const saveHomeSound = (on: boolean) => {
  if (Platform.OS !== 'web') return;
  try {
    webStore('local')?.setItem(HOME_SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // bỏ qua: lần sau mở lại trang sẽ dùng mặc định (bật)
  }
};
