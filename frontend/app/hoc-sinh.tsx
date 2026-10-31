/** /hoc-sinh – trang học sinh: hồ sơ, tham gia lớp bằng mã */
import { PortalApp } from '@/components/auth';
import { LearnerHome } from '@/components/portal/LearnerHome';

export default function StudentRoute() {
  return <PortalApp portal="student">{(session) => <LearnerHome session={session} />}</PortalApp>;
}
