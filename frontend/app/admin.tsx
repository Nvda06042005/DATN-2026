/** /admin – cổng quản trị tổng (toàn hệ thống); cổng độc lập, không có liên kết về trang chủ */
import { AdminHome } from '@/components/admin/AdminHome';
import { PortalApp } from '@/components/auth';

export default function RootAdminRoute() {
  return <PortalApp portal="root_admin">{(session) => <AdminHome session={session} />}</PortalApp>;
}
