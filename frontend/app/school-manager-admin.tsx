/** Tương thích dấu trang cũ: PortalApp chuyển sang URL donga_* của trường trước khi mở bất kỳ màn nào. */
import { PortalApp } from '@/components/auth';

export default function SchoolAdminRoute() {
  return <PortalApp portal="school_admin">{() => null}</PortalApp>;
}
