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
  laser: "zap", flame: "flame", spine: "spine", spike: "spine", glave: "glaive", zap: "zap", flare: "zap",
  spark: "weld", weld: "zap", tankboom: "boom", heal: null,
  missile: null, missileG: null, plasma: null, photon: null, venom: null, acid: null, spit: null,
};
/** 근접(무기 갈래 없음)의 때린 몸 → 타격 소리(op.by · 2026-10-22). 없는 것은 칼질. */
const MELEE9: Record<string, SfxKind9> = {
  Zealot: "blade", "Dark Templar": "blade", Zergling: "claw", Ultralisk: "claw", Broodling: "claw",
};
/** 캐는 일꾼 → 채집 소리. */
const GATH9: Record<"SCV" | "Probe" | "Drone", SfxKind9> = { SCV: "mineScv", Probe: "mineProbe", Drone: "mine" };
/** 발사체 → 쏠 때 나는 소리(shot op 이 막 나갈 때). */
const LAUNCH9: Record<string, SfxKind9> = {
  missile: "missile", missileG: "missile", plasma: "photon", photon: "photon", venom: "puff", acid: "puff", spit: "puff",
};
/** 마법(dom cast 의 sub) → 소리. */
const CAST9: Record<string, SfxKind9> = {
  emp: "zap", plague: "puff", ensnare: "puff", dweb: "puff", mael: "warp", recall: "warp", recallU: "warp", yamato: "cannon",
};

export class SfxCues9 {
  private prev = new Set<string>();
  private buried = new Map<string, boolean>();
  /** 맞은 몸마다 앞 장의 피격 위상 — 같은 몸이 잇달아 맞으면 열쇠가 그대로라 위상이 0 으로 돌아온 것으로 새 타를 가른다. */
  private hitPh = new Map<number, number>();
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
          else if (mat === "bio") k = Math.random() < 0.3 ? "screamF" : "screamM";
          else if (mat === "zerg") k = "squeal";
          else if (mat === "cocoon") k = "eggPop";
          else if (mat === "toss") k = op.tmech ? "boom" : "zap";
          else k = "boom";
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
          play(s === undefined ? (op.by ? MELEE9[op.by] : undefined) ?? "slash" : HIT9[s] === undefined ? "gun" : HIT9[s], op.fx, op.fy);
          break;
        }
        case "shot": {
          const k = op.style ? LAUNCH9[op.style] : undefined;
          if (k && (op.u ?? 1) < 0.15) play(k, op.fx, op.fy);
          break;
        }
        case "tether":
          if (fresh(`t${op.stag}${op.sub}`)) play(op.sub === "out" ? "unload" : "load", op.fx, op.fy);
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
      if (!inView(u.fx, u.fy)) continue;
      /* 채집은 일꾼 종류마다 따로(드론 mine · SCV mineScv · 프로브 mineProbe — 2026-10-22, 요청: "프로브랑 SCV 는 소리가 달라야"). */
      if (u.gath) mine.set(GATH9[u.gath], [u.fx, u.fy]);
      if (orb) play("warp", u.fx, u.fy);
      else if (u.kind === "warpin") { hum = true; hx = u.fx; hy = u.fy; }
      if (done) play("warpEnd", u.fx, u.fy);
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
  }
}
