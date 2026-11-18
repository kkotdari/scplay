/* 연습실 효과 — 셈의 사건(PracFxEv9)을 재생기 붓(paintFxList9) · 효과음(SfxCues9)이 읽는 FxOp 로 짓는다
   (2026-11-18, 요청: "연습실에 트레이서랑 소리, 피격 사망효과 구현").
   ─────────────────────────────────────────────────────────────────────────────────────────────
   재생기 엔진(engine9)은 덤프 기록 · 쿨다운 박자로 효과를 '시각 t 의 함수'로 짓는다. 연습실 셈은 쏨 · 맞음 · 죽음을 그 프레임에 바로
   알므로, 사건마다 기록(Rec9)을 하나 세우고 그리는 순간의 나이로 같은 FxOp 를 낸다 — 갈래(attackFxOf9 · 방어 건물 표) · 크기(몸 상자 ·
   피격 한 값 HIT_REF 0.75 타일) · 창(번쩍 = 쿨다운 35% 를 0.08~0.32초로 · 탄 = 거리 ÷ 탄속 · 피격 0.14 · 실드 0.4 · 소총 0.25 ·
   죽음 0.5 · 피 웅덩이 2.3 · 건물 1.0)은 엔진의 그 자리 값을 그대로 옮겼다(engine9 의 줄 주석이 원본이다).
   · 자: 세계 px × 0.25 = 렌즈 px(타일 = 8 · 붓은 배율 4·z 를 곱한다) — 도록(RMP DocTracer9)과 같은 길이다. 자리(fx · fy)는 세계 px 그대로이고
     붓의 zx · zy 가 화면으로 옮긴다.
   · 셈은 피해를 쏘는 프레임에 바로 매기므로(탄이 나는 시간 없음 · 스캐럽만) **날아가는 탄의 피격은 탄이 닿을 때로 늦춰** 그린다.
   · 소리는 SfxCues9 가 이 op 들의 열쇠(seed = 맞은 몸 · 죽은 몸)로 새 사건을 가려 낸다 — 그림만 하는 op(포구 불꽃 · 연기)는 seed 를 안 준다. */
import {
  attackFxOf9, BIONIC_UNITS, BLD_FX_SEC, BLOOD_POOL_SEC, DIE_FX_SEC, MUZZLE_BURST_FX9, NO_BEAM_FX, PROJECTILE_FX, SHELL_ONLY_FX9,
  TARGET_FX, TGT_OWN_FX9, UNIT_3D, modelInkOf, shotSpeedOf9, unitMidK9, type FxOp,
} from "./engine9";
import { FRAME_SEC, LURKER_SPINE_SPEED_PX, LURKER_SPINE_TRAVEL_PX } from "../../utils/bwUnits";
import { UNIT_DEFS9, type PracFxEv9, type PracticeSim9 } from "./practiceSim9";
import { pracWorldPx9 } from "./practiceSpr9";

/** 세계 px → 렌즈 px(위 ★ 자). */
export const PRAC_LENS9 = 0.25;
const L9 = PRAC_LENS9;
/** 피격 효과 한 값(engine9 HIT_REF_TILES9 0.75 타일 × 렌즈 8 — 몸과 무관 · 2026-11-11). */
const HIT_W9 = 0.75 * 8;
/** 프로토스 살 · 기운 몸(죽으면 사이오닉 연기) — 밖은 기계 폭발(engine9 TOSS_FLESH9). */
const TOSS_FLESH9 = new Set(["Zealot", "High Templar", "Dark Templar", "Archon", "Dark Archon"]);
/** 방어 건물의 날아가는 탄(engine9 defNm9) — 성큰은 표적 발밑 가시(erupt). */
const DEF_FX9: Record<string, string> = { "Missile Turret": "missile", "Spore Colony": "venom", "Photon Cannon": "plasma" };
/** 럴커 가시 한 줄이 솟아 나가는 시간(engine9 spikeDur9 — 원작 212px ÷ 18.75px/프레임 × 1.3). */
const SPIKE_SEC9 = (LURKER_SPINE_TRAVEL_PX / LURKER_SPINE_SPEED_PX) * FRAME_SEC * 1.3;
/** 성큰 가시가 솟았다 꺼지는 창(engine9 sunkenPh 0.12 ~ 0.45 의 길이 · 초 어림). */
const ERUPT_SEC9 = 0.33;
/** 스캐럽 폭발 창(도록 DOC_SCARAB_HIT9 뒤 몫 어림). */
const BOOM_SEC9 = 0.4;

/** 그 몸 · 그 표적에 쓰는 트레이서 갈래 — 방어 건물 표가 먼저 · 성큰은 erupt · 나머지는 재생기와 같은 문(attackFxOf9). 근접은 없음. */
export const pracStyleOf9 = (name: string, tAir: boolean): string | undefined =>
  DEF_FX9[name] ?? (name === "Sunken Colony" ? "erupt" : attackFxOf9(name, tAir));
/** 번쩍(beam)이 서는 창 — 쿨다운의 35% 를 0.08 ~ 0.32초로 죈다(engine9 '제자리 번쩍' fxCd). */
const beamSec9 = (cdFrames: number): number => Math.max(0.08, Math.min(0.32, cdFrames * FRAME_SEC * 0.35));
/** 몸의 결 — 저그 체액 · 프로토스 에너지 · 테란 생체 피 · 기계 불티(engine9 tgtHitFx9). */
const matOf9 = (name: string): "bio" | "mech" | "toss" | "zerg" => {
  const r = UNIT_DEFS9[name]?.race;
  return r === "Z" ? "zerg" : r === "P" ? "toss" : BIONIC_UNITS.has(name) ? "bio" : "mech";
};

interface Rec9 {
  ev: PracFxEv9;
  /** 시작(경기 초) · 그 뒤 살아 있는 길이(초). */ t0: number; dur: number;
  style?: string;
  /** 탄이 나는 시간(초 · 날아가는 갈래만). */ fly?: number;
  /** 발사 때 겨눈 각(유도탄이 나가는 방향 · 처음 그릴 때 못 박는다). */ d0?: number;
  /** 두 끝의 마지막 자리(몸이 죽거나 타면 그 자리에 멈춘다). */ sx?: number; sy?: number; tx?: number; ty?: number;
}

export class PracFx9 {
  private recs: Rec9[] = [];
  private bn = 0;
  /** 공중 몸을 띄워 그리는 높이(세계 px) — 그리기와 같은 값이라야 탄이 몸에 닿는다(연습실 공중 높이 ★ 참고). */
  constructor(private airLiftPx: number) {}
  setAirLift(px: number): void { this.airLiftPx = px; }
  /** 셈의 새 사건을 받아 기록을 세운다(사건은 비운다). */
  take(sim: PracticeSim9): void {
    if (!sim.fxEv.length) return;
    for (const ev of sim.fxEv.splice(0)) this.add(sim, ev);
  }
  clear(): void { this.recs = []; }

  /** 몸 가운데 높이(렌즈 px) — 유닛 = 몸 상자 px × 잉크 가운데 몫(unitMidK9) + 뜬 높이 · 건물 = 발자국 높이의 0.4(어림). */
  private liftOf(name: string): number {
    const def = UNIT_DEFS9[name];
    if (!def) return 0;
    if (def.bld) return (def.foot?.[1] ?? 2) * 32 * 0.4 * L9;
    return (pracWorldPx9(name) * unitMidK9(UNIT_3D[name] ?? name, false) + (def.air ? this.airLiftPx : 0)) * L9;
  }
  /** 보이는 몸 폭(렌즈 px) — 유닛 = 몸 상자 px × 잉크 몫 · 건물 = 발자국 폭. */
  private static widthOf(name: string): number {
    const def = UNIT_DEFS9[name];
    if (def?.bld) return (def.foot?.[0] ?? 2) * 32 * L9;
    return pracWorldPx9(name) * ((modelInkOf(UNIT_3D[name] ?? name) || 16) / 16) * L9;
  }

  private add(sim: PracticeSim9, ev: PracFxEv9): void {
    const t0 = ev.f * FRAME_SEC;
    if (ev.k === "fire") {
      const style = pracStyleOf9(ev.an, ev.tAir);
      if (!style) return;   // 근접 — 줄기가 없다(맞는 쪽 피격만)
      let dur = beamSec9(ev.cd); let fly: number | undefined;
      if (style === "erupt") dur = ERUPT_SEC9;
      else if (SHELL_ONLY_FX9.has(style)) dur = 0.7;
      else if (MUZZLE_BURST_FX9.has(style)) dur = Math.min(0.16, Math.max(0.05, ev.cd * FRAME_SEC * 0.12)) + 0.5;
      else if (PROJECTILE_FX.has(style) && !NO_BEAM_FX.has(style)) { fly = Math.max(0.05, Math.hypot(ev.tx - ev.sx, ev.ty - ev.sy) / (shotSpeedOf9(style) * 32)); dur = fly; }
      this.recs.push({ ev, t0, dur, style, ...(fly !== undefined ? { fly } : {}), sx: ev.sx, sy: ev.sy, tx: ev.tx, ty: ev.ty });
      return;
    }
    if (ev.k === "hit") {
      const tg = sim.byId.get(ev.t);
      if (!tg) return;
      const style = ev.w === "Scarab" ? undefined : pracStyleOf9(ev.an, tg.def.air);
      if (ev.w === "Scarab") return;   // 스캐럽은 터지는 자리(boom) 한 장이 전부다
      if (style && TGT_OWN_FX9.has(style)) return;   // 표적 그림이 따로 있는 갈래(시즈 · 커세어 · 아콘 · 럴커 가시)
      if (style === "erupt") return;
      /* 날아가는 탄은 닿을 때 — 쏜 자리에서 표적까지 ÷ 탄속(위 ★). */
      const flyS = style && PROJECTILE_FX.has(style) && !NO_BEAM_FX.has(style) ? Math.hypot(tg.x - ev.ax, tg.y - ev.ay) / (shotSpeedOf9(style) * 32) : 0;
      const rifle = style === "gun" && (ev.an === "Marine" || ev.an === "Ghost");
      const shield = ev.sh && tg.def.sh > 0;
      this.recs.push({ ev, t0: t0 + flyS, dur: rifle ? 0.25 : shield ? 0.4 : 0.14, ...(style ? { style } : {}), sx: ev.ax, sy: ev.ay, tx: tg.x, ty: tg.y });
      return;
    }
    if (ev.k === "die") {
      const pool = !ev.bld && !ev.air && (matOf9(ev.n) === "zerg" || matOf9(ev.n) === "bio");
      this.recs.push({ ev, t0, dur: ev.bld ? BLD_FX_SEC : pool ? BLOOD_POOL_SEC : DIE_FX_SEC, tx: ev.x, ty: ev.y });
      return;
    }
    if (ev.k === "spike") { this.recs.push({ ev, t0, dur: SPIKE_SEC9, sx: ev.x, sy: ev.y }); return; }
    this.bn += 1;
    this.recs.push({ ev, t0, dur: BOOM_SEC9, tx: ev.x, ty: ev.y, d0: -this.bn });
  }

  /** 지금(경기 초)의 FxOp — sees(x, y) 가 거짓인 자리(안개)는 안 낸다. 다 산 기록은 걷는다. */
  ops(sim: PracticeSim9, now: number, sees: (x: number, y: number) => boolean): FxOp[] {
    const out: FxOp[] = []; const bursts: FxOp[] = [];
    this.recs = this.recs.filter((r) => now - r.t0 <= r.dur + 0.05);
    for (const r of this.recs) {
      const age = now - r.t0;
      if (age < 0) continue;   // 탄이 아직 날고 있는 피격
      const ev = r.ev;
      if (ev.k === "fire") this.fireOps(sim, r, ev, age, sees, out);
      else if (ev.k === "hit") this.hitOps(sim, r, ev, age, sees, out);
      else if (ev.k === "die") this.dieOps(r, ev, age, sees, bursts);
      else if (ev.k === "spike") {
        if (!sees(ev.x, ev.y)) continue;
        out.push({ kind: "spike", style: "spike", fx: ev.x, fy: ev.y, lift: 0, mx: 0, my: 0, deg: (Math.atan2(-Math.cos(ev.ang), Math.sin(ev.ang)) * 180) / Math.PI,
          ph: Math.min(1, age / SPIKE_SEC9), len: LURKER_SPINE_TRAVEL_PX * L9 });
      } else {
        if (!sees(ev.x, ev.y)) continue;
        const rv = pracWorldPx9("Reaver") * L9;
        out.push({ kind: "hit", style: "cannon", fx: ev.x, fy: ev.y, lift: 2, size: rv * 0.9, dist: 0, dx: 0, dy: 0, ph: Math.min(1, age / BOOM_SEC9), splash: true, seed: -100000 + (r.d0 ?? 0) });
      }
    }
    return [...out, ...bursts];
  }

  /** 쏘는 쪽 — 번쩍(beam) · 탄(shot) · 성큰 가시 · 전차포 불꽃 · 커세어 · 아콘 표적 그림. */
  private fireOps(sim: PracticeSim9, r: Rec9, ev: Extract<PracFxEv9, { k: "fire" }>, age: number, sees: (x: number, y: number) => boolean, out: FxOp[]): void {
    const a = sim.byId.get(ev.a); const tg = sim.byId.get(ev.t);
    /* 두 끝은 살아 있는 동안 몸을 따라간다(벙커 사수 · 튐은 쏜 자리 그대로). */
    if (a && !a.dead && a.inside === null && !ev.bounce) { r.sx = a.x; r.sy = a.y; }
    if (tg && !tg.dead && tg.inside === null) { r.tx = tg.x; r.ty = tg.y; }
    const sx = r.sx ?? ev.sx; const sy = r.sy ?? ev.sy; const tx = r.tx ?? ev.tx; const ty = r.ty ?? ev.ty;
    if (!sees(sx, sy) && !sees(tx, ty)) return;
    const style = r.style!;
    const shooter = a && a.inside !== null ? sim.byId.get(a.inside) : undefined;   // 벙커 사수
    const sName = shooter ? shooter.def.name : ev.an;
    const sL = ev.bounce && tg ? this.liftOf(ev.an) : this.liftOf(sName);
    const tL = tg ? this.liftOf(tg.def.name) : 0;
    const dx = (tx - sx) * L9; const dy = (ty - sy) * L9 - (tL - sL);
    const len = Math.hypot(dx, dy);
    const deg = (Math.atan2(-dx, dy) * 180) / Math.PI;
    const ux = len > 1e-3 ? dx / len : 0; const uy = len > 1e-3 ? dy / len : 0;
    const px = pracWorldPx9(sName) * L9;
    const tseed = tg ? tg.id : undefined;
    if (style === "erupt") {
      if (!sees(tx, ty)) return;
      const up = Math.sin(Math.min(1, age / ERUPT_SEC9) * Math.PI);
      if (up > 0.02) out.push({ kind: "erupt", fx: tx, fy: ty, lift: 0, mx: 0, my: 0, len: 9.6, u: up, size: 2.4 });
      return;
    }
    /* 전차포 — 포구는 몸 가운데에서 표적 쪽으로 몸 반 남짓(포신 어림) · 표적 그림은 표적 가슴(engine9 사격 자리의 ★★ 둘). */
    const mz = { fx: sx, fy: sy, lift: sL, dist: px * 0.45, dx: ux, dy: uy, splash: true as const };
    if (SHELL_ONLY_FX9.has(style)) {
      if (age < 0.7) out.push({ kind: "hit", style: "tanksmoke", ...mz, size: px * 0.5, ph: age / 0.7, deg });
      if (age < 0.14) out.push({ kind: "hit", style: "tankmz", ...mz, size: px * 0.3, ph: 0.12 + (age / 0.14) * 0.88, deg });
      if (age < 0.32) out.push({ kind: "hit", style: "tankhit", fx: tx, fy: ty, lift: tL, size: px * 0.5, dist: 0, dx: 0, dy: 0, ph: age / 0.32, splash: true });
      return;
    }
    if (MUZZLE_BURST_FX9.has(style)) {
      const sh = Math.min(0.16, Math.max(0.05, ev.cd * FRAME_SEC * 0.12));
      if (age < sh) out.push({ kind: "hit", style, ...mz, size: px * 0.38, ph: 0.12 + (age / sh) * 0.88, deg });
      else if (age - sh <= 0.5) out.push({ kind: "hit", style: "tankboom", fx: tx, fy: ty, lift: tL, size: px * 0.75, dist: 0, dx: 0, dy: 0, ph: (age - sh) / 0.5, splash: true, ...(tseed !== undefined ? { seed: tseed } : {}) });
      return;
    }
    if (NO_BEAM_FX.has(style)) {
      /* 커세어 — 선 없이 표적 둘레 방전(표적 그림이 전부다). */
      out.push({ kind: "hit", style, fx: tx, fy: ty, lift: tL, size: px, dist: 0, dx: 0, dy: 0, ph: Math.min(1, age / r.dur), splash: true, ...(tseed !== undefined ? { seed: tseed } : {}) });
      return;
    }
    if (r.fly !== undefined) {
      if (r.d0 === undefined) r.d0 = deg;
      out.push({ kind: "shot", style, fx: sx, fy: sy, lift: sL, mx: 0, my: 0, deg, len, u: Math.min(1, age / r.fly), d0: r.d0,
        tx, ty, tlift: tL, tgap: 0, by: sName });
      return;
    }
    const ph = Math.min(1, age / r.dur);
    out.push({ kind: "beam", style, fx: sx, fy: sy, lift: sL, mx: 0, my: 0, deg, len, ph, tx, ty, tlift: tL, tgap: 0 });
    if (TARGET_FX.has(style)) out.push({ kind: "hit", style, fx: tx, fy: ty, lift: tL, size: px, dist: 0, dx: 0, dy: 0, ph, splash: true, ...(tseed !== undefined ? { seed: tseed } : {}) });
  }

  /** 맞는 쪽 — 실드막 · 소총 불티 · 결 파편(engine9 tgtHitFx9 그대로). 자리는 표적 몸에서 쏜 쪽으로 조금. */
  private hitOps(sim: PracticeSim9, r: Rec9, ev: Extract<PracFxEv9, { k: "hit" }>, age: number, sees: (x: number, y: number) => boolean, out: FxOp[]): void {
    const tg = sim.byId.get(ev.t); if (!tg) return;
    if (!tg.dead && tg.inside === null) { r.tx = tg.x; r.ty = tg.y; }
    const tx = r.tx ?? tg.x; const ty = r.ty ?? tg.y;
    if (!sees(tx, ty)) return;
    const name = tg.def.name;
    const lift = this.liftOf(name); const w = PracFx9.widthOf(name);
    const vx = (r.sx ?? tx) - tx; const vy = (r.sy ?? ty) - ty; const vl = Math.hypot(vx, vy);
    const d = vl > 1 ? { dx: vx / vl, dy: vy / vl } : { dx: 0, dy: 0 };
    const style = r.style;
    const wp = style ? { style, by: ev.an } : { by: ev.an };
    const s = age;
    if (style === "gun" && (ev.an === "Marine" || ev.an === "Ghost")) {
      out.push({ kind: "hit", fx: tx, fy: ty, lift, size: HIT_W9 * 0.69, dist: vl > 1 ? w * 0.06 : 0, ...d, ph: s / 0.25, rifle: 1, ro: true,
        rs: Math.floor(r.t0 * 13) + ev.t, seed: ev.t, ...wp });
      return;
    }
    if (ev.sh && tg.def.sh > 0) {
      out.push({ kind: "shield", fx: tx, fy: ty, lift, size: w * (tg.def.bld ? 0.95 : 1.2), ph: s / 0.4, seed: ev.t, ...wp });
      return;
    }
    if (s >= 0.14) return;
    out.push({ kind: "hit", fx: tx, fy: ty, lift, size: HIT_W9 * 0.69, mat: matOf9(name), ...(vl > 1 ? { dist: w * 0.25, ...d } : { dist: 0 }), ph: s / 0.14, seed: ev.t, ...wp });
  }

  /** 죽음 · 무너짐 — 파편 폭발(burst) · 생체 지상은 피 웅덩이 · 유닛은 짧은 여운(dom die). */
  private dieOps(r: Rec9, ev: Extract<PracFxEv9, { k: "die" }>, age: number, sees: (x: number, y: number) => boolean, out: FxOp[]): void {
    if (!sees(ev.x, ev.y)) return;
    if (ev.bld) {
      const fw = UNIT_DEFS9[ev.n]?.foot?.[0] ?? 3;
      out.push({ kind: "burst", fx: ev.x, fy: ev.y, lift: this.liftOf(ev.n), bld: true, size: fw * 32 * L9, ph: Math.min(1, age / BLD_FX_SEC),
        mat: ev.race === "T" ? "mech" : ev.race === "P" ? "toss" : "zerg", seed: ev.id, tier: fw <= 2 ? 1 : fw === 3 ? 2 : 3 });
      return;
    }
    const mat = matOf9(ev.n);
    const w = PracFx9.widthOf(ev.n);
    const lift = this.liftOf(ev.n);
    const bt = w / 8;
    out.push({
      kind: "burst", fx: ev.x, fy: ev.y, lift, size: w, ph: Math.min(1, age / DIE_FX_SEC), mat, seed: ev.id, by: ev.n,
      ...(mat === "toss" && !TOSS_FLESH9.has(ev.n) ? { tmech: true } : {}),
      ...(r.dur > DIE_FX_SEC ? { pool: true, age } : {}),
      tier: bt < 0.9 ? 1 : bt < 1.8 ? 2 : 3,
    });
    if (age < DIE_FX_SEC) out.push({ kind: "dom", style: "die", fx: ev.x, fy: ev.y, lift, size: pracWorldPx9(ev.n) * L9 * 0.58, sub: mat, age, seed: ev.id });
  }
}
