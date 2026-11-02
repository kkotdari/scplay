/* 종족별 **게임 장면 같은 진열 사진**(2026-10-30, 요청: "버전 업 안내 페이지 — 재생기 그래픽 업그레이드 이전(안 그림자·광택 없을 때)과 이후 비교샷 ·
 * 자연스럽게 게임 장면 같은 화면 · 커맨드 배럭 팩토리 마린 메딕 탱크 배틀크루저 / 해처리 히드라 울트라 뮤탈 오버로드 마엘스트롬 당한 모습 /
 * 넥서스 게이트 캐리어 건물 폭발 장면 · 종족별 전후를 좌우로 붙인 그림").
 *
 *   node scripts/showcase-shot.mjs --out <dir> [--root <다른 scplay 트리>] [--race 테란|프로토스|저그] [--zoom 3.2] [--dpr 2] [--t 46]
 *
 * scene-sheet 와 같은 길(합성 참값 OBWT → 진짜 재생기 → 지도 상자 찍기)이되 짜임은 손으로 놓은 **진열**이다(기지·병력·공중·마법·폭발).
 * 재생을 멈추고 탐색바로 `--t` 초에 정확히 세운 뒤 찍는다 — 옛 트리(`--root`)와 새 트리가 **같은 순간**을 찍어야 전후가 맞는다.
 * `--root` 를 주면 그 트리의 src·dist/styles.css 로 굽는다(옛 커밋 git worktree · node_modules 는 이 트리 것을 이어 쓴다). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const ROOT = resolve(String(flag("--root", HERE)));
const OUT = String(flag("--out", join(tmpdir(), "showcase")));
const RACES = flag("--race", null) ? [String(flag("--race"))] : ["플토본진"];
const ZOOM = Number(flag("--zoom", 5.5));
const DPR = Number(flag("--dpr", 1.6));
const VIEW = Number(flag("--view", 1900));
const T_SHOT = Number(flag("--t", 46));
const FPS = 23.81;
const F = (sec) => Math.round(sec * FPS);
const GAME_SEC = 120;
const RACE_EN = { 테란: "terran", 프로토스: "protoss", 저그: "zerg", 합동: "siege", 플토본진: "tossmain", 테란8: "t8", 토스8: "p8", 저그8: "z8" };

/* ── 이름 → 번호(bwUnitNames 는 그 트리의 것) ── */
const ebin = join(HERE, "node_modules", "esbuild", "bin", "esbuild");
const tdir = mkdtempSync(join(tmpdir(), "showcase-tables-"));
const tsrc = join(ROOT, "scripts", `.showcase-tables.${process.pid}.tmp.ts`);   // 실행마다 다른 이름(동시에 여럿 돌려도 안 겹친다 · 2026-11-02)
writeFileSync(tsrc, `export { BW_UNIT_NAME } from ${JSON.stringify(join(ROOT, "src/utils/bwUnitNames"))};\n`);
execFileSync(process.execPath, [ebin, tsrc, "--bundle", "--format=esm", "--platform=node", "--log-level=error", `--outfile=${join(tdir, "t.mjs")}`], { stdio: ["ignore", "ignore", "inherit"] });
rmSync(tsrc, { force: true });
const { BW_UNIT_NAME } = await import(pathToFileURL(join(tdir, "t.mjs")).href);
const ID = {};
for (const [id, nm] of Object.entries(BW_UNIT_NAME)) if (ID[nm] === undefined) ID[nm] = Number(id);

class W {
  constructor() { this.b = Buffer.alloc(1 << 20); this.p = 0; }
  need(n) { if (this.p + n > this.b.length) { const nb = Buffer.alloc(this.b.length * 2 + n); this.b.copy(nb); this.b = nb; } }
  u8(v) { this.need(1); this.b[this.p++] = v & 0xff; }
  u16(v) { this.need(2); this.b.writeUInt16LE(v & 0xffff, this.p); this.p += 2; }
  u32(v) { this.need(4); this.b.writeUInt32LE(v >>> 0, this.p); this.p += 4; }
  i32(v) { this.need(4); this.b.writeInt32LE(v | 0, this.p); this.p += 4; }
  f32(v) { this.need(4); this.b.writeFloatLE(v, this.p); this.p += 4; }
  str(s) { const u = Buffer.from(s, "utf8"); this.u8(u.length); this.need(u.length); u.copy(this.b, this.p); this.p += u.length; }
  vz(v) { let z = ((v << 1) ^ (v >> 31)) >>> 0; this.need(5); for (;;) { const c = z & 0x7f; z >>>= 7; if (z) this.b[this.p++] = c | 0x80; else { this.b[this.p++] = c; break; } } }
  out() { return this.b.subarray(0, this.p); }
}

/* ── 진열(가운데에서 잰 타일 · 배율 6 이면 ±11타일이 보인다) ──
   한 줄 = [이름, dx, dy, { hb 방향 바이트(0 북·64 동·128 남·192 서) · own 임자(1 = 적) · die 죽는 초(찍는 때 기준) · st 상태(4 싸움 · 5 채집) · fight 표적 잡기 }].
   ★ 자연스럽게(되요청: "모델이 너무 적어 · 배틀 캐리어는 주로 많이 뭉쳐 다니잖아 · 다른 유닛도 너무 적고 부자연스럽게 · 건물도 너무 적고") —
   기지는 건물로 채우고(애드온·방어 건물·자원 줄과 캐는 일꾼) 병력은 **뭉치**(씨앗 흩음 · 방향도 조금씩 다르게)로 오른쪽 적과 싸운다
   (상태 4 + 표적 = 가장 가까운 적 — 총구·트레이서·피격이 선다). 적은 오른 끝에 조금만 걸친다. */
let SEED = 7;
const rnd = () => { SEED = (SEED * 1664525 + 1013904223) >>> 0; return SEED / 4294967296; };
/** 뭉치 — n 개를 (x, y) 둘레 반지름 r 안에 흩는다(서로 d 보다 가깝지 않게 · 방향 hb ± 18). */
const clump = (name, n, x, y, r, d, o = {}) => {
  const out = [];
  for (let k = 0, tries = 0; out.length < n && tries < 4000; tries += 1) {
    const a = rnd() * Math.PI * 2; const q = Math.sqrt(rnd()) * r;
    const px = x + Math.cos(a) * q; const py = y + Math.sin(a) * q * 0.85;
    if (out.some(([, ox, oy]) => Math.hypot(ox - px, oy - py) < d)) continue;
    out.push([name, px, py, { ...o, hb: ((o.hb ?? 72) + Math.round((rnd() - 0.5) * 36)) & 0xff }]); k += 1;
  }
  return out;
};
const F4 = { st: 4, fight: true };
const FOE = (o = {}) => ({ own: 1, hb: 200, st: 4, fight: true, ...o });
const SCENES = {
  테란: {
    pl: [1, 2],
    put: [
      ["Command Center", -9.5, -7.5], ["Comsat Station", -6.5, -7], ["Supply Depot", -12, -11.5], ["Supply Depot", -10, -11.5], ["Supply Depot", -8, -11.5],
      ["Barracks", -2.5, -9.5], ["Barracks", -2.5, -6], ["Factory", 3.5, -9.5], ["Machine Shop", 6.5, -9], ["Starport", 3.5, -6], ["Control Tower", 6.5, -5.5],
      ["Bunker", 1, -2.5], ["Missile Turret", -5.5, -3.2], ["Engineering Bay", -10, -3.5],
      ["SCV", -12, -8.6, { st: 5, hb: 192 }], ["SCV", -11.8, -6.8, { st: 5, hb: 200 }], ["SCV", -11.9, -10.2, { st: 5, hb: 180 }], ["SCV", -7.2, -4.3, { hb: 150 }],
      ...clump("Marine", 16, 1.2, 0.8, 2.2, 0.62, F4),
      ...clump("Medic", 4, -1.4, 1.2, 1.2, 0.7, { hb: 72 }),
      ...clump("Firebat", 3, 3.4, 1.6, 0.9, 0.65, F4),
      ...clump("Goliath", 3, -0.6, 3.6, 1, 0.95, F4),
      ["Siege Tank (Siege Mode)", -3.6, -0.6, F4], ["Siege Tank (Siege Mode)", -3.2, 2.6, F4], ["Siege Tank (Tank Mode)", 2.6, 4.2, F4],
      ...clump("Battlecruiser", 5, 3.8, 0.4, 2, 1.55, { ...F4, hb: 64 }),
      ...clump("Zealot", 3, 8.6, 1, 0.9, 0.8, FOE()), ...clump("Dragoon", 2, 9.4, 3.4, 0.9, 1.1, FOE()),
    ],
  },
  저그: {
    pl: [0, 2],
    put: [
      ["Hatchery", -9.5, -7.5], ["Extractor", -6, -12], ["Spawning Pool", -2.5, -10.5], ["Hydralisk Den", -2.5, -7.3], ["Spire", 2.5, -10.5],
      ["Evolution Chamber", 2.8, -7.3], ["Sunken Colony", 0.2, -3.6], ["Sunken Colony", -4.2, -3.4], ["Spore Colony", -11, -3.6],
      ["Larva", -10.6, -5.2, { hb: 128 }], ["Larva", -9.6, -5, { hb: 140 }], ["Larva", -8.6, -5.3, { hb: 120 }],
      ["Drone", -12, -8.6, { st: 5, hb: 192 }], ["Drone", -11.8, -6.8, { st: 5, hb: 200 }], ["Drone", -11.9, -10.2, { st: 5, hb: 180 }],
      ["Overlord", -12, -12, { hb: 110 }], ["Overlord", 6.8, -11, { hb: 90 }], ["Overlord", -6, 3.6, { hb: 70 }],
      // 마엘스트롬에 걸린 히드라 뭉치(가운데) · 그 둘레 히드라·저글링 · 울트라 · 뮤탈 무리.
      ...clump("Hydralisk", 6, 0.6, 0.6, 1.1, 0.62, F4),
      ...clump("Hydralisk", 6, -2.6, 1.8, 1.3, 0.66, F4),
      ...clump("Zergling", 10, 3.4, 3.2, 1.6, 0.5, F4),
      ...clump("Ultralisk", 3, 4.4, -1.4, 1.4, 1.4, F4),
      ...clump("Mutalisk", 10, 3, 2.4, 2.2, 0.9, { ...F4, hb: 64 }),
      ["Dark Archon", 9.4, 0.4, FOE()], ...clump("Zealot", 3, 8.8, 2.8, 0.9, 0.8, FOE()), ["Dragoon", 9.2, -2, FOE()],
    ],
    // 마엘스트롬(기술 31) — 다크아콘(임자 1)이 가운데 히드라 뭉치로 · 7.4초 · 사각 ±1.5타일.
    casts: [[-1.2, 0.6, 0.6, 31, 1]],
  },
  프로토스: {
    pl: [2, 1],
    put: [
      ["Nexus", -9.5, -7.5], ["Assimilator", -6, -12], ["Pylon", -12, -11.5], ["Pylon", -3, -12], ["Pylon", 0.5, -4.2],
      ["Gateway", -2.5, -9.5], ["Gateway", -2.5, -6.2], ["Gateway", 3.5, -9.5, { die: -0.42 }], ["Stargate", 3.5, -6], ["Cybernetics Core", -10, -3.6],
      ["Forge", 7.5, -2.8, { die: -0.14 }], ["Photon Cannon", -5.2, -3.4], ["Photon Cannon", -1.6, -3],
      ["Probe", -12, -8.6, { st: 5, hb: 192 }], ["Probe", -11.8, -6.8, { st: 5, hb: 200 }], ["Probe", -11.9, -10.2, { st: 5, hb: 180 }],
      ...clump("Zealot", 8, 2, 1.2, 1.8, 0.75, F4),
      ...clump("Dragoon", 6, -1.4, 1.8, 1.8, 1.05, F4),
      ["High Templar", -3.8, 0.2, { hb: 72 }], ["High Templar", -4, 1.8, { hb: 72 }], ["Archon", 0.8, 4.2, F4],
      ...clump("Carrier", 6, 3.4, 1.2, 2.4, 1.9, { ...F4, hb: 64 }),
      ...clump("Marine", 6, 9, 0.8, 1.2, 0.6, FOE()), ["Siege Tank (Tank Mode)", 9.4, 3.6, FOE()],
    ],
  },
};
/* ★ 한 컷(2026-10-31, 요청: "한 장면에 저그 기지와 세 들어 사는 플토 기지 · 거기 쳐들어온 테란으로 한 컷으로 재구성") — 왼위 저그 본진 · 왼아래 같은 기지에
   세 든 프로토스(넥서스·게이트·스타게이트·캐논 · 게이트·캐논 폭발) · 가운데 지키는 두 편 병력 · 오른쪽에서 밀고 들어온 테란(마린·메딕 뭉치에 다크아콘의
   마엘스트롬 · 시즈 탱크 · 배틀 뭉치 · 전진 배럭·팩토리 · 떠서 오는 커맨드). 임자 0 저그 · 1 프로토스(같은 편) · 2 테란. */
const ALLY = (o = {}) => ({ own: 1, ...o });
const TER = (o = {}) => ({ own: 2, hb: 200, st: 4, fight: true, ...o });
SCENES.합동 = {
  pl: [0, 2, 1], force: [1, 1, 2],
  zoom: 4.6,
  frame: { x0: -15.5, x1: 12, y0: -14.5, y1: 9.5 },
  res: [[-14.5, -11.5, 0], [-15, -10, 0], [-15.5, -8.5, 0], [-15.5, -7, 0], [-15, -5.5, 0], [-5.5, -13, 1],
    [-15, 0, 0], [-15.5, 1.5, 0], [-15.5, 3, 0], [-15, 4.5, 0]],
  put: [
    // 저그 본진(왼위)
    ["Hatchery", -9.5, -8.5], ["Extractor", -5.5, -13], ["Spawning Pool", -2.5, -11.5], ["Hydralisk Den", -2.5, -8.3], ["Spire", 2, -11.5],
    ["Sunken Colony", 0.8, -6.2], ["Sunken Colony", 3.4, -3.6], ["Spore Colony", -6, -5],
    ["Larva", -10.6, -6.3, { hb: 128 }], ["Larva", -9.6, -6.1, { hb: 140 }], ["Larva", -8.6, -6.4, { hb: 120 }],
    ["Drone", -13, -10, { st: 5, hb: 192 }], ["Drone", -12.8, -8, { st: 5, hb: 200 }], ["Drone", -13, -6.2, { st: 5, hb: 180 }],
    ["Overlord", -12.5, -13.5, { hb: 110 }], ["Overlord", -3, -4, { hb: 70 }],
    // 세 든 프로토스(왼아래)
    ["Nexus", -9.5, 1.5, ALLY()], ["Pylon", -12.5, 5.2, ALLY()], ["Pylon", -6, -1.6, ALLY()], ["Gateway", -4, 2.2, ALLY()],
    ["Gateway", -4, 5.6, ALLY({ die: -0.42 })], ["Stargate", -9.5, 5.8, ALLY()], ["Photon Cannon", -0.8, 0.4, ALLY()], ["Photon Cannon", -1, 3.8, ALLY({ die: -0.14 })],
    ["Probe", -13, 0.6, ALLY({ st: 5, hb: 192 })], ["Probe", -13.1, 2.6, ALLY({ st: 5, hb: 200 })], ["Probe", -12.6, 4, ALLY({ st: 5, hb: 170 })],
    // 지키는 병력(가운데)
    ...clump("Hydralisk", 10, 2.6, -1, 1.6, 0.62, F4),
    ...clump("Zergling", 8, 4.6, 1.6, 1.3, 0.5, F4),
    ...clump("Ultralisk", 2, 5, -3.6, 0.9, 1.4, F4),
    ...clump("Zealot", 5, 3, 3.6, 1.1, 0.75, ALLY(F4)),
    ...clump("Dragoon", 3, 1, 5.6, 1, 1.05, ALLY(F4)),
    ["Dark Archon", 1.4, 1.6, ALLY({ hb: 64 })],
    ...clump("Mutalisk", 8, 4.2, -6.4, 1.6, 0.9, { ...F4, hb: 64 }),
    ...clump("Carrier", 4, 2.6, 7.2, 1.8, 1.9, ALLY({ ...F4, hb: 64 })),
    // 쳐들어온 테란(오른쪽)
    ...clump("Marine", 14, 8.2, 0.6, 1.6, 0.6, TER()),
    ...clump("Medic", 3, 9.9, 2.2, 0.8, 0.7, TER({ st: 0, fight: false })),
    ["Siege Tank (Siege Mode)", 10.4, -2.8, TER()], ["Siege Tank (Siege Mode)", 10.6, 4.4, TER()],
    ...clump("Goliath", 2, 8.6, 5.8, 0.8, 0.95, TER()),
    ...clump("Battlecruiser", 4, 8.8, -5.6, 1.6, 1.55, TER()),
    ["Barracks", 9.5, -10, { own: 2 }], ["Factory", 10, 8.2, { own: 2 }], ["Command Center", 6.2, -9, { own: 2, lift: true, hb: 0 }],
  ],
  // 마엘스트롬(기술 31) — 다크아콘(임자 1)이 마린 뭉치 가운데로 · 7.4초 · 사각 ±1.5타일(생체만).
  casts: [[-1.2, 7.8, 0.6, 31, 1]],
};
/* ★ 프로토스 본진(2026-10-31, 요청: "좀 과한 듯 · 플토 본진으로 · 건물들과 파일런 포톤캐논 배치 · 거기에 저그랑 테란이 쳐들어간 그림") — 왼쪽 2/3 가 프로토스 본진
   (넥서스·미네랄·캐는 프로브 · 파일런 여섯 · 게이트 둘·코어·포지·스타게이트·시타델·아카이브 · 앞줄 캐논 넷 · 게이트 하나·캐논 하나 폭발) · 지키는 병력(질럿·드라군·
   템플러·아콘·캐리어 뭉치 · 다크아콘이 히드라 뭉치에 마엘스트롬) · 오른위 저그(히드라·저글링·울트라·뮤탈·오버로드) · 오른아래 테란(마린·메딕·시즈 탱크·배틀 뭉치).
   임자 0 프로토스 · 1 저그 · 2 테란(1·2 같은 편). */
const ZG = (o = {}) => ({ own: 1, hb: 200, st: 4, fight: true, ...o });
const TR = (o = {}) => ({ own: 2, hb: 200, st: 4, fight: true, ...o });
/* (같은 날 되요청: "건물들을 더 모으고 유닛 수 늘리기") — 건물은 실제 본진처럼 발자국 사이 0.5타일 남짓으로 붙이고(게이트 셋·스타게이트 둘·코어·포지·시타델·아카이브·
   플릿 비컨 · 파일런 다섯 · 앞줄 캐논 다섯) · 병력은 두 배 가까이(질럿 10 · 드라군 6 · 템플러 3 · 아콘 2 · 캐리어 6 / 히드라 16 · 저글링 16 · 울트라 3 · 뮤탈 11 /
   마린 20 · 메딕 5 · 탱크 3 · 골리앗 3 · 배틀 6). */
/* (11-01 되요청: "프로토스 건물 더 넥서스 중심으로 밀집 · 공격 온 테란 저그 유닛을 더 많이 · 럴커 파뱃 메딕, 베슬 레이스 추가 골리앗 빼기") — 건물 줄을
   넥서스 쪽으로 당겨(발자국 사이 0.5~0.9타일 · 아래 두 줄을 2타일씩 올림 · 캐논 줄 1타일 왼쪽) 오른쪽을 비우고 틀을 오른쪽 1타일·아래를 줄였다.
   침공은 저그 히드라 20 · 저글링 20 · 울트라 4 · 럴커 4 · 뮤탈 14 / 테란 마린 24 · 파이어뱃 6 · 메딕 7 · 탱크 4 · 레이스 6 · 베슬 2 · 배틀 6(골리앗 뺌). */
SCENES.플토본진 = {
  pl: [2, 0, 1], force: [1, 2, 2],
  /* (같은 날 셋째 되요청: "스타게이트 캐리어 뮤탈 제거하고 더 클로즈업 · 다크아칸 기술도 · 다크아칸도 · 배틀크루저도 제거") — 배율 5 → 6.2(틀 ≈20타일 · 무대 폭 안) ·
     스타게이트 줄을 걷고 시타델 줄을 그 자리로 올림 · 마엘스트롬·다크아콘·캐리어·뮤탈·배틀 뺌 · 미네랄 줄은 왼 끝에 걸친다. */
  zoom: 6.2,
  frame: { x0: -12, x1: 8.3, y0: -12.6, y1: 3.9 },   // (첫 클로즈업 판: 오른 끝 병력이 잘려 틀을 0.4 오른쪽 · 아래 0.6 · 침공을 0.6 왼쪽으로)
  res: [[-13, -10, 0], [-13.5, -8.5, 0], [-14, -7, 0], [-14, -5.5, 0], [-13.5, -4, 0], [-13, -2.5, 0], [-5.5, -10.5, 1]],
  put: [
    ["Nexus", -8.5, -6], ["Assimilator", -5.5, -10.5],
    ["Probe", -11.4, -8.6, { st: 5, hb: 192 }], ["Probe", -11.2, -6.8, { st: 5, hb: 200 }], ["Probe", -11.4, -5, { st: 5, hb: 180 }], ["Probe", -10.9, -3.4, { st: 5, hb: 170 }],
    ["Pylon", -10, -10.4], ["Gateway", -1.2, -10.5], ["Pylon", 2.4, -10.4],
    ["Gateway", -4.3, -6], ["Gateway", -0.1, -6, { die: -0.42 }],
    ["Cybernetics Core", -9, -3.3], ["Forge", -5.8, -3.3], ["Pylon", -3, -3.2],
    ["Citadel of Adun", -9, -0.4], ["Templar Archives", -5.9, -0.4], ["Fleet Beacon", -2.8, -0.4], ["Pylon", 0.1, -0.5],
    ["Photon Cannon", 2.4, -8.2], ["Photon Cannon", 3, -5.6, { die: -0.14 }], ["Photon Cannon", 1.6, -3.2], ["Photon Cannon", 2, 0], ["Photon Cannon", 1, 2.2],
    // 지키는 병력
    ...clump("Zealot", 8, 3.9, -4, 1, 0.72, F4),
    ...clump("Dragoon", 5, 3.7, 1, 0.9, 1.02, F4),
    ...clump("Archon", 2, 4.6, -1.8, 0.4, 1.1, F4),
    ["High Templar", 3, -1.8, { hb: 64 }], ["High Templar", 2.6, 2.4, { hb: 64 }],
    // 쳐들어온 저그(오른위)
    ...clump("Lurker", 3, 6.4, -10.2, 0.8, 1.05, ZG()),
    ...clump("Hydralisk", 14, 5.9, -7.4, 1.3, 0.6, ZG()),
    ...clump("Zergling", 14, 5.4, -4.4, 1.1, 0.48, ZG()),
    ...clump("Ultralisk", 3, 6.9, -4.6, 0.7, 1.3, ZG()),
    ["Overlord", 7, -11.8, { own: 1, hb: 200 }],
    // 쳐들어온 테란(오른아래)
    ...clump("Firebat", 5, 5, -0.7, 0.7, 0.62, TR()),
    ...clump("Marine", 18, 6.1, 0.8, 1.2, 0.56, TR()),
    ...clump("Medic", 5, 7.1, 2.5, 0.6, 0.66, TR({ st: 0, fight: false })),
    ["Siege Tank (Siege Mode)", 7.2, -1.6, TR()], ["Siege Tank (Siege Mode)", 5.2, 3, TR()],
    ...clump("Wraith", 4, 4.4, 2.6, 0.6, 0.95, TR()),
    ["Science Vessel", 6.4, 2.6, { own: 2, hb: 200 }],
  ],
};
/* ★ 종족별 기지 클로즈업(2026-11-01, 요청: "비교샷은 전투샷을 취소하고 각 종족별 비포 애프터로 · 배율은 8배 · 테란 커맨드에 컴샛 달림, 미네랄 scv 배럭 마린 탱크 ·
   프로토스 넥서스 파일런 어시밀레이터 프로브 게이트웨이 질럿 · 저그 하이브 드론 미네랄 스포닝풀 저글링 성큰 · 충분히 집약해서 그리기") —
   싸움 없이 한 사람의 본진만(적 없음) · 미네랄 줄 왼쪽 · 본진 · 캐는 일꾼 · 오른쪽 위 생산 건물 · 오른쪽 아래 병력. 배율 8 이면 무대가 ≈16타일이라 틀은 15 × 12 안. */
/* (같은 날 되요청: "마린 4 메딕 2 파뱃 2 탱크 1 · 질럿 4 리버 1 다크 1 · 저글링 4 히드라 4 럴커(버로우 2) · 가스 건물 모두 포함 미네랄 4덩이 · 오버로드 1(하이브 주변) ·
   뮤탈 2 · 드랍십 2 · 캐리어 대신 커세어 2인데 스러스터 켜진 상태") — 커세어는 상태 1(이동 · 추진 불꽃 자세) · 럴커는 상태 6(버로우). */
/* (11-02 되요청: "각 종족에 적 두세마리 추가하고 교전상태로 촬영 · 프로토스 탱크 벌처 골리앗 합쳐서 7기정도 · 테란 탱크레이스 대신 베슬 발키리 넣고
   적으로는 울트라 저글링 오버로드 · 저그 적으로 드라군 하템 캐리어" · "테란에 엔지니어링 베이 떠있는거") — 병력은 상태 4 + 표적(가장 가까운 적)으로 싸우고
   적은 오른쪽 끝에 붙는다(틀 오른쪽을 0.9 늘림). 테란의 탱크 → 베슬 · 드랍십 둘 → 발키리 둘(오버로드를 친다) · 뜬 엔베는 오른위. */
/* (같은 날 되요청: "너무 유닛이 오른쪽에 치우친듯 · 건물을 더 촘촘히 모으고 유닛을 왼쪽까지 펼치기") — 건물은 위 띠(y −7.2 ~ −1.8)에 붙여 모으고
   (미네랄 넷 · 일꾼 · 본진 · 가스 · 옆 건물 · 생산 건물 · 뜬 엔베) 병력은 아래 띠 전체(x −7 ~ 6.6)에 펼친다 — 아군은 왼쪽~가운데 · 적은 가운데~오른쪽에서 맞붙는다. */
const BASE8 = { zoom: 8, frame: { x0: -8.3, x1: 7.5, y0: -8.8, y1: 3.8 },
  res: [[-7.5, -5.6, 0], [-7.7, -4.1, 0], [-7.7, -2.6, 0], [-7.5, -1.1, 0], [-3.4, -6.2, 1]] };
const MINERS8 = (n) => [[-6.1, -4.6, 192], [-6.2, -3.2, 200], [-6.1, -1.8, 180]].map(([x, y, hb]) => [n, x, y, { st: 5, hb }]);
const ME8 = (hb = 64) => ({ st: 4, fight: true, hb });
/* (같은 날: "프로토스는 흙에 풀밭 타일에 코발트 임자색 · 저그는 사막 타일에 붉은색 임자색 · 테란은 우주 타일에 흰색 임자색") — 장면마다 타일셋(tileset ·
   OBWM 머리 9번째 바이트) · 땅 색 층(ground — 판 3 의 타일 RGB: grass = 흙 바탕에 풀 얼룩 · sand = 모래 바탕에 짙은 모래 얼룩 · 없으면 타일셋 색) ·
   임자색(colors[임자]) · 저그는 사막 → 진한 흙(같은 날 되요청 · tileset 0 + ground "dirt"). 적은 그 종족 장면의 임자색을 빌린다(테란 장면의 저그 = 빨강 · 토스 장면의 테란 = 흰색 · 저그 장면의 토스 = 코발트). */
SCENES.테란8 = { ...BASE8, pl: [1, 0], tileset: 1, colors: [0xf2f2f2, 0xd8303a],
  put: [
    ["Command Center", -3.8, -3.3], ["Comsat Station", -0.8, -2.8], ["Refinery", -3.4, -6.2],
    ...MINERS8("SCV"),
    ["Barracks", 1.6, -5.3, { hurt: 300 }], ["Engineering Bay", 5.5, -3.2, { lift: true, hb: 0 }],
    ...clump("Medic", 2, -6.2, 2.2, 0.6, 0.66, { hb: 64 }),
    ...clump("Marine", 4, -4.2, 1.6, 0.8, 0.62, ME8()),
    ...clump("Firebat", 2, -2.4, 2.4, 0.5, 0.66, ME8()),
    ["Science Vessel", -3.0, -0.6, { hb: 64 }],
    ["Valkyrie", 0.6, -0.9, ME8(40)], ["Valkyrie", 2.2, -1.6, ME8(40)],
    // 적 저그(가운데~오른쪽)
    ...clump("Zergling", 4, -1.0, 2.6, 0.7, 0.5, FOE({ hb: 192 })),
    ["Ultralisk", 1.4, 1.2, FOE({ hb: 192 })], ["Ultralisk", 3.6, 2.6, FOE({ hb: 192 })],
    ["Overlord", 3.6, -0.4, { own: 1, hb: 192 }],
  ],
};
SCENES.토스8 = { ...BASE8, pl: [2, 1], tileset: 4, ground: "grass", colors: [0x1d4fc0, 0xf2f2f2],
  put: [
    ["Nexus", -3.8, -3.3], ["Assimilator", -3.4, -6.2],
    ...MINERS8("Probe"),
    ["Pylon", -0.7, -2.8], ["Gateway", 2.2, -4.8, { hurt: 260 }],
    ["Reaver", -5.8, 1.2, ME8(64)], ["Dark Templar", -3.8, 2.4, ME8(64)],
    ...clump("Zealot", 4, -1.4, 1.5, 1.0, 0.8, ME8()),
    ["Corsair", -6.6, 3.0, { st: 1, hb: 64 }], ["Corsair", -4.8, 3.4, { st: 1, hb: 64 }],   // 아래로(같은 날 "커세어 아래쪽으로 이동")
    // 적 테란(가운데~오른쪽) — 탱크 둘 · 벌처 셋 · 골리앗 둘
    ...clump("Vulture", 3, 1.6, 2.6, 0.9, 0.9, FOE({ hb: 192 })),
    ["Goliath", 2.4, 0.4, FOE({ hb: 192 })], ["Goliath", 4.4, 2.2, FOE({ hb: 192 })],
    ["Siege Tank (Tank Mode)", 4.4, -0.6, FOE({ hb: 192 })], ["Siege Tank (Siege Mode)", 5.8, -3.8, FOE({ hb: 192 })],
  ],
};
SCENES.저그8 = { ...BASE8, pl: [0, 2], tileset: 0, ground: "dirt", colors: [0xd8303a, 0x1d4fc0],
  put: [
    ["Hive", -3.8, -3.3], ["Extractor", -3.4, -6.2],
    ...MINERS8("Drone"),
    ["Spawning Pool", -0.2, -2.8, { hurt: 220 }], ["Sunken Colony", 2.2, -2.4, ME8(64)],
    ["Overlord", 0.8, -3.0, { hb: 100 }],
    ["Lurker", -6.2, 2.0, { st: 6, hb: 96 }],
    ...clump("Hydralisk", 4, -3.4, 1.4, 0.8, 0.62, ME8()),
    ...clump("Zergling", 4, -1.0, 2.4, 0.7, 0.5, ME8()),
    ["Lurker", 0.6, 0.4, { st: 6, hb: 96 }],
    ["Mutalisk", 2.4, -2.0, ME8(40)], ["Mutalisk", 3.8, -1.2, ME8(40)],
    // 적 프로토스(가운데~오른쪽) — 드라군 둘 · 하이 템플러 · 캐리어
    ["Dragoon", 0.6, 1.8, FOE({ hb: 192 })], ["Dragoon", 2.4, 2.8, FOE({ hb: 192 })],
    ["High Templar", 3.6, 0.6, { own: 1, hb: 192 }],
    ["Carrier", 5.0, -4.2, FOE({ hb: 192 })], ["Carrier", 6.0, -2.6, FOE({ hb: 192 })], ["Carrier", 4.4, -2.0, FOE({ hb: 192 })],
  ],
};
/** 사진 틀(가운데에서 잰 타일) — 진열 둘레 + 키 큰 몸이 솟는 몫. */
const FRAME = { x0: -15.5, x1: 9.5, y0: -13.5, y1: 5.8 };
/** 자원 — 본진 왼쪽 미네랄 줄 · 위 간헐천(가운데에서 잰 타일 · [dx, dy, 0 미네랄 | 1 간헐천]). */
const RES = [[-14, -11, 0], [-14.5, -9.5, 0], [-15, -8, 0], [-15, -6.5, 0], [-14.5, -5, 0], [-6, -12, 1]];
/** 모두 이때 태어난다 — 30초 안에 선 본진은 '시작 본진'이라 환영 플래카드가 꽂힌다(engine9 START_HALL_SEC9). */
const BORN = 31;
const CX = 64; const CY = 64;

function makeWorld(race) {
  const sc = SCENES[race];
  const PLAYERS = sc.pl.map((r, i) => ({ owner: i, race: r, force: sc.force ? sc.force[i] : i + 1, name: ["저그", "프로토스", "테란"][r === 0 ? 0 : r === 2 ? 1 : 2] + i, color: (sc.colors ?? [0x2b62e8, 0xd8303a, 0xe8c040])[i] ?? 0x888888, home: [64, 64] }));
  const tracks = [];
  let tag = 100;
  const rows = sc.put.map(([n, dx, dy, o = {}]) => ({ n, x: CX + dx, y: CY + dy, hb: o.hb ?? 72, own: o.own ?? 0, die: o.die === undefined ? null : T_SHOT + o.die, hurt: o.hurt ?? 0, st: o.st ?? 0, fight: !!o.fight, lift: !!o.lift, tag: 0 }));
  for (const r of rows) r.tag = tag++;
  // 표적 — 싸우는 몸은 가장 가까운 적(다른 편 · 산 몸)을 겨눈다.
  const forceOf = (o) => PLAYERS[o]?.force ?? o;
  for (const r of rows) {
    if (!r.fight) continue;
    let best = null; let bd = Infinity;
    for (const q of rows) { if (forceOf(q.own) === forceOf(r.own) || q.die !== null || ID[q.n] === undefined) continue; const d = Math.hypot(q.x - r.x, q.y - r.y); if (d < bd) { bd = d; best = q; } }
    r.tgtTag = best ? best.tag : 0;
  }
  for (const r of rows) {
    const type = ID[r.n];
    if (type === undefined) { console.warn(`  ⚠ 번호 없음: ${r.n}`); continue; }
    const keys = [];
    const end = r.die ?? GAME_SEC;
    // 뜬 건물(lift) — 첫 키는 앉고 둘째부터 뜸 깃발(0x40 · truthLives 는 둘째 키부터 '앉음 → 뜸'을 이륙으로 적는다).
    for (let s9 = BORN; s9 <= end; s9 += 0.75) keys.push([F(s9), Math.round(r.x * 32), Math.round(r.y * 32), r.hb, (s9 >= T_SHOT - 5 ? r.st : (r.st === 4 ? 0 : r.st)) | (r.lift && s9 > BORN ? 0x40 : 0), type]);
    if (r.die !== null) keys.push([F(r.die), Math.round(r.x * 32), Math.round(r.y * 32), r.hb, 3, type]);
    const tgt = r.tgtTag ? [[F(T_SHOT - 5), r.tgtTag]] : null;
    /* 파손(hurt · 같은 날 "건물들 한개씩은 파손 효과 보이게") — scene-sheet --hurt 와 같은 꼴: 태어나 0.5초에 그 체력으로 떨어지고 2.5초마다 1씩 더 깎인다(맞는 중). */
    const hurtHp = r.hurt ? (() => { const t9 = [[F(BORN), 5000], [F(BORN + 0.5), r.hurt]]; for (let s9 = BORN + 3; s9 <= GAME_SEC; s9 += 2.5) t9.push([F(s9), r.hurt - Math.round((s9 - BORN) / 2.5)]); return t9; })() : null;
    tracks.push({ tag: r.tag, owner: r.own, type, keys, hp: r.die !== null ? [[F(BORN), 5000], [F(r.die), 0]] : hurtHp, tgt });
  }
  const w = new W();
  w.u8(0x4f); w.u8(0x42); w.u8(0x57); w.u8(0x54); w.u8(11); w.f32(FPS); w.i32(-1);
  w.u8(PLAYERS.length);
  for (const pl of PLAYERS) { w.u8(pl.owner); w.u8(pl.owner); w.u8(pl.race); w.u8(pl.force); w.u8(0); w.u32(pl.color); w.str(pl.name); }
  w.u32(tracks.length);
  for (const tr of tracks) { w.u32(tr.tag); w.u8(tr.owner); w.u16(tr.type); w.u32(tr.keys.length); w.u32(tr.hp ? tr.hp.length : 0); w.u32(0); w.u32(tr.tgt ? tr.tgt.length : 0); w.u8(0); }
  for (const tr of tracks) {
    let pf = 0; let px = 0; let py = 0; let pt = 0;
    for (const [f, x, y, hb, st, ty] of tr.keys) { w.vz(f - pf); pf = f; w.vz(x - px); px = x; w.vz(y - py); py = y; w.u8(hb); w.u8(st & 0xff); w.vz(ty - pt); pt = ty; }
  }
  for (const tr of tracks) { if (!tr.hp) continue; let pf = 0; let pv = 0; for (const [f, v] of tr.hp) { w.vz(f - pf); pf = f; w.vz(v - pv); pv = v; } }
  for (const tr of tracks) { if (!tr.tgt) continue; let pf = 0; for (const [f, tg] of tr.tgt) { w.vz(f - pf); pf = f; w.u32(tg); } }   // 표적(판 6 · 값은 태그)
  w.u32(0);   // 업그레이드
  const casts = sc.casts ?? [];
  w.u32(casts.length); { let pf = 0; for (const [sRel, dx, dy, tc, o] of casts) { const x = CX + dx; const y = CY + dy; const f = F(T_SHOT + sRel); w.vz(f - pf); pf = f; w.u16(Math.round(x * 32)); w.u16(Math.round(y * 32)); w.u8(tc); w.u8(o); } }
  w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u16(119); w.u32(0);   // 핑 · 자원 · 명령 · APM(빈) · 자원밭단
  for (let i9 = 0; i9 < 6; i9 += 1) w.u32(0);                         // 판 9~11 의 맨 뒤 절 여섯
  return { motion: deflateSync(w.out()).toString("base64"), players: PLAYERS };
}

const walkFixture = readFileSync(join(HERE, "scripts/fixtures/walk-fastest.json"), "utf8");
const makeTerrain = (race) => {
  const sc = SCENES[race] ?? {};
  const f = JSON.parse(walkFixture); const Wd = f.w; const H = f.h;
  const tile = Buffer.alloc(Wd * H, 1);
  const mw = Wd * 4; const mh = H * 4; const wb = Buffer.alloc((mw * mh + 7) >> 3, 0xff);
  const ground = sc.ground ?? null;
  const hd = Buffer.alloc(11); hd.write("OBWM", 0, "ascii"); hd[4] = ground ? 3 : 1; hd.writeUInt16LE(Wd, 5); hd.writeUInt16LE(H, 7); hd[9] = sc.tileset ?? 2;
  if (!ground) return deflateSync(Buffer.concat([hd, tile, wb])).toString("base64");
  /* 땅 색 층(판 3) — 이어 붙는 값 노이즈 두 켜(8 · 3 타일 격자)로 얼룩을 짓는다. */
  const hh = (a) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const vn = (x, y, c, sd) => { const gx = x / c; const gy = y / c; const x0 = Math.floor(gx); const y0 = Math.floor(gy); let fx = gx - x0; let fy = gy - y0; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => hh(sd * 7919 + j * 1031 + i); const a = g(x0, y0); const b = g(x0 + 1, y0); const cc = g(x0, y0 + 1); const d = g(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy; };
  const rgb = Buffer.alloc(Wd * H * 3);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < Wd; x += 1) {
    const n = vn(x, y, 7, 1) * 0.7 + vn(x, y, 2.5, 2) * 0.3; const m = vn(x, y, 3, 3);
    let c;
    /* grass 는 대부분 풀(같은 날 "프로토스 대부분을 풀밭으로" — 풀 문턱 0.56 → 0.30 · 흙은 군데군데) · dirt 는 진한 흙("저그 진한 흙타일로") · sand 는 모래. */
    if (ground === "grass") c = n > 0.30 ? [84 + m * 18, 112 + m * 22, 54 + m * 10] : [132 + m * 16, 108 + m * 14, 82 + m * 12];   // 풀 · 흙
    else if (ground === "dirt") c = n > 0.58 ? [70 + m * 10, 52 + m * 8, 38 + m * 6] : [94 + m * 14, 72 + m * 11, 52 + m * 8];      // 짙은 흙 얼룩 · 진한 흙
    else c = n > 0.6 ? [176 + m * 14, 146 + m * 12, 98 + m * 10] : [204 + m * 16, 176 + m * 14, 124 + m * 12];                     // 짙은 모래 · 모래
    const o = (y * Wd + x) * 3; rgb[o] = Math.round(c[0]); rgb[o + 1] = Math.round(c[1]); rgb[o + 2] = Math.round(c[2]);
  }
  return deflateSync(Buffer.concat([hd, tile, wb, rgb])).toString("base64");
};

const ENTRY = `
import React from "react";
import { createRoot } from "react-dom/client";
import ReplayMotionPlayer from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
/* --atlas DIR(2026-11-01) — 미리 구운 서버 아틀라스(spr/)로 그린다(사이트가 그리는 그림 · 실시간 굽기 없이 빠르다). */
import { setReplaySpriteAtlas } from ${JSON.stringify(join(ROOT, "src/components/replay/sprAtlas9"))};
if (${JSON.stringify(process.argv.includes("--atlas"))}) setReplaySpriteAtlas({ base: "http://showcase.local/spr" });
window.__mount = (motion, players, walkJson, terrainB64, view) => {
  const el = document.getElementById("root");
  const tiles = btoa(String.fromCharCode(...new Uint8Array(128 * 128)));
  const grid = { hash: "showcase", name: "showcase", width: 128, height: 128, palette: [0], tiles,
    resources: view.res, image: null, walk: walkJson, terrain: terrainB64 ?? null, imageId: null, imageName: null };
  const bases = players.map((p) => ({ key: p.name, name: p.name, avatar: null, memberId: p.name,
    race: p.race === 1 ? "테란" : p.race === 0 ? "저그" : "프로토스", team: p.force, x: p.home[0], y: p.home[1], withName: true }));
  const teamOfRaw = (raw) => { const f = players.find((p) => p.name === raw); return f ? f.force : undefined; };
  createRoot(el).render(React.createElement(ReplayMotionPlayer, {
    grid, endSec: 120, bases, teamOfRaw, active: true,
    sceneLink: { t: view.t, z: view.z, cx: view.cx, cy: view.cy },
    loadUnitTracks: async () => ({ motion }),
  }));
};
`;
const bdir = mkdtempSync(join(tmpdir(), "showcase-bundle-"));
const bsrc = join(ROOT, "scripts", `.showcase-entry.${process.pid}.tmp.ts`);
writeFileSync(bsrc, ENTRY);
{
  const { build } = await import(pathToFileURL(join(HERE, "node_modules/vite/dist/node/index.js")).href);
  const reactPlugin = (await import(pathToFileURL(join(HERE, "node_modules/@vitejs/plugin-react/dist/index.js")).href)).default;
  await build({
    configFile: false, root: ROOT, logLevel: "error", plugins: [reactPlugin()],
    resolve: { alias: { react: join(HERE, "node_modules/react"), "react-dom": join(HERE, "node_modules/react-dom") } },
    define: { "process.env.NODE_ENV": JSON.stringify("production"), __SCPLAY_BUILD__: JSON.stringify("showcase") },
    worker: { format: "es", plugins: () => [reactPlugin()], rollupOptions: { external: [] } },
    build: { outDir: bdir, emptyOutDir: true, sourcemap: false, minify: false, cssCodeSplit: false,
      lib: { entry: bsrc, formats: ["es"], fileName: "entry" }, rollupOptions: { external: [], output: { inlineDynamicImports: true } } },
  });
}
rmSync(bsrc, { force: true });
const js = readFileSync(join(bdir, "entry.js"), "utf8");
const css = readFileSync(join(ROOT, "dist", "styles.css"), "utf8");

const { chromium } = await import("playwright-core");
const exe = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean).find((p) => existsSync(p));
/* PW_HEADED=1 — 창을 띄워 기기 GPU 로 그린다(2026-11-02 · 로컬 촬영: 헤드리스는 SwiftShader(CPU)라 느리다 · perf-check 와 같은 깃발). */
const HEADED9 = process.env.PW_HEADED === "1";
const launchOpt = { ...(exe ? { executablePath: exe } : {}), args: ["--no-proxy-server"], ...(HEADED9 ? { headless: false } : {}) };
const browser = await chromium.launch(launchOpt);
mkdirSync(OUT, { recursive: true });
for (const race of RACES) {
  const world = makeWorld(race);
  const FR = SCENES[race].frame ?? FRAME; const ZM = SCENES[race].zoom ?? ZOOM; const RS = SCENES[race].res ?? RES;
  const page = await browser.newPage({ viewport: { width: VIEW, height: Math.round(VIEW * 1.3) }, deviceScaleFactor: DPR });
  page.on("pageerror", (e) => console.error("페이지 오류:", e.message));
  if (flag("--atlas", null)) {
    const AD9 = resolve(String(flag("--atlas")));
    await page.route("http://showcase.local/spr/**", (r) => {
      const f9 = join(AD9, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/spr\//, "")));
      if (!existsSync(f9)) return r.fulfill({ status: 404, body: "" });
      const ct9 = f9.endsWith(".json") ? "application/json" : f9.endsWith(".js") ? "text/javascript" : f9.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
      return r.fulfill({ status: 200, contentType: ct9, body: readFileSync(f9) });
    });
  }
  await page.route("http://showcase.local/", (r) => r.fulfill({ contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    html,body{margin:0;background:#1b1e24;} #root{width:${VIEW}px;}
    .scr-motion-fog{display:none!important}</style></head><body><div id="root"></div></body></html>` }));
  // 크립은 저그만(기지 바닥) · 두리번 끔 · 사영 그림자 켬(배율 ≥ 4 에서만 실제로 선다) · terrsoft(땅 색 켜 경계를 물결로 — glTerrain9 TERR_SOFT9 · 옛 트리는 패치로).
  await page.goto(`http://showcase.local/#${race === "저그" || race === "합동" || race === "저그8" ? "" : "nocreep,"}noscan,nofog,terrsoft,glshadow=1,glshadowz=0${flag("--hash", "") ? "," + String(flag("--hash")) : ""}`);
  await page.addScriptTag({ content: js, type: "module" });
  await page.waitForFunction("!!window.__mount");
  await page.evaluate(([m, pl, wj, tb, v]) => window.__mount(m, pl, wj, tb, v),
    [world.motion, world.players, walkFixture, makeTerrain(race), { res: RS.map(([dx, dy, g]) => [CX + dx, CY + dy, g]), t: T_SHOT, z: ZM, cx: (CX + (FR.x0 + FR.x1) / 2) / 128, cy: (CY + (FR.y0 + FR.y1) / 2) / 128 }]);
  await page.waitForFunction("(window.__glInst9 > 0) || (window.__spritePerf && (window.__spritePerf.last.blit + window.__spritePerf.last.direct) > 0)", null, { timeout: 120000 })
    .catch(() => console.warn("⚠ 그리기 신호를 못 받았다 — 그래도 찍는다"));
  // 보기 모드 판(중계/자유)이 서 있으면 [자유] · 재생을 멈추고 탐색바로 T_SHOT 에 세운다.
  if (await page.locator(".scr-mode-ask-btn").count()) { await page.locator(".scr-mode-ask-btn").nth(0).click(); await page.waitForTimeout(500); }
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement && b.getAttribute("aria-label") === "일시정지") b.click(); });
  await page.waitForTimeout(400);
  const seek = (t) => page.evaluate((t) => {
    const r = document.querySelector(".scr-motion-range");
    if (!(r instanceof HTMLInputElement)) return;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(r, String(t));
    r.dispatchEvent(new Event("input", { bubbles: true }));
    r.dispatchEvent(new Event("change", { bubbles: true }));
  }, t);
  /* ★ 트레이서가 다 나오게(2026-11-02, 요청: "다들 트레이서 나오게") — 사격 박자(engine9 firePhase)는 시계가 튀면 그 시각을 0으로 잡는다(되감기·2초 넘는 점프).
     T_SHOT 에 바로 서면 모두가 위상 0(막 쏘기 시작 · 선 길이 0)이라 거의 안 보였다. 그래서 T_SHOT − 리드에 먼저 서서 박자를 새로 잡고(그림 한 장을 받을 때까지 기다림)
     T_SHOT 으로 리드만큼 앞으로 가면(잇는 사격) 모든 사수가 같은 '쏜 지 리드 초' 자리에 선다 — 트레이서 창(쿨다운 앞 35% · 날아가는 탄은 날 시간 안) 안이다. 옛 트리도 같은 길이라 비포에도 먹는다. */
  const LEAD = Number(flag("--lead", 0.12));
  if (LEAD > 0) { await seek(T_SHOT - LEAD); await page.waitForTimeout(2500); }
  await seek(T_SHOT);
  await page.waitForTimeout(6000);
  /* 전체화면 판(무대가 창을 덮는다 — 창 모드 무대는 폭 × 0.45 남짓이라 배율 5.5 에서 세로 10타일뿐이다). 배율이 다시 맞춰지면 적는다. */
  if (!flag("--nofs", false)) {
    const z0 = await page.evaluate(() => window.__scrDiag?.zoom);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button[aria-label]")].find((el) => /^전체화면$/.test(el.getAttribute("aria-label") ?? "")); if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(3000);
    const st9 = await page.evaluate(() => { const r = document.querySelector(".scr-fs-stage")?.getBoundingClientRect(); return r ? `${r.width.toFixed(0)}x${r.height.toFixed(0)}` : "-"; });
    console.log(`  전체화면: 무대 ${st9} · 배율 ${z0} → ${await page.evaluate(() => window.__scrDiag?.zoom)}`);
  }
  const clock = await page.evaluate(() => document.querySelector(".scr-motion-clock")?.textContent ?? "?");
  // 지도 위 손잡이·자막·다이얼·독·토스트는 걷는다(사진엔 장면만) — 무대 안에서 지도 상자 말고는 다 숨긴다.
  await page.evaluate(() => {
    const st = document.querySelector(".scr-fs-stage");
    if (st) for (const c of st.children) if (!c.classList.contains("scr-motion-map")) c.style.visibility = "hidden";
    for (const q of [".scr-fs-lower", ".scr-toast", ".scr-motion-toast", ".scr-fs-toast"]) for (const e of document.querySelectorAll(q)) e.style.visibility = "hidden";
    for (const e of document.querySelectorAll(".scr-motion-map *")) if (/환영합니다|fps/.test(e.childNodes.length === 1 && e.firstChild?.nodeType === 3 ? e.textContent ?? "" : "")) e.style.visibility = "hidden";
  });
  await page.waitForTimeout(500);
  // 틀(타일) → 화면 자리: 렌즈 식 ((t/128 − c)·z + 0.5)·상자.
  const clip = await page.evaluate(([fr, cx, cy, z, CX0, CY0]) => {
    const r = document.querySelector(".scr-motion-map").getBoundingClientRect();
    const sx = (t) => r.left + ((t / 128 - cx) * z + 0.5) * r.width;
    const sy = (t) => r.top + ((t / 128 - cy) * z + 0.5) * r.height;
    const a = [sx(CX0 + fr.x0), sy(CY0 + fr.y0), sx(CX0 + fr.x1), sy(CY0 + fr.y1)];
    const st = document.querySelector(".scr-fs-stage")?.getBoundingClientRect() ?? r;
    const x0 = Math.max(st.left, a[0]); const y0 = Math.max(st.top, a[1]); const x1 = Math.min(st.right, a[2]); const y1 = Math.min(st.bottom, a[3]);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, cut: a.map((v, i) => Math.round(v - [x0, y0, x1, y1][i])).join(",") };
  }, [FR, (CX + (FR.x0 + FR.x1) / 2) / 128, (CY + (FR.y0 + FR.y1) / 2) / 128, ZM, CX, CY]);
  const file = join(OUT, `show_${RACE_EN[race]}.png`);
  if (clip.cut !== "0,0,0,0") console.warn(`  ⚠ 틀이 무대 밖으로 잘림(왼·위·오른·아래 px): ${clip.cut}`);
  await page.screenshot({ path: file, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height }, timeout: 180000 });
  console.log(`${race}: 시계 ${clock} → ${file}`);
  await page.close();
}
await browser.close();
rmSync(tdir, { recursive: true, force: true });
