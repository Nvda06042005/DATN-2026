import { useCallback } from 'react';
import { useLocalSearchParams, usePathname, useRouter, type Href } from 'expo-router';

/** Ghi mục menu vào URL: Back/Forward và tải lại trang vẫn ở đúng cổng, vai trò và trường. */
export function usePortalTab<T extends string>(fallback: T, allowed: readonly T[]): [T, (tab: T, extra?: Record<string, string | undefined>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = allowed.includes(requested as T) ? requested as T : fallback;
  const select = useCallback((next: T, extra?: Record<string, string | undefined>) => {
    if ((!extra && next === tab) || !allowed.includes(next)) return;
    const query = Object.fromEntries(Object.entries(params).filter(([key, value]) => key !== 'school' && key !== 'tab' && value !== undefined));
    router.push({ pathname, params: { ...query, ...extra, tab: next } } as Href);
  }, [router, pathname, params, tab, allowed]);
  return [tab, select];
}
