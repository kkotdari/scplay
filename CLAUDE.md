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
- 두 일꾼: **설계 일꾼**(`frameWorker.ts`, 동적 `import("./frameWorker?worker&inline")`, 라이브러리 빌드는
  `inlineDynamicImports`로 한 파일)이 주인(메인 재생 상태)의 명령(`cmd`: 재생/정지·기준 시각·배속, **바뀔 때만**)과
  시점(`view`: 상자·기울기·색·품질·**시야 사각형**)을 받아 제 벽시계로 앞으로 설계도를 지어 둔다(벽시계 3초·10MB 한도).
  **그림 일꾼**(메인의 붓)은 받은 설계도 중 t 이하 가장 늦은 장을 골라 그때 푼다. 단방향. 메인 엔진 대비 길은 없다 —
  워커가 못 서면 마지막 프레임을 든 채 `SCR_DIAG.worker`(#diag "워커" 줄: on/준비중/off · got/used/missed ·
  짓기 ms · op 수·KB · 앞 s·장·MB · 시야 · ⚠오류)에 까닭이 적힌다.
- 설계도는 `framePack.ts`로 **float32 배열 + 문자열 표**로 싸서 transfer로 넘긴다(구조화 복제 없음). 안개 판 셋은
  바뀐 장에만 싣고, 메인은 그 시각 이하 가장 늦은 안개 판을 붙인다.
- 컬링: 메인이 보이는 사각형에 앞뒤 한 화면씩 여유(3×3)를 붙여 `view.cull`로 보낸다. 보이는 것이 그 안에 있는 동안은
  다시 안 보낸다(작은 팬은 설계도를 안 버린다). 1.2배 이하는 지도 전체. 밖의 개체는 미니맵 점만 남는다.
- 세계의 주인은 워커다: 참값(truth)은 메인이 `postTruth9`로 **transfer**해 넘기고(메인엔 껍데기), 개체 표(entData)는
  워커가 참값에서 만든다. 화면(UI)이 읽는 파생 자료(건물 행·캐스트·핵·가스·생산·업글)는 워커가 `worldui`로 한 번
  보내고, 걷기(entWalks)는 추적을 켤 때 `want walks`(임자별)로 청한다. 메인은 deriveWorld9를 안 부른다. 넘긴 뒤
  메인의 트랙 배열은 비운다. 걷기는 참값 키를 가리키는 창(`WalkView`, `posAtW`)이라 복사가 없다(폰 메모리).
- 참값 자리 형식(`openbwTracks.ts`): 키는 `kt`(초 Float32)·`kxy`(픽셀 Int16×2)·`kh`(방향 바이트)·`kst`(상태)로 나눠 들고
  접근자 `kT/kX/kY/kH/kS`로만 읽는다. 체력·인터셉터·표적은 평평한 형식 배열 `Ticks`([초,값,…], 표적은 Float64)이고
  `tkN/tkT/tkV/tkAt/tkLast/tkSlice`로 읽는다. 자리를 바꾸면 접근자만 고친다. 검사: `node scripts/openbw-tracks-check.mjs`.
- `#diag`는 요약 한 줄, `#diag=draw|mem|worker|truth|all`(쉼표로 여럿)로 용도를 가른다. `mem`에 메모리 어림(memEst9) 줄.
- 워커는 짓기 시간(ms)에 맞춰 프레임 간격을 벌린다(초당 30장 기본, 최소 8장). 메인은 2초 안의 프레임이면 낡아도 든다.
- 엔진은 늘 **자세히** 낸다(요잉 16칸·모든 자세·탱크 차체+포탑). 낮은 배율 간이화는 붓(UnitLayer)의
  `detailAt`·`yawAt`·`moveAt`가 한다. 배율·팬 자체는 프레임에 안 실린다(시야 사각형만).
- 계측: `node scripts/perf-check.mjs [--msgsize]`(vite 번들이 기본) — `[워커] on got/used/missed`로 워커가 쓰였는지,
  `--msgsize`로 장당 바이트·op 수를 본다. 워커 번들의 `process.env.NODE_ENV`는 vite.config의 define이 박는다(사파리).
  esbuild 도구 번들(model-shot 등, perf-check `--esbuild`)에는 워커가 없어 유닛 프레임이 안 그려진다.
