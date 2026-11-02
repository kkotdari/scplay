/* 비교샷(비포·애프터) 한 줄 — 로컬에서 찍는다(2026-11-02, 요청: "이거는 스크립트로 짜서 저장해서 푸시까지 · 내가 로컬에서 찍을수 있게").
 *
 *   node scripts/showcase-run.mjs [--races 테란8,토스8,저그8] [--jobs 2] [--out <폴더>] [--old <옛 트리 자리>] [--skip-before] [--skip-after]
 *
 * 하는 일:
 *   ① 옛 트리(비포 = scplay 0641c408 · 재질·그림자 손질 전)를 git worktree 로 세운다(없을 때만) — `#nofog` 패치(scripts/showcase/old0641-nofog.patch)를
 *      얹고 node_modules 를 이 트리 것으로 잇고(맥·리눅스 심볼릭 · 윈도 junction) `vite build` 로 dist/styles.css 를 굽는다.
 *   ② 이 트리(애프터)의 dist/styles.css 가 없으면 굽는다.
 *   ③ 종족마다 scripts/showcase-shot.mjs 를 애프터·비포로 돌린다(장면·타일셋·임자색은 그 파일의 SCENES.테란8/토스8/저그8 — 밑그림 그대로).
 *   ④ 비포|애프터를 좌우로 붙인 compare 그림을 브라우저 캔버스로 짓는다(파이썬 없이).
 *   이름은 **버전 날짜**(찍은 날이 아니라 그 코드의 커밋 날짜 · scripts/showcase/verTag.mjs — YYYYMMDD-해시7 · 커밋 안 한 src 손질이 있으면 끝에 +):
 *     폴더 docs/portfolio/showcase-<애프터 버전>/ · before_<종족>_<비포 버전>.png · after_<종족>_<애프터 버전>.png · compare_<종족>_<비포 날짜>_vs_<애프터 날짜>.png
 *
 * 크롬은 showcase-shot 이 찾는다(PW_CHROMIUM 환경 변수 → /opt/pw-browsers → 맥 Chrome for Testing → playwright 기본).
 * PW_HEADED=1 이면 창을 띄워 기기 GPU 로 그린다(헤드리스는 CPU 그림이라 느리다) — 자세한 실행법은 docs/local-run-guide.md. */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync, readFileSync, writeFileSync, copyFileSync, rmSync, lstatSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { verTag } from "./showcase/verTag.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
const OLD_REV = "0641c408d8aeb211ed6da8beb163f67534d30ad1";
const RACES = String(flag("--races", "테란8,토스8,저그8")).split(",");
const RACE_EN = { 테란8: "terran", 토스8: "protoss", 저그8: "zerg" };
const RACE_KO = { 테란8: "테란", 토스8: "프로토스", 저그8: "저그" };
const JOBS = Math.max(1, Number(flag("--jobs", 2)));
const NEW_V = verTag(HERE);
const OLD_V = (() => { try { return verTag(HERE, OLD_REV); } catch { execFileSync("git", ["fetch", "-q", "origin", OLD_REV], { cwd: HERE, stdio: "inherit" }); return verTag(HERE, OLD_REV); } })();
const OUT = resolve(String(flag("--out", join(HERE, "docs", "portfolio", `showcase-${NEW_V.tag}`))));
const fileOf = (side, r) => join(OUT, side === "before" ? `before_${RACE_EN[r]}_${OLD_V.tag}.png` : `after_${RACE_EN[r]}_${NEW_V.tag}.png`);
const OLD = resolve(String(flag("--old", join(tmpdir(), "scplay-old0641"))));
const node = process.execPath;
const vite = join(HERE, "node_modules", "vite", "bin", "vite.js");
const log = (...a) => console.log("[비교샷]", ...a);

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

/* ① 옛 트리 */
if (!has("--skip-before")) {
  if (!existsSync(join(OLD, "src"))) {
    log(`옛 트리 세움: ${OLD} (${OLD_REV.slice(0, 8)})`);
    try { run("git", ["fetch", "-q", "origin", OLD_REV], HERE); } catch { /* 이미 있으면 그만 */ }
    run("git", ["worktree", "add", "-f", "--detach", OLD, OLD_REV], HERE);
    run("git", ["apply", join(HERE, "scripts", "showcase", "old0641-nofog.patch")], OLD);
  }
  /* 패치가 바뀌었으면(2026-11-02 · terrsoft 를 더했다) 이미 선 옛 트리에도 새로 얹는다 — 옛 트리의 diff 와 패치 파일을 견준다(줄 끝 LF 로 접어). */
  {
    const want = readFileSync(join(HERE, "scripts", "showcase", "old0641-nofog.patch"), "utf8").replace(/\r\n/g, "\n").trim();
    const have = execFileSync("git", ["diff", "--", "src"], { cwd: OLD, encoding: "utf8" }).replace(/\r\n/g, "\n").trim();
    if (want !== have) {
      log("옛 트리 패치 갱신");
      run("git", ["checkout", "--", "src"], OLD);
      run("git", ["apply", join(HERE, "scripts", "showcase", "old0641-nofog.patch")], OLD);
    }
  }
  const nm = join(OLD, "node_modules");
  let linked = false; try { linked = lstatSync(nm).isSymbolicLink() || existsSync(join(nm, "react")); } catch { linked = false; }
  if (!linked) symlinkSync(join(HERE, "node_modules"), nm, process.platform === "win32" ? "junction" : "dir");
  if (!existsSync(join(OLD, "dist", "styles.css"))) { log("옛 트리 빌드(vite build)"); run(node, [vite, "build"], OLD); }
}
/* ② 이 트리 */
if (!has("--skip-after") && !existsSync(join(HERE, "dist", "styles.css"))) { log("이 트리 빌드(vite build)"); run(node, [vite, "build"], HERE); }

/* ③ 찍기 — 일감 줄(애프터·비포 × 종족)을 JOBS 개씩 */
mkdirSync(OUT, { recursive: true });
const work = [];
for (const r of RACES) {
  if (!has("--skip-after")) work.push({ r, side: "after", root: HERE });
  if (!has("--skip-before")) work.push({ r, side: "before", root: OLD });
}
const shoot = ({ r, side, root }) => new Promise((ok) => {
  const tmp = join(tmpdir(), `showcase-${side}-${RACE_EN[r]}-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const args = [join(HERE, "scripts", "showcase-shot.mjs"), "--race", r, "--out", tmp];
  if (root !== HERE) args.push("--root", root);
  log(`${RACE_KO[r]} ${side} 시작`);
  const t0 = Date.now();
  const p = spawn(node, args, { cwd: HERE, stdio: ["ignore", "pipe", "pipe"] });
  let txt = "";
  p.stdout.on("data", (d) => { txt += d; }); p.stderr.on("data", (d) => { txt += d; });
  p.on("close", (code) => {
    const src = join(tmp, `show_${{ 테란8: "t8", 토스8: "p8", 저그8: "z8" }[r]}.png`);
    const dst = fileOf(side, r);
    if (existsSync(src)) { copyFileSync(src, dst); log(`${RACE_KO[r]} ${side} 끝(${((Date.now() - t0) / 1000).toFixed(0)}초) → ${dst}`); }
    else { log(`${RACE_KO[r]} ${side} 실패(코드 ${code})\n${txt.split("\n").slice(-15).join("\n")}`); }
    for (const l of txt.split("\n")) if (/⚠|오류/.test(l)) log(`  ${RACE_KO[r]} ${side}: ${l.trim()}`);
    rmSync(tmp, { recursive: true, force: true });
    ok();
  });
});
{
  const q = [...work];
  await Promise.all(Array.from({ length: Math.min(JOBS, q.length) }, async () => { while (q.length) await shoot(q.shift()); }));
}

/* ④ 붙이기 — 비포|애프터 좌우 · 위에 이름 띠 */
const pairs = RACES.filter((r) => existsSync(fileOf("before", r)) && existsSync(fileOf("after", r)));
if (pairs.length) {
  const { chromium } = await import("playwright-core");
  const exe = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
    join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean).find((p) => existsSync(p));
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), ...(process.env.PW_HEADED === "1" ? { headless: false } : {}) });
  const page = await browser.newPage();
  for (const r of pairs) {
    const a = readFileSync(fileOf("before", r)).toString("base64");
    const b = readFileSync(fileOf("after", r)).toString("base64");
    const png = await page.evaluate(async ([a, b, title, va, vb]) => {
      const load = (s) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = `data:image/png;base64,${s}`; });
      const [A, B] = await Promise.all([load(a), load(b)]);
      const w = Math.min(A.width, B.width); const h = Math.min(A.height, B.height); const gap = Math.round(w * 0.012); const band = Math.round(h * 0.07);
      const cv = document.createElement("canvas"); cv.width = w * 2 + gap; cv.height = h + band;
      const c = cv.getContext("2d");
      c.fillStyle = "#14161b"; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(A, 0, 0, w, h, 0, band, w, h); c.drawImage(B, 0, 0, w, h, w + gap, band, w, h);
      c.fillStyle = "#e8e8ea"; c.font = `600 ${Math.round(band * 0.46)}px sans-serif`; c.textBaseline = "middle";
      c.fillText(`${title} · BEFORE (${va})`, Math.round(band * 0.35), band / 2); c.fillText(`${title} · AFTER (${vb})`, w + gap + Math.round(band * 0.35), band / 2);
      return cv.toDataURL("image/png").split(",")[1];
    }, [a, b, RACE_KO[r], OLD_V.pretty, NEW_V.pretty]);
    const dst = join(OUT, `compare_${RACE_EN[r]}_${OLD_V.date}_vs_${NEW_V.date}.png`);
    writeFileSync(dst, Buffer.from(png, "base64"));
    log(`붙임 → ${dst}`);
  }
  await browser.close();
}
log(`끝 — ${OUT}  (비포 ${OLD_V.tag} · 애프터 ${NEW_V.tag})`);
log("커밋: git add docs/portfolio && git commit -m '비교샷' && git push");
