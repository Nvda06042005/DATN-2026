/**
 * Đường dẫn riêng của trường (donga_<mã trường>_<tên>_<khu vực>, ví dụ donga_79765507_phumy_binhthanh).
 * Máy chủ là nơi tạo đường dẫn; ở đây chỉ nhận dạng đường dẫn.
 */
export const SCHOOL_SLUG = /^donga_\d{4,8}(?:_[a-z0-9_]{0,80})?$/;

export const isSchoolSlug = (value: unknown): value is string => typeof value === 'string' && SCHOOL_SLUG.test(value.toLowerCase());

/** Mã trường nằm ngay sau "donga_"; phần tên và khu vực chỉ để người đọc */
export const schoolCodeOfSlug = (slug: string): string | null => /^donga_(\d{4,8})/.exec(slug.toLowerCase())?.[1] ?? null;
