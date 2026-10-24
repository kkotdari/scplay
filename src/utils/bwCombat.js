/* 전투 자료 어댑터 — 표(bwUnits)와 그 표를 먹는 세 곳(simCore·replayUnits·렌더러)
 * 사이의 유일한 문.
 *
 * ■ 왜 한 겹을 더 두는가
 * 저장소에 같은 자료의 사본이 셋 있었고(bwUnits.UNIT_SPEED · replayUnits.SIM_SPEED ·
 * 렌더러의 UNIT_SPEED) 값이 서로 달랐다. 표를 고칠 때마다 세 곳을 따라 고쳐야 했고
 * 반드시 한 곳이 뒤처졌다. 표가 통째로 갈리는 지금 같은 실수를 되풀이하지 않으려면
 * 표를 읽는 자리가 한 곳이어야 한다.
 *
 * ■ 이 파일이 다시 쓰인 까닭 — 앞 판이 컴파일조차 안 됐다
 * 앞 판은 표에 없는 이름을 물었다. 검증(verdict-원전)이 잡아낸 목록 그대로 옮긴다:
 *     가정했던 이름            →  표의 진짜 이름
 *     UNITS[u].wg / .wa        →  UNITS[u].ground / .air   (WeaponKey | null)
 *     weaponRangeOf(…타일)     →  weaponRangePx(wp, kind, …)  ★ 픽셀이다
 *     seekRangeOf(…)           →  acquireTiles(kind, …)
 *     sightOf(…)               →  sightTiles(kind)
 *     dealDamage(원피해,종류,크기,방어력) → dealOneHit(wp, target, ctx)
 * 또 DmgType에 "ignoreArmor"·"independent"가, UnitSize에 "independent"가 늘었다.
 * 그래서 이 파일은 그 좁은 갈래를 스스로 다시 세지 않고 표의 타입을 그대로 물려받는다 —
 * 표가 갈래를 더 늘려도 여기서 타입 에러가 나지 않게 하려는 것이다.
 *
 * ■ 이 파일이 반드시 해내야 하는 한 가지 — 근접 유닛을 되살리는 것
 * 새 표의 무기 사거리는 진짜 타일이다. 질럿·저글링·다크템플러의 Psi_Blades/Claws는
 * 15px = 0.469타일이다. 그런데 simCore는 두 개체의 **중심 사이** 거리와 그 값을 곧장
 * 견준다. 밀어내기 평형은 두 몸 반지름의 합(질럿끼리 0.66타일)이라, 그대로 두면 질럿은
 * 서로 파고들기 전에는 영영 사거리 안에 못 든다 — 실측으로 6대6 질럿 사격이 12발에서
 * **0발**이 됐다(verdict-실행 ■1). 원작은 사거리를 두 스프라이트 상자의 **모서리 사이**
 * 로 재므로(bwgame.h unit_distance / units_intersecting_box 계열, UnitCombat.box가 그
 * 상자다) 중심 기준으로 옮기려면 양쪽 몸 반지름을 더해야 한다. 그 덧셈을 하는 자리는
 * 이 파일의 reachTiles() **하나뿐**이다 — verdict-충돌이 "몸 반지름을 두 곳에서 더하면
 * 이중 가산이 난다"고 지적한 자리라, bwUnits.reachTiles(업글을 못 받는 짧은 판)를 쓰지
 * 말고 여기 것을 써라.
 *
 * 리액트를 안 쓴다 — 웹 워커와 노드 CLI가 그대로 번들해 돌린다. */
import { BUNKER_SHOOTERS, CHITINOUS_PLATING, FIREBAT_HITS_ON_ONE_TARGET, FRAME_SEC, ORDER_PROCESS_FRAMES, PLASMA_SHIELD_UPGRADE, RETARGET_FRAMES, UNITS, WEAPONS, acquireTiles, attackOnce, bodyRadiusTiles, cooldownFrames, dealOneHit, ignoresDarkSwarm, isAir, missChanceRaw, missProbability, sightTiles, splashDivisor, targetOf, unitOf, upgradeMaxLevel, weaponRangePx, } from "./bwUnits";
/* 표에 이미 있고 여기서 다시 만들 이유가 없는 것은 그대로 흘려 보낸다.
   같은 숫자를 두 파일에 두면 반드시 한 쪽이 뒤처진다는 것이 이번 병합의 교훈이다. */
export { BUNKER_ACQUIRE_TILES, BUNKER_LOADABLE, BUNKER_RANGE_PX, BUNKER_SEATS, BUNKER_SHOOTERS, DETECTOR_KINDS, MEDIC_HEAL_PER_SEC, MEDIC_HEAL_RANGE_PX, splashHitsCaster, splashHitsOwnUnits, 
/* 주변 효과(과제 #54) — 표에는 진작 있었는데 문이 안 열려 있어 코어가 한 번도 못
   썼다. 쿨다운 보정(스팀·아드레날·인스네어·산성포자), 다크스웜을 무시하는 무기,
   상태 지속 시간, 매트릭스 흡수량이 전부 여기 있다. */
cooldownSec, ignoresDarkSwarm, MATRIX_HP, STATUS_TICKS, STIM_SELF_DAMAGE, STIM_UNITS, timerSec, 
/* 연구가 실제로 끝나는 시각(과제 #71) — 표는 진작 있었는데 부르는 곳이 없어,
   분석은 일률 70초를, 시뮬은 '명령한 순간'을 쓰고 있었다. */
upgradeSeconds, UPGRADE_TIME, 
/* 인구 — 우리가 지어낸 개체의 상한을 재는 데만 쓴다(replayUnits). */
SUPPLY_CAP, SUPPLY_COST, SUPPLY_GIVES, } from "./bwUnits";
/* ── 사이오닉 스톰(과제 #54) ────────────────────────────────────────────────────
   무기는 표에 진작 있었다(Psionic_Storm: 14 · ignoreArmor · 48px · radial). 코어가
   못 쓴 것은 문이 없어서였다. 스톰만 여기 문을 따로 내는 까닭은, 이것이 **표적이 아니라
   자리를 때리는** 유일한 상시 무기라 attackOf(공격자·표적) 꼴에 안 들어맞기 때문이다.

   합계 112를 8박자로 나눠 준다(14×8). 반경과 피해·방어력 무시는 표에서 오고, 박자 수와
   간격만 어림이다 — 원작은 프레임 단위로 쪼개지만 우리 틱(0.126초)에는 그만 한 해상도가
   없다. [추정]
   radial이라 아군도, splashHitsCaster라 시전자 본인도 맞는다 — 편을 가리지 않는다. */
export const STORM_PULSES = 8;
export const STORM_PULSE_SEC = 0.5;
export const STORM_TILES = WEAPONS.Psionic_Storm.splashPx[0] / 32;
/** 스톰 한 박자를 표적에게 먹인다 — 방어력·크기배수를 안 탄다(ignoreArmor). */
export function stormPulse(t) {
    return dealOneHit(WEAPONS.Psionic_Storm, t);
}
/* ════════════════════════════════════════════════════════════════════════════
   1. 원전의 시계 — 유닛이 '무엇을 할지' 다시 생각하는 눈금

   execute_main_order 안에는 switch가 둘이고 그 사이에 게이트가 있다. 타이머가 0일 때만
   두 번째 switch가 돌고, 돈 뒤에 8을 다시 채운다 — 그래서 주기가 9프레임이다.
   재표적(15프레임)만은 정말로 15인데, bwgame.h:12564가 main_order_timer=15와 **함께**
   order_process_timer=0을 놓아 위상을 다시 잡기 때문이다. 원작은 15를 원할 때 이렇게
   명시적으로 위상을 재설정한다 — 그러지 않는 자리(하차)는 18로 밀린다(bwTransport.ts).
   ════════════════════════════════════════════════════════════════════════════ */
/** 오더 처리 주기(프레임) — 9. */
export const ORDER_PERIOD_FRAMES = ORDER_PROCESS_FRAMES;
/** 오더 처리 주기(초) — 0.378초. 평소 표적 훑기가 이 눈금에 걸린다. */
export const ORDER_PERIOD_SEC = ORDER_PROCESS_FRAMES * FRAME_SEC;
/** 재표적 주기(프레임) — 15. 표적을 놓친 뒤 새로 잡기까지. */
export const RETARGET_PERIOD_FRAMES = RETARGET_FRAMES;
/** 재표적 주기(초) — 0.630초. */
export const RETARGET_SEC = RETARGET_FRAMES * FRAME_SEC;
/** 개체마다 다른 오더 처리 위상(초).
 *  원작에서 유닛들은 저마다 다른 프레임에 타이머가 돌아온다(태어난 프레임이 다르니까).
 *  전부 같은 눈금에 걸리면 부대 전체가 한 프레임에 우르르 표적을 잡아 '동시에 붙는' 티가
 *  난다. 태그로 9프레임을 갈라 그 티를 없앤다 — 태그는 리플레이 안에서 불변이라
 *  결정론이 깨지지 않는다. [추정] 원작의 실제 위상은 생성 프레임이지 태그가 아니다. */
export const acqPhaseOf = (tag) => (Math.abs(Math.trunc(tag)) % ORDER_PERIOD_FRAMES) * FRAME_SEC;
/** 시각 t(초)를 그 개체의 오더 격자로 올려 붙인다 — 명령이 언제 들어왔든 실제로 도는
 *  것은 다음 폴링이다. 1e-9는 격자 위에 정확히 놓인 값이 한 칸 더 밀리는 것을 막는 여유. */
export const toOrderGridSec = (t, phase = 0) => phase + Math.ceil((t - phase) / ORDER_PERIOD_SEC - 1e-9) * ORDER_PERIOD_SEC;
/** 그 업그레이드의 레벨(0~최대). 이름이 null이면 0. */
export function upgradeLevel(ups, name) {
    if (!ups || !name)
        return 0;
    const cap = upgradeMaxLevel(name);
    if (Array.isArray(ups)) {
        let n = 0;
        for (const u of ups)
            if (u === name)
                n += 1;
        return Math.min(cap, n);
    }
    if (ups instanceof Set)
        return ups.has(name) ? 1 : 0;
    const lv = ups[name];
    return typeof lv === "number" ? Math.min(cap, Math.max(0, Math.trunc(lv))) : 0;
}
/** 그 업그레이드가 하나라도 연구됐는가. */
export const hasUpgrade = (ups, name) => upgradeLevel(ups, name) > 0;
/** weaponRangePx/acquireTiles가 받는 판정자 모양으로 바꾼다. */
const upsProbe = (ups) => (ups ? (name) => hasUpgrade(ups, name) : undefined);
/** 캐시 열쇠 — 같은 상태가 늘 같은 글자를 내야 캐시가 산다. Set·Record는 순서가 없어
 *  정렬한다. 배열은 파서가 준 차례 그대로 쓴다(레벨 수가 곧 정보라 정렬하면 안 잃지만
 *  이어붙이기 비용만 늘어 그대로 둔다). */
const upsKeyOf = (ups) => {
    if (!ups)
        return "";
    if (Array.isArray(ups))
        return ups.join("|");
    if (ups instanceof Set)
        return [...ups].sort().join("|");
    return Object.entries(ups).map(([k, v]) => `${k}=${v}`).sort().join("|");
};
const mkProf = (key, kind, ups, inBunker) => {
    const wp = WEAPONS[key];
    const rangePx = weaponRangePx(wp, kind, { inBunker, ups: upsProbe(ups) });
    return {
        key, wp,
        dmg: wp.dmg, bonus: wp.bonus, type: wp.type, hits: wp.hits,
        cdFrames: wp.cdFrames, cd: wp.cd,
        rangePx, rangeTiles: rangePx / 32,
        minRangePx: wp.minRangePx, minRangeTiles: wp.minRange,
        splashKind: wp.splashKind, splashPx: wp.splashPx,
        splashTiles: wp.splash ?? 0,
        rollsMiss: wp.rangePx > 32 && wp.splashKind === "none" && wp.type !== "independent",
    };
};
const cache = new Map();
/** 그 정체의 전투 값 한 벌.
 *
 *  같은 (정체, 업글, 벙커) 조합은 한 번만 만들고 캐시한다. simCore는 수백 개체 × 수천
 *  틱을 돌므로 **개체를 세울 때 한 번만 부르고 결과를 개체가 들고 다녀야 한다** — 매 틱
 *  문자열 조회를 하면 그 자체가 병목이다. 업글이 없고 벙커가 아니면 열쇠가 정체 이름
 *  그대로라 문자열 이어붙이기조차 안 한다(렌더러가 프레임마다 부르는 경로). */
export function profileOf(kind, ups, inBunker) {
    const uk = upsKeyOf(ups);
    /* 구분자로 NUL을 쓴다 — 정체 이름에는 공백·괄호가, 업그레이드 이름에는 공백·붙임표가
       들어 있어 눈에 보이는 글자는 무엇을 써도 충돌할 여지가 있다. 소스에는 날 NUL을 두지
       않고 이스케이프로 적는다(날 NUL이 들어가면 grep이 파일을 이진으로 본다). */
    const key = uk === "" && !inBunker ? kind : `${kind}\u0000${uk}\u0000${inBunker ? 1 : 0}`;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const uc = unitOf(kind);
    const armorLv = upgradeLevel(ups, uc.armorUp);
    const chitinous = kind === "Ultralisk" && hasUpgrade(ups, CHITINOUS_PLATING);
    const ground = uc.ground ? mkProf(uc.ground, kind, ups, inBunker) : null;
    const air = uc.air ? mkProf(uc.air, kind, ups, inBunker) : null;
    /* 공업 레벨은 무기가 스스로 자기 업글 이름을 들고 있으니 그것을 센다. 지상·대공 무기가
       다른 업글을 타는 유닛은 원작에 없어 지상 것을 대표로 삼는다(골리앗은 둘 다 차량 공업). */
    const wLv = upgradeLevel(ups, ground?.wp.upgrade ?? air?.wp.upgrade ?? null);
    const p = {
        kind,
        size: uc.size,
        hp: uc.hp, shield: uc.shield, hasShield: uc.shield > 0,
        armor: uc.armor, armorLv, chitinous,
        armorTotal: uc.armor + armorLv + (chitinous ? 2 : 0),
        wLv,
        shLv: upgradeLevel(ups, PLASMA_SHIELD_UPGRADE),
        ground, air,
        acquire: acquireTiles(kind, { ups: upsProbe(ups), inBunker }),
        sight: sightTiles(kind),
        radius: bodyRadiusTiles(kind),
        /* AIR_UNIT_SET은 units.dat Flyer 비트에 고치(Cocoon)처럼 이름표만 있는 것을 더한
           집합이라 둘을 or로 묶는다. 뜬 테란 건물은 여기 없다 — 그건 상태라 simCore가 켠다. */
        flyer: uc.flyer || isAir(kind),
        building: uc.building,
        detector: uc.detector,
        organic: uc.organic,
        mech: uc.mech,
        worker: uc.worker,
        burrowable: uc.burrowable,
        inBunker: !!inBunker,
    };
    cache.set(key, p);
    return p;
}
/** 표에 아예 없는 이름인가 — 있으면 DEFAULT_UNIT으로 떨어진다는 뜻이라, 조용히 틀리기
 *  전에 부르는 쪽이 알아챌 수 있게 내놓는다. */
export const isKnownKind = (kind) => kind in UNITS;
/** 벙커 안에서 쏘는 유닛의 값 — 못 쏘는 것(메딕·SCV)은 null.
 *  벙커 **자신**은 무기가 없다: UNITS.Bunker의 ground/air가 둘 다 null이라 profileOf가
 *  이미 무장 없는 값을 낸다. 옛 판이 하던 "건물은 large·방어력 최소 1" 같은 손보정은
 *  지웠다 — 새 표에 건물의 진짜 크기·방어력이 들어 있어 지어낼 이유가 없다. */
export const bunkerShooterProfileOf = (kind) => (BUNKER_SHOOTERS.has(kind) ? profileOf(kind, undefined, true) : null);
/** 벙커에 누가 탔는지 모르는 자리(원장·렌더러)가 쓸 어림 — 벙커 보너스를 받은 마린 한 기.
 *  탑승 목록을 들고 있는 쪽(simCore)은 이것을 쓰지 말고 실제 탑승자로 세라. [추정] */
export const bunkerFallbackProfile = () => profileOf("Marine", undefined, true);
/* ════════════════════════════════════════════════════════════════════════════
   5. 사거리 — ★ 중심-중심 거리로 옮기는 곳. 이 파일의 핵심.
   ════════════════════════════════════════════════════════════════════════════ */
/** 그 표적 갈래에 쓸 무기 — 못 치는 갈래면 null. */
export const weaponVs = (p, targetAir) => (targetAir ? p.air : p.ground);
const asProfile = (u, ups) => (typeof u === "string" ? profileOf(u, ups) : u);
/** ★ 중심 사이 거리로 잴 때 실제로 닿는 사거리(타일). 못 치면 −1.
 *
 *  원작은 두 스프라이트 상자의 **모서리 사이** 거리를 재고(UnitCombat.box가 그 상자다)
 *  이 프로젝트의 시뮬·렌더러는 중심 사이를 잰다. 그 차이를 안 메우면 큰 유닛일수록
 *  사거리가 짧아지고, 무기 사거리가 0.469타일뿐인 질럿·저글링·다크템플러는 밀어내기
 *  평형(0.66타일)을 뚫고 파고들기 전에는 영영 사거리 안에 못 든다. 실측으로 6대6 질럿
 *  사격이 12발 → 0발이 됐던 자리다.
 *
 *  몸 반지름을 더하는 곳은 **여기 하나뿐**이어야 한다. simCore가 따로 Body.rad를 더하면
 *  이중 가산이 난다(verdict-충돌이 지적한 자리).
 *
 *  @param attacker  정체 이름 또는 이미 만든 값 한 벌
 *  @param target    정체 이름 또는 이미 만든 값 한 벌
 *  @param targetAir 표적이 공중인가. 안 주면 표적의 flyer로 짐작한다 — 뜬 테란 건물처럼
 *                   상태로 갈리는 것은 **반드시 넣어라.**
 *  @param ups       attacker가 이름일 때만 쓴다(값 한 벌은 이미 업글을 물고 있다). */
export function reachTiles(attacker, target, targetAir, ups) {
    const a = asProfile(attacker, ups);
    const t = asProfile(target);
    const w = weaponVs(a, targetAir ?? t.flyer);
    if (!w)
        return -1;
    return w.rangeTiles + a.radius + t.radius;
}
/** 최소 사거리(타일, 중심 기준) — 이 안쪽이면 못 쏜다. 없으면 0.
 *  시즈 모드 64px가 유일한 사례다. 최소 사거리도 원작은 모서리 기준이라 같은 덧셈을 한다. */
export function minReachTiles(attacker, target, targetAir, ups) {
    const a = asProfile(attacker, ups);
    const t = asProfile(target);
    const w = weaponVs(a, targetAir ?? t.flyer);
    if (!w || w.minRangePx <= 0)
        return 0;
    return w.minRangeTiles + a.radius + t.radius;
}
/** 지금 거리(타일, 중심 사이)에서 쏠 수 있는가 — 최대·최소를 한 번에 본다. */
export function canFireAt(attacker, target, distTiles, targetAir, ups) {
    const max = reachTiles(attacker, target, targetAir, ups);
    if (max < 0 || distTiles > max)
        return false;
    return distTiles >= minReachTiles(attacker, target, targetAir, ups);
}
/** 자동 표적 획득 거리(타일, 중심 기준). 0이면 스스로 표적을 안 잡는다.
 *  [추정] 획득 사거리에 몸 반지름을 더하는 것은 원작 find_acquire_target이 상자를 부풀려
 *  훑는 것을 중심 거리로 옮긴 어림이다. 무기 사거리와 달리 원전 문장으로 확인하지 못했다. */
export function acquireReachTiles(attacker, target, ups) {
    const a = asProfile(attacker, ups);
    if (a.acquire <= 0)
        return 0;
    return a.acquire + a.radius + asProfile(target).radius;
}
/* ── 이름만 아는 쪽(렌더러)을 위한 지름길. 업글은 안 본다 — 그리는 쪽은 그 차를 못 보인다. ── */
/** 순수 무기 사거리(타일, 모서리 기준). 못 치면 −1. 원을 그릴 때는 몸 반지름을 더해라. */
export const fireRangeTilesOf = (kind, targetAir = false) => weaponVs(profileOf(kind), targetAir)?.rangeTiles ?? -1;
/** 자동 획득 사거리(타일). */
export const acquireTilesOf = (kind) => profileOf(kind).acquire;
/** 시야(타일) — 디텍터의 탐지 거리이기도 하다. 일률 9로 뭉개면 캐논·터렛이 2타일 준다. */
export const sightTilesOf = (kind) => profileOf(kind).sight;
/** 몸 반지름(타일). */
export const bodyRadiusOf = (kind) => profileOf(kind).radius;
/* ════════════════════════════════════════════════════════════════════════════
   6. 피해 — 셈 자체는 표(dealOneHit)가 한다. 여기는 값 한 벌을 붙여 주는 일만.

   표의 dealOneHit은 bwgame.h weapon_deal_damage를 문장 순서대로 옮긴 것이고 표적을
   그 자리에서 깎는다. 이 파일은 그 위에 공업 레벨을 얹고, 파이어뱃처럼 '표에 적힌 히트
   수와 한 표적이 실제로 맞는 수'가 다른 예외만 갈라 준다.
   ════════════════════════════════════════════════════════════════════════════ */
/** 그 정체의 표적 한 벌(fp8 raw) — 방어 업글·갑피·실드 업글까지 담아 낸다.
 *  dealOneHit이 이 객체를 **그 자리에서 깎으므로** 개체마다 하나씩 들고 있어야 한다. */
export function targetFor(kind, ups, over = {}) {
    const p = profileOf(kind, ups);
    return targetOf(kind, {
        armorLv: p.armorLv, chitinous: p.chitinous, plasmaLv: p.shLv, ...over,
    });
}
/** 한 표적에 실제로 꽂히는 히트 수.
 *  파이어뱃만 예외다 — units.dat maxGroundHits는 3인데 세 발의 화염 오프셋이 서로 달라
 *  한 표적은 보통 두 발을 맞는다(게임 UI가 16으로 표기하는 이유). 공간 스플래시를 제대로
 *  도는 쪽이라면 w.hits(3)를 그대로 써라. [추정] 오프셋은 iscript.bin 자료라 못 읽었다. */
export const hitsOnOneTarget = (w) => (w.key === "Flame_Thrower" ? FIREBAT_HITS_ON_ONE_TARGET : w.hits);
/** 히트 1회 — 공격자의 공업 레벨을 얹어 표의 셈을 부른다. */
export function hitOnce(w, attacker, t, ctx = {}) {
    return dealOneHit(w.wp, t, { ...ctx, weaponLv: ctx.weaponLv ?? attacker.wLv });
}
/** 한 번의 공격(쿨다운 1회분) — 히트 수만큼 되풀이한다.
 *  ★ 히트마다 방어력·크기배수·하한이 따로 걸리므로 **절대 미리 합산하지 마라.**
 *  질럿 8×2는 방어력 1인 표적에 14이지 15가 아니다. */
export function attackOf(w, attacker, t, opts = {}) {
    return attackOnce(w.wp, t, {
        ...opts,
        weaponLv: opts.weaponLv ?? attacker.wLv,
        hits: opts.hits ?? hitsOnOneTarget(w),
    });
}
/** 초당 피해(사람이 읽는 수) — 원장이 화력을 초당으로 배분할 때 쓴다.
 *
 *  실드 몫과 체력 몫을 **따로** 잰다. 실드가 애매하게 남은 순간의 넘침(실드를 뚫고 남은
 *  피해가 방어력을 물고 체력으로 흐르는 것)은 이 두 숫자로 못 낸다 — 그 순간이 중요한
 *  쪽(simCore)은 dealOneHit을 직접 불러 표적 상태를 그 자리에서 깎아야 한다.
 *  쿨다운은 무보정 원값이다(스팀·아드레날은 attackPeriodFrames로 따로 재라). */
export function dpsOf(w, attacker, targetKind, targetUps) {
    const cdSec = w.cd > 0 ? w.cd : FRAME_SEC;
    const big = 1 << 30;
    const bare = targetFor(targetKind, targetUps, { hp: big, shield: 0, hasShield: false });
    const hp = attackOf(w, attacker, bare).hp / 256;
    const tp = profileOf(targetKind, targetUps);
    let shield = 0;
    if (tp.hasShield) {
        const shielded = targetFor(targetKind, targetUps, { hp: big, shield: big, hasShield: true });
        shield = attackOf(w, attacker, shielded).shield / 256;
    }
    return { hp: hp / cdSec, shield: shield / cdSec };
}
/* ── 쿨다운 ── */
/** 실제 쿨다운(프레임) — 스팀·아드레날(÷2, 중첩 없음)·엔슬레어(+25%)·산성포자.
 *  원작은 여기에 (rand&3)−1 지터가 더 붙어 −1~+2 프레임 흔들린다. 우리는 결정론이라
 *  지터를 안 넣는다. */
export const attackPeriodFrames = (w, s) => cooldownFrames(w.wp, s);
export const attackPeriodSec = (w, s) => cooldownFrames(w.wp, s) * FRAME_SEC;
/** 이 무기가 이 상황에서 빗나갈 확률(0~1).
 *  근접·스플래시·주문은 총알이 없어 굴림 자체가 없다(0). 다크 스웜은 뚫는 무기면
 *  없는 셈 치고 다시 잰다 — 언덕 119는 그대로 남는다.
 *  ⚠ simCore는 결정론이라 이 확률을 실제로 굴리려면 시드 있는 난수가 먼저 있어야 한다.
 *     지금은 '얼마나 빗나갈 값인가'를 재는 데까지만 쓴다. */
export function missChanceOf(w, env) {
    if (!w.rollsMiss)
        return 0;
    const e = env.targetUnderDarkSwarm && ignoresDarkSwarm(w.wp)
        ? { ...env, targetUnderDarkSwarm: false }
        : env;
    return missProbability(missChanceRaw(e));
}
/* ── 스플래시 ── */
/** 그 거리(픽셀)에서 쓸 divisor(1/2/4). 못 맞으면 null.
 *  ⚠ 버로우한 표적은 안쪽 링(splashPx[0])만 맞는다 — 바깥 두 링은 아예 안 닿는다.
 *  ⚠ 러커 가시는 감쇠가 없다(안쪽 링 안이면 전액). */
export const splashDivisorAt = (w, distPx, o) => splashDivisor(w.wp, distPx, o);
