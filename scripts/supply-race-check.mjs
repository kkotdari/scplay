/* 보급 표의 종족 가르기 검산(2026-10) ─────────────────────────────────────────────
 *
 *   node scripts/supply-race-check.mjs            SUPPLY_COST·SUPPLY_GIVES 의 모든 이름이 종족을 얻는지 + 예외표 자물쇠
 *
 * 왜: 인구 풀을 몸의 종족으로 가르는 raceOfBwKind9(bwUnits.ts)는 units.dat 번호 띠로 가르는데, 확장팩 유닛이 띠 밖에 끼어 있다
 * (발키리 58 은 저그 띠 · 디바우러 62 는 프로토스 띠 · 럴커 103 은 중립 띠). 첫 판이 그 함정에 빠져 정구(테란)의 발키리 셋이
 * 저그 풀 "저 9/8" 로 섰다(perf-check --mc 실측). 예외표를 고치거나 보급 표에 이름을 더하면 여기부터 돌려라. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "supply-race-"));
const out = join(dir, "bwUnits.mjs");
await build({ entryPoints: [join(ROOT, "src/utils/bwUnits.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning" });
const { raceOfBwKind9, SUPPLY_COST, SUPPLY_GIVES } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

/* 예외표 자물쇠 — 띠 밖 유닛·앱 별칭·중립 하나. 틀리면 그 풀이 조용히 엉뚱한 줄에 선다. */
const EXPECT = {
  Valkyrie: "테란", Medic: "테란", "Siege Tank": "테란", "Siege Tank (Siege Mode)": "테란", "Supply Depot": "테란",
  Devourer: "저그", Lurker: "저그", "Lurker Egg": "저그", "Mutalisk Cocoon": "저그", Cocoon: "저그", "Infested Terran": "저그", Overlord: "저그", Hatchery: "저그",
  Corsair: "프로토스", "Dark Archon": "프로토스", "Dark Templar": "프로토스", Pylon: "프로토스", Nexus: "프로토스",
  "Mineral Field (Type 1)": "", "Vespene Geyser": "",
};
let bad = 0;
for (const [k, want] of Object.entries(EXPECT)) {
  const got = raceOfBwKind9(k);
  if (got !== want) { bad += 1; console.log(`✗ ${k}: ${JSON.stringify(got)} (바람 ${JSON.stringify(want)})`); }
}
const byRace = { 테란: [], 저그: [], 프로토스: [], "": [] };
for (const k of new Set([...Object.keys(SUPPLY_COST), ...Object.keys(SUPPLY_GIVES)])) byRace[raceOfBwKind9(k)].push(k);
for (const r of ["테란", "저그", "프로토스"]) console.log(`${r}(${byRace[r].length}): ${byRace[r].join(" · ")}`);
if (byRace[""].length) { bad += byRace[""].length; console.log(`✗ 종족 못 가린 보급 표 이름: ${byRace[""].join(" · ")}`); }
console.log(bad ? `✗ ${bad}개 어긋남` : "✓ 보급 표의 종족 가르기 통과");
process.exit(bad ? 1 : 0);
