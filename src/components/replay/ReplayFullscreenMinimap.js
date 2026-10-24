import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef } from "react";
import { drawMapGrid } from "../../utils/mapTiles";
import { decodeMapTerrain, terrainFace } from "../../utils/mapTerrain";
import { pWrap } from "./perf9";
import { TEAM_COLOR } from "./markers";
/* 안개 값은 큰 지도의 안개 층(ReplayFogLayer)에서 그대로 가져온다 — 두 그림이 같은
   짙기·같은 색이라야 미니맵과 지도가 한 벌로 읽힌다. */
/** 밝혔지만 지금 안 보이는 칸의 덮개 짙기(0~1). */
const MINI_FOG_DIM = 0.6;
/** 안개 색 — 순검정이 아니라 푸른 밤(순검정은 지형색을 통째로 죽인다). */
const MINI_FOG_R = 5;
const MINI_FOG_G = 8;
const MINI_FOG_B = 14;
export default function ReplayFullscreenMinimap({ image, grid, ratio, dotsRef, extraRef, pingsRef, tick, viewAt, viewsAt, viewColor, zoom, pan, onSeek, onSeekStart, onSeekEnd, onWheelZoom, unproject, fog, painter, live, warming, ownRaw, ownColor, tags, }) {
    const boxRef = useRef(null);
    const cvRef = useRef(null);
    const imgRef = useRef(null);
    /** 지형으로 구운 배경 한 장 — 맵이 바뀔 때만 굽는다(타일 하나 3px). */
    const bgRef = useRef(null);
    /** 안개 한 장 — 칸이 곧 화소다(가로×세로 타일). 늘려 깔면 가장자리가 부드럽다. */
    const fogRef = useRef(null);
    /** 굽은 안개 판의 열쇠 — 같은 배열·같은 t 면 다시 안 굽는다. */
    const fogKeyRef = useRef(null);
    /** 붓의 눈 목록을 찍어 둘 칸 격자(0~255 덮임) — 큰 지도 엔진의 disc 와 같은 식이다. */
    const eyeGridRef = useRef(null);
    /** 상자가 0일 때 다시 그리기를 예약해 둔 프레임 — 겹쳐 예약되지 않게 하나만 든다. */
    const retryRef = useRef(0);
    useEffect(() => () => cancelAnimationFrame(retryRef.current), []);
    const bumpRef = useRef(0);
    /** 이름표 겹층 — 겹친 이름표를 위아래로 벌리는 자(아래 useLayoutEffect). */
    const tagsRef = useRef(null);
    /* ★ 이웃한 진영의 이름표가 **겹치면 위아래로 벌린다**(2026-10-09 · 실측: 2:2 지도의 아래쪽 두 본진 이름표가 포개졌다) — 자리는 지도 분수라 겹침은 판 크기와
       이름 길이에 달렸으니(폰 100px 판 · PC 186px), 그려진 뒤 네모를 재서 겹친 짝마다 겹친 키의 반씩 서로 반대로 민다(margin-top · 세 번 되풀이). 판 밖으로는 안 민다. */
    useLayoutEffect(() => {
        const host = tagsRef.current;
        if (!host)
            return;
        const els = Array.from(host.querySelectorAll(".scr-fs-minitag"));
        for (const el of els) {
            el.style.marginTop = "0px";
            el.style.marginLeft = "0px";
        }
        if (els.length < 1)
            return;
        const W = host.clientWidth || 1;
        const H = host.clientHeight || 1;
        const items = els.map((el) => {
            const r = el.getBoundingClientRect();
            /* 칩 밖으로 걸친 몫 — 팀 루비(2026-10-19 · 칩 밖 왼위 .scr-truby)가 왼쪽·위로 내민 만큼. 이웃 칩이 루비를 덮지 않고, 판 귀퉁이에서 루비가 안 잘리게 센다. */
            const rb = el.querySelector(".scr-truby")?.getBoundingClientRect();
            const ex = rb ? Math.max(0, r.left - rb.left) : 0;
            const ey = rb ? Math.max(0, r.top - rb.top) : 0;
            const exr = 0;
            return { el, x: (parseFloat(el.style.left) / 100) * W, y: (parseFloat(el.style.top) / 100) * H, w: r.width, h: r.height, dy: 0, ex, ey, exr };
        });
        for (let pass = 0; pass < 3; pass += 1) {
            for (let i = 0; i < items.length; i += 1)
                for (let j = i + 1; j < items.length; j += 1) {
                    const a = items[i];
                    const b = items[j];
                    /* 상자는 왼위로 걸친 팀 배지까지(ex·ey · 2026-10-11) — 안 그러면 이웃 칩이 배지를 덮는다(칩은 transform 이라 배지의 z-index 가 칩 밖으로 못 나간다). */
                    const al = a.x - a.w / 2 - a.ex;
                    const ar = a.x + a.w / 2 + a.exr;
                    const bl = b.x - b.w / 2 - b.ex;
                    const br = b.x + b.w / 2 + b.exr;
                    const at = a.y + a.dy - a.h / 2 - a.ey;
                    const ab = a.y + a.dy + a.h / 2;
                    const bt = b.y + b.dy - b.h / 2 - b.ey;
                    const bb = b.y + b.dy + b.h / 2;
                    const ox = Math.min(ar, br) - Math.max(al, bl);
                    const oy = Math.min(ab, bb) - Math.max(at, bt) + 1;
                    if (ox <= 0 || oy <= 0)
                        continue;
                    const half = oy / 2;
                    if (a.y + a.dy <= b.y + b.dy) {
                        a.dy -= half;
                        b.dy += half;
                    }
                    else {
                        a.dy += half;
                        b.dy -= half;
                    }
                }
        }
        /* ★ 판 밖으로 나가는 이름표는 **안으로 죈다**(2026-10-09, 지적: "미니맵 닉네임 태그 잘림 현상 — 클램핑 필요") — 가운데 맞춤이라 귀퉁이 진영의 이름표 반이 판 밖(overflow
           hidden)으로 잘렸다. 가로·세로 다 제 네모가 판 안에 다 들게 민다(margin). */
        for (const it of items) {
            const dy = Math.max(it.h / 2 + it.ey - it.y, Math.min(H - it.h / 2 - it.y, it.dy));
            const dx = Math.max(it.w / 2 + it.ex - it.x, Math.min(W - it.w / 2 - it.exr - it.x, 0));
            it.el.style.marginTop = Math.abs(dy) > 0.5 ? `${dy.toFixed(1)}px` : "0px";
            it.el.style.marginLeft = Math.abs(dx) > 0.5 ? `${dx.toFixed(1)}px` : "0px";
        }
    }, [tags, warming]);
    /* 지도 그림은 한 번만 읽어 붙들어 둔다 — 프레임마다 새로 만들면 그때마다 디코딩한다. */
    useEffect(() => {
        if (!image) {
            imgRef.current = null;
            return;
        }
        const im = new Image();
        im.src = image;
        im.onload = () => { imgRef.current = im; bumpRef.current += 1; };
    }, [image]);
    /* 지형 배경 굽기 — 큰 지도와 같은 그림(drawMapGrid)이라 미니맵과 지도가 안 갈린다.
       타일당 3px이면 128타일 맵이 384px으로, 어떤 미니맵 상자보다 크다. */
    useEffect(() => {
        if (!grid || !(grid.width > 0) || !(grid.height > 0)) {
            bgRef.current = null;
            return undefined;
        }
        const cv = document.createElement("canvas");
        /* ★ 타일당 화소는 **판 크기에 맞춘다**(2026-09, 지적: "미니맵이 흐려보이는데 왜그러지") — 옛 3px 은 128타일 맵이 384px 이라,
           PC 배수(--dk 1.8)로 커진 판(CSS 230px × 배킹 2 = 460px)보다 작아 **늘려 그려** 흐렸다. 긴 변이 1024px 남짓이 되게
           잡고(128타일 → 8px · 256타일 → 4px) 3~8px 로 죈다 — 그 위는 메모리만 든다(1024² = 4MB). */
        const px = Math.max(3, Math.min(8, Math.round(1024 / Math.max(grid.width, grid.height))));
        cv.width = grid.width * px;
        cv.height = grid.height * px;
        const c9 = cv.getContext("2d");
        if (!c9)
            return undefined;
        // 지형은 비동기로 풀리므로 먼저 옛 길(그룹 램프)로 한 장 — 그 사이가 안 빈다.
        drawMapGrid(c9, grid, null, px);
        bgRef.current = cv;
        bumpRef.current += 1;
        let dead = false;
        void decodeMapTerrain(grid.terrain).then((mt) => {
            if (dead || !mt)
                return;
            drawMapGrid(c9, grid, terrainFace(mt), px);
            bumpRef.current += 1;
        });
        return () => { dead = true; };
    }, [grid]);
    useEffect(() => {
        /* 한 장 그리기를 함수로 뽑았다 — 상태(zoom·pan)로 한 번, 손짓 중에는 재생기가
           손끝 값으로 다시 부른다. 매개변수 이름이 props를 일부러 가린다. */
        const paint = (zoom, pan) => {
            const cv = cvRef.current;
            const box = boxRef.current;
            if (!cv || !box)
                return;
            /* ★ 그리는 칸은 **정수로 재면 안 된다**(지적: "미니맵의 아랫줄이 완전히 가려져 —
               그리는 부분의 높이가 부족한 것 같아") ────────────────────────────────────────
               clientWidth·clientHeight는 **반올림한 정수**를 준다. 이 판은 폭이 clamp(76, 23vw,
               116)이라 소수로 떨어지는 것이 예사다: 폰 390px에서 판이 89.7 → 여백 8·테두리 2를
               빼면 칸이 **79.7**인데 client는 **80**이라 답한다.
               그 0.3px이 왜 눈에 보이는가 — 이 함수는 지도 전체를 w×h로 **늘려** 그린다. 칸을
               80이라 믿고 그리면 그림이 실제 칸(79.7)보다 0.3px 크고, 넘치는 몫은 overflow가
               잘라 낸다. 80px짜리 판에 128타일을 그리므로 0.3px은 곧 **타일 반 줄**이고, 그것이
               하필 지도의 맨 아랫줄이다(위·왼쪽은 원점이라 안 밀린다).
               상자를 소수로 재고 테두리를 손으로 뺀다 — 이러면 그린 것과 보이는 것이 정확히
               같아진다. 굽는 크기(cv.width)는 여전히 정수로 반올림하지만, 그것은 배킹의
               촘촘함일 뿐 그림의 자리는 안 건드린다. */
            const r9 = box.getBoundingClientRect();
            const cs9 = window.getComputedStyle(box);
            const w = Math.max(0, r9.width
                - (parseFloat(cs9.borderLeftWidth) || 0) - (parseFloat(cs9.borderRightWidth) || 0));
            const h = Math.max(0, r9.height
                - (parseFloat(cs9.borderTopWidth) || 0) - (parseFloat(cs9.borderBottomWidth) || 0));
            /* ★ 상자가 아직 0이면 **다음 프레임에 다시 그린다**(지적: "아예 안 그려졌었나 봐" ·
               "드래그해서 옮기면 정상적으로 보여") ───────────────────────────────────────────
               여기가 그 자리였다. 상자가 0인 순간(판이 막 붙었을 때·전체화면으로 자리를 옮기는
               중일 때) 이 함수는 **아무것도 안 그리고 물러났다**. 그리고 이 그림의 신호는
               '리렌더'뿐이라, 그 뒤로 리렌더가 안 오면(재생을 멈춰 두면 틱이 없다) 캔버스가
               영영 빈 채로 남는다 — 드래그하면 재생기가 붓을 직접 불러 그때 처음 그려진다.
               그것이 "토글하면 미니맵 프레임이 안 나온다"의 정체였고, 실은 프레임만이 아니라
               **지도째** 안 그려져 있었다.
               그래서 물러날 때 다음 프레임을 예약한다. 상자가 설 때까지 이어지고, 서는 순간
               제 그림이 그려진다. */
            if (w <= 0 || h <= 0) {
                cancelAnimationFrame(retryRef.current);
                retryRef.current = requestAnimationFrame(() => paint(zoom, pan));
                return;
            }
            /* 배킹 상한 3(옛 2) — 폰·레티나 3배 화면에서 2배 배킹은 그만큼 늘려 보여 흐렸다. 판이 작아 값은 거의 없다. */
            const B = Math.min(3, window.devicePixelRatio || 1);
            if (cv.width !== Math.round(w * B) || cv.height !== Math.round(h * B)) {
                cv.width = Math.round(w * B);
                cv.height = Math.round(h * B);
            }
            /* 화면 크기도 **손으로 못 박는다** — CSS(absolute + inset 0)가 이미 상자에 맞추지만,
               그 규칙이 어떤 까닭으로든 안 걸리면 <canvas>는 속성 크기를 CSS 픽셀로 써서 배로
               커진다(웹킷에서 실제로 그랬다). 두 겹으로 막아 둔다 — 값은 지금 잰 그 값이다. */
            cv.style.width = `${w}px`;
            cv.style.height = `${h}px`;
            const c = cv.getContext("2d");
            if (!c)
                return;
            c.setTransform(B, 0, 0, B, 0, 0);
            c.clearRect(0, 0, w, h);
            // ① 지도 — 그림이 있으면 깔고, 없으면 어두운 바탕.
            c.fillStyle = "#12161c";
            c.fillRect(0, 0, w, h);
            /* 배경은 **지형 → 올린 그림 → 맨 바탕** 차례다 — 지형이 있으면 큰 지도와 같은
               그림이라 미니맵과 지도가 한 벌로 읽힌다. */
            const bg = bgRef.current;
            const im = imgRef.current;
            if (bg) {
                c.imageSmoothingEnabled = true;
                c.imageSmoothingQuality = "high";
                c.drawImage(bg, 0, 0, w, h);
            }
            else if (im) {
                c.globalAlpha = 0.85;
                c.drawImage(im, 0, 0, w, h);
                c.globalAlpha = 1;
            }
            /* ② 전장의 안개(요청) — 지형 **위**, 점 **아래**다. 원작 미니맵도 그 차례다:
               못 밝힌 땅은 새까맣고, 밝혔지만 지금 안 보이는 땅은 어둡게 깔리며, 그 위에
               내 유닛과 **기억 속 건물**은 밝게 찍힌다(안개 밑에 잠기지 않는다).
               칸 한 장(가로×세로 타일)을 굽고 상자 크기로 늘려 깐다 — 늘리기 보간이 곧
               가장자리를 부드럽게 하는 자라, 큰 지도처럼 등고선을 뽑을 까닭이 없다.
               ※ 점은 이미 재생기가 시점으로 걸러 넘긴다(안 보이는 적은 op에 아예 없다) —
                 여기서 다시 지울 것이 없다. */
            if (fog && fog.w > 0 && fog.h > 0 && fog.explored.length === fog.w * fog.h) {
                /* ★ 안개는 **칸의 3~4배로 굽고 가장자리를 세운다**(2026-09, 지적: "미니맵 흐림해결안됨 해상도가 낮나?") — 지형은 벡터라
                   선명한데, 안개를 타일 한 칸 = 1화소로 구워 판(PC 230px × 배킹 2)에 **4배 남짓 늘려** 깔아 경계가 흐린 계단으로 읽혔다.
                   이제 칸 값(a)을 먼저 내고, 하위 화소마다 이웃 넷을 bilinear 로 섞은 뒤 **단(0 · DIM · 1) 사이를 smoothstep 으로 조여**
                   경계를 곡선으로 세운다. 굽기는 안개 값이 바뀔 때만이다(같은 배열·같은 t 면 굽은 판을 다시 쓴다). */
                const SS9 = Math.min(4, Math.max(2, Math.ceil((w * B) / fog.w)));
                const fw9 = fog.w * SS9;
                const fh9 = fog.h * SS9;
                let fc = fogRef.current;
                if (!fc || fc.width !== fw9 || fc.height !== fh9) {
                    fc = document.createElement("canvas");
                    fc.width = fw9;
                    fc.height = fh9;
                    fogRef.current = fc;
                    fogKeyRef.current = null;
                }
                /* 붓의 안개가 있으면 그것을 쓴다(위 live 의 ★) — 눈 목록을 칸 격자에 찍는다(엔진 visNow 의 disc 와 같은 식). */
                const lv9 = fog.live?.current ?? null;
                const useLive9 = !!lv9 && lv9.explored.length === fog.w * fog.h;
                const fExp9 = useLive9 ? lv9.explored : fog.explored;
                const fT9 = useLive9 ? lv9.t : fog.t;
                const fKey9 = useLive9 ? lv9.seq : fog.vis;
                const fk9 = fogKeyRef.current;
                const fresh9 = !fk9 || fk9.e !== fExp9 || fk9.v !== fKey9 || fk9.t !== fT9;
                let fVis9 = fog.vis;
                if (useLive9 && fresh9) {
                    const n9 = fog.w * fog.h;
                    let g9 = eyeGridRef.current;
                    if (!g9 || g9.length !== n9) {
                        g9 = new Uint8Array(n9);
                        eyeGridRef.current = g9;
                    }
                    g9.fill(0);
                    const W9 = fog.w;
                    const H9 = fog.h;
                    const ey9 = lv9.eyes;
                    for (let k9 = 0; k9 + 2 < ey9.length; k9 += 4) {
                        const cx = ey9[k9];
                        const cy = ey9[k9 + 1];
                        const r = ey9[k9 + 2];
                        const x0 = Math.max(0, Math.floor(cx - r - 1));
                        const x1 = Math.min(W9 - 1, Math.ceil(cx + r + 1));
                        const y0 = Math.max(0, Math.floor(cy - r - 1));
                        const y1 = Math.min(H9 - 1, Math.ceil(cy + r + 1));
                        const ro = r + 0.5;
                        const ri = r - 0.5;
                        const r2o = ro * ro;
                        const r2i = ri > 0 ? ri * ri : -1;
                        for (let y = y0; y <= y1; y += 1) {
                            const dy = y + 0.5 - cy;
                            const dy2 = dy * dy;
                            const row = y * W9;
                            for (let x = x0; x <= x1; x += 1) {
                                const dx = x + 0.5 - cx;
                                const d2 = dx * dx + dy2;
                                if (d2 >= r2o)
                                    continue;
                                const i = row + x;
                                if (g9[i] === 255)
                                    continue;
                                if (d2 <= r2i) {
                                    g9[i] = 255;
                                    continue;
                                }
                                const v = Math.round((ro - Math.sqrt(d2)) * 255);
                                if (v > g9[i])
                                    g9[i] = v;
                            }
                        }
                    }
                    fVis9 = g9;
                }
                const fx9 = fc.getContext("2d");
                if (fx9 && fresh9) {
                    const n9 = fog.w * fog.h;
                    const av9 = new Float32Array(n9);
                    for (let i = 0; i < n9; i += 1) {
                        /* 밝힌 땅은 DIM, 못 밝힌 땅은 통짜다. 거기에 **지금 덮임**을 빼면 눈이
                           닿은 자리가 그만큼 걷힌다 — 0~255 덮임이 그대로 가장자리 기울기가 된다. */
                        const base = fExp9[i] <= fT9 ? MINI_FOG_DIM : 1;
                        av9[i] = base * (1 - (fVis9[i] ?? 0) / 255);
                    }
                    const img = fx9.createImageData(fw9, fh9);
                    const px9 = img.data;
                    const W9 = fog.w;
                    const H9 = fog.h;
                    const D9 = MINI_FOG_DIM;
                    const sharp9 = (b) => {
                        /* 단 사이의 기울기를 조인다 — [0, DIM] · [DIM, 1] 두 구간을 따로 smoothstep(0.3, 0.7). */
                        const lo = b <= D9 ? 0 : D9;
                        const hi = b <= D9 ? D9 : 1;
                        const t = (b - lo) / (hi - lo);
                        const u = Math.max(0, Math.min(1, (t - 0.3) / 0.4));
                        return lo + (hi - lo) * u * u * (3 - 2 * u);
                    };
                    for (let y = 0; y < fh9; y += 1) {
                        const gy = (y + 0.5) / SS9 - 0.5;
                        const y0 = Math.max(0, Math.min(H9 - 1, Math.floor(gy)));
                        const y1 = Math.min(H9 - 1, y0 + 1);
                        const ty = Math.max(0, Math.min(1, gy - y0));
                        for (let x = 0; x < fw9; x += 1) {
                            const gx = (x + 0.5) / SS9 - 0.5;
                            const x0 = Math.max(0, Math.min(W9 - 1, Math.floor(gx)));
                            const x1 = Math.min(W9 - 1, x0 + 1);
                            const tx = Math.max(0, Math.min(1, gx - x0));
                            const a0 = av9[y0 * W9 + x0] * (1 - tx) + av9[y0 * W9 + x1] * tx;
                            const a1 = av9[y1 * W9 + x0] * (1 - tx) + av9[y1 * W9 + x1] * tx;
                            const o = (y * fw9 + x) * 4;
                            px9[o] = MINI_FOG_R;
                            px9[o + 1] = MINI_FOG_G;
                            px9[o + 2] = MINI_FOG_B;
                            px9[o + 3] = Math.round(sharp9(a0 * (1 - ty) + a1 * ty) * 255);
                        }
                    }
                    fx9.putImageData(img, 0, 0);
                    fogKeyRef.current = { e: fExp9, v: fKey9, t: fT9 };
                }
                c.imageSmoothingEnabled = true;
                c.imageSmoothingQuality = "high";
                c.drawImage(fc, 0, 0, w, h);
            }
            /* ③ 활동 네모 — 원작처럼 임자 색 점이다. 건물은 한 단 크게 찍어 무리와 갈린다.
               크기는 미니맵 폭에 비례해, 작은 미니맵에서도 뭉치지 않고 큰 데서도 안 성글다. */
            const uS = Math.max(1.5, w * 0.013);
            const bS = Math.max(2.5, w * 0.022);
            /* 두 벌을 잇는다 — 그린 것(dotsRef)과 화면 밖이라 안 그린 것(extraRef).
               합치지 않고 이어 도는 까닭은 프레임마다 배열을 새로 만들지 않으려는 것이다. */
            const dots9 = extraRef
                ? [dotsRef.current, extraRef.current] : [dotsRef.current];
            for (const grp9 of dots9)
                for (const d of grp9) {
                    const s = d.wFrac !== undefined ? bS : uS;
                    // 입체 보기의 원근을 벗겨 **평면 지도 분수**로 되돌린다(위 unproject 주석).
                    const [mx, my] = unproject ? unproject(d.fx, d.fy) : [d.fx, d.fy];
                    c.fillStyle = ownRaw && ownColor && (d.pickRaw ?? d.raw) === ownRaw ? ownColor : d.color;
                    c.fillRect(mx * w - s / 2, my * h - s / 2, s, s);
                }
            /* ③-2 핑 — 원작처럼 미니맵에도 번지는 고리(2026-10, 요청: "미니맵 내 색 포함"). 나이 0 → 1 동안 반지름이 커지고 흐려진다.
               색은 재생기가 정해 보낸다(화면 주인 기준 원작 색 · 주인 없으면 임자색). */
            if (pingsRef) {
                for (const p of pingsRef.current) {
                    const [mx, my] = unproject ? unproject(p.fx, p.fy) : [p.fx, p.fy];
                    const r = Math.max(2, w * 0.012) * (0.6 + p.age * 1.6);
                    c.globalAlpha = Math.max(0, 1 - p.age * 0.8);
                    c.strokeStyle = p.color;
                    c.lineWidth = Math.max(1, w * 0.006);
                    c.beginPath();
                    c.arc(mx * w, my * h, r, 0, Math.PI * 2);
                    c.stroke();
                }
                c.globalAlpha = 1;
            }
            /* ④ 보고 있는 자리 — 흰 테두리. 입체 보기에서는 **네모가 아니라 사다리꼴**이다
               (같은 지적) — 화면의 네모를 평면 지도로 되돌리면 먼 쪽(위)이 더 넓기 때문이다.
               네 모서리를 각각 되돌려 잇는 것이 곧 정답이다 — 평면에서는 다시 네모가 된다.
               지도 밖으로는 안 나간다 — 창이 지도보다 넓을 수 있다(한 축만 크롭되는 비율). */
            const many9 = viewsAt?.(zoom, pan) ?? null;
            const views9 = many9 && many9.length > 0 ? many9 : [];
            if (views9.length === 0) {
                const v1 = viewAt(zoom, pan);
                if (v1)
                    views9.push(v1);
            }
            if (views9.length === 0)
                return;
            const view = views9[0];
            /* 진단(#diag·계측 도구) — 미니맵이 실제로 셈한 '보는 창'이다. 흰 네모가 안 보일 때
               그 까닭이 창 값인지(전체가 됐거나 상자 밖) 그리기인지를 여기서 가린다. */
            window.__miniView = {
                z: zoom, px: pan.x, py: pan.y,
                cx: +view.cx.toFixed(4), cy: +view.cy.toFixed(4),
                w: +view.w.toFixed(4), h: +view.h.toFixed(4),
            };
            for (const vw9 of views9) {
                const vx0 = vw9.cx - vw9.w / 2;
                const vy0 = vw9.cy - vw9.h / 2;
                const vx1 = vw9.cx + vw9.w / 2;
                const vy1 = vw9.cy + vw9.h / 2;
                const raw = [[vx0, vy0], [vx1, vy0], [vx1, vy1], [vx0, vy1]];
                const cor = raw.map(([qx, qy]) => (unproject ? unproject(qx, qy) : [qx, qy]));
                /* 원근 역사상은 지평선 너머에서 발산한다 — 값이 성치 않으면 평면 네모로 물러난다. */
                const okQ = cor.every(([qx, qy]) => Number.isFinite(qx) && Number.isFinite(qy));
                /* ★ 모서리를 **상자 안으로 죄면 안 된다**(지적: "3D에서 미니맵 프레임 문제 있음
                   1배에서 — 전체 다 보이고 있는데 일부처럼") ────────────────────────────────────
                   입체에서 화면 네모를 땅으로 되돌리면 **먼 쪽이 넓고 가까운 쪽이 좁은** 사다리꼴이
                   된다(가까운 것이 크게 그려지니 같은 화면 폭이 더 적은 타일을 덮는다). 1배에서는
                   그 사다리꼴이 지도 밖까지 뻗는다 — 실측(48도·128타일): 위 두 모서리가 타일
                   (−37, −57)·(165, −57), 아래가 (4.8, 152)·(123, 152)다.
                   여태 그 넷을 각각 [0,1]로 죄어 그렸는데, 죄는 순간 **변의 기울기가 꺾인다**:
                   왼 변이 (−37,−57)→(4.8,152)의 곧은 선이라 지도 아래 왼귀 (0,128)을 정확히
                   지나는데, 위 모서리를 (0,0)으로 당기면 그 선이 안쪽으로 휘어 지도 한 귀퉁이를
                   잘라 낸다 — 다 보이는데 일부만 든 것처럼 보이던 것이 이것이다.
                   투영은 직선을 직선으로 보내므로 **자르지 말고 그대로 그리면** 된다. 상자 밖은
                   캔버스가 알아서 잘라 준다. 발산을 막는 상한만 넉넉히 둔다(분수 ±8 — 실측 최댓값이
                   2.3이라 어느 각도에서도 이 상한이 변을 안 건드린다). */
                const cap9 = (v9) => Math.max(-8, Math.min(9, v9));
                const LW9 = 1.5;
                /* ★ 선을 **안쪽으로 물려** 그린다(지적: "전체화면 토글 시 미니맵 프레임이 처음에 안
                   나오는 현상") ──────────────────────────────────────────────────────────────
                   안 나온 것이 아니라 **경계에 걸려 반이 잘렸다.** 캔버스 획은 선을 경로 **가운데**에
                   두므로, 경로가 상자 변에 딱 붙으면 굵기의 절반이 상자 밖이고 그 절반은 그려지지
                   않는다. 그런 자리가 실제로 있다: 프레임 모드 1배에서는 보는 창이 지도 **전체**라
                   네모가 상자와 정확히 같고(w=h=1), 전체화면을 껐다 켤 때마다 그 자리를 지난다.
                   고치는 법은 **가운데를 기준으로 조금 줄이는 것**이다(굵기 절반만큼). 균일한 축소는
                   직선을 직선으로 보내므로, 위에서 애써 지킨 사다리꼴의 기울기가 안 꺾인다 —
                   모서리를 각각 죄면 꺾인다(그 주석). 줄어드는 몫은 한 픽셀 남짓이라 다른 자리에서는
                   눈에 안 띈다. */
                const k9 = Math.max(0, 1 - LW9 / Math.max(1, Math.min(w, h)));
                const pts = (okQ ? cor : raw).map(([qx, qy]) => [
                    w / 2 + (cap9(qx) * w - w / 2) * k9,
                    h / 2 + (cap9(qy) * h - h / 2) * k9,
                ]);
                c.strokeStyle = vw9.color ?? viewColor ?? "rgba(255,255,255,.92)";
                c.lineWidth = LW9;
                c.beginPath();
                pts.forEach(([qx, qy], i) => { if (i === 0)
                    c.moveTo(qx, qy);
                else
                    c.lineTo(qx, qy); });
                c.closePath();
                c.stroke();
            }
        };
        if (painter)
            painter.current = paint;
        /* 상자 크기가 바뀌면 다시 그린다 — 판이 막 뜨거나(0 → 제 크기) 전체화면 전환으로
           비가 바뀌는 순간이 그것이다. 리렌더를 기다리지 않으므로 멈춰 둔 판에서도 제때
           그려진다(위 retryRef와 같은 뜻의 두 번째 그물이다). */
        const box0 = boxRef.current;
        let ro9 = null;
        if (box0 && typeof ResizeObserver !== "undefined") {
            ro9 = new ResizeObserver(() => {
                const lv9 = live?.current;
                paint(lv9 ? lv9.z : zoom, lv9 ? lv9.p : pan);
            });
            ro9.observe(box0);
        }
        /* 다시 그릴 신호는 **리렌더 그 자체**다 — 이 이펙트는 의존 목록이 없다(재생 틱 t가
           tick으로 들어와 프레임마다 리렌더를 내므로 그것이 곧 신호다). 목록을 두면 손짓
           중에 바뀌는 값(손끝 배율·팬)이 거기 안 들어 있어 한 박자 늦는다. */
        void tick;
        const lv = live?.current;
        /* 이 층은 의존 목록이 없어 **매 프레임** 점 전부를 다시 찍는다 — 렌더 밖이라
           안 재면 그 삯이 통째로 '브라우저' 뺄셈에 숨는다(perf9 머리말). */
        pWrap("붓:미니맵", () => paint(lv ? lv.z : zoom, lv ? lv.p : pan));
        return () => { ro9?.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    });
    /* 끌어서 시점 옮기기 — 누른 자리가 곧 화면 한가운데다(원작과 같다). 포인터를
       잡아 두므로 미니맵 밖으로 손이 나가도 계속 따라온다. */
    const seekAt = (clientX, clientY) => {
        const box = boxRef.current;
        if (!box)
            return;
        const r = box.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))), Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height))));
    };
    const dragRef = useRef(false);
    /* 휠은 **직접 건다**(리액트의 onWheel은 수동 리스너라 preventDefault가 안 먹는다) —
       막지 않으면 페이지가 함께 굴러 지도와 문서가 같이 움직인다. */
    useEffect(() => {
        const el = boxRef.current;
        if (!el || !onWheelZoom)
            return undefined;
        const on = (e) => {
            if (e.deltaY === 0)
                return;
            e.preventDefault();
            /* ★ **거품을 여기서 끊는다**(지적: "지금은 좌하단 기준 무조건") — 지도 쪽 휠
               손잡이는 지도 상자가 아니라 **판 뿌리**(.scr-fs-root)에 걸려 있다(그 자리 주석:
               로스터 판 위에서 굴린 휠도 받으려고 위로 올려 뒀다). 미니맵은 그 뿌리의 자손이라,
               여기서 처리해도 같은 굴림이 그대로 올라가 지도 손잡이가 한 번 더 돌았다 — 그쪽은
               커서를 지도 상자 안으로 죄므로 늘 한 구석(미니맵이 앉은 왼쪽 아래)이 축이 된다.
               끊으면 이 굴림의 임자는 미니맵 하나다. */
            e.stopPropagation();
            /* ★ 넘기는 것은 **분수**다(지적: "커서가 있는 곳으로 이동+줌해야 할 거 같아") —
               여기서 화면 좌표(clientX·clientY)를 그대로 넘기고 있었다. 받는 쪽(fsWheelZoom)은
               그 값을 0~1로 알고 `mx × 지도폭`을 셈하므로, 몇백 픽셀짜리 수가 들어가면 자리가
               지도 밖 저 멀리로 나가 한계에 눌린다 — 굴릴 때마다 늘 같은 구석으로 붙던 것이
               그것이다. 짚어서 옮기는 쪽(seekAt)은 처음부터 상자로 나눠 넘기고 있었으니,
               같은 자를 쓰게 맞춘다. */
            const r9 = el.getBoundingClientRect();
            onWheelZoom(Math.max(0, Math.min(1, (e.clientX - r9.left) / Math.max(1, r9.width))), Math.max(0, Math.min(1, (e.clientY - r9.top) / Math.max(1, r9.height))), e.deltaY < 0);
        };
        el.addEventListener("wheel", on, { passive: false });
        return () => el.removeEventListener("wheel", on);
    }, [onWheelZoom]);
    return (_jsxs("div", { ref: boxRef, className: warming ? "scr-fs-minimap is-warming" : "scr-fs-minimap", style: { aspectRatio: `${ratio}` }, onPointerDown: (e) => {
            e.stopPropagation();
            dragRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onSeekStart?.();
            seekAt(e.clientX, e.clientY);
        }, onPointerMove: (e) => { if (dragRef.current)
            seekAt(e.clientX, e.clientY); }, onPointerUp: () => { if (dragRef.current) {
            dragRef.current = false;
            onSeekEnd?.();
        } }, onPointerCancel: () => { if (dragRef.current) {
            dragRef.current = false;
            onSeekEnd?.();
        } }, role: "presentation", children: [_jsx("canvas", { ref: cvRef, "aria-hidden": true, style: warming ? { opacity: 0 } : undefined }), !warming && tags && tags.length > 0 && (_jsx("div", { className: "scr-fs-minitags", ref: tagsRef, "aria-hidden": true, children: tags.map((tg) => (_jsxs("span", { className: `scr-fs-minitag is-${tg.tier}${tg.dim ? " is-dim" : ""}`, style: { left: `${(tg.fx * 100).toFixed(2)}%`, top: `${(tg.fy * 100).toFixed(2)}%`, color: tg.fg }, title: tg.dim ? `${tg.name} — 나감·탈락` : tg.name, children: [tg.team !== undefined && (_jsxs("span", { className: "scr-truby", style: { background: TEAM_COLOR[tg.team] ?? "#666" }, children: [tg.team, "\uD300"] })), _jsx("span", { className: "scr-fs-minitag-txt", style: { background: tg.bg }, children: tg.name })] }, tg.key))) }))] }));
}
