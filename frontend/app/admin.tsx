/** /admin – trang quản trị nhà trường */
import { AdminHome } from '@/components/admin/AdminHome';
import { PortalApp } from '@/components/auth';

export default function AdminRoute() {
  return <PortalApp portal="admin">{(session) => <AdminHome session={session} />}</PortalApp>;
}
