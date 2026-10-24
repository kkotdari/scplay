import { hushSfx9, playSfx9, sfxOn9 } from "./sfx9";
/** 때린 무기(style) → 맞을 때 나는 소리. null 이면 맞을 때는 조용하다(쏠 때 난다 — LAUNCH9). 없는 style(근접)은 칼질. */
const HIT9 = {
    gun: "gun", burst: "gun", frag: "cannon", cannon: "cannon", siege: "cannon", laserBC: "cannon",
    laser: "zap", flame: "flame", spine: "spine", spike: "spine", glave: "glaive", zap: "zap", flare: "zap",
    spark: "weld", weld: "zap", tankboom: "boom", heal: null,
    missile: null, missileG: null, plasma: null, photon: null, venom: null, acid: null, spit: null,
};
/** 근접(무기 갈래 없음)의 때린 몸 → 타격 소리(op.by · 2026-10-22). 없는 것은 칼질. */
const MELEE9 = {
    Zealot: "blade", "Dark Templar": "blade", Zergling: "claw", Ultralisk: "claw", Broodling: "claw",
};
/** 캐는 일꾼 → 채집 소리. */
const GATH9 = { SCV: "mineScv", Probe: "mineProbe", Drone: "mine" };
/** 발사체 → 쏠 때 나는 소리(shot op 이 막 나갈 때). */
const LAUNCH9 = {
    missile: "missile", missileG: "missile", plasma: "photon", photon: "photon", venom: "puff", acid: "puff", spit: "puff",
};
/** 마법(dom cast 의 sub) → 소리. */
const CAST9 = {
    emp: "zap", plague: "puff", ensnare: "puff", dweb: "puff", mael: "warp", recall: "warp", recallU: "warp", yamato: "cannon",
};
export class SfxCues9 {
    constructor() {
        this.prev = new Set();
        this.buried = new Map();
        /** 맞은 몸마다 앞 장의 피격 위상 — 같은 몸이 잇달아 맞으면 열쇠가 그대로라 위상이 0 으로 돌아온 것으로 새 타를 가른다. */
        this.hitPh = new Map();
        this.lastT = Number.NaN;
    }
    /** 한 장을 본다. 소리를 내도 되는 때가 아니면 열쇠만 적는다(prime). */
    run(fr, o) {
        if (!sfxOn9()) {
            this.prev.clear();
            this.buried.clear();
            this.lastT = Number.NaN;
            return;
        }
        const dt = fr.t - this.lastT;
        const jump = !Number.isFinite(dt) || dt < -0.05 || dt > 1.2 + o.speed * 0.25;
        const live = o.playing && !o.scrubbing && !jump;
        if (jump && Number.isFinite(this.lastT))
            hushSfx9();
        if (Math.abs(dt) < 1e-6 && Number.isFinite(dt))
            return; // 같은 장을 또 칠함(손짓·크기 바뀜) — 볼 것이 없다
        this.lastT = fr.t;
        const r = o.rect;
        const m = r ? (r.x1 - r.x0) * 0.08 : 0;
        const inView = (x, y) => !r || (x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m);
        const near = (x, y) => {
            if (!r)
                return 1;
            const cx = (r.x0 + r.x1) / 2;
            const cy = (r.y0 + r.y1) / 2;
            const d = Math.hypot((x - cx) / (r.x1 - r.x0), (y - cy) / (r.y1 - r.y0));
            return Math.max(0, 1 - d * 1.2);
        };
        const now = new Set();
        const hitPh = new Map();
        const play = (k, x, y) => {
            if (!live || !k)
                return;
            const opt = { near: near(x, y), speed: o.speed };
            playSfx9(k, opt);
        };
        const fresh = (key) => { now.add(key); return !this.prev.has(key); };
        let weld = false;
        let hum = false;
        let beat = false;
        let wx = 0;
        let wy = 0;
        let hx = 0;
        let hy = 0;
        let bx = 0;
        let by = 0;
        const mine = new Map();
        for (const op of fr.fxOps) {
            if (!inView(op.fx, op.fy))
                continue;
            switch (op.kind) {
                case "burst": {
                    if (!fresh(`b${op.bld ? 1 : 0}:${op.seed}`) || (op.ph ?? 0) > 0.6)
                        break;
                    const mat = op.mat;
                    let k;
                    // 고치(알·번데기)의 터짐은 부화·변태의 끝이다 — 폭발이 아니라 퍽(2026-10-22 · 실측: 초반 알 깨짐마다 생체 폭발이 났다).
                    if (op.bld)
                        k = mat === "zerg" ? "bioBoom" : mat === "cocoon" ? "puff" : "boomBig";
                    else if (mat === "bio")
                        k = Math.random() < 0.3 ? "screamF" : "screamM";
                    else if (mat === "zerg")
                        k = "squeal";
                    else if (mat === "cocoon")
                        k = "puff";
                    else if (mat === "toss")
                        k = op.tmech ? "boom" : "zap";
                    else
                        k = "boom";
                    play(k, op.fx, op.fy);
                    break;
                }
                case "hit":
                case "shield": {
                    if (op.seed === undefined)
                        break;
                    const ph = op.ph ?? 0;
                    const was = this.hitPh.get(op.seed);
                    hitPh.set(op.seed, ph);
                    /* 새로 맞음 = 새 열쇠, 또는 같은 몸의 위상이 처음으로 돌아옴(여럿이 한 몸을 잇달아 칠 때 · 옛 판은 첫 타만 울렸다). */
                    if (!fresh(`h${op.seed}`) && !(was !== undefined && ph < was - 0.05))
                        break;
                    const s = op.style;
                    play(s === undefined ? (op.by ? MELEE9[op.by] : undefined) ?? "slash" : HIT9[s] === undefined ? "gun" : HIT9[s], op.fx, op.fy);
                    break;
                }
                case "shot": {
                    const k = op.style ? LAUNCH9[op.style] : undefined;
                    if (k && (op.u ?? 1) < 0.15)
                        play(k, op.fx, op.fy);
                    break;
                }
                case "tether":
                    if (fresh(`t${op.stag}${op.sub}`))
                        play(op.sub === "out" ? "unload" : "load", op.fx, op.fy);
                    break;
                case "dom": {
                    const st = op.style;
                    if (st === "weld") {
                        weld = true;
                        wx = op.fx;
                        wy = op.fy;
                        break;
                    }
                    const key = `d${st}:${op.sub ?? ""}:${op.seed ?? ""}`;
                    if (!fresh(key))
                        break;
                    if (st === "storm")
                        play("thunder", op.fx, op.fy);
                    else if (st === "nuke")
                        play("boomBig", op.fx, op.fy);
                    else if (st === "swarm")
                        play("puff", op.fx, op.fy);
                    else if (st === "cast")
                        play(CAST9[op.sub ?? ""], op.fx, op.fy);
                    else if (st === "lift")
                        play(op.sub === "up" ? "liftOff" : "landing", op.fx, op.fy); // 건물 이륙·착륙(엔진의 소리 신호 · 2026-10-22)
                    else if (st === "bunk")
                        play(op.sub === "out" ? "unload" : "load", op.fx, op.fy); // 벙커 들고 남 = 수송선과 같은 소리(2026-10-22)
                    else if (st === "mine")
                        play("boom", op.fx, op.fy);
                    else if (st === "dig")
                        play("burrow", op.fx, op.fy);
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
            if (!inView(u.fx, u.fy))
                continue;
            /* 채집은 일꾼 종류마다 따로(드론 mine · SCV mineScv · 프로브 mineProbe — 2026-10-22, 요청: "프로브랑 SCV 는 소리가 달라야"). */
            if (u.gath)
                mine.set(GATH9[u.gath], [u.fx, u.fy]);
            if (orb)
                play("warp", u.fx, u.fy);
            else if (u.kind === "warpin") {
                hum = true;
                hx = u.fx;
                hy = u.fy;
            }
            if (done)
                play("warpEnd", u.fx, u.fy);
            if (u.kind.startsWith("cocoon")) {
                beat = true;
                bx = u.fx;
                by = u.fy;
            }
            if (u.pickKey) {
                const down = !!u.pickState && u.pickState.includes("땅속");
                const was = this.buried.get(u.pickKey);
                if (was !== undefined && was !== down)
                    play(down ? "burrow" : "unburrow", u.fx, u.fy);
                this.buried.set(u.pickKey, down);
            }
        }
        /* 이어지는 소리(용접·채집·소환구 웅웅·공사 고치 심장)는 **당겨 들어가 볼 때만**(r 있음 = 지도 일부만 보임) — 지도 전체를 보면 어딘가에서 늘 캐고 지으므로 쉼 없이 갈린다. */
        if (r && weld)
            play("weld", wx, wy);
        if (r)
            for (const [k, [x, y]] of mine)
                play(k, x, y);
        if (r && hum)
            play("warpHum", hx, hy);
        if (r && beat)
            play("heart", bx, by); // 고치는 0.9초마다 부푼다(engine9 hopP9) — 간격 880ms
        this.prev = now;
        this.hitPh = hitPh;
        if (this.buried.size > 4000)
            this.buried.clear();
    }
}
