/* ★ **하늘 — 새 · 유성**(2026-11-15, 요청: "물이나 비 효과 수준으로 디테일하고 사실적으로 만들어야해 · 일단 유성과 새만 해보자") ──────────────────────────
 *
 * 자연 겹(nature9)의 첫 판은 새가 V 자 선 · 유성이 선 하나라 장난감 같았다. 여기서 둘만 다시 짓는다:
 *
 * 새 — 실제 작은 새 넷(참새 · 제비 · 방울새 · 파랑새)을 **위에서 본 몸**으로 한 번 굽는다(종마다 날갯짓 16칸 + 활공 · 접은 날개):
 *   머리 · 부리 · 눈 · 몸통(위 · 배 빛 · 등 줄무늬) · 꼬리(부채 · 제비는 갈래) · 날개(덮깃 → 첫째 날개깃 다섯 장의 갈라진 끝 · 날개 띠).
 *   날갯짓은 위 · 아래 치기에서 펼침 폭 · 뒤로 젖힘이 바뀐다(위에서 보면 내려칠 때 가장 넓다). 작은 새는 **튀듯 난다** — 날갯짓 0.4 ~ 0.6초 · 날개 접고 0.3초
 *   미끄러지며 그동안 높이가 오르내린다(그림자 거리 · 크기). 제비는 길게 활공한다. 무리는 한 길(굽은 비행)을 따르되 저마다 느린 흔들림 · 날갯짓 위상이 다르다.
 *   돌 때는 안쪽 날개가 짧아진다(기울임 원근). 땅에는 높이만큼 빛 반대쪽으로 비킨 흐린 그림자.
 *   소리 — 무리가 화면에 있으면 종마다 다른 울음을 몇 초 간격으로(배율이 클수록 크게 · 화면 자리로 좌우) — sfx9 birdCall9.
 *
 * 유성 — 머리(흰 핵 + 푸른 흰 광채) · 길게 가늘어지는 꼬리(흰 → 청록 → 끝은 주황빛으로 바래는 세 겹) · 떨어져 나가는 불티 · 지나간 자리에 잠시 남는
 *   흐린 흔적(이온 자국 — 1.5초에 걸쳐 퍼지며 사라짐) · 밝기는 빠르게 오르고 한 번 번쩍한 뒤 꺼진다(가물거림). 드물게 녹색 · 주황 불덩이(크고 느리다).
 *   유성우는 지도 밖 먼 복사점 하나에서 20 ~ 32초 동안 지도 전체에 거의 나란히 빗발친다(2026-11-18 · 옛: 한 점에서 사방으로 4 ~ 7개). 크기는 저마다 다르다.
 *   더하는 빛('lighter')으로 그린다. 유성은 우주 판에만 · 새는 우주 판 밖에만(nature9 drawNatureSky9).
 *
 * 둘 다 실 시각의 함수(씨앗 + 시각 칸) — 같은 장면은 다시 열어도 같다. 그리는 쪽은 nature9.drawNature9(땅 층 — 유성 · 새 그림자)와
 * drawSky9(몸 위 층 — 새)다.
 */

/* ── 씨앗 난수 ─────────────────────────────────────────────────────────────────────────────────────────────── */
export function rngOf9(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { a ^= seed.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const x = clamp01(v); return x * x * (3 - 2 * x); };

/* ── 새 ────────────────────────────────────────────────────────────────────────────────────────────────────── */
export type Species9 = "sparrow" | "swallow" | "finch" | "bluebird" | "dove";
interface Spec9 {
  back: string; back2: string; belly: string; cap: string; wing: string; prim: string; bar: string | null; tail: string; beak: string;
  /** 날개 아랫면(카메라를 등진 날개 · 꼬리) */
  under: string;
  /** 몸 길이 · 날개 편 폭(타일) · 날개 길쭉함(1 둥근 날개 · 1.4 뾰족) · 꼬리 갈래 */
  len: number; span: number; point: number; fork: boolean; streak: boolean;
  /** 날갯짓(Hz) · 한 번 치는 시간(초) · 접고 미끄러지는 시간(초) · 활공(제비) */
  hz: number; flap: number; rest: number; glide: boolean; speed: number;
}
const SPEC9: Record<Species9, Spec9> = {
  sparrow: { back: "#8b5e3c", back2: "#5d3b22", belly: "#d9cbb4", cap: "#7a6a5c", wing: "#9a6a43", prim: "#3e2a1c", bar: "#efe4cf", tail: "#5d4330", beak: "#3a3430", under: "#cdbb9f",
    len: 0.42, span: 0.58, point: 1.0, fork: false, streak: true, hz: 11, flap: 0.5, rest: 0.32, glide: false, speed: 3.6 },
  swallow: { back: "#1c2950", back2: "#0f1730", belly: "#efe8dc", cap: "#22325e", wing: "#1a2444", prim: "#0c1226", bar: null, tail: "#141d3a", beak: "#1a1a1a", under: "#56596a",
    len: 0.46, span: 0.78, point: 1.5, fork: true, streak: false, hz: 6.5, flap: 0.7, rest: 0.9, glide: true, speed: 5.4 },
  finch: { back: "#e8b820", back2: "#b9850f", belly: "#f6e27a", cap: "#1d1b18", wing: "#262420", prim: "#151412", bar: "#f4f1e6", tail: "#22201c", beak: "#e9a36a", under: "#a8a294",
    len: 0.36, span: 0.52, point: 1.0, fork: false, streak: false, hz: 12, flap: 0.42, rest: 0.36, glide: false, speed: 3.4 },
  bluebird: { back: "#2f63c8", back2: "#1d3f8a", belly: "#e58a4e", cap: "#3a74dc", wing: "#2a58b6", prim: "#152e66", bar: null, tail: "#24489a", beak: "#2a2a2a", under: "#9db0d6",
    len: 0.44, span: 0.62, point: 1.1, fork: false, streak: false, hz: 9, flap: 0.55, rest: 0.3, glide: false, speed: 3.9 },
  /* 흰 새(2026-11-15 ★ "흰 새 추가") — 흰 비둘기 꼴 · 크고 느린 날갯짓 · 길게 미끄러진다 · 날개깃 끝만 엷은 잿빛 */
  dove: { back: "#f4f3ef", back2: "#dedcd5", belly: "#fbfbf9", cap: "#f7f6f2", wing: "#f5f4f0", prim: "#d2d2cd", bar: null, tail: "#ecebe6", beak: "#e3a06a", under: "#f2f1ec",
    len: 0.5, span: 0.92, point: 1.15, fork: false, streak: false, hz: 5, flap: 0.9, rest: 0.75, glide: true, speed: 4.4 },
};
const SPECIES9: Species9[] = ["sparrow", "swallow", "finch", "bluebird", "dove"];

/* ★ 새는 3D 로 세워 45도 위에서 내려다본 그림으로 그린다(2026-11-15, 지적: "날개가 좀더 자연스러운 곡선으로 · 흰 새 추가 · 새는 투사각 45도 위쪽임을 잊지말기").
   옛 판(위에서 똑바로 본 평면 스프라이트를 화면에서 돌림)은 날갯짓이 '날개 폭이 줄었다 늘었다'로만 보였고 날개 꼴이 꺾은선 톱니였다.
   이제 몸 자(앞 x · 오른 y · 위 z)에 날개 꼴을 매끈한 곡선(앞전 활 · 둥근 끝 · 첫째 날개깃 손가락)으로 세우고, 어깨에서 위아래로 치는 각(팔 θ1 · 손 θ2 —
   손이 팔보다 늦게 따라와 날개가 휜다)으로 접은 뒤, 요잉 · 기울임을 주고 모델과 같은 사선 사영(바닥 y × sin45 · 높이 z × cos45 위로)으로 화면에 놓는다.
   날개가 카메라를 등지면 아랫면 색(under) · 빛(왼위)에 따라 낯 밝기. 몸통은 타원체 둘(가슴 · 허리)을 정확히 사영한 타원. */
const VIEW_S9 = Math.SQRT1_2;   // 바닥 눌림 sin45
const VIEW_C9 = Math.SQRT1_2;   // 높이 cos45
const SUN9 = ((): [number, number, number] => { const v: [number, number, number] = [-0.5, -0.45, 0.75]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; })();
const CAM9: [number, number, number] = [0, VIEW_C9, VIEW_S9];   // 장면 → 카메라(남쪽 위 45도)
function hexRgb9(hex: string): [number, number, number] { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbK9(hex: string, k: number, a = 1): string {
  const [r, g, b] = hexRgb9(hex); const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return a >= 1 ? `rgb(${f(r)},${f(g)},${f(b)})` : `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}
/** 몸 자 → 화면 — 몸 자(앞 · 오른 · 위, 타일) 를 기울임(bank) · 방향(hx, hy) 으로 돌려 사영한다. 돌려준 [화면 dx, dy(타일) · 깊이(+ 카메라 쪽)]. */
interface Pose9 { hx: number; hy: number; cb: number; sb: number }
function proj9(P: Pose9, f: number, r: number, u: number): [number, number, number] {
  const r2 = r * P.cb - u * P.sb; const u2 = r * P.sb + u * P.cb;
  const X = f * P.hx - r2 * P.hy; const Y = f * P.hy + r2 * P.hx;
  return [X, Y * VIEW_S9 - u2 * VIEW_C9, Y * VIEW_C9 + u2 * VIEW_S9];
}
function dir9(P: Pose9, f: number, r: number, u: number): [number, number, number] {
  const r2 = r * P.cb - u * P.sb; const u2 = r * P.sb + u * P.cb;
  return [f * P.hx - r2 * P.hy, f * P.hy + r2 * P.hx, u2];
}
const dot3 = (a: [number, number, number], b: [number, number, number]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 날개 자세 — θ1 팔(어깨) · θ2 손(손목 밖) 치켜 각(라디안 · + 위) · open(0 접음 ~ 1 펼침) · sweep(끝이 뒤로 젖힘). */
interface Wing9 { t1: number; t2: number; open: number; sweep: number }
export function wingPose9(mode: number, ph: number): Wing9 {
  if (mode === 1) return { t1: 0.07, t2: 0.15, open: 1, sweep: 0.12 };        // 활공
  if (mode === 2) return { t1: 0.1, t2: 0.0, open: 0.06, sweep: 1 };          // 접고 튀기
  const c = Math.cos(ph * TAU); const s = Math.sin(ph * TAU);
  const t1 = 0.18 + 0.72 * c;                // ph 0 맨 위(≈ 52°) · 0.5 맨 아래(≈ −31°)
  const up = clamp01(-s);                     // 올려치기(0.5 ~ 1) — 손을 접어 끌어올린다
  return { t1, t2: t1 + 0.5 * s, open: 1 - 0.38 * up, sweep: 0.18 + 0.5 * up };
}
/** 날개 위 한 점 — q(0 어깨 ~ 1 끝) · c(0 앞전 ~ 1 뒷전). 몸 자(앞 · 오른 · 위)로 돌려준다. side −1 왼 · +1 오. */
function wingPt9(sp: Spec9, W: Wing9, L: number, sHalf: number, side: number, q: number, c: number): [number, number, number] {
  const reach = sHalf * (0.2 + 0.8 * W.open);
  /* 앞전 — 어깨에서 손목까지 앞으로 부푼 활 · 끝으로 갈수록 뒤로 젖힌다 */
  const back = L * (0.08 + 0.36 * W.sweep) * Math.sqrt(sp.point);
  const xle = L * 0.1 + L * 0.06 * Math.sin(Math.PI * Math.min(1, q * 1.15)) - back * q * q;
  /* 날개 폭(시위) — 뿌리에서 넓고 끝은 둥글게(제비는 길고 뾰족하게) */
  const c0 = L * 0.38 * (1 - 0.14 * (sp.point - 1)) * (0.72 + 0.28 * W.open);
  const pe = 0.5 + 0.35 * (sp.point - 1);
  const ch = c0 * Math.pow(Math.max(0, 1 - Math.pow(q, 2.2 / sp.point)), pe) + L * 0.02 * (1 - q);
  let xte = xle - ch;
  if (c > 0.999) {
    /* 뒷전 — 첫째 날개깃 손가락(둥근 끝 · 펼칠수록 벌어진다) · 둘째 날개깃의 잔 물결 */
    if (sp.point < 1.3 && q > 0.55) { const k = (q - 0.55) / 0.45; xte += L * 0.04 * W.open * (1 - Math.pow(Math.abs(Math.sin(Math.PI * 4.5 * k)), 0.35)) * smooth(k * 5) * (1 - k * 0.5); }
    if (q < 0.58) xte += L * 0.009 * (1 - Math.pow(Math.abs(Math.sin((Math.PI * 6 * q) / 0.58)), 0.5));
  }
  const x = xle + (xte - xle) * c;
  /* 펼친 길이를 굽은 날개로 — 각이 어깨 θ1 에서 손 θ2 로 매끈히 옮아간다(적분) */
  const N = 10; let yy = 0; let zz = 0; const s1 = q * reach;
  for (let i = 0; i < N; i += 1) { const qq = (q * (i + 0.5)) / N; const th = W.t1 + (W.t2 - W.t1) * smooth((qq - 0.25) / 0.5); yy += Math.cos(th) * s1 / N; zz += Math.sin(th) * s1 / N; }
  return [x, side * (L * 0.07 + yy), zz + L * 0.02];
}
/** 낯 빛 — 위낯 법선(팔 · 손의 평균 각)이 카메라를 보면 윗면 색 · 아니면 아랫면. 밝기는 왼위 빛. */
function wingFace9(P: Pose9, side: number, th: number): { top: boolean; k: number } {
  const n = dir9(P, 0, -side * Math.sin(th), Math.cos(th));
  const top = dot3(n, CAM9) >= 0; const nn: [number, number, number] = top ? n : [-n[0], -n[1], -n[2]];
  return { top, k: 0.72 + 0.42 * Math.max(0, dot3(nn, SUN9)) };
}
/** 몸 자의 타원체(가운데 c · 반지름 a 앞 · b 옆 · h 위) → 화면 타원(가운데 · 두 축 · 회전). */
function ellipse9(P: Pose9, cx: number, cz: number, a: number, b: number, h: number): [number, number, number, number, number, number] {
  const [x0, y0, d0] = proj9(P, cx, 0, cz);
  const ca = proj9(P, a, 0, 0); const cb = proj9(P, 0, b, 0); const cc = proj9(P, 0, 0, h);
  const pa = [ca[0] - 0, ca[1] - 0]; const pb = [cb[0], cb[1]]; const pc = [cc[0], cc[1]];
  /* 사영 타원 = A Aᵀ 의 고유 분해(A = 세 축의 화면 상) — 상수 항(proj 원점 0)이라 위 상은 축 벡터 그대로 */
  const m11 = pa[0] * pa[0] + pb[0] * pb[0] + pc[0] * pc[0]; const m12 = pa[0] * pa[1] + pb[0] * pb[1] + pc[0] * pc[1]; const m22 = pa[1] * pa[1] + pb[1] * pb[1] + pc[1] * pc[1];
  const tr = (m11 + m22) / 2; const df = Math.sqrt(Math.max(0, ((m11 - m22) / 2) ** 2 + m12 * m12));
  const l1 = tr + df; const l2 = Math.max(1e-9, tr - df);
  const rot = Math.atan2(l1 - m11, m12 || 1e-9);
  return [x0, y0, Math.sqrt(l1), Math.sqrt(l2), Math.abs(m12) < 1e-9 ? (m11 >= m22 ? 0 : Math.PI / 2) : rot, d0];
}
/**
 * 한 마리 그리기 — (sx, sy) = 몸 가운데의 화면 자리 · px = 타일 하나의 화면 px · L 몸 길이 · sHalf 반 날개 폭(타일).
 * 차례: 깊이(카메라 쪽 +)가 낮은 것부터 — 먼 날개 · 꼬리 · 몸 · 머리 · 가까운 날개.
 */
function drawBird3d9(g: CanvasRenderingContext2D, sp: Spec9, P: Pose9, W: Wing9, sx: number, sy: number, px: number, L: number, sHalf: number, tailSpread: number): void {
  const S = (p: [number, number, number]): [number, number] => [sx + p[0] * px, sy + p[1] * px];
  const wingDraw = (side: number): void => {
    const pt = (q: number, c: number): [number, number] => { const w = wingPt9(sp, W, L, sHalf, side, q, c); return S(proj9(P, w[0], w[1], w[2])); };
    const region = (q0: number, q1: number, c0: number, c1: number, n: number): void => {
      g.beginPath();
      for (let i = 0; i <= n; i += 1) { const p = pt(q0 + ((q1 - q0) * i) / n, c0); if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
      for (let i = n; i >= 0; i -= 1) { const p = pt(q0 + ((q1 - q0) * i) / n, c1); g.lineTo(p[0], p[1]); }
      g.closePath();
    };
    const arm = wingFace9(P, side, W.t1); const hand = wingFace9(P, side, (W.t1 + W.t2) / 2 + (W.t2 - W.t1) * 0.3);
    const col = (f: { top: boolean; k: number }, hex: string, under: string): string => rgbK9(f.top ? hex : under, f.k);
    /* 바탕 — 팔 · 손 따로(손이 다른 낯을 보이면 색이 갈린다) */
    g.fillStyle = col(arm, sp.wing, sp.under); region(0, 0.56, 0, 1, 24); g.fill();
    g.fillStyle = col(hand, sp.wing, sp.under); region(0.5, 1, 0, 1, 40); g.fill();
    if (arm.top || hand.top) {
      /* 윗면 — 덮깃(앞) 밝게 · 첫째 날개깃(끝) 짙게 · 둘째 날개깃(뒷전) 조금 짙게 · 날개 띠 */
      if (arm.top) { g.fillStyle = rgbK9(sp.wing, arm.k * 1.12, 0.55); region(0, 0.6, 0, 0.42, 20); g.fill(); g.fillStyle = rgbK9(sp.prim, arm.k, 0.35); region(0.04, 0.56, 0.68, 1, 20); g.fill(); }
      if (hand.top) { g.fillStyle = rgbK9(sp.prim, hand.k); region(0.54, 1, 0.3, 1, 36); g.fill(); g.fillStyle = rgbK9(sp.prim, hand.k, 0.5); region(0.5, 0.58, 0.3, 1, 4); g.fill(); }
      if (sp.bar && arm.top) { g.fillStyle = rgbK9(sp.bar, arm.k, 0.85); region(0.06, 0.62, 0.42, 0.5, 16); g.fill(); }
      /* 깃대 — 첫째 날개깃의 가는 줄 */
      if (hand.top) {
        g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = Math.max(0.5, L * px * 0.008);
        for (let k = 0; k < 5; k += 1) { const q = 0.6 + k * 0.085; const a = pt(q - 0.04, 0.32); const b = pt(q, 0.98); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      }
      /* 앞전 밝은 테 */
      g.strokeStyle = rgbK9(sp.wing, 1.45, 0.55); g.lineWidth = Math.max(0.6, L * px * 0.012);
      g.beginPath(); for (let i = 0; i <= 24; i += 1) { const p = pt(i / 24, 0); if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } g.stroke();
    } else {
      /* 아랫면 — 겨드랑이 그늘 · 날개깃 끝만 조금 짙게 */
      g.fillStyle = rgbK9(sp.prim, hand.k, 0.3); region(0.62, 1, 0.45, 1, 24); g.fill();
    }
  };
  const tailDraw = (): void => {
    const tb = -L * 0.26; const tl = L * (sp.fork ? 0.6 : 0.36); const tw = L * (0.07 + 0.1 * tailSpread) * (sp.fork ? 1.2 : 1);
    const pts: [number, number][] = [];
    const T = (f: number, r: number): void => { pts.push(S(proj9(P, f, r, -L * 0.01 + (f - tb) * 0.06))); };
    T(tb + L * 0.04, -L * 0.07);
    if (sp.fork) { for (let i = 0; i <= 8; i += 1) { const a = i / 8; T(tb - tl * (0.42 + 0.58 * Math.pow(1 - a, 1.6)), -tw * (0.25 + 1.05 * Math.pow(1 - a, 0.8))); } T(tb - tl * 0.38, 0); for (let i = 8; i >= 0; i -= 1) { const a = i / 8; T(tb - tl * (0.42 + 0.58 * Math.pow(1 - a, 1.6)), tw * (0.25 + 1.05 * Math.pow(1 - a, 0.8))); } }
    else { for (let i = 0; i <= 16; i += 1) { const a = -1 + (2 * i) / 16; T(tb - tl * (0.86 + 0.14 * Math.cos(a * 1.4)) + L * 0.012 * Math.abs(Math.sin(a * Math.PI * 3.5)), a * tw); } }
    T(tb + L * 0.04, L * 0.07);
    const up = dot3(dir9(P, 0, 0, 1), CAM9) >= 0;
    g.fillStyle = rgbK9(up ? sp.tail : sp.under, 0.95); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
  };
  const bodyDraw = (): void => {
    const bw = L * 0.13;
    const up = S(proj9(P, 0, 0, bw)); const dn = S(proj9(P, 0, 0, -bw));
    for (const [cx, a, b] of [[-L * 0.12, L * 0.21, bw * 0.78], [L * 0.06, L * 0.24, bw]] as [number, number, number][]) {
      const e = ellipse9(P, cx, 0, a, b, b * 0.92);
      const gr = g.createLinearGradient(up[0], up[1], dn[0], dn[1] + (dn[1] - up[1]) * 0.2);
      gr.addColorStop(0, rgbK9(sp.back, 1.08)); gr.addColorStop(0.5, sp.back2); gr.addColorStop(1, sp.belly);
      g.fillStyle = gr; g.beginPath(); g.ellipse(sx + e[0] * px, sy + e[1] * px, e[2] * px, e[3] * px, e[4], 0, TAU); g.fill();
    }
    if (sp.streak) {
      g.strokeStyle = "rgba(35,18,8,0.55)"; g.lineWidth = Math.max(0.5, L * px * 0.012);
      for (const r of [-0.45, 0, 0.45]) { g.beginPath(); for (let i = 0; i <= 6; i += 1) { const f = L * (0.2 - i * 0.075); const p = S(proj9(P, f, r * bw * (1 - i * 0.08), bw * 0.9)); if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } g.stroke(); }
    }
    /* 등 빛(왼위) */
    const e = ellipse9(P, -L * 0.02, 0, L * 0.3, bw, bw * 0.92);
    const hx = sx + (e[0] - 0.25 * e[2] * 0.5) * px; const hy = sy + (e[1] - 0.25 * e[3]) * px;
    const sh = g.createRadialGradient(hx, hy, 0, sx + e[0] * px, sy + e[1] * px, e[2] * px * 1.05);
    sh.addColorStop(0, "rgba(255,255,255,0.28)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.22)");
    g.fillStyle = sh; g.beginPath(); g.ellipse(sx + e[0] * px, sy + e[1] * px, e[2] * px, e[3] * px, e[4], 0, TAU); g.fill();
  };
  const headDraw = (): void => {
    const hr = L * 0.105; const hc = proj9(P, L * 0.33, 0, L * 0.03); const [cx, cy] = S(hc);
    const fw = dir9(P, 1, 0, 0);
    const beak = (): void => {
      const b0 = S(proj9(P, L * 0.33 + hr * 0.8, -hr * 0.3, L * 0.02)); const b1 = S(proj9(P, L * 0.33 + hr * 1.65, 0, L * 0.015)); const b2 = S(proj9(P, L * 0.33 + hr * 0.8, hr * 0.3, L * 0.02));
      const b3 = S(proj9(P, L * 0.33 + hr * 0.8, 0, L * 0.03 + hr * 0.28));
      g.fillStyle = sp.beak; g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b3[0], b3[1]); g.lineTo(b2[0], b2[1]); g.lineTo(b1[0], b1[1]); g.closePath(); g.fill();
    };
    if (dot3(fw, CAM9) < 0) beak();   // 부리가 등을 보이면 머리 뒤(먼저)
    const hg = g.createRadialGradient(cx - hr * px * 0.35, cy - hr * px * 0.4, hr * px * 0.1, cx, cy, hr * px);
    hg.addColorStop(0, rgbK9(sp.cap, 1.35)); hg.addColorStop(0.6, sp.cap); hg.addColorStop(1, rgbK9(sp.cap, 0.72));
    g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hr * px, 0, TAU); g.fill();
    for (const sd of [-1, 1]) {
      const e = proj9(P, L * 0.33 + hr * 0.42, sd * hr * 0.72, L * 0.03 + hr * 0.22);
      if (e[2] < hc[2] - hr * 0.1) continue;   // 머리 뒤로 돈 눈은 안 보인다
      const [ex, ey] = S(e); const er = Math.max(0.5, hr * px * 0.16);
      g.fillStyle = "#0a0a0a"; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(ex - er * 0.3, ey - er * 0.35, er * 0.35, 0, TAU); g.fill();
    }
    if (dot3(fw, CAM9) >= 0) beak();
  };
  /* 깊이 차례 — 날개마다 가운데 깊이 */
  const depth = (side: number): number => { let d = 0; for (const q of [0.3, 0.6, 0.9]) { const w = wingPt9(sp, W, L, sHalf, side, q, 0.5); d += proj9(P, w[0], w[1], w[2])[2]; } return d / 3; };
  const dl = depth(-1); const dr = depth(1);
  const parts: [number, () => void][] = [
    [dl, () => wingDraw(-1)], [dr, () => wingDraw(1)],
    [-1e-6 + Math.min(0, proj9(P, -L * 0.4, 0, 0)[2]), tailDraw], [0, bodyDraw], [proj9(P, L * 0.33, 0, L * 0.03)[2] + 1e-6, headDraw],
  ];
  parts.sort((a, b) => a[0] - b[0]);
  g.lineJoin = "round"; g.lineCap = "round";
  for (const [, f] of parts) f();
}

/** 무리 — 14초 칸마다(빈 칸 30%) · 종 하나 · 3 ~ 7마리. 길은 지도 한 변에서 맞은 변으로 굽이친다. */
interface Flock9 { id: number; t0: number; dur: number; p0: [number, number]; p1: [number, number]; amp: number; wav: number; ph: number; n: number; sp: Species9; alt: number }
function flockOf9(slot: number, w: number, h: number): Flock9 | null {
  const R = rngOf9("flock" + slot);
  if (R() < 0.3) return null;
  const side = Math.floor(R() * 4); const a = 0.1 + R() * 0.8; const b = 0.1 + R() * 0.8;
  const p0: [number, number] = side === 0 ? [-6, a * h] : side === 1 ? [w + 6, a * h] : side === 2 ? [a * w, -6] : [a * w, h + 6];
  const p1: [number, number] = side === 0 ? [w + 6, b * h] : side === 1 ? [-6, b * h] : side === 2 ? [b * w, h + 6] : [b * w, -6];
  const sp = SPECIES9[Math.floor(R() * SPECIES9.length)];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  return { id: slot, t0: slot * 14 + R() * 8, dur: len / (SPEC9[sp].speed * (0.85 + R() * 0.3)), p0, p1, amp: 4 + R() * 10, wav: 0.6 + R() * 1.4, ph: R() * TAU,
    n: 3 + Math.floor(R() * 5), sp, alt: 2.2 + R() * 2.5 };
}
/** 무리 길의 한 점 · 진행 방향(단위) — u 0 ~ 1. 굽이는 직선에 수직으로 두 겹 사인. */
function flockAt9(F: Flock9, u: number): [number, number, number, number] {
  const dx = F.p1[0] - F.p0[0]; const dy = F.p1[1] - F.p0[1]; const L = Math.hypot(dx, dy) || 1; const ux = dx / L; const uy = dy / L;
  const off = (v: number): number => F.amp * (Math.sin(v * TAU * F.wav + F.ph) * 0.7 + Math.sin(v * TAU * F.wav * 2.3 + F.ph * 1.7) * 0.3) * Math.sin(Math.PI * v);
  const e = 1e-3; const o0 = off(u); const o1 = off(Math.min(1, u + e));
  const x = F.p0[0] + dx * u - uy * o0; const y = F.p0[1] + dy * u + ux * o0;
  const x1 = F.p0[0] + dx * (u + e) - uy * o1; const y1 = F.p0[1] + dy * (u + e) + ux * o1;
  const hl = Math.hypot(x1 - x, y1 - y) || 1;
  return [x, y, (x1 - x) / hl, (y1 - y) / hl];
}
/** 한 마리의 지금 — 자리(타일) · 방향 · 높이(타일) · 칸 · 돌기(−1 ~ 1). */
interface BirdNow9 { x: number; y: number; hx: number; hy: number; z: number; mode: number; ph: number; bank: number; sp: Species9; scale: number }
function birdsOf9(F: Flock9, tSec: number): BirdNow9[] {
  const out: BirdNow9[] = [];
  const s = SPEC9[F.sp]; const R = rngOf9("bf" + F.id);
  for (let i = 0; i < F.n; i += 1) {
    const lag = i === 0 ? 0 : 0.6 + R() * 1.6; const lat = (i === 0 ? 0 : (R() - 0.5) * 3.2); const ph = R() * 10; const sc = 0.88 + R() * 0.24;
    const t = tSec - lag / s.speed;
    const u = (t - F.t0) / F.dur; if (u < 0 || u > 1) continue;
    const [x, y, hx, hy] = flockAt9(F, u);
    const [, , hx2, hy2] = flockAt9(F, Math.min(1, u + 0.01));
    const bank = Math.max(-1, Math.min(1, (hx * hy2 - hy * hx2) * 40));
    /* 개체마다 느린 흔들림(무리 속 자리 바꿈) */
    const wob = Math.sin(t * 0.7 + ph) * 0.45; const wob2 = Math.sin(t * 0.53 + ph * 2) * 0.35;
    const bx = x - hy * (lat + wob) + hx * wob2; const by = y + hx * (lat + wob) + hy * wob2;
    /* 날갯짓 박자 — 튀는 비행: [치기 flap 초][접음/활공 rest 초] */
    const cyc = s.flap + s.rest; const tc = ((t + ph) % cyc + cyc) % cyc;
    let mode = 0; let fph = 0; let z = F.alt;
    if (tc < s.flap) { fph = (tc * s.hz) % 1; z += 0.35 * smooth(tc / s.flap); }
    else { mode = s.glide ? 1 : 2; z += 0.35 * (1 - smooth((tc - s.flap) / s.rest)); }
    out.push({ x: bx, y: by, hx, hy, z, mode, ph: fph, bank, sp: F.sp, scale: sc });
  }
  return out;
}
export const SKY9 = { lastCall: new Map<number, number>() };
/** ★ 새 크기 배수(2026-11-18, 요청: "새 크기 줄이기") — 몸 · 그림자 모두. 옛 1(종마다 펼친 폭 0.52 ~ 0.92 타일). 무리 간격 · 높이는 그대로. */
const BIRD_K9 = 0.65;

/**
 * 새 그리기 — 땅 층(shadow 참: 그림자만) · 몸 위 층(shadow 거짓: 새). ox · oy = 지도 (0, 0) 의 화면 자리 · tp = 타일 화면 px.
 * 빛은 왼위(높이 1 타일당 그림자가 오른아래로 0.55 · 0.7 타일 비킨다).
 */
export function drawBirds9(ctx: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number, shadow: boolean,
  call: ((sp: Species9, pan: number, vol: number) => void) | null): void {
  const slot0 = Math.floor(tSec / 14);
  for (let sl = slot0 - 8; sl <= slot0; sl += 1) {
    const F = flockOf9(sl, w, h); if (!F) continue;
    const birds = birdsOf9(F, tSec); if (!birds.length) continue;
    let vis = false; let sxSum = 0;
    for (const b of birds) {
      const sx = ox + b.x * tp; const sy = oy + (b.y - b.z * 0.35) * tp;
      if (sx > -60 && sx < cw + 60 && sy > -60 && sy < ch + 60) { vis = true; sxSum += sx; }
    }
    if (!vis) continue;
    if (!shadow && call) {
      const last = SKY9.lastCall.get(F.id) ?? -1e9; const R = rngOf9("call" + F.id + Math.floor(tSec / 3));
      if (tSec - last > 2.2 + R() * 3.5) { SKY9.lastCall.set(F.id, tSec); call(F.sp, Math.max(-1, Math.min(1, (sxSum / birds.length / Math.max(1, cw)) * 2 - 1)), Math.min(1, tp / 40)); }
    }
    const s = SPEC9[F.sp];
    for (const b of birds) {
      const size = s.span * tp * b.scale * BIRD_K9 * (1 + b.z * 0.03);   // 높을수록 조금 크다(눈에 가깝다)
      if (size < 2) continue;
      if (shadow) {
        const sx = ox + (b.x + b.z * 0.55) * tp; const sy = oy + (b.y + b.z * 0.7) * tp;
        const sw = size * (b.mode === 2 ? 0.25 : 0.45); const blur = 1 + b.z * 0.12;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sw * blur);
        gr.addColorStop(0, `rgba(0,0,0,${0.22 / blur})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(sx, sy, sw * blur, sw * blur * 0.55, Math.atan2(b.hy, b.hx) + Math.PI / 2, 0, TAU); ctx.fill();
        continue;
      }
      const sx = ox + b.x * tp; const sy = oy + (b.y - b.z * 0.35) * tp;   // 높이는 화면 위로(평면 보기의 눌림)
      const k = b.scale * BIRD_K9 * (1 + b.z * 0.03);
      const W = wingPose9(b.mode, b.ph);
      const roll = -b.bank * 0.6;   // 오른쪽으로 돌면 오른 날개가 내려간다
      const tail = b.mode === 1 ? 0.9 : b.mode === 2 ? 0.25 : 0.45 + 0.3 * clamp01(Math.sin(b.ph * TAU));
      drawBird3d9(ctx, s, { hx: b.hx, hy: b.hy, cb: Math.cos(roll), sb: Math.sin(roll) }, W, sx, sy, tp, s.len * k, (s.span / 2) * k, tail);
    }
  }
}

/* ── 유성 ──────────────────────────────────────────────────────────────────────────────────────────────────── */
interface Meteor9 { t0: number; dur: number; x0: number; y0: number; dx: number; dy: number; len: number; mag: number; hue: number; seed: number; sz: number }
/** ★ 크기 다양(2026-11-18, 요청: "유성은 크기는 좀 다양화") — 작은 것이 잦고 큰 것은 드물다(0.45 ~ 1.8 · 가운데 ≈ 0.7). 머리 · 꼬리 폭 · 흔적 · 불티 · 길이를 함께 키운다.
 *  옛: 크기는 늘 같고 밝기(mag 0.7 ~ 1.5)만 달랐다. */
const meteorSz9 = (R: () => number): number => 0.45 + 1.35 * Math.pow(R(), 2.4);
/** 홀로 떨어지는 유성 — 3초 칸마다 4할 없음 · 6할 하나. 불덩이(녹 · 주황 · 크고 느림)는 6%.
 *  ★ 한 점에서 여럿(옛 1할 — 한 복사점에서 사방으로 4 ~ 7개)은 걷었다(2026-11-18, 요청: "한곳에서 여러개 나오는 유성은 제거하고 대신 유성우를") → showerOf9. */
function meteorsOf9(slot: number, spaceTiles: number[], w: number): Meteor9[] {
  const R = rngOf9("met" + slot + ":" + w); const out: Meteor9[] = [];
  if (R() < 0.4 || !spaceTiles.length) return out;
  const fire = R() < 0.06;
  const ti = spaceTiles[Math.floor(R() * spaceTiles.length)];
  const ang = 0.35 + R() * 1.0 + (R() < 0.3 ? Math.PI * 0.5 : 0);
  const sz = fire ? 1.5 + R() * 0.4 : meteorSz9(R);
  out.push({ t0: slot * 3 + R() * 2.2, dur: fire ? 1.6 + R() * 0.8 : (0.45 + R() * 0.6) * (0.8 + 0.25 * sz), x0: (ti % w) + R(), y0: Math.floor(ti / w) + R(),
    dx: Math.cos(ang), dy: Math.sin(ang), len: fire ? 14 + R() * 10 : (5 + R() * 7) * (0.6 + 0.5 * sz), mag: fire ? 2.2 : 0.6 + R() * 0.5 + 0.35 * sz,
    hue: fire ? (R() < 0.6 ? 125 : 28) : 205 + R() * 25, seed: R() * 1000, sz });
  return out;
}
/** ★ 유성우(2026-11-18) — 60초 칸마다 반 · 20 ~ 32초(칸 안에서 끝난다). 지도 밖 멀리(긴 변의 2.5배) 복사점 하나에서 뻗어 화면에선 **거의 나란히** 빗발친다
 *  (실제 유성우처럼 복사점에서 멀수록 살짝 벌어진다 · 방향은 화면 아래쪽 반원). 세기는 종 모양(가운데가 가장 잦다) — 한창일 때 우주 칸 200개당 초당 하나(지도 전체 · 적어도 넷 — PC 한 화면에 초당 서넛).
 *  유성우 유성은 빠르고(0.25 ~ 0.55초) 대개 작다 · 5% 는 밝고 크다. 지도 어디서나 같은 시각에 내린다(실 시각 함수 · 씨앗). */
const SHOWER_SLOT9 = 60;
interface Shower9 { id: number; t0: number; dur: number; rx: number; ry: number; hue: number }
function showerOf9(slot: number, w: number, h: number): Shower9 | null {
  const R = rngOf9("shw" + slot + ":" + w);
  if (R() < 0.5) return null;
  const dur = 20 + R() * 12; const ang = 0.3 + R() * (Math.PI - 0.6); const D = 2.5 * Math.max(w, h);
  return { id: slot, t0: slot * SHOWER_SLOT9 + R() * (SHOWER_SLOT9 - dur), dur, rx: w / 2 - Math.cos(ang) * D, ry: h / 2 - Math.sin(ang) * D, hue: 200 + R() * 20 };
}
const showerMemo9 = new Map<string, Meteor9[]>();
/** 유성우의 k 번째 1초 — 그 초에 떨어지는 유성들(외워 둔다 · 256 칸). */
function showerSec9(S: Shower9, k: number, spaceTiles: number[], w: number): Meteor9[] {
  const key = S.id + ":" + k + ":" + w + ":" + spaceTiles.length;
  const hit = showerMemo9.get(key); if (hit) return hit;
  const R = rngOf9("shs" + key); const out: Meteor9[] = [];
  const I = Math.pow(Math.sin(Math.PI * clamp01((k + 0.5) / S.dur)), 1.6);
  const n = Math.floor(Math.max(4, spaceTiles.length / 200) * I + R());
  for (let i = 0; i < n && spaceTiles.length; i += 1) {
    const ti = spaceTiles[Math.floor(R() * spaceTiles.length)]; const x0 = (ti % w) + R(); const y0 = Math.floor(ti / w) + R();
    const ex = x0 - S.rx; const ey = y0 - S.ry; const el = Math.hypot(ex, ey) || 1;
    const bright = R() < 0.05; const sz = bright ? 1.4 + R() * 0.4 : meteorSz9(R) * 0.9;
    out.push({ t0: S.t0 + k + R(), dur: (0.25 + R() * 0.3) * (0.8 + 0.3 * sz), x0, y0, dx: ex / el, dy: ey / el, len: (4 + R() * 6) * (0.6 + 0.5 * sz),
      mag: bright ? 1.6 : 0.5 + R() * 0.4 + 0.3 * sz, hue: S.hue + (R() - 0.5) * 14, seed: R() * 1000, sz });
  }
  showerMemo9.set(key, out);
  if (showerMemo9.size > 256) { const k0 = showerMemo9.keys().next().value; if (k0 !== undefined) showerMemo9.delete(k0); }
  return out;
}
let headSpr9: HTMLCanvasElement | null = null;
function headGlow9(): HTMLCanvasElement {
  if (headSpr9) return headSpr9;
  const S = 128; const c = document.createElement("canvas"); c.width = S; c.height = S; const g = c.getContext("2d") as CanvasRenderingContext2D;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.08, "rgba(250,252,255,0.95)"); gr.addColorStop(0.22, "rgba(190,215,255,0.45)");
  gr.addColorStop(0.5, "rgba(120,160,255,0.12)"); gr.addColorStop(1, "rgba(80,120,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  headSpr9 = c; return c;
}
/** 유성 그리기(하늘 층 · 우주 칸 위) — 더하는 빛. w · h = 지도 타일 · cw · ch = 캔버스 CSS 크기(화면 밖 유성은 건너뛴다 — 유성우는 지도 전체에 내린다). */
export function drawMeteors9(ctx: CanvasRenderingContext2D, spaceTiles: number[], w: number, h: number, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number): void {
  if (!spaceTiles.length) return;
  const list: Meteor9[] = [];
  const slot0 = Math.floor(tSec / 3);
  for (let sl = slot0 - 2; sl <= slot0; sl += 1) for (const m of meteorsOf9(sl, spaceTiles, w)) list.push(m);
  const ss0 = Math.floor(tSec / SHOWER_SLOT9);
  for (let ss = ss0 - 1; ss <= ss0; ss += 1) {
    const S = showerOf9(ss, w, h); if (!S) continue;
    const k1 = Math.floor(tSec - S.t0); const kN = Math.ceil(S.dur) - 1;
    for (let k = Math.max(0, k1 - 4); k <= Math.min(kN, k1); k += 1) for (const m of showerSec9(S, k, spaceTiles, w)) list.push(m);
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  {
    for (const m of list) {
      const age = tSec - m.t0; const trainLife = 1.6 * m.mag;
      if (age < 0 || age > m.dur + trainLife) continue;
      { const mg = (1.2 + m.sz) * tp; const ax = ox + m.x0 * tp; const ay = oy + m.y0 * tp; const bx = ax + m.dx * m.len * tp; const by = ay + m.dy * m.len * tp;
        if (Math.max(ax, bx) < -mg || Math.min(ax, bx) > cw + mg || Math.max(ay, by) < -mg || Math.min(ay, by) > ch + mg) continue; }
      const u = clamp01(age / m.dur);
      /* 밝기 — 빠르게 오르고(15%) 가운데 한 번 번쩍(flare) · 끝으로 꺼짐 · 가물거림 */
      const R = rngOf9("mf" + m.seed);
      const flareAt = 0.45 + R() * 0.3;
      const flick = 0.85 + 0.15 * Math.sin(age * 90 + m.seed) * Math.sin(age * 37);
      const lum = age > m.dur ? 0 : smooth(u / 0.15) * (1 - smooth((u - 0.75) / 0.25)) * (1 + 0.8 * Math.exp(-((u - flareAt) ** 2) / 0.004)) * flick * m.mag;
      const hx = m.x0 + m.dx * m.len * u; const hy = m.y0 + m.dy * m.len * u;
      const X = ox + hx * tp; const Y = oy + hy * tp;
      /* ① 남는 흔적(이온 자국) — 지나간 자리를 따라 흐린 띠 · 지난 지 오래될수록 넓고 흐리다 */
      const trailEnd = Math.min(u, 1);
      const segs = 14;
      for (let k = 0; k < segs; k += 1) {
        const a0 = (k / segs) * trailEnd; const a1 = ((k + 1) / segs) * trailEnd;
        const passed = age - a1 * m.dur;   // 그 자리를 지난 뒤 흐른 시간
        const al = 0.16 * m.mag * Math.exp(-passed / (0.55 * m.mag)) * (1 - a1 * 0.4);
        if (al < 0.01) continue;
        const wid = tp * m.sz * (0.05 + 0.1 * Math.min(1, passed / 1.2));
        ctx.strokeStyle = `hsla(${m.hue},70%,70%,${al})`; ctx.lineWidth = Math.max(1, wid); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(ox + (m.x0 + m.dx * m.len * a0) * tp, oy + (m.y0 + m.dy * m.len * a0) * tp);
        ctx.lineTo(ox + (m.x0 + m.dx * m.len * a1) * tp, oy + (m.y0 + m.dy * m.len * a1) * tp); ctx.stroke();
      }
      if (lum <= 0.01) continue;
      /* ② 꼬리 — 세 겹(넓고 흐린 빛 · 중간 청록 · 가는 흰 핵) · 머리에서 멀수록 가늘고 끝은 주황빛으로 바랜다 */
      const tail = Math.min(u, 0.6) * m.len * (0.6 + 0.4 * Math.min(1, lum));
      const layers: [number, string, string, number][] = [
        [0.34, `hsla(${m.hue},80%,65%,${0.18 * lum})`, `hsla(${m.hue},80%,60%,0)`, 1],
        [0.14, `hsla(${m.hue},70%,82%,${0.55 * Math.min(1, lum)})`, "hsla(30,90%,60%,0)", 1],
        [0.05, `rgba(255,255,255,${Math.min(1, 0.95 * lum)})`, "rgba(255,240,220,0)", 0.55],
      ];
      for (const [wd, c0, c1, frac] of layers) {
        const ex = X - m.dx * tail * frac * tp; const ey = Y - m.dy * tail * frac * tp;
        const gr = ctx.createLinearGradient(X, Y, ex, ey); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        /* 가늘어지는 꼬리 — 머리 쪽 폭 wd · 끝 0 인 사다리꼴 */
        const nx = -m.dy; const ny = m.dx; const hw = Math.max(0.6, wd * tp * m.sz * (0.7 + 0.3 * Math.min(1, lum)));
        ctx.fillStyle = gr; ctx.beginPath();
        ctx.moveTo(X + nx * hw, Y + ny * hw); ctx.lineTo(ex, ey); ctx.lineTo(X - nx * hw, Y - ny * hw);
        { const a1 = Math.atan2(-ny, -nx); ctx.arc(X, Y, hw, a1, a1 + Math.PI, false); }   // 머리 앞을 둥글게(−n → 진행 방향 → +n)
        ctx.closePath(); ctx.fill();
      }
      /* ③ 불티 — 꼬리 쪽으로 떨어져 나가 잠깐 빛나다 꺼진다 */
      const nSp = Math.round(6 * m.mag * Math.min(1.4, m.sz));
      for (let k = 0; k < nSp; k += 1) {
        const born = R() * u; const life = 0.12 + R() * 0.25; const da = (u - born) * m.dur;
        if (da < 0 || da > life) { R(); R(); continue; }
        const bx = m.x0 + m.dx * m.len * born; const by = m.y0 + m.dy * m.len * born;
        const dr = (R() - 0.5) * 0.9; const dv = 1.5 + R() * 2;
        const px = ox + (bx + (m.dx * 0.3 - m.dy * dr) * da * dv) * tp; const py = oy + (by + (m.dy * 0.3 + m.dx * dr) * da * dv) * tp;
        const a = (1 - da / life) * 0.8 * Math.min(1, lum);
        ctx.fillStyle = `hsla(${k % 3 === 0 ? 35 : m.hue},90%,80%,${a})`;
        ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, tp * 0.035 * m.sz), 0, TAU); ctx.fill();
      }
      /* ④ 머리 — 흰 핵 + 광채(색은 유성 빛깔로 물든다) */
      const hs = tp * m.sz * (0.9 + 0.9 * Math.min(1.5, lum));
      ctx.globalAlpha = Math.min(1, lum);
      ctx.drawImage(headGlow9(), X - hs / 2, Y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;
      if (m.hue < 150) {   // 불덩이는 빛깔이 진하다
        const cg = ctx.createRadialGradient(X, Y, 0, X, Y, hs * 0.6);
        cg.addColorStop(0, `hsla(${m.hue},95%,65%,${0.45 * Math.min(1, lum)})`); cg.addColorStop(1, `hsla(${m.hue},95%,55%,0)`);
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(X, Y, hs * 0.6, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** 한 마리를 바로 그린다(시험 판 · 도록용) — 방향(hx, hy) · mode 0 날갯짓(ph) · 1 활공 · 2 접음 · px = 타일 화면 px. */
export function drawBirdOne9(g: CanvasRenderingContext2D, sp: Species9, hx: number, hy: number, mode: number, ph: number, sx: number, sy: number, px: number, bank = 0): void {
  const s = SPEC9[sp]; const roll = -bank * 0.6; const l = Math.hypot(hx, hy) || 1;
  drawBird3d9(g, s, { hx: hx / l, hy: hy / l, cb: Math.cos(roll), sb: Math.sin(roll) }, wingPose9(mode, ph), sx, sy, px, s.len, s.span / 2, mode === 1 ? 0.9 : 0.5);
}
