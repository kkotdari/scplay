# 로컬 실행 안내 — 아틀라스 굽기 · 비교샷 · 장면 시트 (윈도 · 맥)

클라우드 세션은 GPU 가 없어 브라우저가 CPU(SwiftShader)로 그린다 — 느리고, 아틀라스 굽기는 아예 하지 않는다(규약).
아래 셋은 **내 PC 에서** 돌린다. 명령은 모두 **scplay 저장소 맨 위 폴더**에서 친다.

| 할 일 | 명령(요지) | 걸리는 때 | 결과 |
|---|---|---|---|
| 아틀라스 굽기 | `node scripts/spr-atlas.mjs --bake --prune --basisu <basisu>` | 셰이더(gl9)·모델(bake9)을 고친 뒤 · 배포 전 | `spr/` · `src/components/replay/sprAtlas.gen.ts` |
| 비교샷(비포·애프터) | `node scripts/showcase-run.mjs` | 포트폴리오·업데이트 안내용 | `docs/portfolio/showcase-<버전>/` |
| 장면 시트(크기 비교) | `node scripts/scene-sheet.mjs` | 모델 크기 확인 | `docs/portfolio/scene-<버전>/` |

> **<버전>** = 찍은 날이 아니라 **찍은 코드의 버전**이다 — 그 코드의 마지막 커밋 날짜(서울 시각)와 짧은 해시 7자리, 예 `20261102-cfc6969`.
> 같은 코드면 언제 찍어도 같은 이름이라 덮어쓰고, 코드가 바뀌면 새 폴더가 선다. 커밋하지 않은 `src` 손질이 있으면 끝에 `+`가 붙는다(`20261102-cfc6969+` — 그 그림은 커밋에 없는 코드다).

---

## 0. 처음 한 번 — 준비

### 공통
1. **Node.js 20 이상**과 **git** 이 깔려 있어야 한다(`node -v` · `git --version`).
2. 저장소 받기 · 작업 브랜치로 옮기기 · 꾸러미 깔기:

   **맥(터미널)**
   ```bash
   git clone https://github.com/kkotdari/scplay.git
   cd scplay
   git checkout claude/fervent-franklin-whq2ue
   npm ci
   ```
   **윈도(PowerShell)**
   ```powershell
   git clone https://github.com/kkotdari/scplay.git
   cd scplay
   git checkout claude/fervent-franklin-whq2ue
   npm ci
   ```
   이미 받아 두었으면 `git pull` 만 하고, `package-lock.json` 이 바뀌었으면 `npm ci` 를 다시 한다.

3. **크롬(플레이라이트용 크로미엄)** — 스크립트가 진짜 재생기를 브라우저로 띄워 찍는다.
   ```bash
   npx playwright-core install chromium
   ```
   - 맥은 `~/Library/Caches/ms-playwright/chromium-1228/…` 에 깔린다(스크립트가 이 자리를 먼저 찾는다).
   - 윈도는 `%LOCALAPPDATA%\ms-playwright\` 에 깔리고 플레이라이트가 저절로 찾는다.
   - 다른 크롬을 쓰려면 환경 변수 `PW_CHROMIUM` 에 실행 파일 경로를 준다.

### 아틀라스 굽기에만 — basisu(텍스처 압축기)
저장소에 없다. npm 꾸러미 `basisu` 를 받아 풀어 둔다(한 번만).

**맥**
```bash
cd /tmp && npm pack basisu && tar xzf basisu-*.tgz && chmod +x /tmp/package/bin/darwin/arm64/basisu
/tmp/package/bin/darwin/arm64/basisu -version
```
- 인텔 맥이면 `darwin/x64` 폴더다(`ls /tmp/package/bin/darwin`).
- `/tmp` 는 재부팅하면 지워진다 — 지워졌으면 위를 다시 한다.

**윈도(PowerShell)**
```powershell
cd $env:TEMP; npm pack basisu; tar -xzf (Get-ChildItem basisu-*.tgz | Select-Object -First 1).Name
& "$env:TEMP\package\bin\win\x64\basisu.exe" -version
```
끝나면 `cd` 로 scplay 폴더로 돌아온다.

### 창 모드(PW_HEADED) — 꼭 켠다
`PW_HEADED=1` 이면 브라우저 **창을 띄워 내 GPU 로** 그린다. 끄면 헤드리스라 CPU 로 그려 몇 배 느리다.
- 창이 뜨면 **최소화하지 말고** 다른 창 뒤에 두는 정도로 둔다(최소화하면 브라우저가 그리기를 늦춘다).
- 굽기 로그의 `[GL]` 줄에 렌더러 이름이 나온다 — `SwiftShader` 면 CPU 로 그리는 중이다(창 모드가 안 먹었다).

| | 맥(터미널) | 윈도(PowerShell) |
|---|---|---|
| 한 명령에만 | `PW_HEADED=1 node scripts/…` | `$env:PW_HEADED="1"; node scripts/…` |
| 끄기 | (앞에 안 붙이면 꺼짐) | `Remove-Item Env:PW_HEADED` |

> 윈도 PowerShell 의 `$env:PW_HEADED="1"` 은 그 창을 닫을 때까지 남는다.
> 명령 프롬프트(cmd)라면 `set PW_HEADED=1` 뒤에 명령을 친다.

---

## 1. 아틀라스 굽기 (spr-atlas)

미리 구운 2D 판 그림(서버 아틀라스)이다. **모델(`bake9.ts`)이나 셰이더(`gl9.ts` 의 셰이더 문자열·광택 표)를 고치면 판이 달라져 다시 구워야 한다**
— 안 구우면 앱이 옛 그림을 쓰거나 '모델 준비 중'에서 오래 머문다. 배포 전에 늘 확인한다.

### 1-1. 굽기가 필요한지 보기
```bash
node scripts/spr-atlas.mjs --check
```
- `판 … — 소스와 같다` → 굽지 않아도 된다.
- `판이 다르다: 소스 xxxx · gen yyyy` → 굽는다.
- `크기표가 단 올림표와 다르다` → 크기표(모델·건물 정규화·그리기 배수 — `engine9.ts` 의 MODEL_NORM · BLD_NORM · UNIT_SIZE_TUNE · BLD_DRAW_TUNE · BLD_DRAW_K)가
  바뀌었다는 뜻이다. 따로 할 일은 없다 — 아래 굽기가 **먼저 단 올림표(`spr-lift`)를 다시 잰다**.

### 1-2. 굽기
**맥**
```bash
PW_HEADED=1 node scripts/spr-atlas.mjs --bake --prune --basisu /tmp/package/bin/darwin/arm64/basisu
```
**윈도(PowerShell)**
```powershell
$env:PW_HEADED="1"; node scripts/spr-atlas.mjs --bake --prune --basisu "$env:TEMP\package\bin\win\x64\basisu.exe"
```

**부분 굽기**(2026-11-04~) — 모델 **하나만** 고쳤으면 그 종류만 굽고 나머지는 지금 표 그대로 잇는다(몇 분). 이름은 SHAPE_BUILDERS 이름(예: 넥서스 `pyramidWide` · 게이트 `gate`) · 쉼표로 여럿.
```bash
PW_HEADED=1 node scripts/spr-atlas.mjs --bake --prune --kinds pyramidWide --basisu /tmp/package/bin/darwin/arm64/basisu
```
⚠ 셰이더(gl9 · 광택표)나 여러 모델이 같이 쓰는 헬퍼(bake9 공용 함수 · mesh9 · shapeOblique)를 고쳤으면 **전체 굽기**(위)를 쓴다 — 부분 굽기는 안 구운 종류를 옛 그림 그대로 두는데
`--check` 는 그것을 못 가린다(판 해시는 소스 하나로 잰다).

하는 일과 걸리는 때:
0. **단 올림표**(2026-11-03~) — 크기표가 바뀌었으면 `node scripts/spr-lift.mjs` 를 먼저 돌려 `src/components/replay/sprLift.gen.ts` 를 다시 쓴다
   (장면 시트 세 장을 창에 띄워 잰다 · 몇 분). 안 바뀌었으면 `크기표 그대로` 한 줄 찍고 건너뛴다. 따로 돌리려면 `node scripts/spr-lift.mjs`(맥은 앞에 `PW_HEADED=1`).
1. **덤프** — 재생기를 `#sprdump=2` 로 열어 모든 모델·자세·요잉 16칸을 굽는다(창이 뜬다 · 수십 분 · 작업 자리 `scratchpad/spr-work/_dump` 에 5GB 남짓).
2. **짐 꾸리기** — 종류마다 PNG → basisu 로 KTX2 압축 → `spr/k/…ktx2` · `spr/index.<해시>.json` · `src/components/replay/sprAtlas.gen.ts` 갱신.
   안 바뀐 종류는 같은 이름이라 다시 안 누른다. `--prune` 은 새 표가 안 가리키는 옛 파일을 지운다.

### 1-3. 끝난 뒤
```bash
node scripts/spr-atlas.mjs --check
git add spr src/components/replay/sprAtlas.gen.ts src/components/replay/sprLift.gen.ts
git commit -m "아틀라스 다시 구움"
git push
```
`--check` 가 `소스와 같다 · 파일 다 있음` 이어야 한다.

### 1-4. 막혔을 때
| 증상 | 할 일 |
|---|---|
| 덤프는 끝났는데 `basisu 바이너리가 필요하다` 로 멈춤 | basisu 경로를 고쳐 **짐만 다시**: `node scripts/spr-atlas.mjs --dump scratchpad/spr-work/_dump --prune --basisu <basisu>` (덤프 다시 안 함) |
| 짐 꾸리기 중 basisu 오류(종류 이름이 찍힘) | 그 종류 이름을 알려 준다(묶음 높이 16384 초과 등 — 코드 손질 몫) |
| `[GL]` 이 SwiftShader | `PW_HEADED` 가 안 먹었다 — 맥은 명령 앞에 붙였나, 윈도는 같은 PowerShell 창에서 쳤나 본다 |
| 디스크 모자람 | `scratchpad/spr-work` 를 지운다(굽기가 다시 만든다) |
| `--check` 가 굽고 나서도 `판이 다르다` | 굽는 사이에 소스가 바뀌었다(`git pull` 을 굽기 뒤에 함 등) — 최신을 받고 다시 굽는다 |

---

## 2. 비교샷 — 비포·애프터 (showcase-run)

종족마다 같은 장면(본진·교전)을 **옛 재생기(비포 · scplay `0641c408`, 재질·그림자 손질 전)**와 **지금 재생기(애프터)**로 같은 순간에 찍고 좌우로 붙인다.
장면(유닛 배치·타일셋·임자색)은 `scripts/showcase-shot.mjs` 의 `SCENES.테란8 / 토스8 / 저그8` 이다.

| 장면 | 바닥 | 임자색(아군 / 적) | 아군 | 적 |
|---|---|---|---|---|
| 테란8 | 우주 플랫폼 | 흰색 / 빨강 | 커맨드·컴샛·리파이너리·배럭·뜬 엔베 · SCV · 마린·메딕·파뱃·베슬·발키리 | 울트라·저글링·오버로드 |
| 토스8 | 정글(흙 + 풀 얼룩) | 코발트 / 흰색 | 넥서스·어시밀·파일런·게이트 · 프로브 · 질럿·리버·다크·커세어 | 탱크 2·벌처 3·골리앗 2 |
| 저그8 | 사막(모래 + 짙은 모래 얼룩) | 빨강 / 코발트 | 하이브·익스트랙터·풀·성큰·오버로드 · 드론 · 저글링·히드라·럴커·뮤탈 | 드라군 2·하템·캐리어 |

### 2-1. 찍기
**맥**
```bash
PW_HEADED=1 node scripts/showcase-run.mjs
```
**윈도(PowerShell)**
```powershell
$env:PW_HEADED="1"; node scripts/showcase-run.mjs
```

처음 한 번은 옛 트리를 세운다(아래 ①) — 몇 분 더 걸린다. 그다음부터는 바로 찍는다.
1. **옛 트리** — `0641c408` 을 git worktree 로 임시 폴더(맥 `$TMPDIR/scplay-old0641` · 윈도 `%TEMP%\scplay-old0641`)에 세우고,
   안개 끄기 패치(`scripts/showcase/old0641-nofog.patch`)를 얹고, `node_modules` 를 이 저장소 것으로 이은 뒤(윈도는 junction) 빌드한다.
2. **지금 트리** — `dist/styles.css` 가 없으면 `vite build`.
3. **찍기** — 종족 × (애프터 · 비포) 여섯 장을 기본 둘씩 함께 찍는다(`--jobs`).
4. **붙이기** — 비포|애프터를 좌우로 붙이고 위에 `테란 · BEFORE` / `AFTER` 띠를 단다.

### 2-2. 결과
폴더는 **애프터(지금 코드)의 버전**, 파일은 각자의 버전을 단다. 예(애프터 `20261102-cfc6969` · 비포 `20261029-0641c40`):
```
docs/portfolio/showcase-20261102-cfc6969/
  before_terran_20261029-0641c40.png    after_terran_20261102-cfc6969.png    compare_terran_20261029_vs_20261102.png
  before_protoss_20261029-0641c40.png   after_protoss_20261102-cfc6969.png   compare_protoss_20261029_vs_20261102.png
  before_zerg_20261029-0641c40.png      after_zerg_20261102-cfc6969.png      compare_zerg_20261029_vs_20261102.png
```
compare 그림 위 띠에도 `프로토스 · BEFORE (2026-10-29)` / `AFTER (2026-11-02)` 로 버전 날짜가 찍힌다.

포트폴리오로 남기려면:
```bash
git add docs/portfolio
git commit -m "비교샷"
git push
```

### 2-3. 옵션
| 옵션 | 뜻 |
|---|---|
| `--races 토스8` | 한 종족만(쉼표로 여럿: `테란8,저그8`) |
| `--jobs 1` | 한 장씩 찍기(PC 가 버거우면) · `--jobs 3` 이면 셋씩 |
| `--skip-before` / `--skip-after` | 애프터만 / 비포만 다시 찍기(붙이기는 폴더에 둘 다 있으면 한다) |
| `--out <폴더>` | 결과 폴더 바꾸기(파일 이름의 버전은 그대로 붙는다) |
| `--old <폴더>` | 옛 트리 자리 바꾸기 |

한 장만 따로 찍을 때(붙이기 없이):
```bash
node scripts/showcase-shot.mjs --race 토스8 --out <폴더>
node scripts/showcase-shot.mjs --race 토스8 --root <옛 트리 폴더> --out <폴더>
```
`--t 46`(찍는 초) · `--dpr 1.6`(화소 배수) · `--nofs`(전체화면 끄기)도 받는다.

### 2-4. 막혔을 때
| 증상 | 할 일 |
|---|---|
| `git worktree add` 실패(`already exists`) | 옛 트리 폴더가 반쯤 남았다 — `git worktree remove --force <폴더>` 뒤 다시 |
| 옛 트리 `git apply` 실패 | 폴더를 지우고(`git worktree remove --force`) 다시 돌린다 — 이미 패치된 트리에 또 얹을 때 난다 |
| `⚠ 틀이 무대 밖으로 잘림` | 그 장면의 틀(frame)이 화면보다 크다 — 그 숫자(px)를 알려 준다 |
| `⚠ 그리기 신호를 못 받았다` | 그래도 찍는다 — 그림이 비었으면 `PW_HEADED` 를 켜고 `--jobs 1` 로 다시 |
| 지금 트리 그림이 옛 아틀라스처럼 보임 | 1장의 아틀라스 굽기를 먼저 한다(`--check`) |

---

## 3. 장면 시트 — 크기 비교 (scene-sheet)

종족의 모든 건물·유닛을 한 사람 것으로 격자에 세우고 진짜 재생기로 지도를 찍는다(크기·발자국 비교용).

**맥**
```bash
PW_HEADED=1 node scripts/scene-sheet.mjs
```
**윈도(PowerShell)**
```powershell
$env:PW_HEADED="1"; node scripts/scene-sheet.mjs
```
결과: `docs/portfolio/scene-<버전>/` 에 `scene_terran.png` · `scene_protoss.png` · `scene_zerg.png`(기본 화소 배수 4 — 4096px 판).
딴 자리에 두려면 `--out <폴더>`(그때는 그 폴더 그대로 · 버전 이름이 안 붙는다).
남기려면 `git add docs/portfolio && git commit -m "장면 시트" && git push`.

| 옵션 | 뜻 |
|---|---|
| `--race 테란` | 한 종족만(`테란` · `프로토스` · `저그`) |
| `--zoom N` | 배율 못 박기(기본은 짜임에 맞춰 냄 · 최대 `--zoommax 6`) |
| `--dpr 2` | 화소 배수 낮추기(빠르고 가볍다 · 기본 4) |
| `--addons` | 테란 애드온 짝(커맨드+컴샛 등) 넣기 |
| `--hurt` | 다친 모습(불·연기) |
| `--creep` | 크립 켜기(기본 끔) |
| `--floor map` | 흰 바닥 대신 지형 |
| `--noshadow` | 사영 그림자 끄기 |
| `--hb N` | 유닛 방향(0 북 · 64 동 · 128 남 · 192 서 · 기본 160) |
| `--deg N` | 3D 시점각(기본 90 평면) |
| `--hash k=v` | 재생기 해시 깃발 더하기(예: `--hash creeptex=0`) |

---

## 4. 자주 묻는 것
- **명령은 어디서?** 늘 scplay 저장소 맨 위 폴더(`package.json` 이 있는 곳).
- **최신 코드로 찍으려면?** `git pull` → (꾸러미가 바뀌었으면 `npm ci`) → 찍기. 비교샷의 애프터는 `dist/styles.css` 가 오래됐으면 `npx vite build` 를 먼저 한다.
- **배포와의 차례** — 셰이더·모델을 고친 날: ① 아틀라스 굽기 → 커밋·푸시 → ② "배포"(CLAUDE.md '배포'). 아틀라스를 안 구우면 배포해도 앱은 옛 판 그림을 쓴다.
- **윈도에서 경로에 한글·공백** — 따옴표로 감싼다(`"C:\작업 폴더\scplay"`).
