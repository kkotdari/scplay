# 장면 스크랩·장면 공유 — scplay 를 쓰는 앱이 붙일 것(2026-09)

재생기(`ReplayModule` · `ReplayMotionPlayer`)는 진행바 아래 꼬리 줄에 **스크랩·공유·사용법** 셋을 한 꼴로 그린다.
그중 스크랩·공유는 **앱이 함수를 주면 버튼째 그리고, 안 주면 안 그린다**. 자리·꼴(CSS)·단축키(Z·X)·완료 표시는
재생기 몫이고, 앱이 지는 것은 **담는 일**(스크랩)과 **보내는 일**(공유)뿐이다.

## 두 prop 은 같은 규약이다

```ts
onScrap?: () => string | boolean | void | Promise<string | boolean | void>;   // 단축키 Z
onShare?: () => string | boolean | void | Promise<string | boolean | void>;   // 단축키 X
scrapLabel?: string;   // 버튼 글씨 · 기본 "장면 스크랩"
shareLabel?: string;   // 버튼 글씨 · 기본 "장면 공유"
```

돌려주는 값이 곧 완료 표시다(1.8초 뒤 제 글씨로 돌아온다):

| 돌려줌 | 버튼에 뜨는 글 |
|---|---|
| 문자열 | 그 글 그대로(예 "담았어요" · "공유됨" · "링크 복사됨") |
| `true` | 기본 글 — 스크랩 "담았어요" · 공유 "링크 복사됨" |
| `false` · `undefined` · 던짐 | 아무것도 안 뜬다(실패·취소는 이 값으로 알린다) |

약속(Promise)이면 풀릴 때까지 기다린다. 던진 예외는 재생기가 삼키므로 앱이 따로 잡을 필요는 없지만, 사용자에게
까닭을 보이려면 앱이 제 토스트로 알린다.

단축키 Z·X 는 **재생기가 홀로 있는 화면**(상세 모달 · 그 경기의 게임 페이지 · 전체화면)에서만 듣는다 — 카드마다
재생기가 서는 목록에서는 안 듣는다(`soleView` 가 그 자격이다). 함수를 안 준 쪽의 키도 안 듣는다. 앱이 Z·X 를
따로 들으면 **두 번** 돈다 — 옛 키 리스너는 걷는다.

## 링크는 재생기가 짓는다 — 값을 만지지 않는다

스크랩에 담는 링크도, 공유로 보내는 링크도 **같은 한 줄**이다:

```ts
import { sceneLinkQueryOf9 } from "scplay";

const url = `${location.origin}${location.pathname}?${sceneLinkQueryOf9(clockKey).toString()}`;
```

`clockKey` 는 재생기에 넘긴 그 열쇠(경기 번호)다. 시각·배속·배율·자리·각도·추적 임자(`t·s·z·cx·cy·a·tr`)의 규칙
(기본값은 안 실린다 · 중계·추적 중에는 자리 대신 `&tr=` · `"*"` 는 자동 중계)은 재생기가 다 지므로 앱이 다시 적을
일이 없다. 자세한 것은 `docs/scene-link-migration.md`.

## 공유(onShare) — 붙이는 꼴

```ts
const clockKey = String(game.matchNo || game.id);
// ⚠ 의존하는 값(clockKey · mapName …)들 **뒤에** 세운다 — useCallback 의 의존성 배열이 렌더 중에 읽히므로
//   그 앞에 두면 TDZ(선언 전 참조) 오류다.
const onShare = useCallback(async (): Promise<string | void> => {
  const url = `${location.origin}${location.pathname}?${sceneLinkQueryOf9(clockKey).toString()}`;
  const copy = async (): Promise<string> => { await navigator.clipboard.writeText(url); return "링크 복사됨"; };
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: `${mapName || "경기"} 장면`, url });
      return "공유됨";
    }
    return await copy();
  } catch {
    try { return await copy(); } catch { return undefined; }   // 사용자가 공유 시트를 닫았거나 클립보드가 막힘
  }
}, [clockKey, mapName]);

<ReplayModule … clockKey={clockKey} onShare={onShare} />
```

카카오 공유처럼 앱이 **제 꼴의 버튼**을 꽂아야 하면 `shareNode` 슬롯이 옛 길로 남아 있다 — 둘 다 주면 재생기의
버튼 옆에 슬롯이 함께 선다. 그 밖에는 `onShare` 로 옮기고 앱의 공유 버튼 컴포넌트·X 키 리스너는 지운다.

## 스크랩(onScrap) — 붙이는 꼴

스크랩은 **나만 보게 담는 것**이다(사용법 안내의 글: "장면 스크랩 — 제목을 붙여 담아 둡니다. 담아 둔 장면은
**스크랩** 화면에서 다시 엽니다."). 그러므로 앱이 지어야 하는 것은 셋이다:

1. **제목 받기** — 안내가 "제목을 붙여"라고 적었으니 `onScrap` 안에서 제목을 묻는다(모달·prompt 무엇이든 앱 몫).
   취소하면 `undefined` 를 돌려준다(완료 표시가 안 뜬다).
2. **저장** — 한 건의 꼴은 `{ title, subtitle, link, gameNo, createdAt }` 이다:
   - `title` 사용자가 붙인 제목 · `subtitle` 앱이 짓는 한 줄(예 "맵 이름 · 12:34 · 정구 vs Rex") ·
   - `link` 위의 `url`(**질문 없이 그대로** — 열 때 재생기가 푼다) · `gameNo` 그 경기 번호 · `createdAt` 지금.
   - 어디에 담는가(서버 API · localStorage)는 앱 몫이다.
3. **되돌림** — 성공이면 `"담았어요"`(또는 `true`), 실패면 `undefined`.

```ts
const onScrap = useCallback(async (): Promise<string | void> => {
  const title = await askTitle();                     // 앱의 제목 입력 — 취소면 null
  if (!title) return undefined;
  const link = `${location.origin}${location.pathname}?${sceneLinkQueryOf9(clockKey).toString()}`;
  try {
    await saveScrap({ title, subtitle, link, gameNo: clockKey, createdAt: new Date().toISOString() });
    return "담았어요";
  } catch { return undefined; }
}, [clockKey, subtitle]);

<ReplayModule … clockKey={clockKey} onScrap={onScrap} onShare={onShare} />
```

### 스크랩 화면(다시 여는 쪽)

담은 `link` 를 열면 그 화면은 **장면 링크를 받는 쪽**과 같다 — `sceneLinkOf9(search)` 로 풀어 `sceneLink` prop 으로
넘긴다(`docs/scene-link-migration.md` 의 '받는 쪽'). 스크랩 전용 해독은 없다. 목록에는 `title`·`subtitle`·`createdAt`
을 보이고 누르면 `link` 로 간다.

## 지금 scplayer 의 자리(참고)

- 공유는 `GameResultStory.tsx` 가 이미 `onShare` 로 붙였다(위 꼴 그대로 · `SceneShareButton.tsx` 는 지웠다).
- 스크랩은 **타입과 화면 열쇠만** 있다: `src/types/index.ts` 의 `SceneScrap { id; title; subtitle; link; gameNo?; createdAt }` ·
  `ScreenKey` 의 `"scraps"`. `onScrap` 핸들러 · 저장 API · 스크랩 화면(목록 → 링크로 열기)은 **아직 없다** — 위 셋이 그
  자리에 들어간다. `SceneScrap.id` 는 저장 쪽이 매긴다.

## 락(package-lock) 규약

`onScrap`·`onShare`·`scrapLabel`·`shareLabel` 은 이미 락이 가리키는 scplay 에 있다(2026-09 이전부터). 링크를 짓는
`sceneLinkQueryOf9` 만 `4ce307d7d47afd2b0fe7de504be23e79d6883794` 이상을 요구한다 — 락을 먼저 올린다.

## 검산

- 버튼 셋(스크랩 · 공유 · 사용법)이 한 줄·한 꼴로 서고, 함수를 안 준 쪽은 버튼이 없다.
- 상세 모달에서 Z → 제목을 묻고 담으면 버튼 글이 1.8초 "담았어요"로 바뀐다 · X → "공유됨"/"링크 복사됨".
- 활동 목록(카드 여럿)에서는 Z·X 가 어느 카드도 안 움직인다.
- 담은 링크를 스크랩 화면에서 열면 담을 때의 시각·배속·자리(또는 중계·추적 상태)로 시작한다.
- 앱에 Z·X 를 듣는 옛 리스너가 남아 있지 않다(한 번 누름에 한 번만 돈다).
