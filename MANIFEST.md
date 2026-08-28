# 재생 모듈 꾸러미

`node scripts/replay-module-pack.mjs`가 `src/components/replay/index.ts`에서 import를 실제로 따라가 담은 것이다.
**총 35개 · 3150KB.**

| 자리 | 개수 | 크기 | 파일 |
|---|---|---|---|
| `src/components/replay/` | 21 | 2797KB | RaceBadge.tsx, ReplayFogLayer.tsx, ReplayFullscreenMinimap.tsx, ReplayMapCanvas.tsx, ReplayMapVector.tsx, ReplayModule.tsx, ReplayMotionPlayer.tsx, RosterTableIcon.tsx, chrome.ts, cx.ts, index.ts, mapGrid.ts, markers.ts, perf9.ts, race.ts, replay.css, spaceBackdrop.ts, terrainGrid.ts, unitStats.ts, useBgm.ts, useReplayMap.ts |
| `src/utils/` | 14 | 353KB | bwCombat.ts, bwUnitNames.ts, bwUnits.ts, bwUpgradeNames.ts, contour.ts, mapTerrain.ts, mapTiles.ts, openbwTracks.ts, replayNames.ts, replayTechNames.ts, replayTrack.ts, shapeOblique.ts, statsMix.ts, truthLives.ts |

## 붙이는 법

1. 이 꾸러미의 `src/`를 받는 쪽 `src/`에 그대로 덮는다(자리를 지켜 담았다).
2. `replay.css`는 **공통 CSS 뒤에** 실려야 한다 — 그 파일 머리말 참고.
3. **앱이 꽂아 줄 길은 둘뿐이다.**
   ```ts
   // ① 맵 격자를 어디서 받나 — 부팅에서 한 번
   import { setReplayMapFetcher } from "./hooks/useReplayMap";
   setReplayMapFetcher((hashes) => myApi.getReplayMaps(hashes));

   // ② 참값 자취를 어디서 받나 — 쓰는 자리에서
   <ReplayModule loadUnitTracks={() => myApi.getTracks(id)} ... />
   ```
4. 색·크기 토큰(`--text`·`--line`·`--point`·`--fs-*` 등)은 받는 쪽 `:root`에 있어야 한다.
   없으면 무채색으로 떨어질 뿐 배치는 그대로다.

## 안 담기는 것

앱의 API·화면·스토어. 모듈은 그것들을 안 부른다 — 위 두 길이 그 자리를 대신한다.
참값을 **굽는** 쪽(OpenBW 덤퍼)은 이 저장소의 `tools/openbw/`에 따로 있다.
