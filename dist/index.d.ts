import { ComponentType } from 'react';
import { default as default_2 } from 'react';
import { JSX as JSX_2 } from 'react';
import { ReactNode } from 'react';

/** 공격 한 바퀴의 컷 — `ph`는 쿨다운 안의 위상(0~1)이다.
 *
 *  종류마다 결이 다르다: 질럿은 짧은 잽 둘, 다크는 크게 한 번, 고스트는 총을 꺼냈다
 *  넣는다. 나는 저그(flapHz)는 쏘지 않는 위상에 **기본 자세가 아니라 날갯짓**으로
 *  돌아간다 — 공중의 몸에게 기본 자세는 쉬는 것이 아니라 떨어지는 것이다. */
export declare function atkCutOf(kindMain: string, ph: number, flapHz?: number, t?: number): Pose9;

/** 공사 단계 수 — 3 → 5 → **10**(요청: "5단계가 아니라 10단계로 늘려도 되겠지").
 *  부품이 많은 건물일수록 칸이 적으면 한 칸에 몇 분의 일이 통째로 솟아 '자라는' 대신
 *  '툭 나타나는' 것으로 보인다. 낯 단위로 세우게 된 지금은 칸이 많을수록 곱게 자란다.
 *  ⚠ 값이 메시 열쇠(b:종류:단계:…)에 드는 자라, 짓는 중인 건물 한 채가 쥘 수 있는 벌 수도
 *    이만큼이다 — 다 지으면 그 열쇠는 안 쓰이고 LRU 가 걷어 간다. */
export declare const BUILD_STAGES = 10;

/** 이미 받아 둔 격자 — **훅 밖에서** 한 값만 읽어야 할 때 쓴다(목록의 알약이 대표맵
 *  이름을 쓴다). 아직 안 받았으면 null이다: 부르는 쪽은 목록 렌더 함수라 여기서 조회를
 *  걸 수 없다(그 자리에서 훅을 부를 수 없고, 목록은 이미 primeReplayMaps로 다 받아 둔다). */
export declare function cachedReplayMap(hash: string | null | undefined): ReplayMapGrid | null;

/** ★ **자동 중계**를 뜻하는 `&tr=` 의 값(2026-09, 요청: "중계는 자동이든 한사람이든 사용중이면 좌표, 배율 공유안하고
 *  대신 중계 파라미터 공유하기로 변경") — 그 표(playbackTrackOf)는 이제 '카메라를 누가 쥐고 있나'다: 사람이면
 *  그 아이디, 자동 중계면 이 글자. 게임 아이디로는 못 쓰는 글자라 사람과 안 겹치고, URLSearchParams 가
 *  안 감싸는(escape) 글자라 링크에 그대로 `&tr=*` 로 선다. 받는 쪽(initialTrack)이 이 값을 보면 개인 추적이
 *  아니라 중계를 켠 채로 연다. 이 글자를 쓰는 자리는 이 파일뿐이다(짓는 sceneLinkQueryOf9 · 받는 sceneLink prop) —
 *  앱은 링크를 만지지 않으므로(아래 ★★) 값을 바꿔도 여기 한 곳이다. */
export declare const CAST_AUTO_LINK9 = "*";

/** 그 종류가 **무엇으로 움직이나** — 도록이 칸을 세울지 말지 이것으로 가른다. */
export declare type DocAnim9 = {
    /** 회전 칸(spin)이 그림을 바꾸나 — 서플라이 팬·코어 원반·포지 톱니·머신샵 톱니·성큰 혀의 뻗는 컷. */
    spin: boolean;
    /** ★ **일할 때만 도나**(2026-09, 지적: "코어 대기중엔 디스크 돌면 안 되고") — 지도는 도는
     *  부품을 둘로 가른다: 서플라이 환풍팬은 건물이 서 있는 한 늘 돌고(설비), 포지 톱니·코어
     *  플라즈마 디스크·머신샵 톱니는 **연구 중에만** 돈다(일). 도록이 이 칸을 안 보면 쉬는
     *  코어의 디스크까지 돌아, 그 회전이 '지금 업그레이드 중'이라는 신호가 못 된다. */
    spinWork: boolean;
    /** 포탑 각(headDeg)이 그림을 바꾸나 — 터렛·포토·성큰(쏘는 몸). 주면 '겨누는 중'이 함께 선다. */
    head: boolean;
    /** 불빛 컷(lit)이 있나 — 생산·연구·가스 채취·벙커 사격. */
    lit: boolean;
    /** 건설 단계(stage)를 깎을 수 있나 — 건물이면 참(발판 두 채가 함께 선다). */
    stage: boolean;
    /** 요잉 자체가 그 모델의 움직임인가 — 핵탄두는 떨어지며 두 바퀴 돈다. */
    yawSpin: boolean;
    /** 자세 컷(pose)을 가진 종류인가 — 유닛의 걸음·공격이 그것이다(poseCutsOf 가 자세히 안다). */
    pose: boolean;
    /** **변신 차례** — 이 종류가 무엇을 거쳐 무엇이 되나(DOC_MORPH9 의 ★). 없으면 안 바뀐다. */
    morph?: string[];
};

export declare function docAnimOf9(kind: string): DocAnim9;

/** 도록 한 칸 — 그릴 종류와 그 칸이 내려 줄 값들(DocIcon9 의 프롭 그대로다). */
export declare type DocCell9 = {
    /** 칸 이름 — 대기 · 이동 · 활성 · 공격 · 액션. */
    label: string;
    /** 덧말(변신 컷 이름 · 낙하 회전) — 칸 이름 뒤에 붙는다. */
    note?: string;
    /** 그 칸이 그릴 종류 — 없으면 항목 제 종류(성큰의 사격 몸 · 변신 차례의 지금 컷). */
    kind?: string;
    /** 딸림 부품(성큰 혓바닥). */ attach?: string;
    /** 그 부품만의 절대 요잉(도). */ attachRot?: number;
    /** ★★ **겹쳐 그리는 판들**(2026-09, 요청: "탱크 변신 장면을 재생기와 똑같이 애니메이션으로") —
     *  지도가 한 개체를 여러 판으로 그리는 동작(시즈 전환의 차체 + 버팀다리 둘 + 전환 포탑)은
     *  `attach` 한 자리로 못 담는다. 몸과 **같은 자리·같은 창**에 차례로 얹고, 각자 제 자세·요잉을 쥔다.
     *  ⚠ 도록(앱)은 칸의 창을 '그 칸이 그릴 수 있는 종류'의 합집합으로 재므로 **이 목록도 그 셈에 넣어야**
     *    한다 — 안 넣으면 겹판이 창 밖으로 잘린다(GalleryScreen boxOf). */
    parts?: DocPart9[];
    pose?: Pose9;
    spin?: number;
    headDeg?: number;
    lit?: boolean;
    blink?: boolean;
    /** 그 칸만 요잉을 달리 쓸 때(핵탄두의 낙하 회전). */ rotDeg?: number;
    /** 트레이서 한 발을 **그 칸 위에 겹쳐** 그리나(요청: "트레이서는 공격 셀에 같이 넣어야함"). */
    tracer?: boolean;
    /** ★ 그 칸이 그릴 **트레이서 갈래**(2026-09, 요청: 지상·대공이 다른 종류는 두 칸) —
     *  안 주면 그 종류의 기본(docWeaponOf9)이다. */
    fx?: string;
    /** ★★ **총구에서 표적까지의 거리**(16-상자 자) — 2026-09 에 열었다(표적 인형).
     *  `parts` 의 마지막에 선 인형이 앉은 그 자리이고, `DocTracer9` 의 줄기가 닿는 그 거리다.
     *  **한 자리에서 셈해 둘이 나눠 쓴다** — 따로 재면 줄기 끝과 인형이 조용히 어긋난다. */
    tgt?: number;
    /** ★ 줄기 끝을 발밑에서 **몸 가운데**(+ 공중이면 뜬 높이)로 올리는 몫(16-상자 자) — `docTgtUp9`. */
    tgtUp?: number;
    /** ★ **대공 무기의 칸인가**(2026-09, 요청: "지대공 지대지 트레이서 시작점을 분리해서
     *  가지고 있어야 해") — 총구 앵커가 채널마다 갈리므로(engine9 `MUZZLE_AIR9`) 줄기를
     *  그리는 자도 이 칸이 어느 무기인지 알아야 한다. 표적 인형도 이 값으로 갈린다. */
    air?: boolean;
};

/** ★★ **칸의 창은 scplay 가 잰다**(2026-09, 요청: "재생기의 로직을 그대로 가져와서 보이게
 *  해줘 그래야 앞으로 두쪽 수정을 안할수 있어 트레이서 위치나 크기 거리 등 모두 / 모든
 *  요소들이 셀에 들어가게 스케일 조정해주고") ─────────────────────────────────────────────
 *  여태 이 셈은 **앱(GalleryScreen boxOf)** 에 있었다. 칸이 무엇을 그리는지 알아야 창을 재는데
 *  그것을 아는 것은 `docCellsOf9`(여기)이므로, 칸에 무엇이 하나 늘 때마다 **두 쪽을 맞춰야**
 *  했다(겹판을 더할 때 한 번, 표적을 더하며 또 한 번 — 앱 쪽 ★ 주석이 그 자취다).
 *  이제 여기서 낸다. 앱은 `docCellBox9(kind, group)` 를 부르고 받은 표를 내려 주기만 한다.
 *  자는 종전과 같다:
 *    · 칸(라벨)마다 따로 — 한 창으로 묶으면 가장 큰 몸에 맞춰져 작은 몸이 점이 된다.
 *    · 그 칸이 **시각을 돌며 그릴 수 있는 것 전부**(몸 · 딸림 부품 · 겹판 · 표적)의 여덟 각 합집합.
 *    · 트레이서를 겹치는 칸은 한 뼘 넓힌다 — 단, **표적이 선 칸은 안 넓힌다**(그 칸의 창은
 *      이미 표적까지를 아우르므로, 더 넓히면 몸만 작아진다).
 *  ⚠ **치우친 것(표적)은 그 몫만큼 밀어서 잰다** — gl9 아이콘의 그 ⚠와 같은 자리다. */
export declare function docCellBox9(kind: string, group?: string): Map<string, string | undefined>;

export declare function docCellsOf9(kind: string, t: number, yaw: number): DocCell9[];

/** 도록 아이콘 — GL 붓이 켜져 있으면(GL_ON9 · `gl` 로 못 박음) **화면과 같은 메시 그림**(<canvas>, gl9.glIconRequest9 가 한 프레임의 청을 모아
 *  한 번에 그려 제 칸을 곧장 찍어 준다)이고, 아니면(폰·`#gl=0`·입체 보기·GL 못 섬·메시 못 지음) ShapeIcon(SVG, 2D 면) 그대로다. 프롭·창 규약(fit·fitPad·fitBox·
 *  wide·pose·spin)은 ShapeIcon 과 같다 — 도록(GalleryScreen·doc-sheet)이 이것을 쓰면 키값·마주 봄 판정 같은 2D 전용 어긋남 없이
 *  지도가 그리는 그 그림을 본다. 색은 요소의 currentColor(도록의 --scr-doc-own)다. */
export declare function DocIcon9({ kind, rotDeg, pose, spin, headDeg, lit, stage, blink, attach, attachRot, parts, flat, fit, fitPad, fitBox, wide, className, gl, tint, }: {
    kind: string;
    rotDeg?: number;
    pose?: Pose9;
    spin?: number;
    flat?: boolean;
    fit?: boolean;
    fitPad?: number;
    fitBox?: string;
    wide?: boolean;
    className?: string;
    /** 포탑 각(절대 도) — 터렛·포토·성큰만 그림이 바뀌고, 주면 '겨누는 중'이 함께 선다. */
    headDeg?: number;
    /** 창·속심의 불빛 — 생산·연구·가스 채취·벙커 사격의 그 컷. */
    lit?: boolean;
    /** 건설 단계 1~BUILD_STAGES−1(0·없음이면 완성) — 발판 두 채가 서고 몸이 그만큼만 자란다. */
    stage?: number;
    /** 발판 경광등의 깜빡임. */
    blink?: boolean;
    /** 딸림 부품(터렛 포탑부·성큰 혓바닥) — 한 벌 더 그린다. */
    attach?: string;
    /** 그 부품만의 절대 요잉(도) — 안 주면 몸의 요잉을 탄다. */
    attachRot?: number;
    /** 한 칸에 겹쳐 그리는 판들(DocCell9.parts) — 지도가 한 개체를 여러 판으로 그리는 동작이 이 자다. */
    parts?: DocPart9[];
    /** GL 로 그릴지 못 박기(안 주면 GL_ON9). */ gl?: boolean;
    /** ★ 한 색 실루엣(2026-09, 요청: 하단 인포창 아이콘 — "실루엣") — 주면 그 색 한 가지로 물들인다. 밝기(명암)는 남기고
     *  색만 갈아 끼운다(캔버스 합성 'color' — 원작 와이어프레임처럼 체력색 한 벌이되 디테일은 읽힌다). */
    tint?: string;
}): default_2.JSX.Element;

/** 한 칸에 겹쳐 그리는 판 하나 — 지도가 한 개체를 여러 판으로 그리는 그 자다(차체·버팀다리·포탑). */
declare type DocPart9 = {
    kind: string;
    pose?: Pose9;
    rotDeg?: number;
    /** ★ 뜬 높이(16-상자 자) — `dy` 에 이미 뺀 값이고, 창(docCellBox9)이 땅의 원을 이 몫만큼 올려 아우르는 데 쓴다. */
    up?: number;
    /** ★★ **칸 안에서 옮겨 앉히는 몫**(16-상자 자 · 화면 방향 · y 는 아래가 +) — 2026-09 에
     *  열었다(요청: "도록 공격신에 가상의 타겟을 세워줘"). 여태 겹판은 몸과 **같은 자리**에만
     *  앉을 수 있었는데(시즈 전환의 다리·포탑), 표적은 **사거리만큼 떨어진 자리**에 서야 한다.
     *  ⚠ 자는 트레이서와 **같다** — `DocTracer9` 가 총구에서 표적까지 재는 그 (ux, uy)·그 거리다.
     *    그래서 줄기의 끝과 인형이 한 점에서 만난다(따로 셈하면 조용히 어긋난다).
     *  ⚠ **2D 폴백(`#gl=0`·폰)에는 치우침이 없다** — 그 길은 구운 면의 경로를 이어 붙이는
     *    자라 판을 옮길 자리가 없다. 거기서는 표적이 안 서고 쏘는 몸만 선다(줄기는 그대로
     *    제 사거리까지 뻗는다). 마주 봄 판정·방향광과 같은 갈래의 폴백 차이다. */
    dx?: number;
    dy?: number;
    /** ★ **그 판만의 배율**(2026-09, 요청: "캐리어·리버 … 게임 중의 한 장면처럼") — 아이콘은 판을 다 같은 k 로
     *  그리는데, 인터셉터·스캐럽의 16-상자는 캐리어·리버의 것과 자가 다르다(지도는 종류마다 타일 수 × MODEL_NORM 을
     *  곱한다). 그 비(`docPartK9`)를 여기 실으면 겹판이 **지도에서의 크기 비** 그대로 선다. 안 주면 1. */
    k?: number;
    /** ★ **건물 길로 굽는다**(2026-09, 애드온 부착 칸의 본 건물·통로) — 안 주면 유닛 길(unitMesh)이다.
     *  건물은 회전 칸·불빛 깃발을 세워야 하므로 그리는 문이 통째로 다르다(gl9 partMesh9). */
    bld?: boolean;
    /** 그 겹판의 회전 칸 — 통로(addonlink)는 이 칸이 곧 **길이**다(engine9 linkLenOf9). */
    spin?: number;
    /** 그 겹판의 창·속심 불빛. */
    lit?: boolean;
    /** ★ **몸보다 뒤에 선다** — 칸의 앞뒤는 미는 차례가 가르므로(gl9 aOrd · 2D 는 화가 차례),
     *  땅에서 몸보다 먼 겹판은 몸보다 **먼저** 그려야 한다(애드온 부착 칸의 뒤쪽 건물). */
    back?: boolean;
};

/** ★ **도록의 트레이서 칸**(2026-09, 요청: "그리고 트레이서는 못그려주나? 도록에") ──────
 *  지도와 **같은 붓**으로 한 발을 그린다(paintFxList9 — 그 함수의 ★ 에 왜 떼어냈는지가 있다).
 *  칸 왼아래가 총구, 오른위가 표적이고 그 사이를 한 발이 지난다: 화면 자 셈(zx·zy)을
 *  '분수 0 이 총구 · 1 이 표적'으로 주면 트레이서도 피격도 제자리에 앉는다.
 *  배율은 8(PC 지도의 흔한 자)로 못 박는다 — 갈래표의 값이 렌즈 px 상수라, 배율이 곧
 *  그 굵기·길이의 자다.
 *  ⚠ 날아가는 무기(PROJECTILE_FX)는 `shot`(진행률 u), 즉발은 `beam`(제자리 번쩍임)이다 —
 *    지도가 가르는 그 자리와 같은 명단을 쓴다. 쏘는 쪽에 아무것도 안 그리는 무기
 *    (커세어 플레어 · NO_BEAM_FX)는 **표적 그림이 전부**이므로 hit 만 낸다. */
export declare function DocTracer9({ kind, t, className, overlay, box, rotDeg, headDeg, tgt, tgtUp, air, fx: fxProp }: {
    kind: string;
    t: number;
    className?: string;
    /** ★ 그릴 갈래를 못 박을 때(요청: 지상·대공 두 칸) — 안 주면 그 종류의 기본이다.
     *  ⚠ 이름을 `style` 로 두지 않는다 — 리액트에서 그 이름은 CSS 를 뜻해 읽는 사람이 헷갈린다. */
    fx?: string;
    /** ★ **공격 칸 위에 겹쳐 그리나**(2026-09, 요청: "트레이서는 공격 셀에 같이 넣어야함"). */
    overlay?: boolean;
    /** ★★ **그 칸의 창**(fitBox "x y w h") — 주면 트레이서가 **모델에 붙는다**(아래 ★★).
     *  안 주면 옛 자리(칸 왼아래 → 오른위)로 물러난다. */
    box?: string;
    /** 모델의 요잉(도) — 총알이 **그 방향으로** 나간다(요청: "회전하면 트레이서도 회전"). */
    rotDeg?: number;
    /** 겨누는 포탑의 절대 각(터렛·포토·성큰) — 있으면 몸이 아니라 이 각이 쏘는 쪽이다. */
    headDeg?: number;
    /** ★ **대공 무기의 칸인가** — 총구 앵커·갈래가 그 채널의 것이다(engine9 MUZZLE_AIR9). */
    /** ★ **대공 채널인가** — 총구 앵커가 갈리는 종류(레이스·골리앗·스카우트)는 이 값으로
     *  제 발사관을 고른다(engine9 `MUZZLE_AIR9`). 칸이 `DocCell9.air` 로 준다. */
    air?: boolean;
    /** ★★ **표적까지의 거리**(16-상자 자 · `DocCell9.tgt`) — 2026-09 에 열었다(표적 인형).
     *  주면 줄기가 **그 거리까지만** 간다(곧 지도의 사거리다). 안 주면 옛 자리(칸 가장자리까지)로
     *  물러난다 — 표적이 없는 칸(야마토 같은 액션 칸)이 그 길이다. */
    tgt?: number;
    /** ★ 끝점을 표적 발밑에서 **몸 가운데**로 올리는 몫(16-상자 자 · `DocCell9.tgtUp`) — 지도의 foeBody9 + 뜬 높이. */
    tgtUp?: number;
}): default_2.JSX.Element | null;

/** 그 모델이 쏘는 트레이서 갈래(FX_BEAM 의 이름) — 없으면 null(근접·일꾼·건물 대부분). */
export declare function docWeaponOf9(kind: string): string | null;

export declare function flapCutOf(hz: number, t: number): 1 | 3 | 4;

/** 도록의 **방위 눈금**을 그 갈래의 기준각으로 옮긴다(요청: "도록은 45도 단위인데 건물은
 *  40도라 어떡하지") ────────────────────────────────────────────────────────────────
 *  건물은 지도에서 각이 하나뿐(BUILDING_BASE_YAW)이므로, 도록의 네·여덟 방위는 그 각을
 *  90도(혹은 45도)씩 돌린 것이라야 "도록에서 본 그 면"이 지도에서 그대로 나온다. 45 눈금을
 *  그대로 쓰면 건물만 5도 어긋나 앞면이 지도와 미묘하게 다른 각으로 선다. 유닛은 제 방향이
 *  자유로우니 45 눈금 그대로다. 옮긴 각은 yawBucket9가 죄지 않고 지난다(그 함수의 ★). */
export declare const galleryYawOf: (deg: number, group?: string) => number;

/** ★ **게임 색인 한 줄**(사건 한 건 · 합치지 않는다) — 사이트 게임 검색이 담는 꼴. 사람은 참값 이름(raw — 앱의 슬롯 rawName).
 *  kind: unit 유닛 · building 건물 · upgrade 연구·업그레이드 · skill 마법·핵 · tactic 전술(공격 · 견제 · 포토러시 · 몰래 배럭 …).
 *  term = 대상의 한글 이름(전술은 낱말 그대로) · key = 영문 원 이름(BW 종류·기술 이름 · 전술은 "") · act = 행위(생산 · 건설 · 개발 · 사용 · 활약 · 장전 · 투하 · 시즈 모드 ·
 *  시즈 해제 · 클로킹 · 띄움 · 전술은 "") · attr = 덧붙임(본진 몇 번째 · 업그레이드 단계 · 활약 킬 수 · 없으면 "").
 *  공격·견제는 term "공격"/"견제"에 주인(owner)·타겟(target)을 단다 — "A 공격함" = owner A · "B 공격당함" = target B. */
export declare type GameIndexKind9 = "unit" | "building" | "upgrade" | "skill" | "tactic";

/** 참값 자취(OBWT · base64 — 재생기가 받는 motion 그대로) → 그 판의 색인 줄. 자취를 못 풀면 null(줄 없음과 가른다). */
export declare function gameIndexOf9(motion: string, opts: GameIndexOpts9): Promise<GameIndexRow9[] | null>;

export declare type GameIndexOpts9 = {
    /** 그 판의 맵 — 자원 점(앞마당 가름) · 크기(센터) · 참값 지형(언덕탱·입구). 없으면 그 판정만 빠진다. */
    grid?: Pick<ReplayMapGrid, "width" | "height" | "resources" | "terrain"> | null;
    /** 경기 길이(초). */
    endSec: number;
    /** 경기 채팅 — 재생기가 받는 꼴 그대로. */
    chats?: readonly {
        sec: number;
        name: string;
        text: string;
    }[];
    /** 로스터(참값 이름) — 이 사람들만 색인에 든다. */
    only: readonly string[];
    /** 관전자 등 뺄 이름. */
    skip?: readonly string[];
    /** 이름 → 팀(팀전) — 밀리면 안 준다. */
    teamOf?: Readonly<Record<string, number | undefined>>;
};

export declare type GameIndexRow9 = {
    sec: number;
    owner: string | null;
    target: string | null;
    kind: GameIndexKind9;
    term: string;
    key: string;
    act: string;
    attr: string;
};

declare type Group = ModelCatalogGroup;

export declare interface MinimapMarker {
    /** 리플레이 원본 게임 아이디 — 목록 키로도 쓴다. */
    key: string;
    /** 화면에 보일 이름. */
    name: string;
    avatar: string | null;
    memberId: string;
    /** ""는 screp이 종족을 못 읽은 드문 경우 — RaceBadge가 그대로 받아 빈칸으로 그린다. */
    race: Race | "";
    /** 그 사람의 **개인색**(#rrggbb) — 앱이 리플레이를 파싱해 넘긴다(screp의 Color.RGB).
     *
     *  왜 이 값이 따로 필요한가: 재생기의 개인색은 원래 참값 뭉치(OBWT)에서만 왔는데,
     *  그쪽은 색을 리마스터 리플레이의 **CCLR 구획**에서 읽는다. 2010년 이전(1.16 이하)
     *  리플레이에는 그 구획이 아예 없어 '색 아님'으로 오고(openbwTracks의 0xffffffff 주석),
     *  그러면 여덟 명이 팀 두 색으로 뭉개졌다. screp은 그 길로 안 간다 — 사람 구조에 남은
     *  색 번호(Color.ID 0~7)를 표준 팔레트로 푼다. SC:R 인게임이 색을 내는 길과 같다.
     *  그래서 참값에 색이 없을 때 이 값이 답이 된다.
     *
     *  안 주면(undefined) 종전대로 참값 → 팀색 순이다 — 이 칸은 보태는 자리지 뺏는
     *  자리가 아니다. */
    color?: string;
    /** 이 사람이 **관전자**인가 — 참이면 재생기가 통째로 안 그린다(요청: "관전자 자동 숨김
     *  기능 / 플레이어 로드시 기본적으로 관전자쪽 화면은 안 보이게 / 관전자는 로스터에서도
     *  제거").
     *
     *  왜 앱이 알려 주어야 하나: 참값 뭉치에도 사람마다 controller 바이트가 실려 오지만
     *  (openbwTracks의 로스터 꼴) 그 값의 뜻은 덤퍼 쪽에 있고 재생기는 여태 한 번도 안
     *  읽었다. '유닛이 하나도 없으면 관전자'로 어림할 수도 있지만, 그러면 자취가 늦게
     *  오는 동안 판단을 못 하고 시작하자마자 나간 사람까지 관전자로 몰린다.
     *  앱은 이미 리플레이를 파싱해 슬롯을 알고 있으니, 아는 쪽이 말하는 편이 옳다.
     *
     *  안 주면(undefined) 아무도 안 숨긴다 — 종전 동작 그대로다. */
    observer?: boolean;
    team: 1 | 2 | undefined;
    /** 타일 좌표. */
    x: number;
    y: number;
    /** 이름까지 함께 보일까 — 본진 표시는 이름을 단다(요청). */
    withName: boolean;
    /** 검색 중 짚어야 할 사람인가 — 로스터를 감춘 모바일에서는 여기가 유일한 표시 자리다. */
    highlight: boolean;
    /** 그 사람의 APM(리플레이 파싱 값, 경기 전체 평균) — 로스터 아래 지표 줄이 쓴다.
     *  수동 등록 경기는 null이라 그 칸을 아예 안 그린다. */
    apm?: number | null;
    /** 그 시점에 궤멸됐거나 빈사 상태인가 — 본진에 해골을 얹는다(요청). */
    downed?: boolean;
    /** 크게 다쳤지만 아직 끝난 건 아닌 상태(요청: 큰 타격·빈사는 해골 말고 반창고만) —
     *  해골과 같은 자리에 ❤️‍🩹만 얹고 아바타는 흑백으로 안 누른다. */
    hurt?: boolean;
    /** 지금 문장에 이름이 나온 사람인가 — 아바타를 크게 키운다(요청). */
    featured?: boolean;
    /** 버리고 떠난 옛 본진인가 — 흑백으로만 남긴다(요청: 본진을 버리고 이동한 경우 본진은
     *  흑백 처리하고 새 기지에 마크를 옮긴다). */
    ghost?: boolean;
    /** 본진에 붙일 이모지 — 화살표가 없는 이야기(생산·테크·경제)에 쓴다(요청: 생산에도 본진에
     *  열심히 생산하는 이모지). 자리는 markAt이 정한다 — 아바타 위가 아니다(요청). */
    mark?: string;
    /** 그 이모지를 얹을 자리(타일) — 본진이 아닌 곳에서 벌어진 일에 쓴다. 입구막기·입구
     *  방어가 그렇다: 그건 본진 안이 아니라 나가는 길목의 이야기라, 이모지도 진짜 입구
     *  자리에 서야 한다(지적: "입구도 본진 입구를 말한 거야 아바타 위가 아니라").
     *  본진에서 한 일이면 그 사람 본진 건물이 실제로 선 자리(요약의 hubs)가 들어온다.
     *  값이 없으면(옛 요약) 본진 자리(x, y) 그대로. */
    markAt?: [number, number];
    /** 그 이모지가 '무엇으로 한 일'인가 — 유닛·건물 이름을 이모지 밑에 적는다(요청: 방패
     *  이모지에도 캡션). 화살표가 있는 이야기는 기둥 위 이름표가 이 일을 하는데, 화살표
     *  없이 본진·입구에 이모지만 서는 이야기에는 그 자리가 없었다.
     *  목록으로 받아 한 줄에 하나씩 쌓는다(지적: 여러 건물이 한 줄에 붙어 보기 나쁘다) —
     *  화살표 기둥 이름표(arrow.label)가 이미 그렇게 하고 있어 규칙도 하나가 된다. */
    markText?: string[];
    /** 아바타 위에 겹쳐 그리는 상태 얼굴 — 트로피·공격자·당한 정도·아군 헬프처럼 그 사람
     *  자체를 가리키는 표시에 쓴다(요청: 해골·트로피 말고도 아바타로 상태를 알려 달라). */
    face?: string;
    /** face가 승리 트로피인가 — 다른 상태 얼굴과 달리 더 크고 계속 바운스한다(요청). */
    faceIsTrophy?: boolean;
    /** 그 판의 BEST PLAYER인가 — 승패 스냅에서만 세운다(요청: 결론 장면 아바타에 표시).
     *  이긴 편 전원이 트로피를 받는 자리라, 그중 한 사람을 가리키는 표시가 따로 필요하다. */
    best?: boolean;
    /** 시작 스냅인가 — 로스터 없이 "게임 시작!"만 보여주는 자리라, 닉네임 글자도 아바타만큼
     *  키운다(요청: 시작시 로스터 대신 아바타·닉네임 확대). */
    introBig?: boolean;
    /** 이 사람이 그 무렵 한 말 — 아바타 위에 말주머니로 띄운다(요청: 스냅으로 선정한 부근의
     *  채팅만 말주머니로). 양쪽이 다 본 말(전체챗)만 온다(요청: 팀챗 없애고 전체챗만). */
    bubble?: string;
    /** 그 시각까지 갖춘 규모(병력 + 건물 몫; 요약의 hp). 닉네임 밑 기세 눈금이 쓴다 —
     *  길이는 규모, 색은 같은 시각의 적정치에 견준 상태다(요청). 없으면 바를 안 그린다. */
    power?: number;
    /** 그 스냅의 시각(초) — 적정치가 시간에 비례해 오르므로 색을 정하려면 필요하다. */
    powerAtSec?: number;
}

/** 앱이 고르기 알약을 그릴 때 쓰는 표 — 갈래(차례·이름표)와 종족. 한 곳에 두어 앱마다 베끼지 않는다. */
export declare const MODEL_CATALOG_GROUPS: readonly {
    key: ModelCatalogGroup;
    label: string;
}[];

export declare const MODEL_CATALOG_RACES: readonly ModelCatalogRace[];

/** 갈래 고르기 — 유닛·건물이 본 페이지이고, 그 밖은 **따로 한 페이지**다(요청).
 *  한 화면 안의 칸이지만 목록이 통째로 갈리고 종족 고르기도 새로 서므로, 사람에게는
 *  다른 페이지다. 주소에도 제 값이 실린다(?doc=aux).
 *  ★ 고르기 알약(갈래·종족)은 **앱이 그린다**(2026-10, 요청: "도록의 종족 유형까지는 앱에서 만드는거야 파라미터만
 *    scplay에 던지는") — 앱마다 제 디자인 토큰(라이팅 테마 라디오 알약)이 있어 패키지가 그리면 앱과 꼴이 갈린다.
 *    여기는 `group`·`race` 값만 받아 목록을 거른다(race 를 안 주면 "전체"). 표는 위 MODEL_CATALOG_GROUPS·
 *    MODEL_CATALOG_RACES. 종족 상태도 앱 것이라 갈래를 갈아탈 때 되돌릴지 말지는 앱이 정한다(sg-web 은 안 되돌린다). */
export declare function ModelCatalog({ group, race, onClose }: {
    group: Group;
    race?: RacePick;
    onClose?: () => void;
}): JSX_2.Element;

export declare type ModelCatalogGroup = ShapeGalleryItem["group"];

/** 종족 고르기 값 — "전체"는 거르지 않음. 고르기 알약은 앱이 그린다(ModelCatalog 머리의 ★). */
export declare type ModelCatalogRace = "전체" | "테란" | "프로토스" | "저그";

/** 본진 로스터 한 사람 — 위치(x·y)는 이제 요약이 사라져 실려 오지 않을 수 있다.
 *  좌표가 없으면 지형 앵커·채굴 임자 어림 같은 위치 계산에서 조용히 빠진다. */
export declare type MotionBase = Omit<MinimapMarker, "x" | "y"> & {
    x?: number;
    y?: number;
};

/** ★ 확대 상한 — **바깥도 이 값을 본다**(지적: "z=12인데 8배로 나오는 버그") ──────────
 *  공유 링크를 읽는 쪽(GameResultStory)이 `Math.min(8, …)`으로 죄고 있었다. 8은 옛 사다리
 *  (1·2·4·8·16)의 잔재다 — 사다리를 1·2·3·6·12로 갈 때 재생기 안의 상한만 따라오고 링크를
 *  읽는 쪽은 안 따라와, 12배에서 공유한 장면이 받는 쪽에서 8배로 열렸다.
 *  DEEP_MIN_ZOOM이 8에 못 박혀 밀려 있던 것과 **같은 갈래의 흠**이다: 사다리에 매인 수를
 *  두 곳에 적으면 언젠가 한쪽만 고쳐진다. 값을 내보내 자를 하나로 둔다. */
export declare const PLAYBACK_ZOOM_MAX = 16;

/** 경기별 현재 재생 시각(요청: 특정 시간으로 카톡 공유) — 재생기가 제 clockKey로 지금
 *  t를 계속 적어 두면, 공유 버튼이 링크에 &t=로 실어 보낸다. */
export declare const playbackClockOf: Map<string, number>;

/** 경기별 **지금 배속**(요청: 공유 파라미터에 속도 추가) — 시각·자리와 같은 결이다:
 *  받는 쪽이 같은 장면을 보려면 '어디를'과 '언제'뿐 아니라 '얼마나 빠르게'도 같아야 한다.
 *  1배는 안 싣는다(기본값이라 주소만 길어진다 — &t=·&z=와 같은 규약). */
export declare const playbackSpeedOf: Map<string, number>;

/** 경기별 **지금 추적 중인 사람**(요청: "장면 공유·스크랩에 추적 파라미터 추가") —
 *  시각·자리·배속과 같은 결이다. 추적을 켜고 보낸 장면은 '그 사람을 따라가며 보는 장면'
 *  이라, 그것까지 실어야 받는 쪽이 같은 것을 본다. 값은 그 판에서 쓴 게임 아이디(raw)다 —
 *  회원 식별로 적으면 비회원·컴퓨터를 못 가리키고, 아이디를 바꾼 사람의 옛 판이 어긋난다.
 *  안 켜져 있으면 아예 안 담는다(지우고 나간다). */
export declare const playbackTrackOf: Map<string, string>;

/** ★ 자리(배율·가운데점)는 **카메라를 기계가 쥐고 있으면 안 싣는다**(2026-09, 요청: "중계 활성화상태에서 공유시
 *  위치 좌표 전송 금지" → 넓힘: "중계는 자동이든 한사람이든 사용중이면 좌표, 배율 공유안하고 대신 중계 파라미터
 *  공유하기로 변경") — 자동 중계든 개인 추적이든 그때의 카메라는 편성표·그 사람의 명령이 몰고 있어 '내가 보던
 *  자리'가 아니고, 받는 쪽도 첫 토막·첫 자국에서 그 자리를 덮어쓴다. 그때는 z·cx·cy 를 비우고(공유 버튼은
 *  없는 값을 안 싣는다) 각도(deg)만 남긴다 — 각은 카메라가 아니라 보는 취향이다. 배율(z)도 함께 비운다:
 *  가운데점 없는 배율은 반쪽 자리라 받는 쪽에서 추적의 당김(trackZoom9)과 서로 민다. 대신 **누가 쥐고 있나**를
 *  playbackTrackOf 가 싣는다(사람 아이디 · 자동은 CAST_AUTO_LINK9). */
export declare const playbackViewOf: Map<string, {
    /** 배율(1이 기본) — 중계·추적 중에는 없다 */ z?: number;
    /** 화면 한가운데의 지도 가로 분수(0~1) — 중계·추적 중에는 없다 */ cx?: number;
    /** 세로 분수(0~1) — 중계·추적 중에는 없다 */ cy?: number;
    /** 시점 각도(도) */ deg: number;
}>;

/** 자세 번호 — 0 기본 · 1/3 걸음(거울 한 쌍) · 2/4/5 공격 · 6~9 여섯 컷 걸음의 사잇컷(GAIT_CYCLE9). */
declare type Pose9 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** ★ 이 종류가 **어떤 컷을 갖나**(요청: "이동, 액션 모션은 별도 모델링이 없으면 idle
 *  모션이 그 모션이 됨") — 도록이 칸을 세울지 idle로 갈음할지 이 값이 정한다.
 *
 *  poseTempoOf는 '컷이 있나'만 말하고 **어느 컷인지**는 안 말한다. 그런데 종류마다
 *  가진 컷이 다르다: 하이템·아콘은 공격만, 리버·디파일러는 걸음만, 뮤탈·디바우러는
 *  날갯짓까지다. 없는 컷을 달라고 하면 굽기 열쇠(poseTag)가 "0"으로 접어 idle을
 *  돌려주는데 — 그림은 옳지만 **빌더는 그 컷으로 한 번 불린다**. 열쇠와 그림이
 *  어긋날 자리를 만드느니, 부르는 쪽이 있는 컷만 묻는 편이 낫다. */
export declare function poseCutsOf(kind: string): {
    move?: boolean;
    atk?: boolean;
    flap?: number;
    thrust?: boolean;
    roll?: boolean;
    gait?: boolean;
} | null;

export declare function poseTempoOf(kind: string): {
    walkHz: number;
    atkCd: number;
} | null;

/** 목록을 부를 때 필요한 격자를 미리 다 받아 둔다 — 댓글과 같은 이유다(ActivityComments의
 *  primeActivityComments 주석): 카드가 뜬 뒤에 격자가 도착하면 미니맵이 그때 생겨나며 카드
 *  키가 자라고, 그만큼 활동의 스크롤 자리가 밀린다. 이미 받아 둔 해시는 건너뛴다. */
export declare function primeReplayMaps(hashes: (string | null | undefined)[]): Promise<void>;

export declare type Race = "테란" | "프로토스" | "저그" | "랜덤";

declare type RacePick = ModelCatalogRace;

declare type ReplayAvatarComponent = ComponentType<{
    member?: ReplayChromeMember | null;
    size?: number;
    className?: string;
    icon?: ReactNode;
}>;

/** ── 배경 음악(요청: "public/audio에 mp3 파일 10개 있어 그거 랜덤하게 재생해 주고,
 *  대신 음악 on/off 아이콘 추가 · 기기 음량 따라가야 하고 음소거(진동·무음 포함)
 *  모드면 안 들려야 됨" · "기본 재생으로 해 줘(무음 모드에선 안 틀기)") ──────────────
 *
 *  ★ 기기 음량·무음을 따르는 길은 **아무것도 안 하는 것**이다.
 *    이 파일에는 `volume`을 건드리는 줄도, `AudioContext`를 만드는 줄도 없다. 둘 다
 *    일부러 뺐다:
 *      · `volume`을 1 미만으로 두면 그 순간부터 '앱 음량'이라는 두 번째 손잡이가
 *        생겨서, 기기 음량을 올려도 안 커지는 소리가 된다. iOS는 아예 읽기 전용이라
 *        기기마다 동작이 갈리기까지 한다. 건드리지 않으면 OS 음량이 그대로 유일한 자다.
 *      · WebAudio(AudioContext)를 열면 사파리가 오디오 세션 갈래를 바꿔 **무음 스위치를
 *        무시하고** 소리를 내는 길로 들어선다. 그래서 웹에서 무음 스위치를 뚫는 꼼수가
 *        늘 WebAudio다 — 우리는 그 반대를 원하므로 평범한 <audio> 하나만 쓴다.
 *    그러면 iOS는 벨소리/무음 스위치와 음량을, 안드로이드는 미디어 음량을 그대로 태운다.
 *
 *  ⚠ 안드로이드의 한계 — 웹에는 '지금 진동·무음 모드인가'를 묻는 길이 없다(그런 API가
 *    없다). 안드로이드에서 미디어 소리는 벨소리와 **다른 줄기**라, 벨을 진동으로 두어도
 *    미디어는 미디어 음량을 따른다. 곧 여기서 지킬 수 있는 것은 '미디어 음량 0이면 안
 *    들린다'까지다. iOS는 무음 스위치가 미디어까지 덮으므로 요청 그대로 동작한다.
 *
 *  ★ (되물림 — 지금은 기본 켜짐 · 아래 wantOn) 기본이 **꺼짐**이다(지시: "안 건드리면 조용하고 켜야 나는 게 맞아") — 켠 적이 있는
 *    사람만 나고, 그 뜻은 브라우저에 남아 다음 경기에도 따라간다(아래 wantOn).
 *  ★ 켜 둔 사람에게도 '켜 둔 뜻'이 곧 '지금 소리가 난다'는 아니다 — 브라우저는 사람의
 *    누름 없이 소리 나는 재생을 막는다. **아이콘은 뜻이 아니라 지금을 말한다**(지적):
 *      ① 판에 서자마자 한 번 튼다. 앱 안에서 경기를 눌러 들어온 길이면 이미 누름이
 *         있었으므로 여기서 그냥 나고, 아이콘도 켜진 얼굴이 된다.
 *      ② 막히면 **꺼진 얼굴로 둔다**. 소리는 없는데 켜졌다고 적혀 있으면, 켜려고 누른
 *         사람이 오히려 끄게 된다. 꺼진 얼굴이면 다음 걸음이 분명하다 — 누르면 난다
 *         (그 누름은 사람의 누름이라 브라우저가 안 막는다).
 *    기억해 둔 뜻은 그대로 둔다 — 막힌 것은 브라우저 사정이지 사람이 끈 것이 아니다.
 */
/** 곡 한 줄 — **앱이 준다**(요청: "scplay는 목록을 파라미터로 받고 실제 음악 파일과 목록은 쓰는 쪽에서 제공한다").
 *  재생기는 음악 파일을 갖지 않는다: 한 곡이 6~13MB라 패키지에 넣으면 라이브러리가 너무 커지고(지적), 무엇을 틀지는
 *  앱마다 다르다(곡이 없는 앱도 있다). 그래서 파일은 앱의 public 에 두고, 목록과 주소만 여기로 넘긴다.
 *  옛 고정 목록(public/audio/bgm 의 mp3 열 곡)과 MIDI 두 곡을 굽던 기록은 docs/notes/player-ui.md '배경 음악 목록은 앱이 준다'. */
export declare interface ReplayBgmTrack {
    /** 곡 목록·툴팁에 적는 이름. */
    title: string;
    /** 파일 주소 — `<audio src>`에 그대로 건다. 공백 따위는 앱이 인코딩해서 넘긴다. */
    src: string;
}

export declare interface ReplayChrome {
    Avatar?: ReplayAvatarComponent;
    RaceBadge?: ReplayRaceBadgeComponent;
    toast?: (text: string, opts?: {
        kind?: string;
        ms?: number;
    }) => void;
}

export declare interface ReplayChromeMember {
    id: string;
    nickname: string;
    avatar: string | null;
}

/** 사용법(요청: 공통 — 버튼도 페이지도 재생기 안) — 재생기 아래 '사용법' 버튼이 이 문서를 화면 위에 덮는다.
 *  앱은 이 파일을 갖지 않는다. 닫기는 덮개를 걷는 일뿐이다(뒤로가기는 재생기가 history로 맞춘다). */
export declare function ReplayGuide({ onClose }?: {
    onClose?: () => void;
}): JSX_2.Element;

/** 격자를 그린 캔버스 하나. 크기는 CSS가 정한다(부모를 꽉 채운다).
 *
 *  ★ targetSide — **화면에 실제로 그려질 한 변(장치 픽셀)**이다(지적: "지도를 16배 최대
 *    확대하면 맵이 흐려"). 여태 굽는 크기가 타일당 4px로 못 박혀 있어, 128타일 맵이면
 *    배킹이 512px이었다. 그걸 1024px 상자에 깔고 16배로 늘리면 **32배 확대한 그림**이라
 *    흐릴 수밖에 없다 — 배율을 아무리 올려도 화소가 안 는다.
 *    이 값을 주면 굽는 크기가 그 배율을 따라간다(상한 안에서). 안 주면 예전 그대로다. */
export declare function ReplayMapCanvas({ grid, className, targetSide }: {
    grid: ReplayMapGrid;
    className?: string;
    targetSide?: number;
}): JSX_2.Element;

export declare type ReplayMapFetcher = (hashes: string[]) => Promise<ReplayMapGrid[]>;

export declare interface ReplayMapGrid {
    /** 격자 내용의 해시 — 서버에서 같은 맵을 두 번 저장하지 않게 하는 열쇠다(요청: 같은
     *  맵이면 미니맵 하나를 함께 쓰자). 이름이 아니라 내용이 기준이다. */
    hash: string;
    /** 그 리플레이에 적혀 있던 맵 이름(사람이 DB를 볼 때의 단서). */
    name: string;
    width: number;
    height: number;
    /** 이 맵에 나오는 타일 그룹 번호들 — tiles의 각 바이트가 이 배열의 첨자다. */
    palette: number[];
    /** width*height개의 팔레트 첨자를 바이트로 늘어놓고 base64로 옮긴 것. */
    tiles: string;
    /** 자원 자리(앞마당·멀티) — 미네랄 밭과 가스를 가까운 것끼리 묶어 '한 자원 지대'로 만든
     *  것이다(요청: 자원 위치 파악). 낱개 미네랄 400개를 다 그리면 노이즈라, 묶어서 지대
     *  중심만 남긴다. [타일x, 타일y, 가스있음(0/1)]. 못 읽었으면 빈 배열. */
    resources: [number, number, 0 | 1][];
    /** 이 맵이 묶인 **대표맵**("빠른무한"·"투혼" 같은 상위 이름). 화면이 리플레이 원본
     *  이름(제어문자 섞임) 대신 이 이름을 쓴다. 안 묶였으면 null. */
    canonId?: number | null;
    canonName?: string | null;
    /** 맵 데이터에서 자동으로 뽑은 **참값 지형**(요청) — 서버가 리플레이 안의 지도를
     *  OpenBW로 올려 구운 타일 깃발이다(zlib "OBWM"을 base64로). 있으면 재생 화면이
     *  그림 색 어림(walk) 대신 이쪽을 쓴다 — 램프·벽·언덕이 한 칸도 안 틀린다.
     *  꼴과 푸는 법은 src/utils/mapTerrain.ts 머리말에 있다. */
    terrain?: string | null;
    /** 그 지형의 타일셋(0~7) — 절벽·물의 색을 고르는 데 쓴다. */
    tileset?: number | null;
}

export declare function ReplayModule({ grid, endSec, bases, teamOfRaw, loadUnitTracks, winnerTeam, melee, soleView, active, sceneLink, clockKey, onFinish, onDetailClose, shareNode, onShare, shareLabel, onGuide, guide, side, menu, avatars, }: ReplayModuleProps): JSX_2.Element;

export declare interface ReplayModuleProps {
    /** 지도 격자 — 이것이 없으면 그릴 것이 없다(부르는 쪽이 먼저 가린다). */
    grid: ReplayMapGrid;
    /** 판 길이(초). 모르면 null — 자취의 마지막 프레임이 대신한다. */
    endSec: number | null;
    /** 로스터 — 이름·종족·편. 재생기가 색과 기둥을 이걸로 짓는다. */
    bases: MotionBase[];
    /** 그 게임 아이디가 어느 편인가 — 팀색이 이 답을 쓴다. */
    teamOfRaw: (raw: string) => 1 | 2 | undefined;
    /** 참값 자취를 가져오는 길 — 앱이 제 API로 채운다(모듈은 주소를 모른다). */
    loadUnitTracks: () => Promise<{
        motion: string | null;
        chats?: {
            sec: number;
            name: string;
            text: string;
        }[];
    }>;
    /** 이긴 편(트로피). 모르면 undefined. */
    winnerTeam?: 1 | 2;
    /** 편이 없는 판(밀리) — 로스터 한 테이블·팀색 손잡이 없음. */
    melee?: boolean;
    /** 이 재생기가 화면에 홀로 있나 — 키보드 조작과 갈라진 판 경고가 이 자격을 본다. */
    soleView?: boolean;
    /** 지금 실제로 보이는가 — 안 보이는 카드의 재생을 멈춘다. */
    active?: boolean;
    /** 링크로 받은 장면 한 벌(시각·배속·자리·카메라 임자) — `sceneLinkOf9` 가 푼 그대로 넘긴다. */
    sceneLink?: SceneLink9 | null;
    /** 재생 시각을 밖에서 읽는 열쇠(공유 링크가 쓴다). */
    clockKey?: string;
    /** 끝까지 봤다 — 앱이 이때 승패 배지를 드러낸다(배지는 앱의 제목 줄이 그린다). */
    onFinish?: () => void;
    /** 확대 창을 닫는 길 — 있으면 재생기가 닫기 단추를 낸다. */
    onDetailClose?: () => void;
    /** 진행바 아래 슬롯 — 공유처럼 **앱의 것**을 여기 꽂는다. */
    shareNode?: ReactNode;
    /** ★ 장면 공유(지적: "스크랩 버튼, 공유 버튼은 쓰는 쪽에서 쓸지 말지 선택하는 거고 함수도 알아서 연결해야 해" ·
     *  스크랩은 2026-10-22 걷었다). 주면 버튼이 서고(단축키 X),
     *  안 주면 안 선다. 공유하는 일(카카오·공유 시트·링크 복사)만 앱이 붙인다.
     *  글을 돌려주면 그 글이, 참이면 "링크 복사됨"이 잠깐 뜬다. */
    onShare?: () => string | boolean | void | Promise<string | boolean | void>;
    /** 공유 버튼의 글씨 — 기본 "장면 공유". */
    shareLabel?: string;
    /** 사용법 버튼(공통) — 앱이 제 라우팅으로 열고 싶으면 onGuide, 버튼을 안 내려면 guide=false. */
    onGuide?: () => void;
    guide?: boolean;
    /** 확대 모드 오른쪽 슬롯 — 댓글 따위(지시: 모듈은 안 만든다, 받기만 한다). */
    side?: ReactNode;
    /** 오른쪽 위 케밥 — 앱의 메뉴. */
    menu?: ReactNode;
    /** 로스터에 프사를 그릴까 — 기본은 그린다. 프사 그림 자체는 앱이 꽂는다
     *  (setReplayChrome) — 안 꽂혔으면 켜 두어도 안 그린다. */
    avatars?: boolean;
}

declare type ReplayRaceBadgeComponent = ComponentType<{
    race: string;
    size?: number;
    circleLetter?: boolean;
    className?: string;
}>;

/** 재생 화면이 뜰 때 그 행을 **세션에 한 번** 서버와 대조한다.
 *
 *  ★ 조건이 "지형이 없을 때"에서 **"세션에 한 번은 무조건"** 으로 바뀌었다(지적: "타일
 *    이미지 굽는 걸 게임 mpq 파일로 정확히 뽑는 걸로 바꿨는데 왜 그전하고 똑같지?").
 *    그 물음의 답이 여기 있었다: 지형은 서버가 **다시 구울 수 있는** 값인데(굽는 규칙이
 *    좋아지면 재분석이 force로 다시 굽는다) 이쪽은 '없을 때만' 물었다. 그래서 한 번
 *    지형을 받은 탭은 서버가 아무리 새로 구워도 **영영 옛 지형**을 들고 있었다 —
 *    오래 사는 폰 사파리는 며칠씩 그랬다.
 *    이제 없든 있든 한 번은 묻는다. 삯은 맵 종류당 요청 하나뿐이고(세션에 한 번),
 *    바뀐 것이 없으면 같은 값이 와 캐시가 그대로다. */
export declare function revalidateReplayMap(hash: string | null | undefined): Promise<void>;

/** ── 로스터 손잡이의 '켠 얼굴' — **사람 + 표**(요청: "사람+테이블로도 가능한가") ─────
 *
 *  루시드에는 이 뜻의 글리프가 없다. 가장 가까운 것이 IdCard(카드 안에 사람 + 줄 둘)
 *  인데, 뼈대가 **카드**라 곁에 서는 지도·전체화면 아이콘(선으로 된 도형)과 결이 다르고,
 *  무엇보다 획이 안쪽에 몰려 있어 작은 크기에서 뭉갠다.
 *
 *  ★ 이 아이콘의 유일한 제약은 **크기**다 — 이 줄의 아이콘은 모바일에서 13px이다.
 *    24칸 뷰박스에서 13px이면 한 칸이 0.5px이라, 획 굵기 2가 곧 1px이다. 그러면
 *    반지름 1.5짜리 머리는 화면에서 1.5px 덩이가 되어 점으로 뭉갠다. 그래서 '표 격자
 *    안 첫 칸에 사람'처럼 안쪽을 잘게 나누는 꼴은 쓸 수 없다. 대신 **획을 적게, 크게**:
 *      · 왼쪽 — 사람 하나(머리 지름 6칸 · 어깨 하나). 곁의 Users와 같은 몸집이라
 *        꺼진 얼굴 ↔ 켠 얼굴이 사람 크기가 안 바뀐 채로 넘어간다.
 *      · 오른쪽 — 표의 줄 셋. 격자 대신 줄로 두면 12px에서도 셋이 각각 읽힌다.
 *    획 다섯 · 가장 작은 것이 3칸(1.5px)이라 이 줄에서 가장 굵은 축에 든다.
 *
 *  나머지 규격은 루시드 문법 그대로다(24×24 · 획 2 · 둥근 끝·이음 · 칠 없음) — 한 벌로
 *  서야 하므로 여기서만 다른 값을 쓰면 이 버튼만 톤이 튄다. */
export declare function RosterTableIcon({ size }: {
    size?: number;
}): JSX_2.Element;

/** 장면 링크의 열쇠 일곱 — 다른 화면으로 옮길 때 떼어 낼 것도 이 목록이다(scplayer ExtShareScreen). */
export declare const SCENE_LINK_KEYS9: readonly ["t", "s", "z", "cx", "cy", "a", "tr"];

/** 링크에서 푼 장면 한 벌 — 없는 값은 없는 대로 둔다(기본값은 재생기가 안다). */
export declare type SceneLink9 = {
    /** 시작 시각(초) */ t?: number;
    /** 배속 */ s?: number;
    /** 배율(1~PLAYBACK_ZOOM_MAX) */ z?: number;
    /** 화면 한가운데의 지도 분수(0~1) */ cx?: number;
    cy?: number;
    /** 각도(도) */ a?: number;
    /** 카메라 임자 — 게임 아이디 · `*`(CAST_AUTO_LINK9)는 자동 중계 */ tr?: string;
};

/** 링크의 쿼리(`?…` 문자열이든 URLSearchParams 든)를 장면 한 벌로 — 열쇠 일곱 중 하나도 없으면 null.
 *  값의 자는 여기서 죈다(시각 > 0 · 배속 > 1 · 배율 1~PLAYBACK_ZOOM_MAX · 분수 0~1 · 각은 유한한 수 · 임자는 빈
 *  글자가 아님). 못 읽는 값은 없는 것으로 둔다 — 옛 링크의 배속 5·10·20 은 재생기가 가장 가까운 칸으로 접는다.
 *  ⚠ 임자(tr)가 로스터에 있는 사람인지는 여기서 모른다 — 재생기가 `bases` 로 걸러 낸다(sceneLink prop). */
export declare const sceneLinkOf9: (src: string | URLSearchParams) => SceneLink9 | null;

/** 지금 장면을 링크 쿼리로 — 시각·배속·자리·각도·카메라 임자. 기본값(0초 · 1배속 · 1배율 · 가운데 · 90도 ·
 *  임자 없음)은 안 싣는다(지적: stargayte 처럼 기본값은 빼기) — 주소만 길어진다. 카메라를 기계가 쥔 장면(중계·
 *  추적)은 playbackViewOf 가 자리를 비워 두므로 저절로 각도와 `&tr=` 만 실린다(위 ★). */
export declare const sceneLinkQueryOf9: (clockKey: string) => URLSearchParams;

export declare const SEARCH_ROLES9: string[];

/** 앱이 부팅에서 한 번 부른다 — 곡 목록을 통째로 갈아 끼운다(준 차례가 곧 목록의 차례). 빈 목록이면 음악을 끈 앱이다. */
export declare function setReplayBgm(tracks: readonly ReplayBgmTrack[]): void;

/** 앱이 부팅에서 한 번 부른다. 준 것만 덮는다. */
export declare function setReplayChrome(next: ReplayChrome): void;

export declare function setReplayMapFetcher(fn: ReplayMapFetcher): void;

export declare const SHAPE_GALLERY: ShapeGalleryItem[];

/** 겹쳐 그리는 면 하나 — [패스, 불투명도, 색?]. 색을 안 주면 currentColor. */
/** [패스, 불투명도, 색?, 깊이?, 등급?] — 넷째 값은 부품 중심의 화면 깊이(요잉 반영,
 *  +가 시청자 쪽)로, zsorted가 painter 순서를 다시 세우는 열쇠다. 없으면 '직전 부품에
 *  붙은 장식'으로 본다.
 *
 *  다섯째는 부품 등급(LOD, 요청: "형체를 결정하는것(개인색 포함)이 1티어 장식이 2티어
 *  세부포인트 3티어") — 없으면 1이다. **숫자가 작을수록 끝까지 남는다**:
 *    1 형체   작아져도 끝까지 그린다. 없으면 무엇인지 못 알아본다 —
 *             몸통·머리·다리·포신·날개, 그리고 **개인색**(누구 것인지).
 *    2 장식   형체 위에 얹히는 것. 명암(윗면 밝기·옆면 그늘), 덧댄 판, 큰 무늬.
 *    3 세부   가장 작은 것. 원통 단면, 광택 점, 리벳, 데칼, 잔가시. 가장 먼저 빠진다.
 *  걸러 내는 일은 스프라이트를 굽는 순간 딱 한 번 일어난다(unitSprite/buildingSprite) —
 *  프레임마다 재는 것이 아니라, 등급이 캐시 열쇠에 들어가 판이 등급별로 따로 구워진다. */
/** 면 하나 — [경로, 농도, 색?, 깊이 열쇠?, 등급?, 부품 번호?].
 *  ★ 여섯째가 부품 번호다(수리: 각도에 따라 팔·다리가 저·중에서 사라진다) — 넷째(깊이
 *    열쇠)는 **각도마다 값이 달라지는 깊이**라 부품 신원으로 쓸 수 없었다. 등급 매기기
 *    (autoTier)가 그 값의 '같은 값이 이어지는 구간'으로 부품을 묶고 있었는데, 각도가
 *    바뀌면 깊이가 재편돼 묶음이 통째로 달라졌다(실측: 99종 중 74종에서 부품 수가
 *    각도마다 바뀌었고, 러커는 면 45개 고정인데 부품이 13~21개로 흔들렸다). 그래서
 *    같은 팔이 각도마다 다른 등급을 받아 나타났다 사라졌다. 부품 번호는 굽는 각도와
 *    무관하게 '빌더가 몇 번째로 선언한 부품인가'만 말한다. */
declare type ShapeFace = [string, number, string?, number?, number?, number?];

/** ★ 여러 컷을 **한 창**으로(지적: "모션컷에 따라 모델 확대율이 달라짐") ───────────────
 *  ShapeIcon의 fit은 그 컷의 잉크에 창을 맞추므로, 자세가 갈리면(팔을 뻗고 다리를 벌리고)
 *  실루엣과 함께 창도 갈리고 모델이 컷마다 커졌다 작아졌다 한다. 도록의 모션 창처럼
 *  **같은 모델의 여러 컷을 나란히** 놓는 자리에서는 그 흔들림이 곧 거짓말이다.
 *  부르는 쪽이 이 함수로 컷들을 미리 훑어 한 상자를 얻고 그것을 세 칸의 fitBox로 내리면,
 *  창이 못 박혀 컷 사이에 오직 **모델의 움직임만** 남는다.
 *  면 목록은 ShapeIcon과 같은 문(resolveShapeFaces·같은 캐시)을 지나므로, 한 번 구운
 *  각·컷을 다시 훑는 것은 거의 공짜다. */
export declare function shapeFitBox(kind: string, opts?: {
    /** 요잉(도) — 안 주면 지도의 기본 자세(BUILDING_BASE_YAW)다. ShapeIcon과 같은 규약. */
    rotDeg?: number;
    /** 훑을 컷들 — 안 주면 여섯 컷 모두. 그 종류가 안 가진 컷은 idle과 같은 면이라 해가 없다. */
    poses?: readonly (Pose9)[];
    flat?: boolean;
    viewYaw?: number;
    pitchView?: boolean;
    /** 여백(짧은 변 비율) — ShapeIcon의 fitPad와 같은 뜻·같은 기본값(0.12). */
    fitPad?: number;
}): string | undefined;

/** 도록 한 칸 — 밖(앱의 도록 화면)이 이 꼴을 그대로 먹는다. */
export declare type ShapeGalleryItem = {
    kind: string;
    label: string;
    /** 갈래 — "부가"는 유닛도 건물도 아닌 것들(자원·크립·버로우 구멍·핵·스톰·탱크 부품). */
    group: "유닛" | "건물" | "부가";
    /** 종족 — 중립(자원)은 빈 글자다. 도록의 종족 고르기가 이 칸을 본다. */
    race: "테란" | "프로토스" | "저그" | "";
    /** ★ **표에는 있되 목록에는 안 서는 종류**(2026-09, 요청: "성큰 발사·시즈모드 별도 목록
     *  없어도 되고 시즈모드는 탱크 기타 동작셀에 넣고 성큰발사는 성큰 공격셀에 넣으면 됨") ──
     *  그 둘은 제 항목으로 설 까닭이 없다 — 탱크의 액션 칸과 성큰의 공격 칸이 이미 그것을
     *  보여 주기 때문이다. 그렇다고 **표에서 지우면 안 된다**: 광택 표(glossOf9)가 이 표로
     *  종족을 찾으므로, 빠지는 순간 그 모델이 제 종족 광택을 잃고 '그 밖' 값으로 그려진다
     *  (터렛을 가를 때 적어 둔 그 함정이다). 그래서 **숨기기**만 한다 — 도록의 목록·도록
     *  뽑기가 이 칸을 보고 건너뛴다. */
    hidden?: true;
};

export declare function ShapeIcon({ kind, className, faces: facesOverride, rotDeg, flat, keepRatio, viewYaw, pitchView, wide, fit, fitPad, fitBox: fitBoxProp, spin, pose, headDeg, lit, stage, attach, attachRot, parts, }: {
    kind: string;
    className?: string;
    /** ★ 자세 컷(요청: 도록에서 idle·이동·액션을 보여 준다) — 0 기본 · 1·3 걸음 ·
     *  2·4·5 공격이다(POSE_* 상수와 같은 번호).
     *  ★ 왜 프롭이 필요한가 — 컷은 모듈 전역 깃발(poseNow)이라 굽기 **직전에** 세우고
     *    끝나면 되돌려야 한다(안 되돌리면 다음에 굽는 남의 모델까지 그 컷으로 굽힌다).
     *    밖에서 poseSet을 부르면 리액트의 그리는 차례와 그 창을 맞출 길이 없다 — 여기
     *    안에서 spin과 **같은 규약**으로 감싼다. */
    pose?: Pose9;
    /** 포탑 각(절대 도). */ headDeg?: number;
    /** 창·속심 불빛. */ lit?: boolean;
    /** 건설 단계(0이면 완성). */ stage?: number;
    /** 딸림 부품(터렛 포탑부·성큰 혓바닥). */ attach?: string;
    /** 그 부품만의 절대 요잉(도). */ attachRot?: number;
    /** 한 칸에 겹쳐 그리는 판들(시즈 전환의 차체 + 버팀다리 + 포탑) — DocCell9.parts 와 같은 자. */
    parts?: DocPart9[];
    /** 회전 칸(요청: 스톰을 모델로) — 도는 부품을 가진 종류(SPIN_KINDS)의 변종 번호다.
     *  스톰은 이 값이 **번개 무늬의 씨앗**이라, 칸이 바뀌면 무늬가 통째로 갈린다.
     *  굽기 열쇠(spinTag)가 이 값을 물므로 같은 칸은 늘 같은 그림이다. */
    spin?: number;
    /** 뷰어의 요잉 회전(요청) — withYaw로 다시 투영한 면 목록을 그대로 그린다. */
    faces?: ShapeFace[];
    /** 이동 방향 회전(요청: 유닛 마커도 방향) — 시계방향 도. */
    rotDeg?: number;
    /** 위에서 본 판(요청) — 입체 보기가 아닐 때의 지도 마커가 켠다. */
    flat?: boolean;
    /** 원본 비율 유지(요청: 자료실에서 보는 비율 그대로 — 캔버스에 맞춰 늘리기 금지). */
    keepRatio?: boolean;
    /** 좌우 시점(지적: 입체 보기 시점이 정면 고정) — 카메라가 비껴 본 각(도). */
    viewYaw?: number;
    /** 입체 보기 판(지적: 모델이 맵하고 안 맞음) — 맵과 같은 45도 각으로 굽는다. */
    pitchView?: boolean;
    /** 넓은 창(도록 전용) — 16-상자 밖까지 보여 준다(지적: "스파이어, 파일런 등이 안나옴").
     *  건물 정규화는 잉크를 상자의 1.2~2.8배까지 채우고(파일런 1.88·고치 2.84) 스파이어는
     *  키가 상자를 훌쩍 넘는다. 지도는 그 넘침이 제 모습이지만 도록은 **모델 전체**를
     *  봐야 하므로, 창을 사방으로 한 상자씩 넓혀 32-상자로 본다. */
    wide?: boolean;
    /** 잉크에 창을 맞춘다(도록의 "크기: 최대" — 요청: "최대는 진짜 최대야, 각 유닛을
     *  그리드에 패딩만 빼고 최대로 채우기"). 정규화(MODEL_NORM·BLD_NORM)는 **모델끼리
     *  같은 몫으로 채우는가**를 보는 자라 창을 남기는 것이 제 일이고, 그래서 칸의 절반쯤은
     *  늘 빈다. 여기서는 그 자를 아예 안 태우고 실제로 칠해진 상자를 재서 그 상자를 창으로
     *  삼는다 — 어느 모델이든 칸을 꽉 채운다. 비율은 지키고(meet) 가운데 놓는다.
     *  "인게임"은 이 문을 안 지난다: 거기서는 서로 얼마나 큰지가 물음이라 창이 공통이어야
     *  한다. */
    fit?: boolean;
    /** 잉크 창의 여백(짧은 변 비율) — 도록은 넉넉히(0.12), 효과는 바짝(FxModel이 0.02). */
    fitPad?: number;
    /** 창을 **밖에서 못 박는다**(요청: "최대화 모드에서 각도나 동작 변화에 따라 줌 크기가
     *  달라지면 안 돼") — fit은 그때그때의 잉크에 창을 맞추므로, 자세가 바뀌거나 몸이
     *  돌면 실루엣이 달라지며 창도 함께 달라진다. 그러면 같은 모델이 컷마다 커졌다
     *  작아졌다 하고, 무엇이 실제로 커진 것인지 알 수 없게 된다. 부르는 쪽이 여러 자세·
     *  여러 각을 미리 훑어 **하나의 창**을 정하고 그것을 여기 내려 준다. */
    fitBox?: string;
}): default_2.JSX.Element;

export declare const shapeMapTiles: (kind0: string) => number;

/** 자동 완성에 늘 서는 전술 낱말(앱의 검색 꼴 · 판마다 실제로 나온 것은 색인 줄 gameIndexOf9 가 돌려준다). */
export declare const TACTIC_TERMS9: readonly string[];

export declare const TEAM_COLOR: Record<number, string>;

export declare interface TerrainGrid {
    w: number;
    h: number;
    /** 행 우선 — 1이면 걸을 수 있는 땅으로 본다. */
    walk: Uint8Array;
    /** 행 우선, 1이면 크립이 못 퍼지는 칸(요청: 램프·다리) — 걷긴 하지만 크립은 못 앉는
     *  땅이라 walk와 별개 층이다. 검수 모달에서 사람이 칠하고, 없으면 벽만 크립을 막는다. */
    creep?: Uint8Array;
    /** 행 우선, 1이면 **언덕(높은 땅)**(요청) — 원작의 명중 규칙이 높이를 본다: 낮은 데서
     *  높은 데를 쏘면 46.9%가 빗나간다([OBW] missChanceRaw의 119 가지). 리플레이에도
     *  미니맵 그림에도 고도는 안 실려 있어, 크립 층과 같은 식으로 사람이 칠한다.
     *  칠한 게 없으면 온 지도가 같은 높이 — 예전과 똑같이 아무도 안 빗나간다. */
    high?: Uint8Array;
}

/** 그 해시의 맵 격자 — 서버에 없으면 null, '아직 조회 중'이면 undefined.
 *  (구분 이유·지적: 조회 중을 null로 뭉개면 카드가 첫 그림에 옛 로스터 폼을 그렸다가
 *  격자가 도착하면 재생 화면으로 갈아타며 로스터가 깜빡하고 사라져 보였다.) */
export declare function useReplayMap(hash: string | null | undefined): ReplayMapGrid | null | undefined;

/** 격자 캐시가 바뀌면 다시 그린다 — 위 cachedReplayMap을 읽는 화면이 붙는다.
 *  값을 안 돌려주는 까닭: 읽는 자리는 저마다 다른 해시를 묻고, 그 읽기는 위 함수가 한다.
 *  여기 몫은 '바뀌었다'를 알리는 것 하나다(뒷장이 실려 격자가 뒤늦게 도착하는 자리). */
export declare function useReplayMapTick(): void;

export { }
