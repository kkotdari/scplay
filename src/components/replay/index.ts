/* 패키지의 문 — 밖에서 쓰는 것은 여기 적힌 것이 전부다.
   재생기 내부(ReplayMotionPlayer의 수만 줄)는 일부러 안 내보낸다: 문이 좁아야 안을 마음껏
   고칠 수 있다. 필요한 것이 생기면 여기로 하나씩 낸다. */

export { default as ReplayModule } from "./ReplayModule";
export { default as ReplayGuide } from "./ReplayGuide";
export type { ReplayHead, ReplayModuleProps } from "./ReplayModule";

// 앱이 꽂아 주는 것들 — 붙이는 법은 README.md.
export { setReplayChrome } from "./chrome";
export type { ReplayChrome, ReplayChromeMember } from "./chrome";
export {
  setReplayMapFetcher, useReplayMap, useReplayMapTick,
  primeReplayMaps, cachedReplayMap, revalidateReplayMap,
} from "./useReplayMap";
export type { ReplayMapFetcher } from "./useReplayMap";

// 자료의 꼴 — 앱이 채워 넘기는 것들.
export type { ReplayMapGrid } from "./mapGrid";
export type { Race } from "./race";
export type { TerrainGrid } from "./terrainGrid";
export type { MotionBase } from "./ReplayMotionPlayer";
export { TEAM_COLOR } from "./markers";
export type { MinimapMarker } from "./markers";

// 곁딸린 그림 둘 — 지도 미리보기(대표맵 관리 따위)와 로스터 표 아이콘(사용법 그림).
export { default as ReplayMapCanvas } from "./ReplayMapCanvas";
export { default as RosterTableIcon } from "./RosterTableIcon";

// 재생 상태를 밖에서 읽는 열쇠들(공유 링크가 쓴다).
export {
  PLAYBACK_ZOOM_MAX, playbackClockOf, playbackSpeedOf, playbackTrackOf, playbackViewOf,
} from "./ReplayMotionPlayer";

/* ── 도록(모델 자료실) — 앱이 제 화면으로 짓는다(요청: "scplayer에 도록 페이지 추가") ──
   재생기는 안 내주고 **모델을 보여 주는 데 필요한 것만** 낸다. 앱이 짓는 것은 배치·
   고르기·팝업이고, 모델을 그리는 일과 컷의 박자는 여기 넘어간 넷이 진다.
     · SHAPE_GALLERY — 무엇이 있나(kind·이름·갈래·종족). 차례가 곧 도록의 차례다:
       유닛/건물로 가르고 테란 → 프로토스 → 저그, 그 안에서 기본 → 고급·후반이다.
     · ShapeIcon     — 한 컷을 그린다. rotDeg가 요잉(자유각), pose가 컷이다.
     · poseTempoOf   — 그 종류의 걸음 Hz·공격 쿨(초). **null이면 컷이 없는 종류**라
       도록이 이동·액션 칸을 안 세우고 idle 하나로 갈음한다(요청의 그 규칙이다).
     · atkCutOf·flapCutOf — 시각 t에서 어느 컷인가. 재생기와 **같은 문**을 쓰므로
       도록의 박자가 지도의 박자와 안 갈린다(그 함수들의 ★ 주석이 그 사고를 적어 두었다).
     · poseCutsOf    — 그 종류가 **어느 컷을 갖나**(걸음·공격·날갯짓). 없는 칸은
       도록이 idle로 갈음한다.
     · galleryYawOf  — 도록의 방위 눈금(0·45·90…)을 **그 갈래의 기준각**으로 옮긴다.
       건물은 지도에서 각이 하나(BUILDING_BASE_YAW = 40도)뿐이라, 45 눈금을 그대로 쓰면
       도록의 건물만 지도와 5도 어긋나 선다. 유닛은 준 각 그대로다.
     · shapeFitBox   — **여러 컷을 한 창으로** 재 준다(지적: "모션컷에 따라 모델 확대율이
       달라짐"). ShapeIcon의 fit은 그 컷의 잉크에 창을 맞추므로 자세가 갈리면 배율이
       흔들린다. 모션 창처럼 같은 모델의 컷을 나란히 놓는 자리는 이걸로 상자를 하나
       얻어 세 칸에 fitBox로 내린다 — 창이 못 박히고 움직임만 남는다. */
/*   · docAnimOf9   — **건물의 움직임**을 묻는 자(2026-09, 요청: "도록에서 건물도 유닛처럼 idle
 *     상태 애니메이션 재생 · 액션칸에는 생산중/업그레이드중/공격중"). 건물은 자세 컷이 아니라
 *     회전 칸·포탑 각·불빛·건설 단계로 움직인다 — 그 넷을 가진 종류인지 알려 주고, 값은
 *     DocIcon9 의 spin·headDeg·lit·stage 프롭으로 내려 준다(지도와 **같은 bldMesh** 가 그린다).
 *     BUILD_STAGES 는 그 단계 수다(1~N−1이 짓는 중, 0이 완성). */
export {
  SHAPE_GALLERY, ShapeIcon, DocIcon9, poseTempoOf, poseCutsOf, atkCutOf, flapCutOf, shapeMapTiles, shapeFitBox,
  galleryYawOf, docAnimOf9, docCellsOf9, docCellBox9, DocTracer9, docWeaponOf9,
} from "./ReplayMotionPlayer";
/*   · docCellsOf9  — **도록 한 항목의 칸들**(2026-09, 요청: "셀은 대기 - 이동/활성 - 공격 -
 *     액션/추가액션 이렇게 네 개로 하고 하고 있는 셀만 보여주기"). 유닛이냐 건물이냐를 묻지
 *     않고 같은 네 자리를 쓰고, 놓을 것이 없는 자리는 칸이 안 선다. 돌려주는 값은 그대로
 *     DocIcon9 의 프롭이다(그 함수의 ★★). 도록은 배치만 한다. */
/*   · DocTracer9 · docWeaponOf9 — **트레이서 한 발**(요청: "그리고 트레이서는 못그려주나? 도록에").
 *     지도가 트레이서를 그리는 붓은 재생기 안에 900줄로 박혀 있었다 — 그것을 순수 함수
 *     (paintFxList9)로 떼어 내고, 이 컴포넌트가 칸 왼아래(총구) → 오른위(표적)로 **같은 붓**에
 *     한 발을 그린다. `docWeaponOf9(kind)` 가 null 이면 그 종류는 무기가 없다(근접·일꾼) —
 *     도록이 칸을 안 세운다. 시각 t 를 주면 그 나이의 한 컷이다. */
export { BUILD_STAGES } from "./engine9";
export type { ShapeGalleryItem } from "./ReplayMotionPlayer";
export type { DocAnim9, DocCell9 } from "./ReplayMotionPlayer";
