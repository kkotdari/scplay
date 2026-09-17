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
 * 뒤집으면 SVG가 1em(16px)에 갇혀 모델이 점이 된다.
 * ★ 그림은 **GL 붓**(DocIcon9 → gl9 메시, 지도가 그리는 그 그림)이 기본이다(2026-09) — 키값·마주 봄 판정 같은 2D 전용
 *   어긋남이 도록에 안 실린다. 옛 2D 면 그림(ShapeIcon SVG)은 `--2d` 로 남겨 둔다(폰·#gl=0 이 아직 그 길이라 검토용).
 *   헤드리스는 소프트웨어 GL 이라 GL → 2D 읽기가 판마다 1~2초다 — DocIcon9 가 한 프레임의 칸을 한 판(4096²)에 모아 한 번 읽는다. */

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
/* --anim — **건물의 움직임 칸**을 뽑는다(2026-09, 요청: "도록에서 건물도 유닛처럼 idle 상태
   애니메이션 재생 · 액션칸에는 생산중/업그레이드중/공격중"). 방위 줄 대신 한 종류의 상태
   여덟(기본·회전 둘·불빛·겨눔·공사 셋)을 한 줄로 늘어놓는다 — 도록 팝업이 시각으로 오가는
   그 값들이 진짜 그림을 바꾸는지 눈으로 보는 자다. `--kinds trapezoid,turret,coil,cube` */
const ANIM = argv.includes("--anim");
const KINDS = String(flag("--kinds", "")).split(",").map((v) => v.trim()).filter(Boolean);
/* --own — 임자색(칠 안 한 면이 먹는 currentColor). 도록 화면은 `--scr-doc-own`으로
   고정 연두를 주는데, 종이로 뽑을 때는 다른 색이 필요할 때가 있다(요청: 빨강).
   변수만 덮어쓰면 되는 자리라 앱 CSS를 안 건드린다. */
const OWN = String(flag("--own", ""));
/* --2d — GL 붓 대신 옛 2D 면 그림(ShapeIcon SVG)으로 뽑는다(위 ★). */
const TWO_D = argv.includes("--2d");
/* --bg — 종이 배경으로 뽑는다(요청: "흰색 배경으로"). 값은 바탕색(기본 #fff).
   어두운 테마 변수 위에 얹는 오버라이드라, 글자·테두리도 함께 잉크색으로 뒤집는다. */
const bgRaw9 = flag("--bg", "#fff");
const BG = argv.includes("--bg")
  ? (typeof bgRaw9 === "string" && !bgRaw9.startsWith("-") ? bgRaw9 : "#fff") : "";

/* ── 브라우저에 넣을 번들 ─────────────────────────────────────────────────────── */
const ENTRY = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { SHAPE_GALLERY, DocIcon9, galleryYawOf, docAnimOf9 } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
/* 건물의 움직임 판(--anim) — 한 종류의 상태들을 한 줄로. 값은 도록 팝업이 시각으로 오가는
   그 값들이고, 여기서는 눈으로 견주기 쉽게 **못 박아** 놓는다. */
window.__docAnim = (kinds) => {
  const host = document.getElementById("host");
  const rows = kinds.map((k) => SHAPE_GALLERY.find((g) => g.kind === k) || { kind: k, label: k, group: "건물", race: "" });
  const cellsOf = (kind, group) => {
    const a = docAnimOf9(kind);
    const yaw = galleryYawOf(45, group);
    const out = [["기본", {}]];
    if (a.spin) { out.push(["회전 2", { spin: 2 }], ["회전 5", { spin: 5 }]); }
    if (a.lit) out.push(["불빛", { lit: true }]);
    if (a.head) out.push(["겨눔 +40", { headDeg: yaw + 40 }], ["겨눔 −70", { headDeg: yaw - 70 }]);
    if (a.stage) out.push(["공사 3", { stage: 3, blink: true }], ["공사 6", { stage: 6 }], ["공사 9", { stage: 9, blink: true }]);
    if (!a.stage) out.push(["깜빡", { blink: true }]);
    return out.map(([label, props]) => h("div", { key: label, className: "scr-doc-angle" }, [
      h(DocIcon9, { key: "m", kind, rotDeg: props.rotDeg ?? yaw, flat: true, fit: true, className: "scr-doc-svg", gl: !window.__doc2d, ...props }),
      h("span", { key: "d" }, label),
    ]));
  };
  const list = h("div", { className: "scr-doc-list" }, rows.map((it) => h("section", { key: it.kind, className: "scr-doc-item" }, [
    h("header", { key: "h", className: "scr-doc-itemhead" }, [
      h("h3", { key: "t" }, it.label), h("span", { key: "k", className: "scr-doc-kind" }, it.kind),
    ]),
    h("div", { key: "a", className: "scr-doc-angles" }, cellsOf(it.kind, it.group)),
  ])));
  createRoot(host).render(h("div", { className: "scr-doc" }, list));
  return rows.length;
};
window.__docSheet = (group, race, rots, narrow) => {
  const rows = SHAPE_GALLERY.filter((g) => g.group === group && (race === "전체" || g.race === race));
  const host = document.getElementById("host");
  /* 도록 화면(GalleryScreen)의 마크업 그대로다 — 고르기 줄과 돌아가기 버튼만 뺀다
     (그림에는 담을 것이 아니고, 담으면 종이의 절반을 먹는다). 괄호를 깊게 겹치지 않고
     한 칸씩 이름 붙여 짓는다 — 겹치면 닫는 수를 세다 틀린다(첫 판이 그랬다). */
  /* 각은 **갈래의 기준각**으로 옮겨 그린다(galleryYawOf) — 건물은 지도에서 각이 하나
     (40도)뿐이라 45 눈금을 그대로 쓰면 도록의 건물만 지도와 5도 어긋나 선다. 눈금 글자도
     옮긴 각을 적는다(그림과 숫자가 갈리면 도록이 거짓말을 한다).
     ★ flat(위에서 본 판)으로 굽는다 — 지도의 2D와 **같은 카메라**다(요청: "전부 2D 지도와
       같게"). 안 주면 도록 전용 투영(수직 26.8도)이라 같은 모델이 두 화면에서 다른 높이로
       보였다. */
  const angleCell = (kind, deg, group) => {
    const d9 = galleryYawOf(deg, group);
    return h("div", { key: deg, className: "scr-doc-angle" }, [
      h(DocIcon9, { key: "m", kind, rotDeg: d9, flat: true, fit: true, className: "scr-doc-svg", gl: !window.__doc2d }),
      h("span", { key: "d" }, d9 + "\u00b0"),
    ]);
  };
  const itemRow = (it) => h("section", { key: it.kind, className: "scr-doc-item" }, [
    h("header", { key: "h", className: "scr-doc-itemhead" }, [
      h("h3", { key: "t" }, it.label),
      it.race ? h("span", { key: "r", className: "scr-doc-race" }, it.race) : null,
      h("span", { key: "k", className: "scr-doc-kind" }, it.kind),
    ]),
    h("div", {
      key: "a",
      className: "scr-doc-angles" + (narrow ? " is-narrow" : ""),
    }, rots.map((d) => angleCell(it.kind, d, it.group))),
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
  ${BG ? `
  html, body { background: ${BG}; }
  .scr-doc-angle { background: ${BG}; border-color: #d8dbe0; }
  .scr-doc-angle > span { color: #5a6472; }
  .scr-doc-itemhead h3 { color: #14181f; }
  .scr-doc-race { color: #5a6472; border-color: #c9cdd4; }
  .scr-doc-kind { color: #7a828e; }
  .scr-doc-item { border-top-color: #d8dbe0; }
  ` : ""}
`;
await page.evaluate(([a, b, c]) => {
  for (const css of [a, b, c]) {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
}, [appCss, modCss, sheetCss]);
await page.evaluate((twoD) => { window.__doc2d = twoD; }, TWO_D);
await page.evaluate((code) => {
  const sc = document.createElement("script");
  sc.type = "module";
  sc.textContent = code;
  document.head.appendChild(sc);
}, js);
await page.waitForFunction(() => typeof window.__docSheet === "function", null, { timeout: 60000 });
await page.waitForFunction(() => typeof window.__docAnim === "function", null, { timeout: 60000 });
const n = ANIM
  ? await page.evaluate((ks) => window.__docAnim(ks), KINDS.length ? KINDS : ["trapezoid", "turret", "coil", "cube"])
  : await page.evaluate(([g, r, rots, nw]) => window.__docSheet(g, r, rots, nw),
    [GROUP, RACE, ROTS, NARROW]);
/* 칸이 다 그려질 때까지 — SVG 는 서는 즉시, GL 그림은 data-gl9="1"(판에서 제 칸을 찍은 뒤).
   ⚠ **<canvas> 도 센다**(2026-09) — DocIcon9 가 PNG 왕복을 걷고 판을 곧장 찍게 되면서
     그림이 <img> → <canvas> 로 바뀌었는데 이 자가 `svg, img` 만 보고 있었다. 그러면 GL 붓에서
     els 가 **빈 배열**이라 `length > 0` 이 영영 거짓이고, 이 도구와 도록 뽑기(doc-catalog)가
     10분 타임아웃까지 멎는다. 헤드리스 GL 은 판마다 읽기가 느려(1~2초) 넉넉히 기다린다. */
await page.waitForFunction(() => {
  const els = [...document.querySelectorAll(".scr-doc-angle svg, .scr-doc-angle img, .scr-doc-angle canvas")];
  return els.length > 0 && els.every((e) => e.tagName.toLowerCase() === "svg" || e.dataset.gl9 === "1");
}, null, { timeout: 600000 });
await page.waitForTimeout(400);
await page.locator("#host").screenshot({ path: OUT });
await browser.close();
console.log(ANIM
  ? `${OUT}  (움직임 판 · ${n}종 · ${TWO_D ? "2D" : "GL"})`
  : `${OUT}  (${GROUP}/${RACE} · ${n}종 · ${ROTS.length}방위 · ${TWO_D ? "2D" : "GL"})`);
