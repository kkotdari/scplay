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
4. `npx vite build` → `node scripts/model-depth-check.mjs` · 클래스를 새로 붙였으면 `node scripts/css-guard.mjs`(규칙 없는 scr-* 이름이면 실패) (✔ 새로 어긴 모델 없음 이어야 한다; 새 빌더는 partKey 키)
   · **모델을 고쳤으면 `node scripts/tier-table.mjs`로 부품 등급표를 다시 뽑는다**(`--check`로 어긋남 검사).
     그 표(tierTable.gen.ts)는 모델 기하만의 함수라 빌드 시각에 굽는다 — 안 그러면 폰이 들어올 때마다
     종류마다 여덟 방위를 다시 구워 로딩에서 2~3초를 쓴다(실측). 낡으면 틀린 등급이 실린다.
5. 커밋 → 브랜치 푸시

## 배포
**사용자가 "배포"라고 할 때만** 한다. 그 전엔 feature 브랜치 푸시까지만.
배포 = ① scplay `git push origin HEAD:main` → ② scplayer의 `package-lock.json`에서 `node_modules/scplay`의
`resolved` 해시를 그 main 커밋으로 올리는 커밋("재생기 갱신: …")을 브랜치와 main에 푸시.
scplayer 쪽 소스를 만졌으면 그쪽에서 `npx tsc --noEmit -p tsconfig.json`만이 아니라 **`npx vite build`까지** 돌린다(CSS 문법 오류는 tsc가 못 잡는다). scplayer는 락 고정이다(vercel installCommand `npm ci`) — 락을 안 올리면 scplay main을 밀어도 앱에 안 실린다.
옛 방식(빈 "배포 트리거" 커밋 · installCommand의 HEAD 덮어쓰기)은 걷었다.
락을 통째로 다시 만들 일이 있으면 **node_modules를 치운 채** `npm install --package-lock-only`로 만든다 — 설치된 트리에서
뽑으면 이 기계 플랫폼의 선택 패키지만 실려 Vercel의 `npm ci`가 거부한다(esbuild·rollup 바이너리·fsevents).

## 프레임 엔진·워커 구조(2026-09)
- `deriveWorld9`(파생 자료)·`createEngine9`(시각 t → 프레임: unitOps·fxOps·DOM 기록·안개)는 **`engine9.ts`**의
  순수 함수다(엔진이 이행적으로 참조하는 표·헬퍼 151개를 함께 옮겼다 — React·DOM 없음, 워커는 이 모듈만 든다).
  `ReplayMotionPlayer.tsx`는 붓·UI만 남았고 필요한 이름을 engine9에서 import한다(다른 파일이 쓰던 것은 re-export).
  옮긴 기준은 `scratchpad/split_engine.mjs`(TS API로 이행 참조를 닫음)였다. 컴포넌트는 화면 입력(EngineView9)만 건넨다.
- 두 일꾼: **설계 일꾼**(`frameWorker.ts`, 동적 `import("./frameWorker?worker&inline")`, 라이브러리 빌드는
  `inlineDynamicImports`로 한 파일)이 주인(메인 재생 상태)의 명령(`cmd`: 재생/정지·기준 시각·배속, **바뀔 때만**)과
  시점(`view`: 상자·기울기·색·품질·**시야 사각형**)을 받아 제 벽시계로 앞으로 설계도를 지어 둔다(벽시계 3초·24MB 한도(폰 1.5초·4MB)).
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
- 임자 색은 **굽지 않고 그릴 때 입힌다**(`UnitPlate9.tint`): 판 열쇠에 색이 없고, 개인색 면은 마스크(흰색·음영 알파,
  화가 순서상 위의 고정 면은 destination-out으로 파냄)로 따로 굽는다. 그릴 때 (마스크, 색)별로 한 번 물들인 판을
  `tintedOf9`로 만들어 되쓴다(상한 8색). 건물 판(`BldSprite.tint`)도 같은 규약이다.
- 기기 프로필은 `DEV9` 한 표(폰/PC: 판 예산·굽기 상한·프레임당 굽기·불티·효과 래스터·그림자 최소 배율·시야 여유·
  앞 한도(폰 1.5s/4MB·PC 3s/24MB)·요잉 8칸). 새 문턱은 표에 더하고 자리에서는 `DEV9.x`만 읽는다. 기기 판정은 `smallDevice9` 하나.
  PC는 진입 벤치로 세 단(`DEV9.tiers` = PC_TIERS9: 판 예산·프레임당 굽기·앞 한도)을 오른다(`#tier=N` 강제). 폰 표(PHONE_TIERS9)는
  한 줄이라 단이 없다 — 폰에 열려면 그 표에 줄을 더한다. 굽기 일꾼 수도 표의 값(`DEV9.bakeWorkers`: PC 1~2 · 폰 0)이다.
- **굽기 일꾼**(`bakeWorker.ts`, `#diag=bake`의 '굽기일꾼' 줄): PC에서 판 굽기를 OffscreenCanvas 워커가 하고 ImageBitmap을 transfer로
  돌려준다(`BAKEW9`). 메인은 열쇠·보관함·예산·대타를 그대로 들고, 처음 보는 열쇠는 대기표(`BAKE_WANT9`)에 적어 프레임이 열릴 때 큰 것부터
  일꾼에 청한다 — 그 프레임은 대타(다른 크기·이웃 요잉·작은 판)를 찍고 판이 오면 갈아 끼운다(멈춘 화면은 `BAKE_REPAINT9`로 한 장 다시).
  판 굽기 자체(`rasterUnit9`·`rasterBld9`)와 모델 빌더·표·헬퍼는 **`bake9.ts`**(DOM 없음 — 캔버스는 `BAKE_ENV9`의 손으로만: 메인 DOM
  캔버스 / 일꾼 OffscreenCanvas)에 있다. 빌더를 고치면 bake9.ts를 고친다(model-depth-check·doc-catalog도 그 파일을 읽는다). 모듈 전역
  깃발(pose·head·lit·spin·lod·pitchFlat)은 세터(`poseSet9`·`pitchFlatSet9`…)로만 세운다. 일꾼에는 메인 깃발이 없어 lod·pitchFlat은 청할 때
  싣고, 진단 해시(#pitch·#nocreep)는 워커 name으로 간다(`hashNow9`). `#bakeworker=N`(0 끔). 못 띄우면 옛 인라인 굽기로 돈다.
  ⚠ bake9.ts의 **문 차례**는 원본 그대로여야 한다 — 파생 빌더 등록문(`SHAPE_BUILDERS.x = …`)이 `SHAPE_FACES` 표보다 앞에 있어야 한다.
- `#diag`는 요약 한 줄, `#diag=draw|bake|fog|load|gest|mem|worker|truth|brush|view|all`(쉼표로 여럿)로 용도를 가른다 — draw(화면·덜어내기·프레임) · bake(굽기·굽기일꾼·판갈림·캔버스) · fog(안개) · load(로딩·지도판·입체) · gest(손짓·원점). 한 주제가 한 줄, 줄 머리에 주제 이름. `mem`에 메모리 어림(memEst9) 줄.
- 워커는 짓기 시간(ms)에 맞춰 프레임 간격을 벌린다(초당 30장 기본, 최소 8장). 메인은 2초 안의 프레임이면 낡아도 든다.
- **붓은 React 밖에서**(4번): 시계 틱이 살아 있는 시각(`tLiveRef9`)을 한 걸음(벽시계 ≤80ms) 올리고 `paintFnRef9`로
  설계도를 골라(`frameAt9`: 앞·뒤 장 보간) `unitPaintRef`로 유닛 캔버스를 곧장 칠한다. UnitLayer는 `opsSrc/fxSrc`(ref)를
  props보다 먼저 읽고 `driven`이 참이면 effect에서 안 칠한다. React 상태 t는 `REACT_STEP_MS9`(100ms)마다만 올린다 —
  시간 표시·DOM 효과·미니맵·안개는 그 박자다. 탐색으로 t가 밖에서 바뀌면 렌더가 tLive를 맞춘다.
- 엔진은 늘 **자세히** 낸다(요잉 16칸·모든 자세·탱크 차체+포탑). 낮은 배율 간이화는 붓(UnitLayer)의
  `detailAt`·`yawAt`·`moveAt`가 한다. 배율·팬 자체는 프레임에 안 실린다(시야 사각형만).
- 계측: `node scripts/perf-check.mjs [--msgsize]`(vite 번들이 기본) — `[워커] on got/used/missed`로 워커가 쓰였는지,
  `--msgsize`로 장당 바이트·op 수를 본다. `--wide --cpu 1`이 PC 판(굽기 일꾼 `[굽기일꾼]` 줄이 on이어야 한다). 워커 번들의 `process.env.NODE_ENV`는 vite.config의 define이 박는다(사파리).
  esbuild 도구 번들(model-shot 등, perf-check `--esbuild`)에는 워커가 없어 유닛 프레임이 안 그려진다.
