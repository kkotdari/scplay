/* 연습실 단축키 — 공통 칸 하나 + 유닛별 명령 카드(원작 3 × 3)(2026-11-18, 요청: "단축키는 같은 유닛이나 건물 안에서는 못 겹치고 공통인 것(이동 공격 패트롤 등)은
   공통으로 적용돼. 그런 거 제외하면 중복이 가능 · 이동 공격 홀드 정지 패트롤 등등은 종족 간 공유되니 이 칸 하나(3 × 3 원작 그리드) · 나머지는 유닛별로 ·
   건물용은 필요 없음 · 종족별 유닛별로 구분해서 그리드로 보여 주고 지정 · 지금 쓸 수 있는 유닛만").
   옛 판(ACTS9)은 명령 하나에 키 하나라 하차 U 와 버로우 U 처럼 **서로 다른 유닛**의 키도 못 겹쳤다(그래서 원작 버로우 U 를 B 로 비켜 두었다).
   ── 규칙 ──
   · 공통 다섯(이동 · 정지 · 공격 · 패트롤 · 홀드)은 모든 카드에 같은 키로 선다 — 어느 카드의 고유 명령도 공통 키를 못 쓴다.
   · 고유 명령은 그 카드 안에서만 안 겹치면 된다(셔틀 하차 U · 럴커 버로우 U 가 함께 선다).
   · 자리는 원작 명령 카드 그대로(0 ~ 8 · 줄 먼저): 이동 · 정지 · 공격 / 패트롤 · 홀드 · (빈칸) / 고유 셋.
   · 저장 이름은 영숫자 20 자 안(sg-api 연습 설정 검사 · 32 개 안) — 공통은 move … · 고유는 유닛 + 명령(shuttleUnload …). */
import type { PracRace9 } from "./practiceSim9";

export type Cmd9 = "move" | "stop" | "attack" | "patrol" | "hold" | "load" | "unload" | "storm" | "web" | "matrix" | "irradiate" | "siege" | "burrow";
/** 명령의 이름 · 풀이 · 곧바로 되나(자리를 안 기다림) · 카드 칸에 들어갈 짧은 이름(없으면 이름). */
export const CMD_INFO9: Record<Cmd9, { label: string; hint: string; instant?: boolean; short?: string }> = {
  move: { label: "이동", hint: "다음 클릭 자리로 이동(적을 무시)" },
  stop: { label: "정지", hint: "하던 일과 예약을 모두 멈춘다", instant: true },
  attack: { label: "공격", hint: "다음 클릭 — 적이면 그 적 · 땅이면 가며 싸우기" },
  patrol: { label: "패트롤", hint: "다음 클릭 자리와 지금 자리를 오가며 싸운다" },
  hold: { label: "홀드", hint: "그 자리에서 사거리 안만 쏜다", instant: true },
  /* 낙하산은 따로 키가 없다(2026-11-17 지적) — 하차 키 뒤 **자기 수송선을 찍으면** 낙하산. */
  load: { label: "태우기", hint: "다음 클릭한 내 유닛을 태운다(유닛을 함께 골랐으면 그 유닛이 찍은 수송선에 탄다)" },
  unload: { label: "하차", hint: "다음 클릭 자리로 가서 다 내린다 · 자기 수송선을 찍으면 낙하산(멈추지 않고 가던 길에 한 기씩)" },
  storm: { label: "스톰", hint: "다음 클릭 자리에 사이오닉 스톰(에너지 75)" },
  web: { label: "디스럽션 웹", short: "웹", hint: "다음 클릭 자리에 디스럽션 웹(그 아래 지상 몸 · 건물은 못 쏜다 · 에너지 125)" },
  matrix: { label: "디펜시브 매트릭스", short: "매트릭스", hint: "다음 클릭한 몸에 디펜시브 매트릭스(250 막이 · 에너지 100)" },
  irradiate: { label: "이레디에이트", short: "이레디", hint: "다음 클릭한 몸에 이레디에이트(둘레 생체 지상 몸에 250 · 에너지 75)" },
  siege: { label: "시즈 모드", short: "시즈", hint: "시즈 모드 · 다시 누르면 탱크 모드", instant: true },
  burrow: { label: "버로우", hint: "땅속으로(럴커는 땅속에서만 쏜다) · 다시 누르면 나온다", instant: true },
};

/** 카드 한 칸 — 저장 이름 · 명령 · 자리(0 ~ 8) · 기본 키(원작). */
export interface KeySlot9 { id: string; cmd: Cmd9; slot: number; def: string }
/** 공통 다섯 — 원작 자리(이동 0 · 정지 1 · 공격 2 · 패트롤 3 · 홀드 4) · 원작 키. */
export const COMMON_KEYS9: readonly KeySlot9[] = [
  { id: "move", cmd: "move", slot: 0, def: "M" },
  { id: "stop", cmd: "stop", slot: 1, def: "S" },
  { id: "attack", cmd: "attack", slot: 2, def: "A" },
  { id: "patrol", cmd: "patrol", slot: 3, def: "P" },
  { id: "hold", cmd: "hold", slot: 4, def: "H" },
];
/** ★ 수송선 공통 — 태우기 L · 하차 U(원작: 두 키가 따로 · 드랍십 · 셔틀 · 오버로드가 같은 키)(2026-11-18, 지적: "태우기 하차도 종족 공통일걸 · 태우기랑 하차가 따로였나?") —
 *  세 수송선 카드가 **같은 이름**(transLoad · transUnload)을 나눠 써서 한 번 바꾸면 셋이 함께 바뀐다. 모든 유닛 공통(위 다섯)으로는 안 올린다 — 럴커 버로우도 원작 U 라
 *  하차 U 와 함께 서야 한다(다른 카드). */
export const TRANS_KEYS9: readonly KeySlot9[] = [
  { id: "transLoad", cmd: "load", slot: 6, def: "L" },
  { id: "transUnload", cmd: "unload", slot: 7, def: "U" },
];
/** 한 유닛의 명령 카드 — 무기가 없으면(수송선 · 하템 · 베슬) 공격 칸이 빈다(원작). `trans` = 수송선 공통 칸(TRANS_KEYS9)을 쓴다. */
export interface UnitCard9 { unit: string; race: PracRace9; noAttack?: boolean; trans?: boolean; specs: readonly KeySlot9[] }
/* 지금 연습실이 준비하는 유닛만(초반 · 중반 준비 판) — 원작 카드의 그 자리 · 원작 키. 생산 · 변태 · 합체 · 스캐럽 만들기 · EMP · 환상은 연습실에 없어 뺐다. */
export const UNIT_CARDS9: readonly UnitCard9[] = [
  { unit: "Dropship", race: "T", noAttack: true, trans: true, specs: TRANS_KEYS9 },
  { unit: "Siege Tank", race: "T", specs: [{ id: "tankSiege", cmd: "siege", slot: 6, def: "O" }] },
  { unit: "Science Vessel", race: "T", noAttack: true, specs: [{ id: "vesselMatrix", cmd: "matrix", slot: 6, def: "D" }, { id: "vesselIrradiate", cmd: "irradiate", slot: 8, def: "I" }] },
  { unit: "Shuttle", race: "P", noAttack: true, trans: true, specs: TRANS_KEYS9 },
  { unit: "High Templar", race: "P", noAttack: true, specs: [{ id: "templarStorm", cmd: "storm", slot: 6, def: "T" }] },
  { unit: "Zealot", race: "P", specs: [] },
  { unit: "Reaver", race: "P", specs: [] },
  { unit: "Corsair", race: "P", specs: [{ id: "corsairWeb", cmd: "web", slot: 6, def: "D" }] },
  { unit: "Overlord", race: "Z", noAttack: true, trans: true, specs: TRANS_KEYS9 },
  { unit: "Hydralisk", race: "Z", specs: [] },
  /* 원작 버로우 · 해제 둘 다 U — 옛 판은 하차 U 와 겹쳐 B 로 비켰다(이제 카드가 달라 함께 선다). */
  { unit: "Lurker", race: "Z", specs: [{ id: "lurkerBurrow", cmd: "burrow", slot: 8, def: "U" }] },
  { unit: "Mutalisk", race: "Z", specs: [] },
];
const CARD_BY9 = new Map(UNIT_CARDS9.map((c) => [c.unit, c]));
/** 그 유닛의 카드 — 시즈 모드 탱크는 탱크 카드(시즈 · 해제가 같은 키). */
export const cardOf9 = (name: string): UnitCard9 | undefined => CARD_BY9.get(name === "Siege Tank (Siege Mode)" ? "Siege Tank" : name);

/** 이름 → 글자 하나(A ~ Z · 0 ~ 9). */
export type Keys9 = Record<string, string>;
const KEY_RE9 = /^[A-Z0-9]$/;
const ALL_SPECS9 = [...new Map(UNIT_CARDS9.flatMap((c) => c.specs).map((s) => [s.id, s])).values()];   // 이름 하나에 하나(수송선 공통은 세 카드가 나눠 쓴다)
export const defaultKeys9 = (): Keys9 => Object.fromEntries([...COMMON_KEYS9, ...ALL_SPECS9].map((s) => [s.id, s.def]));
/** 옛 판(명령 하나에 키 하나)의 이름 — 이것이 있으면 옛 기억이라 버리고 원작 기본값으로 선다(옛 판은 겹침을 피하느라 비켜 둔 키가 섞여 있다). */
const OLD_IDS9 = ["unload", "load", "burrow", "siege", "storm", "web", "irradiate"];
/** 기억(앱 계정 · 이 기기)을 다듬는다 — 모르는 이름 · 잘못된 글자는 버리고, 공통이 겹치면 공통을 기본값으로, 카드 안에서 겹치는 고유 키는 기본값(그것도 쓰였으면 빈 글자)으로. */
export function fixKeys9(raw: Record<string, unknown> | null | undefined): Keys9 {
  const out = defaultKeys9();
  if (!raw || OLD_IDS9.some((k) => k in raw)) return out;
  const ok = (v: unknown): v is string => typeof v === "string" && KEY_RE9.test(v);
  for (const c of COMMON_KEYS9) { const v = raw[c.id]; if (ok(v)) out[c.id] = v; }
  if (new Set(COMMON_KEYS9.map((c) => out[c.id])).size !== COMMON_KEYS9.length) for (const c of COMMON_KEYS9) out[c.id] = c.def;
  const common = new Set(COMMON_KEYS9.map((c) => out[c.id]));
  for (const card of UNIT_CARDS9) {
    const used = new Set(common);
    for (const s of card.specs) {
      const v = raw[s.id];
      let k = ok(v) ? v : s.def;
      if (used.has(k)) k = !used.has(s.def) ? s.def : [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].find((x) => !used.has(x)) ?? s.def;
      out[s.id] = k; used.add(k);
    }
  }
  return out;
}
const labelOf9 = (id: string): string => {
  const s = COMMON_KEYS9.find((c) => c.id === id) ?? ALL_SPECS9.find((c) => c.id === id);
  return s ? CMD_INFO9[s.cmd].label : id;
};
/** 키 하나를 바꾼다 — 공통은 다른 공통과 맞바꾸고(그 밖의 카드에서 그 키를 쓰던 고유 명령은 이 공통의 옛 키를 받는다) ·
 *  고유는 공통 키면 거절 · 같은 카드의 다른 고유와는 맞바꾼다. */
export function setKey9(m: Keys9, id: string, k: string): { keys: Keys9 } | { err: string } {
  if (!KEY_RE9.test(k)) return { err: "글자(A ~ Z) · 숫자만 돼요" };
  const old = m[id];
  if (old === k) return { keys: m };
  const n = { ...m };
  if (COMMON_KEYS9.some((c) => c.id === id)) {
    const other = COMMON_KEYS9.find((c) => c.id !== id && m[c.id] === k);
    if (other) n[other.id] = old;
    else for (const s of ALL_SPECS9) if (m[s.id] === k) n[s.id] = old;   // 공통의 옛 키는 어느 카드에도 비어 있다
    n[id] = k;
    return { keys: n };
  }
  const cards = UNIT_CARDS9.filter((c) => c.specs.some((s) => s.id === id));   // 수송선 공통은 세 카드가 나눠 쓴다
  if (!cards.length) return { err: "모르는 명령이에요" };
  const com = COMMON_KEYS9.find((c) => m[c.id] === k);
  if (com) return { err: `${k} 는 공통 명령(${labelOf9(com.id)})에 써요 — 공통 칸에서 먼저 바꾸세요` };
  for (const card of cards) { const other = card.specs.find((s) => s.id !== id && m[s.id] === k); if (other) n[other.id] = old; }
  n[id] = k;
  return { keys: n };
}
/** 카드 아홉 칸 — 공통(무기 없는 카드는 공격 빼고) + 고유. 빈칸은 null. */
export function cardSlots9(card: UnitCard9 | null | undefined): ((KeySlot9 & { common: boolean }) | null)[] {
  const out: ((KeySlot9 & { common: boolean }) | null)[] = Array.from({ length: 9 }, () => null);
  for (const c of COMMON_KEYS9) if (!(card?.noAttack && c.cmd === "attack")) out[c.slot] = { ...c, common: true };
  for (const s of card?.specs ?? []) out[s.slot] = { ...s, common: false };
  return out;
}
/** 고른 유닛들의 카드 — 고른 차례 · 같은 카드는 하나 · 고유 명령이 있는 카드가 앞(명령 카드에 보이는 '앞 카드'). */
export function selCards9(names: readonly string[]): UnitCard9[] {
  const seen = new Set<UnitCard9>(); const out: UnitCard9[] = [];
  for (const n of names) { const c = cardOf9(n); if (c && !seen.has(c)) { seen.add(c); out.push(c); } }
  return out.sort((a, b) => (a.specs.length ? 0 : 1) - (b.specs.length ? 0 : 1));
}
/** 누른 키의 명령 — 공통이 먼저(고른 것이 모두 무기 없는 카드면 공격은 없음) · 그다음 앞 카드부터 고유. */
export function resolveKey9(m: Keys9, k: string, cards: readonly UnitCard9[]): Cmd9 | null {
  for (const c of COMMON_KEYS9) {
    if (m[c.id] !== k) continue;
    if (c.cmd === "attack" && cards.length && cards.every((cd) => cd.noAttack)) return null;
    return c.cmd;
  }
  for (const cd of cards) { const s = cd.specs.find((x) => m[x.id] === k); if (s) return s.cmd; }
  return null;
}
