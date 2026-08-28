# scplay 개발 도구 — stargayte에서 옮겨 온 것

재생기 소스가 scplay로 오면서 함께 온 도구들이다. 저장소 루트의 `scripts/`에 넣으면
경로 규약(src/components/replay/…)이 같아 그대로 돈다.

| 자 | 하는 일 | 필요한 것 |
|---|---|---|
| model-depth-check.mjs | 깊이 열쇠에 높이가 실렸나(모델 관문) + 기준선 | 없음 (이미 scplay에 있음) |
| model-shot.mjs | 모델을 굽어 PNG 도록으로 | playwright-core + 크로미움 |
| model-norm.mjs | 모델 잉크 크기 실측 → MODEL_NORM/MODEL_INK 갱신(--emit) | 〃 |
| sprite-check.mjs · bld-norm.mjs · dmg-check.mjs · perf-check.mjs | 스프라이트·건물 채움·피해·성능 검사 | 〃 |

package.json scripts에 원하는 것만 걸면 된다:
```json
"model-depth-check": "node scripts/model-depth-check.mjs",
"model-shot": "node scripts/model-shot.mjs"
```
playwright가 필요한 자들은 `npm i -D playwright-core` 후 크로미움 경로를 스크립트 안
규약대로 맞춘다(각 파일 머리말 참고).
