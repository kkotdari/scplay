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
/** 사진 한 장(2026-11-19, 요청: "자막처럼 사진 첨부도 가능하게 · 저화질 · 몇초뜰지와 크기위치 지정") — 토막 실초 w 부터 d 초 · 자리 x · y = **쇼츠 정사각 틀 안** 가운데(0~1) ·
 *  크기 s = 틀 한 변 몫(폭) · ar = 세로/가로 · src = 올릴 땐 data URL(긴 변 SHORT_IMG_SIDE9 · webp) → 서버가 파일로 두고 주소로 바꾼다(p = 저장소 열쇠 · 지울 때). */
export type ShortImg9 = { w: number; d: number; x: number; y: number; s: number; ar?: number; src: string; p?: string };
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
  /** 녹화한 무대의 세로/가로(2026-11-19) — 재생 판이 이보다 세로로 길면 그 비만큼 당겨 녹화한 화면의 **세로 범위**를 채운다(좌우를 자른다 · RMP shortCamRef9 ★). 없으면(옛 토막) 0.75. */
  hw?: number;
  /** 시야 주인(2026-11-19 · 개인 화면에서 녹화하면 그 사람 게임 아이디) — 쇼츠 재생도 그 사람 안개로 연다(카메라는 자취 그대로). 없으면 전체 시야. */
  vw?: string;
  /** 사진(위 ShortImg9). */
  imgs?: ShortImg9[];
  /** 배속 자취(2026-11-20, 요청: "쇼츠 녹화 시 재생속도도 기록돼야 함") — [실초 w, 배속] · 첫 칸은 w 0(녹화 시작 배속) · 바뀐 칸만. 게임 시각은 자취 s 가 쥐고(배속은 이미 그 기울기에
   *  든다) 이 값은 재생기의 배속 상태(효과 · 걸음 결 · 다이얼 표시)를 그 자리 그대로 맞춘다. 없으면(옛 토막) sp 하나. */
  spd?: [number, number][];
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
/** 사진 장 수 상한 · 긴 변(px) · 화질(서버 상한 8장 · 400KB). */
export const SHORT_IMGS_MAX9 = 8;
export const SHORT_IMG_SIDE9 = 480;

/** 실초 w 의 배속(위 spd) — 그 앞 마지막 칸 · 없으면 녹화 시작 배속 sp. */
export const shortSpdAt9 = (clip: ShortClip9, w: number): number => {
  let sp = clip.sp || 1;
  for (const [w0, v] of clip.spd ?? []) { if (w0 > w + 1e-6) break; sp = v; }
  return sp;
};

/** 고른 사진을 저화질로 — 긴 변 SHORT_IMG_SIDE9 로 줄여 webp 0.7(안 되면 jpeg 0.72) data URL · 세로/가로 비. 못 읽으면 null. */
export const shortImgShrink9 = async (file: File): Promise<{ src: string; ar: number } | null> => {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("img")); im.src = url; });
    URL.revokeObjectURL(url);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!(w0 > 0 && h0 > 0)) return null;
    const k = Math.min(1, SHORT_IMG_SIDE9 / Math.max(w0, h0));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w0 * k));
    cv.height = Math.max(1, Math.round(h0 * k));
    const g = cv.getContext("2d");
    if (!g) return null;
    g.drawImage(img, 0, 0, cv.width, cv.height);
    let src = cv.toDataURL("image/webp", 0.7);
    if (!src.startsWith("data:image/webp")) src = cv.toDataURL("image/jpeg", 0.72);
    return { src, ar: cv.height / cv.width };
  } catch {
    return null;
  }
};

/** 지금(실초 w) 떠 있는 사진 — 들고 나는 몫(0~1)과 함께(자막과 같은 0.35초). */
export const shortImgsAt9 = (imgs: readonly ShortImg9[], w: number): { img: ShortImg9; i: number; out: boolean }[] => {
  const res: { img: ShortImg9; i: number; out: boolean }[] = [];
  imgs.forEach((img, i) => { if (w >= img.w && w <= img.w + img.d) res.push({ img, i, out: w > img.w + img.d - 0.4 }); });
  return res;
};

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/** 자취 한 칸을 적는다 — 값의 자릿수는 이 한 곳에서 죈다(실초 · 시각 0.01 · 배율 0.01 · 분수 0.0001). */
export const shortSample9 = (w: number, t: number, z: number, cx: number, cy: number): [number, number, number, number, number] =>
  [r2(w), r2(t), r2(z), r4(cx), r4(cy)];

/** 실초 w 의 장면 — 앞뒤 두 칸을 곧게 잇는다(같은 w 의 두 칸 = 뜀 · 뒤 칸을 쓴다). 칸이 없으면 null.
 *  ★ **화면 밖으로 옮긴 카메라는 잇지 않고 뛴다**(2026-11-19, 요청: "위치 이동시 화면 내에 없으면 재생기처럼 바로 점프") — 재생기는 창 하나 넘게 가야 하면 곧장 선다(RMP far9 ·
 *  미니맵 누름 · 중계 컷). 자취는 0.1초 칸이라 그런 뜀이 한 칸 사이에 담기는데, 곧게 이으면 0.1초 동안 지도를 가로질러 쓸려 보였다. 한 칸 사이 가운데 이동이 녹화 창 하나
 *  (가로 1/z · 세로 hw/(ar·z) — 1배 = 무대 폭 · ar = 지도 세로/가로)를 넘으면 그 칸 가운데서 뒤 칸으로 바로 바꾼다(시각 t 는 그대로 잇는다). 창 안의 미끄러짐 · 행군 끌림은 그대로 잇는다. */
export const shortAt9 = (clip: ShortClip9, w: number, ar = 1): { t: number; z: number; cx: number; cy: number } | null => {
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
  if (shortCut9(clip, a, b, ar)) {
    const c = k < 0.5 ? a : b;
    return { t: mix(1), z: c[2], cx: c[3], cy: c[4] };
  }
  return { t: mix(1), z: mix(2), cx: mix(3), cy: mix(4) };
};

/** ★ 가위(2026-11-20, 요청: "가위질 기능도 필요 · 타임라인에서 게임 부분을 잘라내기") — 토막에서 실초 [a, b) 를 들어낸다.
 *  · 자취: a 앞 칸은 그대로 + a 의 앞 끝 한 칸 · 뒤 시작 한 칸(같은 w = 뜀 — shortAt9 ★) + b 뒤 칸은 (b − a) 당긴다. 앞이 0 이면 앞 끝 칸이 없고, 뒤가 끝이면 뒤 칸이 없다.
 *  · 배속: a 앞 칸 + a 에 b 의 배속 + b 뒤 칸 당김(같은 값이 잇따르면 하나로).
 *  · 자막 · 사진: b 뒤에 서면 당기고 · 잘린 몫만큼 줄이고(자른 자리에서 이어 선다) · 0.3초 못 남으면 뺀다.
 *  · 길이 dur 은 (b − a) 줄고 t0 · t1 은 남은 칸으로 다시 잰다. 자른 몫이 0.01초 이하면 그대로. */
export const shortSnip9 = (clip: ShortClip9, a0: number, b0: number, ar = 1): ShortClip9 => {
  const a = Math.max(0, Math.min(a0, b0));
  const b = Math.min(clip.dur, Math.max(a0, b0));
  const cut = b - a;
  if (cut <= 0.01) return clip;
  const dur = r2(clip.dur - cut);
  const s: ShortClip9["s"] = clip.s.filter((x) => x[0] < a - 1e-6);
  if (a > 1e-6) {
    const p = shortAt9(clip, Math.max(0, a - 1e-3), ar);
    if (p) s.push(shortSample9(a, p.t, p.z, p.cx, p.cy));
  }
  if (b < clip.dur - 1e-6) {
    const q = shortAt9(clip, b, ar);
    if (q) s.push(shortSample9(a, q.t, q.z, q.cx, q.cy));
    for (const x of clip.s) if (x[0] > b + 1e-6) s.push([r2(x[0] - cut), x[1], x[2], x[3], x[4]]);
  }
  const sp0: [number, number][] = clip.spd && clip.spd.length ? clip.spd : [[0, clip.sp || 1]];
  const spd: [number, number][] = sp0.filter(([w]) => w < a - 1e-6).map(([w, v]) => [w, v]);
  if (b < clip.dur - 1e-6) {
    spd.push([r2(a), shortSpdAt9(clip, b)]);
    for (const [w, v] of sp0) if (w > b + 1e-6) spd.push([r2(w - cut), v]);
  }
  const spd1 = spd.filter((x, i) => i === 0 || Math.abs(x[1] - spd[i - 1][1]) > 1e-6);
  const trim = <T extends { w: number; d: number }>(xs: readonly T[]): T[] => xs.flatMap((x): T[] => {
    const e = x.w + x.d;
    let w = x.w;
    let d = x.d;
    if (x.w >= b) w = x.w - cut;
    else if (e <= a) { /* 앞 — 그대로 */ }
    else if (x.w >= a) { w = a; d = e - cut - a; }   // 잘린 몫 안에서 섰다 — 자른 자리에서 남은 만큼
    else d = e <= b ? a - x.w : x.d - cut;   // 앞에서 서서 자른 자리를 넘는다 — 잘린 몫만큼 줄인다
    if (d < 0.3 || w >= dur - 0.05) return [];
    return [{ ...x, w: r2(w), d: r2(Math.min(d, dur - w)) }];
  });
  const ts = s.map((x) => x[1]);
  return {
    ...clip,
    dur,
    t0: ts.length ? Math.min(...ts) : clip.t0,
    t1: ts.length ? Math.max(...ts) : clip.t1,
    s,
    sp: spd1.length ? spd1[0][1] : clip.sp,
    ...(spd1.length > 1 ? { spd: spd1 } : { spd: undefined }),
    caps: trim(clip.caps),
    ...(clip.imgs ? { imgs: trim(clip.imgs) } : {}),
  };
};

/** 실초 w 에서 게임 시각이 멈춰 있나(녹화 중 재생을 멈춘 몫 — 카메라만 움직인다) — w 와 w + 0.3 의 시각이 같으면 멈춤. RMP 가 워커에 '멈춤'으로 알린다(RMP shortStill9 ★). */
export const shortStillAt9 = (clip: ShortClip9, w: number, ar = 1): boolean => {
  if (w >= clip.dur - 0.05) return false;
  const a = shortAt9(clip, w, ar);
  const b = shortAt9(clip, Math.min(clip.dur, w + 0.3), ar);
  return !!a && !!b && Math.abs(b.t - a.t) < 0.01;
};

/** 두 칸 사이가 화면 밖 뜀인가(위 shortAt9 ★) — 앞 칸 배율의 녹화 창 하나를 넘게 옮겼나. */
const shortCut9 = (clip: ShortClip9, a: readonly number[], b: readonly number[], ar: number): boolean => {
  const z = Math.max(0.05, a[2]);
  const hw = clip.hw && clip.hw > 0 ? clip.hw : 0.75;
  return Math.abs(b[3] - a[3]) > 1 / z || Math.abs(b[4] - a[4]) > hw / (Math.max(0.05, ar) * z);
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
