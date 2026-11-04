/* 서버 아틀라스 굽기(2026-10-25, 요청: "모든 모델의 그림을 하나도 빠짐없이 그려서 가지고 있다가 보여주면" → "3번 ㄱㄱ" · "피시에도 같이" · "품질 높게" · "빛 켜 같은 것도") ──
 *
 *   node scripts/spr-atlas.mjs --bake [--prune]          굽기(perf-check 덤프 · 수십 분) → 짐 꾸리기 → spr/ · src/components/replay/sprAtlas.gen.ts 갱신
 *   node scripts/spr-atlas.mjs --dump <dumpdir> [--prune]   이미 뜬 덤프로 짐만 다시 꾸린다
 *   node scripts/spr-atlas.mjs --check                   모델 소스의 판(ver)이 sprAtlas.gen.ts 와 같은가 · 표가 가리키는 파일이 spr/ 에 다 있는가(아니면 1)
 *   node scripts/spr-atlas.mjs --bake --kinds pyramidWide,gate [--prune]   ★ 부분 굽기(2026-11-04, 요청: "부분 굽기 옵션 넣어줘") — 고른 종류(SHAPE_BUILDERS 이름 ·
 *     그 별본 WARM_KIN9 포함)만 굽고 지금 표(sprAtlas.gen.ts 의 SPR_ATLAS_INDEX9)의 나머지 종류는 그대로 이어 새 표를 쓴다. 판(src)은 지금 소스로 적는다 —
 *     ⚠ 셰이더(gl9 굽는 셰이더 · 광택표)나 여러 모델이 같이 쓰는 헬퍼(bake9 공용 · mesh9 · shapeOblique)를 고쳤으면 **전체 굽기**를 쓴다(안 구운 종류가 옛 그림인 채 --check 를 통과한다).
 *   (--out <dir> 딴 자리에 꾸리기 · --work <dir> 덤프·PNG 작업 자리 — 기본 scratchpad/spr-work · 덤프는 5GB 남짓)
 *
 * 원본 자리(2026-10-25, 요청: "scplay를 쓰는 다른 곳들에서는 그 파일을 못쓰잖아 그래서 원본을 scplay에 두는게 맞다고 봐"):
 *   구운 파일은 **scplay 저장소의 spr/** 에 커밋한다 — publish-dist.sh 가 dist 브랜치에 함께 싣고, 쓰는 앱은 설치 뒤
 *   `node node_modules/scplay/bin/spr-copy.mjs public/spr` 로 제 정적 자리에 베껴 `setReplaySpriteAtlas({ base: "/spr" })` 로 가리킨다.
 *   spr/basis 는 basis 변환기(three 0.169 examples/jsm/libs/basis) — 로더가 ${base}/basis 에서 읽는다.
 *
 * 굽기: 재생기를 `#sprdump=2` 로 열면(perf-check --sprdump) 모든 종류(UNIT_3D · SHAPE_KIND)·모든 자세·요잉 16 · 그림자 · 건물 변종의 2D 판 칸을 재생기와 **같은 셰이더**로
 *   2 배 해상도에 굽는다(gl9 sprDumpQ ★). 판 픽셀(색 · 임자색/켜짐 · 빛 — GL 행 차례)과 칸 표(열쇠 · 자리 · 배율 · 종류 꼬리표)가 덤프로 나온다.
 * 짐: 칸을 **종류 × 요잉 묶음**(32칸: a 8방 · b 16방 몫 · o 홀 — 아래 parOf ★ · 옛 16칸: 짝 a · 홀 b)으로 다시 싣는다 — 요잉 8 칸 기기(폰 · PC 낮음)는 a 만(짝수 칸 = 8 칸 각) 받는다. 묶음마다 켜 셋(c 색 · t 임자색·켜짐 · e 빛)을
 *   PNG 로 쓰고 basisu 로 KTX2(UASTC · 밉 · zstd)로 누른다. 해상도는 둘 — f(2 배 그대로) · h(반 · 상자 줄임 = 1 배 칸을 2 배로 굽고 줄인 것).
 *   기기가 받을 것: PC 높음 이상 a+b f · PC 낮음 a f · 폰 a h(sprAtlas9.ts).
 * 이름은 **그림 내용의 해시**다 — <out>/k/<종류>.<a|b>.<f|h>.<c|t|e>.<해시8>.ktx2 · 표는 <out>/index.<해시>.json. 안 바뀐 종류는 같은 이름이라 다시 안 누르고(있으면 건너뜀)
 *   앱 저장소에도 다시 안 올라간다(모델 하나를 고치면 그 종류 묶음만 새로 선다). --prune 은 지금 표가 안 가리키는 파일을 지운다.
 * 판(src): 모델·셰이더 소스의 해시 — sprAtlas.gen.ts 의 SPR_ATLAS_SRC9 와 다르면 --check 가 1(모델을 고쳤으면 다시 굽는다). 재생기는 SPR_ATLAS_INDEX9 의 표만 본다.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
import { sizeHash, sizeHashOfGen } from "./sizeHash.mjs";
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const flag = (f, d) => { const i = argv.indexOf(f); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };

/* ── 판(ver) — 그림을 바꾸는 소스의 해시 ── */
const VER_FILES = [
  "src/components/replay/bake9.ts", "src/utils/mesh9.ts", "src/utils/shapeOblique.ts",
  "src/components/replay/tierTable.gen.ts", "src/components/replay/muzzleTable.gen.ts", "src/components/replay/addonWall.gen.ts",
  "src/components/replay/sprLift.gen.ts",   // 큰 몸 단 올림(2026-10-27) — 칸 열쇠의 단이 바뀐다
];
export function atlasVer() {
  const h = createHash("sha1");
  /* 줄 끝은 LF 로 접어 잰다(2026-10-29 · 윈도 클론은 core.autocrlf 로 CRLF 라 같은 소스가 다른 판으로 읽혔다). */
  const lf9 = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  for (const f of VER_FILES) { const p = join(ROOT, f); h.update(f); if (existsSync(p)) h.update(lf9(p)); }
  /* gl9 는 셰이더(템플릿 문자열)와 칸·빛 상수만 — 다른 손질마다 다시 굽지 않게. */
  /* ★ 그리기 전용(굽는 그림에 안 든다) 셰이더·상수는 뺀다(2026-10-27) — 스프라이트를 **붙이는** 셰이더(SPR_VS9·SPR_FS9)와 묶음 상수(SPR_K9·SPR_KRUN9)는
     덤프가 읽는 판 픽셀(굽는 셰이더 renderBatch)과 무관하다. 넣어 두면 붙이는 쪽만 고쳐도 다시 굽기(80분)를 부른다. */
  /* (2026-11-01) 재질 결(MATX_VS9·FS9·FN9)은 시안 동안 이 해시에서 뺐다가 기본 굽기가 되며 도로 넣었다 — 그것을 고치면 다시 굽는다. */
  const gl = lf9(join(ROOT, "src/components/replay/gl9.ts")).replace(/^const SPR_(VS9|FS9) = `[^`]*`;?$/gm, "");
  for (const m of gl.match(/`[^`]*`/g) ?? []) h.update(m);
  /* (2026-11-01) 종족 광택 표(GLOSS_*)도 굽는 그림을 바꾼다 — 넣는다(프로토스 광택을 올리며 해시가 그것을 못 보던 것을 찾았다). */
  for (const m of gl.match(/^const (SPR_[A-Z0-9_]+|LIGHT|SHADOW_K9|MODEL_PERSP|GL_SPEC9|GL_SHADE9|GLOSS_[A-Z0-9_]+)\b.*$/gm) ?? []) if (!/^const SPR_(K9|KRUN9)\b/.test(m)) h.update(m);
  return h.digest("hex").slice(0, 12);
}
const GEN = join(ROOT, "src/components/replay/sprAtlas.gen.ts");
const genVer = () => (existsSync(GEN) ? (/SPR_ATLAS_SRC9 = "([0-9a-f]*)"/.exec(readFileSync(GEN, "utf8"))?.[1] ?? "") : "");
const genIdx = () => (existsSync(GEN) ? (/SPR_ATLAS_INDEX9 = "([^"]*)"/.exec(readFileSync(GEN, "utf8"))?.[1] ?? "") : "");
const OUT = flag("--out", join(ROOT, "spr"));
const WORK = flag("--work", join(ROOT, "scratchpad", "spr-work"));

if (has("--check")) {
  const v = atlasVer(); const g = genVer(); let bad = 0;
  const ix = join(OUT, genIdx());
  if (!genIdx() || !existsSync(ix)) { console.log(`[아틀라스] 표 ${genIdx() || "(없음)"} 이 ${OUT} 에 없다`); bad += 1; }
  else {
    const idx = JSON.parse(readFileSync(ix, "utf8"));
    const miss = Object.values(idx.kinds).flatMap((e) => Object.values(e).flatMap((ch) => [...Object.values(ch.files.f), ...Object.values(ch.files.h)])).filter((f) => !existsSync(join(OUT, "k", f)));
    if (miss.length) { console.log(`[아틀라스] 표가 가리키는 파일 ${miss.length} 개가 없다(예: ${miss[0]})`); bad += 1; }
    for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) if (!existsSync(join(OUT, "basis", f))) { console.log(`[아틀라스] basis/${f} 가 없다`); bad += 1; }
  }
  { const sw = sizeHash(ROOT); const sg = sizeHashOfGen(ROOT); if (sw !== sg) { console.log(`[아틀라스] 크기표가 단 올림표와 다르다(${sg || "(없음)"} → ${sw}) — --bake 가 spr-lift 를 먼저 돌린다`); bad += 1; } }
  if (v !== g) { console.log(`[아틀라스] 판이 다르다: 소스 ${v} · gen ${g || "(없음)"} — 모델을 고쳤으면 다시 굽는다: node scripts/spr-atlas.mjs --bake --prune`); bad += 1; }
  if (!bad) console.log(`[아틀라스] 판 ${v} — 소스와 같다 · 표 ${genIdx()} 의 파일 다 있음`);
  process.exit(bad ? 1 : 0);
}

let DUMP = flag("--dump", null);
/** 부분 굽기(위 머리 ★) — 고른 종류 · 없으면 전체. */
const ONLY = flag("--kinds", null) ? String(flag("--kinds")).split(",").map((k) => k.trim()).filter(Boolean) : null;
if (ONLY && !genIdx()) { console.error("[아틀라스] 부분 굽기는 이어 쓸 지금 표(sprAtlas.gen.ts)가 있어야 한다 — 먼저 전체 굽기"); process.exit(2); }
if (has("--bake")) {
  /* ★ 크기표가 바뀌었으면 단 올림표부터 다시 잰다(2026-11-03, 요청: "다음부터는 크기 변경 시 표도 스크립트로 로컬에서 재생성하게") — 그대로면 바로 건너뛴다.
     표가 바뀌면 판 해시(atlasVer · sprLift.gen.ts 포함)도 바뀌므로 아래 굽기·표 쓰기가 새 표로 돈다. 커밋할 때 sprLift.gen.ts 도 함께. */
  execFileSync("node", [join(ROOT, "scripts/spr-lift.mjs"), "--if-stale"], { stdio: "inherit" });
  DUMP = join(WORK, "_dump");
  rmSync(DUMP, { recursive: true, force: true });
  console.log("[아틀라스] 굽기(perf-check --sprdump) …");
  execFileSync("node", [join(ROOT, "scripts/perf-check.mjs"), "--wide", "--cpu", "1", "--warm", "0", "--bloom", "--mrt",
    "--hash", `sprdump=2,pctier=2,glmesh=4000${ONLY ? `,sprkinds=${ONLY.join("~")}` : ""}`, "--readyms", "900000", "--sprdump", DUMP], { stdio: "inherit" });
}
if (!DUMP || !existsSync(join(DUMP, "cells.json"))) { console.error("덤프가 없다(--dump <dir> 또는 --bake)"); process.exit(2); }

/* ── PNG(8bit RGBA) 쓰기 ── */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, cr]); };
function writePng(path, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) { raw[y * (w * 4 + 1)] = 0; rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]));
}

/* ── basisu ── */
const BASISU = flag("--basisu", process.env.BASISU || "");
if (!BASISU || !existsSync(BASISU)) { console.error("basisu 바이너리가 필요하다(--basisu <path> · npm 패키지 basisu 의 bin/linux/x64/basisu)"); process.exit(2); }
function encode(png, ktx2) {
  /* RDO 는 기본 끔(2026-10-25 실측 2048² 한 판: RDO 0.75 664KB · 6.3s vs 없음 676KB · 3.2s — 칸 둘레가 비어 zstd 가 이미 잘 누른다). --rdo X 로 켠다. */
  const rdo = Number(flag("--rdo", 0));
  execFileSync(BASISU, ["-ktx2", "-uastc", "-uastc_level", String(flag("--uastc-level", 2)), ...(rdo > 0 ? ["-uastc_rdo_l", String(rdo)] : []),
    "-linear", "-mipmap", "-mip_linear", "-mip_clamp", "-ktx2_zstandard_level", "18", "-file", png, "-output_file", ktx2], { stdio: ["ignore", "ignore", "inherit"] });
}

/* ── 짐 꾸리기 ── */
const meta = JSON.parse(readFileSync(join(DUMP, "cells.json"), "utf8"));
const P = 2048;
const pages = new Map();
const pageOf = (i) => {
  if (!pages.has(i)) {
    const rd = (ly) => { const f = join(DUMP, `p${i}.${ly}.raw`); return existsSync(f) ? readFileSync(f) : null; };
    pages.set(i, { c: rd("c"), t: rd("t"), e: rd("e") });
  }
  return pages.get(i);
};
const ybOf = (key) => { const p = key.split("|"); return Number(p[p.length - 6]); };
/** 32칸 머리(gl9 SPR_YAW32_9 와 같은 목록) — 짝·홀로 안 가르고 다 a 에(요잉 8 기기도 32칸을 다 받는다). */
const YAW32 = new Set(["turrethead", "comsatdish"]);
/* ★ **요잉 32**(2026-11-03, 요청: "피시의 경우 유닛 굽기 각을 32방으로 · 32방을 모두 적용 · 캐시를 어떻게 활용할지(다운로드 및 풀기 줄이기)") — 덤프가 32칸이면 묶음을 셋으로:
   a = 칸 % 4 == 0(8방) · b = 칸 % 4 == 2(a 와 합쳐 16방) · c·d = 칸 % 4 == 1·3(넷 다 32방). 기기는 쓰는 묶음만 받고(sprAtlas9 pars) 빠진 칸은
   가까운 칸으로 그리며 뒤에서 굽는다(gl9 sprFill ★). 옛 16칸 덤프는 a(짝)·b(홀) 그대로. */
const YAWN = Number(meta.yaw) || 16;
/* 홀 칸(32방 몫)은 c(칸%4==1)·d(칸%4==3) 둘로 — 한 묶음 16방향이면 울트라 묶음 키가 16384 를 넘는다(옛 16칸 b 8960px × 2). 묶음은 다 8방향씩. */
const parOf = (yb) => (YAWN >= 32 ? ["a", "c", "b", "d"][yb % 4] : yb % 2 ? "b" : "a");
const groups = new Map();
let untagged = 0;
for (const c of meta.cells) {
  if (!c.tag) { untagged += 1; continue; }
  const g = `${c.tag}.${YAW32.has(c.tag) ? "a" : parOf(ybOf(c.key))}`;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(c);
}
const ver = atlasVer();
const outV = join(OUT, "k");
mkdirSync(outV, { recursive: true });
const GAP = 16; const AL = 4; const HAL = 128;
const al = (v, a) => Math.ceil(v / a) * a;
/** 선반 쌓기 — 키 큰 칸부터 · 폭 W · 칸마다 GAP 둘레 · 자리는 AL 맞춤. */
function pack(cells) {
  /* 폭은 1024 · 2048 · 4096 중 묶음이 판에 들고(키 ≤ 폭의 두 배) 칸이 가로로 드는 가장 좁은 것(2026-10-30 · 큰 몸 단 올림 TARGET 1.0 으로 칸이 커져
     2048 폭에 쌓으면 키가 basisu·GPU 상한 16384 를 넘는 묶음이 생긴다 — 뮤탈 자세 아홉 × 요잉 여덟 등). 폰은 반 해상도(h)라 4096 묶음도 2048 이다. */
  const area = cells.reduce((s, c) => s + (c.w + GAP) * (c.h + GAP), 0);
  const fitW = [1024, 2048, 4096].filter((w) => !cells.some((c) => c.w + GAP > w));
  for (const W of fitW) {
    if (W < 4096 && area > W * W * 1.6) continue;
    const r = packAt(cells, W);
    if (W === 4096 || r.H <= W * 2) return r;
  }
  return packAt(cells, 4096);
}
function packAt(cells, W) {
  const order = [...cells].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = GAP / 2, y = GAP / 2, rowH = 0;
  const at = new Map();
  for (const c of order) {
    if (x + c.w + GAP / 2 > W) { x = GAP / 2; y += rowH + GAP; rowH = 0; }
    at.set(c, [al(x, AL), al(y, AL)]);
    x = al(x, AL) + c.w + GAP; rowH = Math.max(rowH, c.h + (al(y, AL) - y));
  }
  const H = al(y + rowH + GAP / 2, HAL);
  return { W, H, at };
}
/** 칸 픽셀을 묶음 버퍼로(둘 다 GL 행 차례 — 칸의 위(py)는 판 위에서 잰 값이라 GL 행으로는 P − py − h ~ P − py). */
function blit(dst, W, H, src, c, cx, cyTop) {
  for (let r = 0; r < c.h; r += 1) {
    const sy = P - c.py - c.h + r; const dy = H - cyTop - c.h + r;
    src.copy(dst, (dy * W + cx) * 4, (sy * P + c.px) * 4, (sy * P + c.px + c.w) * 4);
  }
}
/** 반 해상도(상자 줄임 · 미리곱 알파라 그대로 평균). */
function half(buf, W, H) {
  const w2 = W / 2, h2 = H / 2; const out = Buffer.alloc(w2 * h2 * 4);
  for (let y = 0; y < h2; y += 1) for (let x = 0; x < w2; x += 1) for (let k = 0; k < 4; k += 1) {
    const s = buf[((2 * y) * W + 2 * x) * 4 + k] + buf[((2 * y) * W + 2 * x + 1) * 4 + k] + buf[((2 * y + 1) * W + 2 * x) * 4 + k] + buf[((2 * y + 1) * W + 2 * x + 1) * 4 + k];
    out[(y * w2 + x) * 4 + k] = (s + 2) >> 2;
  }
  return out;
}
const nonzero = (b) => { for (let i = 0; i < b.length; i += 4) if (b[i] | b[i + 1] | b[i + 2] | b[i + 3]) return true; return false; };
const index = { src: ver, q: meta.q, yaw: YAWN, kinds: {} };
/* 부분 굽기 — 지금 표의 종류를 먼저 옮겨 두고 이번에 구운 종류(꼬리표)만 갈아 끼운다. 배율(q)·요잉 칸 수가 다르면 섞을 수 없다. */
if (ONLY) {
  const old = JSON.parse(readFileSync(join(OUT, genIdx()), "utf8"));
  if (old.q !== index.q || (old.yaw || 16) !== YAWN) { console.error(`[아틀라스] 부분 굽기: 지금 표(q ${old.q} · 요잉 ${old.yaw || 16})와 덤프(q ${index.q} · 요잉 ${YAWN})가 달라 이을 수 없다 — 전체 굽기`); process.exit(2); }
  const fresh = new Set([...groups.keys()].map((g) => g.slice(0, g.lastIndexOf("."))));
  for (const [k, e] of Object.entries(old.kinds)) if (!fresh.has(k)) index.kinds[k] = e;
  console.log(`[아틀라스] 부분 굽기 — 새로 ${[...fresh].sort().join(" · ") || "(없음)"} · 그대로 ${Object.keys(index.kinds).length} 종류`);
  if (fresh.size === 0) { console.error("[아틀라스] 고른 종류의 칸이 덤프에 없다(이름을 SHAPE_BUILDERS 이름으로)"); process.exit(2); }
}
let nEnc = 0; let nSkip = 0;
const tmp = join(WORK, "_png"); mkdirSync(tmp, { recursive: true });
let nDone = 0; let bytes = { f: 0, h: 0 };
for (const [g, cells] of [...groups.entries()].sort()) {
  const [kind, par] = [g.slice(0, g.lastIndexOf(".")), g.slice(g.lastIndexOf(".") + 1)];
  const { W, H, at } = pack(cells);
  if (H > 16384) { console.error(`[짐] ${g} 묶음 높이 ${H}px — 16384 를 넘는다(basisu·GPU 텍스처 상한 · 칸 ${cells.length}개). 그 종류의 찍는 단(gl9 sprLv9)을 본다.`); process.exit(3); }
  const bufs = { c: Buffer.alloc(W * H * 4), t: Buffer.alloc(W * H * 4), e: Buffer.alloc(W * H * 4) };
  for (const c of cells) { const pg = pageOf(c.page); const [cx, cy] = at.get(c); for (const ly of ["c", "t", "e"]) if (pg[ly]) blit(bufs[ly], W, H, pg[ly], c, cx, cy); }
  for (let i = 3; i < bufs.t.length; i += 4) bufs.t[i] = 255;   // 임자색 켜(R)·켜짐(G) — 알파는 안 쓴다(압축이 알파 채널을 따로 안 먹게)
  const layers = ["c", ...(nonzero(bufs.t.map((v, i) => (i % 4 === 3 ? 0 : v))) ? ["t"] : []), ...(nonzero(bufs.e) ? ["e"] : [])];
  const ent = { w: W, h: H, layers, files: { f: {}, h: {} }, cells: cells.map((c) => { const [cx, cy] = at.get(c); return [c.key, cx, cy, c.w, c.h, c.x0, c.y0, c.kd]; }) };
  for (const res of ["f", "h"]) {
    for (const ly of layers) {
      const px = res === "f" ? bufs[ly] : half(bufs[ly], W, H); const w = res === "f" ? W : W / 2; const h = res === "f" ? H : H / 2;
      const hh = createHash("sha1").update(`${w}x${h}|`).update(px).digest("hex").slice(0, 10);
      const name = `${g}.${res}.${ly}.${hh}.ktx2`; const k2 = join(outV, name);
      if (existsSync(k2)) nSkip += 1;
      else { const png = join(tmp, `${g}.${res}.${ly}.png`); writePng(png, w, h, px); encode(png, k2); nEnc += 1; }
      ent.files[res][ly] = name;
      bytes[res] += statSync(k2).size;
    }
  }
  (index.kinds[kind] ??= {})[par] = ent;
  nDone += 1;
  if (nDone % 10 === 0) console.log(`  [짐] ${nDone}/${groups.size} · f ${(bytes.f / 1048576).toFixed(1)}MB · h ${(bytes.h / 1048576).toFixed(1)}MB`);
}
const idxJson = JSON.stringify(index);
const idxName = `index.${createHash("sha1").update(idxJson).digest("hex").slice(0, 10)}.json`;
writeFileSync(join(OUT, idxName), idxJson);
rmSync(tmp, { recursive: true, force: true });
writeFileSync(GEN, `/* 생성 파일(scripts/spr-atlas.mjs) — 손으로 고치지 마라. 서버 아틀라스 · 모델·셰이더 소스가 바뀌면 다시 굽는다(--check). */\n` +
  `/** 그림을 바꾸는 소스의 해시(--check 가 견준다). */\nexport const SPR_ATLAS_SRC9 = "${ver}";\n/** 재생기가 읽는 표(앱의 아틀라스 자리 아래 · 내용 해시 이름). */\nexport const SPR_ATLAS_INDEX9 = "${idxName}";\n`);
if (has("--prune")) {
  const { readdirSync } = await import("node:fs");
  const keep = new Set(Object.values(index.kinds).flatMap((e) => Object.values(e).flatMap((ch) => [...Object.values(ch.files.f), ...Object.values(ch.files.h)])));
  let nDel = 0;
  for (const f of readdirSync(outV)) if (!keep.has(f)) { rmSync(join(outV, f)); nDel += 1; }
  for (const f of readdirSync(OUT)) if (/^index\..*\.json$/.test(f) && f !== idxName) { rmSync(join(OUT, f)); nDel += 1; }
  console.log(`[아틀라스] 지움 ${nDel}`);
}
console.log(`[아틀라스] 표 ${idxName} · 소스 ${ver} · 묶음 ${groups.size} · 칸 ${meta.cells.length - untagged}(꼬리표 없음 ${untagged}) · 누름 ${nEnc} · 그대로 ${nSkip} · f ${(bytes.f / 1048576).toFixed(1)}MB · h ${(bytes.h / 1048576).toFixed(1)}MB → ${OUT}`);
