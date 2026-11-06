import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Txt } from '@/components/ui';

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
type GoogleWindow = Window & { google?: { accounts: { id: {
  initialize: (options: object) => void;
  renderButton: (element: HTMLElement, options: object) => void;
} } } };

/** Google xác minh danh tính; API mới quyết định vai trò, trường và bước xác thực tiếp theo. */
export function GoogleSignIn({ onToken, disabled }: { onToken: (token: string) => void; disabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ onToken, disabled });
  current.current = { onToken, disabled };
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || !CLIENT_ID) return;
    const render = () => {
      const google = (window as GoogleWindow).google;
      if (!google || !host.current) return;
      google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (response: { credential: string }) => {
        if (!current.current.disabled) current.current.onToken(response.credential);
      } });
      google.accounts.id.renderButton(host.current, { theme: 'outline', size: 'medium', text: 'signin_with', locale: 'vi' });
    };
    if ((window as GoogleWindow).google) { render(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing ?? document.createElement('script');
    const fail = () => setUnavailable(true);
    script.addEventListener('load', render);
    script.addEventListener('error', fail);
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      document.head.appendChild(script);
    }
    return () => {
      script.removeEventListener('load', render);
      script.removeEventListener('error', fail);
    };
  }, []);
  if (Platform.OS !== 'web' || !CLIENT_ID) return null;
  return <View testID="login-google" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
    {unavailable ? <Txt size={12} center>Chưa tải được Google. Bạn có thể đăng nhập bằng mật khẩu.</Txt>
      : <div ref={host} aria-label="Đăng nhập bằng Google" aria-disabled={disabled} style={{ minHeight: 44, display: 'flex', alignItems: 'center', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} />}
  </View>;
}
