/* 패키지의 문 — 밖에서 쓰는 것은 여기 적힌 것이 전부다.
   재생기 내부(ReplayMotionPlayer의 수만 줄)는 일부러 안 내보낸다: 문이 좁아야 안을 마음껏
   고칠 수 있다. 필요한 것이 생기면 여기로 하나씩 낸다. */

export { default as ReplayModule } from "./ReplayModule";
export type { ReplayModuleProps } from "./ReplayModule";

// 앱이 꽂아 주는 것들 — 붙이는 법은 README.md.
export { setReplayChrome } from "./chrome";
export type { ReplayChrome, ReplayChromeMember } from "./chrome";
export { setReplayBgm } from "./useBgm";
export { setReplaySpriteAtlas } from "./sprAtlas9";
export type { ReplayBgmTrack } from "./useBgm";
export { setReplayMapFetcher, useReplayMap, useReplayMapTick, cachedReplayMap } from "./useReplayMap";
export type { ReplayMapFetcher } from "./useReplayMap";

// 자료의 꼴 — 앱이 채워 넘기는 것들.
export type { ReplayMapGrid } from "./mapGrid";
/* 리플레이 읽은 꼴(서버의 분석기가 돌려준다 · analysis/replayParse · 2026-10-26) — 앱은 꼴만 쓴다(읽기는 서버). */
export type { ParsedReplayOut as ParsedReplay } from "../../analysis/replayParse";
/* 지도 붓 한 곳(미니맵 · 내려받는 PNG · 서버 썸네일이 함께 쓴다) — 앱의 대표맵 화면이 내려받기에 쓴다(옛 앱의 베낀 붓은 걷었다). */
export { drawMapGrid } from "../../utils/mapTiles";
export { decodeMapTerrain, terrainFace } from "../../utils/mapTerrain";
export { PENDING_GRID9 } from "./mapGrid";
export type { Race } from "./race";
export type { MotionBase } from "./ReplayMotionPlayer";
export { TEAM_COLOR } from "./markers";

// 재생 시각과 장면 링크 — 앱은 sceneLinkQueryOf9(짓기)·sceneLinkOf9(풀기)만 부르고 값은 안 만진다.
export { playbackClockOf, SCENE_LINK_KEYS9, sceneLinkQueryOf9, sceneLinkOf9 } from "./ReplayMotionPlayer";

/* ── 도록 페이지(2026-10, 요청: "도록을 scplay에 포함시킬것임 재생기가 아니라 도록 페이지 자체를 제공함") ──
   scplayer 가 짓던 화면을 통째로 들였다(ModelCatalog.tsx 머리말 · 모델 조각 문은 2026-10-26 걷었다 — 도록 페이지가 안에서 쓴다). 앱이 갈래·종족 고르기를 제 알약으로
   그리고 값만 넘긴다(2026-10) — 표 둘(MODEL_CATALOG_GROUPS·MODEL_CATALOG_RACES)은 앱이 알약 이름표를 쓰는 데 쓴다. */
export { default as ModelCatalog, MODEL_CATALOG_GROUPS, MODEL_CATALOG_RACES } from "./ModelCatalog";
export type { ModelCatalogGroup, ModelCatalogRace } from "./ModelCatalog";
/* ── 게임 검색 낱말(2026-10-20) — 앱의 검색 자동 완성이 쓴다(색인은 서버의 분석기가 굽는다). TACTIC_TERMS9 = 전술 낱말 ·
   SEARCH_ROLES9 = 공격함/공격당함/견제함/견제당함. */
export { TACTIC_TERMS9 } from "./tactics9";
export { SEARCH_ROLES9 } from "./searchIndex9";
