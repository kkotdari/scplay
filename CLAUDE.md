# scplay 작업 규약

> ⚠⚠ **이 파일은 세션마다 통째로 읽힌다 — 40KB 를 넘기지 마라.** 2026-10 에 손질 기록을 여기에 쌓아 905KB 가 되어
> 웹 세션이 안 섰다. **손질 기록·까닭·실측 값·되물린 값은 `docs/notes/` 의 해당 파일 끝에** `## 제목(날짜)` 절로 적는다.
> 여기에는 늘 지킬 규약과 그 색인만 둔다. 새 규약이 정말 모든 손질에 걸리면 아래 '늘 지킬 규약'에 **한 줄**만 더한다.

## 손질 기록 — 고치기 전에 먼저 찾아라
모델·화면·효과를 고치기 전에 그 종류 이름·낱말로 기록을 훑는다: `grep -n '<낱말>' docs/notes/*.md`.
되물린 값·함정·실측·보는 명령(🔎)이 거기 있다 — 같은 실수를 두 번 하지 않으려고 적은 것이다.

| 파일 | 담는 것 |
|---|---|
| `docs/notes/catalog.md` | 도록(칸·공격 칸·인형 표적·액션 애니메이션·정규화) · 모델 변천사(hist-run · 7월 트리) |
| `docs/notes/models-terran.md` | 마린·레이스·시즈 전환/무기·드랍십·SCV·커맨드/서플라이·스타포트·부속·애드온 통로 |
| `docs/notes/models-protoss.md` | 프로브·보병(질럿·하템·다크)·커세어·캐리어 잎·셔틀·아비터·건물 전부(어시밀레이터·로보틱스…) |
| `docs/notes/models-zerg.md` | 히드라·울트라·럴커·뮤탈·디바우러·오버로드·퀸·해처리류·콜로니·마운드·덴·고치 |
| `docs/notes/models-common.md` | 걸음 여섯 컷·보병 다리·상체 비틀기·간헐천·미네랄·여러 종 묶음 메모 |
| `docs/notes/modeling-rules.md` | 종족 무관 빌더 규약·함정(감싸개·z 접기·띠·기둥·총구·회전 칸·정규화…) |
| `docs/notes/gl-renderer.md` | GL 붓·메시 층·MRT/번짐·그림자·효과 심(트레이서·피격·캐스트)·가스 연기·장면 시트 |
| `docs/notes/engine.md` | 프레임 엔진·워커 구조 · OBWT 판 9~12(건설 고스트·선택 절·갈래) · 덤퍼 · 은신 |
| `docs/notes/player-ui.md` | 독·툴박스·인포창·로스터·색 모드·전체화면·재생바·흐림 진단·폰 높이 |
| `docs/notes/cast-split.md` | 중계 편성표·개인 추적·맞대결·분할보기(칸 카메라·팀 시야·컬링·미니맵) |

코드 주석의 "CLAUDE.md '<제목>'" 은 옛 자리다 — 이제 `docs/notes/` 에서 그 제목으로 찾는다.
덤퍼(stargayte-api)에 건넨 부탁은 `docs/request-dumper-*.md` · 앱 연동 안내는 `docs/scrap-share-request.md`·`docs/scene-link-migration.md`.

## 코드 지도
- 모델 빌더·표·헬퍼: `src/components/replay/bake9.ts`(SHAPE_BUILDERS · SHAPE_GALLERY — 문 차례를 바꾸지 마라)
- 순수 엔진(시각 t → 프레임): `engine9.ts` · 워커 `frameWorker.ts` · 포장 `framePack.ts`
- GL 붓: `gl9.ts`(메시·인스턴스·MRT·번짐) · 효과 심 `glctx9.ts` · 메시 접기 `src/utils/mesh9.ts` · 카메라/사영 `src/utils/shapeOblique.ts`
- 붓·UI·재생기: `ReplayMotionPlayer.tsx` · CSS `replay.css` · 중계 편성표 `cast9.ts` · 참값 해독 `src/utils/openbwTracks.ts`(판 11~13)
- 굽는 표(빌드 시각): `tierTable.gen.ts`·`muzzleTable.gen.ts`·`addonWall.gen.ts` — 모델을 고치면 다시 뽑는다
- 기기 프로필 `DEV9` 한 표(폰/PC · 벤치 단 PC_TIERS9/PHONE_TIERS9). 기기 판정은 `smallDevice9` 하나.

## 도록(카탈로그) 뽑기
"도록 뽑아줘"는 아래 한 줄이다. 파일명·조건은 스크립트가 정한다 — 손으로 바꾸지 않는다.

    node scripts/doc-catalog.mjs --out <scratch>/dorok

결과: `1. terran_units_blue.png` `2. protoss_units_blue.png` `3. zerg_units_blue.png` `4. terran_bldgs_blue.png`
`5. protoss_bldgs_blue.png` `6. zerg_bldgs_blue.png` `7. extra.png` `list.txt`, 그리고 상위 디렉터리의 `도록.zip`. zip을 보낸다.
조건(4방위 45·135·225·315 · 한 줄에 3모델 · 흰 배경 · 임자색 #2b62e8 · 폭 660 · dpr 3)은 스크립트 안에 있다.
그림은 GL 붓(`DocIcon9`)이 기본 · 옛 2D 는 `--2d`(검토용).

## 모델 변천사 뽑기
"변천사 도록"은 `sh scripts/history/hist-run.sh $S [--old]` 한 줄이다(굽기 → 합치기 → `$S/hist_out/01_terran_units_1.png ~ 12_zerg_bldgs_2.png`
열두 조각 · 종족마다 넷씩 보낸다 · zip 으로 묶지 않는다). 굽는 목록은 `kinds_u.txt`·`kinds_b.txt` 한 곳이고
**목록을 고쳤으면 `--old` 로 8/29 판도 다시 굽는다**(그 열은 행 차례로 찾아 한 칸씩 밀린다). 차림(wtJ = stargayte `8ddd494` ·
wtA = scplay `1e20b08` · hist-shot-make)과 시대별 카메라·그림자 규약은 `docs/notes/catalog.md`.

## 모델 손질 루프
1. `src/components/replay/bake9.ts`(빌더) 수정 → `npx tsc --noEmit -p tsconfig.json`
2. 눈으로 확인은 **`node scripts/model-gl.mjs --kinds <k> --rots 0,45,90,180 --cell 460 [--pose N] [--lit] [--spins all] [--aim N] [--fit 0.85] --out <scratch>/x.png`**
   (앱이 그리는 GL 그림 · 빈 그림 관문). `model-shot` 은 2D 폴백 붓이라 앱 그림이 아니다. 정체 모를 겹침은 후보를 원색으로 칠해 구워라.
   한 각에서 이상하면 다른 각으로 한 번 더 굽는다. 확대는 `$S/crop.mjs` 꼴.
3. 정규화 재측정 — 유닛 `node scripts/model-norm.mjs --kinds <k>` → MODEL_NORM · 건물 `node scripts/bld-norm.mjs --kinds <k>` → BLD_NORM
   (**요청으로 달라진 잉크는 재측정 값으로 덮지 않는다** — 손으로 눌러 둔 값이 많다. 잉크 중심표는 `ink-center --emit` 의 옛/새 측정 차만큼 옮긴다)
4. `npx vite build` → `node scripts/model-depth-check.mjs` · 새 scr-* 클래스면 `node scripts/css-guard.mjs`
   · `node scripts/model-mesh.mjs --check` — **덮임 100%** 관문(아래면 `meshPut9` 를 안 적은 면이 GL 에서 빠진다 · 줄은 `node scripts/miss-sites.mjs`)
   · 모델을 고쳤으면 `node scripts/tier-table.mjs`(등급표) · 총구 모델이면 `node scripts/muzzle-table.mjs`(`--check` · 보기 `muzzle-sheet.mjs [--air]`)
   · 애드온 벽을 옮겼으면 `node scripts/addon-wall.mjs`
5. 커밋 → 브랜치 푸시. 기록은 `docs/notes/` 해당 파일 끝에(위 ⚠⚠).

## 배포
**사용자가 "배포"라고 할 때만** 한다. 그 전엔 feature 브랜치 푸시까지만.
배포 = ① scplay `git push origin HEAD:main` → ② scplayer의 `package-lock.json`에서 `node_modules/scplay`의
`resolved` 해시를 그 main 커밋으로 올리는 커밋("재생기 갱신: …")을 브랜치와 main에 푸시.
scplayer 쪽 소스를 만졌으면 그쪽에서 `npx tsc --noEmit -p tsconfig.json`만이 아니라 **`npx vite build`까지** 돌린다(CSS 문법 오류는 tsc가 못 잡는다).
scplayer는 락 고정이다(vercel installCommand `npm ci`) — 락을 안 올리면 scplay main을 밀어도 앱에 안 실린다.
⚠ **해시를 보고할 때는 늘 40자리 전체다**(`git rev-parse HEAD` 그대로 · scplay·scplayer 둘 다).
락을 통째로 다시 만들 일이 있으면 **node_modules를 치운 채** `npm install --package-lock-only`(설치된 트리에서 뽑으면 Vercel `npm ci` 가 거부한다).
scplay 의 export 를 새로 쓰는 scplayer 손질은 두 저장소가 한 벌이다(로컬 관문은 scplay `dist` 를 scplayer `node_modules/scplay/dist` 에 베껴 돌린다).

## 늘 지킬 규약
### 요청 읽기
- **요청이 이름 붙인 것만 건드린다** — 목록으로 말하면 그 목록만. 되물린 값은 기록의 그 절에 함께 적는다.
- "N배"·"N프로"는 그 표의 **지금 값**을 먼저 보고, 곱인지 값인지 모호하면 묻는다. 모형 자(x·y·z)인지 화면 자인지도 가른다.
- 고치기 전 기록(`docs/notes/`)을 grep 하라 — 지금 값이 이미 여러 번 오간 자리가 많다.

### 모델 빌더(자세한 까닭은 modeling-rules.md)
- 크기·자리·방향은 감싸개(withModelScale/Shift/ZOff)가 아니라 **원 좌표**에 적는다 — 베낄 때 빠진다. 예외: `BLD_DRAW_TUNE`·`UNIT_SIZE_TUNE`(그리는 배수 표).
- 모델 z 는 이미 ×0.8(`Z8`)로 접혀 있다. 굽은 관·회전·jointBetween 은 **설계 자**로 셈하고 꼭짓점에서 Z8 을 곱한다(누름은 회전보다 먼저).
- 새 도형 헬퍼·손 면은 `meshPut9(d, polys)` 로 3D 를 함께 적는다. 화면 자(project 로 얻은 점·화면 원)로 장식을 놓지 말고 모형 자리에
  `discPath3`/`orbPath3`/`billPath3`/`shinePath3`/`annulusPath3` 로 놓는다.
- **굽는 시각에 세계를 묻지 마라**(요잉·카메라·빛·`tubeAxisLift`) — 메시는 요잉 0 에서 한 번 굽고 셰이더가 돌린다. 메시 기록 중
  `facingRatio` 는 늘 1이다 — '그릴까 말까'·'깊이 키'에 쓰면 GL 에서 깨진다(`MESH9.on` 으로 갈라라).
- 굽은 살 위 띠·데칼은 **그 살과 같은 칸(낯 수·위상)으로 쪼갠 낯**으로 살 밖 0.03(`faceBand9`). 한 폴리곤·둥근 고리는 묻히거나 뜬다.
  spirePillar 위상 π/sides · meshRing9 위상 0. 다각 기둥엔 외접이 아니라 그 방향 낯까지(R·cos(π/n)/cos d)로 잰다.
- `oval` 로 누른 단면엔 `trueNormal` · 관을 기둥으로 흉내 내면 `litK` 0.68 · spirePillar 끝 뚜껑은 `tipW > 0.01` 일 때만 · 토막 이은 관은 caps "none".
- 파낸 그릇·격납구·굴 위의 뚜껑(윗면·밑뚜껑)은 GL 에서 걷는다(`noTop`·`omit`·`skipFace`·`cutFace`). 두 다각형을 이은 고리 경로는 GL 에서 꽉 찬 판이다.
- 같은 평면에 겹친 원반은 켜마다 한 뼘(0.022) 올린다(z 싸움). 덩이 사이는 닿게 말고 파고들게.
- 깊이 키: 속을 그린 부품은 껍데기보다 작게 · 벽 앞 덩이를 벽면 무리 키로 올리지 마라(GL 의 부품 차례 편향 ≤0.7 모형칸이 진짜 깊이를 이긴다) ·
  덩이를 옮기면 그 위 띠·데칼의 키 기준점도 함께.
- 한 줄로 꿴 부품(실린더·노즐·불꽃·임자색 띠)은 한 상수에 매달고, 손 값 대신 **이웃에서 거꾸로 푼다**. 축을 옮기거나 인자 이름을 바꾸면
  그것을 되돌리던 보정·그 이름으로 갈리던 문을 전부 훑는다.
- 딸림 부품(`op.attach`)은 딴 개체다 — 서로 가려야 하면 한 판으로. 갈라 둔 별본은 `SHAPE_GALLERY` 에 `hidden: true`(**지우지 마라** — 광택 표가 종족을 찾는다)
  · `BLD_NORM_PAIR` · 필요하면 `docBldKind9`.
- 각이 메시 열쇠에 들면 벌이 폭발한다 — 도는 강체는 `attachRot`(유니폼)으로. 회전 칸은 `SPIN_ANIM9` · 한 칸이 대칭 주기면 안 돈다(`spinRadSym`).
  잉크 상자·앵커는 **칸 0·완성 모델**로 잰다(회전·공사 발판이 건물을 들썩이게 한다).
- 총구는 빌더의 `markMuzzle9`/`markMuzzleAir9`(쌍이면 오른쪽 하나)를 **쏘는 자세의 자리**에 찍는다. 정규화를 고치면 `MODEL_INK` 도 같은 측정으로.
- 한 줄 리터럴 사이에 줄 주석을 끼우지 마라(뒤가 죽는다). GLSL·템플릿 문자열 안에 역따옴표 금지. `|| 1`·`?? 기본값`은 다음 검사를 죽이거나 켜지는 순간 튄다.
- 모델을 통째로 돌릴 때는 `withModelSpin`(SHAPE_ROT 은 2D 만 탄다). 건물 요잉 `BLD_YAW9` 45 · 모형 안 원근은 껐다(`MODEL_PERSP` 0).

### GL·붓·화면
- 몸은 GL(gl9) 메시가 그린다 · `#gl=0` 2D 는 폴백. 헤드리스(SwiftShader)는 GPU 몫을 못 잰다 — perf-check 는 기본 `glblit=0·glbloom=0·glmrt=0`.
- 빛나는 색은 `winLit`/`glowLit` 를 지나야 EMIT_FILL9 에 적혀 번짐을 탄다(늘 켠 불은 미리 적는다). 더하는 빛은 바탕 휘도를 탄다.
- `DEV9` 칸을 모듈 적재 때 `const X = DEV9.y` 로 베끼지 마라(단이 안 먹는다). 다른 임자의 캔버스에 `getContext` 를 부르지 마라(첫 호출이 속성을 못 박는다).
- 워커가 읽는 시야 필드를 늘리면 `viewKeyOf9` 열쇠에도 넣는다. 애니메이션 창의 두 끝은 창이 열릴 때 한 번 잰다.
- 효과 붓에 `new Path2D()` 금지(GL 심에서 안 그려진다 — `PathRec9`/`fillPath9`). 한 번 그리는 스프라이트 판은 `sprVer9` 로 표식.
- CSS 미디어 블록끼리는 **파일 차례**가 이긴다. React 가 그리는 요소에 손으로 textContent 를 쓸 땐 자식이 문자열 하나인지 보라.
- 화면·크기는 기기 화소에 맞춘다(지도 상자 자리 `--snx/--sny` · 크기 정수 px). 흐림은 `#diag` 의 `흐림:` 줄로 가른다(player-ui.md).

## 자주 쓰는 확인 도구
- `node scripts/doc-sheet.mjs --anim --kinds <k> [--times …] [--yaw N] [--2d]` — 도록 칸(공격·액션·트레이서)
- `node scripts/scene-sheet.mjs --race 테란|프로토스|저그 [--addons] [--hurt] [--zoom N] [--hash k=v]` — 지도 위 크기 비교 · `scene_all.png`
- `node scripts/perf-check.mjs --wide|--ios [--fs] --warm 0 --glblit --shot x.png` + `--info --track 정구 --dockrax|--dockship|--dockebay` ·
  `--castprobe N` · `--pickshot` · `--split x.png --players N` · `--diag` · `--dockprobe` · `--fogprobe N` · `--clockprobe` (전체 플래그는 스크립트 머리)
- `node scripts/model-mesh.mjs --kinds <k> --dump` — 부품별 색·z 범위·접힌 덧칠 · `node scripts/spin-box.mjs <k>` — 회전 칸 상자 흔들림
- `node scripts/cast-plan.mjs` — 중계 편성표 규칙 검사 · `node scripts/openbw-tracks-check.mjs` — OBWT 해독 자물쇠
- `node scripts/model-faces-snap.mjs --out a.json` → `--diff a.json b.json` — 리팩터가 2D 면을 안 바꿨나
