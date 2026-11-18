/**
 * Bổ sung các hàm JavaScript mới cho trình duyệt cũ (17/11/2026). Bộ điều hướng trang (expo-router / React Navigation) gọi `Array.prototype.toSpliced`
 * (có từ Chrome 110, Safari 16, Firefox 115) và `findLast` / `findLastIndex` (Chrome 97, Safari 15.4); máy Windows 7/8.1 chỉ lên tới Chrome 109,
 * iPhone chưa lên iOS 16 thiếu các hàm này nên bấm menu / chuyển trang báo lỗi, trông như "mất chức năng". Mức tối thiểu sau khi vá: Chrome 80+, Safari 14.1+
 * (iOS 14.5+), Firefox 75+ (cú pháp của bản build). CI chạy `scripts/check-browser-support.cjs` trên bản build: gặp cú pháp mới hơn hoặc hàm mới chưa vá thì báo lỗi. Tệp này được nạp đầu tiên ở `app/_layout.tsx`;
 * chỉ thêm hàm khi trình duyệt chưa có, cài kiểu không liệt kê (giống hàm gốc) nên không ảnh hưởng trình duyệt mới.
 */
type AnyArray = unknown[];

function define(target: object, name: string, value: (...args: never[]) => unknown): void {
  // chỉ coi là đã có khi đúng là một hàm (có trình duyệt / tiện ích để thuộc tính tồn tại nhưng mang giá trị undefined)
  if (typeof (target as Record<string, unknown>)[name] === 'function') return;
  try {
    Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
  } catch {
    /* môi trường khóa prototype: bỏ qua */
  }
}

const toInt = (n: unknown): number => {
  const x = Math.trunc(Number(n));
  return Number.isFinite(x) ? x : 0;
};

const AP = Array.prototype as unknown as Record<string, unknown>;

define(AP, 'at', function at(this: AnyArray, index: number) {
  const i = toInt(index);
  const k = i >= 0 ? i : this.length + i;
  return k < 0 || k >= this.length ? undefined : this[k];
} as never);

define(AP, 'findLast', function findLast(this: AnyArray, fn: (v: unknown, i: number, a: AnyArray) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i -= 1) if (fn.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
} as never);

define(AP, 'findLastIndex', function findLastIndex(this: AnyArray, fn: (v: unknown, i: number, a: AnyArray) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i -= 1) if (fn.call(thisArg, this[i], i, this)) return i;
  return -1;
} as never);

define(AP, 'toReversed', function toReversed(this: AnyArray) {
  return Array.prototype.slice.call(this).reverse();
} as never);

define(AP, 'toSorted', function toSorted(this: AnyArray, compare?: (a: unknown, b: unknown) => number) {
  return Array.prototype.slice.call(this).sort(compare);
} as never);

define(AP, 'toSpliced', function toSpliced(this: AnyArray, start: number, deleteCount?: number, ...items: unknown[]) {
  const copy = Array.prototype.slice.call(this);
  if (arguments.length === 0) return copy;
  if (arguments.length === 1) copy.splice(start);
  else copy.splice(start, deleteCount as number, ...items);
  return copy;
} as never);

define(AP, 'with', function withAt(this: AnyArray, index: number, value: unknown) {
  const i = toInt(index);
  const k = i >= 0 ? i : this.length + i;
  if (k < 0 || k >= this.length) throw new RangeError('Invalid index');
  const copy = Array.prototype.slice.call(this);
  copy[k] = value;
  return copy;
} as never);

define(String.prototype as unknown as Record<string, unknown>, 'at', function at(this: string, index: number) {
  const s = String(this);
  const i = toInt(index);
  const k = i >= 0 ? i : s.length + i;
  return k < 0 || k >= s.length ? undefined : s.charAt(k);
} as never);

define(String.prototype as unknown as Record<string, unknown>, 'replaceAll', function replaceAll(this: string, search: string | RegExp, replacement: string) {
  if (search instanceof RegExp) {
    if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp');
    return String(this).replace(search, replacement);
  }
  return String(this).split(String(search)).join(replacement);
} as never);

define(Object as unknown as Record<string, unknown>, 'hasOwn', function hasOwn(obj: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(obj, key);
} as never);

// requestIdleCallback: Safari (iPhone, Mac) chưa có; một thư viện điều hướng gọi thẳng hàm này
const G = globalThis as unknown as Record<string, unknown>;
if (typeof G.requestIdleCallback !== 'function') {
  G.requestIdleCallback = (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, opts?: { timeout?: number }) => {
    const start = Date.now();
    return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) }), Math.min(opts?.timeout ?? 1, 1));
  };
  G.cancelIdleCallback = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
}

// crypto.randomUUID: có từ Chrome 92, Safari 15.4 (thư viện uuid gọi khi tạo mã)
const C = G.crypto as { randomUUID?: () => string; getRandomValues?: <T extends ArrayBufferView>(a: T) => T } | undefined;
if (C && typeof C.randomUUID !== 'function' && typeof C.getRandomValues === 'function') {
  define(C as unknown as object, 'randomUUID', function randomUUID() {
    const b = C.getRandomValues!(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } as never);
}

// Promise.withResolvers: Chrome 119, Safari 17.4
define(Promise as unknown as Record<string, unknown>, 'withResolvers', function withResolvers() {
  let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
} as never);

export {};
