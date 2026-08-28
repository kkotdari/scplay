/* ── 맵 데이터에서 뽑은 참값 지형(요청: 지형지도를 자동으로) ────────────────────
 *
 * 여태 지형은 **미니맵 그림의 색을 훑는 어림**이었다(minimapTerrain.ts). 색만 보아서는
 * 램프와 언덕을 못 가르고, 가는 절벽선은 이웃 땅과 섞여 평균색이 물러져 사라진다.
 *
 * 이제 서버가 리플레이 안의 **지도**를 OpenBW로 올려 타일 깃발을 그대로 굽는다
 * (openbw/bwdump.cpp의 `--terrain`). 게임 자신이 쓰는 값이라 램프·벽·언덕이 한 칸도
 * 안 틀리고, 미니타일(8px) 층까지 있어 3D에서 절벽을 세울 수 있다.
 *
 * [꼴 — zlib으로 누른 바이트열, 작은 끝. 굽는 쪽 머리말과 짝이다]
 *
 *   머리   char[4] "OBWM" · u8 판(=1) · u16 가로(타일) · u16 세로(타일)
 *          · u8 타일셋(0~7) · u8 예비
 *   ① 타일 층 — 가로×세로 바이트, 행 우선. 한 타일에 한 바이트:
 *          bit0 걸을 수 있다      bit1 일부만 걸을 수 있다(램프·절벽 가장자리)
 *          bit2 중간 고도         bit3 높은 고도
 *          bit4 아주 높은 고도    bit5 못 짓는 땅
 *          bit6 처음부터 크립     bit7 램프(판 2부터 — 아래 TILE.ramp 주석)
 *   ② 미니타일 통행 층 — (가로×4)×(세로×4) 비트를 행 우선으로 여덟씩 한 바이트에,
 *          **낮은 비트부터**. 벽의 실제 모양이 여기 있다.
 *   ③ 타일 색 층(판 3부터) — 가로×세로 × 3바이트(RGB), 행 우선. 그 타일이 화면에서
 *          실제로 무슨 색인가 — 원작 타일셋 그림(vr4)을 팔레트(wpe)로 푼 평균이다.
 *          흙과 풀은 통행·고도가 같아 깃발로는 못 가른다(요청: "내가 준 이미지의
 *          초록색류가 풀이야") — 답은 그림에만 있고, 이 층이 그 답이다.
 */
import type { TerrainGrid } from "../components/replay/terrainGrid";
import type { MapTerrainLike } from "./mapTiles";

/** 타일 한 칸의 깃발 — 굽는 쪽(bwdump.cpp)의 비트와 같은 이름·같은 자리다. */
export const TILE = {
  walkable: 1 << 0,
  partial: 1 << 1,
  middle: 1 << 2,
  high: 1 << 3,
  veryHigh: 1 << 4,
  unbuildable: 1 << 5,
  creep: 1 << 6,
  /** **램프**(판 2부터) — 한 타일 안에서 걸을 수 있는 미니타일들의 **고도가 갈리는** 칸.
   *
   *  왜 이 비트가 필요했나 — `partial`(일부만 걸을 수 있다)은 램프와 **절벽 가장자리**를
   *  못 가른다. 둘 다 4×4 미니타일 중 일부만 걷는 칸이기 때문이다. 그래서 프론트가
   *  '두 칸 안에서 타일 고도가 갈리나'로 어림했는데, 그 어림은 맵에 따라 통째로
   *  빗나갔다(지적: "램프같은거 전혀 표현이 안되서").
   *  원작 자료에는 답이 그대로 있다: vf4는 **미니타일마다 제 고도**를 든다(OpenBW의
   *  get_ground_height_at이 읽는 그 값이다). 밟고 오르내리는 칸이란 곧 그 고도가
   *  한 칸 안에서 갈리는 칸이고, 절벽 가장자리는 걸을 수 있는 쪽이 한 고도뿐이라
   *  여기 안 걸린다. 굽는 쪽(bwdump --terrain)이 그 셈을 해서 이 비트로 내려 준다.
   *  ★ 판 1로 구운 옛 지도에는 이 비트가 없다(늘 0) — 그때는 프론트가 옛 어림으로
   *    물러난다(mapTiles의 isRamp). */
  ramp: 1 << 7,
} as const;

/** 타일셋 번호 → 이름(0~7) — 굽는 쪽 OpenBW의 차례 그대로다. */
export const TILESET_NAME = [
  "badlands", "platform", "install", "ashworld", "jungle", "desert", "ice", "twilight",
] as const;

export interface MapTerrain {
  /** 타일 단위 크기. */
  w: number;
  h: number;
  /** 타일셋 번호(0~7). */
  tileset: number;
  /** 구운 판(1·2) — 2부터 타일 바이트에 램프 비트가 있다. */
  ver: number;
  /** 타일마다 한 바이트(위 TILE 깃발). 길이 w*h, 행 우선. */
  tile: Uint8Array;
  /** 미니타일(8px) 통행 비트 — (w*4)*(h*4) 비트. 벽의 실제 모양이다. */
  walkBits: Uint8Array;
  /** 타일마다 실제 색 RGB 세 바이트(판 3부터). 옛 판은 null. */
  rgb: Uint8Array | null;
}

/** 그 자리의 고도(0 낮음 · 1 중간 · 2 높음 · 3 아주 높음) — 언덕 판정의 한 자리다. */
export function levelAt(t: MapTerrain, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= t.w || ty >= t.h) return 0;
  const f = t.tile[ty * t.w + tx];
  if (f & TILE.veryHigh) return 3;
  if (f & TILE.high) return 2;
  if (f & TILE.middle) return 1;
  return 0;
}

/** 미니타일(8px) 한 칸을 걸을 수 있나 — 벽의 실제 모양을 보는 자다. */
export function walkAtMini(t: MapTerrain, mx: number, my: number): boolean {
  const mw = t.w * 4;
  if (mx < 0 || my < 0 || mx >= mw || my >= t.h * 4) return false;
  const k = my * mw + mx;
  return (t.walkBits[k >> 3] & (1 << (k & 7))) !== 0;
}

/** base64 → 바이트(atob는 라틴1 문자열을 주므로 코드포인트를 그대로 옮긴다). */
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** zlib 풀기 — 브라우저가 해 준다(참값 트랙과 같은 길). */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error("이 브라우저는 DecompressionStream이 없다");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 서버가 준 base64 지형을 푼다 — 없거나 꼴이 다르면 null(그러면 옛 어림으로 돌아간다). */
export async function decodeMapTerrain(b64: string | null | undefined): Promise<MapTerrain | null> {
  if (!b64) return null;
  try {
    const raw = await inflate(fromBase64(b64));
    if (raw.length < 11) return null;
    if (raw[0] !== 0x4f || raw[1] !== 0x42 || raw[2] !== 0x57 || raw[3] !== 0x4d) return null; // "OBWM"
    /* 판 1·2를 다 받는다 — 2에서 램프 비트(bit7)가 붙었을 뿐 앞의 꼴은 같다.
       옛 판으로 구운 지도는 그 비트가 0이라 그리는 쪽이 옛 어림으로 물러난다. */
    /* 판 1·2·3을 다 받는다 — 2에서 램프 비트, 3에서 타일 색 층이 붙었을 뿐 앞의 꼴은
       같다. 옛 판으로 구운 지도는 그 층이 없어 그리는 쪽이 옛 어림으로 물러난다. */
    const ver = raw[4];
    if (ver < 1 || ver > 3) return null;
    const w = raw[5] | (raw[6] << 8);
    const h = raw[7] | (raw[8] << 8);
    const tileset = raw[9];
    if (!(w > 0) || !(h > 0) || w > 512 || h > 512) return null;
    const tileAt = 11;
    const tileLen = w * h;
    const bitsLen = ((w * 4) * (h * 4) + 7) >> 3;
    if (raw.length < tileAt + tileLen + bitsLen) return null;
    const rgbAt = tileAt + tileLen + bitsLen;
    const hasRgb = ver >= 3 && raw.length >= rgbAt + tileLen * 3;
    return {
      w, h, tileset, ver,
      tile: raw.subarray(tileAt, tileAt + tileLen),
      walkBits: raw.subarray(tileAt + tileLen, rgbAt),
      rgb: hasRgb ? raw.subarray(rgbAt, rgbAt + tileLen * 3) : null,
    };
  } catch {
    return null;
  }
}

/** 재생·길찾기가 쓰는 격자로 옮긴다 — 옛 어림(TerrainGrid)과 **같은 꼴**이라 쓰는 쪽은
 *  아무 것도 안 바꿔도 된다. 좌표계도 같다(0~1 분수를 격자 칸으로 나눠 쓴다).
 *
 *  · walk — 타일이 걸을 수 있나. **일부만 걸을 수 있는 칸(램프·절벽 가장자리)도 걷는다**:
 *    게임에서 유닛은 그 칸을 지나다닌다. 막는 것은 아예 못 걷는 칸뿐이다.
 *  · high — 높은 땅(고도 2 이상). 낮은 데서 높은 데를 쏘면 빗나가는 원작 규칙이 이걸 본다.
 *  · creep — **크립이 못 앉는 칸**이다(요청: 램프·다리). 램프가 곧 그 자리다.
 *
 *  ★ 사람이 손으로 고치는 층은 **없다**(요청: "지형편집기능 자체 제거") — 이 값은 게임
 *    자신이 쓰는 참값이라 고칠 자리가 없다. 옛 판에는 그림 색을 훑은 어림 위에 사람이
 *    칠하는 덮개가 있었는데, 그건 어림이 틀리기 때문에 있던 것이다.
 */
export function terrainGridOfMap(t: MapTerrain): TerrainGrid {
  const n = t.w * t.h;
  const walk = new Uint8Array(n);
  const high = new Uint8Array(n);
  const creep = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const f = t.tile[i];
    walk[i] = (f & (TILE.walkable | TILE.partial)) ? 1 : 0;
    high[i] = (f & (TILE.high | TILE.veryHigh)) ? 1 : 0;
    creep[i] = (f & TILE.partial) ? 1 : 0;
  }
  return { w: t.w, h: t.h, walk, high, creep };
}

/* ── 원작 그림의 평균색 → **화면에 쓸 색**(지적: "유니크헌터 색깔이 너무 다르지 타일
   색 매핑이 잘못된듯") ────────────────────────────────────────────────────────────
   매핑은 맞았다 — 실측으로 확인했다. 정글 타일셋의 그림을 vx4→vr4→wpe로 풀어 메가타일
   평균을 내면 흙 (79,66,49) · 물 (38,38,57) · 풀 (33,38,11)이 나오고, 그 값은 그림을
   직접 32×32로 펴서 잰 평균과 **한 톨도 안 다르다**. 곧 굽는 쪽에는 잘못이 없다.
   문제는 그 값이 **화면에 쓰기엔 너무 어둡다**는 것이다. 원작 타일 그림은 어두운 바탕에
   밝은 점을 뿌려 결을 내는데(풀밭은 짙은 녹색 바탕에 밝은 풀잎), 그 점들이 평균에서
   묻히면 남는 것은 바탕색뿐이라 지도가 통째로 진흙빛이 된다. 지도 미리보기(사용자가
   준 KeSPA 헌터맵 그림)나 원작 미니맵이 훨씬 밝고 선명한 까닭이 이것이다.
   그래서 평균 위에 **두 손잡이**를 태운다:
     · 감마(SHOW_GAMMA) — 어두운 쪽을 끌어올린다. 0.55는 흙 (79,66,49)을 (140,127,110)
       언저리로 올려 미리보기의 흙과 눈금이 맞는 값이다.
     · 채도(SHOW_SAT) — 감마는 흰 쪽으로 미는 셈이라 색이 함께 바랜다(1.0으로 두면
       풀이 올리브빛 잿빛이 된다). 밝기(휘도)는 두고 색만 다시 벌린다.
   둘 다 **그리는 쪽 손잡이**다 — 자취를 다시 굽지 않고 여기서 고칠 수 있다. */
/** 어두운 쪽 끌어올리기(1이면 원본 그대로). */
const SHOW_GAMMA = 0.55;
/** 색 벌리기 — 휘도는 그대로 두고 채도만 곱한다(1이면 그대로). */
const SHOW_SAT = 1.8;
const SHOW_LUT = ((): Uint8Array => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) t[i] = Math.round(255 * (i / 255) ** SHOW_GAMMA);
  return t;
})();
const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
function showRGB(r0: number, g0: number, b0: number): [number, number, number] {
  const r = SHOW_LUT[r0];
  const g = SHOW_LUT[g0];
  const b = SHOW_LUT[b0];
  // 휘도는 Rec.601 — 색만 벌리고 밝기는 안 건드린다.
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clamp255(l + (r - l) * SHOW_SAT),
    clamp255(l + (g - l) * SHOW_SAT),
    clamp255(l + (b - l) * SHOW_SAT),
  ];
}

/** 그리는 쪽(mapTiles.drawMapGrid)이 쓰는 얼굴로 감싼다 — 그쪽이 이 파일을 임포트하면
 *  순환이 되므로 함수 묶음만 넘긴다. */
export function terrainFace(t: MapTerrain): MapTerrainLike {
  return {
    w: t.w, h: t.h, tileset: t.tileset,
    levelAt: (x, y) => levelAt(t, x, y),
    walkAt: (x, y) => (x < 0 || y < 0 || x >= t.w || y >= t.h
      ? false : (t.tile[y * t.w + x] & (TILE.walkable | TILE.partial)) !== 0),
    partialAt: (x, y) => (x < 0 || y < 0 || x >= t.w || y >= t.h
      ? false : (t.tile[y * t.w + x] & TILE.partial) !== 0),
    /** 그 타일의 **실제 색**(판 3) — 없으면 undefined라 그리는 쪽이 옛 색표로 물러난다.
     *  값은 원작 그림의 평균에 아래 화면 곡선(SHOW_*)을 태운 것이다. */
    rgbAt: t.rgb
      ? (x, y) => {
        if (x < 0 || y < 0 || x >= t.w || y >= t.h) return null;
        const o = (y * t.w + x) * 3;
        return showRGB(t.rgb![o], t.rgb![o + 1], t.rgb![o + 2]);
      }
      : undefined,
    /** 램프인가 — 판 2로 구운 지도만 답을 안다. 옛 판은 null이라 그리는 쪽이 어림한다. */
    rampAt: t.ver >= 2
      ? (x, y) => (x < 0 || y < 0 || x >= t.w || y >= t.h
        ? false : (t.tile[y * t.w + x] & TILE.ramp) !== 0)
      : undefined,
    walkAtMini: (mx, my) => walkAtMini(t, mx, my),
  };
}
