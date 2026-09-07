import React, { useEffect, useRef } from "react";

/* ── 전장의 안개(요청: 플레이어 시점 보기 — 시야 3단 + 밝힘 이력) ─────────────────
 *
 * 세 단이다(되물어 확정):
 *   0 안 밝힘 — 한 번도 못 본 칸. 새까맣다.
 *   1 밝혔으나 지금은 안 보임 — 지형은 어둡게 남고, 그 사이 본 건물만 잔상으로 남는다.
 *   2 지금 보임 — 아무것도 안 덮는다.
 *
 * ── 왜 **벡터**인가(지적 넷을 거쳐 온 자리) ──────────────────────────────────────
 *   ① "블록으로 돼있어서 보기 안좋으니 부드러운 곡선으로 연결"
 *   ② "흐림효과가 눈아파.. 그냥 깔끔하게 따줘"
 *   ③ "아직 시야 곡선이 아닌 계단식임"
 *   ④ "안개 경계가 흐리고 아직도 계단식임"
 *   앞의 세 판은 전부 **격자에 칠한 래스터**였다 — 타일을 잘게 나누고(1/4 → 1/6),
 *   밭을 흐려 등고선을 둥글리고, 보간을 껐다 켰다 했다. 그 길로는 못 이긴다:
 *   눈금이 아무리 작아도 지도를 16배로 확대하면 그 눈금이 그대로 계단으로 커지고,
 *   계단을 감추려 보간을 켜면 이번엔 흐려진다. 확대에 안 지려면 **해상도가 없는 것**
 *   으로 그려야 한다.
 *   그래서 이 판은 안개를 **화면 좌표의 도형**으로 그린다:
 *     · 지금 보이는 곳 — 시야는 본디 **원들의 합집합**이다. 원 그대로 판다(ellipse).
 *       어느 배율에서도 진짜 원이라 계단도 흐림도 없다.
 *     · 밝힌 곳 — 칸 격자에서 **등고선을 뽑아**(마칭 스퀘어) 폴리라인으로 잇고,
 *       Chaikin으로 두 번 깎아 곡선으로 만든 뒤 그 길을 채운다. 등고선은 밝힌
 *       칸 수가 바뀔 때만 다시 뽑으므로(대개 초당 두어 번) 프레임 삯이 거의 없다.
 *   캔버스는 렌즈 **밖**에 서서 화면 픽셀 그대로 그린다 — CSS로 늘어나지 않으니
 *   확대해도 선이 두꺼워지거나 뭉개지지 않는다. 입체 보기는 등고선 점을 지도와 같은
 *   투영(proj)에 태워 지형과 같은 평면에 눕힌다. */

import { contoursOf, chaikin, type Loop } from "../../utils/contour";
/** 작은 기기인가 — ReplayMotionPlayer의 그 판별과 같은 자다(위 B의 주석). */
const smallDev9 = typeof window !== "undefined"
  && !!window.matchMedia?.("(pointer: coarse)").matches
  && Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0) <= 1180;

/** 밝혔지만 안 보이는 칸의 덮개 짙기(0~1). */
const DIM = 0.6;
/** 안개 색 — 순검정이 아니라 푸른 밤. 순검정은 지형색을 통째로 죽인다. */
const FOG_RGB = "5, 8, 14";
/** 붓이 넘기는 최신 안개 한 벌 — 눈 목록(vis)·밝힌 시각 판(exploredAt)·그 시각(t). */
export type FogOverride = { vis: Float32Array; exploredAt: Uint16Array; t: number };

export default function ReplayFogLayer({
  w, h, exploredAt, t, vis, proj, zoom, pan, tilePx, flatK, className, painter, onNeedPaint,
}: {
  /** 지도 격자 크기(타일). */
  w: number;
  h: number;
  /** 칸마다 '그 팀이 처음 본 초' — 안 본 칸은 65535. */
  exploredAt: Uint16Array;
  /** 지금 재생 시각(초) — 밝힘 이력을 이 시각으로 자른다. */
  t: number;
  /** 지금 보는 눈들 — [타일x, 타일y, 시야반지름(타일)] 세 쌍의 이음. */
  vis: Float32Array;
  /** 타일 좌표 → 지도 분수(입체 원근을 먹인 값). 재생기의 posFrac 그대로다. */
  proj: (x: number, y: number) => [number, number];
  zoom: number;
  pan: { x: number; y: number };
  /** 타일 하나의 화면 폭(CSS px, 배율 전) — 시야 원의 반지름 자다. */
  tilePx: number;
  /** 입체 보기의 바닥 눌림 — 시야 원의 세로 반지름에 곱한다(평면이면 1). */
  flatK: number;
  className?: string;
  /** 붓 넘기는 자리(지적: "줌시 맵은 변하는데 시야안개는 안변해서 이상함 바로 같이
   *  변하게 벡터니까 가능할듯") — 맞다, 벡터라 다시 그리는 삯이 거의 없다. 손짓
   *  (휠·핀치·드래그)이 도는 동안 부모가 이 붓을 그대로 쥐고 **손끝 배율·팬**으로
   *  다시 그린다. 유닛 캔버스·지도 벡터층이 쓰는 것과 같은 수법이다. */
  painter?: { current: ((z: number, p: { x: number; y: number }, ov?: FogOverride) => void) | null };
  /** 안개가 바뀌었다(props·크기)고 부모에게 알린다 — 부모의 붓 하나(paintFnRef9)가 다음 rAF에 칠한다(재설계: 그리는 붓 하나). */
  onNeedPaint?: () => void;
}): React.ReactElement {
  const cvRef = useRef<HTMLCanvasElement>(null);
  /** 밝힘 등고선 갈무리 — 밝힌 칸 수가 바뀔 때만 다시 뽑는다. */
  const ctRef = useRef<{ count: number; loops: Loop[] } | null>(null);
  const fldRef = useRef<{ n: number; f: Float32Array; tmp: Float32Array } | null>(null);
  /* ★ 붓이 React 밖에서 넘기는 최신 안개(지적: "유닛은 부드러운데 안개는 뚝뚝") — React 상태 t는 100ms 박자라
     props의 vis/exploredAt만 쓰면 안개가 초당 열 번만 바뀐다. 붓 틱이 고른 장의 안개를 painter의 셋째 인자로
     넘기면 여기에 담아 두고, 그 뒤의 팬·확대 다시 칠하기도 이 값을 쓴다. props가 이보다 **뒤진** 시각이면
     (렌더가 붓보다 늦다) props로 되돌리지 않는다 — 되돌리면 시야가 한 걸음 물러섰다 나온다. 탐색처럼 시각이
     크게 갈리면 props를 따른다. */
  const latestRef = useRef<FogOverride>({ vis, exploredAt, t });
  /** 밝힌 판의 합(칸마다 가장 이른 밝힘 시각) — 위 paint의 ★ 주석. src는 마지막으로 합친 원본(같은 판이면 건너뛴다). */
  const mergedRef = useRef<{ src: Uint16Array | null; out: Uint16Array | null }>({ src: null, out: null });
  {
    const lt = latestRef.current;
    if (t >= lt.t - 1e-6 || Math.abs(t - lt.t) > 0.5 || lt.exploredAt.length !== exploredAt.length) {
      latestRef.current = { vis, exploredAt, t };
    }
  }

  useEffect(() => {
    /* 한 장 그리기를 함수로 뽑았다 — 상태(zoom·pan)로 한 번, 손짓 중에는 부모가
       손끝 값으로 다시 부른다. 매개변수 이름이 props를 일부러 가린다. */
    const paint = (zoom: number, pan: { x: number; y: number }, ov?: FogOverride): void => {
    if (ov && ov.exploredAt.length === w * h) latestRef.current = ov;
    const { vis, t } = latestRef.current;
    /* ★ 밝힌 판은 **잊지 않는다**(지적: "안개 떨림 여전해" — 증거 사진: 몇 초 사이 밝힌 땅의 경계가 띠 하나만큼
       물러섰다 돌아왔다) ─────────────────────────────────────────────────────────────
       워커의 밝힌 판(exploredAt)은 장마다 오는 것이 아니라 안개를 다시 쌓은 장에만 실리고, 나머지 장은 '그 시각 이하
       가장 늦은 판'을 빌려 든다. 빌린 판은 제 시각까지의 밝힘만 알므로, 뒤 시각에서 그 판을 그리면 그 사이에 밝힌
       칸이 통째로 빠져 경계가 물러선다 — 그 다음 장이 새 판을 들면 도로 나온다. 어느 판을 드느냐는 장의 도착 순서에
       매이므로 앞뒤로 튄다.
       판은 '언제 처음 밝혔나'의 시각표라 **작은 쪽이 늘 옳다**: 새 판이 올 때마다 칸마다 min으로 합쳐 두면, 어느
       장이 어느 판을 들든 그리는 것은 지금까지 안 모든 밝힘이다. 그리기는 여전히 `밝힌 시각 ≤ t`로 거르므로 되감아도
       뒤에 밝힌 칸이 새어 나오지 않는다 — 시각표 합치기는 되감기에도 안전하다. 지도가 바뀌면(길이 다름) 새로 시작. */
    const exploredAt = ((): Uint16Array => {
      const src9 = latestRef.current.exploredAt;
      const mg9 = mergedRef.current;
      if (mg9.src === src9 && mg9.out) return mg9.out;
      if (!mg9.out || mg9.out.length !== src9.length) {
        mg9.out = src9.slice();
      } else {
        const o9 = mg9.out;
        for (let i = 0; i < src9.length; i += 1) if (src9[i] < o9[i]) o9[i] = src9[i];
      }
      mg9.src = src9;
      return mg9.out;
    })();
    const cv = cvRef.current;
    if (!cv || w <= 0 || h <= 0) return;
    const box = cv.parentElement;
    if (!box) return;
    const cw = box.clientWidth;
    const ch = box.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    /* 작은 기기는 1.5배로(실기: 전체화면에서 이 층 하나가 1390² = 7.4MB) — 안개는
       등고선을 Chaikin으로 깎아 그리는 **부드러운 막**이라, 1.5배를 화면 배율로 늘려도
       테가 계단으로 읽히지 않는다. 그림자 판을 낮춰 구운 것과 같은 결이다. */
    const B = Math.min(smallDev9 ? 1.5 : 2,
      typeof window === "undefined" ? 1 : (window.devicePixelRatio || 1));
    if (cv.width !== Math.round(cw * B) || cv.height !== Math.round(ch * B)) {
      cv.width = Math.round(cw * B);
      cv.height = Math.round(ch * B);
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(B, 0, 0, B, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // ── ① 밝힘 등고선 — 밝힌 칸 수가 바뀌었을 때만 다시 뽑는다 ────────────────
    const n = w * h;
    let fb = fldRef.current;
    if (!fb || fb.n !== n) {
      fb = { n, f: new Float32Array(n), tmp: new Float32Array(n) };
      fldRef.current = fb;
    }
    let count = 0;
    for (let i = 0; i < n; i += 1) if (exploredAt[i] <= t) count += 1;
    if (!ctRef.current || ctRef.current.count !== count) {
      const { f, tmp } = fb;
      for (let i = 0; i < n; i += 1) f[i] = exploredAt[i] <= t ? 1 : 0;
      /* 한 겹만 흐린다 — 등고선은 아래 Chaikin이 다시 깎으므로 여기서 많이 흐리면
         밝힌 자리가 실제보다 줄어든다. 이건 타일 모서리를 죽이는 몫이다. */
      for (let y = 0; y < h; y += 1) {
        const r = y * w;
        for (let x = 0; x < w; x += 1) {
          const l = f[r + (x > 0 ? x - 1 : 0)];
          const c = f[r + x];
          const g = f[r + (x < w - 1 ? x + 1 : w - 1)];
          tmp[r + x] = (l + 2 * c + g) * 0.25;
        }
      }
      for (let x = 0; x < w; x += 1) {
        for (let y = 0; y < h; y += 1) {
          const u = tmp[(y > 0 ? y - 1 : 0) * w + x];
          const c = tmp[y * w + x];
          const dn = tmp[(y < h - 1 ? y + 1 : h - 1) * w + x];
          f[y * w + x] = (u + 2 * c + dn) * 0.25;
        }
      }
      const loops = contoursOf(f, w, h).map((lp) => chaikin(chaikin(lp)));
      ctRef.current = { count, loops };
    }

    // ── ② 화면 사상 — 유닛 캔버스(UnitLayer)와 **같은 식**이라야 층이 안 어긋난다.
    const zx = (fx: number): number => (fx - 0.5) * cw * zoom + cw / 2 + pan.x;
    const zy = (fy: number): number => (fy - 0.5) * ch * zoom + ch / 2 + pan.y;

    // ── ③ 안개를 통째로 깔고, 밝힌 곳과 보이는 곳을 판다 ──────────────────────
    /* ★ 안개는 **지도 위에만** 깔린다(지적: 3D에서 하늘 아래가 까맣다) ─────────────────
       여기서 판을 통째로 칠하고 있었다. 평면에서는 판이 곧 지도라 탈이 없었는데, 눕히면
       지도가 사다리꼴로 줄어 판 안에 **지도가 아닌 자리**가 생긴다 — 그 자리까지 안개로
       칠하니 무대 바닥(밤하늘)이 통째로 가려졌다. 위쪽 그림 여유 띠 바로 아래가 까맣던
       것이 그것이다.
       지도의 네 귀퉁이를 같은 사상(proj)으로 옮겨 그 안만 칠한다 — 원근 사영은 직선을
       직선으로 보내므로 네 점이면 사다리꼴이 정확히 난다(평면에서는 판과 똑같은 네모다). */
    ctx.fillStyle = `rgba(${FOG_RGB}, 1)`;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const [cxg, cyg] = [[0, 0], [w, 0], [w, h], [0, h]][i];
      const [fx, fy] = proj(cxg, cyg);
      const px = zx(fx);
      const py = zy(fy);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    // 밝힌 곳 — 등고선 길을 채워 그만큼 알파를 덜어낸다(1 → DIM).
    ctx.globalAlpha = 1 - DIM;
    ctx.beginPath();
    for (const lp of ctRef.current.loops) {
      const m = lp.length / 2;
      for (let i = 0; i < m; i += 1) {
        const [fx, fy] = proj(lp[i * 2], lp[i * 2 + 1]);
        const px = zx(fx);
        const py = zy(fy);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill("evenodd");
    /* 지금 보이는 곳 — **진짜 원**을 판다. 시야는 본디 원들의 합집합이라, 격자를
       거치지 않고 그대로 그리면 어느 배율에서도 계단이 없다. */
    ctx.globalAlpha = 1;
    ctx.beginPath();
    const r0 = tilePx * zoom;
    for (let i = 0; i + 2 < vis.length; i += 3) {
      const [fx, fy] = proj(vis[i], vis[i + 1]);
      const rr = vis[i + 2] * r0;
      if (rr <= 0.5) continue;
      ctx.moveTo(zx(fx) + rr, zy(fy));
      ctx.ellipse(zx(fx), zy(fy), rr, rr * flatK, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    };
    if (painter) painter.current = paint;
    /* ★ 여기서는 안 칠한다(재설계: 그리는 붓 하나) — 안개를 칠하는 것은 부모의 paintFnRef9뿐이다. 이 층은 붓 클로저를 내주고
       "안개가 바뀌었다"(props·크기)고만 알린다. 부모는 다음 rAF에 유닛과 같은 보기·같은 장으로 한 장 칠한다. */
    onNeedPaint?.();
  });

  return <canvas ref={cvRef} className={className} aria-hidden />;
}
