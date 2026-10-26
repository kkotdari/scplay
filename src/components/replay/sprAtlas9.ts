/* 서버 아틀라스 로더(2026-10-25, 요청: "모든 모델의 그림을 하나도 빠짐없이 그려서 가지고 있다가 보여주면" → "3번 ㄱㄱ" · "피시에도 같이" · "품질 높게" · "빛 켜 같은 것도") ──
   굽기·짐은 scripts/spr-atlas.mjs(머리말) — 표(SPR_ATLAS_INDEX9 · 내용 해시 이름)와 `${base}/k/` 아래 종류 × 요잉 짝(a)/홀(b) × 해상도(f 2 배 · h 1 배) × 켜(c 색 · t 임자색·켜짐 ·
   e 빛)의 KTX2(UASTC · 밉)가 있다. 여기서는 경기에 나오는 종류만 받아 Basis 변환기로 **기기 GPU 형식**(ASTC · BC7 · ETC2 · 없으면 RGBA)으로 풀고 gl9 의 고정 판에 싣는다
   (sprAtlasTexture9 → sprAtlasAdd9). 칸 열쇠는 재생기와 같아(같은 셰이더·같은 열쇠 셈으로 구웠다) 붓은 그대로 그 칸을 찾는다 — 없는 칸은 종전대로 재생 중에 굽는다.
   ⚠ 앱이 setReplaySpriteAtlas({ base }) 로 자리를 줘야 켜진다(배경 음악 setReplayBgm 과 같은 꼴). base 아래 basis/basis_transcoder.{js,wasm} 도 둔다. */
import { SPR_ATLAS_INDEX9 } from "./sprAtlas.gen";
import type { GlUnits9 } from "./gl9";

let BASE: string | null = null;
/** 아틀라스 자리(앱이 준다 · 예: "/spr") — null 이면 끈다. */
export function setReplaySpriteAtlas(opt: { base: string } | null): void { BASE = opt?.base ? opt.base.replace(/\/+$/, "") : null; }
export const sprAtlasOn9 = (): boolean => !!BASE && !!SPR_ATLAS_INDEX9 && !(typeof location !== "undefined" && /sprAtlas=0|spratlas=0/.test(location.hash));

type Cell9 = [string, number, number, number, number, number, number, number];
interface Chunk9 { w: number; h: number; layers: string[]; files: { f: Record<string, string>; h: Record<string, string> }; cells: Cell9[] }
interface Index9 { src: string; q: number; yaw: number; kinds: Record<string, { a?: Chunk9; b?: Chunk9 }> }
/* eslint-disable @typescript-eslint/no-explicit-any */
type BasisM = any;

let idxP: Promise<Index9 | null> | null = null; let idxBase = "";
function index9(): Promise<Index9 | null> {
  if (!BASE) return Promise.resolve(null);
  if (idxP && idxBase === BASE) return idxP;
  idxBase = BASE;
  idxP = fetch(`${BASE}/${SPR_ATLAS_INDEX9}`).then((r) => (r.ok ? r.json() : null)).then((j: Index9 | null) => (j && j.kinds ? j : null)).catch(() => null);
  return idxP;
}
let basisP: Promise<BasisM> | null = null;
function basis9(): Promise<BasisM> {
  if (basisP) return basisP;
  const base = BASE!;
  basisP = new Promise<BasisM>((res, rej) => {
    const w = window as any;
    const go = (): void => { w.BASIS({ locateFile: (f: string) => `${base}/basis/${f}` }).then((M: BasisM) => { M.initializeBasis(); res(M); }, rej); };
    if (w.BASIS) { go(); return; }
    const sc = document.createElement("script");
    sc.src = `${base}/basis/basis_transcoder.js`; sc.async = true; sc.onload = go; sc.onerror = () => rej(new Error("basis_transcoder"));
    document.head.appendChild(sc);
  });
  basisP.catch(() => { basisP = null; });
  return basisP;
}
/** KTX2 한 장을 기기 형식의 단들로 — 밉은 앞 maxLv 단만(gl9 SPR_MIP9 + 1). */
function transcode9(M: BasisM, buf: ArrayBuffer, tf: number, maxLv: number): { w: number; h: number; data: Uint8Array }[] | null {
  const f = new M.KTX2File(new Uint8Array(buf));
  try {
    if (!f.isValid() || !f.startTranscoding()) return null;
    const out: { w: number; h: number; data: Uint8Array }[] = [];
    const n = Math.min(f.getLevels(), maxLv);
    for (let l = 0; l < n; l += 1) {
      const info = f.getImageLevelInfo(l, 0, 0);
      if (l > 0 && (info.origWidth < 4 || info.origHeight < 4)) break;   // BC7 은 단마다 4 의 배수 — 4 밑 단은 안 올린다(MAX_LEVEL 이 단 수를 따른다)
      const dst = new Uint8Array(f.getImageTranscodedSizeInBytes(l, 0, 0, tf));
      if (!f.transcodeImage(dst, l, 0, 0, tf, 0, -1, -1)) return null;
      out.push({ w: info.origWidth, h: info.origHeight, data: dst });
    }
    return out;
  } finally { f.close(); f.delete(); }
}
/** 이 GL 벌에 이미 실은 묶음(종류.a/b.f/h) — 예열이 다시 돌아도 두 번 안 싣는다. */
const loaded9 = new WeakMap<GlUnits9, Set<string>>();
/** 이 벌에서 싣기에 실패한 묶음(풀기 실패 · 텍스처 상한 초과 등) — 벌이 판을 넘어 살므로 판마다 다시 받지 않게 적어 둔다(2026-10-26). */
const failed9 = new WeakMap<GlUnits9, Set<string>>();
/** 한 번 싣기의 결과 — cells·mb·chunks 는 이번에 새로 실은 것 · kept 는 앞 판에서 물려받은 묶음 · dropped 는 상한에 걷은 묶음. */
export interface SprAtlasLoad9 { cells: number; mb: number; ms: number; fmt: string; chunks: number; miss: number; kept: number; dropped: number;
  /** 받기를 기다린 ms(풀기가 다음 묶음을 기다리며 선 때) · 풀고 올린 ms · 받은 바이트(MB) — 오래 걸리는 몫이 망인지 풀기인지 가르는 자(2026-10-26). */
  waitMs: number; workMs: number; netMB: number; err?: string }
/** 경기 종류들의 아틀라스를 싣는다 — kinds 는 많이 쓰는 차례 · mbCap 을 넘으면 거기서 멈춘다(나머지는 재생 중 굽기). */
export async function sprAtlasLoad9(g9: GlUnits9, kinds: string[], opt: { res: "f" | "h"; odd: boolean; em: boolean; mbCap: number }): Promise<SprAtlasLoad9> {
  const t0 = performance.now();
  const r: SprAtlasLoad9 = { cells: 0, mb: 0, ms: 0, fmt: "-", chunks: 0, miss: 0, kept: 0, dropped: 0, waitMs: 0, workMs: 0, netMB: 0 };
  if (!sprAtlasOn9() || !g9.sprTint || !g9.gl2) { r.err = !g9.sprTint ? "임자색 분리 없음" : "꺼짐"; return r; }
  try {
    const idx = await index9();
    if (!idx) { r.err = "판 없음"; return r; }
    const M = await basis9();
    const fmt = g9.sprAtlasFmt9(); r.fmt = fmt.name;
    /* 압축 확장이 하나도 없으면(RGBA 로 푼다) 화소당 4 바이트라 — 반 해상도로 내리고 상한을 죈다. */
    if (fmt.gl === 0) { opt = { ...opt, res: "h", mbCap: Math.min(opt.mbCap, 384) }; }
    const done = loaded9.get(g9) ?? new Set<string>(); loaded9.set(g9, done);
    const bad = failed9.get(g9) ?? new Set<string>(); failed9.set(g9, bad);
    /* ★ 벌이 판을 넘어 산다(2026-10-26, 요청: "그래픽소스를 매판 받지 않게 하기" — RMP 의 GL 캔버스 맡김 ★) — 앞 판에 실은 묶음은 그대로 쓰고(done) 새 종류만 받는다.
       상한은 **이미 실은 것 전부**(g9.sprFixedMB)에 견준다 — 넘치면 이번 판에 안 나오는 묶음부터(먼저 실은 차례로) 걷어 자리를 낸다. */
    const want = new Set(kinds);
    const spare = (): string | undefined => [...done].find((tg) => !want.has(tg.slice(0, tg.indexOf("."))));
    const yaw8 = g9.sprYaw === 8;
    const k = opt.res === "h" ? 0.5 : 1;
    const jobs: { kind: string; par: "a" | "b"; ch: Chunk9 }[] = [];
    for (const kind of kinds) {
      const e = idx.kinds[kind]; if (!e) { r.miss += 1; continue; }
      for (const par of (opt.odd && !yaw8 ? ["a", "b"] : ["a"]) as ("a" | "b")[]) { const ch = e[par]; if (!ch) continue; if (done.has(`${kind}.${par}.${opt.res}`)) r.kept += 1; else if (!bad.has(`${kind}.${par}.${opt.res}`)) jobs.push({ kind, par, ch }); }
    }
    /* 받기는 여섯씩 겹쳐서 · 싣기는 차례대로(GL) — 바이트 상한에 닿으면 그만. */
    const url = (j: (typeof jobs)[number], ly: string): string => `${BASE}/k/${j.ch.files[opt.res][ly]}`;
    const fetchJob = (j: (typeof jobs)[number]): Promise<Record<string, ArrayBuffer | null>> => {
      const lys = j.ch.layers.filter((ly) => (ly !== "e" || opt.em) && !!j.ch.files[opt.res][ly]);
      return Promise.all(lys.map((ly) => fetch(url(j, ly)).then((x) => (x.ok ? x.arrayBuffer() : null)).then((b) => { if (b) r.netMB += b.byteLength / 1048576; return b; }).catch(() => null)))
        .then((bs) => Object.fromEntries(lys.map((ly, i) => [ly, bs[i]])));
    };
    const pend: Promise<Record<string, ArrayBuffer | null>>[] = [];
    for (let i = 0; i < Math.min(6, jobs.length); i += 1) pend.push(fetchJob(jobs[i]));
    for (let i = 0; i < jobs.length; i += 1) {
      const j = jobs[i];
      const tw = performance.now();
      const bufs = await pend[i];
      if (i + 6 < jobs.length) pend.push(fetchJob(jobs[i + 6]));
      const tk = performance.now(); r.waitMs += tk - tw;
      const jt = `${j.kind}.${j.par}.${opt.res}`;
      if (!bufs.c) continue;   // 받기 실패(망) — 다음 판에 다시 받는다
      const lv = (b: ArrayBuffer | null | undefined): { w: number; h: number; data: Uint8Array }[] | null => (b ? transcode9(M, b, fmt.tf, 6) : null);
      const c = lv(bufs.c); if (!c) { bad.add(jt); continue; }
      const t = lv(bufs.t); const e = lv(bufs.e);
      const mbOf = (ls: { data: Uint8Array }[] | null): number => (ls ? ls.reduce((s, x) => s + x.data.length, 0) / 1048576 : 0);
      const mb = mbOf(c) + mbOf(t) + mbOf(e);
      let tg: string | undefined;
      while (g9.sprFixedMB + mb > opt.mbCap && (tg = spare()) !== undefined) { g9.sprAtlasDrop9(tg); done.delete(tg); r.dropped += 1; }
      if (g9.sprFixedMB + mb > opt.mbCap) break;
      const tc = g9.sprAtlasTexture9(c, fmt.gl); if (!tc) { bad.add(jt); continue; }
      const tt = t ? g9.sprAtlasTexture9(t, fmt.gl) : null; const te = e ? g9.sprAtlasTexture9(e, fmt.gl) : null;
      const cells = [];
      for (const [key0, px, py, w, h, x0, y0, kd] of j.ch.cells) {
        let key = key0;
        if (yaw8) { const p = key0.split("|"); const yb = Number(p[p.length - 6]); if (yb % 2) continue; p[p.length - 6] = String(yb / 2); key = p.join("|"); }
        cells.push({ key, px: px * k, py: py * k, w: w * k, h: h * k, x0: x0 * k, y0: y0 * k, kd: kd * k });
      }
      r.cells += g9.sprAtlasAdd9(tc, tt, te, j.ch.w * k, j.ch.h * k, mb, cells, jt);
      r.mb += mb; r.chunks += 1;
      done.add(jt);
      r.workMs += performance.now() - tk;
      /* 한 묶음마다 한 박자 쉰다 — 로딩 글자 애니메이션이 서지 않게. */
      await new Promise((res) => setTimeout(res, 0));
    }
  } catch (e) { r.err = String((e as Error)?.message ?? e); }
  r.ms = Math.round(performance.now() - t0);
  return r;
}
