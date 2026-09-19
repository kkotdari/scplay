// 모델 변천사 — 세 시점(A 8/29 2D · B 9/10 2D · C 9/19 GL)의 칸을 한 줄에 셋씩 붙인다. 시트는 도록 일곱 장과 같은 묶음.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const S = process.argv[2]; const OUT = `${S}/변천사`;
const CELL = 200; const LAB = 170; const HEAD = 56; const GAP = 6;
const kinds = readFileSync(`${S}/kinds.txt`, "utf8").trim().split(",");
const rowsC = JSON.parse(readFileSync(`${S}/histC.json`, "utf8"));
const idxA = new Map(kinds.map((k, i) => [k, i]));
const idxC = new Map(rowsC.map((r, i) => [r.kind, i]));
const list = readFileSync(`${S}/dorok/list.txt`, "utf8").split("\n");
const sheets = []; let cur = null;
for (const ln of list) {
  const h = ln.match(/^## (\d+)\. (\S+) — (.+?) \(/); if (h) { cur = { no: h[1], name: h[2], title: h[3], items: [] }; sheets.push(cur); continue; }
  const m = ln.match(/^\s*\d+\. (.+?) \((\w+)\)\s*$/); if (m && cur) cur.items.push({ label: m[1], kind: m[2] });
}
const b64 = (f) => "data:image/png;base64," + readFileSync(`${S}/${f}.png`).toString("base64");
const imgs = { A: b64("histA"), B: b64("histB"), C: b64("histC"), JT: b64("july_t"), JP: b64("july_p"), JZ: b64("july_z") };
// 7월 도록(사용자가 준 그림 셋) — 행 차례를 종류로 옮긴 표. 칸: 45° 가 x 264 · 폭 200 · 높이 197 · 행 y 는 july_rows.json.
const JULY_KINDS = {
  JT: ["scv","gunner","fbat","inf","vulture","mine","tank","tanksiege","goliath","wraith","dship","vessel","valk","bc",
       "tomb","comsat","nsilo","trapezoid","refinery","cube","ebay","tombFlat","academy","turret","factory","mshop","plane","ctower","armory","scifac","covert","physlab","scaffold"],
  JP: ["probe","zealot","goon","htemp","dtemp","archon","darchon","shuttle","reaver","observer","scout","corsair","carrier","interceptor","arbiter",
       "pyramidWide","diamond","assim","gate","forge","coil","sbattery","cyber","citadel","archives","dome","robobay","observatory","arch","fleetbeacon","tribunal","warpin"],
  JZ: ["drone","ovie","zling","hydra","lurker","muta","scourge","queen","ultra","defiler","guardian","devourer",
       "hatchery","lair","hive","creep","sunken","spore","extract","pool","evo","hydraden","spire","gspire","queensnest","nydus","cavern","dmound","cocoon","mineral","geyser"],
};
const julyRows = JSON.parse(readFileSync(`${S}/july_rows.json`, "utf8"));
const julyAt = new Map();
for (const [img, ks] of Object.entries(JULY_KINDS)) {
  const rows = julyRows[{ JT: "july_t", JP: "july_p", JZ: "july_z" }[img]];
  if (rows.length !== ks.length) throw new Error(`${img}: 행 ${rows.length} vs 종류 ${ks.length}`);
  ks.forEach((k, i) => julyAt.set(k, { img, y: rows[i][0] }));
}
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: false, args: ["--headless=new", "--no-sandbox"] });
const pg = await br.newPage();
await pg.setContent("<body style='margin:0'></body>");
const loaded = await pg.evaluate(async (imgs) => { window.__im = {}; for (const k of Object.keys(imgs)) { const i = new Image(); i.src = imgs[k]; await i.decode(); window.__im[k] = i; } return Object.fromEntries(Object.entries(window.__im).map(([k, i]) => [k, [i.width, i.height]])); }, imgs);
console.log("loaded", loaded);
for (const sh of sheets) {
  const rows = sh.items.map((it) => ({ ...it, j: julyAt.get(it.kind) ?? null, a: idxA.get(it.kind), c: idxC.get(it.kind) }));
  const data = await pg.evaluate(async ({ rows, CELL, LAB, HEAD, GAP, title }) => {
    const W = LAB + 4 * (CELL + GAP); const H = HEAD + rows.length * (CELL + GAP);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"); c.fillStyle = "#20242b"; c.fillRect(0, 0, W, H);
    c.font = "bold 14px sans-serif"; c.textBaseline = "top"; c.fillStyle = "#ffd070"; c.fillText(title, 8, 8);
    c.font = "13px ui-monospace, monospace"; c.fillStyle = "#dfe3e6";
    ["7월 (도록)", "8/29 (2D)", "9/10 (2D)", "9/19 (GL)"].forEach((t, i) => c.fillText(t, LAB + i * (CELL + GAP) + 6, 34));
    rows.forEach((r, j) => {
      const y = HEAD + j * (CELL + GAP);
      c.fillStyle = "#dfe3e6"; c.font = "bold 13px sans-serif"; c.fillText(r.label, 8, y + 8);
      c.fillStyle = "#9aa4b0"; c.font = "11px ui-monospace, monospace"; c.fillText(r.kind, 8, y + 28);
      const srcs = [["J", r.j], ["A", r.a], ["B", r.a], ["C", r.c]];
      srcs.forEach(([k, idx], i) => {
        const x = LAB + i * (CELL + GAP);
        if (idx == null) { c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1); return; }
        if (k === "J") { c.drawImage(window.__im[idx.img], 264, idx.y, 200, 197, x, y, CELL, CELL); c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1); return; }
        const sy = k === "C" ? idx * (CELL + 22) + 22 : idx * CELL + 26;
        c.drawImage(window.__im[k], 0, sy, CELL, CELL, x, y, CELL, CELL);
        c.strokeStyle = "rgba(255,255,255,.15)"; c.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      });
    });
    return cv.toDataURL("image/png");
  }, { rows, CELL, LAB, HEAD, GAP, title: `${sh.no}. ${sh.name} — ${sh.title} 변천사(7월 · 8/29 · 9/10 · 9/19)` });
  const f = `${OUT}/${sh.no}. ${sh.name}_history.png`;
  writeFileSync(f, Buffer.from(data.split(",")[1], "base64")); console.log("→", f, rows.length);
}
await br.close();
writeFileSync(`${OUT}/README.txt`, "모델 변천사 — 열 넷: 7월(사용자가 준 도록 그림) · 8/29(2D 붓 · 저장소 첫 도구 시점) · 9/10(2D 붓) · 9/19(GL 붓 · 지금).\n");
execFileSync("zip", ["-qr", `${S}/변천사.zip`, "변천사"], { cwd: S });
console.log("zip →", `${S}/변천사.zip`);
