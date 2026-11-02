import { hushSfx9, playSfx9, sfxOn9, type SfxPlay9 } from "./sfx9";
import type { SfxKind9 } from "./sfx9Synth";
import type { FxOp, UnitDrawOp } from "./engine9";

/* ★ 효과음 신호(2026-10-22, 요청: "재생기에 소리 효과") — 엔진은 '이 장에 막 일어난 일'을 따로 내지 않는다(시각 t 의 순수 함수 · 효과는 나이
   창으로 산다). 그래서 붓이 칠하는 장마다 **효과 op 의 열쇠를 앞 장과 견주어 새로 나타난 것**에 소리를 붙인다:
     · 죽음(burst · seed = 개체 태그 / 건물 줄) · 피격(hit·shield · seed = 맞은 몸 — 때린 무기 style 로 소리를 고른다)
     · 마법(dom storm·nuke·cast·swarm) · 건물 이륙·착륙(dom lift up/down) · 벙커 들고 남(dom bunk in/out) · 거미 지뢰(dom mine) · 럴커 땅 파기(dom dig) · 탑승/내림(tether sub in/out)
     · 발사체 쏨(shot · u 가 막 시작) · 소환(소환구 op 가 생김) · 버로우(pickState '땅속' 이 바뀜)
     · 이어지는 소리 — 용접(dom weld)·채집(유닛 op gath)·소환구 웅웅(warpin)·저그 공사 고치 심장(cocoon*)은 보이는 동안 간격을 두고 되풀이한다.
     · 소환구 끝(warpK 가 생김 — 물마루가 흐르며 건물이 드러남) → warpEnd.
   **보이는 것만** 낸다(화면 창 visRect9 안 · 지도가 다 보이면 다). 재생 중이 아니거나(멈춤·끌기) 시각이 크게 뛰면(되감기·탐색) 소리 없이 열쇠만
   새로 적는다 — 탐색한 자리의 효과가 한꺼번에 울리지 않게. 몇 개를 낼지는 sfx9 의 묶음이 거른다(동시 수·간격·급한 차례). */

type Rect9 = { x0: number; x1: number; y0: number; y1: number } | null;

/** 때린 무기(style) → 맞을 때 나는 소리. null 이면 맞을 때는 조용하다(쏠 때 난다 — LAUNCH9). 없는 style(근접)은 칼질. */
const HIT9: Record<string, SfxKind9 | null> = {
  gun: "gun", burst: "gun", frag: "cannon", cannon: "cannon", siege: "cannon", laserBC: "cannon",
  laser: "zap", flame: "flame", spine: "spine", spike: "spikeEarth",   // 럴커 가시 → 땅 뚫고 솟는 소리(2026-11-02) glave: "glaive", zap: "zap", flare: "zap",
  spark: "weld", weld: "zap", tankboom: "boom", heal: null,
  missile: null, missileG: null, plasma: null, photon: null, venom: null, acid: null, spit: null,
};
/** 근접(무기 갈래 없음)의 때린 몸 → 타격 소리(op.by · 2026-10-22). 없는 것은 칼질. */
const MELEE9: Record<string, SfxKind9> = {
  Zealot: "blade", "Dark Templar": "blade", Zergling: "claw", Ultralisk: "claw", Broodling: "claw",
};
/** ★ **휘두르는 박자마다** 내는 근접(2026-11-02, 요청: "저글링 둥둥둥 치는 소리 · 울트라 팍팍 치는 소리 · 공속업글(아드레날린)에 따라 속도 빨라져야") —
 *  맞은 몸의 체력 키는 띄엄띄엄이라 그 순간에만 내면 박자가 안 산다. 유닛 op 의 자세 박자(pz = [4, 시작, 쿨다운] · engine9 — 쿨다운에 아드레날린이 들었다)로
 *  몇 번째 휘두름인지 세어 바뀔 때마다 낸다(장 간격과 무관). 몸 종류(model kind) → 소리. */
const SWING9: Record<string, SfxKind9> = { Zergling: "zlingHit", Ultralisk: "ultraHit" };
const SWING_KIND9: Record<string, SfxKind9> = { zling: "zlingHit", ultra: "ultraHit" };
/** 소형 저그(죽음 울음이 조금 높다 · squealHi) — "지금 뮤탈을 저글링 같은 소형용으로 쓰고"(2026-11-02). */
const ZERG_SMALL9 = new Set(["Zergling", "Drone", "Broodling", "Scourge", "Infested Terran", "Larva"]);
/** 알 몸(model kind) — 변태 시작 소리(아래 ★ 알 변태 시작). */
const EGG_KINDS9 = new Set(["egg", "lurkeregg", "mutacocoon"]);
/** 미사일 쏜 몸 → 소리 갈래(아래 shot 의 ★). */
const MISSILE_LOW9 = new Set(["Scout", "Valkyrie", "Wraith"]);
const MISSILE_HI9 = new Set(["Goliath", "Missile Turret"]);
/** 캐는 일꾼 → 채집 소리. */
const GATH9: Record<"SCV" | "Probe" | "Drone", SfxKind9> = { SCV: "mineScv", Probe: "mineProbe", Drone: "mine" };
/** 발사체 → 쏠 때 나는 소리(shot op 이 막 나갈 때). */
const LAUNCH9: Record<string, SfxKind9> = {
  missile: "missile", missileG: "missile", plasma: "photon", photon: "photonC", venom: "guardHum",   // venom = 가디언 → 낮은 웅~(2026-11-02 · 옛 puff)   // photon = 포톤 캐넌 → 퉁(photonC · 2026-11-01) · plasma(드라군·스카우트·아비터)는 옛 뿅 acid: "puff", spit: "puff",
};
/** 마법(dom cast 의 sub) → 소리. */
const CAST9: Record<string, SfxKind9> = {
  emp: "zap", plague: "puff", ensnare: "puff", dweb: "puff", mael: "warp", recall: "warp", recallU: "warp", yamato: "cannon",
  scan: "scanHum",   // 스캔 — 신비한 울림(2026-11-02 · 옛: 소리 없음)
};

export class SfxCues9 {
  private prev = new Set<string>();
  private buried = new Map<string, boolean>();
  /** 맞은 몸마다 앞 장의 피격 위상 — 같은 몸이 잇달아 맞으면 열쇠가 그대로라 위상이 0 으로 돌아온 것으로 새 타를 가른다. */
  private hitPh = new Map<number, number>();
  /** 몸마다 마지막으로 소리 낸 휘두름 번호(위 SWING9 ★). */
  private swingN = new Map<string, number>();
  /** 건물 열쇠마다 앞 장에 공사 고치였나(위 ★ 저그 건물 완성). */
  private cocWas = new Map<string, [boolean, number]>();
  /** 유닛 열쇠마다 앞 장에 알이었나(위 ★ 알 변태 시작). */
  private eggWas = new Map<string, [boolean, number]>();
  private lastT = Number.NaN;

  /** 한 장을 본다. 소리를 내도 되는 때가 아니면 열쇠만 적는다(prime). */
  run(fr: { t: number; fxOps: readonly FxOp[]; unitOps: readonly UnitDrawOp[] },
    o: { playing: boolean; scrubbing: boolean; speed: number; rect: Rect9 }): void {
    if (!sfxOn9()) { this.prev.clear(); this.buried.clear(); this.lastT = Number.NaN; return; }
    const dt = fr.t - this.lastT;
    const jump = !Number.isFinite(dt) || dt < -0.05 || dt > 1.2 + o.speed * 0.25;
    const live = o.playing && !o.scrubbing && !jump;
    if (jump && Number.isFinite(this.lastT)) hushSfx9();
    if (Math.abs(dt) < 1e-6 && Number.isFinite(dt)) return;   // 같은 장을 또 칠함(손짓·크기 바뀜) — 볼 것이 없다
    this.lastT = fr.t;
    const r = o.rect;
    const m = r ? (r.x1 - r.x0) * 0.08 : 0;
    const inView = (x: number, y: number): boolean => !r || (x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m);
    const near = (x: number, y: number): number => {
      if (!r) return 1;
      const cx = (r.x0 + r.x1) / 2; const cy = (r.y0 + r.y1) / 2;
      const d = Math.hypot((x - cx) / (r.x1 - r.x0), (y - cy) / (r.y1 - r.y0));
      return Math.max(0, 1 - d * 1.2);
    };
    const now = new Set<string>();
    const hitPh = new Map<number, number>();
    const play = (k: SfxKind9 | null | undefined, x: number, y: number): void => {
      if (!live || !k) return;
      const opt: SfxPlay9 = { near: near(x, y), speed: o.speed };
      playSfx9(k, opt);
    };
    const fresh = (key: string): boolean => { now.add(key); return !this.prev.has(key); };
    let weld = false; let hum = false; let beat = false;
    let wx = 0; let wy = 0; let hx = 0; let hy = 0; let bx = 0; let by = 0;
    const mine = new Map<SfxKind9, [number, number]>();

    for (const op of fr.fxOps) {
      if (!inView(op.fx, op.fy)) continue;
      switch (op.kind) {
        case "burst": {
          if (!fresh(`b${op.bld ? 1 : 0}:${op.seed}`) || (op.ph ?? 0) > 0.6) break;
          const mat = op.mat;
          let k: SfxKind9;
          // 고치(알·번데기)의 터짐은 부화·변태의 끝이다 — 폭발이 아니라 퍽(2026-10-22 · 실측: 초반 알 깨짐마다 생체 폭발이 났다)
          // → 부드러운 전용 '뽁'(eggPop · 2026-10-26, 요청: "저그 부화소리 거슬려서 좀 부드럽게").
          if (op.bld) k = mat === "zerg" ? "bioBoom" : mat === "cocoon" ? "eggPop" : "boomBig";
          /* 몸마다(2026-11-02, 요청: "메딕은 여자라 좀 고음 죽는 소리 · 파뱃은 마린보다 낮은 죽는 소리 · 드라군 사망 시 기계(스프링 망가지는) 소리") — op.by = 죽은 몸(engine9).
             옛: 생체는 30% 여자 비명(무작위). */
          else if (mat === "bio") k = op.by === "Medic" ? "screamHi" : op.by === "Firebat" ? "screamLow" : "screamM";
          else if (mat === "zerg") k = op.by === "Lurker" ? "lurkerDie" : op.by === "Mutalisk" ? "squealMuta" : op.by && ZERG_SMALL9.has(op.by) ? "squealHi" : "squeal";   // 뮤탈 훨씬 높게 · 소형 조금 높게(2026-11-02)   // 럴커 — 낮은 비명 + 폭발(2026-11-02)
          else if (mat === "cocoon") { if (op.sub === "done") break; k = "eggHatch"; }   // 알·고치 깨짐 — 낮은 생체(2026-11-02 · 옛 eggPop) · 건물 완공 부화(sub done)는 zergDone 이 낸다
          else if (mat === "toss") k = op.by === "Dragoon" ? "springBreak" : op.by === "Reaver" ? "reaverBreak" : op.by === "Observer" ? "obsBoom" : op.tmech ? "boom" : "zap";   // 리버 — 드라군보다 울림 있게(2026-11-02)
          else k = op.by === "Science Vessel" ? "vesselBoom" : "boom";   // 베슬 — 둥둥둥 세 번(2026-11-02)
          play(k, op.fx, op.fy);
          break;
        }
        case "hit": case "shield": {
          if (op.seed === undefined) break;
          const ph = op.ph ?? 0;
          const was = this.hitPh.get(op.seed);
          hitPh.set(op.seed, ph);
          /* 새로 맞음 = 새 열쇠, 또는 같은 몸의 위상이 처음으로 돌아옴(여럿이 한 몸을 잇달아 칠 때 · 옛 판은 첫 타만 울렸다). */
          if (!fresh(`h${op.seed}`) && !(was !== undefined && ph < was - 0.05)) break;
          const s = op.style;
          if (s === undefined && op.by && SWING9[op.by]) break;   // 저글링·울트라는 휘두르는 박자로 낸다(아래 SWING9 ★) — 맞은 순간에 또 내면 겹친다
          play(s === undefined ? (op.by ? MELEE9[op.by] : undefined) ?? "slash" : HIT9[s] === undefined ? "gun" : HIT9[s], op.fx, op.fy);
          break;
        }
        case "shot": {
          /* 미사일은 쏜 몸으로 가른다(2026-11-02, 요청: "스카웃·발키리·레이스 대공 낮은 연기 추진 · 터렛·골리앗 대공 살짝 높고 가는 추진 + 연기") — op.by(engine9). 모르면 옛 missile. */
          const msl9 = op.style === "missile" || op.style === "missileG"
            ? (op.by && MISSILE_LOW9.has(op.by) ? "missileLow" : op.by && MISSILE_HI9.has(op.by) ? "missileHi" : undefined) : undefined;
          const k = msl9 ?? (op.style ? LAUNCH9[op.style] : undefined);
          if (k && (op.u ?? 1) < 0.15) play(k, op.fx, op.fy);
          break;
        }
        case "erupt": {
          /* 성큰 가시(2026-11-02, 요청: "성큰 럴커 가시가 땅을 뚫고 솟는 소리") — 가시 op 는 솟는 동안만 선다 · 자리 열쇠가 새로 나면 한 번. */
          if (fresh(`r${Math.round(op.fx * 4096)}:${Math.round(op.fy * 4096)}`)) play("spikeEarth", op.fx, op.fy);
          break;
        }
        case "tether":
          if (fresh(`t${op.stag}${op.sub}`)) {
            const ov9 = op.by === "Overlord";   // 오버로드 — 생체조직 소리(2026-11-02 · op.by = 태운 배)
            play(op.sub === "out" ? (ov9 ? "bioUnload" : "unload") : (ov9 ? "bioLoad" : "load"), op.fx, op.fy);
          }
          break;
        case "dom": {
          const st = op.style;
          if (st === "weld") { weld = true; wx = op.fx; wy = op.fy; break; }
          const key = `d${st}:${op.sub ?? ""}:${op.seed ?? ""}`;
          if (!fresh(key)) break;
          if (st === "storm") play("thunder", op.fx, op.fy);
          else if (st === "nuke") play("boomBig", op.fx, op.fy);
          else if (st === "swarm") play("puff", op.fx, op.fy);
          else if (st === "cast") play(CAST9[op.sub ?? ""], op.fx, op.fy);
          else if (st === "lift") play(op.sub === "up" ? "liftOff" : "landing", op.fx, op.fy);   // 건물 이륙·착륙(엔진의 소리 신호 · 2026-10-22)
          else if (st === "bunk") play(op.sub === "out" ? "unload" : "load", op.fx, op.fy);   // 벙커 들고 남 = 수송선과 같은 소리(2026-10-22)
          else if (st === "mine") play("boom", op.fx, op.fy);
          else if (st === "dig") play("burrow", op.fx, op.fy);
          break;
        }
        default:
      }
    }

    for (const u of fr.unitOps) {
      /* 신비한 소리는 **소환구가 나타날 때**(2026-10-22, 요청: "신비로운 소리 소환구에서 나야") — 옛 판은 완공 물마루(warpK)에 냈다. 열쇠는 보이든 말든
         적는다 — 짓는 동안 내내 서 있는 구라, 화면을 옮겨 들어올 때마다 울리면 안 된다. */
      const orb = u.kind === "warpin" && u.pickKey ? fresh(`w${u.pickKey}`) : false;
      /* 끝 소리는 물마루가 흐르기 시작할 때(warpK 가 생김 · 건물이 드러남) — 처음(warp)·가운데(웅웅)와 갈린다(같은 날 "처음·끝 소리와 중간 웅웅 구분"). */
      const done = u.warpK !== undefined && u.pickKey ? fresh(`e${u.pickKey}`) : false;
      /* ★ 저그 **공사 고치 착공**(2026-11-02, 요청: "공사 고치 펼 때 생체조직 펼치는 소리" → "공사고치 착공소리 맞지?") — 드론이 고치로 펼쳐지는 순간 = 공사 고치 op(cocoon*)가
         처음 서는 장. 열쇠는 보이든 말든 적는다(소환구와 같은 까닭 — 짓는 내내 서 있으니 화면을 옮겨 들어올 때 다시 울리면 안 된다). */
      const unfold = u.kind.startsWith("cocoon") && u.pickKey ? fresh(`c${u.pickKey}`) : false;
      /* ★ 저그 **건물 완성**(2026-11-02, 요청: "완성 시도 알보다 낮고 크고 복잡한 소리로 별도") — 공사 중과 완성 건물은 같은 pickKey(b임자|종류|자리)라, 앞 장에
         고치(cocoon*)였던 열쇠가 고치가 아닌 몸으로 선 장에 낸다(레어·하이브 변태 끝도 같다). 상태는 보이든 말든 적는다. */
      /* ★ 알 변태 시작(2026-11-02, 요청: "알 변태 시작과 깨짐도 낮고 생체 소리로") — 같은 몸(pickKey u태그)이 알 아닌 몸에서 알(egg·lurkeregg·mutacocoon)로 바뀐 장.
         앞 기록이 막 전 장일 때만(화면 밖에서 바뀐 것은 안 울린다 · 아래 완성과 같은 문). */
      let eggGo = false;
      if (u.pickKey && u.pickKey.charCodeAt(0) === 117) {   // 'u' — 유닛
        const isE9 = EGG_KINDS9.has(u.kind);
        const we9 = this.eggWas.get(u.pickKey);
        if (we9 && !we9[0] && isE9 && fr.t - we9[1] <= 2 + o.speed * 0.5) eggGo = true;
        this.eggWas.set(u.pickKey, [isE9, fr.t]);
      }
      /* ★ 테란 건물 착공(애드온 포함 · 2026-11-02, 요청: "테란 건물 착공 시 낮은 쇠울림 소리 · 텅") — 공사 중 테란 건물 op 의 pickState 는 "건설 중 N%"(engine9 ·
         프로토스는 같은 글이지만 몸이 warpin 이라 가른다). 열쇠가 **처음 보인 장의 진행률이 5% 이하**일 때만 착공으로 친다 — 화면을 옮겨 이미 짓던 것을 만나면 안 울린다. */
      let clang = false;
      if (u.pickKey && u.pickKey.charCodeAt(0) === 98 && u.kind !== "warpin" && u.pickState && u.pickState.startsWith("건설 중 ")) {
        if (fresh(`n${u.pickKey}`)) { const pc9 = parseFloat(u.pickState.slice(5)); if (Number.isFinite(pc9) && pc9 <= 5) clang = true; }
      }
      let ripe = false;
      if (u.pickKey && u.pickKey.charCodeAt(0) === 98) {   // 'b' — 건물
        const isC9 = u.kind.startsWith("cocoon");
        const w9 = this.cocWas.get(u.pickKey);
        // 앞 기록이 막 전 장(경기 2초 + 배속 몫 안)일 때만 — 화면 밖(워커가 안 보낸 몸)에서 다 지어진 것을 화면에 들어올 때 울리지 않게.
        if (w9 && w9[0] && !isC9 && fr.t - w9[1] <= 2 + o.speed * 0.5) ripe = true;
        this.cocWas.set(u.pickKey, [isC9, fr.t]);
      }
      if (!inView(u.fx, u.fy)) continue;
      /* 채집은 일꾼 종류마다 따로(드론 mine · SCV mineScv · 프로브 mineProbe — 2026-10-22, 요청: "프로브랑 SCV 는 소리가 달라야"). */
      if (u.gath) mine.set(GATH9[u.gath], [u.fx, u.fy]);
      const swK9 = SWING_KIND9[u.kind];
      if (swK9 && u.pickKey && u.pz && u.pz[0] === 4 && u.pz[2] > 0) {
        const n9 = Math.floor((fr.t - u.pz[1]) / u.pz[2]);
        const was9 = this.swingN.get(u.pickKey);
        if (was9 === undefined || n9 !== was9) { this.swingN.set(u.pickKey, n9); if (was9 !== undefined && n9 > was9) play(swK9, u.fx, u.fy); }
      }
      if (orb) play("warpCharge", u.fx, u.fy);   // 소환구 착공 — 에너지가 모이는 낮은 소리(2026-11-02 · 옛: 마법 공용 warp)
      else if (u.kind === "warpin") { hum = true; hx = u.fx; hy = u.fy; }
      if (done) play("warpEnd", u.fx, u.fy);
      if (unfold) play("fleshUnfold", u.fx, u.fy);
      if (ripe) play("zergDone", u.fx, u.fy);
      if (eggGo) play("eggStart", u.fx, u.fy);
      if (clang) play("metalClang", u.fx, u.fy);
      /* ★ 마인 발동(2026-11-02, 요청: "마인 발동 소리 중간 높이의 기계음") — 유닛 op 의 arm(engine9 · 터지기 0.45초 앞)이 선 첫 장. 터질 때는 종전대로 boom(dom mine). */
      if (u.kind === "mine" && u.arm && fresh(`a${Math.round(u.fx * 4096)}:${Math.round(u.fy * 4096)}`)) play("mineArm", u.fx, u.fy);
      if (u.kind.startsWith("cocoon")) { beat = true; bx = u.fx; by = u.fy; }
      if (u.pickKey) {
        const down = !!u.pickState && u.pickState.includes("땅속");
        const was = this.buried.get(u.pickKey);
        if (was !== undefined && was !== down) play(down ? "burrow" : "unburrow", u.fx, u.fy);
        this.buried.set(u.pickKey, down);
      }
    }
    /* 이어지는 소리(용접·채집·소환구 웅웅·공사 고치 심장)는 **당겨 들어가 볼 때만**(r 있음 = 지도 일부만 보임) — 지도 전체를 보면 어딘가에서 늘 캐고 지으므로 쉼 없이 갈린다. */
    if (r && weld) play("weld", wx, wy);
    if (r) for (const [k, [x, y]] of mine) play(k, x, y);
    if (r && hum) play("warpHum", hx, hy);
    if (r && beat) play("heart", bx, by);   // 고치는 0.9초마다 부푼다(engine9 hopP9) — 간격 880ms
    this.prev = now;
    this.hitPh = hitPh;
    if (this.buried.size > 4000) this.buried.clear();
    if (this.swingN.size > 4000) this.swingN.clear();
    if (this.cocWas.size > 4000) this.cocWas.clear();
    if (this.eggWas.size > 6000) this.eggWas.clear();
  }
}
