# 장면 공유 — scplay 를 쓰는 앱이 붙일 것(2026-09 · 2026-10-22 스크랩 걷음)

> 장면 스크랩(`onScrap`·`scrapLabel`·단축키 Z·`.scr-scrapbtn`)은 2026-10-22 기능째 걷었다(요청: "스크랩 기능 완전 제거 · 화면부터 디비까지").
> 옛 이름 `docs/scrap-share-request.md`.

재생기(`ReplayModule` · `ReplayMotionPlayer`)는 진행바 아래 꼬리 줄에 **공유·사용법**을 한 꼴로 그린다.
공유는 **앱이 함수를 주면 버튼째 그리고, 안 주면 안 그린다**. 자리·꼴(CSS)·단축키(X)·완료 표시는
재생기 몫이고, 앱이 지는 것은 **보내는 일**뿐이다.

## prop

```ts
onShare?: () => string | boolean | void | Promise<string | boolean | void>;   // 단축키 X
shareLabel?: string;   // 버튼 글씨 · 기본 "장면 공유"
```

돌려주는 값이 곧 완료 표시다(1.8초 뒤 제 글씨로 돌아온다):

| 돌려줌 | 버튼에 뜨는 글 |
|---|---|
| 문자열 | 그 글 그대로(예 "공유됨" · "링크 복사됨") |
| `true` | 기본 글 "링크 복사됨" |
| `false` · `undefined` · 던짐 | 아무것도 안 뜬다(실패·취소는 이 값으로 알린다) |

약속(Promise)이면 풀릴 때까지 기다린다. 던진 예외는 재생기가 삼키므로 앱이 따로 잡을 필요는 없지만, 사용자에게
까닭을 보이려면 앱이 제 토스트로 알린다.

단축키 X 는 **재생기가 홀로 있는 화면**(상세 모달 · 그 경기의 게임 페이지 · 전체화면)에서만 듣는다 — 카드마다
재생기가 서는 목록에서는 안 듣는다(`soleView` 가 그 자격이다). 함수를 안 주면 키도 안 듣는다. 앱이 X 를
따로 들으면 **두 번** 돈다 — 옛 키 리스너는 걷는다.

## 링크는 재생기가 짓는다 — 값을 만지지 않는다

공유로 보내는 링크는 이 한 줄이다:

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

## 지금 scplayer 의 자리(참고)

- 공유는 `GameResultStory.tsx` 가 이미 `onShare` 로 붙였다(위 꼴 그대로 · `SceneShareButton.tsx` 는 지웠다).

## 락(package-lock) 규약

`onShare`·`shareLabel` 은 이미 락이 가리키는 scplay 에 있다(2026-09 이전부터). 링크를 짓는
`sceneLinkQueryOf9` 만 `4ce307d7d47afd2b0fe7de504be23e79d6883794` 이상을 요구한다 — 락을 먼저 올린다.

## 검산

- 버튼 둘(공유 · 사용법)이 한 줄·한 꼴로 서고, 함수를 안 주면 공유 버튼이 없다.
- 상세 모달에서 X → "공유됨"/"링크 복사됨".
- 활동 목록(카드 여럿)에서는 X 가 어느 카드도 안 움직인다.
- 앱에 X 를 듣는 옛 리스너가 남아 있지 않다(한 번 누름에 한 번만 돈다).
