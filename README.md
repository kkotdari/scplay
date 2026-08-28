# 리플레이 재생 모듈

페이지 안에 통째로 꽂는 재생기 한 벌이다(요청: "재생기 모듈로 페이지 안에 넣는 모듈로
(맵이름행부터 지도 조작부까지 다 포함. 전체화면 로직까지) 댓글은 제외 … css도 다 포함해서
모듈화"). 다른 프로젝트(screplay)로 **손으로 복사해 옮기는 것**을 전제로 나눠 두었다.

## 들어오는 문 하나

```tsx
import ReplayModule from "./components/replay/ReplayModule";

<ReplayModule
  grid={mapGrid}                 // 지도 격자(ReplayMapGrid)
  endSec={durationSeconds}       // 판 길이(초) · 모르면 null
  bases={roster}                 // 이름·종족·편 몇 줄
  teamOfRaw={(raw) => 1 | 2}     // 그 게임 아이디가 어느 편인가
  loadUnitTracks={() => api.getTracks(id)}   // 참값 자취 가져오기
  head={{ stamp, mapName, minutes, win, by }}// 맵 이름 줄에 적을 것
  shareNode={...} side={...} menu={...}      // 앱의 물건을 꽂는 슬롯
/>
```

이 모듈은 **경기라는 것을 모른다.** GameResult·회원·API가 하나도 안 들어온다 — 지도 격자,
로스터, 자취를 가져오는 함수, 머리 줄 글자뿐이다. 그래서 자료만 이 꼴로 맞추면 그대로 돈다.

**댓글은 안 만든다**(지시). 앱마다 다른 물건이라 `side` 슬롯으로 받기만 한다. 공유·스크랩도
같은 까닭으로 `shareNode` 슬롯이다.

## 이 폴더(그대로 복사)

| 파일 | 하는 일 |
|---|---|
| `ReplayModule.tsx` | 바깥 문 — 맵 이름 줄 + 재생기. 여기만 읽으면 쓸 수 있다 |
| `ReplayMotionPlayer.tsx` | 본체 — 모델링·전투 효과·참값 재생·조작부·전체화면 |
| `replay.css` | 위 둘의 화장. **global.css 뒤에** 실려야 한다(그 파일 머리말) |
| `ReplayMinimap.tsx` · `ReplayFullscreenMinimap.tsx` | 미니맵과 전체화면 미니맵 |
| `ReplayMapVector.tsx` · `ReplayMapCanvas.tsx` · `ReplayFogLayer.tsx` | 지형 벡터 · 지도 캔버스 · 시야 안개 |
| `RosterTableIcon.tsx` · `perf9.ts` · `spaceBackdrop.ts` · `useBgm.ts` | 로스터 아이콘 · 계측 · 배경 · 음악 |

## 꾸러미로 싸기 — 손으로 옮길 때

목록을 손으로 적어 두면 **반드시 갈린다**(이 문서의 개수도 실제와 어긋나 있었다). 그래서
세는 일을 자에게 맡긴다 — import를 실제로 따라가 닿는 파일만 담는다.

```
node scripts/replay-module-pack.mjs --out ../replay-module-pack
node scripts/replay-module-pack.mjs --strip-comments --out ../replay-module-pack   # 주석 없이
```

`--name <이름>`을 주면 그 이름으로 **패키지 뼈대까지** 함께 낸다(package.json ·
vite.config.ts · tsconfig · README). 산출 폴더가 곧 새 저장소의 씨앗이다:

```
node scripts/replay-module-pack.mjs --name scplay --out ../scplay
cd ../scplay && git init && … && git push   # 새 저장소로
# 쓰는 쪽:
npm i github:kkotdari/scplay                # prepare가 빌드를 돌려 dist가 만들어진다
```

```ts
import { ReplayModule, setReplayChrome, setReplayMapFetcher } from "scplay";
import "scplay/styles.css";                 // 공통 CSS 뒤에
```

`--strip-comments`는 **내보내는 사본에서만** 주석을 벗긴다(원본은 그대로). 이 저장소의
재생기는 절반이 주석이고(1.5MB 중 780KB) 그것은 '왜 이렇게 했나'의 기억이라 원본에서는
지울 수 없다 — 지우면 다음 사람이 같은 실수를 되풀이한다. 그렇다고 옮긴 쪽이 그 무게를 다
질 까닭도 없으므로 벗기는 자리를 사본으로 옮겼다. 두 벌로 갈리지도 않는다: 원본이 유일한
참이고 사본은 그때그때 다시 뜬다. **3.6MB → 1.5MB.**

받은 폴더의 `src/`를 그쪽 `src/`에 그대로 덮으면 된다(자리를 지켜 담는다). 함께 나오는
`MANIFEST.md`에 그때의 실측 목록과 붙이는 법이 적힌다.

## 함께 챙길 것(이 폴더 밖) — 2026-08-28 실측 14개

```
utils/ (14)  openbwTracks · mapTerrain · mapTiles · replayTrack · replayNames ·
             replayTechNames · bwUnits · bwUnitNames · bwCombat · bwUpgradeNames ·
             statsMix · truthLives · shapeOblique · contour
```

이 폴더 19개까지 합쳐 **33개 · 3.1MB**(주석 벗기면 1.3MB). 열넷은 전부 **값으로** 쓴다 —
꼴만 쓰던 것들은 패키지 안으로 옮겼고(mapGrid·race·terrainGrid·unitStats), 그때마다
따라오던 사슬이 끊겼다: types/index.ts(38KB) · replayParser · date · minimapTerrain(776줄) ·
legacy/replayUnits(211KB — 재생기가 쓰던 것은 표 셋 3.5KB뿐이었다) · bwTransport.

## 앱이 꽂아 주는 것 — 넷

패키지는 **API 주소도, 회원 개념도, 토스트 층도 모른다.** 옮길 때 이을 곳이 이게 전부다.

```ts
// ① 맵 격자를 어디서 받나 — 부팅에서 한 번
import { setReplayMapFetcher } from "./components/replay/useReplayMap";
setReplayMapFetcher((hashes) => myApi.getReplayMaps(hashes));

// ② 프사·알림 — 부팅에서 한 번(종족 배지는 패키지가 제 것을 들고 있다)
import { setReplayChrome } from "./components/replay/chrome";
setReplayChrome({ Avatar: MyAvatar, toast: mySnackbar });

// ③ 참값 자취를 어디서 받나 — 쓰는 자리에서
<ReplayModule loadUnitTracks={() => myApi.getTracks(id)} ... />

// ④ 프사를 이 화면에서 쓸까 — 쓰는 개발자가 정한다(기본 켜짐)
<ReplayModule avatars={false} ... />
```

무엇을 넣고 무엇을 받는지의 규칙은 `chrome.ts` 머리말에 있다 — 요지는 **필수만 넣는다**:
종족은 이 판의 알맹이라 기본을 들고 있고(앱 개념을 안 쓴다), 프사와 토스트는 앱의 것이라
자리만 비워 둔다.

## 참값 자취를 굽는 쪽

재생의 알맹이는 서버가 OpenBW로 구운 참값이다. 그 도구와 규약은 이 저장소의
`tools/openbw/`(덤퍼 원본과 README)에 있다 — 재생기만 옮기고 자취는 기존 서버에서 받아
써도 되고, 굽는 쪽까지 옮기려면 그 폴더를 함께 가져간다.
