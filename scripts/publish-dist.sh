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
WT=$(mktemp -d)
trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"' EXIT
git fetch -q origin dist 2>/dev/null || true
if git rev-parse -q --verify origin/dist >/dev/null; then
  git worktree add -q --detach "$WT" origin/dist
else
  git worktree add -q --detach "$WT" HEAD
  (cd "$WT" && git checkout -q --orphan dist-new && git rm -rq --cached . && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +)
fi
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist "$WT/dist"
# 서버 아틀라스(미리 구운 모델 그림 · spr/)와 그것을 앱 정적 자리로 베끼는 bin/spr-copy.mjs 도 싣는다(2026-10-25 · 원본은 scplay).
# 이름이 내용 해시라 안 바뀐 파일은 git 이 같은 덩이로 묶는다 — dist 커밋마다 늘지 않는다.
cp -r spr "$WT/spr"
cp -r bin "$WT/bin"
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (p.scripts) { delete p.scripts.prepare; delete p.scripts.prepack; delete p.scripts.postinstall; delete p.scripts.install; delete p.scripts.preinstall; }
  delete p.devDependencies;
  p.scplaySource = process.argv[3];
  fs.writeFileSync(process.argv[2], JSON.stringify(p, null, 2) + "\n");
' "$ROOT/package.json" "$WT/package.json" "$SRC"
printf '%s\n' "scplay 빌드 결과물 — main 의 $SRC 에서 \`npx vite build\` 로 만든 것(scripts/publish-dist.sh). 손으로 고치지 않는다." > "$WT/README.md"
cd "$WT"
git add -A
git -c user.name="$(git -C "$ROOT" config user.name || echo scplay)" -c user.email="$(git -C "$ROOT" config user.email || echo scplay@localhost)" \
  commit -q -m "dist: $SRC" --allow-empty
git push -q origin HEAD:refs/heads/dist
git rev-parse HEAD
