#!/usr/bin/env node
/* 재생기 서버 아틀라스(미리 구운 모델 그림)를 쓰는 앱의 정적 자리로 베낀다(2026-10-25 · 원본은 scplay 의 spr/).
 *
 *   node node_modules/scplay/bin/spr-copy.mjs public/spr        ← 앱 package.json 의 postinstall 에 둔다
 *
 * 그다음 앱이 `setReplaySpriteAtlas({ base: "/spr" })` 로 그 자리를 가리킨다(base 는 그 폴더가 서비스되는 URL).
 * 파일 이름이 내용 해시라 k/·index.*.json 은 영구 캐시(immutable)로 내줘도 된다 · basis/ 는 변환기라 짧게.
 * 대상 폴더는 통째로 갈아 끼운다 — 그래서 아틀라스 폴더(basis/ 나 index.*.json 이 든 곳)이거나 비었을 때만 지운다.
 */
import { cpSync, existsSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "spr");
const dest = process.argv[2];
if (!dest) { console.error("쓰는 법: node node_modules/scplay/bin/spr-copy.mjs <대상 폴더 · 예 public/spr>"); process.exit(2); }
const D = resolve(dest);
if (!existsSync(join(SRC, "basis"))) { console.error(`[scplay spr] 원본이 없다: ${SRC}`); process.exit(1); }
if (existsSync(D)) {
  const ls = readdirSync(D);
  const isAtlas = ls.length === 0 || ls.includes("basis") || ls.some((f) => /^index\..*\.json$/.test(f));
  if (!isAtlas) { console.error(`[scplay spr] ${D} 는 아틀라스 폴더가 아니다(basis/·index.*.json 없음) — 지우지 않는다`); process.exit(1); }
  rmSync(D, { recursive: true, force: true });
}
mkdirSync(dirname(D), { recursive: true });
cpSync(SRC, D, { recursive: true });
const n = readdirSync(join(D, "k")).length;
console.log(`[scplay spr] ${n} 개 묶음 파일 → ${D}`);
