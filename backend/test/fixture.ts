/**
 * Dữ liệu dựng sẵn cho kiểm thử Sprint 3–4: hai trường, giáo viên, học sinh, lớp và nội dung lịch sử đã công bố.
 * Không phải bài kiểm thử (không có đuôi .spec.ts); dùng chung cho sprint3.spec.ts và sprint4.spec.ts.
 */
import { activate, call, sql, Started } from './harness';

export const PW = 'Matkhau-12345';
export interface Person { id: number; token: string }
export interface Fixture {
  root: string;
  A: Person & { schoolId: number }; B: Person & { schoolId: number };
  T1: Person; T2: Person; TB: Person; S1: Person; S2: Person; S3: Person;
  yearId: number; class7a: { id: number; join_code: string }; class7b: { id: number; join_code: string };
}

export async function publish(base: string, root: string, entity: string, id: number): Promise<void> {
  for (const status of ['verified', 'published']) {
    const res = await call(base, 'POST', `/api/admin/history/${entity}/${id}/status`, { status }, root);
    if (res.status !== 200) throw new Error(`Không công bố được ${entity} #${id}: ${JSON.stringify(res.body)}`);
  }
}

/** Công bố toàn bộ nội dung khởi tạo (hồ sơ lịch sử, bài học, hành trình hệ thống, mini-game) như khi giáo viên lịch sử đã kiểm duyệt */
export async function publishSeed(base: string, root: string): Promise<void> {
  for (const entity of ['campaigns', 'places', 'figures', 'sources', 'terms', 'events', 'battles']) {
    for (const item of (await call(base, 'GET', `/api/admin/history/${entity}?limit=100`, undefined, root)).body.items) await publish(base, root, entity, item.id);
  }
  for (const l of (await call(base, 'GET', '/api/content/lessons', undefined, root)).body) await call(base, 'PATCH', `/api/content/lessons/${l.id}/status`, { status: 'published' }, root);
  for (const j of (await call(base, 'GET', '/api/content/journeys?store=system', undefined, root)).body) {
    await call(base, 'PATCH', `/api/content/journeys/${j.id}/status`, { status: 'published' }, root);
    await call(base, 'PATCH', `/api/content/journeys/${j.id}/default`, { value: true }, root);
  }
  for (const m of (await call(base, 'GET', '/api/battle/admin/minigames', undefined, root)).body) await call(base, 'POST', `/api/battle/admin/minigames/${m.id}/status`, { status: 'published' }, root);
}

/** `keepSeed`: giữ nội dung học mẫu của migration 019; mặc định xóa để bài kiểm thử đếm chính xác nội dung do mình tạo */
export async function bootstrap(s: Started, root: string, keepSeed = false): Promise<Fixture> {
  if (!keepSeed) await sql(s.url, 'DELETE FROM hk_journeys; DELETE FROM hk_quizzes; DELETE FROM hk_lessons; DELETE FROM hk_questions;');
  const mk = async (code: string, name: string, email: string) => {
    const created = await call(s.base, 'POST', '/api/admin/schools', { school_code: code, name, admin: { full_name: `Quản Trị ${code}`, email } }, root);
    const active = await activate(s.base, created.body.admin.username, created.body.temporary_password, PW, 'school_admin');
    return { id: active.user.id, token: active.token, schoolId: created.body.school.id as number };
  };
  const A = await mk('8201', 'THCS Học Tập A', 'qt8201@example.edu.vn');
  const B = await mk('8202', 'THCS Học Tập B', 'qt8202@example.edu.vn');
  const year = await call(s.base, 'POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, A.token);
  await call(s.base, 'POST', `/api/admin/school-years/${year.body.id}/activate`, undefined, A.token);
  const yearB = await call(s.base, 'POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, B.token);
  await call(s.base, 'POST', `/api/admin/school-years/${yearB.body.id}/activate`, undefined, B.token);

  const teacher = async (admin: Person, name: string, email: string): Promise<Person> => {
    const created = await call(s.base, 'POST', '/api/admin/teachers', { full_name: name, email }, admin.token);
    const active = await activate(s.base, created.body.user.username, created.body.temporary_password, PW, 'teacher');
    return { id: active.user.id, token: active.token };
  };
  const T1 = await teacher(A, 'Nguyễn Văn Sử', 'su1@example.edu.vn');
  const T2 = await teacher(A, 'Trần Thị Địa', 'dia1@example.edu.vn');
  const TB = await teacher(B, 'Lê Văn Bê', 'be1@example.edu.vn');

  const c1 = await call(s.base, 'POST', '/api/admin/classes', { year_id: year.body.id, grade: 7, name: '7A1', teacher_ids: [T1.id] }, A.token);
  const c2 = await call(s.base, 'POST', '/api/admin/classes', { year_id: year.body.id, grade: 7, name: '7A2', teacher_ids: [T2.id] }, A.token);

  const student = async (code: string, name: string, classId: number | null): Promise<Person> => {
    const created = await call(s.base, 'POST', '/api/admin/students', { user_code: code, full_name: name, birth_date: '2013-03-15', ...(classId ? { class_id: classId } : {}) }, A.token);
    const active = await activate(s.base, created.body.user.username, created.body.temporary_password, PW, 'student');
    return { id: active.user.id, token: active.token };
  };
  const S1 = await student('HS8001', 'Phạm Minh Một', c1.body.id);
  const S2 = await student('HS8002', 'Hoàng Thị Hai', c1.body.id);
  const S3 = await student('HS8003', 'Đỗ Văn Ba', null);
  return { root, A, B, T1, T2, TB, S1, S2, S3, yearId: year.body.id, class7a: { id: c1.body.id, join_code: c1.body.join_code }, class7b: { id: c2.body.id, join_code: c2.body.join_code } };
}
