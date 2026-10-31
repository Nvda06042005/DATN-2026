/** /hoc-sinh – trang học sinh: hành trình học, thư viện lịch sử, làm bài, hồ sơ và lớp học */
import { PortalApp } from '@/components/auth';
import { StudentApp } from '@/components/portal/StudentApp';

export default function StudentRoute() {
  return <PortalApp portal="student">{(session) => <StudentApp session={session} />}</PortalApp>;
}
