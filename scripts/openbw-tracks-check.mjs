/* 참값 뭉치 규약 자물쇠 — 덤퍼와 해독기가 같은 꼴을 말하고 있나 ─────────────────────
 *
 *   node scripts/openbw-tracks-check.mjs                    합성 검사만 (의존물 없음)
 *   node scripts/openbw-tracks-check.mjs <파일|디렉터리>      구워 둔 뭉치까지 본다
 *   node scripts/openbw-tracks-check.mjs --rep <x.rep>      덤퍼를 돌려 글자와 대조한다
 *   node scripts/openbw-tracks-check.mjs --spec             이 파일이 아는 꼴을 찍는다
 *
 * ── 왜 이 자물쇠가 scplay에 사나 ──────────────────────────────────────────────────
 * 참값 뭉치의 꼴은 **두 저장소가 나눠 쥔 규약**이다: 굽는 쪽은 stargayte-api의
 * openbw/bwdump.cpp, 되읽는 쪽은 여기 src/utils/openbwTracks.ts. 한쪽만 고치면 그
 * 순간부터 화면이 조용히 틀린 값을 읽는다 — 던지지도, 빨개지지도 않는다.
 * 자물쇠는 해독기 **옆**에 두는 것이 맞다. 꼴을 바꾸는 사람은 덤퍼를 고치는 사람이고,
 * 잡아야 할 것은 정확히 "덤퍼를 고쳤는데 해독기를 안 고쳤다"이기 때문이다. api 저장소는
 * 파이썬(pyproject·FastAPI)이라 거기 두면 규약 검사 하나 때문에 node 툴체인이 따라 들어간다.
 *
 * ── 무엇을 잡나 — 켜 세 겹 ────────────────────────────────────────────────────────
 * ① 합성 왕복 (의존물 없음, 늘 돈다)
 *    아래 SPEC이 꼴을 **해독기와 따로** 한 번 더 적는다. 그 서술대로 바이트를 지어
 *    해독기에 먹이고 값이 그대로 나오는지 본다. 두 서술이 갈리는 순간 깨진다 —
 *    곧 "해독기만 고치고 규약을 안 적었다"를 잡는다.
 *    절마다 레코드를 **둘씩** 넣는다: 한 칸이 밀리면 둘째부터 반드시 어긋난다.
 * ② 실제 뭉치 (파일을 줄 때만)
 *    덤퍼가 실제로 구운 것을 읽고 **남은 바이트가 0인지** 본다. 이것이 "덤퍼가 칸을
 *    늘렸는데 해독기가 안 지나갔다"의 가장 이른 신호다 — 앞쪽은 멀쩡히 읽히고 뒤에만
 *    바이트가 남으므로, 그 수를 안 보면 아무도 모른다(해독기의 leftover 주석 참고).
 *    판 번호가 해독기가 아는 범위 밖이면 그것도 여기서 걸린다.
 *
 * ③ 덤퍼 대조 (--rep 를 줄 때만) ← 가장 센 겹
 *    같은 리플레이를 덤퍼로 **두 번** 굽는다: `--tracks`(글자)와 `--tracks --bin`(이진).
 *    글자 쪽은 이 스크립트가 읽고, 이진 쪽은 **앱이 실제로 쓰는 해독기**가 읽어 맞댄다.
 *    ①②는 '해독기가 제 규약과 맞나'를 보지만, 이것만이 **덤퍼가 실제로 뱉는 것**과
 *    맞대므로 "덤퍼가 글자와 이진을 서로 다르게 뱉는다"까지 잡는다.
 *    (원래 stargayte에 살던 자물쇠다 — 해독기 곁으로 옮겨 왔다.)
 *
 * ── 준비물 ────────────────────────────────────────────────────────────────────────
 * ①은 아무것도 안 든다(esbuild는 vite가 끌고 오므로 npm i면 있다).
 * ②의 뭉치는 git에 안 담기는 산출물이라 손으로 갖다 놓는다 — 서버가 내려 주는 base64
 *   글자를 그대로 파일에 넣거나, 압축된 이진 그대로 두면 된다(둘 다 읽는다).
 * ③은 덤퍼 바이너리와 스타 자료가 있어야 한다. **저장소 구조에 안 매이게 환경변수로**
 *   받는다(둘 다 저작물·산출물이라 git에 안 담긴다):
 *     OPENBW_BWDUMP=…/bwdump   OPENBW_DATA=…/data
 *   안 주면 tools/openbw/bwdump · tools/openbw/data를 본다.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ── 꼴 서술 ─────────────────────────────────────────────────────────────────────
   해독기와 **따로** 적는다. 여기가 곧 규약 문서이고, 덤퍼를 고치는 사람이 먼저 보는
   자리다. 판마다 늘어난 칸은 `from`으로 적는다 — 그 판부터 있다는 뜻이다. */
const SPEC = {
  머리: 'char[4] "OBWT" · u8 판 · f32 초당프레임 · i32 믿을프레임(-1 = 끝까지)',
  로스터: "u8 사람수, 사람마다 u8 임자 · u8 리플레이id · u8 종족 · u8 편 · u8 controller"
    + " · u32 개인색 · u8 이름길이 · 이름(UTF-8)",
  트랙표: "u32 트랙수, 트랙마다 u32 태그 · u8 임자 · u16 유닛종류"
    + " · u32 키수 · u32 체력키수 · u32 인터셉터키수 · [판6+] u32 표적키수",
  키흐름: "트랙 차례대로, 키마다 varint(프레임차) · varint(x차) · varint(y차)"
    + " · u8 방향 · u8 상태 · varint(종류차)",
  체력흐름: "키 있는 트랙만, 키마다 varint(프레임차) · varint(값차)",
  인터셉터흐름: "체력흐름과 같은 꼴",
  표적흐름: "[판6+] 키 있는 트랙만, 키마다 varint(프레임차) · u32 태그(차이 아님)",
  업그레이드: "u32 개수, 개마다 varint(프레임차) · u16 id · u8 단계 · u8 사람"
    + " · [판7+] u32 건물태그(0 = 모름)",
  마법: "u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 기술 · u8 사람",
  핑: "u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 사람",
  자원: "u32 개수, 개마다 u8 사람 · varint(그 사람 앞값과의 프레임차) · varint(미네랄차) · varint(가스차)",
  명령: "u32 개수, 개마다 varint(프레임차) · u32 태그 · u16 x · u16 y · u8 갈래",
  APM: "u32 개수 · u16 통크기(프레임), 개마다 varint(통차) · u8 사람 · varint(명령수)",
  자원밭단: "[판4+] u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 단",
  임자바뀜: "[판8] 트랙표 줄 끝에 u8 수, 바뀜마다 u32 프레임(LE) · u8 새 임자 — 마인드 컨트롤·중립화(11). 글자 갈래는 #own\\t태그\\t프레임\\t새임자",
};
/** 해독기가 받아 주어야 할 판 — 이 범위 밖은 물리쳐야 한다. */
const VER_MIN = 8;   // 판 8만(요청: 판 7은 더 이상 안 쓴다 — 폴백 없이)
const VER_MAX = 8;

// ── 바이트 짓기 ────────────────────────────────────────────────────────────────
const u8 = (v) => Buffer.from([v]);
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
/** 7비트 varint + zigzag — 해독기의 varint()와 짝이다(음수도 작게 담긴다). */
const varint = (n) => {
  let z = ((n << 1) ^ (n >> 31)) >>> 0;
  const o = [];
  do { let b = z & 0x7f; z >>>= 7; if (z) b |= 0x80; o.push(b); } while (z);
  return Buffer.from(o);
};
const FPS = 24;
/** 이름을 모르는 업그레이드 번호 — 해독기가 **버리는** 개를 일부러 섞는 데 쓴다. */
const UNK_UP_ID = 60000;

/** SPEC 그대로 한 판을 짓는다. 절마다 레코드가 둘이라 한 칸만 밀려도 둘째가 어긋난다. */
function build(ver) {
  const p = [];
  const head = Buffer.alloc(13);
  head.write("OBWT", 0, "ascii");
  head.writeUInt8(ver, 4);
  head.writeFloatLE(FPS, 5);
  head.writeInt32LE(-1, 9);
  p.push(head);

  // 로스터 둘 — 색 하나는 0xffffffff(모름)로 두어 그 갈래도 함께 본다.
  p.push(u8(2));
  p.push(u8(3), u8(3), u8(1), u8(2), u8(2), u32(0x00703014), u8(4), Buffer.from("kkot"));
  p.push(u8(5), u8(1), u8(2), u8(1), u8(2), u32(0xffffffff), u8(3), Buffer.from("obs"));

  // 트랙 둘 — 첫째는 키 2·체력 2·인터셉터 1·표적 1, 둘째는 키 1뿐(빈 흐름도 지난다).
  p.push(u32(2));
  /* 판 8: 트랙표 줄 끝에 u8 임자바뀜수, 바뀜마다 u32 프레임 · u8 새 임자(덤퍼 실측 바이트: 02 | 2C 01 00 00 04 | 84 03 00 00 0B). */
  p.push(u32(77), u8(3), u16(7), u32(2), u32(2), u32(1), ...(ver >= 6 ? [u32(1)] : []),
    ...(ver >= 8 ? [u8(2), u32(300), u8(4), u32(900), u8(11)] : []));
  p.push(u32(78), u8(5), u16(7), u32(1), u32(0), u32(0), ...(ver >= 6 ? [u32(0)] : []),
    ...(ver >= 8 ? [u8(0)] : []));
  // 키 흐름 — 상태 바이트에 깃발을 실어 판별 갈래(0x80 공사·0x40 공중·0x20 은신)도 본다.
  p.push(varint(48), varint(320), varint(640), u8(0), u8(0x01), varint(7));
  p.push(varint(24), varint(32), varint(0), u8(64), u8(0x40 | 0x01), varint(0));
  p.push(varint(96), varint(160), varint(160), u8(0), u8(0x80 | 0x01), varint(7));
  // 체력 → 인터셉터 → 표적
  p.push(varint(48), varint(60), varint(24), varint(-10));
  p.push(varint(48), varint(4));
  if (ver >= 6) p.push(varint(48), u32(78));

  /* 업그레이드 셋 — 가운데는 **이름을 모르는 번호**다(UNK_UP_ID).
     해독기는 이름 못 붙인 개를 버리는데, 버리더라도 태그 4바이트는 **지나가야** 한다.
     안 지나가면 버린 개 하나 때문에 뒤의 마법·핑·자원·명령이 통째로 밀린다 —
     읽는 것과 담는 것은 다른 일이다. 그 자리를 지키는 것이 이 한 줄이다. */
  p.push(u32(3));                                        // 업그레이드
  p.push(varint(240), u16(0), u8(1), u8(3), ...(ver >= 7 ? [u32(501)] : []));
  p.push(varint(0), u16(UNK_UP_ID), u8(1), u8(3), ...(ver >= 7 ? [u32(503)] : []));
  p.push(varint(240), u16(0), u8(2), u8(3), ...(ver >= 7 ? [u32(502)] : []));
  p.push(u32(2));                                        // 마법
  p.push(varint(120), u16(64), u16(96), u8(0), u8(3));
  p.push(varint(120), u16(96), u16(128), u8(0), u8(5));
  p.push(u32(2));                                        // 핑
  p.push(varint(24), u16(32), u16(64), u8(3));
  p.push(varint(24), u16(64), u16(32), u8(5));
  p.push(u32(2));                                        // 자원 (사람마다 따로 누적된다)
  p.push(u8(3), varint(24), varint(50), varint(0));
  p.push(u8(3), varint(24), varint(-20), varint(8));
  p.push(u32(2));                                        // 명령
  p.push(varint(72), u32(77), u16(96), u16(128), u8(0));
  p.push(varint(24), u32(78), u16(128), u16(96), u8(1));
  p.push(u32(2), u16(120));                              // APM
  p.push(varint(1), u8(3), varint(40));
  p.push(varint(1), u8(5), varint(15));
  if (ver >= 4) {                                        // 자원밭단
    p.push(u32(2));
    p.push(varint(0), u16(32), u16(32), u8(4));
    p.push(varint(24), u16(64), u16(64), u8(2));
  }
  return zlib.deflateSync(Buffer.concat(p)).toString("base64");
}

/** SPEC대로 지은 판이 이렇게 읽혀야 한다 — 해독기의 답을 여기서 한 번 더 적는다. */
function expect(ver, r, fail) {
  const eq = (what, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fail(`${what}: ${JSON.stringify(got)} ← ${JSON.stringify(want)}이어야 한다`);
    }
  };
  eq("판", r.version, ver);
  eq("남은 바이트", r.leftover, 0);
  eq("믿을때까지", r.trustUntil, null);
  eq("로스터 수", r.players.length, 2);
  eq("로스터[0]", r.players[0],
    { owner: 3, pid: 3, race: 1, force: 2, controller: 2, color: "#703014", name: "kkot" });
  // 0xffffffff는 '색 아님' — 빈 글자여야 부르는 쪽이 팀색으로 떨어진다.
  eq("로스터[1].color(모름)", r.players[1].color, "");
  eq("트랙 수", r.tracks.length, 2);

  const [a, b] = r.tracks;
  eq("트랙0 태그·임자·종류", [a.tag, a.owner, a.kind], [77, 3, "SCV"]);
  eq("트랙0 born", a.born, 2);
  // 키 둘 — 자리는 차이 누적을 타일로(÷32), 방향은 0~255를 도(度)로.
  // 자리 형식(2026-09): kt(초) · kxy(픽셀 Int16) · kh(방향 바이트) · kst(상태) — 접근자 없이 직접 읽어 견준다.
  const kx = (tr, i) => tr.kxy[i * 2] / 32, ky = (tr, i) => tr.kxy[i * 2 + 1] / 32, kh = (tr, i) => (tr.kh[i] * 360) / 256;
  eq("트랙0 키0 (t,x,y,방향)", [a.kt[0], kx(a, 0), ky(a, 0), kh(a, 0)], [2, 10, 20, 0]);
  eq("트랙0 키1 (t,x,y,방향)", [a.kt[1], kx(a, 1), ky(a, 1), kh(a, 1)], [3, 11, 20, 90]);
  eq("트랙0 done(0x80 없음)", [...a.done], [1, 1]);
  if (ver >= 3) eq("트랙0 air(0x40)", [...(a.air ?? [])], [0, 1]);
  else eq("트랙0 air(판2엔 없다)", a.air, undefined);
  if (ver >= 5) eq("트랙0 cloak", [...(a.cloak ?? [])], [0, 0]);
  // 변곡점은 평평한 형식 배열 [초, 값, 초, 값, …]이다.
  eq("트랙0 체력", [...a.hp], [2, 60, 3, 50]);
  eq("트랙0 인터셉터", [...a.ic], [2, 4]);
  if (ver >= 6) eq("트랙0 표적", [...a.tgt], [2, 78]);
  if (ver >= 8) {
    eq("트랙0 임자바뀜", a.own, [{ t: 300 / FPS, owner: 4 }, { t: 900 / FPS, owner: 11 }]);
    eq("트랙1 임자바뀜(없음)", b.own, []);
  }
  eq("트랙1 done(0x80 있음 → 공사중)", [...b.done], [0]);

  // 셋을 넣었지만 가운데(이름 모름)는 버려져 둘만 남는다 — 뒤 절은 안 밀려야 한다.
  eq("업그레이드(이름 모르는 개는 버린다)", r.ups,
    [[10, "Terran Infantry Armor", 3, ver >= 7 ? 501 : 0],
      [20, "Terran Infantry Armor 2", 3, ver >= 7 ? 502 : 0]]);
  eq("마법 수", r.casts.length, 2);
  eq("마법[1] (초,x,y,사람)", [r.casts[1][0], r.casts[1][1], r.casts[1][2], r.casts[1][4]],
    [10, 3, 4, 5]);
  eq("핑", r.pings, [[1, 1, 2, 3], [2, 2, 1, 5]]);
  eq("자원(사람 3)", r.res.get(3), [[1, 50, 0], [2, 30, 8]]);
  eq("명령(태그 77)", r.orders.get(77), [[3, 3, 4, 0]]);
  eq("명령(태그 78)", r.orders.get(78), [[4, 4, 3, 1]]);
  eq("APM 통(초)", r.apmBucketSec, 5);
  eq("APM(사람 3)", r.apm.get(3), [[5, 40]]);
  eq("자원밭단", r.resFields, ver >= 4 ? [[0, 1, 1, 4], [1, 2, 2, 2]] : []);
}

// ── 해독기 불러오기 ────────────────────────────────────────────────────────────
/* 해독기는 TS라 그대로 못 부른다 — esbuild로 한 벌 묶어 임시 파일에서 읽는다.
   esbuild는 vite가 끌고 오므로 npm i만 돼 있으면 있다. */
async function loadDecoder() {
  const dir = mkdtempSync(join(tmpdir(), "obwt-"));
  const src = join(dir, "entry.ts");
  const out = join(dir, "entry.mjs");
  /* 업그레이드 이름표도 함께 낸다 — 글자 쪽을 거를 때 **해독기와 똑같은 자**를 써야
     한다(둘 다 ""를 '이름 없음'으로 본다). 베낀 표로 거르면 자물쇠가 안 된다. */
  writeFileSync(src,
    `export { decodeTruthTracks } from ${JSON.stringify(join(ROOT, "src/utils/openbwTracks"))};
`
    + `export { bwUpgradeName } from ${JSON.stringify(join(ROOT, "src/utils/bwUpgradeNames"))};
`);
  try {
    execFileSync(process.execPath,
      [join(ROOT, "node_modules", "esbuild", "bin", "esbuild"), src,
        "--bundle", "--format=esm", "--platform=node", `--outfile=${out}`, "--log-level=warning"],
      { stdio: ["ignore", "inherit", "inherit"] });
  } catch {
    console.error("✗ esbuild를 못 돌렸다 — 먼저 `npm i`로 의존물을 받아야 한다.");
    process.exit(2);
  }
  const mod = await import(pathToFileURL(out).href);
  return { decode: mod.decodeTruthTracks, upName: mod.bwUpgradeName,
    cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** 파일 하나를 base64 글자로 — 오는 꼴 셋을 다 받는다.
 *
 *  ① 압축 이진 그대로(zlib 머리 0x78)
 *  ② base64 글자만
 *  ③ **서버 응답 JSON 그대로**(`{ "motion": "eNr…" }`) — 실제로 이 꼴로 손에 들어온다.
 *    사람더러 따옴표를 벗겨 넣으라고 하면 그 자리에서 한 번 더 틀린다. */
function asB64(file) {
  const buf = readFileSync(file);
  if (buf[0] === 0x78) return buf.toString("base64");
  const txt = buf.toString("utf8").trim();
  if (txt[0] === "{" || txt[0] === "[") {
    try {
      const j = JSON.parse(txt);
      const pick = (o) => {
        if (typeof o === "string") return o;
        if (!o || typeof o !== "object") return null;
        for (const k of ["motion", "tracks", "data", "b64"]) {
          if (typeof o[k] === "string") return o[k];
        }
        for (const v of Object.values(o)) { const g = pick(v); if (g) return g; }
        return null;
      };
      const got = pick(j);
      if (got) return got.replace(/\s+/g, "");
    } catch { /* JSON이 아니면 아래 글자 길로 */ }
  }
  return txt.replace(/\s+/g, "");
}

/* ── ③ 덤퍼 대조 — 글자 갈래 읽기 ────────────────────────────────────────────────
   `bwdump --tracks`가 뱉는 줄들이다. '#'로 시작하면 판 전체에 관한 것이고, 아니면
   키 한 줄이다. 칸 차례는 덤퍼(stargayte-api의 openbw/bwdump.cpp)가 정한다 —
   여기 적힌 것이 곧 그 규약의 글자 쪽 사본이다. */
const TSV = {
  "키줄": "프레임 · 태그 · (안 씀) · 종류 · x · y · 방향 · 상태",
  "#trust": "믿을프레임",
  "#player": "임자 · 리플레이id · 종족 · 편 · controller · 색 · 이름",
  "#hp /#ic /#tgt": "태그 · 프레임 · 값",
  "#up": "프레임 · id · 단계 · 사람 · [판7+] 건물태그",
  "#cast": "프레임 · x · y · 기술 · 사람",
  "#ping": "프레임 · x · y · 사람",
  "#res": "(수만 견준다 — 칸 차례를 이 저장소가 모른다)",
  "#apm": "(수만 견준다)",
};
/* 지도 자원(미네랄·가스)은 이진 쪽에 안 실린다 — 앱이 지도에서 직접 그린다.
   글자 쪽에서도 같은 종류를 빼야 트랙 수가 맞는다. */
const RES_TYPES = new Set([176, 177, 178, 188, 214]);

function readText(text) {
  const byTag = new Map();
  const hp = new Map(), ic = new Map(), tgt = new Map(), own = new Map();
  const up = [], cast = [], ping = [], player = [], res = [], apm = [];
  let trust = -1;
  const typeOfTag = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    if (line[0] === "#") {
      const p = line.split("\t");
      if (p[0] === "#trust") trust = Number(p[1]);
      else if (p[0] === "#player") player.push(p.slice(1));
      else if (p[0] === "#hp" || p[0] === "#ic" || p[0] === "#tgt") {
        const m = p[0] === "#hp" ? hp : p[0] === "#ic" ? ic : tgt;
        const tg = Number(p[1]);
        if (!m.has(tg)) m.set(tg, []);
        m.get(tg).push([Number(p[2]), Number(p[3])]);
      } else if (p[0] === "#own") {                 // 판 8: #own\t태그\t프레임\t새임자
        const tg = Number(p[1]);
        if (!own.has(tg)) own.set(tg, []);
        own.get(tg).push([Number(p[2]), Number(p[3])]);
      } else if (p[0] === "#up") up.push(p.slice(1).map(Number));
      else if (p[0] === "#cast") cast.push(p.slice(1).map(Number));
      else if (p[0] === "#ping") ping.push(p.slice(1).map(Number));
      else if (p[0] === "#res") res.push(p.slice(1).map(Number));
      else if (p[0] === "#apm") apm.push(p.slice(1).map(Number));
      continue;
    }
    if (line[0] === "f") continue;             // 머리글 줄
    const [frame, tag, , type, x, y, head, state] = line.split("\t").map(Number);
    if (!typeOfTag.has(tag)) typeOfTag.set(tag, type);
    let a = byTag.get(tag);
    if (!a) { a = []; byTag.set(tag, a); }
    a.push([frame, x, y, head, state, type]);
  }
  for (const [tag, ty] of typeOfTag) if (RES_TYPES.has(ty)) byTag.delete(tag);
  return { byTag, hp, ic, tgt, own, up, cast, ping, player, res, apm, trust };
}

/** 이진 머리에서 초당프레임을 곧장 읽는다 — 상수로 못 박으면 덤퍼가 바꿀 때 조용히 어긋난다. */
const fpsOf = (bin) => zlib.inflateSync(bin).readFloatLE(5);

function compare(bin, txt, decoded, upName, fail) {
  const fps = fpsOf(bin);
  const near = (got, want, tol) => Math.abs(got - want) <= tol;
  const T = 1e-3;          // 시각 — 프레임 → 초로 나누며 생기는 반올림
  const XY = 1 / 64;       // 자리 — 픽셀 → 타일(÷32)

  if (decoded.leftover !== 0) fail(`남은 바이트 ${decoded.leftover} — 해독기가 끝까지 안 읽었다`);
  if (decoded.tracks.length !== txt.byTag.size) {
    fail(`트랙 수 이진 ${decoded.tracks.length} vs 글자 ${txt.byTag.size}`);
  }
  const trustBin = decoded.trustUntil === null ? -1 : Math.round(decoded.trustUntil * fps);
  if (Math.abs(trustBin - txt.trust) > 1) fail(`믿을프레임 ${trustBin} vs ${txt.trust}`);

  let keys = 0;
  for (const tr of decoded.tracks) {
    const a = txt.byTag.get(tr.tag);
    if (!a) { fail(`이진에만 있는 태그 ${tr.tag}`); continue; }
    const n = tr.kt.length;
    if (n !== a.length) { fail(`태그 ${tr.tag} 키 ${n} vs ${a.length}`); continue; }
    for (let i = 0; i < n; i += 1) {
      const [frame, x, y, head, state, type] = a[i];
      if (!near(tr.kt[i], frame / fps, T)) { fail(`태그 ${tr.tag} 키 ${i} 시각`); break; }
      if (!near(tr.kxy[i * 2] / 32, x / 32, XY)) { fail(`태그 ${tr.tag} 키 ${i} x`); break; }
      if (!near(tr.kxy[i * 2 + 1] / 32, y / 32, XY)) { fail(`태그 ${tr.tag} 키 ${i} y`); break; }
      if (!near((tr.kh[i] * 360) / 256, (head * 360) / 256, 1e-2)) { fail(`태그 ${tr.tag} 키 ${i} 방향`); break; }
      /* 상태는 낮은 네 자리뿐이다 — 그 위는 깃발(0x80 공사·0x40 공중·0x20 은신)이라
         해독기가 따로 떼어 done·air·cloak에 담는다. 글자 쪽은 한 바이트 그대로다. */
      if (tr.kst[i] !== (state & 0x0f)) { fail(`태그 ${tr.tag} 키 ${i} 상태`); break; }
      if (tr.done[i] !== (state & 0x80 ? 0 : 1)) { fail(`태그 ${tr.tag} 키 ${i} 완성`); break; }
      if (tr.air && tr.air[i] !== (state & 0x40 ? 1 : 0)) { fail(`태그 ${tr.tag} 키 ${i} 공중`); break; }
      if (tr.cloak && tr.cloak[i] !== (state & 0x20 ? 1 : 0)) { fail(`태그 ${tr.tag} 키 ${i} 은신`); break; }
      if (tr.types[i] !== type) { fail(`태그 ${tr.tag} 키 ${i} 종류 ${tr.types[i]} vs ${type}`); break; }
    }
    keys += n;
    /* 임자바뀜(판 8) — 이진의 own(초·임자)과 글자의 #own(프레임·임자)을 견준다. */
    {
      const ow = txt.own.get(tr.tag) ?? [];
      const og = tr.own ?? [];
      if (og.length !== ow.length) fail(`태그 ${tr.tag} 임자바뀜 ${og.length} vs ${ow.length}`);
      else og.forEach((o, i) => {
        if (!near(o.t, ow[i][0] / fps, T) || o.owner !== ow[i][1]) fail(`태그 ${tr.tag} 임자바뀜 ${i}`);
      });
    }
    /* 체력·인터셉터·표적은 자리 키와 **따로** 실려 온다 — 차례가 한 칸만 밀려도 엉뚱한
       유닛의 체력이 붙는다. 그 어긋남은 화면에서 눈에 잘 안 띈다. */
    for (const [nm, got, want] of [["체력", tr.hp, txt.hp.get(tr.tag)],
      ["인터셉터", tr.ic, txt.ic.get(tr.tag)], ["표적", tr.tgt, txt.tgt.get(tr.tag)]]) {
      const gn = (got?.length ?? 0) >> 1, wn = want?.length ?? 0;
      if (gn !== wn) { fail(`태그 ${tr.tag} ${nm} 키 ${gn} vs ${wn}`); continue; }
      for (let i = 0; i < gn; i += 1) {
        if (!near(got[i * 2], want[i][0] / fps, T) || got[i * 2 + 1] !== want[i][1]) {
          fail(`태그 ${tr.tag} ${nm} 키 ${i}`); break;
        }
      }
    }
  }

  if (decoded.players.length !== txt.player.length) {
    fail(`사람 ${decoded.players.length} vs ${txt.player.length}`);
  }
  decoded.players.forEach((pl, i) => {
    const w = txt.player[i];
    if (!w) return;
    if (pl.owner !== Number(w[0]) || pl.pid !== Number(w[1]) || pl.race !== Number(w[2])
      || pl.force !== Number(w[3]) || pl.controller !== Number(w[4])) fail(`사람 ${i} 값`);
    // 색은 번호 → 팔레트라 글자 쪽 수와 직접 못 견준다. 꼴만 본다("" = 모름도 옳다).
    if (pl.color !== "" && !/^#[0-9a-f]{6}$/.test(pl.color)) fail(`사람 ${i} 색 ${pl.color}`);
    if (pl.name !== w[6]) fail(`사람 ${i} 이름 ${pl.name} vs ${w[6]}`);
  });

  /* 업그레이드 — 해독기는 이름 못 붙인 번호를 **버리므로** 수가 줄 수 있다. 견줄 때도
     같은 자로 걸러 낸다(bwUpgradeName이 ""를 주는 개 = 해독기의 `if (nm)`이 버리는 개).
     ★ 버리는 것과 **읽는 것**은 다른 일이다 — 덤퍼가 붙인 태그 4바이트는 버려지는 개
       에서도 지나가야 한다. 그 자리가 밀리면 아래 마법·핑 수부터 어긋나 여기서 잡힌다. */
  const upWant = txt.up.filter(([, id]) => upName(id) !== "");
  if (decoded.ups.length !== upWant.length) fail(`업그레이드 ${decoded.ups.length} vs ${upWant.length}`);
  decoded.ups.forEach((u, i) => {
    const w = upWant[i];
    if (!w) return;
    const nm = upName(w[1]);
    if (!near(u[0], w[0] / fps, T) || u[2] !== w[3]
      || u[1] !== (w[2] > 1 ? `${nm} ${w[2]}` : nm)) fail(`업그레이드 ${i}`);
    /* 건물태그(판 7) — 글자 갈래에도 칸이 하나 늘었다. 옛 덤프에는 그 칸이 없으므로
       (w[4]가 undefined) 있을 때만 견준다: 없는 것을 틀렸다고 하면 안 된다. */
    if (w[4] !== undefined && u[3] !== w[4]) fail(`업그레이드 ${i} 태그 ${u[3]} vs ${w[4]}`);
  });

  if (decoded.casts.length !== txt.cast.length) fail(`마법 ${decoded.casts.length} vs ${txt.cast.length}`);
  decoded.casts.forEach((c9, i) => {
    const w = txt.cast[i];
    if (!w) return;
    if (!near(c9[0], w[0] / fps, T) || !near(c9[1], w[1] / 32, XY)
      || !near(c9[2], w[2] / 32, XY) || c9[4] !== w[4]) fail(`마법 ${i}`);
  });
  if (decoded.pings.length !== txt.ping.length) fail(`핑 ${decoded.pings.length} vs ${txt.ping.length}`);
  decoded.pings.forEach((g9, i) => {
    const w = txt.ping[i];
    if (!w) return;
    if (!near(g9[0], w[0] / fps, T) || !near(g9[1], w[1] / 32, XY)
      || !near(g9[2], w[2] / 32, XY) || g9[3] !== w[3]) fail(`핑 ${i}`);
  });
  /* 자원·APM은 **수만** 견준다 — 글자 쪽 칸 차례를 이 저장소가 모른다(위 TSV 표).
     그래도 수는 값진 자다: 앞 절이 한 칸 밀리면 여기 수부터 무너진다. */
  const resN = [...decoded.res.values()].reduce((n, a) => n + a.length, 0);
  const apmN = [...decoded.apm.values()].reduce((n, a) => n + a.length, 0);
  if (resN !== txt.res.length) fail(`자원 ${resN} vs ${txt.res.length}`);
  if (apmN !== txt.apm.length) fail(`APM통 ${apmN} vs ${txt.apm.length}`);
  return { keys, fps };
}

// ── 굴리기 ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--spec")) {
  console.log(`참값 뭉치 꼴 — 판 ${VER_MIN}~${VER_MAX} (전체 = zlib(아래 바이트열), 작은 끝)\n`);
  for (const [k, v] of Object.entries(SPEC)) console.log(`  ${k.padEnd(7)} ${v}`);
  console.log("\n글자(TSV) 갈래 — bwdump --tracks\n");
  for (const [k, v] of Object.entries(TSV)) console.log(`  ${k.padEnd(16)} ${v}`);
  process.exit(0);
}
const flagAt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const rep = flagAt("--rep");
const step = flagAt("--step") ?? "3";
const taken = new Set([rep, flagAt("--step")].filter(Boolean));

const { decode, upName, cleanup } = await loadDecoder();
let bad = 0;
const fail = (m) => { console.log(`   ✗ ${m}`); bad += 1; };

console.log("① 합성 왕복 — 이 파일이 적은 꼴과 해독기가 같은 말을 하나");
for (let ver = VER_MIN; ver <= VER_MAX; ver += 1) {
  const before = bad;
  const r = await decode(build(ver));
  if (!r) fail(`판 ${ver}: 해독기가 null을 냈다 (받아 주어야 하는 판이다)`);
  else expect(ver, r, (m) => fail(`판 ${ver} — ${m}`));
  if (bad === before) console.log(`   ✔ 판 ${ver}`);
}
/* 범위 밖은 **물리쳐야** 한다 — 덤퍼가 판만 올리고 여기를 안 고쳤을 때, 조용히 옛 꼴로
   읽어 버리는 것보다 못 읽는다고 말하는 편이 낫다(그래야 '재분석 필요'로 드러난다). */
for (const ver of [VER_MIN - 1, VER_MAX + 1]) {
  if (await decode(build(ver)) !== null) fail(`판 ${ver}: 물리쳐야 하는데 받아 버렸다`);
  else console.log(`   ✔ 판 ${ver} 물리침`);
}

const files = [];
for (const a of args) {
  if (a.startsWith("--") || taken.has(a)) continue;
  const p = resolve(a);
  if (statSync(p).isDirectory()) for (const f of readdirSync(p)) files.push(join(p, f));
  else files.push(p);
}
if (files.length === 0) {
  console.log("\n② 구워 둔 뭉치 — 건너뜀 (파일이나 디렉터리를 인자로 주면 본다)");
} else {
  console.log(`\n② 구워 둔 뭉치 ${files.length}개 — 덤퍼가 구운 것을 끝까지 읽나`);
  for (const f of files) {
    let r = null;
    try { r = await decode(asB64(f)); } catch (e) { fail(`${f}: 못 읽었다 — ${e.message}`); continue; }
    if (!r) { fail(`${f}: 해독기가 null을 냈다 (판이 ${VER_MIN}~${VER_MAX} 밖이거나 꼴이 낯설다)`); continue; }
    /* 체력·표적 키를 따로 센다 — 화면의 '체력바가 안 깎인다' · '트레이서가 안 나간다'는
       대개 이 둘이 비어서다. 뭉치를 열어 보지 않고는 덤퍼 탓인지 그리기 탓인지 못 가른다. */
    const hpN = r.tracks.reduce((s, tr) => s + ((tr.hp?.length ?? 0) >> 1), 0);
    const hpTr = r.tracks.filter((tr) => (tr.hp?.length ?? 0) > 0).length;
    const tgN = r.tracks.reduce((s, tr) => s + ((tr.tgt?.length ?? 0) >> 1), 0);
    const tgTr = r.tracks.filter((tr) => (tr.tgt?.length ?? 0) > 0).length;
    const cen = `판 ${r.version} · 트랙 ${r.tracks.length} · 사람 ${r.players.length}`
      + ` · 업글 ${r.ups.length} · 마법 ${r.casts.length} · 핑 ${r.pings.length}`
      + ` · 명령 ${[...r.orders.values()].reduce((s, v) => s + v.length, 0)}`
      + ` · 자원밭 ${r.resFields.length}`
      + `
      체력키 ${hpN} (트랙 ${hpTr}/${r.tracks.length})`
      + ` · 표적키 ${tgN} (트랙 ${tgTr}/${r.tracks.length})`;
    if (r.leftover !== 0) {
      fail(`${f}: **남은 바이트 ${r.leftover}** — 덤퍼가 칸을 늘렸는데 해독기가 안 지나갔다. ${cen}`);
    } else {
      console.log(`   ✔ ${f}  ${cen}`);
      const noTag = r.ups.filter(([, , , g]) => !g).length;
      if (r.version >= 7 && noTag > 0) {
        console.log(`      · 건물태그 없는 업그레이드 ${noTag}/${r.ups.length} (덤퍼가 못 짚은 몫)`);
      }
    }
  }
}

if (!rep) {
  console.log("\n③ 덤퍼 대조 — 건너뜀 (--rep <x.rep> 을 주면 본다)");
} else {
  const BWDUMP = process.env.OPENBW_BWDUMP ?? join(ROOT, "tools", "openbw", "bwdump");
  const BWDATA = process.env.OPENBW_DATA ?? join(ROOT, "tools", "openbw", "data");
  const missing = [BWDUMP, BWDATA].filter((x) => !existsSync(x));
  if (missing.length > 0) {
    console.log(`\n③ 덤퍼 대조 — 못 돈다: ${missing.join(" · ")} 이(가) 없다`);
    console.log("   덤퍼와 자료는 git에 안 담긴다(빌드 산출물·저작물) — 손으로 갖다 놓거나");
    console.log("   OPENBW_BWDUMP · OPENBW_DATA 로 자리를 일러 준다.");
    bad += 1;
  } else {
    console.log(`\n③ 덤퍼 대조 — ${rep} 를 글자와 이진으로 각각 구워 맞댄다`);
    const run = (extra) => execFileSync(BWDUMP, [BWDATA, rep, step, "--tracks", ...extra],
      { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "pipe"] });
    const txt = readText(run([]).toString());
    const bin = run(["--bin"]);
    const dec = await decode(bin.toString("base64"));
    if (!dec) fail("이진 트랙을 못 풀었다 — 판이 해독기 범위 밖일 수 있다");
    else {
      const before = bad;
      const { keys, fps } = compare(bin, txt, dec, upName, fail);
      const b64 = Math.ceil(bin.length / 3) * 4;
      console.log(`   판 ${dec.version} · ${fps.toFixed(2)}fps · 트랙 ${dec.tracks.length}개 · 키 ${keys}개`);
      console.log(`   사람 ${dec.players.length} · 업글 ${dec.ups.length} · 마법 ${dec.casts.length}`
        + ` · 핑 ${dec.pings.length} · 자원 ${[...dec.res.values()].reduce((n, a) => n + a.length, 0)}`);
      console.log(`   이진 ${(bin.length / 1048576).toFixed(2)}MB · base64 ${(b64 / 1048576).toFixed(2)}MB (서버 상한 12MB)`);
      console.log(`   믿을 수 있는 구간: ${dec.trustUntil === null ? "끝까지" : `0 ~ ${(dec.trustUntil / 60).toFixed(1)}분`}`);
      if (bad === before) console.log("   ✔ 이진과 글자가 한 자리도 안 틀린다");
    }
  }
}

cleanup();
console.log(bad === 0 ? "\n✔ 규약 어긋남 없음" : `\n✗ 어긋남 ${bad}건`);
process.exit(bad === 0 ? 0 : 1);
