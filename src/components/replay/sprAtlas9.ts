/* 서버 아틀라스 로더(2026-10-25, 요청: "모든 모델의 그림을 하나도 빠짐없이 그려서 가지고 있다가 보여주면" → "3번 ㄱㄱ" · "피시에도 같이" · "품질 높게" · "빛 켜 같은 것도") ──
   굽기·짐은 scripts/spr-atlas.mjs(머리말) — 표(SPR_ATLAS_INDEX9 · 내용 해시 이름)와 `${base}/k/` 아래 종류 × 요잉 짝(a)/홀(b) × 해상도(f 2 배 · h 1 배) × 켜(c 색 · t 임자색·켜짐 ·
   e 빛)의 KTX2(UASTC · 밉)가 있다. 여기서는 경기에 나오는 종류만 받아 Basis 변환기로 **기기 GPU 형식**(ASTC · BC7 · ETC2 · 없으면 RGBA)으로 풀고 gl9 의 고정 판에 싣는다
   (sprAtlasTexture9 → sprAtlasAdd9). 칸 열쇠는 재생기와 같아(같은 셰이더·같은 열쇠 셈으로 구웠다) 붓은 그대로 그 칸을 찾는다 — 없는 칸은 종전대로 재생 중에 굽는다.
   ⚠ 앱이 setReplaySpriteAtlas({ base }) 로 자리를 줘야 켜진다(배경 음악 setReplayBgm 과 같은 꼴). base 아래 basis/basis_transcoder.{js,wasm} 도 둔다. */
import { SPR_ATLAS_INDEX9 } from "./sprAtlas.gen";
import { SPR_YAW32_9, type GlUnits9 } from "./gl9";

let BASE: string | null = null;
/** 아틀라스 자리(앱이 준다 · 예: "/spr") — null 이면 끈다. */
export function setReplaySpriteAtlas(opt: { base: string } | null): void { BASE = opt?.base ? opt.base.replace(/\/+$/, "") : null; }
export const sprAtlasOn9 = (): boolean => !!BASE && !!SPR_ATLAS_INDEX9;

type Cell9 = [string, number, number, number, number, number, number, number];
interface Chunk9 { w: number; h: number; layers: string[]; files: { f: Record<string, string>; h: Record<string, string> }; cells: Cell9[] }
type Par9 = "a" | "b" | "c" | "d";
interface Index9 { src: string; q: number; yaw: number; kinds: Record<string, { a?: Chunk9; b?: Chunk9; c?: Chunk9; d?: Chunk9 }> }
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
/* ★ **풀기는 워커 여럿이**(2026-10-26, 요청: "1, 2 ㄱㄱ" — 실측 PC 첫 판 7.1초 중 풀기 5.0초 · 받기 대기 0.24초 · gl-renderer.md '아틀라스 싣기 — 망이냐 풀기냐') ──
   옛: 메인 스레드 하나가 묶음을 차례로 풀었다(Basis UASTC → BC7/ASTC 는 CPU 일 · 그동안 로딩 글자도 섰다). 이제 워커 N 개(코어 − 1 · 2~4)가 같은 basis_transcoder 를 제각기
   싣고 묶음 켜를 나눠 푼다 — 단들의 바이트는 옮겨(transfer) 돌려준다. GL 싣기(텍스처 올리기)는 메인 스레드라 차례대로. 워커를 못 세우면(CSP · 실패) 메인 스레드로 푼다.
   풀(pool)은 모듈에 한 벌 — 판을 넘어 산다(벌 물려주기와 같은 까닭). 워커 소스는 문자열을 이어 짓는다(템플릿 문자열 안 역따옴표 금지 규약). */
type Levels9 = { w: number; h: number; data: Uint8Array }[];
const WORKER_SRC9 = [
  "var M=null;",
  "function tc(buf,tf,maxLv){var f=new M.KTX2File(new Uint8Array(buf));try{if(!f.isValid()||!f.startTranscoding())return null;var out=[];var n=Math.min(f.getLevels(),maxLv);",
  "for(var l=0;l<n;l++){var info=f.getImageLevelInfo(l,0,0);if(l>0&&(info.origWidth<4||info.origHeight<4))break;",
  "var dst=new Uint8Array(f.getImageTranscodedSizeInBytes(l,0,0,tf));if(!f.transcodeImage(dst,l,0,0,tf,0,-1,-1))return null;out.push({w:info.origWidth,h:info.origHeight,data:dst});}",
  "return out;}finally{f.close();f.delete();}}",
  "self.onmessage=function(e){var d=e.data;",
  "if(d.init){try{importScripts(d.js);BASIS({locateFile:function(x){return d.base+'/basis/'+x;}}).then(function(m){M=m;M.initializeBasis();self.postMessage({ready:true});},function(err){self.postMessage({ready:false,err:String(err)});});}catch(err){self.postMessage({ready:false,err:String(err)});}return;}",
  "var out=null;try{out=tc(d.buf,d.tf,d.maxLv);}catch(err){out=null;}",
  "self.postMessage({id:d.id,out:out},out?out.map(function(x){return x.data.buffer;}):[]);};",
].join("\n");
type Pool9 = { ws: Worker[]; busy: number[]; next: number; wait: Map<number, (v: Levels9 | null) => void> };
let poolP9: Promise<Pool9 | null> | null = null; let poolBase9 = "";
/* 워커 수 — 부른 쪽이 정하면 그 수(폰 1 · 2026-10-26, 요청: "워커 1개 고정" — 첫 판 몇 초 동안 코어 여럿을 꽉 채우던 순간 발열) · 아니면 코어 − 1(2~4). 풀은 처음 선 수 그대로 산다. */
function pool9(want?: number): Promise<Pool9 | null> {
  if (!BASE || typeof Worker === "undefined") return Promise.resolve(null);
  if (poolP9 && poolBase9 === BASE) return poolP9;
  poolBase9 = BASE;
  const abs9 = new URL(BASE + "/", typeof location !== "undefined" ? location.href : "http://x/").href.replace(/\/+$/, "");
  const n9 = want !== undefined && want >= 1 ? Math.floor(want) : Math.max(2, Math.min(4, ((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4) - 1));
  poolP9 = (async () => {
    let url9 = "";
    try { url9 = URL.createObjectURL(new Blob([WORKER_SRC9], { type: "text/javascript" })); } catch { return null; }
    const pl9: Pool9 = { ws: [], busy: [], next: 1, wait: new Map() };
    const ok9 = await Promise.all(Array.from({ length: n9 }, () => new Promise<Worker | null>((res) => {
      let w9: Worker;
      try { w9 = new Worker(url9); } catch { res(null); return; }
      const to9 = setTimeout(() => { w9.terminate(); res(null); }, 15000);
      w9.onmessage = (e: MessageEvent) => {
        const d9 = e.data as { ready?: boolean; id?: number; out?: Levels9 | null };
        if (d9.ready !== undefined) { clearTimeout(to9); if (d9.ready) res(w9); else { w9.terminate(); res(null); } return; }
        const f9 = pl9.wait.get(d9.id!); if (f9) { pl9.wait.delete(d9.id!); f9(d9.out ?? null); }
      };
      w9.onerror = () => { clearTimeout(to9); res(null); };
      w9.postMessage({ init: true, js: abs9 + "/basis/basis_transcoder.js", base: abs9 });
    })));
    for (const w9 of ok9) if (w9) { pl9.ws.push(w9); pl9.busy.push(0); }
    return pl9.ws.length > 0 ? pl9 : null;
  })();
  return poolP9;
}
/** 켜 하나를 풀 워커에게(가장 한가한 것) — 바이트는 옮긴다(받은 버퍼는 이 뒤로 못 쓴다). */
function poolRun9(pl9: Pool9, buf: ArrayBuffer, tf: number, maxLv: number): Promise<Levels9 | null> {
  let k9 = 0; for (let i9 = 1; i9 < pl9.ws.length; i9 += 1) if (pl9.busy[i9] < pl9.busy[k9]) k9 = i9;
  const id9 = pl9.next++; pl9.busy[k9] += 1;
  return new Promise<Levels9 | null>((res) => {
    pl9.wait.set(id9, (v9) => { pl9.busy[k9] -= 1; res(v9); });
    pl9.ws[k9].postMessage({ id: id9, buf, tf, maxLv }, [buf]);
  });
}
/* ★ **푼 단 캐시**(IndexedDB · 2026-11-01, 요청: "그래픽 소스를 유저스토리지에 캐시해서 빠르게" → "둘 다 진행") ──
   KTX2 를 기기 형식으로 푸는 일이 첫 판의 큰 몫이다(PC 실측 7.1초 중 풀기 5.0초 · 폰은 워커 1). 푼 단들을 켜 파일 이름(내용 해시가 든다) · 기기 형식(tf) · 단 수로 열쇠 삼아
   담아 두고 다음에 오면 받기·풀기를 건너뛴다. 다시 구운 파일은 이름이 바뀌어 저절로 새로 받고, 지금 판에 없는 열쇠(옛 해시 · 다른 형식)는 다 실은 뒤 걷는다(cachePrune9).
   쓰기는 저장소 몫(navigator.storage.estimate)의 40% · 부른 쪽 상한(opt.cacheMB · RMP 폰 400MB · PC 1500MB) 안에서만 — 넘거나 쓰기가 한 번 실패하면 그 판은 더 안 쓴다. */
const IDB9 = "scplay-spr"; const IDB_ST9 = "lv";
let dbP9: Promise<IDBDatabase | null> | null = null;
function db9(): Promise<IDBDatabase | null> {
  if (dbP9) return dbP9;
  if (typeof indexedDB === "undefined") return (dbP9 = Promise.resolve(null));
  dbP9 = new Promise<IDBDatabase | null>((res) => {
    let rq: IDBOpenDBRequest;
    try { rq = indexedDB.open(IDB9, 1); } catch { res(null); return; }
    const to9 = setTimeout(() => res(null), 3000);   // 열기가 막히면(다른 탭의 옛 판 · 사생활 창) 캐시 없이 간다
    rq.onupgradeneeded = () => { try { rq.result.createObjectStore(IDB_ST9); } catch { /* 이미 있다 */ } };
    rq.onsuccess = () => {
      clearTimeout(to9); res(rq.result);
      /* ★ 저장소를 '지우지 마' 로(2026-11-03, 요청: "배포 때 같이 넣어줘") — 저장공간이 빠듯할 때 브라우저·WebView 가 이 캐시를 먼저 비우지 않게 한 번 청한다(거절돼도 그대로 간다). */
      try { void navigator.storage?.persist?.().catch(() => false); } catch { /* 모른다 */ }
    };
    rq.onerror = () => { clearTimeout(to9); res(null); };
    rq.onblocked = () => { clearTimeout(to9); res(null); };
  });
  return dbP9;
}
function cacheGet9(db: IDBDatabase, key: string): Promise<Levels9 | null> {
  return new Promise<Levels9 | null>((res) => {
    try {
      const rq = db.transaction(IDB_ST9, "readonly").objectStore(IDB_ST9).get(key);
      rq.onsuccess = () => {
        const v9 = rq.result as Levels9 | undefined;
        res(Array.isArray(v9) && v9.length > 0 && v9.every((x) => x && x.data instanceof Uint8Array && x.w > 0 && x.h > 0) ? v9 : null);
      };
      rq.onerror = () => res(null);
    } catch { res(null); }
  });
}
/** 열쇠가 캐시에 있나(값은 안 읽는다 · 뒤에서 담기가 이미 담은 켜를 건너뛴다). */
function cacheHas9(db: IDBDatabase, key: string): Promise<boolean> {
  return new Promise<boolean>((res) => {
    try { const rq = db.transaction(IDB_ST9, "readonly").objectStore(IDB_ST9).count(key); rq.onsuccess = () => res(rq.result > 0); rq.onerror = () => res(false); } catch { res(false); }
  });
}
/** 화면 크기·방향이 마지막으로 바뀐 때(performance.now · 위 ★ 천천히) — 창 resize·orientationchange 가 적는다. */
const resizeAt9 = { t: -1e9 };
if (typeof window !== "undefined") {
  const mark9 = (): void => { resizeAt9.t = performance.now(); };
  window.addEventListener("resize", mark9, { passive: true });
  window.addEventListener("orientationchange", mark9, { passive: true });
}
/** 교체 고리의 상태(위 sprAtlasLoad9 교체 ★) — 벌마다 하나 · 새 싣기가 옛 고리를 멈춘다. n 올린 수 · drop 내린 수. */
interface SwapSt9 { tick: ReturnType<typeof setInterval> | null; busy: boolean; n: number; drop: number }
const swapSt9 = new WeakMap<GlUnits9, SwapSt9>();
/** 교체 진단 — 올린 수 · 내린 수(없으면 null). */
export function sprSwapStat9(g9: GlUnits9): { n: number; drop: number } | null { const s9 = swapSt9.get(g9); return s9 ? { n: s9.n, drop: s9.drop } : null; }
/** 쓰기 몫(MB) — 첫 쓰기 때 한 번 잰다 · 음수면 그 판은 더 안 쓴다. */
let cacheRoom9: Promise<number> | null = null;
function cachePut9(db: IDBDatabase, key: string, lv: Levels9, cap9: number): void {
  const mb9 = lv.reduce((s9, x) => s9 + x.data.byteLength, 0) / 1048576;
  cacheRoom9 ??= (async () => {
    try { const e9 = await navigator.storage?.estimate?.(); if (e9 && e9.quota) return Math.min(cap9, (e9.quota * 0.4 - (e9.usage ?? 0)) / 1048576); } catch { /* 모른다 */ }
    return cap9 / 2;
  })();
  void cacheRoom9.then((room9) => {
    if (room9 < mb9) return;
    cacheRoom9 = Promise.resolve(room9 - mb9);
    try {
      const tx9 = db.transaction(IDB_ST9, "readwrite");
      tx9.objectStore(IDB_ST9).put(lv.map((x) => ({ w: x.w, h: x.h, data: x.data })), key);
      tx9.onerror = () => { cacheRoom9 = Promise.resolve(-1); };
      tx9.onabort = () => { cacheRoom9 = Promise.resolve(-1); };   // 몫 넘침(QuotaExceededError)
    } catch { cacheRoom9 = Promise.resolve(-1); }
  });
}
/** 지금 판(표)의 켜 파일에 없는 열쇠를 걷는다 — 옛 해시 · 다른 기기 형식. 한 탭에서 한 번. */
let pruned9 = false;
function cachePrune9(db: IDBDatabase, idx: Index9, tf: number): void {
  if (pruned9) return; pruned9 = true;
  const live9 = new Set<string>();
  for (const e of Object.values(idx.kinds)) for (const ch of [e.a, e.b, e.c, e.d]) if (ch) for (const fs of [ch.files.f, ch.files.h]) for (const f of Object.values(fs ?? {})) live9.add(f + "|" + tf);
  try {
    const st9 = db.transaction(IDB_ST9, "readwrite").objectStore(IDB_ST9);
    const rq = st9.getAllKeys();
    rq.onsuccess = () => { for (const k of rq.result as string[]) { const p9 = String(k).split("|"); if (!live9.has(p9[0] + "|" + p9[1])) st9.delete(k); } };
  } catch { /* 걷기는 다음 판에 */ }
}
/** 이 GL 벌에 이미 실은 묶음(종류.a/b.f/h) — 예열이 다시 돌아도 두 번 안 싣는다. */
const loaded9 = new WeakMap<GlUnits9, Set<string>>();
/** 이 벌에서 싣기에 실패한 묶음(풀기 실패 · 텍스처 상한 초과 등) — 벌이 판을 넘어 살므로 판마다 다시 받지 않게 적어 둔다(2026-10-26). */
const failed9 = new WeakMap<GlUnits9, Set<string>>();
/** 한 번 싣기의 결과 — cells·mb·chunks 는 이번에 새로 실은 것 · kept 는 앞 판에서 물려받은 묶음 · dropped 는 상한에 걷은 묶음. */
export interface SprAtlasLoad9 { cells: number; mb: number; ms: number; fmt: string; chunks: number; miss: number; kept: number; dropped: number;
  /** 받기를 기다린 ms(풀기가 다음 묶음을 기다리며 선 때) · 풀고 올린 ms · 받은 바이트(MB) — 오래 걸리는 몫이 망인지 풀기인지 가르는 자(2026-10-26). */
  waitMs: number; workMs: number; netMB: number;
  /** 푼 단 캐시(위 ★)에서 꺼낸 켜 수 / 이번에 다룬 켜 수 · 꺼낸 MB. */
  hit: number; layers: number; hitMB: number;
  /** 풀기 워커 수(0 = 메인 스레드) · 앞 종류(core)가 다 실린 ms(재생이 시작할 수 있는 때). */
  workers: number; coreMs: number; err?: string }
/** 경기 종류들의 아틀라스를 싣는다 — kinds 는 많이 쓰는 차례 · mbCap 을 넘으면 거기서 멈춘다(나머지는 재생 중 굽기).
 *  ★ `core` 개 종류(앞에서부터)의 묶음이 다 실리면(또는 실을 것이 없으면) `onCore` 를 한 번 부른다(2026-10-26 · 요청 2 — 많이 쓰는 종류만 먼저 싣고 재생을 시작 · 나머지는 뒤에서).
 *  `pending` 은 아직 안 실린 종류를 담고 실릴 때마다 뺀다(예열이 그 종류의 동적 미리 굽기를 건너뛰는 자) — 다 끝나면 비운다. */
/** opt.want — 받을 요잉 방향 수(8 = a · 16 = a+b · 32 = a+b+c+d · 2026-11-03 요잉 32 ★ spr-atlas parOf). 옛 16칸 표는 a(짝)·b(홀)뿐이라 32 를 줘도 16 까지만 온다. */
export async function sprAtlasLoad9(g9: GlUnits9, kinds: string[], opt: { res: "f" | "h"; want: 8 | 16 | 32; em: boolean; mbCap: number;
  core?: number; onCore?: () => void; pending?: Set<string>; workers?: number;
  /** 뒤에서 받아 풀기를 천천히(2026-11-03 · 아이폰 회전 리로드 — 아래 ★ 천천히) — 시작을 이만큼(ms) 늦추고 · 켜 사이를 쉰다. 없으면 종전대로. */
  slowPrefetchMs?: number;
  /** ★ 뒤에서 받아 풀기를 아예 안 한다(2026-11-08, 지적: "아이폰 14 Pro 사파리에서 재생하고 얼마 안 있다 탭이 터져") — 아이폰은 20초 뒤 시작하던 받아 풀기(묶음 하나를
   *  RGBA 로 풀어 수십~백수십 MB · IndexedDB 에 담을 때 또 한 벌)가 웹킷 탭 한도를 넘겼다. 켜면 ① 를 건너뛰고, 교체 고리(②③)는 이미 캐시에 담긴 묶음만 올린다(slowPrefetchMs 와 같은 문). */
  noPrefetch?: boolean;
  /** ★ 교체로 **내리지 않는다**(2026-11-08, 실기 블랙박스: 아이폰 1단 · 아틀라스 128MB = 상한에 딱 붙은 채 배속 재생 3분 반에 탭 터짐) — 상한에 닿으면 교체 고리가 150ms 마다
   *  안 쓴 묶음을 GPU 에서 내리고 다른 묶음을 올렸고, 그 전에 묶음(수십 MB)을 먼저 풀어 놓고서야 상한을 쟀다. 배속에서 카메라가 빨리 돌면 큰 할당 · 해제가 쉬지 않았다.
   *  켜면 상한 안에 들 때만 올리고(재기 전에 안 푼다) · 안 들면 그 묶음은 대기에서 뺀다 — 그 종류는 가까운 칸 · 채우기(판)로 그린다. */
  noDrop?: boolean;
  /** 푼 단 캐시(위 ★)에 쓸 상한 MB(저장소 몫의 40% 와 작은 쪽). */
  cacheMB?: number;
  /** 앞 종류(core) 묶음의 처리 수 / 전체 — 로딩 진행도(RMP onLoadProgress)의 몫(2026-11-01). */
  onProgress?: (done: number, total: number) => void }): Promise<SprAtlasLoad9> {
  let cored9 = false;
  const core9 = (): void => { if (!cored9) { cored9 = true; opt.onCore?.(); } };
  const t0 = performance.now();
  const r: SprAtlasLoad9 = { cells: 0, mb: 0, ms: 0, fmt: "-", chunks: 0, miss: 0, kept: 0, dropped: 0, waitMs: 0, workMs: 0, netMB: 0, hit: 0, layers: 0, hitMB: 0, workers: 0, coreMs: 0 };
  if (!sprAtlasOn9() || !g9.sprTint || !g9.gl2) { r.err = !g9.sprTint ? "임자색 분리 없음" : "꺼짐"; core9(); opt.pending?.clear(); return r; }
  try {
    const idx = await index9();
    if (!idx) { r.err = "판 없음"; return r; }
    const [M, pl9, db] = await Promise.all([basis9(), pool9(opt.workers), db9()]);
    r.workers = pl9 ? pl9.ws.length : 0;
    const fmt = g9.sprAtlasFmt9(); r.fmt = fmt.name;
    /* 압축 확장이 하나도 없으면(RGBA 로 푼다) 화소당 4 바이트라 — 반 해상도로 내리고 상한을 죈다. */
    if (fmt.gl === 0) { opt = { ...opt, res: "h", mbCap: Math.min(opt.mbCap, 384) }; }
    const done = loaded9.get(g9) ?? new Set<string>(); loaded9.set(g9, done);
    const bad = failed9.get(g9) ?? new Set<string>(); failed9.set(g9, bad);
    /* ★ 벌이 판을 넘어 산다(2026-10-26, 요청: "그래픽소스를 매판 받지 않게 하기" — RMP 의 GL 캔버스 맡김 ★) — 앞 판에 실은 묶음은 그대로 쓰고(done) 새 종류만 받는다.
       상한은 **이미 실은 것 전부**(g9.sprFixedMB)에 견준다 — 넘치면 이번 판에 안 나오는 묶음부터(먼저 실은 차례로) 걷어 자리를 낸다. */
    const want = new Set(kinds);
    const spare = (): string | undefined => [...done].find((tg) => !want.has(tg.slice(0, tg.indexOf("."))));
    const k = opt.res === "h" ? 0.5 : 1;
    /* 받을 묶음 — 옛 16칸 표(yaw 16)는 b 가 홀 칸이라 16방부터 받는다. */
    const pars9: Par9[] = opt.want >= 32 ? ["a", "b", "c", "d"] : opt.want >= 16 ? ["a", "b"] : ["a"];
    /** 칸 열쇠의 요잉 칸을 이 기기의 칸 수로 옮긴다(표 A칸 → 기기 n칸 · 건물은 적어도 8 · 32칸 머리는 늘 32) — 안 맞는 칸(기기가 못 쓰는 각)은 null. */
    const ybMap9 = (key0: string, kind: string): string | null => {
      const A9 = SPR_YAW32_9.has(kind) ? 32 : idx.yaw || 16;
      const n9 = SPR_YAW32_9.has(kind) ? 32 : key0.startsWith("b:") ? Math.max(8, g9.sprYaw) : g9.sprYaw;
      if (A9 === n9) return key0;
      const p = key0.split("|"); const yb = Number(p[p.length - 6]);
      if (A9 > n9) { const st9 = A9 / n9; if (yb % st9) return null; p[p.length - 6] = String(yb / st9); }
      else p[p.length - 6] = String(yb * (n9 / A9));
      return p.join("|");
    };
    const jobs: { kind: string; par: Par9; ch: Chunk9 }[] = [];
    for (const kind of kinds) {
      const e = idx.kinds[kind]; if (!e) { r.miss += 1; continue; }
      for (const par of pars9) { const ch = e[par]; if (!ch) continue; if (done.has(`${kind}.${par}.${opt.res}`)) r.kept += 1; else if (!bad.has(`${kind}.${par}.${opt.res}`)) jobs.push({ kind, par, ch }); }
    }
    /* 종류마다 남은 묶음 수 — 다 처리되면(실림·실패·건너뜀) pending 에서 뺀다 · 앞 종류(core)의 묶음이 다 처리되면 onCore. */
    const left9 = new Map<string, number>();
    for (const j of jobs) left9.set(j.kind, (left9.get(j.kind) ?? 0) + 1);
    if (opt.pending) { opt.pending.clear(); for (const kd of left9.keys()) opt.pending.add(kd); }
    const coreSet9 = new Set(kinds.slice(0, Math.max(0, opt.core ?? kinds.length)));
    /* ★ 묶음 차례: 앞 종류 짝 → 앞 종류 홀 → 나머지 짝 → 나머지 홀(2026-11-03 · 앱 폰 16방향 — RMP APP16_9 ★). 상한에 닿아 멈추면 덜 쓰는 종류의 **홀 칸만** 빠지고
       (재생 중에 굽는다) 종류가 통째로 빠지지 않는다. 짝만 싣는 기기(폰 웹)는 그대로. */
    /* (2026-11-03 요잉 32) 홀 칸 묶음(c·d)은 맨 뒤 — 앞 종류 c·d → 나머지 c·d. 빠지면 가까운 칸으로 그리고 뒤에서 굽는다(gl9 sprFill ★). */
    if (jobs.some((j) => j.par !== "a")) {
      const rank9 = (j: (typeof jobs)[number]): number => (j.par === "c" || j.par === "d" ? 4 : 0) + (coreSet9.has(j.kind) ? 0 : 2) + (j.par === "b" || j.par === "d" ? 1 : 0);
      jobs.sort((x, y) => rank9(x) - rank9(y));   // 안정 정렬 — 같은 칸 안은 많이 쓰는 차례 그대로
    }
    let coreLeft9 = jobs.filter((j) => coreSet9.has(j.kind)).length;
    const coreTot9 = coreLeft9;
    opt.onProgress?.(0, coreTot9);
    const coreDone9 = (): void => { if (!cored9) { r.coreMs = Math.round(performance.now() - t0); core9(); } };
    if (coreLeft9 === 0) coreDone9();
    const settle9 = (j: (typeof jobs)[number]): void => {
      const n = (left9.get(j.kind) ?? 1) - 1; left9.set(j.kind, n);
      if (n <= 0) opt.pending?.delete(j.kind);
      if (coreSet9.has(j.kind)) { coreLeft9 -= 1; opt.onProgress?.(coreTot9 - Math.max(0, coreLeft9), coreTot9); if (coreLeft9 <= 0) coreDone9(); }
    };
    /* 받기 + 풀기는 겹쳐서(워커가 있으면 워커 수 × 2 · 없으면 여섯) · 싣기는 차례대로(GL) — 바이트 상한에 닿으면 그만. */
    const url = (j: (typeof jobs)[number], ly: string): string => `${BASE}/k/${j.ch.files[opt.res][ly]}`;
    type Prep9 = { ok: boolean; c: Levels9 | null; t: Levels9 | null; e: Levels9 | null };
    const lv9 = (b: ArrayBuffer | null | undefined): Promise<Levels9 | null> => (!b ? Promise.resolve(null)
      : pl9 ? poolRun9(pl9, b, fmt.tf, 6) : Promise.resolve(transcode9(M, b, fmt.tf, 6)));
    const cap9 = opt.cacheMB ?? 400;
    /** 켜 하나 — 캐시(위 푼 단 캐시 ★)에 있으면 그것 · 없으면 받아 풀고 담는다. got 거짓 = 받기 실패(망 · 다음 판에 다시) · lv null = 풀기 실패. */
    const layer9 = (j: (typeof jobs)[number], ly: string): Promise<{ got: boolean; lv: Levels9 | null }> => {
      const ck9 = j.ch.files[opt.res][ly] + "|" + fmt.tf + "|6";
      r.layers += 1;
      return (db ? cacheGet9(db, ck9) : Promise.resolve(null)).then((hit9) => {
        if (hit9) { r.hit += 1; r.hitMB += hit9.reduce((s9, x) => s9 + x.data.byteLength, 0) / 1048576; return { got: true, lv: hit9 }; }
        return fetch(url(j, ly)).then((x) => (x.ok ? x.arrayBuffer() : null)).catch(() => null).then((b) => {
          if (!b) return { got: false, lv: null };
          r.netMB += b.byteLength / 1048576;
          return lv9(b).then((lv) => { if (lv && db) cachePut9(db, ck9, lv, cap9); return { got: true, lv }; });
        });
      });
    };
    const prep9 = (j: (typeof jobs)[number]): Promise<Prep9> => {
      const lys = j.ch.layers.filter((ly) => (ly !== "e" || opt.em) && !!j.ch.files[opt.res][ly]);
      return Promise.all(lys.map((ly) => layer9(j, ly))).then((xs) => {
        const by = Object.fromEntries(lys.map((ly, i) => [ly, xs[i]])) as Record<string, { got: boolean; lv: Levels9 | null } | undefined>;
        if (!by.c?.got) return { ok: false, c: null, t: null, e: null };   // 받기 실패(망) — 다음 판에 다시 받는다
        return { ok: true, c: by.c.lv, t: by.t?.lv ?? null, e: by.e?.lv ?? null };
      });
    };
    /** 묶음 하나를 GPU 에 올린다(칸 열쇠를 기기 칸으로 옮겨) — 실은 칸 수 · 텍스처 실패면 −1. 본 싣기와 교체 고리(아래 ★)가 함께 쓴다. */
    const put9 = (j: (typeof jobs)[number], c: Levels9, t: Levels9 | null, e: Levels9 | null, mb: number): number => {
      const tc = g9.sprAtlasTexture9(c, fmt.gl); if (!tc) return -1;
      const tt = t ? g9.sprAtlasTexture9(t, fmt.gl) : null; const te = e ? g9.sprAtlasTexture9(e, fmt.gl) : null;
      const cells = [];
      for (const [key0, px, py, w, h, x0, y0, kd] of j.ch.cells) {
        const key = ybMap9(key0, j.kind); if (key === null) continue;
        cells.push({ key, px: px * k, py: py * k, w: w * k, h: h * k, x0: x0 * k, y0: y0 * k, kd: kd * k });
      }
      return g9.sprAtlasAdd9(tc, tt, te, j.ch.w * k, j.ch.h * k, mb, cells, `${j.kind}.${j.par}.${opt.res}`);
    };
    /* 대기 묶음 표(아래 교체 ★) — 본 싣기 **전에** 세운다: 싣는 동안 붓이 그 종류를 메시로 굽지 않고 가까운 칸으로 기다리게(올리면 뺀다). */
    const old9 = swapSt9.get(g9); if (old9?.tick) clearInterval(old9.tick);
    const want9 = new Set(kinds);
    const all9 = new Map<string, (typeof jobs)[number]>();
    const by9 = new Map<string, (typeof jobs)[number]>();
    for (const kind of kinds) {
      const e9 = idx.kinds[kind]; if (!e9) continue;
      for (const par of ["a", "b", "c", "d"] as Par9[]) {
        const ch = e9[par]; if (!ch) continue;
        const jb9 = { kind, par, ch }; all9.set(`${kind}.${par}`, jb9);
        const tg9 = `${kind}.${par}.${opt.res}`;
        if (opt.noPrefetch && !pars9.includes(par)) continue;   // 받아 풀기를 안 하는 기기(아이폰)는 기기 몫(want) 밖 방향을 교체로도 안 올린다(옛 세션 캐시에 담긴 c·d 가 GPU 를 오가며 메모리를 흔들었다)
        if (!done.has(tg9) && !bad.has(tg9)) by9.set(`${kind}.${par}`, jb9);   // 본 싣기가 올리면 뺀다(put9 뒤)
      }
    }
    const A9 = idx.yaw || 16;
    g9.sprSwapReq.clear();
    g9.sprSwapOf = (kind: string, yb: number, n: number): string | null => {
      if (by9.size === 0) return null;
      const a9 = SPR_YAW32_9.has(kind) ? 32 : A9;
      const yA9 = (yb * a9) / n; if (yA9 !== Math.floor(yA9)) return null;
      const par9: Par9 = SPR_YAW32_9.has(kind) ? "a" : a9 >= 32 ? (["a", "c", "b", "d"] as Par9[])[yA9 % 4] : yA9 % 2 ? "b" : "a";
      const kp9 = `${kind}.${par9}`;
      return by9.has(kp9) ? kp9 : null;
    };
    const win9 = pl9 ? pl9.ws.length * 2 : 6;
    const pend: Promise<Prep9>[] = [];
    for (let i = 0; i < Math.min(win9, jobs.length); i += 1) pend.push(prep9(jobs[i]));
    for (let i = 0; i < jobs.length; i += 1) {
      const j = jobs[i];
      const tw = performance.now();
      const pr = await pend[i];
      if (i + win9 < jobs.length) pend.push(prep9(jobs[i + win9]));
      const tk = performance.now(); r.waitMs += tk - tw;
      const jt = `${j.kind}.${j.par}.${opt.res}`;
      if (!pr.ok) { settle9(j); continue; }
      const c = pr.c; if (!c) { bad.add(jt); settle9(j); continue; }
      const t = pr.t; const e = pr.e;
      const mbOf = (ls: { data: Uint8Array }[] | null): number => (ls ? ls.reduce((s, x) => s + x.data.length, 0) / 1048576 : 0);
      const mb = mbOf(c) + mbOf(t) + mbOf(e);
      let tg: string | undefined;
      while (g9.sprFixedMB + mb > opt.mbCap && (tg = spare()) !== undefined) { g9.sprAtlasDrop9(tg); done.delete(tg); r.dropped += 1; }
      if (g9.sprFixedMB + mb > opt.mbCap) break;
      const nc9 = put9(j, c, t, e, mb); if (nc9 < 0) { bad.add(jt); settle9(j); continue; }
      r.cells += nc9; by9.delete(`${j.kind}.${j.par}`);
      r.mb += mb; r.chunks += 1;
      done.add(jt);
      settle9(j);
      r.workMs += performance.now() - tk;
      /* 한 묶음마다 한 박자 쉰다 — 로딩 글자 애니메이션·재생(뒤에서 싣는 동안)이 서지 않게. */
      await new Promise((res) => setTimeout(res, 0));
    }
    /* ★ **교체**(2026-11-03, 요청: "다운은 다 받고 메모리에 올리는 걸 교체한다는 거야") ──
       이 경기 종류의 묶음 가운데 GPU 에 못 올린 것(기기 몫 밖의 b·c·d · 상한에 닿아 빠진 것)은 **대기 묶음**이다: ① 뒤에서 차례로 받아 풀어 IndexedDB 에 담아 두고(받기·풀기는
       한 번 · 캐시가 없으면 HTTP 캐시만 데운다) ② 붓이 그 칸을 찾으면(gl9 sprSwapOf → sprSwapReq) 가까운 칸으로 그리는 동안 ③ 고리가 한 묶음씩 캐시에서 꺼내 올린다 —
       자리가 모자라면 **안 쓴 지 90장 넘은** 묶음(이 경기 종류의 a 는 빼고)을 내리고 대기로 돌린다. 메시로 굽지 않는다. */
    {
      const lys9 = (j: (typeof jobs)[number]): string[] => j.ch.layers.filter((ly) => (ly !== "e" || opt.em) && !!j.ch.files[opt.res][ly]);
      const st9: SwapSt9 = { tick: null, busy: false, n: 0, drop: 0 };
      swapSt9.set(g9, st9);
      /* ① 뒤에서 받아 풀어 담기 — 하나씩(재생과 다투지 않게 · 폰 워커 1).
         ★ 천천히(2026-11-03, 지적: "아이폰 PWA 회전하면 리로드 · 어쩔 땐 되고 어쩔 땐 안 되고 · 32방 끄니 괜찮고 다시 켜도 그 뒤론 잘 됨") — 처음 보는 묶음을 받아 풀고 담는 동안
         회전하면 캔버스를 새로 잡는 몫과 겹쳐 웹킷이 탭을 죽였다(캐시가 다 차면 안 난다). slowPrefetchMs 가 있으면 그만큼 늦게 시작하고 · 화면 크기가 바뀐 뒤 4초는 쉬고 ·
         켜 사이를 400ms 쉰다. 교체 고리(②③)도 크기가 바뀐 뒤 2초는 안 올린다(모든 기기). */
      if (by9.size > 0 && !opt.noPrefetch) {
        void (async () => {
          const slow9 = opt.slowPrefetchMs ?? 0;
          if (slow9 > 0) await new Promise((res) => setTimeout(res, slow9));
          for (const j of [...by9.values()]) {
            if (swapSt9.get(g9) !== st9) return;
            for (const ly of lys9(j)) {
              if (slow9 > 0) {
                while (performance.now() - resizeAt9.t < 4000) await new Promise((res) => setTimeout(res, 500));
                await new Promise((res) => setTimeout(res, 400));
                if (swapSt9.get(g9) !== st9) return;
              }
              if (db) { const ck9 = j.ch.files[opt.res][ly] + "|" + fmt.tf + "|6"; if (await cacheHas9(db, ck9)) continue; await layer9(j, ly); }
              else await fetch(url(j, ly)).then((x) => x.arrayBuffer()).catch(() => null);
            }
            await new Promise((res) => setTimeout(res, 50));
          }
        })();
      }
      /* ②③ 교체 고리 — 150ms 마다 요청 하나. */
      st9.tick = setInterval(() => {
        if (st9.busy || g9.sprSwapReq.size === 0) return;
        if (performance.now() - resizeAt9.t < 2000) return;   // 화면 크기가 막 바뀌었다(위 ★ 천천히) — 캔버스를 새로 잡는 동안 텍스처를 안 올린다
        const kp9 = g9.sprSwapReq.values().next().value as string; g9.sprSwapReq.clear();
        const j = by9.get(kp9); if (!j) return;
        /* 내리지 않는 기기(위 noDrop ★)는 상한에 거의 닿았으면 풀지도 않고 대기에서 뺀다. */
        if (opt.noDrop && g9.sprFixedMB >= opt.mbCap * 0.97) { by9.delete(kp9); return; }
        st9.busy = true;
        /* 천천히(위 ★) 기기는 **캐시에 담긴 묶음만** 올린다 — 그 자리에서 받아 풀지 않는다(가까운 칸으로 그리는 동안 뒤에서 담기가 채운다). */
        const ready9 = (opt.slowPrefetchMs || opt.noPrefetch) && db
          ? Promise.all(lys9(j).map((ly) => cacheHas9(db, j.ch.files[opt.res][ly] + "|" + fmt.tf + "|6"))).then((hs) => hs.every(Boolean))
          : Promise.resolve(true);
        void ready9.then((ok9) => { if (!ok9) throw new Error("skip"); return Promise.all(lys9(j).map((ly) => layer9(j, ly))); }).then((xs) => {
          const lv: Record<string, Levels9 | null> = {}; lys9(j).forEach((ly, i) => { lv[ly] = xs[i].lv; });
          const c = lv.c; if (!c) return;
          const t = lv.t ?? null; const e = lv.e ?? null;
          const mbOf = (ls: Levels9 | null): number => (ls ? ls.reduce((s9, x) => s9 + x.data.length, 0) / 1048576 : 0);
          const mb = mbOf(c) + mbOf(t) + mbOf(e);
          const now9 = g9.sprFrameNo9();
          const cand9 = g9.sprFixedUse9().filter((u) => {
            const p9 = u.tag.split("."); const kd9 = p9.slice(0, -2).join("."); const pr9 = p9[p9.length - 2];
            return now9 - u.last > 90 && (pr9 !== "a" || !want9.has(kd9));
          }).sort((x, y) => x.last - y.last);
          while (!opt.noDrop && g9.sprFixedMB + mb > opt.mbCap && cand9.length) {
            const u = cand9.shift()!; g9.sprAtlasDrop9(u.tag); done.delete(u.tag); st9.drop += 1;
            const p9 = u.tag.split("."); const kpD9 = p9.slice(0, -1).join("."); const jb9 = all9.get(kpD9); if (jb9) by9.set(kpD9, jb9);
          }
          if (g9.sprFixedMB + mb > opt.mbCap) { if (opt.noDrop) by9.delete(kp9); return; }
          if (put9(j, c, t, e, mb) < 0) { by9.delete(kp9); return; }
          by9.delete(kp9); done.add(`${j.kind}.${j.par}.${opt.res}`); st9.n += 1;
        }).catch(() => { /* 아직 안 담김(위 천천히) — 다음 요청 때 */ }).finally(() => { st9.busy = false; });
      }, 150);
    }
    /* 상한에 닿아 멈췄으면 남은 묶음의 풀기 결과는 버린다(워커 일은 이미 돌았다 — 기다리지만 않는다). */
    if (db) setTimeout(() => cachePrune9(db, idx, fmt.tf), 4000);   // 옛 판 열쇠 걷기(위 푼 단 캐시 ★) — 다 실은 뒤 한숨 돌리고
  } catch (e) { r.err = String((e as Error)?.message ?? e); }
  if (!cored9) r.coreMs = Math.round(performance.now() - t0);
  core9(); opt.pending?.clear();
  r.ms = Math.round(performance.now() - t0);
  return r;
}
