/* ── 모델 메시 수집(2026-09) ─────────────────────────────────────────────────────
   빌더를 요잉 0·평면 시점으로 한 번 돌리고, 면마다 곁표(MESH9.byD)에 적힌 3D 폴리곤을 모아 **판 모형 공간 메시**를
   낸다. GPU 붓(WebGL)·자료 도구의 재료다. 음영 덧칠 면(#fff/#000 얕은 알파, 화면 곡선 그림자)은 GPU 조명이 대신하므로
   버린다. 임자색 면(fill 없음)은 fill "" 로 두어 붓이 임자색으로 바꿔 칠한다. */
import { MESH9, withTopView, withYaw, bake, type ShapeFace, type Poly3 } from "./shapeOblique";

export interface MeshPart9 { polys: Poly3[]; fill: string; alpha: number; team: boolean; lod: number }
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
export function collectMesh9(builder: () => ShapeFace[], filter?: (faces: ShapeFace[]) => ShapeFace[]): Mesh9 {
  MESH9.on = true; MESH9.byD.clear();
  let faces: ShapeFace[];
  try { faces = withTopView(() => bake(() => withYaw(0, builder))); }
  finally { MESH9.on = false; }
  if (filter) faces = filter(faces);   // 건설 단계(stageFaces) 같은 면 고르기 — 곁표는 그대로라 남은 면만 메시가 된다
  const parts: MeshPart9[] = [];
  let covered = 0; let skipped = 0;
  for (const f of faces) {
    if (isOverlay9(f)) { skipped += 1; continue; }
    let polys = MESH9.byD.get(f[0]);
    if (!polys && f[0].indexOf("Z M") > 0) {
      // 다각형 여럿을 이어 붙인 면(폴리 경로 둘 이상) — 조각마다 찾아 합친다.
      const acc: Poly3[] = [];
      for (const piece of f[0].split(/(?<=Z) (?=M)/)) { const q = MESH9.byD.get(piece); if (q) acc.push(...q); }
      if (acc.length) polys = acc;
    }
    if (!polys) continue;
    covered += 1;
    parts.push({ polys, fill: f[2] ?? "", alpha: f[1], team: f[2] === undefined, lod: f[4] ?? 0 });
  }
  MESH9.byD.clear();
  return { parts, faces: faces.length, covered, skipped };
}
