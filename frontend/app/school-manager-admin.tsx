/** /school-manager-admin – cổng quản trị trường (chỉ dữ liệu trường mình); cổng độc lập, không có liên kết về trang chủ */
import { SchoolAdmin } from '@/components/admin/SchoolAdmin';
import { PortalApp } from '@/components/auth';

export default function SchoolAdminRoute() {
  return <PortalApp portal="school_admin">{(session) => <SchoolAdmin session={session} />}</PortalApp>;
}
