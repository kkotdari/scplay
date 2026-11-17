/* 연습실 그림 자(2026-11-17 · practiceSim9 ★) — 임자색 · 몸 크기. 셋째 판(같은 날, 요청: "지형과 모델 화질 재생기수준으로")부터 몸은 판을 굽지 않고
   GL 메시를 화면 배율 그대로 그린다(PracticeRoom ②) — 옛 16방 판 굽기(bakePracSprite9 · 방향 16 × 임자 둘 · 늘여 찍어 흐렸다)는 걷었다.
   ★ 크기는 **원작 그대로**(2026-11-17 둘째, 요청: "원작 정보를 그대로 조사해서 구현해야해") — 재생기의 그리기 손잡이(UNIT_SIZE_GLOBAL 1.2 ·
   UNIT_SIZE_TUNE · BLD_DRAW_K 1.2 · BLD_DRAW_TUNE)를 안 탄다: 유닛은 모델 잉크가 units.dat 상자(기하평균 √(폭 × 높이) · UNIT_BW_TILES)만 하게,
   건물은 16-상자가 발자국 폭(타일 × 32)만 하게(셋째 판: 거기에 BLD_NORM — 모델 잉크를 16-상자에 맞춘 종류 배수 — 를 곱하고 잉크 바닥을 발자국 아랫변에 앉힌다 · PracticeRoom). 옛(같은 날 첫 판): unitTilesOf(×1.2 · 손보기) · 발자국 × 1.2 × 손보기 — 게다가 유닛 치수 열쇠를
   이름(Dropship)으로 넘겨 표를 못 찾고 등급 폴백으로 떨어지고 있었다. */
import { CLASS_TILES, FOOTPRINT, SHAPE_KIND, UNIT_3D, UNIT_BULK, UNIT_BW_TILES, UNIT_SIZE_TUNE, modelInkOf } from "./engine9";
import { UNIT_DEFS9 } from "./practiceSim9";

export const PRAC_COLORS9: [string, string] = ["#3a7bff", "#e8402f"];

const drawKindOf9 = (name: string): { kind: string; bld: boolean } => {
  const def = UNIT_DEFS9[name];
  if (name === "Mineral Field") return { kind: "mineral", bld: true };
  if (def?.bld) return { kind: SHAPE_KIND[name] ?? "tomb", bld: true };
  return { kind: UNIT_3D[name] ?? "gunner", bld: false };
};
/** 16-상자의 세계 크기(px). */
export function pracWorldPx9(name: string): number {
  const { kind, bld } = drawKindOf9(name);
  if (name === "Mineral Field") return 2 * 32 * 1.15;
  if (bld) {
    const fp = FOOTPRINT[name] ?? UNIT_DEFS9[name]?.foot ?? [3, 2];
    return fp[0] * 32;
  }
  const bw = UNIT_BW_TILES[kind] ?? CLASS_TILES[(UNIT_BULK[name] ?? 1) as 0 | 1 | 2];
  /* 재생기의 종류별 크기 손보기(UNIT_SIZE_TUNE — 탱크 1.25 · 질럿 1.1 · 럴커 1.1 · 뮤탈 0.9 …)는 탄다(2026-11-17, 지적: "유닛 크기 tune 적용안된거같음") ·
     전체 배수(UNIT_SIZE_GLOBAL 1.2)는 원작 크기 기준이라 안 탄다. */
  return bw * (16 / modelInkOf(kind)) * 32 * (UNIT_SIZE_TUNE[kind] ?? 1);
}
