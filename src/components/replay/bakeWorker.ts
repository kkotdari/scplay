/* 굽기 일꾼(요청: "윈도우 크롬에서 CPU·GPU를 최대한" → 계획 3번 — 굽기를 메인에서 뗀다) ─────────────────────
 *  메인의 붓이 새 열쇠를 만나면 그 프레임에서 직접 구웠다(한 장 3ms, 시점이 갈리면 수백 장 → 최장프레임 756ms).
 *  이제 그 굽기를 이 일꾼이 OffscreenCanvas로 구워 ImageBitmap으로 **transfer**해 돌려준다(복사 없음). 메인은 그
 *  사이 대타(다른 크기·이웃 요잉 판)를 찍고, 판이 오면 갈아 끼운다.
 *
 *  통신 규약(메인 → 일꾼)
 *    env  { oneMax, poolBytes, sideMax }                 굽기 한도(기기 표 DEV9에서) — 처음 한 번.
 *    bake { id, bld, op, q, B, lod, pitchFlat }           한 장 청함. q = 유닛 pxq / 건물 sideQ.
 *  (일꾼 → 메인)
 *    ready { ok, why }                                    OffscreenCanvas 2D를 열 수 있나 — 못 열면 메인이 인라인으로 돈다.
 *    done  { id, out: {cv, ox, oy, pad, l, box, tint} | null, ms }   판(ImageBitmap, transfer) · 굽는 데 든 ms.
 *    err   { id, message }                                굽다 던졌다 — 메인은 그 열쇠를 다음 프레임에 다시 청한다.
 *
 *  ⚠ 이 파일은 bake9(모델 빌더·래스터)만 든다 — React·DOM 없음. 진단 해시(#pitch·#nocreep)는 메인이 워커 name에
 *    실어 보낸다(bake9의 hashNow9). 폰은 지금 이 일꾼을 안 띄운다(DEV9.bakeWorkers 0) — 띄우는 조건만 바꾸면 폰에도
 *    같은 길이 열린다(설계는 기기를 안 가린다). */
import { BAKE_ENV9, BAKE_NIL9, pitchFlatSet9, rasterBld9, rasterUnit9, type RasterOut9 } from "./bake9";
import type { UnitDrawOp } from "./engine9";

type EnvMsg = { type: "env"; oneMax: number; poolBytes: number; sideMax: number };
type BakeMsg = { type: "bake"; id: number; bld: boolean; op: UnitDrawOp; q: number; B: number; lod: number; pitchFlat: number };
type Msg = EnvMsg | BakeMsg;

/** 돌려주는 판 — 캔버스 자리에 ImageBitmap. */
export type BakeOut9 = {
  cv: ImageBitmap; ox: number; oy: number; pad: number; l: number;
  box: RasterOut9["box"];
  tint: { cv: ImageBitmap; ox: number; oy: number; gloss: boolean } | null;
};

const inWorker9 = typeof document === "undefined" && typeof self !== "undefined";
const post9 = (m: unknown, transfer?: Transferable[]): void => {
  const w = self as unknown as Worker;
  if (transfer && transfer.length > 0) w.postMessage(m, transfer); else w.postMessage(m);
};
let pitchFlatLast9 = -1;

if (inWorker9) {
  BAKE_ENV9.mk = () => new OffscreenCanvas(0, 0);
  self.onmessage = (ev: MessageEvent<Msg>): void => {
    const m = ev.data;
    if (m.type === "env") {
      BAKE_ENV9.oneMax = m.oneMax; BAKE_ENV9.poolBytes = m.poolBytes; BAKE_ENV9.sideMax = m.sideMax;
      return;
    }
    if (m.type !== "bake") return;
    const t0 = performance.now();
    try {
      if (m.pitchFlat !== pitchFlatLast9) { pitchFlatLast9 = m.pitchFlat; pitchFlatSet9(m.pitchFlat); }
      const r = m.bld ? rasterBld9(m.op, m.q, m.B, m.lod) : rasterUnit9(m.op, m.q, m.B, m.lod);
      if (!r) { post9({ type: "done", id: m.id, out: null, ms: performance.now() - t0, why: BAKE_NIL9.why }); BAKE_NIL9.why = ""; return; }
      /* transferToImageBitmap은 그 캔버스를 비운다 — 잘라 담은 판(BAKE_ENV9.out)은 여기서 새로 만든 것이라 그대로 버린다. */
      const cv = (r.cv as OffscreenCanvas).transferToImageBitmap();
      const tcv = r.tint ? (r.tint.cv as OffscreenCanvas).transferToImageBitmap() : null;
      const out: BakeOut9 = {
        cv, ox: r.ox, oy: r.oy, pad: r.pad, l: r.l, box: r.box,
        tint: r.tint && tcv ? { cv: tcv, ox: r.tint.ox, oy: r.tint.oy, gloss: r.tint.gloss } : null,
      };
      post9({ type: "done", id: m.id, out, ms: performance.now() - t0 }, tcv ? [cv, tcv] : [cv]);
    } catch (e) {
      post9({ type: "err", id: m.id, message: String(e).slice(0, 160) });
    }
  };
  /* 2D 문맥을 열어 본다 — 못 여는 브라우저(옛 사파리)면 메인이 인라인 굽기로 남는다. */
  let ok9 = false; let why9 = "";
  try { ok9 = !!new OffscreenCanvas(2, 2).getContext("2d"); if (!ok9) why9 = "OffscreenCanvas 2D 없음"; }
  catch (e) { why9 = String(e).slice(0, 80); }
  post9({ type: "ready", ok: ok9, why: why9 });
}
