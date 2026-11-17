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
   ★ 하템 · 리버 · 탱크 드랍(2026-11-17 넷째, 요청: "하템 리버 탱크 드랍이 주라 필수야") — 사이오닉 스톰(OpenBW order_Spell · bullet_state_damage_over_time ·
     storm_timer) · 시즈/언시즈(order_Sieging · order_Unsieging · morph_unit) · 내린 유닛 spell_cooldown 30 을 넣었다(아래 STORM_ · SIEGE_ 상수).
   일부러 줄인 것: 시야 · 안개 없음 · 총알 날아가는 시간 없음(맞는 순간 피해 · 스캐럽만 날아간다) · 지상 유닛끼리 밀어내기는 가벼운 떼어 놓기 ·
   스팀 · 시야 기술은 없음 · 리버 스캐럽은 원작 시간(105프레임)으로 저절로 채운다(빨무라 돈은 무한) · 럴커 버로우 시간은 재생기와 같은 어림(0.9초). */
import type { MapTerrain } from "../../utils/mapTerrain";
import { TILE } from "../../utils/mapTerrain";
import {
  BUILD_FRAMES, FIREBAT_HITS_ON_ONE_TARGET, FP, FRAME_SEC, LURKER_SPINE_TRAVEL_PX, WEAPONS,
  acquireTiles, attackOnce, cooldownFrames, fp, moveDynOf, splashDivisor, unitOf, weaponRangePx,
  type DmgTarget, type MoveDyn, type UnitCombat, type Weapon,
  UPGRADE_TIME,
} from "../../utils/bwUnits";
import { PRAC_MAP9, type PracStartData9 } from "./practiceMap9.gen";

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
  /** 자원(미네랄 · 가스) — 표적 · 고르기에서 빠지는 꾸밈. */ res?: boolean;
}

/* 이름 · 한글 · 종족 · 수송 칸(units.dat space_required). 수치는 아래 mkDef9 가 원장에서 가져온다. */
const LIST9: [string, string, PracRace9, number][] = [
  ["Dropship", "드랍십", "T", 0], ["Shuttle", "셔틀", "P", 0], ["Overlord", "오버로드", "Z", 0],
  ["Marine", "마린", "T", 1], ["Firebat", "파이어뱃", "T", 1], ["Medic", "메딕", "T", 1], ["Ghost", "고스트", "T", 1],
  ["Vulture", "벌처", "T", 2], ["Siege Tank", "시즈 탱크", "T", 4], ["Siege Tank (Siege Mode)", "시즈 탱크(시즈 모드)", "T", 4], ["Goliath", "골리앗", "T", 2],
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
  /* 내 기지(2026-11-17 셋째 판 · 맵 6판과 같은 건물 — 생산 · 테크 다 지은 채) */
  ["Comsat Station", "컴샛 스테이션", "T", 0], ["Machine Shop", "머신 샵", "T", 0], ["Control Tower", "컨트롤 타워", "T", 0],
  ["Covert Ops", "코버트 옵스", "T", 0], ["Physics Lab", "피직스 랩", "T", 0], ["Science Facility", "사이언스 퍼실리티", "T", 0],
  ["Starport", "스타포트", "T", 0], ["Engineering Bay", "엔지니어링 베이", "T", 0], ["Academy", "아카데미", "T", 0], ["Armory", "아머리", "T", 0],
  ["Stargate", "스타게이트", "P", 0], ["Forge", "포지", "P", 0], ["Robotics Facility", "로보틱스 퍼실리티", "P", 0],
  ["Robotics Support Bay", "로보틱스 서포트 베이", "P", 0], ["Observatory", "옵저버토리", "P", 0], ["Citadel of Adun", "시타델 오브 아둔", "P", 0],
  ["Templar Archives", "템플러 아카이브", "P", 0], ["Fleet Beacon", "플릿 비컨", "P", 0], ["Arbiter Tribunal", "아비터 트리뷰널", "P", 0],
  ["Hive", "하이브", "Z", 0], ["Greater Spire", "그레이터 스파이어", "Z", 0], ["Queen's Nest", "퀸즈 네스트", "Z", 0],
  ["Defiler Mound", "디파일러 마운드", "Z", 0], ["Ultralisk Cavern", "울트라리스크 캐번", "Z", 0],
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
  ...mkDef9("Pylon", "미네랄", "T", 0), name: "Mineral Field", hp: 1, sh: 0, box: [32, 16, 31, 15], rad: 32, g: null, a: null, detector: false, foot: [2, 1], res: true,
};
/* 가스 — 같은 꾸밈(BWAPI 치수 좌 64 · 위 32 · 우 63 · 아래 31 · 발자국 4×2). */
UNIT_DEFS9["Vespene Geyser"] = {
  ...mkDef9("Pylon", "베스핀 가스", "T", 0), name: "Vespene Geyser", hp: 1, sh: 0, box: [64, 32, 63, 31], rad: 64, g: null, a: null, detector: false, foot: [4, 2], res: true,
};
const WORKER9: Record<PracRace9, string> = { T: "SCV", P: "Probe", Z: "Drone" };
const HALL9: Record<PracRace9, string> = { T: "Command Center", P: "Nexus", Z: "Hatchery" };

/* ★★ 셋째 판(2026-11-17, 요청: "우리 홈피의 드랍연습도 맵하고 똑같이 · 초중반 선택과 종족, 자리 선택 · 유닛이나 셔틀은 직접 뽑게") —
   설정은 내 종족 · 내 자리 · 적 타워(초반/중반) 셋뿐. 나머지는 맵 6판 그대로다(practiceMap9.gen):
     · 내 기지 = 그 스타팅에 생산 · 테크 건물이 다 지어진 채(업그레이드 · 연구는 직접) · 유닛 · 수송선은 건물에서 직접 뽑는다.
     · 시간 1/24(맵의 UNIx · UPGx · TECx 와 같은 자) · 돈 · 보급 무한 · 오버로드 수송(Ventral Sacs)은 처음부터.
     · 적 기지 = 내 자리 말고 모든 스타팅(종족은 맵이 정한 대로) · 홀 · 일꾼 10(캐는 중) · 초반 타워 · 중반이면 가장자리까지 더.
   옛 설정(적 종족 · 적 위치 · 수송선 수 · 태울 유닛 · 연구 다 · 공방 · 시작 에너지)은 걷었다. */
/** 사람이 설 수 있는 스타팅(맵 6판 P1 ~ P6) — 깃발이 닿는 자리. */
export const PRAC_SPOTS9: { key: string; label: string; x: number; y: number }[] =
  PRAC_MAP9.starts.filter((s) => s.human).map((s) => ({ key: s.key, label: s.name, x: s.hall[0], y: s.hall[1] }));
export type PracStage9 = "early" | "mid";
export interface PracSetup9 {
  myRace: PracRace9;
  mySpot: string;
  /** 적 타워 — 초반(본진 둘레) · 중반(가장자리까지 도배). */ stage: PracStage9;
}
/** 시간 배수 — 맵 6판이 build time 을 1/24 로 줄였다(practice5.py '유닛 설정: 시간만 1/24'). */
const TIME_DIV9 = 24;
/** 생산 · 연구 한 칸 — 단축키는 원작 명령 카드의 글자. */
export interface ProdItem9 { k: "unit" | "tech" | "up"; name: string; ko: string; key: string }
const U9 = (name: string, ko: string, key: string): ProdItem9 => ({ k: "unit", name, ko, key });
const T9 = (name: string, ko: string, key: string): ProdItem9 => ({ k: "tech", name, ko, key });
const P9 = (name: string, ko: string, key: string): ProdItem9 => ({ k: "up", name, ko, key });
/** 건물마다 명령 카드(이 셈이 그리는 유닛 · 효과가 있는 연구만). */
export const PROD9: Record<string, ProdItem9[]> = {
  Barracks: [U9("Marine", "마린", "M"), U9("Firebat", "파이어뱃", "F"), U9("Medic", "메딕", "C"), U9("Ghost", "고스트", "G")],
  Factory: [U9("Vulture", "벌처", "V"), U9("Siege Tank", "시즈 탱크", "T"), U9("Goliath", "골리앗", "G")],
  Starport: [U9("Dropship", "드랍십", "D")],
  "Machine Shop": [T9("Tank Siege Mode", "시즈 모드", "S"), P9("Ion Thrusters", "벌처 속업", "I"), P9("Charon Boosters", "골리앗 사업", "C")],
  Academy: [P9("U-238 Shells", "마린 사업", "U"), P9("Caduceus Reactor", "메딕 에너지", "C")],
  "Covert Ops": [P9("Moebius Reactor", "고스트 에너지", "M")],
  "Engineering Bay": [P9("Terran Infantry Weapons", "보병 공업", "W"), P9("Terran Infantry Armor", "보병 방업", "A")],
  Armory: [P9("Terran Vehicle Weapons", "메카닉 공업", "V"), P9("Terran Vehicle Plating", "메카닉 방업", "P"), P9("Terran Ship Plating", "비행 방업", "S")],
  Gateway: [U9("Zealot", "질럿", "Z"), U9("Dragoon", "드라군", "D"), U9("High Templar", "하이 템플러", "T"), U9("Dark Templar", "다크 템플러", "K")],
  "Robotics Facility": [U9("Shuttle", "셔틀", "S"), U9("Reaver", "리버", "V")],
  "Cybernetics Core": [P9("Singularity Charge", "드라군 사업", "S"), P9("Protoss Air Armor", "비행 방업", "A")],
  "Citadel of Adun": [P9("Leg Enhancements", "발업", "L")],
  "Templar Archives": [T9("Psionic Storm", "사이오닉 스톰", "P"), P9("Khaydarin Amulet", "하템 에너지", "K")],
  "Robotics Support Bay": [P9("Gravitic Drive", "셔틀 속업", "G"), P9("Reaver Capacity", "리버 칸", "C"), P9("Scarab Damage", "스캐럽 공업", "S")],
  Forge: [P9("Protoss Ground Weapons", "지상 공업", "W"), P9("Protoss Ground Armor", "지상 방업", "A"), P9("Protoss Plasma Shields", "실드업", "S")],
  Hive: [U9("Zergling", "저글링", "Z"), U9("Hydralisk", "히드라", "H"), U9("Ultralisk", "울트라", "U"), U9("Defiler", "디파일러", "F"), U9("Overlord", "오버로드", "O"),
    P9("Pneumatized Carapace", "오버로드 속업", "P"), P9("Ventral Sacs", "오버로드 수송", "V")],
  "Spawning Pool": [P9("Metabolic Boost", "저글링 속업", "M")],
  "Hydralisk Den": [P9("Muscular Augments", "히드라 속업", "A"), P9("Grooved Spines", "히드라 사업", "G"), T9("Lurker Aspect", "럴커", "L")],
  "Evolution Chamber": [P9("Zerg Melee Attacks", "근접 공업", "M"), P9("Zerg Missile Attacks", "원거리 공업", "A"), P9("Zerg Carapace", "지상 방업", "C")],
  "Ultralisk Cavern": [P9("Anabolic Synthesis", "울트라 속업", "A"), P9("Chitinous Plating", "울트라 방업", "C")],
  "Defiler Mound": [P9("Metasynaptic Node", "디파일러 에너지", "M")],
  "Greater Spire": [P9("Zerg Flyer Carapace", "비행 방업", "C")],
};
/** 기술 연구 시간(프레임 · techdata) — 업그레이드는 UPGRADE_TIME. */
const TECH_FRAMES9: Record<string, number> = { "Tank Siege Mode": 1200, "Psionic Storm": 1800, "Lurker Aspect": 1800 };
/** UPGRADE_TIME 에 빠진 셋(upgrades.dat 기본 시간). */
const UP_FRAMES9: Record<string, number> = { "Charon Boosters": 2000, "Caduceus Reactor": 2500, "Khaydarin Amulet": 2500, "Anabolic Synthesis": 2000, "Chitinous Plating": 2000 };
/** 최대 에너지 연구(캐스터마다). */
const ENERGY_UP9: Record<string, string> = { "High Templar": "Khaydarin Amulet", Medic: "Caduceus Reactor", Ghost: "Moebius Reactor", Defiler: "Metasynaptic Node" };
/** 원작 build time(프레임) — 표에 없는 것은 어림. */
const BUILD9 = (name: string): number => BUILD_FRAMES[name] ?? ({ Archon: 300, Lurker: 600 } as Record<string, number>)[name] ?? 600;

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
  | { t: "burrow" } | { t: "unburrow" }
  /** 시즈 모드 · 탱크 모드(Tank Siege Mode 연구). */
  | { t: "siege" } | { t: "unsiege" }
  /** 사이오닉 스톰 — 그 자리(288px 안으로 걸어가 에너지 75). */
  | { t: "storm"; x: number; y: number }
  /** 럴커 변태(히드라 · Lurker Aspect) · 아콘 합체(하템 둘 — 서로를 향해 걷다 닿으면 하나가 된다). */
  | { t: "lurker" } | { t: "archon"; id: number };

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
  /** 기술 쿨다운(spell_cooldown) · 스톰 면역(storm_timer · 8프레임 상태 틱마다 1 줄어든다). */ spellCd: number; stormT: number;
  /** 시즈 전환 남은 프레임 · 끝나면 바뀔 모습(언시즈 = 끝에 바뀐다). */ xT: number; xTo: string | null;
  dead: boolean; hitT: number;
  /** 생산 · 연구 줄(건물 · 다섯 칸) · 지금 것의 남은/전체 프레임 · 모이는 자리. */ queue: ProdItem9[]; prodT: number; prodMax: number; rally: [number, number] | null;
  /** 적 일꾼 · 홀의 기지 번호(-1 없음). */ base: number;
  /** 변태 · 소환 남은 프레임(럴커 알 · 아콘 합체 — 그동안 아무것도 안 한다) · 끝나면 바뀔 모습. */ morphT: number; morphMax: number; morphTo: string | null;
}
export interface Shot9 { x1: number; y1: number; x2: number; y2: number; t: number; air: boolean; col: string }
export interface Boom9 { x: number; y: number; t: number; r: number }
export interface Scarab9 { x: number; y: number; tid: number; owner: 0 | 1; life: number; from: number }
/** 스톰 마당 — life 는 남은 프레임(OpenBW bullet remaining_time). */
export interface Storm9 { x: number; y: number; owner: 0 | 1; life: number; from: number }
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
const SCARAB_BUILD9 = Math.max(1, Math.round((BUILD_FRAMES.Scarab ?? 105) / TIME_DIV9));   // 맵 6판 1/24
/** 에너지 · 실드 · 저그 체력 회복(fp8/프레임) — 8 · 7 · 4. */
const ENERGY_REGEN9 = 8; const SHIELD_REGEN9 = 7; const ZERG_REGEN9 = 4;
/** 메딕 — 한 프레임에 최대 200 fp8 · 에너지 1 에 2 체력 · 사거리 30px. */
const MEDIC_HEAL9 = 200; const MEDIC_RANGE9 = 30;
/** 버로우(파기 · 나오기) — 원작 애니메이션 길이를 못 열어 재생기 BURROW_DIG_SEC 0.9초와 같은 어림. */
const BURROW_FRAMES9 = Math.round(0.9 / FRAME_SEC);
/** 사이오닉 스톰 — 에너지 75(techdata) · 사거리 288 · 반지름 48 · 한 번 14(방어 무시 · weapons.dat).
 *  지속(weapons.dat lifetime)은 이 환경에서 원본을 못 열었다 — OpenBW bullet_state_damage_over_time 이 남은 시간이 7 의 배수일 때마다 치므로
 *  알려진 총합 112(= 14 × 8)를 내는 값은 50~56 뿐이고, 옛 공략의 "4초 동안(보통 속도 15fps)" 에 맞는 56 을 쓴다 [유도 · 어림]. */
const STORM_ENERGY9 = 75; const STORM_LIFE9 = 56; const STORM_EVERY9 = 7; const STORM_R9 = 48;
/** 내린 유닛의 spell_cooldown(OpenBW unit_unload). */
const UNLOAD_SPELL_CD9 = 30;
/** 시즈 · 언시즈 애니메이션 — iscript 를 못 열어 재생기 SIEGE_XF_SEC 1.5초와 같은 어림. */
const SIEGE_FRAMES9 = Math.round(1.5 / FRAME_SEC);
/** 포탑으로 쏘는 것 — 몸을 표적 쪽으로 안 돌려도 쏜다. */
const TURRET9 = new Set(["Siege Tank", "Siege Tank (Siege Mode)", "Goliath"]);
/** 에너지를 쓰는 유닛 · 최대 에너지 연구(Khaydarin Amulet · Caduceus · Moebius · Metasynaptic). */
const CASTERS9 = new Set(["High Templar", "Medic", "Ghost", "Defiler"]);
/** 벙커 안 마린 수(셋째 판 기지엔 벙커가 없다 — 그릇 규칙만 남긴다). */
const BUNKER_MARINES9 = 4;

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
/** 전원이 있어야 서는 프로토스 건물(넥서스 · 파일런 · 가스 말고 다). 꺼지면 쏘지도 · 만들지도 못한다. */
const NEEDS_POWER9 = new Set(["Photon Cannon", "Gateway", "Cybernetics Core", "Stargate", "Forge", "Robotics Facility", "Robotics Support Bay", "Observatory",
  "Citadel of Adun", "Templar Archives", "Fleet Beacon", "Arbiter Tribunal"]);
/** 적 기지 하나 — 홀 · 미네랄 무더기 · 일꾼이 오가는 두 자리(캐는 곳 · 내려놓는 곳)의 축. */
interface FoeBase9 { start: PracStartData9; hall: number; mx: number; my: number; ux: number; uy: number; far: boolean }

export class PracticeSim9 {
  readonly W: number; readonly H: number;
  ents: Ent9[] = [];
  byId = new Map<number, Ent9>();
  shots: Shot9[] = [];
  booms: Boom9[] = [];
  scarabs: Scarab9[] = [];
  storms: Storm9[] = [];
  stats: PracStats9 = { workers: 0, defense: 0, buildings: 0, lost: 0, tick: 0 };
  private nextId = 1;
  private walk: Uint8Array; private cw: number; private ch: number;
  /** 건물이 막은 칸. */ private block: Uint8Array;
  readonly setup: PracSetup9;
  /** 적 기지들(내 자리 말고 모든 스타팅). */
  bases: FoeBase9[] = [];
  /** 적 일꾼 처음 수(HUD 의 분모). */ foeWorkers = 0;
  /** 원작 lcg 대신 고정 씨앗 — 같은 판은 같게 돈다. */
  private seed = 0x2545f491;
  /** 연구 · 업그레이드 단계(임자마다) — 기술은 1. */
  readonly res: [Map<string, number>, Map<string, number>] = [new Map([["Ventral Sacs", 1]]), new Map()];
  /** 전원 — 파일런이 바뀐 프레임에만 다시 잰다. */
  private powerDirty = true;
  private powered = new Set<number>();
  /** 이 프레임의 편별 몸(획득이 상대 편만 훑게 · step 머리에서 짓는다). */
  private side: [Ent9[], Ent9[]] = [[], []];

  constructor(mt: MapTerrain, setup: PracSetup9) {
    this.setup = { ...setup };
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
  /* ── 연구 ─────────────────────────────────────────────────────────────── */
  /** 그 편이 그 연구를 마쳤나(업그레이드는 1단 이상). */
  has(owner: 0 | 1, name: string): boolean { return (this.res[owner].get(name) ?? 0) > 0; }
  /** 업그레이드 단계. */
  lvOf(owner: 0 | 1, name: string | null): number { return name ? this.res[owner].get(name) ?? 0 : 0; }
  private upList(owner: 0 | 1): string[] { return [...this.res[owner].keys()]; }
  /** 최대 에너지(fp8) — 에너지 연구면 250 · 아니면 200 · 안 쓰는 유닛 0. */
  maxEnergy(def: UnitDef9, owner: 0 | 1 = 0): number {
    if (!CASTERS9.has(def.name)) return 0;
    const up = ENERGY_UP9[def.name];
    return fp(up && this.has(owner, up) ? 250 : 200);
  }
  /** 업그레이드 최대 단계. */
  maxLv(name: string): number { return UPGRADE_TIME[name]?.[2] ?? 1; }
  /** 연구가 걸린(진행 · 대기) 수 — 같은 연구를 두 번 걸지 않게. */
  queuedOf(owner: 0 | 1, name: string): number {
    let n = 0;
    for (const e of this.ents) if (!e.dead && e.owner === owner) for (const q of e.queue) if (q.k !== "unit" && q.name === name) n += 1;
    return n;
  }
  /** 한 칸의 프레임(1/24) — 업그레이드는 다음 단계의 값. */
  frames9(it: ProdItem9, owner: 0 | 1): number {
    let f: number;
    if (it.k === "unit") f = BUILD9(it.name);
    else if (it.k === "tech") f = TECH_FRAMES9[it.name] ?? 1200;
    else {
      const t = UPGRADE_TIME[it.name]; const lv = this.lvOf(owner, it.name) + 1;
      f = t ? t[0] + Math.max(0, lv - 1) * t[1] : UP_FRAMES9[it.name] ?? 2000;
    }
    return Math.max(1, Math.round(f / TIME_DIV9));
  }
  /** 이 칸을 지금 걸 수 있나 — 다 했거나 이미 걸렸으면 안 된다 · 줄은 다섯 칸. */
  canQueue(b: Ent9, it: ProdItem9): boolean {
    if (b.dead || b.owner !== 0 || b.queue.length >= 5) return false;
    if (it.k === "unit") return true;
    return this.lvOf(0, it.name) + this.queuedOf(0, it.name) < (it.k === "tech" ? 1 : this.maxLv(it.name));
  }
  /** 생산 · 연구를 줄에 건다. */
  train(bid: number, key: string): boolean {
    const b = this.byId.get(bid); if (!b) return false;
    const it = (PROD9[b.def.name] ?? []).find((x) => x.key === key || x.name === key);
    if (!it || !this.canQueue(b, it)) return false;
    b.queue.push(it);
    return true;
  }
  /** 줄의 i 째를 무른다(지금 것이면 시간도 처음으로). */
  cancel(bid: number, i: number): void {
    const b = this.byId.get(bid); if (!b || b.owner !== 0 || i < 0 || i >= b.queue.length) return;
    b.queue.splice(i, 1);
    if (i === 0) { b.prodT = 0; b.prodMax = 0; }
  }
  /** 모이는 자리(생산 건물 고른 채 우클릭). */
  setRally(bid: number, x: number, y: number): void { const b = this.byId.get(bid); if (b && b.owner === 0 && PROD9[b.def.name]?.some((x9) => x9.k === "unit")) b.rally = [x, y]; }
  /** 건물 한 프레임 — 줄 맨 앞을 센다 · 다 되면 낳거나 연구를 올린다(전원이 꺼진 프로토스 건물은 멈춘다). */
  private prodTick(b: Ent9): void {
    if (!b.queue.length || this.disabled(b)) return;
    const it = b.queue[0];
    if (b.prodMax === 0) { b.prodMax = this.frames9(it, b.owner); b.prodT = b.prodMax; }
    if (--b.prodT > 0) return;
    b.queue.shift(); b.prodMax = 0; b.prodT = 0;
    if (it.k === "unit") {
      for (let i = 0; i < (it.name === "Zergling" ? 2 : 1); i += 1) this.hatch(b, it.name);
      return;
    }
    this.res[b.owner].set(it.name, this.lvOf(b.owner, it.name) + 1);
    /* 이동 연구는 그 편 몸의 물리를 다시(moveDynOf 가 이름만 본다). */
    for (const e of this.ents) if (!e.dead && e.owner === b.owner && e.mv) e.mv = moveDynOf(e.def.name, this.upList(b.owner));
  }
  /** 새 유닛 — 건물 아래쪽 땅(공중은 건물 자리) · 모이는 자리가 있으면 그리로 걷는다. */
  private hatch(b: Ent9, name: string): void {
    const def = UNIT_DEFS9[name]; if (!def) return;
    let x = b.x; let y = b.y;
    if (!def.air) {
      const p0 = this.nearestWalk(b.x, b.y + b.def.box[3] + def.box[1] + 4, 12);
      const p = p0 ? this.placeUnit(def, p0[0], p0[1]) ?? p0 : null;
      if (p) { x = p[0]; y = p[1]; }
    }
    const e = this.spawn(name, b.owner, x, y);
    if (b.rally) this.order([e.id], { t: "move", x: b.rally[0], y: b.rally[1] }, false);
  }

  /* ── 자리 잡기 ─────────────────────────────────────────────────────────── */
  private spawn(name: string, owner: 0 | 1, x: number, y: number): Ent9 {
    const def = UNIT_DEFS9[name];
    const mv = def.speed > 0 ? moveDynOf(name, this.upList(owner)) : null;
    const e: Ent9 = {
      id: this.nextId++, def, owner, x, y, hp: fp(def.hp), sh: fp(def.sh), en: Math.floor(this.maxEnergy(def, owner) / 4),   // 원작 새 유닛(최대의 1/4 · OpenBW create_unit)
      face: Math.PI / 2, course: Math.PI / 2, spd: 0, mv,
      orders: [], goal: null, arrived: true, path: null, pathTo: null,
      gcd: 0, acd: 0, timer: 0, target: null, hitBy: null, cargo: [], inside: null, para: false, ost: 0,
      work: 0, workT: 0, slot: 0, burrowed: false, burrowT: 0,
      scarabs: 0, scarabT: 0, spellCd: 0, stormT: 0, xT: 0, xTo: null,
      dead: false, hitT: 0,
      queue: [], prodT: 0, prodMax: 0, rally: null, base: -1, morphT: 0, morphMax: 0, morphTo: null,
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

  /** 건물 칸 가운데 — 맵 트리거가 로케이션(칸 4×3) 한가운데에 지은 자리(OpenBW trigger_create_unit 이 타일에 맞춘 꼴 · practice5.py bcenter). */
  private static cellCenter9(cell: [number, number], foot: [number, number]): [number, number] {
    const [x, y] = cell; const [w, h] = foot;
    const px = (x + 2) * 32; const py = Math.floor((y + 1.5) * 32);
    const tlx = Math.floor((px - w * 16) / 32) * 32; const tly = Math.floor((py - h * 16) / 32) * 32;
    return [tlx + w * 16, tly + h * 16];
  }
  private populate(): void {
    const s = this.setup;
    const mine = PRAC_MAP9.starts.find((p) => p.key === s.mySpot && p.human) ?? PRAC_MAP9.starts.find((p) => p.human)!;
    this.setup.mySpot = mine.key;
    /* 자원 — 모든 스타팅의 미네랄 무더기(사람 자리는 맵 6판이 옮긴 자리) · 가스 · 스타팅 밖 미네랄. */
    for (const st of PRAC_MAP9.starts) this.spawn("Mineral Field", 1, st.mineral[0], st.mineral[1]);
    for (const [x, y] of PRAC_MAP9.minerals) this.spawn("Mineral Field", 1, x, y);
    for (const [x, y] of PRAC_MAP9.geysers) this.spawn("Vespene Geyser", 1, x, y);
    this.buildMine(mine);
    this.spawnFoes();
  }
  /** 내 기지 — 맵 6판 종족 비컨 트리거와 같은 건물 · 같은 칸(practice5.py T_PLAN · P_BLD · Z_BLD). */
  private buildMine(st: PracStartData9): void {
    const race = this.setup.myRace;
    const cells = st.cells ?? [];
    const put = (name: string, cell: [number, number]): void => {
      const [x, y] = PracticeSim9.cellCenter9(cell, UNIT_DEFS9[name].foot ?? [3, 2]);
      this.spawn(name, 0, x, y);
    };
    const slot = (k: number): [number, number] => [(cells[k][0] + 5) * 32, (cells[k][1] + 2) * 32];   // 칸 오른쪽 2×2 가운데
    const [hx, hy] = st.hall;
    if (race === "T") {
      if (st.comsat) this.spawn("Comsat Station", 0, st.comsat[0] * 32 + 32, st.comsat[1] * 32 + 32);
      this.spawn("Command Center", 0, hx, hy);
      const plan: [string, string | null][] = [["Barracks", null], ["Factory", "Machine Shop"], ["Starport", "Control Tower"], ["Science Facility", "Covert Ops"],
        ["Science Facility", "Physics Lab"], ["Engineering Bay", null], ["Academy", null], ["Armory", null]];
      plan.forEach(([b9, ad9], k) => {
        if (!cells[k]) return;
        if (ad9) { const [ax, ay] = slot(k); this.spawn(ad9, 0, ax, ay); }
        put(b9, cells[k]);
      });
    } else if (race === "P") {
      this.spawn("Nexus", 0, hx, hy);
      for (const k of st.pylons ?? []) if (cells[k]) { const [px, py] = slot(k); this.spawn("Pylon", 0, px, py); }
      ["Gateway", "Stargate", "Forge", "Cybernetics Core", "Robotics Facility", "Robotics Support Bay", "Observatory", "Citadel of Adun",
        "Templar Archives", "Fleet Beacon", "Arbiter Tribunal"].forEach((b9, k) => { if (cells[k]) put(b9, cells[k]); });
    } else {
      ["Spawning Pool", "Evolution Chamber", "Hydralisk Den", "Greater Spire", "Queen's Nest", "Defiler Mound", "Ultralisk Cavern"]
        .forEach((b9, k) => { if (cells[k]) put(b9, cells[k]); });
      this.spawn("Hive", 0, hx, hy);
      /* 오버로드 셋(맵 6판 저그 트리거 그대로) — 하이브에서 지도 가운데 쪽으로 조금(하이브를 덮지 않게). */
      const ang = Math.atan2(this.H / 2 - hy, this.W / 2 - hx);
      for (let i = 0; i < 3; i += 1) {
        const side = (i - 1) * 56;
        const o = this.spawn("Overlord", 0, hx + Math.cos(ang) * 150 - Math.sin(ang) * side, hy + Math.sin(ang) * 150 + Math.cos(ang) * side);
        o.face = ang; o.course = ang;
      }
    }
  }
  /** 적 기지 — 내 자리 말고 모든 스타팅 · 맵이 정한 종족 · 홀 · 일꾼 10 · 초반 타워(+ 중반이면 가장자리까지). */
  private spawnFoes(): void {
    this.bases = []; this.foeWorkers = 0;
    for (const st of PRAC_MAP9.starts) {
      if (st.key === this.setup.mySpot) continue;
      const hall = this.spawn(HALL9[st.race], 1, st.hall[0], st.hall[1]);
      const [mx, my] = st.mineral;
      const dx = st.hall[0] - mx; const dy = st.hall[1] - my; const d = Math.hypot(dx, dy) || 1;
      /* 미네랄이 홀에 붙어 있으면(12 · 6시 — 사람이 못 서는 자리라 안 옮겼다) 바깥쪽에서 캐서 홀 옆구리로 나른다. */
      const ux = dx / d; const uy = dy / d;
      const gap = d - (Math.abs(ux) * 58 + Math.abs(uy) * 41) - (Math.abs(ux) * 32 + Math.abs(uy) * 16);
      const bi = this.bases.length;
      this.bases.push({ start: st, hall: hall.id, mx, my, ux, uy, far: gap < 24 });
      hall.base = bi;
      st.workers.forEach(([x, y], i) => {
        const p = this.nearestWalk(x, y, 4) ?? [x, y];
        const w = this.spawn(WORKER9[st.race], 1, p[0], p[1]);
        w.base = bi; w.slot = i; w.work = i % 3 === 0 ? 2 : 0; w.workT = (i * 13) % MINE_FRAMES9;
      });
      this.foeWorkers += st.workers.length;
      for (const [n, x, y] of st.early) this.spawn(n, 1, x, y);
      if (this.setup.stage === "mid") for (const [n, x, y] of st.mid) this.spawn(n, 1, x, y);
    }
  }
  /** 초반 ↔ 중반 — 적만 새로 세운다(맵 6판 비컨 그대로: 타워 · 일꾼을 다시 채우고 내 기지 · 내 유닛은 그대로). */
  setStage(stage: PracStage9): void {
    this.setup.stage = stage;
    for (const e of this.ents) {
      if (e.dead || e.owner !== 1 || e.def.res) continue;
      e.dead = true;
      if (e.def.bld && e.def.foot) this.markBlock(e, 0);
      for (const id of e.cargo) { const u = this.byId.get(id); if (u) u.dead = true; }
    }
    this.powerDirty = true;
    this.scarabs = this.scarabs.filter((sc) => { const t = this.byId.get(sc.tid); return !!t && !t.dead; });
    this.ents = this.ents.filter((e) => !e.dead || e.inside !== null);
    this.spawnFoes();
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
      if (e.dead || e.inside !== null || e.def.res) continue;
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
      /* 붙박이(시즈 모드)는 홀드 · 공격 · 언시즈만 받는다(원작: 움직이는 명령은 안 먹는다 · 태우기도 못 한다). */
      if (!e.mv && o.t !== "hold" && o.t !== "attack" && o.t !== "unsiege") continue;
      if (e.morphT > 0) continue;   // 알 · 합체 중
      if ((o.t === "siege" && (e.def.name !== "Siege Tank" || !this.has(0, "Tank Siege Mode"))) || (o.t === "unsiege" && e.def.name !== "Siege Tank (Siege Mode)")) continue;
      if (o.t === "storm" && (e.def.name !== "High Templar" || !this.has(0, "Psionic Storm"))) continue;
      if (o.t === "lurker" && (e.def.name !== "Hydralisk" || !this.has(0, "Lurker Aspect"))) continue;
      if (o.t === "archon" && (e.def.name !== "High Templar" || o.id === e.id)) continue;
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
    /* 편별 몸 — 획득 · 튀김이 상대 편만 훑는다(적 타워 수백 × 내 몸 수십). */
    this.side[0] = []; this.side[1] = [];
    for (const e of this.ents) if (!e.dead && e.inside === null && !e.def.res) this.side[e.owner].push(e);
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.gcd > 0) e.gcd -= 1;
      if (e.acd > 0) e.acd -= 1;
      if (e.timer > 0) e.timer -= 1;
      if (e.spellCd > 0) e.spellCd -= 1;
      if (e.stormT > 0 && (this.stats.tick + e.id) % 8 === 0) e.stormT -= 1;   // update_unit_status_timers — 8프레임마다
      if (e.inside !== null) continue;
      if (e.hitT > 0) e.hitT -= 1;
      this.regen(e);
      if (e.def.reaver) this.scarabTick(e);
      if (e.def.name === "Bunker") { this.bunkerTick(e); continue; }
      if (e.def.bld) { if (e.queue.length) this.prodTick(e); if (!this.disabled(e) && (e.def.g || e.def.a)) this.fight(e, false); continue; }
      if (e.owner === 1 && e.def.worker) { this.workerTick(e); this.drive(e); continue; }
      this.unitTick(e);
      this.drive(e);
    }
    this.scarabFly();
    this.stormTick();
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
    const max = this.maxEnergy(e.def);
    if (max > 0 && e.en < max) e.en = Math.min(max, e.en + ENERGY_REGEN9);
  }

  private unitTick(e: Ent9): void {
    e.para = false;
    if (e.morphT > 0) {
      /* 럴커 알 · 아콘 소환 — 서서 기다린다(맞기는 한다). */
      e.spd = 0; e.goal = null;
      if (--e.morphT === 0 && e.morphTo) { this.morph(e, e.morphTo); e.morphTo = null; e.orders = []; }
      return;
    }
    if (e.burrowT > 0) {
      e.burrowT -= 1;
      if (e.burrowT === 0) { const o = e.orders[0]; if (o?.t === "burrow") { e.burrowed = true; this.next(e); } else if (o?.t === "unburrow") { e.burrowed = false; this.next(e); } }
      return;
    }
    if (e.xT > 0) {
      /* 시즈 전환 — 서서 애니메이션이 끝날 때까지 아무것도 안 한다(order_Sieging state 3 · order_Unsieging). */
      e.xT -= 1;
      if (e.xT === 0) { if (e.xTo) this.morph(e, e.xTo); e.xTo = null; this.next(e); }
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
      case "siege":
        /* order_Sieging — 서고 · 몸과 포탑이 제 방향을 보면 시즈 모드로 바뀌고(morph) · 애니메이션 끝까지 기다린다. */
        if (e.def.name !== "Siege Tank") { this.next(e); return; }
        e.goal = null; e.path = null; e.spd = 0; this.morph(e, "Siege Tank (Siege Mode)"); e.xT = SIEGE_FRAMES9; e.xTo = null; return;
      case "unsiege":
        /* order_Unsieging — 애니메이션이 끝나야 탱크 모드로 바뀐다. */
        if (e.def.name !== "Siege Tank (Siege Mode)") { this.next(e); return; }
        e.xT = SIEGE_FRAMES9; e.xTo = "Siege Tank"; return;
      case "storm": {
        /* order_Spell — 에너지가 모자라면 그만 · 288px(+정지 거리) 안까지 걸어가 서서 · spell_cooldown 이 0 이면 에너지 75 를 쓰고 쿨다운 45 + 흔들림. */
        if (e.en < fp(STORM_ENERGY9)) { this.next(e); return; }
        const reach = WEAPONS.Psionic_Storm.rangePx;
        if (xyLen9(o.x - e.x, o.y - e.y) > reach) { this.setGoal(e, o.x, o.y); return; }
        e.goal = null; e.path = null;
        e.face = Math.atan2(o.y - e.y, o.x - e.x);
        if (e.spellCd > 0) return;
        e.en -= fp(STORM_ENERGY9);
        e.spellCd = cooldownFrames(WEAPONS.Psionic_Storm) + (this.rand() & 3) - 1;
        this.storms.push({ x: o.x, y: o.y, owner: e.owner, life: STORM_LIFE9, from: e.id });
        this.next(e);
        return;
      }
      case "lurker": {
        /* 히드라 → 럴커 알(1/24) — 알 동안은 못 움직인다. */
        this.next(e); e.goal = null; e.path = null; e.spd = 0;
        e.morphMax = Math.max(1, Math.round(BUILD9("Lurker") / TIME_DIV9)); e.morphT = e.morphMax; e.morphTo = "Lurker";
        return;
      }
      case "archon": {
        /* 아콘 합체 — 짝도 나를 향해 오면 서로 걷다가 상자가 닿으면 하나(먼저 닿은 쪽 자리 · 소환 1/24). 짝이 딴 일을 하면 그만. */
        const t = this.byId.get(o.id);
        if (!t || t.dead || t.inside !== null || t.def.name !== "High Templar" || t.owner !== e.owner) { this.next(e); return; }
        const to = t.orders[0];
        if (!to || to.t !== "archon" || to.id !== e.id) { this.next(e); return; }
        if (this.dist(e, t) <= 2) {
          const x = (e.x + t.x) / 2; const y = (e.y + t.y) / 2;
          e.dead = true; t.dead = true; e.orders = []; t.orders = [];
          const a = this.spawn("Archon", e.owner, x, y);
          a.morphMax = Math.max(1, Math.round(BUILD9("Archon") / TIME_DIV9)); a.morphT = a.morphMax; a.morphTo = null;
          return;
        }
        this.setGoal(e, t.x, t.y, true);
        return;
      }
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
        if (!u || u.dead || u.inside !== null || u.owner !== e.owner || !u.def.slots || !u.mv || this.usedSlots(e) + u.def.slots > e.def.cargo) { this.next(e); return; }
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
        u.spellCd = UNLOAD_SPELL_CD9;
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
    return weaponRangePx(w, e.def.name, { inBunker, ups: (n) => this.has(e.owner, n) });
  }
  /** 가장 긴 무기 사거리(홀드가 보는 거리). */
  private maxRange(e: Ent9): number {
    if (e.def.reaver) return this.rangeOf(e, WEAPONS.Scarab);
    return Math.max(e.def.g ? this.rangeOf(e, e.def.g) : 0, e.def.a ? this.rangeOf(e, e.def.a) : 0);
  }
  private acqOf(e: Ent9, inBunker = false): number { return acquireTiles(e.def.name, { ups: (n) => this.has(e.owner, n), inBunker }) * 32; }
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
    for (const o of this.side[e.owner === 0 ? 1 : 0]) {
      if (o.dead || o.inside !== null || o.owner === e.owner || o.def.res) continue;
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
    if (e.mv && !e.def.bld && !TURRET9.has(e.def.name)) {
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
        if (o.dead || o.inside !== null || o.owner === e.owner || o.def.air || o.def.res) continue;
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
      if (o.dead || o.inside !== null || o === e || o.def.res) continue;
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
    /* 공방 — 그 편이 직접 올린 단계(맵 6판: 처음엔 0 · 적은 안 올린다). */
    const tg: DmgTarget = {
      hp: o.hp, shield: o.sh, hasShield: o.def.sh > 0, size: o.def.uc.size, armor: o.def.uc.armor,
      armorLv: this.lvOf(o.owner, o.def.uc.armorUp), chitinous: o.def.name === "Ultralisk" && this.has(o.owner, "Chitinous Plating"),
      plasmaLv: o.def.sh > 0 ? this.lvOf(o.owner, "Protoss Plasma Shields") : 0,
    };
    const wl = w.upgrade === "Scarab Damage" ? (this.has(e.owner, "Scarab Damage") ? 1 : 0) : this.lvOf(e.owner, w.upgrade);
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
  /** morph_unit — 종류를 바꾼다(체력 · 실드 비율은 그대로 · 이동 물리 다시). */
  private morph(e: Ent9, name: string): void {
    const def = UNIT_DEFS9[name]; if (!def) return;
    e.def = def;
    e.mv = def.speed > 0 ? moveDynOf(name, this.upList(e.owner)) : null;
    e.goal = null; e.path = null; e.spd = 0; e.target = null;
  }
  /** 스톰 — 남은 시간이 7 의 배수인 프레임마다 반지름 48 안(몸 상자까지)의 건물 아닌 모든 몸에 14(방어 무시 · 제 편 · 시전자 포함) ·
   *  한 번 맞은 몸은 다음 상태 틱(8프레임마다)까지 다른 스톰을 안 맞는다(storm_timer · 겹쳐도 안 쌓인다). */
  private stormTick(): void {
    const w = WEAPONS.Psionic_Storm;
    for (const st of this.storms) {
      const old = st.life; st.life -= 1;
      if (old === 0) continue;
      if (st.life % STORM_EVERY9 !== 0) continue;
      const shooter = this.byId.get(st.from) ?? ({ owner: st.owner, def: UNIT_DEFS9["High Templar"], inside: null, id: -1 } as unknown as Ent9);
      for (const o of this.ents) {
        if (o.dead || o.inside !== null || o.def.bld || o.def.res) continue;
        if (this.distTo(o, st.x, st.y) > STORM_R9) continue;
        if (o.stormT > 0) continue;
        o.stormT = 1;
        this.hitUnit(shooter, o, w, 1, 1);
      }
    }
    this.storms = this.storms.filter((st) => st.life >= 0);
  }
  /** 리버 — 스캐럽을 원작 시간(105프레임)마다 하나씩 채운다(빨무라 돈은 무한). */
  private scarabTick(e: Ent9): void {
    const max = this.has(e.owner, "Reaver Capacity") ? 10 : 5;
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
  /** i 째 일꾼이 캐는 자리 — 미네랄의 홀 쪽 변에 다섯씩 두 줄(홀에 붙은 미네랄이면 바깥 변). */
  private mineSpot(b: FoeBase9, i: number): [number, number] {
    const dir = b.far ? -1 : 1; const px = -b.uy; const py = b.ux;
    const ext = Math.abs(b.ux) * 32 + Math.abs(b.uy) * 16 + 10 + Math.floor(i / 5) * 14;
    const side = ((i % 5) - 2) * 15;
    return [b.mx + b.ux * ext * dir + px * side, b.my + b.uy * ext * dir + py * side];
  }
  /** 나르는 자리 — 홀의 미네랄 쪽 변(붙은 미네랄이면 홀 옆구리 양쪽). */
  private dropSpot(b: FoeBase9, h: Ent9, i: number): [number, number] {
    const px = -b.uy; const py = b.ux;
    const along = Math.abs(b.ux) * 58 + Math.abs(b.uy) * 41; const perp = Math.abs(px) * 58 + Math.abs(py) * 41;
    if (b.far) {
      const side = i % 2 === 0 ? -1 : 1;
      return [h.x + px * side * (perp + 12) - b.ux * along * 0.5, h.y + py * side * (perp + 12) - b.uy * along * 0.5];
    }
    const side = ((i % 5) - 2) * 15;
    return [h.x - b.ux * (along + 10) + px * side, h.y - b.uy * (along + 10) + py * side];
  }
  private workerTick(e: Ent9): void {
    const b = this.bases[e.base]; const hall = b ? this.byId.get(b.hall) : undefined;
    if (!b || !hall || hall.dead) { e.goal = null; return; }
    if (e.work === 0) {
      const [sx, sy] = this.mineSpot(b, e.slot);
      this.setGoal(e, sx, sy);
      if (e.arrived || Math.hypot(sx - e.x, sy - e.y) <= 6) { e.work = 1; e.workT = MINE_FRAMES9; e.goal = null; }
    } else if (e.work === 1) {
      e.face = Math.atan2(b.my - e.y, b.mx - e.x);
      if (--e.workT <= 0) e.work = 2;
    } else if (e.work === 2) {
      const [dx, dy] = this.dropSpot(b, hall, e.slot);
      this.setGoal(e, dx, dy);
      if (e.arrived || Math.hypot(dx - e.x, dy - e.y) <= 10) { e.work = 3; e.workT = 4; e.goal = null; }
    } else if (--e.workT <= 0) e.work = 0;
  }
}
