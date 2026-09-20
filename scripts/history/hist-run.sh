#!/bin/sh
# 변천사 도록 한 번에 뽑기 — 지금 판(histC_* 넷)을 굽고 절 조각까지 합친다.
#   sh scripts/history/hist-run.sh <scratch> [--old]
# <scratch> 에 7월 그림(july_t/p/z.png · july_rows.json)·도록 목록(dorok/list.txt)·8/29 판(histA_*)이 있어야 한다.
# --old 는 8/29 판도 다시 굽는다(<scratch>/wtA 에 1e20b08 작업 트리 + node_modules 링크 + --fit 을 손으로 넣은 model-shot 사본이 있을 때).
set -e
S="$1"; [ -n "$S" ] || { echo "usage: hist-run.sh <scratch> [--old]"; exit 1; }
cd "$(dirname "$0")/../.."
H=scripts/history
[ -f "$S/kinds_u.txt" ] || cp $H/kinds_u.txt "$S/"
[ -f "$S/kinds_b.txt" ] || cp $H/kinds_b.txt "$S/"
KU=$(cat "$S/kinds_u.txt"); KB=$(cat "$S/kinds_b.txt")
node scripts/model-gl.mjs --kinds "$KU" --rots 315 --cell 400 --rows 300 --bg "#0a0a0a" --fit 0.7 --json "$S/histC_u.json"   --out "$S/histC_u.png"   2>&1 | tail -1
node scripts/model-gl.mjs --kinds "$KU" --rots 337 --cell 400 --rows 300 --bg "#0a0a0a" --fit 0.7 --json "$S/histC_u23.json" --out "$S/histC_u23.png" 2>&1 | tail -1
node scripts/model-gl.mjs --kinds "$KB" --rots 337 --cell 400 --rows 300 --bg "#0a0a0a" --fit 0.7 --json "$S/histC_b.json"   --out "$S/histC_b.png"   2>&1 | tail -1
node scripts/model-gl.mjs --kinds "$KB" --rots 315 --cell 400 --rows 300 --bg "#0a0a0a" --fit 0.7 --json "$S/histC_b45.json" --out "$S/histC_b45.png" 2>&1 | tail -1
if [ "$2" = "--old" ]; then
  ( cd "$S/wtA"
    node scripts/model-shot.mjs --kinds "$KU" --rots 315 --mode top --cell 400 --bg "#0a0a0a" --fit 0.7 --out "$S/histA_u.png"   2>&1 | tail -1
    node scripts/model-shot.mjs --kinds "$KU" --rots 337 --mode top --cell 400 --bg "#0a0a0a" --fit 0.7 --out "$S/histA_u23.png" 2>&1 | tail -1
    node scripts/model-shot.mjs --kinds "$KB" --rots 337 --mode top --cell 400 --bg "#0a0a0a" --fit 0.7 --out "$S/histA_b.png"   2>&1 | tail -1
    node scripts/model-shot.mjs --kinds "$KB" --rots 315 --mode top --cell 400 --bg "#0a0a0a" --fit 0.7 --out "$S/histA_b45.png" 2>&1 | tail -1 )
fi
# 첫 decode 가 가끔 EncodingError 로 튄다 — 세 번까지 되돌린다.
for i in 1 2 3; do node scripts/history/hist-compose.mjs "$S" 2>&1 | grep -v "^  [A-Z]\|^    at" | tail -4 && break; echo retry; done
mkdir -p "$S/hist_out"
cp "$S/변천사/1. terran_history_1_units.png"  "$S/hist_out/1_terran_units.png"
cp "$S/변천사/1. terran_history_2_bldgs.png"  "$S/hist_out/2_terran_bldgs.png"
cp "$S/변천사/2. protoss_history_1_units.png" "$S/hist_out/3_protoss_units.png"
cp "$S/변천사/2. protoss_history_2_bldgs.png" "$S/hist_out/4_protoss_bldgs.png"
cp "$S/변천사/3. zerg_history_1_units.png"    "$S/hist_out/5_zerg_units.png"
cp "$S/변천사/3. zerg_history_2_bldgs.png"    "$S/hist_out/6_zerg_bldgs.png"
echo "HIST_DONE → $S/hist_out (여섯 조각 · 파일로 보낸다)"
