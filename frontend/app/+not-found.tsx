/** Trang 404 (HK.HS.112, HK.GV.082, HK.QT.055): địa chỉ không tồn tại; nội dung ở components/error-page.tsx */
import { ErrorPage } from '@/components/error-page';

export default function NotFoundRoute() {
  return <ErrorPage kind="not-found" />;
}
