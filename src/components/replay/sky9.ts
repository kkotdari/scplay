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
 *   유성우는 **한 복사점에서 사방으로** 뻗는다(실제 유성우처럼). 더하는 빛('lighter')으로 그린다.
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
export type Species9 = "sparrow" | "swallow" | "finch" | "bluebird";
interface Spec9 {
  back: string; back2: string; belly: string; cap: string; wing: string; prim: string; bar: string | null; tail: string; beak: string;
  /** 몸 길이 · 날개 편 폭(타일) · 날개 길쭉함(1 둥근 날개 · 1.4 뾰족) · 꼬리 갈래 */
  len: number; span: number; point: number; fork: boolean; streak: boolean;
  /** 날갯짓(Hz) · 한 번 치는 시간(초) · 접고 미끄러지는 시간(초) · 활공(제비) */
  hz: number; flap: number; rest: number; glide: boolean; speed: number;
}
const SPEC9: Record<Species9, Spec9> = {
  sparrow: { back: "#8b5e3c", back2: "#5d3b22", belly: "#d9cbb4", cap: "#7a6a5c", wing: "#9a6a43", prim: "#3e2a1c", bar: "#efe4cf", tail: "#5d4330", beak: "#3a3430",
    len: 0.42, span: 0.58, point: 1.0, fork: false, streak: true, hz: 11, flap: 0.5, rest: 0.32, glide: false, speed: 3.6 },
  swallow: { back: "#1c2950", back2: "#0f1730", belly: "#efe8dc", cap: "#22325e", wing: "#1a2444", prim: "#0c1226", bar: null, tail: "#141d3a", beak: "#1a1a1a",
    len: 0.46, span: 0.78, point: 1.5, fork: true, streak: false, hz: 6.5, flap: 0.7, rest: 0.9, glide: true, speed: 5.4 },
  finch: { back: "#e8b820", back2: "#b9850f", belly: "#f6e27a", cap: "#1d1b18", wing: "#262420", prim: "#151412", bar: "#f4f1e6", tail: "#22201c", beak: "#e9a36a",
    len: 0.36, span: 0.52, point: 1.0, fork: false, streak: false, hz: 12, flap: 0.42, rest: 0.36, glide: false, speed: 3.4 },
  bluebird: { back: "#2f63c8", back2: "#1d3f8a", belly: "#e58a4e", cap: "#3a74dc", wing: "#2a58b6", prim: "#152e66", bar: null, tail: "#24489a", beak: "#2a2a2a",
    len: 0.44, span: 0.62, point: 1.1, fork: false, streak: false, hz: 9, flap: 0.55, rest: 0.3, glide: false, speed: 3.9 },
};
const SPECIES9: Species9[] = ["sparrow", "swallow", "finch", "bluebird"];

/** 한 칸 그림 — 머리가 +x · 날개가 ±y. S = 판 한 변 px(새 날개 편 폭이 판의 0.86). */
const BIRD_PX9 = 160;
const FRAMES9 = 16;
const birdSpr9 = new Map<string, HTMLCanvasElement>();
function shadeHex9(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16); const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
/**
 * 날개 꼴(위에서 본 한쪽 · side −1 왼 / +1 오) — open(0 접음 ~ 1 펼침) · sweep(끝이 뒤로 젖힘 0 ~ 1) · lift(위로 치켜 짧아 보임 0 ~ 1).
 * 자 — L = 몸 길이(머리 ~ 꼬리 뿌리) · s = 반 날개 폭. 어깨 → 앞전(손목에서 살짝 앞으로 굽음) → 끝 → 뒷전(첫째 날개깃 다섯의 갈라진 끝 · 둘째 날개깃의 둥근 톱니) → 겨드랑이.
 */
function drawWing9(g: CanvasRenderingContext2D, sp: Spec9, side: number, open: number, sweep: number, lift: number, L: number, sHalf: number): void {
  const reach = sHalf * (0.18 + 0.82 * open) * (1 - 0.3 * lift);
  const back = L * (0.06 + 0.32 * sweep) * (0.8 + 0.2 * sp.point);
  const chord = L * (0.36 - 0.07 * (sp.point - 1)) * (0.75 + 0.25 * open);
  const rx = L * 0.12; const ry = side * L * 0.1;                         // 어깨(앞전 뿌리)
  const wx = L * 0.14 - back * 0.3; const wy = side * reach * 0.42;       // 손목
  const tx = -back - L * 0.05 * sp.point; const ty = side * reach;        // 날개 끝
  const ax = rx - chord; const ay = side * L * 0.08;                      // 겨드랑이(뒷전 뿌리)
  const pts: [number, number][] = [];
  const P = (x: number, y: number): void => { pts.push([x, y]); };
  /* 앞전 — 어깨 → 손목(살짝 앞으로 부푼 곡선) → 끝 */
  for (let k = 0; k <= 6; k += 1) { const a = k / 6; P(rx + (wx - rx) * a + L * 0.03 * Math.sin(Math.PI * a), ry + (wy - ry) * a); }
  for (let k = 1; k <= 6; k += 1) { const a = k / 6; P(wx + (tx - wx) * a + L * 0.02 * Math.sin(Math.PI * a), wy + (ty - wy) * a); }
  /* 뒷전 — 끝 → 첫째 날개깃 끝 다섯(갈라짐) → 둘째 날개깃(톱니) → 겨드랑이 */
  const pe: [number, number] = [tx - chord * 0.55, side * reach * 0.62];   // 첫째 · 둘째 날개깃 경계
  const nP = 5;
  for (let k = 1; k <= nP; k += 1) {
    const a = k / nP; const x = tx + (pe[0] - tx) * a; const y = ty + (pe[1] - ty) * a;
    const nx = -(pe[1] - ty); const ny = pe[0] - tx; const nl = Math.hypot(nx, ny) || 1;   // 뒷전 바깥 법선
    const dep = L * 0.035 * (1 - 0.5 * a) * open;
    P(x - (nx / nl) * dep * side * 0.4 + (pe[0] - tx) * 0.06, y - (ny / nl) * dep * side * 0.4);
    P(x, y);
  }
  const nS = 6;
  for (let k = 1; k <= nS; k += 1) {
    const a = k / nS; const x = pe[0] + (ax - pe[0]) * a; const y = pe[1] + (ay - pe[1]) * a;
    P(x - L * 0.018, y + side * L * 0.006); P(x, y);
  }
  const trace = (): void => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.closePath(); };
  /* 바탕 — 덮깃(앞) 밝게 · 뒤로 짙게 */
  const grd = g.createLinearGradient(rx, 0, ax - chord * 0.2, 0);
  grd.addColorStop(0, shadeHex9(sp.wing, 1.2)); grd.addColorStop(0.5, sp.wing); grd.addColorStop(1, shadeHex9(sp.wing, 0.7));
  g.fillStyle = grd; trace(); g.fill();
  g.save(); trace(); g.clip();
  /* 첫째 날개깃(날개 바깥 · 짙게) */
  const pg = g.createLinearGradient(0, ry, 0, ty);
  pg.addColorStop(0, "rgba(0,0,0,0)"); pg.addColorStop(0.5, "rgba(0,0,0,0)"); pg.addColorStop(0.62, sp.prim); pg.addColorStop(1, shadeHex9(sp.prim, 0.85));
  g.fillStyle = pg; g.fillRect(-L * 2, -L * 2, L * 4, L * 4);
  /* 둘째 날개깃(뒷전 쪽 · 조금 짙게) */
  const sg = g.createLinearGradient(rx, 0, ax, 0);
  sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(0.55, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = sg; g.fillRect(-L * 2, -L * 2, L * 4, L * 4);
  /* 날개 띠(흰 줄) — 덮깃 끝을 가로지른다 */
  if (sp.bar) {
    g.strokeStyle = sp.bar; g.lineWidth = L * 0.035; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(rx - chord * 0.45, ry); g.quadraticCurveTo(wx - chord * 0.45, wy, tx + (rx - tx) * 0.25 - chord * 0.2, ty * 0.72); g.stroke();
    g.globalAlpha = 1;
  }
  /* 깃 결 — 뒷전 톱니에서 날개 안쪽으로 가는 줄 */
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = Math.max(0.6, L * 0.006);
  for (let k = 1; k <= nP; k += 1) { const a = k / nP; const x = tx + (pe[0] - tx) * a; const y = ty + (pe[1] - ty) * a; g.beginPath(); g.moveTo(x, y); g.lineTo(x + chord * 0.55, y - side * reach * 0.08); g.stroke(); }
  for (let k = 1; k <= nS; k += 1) { const a = k / nS; const x = pe[0] + (ax - pe[0]) * a; const y = pe[1] + (ay - pe[1]) * a; g.beginPath(); g.moveTo(x, y); g.lineTo(x + chord * 0.45, y); g.stroke(); }
  g.restore();
  /* 앞전 밝은 테(빛 왼위 — 왼 날개가 더 밝다) · 뒷전 어두운 테 */
  g.strokeStyle = shadeHex9(sp.wing, 1.5); g.lineWidth = Math.max(0.8, L * 0.012); g.globalAlpha = side < 0 ? 0.7 : 0.3;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k <= 12; k += 1) g.lineTo(pts[k][0], pts[k][1]); g.stroke();
  g.globalAlpha = 1;
}
function drawBody9(g: CanvasRenderingContext2D, sp: Spec9, L: number, tailSpread: number): void {
  const bw = L * 0.13;
  /* 꼬리 — 부채(깃 일곱) · 제비는 깊은 갈래 */
  const tb = -L * 0.28; const tl = L * (sp.fork ? 0.62 : 0.38); const tw = L * (0.08 + 0.1 * tailSpread) * (sp.fork ? 1.2 : 1);
  const tg = g.createLinearGradient(tb, 0, tb - tl, 0); tg.addColorStop(0, shadeHex9(sp.tail, 1.1)); tg.addColorStop(1, shadeHex9(sp.tail, 0.75));
  g.fillStyle = tg; g.beginPath(); g.moveTo(tb + L * 0.04, -bw * 0.6);
  if (sp.fork) { g.lineTo(tb - tl, -tw * 1.3); g.lineTo(tb - tl * 0.42, -tw * 0.25); g.lineTo(tb - tl * 0.38, 0); g.lineTo(tb - tl * 0.42, tw * 0.25); g.lineTo(tb - tl, tw * 1.3); }
  else { for (let k = 0; k <= 6; k += 1) { const a = -1 + (2 * k) / 6; g.lineTo(tb - tl * (0.92 + 0.08 * Math.cos(a * 1.5)), a * tw); g.lineTo(tb - tl * 0.88, (a + (k < 6 ? 1 / 6 : 0)) * tw); } }
  g.lineTo(tb + L * 0.04, bw * 0.6); g.closePath(); g.fill();
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = Math.max(0.5, L * 0.005);
  for (let k = 1; k < 6; k += 1) { const a = -1 + (2 * k) / 6; g.beginPath(); g.moveTo(tb, a * bw * 0.4); g.lineTo(tb - tl * 0.85, a * tw * 0.9); g.stroke(); }
  /* 몸통 — 앞이 굵고 뒤로 가늘어지는 물방울 꼴 · 등 짙게 · 옆구리 밝게 */
  const body = (): void => {
    g.beginPath(); g.moveTo(L * 0.3, 0);
    g.bezierCurveTo(L * 0.3, -bw * 1.05, L * 0.05, -bw * 1.1, -L * 0.12, -bw * 0.85);
    g.bezierCurveTo(-L * 0.25, -bw * 0.6, -L * 0.32, -bw * 0.35, -L * 0.33, 0);
    g.bezierCurveTo(-L * 0.32, bw * 0.35, -L * 0.25, bw * 0.6, -L * 0.12, bw * 0.85);
    g.bezierCurveTo(L * 0.05, bw * 1.1, L * 0.3, bw * 1.05, L * 0.3, 0); g.closePath();
  };
  const bg = g.createLinearGradient(0, -bw, 0, bw);
  bg.addColorStop(0, sp.belly); bg.addColorStop(0.25, sp.back); bg.addColorStop(0.7, sp.back2); bg.addColorStop(1, shadeHex9(sp.belly, 0.85));
  g.fillStyle = bg; body(); g.fill();
  if (sp.streak) {
    g.save(); body(); g.clip();
    g.strokeStyle = "rgba(35,18,8,0.6)"; g.lineWidth = Math.max(0.6, L * 0.012);
    for (let k = -2; k <= 2; k += 1) { g.beginPath(); g.moveTo(L * 0.18, k * bw * 0.28); g.quadraticCurveTo(0, k * bw * 0.36, -L * 0.3, k * bw * 0.22); g.stroke(); }
    g.restore();
  }
  const sh = g.createRadialGradient(L * 0.05, -bw * 0.5, bw * 0.1, 0, 0, L * 0.34);
  sh.addColorStop(0, "rgba(255,255,255,0.3)"); sh.addColorStop(0.55, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = sh; body(); g.fill();
  /* 머리 — 작게 · 정수리 빛 · 눈 · 부리 */
  const hx = L * 0.33; const hr = L * 0.105;
  const hg = g.createRadialGradient(hx - hr * 0.3, -hr * 0.4, hr * 0.1, hx, 0, hr);
  hg.addColorStop(0, shadeHex9(sp.cap, 1.4)); hg.addColorStop(0.6, sp.cap); hg.addColorStop(1, shadeHex9(sp.cap, 0.7));
  g.fillStyle = hg; g.beginPath(); g.ellipse(hx, 0, hr * 1.05, hr * 0.92, 0, 0, TAU); g.fill();
  g.fillStyle = sp.beak; g.beginPath(); g.moveTo(hx + hr * 0.85, -hr * 0.3); g.lineTo(hx + hr * 1.6, 0); g.lineTo(hx + hr * 0.85, hr * 0.3); g.closePath(); g.fill();
  for (const sd of [-1, 1]) {
    g.fillStyle = "#0a0a0a"; g.beginPath(); g.arc(hx + hr * 0.4, sd * hr * 0.62, Math.max(0.7, hr * 0.16), 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(hx + hr * 0.45, sd * hr * 0.62 - hr * 0.05, Math.max(0.35, hr * 0.05), 0, TAU); g.fill();
  }
}
/** 칸: 0 ~ 15 날갯짓 · 16 활공(펼침) · 17 접음. 위에서 본 날갯짓 — 내려치기 가운데(φ 0.25)에 가장 넓고, 올려치기(φ 0.75)에 날개가 접혀 위로 들려 좁다. */
export function birdFrame9(sp: Species9, f: number): HTMLCanvasElement {
  const key = sp + f; const got = birdSpr9.get(key); if (got) return got;
  const S = BIRD_PX9; const c = document.createElement("canvas"); c.width = S; c.height = S;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const s = SPEC9[sp]; const sHalf = S * 0.43; const L = (sHalf * 2 * s.len) / s.span;
  g.translate(S * 0.5 + L * 0.05, S * 0.5); g.lineJoin = "round"; g.lineCap = "round";
  let open = 1; let sweep = 0.25; let lift = 0; let tail = 0.6;
  if (f < FRAMES9) {
    const ph = f / FRAMES9;
    const down = Math.sin(ph * TAU);            // + 내려치기
    open = 0.62 + 0.38 * Math.max(0, down) + 0.12 * Math.min(0, down);
    lift = clamp01(-down * 1.1);
    sweep = 0.18 + 0.4 * clamp01(-down);
    tail = 0.45 + 0.3 * clamp01(down);
  } else if (f === FRAMES9) { open = 1; sweep = 0.12; lift = 0; tail = 0.9; }
  else { open = 0.08; sweep = 1; lift = 0.2; tail = 0.25; }
  /* 몸 아래 날개를 먼저(뒷쪽 · 몸에 가려지는 뿌리) */
  drawWing9(g, s, -1, open, sweep, lift, L, sHalf);
  drawWing9(g, s, 1, open, sweep, lift, L, sHalf);
  drawBody9(g, s, L, tail);
  birdSpr9.set(key, c); return c;
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
interface BirdNow9 { x: number; y: number; hx: number; hy: number; z: number; frame: number; bank: number; sp: Species9; scale: number }
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
    let frame: number; let z = F.alt;
    if (tc < s.flap) { frame = Math.floor(((tc * s.hz) % 1) * FRAMES9); z += 0.35 * smooth(tc / s.flap); }
    else { frame = s.glide ? FRAMES9 : FRAMES9 + 1; z += 0.35 * (1 - smooth((tc - s.flap) / s.rest)); }
    out.push({ x: bx, y: by, hx, hy, z, frame, bank, sp: F.sp, scale: sc });
  }
  return out;
}
export const SKY9 = { lastCall: new Map<number, number>() };

/**
 * 새 그리기 — 땅 층(shadow 참: 그림자만) · 몸 위 층(shadow 거짓: 새). ox · oy = 지도 (0, 0) 의 화면 자리 · tp = 타일 화면 px.
 * 빛은 왼위(높이 1 타일당 그림자가 오른아래로 0.55 · 0.7 타일 비킨다).
 */
export function drawBirds9(ctx: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number, shadow: boolean,
  call: ((sp: Species9, pan: number, vol: number) => void) | null): void {
  const M = ctx.getTransform();
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
      const size = s.span * tp * b.scale * (1 + b.z * 0.03);   // 높을수록 조금 크다(눈에 가깝다)
      if (size < 2) continue;
      if (shadow) {
        const sx = ox + (b.x + b.z * 0.55) * tp; const sy = oy + (b.y + b.z * 0.7) * tp;
        const sw = size * (b.frame === FRAMES9 + 1 ? 0.25 : 0.45); const blur = 1 + b.z * 0.12;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sw * blur);
        gr.addColorStop(0, `rgba(0,0,0,${0.22 / blur})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(sx, sy, sw * blur, sw * blur * 0.55, Math.atan2(b.hy, b.hx) + Math.PI / 2, 0, TAU); ctx.fill();
        continue;
      }
      const img = birdFrame9(b.sp, b.frame);
      const sx = ox + b.x * tp; const sy = oy + (b.y - b.z * 0.35) * tp;   // 높이는 화면 위로(평면 보기의 눌림)
      const k = size / (BIRD_PX9 * 0.86);
      const cs = b.hx; const sn = b.hy;
      /* 돌 때 기울임 — 날개 축(로컬 y)을 줄여 원근(안쪽 날개가 짧아 보인다 · 단순히 폭 눌림) */
      const ky = k * (1 - 0.35 * Math.abs(b.bank));
      ctx.setTransform(
        M.a * cs * k, M.b + M.d * sn * k, M.c - M.a * sn * ky, M.d * cs * ky,
        M.e + M.a * sx, M.f + M.d * sy,
      );
      ctx.drawImage(img, -BIRD_PX9 / 2, -BIRD_PX9 / 2);
      ctx.setTransform(M);
    }
  }
}

/* ── 유성 ──────────────────────────────────────────────────────────────────────────────────────────────────── */
interface Meteor9 { t0: number; dur: number; x0: number; y0: number; dx: number; dy: number; len: number; mag: number; hue: number; seed: number }
/** 3초 칸마다 — 4할 없음 · 5할 하나 · 1할 유성우(4 ~ 7개 · 한 복사점에서 사방으로). 불덩이(녹 · 주황 · 크고 느림)는 6%. */
function meteorsOf9(slot: number, spaceTiles: number[], w: number): Meteor9[] {
  const R = rngOf9("met" + slot + ":" + w); const out: Meteor9[] = [];
  const r0 = R(); if (r0 < 0.4 || !spaceTiles.length) return out;
  const shower = r0 > 0.9; const n = shower ? 4 + Math.floor(R() * 4) : 1;
  const rad = spaceTiles[Math.floor(R() * spaceTiles.length)]; const rx = rad % w; const ry = Math.floor(rad / w);
  for (let i = 0; i < n; i += 1) {
    const fire = !shower && R() < 0.06;
    let x0: number; let y0: number; let ang: number;
    if (shower) { ang = R() * TAU; const d0 = 2 + R() * 6; x0 = rx + Math.cos(ang) * d0; y0 = ry + Math.sin(ang) * d0; }
    else { const ti = spaceTiles[Math.floor(R() * spaceTiles.length)]; x0 = ti % w; y0 = Math.floor(ti / w); ang = 0.35 + R() * 1.0 + (R() < 0.3 ? Math.PI * 0.5 : 0); }
    out.push({ t0: slot * 3 + (shower ? R() * 2.4 : R() * 2.2), dur: fire ? 1.6 + R() * 0.8 : 0.45 + R() * 0.6, x0, y0, dx: Math.cos(ang), dy: Math.sin(ang),
      len: fire ? 14 + R() * 10 : 7 + R() * 9, mag: fire ? 2.2 : 0.7 + R() * 0.8, hue: fire ? (R() < 0.6 ? 125 : 28) : 205 + R() * 25, seed: R() * 1000 });
  }
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
/** 유성 그리기(땅 층 · 우주 칸 위) — 더하는 빛. */
export function drawMeteors9(ctx: CanvasRenderingContext2D, spaceTiles: number[], w: number, ox: number, oy: number, tp: number, tSec: number): void {
  if (!spaceTiles.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const slot0 = Math.floor(tSec / 3);
  for (let sl = slot0 - 2; sl <= slot0; sl += 1) {
    for (const m of meteorsOf9(sl, spaceTiles, w)) {
      const age = tSec - m.t0; const trainLife = 1.6 * m.mag;
      if (age < 0 || age > m.dur + trainLife) continue;
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
        const wid = tp * (0.05 + 0.1 * Math.min(1, passed / 1.2));
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
        const nx = -m.dy; const ny = m.dx; const hw = Math.max(0.6, wd * tp * (0.7 + 0.3 * Math.min(1, lum)));
        ctx.fillStyle = gr; ctx.beginPath();
        ctx.moveTo(X + nx * hw, Y + ny * hw); ctx.lineTo(ex, ey); ctx.lineTo(X - nx * hw, Y - ny * hw);
        { const a1 = Math.atan2(-ny, -nx); ctx.arc(X, Y, hw, a1, a1 + Math.PI, false); }   // 머리 앞을 둥글게(−n → 진행 방향 → +n)
        ctx.closePath(); ctx.fill();
      }
      /* ③ 불티 — 꼬리 쪽으로 떨어져 나가 잠깐 빛나다 꺼진다 */
      const nSp = Math.round(6 * m.mag);
      for (let k = 0; k < nSp; k += 1) {
        const born = R() * u; const life = 0.12 + R() * 0.25; const da = (u - born) * m.dur;
        if (da < 0 || da > life) { R(); R(); continue; }
        const bx = m.x0 + m.dx * m.len * born; const by = m.y0 + m.dy * m.len * born;
        const dr = (R() - 0.5) * 0.9; const dv = 1.5 + R() * 2;
        const px = ox + (bx + (m.dx * 0.3 - m.dy * dr) * da * dv) * tp; const py = oy + (by + (m.dy * 0.3 + m.dx * dr) * da * dv) * tp;
        const a = (1 - da / life) * 0.8 * Math.min(1, lum);
        ctx.fillStyle = `hsla(${k % 3 === 0 ? 35 : m.hue},90%,80%,${a})`;
        ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, tp * 0.035), 0, TAU); ctx.fill();
      }
      /* ④ 머리 — 흰 핵 + 광채(색은 유성 빛깔로 물든다) */
      const hs = tp * (0.9 + 0.9 * Math.min(1.5, lum));
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
