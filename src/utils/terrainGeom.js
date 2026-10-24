/* ── 지형 **기하 캐시**(2026-10-23, 요청: "지형도 타일단위 그린걸 반복사용가능한 방법을 연구해보자" → "1 → 3으로 가자") ────
 *
 * 지형은 경기 중에 안 변하는데, 여태 `drawMapGrid` 는 부를 때마다 지도 **전체**의 등고선(마칭 스퀘어 · Chaikin ×3)을
 * 다시 뽑고 갈래마다 타일 전부를 정렬해 중앙값 색을 다시 냈다 — 판 크기와 무관하게 굽기 한 번에 90ms(128² · 헤드리스)가
 * 기하 몫이었다(docs/notes/player-ui.md '지형 판 재사용 연구'). 여기서 그 기하를 **지도마다 한 번만** 뽑아 둔다:
 *   · 갈래마다 고리(타일 단위 좌표 · 깎은 곡선)와 그 갈래의 색(실색 중앙값 → 없으면 타일셋 색표).
 *   · 램프 파내기용 고리(램프 칸 · 사분 칸 비램프 마스크) · 타일별 실색(옅게 덧칠하는 결).
 * 캔버스(mapTiles.drawMapGrid)는 이것을 Path2D 로 채우기만 하고, GL 지형층(glTerrain9)은 같은 고리를 스텐실 부채꼴로 그린다.
 * 두 붓이 **한 기하**를 쓰므로 미니맵·PNG 와 재생 화면이 같은 선을 긋는다.
 *
 * 좌표 규약 — 모든 고리는 **타일 단위**다(정수 = 타일 경계). 그리는 쪽이 배율을 곱한다. */
import { maskLoops } from "./contour";
/* ★ 타일에서 뽑은 색은 **채도를 조금 뺀다**(요청: "너무 쨍한 거 같아 … 약간 파스텔화" → 0.25/0.08 → 0.15/0.03 → 0.10/0 —
   "전체적으로 빛을 줄여 원작의 진하고 살짝 어두운 색감") — 밝기(luma)와 10% 섞어 채도만 내린다. 파스텔(흰 쪽) 몫은 0.
   어둡기 자체는 mapTerrain 의 SHOW_GAMMA 가 맡는다(둘이 한 결이다). */
const SOFT_K = 0.10;
const PASTEL_K = 0;
export function softenRGB9(c) {
    const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const f = (v) => Math.round(Math.min(255, (v + (lum - v) * SOFT_K) * (1 - PASTEL_K) + 255 * PASTEL_K));
    return [f(c[0]), f(c[1]), f(c[2])];
}
/** `hsl(h s% l%)` · `rgb(r,g,b)` · `#rrggbb` → rgb 바이트. 색표의 hsl 문자열을 GL 이 쓰려고 푼다. */
export function parseCol9(s) {
    const t = s.trim();
    let m = /^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(t);
    if (m) {
        const h = ((Number(m[1]) % 360) + 360) % 360;
        const sa = Number(m[2]) / 100;
        const l = Number(m[3]) / 100;
        const c = (1 - Math.abs(2 * l - 1)) * sa;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m0 = l - c / 2;
        const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        return [Math.round((r + m0) * 255), Math.round((g + m0) * 255), Math.round((b + m0) * 255)];
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t);
    if (m)
        return [Math.round(Number(m[1])), Math.round(Number(m[2])), Math.round(Number(m[3]))];
    m = /^#([0-9a-f]{6})$/i.exec(t);
    if (m) {
        const v = parseInt(m[1], 16);
        return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    m = /^#([0-9a-f]{3})$/i.exec(t);
    if (m) {
        const v = parseInt(m[1], 16);
        return [((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17];
    }
    return [128, 128, 128];
}
const colOf9 = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** 지도 한 장당 하나 — 열쇠는 격자 해시(내용)다. 몇 장만 든다(지도를 바꿔 가며 보는 사람도 드물다). */
const CACHE9 = new Map();
const CACHE_MAX9 = 4;
/** 지도의 지형 기하 — 있으면 그대로, 없으면 뽑아 둔다. `hash` 는 grid.hash(내용 해시). */
export function terrainGeom9(hash, mt, fill) {
    const key = `${hash}|${mt.w}x${mt.h}|${mt.tileset}|${mt.rgbAt ? 1 : 0}`;
    const hit = CACHE9.get(key);
    if (hit)
        return hit;
    const g = buildGeom9(mt, fill);
    if (CACHE9.size >= CACHE_MAX9) {
        const k0 = CACHE9.keys().next().value;
        if (k0 !== undefined)
            CACHE9.delete(k0);
    }
    CACHE9.set(key, g);
    return g;
}
function buildGeom9(mt, fill) {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const w = mt.w;
    const h = mt.h;
    const n9 = w * h;
    const lvl = new Uint8Array(n9);
    const walk = new Uint8Array(n9);
    const ramp = new Uint8Array(n9);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = y * w + x;
            lvl[i] = mt.levelAt(x, y);
            walk[i] = mt.walkAt(x, y) ? 1 : 0;
            /* 램프인가 — **원작 자료가 아는 답**이 있으면 그것이다(vf4의 미니타일 고도가 한 칸 안에서 갈리나 — mapTerrain의 TILE.ramp 주석).
               옛 판으로 구운 지도만 아래 어림으로 물러난다: 그 깃발은 램프와 절벽 가장자리를 못 가르므로, **고도가 실제로 갈리는 자리**인가를
               두 칸까지 보고 덧붙인다. */
            ramp[i] = mt.rampAt ? (mt.rampAt(x, y) ? 1 : 0) : (() => {
                if (!mt.partialAt(x, y) || !mt.walkAt(x, y))
                    return 0;
                const lv = mt.levelAt(x, y);
                for (let d = 1; d <= 2; d += 1) {
                    if (mt.levelAt(x - d, y) !== lv || mt.levelAt(x + d, y) !== lv
                        || mt.levelAt(x, y - d) !== lv || mt.levelAt(x, y + d) !== lv)
                        return 1;
                }
                return 0;
            })();
        }
    }
    /* ★ 램프 깃발은 **두 고도를 잇는 무리**만 믿는다(지적: "빠른무한에서 언덕(벽) 위 경계가 저렇게 다 날아가") — 깃발(한 칸 안에서
       걷는 미니타일의 고도가 갈리는 칸)은 벽·절벽 가장자리의 걷는 칸에도 켜질 수 있다. 램프는 정의상 **두 단을 잇는다**: 깃발 칸을
       8이웃으로 묶고, 그 무리에 맞닿은 걷는 비램프 칸의 고도가 둘 이상일 때만 램프로 남긴다.
       ★ 램프 칸은 **거의 다 걷는 칸**이다(재지적) — 걷는 미니타일이 12개 미만이면 깃발을 걷는다.
       ★ 진짜 램프에 **붙은 깃발 칸은 되살린다**(재지적: "램프 일부분에 경계선이 생김, 특히 위쪽") — 한 겹만. */
    {
        const raw0 = ramp.slice();
        const raw = ramp.slice();
        ramp.fill(0);
        for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
                const i = y * w + x;
                if (raw[i] !== 1)
                    continue;
                let nw = 0;
                for (let my = 0; my < 4; my += 1)
                    for (let mx = 0; mx < 4; mx += 1)
                        if (mt.walkAtMini(x * 4 + mx, y * 4 + my))
                            nw += 1;
                if (nw < 12)
                    raw[i] = 0;
            }
        }
        const seen = new Uint8Array(n9);
        const stack = [];
        for (let s0 = 0; s0 < n9; s0 += 1) {
            if (raw[s0] !== 1 || seen[s0] === 1)
                continue;
            const comp = [];
            const levels = new Set();
            seen[s0] = 1;
            stack.push(s0);
            while (stack.length > 0) {
                const i = stack.pop();
                comp.push(i);
                const x = i % w;
                const y = (i - x) / w;
                for (let dy = -1; dy <= 1; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        if (dx === 0 && dy === 0)
                            continue;
                        const xx = x + dx;
                        const yy = y + dy;
                        if (xx < 0 || yy < 0 || xx >= w || yy >= h)
                            continue;
                        const j = yy * w + xx;
                        if (raw[j] === 1) {
                            if (seen[j] === 0) {
                                seen[j] = 1;
                                stack.push(j);
                            }
                            continue;
                        }
                        if (walk[j] === 1)
                            levels.add(lvl[j]);
                    }
                }
            }
            if (levels.size >= 2)
                for (const i of comp)
                    ramp[i] = 1;
        }
        const grown = ramp.slice();
        for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
                const i = y * w + x;
                if (raw0[i] !== 1 || ramp[i] === 1)
                    continue;
                let near = false;
                for (let dy = -1; dy <= 1 && !near; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        const xx = x + dx;
                        const yy = y + dy;
                        if (xx < 0 || yy < 0 || xx >= w || yy >= h)
                            continue;
                        if (ramp[yy * w + xx] === 1) {
                            near = true;
                            break;
                        }
                    }
                }
                if (near)
                    grown[i] = 1;
            }
        }
        ramp.set(grown);
    }
    const isLand = (i) => walk[i] === 1 || lvl[i] > 0;
    /* ★ **색은 원작 그림이 정한다**(요청: "투혼 미니맵 이미지 줄게 픽셀 대조해서 색깔 맞춰봐 타일") — 갈래의 **윤곽**은 지형 깃발이,
       그 안을 채우는 **색**은 그 갈래에 든 타일들의 실제 색 **중앙값**이다(평균이 아닌 까닭: 섞인 얼룩이 평균을 끌어당긴다).
       판 3이 아닌 옛 지도는 종전 색표(fill)로 물러난다.
       ★ 실색은 한 번만 읽어 둔다(여기서 갈래마다 다시 안 묻는다). */
    const realRGB = mt.rgbAt;
    const hasRGB = !!realRGB;
    const rr = hasRGB ? new Int16Array(n9) : null;
    const gg = hasRGB ? new Int16Array(n9) : null;
    const bb = hasRGB ? new Int16Array(n9) : null;
    if (realRGB && rr && gg && bb) {
        for (let y = 0; y < h; y += 1)
            for (let x = 0; x < w; x += 1) {
                const c = realRGB(x, y);
                const i = y * w + x;
                if (c) {
                    rr[i] = c[0];
                    gg[i] = c[1];
                    bb[i] = c[2];
                }
                else {
                    rr[i] = -1;
                    gg[i] = -1;
                    bb[i] = -1;
                }
            }
    }
    const midColor = (test, fallback) => {
        if (!rr || !gg || !bb) {
            const c = parseCol9(fallback);
            return { rgb: c, col: fallback };
        }
        const rs = [];
        const gs = [];
        const bs = [];
        for (let i = 0; i < n9; i += 1) {
            if (!test(i) || rr[i] < 0)
                continue;
            rs.push(rr[i]);
            gs.push(gg[i]);
            bs.push(bb[i]);
        }
        if (rs.length === 0) {
            const c = parseCol9(fallback);
            return { rgb: c, col: fallback };
        }
        const mid = (a) => { a.sort((p9, q9) => p9 - q9); return a[a.length >> 1]; };
        const sc = softenRGB9([mid(rs), mid(gs), mid(bs)]);
        return { rgb: sc, col: colOf9(sc) };
    };
    const layer = (test, fallback) => {
        let any = false;
        for (let i = 0; i < n9; i += 1)
            if (test(i)) {
                any = true;
                break;
            }
        if (!any)
            return { loops: [], rgb: [0, 0, 0], col: "" };
        const c = midColor(test, fallback);
        return { loops: maskLoops(test, w, h), rgb: c.rgb, col: c.col };
    };
    const ts = mt.tileset;
    const water = midColor((i) => !isLand(i), fill(ts, 0, false, false));
    const land = layer(isLand, fill(ts, 0, true, false));
    // 땅 색은 고도 0 걷는 칸의 것(윤곽은 땅 전체).
    {
        const c0 = midColor((i) => walk[i] === 1 && lvl[i] === 0, fill(ts, 0, true, false));
        land.rgb = c0.rgb;
        land.col = c0.col;
    }
    const levels = [];
    const cliffs = [];
    const ramps = [];
    for (let L = 1; L <= 3; L += 1)
        levels.push(layer((i) => lvl[i] >= L && isLand(i), fill(ts, L, true, false)));
    for (let L = 1; L <= 3; L += 1)
        cliffs.push(layer((i) => lvl[i] === L && walk[i] === 0, fill(ts, L, false, false)));
    for (let L = 0; L <= 3; L += 1)
        ramps.push(layer((i) => ramp[i] === 1 && lvl[i] === L, fill(ts, L, true, true)));
    /* 램프 둘레 파내기(지적: "램프가 잘 표현이 안 되는 거 같아 — 언덕 위와 아래가 테두리나 층 없이 연결된 모양으로" · "램프
       윗부분에 경계가 그려져 있어서" · "진짜 언덕인데도 위쪽 모서리 표현이 사라지는 경우 있어") — 램프 칸 고리(덧판에서 destination-out)
       와 **사분 칸** 비램프 마스크(덧판이 없을 때의 클립): 제 칸이 램프면 클립, 제 칸이 걷는 칸이고 그 사분 칸이 칸의 바깥 띠이며 그쪽
       이웃 칸이 램프면 클립(모서리 사분은 대각 이웃도). 절벽선은 변 위 ±0.22칸이므로 0.25칸이면 맞닿은 변의 선만 지워진다. */
    let hasRamp = false;
    for (let i = 0; i < n9; i += 1)
        if (ramp[i] === 1) {
            hasRamp = true;
            break;
        }
    let rampLoops = null;
    let noRampLoops = null;
    if (hasRamp) {
        rampLoops = maskLoops((i) => ramp[i] === 1, w, h);
        const w4 = w * 4;
        const h4 = h * 4;
        const rampQ = new Uint8Array(w4 * h4);
        const rampAt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ramp[y * w + x] === 1;
        for (let qy = 0; qy < h4; qy += 1) {
            for (let qx = 0; qx < w4; qx += 1) {
                const tx = qx >> 2;
                const ty = qy >> 2;
                if (ramp[ty * w + tx] === 1) {
                    rampQ[qy * w4 + qx] = 1;
                    continue;
                }
                if (walk[ty * w + tx] !== 1)
                    continue;
                const sx = (qx & 3) === 0 ? -1 : (qx & 3) === 3 ? 1 : 0;
                const sy = (qy & 3) === 0 ? -1 : (qy & 3) === 3 ? 1 : 0;
                if ((sx !== 0 && rampAt(tx + sx, ty)) || (sy !== 0 && rampAt(tx, ty + sy))
                    || (sx !== 0 && sy !== 0 && rampAt(tx + sx, ty + sy)))
                    rampQ[qy * w4 + qx] = 1;
            }
        }
        noRampLoops = maskLoops((i) => rampQ[i] !== 1, w4, h4, 2).map((lp) => lp.map((v) => v / 4));
    }
    /* 타일결 — 갈래 안에서 갈리는 무늬를 옅게 덧칠할 **타일별 실색**(걷는 칸만 · 땅 윤곽 안에만 깐다는 것은 그리는 쪽 몫). */
    let tileCol = null;
    let tileRGBA = null;
    if (rr && gg && bb) {
        tileCol = new Array(n9);
        tileRGBA = new Uint8Array(n9 * 4);
        for (let i = 0; i < n9; i += 1) {
            if (walk[i] !== 1 || rr[i] < 0) {
                tileCol[i] = "";
                continue;
            }
            const c = softenRGB9([rr[i], gg[i], bb[i]]);
            tileCol[i] = colOf9(c);
            tileRGBA[i * 4] = c[0];
            tileRGBA[i * 4 + 1] = c[1];
            tileRGBA[i * 4 + 2] = c[2];
            tileRGBA[i * 4 + 3] = 255;
        }
    }
    const ms = typeof performance !== "undefined" ? performance.now() - t0 : 0;
    return { w, h, tileset: ts, lvl, walk, ramp, hasRGB, water, land, levels, cliffs, ramps, rampLoops, noRampLoops, tileCol, tileRGBA, ms };
}
