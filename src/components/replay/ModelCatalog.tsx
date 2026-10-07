import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { ArrowLeft, Play, RotateCw, X } from "lucide-react";
import {
    SHAPE_GALLERY, DocIcon9, DocTracer9,
    shapeMapTiles, shapeFitBox, galleryYawOf, docAnimOf9, docCellsOf9, docCellBox9, type ShapeGalleryItem,
} from "./ReplayMotionPlayer";

/* ★ (옮김) scplayer 의 도록 화면(GalleryScreen)을 패키지로 들였다(2026-10, 요청: "도록을 scplay에 포함시킬것임
   재생기가 아니라 도록 페이지 자체를 제공함") — 앱마다 같은 화면을 베껴 들면 모델을 고칠 때 앱마다 따라 고쳐야 한다.
   앱은 갈래(유닛·건물·부가)만 쥐고 넘긴다: 주소를 어떻게 적을지는 앱의 일이다. 닫기 단추는 onClose 를 줄 때만
   선다(탭 안에 둔 앱은 안 준다). CSS 는 replay.css 의 '모델 도록' 절. 아래 주석은 scplayer 시절 그대로다. */

/* 도록(모델 자료실) — 재생기가 쓰는 모델을 한 자리에서 본다(요청).
 *
 * ■ 이 화면이 짓지 않는 것
 * 모델을 그리는 일은 한 톨도 안 짓는다. scplay가 낸 넷이 그 일을 다 한다 —
 * SHAPE_GALLERY(무엇이 있나) · DocIcon9(한 컷을 그린다 — GL 붓이 켜져 있으면 지도와 같은 메시 그림, 아니면 ShapeIcon SVG) · poseCutsOf/poseTempoOf
 * (어떤 컷을 어떤 박자로) · atkCutOf/flapCutOf(지금 어느 컷인가). 여기서 짓는 것은
 * 고르기·배치·팝업뿐이다.
 * 그래서 모델을 고치면 이 화면이 **저절로 따라온다** — 목록도 차례도 저쪽 표가 정한다.
 *
 * ■ 차례
 * SHAPE_GALLERY의 차례를 그대로 쓴다(요청: "원작에서 먼저 등장하는 유닛/건물 순").
 * 그 표가 이미 유닛/건물로 가르고 테란 → 프로토스 → 저그, 그 안에서 기본 → 고급·후반이다.
 */

/* 개인색은 **못 바꾼다**(요청) — 도록은 임자가 없는 화면이라 색을 고를 까닭이 없고,
   무엇보다 같은 색으로 견줘야 모델끼리의 차이가 색이 아니라 꼴로 읽힌다.
   ★ 값과 **드는 자리**는 CSS가 쥔다(global.css의 --scr-doc-own) ─────────────────────
     여기서 컨테이너에 style={{ color }}로 내려 주던 것을 걷었다. ShapeIcon은 칠 안 한
     면을 currentColor로 채우는데(scplay 규약), 색을 컨테이너에 주면 그 색이 **글자까지**
     함께 물려받는다 — 지적("도록의 글자들까지 에메랄드 네온이라 잘 안 보임")이 그것이다.
     이제 CSS가 모델(.scr-doc-svg)에만 색을 걸고, 글자는 앱의 기본색 그대로 둔다. */

export type ModelCatalogGroup = ShapeGalleryItem["group"];
type Group = ModelCatalogGroup;
type RacePick = "전체" | "테란" | "프로토스" | "저그";

/** 각도 칸 — PC는 0도부터 45도씩 여덟 방, 좁은 화면은 네 방이다(요청).
 *  네 방을 45·135·225·315로 잡는 것도 요청이다: 0/90/180/270은 정면·측면이라 서로
 *  가장 안 갈리는 넷이고, 45도씩 비낀 넷이 앞뒤·좌우를 한 번에 보여 준다. */
/** 크기 보정 모드(요청: 도록 주소에 ?cal을 붙이면 격자 바닥 위에 **게임 12배 줌의 실제 크기**로
 *  45도 한 컷씩만) — 값이 1이면 이 기기 폭(최대 640px)을 128타일 지도로 보고 12배 한 타일 px를
 *  셈하고, 숫자를 주면 그것이 곧 한 타일의 px다(예: ?cal=36). 크기 = shapeMapTiles(kind) × 타일 px
 *  — 지도가 스프라이트 상자(16단위)를 앉히는 그 식이다. 자세는 지도 기본(2D top)이다. */
function calTilePx(docWidth: number): number | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const v = q.get("cal");
  if (v === null) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1) return n;
  /* 실제 지도의 타일 px와 같은 식(재지적: 격자가 실제 맵 타일 크기에 맞아야) — 지도는 화면 내용
     폭에 꽉 차게 서고 한 타일 = 지도 폭 ÷ 지도 타일 수(기본 128, ?mw=96처럼 바꿀 수 있다).
     12배 줌은 그 타일의 12배다. 이 도록 화면의 내용 폭이 곧 지도가 서는 폭이다. */
  const mw = Number(q.get("mw")) || 128;
  return (docWidth / mw) * 12;
}
/* 방위 눈금 — **유닛의** 눈금이다. 건물은 지도에서 각이 하나(40도)뿐이라 이 눈금을
   그대로 쓰면 도록의 건물만 지도와 5도 어긋나 선다: 그리는 자리마다 galleryYawOf로
   그 갈래의 기준각으로 옮긴다(건물은 −5도 → 40·130·220·310). 눈금 글자도 옮긴 각을
   적는다 — 그림과 숫자가 갈리면 도록이 거짓말을 한다.
   ★ 모든 칸을 flat(위에서 본 판)으로 굽는다 — 지도의 2D와 **같은 카메라**다(요청:
     "전부 2D 지도와 같게"). 안 주면 도록 전용 투영(수직 26.8도)이라 같은 모델이 두
     화면에서 다른 높이로 보였다. */
const ROTS_WIDE = [0, 45, 90, 135, 180, 225, 270, 315];
const ROTS_NARROW = [45, 135, 225, 315];

/* (걷어냄) 시점 칸 버튼 셋 — 평면·사선·입체를 고르던 알약이다(지시: "이 버튼들은 피칭용인가
   본데 제거하고 사선 기본으로"). 도록에서 볼 것은 **모델의 꼴**이고 그것은 사선 한 칸이
   가장 잘 보여 준다 — 평면은 위에서 눌러 높이를 지우고, 입체는 지도에 맞춘 각이라 도록
   에서는 오히려 낯설다. 고를 것이 하나뿐이면 버튼도 없는 편이 낫다.
   요잉(좌우 드래그)은 그대로 자유각이다 — 걷은 것은 피치뿐이다. */

/** 지금 화면이 넓은가 — 각도 칸 수가 이 값으로 갈린다(레이아웃만이 아니라 **그리는 수**가
 *  달라지므로 CSS가 아니라 여기서 가른다). */
function useWide(): boolean {
    const [wide, setWide] = useState(() =>
        typeof window === "undefined" ? true : window.matchMedia("(min-width: 900px)").matches);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia)
            return undefined;
        const mq = window.matchMedia("(min-width: 900px)");
        const read = (): void => setWide(mq.matches);
        read();
        mq.addEventListener("change", read);
        return () => mq.removeEventListener("change", read);
    }, []);
    return wide;
}

/** ★ 화면에 든 자리만 굽는다(계측: 안 그러면 첫 그림까지 **55.8초**) ────────────────
 *  도록 한 페이지는 유닛 53종 × 각도 8칸 = **424장**이다. ShapeIcon 한 장은 모델을
 *  실제로 굽는 일이라(면 수백 장을 짜고 투영한다) 장당 130ms쯤 든다 — 리액트가 그걸
 *  한 번에 다 그리므로 첫 화면이 1분 가까이 안 뜬다. 어느 기기에서도 못 쓴다.
 *  그래서 항목마다 **제 자리가 화면 가까이 올 때** 각도 칸을 짓는다. 이름 줄은 늘
 *  그리므로 목록·차례·고르기는 처음부터 다 보이고, 굽는 것만 미룬다. 한 번 뜬 자리는
 *  다시 안 접는다(스크롤을 되돌릴 때마다 다시 굽는 것이 더 나쁘다).
 *  여유(rootMargin)를 한 화면 넉넉히 두어, 굽는 동안이 스크롤보다 앞선다. */
function useNear<T extends Element>(): [React.RefObject<T>, boolean] {
    const ref = useRef<T>(null);
    const [near, setNear] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || near)
            return undefined;
        if (typeof IntersectionObserver === "undefined") {
            setNear(true);
            return undefined;
        }
        const io = new IntersectionObserver((es) => {
            if (es.some((e) => e.isIntersecting))
                setNear(true);
        }, { rootMargin: "600px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [near]);
    return [ref, near];
}

/** 흐르는 시각(초) — 모션 팝업이 열려 있는 동안만 돈다(닫히면 프레임을 안 먹는다). */
function useClock(on: boolean): number {
    const [t, setT] = useState(0);
    useEffect(() => {
        if (!on)
            return undefined;
        let raf = 0;
        const t0 = performance.now();
        const step = (): void => {
            setT((performance.now() - t0) / 1000);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [on]);
    return t;
}

/* ★★ **칸을 세우는 일은 이제 scplay 가 한다**(요청: "셀은 대기 - 이동/활성 - 공격 -
   액션/추가액션(럴커 땅파기 등) 이렇게 네 개로 하고 **하고 있는 셀만** 보여주기") ────────
   여기 있던 것 셋을 걷었다 — 유닛의 세 컷을 내던 `cutsAt`, 건물의 세 칸을 내던 `bldCells`,
   그리고 그 둘이 쓰던 칸 값 타입이다. 합쳐 90줄이 `scplay 의 docCellsOf9` 한 자리로 갔다.
   까닭은 그 함수의 ★★ 에 적혀 있다: 칸에 무엇을 놓을지는 **모델을 아는 쪽**이 정해야 한다
   (도는 걸음·불빛 박자·성큰의 사격 시계는 다 지도가 쓰는 숫자다). 도록이 제 표를 따로 들면
   모델을 고칠 때 두 곳을 맞춰야 하고, 실제로 그래서 코어 디스크가 쉬는 중에도 돌고 회전이
   지도의 5분의 1 걸음으로 끊겼다.
   이 화면에 남은 일은 **배치**뿐이다 — 받은 칸을 나란히 놓고, 트레이서가 있다는 칸에는
   그림 위에 한 발을 겹쳐 그린다. */

/** 모션 팝업 — idle·이동·액션 셋을 나란히(PC 가로 · 모바일 세로, 요청).
 *  요잉은 드래그로 자유롭게 돌린다(각도 제한 없음). 피치는 세 칸을 버튼으로 고른다. */
function MotionPopup({ item, onClose }: { item: ShapeGalleryItem; onClose: () => void }) {
    const wide = useWide();
    const t = useClock(true);
    /* 첫 각은 **그 갈래의 기준각**이다(galleryYawOf) — 건물은 지도에서 40도 한 각으로만
       서므로, 팝업을 열자마자 보이는 그림이 지도에서 보던 그 그림이라야 한다. */
    const [yaw, setYaw] = useState(() => galleryYawOf(45, item.group));
    const drag = useRef<{ x: number; y: number; yaw: number; on: boolean; id: number } | null>(null);
    /* ★ 창은 세 칸이 **하나**다(지적: "모션컷에 따라 모델 확대율이 달라짐") ───────────
       ShapeIcon의 fit은 그 컷의 잉크에 창을 맞추므로, 팔을 뻗는 액션 컷은 창이 넓어지며
       몸이 작아지고 대기 컷은 커진다 — 나란히 놓으면 셋의 배율이 제각각이다. scplay의
       shapeFitBox로 그 종류의 **모든 컷을 훑은 한 상자**를 얻어 세 칸에 같이 내린다.
       각(요잉)은 22.5도 칸으로 끊어 잰다 — 모델을 굽는 칸이 그 칸이라, 드래그 중에도
       상자가 이미 구운 면을 다시 훑을 뿐이라 거의 공짜다(그리고 상자가 매 프레임
       미세하게 떨지 않는다). */
    /* ★★ **창은 요잉에도 못 박는다**(2026-09, 요청: "도록 팝업창에서 요잉 시 크기(배율)가 커졌다
       작아졌다 하지 않게") — 여태 창을 **그 각의 잉크**에 맞추고 있었다(yawQ 마다 새 상자). 그런데
       실루엣의 폭은 각마다 다르다(길쭉한 몸은 정면 3칸 · 옆면 7칸) — 창이 거기 붙으면 돌릴 때마다
       배율이 따라 뛰어, 몸이 도는 것이 아니라 **몸이 커졌다 작아졌다** 한다.
       컷 셋을 한 창으로 묶은 것과 **같은 자**다(아래 shapeFitBox 주석) — 그 자를 요잉에도 편다:
       여덟 각을 훑어 **합집합 상자** 하나를 얻고 그것을 모든 각에 내린다. 그러면 창은 가장 넓은
       각에 맞춰져 있고, 돌리는 동안 바뀌는 것은 **모델의 꼴뿐**이다.
       ⚠ 이 손은 **여기서** 편다 — shapeFitBox 는 각 하나를 받는 자이고, 상자를 합치는 일은 그것이
         돌려주는 네 수(viewBox)만으로 된다. 굽기는 어차피 드래그 중에 한 번씩 지나갈 각들이라
         새로 드는 몫이 아니라 **앞당겨 치르는 몫**이다(팝업을 열 때 한 번, 종류마다 캐시).
       ⚠ 여덟이면 사이 각(22.5도 칸)에서 몇 %쯤 모자랄 수 있지만 여백(0.12)이 그것을 받는다 —
         열여섯으로 늘리면 여는 순간의 굽기가 두 배다. */
    /* ★★★ 창은 **칸마다 제 것**이다(2026-09, 요청: "각 셀별로 맞춤 배율로 해야 해 —
       트레이서도 있고 해서 · 다 동일하게 하지 말고") ────────────────────────────────────
       위 두 ★ 은 '같은 몸의 컷·각이 창을 흔들면 안 된다'는 말이었고 그것은 지금도 옳다.
       그런데 칸이 **딴 몸을 그리게 되면서**(변신 칸의 알·고치, 성큰의 사격 몸과 혓바닥)
       모두를 한 창에 묶는 것은 뜻이 달라진다 — 가장 큰 몸에 창이 맞춰지므로 작은 몸은
       칸 한가운데 점이 된다. 트레이서를 겹치는 칸도 마찬가지로 제 여백이 필요하다.
       그래서 **칸(라벨)마다** 창을 따로 잰다: 그 칸이 시각을 돌며 그릴 수 있는 종류를 다
       모아(몸 + 딸림 부품) 여덟 각의 합집합 상자를 낸다. 곧 한 칸 안에서는 창이 못 박혀
       있고(돌려도·컷이 바뀌어도 배율이 그대로), 칸끼리는 제 몸에 맞는 배율로 선다. */
    /* ★★ **창을 재는 일은 scplay 가 한다**(2026-09, 요청: "재생기의 로직을 그대로 가져와서
       보이게해줘 그래야 앞으로 두쪽 수정을 안할수 있어") ───────────────────────────────────
       여기 있던 90줄은 '그 칸이 무엇을 그리나'를 앱이 다시 헤아리는 셈이었다 — 그런데 그것을
       아는 것은 `docCellsOf9`(scplay)뿐이라, 칸에 무엇이 하나 늘 때마다 두 쪽을 맞춰야 했다
       (겹판을 더할 때 한 번 · 표적 인형을 더하며 또 한 번). 이제 `docCellBox9` 한 문이 낸다:
       칸마다 · 그 칸이 그릴 수 있는 것 전부(몸·딸림 부품·겹판·**표적**)의 여덟 각 합집합 ·
       치우친 것은 그 몫만큼 밀어서. 앱이 하는 일은 받은 표를 내려 주는 것뿐이다. */
    const boxOf = useMemo(() => docCellBox9(item.kind, item.group), [item.kind, item.group]);
    /* 자유 요잉 — 드래그한 픽셀을 그대로 도로 바꾼다(0.6도/px). 각을 안 죈다:
       요청이 "각도 제한 없이"이고, ShapeIcon은 어느 각이든 22.5도 칸으로 갈무리해 굽는다.
       ★ 부호는 **빼기**다(지적: "드래그 → 요잉 방향 반대로") — 손으로 만지는 것은 카메라가
         아니라 **몸**이라, 오른쪽으로 끌면 몸의 오른쪽 면이 나를 향해 돌아와야 한다. */
    /* ★ 세로 스크롤을 살려 둔다(지적: "세로 스크롤이 안됨") ────────────────────────────
       모바일에서는 세 칸이 세로로 쌓여 이 무대가 팝업의 거의 전부라, 여기서 스크롤이
       안 먹으면 창을 아예 못 내린다. 원인은 둘이었다 — CSS의 touch-action: none(브라우저
       스크롤을 통째로 끈다. 이제 pan-y다)과, **누르자마자** 포인터를 잡아채던 이 함수다.
       이제 가로로 6px 넘게, 그리고 세로보다 많이 움직였을 때만 잡아 돌린다. 세로가 먼저
       이기면 손을 떼어(잡지 않았으므로 브라우저가 그대로 스크롤한다) 그 손짓은 스크롤이다. */
    /* ★ **자동 요잉**(요청: "도록 팝업창 모델명 옆에 자동 요잉 버튼 추가 — 부드럽게 요잉하기") —
       각을 프레임마다 **벽시계 몫만큼** 올린다(초당 36도 = 한 바퀴 10초). 프레임 수로 올리면
       기기마다 도는 속도가 달라진다. 손으로 잡는 순간 멈춘다 — 끌던 각과 도는 각이 싸우면
       손짓이 미끄러진다. */
    // 기본은 **켬**(2026-09, 요청: "도록 팝업 자동회전을 기본으로") — 손이 잡으면 그때 멈춘다.
    const [auto, setAuto] = useState(true);
    useEffect(() => {
        if (!auto)
            return undefined;
        let raf = 0;
        let last = performance.now();
        const step = (): void => {
            const now = performance.now();
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            setYaw((y) => y + dt * 36);
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [auto]);
    const SLOP = 6;
    const onDown = (e: React.PointerEvent): void => {
        drag.current = { x: e.clientX, y: e.clientY, yaw, on: false, id: e.pointerId };
    };
    const onMove = (e: React.PointerEvent): void => {
        const d = drag.current;
        if (!d)
            return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.on) {
            if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {   // 세로가 이겼다 — 스크롤에 넘긴다
                drag.current = null;
                return;
            }
            if (Math.abs(dx) <= SLOP)
                return;
            d.on = true;
            setAuto(false);   // 손이 잡으면 자동 요잉은 비킨다
            (e.currentTarget as HTMLElement).setPointerCapture(d.id);
        }
        setYaw(d.yaw - dx * 0.6);
    };
    const onUp = (): void => { drag.current = null; };
    /* ★ **쓸어내려 닫기**(2026-09, 요청: "모바일에서 팝업 쓸어내려 닫기 구현") — 손가락(터치)으로 팝업 상자를
       아래로 끌면 상자가 따라 내려오다가 문턱(SWIPE_CLOSE)을 넘으면 닫힌다. 요잉 끌기(무대의 onMove)는 가로가
       이길 때만 포인터를 잡으므로 세로 손짓은 여기로 흘러온다. 상자 안이 굴러 있으면(scrollTop > 0) 그 손짓은
       스크롤이라 안 잡는다 — 맨 위에서 더 내리는 손짓만 '닫기'다. 마우스는 안 건다(pointerType 터치만). */
    const SWIPE_CLOSE = 110;
    const swipe = useRef<{ y: number; x: number; id: number; on: boolean } | null>(null);
    const [pull, setPull] = useState(0);
    const onSwipeDown = (e: React.PointerEvent<HTMLDivElement>): void => {
        if (e.pointerType !== "touch") return;
        if (e.currentTarget.scrollTop > 0) return;
        swipe.current = { y: e.clientY, x: e.clientX, id: e.pointerId, on: false };
    };
    const onSwipeMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        const sw = swipe.current;
        if (!sw) return;
        const dy = e.clientY - sw.y; const dx = e.clientX - sw.x;
        if (!sw.on) {
            if (Math.abs(dx) > SLOP && Math.abs(dx) >= Math.abs(dy)) { swipe.current = null; return; }   // 가로 — 요잉의 몫
            if (dy <= SLOP) return;
            sw.on = true;
        }
        setPull(Math.max(0, dy));
    };
    const onSwipeEnd = (): void => {
        const sw = swipe.current;
        swipe.current = null;
        if (sw?.on && pull >= SWIPE_CLOSE) { onClose(); return; }
        setPull(0);
    };
    /* ★★ **굴릴 것이 있는 팝업에서는 브라우저가 손짓을 가로챈다**(2026-09, 지적: "도록 팝업 스크롤 있으면 아래로
       쓸어서 닫기 안 됨") — 상자에 `touch-action: pan-y` 가 걸려 있어 내용이 상자보다 길면 세로 손짓은 **브라우저의
       스크롤**이 되고, 스크롤이 시작되는 순간 pointercancel 이 와서 위 onSwipeMove 가 다시는 안 불린다(맨 위에서
       더 내리는 손짓도 '스크롤 시도'라 같은 길로 죽는다). 내용이 짧으면 굴릴 것이 없어 브라우저가 손을 안 대므로
       거기서만 닫기가 됐다. 그래서 **맨 위에서 아래로 끄는 첫 touchmove 를 non-passive 로 잡아 기본 동작을 끊는다**
       — 그러면 브라우저가 스크롤을 안 시작하고 포인터 사건이 계속 와서 종전 손잡이가 그대로 돈다. 위로 끄는
       손짓(내용 스크롤)과 굴러 있는 상태는 안 건드린다(터치만 · 마우스 휠은 무관). */
    const boxRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = boxRef.current;
        if (!el) return undefined;
        let st: { y: number; x: number; top: boolean; on: boolean } | null = null;
        const onTS = (e: TouchEvent): void => {
            const t = e.touches[0];
            if (!t || e.touches.length !== 1) { st = null; return; }
            st = { y: t.clientY, x: t.clientX, top: el.scrollTop <= 0, on: false };
        };
        const onTM = (e: TouchEvent): void => {
            if (!st) return;
            const t = e.touches[0];
            if (!t) return;
            const dy = t.clientY - st.y; const dx = t.clientX - st.x;
            if (!st.on) {
                if (!st.top) { st = null; return; }
                if (Math.abs(dx) > SLOP && Math.abs(dx) >= Math.abs(dy)) { st = null; return; }   // 가로 — 요잉의 몫
                if (dy <= SLOP) return;   // 위로(내용 스크롤)거나 아직 모른다
                st.on = true;
            }
            if (e.cancelable) e.preventDefault();
        };
        const onTE = (): void => { st = null; };
        el.addEventListener("touchstart", onTS, { passive: true });
        el.addEventListener("touchmove", onTM, { passive: false });
        el.addEventListener("touchend", onTE);
        el.addEventListener("touchcancel", onTE);
        return () => {
            el.removeEventListener("touchstart", onTS);
            el.removeEventListener("touchmove", onTM);
            el.removeEventListener("touchend", onTE);
            el.removeEventListener("touchcancel", onTE);
        };
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    /* ★★ **`overscroll-behavior: contain` 은 굴릴 것이 있을 때만 먹는다**(2026-09, 지적: "도록에서
       스크롤 없는 경우 뒤로 세로 스크롤 아직 전파됨") — 팝업 상자에 그 자를 걸어 두었지만, 그것은
       **스크롤 포트**의 성질이라 내용이 상자 안에 다 들어와 굴릴 몫이 0 이면 브라우저가 애초에 그
       상자를 건너뛰고 문서를 굴린다(덮개 .scr-doc-pop 은 overflow 가 visible 이라 포트도 아니다).
       곧 '끝까지 굴렸을 때의 넘김'은 막혔지만 '처음부터 굴릴 게 없는' 자리는 안 막힌 것이다.
       그 자리는 CSS 로 못 막으므로 **문서 스크롤을 잠근다** — 팝업이 화면을 다 덮는 동안 뒤가
       굴러갈 까닭이 없다. 휠·터치·키보드 어느 길이든 한 번에 막힌다.
       ⚠ 자리는 안 튄다 — :root 에 `scrollbar-gutter: stable` 이 걸려 있어 막대가 사라져도 폭이
         안 바뀌고, 스크롤 자리(scrollY)는 그대로 남는다. */
    useEffect(() => {
        const el = document.documentElement; const bd = document.body;
        const pe = el.style.overflow; const pb = bd.style.overflow;
        el.style.overflow = "hidden"; bd.style.overflow = "hidden";
        return () => { el.style.overflow = pe; bd.style.overflow = pb; };
    }, []);
    /* 칸은 scplay 가 세운다(위 ★★) — 대기 · 이동/활성 · 공격 · 액션 넷 중 **있는 것만**
       온다. 여기서 하는 일은 그 값을 DocIcon9 에 그대로 내려 주는 것뿐이다. */
    const cells = docCellsOf9(item.kind, t, yaw);
    return (
        <div className="scr-doc-pop" role="dialog" aria-modal="true" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div
            ref={boxRef}
            className="scr-doc-popbox"
            style={pull > 0 ? { transform: `translateY(${pull}px)`, opacity: Math.max(0.35, 1 - pull / 400), transition: "none" } : undefined}
            onPointerDown={onSwipeDown}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeEnd}
            onPointerCancel={onSwipeEnd}
          >
            <header className="scr-doc-pophead">
              <h3>{item.label}</h3>
              <button
                type="button"
                className={`scr-doc-popspin${auto ? " is-on" : ""}`}
                onClick={() => setAuto((v) => !v)}
                aria-pressed={auto}
                title={auto ? "자동 회전 멈춤" : "자동 회전"}
              >
                <RotateCw size={13} />
                {auto ? "멈춤" : "자동 회전"}
              </button>
              <div className="scr-doc-popview">
                <button type="button" className="scr-doc-popclose" onClick={onClose} aria-label="닫기"><X size={16} /></button>
              </div>
            </header>
            <div
              className={`scr-doc-popstage${wide ? "" : " is-tall"}`}
              style={{ ["--cells" as string]: String(cells.length) }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {cells.map((c) => (
                <figure key={c.label} className="scr-doc-popcell">
                  {/* ★ 트레이서는 **겹쳐** 그린다(요청: "트레이서는 공격 셀에 같이 넣어야 함") —
                      제 칸으로 서던 때는 총알만 덩그러니 있어 무엇이 쏘는 것인지 안 보였다.
                      모델 위에 한 발을 얹으면 총구에서 나가는 그림이 된다. 그리는 붓은
                      지도와 같다(scplay 의 paintFxList9). */}
                  <div className="scr-doc-popart">
                    <DocIcon9
                      kind={c.kind ?? item.kind}
                      rotDeg={c.rotDeg ?? yaw}
                      pose={c.pose}
                      spin={c.spin}
                      headDeg={c.headDeg}
                      lit={c.lit}
                      blink={c.blink}
                      attach={c.attach}
                      attachRot={c.attachRot}
                      parts={c.parts}
                      flat
                      fit
                      fitBox={boxOf.get(c.label)}
                      className="scr-doc-svg"
                    />
                    {c.tracer && <DocTracer9
                      kind={item.kind}
                      t={t}
                      overlay
                      /* 창·요잉·겨눔을 그대로 넘긴다 — 트레이서가 그 칸의 모델 위 제 총구에
                         앉고, 돌리면 함께 돈다(scplay DocTracer9 의 ★★). */
                      box={boxOf.get(c.label)}
                      rotDeg={c.rotDeg ?? yaw}
                      headDeg={c.headDeg ?? c.attachRot}
                      /* 그 칸이 그릴 갈래 — 지상·대공이 다른 종류는 칸마다 제 무기다(scplay docAtkFx9). */
                      fx={c.fx}
                      /* ★ 표적까지의 거리(16-상자 자) — 칸이 세운 인형이 앉은 그 자리이고,
                         줄기가 닿는 그 거리다(scplay DocCell9.tgt 의 ★★). */
                      tgt={c.tgt}
                      /* ★ 끝점을 발밑에서 몸 가운데(+뜬 높이)로 올리는 몫 — 지도의 foeBody9 와 같은 자(scplay docTgtUp9). */
                      tgtUp={c.tgtUp}
                      /* ★ 대공 칸인가 — 총구 앵커가 채널마다 갈리는 종류(레이스·골리앗·
                         스카우트)가 이 값으로 제 발사관을 고른다(scplay MUZZLE_AIR9). */
                      air={c.air}
                      className="scr-doc-shot"
                    />}
                  </div>
                  <figcaption>
                    {c.label}
                    {c.note && <span className="scr-doc-same">{c.note}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="scr-doc-pophint">좌우로 끌면 돌아갑니다 · 자동 회전 단추로 스스로 돌립니다{wide ? "" : " · 아래로 쓸어내리면 닫힙니다"}</p>
          </div>
        </div>
    );
}

/* ★ 창은 **잉크에 맞춘다**(fit) — 못 박은 32-상자를 썼다가 눈으로 보고 되돌린 자리다.
   32-상자는 지도가 쓰는 넓은 창이라, 그 안에서 마린의 잉크는 상자의 6분의 1이다:
   칸에 그리면 **점 하나**가 되어 무엇인지 안 보였다(첫 판 스크린샷이 그랬다).
   도록은 '어떻게 생겼나'를 보는 자리이므로 칸을 꽉 채우는 편이 옳다.
   ※ 대신 컷이 바뀌면 실루엣과 함께 창도 달라진다(scplay의 fitBox 주석이 적어 둔 그
     사고다). 정지 그림인 각도 줄에서는 칸마다 제 그림이라 뜻이 없지만, 모션 팝업은
     같은 모델의 세 컷을 나란히 놓는 자리라 그 흔들림이 곧 거짓말이었다(지적: "모션컷에
     따라 모델 확대율이 달라짐"). 거기서는 shapeFitBox로 컷들을 미리 훑어 **한 창**을
     못 박는다(MotionPopup의 fitBox). */

/** 한 항목 — 이름 줄과 각도 칸. 각도 칸은 자리가 화면 가까이 올 때 짓는다(위 useNear). */
function GalleryRow({ item, rots, wide, onMotion }: {
    item: ShapeGalleryItem; rots: number[]; wide: boolean; onMotion: () => void;
}) {
    const [ref, near] = useNear<HTMLElement>();
    return (
        <section ref={ref} className="scr-doc-item">
          <header className="scr-doc-itemhead">
            <h3>{item.label}</h3>
            {item.race && <span className="scr-doc-race">{item.race}</span>}
            <button type="button" className="scr-doc-motion" onClick={onMotion}>
              <Play size={12} />
              <span>모션 보기</span>
            </button>
          </header>
          <div className={`scr-doc-angles${wide ? "" : " is-narrow"}`}>
            {rots.map((deg) => (
              /* ★ 그림을 누르면 바로 팝업이다(2026-09, 요청: "도록에서 이미지 클릭 시 바로 팝업 뜨게") —
                 '모션 보기' 단추까지 손이 안 가도 되게 각도 칸 자체가 문이다. */
              <div key={deg} className="scr-doc-angle is-link" role="button" tabIndex={0} onClick={onMotion}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMotion(); } }}>
                {near
                  ? <DocIcon9 kind={item.kind} rotDeg={galleryYawOf(deg, item.group)} flat fit className="scr-doc-svg" />
                  /* 아직 안 구운 자리 — 다 구운 칸과 **같은 높이**를 차지해야 스크롤이
                     안 튄다(자리가 갑자기 늘면 보던 곳이 밀린다). */
                  : <div className="scr-doc-svg scr-doc-hold" aria-hidden />}
                <span>{galleryYawOf(deg, item.group)}°</span>
              </div>
            ))}
          </div>
        </section>
    );
}

/** 갈래 고르기 — 유닛·건물이 본 페이지이고, 그 밖은 **따로 한 페이지**다(요청).
 *  한 화면 안의 칸이지만 목록이 통째로 갈리고 종족 고르기도 새로 서므로, 사람에게는
 *  다른 페이지다. 주소에도 제 값이 실린다(?doc=aux). */
const GROUPS: { key: Group; label: string }[] = [
    { key: "유닛", label: "유닛" },
    { key: "건물", label: "건물" },
    { key: "부가", label: "그 밖의 모델" },
];

export default function ModelCatalog({ group, onGroup, onClose }: {
    group: Group; onGroup: (g: Group) => void; onClose?: () => void;
}) {
    const wide = useWide();
    const docRef = useRef<HTMLDivElement | null>(null);
    const [docW, setDocW] = useState(0);
    useLayoutEffect(() => {
      const el = docRef.current;
      if (!el) return;
      setDocW(el.clientWidth);
    }, []);
    const calPx = useMemo(() => (docW > 0 ? calTilePx(docW) : null), [docW]);
    const [race, setRace] = useState<RacePick>("전체");
    const [open, setOpen] = useState<ShapeGalleryItem | null>(null);
    const rots = wide ? ROTS_WIDE : ROTS_NARROW;
    const rows = useMemo(
        /* `hidden` 은 표에는 있되 목록에는 안 서는 종류다(요청: "성큰 발사·시즈모드 별도 목록
           없어도 되고") — 탱크의 액션 칸과 성큰의 공격 칸이 이미 그것을 보여 준다. 표에서
           지우지는 않는다(광택 표가 이 표로 종족을 찾는다 — scplay 의 그 ★). */
        () => SHAPE_GALLERY.filter((g) => !g.hidden && g.group === group && (race === "전체" || g.race === race)),
        [group, race],
    );
    /* 갈래를 갈아타면 종족 고르기를 되돌린다 — '부가'에는 프로토스가 하나뿐이라, 고른
       종족을 들고 넘어가면 빈 화면이 나온다. */
    useEffect(() => { setRace("전체"); }, [group]);
    return (
        <div className="scr-doc" ref={docRef}>
          <div className="scr-doc-picks">
            <div className="scr-doc-pickrow" role="group" aria-label="갈래">
              {GROUPS.map((g) => (
                <button type="button" key={g.key} className={g.key === group ? "is-on" : ""} onClick={() => onGroup(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="scr-doc-pickrow is-race" role="group" aria-label="종족">
              {(["전체", "테란", "프로토스", "저그"] as RacePick[]).map((r) => (
                <button type="button" key={r} className={r === race ? "is-on" : ""} onClick={() => setRace(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {rows.length === 0 && <p className="scr-doc-empty">해당하는 모델이 없습니다.</p>}
          {calPx !== null ? (
            /* 크기 보정 모드 — 격자 바닥(한 칸 = 한 타일) 위에 실제 크기·기준각 한 컷.
               기준각은 유닛 45도 · 건물 40도(지도의 BUILDING_BASE_YAW)다 — galleryYawOf. */
            <div className="scr-doc-list scr-doc-cal" style={{ ["--tile" as string]: `${calPx}px` }}>
              <p className="scr-doc-calnote">타일 {calPx.toFixed(1)}px · 12배 · 유닛 45° · 건물 40°</p>
              {rows.map((it) => {
                const px = shapeMapTiles(it.kind) * calPx;
                return (
                  <section key={it.kind} className="scr-doc-item scr-doc-calitem">
                    <header className="scr-doc-itemhead"><h3>{it.label}</h3>
                      <span className="scr-doc-race">{(px / calPx).toFixed(2)}타일</span></header>
                    <div className="scr-doc-calfloor">
                      <div className="scr-doc-calbox" style={{ width: px, height: px }}>
                        <DocIcon9 kind={it.kind} rotDeg={galleryYawOf(45, it.group)} flat className="scr-doc-svg scr-doc-calsvg" />
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
          <div className="scr-doc-list">
            {rows.map((it) => (
              <GalleryRow key={it.kind} item={it} rots={rots} wide={wide} onMotion={() => setOpen(it)} />
            ))}
          </div>
          )}
          {open && <MotionPopup item={open} onClose={() => setOpen(null)} />}
          {onClose && (
            <button type="button" className="scr-doc-back" onClick={onClose}>
              <ArrowLeft size={16} /><span>돌아가기</span>
            </button>
          )}
        </div>
    );
}
