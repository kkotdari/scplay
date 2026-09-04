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
       도록이 idle로 갈음한다. */
export { SHAPE_GALLERY, ShapeIcon, poseTempoOf, poseCutsOf, atkCutOf, flapCutOf, shapeMapTiles } from "./ReplayMotionPlayer";
export type { ShapeGalleryItem } from "./ReplayMotionPlayer";
