import { useEffect, useRef, useState } from "react";
import type { ReplayMapGrid } from "./mapGrid";
import { drawMapGrid, type MapTerrainLike } from "../../utils/mapTiles";
import { decodeMapTerrain, terrainFace } from "../../utils/mapTerrain";
import { SCR_DIAG, scrDiagOn } from "./ReplayMotionPlayer";
import { pWrap, pCount, PERF9, DPRCAP9 } from "./perf9";

/* ── 지도 벡터층(요청: "지도 이미지는 벡터화해서 확대해도 선명하게") ────────────────
 *
 * 여태 재생기의 지도 배경은 <img> 래스터였다 — 그런데 그 그림의 **원천이 이미 우리
 * 벡터다**: 운영자가 사이트의 renderMinimapCanvas(= mapTiles.drawMapGrid)가 그린 PNG를
 * 내려받아 도로 올린 것이라, 2048px에서 굳은 스냅샷일 뿐이다. 확대하면 당연히 흐렸다.
 *
 * 그래서 굳히지 않고 **볼 때마다 그 배율로 다시 그린다**: 참값 지형(grid.terrain)이
 * 있는 맵은 이 층이 <img>를 대신한다. 그림은 같은 한 곳(drawMapGrid)이 그리므로
 * 내려받는 PNG·썸네일과 픽셀 규칙이 같고, 배율만 화면을 따라간다.
 *
 * 어떻게 어느 배율에서도 선명한가 — 배킹을 통째로 키우면 캔버스 한계(4096px)에 막힌다
 * (유닛 캔버스가 렌즈 밖으로 나간 것과 같은 사정). 이 층은 렌즈 **안**에 남되,
 * 평면(90도)에서는 **보이는 타일 창만** 그 배율로 굽고 캔버스를 그 창 자리(% 좌표)에
 * 앉힌다 — 창 크기 × 배율 ≈ 화면 픽셀이라 배킹이 절대 한계를 안 넘는다. 입체(각도)
 * 보기는 원근이 창 밖을 드러내므로 전체 맵을 상한(4096) 안에서 최대 배율로 굽는다.
 *
 * 손짓(드래그·핀치) 동안은 렌즈의 CSS 변환이 이 캔버스를 같이 움직인다.
 * ★ 굽는 창은 '보이는 만큼'이 아니라 **캔버스 예산(4096)이 허락하는 최대**다(지적:
 *   "확대시 맵을 드래그로 이동하면 맵배경이 그부분 그때 그려지면서 깜빡임 발생 —
 *   확대축소시 한번에 그려놔야할듯"). 예전엔 pan이 굳을 때마다 '보이는 창 + 40%'를
 *   다시 구웠고, 그 40%를 벗어나는 순간 새 자리가 그제서야 칠해져 번쩍였다. 이제
 *   구워 둔 창 안에 머무는 동안은 effect가 곧장 빠져나가므로, 드래그 중에는 한 번도
 *   다시 안 굽는다 — 다시 굽는 때는 배율·상자·보기가 바뀔 때뿐이다. */
export default function ReplayMapVector({
  grid, zoom, pan, pitched, style, painter, tileFrac, pitchSig, pitchXf,
}: {
  grid: ReplayMapGrid;
  zoom: number;
  /** 입체(각도)일 때 **이 상자에 걸 변환**을 배율·팬에서 내는 함수(재지적: "3D 드래그는
   *  개선이 안 됐어, 여전히 지도는 가만히 있고 마우스를 떼면 그때야 지도가 움직여")
   *  ────────────────────────────────────────────────────────────────────────────
   *  진범이 여기였다. 여태 부르는 쪽이 그 변환을 **문자열로 만들어 style에 박아** 넘겼고,
   *  그 문자열은 커밋된 pan·zoom(리액트 상태)으로 지어졌다. 손짓 중에는 그 상태가 안
   *  바뀌므로 입체에서는 지도가 통째로 멈춰 있고 손을 떼는 순간 튀었다. 평면에는 이
   *  변환이 없어(캔버스가 제 자리를 픽셀로 직접 셈한다) 손끝을 잘 따라왔다 — 두 보기가
   *  갈렸던 이유가 이 한 줄이다.
   *  이제 **함수**로 받는다: 그리는 자리(paint)가 그때의 배율·팬으로 불러 상자에 직접
   *  건다. 커밋 렌더에서도, 손짓 프레임에서도 같은 함수가 같은 자를 쓴다. */
  pitchXf?: (z: number, p: { x: number; y: number }) => string;
  pan: { x: number; y: number };
  pitched: boolean;
  /** 입체 보기의 기울임 변환 — 부모(재생기)가 pitchGeom으로 만든 것을 그대로 받는다. */
  style?: React.CSSProperties;
  /** 붓 넘기는 자리(요청: "확대 축소시 모델은 그렇다쳐도 맵을 실시간으로 그리기") —
   *  손짓(휠·핀치) 동안 부모가 이 붓을 그대로 쥐고 **손끝 배율**로 다시 굽는다.
   *  유닛 캔버스가 쓰는 것과 같은 수법이다(UnitLayer.painter). */
  painter?: { current: ((z: number, p: { x: number; y: number }) => void) | null };
  /** 타일 → 렌즈 분수 사상(부모의 posFrac) — **입체 보기의 창 굽기**에 쓴다(지적:
   *  "확대하면 흐릿하네" — 입체는 전체 맵 통째 굽기라 타일당 32px 상한에 걸려 줌
   *  3.5부터 흐렸다). 렌더마다 새 클로저라 ref로 받아 deps를 안 태운다. */
  tileFrac?: { current: ((x: number, y: number) => [number, number]) | null };
  /** 입체 기울임의 서명(각도 등) — 바뀌면 창을 다시 잡아야 한다. */
  pitchSig?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  /** ★ **밑판**(요청: "맵을 새로 구울 때 무조건 판 전체를 구워서 드래그 시 로딩되는 일
   *  없게") ────────────────────────────────────────────────────────────────────────
   *  '판 전체를 제 화질로'는 높은 배율에서 물리적으로 안 된다: 타일당 픽셀이 배율을
   *  따라가므로 128타일 맵을 8배로 통째로 구우면 한 변 16384px(2.7억 px · 1GB)이고,
   *  브라우저의 캔버스 한 장 한계는 면적으로 4096×4096이다. 그래서 위 창(cvRef)은
   *  '예산이 허락하는 최대'만 굽고, 그 창을 벗어나면 다시 구워야 한다 — 그 한 박자가
   *  곧 끌 때의 빈 자리다.
   *  밑판은 그 빈 자리를 없앤다: **맵 전체를 한 번만** 낮은 해상도로 구워 바닥에 깔아
   *  두고, 배율·팬이 바뀌어도 **절대 다시 굽지 않는다**(자리만 옮긴다). 위 창을 벗어나도
   *  검은 자리가 아니라 한 겹 흐린 지도가 있고, 손을 떼면 그 위로 또렷한 창이 덮인다.
   *  값은 캔버스 한 장(2048² ≈ 16MB)이고, 다시 굽는 때는 맵·상자·보기가 바뀔 때뿐이다. */
  const baseRef = useRef<HTMLCanvasElement>(null);
  const baseBakedRef = useRef<{ key: string; cv: HTMLCanvasElement } | null>(null);
  const [mt, setMt] = useState<MapTerrainLike | null>(null);
  const [box, setBox] = useState<[number, number]>([0, 0]);
  /** 지난 판의 의존성 — 무엇이 갈렸는지 세려고 든다(계측 켤 때만 쓴다). */
  const depPrevRef = useRef<Record<string, unknown> | null>(null);
  /** 지형을 이만큼 기다렸는데도 안 왔나 — 참이면 어림 그림으로라도 깐다(아래 주석). */
  const [mtLate, setMtLate] = useState(false);
  useEffect(() => {
    if (!grid.terrain || mt) { setMtLate(false); return undefined; }
    // 900ms — 사람이 '비었다'고 느끼기 시작하는 자리다. 그 안에 오면 아무 일도 없다.
    const id9 = window.setTimeout(() => setMtLate(true), 900);
    return () => window.clearTimeout(id9);
  }, [grid.terrain, mt]);
  useEffect(() => {
    let dead = false;
    void decodeMapTerrain(grid.terrain).then((m) => {
      if (!dead) setMt(m ? terrainFace(m) : null);
    });
    return () => { dead = true; };
  }, [grid.terrain]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    /* ★ 상자는 clientWidth로 잰다(지적: "벡터인데 왜 확대하면 흐려져") —
       getBoundingClientRect는 **렌즈의 scale(zoom)이 곱해진** 크기를 준다. 마운트
       때(줌 1)는 맞지만, 확대한 채로 레이아웃이 흔들리면(아이폰 사파리의 주소창
       접힘·펼침, 전체화면 전환) ResizeObserver가 다시 발화해 zoom배로 부풀린 상자가
       들어왔고, 그 값으로 배율(ppt)·보이는 창을 셈해 배킹·자리가 통째로 어긋나며
       흐려졌다. clientWidth는 변환이 안 실린 레이아웃 값이다. */
    /* ★ **값이 같으면 같은 배열을 돌려준다**(계측이 짚어 준 자리) ────────────────
       진단이 말했다: 이 붓의 의존성 가운데 갈리는 것은 `box` **하나뿐**이고(나머지는
       전부 ×0.0) 열 렌더에 한 번씩(×0.1) 갈린다. 그때마다 이 층이 통째로 다시 구워진다
       — 한 번에 약 55ms다.
       까닭은 값이 아니라 **정체성**이었다. 여기서 늘 새 배열 `[w, h]`를 만들어 넣었으므로,
       크기가 한 톨도 안 바뀌어도 리액트에는 '새 값'이다. 아이폰 사파리는 주소창이
       접혔다 펴지고 화면이 조금씩 흔들릴 때마다 ResizeObserver를 부르는데, 그때 크기가
       같아도 이 층은 매번 다시 구웠다.
       같으면 **지난 배열 그대로** 돌려준다 — 리렌더도, 재굽기도 일어나지 않는다.
       크기가 진짜로 바뀔 때만 새 배열이 나가므로 하는 일은 한 톨도 안 준다. */
    /* ★ **한두 픽셀 흔들림은 무시한다**(계측: 값이 같을 때를 막았는데도 여전히 ×0.1로
       갈린다 — 곧 크기가 **진짜로** 바뀌고 있다) ────────────────────────────────────
       아이폰 사파리는 재생 중에도 상자를 조금씩 흔든다(주소창·툴바가 스르륵 접히고
       펴진다). clientWidth는 정수라 그 사이 393↔394처럼 한 칸씩 튄다.
       그런데 이 층은 크기가 갈리면 **통째로 다시 굽는다 — 한 번에 90ms가 넘는다.**
       1픽셀을 위해 90ms를 내는 거래는 어떤 경우에도 손해다: 그 1픽셀은 눈에 안 보이고,
       90ms는 화면이 눈에 띄게 멎는 시간이다.
       그래서 **2픽셀 미만은 안 바뀐 것으로 친다.** 진짜 전환(전체화면·회전)은 수십·수백
       픽셀이라 그대로 걸린다. 굽는 크기가 최대 1픽셀 뒤처질 뿐이고, 그건 늘려 깔 때
       0.3%도 안 되는 차라 또렷함에 손해가 없다. */
    /* 문턱은 **크기에 비례해서** 잡는다(2px 고정은 너무 빡빡했다 — 계측이
       `434x434→436x436`을 그대로 통과시켰다: 딱 2px이라 '미만'에 안 걸렸다).
       2%면 434에서 8.7px이다. 진짜 전환(전체화면·회전)은 수십·수백 px이라 그대로
       걸리고, 굽는 크기가 최대 2% 뒤처지는 것은 늘려 깔 때 눈에 안 든다. */
    const jitter9 = (v9: number): number => Math.max(4, v9 * 0.02);
    const read = (): void => setBox((p9) => {
      const w9 = el.clientWidth;
      const h9 = el.clientHeight;
      if (Math.abs(p9[0] - w9) < jitter9(w9) && Math.abs(p9[1] - h9) < jitter9(h9)) return p9;
      // 어떤 크기들 사이를 오가는지 계측판에 남긴다 — 흔들림인지 진짜 전환인지 가른다.
      if (PERF9) pCount(`벡터box:${p9[0]}x${p9[1]}→${w9}x${h9}`, 1);
      return [w9, h9];
    });
    /* ★ **자리잡는 동안은 한 번만 굽는다**(계측: `0x0→393x393→435x435`) ──────────────
       표본#3(평소 구간)이 판을 뒤집었다: 중앙값 51ms로 모바일 목표에 닿아 있다. 느린
       것은 평소가 아니라 **뜬 직후**였고, 그 시작 구간의 낭비가 이 줄에 그대로 찍혔다.
       페이지가 뜨는 동안 상자는 0 → 393 → 435로 두 번 자란다(그림이 들어오고, 판이
       배치되고, 주소창이 접힌다). 그때마다 이 층은 지형을 **통째로 다시 구웠다** —
       한 번에 90ms가 넘으니 같은 그림을 두 번 버린 셈이다. 사람이 가장 조바심 내는
       그 몇 초에 200ms 가까이를 헛일에 쓴다.
       늦춰 받으면 그 셋이 하나로 합쳐진다. 마지막 크기 하나만 굽는다.
       늦추는 값(120ms)은 자리잡기보다 길고 사람이 알아채기보다는 짧다. 지형이 어차피
       비동기로 풀리므로 지도가 늦게 뜨지도 않는다 — 굽는 차례가 한 번 뒤로 갈 뿐이다.
       ★ 첫 판(0x0)은 안 늦춘다: 그건 '아직 상자가 없다'라 굽지도 않는다. */
    let settle9 = 0;
    const readSoon = (): void => {
      window.clearTimeout(settle9);
      settle9 = window.setTimeout(read, 120);
    };
    const ro = new ResizeObserver(readSoon);
    ro.observe(el);
    read();
    return () => { window.clearTimeout(settle9); ro.disconnect(); };
  }, []);
  /** 캔버스 면적 예산(px) — 아이폰은 절반 남짓으로 잡는다.
   *
   *  웹킷의 캔버스 면적 한계는 아이폰에서 4096×4096(=16,777,216)이고, 그 한 장이
   *  67MB다. 여기에 유닛 판·안개 판·미니맵·스프라이트 굽기 캐시가 같은 탭 예산을
   *  나눠 쓰므로, 한계 코앞에서 굽는 것은 실패를 부르는 값이다. 8Mpx(32MB)면 아이폰이
   *  실제로 쓰는 최대 요구(전체화면 상자 844 × dpr 3 = 2532 → 6.4Mpx)를 덮고도 남는다.
   *  ★ 화질은 이 값과 무관하다 — 아래 needSide가 '보이는 창을 꽉 덮는 한 변'을 늘
   *    바닥으로 깔기 때문에, 예산이 줄면 **끌 때의 여유분만** 줄어든다.
   *  실패하면 아래 굽기가 이 값을 스스로 반씩 낮춘다(그때만 화질을 내준다). */
  const areaCapRef = useRef(
    typeof navigator !== "undefined"
      /* 아이폰·아이패드 — 아이패드OS 사파리는 UA에 Mac이라 적으므로 손가락 여부를
         함께 본다(맥에는 maxTouchPoints가 0이다). */
      && (/iPad|iPhone|iPod/.test(navigator.userAgent)
        || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1))
      ? 8_000_000 : 16_800_000,
  );
  /** 이미 구워 둔 창 — 그 안에 머무는 동안은 다시 안 굽는다(아래 주석). */
  /** 이미 구워 둔 판 — 열쇠와 창, 그리고 **어느 캔버스에** 구웠나.
   *
   *  ★ 캔버스 신원(cv)을 함께 든다(지적: "이제 또 지도가 안 그려지고 까맣네" ·
   *    "위치는 맞게 잡는데 지도가 안 그려지나 봐") ──────────────────────────────────
   *    "자리는 맞고 그림만 없다"는 곧 **굽기를 건너뛰고 자리만 잡았다**는 뜻이다. 그
   *    건너뜀은 열쇠가 맞을 때 일어나는데, 열쇠에는 캔버스가 안 들어 있었다. 전체화면을
   *    켜고 끄면 이 층이 통째로 다른 자리로 옮겨 심기고(포털) 그 사이 캔버스의 그림이
   *    날아갈 수 있다 — 그래도 열쇠는 멀쩡하니 "이미 구웠다"며 빈 캔버스를 그대로 놓는다.
   *    그림을 지운 자와 그림이 있다고 믿는 자가 다른 것이 이 사고의 얼개다.
   *    캔버스까지 열쇠에 넣으면, 판이 바뀐 순간 '안 구운 것'이 되어 다시 굽는다. */
  const bakedRef = useRef<
    {
      key: string; tx0: number; ty0: number; tx1: number; ty1: number;
      cv: HTMLCanvasElement; cw: number; ch: number;
      /** 타일 하나가 몇 픽셀로 구워졌나 — **또렷함** 그 자체다(아래 '거의 같은 판' 판정의 자). */
      ppt: number;
    } | null
  >(null);
  useEffect(() => {
    /* 한 판 굽기를 함수로 뽑았다 — 상태(zoom·pan)로 한 번, 손짓 중에는 부모가 손끝
       값으로 다시 부른다. 매개변수 이름이 props를 일부러 가린다(아래 몸통은 "지금
       그릴 보기"만 본다).
       ★ **자리를 재는 배율과 굽는 배율은 다르다**(수리: "확대·축소 드래그 시 맵과 모델이
         따로 놀고 맵은 막 흔들리고 튀기도 함") ────────────────────────────────────
         손짓 중에는 판을 매번 다시 굽지 않으려고 배율을 √2 칸으로 갈무리해 넘겼는데,
         그 갈무리한 값이 **자리 셈까지** 먹고 있었다(아래 place). 배율이 칸(1·2·4·8·16)
         이던 시절에는 갈무리해도 값이 그대로라 안 어긋났지만, 배율을 연속으로 바꾼 뒤로는
         최대 19%까지 벌어진다 — 지도는 zq 자리에, 유닛은 진짜 배율 자리에 놓이니 둘이
         따로 놀고, 굴릴 때마다 zq가 칸을 넘나들며 지도가 툭툭 뛴다.
         그래서 둘로 가른다: **자리·크기는 늘 진짜 배율(zoom)**, 갈무리한 값(zBake)은
         '다시 구울까'를 정하는 열쇠와 굽는 해상도에만 쓴다. 한 칸 안에서는 같은 판을
         그대로 두고 자리만 옮기므로(place) 굽는 삯도 그대로다. */
    const paint = (
      zoom: number, pan: { x: number; y: number }, zBake: number = zoom,
      /** 끌 여유 배수(손짓 중 1보다 크다) — 아래 budget·ppt 주석. */
      pad: number = 1,
      /** 손짓 중인가 — 참이면 **절대 다시 굽지 않는다**(아래 hold 주석). */
      hold: boolean = false,
    ): void => {
    const cv = cvRef.current;
    const [bw, bh] = box;
    /* 입체 변환을 **먼저** 건다 — 아래에서 되돌아가는 갈래(지형 대기·굽기 실패)에서도
       상자는 손끝을 따라와야 한다. 그림이 한 박자 늦는 것과 자리가 안 따라오는 것은
       전혀 다른 문제다. */
    if (boxRef.current) {
      /* 평면으로 돌아오면 **지워야 한다** — 이 값은 리액트가 아니라 우리가 손으로 걸어
         둔 것이라, 안 지우면 입체 변환이 그대로 남아 평면 지도가 기운 채로 선다. */
      boxRef.current.style.transform = pitchXf ? pitchXf(zoom, pan) : "";
    }
    if (!cv || !bw || !bh) return;

    /* 지형이 아직 안 풀렸으면 **아무것도 안 그린다**(지적: "처음 페이지 로딩시 초록색
       맵 정보 그림이 떠 그거 안뜨게 해줘") — 지형은 비동기로 풀리는데, 그 사이 옛
       길(타일 그룹 램프)로 한 장 그려 두고 있었다. 그 램프는 타일셋을 모르는 어림이라
       우주 맵도 초록으로 나온다. 한 박자 비는 것이 틀린 그림을 보여 주는 것보다 낫다. */
    /* ★ 다만 **오래 비워 두지는 않는다**(지적: "전체 맵에 아무것도 안 그려져서 까만
       거였어, 미니맵만 그려져 있고") ────────────────────────────────────────────────
       위 규칙("한 박자 비는 것이 틀린 그림보다 낫다")은 지금도 맞다 — 다만 그 '한 박자'가
       늘 짧지는 않았다. 지형은 비동기로 풀리고, 서버가 뒤늦게 새로 구운 지형을 받아
       다시 풀 때도 있다. 그 사이가 길면 지도가 통째로 검은 채 남는데, 정작 미니맵은
       어림(타일 램프)으로라도 그려져 있어 "지도만 고장 났다"로 읽힌다.
       그래서 기다림에 **시한**을 둔다: 그 안에는 비워 두고(초록 어림이 번쩍이지 않는다),
       넘으면 어림으로라도 깐다(검은 판보다 낫다). 지형이 풀리는 순간 제 그림으로 덮인다. */
    if (grid.terrain && !mt && !mtLate) return;
    // `?dpr=N` 재보기 깃발이 있으면 눌러 굽는다(perf9의 DPRCAP9 머리말).
    const dpr = Math.min(DPRCAP9,
      typeof window === "undefined" ? 1 : (window.devicePixelRatio || 1));
    const w = grid.width;
    const h = grid.height;
    /* ★ 밑판 몫을 **예산에서 먼저 뗀다**(지적: "보다가 갑자기 페이지가 새로고침되는
       경우가 있어, 주로 축소할 때") ────────────────────────────────────────────────
       아이폰 사파리의 '새로고침'은 대개 탭이 메모리로 죽었다 다시 뜬 것이다. 그리고
       바로 앞 판에서 이 층에 **밑판을 한 장 더 깔았다** — 그때는 예산을 안 나눠, 지도
       층만 (선명창 8Mpx + 밑판 4Mpx) = 48MB까지 갔다. 축소할 때 유독한 까닭도 여기 있다:
       줄이면 보이는 타일이 늘어 선명창이 예산 끝까지 자라므로, 그 순간이 이 층이 가장
       큰 자리다.
       두 가지로 되돌린다. ① 밑판 한 변을 2048 → 1024로(4분의 1). 밑판은 **확대해서
       창 밖으로 끌었을 때만** 보이는 바탕이라 어차피 흐린 자리이고, 1배에서는 선명창이
       지도 전체를 덮으므로 화면에 안 나온다. ② 그 몫을 선명창 예산에서 뺀다 — 이 층이
       쓰는 총량이 밑판을 넣기 전과 같아진다(선명창의 끌 여유만 6%쯤 줄어든다). */
    const BASE_SIDE = 1024;
    const baseSide9 = Math.min(BASE_SIDE, Math.floor(Math.sqrt(areaCapRef.current / 4)));
    const bcw9 = Math.max(1, Math.round((w * baseSide9) / Math.max(w, h)));
    const bch9 = Math.max(1, Math.round((h * baseSide9) / Math.max(w, h)));
    const areaCap = Math.max(2_000_000, areaCapRef.current - bcw9 * bch9);
    /* ── 캔버스 예산(지적: "아이폰 사파리에서만 확대했을때 화질이 흐리게 … 특히 맵") ──
       한 변 4096(= 16.8Mpx · 67MB)은 **아이폰에서 위험한 값**이다: 웹킷의 캔버스 면적
       한계가 정확히 4096×4096이라, 이 판은 늘 그 한계에서 1% 아래를 긁는다. 거기에
       유닛 판·안개 판·미니맵과 스프라이트 굽기 캐시가 같은 예산을 나눠 쓰므로, 아이폰
       에서는 배킹 확보가 실패하기 쉽다 — 실패한 캔버스는 옛 배킹이 남아 **확대해도
       해상도가 안 느는 것처럼** 보인다.
       예산을 기기에 맞춘다. 화질은 안 잃는다: 보이는 창을 꽉 덮는 데 필요한 한 변은
       늘 **상자폭 × dpr**이기 때문이다(요구 배율 needed와 창 타일 수 visSpan의 곱이
       그 값으로 약분된다 — 아래 두 줄이 그 항등식이다). 그 값만 넘기면 나머지는
       전부 '끌 때 안 깜빡이는' 여유분이라, 아이폰에서는 그 여유만 줄인다. */
    const needSide = Math.ceil(bw * dpr);
    const MAX_SIDE = Math.max(needSide, Math.floor(Math.sqrt(areaCap)));
    // 보이는 분수 창 — 렌즈 사상(zx = (f-0.5)·폭·줌 + 팬)의 역산. 입체는 전체다.
    let vfx0 = 0;
    let vfx1 = 1;
    let vfy0 = 0;
    let vfy1 = 1;
    if (zoom > 1) {
      const winW = 1 / zoom;
      /* ★ 창의 **가운데**를 지도 안으로 죈다(지적: "전체화면에서 줌을 했는데 전체화면을
         끄면 그 줌을 다 소화를 못해서 1배로 폴백시키잖아. 그때 문제가 발생해") ─────────
         여기가 그 자리다. 여태는 창의 **양 끝**만 [0,1]로 죄었는데, 가운데가 지도 밖으로
         나가면 두 끝이 **같은 값으로 무너진다**(둘 다 0이거나 둘 다 1) — 넓이 0인 창이다.
         그러면 굽는 타일이 하나도 없어 지도가 통째로 검게 남고, 열쇠는 멀쩡하니 다시
         굽지도 않는다. 드래그로 팬이 돌아오면 그때 살아나는 것이 그 증상이다.
         가운데가 지도 밖으로 나가는 일은 실제로 있다: 전체화면에서 크게 확대해 멀리
         끌어 둔 팬이, 상자가 작아진 뒤에도 한 박자 남아 있다(팬 되죔은 다음 렌더다).
         팬 하나를 믿는 대신 **창 자체가 지도를 벗어나지 않게** 못 박는다 — 여기서 죄면
         팬이 어떤 값이어도 볼 것이 있다. 줌이 지도보다 넓으면(winW ≥ 1) 가운데다. */
      const mid9 = (c9: number): number => (winW >= 1
        ? 0.5 : Math.min(1 - winW / 2, Math.max(winW / 2, c9)));
      const cxF = mid9(0.5 - pan.x / (bw * zoom));
      const cyF = mid9(0.5 - pan.y / (bh * zoom));
      vfx0 = Math.max(0, cxF - winW / 2);
      vfx1 = Math.min(1, cxF + winW / 2);
      vfy0 = Math.max(0, cyF - winW / 2);
      vfy1 = Math.min(1, cyF + winW / 2);
    }
    let vx0 = Math.max(0, Math.floor(vfx0 * w));
    let vx1 = Math.min(w, Math.ceil(vfx1 * w));
    let vy0 = Math.max(0, Math.floor(vfy0 * h));
    let vy1 = Math.min(h, Math.ceil(vfy1 * h));
    /* 마지막 그물 — 그래도 창이 비었으면(어떤 셈이 어긋나도) **지도 전체**로 물러난다.
       한 겹 흐린 지도가 검은 판보다 낫다. 위 죔이 이 자리를 안 만들지만, 검은 화면은
       한 번 나면 사람이 '고장'으로 읽으므로 그물을 하나 더 둔다. */
    if (vx1 <= vx0 || vy1 <= vy0) { vx0 = 0; vx1 = w; vy0 = 0; vy1 = h; }
    /* 입체는 창을 **타일을 훑어** 잡는다(지적: 입체 확대가 흐림) — 렌즈 분수 창의
       수학(위)은 입체에서도 그대로인데, 원근 때문에 어느 타일이 그 분수에 앉는지가
       평면과 다르다(위쪽 행이 눌리며 더 많은 타일이 보인다). 부모의 posFrac(타일→
       렌즈 분수)로 성긴 격자(4타일 걸음)를 훑어, 창에 드는 타일들의 상자를 창으로
       삼는다 — 걸음만큼 여유를 두므로 빠지는 타일이 없다. 사상이 없으면 전체 맵. */
    if (pitched) {
      const tf = tileFrac?.current;
      if (!tf || zoom <= 1) {
        vx0 = 0; vx1 = w; vy0 = 0; vy1 = h;
      } else {
        const step = Math.max(1, Math.floor(Math.min(w, h) / 32));
        let mx0 = w; let mx1 = 0; let my0 = h; let my1 = 0;
        for (let ty = 0; ty <= h; ty += step) {
          for (let tx = 0; tx <= w; tx += step) {
            const [fx9, fy9] = tf(tx, ty);
            if (fx9 < vfx0 || fx9 > vfx1 || fy9 < vfy0 || fy9 > vfy1) continue;
            if (tx < mx0) mx0 = tx;
            if (tx > mx1) mx1 = tx;
            if (ty < my0) my0 = ty;
            if (ty > my1) my1 = ty;
          }
        }
        if (mx1 <= mx0 || my1 <= my0) {
          vx0 = 0; vx1 = w; vy0 = 0; vy1 = h;   // 창을 못 잡으면 안전하게 전체.
        } else {
          vx0 = Math.max(0, mx0 - step);
          vx1 = Math.min(w, mx1 + step);
          vy0 = Math.max(0, my0 - step);
          vy1 = Math.min(h, my1 + step);
        }
      }
    }
    /* ★ **구워 둔 창 안이면 아무 일도 안 한다**(지적: "확대시 맵을 드래그로 이동하면
       맵배경이 그부분 그때 그려지면서 깜빡임 발생 — 확대축소시 한번에 그려놔야할듯").
       여태 이 effect는 pan이 굳을 때마다 **보이는 창 + 40%**를 다시 구웠다. 끌다가 그
       40%를 벗어나는 순간 캔버스가 새 자리로 옮겨지고 그 자리가 그제서야 칠해지니,
       드래그 내내 가장자리가 번쩍였다.
       이제 굽는 창은 '보이는 만큼'이 아니라 **캔버스 예산(4096)이 허락하는 최대**다.
       그 창 안에서 움직이는 동안은 여기서 곧장 빠져나가므로(아래 문) 드래그 중에는
       한 번도 다시 안 굽는다 — 다시 굽는 때는 배율·상자·보기가 바뀔 때, 그리고 정말
       창 밖으로 나갔을 때뿐이다. */
    /* ★ 캔버스를 **화면 자리에 직접 앉힌다**(지적: "전체화면 모드를 실행하면 모델들이
       선명해져 맵은 안선명해져" + #diag가 낸 수치) ────────────────────────────────
       진단이 딱 잘라 말해 줬다: 타일당 74/74(100%) · 배킹확보 성공인데도 지도만 흐렸다.
       배킹은 옳게 구워졌는데 **합성이 그 해상도를 버린 것**이다. 까닭은 이 층이 렌즈
       (.scr-motion-lens) **안**에 있어서다 — 렌즈는 scale(z)를 쓰고, 웹킷은 변환이 걸린
       가지를 1배로 한 번 래스터해 두고 z배로 늘려 붙인다. 같은 화면의 유닛 캔버스가
       100%이면서 또렷했던 것이 대조군이다: 그쪽은 렌즈 **밖**이다.
       그래서 유닛 캔버스가 갔던 길을 그대로 간다(그쪽 주석: "렌즈 밖에서 줌·팬을
       그리기 좌표에 직접 입힌다"). 이 층도 렌즈 밖으로 나가고, 렌즈가 해 주던 일
       (분수 자리 → 화면 자리)을 여기서 **픽셀로** 셈해 얹는다:
           화면 = (분수 − 0.5) × 상자 × 배율 + 팬 + 상자/2
       조상에 scale이 없으니 브라우저는 캔버스를 제 배킹 해상도로 그린다.
       ⚠ 입체(각도) 보기는 예외다 — 원근·회전은 레이아웃으로 못 펴므로 그때는 예전처럼
         컨테이너가 변환을 지고, 부모가 렌즈 몫(translate·scale)까지 합쳐 넘긴다. */
    const placeOn = (
      cv: HTMLCanvasElement, ax0: number, ay0: number, ax1: number, ay1: number,
    ): void => {
      if (pitched) {                      // 입체 — 컨테이너가 변환을 진다(부모가 합쳐 준다).
        /* ★ 입체는 캔버스를 **R배 크게 눕히고 제 자리에서 1/R로 접는다**(지적: "3D
           지도도 흐림 — iOS에서만") ─────────────────────────────────────────────────
           perspective가 낀 변환에는 단일 배율이 없어, 합성기는 이 서브트리를 렌더
           서피스로 떼어 내며 **레이아웃 크기 기준으로 다시 래스터한다** — 배킹을 아무리
           촘촘히 구워도 그 서피스에 CSS 크기로 눌려 들어가면 도로 흐리다. 크로뮴은
           이 병을 canvas-blank 폴백에서 이미 앓아 같은 처방(pitchStyle의 R)이 있는데,
           **이 벡터층만 그 문을 안 지나고 있었다**. 아이폰이 유독 심한 까닭은 DPR 3
           까지 함께 버리기 때문이다.
           처방은 같다: 레이아웃(CSS 크기)을 R배로 키우고 제 왼위를 축으로 1/R 접기 —
           화면 기하는 한 톨도 안 바뀌고(왼위·자리 그대로), 서피스 래스터만 R배
           촘촘해진다. R는 '배킹 한 변 ÷ CSS 한 변'(그보다 촘촘히 눕혀야 배킹이 다
           산다)을 1~4로 자르고, 레이아웃 폭이 3200px을 넘지 않게 한 번 더 자른다
           (서피스도 메모리다 — 웹킷은 못 잡으면 통째로 안 그린다).
           ※ 상자(boxRef)는 안 키운다 — 상자 크기는 ResizeObserver가 재서 배율 셈에
             되먹이므로, 키우는 순간 셈이 제 꼬리를 문다. 캔버스만 키운다. */
        const cssW9 = (((ax1 - ax0) / w)) * bw;
        const cssH9 = (((ay1 - ay0) / h)) * bh;
        /* ★ 눕히는 배수는 **면적으로도** 죈다(지적: "저배율에서 3D 전환 시 죽음") ──────
           위 3200은 레이아웃 **폭**만 보는 자다. 그런데 이 눕히기가 실제로 무는 것은
           폭이 아니라 **합성 서피스 한 장**이고, 그 넓이는 (레이아웃 폭 × 레이아웃 높이 ×
           dpr²)이다 — 이 처방이 서는 전제 자체가 '합성기가 축소를 못 접고 레이아웃
           크기로 래스터한다'이므로, 눕힌 만큼이 고스란히 서피스가 된다. 폭만 보면 dpr도
           높이도 안 세는 셈이라, 세로로 긴 폰의 dpr 3에서 가장 크게 빗나간다.
           ── 왜 하필 저배율인가
           입체에서 배율이 1이면 창이 **지도 전체**다(위 pitched 창 잡기). 그러면 cssW9가
           상자 폭 그대로라 R9가 3~4까지 붙고, 그 배수가 제곱으로 서피스에 실린다. 셈해
           보면(폰 390px·dpr 3) 저배율 3D는 서피스가 3510² = 47MB이고, 이 함수를 지나는
           층이 밑판·선명한 판 둘이라 **94MB**다. 같은 폰에서 확대한 3D는 10MB다 — 아홉
           배 차이가 곧 "저배율에서만 죽는다"의 정체다.
           ── 잃는 것이 왜 적은가
           저배율은 지도 전체를 상자 하나에 욱여넣는 자리다(128타일을 390px에 = 타일당
           3px). 거기서 래스터를 더 촘촘히 눕혀 봐야 타일 한 칸이 3픽셀인 것은 그대로다 —
           R9가 값을 하는 자리는 확대해서 타일이 굵어졌을 때고, 그때는 창이 작아 cssW9도
           작으므로 이 문에 안 걸린다(실측: 창 1/4에서는 종전대로 4다).
           예산은 이 파일이 이미 들고 있는 기기별 면적(areaCapRef — 아이폰 8Mpx · 그 밖
           16.8Mpx)을 쓰되, 이 함수를 지나는 층이 둘이므로 반씩 나눈다. */
        const surfCap9 = Math.max(1, Math.floor(Math.sqrt(
          areaCapRef.current / 2
          / Math.max(1, cssW9 * cssH9 * dpr * dpr),
        )));
        const R9 = Math.max(1, Math.min(4, Math.round(cv.width / Math.max(1, cssW9)),
          Math.floor(3200 / Math.max(1, cssW9)), surfCap9));
        cv.style.transformOrigin = "0 0";
        cv.style.transform = R9 > 1 ? `scale(${(1 / R9).toFixed(4)})` : "";
        cv.style.left = `${((ax0 / w) * 100).toFixed(4)}%`;
        cv.style.top = `${((ay0 / h) * 100).toFixed(4)}%`;
        cv.style.width = `${(((ax1 - ax0) / w) * 100 * R9).toFixed(4)}%`;
        cv.style.height = `${(((ay1 - ay0) / h) * 100 * R9).toFixed(4)}%`;
        return;
      }
      /* 자리는 **translate로** 옮긴다 — left/top을 매 프레임 쓰면 레이아웃이 다시 돌지만
         translate는 합성기만 일한다(끌 때 이 함수가 프레임마다 불린다).
         ★ translate는 **해상도를 안 버린다** — 배킹을 버리는 것은 scale뿐이다. 크기는
           px로 못 박아 두고(굽기마다 한 번) 움직임만 변환에 싣는 까닭이 그것이다. */
      /* 자리도 **기기픽셀 격자에 맞춘다** — 크기를 1:1로 맞춰 놓아도 자리가 픽셀의
         3분의 1만큼 어긋나 있으면 브라우저가 도로 재표본한다(dpr 3이면 CSS 1px이
         기기 3px이라 CSS 정수 맞춤으로는 모자란다). 어긋남은 최대 1/3 CSS px이라
         유닛과의 정렬에는 눈에 안 드는 몫이다. */
      const snap = (v: number): number => Math.round(v * dpr) / dpr;
      cv.style.left = "0px";
      cv.style.top = "0px";
      cv.style.width = `${snap(((ax1 - ax0) / w) * bw * zoom)}px`;
      cv.style.height = `${snap(((ay1 - ay0) / h) * bh * zoom)}px`;
      cv.style.transform = `translate(${snap((ax0 / w - 0.5) * bw * zoom + pan.x + bw / 2)}px, ${snap((ay0 / h - 0.5) * bh * zoom + pan.y + bh / 2)}px)`;
    };
    /** 위 창(선명한 판)을 앉힌다. */
    const place = (ax0: number, ay0: number, ax1: number, ay1: number): void =>
      placeOn(cv, ax0, ay0, ax1, ay1);
    /* ── 밑판 — **맵 전체**를 한 번 굽고, 그 뒤로는 자리만 옮긴다(위 baseRef 주석) ──
       여기는 paint의 **모든 갈래보다 앞**이다: 손짓 중 빠른 길로 빠져나가든, 창 안이라
       그냥 돌아가든, 밑판은 늘 제자리를 따라와야 한다. 굽기는 열쇠가 갈릴 때만 돈다. */
    const bcv = baseRef.current;
    if (bcv) {
      const bkey = `${grid.hash}|${mt ? 1 : 0}|${bw}x${bh}|${pitched ? 1 : 0}|${pitchSig ?? ""}`;
      const b9 = baseBakedRef.current;
      if (!b9 || b9.key !== bkey || b9.cv !== bcv || !bcv.width) {
        /* 크기는 위에서 이미 정했다(BASE_SIDE) — 예산을 그만큼 떼야 해서 먼저 셈한다. */
        const bppt9 = baseSide9 / Math.max(w, h);
        if (bcv.width !== bcw9) bcv.width = bcw9;
        if (bcv.height !== bch9) bcv.height = bch9;
        const bctx9 = bcv.getContext("2d");
        if (bctx9 && bcv.width === bcw9 && bcv.height === bch9) {
          bctx9.clearRect(0, 0, bcw9, bch9);
          /* 반올림한 변에서 되짚은 실제 타일 크기로 늘려 그린다 — 위 창이 쓰는 자와
             같은 자다(안 그러면 정사각이 아닌 맵에서 가장자리 한 줄이 뜬다). */
          bctx9.setTransform((bcw9 / w) / bppt9, 0, 0, (bch9 / h) / bppt9, 0, 0);
          drawMapGrid(bctx9, grid, mt, bppt9, false, pitched ? 4 : 1);
          bctx9.setTransform(1, 0, 0, 1, 0, 0);
          baseBakedRef.current = { key: bkey, cv: bcv };
        }
      }
      placeOn(bcv, 0, 0, w, h);
    }
    // 열쇠는 **갈무리한 배율**로 — 한 칸 안에서는 같은 판을 그대로 쓴다(위 주석).
    // 열쇠에 pad도 싣는다 — 손짓용(넓게·덜 또렷)과 굳은 판(좁게·또렷)이 서로 다른 판이다.
    const key = `${grid.hash}|${mt ? 1 : 0}|${bw}x${bh}|${zBake}|${pitched ? 1 : 0}|${pitchSig ?? ""}|${pad}`;
    const b0 = bakedRef.current;
    /* ★ 손짓 중에는 **다시 굽지 않는다**(재지적: "3D에서 드래그 시 맵이 늦게 따라가는
       것도 여전하네") ────────────────────────────────────────────────────────────
       앞판은 굽는 창을 1.45배로 넓혀 여유를 뒀다. 그것으로 느린 끌기는 덮이지만, 빠른
       끌기는 그 여유(입체 4배에서 열네 타일쯤)를 금세 넘고 그때 4096짜리 판을 다시
       굽는다 — 한 번이 프레임을 넘기므로 지도만 툭 뒤처진다. 여유를 더 키우면 화질이
       그만큼 깎인다.
       그래서 손짓 중에는 **굽기를 아예 미룬다**: 이미 구운 판이 있으면 창을 벗어나도
       그 판을 그대로 놓기만 한다(place). 벗어난 몫은 판의 가장자리라, 1.45배 여유
       덕에 대개 화면에 안 든다 — 들어도 한 줄 비는 것이고, 손을 떼는 순간 제 창으로
       다시 구워 채워진다. 움직임이 손끝을 놓치는 편보다 이쪽이 낫다. */
    /* 손짓 중 빠른 길 — 그림이 **그 캔버스에 그대로 있을 때만** 자리만 옮긴다.
       판이 갈렸거나 크기가 달라졌으면(그림이 날아갔다) 굽는 쪽으로 내려간다. */
    if (hold && b0 && b0.cv === cv && cv.width === b0.cw && cv.height === b0.ch) {
      place(b0.tx0, b0.ty0, b0.tx1, b0.ty1);
      return;
    }
    if (b0 && b0.key === key && b0.cv === cv
      && cv.width === b0.cw && cv.height === b0.ch
      && vx0 >= b0.tx0 && vx1 <= b0.tx1 && vy0 >= b0.ty0 && vy1 <= b0.ty1) {
      /* 구운 창 안이라 **다시 굽지는 않는다** — 그래도 자리는 옮겨야 한다. 렌즈 안에
         있던 시절에는 렌즈가 팬을 공짜로 먹여 줬지만, 밖으로 나온 지금은 팬이 곧
         이 캔버스의 자리다. 스타일 네 줄이라 값은 굽기와 비교가 안 되게 싸다. */
      place(b0.tx0, b0.ty0, b0.tx1, b0.ty1);
      return;
    }
    /* 타일 하나의 배킹 픽셀 — **화질이 먼저다**(지적: "재분석까지 했는데도 흐리게
       나와, 해상도가 칼같지 않네"). 앞판은 '보이는 창의 2.6배를 굽자'를 먼저 정하고
       화질을 거기 맞춰 낮췄는데, 그 죔이 PC(폭 1024·dpr 2)에서는 **모든 배율에서**
       요구 해상도의 77%로 눌렀다 — 유닛 판은 칼같은데 바닥만 늘 한 겹 흐렸다.
       뒤집는다: 화질은 화면 요구값 그대로 두고(창을 못 덮을 때만 낮춘다 — 그 아래로
       낮출 까닭이 없다), **창 너비가 그 화질에서 예산(4096)이 허락하는 만큼**이 된다.
       셈해 보면 드래그 버퍼는 여전히 남는다: 보이는 창 대비 폰 ~3.5배 · PC ~2배라
       '끌 때 안 깜빡인다'도 지켜진다. */
    const visSpan = Math.max(1, Math.max(vx1 - vx0, vy1 - vy0));
    /* ★ 요구 타일 크기는 **분수 그대로** 쓴다(지적: 아이폰에서 지도만 계속 흐림 —
       #diag가 "타일당 37/37 (100%)"이라고 말하는데도 흐렸다) ────────────────────────
       그 100%가 거짓말이었다. 여기서 요구값을 **올림**해 정수 배킹을 굽고 있었는데,
       화면에 놓이는 크기는 올림 전 분수다. 실측(아이폰 세로·배율 4):
           배킹 2812px  ·  화면 기기픽셀 2800.1px  →  브라우저가 먹이는 배율 1.0042
       1에 가까우면서 정수가 아닌 배율은 재표본의 **최악**이다: 모든 픽셀이 이웃과
       조금씩 섞여 화면 전체가 고르게 뭉갠다 — "해상도가 엄청 낮은 느낌"이 그것이다.
       같은 화면의 유닛 캔버스가 또렷했던 까닭도 여기서 갈린다: 그쪽은 inset:0이라
       배킹이 `round(상자 × dpr)`이고 화면 기기픽셀과 **정확히 같다**(배율 1.0000).
       그래서 굽는 크기를 분수로 두고, 캔버스 변을 화면 기기픽셀에 **반올림해 맞춘다** —
       배율이 1이 되어 재표본 자체가 사라진다. drawMapGrid는 분수 배율을 그대로 받는다. */
    // 굽는 해상도도 갈무리한 배율로 — 한 칸 안에서 판이 안 바뀌어야 다시 안 굽는다.
    const needed = Math.max(0.001, (bw * dpr * zBake) / w);
    /* ★ 타일당 상한은 **512**다(수리: 같은 지적의 진짜 범인) — 여기 있던 256은 화면이
       요구하는 값과 무관한 어림 상한이라, **dpr 3 기기에서만** 물렸다: 아이폰
       전체화면(상자 844 · dpr 3)은 배율 13부터 요구가 258을 넘어 256에 잘리고, 16배
       에서는 요구 317 대비 81%까지 눌린다 — 곧 어느 배율부터 **확대해도 해상도가
       안 는다**. PC(dpr 2)는 16배에서 요구가 정확히 256이라 한 번도 안 물렸고, 그래서
       "아이폰에서만" 흐렸다.
       상한을 올려도 캔버스는 안 커진다: 바로 아래 `floor(MAX_SIDE / visSpan)`이 이미
       `ppt × visSpan ≤ MAX_SIDE`를 보장하므로, 면적 예산이 진짜 상한이다. */
    /* ★ 손짓 중에는 **끌 여유를 미리 굽는다**(지적: "3D에서 드래그 시 안개와 모델만
       먼저 움직이고 맵은 나중에 움직임") ────────────────────────────────────────────
       진범은 예산 셈이었다. 굽는 창은 `budget = max(visSpan, MAX_SIDE/ppt)`인데,
       ppt가 `MAX_SIDE/visSpan`에 걸리는 순간(= 화질이 예산에 막히는 순간) 두 항이 같아져
       **budget == visSpan**, 곧 굽는 창이 보이는 창과 딱 같아진다. 그러면 한 픽셀만
       끌어도 창을 벗어나 4096짜리 판을 통째로 다시 굽는다 — 그 삯이 프레임을 넘겨
       지도만 뒤늦게 따라온다.
       입체에서 유독 심한 까닭도 이것이다: 원근 때문에 보이는 타일이 훨씬 많아(visSpan이
       크다) 거의 늘 예산에 막힌다.
       그래서 손짓 중에는 요구 배율을 pad로 나눠 **일부러 한 단 덜 또렷하게** 굽고, 그
       몫을 창 넓이로 돌린다. 굽기는 손짓 시작과 끝에 한 번씩만 일어나고(열쇠에 pad를
       실었다) 그 사이는 자리만 옮긴다(place). 굳은 뒤에는 pad 1로 다시 구워 화질이
       제자리로 온다 — 그 한 번은 움직임이 멈춘 뒤라 눈에 안 띈다. */
    const ppt = Math.max(0.001, Math.min(needed, MAX_SIDE / (visSpan * pad), 512));
    /** 그 배율에서 한 변에 담을 수 있는 타일 수 — 창은 이만큼 크게 굽는다. */
    const budget = Math.max(Math.round(visSpan * pad), Math.floor(MAX_SIDE / ppt));
    /** 보이는 창을 가운데 두고 예산껏 넓힌 뒤 맵 안으로 민다. */
    const spread = (a0: number, a1: number, n: number): [number, number] => {
      const want = Math.min(n, budget);
      const c9 = (a0 + a1) / 2;
      let s9 = Math.round(c9 - want / 2);
      s9 = Math.max(0, Math.min(n - want, s9));
      return [s9, s9 + want];
    };
    const [tx0, tx1] = spread(vx0, vx1, w);
    const [ty0, ty1] = spread(vy0, vy1, h);
    /* 캔버스 변은 **화면 기기픽셀에 반올림**한다(위 주석) — 이 한 줄이 배율을 1로 만든다. */
    const cw = Math.max(1, Math.round((tx1 - tx0) * ppt));
    const ch = Math.max(1, Math.round((ty1 - ty0) * ppt));
    /* 반올림한 변에서 되짚은 실제 타일 크기 — 그리기는 이 값으로 해야 가장자리가 안 뜬다. */
    const pptX = cw / Math.max(1, tx1 - tx0);
    const pptY = ch / Math.max(1, ty1 - ty0);
    /* 배킹이 **정말 잡혔는지 확인한다** — 아이폰 웹킷은 면적·메모리 한계를 넘으면
       조용히 실패한다(예외를 안 던지고, 그린 것만 사라지거나 옛 배킹이 남는다). 옛
       배킹이 남으면 화면은 '확대해도 그대로'가 된다 — 이 지적의 증상 그대로다.
       못 잡았으면 예산을 반으로 줄여 **이 자리에서 곧장** 다시 잡아 본다: 그냥
       돌아가면 다음 손짓까지 바닥이 빈 채로 남는다. 한 겹 흐린 바닥이 안 그려진
       바닥보다 낫고, 낮춘 예산은 ref에 남아 다음 굽기부터 처음부터 적용된다. */
    /* ★ **거의 같은 판이면 다시 굽지 않는다**(계측: `지형굽기:2616x2616` · `2604x2604`)
       ─────────────────────────────────────────────────────────────────────────────
       굽기 횟수를 세어 보니 뜬 직후에 두 번 굽는데, 두 판의 크기가 **0.5%밖에 안
       다르다**. 둘 다 6.8Mpx(예산 8Mpx의 코앞)이니 사실상 같은 그림을 두 번 구운 것이다.
       까닭: 상자가 393 → 434로 자라면 열쇠(bw×bh)가 갈려 다시 굽는데, 정작 굽는 크기는
       **면적 예산에 막혀** 어차피 같은 값으로 수렴한다. 열쇠는 '얼마나 크게 굽나'가
       아니라 '상자가 몇 픽셀인가'를 보고 있었다 — 재는 자가 틀린 자리다.
       그래서 굽기 직전, **실제로 나온 판**을 이미 있는 판과 견준다: 같은 캔버스에,
       필요한 창을 다 덮고, **또렷함이 2% 안쪽**이면 그대로 쓴다. 눈에 드는 차이가 0.5%인데
       6.8Mpx를 다시 칠하는 거래는 어떤 경우에도 손해다. 열쇠는 새 값으로 갈아 둔다 —
       안 그러면 프레임마다 여기까지 와서 같은 판정을 되풀이한다.
       ★ 재는 자는 캔버스 **크기**가 아니라 **타일당 픽셀(ppt)**이다 — 크기로 재면 큰
         것을 놓친다: 손짓 중에는 일부러 덜 또렷하게 굽는데(pad 1.45), 그때도 캔버스
         변은 예산에 막혀 비슷한 값이 나온다. 크기만 보면 손을 뗀 뒤의 **또렷한 재굽기를
         건너뛰어** 지도가 흐린 채로 굳는다. ppt는 그 차이(1.45배)를 그대로 드러낸다. */
    const near9 = bakedRef.current;
    if (near9 && near9.cv === cv
      && cv.width === near9.cw && cv.height === near9.ch
      && vx0 >= near9.tx0 && vx1 <= near9.tx1 && vy0 >= near9.ty0 && vy1 <= near9.ty1
      && Math.abs(pptX - near9.ppt) <= near9.ppt * 0.02) {
      if (PERF9) pCount("지형굽기:건너뜀(거의같음)", 1);
      near9.key = key;
      place(near9.tx0, near9.ty0, near9.tx1, near9.ty1);
      return;
    }
    if (cv.width !== cw) cv.width = cw;
    if (cv.height !== ch) cv.height = ch;
    if (scrDiagOn()) {
    SCR_DIAG.mapCss = `${bw}x${bh}`;
    /* ★ 진단이 **거짓말을 못 하게** 고친다 — 앞판은 올림한 정수끼리 견줘 "37/37 100%"를
       내면서 정작 브라우저가 1.0042배로 재표본하는 것을 못 봤다. 이제 배킹을 화면
       기기픽셀과 직접 견준다: 1.000이 아니면 그만큼 재표본이다. */
    SCR_DIAG.ppt = Math.round(pptX * 100) / 100;
    SCR_DIAG.needed = Math.round(needed * 100) / 100;
    SCR_DIAG.scale = Math.round((cw / Math.max(1e-6, ((tx1 - tx0) / w) * bw * zoom * dpr)) * 10000) / 10000;
    SCR_DIAG.areaCap = areaCap;
    SCR_DIAG.mapBack = `${cv.width}x${cv.height}`;
    SCR_DIAG.allocOk = cv.width === cw && cv.height === ch;
    }
    if (cv.width !== cw || cv.height !== ch) {
      if (areaCap <= 2_000_000) {         // 더 줄일 데가 없다 — 이번 판은 포기한다.
        bakedRef.current = null;
        return;
      }
      areaCapRef.current = Math.max(2_000_000, Math.floor(areaCap / 2));
      bakedRef.current = null;
      paint(zoom, pan, zBake, pad, hold); // 줄인 예산으로 한 번 더(재귀 깊이는 로그로 준다)
      return;
    }
    place(tx0, ty0, tx1, ty1);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    // drawMapGrid는 맵 원점 좌표로 그린다 — 창의 왼위만큼 밀면 캔버스가 알아서 자른다.
    ctx.setTransform(pptX / ppt, 0, 0, pptY / ppt, -tx0 * pptX, -ty0 * pptY);
    /* 자원 점은 안 찍는다(요청) — 이 층 위에 **진짜 밭·간헐천 모델**이 그 자리에
       서므로, 밑그림의 점은 같은 것을 두 번 말하면서 모델 밑으로 얼룩만 남긴다. */
    /* 입체에서는 벽이 네 배 높다(요청) — 평면(위에서 내려다보는 그림)에서는 벽띠가
       곧 '남쪽으로 밀린 그림자'라 높이면 고원이 어긋나 보이지만, 입체에서는 그 띠가
       바로 우리 쪽을 보는 절벽면이라 높을수록 지형의 단이 또렷하다. */
    drawMapGrid(ctx, grid, mt, ppt, false, pitched ? 4 : 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /* ★ **정말로 구운 횟수**를 센다 — 여기까지 온 것만이 굽기다.
       `붓:지도벡터`가 세던 것은 이펙트가 **돈** 횟수라, 캐시에 맞아 자리만 옮기고
       돌아간 것까지 함께 셌다. 그 둘을 갈라야 "지형을 몇 번 다시 그렸나"에 답할 수 있다.
       어떤 크기로 구웠는지도 함께 남긴다 — 같은 크기를 두 번 구웠다면 그건 낭비다. */
    if (PERF9) pCount(`지형굽기:${cw}x${ch}`, 1);
    bakedRef.current = { key, tx0, ty0, tx1, ty1, cv, cw, ch, ppt: pptX };
    };
    /* 부모가 손짓 중에 쥘 붓 — 손끝 배율은 이어서 움직이므로 **√2 칸으로 갈무리**해
       넘긴다. 안 그러면 휠 한 번에 배율이 수십 번 바뀌며 그때마다 4096짜리 판을 다시
       굽는다. 칸이 √2면 한 칸 안에서는 늘려 깔아도 40%를 안 넘어 눈에 안 띄고,
       확대·축소 내내 두세 번만 다시 굽는다. */
    if (painter) {
      painter.current = (z9, p9) => {
        /* 갈무리한 값은 **굽기에만** 넘긴다 — 자리는 손끝 배율 그대로여야 유닛과 안
           어긋난다(위 paint 주석의 수리). */
        const zq = 2 ** (Math.round(Math.log2(Math.max(0.05, z9)) * 2) / 2);
        /* 1.45배 넓게 굽고, 그 판을 손짓 내내 **그대로 쓴다**(hold) — 자리만 옮긴다.
           굽기는 손짓 시작의 한 번뿐이고, 놓는 순간 부모의 상태 변화가 제 창으로 다시
           굽는다(그때는 pad 1·hold 없음이라 열쇠가 갈린다). */
        paint(z9, p9, zq, 1.45, true);
      };
    }
    /* ★ **어느 의존성이 흔들리나**를 함께 적는다 ────────────────────────────────
       이 붓은 의존 목록에 t가 없으니 재생 중에는 한 번도 안 돌아야 한다. 그런데 계측이
       열 렌더에 한 번(한 번에 48~90ms) 돈다고 말한다. 셈으로는 있을 수 없는 일이라,
       목록 중 무엇이 매번 새 값으로 오는지가 곧 답이다.
       눈으로 찾을 수 있는 자리가 아니다(값이 아니라 **정체성**이 바뀌는 것이라 소스만
       봐서는 안 보인다). 그러니 지난 값을 들고 있다가 갈린 것의 이름을 세어 둔다 —
       계측판에 `벡터dep:box` 같은 줄로 뜬다. 이름이 나오면 고칠 데가 정해진다. */
    if (PERF9) {
      const cur9: Record<string, unknown> = {
        grid, mt, mtLate, zoom, panx: pan.x, pany: pan.y, box, pitched, pitchSig, painter, tileFrac,
      };
      const prv9 = depPrevRef.current;
      if (prv9) {
        for (const k9 of Object.keys(cur9)) {
          if (!Object.is(prv9[k9], cur9[k9])) pCount(`벡터dep:${k9}`, 1);
        }
      }
      depPrevRef.current = cur9;
    }
    pWrap("붓:지도벡터", () => paint(zoom, pan));
  }, [grid, mt, mtLate, zoom, pan.x, pan.y, box, pitched, pitchSig, painter, tileFrac]);
  return (
    <div className="scr-motion-canvas scr-motion-mapvec" style={style} ref={boxRef}>
      {/* 밑판이 먼저 — 둘 다 절대배치라 DOM 차례가 곧 위아래다(위 baseRef 주석).
          이름표를 단다: 검진 도구(perf-check --probe-mapvec)가 '배율을 따라오는 판'을
          집어야 하는데, 차례로만 고르면 이제 밑판을 문다. */}
      <canvas ref={baseRef} className="scr-mapvec-base" aria-hidden />
      <canvas ref={cvRef} className="scr-mapvec-sharp" aria-label={`${grid.name} 지도`} />
    </div>
  );
}
