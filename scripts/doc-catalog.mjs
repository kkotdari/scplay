/* 도록 일곱 장을 **정해진 이름**으로 한 번에 뽑는다(요청: "이름 형식 소스에 정해놓기") ──
 *
 *   node scripts/doc-catalog.mjs                    → <tmp>/dorok/ 에 7장 + list.txt (+ 도록.zip)
 *   node scripts/doc-catalog.mjs --out /path/dir    → 그 디렉터리에
 *   node scripts/doc-catalog.mjs --own "#2b62e8"    → 임자색(기본 파랑)
 *
 * 파일명 규약(정함: "units bldgs로 가자"):
 *   1. terran_units_blue.png   4. terran_bldgs_blue.png    7. extra.png
 *   2. protoss_units_blue.png  5. protoss_bldgs_blue.png   list.txt
 *   3. zerg_units_blue.png     6. zerg_bldgs_blue.png
 * 유닛·건물 시트 모두 임자색 이름(blue)이 붙는다(재요청).
 * 찍는 조건은 doc-sheet.mjs에 넘긴다: 4방위(45·135·225·315) · --narrow · 흰 배경(--bg) ·
 * 폭 660 · dpr 3. 목록(list.txt)은 ReplayMotionPlayer.tsx의 도록 표에서 그대로 읽는다. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const OUT = String(flag("--out", join(tmpdir(), "dorok")));
const OWN = String(flag("--own", "#2b62e8"));
const OWN_NAME = String(flag("--own-name", "blue"));   // 유닛·건물 시트 이름 꼬리
const ROTS = String(flag("--rots", "45,135,225,315"));
const WIDTH = String(flag("--width", "660"));
const DPR = String(flag("--dpr", "3"));
const ZIP = !argv.includes("--no-zip");

const RACE_EN = { 테란: "terran", 프로토스: "protoss", 저그: "zerg" };
/** 시트 일곱 장 — 차례가 곧 번호다. */
const SHEETS = [
  { group: "유닛", race: "테란" }, { group: "유닛", race: "프로토스" }, { group: "유닛", race: "저그" },
  { group: "건물", race: "테란" }, { group: "건물", race: "프로토스" }, { group: "건물", race: "저그" },
  { group: "부가", race: "전체" },
];
const nameOf = (i, s) => {
  const n = `${i + 1}. `;
  if (s.group === "유닛") return `${n}${RACE_EN[s.race]}_units_${OWN_NAME}.png`;
  if (s.group === "건물") return `${n}${RACE_EN[s.race]}_bldgs_${OWN_NAME}.png`;
  return `${n}extra.png`;
};

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [i, s] of SHEETS.entries()) {
  const file = join(OUT, nameOf(i, s));
  execFileSync(process.execPath, [
    join(ROOT, "scripts", "doc-sheet.mjs"), "--group", s.group, "--race", s.race,
    "--rots", ROTS, "--narrow", "--own", OWN, "--bg", "--width", WIDTH, "--dpr", DPR, "--out", file,
  ], { stdio: "inherit" });
}

// 목록 — 도록 표({ kind, label, group, race })를 그대로 읽는다.
const src = readFileSync(join(ROOT, "src", "components", "replay", "ReplayMotionPlayer.tsx"), "utf8");
const rows = [...src.matchAll(/\{ kind: "([^"]+)", label: "([^"]+)", group: "([^"]+)", race: "([^"]+)" \}/g)]
  .map(([, kind, label, group, race]) => ({ kind, label, group, race }));
const lines = [];
for (const [i, s] of SHEETS.entries()) {
  const sel = rows.filter((r) => r.group === s.group && (s.race === "전체" || r.race === s.race));
  lines.push(`## ${nameOf(i, s).replace(/\.png$/, "")} — ${s.group}${s.race === "전체" ? "" : " / " + s.race} (${sel.length}종)`);
  sel.forEach((r, k) => lines.push(`${String(k + 1).padStart(2)}. ${r.label} (${r.kind})`));
  lines.push("");
}
writeFileSync(join(OUT, "list.txt"), lines.join("\n"));

if (ZIP) {
  const zip = join(dirname(OUT), "도록.zip");
  rmSync(zip, { force: true });
  execFileSync("zip", ["-q", "-j", zip, ...SHEETS.map((s, i) => join(OUT, nameOf(i, s))), join(OUT, "list.txt")]);
  console.log(zip);
}
console.log(OUT);
