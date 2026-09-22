#!/bin/sh
# 변천사 도록 한 번에 뽑기 — 세 시대를 굽고 절 조각까지 합친다.
#   sh scripts/history/hist-run.sh <scratch> [--old]
# <scratch> 에 도록 목록(dorok/list.txt)이 있어야 한다.
# ★ 7월·8/29 열은 **딴 저장소·딴 커밋의 작업 트리**에서 그 시대 붓으로 굽는다(2026-09, 요청: "stargayte …
#   7월에 쓰던 레포지토리야 · 이걸 이용해서 변천사 목록을 새롭게 뽑을 수 있을거야"):
#     $S/wtJ  7월  — kkotdari/stargayte 8ddd494(2026-08-14 · 단색 초록 · 도록 96종이 선 그 판)
#     $S/wtA  8/29 — kkotdari/scplay   1e20b08
#   둘 다 `node_modules` 심볼릭 링크 + `scripts/hist-shot.mjs`(model-shot 사본 · --fit/--shadow/새 헤드리스)가 있어야 한다.
#   --old 를 안 주면 이미 구운 histJ_*·histA_* 를 그대로 쓴다.
set -e
S="$1"; [ -n "$S" ] || { echo "usage: hist-run.sh <scratch> [--old]"; exit 1; }
cd "$(dirname "$0")/../.."
H=scripts/history
# ⚠ 목록은 **늘 덮어쓴다** — 스크래치에 옛 사본이 남아 있으면 저장소에서 종류를 빼도 그 판이 그대로 굽힌다
#   (실측: egg·lurkeregg·mutacocoon 을 kinds_u.txt 에서 뺐는데 옛 사본 때문에 카드가 그대로 섰다).
cp $H/kinds_u.txt $H/kinds_b.txt "$S/"
KU=$(cat "$S/kinds_u.txt"); KB=$(cat "$S/kinds_b.txt")
# 시대별 카메라(hist-compose ERAS 와 같은 수): 7월·8/29 +45 · 지금 +40 · 임자색 연녹색 · 흰 바탕 · 그림자는 유닛·건물 다.
OWN="#7ed491"; BG="#ffffff"
node scripts/model-gl.mjs --kinds "$KU" --rots 40 --cell 400 --rows 300 --bg "$BG" --color "$OWN" --fit 0.7 --shadow --json "$S/histC_u.json" --out "$S/histC_u.png" 2>&1 | tail -1
node scripts/model-gl.mjs --kinds "$KB" --rots 40 --cell 400 --rows 300 --bg "$BG" --color "$OWN" --fit 0.7 --shadow --json "$S/histC_b.json" --out "$S/histC_b.png" 2>&1 | tail -1
if [ "$2" = "--old" ]; then
  for w in J:wtJ A:wtA; do
    e="${w%%:*}"; d="${w##*:}"
    ( cd "$S/$d"
      node scripts/hist-shot.mjs --kinds "$KU" --rots 45 --mode top --cell 400 --bg "$BG" --color "$OWN" --fit 0.7 --shadow --out "$S/hist${e}_u.png" 2>&1 | tail -1
      node scripts/hist-shot.mjs --kinds "$KB" --rots 45 --mode top --cell 400 --bg "$BG" --color "$OWN" --fit 0.7 --shadow --out "$S/hist${e}_b.png" 2>&1 | tail -1 )
  done
fi
# 절마다 두 토막(요청: "각 목록을 둘로 나눠서 12장으로 줘") — 첫 decode 가 가끔 EncodingError 로 튄다: 세 번까지 되돌린다.
for i in 1 2 3; do node scripts/history/hist-compose.mjs "$S" --split=2 2>&1 | grep -v "^  [A-Z]\|^    at" | tail -4 && break; echo retry; done
rm -rf "$S/hist_out"; mkdir -p "$S/hist_out"
n=0
for r in "1. terran:terran" "2. protoss:protoss" "3. zerg:zerg"; do
  src="${r%%:*}"; name="${r##*:}"
  for sec in "1_units:units" "2_bldgs:bldgs"; do
    for h in 1 2; do
      n=$((n+1)); cp "$S/변천사/${src}_history_${sec%%:*}_${h}.png" "$S/hist_out/$(printf %02d $n)_${name}_${sec##*:}_${h}.png"
    done
  done
done
echo "HIST_DONE → $S/hist_out (열두 조각 · 파일로 보낸다)"
