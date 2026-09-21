/* 7월 도록 그림에서 **모델마다 한 장씩 배경을 뚫어 떼어 낸다**(2026-09, 요청: "7월 사진줄게 모델별로 사진추출해서
 * (배경투명화까지) 레포에 커밋 푸시해놔 앞으로도 쓸테니").
 *
 *   node scripts/history/july-cut.mjs <scratch>        # <scratch>/july_t|p|z.png + july_rows.json 을 읽는다
 *   node scripts/history/july-cut.mjs <scratch> --out <dir>
 *
 * 왜 필요한가: 7월 그림은 **다시 구울 수가 없는 재료**(그때의 붓이 없다)인데 여태 스크래치에만 있어, 컨테이너가 새로 뜨면
 * 변천사의 7월 열이 통째로 날아갔다. 칸을 떼어 저장소에 두면 그 열이 늘 선다.
 *
 * 누끼: 그림은 **검은 칸 바탕(10,10,10) 위에 얹힌 것**이라 바탕과의 거리로 알파를 되짚는다 —
 *   a = (dm − 4) / 140  ·  제 색 = bg + (p − bg)/a   (hist-compose 의 julyWhite 와 같은 자 · 140 은 꽉 찬 초록의 거리다.
 *   36 으로 나누면 반쯤 덮인 가장자리 화소가 a 1 로 그 어두운 색 그대로 남아 검은 테두리가 된다 — 그 지적의 자리).
 * 칸에 박힌 글자 둘(왼 위 돋보기 · 오른 위 눈금)은 알파 0 으로 지운다. 그림자(회색 타원)는 반투명으로 살아남는다. */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JULY_KINDS, JULY_FILE, JULY_CELL } from "./july-kinds.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const S = argv[0]; if (!S) { console.error("usage: july-cut.mjs <scratch> [--out dir]"); process.exit(1); }
const i = argv.indexOf("--out");
const OUT = i < 0 ? join(ROOT, "scripts/history/july") : argv[i + 1];
mkdirSync(OUT, { recursive: true });

const rows = JSON.parse(readFileSync(join(S, "july_rows.json"), "utf8"));
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", headless: false, args: ["--headless=new", "--no-sandbox"] });
const pg = await br.newPage();
await pg.setContent("<body style='margin:0'></body>");
const index = {};
for (const [img, kinds] of Object.entries(JULY_KINDS)) {
  const file = JULY_FILE[img];
  const rs = rows[file];
  if (rs.length !== kinds.length) throw new Error(`${file}: 행 ${rs.length} vs 종류 ${kinds.length}`);
  const src = "data:image/png;base64," + readFileSync(join(S, `${file}.png`)).toString("base64");
  const cuts = await pg.evaluate(async ({ src, rs, C }) => {
    const im = new Image(); im.src = src; await im.decode();
    const s = document.createElement("canvas"); s.width = im.width; s.height = im.height;
    s.getContext("2d").drawImage(im, 0, 0);
    const sg = s.getContext("2d");
    return rs.map(([y0]) => {
      const cv = document.createElement("canvas"); cv.width = C.w; cv.height = C.h;
      const c = cv.getContext("2d");
      c.drawImage(s, C.x, y0 + C.dy, C.w, C.h, 0, 0, C.w, C.h);
      const d = c.getImageData(0, 0, C.w, C.h); const p = d.data; const bj = [10, 10, 10];
      for (let q = 0; q < p.length; q += 4) {
        const dm = Math.max(Math.abs(p[q] - bj[0]), Math.abs(p[q + 1] - bj[1]), Math.abs(p[q + 2] - bj[2]));
        const a = Math.max(0, Math.min(1, (dm - 4) / 140));
        for (let ch = 0; ch < 3; ch += 1) p[q + ch] = a > 0 ? Math.max(0, Math.min(255, Math.round(bj[ch] + (p[q + ch] - bj[ch]) / a))) : 0;
        p[q + 3] = Math.round(a * 255);
      }
      /* 칸에 박힌 글자 둘을 지운다 — 시트 자(JC 200)의 (0,0,44,36)·(150,0,50,30) 이고 이 칸은 그 자에서 (4, 3) 만큼 안쪽이다. */
      const clr = (x0, y1, w, h) => { for (let y = Math.max(0, y1); y < Math.min(C.h, y1 + h); y += 1) for (let x = Math.max(0, x0); x < Math.min(C.w, x0 + w); x += 1) p[(y * C.w + x) * 4 + 3] = 0; };
      clr(0, 0, 44 - 4, 36 - 3); clr(150 - 4, 0, 50, 30 - 3);
      c.putImageData(d, 0, 0);
      return cv.toDataURL("image/png");
    });
  }, { src, rs, C: JULY_CELL });
  kinds.forEach((k, n) => {
    writeFileSync(join(OUT, `${k}.png`), Buffer.from(cuts[n].split(",")[1], "base64"));
    index[k] = { ang: rs[n][1] ?? 23, sheet: file, row: n };
  });
  console.log(`${file} → ${kinds.length}장`);
}
await br.close();
writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
console.log(`${Object.keys(index).length}종 → ${OUT}`);
