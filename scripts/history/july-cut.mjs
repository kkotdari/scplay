/* 7월 도록 그림에서 **모델마다 한 장씩 배경을 뚫어 떼어 낸다**(2026-09, 요청: "7월 사진줄게 모델별로 사진추출해서
 * (배경투명화까지) 레포에 커밋 푸시해놔 앞으로도 쓸테니").
 *
 *   node scripts/history/july-cut.mjs <scratch>        # <scratch>/july_t|p|z.png + july_rows.json 을 읽는다
 *   node scripts/history/july-cut.mjs <scratch> --out <dir>
 *
 * 왜 필요한가: 7월 그림은 **다시 구울 수가 없는 재료**(그때의 붓이 없다)인데 여태 스크래치에만 있어, 컨테이너가 새로 뜨면
 * 변천사의 7월 열이 통째로 날아갔다. 칸을 떼어 저장소에 두면 그 열이 늘 선다.
 *
 * 누끼: 그림은 **검은 칸 바탕(10,10,10) 위에 얹힌 것**이다(p = a·c). 한 화소만 보고는 a 와 c 를 못 가르므로
 * **이웃의 속살 색으로 되짚는다**(2026-09, 지적: "7월샷의 누끼를 좀더 깔끔하게 따야돼"):
 *   ① 속살 = 네 이웃이 다 바탕이 아닌 화소 → a 1 · 제 색 그대로(톱니 없는 안쪽은 건드리지 않는다)
 *   ② 테두리 = 바탕과 맞닿은 화소 → 가장 가까운 속살 색 c 에 **사영**해 a = (p−bg)·(c−bg) / |c−bg|² · 색은 c
 *   ③ 속살이 없는 가는 것(더듬이·가시) → 되돌기 a = (dm − 4)/190
 * ⚠ 옛 자는 **한 값(140)으로 나누는 것**이었다 — 이 팔레트의 꽉 찬 거리는 낯마다 178~215 라(실측) 밝은 낯의 반쯤 덮인
 *   화소가 a 0.77 로 잡혀 제 색이 그만큼 어두워졌다. 그것이 확대하면 보이던 **잿빛 테두리**다(140 을 키우기만 하면
 *   이번엔 어두운 낯이 너무 투명해진다 — 나누는 수가 아니라 **이웃 색**이 답이다).
 * 칸에 박힌 글자 둘(왼 위 돋보기 · 오른 위 눈금)은 네모 둘 안의 **무채색만** 지운다 — 네모로 통째로 지우면 그 자리에
 * 걸친 모델(큰 건물의 뿔)까지 날아간다. */
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
      const W = C.w, H = C.h, N = W * H;
      const src = new Uint8ClampedArray(p);            // 원본 화소(되짚기는 이것만 본다)
      const dm = new Float32Array(N);
      for (let i2 = 0; i2 < N; i2 += 1) { const q = i2 * 4; dm[i2] = Math.max(Math.abs(src[q] - bj[0]), Math.abs(src[q + 1] - bj[1]), Math.abs(src[q + 2] - bj[2])); }
      /* 칸에 박힌 글자 둘 — 시트 자(JC 200)의 (0,0,44,36)·(150,0,50,30) 이고 이 칸은 그 자에서 (4, 3) 만큼 안쪽이다.
         네모 안이라도 **무채색**(채널 차 < 18)만 지운다: 글자·돋보기는 잿빛이고 모델은 초록이다. */
      const wipe = (x0, y0b, w, h) => { let n = 0;
        for (let y = Math.max(0, y0b); y < Math.min(H, y0b + h); y += 1) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x += 1) {
          const i2 = y * W + x; const q = i2 * 4;
          const mx = Math.max(src[q], src[q + 1], src[q + 2]); const mn = Math.min(src[q], src[q + 1], src[q + 2]);
          if (dm[i2] > NB && mx - mn < 18) { dm[i2] = 0; n += 1; }
        } return n; };
      const NB = 10;   // 바탕 문턱
      wipe(0, 0, 44 - 4, 36 - 3); wipe(150 - 4, 0, 50, 30 - 3);
      const ink = (i2) => dm[i2] > NB;
      /* ⚠ **그림자는 몸이 아니다** — 7월 그림에는 유닛 밑에 회색 접지 타원이 반투명으로 깔려 있다(검은 바탕 위라 어두운
         무채색으로 보인다). 그것을 몸으로 보면 속살 규칙이 a 1 을 줘 **새까만 덩이**가 된다(실측: 벌처 밑이 검은 타원).
         그래서 **어두운 무채색은 그림자**로 갈라 옛 자(거리로 나눠 되짚기)로 남기고, 몸(초록 낯 · 밝은 잿빛 부품 —
         발판·아콘 구슬·간헐천 바위)만 속살·사영 자로 딴다. */
      const SHD = 110;   // 무채색이 이 거리 아래면 그림자
      const body = new Uint8Array(N);
      for (let i2 = 0; i2 < N; i2 += 1) {
        if (!ink(i2)) continue; const q = i2 * 4;
        const mx = Math.max(src[q], src[q + 1], src[q + 2]), mn = Math.min(src[q], src[q + 1], src[q + 2]);
        if (mx - mn >= 20 || dm[i2] >= SHD) body[i2] = 1;
      }
      const inner = new Uint8Array(N);
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const i2 = y * W + x; if (!body[i2]) continue;
        if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && body[i2 - 1] && body[i2 + 1] && body[i2 - W] && body[i2 + W]) inner[i2] = 1;
      }
      const R = 2;   // 테두리 화소가 속살을 찾는 반경
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const i2 = y * W + x; const q = i2 * 4;
        if (!ink(i2)) { p[q] = p[q + 1] = p[q + 2] = p[q + 3] = 0; continue; }
        if (!body[i2]) {                                                   // 그림자 — 옛 자로 되짚어 반투명으로 남긴다
          const a0 = Math.max(0, Math.min(1, (dm[i2] - 4) / 140));
          for (let ch = 0; ch < 3; ch += 1) p[q + ch] = a0 > 0 ? Math.round(Math.max(0, Math.min(255, bj[ch] + (src[q + ch] - bj[ch]) / a0))) : 0;
          p[q + 3] = Math.round(a0 * 255); continue;
        }
        if (inner[i2]) { p[q + 3] = 255; continue; }                       // 속살 — 제 색 그대로
        let best = -1, bd = 1e9;
        for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy += 1) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx += 1) {
          const j = yy * W + xx; if (!inner[j]) continue;
          const dd = (xx - x) * (xx - x) + (yy - y) * (yy - y); if (dd < bd) { bd = dd; best = j; }
        }
        let a; let col;
        if (best >= 0) {
          const b4 = best * 4; col = [src[b4] - bj[0], src[b4 + 1] - bj[1], src[b4 + 2] - bj[2]];
          const dot = (src[q] - bj[0]) * col[0] + (src[q + 1] - bj[1]) * col[1] + (src[q + 2] - bj[2]) * col[2];
          const len = col[0] * col[0] + col[1] * col[1] + col[2] * col[2];
          a = Math.max(0, Math.min(1, len > 0 ? dot / len : 0));
          for (let ch = 0; ch < 3; ch += 1) p[q + ch] = src[b4 + ch];
        } else {
          a = Math.max(0, Math.min(1, (dm[i2] - 4) / 190));
          for (let ch = 0; ch < 3; ch += 1) p[q + ch] = a > 0 ? Math.round(Math.max(0, Math.min(255, bj[ch] + (src[q + ch] - bj[ch]) / a))) : 0;
        }
        p[q + 3] = Math.round(a * 255);
      }
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
