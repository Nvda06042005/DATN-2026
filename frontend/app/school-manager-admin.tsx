/** /school-manager-admin – cổng quản trị trường (chỉ dữ liệu trường mình); cổng độc lập, không có liên kết về trang chủ */
import { AdminHome } from '@/components/admin/AdminHome';
import { PortalApp } from '@/components/auth';

export default function SchoolAdminRoute() {
  return <PortalApp portal="school_admin">{(session) => <AdminHome session={session} />}</PortalApp>;
}
