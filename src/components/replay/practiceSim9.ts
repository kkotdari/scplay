/* ★★ 수송선 드랍 연습실 — 시뮬레이션(2026-11-17, 요청: "연습실 기능 추가 · 1. 수송선 드랍 연습 · 2. 수송선 1~12대 · 3. 안에 태우는 유닛도 골라서 ·
   태우기 내리기는 직접 · 4. 목표는 적 뚝배기(빨무 · 적 위치 · 내 위치 지정) · 5. 상대 종족 선택 · 6. 상대는 적당히 방어선 구축 · 7. 낙하산 드랍 · 드랍 후
   shift 로 이동 예약 · 8. 드랍 키 지정").
   ★ **원작 자료 그대로**(2026-11-17 둘째, 요청: "원작 정보를 그대로 조사해서 구현해야해") — 손으로 어림한 표(첫 판 UNIT_DEFS9 손 표 · 24틱/초)를 걷고
   이 저장소의 원장(src/utils/bwUnits.ts = units.dat · weapons.dat · flingy.dat 실덤프)과 OpenBW(bwgame.h) 규칙을 옮겼다:
     · 시계 — 프레임 1/23.81초(가장 빠름). 모든 타이머는 프레임이다.
     · 체력 · 실드 — fp8(1/256) 정수. 피해는 attackOnce(실드 → 방어력 → 크기 배수 → 하한 0.5 · 히트마다 따로) · 공방 단계는 무기 bonus · 방어/실드 업.
     · 쿨다운 — get_modified_weapon_cooldown + (rand & 3) − 1. 사거리 — 두 몸 상자의 **모서리 사이**(units_distance · xy_length 어림) ·
       자동 획득 — set_acquisition_ranges(max(seek, 사거리/32)) · 벙커 +64px/+2타일 · 표적 우선순위(unit_target_attack_priority) 뒤 가까운 것.
     · 튀김 — 맞은 자리에서 상자까지 거리(unit_distance_to)로 링 1/2/4 · 적 튀김은 제 편 안 침 · 럴커 가시는 줄(20px)에 한 번씩.
     · 이동 — flingy: 가속 · 정지 거리(halt) · 진행 방향/몸 회전 상한. iscript 구동(ctrl 2 · 보병 · 전차)은 첫 틱 최고속 · 45° 넘게 틀어지면 서서 돈다.
     · 수송 — 하차마다 수송선 main_order_timer 15 · 내린 유닛은 무기 쿨다운 가득(리버는 30프레임 못 쏜다) · 타는 거리 1px(상자 사이) ·
       유닛이 수송선을 찍으면 수송선도 마중 나간다(EnterTransport → PickupTransport · 7프레임마다 다시 잼) · MoveUnload 를 **자기**에게 찍으면
       그 자리에서 Unload 로 바뀌고 이동 목표는 그대로라 가던 길을 날며 떨군다(낙하산) · 수송선이 터지면 화물도 죽고 벙커는 내려놓는다.
     · 적 — 캐논은 파일런 전원(psi_field_mask) 안에서만 쏜다 · 다크 템플러 · 버로우한 럴커는 탐지기(캐논 · 터렛 · 스포어 시야) 곁에서만 맞는다 ·
       벙커는 마린 넷을 태우고 쏜다 · 일꾼은 75프레임 캐고 나른다.
   일부러 줄인 것: 시야 · 안개 없음 · 총알 날아가는 시간 없음(맞는 순간 피해 · 스캐럽만 날아간다) · 지상 유닛끼리 밀어내기는 가벼운 떼어 놓기 ·
   기술(스톰 · 스팀 · 시즈)은 없음 · 리버 스캐럽은 원작 시간(105프레임)으로 저절로 채운다(빨무라 돈은 무한) · 럴커 버로우 시간은 재생기와 같은 어림(0.9초). */
import type { MapTerrain } from "../../utils/mapTerrain";
import { TILE } from "../../utils/mapTerrain";
import {
  BUILD_FRAMES, FIREBAT_HITS_ON_ONE_TARGET, FP, FRAME_SEC, LURKER_SPINE_TRAVEL_PX, WEAPONS,
  acquireTiles, attackOnce, cooldownFrames, fp, moveDynOf, splashDivisor, unitOf, weaponRangePx,
  type DmgTarget, type MoveDyn, type UnitCombat, type Weapon,
} from "../../utils/bwUnits";

export type PracRace9 = "T" | "P" | "Z";
export const PRAC_RACES9: { key: PracRace9; label: string; transport: string }[] = [
  { key: "T", label: "테란", transport: "Dropship" },
  { key: "P", label: "프로토스", transport: "Shuttle" },
  { key: "Z", label: "저그", transport: "Overlord" },
];

export interface UnitDef9 {
  name: string; ko: string; race: PracRace9;
  /** 원장 한 줄(units.dat) — 체력 · 실드 · 방어 · 크기 · 상자 · 플래그. */ uc: UnitCombat;
  /** 체력 · 실드 최대(정수 — 비율 · 막대용). 셈은 fp8 로 한다. */ hp: number; sh: number;
  /** 원작 상자 [좌, 위, 우, 아래](px) — 거리 · 고르기 · 내릴 자리의 자. */ box: [number, number, number, number];
  /** 고리 · 막대 반지름(px) — 상자의 반폭 · 반높이 중 큰 것. */ rad: number;
  /** 최고 속도(px/프레임 · 업그레이드 전) — 0 이면 못 움직인다. */ speed: number;
  air: boolean; bld: boolean;
  /** 수송 칸(units.dat space_required) — 못 타면 0. */ slots: number;
  /** 수송 공간(space_provided · 수송선 8). */ cargo: number;
  g: Weapon | null; a: Weapon | null;
  heal: boolean; bio: boolean; worker: boolean; detector: boolean;
  /** 늘 은신(다크 템플러). */ cloak: boolean;
  /** 버로우해야 쏜다(럴커). */ burrowShoot: boolean;
  reaver: boolean;
  foot?: [number, number];
}

/* 이름 · 한글 · 종족 · 수송 칸(units.dat space_required). 수치는 아래 mkDef9 가 원장에서 가져온다. */
const LIST9: [string, string, PracRace9, number][] = [
  ["Dropship", "드랍십", "T", 0], ["Shuttle", "셔틀", "P", 0], ["Overlord", "오버로드", "Z", 0],
  ["Marine", "마린", "T", 1], ["Firebat", "파이어뱃", "T", 1], ["Medic", "메딕", "T", 1], ["Ghost", "고스트", "T", 1],
  ["Vulture", "벌처", "T", 2], ["Siege Tank", "시즈 탱크", "T", 4], ["Goliath", "골리앗", "T", 2],
  ["Zealot", "질럿", "P", 2], ["Dragoon", "드라군", "P", 4], ["High Templar", "하이 템플러", "P", 2], ["Dark Templar", "다크 템플러", "P", 2],
  ["Reaver", "리버", "P", 4], ["Archon", "아콘", "P", 4],
  ["Zergling", "저글링", "Z", 1], ["Hydralisk", "히드라리스크", "Z", 2], ["Lurker", "럴커", "Z", 4], ["Ultralisk", "울트라리스크", "Z", 4], ["Defiler", "디파일러", "Z", 2],
  ["SCV", "SCV", "T", 1], ["Probe", "프로브", "P", 1], ["Drone", "드론", "Z", 1],
  ["Command Center", "커맨드 센터", "T", 0], ["Nexus", "넥서스", "P", 0], ["Hatchery", "해처리", "Z", 0],
  ["Missile Turret", "미사일 터렛", "T", 0], ["Bunker", "벙커", "T", 0], ["Photon Cannon", "포톤 캐논", "P", 0],
  ["Spore Colony", "스포어 콜로니", "Z", 0], ["Sunken Colony", "성큰 콜로니", "Z", 0],
  ["Supply Depot", "서플라이 디팟", "T", 0], ["Barracks", "배럭", "T", 0], ["Factory", "팩토리", "T", 0],
  ["Pylon", "파일런", "P", 0], ["Gateway", "게이트웨이", "P", 0], ["Cybernetics Core", "사이버네틱스 코어", "P", 0],
  ["Spawning Pool", "스포닝 풀", "Z", 0], ["Hydralisk Den", "히드라 덴", "Z", 0], ["Evolution Chamber", "에볼루션 챔버", "Z", 0],
];
const mkDef9 = (name: string, ko: string, race: PracRace9, slots: number): UnitDef9 => {
  const uc = unitOf(name);
  const box = uc.box;
  const mv = moveDynOf(name);
  return {
    name, ko, race, uc, hp: uc.hp, sh: uc.shield, box,
    rad: Math.max((box[0] + 1 + box[2]) / 2, (box[1] + 1 + box[3]) / 2),
    speed: mv ? mv.top * 32 * FRAME_SEC : 0,
    air: uc.flyer, bld: uc.building, slots, cargo: /^(Dropship|Shuttle|Overlord)$/.test(name) ? 8 : 0,
    g: uc.ground ? WEAPONS[uc.ground] : null, a: uc.air ? WEAPONS[uc.air] : null,
    heal: name === "Medic", bio: uc.organic, worker: uc.worker, detector: uc.detector,
    cloak: name === "Dark Templar", burrowShoot: name === "Lurker", reaver: name === "Reaver",
    ...(uc.building ? { foot: uc.tile } : {}),
  };
};
export const UNIT_DEFS9: Record<string, UnitDef9> = Object.fromEntries(LIST9.map(([n, ko, r, s]) => [n, mkDef9(n, ko, r, s)]));
/* 미네랄 — 원장에 없어 BWAPI 치수(좌 32 · 위 16 · 우 31 · 아래 15)로 세운다. 표적이 되지 않는 꾸밈이다. */
UNIT_DEFS9["Mineral Field"] = {
  ...mkDef9("Pylon", "미네랄", "T", 0), name: "Mineral Field", hp: 1, sh: 0, box: [32, 16, 31, 15], rad: 32, g: null, a: null, detector: false, foot: [2, 1],
};
/** 고를 수 있는 태울 유닛(종족마다). */
export const CARGO_UNITS9: Record<PracRace9, string[]> = {
  T: ["Marine", "Medic", "Firebat", "Ghost", "Vulture", "Goliath", "Siege Tank"],
  P: ["Zealot", "Dragoon", "High Templar", "Dark Templar", "Reaver", "Archon"],
  Z: ["Zergling", "Hydralisk", "Lurker", "Ultralisk", "Defiler"],
};
const WORKER9: Record<PracRace9, string> = { T: "SCV", P: "Probe", Z: "Drone" };
const HALL9: Record<PracRace9, string> = { T: "Command Center", P: "Nexus", Z: "Hatchery" };
/** 이동 연구(연구 다 됨일 때) — moveDynOf 가 제 이름만 본다. */
const SPEED_UPS9 = ["Pneumatized Carapace", "Gravitic Drive", "Ion Thrusters", "Leg Enhancements", "Metabolic Boost", "Muscular Augments", "Anabolic Synthesis"];

/** 빨무(128×128) 본진 자리 — 홀 가운데(px). 12 · 6시는 8인판에만 스타팅이 있지만 땅은 두 판 다 있다. */
export const PRAC_SPOTS9: { key: string; label: string; x: number; y: number }[] = [
  { key: "TL", label: "11시", x: 288, y: 176 },
  { key: "T", label: "12시", x: 2048, y: 208 },
  { key: "TR", label: "1시", x: 3808, y: 176 },
  { key: "L", label: "9시", x: 288, y: 2032 },
  { key: "R", label: "3시", x: 3808, y: 2032 },
  { key: "BL", label: "7시", x: 288, y: 3792 },
  { key: "B", label: "6시", x: 2048, y: 3856 },
  { key: "BR", label: "5시", x: 3808, y: 3792 },
];

export interface PracSetup9 {
  myRace: PracRace9; foeRace: PracRace9; ships: number;
  /** 태울 유닛 이름 → 수. */ cargo: Record<string, number>;
  mySpot: string; foeSpot: string;
  /** 연구 다 됨(속업 · 사업 · 스캐럽 · 키틴질 · 리버 칸 …) — 두 편 같다. */ ups: boolean;
  /** 공방 단계 0~3 — 두 편 같다. */ lv: number;
}

export type Order9 =
  | { t: "move"; x: number; y: number }
  | { t: "amove"; x: number; y: number }
  | { t: "attack"; id: number }
  | { t: "load"; id: number }      // EnterTransport — 유닛 → 수송선에 탄다(수송선도 마중 나온다)
  | { t: "pickup"; id: number }    // PickupTransport — 수송선 → 그 유닛을 태운다
  /** MoveUnload — 그 자리로 가서 Unload. self 면 명령이 서는 순간의 제 자리(= 곧바로 Unload · 이동 목표는 그대로 → 낙하산). */
  | { t: "moveunload"; x: number; y: number; self?: boolean }
  /** Unload — 하나씩 내린다(15프레임마다). 이동은 건드리지 않는다. */
  | { t: "unload" }
  | { t: "hold" }
  | { t: "burrow" } | { t: "unburrow" };

export interface Ent9 {
  id: number; def: UnitDef9; owner: 0 | 1;
  x: number; y: number;
  /** 체력 · 실드 · 에너지(fp8). */ hp: number; sh: number; en: number;
  /** 몸이 보는 각(라디안 · 0 = 오른쪽 · 화면 아래가 +). */ face: number;
  /** 진행 방향(flingy current_velocity_direction) · 지금 속도(px/프레임). */ course: number; spd: number;
  /** 이동 물리(업그레이드 반영) — null 이면 못 움직인다. */ mv: MoveDyn | null;
  orders: Order9[];
  /** 이동 목표(move_target) — 명령과 따로 산다: Unload 중에도 배는 이리로 간다. */ goal: [number, number] | null;
  /** 이동 목표에 닿았다. */ arrived: boolean;
  /** 지상 길(남은 꺾는 점들) · 길을 낸 칸. */ path: [number, number][] | null; pathTo: [number, number] | null;
  /** 무기 쿨다운(프레임) — 지상 · 공중. */ gcd: number; acd: number;
  /** main_order_timer(프레임) — 수송선 하차 간격 · 마중 간격 · 리버 발사 간격 · 내린 리버 30. */ timer: number;
  target: number | null;
  /** 마지막에 나를 때린 적(가만히 있던 유닛이 되받아 친다). */ hitBy: number | null;
  /** 화물(id) · 탄 그릇. */ cargo: number[]; inside: number | null;
  /** 낙하산(날며 내리는 중) — 그리기용 표식. */ para: boolean;
  /** 명령 단계(0 첫 틱). */ ost: number;
  /** 일꾼 채취 — 0 캐러 감 · 1 캐는 중 · 2 돌아감 · 3 넘겨주는 중. */ work: number; workT: number; slot: number;
  /** 버로우 — 들어감 · 파는/나오는 남은 프레임. */ burrowed: boolean; burrowT: number;
  /** 리버 스캐럽 수 · 다음 하나까지 남은 프레임. */ scarabs: number; scarabT: number;
  dead: boolean; hitT: number;
}
export interface Shot9 { x1: number; y1: number; x2: number; y2: number; t: number; air: boolean; col: string }
export interface Boom9 { x: number; y: number; t: number; r: number }
export interface Scarab9 { x: number; y: number; tid: number; owner: 0 | 1; life: number; from: number }
export interface PracStats9 { workers: number; defense: number; buildings: number; lost: number; tick: number }

/** 한 프레임(ms) — 가장 빠름 23.81 fps. */
export const PRAC_TICK_MS9 = FRAME_SEC * 1000;
export const PRAC_FPS9 = 1 / FRAME_SEC;
/** 하차마다 수송선에 거는 main_order_timer(OpenBW unit_unload). */
const UNLOAD_TIMER9 = 15;
/** PickupTransport 다시 잼 간격. */
const PICKUP_TIMER9 = 7;
/** 일꾼 한 번 캐기(order_MiningMinerals main_order_timer). */
const MINE_FRAMES9 = 75;
/** 리버 발사 간격(order_Reaver main_order_timer) · 내린 리버(unit_unload) · 스캐럽 수명(set_remove_timer) · 속도(flingy 11.905 타일/초) · 만드는 데(build time). */
const REAVER_FIRE9 = 60; const REAVER_UNLOAD9 = 30;
const SCARAB_LIFE9 = 90;
const SCARAB_SPEED9 = 11.905 * 32 * FRAME_SEC;
const SCARAB_BUILD9 = BUILD_FRAMES.Scarab ?? 105;
/** 에너지 · 실드 · 저그 체력 회복(fp8/프레임) — 8 · 7 · 4. */
const ENERGY_REGEN9 = 8; const SHIELD_REGEN9 = 7; const ZERG_REGEN9 = 4;
/** 메딕 — 한 프레임에 최대 200 fp8 · 에너지 1 에 2 체력 · 사거리 30px. */
const MEDIC_HEAL9 = 200; const MEDIC_RANGE9 = 30;
/** 버로우(파기 · 나오기) — 원작 애니메이션 길이를 못 열어 재생기 BURROW_DIG_SEC 0.9초와 같은 어림. */
const BURROW_FRAMES9 = Math.round(0.9 / FRAME_SEC);
/** 적 일꾼 수 · 벙커 안 마린 수. */
const WORKERS9 = 50; const BUNKER_MARINES9 = 4;

/** 지상 칸 — 16px(미니타일 둘 × 둘)이 다 걸을 수 있으면 걷는 칸. 256 × 256 = 65536 칸. */
const CELL9 = 16;

/** OpenBW xy_length — 원작 거리 어림(제곱근 없이). */
const xyLen9 = (dx: number, dy: number): number => {
  let x = Math.abs(dx); let y = Math.abs(dy);
  if (x < y) { const t = x; x = y; y = t; }
  if (x / 4 < y) x = x - x / 16 + (y * 3) / 8 - x / 64 + (y * 3) / 256;
  return x;
};
/** 각 차(−π ~ π). */
const angDiff9 = (a: number, b: number): number => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const turnTo9 = (cur: number, want: number, rate: number): number => { const d = angDiff9(want, cur); return Math.abs(d) <= rate ? want : cur + Math.sign(d) * rate; };
/** 파일런 전원 모양(OpenBW psi_field_mask · 32px 칸 · 가로 ±256 · 세로 ±160). */
const PSI_MASK9 = [[1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 1, 0, 0], [1, 1, 1, 0, 0, 0, 0, 0]];
export const inPsi9 = (rx: number, ry: number): boolean => {
  let x = Math.abs(Math.trunc(rx)); let y = Math.abs(Math.trunc(ry));
  if (x >= 256 || y >= 160) return false;
  if (rx < 0) x -= 1;
  if (ry < 0) y -= 1;
  return PSI_MASK9[Math.max(0, y) >> 5][Math.max(0, x) >> 5] === 1;
};
/** 전원이 있어야 서는 프로토스 건물. */
const NEEDS_POWER9 = new Set(["Photon Cannon", "Gateway", "Cybernetics Core"]);

export class PracticeSim9 {
  readonly W: number; readonly H: number;
  ents: Ent9[] = [];
  byId = new Map<number, Ent9>();
  shots: Shot9[] = [];
  booms: Boom9[] = [];
  scarabs: Scarab9[] = [];
  stats: PracStats9 = { workers: 0, defense: 0, buildings: 0, lost: 0, tick: 0 };
  private nextId = 1;
  private walk: Uint8Array; private cw: number; private ch: number;
  /** 건물이 막은 칸. */ private block: Uint8Array;
  readonly setup: PracSetup9;
  /** 적 미네랄 자리 · 홀. */
  private mineral: { x: number; y: number } = { x: 0, y: 0 };
  private hall: Ent9 | null = null;
  /** 원작 lcg 대신 고정 씨앗 — 같은 판은 같게 돈다. */
  private seed = 0x2545f491;
  private readonly ups: boolean;
  private readonly hasUp: (name: string) => boolean;
  /** 전원 — 파일런이 바뀐 프레임에만 다시 잰다. */
  private powerDirty = true;
  private powered = new Set<number>();

  constructor(mt: MapTerrain, setup: PracSetup9) {
    this.setup = setup;
    this.ups = setup.ups !== false;
    const ups = this.ups;
    this.hasUp = () => ups;
    this.W = mt.w * 32; this.H = mt.h * 32;
    this.cw = this.W / CELL9; this.ch = this.H / CELL9;
    this.walk = new Uint8Array(this.cw * this.ch);
    this.block = new Uint8Array(this.cw * this.ch);
    const mw = mt.w * 4;
    const walkMini = (mx: number, my: number): boolean => { const k = my * mw + mx; return (mt.walkBits[k >> 3] & (1 << (k & 7))) !== 0; };
    for (let cy = 0; cy < this.ch; cy += 1) {
      for (let cx = 0; cx < this.cw; cx += 1) {
        const mx = cx * 2; const my = cy * 2;
        this.walk[cy * this.cw + cx] = walkMini(mx, my) && walkMini(mx + 1, my) && walkMini(mx, my + 1) && walkMini(mx + 1, my + 1) ? 1 : 0;
      }
    }
    this.buildable = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= mt.w || ty >= mt.h) return false;
      const f = mt.tile[ty * mt.w + tx];
      return (f & TILE.walkable) !== 0 && (f & TILE.unbuildable) === 0 && (f & TILE.partial) === 0;
    };
    this.populate();
  }
  private buildable: (tx: number, ty: number) => boolean;
  private rand(): number { this.seed = (Math.imul(this.seed, 22695477) + 1) >>> 0; return (this.seed >>> 16) & 0x7fff; }
  /** 공방 단계(두 편 같다). */
  private lv(): number { return Math.max(0, Math.min(3, Math.round(this.setup.lv ?? 0))); }

  /* ── 자리 잡기 ─────────────────────────────────────────────────────────── */
  private spawn(name: string, owner: 0 | 1, x: number, y: number): Ent9 {
    const def = UNIT_DEFS9[name];
    const mv = def.speed > 0 ? moveDynOf(name, this.ups ? SPEED_UPS9 : []) : null;
    const e: Ent9 = {
      id: this.nextId++, def, owner, x, y, hp: fp(def.hp), sh: fp(def.sh), en: fp(50),
      face: Math.PI / 2, course: Math.PI / 2, spd: 0, mv,
      orders: [], goal: null, arrived: true, path: null, pathTo: null,
      gcd: 0, acd: 0, timer: 0, target: null, hitBy: null, cargo: [], inside: null, para: false, ost: 0,
      work: 0, workT: 0, slot: 0, burrowed: false, burrowT: 0,
      scarabs: def.reaver ? (this.ups ? 10 : 5) : 0, scarabT: 0,
      dead: false, hitT: 0,
    };
    this.ents.push(e); this.byId.set(e.id, e);
    if (def.bld && def.foot) this.markBlock(e, 1);
    if (name === "Pylon") this.powerDirty = true;
    return e;
  }
  private markBlock(e: Ent9, v: 0 | 1): void {
    const [fw, fh] = e.def.foot!;
    const x0 = Math.floor((e.x - fw * 16) / CELL9); const y0 = Math.floor((e.y - fh * 16) / CELL9);
    for (let cy = y0; cy < y0 + fh * 2; cy += 1) for (let cx = x0; cx < x0 + fw * 2; cx += 1) {
      if (cx >= 0 && cy >= 0 && cx < this.cw && cy < this.ch) this.block[cy * this.cw + cx] = v;
    }
  }
  /** 건물 자리 — 발자국 칸이 다 지을 수 있고 다른 건물과 안 겹치면(한 타일 띄움). */
  private canPlace(tx: number, ty: number, fw: number, fh: number): boolean {
    for (let y = ty - 1; y < ty + fh + 1; y += 1) for (let x = tx - 1; x < tx + fw + 1; x += 1) {
      const inner = x >= tx && x < tx + fw && y >= ty && y < ty + fh;
      if (inner && !this.buildable(x, y)) return false;
      const cx = x * 2; const cy = y * 2;
      if (cx < 0 || cy < 0 || cx >= this.cw || cy >= this.ch) { if (inner) return false; continue; }
      if (this.block[cy * this.cw + cx] || this.block[cy * this.cw + cx + 1] || this.block[(cy + 1) * this.cw + cx]) return false;
    }
    return true;
  }
  /** (px, py) 가까이 놓을 수 있는 자리를 바깥으로 넓혀 가며 찾는다 — ok 가 있으면 그 자리 가운데가 ok 여야 한다(캐논 = 전원 안). */
  private placeNear(name: string, owner: 0 | 1, px: number, py: number, maxR = 10, ok?: (x: number, y: number) => boolean): Ent9 | null {
    const [fw, fh] = UNIT_DEFS9[name].foot!;
    const tx0 = Math.round(px / 32 - fw / 2); const ty0 = Math.round(py / 32 - fh / 2);
    for (let r = 0; r <= maxR; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = tx0 + dx; const ty = ty0 + dy;
        const cx = (tx + fw / 2) * 32; const cy = (ty + fh / 2) * 32;
        if (ok && !ok(cx, cy)) continue;
        if (this.canPlace(tx, ty, fw, fh)) return this.spawn(name, owner, cx, cy);
      }
    }
    return null;
  }
  /** 걷는 칸 가까이(유닛 처음 세우기). */
  nearestWalk(x: number, y: number, maxR = 6): [number, number] | null {
    const cx0 = Math.floor(x / CELL9); const cy0 = Math.floor(y / CELL9);
    for (let r = 0; r <= maxR; r += 1) {
      let best: [number, number] | null = null; let bd = Infinity;
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = cx0 + dx; const cy = cy0 + dy;
        if (!this.free(cx, cy)) continue;
        const px = cx * CELL9 + 8; const py = cy * CELL9 + 8; const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = [px, py]; }
      }
      if (best) return best;
    }
    return null;
  }
  private free(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cw || cy >= this.ch) return false;
    const k = cy * this.cw + cx; return this.walk[k] === 1 && this.block[k] === 0;
  }
  /** 몸 상자가 걷는 칸 위이고 다른 지상 몸과 안 겹치는가(find_unit_placement 의 어림). */
  private spotOk(def: UnitDef9, x: number, y: number): boolean {
    const [l, u, r, d] = def.box;
    const corners: [number, number][] = [[x - l, y - u], [x + r, y - u], [x - l, y + d], [x + r, y + d], [x, y]];
    for (const [px, py] of corners) if (!this.free(Math.floor(px / CELL9), Math.floor(py / CELL9))) return false;
    for (const o of this.ents) {
      if (o.dead || o.inside !== null || o.def.air || o.def.bld || o.burrowed) continue;
      const [ol, ou, or, od] = o.def.box;
      if (x - l <= o.x + or && x + r >= o.x - ol && y - u <= o.y + od && y + d >= o.y - ou) return false;
    }
    return true;
  }
  /** 내릴 자리 — 그릇 자리에서 바깥으로(8px 걸음 · 160px 까지). */
  private placeUnit(def: UnitDef9, x: number, y: number): [number, number] | null {
    if (this.spotOk(def, x, y)) return [x, y];
    for (let r = 8; r <= 160; r += 8) {
      const n = Math.max(8, Math.round((r * Math.PI * 2) / 12));
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + r * 0.05;
        const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r;
        if (this.spotOk(def, px, py)) return [px, py];
      }
    }
    return null;
  }

  private populate(): void {
    const s = this.setup;
    const mine = PRAC_SPOTS9.find((p) => p.key === s.mySpot) ?? PRAC_SPOTS9[0];
    const foe = PRAC_SPOTS9.find((p) => p.key === s.foeSpot) ?? PRAC_SPOTS9[2];
    /* 적 본진 — 홀 · 미네랄(빨무는 모든 본진이 홀 바로 아래에 미네랄 한 점) · 일꾼 50. */
    const hall = this.spawn(HALL9[s.foeRace], 1, foe.x, foe.y);
    this.hall = hall;
    const my = foe.y + 64;
    this.spawn("Mineral Field", 1, foe.x, my);
    this.mineral = { x: foe.x, y: my };
    /* 일꾼 50(2026-11-17, 요청: "타겟의 일꾼들도 50기 정도 미네랄 채굴중이게") — 미네랄 둘레 반원 고리에 나눠 서서 캐고 홀로 나른다. */
    const wk = WORKER9[s.foeRace];
    for (let i = 0; i < WORKERS9; i += 1) {
      const [sx, sy] = this.mineSpot(i);
      const p = this.nearestWalk(sx, sy) ?? [foe.x, my + 30];
      const w = this.spawn(wk, 1, p[0], p[1]); w.slot = i; w.work = i % 3 === 0 ? 2 : 1; w.workT = (i * 13) % MINE_FRAMES9;
    }
    /* 방어선 — 홀 둘레 고리(반지름 3.5 · 8 타일)에 고르게 · 지도 가운데 쪽(입구 쪽)에 더. */
    const cxm = this.W / 2; const cym = this.H / 2;
    const toward = Math.atan2(cym - foe.y, cxm - foe.x);
    const ring = (name: string, n: number, rT: number, spread: number, off = 0, ok?: (x: number, y: number) => boolean): Ent9[] => {
      const out: Ent9[] = [];
      for (let i = 0; i < n; i += 1) {
        const ang = toward + off + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        const e = this.placeNear(name, 1, foe.x + Math.cos(ang) * rT * 32, foe.y + Math.sin(ang) * rT * 32, ok ? 7 : 4, ok);
        if (e) out.push(e);
      }
      return out;
    };
    if (s.foeRace === "T") {
      ring("Missile Turret", 3, 3.5, Math.PI * 1.6, Math.PI);   // 일꾼 줄 · 홀 뒤
      ring("Missile Turret", 5, 8, Math.PI * 1.2);
      /* 벙커 — 마린 넷을 태운다(원작: 벙커 자신은 무기가 없고 탄 마린이 +64px 로 쏜다). */
      for (const b of ring("Bunker", 2, 6, Math.PI * 0.6)) {
        for (let i = 0; i < BUNKER_MARINES9; i += 1) { const m = this.spawn("Marine", 1, b.x, b.y); m.inside = b.id; b.cargo.push(m.id); }
      }
      ring("Supply Depot", 4, 11, Math.PI * 1.4);
      ring("Barracks", 1, 13, 0, 0.5); ring("Factory", 1, 13, 0, -0.5);
    } else if (s.foeRace === "P") {
      /* 파일런 먼저 — 캐논은 그 전원 안에만 선다(원작 그대로 · 파일런을 깨면 곁의 캐논이 꺼진다). */
      ring("Pylon", 2, 3.5, Math.PI * 1.2, Math.PI);
      ring("Pylon", 3, 8.5, Math.PI * 1.0);
      const powered = (x: number, y: number): boolean => this.ents.some((p) => p.def.name === "Pylon" && p.owner === 1 && inPsi9(x - p.x, y - p.y));
      ring("Photon Cannon", 3, 3.5, Math.PI * 1.6, Math.PI, powered);
      ring("Photon Cannon", 5, 8, Math.PI * 1.2, 0, powered);
      ring("Pylon", 2, 11, Math.PI * 1.4);
      ring("Gateway", 1, 13, 0, 0.5, powered); ring("Cybernetics Core", 1, 13, 0, -0.5, powered);
    } else {
      ring("Spore Colony", 3, 3.5, Math.PI * 1.6, Math.PI);
      ring("Spore Colony", 4, 8, Math.PI * 1.2);
      ring("Sunken Colony", 3, 6.5, Math.PI * 0.7);
      ring("Spawning Pool", 1, 12, 0, 0.5); ring("Hydralisk Den", 1, 12, 0, -0.5); ring("Evolution Chamber", 1, 12, 0, 1.2);
    }
    /* 내 쪽 — 수송선 · 태울 유닛을 내 본진 홀 자리 둘레 땅에 세운다(태우기는 직접). */
    const tr = PRAC_RACES9.find((r) => r.key === s.myRace)!.transport;
    const ships = Math.max(1, Math.min(12, Math.round(s.ships)));
    const dirIn = Math.atan2(cym - mine.y, cxm - mine.x);
    for (let i = 0; i < ships; i += 1) {
      const col = i % 6; const row = Math.floor(i / 6);
      const ox = mine.x + Math.cos(dirIn) * (60 + row * 70) + Math.cos(dirIn + Math.PI / 2) * (col - 2.5) * 64;
      const oy = mine.y + Math.sin(dirIn) * (60 + row * 70) + Math.sin(dirIn + Math.PI / 2) * (col - 2.5) * 64;
      const e = this.spawn(tr, 0, Math.max(40, Math.min(this.W - 40, ox)), Math.max(40, Math.min(this.H - 40, oy)));
      e.face = dirIn; e.course = dirIn;
    }
    let k = 0;
    for (const name of CARGO_UNITS9[s.myRace]) {
      const n = Math.max(0, Math.min(96, Math.round(s.cargo[name] ?? 0)));
      for (let i = 0; i < n; i += 1) {
        /* 수송선 줄 바로 앞(지도 가운데 쪽)에 열둘씩 가로줄 — 원작 화면(640 × 400) 한 장에 배와 함께 들게. */
        const side = (k % 12 - 5.5) * 24; const rr = 150 + Math.floor(k / 12) * 30;
        const ux = mine.x + Math.cos(dirIn) * rr + Math.cos(dirIn + Math.PI / 2) * side;
        const uy = mine.y + Math.sin(dirIn) * rr + Math.sin(dirIn + Math.PI / 2) * side;
        const p0 = this.nearestWalk(ux, uy, 12) ?? this.nearestWalk(mine.x, mine.y, 20);
        const p = p0 ? this.placeUnit(UNIT_DEFS9[name], p0[0], p0[1]) ?? p0 : null;
        if (p) { const e = this.spawn(name, 0, p[0], p[1]); e.face = dirIn; e.course = dirIn; }
        k += 1;
      }
    }
  }

  /* ── 묻기 ─────────────────────────────────────────────────────────────── */
  alive(): Ent9[] { return this.ents.filter((e) => !e.dead && e.inside === null); }
  usedSlots(t: Ent9): number { return t.cargo.reduce((s, id) => s + (this.byId.get(id)?.def.slots ?? 0), 0); }
  /** 두 몸 상자 사이 거리(OpenBW units_distance). */
  dist(a: Ent9, b: Ent9): number {
    const [al, au, ar, ad] = a.def.box; const [bl, bu, br, bd] = b.def.box;
    const ax0 = a.x - al; const ax1 = a.x + ar + 1; const ay0 = a.y - au; const ay1 = a.y + ad + 1;
    const bx0 = b.x - bl; const bx1 = b.x + br + 1; const by0 = b.y - bu; const by1 = b.y + bd + 1;
    const dx = bx0 > ax1 ? bx0 - ax1 : ax0 > bx1 ? ax0 - bx1 : 0;
    const dy = by0 > ay1 ? by0 - ay1 : ay0 > by1 ? ay0 - by1 : 0;
    return xyLen9(dx, dy);
  }
  /** 한 점에서 몸 상자까지(OpenBW unit_distance_to). */
  private distTo(u: Ent9, x: number, y: number): number {
    const [l, up, r, d] = u.def.box;
    const nx = Math.max(u.x - l, Math.min(u.x + r + 1, x)); const ny = Math.max(u.y - up, Math.min(u.y + d + 1, y));
    return xyLen9(x - nx, y - ny);
  }
  /** 그 자리의 개체(공중 먼저 · 상자 + 여유). */
  pick(x: number, y: number, pad = 4): Ent9 | null {
    let best: Ent9 | null = null; let bd = Infinity;
    for (const e of this.ents) {
      if (e.dead || e.inside !== null || e.def.name === "Mineral Field") continue;
      const [l, u, r, d] = e.def.box;
      if (x < e.x - l - pad || x > e.x + r + pad || y < e.y - u - pad || y > e.y + d + pad) continue;
      const dd = Math.hypot(e.x - x, e.y - y);
      if (!best || (e.def.air && !best.def.air) || (e.def.air === best.def.air && dd < bd)) { bd = dd; best = e; }
    }
    return best;
  }
  private updatePower(): void {
    if (!this.powerDirty) return;
    this.powerDirty = false; this.powered.clear();
    const pylons = this.ents.filter((p) => !p.dead && p.def.name === "Pylon");
    for (const b of this.ents) {
      if (b.dead || !NEEDS_POWER9.has(b.def.name)) continue;
      if (pylons.some((p) => p.owner === b.owner && inPsi9(b.x - p.x, b.y - p.y))) this.powered.add(b.id);
    }
  }
  /** 꺼진 건물(전원 없음) — 쏘지도 탐지하지도 못한다. */
  disabled(e: Ent9): boolean { return NEEDS_POWER9.has(e.def.name) && !this.powered.has(e.id); }
  /** 은신 — 다크 템플러 · 땅속 럴커. */
  cloaked(e: Ent9): boolean { return e.def.cloak || e.burrowed; }
  /** 그 편이 이 몸을 볼 수 있나 — 은신이면 그 편 탐지기(시야 안 · 켜진 것)가 있어야. */
  visibleTo(e: Ent9, owner: 0 | 1): boolean {
    if (!this.cloaked(e)) return true;
    for (const d of this.ents) {
      if (d.dead || d.inside !== null || d.owner !== owner || !d.def.detector || this.disabled(d)) continue;
      if (Math.hypot(d.x - e.x, d.y - e.y) <= d.def.uc.sight * 32) return true;
    }
    return false;
  }

  /* ── 명령 ─────────────────────────────────────────────────────────────── */
  order(ids: number[], o: Order9, queue: boolean): void {
    for (const id of ids) {
      const e = this.byId.get(id); if (!e || e.dead || e.owner !== 0 || e.inside !== null) continue;
      if (!e.mv && o.t !== "hold") continue;
      if ((o.t === "moveunload" || o.t === "unload" || o.t === "pickup") && !e.def.cargo) continue;
      if (o.t === "load" && (e.def.cargo || !e.def.slots)) continue;
      if ((o.t === "burrow" || o.t === "unburrow") && !e.def.burrowShoot) continue;
      if (!queue) {
        e.orders = []; e.target = null; e.ost = 0; e.para = false;
        /* MoveUnload(자기)는 이동 목표를 그대로 둔다 — 그게 낙하산이다(OpenBW order_MoveUnload). 다른 명령은 새 목표를 스스로 건다. */
        if (o.t === "hold") { e.goal = null; e.path = null; }
      }
      e.orders.push({ ...o });
    }
  }
  stop(ids: number[]): void {
    for (const id of ids) {
      const e = this.byId.get(id);
      if (e && e.owner === 0 && e.inside === null) { e.orders = []; e.goal = null; e.path = null; e.target = null; e.para = false; e.ost = 0; }
    }
  }
  /** 낙하산 — 자기에게 MoveUnload(가던 길을 그대로 날며 15프레임마다 한 기씩). */
  paradrop(ids: number[], queue = false): void {
    for (const id of ids) { const e = this.byId.get(id); if (e) this.order([id], { t: "moveunload", x: e.x, y: e.y, self: true }, queue); }
  }
  /** 화물 한 기만 지금 자리에 내린다(화물 칸 누름 · OpenBW action_unload → unit_unload — 수송선 타이머가 남았으면 안 내린다). */
  unloadOne(tid: number, uid: number): boolean {
    const t = this.byId.get(tid); if (!t || t.dead) return false;
    return this.dropUnit(t, uid);
  }

  /* ── 프레임 ──────────────────────────────────────────────────────────── */
  step(): void {
    this.stats.tick += 1;
    this.updatePower();
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.gcd > 0) e.gcd -= 1;
      if (e.acd > 0) e.acd -= 1;
      if (e.timer > 0) e.timer -= 1;
      if (e.inside !== null) continue;
      if (e.hitT > 0) e.hitT -= 1;
      this.regen(e);
      if (e.def.reaver) this.scarabTick(e);
      if (e.def.name === "Bunker") { this.bunkerTick(e); continue; }
      if (e.def.bld) { if (!this.disabled(e)) this.fight(e, false); continue; }
      if (e.owner === 1 && e.def.worker) { this.workerTick(e); this.drive(e); continue; }
      this.unitTick(e);
      this.drive(e);
    }
    this.scarabFly();
    this.separate();
    for (const s of this.shots) s.t -= 1;
    this.shots = this.shots.filter((s) => s.t > 0);
    for (const b of this.booms) b.t -= 1;
    this.booms = this.booms.filter((b) => b.t > 0);
    if (this.stats.tick % 120 === 0) this.ents = this.ents.filter((e) => !e.dead || e.inside !== null);
  }
  private regen(e: Ent9): void {
    if (e.def.sh > 0 && e.sh < fp(e.def.sh)) e.sh = Math.min(fp(e.def.sh), e.sh + SHIELD_REGEN9);
    if (e.def.race === "Z" && !e.def.bld && e.hp < fp(e.def.hp)) e.hp = Math.min(fp(e.def.hp), e.hp + ZERG_REGEN9);
    if (e.def.heal || e.def.name === "High Templar" || e.def.name === "Defiler" || e.def.name === "Ghost") {
      const max = fp(this.ups && e.def.heal ? 250 : 200);
      if (e.en < max) e.en = Math.min(max, e.en + ENERGY_REGEN9);
    }
  }

  private unitTick(e: Ent9): void {
    e.para = false;
    if (e.burrowT > 0) {
      e.burrowT -= 1;
      if (e.burrowT === 0) { const o = e.orders[0]; if (o?.t === "burrow") { e.burrowed = true; this.next(e); } else if (o?.t === "unburrow") { e.burrowed = false; this.next(e); } }
      return;
    }
    if (e.def.heal && this.healTick(e)) return;
    const o = e.orders[0];
    if (!o) {
      /* 가만히 — 획득 사거리 안 적을 친다(쫓아간다) · 맞으면 되받는다. */
      if (!this.fight(e, true)) this.retaliate(e);
      return;
    }
    /* 땅속 럴커가 움직이는 명령을 만나면 먼저 나온다. */
    if (e.burrowed && (o.t === "move" || o.t === "amove" || o.t === "load")) { e.orders.unshift({ t: "unburrow" }); e.ost = 0; return; }
    switch (o.t) {
      case "hold": e.goal = null; this.fight(e, false); return;
      case "move": this.setGoal(e, o.x, o.y); if (e.arrived) this.next(e); return;
      case "amove":
        if (this.fight(e, true)) return;
        this.setGoal(e, o.x, o.y); if (e.arrived) this.next(e);
        return;
      case "attack": {
        const t = this.byId.get(o.id);
        if (!t || t.dead || t.inside !== null || !this.visibleTo(t, e.owner)) { this.next(e); return; }
        e.target = t.id; this.engage(e, t, true); return;
      }
      case "burrow":
        if (e.burrowed) { this.next(e); return; }
        e.goal = null; e.spd = 0; e.burrowT = BURROW_FRAMES9; return;
      case "unburrow":
        if (!e.burrowed) { this.next(e); return; }
        e.burrowT = BURROW_FRAMES9; return;
      case "load": {
        /* EnterTransport — 수송선이 움직일 수 있으면 그쪽에 PickupTransport 를 앞에 끼운다(마중) · 상자 사이 1px 이면 탄다. */
        const t = this.byId.get(o.id);
        if (!t || t.dead || !t.def.cargo || t.inside !== null || this.usedSlots(t) + e.def.slots > t.def.cargo) { this.next(e); return; }
        if (e.ost === 0) {
          e.ost = 1;
          if (t.orders[0]?.t !== "pickup" && t.mv) { t.orders.unshift({ t: "pickup", id: e.id }); t.ost = 0; t.timer = 0; }
        }
        this.setGoal(e, t.x, t.y, true);
        if (this.dist(e, t) <= 1) this.board(t, e);
        return;
      }
      case "pickup": {
        const u = this.byId.get(o.id);
        if (!u || u.dead || u.inside !== null || u.owner !== e.owner || !u.def.slots || this.usedSlots(e) + u.def.slots > e.def.cargo) { this.next(e); return; }
        if (e.timer === 0) {
          e.timer = PICKUP_TIMER9;
          if (this.dist(e, u) <= 1) {
            e.goal = null;
            if (u.orders[0]?.t !== "load") { u.orders.unshift({ t: "load", id: e.id }); u.ost = 1; }
          } else this.setGoal(e, u.x, u.y, true);
        }
        return;
      }
      case "moveunload": {
        if (e.cargo.length === 0) { this.next(e); return; }
        if (e.ost === 0) { e.ost = 1; if (o.self) { o.x = e.x; o.y = e.y; } }
        if (xyLen9(o.x - e.x, o.y - e.y) <= 16) { e.orders[0] = { t: "unload" }; e.ost = 0; return; }
        this.setGoal(e, o.x, o.y);
        return;
      }
      case "unload": {
        /* Unload — 이동 목표는 안 건드린다(그래서 날던 배는 날며 떨군다). */
        e.para = !e.arrived && e.spd > 0.2;
        if (e.timer > 0) return;
        if (e.cargo.length === 0) { this.next(e); return; }
        const last = e.cargo.length === 1;
        if (!this.dropUnit(e, e.cargo[0]) || last) this.next(e);
        return;
      }
    }
  }
  private next(e: Ent9): void { e.orders.shift(); e.target = null; e.ost = 0; }

  private board(t: Ent9, u: Ent9): void {
    if (this.usedSlots(t) + u.def.slots > t.def.cargo) return;
    t.cargo.push(u.id); u.inside = t.id; u.orders = []; u.goal = null; u.path = null; u.target = null; u.spd = 0; u.ost = 0;
    const to = t.orders[0];
    if (to?.t === "pickup" && to.id === u.id) { this.next(t); t.goal = null; t.path = null; }   // 마중 끝 — 선다(PickupTransport 의 stop_unit)
  }
  /** OpenBW unit_unload — 그릇 타이머가 남았으면 안 된다 · 자리 찾기 · 타이머 15 · 내린 유닛 무기 쿨다운 가득(리버 30프레임). */
  private dropUnit(t: Ent9, uid: number): boolean {
    const u = this.byId.get(uid); if (!u) return false;
    if (!t.def.bld && t.timer > 0) return false;
    const p = this.placeUnit(u.def, t.x, t.y);
    if (!p) return false;
    t.timer = t.def.bld ? 0 : UNLOAD_TIMER9;
    t.cargo = t.cargo.filter((id) => id !== uid);
    u.inside = null; u.x = p[0]; u.y = p[1]; u.face = t.face; u.course = t.face; u.spd = 0;
    u.orders = []; u.goal = null; u.path = null; u.arrived = true; u.target = null; u.ost = 0;
    if (!t.def.bld) {
      if (u.def.reaver) u.timer = REAVER_UNLOAD9;
      else {
        if (u.def.g) u.gcd = cooldownFrames(u.def.g);
        if (u.def.a) u.acd = cooldownFrames(u.def.a);
      }
    }
    return true;
  }

  /* ── 이동(flingy) ────────────────────────────────────────────────────── */
  /** 이동 목표를 건다 — 바뀌었으면 '닿음'을 풀고 지상은 길을 다시 낸다. follow 는 움직이는 표적(길을 자주 다시). */
  private setGoal(e: Ent9, x: number, y: number, follow = false): void {
    const same = !!e.goal && Math.abs(e.goal[0] - x) < 0.5 && Math.abs(e.goal[1] - y) < 0.5;
    if (!same) { e.goal = [x, y]; e.arrived = false; }
    if (e.def.air || !e.mv) return;
    const key: [number, number] = [Math.round(x / CELL9), Math.round(y / CELL9)];
    if (!e.path || !e.pathTo || e.pathTo[0] !== key[0] || e.pathTo[1] !== key[1] || (follow && this.stats.tick % 12 === e.id % 12)) {
      e.path = this.findPath(e.x, e.y, x, y); e.pathTo = key;
    }
  }
  /** 한 프레임 걷기/날기 — 원작 flingy 규칙(가속 · 정지 거리 · 진행 방향 회전) · iscript 구동은 즉발 최고속. */
  private drive(e: Ent9): void {
    const mv = e.mv; if (!mv || mv.top <= 0 || e.burrowed || e.burrowT > 0) { e.spd = 0; return; }
    const top = mv.top * 32 * FRAME_SEC;
    const acc = mv.accel * 32 * FRAME_SEC * FRAME_SEC;
    const turnC = (mv.turnCourse * FRAME_SEC * Math.PI) / 180;
    const turnB = (mv.turnBody * FRAME_SEC * Math.PI) / 180;
    const goal = e.arrived ? null : e.goal;
    if (!goal) {
      /* 목표 없음 — flingy 는 미끄러지며 선다 · iscript 구동은 곧바로 선다. */
      if (mv.ctrl === 2 || e.spd <= 0) { e.spd = 0; return; }
      e.spd = Math.max(0, e.spd - acc);
      this.stepPos(e, Math.cos(e.course) * e.spd, Math.sin(e.course) * e.spd);
      return;
    }
    let wx = goal[0]; let wy = goal[1]; let last = true;
    if (!e.def.air) {
      const p = e.path;
      if (p && p.length === 0) { e.arrived = true; e.spd = 0; return; }   // 못 가는 곳 — 갈 데까지 왔다
      if (p && p.length) {
        while (p.length > 1 && Math.hypot(p[0][0] - e.x, p[0][1] - e.y) < Math.max(e.spd, 1) + 2) p.shift();
        [wx, wy] = p[0]; last = p.length === 1;
        /* 길 끝이 목표가 아니면(막힌 곳 · 건물 속) 길 끝에 닿은 것으로 닿았다고 친다. */
        if (last && Math.hypot(wx - goal[0], wy - goal[1]) > 1 && Math.hypot(wx - e.x, wy - e.y) <= Math.max(e.spd, 1) + 1) { e.x = wx; e.y = wy; e.arrived = true; e.spd = 0; return; }
      }
    }
    const dx = wx - e.x; const dy = wy - e.y; const d = Math.hypot(dx, dy);
    const want = d > 0.01 ? Math.atan2(dy, dx) : e.face;
    if (mv.ctrl === 2) {
      e.face = turnTo9(e.face, want, turnB); e.course = e.face;
      if (Math.abs(angDiff9(e.face, want)) >= Math.PI / 4) { e.spd = 0; return; }   // 45° 넘게 틀어지면 서서 돈다
      e.spd = top;
      if (d <= top) { e.x = wx; e.y = wy; if (last) { e.arrived = true; e.spd = 0; } return; }
      this.stepPos(e, (dx / d) * top, (dy / d) * top);
      return;
    }
    /* flingy(ctrl 0 · 1) — 진행 방향은 turnCourse, 몸은 turnBody 로 돈다 · 남은 길이 정지 거리 안이면 줄인다(ctrl 0 의 마지막 목표만). */
    e.course = turnTo9(e.course, want, turnC);
    e.face = turnTo9(e.face, want, turnB);
    let accel = true;
    const cdiff = Math.abs(angDiff9(want, e.course));
    if (cdiff > 1e-3 && d < 32) { const val = ((cdiff * 2 + turnC) / turnC) * e.spd; if (val * 1.5 > d) accel = false; }
    if (accel && mv.ctrl === 0 && last) {
      const halt = e.spd <= 0 ? 0 : Math.abs(e.spd - top) < 1e-6 ? mv.halt * 32 : (e.spd * e.spd) / (2 * acc);
      if (halt >= d) accel = false;
    }
    e.spd = Math.max(0, Math.min(top, e.spd + (accel ? acc : -acc)));
    if (e.spd < acc && d > 0.5) e.spd = acc;   // 0 에 붙어 서지 않게
    if (d <= Math.max(e.spd, 0.75)) {
      e.x = wx; e.y = wy;
      if (last) { e.arrived = true; if (mv.ctrl === 1 || e.spd < 0.75) e.spd = 0; }
      return;
    }
    this.stepPos(e, Math.cos(e.course) * e.spd, Math.sin(e.course) * e.spd);
  }
  private stepPos(e: Ent9, vx: number, vy: number): void {
    const nx = Math.max(0, Math.min(this.W - 1, e.x + vx)); const ny = Math.max(0, Math.min(this.H - 1, e.y + vy));
    if (!e.def.air && !this.free(Math.floor(nx / CELL9), Math.floor(ny / CELL9))) {
      /* 미끄러지는 지상 몸이 벽에 닿으면 선다. */
      if (this.free(Math.floor(nx / CELL9), Math.floor(e.y / CELL9))) e.x = nx;
      else if (this.free(Math.floor(e.x / CELL9), Math.floor(ny / CELL9))) e.y = ny;
      return;
    }
    e.x = nx; e.y = ny;
  }

  /** A*(16px 칸 · 8방향) → 시야가 트인 꺾는 점만 남긴다. 못 가면 가장 가까운 칸까지. */
  private findPath(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const cw = this.cw;
    const s = this.nearestWalk(x0, y0, 4); const g0 = this.nearestWalk(x1, y1, 8);
    if (!s || !g0) return [];
    const sx = Math.floor(s[0] / CELL9); const sy = Math.floor(s[1] / CELL9);
    const gx = Math.floor(g0[0] / CELL9); const gy = Math.floor(g0[1] / CELL9);
    const N = cw * this.ch;
    const gScore = new Float32Array(N).fill(Infinity); const from = new Int32Array(N).fill(-1); const closed = new Uint8Array(N);
    const heap: number[] = []; const fS = new Float32Array(N);
    const push = (k: number): void => { heap.push(k); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (fS[heap[p]] <= fS[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = (): number => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1; const r = l + 1; let m = i; if (l < heap.length && fS[heap[l]] < fS[heap[m]]) m = l; if (r < heap.length && fS[heap[r]] < fS[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const h = (cx: number, cy: number): number => { const dx = Math.abs(cx - gx); const dy = Math.abs(cy - gy); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const sk = sy * cw + sx; const gk = gy * cw + gx;
    gScore[sk] = 0; fS[sk] = h(sx, sy); push(sk);
    let best = sk; let bestH = h(sx, sy); let iter = 0;
    while (heap.length && iter < 60000) {
      iter += 1;
      const k = pop(); if (closed[k]) continue; closed[k] = 1;
      if (k === gk) { best = k; break; }
      const cx = k % cw; const cy = (k / cw) | 0;
      const hh = h(cx, cy); if (hh < bestH) { bestH = hh; best = k; }
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = cx + dx; const ny = cy + dy;
        if (!this.free(nx, ny)) continue;
        if (dx && dy && (!this.free(cx + dx, cy) || !this.free(cx, cy + dy))) continue;   // 모서리 자르기 금지
        const nk = ny * cw + nx; if (closed[nk]) continue;
        const ng = gScore[k] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < gScore[nk]) { gScore[nk] = ng; from[nk] = k; fS[nk] = ng + h(nx, ny); push(nk); }
      }
    }
    const cells: number[] = [];
    for (let k = best; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    /* 줄이기 — 앞 점에서 곧게 보이는 가장 먼 점만. */
    const pts: [number, number][] = [];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.los(cells[i], cells[j])) j -= 1;
      pts.push([(cells[j] % cw) * CELL9 + 8, ((cells[j] / cw) | 0) * CELL9 + 8]);
      i = j;
    }
    if (best === gk && this.free(Math.floor(x1 / CELL9), Math.floor(y1 / CELL9))) {
      if (pts.length) pts[pts.length - 1] = [x1, y1]; else pts.push([x1, y1]);
    }
    return pts;
  }
  private los(a: number, b: number): boolean {
    const cw = this.cw;
    let x0 = a % cw; let y0 = (a / cw) | 0; const x1 = b % cw; const y1 = (b / cw) | 0;
    const dx = Math.abs(x1 - x0); const dy = Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (!this.free(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      if (e2 > -dy && e2 < dx && (!this.free(x0 - sx, y0) || !this.free(x0, y0 - sy))) return false;
    }
  }

  /** 지상 유닛끼리 살짝 떼어 놓는다(상자가 겹쳐 서지 않게 · 땅속 럴커는 빼고). */
  private separate(): void {
    const g = this.ents.filter((e) => !e.dead && e.inside === null && !e.def.air && !e.def.bld && e.mv && !e.burrowed);
    for (let i = 0; i < g.length; i += 1) {
      const a = g[i];
      for (let j = i + 1; j < g.length; j += 1) {
        const b = g[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const min = ((a.def.box[0] + a.def.box[2]) / 2 + (b.def.box[0] + b.def.box[2]) / 2) * 0.85;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const push = ((min - d) / 2) * 0.5; const ux = d > 0.01 ? dx / d : Math.cos(a.id); const uy = d > 0.01 ? dy / d : Math.sin(a.id);
        const ax = a.x - ux * push; const ay = a.y - uy * push; const bx = b.x + ux * push; const by = b.y + uy * push;
        if (this.free(Math.floor(ax / CELL9), Math.floor(ay / CELL9))) { a.x = ax; a.y = ay; }
        if (this.free(Math.floor(bx / CELL9), Math.floor(by / CELL9))) { b.x = bx; b.y = by; }
      }
    }
  }

  /* ── 싸움 ─────────────────────────────────────────────────────────────── */
  /** 그 표적에 쓰는 무기 — 리버는 스캐럽(지상만). 벙커는 탄 마린의 무기. */
  private weaponFor(e: Ent9, t: Ent9): Weapon | null {
    if (e.def.reaver) return t.def.air ? null : WEAPONS.Scarab;
    if (e.def.name === "Bunker") { const m = e.cargo.length ? this.byId.get(e.cargo[0]) : undefined; return m ? this.weaponFor(m, t) : null; }
    return t.def.air ? e.def.a : e.def.g;
  }
  /** 무기 사거리(px) — 리버는 획득 사거리 × 32(order_Reaver). 벙커 안은 +64. */
  private rangeOf(e: Ent9, w: Weapon, inBunker = false): number {
    if (e.def.reaver) return acquireTiles("Reaver") * 32;
    return weaponRangePx(w, e.def.name, { inBunker, ups: this.hasUp });
  }
  /** 가장 긴 무기 사거리(홀드가 보는 거리). */
  private maxRange(e: Ent9): number {
    if (e.def.reaver) return this.rangeOf(e, WEAPONS.Scarab);
    return Math.max(e.def.g ? this.rangeOf(e, e.def.g) : 0, e.def.a ? this.rangeOf(e, e.def.a) : 0);
  }
  private acqOf(e: Ent9, inBunker = false): number { return acquireTiles(e.def.name, { ups: this.hasUp, inBunker }) * 32; }
  /** 그 몸이 지금 쏠 수 있나(땅 위 럴커 · 스캐럽 없는 리버 · 꺼진 캐논은 못 쏜다). */
  private canShoot(e: Ent9): boolean {
    if (e.def.burrowShoot && !e.burrowed) return false;
    if (e.def.reaver) return e.scarabs > 0;
    if (e.def.name === "Bunker") return e.cargo.length > 0;
    if (this.disabled(e)) return false;
    return !!(e.def.g || e.def.a);
  }
  /** OpenBW unit_target_attack_priority — 작을수록 먼저(나를 칠 수 있는 것 0 · 일꾼 2 · 남을 칠 수 있는 것 2 · 움직이는 비무장 3 · 건물 4 · 벙커 안 +1). */
  private prio(e: Ent9, t: Ent9): number {
    let tt = t; let loaded = false;
    if (t.def.name === "Bunker" && t.cargo.length) { const m = this.byId.get(t.cargo[0]); if (m) { tt = m; loaded = true; } }
    let r = 0;
    if (tt.def.worker) r += 2;
    else if (!(this.canShoot(tt) && this.weaponFor(tt, e))) {
      if (this.canShoot(tt)) r += 2;
      else if (tt.mv) r += 3;
      else r += 4;
    }
    if (loaded) r += 1;
    return r;
  }
  /** 획득 — maxD 안 적 중 우선순위가 가장 작은 무리에서 가장 가까운 것(OpenBW find_acquire_target). from 은 거리를 재는 몸(벙커). */
  private acquire(e: Ent9, maxD: number, from: Ent9 = e): Ent9 | null {
    let best: Ent9 | null = null; let bp = 99; let bd = Infinity;
    for (const o of this.ents) {
      if (o.dead || o.inside !== null || o.owner === e.owner || o.def.name === "Mineral Field") continue;
      const w = this.weaponFor(e, o); if (!w) continue;
      if (!this.visibleTo(o, e.owner)) continue;
      const d = this.dist(from, o);
      if (d > maxD || (w.minRangePx && d <= w.minRangePx)) continue;
      const p = this.prio(e, o);
      const cd = xyLen9(o.x - from.x, o.y - from.y);
      if (p < bp || (p === bp && cd < bd)) { bp = p; bd = cd; best = o; }
    }
    return best;
  }
  /** 적을 찾아 싸운다 — 싸웠으면 true. chase 면 획득 사거리 안을 쫓고, 아니면(홀드 · 붙박이) 무기 사거리 안만. */
  private fight(e: Ent9, chase: boolean): boolean {
    if (!this.canShoot(e)) return false;
    const hold = !chase && !!e.mv;
    let t = e.target !== null ? this.byId.get(e.target) : undefined;
    if (t && (t.dead || t.inside !== null || !this.weaponFor(e, t) || !this.visibleTo(t, e.owner))) t = undefined;
    if (t) {
      const d = this.dist(e, t); const r = this.rangeOf(e, this.weaponFor(e, t)!);
      if (hold || !e.mv ? d > Math.max(r, hold ? 0 : this.acqOf(e)) : d > Math.max(this.acqOf(e), r) + 64) t = undefined;
    }
    if (!t) t = this.acquire(e, hold ? this.maxRange(e) : this.acqOf(e)) ?? undefined;
    if (!t) { e.target = null; return false; }
    e.target = t.id;
    this.engage(e, t, chase && !!e.mv);
    return true;
  }
  /** 맞았는데 가만히 있던 유닛 — 때린 적을 되받는다(쏠 수 있으면). */
  private retaliate(e: Ent9): void {
    if (e.hitBy === null) return;
    const t = this.byId.get(e.hitBy); e.hitBy = null;
    if (!t || t.dead || t.inside !== null || !this.canShoot(e) || !this.weaponFor(e, t) || !this.visibleTo(t, e.owner)) return;
    e.target = t.id; this.engage(e, t, true);
  }
  private engage(e: Ent9, t: Ent9, chase: boolean): void {
    const w = this.weaponFor(e, t);
    if (!w || !this.canShoot(e)) { if (chase && e.mv) this.setGoal(e, t.x, t.y, true); return; }
    const d = this.dist(e, t);
    const range = this.rangeOf(e, w);
    if (d > range || (w.minRangePx && d <= w.minRangePx)) { if (chase && e.mv && !e.burrowed) this.setGoal(e, t.x, t.y, true); return; }
    /* 사거리 안 — 서서 표적 쪽으로 몸을 돌린다(몸 회전 상한) · 22.5° 안이면 쏜다. */
    e.goal = null; e.path = null;
    if (e.mv?.ctrl === 2) e.spd = 0;
    const want = Math.atan2(t.y - e.y, t.x - e.x);
    if (e.mv && !e.def.bld) {
      e.face = turnTo9(e.face, want, (e.mv.turnBody * FRAME_SEC * Math.PI) / 180);
      if (Math.abs(angDiff9(e.face, want)) > Math.PI / 8) return;
    } else e.face = want;
    if (e.def.reaver) {
      if (e.timer > 0 || e.scarabs <= 0) return;
      e.scarabs -= 1; e.timer = REAVER_FIRE9;
      this.scarabs.push({ x: e.x, y: e.y, tid: t.id, owner: e.owner, life: SCARAB_LIFE9, from: e.id });
      return;
    }
    if (t.def.air ? e.acd > 0 : e.gcd > 0) return;
    const cd = cooldownFrames(w) + (this.rand() & 3) - 1;
    if (t.def.air) e.acd = cd; else e.gcd = cd;
    this.fire(e, t, w, e.x, e.y);
  }
  /** 한 번 쏘기 — 튀김이 없으면 표적에 히트 수만큼 · 있으면 맞은 자리 둘레 링(1/2/4) · 럴커는 가시 줄. */
  private fire(e: Ent9, t: Ent9, w: Weapon, sx: number, sy: number): void {
    const col = e.owner === 0 ? "#ffe08a" : t.def.air ? "#ff6a4a" : "#ffb26a";
    if (w.splashKind === "lurker") {
      /* 가시 — 럴커 자리에서 표적 쪽으로 LURKER_SPINE_TRAVEL_PX 까지 · 줄에서 20px 안 적 지상에 한 번씩(감쇠 없음). */
      const a = Math.atan2(t.y - sy, t.x - sx); const ex = sx + Math.cos(a) * LURKER_SPINE_TRAVEL_PX; const ey = sy + Math.sin(a) * LURKER_SPINE_TRAVEL_PX;
      const vx = ex - sx; const vy = ey - sy;
      for (const o of this.ents) {
        if (o.dead || o.inside !== null || o.owner === e.owner || o.def.air || o.def.name === "Mineral Field") continue;
        const k = Math.max(0, Math.min(1, ((o.x - sx) * vx + (o.y - sy) * vy) / (vx * vx + vy * vy)));
        if (this.distTo(o, sx + vx * k, sy + vy * k) <= w.splashPx[0]) this.hitUnit(e, o, w, 1, w.hits);
      }
      this.shots.push({ x1: sx, y1: sy, x2: ex, y2: ey, t: 6, air: false, col: "#c58cff" });
      return;
    }
    this.shots.push({ x1: sx, y1: sy - (e.def.air ? 12 : 4), x2: t.x, y2: t.y - (t.def.air ? 12 : 0), t: w.rangePx > 40 ? 5 : 3, air: t.def.air, col });
    if (w.splashKind === "none") { this.hitUnit(e, t, w, 1, w.hits); return; }
    this.splash(e, t, w, t.x, t.y);
  }
  /** OpenBW bullet_deal_splash_damage — 맞은 자리에서 몸 상자까지 거리 · 적 튀김은 제 편(표적 말고) 안 침 · 무기가 겨눌 수 있는 층만. */
  private splash(e: Ent9, t: Ent9, w: Weapon, bx: number, by: number): void {
    const allies = w.splashKind === "radial";
    const both = !!(e.def.g && e.def.a && e.def.g.id === e.def.a.id);
    for (const o of this.ents) {
      if (o.dead || o.inside !== null || o === e || o.def.name === "Mineral Field") continue;
      if (!allies && o.owner === e.owner && o !== t) continue;
      if (w.id === "Scarab" ? o.def.air : !both && o.def.air !== t.def.air) continue;
      const d = this.distTo(o, bx, by);
      const div = splashDivisor(w, d, { burrowed: o.burrowed, isBulletTarget: o === t });
      if (div === null) continue;
      /* 파이어뱃 — 세 줄기 불길 중 한 표적은 보통 둘을 맞는다(bwUnits FIREBAT_HITS_ON_ONE_TARGET 의 어림 · 곁은 하나). */
      const hits = w.id === "Flame_Thrower" ? (o === t ? FIREBAT_HITS_ON_ONE_TARGET : 1) : w.hits;
      this.hitUnit(e, o, w, div, hits);
    }
    if (w.splashPx[2] >= 30) this.booms.push({ x: bx, y: by, t: 10, r: w.splashPx[1] });
  }
  /** 히트 — bwUnits attackOnce(fp8 · 히트마다 방어 · 크기 · 하한). */
  private hitUnit(e: Ent9, o: Ent9, w: Weapon, divisor: number, hits: number): void {
    if (o.dead) return;
    const lv = this.lv();
    const tg: DmgTarget = {
      hp: o.hp, shield: o.sh, hasShield: o.def.sh > 0, size: o.def.uc.size, armor: o.def.uc.armor,
      armorLv: o.def.uc.armorUp ? lv : 0, chitinous: o.def.name === "Ultralisk" && this.ups,
      plasmaLv: o.def.sh > 0 ? lv : 0,
    };
    const wl = w.upgrade === "Scarab Damage" ? (this.ups ? 1 : 0) : w.upgrade ? lv : 0;
    const r = attackOnce(w, tg, { weaponLv: wl, divisor, hits });
    o.hp = tg.hp; o.sh = tg.shield; o.hitT = 6;
    if (o.owner !== e.owner) o.hitBy = e.inside !== null ? e.inside : e.id;
    if (r.killed || o.hp <= 0) this.kill(o);
  }
  private kill(t: Ent9): void {
    if (t.dead) return;
    t.dead = true;
    this.booms.push({ x: t.x, y: t.y, t: t.def.bld ? 24 : 14, r: t.def.rad * (t.def.bld ? 1.1 : 1.4) });
    if (t.def.bld) this.markBlock(t, 0);
    if (t.def.name === "Pylon") this.powerDirty = true;
    if (t.owner === 1) {
      if (t.def.worker) this.stats.workers += 1;
      else if (t.def.g || t.def.a || t.def.name === "Bunker" || !t.def.bld) this.stats.defense += 1;
      else this.stats.buildings += 1;
    } else this.stats.lost += 1;
    /* 그릇이 터지면 — 벙커는 내려놓고(못 내리면 죽는다) · 수송선은 화물도 함께(OpenBW). */
    const bunker = t.def.name === "Bunker";
    for (const id of [...t.cargo]) {
      const u = this.byId.get(id); if (!u || u.dead) continue;
      if (bunker) {
        const p = this.placeUnit(u.def, t.x, t.y);
        if (p) { u.inside = null; u.x = p[0]; u.y = p[1]; u.orders = []; u.goal = null; u.arrived = true; continue; }
      }
      u.dead = true; u.inside = null;
      if (u.owner === 1) this.stats.defense += 1; else this.stats.lost += 1;
    }
    t.cargo = [];
  }
  /** 벙커 — 탄 마린마다 제 쿨다운으로 · 거리는 벙커 상자에서 · 사거리 +64 · 획득 +2타일. */
  private bunkerTick(b: Ent9): void {
    if (!b.cargo.length) return;
    const m0 = this.byId.get(b.cargo[0]); if (!m0) return;
    let t = b.target !== null ? this.byId.get(b.target) : undefined;
    if (t && (t.dead || t.inside !== null || !this.visibleTo(t, b.owner) || !this.weaponFor(m0, t) || this.dist(b, t) > this.rangeOf(m0, this.weaponFor(m0, t)!, true))) t = undefined;
    if (!t) t = this.acquire(m0, this.acqOf(m0, true), b) ?? undefined;
    if (!t) { b.target = null; return; }
    b.target = t.id;
    for (const id of b.cargo) {
      const m = this.byId.get(id); if (!m) continue;
      const w = this.weaponFor(m, t); if (!w) continue;
      if (this.dist(b, t) > this.rangeOf(m, w, true)) continue;
      if (t.def.air ? m.acd > 0 : m.gcd > 0) continue;
      const cd = cooldownFrames(w) + (this.rand() & 3) - 1;
      if (t.def.air) m.acd = cd; else m.gcd = cd;
      this.fire(m, t, w, b.x + ((id % 3) - 1) * 8, b.y - 6);
      if (t.dead) break;
    }
  }
  /** 리버 — 스캐럽을 원작 시간(105프레임)마다 하나씩 채운다(빨무라 돈은 무한). */
  private scarabTick(e: Ent9): void {
    const max = this.ups ? 10 : 5;
    if (e.scarabs >= max) { e.scarabT = 0; return; }
    if (e.scarabT <= 0) e.scarabT = SCARAB_BUILD9;
    else if (--e.scarabT === 0) e.scarabs += 1;
  }
  /** 스캐럽 — 표적 쪽으로 곧게 16px/프레임 · 상자에 닿으면 터진다 · 90프레임이면 사라진다(불발). */
  private scarabFly(): void {
    for (const s of this.scarabs) {
      s.life -= 1;
      const t = this.byId.get(s.tid);
      if (!t || t.dead || t.inside !== null) { s.life = 0; continue; }
      if (this.distTo(t, s.x, s.y) <= SCARAB_SPEED9) {
        const from = this.byId.get(s.from);
        const shooter = from ?? ({ owner: s.owner, def: UNIT_DEFS9.Reaver, inside: null, id: -1 } as unknown as Ent9);
        this.splash(shooter, t, WEAPONS.Scarab, t.x, t.y);
        this.booms.push({ x: t.x, y: t.y, t: 12, r: 40 });
        s.life = 0; continue;
      }
      const a = Math.atan2(t.y - s.y, t.x - s.x);
      s.x += Math.cos(a) * SCARAB_SPEED9; s.y += Math.sin(a) * SCARAB_SPEED9;
    }
    this.scarabs = this.scarabs.filter((s) => s.life > 0);
  }
  /** 메딕 — 곁(획득 사거리)의 다친 생체 아군에게 가서 30px 안이면 프레임마다 200 fp8 · 에너지 1 에 2 체력. 고쳤으면(또는 가는 중) true. */
  private healTick(e: Ent9): boolean {
    const o0 = e.orders[0];
    if (o0 && o0.t !== "hold" && o0.t !== "amove") return false;
    if (e.en < FP / 2) return false;
    let t = e.target !== null ? this.byId.get(e.target) : undefined;
    const hurt = (o: Ent9 | undefined): o is Ent9 => !!o && !o.dead && o.inside === null && o.owner === e.owner && o !== e && o.def.bio && !o.def.bld && o.hp < fp(o.def.hp);
    if (!hurt(t)) {
      t = undefined; let bd = this.acqOf(e);
      for (const o of this.ents) { if (!hurt(o)) continue; const d = this.dist(e, o); if (d < bd) { bd = d; t = o; } }
    }
    if (!t) { e.target = null; return false; }
    e.target = t.id;
    if (this.dist(e, t) > MEDIC_RANGE9) { if (o0?.t !== "hold") { this.setGoal(e, t.x, t.y, true); return true; } return false; }
    e.goal = null; e.face = Math.atan2(t.y - e.y, t.x - e.x);
    const amt = Math.min(fp(t.def.hp) - t.hp, MEDIC_HEAL9, e.en * 2);
    t.hp += amt; e.en -= Math.ceil(amt / 2);
    if (t.hp >= fp(t.def.hp)) e.target = null;
    return true;
  }

  /* ── 적 일꾼 — 캐고 나르기만 한다 ─────────────────────────────────────────── */
  /** i 째 일꾼이 캐는 자리 — 미네랄 아래 반원 고리 넷(한 고리 13 칸). */
  private mineSpot(i: number): [number, number] {
    const m = this.mineral; const ring = Math.floor(i / 13); const k = i % 13;
    const a = Math.PI * (-0.08 + 1.16 * (k / 12)); const r = 40 + ring * 16;
    return [m.x + Math.cos(a) * r * 1.25, m.y + Math.sin(a) * r * 0.85];
  }
  /** 나르는 자리 — 홀 아랫변 양옆(미네랄 곁). */
  private dropSpot(i: number): [number, number] {
    const h = this.hall!; const side = i % 2 === 0 ? -1 : 1; const k = (i >> 1) % 6;
    return [h.x + side * (44 + k * 6), h.y + 50 + (k % 2) * 6];
  }
  private workerTick(e: Ent9): void {
    const hall = this.hall;
    if (!hall || hall.dead) { e.goal = null; return; }
    const m = this.mineral;
    if (e.work === 0) {
      const [sx, sy] = this.mineSpot(e.slot);
      this.setGoal(e, sx, sy);
      if (e.arrived || Math.hypot(sx - e.x, sy - e.y) <= 6) { e.work = 1; e.workT = MINE_FRAMES9; e.goal = null; }
    } else if (e.work === 1) {
      e.face = Math.atan2(m.y - e.y, m.x - e.x);
      if (--e.workT <= 0) e.work = 2;
    } else if (e.work === 2) {
      const [dx, dy] = this.dropSpot(e.slot);
      this.setGoal(e, dx, dy);
      if (e.arrived || Math.hypot(dx - e.x, dy - e.y) <= 10) { e.work = 3; e.workT = 4; e.goal = null; }
    } else if (--e.workT <= 0) e.work = 0;
  }
}
