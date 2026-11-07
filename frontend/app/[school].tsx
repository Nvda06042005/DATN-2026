/** /donga_<mã trường>_<tên>_<khu vực> – cổng đăng nhập riêng của một trường (ví dụ /donga_79765507_phumy_binhthanh). Chỉ tài khoản của trường đó vào được. */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { PortalApp } from '@/components/auth';
import { SchoolAdmin } from '@/components/admin/SchoolAdmin';
import { StudentApp } from '@/components/portal/StudentApp';
import { TeacherApp } from '@/components/portal/TeacherApp';
import { ErrorPage } from '@/components/error-page';
import { Spinner } from '@/components/ui';
import { isSchoolRole, schoolRoleFromParam } from '@/lib/school-portal';
import { isSchoolSlug } from '@/lib/school-link';
import type { SchoolLinkInfo } from '@/types/api';

export default function SchoolLinkRoute() {
  const params = useLocalSearchParams<{ school?: string | string[] }>();
  const slug = Array.isArray(params.school) ? params.school[0] : params.school;
  // Mọi địa chỉ một đoạn không đúng dạng đường dẫn của trường vẫn là trang 404 như trước
  return isSchoolSlug(slug) ? <SchoolLinkLogin key={slug} slug={slug} /> : <ErrorPage kind="not-found" />;
}

function SchoolLinkLogin({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; tab?: string; pin?: string }>();
  const role = isSchoolRole(params.role) ? schoolRoleFromParam(params.role) : 'school_admin';
  const [school, setSchool] = useState<SchoolLinkInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'missing' | 'failed'>('loading');
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(() => {
    let live = true;
    setStatus('loading');
    authApi.getSchoolLink(slug).then((info) => {
      if (!live) return;
      setSchool(info);
      // Tên hoặc khu vực trong đường dẫn cũ/gõ sai vẫn mở đúng trường; đưa về đường dẫn chuẩn của trường
      if (info.slug.toLowerCase() !== slug.toLowerCase()) router.replace({ pathname: '/[school]', params: { school: info.slug, role, ...(params.tab ? { tab: params.tab } : {}), ...(params.pin ? { pin: params.pin } : {}) } });
    }).catch((error) => {
      if (!live) return;
      if (error instanceof ApiError && error.status === 404) setStatus('missing');
      else { setMessage(errorMessage(error, 'Chưa mở được trang của trường.')); setStatus('failed'); }
    });
    return () => { live = false; };
  }, [slug, router]); // Đổi vai trò/menu không tải lại nhận diện trường.
  useEffect(() => load(), [load]);

  if (!school) {
    if (status === 'missing') return <ErrorPage kind="not-found" />;
    if (status === 'failed') return <ErrorPage kind="crash" onRetry={load} detail={message} />;
    return <Spinner label="Đang mở trang của trường…" />;
  }
  return (
    <PortalApp key={`${school.school_code}:${role}`} portal={role} school={school}
      onRoleChange={next => router.replace({ pathname: '/[school]', params: { school: school.slug, role: next } })}>
      {session => role === 'school_admin' ? <SchoolAdmin session={session} /> : role === 'teacher' ? <TeacherApp session={session} /> : <StudentApp session={session} />}
    </PortalApp>
  );
}
