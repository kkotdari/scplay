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
 *   머리   char[4] "OBWT" · u8 판(=7) · f32 초당프레임 · i32 믿을프레임(-1이면 끝까지)
 *   로스터 u8 사람수, 사람마다 u8 임자 · u8 리플레이id · u8 종족 · u8 편 · u8 controller
 *          · u32 개인색(0x00rrggbb, CCLR에서 읽은 값) · u8 이름길이 · 이름(UTF-8)
 *   트랙표 u32 트랙수, 트랙마다 u32 태그 · u8 임자(태어날 때) · u16 유닛종류
 *          · u32 키수 · u32 체력키수 · u32 인터셉터키수 · u32 표적키수
 *          · u8 임자바뀜수, 바뀜마다 u32 프레임 · u8 새 임자 (판 8 — 마인드 컨트롤·나간 사람의 몸이
 *            중립(11)으로 넘어가는 순간. 오버로드·수송선 안의 몸도 같은 순간에 같은 규칙. 줄이 가변이라
 *            건너뛰지 않고 차례로 읽는다)
 *   키 흐름 (트랙 차례대로, 트랙마다 앞 키와의 **차이**를 적는다)
 *     키마다: varint(zigzag(프레임차)) · varint(zigzag(x차)) · varint(zigzag(y차))
 *             · u8 방향(0~255) · u8 상태 · varint(zigzag(종류차))
 *       상태 바이트 — 낮은 네 자리(0x0f)가 '무엇을 하는 중인가'이고 그 위는 깃발이다:
 *       0x20 = 은신 중(판 5부터) · 0x40 = 떠 있다(판 3부터) · 0x80 = 아직 안 지어졌다.
 *   체력 흐름 → 인터셉터 흐름 (트랙 차례대로, 키가 있는 트랙만)
 *     키마다: varint(프레임차) · varint(값차)
 *   업그레이드 u32 개수, 개마다 varint(프레임차) · u16 id · u8 단계 · u8 사람
 *              · u32 건물태그   ← 판 7부터 (0이면 '모름')
 *     ★ 태그가 왜 붙나(지적: "업그레이드 상황이 같은 종류의 건물 인포팝업에 공통으로
 *       뜨는 현상") — 여태 이 줄에는 **어느 건물에서 연구했는지가 없었다**. 그래서 화면은
 *       임자와 건물 종류만으로 견줄 수밖에 없었고, 포지가 셋이면 셋 다 같은 연구를 띄웠다.
 *       생산(아래 명령·트랙)은 태그가 있어 정확히 가리는데 연구만 못 가렸다.
 *       0은 '덤퍼가 그 건물을 못 짚었다'는 뜻이다 — 그때는 화면이 옛 어림(대표 건물
 *       하나에만 단다)으로 돌아간다.
 *   마법       u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 기술 · u8 사람
 *   핑         u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 사람
 *   자원       u32 개수, 개마다 u8 사람 · varint(그 사람의 앞 값과의 프레임차)
 *              · varint(미네랄차) · varint(가스차)
 *   명령       u32 개수, 개마다 varint(프레임차) · u32 태그 · u16 x · u16 y · u8 갈래
 *   APM        u32 개수 · u16 통크기(프레임), 개마다 varint(통차) · u8 사람 · varint(명령수)
 *   자원밭단   u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u8 단   ← 판 4부터
 *   건설명령   u32 개수, 개마다 varint(프레임차) · u8 임자 · u32 일꾼태그 · u16 타일x · u16 타일y · u16 건물종류 ← 판 9부터
 *   선택       u32 개수, 개마다 varint(프레임차) · u8 임자 · u8 태그수 · u32 태그 × 태그수   ← 판 10부터
 *              그 명령(Select·ShiftSelect·ShiftDeselect)을 치른 **뒤의 선택 전체**(최대 12) — 차이가 아니라 결과다.
 *   에너지     u32 개수, 개마다 varint(프레임차) · u32 태그 · u16 에너지(정수 0~250)   ← 판 11부터
 *              정수 값이 바뀔 때만 한 줄이다(계단 — 화면은 사이를 안 메운다).
 *   탑승       u32 개수, 개마다 varint(프레임차) · u32 승객태그 · u32 배태그(0 = 내림)   ← 판 11부터
 *              수송선·오버로드·벙커 셋 다 — 원작 load_unit / unload_unit 그대로.
 *   자원량     u32 개수, 개마다 varint(프레임차) · u16 x · u16 y · u16 남은 양   ← 판 11부터
 *              자원밭단과 같은 자리(픽셀) — set_unit_resources 가 부를 때마다.
 *   처치       u32 개수, 개마다 varint(프레임차) · u8 킬러임자 · u32 킬러태그(0 = 몸 없음) · u32 죽은태그 ← 판 11부터
 *              원작이 처치를 올려 주는 그 순간(kill_count·점수) — 어림이 아니다.
 *              단 4=750↑ · 3=500~749 · 2=250~499 · 1=1~249 · 0=바닥남(원작 경계 그대로)
 *   데미지     u32 수 · u16 통프레임, 줄마다 varint(통차) · u8 임자 · varint 넷   ← 판 13부터
 *   채집       u32 개수, 개마다 u8 사람 · varint(그 사람 앞 줄과의 프레임차) · varint(캔 미네랄차) · varint(캔 가스차)   ← 판 14부터
 *              원작 누적(total_minerals_gathered · total_gas_gathered) — 바뀔 때만 한 줄(자원 절과 같은 꼴).
 *
 * 왜 이렇게까지 접나 — 글자(TSV)로 내면 26분짜리 8인전이 39MB다. 폰으로 보내는 짐이라
 * 이 꼴로 접어 0.8~3.8MB로 만든다.
 */
import { BW_UNIT_NAME } from "./bwUnitNames";
import { bwUpgradeName, BW_TECH_NAME } from "./bwUpgradeNames";
/** 리플레이 머리말이 아는 사람. */
/* ★ 키·변곡점의 **자리**(요청: 형식 배열로 — 폰 워커 참값 102MB의 절반이 키, 나머지가 쌍 배열이었다) ─────
 *  키는 초(Float32)·픽셀(Int16×2)·방향(Uint8)·상태(Uint8)로 나눠 든다(키당 10B, 옛 float32 다섯 칸 20B).
 *  체력·인터셉터·표적 변곡점(Ticks)은 평평한 형식 배열 [초, 값, 초, 값, …]이다(쌍당 8~16B, 옛 배열 객체 48B).
 *  읽는 쪽은 아래 접근자만 쓴다 — 자리를 다시 바꿔도 여기만 고친다. */
export const kN = (tr) => tr.kt.length;
export const kT = (tr, i) => tr.kt[i];
export const kX = (tr, i) => tr.kxy[i * 2] / 32;
export const kY = (tr, i) => tr.kxy[i * 2 + 1] / 32;
export const kH = (tr, i) => (tr.kh[i] * 360) / 256;
export const kS = (tr, i) => tr.kst[i];
export const EMPTY_TICKS = new Float32Array(0);
export const tkN = (a) => a.length >> 1;
export const tkT = (a, i) => a[i * 2];
export const tkV = (a, i) => a[i * 2 + 1];
/** t 이하 마지막 칸의 번호 — 없으면 -1(이분). */
export function tkAt(a, t) {
    let lo = 0;
    let hi = (a.length >> 1) - 1;
    let at = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (a[mid * 2] <= t) {
            at = mid;
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return at;
}
/** t 이하 마지막 값 — 없으면 0. */
export const tkLast = (a, t) => {
    if (!a)
        return 0;
    const i = tkAt(a, t);
    return i < 0 ? 0 : a[i * 2 + 1];
};
/** [t0, t1] 구간만 — 복사 없는 subarray. */
export function tkSlice(a, t0, t1) {
    const n = a.length >> 1;
    let i0 = 0;
    while (i0 < n && a[i0 * 2] < t0)
        i0 += 1;
    let i1 = i0;
    while (i1 < n && a[i1 * 2] <= t1)
        i1 += 1;
    return a.subarray(i0 * 2, i1 * 2);
}
/** 빈 트랙 — 빈 걷기 창 같은 자리의 자리표. */
export const EMPTY_TRACK = {
    tag: 0, owner: 0, kind: "", born: 0, died: null, own: [],
    kt: new Float32Array(0), kxy: new Int16Array(0), kh: new Uint8Array(0), kst: new Uint8Array(0),
    types: new Uint16Array(0), done: new Uint8Array(0),
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
const norm360 = (d) => ((d % 360) + 360) % 360;
/** 몸이 도는 빠르기(도/초) — 원작 회전율(units.dat의 turn radius)의 한복판 값이다.
 *  원작은 종류마다 다르다: 프레임당 방향 단위로 마린 40(초당 1339도)부터 오버로드
 *  9(초당 301도)까지. 자취에는 그 값이 안 실려 있어 하나로 잡는데, 720도/초면
 *  반 바퀴가 0.25초라 어느 종류에서도 '돌고 나서 간다'로 읽힌다. 화면이 각을
 *  22.5도 열여섯 칸으로 갈무리하므로 이보다 고운 차이는 어차피 안 보인다. */
const TURN_DPS = 720;
const angDiff = (a, b) => {
    let d = norm360(b - a);
    if (d > 180)
        d -= 360;
    return d;
};
/** ★ **순간이동은 메우지 않는다**(2026-10-11, 지적: "드라군 등 이동하는 유닛은 캐스트 끝나면 짠 나타나야 함 — 원위치에서 없어짐과 동시에") — 리콜로 옮겨진 몸은
 *  옛 자리 키(멈춰 선 때 · 몇 초 전일 수 있다)와 새 자리 키 사이를 직선으로 메우면 지도를 가로질러 미끄러졌다. 이웃 두 키가 TELEPORT_TILES 넘게 떨어졌고
 *  ① 앞 키가 걷는 갈래가 아니거나(서 있음 · 수송선 안 · 버로우 — 캐는 일꾼·싸우는 몸은 걷는다) ② 그 사이를 초당 TELEPORT_SPEED 타일 넘게 가야 하면(어떤 유닛도 못 낸다
 *  · 가장 빠른 벌처·저글링이 7타일 남짓) 뛴 것이다 — 뒤 키 때까지 옛 자리에 서 있다가 그 순간 새 자리에 선다. */
export const TELEPORT_TILES = 3;
export const TELEPORT_SPEED = 12;
export const keyJump = (tr, a, b) => {
    const d = Math.hypot(kX(tr, b) - kX(tr, a), kY(tr, b) - kY(tr, a));
    if (d <= TELEPORT_TILES)
        return false;
    const st = kS(tr, a);
    /* 건물(BW 종류 106~ · 떠서 나는 테란 건물)은 '서 있음' 갈래로 안 가른다 — 뜬 채 나는 키가 그 갈래로 올 수 있다. 속도 자만 본다. */
    if ((tr.types[a] ?? 0) < 106 && (st === TRUTH_ST_IDLE || st === TRUTH_ST_INSIDE || st === TRUTH_ST_BURROW))
        return true;
    return d / Math.max(0.001, tr.kt[b] - tr.kt[a]) > TELEPORT_SPEED;
};
/** t초일 때 이 개체의 자리·방향·상태. 아직 안 태어났으면 null. */
export function posAtTruth(tr, t, cur) {
    const n = tr.kt.length;
    if (n === 0)
        return null;
    const kt = tr.kt;
    if (t < kt[0])
        return null;
    let lo = -1;
    if (cur) {
        const h9 = cur.i;
        if (h9 >= 0 && (h9 === n - 1 ? kt[h9] <= t : kt[h9] <= t && kt[h9 + 1] > t))
            lo = h9;
        else if (h9 >= -1 && h9 + 1 < n && kt[h9 + 1] <= t && (h9 + 2 >= n || kt[h9 + 2] > t))
            lo = h9 + 1;
    }
    if (lo < 0) {
        lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (kt[mid] <= t)
                lo = mid;
            else
                hi = mid - 1;
        }
    }
    if (cur)
        cur.i = lo;
    const st = kS(tr, lo);
    /* 죽는 순간의 키(GONE)는 덤퍼가 개체를 걷어 내며 적는 것이라 자리가 마지막으로 산 자리와 다를 때가 있다 —
       그 키 쪽으로 메우지도, 그 위에 서지도 않고 마지막으로 산 키에 못 박는다(지적: 오버로드가 되돌아와 터짐). */
    if (st === TRUTH_ST_GONE && lo > 0) {
        return { x: kX(tr, lo - 1), y: kY(tr, lo - 1), hdg: kH(tr, lo - 1), state: st };
    }
    if (lo === n - 1)
        return { x: kX(tr, lo), y: kY(tr, lo), hdg: kH(tr, lo), state: st };
    const j = lo + 1;
    if (kS(tr, j) === TRUTH_ST_GONE)
        return { x: kX(tr, lo), y: kY(tr, lo), hdg: kH(tr, lo), state: st };
    if (keyJump(tr, lo, j))
        return { x: kX(tr, lo), y: kY(tr, lo), hdg: kH(tr, lo), state: st }; // 순간이동(위 keyJump ★) — 뒤 키 때 짠
    const span = kt[j] - kt[lo];
    const u = span > 0 ? Math.min(1, Math.max(0, (t - kt[lo]) / span)) : 0;
    /* 각은 선형으로 안 메운다 — 앞 키의 각에서 초당 TURN_DPS도로 따라가다 목표에 닿으면 멈춘다(원작의 회전).
       키에 늦지 않게 필요한 속도(need)와 견줘 더 빠른 쪽을 쓰므로 다음 키에 닿는 순간의 각은 그 키의 각 그대로다. */
    const h0 = kH(tr, lo);
    const dh = angDiff(h0, kH(tr, j));
    const dt = t - kt[lo];
    const need = span > 0 ? Math.abs(dh) / span : 0;
    const turned = Math.min(Math.abs(dh), Math.max(TURN_DPS, need) * dt);
    const x0 = kX(tr, lo);
    const y0 = kY(tr, lo);
    return {
        x: x0 + (kX(tr, j) - x0) * u,
        y: y0 + (kY(tr, j) - y0) * u,
        hdg: norm360(h0 + Math.sign(dh) * turned),
        state: st,
    };
}
/** base64 → 바이트. atob는 라틴1 문자열을 주므로 코드포인트를 그대로 옮긴다. */
function fromBase64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1)
        out[i] = bin.charCodeAt(i);
    return out;
}
/** zlib 풀기 — 브라우저가 해 준다(DecompressionStream). 없는 환경이면 던진다. */
async function inflate(bytes) {
    const DS = globalThis.DecompressionStream;
    if (!DS)
        throw new Error("이 브라우저는 DecompressionStream이 없다");
    const stream = new Blob([bytes]).stream().pipeThrough(new DS("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** 바이트열을 앞에서부터 훑는 작은 커서 — 꼴이 한 줄로 이어져 있어 되감을 일이 없다. */
class Cursor {
    /* 매개변수 속성(constructor(private b))은 안 쓴다 — 이 리포는 erasableSyntaxOnly라
       타입만 지워서는 자바스크립트가 안 되는 문법을 금한다. */
    constructor(b) {
        this.p = 0;
        this.b = b;
    }
    u8() { return this.b[this.p++]; }
    u16() { const v = this.b[this.p] | (this.b[this.p + 1] << 8); this.p += 2; return v; }
    u32() {
        const v = (this.b[this.p] | (this.b[this.p + 1] << 8) | (this.b[this.p + 2] << 16)
            | (this.b[this.p + 3] << 24)) >>> 0;
        this.p += 4;
        return v;
    }
    i32() { return this.u32() | 0; }
    f32() {
        const v = new DataView(this.b.buffer, this.b.byteOffset + this.p, 4).getFloat32(0, true);
        this.p += 4;
        return v;
    }
    /** UTF-8 글 n바이트. 사람 이름이 여기로 온다(한글은 덤퍼가 CP949에서 옮겨 놓는다). */
    utf8(n) {
        const s = new TextDecoder().decode(this.b.subarray(this.p, this.p + n));
        this.p += n;
        return s;
    }
    /** 7비트씩 담긴 수 + zigzag 되돌리기 — 음수도 작은 바이트로 들어온다. */
    varint() {
        let z = 0;
        let shift = 0;
        for (;;) {
            const c = this.b[this.p++];
            z |= (c & 0x7f) << shift;
            if (!(c & 0x80))
                break;
            shift += 7;
        }
        z >>>= 0;
        return (z >>> 1) ^ -(z & 1);
    }
    get left() { return this.b.length - this.p; }
}
/**
 * 서버가 준 문자열(base64)을 트랙으로 푼다.
 *
 * 던지지 않는다 — 꼴이 낯설거나 못 풀면 null을 준다. 부르는 쪽은 그때 옛 길로 돌아가면 된다.
 */
/** 머리 다섯 바이트만 엿본다 — **못 푼 까닭을 말하기 위한** 자다.
 *
 *  decodeTruthTracks는 꼴이 낯설면 그냥 null을 준다(그게 부르는 쪽에 편하다). 그런데
 *  그러면 화면이 "재생할 수 없는 게임이에요"라고만 하고 **왜인지는 아무 데도 안 남는다**.
 *  판이 범위 밖이라 물리친 것인지, 애초에 OBWT가 아닌 것인지, 자취가 안 온 것인지가
 *  갈리지 않으면 서버를 고쳐야 할 일과 화면을 고쳐야 할 일을 구분할 수가 없다.
 *  전체를 푸는 값(1~2MB)을 치르지 않고 머리만 본다. */
/** 해독기가 읽는 판의 범위 — 화면의 진단 문구는 이 두 값에서 만든다(2026-09, 덤퍼 쪽 답신: 게이트는 8 인데
 *  문구가 "2~7만 읽는다"였다 — 문구와 게이트를 따로 적어 두면 다음 어긋남이 로그에서 안 읽힌다). */
/* ★ 판 11 만 읽는다(2026-09, 요청: "판 10 이하 참값은 재생 안되게") — 하단 인포창·K/D 가 판 11 의 네 절(에너지·탑승·자원량·처치)
   위에 서므로 옛 판은 폴백 없이 물리친다. 덤퍼가 판 11 로 갈리고 일괄 재분석이 돈다. */
export const TRUTH_VER_MIN9 = 11;
/* 판 12 = 판 11 + 선택 줄마다 u8 갈래(아래 SEL_KIND9) — 덤퍼가 갈리고 재분석이 돌기까지 판 11 도 그대로 읽는다(갈래 −1). */
/* 판 13 = 판 12 + 맨 뒤 **데미지 절**(통마다 임자별 준·입은 데미지 · 아래 dmg) — 옛 판은 빈 표다(2026-10). */
/* 판 14 = 판 13 + 맨 뒤 **채집 절**(사람마다 캔 자원 누적 · 아래 gath) — 옛 판은 빈 표다(2026-10-22). */
export const TRUTH_VER_MAX9 = 14;
/** 선택 갈래(판 12 선택 줄의 낮은 넉 비트) — 높은 넉 비트는 부대 번호(0~9 · 부대 갈래에서만 뜻이 있다). */
export const SEL_KIND9 = {
    /** 마우스로 고름(클릭·끌어 고르기 = Select) — 그 몸들은 그 순간 그 사람 화면 안이었다. */
    click: 0,
    /** 시프트로 더함(ShiftSelect) — 화면 안. */
    add: 1,
    /** 시프트로 뺌(ShiftDeselect) — 화면 안. */
    remove: 2,
    /** 부대 불러오기(숫자키) — 화면을 안 옮긴다. 선택이 그대로여도 한 줄 적는다(두 번 누름을 알아야 한다). */
    recall: 3,
    /** 부대 지정(Ctrl+숫자) — 선택이 안 바뀐다. */
    assign: 4,
    /** 부대에 더함(Shift+숫자) — 선택이 안 바뀐다. */
    groupAdd: 5,
};
export async function peekTruthHead(b64) {
    try {
        const raw = await inflate(fromBase64(b64));
        if (raw.length < 5)
            return null;
        const ok = raw[0] === 0x4f && raw[1] === 0x42 && raw[2] === 0x57 && raw[3] === 0x54;
        return { ok, version: raw[4] };
    }
    catch {
        return null;
    }
}
export async function decodeTruthTracks(b64) {
    try {
        const raw = await inflate(fromBase64(b64));
        const c = new Cursor(raw);
        if (c.u8() !== 0x4f || c.u8() !== 0x42 || c.u8() !== 0x57 || c.u8() !== 0x54)
            return null; // "OBWT"
        const version = c.u8();
        /* 판 2도 계속 읽는다(요청: 테란 건물 리프팅 — 판 3에서 '떠 있다' 비트가 생겼다) —
           서버가 새 덤퍼로 바뀌어도 **이미 구워 둔 자취는 판 2인 채로 남는다**. 여기서
           판 3만 받으면 재분석이 다 돌 때까지 모든 옛 경기가 "재생할 수 없는 게임"이 된다.
           달라진 것은 상태 바이트의 깃발 한 칸뿐이라, 판 2는 그 칸이 늘 0인 판 3과 같다. */
        /* ★ 판 9 = 판 8 + 맨 뒤의 **건설 명령** 절(2026-09) — 한때 옛 판 8·9·10 도 그대로 읽었다(덤퍼를 갈아 끼우고
           재분석이 다 돌기까지 옛 경기가 "재생할 수 없는 게임"이 되지 않게). ★★ 지금은 **판 11 만** 읽는다(2026-09, 요청:
           "판 10 이하 참값은 재생 안되게" — 덤퍼가 판 11 로 일괄 재분석한다). 10 이하는 그 자리에서 물리친다. */
        if (version < TRUTH_VER_MIN9 || version > TRUTH_VER_MAX9)
            return null;
        const hasAir = version >= 3;
        /** 건설 명령 절(판 9) — 맨 뒤라 옛 판은 그 앞에서 끝난다. */
        const hasBuilds = version >= 9;
        /** 선택 절(판 10) — 건설 명령 절 뒤, 맨 뒤다. */
        const hasSels = version >= 10;
        /** 선택 줄마다 갈래 바이트(판 12). */
        const hasSelKind = version >= 12;
        /** 에너지·탑승·자원량·처치 네 절(판 11) — 선택 절 뒤, 맨 뒤다(2026-09, 요청: 하단 인포창 — "어림 말고 덤퍼에 부탁"). */
        const hasInfo = version >= 11;
        /** 데미지 절(판 13) — 네 절 뒤, 맨 뒤다. */
        const hasDmg = version >= 13;
        /** 채집 절(판 14) — 데미지 절 뒤, 맨 뒤다. */
        const hasGath = version >= 14;
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
        /* 업그레이드 줄에 건물 태그가 붙는가(위 머리말 ★) — 줄마다 u32 하나가 늘어난다.
           판 6 뭉치는 이 칸이 없으므로 태그 0(모름)으로 채운다. */
        const hasUpTag = version >= 7;
        const fps = c.f32();
        const trustFrame = c.i32();
        if (!Number.isFinite(fps) || fps <= 0)
            return null;
        const players = [];
        const pn = c.u8();
        for (let i = 0; i < pn; i += 1) {
            const owner = c.u8();
            const pid = c.u8();
            const race = c.u8();
            const force = c.u8();
            const controller = c.u8();
            const rgb = c.u32();
            const name = c.utf8(c.u8());
            /* 진짜 개인색이다. 못 읽었으면 **0xffffffff**(색 아님)로 온다 — 빈 글자로 두면
               부르는 쪽이 팀색으로 떨어진다.
               ★ 이 자리가 비는 일이 **크게 줄었다**(뭉치 꼴은 그대로, 값의 뜻만 넓어졌다) —
                 여태 덤퍼는 리마스터의 CCLR 구획에서만 색을 읽어, 그 구획이 없는 1.16 이하는
                 여덟 명이 전부 '모름'이었다. 이제 머리말의 색 번호를 표준 팔레트로 풀므로
                 (SC:R 인게임·screp이 가는 길과 같다) 옛 판에서도 제 색이 온다. 갈래는 그대로
                 둔다 — 덜 걸릴 뿐이지 못 읽는 판이 아주 없어진 것은 아니고, **이미 구워 둔
                 뭉치는 다시 굽기 전까지 옛 값 그대로**다.
               ★ 옛 덤퍼는 그 자리에 흰색(0xffffff)을 적었다. 그 판들은 여기서 못 가른다(흰색은
                 고를 수 있는 색이라서다) — 대신 재생기가 '로스터 색이 한 가지뿐이면 색이 아니다'
                 로 걸러 낸다(ReplayMotionPlayer의 personalUsable). */
            const color = rgb === 0xffffffff
                ? "" : `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
            players.push({ owner, pid, race, force, controller, color, name });
        }
        const n = c.u32();
        if (n > 100000)
            return null;
        const head = new Array(n);
        for (let i = 0; i < n; i += 1) {
            head[i] = { tag: c.u32(), owner: c.u8(), type: c.u16(),
                count: c.u32(), hp: c.u32(), ic: c.u32(), tgt: hasTarget ? c.u32() : 0, own: [] };
            /* 임자바뀜 목록(판 8) — 줄 끝에 u8 수, 바뀜마다 u32 프레임(LE) · u8 새 임자. 차례로 읽는다. */
            const nOwn9 = c.u8();
            for (let k = 0; k < nOwn9; k += 1)
                head[i].own.push({ f: c.u32(), owner: c.u8() });
        }
        const tracks = [];
        for (let i = 0; i < n; i += 1) {
            const h = head[i];
            const kt = new Float32Array(h.count);
            const kxy = new Int16Array(h.count * 2);
            const kh = new Uint8Array(h.count);
            const kst = new Uint8Array(h.count);
            const types = new Uint16Array(h.count);
            const done = new Uint8Array(h.count);
            const air = hasAir ? new Uint8Array(h.count) : undefined;
            const cloak = hasCloak ? new Uint8Array(h.count) : undefined;
            let pf = 0;
            let px = 0;
            let py = 0;
            let pt = 0;
            let born = 0;
            let died = null;
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
                if (air)
                    air[k] = stateByte & 0x40 ? 1 : 0;
                // 0x20 = 은신 중(판 5부터) — 남아 있던 깃발 자리를 쓴다(0x10은 아직 빈다).
                if (cloak)
                    cloak[k] = stateByte & 0x20 ? 1 : 0;
                pt += c.varint();
                types[k] = pt;
                const t = pf / fps;
                if (k === 0)
                    born = t;
                if (state === TRUTH_ST_GONE)
                    died = t;
                kt[k] = t;
                kxy[k * 2] = px; // 픽셀 그대로(읽을 때 /32 → 타일)
                kxy[k * 2 + 1] = py;
                kh[k] = headingByte;
                kst[k] = state;
            }
            tracks.push({
                tag: h.tag,
                owner: h.owner,
                kind: BW_UNIT_NAME[h.type] ?? `?${h.type}`,
                born,
                died,
                own: h.own.map((o) => ({ t: o.f / fps, owner: o.owner })),
                kt, kxy, kh, kst,
                types,
                done,
                ...(air ? { air } : {}),
                ...(cloak ? { cloak } : {}),
            });
        }
        /* 체력·인터셉터는 자리 키와 따로 온다(섞으면 한쪽이 바뀔 때마다 다른 쪽 키까지
           끌려 나온다). 트랙 차례가 같으므로 같은 차례로 읽어 붙인다. */
        const readTicks = (want, put) => {
            for (let i = 0; i < n; i += 1) {
                const cnt = want(head[i]);
                if (!cnt)
                    continue;
                const out = new Float32Array(cnt * 2);
                let pf = 0;
                let pv = 0;
                for (let k = 0; k < cnt; k += 1) {
                    pf += c.varint();
                    pv += c.varint();
                    out[k * 2] = pf / fps;
                    out[k * 2 + 1] = pv;
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
                if (!cnt)
                    continue;
                // 표적은 태그(u32)라 float32로는 깨진다 — Float64.
                const out = new Float64Array(cnt * 2);
                let pf = 0;
                for (let k = 0; k < cnt; k += 1) {
                    pf += c.varint();
                    out[k * 2] = pf / fps;
                    out[k * 2 + 1] = c.u32();
                }
                tracks[i].tgt = out;
            }
        }
        const ups = [];
        {
            let pf = 0;
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                pf += c.varint();
                const id = c.u16();
                const level = c.u8();
                const who = c.u8();
                /* 태그는 이름을 모르는 줄에서도 **반드시 읽는다** — 아래 `if (nm)`은 담을지를
                   가릴 뿐이고, 안 읽으면 커서가 4바이트씩 밀려 그 뒤가 통째로 어긋난다. */
                const utag = hasUpTag ? c.u32() : 0;
                const nm = bwUpgradeName(id);
                // 2단계·3단계는 이름 뒤에 단계를 붙인다 — 옛 표기와 같은 자리다.
                if (nm)
                    ups.push([pf / fps, level > 1 ? `${nm} ${level}` : nm, who, utag]);
            }
        }
        const casts = [];
        {
            let pf = 0;
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                pf += c.varint();
                const x = c.u16();
                const y = c.u16();
                const tech = c.u8();
                const who = c.u8();
                casts.push([pf / fps, x / 32, y / 32, BW_TECH_NAME[tech] ?? `?${tech}`, who]);
            }
        }
        const pings = [];
        {
            let pf = 0;
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                pf += c.varint();
                const x = c.u16();
                const y = c.u16();
                pings.push([pf / fps, x / 32, y / 32, c.u8()]);
            }
        }
        const res = new Map();
        {
            const prev = new Map();
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                const who = c.u8();
                const p = prev.get(who) ?? [0, 0, 0];
                const row = [p[0] + c.varint(), p[1] + c.varint(), p[2] + c.varint()];
                prev.set(who, row);
                const arr = res.get(who) ?? [];
                arr.push([row[0] / fps, row[1], row[2]]);
                res.set(who, arr);
            }
        }
        const orders = new Map();
        {
            let pf = 0;
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
            }
        }
        const apm = new Map();
        let apmBucketSec = 5;
        {
            const cnt = c.u32();
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
            }
        }
        const resFields = [];
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
        /* 건설 명령(판 9) — [초, 임자, 일꾼 태그, 타일 x, 타일 y, 건물 이름]. 자리는 **발자국 좌상단 타일**이다
           (원작 action_build 의 tile_pos 그대로 — 픽셀도 가운데도 아니다). 종류는 units.dat 번호를 이름으로 푼다. */
        const builds = [];
        if (hasBuilds) {
            let pf = 0;
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                pf += c.varint();
                const who = c.u8();
                const tag = c.u32();
                const tx = c.u16();
                const ty = c.u16();
                const ty9 = c.u16();
                builds.push([pf / fps, who, tag, tx, ty, BW_UNIT_NAME[ty9] ?? `?${ty9}`]);
            }
        }
        /* 선택(판 10) — [초, 임자, 태그들]. 그 명령을 치른 **뒤의 선택 전체**라 화면은 한 줄만 보면 된다
           (ShiftSelect·ShiftDeselect 를 덤퍼가 풀어 준다 — 차이를 쌓는 셈을 화면이 되풀이하지 않게). */
        const sels = [];
        if (hasSels) {
            let pf = 0;
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                pf += c.varint();
                const who = c.u8();
                const kind = hasSelKind ? c.u8() : -1;
                const n = c.u8();
                const tags = [];
                for (let k = 0; k < n; k += 1)
                    tags.push(c.u32());
                sels.push([pf / fps, who, tags, kind]);
            }
        }
        /* 판 11 네 절 — 에너지(태그마다 [초, 값] 계단) · 탑승 · 자원량 · 처치. */
        const energy = new Map();
        const loads = [];
        const amounts = [];
        const kills = [];
        if (hasInfo) {
            {
                let pf = 0;
                const cnt = c.u32();
                const tmp = new Map();
                for (let i = 0; i < cnt; i += 1) {
                    pf += c.varint();
                    const tag = c.u32();
                    const v = c.u16();
                    const a = tmp.get(tag);
                    if (a)
                        a.push(pf / fps, v);
                    else
                        tmp.set(tag, [pf / fps, v]);
                }
                for (const [tag, a] of tmp)
                    energy.set(tag, Float32Array.from(a));
            }
            {
                let pf = 0;
                const cnt = c.u32();
                for (let i = 0; i < cnt; i += 1) {
                    pf += c.varint();
                    const pax = c.u32();
                    loads.push([pf / fps, pax, c.u32()]);
                }
            }
            {
                let pf = 0;
                const cnt = c.u32();
                for (let i = 0; i < cnt; i += 1) {
                    pf += c.varint();
                    const x = c.u16();
                    const y = c.u16();
                    amounts.push([pf / fps, x / 32, y / 32, c.u16()]);
                }
            }
            {
                let pf = 0;
                const cnt = c.u32();
                for (let i = 0; i < cnt; i += 1) {
                    pf += c.varint();
                    const who = c.u8();
                    const ktag = c.u32();
                    kills.push([pf / fps, who, ktag, c.u32()]);
                }
            }
        }
        /* 판 13 — 데미지 절: 수 · 통 프레임 · 줄마다 통 차 · 임자 · 네 몫. */
        const dmg = [];
        let dmgBucketSec = 0;
        if (hasDmg) {
            const cnt = c.u32();
            const bf = c.u16();
            dmgBucketSec = bf / fps;
            let pb = 0;
            for (let i = 0; i < cnt; i += 1) {
                pb += c.varint();
                const who = c.u8();
                const du = c.varint();
                const db = c.varint();
                const tu = c.varint();
                const tb = c.varint();
                dmg.push([(pb * bf) / fps, who, du, db, tu, tb]);
            }
        }
        /* 판 14 — 채집 절(맨 뒤): 자원 절과 같은 꼴(사람마다 앞 줄과의 차) · 값은 누적. */
        const gath = [];
        if (hasGath) {
            const prev = new Map();
            const cnt = c.u32();
            for (let i = 0; i < cnt; i += 1) {
                const who = c.u8();
                const p = prev.get(who) ?? [0, 0, 0];
                const row = [p[0] + c.varint(), p[1] + c.varint(), p[2] + c.varint()];
                prev.set(who, row);
                gath.push([row[0] / fps, who, row[1], row[2]]);
            }
        }
        return { version, leftover: c.left,
            tracks, trustUntil: trustFrame < 0 ? null : trustFrame / fps,
            players, ups, casts, pings, res, apm, apmBucketSec, orders, resFields, builds, sels,
            energy, loads, amounts, kills, dmg, dmgBucketSec, gath };
    }
    catch {
        return null;
    }
}
