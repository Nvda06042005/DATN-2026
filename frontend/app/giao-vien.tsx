/** /giao-vien – trang giáo viên: hồ sơ, lớp được phân công */
import { PortalApp } from '@/components/auth';
import { LearnerHome } from '@/components/portal/LearnerHome';

export default function TeacherRoute() {
  return <PortalApp portal="teacher">{(session) => <LearnerHome session={session} />}</PortalApp>;
}
