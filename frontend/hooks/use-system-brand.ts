/** Tên và logo hệ thống do quản trị tổng đặt (HK.AD.065); nhớ lại để các thanh đầu trang không phải hỏi lại mỗi lần mở */
import { useEffect, useState } from 'react';
import * as platformApi from '@/api/platformApi';
import type { SystemBrand } from '@/components/art';

let cached: SystemBrand | null = null;

export function useSystemBrand(token: string): SystemBrand | null {
  const [brand, setBrand] = useState<SystemBrand | null>(cached);
  useEffect(() => {
    let live = true;
    platformApi.config(token).then((cfg) => { cached = { name: cfg.system_name, logo_url: cfg.logo_url }; if (live) setBrand(cached); }).catch(() => undefined);
    return () => { live = false; };
  }, [token]);
  return brand;
}
