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
   · 총구를 가진 모델을 고쳤으면 **`node scripts/muzzle-table.mjs`로 총구 앵커표도 다시 뽑는다**(`--check`).
     앵커의 임자는 빌더다 — 총열·포신·아가리를 짜는 줄에서 `markMuzzle9(x,y,z)`(공용 저그 얼굴은 무른 표식)로 끝점을
     적으면 표(muzzleTable.gen.ts)가 그 값을 싣고 엔진(MUZZLE_ANCHOR)이 손 표 위에 덮어쓴다. 눈으로 볼 때는
     `node scripts/muzzle-sheet.mjs --kinds <k> --rots 0,90,270 --out <scratch>/x.png`(십자가 총구 위에 앉아야 한다).
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
  PC는 진입 벤치로 네 단(`DEV9.tiers` = PC_TIERS9: 판 예산·프레임당 굽기·앞 한도·일꾼 수; 3단은 deviceMemory 8GB가 확인될 때)을 오른다(`#tier=N` 강제). 폰 표(PHONE_TIERS9)는
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

## 모델 z 좌표 손질(2026-09)
- 평면 카메라의 높이 누름(`TOP_Z_PRESS9` 0.8)은 **모델 z 좌표 자체로 옮겨 굳혔다**(`scripts/model-z-scale.mjs --k 0.8`): 빌더·헬퍼의
  z 자리 숫자를 접어 쓴다(리터럴은 값 자체, z 전용 지역 상수는 선언, x·y와 나눠 쓰는 상수는 `NAMEz9` 쌍둥이, 지역 함수는
  z-return 접기 또는 선형 인자 접기). 못 접는 식은 감싸지 않고 `--report` 에 적는다. 카메라는 이제 정직하다(누름 1.0).
  앞으로 모델 높이를 바꿀 때는 카메라가 아니라 좌표를 고친다. 순수 기하 커널(spirePillar 등, KERNEL_FN)은 본문을 안 건드린다.
- 검산: `node scripts/model-faces-snap.mjs --out ref.json --zk 0.8`(원본 + 꼭짓점 z배수 = 정답) · `--out new.json`(고친 소스) ·
  `--diff ref.json new.json`(종류별 어긋난 면·버그급). Node 헤드리스, 전 종류 15초.
- 잉크 중심표(`UNIT_INK_CY9`·`BLD_INK_MID9`)는 `node scripts/ink-center.mjs --emit` 으로 다시 뽑아 engine9 에 붙인다(캔버스 래스터라 브라우저).
- **코드모드가 틀린 자리는 손으로 고쳤다(2026-09, 118종 버그급 → 잔 조각 몇 개)**. 원리: 코드모드는 z **입력**을 접는데 정답은 **꼭짓점** z를
  접는 것이라, 회전·경로 매개변수·접선에서 z를 만드는 자리는 접을 수 없다. 그런 자리는 설계 좌표 그대로 두고 **꼭짓점으로 나가는 자리에서
  `Z8`(bake9, 0.8)을 곱한다** — 경로 람다의 return z, 관절 풀이(jointBetween)는 s·w 를 `/Z8` 로 되돌려 풀고 결과 z 에 `*Z8`, 부품 회전
  (뮤탈 날개 P·포탑 포드 롤·오버로드 bz)은 설계 자로 돌린 뒤 z 에 `*Z8`. 코드모드가 못 본 z 후보: `[x, z]`/`[y, z]` 쌍 표(가디언 다리·
  벌처 hullPlan·옵저버토리 기둥 키), 기본 매개변수(`tankTrack h = 2.6`), 이름이 z 답지 않은 지역 헬퍼 인자(forgeDome9·rampVent·
  sunkenFoot arc), `MODEL_Z_OFF9` 표(withModelZOff 는 modelZK 를 곱하므로 표 값 자체를 ×0.8), 화면 원으로 설계한 것(포지 바퀴 —
  RIM 은 화면 자라 접지 않는다). 남은 잔차(관 단면·구 껍질의 뒷면 판정, 평균 0.02~0.03 모델칸)는 받아들였다.
- **정답 만들 때**: withModelScale 은 바깥 배수를 덮어쓰므로(곱하지 않음) 제 배수를 거는 빌더(refinery·academy·plane·tank·turret·
  trapezoid·tombFlat·dship)는 `--zk 0.8` 정답이 틀린다. 평면은 원본 트리(카메라 누름 0.8)를 `--modes top` 으로 뜬 **진실**과, 입체는
  withModelScale 을 곱셈으로 잠시 고친 원본 트리의 `--zk 0.8` 과 대조한다(model-faces-snap.mjs 머리 주석). `--diff` 는 독점 없는
  최근접 짝짓기 + `--min 0.2`(잔 조각 제외)로 센다 — 탐욕 짝짓기는 궤도 패드·구 껍질에서 이웃을 가로채 과장했다.
- 정규화(MODEL_NORM 26종)·잉크 중심표는 코드모드 때 **틀어진 기하로** 재측정한 값이었다 — 기하를 되찾으며 정규화는 코드모드 전 값으로
  되돌리고 잉크 중심표는 다시 뽑았다.

## 메시 층·WebGL 시제(2026-09)
- **메시 층**: 도형 헬퍼(polyPath3·관·뿔·돔·구·원통·원반·고리·곡면판, bake9.rodFaces)가 `MESH9.on` 일 때 면의 경로 문자열을 열쇠로
  **판 모형 공간 3D 폴리곤**(`Poly3`, 모델 배율·이동·회전은 먹고 요잉·카메라는 안 먹음)을 곁표 `MESH9.byD` 에 적는다. 2D 그림은
  한 톨도 안 바뀐다(`model-faces-snap --diff` 허용 0.001 로 지킨다). `mesh9.collectMesh9(builder)` 가 빌더 하나를 요잉 0 으로 굽고
  음영 덧칠 면(얕은 알파의 흰·검·종족 광택색, `isOverlay9`)을 뺀 부품 메시를 낸다. 검사·미리보기: `node scripts/model-mesh.mjs
  [--kinds a,b] [--svg out.html --rots 0,45,90,180]`(덮임 154종 100%; 미리보기는 html 캔버스 — svg 는 수천 면에서 스크린샷이 멎는다).
  새 도형 헬퍼를 만들면 `meshPut9(d, polys)` 를 함께 적는다 — 안 적으면 그 부품이 GPU 그림에서 빠진다(덮임 표가 잡는다).
- **숫자 경로**: polyPath3 가 화면 2D 좌표를 `POLY2` 에 적고 `bake9.pathOf` 가 그 숫자로 Path2D 를 짓는다(문자열 파싱 생략, 판당 약 20%).
- **WebGL 붓(PC 기본 켬 · `#gl=0` 끔 · `#gl=1` 폰에서도 켬)**(`gl9.ts`): 유닛·건물 몸을 **판 없이** 메시로 GPU 가 그린다. 메시는 열쇠별
  한 벌(유닛 `u:종류:자세:lod`, 건물 `b:종류:건설단계:포탑각:불빛:회전:lod` — rasterBld9 와 같은 깃발), 상한 600 벌. 정점 셰이더가 `project` 와
  같은 카메라(평면 sin40/cos40 · 입체 pitchFlatNow·0.7/0.9/앞숙임 0.34/시각 밀림 tan(vq), `camOf9`)를 걸고, 자리·배수는 판 블릿과 같은 자다
  (유닛 앵커 (sx, sy−px·0.24−lift)·px/16·MODEL_NORM·원점 줄 12/12.6 · 건물 x 상자 가운데, 잉크 바닥을 바닥선−띄움에). 판이 주던 잉크 상자
  (그림자·링·체력바·BLD_INK_BOX)는 `footOf`(메시 꼭짓점을 카메라·요잉으로 돌려 잰 상자)가 같은 자로 준다.
  · **메시 기록 중(MESH9.on)엔 빌더의 시점 가지가 다르다**: `faceLight().visible` 은 늘 참(뒷면도 낸다), `facingRatio()` 는 1(마주 볼 때만 그리는
    장식도 다 든다) — 2D 굽기에는 안 걸린다(스냅샷 동일).
  · 색: 고정색은 tone9 를 지나고, 같은 경로 위의 흰·검 덧칠(topFace·sideFace·faceLight)은 정점의 aOv 로 접는다(mesh9.collectMesh9). 셰이더는
    거기에 실루엣 빛(silhouetteLight 식)과 옅은 법선 방향광(0.74+0.36·|n·L| — 같은 회색 지붕 위 회색 드럼을 가르는 몫)을 얹는다.
  · 앞뒤: 깊이 칸은 **화면 겹침**으로 나눈다(개체마다 나누면 400기에서 칸이 너무 얇다) + 칸 안은 카메라 가까움 + 부품 차례(aOrd) 편향.
    **데칼**(한 장짜리 작은 부품: 줄무늬·창·환풍구 — 2D 는 벽 **안쪽 0.5칸쯤**에 그려 두고 화가 차례로 얹었다)은 그만큼 꺼내야 보이므로
    깊이 편향(유닛 0.8 · 건물 1.3 모델칸)을 **정점(aOrd)에** 얹는다. 편향을 그리기 단위로 주면 같은 구간의 다른 면까지 끌려 나오고,
    너무 크면(2.0) 거꾸로 벽 앞으로 튀어나온 부품을 덮는다 — 좁은 창의 가운데 값이다. 구간은 둘뿐이다: 불투명 | 반투명(깊이 안 씀).
  · **덧칠 면은 반드시 몸에 접거나 버린다**(mesh9): ① 같은 경로 ② 같은 부품 번호(pid)의 마지막 몸 면. 제 부품으로 남기면 모델이
    통째로 비쳐 보인다(실측: 보급고 103부품 중 54개가 반투명이었다).
  · GL 뒷캔버스(`.scr-motion-gl9`, display:none)는 붓이 몸을 다 큐에 넣은 뒤 **효과 전에** 유닛 캔버스에 합성한다. GL 이 켜지면 유닛·건물의
    2D 면 굽기(resolveShapeFaces)·판 굽기는 안 돈다(데우기도 메시로). 아직 캔버스가 맡는 것: 크립 판·얼룩·맨 네모·그림자 타원·링·체력바·효과.
  · **손수 짠 경로도 3D 로 되찾는다**(mesh9.meshFromPath9): 기록 중 project() 가 화면점→3D 표(PROJ9)를 적고, 헬퍼 없이 빌더가 짠
    경로(번개·얼룩·screenCircle 구 껍질·groundEllipse 땅 원·annulus 고리·반고리)를 꼭짓점 되찾기로 메시화한다. 불투명 화면 원은 구,
    반투명 화면 원은 카메라를 보는 원반. 되찾기가 안 되는 면은 GL 에서 빠진다(gl-check 가 잡는다).
  · **화면 효과 여섯(warpin·storm·nukeblast·nukecloud·archon·darchon)도 GL 이 맡는다**(`GL_CANVAS_KINDS9` 는 비었다). 발광 종류
    (`GL_GLOW_KINDS9`)의 규약: ① mesh9 glow — 반투명 흰·검 면은 덧칠이 아니라 **몸**(같은 경로에 몸이 있을 때만 접는다) ② 화면 원은
    구가 아니라 **카메라를 보는 원반**(빌보드, 정점 aBb — 요잉을 안 돌리고 가운데만 돌린다) ③ 깊이 없이 **화가 차례**(불투명·반투명을
    안 가른다)·음영 없음(`flat`, uFlat) ④ 폭풍·핵은 **더하기 합성**(`add`, 2D 의 lighter). 폭풍·핵 폭발·핵 구름은 효과 op 이라 붓이
    GL 큐의 맨 뒤에 `glFxPush9`(판 fxModelCv9 의 fit 자와 같은 자: 모델 상자를 w×h 에 맞춰 가운데에)로 넣고 판은 안 굽는다(`glFx9`).
    효과 메시 열쇠 `f:종류:칸`. 탄두·섬광·연기(모델 아님)는 캔버스에 남는다.
  · GL 캔버스는 **미리곱한 알파**(premultipliedAlpha: true · 셰이더가 rgb·a 를 내고 합성 (ONE, 1−a)) — 예전(SRC_ALPHA 짝)은 알파 채널이
    a² 로 쌓여 반투명 빛무리가 어두웠다(밝기비 0.75 → 1.0). 더하기는 (ONE, ONE).
  · 진단: `#diag=draw` 'GL' 줄(개체·삼각·메시·깊이칸/bit·판으로 떨어진 종류) · `#glshade=0|1|2` · `#gldepth=0` · `#glbias=N` · `#gllod=N` ·
    `#glwarm=0`. 계측 `perf-check --hash gl=0`(캔버스 비교) `--probe-gl`(메시 표) `--warm 0`. 메시만 따로 보려면 `scripts/model-mesh.mjs`.
  · **전수조사 `node scripts/gl-check.mjs [--kinds a,b] [--rots 45,225] [--worst 40] --out <scratch>/glcheck.png [--json x.json]`** —
    종류마다 2D(캔버스 면 그리기)와 GL 을 같은 칸에 그려 실루엣 IoU·색차·밝기비를 재고 나쁜 순으로 표와 [2D,GL] 시트를 낸다.
    GL 붓을 고치면 이걸로 154종을 다시 돈다(2분). 기준(2026-09, 효과 여섯 포함·미리곱한 알파 뒤): 평균 나쁨 0.171 · 밝기비 1.02 · 나쁨 0.5 넘는 종류 0.
