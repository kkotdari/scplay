/* ★ 분석기 명령줄(2026-10-26) — 서버(sg-api app/infra/analyzer.py)가 `node analyzer.mjs` 로 부른다.
   표준입력 JSON 하나 → 표준출력 JSON 하나. 일 여럿을 한 번에 받는다(노드 띄우기는 한 번 · 곡선 · 색인 · 썸네일을 한 판에).
     입력  {"jobs": [{"cmd": "parse", "path": "...", "name": "x.rep"}, {"cmd": "curves", "motion": "..."}, ...]}
     출력  {"results": [{"ok": true, "value": ...} | {"ok": false, "error": "...", "parse": true?}, ...]}
   일마다 따로 잡는다 — 하나가 깨져도 나머지는 돌려준다. parse 의 error 는 사람이 읽는 까닭(등록 화면에 그대로 뜬다 · parse: true).
   thumb 는 PNG 를 base64 로(value.png). 캔버스는 @napi-rs/canvas(번들 밖 · 서버의 analyzer/node_modules). */
import { readFileSync } from "node:fs";
import { curvesFromTracks, drawMapThumb, gameIndexOf9, parseReplayBuffer, ReplayParseError, type GameIndexOpts9, type MapThumbGrid } from "./index";

/** 캔버스는 썸네일 일에서만 부른다 — 읽기 · 곡선 · 색인은 @napi-rs/canvas 없이도 돈다. 지형 붓(utils/contour loopsPath)이 전역 Path2D 를 쓴다. */
async function canvasLib(): Promise<typeof import("@napi-rs/canvas")> {
  const lib = await import("@napi-rs/canvas");
  (globalThis as { Path2D?: unknown }).Path2D ??= lib.Path2D;
  return lib;
}

type Job =
  | { cmd: "parse"; path: string; name: string }
  | { cmd: "curves"; motion: string }
  | ({ cmd: "index"; motion: string } & GameIndexOpts9)
  | { cmd: "thumb"; grid: MapThumbGrid };

async function run(job: Job): Promise<unknown> {
  switch (job.cmd) {
    case "parse":
      return parseReplayBuffer(new Uint8Array(readFileSync(job.path)), job.name);
    case "curves":
      return curvesFromTracks(job.motion);
    case "index": {
      const { cmd: _c, motion, ...opts } = job;
      void _c;
      return gameIndexOf9(motion, opts);
    }
    case "thumb": {
      const { grid } = job;
      const cv = (await canvasLib()).createCanvas(grid.width, grid.height);
      await drawMapThumb(cv.getContext("2d") as unknown as CanvasRenderingContext2D, grid);
      return { width: grid.width, height: grid.height, png: (await cv.encode("png")).toString("base64") };
    }
    default:
      throw new Error(`모르는 일: ${(job as { cmd?: string }).cmd}`);
  }
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const { jobs } = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { jobs: Job[] };
  const results: unknown[] = [];
  for (const job of jobs) {
    try {
      results.push({ ok: true, value: await run(job) });
    } catch (e) {
      const parse = e instanceof ReplayParseError;
      results.push({ ok: false, error: e instanceof Error ? e.message : String(e), ...(parse ? { parse: true } : {}) });
    }
  }
  process.stdout.write(JSON.stringify({ results }));
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
