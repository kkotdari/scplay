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
import { drawBirds9, drawMeteors9, type Species9 } from "./sky9";

/** 나무 · 풀 · 꽃 · 폭포를 그리나 — 끔(2026-11-15, 요청: "물이나 비 효과 수준으로 디테일하고 사실적으로 · 일단 유성과 새만") — 자리 뽑기 · 판은 남겨 두고 그리지 않는다. */
const NATURE_PROPS9 = false;

const KEY9 = "scr.nature";
export function natureOnStored9(): boolean {
  /* ★ 재생기엔 아직 안 싣는다(2026-11-15 같은 날, 요청: "자연효과는 일단 기능만 만들고 재생기에 넣진 말기 · 아직 모델링이 많이 부족") — 시험 주소 `#nature=1` 일 때만 켠다.
     표시 단추의 '자연' 줄도 걷었다. 옛(같은 날): 기본 켬(끈 기기 "0" 만 끔) → 그 앞 첫 판: 기본 끔 · 켠 기기("1")만 켬. */
  if (typeof location !== "undefined") { const m = /(?:^|[#&,])nature=([01])/.exec(location.hash); if (m) return m[1] === "1"; }
  return false;
}
export function natureStore9(on: boolean): void { try { localStorage.setItem(KEY9, on ? "1" : "0"); } catch { /* 사생활 모드 */ } }

/** 그리는 쪽이 읽는 상태 — 재생기가 켬 · 지형 기하를 넣는다(TERR_WX9 와 같은 꼴). */
export const NATURE9: { on: boolean; geom: TerrainGeom9 | null; rgb: Uint8Array | null; hash: string; playing: boolean; call: ((sp: Species9, pan: number, vol: number) => void) | null } =
  { on: false, geom: null, rgb: null, hash: "", playing: false, call: null };

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
        cand.push({ x: x + 0.5, y0: y - 0.05, y1: y1 + 0.15, w: (1.0 + R() * 1.0) * (isWater(at(x, y1)) ? 1 : -1), ph: R() * 10 });   // 폭 부호 — 물에 떨어지면 + (glTerrain9 fallPass 물결 고리)
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
  /* 우주 판 — 유성(sky9 ★) · 모든 판 — 새 그림자(새 몸은 몸 위 층 drawNatureSky9). 설치 · 잿빛 판도 새는 난다("우주에도 새는 똑같이"). */
  if (P.space) drawMeteors9(ctx, P.spaceTiles, P.w, ox, oy, tp, tSec);
  drawBirds9(ctx, P.w, P.h, ox, oy, tp, cw, ch, tSec, true, null);
  const leaf = LEAF9[P.ts]; if (P.space || !leaf || !NATURE_PROPS9) { ctx.restore(); return; }
  const small = tp < 7;   // 낮은 배율 — 풀 · 꽃 · 덤불은 건너뛴다(점으로 뭉갠다)
  /* ① 폭포는 GL 지형 층이 그린다(glTerrain9 TERR_FALLS9 · 기존 물 질감 — 2026-11-15 "폭포 추가 · 물 질감은 기존 물 사용") — 자리만 natureFallList9 로 넘긴다. */
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
  ctx.restore();
}

/** 몸 위 층(새 몸) — 유닛 캔버스 위에 따로 선 하늘 캔버스에 그린다(재생기 UnitLayer 의 skyRef). 울음은 재생 중에만. */
export function drawNatureSky9(ctx: CanvasRenderingContext2D, ox: number, oy: number, tp: number, cw: number, ch: number, tSec: number): void {
  const G = NATURE9.geom; if (!NATURE9.on || !G || tp < 2) return;
  drawBirds9(ctx, G.w, G.h, ox, oy, tp, cw, ch, tSec, false, NATURE9.playing ? NATURE9.call : null);
}

/** 폭포 자리 — (가운데 x, 위 y, 아래 y, 폭) 넷씩 · 타일. 지형 GL 층(TERR_FALLS9)이 그린다. 자연 판(타일셋)이 아니거나 기하가 없으면 빈 배열. */
export function natureFallList9(): number[] {
  const G = NATURE9.geom; if (!G) return [];
  const P = planOf9(G, NATURE9.hash); const out: number[] = [];
  for (const f of P.falls) out.push(f.x, f.y0, f.y1, f.w);
  return out;
}
