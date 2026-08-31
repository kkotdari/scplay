# scplay 개발 도구 — stargayte에서 옮겨 온 것

재생기 소스가 scplay로 오면서 함께 온 도구들이다. 저장소 루트의 `scripts/`에 넣으면
경로 규약(src/components/replay/…)이 같아 그대로 돈다.

| 자 | 하는 일 | 필요한 것 |
|---|---|---|
| model-depth-check.mjs | 깊이 열쇠에 높이가 실렸나(모델 관문) + 기준선 | 없음 (이미 scplay에 있음) |
| openbw-tracks-check.mjs | 참값 뭉치 규약 자물쇠 — 덤퍼와 해독기가 같은 꼴을 말하나 | 없음 (③겹만 덤퍼 바이너리·자료) |
| model-shot.mjs | 모델을 굽어 PNG 대조표로(도구 제 그림 — 검정 바탕 격자) | playwright-core + 크로미움 |
| doc-sheet.mjs | **도록 화면 그대로** 판형 그림으로(앱 테마·그림자·개인색) | 〃 + scplayer의 global.css |
| model-norm.mjs | 모델 잉크 크기 실측 → MODEL_NORM/MODEL_INK 갱신(--emit) | 〃 |
| sprite-check.mjs · bld-norm.mjs · dmg-check.mjs · perf-check.mjs | 스프라이트·건물 채움·피해·성능 검사 | 〃 |

`model-shot`과 `doc-sheet`의 갈림 — **그리는 길이 다르다.** model-shot은 면 목록을
캔버스에 손으로 칠한다(빠르고 의존물이 없다, 모델을 고치며 볼 때 쓴다). doc-sheet은
앱이 쓰는 그 컴포넌트(ShapeIcon)를 진짜 리액트로 띄우고 앱 CSS + 모듈 CSS를 얹어
**도록 화면을 그대로 찍는다** — 칸 테마도, `.scr-motion-shape-svg`의 drop-shadow도,
`--scr-doc-own` 개인색도 화면에서 보는 그대로다(남에게 보낼 그림은 이쪽).

```
node scripts/doc-sheet.mjs --group 유닛 --race 테란 --out /tmp/t-unit.png
node scripts/doc-sheet.mjs --group 부가 --css ../scplayer/src/styles/global.css
```
CSS 차례가 규약이다 — 앱 CSS 먼저, 모듈 CSS 나중(scplay README의 그 규약). 도록의
`.scr-doc .scr-doc-svg`가 그것을 이기려고 한 단 올려 잡혀 있어, 차례를 뒤집으면 SVG가
1em(16px)에 갇혀 모델이 점이 된다.

package.json scripts에 원하는 것만 걸면 된다:
```json
"model-depth-check": "node scripts/model-depth-check.mjs",
"openbw-tracks-check": "node scripts/openbw-tracks-check.mjs",
"model-shot": "node scripts/model-shot.mjs"
```

## 참값 뭉치 자물쇠

`openbw-tracks-check.mjs`는 다른 자들과 성격이 다르다 — 모델을 보는 것이 아니라
**저장소 둘이 나눠 쥔 규약**을 지킨다. 굽는 쪽은 stargayte-api의 `openbw/bwdump.cpp`,
되읽는 쪽은 `src/utils/openbwTracks.ts`다. 한쪽만 고치면 화면이 조용히 틀린 값을 읽는다.

```
npm run openbw-tracks-check                       ① 합성 왕복 (의존물 없음)
node scripts/openbw-tracks-check.mjs <뭉치|디렉터리>  ② 구워 둔 뭉치 — 남은 바이트 0인가
node scripts/openbw-tracks-check.mjs --rep <x.rep>  ③ 덤퍼를 돌려 글자와 이진을 대조
node scripts/openbw-tracks-check.mjs --spec         지금 아는 꼴을 찍는다
```

③은 덤퍼 바이너리와 스타 자료가 있어야 한다 — 둘 다 git에 안 담기므로
`tools/openbw/`에 갖다 놓거나 `OPENBW_BWDUMP`·`OPENBW_DATA`로 자리를 일러 준다.
playwright가 필요한 자들은 `npm i -D playwright-core` 후 크로미움 경로를 스크립트 안
규약대로 맞춘다(각 파일 머리말 참고).
