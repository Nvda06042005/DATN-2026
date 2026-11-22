/**
 * Thế giới khối trên ứng dụng điện thoại gốc (Android / iOS). three.js vẽ bằng WebGL của trình duyệt nên ứng dụng **nhúng đúng màn thế giới khối của
 * website** trong WebView (người dùng chọn ngày 22/11/2026): chuyển sẵn phiên đăng nhập và lớp đang học vào kho của WebView, mở trang trường với
 * `embed=1` (website ẩn thanh đầu và các nút mục), chỉ cho điều hướng trong website của dự án; liên kết ngoài mở bằng trình duyệt của máy.
 * Không nạp được (mất mạng, lỗi WebView) thì còn nút "Mở trên trình duyệt" như trước. Bản web nằm ở WorldViewport.web.tsx.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, ExternalLink, RotateCcw } from 'lucide-react-native';
import { getSchoolLink } from '@/api/authApi';
import { embedBootScript } from '@/lib/world-map';
import { Spinner, Txt } from '@/components/ui';
import type { GameBridge } from '@/game/bridge';

/** Website chính thức (Vercel); bản thử đặt EXPO_PUBLIC_SITE_URL */
export const WORLD_SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://datn-2026-indol.vercel.app').replace(/\/+$/, '');
const ORIGIN = (() => { const m = /^https?:\/\/[^/]+/i.exec(WORLD_SITE); return m ? m[0].toLowerCase() : WORLD_SITE; })();

/** `webUrl`: đúng màn này trên website (ứng dụng điện thoại gốc mở bằng trình duyệt của máy) */
export interface WorldViewportProps { bridge: GameBridge; label: string; height: number; webUrl?: string; children?: React.ReactNode }

/** Khung dự phòng: mở website bằng trình duyệt của máy */
export const WorldViewport: React.FC<WorldViewportProps> = ({ label, height, webUrl }) => (
  <View accessibilityLabel={label} testID="world-viewport" style={{ width: '100%', height, borderRadius: 18, backgroundColor: '#2b4a40', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
    <Txt f="bold" size={16} color="#ffffff" center>Thế giới khối 3D mở trên trình duyệt của máy.</Txt>
    <Txt size={14} color="#d7e6dc" center>Bấm nút dưới đây để mở đúng nhiệm vụ này trên website, đăng nhập là chơi tiếp cùng các bạn – tiến độ được lưu ở máy chủ.</Txt>
    {webUrl ? <OpenBrowser url={webUrl} /> : null}
  </View>
);

const OpenBrowser: React.FC<{ url: string; light?: boolean }> = ({ url, light }) => (
  <Pressable accessibilityRole="link" accessibilityLabel="Mở thế giới khối trên trình duyệt" testID="world-open-browser" onPress={() => { void Linking.openURL(url); }}
    style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: light ? '#ffffff' : '#2b4a40', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <ExternalLink size={18} color={light ? '#2b4a40' : '#ffffff'} /><Txt f="bold" size={14} color={light ? '#2b4a40' : '#ffffff'}>Mở trên trình duyệt</Txt>
  </Pressable>
);

export interface WorldEmbedProps { token: string; userId: number; schoolCode: string | null; classId: number | null; stageId: number; campaignNo: number; onBack: () => void }

/** Màn Nhập vai trên ứng dụng gốc: WebView mở đúng thế giới khối của website, đã đăng nhập sẵn */
export const WorldEmbed: React.FC<WorldEmbedProps> = ({ token, userId, schoolCode, classId, stageId, campaignNo, onBack }) => {
  const [path, setPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const query = `role=student&tab=chien-dich&c=${campaignNo}&s=${stageId}&v=kham-pha&embed=1`;
  useEffect(() => {
    let live = true;
    setPath(null); setFailed(false);
    if (!schoolCode) { setPath(`/hoc-sinh?${query}`); return undefined; }
    // đường dẫn chuẩn của trường do máy chủ trả (trang trường chuyển hướng sẽ làm mất tham số trên URL)
    getSchoolLink(`donga_${schoolCode}`).then((s) => { if (live) setPath(`/${s.slug}?${query}`); }).catch(() => { if (live) setPath(`/hoc-sinh?${query}`); });
    return () => { live = false; };
  }, [schoolCode, query, round]);
  const boot = useMemo(() => embedBootScript({ token, userId, schoolCode, classId }), [token, userId, schoolCode, classId]);
  const browserUrl = `${WORLD_SITE}/hoc-sinh?tab=chien-dich&c=${campaignNo}&s=${stageId}&v=kham-pha`;
  return (
    <View style={{ flex: 1, backgroundColor: '#f4faf7' }} testID="world-embed">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#d6e6df' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Về bảng thông tin chặng" testID="world-embed-back" onPress={onBack}
          style={{ minHeight: 44, minWidth: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}>
          <ArrowLeft size={20} color="#2b4a40" /><Txt f="bold" size={14} color="#2b4a40">Thông tin chặng</Txt>
        </Pressable>
        <Txt f="bold" size={15} style={{ flex: 1 }} numberOfLines={1}>Nhập vai · Thế giới khối</Txt>
      </View>
      {failed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
          <Txt f="bold" size={16} center>Chưa mở được thế giới khối.</Txt>
          <Txt size={14} color="#55706a" center>Kiểm tra kết nối mạng rồi thử lại, hoặc mở trên trình duyệt của máy – tiến độ vẫn lưu ở máy chủ.</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Thử mở lại" testID="world-embed-retry" onPress={() => setRound((n) => n + 1)}
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2b4a40', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={18} color="#2b4a40" /><Txt f="bold" size={14} color="#2b4a40">Thử lại</Txt>
          </Pressable>
          <OpenBrowser url={browserUrl} />
        </View>
      ) : path ? (
        <WebView
          key={round}
          source={{ uri: `${WORLD_SITE}${path}` }}
          injectedJavaScriptBeforeContentLoaded={boot}
          originWhitelist={[`${ORIGIN}*`]}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url.toLowerCase().startsWith(ORIGIN) || req.url.startsWith('about:')) return true;
            void Linking.openURL(req.url); // liên kết ngoài (nguồn tham khảo…) mở bằng trình duyệt của máy
            return false;
          }}
          javaScriptEnabled domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Spinner label="Đang mở thế giới khối…" /></View>}
          onError={() => setFailed(true)}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
          style={{ flex: 1 }}
          testID="world-webview"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner label="Đang mở thế giới khối…" /></View>
      )}
    </View>
  );
};
