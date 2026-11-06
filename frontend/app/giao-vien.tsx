/** /giao-vien – trang giáo viên: lớp phụ trách, hành trình học, ngân hàng câu hỏi, bộ đề */
import { PortalApp } from '@/components/auth';
import { TeacherApp } from '@/components/portal/TeacherApp';

export default function TeacherRoute() {
  return <PortalApp portal="teacher">{(session) => <TeacherApp session={session} />}</PortalApp>;
}
