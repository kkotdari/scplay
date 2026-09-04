/* CSS 관문 — 소스가 쓰는 클래스에 규칙이 있나.
 *
 * 이 자를 두는 까닭: 재생기를 앱에서 떼어낼 때 CSS를 **접두어 목록**으로 갈랐는데 그
 * 목록이 손으로 적은 것이라 넷이 빠졌다(scr-fx·scr-guide·scr-clickfx·scr-minimap-canvas).
 * 빠진 줄은 아무도 몰랐다 — 원래 앱에는 그 규칙이 남아 있어 거기서는 멀쩡히 보였고,
 * 패키지만 쓰는 앱에서만 조용히 사라졌기 때문이다. 눈으로 볼 수 없는 종류의 흠이라
 * 자에게 맡긴다.
 *
 * 쓰기: node scripts/css-guard.mjs        (어기면 1로 죽는다)
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "src";
const CSS = "src/components/replay/replay.css";

/* 앱이 주는 것 — 패키지가 얹혀 쓰는 디자인 토큰이라 여기 규칙이 없어도 맞다.
   쓰는 앱이 제 화장을 준다(README의 '앱이 꽂아 주는 것'과 같은 성격이다). */
const APP_TOKENS = new Set([
  "scr-btn", "scr-btn-ghost", "scr-btn-sm", "scr-btn-primary",
  "scr-title", "scr-icon-btn", "scr-mono", "scr-kakao-share-btn",
  "scr-game-result-trow", "scr-light-theme", "scr-btn-secondary",
]);

/* 화장이 아니라 **이름표**로만 붙는 것 — 규칙이 없는 게 맞다.
   (예: scr-mapvec-base/sharp은 검진 도구 perf-check --probe-mapvec이 '배율을 따라오는
   판'을 집으려고 단 표식이고, 배치는 부모 .scr-motion-mapvec이 한다.) */
const MARKERS = new Set(["scr-mapvec-base", "scr-mapvec-sharp"]);

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(SRC);

/* 소스가 **실제로 붙이는** 이름만 모은다 — className=…과 cx(…) 안이다.
   주석에 적힌 이름까지 세면 걷어낸 옛 자리가 흠으로 잡힌다. */
const used = new Set();
const prefixes = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/class[Nn]ame\s*=\s*\{?([^}>\n]{0,400})/g))
    for (const c of m[1].matchAll(/scr-[A-Za-z0-9_-]+/g)) used.add(c[0]);
  for (const m of s.matchAll(/cx\(([^)]{0,400})\)/g))
    for (const c of m[1].matchAll(/scr-[A-Za-z0-9_-]+/g)) used.add(c[0]);
  // `scr-fx-${갈래}`처럼 이어 붙이는 자리 — 접두어로만 볼 수 있다.
  for (const m of s.matchAll(/(scr-[A-Za-z0-9_-]*?)\$\{/g)) prefixes.add(m[1]);
}

const css = fs.readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
const declared = new Set();
for (const m of css.matchAll(/([^{}]+)\{/g))
  for (const c of m[1].matchAll(/\.(scr-[A-Za-z0-9_-]+)/g)) declared.add(c[1]);

const missing = [...used]
  .filter((c) => !c.endsWith("-"))                 // 접두어 조각 자체는 이름이 아니다
  .filter((c) => !APP_TOKENS.has(c) && !MARKERS.has(c))
  .filter((c) => !declared.has(c))
  // 이어 붙이는 자리의 뿌리는 갈래마다 이름이 달라 통짜로는 못 찾는다 — 접두어로 하나라도
  // 있으면 있는 것으로 본다.
  .filter((c) => ![...declared].some((d) => d.startsWith(c) || c.startsWith(d.slice(0, -1))))
  .sort();

if (missing.length === 0) {
  console.log(`CSS 관문 통과 — 붙이는 이름 ${used.size}개, 규칙 ${declared.size}개`);
  process.exit(0);
}
console.error(`✘ 규칙 없는 클래스 ${missing.length}개 — replay.css에 빠졌다:`);
for (const c of missing) console.error("   ." + c);
console.error("\n앱이 주는 토큰이면 APP_TOKENS에, 표식일 뿐이면 MARKERS에 적어라.");
process.exit(1);
