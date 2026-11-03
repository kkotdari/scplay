#!/bin/sh
# 빌드 결과물을 `dist` 브랜치에 한 커밋으로 올린다(2026-10-13, 요청: "빌드가 왜 이렇게 오래 걸리지" → "그렇게 배포 변경해서").
#
# 왜 — sg-web 은 scplay 를 git 의존으로 받는다. main 에는 dist 가 없고 package.json 에 prepare(=빌드)가 있어서, Vercel 의
# `npm ci` 가 배포마다 scplay 를 clone → 개발 도구(vite·typescript·vite-plugin-dts) 설치 → 빌드(실측 32초)까지 했다.
# `dist` 브랜치의 커밋은 dist/ 와 **prepare·devDependencies 를 뺀 package.json** 만 든다 — npm 은 GitHub 타르볼만 받고 끝난다.
#
# 쓰는 법(배포 ①): scplay 에서 `npx vite build` 로 dist 를 만든 뒤 `sh scripts/publish-dist.sh` — 마지막 줄에 dist 커밋 해시(40자)를
# 찍는다. sg-web 락의 node_modules/scplay resolved 를 그 해시로 올린다(CLAUDE.md '배포').
# 소스 커밋(HEAD)은 dist 커밋 메시지에 40자로 남는다 — dist 커밋에서 소스를 되짚는 자리다.
set -eu
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
SRC=$(git rev-parse HEAD)
[ -f dist/index.js ] || { echo "dist/index.js 가 없다 — 먼저 npx vite build" >&2; exit 1; }
# 아틀라스가 모델 소스보다 묵었으면 알리기만 한다(앱은 묵은 그림을 그린다 — 다시 굽기는 수십 분이라 배포를 막지는 않는다).
node scripts/spr-atlas.mjs --check >&2 || echo "⚠ 아틀라스(spr/)가 소스와 안 맞는다 — node scripts/spr-atlas.mjs --bake --prune 로 다시 굽는다" >&2
if [ -n "$(git status --porcelain -- src package.json spr bin)" ]; then echo "src·package.json·spr·bin 에 커밋 안 된 손질이 있다 — dist 가 HEAD 와 안 맞는다" >&2; exit 1; fi
# ★ **디스크를 안 거친다**(2026-11-03, 지적: "배포하려다가 자꾸 멈춤" — 옛 판은 dist 브랜치를 worktree 로 통째로 꺼내(아틀라스 spr/ 494MB) 지우고 다시 베끼고
#   git add 가 그 494MB 를 다시 해시해 2~3분 걸렸다). 이제 임시 인덱스에 spr/ · bin/ 은 **HEAD 의 나무를 그대로**(read-tree --prefix · 위에서 커밋 안 된 손질이 없음을 확인했다),
#   dist/ 는 빌드 결과를 add, package.json · README 는 hash-object 로 넣고 write-tree → commit-tree → push. 같은 내용이면 나무 해시가 그대로라 덩이도 안 는다.
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT
export GIT_INDEX_FILE="$TMPD/index"
git fetch -q origin dist 2>/dev/null || true
git read-tree --empty
git read-tree --prefix=spr/ "HEAD:spr"
git read-tree --prefix=bin/ "HEAD:bin"
git --work-tree="$ROOT" add -f -- dist
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (p.scripts) { delete p.scripts.prepare; delete p.scripts.prepack; delete p.scripts.postinstall; delete p.scripts.install; delete p.scripts.preinstall; }
  delete p.devDependencies;
  p.scplaySource = process.argv[3];
  fs.writeFileSync(process.argv[2], JSON.stringify(p, null, 2) + "\n");
' "$ROOT/package.json" "$TMPD/package.json" "$SRC"
printf '%s\n' "scplay 빌드 결과물 — main 의 $SRC 에서 \`npx vite build\` 로 만든 것(scripts/publish-dist.sh). 손으로 고치지 않는다." > "$TMPD/README.md"
git update-index --add --cacheinfo "100644,$(git hash-object -w "$TMPD/package.json"),package.json"
git update-index --add --cacheinfo "100644,$(git hash-object -w "$TMPD/README.md"),README.md"
TREE=$(git write-tree)
unset GIT_INDEX_FILE
if git rev-parse -q --verify origin/dist >/dev/null; then PAR="-p $(git rev-parse origin/dist)"; else PAR=""; fi
# shellcheck disable=SC2086
COMMIT=$(git -c user.name="$(git config user.name || echo scplay)" -c user.email="$(git config user.email || echo scplay@localhost)" commit-tree "$TREE" $PAR -m "dist: $SRC")
[ "${PUBLISH_DRY:-0}" = 1 ] && { echo "나무 $TREE · 옛 dist 나무 $(git rev-parse -q --verify 'origin/dist^{tree}' || echo -)" >&2; echo "$COMMIT"; exit 0; }
git push -q origin "$COMMIT:refs/heads/dist"
echo "$COMMIT"
