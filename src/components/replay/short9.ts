/* ══ 쇼츠(2026-11-19, 요청: "쇼츠 만들기 기능 — 특정 장면을 정해서 자막을 넣어서 공유가능하게 · 보다가 어느장면을 지정하면 그때의 장면과 내가 넣은 자막이 좀 멋지게 ·
   쇼츠만들기 아이콘(영화 컷 — 클래퍼)을 독 위에 두고 누르면 녹화(카메라 이동과 줌도 녹화 json) · 빨간 정지 누르면 끝 · 녹화 중 자막 버튼(초 지정 · 기본 5초) ·
   자막 추가 버튼으로 시간 안에서 여러 개 · 자막 저장 중엔 일시정지하고 저장 시 다시 재생 · 로딩이 오래 걸리면 안 돼서 그 장면에서 필요한 모델만") ═════════════════════
   토막 한 벌(ShortClip9)은 **재생기가 만들고 재생기가 푼다** — 앱(sg-web)과 서버(sg-api)는 통째로 나르기만 한다(장면 링크 SceneLink9 와 같은 규약).
     · 시계는 **토막의 실초 w**(녹화 단추를 누른 뒤 흐른 벽시계 · 자막 쓰는 동안은 안 센다)다. 자취 s 의 한 칸은 [w, 게임 시각 t, 배율 z, 화면 가운데 지도 분수 cx · cy].
       배속을 바꾸거나 멈춘 채 카메라만 옮긴 것까지 그대로 실린다(t 가 w 를 따라 얼마나 가는지가 곧 배속이다) · 탐색(뜀)은 같은 w 에 두 칸(앞 · 뒤)으로 적는다.
     · 자막 caps 는 [w 부터 d 초 동안 text] — w 도 d 도 토막의 실초다(배속과 무관하게 사람이 읽는 시간).
   재생(쇼츠 보기)은 RMP 의 `short` prop — 틱이 w 를 올리고 shortAt9 로 시각 · 카메라를 짚는다(RMP 쇼츠 재생 ★). */

/** 자막 한 줄 — 토막 실초 w 부터 d 초. */
export type ShortCap9 = { w: number; d: number; text: string };
/** 쇼츠 한 토막 — v 판 · 게임 시각 [t0, t1] · 실초 길이 dur · 녹화 시작 배속 sp · 자취 s · 자막 caps · 기울기 a(90 = 평면 · 없으면 평면). */
export type ShortClip9 = {
  v: 1;
  t0: number;
  t1: number;
  dur: number;
  sp: number;
  s: [number, number, number, number, number][];
  caps: ShortCap9[];
  a?: number;
};

/** 녹화 상한(실초) — 넘으면 저절로 멈춘다(서버 상한 90 · sg-api shorts.py). */
export const SHORT_REC_MAX9 = 60;
/** 자취를 적는 박자(실초) — 0.1초(60초면 600칸 · 15KB 남짓). */
export const SHORT_STEP9 = 0.1;
/** 자막 기본 길이 · 고를 수 있는 끝(초). */
export const SHORT_CAP_D9 = 5;
export const SHORT_CAP_DMAX9 = 15;
/** 자막 한 줄 상한(글자 · 서버와 같은 값). */
export const SHORT_CAP_LEN9 = 120;

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/** 자취 한 칸을 적는다 — 값의 자릿수는 이 한 곳에서 죈다(실초 · 시각 0.01 · 배율 0.01 · 분수 0.0001). */
export const shortSample9 = (w: number, t: number, z: number, cx: number, cy: number): [number, number, number, number, number] =>
  [r2(w), r2(t), r2(z), r4(cx), r4(cy)];

/** 실초 w 의 장면 — 앞뒤 두 칸을 곧게 잇는다(같은 w 의 두 칸 = 뜀 · 뒤 칸을 쓴다). 칸이 없으면 null. */
export const shortAt9 = (clip: ShortClip9, w: number): { t: number; z: number; cx: number; cy: number } | null => {
  const s = clip.s;
  if (!s.length) return null;
  if (w <= s[0][0]) return { t: s[0][1], z: s[0][2], cx: s[0][3], cy: s[0][4] };
  const last = s[s.length - 1];
  if (w >= last[0]) return { t: last[1], z: last[2], cx: last[3], cy: last[4] };
  /* 두 갈래 찾기 — 600칸이라 장마다 불려도 열 걸음 남짓. */
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid][0] <= w) lo = mid; else hi = mid;
  }
  /* 같은 w 가 여럿이면(뜀) 그 가운데 마지막 칸부터 잇는다. */
  while (lo + 1 < s.length && s[lo + 1][0] <= w) lo += 1;
  const a = s[lo];
  const b = s[Math.min(s.length - 1, lo + 1)];
  const span = b[0] - a[0];
  const k = span > 1e-6 ? (w - a[0]) / span : 1;
  const mix = (i: number): number => a[i] + (b[i] - a[i]) * k;
  return { t: mix(1), z: mix(2), cx: mix(3), cy: mix(4) };
};

/** 지금(실초 w) 떠 있는 자막 — 여럿이면 다 · 떠오름 · 스러짐 몫(0~1)과 함께. */
export const shortCapsAt9 = (caps: readonly ShortCap9[], w: number): { cap: ShortCap9; i: number; k: number }[] => {
  const out: { cap: ShortCap9; i: number; k: number }[] = [];
  caps.forEach((cap, i) => {
    if (w < cap.w || w > cap.w + cap.d) return;
    const fin = Math.min(1, (w - cap.w) / 0.35);
    const fout = Math.min(1, (cap.w + cap.d - w) / 0.35);
    out.push({ cap, i, k: Math.max(0, Math.min(fin, fout)) });
  });
  return out;
};

/** 표지 — 무대(stage)에 보이는 몫 가운데 **정사각**을 캔버스 층 차례대로 한 장에 겹쳐 찍고(지형 · 몸 · GL · 하늘 · 효과), 미니맵을 왼아래에 얹는다(요청: "게임장면 + 미니맵만").
 *  ⚠ GL 캔버스는 preserveDrawingBuffer 가 없어 **칠한 바로 그 작업 안**에서만 읽힌다 — 붓(UnitLayer paint)이 칠한 직후 불러야 한다(RMP SHORT_SHOT9 ★). 못 찍으면 null. */
export const shortCoverOf9 = (stage: HTMLElement, layers: readonly (HTMLCanvasElement | null)[], mini: HTMLCanvasElement | null, size = 540): string | null => {
  const sr = stage.getBoundingClientRect();
  if (sr.width < 8 || sr.height < 8) return null;
  const side = Math.min(sr.width, sr.height);
  const ox = sr.left + (sr.width - side) / 2;
  const oy = sr.top + (sr.height - side) / 2;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const g = out.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#05070b";
  g.fillRect(0, 0, size, size);
  const k = size / side;
  for (const cv of layers) {
    if (!cv || !cv.width || !cv.height) continue;
    const st = getComputedStyle(cv);
    if (st.display === "none" || st.visibility === "hidden") continue;
    const r = cv.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    try {
      g.drawImage(cv, (r.left - ox) * k, (r.top - oy) * k, r.width * k, r.height * k);
    } catch { /* 더럽혀진 캔버스(바깥 그림) — 그 층만 건너뛴다 */ }
  }
  if (mini && mini.width && mini.height) {
    const mw = Math.round(size * 0.3);
    const mh = Math.round(mw * (mini.height / mini.width));
    const mx = Math.round(size * 0.03);
    const my = size - mh - mx;
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    try { g.drawImage(mini, mx, my, mw, mh); } catch { /* 위와 같다 */ }
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1.5;
    g.strokeRect(mx - 3, my - 3, mw + 6, mh + 6);
  }
  try {
    const webp = out.toDataURL("image/webp", 0.82);
    if (webp.startsWith("data:image/webp")) return webp;
    return out.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
};
