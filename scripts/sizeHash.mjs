/* 크기표 해시(2026-11-03, 요청: "다음부터는 크기 변경 시 표도 스크립트로 로컬에서 재생성하게 해줘") ──────────────────────────
 *  2D 판 단 올림표(sprLift.gen.ts)는 크기표(engine9 MODEL_NORM · BLD_NORM · UNIT_SIZE_TUNE · BLD_DRAW_TUNE · BLD_DRAW_K)가 바뀌면 다시 재야 한다.
 *  그 다섯의 소스 글자(줄 끝 LF)를 해시해 spr-lift 가 표에 적고(SPR_LIFT_SRC9), spr-atlas --bake 가 다르면 굽기 전에 spr-lift 를 먼저 돌린다(로컬 GPU). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NAMES = ["MODEL_NORM", "BLD_NORM", "UNIT_SIZE_TUNE", "BLD_DRAW_TUNE"];
export function sizeHash(root) {
  const src = readFileSync(join(root, "src/components/replay/engine9.ts"), "utf8").replace(/\r\n/g, "\n");
  const h = createHash("sha1");
  for (const n of NAMES) {
    const i = src.indexOf(`export const ${n}`);
    if (i < 0) throw new Error(`크기표 ${n} 를 못 찾았다`);
    const j = src.indexOf("\n};", i);
    h.update(src.slice(i, j < 0 ? i + 4000 : j + 3));
  }
  h.update(/^export const BLD_DRAW_K = .*$/m.exec(src)?.[0] ?? "");
  return h.digest("hex").slice(0, 12);
}
/** 표(sprLift.gen.ts)에 적힌 해시 — 없으면 "". */
export function sizeHashOfGen(root) {
  try { return /SPR_LIFT_SRC9 = "([0-9a-f]*)"/.exec(readFileSync(join(root, "src/components/replay/sprLift.gen.ts"), "utf8"))?.[1] ?? ""; } catch { return ""; }
}
