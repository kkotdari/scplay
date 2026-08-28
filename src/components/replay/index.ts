/* 패키지의 문 — 밖에서 쓰는 것은 여기 적힌 것이 전부다.
   재생기 내부(ReplayMotionPlayer의 수만 줄)는 일부러 안 내보낸다: 문이 좁아야 안을 마음껏
   고칠 수 있다. 필요한 것이 생기면 여기로 하나씩 낸다. */

export { default as ReplayModule } from "./ReplayModule";
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

// 재생 상태를 밖에서 읽는 열쇠들(공유 링크가 쓴다).
export {
  PLAYBACK_ZOOM_MAX, playbackClockOf, playbackSpeedOf, playbackTrackOf, playbackViewOf,
} from "./ReplayMotionPlayer";
