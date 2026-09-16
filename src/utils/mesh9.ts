/* ── 모델 메시 수집(2026-09) ─────────────────────────────────────────────────────
   빌더를 요잉 0·평면 시점으로 한 번 돌리고, 면마다 곁표(MESH9.byD)에 적힌 3D 폴리곤을 모아 **판 모형 공간 메시**를
   낸다. GPU 붓(WebGL)·자료 도구의 재료다. 음영 덧칠 면(#fff/#000 얕은 알파, 화면 곡선 그림자)은 GPU 조명이 대신하므로
   버린다. 임자색 면(fill 없음)은 fill "" 로 두어 붓이 임자색으로 바꿔 칠한다. */
import { MESH9, PROJ9, EMIT_FILL9, unproject9, withTopView, withYaw, bake, zsorted, meshSphere9, meshLoft9, type ShapeFace, type Poly3 } from "./shapeOblique";

/** 2D 굽기가 반투명 **색 있는** 면에 얹던 알파 보정 — bake9.shadeBoost 와 **같은 식이어야 한다**(여기서 베낀 까닭은
 *  mesh9 ← bake9 로 되짚는 import 를 안 만들려고다). 이것을 안 태우면 GL 의 음영 덧칠이 2D 보다 1.25배 옅어
 *  모델이 통째로 납작해 보인다(실측: 그 자리가 "GL 이 덜 아름답다"의 큰 몫이었다). */
const shadeBoost9 = (o: number, fill?: string): number => (fill && o < 1 ? Math.min(0.7, o * 1.25) : o);
/** 되찾은 **원**의 조각 수(고리·빌보드 원반·땅 원반) — 2D 는 진짜 호를 칠하므로 둘레가 매끈한데, 메시는 조각이 적으면
 *  각이 보인다(실측: 16 조각이면 핵 충격파·워프인 둘레가 다각형으로 읽혔다). 32 면 둘레가 눈에 둥글고, 이 면들은
 *  효과·장식 몇 장뿐이라 삯이 없다. */
const RSEG9 = 32;
/** 두 경로의 **상자 넓이 비**(덧칠/몸, 상한 1) — 경로의 숫자만 훑어 상자를 낸다(요잉 0 의 화면 좌표라 비만 쓴다). */
function areaK9(dOv: string, dBody?: string): number {
  if (!dBody) return 1;
  const box9 = (d: string): number => {
    const n = d.match(/-?\d+(?:\.\d+)?/g);
    if (!n || n.length < 4) return 0;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = +n[i]; const y = +n[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  };
  const b9 = box9(dBody);
  if (!(b9 > 0)) return 1;
  return Math.min(1, box9(dOv) / b9);
}

/* ── 경로 문자열 → 3D 메시 되돌리기 ───────────────────────────────────────────────────────
   헬퍼를 안 거치고 빌더가 project() 결과로 손수 짠 경로(번개·크립 얼룩·구 껍질 screenCircle·땅 원 groundEllipse·고리 annulus)는
   곁표에 메시가 없다. 기록 중 project() 가 적어 둔 화면점→3D 표(PROJ9)로 꼭짓점을 되찾는다:
   · M/L 다각형: 꼭짓점마다 표를 찾는다(하나라도 없으면 포기).
   · Q/C 곡선: 끝점(과 제어점이 표에 있으면 그것도)으로 3D 이차곡선을 셋으로 편다.
   · 원·타원 한 쌍의 호(a … a … Z): 중심을 찾아 반지름이 같으면 **구**(screenCircle), 다르면 땅 **원반**(groundEllipse); 원반 둘이
     같은 중심이면 **고리**(annulusPath). 화면 반지름은 모형 자와 같다(사영에 배율이 없다 — 원근 f 만 무시). */
const NUM = /[MLQCAZmlqcaz]|-?\d*\.?\d+(?:e-?\d+)?/g;
const key2 = (x: number, y: number): string => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;
const look = (x: number, y: number): number[] | undefined => {
  const hit = PROJ9.get(key2(x, y)); if (hit) return hit;
  // 중심·중점처럼 셈으로 지은 좌표는 반올림이 한 칸 어긋날 수 있다 — 이웃 여덟 칸도 본다
  for (const dx of [-0.01, 0, 0.01]) for (const dy of [-0.01, 0, 0.01]) { if (!dx && !dy) continue; const h = PROJ9.get(key2(x + dx, y + dy)); if (h) return h; }
  return undefined;
};
/** ★ 기록에 없는 화면점 — **가까운 기록점의 높이를 빌려** 사영을 되짚는다(unproject9) ─────────────────
 *  빌더가 사영된 점에서 **화면 자로** 더해 만든 자리(아둔 링의 청록 띠 여섯·파일런 보석 따위)는 PROJ9 에 없어
 *  그 면이 통째로 빠졌다(실측: 아둔 51면 중 6면). 그런 장식은 어느 부품 옆에 붙은 것이므로, 화면에서 가장 가까운
 *  기록점과 **같은 높이**로 보는 것이 옳다 — 그 z 로 x·y 를 되짚으면 자리가 맞는다.
 *  너무 먼 기록점은 안 빌린다(모형 두 칸) — 엉뚱한 높이를 빌리면 장식이 공중에 뜬다. */
const NEAR_Z9 = 2;
/** ★ 되찾은 폴리곤 가운데 **높이를 빌려** 지은 것 — 자리가 어림이다(lookNear 의 두 번째 길).
 *  빌더가 화면 자로 더해 만든 중심(project 표에 없는 점)은 z 를 모르니 가장 가까운 기록점의 z 를 빌린다.
 *  그렇게 지은 데칼은 몸에 접거나 버린다(제 부품으로 남기면 엉뚱한 자리에 뜬다 — 셔틀 돔의 흰 무늬). */
export const GUESSED9 = new WeakSet<Poly3>();
let borrowed9 = false;
const lookNear = (x: number, y: number, maxD = NEAR_Z9): number[] | undefined => {
  const hit = look(x, y); if (hit) return hit;
  borrowed9 = true;
  let bd = Infinity; let bz: number | undefined;
  for (const [k, v] of PROJ9) {
    const sp = k.indexOf(" ");
    const d = Math.hypot(+k.slice(0, sp) - x, +k.slice(sp + 1) - y);
    if (d < bd) { bd = d; bz = v[2]; }
  }
  if (bz === undefined || bd > maxD) return undefined;
  return unproject9(x, y, bz);
};
interface Sub { pts: number[][]; miss: number; ell?: { cx: number; cy: number; rx: number; ry: number }; sweep?: number; arcs?: number; lineAfter?: boolean; ri?: number }
/** 카메라를 보는 원반의 세로 축 — 평면 카메라(고각 40°)의 화면 위쪽을 모형 공간으로(−y·sinE, +z·cosE). */
const BILL: [number, number] = [Math.sin((40 * Math.PI) / 180), Math.cos((40 * Math.PI) / 180)];
/** 카메라를 보는 원반(빌보드)으로 되찾은 폴리곤 — GL 은 요잉을 안 돌리고 가운데만 돌린다(gl9 aBb). */
export const BILLBOARD9 = new WeakSet<Poly3>();
/** glow: 발광 효과 종류 — 화면 원은 불투명해도 구가 아니라 원반이다(2D 가 겹쳐 칠한 동심원 그대로). */
export function meshFromPath9(d: string, opaque = true, glow = false): Poly3[] | null {
  const tk = d.match(NUM); if (!tk) return null;
  borrowed9 = false;
  /** 낼 때 어림 표식을 붙인다 — 높이를 빌린 자리가 하나라도 있으면 그 폴리곤들은 어림이다. */
  const mark9 = (ps: Poly3[] | null): Poly3[] | null => {
    if (ps && borrowed9) for (const q9 of ps) GUESSED9.add(q9);
    return ps;
  };
  const subs: Sub[] = [];
  let cur: Sub | null = null; let cx = 0, cy = 0; let i = 0; let cmd = "";
  const num = (): number => Number(tk[i++]);
  // 되찾은 점은 넣고, 못 찾은 점은 센다(빌더가 중점·보간으로 지은 점) — 다각형은 되찾은 점이 셋 이상이고 절반 넘게 되찾혔을 때만 쓴다
  /* ⚠ 꼭짓점은 **기록된 점만** 쓴다 — 가까운 점의 높이를 빌려(반지름 0.5 화면칸) 귀를 채워 보았더니
     띠(bandPath)의 네 귀뿐 아니라 온갖 손 면이 엉뚱한 높이로 되살아나 52 종이 나빠졌다(gl-check 평균
     0.179 → 0.193 · 실드 배터리 0.174 → 0.353 · 캐리어 0.138 → 0.275). 빌리는 길은 **중심 하나**(원·타원)
     에만 둔다 — 그때는 이웃 부품이 아니라 제 부품의 높이를 물어 오기 때문이다. */
  const put = (x: number, y: number): void => { if (!cur) return; const p = look(x, y); if (p) cur.pts.push(p); else cur.miss += 1; };
  while (i < tk.length) {
    const t = tk[i];
    if (/^[MLQCAZmlqcaz]$/.test(t)) { cmd = t; i += 1; if (cmd === "Z" || cmd === "z") { cmd = ""; continue; } }
    if (!cmd) { i += 1; continue; }
    switch (cmd) {
      case "M": { cx = num(); cy = num(); cur = { pts: [], miss: 0 }; subs.push(cur); put(cx, cy); cmd = "L"; break; }
      case "L": { cx = num(); cy = num(); if (cur && cur.ell) cur.lineAfter = true; else put(cx, cy); break; }
      case "Q": {
        const qx = num(), qy = num(), x = num(), y = num();
        const p0 = cur?.pts[cur.pts.length - 1]; const pc = look(qx, qy); const pe = look(x, y);
        if (p0 && pc && pe && cur) { for (const u of [0.33, 0.66]) { const v = 1 - u; cur.pts.push([v * v * p0[0] + 2 * v * u * pc[0] + u * u * pe[0], v * v * p0[1] + 2 * v * u * pc[1] + u * u * pe[1], v * v * p0[2] + 2 * v * u * pc[2] + u * u * pe[2]]); } cur.pts.push(pe); }
        else if (pe && cur) cur.pts.push(pe);
        else if (pc && cur) cur.pts.push(pc);   // 끝점은 중점(안 되찾힘) · 제어점은 사영점 — 제어점으로 곡선을 어림한다
        else if (cur) cur.miss += 1;
        cx = x; cy = y; break;
      }
      case "C": { num(); num(); num(); num(); const x = num(), y = num(); put(x, y); cx = x; cy = y; break; }
      case "A": case "a": {
        const rx = num(), ry = num(); num(); num(); num(); let x = num(), y = num();
        if (cmd === "a") { x += cx; y += cy; }
        // 원·타원 껍질: 첫 호가 (중심−rx, y) → (중심+rx, y) 로 건너면 타원으로 기억한다(둘째 호는 닫힘)
        if (cur && !cur.ell && cur.pts.length + cur.miss <= 1 && Math.abs(y - cy) < 0.011 && Math.abs(Math.abs(x - cx) - 2 * rx) < 0.02) { cur.ell = { cx: (cx + x) / 2, cy, rx, ry }; cur.sweep = Number(tk[i - 3]); cur.arcs = 1; }
        else if (cur && cur.ell && cur.arcs === 1 && cur.lineAfter && Math.abs(y - cy) < 0.011 && Math.abs(Math.abs(x - cx) - 2 * rx) < 0.02) { cur.ri = rx; cur.arcs = 2; }   // 반고리(고리 앞·뒤 반쪽)
        else if (cur && cur.ell) cur.arcs = (cur.arcs ?? 1) + 1;
        else if (cur) cur.miss += 1;   // 낯선 호 — 이 조각은 못 되찾는다
        cx = x; cy = y; break;
      }
      default: i += 1;
    }
  }
  if (!subs.length) return null;
  // 타원 갈래
  if (subs.every((s9) => s9.ell)) {
    const e0 = subs[0].ell!;
    // 고리(annulusPath): 같은 중심의 타원 둘
    if (subs.length === 2 && subs[1].ell && Math.abs(subs[1].ell.cx - e0.cx) < 0.02 && Math.abs(subs[1].ell.cy - e0.cy) < 0.02) {
      const c3 = lookNear(e0.cx, e0.cy); if (!c3) return null;
      const e1 = subs[1].ell; const ro = Math.max(e0.rx, e1.rx), ri = Math.min(e0.rx, e1.rx);
      const ring = (r: number): number[][] => { const out: number[][] = []; for (let k = 0; k < RSEG9; k += 1) { const t = (k / RSEG9) * Math.PI * 2; out.push([c3[0] + Math.cos(t) * r, c3[1] + Math.sin(t) * r, c3[2]]); } return out; };
      return meshLoft9([ring(ro), ring(ri)], false, false);
    }
    const out: Poly3[] = [];
    for (const s9 of subs) {
      const e = s9.ell!; const c3 = lookNear(e.cx, e.cy); if (!c3) continue;
      if (s9.ri !== undefined) {
        // 반고리 — 바깥 호와 안 호 사이. sweep 1 이면 화면 위쪽(먼 쪽 = 모형 −y) 반, 0 이면 앞쪽 반
        const far = s9.sweep === 1; const ro = e.rx, ri = s9.ri;
        const half = (r: number): number[][] => { const o: number[][] = []; for (let k9 = 0; k9 <= RSEG9 / 2; k9 += 1) { const t = (k9 / (RSEG9 / 2)) * Math.PI; o.push([c3[0] + Math.cos(t) * r, c3[1] + (far ? -1 : 1) * Math.sin(t) * r, c3[2]]); } return o; };
        const A = half(ro), B = half(ri);
        for (let k9 = 0; k9 < RSEG9 / 2; k9 += 1) out.push([...A[k9], ...A[k9 + 1], ...B[k9 + 1], ...B[k9]]);
        continue;
      }
      if (s9.lineAfter || (s9.arcs ?? 0) > 2) continue;   // 타원 꼴이 아닌 것(호 + 직선 섞임)
      const sph = Math.abs(e.rx - e.ry) < 0.02 * e.rx;
      if (sph) {
        if (opaque && !glow) out.push(...meshSphere9(c3[0], c3[1], c3[2], e.rx));
        else {
          // 반투명 화면 원(빛무리·구 껍질 광택)·발광 종류의 화면 원 — 구가 아니라 카메라를 보는 원반(빌보드)으로 둔다
          const disc: number[] = []; for (let k = 0; k < RSEG9; k += 1) { const t = (k / RSEG9) * Math.PI * 2; disc.push(c3[0] + Math.cos(t) * e.rx, c3[1] - Math.sin(t) * e.rx * BILL[0], c3[2] + Math.sin(t) * e.rx * BILL[1]); }
          BILLBOARD9.add(disc);
          out.push(disc);
        }
      } else {
        const disc: number[] = []; for (let k = 0; k < RSEG9; k += 1) { const t = (k / RSEG9) * Math.PI * 2; disc.push(c3[0] + Math.cos(t) * e.rx, c3[1] + Math.sin(t) * e.rx, c3[2]); }
        out.push(disc);
      }
    }
    return mark9(out.length ? out : null);
  }
  const out: Poly3[] = [];
  for (const s9 of subs) { if (s9.ell || s9.pts.length < 3 || s9.pts.length * 2 < s9.pts.length + s9.miss) continue; out.push(s9.pts.flat()); }
  return mark9(out.length ? out : null);
}
/** meshSphere9 는 mp3(모델 변환)를 거친 링을 낸다 — 여기 점은 이미 모형 공간이라 되돌린 것을 그대로 쓰려면 변환이 항등이어야 한다.
 *  기록은 빌더 밖(withYaw 0, 모델 변환 없음)에서 끝난 뒤 하므로(collectMesh9) 항등이다. */

/** 부품 — ow/ob 는 그 면 위에 얹혀 있던 음영 덧칠(흰·검 얕은 알파, 같은 경로의 topFace/sideFace/faceLight)을 접은 몫(0~1). */
export interface MeshPart9 { polys: Poly3[]; fill: string; alpha: number; team: boolean; lod: number; ow: number; ob: number; /** 빌보드 원반 부품(카메라를 본다) */ bb?: boolean;
  /** 그 부품을 낸 면의 경로 — 덧칠을 접을 때 **넓이 몫**을 재는 자다(아래 areaK9). */ d?: string;
  /** **닫힌 입체**의 낯인가 — 붓이 그 낯만 뒷면을 걸러낸다(아래 solidSigns9). */ solid?: boolean;
  /** 그 낯의 감기가 **안쪽**을 보나 — 참이면 붓이 법선을 뒤집는다(부품의 과반). */ flip?: boolean;
  /** 폴리마다의 그 값 — 한 부품 안에서도 감기가 섞인다(헬퍼가 면을 되쓴 자리). 붓은 이것을 먼저 본다. */ flips?: boolean[];
  /** **빛을 내는 부품**인가 — 붓의 번짐(블룸)이 이 부품만 한 번 더 그려 흐린다(켠 창·플라즈마·발광 효과). */
  emit?: boolean }
export interface Mesh9 { parts: MeshPart9[]; faces: number; covered: number; skipped: number;
  /** 헬퍼가 **일부러 비워 둔** 면 수 — rodFaces 는 관 하나를 첫 낯에 몰아 적고 나머지 낯(둘째 끝·몸통)에는
   *  빈 표를 적는다. 그 낯은 빠진 것이 아니라 이미 딴 낯이 낸 것이라, 덮임 셈의 분모에서 뺀다. */
  blank: number;
  /** 3D 로 되찾지 못해 **빠진** 면의 경로(앞 12개까지) — GL 에서 사라진 부품을 찾는 자다(model-mesh --dump). */
  missed: string[] }

/** #rgb·#rrggbb 휘도(0~1). 못 읽으면 0.5. */
export const lum9 = (fill: string): number => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return 0.5;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16) / 255; const g = parseInt(h.slice(2, 4), 16) / 255; const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** #rgb·#rrggbb 채도(최대 − 최소 성분, 0~1). 못 읽으면 0. */
export const chroma9 = (fill: string): number => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return 0;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return Math.max(...v) - Math.min(...v);
};
/** 폴리 하나의 뉴얼 벡터(길이 = 넓이×2)와 가운데. */
function face9(p: Poly3): { n: [number, number, number]; c: [number, number, number] } {
  const k = p.length / 3;
  let nx = 0; let ny = 0; let nz = 0; let cx = 0; let cy = 0; let cz = 0;
  for (let i = 0; i < k; i += 1) {
    const j = (i + 1) % k;
    const px = p[i * 3]; const py = p[i * 3 + 1]; const pz = p[i * 3 + 2];
    const qx = p[j * 3]; const qy = p[j * 3 + 1]; const qz = p[j * 3 + 2];
    nx += (py - qy) * (pz + qz); ny += (pz - qz) * (px + qx); nz += (px - qx) * (py + qy);
    cx += px; cy += py; cz += pz;
  }
  return { n: [nx, ny, nz], c: [cx / k, cy / k, cz / k] };
}
/** ★ **닫힌 입체 판정 + 낯마다의 안·바깥**(2026-09) ─────────────────────────────────────────────────
 *  2D 는 화가 차례로 그려 속면이 늘 나중 면에 덮였다. GL 은 진짜 깊이라 **속면이 이길 수 있다**(실측: 셔틀 말굽
 *  집게의 속벽이 몸통을 덮었다). 속이 막힌 덩이는 속을 볼 일이 없으니 붓이 뒷면을 걸러내면 그 겹침이 사라진다.
 *  판정과 방향을 한 번에 낸다:
 *    ① **다양체**여야 한다 — 모든 모서리를 정확히 두 낯이 나눠 쓴다(열린 껍질·한 장짜리 장식은 여기서 떨어진다).
 *    ② 감기 차례는 헬퍼마다 뒤섞여 있다(뿔의 뚜껑·돔의 밑판) — 그래서 이웃을 타고 **번져 가며 맞춘다**(BFS):
 *       공유 모서리를 두 낯이 **같은 방향**으로 돌면 한쪽이 거꾸로다.
 *    ③ 맞춘 방향으로 부호 있는 부피(발산 정리 Σ(c·n)/6)를 재서 음수면 전부 뒤집는다 — 그러면 법선이 바깥을 본다.
 *  돌려주는 것은 폴리마다의 부호(+1 그대로 · −1 뒤집기)이고, 다양체가 아니거나 안·바깥이 없으면(뫼비우스) null 이다. */
function solidSigns9(polys: Poly3[]): number[] | null {
  if (polys.length < 4) return null;
  const key9 = (a: number[], i: number): string => `${a[i].toFixed(3)},${a[i + 1].toFixed(3)},${a[i + 2].toFixed(3)}`;
  /** 모서리(무방향) → [낯 번호, 그 낯이 돈 방향(a<b 면 +1)] 짝 둘 */
  const edges = new Map<string, [number, number][]>();
  for (let f = 0; f < polys.length; f += 1) {
    const p = polys[f];
    const n = p.length / 3;
    if (n < 3) return null;
    for (let i = 0; i < n; i += 1) {
      const a = key9(p, i * 3); const b = key9(p, ((i + 1) % n) * 3);
      if (a === b) continue;
      const fwd = a < b;
      const k = fwd ? `${a}|${b}` : `${b}|${a}`;
      const got = edges.get(k);
      if (got) { if (got.length >= 2) return null; got.push([f, fwd ? 1 : -1]); } else edges.set(k, [[f, fwd ? 1 : -1]]);
    }
  }
  for (const v of edges.values()) if (v.length !== 2) return null;   // 열린 자리 — 껍질이다
  const sign = new Array<number>(polys.length).fill(0);
  const adj = new Map<number, [number, number][]>();   // 낯 → [이웃 낯, 같은 방향인가]
  for (const v of edges.values()) {
    const f0 = v[0][0]; const d0 = v[0][1]; const f1 = v[1][0]; const d1 = v[1][1];
    (adj.get(f0) ?? adj.set(f0, []).get(f0))!.push([f1, d0 === d1 ? 1 : 0]);
    (adj.get(f1) ?? adj.set(f1, []).get(f1))!.push([f0, d0 === d1 ? 1 : 0]);
  }
  sign[0] = 1;
  const q = [0];
  let seen = 1;
  while (q.length) {
    const f = q.pop()!;
    for (const [g, same] of adj.get(f) ?? []) {
      // 같은 방향으로 돌았으면 감기가 거꾸로다 → 부호를 뒤집는다.
      const want = same ? -sign[f] : sign[f];
      if (sign[g] === 0) { sign[g] = want; seen += 1; q.push(g); }
      else if (sign[g] !== want) return null;   // 안·바깥이 없다
    }
  }
  if (seen !== polys.length) return null;   // 덩이가 둘 이상 — 한 뭉치로 다루지 않는다
  let v9 = 0;
  for (let f = 0; f < polys.length; f += 1) {
    const fc = face9(polys[f]);
    v9 += sign[f] * (fc.c[0] * fc.n[0] + fc.c[1] * fc.n[1] + fc.c[2] * fc.n[2]) / 6;
  }
  if (v9 < 0) for (let f = 0; f < polys.length; f += 1) sign[f] = -sign[f];
  return sign;
}
/** 음영 덧칠(조명 흉내) 면 — GPU 에선 조명이 대신한다. 얕은 알파(<0.4)의 아주 밝거나(광) 아주 어두운(그늘) 면만
   걸러 낸다 — 종족 광택 색(#0d1016·#1a1708·#fff3cf…)도 여기 든다. 진한 검·흰 부품(알파 1)은 남긴다. */
export const isOverlay9 = (f: ShapeFace): boolean => {
  const fill = f[2]; const a = f[1];
  if (typeof fill !== "string" || a >= 0.4) return false;
  /* ★ **색이 짙은 면은 덧칠이 아니라 몸이다**(2026-09) — 휘도만 보면 네온 초록(가스 #80ff96, 휘도 0.86)·
     네온 하늘 같은 **밝은 색 몸**이 덧칠로 접혀 사라진다(실측: 간헐천의 고인 가스와 초록 김 셋이 통째로
     사라져 돌그릇만 남았다 — GL 화소가 2D 의 3분의 2였다).
     음영 덧칠은 회색 계열이다(흰·검, 종족 광택색 #0d1016 채도 0.04 · #1a1708 0.07 · #fff3cf 0.19).
     채도(최대−최소 성분) 0.25 를 문턱으로 두면 그 다섯은 남고 네온색(0.50)은 몸으로 간다. */
  if (chroma9(fill) > 0.25) return false;
  const L = lum9(fill);
  return L < 0.2 || L > 0.8;
};

/** 빌더 하나를 요잉 0 평면 시점으로 굽고 메시로 모은다. 굽는 동안만 메시 기록을 켠다. */
/** glow: 발광 효과(아콘·워프인·폭풍·핵) — 반투명 흰·검 면이 음영 덧칠이 아니라 **그 자체가 몸**(빛무리·구 껍질)이다.
 *  같은 경로에 몸이 있을 때만 접고, 나머지는 반투명 부품으로 남긴다(보통 종류에서는 비쳐 보이게 만드는 바로 그 규칙). */
export function collectMesh9(builder: () => ShapeFace[], filter?: (faces: ShapeFace[]) => ShapeFace[], glow = false): Mesh9 {
  MESH9.on = true; MESH9.byD.clear(); PROJ9.clear();
  let faces: ShapeFace[];
  try { faces = withTopView(() => bake(() => withYaw(0, builder))); }
  finally { MESH9.on = false; }
  if (filter) faces = filter(faces);   // 건설 단계(stageFaces) 같은 면 고르기 — 곁표는 그대로라 남은 면만 메시가 된다
  faces = zsorted(faces);   // 2D 와 같은 화가 차례(깊이 키) — 부품 차례 편향(aOrd)의 자다
  const parts: MeshPart9[] = [];
  const byD = new Map<string, number>();    // 경로 → 그 경로로 마지막에 난 부품(덧칠을 접을 첫째 자리)
  const byPid = new Map<number, number>();  // 부품 번호(ShapeFace[5]) → 그 부품의 마지막 몸 면(둘째 자리)
  let covered = 0; let skipped = 0; let blank = 0; const missed: string[] = [];
  /** 부품마다의 **뭉치 번호**(tagKey 의 pid) — 아래에서 같은 뭉치를 모아 닫힌 입체인가를 잰다. */
  const pidAt: (number | undefined)[] = [];
  /** 이 면의 3D 폴리 찾기 — 곁표(헬퍼가 적어 둔 것) → 손수 짠 경로 되찾기 → 여러 조각 이어 붙인 경로.
   *  되찾기는 MESH9.byD 에 적어 두므로 두 번째 호출은 표 읽기뿐이다(아래 몸 상자 앞잡이가 그 값을 쓴다). */
  const geomOf9 = (f: ShapeFace): Poly3[] | undefined => {
    const had9 = MESH9.byD.get(f[0]);
    /* ★ **빈 표는 '못 적었다'가 아니라 '적을 것이 없다'는 말이다**(2026-09, 지적: "탱크 오른쪽 좀
       떨어진 곳에 구슬이 있어 뭐지") — 관·막대 헬퍼는 제 메시를 **첫 낯 하나에 몰아** 적고 나머지
       낯에는 빈 표(`meshPut9(d, [])`)를 적어 '이건 딴 낯이 낸다'고 표시한다. 그런데 여기서 빈 표를
       `없음`과 똑같이 봐서, 그 낯들이 **손수 짠 경로 되찾기**로 넘어갔다. 되찾기는 경로만 보므로
       tubeFaces 의 **반대쪽 끝 원반**(원 경로)을 화면 원으로 읽어 **구**로 되살렸고, 그 구의 높이는
       가장 가까운 기록점에서 **빌린 값**이라 엉뚱한 자리에 떴다 — 시즈 차체 기동륜의 뒤쪽 끝 원반이
       모델 밖 y −7.4 에 지름 1 짜리 흰 구슬로 떠 있었다.
       곧 갈라야 하는 것은 셋이다: **없음**(되찾기) · **빈 표**(딴 낯이 낸다 — 그냥 둔다) · **있음**. */
    let polys = had9;
    if (glow && had9?.length !== 0) {
      // 발광 종류: 헬퍼가 구로 적어 둔 화면 원(screenCircle)도 카메라를 보는 원반으로 — 2D 는 동심원을 겹쳐 칠했다
      const disc = meshFromPath9(f[0], false, true);
      if (disc && disc.length === 1 && BILLBOARD9.has(disc[0])) polys = disc;
    }
    if (had9 === undefined && (!polys || !polys.length)) { const back = meshFromPath9(f[0], f[1] >= 0.98, glow); if (back && back.length) { polys = back; MESH9.byD.set(f[0], back); } }
    if (had9 === undefined && (!polys || !polys.length) && f[0].indexOf("Z M") > 0) {
      // 다각형 여럿을 이어 붙인 면(폴리 경로 둘 이상) — 조각마다 찾아 합친다.
      const acc: Poly3[] = [];
      for (const piece of f[0].split(/(?<=Z) (?=M)/)) { const q = MESH9.byD.get(piece); if (q) acc.push(...q); }
      if (acc.length) polys = acc;
    }
    return polys && polys.length ? polys : undefined;
  };
  /* ★ **불투명 몸의 상자**를 먼저 잰다(2026-09) — 몸 없는 덧칠(제 pid 에 몸 면이 없는 데칼)을 제 부품으로
     남길지 가리는 자다. 되찾기가 틀려 몸 **밖으로 튄** 것은 2D 에서 몸 안에 있던 무늬이므로 버린다
     (실측: 라바 등의 마디 구슬이 사영 되짚기에서 z 를 잘못 빌려 몸 위 허공에 사슬로 떴다).
     굴리며 재면(앞 면들만) 몸보다 먼저 칠하는 데칼이 통째로 걸러진다 — 그래서 앞잡이로 한 번 다 돈다. */
  const bb9 = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    if (f[1] < 0.98 || isOverlay9(f)) continue;
    const ps9 = geomOf9(f);
    if (!ps9) continue;
    for (const q9 of ps9) for (let i9 = 0; i9 + 2 < q9.length; i9 += 3) {
      if (q9[i9] < bb9[0]) bb9[0] = q9[i9]; if (q9[i9] > bb9[3]) bb9[3] = q9[i9];
      if (q9[i9 + 1] < bb9[1]) bb9[1] = q9[i9 + 1]; if (q9[i9 + 1] > bb9[4]) bb9[4] = q9[i9 + 1];
      if (q9[i9 + 2] < bb9[2]) bb9[2] = q9[i9 + 2]; if (q9[i9 + 2] > bb9[5]) bb9[5] = q9[i9 + 2];
    }
  }
  /** 그 기하가 몸 상자 안에 드나 — 되찾기가 틀려 몸 밖으로 튄 덧칠을 걸러 낸다. */
  const inBody9 = (ps: Poly3[]): boolean => {
    if (bb9[3] < bb9[0]) return false;
    /* 여유는 **몸 크기에 비례**한다 — 땅에 번지는 얼룩(저그 둔덕·주둥이)은 몸 상자보다 조금 넓은 것이 맞고,
       되찾기가 틀려 튄 것은 그보다 한참 멀리 간다. 0.4 + 상자 지름의 12%. */
    const M9 = 0.4 + 0.12 * Math.max(bb9[3] - bb9[0], bb9[4] - bb9[1], bb9[5] - bb9[2]);
    for (const q9 of ps) for (let i9 = 0; i9 + 2 < q9.length; i9 += 3) {
      if (q9[i9] < bb9[0] - M9 || q9[i9] > bb9[3] + M9) return false;
      if (q9[i9 + 1] < bb9[1] - M9 || q9[i9 + 1] > bb9[4] + M9) return false;
      if (q9[i9 + 2] < bb9[2] - M9 || q9[i9 + 2] > bb9[5] + M9) return false;
    }
    return true;
  };
  for (const f of faces) {
    const polys = geomOf9(f);
    const has9 = !!polys && polys.length > 0;
    if (isOverlay9(f) && (!glow || byD.has(f[0]))) {
      /* ★ 음영 덧칠은 **몸에 접거나 · 제 부품으로 남기거나 · 버린다**. 접을 몸을 두 자로 찾는다:
           ① 같은 경로 — faceLight().face(d) 처럼 몸과 똑같은 패스로 얹히는 덧칠(대부분).
           ② 같은 부품 번호(tagKey 가 붙인 pid)의 **마지막 몸 면** — 제 꼴을 가진 그늘(원통 옆 그림자·돔 초승달·단면)은
              경로가 달라 ①로는 못 찾는다. 2D 는 그 그늘을 바로 앞 몸 위에 얹으므로, 같은 부품의 마지막 몸이 곧 그 자리다.
         ★ **몸보다 작고 제 기하가 있는 그늘은 접지 않는다**(2026-09) — 접기는 부품 **전체**에 같은 세기를 먹이는 손이라,
           2D 가 한 자리에만 칠한 그늘을 접으면 그 자리는 옅어지고 나머지가 괜히 어두워져 결이 뭉개진다(실측: 셔틀 돔
           뒤의 그늘 25%가 넓이 몫 0.2 로 눌려 5%가 되자 돔이 통째로 파랗게 떴다). 그런 그늘은 얇은 판이라 GL 도 그대로
           그릴 수 있다: 반투명 한 장짜리라 데칼로 잡혀 깊이 편향을 받고(gl9 isDecal), 불투명 몸 위에 섞인다.
           되찾을 기하가 **없으면**(종족 광택의 초승달 같은 손 경로) 종전처럼 넓이 몫만큼 접는다 — 안 접으면 통째로 사라진다.
         몸도 없고 기하도 없으면 버린다(땅에 깔리는 그림자 고리). */
      const same9 = byD.get(f[0]);
      const at = same9 ?? (f[5] !== undefined ? byPid.get(f[5]) : undefined);
      const k9 = at === undefined ? 1 : (same9 !== undefined ? 1 : areaK9(f[0], parts[at].d));
      if (!(has9 && polys
        && (at === undefined ? inBody9(polys) && !polys.some((q9) => GUESSED9.has(q9)) : k9 < 0.6))) {
        if (at !== undefined) {
          const pt = parts[at];
          const a = shadeBoost9(f[1], f[2]) * k9;
          if (lum9(f[2] ?? "#fff") > 0.5) pt.ow = 1 - (1 - pt.ow) * (1 - a); else pt.ob = 1 - (1 - pt.ob) * (1 - a);
        }
        skipped += 1; continue;
      }
      // 작은 그늘 + 제 기하 있음 — 아래로 내려가 제 부품이 된다.
    }
    if (!has9 || !polys) {
      /* 헬퍼가 일부러 빈 표를 적어 둔 낯은 **빠진 것이 아니다** — 같은 부품의 딴 낯이 그 기하를 통째로 냈다
         (rodFaces: 첫 끝 낯에 관 하나). 그것을 '되찾기 실패'로 세면 덮임 표가 거짓으로 낮아지고 ⚠ 목록이
         쓸모를 잃는다(실측: 배럭 16 면 중 12 개가 이것이었다). */
      if (MESH9.byD.get(f[0])?.length === 0) blank += 1;
      else if (missed.length < 12) missed.push(`${f[2] ?? "(임자)"} a=${f[1]} ${f[0].slice(0, 110)}`);
      continue;
    }
    covered += 1;
    byD.set(f[0], parts.length);
    if (f[5] !== undefined) byPid.set(f[5], parts.length);
    parts.push({ polys, fill: f[2] ?? "", alpha: shadeBoost9(f[1], f[2]), team: f[2] === undefined, lod: f[4] ?? 0, ow: 0, ob: 0, bb: polys.length === 1 && BILLBOARD9.has(polys[0]), d: f[0],
      /* 빛나는 면 — 발광 종류(폭풍·핵·아콘·워프인)는 **밝은 색 면만**(어두운 속 몸은 빛이 아니다 ·
         임자색 면도 몸이다), 그 밖의 종류는 '켜진 색' 표(EMIT_FILL9)에 든 색만. */
      emit: f[2] !== undefined && (glow ? lum9(f[2]) > 0.55 : EMIT_FILL9.has(f[2])) });
    pidAt.push(f[5]);
  }
  /* ★ 닫힌 입체 표시 — 빌더는 한 덩이를 낯 여러 장으로 내므로(부품 하나 = 낯 하나), 닫힘은 부품이 아니라
     **뭉치(pid)** 단위로 잰다. 같은 pid 의 폴리를 모아 solidSigns9 에 넘기고, 나온 부호를 부품마다 나눠 준다. */
  {
    const byPid9 = new Map<number, number[]>();
    for (let i = 0; i < parts.length; i += 1) {
      const pid = pidAt[i];
      if (pid === undefined || parts[i].alpha < 0.98) continue;   // 반투명 뭉치는 속이 보여야 한다(유리·빛무리)
      (byPid9.get(pid) ?? byPid9.set(pid, []).get(pid))!.push(i);
    }
    for (const idx of byPid9.values()) {
      if (idx.length < 4) continue;
      const all: Poly3[] = [];
      for (const i of idx) all.push(...parts[i].polys);
      const sign = solidSigns9(all);
      if (!sign) continue;
      let at = 0;
      for (const i of idx) {
        /* ★ 감기는 **폴리마다** 싣는다 — 부품의 과반으로 하나만 실으면 소수 쪽 낯이 거꾸로 뒤집혀
           보이는 낯까지 걷혔다(실측: 케이번·아카데미에서 몇십 화소가 사라졌다). */
        const fl9: boolean[] = [];
        for (let k = 0; k < parts[i].polys.length; k += 1) fl9.push(sign[at + k] < 0);
        at += parts[i].polys.length;
        parts[i].solid = true;
        parts[i].flips = fl9;
        parts[i].flip = fl9.filter((v9) => v9).length * 2 > fl9.length;
      }
    }
  }
  MESH9.byD.clear();
  return { parts, faces: faces.length, covered, skipped, blank, missed };
}
