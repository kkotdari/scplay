/* 연습실 그림 자(2026-11-17 · practiceSim9 ★) — 임자색 · 몸 크기. 셋째 판(같은 날, 요청: "지형과 모델 화질 재생기수준으로")부터 몸은 판을 굽지 않고
   GL 메시를 화면 배율 그대로 그린다(PracticeRoom ②) — 옛 16방 판 굽기(bakePracSprite9 · 방향 16 × 임자 둘 · 늘여 찍어 흐렸다)는 걷었다.
   ★ 크기는 **원작 그대로**(2026-11-17 둘째, 요청: "원작 정보를 그대로 조사해서 구현해야해") — 재생기의 그리기 손잡이(UNIT_SIZE_GLOBAL 1.2 ·
   UNIT_SIZE_TUNE · BLD_DRAW_K 1.2 · BLD_DRAW_TUNE)를 안 탄다: 유닛은 모델 잉크가 units.dat 상자(기하평균 √(폭 × 높이) · UNIT_BW_TILES)만 하게,
   건물은 16-상자가 발자국 폭(타일 × 32)만 하게(셋째 판: 거기에 BLD_NORM — 모델 잉크를 16-상자에 맞춘 종류 배수 — 를 곱하고 잉크 바닥을 발자국 아랫변에 앉힌다 · PracticeRoom). 옛(같은 날 첫 판): unitTilesOf(×1.2 · 손보기) · 발자국 × 1.2 × 손보기 — 게다가 유닛 치수 열쇠를
   이름(Dropship)으로 넘겨 표를 못 찾고 등급 폴백으로 떨어지고 있었다. */
import { BLD_DRAW_TUNE, FOOTPRINT, SHAPE_KIND, UNIT_3D, UNIT_BULK, bldDrawK9, unitTilesOf } from "./engine9";
import { buildingBox } from "../../utils/bwUnits";
import { UNIT_DEFS9 } from "./practiceSim9";

export const PRAC_COLORS9: [string, string] = ["#3a7bff", "#e8402f"];

/** 그리는 모델 종류(건물 · 자원 · 유닛). */
const drawKindOf9 = (name: string): { kind: string; bld: boolean } => {
  const def = UNIT_DEFS9[name];
  if (name === "Mineral Field") return { kind: "mineral", bld: true };
  if (name === "Vespene Geyser") return { kind: "geyser", bld: true };
  if (def?.bld) return { kind: SHAPE_KIND[name] ?? "tomb", bld: true };
  return { kind: UNIT_3D[name] ?? "gunner", bld: false };
};
/** 16-상자의 세계 크기(px) — **재생기와 똑같이**(2026-11-17 열한째, 요청: "재생기랑 크기 똑같이"):
 *  유닛 = 32 × unitTilesOf(원작 치수 × 잉크 몫 × 종류별 tune × 전체 1.2) · 건물 = 몸 상자 폭(buildingBox) × 32 × bldDrawK9(1.2) × BLD_DRAW_TUNE ·
 *  미네랄 2.4 타일 · 가스 3.84 × 0.8 타일. 모델 배수(MODEL_NORM · BLD_NORM)는 그리는 쪽(PracticeRoom)이 곱한다(재생기 gk9 와 같은 자리).
 *  옛(같은 날 둘째 · "원작 크기"): 유닛 원작 상자 × 잉크 몫(tune · 1.2 · 모델 배수 없음) · 건물 발자국 폭(1.2 · tune 없음). */
export function pracWorldPx9(name: string): number {
  const { kind, bld } = drawKindOf9(name);
  if (name === "Mineral Field") return 2.4 * 32;
  if (name === "Vespene Geyser") return 3.84 * 0.8 * 32;
  if (bld) {
    const tune = BLD_DRAW_TUNE[kind] ?? 1;
    return buildingBox(name)[0] * 32 * bldDrawK9(kind, FOOTPRINT[name]?.[0] ?? 3, tune) * tune;
  }
  return 32 * unitTilesOf(kind, kind, (UNIT_BULK[name] ?? 1) as 0 | 1 | 2);
}
