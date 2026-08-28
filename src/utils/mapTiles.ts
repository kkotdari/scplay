/* ── 타일 격자의 **색과 다듬기** — 여기 한 곳에서만 정한다 ─────────────────────────
 *
 * 왜 따로 뺐나(지적: "색깔이 왜 타일하고 달라") — 같은 격자를 그리는 자리가 둘이 되었다:
 * 화면 썸네일(ReplayMapCanvas)과 내려받는 PNG(minimapExport)다. 색 램프는 베껴 두고
 * **장식 제거·최빈값 다듬기는 안 베꼈더니**, 내려받은 그림에만 나무·바위가 밝은 점으로
 * 흩뿌려져 딴 맵처럼 보였다. 둘이 같은 그림이어야 하므로 근거를 한 곳에 둔다.
 */
import { maskPath } from "./contour";

/** 타일셋 여덟의 [땅 색상(H), 땅 채도(S), 물·우주 색, **땅 밝기(0단)**, **절벽 밝기 몫**].
 *  차례는 OpenBW 그대로다.
 *
 *  뒤의 두 값은 나중에 붙었다(지적: 실제 빠른무한 지도 그림을 대조해 보니 "이거처럼
 *  색이 나와야하는데" — 우리 그림은 통째로 두세 단 어두웠다). 여태 모든 타일셋이
 *  `26 + 고도×11`이라는 한 식을 썼는데, 원작의 여덟 타일셋은 바탕 밝기부터 다르다:
 *    · 우주 정거장(빠른무한) — 슬레이트 회청색 **밝은** 바닥이고, 절벽 구조물은
 *      바닥보다 오히려 **밝은** 뼈빛 금속이다(대조 그림에서 확인).
 *    · 정글·황무지 — 어두운 흙·풀 바닥에 그보다 어두운 바위 절벽.
 *    · 얼음·사막 — 바탕이 아주 밝다.
 *  그래서 밝기 바탕(groundL)과 절벽이 제 땅에서 얼마나 밝아지는가(cliffD)를
 *  타일셋마다 따로 준다. 절벽이 '무조건 어두운 것'이 아니라는 게 이번 손질의 핵이다.
 *
 *  ⚠ 정확한 색은 게임 설치본의 tileset .vr4/.wpe에만 있다(저작물이라 여기 없다) —
 *    이 표는 원작 지도 그림을 눈으로 대조해 맞춘 [어림]이다. */
const TILESET_TONE: [number, number, string, number, number, string, number][] = [
  [80, 16, "hsl(205 42% 20%)", 33, -7, "238,228,198", 11],   // 0 badlands
  [222, 10, "hsl(220 24% 7%)", 40, 10, "255,255,255", 11],   // 1 platform — 슬레이트 금속
  [210, 6, "hsl(210 12% 8%)", 30, 8, "255,255,255", 11],     // 2 install
  [15, 12, "hsl(18 66% 26%)", 28, -6, "240,214,190", 11],    // 3 ashworld
  /* 4 jungle — **투혼 미니맵 그림에서 화소를 직접 읽어 맞췄다**(요청: "투혼 미니맵
     이미지 줄게 픽셀 대조해서 색깔 맞춰봐 타일"). 이름만 보고 초록으로, 다음엔 "두
     지배색이 황토"라는 말에 황토로 옮기며 두 번 빗나간 자리다. 그림이 말하는 것은:
       · 넓이를 지배하는 바닥 — 따뜻한 **갈색 흙**(대략 rgb 139,115,88 = 색상 33·채도
         23·밝기 44). 초록 풀은 그 위에 얼룩으로 흩어져 있지 흙보다 넓지 않다.
       · 절벽 테두리·램프 — 흙보다 **훨씬 밝은 상아빛 모래**(rgb 205,196,170 언저리).
         그래서 이 타일셋만 절벽 몫(cliffD)이 **양수**다: 정글의 절벽은 그늘에 든
         바위가 아니라 햇빛 받는 흰 사암 벼랑이다.
       · 물 — 짙은 청록이 아니라 **연한 청보라**(rgb 106,116,176).
     그리고 고도 한 단의 밝기 걸음(마지막 칸)을 11 → 7로 줄인다: 그림에서 높은 땅과
     낮은 땅의 밝기 차가 크지 않다(가운데 고원이 오히려 어둡다). 걸음을 그대로 두면
     고도 2가 66%까지 떠 흙이 아니라 모래밭이 된다.
     ⚠ **풀은 아직 못 가른다** — 흙인지 풀인지는 타일 그룹의 '지형 종류'가 아는데,
       그 표는 게임 설치본의 cv5에 있고 우리 자료(통행·고도 깃발)에는 없다. 램프 비트를
       실은 것과 같은 길로 굽는 쪽에 그 바이트를 하나 더 실으면 그때 갈린다. */
  [33, 23, "hsl(232 30% 55%)", 40, 14, "214,205,178", 7],     // 4 jungle — 흙 + 상아 벼랑
  [38, 28, "hsl(190 40% 24%)", 42, -8, "255,246,214", 9],    // 5 desert
  [198, 12, "hsl(205 44% 26%)", 48, -10, "255,255,255", 9],  // 6 ice
  [265, 10, "hsl(232 34% 22%)", 31, -6, "235,230,245", 11],  // 7 twilight
];

/** 타일 그룹 번호 → 색.
 *
 *  근거: 타일셋 파일(cv5)의 그룹은 지형 종류 순으로 늘어서 있다. 그래서 번호가 가까우면 같은
 *  지형 계열이고, 번호를 색에 얹으면 같은 계열이 한 색으로 뭉친다. 낮은 번호는 어둡고 푸른
 *  쪽(물·낮은 땅), 높은 번호는 밝고 초록·누런 쪽(언덕 계열)에 둔다.
 *
 *  로그로 눌러 쓴다 — 실제 맵은 낮은 번호 몇 개가 면적을 다 차지하고(투혼: 그룹 2~9가 전체의
 *  4분의 1) 높은 번호 수백 개가 경계 타일 몇 개씩을 나눠 갖는다. 번호를 그대로 쓰면 넓은 면이
 *  전부 같은 색이 되고, 순위로 쓰면(예전 방식) 경계 타일들이 색 대비를 독차지해 화면이
 *  자글자글했다(실측: 투혼이 색종이 눈처럼 보였다). 로그는 그 사이를 잡는다. */
export const GROUP_SCALE = Math.log2(1 + 1024);

export function rampOf(group: number): string {
  const t = Math.min(1, Math.log2(1 + group) / GROUP_SCALE);
  return `hsl(${190 - t * 90} ${14 + t * 22}% ${16 + t * 44}%)`;
}

/** 타일셋 파일(cv5)에서 이 번호 이상의 그룹은 지형이 아니라 장식(doodad)이다 — 나무·바위·
 *  잔해 같은 것들이고, 지형 그룹 1024칸 뒤에 이어 붙는다. 리플레이 격자에도 그대로 들어 있어
 *  투혼에서는 타일의 12.9%가 이것이었다(실측: 최대 그룹 번호 1576).
 *
 *  이걸 지형처럼 칠하면 나무가 온 맵에 밝은 점으로 흩뿌려져 지형이 아예 안 읽힌다(실측).
 *  그래서 '아직 모름'으로 비우고 주변 지형으로 메운다 — 나무 아래도 땅은 이어져 있다. */
const DOODAD_GROUP = 1024;
/** 지운 자리를 주변 최빈값으로 메우는 횟수 — 장식이 뭉쳐 있는 곳도 몇 번이면 채워진다. */
const FILL_PASSES = 4;

/** 지형만 남긴 격자를 만든다 — 장식으로 보이는 종류를 지우고 주변 지형으로 메운 뒤, 남은
 *  점 하나짜리 얼룩을 3×3 최빈값으로 한 번 문지른다.
 *
 *  최빈값을 쓰는 이유: 평균과 달리 없던 종류를 새로 만들지 않아 절벽·벽의 경계가 흐려지지
 *  않는다. 빠른무한처럼 그룹이 몇십 개뿐인 맵은 장식으로 걸리는 종류가 거의 없어 그림이
 *  거의 그대로 남는다(얇은 미네랄 벽이 지워지지 않는 것도 확인했다). */
export function terrainTiles(src: Uint8Array, palette: number[], w: number, h: number): Uint8Array {
  const n = w * h;
  // -1은 '아직 모름'. 장식 자리를 비우고 주변 지형으로 메운다.
  let cur = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    cur[i] = (palette[src[i]] ?? 0) >= DOODAD_GROUP ? -1 : src[i];
  }
  const count = new Int32Array(256);
  const mode = (grid: Int16Array, x: number, y: number, fallback: number): number => {
    let best = fallback;
    let bestN = 0;
    const seen: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const v = grid[yy * w + xx];
        if (v < 0) continue;
        if (count[v] === 0) seen.push(v);
        count[v] += 1;
        // 같은 표를 받으면 가운데 값이 이긴다 — 원래 지형을 함부로 바꾸지 않는다.
        if (count[v] > bestN || (count[v] === bestN && v === fallback)) { best = v; bestN = count[v]; }
      }
    }
    seen.forEach((v) => { count[v] = 0; });
    return best;
  };

  for (let pass = 0; pass < FILL_PASSES; pass += 1) {
    let left = 0;
    const next = new Int16Array(cur);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (cur[i] >= 0) continue;
        const v = mode(cur, x, y, -1);
        if (v < 0) left += 1;
        else next[i] = v;
      }
    }
    cur = next;
    if (left === 0) break;
  }

  const out = new Uint8Array(n);
  // 끝까지 못 메운 자리(장식만 모여 있던 곳)는 원래 값을 쓴다.
  for (let i = 0; i < n; i += 1) out[i] = cur[i] < 0 ? src[i] : cur[i];
  const smoothed = new Uint8Array(n);
  const asI16 = new Int16Array(out);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) smoothed[y * w + x] = mode(asI16, x, y, out[y * w + x]);
  }
  return smoothed;
}

/* ── 지형으로 칠하기(요청) — 타일 그룹 번호가 아니라 **참값 지형**이 색을 정한다 ──────
 *
 * 그룹 번호 램프는 "번호가 가까우면 같은 지형 계열"이라는 어림이었다(위 rampOf 주석).
 * 이제 맵 데이터에서 통행·고도가 참값으로 나오므로 어림할 까닭이 없다: 물인지 땅인지
 * 절벽인지 언덕인지를 **알고** 칠한다.
 *
 * 물과 절벽을 가르는 자 — 둘 다 못 걷는 땅이라 통행만으로는 안 갈린다. 고도가 가른다:
 *   · 못 걷고 고도가 0 → **물·우주**(낮은 데 넓게 퍼진 못 걷는 면)
 *   · 못 걷고 고도가 있음 → **절벽면**(높은 땅의 벽. vf4의 고도 비트가 벽면에도 실린다)
 *   · 걸을 수 있음 → 고도에 따라 밝아지는 **땅**
 *   · 일부만 걸을 수 있음 → **램프**(땅보다 한 뼘 밝고 누렇다)
 * 타일셋이 색 계열을 정한다 — 정글은 초록, 사막은 모래, 얼음은 창백한 파랑, 우주는 잿빛. */
/** 그 칸의 색 — 고도(0~3)·걸을 수 있나·일부만인가로 정한다. */
export function terrainFill(
  tileset: number, level: number, walkable: boolean, partial: boolean,
): string {
  const [hue, sat, water, groundL, cliffD, , levelStep] = TILESET_TONE[tileset] ?? TILESET_TONE[0];
  if (!walkable) {
    /* 고도가 없는 못 걷는 면은 물·우주, 있으면 그 땅의 절벽면이다.
       ★ 재재지적("절벽이 아직도 거의 검은색임") — 밝기만 손대던 두 번의 손질이 다
       실패한 까닭은, **칠한 색이 문제가 아니라 그 위에 얹히는 겹이 문제**였기
       때문이다. 절벽 타일 한 칸은 여기서 칠해진 뒤 세 번 더 어두워진다:
         ① 미니타일 벽 한 겹(못 걷는 칸이므로 통째로) — 검정 0.24
         ② 위 칸에서 내려긋는 3D 벽띠 — 검정 0.4가 칸 높이의 55%를 덮는다
         ③ 그 아래 나머지 — 검정 0.2
       세 겹을 곱하면 21~27%로 칠한 면이 실제 화면에서 9~12%(거의 검정)로 굳는다.
       그래서 이번에는 **칠은 바위색으로 올리고(제 고원 윗면보다 한 단 아래), 겹은
       걷는다**(①·②·③ 모두 옅게 — 아래 drawMapGrid). 그러면 절벽은 '구멍'이 아니라
       그늘에 든 바위면이 되고, 낮은 땅과는 아래 벽띠·마루 테가 갈라 준다.
       기준 — 제 고원 윗면(26+11×고도)에서 한 단(11)의 3분의 2쯤 내린 자리다:
       고도 1 절벽 29% vs 낮은 땅 26% · 제 윗면 37%. 밝기만으로는 낮은 땅과 겨우
       3% 차이지만, 채도를 0.6배로 빼 **색이 죽은 바위**로 갈리게 했다(옛 손질이
       실패한 대목이 여기다 — 밝기만 맞추면 녹고, 채도까지 빼면 갈린다). */
    if (level === 0) return water;
    /* 절벽 밝기 = 제 고원 윗면 + 타일셋의 몫(cliffD). 우주·시설은 +라 바닥보다
       밝은 금속 벽이 되고, 흙·바위 타일셋은 −라 그늘에 든 벽이 된다. 채도는
       어느 쪽이든 0.6배로 빼 '색이 죽은 면'으로 갈리게 한다(밝기만 맞추면
       낮은 땅에 녹는다 — 앞선 두 번의 손질이 그래서 실패했다). */
    const cliffL = Math.max(12, Math.min(78, groundL + level * levelStep + cliffD));
    return `hsl(${hue} ${Math.round(sat * 0.6)}% ${cliffL}%)`;
  }
  const light = groundL + level * levelStep;
  /* 램프는 오르내리는 자리라 **또렷하게** — 지도에서 길목이 먼저 읽혀야 한다.
     ★ 세기를 올렸다(지적: "지금 램프같은거 전혀 표현이 안되서 뭔가 조치가 필요") —
       +8%는 낮은 땅(33%)과 높은 땅(44%) 사이에 파묻히는 값이었다. 램프는 두 고도를
       잇는 **길**이라 어느 쪽 땅과도 안 헷갈려야 하므로, 밝기를 한참 올리고(+16)
       채도도 배로 밀어 흙길처럼 누렇게 뜨게 한다.
     색상 밀기는 **그 땅의 채도만큼만** 한다(실측: 우주(채도 8)에서 30도를 밀었더니
     잿빛 지도에 보라 띠가 떴다). 채도가 낮은 땅은 색을 거의 안 바꾸고 밝기로만
     말하는데, 그런 타일셋(우주·시설)에서는 밝기 차가 곧 길이다. */
  if (partial) {
    /* 채도는 살짝만 올린다(그림 대조: 정글 램프는 **채도 높은 주황**이 아니라 밝은
       상아빛 모래다) — 두 배로 밀었더니 흙길이 아니라 주황 띠가 됐다. */
    const shift = Math.round(20 * Math.min(1, sat / 20));
    return `hsl(${(hue + shift) % 360} ${Math.min(40, Math.round(sat * 1.3))}% ${light + 18}%)`;
  }
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** 격자를 캔버스에 그린다 — **썸네일과 내려받는 그림이 이 한 곳을 함께 쓴다**.
 *
 *  베껴 두면 반드시 갈린다(지적: "색깔이 왜 타일하고 달라" — 색 램프는 베끼고 장식
 *  제거는 안 베껴 두 그림이 달라졌다). 배율(pxPerTile)만 다르고 그림은 같아야 한다.
 *
 *  mt(참값 지형)가 있으면 지형으로 칠하고, 없으면 옛 그룹 램프로 돌아간다(아직 지형을
 *  안 구운 맵). 벽은 지형이 있을 때만 **미니타일(8px) 단위**로 한 겹 더 어둡게 긋는다 —
 *  타일로 그리면 한 칸 굵기의 절벽이 통째로 검게 칠해져 지형이 뭉개진다. */
export function drawMapGrid(
  ctx: CanvasRenderingContext2D,
  grid: { width: number; height: number; palette: number[]; tiles: string;
    resources?: [number, number, 0 | 1][] | null },
  mt: MapTerrainLike | null,
  pxPerTile: number,
  /** 자원 점을 찍나 — 재생 화면의 지도 벡터층만 끈다(요청: "지도벡터 상에 자원 표시는
   *  제거"). 거기에는 **진짜 밭과 간헐천 모델**이 그 자리에 서므로, 밑그림의 점은 같은
   *  것을 두 번 말하면서 모델 밑으로 청록 얼룩만 남긴다. 미니맵·내려받는 PNG·썸네일은
   *  모델이 없으니 이 점이 곧 자원 표시라 그대로 둔다. */
  drawResources = true,
  /** 3D 벽띠(절벽면)의 높이 배수(요청: "3D 모드에서 벽/언덕 높이 지금의 4배로 증가") —
   *  입체(각도) 보기에서만 크게 준다. 이 그림은 미니맵·내려받는 PNG·썸네일도 함께 쓰는데,
   *  거기서는 위에서 곧바로 내려다보는 그림이라 벽이 높으면 고원이 통째로 남쪽으로 밀린
   *  것처럼 보인다 — 높이가 화면 세로에 실리는 사영이라 그렇다(모델의 z와 같은 사정).
   *  그래서 배수는 부르는 쪽이 정한다. */
  wallScale = 1,
): void {
  const { width: w, height: h, palette } = grid;
  const bin = atob(grid.tiles);
  const idxs = new Uint8Array(w * h);
  for (let i = 0; i < idxs.length; i += 1) idxs[i] = bin.charCodeAt(i);

  if (mt && mt.w === w && mt.h === h) {
    /* ══ 지형은 **곡선 벡터**로 칠한다(요청: "맵타일도 연결부를 곡선벡터로 처리") ══
       여태는 칸마다 축에 나란한 사각형을 칠했다. 그래서 물가·절벽선·고도 경계가 전부
       타일 계단이었고, 확대하면 그 계단이 그대로 커졌다.
       이제 갈래마다 **등고선을 뽑아**(마칭 스퀘어) Chaikin으로 깎은 곡선 길을 채운다
       (utils/contour). 지형은 경기 중에 안 변하므로 이 셈은 **굽을 때 한 번**이고,
       그 뒤로는 어느 배율에서도 도형이라 계단이 없다.
       ★ 갈래를 **겹쳐 쌓는다** — 낱낱을 따로 칠하면 곡선끼리 조금씩 어긋나 틈이 벌어진다.
         물 위에 땅 전체, 그 위에 고도 1 이상, 그 위에 2 이상… 순으로 덮으면 경계가
         언제나 맞물린다(포개는 쪽이 이긴다). */
    const n9 = w * h;
    const lvl = new Uint8Array(n9);
    const walk = new Uint8Array(n9);
    const ramp = new Uint8Array(n9);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        lvl[i] = mt.levelAt(x, y);
        walk[i] = mt.walkAt(x, y) ? 1 : 0;
        /* 램프인가 — **원작 자료가 아는 답**이 있으면 그것이다(vf4의 미니타일 고도가
           한 칸 안에서 갈리나 — mapTerrain의 TILE.ramp 주석). 옛 판으로 구운 지도만
           아래 어림으로 물러난다: 그 깃발은 램프와 절벽 가장자리를 못 가르므로,
           **고도가 실제로 갈리는 자리**인가를 두 칸까지 보고 덧붙인다. */
        ramp[i] = mt.rampAt ? (mt.rampAt(x, y) ? 1 : 0) : ((): number => {
          if (!mt.partialAt(x, y) || !mt.walkAt(x, y)) return 0;
          const lv = mt.levelAt(x, y);
          for (let d = 1; d <= 2; d += 1) {
            if (mt.levelAt(x - d, y) !== lv || mt.levelAt(x + d, y) !== lv
              || mt.levelAt(x, y - d) !== lv || mt.levelAt(x, y + d) !== lv) return 1;
          }
          return 0;
        })();
      }
    }
    const P = pxPerTile;
    /** 그 판정의 곡선 길 — 좌표가 타일 단위라 픽셀 배수만 곱하면 된다. */
    const pathOf = (test: (i: number) => boolean): Path2D => maskPath(test, w, h, P);
    /** 물이 아닌 땅(걸을 수 있거나 절벽면) — 이 그림의 바탕 윤곽이다. */
    const isLand = (i: number): boolean => walk[i] === 1 || lvl[i] > 0;
    /* ★ **색은 원작 그림이 정한다**(요청: "투혼 미니맵 이미지 줄게 픽셀 대조해서 색깔
       맞춰봐 타일" · "내가 준 이미지의 초록색류가 풀이야") ────────────────────────
       여태 색은 타일셋마다 손으로 맞춘 표(TILESET_TONE)였다. 그 표로는 흙과 풀을 못
       가른다 — 둘은 통행도 고도도 같아서, 우리가 가진 깃발에는 차이가 없다. 그건
       '지형이 무엇인가'가 아니라 '어느 그림을 깔았나'의 문제라 답이 그림에만 있다.
       이제 굽는 쪽이 타일마다 **원작 타일셋 그림의 평균색**을 실어 준다(판 3).
       쓰는 법은 이렇다:
         · 갈래(물·땅·절벽·램프)의 **윤곽**은 그대로 지형 깃발이 정한다 — 곡선 경계와
           3D 벽띠는 그 구조가 있어야 선다.
         · 그 안을 채우는 **색**은 그 갈래에 든 타일들의 실제 색 **중앙값**이다.
         · 그 위에 타일마다 제 색을 옅게 한 겹 덧칠한다 — 흙 위의 풀 얼룩, 진흙,
           바위처럼 갈래 안에서 갈리는 결이 그 한 겹으로 살아난다.
       판 3이 아닌 옛 지도는 종전 색표로 그대로 물러난다. */
    const realRGB = mt.rgbAt;
    /** 그 갈래에 든 타일들의 실제 색 중앙값 — 평균이 아니라 중앙값인 까닭은, 갈래
     *  안에 섞인 얼룩(풀·바위)이 평균을 끌어당겨 어느 쪽도 아닌 색이 되기 때문이다. */
    const midColor = (test: (i: number) => boolean, fallback: string): string => {
      if (!realRGB) return fallback;
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (!test(y * w + x)) continue;
          const c = realRGB(x, y);
          if (!c) continue;
          rs.push(c[0]); gs.push(c[1]); bs.push(c[2]);
        }
      }
      if (rs.length === 0) return fallback;
      const mid = (a: number[]): number => {
        a.sort((p9, q9) => p9 - q9);
        return a[a.length >> 1];
      };
      return `rgb(${mid(rs)},${mid(gs)},${mid(bs)})`;
    };

    // ① 바탕 — 물·우주로 통째로 깐다. 땅이 그 위를 덮는다.
    ctx.fillStyle = midColor((i) => !isLand(i), terrainFill(mt.tileset, 0, false, false));
    ctx.fillRect(0, 0, w * P, h * P);

    // ② 땅 전체(고도 0 색) + **물가 안쪽 그늘**.
    const landPath = pathOf(isLand);
    /* 물가 그늘 — 땅 윤곽을 굵게 긋고 그 위에 땅을 다시 채운다. 그러면 선의 바깥
       절반만 물 쪽에 남아, 가장자리가 물속으로 가라앉은 것처럼 읽힌다(칸마다 사각형을
       그리던 옛 lip과 같은 뜻이고, 이쪽은 곡선을 따라간다). */
    const lip = Math.max(1, P * 0.22);
    ctx.strokeStyle = "rgba(0,0,0,0.30)";
    ctx.lineWidth = lip * 2;
    ctx.lineJoin = "round";
    ctx.stroke(landPath);
    ctx.fillStyle = midColor((i) => walk[i] === 1 && lvl[i] === 0,
      terrainFill(mt.tileset, 0, true, false));
    ctx.fill(landPath, "evenodd");

    /* ③ 고도를 한 단씩 덮는다 — 덮기 **직전**에 그 단의 **3D 벽띠**를 깐다.
       띠는 '그 단 전체를 아래로 민 그림'이다: 아래로 민 것을 어둡게 칠하고 그 위에
       제 단을 제 색으로 덮으면, 남는 것은 아랫변에서 아래로 뻗은 띠뿐이다 — 곧 우리
       쪽을 보는 절벽면이고, 곡선 윤곽을 그대로 따라간다. */
    const wallUnit = P * 0.55 * wallScale;
    for (let L = 1; L <= 3; L += 1) {
      const has = (): boolean => {
        for (let i = 0; i < n9; i += 1) if (lvl[i] >= L && isLand(i)) return true;
        return false;
      };
      if (!has()) continue;
      const pL = pathOf((i) => lvl[i] >= L && isLand(i));
      // 벽띠 두 겹 — 붙은 쪽이 짙고 바닥으로 갈수록 사라진다.
      ctx.save();
      ctx.translate(0, wallUnit * 0.45);
      ctx.fillStyle = "rgba(6,10,20,0.30)";
      ctx.fill(pL, "evenodd");
      ctx.translate(0, wallUnit * 0.55);
      ctx.fillStyle = "rgba(6,10,20,0.14)";
      ctx.fill(pL, "evenodd");
      ctx.restore();
      ctx.fillStyle = midColor((i) => walk[i] === 1 && lvl[i] === L,
        terrainFill(mt.tileset, L, true, false));
      ctx.fill(pL, "evenodd");
      /* 마루 테 — 절벽선이 위에서 읽히는 자리다. 곡선을 얇게 한 줄 긋는다. */
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.lineWidth = Math.max(1, P * 0.09);
      ctx.stroke(pL);
    }

    /* ④ 절벽면 — 고도가 있는데 못 걷는 칸. 위에서 제 단 색으로 덮였으므로 여기서
       제 색(바위)으로 되칠한다. 단마다 색이 달라 단별로 나눈다. */
    for (let L = 1; L <= 3; L += 1) {
      let any = false;
      for (let i = 0; i < n9; i += 1) if (lvl[i] === L && walk[i] === 0) { any = true; break; }
      if (!any) continue;
      ctx.fillStyle = midColor((i) => lvl[i] === L && walk[i] === 0,
        terrainFill(mt.tileset, L, false, false));
      ctx.fill(pathOf((i) => lvl[i] === L && walk[i] === 0), "evenodd");
    }

    /* ⑤ 램프 — 맨 위다. 두 고도를 잇는 길이라 어느 땅에도 안 묻혀야 한다. */
    for (let L = 0; L <= 3; L += 1) {
      let any = false;
      for (let i = 0; i < n9; i += 1) if (ramp[i] === 1 && lvl[i] === L) { any = true; break; }
      if (!any) continue;
      ctx.fillStyle = midColor((i) => ramp[i] === 1 && lvl[i] === L,
        terrainFill(mt.tileset, L, true, true));
      ctx.fill(pathOf((i) => ramp[i] === 1 && lvl[i] === L), "evenodd");
    }

    /* ⑥ **타일결** — 갈래 안에서 갈리는 무늬를 한 겹 덧칠한다.
       위 칠하기는 지형의 **뜻**(통행·고도)만 보므로 넓은 면이 한 색으로 뭉갠다. 원작에서
       그 자리에 깔린 결 — 흙 위의 풀 얼룩, 진흙, 바위, 격자 이음매 — 은 뜻이 아니라
       '어느 그림을 깔았나'다.
       ★ 판 3(타일 색 층)이 있으면 **그 타일의 실제 색을 그대로** 옅게 얹는다. 흙·풀·
         진흙이 저마다 제 색으로 살아나므로 어림할 것이 없다(요청: "내가 준 이미지의
         초록색류가 풀이야"). 옛 지도만 아래 어림으로 물러난다: 타일 그룹 번호의
         홀짝으로 밝기를 흔들어 격자무늬만 되살린다(밝고 어둠을 해시가 정하면 번갈아
         깐 두 그룹이 우연히 같은 쪽으로 떨어져 무늬가 통째로 사라진다).
       ★ 어느 쪽이든 **땅 윤곽 안에만** 깐다 — 칸 사각형이라 곡선 밖으로 삐치면 애써
         깎은 경계에 계단이 되돌아온다. */
    {
      ctx.save();
      ctx.clip(landPath, "evenodd");
      if (realRGB) {
        ctx.globalAlpha = 0.62;
        for (let y = 0; y < h; y += 1) {
          let runStart = 0;
          let runC = "";
          for (let x = 0; x <= w; x += 1) {
            const c9 = x < w && walk[y * w + x] === 1 ? realRGB(x, y) : null;
            const col = c9 ? `rgb(${c9[0]},${c9[1]},${c9[2]})` : "";
            if (col === runC) continue;
            if (runC) {
              ctx.fillStyle = runC;
              ctx.fillRect(runStart * P, y * P, (x - runStart) * P, P);
            }
            runStart = x;
            runC = col;
          }
        }
        ctx.globalAlpha = 1;
      } else {
        const tiles = terrainTiles(idxs, palette, w, h);
        const lightRGB = (TILESET_TONE[mt.tileset] ?? TILESET_TONE[0])[5];
        const jitter = palette.map((group) => {
          const g = (group * 2654435761) >>> 0;
          const mag = 0.6 + ((g >>> 13) % 1000) / 2500;   // 0.6 ~ 1.0
          return (group & 1) === 1 ? -mag : mag;
        });
        for (let y = 0; y < h; y += 1) {
          let runStart = 0;
          let runJ = 0;
          for (let x = 0; x <= w; x += 1) {
            const on = x < w && walk[y * w + x] === 1 ? (jitter[tiles[y * w + x]] ?? 0) : 0;
            if (on === runJ) continue;
            if (runJ !== 0) {
              ctx.fillStyle = runJ > 0
                ? `rgba(${lightRGB},${(runJ * 0.14).toFixed(3)})`
                : `rgba(22,29,45,${(-runJ * 0.32).toFixed(3)})`;
              ctx.fillRect(runStart * P, y * P, (x - runStart) * P, P);
            }
            runStart = x;
            runJ = on;
          }
        }
      }
      ctx.restore();
    }
  } else {
    // 옛 길 — 타일 그룹 램프(장식 제거·최빈값 다듬기를 거친 격자로).
    const tiles = terrainTiles(idxs, palette, w, h);
    /* 지형이 아직 없는 맵의 임시 길이다 — 이 램프는 타일셋을 모르므로 우주 맵도
       초록으로 나온다(지적). 재분석해 지형이 들어오면 위 갈래가 그 자리를 대신한다. */
    const colors = palette.map((group) => rampOf(group));
    for (let y = 0; y < h; y += 1) {
      let runStart = 0;
      let runIdx = -1;
      for (let x = 0; x <= w; x += 1) {
        const idx = x < w ? tiles[y * w + x] : -2;
        if (idx === runIdx) continue;
        if (runIdx >= 0) {
          ctx.fillStyle = colors[runIdx] ?? colors[0];
          ctx.fillRect(runStart * pxPerTile, y * pxPerTile, (x - runStart) * pxPerTile, pxPerTile);
        }
        runStart = x;
        runIdx = idx;
      }
    }
  }

  /* 자원 지대 — 앞마당·멀티가 어디인지가 이 그림의 쓸모 절반이다. 미네랄은 옅은 청록,
     가스가 낀 곳은 초록. 점 크기는 배율을 따라간다.
     ★ 반 칸 밀림을 걷었다(지적: "맵이미지의 미네랄 가스와 실제 그려진 모델의 위치가
       살짝 다른데 … 근본적인 오류가 있는건 아닌가" — 맞다, 근본 오류였다).
       자원 좌표는 **타일 번호가 아니라 연속 타일 좌표**다: 파서가 screp의 유닛
       픽셀 자리를 32로 나눠 담는다(clusterResources — 예: 2×1 미네랄 밭의 몸
       가운데는 352px = 타일 11.0, 곧 타일 10과 11의 경계다). 그런데 여기서는
       '타일 번호'인 양 +0.5로 칸 가운데를 잡아, 늘 가로세로 반 칸씩 오른아래로
       찍혔다. 모델을 놓는 쪽(ReplayMotionPlayer.posFrac)은 이 값을 그대로
       x/width로 쓰므로 두 그림이 반 칸 어긋났다. 여기서 +0.5를 걷으면 같은 자다. */
  for (const [rx, ry, gas] of (drawResources ? grid.resources ?? [] : [])) {
    ctx.fillStyle = gas ? "rgba(90,220,140,0.9)" : "rgba(140,230,240,0.9)";
    ctx.beginPath();
    ctx.arc(rx * pxPerTile, ry * pxPerTile, Math.max(1, pxPerTile * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 그리는 쪽이 지형에게 물어보는 것들 — mapTerrain의 것을 그대로 받되, 이 파일이
 *  그쪽을 임포트해 순환이 생기지 않게 함수로만 받는다. */
export interface MapTerrainLike {
  w: number;
  h: number;
  tileset: number;
  levelAt: (x: number, y: number) => number;
  walkAt: (x: number, y: number) => boolean;
  partialAt: (x: number, y: number) => boolean;
  /** 램프인가 — **원작 자료가 아는 답**이다(판 2로 구운 지도만 있다). 없으면 아래
   *  isRamp가 옛 어림(고도가 갈리나)으로 물러난다. */
  rampAt?: (x: number, y: number) => boolean;
  /** 그 타일의 **실제 색**(판 3) — 원작 타일셋 그림의 평균이다. 없으면 옛 색표를 쓴다. */
  rgbAt?: (x: number, y: number) => [number, number, number] | null;
  walkAtMini: (mx: number, my: number) => boolean;
}
