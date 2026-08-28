import React, { useEffect, useRef } from "react";
import type { ReplayMapGrid } from "./mapGrid";
import { drawMapGrid } from "../../utils/mapTiles";
import { decodeMapTerrain, terrainFace } from "../../utils/mapTerrain";
import { pWrap } from "./perf9";

/* 전체화면 미니맵(요청: "pc에만 왼쪽사이드의 아래부분 빈공간에 미니맵을 넣음.
   스타 미니맵처럼 맵축소위에 활동상태가 색깔네모들로 찍히고 어디를 볼지 프레임을
   드래그나 터치로 선택 가능함") ────────────────────────────────────────────────
   원작 미니맵이 하는 일은 셋이다: ① 지도를 줄여 깔고 ② 그 위에 유닛·건물을 임자 색
   네모로 찍고 ③ 지금 보고 있는 자리를 흰 테두리로 알리며 그걸 끌어 시점을 옮긴다.

   ★ 왜 캔버스 하나로 그리나 — 유닛이 수백이라 DOM 조각으로 찍으면 프레임마다 그만큼
     노드를 만들었다 지운다. 캔버스는 한 장을 덧그리기만 하므로 재생 중에도 값이 없다.
   ★ 왜 ops를 ref로 받나 — 재생기가 매 프레임 만드는 배열이라, prop으로 넘기면 그때마다
     이 컴포넌트가 리렌더된다. ref로 붙들고 시각(t)이 바뀔 때만 다시 그린다.

   보이는 창(view)은 재생기가 셈해 넘긴다 — 지도 좌표계(0~1 분수)의 네모다. */

/** 미니맵에 찍는 한 점 — 재생기가 그리는 op에서 필요한 넷만 본다. `wFrac`이 있으면
 *  건물이라 한 단 크게 찍는다(원작 미니맵도 건물이 더 크다). */
export type MiniDot = { fx: number; fy: number; color: string; wFrac?: number };

/* 안개 값은 큰 지도의 안개 층(ReplayFogLayer)에서 그대로 가져온다 — 두 그림이 같은
   짙기·같은 색이라야 미니맵과 지도가 한 벌로 읽힌다. */
/** 밝혔지만 지금 안 보이는 칸의 덮개 짙기(0~1). */
const MINI_FOG_DIM = 0.6;
/** 안개 색 — 순검정이 아니라 푸른 밤(순검정은 지형색을 통째로 죽인다). */
const MINI_FOG_R = 5;
const MINI_FOG_G = 8;
const MINI_FOG_B = 14;

export default function ReplayFullscreenMinimap({
  image, grid, ratio, dotsRef, extraRef, tick, viewAt, zoom, pan, onSeek, onWheelZoom,
  unproject, fog, painter, live,
  warming,
}: {
  /** 장면이 아직 데워지는 중인가 — 참이면 **아무것도 안 보인다**(지적: "지도 초기 로딩
   *  시 초록색 맵 뜨는 거랑 안개 없이 지도 전체 뜨는 거 수정했는데 미니맵은 그대로야").
   *  큰 지도는 이 동안 제 층들을 통째로 감춘다(.scr-motion-map.is-warming) — 자취가
   *  손에 들어오기 전에는 안개가 없어 지도가 다 밝고, 지형 그림도 아직이라 밑칠(초록)이
   *  그대로 비친다. 미니맵만 그 손질을 안 받아 같은 그림을 계속 내고 있었다.
   *  같은 신호를 받아 같은 순간에 함께 나타난다 — 둘이 갈리면 한쪽만 먼저 뜬다. */
  warming?: boolean;
  /** 지도 그림(없으면 어두운 바탕만). */
  image?: string;
  /** 격자·지형(요청 뒤 지적: "프레임도 안맞게 표시됨") — **지형이 있는 맵은 그림이
   *  아예 없다**. 큰 지도가 벡터층(ReplayMapVector = drawMapGrid)으로 옮겨 가면서
   *  <img>를 안 쓰게 됐는데, 미니맵은 여전히 image만 보고 있어 그런 맵에서는 어두운
   *  네모 위에 점만 찍혔다 — 지형이 없으니 프레임이 어디를 가리키는지도 안 읽힌다.
   *  격자를 받으면 큰 지도와 **같은 한 곳**(drawMapGrid)으로 제 배경을 굽는다. */
  grid?: ReplayMapGrid;
  /** 지도 가로/세로 비 — 미니맵 상자의 비율이 된다. */
  ratio: number;
  /** 지금 프레임의 점들 — 재생기가 렌더마다 채운다(그리는 op 배열을 그대로 받는다). */
  dotsRef: { current: readonly MiniDot[] };
  /** 화면 밖이라 **그림은 안 그린 것들**의 점(재생기의 miniExtra) — 미니맵은 보는 창
   *  밖을 보여 주는 것이 일이라, 걷어낸 것도 여기서는 찍어야 한다. 없으면 확대할수록
   *  미니맵이 텅 빈다. */
  extraRef?: { current: readonly MiniDot[] };
  /** 다시 그릴 신호(재생 시각) — 이 값이 바뀔 때만 덧그린다. */
  tick: number;
  /** 그 배율·팬일 때 보이는 창 — 지도 분수 좌표 [중심x, 중심y, 폭, 높이].
   *  값이 아니라 **함수**로 받는다(요청: "맵 드래그나 줌시 미니맵의 프레임도 실시간으로
   *  변경") — 손짓이 도는 동안 zoom·pan 상태는 아직 안 굳으므로, 굳은 값으로 셈한
   *  네모 하나를 넘겨받으면 프레임이 손을 뗄 때까지 제자리에 얼어 있었다. 손끝 값을
   *  넣어 그때그때 셈할 수 있어야 한다. */
  viewAt: (z: number, p: { x: number; y: number }) => { cx: number; cy: number; w: number; h: number };
  /** 굳은 배율·팬 — 손짓이 안 도는 동안의 값이다. */
  zoom: number;
  pan: { x: number; y: number };
  /** 프레임을 끌었다 — 그 자리를 화면 한가운데로 (지도 분수 좌표). */
  onSeek: (fx: number, fy: number) => void;
  /** 미니맵 위에서 휠을 굴렸다 — **그 자리를 가운데 두고** 한 칸 확대·축소한다(지적:
   *  "미니맵 위에서 스크롤 시 현재 위치 중심에서 확대 축소하게. 지금은 좌하단 기준으로
   *  하는 듯"). 여태 미니맵에는 휠 손잡이가 없어 그 굴림이 지도 쪽 손잡이로 흘러갔는데,
   *  그쪽은 **지도 상자 안의 커서 자리**를 축으로 삼는다 — 커서는 지도 밖(미니맵 위)에
   *  있으므로 그 자리가 늘 상자의 한 구석으로 잡혔다. 미니맵의 좌표는 미니맵이 안다. */
  /** 휠로 확대·축소 — 넘기는 자리는 **상자 안 분수**(0~1)다(짚기 onSeek와 같은 자). */
  onWheelZoom?: (mx: number, my: number, up: boolean) => void;
  /** 그리는 자리(op의 fx·fy) → **평면 지도 분수**(지적: "3D모드에서 미니맵의 지도는
   *  그대론데 요소들이 3D각도로 누워서 안맞는 문제") ────────────────────────────
   *  재생기가 op에 싣는 fx·fy는 **큰 지도에 그릴 자리**라 입체 보기에서는 원근이
   *  이미 먹은 값이다(posFrac). 그런데 미니맵 배경은 늘 평면(drawMapGrid)이라, 그
   *  값을 그대로 찍으면 지도는 반듯한데 점만 사다리꼴로 누웠다.
   *  재생기가 제 역함수(tileOfFrac)를 여기로 넘겨 준다 — 평면 보기에서는 항등이라
   *  값이 한 톨도 안 움직인다. */
  unproject?: (fx: number, fy: number) => [number, number];
  /** 전장의 안개(요청: "시야안개를 미니맵에도 보여주고") — 큰 지도의 안개 층과 **같은
   *  근거**를 받아 칸 격자에 그대로 칠한다. 미니맵은 한 타일이 두어 픽셀이라 벡터
   *  등고선까지 갈 까닭이 없다: 칸 한 장을 굽고 늘려 깔면 가장자리는 저절로 부드럽다. */
  fog?: {
    /** 격자 크기(타일). */
    w: number; h: number;
    /** 칸마다 처음 본 초(안 본 칸은 65535). */
    explored: Uint16Array;
    /** 지금 덮임 0~255(큰 지도의 visNow 그대로 — 128이 곧 경계다). */
    vis: Uint8Array;
    /** 지금 재생 시각(초). */
    t: number;
  } | null;
  /** 붓 넘기는 자리 — 손짓(휠·핀치·드래그)이 도는 동안 재생기가 이 붓을 손끝 배율·팬으로
   *  직접 부른다. 안개 층·유닛 캔버스가 쓰는 것과 같은 수법이다(리액트를 안 거친다). */
  painter?: { current: ((z: number, p: { x: number; y: number }) => void) | null };
  /** 지금 손끝의 보기 — 손짓이 도는 동안만 값이 있다. 손짓 중에 재생 틱이 리렌더를 내면
   *  굳은 zoom·pan으로 한 장 그리게 되어 프레임만 한 박자 뒤로 튄다. */
  live?: { current: { z: number; p: { x: number; y: number } } | null };
}): React.ReactElement {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  /** 지형으로 구운 배경 한 장 — 맵이 바뀔 때만 굽는다(타일 하나 3px). */
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  /** 안개 한 장 — 칸이 곧 화소다(가로×세로 타일). 늘려 깔면 가장자리가 부드럽다. */
  const fogRef = useRef<HTMLCanvasElement | null>(null);
  /** 상자가 0일 때 다시 그리기를 예약해 둔 프레임 — 겹쳐 예약되지 않게 하나만 든다. */
  const retryRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(retryRef.current), []);
  const bumpRef = useRef(0);

  /* 지도 그림은 한 번만 읽어 붙들어 둔다 — 프레임마다 새로 만들면 그때마다 디코딩한다. */
  useEffect(() => {
    if (!image) { imgRef.current = null; return; }
    const im = new Image();
    im.src = image;
    im.onload = () => { imgRef.current = im; bumpRef.current += 1; };
  }, [image]);

  /* 지형 배경 굽기 — 큰 지도와 같은 그림(drawMapGrid)이라 미니맵과 지도가 안 갈린다.
     타일당 3px이면 128타일 맵이 384px으로, 어떤 미니맵 상자보다 크다. */
  useEffect(() => {
    if (!grid || !(grid.width > 0) || !(grid.height > 0)) { bgRef.current = null; return undefined; }
    const cv = document.createElement("canvas");
    const px = 3;
    cv.width = grid.width * px;
    cv.height = grid.height * px;
    const c9 = cv.getContext("2d");
    if (!c9) return undefined;
    // 지형은 비동기로 풀리므로 먼저 옛 길(그룹 램프)로 한 장 — 그 사이가 안 빈다.
    drawMapGrid(c9, grid, null, px);
    bgRef.current = cv;
    bumpRef.current += 1;
    let dead = false;
    void decodeMapTerrain(grid.terrain).then((mt) => {
      if (dead || !mt) return;
      drawMapGrid(c9, grid, terrainFace(mt), px);
      bumpRef.current += 1;
    });
    return () => { dead = true; };
  }, [grid]);

  useEffect(() => {
    /* 한 장 그리기를 함수로 뽑았다 — 상태(zoom·pan)로 한 번, 손짓 중에는 재생기가
       손끝 값으로 다시 부른다. 매개변수 이름이 props를 일부러 가린다. */
    const paint = (zoom: number, pan: { x: number; y: number }): void => {
    const cv = cvRef.current;
    const box = boxRef.current;
    if (!cv || !box) return;
    /* ★ 그리는 칸은 **정수로 재면 안 된다**(지적: "미니맵의 아랫줄이 완전히 가려져 —
       그리는 부분의 높이가 부족한 것 같아") ────────────────────────────────────────
       clientWidth·clientHeight는 **반올림한 정수**를 준다. 이 판은 폭이 clamp(76, 23vw,
       116)이라 소수로 떨어지는 것이 예사다: 폰 390px에서 판이 89.7 → 여백 8·테두리 2를
       빼면 칸이 **79.7**인데 client는 **80**이라 답한다.
       그 0.3px이 왜 눈에 보이는가 — 이 함수는 지도 전체를 w×h로 **늘려** 그린다. 칸을
       80이라 믿고 그리면 그림이 실제 칸(79.7)보다 0.3px 크고, 넘치는 몫은 overflow가
       잘라 낸다. 80px짜리 판에 128타일을 그리므로 0.3px은 곧 **타일 반 줄**이고, 그것이
       하필 지도의 맨 아랫줄이다(위·왼쪽은 원점이라 안 밀린다).
       상자를 소수로 재고 테두리를 손으로 뺀다 — 이러면 그린 것과 보이는 것이 정확히
       같아진다. 굽는 크기(cv.width)는 여전히 정수로 반올림하지만, 그것은 배킹의
       촘촘함일 뿐 그림의 자리는 안 건드린다. */
    const r9 = box.getBoundingClientRect();
    const cs9 = window.getComputedStyle(box);
    const w = Math.max(0, r9.width
      - (parseFloat(cs9.borderLeftWidth) || 0) - (parseFloat(cs9.borderRightWidth) || 0));
    const h = Math.max(0, r9.height
      - (parseFloat(cs9.borderTopWidth) || 0) - (parseFloat(cs9.borderBottomWidth) || 0));
    /* ★ 상자가 아직 0이면 **다음 프레임에 다시 그린다**(지적: "아예 안 그려졌었나 봐" ·
       "드래그해서 옮기면 정상적으로 보여") ───────────────────────────────────────────
       여기가 그 자리였다. 상자가 0인 순간(판이 막 붙었을 때·전체화면으로 자리를 옮기는
       중일 때) 이 함수는 **아무것도 안 그리고 물러났다**. 그리고 이 그림의 신호는
       '리렌더'뿐이라, 그 뒤로 리렌더가 안 오면(재생을 멈춰 두면 틱이 없다) 캔버스가
       영영 빈 채로 남는다 — 드래그하면 재생기가 붓을 직접 불러 그때 처음 그려진다.
       그것이 "토글하면 미니맵 프레임이 안 나온다"의 정체였고, 실은 프레임만이 아니라
       **지도째** 안 그려져 있었다.
       그래서 물러날 때 다음 프레임을 예약한다. 상자가 설 때까지 이어지고, 서는 순간
       제 그림이 그려진다. */
    if (w <= 0 || h <= 0) {
      cancelAnimationFrame(retryRef.current);
      retryRef.current = requestAnimationFrame(() => paint(zoom, pan));
      return;
    }
    const B = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * B) || cv.height !== Math.round(h * B)) {
      cv.width = Math.round(w * B);
      cv.height = Math.round(h * B);
    }
    /* 화면 크기도 **손으로 못 박는다** — CSS(absolute + inset 0)가 이미 상자에 맞추지만,
       그 규칙이 어떤 까닭으로든 안 걸리면 <canvas>는 속성 크기를 CSS 픽셀로 써서 배로
       커진다(웹킷에서 실제로 그랬다). 두 겹으로 막아 둔다 — 값은 지금 잰 그 값이다. */
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const c = cv.getContext("2d");
    if (!c) return;
    c.setTransform(B, 0, 0, B, 0, 0);
    c.clearRect(0, 0, w, h);
    // ① 지도 — 그림이 있으면 깔고, 없으면 어두운 바탕.
    c.fillStyle = "#12161c";
    c.fillRect(0, 0, w, h);
    /* 배경은 **지형 → 올린 그림 → 맨 바탕** 차례다 — 지형이 있으면 큰 지도와 같은
       그림이라 미니맵과 지도가 한 벌로 읽힌다. */
    const bg = bgRef.current;
    const im = imgRef.current;
    if (bg) {
      c.drawImage(bg, 0, 0, w, h);
    } else if (im) {
      c.globalAlpha = 0.85;
      c.drawImage(im, 0, 0, w, h);
      c.globalAlpha = 1;
    }
    /* ② 전장의 안개(요청) — 지형 **위**, 점 **아래**다. 원작 미니맵도 그 차례다:
       못 밝힌 땅은 새까맣고, 밝혔지만 지금 안 보이는 땅은 어둡게 깔리며, 그 위에
       내 유닛과 **기억 속 건물**은 밝게 찍힌다(안개 밑에 잠기지 않는다).
       칸 한 장(가로×세로 타일)을 굽고 상자 크기로 늘려 깐다 — 늘리기 보간이 곧
       가장자리를 부드럽게 하는 자라, 큰 지도처럼 등고선을 뽑을 까닭이 없다.
       ※ 점은 이미 재생기가 시점으로 걸러 넘긴다(안 보이는 적은 op에 아예 없다) —
         여기서 다시 지울 것이 없다. */
    if (fog && fog.w > 0 && fog.h > 0 && fog.explored.length === fog.w * fog.h) {
      let fc = fogRef.current;
      if (!fc || fc.width !== fog.w || fc.height !== fog.h) {
        fc = document.createElement("canvas");
        fc.width = fog.w;
        fc.height = fog.h;
        fogRef.current = fc;
      }
      const fx9 = fc.getContext("2d");
      if (fx9) {
        const img = fx9.createImageData(fog.w, fog.h);
        const px9 = img.data;
        const n9 = fog.w * fog.h;
        for (let i = 0; i < n9; i += 1) {
          /* 밝힌 땅은 DIM, 못 밝힌 땅은 통짜다. 거기에 **지금 덮임**을 빼면 눈이
             닿은 자리가 그만큼 걷힌다 — 0~255 덮임이 그대로 가장자리 기울기가 된다. */
          const base = fog.explored[i] <= fog.t ? MINI_FOG_DIM : 1;
          const a = base * (1 - (fog.vis[i] ?? 0) / 255);
          const o = i * 4;
          px9[o] = MINI_FOG_R;
          px9[o + 1] = MINI_FOG_G;
          px9[o + 2] = MINI_FOG_B;
          px9[o + 3] = Math.round(a * 255);
        }
        fx9.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = true;
        c.drawImage(fc, 0, 0, w, h);
      }
    }
    /* ③ 활동 네모 — 원작처럼 임자 색 점이다. 건물은 한 단 크게 찍어 무리와 갈린다.
       크기는 미니맵 폭에 비례해, 작은 미니맵에서도 뭉치지 않고 큰 데서도 안 성글다. */
    const uS = Math.max(1.5, w * 0.013);
    const bS = Math.max(2.5, w * 0.022);
    /* 두 벌을 잇는다 — 그린 것(dotsRef)과 화면 밖이라 안 그린 것(extraRef).
       합치지 않고 이어 도는 까닭은 프레임마다 배열을 새로 만들지 않으려는 것이다. */
    const dots9: readonly (readonly MiniDot[])[] = extraRef
      ? [dotsRef.current, extraRef.current] : [dotsRef.current];
    for (const grp9 of dots9) for (const d of grp9) {
      const s = d.wFrac !== undefined ? bS : uS;
      // 입체 보기의 원근을 벗겨 **평면 지도 분수**로 되돌린다(위 unproject 주석).
      const [mx, my] = unproject ? unproject(d.fx, d.fy) : [d.fx, d.fy];
      c.fillStyle = d.color;
      c.fillRect(mx * w - s / 2, my * h - s / 2, s, s);
    }
    /* ④ 보고 있는 자리 — 흰 테두리. 입체 보기에서는 **네모가 아니라 사다리꼴**이다
       (같은 지적) — 화면의 네모를 평면 지도로 되돌리면 먼 쪽(위)이 더 넓기 때문이다.
       네 모서리를 각각 되돌려 잇는 것이 곧 정답이다 — 평면에서는 다시 네모가 된다.
       지도 밖으로는 안 나간다 — 창이 지도보다 넓을 수 있다(한 축만 크롭되는 비율). */
    const view = viewAt(zoom, pan);
    /* 진단(#diag·계측 도구) — 미니맵이 실제로 셈한 '보는 창'이다. 흰 네모가 안 보일 때
       그 까닭이 창 값인지(전체가 됐거나 상자 밖) 그리기인지를 여기서 가린다. */
    (window as unknown as Record<string, unknown>).__miniView = {
      z: zoom, px: pan.x, py: pan.y,
      cx: +view.cx.toFixed(4), cy: +view.cy.toFixed(4),
      w: +view.w.toFixed(4), h: +view.h.toFixed(4),
    };
    const vx0 = view.cx - view.w / 2;
    const vy0 = view.cy - view.h / 2;
    const vx1 = view.cx + view.w / 2;
    const vy1 = view.cy + view.h / 2;
    const raw: [number, number][] = [[vx0, vy0], [vx1, vy0], [vx1, vy1], [vx0, vy1]];
    const cor = raw.map(([qx, qy]) => (unproject ? unproject(qx, qy) : [qx, qy]));
    /* 원근 역사상은 지평선 너머에서 발산한다 — 값이 성치 않으면 평면 네모로 물러난다. */
    const okQ = cor.every(([qx, qy]) => Number.isFinite(qx) && Number.isFinite(qy));
    /* ★ 모서리를 **상자 안으로 죄면 안 된다**(지적: "3D에서 미니맵 프레임 문제 있음
       1배에서 — 전체 다 보이고 있는데 일부처럼") ────────────────────────────────────
       입체에서 화면 네모를 땅으로 되돌리면 **먼 쪽이 넓고 가까운 쪽이 좁은** 사다리꼴이
       된다(가까운 것이 크게 그려지니 같은 화면 폭이 더 적은 타일을 덮는다). 1배에서는
       그 사다리꼴이 지도 밖까지 뻗는다 — 실측(48도·128타일): 위 두 모서리가 타일
       (−37, −57)·(165, −57), 아래가 (4.8, 152)·(123, 152)다.
       여태 그 넷을 각각 [0,1]로 죄어 그렸는데, 죄는 순간 **변의 기울기가 꺾인다**:
       왼 변이 (−37,−57)→(4.8,152)의 곧은 선이라 지도 아래 왼귀 (0,128)을 정확히
       지나는데, 위 모서리를 (0,0)으로 당기면 그 선이 안쪽으로 휘어 지도 한 귀퉁이를
       잘라 낸다 — 다 보이는데 일부만 든 것처럼 보이던 것이 이것이다.
       투영은 직선을 직선으로 보내므로 **자르지 말고 그대로 그리면** 된다. 상자 밖은
       캔버스가 알아서 잘라 준다. 발산을 막는 상한만 넉넉히 둔다(분수 ±8 — 실측 최댓값이
       2.3이라 어느 각도에서도 이 상한이 변을 안 건드린다). */
    const cap9 = (v9: number): number => Math.max(-8, Math.min(9, v9));
    const LW9 = 1.5;
    /* ★ 선을 **안쪽으로 물려** 그린다(지적: "전체화면 토글 시 미니맵 프레임이 처음에 안
       나오는 현상") ──────────────────────────────────────────────────────────────
       안 나온 것이 아니라 **경계에 걸려 반이 잘렸다.** 캔버스 획은 선을 경로 **가운데**에
       두므로, 경로가 상자 변에 딱 붙으면 굵기의 절반이 상자 밖이고 그 절반은 그려지지
       않는다. 그런 자리가 실제로 있다: 프레임 모드 1배에서는 보는 창이 지도 **전체**라
       네모가 상자와 정확히 같고(w=h=1), 전체화면을 껐다 켤 때마다 그 자리를 지난다.
       고치는 법은 **가운데를 기준으로 조금 줄이는 것**이다(굵기 절반만큼). 균일한 축소는
       직선을 직선으로 보내므로, 위에서 애써 지킨 사다리꼴의 기울기가 안 꺾인다 —
       모서리를 각각 죄면 꺾인다(그 주석). 줄어드는 몫은 한 픽셀 남짓이라 다른 자리에서는
       눈에 안 띈다. */
    const k9 = Math.max(0, 1 - LW9 / Math.max(1, Math.min(w, h)));
    const pts = (okQ ? cor : raw).map(([qx, qy]) => [
      w / 2 + (cap9(qx) * w - w / 2) * k9,
      h / 2 + (cap9(qy) * h - h / 2) * k9,
    ] as [number, number]);
    c.strokeStyle = "rgba(255,255,255,.92)";
    c.lineWidth = LW9;
    c.beginPath();
    pts.forEach(([qx, qy], i) => { if (i === 0) c.moveTo(qx, qy); else c.lineTo(qx, qy); });
    c.closePath();
    c.stroke();
    };
    if (painter) painter.current = paint;
    /* 상자 크기가 바뀌면 다시 그린다 — 판이 막 뜨거나(0 → 제 크기) 전체화면 전환으로
       비가 바뀌는 순간이 그것이다. 리렌더를 기다리지 않으므로 멈춰 둔 판에서도 제때
       그려진다(위 retryRef와 같은 뜻의 두 번째 그물이다). */
    const box0 = boxRef.current;
    let ro9: ResizeObserver | null = null;
    if (box0 && typeof ResizeObserver !== "undefined") {
      ro9 = new ResizeObserver(() => {
        const lv9 = live?.current;
        paint(lv9 ? lv9.z : zoom, lv9 ? lv9.p : pan);
      });
      ro9.observe(box0);
    }
    /* 다시 그릴 신호는 **리렌더 그 자체**다 — 이 이펙트는 의존 목록이 없다(재생 틱 t가
       tick으로 들어와 프레임마다 리렌더를 내므로 그것이 곧 신호다). 목록을 두면 손짓
       중에 바뀌는 값(손끝 배율·팬)이 거기 안 들어 있어 한 박자 늦는다. */
    void tick;
    const lv = live?.current;
    /* 이 층은 의존 목록이 없어 **매 프레임** 점 전부를 다시 찍는다 — 렌더 밖이라
       안 재면 그 삯이 통째로 '브라우저' 뺄셈에 숨는다(perf9 머리말). */
    pWrap("붓:미니맵", () => paint(lv ? lv.z : zoom, lv ? lv.p : pan));
    return () => { ro9?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  /* 끌어서 시점 옮기기 — 누른 자리가 곧 화면 한가운데다(원작과 같다). 포인터를
     잡아 두므로 미니맵 밖으로 손이 나가도 계속 따라온다. */
  const seekAt = (clientX: number, clientY: number): void => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    onSeek(
      Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))),
      Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height))),
    );
  };
  const dragRef = useRef(false);
  /* 휠은 **직접 건다**(리액트의 onWheel은 수동 리스너라 preventDefault가 안 먹는다) —
     막지 않으면 페이지가 함께 굴러 지도와 문서가 같이 움직인다. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !onWheelZoom) return undefined;
    const on = (e: WheelEvent): void => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      /* ★ **거품을 여기서 끊는다**(지적: "지금은 좌하단 기준 무조건") — 지도 쪽 휠
         손잡이는 지도 상자가 아니라 **판 뿌리**(.scr-fs-root)에 걸려 있다(그 자리 주석:
         로스터 판 위에서 굴린 휠도 받으려고 위로 올려 뒀다). 미니맵은 그 뿌리의 자손이라,
         여기서 처리해도 같은 굴림이 그대로 올라가 지도 손잡이가 한 번 더 돌았다 — 그쪽은
         커서를 지도 상자 안으로 죄므로 늘 한 구석(미니맵이 앉은 왼쪽 아래)이 축이 된다.
         끊으면 이 굴림의 임자는 미니맵 하나다. */
      e.stopPropagation();
      /* ★ 넘기는 것은 **분수**다(지적: "커서가 있는 곳으로 이동+줌해야 할 거 같아") —
         여기서 화면 좌표(clientX·clientY)를 그대로 넘기고 있었다. 받는 쪽(fsWheelZoom)은
         그 값을 0~1로 알고 `mx × 지도폭`을 셈하므로, 몇백 픽셀짜리 수가 들어가면 자리가
         지도 밖 저 멀리로 나가 한계에 눌린다 — 굴릴 때마다 늘 같은 구석으로 붙던 것이
         그것이다. 짚어서 옮기는 쪽(seekAt)은 처음부터 상자로 나눠 넘기고 있었으니,
         같은 자를 쓰게 맞춘다. */
      const r9 = el.getBoundingClientRect();
      onWheelZoom(
        Math.max(0, Math.min(1, (e.clientX - r9.left) / Math.max(1, r9.width))),
        Math.max(0, Math.min(1, (e.clientY - r9.top) / Math.max(1, r9.height))),
        e.deltaY < 0,
      );
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [onWheelZoom]);

  return (
    <div
      ref={boxRef}
      className="scr-fs-minimap"
      style={{ aspectRatio: `${ratio}` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        seekAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (dragRef.current) seekAt(e.clientX, e.clientY); }}
      onPointerUp={() => { dragRef.current = false; }}
      onPointerCancel={() => { dragRef.current = false; }}
      role="presentation"
    >
      <canvas ref={cvRef} aria-hidden style={warming ? { opacity: 0 } : undefined} />
    </div>
  );
}
