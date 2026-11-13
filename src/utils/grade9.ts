/** ★★ **원작 색감 곡선**(2026-11-13, 요청: "원작 스샷과 색 농도 · 색감 · 명암 대비 차이가 커" → 시안 → 지형 "B · C 중간" · 몸 "B · 채도 1.1") —
 *  실측(원작 11장 · 재생기 4장 · 같은 자): 원작 밝기 중앙값 0.16~0.22 · 어두운 끝(p5) 0.05~0.09 · 채도 평균 0.38 / 재생기 0.30~0.37 · 0.20 · 0.21.
 *  ★ **굽는다 — 기기에서 화소마다 셈하지 않는다**(같은 날, 지적: "그거(#con) 그냥 테스트용이었고 실제로는 모델에 적용해서 구워야 기기에서 부하가 없지"):
 *    · 지형 — 지도를 열 때 terrainGeom 이 색(갈래 색 · 타일 실색)을 이 곡선으로 한 번 바꾼다(gradeRgb9).
 *    · 몸 — 아틀라스(2D 판)를 구울 때 메시 FS 가 얹는다(gl9 SPR_GRADE9 · 판 해시에 든다). 큰 배율 메시 길도 같은 FS 라 같은 그림.
 *  곡선(차례대로): 채도 s(휘도 둘레) → 검은점 bp((c − bp) ÷ (1 − bp)) → 중간톤 감마 γ → 밝은 끝 무릎(kn 위는 기울기 ks). 값 [bp, γ, kn, ks, s] · s 0 이면 끔. */
export type Grade9 = readonly [number, number, number, number, number];
/** `#grade=0` — 지형 곡선 끔 · 몸 메시 길 끔(견줌 · 판에 구운 몸은 그대로). */
export const GRADE_OFF9 = typeof location !== "undefined" && /(?:^|[#&,])grade=0(?=$|[&,])/.test(location.hash);
/** `#bgrade=bp~γ~kn~ks~s` — 몸 곡선 견줌(model-gl 시안 굽기). */
export function bodyGradeHash9(): Grade9 | null {
  const m9 = typeof location !== "undefined" ? /(?:^|[#&,])bgrade=([0-9.~]+)/.exec(location.hash) : null;
  if (!m9) return null;
  const v9 = m9[1].split("~").map(Number);
  return v9.length === 5 && v9.every((x) => Number.isFinite(x)) ? (v9 as unknown as Grade9) : null;
}
/** 지형 — 타일셋마다(0 황무지 · 1 우주 판 · 2 설치 · 3 재 · 4 정글 · 5 사막 · 6 얼음 · 7 황혼). 무릎은 끈다(땅엔 과노출이 없다 · 눈이 잿빛이 된다).
 *  ① 우주 판 · 설치 — 원작은 무채 회색이라 채도를 **뺀다**(0.85 · 올리면 옅은 푸른 기가 남색으로 섰다) ② 정글 · 재 — 원래 어두워 밝기는 두고 채도만
 *  ③ 얼음 — 눈은 원작도 밝다(중앙값 0.62) · 얕게 ④ 사막 — 가운데 ⑤ 황무지 · 황혼 — 시안 B · C 가운데. */
export function terrGrade9(ts: number): Grade9 {
  if (GRADE_OFF9) return [0, 1, 1, 1, 0];
  switch (ts) {
    case 1: case 2: return [0.105, 1.24, 1, 1, 0.85];
    case 3: return [0.03, 1.06, 1, 1, 1.30];
    case 4: return [0, 1, 1, 1, 1.35];
    case 5: return [0.07, 1.14, 1, 1, 1.30];
    case 6: return [0.05, 1.08, 1, 1, 1.15];
    default: return [0.105, 1.24, 1, 1, 1.40];
  }
}
/** 색 하나(0~255)를 곡선에 태운다 — GLSL GRADE_FN9 와 같은 식. */
export function gradeRgb9(c: readonly number[], g: Grade9): [number, number, number] {
  if (!(g[4] > 0)) return [c[0], c[1], c[2]];
  const r = c[0] / 255; const gg = c[1] / 255; const b = c[2] / 255;
  const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  const f = (v: number): number => {
    let x = L + (v - L) * g[4];
    x = Math.min(1, Math.max(0, (x - g[0]) / (1 - g[0])));
    x = x ** g[1];
    if (x > g[2]) x = g[2] + (x - g[2]) * g[3];
    return Math.round(Math.min(1, Math.max(0, x)) * 255);
  };
  return [f(r), f(gg), f(b)];
}
/** 곡선 GLSL — g = (bp, γ, kn, ks) · s = 채도. ES 1.00 · 3.00 둘 다(몸 메시 FS 가 글자로 끼운다). */
export const GRADE_FN9 = "vec3 grade9(vec3 c, vec4 g, float s) { float L9 = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = vec3(L9) + (c - vec3(L9)) * s; c = clamp((c - vec3(g.x)) / (1.0 - g.x), 0.0, 1.0); c = pow(c, vec3(g.y)); return mix(c, vec3(g.z) + (c - vec3(g.z)) * g.w, step(vec3(g.z), c)); }\n";
