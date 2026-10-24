import { kX, kY, keyJump, EMPTY_TRACK } from "./openbwTracks";
export function posAt(pts, t, cur) {
    const n = pts.length;
    if (n === 0)
        return null;
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
        if (h9 >= 0 && h9 < n - 1 && pts[h9][0] <= t && pts[h9 + 1][0] > t)
            lo = h9;
        else if (h9 >= -1 && h9 + 2 < n && pts[h9 + 1][0] <= t && pts[h9 + 2][0] > t)
            lo = h9 + 1;
    }
    if (lo < 0) {
        lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (pts[mid][0] <= t)
                lo = mid;
            else
                hi = mid - 1;
        }
    }
    if (cur)
        cur.i = lo;
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
export const EMPTY_WALK = { tr: EMPTY_TRACK, i0: 0, n: 0 };
export const wT = (w, i) => w.tr.kt[w.i0 + i];
export const wX = (w, i) => kX(w.tr, w.i0 + i);
export const wY = (w, i) => kY(w.tr, w.i0 + i);
/** posAt과 같은 셈을 창 위에서 한다(같은 커서 규칙). */
export function posAtW(w, t, cur) {
    const n = w.n;
    if (n === 0)
        return null;
    const tr = w.tr;
    const b = w.i0;
    const kt = tr.kt;
    if (t <= kt[b])
        return { x: kX(tr, b), y: kY(tr, b), moving: false, sinceLast: Infinity };
    if (t >= kt[b + n - 1])
        return { x: kX(tr, b + n - 1), y: kY(tr, b + n - 1), moving: false, sinceLast: t - kt[b + n - 1] };
    let lo = -1;
    if (cur) {
        const h9 = cur.i;
        if (h9 >= 0 && h9 < n - 1 && kt[b + h9] <= t && kt[b + h9 + 1] > t)
            lo = h9;
        else if (h9 >= -1 && h9 + 2 < n && kt[b + h9 + 1] <= t && kt[b + h9 + 2] > t)
            lo = h9 + 1;
    }
    if (lo < 0) {
        lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (kt[b + mid] <= t)
                lo = mid;
            else
                hi = mid - 1;
        }
    }
    if (cur)
        cur.i = lo;
    const s0 = kt[b + lo];
    const x0 = kX(tr, b + lo);
    const y0 = kY(tr, b + lo);
    /* 순간이동(리콜 · openbwTracks keyJump ★)은 메우지 않는다 — 뒤 키 때까지 옛 자리에 선다. */
    if (keyJump(tr, b + lo, b + lo + 1))
        return { x: x0, y: y0, moving: false, sinceLast: t - s0 };
    const s1 = kt[b + lo + 1];
    const x1 = kX(tr, b + lo + 1);
    const y1 = kY(tr, b + lo + 1);
    const dt0 = Math.max(0.001, s1 - s0);
    const k = (t - s0) / dt0;
    const still = Math.hypot(x1 - x0, y1 - y0) / dt0 < 0.4;
    return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, moving: !still, sinceLast: still ? t - s0 : 0 };
}
