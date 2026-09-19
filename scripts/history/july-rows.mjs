import { chromium } from "playwright-core"; import fs from "node:fs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: false, args: ["--headless=new", "--no-sandbox"] });
const p = await b.newPage(); const all = {};
for (const f of ["july_t", "july_p", "july_z"]) {
  const d = "data:image/png;base64," + fs.readFileSync(f + ".png").toString("base64");
  const r = await p.evaluate(async (src) => {
    const i = new Image(); i.src = src; await i.decode();
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
    const g = c.getContext("2d"); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height;
    // 칸 판의 왼쪽 가장자리 x 264~270 열에서 세로로 어두운 구간(칸 속)을 찾는다 — 모델이 안 닿는 자리라 안정적이다
    const dark = [];
    for (let y = 0; y < H; y++) { let n = 0; for (let x = 265; x < 272; x++) { const o = (y * W + x) * 4; if (d[o] + d[o + 1] + d[o + 2] < 60) n++; } dark.push(n >= 6); }
    const out = []; let st = -1;
    for (let k = 0; k <= dark.length; k++) { const on = k < dark.length && dark[k]; if (on && st < 0) st = k; if (!on && st >= 0) { if (k - st > 120) out.push([st, k - 1]); st = -1; } }
    return out;
  }, d);
  all[f] = r; console.log(f, r.length, JSON.stringify(r.slice(0, 4)), JSON.stringify(r.slice(-2)), "heights", [...new Set(r.map(([a, z]) => z - a + 1))]);
}
fs.writeFileSync("july_rows.json", JSON.stringify(all)); await b.close();
