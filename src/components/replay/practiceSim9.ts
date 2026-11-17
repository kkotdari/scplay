/* ★★ 수송선 드랍 연습실 — 시뮬레이션(2026-11-17, 요청: "연습실 기능 추가 · 1. 수송선 드랍 연습 · 2. 수송선 1~12대 · 3. 안에 태우는 유닛도 골라서 ·
   태우기 내리기는 직접 · 4. 목표는 적 뚝배기(빨무 · 적 위치 · 내 위치 지정) · 5. 상대 종족 선택 · 6. 상대는 적당히 방어선 구축 · 7. 낙하산 드랍 · 드랍 후
   shift 로 이동 예약 · 8. 드랍 키 지정").
   재생기는 녹화된 자취를 그리는 쪽이라 여기서는 **작은 실시간 셈**을 따로 돈다 — 원작 수치(units.dat · weapons.dat 어림)를 표로 두고 24틱/초(가장 빠름)로 민다.
   일부러 줄인 것: 시야·안개 없음 · 유닛끼리 밀어내기는 가벼운 떼어 놓기만 · 기술(스톰 · 버로우 · 스팀)은 없음 · 적은 붙박이 방어 건물과 일꾼뿐. */
import type { MapTerrain } from "../../utils/mapTerrain";
import { TILE } from "../../utils/mapTerrain";

export type PracRace9 = "T" | "P" | "Z";
export const PRAC_RACES9: { key: PracRace9; label: string; transport: string }[] = [
  { key: "T", label: "테란", transport: "Dropship" },
  { key: "P", label: "프로토스", transport: "Shuttle" },
  { key: "Z", label: "저그", transport: "Overlord" },
];

/** 무기 — dmg(한 발) · cd(틱) · r(사거리 px · 몸 가장자리 사이) · ty(0 일반 · 1 폭발 · 2 진동) · sp(튀는 반지름 px). */
export interface Weapon9 { dmg: number; cd: number; r: number; ty: 0 | 1 | 2; sp?: number }
export interface UnitDef9 {
  name: string; ko: string; race: PracRace9;
  hp: number; sh: number; armor: number;
  /** 몸 반지름(px) — 선택 고리 · 붙는 거리. */ rad: number;
  /** 크기 등급 0 소형 · 1 중형 · 2 대형(피해 배수). */ size: 0 | 1 | 2;
  /** 이동 속도(px/틱 · 0 이면 못 움직인다). */ speed: number;
  air?: boolean; bld?: boolean;
  /** 수송 칸(1 · 2 · 4) — 수송선에 못 타면 0. */ slots: number;
  g?: Weapon9; a?: Weapon9;
  /** 메딕 — 곁의 생체 아군을 고친다. */ heal?: boolean;
  /** 생체(메딕이 고친다). */ bio?: boolean;
  /** 건물 발자국(타일). */ foot?: [number, number];
  /** 수송선 — 화물 칸 8. */ cargo?: number;
}
const W9 = (dmg: number, cd: number, r: number, ty: 0 | 1 | 2 = 0, sp?: number): Weapon9 => ({ dmg, cd, r, ty, ...(sp ? { sp } : {}) });
/* 수치는 브루드워 원전 어림(빨무 기준 · 이동 업그레이드는 다 된 값). */
export const UNIT_DEFS9: Record<string, UnitDef9> = {
  Dropship: { name: "Dropship", ko: "드랍십", race: "T", hp: 150, sh: 0, armor: 1, rad: 24, size: 2, speed: 5.47, air: true, slots: 0, cargo: 8 },
  Shuttle: { name: "Shuttle", ko: "셔틀", race: "P", hp: 80, sh: 60, armor: 1, rad: 20, size: 2, speed: 6.67, air: true, slots: 0, cargo: 8 },
  Overlord: { name: "Overlord", ko: "오버로드", race: "Z", hp: 200, sh: 0, armor: 0, rad: 25, size: 2, speed: 2.5, air: true, slots: 0, cargo: 8 },
  Marine: { name: "Marine", ko: "마린", race: "T", hp: 40, sh: 0, armor: 0, rad: 8, size: 0, speed: 4, slots: 1, bio: true, g: W9(6, 15, 160), a: W9(6, 15, 160) },
  Firebat: { name: "Firebat", ko: "파이어뱃", race: "T", hp: 50, sh: 0, armor: 1, rad: 9, size: 0, speed: 4, slots: 1, bio: true, g: W9(16, 22, 32, 2, 20) },
  Medic: { name: "Medic", ko: "메딕", race: "T", hp: 60, sh: 0, armor: 1, rad: 8, size: 0, speed: 4, slots: 1, bio: true, heal: true },
  Ghost: { name: "Ghost", ko: "고스트", race: "T", hp: 45, sh: 0, armor: 0, rad: 8, size: 0, speed: 4, slots: 1, bio: true, g: W9(10, 22, 224, 2), a: W9(10, 22, 224, 2) },
  Vulture: { name: "Vulture", ko: "벌처", race: "T", hp: 80, sh: 0, armor: 0, rad: 16, size: 1, speed: 9.6, slots: 2, g: W9(20, 30, 160, 2) },
  "Siege Tank": { name: "Siege Tank", ko: "시즈 탱크", race: "T", hp: 150, sh: 0, armor: 1, rad: 16, size: 2, speed: 4, slots: 4, g: W9(30, 37, 224, 1) },
  Goliath: { name: "Goliath", ko: "골리앗", race: "T", hp: 125, sh: 0, armor: 1, rad: 16, size: 2, speed: 4.57, slots: 2, g: W9(12, 22, 192), a: W9(20, 22, 256, 1) },
  Zealot: { name: "Zealot", ko: "질럿", race: "P", hp: 100, sh: 60, armor: 1, rad: 11, size: 0, speed: 6, slots: 2, g: W9(16, 22, 15) },
  Dragoon: { name: "Dragoon", ko: "드라군", race: "P", hp: 100, sh: 80, armor: 1, rad: 15, size: 2, speed: 5, slots: 4, g: W9(20, 30, 192, 1), a: W9(20, 30, 192, 1) },
  "High Templar": { name: "High Templar", ko: "하이 템플러", race: "P", hp: 40, sh: 40, armor: 0, rad: 12, size: 0, speed: 3.2, slots: 2 },
  "Dark Templar": { name: "Dark Templar", ko: "다크 템플러", race: "P", hp: 80, sh: 40, armor: 1, rad: 12, size: 0, speed: 4.92, slots: 2, g: W9(40, 30, 15) },
  Reaver: { name: "Reaver", ko: "리버", race: "P", hp: 100, sh: 80, armor: 0, rad: 16, size: 2, speed: 1.78, slots: 4, g: W9(100, 60, 256, 0, 40) },
  Archon: { name: "Archon", ko: "아콘", race: "P", hp: 10, sh: 350, armor: 0, rad: 16, size: 2, speed: 4.92, slots: 4, g: W9(30, 20, 64, 0, 20), a: W9(30, 20, 64, 0, 20) },
  Zergling: { name: "Zergling", ko: "저글링", race: "Z", hp: 35, sh: 0, armor: 0, rad: 8, size: 0, speed: 8.4, slots: 1, bio: true, g: W9(5, 6, 15) },
  Hydralisk: { name: "Hydralisk", ko: "히드라리스크", race: "Z", hp: 80, sh: 0, armor: 0, rad: 10, size: 1, speed: 5.49, slots: 2, bio: true, g: W9(10, 15, 160, 1), a: W9(10, 15, 160, 1) },
  Lurker: { name: "Lurker", ko: "럴커", race: "Z", hp: 125, sh: 0, armor: 1, rad: 15, size: 1, speed: 5.82, slots: 4, bio: true, g: W9(20, 37, 192, 0, 20) },
  Ultralisk: { name: "Ultralisk", ko: "울트라리스크", race: "Z", hp: 400, sh: 0, armor: 3, rad: 19, size: 2, speed: 6.4, slots: 4, bio: true, g: W9(20, 15, 25) },
  Defiler: { name: "Defiler", ko: "디파일러", race: "Z", hp: 80, sh: 0, armor: 1, rad: 13, size: 1, speed: 4, slots: 2, bio: true },
  /* 적 일꾼 · 본진 · 방어 · 꾸밈 건물 */
  SCV: { name: "SCV", ko: "SCV", race: "T", hp: 60, sh: 0, armor: 0, rad: 11, size: 0, speed: 4.92, slots: 1, bio: true, g: W9(5, 15, 10) },
  Probe: { name: "Probe", ko: "프로브", race: "P", hp: 20, sh: 20, armor: 0, rad: 11, size: 0, speed: 4.92, slots: 1, g: W9(5, 22, 10) },
  Drone: { name: "Drone", ko: "드론", race: "Z", hp: 40, sh: 0, armor: 0, rad: 11, size: 0, speed: 4.92, slots: 1, bio: true, g: W9(5, 22, 10) },
  "Command Center": { name: "Command Center", ko: "커맨드 센터", race: "T", hp: 1500, sh: 0, armor: 1, rad: 58, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  Nexus: { name: "Nexus", ko: "넥서스", race: "P", hp: 750, sh: 750, armor: 1, rad: 56, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  Hatchery: { name: "Hatchery", ko: "해처리", race: "Z", hp: 1250, sh: 0, armor: 1, rad: 49, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  "Missile Turret": { name: "Missile Turret", ko: "미사일 터렛", race: "T", hp: 200, sh: 0, armor: 0, rad: 16, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 2], a: W9(20, 15, 224, 1) },
  Bunker: { name: "Bunker", ko: "벙커(마린 4)", race: "T", hp: 350, sh: 0, armor: 1, rad: 24, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2], g: W9(24, 15, 192), a: W9(24, 15, 192) },
  "Photon Cannon": { name: "Photon Cannon", ko: "포톤 캐논", race: "P", hp: 100, sh: 100, armor: 0, rad: 16, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 2], g: W9(20, 22, 224), a: W9(20, 22, 224) },
  "Spore Colony": { name: "Spore Colony", ko: "스포어 콜로니", race: "Z", hp: 400, sh: 0, armor: 0, rad: 16, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 2], a: W9(15, 15, 224) },
  "Sunken Colony": { name: "Sunken Colony", ko: "성큰 콜로니", race: "Z", hp: 300, sh: 0, armor: 2, rad: 16, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 2], g: W9(40, 32, 224, 1) },
  "Supply Depot": { name: "Supply Depot", ko: "서플라이 디팟", race: "T", hp: 500, sh: 0, armor: 1, rad: 30, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2] },
  Barracks: { name: "Barracks", ko: "배럭", race: "T", hp: 1000, sh: 0, armor: 1, rad: 50, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  Factory: { name: "Factory", ko: "팩토리", race: "T", hp: 1250, sh: 0, armor: 1, rad: 50, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  Pylon: { name: "Pylon", ko: "파일런", race: "P", hp: 200, sh: 200, armor: 0, rad: 16, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 2] },
  Gateway: { name: "Gateway", ko: "게이트웨이", race: "P", hp: 500, sh: 500, armor: 1, rad: 50, size: 2, speed: 0, bld: true, slots: 0, foot: [4, 3] },
  "Cybernetics Core": { name: "Cybernetics Core", ko: "사이버네틱스 코어", race: "P", hp: 500, sh: 500, armor: 1, rad: 40, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2] },
  "Spawning Pool": { name: "Spawning Pool", ko: "스포닝 풀", race: "Z", hp: 750, sh: 0, armor: 1, rad: 40, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2] },
  "Hydralisk Den": { name: "Hydralisk Den", ko: "히드라 덴", race: "Z", hp: 850, sh: 0, armor: 1, rad: 40, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2] },
  "Evolution Chamber": { name: "Evolution Chamber", ko: "에볼루션 챔버", race: "Z", hp: 750, sh: 0, armor: 1, rad: 40, size: 2, speed: 0, bld: true, slots: 0, foot: [3, 2] },
  "Mineral Field": { name: "Mineral Field", ko: "미네랄", race: "T", hp: 1, sh: 0, armor: 0, rad: 24, size: 2, speed: 0, bld: true, slots: 0, foot: [2, 1] },
};
/** 고를 수 있는 태울 유닛(종족마다). */
export const CARGO_UNITS9: Record<PracRace9, string[]> = {
  T: ["Marine", "Medic", "Firebat", "Ghost", "Vulture", "Goliath", "Siege Tank"],
  P: ["Zealot", "Dragoon", "High Templar", "Dark Templar", "Reaver", "Archon"],
  Z: ["Zergling", "Hydralisk", "Lurker", "Ultralisk", "Defiler"],
};
const WORKER9: Record<PracRace9, string> = { T: "SCV", P: "Probe", Z: "Drone" };
const HALL9: Record<PracRace9, string> = { T: "Command Center", P: "Nexus", Z: "Hatchery" };

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
}

export type Order9 =
  | { t: "move"; x: number; y: number }
  | { t: "amove"; x: number; y: number }
  | { t: "attack"; id: number }
  | { t: "load"; id: number }      // 유닛 → 수송선에 탄다
  | { t: "pickup"; id: number }    // 수송선 → 그 유닛을 태운다
  | { t: "unload"; x: number; y: number }   // 그 자리로 가서 다 내린다
  | { t: "hold" };

export interface Ent9 {
  id: number; def: UnitDef9; owner: 0 | 1;
  x: number; y: number; hp: number; sh: number;
  /** 몸이 보는 각(라디안 · 0 = 오른쪽 · 화면 아래가 +). */ face: number;
  orders: Order9[];
  /** 지상 길(남은 꺾는 점들). */ path: [number, number][] | null;
  /** 길을 낸 목표(같으면 다시 안 낸다). */ pathTo: [number, number] | null;
  cd: number; target: number | null;
  /** 수송선 화물(id) · 탄 수송선. */ cargo: number[]; inside: number | null;
  /** 낙하산(이동 중 하차) 중 — 틱마다 하나씩. */ para: boolean;
  /** 다음 하차까지 틱. */ unloadT: number;
  /** 일꾼 채취 — 0 캐러 감 · 1 캐는 중 · 2 돌아감 · 3 넘겨주는 중. */ work: number; workT: number;
  /** 일꾼 자리 번호(미네랄 둘레 몇째 칸). */ slot: number;
  dead: boolean; hitT: number;
}
export interface Shot9 { x1: number; y1: number; x2: number; y2: number; t: number; air: boolean; col: string }
export interface Boom9 { x: number; y: number; t: number; r: number }
export interface PracStats9 { workers: number; defense: number; buildings: number; lost: number; tick: number }

const TICK_HZ9 = 24;
export const PRAC_TICK_HZ9 = TICK_HZ9;
/** 하차 간격(틱) — 한 기씩. */
const UNLOAD_EVERY9 = 6;
/** 적 일꾼 수. */
const WORKERS9 = 50;
/** 일꾼이 한 번 캐는 데 드는 틱. */
const MINE_T9 = 70;

/** 지상 칸 — 16px(미니타일 둘 × 둘)이 다 걸을 수 있으면 걷는 칸. 256 × 256 = 65536 칸. */
const CELL9 = 16;

export class PracticeSim9 {
  readonly W: number; readonly H: number;
  ents: Ent9[] = [];
  byId = new Map<number, Ent9>();
  shots: Shot9[] = [];
  booms: Boom9[] = [];
  stats: PracStats9 = { workers: 0, defense: 0, buildings: 0, lost: 0, tick: 0 };
  private nextId = 1;
  private walk: Uint8Array; private cw: number; private ch: number;
  /** 건물이 막은 칸. */ private block: Uint8Array;
  readonly setup: PracSetup9;
  /** 적 미네랄 자리 · 홀 · 일꾼이 넘겨주는 자리. */
  private mineral: { x: number; y: number } = { x: 0, y: 0 };
  private hall: Ent9 | null = null;

  constructor(mt: MapTerrain, setup: PracSetup9) {
    this.setup = setup;
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

  /* ── 자리 잡기 ─────────────────────────────────────────────────────────── */
  private spawn(name: string, owner: 0 | 1, x: number, y: number): Ent9 {
    const def = UNIT_DEFS9[name];
    const e: Ent9 = {
      id: this.nextId++, def, owner, x, y, hp: def.hp, sh: def.sh, face: Math.PI / 2, orders: [], path: null, pathTo: null,
      cd: 0, target: null, cargo: [], inside: null, para: false, unloadT: 0, work: 0, workT: 0, slot: 0, dead: false, hitT: 0,
    };
    this.ents.push(e); this.byId.set(e.id, e);
    if (def.bld && def.foot) this.markBlock(e, 1);
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
  /** (px, py) 가까이 놓을 수 있는 자리를 바깥으로 넓혀 가며 찾는다. */
  private placeNear(name: string, owner: 0 | 1, px: number, py: number, maxR = 10): Ent9 | null {
    const [fw, fh] = UNIT_DEFS9[name].foot!;
    const tx0 = Math.round(px / 32 - fw / 2); const ty0 = Math.round(py / 32 - fh / 2);
    for (let r = 0; r <= maxR; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = tx0 + dx; const ty = ty0 + dy;
        if (this.canPlace(tx, ty, fw, fh)) return this.spawn(name, owner, (tx + fw / 2) * 32, (ty + fh / 2) * 32);
      }
    }
    return null;
  }
  /** 걷는 칸 가까이(유닛 내려놓기 · 처음 세우기). */
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

  private populate(): void {
    const s = this.setup;
    const mine = PRAC_SPOTS9.find((p) => p.key === s.mySpot) ?? PRAC_SPOTS9[0];
    const foe = PRAC_SPOTS9.find((p) => p.key === s.foeSpot) ?? PRAC_SPOTS9[2];
    /* 적 본진 — 홀 · 미네랄(빨무처럼 홀 아래 한 점 · 위아래로 나눈 새 판도 있으니 아래 한 점을 쓴다) · 일꾼 12. */
    const hall = this.spawn(HALL9[s.foeRace], 1, foe.x, foe.y);
    this.hall = hall;
    const my = foe.y + 64;   // 빨무는 모든 본진이 홀 바로 아래에 미네랄 한 점
    this.spawn("Mineral Field", 1, foe.x, my);
    this.mineral = { x: foe.x, y: my };
    /* 일꾼 50(2026-11-17, 요청: "타겟의 일꾼들도 50기 정도 미네랄 채굴중이게") — 미네랄 둘레 반원 고리에 나눠 서서 캐고 홀로 나른다. */
    const wk = WORKER9[s.foeRace];
    for (let i = 0; i < WORKERS9; i += 1) {
      const [sx, sy] = this.mineSpot(i);
      const p = this.nearestWalk(sx, sy) ?? [foe.x, my + 30];
      const w = this.spawn(wk, 1, p[0], p[1]); w.slot = i; w.work = i % 3 === 0 ? 2 : 1; w.workT = (i * 13) % MINE_T9;
    }
    /* 방어선 — 홀 둘레 고리(반지름 5 · 8 타일)에 고르게 · 지도 가운데 쪽(입구 쪽)에 더. */
    const cxm = this.W / 2; const cym = this.H / 2;
    const toward = Math.atan2(cym - foe.y, cxm - foe.x);
    const ring = (name: string, n: number, rT: number, spread: number, off = 0): void => {
      for (let i = 0; i < n; i += 1) {
        const ang = toward + off + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        this.placeNear(name, 1, foe.x + Math.cos(ang) * rT * 32, foe.y + Math.sin(ang) * rT * 32, 4);
      }
    };
    if (s.foeRace === "T") {
      ring("Missile Turret", 3, 3.5, Math.PI * 1.6, Math.PI);   // 일꾼 줄 · 홀 뒤
      ring("Missile Turret", 5, 8, Math.PI * 1.2);
      ring("Bunker", 2, 6, Math.PI * 0.6);
      ring("Supply Depot", 4, 11, Math.PI * 1.4);
      ring("Barracks", 1, 13, 0, 0.5); ring("Factory", 1, 13, 0, -0.5);
    } else if (s.foeRace === "P") {
      ring("Photon Cannon", 3, 3.5, Math.PI * 1.6, Math.PI);
      ring("Photon Cannon", 5, 8, Math.PI * 1.2);
      ring("Pylon", 4, 10.5, Math.PI * 1.4);
      ring("Gateway", 1, 13, 0, 0.5); ring("Cybernetics Core", 1, 13, 0, -0.5);
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
      e.face = dirIn;
    }
    let k = 0;
    for (const name of CARGO_UNITS9[s.myRace]) {
      const n = Math.max(0, Math.min(96, Math.round(s.cargo[name] ?? 0)));
      for (let i = 0; i < n; i += 1) {
        const ang = dirIn + Math.PI + (k % 12 - 5.5) * 0.18; const rr = 150 + Math.floor(k / 12) * 34;
        const p = this.nearestWalk(mine.x + Math.cos(ang) * rr, mine.y + Math.sin(ang) * rr, 12) ?? this.nearestWalk(mine.x, mine.y, 20);
        if (p) { const e = this.spawn(name, 0, p[0], p[1]); e.face = dirIn; }
        k += 1;
      }
    }
  }

  /* ── 묻기 ─────────────────────────────────────────────────────────────── */
  alive(): Ent9[] { return this.ents.filter((e) => !e.dead && e.inside === null); }
  usedSlots(t: Ent9): number { return t.cargo.reduce((s, id) => s + (this.byId.get(id)?.def.slots ?? 0), 0); }
  /** 그 자리의 개체(공중 먼저 · 몸 반지름 + 여유). */
  pick(x: number, y: number, pad = 6): Ent9 | null {
    let best: Ent9 | null = null; let bd = Infinity;
    for (const e of this.ents) {
      if (e.dead || e.inside !== null || e.def.name === "Mineral Field") continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.def.rad - pad - (e.def.air ? 8 : 0);
      if (d < 0 && (d < bd || (e.def.air && !best?.def.air))) { bd = d; best = e; }
    }
    return best;
  }

  /* ── 명령 ─────────────────────────────────────────────────────────────── */
  order(ids: number[], o: Order9, queue: boolean): void {
    for (const id of ids) {
      const e = this.byId.get(id); if (!e || e.dead || e.owner !== 0 || e.inside !== null) continue;
      if (e.def.speed <= 0) continue;
      if (o.t === "unload" && !e.def.cargo) continue;
      if (o.t === "pickup" && !e.def.cargo) continue;
      if (o.t === "load" && (e.def.cargo || !e.def.slots)) continue;
      if (!queue) { e.orders = []; e.path = null; e.pathTo = null; e.target = null; e.para = false; }
      e.orders.push(o);
    }
  }
  stop(ids: number[]): void {
    for (const id of ids) { const e = this.byId.get(id); if (e && e.owner === 0) { e.orders = []; e.path = null; e.target = null; e.para = false; } }
  }
  /** 낙하산 — 가던 길을 그대로 가며 한 기씩 떨군다(멈추지 않는다). */
  paradrop(ids: number[]): void {
    for (const id of ids) { const e = this.byId.get(id); if (e && e.owner === 0 && e.def.cargo && e.cargo.length > 0) { e.para = true; e.unloadT = 0; } }
  }
  /** 화물 한 기만 지금 자리에 내린다(화물 칸 누름 · 움직이는 중에도). */
  unloadOne(tid: number, uid: number): boolean {
    const t = this.byId.get(tid); if (!t || t.dead) return false;
    return this.dropUnit(t, uid);
  }

  /* ── 틱 ──────────────────────────────────────────────────────────────── */
  step(): void {
    this.stats.tick += 1;
    for (const e of this.ents) {
      if (e.dead || e.inside !== null) continue;
      if (e.cd > 0) e.cd -= 1;
      if (e.hitT > 0) e.hitT -= 1;
      if (e.def.bld) { this.fight(e, false); continue; }
      if (e.owner === 1 && /^(SCV|Probe|Drone)$/.test(e.def.name)) { this.workerTick(e); continue; }
      this.unitTick(e);
    }
    this.separate();
    for (const s of this.shots) s.t -= 1;
    this.shots = this.shots.filter((s) => s.t > 0);
    for (const b of this.booms) b.t -= 1;
    this.booms = this.booms.filter((b) => b.t > 0);
    if (this.stats.tick % 120 === 0) this.ents = this.ents.filter((e) => !e.dead || e.inside !== null);
  }

  private unitTick(e: Ent9): void {
    /* 낙하산 하차 — 가는 길과 상관없이 틱마다 셈. */
    if (e.def.cargo && e.para) {
      if (e.cargo.length === 0) e.para = false;
      else if (e.unloadT > 0) e.unloadT -= 1;
      else if (this.dropUnit(e, e.cargo[0])) e.unloadT = UNLOAD_EVERY9;
      else e.unloadT = 2;
    }
    if (e.def.heal) this.healTick(e);
    const o = e.orders[0];
    if (!o) { this.fight(e, true); return; }
    switch (o.t) {
      case "hold": this.fight(e, false); return;
      case "move": if (this.moveTo(e, o.x, o.y, 4)) this.next(e); return;
      case "amove":
        if (this.fight(e, true)) return;
        if (this.moveTo(e, o.x, o.y, 8)) this.next(e);
        return;
      case "attack": {
        const t = this.byId.get(o.id);
        if (!t || t.dead || t.inside !== null) { this.next(e); return; }
        e.target = t.id; this.engage(e, t, true); return;
      }
      case "load": {
        const t = this.byId.get(o.id);
        if (!t || t.dead || !t.def.cargo) { this.next(e); return; }
        if (this.usedSlots(t) + e.def.slots > t.def.cargo) { this.next(e); return; }
        if (Math.hypot(t.x - e.x, t.y - e.y) <= t.def.rad + e.def.rad + 10) { this.board(t, e); return; }
        this.moveTo(e, t.x, t.y, 0, true); return;
      }
      case "pickup": {
        const u = this.byId.get(o.id);
        if (!u || u.dead || u.inside !== null || u.owner !== 0 || !u.def.slots || this.usedSlots(e) + u.def.slots > (e.def.cargo ?? 0)) { this.next(e); return; }
        if (Math.hypot(u.x - e.x, u.y - e.y) <= e.def.rad + u.def.rad + 10) { this.board(e, u); this.next(e); return; }
        this.moveTo(e, u.x, u.y, 0, true); return;
      }
      case "unload": {
        if (e.cargo.length === 0) { this.next(e); return; }
        if (!this.moveTo(e, o.x, o.y, 6)) return;
        if (e.unloadT > 0) { e.unloadT -= 1; return; }
        if (this.dropUnit(e, e.cargo[0])) e.unloadT = UNLOAD_EVERY9;
        else { this.next(e); return; }   // 못 내리는 자리(벼랑 · 허공) — 다음 명령으로
        if (e.cargo.length === 0) this.next(e);
        return;
      }
    }
  }
  private next(e: Ent9): void { e.orders.shift(); e.path = null; e.pathTo = null; e.target = null; }

  private board(t: Ent9, u: Ent9): void {
    if (this.usedSlots(t) + u.def.slots > (t.def.cargo ?? 0)) return;
    t.cargo.push(u.id); u.inside = t.id; u.orders = []; u.path = null; u.target = null;
  }
  private dropUnit(t: Ent9, uid: number): boolean {
    const u = this.byId.get(uid); if (!u) return false;
    const p = this.nearestWalk(t.x, t.y, 3);
    if (!p) return false;
    t.cargo = t.cargo.filter((id) => id !== uid);
    u.inside = null; u.x = p[0]; u.y = p[1]; u.face = t.face; u.orders = []; u.cd = Math.max(u.cd, 4);
    return true;
  }

  /** 움직이기 — 닿았으면 true. follow 는 따라가는 목표(길을 자주 다시 낸다). */
  private moveTo(e: Ent9, x: number, y: number, near: number, follow = false): boolean {
    const d = Math.hypot(x - e.x, y - e.y);
    if (d <= Math.max(near, e.def.speed)) { if (near === 0 || d <= e.def.speed) { e.x = x; e.y = y; } return true; }
    let tx = x; let ty = y;
    if (!e.def.air) {
      const key: [number, number] = [Math.round(x / CELL9), Math.round(y / CELL9)];
      if (!e.path || !e.pathTo || e.pathTo[0] !== key[0] || e.pathTo[1] !== key[1] || (follow && this.stats.tick % 12 === e.id % 12)) {
        e.path = this.findPath(e.x, e.y, x, y); e.pathTo = key;
      }
      if (e.path && e.path.length > 0) {
        while (e.path.length > 1 && Math.hypot(e.path[0][0] - e.x, e.path[0][1] - e.y) < e.def.speed + 2) e.path.shift();
        [tx, ty] = e.path[0];
        /* 길 끝이 목표가 아니면(막힌 곳 · 건물 속) 길 끝에 닿은 것으로 닿았다고 친다 */
        if (e.path.length === 1 && Math.hypot(tx - e.x, ty - e.y) <= e.def.speed + 1 && Math.hypot(tx - x, ty - y) > 1) { e.x = tx; e.y = ty; return true; }
      } else if (e.path && e.path.length === 0) {
        return true;   // 못 가는 곳 — 갈 데까지 왔다
      }
    }
    const dd = Math.hypot(tx - e.x, ty - e.y);
    if (dd < 0.01) return false;
    e.face = Math.atan2(ty - e.y, tx - e.x);
    const sp = Math.min(e.def.speed, dd);
    e.x += ((tx - e.x) / dd) * sp; e.y += ((ty - e.y) / dd) * sp;
    e.x = Math.max(0, Math.min(this.W, e.x)); e.y = Math.max(0, Math.min(this.H, e.y));
    return false;
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

  /** 지상 유닛끼리 살짝 떼어 놓는다(한 칸에 겹쳐 서지 않게). */
  private separate(): void {
    const g = this.ents.filter((e) => !e.dead && e.inside === null && !e.def.air && !e.def.bld && e.def.speed > 0);
    for (let i = 0; i < g.length; i += 1) {
      const a = g[i];
      for (let j = i + 1; j < g.length; j += 1) {
        const b = g[j];
        const dx = b.x - a.x; const dy = b.y - a.y; const min = (a.def.rad + b.def.rad) * 0.8;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const push = (min - d) / 2 * 0.5; const ux = d > 0.01 ? dx / d : Math.cos(a.id); const uy = d > 0.01 ? dy / d : Math.sin(a.id);
        const ax = a.x - ux * push; const ay = a.y - uy * push; const bx = b.x + ux * push; const by = b.y + uy * push;
        if (this.free(Math.floor(ax / CELL9), Math.floor(ay / CELL9))) { a.x = ax; a.y = ay; }
        if (this.free(Math.floor(bx / CELL9), Math.floor(by / CELL9))) { b.x = bx; b.y = by; }
      }
    }
  }

  /* ── 싸움 ─────────────────────────────────────────────────────────────── */
  private weaponFor(e: Ent9, t: Ent9): Weapon9 | undefined { return t.def.air ? e.def.a : e.def.g; }
  private dist(a: Ent9, b: Ent9): number { return Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - a.def.rad - b.def.rad); }
  /** 사거리 안 · 곁(chase 면 시야 7타일)의 적을 찾아 싸운다 — 싸웠으면 true. */
  private fight(e: Ent9, chase: boolean): boolean {
    if (!e.def.g && !e.def.a) return false;
    let t = e.target !== null ? this.byId.get(e.target) : undefined;
    if (t && (t.dead || t.inside !== null || !this.weaponFor(e, t) || this.dist(e, t) > (this.weaponFor(e, t)!.r + (chase ? 224 : 0)))) t = undefined;
    if (!t) {
      let best: Ent9 | undefined; let bs = Infinity;
      for (const o of this.ents) {
        if (o.dead || o.inside !== null || o.owner === e.owner || o.def.name === "Mineral Field") continue;
        const w = this.weaponFor(e, o); if (!w) continue;
        const d = this.dist(e, o); const lim = w.r + (chase ? 224 : 0);
        if (d > lim) continue;
        /* 무기를 가진 것 · 수송선을 먼저(방어 건물이 수송선을 노리듯) */
        const score = d - (o.def.g || o.def.a ? 64 : 0) - (o.def.cargo ? 96 : 0);
        if (score < bs) { bs = score; best = o; }
      }
      t = best;
    }
    if (!t) { e.target = null; return false; }
    e.target = t.id;
    this.engage(e, t, chase);
    return true;
  }
  private engage(e: Ent9, t: Ent9, chase: boolean): void {
    const w = this.weaponFor(e, t);
    if (!w) { if (chase && e.def.speed > 0) this.moveTo(e, t.x, t.y, e.def.rad + t.def.rad); return; }
    const d = this.dist(e, t);
    if (d > w.r) { if (chase && e.def.speed > 0) this.moveTo(e, t.x, t.y, 0, true); return; }
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    if (e.cd > 0) return;
    e.cd = w.cd;
    this.hit(e, t, w);
    if (w.sp) for (const o of this.ents) {
      if (o === t || o.dead || o.inside !== null || o.owner === e.owner || !!o.def.air !== !!t.def.air) continue;
      if (Math.hypot(o.x - t.x, o.y - t.y) <= w.sp + o.def.rad) this.hit(e, o, { ...w, dmg: w.dmg * 0.5 }, true);
    }
  }
  private hit(e: Ent9, t: Ent9, w: Weapon9, quiet = false): void {
    let dmg = w.dmg;
    if (t.sh <= 0) {
      if (w.ty === 1) dmg *= t.def.size === 0 ? 0.5 : t.def.size === 1 ? 0.75 : 1;
      if (w.ty === 2) dmg *= t.def.size === 0 ? 1 : t.def.size === 1 ? 0.5 : 0.25;
    }
    if (t.sh > 0) { const s = Math.min(t.sh, dmg); t.sh -= s; dmg -= s; }
    if (dmg > 0) t.hp -= Math.max(0.5, dmg - t.def.armor);
    t.hitT = 6;
    if (!quiet) {
      const col = e.owner === 0 ? "#ffe08a" : t.def.air ? "#ff6a4a" : "#ffb26a";
      this.shots.push({ x1: e.x, y1: e.y - (e.def.air ? 12 : 4), x2: t.x, y2: t.y - (t.def.air ? 12 : 0), t: w.r > 40 ? 5 : 3, air: !!t.def.air, col });
    }
    if (t.hp <= 0) this.kill(t);
  }
  private kill(t: Ent9): void {
    if (t.dead) return;
    t.dead = true;
    this.booms.push({ x: t.x, y: t.y, t: t.def.bld ? 24 : 14, r: t.def.rad * (t.def.bld ? 1.4 : 1.6) });
    if (t.def.bld) this.markBlock(t, 0);
    if (t.owner === 1) {
      if (/^(SCV|Probe|Drone)$/.test(t.def.name)) this.stats.workers += 1;
      else if (t.def.g || t.def.a) this.stats.defense += 1;
      else if (t.def.bld) this.stats.buildings += 1;
    } else this.stats.lost += 1;
    /* 수송선이 터지면 화물도 함께 */
    for (const id of t.cargo) { const u = this.byId.get(id); if (u && !u.dead) { u.dead = true; u.inside = null; this.stats.lost += 1; } }
    t.cargo = [];
  }
  private healTick(e: Ent9): void {
    if (this.stats.tick % 6 !== e.id % 6) return;
    let best: Ent9 | null = null; let bd = 72;
    for (const o of this.ents) {
      if (o.dead || o.inside !== null || o.owner !== e.owner || o === e || !o.def.bio || o.hp >= o.def.hp) continue;
      const d = this.dist(e, o); if (d < bd) { bd = d; best = o; }
    }
    if (best) best.hp = Math.min(best.def.hp, best.hp + 2.5);
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
    return [h.x + side * (44 + k * 6), h.y + 56 + (k % 2) * 6];
  }
  private workerTick(e: Ent9): void {
    const hall = this.hall;
    if (!hall || hall.dead) { this.fight(e, false); return; }
    const m = this.mineral;
    if (e.work === 0) {
      const [sx, sy] = this.mineSpot(e.slot);
      if (this.moveTo(e, sx, sy, 6)) { e.work = 1; e.workT = MINE_T9; }
    } else if (e.work === 1) {
      e.face = Math.atan2(m.y - e.y, m.x - e.x);
      if (--e.workT <= 0) e.work = 2;
    } else if (e.work === 2) {
      const [dx, dy] = this.dropSpot(e.slot);
      if (this.moveTo(e, dx, dy, 10)) { e.work = 3; e.workT = 4; }
    } else if (--e.workT <= 0) e.work = 0;
  }
}

export const PRAC_TICK_MS9 = 1000 / TICK_HZ9;
