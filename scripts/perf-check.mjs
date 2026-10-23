/* 재생기 프레임 부하 계측 CLI(요청: "어디서 부하가 걸리는지 분석해보고 줄여보자") ──
 *
 *   node scripts/perf-check.mjs                     기본(5인 · 유닛 600 · CPU 4배 조임)
 *   node scripts/perf-check.mjs --cpu 6 --secs 8
 *   node scripts/perf-check.mjs --units 80          한 사람당 유닛 수
 *   node scripts/perf-check.mjs --wide              PC 화면(1280)으로
 *   node scripts/perf-check.mjs --mc --players 3    마인드 컨트롤(임자 바뀜 · 판 8) — 인구 칸의 종족 풀 덧줄 검산
 *   node scripts/perf-check.mjs --marks --info --players 3 --track 정구 --diag [--herocolor] [--ringprobe 10]   핑·클릭 마커·선택 링의 색(화면 주인 제 것 원작 초록 ·
 *                                                                               같은 편은 색 모드 · 주인 있으면 주인 클릭·링만) — [자국]·[링]·[링 폭](시간에 따른 폭 흔들림)
 *   node scripts/perf-check.mjs --ios --players 2 --dmg --glblit --split x.png   폰 분할 칸의 두 줄 현황(데미지 칸에 값 — 판 13 데미지 절 합성)
 *   node scripts/perf-check.mjs --wide --press ".scr-kakao-share-btn" --shot x.png   그 요소를 눌러 둔 채(:active) 찍는다(크리스탈 단추 누름 꼴 · 2026-10-23)
 *   node scripts/perf-check.mjs --wide --ask 30 [--light] --shot x.png   (--light = 앱 라이트 테마 깃발 · 판 꼴: 다크 홀로그램 / 라이트 클레이 메탈)   보기 모드 판(요약 · 풀 · 2026-10-23 · 꼴은 무작위 — --theme 로 못 박는다) — 링크 없이 열어 판을 찍고 [요약]을 눌러 N초 동안
 *                                                                               요약 알약(n/N)·시계·배속을 찍는다(창 사이 건너뜀 · 마지막 창 끝 멈춤 검산)
 *   node scripts/perf-check.mjs --wide --vw 1920 --vh 1080 --glblit --shot x.png   해상도 단([UI단] 줄 · PC 는 창 세로: 1080 FHD 0.75 · 1440 QHD 1 ·
 *                                                                               2160 UHD 1.5 · 폰은 기기 짧은 변: --ios --vw 430 --vh 932 큰 폰 1.1 ·
 *                                                                               --vw 755 --vh 905 폴드 1.3 · --vw/--vh 없는 PC 돌림은 ui=1 로 못 박는다)
 *
 * 무엇을 재는가 — **실제 컴포넌트를 실제로 돌린다.** 참값 자취(OBWT 판 4)를 여기서
 * 합성해 ReplayMotionPlayer에 그대로 물리고, 폰 크기 화면 + CPU 조임(CDP)에서 재생을
 * 켠 채 두 가지를 뜬다:
 *   ① 프레임 시간 분포(rAF 간격) — p50·p95·최악. 33ms를 넘으면 그 프레임은 밀린 것이다.
 *   ② CPU 표본 프로파일(CDP Profiler) — 자기 시간(self time) 상위 함수. 어느 코드가
 *      프레임을 먹는지 이름으로 나온다(번들을 안 줄이므로 함수 이름이 산다).
 * 합성 세계는 스크린샷의 후반전 꼴을 흉내 낸다: 사람 다섯, 일꾼 뭉치 + 궤도를 도는
 * 병력 + 가운데 난전(FIGHT 상태 + 체력 하강 = 트레이서·불티 갈래까지 태운다).
 *
 * ⚠ 합성이므로 절대값은 기기와 다르다 — 보는 것은 **비율**(어디가 몇 %인가)이다. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes(n);
/* --tagprobe — 독 미니맵의 이름표(.scr-fs-minitag · 2026-10-09)를 찍는다: 이름 · 자리(%) · 크기 단 · 어두움 · 화면 폭. 독 미니맵 판(.scr-fs-minipanel)의 네모도. */
const tagProbe9 = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [+b.left.toFixed(0), +b.top.toFixed(0), +b.width.toFixed(0), +b.height.toFixed(0)]; };
  const mm = document.querySelector(".scr-fs-minipanel .scr-fs-minimap");
  const tags = [...document.querySelectorAll(".scr-fs-minipanel .scr-fs-minitag")].map((el) => ({
    n: el.textContent, l: el.style.left, t: el.style.top, k: el.className.replace("scr-fs-minitag", "").trim(), w: r(el)[2], h: r(el)[3],
    fs: getComputedStyle(el).fontSize,
  }));
  return JSON.stringify({ mini: mm ? r(mm) : null, panel: document.querySelector(".scr-fs-minipanel") ? r(document.querySelector(".scr-fs-minipanel")) : null, roster: document.querySelector(".scr-fs-rosterpanel") ? r(document.querySelector(".scr-fs-rosterpanel")) : null, info: document.querySelector(".scr-motion-infodock") ? r(document.querySelector(".scr-motion-infodock")) : null, tags });
});
/* --capprobe [atk|def|war] — 단독 중계 화면에 가짜 중계 자막(.scr-cast-caption · 2026-10-09)을 입혀 찍는다(합성 세계는 맞대결 장면을 못 낸다 · 사진용). */
const capProbe9 = async (page) => {
  const role = String(flag("--capprobe", "atk") || "atk");
  await page.evaluate((role) => {
    const solo = document.querySelector(".scr-fs-solo");
    if (!solo) return;
    solo.querySelectorAll(".scr-cast-caption").forEach((el) => el.remove());   // 진짜 자막(중계가 낸 것)은 걷고 가짜만(2026-10-12 — 둘이 겹쳐 찍혔다)
    const cap = document.createElement("span");
    cap.className = "scr-cast-caption";
    /* 사람은 이름표 칩(.scr-cast-chip · 2026-10-09 · 2026-10-12 칩 되물림) — 재생기 castCap9 와 같은 꼴(글자 칸 + 팀 배지). long 은 줄바꿈 검산. */
    const chip = (nm, bg, fg, tm) => `<span class="scr-split-chip scr-cast-chip scr-truby-host" style="background:${bg};color:${fg}"><span class="scr-truby" style="background:${tm === 1 ? "#2050d0" : "#d81f28"}">${tm}팀</span><span class="scr-cast-chip-txt">${nm}</span></span>`;   // 팀 = 칩 밖 왼위 루비(2026-10-19)
    const J = chip("정구", "#2b62e8", "#fff", 1); const R = chip("Rex", "#e07b1a", "#111", 1); const S = chip("수달이", "#c9c9a3", "#111", 2); const T = chip("타센", "#8a3fb8", "#fff", 2);
    cap.innerHTML = role === "def" ? `${R}가 공격함 · ${S}가 헬프옴` : role === "war" ? `${J}${S} vs ${R}${T} 교전`   // 칩 사이 점 없음(2026-10-10)
      : role === "long" ? `${J}의 ${R} 사이언스 퍼실리티 파괴 · ${S}가 헬프옴 · ${T} 메타볼릭 부스트 개발` : `${J}의 ${R} 공격`;
    solo.appendChild(cap);
  }, role);
  await page.waitForTimeout(500);
  console.log("[자막]", await page.evaluate(() => {
    const el = document.querySelector(".scr-cast-caption"); const tag = document.querySelector(".scr-fs-solo-cap");
    const r = (e) => { const b = e.getBoundingClientRect(); return [+b.left.toFixed(0), +b.top.toFixed(0), +b.width.toFixed(0), +b.height.toFixed(0)]; };
    return el ? JSON.stringify({ cap: r(el), tag: tag ? r(tag) : null, fs: getComputedStyle(el).fontSize, text: el.textContent }) : "없음";
  }));
};

const CPU = Number(flag("--cpu", 4));          // CDP CPU 조임 배수 — 중급 폰 흉내
const SECS = Number(flag("--secs", 8));        // 표본 시간(초)
const UNITS = Number(flag("--units", 120));    // 한 사람당 유닛 수(일꾼+병력)
const WIDE = has("--wide");                    // PC 폭으로(기본은 폰 390×844)
const PROFILE = !has("--no-profile");
/** 감싸개 클래스(--wrap) — 예: scr-activity-detail-full · scr-activity-group-page. */
const WRAP = String(flag("--wrap", ""));

/** --res 의 자원(2026-10-12) — [타일 x, 타일 y, 가스 1] · 정구 본진(18,18) 왼쪽 미네랄 셋 + 제 간헐천(home + 4). */
const RES_EXTRA9 = [[11, 14, 0], [11, 17, 0], [11, 20, 0], [22, 22, 1], [52, 76, 0]];   // 끝의 (52,76) — 개인 화면(46초 난전 자리)에 걸리는 우클릭 표적
/* ── OBWT 판 4 합성 ──────────────────────────────────────────────────────────── */

/** 작은 끝 쓰기 + zigzag varint — openbwTracks.ts 의 Cursor 와 짝. varint는 **전부**
 *  zigzag다(체력·명령의 프레임차도 읽는 쪽이 같은 varint()로 푼다). */
class W {
  constructor() { this.b = Buffer.alloc(1 << 20); this.p = 0; }
  need(n) { if (this.p + n > this.b.length) { const nb = Buffer.alloc(this.b.length * 2 + n); this.b.copy(nb); this.b = nb; } }
  u8(v) { this.need(1); this.b[this.p++] = v & 0xff; }
  u16(v) { this.need(2); this.b.writeUInt16LE(v & 0xffff, this.p); this.p += 2; }
  u32(v) { this.need(4); this.b.writeUInt32LE(v >>> 0, this.p); this.p += 4; }
  i32(v) { this.need(4); this.b.writeInt32LE(v | 0, this.p); this.p += 4; }
  f32(v) { this.need(4); this.b.writeFloatLE(v, this.p); this.p += 4; }
  str(s) { const u = Buffer.from(s, "utf8"); this.u8(u.length); this.need(u.length); u.copy(this.b, this.p); this.p += u.length; }
  vz(v) { // zigzag varint
    let z = ((v << 1) ^ (v >> 31)) >>> 0;
    this.need(5);
    for (;;) { const c = z & 0x7f; z >>>= 7; if (z) this.b[this.p++] = c | 0x80; else { this.b[this.p++] = c; break; } }
  }
  out() { return this.b.subarray(0, this.p); }
}

const FPS = 23.81;
const F = (sec) => Math.round(sec * FPS);
const MAP = 128;                      // 타일
const GAME_SEC = 120;                 // 합성 경기 길이

// 유닛 종류 번호(bwUnitNames.ts) — 종족 섞어 셋.
const T = { SCV: 7, Marine: 0, Vulture: 2, Goliath: 3, Tank: 5, TankSiege: 30, Wraith: 8, CC: 106, Depot: 109, Rax: 111, Turret: 124 };
const Z = { Drone: 41, Zergling: 37, Hydra: 38, Ovie: 42, Egg: 36, Hatch: 131, Pool: 142, Sunken: 146 };
const P = { Probe: 64, Zealot: 65, Goon: 66, Scout: 71, Nexus: 154, Pylon: 156, Gate: 160, Cannon: 162 };

function makeWorld() {
  // 사람 다섯 — 2(테란·저그) 대 3(프로토스·테란·저그). 본진은 맵 귀퉁이·변.
  const PLAYERS = [
    { owner: 0, race: 1, force: 1, name: "정구", color: 0x3050f0, home: [18, 18], kit: "T" },
    { owner: 1, race: 0, force: 1, name: "Rex", color: 0xf08020, home: [18, 106], kit: "Z" },
    { owner: 2, race: 2, force: 2, name: "수달이", color: 0xd8d8b0, home: [106, 18], kit: "P" },
    { owner: 3, race: 2, force: 2, name: "크리스", color: 0xe8d040, home: [106, 106], kit: "P" },
    { owner: 4, race: 0, force: 2, name: "타센", color: 0xa060e0, home: [62, 106], kit: "Z" },
    { owner: 5, race: 1, force: 1, name: "보리", color: 0x40c0c0, home: [18, 62], kit: "T" },
    { owner: 6, race: 2, force: 1, name: "모카", color: 0x80e060, home: [62, 18], kit: "P" },
    { owner: 7, race: 1, force: 2, name: "산들", color: 0xe060a0, home: [106, 62], kit: "T" },
  ].slice(0, Math.max(2, Math.min(8, Number(flag("--players", 5)) || 5)));   // --players N(2~8) — 분할보기 배치 검산(기본 다섯)
  const tracks = [];
  let tag = 100;
  const KEY_DT = 0.75;
  const DIE_AT = Number(flag("--die-at", 42));
  const DIE_GAP = Number(flag("--die-gap", 0.35));                 // 걷는 키 간격(초)
  /** 한 트랙 — path(t)->[x타일, y타일, 상태], hp 변곡점은 따로. */
  /** 건설 명령(판 9 · --ghost) — [프레임, 임자, 일꾼 태그, 타일 x, 타일 y, 종류]. */
  const builds = [];
  /** 선택(판 10 · --selpick) — [프레임, 임자, 태그들]. 빈 배열이면 자동 팝업이 안 선다. */
  const sels = [];
  /** 판 11 네 절(--info · 2026-09 하단 인포창) — 에너지 [프레임, 태그, 값] · 탑승 [프레임, 승객, 배] · 자원량 · 처치. */
  const energyRows = [];
  const loadRows = [];
  /** 업그레이드(--dockebay) — [프레임, id(0x8000|테크), 단계, 임자, 건물 태그]. */
  const upRows = [];
  const killRows = [];
  /** 죽는 병력 [프레임, 태그, 임자] · 사람마다 병력 태그 — 처치 줄의 킬러를 적 병력에서 돌려 뽑는다(아래). */
  const deathsFx = [];
  const armyTags = new Map();
  const track = (owner, type, pathOf, { hp = null, bornSec = 0, buildingAt = null, dieSec = null, lifted = false, wip = false } = {}) => {
    const keys = [];
    if (buildingAt) {
      // 건물 — 자리 붙박이. 키 둘이면 생애가 선다(태어남 + 끝). lifted 면 상태 바이트의 0x40(뜸)을 세워 처음부터 떠 있다.
      // wip 면 첫 키에 0x80(아직 안 지어짐)을 세워 bornSec 이 **착공**으로 읽힌다(--ghost 의 검산 — 고스트가 그 순간 걷힌다).
      /* ⚠ 뜸 깃발은 **첫 키에 두지 마라** — truthLives 는 둘째 키부터 훑어 '앉음 → 뜸' 이 갈리는 자리를 이륙으로 적으므로,
         첫 키부터 켜 두면 이륙이 마지막 키(끝)에 찍혀 재생 내내 앉아 있다(실측: 그래서 --lifted 가 한때 아무것도 안 띄웠다).
         앉은 채 나서 20초 뒤에 뜬다. */
      const st9 = lifted ? 0x40 : 0;
      keys.push([F(bornSec), buildingAt[0] * 32, buildingAt[1] * 32, 0, (wip ? 0x80 : 0), type]);
      if (lifted) keys.push([F(bornSec + 20), buildingAt[0] * 32, buildingAt[1] * 32, 0, st9, type]);
      /* --landed — 떠서 6타일 옆으로 날아가 26초에 앉는다(2026-09, "랜딩 시 떠난 자리에서 폭발" 검산 · 살아서 앉은 건물). */
      if (lifted && has("--landed")) {
        keys.push([F(bornSec + 24), (buildingAt[0] + 6) * 32, buildingAt[1] * 32, 0, st9, type]);
        keys.push([F(bornSec + 26), (buildingAt[0] + 6) * 32, buildingAt[1] * 32, 0, 0, type]);
        keys.push([F(GAME_SEC), (buildingAt[0] + 6) * 32, buildingAt[1] * 32, 0, 0, type]);
      } else
      keys.push([F(GAME_SEC), buildingAt[0] * 32, buildingAt[1] * 32, 0, st9, type]);
    } else {
      // dieSec — 생애가 거기서 끝난다: 마지막 키가 GONE(상태 3)이다(핵 착탄 재현용).
      const endS = dieSec ?? GAME_SEC;
      for (let s = bornSec; s <= endS; s += KEY_DT) {
        const [x, y, st] = pathOf(s);
        const hb = Math.round((Math.atan2(x, -y) * 256) / (Math.PI * 2)) & 0xff;
        keys.push([F(s), Math.round(x * 32), Math.round(y * 32), hb, st, type]);
      }
      if (dieSec !== null) {
        const [x, y] = pathOf(endS);
        keys.push([F(endS) + 1, Math.round(x * 32), Math.round(y * 32), 0, 3, type]);
      }
    }
    tracks.push({ tag: tag++, owner, type, keys, hp });
  };

  /* --recall(2026-10-11) — 정구(0)의 병력 넷이 (62,64) 언저리에 서 있다가 44초 리콜(기술 21)에 불려 22프레임(0.92초) 뒤 (50,64) 언저리로 뛴다
     → 도착장(recallU)이 그 넷 자리에서 지글거린다. 보기: --t 45.4 --castoff --zoom 4 --cx 0.39 --cy 0.5. */
  if (has("--recall")) {
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx9, dy9]) => track(0, P.Goon, (s) => (s < 44 + 22 / 23.81 ? [62 + dx9, 64 + dy9, 0] : [50 + dx9 * 1.2, 64 + dy9 * 1.2, 0]), { bornSec: 44 + 22 / 23.81 - 0.75 * 33 }));   // 키가 뛰는 프레임(44.92)에 서게 태어남을 맞춘다
  }
  let hallTag1_9 = -1;   // Rex(저그 · owner 1)의 본진 해처리 태그 — --dockhatch 가 고른다
  for (const pl of PLAYERS) {
    const [hx, hy] = pl.home;
    const kit = pl.kit;
    const hall = kit === "T" ? T.CC : kit === "Z" ? Z.Hatch : P.Nexus;
    const small = kit === "T" ? T.Depot : kit === "Z" ? Z.Pool : P.Pylon;
    const prod = kit === "T" ? T.Rax : kit === "Z" ? Z.Pool : P.Gate;
    const def = kit === "T" ? T.Turret : kit === "Z" ? Z.Sunken : P.Cannon;
    const worker = kit === "T" ? T.SCV : kit === "Z" ? Z.Drone : P.Probe;
    const melee = kit === "T" ? T.Marine : kit === "Z" ? Z.Zergling : P.Zealot;
    const range = kit === "T" ? T.Vulture : kit === "Z" ? Z.Hydra : P.Goon;

    // 건물 — 홀 3(본진+멀티 둘) · 서플라이류 12 · 생산 6 · 방어 4 = 25채.
    const dirx = hx < 64 ? 1 : -1;
    const diry = hy < 64 ? 1 : -1;
    const hallTag9 = tag;
    if (pl.owner === 1) hallTag1_9 = hallTag9;
    track(pl.owner, hall, null, { buildingAt: [hx, hy] });
    /* 중계 자동 팝업(--selpick · 2026-09) — 정구가 44초에 제 본진 홀 하나만 고르고 50초에 딴 몸(일꾼 태그 자리)으로 갈아탄다.
       --track 정구 로 열면 initialSec 46 에서 그 홀의 정보 팝업이 저절로 서 있어야 한다(perf-check --infoprobe). */
    if (has("--selpick") && pl.owner === 0) {
      sels.push([F(44), 0, [hallTag9]]);
      sels.push([F(50), 0, [hallTag9 + 1000]]);
    }
    /* 뜬 건물(--lifted) — 정구(테란)의 옆 멀티 홀 하나를 이륙한 채 세운다(2026-09, "뜬 건물 그림자 정리"의 검산:
       사영이 켜진 PC 에서 타원 + 검은 복사판 둘이 아니라 바닥에 눕힌 사영 하나여야 한다). 자리 (38, 18). */
    track(pl.owner, hall, null, { buildingAt: [hx + dirx * 20, hy], lifted: has("--lifted") && pl.owner === 0 });
    /* 건설 명령 고스트(--ghost · 2026-09) — 정구(테란)의 일꾼 100 이 40초에 배럭(4×3)을 타일 (40, 26)에 찍고 60초에 착공한다:
       그 사이 20초가 고스트다(initialSec 46 에서 보인다). 일꾼 101 의 47초 서플라이 명령은 짝이 없어 4초 뒤 스러진다(취소).
       ⚠ 두 명령의 **일꾼 태그가 달라야** 한다 — 같은 일꾼의 다음 건설 명령은 앞 명령의 상한이라(engine9 ghosts9) 같은 태그로
         두면 배럭 고스트가 서플라이 명령 순간 끊긴다(실측: 첫 판이 그 꼴이라 스크린샷이 빈 땅이었다).
       자취의 자리는 몸 한가운데(px)라 타일 + 발자국 반이다. */
    if (has("--ghost") && pl.owner === 0) {
      builds.push([F(40), 0, 100, hx + dirx * 22, hy + diry * 8, T.Rax]);
      track(pl.owner, T.Rax, null, { buildingAt: [hx + dirx * 22 + 2, hy + diry * 8 + 1.5], bornSec: 60, wip: true });
      builds.push([F(47), 0, 101, hx + dirx * 26, hy + diry * 0, T.Depot]);
    }
    track(pl.owner, hall, null, { buildingAt: [hx, hy + diry * 20] });
    for (let i = 0; i < 12; i += 1) {
      track(pl.owner, small, null, { buildingAt: [hx + dirx * (4 + (i % 4) * 3), hy + diry * (6 + Math.floor(i / 4) * 3)] });
    }
    for (let i = 0; i < 6; i += 1) track(pl.owner, prod, null, { buildingAt: [hx + dirx * (10 + i * 4), hy + diry * 2] });
    for (let i = 0; i < 4; i += 1) track(pl.owner, def, null, { buildingAt: [hx + dirx * (2 + i * 5), hy + diry * 14] });

    /* 탱크 두 대(--tanks) — 평상시와 시즈 모드를 **나란히** 세운다. 두 모드의 몸이 같은
       크기로 보이는지는 눈으로 가려야 하는 값이라(다리는 빼고 재야 한다) 검사용 자리를
       하나 둔다. 안 움직이고 안 싸운다 — 크기만 보는 판이다. */
    /* 공중 표적(--air) — 맵 한가운데 위를 도는 레이스 셋. 난전이 그 자리로 모이므로
       지상 보병이 이들을 겨눈다. 평면(2D)에서 공중은 일부러 낮게 그리는데(FLAT_AIR_LIFT_K)
       트레이서·피격이 그 축소를 따라오는지는 **눈으로** 가려야 하는 값이라, 세울 자리를
       하나 둔다. */
    if (has("--air") && pl.owner === 0) {
      for (let i = 0; i < 3; i += 1) {
        track(pl.owner, T.Wraith, (s2) => {
          const a = (s2 * 0.5) + (i / 3) * Math.PI * 2;
          return [64 + Math.cos(a) * 3, 64 + Math.sin(a) * 2, 5];
        });
      }
    }
    if (has("--tanks") && pl.owner === 0) {
      // 맵 한가운데 — 어느 배율로 찍어도 화면에 남는다.
      track(pl.owner, T.Tank, () => [60, 64, 5]);
      track(pl.owner, T.TankSiege, () => [68, 64, 5]);
    }
    // 일꾼 절반 — 홀 곁에서 왕복 채집(GATHER↔CARRY).
    const nWorker = Math.floor(UNITS / 2);
    for (let i = 0; i < nWorker; i += 1) {
      const bx = hx + dirx * (2 + (i % 8));
      const by = hy + diry * (2 + Math.floor(i / 8) % 6);
      const ph = (i * 1.7) % 6;
      track(pl.owner, worker, (s) => {
        const u = ((s + ph) % 6) / 6;                       // 6초 왕복
        const sw = u < 0.5 ? u * 2 : (1 - u) * 2;
        return [bx + sw * 3 * dirx, by + Math.sin(u * Math.PI * 2) * 0.8, u < 0.5 ? 5 : 7];
      });
    }
    // 병력 절반 — 30초까지 궤도를 돌다가 가운데(64,64) 난전에 합류. FIGHT 상태로 부대낀다.
    const nArmy = UNITS - nWorker;
    for (let i = 0; i < nArmy; i += 1) {
      const type = i % 3 === 0 ? range : melee;
      const ang0 = (i / nArmy) * Math.PI * 2;
      const hpMax = 80;
      const hp = [[0, hpMax]];
      // 싸움 중 체력이 계단으로 깎인다 — hurtAt(피격 불티)·체력바 갈래가 켜진다.
      for (let s = 40 + (i % 10); s < GAME_SEC; s += 7) hp.push([s, Math.max(5, hpMax - Math.floor((s - 35) / 7) * 9)]);
      /* 죽는 병력(--deaths) — 난전 자리에서 차례로 스러진다. 사망 효과는 창이 0.34초라
         한 프레임을 겨냥해 찍기 어려우므로, 여럿을 1.5초 간격으로 늘어놓아 어느 순간을
         찍어도 몇은 터지고 있게 한다. */
      const dieS = has("--deaths") && i % 2 === 0
        ? DIE_AT + (((pl.owner * 5 + i / 2) % 20) * DIE_GAP) : null;
      if (!armyTags.has(pl.owner)) armyTags.set(pl.owner, []);
      armyTags.get(pl.owner).push(tag);
      if (dieS !== null) deathsFx.push([F(dieS) + 1, tag, pl.owner]);
      track(pl.owner, type, (s) => {
        if (s < 30) {                   // 본진 둘레 궤도
          const a = ang0 + s * 0.25;
          return [hx + Math.cos(a) * 9, hy + Math.sin(a) * 9, 1];
        }
        // 가운데로 행군 → 난전: 자리를 부대끼며 FIGHT.
        const mx = 64 + Math.cos(ang0) * (6 + (i % 5));
        const my = 64 + Math.sin(ang0) * (6 + (i % 5));
        if (s < 45) {
          const u = (s - 30) / 15;
          return [hx + (mx - hx) * u, hy + (my - hy) * u, 1];
        }
        const jig = Math.sin(s * 2.1 + i) * 1.2;
        return [mx + jig, my + Math.cos(s * 1.7 + i) * 1.2, 4];
      }, { hp, ...(dieS !== null ? { dieSec: dieS } : {}) });
    }
  }

  /* --res 의 미네랄(52,76) 위에 정구 SCV 하나를 세워 둔다(2026-10-13, 지적: "자원 우클릭 안 나오는데?" — 실제 경기는 미네랄마다 일꾼이 붙어 있어, 표적이 누구 것이든
     잡히게 된 뒤로 그 일꾼이 표적이 돼 자원 링이 안 섰다). 이제도 자원 링(노랑)이 서야 한다. */
  if (has("--res") && !has("--resbld")) track(0, T.SCV, () => [52, 76, 1]);
  /* --resbld(2026-10-14, 지적: "자원 우클릭 안 나오는데 링이 · 빨무 맵") — 빨무는 미네랄이 본진 건물에 바짝 붙어 있다. 우클릭 자리(52, 75.4)가 정구 커맨드
     (가운데 54.2·76.8 · 발자국 52.2~56.2 × 75.3~78.3) 표적 원(반지름 2.75) 안이지만 **발자국 밖**이다 — 커맨드가 아니라 미네랄 링(노랑)이 서야 한다. */
  if (has("--resbld")) track(0, T.CC, null, { buildingAt: [54.2, 76.8] });
  /* --bldclick(2026-10-13, 요청: "모든 건물 우클릭 대상으로! 원작이 그럼") — 46초 난전 자리 곁에 정구 서플라이(58,60)·Rex(같은 편) 풀(68,60)·수달이(적) 파일런(62,58)을
     세운다. 정구 병력이 45.8초 제 서플라이 · 46.0초 Rex 풀 · 46.2초 수달이 파일런을 우클릭(7)한다 → 땅 마커 없이 링이 초록·노랑·빨강으로 깜빡인다(0.9초 창). */
  const bldClick9 = [];
  if (has("--bldclick")) {
    for (const [o9, ty9, x9, y9] of [[0, T.Depot, 58, 60], [1, Z.Pool, 68, 60], [2, P.Pylon, 62, 58]]) { bldClick9.push([tag, x9, y9]); track(o9, ty9, null, { buildingAt: [x9, y9] }); }
    /* 유닛도(같은 날 "유닛도 전부 다 되는데?") — 46.4초 정구 마린(54,66) · 46.6초 Rex 히드라(56,70)를 우클릭 → 초록 · 노랑. 몸은 제자리에 선다. */
    for (const [o9, ty9, x9, y9] of [[0, T.Marine, 54, 66], [1, Z.Hydra, 56, 70]]) { bldClick9.push([tag, x9, y9]); track(o9, ty9, () => [x9, y9, 1]); }
    /* 랠리(같은 날 "심지어 랠리 포인트도 돼") — 47.0초 정구 서플라이(건물)가 수달이 파일런에 명령(7) → 땅 마커 없이 파일런 빨강. 명령 낸 몸이 건물이어도 같은 길이다. */
  }
  /* 마인드 컨트롤(--mc · 2026-10, "인구 칸의 종족 풀 덧줄" 검산) — 임자 바뀜(판 8)을 셋 심는다. 30초에 정구(테란)가 Rex(저그)의
     오버로드 하나를 뺏고(정구에 저그 풀 0/8 · Rex 상한 −8), Rex 가 정구의 마린 하나를 뺏는다(Rex 에 테란 풀 1/0). --players 3 이상이면
     정구가 수달이(프로토스)의 질럿도 뺏어 정구는 세 줄(테란 본줄 · 저 0/8 · 프 1/0)이다. 오버로드는 5초에 나서(2초 규칙 밖) Rex 의
     상한에 들어 있다가 넘어간다. 몸은 제자리에서 조금 흔들릴 뿐 안 싸운다. */
  if (has("--mc")) {
    const mcF = F(30);
    track(1, Z.Ovie, (s) => [18 + Math.sin(s * 0.3) * 1.5, 98, 1], { bornSec: 5 });
    tracks[tracks.length - 1].own = [[mcF, 0]];
    track(0, T.Marine, (s) => [26, 26 + Math.sin(s * 0.5), 1]);
    tracks[tracks.length - 1].own = [[mcF, 1]];
    if (PLAYERS.length >= 3) {
      track(2, P.Zealot, (s) => [98, 26 + Math.sin(s * 0.5), 1]);
      tracks[tracks.length - 1].own = [[mcF, 0]];
    }
  }
  /* 공사 고치 크기(--cocoon · 2026-10-15, 요청: "드론이 처음 변태할 때는 모두 같은 크기로 시작 · 큰 건물은 급격히 · 작은 건물은 적게 커지게") — Rex(owner 1)가
     30초에 해처리(4×3) · 스포닝 풀(3×2) · 크립 콜로니(2×2) 공사를 나란히(22·100 · 28·100 · 33·100) 시작한다(0x80 · 끝까지 공사 중). 보기: --castoff --zoom 4 --cx 0.215 --cy 0.78
     --pause --t 30.2(셋 같은 크기) · 36(크립 거의 다) · 50 · 100(해처리 거의 다). */
  if (has("--cocoon")) {
    for (const [ty9, x9] of [[Z.Hatch ?? 131, 22], [Z.Pool ?? 142, 28], [Z.Creep ?? 143, 33]]) {
      tracks.push({ tag: tag++, owner: 1, type: ty9, hp: null, keys: [[F(30), x9 * 32, 100 * 32, 0, 0x80, ty9], [F(GAME_SEC), x9 * 32, 100 * 32, 0, 0x80, ty9]] });
    }
    /* 선 건물 변태(2026-10-15, 요청: "성큰 스포어 해처리 레어 하이브 그레이터스파이어 변태는 고치가 가장 큰 상태로 바로 시작") — 다 지어진 해처리(22·108)가 30초에 레어로
       변태를 시작한다(같은 태그 · 종류 바뀜 + 0x80). 30.3초에 이미 다 자란 해처리 고치(위 22·100 의 100초 모습)와 같은 크기여야 한다. */
    /* 알에서 난 뮤탈(2026-10-15, 요청: "저그 공중유닛 탄생 시 알에서 태어나서 쭉 올라오게") — 알(26·106)이 40초에 뮤탈로 바뀌어 깨지기 시작(0x80)하고 41초에 다 난다.
       보기: --t 40.5(알 높이 · 땅) · 41.3 · 41.6 · 42.2(제 높이). */
    const MUTA9 = 43;
    tracks.push({ tag: tag++, owner: 1, type: Z.Egg, hp: null, keys: [[F(20), 26 * 32, 106 * 32, 0, 0, Z.Egg], [F(39.9), 26 * 32, 106 * 32, 0, 0, Z.Egg],
      [F(40), 26 * 32, 106 * 32, 0, 0x80, MUTA9], [F(41), 26 * 32, 106 * 32, 0, 0, MUTA9], [F(GAME_SEC), 26 * 32, 106 * 32, 0, 0, MUTA9]] });
    const LAIR9 = 132;
    tracks.push({ tag: tag++, owner: 1, type: Z.Hatch, hp: null, keys: [[F(1), 22 * 32, 108 * 32, 0, 0, Z.Hatch], [F(29.9), 22 * 32, 108 * 32, 0, 0, Z.Hatch],
      [F(30), 22 * 32, 108 * 32, 0, 0x80, LAIR9], [F(GAME_SEC), 22 * 32, 108 * 32, 0, 0x80, LAIR9]] });
  }
  /* 소환 마무리(--warpdone · 2026-10-15, 요청: "소환구 처음 소환시 작은 구에서 확대 · 완공 빛 흐름 빠르게 · 소환구 페이드아웃과 반물질 페이드인 겹치게") —
     수달이(owner 2 · 프로토스)의 게이트웨이가 30초에 착공(0x80)해 45초에 완공한다. 보기: --castoff --zoom 6 --cx 0.766 --cy 0.234 --pause
     --t 30.1 · 30.3 · 30.6(부풂) / 44.3 · 44.6 · 44.9 · 45.3 · 45.9(엇갈림 · 물마루). */
  if (has("--warpdone")) {
    tracks.push({ tag: tag++, owner: 2, type: P.Gate, hp: null, keys: [
      [F(30), 98 * 32, 30 * 32, 0, 0x80, P.Gate], [F(44.9), 98 * 32, 30 * 32, 0, 0x80, P.Gate],
      [F(45), 98 * 32, 30 * 32, 0, 0, P.Gate], [F(GAME_SEC), 98 * 32, 30 * 32, 0, 0, P.Gate]] });
  }
  /* 나감(--leave · 2026-10-14, 지적: "상대가 게임을 나간건데 엘리시킴으로 뜸") — 원작(OpenBW remove_player)은 나간 사람의 몸 **전부**를 그 프레임에
     중립(11)으로 넘긴다(make_unit_neutral) — 죽지 않는다. 덤퍼는 그것을 임자 바뀜(판 8)으로 싣는다. 여기서는 --leave N 초에 Rex(owner 1)의 트랙
     전부(아직 산 것)를 11 로 넘긴다. 보기: 지도에서 Rex 건물이 폭발 없이 남는지 · 중계 자막에 "엘리시킴"이 안 서는지. */
  if (has("--leave")) {
    const lvS9 = Number(flag("--leave", 40));
    const lvF9 = F(lvS9);
    for (const tr9 of tracks) {
      if (tr9.owner !== 1 || tr9.own) continue;
      const k0 = tr9.keys[0]; const kN = tr9.keys[tr9.keys.length - 1];
      if (k0[0] >= lvF9 || kN[0] <= lvF9 || kN[4] === 3) continue;
      tr9.own = [[lvF9, 11]];
    }
  }
  /* 처치(판 11) — 죽는 병력마다 적 편 병력 하나를 돌려 가며 킬러로 적는다(편 1: 정구·Rex · 편 2: 나머지). */
  {
    const force9 = (o) => (o <= 1 ? 1 : 2);
    const foes9 = (o) => [...armyTags.entries()].filter(([o2]) => force9(o2) !== force9(o)).flatMap(([o2, ts]) => ts.map((t2) => [o2, t2]));
    deathsFx.sort((a, b) => a[0] - b[0]).forEach(([f, vt, vo], i) => {
      const fs = foes9(vo);
      if (fs.length === 0) return;
      const [ko, kt] = fs[(i * 7) % fs.length];
      killRows.push([f, ko, kt, vt]);
    });
  }
  /* 인포창 재료(--info · 2026-09) — 정구(테란)의 드랍십 하나에 마린 넷을 10초에 태우고, 벙커 하나에 마린 둘을 넣고,
     사이언스 베슬 하나의 에너지를 50 → 200 으로 올린다. 44초에 정구가 병력 여덟을 한꺼번에 고른다(다중 격자). */
  if (has("--info")) {
    const DS = 11; const BUNKER = 125; const VESSEL = 9;
    const dsTag = tag;
    track(0, DS, (s) => [32 + Math.sin(s * 0.3) * 0.5, 40, s < 10 ? 1 : 0]);
    /* --dockmix 면 크기가 섞인 짐(마린 1 · 골리앗 2 · 탱크 4 · 마린 1)을 태운다 — 칸 폭이 수송 공간을 따르나 본다. */
    const cargo9 = has("--dockmix") ? [T.Marine, T.Goliath, T.Tank, T.Marine] : [T.Marine, T.Marine, T.Marine, T.Marine];
    for (let k = 0; k < 4; k += 1) {
      const mt = tag;
      track(0, cargo9[k], (s) => (s < 10 ? [30 + k, 42, 1] : [32, 40, 2]));
      loadRows.push([F(10) + k, mt, dsTag]);
    }
    /* 배럭 하나가 마린을 줄줄이 뽑는다(--dockrax) — 50초에 첫 마린이 나오고 24초마다 하나씩(큐가 진행 바 아래 서나 본다). */
    const raxTag = tag;
    track(0, T.Rax, null, { buildingAt: [44, 30] });
    for (let k = 0; k < 4; k += 1) track(0, T.Marine, (s) => [46, 33 + k * 0.4, 1], { bornSec: 50 + k * 24 });
    const bkTag = tag;
    track(0, BUNKER, null, { buildingAt: [36, 30] });
    for (let k = 0; k < 2; k += 1) {
      const mt = tag;
      track(0, T.Marine, (s) => (s < 8 ? [34 + k, 33, 1] : [36, 30, 2]));
      loadRows.push([F(8) + k, mt, bkTag]);
    }
    const vTag = tag;
    track(0, VESSEL, (s) => [40, 36 + Math.sin(s * 0.2), 0]);
    for (let e = 50; e <= 200; e += 1) energyRows.push([F(1 + (e - 50) * 1.3), vTag, e]);
    const army0 = armyTags.get(0) ?? [];
    /* --dockship · --dockbunker 면 44초에 그 배 하나를 고른다(탄 몸 칸의 검산) · 아니면 병력 여덟(다중 격자). */
    /* 엔지니어링 베이 하나(--dockebay) — 보병 공격 1(20초) · 보병 방어 1(30초) 을 마치고 보병 공격 2 를 70초에 마친다
       (44초면 하는 중) · 아카데미의 스팀팩(테크 0x8000)도 25초에 마친다. 연구 상황판(칩)과 '연구 중 … 2단계' 바를 본다. */
    /* 합체 중인 아콘(--dockarchon · 2026-10-14 · `--track 수달이` 와 함께) — 수달이 본진 곁에 38초에 아콘·다크 아콘이 나 50.6초까지 합체한다
       (engine9 ARCHON_MERGE_SEC9). 44.5초에 아콘을 고르면 "합체 중" 바가 서고 몸은 고리·속 형체 없는 구다. */
    const arcTag9 = tag;
    track(2, 68, () => [98, 26, 0], { bornSec: 38 });
    track(2, 63, () => [101, 26, 0], { bornSec: 38 });
    const ebTag = tag;
    track(0, 122, null, { buildingAt: [48, 36] });
    upRows.push([F(20), 7, 1, 0, ebTag], [F(25), 0x8000, 1, 0, 0], [F(30), 0, 1, 0, ebTag], [F(70), 7, 2, 0, ebTag]);
    sels.push([F(44), 0, has("--dockship") ? [dsTag] : has("--dockbunker") ? [bkTag] : has("--dockrax") ? [raxTag]
      : has("--dockebay") ? [ebTag] : army0.slice(0, 8)]);
    sels.push([F(44.5), 2, has("--dockarchon") ? [arcTag9] : has("--dockzealot") ? (armyTags.get(2) ?? []).slice(0, 1) : (armyTags.get(2) ?? []).slice(0, 3)]);   // --dockzealot — 수달이(프로토스)의 병력 하나(체력·실드 줄 검산 · --track 수달이)
    /* 해처리류·알(--dockhatch · --dockegg · 2026-10-09 · `--track Rex` 와 함께) — Rex(저그 · owner 1)의 본진 해처리를 고르면 생산·대기 줄이
       **없어야** 하고, 알 하나(저글링 생산 시간만큼 살다 50초에 깨지고 그 자리에 저글링이 난다)를 고르면 "변태 중 저글링" 바가 서야 한다. */
    const eggTag = tag;
    track(1, Z.Egg, () => [20, 100, 0], { bornSec: 50 - 28, dieSec: 50 });   // 28 = UNIT_BUILD_SEC.Zergling(unitStats)
    track(1, Z.Zergling, () => [20.5, 100.5, 0], { bornSec: 50 });
    if (has("--dockegg")) sels.push([F(44), 1, [eggTag]]);
    /* 오버로드(--dockovl · 2026-10-22 · `--track Rex` 와 함께) — 공중 방어 1 · 속업 · 수송업 · 시야업을 마친 오버로드 하나를 고른다
       (지적: "오버로드 인포창 업그레이드 칸 잘림" — 수송업이면 짐칸 격자가 서서 업그레이드 기둥이 좁아진다). */
    if (has("--dockovl")) {
      const ovlTag = tag;
      track(1, Z.Ovie, () => [22, 98, 0]);
      upRows.push([F(12), 4, 1, 1, 0], [F(14), 26, 1, 1, 0], [F(16), 24, 1, 1, 0], [F(18), 25, 1, 1, 0]);
      sels.push([F(44), 1, [ovlTag]]);
    }
    if (has("--dockhatch") && hallTag1_9 >= 0) sels.push([F(44), 1, [hallTag1_9]]);
  }

  /* 발키리 대 오버로드(재현: "미사일 두 발 사이 간격이 유닛폭보다 훨씬 넓어") —
     미사일 자취(FX_BEAM.missile)를 쏘는 유닛은 발키리·터렛뿐인데 합성 세계에 공중이
     한 기도 없어 이 갈래가 한 번도 안 그려졌다. 가운데 위쪽에 표적(오버로드)과 사수
     (발키리)를 마주 세워 사거리 안에서 계속 쏘게 둔다 — 두 발의 벌어짐을 눈으로 잰다. */
  for (let i = 0; i < 3; i += 1) {
    track(2, 42, (s) => [60 + i * 3, 40 + Math.sin(s * 0.4) * 0.6, 1]);   // 오버로드
    track(0, 58, (s) => [62 + i * 3, 41 + Math.cos(s * 0.4) * 0.6, 4]);   // 발키리(FIGHT)
  }

  /* 골리앗·스카우트 대공(재현: "골리앗 스카우트 대공 미사일 안나감") — 이 둘은 지상·대공
     무기가 아예 다르다(연사 기관포 ↔ 미사일). 합성 세계의 병력에는 둘 다 없어 그 갈림이
     한 번도 안 그려졌다. 발키리 판과 같은 손으로, 오버로드 셋을 표적 삼아 마주 세운다
     (상태 4 = FIGHT). --aa로 켠다. */
  if (has("--aa")) {
    for (let i = 0; i < 3; i += 1) {
      track(2, 42, (s) => [62 + i * 2, 64 + Math.sin(s * 0.4) * 0.6, 1]);        // 오버로드
      track(0, T.Goliath, (s) => [64 + i * 2, 65 + Math.cos(s * 0.4) * 0.5, 4]); // 골리앗
      track(0, 58, (s) => [63 + i * 2, 67 + Math.cos(s * 0.6) * 0.5, 4]);        // 발키리(대조군)
      track(0, P.Scout, (s) => [61 + i * 2, 62 + Math.cos(s * 0.5) * 0.5, 4]);   // 스카우트
    }
  }

  /* 핵 둘(재현: "핵 모델과 폭발 표현 안나옴") — 핵 연출은 미사일 개체 자취에서
     합성되므로(재생기 nukeCasts), 미사일(종류 14)이 사일로에서 표적까지 날아가
     착탄(GONE)하는 자취만 있으면 된다. 착탄을 54·58초에 둬서 기본 스크린샷 시각
     (~51-57초)에 낙하와 폭발이 걸리게 한다. */
  const nukeAt = (impactSec, tx, ty) => track(0, 14, (s) => {
    const f = Math.min(1, Math.max(0, (s - (impactSec - 6)) / 6));
    return [24 + (tx - 24) * f, 14 + (ty - 14) * f, 1];
  }, { bornSec: 45, dieSec: impactSec });
  nukeAt(54, 62, 75);
  nukeAt(58, 85, 60);

  /* ── 바이트로 굽는다 ── */
  const w = new W();
  w.u8(0x4f); w.u8(0x42); w.u8(0x57); w.u8(0x54);   // "OBWT"
  /* 판 12 = 판 11 + 선택 줄마다 u8 갈래 · --dmg 면 판 13(= 판 12 + 맨 뒤 데미지 절 — 현황 데미지 칸 "1.2k(46%)/0.9k(52%)" 의 재료). */
  w.u8(has("--dmg") ? 13 : 12); w.f32(FPS); w.i32(-1);
  w.u8(PLAYERS.length);
  for (const pl of PLAYERS) { w.u8(pl.owner); w.u8(pl.owner); w.u8(pl.race); w.u8(pl.force); w.u8(0); w.u32(pl.color); w.str(pl.name); }
  w.u32(tracks.length);
  // 판 8 트랙표 줄: … + 표적 수(u32, 0) + 임자바뀜 목록(u8 개수 · 바뀜마다 u32 프레임 · u8 새 임자 — --mc 만 0 이 아니다).
  for (const tr of tracks) {
    w.u32(tr.tag); w.u8(tr.owner); w.u16(tr.type); w.u32(tr.keys.length); w.u32(tr.hp ? tr.hp.length : 0); w.u32(0); w.u32(0);
    const own9 = tr.own ?? [];
    w.u8(own9.length); for (const [f, o] of own9) { w.u32(f); w.u8(o); }
  }
  for (const tr of tracks) {
    let pf = 0; let px = 0; let py = 0; let pt = 0;
    for (const [f, x, y, hb, st, ty] of tr.keys) {
      w.vz(f - pf); pf = f;
      w.vz(x - px); px = x;
      w.vz(y - py); py = y;
      w.u8(hb); w.u8((st & 0x0f) | (st & 0x40) | (st & 0x80));   // 0x80 = 아직 안 지어짐(--ghost 의 착공 키) · 0x40 = 뜸(--lifted 의 건물만)
      w.vz(ty - pt); pt = ty;
    }
  }
  for (const tr of tracks) {           // 체력 흐름 — 키 있는 트랙만, 트랙 차례대로
    if (!tr.hp) continue;
    let pf = 0; let pv = 0;
    for (const [s, v] of tr.hp) { const f = F(s); w.vz(f - pf); pf = f; w.vz(v - pv); pv = v; }
  }
  w.u32(upRows.length);                // 업그레이드(--dockebay) — 판 7부터 줄마다 건물 태그
  { let pf = 0; for (const [f, id, lv, o, tg] of upRows) { w.vz(f - pf); pf = f; w.u16(id); w.u8(lv); w.u8(o); w.u32(tg); } }
  /* --irr(2026-10-11) — 44초에 화면 가운데(62,64 · 46초 난전 자리 언저리)로 0번 사람이 이레디에이트(기술 7) — 대상은 그 자리에서 가장 가까운 몸 하나(제 것·적 가리지 않음).
     --irrxy x,y 로 자리를 바꾼다. 화면은 --castoff --zoom 4 --cx/--cy 로 그 자리에. */
  const irrXY9 = String(flag("--irrxy", "62,64")).split(",").map(Number);
  const casts9 = has("--irr") ? [[F(44), irrXY9[0] * 32, irrXY9[1] * 32, 7, Number(flag("--irrby", 0))]] : [];
  if (has("--recall")) casts9.push([F(44), 62.5 * 32, 64.5 * 32, 21, 0]);
  /* --scan(2026-10-12) — 정구(0)가 45초에 먼 곳(--scanxy · 기본 (20,100))을 스캔(기술 4) → --track 정구 --t 46 이면 개인 화면 카메라가 그 자리를 본다(다음 명령까지). */
  if (has("--scan")) { const sxy9 = String(flag("--scanxy", "20,100")).split(",").map(Number); casts9.push([F(45), sxy9[0] * 32, sxy9[1] * 32, 4, 0]); }
  w.u32(casts9.length); { let pf = 0; for (const [f, x, y, tc, o] of casts9) { w.vz(f - pf); pf = f; w.u16(x); w.u16(y); w.u8(tc); w.u8(o); } }   // 마법
  /* 핑(--marks · 2026-10, UI 색 검산) — 44.5초에 정구(0 · 화면 주인이면 원작 초록 rgb(16,252,24)) · Rex(1 · 같은 편 → 제 색) · 수달이(2 · 적 →
     시점 보기에선 안 보임).
     자리는 가운데 난전 근처(병력이 46초쯤 거기 모여 카메라가 그쪽을 본다) · 좌표는 px(타일 × 32) — 덤퍼가 쓰는 자와 같다. */
  const pings9 = has("--marks") ? [[F(44.5), 60 * 32, 60 * 32, 0], [F(44.6), 66 * 32, 58 * 32, 1], [F(44.7), 62 * 32, 68 * 32, 2]] : [];
  w.u32(pings9.length); { let pf = 0; for (const [f, x, y, o] of pings9) { w.vz(f - pf); pf = f; w.u16(x); w.u16(y); w.u8(o); } }
  w.u32(0);                            // 자원
  /* 명령(--marks) — 클릭 마커의 재료: 정구 병력 하나 이동(0)·다른 하나 공격(7 · X 자) · Rex 병력 이동(같은 편) ·
     수달이 병력 공격(적 → 시점 보기에선 안 보임). 마커는 0.9초만 사니 45.6초와 46.4초 두 벌을 심는다(사진이 46~47초). */
  const cmds9 = [];
  if (has("--marks")) {
    for (const s0 of [45.6, 46.4]) {
      cmds9.push([F(s0), armyTags.get(0)[0], 58 * 32, 66 * 32, 0], [F(s0 + 0.05), armyTags.get(0)[1], 68 * 32, 62 * 32, 7]);
      if (armyTags.has(1)) cmds9.push([F(s0 + 0.1), armyTags.get(1)[0], 56 * 32, 60 * 32, 0]);
      if (armyTags.has(2)) cmds9.push([F(s0 + 0.15), armyTags.get(2)[0], 70 * 32, 66 * 32, 7]);
    }
  }
  /* --res 의 자원 우클릭(2026-10-12, 요청: "우클릭도 x 마커 말고 자원 선택 링을 깜빡인다든지") — 정구 병력 하나가 45.8초에 미네랄(60,64 · 난전 자리 — 개인 화면에 걸린다)로 이동 명령(0).
     --track 정구 --t 46 이면 땅 마커 대신 그 미네랄의 노란 링이 켜져 있다(0.9초 창 · 0.225초 켜고 끄기). */
  if (has("--res") && armyTags.has(0)) { cmds9.push([F(45.8), armyTags.get(0)[2], 52 * 32, 76 * 32 - 20, 7]); /* 덤퍼는 표적 있는 우클릭을 7 로 적는다 · 자리는 마우스(그림 위 · 가운데보다 20px 위) */ cmds9.sort((a, b) => a[0] - b[0]); }
  /* --selarmy(2026-10-14, 링 굵기 자 — "배율에 따라 선택링 두께도 변해야") — 정구 병력 여섯과 본진 홀을 44초에 고른다 · --diag 의 [링] 줄에 폭·테가 찍힌다. */
  if (has("--selarmy") && armyTags.has(0)) sels.push([F(44), 0, [...armyTags.get(0).slice(0, 6)]]);
  if (bldClick9.length > 0 && armyTags.has(0)) {
    bldClick9.forEach(([, x9, y9], i9) => cmds9.push([F(45.8 + i9 * 0.2), armyTags.get(0)[3 + i9], x9 * 32, y9 * 32, 7]));   // 셋 건물 · 둘 유닛
    cmds9.push([F(47.0), bldClick9[0][0], bldClick9[2][1] * 32, bldClick9[2][2] * 32, 7]);   // 랠리 — 정구 서플라이 → 수달이 파일런
    cmds9.sort((a, b) => a[0] - b[0]);
  }
  w.u32(cmds9.length); { let pf = 0; for (const [f, tg, x, y, k] of cmds9) { w.vz(f - pf); pf = f; w.u32(tg); w.u16(x); w.u16(y); w.u8(k); } }
  w.u32(0); w.u16(119);                // APM(빈) — 통 크기만 적는다
  w.u32(0);                            // 자원밭단
  w.u32(builds.length);                // 건설 명령(판 9 · 맨 뒤)
  { let pf = 0; for (const [f, o, tg, tx, ty, ty9] of builds) { w.vz(f - pf); pf = f; w.u8(o); w.u32(tg); w.u16(tx); w.u16(ty); w.u16(ty9); } }
  w.u32(sels.length);                  // 선택(판 10 · 맨 뒤 · 판 12 부터 줄마다 u8 갈래 — 픽스처는 다 0 = 마우스 고름)
  { let pf = 0; for (const [f, o, tgs] of [...sels].sort((a, b) => a[0] - b[0])) { w.vz(f - pf); pf = f; w.u8(o); w.u8(0); w.u8(tgs.length); for (const tg of tgs) w.u32(tg); } }
  w.u32(energyRows.length);            // 에너지(판 11)
  { let pf = 0; for (const [f, tg, v] of [...energyRows].sort((a, b) => a[0] - b[0])) { w.vz(f - pf); pf = f; w.u32(tg); w.u16(v); } }
  w.u32(loadRows.length);              // 탑승(판 11)
  { let pf = 0; for (const [f, px, sh] of [...loadRows].sort((a, b) => a[0] - b[0])) { w.vz(f - pf); pf = f; w.u32(px); w.u32(sh); } }
  /* --res(2026-10-12, 요청: "자원 클릭 시 자원 잔량/전체량 표시") — 정구 본진 왼쪽 미네랄 셋(RES_EXTRA9)·간헐천(home + 4)의 자원량 절: 0초 처음 양(1500 · 5000),
     20·40초에 줄어든 양. 자리는 타일 × 32(px) — 덤퍼의 자와 같다. 재생기는 반 타일 칸으로 짝짓는다. */
  const amt9 = [];
  if (has("--res")) {
    for (const [x9, y9, g9] of RES_EXTRA9) { amt9.push([0, x9 * 32, y9 * 32, g9 ? 5000 : 1500], [F(20), x9 * 32, y9 * 32, g9 ? 4760 : 1420], [F(40), x9 * 32, y9 * 32, g9 ? 4520 : 1240]); }
    amt9.sort((a, b) => a[0] - b[0]);
  }
  w.u32(amt9.length);                  // 자원량(판 11)
  { let pf = 0; for (const [f, x, y, v] of amt9) { w.vz(f - pf); pf = f; w.u16(x); w.u16(y); w.u16(v); } }
  w.u32(killRows.length);              // 처치(판 11 · 맨 뒤)
  { let pf = 0; for (const [f, ko, kt, vt] of killRows) { w.vz(f - pf); pf = f; w.u8(ko); w.u32(kt); w.u32(vt); } }
  /* 데미지 절(판 13 · --dmg · 2026-10, 폰 두 줄 현황의 데미지 칸 폭 검산) — 10초 통 · 20초부터 통마다 사람마다 준(유닛·건물)·입은(유닛·건물)을
     적는다. 임자마다 조금 다르게(who 비례) 하여 팀 내 몫 %가 50 아닌 수로 선다. 46초면 통 셋(20·30·40)이 쌓여 "1.1k(46%)/0.8k(52%)" 꼴. */
  if (has("--dmg")) {
    const bf9 = Math.round(10 * FPS);
    const rows9 = [];
    for (let b9 = 2; b9 <= 12; b9 += 1) for (const pl of PLAYERS) rows9.push([b9, pl.owner, 300 + 70 * pl.owner, 40, 250 + 40 * pl.owner, 20]);
    w.u32(rows9.length); w.u16(bf9);
    let pb9 = 0;
    for (const [b9, who, du, db, tu, tb] of rows9) { w.vz(b9 - pb9); pb9 = b9; w.u8(who); w.vz(du); w.vz(db); w.vz(tu); w.vz(tb); }
  }
  const motion = deflateSync(w.out()).toString("base64");
  /* 합성 뭉치를 파일로도 낸다(PERF_MOTION_OUT=경로) — 엔진을 노드에서 곧장 돌려 보는 하네스의 재료(브라우저 없이 ghosts9·op 를 찍는다). */
  if (process.env.PERF_MOTION_OUT) writeFileSync(process.env.PERF_MOTION_OUT, JSON.stringify({ motion, players: PLAYERS }));
  return { motion, players: PLAYERS, nTracks: tracks.length };
}

/* ── 브라우저에 넣을 번들 — 실제 컴포넌트를 실제로 마운트한다 ─────────────────── */
const walkFixture = readFileSync(join(ROOT, "scripts/fixtures/walk-fastest.json"), "utf8");
/** 합성 참값 지형(OBWM 판 1) — 지도 벡터층(ReplayMapVector)을 켜는 재료다. 벽은 걷기
 *  픽스처 그대로, 가운데 왼쪽에 고지대 판 하나를 세워 절벽면·램프 그리기도 태운다. */
const makeTerrain = () => {
  const f = JSON.parse(walkFixture);
  const W = f.w; const H = f.h;
  const bits = Buffer.from(f.hex, "hex");
  const walkAt = (x, y) => (bits[(y * W + x) >> 3] >> ((y * W + x) & 7)) & 1;
  const tile = Buffer.alloc(W * H);
  const inPlat = (x, y) => x >= 20 && x <= 44 && y >= 52 && y <= 76;
  const onRing = (x, y) => !inPlat(x, y) && x >= 18 && x <= 46 && y >= 50 && y <= 78;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let b = walkAt(x, y) ? 1 : 0;                      // bit0 걸을 수 있다
      if (inPlat(x, y)) b |= 8;                          // bit3 높은 고도
      else if (onRing(x, y)) { b = (b & ~1) | 4; }       // 테두리 — 못 걷는 중간 고도(절벽)
      tile[y * W + x] = b;
    }
  }
  const mw = W * 4; const mh = H * 4;
  const wb = Buffer.alloc((mw * mh + 7) >> 3);
  for (let my = 0; my < mh; my += 1) {
    for (let mx = 0; mx < mw; mx += 1) {
      if (tile[(my >> 2) * W + (mx >> 2)] & 1) {
        const k = my * mw + mx;
        wb[k >> 3] |= 1 << (k & 7);
      }
    }
  }
  const head = Buffer.alloc(11);
  head.write("OBWM", 0, "ascii");
  head[4] = 1;
  head.writeUInt16LE(W, 5);
  head.writeUInt16LE(H, 7);
  head[9] = 2;                                           // install — 잿빛
  return deflateSync(Buffer.concat([head, tile, wb])).toString("base64");
};
const ENTRY = `
import React from "react";
import { createRoot } from "react-dom/client";
import ReplayMotionPlayer, { sceneLinkQueryOf9 } from ${JSON.stringify(join(ROOT, "src/components/replay/ReplayMotionPlayer"))};
/* --bgm — 곡 목록을 꽂아 음악 단추·목록(음량 슬라이더 + 끄기)을 세운다(2026-10-10). 소리는 안 난다(빈 data 주소). */
import { setReplayBgm } from ${JSON.stringify(join(ROOT, "src/components/replay/useBgm"))};
/* 토스트를 모은다(--locktoast · 2026-10-11) — 앱이 꽂는 chrome.toast 자리. */
import { setReplayChrome } from ${JSON.stringify(join(ROOT, "src/components/replay/chrome"))};
window.__toasts = [];
setReplayChrome({ toast: (t) => { window.__toasts.push(t); } });
if (${JSON.stringify(process.argv.includes("--bgm"))}) setReplayBgm([{ title: "테스트 곡 하나", src: "data:audio/mp3," }, { title: "테스트 곡 둘", src: "data:audio/mp3," }]);
/* 공유 표(clockKey "perf") — castprobe 가 '중계·추적 중에는 자리를 안 싣고 &tr= 만 싣나'를 읽는다. */
window.__share9 = () => { const q = sceneLinkQueryOf9("perf"); return { tr: q.get("tr"), pos: q.has("z") || q.has("cx"), qs: q.toString() }; };
window.__mount = (motion, players, walkJson, terrainB64) => {

  const el = document.getElementById("root");
  const tiles = btoa(String.fromCharCode(...new Uint8Array(128 * 128)));
  const grid = {
    hash: "perf", name: "perf",
    /* 지도 크기(--mapw/--maph) — 실제 판은 정사각이 아닌 것이 많고, 프레임의 가로세로비가
       지도 것을 따르므로 크롭이 어느 쪽으로 나는지가 달라진다(가운데 치우침 조사). */
    width: window.__mapw || 128, height: window.__maph || 128, palette: [0], tiles,
    resources: [...players.map((p) => [p.home[0] + 4, p.home[1] + 4, 1]), ...(window.__resx ?? [])],   // --res 면 정구 본진 왼쪽 미네랄 셋을 더 둔다
    image: null, walk: walkJson, terrain: terrainB64 ?? null, imageId: null, imageName: null,
  };
  const bases = players.map((p) => ({
    key: p.name, name: p.name, avatar: null, memberId: p.name,
    race: p.race === 1 ? "테란" : p.race === 0 ? "저그" : "프로토스",
    team: p.force, x: p.home[0], y: p.home[1], withName: true,
  }));
  const teamOfRaw = (raw) => { const f = players.find((p) => p.name === raw); return f ? f.force : undefined; };
  createRoot(el).render(React.createElement(ReplayMotionPlayer, {
    grid, endSec: 120, bases, teamOfRaw, active: true, clockKey: "perf",
    ...(window.__winner === 1 || window.__winner === 2 ? { winnerTeam: window.__winner } : {}),
    /* 링크 한 벌(sceneLink) — 앱이 넘기는 그 꼴 그대로: t 46(고스트 검산 시각) · --track <아이디|*>(&tr= · * 는 자동 중계) ·
       --zoom/--cx/--cy/--deg(&z=·&cx=·&cy=·&a= — 난전이 (64,64) = 분수 0.5라 화면 한가운데 온다 · 본진을 확대해 재려면
       --cx/--cy 로 옮긴다(가운데는 빈 땅이라 아무것도 안 그려진다)). */
    ...(window.__ask ? { askMode: true } : {}),   // --ask — 보기 모드 판(링크가 있으면 안 묻는다 → 아래 sceneLink 를 안 싣는다)
    sceneLink: window.__ask ? null : {
      t: window.__t ?? 46,   // --t N 으로 다른 시각에 연다(착지 먼지 1.1초 같은 짧은 효과를 볼 때)
      ...(window.__track ? { tr: window.__track } : {}),
      ...(window.__zoom > 1 ? { z: window.__zoom } : {}),
      ...(window.__zoom > 1 && window.__cx != null ? { cx: window.__cx } : {}),
      ...(window.__zoom > 1 && window.__cy != null ? { cy: window.__cy } : {}),
      ...(window.__deg && window.__deg !== 90 ? { a: window.__deg } : {}),
      ...(window.__speed > 1 ? { s: window.__speed } : {}),   // --speed N(2026-10-12) — 배속(&s=) · 헤드리스는 느려 창 끝까지 기다리는 탐침(--searchwait)에 쓴다
    },
    /* --chat(2026-10-19) — 경기 채팅 넷(사람 셋 · 관전자 하나 · 긴 글 하나) · 42~45초 · 열리는 46초에 다 5초 창 안이다(재생기 왼아래 채팅). */
    loadUnitTracks: async () => ({ motion, ...(window.__chat ? { chats: [
      { sec: 42, name: "정구", text: "ㅎㅇ 잘 부탁드립니다" }, { sec: 43, name: "수달이", text: "ㄱㄱ" },
      { sec: 44, name: "관전자", text: "오 핵이다" },
      { sec: 45, name: "Rex", text: "이번 판은 진짜 길게 가 봅시다 앞마당 먹고 하이브까지 가는 걸로 다들 화이팅" }] } : {}) }),
    /* 장면 공유(배치 검증용) — 실제 앱(scplayer)이 넘기는 그 콜백이다. 버튼은 재생기가 그린다(아이콘 원). 스크랩은 2026-10-22 걷었다.
       없으면 그 줄이 빈 채라 '어디에 서는가'를 화면으로 못 가린다. */
    onShare: async () => { window.__shareQ9 = window.__share9().qs; return "링크 복사됨"; },   // --sharepick 이 '보내는 순간의 링크'를 읽는다
  }));
};
`;

function bundle() {
  const dir = mkdtempSync(join(tmpdir(), "perfcheck-"));
  /* 입구 파일은 리포 안에 잠깐 써야 한다 — /tmp에 쓰면 "react"가 node_modules 경로
     탐색에 안 걸린다(다른 계측 CLI들은 src/만 import해서 이 문제가 없었다). */
  const src = join(ROOT, "scripts", ".perf-entry.tmp.ts");
  const out = join(dir, "entry.mjs");
  writeFileSync(src, ENTRY);
  const ebin = join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
  const head = readFileSync(ebin).subarray(0, 4);
  const magic = (head[0] << 24 | head[1] << 16 | head[2] << 8 | head[3]) >>> 0;
  const native = magic === 0x7f454c46 || (head[0] === 0x4d && head[1] === 0x5a)
    || magic === 0xcffaedfe || magic === 0xcefaedfe || magic === 0xcafebabe;
  const args = [src, "--bundle", "--format=esm", "--log-level=error", "--jsx=automatic",
    "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env={}", `--outfile=${out}`];
  execFileSync(native ? ebin : process.execPath, native ? args : [ebin, ...args],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const js = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  rmSync(src, { force: true });
  return js;
}

/* ── 달리기 ─────────────────────────────────────────────────────────────────── */
const world = makeWorld();
console.log(`합성 세계: 트랙 ${world.nTracks}개 · motion ${(world.motion.length / 1024).toFixed(0)}KB`);
/* --vite — esbuild 대신 **vite로** 묶는다(프레임 워커 `?worker&inline`은 vite만 안다). 배포판과 같은
   길이라 워커가 실제로 도는지를 여기서 잰다. 동적 import까지 한 파일에 넣는다(inlineDynamicImports). */
async function bundleVite() {
  const { build } = await import("vite");
  const reactPlugin = (await import("@vitejs/plugin-react")).default;
  const dir = mkdtempSync(join(tmpdir(), "perfcheck-vite-"));
  const src = join(ROOT, "scripts", ".perf-entry.tmp.ts");
  writeFileSync(src, ENTRY);
  await build({
    configFile: false, root: ROOT, logLevel: "error",
    plugins: [reactPlugin()],
    define: { "process.env.NODE_ENV": JSON.stringify("production"), __SCPLAY_BUILD__: JSON.stringify("perf") },
    worker: { format: "es", plugins: () => [reactPlugin()], rollupOptions: { external: [] } },
    build: {
      outDir: dir, emptyOutDir: true, sourcemap: false, minify: false, cssCodeSplit: false,
      lib: { entry: src, formats: ["es"], fileName: "entry" },
      rollupOptions: { external: [], output: { inlineDynamicImports: true } },
    },
  });
  const js = readFileSync(join(dir, "entry.js"), "utf8");
  rmSync(dir, { recursive: true, force: true });
  rmSync(src, { force: true });
  return js;
}
/* 기본이 vite다 — 프레임은 워커만 내므로 esbuild 번들(--esbuild)에는 유닛이 안 그려진다(굽기·배치 검사용). */
const js = has("--esbuild") ? bundle() : await bundleVite();

const TRACE = has("--trace");        // 크로뮴 트레이스 — 메인 스레드 밖(래스터·컴포짓)까지 본다
/* --engine webkit — 웹킷으로 돌린다(요청·지적: "스테이지 문제 웹킷 쪽인가 봐 지금
   사파리 모바일에서만 그래"). 이 앱의 화질·배치 문제는 웹킷에서만 나는 것이 여럿이라
   크로뮴만으로는 재현 자체가 안 된다. CPU 조임·프로파일러는 크로뮴 전용이라 웹킷에서는
   건너뛴다(그쪽은 배치·크기 검사용이다). */
const ENGINE = String(flag("--engine", "chromium"));
const { chromium, webkit } = await import("playwright-core");
const CANDIDATES = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium",
  join(homedir(), "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const launchOpt = exe
  ? { executablePath: exe, args: ["--no-proxy-server"] }
  : { args: ["--no-proxy-server"] };
/* 새 크로미엄은 옛 헤드리스(--headless=old)를 아예 걷어냈다 — 플레이라이트가 그 깃발을
   붙이는 판이면 창이 열리자마자 죽는다. 그때는 헤드리스를 끄고(headless:false) 새
   헤드리스 깃발을 손으로 붙인다(model-shot.mjs 등이 쓰는 그 길). */
const browser = ENGINE === "webkit"
  ? await webkit.launch()
  : await chromium.launch(launchOpt).catch((e) => {
    if (!/headless/i.test(String(e))) throw e;
    return chromium.launch({
      ...launchOpt, headless: false,
      args: [...launchOpt.args, "--headless=new", "--no-sandbox"],
    });
  });
/* --ios — 아이폰으로 꾸민다(UA + 손가락). 지도 벡터층이 이 둘로 아이폰을 알아보고
   캔버스 면적 예산을 절반 남짓으로 낮추므로, 그 갈래를 여기서 태울 수 있다.
   ⚠ 엔진은 여전히 크로뮴이다 — 웹킷의 배킹 확보 실패까지 흉내 내지는 못한다. */
const page = await browser.newPage({
  /* 창 높이(--vh) — 프레임의 높이 예산이 이 값에서 나오므로, 예산이 빠듯한 화면
     (아이폰 + 위에 제목 줄)에서만 나는 잘림을 여기서 재현한다. */
  viewport: WIDE
    ? { width: Number(flag("--vw", 1280)), height: Number(flag("--vh", 900)) }   // --vw 넓은 화면(독 음각 글귀 검산)
    : { width: Number(flag("--vw", 390)), height: Number(flag("--vh", 844)) },   // 폰도 --vw(큰 폰 430 · 폴드 755 — 해상도 단 검산)
  /* 화면(screen)도 창과 같게 — 폰의 해상도 단(uiStep9)이 window.screen 의 짧은 변을 잰다(기본 헤드리스 화면은 1280×720 으로 창과 따로 논다).
     PC 단은 창 세로(innerHeight)라 창이 곧 자다. 기본 PC 돌림(1280×900 창 · 그대로면 FHD 0.75)은 아래 hash9 가 `ui=1` 로 못 박아 옛 실측
     (dk 1.8 · 로스터 줄 23.8 …)이 그대로 맞는다 — --vw/--vh 를 주면 안 못 박는다(해상도 단 검산). */
  screen: WIDE
    ? { width: Number(flag("--vw", 1280)), height: Number(flag("--vh", 900)) }
    : { width: Number(flag("--vw", 390)), height: Number(flag("--vh", 844)) },
  deviceScaleFactor: Number(flag("--dpr", 2)),
  ...(has("--ios") ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", hasTouch: true, isMobile: true } : {}),
});
page.on("pageerror", (e) => console.error("페이지 오류:", String(e).slice(0, 400)));
/* WebGL 경고(INVALID_OPERATION 따위)는 호출마다 콘솔로 흘러 GL 호출 자체를 느리게 만든다 — 몇 줄인지 센다. */
let glWarn9 = 0; let glWarnFirst9 = "";
page.on("console", (m) => { const t = m.text(); if (/WebGL|GL_|INVALID/.test(t)) { glWarn9 += 1; if (!glWarnFirst9) glWarnFirst9 = t.slice(0, 300); } });
process.on("exit", () => { if (glWarn9) console.log(`[GL 경고] ${glWarn9}줄 · 첫 줄: ${glWarnFirst9}`); });
/* --noro — ResizeObserver를 없앤 채로 띄운다. '재서 맞추는' 배치가 측정이 안 왔을 때
   어떻게 무너지는지 보려던 손잡이다.
   ⚠ **이 앱은 RO 없이는 아예 안 뜬다**(지도 벡터층·무대 재기가 그것으로 산다) — 그래서
     이 깃발로는 폴백을 못 태운다. 남겨 두는 까닭은 그 사실 자체가 기록이라서다: 배치의
     안전을 '측정이 틀렸을 때'로 시험하려 하지 말고 **구조로** 보장할 것(지금은 좁은
     배치에서 판의 max-height를 아예 안 걸어, 잘릴 수 있는 자리가 없다). */
/* 워커 메시지 크기 계측(--msgsize) — 메인→워커(world/view/clock)와 워커→메인(frame)의 바이트를 잰다.
   구조화 복제 비용의 자(JSON 길이 + 형식 배열 바이트). 폰에서 워커 분리가 버벅이는 까닭을 숫자로 보려고. */
if (has("--msgsize")) {
  await page.addInitScript(() => {
    const st = { up: {}, frames: 0, fJson: 0, fTyped: 0, fOps: 0, fFx: 0, fDom: 0, fMax: 0 };
    window.__msgStat = st;
    const sizeOf = (m) => {
      let typed = 0;
      const json = JSON.stringify(m, (k, v) => {
        if (ArrayBuffer.isView(v)) { typed += v.byteLength; return undefined; }
        if (v instanceof Map) return [...v.entries()];
        return v;
      });
      return { json: json ? json.length : 0, typed };
    };
    const origPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, ...rest) {
      try { const z = sizeOf(m); const t = (m && m.type) || "?"; const e = (st.up[t] ||= { n: 0, json: 0, typed: 0 }); e.n += 1; e.json += z.json; e.typed += z.typed; } catch {}
      if (m && m.type === "cmd") (st.cmds ||= []).push([Math.round(performance.now()), m.t0, m.playing ? 1 : 0, m.speed]);
      return origPost.call(this, m, ...rest);
    };
    const d = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage");
    Object.defineProperty(Worker.prototype, "onmessage", {
      set(fn) {
        d.set.call(this, (ev) => {
          const m = ev.data;
          if (m && m.type === "ready" && m.bytes) st.ready = m.bytes;
          if (m && m.type === "frame" && m.buf) {
            // 싼 설계도: buf(Float64Array, transfer) + strs + 안개(바뀐 장만). json 몫은 문자열 표뿐이다.
            const fog = m.fog ? (m.fog.visSrc.byteLength + (m.fog.explored ? m.fog.explored.byteLength : 0) + (m.fog.visNow ? m.fog.visNow.byteLength : 0)) : 0;
            const json = JSON.stringify(m.strs).length;
            st.frames += 1; st.fJson += json; st.fTyped += m.buf.byteLength + fog;
            st.fOps += m.n || 0; if (m.fog) st.fFog = (st.fFog || 0) + 1;
            st.fMax = Math.max(st.fMax, json + m.buf.byteLength + fog);
            (st.fr ||= []).push([Math.round(performance.now()), m.t, m.cur]);
            if (m.fog && m.fog.explored && (st.fogs ||= []).length < 8) {
              const ex = m.fog.explored; let seen = 0; for (let i = 0; i < ex.length; i += 1) if (ex[i] !== 65535) seen += 1;
              const vs = m.fog.visSrc; let lit = 0; for (let i = 0; i < vs.length; i += 1) if (vs[i] > 0) lit += 1;
              st.fogs.push(`${(performance.now() / 1000).toFixed(1)}s t${m.t.toFixed(1)} 본곳 ${(100 * seen / ex.length).toFixed(0)}% 밝음 ${(100 * lit / Math.max(1, vs.length)).toFixed(0)}%`);
            }
          }
          fn(ev);
        });
      },
      get() { return d.get.call(this); },
      configurable: true,
    });
  });
}
/* --resfill(2026-10-11) — 픽스처 자원 절이 비어 전광판 자원 칸이 빈칸이다. 빈 자원 칸에 가장 긴 꼴("12345/9999")을 늘 채워 칸 폭을 검산한다. */
if (has("--resfill")) {
  await page.addInitScript(() => {
    setInterval(() => {
      for (const c of document.querySelectorAll(".scr-dock-cell.is-res")) {
        if (c.querySelector(".scr-dock-lab") || c.textContent) continue;
        c.innerHTML = '<span class="scr-motion-stat-min">12345</span><span class="scr-dock-ressep">/</span><span class="scr-motion-stat-gas">9999</span>';
      }
    }, 200);
  });
}
if (has("--noro")) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "ResizeObserver", { value: undefined, configurable: true });
  });
}
// 한 손 줌 검증(--quickzoom)·손가락 배치 검증(--coarse) — (pointer: coarse)를 참으로
// 스텁해 손가락 기기로 꾸민다. 전체화면 배치는 폭이 아니라 이 값으로 갈린다.
if (has("--quickzoom") || has("--coarse")) {
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes("pointer: coarse")
      ? { matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false }
      : orig(q));
  });
}
await page.route("http://perf-check.local/fonts/**", (r) => {   // 재생기 글꼴(dist/fonts)
  const f9 = join(ROOT, "dist", "fonts", decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/fonts\//, "")));
  return existsSync(f9) ? r.fulfill({ body: readFileSync(f9), contentType: f9.endsWith(".ttf") ? "font/ttf" : "font/woff2" }) : r.fulfill({ status: 404, body: "" });
});
await page.route("http://perf-check.local/*", (r) => r.fulfill({
  contentType: "text/html",
  /* 실제 페이지의 감싸개(--wrap <클래스>) — 게임 상세·게임 페이지에는 맵 줄을 뷰포트
     폭으로 빼는 규칙이 걸려 있어, 그 안에서만 나는 어긋남을 여기서 재현한다. */
  /* ★ 뷰포트 meta가 있어야 **폰이 폰답게** 눕는다(수리) — 없으면 isMobile 모드에서
     레이아웃 뷰포트가 980px로 잡혀, 폭에 걸린 규칙(max-width: 900/1159)이 통째로 안
     걸린다. 그 탓에 --ios 측정만 다른 값을 내고 있었다(조종부 줄 48 vs 44). */
  body: `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0"><div class="${WRAP}" style="padding:0 16px"><div id=root></div></div>`,
}));
// --diag — 진단 오버레이(#diag)를 켠 채로 띄운다(재생기가 주소 해시로 판단한다).
/* 주소 해시 — #diag(진단 표시). */
/* --crowd N — 덜어내기 단을 강제한다(#crowd=N). 덜어낸 값이 얼마나 주는지 잴 때. */
/* --hash <x> — 그 밖의 해시 깃발을 그대로 붙인다(예: --hash gl=1 → WebGL 유닛 붓 시제). */
/* GL 합성은 기본으로 뺀다(`glblit=0`) — 헤드리스 크로뮴은 소프트웨어 GL(SwiftShader)이라 WebGL 캔버스 → 2D drawImage 가 ReadPixels 로 서서
   한 장에 1~2초(실측: 1454² · 옵션 무관)다. 실기 GPU 엔 없는 값이라 붙이면 GL 프레임이 통째로 그 값이 된다. `--glblit` 로 도로 붙인다. */
/* ★ 번짐(블룸)도 기본으로 뺀다(`glbloom=0` · `--bloom` 으로 도로 켠다)(2026-09) — SwiftShader 는 **렌더 타깃을 바꾸는 것**
   (번짐 판 FBO 바인드 + 지우기)만으로 한 장에 3초를 쓴다. 실측: 번짐 판을 짓고 곧장 돌아오면 283ms · 바인드·지우기까지만
   하고 돌아와도 3133ms — 그 뒤의 깊이·발광·흐림 어느 단을 빼도 안 줄었다. 곧 GPU 일이 아니라 소프트웨어 GL 의 자리다.
   옛 측정(번짐 켜도 p50 같음)은 화면에 빛나는 개체가 **없어**(stat.bloom 0) 그 길을 안 지난 것이었고, 늘 켜진 빛
   (파일런 보석·캐리어 창·부속 활성)이 EMIT_FILL9 에 든 뒤로는 매 장 지난다(stat.bloom 12). 실기 GPU 에서 FBO 바인드는
   공짜라 이 3초는 헤드리스만의 값이다 — 재면 늘 헤드리스의 그 값이 되므로 뺀다. */
/* ★ MRT 판(gl9 mrtEnsure)도 기본으로 뺀다(`glmrt=0` · `--mrt` 로 도로 켬)(2026-09) — SwiftShader 는 FBO 에 그리고 캔버스로 옮기는
   값이 커서(실측 p50 50 → 67ms · p95 1.5초 튐) 실기에 없는 몫이 계측을 덮는다. 번짐을 뺀 것과 같은 까닭이다. */
/* 해상도 단 못 박기(2026-10) — PC 기본 창(1280×900)은 FHD 단(0.75)이라, --vw/--vh 없는 PC 돌림은 `ui=1`(QHD 단 · 개발 기준)로 못 박는다
   (옛 실측과 견주려고). --hash ui=… 를 주면 그 값. */
const uiPin9 = WIDE && !has("--vw") && !has("--vh") && !/(^|,)ui=/.test(String(flag("--hash", "") || "")) ? "ui=1" : "";
const hash9 = [uiPin9, has("--diag") ? "diag" : "", has("--crowd") ? `crowd=${flag("--crowd", 2)}` : "", String(flag("--hash", "") || ""), has("--glblit") ? "" : "glblit=0", has("--bloom") || /glbloom=/.test(String(flag("--hash", "") || "")) ? "" : "glbloom=0", has("--mrt") || /glmrt=/.test(String(flag("--hash", "") || "")) ? "" : "glmrt=0"].filter(Boolean).join(",");
await page.goto(`http://perf-check.local/${hash9 ? `#${hash9}` : ""}`);
/* 앱 CSS — 레이어 크기·자리·이펙트가 전부 클래스에 실려 있어 없으면 화면이 안 선다.
   빌드 산출물(dist)의 CSS를 그대로 얹는다(npm run build가 먼저 돌아 있어야 한다). */
const { readdirSync } = await import("node:fs");
/* 빌드 산출물의 CSS 자리가 두 가지다 — 라이브러리 빌드는 dist/styles.css 한 장이고,
   앱 빌드는 dist/assets/*.css다. 둘 다 본다(없는 쪽은 건너뛴다). */
const cssDir = [join(ROOT, "dist", "assets"), join(ROOT, "dist")]
  .find((d) => existsSync(d) && readdirSync(d).some((f) => f.endsWith(".css"))) ?? join(ROOT, "dist");
const cssFile = existsSync(cssDir) ? readdirSync(cssDir).find((f) => f.endsWith(".css")) : null;
if (cssFile) {
  // addStyleTag는 이 오리진에서 onerror가 떠서(원인 미상) DOM으로 직접 붙인다.
  await page.evaluate((css) => {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }, readFileSync(join(cssDir, cssFile), "utf8"));
}
else console.warn("⚠ dist CSS 없음 — npm run build 먼저. 화면 배치가 안 맞을 수 있다.");
/* 재생기 글꼴(2026-10-16 · dist/fonts/scplay-fonts.css — 앱은 "scplay/fonts.css" 로 싣는다) — 글꼴 파일은 아래 길로 dist/fonts 에서 준다. */
{
  const fcss9 = join(ROOT, "dist", "fonts", "scplay-fonts.css");
  if (existsSync(fcss9)) await page.evaluate((css) => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); },
    readFileSync(fcss9, "utf8").replace(/url\("\.\//g, 'url("http://perf-check.local/fonts/'));
}
await page.addScriptTag({ content: js, type: "module" });
await page.waitForFunction("!!window.__mount");
await page.evaluate(([z, d, mw, mh, cx, cy, tr, t0, w9, sp9, ch9, ask9]) => {
  window.__zoom = z; window.__deg = d; window.__mapw = mw; window.__maph = mh;
  window.__cx = cx; window.__cy = cy; window.__track = tr; window.__t = t0; window.__winner = w9; window.__speed = sp9; window.__chat = ch9; window.__ask = ask9;
}, [Number(flag("--zoom", 1)), Number(flag("--deg", 90)),
  Number(flag("--mapw", 128)), Number(flag("--maph", 128)),
  Number(flag("--cx", 0.5)), Number(flag("--cy", 0.5)), flag("--track", "") || null, Number(flag("--t", 46)),
  Number(flag("--winner", 0)), Number(flag("--speed", 1)), has("--chat"), has("--ask")]);   // --winner 1|2 — 이긴 편(로스터 칩 트로피 검산 · 끝 0.5초 안에서만 뜨므로 --t 118.9 와 함께)
if (has("--res")) await page.evaluate((rx) => { window.__resx = rx; }, RES_EXTRA9.filter((r) => !r[2]));   // --res 미네랄(간헐천은 본래 자리)
await page.evaluate(([m, pl, wj, tb]) => window.__mount(m, pl, wj, tb), [world.motion, world.players, walkFixture, makeTerrain()]);
/* --loadshot x.png(2026-10-16, 요청: "모델 굽는 중 등의 표시를 모두 L O A D I N G 글자 띄우기로") — 올린 직후 로딩 표시(.scr-motion-simnote)가 서면 그 둘레를 찍고 글을 적는다. */
if (flag("--loadshot", null)) {
  const ok9 = await page.waitForSelector(".scr-motion-simnote", { timeout: 20000 }).then(() => true, () => false);
  if (ok9) {
    await page.waitForTimeout(350);
    const r9 = await page.evaluate(() => { const e = document.querySelector(".scr-motion-simnote"); const b = e.getBoundingClientRect();
      return { txt: e.textContent, aria: e.getAttribute("aria-label"), x: b.x, y: b.y, w: b.width, h: b.height, fs: getComputedStyle(e).fontSize }; });
    console.log(`[로딩] "${r9.txt}" (${r9.aria}) · ${Math.round(r9.w)}×${Math.round(r9.h)} · 글자 ${r9.fs}`);
    await page.screenshot({ path: String(flag("--loadshot")), clip: { x: Math.max(0, r9.x - 120), y: Math.max(0, r9.y - 60), width: r9.w + 240, height: r9.h + 120 } });
  } else console.log("[로딩] 표시 안 섬(20초)");
}
// 재생이 실제로 그려질 때까지 — blit이 돌기 시작하면 준비된 것이다.
// GL 붓(기본 켬)은 판을 안 찍는다 — 그린 개체 수(__glInst9)로도 준비를 안다.
/* --light(2026-10-23) — 앱의 라이트 테마 깃발(html.scr-light-theme)을 단다 — 보기 모드 판·요약 중 독의 클레이 메탈 꼴 검산. */
if (has("--light")) await page.evaluate(() => document.documentElement.classList.add("scr-light-theme"));
if (has("--ask")) await page.waitForSelector(".scr-mode-ask", { timeout: 60000 });   // 보기 모드 판은 고를 때까지 시계를 세운다 — 그림 시작을 안 기다린다
else await page.waitForFunction("(window.__spritePerf && (window.__spritePerf.last.blit + window.__spritePerf.last.direct) > 0) || (window.__glInst9 > 0)", null, { timeout: 30000 });
// 첫 굽기(스프라이트 캐시 채우기)가 가라앉게 잠깐 둔다(--warm <ms>, 0 이면 첫 굽기까지 표본에 든다).
await page.waitForTimeout(Number(flag("--warm", 2500)));

/* --namefit(2026-10-13, 지적: "전광판 로스터 … 글자가 너무 커지면서 모바일에서 세 글자도 안 들어가") — 전광판 이름 칩마다 글자·칸 폭·잘림(scrollWidth > clientWidth)과 줄 키(--rp)·글자(--rf)·판 폭을 찍는다. */
/* --fontprobe(2026-10-16, 요청: "한글과 영어 높이와 크기 잘 어울리게 기본 필터") — 재생기 뿌리 안에서 영문만·한글만·섞은 줄의 줄 상자 키와
   글자 잉크 높이(대문자 H · 한글 가 — 캔버스에 그 글꼴로 찍어 잰다)를 견준다. 글꼴이 실제로 실렸는지(document.fonts.check)도. */
if (has("--fontprobe")) {
  await page.waitForTimeout(800);
  const r9 = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = document.querySelector(".scr-motion-root"); if (!root) return "뿌리 없음";
    const fam = getComputedStyle(root).fontFamily;
    const mk = (txt, w) => { const s = document.createElement("span"); s.textContent = txt; s.style.cssText = `font-size:40px;font-weight:${w};line-height:normal;white-space:nowrap`; root.appendChild(s); const b = s.getBoundingClientRect(); s.remove(); return Math.round(b.height * 10) / 10; };
    const ink = (ch, w) => { const c = document.createElement("canvas"); c.width = 200; c.height = 200; const x = c.getContext("2d"); x.font = `${w} 100px ${fam}`; x.textBaseline = "alphabetic"; const m = x.measureText(ch); return Math.round(m.actualBoundingBoxAscent); };
    const loaded = ["SCP Rasheeq", "SCP NanumSquare Neo"].map((f) => `${f}:${document.fonts.check(`40px "${f}"`, f.includes("Neo") ? "가" : "H") ? "실림" : "안 실림"}`).join(" ");
    return `${loaded} · 줄키(40px) 영문 ${mk("HHH", 400)} 한글 ${mk("가가가", 400)} 섞음 ${mk("H가H", 400)} · 굵게 영문 ${mk("HHH", 700)} 한글 ${mk("가가가", 700)}`
      + ` · 잉크(100px) H ${ink("H", 400)} 0 ${ink("0", 400)} 가 ${ink("가", 400)} 한 ${ink("한", 400)} · 글꼴 ${fam.slice(0, 60)}`;
  });
  console.log(`[글꼴] ${r9}`);
}
/* --capfit(2026-10-13, 요청: "pc 화면 주인과 자막 25프로 축소 · 짝수 픽셀") — 화면 주인 이름표·자막의 계산된 글자 크기·상자(짝수인지 ✔). */
if (has("--capfit")) {
  await page.waitForTimeout(600);
  const r9 = await page.evaluate(() => {
    const one = (sel, lab) => { const el = document.querySelector(sel); if (!el) return `${lab} 없음`; const b = el.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(el).fontSize);
      return `${lab} 글자 ${fs}px${fs % 2 === 0 ? "✔" : "✘홀수"} · 상자 ${b.width.toFixed(1)}×${b.height.toFixed(1)}`; };
    return [one(".scr-fs-solo .scr-fs-solo-cap", "화면 주인"), one(".scr-cast-caption", "자막"), one(".scr-split-cell .scr-fs-solo-cap", "분할 칸 주인")].join(" · ");
  });
  console.log(`[자막 크기] ${r9}`);
}
if (has("--namefit")) {
  const r9 = await page.evaluate(() => {
    const ro = document.querySelector(".scr-dock-roster"); if (!ro) return "로스터 없음";
    const cs = getComputedStyle(ro);
    const names = [...ro.querySelectorAll(".scr-dock-name")].map((el) => {
      const t = el.querySelector(".scr-dock-nametxt, .scr-motion-teamcol-nametxt") ?? el;
      return `${el.textContent.trim()}:${Math.round(el.getBoundingClientRect().width)}w/${getComputedStyle(el).fontSize}${t.scrollWidth > t.clientWidth + 1 ? "✂" : ""}`;
    });
    const nm9 = ro.querySelector(".scr-dock-names.is-grid2"); const cam9 = ro.querySelector(".scr-dock-names .scr-roster-cam"); const rw9 = ro.querySelector(".scr-dock-names .scr-dock-row");
    const bd9 = ro.querySelector(".scr-dock-name .scr-motion-teamcol-race"); const ch9 = ro.querySelector(".scr-dock-name");
    const geo9 = `기둥 ${nm9 ? Math.round(nm9.getBoundingClientRect().width) : "-"} · 줄 ${rw9 ? Math.round(rw9.getBoundingClientRect().width) : "-"} · 카메라 ${cam9 ? Math.round(cam9.getBoundingClientRect().width) : "-"} · 배지 ${bd9 ? Math.round(bd9.getBoundingClientRect().width) : "-"} · 칩 여백 ${ch9 ? getComputedStyle(ch9).paddingLeft : "-"}`;
    const mp9 = document.querySelector(".scr-fs-minipanel"); const dr9 = document.querySelector(".scr-fs-dockrow"); const ip9 = document.querySelector(".scr-motion-infodock");
    const box9 = (e) => e ? `${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}` : "-";
    return `독 줄 ${box9(dr9)} · 미니맵 판 ${box9(mp9)} · 인포 ${box9(ip9)} · ${geo9} · 판 ${Math.round(ro.getBoundingClientRect().width)}×${Math.round(ro.getBoundingClientRect().height)} · --rp ${cs.getPropertyValue("--rp").trim()} · 글자 ${cs.fontSize} · ${names.join(" ")}`;
  });
  console.log(`[이름 맞춤] ${r9}`);
}
/* --pause(2026-10-12) — 들어오자마자 멈춘다(--t 그 시각의 짧은 효과 — 승하차 줄 1초 같은 것 — 를 찍을 때 · 재생 단추를 한 번 누른다). */
if (has("--pause")) { await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement) b.click(); }); await page.waitForTimeout(600); }
const SHOT = flag("--shot", null);
/* --press <css>(2026-10-23) — 그 요소 가운데서 마우스를 눌러 둔 채(:active) 끝 사진을 찍는다(크리스탈 단추의 누름 꼴 검산). */
if (has("--press")) {
  const b9 = await page.locator(String(flag("--press"))).first().boundingBox();
  if (b9) { await page.mouse.move(b9.x + b9.width / 2, b9.y + b9.height / 2); await page.mouse.down(); await page.waitForTimeout(300); }
  console.log(`[누름] ${flag("--press")} ${b9 ? "눌림" : "못 찾음"}`);
}
/* --ask [초](2026-10-23) — 보기 모드 판이 섰나 · 시계가 서 있나를 찍고(--shot 이면 판 사진) [요약]을 눌러 N초 동안 알약·시계·배속을 0.5초마다 찍는다. */
if (has("--ask")) {
  const secs9 = Number(flag("--ask", 30)) || 30;
  const clock9 = () => page.evaluate(() => document.querySelector(".scr-motion-clock")?.textContent ?? "?");
  await page.waitForTimeout(2500);
  const c0 = await clock9(); await page.waitForTimeout(1500); const c1 = await clock9();
  console.log(`[보기 모드] 판 ${await page.locator(".scr-mode-ask").count()} · 시계 ${c0} → ${c1}(서 있어야 한다)`);
  if (SHOT) await page.screenshot({ path: String(SHOT).replace(/\.png$/, "_ask.png") });
  await page.locator(".scr-mode-ask-btn").first().click();
  let last9 = "";
  for (let i9 = 0; i9 < secs9 * 2; i9 += 1) {
    await page.waitForTimeout(500);
    const r9 = await page.evaluate(() => ({ pill: (() => { const p = document.querySelector(".scr-digest-pill"); if (!p) return "-"; const b = p.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return `${p.querySelector("span")?.textContent} @${b.left.toFixed(0)},${b.top.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)} 위=${e === p || p.contains(e) ? "제것" : e?.className?.toString().slice(0, 40)}`; })(), clock: document.querySelector(".scr-motion-clock")?.textContent ?? "?",
      spd: document.querySelector(".scr-motion-speed, .scr-spd-btn, [aria-label*='배속']")?.textContent ?? "", toast: document.querySelector(".scr-replay-toast, [role=status].scr-toast")?.textContent ?? "" }));
    const k9 = `${r9.pill}|${r9.toast}`;
    if (k9 !== last9 || i9 % 4 === 0) console.log(`  +${(i9 / 2 + 0.5).toFixed(1)}s 알약 ${r9.pill} · 시계 ${r9.clock} · 배속 ${r9.spd.trim()} ${r9.toast ? `· 알림 ${r9.toast}` : ""}`);
    if (i9 === 6 && SHOT) await page.screenshot({ path: String(SHOT) });
    last9 = k9;
  }
}
/* --castoff — 들어오자마자 켜진 자동 중계(AUTO)를 끈다(2026-10-09 — 중계 꺼진 단독 화면 검산 · 무대 왼아래 미니맵이 손짓을 받는 꼴). */
if (has("--castoff")) {
  await page.evaluate(() => { const b = document.querySelector(".scr-roster-cam-auto.is-on"); if (b instanceof HTMLElement) b.click(); });
  await page.waitForTimeout(500);
}
/* --zoomlockprobe — 중계 중엔 휠·↑ 배율이 잠기나(2026-10-09, 요청: "중계가 켜진 순간 드래그 줌 다 막혀야해") — 켠 채 휠·ArrowUp 뒤 배율,
   카메라를 놓은 뒤 같은 손짓의 배율을 찍는다(`__scrDiag.zoom` 은 붓이 장마다 적는다 · --diag 와 함께). */
if (has("--zoomlockprobe")) {
  const z9 = () => page.evaluate(() => window.__scrDiag?.zoom ?? null);
  const poke9 = async () => {
    const m9 = await page.$(".scr-motion-map"); const b9 = await m9.boundingBox();
    await page.mouse.move(b9.x + b9.width / 2, b9.y + b9.height / 2);
    await page.mouse.wheel(0, -300); await page.waitForTimeout(500);
    const zw9 = await z9();
    await page.keyboard.press("ArrowUp"); await page.waitForTimeout(500);
    return [zw9, await z9()];
  };
  const on9 = await page.evaluate(() => !!document.querySelector(".scr-dock-roster .scr-roster-cam.is-on"));
  const dial9 = () => page.evaluate(() => document.querySelector(".scr-zoomdial-val")?.textContent ?? "-");
  const d0 = await dial9();
  const z0 = await z9(); const [zw, zk] = await poke9();
  console.log(`[배율 잠금] 중계 ${on9 ? "켬" : "끔"} · 전 ${z0} · 휠 뒤 ${zw} · ↑ 뒤 ${zk}`);
  /* 2026-10-19 — 단독 중계는 확대가 열렸다(상한 = 기본 × 2) · 배율 원(.scr-zoomdial)이 기본 대비 값을 보이고 누르면 기본으로. */
  const d1 = await dial9();
  if (has("--shot")) await page.screenshot({ path: String(flag("--shot", "x.png")).replace(/\.png$/, "_zoomed.png") });
  await page.evaluate(() => { const b = document.querySelector(".scr-zoomdial"); if (b instanceof HTMLElement) b.click(); });
  await page.waitForTimeout(600);
  console.log(`[배율 원] 전 ${d0} · 확대 뒤 ${d1} · 누른 뒤 ${await dial9()} (배율 ${await z9()})`);
  if (on9) {
    await page.evaluate(() => { for (const b of document.querySelectorAll(".scr-dock-roster .scr-roster-cam.is-on")) if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(600);
    const z2 = await z9(); const [zw2, zk2] = await poke9();
    console.log(`[배율 잠금] 놓은 뒤 · 전 ${z2} · 휠 뒤 ${zw2} · ↑ 뒤 ${zk2}`);
  }
}
/* 폭 바꾸기(--resizeto W) — 뜬 뒤 창 폭을 조금 바꾼다(2026-10, 지적: "아직 흐려지는데" — 지형 판의 '거의 같은 판' 지름길이
   폭이 2% 안쪽으로 바뀌면 옛 판을 늘려 붙여 지도 전체를 재표본했다). --dockprobe 의 [캔버스] 줄에서 scr-mapvec-sharp 의
   w(배킹)와 bw(화면 폭)가 같아야 한다(dpr 1). */
if (has("--resizeto")) {
  await page.waitForTimeout(1500);
  /* --pausefirst — 멈춘 뒤 폭을 바꾼다(2026-10, 지적: "지형뿐 아니라 모델이 흐려" — 멈춘 동안은 붓이 안 돌아 옛 배킹이 새 CSS 크기로 늘어났다). */
  if (has("--pausefirst")) { await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement) b.click(); }); await page.waitForTimeout(600); }
  const vp0 = page.viewportSize();
  await page.setViewportSize({ width: Number(flag("--resizeto", vp0.width)), height: vp0.height });
  await page.waitForTimeout(1500);
}
/* 폭 훑기(--wsweep W0,W1,STEP [--wsweepdir DIR]) — 창 폭을 차례로 바꾸며 폭마다 `흐림:` 줄·상자·캔버스 배킹을 찍고 지도 상자만 잘라
   DIR/w<폭>.png 로 남긴다(2026-10, 지적: "브라우저 폭을 줄이거나 늘리면 특정 크기에서만 흐려지고 … 특정 크기는 여러 구간임").
   선명도는 밖에서 잰다(`$S/sharp.py` — 라플라시안 분산). --diag 와 함께. */
if (has("--wsweep")) {
  const [w0, w1, st] = String(flag("--wsweep", "1200,1300,10")).split(",").map(Number);
  const dir9 = String(flag("--wsweepdir", "."));
  const vp0 = page.viewportSize();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement) b.click(); });   // 멈춘 채 — 폭만 바꾼다
  await page.waitForTimeout(600);
  for (let w9 = w0; w9 <= w1; w9 += st) {
    await page.setViewportSize({ width: w9, height: vp0.height });
    await page.waitForTimeout(1800);
    const r9 = await page.evaluate(() => {
      const blur = Array.from(document.querySelectorAll(".scr-motion-diag div")).map((d) => d.textContent ?? "").find((t) => t.startsWith("흐림:")) ?? null;
      const d = window.__scrDiag;
      const m = document.querySelector(".scr-motion-map");
      const b = m ? m.getBoundingClientRect() : null;
      const cv = (sel) => { const c = document.querySelector(sel); if (!c) return null; const r = c.getBoundingClientRect(); return `${c.width}/${r.width.toFixed(2)}`; };
      return { blur, ppt: d ? `${d.ppt}/${d.needed}` : "", box: b ? [b.left, b.top, b.width, b.height] : null,
        unit: cv(".scr-motion-unitlayer"), terr: cv(".scr-mapvec-sharp"), base: cv(".scr-mapvec-base") };
    });
    console.log(`[훑기 ${w9}] 상자 ${r9.box ? r9.box.map((v) => v.toFixed(2)).join(",") : "-"} · 유닛 ${r9.unit} · 지형 ${r9.terr} · 밑판 ${r9.base} · 타일당 ${r9.ppt}`);
    if (r9.blur) console.log(`[훑기 ${w9}] ${r9.blur}`);
    if (r9.box) await page.screenshot({ path: `${dir9}/w${w9}.png`, clip: { x: r9.box[0], y: r9.box[1], width: r9.box[2], height: r9.box[3] } }).catch((e) => console.log(`[훑기 ${w9}] 사진 실패 ${e?.message ?? e}`));
  }
  await browser.close();
  process.exit(0);
}
/* 흔들림 자(--shakeprobe [초]) — 중계 재생 중 rAF 마다 상자 자리·지형 변환·유닛/GL 변환·배율과 마지막 보기 사건(__scrDiag.lastEv)을
   적어, 기하가 바뀐 프레임과 선택(sel)·카메라(cam) 사건을 나란히 낸다(2026-10, 지적: "중계모드에서 선택이 바뀔때 같은 화면안에 있는데도
   미묘하게 화면이 흔들려"). `--diag` 와 함께. */
if (has("--shakeprobe")) {
  const secs9 = Number(flag("--shakeprobe", 12)) || 12;
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const L = []; window.__shake9 = L;
    const tick = () => {
      const d = window.__scrDiag || {};
      const box = document.querySelector(".scr-motion-map"); const br = box ? box.getBoundingClientRect() : null;
      const tp = document.querySelector(".scr-mapvec-sharp"); const u = document.querySelector(".scr-motion-unitlayer"); const g = document.querySelector(".scr-motion-gl9");
      L.push({ t: Math.round(performance.now()), box: br ? `${br.left.toFixed(2)},${br.top.toFixed(2)}` : "-", terr: tp ? tp.style.transform : "-",
        u: u ? u.style.transform : "-", g: g ? g.style.transform : "-", z: d.zoom, ev: d.lastEv || "" });
      if (L.length < 3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(secs9 * 1000);
  const L9 = await page.evaluate(() => window.__shake9 || []);
  let prev = null; const out = [];
  for (const r of L9) {
    const geo = `${r.box}|${r.terr}|${r.u}|${r.g}|${r.z}`;
    const evNew = prev && r.ev !== prev.ev;
    const geoNew = prev && geo !== `${prev.box}|${prev.terr}|${prev.u}|${prev.g}|${prev.z}`;
    if (evNew || geoNew) out.push(`${r.t}ms${evNew ? ` 사건 ${r.ev}` : ""}${geoNew ? ` 기하 상자 ${r.box} 지형 ${r.terr} 유닛 ${r.u} GL ${r.g} 배율 ${r.z}` : ""}`);
    prev = r;
  }
  console.log(`[흔들림] ${L9.length}장 · 바뀐 프레임 ${out.length}`);
  for (const l of out.slice(0, 120)) console.log(`[흔들림] ${l}`);
  await browser.close();
  process.exit(0);
}
/* 파수꾼 자(--guardprobe): 멈춘 채 지도 상자의 CSS 크기만 바꾼다(렌더 없이) — 유닛 캔버스 배킹이 0.4초 안에 따라와야 한다
   (2026-10, 지적: "지형뿐 아니라 모델이 흐려"). */
if (has("--guardprobe")) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement) b.click(); });
  await page.waitForTimeout(800);
  const rd = () => page.evaluate(() => { const c = document.querySelector(".scr-motion-unitlayer"); return c ? `${c.clientWidth}x${c.clientHeight} 배킹 ${c.width}x${c.height}` : null; });
  const a9 = await rd();
  await page.evaluate(() => { const m = document.querySelector(".scr-motion-map"); if (m instanceof HTMLElement) { m.style.width = `${m.clientWidth - 13}px`; m.style.height = `${m.clientHeight - 13}px`; } });
  await page.waitForTimeout(100);
  const b9 = await rd();
  await page.waitForTimeout(900);
  console.log("[파수꾼]", a9, "→ 바꾼 직후", b9, "→ 0.9초 뒤", await rd());
}
/* 멈춘 드래그 자(--dragholdprobe): 끌다가 2초 가만히 쥐고 있다가 다시 끈다 — 파수꾼이 멈춘 손짓을 접어도 팬이 안 튀어야 한다
   (2026-10, '손짓 깃발이 남아 지도가 통째로 흐린 채 굳는' 길의 안전망). 첫 끌기 200px · 둘째 100px → 합 300px 이어야 한다. */
if (has("--dragholdprobe")) {
  await page.waitForTimeout(1500);
  const box9 = await page.evaluate(() => { const m = document.querySelector(".scr-motion-map"); const st = document.querySelector(".scr-fs-stage"); const r = (st ?? m).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const pan9 = () => page.evaluate(() => { const c = document.querySelector(".scr-mapvec-sharp"); return c ? c.style.transform : null; });
  const p0 = await pan9();
  await page.mouse.move(box9.x, box9.y); await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) { await page.mouse.move(box9.x - 20 * i, box9.y); await page.waitForTimeout(16); }
  const p1 = await pan9();
  await page.waitForTimeout(2000);
  const g9 = await page.evaluate(() => window.__scrDiag?.gest ?? null);
  for (let i = 1; i <= 5; i += 1) { await page.mouse.move(box9.x - 200 - 20 * i, box9.y); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  console.log("[멈춘 드래그]", p0, "→ 200px", p1, "→ 2초 쥠 뒤 +100px", await pan9(), "· 손짓", g9);
}
/* 독 가장자리 자(--edgeprobe · 2026-10-19, 지적: "이상한 흠이 생기네" — 독 양끝 받침과 쇠판 옆선이 1px 어긋나 쇠판의 깎인 윗모서리가 비쳤다) —
   쇠판(.scr-fs-lower) · 틀 · 양끝 칸 · 받침(틀 여백 --dock-out + 1)의 가로 끝을 찍는다. 받침 바깥 끝 = 쇠판 끝이어야 흠이 없다. */
if (has("--edgeprobe")) {
  await page.waitForTimeout(1500);
  console.log("[독 가장자리]", JSON.stringify(await page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return [+b.left.toFixed(2), +b.right.toFixed(2), +b.top.toFixed(2)]; };
    const fr = document.querySelector(".scr-fs-dockframe");
    const out = fr ? parseFloat(getComputedStyle(fr).getPropertyValue("--dock-out")) : null;
    const ped = (sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el, "::before"); const b = el.getBoundingClientRect();
      return { l: +(b.left + parseFloat(cs.left)).toFixed(2), r: +(b.right - parseFloat(cs.right)).toFixed(2), disp: cs.display }; };
    return { lower: r(".scr-fs-lower"), frame: r(".scr-fs-dockframe"), main: r(".scr-fs-dockmain"), mini: r(".scr-fs-minipanel"), roster: r(".scr-fs-rosterpanel"),
      out, pedMini: ped(".scr-fs-minipanel"), pedRoster: ped(".scr-fs-rosterpanel"), vw: innerWidth };
  })));
}
/* 독 자(--dockprobe): 미니맵·지도 버튼·꼬리 줄의 화면 자리를 찍는다 — 미니맵 키를 조작부에 맞추는 실측의 검산용. */
if (has("--dockprobe")) {
  await page.waitForTimeout(1500);
  /* --scrollby N — 페이지를 N px 내린다(소수 허용 · 2026-10, 지적: "지형뿐 아니라 모델이 흐려" — 스크롤이 지도 상자를 반 화소에 놓나). */
  if (has("--scrollby")) {
    const sb9 = Number(flag("--scrollby", 0));
    await page.evaluate((v) => { const d = document.createElement("div"); d.style.height = "3000px"; document.body.appendChild(d); window.scrollTo(0, v); }, sb9);
    await page.waitForTimeout(1200);
    console.log("[스크롤]", await page.evaluate(() => window.scrollY));
  }
  const r = await page.evaluate(() => {
    const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), h: +b.height.toFixed(2) }; };
    const lyr = document.querySelector(".scr-fs-layer");
    return { mini: q(".scr-fs-minipanel .scr-fs-minimap"), panel: q(".scr-fs-minipanel"), btns: q(".scr-motion-mapbtns"), btn: q(".scr-motion-mapbtns button"),
      bottom: q(".scr-fs-bottom"), lower: q(".scr-fs-lower"), dockrow: q(".scr-fs-dockframe"), play: q(".scr-motion-play"), range: q(".scr-motion-range"), tail: q(".scr-fs-bottom-tail"),
      vars: lyr ? { mini: lyr.style.getPropertyValue("--scr-dock-mini"), mt: lyr.style.getPropertyValue("--scr-dock-mini-mt"), mb: lyr.style.getPropertyValue("--scr-dock-mini-mb") } : null };
  });
  console.log("[독 자]", JSON.stringify(r));
    // 캔버스·무대 폭(체력바 절대 폭 검산용) — 지도 한 타일이 화면 몇 px인지가 여기서 나온다.
    const cvs = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => { const b = c.getBoundingClientRect(); return { cls: c.className.slice(0, 40), cw: c.clientWidth, ch: c.clientHeight, w: c.width, h: c.height, x: +b.left.toFixed(2), y: +b.top.toFixed(2), bw: +b.width.toFixed(2), bh: +b.height.toFixed(2), xf: c.style.transform || "" }; }));
    console.log("[캔버스]", JSON.stringify(cvs));
    console.log("[지형 진단]", JSON.stringify(await page.evaluate(() => { const d = window.__scrDiag; return d ? { ppt: d.ppt, needed: d.needed, scale: d.scale, css: d.mapCss, back: d.mapBack, unitScale: d.unitScale, unitBack: d.unitBack, unitCss: d.unitCss } : null; })));
    /* 흐림 진단 줄(ReplayMotionPlayer blurDiag9 — `--diag` 로 켠 머리 줄 아래 한 줄) — 상자·캔버스의 기기 화소 자리 · 조상 변환 · 뷰 배율 · 손짓. */
    const blur9 = await page.evaluate(() => Array.from(document.querySelectorAll(".scr-motion-diag div")).map((d) => d.textContent ?? "").find((t) => t.startsWith("흐림:")) ?? null);
    if (blur9) console.log("[흐림]", blur9);
}
/* 목록 자(--pickshot <png>): TV 단추의 목록을 **연 채** 찍는다(2026-09, 지적: "버튼줄의 버튼 셀렉트 목록이
   화면캡션(~화면)에 가려져") — 자막(.scr-motion-castbar)과 목록(.scr-motion-pickmenu)의 겹 무게는 정지 그림에서만
   보인다. 중계가 켜진 채(기본값) 목록을 열면 둘이 한 자리에 겹치므로, 목록이 온전히 위에 서야 한다. 상자도 찍는다. */
if (has("--pickshot")) {
  await page.waitForTimeout(1500);
  const r9 = await page.evaluate(() => {
    const b = document.querySelector(".scr-roster-cam-auto");
    if (b instanceof HTMLElement) b.click();
    return !!b;
  });
  await page.waitForTimeout(400);
  const bx9 = await page.evaluate(() => {
    const q = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect();
      return { x: +r.left.toFixed(0), y: +r.top.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0), z: getComputedStyle(el).zIndex }; };
    const m = q(".scr-motion-pickmenu"); const c = q(".scr-motion-infodock");
    /* 겹친 자리의 한가운데에서 맨 위 요소가 목록 안인가 — 그것이 곧 '가려지나'다. */
    let top = null;
    if (m && c) { const x0 = Math.max(m.x, c.x), x1 = Math.min(m.x + m.w, c.x + c.w), y0 = Math.max(m.y, c.y), y1 = Math.min(m.y + m.h, c.y + c.h);
      if (x1 > x0 && y1 > y0) { const el = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2); top = el?.closest(".scr-motion-pickmenu") ? "목록" : (el?.className ?? "?"); } else top = "안 겹침"; }
    /* 목록이 화면 안에 다 드나(2026-09, 지적: "중계 선택목록이 화면 밖으로 넘어감") · 확대 단추의 글자(폰 중계 6배 검산). */
    const fit = m ? (m.x >= 0 && m.x + m.w <= window.innerWidth && m.y >= 0 && m.y + m.h <= window.innerHeight) : null;
    /* 확대 단추가 줄에서 빠져(2026-09) 글자로는 못 읽는다 — 진단표(--diag 로 켠다)의 배율을 읽는다(안 켜면 null). */
    const zoom = (() => { const z = window.__scrDiag?.zoom; return typeof z === "number" && z > 0 ? `${Math.round(z * 10) / 10}배` : null; })();
    return { m, c, top, fit, zoom };
  });
  console.log(`[목록] 단추 ${r9 ? "눌렀다" : "없음"} · 목록 ${JSON.stringify(bx9.m)} · 자막 ${JSON.stringify(bx9.c)} · 겹친 자리 맨 위: ${bx9.top} · 화면 안 ${bx9.fit} · 확대 ${bx9.zoom}`);
  await page.screenshot({ path: String(flag("--pickshot", "pick.png")), timeout: 120000 });
}
/* --campick(2026-10-12, 요청: "모바일 분할 화면 완전제거 및 로스터 클릭시 그사람 화면으로 변경" · "숫자키 1~8로 플레이어 화면 전환") — 로스터 사람 카메라를
   첫째 → 둘째 차례로 누르고, 숫자패드 키(3 · 1 · -/+ · 9 · . · 0 · / · *)를 친 뒤마다 켜진 단추 차례 · 분할 칸 수 · 토스트 글귀를 찍는다. 폰(--ios)은 늘 한 사람 · 칸 0 · 토스트 없음이어야 한다. */
if (has("--campick")) {
  await page.waitForTimeout(800);
  const st9 = (lab) => page.evaluate((lab) => {
    const cams = [...document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")];
    const on = cams.map((b, i) => (b.classList.contains("is-on") ? i + 1 : 0)).filter(Boolean);
    const toast = [...document.querySelectorAll("[class*=toast]")].map((el) => el.textContent.trim()).filter(Boolean).join(" | ");
    return `[카메라 고르기] ${lab}: 켜짐 ${JSON.stringify(on)} · 분할 칸 ${document.querySelectorAll(".scr-split-cell").length} · 토스트 ${toast || "-"}`;
  }, lab);
  const click9 = (k) => page.evaluate((k) => { const b = document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")[k]; if (b instanceof HTMLElement) b.click(); }, k);
  await click9(0); await page.waitForTimeout(400); console.log(await st9("1번 누름"));
  await click9(1); await page.waitForTimeout(400); console.log(await st9("2번 누름"));
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
  /* 2026-10-13 — 화면 키는 숫자패드 한 벌(1~8 · -/+ · 9 전체 · . AUTO · 0 끄기 · / 색) · 스페이스 재생/일시정지 · F 장면 검색 · 윗줄 숫자·P·패드 Enter·* 는 안 먹어야 한다. */
  const kp9 = async (code, lab) => { await page.keyboard.press(code); await page.waitForTimeout(400); console.log(await st9(lab), await auto9()); };
  const auto9 = () => page.evaluate(() => (document.querySelector(".scr-dock-roster .scr-roster-cam-auto")?.classList.contains("is-on") ? "AUTO 켜짐" : "AUTO 꺼짐"));
  await kp9("Numpad3", "패드 3"); await kp9("Numpad1", "패드 1"); await kp9("Numpad1", "패드 1 다시");
  await kp9("NumpadAdd", "패드 +"); await kp9("NumpadAdd", "패드 + 다시"); await kp9("NumpadSubtract", "패드 -"); await kp9("NumpadSubtract", "패드 - 다시");
  await kp9("Digit3", "윗줄 3(안 먹어야)");
  await kp9("Numpad9", "패드 9"); await kp9("Numpad9", "패드 9 다시"); await kp9("NumpadDecimal", "패드 ."); await kp9("NumpadDecimal", "패드 . 다시"); await kp9("Numpad0", "패드 0");
  const col9 = () => page.evaluate(() => document.querySelector(".scr-motion-colorbtn, [aria-label*='색']")?.getAttribute("aria-label") ?? "-");
  console.log("[키] 색 전", await col9()); await page.keyboard.press("NumpadDivide"); await page.waitForTimeout(300); console.log("[키] 패드 / 뒤", await col9());
  const play9 = () => page.evaluate(() => document.querySelector(".scr-motion-play, [aria-label*='일시정지'], [aria-label*='재생']")?.getAttribute("aria-label") ?? "-");
  console.log("[키] 재생 단추 전", await play9());
  await page.keyboard.press("KeyP"); await page.waitForTimeout(400); console.log("[키] P 뒤(안 먹어야)", await play9());
  await page.keyboard.press("NumpadEnter"); await page.waitForTimeout(400); console.log("[키] 패드 Enter 뒤(안 먹어야)", await play9());
  await page.keyboard.press("Space"); await page.waitForTimeout(400); console.log("[키] 스페이스 뒤", await play9());
  await page.keyboard.press("Space"); await page.waitForTimeout(400); console.log("[키] 스페이스 다시", await play9());
  /* 초점이 사람 카메라 단추에 있어도 스페이스는 그 단추를 안 누른다(요청: "엔터키가 현재 선택된 요소 선택으로 동작 안되게" → 스페이스도) — 켜진 단추가 그대로여야 한다. */
  await page.evaluate(() => { const b = document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")[1]; if (b instanceof HTMLElement) b.focus(); });
  console.log(await st9("둘째 단추에 초점"));
  await page.keyboard.press("Space"); await page.waitForTimeout(400); console.log(await st9("초점 둔 채 스페이스"), "·", await play9());
  await page.keyboard.press("Space"); await page.waitForTimeout(400); console.log("[키] 스페이스 되돌림", await play9());
  await page.keyboard.press("NumpadMultiply"); await page.waitForTimeout(300);
  console.log("[키] 패드 * 뒤 손(안 먹어야):", await page.evaluate(() => document.activeElement?.className ?? "-"));
  await page.keyboard.press("KeyF"); await page.waitForTimeout(400);
  console.log("[키] F 뒤 손:", await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}.${a.className} 값「${a.value ?? ""}」` : "-"; }));
  await page.keyboard.press("Space"); await page.waitForTimeout(200);
  console.log("[키] 입력칸에서 스페이스(빈칸이어야):", await page.evaluate(() => `「${document.activeElement?.value ?? "-"}」`), await play9());
}
/* 분할보기 자(--split [png]) — TV 목록에서 '분할'을 골라 칸 수·자리·칸 그림(빈 판인가)·칸 머리 글귀를 찍고, 둘째 칸을 눌러
   독의 정보줄이 그 사람으로 갈리나 본다(2026-09, 요청: "중계에 분할보기 추가 … 독에는 화면을 누른 사람거 보여주기"). */
if (has("--split")) {
  await page.waitForTimeout(800);
  /* --fs 면 분할을 켜기 **전에** 전체화면으로(아래 --fs 갈래는 이 자 뒤라 늦다) — 툴박스·독이 칸을 가리나 본다. */
  if (has("--fs")) {
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((el) => el.getAttribute("aria-label") === "전체화면"); if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(900);
  }
  /* --splitpause — 멈춘 채로 분할을 켠다(2026-09, 지적: 일시정지에서 분할을 고르면 칸 안개·땅이 어긋난다). */
  if (has("--splitpause")) {
    await page.evaluate(() => { const b = document.querySelector(".scr-motion-play"); if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(600);
  }
  /* ★ 전체 분할 = 독 로스터의 사람 카메라 단추를 **다** 켠다(2026-10-09 — TV 목록의 '전체'는 걷혔다 · pickPerson9: 다 고르면 곧 전체). 한 번에 하나씩(상태가 누름마다 갈린다). */
  const nCam9 = await page.evaluate(() => document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)").length);
  for (let k = 0; k < nCam9; k += 1) {
    await page.evaluate((k) => { const b = document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")[k]; if (b instanceof HTMLElement) b.click(); }, k);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(Number(flag("--splitwait", 4000)));
  /* (걷어냄 · 2026-10-09) --capside — 맞대결 머리·표의 가짜 입히기. 자동 분할이 없어졌다(요청 2 · 화면은 늘 한 사람 · 자막은 --capprobe). */
  const sp9 = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll(".scr-split-cell")].map((el) => {
      const r = el.getBoundingClientRect();
      const cv = el.querySelector("canvas");
      let ink = null;
      if (cv instanceof HTMLCanvasElement && cv.width > 0) {
        const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; let lit = 0;
        for (let i = 0; i < d.length; i += 64) { n += 1; if (d[i] + d[i + 1] + d[i + 2] > 90) lit += 1; }
        ink = +(lit / Math.max(1, n)).toFixed(2);
      }
      return { x: +r.left.toFixed(0), y: +r.top.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0), ink,
        cap: el.querySelector(".scr-split-cap")?.textContent ?? null, pick: el.classList.contains("is-pick") };
    });
    const g = document.querySelector(".scr-split")?.getBoundingClientRect();
    const tb = document.querySelector(".scr-tb")?.getBoundingClientRect();
    const lastBottom = Math.max(0, ...[...document.querySelectorAll(".scr-split-cell")].map((el) => el.getBoundingClientRect().bottom));
    const roster = !!document.querySelector(".scr-fs-roster-fixed");
    /* 독 — 인포창 글귀(앞 40자)와 미니맵 안개의 어두운 몫(분할에서 칸을 누르면 그 사람 것으로 바뀌어야 한다). */
    const dk = document.querySelector(".scr-motion-infodock")?.textContent?.replace(/\s+/g, " ").slice(0, 40) ?? null;
    let mf = null;
    const mc = [...document.querySelectorAll(".scr-fs-dockrow canvas")].find((e) => e instanceof HTMLCanvasElement && e.width > 0);
    if (mc instanceof HTMLCanvasElement) {
      const d = mc.getContext("2d")?.getImageData(0, 0, mc.width, mc.height).data;
      if (d) { let n = 0; let dark = 0; for (let i = 0; i < d.length; i += 64) { n += 1; if (d[i] + d[i + 1] + d[i + 2] < 60) dark += 1; } mf = +(dark / Math.max(1, n)).toFixed(3); }
    }
    const cap = `${dk} · 미니맵 어둠 ${mf}`;
    return { grid: g ? [+g.width.toFixed(0), +g.height.toFixed(0)] : null, roster, cap, cells, tbTop: tb ? +tb.top.toFixed(0) : null, cellBottom: +lastBottom.toFixed(0) };
  });
  const a9 = await sp9();
  console.log(`[분할 값] ${await page.evaluate(() => window.__scrDiag?.split ?? "")}`);
  console.log(`[분할] 격자 ${JSON.stringify(a9.grid)} · 로스터 ${a9.roster ? "보임" : "숨김"} · 독 "${a9.cap}" · 칸 바닥 ${a9.cellBottom} · 툴박스 위끝 ${a9.tbTop}`);
  for (const c of a9.cells) console.log(`  칸 ${c.x},${c.y} ${c.w}×${c.h} 잉크 ${c.ink}${c.pick ? " *" : ""} · ${c.cap}`);
  if (has("--tagprobe")) console.log("[미니맵 택]", await tagProbe9(page));
  const shot9 = flag("--split", "");
  if (shot9 && shot9 !== true && String(shot9).endsWith(".png")) await page.screenshot({ path: String(shot9), timeout: 120000 });
  await page.evaluate(() => { const c = document.querySelectorAll(".scr-split-cell")[1]; if (c instanceof HTMLElement) c.click(); });
  await page.waitForTimeout(500);
  const b9 = await sp9();
  console.log(`[분할] 둘째 칸 누른 뒤 독 "${b9.cap}" · 켜진 칸 ${b9.cells.findIndex((c) => c.pick)}`);
  /* --sharepick [png](2026-10-19, 요청: "분할화면에서 공유 스크랩시 한명만 선택하는 팝업 뜨게") — 분할에서 공유를 누르면 사람 고르는 창이 뜨나 ·
     둘째 사람을 고르면 보내는 순간의 링크에 &tr=그 사람이 실리고 자리(z·cx)는 비나 · 보낸 뒤 표가 원래대로(분할 = tr 없음) 돌아오나. */
  if (has("--sharepick")) {
    await page.evaluate(() => { const b = document.querySelector(".scr-sharebtn"); if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(300);
    const sp = await page.evaluate(() => ({
      title: document.querySelector(".scr-sharepick-title")?.textContent ?? null,
      names: [...document.querySelectorAll(".scr-sharepick-item")].map((el) => (el.textContent ?? "").trim()),
    }));
    console.log(`[공유 고르기] 창 ${sp.title ? `"${sp.title}"` : "없음"} · 사람 ${JSON.stringify(sp.names)}`);
    const shotSp = flag("--sharepick", "");
    if (shotSp && shotSp !== true && String(shotSp).endsWith(".png")) await page.screenshot({ path: String(shotSp), timeout: 120000 });
    await page.evaluate(() => { const b = document.querySelectorAll(".scr-sharepick-item")[1]; if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(400);
    console.log(`[공유 고르기] 보낸 링크 "${await page.evaluate(() => window.__shareQ9 ?? "")}" · 창 ${await page.evaluate(() => (document.querySelector(".scr-sharepick") ? "남음" : "닫힘"))} · 뒤 표 ${JSON.stringify(await page.evaluate(() => window.__share9()))}`);
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(300);
    const z9 = await page.evaluate(() => !!document.querySelector(".scr-sharepick"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    console.log(`[공유 고르기] X 키 → 창 ${z9 ? "뜸" : "안 뜸"} · Esc → ${await page.evaluate(() => (document.querySelector(".scr-sharepick") ? "남음" : "닫힘"))}`);
  }
  const pk9 = flag("--splitpick", "");
  if (pk9 && pk9 !== true && String(pk9).endsWith(".png")) { await page.waitForTimeout(1500); await page.screenshot({ path: String(pk9), timeout: 120000 }); console.log(`[분할] 누른 뒤 1.5초 독 "${(await sp9()).cap}"`); }
  await page.evaluate(() => { const c = document.querySelectorAll(".scr-split-cell")[1]; if (c instanceof HTMLElement) c.click(); });
  await page.waitForTimeout(300);
  const c9 = await sp9();
  console.log(`[분할] 같은 칸 다시 누른 뒤 켜진 칸 ${c9.cells.findIndex((c) => c.pick)}`);
  /* 닉네임 다중 선택(2026-09, 요청: "닉네임 누르면 선택 추가돼서 그 사람들만 분할모드로") — 목록을 열고 이름 둘·셋을 차례로 누른다. */
  if (has("--splitsel")) {
    /* 고르기 = 독 로스터의 사람 카메라 단추(2026-10-09 — 옛 TV 목록의 이름 줄). 먼저 전부 끈다(위에서 다 켰다). */
    for (let k = 0; k < nCam9; k += 1) {
      await page.evaluate((k) => { const b = document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")[k]; if (b instanceof HTMLElement) b.click(); }, k);
      await page.waitForTimeout(150);
    }
    for (let k = 0; k < 3; k += 1) {
      await page.evaluate((k) => {
        const it = document.querySelectorAll(".scr-dock-roster .scr-roster-cam:not(.scr-roster-cam-auto):not(.scr-roster-cam-all)")[k];
        if (it instanceof HTMLElement) it.click();
      }, k);
      await page.waitForTimeout(700);
      const d9 = await page.evaluate(() => ({
        cells: document.querySelectorAll(".scr-split-cell").length,
        menu: !!document.querySelector(".scr-motion-pickmenu"),
        on: [...document.querySelectorAll(".scr-motion-pickmenu .scr-motion-pickitem.is-on")].map((el) => (el.textContent ?? "").trim()),
      }));
      console.log(`[분할 고르기] 이름 ${k + 1}개 누른 뒤 · 칸 ${d9.cells} · 목록 ${d9.menu ? "열림" : "닫힘"} · 켜진 줄 ${JSON.stringify(d9.on)}`);
    }
    const shot = flag("--splitsel", "");
    if (shot && shot !== true && String(shot).endsWith(".png")) await page.screenshot({ path: String(shot) });
  }
}
/* 종족 풀 덧줄 자(--mc 와 함께 · 2026-10) — .scr-sup 의 글줄과 그 그릇(로스터 줄 · 현황 상자)의 키를 적는다: 덧줄이 그릇을 못 키웠나.
   덧줄 없는 줄은 인구 칸 글자만 적어 견준다. 로스터는 --rosterfull 뒤(B)에서 읽힌다. */
const supProbe9 = async (label9) => {
  const r9 = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".scr-motion-teamrow, .scr-split-st")) {
      const sup = el.querySelector(".scr-sup");
      const b = el.getBoundingClientRect();
      const v = el.querySelector(".scr-who-v, .scr-motion-stat:nth-child(2)");
      const nm = el.querySelector(".scr-motion-teamcol-name")?.textContent ?? "";
      out.push({ box: el.classList.contains("scr-split-st") ? "현황" : `로스터줄 ${nm}`, h: +b.height.toFixed(1), w: +b.width.toFixed(1),
        sup: sup ? [...sup.children].map((c) => c.textContent).join(" | ") : (v?.textContent ?? ""),
        supH: sup ? +sup.getBoundingClientRect().height.toFixed(1) : null,
        inkH: sup ? +(sup.lastElementChild.getBoundingClientRect().bottom - sup.firstElementChild.getBoundingClientRect().top).toFixed(1) : null,
        /* 글의 위·아래가 그릇 안에서 얼마나 남나(음수 = 그릇 밖으로 넘침) */
        gap: sup ? [+(sup.firstElementChild.getBoundingClientRect().top - b.top).toFixed(1), +(b.bottom - sup.lastElementChild.getBoundingClientRect().bottom).toFixed(1)] : null });
    }
    return out;
  });
  for (const r of r9) console.log(`[종족 풀 ${label9}] ${r.box} 키 ${r.h} 폭 ${r.w} · 인구 "${r.sup}"${r.supH !== null ? ` · 상자 ${r.supH} · 글 ${r.inkH} · 위아래 남김 ${r.gap[0]}/${r.gap[1]}` : ""}`);
};
/* 해상도 단(uiStep9 · 2026-10) — 뿌리의 --ui 와 그 값을 탄 자(툴박스 키 · 로스터 줄 키 · 독 줄 키 · 단추 한 변). 늘 한 줄. */
{
  const u9 = await page.evaluate(() => {
    const root = document.querySelector(".scr-fs-layer, .scr-motion");
    const r = (q) => { const e = document.querySelector(q); return e ? +e.getBoundingClientRect().height.toFixed(1) : null; };
    const w = (q) => { const e = document.querySelector(q); return e ? +e.getBoundingClientRect().width.toFixed(1) : null; };   // 폭(독 두 판 — 2026-10-09)
    const btn = document.querySelector(".scr-motion-mapbtns button.scr-motion-mapbtn");
    return { ui: window.__scrDiag?.ui ?? null, cssUi: root ? getComputedStyle(root).getPropertyValue("--ui").trim() : null,
      tb: r(".scr-tb"), roster: r(".scr-dock-row"), dock: r(".scr-fs-dockrow"), btn: btn ? +btn.getBoundingClientRect().width.toFixed(1) : null,
      infow: w(".scr-fs-dockmain > .scr-motion-infodock"), rosterw: w(".scr-fs-rosterpanel"),   // 독 두 판의 폭(1080p 180/320/480 검산 · 2026-10-09)
      rosterCls: document.querySelector(".scr-dock-roster")?.className ?? null,   // is-paged 가 섰나(쪽 꼴 판정 검산)
      rprobe: ["\u002escr-dock-roster", ".scr-dock-headrow .scr-dock-names", ".scr-dock-headrow .scr-dock-data", ".scr-dock-headrow .scr-dock-strip", ".scr-dock-headrow .scr-dock-page", ".scr-dock-cell.is-worker", ".scr-dock-cell.is-worker .scr-dock-lab", ".scr-dock-cell.is-apm"].map((q) => {
        const e = document.querySelector(q); if (!e) return `${q}: 없음`; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return `${q}: x${b.left.toFixed(0)} w${b.width.toFixed(1)} h${b.height.toFixed(1)} fs${cs.fontSize} rp${cs.getPropertyValue("--rp").trim()} tf${cs.transform === "none" ? "-" : cs.transform} ov${cs.overflow}`; }),
      vw: window.innerWidth, vh: window.innerHeight, sw: window.screen.width, sh: window.screen.height };
  });
  console.log(`[UI단] ${u9.ui} · --ui ${u9.cssUi} · 창 ${u9.vw}×${u9.vh} 화면 ${u9.sw}×${u9.sh} · 툴박스 키 ${u9.tb} · 로스터줄 키 ${u9.roster} · 독 줄 키 ${u9.dock} · 단추 ${u9.btn} · 인포창 폭 ${u9.infow} · 로스터 판 폭 ${u9.rosterw} · 로스터 ${u9.rosterCls}`);
  /* --sfxprobe [초](2026-10-22) — 효과음 신호가 도는지: 재생을 N초(기본 8) 두고 종류마다 낸 수(window.__sfx9 · 소리는 헤드리스라 안 들린다). */
  if (has("--sfxprobe")) {
    await page.waitForTimeout(Number(flag("--sfxprobe", 8)) * 1000 || 8000);
    console.log("[효과음]", JSON.stringify(await page.evaluate(() => window.__sfx9 ?? null)));
  }
  if (has("--rosterprobe")) {
    for (const l of u9.rprobe) console.log("[로스터 자]", l);
    console.log("[로스터 글]", await page.evaluate(() => [...document.querySelectorAll(".scr-dock-headrow .scr-dock-cell")].map((e) => {
      const b = e.getBoundingClientRect(); const cs = getComputedStyle(e.firstElementChild ?? e);
      return `${e.textContent}@${b.left.toFixed(0)}+${b.width.toFixed(0)} col${cs.color} op${cs.opacity} vis${cs.visibility} ff${cs.fontFamily.slice(0, 24)}`;
    }).join(" | ")));
    console.log("[로스터 바닥]", await page.evaluate(() => {   // 마지막 줄 아래 ~ 판 바닥 남은 키(2026-10-12 "아래 여백 너무 넓게 남음")
      const r = document.querySelector(".scr-dock-roster")?.getBoundingClientRect(); const p = document.querySelector(".scr-fs-rosterpanel")?.getBoundingClientRect();
      const rows = [...document.querySelectorAll(".scr-dock-roster .scr-dock-row, .scr-dock-roster .scr-dock-name")].map((e) => e.getBoundingClientRect().bottom);
      const last = rows.length ? Math.max(...rows) : 0;
      return r && p ? `판 ${p.top.toFixed(0)}~${p.bottom.toFixed(0)} · 로스터 ${r.top.toFixed(0)}~${r.bottom.toFixed(0)} · 마지막 줄 바닥 ${last.toFixed(1)} · 남음 ${(r.bottom - last).toFixed(1)}` : "-";
    }));
    console.log("[로스터 값]", await page.evaluate(() => [...document.querySelectorAll(".scr-dock-team:not(.scr-dock-headrow) .scr-dock-row")].slice(0, 2).map((r) => `${r.textContent}`).join(" | ")));
  }
  /* --diag 면 진단 머리 두 줄(dpr·배율·UI·초해상·⚠재표본 / 흐림: …)을 그대로 적는다 — 사용자가 찍어 보내는 그 줄과 같은 글. */
  if (has("--diag")) {
    const h9 = await page.evaluate(() => [...document.querySelectorAll(".scr-motion-diag > div")].slice(0, 2).map((d) => d.textContent ?? ""));
    for (const l9 of h9) console.log(`[진단머리] ${l9}`);
  }
}
if (has("--mc")) await supProbe9("A");
/* --res 깜빡임 자(2026-10-12, 지적: "자원 우클릭 감지를 못 하네") — --diag 와 함께 · 0.1초마다 스무 번 붓이 칠한 링을 떠서 자원(mineral·geyser) 링만 시계와 함께 찍는다.
   45.8초 우클릭(--track 정구 --t 45.8)이면 0.9초 창 안에서 노란(#fcfc38) 링이 켜졌다 꺼졌다 해야 한다. */
if (has("--res") && has("--diag")) {
  const got9 = [];
  for (let i9 = 0; i9 < 20; i9 += 1) {
    const r9 = await page.evaluate(() => ({ ring: window.__scrDiag?.ring ?? "", t: (() => { const r = document.querySelector(".scr-motion-seek, input[type=range]"); return r instanceof HTMLInputElement ? Number(r.value).toFixed(2) : "?"; })() }));
    const res9 = String(r9.ring).split(/\s*·\s*|,\s*/).filter((x) => /mineral|geyser/.test(x));
    got9.push(`${r9.t}:${res9.length ? res9.join("+") : "-"}`);
    if (has("--resraw") && i9 < 6) console.log(`  [링 원문] ${r9.t} ${r9.ring}`);
    await page.waitForTimeout(100);
  }
  console.log(`[자원 링] ${got9.join(" ")}`);
}
/* 자국 자(--marks 와 함께 · 2026-10) — 큰 지도의 핑·클릭 마커 DOM 과 그 색·자리 · 선택 링은 캔버스라 못 읽으니 색 규칙은 눈으로. */
if (has("--marks") || has("--bldclick")) {
  const r9 = await page.evaluate(() => [...document.querySelectorAll(".scr-motion-pingfx, .scr-motion-clickfx")].map((el) => {
    const b = el.getBoundingClientRect();
    const bf = getComputedStyle(el, "::before");   // 굵기(2026-10-14 · 배율 따라) — 마커는 고리 테 · 핑은 팔 굵기(background-size 첫 칸)
    return { cls: el.className.replace("scr-motion-", ""), col: getComputedStyle(el).color, x: Math.round(b.left), y: Math.round(b.top),
      line: el.className.includes("clickfx") ? (bf.boxShadow.match(/(\S+px) inset|inset \S+ \S+ \S+ (\S+px)/) ?? [])[0] ?? bf.borderTopWidth : bf.backgroundSize.split(",")[0], w: bf.width };
  }));
  const t9 = await page.evaluate(() => { const r = document.querySelector(".scr-motion-seek, input[type=range]"); return r instanceof HTMLInputElement ? Number(r.value).toFixed(2) : null; });
  console.log(`[자국] 시계 ${t9} · ${r9.length}개 · ${JSON.stringify(r9)}`);
  /* 선택 링은 캔버스라 DOM 으로 못 읽는다 — --diag 로 켜면 붓이 마지막 장의 링(종류#태그:임자:고른이:색(몸 색 폭 N))을 SCR_DIAG.ring 에 적는다. */
  const ring9 = await page.evaluate(() => window.__scrDiag?.ring ?? null);
  console.log(`[링] ${ring9 ?? "(진단 없음 — --diag)"}`);
  /* --bldclick — 0.08초마다 스무다섯 장 링 진단을 떠서 건물 링(diamond#b…)의 색을 모은다 · 땅 자국(DOM)도 함께. 셋이 다 나와야 한다:
     정구 서플라이 초록(#10fc18) · Rex 풀 노랑(#fcfc38) · 수달이 파일런 빨강(#f40404) · 유닛 — 정구 마린 초록 · Rex 히드라 노랑. */
  if (has("--bldclick")) {
    const got9 = new Set(); let marks9 = 0;
    for (let i9 = 0; i9 < 35; i9 += 1) {
      const r = await page.evaluate(() => [window.__scrDiag?.ring ?? "", document.querySelectorAll(".scr-motion-clickfx").length]);
      for (const m of String(r[0]).matchAll(/#b([^|]+)\|([A-Za-z ]+)\|\d+\|\d+:\S*:\S*:(#[0-9a-f]{6})/g)) got9.add(`${m[1]} ${m[2]} ${m[3]}`);
      for (const m of String(r[0]).matchAll(/([a-z0-9_]+)#u(\d+):(\S+?):(\S*?):(#[0-9a-f]{6})/g)) if (m[5] !== "#10fc18" || m[4] === "-") got9.add(`${m[3]} ${m[1]}#${m[2]} ${m[5]}`);   // 유닛 링 — 고르지 않은 몸의 링은 깜빡임뿐
      marks9 = Math.max(marks9, r[1]);
      await page.waitForTimeout(80);
    }
    console.log(`[건물 우클릭] 링 ${[...got9].join(" · ") || "(없음)"} · 땅 자국 최대 ${marks9}`);
  }
  /* --ringprobe N — 링 폭이 자세·동작에 따라 뛰나(2026-10, 지적: "아직도 자세나 동작에 따라 선택링이 달라져"): 0.3초마다 N번 장을 떠서
     태그마다 폭의 최소·최대를 모은다. 같은 태그의 폭이 두 값이면 흔들리는 것이다. */
  if (has("--ringprobe")) {
    const n9 = Number(flag("--ringprobe", 8)) || 8;
    const seen9 = new Map();
    for (let i9 = 0; i9 < n9; i9 += 1) {
      const r = await page.evaluate(() => window.__scrDiag?.ring ?? "");
      for (const m of String(r).matchAll(/([a-z0-9_]+)#(u\d+):\S*\(몸 \S+ 폭 ([0-9.]+)\)/g)) {
        const k = `${m[1]}#${m[2]}`; const w = Number(m[3]);
        const e = seen9.get(k) ?? { lo: w, hi: w, n: 0 }; e.lo = Math.min(e.lo, w); e.hi = Math.max(e.hi, w); e.n += 1; seen9.set(k, e);
      }
      await page.waitForTimeout(300);
    }
    const rows9 = [...seen9.entries()].map(([k, e]) => `${k} ${e.lo === e.hi ? e.lo : `${e.lo}~${e.hi} ⚠`}(${e.n})`);
    console.log(`[링 폭] ${rows9.length ? rows9.join(" · ") : "(링 없음)"}`);
  }
}
/* 자동 팝업 자(--infoprobe [png]): 중계·추적 중 화면 주인이 고른 건물의 정보 팝업이 저절로 서나(2026-09, 요청:
   "중계시(화면 주인의) 건물 선택시 인포팝업 뜨게 — 리플레이 기록상 선택한 경우"). --selpick 과 --track 정구 로 연다:
   44초에 홀을 고르고 50초에 딴 몸으로 갈아타므로 46초에는 떠 있고, 재생해 50초를 넘기면 닫혀야 한다. */
if (has("--infoprobe")) {
  const nm9 = () => page.evaluate(() => document.querySelector(".scr-motion-infodock-name")?.textContent ?? null);
  await page.waitForTimeout(2500);
  const a9 = await nm9();
  const shot9 = flag("--infoprobe", "");
  if (shot9 && shot9 !== true && String(shot9).endsWith(".png")) await page.screenshot({ path: String(shot9), timeout: 120000 });
  let b9 = a9; let tb9 = null;
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(500);
    b9 = await nm9();
    tb9 = await page.evaluate(() => { const r = document.querySelector(".scr-motion-seek, input[type=range]"); return r instanceof HTMLInputElement ? Number(r.value).toFixed(1) : null; });
    if (b9 === null) break;
  }
  console.log(`[자동 팝업] 처음 ${JSON.stringify(a9)} · 재생 뒤 ${JSON.stringify(b9)} (시계 ${tb9})`);
}
/* 시계 자(--clockprobe) — 재생바를 끌고 난 뒤에도 시계 글자가 흐르나 본다(2026-10, 지적: "시간표시부분이 안바뀌는 문제").
   진짜 마우스로 손잡이 가운데를 눌러 끌고 놓은 뒤, 재생 중 1.5초 간격으로 시계 글자를 두 번 읽는다(같으면 멈춘 것이다). */
/* 타일 자(--tileprobe) — 배율 1 의 타일 하나 CSS px(지도 폭 ÷ 격자 폭 · 붓의 tilePx). 트레이서 굵기를 PC·폰 사이로 맞출 때 잰다(2026-10-11). */
if (has("--tileprobe")) {
  const tp9 = await page.evaluate(() => { const m = document.querySelector(".scr-motion-map"); return m ? m.clientWidth : -1; });
  console.log(`[타일] 지도 폭 ${tp9}px · 격자 ${JSON.parse(walkFixture).w} → tilePx ${(tp9 / JSON.parse(walkFixture).w).toFixed(2)}`);
}
/* 잠금 토스트(--locktoast · --track '*' 와 함께) — 중계 중 휠·↑·더블클릭·끌기·D 키가 "중계 모드에선 줌·화면 이동이 안 돼요" 토스트를 부르나(2026-10-11).
   토스트는 2.5초에 한 번이라 손짓 사이를 2.7초 띄운다. */
if (has("--locktoast")) {
  /* --castoff — 자동 중계를 끄고 잰다(토스트가 하나도 없어야 한다). */
  if (has("--castoff")) {
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="자동 중계 끄기"]'); if (b instanceof HTMLElement) b.click(); });
    await page.waitForTimeout(600);
  }
  const mp9 = await page.evaluate(() => { const r = document.querySelector(".scr-motion-map")?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
  const got9 = async (tag9, act9) => {
    const n0 = await page.evaluate(() => window.__toasts.length);
    await act9();
    await page.waitForTimeout(300);
    const t9 = await page.evaluate((n) => window.__toasts.slice(n), n0);
    console.log(`[잠금 토스트] ${tag9}: ${t9.length > 0 ? t9.join(" | ") : "없음"}`);
    await page.waitForTimeout(2700);
  };
  if (mp9) {
    const [x9, y9] = mp9;
    await got9("휠", async () => { await page.mouse.move(x9, y9); await page.mouse.wheel(0, -200); });
    await got9("E 키(확대)", async () => { await page.keyboard.press("KeyE"); });
    await got9("더블클릭", async () => { await page.mouse.dblclick(x9 + 30, y9 + 30); });
    await got9("끌기", async () => { await page.mouse.move(x9, y9); await page.mouse.down(); await page.mouse.move(x9 + 120, y9 + 40, { steps: 8 }); await page.mouse.up(); });
    await got9("D 키", async () => { await page.keyboard.down("KeyD"); await page.waitForTimeout(200); await page.keyboard.up("KeyD"); });
    await got9("한 번 누름(몸 집기 — 토스트 없어야)", async () => { await page.mouse.click(x9 - 40, y9 - 40); });
  } else console.log("[잠금 토스트] 지도 없음");
}
/* 단 자(--tierprobe · 2026-10-12) — 벤치·프로필·단(SCR_DIAG.crowd) · 유닛 캔버스 배킹 배수(unitB) · dpr. `--hash pctier=2` 로 폰의 PC 단을 본다. */
if (has("--tierprobe")) {
  await page.waitForTimeout(1500);
  const d9 = await page.evaluate(() => { const d = window.__scrDiag ?? {}; return { crowd: d.crowd, B: d.unitB, dpr: window.devicePixelRatio }; });
  console.log(`[단] ${d9.crowd ?? "?"} · 배킹 ${typeof d9.B === "number" ? d9.B.toFixed(2) : d9.B} · dpr ${d9.dpr}`);
}
if (has("--clockprobe")) {
  const rd9 = () => page.evaluate(() => document.querySelector(".scr-motion-clock")?.textContent ?? "?");
  const bx9 = await page.evaluate(() => { const r = document.querySelector("input[type=range]")?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height] : null; });
  const c0 = await rd9();
  if (bx9) {
    const y9 = bx9[1] + bx9[3] / 2;
    await page.mouse.move(bx9[0] + bx9[2] * 0.3, y9); await page.mouse.down();
    await page.mouse.move(bx9[0] + bx9[2] * 0.5, y9, { steps: 6 }); await page.mouse.up();
  }
  const c1 = await rd9();
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /재생|play/i.test(e.getAttribute("aria-label") ?? "")); if (b && /재생/.test(b.getAttribute("aria-label") ?? "") && !/정지|멈/.test(b.getAttribute("aria-label") ?? "")) b.click(); });
  await page.waitForTimeout(1500); const c2 = await rd9();
  await page.waitForTimeout(1500); const c3 = await rd9();
  console.log(`[시계] 처음 ${c0} · 끈 뒤 ${c1} · 1.5초 ${c2} · 3초 ${c3} → ${c2 !== c3 ? "흐름 ✔" : "멈춤 ✘"}`);
}
/* 안개 자(--fogprobe [초]) — 자동 중계가 사람을 갈아탈 때 안개가 깜빡이나 본다(2026-10, 지적: "자동에서 선수 전환될때 안개 깜빡임").
   rAF 마다 안개 캔버스를 32×32 로 줄여 어두운 몫(알파 평균)을 재고, 이웃 장보다 크게 튄 장(앞뒤 장과 둘 다 0.08 넘게 다르다 =
   한 장짜리 깜빡임)을 센다. 갈아탄 시각은 window.__scrDiag.cast(있으면)로 찍는다. */
if (has("--fogprobe")) {
  const secs9 = Number(flag("--fogprobe", 20)) || 20;
  const log9 = await page.evaluate(async (ms9) => {
    const out = [];
    const sm = document.createElement("canvas"); sm.width = 32; sm.height = 32;
    const sx = sm.getContext("2d", { willReadFrequently: true });
    const t0 = performance.now();
    await new Promise((res) => {
      const step = () => {
        const cv = document.querySelector(".scr-motion-fog");
        let a = -1;
        if (cv instanceof HTMLCanvasElement && cv.width > 0 && getComputedStyle(cv).display !== "none") {
          sx.clearRect(0, 0, 32, 32); sx.drawImage(cv, 0, 0, 32, 32);
          const d = sx.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; a = s / (d.length / 4) / 255;
        }
        out.push({ ms: Math.round(performance.now() - t0), a: +a.toFixed(3), cast: window.__scrDiag?.castRaw ?? null, dt: window.__scrDiag?.drawT ?? null, tag: window.__scrDiag?.drawTag ?? null, cp: window.__scrDiag?.camPan ? [...window.__scrDiag.camPan] : null });
        if (performance.now() - t0 < ms9) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    return out;
  }, secs9 * 1000);
  let blips9 = 0; const sw9 = [];
  for (let i = 1; i < log9.length - 1; i += 1) {
    const [p, c, n] = [log9[i - 1], log9[i], log9[i + 1]];
    if (c.a >= 0 && p.a >= 0 && n.a >= 0 && Math.abs(c.a - p.a) > 0.08 && Math.abs(c.a - n.a) > 0.08) blips9 += 1;
    if (c.cast !== p.cast) sw9.push(`${c.ms}ms→${c.cast}`);
  }
  const big9 = log9.slice(1).map((c, i) => ({ ms: c.ms, d: +(c.a - log9[i].a).toFixed(3), cast: c.cast })).filter((x) => Math.abs(x.d) > 0.05);
  for (const x of sw9) { const ms = Number(x.split("ms")[0]); console.log(`[안개 곁] ${x} : ` + log9.filter((c) => c.ms >= ms - 600 && c.ms <= ms + 2500).map((c) => `${c.ms}:${c.a}`).join(" ")); }
  /* 그린 시각의 되감김(2026-10-14, 지적: "자동 중계 사람 바뀔 때 장면 자체가 방금 위치를 짧게 다시 반복") — 이웃 rAF 사이에 그린 장의 시각이 20ms 넘게 뒤로 간 횟수·폭. */
  const back9 = [];
  for (let i = 1; i < log9.length; i += 1) { const p = log9[i - 1].dt; const c = log9[i].dt; if (p !== null && c !== null && c < p - 0.02) back9.push(`${log9[i].ms}ms −${((p - c) * 1000).toFixed(0)}ms [${log9[i - 1].tag} → ${log9[i].tag}]`); }
  let same9 = 0; let n9 = 0;
  for (let i = 1; i < log9.length; i += 1) { if (log9[i].dt === null || log9[i - 1].dt === null) continue; n9 += 1; if (log9[i].dt === log9[i - 1].dt) same9 += 1; }
  /* 카메라 걸음(2026-10-14 · 사건 중계 끌림) — rAF 사이 카메라 자리 변화: 움직인 장 수 · 한 장 최대 px · 80px 넘게 곧장 선 횟수. */
  { let mv9 = 0; let mx9 = 0; let jp9 = 0; let nn9 = 0;
    for (let i = 1; i < log9.length; i += 1) { const a = log9[i - 1].cp; const b = log9[i].cp; if (!a || !b) continue; nn9 += 1; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > 0.3) mv9 += 1; if (d > 80) jp9 += 1; else mx9 = Math.max(mx9, d); }
    console.log(`[카메라] 움직인 장 ${mv9}/${nn9} · 한 장 최대 ${mx9.toFixed(1)}px · 곧장 선 ${jp9}번`); }
  console.log(`[되감김] ${back9.length}번 ${back9.slice(0, 12).join(" · ")} · 같은 장 연달아 ${same9}/${n9}`);
  const swap9 = await page.evaluate(() => window.__scrDiag?.branchSwap ?? 0);
  console.log(`[안개] 갈래 빈틈을 팀 장으로 메운 장 ${swap9}`);
  console.log(`[안개] 장 ${log9.length} · 한 장짜리 튐 ${blips9} · 갈아탐 ${sw9.join(" ")} · 큰 변화 ${big9.map((x) => `${x.ms}ms ${x.d > 0 ? "+" : ""}${x.d}`).join(" ")}`);
}
/* 중계 자(--castprobe [초]): 중계 스위치·자막·카메라 임자를 한동안 지켜본다 — 편성표가
   실제로 사람을 갈아타는지는 정지 그림 한 장으로는 못 본다. 자막은 **상시**라(요청: "토스터가 아니라
   계속 노출로") 뜨는 횟수가 아니라 **글귀가 갈린 횟수**(갈아탐)와 지금 글귀를 찍는다. */
if (has("--castprobe")) {
  const secs9 = Number(flag("--castprobe", 16)) || 16;
  /* --fs 와 함께면 전체화면에서 본다 — 거기서만 조종부가 무대를 덮으므로 자막이 비키는지 확인한다. */
  if (has("--fs")) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button[aria-label]")].find((el) => /^전체화면$/.test(el.getAttribute("aria-label") ?? ""));
      if (b instanceof HTMLElement) b.click();
    });
    await page.waitForTimeout(900);
  }
  const seen9 = [];
  let on9 = null;
  for (let i9 = 0; i9 < secs9 * 5; i9 += 1) {
    const r9 = await page.evaluate(() => ({
      on: !!document.querySelector(".scr-roster-cam-auto.is-on"),
      btn: !!document.querySelector(".scr-roster-cam-auto"),
      /* 글귀는 숨긴 이름표(.scr-tb-who-ghost — 첫 칸 폭을 미리 잡는 겹판)를 빼고 읽는다. */
      toast: [...document.querySelectorAll(".scr-tb-who")].map((el) => { const c = el.cloneNode(true); c.querySelectorAll(".scr-tb-who-ghost").forEach((g) => g.remove()); return c.textContent ?? ""; }),
      /* 칸 폭(2026-09, 요청: "글자길이에 따라 레이아웃 흔들리지 않게 미리 공간 확보") — 사람이 갈려도 같아야 한다. */
      cols: (() => { const el = document.querySelector(".scr-tb-who"); if (!el) return null; const r0 = el.getBoundingClientRect();
        return { w: +r0.width.toFixed(1), cells: [...el.querySelectorAll(".scr-tb-who-st > span")].map((c) => +c.getBoundingClientRect().width.toFixed(1)) }; })(),
      /* 단추의 자리 — 아이콘 줄(.scr-motion-mapbtns) 안에서 **로스터 단추 바로 왼쪽**인가(요청), 크기가 형제와 같은가. */
      bb: (() => { const b = document.querySelector(".scr-roster-cam-auto");
        /* 단추는 목록 감싸개(.scr-motion-pick) 안에 서므로 이웃은 그 감싸개의 형제다(2026-09 · 목록을 열게 되며). */
        if (!b) return null; const el = b.closest(".scr-motion-pick") ?? b;
        const kids = [...(el.parentElement?.children ?? [])]; const i = kids.indexOf(el); const nx = kids[i + 1]?.matches("button") ? kids[i + 1] : kids[i + 1]?.querySelector("button");
        const r = b.getBoundingClientRect(); const rn = nx?.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), idx: i, next: nx?.getAttribute("aria-label") ?? null,
          gap: rn ? +(rn.left - r.right).toFixed(1) : null, nextW: rn ? +rn.width.toFixed(1) : null }; })(),
      box: (() => { const b = document.querySelector(".scr-motion-infodock"); const st = document.querySelector(".scr-fs-stage");
        if (!b || !st) return null; const r = b.getBoundingClientRect(); const q = st.getBoundingClientRect();
        const lyr = document.querySelector(".scr-fs-layer");
        return { cx: +((r.left + r.width / 2 - q.left) / q.width).toFixed(3), bot: +(q.bottom - r.bottom).toFixed(0),
          par: b.offsetParent?.className?.slice(0, 30) ?? "?", stg: +q.bottom.toFixed(0), bar: +r.bottom.toFixed(0),
          v: lyr ? getComputedStyle(lyr).getPropertyValue("--scr-fsbot") : "" }; })(),
    }));
    if (on9 === null) on9 = r9;
    for (const tx9 of r9.toast) {
      const last9 = seen9[seen9.length - 1];
      if (!last9 || last9.text !== tx9) {
        seen9.push({ text: tx9, at: +(i9 / 5).toFixed(1), box: r9.box });
        // 첫 자막이 선 그 장면을 찍는다(--shot) — 자리(무대 아래 몇 px)를 정지 그림으로 본다.
        if (SHOT && seen9.length === 1) {
          await page.screenshot({ path: String(SHOT) });
          // 자막만 따로(라벨이 칸 가운데 위에 서나 · 칸 폭) — <shot>_cap.png
          const cr9 = await page.evaluate(() => { const r = document.querySelector(".scr-motion-infodock")?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null; });
          if (cr9) await page.screenshot({ path: String(SHOT).replace(/\.png$/, "_cap.png"), clip: { x: cr9.x - 6, y: cr9.y - 6, width: cr9.width + 12, height: cr9.height + 12 } }).catch((e) => { console.log(`[중계] 자막 조각 실패 ${e?.message ?? e}`); });
        }
      }
    }
    await page.waitForTimeout(200);
  }
  const capNow9 = await page.evaluate(() => { const el = document.querySelector(".scr-tb-who"); if (!el) return null;
    const c = el.cloneNode(true); c.querySelectorAll(".scr-tb-who-ghost").forEach((g) => g.remove()); return c.textContent ?? ""; });
  /* 아이콘 줄 단추 크기 — 켜진 것(is-on·castbtn-on)과 꺼진 것이 같은 크기여야 한다(2026-09, 지적: "전체화면에서 활성버튼과
     비활성버튼 크기 다름"). */
  const btns9 = await page.evaluate(() => [...document.querySelectorAll(".scr-motion-mapbtns button.scr-motion-mapbtn")].map((b) => {
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    return `${(b.getAttribute("aria-label") ?? "").slice(0, 6)}${b.classList.contains("is-on") || b.classList.contains("scr-motion-castbtn-on") ? "*" : ""} ${r.width.toFixed(1)}×${r.height.toFixed(1)} bs=${cs.boxSizing} b=${cs.borderTopWidth}`; }));
  console.log(`[단추] ${btns9.join(" · ")}`);
  /* 지금 중계 자막(.scr-cast-caption — 옛 .scr-tb-who 는 걷혔다) · 화면 주인 이름표가 서 있나(사건 중계면 없어야 · 2026-10-14). */
  const capNew9 = await page.evaluate(() => ({ cap: document.querySelector(".scr-cast-caption")?.textContent ?? null, owner: window.__scrDiag?.castRaw ?? null }));
  console.log(`[중계 자막] ${capNew9.cap === null ? "없음" : `"${capNew9.cap}"`} · 화면 주인 ${capNew9.owner ?? "없음"}`);
  const colsNow9 = await page.evaluate(() => { const el = document.querySelector(".scr-tb-who"); if (!el) return null;
    return { w: +el.getBoundingClientRect().width.toFixed(1), cells: [...el.querySelectorAll(".scr-tb-who-st > span")].map((c) => +c.getBoundingClientRect().width.toFixed(1)) }; });
  console.log(`[중계] 단추 ${on9?.btn ? "있음" : "없음"} · 켜짐 ${on9?.on ? "예" : "아니오"} · 상시 자막 ${capNow9 === null ? "없음" : `"${capNow9}"`} · 갈아탐 ${Math.max(0, seen9.length - 1)}번`
    + (colsNow9 ? ` · 자막 폭 ${colsNow9.w}px 칸 [${colsNow9.cells.join(" ")}]` : "")
    + (on9?.bb ? ` · 단추 ${on9.bb.w}×${on9.bb.h}px(이웃 ${on9.bb.nextW}) · 오른쪽 이웃 "${on9.bb.next}" 틈 ${on9.bb.gap}px` : " · 단추 자리 못 잼"));
  /* 배타 검사 — TV 단추의 **목록**(2026-09, 요청: "중계버튼 누르면 위에 선택목록 … 맨 아래 자동 · 로스터 추적버튼 제거")에서
     첫 사람을 고르면 중계(자막)가 꺼지고 그 줄만 켜져야 하고, 다시 열어 맨 아래 '자동'을 고르면 중계가 돌아와야 한다.
     `on` 은 단추의 초록(자동·개인 어느 쪽이든 카메라를 쥐고 있다) · `cap` 은 상시 자막(중계일 때만) · `items` 는 목록 글귀. */
  const excl9 = await page.evaluate(async () => {
    /* share — 공유 표(요청: "중계는 자동이든 한사람이든 사용중이면 좌표, 배율 공유안하고 대신 중계 파라미터 공유"):
       tr 는 &tr= 에 실릴 값(사람 아이디 · 자동은 "*" · 꺼지면 null), pos 는 자리(z·cx·cy)가 실려 있나. */
    const sh = () => { const r = window.__share9?.(); return r ? { tr: r.tr, pos: r.pos } : null; };
    const capOf = () => { const el = document.querySelector(".scr-tb-who"); if (!el) return null;
      const c = el.cloneNode(true); c.querySelectorAll(".scr-tb-who-ghost").forEach((g) => g.remove()); return c.textContent ?? ""; };
    const colsOf = () => { const el = document.querySelector(".scr-tb-who"); if (!el) return null;
      return [+el.getBoundingClientRect().width.toFixed(1), ...[...el.querySelectorAll(".scr-tb-who-st > span")].map((c) => +c.getBoundingClientRect().width.toFixed(1))]; };
    const st = () => ({ on: !!document.querySelector(".scr-roster-cam-auto.is-on"), cap: capOf(), cols: colsOf(),
      items: [...document.querySelectorAll(".scr-motion-pickmenu .scr-motion-pickitem")].map((el) => `${el.textContent}${el.classList.contains("is-on") ? "*" : ""}`),
      share: sh() });
    const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
    const a = st();
    (document.querySelector(".scr-roster-cam-auto"))?.click();
    await wait(200);
    const open1 = st();
    const its = () => [...document.querySelectorAll(".scr-motion-pickmenu .scr-motion-pickitem")];
    its()[0]?.click();
    await wait(300);
    const b = st();
    (document.querySelector(".scr-roster-cam-auto"))?.click();
    await wait(200);
    const open2 = st();
    /* '자동'은 글귀로 찾는다 — 맨 아래는 이제 '끄기'다(2026-09, 요청: "목록에 끄기도 있어야해"). */
    its().find((el) => el.textContent === "자동")?.click();
    await wait(300);
    const c = st();
    /* 끄기 — 중계가 켜진 채 '끄기'를 고르면 단추 초록·자막이 함께 꺼져야 한다. */
    (document.querySelector(".scr-roster-cam-auto"))?.click();
    await wait(200);
    its().find((el) => el.textContent === "끄기")?.click();
    await wait(300);
    const d = st();
    return { 처음: { on: a.on, cap: a.cap, share: a.share }, 목록: open1.items, 첫사람고름: { on: b.on, cap: b.cap, share: b.share }, 다시연목록: open2.items,
      자동고름: { on: c.on, cap: c.cap, share: c.share }, 끄기고름: { on: d.on, cap: d.cap, share: d.share } };
  });
  console.log("[중계 배타]", JSON.stringify(excl9));
  for (const x9 of seen9) console.log(`  ${x9.at}s  "${x9.text}"  ${JSON.stringify(x9.box)}`);
}
/* 집기 자(--pickprobe): **1배**에서 건물을 눌러 인포 팝업이 서나, 빈 땅을 누르면 닫히나, 다른 건물을 누르면
   갈아타나, 중계가 카메라를 잡으면(화면 전환) 닫히나(요청: "건물 선택시 인포팝업 노출하기(화면 전환되거나 다른거
   선택시 닫혀야하는거 알지?)") — 픽스처의 본진 홀(정구 CC (18,18) · 수달이 넥서스 (106,18) — 자리는 **몸 가운데**
   타일)을 화면으로 옮겨 누른다. 유닛은 1배에서 여전히 안 집힌다(그 규약 — pickAt 의 bldOnly9). `--pickscan` 을
   더하면 넥서스 둘레를 타일 단위로 훑어 **어디를 눌러야 잡히나**(판정 반경의 실측)를 찍는다 — 실측: 몸 가운데에서
   위 3·아래 1·좌우 2타일(앵커가 몸 가운데보다 한 타일 위라 위쪽으로 더 넓다).
   ⚠ 누름은 **플레이라이트의 진짜 마우스**다(page.mouse) — 페이지 안에서 지어 보낸 PointerEvent 는 활성 포인터가
     없어 손짓의 setPointerCapture 가 던지고(실측) 누름이 통째로 버려진다.
   ⚠ 중계가 켜져 있으면 첫 토막이 카메라를 4배로 당겨 1배 판정이 아니다 — 먼저 TV 단추로 끈다. */
if (has("--pickprobe")) {
  const rc9 = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
    /* TV 단추는 이제 목록이다(사람들 + 자동 + 끄기) — 열고 '끄기'를 고른다(옛 판은 단추 한 번이 끄기였다 — 그래서 이 자가
       한동안 중계를 못 끄고, 중계가 사람을 갈아탈 때마다 집은 몸이 닫혀 늘 null 이었다). */
    if (document.querySelector(".scr-roster-cam-auto.is-on")) {
      document.querySelector(".scr-roster-cam-auto")?.click(); await wait(300);
      [...document.querySelectorAll(".scr-motion-pickitem")].find((el) => (el.textContent ?? "").trim().startsWith("끄기"))?.click();
      await wait(400);
    }
    const map = document.querySelector(".scr-motion-map");
    if (!map) return null;
    const r = map.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
  /* ⚠ 중계가 첫 토막에서 이미 4배로 당겨 놓았다 — 끈 뒤에도 배율은 그대로라(stopCast9 는 보던 자리에 머문다)
     1배로 도로 내린다(↓ 키가 한 칸 축소 · 사다리 바닥이 1). */
  for (let i9 = 0; i9 < 5; i9 += 1) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(120); }
  await page.waitForTimeout(400);
  if (has("--pickscan")) {
    // 앵커 훑기 — 홀(106,18) 둘레를 타일 단위로 눌러 어디서 잡히나 본다(판정 반경을 정하는 실측).
    const hits9 = [];
    for (let dy9 = -5; dy9 <= 3; dy9 += 1) for (let dx9 = -2; dx9 <= 2; dx9 += 1) {
      await page.mouse.click(rc9.l + ((106 + dx9) / 128) * rc9.w, rc9.t + ((18 + dy9) / 128) * rc9.h);
      await page.waitForTimeout(450);
      const nm9 = await page.evaluate(() => document.querySelector(".scr-motion-infodock .scr-motion-infodock-name")?.textContent ?? null);
      if (nm9) hits9.push(`${dx9},${dy9}:${nm9}`);
    }
    console.log("[집기 훑기]", hits9.join(" | ") || "없음");
  }
  const pop9 = () => page.evaluate(() => document.querySelector(".scr-motion-infodock .scr-motion-infodock-name")?.textContent ?? null);
  const tap9 = async (tx, ty) => {
    await page.mouse.click(rc9.l + (tx / 128) * rc9.w, rc9.t + (ty / 128) * rc9.h);
    await page.waitForTimeout(600);   // 더블탭 창(320ms)을 넘겨 다음 누름이 확대로 안 읽히게
    return pop9();
  };
  const out9 = rc9 ? {
    배율: await page.evaluate(() => window.__zoom ?? 1),
    홀: await tap9(18, 18), 빈땅: await tap9(64, 64), 다른홀: await tap9(106, 18),
  } : { err: "지도 없음" };
  if (rc9) {
    // 화면 전환 — 건물을 집은 채 중계를 켜면(카메라 임자가 바뀐다) 팝업이 닫혀야 한다.
    out9.홀다시 = await tap9(18, 18);
    await page.evaluate(() => { document.querySelector(".scr-roster-cam-auto")?.click(); });
    await page.waitForTimeout(500);
    out9.중계켠뒤 = await pop9();
  }
  console.log("[집기]", JSON.stringify(out9));
}
if (SHOT) {
  await page.waitForTimeout(1500);
  // 특정 장면 맞추기(--wait ms) — 재생이 실시간이라, 몇 초 뒤 장면은 그만큼 기다려 찍는다.
  if (flag("--wait", null)) await page.waitForTimeout(Number(flag("--wait", 0)));
  /* 사용법 덮개(--guide <png>) — '사용법' 단추를 눌러 덮개를 띄우고, 창을 덮개 높이만큼 키워 통째로 찍는다. */
  if (flag("--guide", null)) {
    await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "사용법" || b.getAttribute("aria-label") === "사용법")?.click(); });
    await page.waitForTimeout(600);
    const h9 = await page.evaluate(() => document.querySelector(".scr-guide")?.scrollHeight ?? 0);
    const vp9 = page.viewportSize();
    await page.setViewportSize({ width: vp9.width, height: Math.max(vp9.height, h9 + 40) });
    await page.waitForTimeout(500);
    /* 잘라 찍기(clip) — locator.screenshot 은 '안정될 때까지' 기다리는데 뒤의 재생기가 늘 다시 그려져 시간을 넘긴다. */
    const gb9 = await page.evaluate(() => { const r = document.querySelector(".scr-guide")?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null; });
    if (gb9) await page.screenshot({ path: flag("--guide", "guide.png"), clip: gb9, animations: "disabled", timeout: 120000 });
    console.log("[사용법]", h9, "px →", flag("--guide", ""));
  }
  /* 화면 자리 누르기(--clickat x,y · CSS px) — 보는 사람이 몸을 누르는 길(인포창)을 진짜 마우스로 찍는다. */
  /* --dialwheel N — 배속 다이얼 위에서 휠을 위로 N 번(한 번 100px) 굴리며 배속 글자를 적는다(2026-10-10 · 눈금 걸림 확인). */
  if (flag("--dialwheel", null)) {
    const n9 = Number(flag("--dialwheel", 20)) || 20;
    const box9 = await page.locator(".scr-speeddial").boundingBox();
    if (box9) {
      await page.mouse.move(box9.x + box9.width / 2, box9.y + box9.height / 2);
      const seen9 = [];
      for (let i9 = 0; i9 < n9; i9 += 1) {
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(60);
        seen9.push(await page.locator(".scr-speeddial-val").textContent());
      }
      console.log("[다이얼 휠]", seen9.join(" "));
    }
  }
  /* --searchprobe 검색어 — 돋보기를 눌러 펴고 검색어를 쳐 Enter → 첫 결과(1/N)로 가는지 · 알약 글 · 태그 수 · N·N·B 키 · ✕ 취소를 찍는다
     (2026-10-12 · 재생기 검색 — 한 알약: 쉼 · 입력 · 결과 꼴). --searchkeep 이면 ✕ 를 안 누르고 결과 꼴로 찍는다. */
  if (flag("--searchprobe", null)) {
    const q9 = String(flag("--searchprobe"));
    const st9 = () => page.evaluate(() => { const w = document.querySelector(".scr-motion-searchwrap"); const r = w?.getBoundingClientRect();
      return { cls: w?.className ?? null, w: r ? Math.round(r.width) : null, input: !!document.querySelector(".scr-motion-search-input"),
        count: document.querySelector(".scr-motion-searchwrap .scr-motion-search-count")?.textContent ?? null,
        tags: document.querySelectorAll(".scr-motion-searchtag").length, clock: document.querySelector(".scr-motion-clock")?.textContent ?? null,
        sug: [...document.querySelectorAll(".scr-motion-searchsug-opt")].map((e) => e.textContent),
        cap: document.querySelector(".scr-cast-caption")?.textContent ?? null, owner: document.querySelector(".scr-fs-solo-cap")?.textContent ?? null }; });
    /* --searchpause(2026-10-12) — 멈춘 채 검색해도 결과로 가면 재생하나(시계가 가나). 스페이스로 멈춘다. */
    if (has("--searchpause")) { await page.mouse.click(5, 5); await page.keyboard.press("Space"); await page.waitForTimeout(800); }
    console.log("[검색 쉼]", JSON.stringify(await st9()));
    /* 여닫기 걸림 재기(2026-10-12 지적: "열 때 한참 가만히 있다가") — 누름 → 입력칸이 설 때까지 ms. */
    const openMs9 = await page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      document.querySelector(".scr-motion-searchbtn")?.click();
      const tick = () => (document.querySelector(".scr-motion-search-input") ? res(Math.round(performance.now() - t0)) : requestAnimationFrame(tick));
      tick();
    }));
    await page.waitForTimeout(400);
    console.log("[검색 펴짐]", `${openMs9}ms`, JSON.stringify(await st9()));
    await page.keyboard.type(q9);   // 입력칸은 펴질 때 자라고 판이 늘 다시 그려 fill 의 '가만히 있나' 기다림이 걸린다 — 곧장 친다(autoFocus)
    await page.waitForTimeout(300);
    console.log("[검색 치기만]", q9, JSON.stringify(await st9()));
    if (flag("--shot", null)) await page.screenshot({ path: String(flag("--shot")).replace(/\.png$/, "-sug.png"), timeout: 8000 }).catch(() => console.log("[검색 자동 완성 찍기 건너뜀]"));   // 자동 완성이 뜬 꼴(헤드리스가 가끔 30초 막힌다 — 진단이라 안 멈춘다)
    /* 폰 키보드가 민 화면 흉내(2026-10-12) — 입력 중 페이지를 굴려 두고, Enter 뒤 펴기 전 자리로 돌아오는지 본다(굴릴 데가 없는 판이면 0 그대로). */
    const sc9 = await page.evaluate(() => { document.body.style.paddingBottom = "1200px"; const before = window.scrollY; window.scrollTo(0, before + 240); return [before, window.scrollY, document.documentElement.scrollHeight, innerHeight]; });
    /* 키보드 '완료'(iOS ✓ — 입력칸 손만 뗌) 흉내(2026-10-16, 지적: "저거 눌러서 닫으면 원래 위치로 안 가네") — blur 뒤 자리가 펴기 전으로 오는지 · 다시 손을 얹고 굴려 둔다. */
    const bl9 = await page.evaluate(async () => { const i = document.querySelector(".scr-motion-search-input"); i?.blur(); await new Promise((r) => setTimeout(r, 450)); const y = window.scrollY;
      i?.focus({ preventScroll: true }); window.scrollTo(0, window.scrollY + 240); return y; });
    console.log("[검색 완료(blur)]", JSON.stringify({ 펴기전: sc9[0], 굴림: sc9[1], 뒤: bl9 }));
    await page.keyboard.press("Enter"); await page.waitForTimeout(1200);   // 자동 완성이 떠 있으면 Enter 가 고르고 찾는다(입력칸이 사라져 page.press 는 걸린다)
    console.log("[검색 Enter]", JSON.stringify(await st9()));
    console.log("[검색 화면 자리]", JSON.stringify({ 펴기전: sc9[0], 굴림: sc9[1], 뒤: await page.evaluate(() => window.scrollY), 판키: sc9[2], 창키: sc9[3] }));
    for (const k9 of ["n", "n", "b"]) { await page.keyboard.press(k9); await page.waitForTimeout(500); console.log(`[검색 ${k9.toUpperCase()}]`, JSON.stringify(await st9())); }
    /* --searchwait 초(2026-10-12) — 재생을 두고 1초마다 찍는다: 결과 창이 끝나면 다음 결과(count)로 넘어가고 마지막이면 멈추나(clock 이 선다) · 잠금 토스트 없이 끌리나는 손으로. */
    /* --searchlock(2026-10-12) — 검색 결과를 보는 동안 휠이 잠겼나("중계 모드에선 …" 토스트 · --castoff 로 중계를 끈 판에서도). */
    if (has("--searchlock")) {
      const n09 = await page.evaluate(() => window.__toasts?.length ?? 0);
      const mp9 = await page.evaluate(() => { const r = document.querySelector(".scr-motion-map")?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
      if (mp9) { await page.mouse.move(mp9[0], mp9[1]); await page.mouse.wheel(0, -200); }
      await page.waitForTimeout(400);
      console.log("[검색 잠금 휠]", JSON.stringify(await page.evaluate((n) => (window.__toasts ?? []).slice(n), n09)));
    }
    for (let s9 = 0; s9 < Number(flag("--searchwait", 0)); s9 += 1) { await page.waitForTimeout(1000); const v9 = await st9(); console.log(`[검색 기다림 ${s9 + 1}s]`, v9.count, v9.clock, v9.cap, v9.owner, await page.evaluate(() => window.__scrDiag?.searchHit ?? "")); }
    if (!flag("--searchkeep", false)) {
      /* ✕ = 검색어 지우고 빈 입력칸 · 돋보기 = 닫기(2026-10-12 되요청). */
      await page.evaluate(() => { document.querySelector(".scr-motion-searchwrap [aria-label='검색어 지우기']")?.click(); });
      await page.waitForTimeout(400);
      console.log("[검색 ✕ 지우기]", JSON.stringify({ ...(await st9()), val: await page.evaluate(() => document.querySelector(".scr-motion-search-input")?.value ?? null) }));
      const closeMs9 = await page.evaluate(() => new Promise((res) => {
        const t0 = performance.now();
        document.querySelector(".scr-motion-searchbtn")?.click();
        const tick = () => (!document.querySelector(".scr-motion-searchwrap.is-open") ? res(Math.round(performance.now() - t0)) : performance.now() - t0 > 5000 ? res(-1) : requestAnimationFrame(tick));
        tick();
      }));
      console.log("[검색 닫힘]", `${closeMs9}ms`);
      await page.waitForTimeout(400);   // 접기 움직임(180ms) 뒤 — 움직임 끝(animationend)·대비 타이머가 닫는다(헤드리스 SW GL 은 장·타이머가 밀려 넉넉히)
      console.log("[검색 돋보기 닫기]", JSON.stringify(await st9()));
    }
  }
  /* --clicksel 선택자 — 그 요소를 눌러 둔 채 찍는다(2026-10-10 · 음악 목록 같은 펼침 확인). */
  if (flag("--clicksel", null)) {
    await page.click(String(flag("--clicksel")), { timeout: 10000 }).catch((e) => console.log("[clicksel 실패]", String(e).slice(0, 120)));
    await page.waitForTimeout(500);
  }
  if (flag("--clickat", null)) {
    const [cx9, cy9] = String(flag("--clickat", "0,0")).split(",").map(Number);
    console.log("[누름 앞]", JSON.stringify(await page.evaluate(() => { const d = document.querySelector(".scr-motion-infodock");
      return d ? [getComputedStyle(d).position, d.className, [...document.styleSheets].length] : null; })));
    await page.mouse.click(cx9, cy9);
    await page.waitForTimeout(700);
    console.log("[누름]", JSON.stringify(await page.evaluate(() => document.querySelector(".scr-motion-infodock-name")?.textContent ?? null)));
    await page.waitForTimeout(1500);
    console.log("[누름 뒤]", JSON.stringify(await page.evaluate(() => {
      const d = document.querySelector(".scr-motion-infodock");
      const r = d?.getBoundingClientRect();
      return { dock: !!d, rect: r ? [r.left, r.top, r.width, r.height].map(Math.round) : null,
        name: document.querySelector(".scr-motion-infodock-name")?.textContent ?? null,
        cap: document.querySelector(".scr-tb-who-name .scr-tb-who-txt:not(.scr-tb-who-ghost)")?.textContent ?? null,
        err: document.querySelector(".scr-motion-nodata")?.textContent ?? null,
        n: document.querySelectorAll(".scr-motion-infodock").length,
        cs: d ? (({ position, bottom, width, transform }) => ({ position, bottom, width, transform }))(getComputedStyle(d)) : null,
        par: d?.parentElement?.className ?? null, scroll: [window.scrollX, window.scrollY] };
    })));
  }
  // 전체화면 화면 검증(--fs) — 앱 제 버튼을 눌러 들어간다(좁은 배치는 여닫이,
  // 넓은 배치는 미니맵 위 토글). --fsidle이면 조작부가 저절로 숨을 때까지(3초) 둬서
  // 항시표시 로스터·햄버거 줄이 찍히게 한다.
  /* 버튼은 **라벨로** 짚는다 — 클래스로 짚던 앞판(.scr-motion-mobfs·.scr-fs-menubtn)은
     그 버튼들이 지도 우하단 아이콘 줄(.scr-motion-mapbtns)로 옮겨 가며 통째로 죽었고,
     죽은 줄도 몰랐다(클릭이 그냥 아무 일도 안 하고 지나간다). 라벨은 화면에 읽히는
     값이라 배치를 바꿔도 같이 안 죽는다. */
  const clickByLabel = async (re) => page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = [...document.querySelectorAll("button[aria-label]")]
      .find((el) => rx.test(el.getAttribute("aria-label") ?? ""));
    if (b instanceof HTMLElement) { b.click(); return true; }
    return false;
  }, re.source ?? re);
  if (has("--fs")) {
    if (has("--fsoff")) console.log("[전체화면 전] " + await page.evaluate(() => { const m = document.querySelector(".scr-motion-map"); const st = document.querySelector(".scr-fs-stage"); const r = m?.getBoundingClientRect(); const q = st?.getBoundingClientRect(); return `z ${window.__scrDiag?.zoom ?? null} 지도 ${r ? Math.round(r.width) + "×" + Math.round(r.height) : "-"} 무대 ${q ? Math.round(q.width) + "×" + Math.round(q.height) : "-"}`; }));
    if (!await clickByLabel(/^전체화면$/)) console.warn("⚠ 전체화면 버튼을 못 찾음");
    await page.waitForTimeout(has("--fsidle") ? 4200 : 800);
    // 조작부 판이 열린 화면을 원하면(--fsidle 아님) 도구 버튼으로 못 박아 연다 —
    // 저절로 숨는 3초를 스크린샷 대기가 넘겨 버려, 그냥 두면 늘 숨은 판이 찍힌다.
    if (!has("--fsidle")) {
      await clickByLabel(/^도구 열기$/);
      await page.waitForTimeout(500);
    }
    /* --fsoff: 켰다가 다시 끈다(지적: "전체화면 on 했다가 off시 배율이 이상해짐") — 끈 뒤의 판·배율을 찍는다. */
    if (has("--fsoff")) {
      const mz = () => page.evaluate(() => { const m = document.querySelector(".scr-motion-map"); const st = document.querySelector(".scr-fs-stage"); const r = m?.getBoundingClientRect(); const q = st?.getBoundingClientRect(); return `z ${window.__scrDiag?.zoom ?? null} 지도 ${r ? Math.round(r.width) + "×" + Math.round(r.height) : "-"} 무대 ${q ? Math.round(q.width) + "×" + Math.round(q.height) : "-"}`; });
      const z0 = await mz();
      if (!await clickByLabel(/^전체화면 나가기$/)) console.warn("⚠ 전체화면 나가기 버튼을 못 찾음");
      await page.waitForTimeout(900);
      const z1 = await mz();
      await page.waitForTimeout(1500);
      const z2 = await mz();
      console.log(`[전체화면 끔] ${z0} → ${z1} → ${z2}`);
    }
  }
  /* --foldprobe [dry] (--shot 과 함께): 독 접기·펴기 때 배율·팬·보이는 타일·카메라 가운데 타일을 시간에 따라 찍는다(2026-10-19, 지적: "독 접기시 배율 재계산
     로직이 이상한듯 타일수가 안맞아 그리고 접고펼때 너무 불필요한 화면 이동이 많음"). 타일 = 무대 × 격자 ÷ (덮는 판 × z) · 세로는 가려지는 몫(tb)을 뺀 것도. */
  if (has("--foldprobe")) {
    const vp = () => page.evaluate(() => {
      const v = window.__scrDiag?.viewProbe;
      if (!v) return "없음";
      const [gw, gh] = v.grid; const [cw, ch] = v.cov; const [sw, sh] = v.stage; const z = v.z;
      const tw = (sw * gw) / (cw * z); const th = (sh * gh) / (ch * z); const thv = ((sh - v.tb) * gh) / (ch * z);
      const cx = gw * (0.5 - v.pan[0] / (cw * z)); const cy = gh * (0.5 - v.pan[1] / (ch * z));
      const cyv = cy - (v.tb / 2) * gh / (ch * z);
      const top = cy - (sh / 2) * gh / (ch * z);   // 무대 위끝의 타일 — 손 카메라로 접고 펴면 그대로여야 한다
      return `[${v.cam ?? "-"}·${v.fit || "-"}] ${v.fold ? "접힘" : "펼침"} z ${z.toFixed(3)} 무대 ${sw}×${sh} 가림 ${v.tb} 판 ${cw}×${ch} 타일 ${tw.toFixed(1)}×${th.toFixed(1)}(보이는 세로 ${thv.toFixed(1)}) 가운데 ${cx.toFixed(1)},${cy.toFixed(1)}(보이는 ${cyv.toFixed(1)}) 위끝 ${top.toFixed(1)} 팬 ${v.pan[0].toFixed(0)},${v.pan[1].toFixed(0)} · 사건 ${window.__scrDiag?.evTail ?? "-"}`;
    });
    const series = async (tag) => {
      let last = "";
      for (const ms of [0, 50, 100, 200, 400, 700, 1100, 1600]) {
        await page.waitForTimeout(ms === 0 ? 0 : ms - (series.prev ?? 0));
        series.prev = ms;
        const v = await vp();
        if (v !== last) console.log(`[독 ${tag} +${ms}ms] ${v}`);
        last = v;
      }
      series.prev = 0;
    };
    const dry = flag("--foldprobe") === "dry";   // 대조 — 안 누르고 같은 때에 찍는다(그새 카메라가 저절로 얼마나 가나)
    console.log(`[독 전] ${await vp()}`);
    if (!dry && !await clickByLabel(/인포창 접기$/)) console.warn("⚠ 접기 단추를 못 찾음");
    await series(dry ? "대조1" : "접음");
    if (!dry && !await clickByLabel(/인포창 펼치기$/)) console.warn("⚠ 펼치기 단추를 못 찾음");
    await series(dry ? "대조2" : "폄");
  }
  /* --tvprobe: 정보줄 TV 단추·아이콘·감싸개 상자(지적: "중계버튼 티비아이콘 가운데 안맞고 너무 큼"). */
  if (has("--tvprobe")) {
    const r9 = await page.evaluate(() => {
      const b = document.querySelector(".scr-roster-cam-auto");
      if (!b) return null;
      const f = (e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
      const sv = b.querySelector("svg"); const cs = getComputedStyle(b);
      return { btn: f(b), svg: sv ? f(sv) : null, wrap: f(b.parentElement), pad: cs.padding, disp: cs.display, ai: cs.alignItems, jc: cs.justifyContent, bw: cs.borderWidth };
    });
    console.log("[TV]", JSON.stringify(r9));
  }
  /* 로스터 전체 꼴 검증(--rosterfull) — 기본은 이름만이라, 지표 다섯이 들어간 폭
     다툼(이름 칸이 남는가)이 안 찍힌다. 한 번 눌러 '전체'로 올린다. */
  if (has("--rosterfull")) {
    if (!await clickByLabel(/^로스터 현황 보이기$/)) console.warn("⚠ 로스터 버튼을 못 찾음");
    await page.waitForTimeout(400);
    if (has("--mc")) await supProbe9("B");
  }
  // 로스터 여닫이 검증(--fsroster) — 전체화면에서 로스터 현황을 끈 화면을 찍는다.
  if (has("--fsroster")) {
    await clickByLabel(/^로스터 현황 숨기기$/);
    await page.waitForTimeout(400);
  }
  /* 미니맵 오버레이 검증(--mini) — 그 판은 기본이 꺼짐이라, 켜지 않고 찍으면 자리
     다툼(버튼 줄·재생바와 겹치는가)이 사진에도 계측(miniBottomGap)에도 안 잡힌다. */
  if (has("--mini")) {
    if (!await clickByLabel(/^미니맵 보이기$/)) console.warn("⚠ 미니맵 버튼을 못 찾음");
    await page.waitForTimeout(500);
  }
  // 색 전환 검증(--teamcolor) — 지도 위 색 아이콘을 눌러 팀색으로 바꾼다.
  /* --herocolor — 한 번 더 눌러 주인공색(나 · 아군 · 적군)까지 간다(색 모드 세 갈래: 개인 → 팀 → 주인공). */
  if (has("--teamcolor") || has("--herocolor")) {
    if (!await clickByLabel(/^개인색 —/)) console.warn("⚠ 색 전환 버튼을 못 찾음");
    await page.waitForTimeout(400);
    if (has("--herocolor")) {
      if (!await clickByLabel(/^팀색 —/)) console.warn("⚠ 색 전환 버튼(팀 → 주인공)을 못 찾음");
      await page.waitForTimeout(400);
    }
    console.log("[색 모드]", await page.evaluate(() => document.querySelector(".scr-motion-colbtn")?.getAttribute("aria-label")));
    /* 자국 색을 바꾼 모드로 한 번 더 잰다(--marks · 2026-10) — 주인공 모드면 나·아군·적(HERO_COL9 #2cb494·#fcfc38·#f40404)이어야 한다.
       --heroshot <png> 면 그 모드의 사진도 찍는다(선택 링은 캔버스라 눈으로). */
    if (has("--marks")) {
      await page.waitForTimeout(300);
      const r9 = await page.evaluate(() => [...document.querySelectorAll(".scr-motion-pingfx, .scr-motion-clickfx")].map((el) => ({ cls: el.className.replace("scr-motion-", ""), col: getComputedStyle(el).color })));
      console.log(`[자국 · 색 모드 뒤] ${r9.length}개 · ${JSON.stringify(r9)}`);
      const hs9 = flag("--heroshot", "");
      if (hs9 && hs9 !== true && String(hs9).endsWith(".png")) await page.screenshot({ path: String(hs9), timeout: 120000 });
    }
    /* 주인공색은 중계가 켜진 동안만이다 — TV 목록에서 '끄기'를 고르면 개인색으로 돌아와야 한다. */
    if (has("--herocolor")) {
      const off = await page.evaluate(async () => {
        const w = (ms) => new Promise((r) => { setTimeout(r, ms); });
        document.querySelector(".scr-roster-cam-auto")?.click(); await w(200);
        [...document.querySelectorAll(".scr-motion-pickmenu .scr-motion-pickitem")].find((el) => el.textContent === "끄기")?.click();
        await w(400);
        return document.querySelector(".scr-motion-colbtn")?.getAttribute("aria-label");
      });
      console.log("[색 모드] 중계 끈 뒤", off);
      const ring = await page.evaluate(async () => {
        const w = (ms) => new Promise((r) => { setTimeout(r, ms); });
        const b = () => document.querySelector(".scr-motion-colbtn");
        const out = [];
        for (let i = 0; i < 2; i += 1) { b()?.click(); await w(250); out.push(b()?.getAttribute("aria-label")); }
        return out;
      });
      console.log("[색 모드] 중계 꺼진 채 돌림", ring.join(" → "));
    }
  }
  if (has("--quickzoom")) {
    // 지도 자신이 맞는 지점을 찾는다 — 모바일 세로 바 오버레이가 덮은 자리를 피해서.
    const pt = await page.evaluate(() => {
      for (let y = 300; y < 900; y += 40) {
        for (let x = 60; x < 360; x += 30) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest(".scr-motion-map") && !el.closest(".scr-motion-mobrow")
            && !el.closest(".scr-motion-bar")) return [x, y];
        }
      }
      return [195, 700];
    });
    // 탭 → 320ms 안에 같은 자리 재누름 → 아래로 160px 끌기 = 한 손 확대.
    const gx = pt[0]; const gy = pt[1];
    console.log("한손줌 지점:", gx, gy);
    await page.mouse.move(gx, gy);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(90);
    await page.mouse.down();
    // 위로 끌면 확대(뒤집힌 방향).
    for (let i = 1; i <= 10; i += 1) {
      await page.mouse.move(gx, gy - i * 16, { steps: 1 });
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    // 한 손 줌 검증 — 커밋된 렌즈 배율을 찍는다(1이면 실패).
    console.log("한손줌 배율:", await page.evaluate(
      () => document.querySelector(".scr-motion-lens")?.style.getPropertyValue("--mz") ?? "?"));
  }
  // 지도 배경 화질 검진(--probe-mapvec) — 벡터층 캔버스의 배킹이 지금 배율을 따라왔는지
  // 잰다: 타일당 배킹픽셀(ppt) vs 화면이 요구하는 값(needed). 두 값이 갈리면 흐림이다.
  /* 지도가 창 한가운데 있나(--probe-center) — 프레임 모드는 지도를 창보다 크게 깔아
     자르므로, 좌우로 잘리는 몫이 같아야 '가운데'다. 지적: "가로 중간이 아니라 살짝
     오른쪽에 치우쳐서 보여주면서 시작하네". */
  /* 지도 위 그림 여유(mapBand) — 무대·지도·유닛 캔버스의 실제 자리를 잰다.
     여유가 정말 났는지(무대 위끝 ~ 지도 위끝), 좌우가 꽉 찼는지, 캔버스가 그만큼
     위로 늘어났는지를 한 줄로 본다. */
  /* 미니맵의 보는 창(흰 네모)이 상자 안에 다 들어왔나 — 캔버스 화소를 직접 읽어
     흰 획이 걸친 첫·끝 줄과 칸을 낸다(지적: "1배 줌에서 미니맵에 프레임이 위아래나
     좌우가 안 보이는 경우가 많아"). 0/끝에 붙어 있으면 반이 잘린 것이다. */
  if (has("--probe-mini")) {
    const r = await page.evaluate(() => {
      const cv = document.querySelector(".scr-fs-minimap canvas") || document.querySelector(".scr-fs-minimap");
      if (!(cv instanceof HTMLCanvasElement)) return "미니맵 캔버스 없음";
      const c = cv.getContext("2d");
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1;
      for (let y = 0; y < cv.height; y += 1) {
        for (let x = 0; x < cv.width; x += 1) {
          const i = (y * cv.width + x) * 4;
          if (d[i] > 215 && d[i + 1] > 215 && d[i + 2] > 215 && d[i + 3] > 120) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      return { back: [cv.width, cv.height], white: [x0, y0, x1, y1] };
    });
    console.log("미니맵:", JSON.stringify(r));
  }
  /* 지금 화면에 떠 있는 트레이서를 갈래별로 센다 — "이 무기가 안 나간다"는 신고를
     눈이 아니라 수로 가린다(트레이서는 0.2초짜리라 스크린샷 한 장으로는 못 가린다). */
  /* 로스터에서 손짓을 **누가 받나** — 아바타·이름 글자·그 사이 빈자리·지표 칸의
     네 자리에서 elementFromPoint를 물어, 되살린 두 조각만 로스터가 받고 나머지는
     지도가 받는지 본다(요청: 나머지는 지도로 흘려 더블탭 줌이 되게). */
  if (has("--probe-roster")) {
    const r = await page.evaluate(() => {
      const at = (el, dx, dy) => {
        if (!el) return "없음";
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width * dx, b.top + b.height * dy);
        if (!hit) return "밖";
        const cls = [...hit.classList].filter((c) => c.startsWith("scr-")).join(".");
        return `${hit.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
      };
      const item = document.querySelector(".scr-motion-teamcol-item");
      const ring = document.querySelector(".scr-motion-teamcol .scr-motion-base-ring");
      const name = document.querySelector(".scr-motion-teamcol .scr-motion-teamcol-name");
      const stats = document.querySelector(".scr-motion-teamcol .scr-motion-stats");
      const rr = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
      return {
        로스터세로: rr(document.querySelector(".scr-motion-teamcol")),
        지도세로: rr(document.querySelector(".scr-motion-map")),
        무대세로: rr(document.querySelector(".scr-fs-stage")),
        아바타: at(ring, 0.5, 0.5),
        이름글자: at(name, 0.5, 0.5),
        줄오른쪽끝: at(item, 0.97, 0.3),
        지표칸: at(stats, 0.5, 0.5),
        로스터조상: (() => { let e = document.querySelector(".scr-motion-teamcol"); const out = []; while (e && out.length < 5) { out.push(e.tagName.toLowerCase() + [...e.classList].filter(c=>c.startsWith("scr-")).map(c=>"."+c).join("")); e = e.parentElement; } return out.join(" < "); })(),
        stageL: getComputedStyle(document.querySelector(".scr-fs-layer")).getPropertyValue("--scr-stage-l"),
        판빈자리: at(document.querySelector(".scr-fs-roster-fixed, .scr-motion-rosterwrap, .scr-fs-col"), 0.5, 0.95),
        판오른쪽: at(document.querySelector(".scr-fs-roster-fixed, .scr-motion-rosterwrap, .scr-fs-col"), 0.99, 0.5),
      };
    });
    console.log("로스터 손짓:", JSON.stringify(r, null, 0));
  }
  if (has("--probe-gl")) {
    // GL 붓의 메시 표 — 열쇠 · 삼각 수 · 부품 색 가짓수(모델 세부가 빠졌는지 보는 자).
    const r = await page.evaluate(() => {
      const g = window.__gl9; if (!g) return "GL 없음";
      // 벌의 문턱(기기 표·벤치 단이 먹였다) — 메시 상한·번짐 켜짐. 폰 세 단이 제대로 먹었나를 여기서 본다.
      const rows = [`상한 ${g.meshMax}벌 · 번짐 ${g.bloomOn ? "켬" : "끔"}`, `stat ${JSON.stringify(g.stat)}`];
      for (const [k, m] of g.meshes) {
        if (!m) { rows.push(k + " ∅"); continue; }
        rows.push(`${k} 삼각 ${m.n / 3} 색 ${m.cols} ${(m.bytes / 1024).toFixed(0)}KB`);
      }
      return rows.join("\n");
    });
    console.log("GL 메시:\n" + r);
  }
  if (has("--probe-fx")) {
    const r = await page.evaluate(() => {
      const d = window.__scrDiag;
      return d ? { fx: d.fx, prod: d.prod, gl: d.gl } : "SCR_DIAG 없음(#diag로 켜야 한다)";
    });
    console.log("트레이서:", JSON.stringify(r));
  }
  /* 지도 벡터층의 두 판(요청: "밑판 + 선명창") — 밑판이 정말 구워져 맵 전체를 덮고
     있나, 위 창은 어느 만큼을 또렷하게 덮고 있나. 끌 때 빈 자리가 나는지의 답이 이 둘의
     크기 비다: 밑판이 0이면 창 밖은 여전히 검다. */
  /* 조종부와 아이콘 줄이 안 겹치나(--probe-fsbot) — 지적: "모바일 전체화면에서 버튼과
     재생바 겹침". 겹침의 답은 한 줄이다: 아이콘 줄의 **아랫변**이 조종부의 **윗변**보다
     위에 있어야 한다. 실측 변수(--scr-fsbot-m)와 그것을 먹은 값(--scr-fsbot)도 함께
     찍어, 안 맞을 때 '못 쟀나 · 재고도 안 먹었나'를 바로 가른다. */
  if (has("--probe-fsbot")) {
    console.log("조종부/아이콘줄:", JSON.stringify(await page.evaluate(() => {
      const lyr = document.querySelector(".scr-fs-layer");
      const bot = document.querySelector(".scr-fs-bottom");
      const row = document.querySelector(".scr-motion-mapbtns");
      if (!lyr || !bot || !row) return "요소 없음";
      const cs = getComputedStyle(lyr);
      const b = bot.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      return {
        measured: cs.getPropertyValue("--scr-fsbot-m").trim() || "(없음)",
        used: cs.getPropertyValue("--scr-fsbot").trim(),
        botTop: Math.round(b.top), botH: Math.round(b.height),
        rowBottom: Math.round(r.bottom), rowH: Math.round(r.height),
        gap: Math.round(b.top - r.bottom),
        overlap: r.bottom > b.top,
      };
    })));
  }
  if (has("--probe-mapbase")) {
    const r = await page.evaluate(() => {
      const box = document.querySelector(".scr-motion-mapvec");
      if (!box) return "지도 벡터층 없음";
      const cs = [...box.querySelectorAll("canvas")];
      const b = box.getBoundingClientRect();
      return {
        box: [Math.round(b.width), Math.round(b.height)],
        canvases: cs.map((c) => {
          const r2 = c.getBoundingClientRect();
          return {
            backing: `${c.width}x${c.height}`,
            css: `${Math.round(r2.width)}x${Math.round(r2.height)}`,
            covers: Math.round((r2.width / Math.max(1, b.width)) * 100) + "%",
          };
        }),
      };
    });
    console.log("지도 벡터층(밑판+창):", JSON.stringify(r));
  }
  if (has("--probe-band")) {
    const r = await page.evaluate(() => {
      const st = document.querySelector(".scr-fs-stage");
      const mp = document.querySelector(".scr-motion-map");
      const cv = document.querySelector(".scr-motion-unitlayer");
      if (!st || !mp) return null;
      const s = st.getBoundingClientRect();
      const m = mp.getBoundingClientRect();
      const c = cv ? cv.getBoundingClientRect() : null;
      return {
        stage: [Math.round(s.width), Math.round(s.height)],
        map: [Math.round(m.width), Math.round(m.height)],
        bandTop: Math.round(m.top - s.top),
        sideGap: Math.round((s.width - m.width) / 2),
        canvasUp: c ? Math.round(m.top - c.top) : null,
        cssBand: getComputedStyle(mp).getPropertyValue("--scr-mapband").trim(),
      };
    });
    console.log("여유:", JSON.stringify(r));
  }
  if (has("--probe-center")) {
    const r = await page.evaluate(() => {
      const row = document.querySelector(".scr-motion-frame");
      const layer = document.querySelector(".scr-fs-layer");
      const stage = document.querySelector(".scr-fs-stage");
      const map = document.querySelector(".scr-motion-map");
      const lens = document.querySelector(".scr-motion-lens");
      if (!stage || !map) return null;
      const s = stage.getBoundingClientRect();
      const m = map.getBoundingClientRect();
      const l = lens ? lens.getBoundingClientRect() : null;
      const btns = document.querySelector(".scr-motion-mapbtns");
      const mini = document.querySelector(".scr-fs-minipanel");
      const bot = document.querySelector(".scr-fs-bottom");
      const rng = document.querySelector(".scr-motion-range");
      const rw = row ? row.getBoundingClientRect() : null;
      const ly = layer ? layer.getBoundingClientRect() : null;
      return {
        /* 줄 → 판 → 무대가 폭을 한 톨도 안 잃고 이어지나(지적: "맵 오른쪽 검정 띠") */
        row: rw ? [+rw.left.toFixed(2), +rw.width.toFixed(2)] : null,
        layer: ly ? [+ly.left.toFixed(2), +ly.width.toFixed(2), +ly.height.toFixed(2)] : null,
        rowVsLayer: rw && ly ? +(rw.width - ly.width).toFixed(2) : null,
        /* 아래 조작줄과 진행바의 높이 — 판 안에서는 이 높이가 곧 지도를 먹는 몫이다. */
        bottomH: bot ? +bot.getBoundingClientRect().height.toFixed(1) : null,
        /* 아래층 높이를 정하는 CSS 값들 — 손으로 적은 수와 실제가 갈리는지 본다. */
        fsbot: (() => { const l = document.querySelector(".scr-fs-layer");
          if (!l) return null; const cs = getComputedStyle(l);
          return [cs.getPropertyValue("--scr-fsbot").trim(),
            cs.getPropertyValue("--scr-botpad").trim(),
            cs.getPropertyValue("--scr-safeb").trim()]; })(),
        /* 조종부 줄의 실제 높이와 CSS가 준 height — 진행바 높이에 안 딸리는지 본다. */
        ctlH: (() => { const c = document.querySelector(".scr-fs-bottom > .scr-motion-bar-controls");
          return c ? [+c.getBoundingClientRect().height.toFixed(1), getComputedStyle(c).height] : null; })(),
        /* 아이콘 줄·미니맵의 아래 끝(무대 바닥 기준) — 포인터 갈래로 달라지는지 본다. */
        btnsBottomGap: btns && s ? +((s.bottom - btns.getBoundingClientRect().bottom)).toFixed(1) : null,
        btnsH: btns ? +btns.getBoundingClientRect().height.toFixed(1) : null,
        miniBottomGap: mini && s ? +((s.bottom - mini.getBoundingClientRect().bottom)).toFixed(1) : null,
        rangeH: rng ? +rng.getBoundingClientRect().height.toFixed(1) : null,
        stage: [+s.left.toFixed(2), +s.width.toFixed(2)],
        map: [+m.left.toFixed(2), +m.width.toFixed(2)],
        lens: l ? [+l.left.toFixed(2), +l.width.toFixed(2)] : null,
        cutLeft: +(s.left - m.left).toFixed(2),
        cutRight: +((m.left + m.width) - (s.left + s.width)).toFixed(2),
        cutTop: +(s.top - m.top).toFixed(2),
        cutBottom: +((m.top + m.height) - (s.top + s.height)).toFixed(2),
      };
    });
    console.log("[가운데 검사]", JSON.stringify(r, null, 1));
    /* 로스터 이름 칸이 실제로 얼마나 넓은가(--probe-center와 함께) — 말줄임의 범인이
     칸 나눔인지 칩의 max-width인지 값으로 가린다. */
  /* 지도 밖 줄들이 프레임 안에 다 들어왔나(--probe-center) — 아래 끝이 프레임 밖으로
     나가면 그만큼 **잘려서 안 보인다**(지적, iOS: "버튼·재생바가 잘려서 안 보임"). */
  console.log("[잘림]", JSON.stringify(await page.evaluate(() => {
    /* 자르는 것은 **판**(.scr-fs-layer)이다 — max-height(높이 예산)와 overflow:hidden이
       거기 걸린다. 바깥 .scr-motion-frame은 안 자르므로 그것을 재면 늘 0이 나온다. */
    const fr = document.querySelector(".scr-fs-layer");
    const bot = document.querySelector(".scr-fs-bottom");
    const btn = document.querySelector(".scr-motion-mapbtns");
    const st = document.querySelector(".scr-fs-stage");
    if (!fr || !bot) return null;
    const f = fr.getBoundingClientRect();
    const b = bot.getBoundingClientRect();
    const k = btn?.getBoundingClientRect();
    const cs = getComputedStyle(fr);
    return {
      innerH: window.innerHeight, outerH: window.outerHeight,
      frameH: +f.height.toFixed(1), frameMaxH: cs.maxHeight,
      overflow: cs.overflow,
      stageH: st ? +st.getBoundingClientRect().height.toFixed(1) : null,
      stageMaxH: st ? getComputedStyle(st).maxHeight : null,
      // 양수면 그만큼 프레임 밖 = 잘린 몫이다.
      barCut: +(b.bottom - f.bottom).toFixed(1),
      btnCut: k ? +(k.bottom - f.bottom).toFixed(1) : null,
    };
  })));
  /* 지도 밖 독의 배치(--probe-center) — 미니맵이 왼쪽, 그 오른쪽 위가 버튼 줄,
     아래가 재생바인가를 좌표로 가린다(사진을 못 볼 때도 이 값이면 읽힌다). */
  console.log("[독]", JSON.stringify(await page.evaluate(() => {
    const R = (q) => { const e = document.querySelector(q);
      if (!e) return null; const r = e.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const mini = document.querySelector(".scr-fs-minipanel");
    return {
      stage: R(".scr-fs-stage"), mini: R(".scr-fs-minipanel"),
      miniCv: R(".scr-fs-minipanel canvas"),
      btns: R(".scr-motion-mapbtns"), bar: R(".scr-fs-bottom"),
      miniPos: mini ? getComputedStyle(mini).position : null,
      stageInline: (() => { const e = document.querySelector(".scr-fs-stage");
        return e ? [e.style.height || "-", e.style.aspectRatio || "-", e.style.maxHeight || "-"] : null; })(),
      rootDisplay: (() => { const e = document.querySelector(".scr-fs-root");
        return e ? getComputedStyle(e).display : null; })(),
      miniBtn: !!document.querySelector('button[aria-label^="미니맵"]'),
      /* 조종부가 제 칸을 넘치나 — 넘친 몫은 판의 overflow:hidden이 오른쪽에서 잘라 낸다
         (지적: "재생부가 잘리는데 오른쪽이"). scroll > client면 그만큼 넘쳤다. */
      barFit: (() => { const e = document.querySelector(".scr-fs-bottom");
        if (!e) return null;
        return { scroll: e.scrollWidth, client: e.clientWidth,
          kids: [...e.children].map((c) => [c.className.toString().slice(0, 24),
            Math.round(c.getBoundingClientRect().left), Math.round(c.getBoundingClientRect().width)]) }; })(),
    };
  })));
  /* 효과 시트(--probe-center) — 확대를 레이아웃으로 안는가: 폭이 지도 상자×배율이고
     transform에 scale이 **없어야** 한다(scale이 보이면 옛 미러가 남은 것이다). */
  console.log("[시트]", JSON.stringify(await page.evaluate(() => {
    const e = document.querySelector(".scr-motion-fxlens");
    const m = document.querySelector(".scr-motion-map");
    if (!e || !m) return null;
    const r = e.getBoundingClientRect();
    return {
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      mapW: +m.getBoundingClientRect().width.toFixed(1),
      styleW: e.style.width, xf: e.style.transform,
    };
  })));
  console.log("[버튼]", JSON.stringify(await page.evaluate(() => ({
    labels: [...document.querySelectorAll("button[aria-label]")]
      .map((b) => b.getAttribute("aria-label") + (b.getAttribute("aria-pressed") ?? "")),
    mini: !!document.querySelector(".scr-fs-minipanel"),
    isFs: !!document.querySelector(".scr-fs-layer.is-fs"),
  }))));
  console.log("[로스터]", JSON.stringify(await page.evaluate(() => {
    const col = document.querySelector(".scr-fs-roster-fixed .scr-motion-teamcol");
    const it = document.querySelector(".scr-fs-roster-fixed .scr-motion-teamcol-item");
    const nm = document.querySelector(".scr-fs-roster-fixed .scr-motion-teamcol-name");
    const r = (e) => (e ? +e.getBoundingClientRect().width.toFixed(1) : null);
    return {
      colW: r(col), itemW: r(it), nameW: r(nm),
      nameCell: nm ? +nm.parentElement.getBoundingClientRect().width.toFixed(1) : null,
      nameMax: nm ? getComputedStyle(nm).maxWidth : null,
      cols: col ? getComputedStyle(it ?? col).gridTemplateColumns : null,
      scroll: nm ? [nm.scrollWidth, nm.clientWidth] : null,
    };
  })));
  /* 그림 자체가 상자 안에서 치우쳤나 — 지도 배경 캔버스의 잉크 상자를 재서 좌우
       여백을 견준다(상자가 가운데여도 그림이 치우치면 화면에서는 치우쳐 보인다). */
    const ink = await page.evaluate(() => {
      const cv = document.querySelector(".scr-motion-map canvas");
      if (!cv) return null;
      const c = cv.getContext("2d", { willReadFrequently: true });
      const { width: W, height: H } = cv;
      const d = c.getImageData(0, 0, W, H).data;
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        if (d[(y * W + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return { W, H, x0, x1, y0, y1, padL: x0, padR: W - 1 - x1, padT: y0, padB: H - 1 - y1 };
    });
    console.log("[그림 잉크]", JSON.stringify(ink));
  }
  if (has("--probe-mapvec")) {
    console.log("지도배킹:", JSON.stringify(await page.evaluate(() => {
      /* ★ **선명한 창**을 콕 집는다 — 이제 이 층에는 캔버스가 둘이고(밑판이 먼저)
         `.scr-motion-mapvec canvas`는 밑판을 문다. 밑판은 배율을 안 타므로 그대로 두면
         이 검진이 "확대해도 배킹이 안 는다"고 늘 거짓 경보를 낸다. */
      const cv = document.querySelector(".scr-mapvec-sharp");
      /* R-접기(입체) 검증 — 레이아웃 폭이 R배로 컸는지, 1/R 접기가 걸렸는지는
         rect(시각 크기)로는 안 보인다: 접힌 결과가 원래 크기와 같아야 정답이라서다.
         style을 직접 읽는다. */
      if (cv) console.log("");
      const boxEl = document.querySelector(".scr-motion-mapvec");
      const rStyle = cv ? { w: cv.style.width, xf: cv.style.transform, org: cv.style.transformOrigin } : null;
      const lens = document.querySelector(".scr-motion-lens");
      if (!cv || !boxEl || !lens) return null;
      const mz = Number(lens.style.getPropertyValue("--mz") || 1);
      const wPct = Number.parseFloat(cv.style.width || "100") / 100;
      const bw = boxEl.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      /* 화면에 그려지는 폭은 **잰다** — 스타일 문자열(%)을 파싱하던 앞판은 그 단위가
         px로 바뀌자 조용히 엉뚱한 값을 냈다(배율 0.02 따위). 잰 값은 안 틀린다. */
      /* 화면에 실제로 놓인 자리 — 지도 층을 렌즈 밖으로 옮긴 뒤에도 이 값이 그대로여야
         한다(옮기기 전후를 견주는 자다). 유닛 캔버스 자리를 기준으로 뺀 상대값이라
         스크롤·헤더 높이에 안 흔들린다. */
      const ucv = document.querySelector(".scr-motion-unitlayer");
      const r = cv.getBoundingClientRect();
      const ur = ucv ? ucv.getBoundingClientRect() : { left: 0, top: 0 };
      const rect = [r.left - ur.left, r.top - ur.top, r.width, r.height]
        .map((v) => Math.round(v * 10) / 10).join(",");
      /* 배율 = 배킹 ÷ (그려지는 폭 × dpr). **1.0000이라야 재표본이 없다.** */
      return {
        rStyle, rect, mz, cvW: cv.width, cvH: cv.height, boxW: bw, dpr,
        shownCss: Math.round(r.width * 10) / 10,
        scale: +(cv.width / (r.width * dpr)).toFixed(4),
        backingPerCss: +(cv.width / r.width).toFixed(2), needPerCss: dpr };
    })));
  }
  // 조각 확대 촬영(--shotel <선택자>) — 작은 글자가 잘렸는지 눈으로 가리려면 화면 전체
  // 스크린샷은 너무 작다. 그 요소만 3배로 키워 찍는다(줌은 CSS라 글자가 다시 그려진다).
  if (flag("--shotel", null)) {
    const sel = String(flag("--shotel"));
    const el = await page.$(sel);
    if (!el) console.warn(`⚠ --shotel: ${sel} 없음`);
    else {
      /* ★ CSS zoom으로 키우지 마라(내가 한 번 속았다) — zoom은 글자만 3배로 만들고
         `max-width: 92px` 같은 **px 죔은 그대로 두어**, 멀쩡한 이름칩이 잘려 보인다.
         곧 확대가 없던 잘림을 만들어 낸다. 크게 보려면 --dpr을 올려 찍어라(배킹만
         커지고 배치는 한 톨도 안 바뀐다). */
      await el.screenshot({ path: String(flag("--shot", "el.png")).replace(/\.png$/, "-el.png") });
      console.log("조각:", String(flag("--shot", "el.png")).replace(/\.png$/, "-el.png"));
    }
  }
  /* (안 만든다) 미사일 두 발 검진 — 캔버스의 리액트 파이버에서 fxOps를 꺼내 두 발의
     간격을 재려 했는데, 이 합성 세계에서는 **전투 효과가 한 톨도 안 실린다**(fx 배열이
     늘 빈손이다 — 지상 난전이 도는 순간에도). 늘 0을 내는 계측기는 없느니만 못하다:
     "0이니까 통과"로 읽히는 거짓 오라클이 된다(이번 판에서 그런 오라클에 두 번 속았다).
     미사일 간격은 대신 **셈으로** 못박았다: 두 발의 전체 폭 = 간격 + 잔상 굵기 = 잉크
     폭(= 화면에 보이는 몸)이 되도록 반폭을 (잉크 − 굵기)/2로 잡는다. 옛 값(상자의 0.6배)
     은 발키리·골리앗·레이스 셋 모두에서 몸의 1.85배였다(상자 → 몸 환산이 5.2/16).
     합성 세계에 전투 효과를 실어야 이 자리가 눈으로도 검증된다 — 다음 판의 몫이다. */
  // 로스터 이름 검진(--probe-rostername) — 이름칩이 잘리는지, 몇 px 모자란지 잰다.
  if (has("--probe-rostername")) {
    console.log("로스터이름:", JSON.stringify(await page.evaluate(() => {
      const panel = document.querySelector(".scr-fs-roster-fixed");
      if (!panel) return null;
      /* ⚠ **잘림 여부는 여기서 못 잰다** — 두 번 속았다: ① `text-overflow: ellipsis`가
         걸린 칸은 크롬이 줄인 글자를 실제로 그려 scrollWidth가 clientWidth와 같아지고,
         ② 죔을 풀거나 복제해 재는 우회로도 이 칩에서는 늘 같은 값(41)이 나왔다 —
         실제로는 판 300px에서 잘리고 320px에서 안 잘리는데도 그렇다.
         잘림은 **눈으로** 가려라: `--dpr 4 --shotel .scr-fs-roster-fixed`로 그 판만
         크게 찍으면 확실하다(CSS zoom으로 키우면 글자만 커지고 px 죔은 그대로라
         없던 잘림이 생긴다 — 그것도 한 번 속은 자리다).
         여기 남기는 것은 믿을 수 있는 것뿐이다: 판과 칸의 실제 폭. */
      return {
        panelW: Math.round(panel.getBoundingClientRect().width),
        names: [...panel.querySelectorAll(".scr-motion-teamcol-name")].map((el) => {
          const head = el.closest(".scr-motion-teamcol-head");
          return { t: el.textContent,
            w: Math.round(el.getBoundingClientRect().width),
            cellW: el.parentElement ? Math.round(el.parentElement.getBoundingClientRect().width) : null,
            headW: head ? Math.round(head.getBoundingClientRect().width) : null };
        }),
      };
    })));
  }
  // 도구 판 검진(--probe-toolpanel) — 판과 그 안 알약 묶음들의 실제 폭을 잰다.
  // 1열로 세울 때 판을 얼마나 좁힐 수 있나가 여기서 나온다(넘침도 함께 본다).
  if (has("--probe-toolpanel")) {
    console.log("도구판:", JSON.stringify(await page.evaluate(() => {
      const tp = document.querySelector(".scr-fs-toolpanel");
      if (!tp) return null;
      const cs = getComputedStyle(tp);
      const row = tp.querySelector(".scr-motion-viewrow");
      const kids = (el) => [...el.children].map((c) => {
        const r = c.getBoundingClientRect();
        const lab = c.querySelector?.(".scr-motion-radio-label");
        return { t: (lab?.textContent ?? c.className.toString()).slice(0, 14),
          w: Math.round(r.width), sw: c.scrollWidth };
      });
      /* 최소 폭 쓸기 — 폭을 좁혀 가며 **안에서 넘치는 자식이 생기는 지점**을 찾는다.
         판 자신의 scrollWidth는 자식이 늘어나 버티면 안 늘므로 자식까지 함께 본다. */
      const over = () => [...tp.querySelectorAll("*")]
        .some((c) => c.scrollWidth > c.clientWidth + 1);
      const w0 = tp.style.width;
      let minW = null;
      for (let w = 200; w >= 80; w -= 4) {
        tp.style.width = `${w}px`;
        void tp.offsetWidth;
        if (over()) break;
        minW = w;
      }
      tp.style.width = w0;
      return {
        minFitW: minW,
        panelW: Math.round(tp.getBoundingClientRect().width),
        panelScrollW: tp.scrollWidth, pad: cs.padding,
        rowDir: row ? getComputedStyle(row).flexDirection : null,
        rowW: row ? Math.round(row.getBoundingClientRect().width) : null,
        rowKids: row ? kids(row) : null,
        panelKids: kids(tp),
      };
    }), null, 1));
  }
  // 지도 아이콘 버튼 검진(--probe-mapbtns) — 슬라이더 여닫이가 버튼으로만 열리고,
  // 지도 탭은 닫기만 하는지(요청: 한 번 누름으로 여는 오버레이는 없음)를 손짓으로 잰다.
  if (has("--probe-mapbtns")) {
    const barOpen = () => page.evaluate(() => {
      const ov = document.querySelector(".scr-motion-slideover");
      return ov ? !ov.className.includes("slideover-off") : null;
    });
    const btnAt = await page.evaluate(() => {
      const b = document.querySelector(".scr-motion-mapbtns button");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    });
    const mapPt = await page.evaluate(() => {
      for (let y = 250; y < 700; y += 40) {
        for (let x = 60; x < 330; x += 30) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest(".scr-motion-map") && !el.closest(".scr-motion-mapbtns")
            && !el.closest(".scr-motion-bar")) return [x, y];
        }
      }
      return [180, 400];
    });
    const st0 = await barOpen();
    if (btnAt) { await page.mouse.click(btnAt[0], btnAt[1]); await page.waitForTimeout(250); }
    const st1 = await barOpen();
    await page.mouse.click(mapPt[0], mapPt[1]); await page.waitForTimeout(600);
    const st2 = await barOpen();
    await page.mouse.click(mapPt[0], mapPt[1] + 40); await page.waitForTimeout(600);
    const st3 = await barOpen();
    console.log(`지도버튼: 버튼=${btnAt ? "있음" : "없음"} 처음=${st0} 버튼누름→${st1} 지도탭→${st2} 지도탭→${st3}`);
    console.log("기대: 처음=false 버튼누름→true 지도탭→false 지도탭→false");
  }
  // 핵 연출 검진(--probe-nuke) — 지금 화면의 핵 연출 스팬(점·낙하·폭발)을 찍는다.
  /* 미니맵의 '보는 창'(--probe-mini) — 흰 네모가 안 보이는 까닭을 값으로 가린다. */
  if (has("--probe-mini")) {
    /* 미니맵 조각만 따로 찍는다 — 화면 전체 사진에서는 80px짜리 판의 한 줄 차이를
       눈으로 못 가린다(이번 지적이 그 크기다). */
    {
      const el9 = await page.$(".scr-fs-minipanel");
      if (el9) {
        const out9 = String(flag("--shot", "el.png")).replace(/\.png$/, "-mini.png");
        await el9.screenshot({ path: out9 });
        console.log("미니맵 조각:", out9);
      }
    }
    console.log("미니맵창:", JSON.stringify(await page.evaluate(() => {
      const el = document.querySelector(".scr-fs-minipanel canvas");
      const mm = document.querySelector(".scr-fs-minipanel .scr-fs-minimap");
      const bx = document.querySelector(".scr-fs-minipanel .scr-motion-minibox");
      const pn = document.querySelector(".scr-fs-minipanel");
      const R = (e) => (e ? [+e.getBoundingClientRect().width.toFixed(1),
        +e.getBoundingClientRect().height.toFixed(1)] : null);
      return {
        view: window.__miniView ?? null,
        // 캔버스의 화면 크기와 배킹 크기 — 배킹이 화면보다 작으면 그만큼 흐리다.
        box: el ? [+el.getBoundingClientRect().width.toFixed(1),
          +el.getBoundingClientRect().height.toFixed(1), el.width, el.height] : null,
        /* ★ 그리는 칸의 **안쪽 크기**(clientW/H) — 컴포넌트가 이 값으로 지도를 늘려
           그리므로, 이것이 지도 비와 어긋나면 아랫줄이 잘린다. */
        client: mm ? [mm.clientWidth, mm.clientHeight] : null,
        mmBox: R(mm), miniboxBox: R(bx), panelBox: R(pn),
        mmCss: mm ? (() => { const c = getComputedStyle(mm);
          return [c.aspectRatio, c.boxSizing, c.borderTopWidth, c.flex]; })() : null,
        panelCss: pn ? (() => { const c = getComputedStyle(pn);
          return [c.padding, c.display, c.flexDirection, c.gap, c.height, c.maxHeight]; })() : null,
        /* 캔버스의 **줄별 잉크** — 위·아래에서 몇 줄이 통째로 비었나(투명·새까맘)를 센다.
           '아랫줄이 완전히 가려진다'가 그리는 칸이 짧아서인지, 그 자리가 실제로 어두운
           것인지를 가른다. */
        rows: (() => {
          if (!el) return null;
          const g = el.getContext("2d", { willReadFrequently: true });
          if (!g) return null;
          const W = el.width, H = el.height;
          const d = g.getImageData(0, 0, W, H).data;
          const lit = [];
          for (let y = 0; y < H; y += 1) {
            let on = 0;
            for (let x = 0; x < W; x += 1) {
              const i = (y * W + x) * 4;
              if (d[i + 3] > 8 && (d[i] + d[i + 1] + d[i + 2]) > 40) { on = 1; break; }
            }
            lit.push(on);
          }
          let top = 0; while (top < H && !lit[top]) top += 1;
          let bot = 0; while (bot < H && !lit[H - 1 - bot]) bot += 1;
          return { H, blankTop: top, blankBottom: bot };
        })(),
      };
    })));
  }
  if (has("--probe-nuke")) {
    console.log("핵:", JSON.stringify(await page.evaluate(() => ({
      clock: document.querySelector(".scr-motion-clock")?.textContent ?? "?",
      /* 조각마다 **화면에서의 가운데**를 상자 가운데와 견준다(지적: "핵구름 아직도 살짝
         왼쪽으로 올라감" · "탄착지가 조준점과 일치 안 함") — dx가 0이 아니면 그만큼
         치우친 것이다. 단위는 px. */
      fx: [...document.querySelectorAll(".scr-motion-nukefx")].map((el) => {
        const b = el.getBoundingClientRect();
        const bx = b.left + b.width / 2, by = b.top + b.height / 2;
        return {
          at: `${el.style.left}/${el.style.top}`,
          box: [+b.width.toFixed(1), +b.height.toFixed(1)],
          kids: [...el.children].map((c) => {
            const r = c.getBoundingClientRect();
            return {
              n: c.className.toString().replace("scr-motion-nuke-", ""),
              dx: +((r.left + r.width / 2) - bx).toFixed(1),
              dy: +((r.top + r.height / 2) - by).toFixed(1),
              w: +r.width.toFixed(1), h: +r.height.toFixed(1),
            };
          }),
        };
      }),
    }))));
  }
  // 전체화면 하단 줄 검진(--probe-fsbar) — 여닫이·공유가 서 있는지 자리로 찍는다.
  if (has("--probe-fsbar")) {
    console.log(JSON.stringify(await page.evaluate(() =>
      [".scr-fs-bottom-mob", ".scr-motion-mobrow", ".scr-motion-mobfs", ".scr-kakao-share-btn",
        ".scr-fs-rosterbtn", ".scr-fs-roster-fixed"].map((s) => {
        const el = document.querySelector(s);
        if (!el) return [s, null];
        const r = el.getBoundingClientRect();
        return [s, [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]];
      }))));
  }
  /* 로스터 격자 검진(--probe-rostergrid) — 라벨 줄과 사람 줄의 **칸 경계**를 나란히
     찍는다. 줄맞음은 눈으로는 못 가린다(스크린샷은 배율이 섞인다) — 같은 자로 잰
     left/right가 곧 답이다. */
  if (has("--probe-rostergrid")) {
    console.log("로스터격자:", JSON.stringify(await page.evaluate(() => {
      const col = document.querySelector(".scr-motion-teamcol-rows");
      if (!col) return null;
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { t: (el.textContent || "").slice(0, 9), l: Math.round(r.left), r: Math.round(r.right) };
      };
      const rowOf = (el) => {
        const cs = getComputedStyle(el);
        return {
          cls: el.className.toString().slice(0, 34),
          display: cs.display, cols: cs.gridTemplateColumns, pad: cs.padding, gap: cs.gap,
          l: Math.round(el.getBoundingClientRect().left),
          r: Math.round(el.getBoundingClientRect().right),
          h: +el.getBoundingClientRect().height.toFixed(1),
          top: +el.getBoundingClientRect().top.toFixed(1),
          cells: [...el.children].flatMap((c) => (getComputedStyle(c).display === "contents"
            ? [...c.children].map(box) : [box(c)])),
        };
      };
      return [...col.children].map(rowOf);
    }), null, 1));
  }
  if (has("--probe-die")) {
    console.log("사망:", JSON.stringify(await page.evaluate(() => {
      const els = [...document.querySelectorAll(".scr-motion-diefx")];
      return {
        dom: els.length,
        rects: els.slice(0, 6).map((e) => {
          const r = e.getBoundingClientRect();
          const p = e.parentElement;
          return [Math.round(r.x), Math.round(r.y), Math.round(r.width),
            getComputedStyle(p).position];
        }),
      };
    })));
  }
  // 로스터 표 검진(--probe-roster) — 줄 높이·간격·칸 나눔을 계산값으로 찍는다.
  if (has("--probe-roster")) {
    console.log(JSON.stringify(await page.evaluate(() => {
      const col = document.querySelector(".scr-motion-teamcol");
      if (!col) return null;
      const cs = getComputedStyle(col);
      const item = col.querySelector(".scr-motion-teamcol-item");
      const ics = item ? getComputedStyle(item) : null;
      const rows = [...col.children].map((c) => ({
        cls: c.className.toString().slice(0, 40), h: Math.round(c.getBoundingClientRect().height),
      }));
      return {
        colDisplay: cs.display, colGap: cs.gap, colMinH: cs.minHeight,
        itemGrid: ics?.gridTemplateColumns, itemH: item ? Math.round(item.getBoundingClientRect().height) : 0,
        rows,
      };
    }), null, 1));
  }
  // 주석 누출 검사(지적: "뭔데 주석이 보이지") — JSX 자식 자리의 맨 /* 주석은 글자로 찍힌다.
  const leak = await page.evaluate(() => {
    const i = document.body.innerText.indexOf("/*");
    return i < 0 ? null : document.body.innerText.slice(Math.max(0, i - 40), i + 120);
  });
  console.log(leak ? `⚠ 주석 누출:\n${leak}` : "주석 누출 없음");
  /* 툴박스 상자(--tbopen) — 툴박스는 늘 펼쳐져 있다(접기는 걷었다 · 이름은 옛 손잡이 그대로). 상자들을 적는다:
     툴박스·두 줄·독 줄·미니맵·인포창의 [왼 위 폭 높이](CSS px). */
  if (has("--tbopen")) {
    console.log("[툴박스]", JSON.stringify(await page.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
      return { tb: r(".scr-tb"), btns: r(".scr-tb-btnrow"), seek: r(".scr-tb-seek"),
        row: r(".scr-fs-dockrow"), mini: r(".scr-fs-minipanel .scr-fs-minimap"), dock: r(".scr-motion-infodock"), stage: r(".scr-fs-stage"), map: r(".scr-motion-map"), lower: r(".scr-fs-lower") };
    })));
  }
  /* --colprobe(2026-10-22, 지적: "오버로드 인포창 업그레이드 칸 잘림") — 하나 고른 인포창의 세 기둥 폭 · 업그레이드 칸 자리 · 몸 바닥. */
  if (has("--colprobe")) console.log("[인포창 기둥]", await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const one = document.querySelector(".scr-motion-infodock-one");
    return JSON.stringify({ body: r(document.querySelector(".scr-motion-infodock-body")), cols: one ? [...one.children].map((c) => [c.className.split(" ")[0], r(c)]) : null,
      ups: [...document.querySelectorAll(".scr-motion-infodock-upsq i")].map(r), sup: [...document.querySelectorAll(".scr-motion-infodock-supply > span")].map(r) });
  }));
  if (has("--rosterprobe")) console.log("[로스터 끝]", await page.evaluate(() => {
    const w = (q) => { const e = document.querySelector(q); return e ? +e.getBoundingClientRect().width.toFixed(1) : null; };
    /* 인포창 넘침 자(2026-10-09, 물음: "어떤 경우에도 인포창 내용 잘림 없지?") — 몸(.scr-motion-infodock-body)의 scrollHeight − clientHeight 와,
       자손 가운데 몸 바닥 아래로 내려간 가장 큰 몫(px). 둘 다 0 이어야 잘림이 없다. */
    const body = document.querySelector(".scr-motion-infodock-body");
    let over = 0; let below = 0; let overX = 0; let right = 0;
    if (body) {
      over = body.scrollHeight - body.clientHeight;
      overX = body.scrollWidth - body.clientWidth;   // 옆 넘침(폰 글자 키움 검산 · 2026-10-09)
      const bb = body.getBoundingClientRect();
      for (const el of body.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.height > 0) { below = Math.max(below, r.bottom - bb.bottom); right = Math.max(right, r.right - bb.right); } }
    }
    return `${document.querySelector(".scr-dock-roster")?.className} · 인포창 ${w(".scr-fs-dockmain > .scr-motion-infodock")} · 판 ${w(".scr-fs-rosterpanel")} · 독메인 ${w(".scr-fs-dockmain")} · 줄 ${w(".scr-fs-dockrow")} · 인포 넘침 ${over.toFixed(1)} · 바닥 밖 ${below.toFixed(1)} · 옆 넘침 ${overX.toFixed(1)} · 오른쪽 밖 ${right.toFixed(1)}`;
  }));
  if (has("--tagprobe")) console.log("[미니맵 택]", await tagProbe9(page));
  if (has("--capprobe")) await capProbe9(page);
  await page.screenshot({ path: SHOT });
  console.log(`스크린샷: ${SHOT}`);
  try { console.log(`[GL] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.gl) || "(진단 없음 — --diag)")}`); } catch { /* 없음 */ }
  await browser.close();
  process.exit(0);
}
if (ENGINE === "webkit") {
  console.log("웹킷은 배치·크기 검사용이다 — CPU 조임·프로파일러는 크로뮴 전용이라 여기서 끝낸다.");
  await browser.close();
  process.exit(0);
}
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

if (PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: Number(flag("--interval", 2000)) }); }
const tracePath = join(tmpdir(), "perf-check-trace.json");
if (TRACE) {
  await browser.startTracing(page, { path: tracePath, categories: [
    "devtools.timeline", "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.user_timing",
  ] });
}

// 드래그 부하(--drag) — 표본을 모으는 동안 마우스로 지도를 계속 왕복 드래그한다.
const DRAG = has("--drag");
const dragDrive = async () => {
  /* 끄는 자리는 **지도 위**여야 한다 — 못 박은 (195,560)은 폰 배치의 자리라 `--wide`(PC 폭)에서는
     로스터 판을 집어 손짓이 아예 안 났다(진단 "손짓[대기]"). 지도 요소를 찾아 그 가운데를 쓴다. */
  const pt9 = await page.evaluate(() => {
    const m = document.querySelector(".scr-motion-map");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
  });
  const cx = pt9 ? pt9[0] : 195; const cy = pt9 ? pt9[1] : 560;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // 손짓 한가운데의 화면 — 캔버스·렌즈 정렬 검증용. 입력 루프와 무관한 타이머로 찍는다.
  const midPath = flag("--shotmid", null);
  const midShot = midPath
    ? new Promise((res) => setTimeout(() => page.screenshot({ path: midPath }).then(res, res), 2200))
    : null;
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < SECS * 1000) {
    const ph = (i += 1) * 0.22;
    await page.mouse.move(cx + Math.sin(ph) * 110, cy + Math.cos(ph * 0.7) * 130, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  if (midShot) await midShot;
  if (flag("--shotend", null)) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: flag("--shotend", null) });
  }
};
/* --3d — 입체 보기로 바꾼 뒤 잰다(조종부의 2D/3D 단추를 누른다). 폰 폭에서는 재생기가 3D 를 막으므로
   `--wide` 와 함께 쓴다. 손짓 중 실시간 원근(live3d)을 보려면 `--3d --drag --diag` 로 돌리고 아래 [손짓] 줄을 본다. */
if (has("--3d")) {
  const ok3d = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")]
      .find((e) => /입체|평면/.test(e.getAttribute("aria-label") || ""));
    if (!b) return "단추 없음";
    if (b.getAttribute("aria-pressed") === "true") return "이미 3D";
    b.click();
    return "눌렀다";
  });
  await page.waitForTimeout(1200);
  const now3d = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")]
      .find((e) => /입체|평면/.test(e.getAttribute("aria-label") || ""));
    return b?.getAttribute("aria-pressed") === "true" ? "3D" : "2D";
  });
  console.log(`입체 보기: ${ok3d} → ${now3d}`);
}
// 프레임 시간 표본 — rAF 간격을 SECS초 모은다.
await page.evaluate((secs) => {
  window.__frames = [];
  const t0 = performance.now();
  const step = (now) => {
    window.__frames.push(now);
    if (now - t0 < secs * 1000) requestAnimationFrame(step);
    else window.__framesDone = true;
  };
  requestAnimationFrame(step);
}, SECS);
if (PROFILE) await cdp.send("Profiler.start");
const driving = DRAG ? dragDrive() : null;
await page.waitForFunction("window.__framesDone === true", null, { timeout: (SECS + 30) * 1000 });
if (driving) await driving;
const prof = PROFILE ? (await cdp.send("Profiler.stop")).profile : null;

if (TRACE) await browser.stopTracing();
const frames = await page.evaluate(() => window.__frames);
const sprite = await page.evaluate(() => window.__spritePerf.line());
/* --top — 판 예산을 **무엇이** 먹는지 종류별로 본다(합계만으로는 고칠 자리가 안 갈린다). */
const topLines = has("--top")
  ? await page.evaluate(() => `건물\n${window.__spriteTop("b")}\n유닛\n${window.__spriteTop("u")}`)
  : null;
/* 리액트 한 장(SCR_DIAG.react) — 렌더+커밋의 최근 1초. 핵·스톰이 뜨면 박자가 25~60Hz로
   오르므로(nukeStep9), 한 장이 그 박자보다 길면 그때부터 주 실마리가 막힌다. */
// GL 붓 상태(SCR_DIAG.gl — #diag 로 켠다) — 개체·드로·메시·번짐·바닥 도형·효과 삼각형.
try { console.log(`[GL] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.gl) || "(진단 없음)")}`); } catch { console.log("[GL] (못 읽음)"); }
try { console.log(`[리액트] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.react) || "(진단 없음)")}`); } catch { console.log("[리액트] (못 읽음)"); }
// 안개 붓(SCR_DIAG.fog) — 최근 1초의 붓/칠/장당 ms. '한 장이 얼마인가'가 손짓 중 되칠기의 자다.
try { console.log(`[안개] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.fog) || "(진단 없음)")}`); } catch { console.log("[안개] (못 읽음)"); }
// 프레임 워커 상태(SCR_DIAG.worker) — on/off · 받은 수 · 쓴 수 · 놓친 수.
try { console.log(`[워커] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.worker) || "(진단 없음)")}`); console.log(`[덜어내기] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.crowd) || "(폰 아님·진단 없음)")}`); console.log(`[굽기일꾼] ${await page.evaluate(() => (window.__scrDiag && window.__scrDiag.bakew) || "(진단 없음)")}`); } catch (e) { console.log("[워커] (못 읽음)", String(e).slice(0, 80)); }
/* 손짓(SCR_DIAG.gest) — 한 장 ms·배킹 몫·실시간 원근 판정(live/접힘/off)·밀림 기준. --3d --drag --diag 로 재는 자다. */
try { const g9 = await page.evaluate(() => (window.__scrDiag && window.__scrDiag.gest) || ""); if (g9) console.log(`[손짓] ${g9}`); } catch { /* 진단 없음 */ }
if (has("--msgsize")) {
  const r = await page.evaluate(() => {
    const st = window.__msgStat; if (!st) return "없음";
    const mb = (n) => `${(n / 1048576).toFixed(2)}MB`;
    const up = Object.entries(st.up).map(([k, e]) => `${k} ${e.n}회 json ${mb(e.json)} typed ${mb(e.typed)}`).join(" · ");
    const n = Math.max(1, st.frames);
    return `올림: ${up}\n  프레임 ${st.frames}장 · 장당 json ${(st.fJson / n / 1024).toFixed(1)}KB + typed ${(st.fTyped / n / 1024).toFixed(1)}KB (최대 ${(st.fMax / 1024).toFixed(0)}KB) · 장당 unitOps ${(st.fOps / n).toFixed(0)} · 안개 실린 장 ${st.fFog || 0} · 합 ${mb(st.fJson + st.fTyped)}`;
  });
  console.log("[메시지]", r);
  console.log("[워커 메모리]", await page.evaluate(() => {
    const b = (window.__msgStat || {}).ready; if (!b) return "없음";
    const mb = (n) => `${(n / 1048576).toFixed(1)}MB`;
    return `참값 ${mb(b.truth)} · 파생 ${mb(b.world)} · 상위: ${(b.top || []).map(([k, v]) => `${k} ${mb(v)}`).join(" · ")}`;
  }));
  console.log("[안개]", await page.evaluate(() => ((window.__msgStat || {}).fogs || []).join(" · ")));
  console.log("[시계]", await page.evaluate(() => {
    const st = window.__msgStat; if (!st || !st.cmds) return "없음";
    const cmds = st.cmds.slice(-6).map(([w, t0, p, sp]) => `${(w / 1000).toFixed(1)}s→t0 ${t0.toFixed(2)}${p ? "" : "(정지)"}×${sp}`).join(" · ");
    const fr = (st.fr || []).slice(-5).map(([w, t, cur]) => `${(w / 1000).toFixed(1)}s t ${t.toFixed(2)} cur ${cur === undefined ? "?" : cur.toFixed(2)}`).join(" · ");
    const d = window.__scrDiag;
    return `명령 ${st.cmds.length}회: ${cmds}\n  프레임(끝 5): ${fr}\n  지금 ${(performance.now() / 1000).toFixed(1)}s · 워커줄 ${d ? d.worker : "-"}`;
  }));
}
await browser.close();

/* ── 결과 ───────────────────────────────────────────────────────────────────── */
const dts = [];
for (let i = 1; i < frames.length; i += 1) dts.push(frames[i] - frames[i - 1]);
/* 튐 시간표(--framelog) — 50ms 넘는 간격을 시각순으로 찍는다. 주기(예: 1초마다)가 있는지 눈으로 보는 자. */
if (has("--framelog")) {
  const th = Number(flag("--framelog", 50)) || 50;
  const rows = [];
  for (let i = 1; i < frames.length; i += 1) { const d = frames[i] - frames[i - 1]; if (d > th) rows.push(`${((frames[i] - frames[0]) / 1000).toFixed(2)}s ${d.toFixed(0)}ms`); }
  console.log(`[튐 시간표 >${th}ms] ${rows.length}개\n  ${rows.join(" · ")}`);
}
dts.sort((a, b) => a - b);
const pct = (q) => dts[Math.min(dts.length - 1, Math.floor(dts.length * q))] ?? 0;
console.log(`\n[프레임] ${dts.length}개 표본 · CPU ${CPU}배 조임 · ${WIDE ? "PC 1280" : "폰 390"}px`);

console.log(`  p50 ${pct(0.5).toFixed(1)}ms · p75 ${pct(0.75).toFixed(1)}ms · p95 ${pct(0.95).toFixed(1)}ms · 최악 ${dts[dts.length - 1].toFixed(1)}ms`);
console.log(`  33ms 초과(=밀린 프레임) ${(dts.filter((d) => d > 33).length / dts.length * 100).toFixed(1)}%`);
console.log(`\n[스프라이트] ${sprite}`);
if (topLines) console.log(`\n[판 무게]\n${topLines}`);
if (topLines) console.log(`\n[판 무게]\n${topLines}`);

if (TRACE) {
  /* 트레이스 — 이벤트 이름별 소요 합. 메인 스레드의 스크립트·스타일·레이아웃·페인트와
     래스터 스레드의 RasterTask, GPU 쪽 ImageDecode까지 한 줄씩 나온다. JS 프로파일의
     (idle)이 크면 답은 대개 여기 있다. */
  const tr = JSON.parse(readFileSync(tracePath, "utf8"));
  const evs = tr.traceEvents ?? tr;
  const dur = new Map();
  const threads = new Map();
  for (const e of evs) {
    if (e.ph === "M" && e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, e.args.name);
  }
  for (const e of evs) {
    if (e.ph !== "X" || !e.dur) continue;
    const nm = e.name;
    if (nm === "MessageLoop::RunTask" || nm === "ThreadControllerImpl::RunTask") continue;
    dur.set(nm, (dur.get(nm) ?? 0) + e.dur);
  }
  const rows = [...dur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  console.log("\n[트레이스 이벤트 소요 합] (중첩 포함 — 비율로만 읽기)");
  for (const [nm, us] of rows) console.log(`  ${(us / 1000).toFixed(1).padStart(8)}ms  ${nm}`);
}
if (prof) {
  // 표본 → 노드 자기 시간(µs). 이름 없는 익명은 URL 줄번호로 대신한다.
  const nodeOf = new Map(prof.nodes.map((n) => [n.id, n]));
  const self = new Map();
  for (let i = 0; i < prof.samples.length; i += 1) {
    const id = prof.samples[i];
    const dt = prof.timeDeltas[i] ?? 0;
    self.set(id, (self.get(id) ?? 0) + dt);
  }
  const byName = new Map();
  for (const [id, us] of self) {
    const n = nodeOf.get(id);
    if (!n) continue;
    const f = n.callFrame;
    const nm = f.functionName || `(익명 ${f.url.split("/").pop()}:${f.lineNumber})`;
    byName.set(nm, (byName.get(nm) ?? 0) + us);
  }
  const total = [...byName.values()].reduce((a, b) => a + b, 0);
  const rows = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
  console.log(`\n[CPU 자기 시간 상위] 표본 합 ${(total / 1000).toFixed(0)}ms`);
  for (const [nm, us] of rows) console.log(`  ${(us / 1000).toFixed(1).padStart(7)}ms  ${(us / total * 100).toFixed(1).padStart(5)}%  ${nm}`);
}
