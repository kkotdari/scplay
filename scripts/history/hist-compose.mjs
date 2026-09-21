// 모델 변천사 — 세 시점(J 7월 그림 · A 8/29 2D +45° · C 지금 GL +40°)의 칸을 한 줄에 셋 붙인다. 시트는 도록 일곱 장과 같은 묶음.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const S = process.argv[2]; const OUT = `${S}/변천사`;
/* ★ 절 조각을 다시 N 토막으로(2026-09, 요청: "각 목록을 둘로 나눠서 12장으로 줘") — `--split=N`(기본 1 = 절 하나가 한 조각).
   토막은 행 경계에서 자르고 토막마다 머리띠 + 절 제목 띠를 다시 얹는다. */
const SPLIT = Math.max(1, Number((process.argv.find((a) => a.startsWith("--split=")) ?? "--split=1").slice(8)) || 1);
/* ★ 칸은 400px(2026-09, 지적: "변천사 화질이 너무 안좋아") — 옛·지금 판은 400 으로 굽고(model-shot·model-gl `--cell 400 --fit 0.7`),
   7월 그림만 소스가 200px 칸이라 두 배로 늘린다(JC = 7월 칸 크기). `--fit` 은 칸마다 잉크 상자를 칸의 84% 에 맞추므로 아비터처럼
   원 좌표가 작은 종류(MODEL_NORM 이 키우는 종류)도 7월 도록처럼 칸을 채운다(지적: "아비터 아직도 작게 나와"). */
const NOW = "9/21";   // 지금 시점의 꼬리표(굽는 날)
const CELL = 400; const JC = 200; const LAB = 170; const HEAD = 56; const GAP = 6;
/* 유닛(45°)·건물(23° — 7월 건물 그림의 눈금)을 따로 구운 판 넷: histA_u/histA_b(8/29 · model-shot) · histC_u/histC_b(9/19 · model-gl).
   배경은 7월 그림과 같은 검정(#0a0a0a)이다(요청: "배경도 7월과 같은 색으로 검게 · 각도도 7월에 맞춰"). */
const kindsU = readFileSync(`${S}/kinds_u.txt`, "utf8").trim().split(",");
const kindsB = readFileSync(`${S}/kinds_b.txt`, "utf8").trim().split(",");
/* ★ 각은 7월 그림의 눈금을 종류마다 따른다(2026-09, 요청: "각도도 7월에 맞춰") — 7월 도록은 첫 칸이 SCV 만 45° 이고 나머지는
   유닛·건물 가리지 않고 23° 다(july-rows 가 칸의 눈금 글자를 읽어 적는다). 그래서 8/29·9/19 도 두 각(45·23)으로 다 구워 두고
   (유닛 histA_u 45 · histA_u23 · 건물 histA_b 23 · histA_b45 — C 도 같은 이름) 종류의 7월 각으로 고른다. 7월에 없는 종류는 23°.
   ⚠ 7월 그림은 **−요잉**이다(지적: "7월 그림은 −요잉인데 나머지는 +요잉") — 그래서 여덟 판은 --rots 315(=−45)·337(=−23) 으로 굽는다. 꼬리표는 7월 눈금 글자 그대로 45°·23° 다. */
/* ★ **시대마다 제 카메라 시점이 있다**(2026-09, 요청: "8월은 +45도 요잉 9월은 +40도 요잉(각 시대 표준값)으로 변경 — 시대별
   카메라 시점 파라미터 갖기 · 임자색은 7월에 적용한 색(연녹색) 모든 시대에 적용 · 배경 흰색으로(7월도) — 그림자 표현 변천사도
   보여주고 싶어서") — 한때 세 시대를 7월 눈금 각(SCV 45 · 나머지 23 · −요잉)에 다 맞췄지만, 각 시대의 '표준 그림'은 그 시대
   재생기의 카메라다: 8/29 재생기는 +45 요잉(model-shot --rots 45) · 지금은 +40(BUILDING_BASE_YAW 와 같은 자 · model-gl --rots 40).
   7월 그림만 제 눈금 그대로다(−요잉 · 다시 굽을 수 없다). 임자색은 7월 도록의 연녹색 #7ed491(그림에서 잰 값) 을 두 시대에 준다
   (`--color`). 배경은 셋 다 흰색 — 7월 그림은 칸 바탕(#0a0a0a · 칸 사이 여백은 (20,27,43))을 알파로 되짚어 흰 바탕에 다시 얹는다(아래 julyWhite).
   그림자: 8/29 는 그 시대 재생기의 접지 타원(model-shot 사본 `--shadow`) · 지금은 gl9 의 사영 그림자(model-gl `--shadow` —
   ⚠ 지도 기본은 접지 타원이고 사영은 `#glshadow=1` 의 그림이다) · 유닛에만 준다(건물은 두 시대 다 그림자가 없다). */
export const ERAS = {
  A: { tag: "8/29 · 2D", yaw: 45, u: "AU", b: "AB" },
  C: { tag: `${NOW} · GL`, yaw: 40, u: "CU", b: "CB" },
};
export const OWN9 = "#7ed491";   // 7월 도록의 임자색(연녹색)
export const BG9 = "#ffffff";
const idxA = new Map(); const idxC = new Map();
kindsU.forEach((k, i) => idxA.set(k, { img: "AU", i }));
kindsB.forEach((k, i) => idxA.set(k, { img: "AB", i }));
for (const [f, img] of [["histC_u", "CU"], ["histC_b", "CB"]])
  JSON.parse(readFileSync(`${S}/${f}.json`, "utf8")).forEach((r, i) => idxC.set(r.kind, { img, i }));
const list = readFileSync(`${S}/dorok/list.txt`, "utf8").split("\n");
const sheets = []; let cur = null;
for (const ln of list) {
  const h = ln.match(/^## (\d+)\. (\S+) — (.+?) \(/); if (h) { cur = { no: h[1], name: h[2], title: h[3], items: [] }; sheets.push(cur); continue; }
  const m = ln.match(/^\s*\d+\. (.+?) \((\w+)\)\s*$/); if (m && cur) cur.items.push({ label: m[1], kind: m[2] });
}
const b64 = (f) => "data:image/png;base64," + readFileSync(`${S}/${f}.png`).toString("base64");
const imgs = { AU: b64("histA_u"), AB: b64("histA_b"), CU: b64("histC_u"), CB: b64("histC_b"), JT: b64("july_t"), JP: b64("july_p"), JZ: b64("july_z") };
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
    /* ★ **지금 판에 없는 종류는 카드를 안 만든다**(2026-09, 요청: "유닛 채집 일꾼 빼고 다시 뽑아 줘") — 카드 목록은 도록
       `list.txt` 에서 오고 그림은 `kinds_u/b.txt` 로 구운 판에서 오므로, 목록에서만 종류를 빼면 **이름만 있고 그림이 빈 칸**이
       남는다. 지금 판(idxC)에 없으면 거른다 — 굽는 목록에서 빼는 것만으로 카드까지 사라진다. */
    cards: sh.items.filter((it) => idxC.has(it.kind)).map((it) => { const ang = julyAt.get(it.kind)?.ang ?? 23; return { ...it, ang, j: julyAt.get(it.kind) ?? null, a: idxA.get(it.kind), c: idxC.get(it.kind) }; }),
  }));
  const data = await pg.evaluate(async ({ secs, CELL, JC, COLS, TITLE, SEC, race, NOW, ERAS, BG9, OWN9, SPLIT }) => {
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
    const c = cv.getContext("2d"); c.fillStyle = BG9; c.fillRect(0, 0, W, H); c.textBaseline = "top";
    c.fillStyle = "#1f2733"; c.font = "bold 16px sans-serif"; c.fillText(`모델 변천 비교 — ${race}`, 10, 8);
    c.fillStyle = "#6b7480"; c.font = "11px sans-serif"; c.fillText(`왼쪽부터 7월 그림(제 눈금 · −요잉) · ${ERAS.A.tag}(+${ERAS.A.yaw}°) · ${ERAS.C.tag}(+${ERAS.C.yaw}° · 지금) — 시대마다 그 재생기의 카메라 · 임자색 ${OWN9}(7월 연녹색) · 흰 바탕(그림자가 보이게)`, 10, 28);
    /* 7월 칸을 흰 바탕으로 — 그림은 검은 칸 바탕(10,10,10) 위에 얹힌 것이라, 바탕과의 거리로 알파를 되짚어(a) 제 색을 풀고(col = bg +
       (p − bg)/a) 흰 바탕에 다시 얹는다. 격자·눈금 글자는 잘라 내거나 덮는다. 그림자(회색 타원)는 반투명으로 살아남는다. */
    const julyWhite = (im) => { const d = im.data; const bj = [10, 10, 10];   // 칸 안 바탕은 (10,10,10) — 칸 사이 여백(20,27,43)과 다르다(실측)
      for (let q = 0; q < d.length; q += 4) {
        const dm = Math.max(Math.abs(d[q] - bj[0]), Math.abs(d[q + 1] - bj[1]), Math.abs(d[q + 2] - bj[2]));
        /* 알파는 '검정에서 얼마나 멀어졌나'를 **꽉 찬 초록의 거리(≈140~200)** 로 나눈 값이다 — 36 으로 나누면 반쯤 덮인 가장자리
           화소(68,111,78 · dm 101)가 a 1 로 잡혀 그 어두운 색이 그대로 남아 **검은 테두리**가 됐다(지적: "누끼 거의 다 땄는데
           아직 테두리가 남네"). 140 이면 그 화소가 a 0.69 → 제 색(94,156,108)으로 풀려 흰 바탕에 섞인다. */
        const a = Math.max(0, Math.min(1, (dm - 4) / 140));
        for (let ch = 0; ch < 3; ch += 1) { const col = a > 0 ? Math.max(0, Math.min(255, bj[ch] + (d[q + ch] - bj[ch]) / a)) : 255; d[q + ch] = Math.round(255 * (1 - a) + col * a); }
        d[q + 3] = 255;
      } };
    let y = TITLE; const secY = [];   // 절마다 [시작, 끝) y — 절 조각 파일의 자
    for (const sc of secs) {
      const ys = y;
      c.fillStyle = "#1f2733"; c.font = "bold 13px sans-serif"; c.fillText(sc.title, 10, y + 8); y += SEC;
      sc.cards.forEach((r, i) => {
        const x0 = GAPX + (i % COLS) * (BLKW + GAPX); const y0 = y + Math.floor(i / COLS) * BLKH;
        c.fillStyle = "#1f2733"; c.font = "bold 13px sans-serif"; c.fillText(r.label, x0, y0 + 2);
        const cells = [[`7월 ${r.ang}°`, "J", r.j], [`${ERAS.A.tag} +${ERAS.A.yaw}°`, "A", r.a], [`${ERAS.C.tag} +${ERAS.C.yaw}°`, "C", r.c]];
        cells.forEach(([tag, k, idx], n) => {
          const x = x0 + n * (CELL + GAPC); const yy = y0 + LABH;
          c.fillStyle = BG9; c.fillRect(x, yy, CELL, CELL);
          if (idx != null) {
            if (k === "J") {
              const R = CELL / JC;   // 7월 칸(200) → 시트 칸 배수
              c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
              c.drawImage(window.__im[idx.img], 272, idx.y + 3, 192, 191, x + 4 * R, yy + 3 * R, 192 * R, 191 * R);   // 위·아래 3px 는 칸 판의 테두리 띠 — 흰 바탕에서 회색 줄로 남는다
              const im = c.getImageData(x, yy, CELL, CELL); julyWhite(im); c.putImageData(im, x, yy);
              c.fillStyle = BG9; c.fillRect(x, yy, 44 * R, 36 * R); c.fillRect(x + 150 * R, yy, 50 * R, 30 * R);   // 돋보기 · 눈금 글자
            } else if (k === "A") {
              c.drawImage(window.__im[idx.img], 2, idx.i * CELL + 26 + 2, CELL - 4, CELL - 4, x + 2, yy + 2, CELL - 4, CELL - 4);   // 격자선이 위·아래 두 줄(0 · 199~200)
              c.fillStyle = BG9; c.fillRect(x, yy, 96, 22);                                        // 옛 도구의 종류 이름(칸 크기와 무관한 글자 크기)
            } else {
              c.drawImage(window.__im[idx.img], 2, idx.i * (CELL + 22) + 22 + 2, CELL - 4, CELL - 4, x + 2, yy + 2, CELL - 4, CELL - 4);
            }
            // 소스마다 '흰색'이 조금씩 다르면 칸의 네모가 도로 드러난다 — 거의 흰색(≥250)은 다 바탕(255)으로 편다.
            const im = c.getImageData(x, yy, CELL, CELL); const d = im.data;
            for (let q = 0; q < d.length; q += 4) if (d[q] >= 250 && d[q + 1] >= 250 && d[q + 2] >= 250) { d[q] = d[q + 1] = d[q + 2] = 255; d[q + 3] = 255; }
            c.putImageData(im, x, yy);
          }
          c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(x + 1, yy + 1, 8 + tag.length * 7, 14);
          c.fillStyle = "#6b7480"; c.font = "10px ui-monospace, monospace"; c.fillText(tag, x + 4, yy + 3);
        });
      });
      const nRows = Math.ceil(sc.cards.length / COLS); y += nRows * BLKH; secY.push([ys, y, nRows]);
    }
    /* ★ 절(유닛·건물)마다 한 조각을 더 낸다(2026-09, 요청: "파일로 압축하지 말고 줘") — 한 장 통째(1252×15000 · 3~4MB)는 파일 전송이
       400 으로 막힌다(실측 · 8000px·2MB 조각은 간다). 조각은 머리띠(제목 줄)를 그대로 얹은 그 절이다. */
    const parts = secY.map(([a, , nRows]) => Array.from({ length: SPLIT }, (_, h) => {
      const r0 = Math.floor((nRows * h) / SPLIT); const r1 = Math.floor((nRows * (h + 1)) / SPLIT); const hh = (r1 - r0) * BLKH;
      const p = document.createElement("canvas"); p.width = cv.width; p.height = TITLE + SEC + hh; const q = p.getContext("2d");
      q.fillStyle = BG9; q.fillRect(0, 0, p.width, p.height);
      q.drawImage(cv, 0, 0, cv.width, TITLE, 0, 0, cv.width, TITLE);                                   // 머리띠
      q.drawImage(cv, 0, a, cv.width, SEC, 0, TITLE, cv.width, SEC);                                   // 절 제목 띠
      q.drawImage(cv, 0, a + SEC + r0 * BLKH, cv.width, hh, 0, TITLE + SEC, cv.width, hh);            // 그 토막의 행들
      return p.toDataURL("image/png"); }));
    return { full: cv.toDataURL("image/png"), parts };
  }, { secs, CELL, JC, COLS, TITLE, SEC, race, NOW, ERAS, BG9, OWN9, SPLIT });
  const f = `${OUT}/${file}_history.png`;
  writeFileSync(f, Buffer.from(data.full.split(",")[1], "base64")); console.log("→", f, secs.map((x) => x.cards.length).join("+"));
  data.parts.forEach((ds, i) => ds.forEach((d, h) => writeFileSync(
    `${OUT}/${file}_history_${i + 1}_${["units", "bldgs"][i]}${SPLIT > 1 ? `_${h + 1}` : ""}.png`, Buffer.from(d.split(",")[1], "base64"))));
}
await br.close();
writeFileSync(`${OUT}/README.txt`, `모델 변천 비교 — 종족마다 한 장(유닛·건물). 카드마다 왼쪽부터 7월(사용자가 준 도록 그림 · 제 눈금) · 8/29(2D 붓 · +45°) · ${NOW}(GL 붓 · +40° · 지금). 임자색 ${OWN9} · 흰 바탕.\n`);
execFileSync("zip", ["-qr", `${S}/변천사.zip`, "변천사"], { cwd: S });
console.log("zip →", `${S}/변천사.zip`);
