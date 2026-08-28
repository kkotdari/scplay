/* 모델 관문 — **깊이 열쇠에 높이가 실렸나**를 본다(지적: "깊이에 높이 미적용은 앞으로
 * 그런 일 없게 모델링 관문에서 검사하도록").
 *
 *   node scripts/model-depth-check.mjs            (어긴 빌더가 있으면 종료코드 1)
 *   node scripts/model-depth-check.mjs --list     (기준선에 든 옛 모델까지 다 보인다)
 *   node scripts/model-depth-check.mjs --baseline (지금 상태로 기준선을 다시 찍는다)
 *
 * ── 무엇이 문제였나 ────────────────────────────────────────────────────────────────
 * depthNow는 바닥 자리(x·y)만 잰다 — 높이는 안 본다. 평평한 몸에서는 그래도 되지만, 같은
 * 자리 **위아래로 쌓인** 부품(배 아래 매단 포신, 날개 끝에 겹쳐 단 미사일 둘)은 x·y가 같아
 * 열쇠도 같다. 열쇠가 같으면 배열 차례가 앞뒤를 정하는데, 그 차례는 요잉이 돌아도 안 바뀌므로
 * **어느 각도에서는 반드시 틀린다**. 실제로 레이스·배틀크루저에서 그 일이 났고, 배열 차례를
 * 바꿔 옆모습만 고쳤다가 요잉을 돌리면 도로 뒤집혔다.
 * 답은 partKey다 — depthNow에 `z × heightDepthK()`를 얹어 높이를 깊이로 환산한다.
 *
 * ── 이 관문이 보는 것 ──────────────────────────────────────────────────────────────
 * SHAPE_BUILDERS의 빌더마다, 깊이 열쇠를 짓는 자리에 partKey(또는 heightDepthK)가 쓰였나.
 * 안 쓰고 depthNow만 쓰면 '높이 없는 열쇠'로 본다.
 *
 * 왜 전수 강제가 아니라 기준선인가: 이 파일에는 오래된 모델이 백 종 넘게 있고, 그 대부분은
 * 바닥에 붙은 건물이라 높이가 앞뒤를 안 가른다. 그것들까지 한꺼번에 고치면 검증할 수 없는
 * 큰 변경이 되고, 관문은 곧 끄고 싶은 잔소리가 된다. 그래서 **지금 어기고 있는 것들을
 * 기준선에 적어 두고, 그 밖에서 새로 어기는 것만 막는다** — 새로 짜거나 다시 짠 모델은
 * partKey를 써야 하고, 고칠 때마다 그 이름이 기준선에서 빠진다(줄어들기만 하는 목록이다).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src/components/replay/ReplayMotionPlayer.tsx");
const BASE = join(ROOT, "scripts/model-depth-baseline.json");

/** SHAPE_BUILDERS 객체의 본문만 잘라 낸다 — 표(MUZZLE_ANCHOR 등)까지 훑으면 이름이 겹친다. */
function buildersBody(src) {
  const at = src.indexOf("const SHAPE_BUILDERS");
  if (at < 0) throw new Error("SHAPE_BUILDERS를 못 찾았다");
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error("SHAPE_BUILDERS의 끝을 못 찾았다");
}

/** 본문을 빌더별로 나눈다 — 중괄호 깊이 0에서 `이름:`으로 시작하는 자리가 경계다. */
function splitBuilders(body) {
  const out = [];
  let depth = 0;
  let cur = null;
  const lines = body.split("\n");
  for (const line of lines) {
    if (depth === 0) {
      const m = /^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:/.exec(line);
      if (m) {
        if (cur) out.push(cur);
        cur = { name: m[1], text: "" };
      }
    }
    if (cur) cur.text += `${line}\n`;
    for (const c of line) {
      if (c === "{" || c === "[" || c === "(") depth += 1;
      else if (c === "}" || c === "]" || c === ")") depth -= 1;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const src = readFileSync(SRC, "utf8");
const parts = splitBuilders(buildersBody(src));
/* 깊이 열쇠를 짓는 자리에 높이가 실렸나 — partKey를 쓰거나 heightDepthK를 손수 얹었으면
   지킨 것이다. 깊이 열쇠 자체를 안 쓰는 빌더(제 자리가 하나뿐인 작은 모델)는 볼 것이 없다. */
const bad = parts
  .filter((p) => /\bdepthNow\s*\(/.test(p.text))
  .filter((p) => !/\bpartKey\b|\bheightDepthK\b/.test(p.text))
  .map((p) => p.name);

const argv = process.argv.slice(2);
if (argv.includes("--baseline")) {
  writeFileSync(BASE, `${JSON.stringify({ legacy: bad }, null, 2)}\n`);
  console.log(`기준선을 다시 찍었다 — 옛 모델 ${bad.length}종`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASE, "utf8")).legacy;
const known = new Set(baseline);
const fresh = bad.filter((n) => !known.has(n));
const fixed = baseline.filter((n) => !bad.includes(n));

console.log(`빌더 ${parts.length}종 · 높이 없는 열쇠 ${bad.length}종`
  + ` (기준선 ${baseline.length} · 새로 어김 ${fresh.length} · 고쳐짐 ${fixed.length})`);
if (argv.includes("--list") && bad.length > 0) console.log(`  기준선: ${bad.join(", ")}`);
if (fixed.length > 0) {
  console.log(`  ✔ 고쳐진 모델: ${fixed.join(", ")}`);
  console.log("    → node scripts/model-depth-check.mjs --baseline 으로 기준선을 줄여라.");
}
if (fresh.length > 0) {
  console.error(`\n✘ 높이 없는 깊이 열쇠: ${fresh.join(", ")}`);
  console.error("  부품 열쇠는 partKey(x, y, z)로 지어라 — depthNow만 쓰면 같은 자리 위아래로");
  console.error("  쌓인 부품이 어느 요잉에서 반드시 앞뒤가 뒤집힌다(이 파일 머리말).");
  process.exit(1);
}
console.log("✔ 새로 어긴 모델 없음");
