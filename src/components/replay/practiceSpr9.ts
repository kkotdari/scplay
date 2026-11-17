/* 연습실 그림판(2026-11-17 · practiceSim9 ★) — 재생기·도록과 **같은 GL 모델**(glIconRequest9 · 평면 카메라)을 방향 16개 × 임자색 둘로
   한 번 구워 2D 캔버스에 모아 둔다. 놀이 중에는 그 칸을 drawImage 로 찍기만 한다(GL 문맥을 따로 안 연다 · 도록 아이콘 그리개 하나를 빌린다).
   ★ 크기는 **원작 그대로**(2026-11-17 둘째, 요청: "원작 정보를 그대로 조사해서 구현해야해") — 재생기의 그리기 손잡이(UNIT_SIZE_GLOBAL 1.2 ·
   UNIT_SIZE_TUNE · BLD_DRAW_K 1.2 · BLD_DRAW_TUNE)를 안 탄다: 유닛은 모델 잉크가 units.dat 상자(기하평균 √(폭 × 높이) · UNIT_BW_TILES)만 하게,
   건물은 16-상자가 발자국 폭(타일 × 32)만 하게. 옛(같은 날 첫 판): unitTilesOf(×1.2 · 손보기) · 발자국 × 1.2 × 손보기 — 게다가 유닛 치수 열쇠를
   이름(Dropship)으로 넘겨 표를 못 찾고 등급 폴백으로 떨어지고 있었다. */
import { glIconOk9, glIconRequest9 } from "./gl9";
import { BUILDING_BASE_YAW, CLASS_TILES, FOOTPRINT, SHAPE_KIND, UNIT_3D, UNIT_BULK, UNIT_BW_TILES, modelInkOf } from "./engine9";
import { UNIT_DEFS9 } from "./practiceSim9";

export const PRAC_DIRS9 = 16;
export const PRAC_COLORS9: [string, string] = ["#3a7bff", "#e8402f"];

export interface PracSprite9 {
  /** 칸마다 캔버스(방향 × 임자) — 아직 안 구웠으면 null. */ cells: (HTMLCanvasElement | null)[][];
  /** 16-상자의 세계 크기(px) — 그릴 때 이만큼으로 편다. */ worldPx: number;
  dirs: number;
}

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
  return bw * (16 / modelInkOf(kind)) * 32;
}

/** 한 종류를 굽는다 — 다 구워지면 done. GL 이 안 서면 곧바로 null 칸으로 done(부르는 쪽이 동그라미로 그린다). */
export function bakePracSprite9(name: string, scale: number, done: (s: PracSprite9) => void): void {
  const { kind, bld } = drawKindOf9(name);
  const worldPx = pracWorldPx9(name);
  const dirs = bld ? 1 : PRAC_DIRS9;
  const out: PracSprite9 = { cells: [Array(dirs).fill(null), Array(dirs).fill(null)], worldPx, dirs };
  if (!glIconOk9()) { done(out); return; }
  const side = Math.max(24, Math.min(256, Math.round(worldPx * scale)));
  let left = dirs * 2;
  for (let own = 0; own < 2; own += 1) {
    for (let d = 0; d < dirs; d += 1) {
      /* 요잉 — 몸 각(0 = 오른쪽 · 시계방향 +)을 모델 요잉(도)으로. 실측: rotDeg 0 이 화면 아래를 본다 → −90° 를 더 돌린다. */
      const rot = bld ? BUILDING_BASE_YAW : (d / dirs) * 360 - 90;
      glIconRequest9({
        kind, bld, rotDeg: rot, pose: 0, spin: 0, w: side, h: side, color: PRAC_COLORS9[own], box: [0, 0, 16, 16], pad: 0,
        blit: (src, sx, sy, sw, sh) => {
          const c = document.createElement("canvas"); c.width = sw; c.height = sh;
          c.getContext("2d")?.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
          out.cells[own][d] = c;
        },
        done: () => { left -= 1; if (left === 0) done(out); },
      });
    }
  }
}
