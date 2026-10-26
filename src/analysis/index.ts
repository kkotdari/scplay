/* ★ 분석기(2026-10-26, 요청: "가장 책임이 분리되면서도 이치에 맞게 · 비슷한 작업은 같은 곳에서") — 리플레이를 **읽는** 일의 한 집.
   리플레이 읽기(screp) · 전술 색인 · 분당 곡선 · 지도 썸네일. 재생기(React)와 따로 묶여 노드에서 돈다(dist/analyzer.mjs · 서버가 부른다).
   앱(sg-web)은 이제 아무것도 안 읽는다 — 서버가 이 분석기로 읽어 돌려준다(docs/notes/engine.md '분석기'). */
export { parseReplayBuffer, ReplayParseError } from "./replayParse";
export type { ParsedReplayOut, ParsedReplayPlayerOut, ReplayLeaveSignals, GameType } from "./replayParse";
export { curvesFromTracks } from "./curves";
export type { PlayerCurves } from "./curves";
export { drawMapThumb, MAP_THUMB_VER } from "./thumb";
export type { MapThumbGrid } from "./thumb";
export { gameIndexOf9 } from "../components/replay/gameIndex9";
export type { GameIndexOpts9 } from "../components/replay/gameIndex9";
