/* 연습실 그림판(2026-11-17 · practiceSim9 ★) — 재생기·도록과 **같은 GL 모델**(glIconRequest9 · 평면 카메라)을 방향 16개 × 임자색 둘로
   한 번 구워 2D 캔버스에 모아 둔다. 놀이 중에는 그 칸을 drawImage 로 찍기만 한다(GL 문맥을 따로 안 연다 · 도록 아이콘 그리개 하나를 빌린다).
   크기는 재생기와 같은 자: 유닛은 16-상자 = unitTilesOf(원작 치수 × 16 / 잉크) 타일 · 건물은 발자국 폭 × bldDrawK9 × 손보기. */
import { glIconOk9, glIconRequest9 } from "./gl9";
import { BLD_DRAW_TUNE, BUILDING_BASE_YAW, FOOTPRINT, SHAPE_KIND, UNIT_3D, UNIT_BULK, bldDrawK9, unitTilesOf } from "./engine9";
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
    const tune = BLD_DRAW_TUNE[kind] ?? 1;
    return fp[0] * 32 * bldDrawK9(kind, fp[0], tune) * tune;
  }
  return unitTilesOf(kind, name, UNIT_BULK[name] ?? 1) * 32;
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
