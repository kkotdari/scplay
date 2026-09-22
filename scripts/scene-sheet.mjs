/* 종족별 **크기 비교 장면**(요청: "모든 종족의 모든 유닛과 건물을 모아서 실제 재생기의 장면처럼 보여주는 스크린샷 —
 * 크기 비교를 위해서, 종족별로") ────────────────────────────────────────────────
 *
 *   node scripts/scene-sheet.mjs --out <dir>            → scene_terran.png · scene_protoss.png · scene_zerg.png
 *   node scripts/scene-sheet.mjs --race 테란 --zoom 2
 *
 * 도록(doc-sheet)은 모델을 칸마다 정규화해 담으므로 크기 비교가 안 된다. 이 도구는 perf-check와 같은 길로 **진짜
 * 재생기**를 띄우고(합성 참값: 종족의 모든 건물·유닛을 한 사람 것으로 격자에 세운다) 지도 상자를 찍는다 — 그래서
 * 건물 발자국·유닛 자(MODEL_NORM·BLD_NORM·타일 px)가 화면 그대로다. 이름표는 엔진의 표(SHAPE_KIND·UNIT_3D·
 * raceOfName9)에서 읽고 번호는 bwUnitNames에서 잇는다. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const OUT = String(flag("--out", join(tmpdir(), "scene-sheet")));
const RACES = flag("--race", null) ? [String(flag("--race"))] : ["테란", "프로토스", "저그"];
/* 배율은 **짜임에서 난다**(2026-09) — `--zoom` 을 주면 그 값으로 못 박고, 안 주면 span 에서 낸다:
   모아 놓은 만큼 크게 보이고, 사영 그림자가 켜지는 문턱(`DEV9.meshShadowMinZoom` PC 4배)을 저절로 넘는다. */
const ZOOM = Number(flag("--zoom", 0));
const ZOOM_MAX = Number(flag("--zoommax", 6));
const ZOOM_PAD = Number(flag("--zoompad", 2.5));
/** 바닥 — 흰색 + 격자줄이 기본이다(`--floor map` 이면 옛 잿빛 지형). */
const WHITE = String(flag("--floor", "white")) !== "map";
/** 사영 그림자(`#glshadow=1`) — 기본 켬(`--noshadow` 로 끈다). 배율 4배 위에서만 실제로 켜진다. */
const SHADOW = !flag("--noshadow", false);
/** 화소 배수(요청: "화질도 2배 높여서 4배기준으로 뽑아야겠어") — 지도 상자가 1024 CSS px 라 4배면 4096px 판이다.
 *  ⚠ 라벨·격자는 CSS px 자라 저절로 따라오고, 늘어나는 것은 **파일 무게**뿐이다(2048 → 4096 에 2~3배). */
const DPR = Number(flag("--dpr", 4));
const VIEW = Number(flag("--view", 1400));
const FPS = 23.81;
const F = (sec) => Math.round(sec * FPS);
const GAME_SEC = 120;
/** 유닛 방향 바이트(0 북 · 64 동 · 128 남 · 192 서) — 기본 128(정면). `--hb N`으로 바꾼다. */
const HB = Number(flag("--hb", 160));   // 기본 160 = 요잉 45(건물의 45와 같은 칸)

const RACE_EN = { 테란: "terran", 프로토스: "protoss", 저그: "zerg" };
/* ★★ **세 종족을 한 장에 잇는 장면**(2026-09, 요청: "3종족이 같이 있는 장면도 추가로 만들어 줘 · 바로 옆에 붙여서
   배치 · 순서는 프로토스-테란-저그 · 화질은 원래 화질 유지(대신 가로로 길어지겠지) · 종족 사이 갭은 일반 갭의 2배") —
   한 판에 셋을 다 세우는 길은 **못 간다**: 이 기계의 GL 이 `MAX_TEXTURE_SIZE` **8192** 라(실측) 가로 1만 화소가 넘는
   판을 못 짓는다. 그래서 종족마다 제 판을 찍고 **잉크 구간만 잘라 가로로 잇는다** — 화소 배수(DPR)도 타일 px 도
   그대로이므로 '원래 화질'이고 가로만 길어진다.
   · ⚠⚠ **셋을 같은 배율로 굽는다** — 배율이 갈리면 타일 px 가 갈려 ㉠ 종족끼리 크기 비교가 깨지고 ㉡ 격자 간격이
     칸마다 달라진다. 자동 배율 셋 중 **가장 작은 것**으로 못 박는다(가장 넓은 종족이 안 잘린다).
   · 자르는 자리는 잉크 구간 ± 종족 갭의 반이라, 이어 붙이면 종족 사이가 정확히 그 갭이다(`--racegap` 배수 × GB). */
const COMBO = !flag("--nocombo", false);
const RACE_GAP_K = Number(flag("--racegap", 2));
const COMBO_ORDER = ["프로토스", "테란", "저그"];

/* ── esbuild ── */
const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
const head = readFileSync(ebin).subarray(0, 4);
const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
  || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
const esbuild = (src, out, extra) => {
  const args = [src, "--bundle", "--format=esm", "--log-level=error", ...extra,
    "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
  execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
};

/* ── 표 — 엔진의 이름표를 노드에서 읽는다 ── */
const tdir = mkdtempSync(join(tmpdir(), "scene-tables-"));
const tsrc = join(ROOT, "scripts", ".scene-tables.tmp.ts");
writeFileSync(tsrc, `
import { UNITS } from ${JSON.stringify(join(ROOT, "src/utils/bwUnits"))};
import { SHAPE_KIND, UNIT_3D, raceOfName9, FOOTPRINT, MODEL_NORM, BLD_NORM, BLD_NORM_PAIR, isAirUnit, UNIT_SIZE_TUNE, BLD_DRAW_TUNE, BLD_DRAW_K } from ${JSON.stringify(join(ROOT, "src/components/replay/engine9"))};
import { BW_UNIT_NAME } from ${JSON.stringify(join(ROOT, "src/utils/bwUnitNames"))};
(globalThis as any).window = globalThis;
export const TABLES = { SHAPE_KIND, UNIT_3D, FOOTPRINT, BW_UNIT_NAME, MODEL_NORM, BLD_NORM, BLD_NORM_PAIR, UNIT_SIZE_TUNE, BLD_DRAW_TUNE, BLD_DRAW_K,
  BOX: Object.fromEntries(Object.keys(UNIT_3D).map((n) => [n, UNITS[n]?.box ?? null])),
  AIR: Object.fromEntries(Object.keys(UNIT_3D).map((n) => [n, isAirUnit(n)])),
  RACE: Object.fromEntries([...Object.keys(SHAPE_KIND), ...Object.keys(UNIT_3D)].map((n) => [n, raceOfName9(n) ?? ""])) };
`);
esbuild(tsrc, join(tdir, "tables.mjs"), ["--platform=node"]);
rmSync(tsrc, { force: true });
const { TABLES } = await import(pathToFileURL(join(tdir, "tables.mjs")).href);
const nameToId = {};
for (const [id, nm] of Object.entries(TABLES.BW_UNIT_NAME)) if (nameToId[nm] === undefined) nameToId[nm] = Number(id);

/* ── OBWT 판 4 합성(perf-check와 같은 규약) ── */
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
function makeWorld(race, zFix = 0) {
  /* zFix — 셋을 한 장에 잇는 장면(--combo)에서 **세 종족이 같은 배율**이라야 크기 비교와 격자가 맞는다. */
  const ZM = zFix || ZOOM;
  const raceNum = race === "테란" ? 1 : race === "저그" ? 0 : 2;
  const PLAYERS = [{ owner: 0, race: raceNum, force: 1, name: "비교", color: 0x2b62e8, home: [64, 64] }];
  /* 차례는 **빌드 오더**(요청) — 건물은 테크 트리에서 이른 것부터, 유닛은 지상·공중 각각 이른 것부터. 표에 없는 이름은 뒤에. */
  const ORDER = {
    "테란": ["Command Center", "Supply Depot", "Refinery", "Barracks", "Engineering Bay", "Bunker", "Missile Turret", "Academy",
      "Comsat Station", "Factory", "Machine Shop", "Armory", "Starport", "Control Tower", "Science Facility", "Physics Lab",
      "Covert Ops", "Nuclear Silo",
      "SCV", "Marine", "Firebat", "Medic", "Ghost", "Vulture", "Spider Mine", "Siege Tank (Tank Mode)", "Siege Tank (Siege Mode)", "Goliath",
      "Wraith", "Dropship", "Science Vessel", "Valkyrie", "Battlecruiser"],
    "프로토스": ["Nexus", "Pylon", "Assimilator", "Gateway", "Forge", "Photon Cannon", "Cybernetics Core", "Shield Battery",
      "Citadel of Adun", "Templar Archives", "Robotics Facility", "Robotics Support Bay", "Observatory", "Stargate",
      "Fleet Beacon", "Arbiter Tribunal",
      "Probe", "Zealot", "Dragoon", "High Templar", "Dark Templar", "Archon", "Dark Archon", "Reaver", "Scarab",
      "Shuttle", "Observer", "Scout", "Corsair", "Carrier", "Interceptor", "Arbiter"],
    "저그": ["Hatchery", "Creep Colony", "Spawning Pool", "Extractor", "Evolution Chamber", "Sunken Colony", "Spore Colony",
      "Hydralisk Den", "Lair", "Spire", "Queen's Nest", "Nydus Canal", "Hive", "Ultralisk Cavern", "Greater Spire", "Defiler Mound",
      "Larva", "Egg", "Drone", "Zergling", "Hydralisk", "Lurker Egg", "Lurker", "Ultralisk", "Defiler", "Broodling", "Infested Terran",
      "Overlord", "Mutalisk", "Scourge", "Queen", "Mutalisk Cocoon", "Guardian", "Devourer"],
  }[race] ?? [];
  const ordIdx = (n) => { const i = ORDER.indexOf(n); return i < 0 ? 999 : i; };
  const byOrder = (a, b) => ordIdx(a) - ordIdx(b);
  /* --addons — 본체·부속 **짝**만 세운다(2026-09, 통로 자동 길이 검사): 부속을 원작 자리(본체 발자국 오른쪽 · 한 줄 아래)에
     붙여 통로가 두 벽을 잇는지 본다. `--hash cine=1` 과 함께 찍으면 시네마틱에서 벌어진 사이를 통로가 따라가는지 보인다. */
  const ADDON_PAIRS = flag("--addons", false) && race === "테란" ? [["Command Center", "Comsat Station"], ["Command Center", "Nuclear Silo"],
    ["Factory", "Machine Shop"], ["Starport", "Control Tower"], ["Science Facility", "Covert Ops"], ["Science Facility", "Physics Lab"]] : null;
  const blds = ADDON_PAIRS ? [] : Object.keys(TABLES.SHAPE_KIND).filter((n) => TABLES.RACE[n] === race && nameToId[n] !== undefined).sort(byOrder);
  const units = ADDON_PAIRS ? [] : Object.keys(TABLES.UNIT_3D).filter((n) => TABLES.RACE[n] === race && nameToId[n] !== undefined).sort(byOrder);
  const skipped = Object.keys(TABLES.UNIT_3D).filter((n) => TABLES.RACE[n] === race && nameToId[n] === undefined);
  if (skipped.length) console.log(`  (번호 없어 뺀 유닛: ${skipped.join(", ")})`);
  console.log(`  건물: ${blds.join(", ")}`);
  console.log(`  유닛: ${units.join(", ")}`);
  const tracks = [];
  let tag = 100;
  /* --hurt: 건물마다 체력 줄을 싣는다(2026-09, 지적: "건물 체력바가 안 나옴" — 성한 건물은 바를 안 띄우므로 검증에 이 손이
     필요하다). 0.5초에 300 으로 깎이고 그 뒤 2.5초마다 1 씩 더 깎여 '맞은 지 3초 안'(HP_BAR_SEC)이 늘 참이다. 값은 절대 체력. */
  const hurtTicks = () => { if (!flag("--hurt", false)) return null; const t9 = [[F(0), 5000], [F(0.5), 300]]; for (let s = 3; s <= GAME_SEC; s += 2.5) t9.push([F(s), 300 - Math.round(s / 2.5)]); return t9; };
  const bldTrack = (type, x, y) => tracks.push({ tag: tag++, owner: 0, type, keys: [
    [F(0), x * 32, y * 32, 0, 0, type], [F(GAME_SEC), x * 32, y * 32, 0, 0, type]], hp: hurtTicks() });
  const unitTrack = (type, x, y) => {
    const keys = [];
    // 방향은 정면(남쪽, 화면 아래 = 방향 바이트 128)(요청: "유닛들도 방향은 정면을 향하게").
    for (let s = 0; s <= GAME_SEC; s += 0.75) keys.push([F(s), Math.round(x * 32), Math.round(y * 32), HB, 0, type]);
    tracks.push({ tag: tag++, owner: 0, type, keys, hp: null });
  };
  const labels = [];
  // 짧은 이름 — 괄호는 머리글자로(Siege Tank (Siege Mode) → Siege Tank(S)).
  const short = (n) => n.replace(/ \((\w)[^)]*\)/, "($1)");
  /* 라벨 둘째 줄 = **원작 설정의 바닥 공간**(재요청: "배율 말고 실제 게임 설정상 차지하는 바닥공간 가로*세로") —
     건물은 발자국 타일(units.dat tileSize, 예 4×3), 유닛은 치수 상자(units.dat dimensions: 좌+우+1 × 상+하+1 픽셀을
     32로 나눈 타일). 그리기 배율은 `--scale` 깃발로 다시 볼 수 있다. */
  const SHOW_SCALE = !!flag("--scale", false);
  const normOf = (n, isBld) => {
    const k = isBld ? TABLES.SHAPE_KIND[n] : TABLES.UNIT_3D[n];
    if (SHOW_SCALE) return `×${Number(isBld ? (TABLES.BLD_DRAW_TUNE[k] ?? 1) : (TABLES.UNIT_SIZE_TUNE[k] ?? 1)).toFixed(2)}`;
    if (isBld) { const fp = TABLES.FOOTPRINT[n]; return fp ? `${fp[0]}×${fp[1]}` : "?"; }
    // 타일로(재요청: "픽셀 말고 타일로, 32px이 1") — 소수 둘째 자리.
    const b = TABLES.BOX[n];
    const tl = (px) => (px / 32).toFixed(2).replace(/\.?0+$/, "");
    return b ? `${tl(b[0] + b[2] + 1)}×${tl(b[1] + b[3] + 1)}` : "?";
  };
  /* ── 짜임은 **몸의 자**로 채운다 ─────────────────────────────────────────────────────
     ★★ (2026-09, 요청: "크기 비교가 잘 안되는 이유가 너무 멀리 떨어져있어 불필요한 사이 갭 줄여서
     최대한 모여서 나오게") — 옛 짜임은 **못 박은 격자**(건물 6타일 7열 · 유닛 4.6타일 10열)였다.
     칸이 그 줄의 가장 큰 발자국에 맞춰져 있으니 터렛(2×2) 옆에 4타일짜리 빈자리가 남고, 그 빈자리가
     곧 '멀리 떨어져 보이는' 그 몫이다. 이제 칸 폭은 **그 몸의 자**(건물 발자국 · 유닛 치수 상자)이고
     사이에 틈(GB·GU)만 둔다.
     · 줄은 폭 예산 B 로 채우고, **B 를 훑어 가로·세로 span 이 가장 고른 값**을 고른다 — 그 span 이 곧
       배율이다(`--zoom` 을 안 주면 `128 / (span + 여유)`). 곧 '모아 놓기'와 '크게 보이기'가 한 일이다.
     · ⚠ **줄 사이는 몸이 발자국 위로 솟는 몫을 재어 벌린다**(RISE ≈ 발자국 폭) — 붓은 건물을 잉크
       바닥으로 앉히므로 몸이 제 발자국보다 위로 자란다. 그 몫을 안 주면 아랫줄 건물이 윗줄 라벨을
       덮는다. 나는 몸은 뜬 높이(AIRUP)만큼 더 벌린다.
     · ⚠ 칸 폭의 바닥은 **라벨 글자 폭**이다(LABCH — 9px 글꼴이라 한 글자 ≈ 0.1타일) — 작은 몸을
       바싹 붙이면 이름이 겹친다. */
  const GB = Number(flag("--gapb", 0.65));
  const GU = Number(flag("--gapu", 0.5));
  /* ⚠⚠ **칸 폭은 발자국이 아니라 그려지는 몸의 폭이다** — 붓은 건물을 발자국보다 크게 그린다(실측: 커맨드 4타일
     발자국의 몸이 6타일 남짓). 발자국으로 재어 바싹 붙이면 팩토리와 머신샵처럼 **몸끼리 닿는다**. 그려지는
     몫을 재는 배수(DWB·DWU)와 발치 위로 솟는 몫(RISEB·RISEU)은 눈으로 고른 값이다. */
  const DWB = Number(flag("--dwb", 1.55));
  const DWU = Number(flag("--dwu", 1.6));
  const RISEB = Number(flag("--riseb", 1.05));
  /* ⚠ 유닛은 **치수 상자보다 훨씬 크게 그려진다** — 아콘·다크아콘은 1×1 상자에 세 타일짜리 빛 공이다(실측:
   1.3 으로 두었더니 다크아콘이 윗줄 '아비터 트리뷰널' 라벨을 덮었다). 절(건물 → 지상 → 비행) 사이에도 한 뼘. */
const RISEU = Number(flag("--riseu", 2.0));
const SECPAD = Number(flag("--secpad", 0.6));
  /* ★★ **나는 줄의 솟음은 상자가 아니라 뜬 높이가 정한다**(2026-09, 요청: "지상유닛과 공중유닛 사이도 줄일수
   있겠다") — 여기 `max(h/2, w·RISEU) + AIRUP` 으로 두었더니 배틀크루저(상자 2.34)에서 4.68 + 2.8 = **7.48타일**
   이 섰는데, 세 종족의 실측 솟음(그림자 가운데 → 몸 꼭대기)은 **3.48~3.66타일**로 거의 같았다(테란 3.66 ·
   프로토스 3.65 · 저그 3.48 — 상자가 가장 큰 배틀크루저와 가장 작은 저그 비행이 0.18 밖에 안 벌어진다).
   까닭은 `airLiftPxOf` 가 **몸 크기와 무관한 한 값**이라 그 몫이 솟음을 지배하기 때문이다. 그래서 나는 줄은
   상자 배수를 안 타고 **잰 솟음 + 줄 사이 빈 띠**(3.66 + 1.4 = **5.1**) 한 상수로 선다 — 지상 줄과의 빈 띠
   3.7타일이 1.35~1.55 로 준다(다른 줄 사이와 같은 몫이다).
   · ★ **빈 띠는 없애는 것이 아니라 다른 줄과 같게 하는 것이다**(재지적: "이번엔 너무 붙었어 다른 갭정도의
     갭은 있었으면 좋겠네 동일하게") — 4.0(= 잰 솟음 + 0.34)으로 두었더니 빈 띠가 **0.25~0.45타일**이라 나는
     줄이 지상 줄 라벨에 붙어 섰다. 다른 줄 사이(라벨 아래끝 → 다음 줄 몸 꼭대기)를 재면 **1.30~1.59타일**이고
     그것은 `upMax`(다음 줄의 솟음 배수)가 남기는 몫이다 — 나는 줄에는 그 자가 없으니 손으로 같은 몫을 준다.
   · ⚠ 솟음을 **타일로** 재면 배율과 무관하다(뜬 높이도 배율을 타므로) — 한 번 재면 그 값이 어느 배율에서도 맞다.
   · 🔎 재는 자: 시트를 떠서 행마다 잉크 화소를 세어(`$S/rows2.mjs` 꼴 — 몸은 채도 있거나 어두운 것 · 그림자는
     회색) 나는 줄의 몸 띠 꼭대기와 그림자 띠 가운데의 차를 타일(= 8·배율·DPR px)로 나눈다. */
const AIRUP = Number(flag("--airup", 5.1));
  const LAB = Number(flag("--lab", 1.0));
  /* ⚠ **라벨 글자 폭은 배율을 탄다** — 지도 상자는 1024 CSS px 라 한 타일이 `8 × 배율` px 이고, 9px 글꼴의 한
     글자는 5.4px 남짓이다. 곧 배율이 곧 칸의 자이고 칸이 곧 배율이라(짜임 → span → 배율) **되풀어 맞춘다**. */
  const CHPX = Number(flag("--chpx", 5.6));
  let zGuess = 4;
  const cellOf = (n, isBld, lab, nv) => {
    let w; let h;
    if (isBld) { const fp = TABLES.FOOTPRINT[n] ?? [3, 2]; w = fp[0]; h = fp[1]; }
    else { const b = TABLES.BOX[n]; w = b ? (b[0] + b[2] + 1) / 32 : 1; h = b ? (b[1] + b[3] + 1) / 32 : 1; }
    return { n, isBld, lab, nv, w, h, chars: Math.max(lab.length, String(nv).length) };
  };
  /* 칸의 폭·솟음을 그때의 배율로 낸다(위 ⚠). */
  const sizeAt = (c, z) => {
    const labW = (c.chars * CHPX) / (8 * z) + 0.2;
    const dw = c.w * (c.isBld ? DWB : DWU);
    return { cw: Math.max(dw, labW), up: Math.max(c.h / 2, c.w * (c.isBld ? RISEB : RISEU)) };
  };
  /* 공사 중 모델도 한 칸씩(요청: "토스 소환구 저그 공사고치도 추가") — 판 8의 상태 바이트 0x80(아직 안 지어짐)을
     20초부터 끝까지 실어 born > 1인 공사 생애를 만든다(truthLives.raising). 완성 비트가 안 오니 46초엔 공사 중이다. */
  const wip = race === "프로토스" ? [["Gateway", "Warp-in", "warpin"]] : race === "저그" ? [["Hydralisk Den", "Cocoon", "cocoon"]] : [];
  const secB = [
    ...blds.map((n) => cellOf(n, true, short(n), normOf(n, true))),
    ...wip.map(([n, lab, kind]) => ({ ...cellOf(n, true, lab, SHOW_SCALE ? `×${Number(TABLES.BLD_DRAW_TUNE[kind] ?? 1).toFixed(2)}` : `${(TABLES.FOOTPRINT[n] ?? [3, 2])[0]}×${(TABLES.FOOTPRINT[n] ?? [3, 2])[1]}`), wip: true })),
  ];
  const secG = units.filter((n) => !TABLES.AIR[n]).map((n) => cellOf(n, false, short(n), normOf(n, false)));
  const secA = units.filter((n) => TABLES.AIR[n]).map((n) => cellOf(n, false, short(n), normOf(n, false)));
  const layout = (B, z) => {
    const cells = []; let y = 0; let spanX = 0;
    let first = true;
    for (const sec of [{ list: secB, gap: GB, air: false }, { list: secG, gap: GU, air: false }, { list: secA, gap: GU, air: true }]) {
      if (!sec.list.length) continue;
      if (!first) y += SECPAD;
      first = false;
      const sz = sec.list.map((c) => ({ c, ...sizeAt(c, z) }));
      const rows = []; let row = []; let rw = 0;
      for (const it of sz) {
        const add = row.length ? sec.gap + it.cw : it.cw;
        if (row.length && rw + add > B) { rows.push({ row, rw }); row = []; rw = 0; }
        rw += row.length ? sec.gap + it.cw : it.cw; row.push(it);
      }
      if (row.length) rows.push({ row, rw });
      for (const { row, rw: rowW } of rows) {
        const hMax = Math.max(...row.map((it) => it.c.h));
        const upMax = Math.max(...row.map((it) => it.up));
        /* 나는 줄은 상자 배수(upMax)를 버리고 잰 상수로 선다(위 ★★) — 상자 반높이가 그보다 크면 그것으로. */
        y += sec.air ? Math.max(AIRUP, Math.max(...row.map((it) => it.c.h / 2))) : upMax;
        let x = 64 - rowW / 2;
        /* ⚠ **라벨은 줄마다 한 높이다** — 제 발치(`y + h/2`)에 두면 4×3 옆의 2×2 이름이 한 칸 위로 올라와 이웃과
           겹친다(실측: 저그 지상 줄의 라바·에그·드론이 서로 물렸다). 줄의 가장 큰 몸으로 한 줄에 세운다. */
        for (const it of row) { cells.push({ ...it.c, cw: it.cw, x: x + it.cw / 2, y, ly: y + hMax / 2 + 0.55 }); x += it.cw + sec.gap; }
        y += hMax / 2 + LAB;
        spanX = Math.max(spanX, rowW);
      }
    }
    return { cells, spanX, spanY: y };
  };
  /* 배율 ↔ 짜임을 넷 번 되풀어 맞춘다(위 ⚠) — 모아 놓으면 배율이 오르고, 배율이 오르면 라벨이 좁아져 더 모인다. */
  let best = null;
  for (let it = 0; it < 4; it += 1) {
    best = null;
    for (let B = 10; B <= 64; B += 0.5) {
      const L = layout(B, zGuess);
      const s9 = Math.max(L.spanX, L.spanY);
      if (!best || s9 < best.s - 1e-9) best = { s: s9, L };
    }
    zGuess = ZM > 0 ? ZM : Math.min(ZOOM_MAX, 128 / (best.s + ZOOM_PAD));
  }
  const dy = 64 - best.L.spanY / 2;
  for (const c of best.L.cells) {
    const y = c.y + dy;
    if (c.wip) {
      tracks.push({ tag: tag++, owner: 0, type: nameToId[c.n], keys: [
        [F(20), c.x * 32, y * 32, 0, 0x80, nameToId[c.n]], [F(GAME_SEC), c.x * 32, y * 32, 0, 0x80, nameToId[c.n]]], hp: null });
    } else if (c.isBld) bldTrack(nameToId[c.n], c.x, y);
    else unitTrack(nameToId[c.n], c.x, y);
    labels.push([c.lab, c.nv, c.x, c.ly + dy]);
  }
  /* --addons 는 원작 자리를 보는 자라 짜임을 안 탄다(본체·부속 짝만 세운다). */
  let addonSpan = 0;
  (ADDON_PAIRS ?? []).forEach(([pn, an], i) => {
    const x = 64 - 19 + (i % 3) * 13 + 3; const y = 64 - 8 + Math.floor(i / 3) * 8;
    const fpP = TABLES.FOOTPRINT[pn] ?? [4, 3]; const fpA = TABLES.FOOTPRINT[an] ?? [2, 2];
    // 원작 자리: 부속의 왼위 타일 = 본체 왼위 + (본체 폭, 1). 트랙 자리는 가운데라 반 발자국씩 옮긴다.
    const ax = x + fpP[0] / 2 + fpA[0] / 2; const ay = y + 1 + fpA[1] / 2 - fpP[1] / 2;
    bldTrack(nameToId[pn], x, y); bldTrack(nameToId[an], ax, ay);
    labels.push([short(pn), normOf(pn, true), x, y + fpP[1] / 2 + 0.6]);
    labels.push([short(an), normOf(an, true), ax, ay + fpA[1] / 2 + 0.6]);
    addonSpan = 44;
  });
  const span = addonSpan || best.s;
  const w = new W();
  w.u8(0x4f); w.u8(0x42); w.u8(0x57); w.u8(0x54); w.u8(8); w.f32(FPS); w.i32(-1);   // 판 8(해독기가 판 8만 읽는다)
  w.u8(PLAYERS.length);
  for (const pl of PLAYERS) { w.u8(pl.owner); w.u8(pl.owner); w.u8(pl.race); w.u8(pl.force); w.u8(0); w.u32(pl.color); w.str(pl.name); }
  w.u32(tracks.length);
  // 판 8 트랙표 줄: tag·owner·type·키수·hp수·ic수·표적수 + 임자바뀜 목록(u8 개수, 여기서는 0).
  for (const tr of tracks) { w.u32(tr.tag); w.u8(tr.owner); w.u16(tr.type); w.u32(tr.keys.length); w.u32(tr.hp ? tr.hp.length : 0); w.u32(0); w.u32(0); w.u8(0); }
  for (const tr of tracks) {
    let pf = 0; let px = 0; let py = 0; let pt = 0;
    for (const [f, x, y, hb, st, ty] of tr.keys) { w.vz(f - pf); pf = f; w.vz(x - px); px = x; w.vz(y - py); py = y; w.u8(hb); w.u8(st & 0xff); /* 상태 바이트 통째(0x80 = 아직 안 지어짐) */ w.vz(ty - pt); pt = ty; }
  }
  // 체력 줄(키와 따로 · 트랙 차례 그대로): varint(zigzag 프레임차) · varint(zigzag 값차).
  for (const tr of tracks) { if (!tr.hp) continue; let pf = 0; let pv = 0; for (const [f, v] of tr.hp) { w.vz(f - pf); pf = f; w.vz(v - pv); pv = v; } }
  w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u16(119); w.u32(0);
  const motion = deflateSync(w.out()).toString("base64");
  const zoom = ZM > 0 ? ZM : Math.min(ZOOM_MAX, 128 / (span + ZOOM_PAD));
  /* 잉크가 실제로 차지하는 가로 구간(타일) — 셋을 잇는 장면이 여기서 자른다(칸 폭은 몸·라벨 중 넓은 쪽이다). */
  const x0 = Math.min(...best.L.cells.map((c) => c.x - c.cw / 2));
  const x1 = Math.max(...best.L.cells.map((c) => c.x + c.cw / 2));
  return { motion, players: PLAYERS, nB: blds.length, nU: units.length, cy: 0.5, zoom, span, labels, x0, x1, gap: GB };
}

/* ── 참값 지형(평지·잿빛) ── */
const walkFixture = readFileSync(join(ROOT, "scripts/fixtures/walk-fastest.json"), "utf8");
const makeTerrain = () => {
  const f = JSON.parse(walkFixture); const Wd = f.w; const H = f.h;
  const tile = Buffer.alloc(Wd * H, 1);
  const mw = Wd * 4; const mh = H * 4; const wb = Buffer.alloc((mw * mh + 7) >> 3, 0xff);
  const hd = Buffer.alloc(11); hd.write("OBWM", 0, "ascii"); hd[4] = 1; hd.writeUInt16LE(Wd, 5); hd.writeUInt16LE(H, 7); hd[9] = 2;
  return deflateSync(Buffer.concat([hd, tile, wb])).toString("base64");
};

/* ── 브라우저 번들 ── */
const ENTRY = `
import React from "react";
import { createRoot } from "react-dom/client";
import ReplayMotionPlayer from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
window.__mount = (motion, players, walkJson, terrainB64, view) => {
  const el = document.getElementById("root");
  const tiles = btoa(String.fromCharCode(...new Uint8Array(128 * 128)));
  const grid = { hash: "scene", name: "scene", width: 128, height: 128, palette: [0], tiles,
    resources: [], image: null, walk: walkJson, terrain: terrainB64 ?? null, imageId: null, imageName: null };
  const bases = players.map((p) => ({ key: p.name, name: p.name, avatar: null, memberId: p.name,
    race: p.race === 1 ? "테란" : p.race === 0 ? "저그" : "프로토스", team: p.force, x: p.home[0], y: p.home[1], withName: true }));
  const teamOfRaw = (raw) => { const f = players.find((p) => p.name === raw); return f ? f.force : undefined; };
  createRoot(el).render(React.createElement(ReplayMotionPlayer, {
    grid, endSec: 120, bases, teamOfRaw, active: true, initialSec: 46,
    initialView: view, loadUnitTracks: async () => ({ motion }),
  }));
};
`;
/* vite로 굽는다(perf-check와 같은 까닭) — 프레임은 **워커**만 내므로 esbuild 번들에는 워커가 없어 유닛이 안 그려지고
   안개만 깔린다(첫 시도의 검은 화면). */
const bdir = mkdtempSync(join(tmpdir(), "scene-bundle-"));
const bsrc = join(ROOT, "scripts", ".scene-entry.tmp.ts");
writeFileSync(bsrc, ENTRY);
{
  const { build } = await import("vite");
  const reactPlugin = (await import("@vitejs/plugin-react")).default;
  await build({
    configFile: false, root: ROOT, logLevel: "error", plugins: [reactPlugin()],
    define: { "process.env.NODE_ENV": JSON.stringify("production"), __SCPLAY_BUILD__: JSON.stringify("scene") },
    worker: { format: "es", plugins: () => [reactPlugin()], rollupOptions: { external: [] } },
    build: { outDir: bdir, emptyOutDir: true, sourcemap: false, minify: false, cssCodeSplit: false,
      lib: { entry: bsrc, formats: ["es"], fileName: "entry" }, rollupOptions: { external: [], output: { inlineDynamicImports: true } } },
  });
}
rmSync(bsrc, { force: true });
const js = readFileSync(join(bdir, "entry.js"), "utf8");
const cssPath = join(ROOT, "dist", "styles.css");
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
if (!css) console.warn("⚠ dist/styles.css 없음 — npx vite build 먼저.");

const { chromium } = await import("playwright-core");
const CANDIDATES = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const launchOpt = exe ? { executablePath: exe, args: ["--no-proxy-server"] } : { args: ["--no-proxy-server"] };
const browser = await chromium.launch(launchOpt).catch((e) => {
  if (!/headless/i.test(String(e))) throw e;
  return chromium.launch({ ...launchOpt, headless: false, args: [...launchOpt.args, "--headless=new", "--no-sandbox"] });
});
mkdirSync(OUT, { recursive: true });
/* 셋을 이으려면 배율이 하나여야 한다(위 ★★) — 미리 한 번 짜임을 풀어 가장 작은 배율을 고른다. */
const COMBO_ON = COMBO && RACES.length === 3;
let zFix = 0;
if (COMBO_ON && ZOOM <= 0) {
  const pre = RACES.map((r) => makeWorld(r).zoom);
  zFix = Math.min(...pre);
  console.log(`셋 공통 배율 ${zFix.toFixed(2)}배 (자동 ${pre.map((z) => z.toFixed(2)).join(" · ")})`);
}
const shots = [];
for (const race of RACES) {
  const world = makeWorld(race, zFix);
  const page = await browser.newPage({ viewport: { width: VIEW, height: VIEW }, deviceScaleFactor: DPR });
  page.on("pageerror", (e) => console.error("페이지 오류:", e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("콘솔:", m.text().slice(0, 300)); });
  /* http 출처로 띄운다(perf-check와 같은 길) — about:blank(setContent)에서는 인라인 워커가 안 서서 프레임이 안 온다
     ("프레임 워커 오류(내용 없음)"). */
  await page.route("http://scene-sheet.local/*", (r) => r.fulfill({ contentType: "text/html",
    body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
    html,body{margin:0;background:${WHITE ? "#fff" : "#1b1e24"};} #root{width:${VIEW}px;}
    ${WHITE ? ".scr-motion-map{background:#fff!important}" : ""}
    .scr-motion-fog{display:none!important}</style></head><body><div id="root"></div></body></html>` }));
  // --hash "cine=1" 처럼 해시를 더 얹는다(시네마틱 세기 · 붓 손잡이).
  const hashX = (SHADOW ? ",glshadow=1,glshadowz=0" : "") + (flag("--hash", "") ? "," + String(flag("--hash")) : "");
  /* ★ **흰 바닥은 지형 캔버스를 빼는 것이다**(2026-09, 요청: "바닥을 흰색에 격자줄 들어간 형태로") — 잿빛 평지는
     `.scr-motion-mapvec` 의 지형 캔버스가 칠하므로, 재생기가 이미 든 손(`?hide=mapvec`)으로 그 층만 빼고 상자
     바탕을 흰색으로 둔다. 격자는 이 자가 덧대는 줄이고 흰 바닥에서는 색을 검게 뒤집는다(아래 GRIDC).
     ★ **사영 그림자는 `#glshadow=1` + 배율 4배**다(요청: "그림자도 사영 그림자로") — 손 스위치만으로는 안 켜진다
     (`meshShadow9` 가 `DEV9.meshShadowMinZoom`(PC 4)을 함께 본다). 짜임을 모아 배율이 그 위로 올라간 것이
     이 손과 한 벌이다 — `--zoom` 을 4 아래로 못 박으면 접지 타원으로 돌아간다. */
  const q = WHITE ? "?hide=mapvec" : "";
  await page.goto("http://scene-sheet.local/" + q + (flag("--creep", false) ? "#noscan" : "#nocreep,noscan") + hashX);   // 크립 끔(격자가 보여야 한다; --creep이면 켠다) · 두리번 끔
  await page.addScriptTag({ content: js, type: "module" });
  await page.waitForFunction("!!window.__mount");
  await page.evaluate(([m, pl, wj, tb, v]) => window.__mount(m, pl, wj, tb, v),
    [world.motion, world.players, walkFixture, makeTerrain(), { z: world.zoom, cx: 0.5, cy: world.cy, deg: 90 }]);
  await page.waitForFunction("(window.__spritePerf && (window.__spritePerf.last.blit + window.__spritePerf.last.direct) > 0) || (window.__glInst9 > 0)", null, { timeout: 60000 })
    .catch(() => console.warn("⚠ 그리기 신호를 못 받았다 — 그래도 찍는다"));
  await page.waitForTimeout(4000);
  const why = await page.evaluate(() => { const d = window.__scrDiag || {}; return JSON.stringify({ truthWhy: d.truthWhy, truth: d.truth, worker: d.worker, crowd: d.crowd }); });
  console.log("진단:", why);
  /* 격자 타일(실제 게임 타일 크기)과 이름·배율 라벨을 지도 상자 위에 덧댄다 — 상자 좌표는 initialView와 같은 식
     (렌즈: ((x/128 − cx)·z + 0.5)·상자폭). 격자는 지도 위·유닛 아래(z 100), 라벨은 맨 위. */
  await page.evaluate(([labels, z, cx, cy, gc, lc]) => {
    const map = document.querySelector(".scr-motion-map"); if (!map) return;
    const r = map.getBoundingClientRect();
    const tile = (r.width * z) / 128;
    const ox = ((0 - cx) * z + 0.5) * r.width; const oy = ((0 - cy) * z + 0.5) * r.height;
    const grid = document.createElement("div");
    grid.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:100;` +
      `background-image:linear-gradient(${gc} 1px,transparent 1px),linear-gradient(90deg,${gc} 1px,transparent 1px);` +
      `background-size:${tile}px ${tile}px;background-position:${ox}px ${oy}px;`;
    map.appendChild(grid);
    const lab = document.createElement("div");
    lab.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:9000;font:9px/1.15 ui-sans-serif,system-ui,sans-serif;${lc};text-align:center;`;
    for (const [t, nv, x, y] of labels) {
      const d = document.createElement("div");
      d.innerHTML = `${t}<br><b style="color:${gc === "rgba(0,0,0,0.16)" ? "#a15c00" : "#ffd76a"}">${nv}</b>`;
      d.style.cssText = `position:absolute;left:${((x / 128 - cx) * z + 0.5) * 100}%;top:${((y / 128 - cy) * z + 0.5) * 100}%;transform:translate(-50%,0);white-space:nowrap;`;
      lab.appendChild(d);
    }
    map.appendChild(lab);
  }, [world.labels, world.zoom, 0.5, world.cy, WHITE ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.16)",
    WHITE ? "color:#111;text-shadow:0 0 3px #fff,0 0 2px #fff" : "color:#fff;text-shadow:0 0 3px #000,0 0 2px #000"]);
  await page.waitForTimeout(300);
  const el = await page.$(".scr-motion-map");
  const file = join(OUT, `scene_${RACE_EN[race]}.png`);
  /* ⚠ DPR 4 에서는 한 장이 4096² 라 요소 스크린샷의 기본 30초 문턱에 걸린다(실측: 저그만 TimeoutError —
     '요소가 안정될 때까지 기다림'에서 끊겼다). 넉넉히 준다. */
  if (el) await el.screenshot({ path: file, timeout: 180000 }); else await page.screenshot({ path: file, timeout: 180000 });
  console.log(`${race}: 건물 ${world.nB} · 유닛 ${world.nU} · span ${world.span.toFixed(1)}타일 · 배율 ${world.zoom.toFixed(2)}배 → ${file}`);
  shots.push({ race, file, world });
  await page.close();
}

/* ── 셋을 가로로 잇는다(프로토스 · 테란 · 저그) ─────────────────────────────── */
if (COMBO_ON && shots.length === 3) {
  const order = COMBO_ORDER.map((r) => shots.find((s9) => s9.race === r)).filter(Boolean);
  if (order.length === 3) {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent('<body style="margin:0"><canvas id="c"></canvas></body>');
    /* 상자 좌표 = ((t/128 − 0.5)·z + 0.5)·판폭 — 격자·라벨을 얹을 때 쓴 그 식이다. */
    const cuts = order.map(({ file, world }) => {
      const half = (RACE_GAP_K * world.gap) / 2;
      return { b64: readFileSync(file).toString("base64"), t0: world.x0 - half, t1: world.x1 + half, z: world.zoom };
    });
    const buf = await page.evaluate(async (cuts9) => {
      const imgs = [];
      for (const c of cuts9) {
        const im = new Image();
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = "data:image/png;base64," + c.b64; });
        imgs.push(im);
      }
      const at = (t, z, W) => ((t / 128 - 0.5) * z + 0.5) * W;
      const boxes = cuts9.map((c, i) => {
        const W = imgs[i].width;
        const x0 = Math.round(at(c.t0, c.z, W)); const x1 = Math.round(at(c.t1, c.z, W));
        return { x0, w: x1 - x0, h: imgs[i].height };
      });
      const cv = document.createElement("canvas");
      cv.width = boxes.reduce((a, b) => a + b.w, 0);
      cv.height = Math.max(...boxes.map((b) => b.h));
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      let x = 0;
      for (let i = 0; i < imgs.length; i += 1) {
        g.drawImage(imgs[i], boxes[i].x0, 0, boxes[i].w, boxes[i].h, x, 0, boxes[i].w, boxes[i].h);
        x += boxes[i].w;
      }
      /* ⚠ 화소 배열을 통째로 넘기면 CDP 가 4백만 칸짜리 JSON 을 싣는다 — base64 글자로 넘긴다. */
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
      return { b64, w: cv.width, h: cv.height };
    }, cuts);
    const file = join(OUT, "scene_all.png");
    writeFileSync(file, Buffer.from(buf.b64, "base64"));
    console.log(`셋: ${buf.w}x${buf.h} → ${file}`);
    await page.close();
  }
}
await browser.close();
rmSync(tdir, { recursive: true, force: true });
rmSync(bdir, { recursive: true, force: true });
