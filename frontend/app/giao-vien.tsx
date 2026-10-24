/** /giao-vien – trang giáo viên */
import { PortalApp } from '@/components/auth';
import { TeacherHome } from '@/components/teacher/TeacherHome';

export default function TeacherRoute() {
  return <PortalApp portal="teacher">{(session) => <TeacherHome session={session} />}</PortalApp>;
}
