/* 자취 위의 한 점 — 재생 화면이 "그때 그 개체는 어디 있었나"를 묻는 유일한 창구다.
 *
 * 여기 있는 이유(과제 #61): 이 셈은 원래 15,000줄짜리 재생 컴포넌트 한가운데 박혀 있어
 * 따로 재 볼 수가 없었다. 코어(simCore)가 걸음의 진실이 되면서 이 함수의 몫은 "코어가
 * 낸 자취를 읽는 것" 하나로 좁아졌고 — 좁아진 만큼 밖으로 꺼내 자로 잴 수 있게 뒀다
 * (scripts/pos-check.mjs).
 *
 * ★ 정식 배포에서 옛 보정이 통째로 걷혔다 — 걸음 상한(maxSpeed·GLIDE/BRIDGE)·침묵 구간
 *   다리 놓기(LERP_MAX_GAP_SEC)·지면 굽힘(bendCenter)·침묵 판정(stale)은 전부 **명령
 *   좌표 사이를 렌더러가 어림하던 시절**의 장치다. 코어 자취는 이미 제 속도로 적분된
 *   값이라, 그 위에 보정을 얹으면 코어가 낸 값을 렌더러가 다시 주무르는 이중 모형이
 *   된다(같은 몸을 두 모형이 서로 밀었다). 지금은 토막 사이를 곧게 잇기만 한다.
 */

/** 자취 한 점 [초, x, y, 선택 묶음 번호?] — 넷째 값(g)은 같은 부대지정으로 내린 명령끼리
 *  같은 번호다. 코어 자취에는 안 실린다. */
export type TrackPt = [number, number, number, number?];

export interface TrackPos { x: number; y: number; moving: boolean; sinceLast: number }

/** 토막 커서 — 재생은 시간이 앞으로만 가므로, 지난 프레임에 고른 토막이 이번에도 거의
 *  그대로 맞는다(같거나 바로 다음). 부르는 쪽이 자취마다 하나씩 들고 오면 이분 탐색이
 *  사실상 O(1)이 된다. 어긋나면(탐색·시간 점프) 그냥 이분 탐색으로 돌아간다 —
 *  **결과는 커서가 있든 없든 한 토막도 안 다르다.** */
export type TrackCur = { i: number };

export function posAt(pts: TrackPt[], t: number, cur?: TrackCur): TrackPos | null {
  const n = pts.length;
  if (n === 0) return null;
  if (t <= pts[0][0]) {
    return { x: pts[0][1], y: pts[0][2], moving: false, sinceLast: Infinity };
  }
  const lastPt = pts[n - 1];
  if (t >= lastPt[0]) {
    return {
      x: lastPt[1], y: lastPt[2], moving: false, sinceLast: t - lastPt[0],
    };
  }
  /* 토막은 이분 탐색으로 찾는다 — 자취는 시간순이다. 코어 자취를 그대로 읽게 되면서
     개체 하나가 수천 점을 지니는 일이 생겼는데(실측: 게임 1의 최장 일꾼 8981점),
     앞에서부터 훑으면 그 하나가 프레임을 먹는다. 앞뒤로 같은 시각의 점이 겹쳐 있어도
     고르는 토막은 옛 훑기와 같다. */
  let lo = -1;
  /* 커서 맞춰 보기 — 지난 토막(h) 또는 그 다음(h+1)이 t를 담고 있으면 탐색을 건너뛴다.
     담는 조건이 '마지막으로 t를 안 넘는 키'와 같으므로(다음 점이 t를 넘는가) 이분
     탐색과 같은 답이다. 같은 시각이 겹친 점에서는 조건이 안 맞아 이분으로 떨어진다. */
  if (cur) {
    const h9 = cur.i;
    if (h9 >= 0 && h9 < n - 1 && pts[h9][0] <= t && pts[h9 + 1][0] > t) lo = h9;
    else if (h9 >= -1 && h9 + 2 < n && pts[h9 + 1][0] <= t && pts[h9 + 2][0] > t) lo = h9 + 1;
  }
  if (lo < 0) {
    lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid][0] <= t) lo = mid; else hi = mid - 1;
    }
  }
  if (cur) cur.i = lo;
  const [s0, x0, y0] = pts[lo];
  const [s1, x1, y1] = pts[lo + 1];
  const dt0 = Math.max(0.001, s1 - s0);
  const k = (t - s0) / dt0;
  /* 대기 구간 — 움직임이 아니다(도착해서 다음 명령을 기다리는 중).
     ★ '두 점이 정확히 같은가'가 아니라 **얼마나 빠른가**로 본다(지적: "이미 공격중으로
       넘어갔는데도 이동중으로 뜨고 아주 느리게 이동 … 일꾼도 그렇고"). 원작의 유닛은
       붙어 서서 싸울 때도 밭 앞에 줄 설 때도 서로 밀고 밀리며 좌표가 끊임없이 미세하게
       흔들린다 — 좌표 일치로 보면 그 떨림이 전부 '걷는 중'이 되어, 서 있는 유닛이
       평생 걷기 애니메이션을 돌린다.
       문턱은 초당 0.4타일 — 원작에서 가장 느린 유닛(오버로드 0.83)의 절반이라 진짜
       걸음은 하나도 안 걸리고, 밀림 떨림(대개 초당 0.05타일 안팎)만 걸러진다. */
  const still = Math.hypot(x1 - x0, y1 - y0) / dt0 < 0.4;
  return {
    x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k,
    moving: !still, sinceLast: still ? t - s0 : 0,
  };
}

/* ★ 걷기 **창**(요청: 메모리 — 워커 파생 자료 182MB의 90%가 걷기였다) ─────────────────────────────────
 *  참값 트랙의 키(Float32Array, 한 키 = [초, x, y, …] 다섯 칸)를 생애 구간만 **가리킨다**. 복사가 없다 —
 *  옛 `[초, x, y][]`는 키마다 배열 객체 하나(60~80B)라 참값(20B)의 서너 배였다. */
export type WalkView = { ks: Float32Array; i0: number; n: number };
export const EMPTY_WALK: WalkView = { ks: new Float32Array(0), i0: 0, n: 0 };
export const wT = (w: WalkView, i: number): number => w.ks[(w.i0 + i) * 5];
export const wX = (w: WalkView, i: number): number => w.ks[(w.i0 + i) * 5 + 1];
export const wY = (w: WalkView, i: number): number => w.ks[(w.i0 + i) * 5 + 2];
/** posAt과 같은 셈을 창 위에서 한다(같은 커서 규칙). */
export function posAtW(w: WalkView, t: number, cur?: TrackCur): TrackPos | null {
  const n = w.n;
  if (n === 0) return null;
  const ks = w.ks;
  const b = w.i0 * 5;
  const T = (i: number): number => ks[b + i * 5];
  const X = (i: number): number => ks[b + i * 5 + 1];
  const Y = (i: number): number => ks[b + i * 5 + 2];
  if (t <= T(0)) return { x: X(0), y: Y(0), moving: false, sinceLast: Infinity };
  if (t >= T(n - 1)) return { x: X(n - 1), y: Y(n - 1), moving: false, sinceLast: t - T(n - 1) };
  let lo = -1;
  if (cur) {
    const h9 = cur.i;
    if (h9 >= 0 && h9 < n - 1 && T(h9) <= t && T(h9 + 1) > t) lo = h9;
    else if (h9 >= -1 && h9 + 2 < n && T(h9 + 1) <= t && T(h9 + 2) > t) lo = h9 + 1;
  }
  if (lo < 0) {
    lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (T(mid) <= t) lo = mid; else hi = mid - 1;
    }
  }
  if (cur) cur.i = lo;
  const s0 = T(lo); const x0 = X(lo); const y0 = Y(lo);
  const s1 = T(lo + 1); const x1 = X(lo + 1); const y1 = Y(lo + 1);
  const dt0 = Math.max(0.001, s1 - s0);
  const k = (t - s0) / dt0;
  const still = Math.hypot(x1 - x0, y1 - y0) / dt0 < 0.4;
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, moving: !still, sinceLast: still ? t - s0 : 0 };
}
