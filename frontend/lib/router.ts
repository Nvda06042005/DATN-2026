import { PORTAL_PATH } from '@/constants/routes';
import type { Portal, Route } from '@/types/authType';

/** Mở file HTML trực tiếp (file://) thì dùng #/hoc-sinh, #/giao-vien, #/admin */
export const isHashRouting = () => window.location.protocol === 'file:' || window.location.hash.startsWith('#/');

export const basePath = () => {
  const p = window.location.pathname.replace(/\/(hoc-sinh|giao-vien|admin)\/?$/, '/');
  return p.endsWith('/') ? p : `${p}/`;
};

export const currentRoute = (): Route => {
  const key = isHashRouting()
    ? window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '')
    : window.location.pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return (Object.keys(PORTAL_PATH) as Portal[]).find((p) => PORTAL_PATH[p] === key) ?? 'home';
};

/** Địa chỉ đầy đủ của một trang (dùng để in phiếu tài khoản) */
export const routeHref = (route: Route) =>
  isHashRouting()
    ? `${window.location.origin}${window.location.pathname}${route === 'home' ? '' : `#/${PORTAL_PATH[route]}`}`
    : `${window.location.origin}${basePath()}${route === 'home' ? '' : PORTAL_PATH[route]}`;

export const goTo = (route: Route) => {
  if (isHashRouting()) {
    window.location.hash = route === 'home' ? '' : `#/${PORTAL_PATH[route]}`;
    return;
  }
  window.history.pushState(null, '', `${basePath()}${route === 'home' ? '' : PORTAL_PATH[route]}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
