# scplay 작업 규약

## 도록(카탈로그) 뽑기
"도록 뽑아줘"는 아래 한 줄이다. 파일명·조건은 스크립트가 정한다 — 손으로 바꾸지 않는다.

    node scripts/doc-catalog.mjs --out <scratch>/dorok

결과: `1. terran_units_blue.png` `2. protoss_units_blue.png` `3. zerg_units_blue.png`
`4. terran_bldgs_blue.png` `5. protoss_bldgs_blue.png` `6. zerg_bldgs_blue.png`
`7. extra.png` `list.txt`, 그리고 상위 디렉터리의 `도록.zip`. zip을 사용자에게 보낸다.
조건(4방위 45·135·225·315 · narrow · 흰 배경 · 임자색 #2b62e8 · 폭 660 · dpr 3)도 스크립트 안에 있다.

## 모델 손질 루프
1. `src/components/replay/ReplayMotionPlayer.tsx` 수정 → `npx tsc --noEmit -p tsconfig.json`
2. `node scripts/model-shot.mjs --kinds <k> --rots 0,45,90,180 --mode top --cell 300 --lit [--zoom 0.5] --out <scratch>/x.png` 로 눈으로 확인
3. 정규화 재측정 — 유닛 `node scripts/model-norm.mjs --kinds <k>`(맨 위 표의 필요배수) → MODEL_NORM,
   건물 `node scripts/bld-norm.mjs --kinds <k>` → BLD_NORM
4. `npx vite build` → `node scripts/model-depth-check.mjs` (✔ 새로 어긴 모델 없음 이어야 한다; 새 빌더는 partKey 키)
5. 커밋 → 브랜치 푸시

## 배포
**사용자가 "배포"라고 할 때만** 한다. 그 전엔 feature 브랜치 푸시까지만.
배포 = scplay `git push origin HEAD:main`, 그리고 scplayer에 실제 변경이 없으면
빈 커밋 "배포 트리거: …"를 브랜치와 main에 푸시.

## 프레임 엔진·워커 구조(2026-09)
- `deriveWorld9`(파생 자료)·`createEngine9`(시각 t → 프레임: unitOps·fxOps·DOM 기록·안개)는
  `ReplayMotionPlayer.tsx` **모듈 스코프**의 순수 함수다. 컴포넌트는 화면 입력(EngineView9)만 건넨다.
- `frameWorker.ts`가 같은 엔진을 워커에서 돌려 프레임을 미리 쌓는다(동적 `import("./frameWorker?worker&inline")`,
  라이브러리 빌드는 `inlineDynamicImports`로 한 파일). 워커가 없거나 던지면 메인 엔진으로 물러난다.
- 엔진은 늘 **자세히** 낸다(요잉 16칸·모든 자세·탱크 차체+포탑). 낮은 배율 간이화는 붓(UnitLayer)의
  `detailAt`·`yawAt`·`moveAt`가 한다. 배율·팬은 프레임에 안 실린다.
- 계측: `node scripts/perf-check.mjs --vite [--noworker]` — vite로 묶어야 워커가 돈다(esbuild 도구 번들은
  워커 없이 메인 엔진). `[워커] on got/used/missed`로 워커가 쓰였는지 본다. `?noworker=1`(해시도 됨)로 끌 수 있다.
