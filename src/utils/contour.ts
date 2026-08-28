/* ── 격자 밭 → **곡선 등고선** ────────────────────────────────────────────────
 *
 * 칸 격자에 칠한 그림은 확대하면 반드시 계단이 된다 — 눈금이 아무리 작아도 그 눈금이
 * 그대로 커지기 때문이다. 계단을 감추려 보간을 켜면 이번엔 흐려진다. 확대에 안 지려면
 * **해상도가 없는 것**, 곧 도형으로 그려야 한다.
 *
 * 이 파일이 그 다리다: 0/1 밭을 받아 등고선을 뽑고(마칭 스퀘어), 모서리를 깎아
 * (Chaikin) 곡선 폴리곤으로 낸다. 안개(ReplayFogLayer)와 지형(mapTiles)이 함께 쓴다.
 *
 * ★ 좌표 규약 — 밭은 **타일 중심**에서 잰 값이고, 나오는 점은 '정수가 타일 경계'인
 *   타일 단위다. 곧 점 p는 픽셀 p × 타일픽셀에 그대로 앉는다.
 */

/** 등고선 한 줄 — 점 목록(x,y 이음). 닫힌 고리다. */
export type Loop = number[];

/** 등고선 점 열쇠의 눈금(1/Q 타일) — 두 조각이 같은 자리에서 만나면 같은 열쇠여야 한다. */
const Q = 256;

/** 마칭 스퀘어 — 칸 격자에서 값 0.5의 등고선을 뽑아 **닫힌 고리들**로 잇는다.
 *
 *  ★ 두 가지를 못박아 둔다:
 *    ① **테두리를 0으로 두른다** — 칸을 −1부터 훑어 격자 밖을 '바깥'으로 본다. 그러면
 *       가장자리에 닿은 자리도 고리가 밖에서 닫힌다. 안 그러면 등고선이 뚝 끊겨,
 *       채울 때 두 끝이 **직선으로** 이어진다.
 *    ② **잇기가 결정적이다** — 조각을 배열에 순서대로 담고 '아직 안 쓴 것 중 첫 번째'
 *       를 따라간다. Map을 돌며 그 Map을 고치면 프레임마다 고리 가름이 달라져 그림이
 *       흔들린다. */
export function contoursOf(f: Float32Array, w: number, h: number): Loop[] {
  const F = (x: number, y: number): number =>
    (x < 0 || y < 0 || x >= w || y >= h ? 0 : f[y * w + x]);
  /** 두 점 사이에서 0.5가 되는 자리(선형 보간) — 등고선을 칸보다 잘게 만든다. */
  const cut = (a: number, b: number): number => {
    const d = b - a;
    return Math.abs(d) < 1e-6 ? 0.5 : Math.max(0, Math.min(1, (0.5 - a) / d));
  };
  const key = (x: number, y: number): string =>
    `${Math.round(x * Q)},${Math.round(y * Q)}`;
  const ax: number[] = [];
  const ay: number[] = [];
  const bx: number[] = [];
  const by: number[] = [];
  const startAt = new Map<string, number[]>();
  const seg = (p: [number, number], q: [number, number]): void => {
    const i = ax.length;
    ax.push(p[0]); ay.push(p[1]); bx.push(q[0]); by.push(q[1]);
    const k = key(p[0], p[1]);
    const arr = startAt.get(k);
    if (arr) arr.push(i); else startAt.set(k, [i]);
  };
  for (let cy = -1; cy < h; cy += 1) {
    for (let cx = -1; cx < w; cx += 1) {
      const a = F(cx, cy);           // 왼위
      const b = F(cx + 1, cy);       // 오른위
      const c = F(cx + 1, cy + 1);   // 오른아래
      const d = F(cx, cy + 1);       // 왼아래
      const m = (a >= 0.5 ? 8 : 0) | (b >= 0.5 ? 4 : 0)
        | (c >= 0.5 ? 2 : 0) | (d >= 0.5 ? 1 : 0);
      if (m === 0 || m === 15) continue;
      const tx = cx + 0.5;
      const ty = cy + 0.5;
      const pT: [number, number] = [tx + cut(a, b), ty];
      const pR: [number, number] = [tx + 1, ty + cut(b, c)];
      const pB: [number, number] = [tx + cut(d, c), ty + 1];
      const pL: [number, number] = [tx, ty + cut(a, d)];
      // 안쪽(값 ≥ 0.5)을 왼쪽에 두고 도는 방향 — 잇기와 짝수-홀수 채우기가 함께 맞는다.
      switch (m) {
        case 1: seg(pL, pB); break;
        case 2: seg(pB, pR); break;
        case 3: seg(pL, pR); break;
        case 4: seg(pR, pT); break;
        case 5: seg(pL, pT); seg(pR, pB); break;
        case 6: seg(pB, pT); break;
        case 7: seg(pL, pT); break;
        case 8: seg(pT, pL); break;
        case 9: seg(pT, pB); break;
        case 10: seg(pT, pR); seg(pB, pL); break;
        case 11: seg(pT, pR); break;
        case 12: seg(pR, pL); break;
        case 13: seg(pR, pB); break;
        case 14: seg(pB, pL); break;
        default: break;
      }
    }
  }
  const used = new Uint8Array(ax.length);
  const loops: Loop[] = [];
  for (let i0 = 0; i0 < ax.length; i0 += 1) {
    if (used[i0]) continue;
    const loop: Loop = [ax[i0], ay[i0]];
    let i = i0;
    for (let guard = 0; guard <= ax.length; guard += 1) {
      used[i] = 1;
      loop.push(bx[i], by[i]);
      const cand = startAt.get(key(bx[i], by[i]));
      let nxt = -1;
      if (cand) {
        for (const j of cand) if (!used[j]) { nxt = j; break; }
      }
      if (nxt < 0) break;
      i = nxt;
    }
    const n9 = loop.length;
    if (n9 >= 8) {
      // 닫힌 고리면 끝점이 시작점과 같다 — Chaikin이 닫힌 것으로 다루므로 중복을 걷는다.
      if (Math.abs(loop[n9 - 2] - loop[0]) < 1e-6 && Math.abs(loop[n9 - 1] - loop[1]) < 1e-6) {
        loop.length = n9 - 2;
      }
      loops.push(loop);
    }
  }
  return loops;
}

/** Chaikin 깎기 — 한 번 돌 때마다 모서리가 둥글려진다. 닫힌 고리로 다룬다. */
export function chaikin(loop: Loop): Loop {
  const n = loop.length / 2;
  if (n < 4) return loop;
  const out: Loop = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const x0 = loop[i * 2];
    const y0 = loop[i * 2 + 1];
    const x1 = loop[j * 2];
    const y1 = loop[j * 2 + 1];
    out.push(x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25);
    out.push(x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75);
  }
  return out;
}

/** 0/1 판정 → 곡선 길(Path2D). 좌표는 타일 단위이므로 `scale`로 픽셀에 맞춘다.
 *
 *  ★ 밭을 **흐리지 않는다** — 흐리면 한 칸 폭의 가는 절벽선이 문턱을 못 넘고 통째로
 *    사라진다(3×3 텐트 한 번이면 외딴 칸의 값이 0.25까지 떨어진다). 마칭 스퀘어가
 *    내는 45도 계단은 Chaikin 세 번이면 충분히 둥글고, 있던 것이 없어지지도 않는다. */
export function maskPath(
  test: (i: number) => boolean, w: number, h: number, scale: number, smooth = 3,
): Path2D {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i += 1) f[i] = test(i) ? 1 : 0;
  let loops = contoursOf(f, w, h);
  for (let q = 0; q < smooth; q += 1) loops = loops.map(chaikin);
  const p = new Path2D();
  for (const lp of loops) {
    const m = lp.length / 2;
    if (m < 3) continue;
    p.moveTo(lp[0] * scale, lp[1] * scale);
    for (let i = 1; i < m; i += 1) p.lineTo(lp[i * 2] * scale, lp[i * 2 + 1] * scale);
    p.closePath();
  }
  return p;
}
