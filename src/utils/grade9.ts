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
    case 1: case 2: return [0.105, 1.24, 1, 1, 0.85];   // 우주 판(1)은 아래 밝기 표(TERR_TONE9)가 먼저다 — 이 값은 표를 걷으면 돌아가는 옛 곡선(2026-11-13) · 설치(2)는 이 값 그대로
    case 3: return [0.03, 1.06, 1, 1, 1.30];
    case 4: return [0, 1, 1, 1, 1.35];
    case 5: return [0.07, 1.14, 1, 1, 1.30];
    case 6: return [0.05, 1.08, 1, 1, 1.15];
    default: return [0.105, 1.24, 1, 1, 1.40];
  }
}
/** ★ **우주 판 밝기 표**(2026-11-14, 요청: "지형 — 색상, 대비, 질감 등 차이 대조 필요" → 원작(SC:R) 스샷 3쌍 · 같은 자리 실측 → "(같이 올리자)") —
 *  같은 자리 여섯 군데가 다 같았다: 우리(곡선 [0.105, 1.24, –, –, 0.85] 뒤) 어두운 판 #1d222c · 밝은 판 #272c36 · 벽 #16181b /
 *  원작 어두운 판 #24262b · 밝은 판 #34363b · 벽 평균 #1f1d1c — 원작이 **더 밝고(중앙값 0.145 → 0.175) · 훨씬 무채(채도 0.31 → 0.15) · 판끼리 대비가 크다**(밝은 ÷ 어두운 1.28 → 1.42).
 *  판 대비만 키우는 곡선은 다섯 수(검은점 · 감마 · 무릎)로는 안 나온다: 검은점을 올려 맞추면(bp 0.21 · γ 0.80 — 판 색 오차 0.9/255) 벽이 검게 뭉개지고(0.09 → 0.05 · 원작 0.10),
 *  무릎을 기울기 1.4 로 세우면 밝은 타일이 3할 더 밝아진다. 그래서 **잰 자리를 그대로 잇는 꺾은선**(곡선 앞 휘도 → 뒤 휘도)을 둔다:
 *    0.105 → 0(옛 검은점) · 0.229(벽) → 0.105 · 0.281(어두운 판) → 0.149 · 0.320(밝은 판) → 0.212 · 그 위는 옛 곡선의 값(0.52 → 0.386 · 0.75 → 0.666 · 1 → 1).
 *  색은 휘도 비로 통째 늘리고(색상 · 채도가 안 흔들린다 — 검은점을 빼는 옛 식은 어두울수록 채도가 올랐다) 그 뒤 채도 s 0.62(판 색 오차 0.3/255).
 *  지형은 지도를 열 때 JS 로 한 번 굽는 색이라(위 ★ 굽는다) 셰이더 식(GRADE_FN9)에 안 묶인다. 설치(2)는 재지 않아 그대로. `#grade=0` 이면 끔. */
export interface Tone9 { readonly pts: readonly (readonly [number, number])[]; readonly s: number }
const TERR_TONE9: Readonly<Record<number, Tone9>> = {
  1: { pts: [[0, 0], [0.105, 0], [0.229, 0.105], [0.281, 0.149], [0.32, 0.212], [0.52, 0.386], [0.75, 0.666], [1, 1]], s: 0.62 },
};
/** 색 하나(0~255)를 밝기 표에 태운다 — 휘도를 꺾은선으로 옮기고(색은 그 비로) 채도를 s 배. */
export function toneRgb9(c: readonly number[], t: Tone9): [number, number, number] {
  const r = c[0] / 255; const g = c[1] / 255; const b = c[2] / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const p = t.pts;
  let L2 = p[p.length - 1][1];
  for (let i = 1; i < p.length; i += 1) {
    if (L <= p[i][0]) { const w = p[i][0] - p[i - 1][0]; L2 = p[i - 1][1] + (w > 0 ? (L - p[i - 1][0]) / w : 0) * (p[i][1] - p[i - 1][1]); break; }
  }
  const k = L > 1e-4 ? L2 / L : 0;
  const f = (v: number): number => Math.round(Math.min(1, Math.max(0, L2 + (v * k - L2) * t.s)) * 255);
  return [f(r), f(g), f(b)];
}
/** 지형 색을 굽는 함수(terrainGeom 이 지도를 열 때 쓴다) — 밝기 표가 있는 타일셋은 표로, 아니면 다섯 수 곡선으로. 꺼졌으면 null. */
export function terrGradeOf9(ts: number): ((c: readonly number[]) => [number, number, number]) | null {
  if (GRADE_OFF9) return null;
  const t9 = TERR_TONE9[ts];
  if (t9) return (c) => toneRgb9(c, t9);
  const g9 = terrGrade9(ts);
  return g9[4] > 0 ? (c) => gradeRgb9(c, g9) : null;
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
