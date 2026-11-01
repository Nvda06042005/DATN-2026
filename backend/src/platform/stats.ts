/**
 * Thống kê mô tả và kiểm định Welch cho báo cáo so sánh nhóm thử nghiệm (Sprint 12, HK.AD.079). Chỉ dùng toán thuần (không thư viện):
 * giá trị p hai phía tính từ phân phối t qua hàm beta không đầy đủ (Numerical Recipes), đã đối chiếu với giá trị chuẩn trong kiểm thử.
 */
export const mean = (x: number[]): number | null => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : null);

/** Độ lệch chuẩn mẫu (chia n − 1); cần ít nhất 2 giá trị */
export function sd(x: number[]): number | null {
  if (x.length < 2) return null;
  const m = mean(x)!;
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
}

function lgamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, x = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) { y += 1; ser += cj / y; }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Hàm beta không đầy đủ chính quy I_x(a, b) */
export function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Giá trị p hai phía của thống kê t với df bậc tự do */
export const tTwoSidedP = (t: number, df: number): number => ibeta(df / (df + t * t), df / 2, 0.5);

export interface Summary { n: number; mean: number | null; sd: number | null }
export const summarize = (x: number[]): Summary => ({ n: x.length, mean: mean(x), sd: sd(x) });

export interface Welch { diff: number; t: number | null; df: number | null; p: number | null; cohen_d: number | null }

/** So sánh trung bình của b với a (b − a) bằng kiểm định Welch; thiếu dữ liệu hoặc phương sai bằng 0 thì chỉ trả hiệu số */
export function welch(a: number[], b: number[]): Welch | null {
  if (!a.length || !b.length) return null;
  const ma = mean(a)!, mb = mean(b)!, diff = mb - ma;
  const sa = sd(a), sb = sd(b);
  if (a.length < 2 || b.length < 2 || sa === null || sb === null) return { diff, t: null, df: null, p: null, cohen_d: null };
  const va = (sa * sa) / a.length, vb = (sb * sb) / b.length;
  const pooled = Math.sqrt(((a.length - 1) * sa * sa + (b.length - 1) * sb * sb) / (a.length + b.length - 2));
  const d = pooled > 0 ? diff / pooled : null;
  if (va + vb === 0) return { diff, t: null, df: null, p: null, cohen_d: d };
  const t = diff / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1));
  return { diff, t, df, p: tTwoSidedP(t, df), cohen_d: d };
}
