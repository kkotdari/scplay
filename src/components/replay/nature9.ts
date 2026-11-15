/* ★ **자연 겹**(2026-11-15, 요청: "자연 레이어 추가(기본 off) · 우주맵 — 별똥별 떨어지기(1개 또는 여러개) · 자연 종류 맵 — 나무(가을 단풍과 녹색류 · 크기 다양) ·
 *  풀숲(흔들리는 덤불 · 긴 잔디 · 갈대) · 꽃무리 · 높이 단차 있는 벽에 폭포 · 날아다니는 작고 예쁜 새와 소리") ─────────────────────────────────────────────
 *
 * 꾸밈 날씨(weather9)처럼 **표시 단추(Layers)의 한 줄**이고 기본 끔(기기 `scr.nature` = "1" 일 때만 · `#nature=0|1` 시험).
 * 지형 기하(terrainGeom9 의 lvl · walk · ramp)에서 **지도마다 한 번** 자리를 뽑고(지도 해시 씨앗 — 같은 지도는 늘 같은 숲), 유닛 2D 캔버스(크립과 같은 층 —
 * 지형 위 · 유닛 몸 아래)에 장마다 그린다. 평면 보기만(맵 로고와 같은 규약 — 입체는 아핀 자리가 안 맞는다).
 *   · 나무 — 못 걷는 땅(물 · 절벽이 아닌 칸: 정글 덩굴 · 바위 덤불 자리)에 숲으로. 녹색 활엽 · 단풍(주황 · 빨강 · 노랑) · 침엽 셋 × 크기 0.8 ~ 1.9.
 *   · 풀숲 — 걷는 땅에 드문드문(덤불 · 긴 잔디) · 물가엔 갈대. 바람에 흔들린다(밑동을 잡고 기울임).
 *   · 꽃무리 — 걷는 땅에 드문드문.
 *   · 폭포 — 남쪽(화면 아래)을 보는 절벽 낯 가운데 위 칸이 높은 걷는 땅이고 아래가 낮은 땅 · 물인 자리 · 지도마다 넷 ~ 열.
 *   · 새 — 작은 무리(3 ~ 6)가 지도를 가로질러 난다 · 화면에 들어올 때 지저귐(효과음 주 음량을 탄다).
 *   · 우주 판(타일셋 1) — 나무 · 풀 · 폭포 · 새는 없고, 우주(물) 칸 위로 별똥별이 한 개 또는 여럿 떨어진다.
 * 설치(2) · 잿빛(3) 판은 자연물이 없다. 유닛이 서는 자리(걷는 땅)에는 낮은 것(풀 · 꽃)만 둔다 — 경기 읽기를 안 가린다. */
import type { TerrainGeom9 } from "../../utils/terrainGeom";

const KEY9 = "scr.nature";
export function natureOnStored9(): boolean {
  if (typeof location !== "undefined") { const m = /(?:^|[#&,])nature=([01])/.exec(location.hash); if (m) return m[1] === "1"; }
  try { return localStorage.getItem(KEY9) === "1"; } catch { return false; }
}
export function natureStore9(on: boolean): void { try { localStorage.setItem(KEY9, on ? "1" : "0"); } catch { /* 사생활 모드 */ } }

/** 그리는 쪽이 읽는 상태 — 재생기가 켬 · 지형 기하를 넣는다(TERR_WX9 와 같은 꼴). */
export const NATURE9: { on: boolean; geom: TerrainGeom9 | null; rgb: Uint8Array | null; hash: string; playing: boolean; chirp: ((pan: number) => void) | null } =
  { on: false, geom: null, rgb: null, hash: "", playing: false, chirp: null };

type Kind9 = "tree" | "pine" | "bush" | "grass" | "reed" | "flower";
interface Prop9 { k: Kind9; x: number; y: number; s: number; v: number; ph: number }
interface Fall9 { x: number; y0: number; y1: number; w: number; ph: number }
interface Plan9 { props: Prop9[]; falls: Fall9[]; space: boolean; spaceTiles: number[]; w: number; h: number; ts: number }

/** 씨앗 난수(mulberry32) — 지도 해시에서. */
function rng9(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { a ^= seed.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 타일셋별 잎 · 꽃 빛깔 — 정글은 녹색 많이 · 황무지는 단풍 많이 · 사막은 마른 덤불 · 얼음은 눈 덮인 침엽 · 황혼은 짙은 청록 · 보라. */
const LEAF9: Record<number, { green: number; autumn: number; pine: number; dry: boolean; snow: boolean; dusk: boolean }> = {
  0: { green: 0.45, autumn: 0.45, pine: 0.10, dry: false, snow: false, dusk: false },   // 황무지
  4: { green: 0.70, autumn: 0.20, pine: 0.10, dry: false, snow: false, dusk: false },   // 정글
  5: { green: 0.25, autumn: 0.35, pine: 0.05, dry: true, snow: false, dusk: false },    // 사막
  6: { green: 0.05, autumn: 0.05, pine: 0.90, dry: false, snow: true, dusk: false },    // 얼음
  7: { green: 0.55, autumn: 0.30, pine: 0.15, dry: false, snow: false, dusk: true },    // 황혼
};

let plan9: Plan9 | null = null;
let planKey9 = "";
function planOf9(G: TerrainGeom9, hash: string): Plan9 {
  const key = hash + ":" + G.w + "x" + G.h + ":" + G.tileset + (NATURE9.rgb ? ":c" : "");
  if (plan9 && planKey9 === key) return plan9;
  const { w, h, lvl, walk, ramp } = G; const ts = G.tileset;
  const R = rng9(key);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  /* 물 — 낮은 땅의 못 걷는 칸 가운데 **원본 실색이 푸르거나(물) 아주 어두운(사막 타르 · 우주)** 칸. 실색(판 3)이 없으면 낮은 못 걷는 칸을 다 물로 친다(옛 판). 낮은 땅의 바위 · 덩굴 덤불은
     물이 아니라 숲 자리다(정글의 못 걷는 낮은 땅 대부분). */
  const rgb = NATURE9.rgb && NATURE9.rgb.length >= w * h * 3 ? NATURE9.rgb : null;
  const waterCol = (i: number): boolean => { if (!rgb) return true; const r = rgb[i * 3]; const g = rgb[i * 3 + 1]; const b = rgb[i * 3 + 2]; return (b > r + 10 && b + 12 >= g) || r + g + b < 75; };
  const isWater = (i: number): boolean => i >= 0 && walk[i] === 0 && lvl[i] === 0 && waterCol(i);
  const isWalk = (i: number): boolean => i >= 0 && walk[i] === 1;
  const props: Prop9[] = []; const falls: Fall9[] = []; const spaceTiles: number[] = [];
  const space = ts === 1;
  const leaf = LEAF9[ts];
  if (space) {
    for (let i = 0; i < w * h; i += 1) if (isWater(i)) spaceTiles.push(i);
  } else if (leaf) {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (isWater(i)) continue;
      if (walk[i] === 0) {
        /* 못 걷는 땅 — 둘레(8칸)가 같은 고도이고 걷는 칸이 셋 이하면 숲 속(절벽 낯 아님) · 숲 가장자리는 듬성. */
        let walkN = 0; let diffL = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue; const j = at(x + dx, y + dy); if (j < 0) continue;
          if (walk[j] === 1) walkN += 1; if (lvl[j] !== lvl[i] && !isWater(j)) diffL += 1;
        }
        if (diffL > 1) continue;   // 절벽 낯
        /* 높은 못 걷는 칸은 아래(남쪽) 두 칸 안에 더 낮은 땅이 있으면 절벽 낯이다(벽 두께가 두 줄인 판 — 둘레 한 칸만 보면 숲으로 읽혔다). */
        if (lvl[i] > 0) { let cliff = false; for (let k = 1; k <= 2 && !cliff; k += 1) { const j = at(x, y + k); if (j >= 0 && lvl[j] < lvl[i]) cliff = true; } if (cliff) continue; }
        const p = walkN === 0 ? 0.55 : walkN <= 3 ? 0.3 : 0.0;
        if (R() < p) {
          const r = R(); const k: Kind9 = r < leaf.pine ? "pine" : "tree";
          const v = k === "pine" ? Math.floor(R() * 3) : (R() < leaf.green / Math.max(0.01, leaf.green + leaf.autumn) ? Math.floor(R() * 3) : 3 + Math.floor(R() * 3));
          props.push({ k, x: x + 0.2 + R() * 0.6, y: y + 0.4 + R() * 0.6, s: 0.8 + R() * 1.1, v, ph: R() * 6.283 });
        }
        if (R() < 0.18) props.push({ k: "bush", x: x + R(), y: y + R(), s: 0.6 + R() * 0.6, v: Math.floor(R() * 3), ph: R() * 6.283 });
        continue;
      }
      if (ramp[i] === 1) continue;
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (isWater(at(x + dx, y + dy))) { nearWater = true; break; }
      if (nearWater && R() < 0.45) { props.push({ k: "reed", x: x + R(), y: y + R(), s: 0.7 + R() * 0.6, v: Math.floor(R() * 3), ph: R() * 6.283 }); continue; }
      const r = R();
      if (r < 0.035) props.push({ k: "grass", x: x + R(), y: y + R(), s: 0.6 + R() * 0.7, v: Math.floor(R() * 3), ph: R() * 6.283 });
      else if (r < 0.05) props.push({ k: "bush", x: x + R(), y: y + R(), s: 0.45 + R() * 0.4, v: Math.floor(R() * 3), ph: R() * 6.283 });
      else if (r < 0.068 && !leaf.snow) props.push({ k: "flower", x: x + R(), y: y + R(), s: 0.6 + R() * 0.6, v: Math.floor(R() * 5), ph: R() * 6.283 });
    }
    /* 폭포 — 남쪽 낯 절벽: 위 칸이 높은 걷는 땅 · 아래(1 ~ 4칸 안)에 낮은 땅이나 물. 서로 12칸 넘게 떨어뜨려 넷 ~ 열. */
    {
      const cand: Fall9[] = [];
      for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x; if (walk[i] !== 0 || lvl[i] === 0) continue;
        const top = at(x, y - 1); if (!isWalk(top) || lvl[top] < lvl[i]) continue;
        let y1 = -1;
        for (let k = 1; k <= 4; k += 1) { const j = at(x, y + k); if (j < 0) break; if (isWater(j) || (isWalk(j) && lvl[j] < lvl[top])) { y1 = y + k; break; } if (walk[j] === 1) break; }
        if (y1 < 0) continue;
        if (!isWalk(at(x - 1, y - 1)) || !isWalk(at(x + 1, y - 1))) continue;   // 위 땅이 넓은 자리(벽 끝 모서리는 뺀다)
        cand.push({ x: x + 0.5, y0: y - 0.05, y1: y1 + 0.15, w: 1.0 + R() * 1.0, ph: R() * 10 });
      }
      for (let n = 0; n < cand.length * 3 && falls.length < 10; n += 1) {
        const c = cand[Math.floor(R() * cand.length)];
        if (falls.every((f) => Math.hypot(f.x - c.x, f.y0 - c.y0) > 12)) falls.push(c);
      }
    }
    props.sort((a, b) => a.y - b.y);
  }
  plan9 = { props, falls, space, spaceTiles, w, h, ts }; planKey9 = key;
  return plan9;
}

/* ── 그림 판(한 번 굽는다 · 높이 HPX 의 캔버스 · 밑동 가운데가 바닥 가운데) ─────────────────────────────────────────────── */
const HPX9 = 96;
const SPR9 = new Map<string, HTMLCanvasElement>();
function cv9(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d") as CanvasRenderingContext2D];
}
function shade9(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16); const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const GREEN9 = ["#3f7a34", "#4e8c3a", "#2f6b3a"]; const AUTUMN9 = ["#d0662a", "#b8342a", "#d9a42b"];
const DUSK9 = ["#2f6b66", "#4c4f86", "#6b3f7a"]; const DRY9 = ["#8a8a4a", "#9c7f45", "#7d8650"];
const FLOWER9 = ["#f2d14b", "#e85d7a", "#f4f1ea", "#a77be0", "#f08a3a"];
function leafCol9(v: number, ts: number): string {
  const L = LEAF9[ts];
  if (v >= 3) return AUTUMN9[(v - 3) % 3];
  return L?.dusk ? DUSK9[v % 3] : L?.dry ? DRY9[v % 3] : GREEN9[v % 3];
}
/** 활엽수 — 줄기 + 잎 덩이 여럿(빛은 왼위 · 아래 그늘). */
function treeSpr9(col: string, seed: number): HTMLCanvasElement {
  const key = "t" + col + seed; const got = SPR9.get(key); if (got) return got;
  const W = 80; const H = HPX9; const [c, g] = cv9(W, H); const R = rng9(key);
  g.fillStyle = "#4a3424"; g.beginPath(); g.moveTo(W / 2 - 4, H); g.lineTo(W / 2 - 2.5, H * 0.45); g.lineTo(W / 2 + 2.5, H * 0.45); g.lineTo(W / 2 + 4, H); g.fill();
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 9; i += 1) blobs.push([W / 2 + (R() - 0.5) * W * 0.5, H * 0.38 + (R() - 0.5) * H * 0.32, 11 + R() * 9]);
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of blobs) { g.fillStyle = shade9(col, 0.62); g.beginPath(); g.arc(x + 2, y + 3, r, 0, 6.283); g.fill(); }
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, shade9(col, 1.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade9(col, 0.72));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  SPR9.set(key, c); return c;
}
/** 침엽수 — 층진 삼각 셋(눈 판이면 층 끝에 흰 눈). */
function pineSpr9(col: string, seed: number, snow: boolean): HTMLCanvasElement {
  const key = "p" + col + seed + snow; const got = SPR9.get(key); if (got) return got;
  const W = 64; const H = HPX9; const [c, g] = cv9(W, H);
  g.fillStyle = "#4a3424"; g.fillRect(W / 2 - 3, H * 0.82, 6, H * 0.18);
  for (let k = 0; k < 3; k += 1) {
    const yb = H * (0.86 - k * 0.24); const yt = yb - H * 0.36; const hw = W * (0.46 - k * 0.1);
    const gr = g.createLinearGradient(W / 2 - hw, 0, W / 2 + hw, 0);
    gr.addColorStop(0, shade9(col, 1.25)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade9(col, 0.6));
    g.fillStyle = gr; g.beginPath(); g.moveTo(W / 2, yt); g.lineTo(W / 2 + hw, yb); g.lineTo(W / 2 - hw, yb); g.closePath(); g.fill();
    if (snow) { g.fillStyle = "rgba(245,248,255,0.9)"; g.beginPath(); g.moveTo(W / 2, yt); g.lineTo(W / 2 + hw * 0.45, yt + (yb - yt) * 0.45); g.lineTo(W / 2 - hw * 0.45, yt + (yb - yt) * 0.45); g.closePath(); g.fill(); }
  }
  SPR9.set(key, c); return c;
}
/** 덤불 — 낮은 잎 덩이. */
function bushSpr9(col: string): HTMLCanvasElement {
  const key = "b" + col; const got = SPR9.get(key); if (got) return got;
  const W = 64; const H = 40; const [c, g] = cv9(W, H); const R = rng9(key);
  for (let i = 0; i < 7; i += 1) {
    const x = W / 2 + (R() - 0.5) * W * 0.55; const y = H * 0.62 + (R() - 0.5) * H * 0.3; const r = 8 + R() * 7;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, shade9(col, 1.3)); gr.addColorStop(1, shade9(col, 0.65)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  SPR9.set(key, c); return c;
}
/** 긴 잔디 · 갈대 — 가는 잎 여럿(갈대는 끝에 갈색 이삭). */
function bladeSpr9(col: string, reed: boolean): HTMLCanvasElement {
  const key = (reed ? "r" : "g") + col; const got = SPR9.get(key); if (got) return got;
  const W = 48; const H = reed ? 72 : 44; const [c, g] = cv9(W, H); const R = rng9(key);
  g.lineCap = "round";
  for (let i = 0; i < (reed ? 9 : 14); i += 1) {
    const x0 = W / 2 + (R() - 0.5) * W * 0.4; const lean = (R() - 0.5) * W * 0.5; const ht = H * (0.55 + R() * 0.45);
    g.strokeStyle = shade9(col, 0.75 + R() * 0.55); g.lineWidth = reed ? 1.8 : 1.6;
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + lean * 0.3, H - ht * 0.6, x0 + lean, H - ht); g.stroke();
    if (reed && R() < 0.75) { g.fillStyle = "#7a5634"; g.beginPath(); g.ellipse(x0 + lean, H - ht + 4, 2.2, 6, lean * 0.02, 0, 6.283); g.fill(); }
  }
  SPR9.set(key, c); return c;
}
/** 꽃무리 — 잎 바탕 위 작은 꽃 점들. */
function flowerSpr9(col: string): HTMLCanvasElement {
  const key = "f" + col; const got = SPR9.get(key); if (got) return got;
  const W = 56; const H = 30; const [c, g] = cv9(W, H); const R = rng9(key);
  g.fillStyle = "rgba(60,110,50,0.75)"; g.beginPath(); g.ellipse(W / 2, H * 0.7, W * 0.42, H * 0.26, 0, 0, 6.283); g.fill();
  for (let i = 0; i < 12; i += 1) {
    const x = W / 2 + (R() - 0.5) * W * 0.75; const y = H * 0.66 + (R() - 0.5) * H * 0.45;
    g.fillStyle = shade9(col, 0.85 + R() * 0.3); g.beginPath(); g.arc(x, y, 3.2 + R() * 1.8, 0, 6.283); g.fill();
    g.fillStyle = "#f7e27a"; g.beginPath(); g.arc(x, y, 0.9, 0, 6.283); g.fill();
  }
  SPR9.set(key, c); return c;
}

/* ── 새 · 별똥별(시간의 함수 — 씨앗 + 시각 칸으로 정한다) ───────────────────────────────────────────────────────────── */
const BIRD_COL9 = ["#3d8ef0", "#f5c518", "#ef4b3f", "#ff8a2a", "#f5f5f5"];
interface Flock9 { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; n: number; col: string; id: number }
function flockOf9(slot: number, w: number, h: number): Flock9 | null {
  const R = rng9("bird" + slot);
  if (R() < 0.35) return null;   // 빈 칸(새 없는 동안)
  const side = Math.floor(R() * 4); const a = R(); const b = R();
  const p0: [number, number] = side === 0 ? [-4, a * h] : side === 1 ? [w + 4, a * h] : side === 2 ? [a * w, -4] : [a * w, h + 4];
  const p1: [number, number] = side === 0 ? [w + 4, b * h] : side === 1 ? [-4, b * h] : side === 2 ? [b * w, h + 4] : [b * w, -4];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  return { t0: slot * 14 + R() * 6, dur: len / (3.2 + R() * 1.6), x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], n: 3 + Math.floor(R() * 4), col: BIRD_COL9[Math.floor(R() * BIRD_COL9.length)], id: slot };
}
const chirped9 = new Set<number>();

/**
 * 한 장 그리기 — ctx 는 유닛 2D 캔버스(현재 변환 = 기기 화소 배수 · 평행이동만), ox · oy = 지도 (0, 0) 의 화면 자리(CSS px) · tp = 타일 한 칸의 화면 CSS px ·
 * cw · ch = 캔버스 CSS 크기. tSec = 실 시각(초 · 흔들림 · 새 · 별똥별).
 */
export function drawNature9(ctx: CanvasRenderingContext2D, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number): void {
  const G = NATURE9.geom; if (!NATURE9.on || !G || tp < 2) return;
  const P = planOf9(G, NATURE9.hash);
  const M = ctx.getTransform();
  const inView = (x: number, y: number, m: number): boolean => { const sx = ox + x * tp; const sy = oy + y * tp; return sx > -m && sx < cw + m && sy > -m && sy < ch + m; };
  ctx.save();
  if (P.space) { drawMeteors9(ctx, P, ox, oy, tp, tSec); ctx.restore(); return; }
  const leaf = LEAF9[P.ts]; if (!leaf) { ctx.restore(); return; }
  const small = tp < 7;   // 낮은 배율 — 풀 · 꽃 · 덤불은 건너뛴다(점으로 뭉갠다)
  /* ① 폭포 — 물줄기(위에서 아래로 흐르는 줄) + 아래 물보라. */
  for (const f of P.falls) {
    if (!inView(f.x, (f.y0 + f.y1) / 2, tp * 4)) continue;
    const x = ox + f.x * tp; const y0 = oy + f.y0 * tp; const y1 = oy + f.y1 * tp; const hw = (f.w * tp) / 2;
    const gr = ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, "rgba(170,215,240,0.85)"); gr.addColorStop(1, "rgba(225,242,255,0.92)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - hw, y0); ctx.lineTo(x + hw, y0); ctx.lineTo(x + hw * 1.15, y1); ctx.lineTo(x - hw * 1.15, y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = Math.max(0.8, tp * 0.04);
    const len = y1 - y0; const sp = (tSec * 2.2 + f.ph) % 1;
    ctx.beginPath();
    for (let k = 0; k < 7; k += 1) {
      const xx = x - hw + (2 * hw * (k + 0.5)) / 7; const off = ((sp + k * 0.37) % 1) * len;
      ctx.moveTo(xx, y0 + off); ctx.lineTo(xx, Math.min(y1, y0 + off + len * 0.22));
    }
    ctx.stroke();
    for (let k = 0; k < 5; k += 1) {
      const a = tSec * 3 + k * 1.3 + f.ph; const rr = tp * (0.18 + 0.12 * ((Math.sin(a) + 1) / 2));
      ctx.fillStyle = "rgba(240,248,255,0.55)"; ctx.beginPath(); ctx.ellipse(x + (k - 2) * hw * 0.55, y1 + Math.sin(a * 1.3) * tp * 0.05, rr, rr * 0.55, 0, 0, 6.283); ctx.fill();
    }
  }
  /* ② 나무 · 풀 · 꽃(뒤에서 앞으로 — 자리 y 로 정렬해 뒀다). 흔들림 = 밑동을 잡은 기울임. */
  const sway = (ph: number, amp: number): number => Math.sin(tSec * 1.6 + ph) * amp + Math.sin(tSec * 2.9 + ph * 1.7) * amp * 0.35;
  for (const p of P.props) {
    const isTree = p.k === "tree" || p.k === "pine";
    if (small && !isTree) continue;
    const hTile = isTree ? 1.15 * p.s : p.k === "reed" ? 1.0 * p.s : p.k === "bush" ? 0.55 * p.s : p.k === "grass" ? 0.62 * p.s : 0.62 * p.s;
    if (!inView(p.x, p.y, tp * 2.5)) continue;
    let img: HTMLCanvasElement;
    if (p.k === "tree") img = treeSpr9(leafCol9(p.v, P.ts), p.v);
    else if (p.k === "pine") img = pineSpr9(leaf.snow ? "#2e5a46" : leaf.dusk ? "#2c5a5a" : "#2f5e3a", p.v, leaf.snow);
    else if (p.k === "bush") img = bushSpr9(leafCol9(p.v % 3, P.ts));
    else if (p.k === "grass") img = bladeSpr9(leaf.dry ? "#a79a55" : leaf.dusk ? "#3f7a72" : "#5f9a3f", false);
    else if (p.k === "reed") img = bladeSpr9(leaf.dry ? "#9d9356" : "#6d9a4a", true);
    else img = flowerSpr9(FLOWER9[p.v % FLOWER9.length]);
    const hp = hTile * tp; const wp = (hp * img.width) / img.height;
    const bx = ox + p.x * tp; const by = oy + p.y * tp;
    if (isTree) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(bx + wp * 0.12, by - hp * 0.02, wp * 0.42, wp * 0.16, 0, 0, 6.283); ctx.fill(); }
    const sk = p.k === "flower" ? sway(p.ph, 0.04) : isTree ? sway(p.ph, 0.025) : sway(p.ph, p.k === "reed" ? 0.16 : 0.11);
    ctx.setTransform(M.a, M.b, M.c + M.a * sk, M.d, M.e + M.a * bx, M.f + M.d * by);
    ctx.drawImage(img, -wp / 2, -hp, wp, hp);
    ctx.setTransform(M);
  }
  /* ③ 새 — 지금 시각에 걸친 무리 칸들(14초 칸 · 앞뒤 몇 칸). */
  drawBirds9(ctx, P, ox, oy, tp, cw, ch, tSec);
  ctx.restore();
}

function drawBirds9(ctx: CanvasRenderingContext2D, P: Plan9, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number): void {
  const slot0 = Math.floor(tSec / 14);
  for (let s = slot0 - 6; s <= slot0; s += 1) {
    const F = flockOf9(s, P.w, P.h); if (!F) continue;
    const u = (tSec - F.t0) / F.dur; if (u < 0 || u > 1) continue;
    const cx = F.x0 + (F.x1 - F.x0) * u; const cy = F.y0 + (F.y1 - F.y0) * u;
    const dx = (F.x1 - F.x0) / Math.hypot(F.x1 - F.x0, F.y1 - F.y0); const dy = (F.y1 - F.y0) / Math.hypot(F.x1 - F.x0, F.y1 - F.y0);
    const sx = ox + cx * tp; const sy = oy + cy * tp;
    const vis = sx > -40 && sx < cw + 40 && sy > -40 && sy < ch + 40;
    if (vis && NATURE9.playing && !chirped9.has(F.id) && NATURE9.chirp) { chirped9.add(F.id); NATURE9.chirp(Math.max(-1, Math.min(1, (sx / Math.max(1, cw)) * 2 - 1))); }
    if (!vis) continue;
    const R = rng9("flock" + F.id);
    const bs = Math.max(4, tp * 0.34);
    for (let i = 0; i < F.n; i += 1) {
      const back = (i === 0 ? 0 : 0.8 + R() * 1.4) * Math.ceil(i / 2); const sideK = (i % 2 ? 1 : -1) * (0.6 + R() * 0.6) * Math.ceil(i / 2);
      const bx = sx + (-dx * back - dy * sideK) * tp * 0.7 + Math.sin(tSec * 2 + i) * tp * 0.08;
      const by = sy + (-dy * back + dx * sideK) * tp * 0.7 + Math.cos(tSec * 2.3 + i) * tp * 0.08;
      const flap = Math.sin(tSec * 14 + i * 1.7);
      /* 그림자(땅에 · 아래로 비킨) */
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(bx + tp * 0.6, by + tp * 1.2, bs * 0.6, bs * 0.25, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = F.col; ctx.lineWidth = Math.max(1.2, bs * 0.32); ctx.lineCap = "round"; ctx.lineJoin = "round";
      const wy = -flap * bs * 0.55;
      ctx.beginPath(); ctx.moveTo(bx - bs, by + wy); ctx.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.2 + wy * 0.3, bx, by); ctx.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.2 + wy * 0.3, bx + bs, by + wy); ctx.stroke();
      ctx.fillStyle = F.col; ctx.beginPath(); ctx.arc(bx, by, bs * 0.28, 0, 6.283); ctx.fill();
    }
  }
}

function drawMeteors9(ctx: CanvasRenderingContext2D, P: Plan9, ox: number, oy: number, tp: number, tSec: number): void {
  if (!P.spaceTiles.length) return;
  /* 4초 칸마다 — 셋 중 둘은 하나 · 가끔(1할) 서넛이 한꺼번에(유성우). 한 줄기 0.9초. */
  const slot0 = Math.floor(tSec / 4);
  for (let s = slot0 - 1; s <= slot0; s += 1) {
    const R = rng9("meteor" + s + ":" + P.w);
    const r0 = R(); const n = r0 < 0.3 ? 0 : r0 < 0.9 ? 1 : 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i += 1) {
      const t0 = s * 4 + R() * 3.2; const u = (tSec - t0) / 0.9; if (u < 0 || u > 1) { R(); R(); R(); continue; }
      const ti = P.spaceTiles[Math.floor(R() * P.spaceTiles.length)];
      const x0 = ti % P.w; const y0 = Math.floor(ti / P.w); const ang = 0.5 + R() * 0.5; const len = 5 + R() * 6;
      const hx = x0 + Math.cos(ang) * len * u; const hy = y0 + Math.sin(ang) * len * u;
      const tail = Math.min(u, 0.55) * len; const fade = u < 0.8 ? 1 : (1 - u) / 0.2;
      const X = ox + hx * tp; const Y = oy + hy * tp; const TX = X - Math.cos(ang) * tail * tp; const TY = Y - Math.sin(ang) * tail * tp;
      const gr = ctx.createLinearGradient(TX, TY, X, Y);
      gr.addColorStop(0, "rgba(160,200,255,0)"); gr.addColorStop(1, `rgba(235,245,255,${0.9 * fade})`);
      ctx.strokeStyle = gr; ctx.lineWidth = Math.max(1.5, tp * 0.12); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(TX, TY); ctx.lineTo(X, Y); ctx.stroke();
      const hg = ctx.createRadialGradient(X, Y, 0, X, Y, tp * 0.5);
      hg.addColorStop(0, `rgba(255,255,255,${fade})`); hg.addColorStop(1, "rgba(180,210,255,0)");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(X, Y, tp * 0.5, 0, 6.283); ctx.fill();
    }
  }
}
