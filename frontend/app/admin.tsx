/** /admin – cổng quản trị tổng (toàn hệ thống); cổng độc lập, không có liên kết về trang chủ */
import { RootAdmin } from '@/components/admin/RootAdmin';
import { PortalApp } from '@/components/auth';

export default function RootAdminRoute() {
  return <PortalApp portal="root_admin">{(session) => <RootAdmin session={session} />}</PortalApp>;
}
