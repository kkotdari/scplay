/* ── 모델 메시 수집(2026-09) ─────────────────────────────────────────────────────
   빌더를 요잉 0·평면 시점으로 한 번 돌리고, 면마다 곁표(MESH9.byD)에 적힌 3D 폴리곤을 모아 **판 모형 공간 메시**를
   낸다. GPU 붓(WebGL)·자료 도구의 재료다. 음영 덧칠 면(#fff/#000 얕은 알파, 화면 곡선 그림자)은 GPU 조명이 대신하므로
   버린다. 임자색 면(fill 없음)은 fill "" 로 두어 붓이 임자색으로 바꿔 칠한다. */
import { MESH9, PROJ9, withTopView, withYaw, bake, zsorted, meshSphere9, meshLoft9, type ShapeFace, type Poly3 } from "./shapeOblique";

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
interface Sub { pts: number[][]; miss: number; ell?: { cx: number; cy: number; rx: number; ry: number }; sweep?: number; arcs?: number; lineAfter?: boolean; ri?: number }
/** 카메라를 보는 원반의 세로 축 — 평면 카메라(고각 40°)의 화면 위쪽을 모형 공간으로(−y·sinE, +z·cosE). */
const BILL: [number, number] = [Math.sin((40 * Math.PI) / 180), Math.cos((40 * Math.PI) / 180)];
/** 카메라를 보는 원반(빌보드)으로 되찾은 폴리곤 — GL 은 요잉을 안 돌리고 가운데만 돌린다(gl9 aBb). */
export const BILLBOARD9 = new WeakSet<Poly3>();
/** glow: 발광 효과 종류 — 화면 원은 불투명해도 구가 아니라 원반이다(2D 가 겹쳐 칠한 동심원 그대로). */
export function meshFromPath9(d: string, opaque = true, glow = false): Poly3[] | null {
  const tk = d.match(NUM); if (!tk) return null;
  const subs: Sub[] = [];
  let cur: Sub | null = null; let cx = 0, cy = 0; let i = 0; let cmd = "";
  const num = (): number => Number(tk[i++]);
  // 되찾은 점은 넣고, 못 찾은 점은 센다(빌더가 중점·보간으로 지은 점) — 다각형은 되찾은 점이 셋 이상이고 절반 넘게 되찾혔을 때만 쓴다
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
      const c3 = look(e0.cx, e0.cy); if (!c3) return null;
      const e1 = subs[1].ell; const ro = Math.max(e0.rx, e1.rx), ri = Math.min(e0.rx, e1.rx);
      const ring = (r: number): number[][] => { const out: number[][] = []; for (let k = 0; k < 16; k += 1) { const t = (k / 16) * Math.PI * 2; out.push([c3[0] + Math.cos(t) * r, c3[1] + Math.sin(t) * r, c3[2]]); } return out; };
      return meshLoft9([ring(ro), ring(ri)], false, false);
    }
    const out: Poly3[] = [];
    for (const s9 of subs) {
      const e = s9.ell!; const c3 = look(e.cx, e.cy); if (!c3) continue;
      if (s9.ri !== undefined) {
        // 반고리 — 바깥 호와 안 호 사이. sweep 1 이면 화면 위쪽(먼 쪽 = 모형 −y) 반, 0 이면 앞쪽 반
        const far = s9.sweep === 1; const ro = e.rx, ri = s9.ri;
        const half = (r: number): number[][] => { const o: number[][] = []; for (let k9 = 0; k9 <= 8; k9 += 1) { const t = (k9 / 8) * Math.PI; o.push([c3[0] + Math.cos(t) * r, c3[1] + (far ? -1 : 1) * Math.sin(t) * r, c3[2]]); } return o; };
        const A = half(ro), B = half(ri);
        for (let k9 = 0; k9 < 8; k9 += 1) out.push([...A[k9], ...A[k9 + 1], ...B[k9 + 1], ...B[k9]]);
        continue;
      }
      if (s9.lineAfter || (s9.arcs ?? 0) > 2) continue;   // 타원 꼴이 아닌 것(호 + 직선 섞임)
      const sph = Math.abs(e.rx - e.ry) < 0.02 * e.rx;
      if (sph) {
        if (opaque && !glow) out.push(...meshSphere9(c3[0], c3[1], c3[2], e.rx));
        else {
          // 반투명 화면 원(빛무리·구 껍질 광택)·발광 종류의 화면 원 — 구가 아니라 카메라를 보는 원반(빌보드)으로 둔다
          const disc: number[] = []; for (let k = 0; k < 16; k += 1) { const t = (k / 16) * Math.PI * 2; disc.push(c3[0] + Math.cos(t) * e.rx, c3[1] - Math.sin(t) * e.rx * BILL[0], c3[2] + Math.sin(t) * e.rx * BILL[1]); }
          BILLBOARD9.add(disc);
          out.push(disc);
        }
      } else {
        const disc: number[] = []; for (let k = 0; k < 12; k += 1) { const t = (k / 12) * Math.PI * 2; disc.push(c3[0] + Math.cos(t) * e.rx, c3[1] + Math.sin(t) * e.rx, c3[2]); }
        out.push(disc);
      }
    }
    return out.length ? out : null;
  }
  const out: Poly3[] = [];
  for (const s9 of subs) { if (s9.ell || s9.pts.length < 3 || s9.pts.length * 2 < s9.pts.length + s9.miss) continue; out.push(s9.pts.flat()); }
  return out.length ? out : null;
}
/** meshSphere9 는 mp3(모델 변환)를 거친 링을 낸다 — 여기 점은 이미 모형 공간이라 되돌린 것을 그대로 쓰려면 변환이 항등이어야 한다.
 *  기록은 빌더 밖(withYaw 0, 모델 변환 없음)에서 끝난 뒤 하므로(collectMesh9) 항등이다. */

/** 부품 — ow/ob 는 그 면 위에 얹혀 있던 음영 덧칠(흰·검 얕은 알파, 같은 경로의 topFace/sideFace/faceLight)을 접은 몫(0~1). */
export interface MeshPart9 { polys: Poly3[]; fill: string; alpha: number; team: boolean; lod: number; ow: number; ob: number; /** 빌보드 원반 부품(카메라를 본다) */ bb?: boolean }
export interface Mesh9 { parts: MeshPart9[]; faces: number; covered: number; skipped: number }

/** #rgb·#rrggbb 휘도(0~1). 못 읽으면 0.5. */
export const lum9 = (fill: string): number => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return 0.5;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16) / 255; const g = parseInt(h.slice(2, 4), 16) / 255; const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** 음영 덧칠(조명 흉내) 면 — GPU 에선 조명이 대신한다. 얕은 알파(<0.4)의 아주 밝거나(광) 아주 어두운(그늘) 면만
   걸러 낸다 — 종족 광택 색(#0d1016·#1a1708·#fff3cf…)도 여기 든다. 진한 검·흰 부품(알파 1)은 남긴다. */
export const isOverlay9 = (f: ShapeFace): boolean => {
  const fill = f[2]; const a = f[1];
  if (typeof fill !== "string" || a >= 0.4) return false;
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
  let covered = 0; let skipped = 0;
  for (const f of faces) {
    if (isOverlay9(f) && (!glow || byD.has(f[0]))) {
      /* ★ 음영 덧칠은 **반드시 몸에 접거나 버린다** — 제 부품으로 남기면 안 된다(실측: 보급고 103부품 중 54개가 반투명으로 남아
         건물이 통째로 비쳐 보였다). 접을 몸을 두 자로 찾는다:
           ① 같은 경로 — faceLight().face(d) 처럼 몸과 똑같은 패스로 얹히는 덧칠(대부분).
           ② 같은 부품 번호(tagKey 가 붙인 pid)의 **마지막 몸 면** — 제 꼴을 가진 그늘(원통 옆 그림자·돔 초승달·단면)은 경로가
              달라 ①로는 못 찾는다. 2D 는 그 그늘을 바로 앞 몸 위에 얹으므로, 같은 부품의 마지막 몸이 곧 그 자리다.
         둘 다 없으면 버린다(뜬 그림자 고리처럼 몸 없이 땅에 깔리는 덧칠). */
      const at = byD.get(f[0]) ?? (f[5] !== undefined ? byPid.get(f[5]) : undefined);
      if (at !== undefined) {
        const pt = parts[at]; const a = f[1];
        if (lum9(f[2] ?? "#fff") > 0.5) pt.ow = 1 - (1 - pt.ow) * (1 - a); else pt.ob = 1 - (1 - pt.ob) * (1 - a);
      }
      skipped += 1; continue;
    }
    let polys = MESH9.byD.get(f[0]);
    if (glow) {
      // 발광 종류: 헬퍼가 구로 적어 둔 화면 원(screenCircle)도 카메라를 보는 원반으로 — 2D 는 동심원을 겹쳐 칠했다
      const disc = meshFromPath9(f[0], false, true);
      if (disc && disc.length === 1 && BILLBOARD9.has(disc[0])) polys = disc;
    }
    if (!polys) { const back = meshFromPath9(f[0], f[1] >= 0.98, glow); if (back) { polys = back; MESH9.byD.set(f[0], back); } }
    if (!polys && f[0].indexOf("Z M") > 0) {
      // 다각형 여럿을 이어 붙인 면(폴리 경로 둘 이상) — 조각마다 찾아 합친다.
      const acc: Poly3[] = [];
      for (const piece of f[0].split(/(?<=Z) (?=M)/)) { const q = MESH9.byD.get(piece); if (q) acc.push(...q); }
      if (acc.length) polys = acc;
    }
    if (!polys) continue;
    covered += 1;
    byD.set(f[0], parts.length);
    if (f[5] !== undefined) byPid.set(f[5], parts.length);
    parts.push({ polys, fill: f[2] ?? "", alpha: f[1], team: f[2] === undefined, lod: f[4] ?? 0, ow: 0, ob: 0, bb: polys.length === 1 && BILLBOARD9.has(polys[0]) });
  }
  MESH9.byD.clear();
  return { parts, faces: faces.length, covered, skipped };
}
