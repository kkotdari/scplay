// 7월 그림의 행마다 첫 칸(45° 자리)의 각 눈금 글자를 읽는다 — 글자는 둘뿐(45° · 23°)이라 기준 조각과 화소로 견준다.
import { chromium } from "playwright-core"; import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("july_rows.json", "utf8"));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: false, args: ["--headless=new", "--no-sandbox"] });
const p = await b.newPage();
const sig = {};
for (const f of ["july_t", "july_p", "july_z"]) {
  const d = "data:image/png;base64," + fs.readFileSync(f + ".png").toString("base64");
  sig[f] = await p.evaluate(async ({ src, rows }) => {
    const i = new Image(); i.src = src; await i.decode();
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
    const g = c.getContext("2d"); g.drawImage(i, 0, 0);
    // 눈금 글자 자리: 첫 칸 오른 위(x 420~462 · y0+12~+32)
    return rows.map(([y0]) => { const im = g.getImageData(420, y0 + 12, 42, 20).data; const o = []; for (let k = 0; k < im.length; k += 4) o.push(im[k] > 90 ? 1 : 0); return o; });
  }, { src: d, rows: rows[f] });
}
await b.close();
const ref45 = sig.july_t[0]; const ref23 = sig.july_t[14];   // 테란: SCV 행은 45° · 커맨드 행은 23°
const dist = (a, r) => a.reduce((s, v, k) => s + (v !== r[k] ? 1 : 0), 0);
const out = {};
for (const f of Object.keys(sig)) {
  out[f] = rows[f].map(([y0, y1], k) => { const d45 = dist(sig[f][k], ref45), d23 = dist(sig[f][k], ref23); return [y0, d45 <= d23 ? 45 : 23, d45, d23]; });
  console.log(f, out[f].map((r, k) => `${k}:${r[1]}(${r[2]}/${r[3]})`).join(" "));
}
fs.writeFileSync("july_rows.json", JSON.stringify(out));
