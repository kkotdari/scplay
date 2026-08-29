# scplay 개발 도구 — stargayte에서 옮겨 온 것

재생기 소스가 scplay로 오면서 함께 온 도구들이다. 저장소 루트의 `scripts/`에 넣으면
경로 규약(src/components/replay/…)이 같아 그대로 돈다.

| 자 | 하는 일 | 필요한 것 |
|---|---|---|
| model-depth-check.mjs | 깊이 열쇠에 높이가 실렸나(모델 관문) + 기준선 | 없음 (이미 scplay에 있음) |
| openbw-tracks-check.mjs | 참값 뭉치 규약 자물쇠 — 덤퍼와 해독기가 같은 꼴을 말하나 | 없음 (③겹만 덤퍼 바이너리·자료) |
| model-shot.mjs | 모델을 굽어 PNG 도록으로 | playwright-core + 크로미움 |
| model-norm.mjs | 모델 잉크 크기 실측 → MODEL_NORM/MODEL_INK 갱신(--emit) | 〃 |
| sprite-check.mjs · bld-norm.mjs · dmg-check.mjs · perf-check.mjs | 스프라이트·건물 채움·피해·성능 검사 | 〃 |

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
