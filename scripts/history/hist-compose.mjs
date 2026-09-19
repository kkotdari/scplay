// 모델 변천사 — 세 시점(A 8/29 2D · B 9/10 2D · C 9/19 GL)의 칸을 한 줄에 셋씩 붙인다. 시트는 도록 일곱 장과 같은 묶음.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const S = process.argv[2]; const OUT = `${S}/변천사`;
/* ★ 칸은 400px(2026-09, 지적: "변천사 화질이 너무 안좋아") — 옛·지금 판은 400 으로 굽고(model-shot·model-gl `--cell 400 --fit 0.7`),
   7월 그림만 소스가 200px 칸이라 두 배로 늘린다(JC = 7월 칸 크기). `--fit` 은 칸마다 잉크 상자를 칸의 84% 에 맞추므로 아비터처럼
   원 좌표가 작은 종류(MODEL_NORM 이 키우는 종류)도 7월 도록처럼 칸을 채운다(지적: "아비터 아직도 작게 나와"). */
const CELL = 400; const JC = 200; const LAB = 170; const HEAD = 56; const GAP = 6;
/* 유닛(45°)·건물(23° — 7월 건물 그림의 눈금)을 따로 구운 판 넷: histA_u/histA_b(8/29 · model-shot) · histC_u/histC_b(9/19 · model-gl).
   배경은 7월 그림과 같은 검정(#0a0a0a)이다(요청: "배경도 7월과 같은 색으로 검게 · 각도도 7월에 맞춰"). */
const kindsU = readFileSync(`${S}/kinds_u.txt`, "utf8").trim().split(",");
const kindsB = readFileSync(`${S}/kinds_b.txt`, "utf8").trim().split(",");
/* ★ 각은 7월 그림의 눈금을 종류마다 따른다(2026-09, 요청: "각도도 7월에 맞춰") — 7월 도록은 첫 칸이 SCV 만 45° 이고 나머지는
   유닛·건물 가리지 않고 23° 다(july-rows 가 칸의 눈금 글자를 읽어 적는다). 그래서 8/29·9/19 도 두 각(45·23)으로 다 구워 두고
   (유닛 histA_u 45 · histA_u23 · 건물 histA_b 23 · histA_b45 — C 도 같은 이름) 종류의 7월 각으로 고른다. 7월에 없는 종류는 23°.
   ⚠ 7월 그림은 **−요잉**이다(지적: "7월 그림은 −요잉인데 나머지는 +요잉") — 그래서 여덟 판은 --rots 315(=−45)·337(=−23) 으로 굽는다. 꼬리표는 7월 눈금 글자 그대로 45°·23° 다. */
const idxA = { 45: new Map(), 23: new Map() }; const idxC = { 45: new Map(), 23: new Map() };
kindsU.forEach((k, i) => { idxA[45].set(k, { img: "AU", i }); idxA[23].set(k, { img: "AU23", i }); });
kindsB.forEach((k, i) => { idxA[23].set(k, { img: "AB", i }); idxA[45].set(k, { img: "AB45", i }); });
for (const [f, img, ang] of [["histC_u", "CU", 45], ["histC_u23", "CU23", 23], ["histC_b", "CB", 23], ["histC_b45", "CB45", 45]])
  JSON.parse(readFileSync(`${S}/${f}.json`, "utf8")).forEach((r, i) => idxC[ang].set(r.kind, { img, i }));
const list = readFileSync(`${S}/dorok/list.txt`, "utf8").split("\n");
const sheets = []; let cur = null;
for (const ln of list) {
  const h = ln.match(/^## (\d+)\. (\S+) — (.+?) \(/); if (h) { cur = { no: h[1], name: h[2], title: h[3], items: [] }; sheets.push(cur); continue; }
  const m = ln.match(/^\s*\d+\. (.+?) \((\w+)\)\s*$/); if (m && cur) cur.items.push({ label: m[1], kind: m[2] });
}
const b64 = (f) => "data:image/png;base64," + readFileSync(`${S}/${f}.png`).toString("base64");
const imgs = { AU: b64("histA_u"), AU23: b64("histA_u23"), AB: b64("histA_b"), AB45: b64("histA_b45"), CU: b64("histC_u"), CU23: b64("histC_u23"), CB: b64("histC_b"), CB45: b64("histC_b45"), JT: b64("july_t"), JP: b64("july_p"), JZ: b64("july_z") };
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
  ks.forEach((k, i) => julyAt.set(k, { img, y: rows[i][0], ang: rows[i][1] ?? 23 }));
}
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: false, args: ["--headless=new", "--no-sandbox"] });
const pg = await br.newPage();
await pg.setContent("<body style='margin:0'></body>");
const loaded = await pg.evaluate(async (imgs) => { window.__im = {}; for (const k of Object.keys(imgs)) { const i = new Image(); i.src = imgs[k]; await i.decode(); window.__im[k] = i; } return Object.fromEntries(Object.entries(window.__im).map(([k, i]) => [k, [i.width, i.height]])); }, imgs);
console.log("loaded", loaded);
/* ★ 판형(요청: "한 줄에 3모델" · 보기 그림) — 종족마다 한 장: '유닛'·'건물' 절 아래 모델 카드가 한 줄에 셋. 카드 안은 시점이
   위에서 아래로(7월 그림 · 8/29 2D · 9/19 GL — 각은 종류의 7월 눈금) 쌓인다. 칸마다 왼 위에 작은 꼬리표. */
const RACES = [["1. terran", "테란", ["1", "4"]], ["2. protoss", "프로토스", ["2", "5"]], ["3. zerg", "저그", ["3", "6"]]];
const COLS = 1; const TITLE = 44; const SEC = 30;   // 한 줄에 한 모델(재요청: "한줄에 한모델만(변천은 3개 가로로)")
for (const [file, race, nos] of RACES) {
  const secs = nos.map((no) => sheets.find((x) => x.no === no)).map((sh) => ({
    title: `${race} ${sh.title.split(" / ")[0]}`,
    cards: sh.items.map((it) => { const ang = julyAt.get(it.kind)?.ang ?? 23; return { ...it, ang, j: julyAt.get(it.kind) ?? null, a: idxA[ang].get(it.kind), c: idxC[ang].get(it.kind) }; }),
  }));
  const data = await pg.evaluate(async ({ secs, CELL, JC, COLS, TITLE, SEC, race }) => {
    /* ★ 카드 상자·칸 테두리는 걷었다(2026-09, 요청: "한 모델 안에서 세로 구분선 제거 · 제목은 각 모델 위에 줄 위에") —
       모델 하나는 '이름 한 줄 + 시점 셋이 아래로 쌓인 한 기둥'이고, 기둥 안에는 세로 줄이 하나도 없다. 세로 줄을 내던 자리 셋:
       ① 붓의 strokeRect ② 7월 그림의 칸 판 왼 가장자리(x 264~271 의 띠 — 그래서 272 부터 자른다) ③ 옛 model-shot 칸의 왼 가장자리
       (x 0~1 의 격자선 — 2 부터 자른다) · 9/19 는 model-gl 의 0.5px 테두리(1 안쪽부터). 소스 칸에 박힌 글자(7월의 돋보기·눈금 ·
       8/29 의 종류 이름)는 검정으로 덮고 그 위에 꼬리표를 얹는다. */
    /* ★ 시점 셋은 **가로**로 선다(재요청: "변천사 모델별로 세로 말고 가로로 배치") — 모델 하나 = 이름 한 줄 + [7월 | 8/29 | 9/19]
       한 줄. 한 줄에 모델 하나(COLS 1 — 한때 둘). 기둥 안 세로선 없음은 그대로다(칸 사이 3px 는 바탕색 그대로). */
    // 칸 사이 틈 GAPC(요청: "각 셀의 패딩 좀 늘리기" — 칸 안의 여백은 --fit 0.7 이 낸다)
    const GAPX = 14; const LABH = 20; const GAPC = 12; const BLKW = 3 * CELL + 2 * GAPC; const BLKH = LABH + CELL + 18;
    const W = COLS * (BLKW + GAPX) + GAPX;
    let H = TITLE;
    for (const sc of secs) H += SEC + Math.ceil(sc.cards.length / COLS) * BLKH;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"); c.fillStyle = "#0a0a0a"; c.fillRect(0, 0, W, H); c.textBaseline = "top";
    c.fillStyle = "#ffd070"; c.font = "bold 16px sans-serif"; c.fillText(`모델 변천 비교 — ${race}`, 10, 8);
    c.fillStyle = "#9aa4b0"; c.font = "11px sans-serif"; c.fillText("왼쪽부터 7월 그림 · 8/29(2D 붓) · 9/19(GL 붓, 지금) — 각은 7월 눈금 그대로(SCV 만 45° · 나머지 23°)", 10, 28);
    let y = TITLE;
    for (const sc of secs) {
      c.fillStyle = "#ffd070"; c.font = "bold 13px sans-serif"; c.fillText(sc.title, 10, y + 8); y += SEC;
      sc.cards.forEach((r, i) => {
        const x0 = GAPX + (i % COLS) * (BLKW + GAPX); const y0 = y + Math.floor(i / COLS) * BLKH;
        c.fillStyle = "#e8ecf0"; c.font = "bold 13px sans-serif"; c.fillText(r.label, x0, y0 + 2);
        const cells = [[`7월 ${r.ang}°`, "J", r.j], [`8/29 · 2D ${r.ang}°`, "A", r.a], [`9/19 · GL ${r.ang}°`, "C", r.c]];
        cells.forEach(([tag, k, idx], n) => {
          const x = x0 + n * (CELL + GAPC); const yy = y0 + LABH;
          c.fillStyle = "#0a0a0a"; c.fillRect(x, yy, CELL, CELL);
          if (idx != null) {
            if (k === "J") {
              const R = CELL / JC;   // 7월 칸(200) → 시트 칸 배수
              c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
              c.drawImage(window.__im[idx.img], 272, idx.y, 192, 197, x + 4 * R, yy, 192 * R, CELL);
              c.fillStyle = "#0a0a0a"; c.fillRect(x, yy, 44 * R, 36 * R); c.fillRect(x + 150 * R, yy, 50 * R, 30 * R);   // 돋보기 · 눈금 글자
            } else if (k === "A") {
              c.drawImage(window.__im[idx.img], 2, idx.i * CELL + 26 + 2, CELL - 4, CELL - 4, x + 2, yy + 2, CELL - 4, CELL - 4);   // 격자선이 위·아래 두 줄(0 · 199~200)
              c.fillStyle = "#0a0a0a"; c.fillRect(x, yy, 96, 22);                                        // 옛 도구의 종류 이름(칸 크기와 무관한 글자 크기)
            } else {
              c.drawImage(window.__im[idx.img], 2, idx.i * (CELL + 22) + 22 + 2, CELL - 4, CELL - 4, x + 2, yy + 2, CELL - 4, CELL - 4);
            }
            // 소스마다 검정이 조금씩 다르면(4 · 10 · 11) 칸의 네모가 도로 드러난다 — 거의 검정은 다 바탕색(10)으로 편다.
            const im = c.getImageData(x, yy, CELL, CELL); const d = im.data;
            for (let q = 0; q < d.length; q += 4) if (d[q] <= 13 && d[q + 1] <= 13 && d[q + 2] <= 13) { d[q] = d[q + 1] = d[q + 2] = 10; d[q + 3] = 255; }
            c.putImageData(im, x, yy);
          }
          c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x + 1, yy + 1, 8 + tag.length * 7, 14);
          c.fillStyle = "#9aa4b0"; c.font = "10px ui-monospace, monospace"; c.fillText(tag, x + 4, yy + 3);
        });
      });
      y += Math.ceil(sc.cards.length / COLS) * BLKH;
    }
    return cv.toDataURL("image/png");
  }, { secs, CELL, JC, COLS, TITLE, SEC, race });
  const f = `${OUT}/${file}_history.png`;
  writeFileSync(f, Buffer.from(data.split(",")[1], "base64")); console.log("→", f, secs.map((x) => x.cards.length).join("+"));
}
await br.close();
writeFileSync(`${OUT}/README.txt`, "모델 변천 비교 — 종족마다 한 장(유닛·건물). 카드마다 위에서 아래로 7월(사용자가 준 도록 그림) · 8/29(2D 붓 · 저장소 첫 도구 시점) · 9/19(GL 붓 · 지금).\n");
execFileSync("zip", ["-qr", `${S}/변천사.zip`, "변천사"], { cwd: S });
console.log("zip →", `${S}/변천사.zip`);
