/* 2D 판 단 올림표 — **미리 구운 것**(자동 생성) ──────────────────────────────────────────
 *  만드는 법: `node scripts/spr-lift.mjs` · 검사: `node scripts/spr-lift.mjs --check`
 *  손으로 고치지 않는다. 종류 → 찍는 단(gl9 sprLv9)에 더할 ¼ 옥타브 칸 수. 늘림은 유닛 중간값(0.752)에 견준 배(올림 전 → 뒤 · 목표 1.3 이하).
 *  ★ 모델·크기표(MODEL_NORM·BLD_NORM·UNIT_SIZE_TUNE·BLD_DRAW_TUNE)를 고치면 다시 뽑고 아틀라스도 다시 굽는다. */
export const SPR_LIFT9: Record<string, number> = {
  "arbiter": 2,   // 늘림 1.74 → 1.23
  "bc": 6,   // 늘림 3.29 → 1.16
  "carrier": 5,   // 늘림 3.04 → 1.28
  "cavern": 1,   // 늘림 1.41 → 1.19
  "corsair": 1,   // 늘림 1.34 → 1.12
  "cube": 1,   // 늘림 1.46 → 1.23
  "devourer": 2,   // 늘림 1.62 → 1.14
  "ebay": 2,   // 늘림 1.79 → 1.26
  "guardian": 4,   // 늘림 2.34 → 1.17
  "hive": 1,   // 늘림 1.50 → 1.26
  "lair": 1,   // 늘림 1.48 → 1.24
  "lurker": 1,   // 늘림 1.37 → 1.15
  "muta": 4,   // 늘림 2.21 → 1.11
  "ovie": 2,   // 늘림 1.57 → 1.11
  "pyramidWide": 1,   // 늘림 1.42 → 1.19
  "queen": 4,   // 늘림 2.21 → 1.10
  "tankbody": 3,   // 늘림 2.16 → 1.28
  "ultra": 2,   // 늘림 1.80 → 1.28
  "vessel": 3,   // 늘림 1.95 → 1.16
};
