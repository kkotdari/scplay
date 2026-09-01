/* 도록 판형 그림 뽑개(요청: "도록 화면의 테마와 모델 렌더링으로 담아 줘 — 그림자
 * 반사광 등") ─────────────────────────────────────────────────────────────────────
 *
 *   node scripts/doc-sheet.mjs --group 유닛 --race 테란 --out /tmp/t-unit.png
 *   node scripts/doc-sheet.mjs --group 부가 --css ../scplayer/src/styles/global.css
 *
 * model-shot.mjs와 무엇이 다른가 — **그리는 길이 다르다.**
 * model-shot은 면 목록을 캔버스에 손으로 칠한다(도구의 제 그림). 이 도구는 앱이 쓰는
 * 그 컴포넌트(ShapeIcon)를 진짜 리액트로 띄우고, 앱 CSS(scplayer/global.css)와 모듈
 * CSS(scplay/replay.css)를 그대로 얹어 **도록 화면을 그대로 찍는다**. 그래서 칸 테두리·
 * 패널 바탕·글자 색 같은 테마도, `.scr-motion-shape-svg`의 drop-shadow 같은 렌더링도
 * 화면에서 보는 것과 한 픽셀도 안 다르다.
 * CSS 차례가 요점이다 — 앱 CSS가 먼저, 모듈 CSS가 나중이다(scplay README의 규약).
 * 도록의 `.scr-doc .scr-doc-svg`가 그 규약을 이기려고 한 단 올려 잡혀 있으므로, 차례를
 * 뒤집으면 SVG가 1em(16px)에 갇혀 모델이 점이 된다. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };

const GROUP = String(flag("--group", "유닛"));          // 유닛 · 건물 · 부가
const RACE = String(flag("--race", "전체"));            // 전체 · 테란 · 프로토스 · 저그
const ROTS = String(flag("--rots", "0,45,90,135,180,225,270,315")).split(",").map(Number);
const WIDTH = Number(flag("--width", 1280));            // 페이지 폭(칸 크기가 여기서 난다)
const DPR = Number(flag("--dpr", 2));
const APP_CSS = String(flag("--css", join(ROOT, "..", "scplayer", "src", "styles", "global.css")));
const OUT = String(flag("--out", join(tmpdir(), "doc-sheet.png")));
/* --narrow — 도록 화면이 **폰에서 쓰는 그 배치**(GalleryScreen의 `is-narrow`)로 뽑는다.
   그 클래스가 붙으면 앱 CSS가 격자를 8열 → 4열로, 560px 아래에서는 다시 2열로 눕히고
   모델 칸의 높이도 104 → 132px로 키운다. 폭만 좁히고 이 클래스를 안 붙이면 8열 격자가
   그대로 남아 방위 넷을 넣어도 절반이 빈 채 칸만 홀쭉해진다(첫 판이 그랬다). */
const NARROW = argv.includes("--narrow");
/* --own — 임자색(칠 안 한 면이 먹는 currentColor). 도록 화면은 `--scr-doc-own`으로
   고정 연두를 주는데, 종이로 뽑을 때는 다른 색이 필요할 때가 있다(요청: 빨강).
   변수만 덮어쓰면 되는 자리라 앱 CSS를 안 건드린다. */
const OWN = String(flag("--own", ""));

/* ── 브라우저에 넣을 번들 ─────────────────────────────────────────────────────── */
const ENTRY = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { SHAPE_GALLERY, ShapeIcon } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
window.__docSheet = (group, race, rots, narrow) => {
  const rows = SHAPE_GALLERY.filter((g) => g.group === group && (race === "전체" || g.race === race));
  const host = document.getElementById("host");
  /* 도록 화면(GalleryScreen)의 마크업 그대로다 — 고르기 줄과 돌아가기 버튼만 뺀다
     (그림에는 담을 것이 아니고, 담으면 종이의 절반을 먹는다). 괄호를 깊게 겹치지 않고
     한 칸씩 이름 붙여 짓는다 — 겹치면 닫는 수를 세다 틀린다(첫 판이 그랬다). */
  const angleCell = (kind, deg) => h("div", { key: deg, className: "scr-doc-angle" }, [
    h(ShapeIcon, { key: "m", kind, rotDeg: deg, fit: true, className: "scr-doc-svg" }),
    h("span", { key: "d" }, deg + "\u00b0"),
  ]);
  const itemRow = (it) => h("section", { key: it.kind, className: "scr-doc-item" }, [
    h("header", { key: "h", className: "scr-doc-itemhead" }, [
      h("h3", { key: "t" }, it.label),
      it.race ? h("span", { key: "r", className: "scr-doc-race" }, it.race) : null,
      h("span", { key: "k", className: "scr-doc-kind" }, it.kind),
    ]),
    h("div", {
      key: "a",
      className: "scr-doc-angles" + (narrow ? " is-narrow" : ""),
    }, rots.map((d) => angleCell(it.kind, d))),
  ]);
  const list = h("div", { className: "scr-doc-list" }, rows.map(itemRow));
  createRoot(host).render(h("div", { className: "scr-doc" }, list));
  return rows.length;
};
`;

function bundle() {
  /* 임시 파일을 **저장소 안에** 짓는다 — 밖(tmp)에 두면 esbuild가 거기서부터
     node_modules를 찾아 올라가느라 react를 못 만난다(model-shot은 절대경로만 들여와서
     이 문제가 안 났다). */
  const dir = mkdtempSync(join(ROOT, ".docsheet-"));
  const src = join(dir, "entry.tsx");
  const out = join(dir, "entry.mjs");
  writeFileSync(src, ENTRY);
  const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
  const head = readFileSync(ebin).subarray(0, 4);
  const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
  const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
    || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
  const args = [src, "--bundle", "--format=esm", "--log-level=error", "--loader:.tsx=tsx",
    "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
  execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const js = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return js;
}

const js = bundle();
const { chromium } = await import("playwright-core");
const CANDIDATES = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
/* 새 크로미엄은 옛 헤드리스를 걷어냈다 — model-shot과 같은 되물림. */
const browser = await chromium.launch(launchOpt).catch((e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] });
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: DPR });
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 300)));

const appCss = existsSync(APP_CSS) ? readFileSync(APP_CSS, "utf8") : "";
if (!appCss) console.warn(`⚠ 앱 CSS 없음(${APP_CSS}) — 테마 없이 뽑는다.`);
const modCss = readFileSync(join(ROOT, "src/components/replay/replay.css"), "utf8");

await page.setContent(`<!doctype html><meta charset="utf-8"><body><div id="host"></div></body>`);
/* addStyleTag·addScriptTag는 이 오리진(about:blank)에서 onerror가 뜬다 — DOM으로 직접
   붙인다(perf-check.mjs가 같은 자리에서 같은 되물림을 쓴다).
   차례가 규약이다 — 앱 CSS 먼저, 모듈 CSS 나중(위 머리 주석). */
const sheetCss = `
  html, body { background: var(--void, #0d1014); }
  #host { padding: 20px 22px 26px; }
  .scr-doc-kind { margin-left: 8px; font-size: 11px; color: var(--text-dim); font-family: ui-monospace, monospace; }
  ${OWN ? `.scr-doc { --scr-doc-own: ${OWN}; }` : ""}
`;
await page.evaluate(([a, b, c]) => {
  for (const css of [a, b, c]) {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
}, [appCss, modCss, sheetCss]);
await page.evaluate((code) => {
  const sc = document.createElement("script");
  sc.type = "module";
  sc.textContent = code;
  document.head.appendChild(sc);
}, js);
await page.waitForFunction(() => typeof window.__docSheet === "function", null, { timeout: 60000 });
const n = await page.evaluate(([g, r, rots, nw]) => window.__docSheet(g, r, rots, nw),
  [GROUP, RACE, ROTS, NARROW]);
await page.waitForFunction(() => document.querySelectorAll(".scr-doc-angle svg").length > 0, null, { timeout: 120000 });
await page.waitForTimeout(400);
await page.locator("#host").screenshot({ path: OUT });
await browser.close();
console.log(`${OUT}  (${GROUP}/${RACE} · ${n}종 · ${ROTS.length}방위)`);
