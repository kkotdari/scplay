# 장면 링크 — scplay 를 쓰는 앱이 고칠 것(2026-09)

scplay `4ce307d7d47afd2b0fe7de504be23e79d6883794` 부터 **장면 공유 링크의 쿼리(`t·s·z·cx·cy·a·tr`)는
재생기가 통째로 만들고 통째로 받는다.** 앱은 값을 한 톨도 만지지 않는다 — 짓는 쪽은 `sceneLinkQueryOf9`,
받는 쪽은 `sceneLinkOf9` → `sceneLink` prop 이다.

## 깨지는 것(반드시 고친다)

`ReplayModule` · `ReplayMotionPlayer` 의 props 넷이 **없어졌다**:

| 옛 prop | 지금 |
|---|---|
| `initialSec?: number` | `sceneLink.t` |
| `initialSpeed?: number` | `sceneLink.s` |
| `initialView?: { z, cx, cy, deg }` | `sceneLink.z` · `.cx` · `.cy` · `.a` |
| `initialTrack?: string` | `sceneLink.tr` (`"*"` = 자동 중계) |

넷을 넘기던 자리는 **`sceneLink?: SceneLink9 | null` 한 벌**로 바꾼다. 옛 이름을 그대로 넘기면 tsc 가 막는다
(알 수 없는 prop).

## 받는 쪽(링크를 열어 재생기를 띄우는 화면)

```ts
import { ReplayModule, sceneLinkOf9, SCENE_LINK_KEYS9 } from "scplay";

// '이 판의 링크인가'(경로·경기 번호 대조)는 여전히 앱의 일이다 — 값은 아니다.
const q = new URLSearchParams(window.location.search);
const linkQuery = SCENE_LINK_KEYS9.some((k) => q.has(k)) ? q : null;

// 쿼리 → 장면 한 벌. 열쇠가 하나도 없으면 null. 객체는 useMemo 로 한 번만 짓는다(재생기의 effect 가 의존한다).
const sceneLink = useMemo(() => (linkQuery ? sceneLinkOf9(linkQuery) : null), [linkQuery]);

<ReplayModule … sceneLink={sceneLink} />
```

앱에서 걷어 낼 것:
- `Number(q.get("t"))` 따위의 **숫자 셈·죔**(시각 > 0 · 배속 > 1 · 배율 1~`PLAYBACK_ZOOM_MAX` · 분수 0~1) — `sceneLinkOf9` 가 한다.
- `&tr=` 의 **로스터 대조**("그 이름이 이 판에 있나")와 **`"*"` 알아보기** — 재생기가 `bases` 로 가른다.
  `PLAYBACK_ZOOM_MAX`·`CAST_AUTO_LINK9` 를 그 셈 때문에 import 하고 있었다면 이제 필요 없다.

## 짓는 쪽(공유 버튼)

```ts
import { sceneLinkQueryOf9 } from "scplay";

const url = `${location.origin}${location.pathname}?${sceneLinkQueryOf9(clockKey).toString()}`;
```

`clockKey` 는 재생기에 넘긴 그 열쇠(경기 번호)다. `playbackClockOf`·`playbackSpeedOf`·`playbackViewOf`·
`playbackTrackOf` 를 직접 읽어 쿼리를 짜던 코드는 걷는다(표 넷은 아직 export 되지만 링크를 짓는 자는 이 함수 하나다).
기본값(0초·1배속·1배율·가운데·90도·임자 없음)은 안 실리고, 중계·개인 추적 중에는 자리(`z·cx·cy`) 대신 `&tr=` 만 실린다 —
그 규칙을 앱이 다시 적을 일이 없다.

## 화면을 옮길 때 쿼리를 떼어 내는 자리

열쇠 목록을 손으로 적어 두었다면(`["t","s","z","cx","cy","a","tr"]`) `SCENE_LINK_KEYS9` 로 바꾼다 — 열쇠가 늘면 저절로 따라온다.

```ts
for (const k of SCENE_LINK_KEYS9) q.delete(k);
```

## 락(package-lock) 규약

새 export 를 쓰는 앱은 **락이 이 커밋 이상을 가리켜야 컴파일된다.** 락을 먼저 올리고 위 셋을 한 커밋에서 고친다
(옛 scplay 에는 `sceneLink` prop 도 두 함수도 없다).

## 검산

- 공유 버튼이 낸 링크를 새 탭에 열어 같은 시각·배속·자리에서 시작하나.
- 자동 중계 중 공유 → 링크에 `&tr=*` 만 있고 `z·cx·cy` 가 없으며, 받는 쪽이 중계를 켠 채 연다.
- 개인 추적 중 공유 → `&tr=<게임 아이디>` · 받는 쪽이 그 사람을 추적한 채 연다(로스터에 없는 이름은 무시).
- 다른 화면으로 옮기면 주소에서 그 열쇠 일곱이 사라진다.
