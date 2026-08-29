/* 서버가 구워 준 참값 트랙을 푼다 ─────────────────────────────────────────────
 *
 * 여태 트랙은 리플레이 커맨드에서 **추론**해 화면에서 만들었다(src/legacy). 이제 서버가
 * OpenBW로 그 경기를 실제로 돌려 참값을 구워 두므로, 폰은 받아서 풀기만 하면 된다.
 * 유추도 없고 워커도 안 돌린다.
 *
 * [꼴 — tools/openbw/bwdump.cpp 의 쓰개와 짝이다]
 *
 *   전체 = zlib( 아래 바이트열 )              ← 작은 끝(little-endian)
 *
 *   머리   char[4] "OBWT" · u8 판(=5) · f32 초당프레임 · i32 믿을프레임(-1이면 끝까지)
 *   로스터 u8 사람수, 사람마다 u8 임자 · u8 리플레이id · u8 종족 · u8 편 · u8 controller
 *          · u32 개인색(0x00rrggbb, CCLR에서 읽은 값) · u8 이름길이 · 이름(UTF-8)
 *   트랙표 u32 트랙수, 트랙마다 u32 태그 · u8 임자 · u16 유닛종류
 *          · u32 키수 · u32 체력키수 · u32 인터셉터키수 · u32 표적키수(판 6부터)
 *   키 흐름 (트랙 차례대로, 트랙마다 앞 키와의 **차이**를 적는다)
 *     키마다: varint(zigzag(프레임차)) · varint(zigzag(x차)) · varint(zigzag(y차))
 *             · u8 방향(0~255) · u8 상태 · varint(zigzag(종류차))
 *       상태 바이트 — 낮은 네 자리(0x0f)가 '무엇을 하는 중인가'이고 그 위는 깃발이다:
 *       0x20 = 은신 중(판 5부터) · 0x40 = 떠 있다(판 3부터) · 0x80 = 아직 안 지어졌다.
 *   체력 흐름 → 인터셉터 흐름 (트랙 차례대로, 키가 있는 트랙만)
 *     키마다: varint(프레임차) · varint(값차)
 *   업그레이드 u32 개수, 개마다 varint(프레임차) · u16 id · u8 단계 · u8 사람
 *   마법       u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 기술 · u8 사람
 *   핑         u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 사람
 *   자원       u32 개수, 개마다 u8 사람 · varint(그 사람의 앞 값과의 프레임차)
 *              · varint(미네랄차) · varint(가스차)
 *   명령       u32 개수, 개마다 varint(프레임차) · u32 태그 · u16 x · u16 y · u8 갈래
 *   APM        u32 개수 · u16 통크기(프레임), 개마다 varint(통차) · u8 사람 · varint(명령수)
 *   자원밭단   u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 단   ← 판 4부터
 *              단 4=750↑ · 3=500~749 · 2=250~499 · 1=1~249 · 0=바닥남(원작 경계 그대로)
 *
 * 왜 이렇게까지 접나 — 글자(TSV)로 내면 26분짜리 8인전이 39MB다. 폰으로 보내는 짐이라
 * 이 꼴로 접어 0.8~3.8MB로 만든다.
 */
import { BW_UNIT_NAME } from "./bwUnitNames";
import { bwUpgradeName, BW_TECH_NAME } from "./bwUpgradeNames";

/** 앱이 쓰는 트랙 — src/legacy/simCore.ts 의 SimTrack과 같은 꼴이다.
 *  옛 길이 사라져도 이 꼴은 남으므로 여기에 다시 적어 둔다. */
export type TruthTrack = {
  tag: number;
  owner: number;
  kind: string;
  /** 초 */
  born: number;
  /** 초. 끝까지 살아 있었으면 null */
  died: number | null;
  /** 다섯씩 [t(초), x(타일), y(타일), 방향(도), 상태] */
  keys: Float32Array;
  /** 키마다 '다 지어졌나' — 0이면 짓는 중이다. 시작부터 서 있던 건물과 지금 짓는 건물을
   *  가리는 표다. 키 수와 길이가 같다. */
  done: Uint8Array;
  /** 키마다 '떠 있나'(1이면 공중) — **판 3부터만 있다**. 판 2로 구운 옛 자취에는 이 칸이
   *  통째로 없으므로(undefined) 읽는 쪽은 없을 때의 길을 따로 가져야 한다
   *  (truthLives의 착륙 판정 참고). 뜬 건물과 나는 유닛이 함께 켜진다 — 건물인지는
   *  종류가 말한다. */
  air?: Uint8Array;
  /** 키마다 '은신 중인가'(1/0) — 판 5부터. 없으면 그 덤프는 은신을 모른다. */
  cloak?: Uint8Array;
  /** 키마다의 유닛 종류 번호 — 한 생애 안에서 바뀐다(라바→알→저글링, 탱크↔시즈모드).
   *  `kind`는 그중 **마지막**이다. 키 수와 길이가 같다. */
  types: Uint16Array;
  /** 체력 변곡점 [초, 남은 체력] — 실드를 더한 **실제 수치**다(퍼센트가 아니다).
   *  잔물결(저그 재생·프로토스 실드 충전)은 솎여 있다. */
  hp?: [number, number][];
  /** 캐리어 인터셉터 수 변곡점 [초, 개수]. 캐리어가 아니면 없다. */
  ic?: [number, number][];
  /** ★ **지금 겨눈 개체** 변곡점 [초, 표적 태그] — 0은 '겨눈 것 없음'이다(판 6부터).
   *
   *  원작이 매 프레임 들고 있는 값(order_target.unit)을 그대로 옮긴 것이라 어림이 한 톨도
   *  안 든다. 바뀔 때만 한 줄이라 자리 키보다 훨씬 성기다.
   *  ★ **없는 것과 0은 다르다** — 이 칸이 아예 없으면 그 덤프는 표적을 모르는 옛 판이고
   *    (그때는 아무 공격도 안 그린다), 있는데 0이면 '지금 아무것도 안 겨눈다'는 참값이다. */
  tgt?: [number, number][];
};

/** 리플레이 머리말이 아는 사람. */
export type TruthPlayer = {
  /** 시뮬 안의 임자 번호(0~11) — 트랙의 owner와 같은 것이다. */
  owner: number;
  /** 리플레이가 적어 둔 사람 번호 — 옛 분석(screp)의 PlayerID와 같은 자리다. */
  pid: number;
  /** 0 저그 1 테란 2 프로토스 */
  race: number;
  /** 편(force) 번호 */
  force: number;
  controller: number;
  /** 게임 안 개인색 #rrggbb */
  color: string;
  name: string;
};

export type TruthTracks = {
  /** 이 뭉치를 **어느 판의 덤퍼가 구웠나**(OBWT 머리의 판 번호).
   *
   *  ★ 왜 밖으로 내나(물음: "덤퍼 오류 수정 후 재분석했는데 갈림 시각이 계속 뜨는 건
   *    진짜 갈려서인가, 갈림 정보 갱신이 안 된 건가") ─────────────────────────────────
   *    그 물음은 눈으로 못 가린다. 갈림 시각(trustFrame)은 1분 칸으로 끊겨 있어서(덤퍼의
   *    b × 1429) **몇십 초 밀린 것은 화면에서 한 톨도 안 보인다** — '똑같다'가 '안 구웠다'의
   *    증거가 못 된다. 그런데 판 번호는 덤퍼가 바뀔 때마다 오르므로, 뭉치가 오늘치
   *    덤퍼로 구워졌는지를 한눈에 가른다. 진단 오버레이(#diag)가 이 값을 적는다. */
  version: number;
  tracks: TruthTrack[];
  /** 시뮬이 실제 게임과 같다고 볼 수 있는 마지막 시각(초). null이면 끝까지 믿어도 된다. */
  trustUntil: number | null;
  players: TruthPlayer[];
  /** 연구가 **끝난** 시각 [초, 이름, 임자]. 누른 때가 아니라 실제로 올라간 때다. */
  ups: [number, string, number][];
  /** 마법 [초, x(타일), y(타일), 기술 이름, 임자] — 기운을 실제로 쓴 순간이다. */
  casts: [number, number, number, string, number][];
  /** 미니맵 핑 [초, x(타일), y(타일), 임자] */
  pings: [number, number, number, number][];
  /** 자원 현황 — 임자마다 [초, 미네랄, 가스] 변곡점. 안 바뀌는 동안은 안 적혀 있다. */
  res: Map<number, [number, number, number][]>;
  /** 실시간 APM의 재료 — 임자마다 [통 시작 초, 그 통의 명령 수]. 통은 약 5초다.
   *  경기 전체 평균 하나로는 "지금 얼마나 바쁜가"를 못 그린다. */
  apm: Map<number, [number, number][]>;
  /** APM 통 하나의 길이(초). */
  apmBucketSec: number;
  /** 태그마다 그 유닛에게 떨어진 명령 [초, x(타일), y(타일), 갈래(0 이동·7 공격)].
   *  게임 상태에는 안 남는 것이라(누른 사람만 아는 일) 명령 스트림에서만 온다 —
   *  마우스 자국과 선택 링이 이걸로 선다. */
  orders: Map<number, [number, number, number, number][]>;
  /** 자원 밭·간헐천의 남은 단 [초, x(타일), y(타일), 단] — **판 4부터**. 옛 판은 빈 배열이다.
   *  단은 원작 경계 그대로다(set_unit_resources): 4=750↑ · 3=500~749 · 2=250~499 ·
   *  1=1~249 · 0=바닥남. 단이 바뀔 때만 적혀 있어 한 밭에 많아야 네댓 줄이다. */
  resFields: [number, number, number, number][];
};

/* 개인색은 덤퍼가 리마스터의 **CCLR 구획**에서 읽어 온다(bwdump.cpp) — 사람마다 고른
   색이 float 넷으로 거기 들어 있다. 헤더의 색 칸은 색표 번호가 아니라 딴 것이었다:
   판마다 같은 번호가 다른 색으로 나와, screp과 대조해 보고서야 알았다. */

/** 상태 번호 — 옛 시뮬(ST_*)과 같은 값이다. */
export const TRUTH_ST_IDLE = 0;
export const TRUTH_ST_MOVE = 1;
export const TRUTH_ST_INSIDE = 2;
export const TRUTH_ST_GONE = 3;
export const TRUTH_ST_FIGHT = 4;
export const TRUTH_ST_GATHER = 5;
export const TRUTH_ST_BURROW = 6;
export const TRUTH_ST_CARRY_MIN = 7;
export const TRUTH_ST_CARRY_GAS = 8;

/* 자취 읽개 ─────────────────────────────────────────────────────────────────────
   키는 **솎여 있다** — 덤퍼가 자리 편차·각 편차가 문턱을 넘을 때만 적으므로(bwdump.cpp의
   DEV9·HEAD9), 곧게 걷거나 서 있는 동안은 몇 초씩 벌어진다. 그 사이 시각은 앞뒤 키를
   이어서 메운다 — 안 그러면 유닛이 툭툭 튄다. 자리는 선형으로 나눠 갖고, 방향은 최단
   각으로 **제 회전율만큼만** 돌린다(아래 TURN_DPS — 키 간격이 회전 시간이 되면 안 된다).
   상태는 안 섞는다(걷는 중과 싸우는 중 사이에 '반쯤'은 없다).
   옛 시뮬(legacy/simCore.posAtSim)에 있던 것을 그대로 옮겼다 — 자취 꼴이 같으니 셈도 같고,
   이걸 옮겨야 시뮬 엔진이 앱 묶음에서 통째로 빠진다. */
const norm360 = (d: number): number => ((d % 360) + 360) % 360;
/** 몸이 도는 빠르기(도/초) — 원작 회전율(units.dat의 turn radius)의 한복판 값이다.
 *  원작은 종류마다 다르다: 프레임당 방향 단위로 마린 40(초당 1339도)부터 오버로드
 *  9(초당 301도)까지. 자취에는 그 값이 안 실려 있어 하나로 잡는데, 720도/초면
 *  반 바퀴가 0.25초라 어느 종류에서도 '돌고 나서 간다'로 읽힌다. 화면이 각을
 *  22.5도 열여섯 칸으로 갈무리하므로 이보다 고운 차이는 어차피 안 보인다. */
const TURN_DPS = 720;
const angDiff = (a: number, b: number): number => {
  let d = norm360(b - a);
  if (d > 180) d -= 360;
  return d;
};

/** t초일 때 이 개체의 자리·방향·상태. 아직 안 태어났으면 null. */
export function posAtTruth(
  tr: TruthTrack, t: number,
): { x: number; y: number; hdg: number; state: number } | null {
  const n = tr.keys.length / 5;
  if (n === 0) return null;
  if (t < tr.keys[0]) return null;
  // 마지막으로 t를 안 넘는 키 — 키가 수천 개라 이분법으로 찾는다.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tr.keys[mid * 5] <= t) lo = mid; else hi = mid - 1;
  }
  const i = lo * 5;
  const st = tr.keys[i + 4];
  if (lo === n - 1) return { x: tr.keys[i + 1], y: tr.keys[i + 2], hdg: tr.keys[i + 3], state: st };
  const j = i + 5;
  const span = tr.keys[j] - tr.keys[i];
  const u = span > 0 ? Math.min(1, Math.max(0, (t - tr.keys[i]) / span)) : 0;
  /* ★ 방향은 **키 사이를 나눠 갖지 않는다**(지적: "유닛들 방향전환이 너무 느리고
     이상해짐") ──────────────────────────────────────────────────────────────────
     자리는 키 사이를 선형으로 메우는 것이 옳다 — 등속으로 걸으니까. 그런데 각을
     같은 자로 메우면 **회전이 키 간격만큼 길어진다**. 덤퍼는 키를 솎아 내므로(자리
     편차·각 편차가 문턱을 넘을 때만 적는다) 곧게 걷거나 서 있는 동안은 키가 몇 초씩
     벌어지는데, 그 사이에 각이 90도 갈리면 유닛이 **몇 초에 걸쳐 스르르 돈다**.
     원작에서 회전은 그런 것이 아니다: 유닛은 제 회전율(unit_turn_rate)로 **곧장**
     돌고 나서 그 각을 유지한다. 마린이 180도 도는 데 서너 프레임(0.15초)이다.
     그래서 여기서는 앞 키의 각에서 **초당 TURN_DPS도**로 따라가다 목표에 닿으면
     멈춘다. 키가 촘촘한 구간(선회 비행처럼 자리가 계속 휘는 곳)에서는 상한이 아예
     안 걸려 예전과 같은 매끄러운 호가 그대로 남는다 — 상한이 무는 것은 키가 멀리
     떨어진, 곧 '돌고 나서 한참 그대로'인 구간뿐이다.
     키에 늦지 않게 필요한 속도(need)와 견줘 더 빠른 쪽을 쓰므로, 다음 키에 닿는
     순간의 각은 언제나 그 키의 각 그대로다(경계에서 안 튄다). */
  const dh = angDiff(tr.keys[i + 3], tr.keys[j + 3]);
  const dt = t - tr.keys[i];
  const need = span > 0 ? Math.abs(dh) / span : 0;
  const turned = Math.min(Math.abs(dh), Math.max(TURN_DPS, need) * dt);
  return {
    x: tr.keys[i + 1] + (tr.keys[j + 1] - tr.keys[i + 1]) * u,
    y: tr.keys[i + 2] + (tr.keys[j + 2] - tr.keys[i + 2]) * u,
    hdg: norm360(tr.keys[i + 3] + Math.sign(dh) * turned),
    state: st,
  };
}

/** base64 → 바이트. atob는 라틴1 문자열을 주므로 코드포인트를 그대로 옮긴다. */
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** zlib 풀기 — 브라우저가 해 준다(DecompressionStream). 없는 환경이면 던진다. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error("이 브라우저는 DecompressionStream이 없다");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 바이트열을 앞에서부터 훑는 작은 커서 — 꼴이 한 줄로 이어져 있어 되감을 일이 없다. */
class Cursor {
  private p = 0;
  private readonly b: Uint8Array;
  /* 매개변수 속성(constructor(private b))은 안 쓴다 — 이 리포는 erasableSyntaxOnly라
     타입만 지워서는 자바스크립트가 안 되는 문법을 금한다. */
  constructor(b: Uint8Array) { this.b = b; }
  u8(): number { return this.b[this.p++]; }
  u16(): number { const v = this.b[this.p] | (this.b[this.p + 1] << 8); this.p += 2; return v; }
  u32(): number {
    const v = (this.b[this.p] | (this.b[this.p + 1] << 8) | (this.b[this.p + 2] << 16)
      | (this.b[this.p + 3] << 24)) >>> 0;
    this.p += 4;
    return v;
  }
  i32(): number { return this.u32() | 0; }
  f32(): number {
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.p, 4).getFloat32(0, true);
    this.p += 4;
    return v;
  }
  /** UTF-8 글 n바이트. 사람 이름이 여기로 온다(한글은 덤퍼가 CP949에서 옮겨 놓는다). */
  utf8(n: number): string {
    const s = new TextDecoder().decode(this.b.subarray(this.p, this.p + n));
    this.p += n;
    return s;
  }

  /** 7비트씩 담긴 수 + zigzag 되돌리기 — 음수도 작은 바이트로 들어온다. */
  varint(): number {
    let z = 0;
    let shift = 0;
    for (;;) {
      const c = this.b[this.p++];
      z |= (c & 0x7f) << shift;
      if (!(c & 0x80)) break;
      shift += 7;
    }
    z >>>= 0;
    return (z >>> 1) ^ -(z & 1);
  }
  get left(): number { return this.b.length - this.p; }
}

/**
 * 서버가 준 문자열(base64)을 트랙으로 푼다.
 *
 * 던지지 않는다 — 꼴이 낯설거나 못 풀면 null을 준다. 부르는 쪽은 그때 옛 길로 돌아가면 된다.
 */
export async function decodeTruthTracks(b64: string): Promise<TruthTracks | null> {
  try {
    const raw = await inflate(fromBase64(b64));
    const c = new Cursor(raw);
    if (c.u8() !== 0x4f || c.u8() !== 0x42 || c.u8() !== 0x57 || c.u8() !== 0x54) return null; // "OBWT"
    const version = c.u8();
    /* 판 2도 계속 읽는다(요청: 테란 건물 리프팅 — 판 3에서 '떠 있다' 비트가 생겼다) —
       서버가 새 덤퍼로 바뀌어도 **이미 구워 둔 자취는 판 2인 채로 남는다**. 여기서
       판 3만 받으면 재분석이 다 돌 때까지 모든 옛 경기가 "재생할 수 없는 게임"이 된다.
       달라진 것은 상태 바이트의 깃발 한 칸뿐이라, 판 2는 그 칸이 늘 0인 판 3과 같다. */
    if (version < 2 || version > 6) return null;
    const hasAir = version >= 3;
    /* 은신은 판 5부터다(요청: "참값에 은신 칸 추가하는 쪽으로 가자") — 옛 덤프는 그 깃발이
       늘 0이라 '은신 아님'으로 읽히는데, 그건 **모르는 것**이지 아님이 아니다. 판으로 갈라
       옛 판에서는 칸 자체를 안 만든다(없으면 화면이 이름으로 아는 상시 은신만 쓴다). */
    const hasCloak = version >= 5;
    /* 자원 밭의 남은 단은 판 4부터다(요청: 고갈 표현) — 맨 뒤 절이라, 옛 판은 그 앞에서
       끝난다. 없으면 빈 배열이고 화면은 '늘 가득'으로 그린다(옛 자취의 예전 모습). */
    const hasResFields = version >= 4;
    /* ★ **지금 겨눈 개체**는 판 6부터다(지시: "지금 갖고 있는 표적을 정확히 명시할 필요가
       있어 보임") — 원작이 매 프레임 들고 있는 값(order_target)을 덤퍼가 이제 실어 준다.
       없던 동안 화면은 '가장 가까운 적'을 골라 썼고, 그 어림이 조준각·트레이서·스플래시를
       서로 다른 대상에 붙였다. 옛 판은 이 칸 자체를 안 만든다 — 없는 것과 '표적 없음'은
       다른 말이라, 화면이 그 둘을 갈라 볼 수 있어야 한다. */
    const hasTarget = version >= 6;
    const fps = c.f32();
    const trustFrame = c.i32();
    if (!Number.isFinite(fps) || fps <= 0) return null;

    const players: TruthPlayer[] = [];
    const pn = c.u8();
    for (let i = 0; i < pn; i += 1) {
      const owner = c.u8();
      const pid = c.u8();
      const race = c.u8();
      const force = c.u8();
      const controller = c.u8();
      const rgb = c.u32();
      const name = c.utf8(c.u8());
      /* 덤퍼가 CCLR에서 읽어 온 진짜 개인색이다. 그 구획이 없는 옛 리플레이(1.16 이하)는
         **0xffffffff**(색 아님)로 온다 — 빈 글자로 두면 부르는 쪽이 팀색으로 떨어진다.
         ★ 옛 덤퍼는 그 자리에 흰색(0xffffff)을 적었다. 그 판들은 여기서 못 가른다(흰색은
           고를 수 있는 색이라서다) — 대신 재생기가 '로스터 색이 한 가지뿐이면 색이 아니다'
           로 걸러 낸다(ReplayMotionPlayer의 personalUsable). */
      const color = rgb === 0xffffffff
        ? "" : `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
      players.push({ owner, pid, race, force, controller, color, name });
    }

    const n = c.u32();
    if (n > 100000) return null;
    const head: { tag: number; owner: number; type: number;
      count: number; hp: number; ic: number; tgt: number }[] = new Array(n);
    for (let i = 0; i < n; i += 1) {
      head[i] = { tag: c.u32(), owner: c.u8(), type: c.u16(),
        count: c.u32(), hp: c.u32(), ic: c.u32(), tgt: hasTarget ? c.u32() : 0 };
    }

    const tracks: TruthTrack[] = [];
    for (let i = 0; i < n; i += 1) {
      const h = head[i];
      const keys = new Float32Array(h.count * 5);
      const types = new Uint16Array(h.count);
      const done = new Uint8Array(h.count);
      const air = hasAir ? new Uint8Array(h.count) : undefined;
      const cloak = hasCloak ? new Uint8Array(h.count) : undefined;
      let pf = 0;
      let px = 0;
      let py = 0;
      let pt = 0;
      let born = 0;
      let died: number | null = null;
      for (let k = 0; k < h.count; k += 1) {
        pf += c.varint();
        px += c.varint();
        py += c.varint();
        const headingByte = c.u8();
        const stateByte = c.u8();
        /* 상태는 낮은 네 자리뿐이다 — 나머지는 깃발이다(위 꼴 주석). 0x7f로 걷으면
           '떠 있다'(0x40)가 상태 값에 섞여 나는 유닛의 이동이 0x41이 된다. 판 2에서는
           값이 0~8뿐이라 이 마스크가 예전과 똑같은 답을 낸다. */
        const state = stateByte & 0x0f;
        done[k] = stateByte & 0x80 ? 0 : 1;
        if (air) air[k] = stateByte & 0x40 ? 1 : 0;
        // 0x20 = 은신 중(판 5부터) — 남아 있던 깃발 자리를 쓴다(0x10은 아직 빈다).
        if (cloak) cloak[k] = stateByte & 0x20 ? 1 : 0;
        pt += c.varint();
        types[k] = pt;
        const t = pf / fps;
        if (k === 0) born = t;
        if (state === TRUTH_ST_GONE) died = t;
        const o = k * 5;
        keys[o] = t;
        keys[o + 1] = px / 32;              // 픽셀 → 타일
        keys[o + 2] = py / 32;
        keys[o + 3] = (headingByte * 360) / 256;
        keys[o + 4] = state;
      }
      tracks.push({
        tag: h.tag,
        owner: h.owner,
        kind: BW_UNIT_NAME[h.type] ?? `?${h.type}`,
        born,
        died,
        keys,
        types,
        done,
        ...(air ? { air } : {}),
        ...(cloak ? { cloak } : {}),
      });
    }

    /* 체력·인터셉터는 자리 키와 따로 온다(섞으면 한쪽이 바뀔 때마다 다른 쪽 키까지
       끌려 나온다). 트랙 차례가 같으므로 같은 차례로 읽어 붙인다. */
    const readTicks = (want: (h: typeof head[number]) => number,
      put: (tr: TruthTrack, v: [number, number][]) => void): void => {
      for (let i = 0; i < n; i += 1) {
        const cnt = want(head[i]);
        if (!cnt) continue;
        const out: [number, number][] = new Array(cnt);
        let pf = 0;
        let pv = 0;
        for (let k = 0; k < cnt; k += 1) {
          pf += c.varint();
          pv += c.varint();
          out[k] = [pf / fps, pv];
        }
        put(tracks[i], out);
      }
    };
    readTicks((h) => h.hp, (tr, v) => { tr.hp = v; });
    readTicks((h) => h.ic, (tr, v) => { tr.ic = v; });
    /* 표적 흐름(판 6) — 값이 **태그**라 차이로 안 적혀 있다(순서 없는 이름표라 이웃끼리
       가깝지 않다). 그래서 readTicks를 못 쓰고 제 고리를 돈다. */
    if (hasTarget) {
      for (let i = 0; i < n; i += 1) {
        const cnt = head[i].tgt;
        if (!cnt) continue;
        const out: [number, number][] = new Array(cnt);
        let pf = 0;
        for (let k = 0; k < cnt; k += 1) {
          pf += c.varint();
          out[k] = [pf / fps, c.u32()];
        }
        tracks[i].tgt = out;
      }
    }

    const ups: [number, string, number][] = [];
    { let pf = 0;
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        pf += c.varint();
        const id = c.u16();
        const level = c.u8();
        const who = c.u8();
        const nm = bwUpgradeName(id);
        // 2단계·3단계는 이름 뒤에 단계를 붙인다 — 옛 표기와 같은 자리다.
        if (nm) ups.push([pf / fps, level > 1 ? `${nm} ${level}` : nm, who]);
      } }

    const casts: [number, number, number, string, number][] = [];
    { let pf = 0;
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        pf += c.varint();
        const x = c.u16();
        const y = c.u16();
        const tech = c.u8();
        const who = c.u8();
        casts.push([pf / fps, x / 32, y / 32, BW_TECH_NAME[tech] ?? `?${tech}`, who]);
      } }

    const pings: [number, number, number, number][] = [];
    { let pf = 0;
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        pf += c.varint();
        const x = c.u16();
        const y = c.u16();
        pings.push([pf / fps, x / 32, y / 32, c.u8()]);
      } }

    const res = new Map<number, [number, number, number][]>();
    { const prev = new Map<number, [number, number, number]>();
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        const who = c.u8();
        const p = prev.get(who) ?? [0, 0, 0];
        const row: [number, number, number] = [p[0] + c.varint(), p[1] + c.varint(), p[2] + c.varint()];
        prev.set(who, row);
        const arr = res.get(who) ?? [];
        arr.push([row[0] / fps, row[1], row[2]]);
        res.set(who, arr);
      } }

    const orders = new Map<number, [number, number, number, number][]>();
    { let pf = 0;
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        pf += c.varint();
        const tag = c.u32();
        const x = c.u16();
        const y = c.u16();
        const kind = c.u8();
        const arr = orders.get(tag) ?? [];
        arr.push([pf / fps, x / 32, y / 32, kind]);
        orders.set(tag, arr);
      } }

    const apm = new Map<number, [number, number][]>();
    let apmBucketSec = 5;
    { const cnt = c.u32();
      const bucketFrames = c.u16();
      apmBucketSec = bucketFrames / fps;
      let pb = 0;
      for (let i = 0; i < cnt; i += 1) {
        pb += c.varint();
        const who = c.u8();
        const n = c.varint();
        const arr = apm.get(who) ?? [];
        arr.push([(pb * bucketFrames) / fps, n]);
        apm.set(who, arr);
      } }

    const resFields: [number, number, number, number][] = [];
    if (hasResFields) {
      let pf = 0;
      const cnt = c.u32();
      for (let i = 0; i < cnt; i += 1) {
        pf += c.varint();
        const x = c.u16();
        const y = c.u16();
        resFields.push([pf / fps, x / 32, y / 32, c.u8()]);
      }
    }

    return { version, tracks, trustUntil: trustFrame < 0 ? null : trustFrame / fps,
      players, ups, casts, pings, res, apm, apmBucketSec, orders, resFields };
  } catch {
    return null;
  }
}
