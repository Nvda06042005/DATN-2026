import type { SchoolLinkInfo } from '@/types/api';

const schools = new Map<string, { school: SchoolLinkInfo; checkedAt: number }>();
const pending = new Map<string, Promise<SchoolLinkInfo>>();
const FRESH_MS = 60_000;

/** Chỉ cache nhận diện công khai; mã trường vẫn được kiểm tra bằng tài khoản/API. */
export function peekSchoolIdentity(slug: string): SchoolLinkInfo | null {
  const entry = schools.get(slug.toLowerCase());
  return entry && Date.now() - entry.checkedAt < FRESH_MS ? entry.school : null;
}

export function loadSchoolIdentity(slug: string, load: () => Promise<SchoolLinkInfo>): Promise<SchoolLinkInfo> {
  const key = slug.toLowerCase(), cached = peekSchoolIdentity(key);
  if (cached) return Promise.resolve(cached);
  const running = pending.get(key);
  if (running) return running;
  const request = load().then(school => {
    if (pending.get(key) === request) {
      schools.set(key, { school, checkedAt: Date.now() });
      schools.set(school.slug.toLowerCase(), { school, checkedAt: Date.now() });
      while (schools.size > 32) schools.delete(schools.keys().next().value!);
    }
    return school;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}

export function clearSchoolIdentities(): void { schools.clear(); pending.clear(); }
