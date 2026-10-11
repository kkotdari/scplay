/* 중계(중요도 기반 추적) — '지금 볼 만한 사람'을 미리 정해 두는 편성표 ─────────────────
 *
 * 요청: "중계(중요도기반추적)모드 — 현재 경기 장면 중 가장 중요하거나 가치있는 사람의
 *        추적 화면을 보여줌 · 실제 보여주려는 장면이 나오기 1-2초전에 미리 그 사람으로
 *        전환 · 특별하게 중요도 차이가 없는경우 순환 중계 원칙(초반이나 소강상태)"
 *
 * ★★ **미리 정해 둔다 — 실시간으로 고르지 않는다.** 요청의 "1-2초 전에 미리 전환"이
 *    그것을 못 박는다: 지금 무엇이 중요한지는 **그 일이 벌어진 뒤에야** 알 수 있으므로,
 *    실시간으로 고르면 늘 한 발 늦는다. 참값(TruthWorld)은 경기 전체를 이미 알고 있으니
 *    한 번 훑어 **편성표**를 굽고, 재생은 시각으로 그 표를 짚기만 한다. 중계 카메라가
 *    사건보다 먼저 가 있는 것은 이 앞셈 덕이다.
 *
 * ■ 무엇이 '중요'인가 — 자료가 실제로 아는 것으로만 센다.
 *   ① 죽음(end "atk") — 잃은 몸값이 곧 그 순간의 무게다. **죽인 쪽**은 참값의 겨눔
 *      자국(tgt)으로 되짚는다: 그 태그를 겨누고 있던 적의 임자가 killer다.
 *      ★ **일꾼만은 몸값이 아니라 경제의 값**(HARASS9 — 드랍·런바이 견제가 곧 그 꼴이다).
 *   ② 자폭(end "self") · ③ 마법(casts) — 스톰·핵·스테이시스처럼 값이 큰 기술은
 *      죽음이 안 따라도 그 자체가 장면이다.
 *   건설·업그레이드는 **안 센다** — 요청이 초반·소강을 순환 중계로 돌리라고 했으므로,
 *   그 자리를 건설로 메우면 그 뜻이 지워진다.
 *
 * ■ 누구를 보여주나 — 한 장면의 무게를 임자마다 더해 가장 무거운 사람이다. 죽인 쪽이
 *   잃은 쪽보다 무겁게(1 : 0.55) 쳐진다: 중계는 '당한 사람'보다 '하는 사람'을 본다.
 *   무게가 엇비슷하면(TIE9 안) **가장 오래 안 보여 준 사람**을 고른다 — 그것이 곧
 *   요청의 순환 원칙이고, 그래서 한 사람만 계속 잡히는 일이 없다.
 *
 * ■ 소강·초반 — 장면 사이가 IDLE9보다 벌면 CYCLE9마다 **살아 있는 사람을 돌아가며**
 *   보여준다(요청의 순환 중계). 경기 시작도 그 자리에서 시작한다.
 *   ★ 돌아가는 차례는 **로스터 차례로 팀을 번갈아**(2026-09, 요청: "자동 중계시 중요장면 없어서 순환할때
 *   순서를 로스터 순으로 팀 번갈아가며 보여주기") — 옛 '가장 오래 안 본 사람'은 장면이 끼어들 때마다 차례가
 *   뒤섞여 누가 다음인지 읽히지 않았다. 이제 고리(ring9 — 1팀 첫째 · 2팀 첫째 · 1팀 둘째 · …)를 두고
 *   마지막으로 보여 준 사람 **다음**부터 산 사람을 고른다(장면으로 보여 준 사람도 그 자리에서 잇는다).
 *   밀리(팀 없음)는 로스터 차례 그대로. 동점 가름(TIE9)은 종전대로 '가장 오래 안 본 사람'이다.
 */
import { BUILDING_KO, UNIT_KO } from "../../utils/replayNames";
import { researchKo } from "../../utils/replayTechNames";
import { BUILDING_FOOT, costOf, raceOfBwKind9, sightTiles, SUPPLY_CAP, SUPPLY_COST, SUPPLY_GIVES, unitOf, UPGRADE_TIME, upgradeSeconds } from "../../utils/bwUnits";
import { SEL_KIND9, tkN, tkT, tkV } from "../../utils/openbwTracks";
import type { TruthWorld } from "../../utils/truthLives";

/** 한 토막 — 이 시각부터 다음 토막까지 이 사람을 보여준다. */
export type CastSeg9 = {
  /** 갈아타는 시각(초) — 장면보다 LEAD9 앞이다. */
  at: number;
  /** 그 사람(참값 이름 = 로스터 key). */
  raw: string;
  /** 왜 골랐나 — 자막 꼬리표·진단. */
  why: string;
  /** 순환(소강·초반)인가 — 장면이면 거짓. */
  cyc: boolean;
  /** 그 장면의 무게(진단·토스트 차례 정하기). */
  score: number;
  /** ★ 그 장면의 **상대역**(2026-10 · 아래 머리말의 맞대결) — 재생기가 자막("A의 공격 · B를 공격 · B와 교전")을 짓는 자다
   *  (2026-10-09: 옛 자동 분할은 되물렸다 — 화면은 늘 한 사람). */
  foe?: string;
  /** 주인공(raw)의 몫 — atk 공격 · def 방어 · war 교전(둘 다 친다). 상대역은 그 거울(atk ↔ def · war 그대로). */
  role?: CastRole9;
  /** 맞대결이 끝나는 시각(초) — 그 뒤로는 같은 토막이어도 자막이 내린다. */
  foeTo?: number;
  /** 그 장면의 **적 전부**(주인공과 주고받은 몸값 큰 차례 · 첫째가 foe) · **같은 편**(함께 싸운 팀원) — 자막의 "A·B의 공격 · C와 함께"(2026-10-09). */
  foes?: string[];
  allies?: string[];
  /** ★ 자막 조각(2026-10-09, 요청: "모든 장면에 자막 — 전투·견제·공격·방어·기술 개발·건설 등을 담백한 개조식으로") — 글귀와 사람(재생기가 이름표 칩으로 그린다 ·
   *  조사 p 는 그 사람의 표시 이름 받침으로 재생기가 붙인다). 아래 castCaps9. */
  caps?: CapPart9[];
};
/** 자막 한 조각 — 글귀(text) 또는 사람(raw · 뒤에 붙일 조사 p: ga 가/이 · eul 를/을 · wa 와/과 · ui 의). */
export type CapPart9 = { text: string; raw?: undefined; p?: undefined } | { raw: string; p?: "ga" | "eul" | "wa" | "ui"; text?: undefined };
export type CastRole9 = "atk" | "def" | "war";
/** 상대역의 몫 — 주인공의 거울. */
export const castFoeRole9 = (r9: CastRole9): CastRole9 => (r9 === "atk" ? "def" : r9 === "def" ? "atk" : "war");

export type CastPlanOpts9 = {
  /** 경기 길이(초). */
  total: number;
  /** 중계에 안 세울 이름(관전자 등). */
  skip?: ReadonlySet<string>;
  /** 이 이름들만 세운다(로스터) — 안 주면 참값의 사람 전부. */
  only?: ReadonlySet<string>;
  /** 로스터 차례(이름) — 순환 고리의 자다. 안 주면 참값의 사람 차례. */
  order?: readonly string[];
  /** 이름 → 팀 — 고리를 팀 번갈아 짠다. 안 주면(밀리) 로스터 차례 그대로. */
  teamOf?: Readonly<Record<string, number | undefined>>;
  /** 지도 자원 점(ReplayMapGrid.resources — 미네랄 밭(겹친 것은 하나)·가스 [타일 x, 타일 y, 가스]) — 앞마당·멀티를 가르는 자(2026-10-10). 없으면 본진 건물은 수로만 센다. */
  resources?: readonly (readonly [number, number, number])[];
  /** 지도 크기(타일) — 센터 판정(2026-10-10). 없으면 센터 전술은 안 읽는다. */
  mapW?: number; mapH?: number;
  /** 참값 지형(2026-10-10) — 고도(0~3) · 걸을 수 있나 · 램프. 없으면 언덕탱·옆탱·입구 판정은 안 읽는다. */
  terrain?: { level: (x: number, y: number) => number; walk: (x: number, y: number) => boolean; ramp?: (x: number, y: number) => boolean };
  /** 경기 채팅(2026-10-10) — [초, 말한 사람(참값 이름), 글]. "gg/ㅈㅈ" 선언 · "노엘/ㄴㅇ" 외침 자막의 재료. 없으면 안 읽는다. */
  chats?: readonly { sec: number; name: string; text: string }[];
  /** 임자별 자원 [초, 미네랄, 가스] 변곡점(openbwTracks res — 2026-10-11) — 인구 막힘은 그동안 가장 싼 유닛 값(BLOCK_MIN9)이 있을 때만 센다. 없으면 안 거른다. */
  bank?: ReadonlyMap<number, readonly (readonly [number, number, number])[]>;
};

/** 장면보다 몇 초 먼저 갈아타나(요청: "1-2초전에 미리") — 그 사이에 카메라가 자리를 잡는다. */
export const CAST_LEAD9 = 1.5;
/** 한 장면으로 묶는 사건 사이의 최대 틈(초). */
const GAP9 = 6;   // 4 → 6(2026-10-10, 요청: "중요도 높은 이벤트와 전투를 긴 호흡으로") — 한 싸움의 잔 틈에 장면이 안 끊긴다
/** 한 장면의 자리 반지름(타일) — 이보다 먼 사건은 같은 때여도 딴 장면이다(2026-10-10 · 아래 장면 묶기 ★★). 기지 하나(BASE_R9 18)쯤. */
const SCENE_R9 = 20;
/** 한 장면의 최대 길이(초) — 긴 교전은 토막을 내어 POV를 다시 고른다. */
const MAX_SCENE9 = 30;   // 22 → 30(2026-10-10 · 긴 호흡)
/** 같은 사람의 새 사건 자막을 새 토막으로 세우는 최소 틈(초) — 그 안이면 앞 글귀를 덮는다(push9 ★). */
const CAP_SPLIT9 = 3;
/** 갈아탄 뒤 최소한 머무는 시간(초) — 이보다 잦으면 화면이 정신없다. */
const MIN_HOLD9 = 8;   // 5 → 8(2026-10-10 · 긴 호흡 — 갈아탄 뒤 그 장면을 읽을 만큼 머문다)
/** 머무는 중에도 갈아탈 만한 무게 배수 — 이만큼 크면 바로 넘긴다(요청: 바로 다른 사람으로 전환). */
const JUMP9 = 2.2;   // 1.7 → 2.2(2026-10-10 · 긴 호흡 — 머무는 중 끼어들기는 훨씬 무거운 장면만)
/** '무게 차이가 없다'의 자 — 1등이 2등의 이 배수 안이면 순환 원칙으로 고른다.
 *  ⚠ 넓게 잡지 마라 — 이 문이 열리면 **이긴 쪽 대신 진 쪽**이 잡힐 수 있다(잃은 몫도
 *  무게이므로 호각인 교전에서는 둘이 엇비슷하다). 그 자리에서 순환을 부르는 것이 뜻이지만,
 *  1.25에서는 한쪽이 20% 더 이긴 교전까지 '차이 없음'으로 읽혔다(실측 합성 판). */
const TIE9 = 1.12;
/** 장면으로 세울 최소 무게 — 저글링 셋(또는 드라군 하나) 어치. */
const MIN_SCENE9 = 450;   // 240 → 450(2026-10-10, 요청: "중요도 낮은 이벤트는 화면 보여주지 않기") — 일꾼 한 킬(310)·저글링 셋은 이제 장면이 아니다
/** 전진의 자(2026-10-10) — 적 기지(본진 건물·출발 자리)까지 이 타일 안(기지 앞이나 안) · 제 기지(멀티 포함)까지가 그 몇 배 넘게 멂. 전진 건물·전진 건설 일꾼이 함께 쓴다. */
const PROXY_FRONT9 = 30;
const PROXY_FAR9 = 2;
/** 오버로드 사냥꾼(2026-10-10, 요청: "스카우트·커세어·발키리·레이스 등 공중공격 강한 유닛으로 오버로드를 대량으로 잡는 것") — 한 장면에 OVL_HUNT_N9 마리 이상. */
const OVL_HUNTER9 = new Set(["Scout", "Corsair", "Valkyrie", "Wraith", "Mutalisk", "Devourer"]);
const OVL_HUNT_N9 = 3;
/** 센터 방어 건물의 이름(요청: "센터 포토/벙커/터렛 등 — 맵 중앙 부근에 짓는 것"). */
const CENTER_DEF9: Record<string, string> = { "Photon Cannon": "포토", Bunker: "벙커", "Missile Turret": "터렛", "Sunken Colony": "성큰", "Spore Colony": "스포어" };
/** 센터 반지름 — 지도 짧은 변의 몫: 방어 건물 · 장악(병력·건물이 모인 자리). */
const CENTER_K9 = { def: 0.12, hold: 0.18 };
/** 센터 장악 — 제 병력+건물 수가 이 이상이고 적의 이 배 이상. */
const CENTER_HOLD9 = { n: 8, k: 2 };
/** 장면 자막에 활약을 붙이는 마법(2026-10-10, 요청: "스톰도 중요한 기술 · 마엘스트롬·마인드컨트롤·스테이시스 등도 중요 · EMP·이레디에이트 등 마법 유닛의 활약도 묘사") — 앞일수록 먼저. */
const SPELL_NOTE9 = ["Psionic Storm", "Maelstrom", "Stasis Field", "Mind Control", "EMP Shockwave", "Irradiate", "Plague", "Dark Swarm",
  "Lockdown", "Ensnare", "Disruption Web", "Recall", "Spawn Broodlings", "Feedback", "Defensive Matrix"];
/** 마법으로 잡은 몸의 '죽인 유닛 종류'(처치 절) — 스톰은 stormBy9 가 하이템플러로 적는다. */
/** 마법 활약의 문턱(2026-10-11) — 잡는 마법은 잡은 수 · 그 밖은 쓴 사람이 준 몸값(value)과 받은 것의 배(k). */
const SPELL_ACT9 = { kills: 3, value: 300, k: 1.5 };
const SPELL_KILLER9: Record<string, string> = { "Psionic Storm": "High Templar", Irradiate: "Science Vessel", Plague: "Defiler", "Spawn Broodlings": "Queen" };
/** 병력 구성(국면 요약 · 2026-10-10, 요청: "바이오닉/메카닉 운영 · 파워 드라군 · 목동저그(아드레날린 저글링 울트라 조합)"). */
const BIO9 = new Set(["Marine", "Firebat", "Medic", "Ghost"]);
const MECH9 = new Set(["Vulture", "Siege Tank (Tank Mode)", "Siege Tank (Siege Mode)", "Siege Tank", "Goliath"]);
const COMP9 = { n: 10, k: 0.6, ultra: 2, ling: 8 };
/** 탱크 조이기 — 이 초 창 안에 앞으로(적 쪽) 박은 탱크가 이 수 이상 · 메카닉은 그때 벌처·골리앗이 이 수 이상. */
const PUSH9 = { win: 90, tanks: 3, mech: 6 };
/** 순환 한 토막의 길이(초) — 소강에서 한 사람을 보여주는 시간(요청: "순환중계시 한 사람
 *  유지시간 줄이기" — 14 → 9 → 재요청 "9초 -> 8초"). 자막이 상시 표시가 된 뒤로는 갈아타는 박자가
 *  곧 자막 박자라는 옛 ⚠(토스트가 그만큼 잦다)가 걷혀, 값을 정하는 것은 **한 사람을 읽을 만한
 *  시간**뿐이다 — MIN_HOLD9(5)보다는 넉넉하고, 소강 한 토막이 지루하지 않을 만큼. */
const CYCLE9 = 6;   // 8 → 6(2026-10-10, 요청: "소강상태 전환 6초로 단축") — 장면 뒤 머묾(MIN_HOLD9 8)과는 따로다
/** 장면이 끝나고 이만큼 비면 순환으로 돌아간다(초). */
const IDLE9 = 8;
/** 죽인 쪽을 되짚는 창(초) — 이 안에 그 태그를 겨누고 있었으면 그 임자의 킬로 센다. */
const KILL_W9 = 2.5;
/** 잃은 쪽의 몫 — 죽인 쪽 1에 대해. */
const LOSS_K9 = 0.55;
/** 건물은 한 단 무겁다 — razing 은 유닛 교전보다 큰 사건이다. */
const BLD_K9 = 1.2;
/** ★ 본진 건물(뚝배기) 깨기의 덧무게(2026-10-11, 요청: "메인홀(뚝배기) 깨는 건 진짜 중요해서 꼭 보여줘야 함") — 홀로도 장면 문턱(MIN_SCENE9)을 넉넉히 넘고, 그 토막은
 *  한창인 딴 전투도 끊고 들어간다(아래 편성 must9). */
const HALL_KILL_W9 = 1500;
/** 한꺼번에 이만큼 사라지면서 겨눈 자가 하나도 없으면 **나간 것**이다(교전이 아니다). */
const LEAVE_N9 = 8;
/** ★★ **일꾼의 죽음은 견제다 — 몸값이 아니라 경제의 값으로 센다**(2026-09, 지적: "자동 중계에서
 *  드랍견제 같은 중요한 장면을 중계안하는 경우가 있네") ─────────────────────────────────
 *  드랍·런바이·벌처 견제의 꼴은 **일꾼 몇을 띄엄띄엄 잡는 것**이다. 몸값(50)으로 세면 한 킬이
 *  77.5(죽인 쪽 50 + 잃은 쪽 27.5)라 셋을 한 장면에 몰아도 232 < MIN_SCENE9 고, 일꾼은 도망치며
 *  잡히므로 킬 사이가 GAP9(4초)보다 벌어 **한 장면으로 묶이지도 않는다**(실측 합성 판: 드론 다섯을
 *  5~8초 간격으로 잡으면 장면 0개). 곧 견제는 통째로 순환 뒤에 묻혔다.
 *  `k` — 일꾼 하나의 무게 배수(50 → 200 · 한 킬이 310 으로 홀로 장면이 선다 — 캐스터가 일꾼 킬마다
 *  화면을 돌리는 그 자다) · `tail` — 그 사건 뒤 장면을 열어 두는 초(GAP9 대신 · 도망치는 일꾼을 쫓아
 *  잡는 사이를 한 장면으로 잇고, 그 사이에 순환이 끼어들지 않게 한다). */
const HARASS9 = { k: 4, tail: 14 };   // tail 12 → 14(2026-10-10: GAP9 4 → 6 에 맞춰 마지막 킬 뒤 머묾 tail − GAP9 = 8초를 지킨다)
/** 맞대결(자동 분할)을 장면의 마지막 사건 뒤 이만큼 더 둔다(초) — 끝나자마자 한 화면으로 접히면 결말이 안 읽힌다. */
const DUEL_TAIL9 = 2;
/** 기지 피해 단(자막 · 2026-10-09) — 그 장면에서 잃은 건물 몸값 / 장면 머리의 기지 몸값: 반파 ≥ 0.2 · 대파 ≥ 0.45 · 궤멸 ≥ 0.75. */
const RAZE9 = { half: 0.2, heavy: 0.45, wipe: 0.75 };
/** 싸움터 가름(baseRole9 · 옛 turf9Of 는 2026-10-11 걷음 — 기지 밖은 교전) — home: 한 진영 몫이 이 위면 그 사람이 방어 · min: 자리를 아는 몸값이 맞대결 몸값의 이
 *  몫 아래면 안 쓴다 · near: 두 출발 자리가 이 타일 안이면 안 쓴다(가를 선이 없다). */
const TURF9 = { home: 0.65, min: 0.4, near: 12 };
/** 유닛의 죽은 자리를 명령으로 어림하는 창(초) — 그보다 오래된 명령은 그 몸이 어디 있었는지 못 말한다. */
const LOC_W9 = 25;

/** 변태로 난 몸의 **누적** 몸값 — 표의 값은 변태 비용뿐이라 밑몸 값을 더해 준다. */
const MORPH_BASE9: Record<string, string> = {
  Lurker: "Hydralisk", Guardian: "Mutalisk", Devourer: "Mutalisk",
};
/** 공짜로 나는 몸의 값 — 표가 [0,0]인 것들. */
const FREE_VAL9: Record<string, number> = {
  Archon: 550, "Dark Archon": 550, Broodling: 0, Larva: 0, Egg: 0,
  "Lurker Egg": 0, Cocoon: 0, "Infested Command Center": 0,
};

/** 그 정체의 몸값(가스는 1.5배) — 중계가 재는 '가치'의 자다. */
export function castValue9(kind: string): number {
  const f9 = FREE_VAL9[kind];
  if (f9 !== undefined) return f9;
  const [m9, g9] = costOf(kind);
  let v9 = m9 + g9 * 1.5;
  const b9 = MORPH_BASE9[kind];
  if (b9) { const [bm9, bg9] = costOf(b9); v9 += bm9 + bg9 * 1.5; }
  return v9;
}

/** 마법의 무게 — 좌표가 남는 기술만 참값에 실린다. 표에 없으면 안 센다. */
const CAST_W9: Record<string, number> = {
  "Nuclear Strike": 1400, "Nuclear Missile": 1400,
  "Psionic Storm": 260, "Stasis Field": 260, Maelstrom: 260,
  "Mind Control": 480, Recall: 480, Plague: 240, "EMP Shockwave": 240,   // 마컨·리콜 420/380 → 480(2026-10-10: MIN_SCENE9 450 위 — 홀로 장면이 선다)
  "Dark Swarm": 200, Irradiate: 170, Lockdown: 170, "Disruption Web": 140,
  "Spawn Broodlings": 130, Ensnare: 110, Feedback: 100, Hallucination: 80,
  Consume: 60, "Optical Flare": 60, Restoration: 50, "Defensive Matrix": 50,
  "Scanner Sweep": 24,
};

/** 한 사건 — 시각·사람·무게 · `tail` 은 이 사건 뒤 장면을 열어 두는 초(없으면 GAP9). */
type Ev9 = { sec: number; raw: string; w: number; why: string; tail?: number;
  /** 본진 건물(커맨드·넥서스·해처리·레어·하이브)을 부순 사건(죽인 쪽 · 2026-10-11) — main 은 시작 본진(뚝배기 · 꼭 보여 준다). */
  hall?: boolean; hallMain?: boolean;
  /** 맞상대(죽인 쪽이면 잃은 사람 · 잃은 쪽이면 죽인 사람) · 준 몸값(죽인 쪽) · 잃은 살림 값(일꾼·건물 · 잃은 쪽). */
  vs?: string; dealt?: number; econ?: number;
  /** 자막 재료(2026-10-09) — 죽은 몸의 종류(건물 파괴 자막의 건물 이름) · 마법 이름 · **죽인 유닛의 종류**(by · 리버/하이템플러 일꾼 견제 · 저글링러시의 자). */
  kind?: string; tech?: string; by?: string;
  /** 잃은 자리(타일 · 잃은 쪽 사건만) — 싸움이 **누구 진영에서** 났나를 재는 자다(duel9). 모르면 없다. */
  x?: number; y?: number;
  /** 기지 밖에서 잡힌 일꾼의 갈래(2026-10-10) — "정찰" · "전진 건설" · ""(그 밖 · 이동·도망). */
  wkw?: string;
  /** 죽인 쪽 사건만 — 죽인 몸의 태그(처치 절에서만 안다 · 모르면 없다)와 죽은 몸의 자리(지형 활용 판정 · 2026-10-10). */
  ktag?: number; vx?: number; vy?: number;
  /** 사건이 난 자리(타일 · 죽은 자리 · 마법을 친 자리) — 장면을 **자리로도** 가른다(2026-10-10 · SCENE_R9). 모르면 없다. */
  px?: number; py?: number };

/** 편성표를 굽는다 — 참값 한 벌에 한 번이다(재생 중에는 짚기만 한다). */
export function castPlan9(world: TruthWorld, opts: CastPlanOpts9): CastSeg9[] {
  const total = Math.max(1, opts.total);
  /** 임자 번호 → 이름. 관전자·로스터 밖은 아예 안 담는다(그 사람은 중계에 안 선다). */
  const rawOf9 = new Map<number, string>();
  const fill_9 = (only9?: ReadonlySet<string>): void => {
    rawOf9.clear();
    for (const p9 of world.players) {
      if (opts.skip?.has(p9.name)) continue;
      if (only9 && !only9.has(p9.name)) continue;
      rawOf9.set(p9.owner, p9.name);
    }
  };
  fill_9(opts.only);
  /* 로스터와 참값의 이름이 한 톨도 안 맞으면 **거르지 않는다** — 앱이 이름을 다르게 적는
     판에서 중계가 통째로 죽는 것보다, 로스터에 없는 사람이 한 번 잡히는 편이 낫다. */
  if (rawOf9.size === 0 && opts.only) fill_9(undefined);
  if (rawOf9.size === 0) return [];
  /** 그 사람의 몸이 마지막으로 살아 있던 초 — 순환에서 '이미 진 사람'을 뺀다. */
  /* ★ 살아 있는 끝 = **마지막 건물이 사라진 때**(2026-10-11, 지적: "궤멸된 수달이가 있는데 자꾸 수달이 화면이 나오고 실제로는 타센 화면이 그냥 멈춘 채 나와") — 옛 판은
     '몸 하나라도 안 죽었으면 끝까지 산 사람'이라, 기지를 다 잃고 오버로드·옵저버 몇만 남은 사람이 순환에 남았다(명령이 없으니 카메라는 앞 화면에 멈췄다). 원작의 패배는
     건물을 다 잃는 것이다 — 건물을 가진 적이 있으면 그 마지막 건물이 진 때가 끝, 건물이 한 번도 없었던 사람(옛 판 · 합성 세계)만 몸으로 잰다. */
  const liveTo9 = new Map<string, number>();
  {
    const bldTo9 = new Map<string, number>();
    for (const e9 of world.lives) {
      const r9 = rawOf9.get(e9.owner);
      if (!r9) continue;
      const to9 = e9.died === null ? total : e9.died;
      if (to9 > (liveTo9.get(r9) ?? -1)) liveTo9.set(r9, to9);
      if (e9.bld && to9 > (bldTo9.get(r9) ?? -1)) bldTo9.set(r9, to9);
    }
    for (const [r9, to9] of bldTo9) liveTo9.set(r9, to9);
  }

  /* ── 사건 모으기 ──────────────────────────────────────────────────────────── */
  const evs9: Ev9[] = [];
  /** 죽는 태그 — 겨눔 자국을 이 셋으로 좁힌다(전체를 담으면 표가 몇 배로 커진다). */
  const vics9 = new Set<number>();
  for (const e9 of world.lives) if (e9.died !== null && e9.end === "atk") vics9.add(e9.tag);
  /** 태그 → 그 태그를 겨눈 자국 [초, 임자, 초, 임자, …] — 죽인 쪽을 되짚는 자다.
   *  ★ **안 정렬한다**(한 태그의 목록은 대개 스물 안쪽이라 통째로 훑는 편이 싸다) ·
   *    **평평한 수 배열**이다(자국이 수만 개라 {s, o} 객체를 그만큼 짓지 않는다).
   *    실측(8인 20분 · 생애 8천 · 자국 3만2천): 43.6ms → 26.5ms(scripts/cast-plan.mjs). */
  /* ★ 자국마다 **겨눈 유닛의 종류**(kindId · 걸음 3 · 2026-10-09)도 싣는다 — 죽인 유닛이 리버인지 하이템플러인지 저글링인지가 자막의 재료다(아래 by). */
  const kindIds9 = new Map<string, number>();
  const kindNames9: string[] = [];
  const kindId9 = (k9: string): number => {
    let id9 = kindIds9.get(k9);
    if (id9 === undefined) { id9 = kindNames9.length; kindNames9.push(k9); kindIds9.set(k9, id9); }
    return id9;
  };
  const aim9 = new Map<number, number[]>();
  if (vics9.size > 0) {
    for (const e9 of world.lives) {
      const tg9 = e9.tgt;
      if (!tg9) continue;
      const n9 = tkN(tg9);
      const kid9 = kindId9(e9.kind);
      for (let i9 = 0; i9 < n9; i9 += 1) {
        const tag9 = tkV(tg9, i9);
        if (!tag9 || !vics9.has(tag9)) continue;
        const a9 = aim9.get(tag9);
        if (a9) a9.push(tkT(tg9, i9), e9.owner, kid9);
        else aim9.set(tag9, [tkT(tg9, i9), e9.owner, kid9]);
      }
    }
  }
  /** 태그 → 그 태그의 생애들(변태로 여럿) — 처치 절의 킬러 태그를 종류로 푼다. */
  const byTag9 = new Map<number, (typeof world.lives)[number][]>();
  for (const e9 of world.lives) { const a9 = byTag9.get(e9.tag); if (a9) a9.push(e9); else byTag9.set(e9.tag, [e9]); }
  const kindAt9 = (tag9: number, sec9: number): string => {
    const a9 = byTag9.get(tag9);
    if (!a9) return "";
    for (const e9 of a9) if (e9.born <= sec9 + 0.5 && (e9.died === null || e9.died >= sec9 - 0.5)) return e9.kind;
    return a9[a9.length - 1].kind;
  };
  /** ★ 처치 절(판 11 · [초, 킬러 임자, 킬러 태그, 죽은 태그])이 있으면 그것이 먼저다 — 겨눔 자국은 어림이고 이것은
   *  시뮬이 적은 참값이다(맞대결의 상대역도 이것으로 선다). 같은 태그가 변태로 여러 생애를 가지므로 초로 짝짓는다. */
  const killBy9 = new Map<number, number[]>();
  for (const [ks9, ko9, kt9, kd9] of world.kills ?? []) {
    const a9 = killBy9.get(kd9);
    if (a9) a9.push(ks9, ko9, kt9); else killBy9.set(kd9, [ks9, ko9, kt9]);
  }
  /** 그 태그를 그 순간 죽인 [임자, 유닛 종류] — 처치 절, 없으면 창 안에서 가장 많이 겨눈 적(그 임자가 가장 많이 겨눈 유닛 종류). 없으면 [-1, ""]. */
  const killerOf9 = (tag9: number, sec9: number, mine9: number): [number, string, number] => {
    const k9 = killBy9.get(tag9);
    if (k9) for (let i9 = 0; i9 < k9.length; i9 += 3) {
      if (Math.abs(k9[i9] - sec9) <= 1 && k9[i9 + 1] !== mine9) return [k9[i9 + 1], k9[i9 + 2] ? kindAt9(k9[i9 + 2], k9[i9]) : "", k9[i9 + 2] || -1];
    }
    const a9 = aim9.get(tag9);
    if (!a9) return [-1, "", -1];
    let best9 = -1;
    let bn9 = 0;
    let bk9 = "";
    for (let i9 = 0; i9 < a9.length; i9 += 3) {
      const s9 = a9[i9];
      const o9 = a9[i9 + 1];
      if (s9 < sec9 - KILL_W9 || s9 > sec9 + 0.5 || o9 === mine9) continue;
      let n9 = 0;
      const kn9 = new Map<number, number>();
      for (let j9 = 1; j9 < a9.length; j9 += 3) {
        if (a9[j9] !== o9) continue;
        const sj9 = a9[j9 - 1];
        if (sj9 >= sec9 - KILL_W9 && sj9 <= sec9 + 0.5) { n9 += 1; kn9.set(a9[j9 + 1], (kn9.get(a9[j9 + 1]) ?? 0) + 1); }
      }
      if (n9 > bn9) {
        best9 = o9; bn9 = n9;
        let bc9 = 0;
        for (const [id9, c9] of kn9) if (c9 > bc9) { bc9 = c9; bk9 = kindNames9[id9]; }
      }
    }
    return [best9, bk9, -1];
  };
  /** ★ 사이오닉 스톰에 죽은 몸 — 겨눈 자가 없으니 killerOf9 는 모른다. 죽은 자리 6타일 · 3초 안에 적이 내린 스톰이 있으면 그 임자의 **하이템플러** 킬(2026-10-09). */
  const stormBy9 = (sec9: number, x9: number | undefined, y9: number | undefined, mine9: number): number => {
    if (x9 === undefined || y9 === undefined) return -1;
    for (const [cs9, cx9, cy9, tech9, co9] of world.casts) {
      if (tech9 !== "Psionic Storm" || co9 === mine9 || Math.abs(cs9 - sec9) > 3) continue;
      if (Math.hypot(cx9 - x9, cy9 - y9) <= 6) return co9;
    }
    return -1;
  };

  /** 죽음 한 벌 — 한꺼번에 사라지는 '나감'을 걸러 내려고 먼저 모은다. */
  type D9 = { sec: number; owner: number; v: number; bld: boolean; killer: number; ktag: number; wk: boolean; wkw?: string; x?: number; y?: number; kind: string; by: string; tag?: number };

  /** 죽은 자리(타일) — 건물은 제 자리(bornX/Y · 앉은 자리가 여럿이면 마지막) · 유닛은 죽기 전 `LOC_W9` 초 안의 마지막 명령
   *  자리(참값 생애는 죽은 자리를 안 든다 — 명령이 '어디에 가 있었나'의 가장 가까운 어림이다) · 그도 없으면 막 태어난 몸의
   *  태어난 자리 · 모르면 null. */
  const deadAt9 = (e9: (typeof world.lives)[number], sec9: number): { x: number; y: number } | null => {
    /* ★ 생애가 **마지막 키의 자리**를 들면 그것이 죽은 자리다(2026-10-11, 지적: "처들어온 걸 방어한 건데 자막은 공격한 걸로 반대로") — 명령 자리 어림은 물러나라는
       명령을 받고 쫓겨 죽은 몸을 **제 본진**(물러날 자리)에서 죽은 것으로 읽어, 막아 낸 사람이 그 본진에 쳐들어간 공격자가 됐다. */
    if (!e9.bld && e9.endX !== undefined && e9.endY !== undefined && e9.died !== null && Math.abs(e9.died - sec9) <= 1) return { x: e9.endX, y: e9.endY };
    if (e9.bld) {
      const s9 = e9.sites.length > 1 ? e9.sites[e9.sites.length - 1] : null;
      return s9 ? { x: s9[1] + 1, y: s9[2] + 1 } : { x: e9.bornX, y: e9.bornY };
    }
    for (let i9 = e9.orders.length - 1; i9 >= 0; i9 -= 1) {
      const o9 = e9.orders[i9];
      if (o9[0] > sec9) continue;
      if (o9[0] >= sec9 - LOC_W9) return { x: o9[1], y: o9[2] };
      break;
    }
    return sec9 - e9.born <= LOC_W9 ? { x: e9.bornX, y: e9.bornY } : null;
  };
  /** 그 앞 아무 때의 마지막 명령 자리 — 일꾼의 죽은 자리 되짚기(정찰 보낸 자리). */
  const lastOrderAt9 = (e9: (typeof world.lives)[number], sec9: number): { x: number; y: number } | null => {
    for (let i9 = e9.orders.length - 1; i9 >= 0; i9 -= 1) if (e9.orders[i9][0] <= sec9) return { x: e9.orders[i9][1], y: e9.orders[i9][2] };
    return null;
  };
  /** 사람 → 출발 자리(그 사람의 가장 먼저 난 건물 · 분할 칸 배치의 splitStart9 와 같은 자). */
  const start9 = new Map<string, { x: number; y: number; t: number }>();
  for (const e9 of world.lives) {
    if (!e9.bld) continue;
    const r9 = rawOf9.get(e9.owner);
    if (!r9) continue;
    const s9 = start9.get(r9);
    if (!s9 || e9.born < s9.t) start9.set(r9, { x: e9.bornX, y: e9.bornY, t: e9.born });
  }
  /** 그 임자의 **살아 있는 본진 건물** 자리(확장 포함) — 기지 싸움(baseRole9)·프록시 건물 가름·드랍의 자. */
  const HALL_ANY9 = new Set(["Command Center", "Nexus", "Hatchery", "Lair", "Hive"]);
  /** 시작 본진의 태그(2026-10-11 뚝배기) — 경기 첫 순간(2초 안)에 선 본진 건물. 레어·하이브 변태는 같은 태그를 이어 쓰므로 그대로 시작 본진이다. */
  const startHallTags9 = new Set<number>();
  for (const e9 of world.lives) if (e9.bld && e9.born <= 2 && HALL_ANY9.has(e9.kind)) startHallTags9.add(e9.tag);
  const BASE_R9 = 18;
  /* ★★ **기지 영역은 벽·언덕으로 가른다**(2026-10-11, 지적: "기지 영역 판단이 잘 안 돼서 그런 듯 — 벽이나 언덕으로 구분해야 하는데 그게 잘 안 되니 기지 공격을 그냥 공격이나
     교전으로 보고 맥이 계속 끊긴다") — 옛 자는 본진 건물에서 BASE_R9(18) 타일 원이라, 넓은 본진 언덕의 구석·입구 램프는 밖으로, 절벽 아래 남의 땅은 안으로 읽혔다.
     ★ **입구는 뚫려 있고 둘 이상이기도 하다**(같은 날: "입구는 뚫려 있지 · 입구(램프)가 두 개 이상이기도 하고") — 벽·고도만으로 넘쳐 채우면 같은 고도로 열린 입구(길목)로
     새어 나가 열린 땅으로 읽혔다. 이제:
       ① 막힘 = 못 걷는 칸 · 딴 고도 · 램프. 막힘에서의 거리(클리어런스 · 8이웃)를 잰다.
       ② 본진 건물 곁 가장 넓은 칸에서 **클리어런스 BASE_CORE9 이상인 칸만** 넘쳐 채운다 — 폭이 2×BASE_CORE9 아래인 길목(입구)에서 끊긴다(입구가 몇이든 다).
       ③ 그 알맹이를 같은 고도 칸으로 BASE_CORE9−1 걸음 불려 벽 곁 가장자리를 되찾고(길목 안으로는 그만큼만),
       ④ 가장자리에서 BASE_GATE9 걸음(어느 고도든 · 램프 포함)을 붙인다 — 모든 램프·길목 앞이 기지 입구다.
     알맹이가 BASE_OPEN9 원까지 새어 나가면 열린 땅(벌판 확장)이라 BASE_R9 원으로, 닫혔으면 BASE_RMAX9 까지. 지형이 없으면 옛 원. */
  const BASE_RMAX9 = 32;
  /** 열린 땅 가름 — 알맹이 넘쳐 채움이 이 원에 막히면 열린 땅이다. */
  const BASE_OPEN9 = 48;
  const BASE_GATE9 = 7;   // 4 → 7(같은 날 ㊱) — 램프·길목의 길이(2~3)를 지나 그 앞 4칸까지
  /** 길목에서 끊는 클리어런스 — 폭 7 칸 안팎 아래의 길목이 경계가 된다. */
  const BASE_CORE9 = 4;
  const areaCache9 = new Map<number, Set<number> | null>();
  const areaOf9 = (hx9: number, hy9: number): Set<number> | null => {
    const tr9 = opts.terrain;
    const W9 = opts.mapW ?? 0; const H9 = opts.mapH ?? 0;
    if (!tr9 || !(W9 > 0) || !(H9 > 0)) return null;
    const cx9 = Math.floor(hx9); const cy9 = Math.floor(hy9);
    const key9 = cy9 * W9 + cx9;
    if (areaCache9.has(key9)) return areaCache9.get(key9)!;
    const cnt9 = new Map<number, number>();
    for (let dy9 = -3; dy9 <= 3; dy9 += 1) for (let dx9 = -3; dx9 <= 3; dx9 += 1) {
      if (tr9.walk(cx9 + dx9, cy9 + dy9)) { const lv9 = tr9.level(cx9 + dx9, cy9 + dy9); cnt9.set(lv9, (cnt9.get(lv9) ?? 0) + 1); }
    }
    let lv9 = -1; let ln9 = 0;
    for (const [l9, n9] of cnt9) if (n9 > ln9) { ln9 = n9; lv9 = l9; }
    if (lv9 < 0) { areaCache9.set(key9, null); return null; }
    /* 상자(본진 건물 둘레 BASE_OPEN9 + 여유) 안에서만 잰다. */
    const R9 = BASE_OPEN9 + BASE_CORE9 + 2;
    const x09 = Math.max(0, cx9 - R9); const y09 = Math.max(0, cy9 - R9);
    const x19 = Math.min(W9 - 1, cx9 + R9); const y19 = Math.min(H9 - 1, cy9 + R9);
    const bw9 = x19 - x09 + 1; const bh9 = y19 - y09 + 1;
    const li9 = (x9: number, y9: number): number => (y9 - y09) * bw9 + (x9 - x09);
    const same9 = (x9: number, y9: number): boolean => tr9.walk(x9, y9) && tr9.level(x9, y9) === lv9 && !tr9.ramp?.(x9, y9);
    /* ① 클리어런스 — 막힘(과 지도 밖)에서 8이웃 걸음. 상자 가장자리는 막힘이 아니다(모른다 · 열린 쪽으로 둔다). */
    const clr9 = new Int16Array(bw9 * bh9).fill(-1);
    const cq9: number[] = [];
    for (let y9 = y09; y9 <= y19; y9 += 1) for (let x9 = x09; x9 <= x19; x9 += 1) {
      if (!same9(x9, y9)) { clr9[li9(x9, y9)] = 0; cq9.push(li9(x9, y9)); continue; }
      if (x9 === 0 || y9 === 0 || x9 === W9 - 1 || y9 === H9 - 1) { clr9[li9(x9, y9)] = 1; cq9.push(li9(x9, y9)); }
    }
    for (let qi9 = 0; qi9 < cq9.length; qi9 += 1) {
      const k9 = cq9[qi9]; const x9 = (k9 % bw9) + x09; const y9 = Math.floor(k9 / bw9) + y09;
      for (let dy9 = -1; dy9 <= 1; dy9 += 1) for (let dx9 = -1; dx9 <= 1; dx9 += 1) {
        const nx9 = x9 + dx9; const ny9 = y9 + dy9;
        if (nx9 < x09 || ny9 < y09 || nx9 > x19 || ny9 > y19) continue;
        const n9 = li9(nx9, ny9);
        if (clr9[n9] >= 0) continue;
        clr9[n9] = clr9[k9] + 1; cq9.push(n9);
      }
    }
    const cl9 = (x9: number, y9: number): number => { const v9 = clr9[li9(x9, y9)]; return v9 < 0 ? 99 : v9; };
    const d9 = (x9: number, y9: number): number => Math.hypot(x9 + 0.5 - hx9, y9 + 0.5 - hy9);
    /* ② 알맹이 — 곁 5 타일 안 가장 넓은 칸에서. */
    let sx9 = -1; let sy9 = -1; let sb9 = 0;
    for (let dy9 = -5; dy9 <= 5; dy9 += 1) for (let dx9 = -5; dx9 <= 5; dx9 += 1) {
      const x9 = cx9 + dx9; const y9 = cy9 + dy9;
      if (x9 < x09 || y9 < y09 || x9 > x19 || y9 > y19 || !same9(x9, y9)) continue;
      if (cl9(x9, y9) > sb9) { sb9 = cl9(x9, y9); sx9 = x9; sy9 = y9; }
    }
    if (sx9 < 0) { areaCache9.set(key9, null); return null; }
    const core9 = Math.min(BASE_CORE9, sb9);
    const area9 = new Set<number>([sy9 * W9 + sx9]);
    const q9: number[] = [sy9 * W9 + sx9];
    let rim9 = 0;
    for (let qi9 = 0; qi9 < q9.length; qi9 += 1) {
      const i9 = q9[qi9]; const x9 = i9 % W9; const y9 = Math.floor(i9 / W9);
      for (const [nx9, ny9] of [[x9 + 1, y9], [x9 - 1, y9], [x9, y9 + 1], [x9, y9 - 1]]) {
        if (nx9 < x09 || ny9 < y09 || nx9 > x19 || ny9 > y19) continue;
        const j9 = ny9 * W9 + nx9;
        if (area9.has(j9) || !same9(nx9, ny9) || cl9(nx9, ny9) < core9) continue;
        if (d9(nx9, ny9) > BASE_OPEN9) { rim9 += 1; continue; }
        area9.add(j9); q9.push(j9);
      }
    }
    /* ③ 알맹이를 같은 고도로 불린다(벽 곁 가장자리) — 길목 안으로는 core−1 걸음뿐. */
    const grow9 = (steps9: number, ok9: (x9: number, y9: number) => boolean): void => {
      let front9 = [...area9];
      for (let g9 = 0; g9 < steps9; g9 += 1) {
        const next9: number[] = [];
        for (const i9 of front9) {
          const x9 = i9 % W9; const y9 = Math.floor(i9 / W9);
          for (const [nx9, ny9] of [[x9 + 1, y9], [x9 - 1, y9], [x9, y9 + 1], [x9, y9 - 1]]) {
            if (nx9 < 0 || ny9 < 0 || nx9 >= W9 || ny9 >= H9) continue;
            const j9 = ny9 * W9 + nx9;
            if (area9.has(j9) || !ok9(nx9, ny9)) continue;
            area9.add(j9); next9.push(j9);
          }
        }
        front9 = next9;
      }
    };
    grow9(core9 - 1, same9);
    /* 닫힌 언덕이면 BASE_RMAX9 까지 · 열린 땅이면 BASE_R9 원으로 자른다(벌판 확장 · 낮은 땅 본진). */
    const cut9 = rim9 > 6 ? BASE_R9 : BASE_RMAX9;
    for (const i9 of [...area9]) if (d9(i9 % W9, Math.floor(i9 / W9)) > cut9) area9.delete(i9);
    /* ④ 입구 — 모든 가장자리에서 걸을 수 있는 칸(어느 고도든 · 램프 포함)으로 BASE_GATE9 걸음. */
    grow9(BASE_GATE9, (x9, y9) => tr9.walk(x9, y9));
    areaCache9.set(key9, area9);
    return area9;
  };
  /** 그 자리가 (hx, hy) 본진 건물의 기지 영역 안인가 — 지형 영역(위 ★★) · 지형이 없으면 BASE_R9 원. */
  const inBaseArea9 = (hx9: number, hy9: number, x9: number, y9: number): boolean => {
    const a9 = areaOf9(hx9, hy9);
    if (!a9) return Math.hypot(hx9 - x9, hy9 - y9) <= BASE_R9;
    return a9.has(Math.floor(y9) * (opts.mapW ?? 0) + Math.floor(x9));
  };
  const hallsOfOwner9 = (owners9: ReadonlySet<number>, sec9: number): [number, number][] => {
    const out9: [number, number][] = [];
    for (const e9 of world.lives) {
      if (e9.bld && owners9.has(e9.owner) && HALL_ANY9.has(e9.kind) && e9.born <= sec9 && (e9.died === null || e9.died > sec9)) out9.push([e9.bornX, e9.bornY]);
    }
    return out9;
  };
  /** 그 건물이 제 임자의 기지(본진 건물 BASE_R9 안)에 있었나 — 자리를 모르거나 본진이 하나도 없으면 참(프록시로 안 본다). */
  const atOwnBase9 = (owner9: number, x9: number | undefined, y9: number | undefined, sec9: number): boolean => {
    if (x9 === undefined || y9 === undefined) return true;
    const halls9 = hallsOfOwner9(new Set([owner9]), sec9);
    return halls9.length === 0 || halls9.some(([hx9, hy9]) => inBaseArea9(hx9, hy9, x9, y9));
  };
  /** 일꾼이 **제 기지에서** 죽었나 — 제 본진 건물 BASE_R9 안이고, 죽인 사람의 본진 건물이 더 가깝지 않을 때(빨무처럼 기지가 붙은 맵). 제 본진 건물이 없으면 아니다. */
  const workerAtHome9 = (owner9: number, killer9: number, x9: number, y9: number, sec9: number): boolean => {
    const near9 = (o9: number): number => Math.min(Infinity, ...hallsOfOwner9(new Set([o9]), sec9).map(([hx9, hy9]) => Math.hypot(hx9 - x9, hy9 - y9)));
    if (hallsOfOwner9(new Set([owner9]), sec9).length === 0) return true;   // 본진 건물을 모르면(옛 판 · 합성 판) 옛 셈대로 제 기지
    const mine9 = near9(owner9);
    if (!hallsOfOwner9(new Set([owner9]), sec9).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, x9, y9))) return false;
    return killer9 < 0 || !(near9(killer9) < mine9);
  };
  /** 기지 밖에서 잡힌 일꾼의 갈래 — 제 짓는 중인 건물(기지 밖) FWD_R9 타일 안이면 "전진 건설" · 죽인 사람의 기지 안이면 "정찰" · 그 밖 "". */
  const FWD_R9 = 6;
  const workerOut9 = (owner9: number, killer9: number, x9: number, y9: number, sec9: number): string => {
    for (const b9 of world.lives) {
      if (!b9.bld || b9.owner !== owner9 || b9.born > sec9 || (b9.doneAt ?? b9.born) < sec9 - 2) continue;
      if (Math.hypot(b9.bornX - x9, b9.bornY - y9) > FWD_R9) continue;
      if (atOwnBase9(owner9, b9.bornX, b9.bornY, sec9) && hallsOfOwner9(new Set([owner9]), sec9).length > 0) continue;
      /* 전진 건물의 자와 같다 — 적 기지 앞·안(PROXY_FRONT9)이고 제 기지(멀티 포함)보다 훨씬(PROXY_FAR9) 가까울 때만. */
      const ownD9 = Math.min(Infinity, ...hallsOfOwner9(new Set([owner9]), sec9).map(([hx9, hy9]) => Math.hypot(hx9 - b9.bornX, hy9 - b9.bornY)));
      let foeD9 = Infinity;
      for (const [o9] of rawOf9) {
        if (o9 === owner9 || (opts.teamOf?.[rawOf9.get(o9)!] !== undefined && opts.teamOf?.[rawOf9.get(o9)!] === opts.teamOf?.[rawOf9.get(owner9) ?? ""])) continue;
        for (const [hx9, hy9] of hallsOfOwner9(new Set([o9]), sec9)) foeD9 = Math.min(foeD9, Math.hypot(hx9 - b9.bornX, hy9 - b9.bornY));
      }
      if (!(foeD9 <= PROXY_FRONT9) || !(ownD9 > foeD9 * PROXY_FAR9)) continue;
      return "전진 건설";
    }
    if (killer9 >= 0 && hallsOfOwner9(new Set([killer9]), sec9).length > 0 && atOwnBase9(killer9, x9, y9, sec9)) return "정찰";
    return "";
  };
  /* ── 전술 읽기(2026-10-10, 요청: "센터 포토/벙커/터렛 · 센터 장악 · 상대 입구 막기 · 옆탱 · 언덕탱 · 오버로드 사냥 · 입구럴커") ───────────────
     자리는 **그 순간 마지막 명령 자리**(posAt9 — 참값 생애는 자리 자취를 안 들고 명령만 든다)다. 지형(opts.terrain)이 있어야 언덕·벽·램프를 본다. */
  const posAt9 = (e9: (typeof world.lives)[number], sec9: number): [number, number] => {
    let x9 = e9.bornX; let y9 = e9.bornY;
    for (const o9 of e9.orders) { if (o9[0] > sec9) break; x9 = o9[1]; y9 = o9[2]; }
    return [x9, y9];
  };
  const mapC9 = opts.mapW && opts.mapH ? { x: opts.mapW / 2, y: opts.mapH / 2, s: Math.min(opts.mapW, opts.mapH) } : null;
  /** 태그 → 생애들(변태로 갈린 생애가 같은 태그를 나눠 쓴다). */
  const livesByTag9 = new Map<number, (typeof world.lives)[number][]>();
  for (const e9 of world.lives) { const a9 = livesByTag9.get(e9.tag); if (a9) a9.push(e9); else livesByTag9.set(e9.tag, [e9]); }
  const inCenter9 = (x9: number, y9: number, k9: number): boolean => !!mapC9 && Math.hypot(x9 - mapC9.x, y9 - mapC9.y) <= mapC9.s * k9;
  /** 적(다른 편) 임자 번호들. */
  const foeOwners9 = (raw9: string): number[] => [...rawOf9.entries()]
    .filter(([, r9]) => r9 !== raw9 && !(opts.teamOf?.[r9] !== undefined && opts.teamOf?.[r9] === opts.teamOf?.[raw9])).map(([o9]) => o9);
  /** 두 자리 사이에 못 걷는 칸(벽·절벽)이 끼었나 — 반 타일 간격으로 짚는다. */
  const wallBetween9 = (ax9: number, ay9: number, bx9: number, by9: number): boolean => {
    const tr9 = opts.terrain;
    if (!tr9) return false;
    const n9 = Math.ceil(Math.hypot(bx9 - ax9, by9 - ay9) * 2);
    for (let i9 = 1; i9 < n9; i9 += 1) {
      const u9 = i9 / n9;
      if (!tr9.walk(Math.floor(ax9 + (bx9 - ax9) * u9), Math.floor(ay9 + (by9 - ay9) * u9))) return true;
    }
    return false;
  };
  /** ★ 그 자리의 **고도 = 둘레 5×5 걸을 수 있는 칸의 가장 흔한 고도**(2026-10-11, 지적: "높이는 같고 사이에 벽이 있는데 언덕탱으로 나왔어 — 높은 땅을 잘못 판정") — 옛 판은
   *  타일 한 칸만 읽어, 탱크 자리(마지막 명령 자리)나 건물 가운데 칸이 절벽 가장자리·딴 고도 표시 칸이면 같은 높이를 한 단 높게 읽었다. 걸을 칸이 없으면 그 칸 하나. */
  const levelNear9 = (x9: number, y9: number): number => {
    const tr9 = opts.terrain;
    if (!tr9) return 0;
    const cx9 = Math.floor(x9); const cy9 = Math.floor(y9);
    const cnt9 = [0, 0, 0, 0];
    for (let dy9 = -2; dy9 <= 2; dy9 += 1) for (let dx9 = -2; dx9 <= 2; dx9 += 1) {
      if (!tr9.walk(cx9 + dx9, cy9 + dy9)) continue;
      const lv9 = tr9.level(cx9 + dx9, cy9 + dy9);
      if (lv9 >= 0 && lv9 <= 3) cnt9[lv9] += 1;
    }
    let best9 = -1; let bn9 = 0;
    for (let i9 = 0; i9 < 4; i9 += 1) if (cnt9[i9] > bn9) { bn9 = cnt9[i9]; best9 = i9; }
    return best9 >= 0 ? best9 : tr9.level(cx9, cy9);
  };
  /** 그 자리 r 타일 안에 램프가 있나. */
  const rampNear9 = (x9: number, y9: number, r9: number): boolean => {
    const ramp9 = opts.terrain?.ramp;
    if (!ramp9) return false;
    for (let dy9 = -r9; dy9 <= r9; dy9 += 1) for (let dx9 = -r9; dx9 <= r9; dx9 += 1) {
      if (dx9 * dx9 + dy9 * dy9 <= r9 * r9 && ramp9(Math.floor(x9) + dx9, Math.floor(y9) + dy9)) return true;
    }
    return false;
  };
  /** 한 자리에 SETTLE9 초 넘게 머문 몸의 [초, x, y] — 다음 명령까지(또는 죽기·끝까지) 그 자리다(럴커 입구 판정). */
  const SETTLE9 = 20;
  const settles9 = (e9: (typeof world.lives)[number]): [number, number, number][] => {
    const out9: [number, number, number][] = [];
    const end9 = e9.died ?? total;
    for (let i9 = 0; i9 < e9.orders.length; i9 += 1) {
      const [t9, x9, y9] = e9.orders[i9];
      const next9 = i9 + 1 < e9.orders.length ? e9.orders[i9 + 1][0] : end9;
      if (next9 - t9 >= SETTLE9) out9.push([t9, x9, y9]);
    }
    return out9;
  };
  type Tactic9 = { at: number; caps: CapPart9[]; short?: string };
  /** 제 입구를 막는 건물(심시티 — 테란 서플라이·배럭·엔베 · 토스 파일런·게이트·포지·코어·캐논 · 저그 에볼·스포닝풀·크립/성큰·해처리). */
  const WALL_BLD9 = new Set(["Supply Depot", "Barracks", "Engineering Bay", "Factory", "Bunker", "Academy", "Pylon", "Gateway", "Forge", "Cybernetics Core",
    "Photon Cannon", "Evolution Chamber", "Spawning Pool", "Creep Colony", "Sunken Colony", "Hatchery"]);
  /** 막는 건물이 제 기지(본진 건물·출발 자리)에서 BASE_R9 + near 안 · 갇힌 넓이 하한(칸) · 곁 절벽을 찾는 반경(타일). */
  const WALL9 = { near: 10, area: 300, cliff: 4 };
  const tacticsMemo9 = new Map<string, Tactic9[]>();
  const TACTIC_DEDUP9 = 120;
  const tacticsOf9 = (raw9: string): Tactic9[] => {
    const got9 = tacticsMemo9.get(raw9);
    if (got9) return got9;
    const own9 = new Set([...rawOf9.entries()].filter(([, r9]) => r9 === raw9).map(([o9]) => o9));
    const foes9 = new Set(foeOwners9(raw9));
    const out9: Tactic9[] = [];
    const lastAt9 = new Map<string, number>();
    const add9 = (key9: string, t9: number, caps9: CapPart9[], short9?: string): void => {
      const l9 = lastAt9.get(key9);
      if (l9 !== undefined && t9 - l9 < TACTIC_DEDUP9) return;
      lastAt9.set(key9, t9);
      out9.push({ at: t9, caps: caps9, ...(short9 ? { short: short9 } : {}) });
    };
    const tr9 = opts.terrain;
    const st9 = start9.get(raw9);
    /** 그 자리에서 가장 가까운 적 출발 자리·본진 건물(이름 · 거리 · 자리). */
    const nearFoeBase9 = (x9: number, y9: number, sec9: number): { raw: string; d: number; x: number; y: number } | null => {
      let best9: { raw: string; d: number; x: number; y: number } | null = null;
      for (const o9 of foes9) {
        const r9 = rawOf9.get(o9)!;
        const pts9: [number, number][] = [...hallsOfOwner9(new Set([o9]), sec9)];
        const s9 = start9.get(r9); if (s9) pts9.push([s9.x, s9.y]);
        for (const [hx9, hy9] of pts9) { const d9 = Math.hypot(hx9 - x9, hy9 - y9); if (!best9 || d9 < best9.d) best9 = { raw: r9, d: d9, x: hx9, y: hy9 }; }
      }
      return best9;
    };
    for (const e9 of world.lives) {
      if (!own9.has(e9.owner)) continue;
      /* 탱크 — 박은 자리에서 12 타일 안의 가장 가까운 적 건물을 본다. 적 기지 밖에서 벽 너머로 → 옆탱(그 무렵 제 건물을 띄웠으면 시야 확보 · 고도 무관 · 먼저) · 그 밖에서 언덕(제 고도가 더 높다) → 언덕탱. */
      if (e9.kind.startsWith("Siege Tank") && tr9) {
        for (const [ts9, on9] of e9.sieges) {
          if (!on9) continue;
          const [px9, py9] = posAt9(e9, ts9);
          let tgt9: (typeof world.lives)[number] | null = null; let td9 = 12;
          for (const b9 of world.lives) {
            if (!b9.bld || !foes9.has(b9.owner) || b9.born > ts9 || (b9.died !== null && b9.died <= ts9)) continue;
            const d9 = Math.hypot(b9.bornX - px9, b9.bornY - py9);
            if (d9 <= td9) { td9 = d9; tgt9 = b9; }
          }
          if (!tgt9) continue;
          const foe9 = rawOf9.get(tgt9.owner)!;
          /* ★ **옆탱이 먼저**(2026-10-11, 지적: "옆탱을 언덕탱으로 나오네 — 옆탱은 벽 너머로 때리는 거") — 옛 차례는 고도부터 봐서, 적 기지 옆 높은 땅에서 벽(절벽) 너머로
             기지 안을 때리는 옆탱이 "언덕탱"이 됐다. 이제 적 기지 밖에서 벽 너머 그 기지 안을 치면 고도와 무관하게 옆탱 · 그 밖에서 제 고도가 더 높을 때만 언덕탱. */
          const fb9 = nearFoeBase9(tgt9.bornX, tgt9.bornY, ts9);
          const tankOut9 = !fb9 || Math.hypot(fb9.x - px9, fb9.y - py9) > BASE_R9;
          if (fb9 && fb9.d <= BASE_R9 && tankOut9 && wallBetween9(px9, py9, tgt9.bornX, tgt9.bornY)) {
            const lift9 = world.lives.some((b9) => b9.bld && own9.has(b9.owner) && b9.lifts.some((l9) => l9 >= ts9 - 90 && l9 <= ts9 + 10));
            add9(`side|${foe9}`, ts9, [{ raw: raw9, p: "ga" }, { text: " " }, { raw: foe9 }, { text: lift9 ? " 기지에 옆탱 · 건물 띄워 시야 확보" : " 기지에 옆탱" }], "옆탱");
            continue;
          }
          if (levelNear9(px9, py9) > levelNear9(tgt9.bornX, tgt9.bornY)) {
            add9(`hill|${foe9}`, ts9, [{ raw: raw9, p: "ga" }, { text: " 언덕탱으로 " }, { raw: foe9, p: "eul" }, { text: " 공격" }], "언덕탱");
          }
        }
      }
      /* 상대 입구 막기 — 포토·럴커가 적 기지 바로 바깥(BASE_R9 ~ +12)에, 지형이 있으면 램프 곁(6 타일)에 선 것. */
      const blockAt9 = (t9: number, x9: number, y9: number): void => {
        const fb9 = nearFoeBase9(x9, y9, t9);
        if (!fb9 || fb9.d <= BASE_R9 - 4 || fb9.d > BASE_R9 + 12) return;
        if (tr9?.ramp && !rampNear9(x9, y9, 6)) return;
        add9(`block|${fb9.raw}`, t9, [{ raw: raw9, p: "ga" }, { text: " " }, { raw: fb9.raw }, { text: e9.kind === "Lurker" ? " 입구를 럴커로 막음" : " 입구를 포토로 막음" }], "입구 막기");
      };
      if (e9.bld && e9.kind === "Photon Cannon") blockAt9(e9.born, e9.bornX, e9.bornY);
      if (e9.kind === "Lurker") {
        for (const [t9, x9, y9] of settles9(e9)) {
          blockAt9(t9, x9, y9);
          /* 입구럴커 — 제 본진 안쪽 가장자리(출발 자리 8 ~ BASE_R9+4 · 본진과 같은 고도 · 램프 5 타일 안). 지형이 있을 때만. */
          if (tr9?.ramp && st9) {
            const d9 = Math.hypot(st9.x - x9, st9.y - y9);
            if (d9 >= 8 && d9 <= BASE_R9 + 4 && levelNear9(x9, y9) === levelNear9(st9.x, st9.y) && rampNear9(x9, y9, 5)) {
              add9("homeLurker", t9, [{ raw: raw9 }, { text: " 입구 럴커로 방어" }], "입구 럴커");
            }
          }
        }
      }
    }
    /* 탱크 조이기·메카닉 조이기(2026-10-10, 요청) — 제 기지 밖이고 적 기지가 더 가까운 자리에 PUSH9.win 초 안에 서로 다른 탱크가 PUSH9.tanks 대 넘게 박으면.
       그때 살아 있는 벌처·골리앗이 PUSH9.mech 넘으면 메카닉 조이기. */
    const pushes9: [number, number][] = [];
    for (const e9 of world.lives) {
      if (!own9.has(e9.owner) || !e9.kind.startsWith("Siege Tank")) continue;
      for (const [ts9, on9] of e9.sieges) {
        if (!on9) continue;
        const [px9, py9] = posAt9(e9, ts9);
        const ownD9 = Math.min(Infinity, ...[...hallsOfOwner9(own9, ts9), ...(st9 ? [[st9.x, st9.y] as [number, number]] : [])].map(([hx9, hy9]) => Math.hypot(hx9 - px9, hy9 - py9)));
        const fb9 = nearFoeBase9(px9, py9, ts9);
        if (fb9 && ownD9 > BASE_R9 && fb9.d < ownD9) pushes9.push([ts9, e9.tag]);
      }
    }
    pushes9.sort((a9, b9) => a9[0] - b9[0]);
    for (let i9 = 0; i9 < pushes9.length; i9 += 1) {
      const tanks9 = new Set<number>();
      for (let j9 = i9; j9 < pushes9.length && pushes9[j9][0] - pushes9[i9][0] <= PUSH9.win; j9 += 1) tanks9.add(pushes9[j9][1]);
      if (tanks9.size < PUSH9.tanks) continue;
      const t9 = pushes9[i9][0];
      let mech9 = 0;
      for (const e9 of world.lives) {
        if (own9.has(e9.owner) && (e9.kind === "Vulture" || e9.kind === "Goliath") && e9.born <= t9 && (e9.died === null || e9.died > t9)) mech9 += 1;
      }
      const name9 = mech9 >= PUSH9.mech ? "메카닉 조이기" : "탱크 조이기";
      add9("push", t9, [{ raw: raw9 }, { text: ` ${name9}` }], name9);
    }
    /* ★ 제 입구 막기(심시티 · 2026-10-11, 요청: "자신의 입구를 건물로 막아서 적들이 못 들어오게 하는 게 중요한 포인트인데 그건 안 나오네") — 제 기지 곁(본진 건물·출발
       자리에서 BASE_R9 + WALL9.near)에 막는 건물(WALL_BLD9)이 설 때마다, 지형 위에 그 순간 제 건물 발자국(BUILDING_FOOT)을 얹고 **출발 자리에서 적 출발 자리까지 길이
       끊기나** 본다. 길은 2×2 칸이 비어야 지나간다(한 칸 틈 = 막힘 — 질럿 하나로 메우는 토스 입구도 막은 것이다). 지형만으로는 이어지고 · 갇힌 넓이가 WALL9.area 칸
       넘어야(본진 건물을 둘러싼 작은 주머니가 아니라 기지 하나) 막은 것이다. 글귀는 그 둘레 WALL9.near 타일 안 제 막는 건물 이름("[A] 배럭·서플라이로 입구 막음"). */
    const W9 = opts.mapW ?? 0; const H9 = opts.mapH ?? 0;
    if (tr9 && st9 && W9 > 0 && H9 > 0 && W9 * H9 <= 512 * 512) {
      const foeSt9 = [...new Set([...foes9].map((o9) => rawOf9.get(o9)!))].map((r9) => start9.get(r9)).filter((p9): p9 is NonNullable<typeof p9> => !!p9);
      const walk9 = new Uint8Array(W9 * H9);
      for (let y9 = 0; y9 < H9; y9 += 1) for (let x9 = 0; x9 < W9; x9 += 1) walk9[y9 * W9 + x9] = tr9.walk(x9, y9) ? 1 : 0;
      /** 2×2 칸(그 칸과 오른쪽·아래)이 다 비었나. */
      const fits9 = (g9: Uint8Array, x9: number, y9: number): boolean => x9 >= 0 && y9 >= 0 && x9 + 1 < W9 && y9 + 1 < H9
        && g9[y9 * W9 + x9] === 1 && g9[y9 * W9 + x9 + 1] === 1 && g9[(y9 + 1) * W9 + x9] === 1 && g9[(y9 + 1) * W9 + x9 + 1] === 1;
      /** 자리 곁(4 타일) 가장 가까운 지나갈 수 있는 칸. */
      const seed9 = (g9: Uint8Array, px9: number, py9: number): number => {
        let best9 = -1; let bd9 = Infinity;
        for (let dy9 = -4; dy9 <= 4; dy9 += 1) for (let dx9 = -4; dx9 <= 4; dx9 += 1) {
          const x9 = Math.floor(px9) + dx9; const y9 = Math.floor(py9) + dy9;
          if (fits9(g9, x9, y9) && dx9 * dx9 + dy9 * dy9 < bd9) { bd9 = dx9 * dx9 + dy9 * dy9; best9 = y9 * W9 + x9; }
        }
        return best9;
      };
      /** 출발 자리에서 2×2 로 닿는 칸들(넓이 · 닿은 표). */
      const flood9 = (g9: Uint8Array, from9: number): Uint8Array => {
        const seen9 = new Uint8Array(W9 * H9);
        if (from9 < 0) return seen9;
        const q9 = [from9]; seen9[from9] = 1;
        while (q9.length > 0) {
          const i9 = q9.pop()!; const x9 = i9 % W9; const y9 = (i9 - x9) / W9;
          for (const [dx9, dy9] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx9 = x9 + dx9; const ny9 = y9 + dy9; const j9 = ny9 * W9 + nx9;
            if (nx9 < 0 || ny9 < 0 || nx9 >= W9 || ny9 >= H9 || seen9[j9] || !fits9(g9, nx9, ny9)) continue;
            seen9[j9] = 1; q9.push(j9);
          }
        }
        return seen9;
      };
      const reaches9 = (g9: Uint8Array, seen9: Uint8Array): boolean => foeSt9.some((f9) => { const j9 = seed9(g9, f9.x, f9.y); return j9 >= 0 && seen9[j9] === 1; });
      const open9 = foeSt9.length > 0 && reaches9(walk9, flood9(walk9, seed9(walk9, st9.x, st9.y)));
      const ownBlds9 = world.lives.filter((e9) => e9.bld && own9.has(e9.owner) && BUILDING_FOOT[e9.kind] && !e9.kind.endsWith("Extractor") && e9.kind !== "Refinery" && e9.kind !== "Assimilator");
      for (const c9 of open9 ? ownBlds9 : []) {
        if (!WALL_BLD9.has(c9.kind)) continue;
        const t9 = c9.born;
        const home9 = [...hallsOfOwner9(own9, t9), [st9.x, st9.y] as [number, number]];
        if (!home9.some(([hx9, hy9]) => Math.hypot(hx9 - c9.bornX, hy9 - c9.bornY) <= BASE_R9 + WALL9.near)) continue;
        /* 거름 — 곁(WALL9.cliff 타일)에 못 걷는 칸(절벽)이 없는 건물은 입구를 마저 막을 수 없다(넓은 땅 한가운데) · 길 찾기를 안 돌린다. */
        let cliff9 = false;
        for (let dy9 = -WALL9.cliff; dy9 <= WALL9.cliff && !cliff9; dy9 += 1) for (let dx9 = -WALL9.cliff; dx9 <= WALL9.cliff; dx9 += 1) {
          const x9 = Math.floor(c9.bornX) + dx9; const y9 = Math.floor(c9.bornY) + dy9;
          if (x9 >= 0 && y9 >= 0 && x9 < W9 && y9 < H9 && walk9[y9 * W9 + x9] === 0) { cliff9 = true; break; }
        }
        if (!cliff9) continue;
        const g9 = walk9.slice();
        for (const b9 of ownBlds9) {
          if (b9.born > t9 || (b9.died !== null && b9.died <= t9)) continue;
          const [fw9, fh9] = BUILDING_FOOT[b9.kind];
          const x0 = Math.round(b9.bornX - fw9 / 2); const y0 = Math.round(b9.bornY - fh9 / 2);
          for (let y9 = y0; y9 < y0 + fh9; y9 += 1) for (let x9 = x0; x9 < x0 + fw9; x9 += 1) if (x9 >= 0 && y9 >= 0 && x9 < W9 && y9 < H9) g9[y9 * W9 + x9] = 0;
        }
        const seen9 = flood9(g9, seed9(g9, st9.x, st9.y));
        if (reaches9(g9, seen9)) continue;
        let area9 = 0; for (let i9 = 0; i9 < seen9.length; i9 += 1) area9 += seen9[i9];
        if (area9 < WALL9.area) continue;
        const names9: string[] = [];
        for (const b9 of ownBlds9) {
          if (!WALL_BLD9.has(b9.kind) || b9.born > t9 || (b9.died !== null && b9.died <= t9) || Math.hypot(b9.bornX - c9.bornX, b9.bornY - c9.bornY) > WALL9.near) continue;
          const n9 = BUILDING_KO[b9.kind] ?? b9.kind;
          if (!names9.includes(n9) && names9.length < 3) names9.push(n9);
        }
        /* 조사 '(으)로' — 끝 글자 받침(ㄹ 받침은 '로'). */
        const last9 = names9.length > 0 ? names9[names9.length - 1].charCodeAt(names9[names9.length - 1].length - 1) - 0xac00 : -1;
        const ro9 = last9 >= 0 && last9 < 11172 && last9 % 28 !== 0 && last9 % 28 !== 8 ? "으로" : "로";
        add9("wall", t9, [{ raw: raw9 }, { text: names9.length > 0 ? ` ${names9.join("·")}${ro9} 입구 막음` : " 건물로 입구 막음" }], "입구 막기");
        break;   // 막은 뒤로는 늘 막혀 있다 — 처음 한 번만
      }
    }
    out9.sort((a9, b9) => a9.at - b9.at);
    tacticsMemo9.set(raw9, out9);
    return out9;
  };
  /* ★★ 자원 무더기(2026-10-10, 요청: "빨무같이 앞마당 없는 맵인데 앞마당 넥서스 건설이라고 나오네 — 3넥서스 이렇게 나와야지. 자원 무더기가 따로 있는 맵만 앞마당·멀티 용어") ──────
     지도 자원 점(opts.resources — 미네랄 밭·가스)을 RES_LINK9 타일 단일 연결로 묶은 것이 **자원 무더기**다(한 기지의 미네랄 줄 + 가스 · 기지끼리는 10타일 넘게 떨어진다).
     본진 건물이 무더기에서 SERVE_R9 안이면 그 무더기를 **먹는다**. 새 본진 건물이 제 것 아무도 안 먹는 무더기 곁이면 **새 기지**(앞마당·멀티 — buildMiles9), 이미 먹는
     무더기 곁이거나 곁에 무더기가 없으면 같은 기지에 하나 더("3넥서스"). 빨무처럼 본진 무더기뿐인 맵은 늘 수로 센다. 자원 자료가 없으면(옛 판) 앞마당·멀티라 단정하지 않는다. */
  const RES_LINK9 = 6;
  const SERVE_R9 = 10;
  /** 자원 무더기가 없는 본진 건물끼리 한 기지로 묶는 거리(타일) — 자원 자료가 없을 때의 기지 수 셈. */
  const BASE_JOIN9 = 12;
  const resGroups9: [number, number][][] = (() => {
    const pts9 = (opts.resources ?? []).map(([x9, y9]): [number, number] => [x9, y9]);
    const par9 = pts9.map((_, i9) => i9);
    const find9 = (i9: number): number => { while (par9[i9] !== i9) { par9[i9] = par9[par9[i9]]; i9 = par9[i9]; } return i9; };
    for (let i9 = 0; i9 < pts9.length; i9 += 1) {
      for (let j9 = i9 + 1; j9 < pts9.length; j9 += 1) {
        if (Math.hypot(pts9[i9][0] - pts9[j9][0], pts9[i9][1] - pts9[j9][1]) <= RES_LINK9) par9[find9(i9)] = find9(j9);
      }
    }
    const by9 = new Map<number, [number, number][]>();
    for (let i9 = 0; i9 < pts9.length; i9 += 1) {
      const r9 = find9(i9);
      const g9 = by9.get(r9);
      if (g9) g9.push(pts9[i9]); else by9.set(r9, [pts9[i9]]);
    }
    return [...by9.values()];
  })();
  const groupDist9 = (g9: readonly [number, number][], x9: number, y9: number): number => {
    let d9 = Infinity;
    for (const [px9, py9] of g9) d9 = Math.min(d9, Math.hypot(px9 - x9, py9 - y9));
    return d9;
  };
  /** 그 자리에서 SERVE_R9 안의 무더기 번호들. */
  const groupsNear9 = (x9: number, y9: number): number[] => {
    const out9: number[] = [];
    for (let i9 = 0; i9 < resGroups9.length; i9 += 1) if (groupDist9(resGroups9[i9], x9, y9) <= SERVE_R9) out9.push(i9);
    return out9;
  };
  type Hall9 = { x: number; y: number };
  /** 본진 건물들의 기지 수 — 무더기를 함께 먹거나 BASE_JOIN9 안이면 한 기지. 자원 자료가 있으면 무더기를 먹는 기지만 센다(곁에 무더기 없는 해처리 홀로는 기지가 아니다). */
  const basesOf9 = (halls9: readonly Hall9[]): number => {
    if (halls9.length === 0) return 0;
    const near9 = halls9.map((h9) => groupsNear9(h9.x, h9.y));
    const par9 = halls9.map((_, i9) => i9);
    const find9 = (i9: number): number => { while (par9[i9] !== i9) { par9[i9] = par9[par9[i9]]; i9 = par9[i9]; } return i9; };
    for (let i9 = 0; i9 < halls9.length; i9 += 1) {
      for (let j9 = i9 + 1; j9 < halls9.length; j9 += 1) {
        const share9 = near9[i9].some((g9) => near9[j9].includes(g9));
        if (share9 || Math.hypot(halls9[i9].x - halls9[j9].x, halls9[i9].y - halls9[j9].y) <= BASE_JOIN9) par9[find9(i9)] = find9(j9);
      }
    }
    const roots9 = new Set<number>();
    const fed9 = new Set<number>();
    for (let i9 = 0; i9 < halls9.length; i9 += 1) { const r9 = find9(i9); roots9.add(r9); if (near9[i9].length > 0) fed9.add(r9); }
    return resGroups9.length > 0 && fed9.size > 0 ? fed9.size : roots9.size;
  };
  const ds9: D9[] = [];
  for (const e9 of world.lives) {
    if (e9.died === null) continue;
    const r9 = rawOf9.get(e9.owner);
    if (!r9) continue;
    /* 끝머리는 **안 센다** — 경기가 끝나면 모두의 몸이 한꺼번에 사라져, 그것을 교전으로
       읽으면 마지막 몇 초가 늘 가짜 장면이 된다. */
    if (e9.died > total - 3) continue;
    const v9 = castValue9(e9.kind);
    if (v9 <= 0) continue;
    if (e9.end === "self") {
      evs9.push({ sec: e9.died, raw: r9, w: v9, why: "자폭" });
      continue;
    }
    if (e9.end !== "atk") continue;   // morph·own·끝까지 삶은 죽음이 아니다
    const at9 = deadAt9(e9, e9.died);
    /* ★ 일꾼의 죽음이 견제인 것은 **제 기지에서** 죽을 때다(2026-10-10) — 상대 본진에서 캐논을 짓다 죽은 프로브·정찰 일꾼은 견제가 아니라 그 싸움의 몫(몸값 그대로 · 꼬리 없음).
       포토러시의 프로브가 "Z의 R 일꾼 견제"로 읽혔다. */
    let [killer9, by9, ktag9] = killerOf9(e9.tag, e9.died, e9.owner);
    if (killer9 < 0) { const st9 = stormBy9(e9.died, at9?.x, at9?.y, e9.owner); if (st9 >= 0) { killer9 = st9; by9 = "High Templar"; } }
    /* ★ 일꾼은 죽은 자리를 **모르면 견제가 아니다**(2026-10-10, 재지적: "아직도 정찰 온 일꾼 잡은 게 일꾼 견제로 나와") — 옛 판은 자리를 모르면(죽기 전 LOC_W9 초 안에
       명령이 없으면 — 정찰 일꾼은 대개 그렇다) atOwnBase9 가 '제 기지'로 쳐 견제가 됐다. 이제 일꾼은 그 앞 **아무 때의 마지막 명령 자리**(정찰 보낸 자리)까지 되짚고,
       그도 없으면 견제로 안 친다. 두 사람 기지가 다 가까우면(빨무) 더 가까운 쪽 기지다. */
    const isWk9 = !e9.bld && unitOf(e9.kind).worker;
    const wat9 = isWk9 ? at9 ?? lastOrderAt9(e9, e9.died) ?? { x: e9.bornX, y: e9.bornY } : null;   // 명령을 한 번도 안 받은 일꾼(랠리로 곧장 캔다)은 난 자리
    const wk9 = isWk9 && !!wat9 && workerAtHome9(e9.owner, killer9, wat9.x, wat9.y, e9.died);
    const wkw9 = isWk9 && !wk9 ? (wat9 ? workerOut9(e9.owner, killer9, wat9.x, wat9.y, e9.died) : "") : undefined;
    ds9.push({ sec: e9.died, owner: e9.owner, v: wk9 ? v9 * HARASS9.k : v9, bld: e9.bld, wk: wk9, kind: e9.kind, tag: e9.tag,
      killer: killer9, ktag: ktag9, by: by9, ...(at9 ?? {}), ...(wkw9 !== undefined ? { wkw: wkw9 } : {}) });
  }
  ds9.sort((a9, b9) => a9.sec - b9.sec);
  /* ★ **나간 사람의 몸은 교전이 아니다** — 팀전에서 한 사람이 나가면 그 몸이 한 프레임에
     다 사라진다. 그 무게를 그대로 세면 경기 중간에 거대한 가짜 장면이 선다. 가름의 자는
     '겨눈 자가 하나도 없다'다: 실제 교전이라면 적이 그 몸들을 겨누고 있었다. */
  const drop9 = new Set<number>();
  for (let i9 = 0; i9 < ds9.length;) {
    let j9 = i9;
    while (j9 < ds9.length && ds9[j9].sec - ds9[i9].sec <= 0.5) j9 += 1;
    const grp9 = new Map<number, number[]>();
    for (let k9 = i9; k9 < j9; k9 += 1) {
      const g9 = grp9.get(ds9[k9].owner);
      if (g9) g9.push(k9); else grp9.set(ds9[k9].owner, [k9]);
    }
    for (const idx9 of grp9.values()) {
      if (idx9.length < LEAVE_N9) continue;
      if (idx9.some((k9) => ds9[k9].killer >= 0)) continue;
      for (const k9 of idx9) drop9.add(k9);
    }
    i9 = j9;
  }
  for (let i9 = 0; i9 < ds9.length; i9 += 1) {
    if (drop9.has(i9)) continue;
    const d9 = ds9[i9];
    const mine9 = rawOf9.get(d9.owner);
    const kill9 = d9.killer >= 0 ? rawOf9.get(d9.killer) : undefined;
    /* ★ 제 기지 밖의 건물(프록시 파일런·러시 캐논·성큰)이 부서진 것은 **기지 피해가 아니라 교전**이다(2026-10-10) — 포토러시의 캐논이 상대 본진에서 깨진 것을 "기지 대파"로
       읽었다. 몸값·살림(econ)은 그대로 센다. */
    const base9 = d9.bld && atOwnBase9(d9.owner, d9.x, d9.y, d9.sec);
    /* ★ 일꾼 견제는 **그 사람의 기지 안**에서 잡힌 일꾼뿐이다(2026-10-10, 요청: "일꾼 견제는 적 본진의 일꾼을 잡는 경우 · 다른 곳에서 잡는 건 견제가 아니고
       정찰병을 잡거나 도망가는 일꾼을 잡은 것 · 아니면 전진 건설하는 일꾼을 잡은 것") — 기지 밖 일꾼은 "일꾼 잡음"(갈래 wkw: 정찰 · 전진 건설 · 그 밖). */
    const why9 = base9 ? "건물 파괴" : d9.wk ? "견제" : d9.wkw !== undefined ? "일꾼 잡음" : "교전";
    const tail9 = d9.wk ? HARASS9.tail : undefined;
    const hallK9 = d9.bld && HALL_ANY9.has(d9.kind) && !!kill9 && !!mine9 && kill9 !== mine9;   // 본진 건물 깨기(위 HALL_KILL_W9)
    const hallMain9 = hallK9 && d9.tag !== undefined && startHallTags9.has(d9.tag);   // 시작 본진만 뚝배기(2026-10-11)
    if (kill9) evs9.push({ sec: d9.sec, raw: kill9, w: d9.v * (d9.bld ? BLD_K9 : 1) + (hallK9 ? HALL_KILL_W9 : 0), why: why9, tail: tail9, ...(hallK9 ? { hall: true, ...(hallMain9 ? { hallMain: true } : {}) } : {}),
      vs: mine9, dealt: d9.v, kind: d9.kind, ...(d9.by ? { by: d9.by } : {}), ...(d9.wkw !== undefined ? { wkw: d9.wkw } : {}),
      ...(d9.ktag > 0 ? { ktag: d9.ktag } : {}), ...(d9.x !== undefined && d9.y !== undefined ? { vx: d9.x, vy: d9.y, px: d9.x, py: d9.y } : {}) });
    if (mine9) evs9.push({ sec: d9.sec, raw: mine9, w: d9.v * LOSS_K9, why: base9 ? "건물 잃음" : d9.wk ? "견제 당함" : d9.wkw !== undefined ? "일꾼 잃음" : "교전", tail: tail9,
      vs: kill9, econ: d9.bld || d9.wk ? d9.v : 0, x: d9.x, y: d9.y, px: d9.x, py: d9.y, kind: d9.kind, ...(d9.wkw !== undefined ? { wkw: d9.wkw } : {}) });
  }
  for (const [sec9, cx9, cy9, tech9, own9] of world.casts) {
    const w9 = CAST_W9[tech9];
    if (!w9) continue;
    const r9 = rawOf9.get(own9);
    if (!r9 || sec9 > total - 3) continue;
    evs9.push({ sec: sec9, raw: r9, w: w9, why: tech9 === "Nuclear Strike" ? "핵" : "마법", tech: tech9, px: cx9, py: cy9 });
  }
  evs9.sort((a9, b9) => a9.sec - b9.sec);

  /* ── 장면으로 묶기 ────────────────────────────────────────────────────────── */
  type Sc9 = { t0: number; t1: number; by: Map<string, number>; why: string; tail: number;
    /** 그 토막에서 부서진 본진 건물 [부순 사람, 잃은 사람, 종류, 시작 본진(뚝배기)인가] — 시작 본진이 먼저 · 그 밖엔 첫 것(2026-10-11). */
    hall?: [string, string, string, boolean];
    /** 가장 무거운 사건(자막 재료 · 2026-10-09). */
    top?: Ev9;
    /** "k>v" → k 가 v 의 **건물**을 부순 몸값 · v → 잃은 건물 몸값(자막의 기지 피해 단 — 반파·대파·궤멸 · 2026-10-09). */
    bldPair: Map<string, number>; bldLost: Map<string, number>;
    /** "a>b" → a 가 b 에게 준 몸값 · 사람 → 잃은 살림 값(맞대결의 자 — 아래 duel9). */
    pair: Map<string, number>; econ: Map<string, number>;
    /** 잃은 자리들 [사람, x, y, 몸값] — 싸움터가 누구 진영인가(duel9). */
    locs: [string, number, number, number][];
    /** 일꾼을 죽인 유닛 종류 → 무게(견제 자막의 "리버 일꾼 견제") · 사람 → (죽인 유닛 종류 → 무게)(저글링러시 · 2026-10-09). */
    byKind: Map<string, number>; killKind: Map<string, Map<string, number>>;
    /** "k>v" → k 의 공중 사냥꾼(OVL_HUNTER9)이 잡은 v 의 오버로드 수(오버로드 사냥 자막 · 2026-10-10). */
    ovl: Map<string, number>;
    /** 사람 → (죽인 유닛 종류 → 잡은 수) · 사람 → 처치 기록 [초, 죽인 태그, 죽은 x, y](마법 활약·지형 활용 자막 · 2026-10-10). */
    killN: Map<string, Map<string, number>>; kills: Map<string, [number, number, number, number][]>;
    /** 장면의 가운데(사건 자리의 평균 · 타일) — 그 장면의 마법만 세는 자(spellNote9). 자리를 모르면 없다. */
    cx?: number; cy?: number;
    /** 사람 → (죽인 유닛 종류 → (죽은 몸 종류 → 수)) — 마법 덧말의 "스톰으로 일꾼 4기 잡음"(2026-10-10). */
    killVic: Map<string, Map<string, Map<string, number>>>;
    /** 이 토막에 든 사건들(때 차례) — 자막을 사건 때에 맞춰 창마다 다시 짓는 재료(2026-10-11 · subSc9). */
    evs: Ev9[] };
  const scs9: Sc9[] = [];
  /* ★★ **장면은 때와 자리로 묶는다**(2026-10-10, 지적: "자막이 사건단위로 분리돼야 할 듯 — 일꾼 견제를 한 명이 했는데 여러 명이 누구에게 폭탄드랍 이렇게 뜨거나
     다른 싸움이 섞여서 하나로 나옴 · 자막을 타이밍에 맞게 나눠서") ───────────────────────────────────────────────────────────────
     옛 묶기는 **때만** 봤다 — 꼬리(GAP9 · 견제 HARASS9.tail) 안이면 지도 반대편의 사건도 한 장면이라, 팀전에서 A 기지 견제와 가운데 교전이 한 자막으로 섞였다
     (견제한 한 사람 + 가운데에서 싸운 팀원이 "누구에게 폭탄드랍"의 주어로 함께 섰다). 이제 열린 장면을 여럿 두고, 사건은 **꼬리 안이면서 그 장면의 가운데에서
     SCENE_R9 타일 안**인 장면(가장 가까운 것)에 든다 · 자리를 모르는 사건은 같은 사람이 든 장면(없으면 가장 최근 장면)에. 장면들은 때가 겹칠 수 있다(아래 편성은 t0 차례). */
  type Open9 = { sc: Sc9; sx: number; sy: number; n: number };
  const open9: Open9[] = [];
  const addEv9 = (sc9: Sc9, e9: Ev9): void => {
    sc9.t1 = e9.sec;
    sc9.evs.push(e9);
    if (e9.hall && e9.vs && e9.kind && (!sc9.hall || (e9.hallMain && !sc9.hall[3]))) sc9.hall = [e9.raw, e9.vs, e9.kind, !!e9.hallMain];
    sc9.tail = e9.tail ?? GAP9;
    sc9.by.set(e9.raw, (sc9.by.get(e9.raw) ?? 0) + e9.w);
    if (e9.vs && e9.dealt) sc9.pair.set(`${e9.raw}>${e9.vs}`, (sc9.pair.get(`${e9.raw}>${e9.vs}`) ?? 0) + e9.dealt);
    if (e9.why === "건물 파괴" && e9.vs && e9.dealt) {
      sc9.bldPair.set(`${e9.raw}>${e9.vs}`, (sc9.bldPair.get(`${e9.raw}>${e9.vs}`) ?? 0) + e9.dealt);
      sc9.bldLost.set(e9.vs, (sc9.bldLost.get(e9.vs) ?? 0) + e9.dealt);
    }
    if (e9.econ) sc9.econ.set(e9.raw, (sc9.econ.get(e9.raw) ?? 0) + e9.econ);
    if (e9.by && e9.vs) {
      if (e9.kind === "Overlord" && e9.dealt && OVL_HUNTER9.has(e9.by)) sc9.ovl.set(`${e9.raw}>${e9.vs}`, (sc9.ovl.get(`${e9.raw}>${e9.vs}`) ?? 0) + 1);
      if (e9.why === "견제") sc9.byKind.set(e9.by, (sc9.byKind.get(e9.by) ?? 0) + e9.w);
      let kk9 = sc9.killKind.get(e9.raw);
      if (!kk9) { kk9 = new Map(); sc9.killKind.set(e9.raw, kk9); }
      kk9.set(e9.by, (kk9.get(e9.by) ?? 0) + e9.w);
      if (e9.dealt) {
        let kn9 = sc9.killN.get(e9.raw);
        if (!kn9) { kn9 = new Map(); sc9.killN.set(e9.raw, kn9); }
        kn9.set(e9.by, (kn9.get(e9.by) ?? 0) + 1);
        if (e9.kind) {
          let kv9 = sc9.killVic.get(e9.raw);
          if (!kv9) { kv9 = new Map(); sc9.killVic.set(e9.raw, kv9); }
          let vk9 = kv9.get(e9.by);
          if (!vk9) { vk9 = new Map(); kv9.set(e9.by, vk9); }
          vk9.set(e9.kind, (vk9.get(e9.kind) ?? 0) + 1);
        }
      }
    }
    if (e9.dealt && e9.ktag !== undefined && e9.vx !== undefined && e9.vy !== undefined) {
      let kr9 = sc9.kills.get(e9.raw);
      if (!kr9) { kr9 = []; sc9.kills.set(e9.raw, kr9); }
      kr9.push([e9.sec, e9.ktag, e9.vx, e9.vy]);
    }
    if (e9.x !== undefined && e9.y !== undefined && e9.vs) sc9.locs.push([e9.raw, e9.x, e9.y, e9.dealt ?? e9.w / LOSS_K9]);
    /* 꼬리표는 그 장면에서 **가장 무거운 사건**의 것이다 — 핵 한 발이 든 교전은 '핵'이다. */
    if (e9.w > (sc9.top?.w ?? 0)) { sc9.why = e9.why; sc9.top = e9; }
  };
  for (const e9 of evs9) {
    for (let k9 = open9.length - 1; k9 >= 0; k9 -= 1) {
      const o9 = open9[k9];
      if (e9.sec - o9.sc.t1 > o9.sc.tail || e9.sec - o9.sc.t0 > MAX_SCENE9) { scs9.push(o9.sc); open9.splice(k9, 1); }
    }
    const hasP9 = e9.px !== undefined && e9.py !== undefined;
    let best9: Open9 | null = null;
    let bd9 = Infinity;
    for (const o9 of open9) {
      if (hasP9 && o9.n > 0) {
        const d9 = Math.hypot(o9.sx - e9.px!, o9.sy - e9.py!);
        if (d9 <= SCENE_R9 && d9 < bd9) { bd9 = d9; best9 = o9; }
      } else if (!hasP9 ? o9.sc.by.has(e9.raw) || (e9.vs !== undefined && o9.sc.by.has(e9.vs)) : o9.n === 0) {
        if (bd9 === Infinity) best9 = o9;   // 자리 없는 짝은 같은 사람이 든 장면 — 자리로 맞은 장면이 늘 이긴다
      }
    }
    if (!best9 && !hasP9 && open9.length > 0) best9 = open9[open9.length - 1];
    if (!best9) {
      best9 = { sc: { t0: e9.sec, t1: e9.sec, by: new Map(), why: e9.why, tail: GAP9,
        pair: new Map(), econ: new Map(), locs: [], bldPair: new Map(), bldLost: new Map(), byKind: new Map(), killKind: new Map(), ovl: new Map(),
        killN: new Map(), kills: new Map(), killVic: new Map(), evs: [] }, sx: 0, sy: 0, n: 0 };
      open9.push(best9);
    }
    addEv9(best9.sc, e9);
    if (hasP9) {
      best9.n += 1;
      best9.sx += (e9.px! - best9.sx) / best9.n;
      best9.sy += (e9.py! - best9.sy) / best9.n;
      best9.sc.cx = best9.sx; best9.sc.cy = best9.sy;
    }
  }
  for (const o9 of open9) scs9.push(o9.sc);
  scs9.sort((a9, b9) => a9.t0 - b9.t0);

  /* ── 편성표 짜기 ──────────────────────────────────────────────────────────── */
  const out9: CastSeg9[] = [];
  /** 그 사람을 마지막으로 보여준 시각 — 순환·동점 가름의 자다(아직이면 -1000). */
  const shown9 = new Map<string, number>();
  for (const r9 of rawOf9.values()) shown9.set(r9, -1000);
  /* ★ **손을 놓은 사람은 순환에서 뺀다**(2026-10-11, 되지적: "건물이 남아도 생산을 안 할 수도") — 건물이 남아 있어도 명령·선택·건설 명령·유닛 생산이 IDLE_OUT9 초 넘게 없으면
     (기지를 잃고 손 놓음 · 잠수) 보여 줄 것이 없고 카메라도 앞 화면에 멈춘다. 활동 시각을 사람마다 모아(정렬) 그 창 [sec − IDLE_OUT9, sec + CYCLE9] 에 하나라도 있어야
     후보다. 아무도 안 남으면 옛 자(살아 있는 사람)로 물러난다. */
  const IDLE_OUT9 = 60;
  const acts9 = new Map<string, number[]>();
  {
    const push9a = (o9: number, t9: number): void => { const r9 = rawOf9.get(o9); if (!r9) return; const a9 = acts9.get(r9); if (a9) a9.push(t9); else acts9.set(r9, [t9]); };
    for (const e9 of world.lives) {
      if (e9.born > 1) push9a(e9.owner, e9.born);   // 생산·착공(시작 몸은 뺀다)
      for (const o9 of e9.orders) push9a(e9.owner, o9[0]);
    }
    for (const [t9, o9] of world.sels ?? []) push9a(o9, t9);
    for (const [t9, o9] of world.builds ?? []) push9a(o9, t9);
    /* 연구 시작도 활동이다(완료 − 연구 시간 · 아래 researchSec9 와 같은 자 · 표에 없는 기술은 1200프레임). */
    for (const [us9, un9, uo9] of world.ups) {
      const m9 = /^(.*?)(?: (\d+))?$/.exec(un9);
      const b9 = m9?.[1] ?? un9;
      push9a(uo9, us9 - (UPGRADE_TIME[b9] ? upgradeSeconds(b9, Number(m9?.[2] ?? 1) || 1) : 1200 * 0.042));
    }
    for (const a9 of acts9.values()) a9.sort((x9, y9) => x9 - y9);
  }
  /** 선택 기록(판 10 · 사람이 늘 내는 것)이 있는 경기만 거른다 — 없으면(옛 판 · 합성 세계) 활동이 띄엄띄엄이라 멀쩡한 사람을 뺀다. */
  const idleOn9 = (world.sels?.length ?? 0) > 0;
  const activeAt9 = (raw9: string, sec9: number): boolean => {
    if (!idleOn9) return true;
    const a9 = acts9.get(raw9);
    if (!a9 || a9.length === 0) return true;   // 활동 자료가 없는 판(옛 판 · 합성)은 안 거른다
    let lo9 = 0; let hi9 = a9.length;
    while (lo9 < hi9) { const m9 = (lo9 + hi9) >> 1; if (a9[m9] < sec9 - IDLE_OUT9) lo9 = m9 + 1; else hi9 = m9; }
    return lo9 < a9.length && a9[lo9] <= sec9 + CYCLE9;
  };
  /** 그때 살아 있고 손을 안 놓은 사람들 — 순환 후보. */
  const aliveAt9 = (sec9: number): string[] => {
    const live9 = [...rawOf9.values()].filter((r9) => (liveTo9.get(r9) ?? 0) > sec9);
    const a9 = live9.filter((r9) => sec9 < IDLE_OUT9 || activeAt9(r9, sec9));
    return a9.length > 0 ? a9 : live9.length > 0 ? live9 : [...rawOf9.values()];
  };
  /** ★ 순환 고리 — 로스터 차례로 팀을 번갈아 짠다(위 머리말의 ★). 로스터 밖(참값에만 있는 사람)은 뒤에 잇는다. */
  const ring9: string[] = (() => {
    const names9 = [...rawOf9.values()];
    const has9 = new Set(names9);
    const ord9 = (opts.order ?? names9).filter((n9) => has9.has(n9));
    for (const n9 of names9) if (!ord9.includes(n9)) ord9.push(n9);
    const groups9: string[][] = [];
    const gi9 = new Map<number, number>();
    for (const n9 of ord9) {
      const tm9 = opts.teamOf?.[n9] ?? 0;
      let g9 = gi9.get(tm9);
      if (g9 === undefined) { g9 = groups9.length; gi9.set(tm9, g9); groups9.push([]); }
      groups9[g9].push(n9);
    }
    const out9: string[] = [];
    const len9 = Math.max(0, ...groups9.map((g9) => g9.length));
    for (let i9 = 0; i9 < len9; i9 += 1) for (const g9 of groups9) if (i9 < g9.length) out9.push(g9[i9]);
    return out9;
  })();
  /** ★ **첫 바퀴는 팀째로**(2026-10-11, 요청: "첫 순환은 1팀 쭉 하고 2팀 쭉 하고 순서를 이렇게 · 그다음부턴 교대로") — 고리(ring9)를 팀 차례로 다시 늘어세운 줄(팀 안은 로스터
   *  차례). 순환이 이 줄의 사람을 한 번씩 다 보여 줄 때까지는 이 줄을 따르고, 그 뒤로는 고리(팀 번갈아)로 돈다(마지막으로 보인 사람 다음부터). */
  const teamRing9: string[] = (() => {
    const tOrd9: number[] = [];
    for (const n9 of ring9) { const tm9 = opts.teamOf?.[n9] ?? 0; if (!tOrd9.includes(tm9)) tOrd9.push(tm9); }
    return [...ring9].sort((a9, b9) => tOrd9.indexOf(opts.teamOf?.[a9] ?? 0) - tOrd9.indexOf(opts.teamOf?.[b9] ?? 0));
  })();
  const firstLap9 = new Set<string>();
  /** 고리에서 마지막으로 보여 준 사람의 자리 — 순환은 그 다음부터 돈다. */
  let ringPos9 = -1;
  /** 고리의 다음 사람 — 마지막으로 보여 준 자리 다음부터 돌며 후보(산 사람)에 든 첫 사람. */
  const nextRing9 = (cands9: string[]): string => {
    const ok9 = new Set(cands9);
    if (firstLap9.size < teamRing9.length) {
      const f9 = teamRing9.find((r9) => !firstLap9.has(r9) && ok9.has(r9));
      if (f9) { firstLap9.add(f9); return f9; }
      for (const r9 of teamRing9) firstLap9.add(r9);   // 남은 이는 다 죽었다 — 첫 바퀴 끝
    }
    for (let k9 = 1; k9 <= ring9.length; k9 += 1) {
      const n9 = ring9[(ringPos9 + k9) % ring9.length];
      if (ok9.has(n9)) return n9;
    }
    return cands9[0];
  };
  /** 가장 오래 안 보여 준 사람 — 같으면 이름 차례(같은 경기에서 늘 같은 편성이 나오게). 동점 가름의 자다. */
  const lonely9 = (cands9: string[]): string => cands9.reduce((b9, r9) => {
    const sb9 = shown9.get(b9) ?? -1000;
    const sr9 = shown9.get(r9) ?? -1000;
    if (sr9 < sb9) return r9;
    if (sr9 > sb9) return b9;
    return r9 < b9 ? r9 : b9;
  }, cands9[0]);
  /** 한 토막을 싣는다 — 같은 사람이 이어지면 토막을 안 늘린다(갈아타는 자리가 아니다). */
  type Duel9 = { foe: string; role: CastRole9; foeTo: number; foes: string[]; allies: string[];
    /** 기지 싸움이면(baseOwner9) — 기지 임자(공격당한 사람) · 쳐들어온 사람들(그 편에 몸값을 준 차례) · 임자 편에서 함께 싸운 사람들(헬프). */
    owner?: string; atks?: string[]; helps?: string[] };
  const push9 = (at9: number, raw9: string, why9: string, cyc9: boolean, score9: number, duel9?: Duel9, caps9?: CapPart9[]): void => {
    const a9 = Math.max(0, Math.min(total, at9));
    ringPos9 = ring9.indexOf(raw9);
    const last9 = out9[out9.length - 1];
    /* 이어지는 같은 사람 — 꼬리표만 갱신한다(장면이 순환을 이겼으면 장면 쪽으로). 맞대결은 **상대역까지 같아야** 잇는다
       — 상대가 바뀌거나 맞대결이 끝난 뒤의 순환이면 새 토막이다(안 그러면 맞대결이 순환 내내 남는다). */
    /* ★ 같은 사람이 이어져도 **새 사건의 자막은 그 사건의 때에** 선다(2026-10-10, 지적: "자막을 타이밍에 맞게 나눠서") — 옛 길은 앞 토막의 자막을 새 장면의 것으로
       덮어써, 앞 토막이 선 때부터 뒤 사건의 글귀가 떴다(앞 사건의 자막은 아예 사라졌다). 이제 글귀가 다르고 CAP_SPLIT9 초 넘게 뒤면 같은 사람의 새 토막을 세운다
       (카메라는 같은 사람이라 안 움직인다 · 자막만 갈린다). 그 안이면 종전대로 덮는다(거의 같은 때의 두 글귀). */
    const capKey9 = (c9?: CapPart9[]): string => (c9 ?? []).map((x9) => x9.raw !== undefined ? `[${x9.raw}]${x9.p ?? ""}` : x9.text).join("");
    const split9 = !!last9 && last9.raw === raw9 && !cyc9 && !!caps9 && a9 - last9.at >= CAP_SPLIT9 && capKey9(caps9) !== capKey9(last9.caps);
    if (last9 && last9.raw === raw9 && (!last9.foe || a9 >= (last9.foeTo ?? 0)) && !duel9 && !split9) {
      if (!cyc9 && last9.cyc) { last9.cyc = false; last9.why = why9; last9.score = score9; if (caps9) last9.caps = caps9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && last9.raw === raw9 && duel9 && last9.foe === duel9.foe && !split9) {
      last9.foeTo = Math.max(last9.foeTo ?? 0, duel9.foeTo);
      if (!cyc9) { last9.cyc = false; last9.why = why9; last9.score = Math.max(last9.score, score9); last9.role = duel9.role; if (caps9) last9.caps = caps9; }
      shown9.set(raw9, a9);
      return;
    }
    if (last9 && a9 <= last9.at) return;   // 시각이 뒤로 가는 토막은 안 싣는다
    out9.push({ at: a9, raw: raw9, why: why9, cyc: cyc9, score: score9, ...(duel9 ?? {}), ...(caps9 ? { caps: caps9 } : {}) });   // duel9 의 foes·allies 도 함께 실린다
    shown9.set(raw9, a9);
  };
  /** ★★ **맞대결** — 그 장면에서 주인공과 가장 많이 주고받은 적이 상대역이다(2026-10, 요청: "교전 발생시 공격자만 보여줄게
   *  아니라 화면 두개로 나눠서 대응하는쪽도 보여주기 · 침공이나 전투 드랍 견제 등에서 주인공의 상대역도 보여주는것 · 공격쪽
   *  닉네임에 공격배지 방어는 방어배지 둘다 공격이면 교전배지").
   *  · 상대역 — `pair` 의 주고받은 몸값(주인공 → 그 · 그 → 주인공)의 합이 가장 큰 사람. 겨눔 자국이 없는 옛 덤프는 죽인 쪽을
   *    모르니 맞대결이 안 선다(한 화면 그대로).
   *  · 몫 — **잃은 살림**(일꾼·건물)으로 가른다: 침공·드랍·견제는 지키는 쪽의 일꾼·건물이 죽는 일이고, 군대끼리의 싸움은
   *    살림이 안 죽는다. 둘의 살림 손실이 맞대결 몸값의 25% 아래면 교전 · 둘이 엇비슷하게(0.6배 안) 잃었으면 교전 ·
   *    아니면 더 잃은 쪽이 방어, 다른 쪽이 공격이다. ⚠ '누가 더 죽였나'로 가르지 마라 — 막아 낸 방어가 더 많이 죽인다. */
  /** ★ 그 장면이 **누구 기지에서** 났나(2026-10-09, 요청: "특정 기지에서 교전 시 교전보다는 공격·방어·헬프로 기술") — 죽은 자리들이 한쪽의 **살아 있는 본진 건물**
   *  (확장 포함 · HALL_ANY9)에서 BASE_R9 타일 안이면 그 사람의 기지다(몸값 무게 · 한쪽 몫이 TURF9.home 이상 → 주인공 기지면 방어 · 상대 기지면 공격). 출발 자리 선
   *  (turf9Of)은 가운데 확장에서의 싸움을 '가운데'(교전)로 읽었다 — 이 자가 먼저고, 못 가르면 그 선으로. */
  const hallsAt9 = (raw9: string, sec9: number): [number, number][] => hallsOfOwner9(ownersOf9(raw9), sec9);
  const baseRole9 = (sc9: Sc9, pick9: string, foe9: string): CastRole9 | null => {
    const hp9 = hallsAt9(pick9, sc9.t0);
    const hf9 = hallsAt9(foe9, sc9.t0);
    if (hp9.length === 0 && hf9.length === 0) return null;
    const near9 = (halls9: [number, number][], x9: number, y9: number): number => {
      let d9 = Infinity;
      for (const [hx9, hy9] of halls9) d9 = Math.min(d9, Math.hypot(hx9 - x9, hy9 - y9));
      return d9;
    };
    let atP9 = 0; let atF9 = 0; let all9 = 0;
    for (const [r9, x9, y9, v9] of sc9.locs) {
      if (r9 !== pick9 && r9 !== foe9) continue;
      const dp9 = near9(hp9, x9, y9);
      const df9 = near9(hf9, x9, y9);
      all9 += v9;
      const inP9 = hp9.some(([hx9, hy9]) => inBaseArea9(hx9, hy9, x9, y9));
      const inF9 = hf9.some(([hx9, hy9]) => inBaseArea9(hx9, hy9, x9, y9));
      if (inP9 && (!inF9 || dp9 <= df9)) atP9 += v9;
      else if (inF9) atF9 += v9;
    }
    if (all9 <= 0) return null;
    if (atP9 / all9 >= TURF9.home) return "def";
    if (atF9 / all9 >= TURF9.home) return "atk";
    return null;
  };
  /** ★★ **싸움터의 임자**(2026-10-10, 요청: "누가 누구를 공격했냐는 전투 위치가 제일 중요 — 누구 기지에서 싸우냐가 중요함 · 그 사람이 공격당한 사람") ──────────
   *  baseRole9 는 주인공과 상대역 **둘의 기지만** 봤다 — 팀전에서 A 가 C 의 기지를 치고 B(C 의 팀원)가 헬프 오면, 주인공 A · 상대역 B 의 어느 기지도 아니라서
   *  교전으로 읽혔다. 이제 죽은 자리(locs)마다 **모든 사람의** 살아 있는 본진 건물 가운데 BASE_R9 안의 가장 가까운 임자에게 몸값을 싣고, 한 사람이 TURF9.home
   *  이상을 가지면 그가 싸움터의 임자 = 공격당한 사람이다. 그 편(같은 팀)은 방어 · 그 편에 몸값을 준 다른 편이 공격이다. */
  /** 모든 본진 건물 [사람, x, y, 난 초, 죽은 초] — 한 번만 훑는다(장면마다 생애 전부를 다시 보면 8인 판에서 편성이 두 배로 느렸다). */
  const hallLives9: [string, number, number, number, number][] = [];
  for (const e9 of world.lives) {
    const r9 = e9.bld && HALL_ANY9.has(e9.kind) ? rawOf9.get(e9.owner) : undefined;
    if (r9) hallLives9.push([r9, e9.bornX, e9.bornY, e9.born, e9.died ?? Infinity]);
  }
  const baseOwner9 = (sc9: Sc9): string | null => {
    const halls9 = hallLives9.filter(([, , , b9, d9]) => b9 <= sc9.t0 && d9 > sc9.t0);
    if (halls9.length === 0) return null;
    const at9 = new Map<string, number>();
    let all9 = 0;
    for (const [, x9, y9, v9] of sc9.locs) {
      all9 += v9;
      let best9 = ""; let bd9 = Infinity;
      for (const [r9, hx9, hy9] of halls9) { const d9 = Math.hypot(hx9 - x9, hy9 - y9); if (d9 < bd9 && inBaseArea9(hx9, hy9, x9, y9)) { bd9 = d9; best9 = r9; } }
      if (best9) at9.set(best9, (at9.get(best9) ?? 0) + v9);
    }
    if (all9 <= 0) return null;
    let own9 = ""; let ow9 = 0; let in9 = 0;
    for (const [r9, v9] of at9) { in9 += v9; if (v9 > ow9) { ow9 = v9; own9 = r9; } }
    if (own9 && ow9 / all9 >= TURF9.home) return own9;
    /* ★ 기지 안 몫이 반을 넘으면 **기지 안에서** 다시 잰다(2026-10-11, 요청: "누군가의 기지에 여러 사람의 유닛이 있어도 그건 한 명의 기지를 공격한 것으로 판정해야 함") —
       기지 밖(가는 길 · 입구 밖)에서 죽은 몫이 분모를 키워 임자가 못 서고 "A가 B C D를 공격"으로 읽혔다. */
    return own9 && in9 / all9 >= 0.5 && ow9 / in9 >= TURF9.home ? own9 : null;
  };
  const sameSide9 = (a9: string, b9: string): boolean => a9 === b9 || (opts.teamOf?.[a9] !== undefined && opts.teamOf?.[a9] === opts.teamOf?.[b9]);
  /** bo0 — 전투가 정한 싸움터 임자(아래 battleOwner ★★) · 안 주면 그 장면에서 잰다. 그 편이 장면에 아무도 없으면 장면의 것. */
  const duel9 = (sc9: Sc9, pick9: string, bo0?: string | null): Duel9 | undefined => {
    const bo9 = bo0 && [...sc9.by.keys()].some((r9) => sameSide9(r9, bo0)) ? bo0 : baseOwner9(sc9);
    if (bo9) {
      const ppl9 = [...sc9.by.keys()];
      const gave9 = (a9: string, side9: (r: string) => boolean): number => {
        let v9 = 0;
        for (const b9 of ppl9) if (side9(b9)) v9 += sc9.pair.get(`${a9}>${b9}`) ?? 0;
        return v9;
      };
      const def9 = (r9: string): boolean => sameSide9(r9, bo9);
      /* 쳐들어온 쪽은 그 자리에 든 **다른 편 전부**다 — 막혀서 잃기만 한 사람도 공격한 사람이다(준 몸값 큰 차례 · 첫째가 이름 붙은 공격의 주인). */
      const atks9 = ppl9.filter((r9) => !def9(r9)).sort((a9, b9) => gave9(b9, def9) - gave9(a9, def9));
      if (atks9.length > 0) {
        const helps9 = ppl9.filter((r9) => r9 !== bo9 && def9(r9));
        const role9: CastRole9 = def9(pick9) ? "def" : "atk";
        const mine9 = role9 === "def" ? [bo9, ...helps9] : atks9;
        const theirs9 = role9 === "def" ? atks9 : [bo9, ...helps9];
        return { foe: role9 === "def" ? atks9[0] : bo9, role: role9, foeTo: sc9.t1 + (sc9.tail - GAP9) + DUEL_TAIL9,
          foes: theirs9, allies: mine9.filter((r9) => r9 !== pick9), owner: bo9, atks: atks9, helps: helps9 };
      }
    }
    let foe9 = "";
    let fw9 = 0;
    for (const o9 of sc9.by.keys()) {
      if (o9 === pick9) continue;
      const w9 = (sc9.pair.get(`${pick9}>${o9}`) ?? 0) + (sc9.pair.get(`${o9}>${pick9}`) ?? 0);
      if (w9 > fw9) { fw9 = w9; foe9 = o9; }
    }
    if (!foe9) return undefined;
    /* ★★ **공격은 그 사람의 기지에 쳐들어간 것뿐이다**(2026-10-11, 요청: "공격이라는 말은 그 목적어의 기지에 쳐들어간 경우만이야 · 나머지는 교전이라고 봄") —
       기지 밖 싸움을 출발 자리 선(turf9Of)이나 잃은 살림으로 공격/방어로 가르던 옛 자를 걷었다(막아 낸 쪽이 쫓아 나가 잡은 싸움이 "A가 B를 공격"으로 뒤집혔다).
       두 사람의 기지(baseRole9)도 아니면 교전이다. 죽은 자리를 하나도 모르는 옛 덤프만 잃은 살림(일꾼·건물 — 기지에서 잃는 것)으로 가른다. */
    let role9: CastRole9 = baseRole9(sc9, pick9, foe9) ?? "war";
    if (role9 === "war" && !sc9.locs.some(([r9]) => r9 === pick9 || r9 === foe9)) {
      const eP9 = sc9.econ.get(pick9) ?? 0;
      const eF9 = sc9.econ.get(foe9) ?? 0;
      if (eP9 + eF9 >= fw9 * 0.25 && !(eP9 >= eF9 * 0.6 && eF9 >= eP9 * 0.6)) role9 = eP9 > eF9 ? "def" : "atk";
    }
    /* ★ 자막의 이름들(2026-10-09) — 적은 주인공과 주고받은 몸값이 큰 차례(첫째가 상대역 · 팀전이면 다른 팀 참가자 전부 · 팀이 없으면 주고받은 사람만) ·
       같은 편은 그 장면에 든 팀원이다. */
    const tmP9 = opts.teamOf?.[pick9];
    const xch9 = (o9: string): number => (sc9.pair.get(`${pick9}>${o9}`) ?? 0) + (sc9.pair.get(`${o9}>${pick9}`) ?? 0);
    const foes9: string[] = [];
    const allies9: string[] = [];
    for (const o9 of sc9.by.keys()) {
      if (o9 === pick9) continue;
      const tmO9 = opts.teamOf?.[o9];
      if (tmP9 !== undefined && tmO9 === tmP9) allies9.push(o9);
      else if (o9 === foe9 || xch9(o9) > 0 || (tmP9 !== undefined && tmO9 !== undefined)) foes9.push(o9);
    }
    foes9.sort((a9, b9) => (a9 === foe9 ? -1 : b9 === foe9 ? 1 : xch9(b9) - xch9(a9)));
    return { foe: foe9, role: role9, foeTo: sc9.t1 + (sc9.tail - GAP9) + DUEL_TAIL9, foes: foes9, allies: allies9 };
  };
  /** 마지막 토막이 선 시각(없으면 -1000) · 그 무게. */
  const lastAt9 = (): number => (out9.length > 0 ? out9[out9.length - 1].at : -1000);
  const lastScore9 = (): number => (out9.length > 0 ? out9[out9.length - 1].score : 0);
  const blockShown9 = new Set<object>();
  /** 소강 구간을 순환으로 메운다 — from 부터 to 까지 CYCLE9 마다 한 사람. */
  const fill9 = (from9: number, to9: number): void => {
    /* 앞 토막이 최소한 머문 뒤에 시작한다 — 장면을 보여 주다 3초 만에 순환으로 끊으면
       그 장면이 무슨 장면인지 읽히지 않는다. */
    const s09 = out9.length > 0 ? Math.max(from9, lastAt9() + MIN_HOLD9) : from9;
    /* 끝은 **MIN_HOLD9 앞**에서 멎는다 — 장면 바로 앞에 순환 한 토막을 끼우면 자막이
       두 번 잇달아 뜨고(그 둘은 다른 사람이다) 앞 토막은 몇 초 만에 끊긴다. */
    /* 그 칸에 인구가 막힌 사람이 있으면 그 사람이 먼저다(2026-10-10 · 인구 막힘 ★★) — 한 막힘은 한 번만 데려온다. */
    for (let s9 = s09; s9 < to9 - MIN_HOLD9; s9 += CYCLE9) {
      const alive9 = aliveAt9(s9);
      const blk9 = alive9.find((r9) => { const b9 = blockIn9(r9, s9, s9 + CYCLE9); return !!b9 && !blockShown9.has(b9); });
      if (blk9) blockShown9.add(blockIn9(blk9, s9, s9 + CYCLE9)!);
      push9(s9, blk9 ?? nextRing9(alive9), "순환 중계", true, 0);
    }
  };

  /* ── 자막(2026-10-09, 요청: "앞으로 자동중계에서는 모든 장면에 자막 삽입 — 전투·견제·공격·방어·기술 개발·건설 등을 자연스러운 말투로(개조식) · 화려한 표현 X
     담백하고 단순하게") ───────────────────────────────────────────────────────────
     장면 토막은 그 장면의 **가장 무거운 사건**(sc.top)과 맞대결 몫으로, 순환 토막은 그 사람이 그 창에서 한 일(연구 · 확장 · 건설)로 짓는다. 사람은 조각(raw)으로 두고
     재생기가 이름표 칩으로 그린다 — 조사는 표시 이름의 받침을 재생기가 안다(p). 글귀 보기:
       교전 — 공격·방어 "A가 B를 공격" · "A가 B에게 포토러시"(방어는 뒤에 " · C가 헬프") · 호각 "A B vs C D 교전"(vs · 칩은 점 없이 잇닿는다) · 견제 "A가 리버로 B 일꾼 견제" · 기지 피해 "A가 B 기지 반파/대파/궤멸시킴"(잃은 건물 몸값이 그때
       기지 몸값의 20/45/75% — 되요청: "공격 와서 뭘 부쉈는지까지보다 기지를 반파시킴 대파시킴 궤멸시킴 등으로") · 그 아래면 "A가 B 건물 파괴" · 핵 "A 핵 투하" · 마법 "A 스톰"
       순환 — "A 메타볼릭 부스트 개발" · 빌드 읽기 "A 선스포닝풀 후 해처리" · "A 빠른 넥서스 늘리기" · "A 로보틱스 건설" · "A 포토 건설" · 국면 "A 3기지 운영 중"(아래 ★★). */
  /** 일꾼을 잡은 유닛의 자막 이름 — 스캐럽은 리버 · 탱크는 모드 없이 · 그 밖은 UNIT_KO(없으면 영문 그대로). */
  const harassName9 = (kind9: string): string =>
    (kind9 === "Scarab" || kind9 === "Reaver" ? "리버" : kind9.startsWith("Siege Tank") ? "탱크" : UNIT_KO[kind9] ?? BUILDING_KO[kind9] ?? kind9);   // 캐논·성큰·벙커도 든다
  /** 그 사람의 러시 건물(상대 기지 안의 캐논·성큰) — buildMiles9 가 채운다 [착공 초, 상대, 글귀]. */
  const rushes9 = new Map<string, [number, string, string][]>();
  /** att 가 def 기지에 RUSH_W9 초 안에 세운 캐논/성큰 → "포토러시"/"성큰러시". */
  const RUSH_W9 = 240;
  const rushKind9 = (att9: string, def9: string, sec9: number): string | null => {
    buildMiles9(att9);
    for (const [at9, foe9, text9] of rushes9.get(att9) ?? []) if (foe9 === def9 && at9 >= sec9 - RUSH_W9 && at9 <= sec9 + 10) return text9;
    return null;
  };
  /** ★ 폭탄드랍 — att 의 수송선(드랍십·셔틀·복부 주머니 뒤의 오버로드)이 장면 앞 DROP_W9 초 안에 def 기지(본진 건물 BASE_R9 안)로 명령받았으면 그 싸움은 드랍이다. */
  const DROP_W9 = 30;
  /** 폭탄드랍의 수송선 수 하한 — 드랍십 둘이면 16 인구(마린·메딕 열여섯). */
  const BOMB_DROP_N9 = 2;
  const TRANSPORT9 = new Set(["Dropship", "Shuttle", "Overlord"]);
  /** att 의 수송선 가운데 장면 앞 DROP_W9 초 안에 def 기지로 명령받은 수. */
  const dropN9 = (att9: string, def9: string, sec9: number): number => {
    const own9 = ownersOf9(att9);
    const halls9 = hallsAt9(def9, sec9);
    if (halls9.length === 0) return 0;
    const sacs9 = world.ups.some(([us9, name9, uo9]) => name9 === "Ventral Sacs" && own9.has(uo9) && us9 <= sec9);
    /* ★ **수송선이 여럿**이어야 폭탄드랍이다(2026-10-10, 요청: "폭탄드랍은 수가 많아야 함 · 그 외에는 주로 일꾼 견제가 많음") — 한 대는 그냥 드랍이라
       이름을 안 붙이고 일꾼 견제·공격 글귀로 간다. */
    let n9 = 0;
    for (const e9 of world.lives) {
      if (e9.bld || !own9.has(e9.owner) || !TRANSPORT9.has(e9.kind) || e9.born > sec9 || (e9.died !== null && e9.died < sec9 - DROP_W9)) continue;
      if (e9.kind === "Overlord" && !sacs9) continue;
      if (e9.orders.some((o9) => o9[0] >= sec9 - DROP_W9 && o9[0] <= sec9 + 5
        && halls9.some(([hx9, hy9]) => inBaseArea9(hx9, hy9, o9[1], o9[2])))) n9 += 1;
    }
    return n9;
  };
  const dropKind9 = (att9: string, def9: string, sec9: number): string | null => (dropN9(att9, def9, sec9) >= BOMB_DROP_N9 ? "폭탄드랍" : null);
  /** ★ **한 대 드랍도 실은 것이 무거우면 이름이다**(2026-10-10, 요청: "A가 B 기지에 하템 드랍. 스톰으로 일꾼 몇 기 잡음") — 수송선이 그 기지로 갔고(한 대라도) 잡은 것의
   *  대개를 DROP_UNIT9 의 유닛이 냈으면 "하이템플러 드랍"·"리버 드랍". 여럿이면 폭탄드랍(위) · 마린 한 대 드랍은 종전대로 일꾼 견제다. */
  const DROP_UNIT9 = new Set(["High Templar", "Reaver", "Scarab", "Dark Templar", "Lurker", "Siege Tank (Tank Mode)", "Siege Tank (Siege Mode)"]);
  const unitDrop9 = (att9: string, def9: string, sec9: number, kind9: string): string | null => {
    if (!DROP_UNIT9.has(kind9)) return null;
    const n9 = dropN9(att9, def9, sec9);
    return n9 >= 1 && n9 < BOMB_DROP_N9 ? `${harassName9(kind9)} 드랍` : null;
  };
  /* (걷어냄 · 2026-10-10, 요청: "저글링 러시 이런 거는 화면 보면 아니까 굳이 설명 x") 저글링러시 이름(zlRush9 — 초반 장면의 킬이 대개 저글링). */
  /** 로/으로 — 받침(ㄹ 아닌)이 있으면 "으로" · 없거나 ㄹ 이면 "로"(한글 아닌 이름은 "로"). */
  const koRo9 = (s9: string): string => {
    const c9 = s9.charCodeAt(s9.length - 1);
    if (c9 < 0xac00 || c9 > 0xd7a3) return "로";
    const jong9 = (c9 - 0xac00) % 28;
    return jong9 === 0 || jong9 === 8 ? "로" : "으로";
  };
  /* ★ **팀 전원이면 "1팀 전원"**(2026-10-10, 요청: "팀 전원이 등장할 때는 나열하지 말고 1팀 전원 A를 공격 이런 식으로") — 칩 무리가 그때(capSec9) 살아 있는 한 팀
     사람 전부(둘 이상)면 칩 대신 글귀 하나다. 조사는 '전원'의 받침(ㄴ)으로 붙인다. */
  let capSec9 = 0;
  const JOSA_N9: Record<string, string> = { ga: "이", eul: "을", wa: "과", ui: "의" };
  const chips9 = (raws9: string[], last9?: CapPart9["p"]): CapPart9[] => {
    const tm9 = raws9.length >= 2 ? opts.teamOf?.[raws9[0]] : undefined;
    if (tm9 !== undefined && raws9.every((r9) => opts.teamOf?.[r9] === tm9)) {
      const all9 = [...new Set(rawOf9.values())].filter((r9) => opts.teamOf?.[r9] === tm9 && (liveTo9.get(r9) ?? 0) > capSec9);
      if (all9.length >= 2 && all9.every((r9) => raws9.includes(r9))) return [{ text: `${tm9}팀 전원${last9 ? JOSA_N9[last9] : ""}` }];
    }
    return raws9.map((r9, i9): CapPart9 => (i9 < raws9.length - 1 ? { raw: r9 } : { raw: r9, p: last9 }));
  };   // 칩 사이 점은 없다(2026-10-10, 요청: "사이에 점 굳이 없어도 될듯") — 칩 여백이 가른다
  /** ★ 헬프는 **팀으로**(2026-10-11, 요청: "한 명이 공격을 당하고 나머지 팀원이 도와준 경우 일일이 열거하지 말고 1팀 전체가 헬프") — 같은 팀 둘 이상이 도왔으면
   *  " · N팀 전체가 헬프", 하나면 " · [C]가 헬프". */
  const helpCap9 = (helps9: string[]): CapPart9[] => {
    if (helps9.length === 0) return [];
    const tm9 = opts.teamOf?.[helps9[0]];
    if (helps9.length >= 2 && tm9 !== undefined && helps9.every((r9) => opts.teamOf?.[r9] === tm9)) return [{ text: ` · ${tm9}팀 전체가 헬프` }];
    return [{ text: " · " }, ...chips9(helps9, "ga"), { text: " 헬프" }];
  };
  const sceneCaps9 = (sc9: Sc9, pick9: string, d9: Duel9 | undefined): CapPart9[] => {
    capSec9 = sc9.t0;
    /* 오버로드 사냥 — 그 장면에서 주인공이 든 짝 가운데 공중 사냥꾼이 잡은 오버로드가 OVL_HUNT_N9 이상. */
    for (const [key9, n9] of sc9.ovl) {
      const [k9, v9] = key9.split(">");
      if (n9 >= OVL_HUNT_N9 && (k9 === pick9 || v9 === pick9)) return [{ raw: k9, p: "ga" }, { text: " " }, { raw: v9 }, { text: " 오버로드 사냥" }];
    }
    const base0_9 = sceneCaps0_9(sc9, pick9, d9);
    /* ★ **뚝배기 파괴**(2026-10-11, 요청: "메인홀(뚝배기) 깨는 건 진짜 중요해서 꼭 보여줘야 함" → "아니 뚝배기 파괴") — 본진 건물을 깬 토막에서 주인공 편이 깼거나 잃었으면:
       자막은 "[A]가 [B] 뚝배기 파괴" 하나 — 엘리·기지 반파/대파/궤멸/마무리 자막이 서면 그것 그대로(뚝배기는 안 덧붙인다). */
    const base9 = ((): CapPart9[] => {
      const h9 = sc9.hall;
      if (!h9 || !(sameSide9(pick9, h9[0]) || sameSide9(pick9, h9[1]))) return base0_9;
      const txt0 = base0_9.map((c9) => c9.text ?? "").join("");
      if (/엘리/.test(txt0)) return base0_9;
      /* 기지를 부순 자막(반파·대파·궤멸·마무리)이 이미 서면 그것이 더 중요하다 — 뚝배기를 따로 말하지 않는다(같은 날 요청: "기지 반파 대파 궤멸시킴에 뚝배기 깨진 건
         굳이 따로 뚝배기 강조 안 해도 됨 · 기지를 부순 게 더 중요"). */
      if (/기지 (반파|대파|궤멸)|마무리지음/.test(txt0)) return base0_9;
      /* 앞 문장에 덧붙이던 꼴("… 건물 파괴. 뚝배기 파괴")은 걷었다(같은 날 지적: "좀 부자연스러워 — 뚝배기 파괴만 나오면 됨"). */
      /* 뚝배기는 **시작 본진만**(2026-10-11, 요청: "맨 처음 나오는 기본 메인 홀만 뚝배기 · 나머지는 넥서스 커맨드 해처리 등으로 부르면 됨") — 멀티는 그 건물 이름. */
      const hk9 = h9[3] ? "뚝배기" : HALL_KO9[h9[2]] ?? BUILDING_KO[h9[2]] ?? h9[2];
      return [{ raw: h9[0], p: "ga" }, { text: " " }, { raw: h9[1] }, { text: ` ${hk9} 파괴` }];
    })();
    /* ★ 덧말은 **주어가 있는 한 마디**다(2026-10-10, 요청: "뒤에 스톰 옆탱 이런 거 붙이지 말고 문장 안에 누가 썼는지 정확하게 표현") — 옛 꼬리 " · 스톰 · 옆탱"은
       누가 쓴 것인지 안 읽혔다(늘 주인공 것이었는데도 공격 글귀의 주어가 딴 사람이면 그 사람 것으로 읽혔다). 이제 " · [A]가 사이오닉 스톰으로 4기 잡음"처럼 쓴 사람의
       칩을 주어로 세운다. 마법은 **그 장면에 든 사람 누구든**(주인공 먼저 · 그 장면 자리의 것만 — spellNote9) · 캐리어·지형·전술은 주인공의 것. 한 마디만(자막 폭). */
    const notes9: [string, string][] = [];
    const ppl9 = [pick9, ...[...sc9.by.keys()].filter((r9) => r9 !== pick9)];
    for (const r9 of ppl9) {
      if (sc9.why === "마법" && sc9.top?.raw === r9) continue;   // 마법이 장면 머리면 위 글귀가 이미 그것이다
      const sp9 = spellNote9(sc9, r9, r9 === pick9 ? d9?.role : undefined);
      if (sp9) notes9.push([r9, sp9]);
    }
    if (d9) {
      const cr9 = carrierNote9(sc9, pick9, d9.role);
      if (cr9) notes9.push([pick9, cr9]);
      const hl9 = hillNote9(sc9, pick9);
      if (hl9) notes9.push([pick9, hl9]);
      const tc9 = tacticsOf9(pick9).find((x9) => x9.short && x9.at >= sc9.t0 - 60 && x9.at <= sc9.t1);
      if (tc9) notes9.push([pick9, tc9.short!]);
    }
    const txt9 = base9.map((c9) => c9.text ?? "").join("");
    const add9 = notes9.find(([, n9]) => !txt9.includes(n9));
    /* 둘째 문장 — "A가 B 기지에 하이템플러 드랍. 스톰으로 일꾼 4기 잡음"(2026-10-10, 요청) · 첫 문장의 주어와 같은 사람이면 주어를 안 되풀이한다. */
    const subj9 = base9[0]?.raw !== undefined && base9[0].p === "ga" ? base9[0].raw : null;
    if (!add9) return base9;
    return add9[0] === subj9 ? [...base9, { text: `. ${add9[1]}` }] : [...base9, { text: ". " }, { raw: add9[0], p: "ga" }, { text: ` ${add9[1]}` }];
  };
  /** 마법 활약 — 그 장면(앞 8초 ~ 끝 2초)에 주인공이 쓴 마법 가운데 가장 앞(SPELL_NOTE9) 것. 스톰·이레디에이트 등은 잡은 수 · 마인드컨트롤은 빼앗은 몸 ·
   *  다크스웜은 럴커·저글링과 함께면 "다크스웜+럴커 돌파/방어". */
  /* ★ **활약했을 때만**(2026-10-11, 요청: "스톰 같은 게 무조건 들어가야 하는 게 아니라 그걸로 활약했을 때만 들어가야 함 — 스톰으로 활약함 이렇게") — 옛 "X 사용"(쓰기만 해도
     섰다)은 걷었다. 잡는 마법(SPELL_KILLER9)은 그 마법으로 SPELL_ACT9.kills 기 넘게 잡았을 때 · 마인드컨트롤은 빼앗았을 때 · 다크스웜은 럴커·저글링과 함께일 때 ·
     그 밖(스테이시스·EMP·마엘스트롬 …)은 그 장면에서 쓴 사람이 준 몸값이 받은 것의 SPELL_ACT9.k 배 넘고 SPELL_ACT9.value 넘을 때. 글귀는 "스톰으로 활약함" ·
     detail 이면(하템 드랍의 둘째 문장 · 2026-10-10 요청) "스톰으로 일꾼 4기 잡음". 활약이 없으면 null — 덧말도, 마법 장면 머리도 안 선다(머리는 맞대결 글귀로). */
  const spellNote9 = (sc9: Sc9, pick9: string, role9: string | undefined, detail9 = false): string | null => {
    const own9 = ownersOf9(pick9);
    const used9 = new Map<string, number>();
    const at9 = new Map<string, [number, number]>();
    for (const [cs9, cx9, cy9, tech9, co9] of world.casts) {
      if (!own9.has(co9) || cs9 < sc9.t0 - 8 || cs9 > sc9.t1 + 2 || !SPELL_NOTE9.includes(tech9)) continue;
      if (sc9.cx !== undefined && sc9.cy !== undefined && Math.hypot(cx9 - sc9.cx, cy9 - sc9.cy) > SCENE_R9 + 8) continue;   // 그 장면 자리의 마법만(딴 싸움의 것은 그 장면의 것)
      used9.set(tech9, (used9.get(tech9) ?? 0) + 1);
      if (!at9.has(tech9)) at9.set(tech9, [cx9, cy9]);
    }
    const tech9 = SPELL_NOTE9.find((t9) => used9.has(t9));
    if (!tech9) return null;
    const ko9 = researchKo(tech9);
    if (tech9 === "Dark Swarm") {
      const kk9 = sc9.killN.get(pick9);
      const with9 = (kk9?.get("Lurker") ?? 0) > 0 ? "럴커" : (kk9?.get("Zergling") ?? 0) > 0 ? "저글링" : "";
      /* 돌파/방어는 스웜을 친 자리로 — 적 기지 안이면 돌파 · 제 기지 안이면 방어 · 그 밖은 맞대결의 몫. */
      const [sx9, sy9] = at9.get(tech9)!;
      const sec9 = sc9.t0;
      const inOwn9 = hallsOfOwner9(own9, sec9).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, sx9, sy9));
      const inFoe9 = foeOwners9(pick9).some((o9) => hallsOfOwner9(new Set([o9]), sec9).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, sx9, sy9)));
      const how9 = inFoe9 ? "돌파" : inOwn9 ? "방어" : role9 === "def" ? "방어" : role9 === "atk" ? "돌파" : "교전";
      if (with9) return `다크스웜+${with9} ${how9}`;
      return null;
    }
    if (tech9 === "Mind Control") {
      const got9 = world.lives.find((e9) => e9.handoff && own9.has(e9.owner) && e9.born >= sc9.t0 - 8 && e9.born <= sc9.t1 + 2);
      return got9 ? `마인드컨트롤로 ${UNIT_KO[got9.kind] ?? got9.kind} 빼앗음` : null;
    }
    const by9 = SPELL_KILLER9[tech9];
    const n9 = by9 ? sc9.killN.get(pick9)?.get(by9) ?? 0 : 0;
    /* 잡은 것을 이름으로(2026-10-10, 요청: "스톰으로 일꾼 몇 기 잡음") — 다 일꾼이면 "일꾼 N기" · 한 종류면 그 이름 · 섞이면 "많은 것 등 N기". */
    if (by9) {
      if (n9 < SPELL_ACT9.kills) return null;
      return detail9 ? `${ko9}${koRo9(ko9)} ${vicTxt9(sc9.killVic.get(pick9)?.get(by9))} 잡음` : `${ko9}${koRo9(ko9)} 활약함`;
    }
    let dealt9 = 0; let got9 = 0;
    for (const [key9, w9] of sc9.pair) { const [a9, b9] = key9.split(">"); if (a9 === pick9) dealt9 += w9; if (b9 === pick9) got9 += w9; }
    return dealt9 >= SPELL_ACT9.value && dealt9 > got9 * SPELL_ACT9.k ? `${ko9}${koRo9(ko9)} 활약함` : null;
  };
  /** 잡은 몸들의 글귀 — 다 일꾼 "일꾼 N기" · 한 종류 "히드라 N기" · 섞이면 가장 많은 것 "히드라 등 N기". */
  const vicTxt9 = (m9: Map<string, number> | undefined): string => {
    if (!m9 || m9.size === 0) return "";
    let all9 = 0; let wk9 = 0; let top9 = ""; let tn9 = 0;
    for (const [k9, n9] of m9) { all9 += n9; if (WORKER9.has(k9)) wk9 += n9; if (n9 > tn9) { tn9 = n9; top9 = k9; } }
    if (wk9 === all9) return `일꾼 ${all9}기`;
    const ko9 = UNIT_KO[top9] ?? BUILDING_KO[top9] ?? top9;
    return tn9 === all9 ? `${ko9} ${all9}기` : `${ko9} 등 ${all9}기`;
  };
  /** 캐리어 기동 공격 — 공격 장면에서 주인공이 잡은 몸값의 절반 넘게를 캐리어·인터셉터가 냈을 때. */
  const carrierNote9 = (sc9: Sc9, pick9: string, role9: string): string | null => {
    if (role9 !== "atk") return null;
    const kk9 = sc9.killKind.get(pick9);
    if (!kk9) return null;
    let all9 = 0; let cv9 = 0;
    for (const [k9, w9] of kk9) { all9 += w9; if (k9 === "Carrier" || k9 === "Interceptor") cv9 += w9; }
    return all9 > 0 && cv9 / all9 > 0.5 ? "캐리어 기동 공격" : null;
  };
  /** 지형 활용 — 주인공이 잡은 몸 셋 이상에서, 죽인 몸(처치 절의 태그 · 그때 명령 자리)이 죽은 몸보다 평균 한 단 넘게 높고 준 몸값이 받은 것의 1.5배 넘을 때. 지형이 있어야. */
  const hillNote9 = (sc9: Sc9, pick9: string): string | null => {
    const tr9 = opts.terrain;
    const kr9 = sc9.kills.get(pick9);
    if (!tr9 || !kr9 || kr9.length < 3) return null;
    let up9 = 0; let n9 = 0;
    for (const [ks9, kt9, vx9, vy9] of kr9) {
      const life9 = livesByTag9.get(kt9)?.find((e9) => e9.born <= ks9 && (e9.died === null || e9.died >= ks9));
      if (!life9 || life9.bld) continue;
      const [kx9, ky9] = posAt9(life9, ks9);
      up9 += levelNear9(kx9, ky9) - levelNear9(vx9, vy9);
      n9 += 1;
    }
    if (n9 < 3 || up9 / n9 < 1) return null;
    let dealt9 = 0; let got9 = 0;
    for (const [key9, w9] of sc9.pair) { const [a9, b9] = key9.split(">"); if (a9 === pick9) dealt9 += w9; if (b9 === pick9) got9 += w9; }
    return dealt9 >= got9 * 1.5 ? "언덕 지형 활용" : null;
  };
  const sceneCaps0_9 = (sc9: Sc9, pick9: string, d9: Duel9 | undefined): CapPart9[] => {
    /* ★ 자막은 **주인공(pick9)의 일만** 말한다(2026-10-09, 요청: "자막엔 주인공 관련 사건 위주로 그 외엔 굳이 넣지 않기") — 장면의 가장 무거운 사건(top)이나 건물을
       가장 많이 부순 짝이 주인공과 무관하면(팀전에서 같은 장면의 딴 짝) 그것을 안 쓰고 주인공의 맞대결 글귀로 간다. 건물 짝은 주인공이 든 것 중 가장 무거운 것. */
    const top9 = sc9.top && (sc9.top.raw === pick9 || sc9.top.vs === pick9) ? sc9.top : undefined;
    const why9 = top9 ? sc9.why : "";
    /* ★ **엘리**(2026-10-10, 요청: "엘리") — 그 장면에서 건물을 잃은 사람이 그 뒤로 건물이 하나도 없으면(다시 짓지도 않으면) "[B]가 [A] 엘리시킴" — 가장 큰 사건이라
       맨 앞이다. 부순 사람은 그 사람 건물을 가장 많이 부순 짝. 주인공과 같은 편이거나 맞선 편일 때만(밀리에서 남의 엘리는 안 쓴다). */
    for (const v9 of sc9.bldLost.keys()) {
      const own9 = ownersOf9(v9);
      const left9 = world.lives.some((e9) => e9.bld && own9.has(e9.owner) && (e9.died === null || e9.died > sc9.t1 + 0.5));
      if (left9) continue;
      let k9 = ""; let kw9 = 0;
      for (const [key9, w9] of sc9.bldPair) { const [a9, b9] = key9.split(">"); if (b9 === v9 && w9 > kw9) { kw9 = w9; k9 = a9; } }
      if (!k9 || !(sameSide9(pick9, k9) || sameSide9(pick9, v9))) continue;
      return [{ raw: k9, p: "ga" }, { text: " " }, { raw: v9 }, { text: " 엘리시킴" }];
    }
    if (top9 && why9 === "핵") return [{ raw: top9.raw, p: "ga" }, { text: " 핵 투하" }];
    if (top9 && why9 === "마법") {
      const role9 = top9.raw === pick9 ? d9?.role : undefined;
      /* 적 기지에 수송선으로 실어 와 친 마법이면 드랍이 첫 문장이다(2026-10-10, 요청: "A가 B 기지에 하템 드랍. 스톰으로 일꾼 몇 기 잡음"). */
      const bo9 = baseOwner9(sc9);
      const unit9 = top9.tech ? SPELL_KILLER9[top9.tech] : undefined;
      const dn9 = bo9 && unit9 && !sameSide9(bo9, top9.raw) ? unitDrop9(top9.raw, bo9, sc9.t0, unit9) : null;
      const spd9 = bo9 && dn9 ? spellNote9(sc9, top9.raw, role9, true) : null;
      if (bo9 && dn9 && spd9) return [{ raw: top9.raw, p: "ga" }, { text: " " }, { raw: bo9 }, { text: ` 기지에 ${dn9}. ${spd9}` }];
      const sp9 = spellNote9(sc9, top9.raw, role9);
      if (sp9) return [{ raw: top9.raw, p: "ga" }, { text: ` ${sp9}` }];
      // 활약이 없는 마법 장면은 마법을 말하지 않는다(2026-10-11) — 아래 맞대결·기지 글귀로.
    }
    if (top9 && why9 === "자폭") return [{ raw: top9.raw }, { text: " 자폭" }];
    if (top9 && (why9 === "일꾼 잡음" || why9 === "일꾼 잃음")) {
      const k9 = why9 === "일꾼 잡음" ? top9.raw : top9.vs;
      const v9 = why9 === "일꾼 잡음" ? top9.vs : top9.raw;
      const what9 = top9.wkw === "정찰" ? "정찰 일꾼" : top9.wkw === "전진 건설" ? "전진 건설 일꾼" : "일꾼";
      if (k9 && v9) return [{ raw: k9, p: "ga" }, { text: " " }, { raw: v9 }, { text: ` ${what9} 잡음` }];
      return [{ raw: v9 ?? pick9 }, { text: ` ${what9} 잃음` }];
    }
    if (top9 && (why9 === "견제" || why9 === "견제 당함")) {
      const k9 = why9 === "견제" ? top9.raw : top9.vs;
      const v9 = why9 === "견제" ? top9.vs : top9.raw;
      /* ★ 일꾼을 가장 많이 잡은 유닛의 이름을 붙인다(2026-10-09, 요청: "자주 나오는 전략 — 하이템플러 일꾼 견제 · 리버 일꾼 견제") — "A의 B 리버 일꾼 견제". 스캐럽은 리버 ·
         스톰 킬은 stormBy9 가 하이템플러로 적는다 · 다른 유닛도 제 이름(벌처·뮤탈·질럿·다크템플러 …). 모르면 "일꾼 견제". */
      let best9 = ""; let bw9 = 0;
      for (const [kind9, w9] of sc9.byKind) if (w9 > bw9) { bw9 = w9; best9 = kind9; }
      const nm9 = best9 ? harassName9(best9) : "";
      /* 상대 기지의 캐논·성큰이 잡은 일꾼은 **포토러시/성큰러시**, 수송선이 그 기지로 간 뒤의 일꾼 킬은 **폭탄드랍**(요청) — 리버·하이템플러는 제 이름(리버 드랍 = "리버 일꾼 견제")이
         더 말한다. */
      const named9 = k9 && v9 ? rushKind9(k9, v9, sc9.t0) ?? (nm9 !== "리버" && nm9 !== "하이템플러" ? dropKind9(k9, v9, sc9.t0) : null) : null;
      const udrop9 = k9 && v9 && !named9 && best9 ? unitDrop9(k9, v9, sc9.t0, best9) : null;
      if (k9 && v9 && (udrop9 || named9 === "폭탄드랍")) return [{ raw: k9, p: "ga" }, { text: " " }, { raw: v9 }, { text: ` 기지에 ${udrop9 ?? named9}` }];
      /* ★ 서술로 "A가 리버로 B 일꾼 견제" · "A가 B에게 포토러시"(2026-10-10, 요청: "~의 공격 말고 서술로 누가 누구를 공격 · 주어나 목적어가 화면주인이어도 넣기 · 제 3자 느낌") — 옛 "A의 B 리버 일꾼 견제". */
      if (k9 && v9) {
        if (named9) return [{ raw: k9, p: "ga" }, { text: " " }, { raw: v9 }, { text: `에게 ${named9}` }];
        return [{ raw: k9, p: "ga" }, { text: nm9 ? ` ${nm9}${koRo9(nm9)} ` : " " }, { raw: v9 }, { text: " 일꾼 견제" }];
      }
      return [{ raw: v9 ?? pick9 }, { text: nm9 ? ` ${nm9} 일꾼 견제 당함` : " 일꾼 견제 당함" }];
    }
    /* 기지 피해 — 그 장면에서 **주인공이 든 짝** 가운데 건물을 가장 많이 부순 짝(k>v)의, v 가 장면 머리에 갖고 있던 건물 몸값 대비 잃은 몫으로 단을 가른다(RAZE9).
       20% 아래는 "건물 파괴". */
    let bk9 = ""; let bv9 = ""; let bw9 = 0;
    for (const [key9, w9] of sc9.bldPair) {
      const [k9, v9] = key9.split(">");
      if ((k9 === pick9 || v9 === pick9) && w9 > bw9) { bw9 = w9; bk9 = k9; bv9 = v9; }
    }
    if (bk9 && bv9) {
      /* ★ **그 기지가 이미 입은 피해까지 셈한다**(2026-10-10, 요청: "이미 반파된 기지에 뒤늦게 가서 대파시킨 경우 — 마무리지음 · A가 이어서 B 기지를 대파시킴 · 궤멸시킴
         이렇게 정당하게 표현") — 옛 단은 '이 장면에 잃은 몸값 ÷ 장면 머리에 남아 있던 **모든** 건물'이라, 반파된 기지에 늦게 와 몇 채 부순 사람이 남은 것의 큰 몫을
         부순 것으로 "궤멸"을 받았다. 이제 그 **기지 하나**(razeOf9 — 부서진 자리 곁)의 RAZE_MEM9 초 전부터의 건물로 앞·뒤 단을 재고:
           앞 단 없음 → "A가 B 기지 반파/대파/궤멸시킴" · 앞 단이 있고 오름: 앞 피해를 낸 사람이 A 면 "A가 이어서 B 기지 대파/궤멸시킴" · 딴 사람이면 "A가 B 기지 마무리지음" ·
           단이 안 오르면 "A가 B 건물 파괴". */
      const rz9 = razeOf9(sc9, bv9);
      const lv9 = (f9: number): number => (f9 >= RAZE9.wipe ? 3 : f9 >= RAZE9.heavy ? 2 : f9 >= RAZE9.half ? 1 : 0);
      const DEG9 = ["", "반파시킴", "대파시킴", "궤멸시킴"];
      const la9 = lv9(rz9.after);
      const lb9 = lv9(rz9.before);
      if (la9 > lb9) {
        if (lb9 === 0) return [{ raw: bk9, p: "ga" }, { text: " " }, { raw: bv9 }, { text: ` 기지 ${DEG9[la9]}` }];
        if (rz9.prior && rz9.prior !== bk9) return [{ raw: bk9, p: "ga" }, { text: " " }, { raw: bv9 }, { text: " 기지 마무리지음" }];
        return [{ raw: bk9, p: "ga" }, { text: " 이어서 " }, { raw: bv9 }, { text: ` 기지 ${DEG9[la9]}` }];
      }
      if (why9 === "건물 파괴" || why9 === "건물 잃음") return [{ raw: bk9, p: "ga" }, { text: " " }, { raw: bv9 }, { text: " 건물 파괴" }];
    } else if (top9 && (why9 === "건물 파괴" || why9 === "건물 잃음")) {
      return [{ raw: why9 === "건물 파괴" ? (top9.vs ?? pick9) : top9.raw }, { text: " 건물 파괴됨" }];
    }
    if (d9?.owner && d9.atks && d9.atks.length > 0) {
      /* ★ 기지 싸움 — **"A가 B 기지 공격"**(위 baseOwner9 ★★ · 공격당한 사람은 그 기지의 임자) · 이름 붙은 공격은 그 공격을 한 한 사람만 "A가 B 기지에 폭탄드랍" ·
         임자 편의 다른 사람은 " · C가 헬프". 주인공이 어느 편이든 글귀는 같다(제3자 서술). */
      const bo9 = d9.owner;
      const a09 = d9.atks[0];
      let ak9 = ""; let aw9 = 0;
      for (const [k9, w9] of sc9.killKind.get(a09) ?? []) if (w9 > aw9) { aw9 = w9; ak9 = k9; }
      const name9 = rushKind9(a09, bo9, sc9.t0) ?? dropKind9(a09, bo9, sc9.t0) ?? (ak9 ? unitDrop9(a09, bo9, sc9.t0, ak9) : null) ?? "공격";   // 저글링러시는 이름 안 붙인다(2026-10-10, 요청: "저글링 러시 이런 거는 화면 보면 아니까 굳이 설명 x")
      const atts9 = name9 === "공격" ? d9.atks : [a09];
      return [...chips9(atts9, "ga"), { text: " " }, { raw: bo9 }, { text: name9 === "공격" ? " 기지 공격" : ` 기지에 ${name9}` },
        ...helpCap9(d9.helps ?? [])];
    }
    if (d9) {
      const foes9 = d9.foes.length > 0 ? d9.foes : [d9.foe];
      /* ★ 공격의 **이름**(2026-10-09, 요청: "자주 나오는 전략 — 포토러시 · 성큰러시 · 9드론 저글링러시 · 폭탄드랍") — 상대 기지의 캐논/성큰(rushKind9) > 수송선이 그 기지로
         간 뒤의 싸움(dropKind9) > 초반 저글링 킬(zlRush9) > 그냥 "공격". 방어 쪽은 "…함"(공격함과 같은 꼴). */
      const attack9 = (att9: string, def9: string): string => rushKind9(att9, def9, sc9.t0) ?? dropKind9(att9, def9, sc9.t0) ?? "공격";   // 저글링러시 이름은 걷었다(2026-10-10)
      /* ★ 공격·방어 다 **"A가 B를 공격"** 서술이다(2026-10-10, 요청: "누가 누구를 공격했는지 주어나 목적어가 화면주인이어도 넣기(자막은 제 3자 느낌으로) · ~의 공격
         말고 서술로") — 옛 공격 "A의 B 공격" · 방어 "A가 공격함 · C가 헬프옴"(화면 주인 B 를 뺐다). 이름 붙은 공격은 "A가 B에게 포토러시". 방어의 팀원은 "C가 헬프". */
      const hit9 = (atts9: string[], defs9: string[], name9: string): CapPart9[] =>
        (name9 === "공격"
          ? [...chips9(atts9, "ga"), { text: " " }, ...chips9(defs9, "eul"), { text: " 공격" }]
          : [...chips9(atts9, "ga"), { text: " " }, ...chips9(defs9), { text: `에게 ${name9}` }]);
      /* 맞은 쪽이 여럿이면 **나열하지 않고 주 상대 하나**(2026-10-11, 요청: "누구누구누구를 공격 이렇게 말고") — 그 팀 전원이면 "N팀 전원"(chips9). */
      const one9 = (raws9: string[], main9: string): string[] => (raws9.length > 1 && chips9(raws9)[0]?.raw !== undefined ? [main9] : raws9);
      if (d9.role === "atk") return hit9([pick9, ...d9.allies], one9(foes9, d9.foe), attack9(pick9, d9.foe));
      if (d9.role === "def") {
        return [...hit9(foes9, [pick9], attack9(d9.foe, pick9)), ...helpCap9(d9.allies)];
      }
      // 교전은 **vs 로 팀을 가른다**(2026-10-09, 요청: "교전 시 vs 로 팀 갈라서 보여주고") — "A·B vs C·D 교전".
      return [...chips9([pick9, ...d9.allies]), { text: " vs " }, ...chips9(foes9), { text: " 교전" }];
    }
    return [{ raw: pick9 }, { text: ` ${sc9.why}` }];
  };
  /** 기지 피해의 자(위 ★) — 그 장면에서 bv 가 잃은 건물 자리의 가운데 RAZE_R9 타일 안, RAZE_MEM9 초 전부터 장면 끝까지 서 있던 bv 의 건물(변태 앞 생애는 뺀다)이 분모 ·
   *  장면 앞에 공격으로 잃은 몫(before) · 장면 끝까지 잃은 몫(after) · 장면 앞 피해를 가장 많이 낸 사람(prior). */
  const RAZE_MEM9 = 240;
  const RAZE_R9 = 22;
  const razeOf9 = (sc9: Sc9, bv9: string): { before: number; after: number; prior: string | null } => {
    const own9 = ownersOf9(bv9);
    let sx9 = 0; let sy9 = 0; let n9 = 0;
    for (const d9 of ds9) {
      if (!d9.bld || !own9.has(d9.owner) || d9.sec < sc9.t0 - 0.1 || d9.sec > sc9.t1 + 0.1 || d9.x === undefined || d9.y === undefined) continue;
      sx9 += d9.x; sy9 += d9.y; n9 += 1;
    }
    const near9 = (x9: number, y9: number): boolean => n9 === 0 || Math.hypot(x9 - sx9 / n9, y9 - sy9 / n9) <= RAZE_R9;
    const from9 = sc9.t0 - RAZE_MEM9;
    let all9 = 0; let lb9 = 0; let la9 = 0;
    for (const e9 of world.lives) {
      if (!e9.bld || !own9.has(e9.owner) || e9.born > sc9.t1 || (e9.died !== null && e9.died < from9) || e9.end === "morph" || !near9(e9.bornX, e9.bornY)) continue;
      const v9 = castValue9(e9.kind);
      all9 += v9;
      if (e9.died !== null && e9.end === "atk") { if (e9.died < sc9.t0 - 0.1) lb9 += v9; else if (e9.died <= sc9.t1 + 0.5) la9 += v9; }
    }
    const by9 = new Map<string, number>();
    for (const d9 of ds9) {
      if (!d9.bld || !own9.has(d9.owner) || d9.sec < from9 || d9.sec >= sc9.t0 - 0.1 || d9.killer < 0 || d9.x === undefined || d9.y === undefined || !near9(d9.x, d9.y)) continue;
      const k9 = rawOf9.get(d9.killer);
      if (k9) by9.set(k9, (by9.get(k9) ?? 0) + d9.v);
    }
    let prior9: string | null = null; let pw9 = 0;
    for (const [k9, w9] of by9) if (w9 > pw9) { pw9 = w9; prior9 = k9; }
    return all9 > 0 ? { before: lb9 / all9, after: (lb9 + la9) / all9, prior: prior9 } : { before: 0, after: 0, prior: null };
  };
  /** 그 사람이 sec 에 갖고 있던 건물 몸값의 합(기지 피해 단의 분모 · 짓는 중인 것도 든다). */
  const baseValue9 = (raw9: string, sec9: number): number => {
    const own9 = ownersOf9(raw9);
    let v9 = 0;
    for (const e9 of world.lives) {
      if (!e9.bld || !own9.has(e9.owner) || e9.born > sec9 || (e9.died !== null && e9.died <= sec9)) continue;
      v9 += castValue9(e9.kind);
    }
    return v9;
  };
  /** 순환 토막 — 그 사람의 창 [t0, t1) 에서 연구 완료 > 빌드 이정표(창 안 > 최근) > 그 밖의 건설 > 국면 요약 차례로 찾는다. */
  const HALL9 = new Set(["Command Center", "Nexus", "Hatchery"]);
  const PLAIN_BLD9 = new Set(["Supply Depot", "Pylon", "Extractor", "Refinery", "Assimilator", "Creep Colony"]);
  const ownersOf9 = (raw9: string): Set<number> => new Set([...rawOf9.entries()].filter(([, n9]) => n9 === raw9).map(([o9]) => o9));
  /* ★★ **빌드 읽기**(2026-10-09, 요청: "소강 상태에서 '누구 운영'이라는 자막보다는 순조로운 테크/발전 중 · 빠른 넥서스/커맨드 늘리기 · 선스포닝풀/노스포닝풀 해처리 등
     초반/중반 빌드에 대한 분석이 들어가면 좋을듯") ─────────────────────────────────────────────────────────────
     그 사람의 건물 **착공 차례**(world.lives · born — 레어로 변태한 해처리의 앞 생애도 착공이다)에서 이정표를 뽑는다(buildMiles9):
       · 둘째 본진이 핵심 테크(스포닝풀 · 코어 · 팩토리)보다 먼저 → "빠른 넥서스/커맨드 늘리기" · 저그는 "노스포닝풀 해처리"(셋째까지 먼저면 "노스포닝풀 3해처리") ·
         스포닝풀이 먼저면 "선스포닝풀" → 그 뒤 해처리는 "선스포닝풀 후 해처리" · 테크 뒤의 둘째는 "앞마당 … 늘리기" · 셋째부터 "N번째 … 늘리기"/"N해처리 늘리기"
       · 포지가 게이트보다 먼저 → "선포지"(그 뒤 넥서스가 게이트보다 먼저면 "선포지 더블넥서스") · 익스트랙터가 스포닝풀보다 먼저 → "선가스"
       · 둘째·셋째 생산 건물 → "2게이트/3게이트" · "2배럭/3배럭" · "2팩/3팩" · 테크 건물은 TECH_MILE9 의 이름("로보틱스 건설" … · 2026-10-11 옛 "… 테크") · 아홉 드론 아래 스포닝풀 "N드론 스포닝풀 건설"(러시라
         단정하지 않는다 · 2026-10-10) ·
         상대 기지 안의 캐논·성큰 "A의 B 포토러시/성큰러시"(rushes9 — 장면 자막의 공격 이름도 이것)
     자막은 창 안의 이정표 > 창 앞 MILE_RECENT9 초 안의 마지막 이정표 > 그 밖의 건물 건설(옛 "X 건설") > 국면 요약(phaseCap9: 최근 테크 → "순조로운 테크/발전 중" ·
     본진 셋 이상 → "N기지 운영 중" · 병력이 한창 나오면 "병력 모으는 중" · 그 밖 "순조로운 발전 중"). 옛 "확장"·"운영" 글귀는 걷었다.
     🔎 cast-plan.mjs ⑧ 빌드 읽기. */
  /* ★ 이정표 글귀는 **"X 건설"**(2026-10-11, 요청: "~ 테크를 ~ 건설로 변경 — 테크는 메카닉 테크 · 핵 테크 이렇게 전술적인 느낌에 쓰는 경우가 많아") — 옛 "로보틱스 테크"
     꼴은 걷었다. 저그의 변태(레어·하이브·그레이터 스파이어)는 짓는 것이 아니라 "변태". 열쇠(어느 건물이 이정표인가 · 국면 요약의 '최근 테크' 자)는 그대로. */
  const TECH_MILE9: Record<string, string> = {
    "Cybernetics Core": "코어 건설", "Robotics Facility": "로보틱스 건설", Stargate: "스타게이트 건설", "Citadel of Adun": "시타델 건설", "Templar Archives": "템플러 아카이브 건설",
    "Robotics Support Bay": "서포트 베이 건설", Observatory: "옵저버토리 건설", "Fleet Beacon": "플릿 비콘 건설", "Arbiter Tribunal": "아비터 트리뷰널 건설",
    Factory: "팩토리 건설", Starport: "스타포트 건설", Armory: "아머리 건설", Academy: "아카데미 건설", "Science Facility": "사이언스 퍼실리티 건설",
    "Engineering Bay": "엔지니어링 베이 건설", "Machine Shop": "머신샵 건설", "Control Tower": "컨트롤 타워 건설", "Covert Ops": "커버트 옵스 건설", "Physics Lab": "피직스 랩 건설",
    Lair: "레어 변태", Spire: "스파이어 건설", "Hydralisk Den": "히드라 덴 건설", "Evolution Chamber": "에볼루션 챔버 건설", "Queen's Nest": "퀸즈 네스트 건설",
    Hive: "하이브 변태", "Ultralisk Cavern": "울트라리스크 캐번 건설", "Defiler Mound": "디파일러 마운드 건설", "Greater Spire": "그레이터 스파이어 변태",
  };
  /** 종족의 핵심 테크 — 둘째 본진·둘째 생산 건물이 이보다 먼저면 '빠른'·'투…'다. */
  const CORE_TECH9: Record<string, string> = { Nexus: "Cybernetics Core", "Command Center": "Factory", Hatchery: "Spawning Pool" };
  /* 둘째·셋째 생산 건물(2026-10-09, 요청: "자주 나오는 전략 — 3게이트") — 숫자 이름. 둘째는 핵심 테크(코어·팩토리) 앞일 때, 셋째는 윗 테크(ADV9) 앞이면 늘(코어 뒤 3게이트도
     3게이트다) · 팩토리는 늘. */
  const PROD9: Record<string, [string, string]> = { Gateway: ["2게이트", "3게이트"], Barracks: ["2배럭", "3배럭"], Factory: ["2팩", "3팩"] };
  const ADV9 = new Set(["Robotics Facility", "Stargate", "Citadel of Adun", "Templar Archives", "Starport", "Armory", "Science Facility"]);
  /** 러시 건물 — 상대 기지(본진 건물 BASE_R9 안)에 세운 것의 글귀(요청: "포토러시 · 성큰러시"). */
  const RUSH_BLD9: Record<string, string> = { "Photon Cannon": "포토러시", "Sunken Colony": "성큰러시", "Creep Colony": "성큰러시" };
  const PROXY_KO9: Record<string, string> = { Gateway: "게이트", Barracks: "배럭", Factory: "팩토리", Starport: "스타포트", Stargate: "스타게이트" };
  const HALL_KO9: Record<string, string> = { Nexus: "넥서스", "Command Center": "커맨드", Hatchery: "해처리" };
  /** 이정표를 창 앞 이만큼(초)까지 되짚는다 — 그보다 오래면 국면 요약으로. */
  const MILE_RECENT9 = 120;
  /** 국면 요약의 '최근 테크'(초) · '병력이 한창'의 창(초)과 수. */
  const PHASE9 = { tech: 240, armyWin: 60, armyN: 4, prodWin: 90, upAhead: 120, calm: 60 };
  /** 생산 건물 — 짓는 것은 "생산 건물 늘리는 중"으로 말한다(이름 하나하나는 군말). */
  const PROD_BLD9 = new Set(["Gateway", "Barracks", "Factory", "Starport", "Stargate"]);
  const WORKER9 = new Set(["SCV", "Probe", "Drone"]);
  const NON_ARMY9 = new Set(["Larva", "Egg", "Overlord", "Cocoon", "Lurker Egg", "Scarab", "Interceptor", "Broodling"]);
  /** 그 자리가 **같은 편의 기지**인가 — 같은 편(teamOf 같음)의 살아 있는 본진 건물 또는 출발 자리가 BASE_R9 안이면 그 사람. 밀리·팀 모름이면 없다. */
  const allyBaseAt9 = (raw9: string, x9: number, y9: number, sec9: number): string | null => {
    const tm9 = opts.teamOf?.[raw9];
    if (tm9 === undefined) return null;
    for (const r9 of new Set(rawOf9.values())) {
      if (r9 === raw9 || opts.teamOf?.[r9] !== tm9) continue;
      if (hallsAt9(r9, sec9).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, x9, y9))) return r9;
      const st9 = start9.get(r9);
      if (st9 && Math.hypot(st9.x - x9, st9.y - y9) <= BASE_R9) return r9;
    }
    return null;
  };
  /** 그 사람이 sec 앞 LOST_W9 초 동안 잃은 건물 몸값 / 그때 기지 몸값 — "이사"의 자(대파 RAZE9.heavy 이상). */
  const LOST_W9 = 300;
  const lostFrac9 = (raw9: string, sec9: number): number => {
    const own9 = ownersOf9(raw9);
    let lost9 = 0;
    for (const e9 of world.lives) {
      if (e9.bld && own9.has(e9.owner) && e9.end === "atk" && e9.died !== null && e9.died > sec9 - LOST_W9 && e9.died <= sec9) lost9 += castValue9(e9.kind);
    }
    const base9 = baseValue9(raw9, sec9 - LOST_W9);
    return base9 > 0 ? lost9 / base9 : 0;
  };
  /** 그 사람의 **앞마당** 무더기 — 출발 자리가 먹는 무더기를 뺀, 출발 자리에서 가장 가까운 무더기(NATURAL_R9 타일 안). 자원 자료가 없거나 없으면 -1. */
  const NATURAL_R9 = 40;
  const natOf9 = new Map<string, number>();
  const naturalOf9 = (raw9: string): number => {
    const got9 = natOf9.get(raw9);
    if (got9 !== undefined) return got9;
    const st9 = start9.get(raw9);
    let best9 = -1;
    if (st9) {
      const main9 = new Set(groupsNear9(st9.x, st9.y));
      let bd9 = NATURAL_R9;
      for (let i9 = 0; i9 < resGroups9.length; i9 += 1) {
        if (main9.has(i9)) continue;
        const d9 = groupDist9(resGroups9[i9], st9.x, st9.y);
        if (d9 <= bd9) { bd9 = d9; best9 = i9; }
      }
    }
    natOf9.set(raw9, best9);
    return best9;
  };
  type Mile9 = { at: number; caps: CapPart9[] };
  /** 그 사람의 빌드 이정표(착공 시각 차례) — 한 번 세어 두고 자막마다 짚는다. */
  const milesOf9 = new Map<string, Mile9[]>();
  const buildMiles9 = (raw9: string): Mile9[] => {
    const got9 = milesOf9.get(raw9);
    if (got9) return got9;
    const own9 = ownersOf9(raw9);
    const blds9 = world.lives
      .filter((e9) => e9.bld && own9.has(e9.owner) && !e9.handoff && (!PLAIN_BLD9.has(e9.kind) || e9.kind === "Extractor" || e9.kind === "Creep Colony"))
      .sort((a9, b9) => a9.born - b9.born);
    const miles9: Mile9[] = [];
    const mile9 = (at9: number, text9: string): void => { miles9.push({ at: at9, caps: [{ raw: raw9 }, { text: ` ${text9}` }] }); };
    const mileVs9 = (at9: number, foe9: string, text9: string): void => { miles9.push({ at: at9, caps: [{ raw: raw9, p: "ga" }, { text: " " }, { raw: foe9 }, { text: `에게 ${text9}` }] }); };
    /** 그때 살아 있던 드론 수(9드론 저글링러시의 자). */
    const dronesAt9 = (sec9: number): number => {
      let n9 = 0;
      for (const e9 of world.lives) if (!e9.bld && e9.kind === "Drone" && own9.has(e9.owner) && e9.born <= sec9 && (e9.died === null || e9.died > sec9)) n9 += 1;
      return n9;
    };
    const rushList9: [number, string, string][] = [];
    rushes9.set(raw9, rushList9);
    const rushed9 = new Map<string, number>();   // "상대|글귀" → 마지막 착공(같은 러시의 캐논 여럿은 한 이정표)
    const halls9: string[] = [];        // 착공한 본진 종류(처음 것은 born 0 이라 안 든다 — 둘째부터)
    let hallKind9 = "";
    for (const p9 of world.players) if (own9.has(p9.owner)) hallKind9 = p9.race === "저그" ? "Hatchery" : p9.race === "프로토스" ? "Nexus" : p9.race === "테란" ? "Command Center" : "";
    if (!hallKind9) { const h9 = blds9.find((e9) => HALL9.has(e9.kind)); hallKind9 = h9?.kind ?? (blds9.some((e9) => e9.kind === "Gateway" || e9.kind === "Forge") ? "Nexus" : blds9.some((e9) => e9.kind === "Barracks") ? "Command Center" : "Hatchery"); }
    const coreTech9 = CORE_TECH9[hallKind9] ?? "";
    let coreAt9 = Infinity;            // 핵심 테크 착공 시각
    let advAt9 = Infinity;             // 윗 테크(ADV9) 착공 시각
    let firstProdAt9 = Infinity;       // 첫 생산 건물(게이트·배럭) 착공
    let forgeFirst9 = false;
    const prodN9 = new Map<string, number>();
    const seen9 = new Set<string>();
    let hallN9 = 0;
    /** ★ 전진·몰래 생산 건물(2026-10-10, 요청: "몰래배럭, 전진 건설(게이트/팩토리/배럭 등) 전략 판단 필요") — 자는 아래 proxyAt9. */
    /** 그 자리를 [t, tEnd] 사이에 적이 봤나 — 적 건물(그 사이 서 있던 것)의 시야 · 적 유닛의 명령 자리(그 사이)의 시야 안이면 본 것이다. */
    const seenByFoe9 = (x9: number, y9: number, t9: number, tEnd9: number): boolean => {
      for (const f9 of world.lives) {
        const fr9 = rawOf9.get(f9.owner);
        if (!fr9 || fr9 === raw9 || (opts.teamOf?.[fr9] !== undefined && opts.teamOf?.[fr9] === opts.teamOf?.[raw9])) continue;
        if (f9.born > tEnd9 || (f9.died !== null && f9.died < t9)) continue;
        const r9 = sightTiles(f9.kind) + 1;
        if (f9.bld) { if (Math.hypot(f9.bornX - x9, f9.bornY - y9) <= r9) return true; continue; }
        for (const o9 of f9.orders) {
          if (o9[0] > tEnd9) break;
          if (o9[0] >= t9 - 5 && Math.hypot(o9[1] - x9, o9[2] - y9) <= r9) return true;
        }
      }
      return false;
    };
    /** 그 자리·때의 전진/몰래 — 적 기지 앞·안이고 제 기지(멀티 포함)보다 훨씬 가까움. 적 기지 안이고 **적이 못 봤으면** "몰래", 그 밖은 "전진"(2026-10-10, 되요청:
     *  "몰래는 적기지에 짓는거" · "몰래의 특징은 적 시야에 안 보여야 한다는 것"). 지은 것은 [착공, 완공], 띄워 옮긴 것은 [착륙, +20초] 동안 봤나를 본다. */
    const proxyAt9 = (x9: number, y9: number, t9: number, tEnd9: number): string => {
      /* ★ 전진은 **적 기지 앞이나 안**이고 **제 기지(멀티 포함)보다 적 기지에 훨씬 가까운** 자리다(2026-10-10, 되요청: "멀티에 짓는 생산 건물은 전진이 아님 · 전진은 내 기지보다
         (멀티 포함) 적 기지에 훨씬 가깝게 지은 거 · 거의 적 기지 앞이나 안") — 적 본진 건물·출발 자리까지 PROXY_FRONT9(BASE_R9+12) 안이고, 제 본진 건물·출발 자리까지의
         거리가 그 PROXY_FAR9(2) 배를 넘을 때만. 그 가운데 적 기지(BASE_R9) 안이고 적이 못 봤으면 "몰래". */
      const st9 = start9.get(raw9);
      const ownPts9: [number, number][] = [...hallsOfOwner9(own9, t9)];
      if (st9) ownPts9.push([st9.x, st9.y]);
      if (ownPts9.length === 0) return "";
      const dOwn9 = Math.min(...ownPts9.map(([hx9, hy9]) => Math.hypot(hx9 - x9, hy9 - y9)));
      if (allyBaseAt9(raw9, x9, y9, t9)) return "";
      let dFoe9 = Infinity; let inBase9 = false;
      for (const r9 of new Set(rawOf9.values())) {
        if (r9 === raw9 || (opts.teamOf?.[r9] !== undefined && opts.teamOf?.[r9] === opts.teamOf?.[raw9])) continue;
        const pts9: [number, number][] = [...hallsAt9(r9, t9)];
        const sf9 = start9.get(r9); if (sf9) pts9.push([sf9.x, sf9.y]);
        for (const [hx9, hy9] of pts9) {
          const d9 = Math.hypot(hx9 - x9, hy9 - y9);
          if (d9 < dFoe9) dFoe9 = d9;
          if (d9 <= BASE_R9) inBase9 = true;
        }
      }
      if (!(dFoe9 <= PROXY_FRONT9) || !(dOwn9 > dFoe9 * PROXY_FAR9)) return "";
      if (inBase9 && !seenByFoe9(x9, y9, t9, tEnd9)) return "몰래";
      return "전진";
    };
    const proxyOf9 = (e9: (typeof blds9)[number]): string =>
      proxyAt9(e9.bornX, e9.bornY, e9.born, Number.isFinite(e9.doneAt) ? Math.max(e9.doneAt, e9.born) : e9.born + 60);
    for (const e9 of blds9) {
      const k9 = e9.kind;
      const n9 = (prodN9.get(k9) ?? 0) + 1;
      prodN9.set(k9, n9);
      /* 센터 방어 건물(포토·벙커·터렛·성큰·스포어) — 지도 한가운데(짧은 변 × CENTER_K9.def) · 제 본진 건물 곁이 아닌 것. */
      if (CENTER_DEF9[k9] && inCenter9(e9.bornX, e9.bornY, CENTER_K9.def)
        && !hallsOfOwner9(own9, e9.born).some(([hx9, hy9]) => Math.hypot(hx9 - e9.bornX, hy9 - e9.bornY) <= BASE_R9)) {
        mile9(e9.born, `센터 ${CENTER_DEF9[k9]}`);
        continue;
      }
      /* ★ 테란은 **지어서 띄워 옮긴다**(2026-10-10, 요청: "테란의 경우 건물을 지어서 적 기지로 옮길 수가 있어 그런 경우도 몰래/전진으로") — 옮겨 앉은 자리(sites 둘째부터)도
         같은 자로 본다. 착공 자리가 이미 전진/몰래였으면 그것 하나만. */
      if (PROXY_KO9[k9] && e9.sites.length > 1 && !proxyOf9(e9)) {
        for (const [ls9, lx9, ly9] of e9.sites.slice(1)) {
          const lp9 = proxyAt9(lx9 + 1, ly9 + 1, ls9, ls9 + 20);
          if (lp9) { mile9(ls9, `${lp9} ${PROXY_KO9[k9]}`); break; }
        }
      }
      const px9 = PROXY_KO9[k9] ? proxyOf9(e9) : "";
      if (px9) {
        mile9(e9.born, `${px9} ${PROXY_KO9[k9]}`);
        if (PROD9[k9] && firstProdAt9 === Infinity) firstProdAt9 = e9.born;
        if (k9 === coreTech9 && coreAt9 === Infinity) { coreAt9 = e9.born; seen9.add(k9); }
        if (ADV9.has(k9) && advAt9 === Infinity) advAt9 = e9.born;
        continue;
      }
      const rushText9 = RUSH_BLD9[k9];
      if (rushText9) {
        /* 상대 기지 안의 캐논·성큰(크립 콜로니 포함) → "A의 B 포토러시"(요청: 포토러시 · 성큰러시). 같은 러시의 건물 여럿은 RUSH_W9 안이면 한 이정표. */
        for (const [o9, foeRaw9] of rawOf9) {
          if (own9.has(o9) || (opts.teamOf?.[foeRaw9] !== undefined && opts.teamOf?.[foeRaw9] === opts.teamOf?.[raw9])) continue;
          if (!hallsAt9(foeRaw9, e9.born).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, e9.bornX, e9.bornY))) continue;
          const key9 = `${foeRaw9}|${rushText9}`;
          const last9 = rushed9.get(key9);
          rushed9.set(key9, e9.born);
          rushList9.push([e9.born, foeRaw9, rushText9]);
          if (last9 === undefined || e9.born - last9 > RUSH_W9) mileVs9(e9.born, foeRaw9, rushText9);
          break;
        }
        if (k9 === "Creep Colony") continue;
      }
      if (k9 === coreTech9 && coreAt9 === Infinity) {
        coreAt9 = e9.born;
        seen9.add(k9);
        if (k9 === "Spawning Pool") {
          const dn9 = dronesAt9(e9.born);
          /* 아홉 드론 아래의 스포닝풀은 드론 수를 그대로 적는다 — "N드론 스포닝풀 건설"(2026-10-10, 되지적: "9드론에 스포닝풀 지었는데 바로 저글링러시라고 나오면 안 될 듯 —
             아직 모르는 건 넣지 말고 확실하게 알아낸 것만"). 러시인지는 저글링이 실제로 치는 장면(zlRush9)이 말한다. 드론을 안 세는 판(0)은 그냥 스포닝풀. */
          mile9(e9.born, dn9 >= 4 && dn9 <= 9 ? `${dn9}드론 스포닝풀 건설` : halls9.length === 0 ? "선스포닝풀" : "해처리 후 스포닝풀");
        } else mile9(e9.born, TECH_MILE9[k9] ?? `${BUILDING_KO[k9] ?? k9} 건설`);
        continue;
      }
      if (ADV9.has(k9) && advAt9 === Infinity) advAt9 = e9.born;
      if (k9 === "Extractor") { if (coreAt9 === Infinity && hallKind9 === "Hatchery" && n9 === 1) mile9(e9.born, "선가스"); continue; }
      if (k9 === "Forge" && n9 === 1 && firstProdAt9 === Infinity && hallKind9 === "Nexus") { forgeFirst9 = true; mile9(e9.born, "선포지"); continue; }
      if (PROD9[k9]) {
        if (firstProdAt9 === Infinity) firstProdAt9 = e9.born;
        if (k9 === "Factory" ? (n9 === 2 || n9 === 3) : (n9 === 2 && coreAt9 === Infinity) || (n9 === 3 && advAt9 === Infinity)) mile9(e9.born, PROD9[k9][n9 - 2]);
        continue;
      }
      if (HALL9.has(k9)) {
        /* 처음 본진(born 0 · 덤프가 늦게 시작해도 첫 몇 초)은 이정표가 아니다. 변태로 끝난 해처리(레어가 된 것)도 착공은 착공 — 같은 태그의 레어 생애는 TECH_MILE9 로 따로 선다. */
        hallN9 += 1;
        if (hallN9 === 1 && e9.born < 5) continue;
        halls9.push(k9);
        /* ★ 본진 건물의 이름은 **그 순간의 사실**로 가른다(2026-10-10, 지적: "기지가 대파돼서 아군 기지로 이사 가서 새로 해처리를 짓는데 7해처리라고 나와 — 누구 기지로 이사 ·
           빨무같이 앞마당 없는 맵인데 앞마당 넥서스 — 3넥서스. 자원 무더기가 따로 있는 맵만 앞마당·멀티") — 옛 '지은 차례(누적)'는 잃은 본진까지 세어 7해처리가 됐다.
           ① 같은 편 기지(그 편의 살아 있는 본진 건물 또는 출발 자리 BASE_R9 안) → 제 기지를 잃었거나 대파됐으면 "[P] [A] 기지로 이사" · 아니면 "[P] [A] 기지에 해처리 건설"
           ② 제 본진 건물이 하나도 없으면 → 출발 자리 곁 "본진 재건" · 딴 곳 "새 기지로 이사"
           ③ 아무도(제 것) 안 먹는 자원 무더기 곁 → 새 기지: 출발 자리에서 가장 가까운 딴 무더기면 "앞마당 …"(둘째 기지일 때 빌드 이름 — 노스포닝풀·선포지 더블넥서스·노배럭
              더블커맨드·빠른) · 그 밖은 "첫 멀티 / N번째 멀티"
           ④ 그 밖(같은 무더기 · 무더기 없음 · 자원 자료 없음) → 살아 있는 본진 건물 수 "3넥서스 · 3해처리 · 2커맨드"(스포닝풀 전이면 "노스포닝풀 2해처리"). */
        const t9 = e9.born;
        const hallsNow9 = world.lives.filter((h9) => h9 !== e9 && h9.bld && own9.has(h9.owner) && HALL_ANY9.has(h9.kind) && h9.born <= t9 && (h9.died === null || h9.died > t9))
          .map((h9): Hall9 => ({ x: h9.bornX, y: h9.bornY }));
        const ko9 = HALL_KO9[hallKind9] ?? "본진";
        const ally9 = allyBaseAt9(raw9, e9.bornX, e9.bornY, t9);
        if (ally9) {
          const home9 = hallsNow9.filter((h9) => !allyBaseAt9(raw9, h9.x, h9.y, t9));
          const moved9 = home9.length === 0 || lostFrac9(raw9, t9) >= RAZE9.heavy;
          miles9.push({ at: t9, caps: [{ raw: raw9 }, { text: " " }, { raw: ally9 }, { text: moved9 ? " 기지로 이사" : ` 기지에 ${ko9} 건설` }] });
          continue;
        }
        if (hallsNow9.length === 0) {
          const st9 = start9.get(raw9);
          mile9(t9, st9 && Math.hypot(st9.x - e9.bornX, st9.y - e9.bornY) <= BASE_R9 ? "본진 재건" : "새 기지로 이사");
          continue;
        }
        const mine9 = groupsNear9(e9.bornX, e9.bornY);
        const fed9 = new Set(hallsNow9.flatMap((h9) => groupsNear9(h9.x, h9.y)));
        if (mine9.length > 0 && mine9.every((g9) => !fed9.has(g9))) {
          const nat9 = naturalOf9(raw9);
          const before9 = basesOf9(hallsNow9);
          let text9: string;
          if (nat9 >= 0 && mine9.includes(nat9)) {
            if (before9 > 1) text9 = `앞마당 ${ko9}`;
            else if (hallKind9 === "Hatchery") text9 = coreAt9 === Infinity ? "노스포닝풀 앞마당 해처리" : "앞마당 해처리";
            else if (hallKind9 === "Nexus") text9 = forgeFirst9 && firstProdAt9 === Infinity ? "선포지 더블넥서스" : coreAt9 === Infinity ? "빠른 앞마당 넥서스" : "앞마당 넥서스";
            else text9 = firstProdAt9 === Infinity ? "노배럭 더블커맨드" : coreAt9 === Infinity ? `빠른 앞마당 ${ko9}` : `앞마당 ${ko9}`;
          } else text9 = before9 <= 1 ? "첫 멀티" : `${before9}번째 멀티`;
          mile9(t9, text9);
          continue;
        }
        const n9 = hallsNow9.length + 1;
        mile9(t9, hallKind9 === "Hatchery" ? (coreAt9 === Infinity ? `노스포닝풀 ${n9}해처리` : `${n9}해처리`) : `${n9}${ko9}`);
        continue;
      }
      const t9 = TECH_MILE9[k9];
      if (t9 && !seen9.has(k9)) { seen9.add(k9); mile9(e9.born, t9); }
    }
    for (const tc9 of tacticsOf9(raw9)) miles9.push({ at: tc9.at, caps: tc9.caps });
    miles9.sort((a9, b9) => a9.at - b9.at);
    milesOf9.set(raw9, miles9);
    return miles9;
  };
  /** 국면 요약 — 창 끝 시각의 그 사람. */
  const phaseCap9 = (raw9: string, sec9: number): string => {
    const own9 = ownersOf9(raw9);
    const halls9: Hall9[] = []; let lastTech9 = -Infinity; let army9 = 0;
    for (const e9 of world.lives) {
      if (!own9.has(e9.owner) || e9.handoff || e9.born > sec9) continue;
      if (e9.bld) {
        if (HALL_ANY9.has(e9.kind) && (e9.died === null || e9.died > sec9)) halls9.push({ x: e9.bornX, y: e9.bornY });
        if (TECH_MILE9[e9.kind] && e9.born > lastTech9) lastTech9 = e9.born;
      } else if (e9.born >= sec9 - PHASE9.armyWin && !WORKER9.has(e9.kind) && !NON_ARMY9.has(e9.kind) && castValue9(e9.kind) > 0) army9 += 1;
    }
    /* 기지 수는 본진 건물 수가 아니라 **기지**(basesOf9 — 2026-10-10: 빨무 본진의 넥서스 셋은 1기지다). */
    const bases9 = basesOf9(halls9);
    /* 센터 장악 — 그 순간 센터(짧은 변 × CENTER_K9.hold)에 선 제 병력·건물이 CENTER_HOLD9.n 이상이고 적의 CENTER_HOLD9.k 배 이상. */
    if (mapC9) {
      const foes9 = new Set(foeOwners9(raw9));
      let mine9 = 0; let theirs9 = 0;
      for (const e9 of world.lives) {
        if (e9.born > sec9 || (e9.died !== null && e9.died <= sec9) || WORKER9.has(e9.kind) || NON_ARMY9.has(e9.kind)) continue;
        if (!e9.bld && castValue9(e9.kind) <= 0) continue;
        const [x9, y9] = e9.bld ? [e9.bornX, e9.bornY] : posAt9(e9, sec9);
        if (!inCenter9(x9, y9, CENTER_K9.hold)) continue;
        if (own9.has(e9.owner)) mine9 += 1; else if (foes9.has(e9.owner)) theirs9 += 1;
      }
      if (mine9 >= CENTER_HOLD9.n && mine9 >= theirs9 * CENTER_HOLD9.k) return "센터 장악";
    }
    /* 병력 구성 — 그 순간 살아 있는 제 병력(일꾼·오버로드 등 뺌)으로 가른다. */
    {
      let all9 = 0; let bio9 = 0; let mech9 = 0; let goon9 = 0; let ultra9 = 0; let ling9 = 0;
      for (const e9 of world.lives) {
        if (!own9.has(e9.owner) || e9.bld || e9.born > sec9 || (e9.died !== null && e9.died <= sec9)) continue;
        if (WORKER9.has(e9.kind) || NON_ARMY9.has(e9.kind) || castValue9(e9.kind) <= 0) continue;
        all9 += 1;
        if (BIO9.has(e9.kind)) bio9 += 1;
        if (MECH9.has(e9.kind)) mech9 += 1;
        if (e9.kind === "Dragoon") goon9 += 1;
        if (e9.kind === "Ultralisk") ultra9 += 1;
        if (e9.kind === "Zergling") ling9 += 1;
      }
      const adrenal9 = world.ups.some(([us9, n9, uo9]) => own9.has(uo9) && us9 <= sec9 && /^Adrenal Glands/.test(n9));
      if (adrenal9 && ultra9 >= COMP9.ultra && ling9 >= COMP9.ling) return "목동저그(아드레날린 저글링 + 울트라)";
      if (all9 >= COMP9.n) {
        if (goon9 >= COMP9.n && goon9 >= all9 * COMP9.k) return "파워 드라군";
        if (bio9 >= all9 * COMP9.k) return "바이오닉 운영";
        if (mech9 >= all9 * COMP9.k) return "메카닉 운영";
      }
    }
    /* ★ 소강의 말(2026-10-10, 요청: "파일런 건설은 굳이 안 나와도 되는 자막 — 순조롭게 발전 중 · 생산건물 늘리는 중 · 업그레이드 진행 중 등등을 표현하는 게 나음") —
       생산 건물이 PHASE9.prodWin 초 안에 둘 넘게 섰으면 "생산 건물 늘리는 중" · 연구가 PHASE9.upAhead 초 안에 끝나면(곧 지금 돌고 있으면) "업그레이드 진행 중". */
    let prod9 = 0;
    for (const e9 of world.lives) if (e9.bld && own9.has(e9.owner) && PROD_BLD9.has(e9.kind) && e9.born <= sec9 && e9.born >= sec9 - PHASE9.prodWin && e9.end !== "morph") prod9 += 1;
    if (prod9 >= 2) return "생산 건물 늘리는 중";
    /* 실제로 도는 연구를 **이름으로 나열**(2026-10-11, 요청: "그냥 업그레이드 진행 중 → 무슨 업그레이드인지 · 여러 개면 여러 개 나열") — 셋까지 "A·B 연구 중". */
    {
      const ups9: string[] = [];
      for (const [us9, un9, uo9] of world.ups) {
        if (!own9.has(uo9) || !researching9(us9, un9, sec9)) continue;
        const m9 = /^(.*?)(?: (\d+))?$/.exec(un9);
        const ko9 = `${researchKo(m9?.[1] ?? un9)}${m9?.[2] ? ` ${m9[2]}단계` : ""}`;
        if (!ups9.includes(ko9)) ups9.push(ko9);
      }
      if (ups9.length > 0) return `${ups9.slice(0, 3).join("·")}${ups9.length > 3 ? " 등" : ""} 연구 중`;
    }
    if (sec9 - lastTech9 <= PHASE9.tech) return "테크 올리는 중";
    if (bases9 >= 3) return `${bases9}기지 운영 중`;
    if (army9 >= PHASE9.armyN) return "병력 모으는 중";
    /* 끝말(2026-10-11, 요청: "그냥 순조롭게 진행 중 · 평화롭게 발전 중 이런 거가 나을 듯" → 같은 날 "평화롭게 발전 중 → 순조롭게 발전 중이거나 그냥 발전 중으로") —
       PHASE9.calm 초 안에 제 것을 하나도 안 잃었으면 "순조롭게 발전 중", 잃었으면 "발전 중". */
    const lost9 = world.lives.some((e9) => own9.has(e9.owner) && e9.died !== null && e9.died <= sec9 && e9.died > sec9 - PHASE9.calm && e9.end !== "morph");
    return lost9 ? "발전 중" : "순조롭게 발전 중";
  };
  /* ★★ **화면에 나오는 것을 말한다**(2026-10-10, 지적: "화면에서 보여주는 내용이 자막으로 나와야 함 · 업그레이드 보이지 않는데 업그레이드 내용이 나온다거나") ─────
     순환 토막의 카메라는 그 사람이 **고르거나 명령한 무리**를 따른다(재생기 picksOf9 · trackAt). 옛 순환 자막은 그 창에 끝난 연구("메타볼릭 부스트 개발")나 창 밖의
     최근 이정표를 말해, 화면에 없는 일이 자막에 섰다. 이제 그 창에서 **가장 오래 잡힌 무리**(재생기와 같은 자국: 명령 + 선택 · 0.25초 칸)를 말한다:
       · 건물 — 짓는 중이면 "X 건설 중" · 그 곁에서 그 창에 난 유닛이 있으면 "X에서 Y 생산" · 그 건물에서 연구가 진행 중이면(완료가 RESEARCH_AHEAD9 초 안) "X에서 Z 연구 중"
       · 일꾼 — 그 창의 건설 명령이면 "X 건설"(일꾼 이름은 안 붙인다) · 아니면 "일꾼 N기 이동"
       · 병력 — 많은 종류 둘 "마린 12기·메딕 4기" + 그 창의 마지막 명령: 적 기지 안 → "[B] 기지로 공격 이동/이동" · 센터 → "센터로 …" · 그 밖 "공격 이동/이동" · 명령 없으면 "대기".
     차례: 창 안의 빌드 이정표(착공 = 건설 명령 = 그때 화면) > 창 안의 건설 > 화면 무리 > 창 앞 이정표 > 국면 요약. 연구 **완료**는 안 쓴다(골라 둔 건물의 '연구 중'만). */
  const RESEARCH_AHEAD9 = 200;
  /** ★ 연구가 **실제로 도는 동안**만(2026-10-11, 지적: "오버로드 이속 업그레이드가 아직 레어도 없는데 자막에서 나옴") — 옛 문은 '완료가 RESEARCH_AHEAD9(200)초 안'이라
   *  84초짜리 오버로드 속업을 시작 116초 전(레어도 없을 때)부터 '연구 중'이라 했다. ups 는 **완료** 시각만 들므로 시작 = 완료 − 연구 시간(UPGRADE_TIME · 레벨 몫).
   *  표에 없는 기술(스팀팩·스톰 …)은 가장 짧은 1200 프레임(≈ 50초)으로 친다 — 짧게 잡아야 시작 전을 '연구 중'이라 안 한다. 상한은 RESEARCH_AHEAD9 그대로. */
  const researchSec9 = (name9: string): number => {
    const m9 = /^(.*?)(?: (\d+))?$/.exec(name9);
    const base9 = m9?.[1] ?? name9; const lv9 = Number(m9?.[2] ?? 1) || 1;
    return Math.min(RESEARCH_AHEAD9, UPGRADE_TIME[base9] ? upgradeSeconds(base9, lv9) : 1200 * 0.042);
  };
  const researching9 = (us9: string | number, name9: string, at9: number): boolean => Number(us9) > at9 && Number(us9) - researchSec9(name9) <= at9;
  const PICK_STALE9 = 30;
  /** 병력 이동을 말하는 무리의 하한(기) — 그 아래는 군말(2026-10-10). */
  const BIG_ARMY9 = 10;
  const picksMemo9 = new Map<string, [number, number[]][]>();
  const picksOfRaw9 = (raw9: string): [number, number[]][] => {
    const got9 = picksMemo9.get(raw9);
    if (got9) return got9;
    const own9 = ownersOf9(raw9);
    const by9 = new Map<number, Set<number>>();
    const put9 = (s9: number, tg9: number): void => {
      const k9 = Math.round(s9 * 4) / 4;
      const g9 = by9.get(k9);
      if (g9) g9.add(tg9); else by9.set(k9, new Set([tg9]));
    };
    for (const e9 of world.lives) if (own9.has(e9.owner)) for (const o9 of e9.orders) put9(o9[0], e9.tag);
    for (const [s9, o9, tg9, kd9] of world.sels ?? []) {
      if (!own9.has(o9)) continue;
      const k9 = kd9 < 0 ? -1 : kd9 & 15;
      if (k9 === SEL_KIND9.assign || k9 === SEL_KIND9.groupAdd) continue;
      for (const g9 of tg9) put9(s9, g9);
    }
    const out9 = [...by9.entries()].map(([sec9, tags9]): [number, number[]] => [sec9, [...tags9].sort((a9, b9) => a9 - b9)]).sort((a9, b9) => a9[0] - b9[0]);
    picksMemo9.set(raw9, out9);
    return out9;
  };
  const lifeAt9 = (tag9: number, sec9: number): (typeof world.lives)[number] | undefined =>
    livesByTag9.get(tag9)?.find((e9) => e9.born <= sec9 && (e9.died === null || e9.died > sec9));
  /* (걷어냄 · 2026-10-10) 약한 화면 글귀(WEAK9 · '대기' · 일꾼 이동) — 둘 다 이제 안 말한다(screenCap9 ★ 대규모 병력 이동만). */
  const screenCap9 = (raw9: string, t0: number, t1: number): CapPart9[] | null => {
    const picks9 = picksOfRaw9(raw9);
    if (picks9.length === 0) return null;
    /* 창 안에서 무리마다 잡혀 있던 시간 — 창 머리 앞의 마지막 자국부터 센다. */
    let i09 = 0;
    for (let i9 = 0; i9 < picks9.length; i9 += 1) { if (picks9[i9][0] <= t0) i09 = i9; else break; }
    const dur9 = new Map<string, { d: number; tags: number[]; at: number }>();
    for (let i9 = i09; i9 < picks9.length && picks9[i9][0] < t1; i9 += 1) {
      const a9 = Math.max(t0, picks9[i9][0]);
      const b9 = Math.min(t1, i9 + 1 < picks9.length ? picks9[i9 + 1][0] : t1);
      if (b9 <= a9) continue;
      /* 오래전에 골라 둔 채 그대로인 무리(PICK_STALE9 초 넘게 안 건드림)는 화면 글귀가 아니다 — 그 사람이 지금 보고 있다고 못 한다(2026-10-10). */
      if (picks9[i9][0] < t0 - PICK_STALE9) continue;
      const key9 = picks9[i9][1].join(",");
      const g9 = dur9.get(key9);
      if (g9) g9.d += b9 - a9; else dur9.set(key9, { d: b9 - a9, tags: picks9[i9][1], at: (a9 + b9) / 2 });
    }
    let best9: { d: number; tags: number[]; at: number } | null = null;
    for (const g9 of dur9.values()) if (!best9 || g9.d > best9.d) best9 = g9;
    if (!best9) return null;
    const at9 = best9.at;
    const lives9 = best9.tags.map((tg9) => lifeAt9(tg9, at9)).filter((e9): e9 is NonNullable<typeof e9> => !!e9);
    if (lives9.length === 0) return null;
    const own9 = ownersOf9(raw9);
    const blds9 = lives9.filter((e9) => e9.bld);
    if (blds9.length > 0) {
      const b9 = blds9[0];
      const bk9 = BUILDING_KO[b9.kind] ?? b9.kind;
      if (b9.doneAt > at9) {
        if (PLAIN_BLD9.has(b9.kind)) return null;
        return [{ raw: raw9 }, { text: PROD_BLD9.has(b9.kind) ? " 생산 건물 늘리는 중" : ` ${bk9} 건설 중` }];
      }
      const made9 = new Map<string, number>();
      for (const e9 of world.lives) {
        /* 일꾼 생산은 군말이다(2026-10-11, 요청: "일꾼 생산 이런 건 굳이 안 넣어도 될 듯 — 그냥 순조롭게 진행 중 · 평화롭게 발전 중 이런 거가 나을 듯") — 국면 요약으로. */
        if (e9.bld || !own9.has(e9.owner) || e9.born < t0 - 2 || e9.born >= t1 || WORKER9.has(e9.kind)) continue;
        if (NON_ARMY9.has(e9.kind) && e9.kind !== "Overlord") continue;
        if (Math.hypot(e9.bornX - b9.bornX, e9.bornY - b9.bornY) > 6) continue;
        made9.set(e9.kind, (made9.get(e9.kind) ?? 0) + 1);
      }
      let mk9 = ""; let mn9 = 0;
      for (const [k9, n9] of made9) if (n9 > mn9) { mn9 = n9; mk9 = k9; }
      if (mk9) return [{ raw: raw9 }, { text: ` ${UNIT_KO[mk9] ?? mk9} 생산` }];   // "배럭에서"는 군말(2026-10-10, 요청: "~에서는 너무 당연한 거라 빼도 될 듯 그냥 ~생산")
      const up9 = world.ups.find(([us9, un9, uo9, ut9]) => ut9 === b9.tag && own9.has(uo9) && researching9(us9, un9, at9));
      if (up9) {
        const m9 = /^(.*?)(?: (\d+))?$/.exec(up9[1]);
        /* "히드라 덴에서"는 군말(2026-10-11, 요청: "어디서인지는 빼도 되겠지 — 히드라 속업 연구 중 · 중요한 것만 깔끔하게") — 연구 이름만. */
        return [{ raw: raw9 }, { text: ` ${researchKo(m9?.[1] ?? up9[1])}${m9?.[2] ? ` ${m9[2]}단계` : ""} 연구 중` }];
      }
      return null;
    }
    const wk9 = lives9.filter((e9) => WORKER9.has(e9.kind));
    const army9 = lives9.filter((e9) => !WORKER9.has(e9.kind) && !NON_ARMY9.has(e9.kind));
    if (wk9.length > 0 && army9.length === 0) {
      const tags9 = new Set(wk9.map((e9) => e9.tag));
      const bd9 = (world.builds ?? []).find(([bs9, , btg9]) => tags9.has(btg9) && bs9 >= t0 - 2 && bs9 < t1);
      /* 짓는 것은 늘 일꾼이라 "프로브로"는 군말이다(2026-10-10, 요청: "프로브로 파일런 건설 — 당연한 거라 프로브로는 빼") — "[A] 파일런 건설". */
      /* 파일런·서플라이·가스는 군말이다(2026-10-10) — 말하지 않고 국면 요약으로 · 생산 건물은 "생산 건물 늘리는 중". */
      if (bd9 && PLAIN_BLD9.has(bd9[5])) return null;
      if (bd9 && PROD_BLD9.has(bd9[5])) return [{ raw: raw9 }, { text: " 생산 건물 늘리는 중" }];
      if (bd9) { const bk9 = BUILDING_KO[bd9[5]] ?? bd9[5]; return [{ raw: raw9 }, { text: ` ${bk9} 건설` }]; }
      return null;   // 일꾼 이동은 군말이다(2026-10-10 · 옛 "일꾼 N기 이동") — 국면 요약으로
    }
    /* ★ **대규모 병력 이동만**(2026-10-10, 요청: "병력 이동시킬 때 몇 기는 굳이 안 말해도 될 듯 · 유닛 이동은 대규모만 잡기 · 셔틀 대기, 히드라 2기 센터로 이동 이런 거
       굳이 나올 필요 없어") — 무리가 BIG_ARMY9 기 아래면(수송선·몇 기) 말하지 않는다 · 명령이 없으면(대기) 말하지 않는다 · 수는 빼고 많은 종류 둘만 "마린·메딕". */
    if (army9.length < BIG_ARMY9) return null;
    const cnt9 = new Map<string, number>();
    for (const e9 of army9) { const k9 = UNIT_KO[e9.kind] ?? e9.kind; cnt9.set(k9, (cnt9.get(k9) ?? 0) + 1); }
    const what9 = [...cnt9.entries()].sort((a9, b9) => b9[1] - a9[1]).slice(0, 2).map(([k9]) => k9).join("·");
    /* 그 창의 마지막 명령 — 무리의 몸 가운데 가장 늦은 것. */
    let ord9: [number, number, number, boolean] | null = null;
    for (const e9 of army9) for (const o9 of e9.orders) if (o9[0] >= t0 - 2 && o9[0] < t1 && (!ord9 || o9[0] > ord9[0])) ord9 = o9;
    if (!ord9) return null;
    const verb9 = ord9[3] ? "공격 이동" : "이동";
    for (const fo9 of foeOwners9(raw9)) {
      const fr9 = rawOf9.get(fo9);
      if (fr9 && hallsOfOwner9(new Set([fo9]), ord9[0]).some(([hx9, hy9]) => inBaseArea9(hx9, hy9, ord9![1], ord9![2]))) {
        return [{ raw: raw9 }, { text: ` ${what9} ` }, { raw: fr9 }, { text: ` 기지로 ${verb9}` }];
      }
    }
    if (inCenter9(ord9[1], ord9[2], CENTER_K9.hold)) return [{ raw: raw9 }, { text: ` ${what9} 센터로 ${verb9}` }];
    return [{ raw: raw9 }, { text: ` ${what9} ${verb9}` }];
  };
  /* ★★ **인구 막힘**(2026-10-10, 요청: "인구 막힘도 중요 포인트라 자막 나오면 좋음") — 재생기 로스터의 인구(supplyLive)와 같은 셈: 몸마다 난 초에 먹은 인구(SUPPLY_COST) ·
     준 인구(SUPPLY_GIVES · 시작 밑천과 안 겹치게 2초 뒤에 난 것만) 계단 · 상한 = min(SUPPLY_CAP, 종족 시작 몫 + 준 것) · **제 종족 풀**만(뺏은 몸의 딴 풀은 뺀다).
     먹은 것이 상한에 닿은(상한 − 1 ~ 상한 · 상한이 200 아래) 동안이 막힘이고, BLOCK9.min 초 넘게 이어진 것만 센다(BLOCK9.merge 초 안의 틈은 잇는다). 단위는 원작 내부(두 배). */
  const RACE_START_SUPPLY9: Record<string, number> = { 테란: 20, 프로토스: 18, 저그: 18 };
  const BLOCK9 = { min: 12, merge: 6 };
  /** ★ 막힘은 **돈이 있을 때만**(2026-10-11, 요청: "인구 막힘 조건 중 하나 — 돈이 최소 유닛 뽑을 돈이 있는 경우만 막힘으로 침") — 가장 싼 인구 유닛(일꾼 · 세 종족 다 50)
   *  미네랄. 막힘 구간 가운데 그 사람 미네랄이 이 이상인 동안만 남기고(처음 ~ 끝으로 죈다) 그 몫이 BLOCK9.min 초 넘어야 막힘이다. 자원 자료(opts.bank)가 없으면 안 거른다. */
  const BLOCK_MIN9 = 50;
  /** [a, b] 안에서 미네랄 ≥ BLOCK_MIN9 인 구간들 — 임자가 여럿이면 더한다. 자료가 없으면 null. */
  const richSpans9 = (own9: ReadonlySet<number>, a9: number, b9: number): [number, number][] | null => {
    const rows9 = [...own9].map((o9) => opts.bank?.get(o9)).filter((r9): r9 is NonNullable<typeof r9> => !!r9 && r9.length > 0);
    if (rows9.length === 0) return null;
    const ts9 = new Set<number>([a9]);
    for (const r9 of rows9) for (const [s9] of r9) if (s9 > a9 && s9 < b9) ts9.add(s9);
    const pts9 = [...ts9].sort((x9, y9) => x9 - y9);
    const minAt9 = (sec9: number): number => {
      let m9 = 0;
      for (const r9 of rows9) { let v9 = 0; for (const [s9, mm9] of r9) { if (s9 > sec9) break; v9 = mm9; } m9 += v9; }
      return m9;
    };
    const out9: [number, number][] = [];
    for (let i9 = 0; i9 < pts9.length; i9 += 1) {
      const s9 = pts9[i9]; const e9 = i9 + 1 < pts9.length ? pts9[i9 + 1] : b9;
      if (minAt9(s9) < BLOCK_MIN9) continue;
      const last9 = out9[out9.length - 1];
      if (last9 && last9[1] === s9) last9[1] = e9; else out9.push([s9, e9]);
    }
    return out9;
  };
  type Block9 = { t0: number; t1: number; used: number; cap: number };
  const blocksMemo9 = new Map<string, Block9[]>();
  const blocksOf9 = (raw9: string): Block9[] => {
    const got9 = blocksMemo9.get(raw9);
    if (got9) return got9;
    const own9 = ownersOf9(raw9);
    const race9 = world.players.find((pl9) => pl9.name === raw9)?.race ?? "";
    const ev9: [number, number, number][] = [];
    for (const e9 of world.lives) {
      if (!own9.has(e9.owner)) continue;
      if (race9 && (raceOfBwKind9(e9.kind) || race9) !== race9) continue;
      const g9 = (SUPPLY_GIVES[e9.kind] ?? 0) > 0 && e9.born > 2 ? SUPPLY_GIVES[e9.kind] : 0;
      const u9 = e9.bld ? 0 : SUPPLY_COST[e9.kind] ?? 0;
      if (g9 === 0 && u9 === 0) continue;
      ev9.push([e9.born, u9, g9]);
      if (e9.died !== null) ev9.push([e9.died, -u9, -g9]);
    }
    ev9.sort((a9, b9) => a9[0] - b9[0]);
    const base9 = RACE_START_SUPPLY9[race9] ?? 0;
    const out9: Block9[] = [];
    let used9 = 0; let give9 = 0; let open9: Block9 | null = null;
    for (let i9 = 0; i9 < ev9.length;) {
      const sec9 = ev9[i9][0];
      while (i9 < ev9.length && ev9[i9][0] === sec9) { used9 += ev9[i9][1]; give9 += ev9[i9][2]; i9 += 1; }
      const cap9 = Math.min(SUPPLY_CAP, base9 + give9);
      /* 상한에 **닿은** 동안만(상한 − 1 ~ 상한 · 저글링 반 칸) — 상한을 넘은 것은 공급 건물을 잃은 것이지 막힘(서플을 늦게 지음)이 아니다. */
      const blocked9 = cap9 < SUPPLY_CAP && used9 > 0 && used9 >= cap9 - 1 && used9 <= cap9;
      if (blocked9 && !open9) open9 = { t0: sec9, t1: sec9, used: used9, cap: cap9 };
      else if (blocked9 && open9) { open9.used = used9; open9.cap = cap9; }
      else if (!blocked9 && open9) {
        open9.t1 = sec9;
        const last9 = out9[out9.length - 1];
        if (last9 && open9.t0 - last9.t1 <= BLOCK9.merge) { last9.t1 = open9.t1; last9.used = open9.used; last9.cap = open9.cap; } else out9.push(open9);
        open9 = null;
      }
    }
    if (open9) { open9.t1 = Math.min(total, liveTo9.get(raw9) ?? total); out9.push(open9); }
    const res9: Block9[] = [];
    for (const b9 of out9) {
      const rich9 = richSpans9(own9, b9.t0, b9.t1);
      if (rich9 === null) { if (b9.t1 - b9.t0 >= BLOCK9.min) res9.push(b9); continue; }
      let dur9 = 0; for (const [a9, c9] of rich9) dur9 += c9 - a9;
      if (dur9 >= BLOCK9.min) res9.push({ ...b9, t0: rich9[0][0], t1: rich9[rich9.length - 1][1] });
    }
    blocksMemo9.set(raw9, res9);
    return res9;
  };
  const blockIn9 = (raw9: string, t0: number, t1: number): Block9 | undefined => blocksOf9(raw9).find((b9) => b9.t0 < t1 && b9.t1 > t0);
  const cycleCaps9 = (raw9: string, t0: number, t1: number): CapPart9[] => {
    const own9 = ownersOf9(raw9);
    const lo9 = t0 - 2;
    const hi9 = Math.max(t0 + 1, t1);
    /* 인구 막힘이 그 창에 걸치면 그것이 먼저다(위 ★★). */
    const bk9 = blockIn9(raw9, t0, hi9);
    if (bk9) return [{ raw: raw9 }, { text: " 인구 막힘" }];   // 숫자는 뺀다(2026-10-11, 요청: "인구막힘 뒤에 숫자 안 보여주기")
    const miles9 = buildMiles9(raw9);
    const inWin9 = miles9.find((m9) => m9.at >= lo9 && m9.at < hi9);
    if (inWin9) return inWin9.caps;
    let bld9: string | null = null;
    for (const e9 of world.lives) {
      if (!e9.bld || !own9.has(e9.owner) || e9.born < lo9 || e9.born >= hi9 || e9.end === "morph") continue;
      if (!bld9 && !PLAIN_BLD9.has(e9.kind) && !HALL9.has(e9.kind) && !TECH_MILE9[e9.kind]) bld9 = e9.kind;
    }
    if (bld9) return [{ raw: raw9 }, { text: PROD_BLD9.has(bld9) ? " 생산 건물 늘리는 중" : ` ${BUILDING_KO[bld9] ?? bld9} 건설` }];
    const scr9 = screenCap9(raw9, t0, hi9);
    if (scr9) return scr9;
    /* 화면 무리가 약하거나(대기 · 일꾼 이동) 못 읽으면 창 앞 MILE_RECENT9 초 안의 마지막 이정표(빌드 읽기 · 전술 — 그 사람의 빌드·자리를 말할 뿐 '지금 일어나는
       일'이라 하지 않는다) > 눈에 띄는 국면(센터 장악 · 병력 구성) > 약한 화면 글귀 > 국면 요약. */
    let recent9: Mile9 | undefined;
    for (const m9 of miles9) if (m9.at < lo9 && m9.at >= lo9 - MILE_RECENT9) recent9 = m9;
    if (recent9) return recent9.caps;
    return [{ raw: raw9 }, { text: ` ${phaseCap9(raw9, hi9)}` }];
  };

  /* ★★ **전투 단위**(2026-10-11, 요청: "장면을 좀 길게 가져가기 — 전투 전체를 처음부터 끝까지 보여 주면 좋을 듯 · 더 중요한 게 있으면 바꾸는 건 맞는데 그 순간의
     중요도가 아닌 전체 전투의 중요도를 봐야 해") ──────────────────────────────────────────────────────────────────────────────
     장면은 MAX_SCENE9(30초)로 토막이 나고(자막이 사건에 맞게 갈리도록), 옛 편성은 토막마다 제 무게로 겨뤘다 — 갈아탄 지 MIN_HOLD9(8초)만 지나면 딴 곳의 조금 무거운
     토막이 한창인 전투를 끊었다. 이제 **같은 자리에서 이어지는 토막**(앞 토막 끝 + 꼬리 + 2초 안에 시작 · 가운데가 SCENE_R9 안 · 자리 모르면 같은 사람이 든 것)을
     한 **전투**(bid)로 묶고 무게는 그 전투 **전부의 합**이다:
       · 장면이 되는 문턱(MIN_SCENE9)도 전투의 합으로 — 큰 전투의 가벼운 끝 토막도 보여 준다(처음부터 끝까지).
       · 지금 보이는 전투의 토막은 늘 잇는다 — 주인공이 그 토막에 들면 그대로(카메라 안 움직임 · 자막만 사건 때에 갈림 · push9 CAP_SPLIT9).
       · 지금 전투가 이어지는 동안(끝 = 마지막 토막 끝 + 꼬리 몫) 딴 전투는 **전체 무게가 BATTLE_JUMP9(2) 배 넘을 때만** 끼어든다. 밀린 전투가 그 뒤에도 이어지면
         지금 전투가 끝나는 때에 그리로 간다(resume9). */
  const BATTLE_JUMP9 = 2;   // 1.2 → 2(2026-10-11, 지적: "전투 끼어들기 1.2배는 너무 낮은 것 같아") — 딴 전투는 합이 지금 전투의 두 배는 돼야 끼어든다(뚝배기는 늘 · must9)
  const bidOf9 = new Map<Sc9, number>();
  const bTot9 = new Map<number, number>();
  const bEnd9 = new Map<number, number>();
  const totOf9 = (sc9: Sc9): number => { let t9 = 0; for (const w9 of sc9.by.values()) t9 += w9; return t9; };
  for (let i9 = 0; i9 < scs9.length; i9 += 1) {
    const s9 = scs9[i9];
    let bid9 = -1;
    for (let j9 = i9 - 1; j9 >= 0 && bid9 < 0; j9 -= 1) {
      const p9 = scs9[j9];
      if (s9.t0 < p9.t1 - 0.01 || s9.t0 - p9.t1 > p9.tail + 2) continue;
      const near9 = s9.cx !== undefined && p9.cx !== undefined && s9.cy !== undefined && p9.cy !== undefined
        ? Math.hypot(s9.cx - p9.cx, s9.cy - p9.cy) <= SCENE_R9
        : [...s9.by.keys()].some((r9) => p9.by.has(r9));
      if (near9) bid9 = bidOf9.get(p9)!;
    }
    if (bid9 < 0) bid9 = i9;
    bidOf9.set(s9, bid9);
    bTot9.set(bid9, (bTot9.get(bid9) ?? 0) + totOf9(s9));
    bEnd9.set(bid9, Math.max(bEnd9.get(bid9) ?? 0, s9.t1 + (s9.tail - GAP9)));
  }
  /* ★★ **자막은 사건 때에 맞춘다**(2026-10-11, 지적: "전투가 길게 잡히면서 화면과 안 맞는 자막이 나오는 경우도 많은 듯 — 타이밍을 정확히 맞춰서") — 토막(최대 30초)의 자막을
     그 토막의 가장 무거운 사건으로 지어 토막 **머리**에 세우면, "기지 대파시킴"이 아직 안 부서진 화면에 떴다. 이제 토막을 CAP_WIN9 초 창으로 다시 나눠 창마다 그 창의 사건만으로
     자막을 짓고(subSc9 — 같은 addEv9 로 다시 쌓는다 · 기지 피해 단은 razeOf9 가 창 앞 피해까지 보므로 '이어서 대파'가 그대로 난다), 그 창의 **가장 무거운 사건** 때(− CAP_LEAD9)에
     세운다(→ 되물림: 창 첫 사건 때 · 아래 emitScene9). 주인공(카메라)은 토막의 것 그대로 — 주인공이 안 든 창은 건너뛴다. 같은 글귀면 push9 가 잇고, 다르면 CAP_SPLIT9 초 넘게 뒤일 때 새 토막(자막만 갈림). */
  const CAP_WIN9 = 10;
  const CAP_LEAD9 = 0.5;
  const subSc9 = (sc9: Sc9, a9: number, b9: number): Sc9 | null => {
    const es9 = sc9.evs.filter((e9) => e9.sec >= a9 && e9.sec < b9);
    if (es9.length === 0) return null;
    const sub9: Sc9 = { t0: es9[0].sec, t1: es9[0].sec, by: new Map(), why: es9[0].why, tail: GAP9,
      pair: new Map(), econ: new Map(), locs: [], bldPair: new Map(), bldLost: new Map(), byKind: new Map(), killKind: new Map(), ovl: new Map(),
      killN: new Map(), kills: new Map(), killVic: new Map(), evs: [], cx: sc9.cx, cy: sc9.cy };
    for (const e9 of es9) addEv9(sub9, e9);
    return sub9;
  };
  /* ★★ **한 전투의 싸움터 임자는 안 바뀐다**(2026-10-11, 지적: "전투의 흐름이 잘 안 사는 느낌 — 한 전투에 참가자가 들락날락하는데 어느 기지를 공격하는지는 안 변하거든") —
     창(10초)·토막(30초)마다 baseOwner9 를 새로 재면, 기지 앞에서 죽은 몫이 많은 창은 "A vs B 교전" · 기지 안 창은 "A가 B 기지 공격"으로 오가며 맥이 끊겼다.
     이제 같은 전투(bid)의 토막 사건을 다 모은 판으로 임자를 한 번 재고(battleOwner9), 장면·창이 **제 임자를 못 세우면** 그 임자를 쓴다(공격한 사람·헬프는 그 창에 든
     사람으로 — 들락날락은 그대로 읽힌다). 창이 딴 기지 안 싸움으로 서면(되받아 쳐들어감) 그 창의 것. */
  const battleOwnerOf9 = new Map<number, string | null>();
  const battleOwner9 = (bid9: number): string | null => {
    if (battleOwnerOf9.has(bid9)) return battleOwnerOf9.get(bid9)!;
    const es9 = scs9.filter((s9) => bidOf9.get(s9) === bid9).flatMap((s9) => s9.evs).sort((x9, y9) => x9.sec - y9.sec);
    let bo9: string | null = null;
    if (es9.length > 0) {
      const head9 = scs9.find((s9) => bidOf9.get(s9) === bid9)!;
      const b9: Sc9 = { t0: es9[0].sec, t1: es9[0].sec, by: new Map(), why: es9[0].why, tail: GAP9,
        pair: new Map(), econ: new Map(), locs: [], bldPair: new Map(), bldLost: new Map(), byKind: new Map(), killKind: new Map(), ovl: new Map(),
        killN: new Map(), kills: new Map(), killVic: new Map(), evs: [], cx: head9.cx, cy: head9.cy };
      for (const e9 of es9) addEv9(b9, e9);
      bo9 = baseOwner9(b9);
    }
    battleOwnerOf9.set(bid9, bo9);
    return bo9;
  };
  /** 토막을 자막 창으로 세운다 — 첫 창은 at 에(카메라를 먼저 옮기는 자리), 그 뒤 창은 그 창 첫 사건 때에. from 앞의 사건은 안 본다(밀린 전투로 돌아갈 때). */
  const emitScene9 = (at9: number, sc9: Sc9, pick9: string, score9: number, from9 = -Infinity): void => {
    const bBo9 = battleOwner9(bidOf9.get(sc9) ?? -1);
    const own9 = (s9: Sc9): string | null => baseOwner9(s9) ?? bBo9;
    const dW9 = duel9(sc9, pick9, own9(sc9));
    let first9 = true;
    for (let a9 = Math.max(sc9.t0, from9); a9 <= sc9.t1; a9 += CAP_WIN9) {
      const sub9 = subSc9(sc9, a9, a9 + CAP_WIN9);
      if (!sub9 || !sub9.by.has(pick9)) continue;
      const caps9 = sceneCaps9(sub9, pick9, duel9(sub9, pick9, own9(sub9)) ?? dW9);
      /* 창 첫 사건 때(− CAP_LEAD9) — 가장 무거운 사건 때로 늦추는 안은 되물렸다(같은 날: "살짝 미리 뜨는 건 괜찮지"). */
      push9(first9 ? at9 : Math.max(at9, sub9.t0 - CAP_LEAD9), pick9, sub9.why, false, score9, dW9, caps9);
      first9 = false;
    }
    if (first9) push9(at9, pick9, sc9.why, false, score9, dW9, sceneCaps9(sc9, pick9, dW9));   // 창마다 주인공이 안 들면 옛 길
  };
  let curBid9 = -1;
  const skipped9: Sc9[] = [];
  /** 밀린 전투로 돌아가기 — 지금 전투가 끝났고(upTo 가 그 끝 뒤) 밀린 토막 가운데 그 끝 뒤로도 이어지는 것이 있으면 가장 무거운 전투의 것을 그 끝에 세운다. */
  const resume9 = (upTo9: number): void => {
    if (curBid9 < 0) return;
    const end9 = bEnd9.get(curBid9)!;
    if (upTo9 <= end9 + 1) return;
    let best9: Sc9 | null = null;
    for (const s9 of skipped9) {
      if (bidOf9.get(s9) === curBid9 || s9.t1 <= end9 + 1) continue;
      if (!best9 || bTot9.get(bidOf9.get(s9)!)! > bTot9.get(bidOf9.get(best9)!)!) best9 = s9;
    }
    skipped9.length = 0;
    if (!best9) return;
    const bid9 = bidOf9.get(best9)!;
    const rank9 = [...best9.by.entries()].sort((a9, b9) => b9[1] - a9[1]);
    emitScene9(end9, best9, rank9[0][0], bTot9.get(bid9)!, end9);
    curBid9 = bid9;
    cur9 = Math.max(cur9, bEnd9.get(bid9)!);
  };
  let cur9 = 0;
  for (const sc9 of scs9) {
    const at9 = Math.max(0, sc9.t0 - CAST_LEAD9);
    const bid9 = bidOf9.get(sc9)!;
    const btot9 = bTot9.get(bid9)!;
    if (btot9 < MIN_SCENE9) continue;      // 잔 전투는 장면이 아니다 — 순환이 그 자리를 메운다(무게는 전투 전부의 합 · 위 ★★)
    resume9(at9);
    const cont9 = bid9 === curBid9;
    const busy9 = !cont9 && curBid9 >= 0 && at9 < bEnd9.get(curBid9)!;
    const must9 = !!sc9.hall?.[3];   // 뚝배기(시작 본진) 깨기는 꼭 보여 준다(HALL_KILL_W9 ★) — 한창인 딴 전투도 끊는다 · 멀티 본진은 덧무게만
    if (busy9 && !must9 && btot9 < bTot9.get(curBid9)! * BATTLE_JUMP9) { skipped9.push(sc9); continue; }   // 한창인 전투를 안 끊는다
    const tot9 = btot9;
    /* 소강이 길면 그 사이를 순환으로 채운다(요청) — 장면 바로 앞까지만. */
    if (at9 - cur9 >= IDLE9 || out9.length === 0) fill9(cur9, at9);
    /* 누구를 보여주나 — 1·2등이 엇비슷하면 ★ **서로 맞붙은 둘이면 더 많이 준 쪽**(2026-10-09, 요청: "공격이나 교전 발생시 더 잘한 사람 보여주고" — 무게
       by 는 준 것 + 잃은 것×LOSS_K9 라 엇비슷할 수 있다), 그도 같거나 맞붙은 사이가 아니면 순환 원칙(가장 오래 안 본 사람)이 가른다. */
    const rank9 = [...sc9.by.entries()].sort((a9, b9) => b9[1] - a9[1]);
    let pick9 = rank9[0][0];
    if (rank9.length > 1 && rank9[0][1] <= rank9[1][1] * TIE9) {
      const [p09, p19] = [rank9[0][0], rank9[1][0]];
      const d019 = sc9.pair.get(`${p09}>${p19}`) ?? 0;
      const d109 = sc9.pair.get(`${p19}>${p09}`) ?? 0;
      pick9 = d019 !== d109 ? (d019 > d109 ? p09 : p19) : lonely9([p09, p19]);
    }
    /* 머무는 중이면 **훨씬 무거운 장면**만 끼어든다 — 그래야 화면이 안 튄다. */
    const held9 = at9 - lastAt9() < MIN_HOLD9;
    /* ★ 머무는 중이어도 **지금 보이는 사람이 든 장면**이면 그 사람을 주인공으로 자막만 갈아 끼운다(2026-10-10 · 위 push9 ★) — 카메라는 안 움직이니 화면이
       튀지 않고, 그 사람의 새 사건이 제때 자막에 선다. */
    const cur9raw = out9.length > 0 ? out9[out9.length - 1].raw : null;
    if (held9 && tot9 < lastScore9() * JUMP9 && cur9raw !== null && sc9.by.has(cur9raw)) pick9 = cur9raw;
    if (cont9 && cur9raw !== null && sc9.by.has(cur9raw)) pick9 = cur9raw;   // 같은 전투는 같은 주인공으로 잇는다(위 ★★)
    if (must9 && pick9 !== sc9.hall![0] && pick9 !== sc9.hall![1]) pick9 = cur9raw === sc9.hall![1] ? sc9.hall![1] : sc9.hall![0];   // 뚝배기는 깬 쪽(지금 잃는 쪽을 보던 중이면 그대로)
    if (must9 || cont9 || busy9 || !held9 || tot9 >= lastScore9() * JUMP9 || pick9 === cur9raw) {
      emitScene9(at9, sc9, pick9, tot9);
      curBid9 = bid9;
    }
    /* 장면의 끝은 마지막 사건 + **꼬리의 남는 몫**이다 — 견제는 마지막 킬 뒤에도 쫓는 몸이 그 자리에
       있으니 그만큼 머물고, 그 사이에 순환이 끼어들지 않는다(교전은 tail = GAP9 라 종전 그대로). */
    cur9 = Math.max(cur9, sc9.t1 + (sc9.tail - GAP9));
  }
  resume9(total + 2);
  fill9(cur9, total);
  /* ★★ **gg 선언 · 노엘 외침**(2026-10-10, 요청: "엘리 gg(ㅈㅈ) 선언 ㄴㅇ 노엘 외침도") — 채팅에서 그 말을 한 사람을 그때 CHAT_HOLD9 초 보여 주고 "[A] gg 선언" ·
     "[A] 노엘 외침"을 띄운 뒤 보던 토막으로 돌아간다(그 토막이 그 뒤에도 이어지면 같은 토막을 다시 세운다). 같은 사람의 같은 말은 CHAT_DEDUP9 초에 한 번.
     말의 꼴은 sg-web replayTactics 의 GG_RE · NO_ELIM_RE 와 같다. */
  {
    const GG_RE9 = /(^|[^a-z])(g{2,}|w{2,})(?!\.[a-z])([^a-z]|$)|ㅈ{2,}|(^|[^가-힣])(지지|쥐쥐)|잘{1,2}했|잘하시네/i;
    const NOEL_RE9 = /노\s*엘|(^|[^가-힣])ㄴ\s*ㅇ(ㄹ)?([^가-힣]|$)/;
    const CHAT_HOLD9 = 4;
    const CHAT_DEDUP9 = 60;
    const names9 = new Set(rawOf9.values());
    const last9 = new Map<string, number>();
    for (const c9 of [...(opts.chats ?? [])].sort((a9, b9) => a9.sec - b9.sec)) {
      if (!names9.has(c9.name) || c9.sec > total) continue;
      const kind9 = NOEL_RE9.test(c9.text) ? "노엘 외침" : GG_RE9.test(c9.text) ? "gg 선언" : null;
      if (!kind9) continue;
      const key9 = `${c9.name}|${kind9}`;
      if ((last9.get(key9) ?? -Infinity) > c9.sec - CHAT_DEDUP9) continue;
      last9.set(key9, c9.sec);
      const at9 = Math.max(0, c9.sec - 0.5);
      let i9 = -1;
      for (let k9 = 0; k9 < out9.length; k9 += 1) { if (out9[k9].at <= at9) i9 = k9; else break; }
      const seg9: CastSeg9 = { at: at9, raw: c9.name, why: kind9, cyc: false, score: 0, caps: [{ raw: c9.name }, { text: ` ${kind9}` }] };
      const next9 = out9[i9 + 1]?.at ?? total;
      const back9 = i9 >= 0 && next9 > at9 + CHAT_HOLD9 + 1 ? { ...out9[i9], at: at9 + CHAT_HOLD9 } : null;
      if (i9 >= 0 && out9[i9].at === at9) out9.splice(i9, 1, seg9, ...(back9 ? [back9] : []));
      else out9.splice(i9 + 1, 0, seg9, ...(back9 ? [back9] : []));
    }
  }
  /* ★ **첫 순환은 자리와 종족**(2026-10-11, 요청: "첫 장면들 순환할 때 순조롭게 발전 중보다는 몇 시와 종족을 말해 주면 좋을 듯 — 기수 7시 테란") — 사람마다 처음 순환으로
     설 때 한 번 "[A] 7시 테란". 시는 지도 가운데에서 출발 자리를 본 시계 방향(위 12시 · 오른쪽 3시) · 가운데에 너무 가까우면(짧은 변의 0.12 안) 시를 뺀다. 지도 크기를
     모르면 출발 자리들의 가운데가 기준. 종족은 참값 그대로(모르면 뺀다). */
  const introDone9 = new Set<string>();
  const clockOf9 = (raw9: string): string => {
    const st9 = start9.get(raw9);
    if (!st9) return "";
    const sts9 = [...start9.values()];
    const cx9 = opts.mapW ? opts.mapW / 2 : sts9.reduce((a9, p9) => a9 + p9.x, 0) / sts9.length;
    const cy9 = opts.mapH ? opts.mapH / 2 : sts9.reduce((a9, p9) => a9 + p9.y, 0) / sts9.length;
    const dx9 = st9.x - cx9; const dy9 = st9.y - cy9;
    const short9 = Math.min(opts.mapW ?? 128, opts.mapH ?? 128);
    if (Math.hypot(dx9, dy9) < short9 * 0.12) return "";
    const deg9 = (Math.atan2(dx9, -dy9) * 180 / Math.PI + 360) % 360;   // 위 0 · 시계 방향
    /* 대각 모서리는 스타 관례로 1·5·7·11시(정대각 225° 는 7.5 라 반올림하면 8시가 된다) — ±10° 안이면 그 값. */
    const corner9: [number, number][] = [[45, 1], [135, 5], [225, 7], [315, 11]];
    const cn9 = corner9.find(([c9]) => Math.abs(deg9 - c9) <= 10);
    const h9 = cn9 ? cn9[1] : Math.round(deg9 / 30) % 12;
    return `${h9 === 0 ? 12 : h9}시`;
  };
  /* ★ 순환 토막의 자막(2026-10-09) — 그 사람이 그 창(다음 토막까지)에서 한 일: 연구 완료 > 빌드 이정표(창 안 > 최근) > 그 밖의 건설 > 국면 요약(위 ★★ 빌드 읽기). */
  for (let i9 = 0; i9 < out9.length; i9 += 1) {
    const sg9 = out9[i9];
    if (sg9.caps && sg9.caps.length > 0) { introDone9.add(sg9.raw); continue; }
    if (sg9.cyc && !introDone9.has(sg9.raw)) {
      introDone9.add(sg9.raw);
      const race9 = world.players.find((pl9) => pl9.name === sg9.raw)?.race ?? "";
      const where9 = [clockOf9(sg9.raw), race9].filter(Boolean).join(" ");
      if (where9) { sg9.caps = [{ raw: sg9.raw }, { text: ` ${where9}` }]; continue; }
    }
    sg9.caps = cycleCaps9(sg9.raw, sg9.at, i9 + 1 < out9.length ? out9[i9 + 1].at : total);
  }
  return out9;
}

/** t 에 보여줄 토막 번호 — 없으면 -1(이분 탐색). */
export function castAt9(plan: readonly CastSeg9[], t: number): number {
  let lo9 = 0;
  let hi9 = plan.length - 1;
  let at9 = -1;
  while (lo9 <= hi9) {
    const mid9 = (lo9 + hi9) >> 1;
    if (plan[mid9].at <= t) { at9 = mid9; lo9 = mid9 + 1; } else hi9 = mid9 - 1;
  }
  return at9;
}
