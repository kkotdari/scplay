/* ── 모델 메시 수집(2026-09) ─────────────────────────────────────────────────────
   빌더를 요잉 0·평면 시점으로 한 번 돌리고, 면마다 곁표(MESH9.byD)에 적힌 3D 폴리곤을 모아 **판 모형 공간 메시**를
   낸다. GPU 붓(WebGL)·자료 도구의 재료다. 음영 덧칠 면(#fff/#000 얕은 알파, 화면 곡선 그림자)은 GPU 조명이 대신하므로
   버린다. 임자색 면(fill 없음)은 fill "" 로 두어 붓이 임자색으로 바꿔 칠한다. */
import { MESH9, EMIT_FILL9, withTopView, withYaw, bake, zsorted, BILLBOARD9, type ShapeFace, type Poly3 } from "./shapeOblique";
/* 빌보드 표식은 **shapeOblique 가 든다** — 빌더가 제 손으로 빌보드를 놓을 수 있어야 하고
   (billPath3), 그 표식을 여기서만 쥐면 빌더가 빌보드를 못 놓는다. 쓰던 이름은 그대로 낸다. */
export { BILLBOARD9 };

/** 2D 굽기가 반투명 **색 있는** 면에 얹던 알파 보정 — bake9.shadeBoost 와 **같은 식이어야 한다**(여기서 베낀 까닭은
 *  mesh9 ← bake9 로 되짚는 import 를 안 만들려고다). 이것을 안 태우면 GL 의 음영 덧칠이 2D 보다 1.25배 옅어
 *  모델이 통째로 납작해 보인다(실측: 그 자리가 "GL 이 덜 아름답다"의 큰 몫이었다). */
const shadeBoost9 = (o: number, fill?: string): number => (fill && o < 1 ? Math.min(0.7, o * 1.25) : o);
/** 되찾은 **원**의 조각 수(고리·빌보드 원반·땅 원반) — 2D 는 진짜 호를 칠하므로 둘레가 매끈한데, 메시는 조각이 적으면
 *  각이 보인다(실측: 16 조각이면 핵 충격파·워프인 둘레가 다각형으로 읽혔다). 32 면 둘레가 눈에 둥글고, 이 면들은
 *  효과·장식 몇 장뿐이라 삯이 없다. */
/** 두 경로의 **상자 넓이 비**(덧칠/몸, 상한 1) — 경로의 숫자만 훑어 상자를 낸다(요잉 0 의 화면 좌표라 비만 쓴다). */
function areaK9(dOv: string, dBody?: string): number {
  if (!dBody) return 1;
  const box9 = (d: string): number => {
    const n = d.match(/-?\d+(?:\.\d+)?/g);
    if (!n || n.length < 4) return 0;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = +n[i]; const y = +n[i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  };
  const b9 = box9(dBody);
  if (!(b9 > 0)) return 1;
  return Math.min(1, box9(dOv) / b9);
}

/* ── (걷어냄) 경로 문자열 → 3D 메시 되돌리기 ─────────────────────────────────────────
   ★★ **승격하는 과정을 없앴다**(2026-09, 요청: "우회로 없애고 설계도도 짓는 것도 3D 로 통일해서
   승격하는 과정 없앨 수 있어?" → "게이트로 검사하는 것과 … 2D 로 시작할 이유가 없어 보이는데").
   여기 있던 `meshFromPath9` 는 빌더가 **화면 자로 손수 짠 경로**(구 껍질 screenCircle · 땅 원
   groundEllipse · 고리 annulus · 얼룩 · 초승달)를 글자로 도로 읽어 3D 를 지어 내는 자였다. 곧
   '2D 로 짓고 3D 로 승격한 뒤 다시 2D 로 사영하는' 세 걸음의 가운데였다.
   그 길이 왜 위험했나: 되찾기는 **경로만** 본다. 반지름 둘이 2% 넘게 다르면 공을 땅에 누운
   판때기로 읽었고(사이언스 베슬의 몸통이 그랬다), 관이 적어 둔 빈 표를 만나면 엉뚱한 낯을
   구로 되살렸고, 한때는 이웃의 높이를 빌려 장식을 딴 부품 위에 띄웠다.
   고칠 자리는 늘 **그 헬퍼·빌더가 3D 를 적는 것**이었다 — 786면에서 시작해 셋으로 나눠 옮겼다:
   프리미티브(cylinderFaces3 의 뚜껑 한 줄이 195면) · 새 3D 헬퍼(discPath3·annulusPath3·orbPath3·
   billPath3·shinePath3·shellMesh9) · 빌더의 손 면(파일런 링·포지 띠·크립 얼룩·스포어 아가리).
   **0 이 된 날 이 함수와 PROJ9·unproject9 를 다 지웠다.**
   이제 규약은 하나다: **면을 내는 자가 3D 를 함께 적는다**(`meshPut9`). 안 적으면 그 면은
   되살아나지 못하고 **그냥 빠지고**, 덮임 표(`node scripts/model-mesh.mjs --check`)가 곧 잡는다.
   어느 줄이 안 적었는지는 `node scripts/miss-sites.mjs` 가 짚어 준다. */

/** 부품 — ow/ob 는 그 면 위에 얹혀 있던 음영 덧칠(흰·검 얕은 알파, 같은 경로의 topFace/sideFace/faceLight)을 접은 몫(0~1). */
export interface MeshPart9 { polys: Poly3[]; fill: string; alpha: number; team: boolean; lod: number; ow: number; ob: number; /** 빌보드 원반 부품(카메라를 본다) */ bb?: boolean;
  /** 그 부품을 낸 면의 경로 — 덧칠을 접을 때 **넓이 몫**을 재는 자다(아래 areaK9). */ d?: string;
  /** **닫힌 입체**의 낯인가 — 붓이 그 낯만 뒷면을 걸러낸다(아래 solidSigns9). */ solid?: boolean;
  /** 그 낯의 감기가 **안쪽**을 보나 — 참이면 붓이 법선을 뒤집는다(부품의 과반). */ flip?: boolean;
  /** 폴리마다의 그 값 — 한 부품 안에서도 감기가 섞인다(헬퍼가 면을 되쓴 자리). 붓은 이것을 먼저 본다. */ flips?: boolean[];
  /** **빛을 내는 부품**인가 — 붓의 번짐(블룸)이 이 부품만 한 번 더 그려 흐린다(켠 창·플라즈마·발광 효과). */
  emit?: boolean }
export interface Mesh9 { parts: MeshPart9[]; faces: number; covered: number; skipped: number;
  /** 빠진 낯들의 경로 — 어느 줄이 3D 를 안 적었는지 짚는 실마리(scripts/miss-sites.mjs 가 이것으로 빌더 줄을 찾는다). */ missPaths: string[];
  /** 헬퍼가 **일부러 비워 둔** 면 수 — rodFaces 는 관 하나를 첫 낯에 몰아 적고 나머지 낯(둘째 끝·몸통)에는
   *  빈 표를 적는다. 그 낯은 빠진 것이 아니라 이미 딴 낯이 낸 것이라, 덮임 셈의 분모에서 뺀다. */
  blank: number;
  /** 3D 로 되찾지 못해 **빠진** 면의 경로(앞 12개까지) — GL 에서 사라진 부품을 찾는 자다(model-mesh --dump). */
  missed: string[] }

/** #rgb·#rrggbb 휘도(0~1). 못 읽으면 0.5. */
export const lum9 = (fill: string): number => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return 0.5;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16) / 255; const g = parseInt(h.slice(2, 4), 16) / 255; const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** #rgb·#rrggbb 채도(최대 − 최소 성분, 0~1). 못 읽으면 0. */
export const chroma9 = (fill: string): number => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill); if (!m) return 0;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return Math.max(...v) - Math.min(...v);
};
/** 폴리 하나의 뉴얼 벡터(길이 = 넓이×2)와 가운데. */
function face9(p: Poly3): { n: [number, number, number]; c: [number, number, number] } {
  const k = p.length / 3;
  let nx = 0; let ny = 0; let nz = 0; let cx = 0; let cy = 0; let cz = 0;
  for (let i = 0; i < k; i += 1) {
    const j = (i + 1) % k;
    const px = p[i * 3]; const py = p[i * 3 + 1]; const pz = p[i * 3 + 2];
    const qx = p[j * 3]; const qy = p[j * 3 + 1]; const qz = p[j * 3 + 2];
    nx += (py - qy) * (pz + qz); ny += (pz - qz) * (px + qx); nz += (px - qx) * (py + qy);
    cx += px; cy += py; cz += pz;
  }
  return { n: [nx, ny, nz], c: [cx / k, cy / k, cz / k] };
}
/** ★ **닫힌 입체 판정 + 낯마다의 안·바깥**(2026-09) ─────────────────────────────────────────────────
 *  2D 는 화가 차례로 그려 속면이 늘 나중 면에 덮였다. GL 은 진짜 깊이라 **속면이 이길 수 있다**(실측: 셔틀 말굽
 *  집게의 속벽이 몸통을 덮었다). 속이 막힌 덩이는 속을 볼 일이 없으니 붓이 뒷면을 걸러내면 그 겹침이 사라진다.
 *  판정과 방향을 한 번에 낸다:
 *    ① **다양체**여야 한다 — 모든 모서리를 정확히 두 낯이 나눠 쓴다(열린 껍질·한 장짜리 장식은 여기서 떨어진다).
 *    ② 감기 차례는 헬퍼마다 뒤섞여 있다(뿔의 뚜껑·돔의 밑판) — 그래서 이웃을 타고 **번져 가며 맞춘다**(BFS):
 *       공유 모서리를 두 낯이 **같은 방향**으로 돌면 한쪽이 거꾸로다.
 *    ③ 맞춘 방향으로 부호 있는 부피(발산 정리 Σ(c·n)/6)를 재서 음수면 전부 뒤집는다 — 그러면 법선이 바깥을 본다.
 *  돌려주는 것은 폴리마다의 부호(+1 그대로 · −1 뒤집기)이고, 다양체가 아니거나 안·바깥이 없으면(뫼비우스) null 이다. */
function solidSigns9(polys: Poly3[]): number[] | null {
  if (polys.length < 4) return null;
  const key9 = (a: number[], i: number): string => `${a[i].toFixed(3)},${a[i + 1].toFixed(3)},${a[i + 2].toFixed(3)}`;
  /** 모서리(무방향) → [낯 번호, 그 낯이 돈 방향(a<b 면 +1)] 짝 둘 */
  const edges = new Map<string, [number, number][]>();
  for (let f = 0; f < polys.length; f += 1) {
    const p = polys[f];
    const n = p.length / 3;
    if (n < 3) return null;
    for (let i = 0; i < n; i += 1) {
      const a = key9(p, i * 3); const b = key9(p, ((i + 1) % n) * 3);
      if (a === b) continue;
      const fwd = a < b;
      const k = fwd ? `${a}|${b}` : `${b}|${a}`;
      const got = edges.get(k);
      if (got) { if (got.length >= 2) return null; got.push([f, fwd ? 1 : -1]); } else edges.set(k, [[f, fwd ? 1 : -1]]);
    }
  }
  for (const v of edges.values()) if (v.length !== 2) return null;   // 열린 자리 — 껍질이다
  const sign = new Array<number>(polys.length).fill(0);
  const adj = new Map<number, [number, number][]>();   // 낯 → [이웃 낯, 같은 방향인가]
  for (const v of edges.values()) {
    const f0 = v[0][0]; const d0 = v[0][1]; const f1 = v[1][0]; const d1 = v[1][1];
    (adj.get(f0) ?? adj.set(f0, []).get(f0))!.push([f1, d0 === d1 ? 1 : 0]);
    (adj.get(f1) ?? adj.set(f1, []).get(f1))!.push([f0, d0 === d1 ? 1 : 0]);
  }
  sign[0] = 1;
  const q = [0];
  let seen = 1;
  while (q.length) {
    const f = q.pop()!;
    for (const [g, same] of adj.get(f) ?? []) {
      // 같은 방향으로 돌았으면 감기가 거꾸로다 → 부호를 뒤집는다.
      const want = same ? -sign[f] : sign[f];
      if (sign[g] === 0) { sign[g] = want; seen += 1; q.push(g); }
      else if (sign[g] !== want) return null;   // 안·바깥이 없다
    }
  }
  if (seen !== polys.length) return null;   // 덩이가 둘 이상 — 한 뭉치로 다루지 않는다
  let v9 = 0;
  for (let f = 0; f < polys.length; f += 1) {
    const fc = face9(polys[f]);
    v9 += sign[f] * (fc.c[0] * fc.n[0] + fc.c[1] * fc.n[1] + fc.c[2] * fc.n[2]) / 6;
  }
  if (v9 < 0) for (let f = 0; f < polys.length; f += 1) sign[f] = -sign[f];
  return sign;
}
/** 음영 덧칠(조명 흉내) 면 — GPU 에선 조명이 대신한다. 얕은 알파(<0.4)의 아주 밝거나(광) 아주 어두운(그늘) 면만
   걸러 낸다 — 종족 광택 색(#0d1016·#1a1708·#fff3cf…)도 여기 든다. 진한 검·흰 부품(알파 1)은 남긴다. */
export const isOverlay9 = (f: ShapeFace): boolean => {
  const fill = f[2]; const a = f[1];
  if (typeof fill !== "string" || a >= 0.4) return false;
  /* ★ **색이 짙은 면은 덧칠이 아니라 몸이다**(2026-09) — 휘도만 보면 네온 초록(가스 #80ff96, 휘도 0.86)·
     네온 하늘 같은 **밝은 색 몸**이 덧칠로 접혀 사라진다(실측: 간헐천의 고인 가스와 초록 김 셋이 통째로
     사라져 돌그릇만 남았다 — GL 화소가 2D 의 3분의 2였다).
     음영 덧칠은 회색 계열이다(흰·검, 종족 광택색 #0d1016 채도 0.04 · #1a1708 0.07 · #fff3cf 0.19).
     채도(최대−최소 성분) 0.25 를 문턱으로 두면 그 다섯은 남고 네온색(0.50)은 몸으로 간다. */
  if (chroma9(fill) > 0.25) return false;
  const L = lum9(fill);
  return L < 0.2 || L > 0.8;
};

/** 빌더 하나를 요잉 0 평면 시점으로 굽고 메시로 모은다. 굽는 동안만 메시 기록을 켠다. */
/** glow: 발광 효과(아콘·워프인·폭풍·핵) — 반투명 흰·검 면이 음영 덧칠이 아니라 **그 자체가 몸**(빛무리·구 껍질)이다.
 *  같은 경로에 몸이 있을 때만 접고, 나머지는 반투명 부품으로 남긴다(보통 종류에서는 비쳐 보이게 만드는 바로 그 규칙). */
export function collectMesh9(builder: () => ShapeFace[], filter?: (faces: ShapeFace[]) => ShapeFace[], glow = false): Mesh9 {
  MESH9.on = true; MESH9.byD.clear();
  let faces: ShapeFace[];
  /* ★ 고르개(filter)는 **굽는 안에서** 돈다 — 건설 단계(stageFaces)가 고르기만 하던 때는 밖에서
     돌아도 됐지만, 이제 그 자리에서 **면을 더 짓기도 한다**(공사 발판 탑). 밖에서 지으면
     ① MESH9 가 꺼져 있어 3D 를 못 적고(그 면이 GL 에서 통째로 빠진다) ② 카메라·요잉 감싸개가
     이미 풀려 2D 경로가 딴 자로 난다. 안에서 돌면 빌더와 똑같은 자를 쓴다. */
  try {
    faces = withTopView(() => bake(() => withYaw(0, () => {
      const f9 = builder();
      return filter ? filter(f9) : f9;
    })));
  } finally { MESH9.on = false; }
  faces = zsorted(faces);   // 2D 와 같은 화가 차례(깊이 키) — 부품 차례 편향(aOrd)의 자다
  const parts: MeshPart9[] = [];
  const byD = new Map<string, number>();    // 경로 → 그 경로로 마지막에 난 부품(덧칠을 접을 첫째 자리)
  const byPid = new Map<number, number>();  // 부품 번호(ShapeFace[5]) → 그 부품의 마지막 몸 면(둘째 자리)
  let covered = 0; let skipped = 0; let blank = 0; const missed: string[] = []; const missPaths: string[] = [];
  /** 부품마다의 **뭉치 번호**(tagKey 의 pid) — 아래에서 같은 뭉치를 모아 닫힌 입체인가를 잰다. */
  const pidAt: (number | undefined)[] = [];
  /** 이 면의 3D 폴리 찾기 — 곁표(헬퍼가 적어 둔 것) → 손수 짠 경로 되찾기 → 여러 조각 이어 붙인 경로.
   *  되찾기는 MESH9.byD 에 적어 두므로 두 번째 호출은 표 읽기뿐이다(아래 몸 상자 앞잡이가 그 값을 쓴다). */
  const geomOf9 = (f: ShapeFace): Poly3[] | undefined => {
    const had9 = MESH9.byD.get(f[0]);
    /* ★ **빈 표는 '못 적었다'가 아니라 '적을 것이 없다'는 말이다**(2026-09, 지적: "탱크 오른쪽 좀
       떨어진 곳에 구슬이 있어 뭐지") — 관·막대 헬퍼는 제 메시를 **첫 낯 하나에 몰아** 적고 나머지
       낯에는 빈 표(`meshPut9(d, [])`)를 적어 '이건 딴 낯이 낸다'고 표시한다. 그것을 `없음` 과
       똑같이 보면 안 된다: 한때 그 낯들이 되찾기로 넘어가 엉뚱한 구슬로 되살아났다(시즈 차체
       기동륜의 뒤쪽 끝 원반이 모델 밖 y −7.4 에 떠 있었다). 되찾기를 걷은 지금도 규약은 같다 —
       **빈 표는 그냥 둔다**(딴 낯이 낸다), **없음**은 빠진 면이다.
       ⚠ 이제 없음을 메워 주는 자가 없다 — 면을 내는 자가 `meshPut9` 를 안 적었다는 뜻이고,
         덮임 표(`model-mesh --check`)가 잡는다. 어느 줄인지는 `scripts/miss-sites.mjs`. */
    let polys = had9;
    /* 여러 조각을 이어 붙인 경로(라바의 마디 사슬 따위)는 조각마다 곁표에 제 3D 가 있다 — 나눠 찾아 합친다. */
    if (had9 === undefined && f[0].indexOf("Z M") > 0) {
      const acc: Poly3[] = [];
      for (const piece of f[0].split(/(?<=Z) (?=M)/)) { const q = MESH9.byD.get(piece); if (q) acc.push(...q); }
      if (acc.length) polys = acc;
    }
    return polys && polys.length ? polys : undefined;
  };
  /* ★ **불투명 몸의 상자**를 먼저 잰다(2026-09) — 몸 없는 덧칠(제 pid 에 몸 면이 없는 데칼)을 제 부품으로
     남길지 가리는 자다. 되찾기가 틀려 몸 **밖으로 튄** 것은 2D 에서 몸 안에 있던 무늬이므로 버린다
     (실측: 라바 등의 마디 구슬이 사영 되짚기에서 z 를 잘못 빌려 몸 위 허공에 사슬로 떴다).
     굴리며 재면(앞 면들만) 몸보다 먼저 칠하는 데칼이 통째로 걸러진다 — 그래서 앞잡이로 한 번 다 돈다. */
  const bb9 = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    if (f[1] < 0.98 || isOverlay9(f)) continue;
    const ps9 = geomOf9(f);
    if (!ps9) continue;
    for (const q9 of ps9) for (let i9 = 0; i9 + 2 < q9.length; i9 += 3) {
      if (q9[i9] < bb9[0]) bb9[0] = q9[i9]; if (q9[i9] > bb9[3]) bb9[3] = q9[i9];
      if (q9[i9 + 1] < bb9[1]) bb9[1] = q9[i9 + 1]; if (q9[i9 + 1] > bb9[4]) bb9[4] = q9[i9 + 1];
      if (q9[i9 + 2] < bb9[2]) bb9[2] = q9[i9 + 2]; if (q9[i9 + 2] > bb9[5]) bb9[5] = q9[i9 + 2];
    }
  }
  /** 그 기하가 몸 상자 안에 드나 — 되찾기가 틀려 몸 밖으로 튄 덧칠을 걸러 낸다. */
  const inBody9 = (ps: Poly3[]): boolean => {
    if (bb9[3] < bb9[0]) return false;
    /* 여유는 **몸 크기에 비례**한다 — 땅에 번지는 얼룩(저그 둔덕·주둥이)은 몸 상자보다 조금 넓은 것이 맞고,
       되찾기가 틀려 튄 것은 그보다 한참 멀리 간다. 0.4 + 상자 지름의 12%. */
    const M9 = 0.4 + 0.12 * Math.max(bb9[3] - bb9[0], bb9[4] - bb9[1], bb9[5] - bb9[2]);
    for (const q9 of ps) for (let i9 = 0; i9 + 2 < q9.length; i9 += 3) {
      if (q9[i9] < bb9[0] - M9 || q9[i9] > bb9[3] + M9) return false;
      if (q9[i9 + 1] < bb9[1] - M9 || q9[i9 + 1] > bb9[4] + M9) return false;
      if (q9[i9 + 2] < bb9[2] - M9 || q9[i9 + 2] > bb9[5] + M9) return false;
    }
    return true;
  };
  for (const f of faces) {
    const polys = geomOf9(f);
    const has9 = !!polys && polys.length > 0;
    if (isOverlay9(f) && (!glow || byD.has(f[0]))) {
      /* ★ 음영 덧칠은 **몸에 접거나 · 제 부품으로 남기거나 · 버린다**. 접을 몸을 두 자로 찾는다:
           ① 같은 경로 — faceLight().face(d) 처럼 몸과 똑같은 패스로 얹히는 덧칠(대부분).
           ② 같은 부품 번호(tagKey 가 붙인 pid)의 **마지막 몸 면** — 제 꼴을 가진 그늘(원통 옆 그림자·돔 초승달·단면)은
              경로가 달라 ①로는 못 찾는다. 2D 는 그 그늘을 바로 앞 몸 위에 얹으므로, 같은 부품의 마지막 몸이 곧 그 자리다.
         ★ **몸보다 작고 제 기하가 있는 그늘은 접지 않는다**(2026-09) — 접기는 부품 **전체**에 같은 세기를 먹이는 손이라,
           2D 가 한 자리에만 칠한 그늘을 접으면 그 자리는 옅어지고 나머지가 괜히 어두워져 결이 뭉개진다(실측: 셔틀 돔
           뒤의 그늘 25%가 넓이 몫 0.2 로 눌려 5%가 되자 돔이 통째로 파랗게 떴다). 그런 그늘은 얇은 판이라 GL 도 그대로
           그릴 수 있다: 반투명 한 장짜리라 데칼로 잡혀 깊이 편향을 받고(gl9 isDecal), 불투명 몸 위에 섞인다.
           되찾을 기하가 **없으면**(종족 광택의 초승달 같은 손 경로) 종전처럼 넓이 몫만큼 접는다 — 안 접으면 통째로 사라진다.
         몸도 없고 기하도 없으면 버린다(땅에 깔리는 그림자 고리). */
      const same9 = byD.get(f[0]);
      const at = same9 ?? (f[5] !== undefined ? byPid.get(f[5]) : undefined);
      const k9 = at === undefined ? 1 : (same9 !== undefined ? 1 : areaK9(f[0], parts[at].d));
      /* ★★ **제 경로를 가진 그늘은 제 부품으로 남긴다**(2026-09, 지적: "배럭 벤트의 가로 줄이 없어짐") —
         여태 문이 `k9 < 0.6`(상자 넓이 비)이었는데, `areaK9` 는 **그 pid 의 마지막 몸**과 견주는 자라
         몸이 작으면 1 이 나온다. 그래서 벤트의 가로 살처럼 **제 경로로 또렷이 그린 줄**이 판에 통째로
         접혔다(실측: 배럭에서 경로가 다른데 k9 ≥ 0.6 으로 접힌 그늘 37장 — 그 안에 벤트 살이 있다).
         접으면 줄이 아니라 '조금 어두운 판'이 되므로 줄 자체가 사라진다.
         ★ 가름의 자는 **둘**이다: ① 몸과 **같은 경로**로 얹힌 그늘(faceLight 의 낯 음영)은 그 낯 전체의
           밝기이므로 접는 것이 옳다. ② 제 경로를 가진 그늘 중에서도 **작은 것만** 남긴다 — 제 크기가
           데칼 자(모형 2.8칸) 안일 때다.
         ⚠ 큰 것까지 남기면 **판이 허옇게 뜬다**(실측: 배럭 나쁨 0.21 → 0.26) — 벽 한 장을 통째로 덮는
           그늘은 `isDecal` 의 크기 문에 안 걸려 깊이 편향을 못 받고, 몸과 **같은 평면**이라 깊이 싸움에서
           져 아예 안 그려진다. 곧 접어야만 보이는 몫이다. 작은 줄은 데칼이라 편향을 받아 제대로 얹힌다. */
      /** 폴리 뭉치의 3D 상자 지름(모형 칸). */
      const diag9 = (qs: Poly3[]): number => {
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
        for (const q of qs) for (let i = 0; i + 2 < q.length; i += 3) {
          if (q[i] < x0) x0 = q[i]; if (q[i] > x1) x1 = q[i];
          if (q[i + 1] < y0) y0 = q[i + 1]; if (q[i + 1] > y1) y1 = q[i + 1];
          if (q[i + 2] < z0) z0 = q[i + 2]; if (q[i + 2] > z1) z1 = q[i + 2];
        }
        return x1 < x0 ? 0 : Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      };
      /* 남길 자: **한 장짜리이고 데칼 자(2.8칸) 안**일 때다 — gl9 의 isDecal 과 같은 문이라, 남긴 것이
         반드시 깊이 편향을 받아 몸 위에 얹힌다(문이 어긋나면 남겨 놓고 못 그린다).
         ⚠ '얹힐 몸의 절반보다 작을 것'을 더해 봤지만 **줄이 도로 죽었다** — `byPid` 가 가리키는 것은
           그 뭉치의 **마지막** 몸이라 판이 아닐 수 있어서, 크기 견줌의 기준이 엉뚱하다. 그 자를 고치는
           것은 따로 할 일이고, 여기서는 **절대 크기**만 묻는다. */
      const small9 = !!polys && polys.length === 1 && diag9(polys) < 2.8;
      if (!(has9 && polys
        && (at === undefined ? inBody9(polys) : same9 === undefined && small9))) {
        if (at !== undefined) {
          const pt = parts[at];
          const a = shadeBoost9(f[1], f[2]) * k9;
          /* ★★ **같은 경로의 그늘은 겹쳐 쌓지 말고 가장 센 것만 남긴다**(2026-09, 지적: "표시한 부분은
             어두울 이유가 없는데 어두워 보여" · "배럭 벤트의 가로 줄이 없어짐") ─────────────────────
             한 화면 경로에 낯이 **둘** 나는 자리가 있다(앞·뒤가 겹치는 얇은 판, 두 번 그린 벽). 2D 는
             뒤엣것의 그늘을 **앞엣것의 불투명 몸이 덮으므로** 눈에 드는 그늘은 하나다. 그런데 메시는
             같은 경로를 **한 부품**으로 합치고 그 위에 얹힌 그늘은 `1−(1−x)(1−a)` 로 **둘 다 쌓았다** —
             그래서 그 판이 두 배로 어두워졌다(실측: 배럭 지붕 낯이 검 0.31 + 0.23 → **0.47** · 2D 보다
             훨씬 어둡다. 벤트의 가로 줄이 '사라진' 것도 같은 뿌리다 — 줄의 그늘이 판 전체에 고르게
             먹혀 줄이 아니라 '조금 어두운 판'이 된다).
             ⚠ 쌓기 자체는 옳다 — 몸 하나에 **다른 경로**의 그늘이 여럿 얹히는 자리(돔 초승달 + 낯 음영)는
               2D 도 겹쳐 칠한다. 그래서 **같은 경로로 찾은 것만**(same9) 가장 센 것으로 갈음한다. */
          const w9 = lum9(f[2] ?? "#fff") > 0.5;
          if (same9 !== undefined) { if (w9) pt.ow = Math.max(pt.ow, a); else pt.ob = Math.max(pt.ob, a); }
          else if (w9) pt.ow = 1 - (1 - pt.ow) * (1 - a); else pt.ob = 1 - (1 - pt.ob) * (1 - a);
        }
        skipped += 1; continue;
      }
      // 작은 그늘 + 제 기하 있음 — 아래로 내려가 제 부품이 된다.
    }
    if (!has9 || !polys) {
      /* 헬퍼가 일부러 빈 표를 적어 둔 낯은 **빠진 것이 아니다** — 같은 부품의 딴 낯이 그 기하를 통째로 냈다
         (rodFaces: 첫 끝 낯에 관 하나). 그것을 '되찾기 실패'로 세면 덮임 표가 거짓으로 낮아지고 ⚠ 목록이
         쓸모를 잃는다(실측: 배럭 16 면 중 12 개가 이것이었다). */
      if (MESH9.byD.get(f[0])?.length === 0) blank += 1;
      else { missPaths.push(f[0]); if (missed.length < 12) missed.push(`${f[2] ?? "(임자)"} a=${f[1]} ${f[0].slice(0, 110)}`); }
      continue;
    }
    covered += 1;
    byD.set(f[0], parts.length);
    if (f[5] !== undefined) byPid.set(f[5], parts.length);
    parts.push({ polys, fill: f[2] ?? "", alpha: shadeBoost9(f[1], f[2]), team: f[2] === undefined, lod: f[4] ?? 0, ow: 0, ob: 0, bb: polys.length === 1 && BILLBOARD9.has(polys[0]), d: f[0],
      /* 빛나는 면 — 발광 종류(폭풍·핵·아콘·워프인)는 **밝은 색 면만**(어두운 속 몸은 빛이 아니다 ·
         임자색 면도 몸이다), 그 밖의 종류는 '켜진 색' 표(EMIT_FILL9)에 든 색만. */
      emit: f[2] !== undefined && (glow ? lum9(f[2]) > 0.55 : EMIT_FILL9.has(f[2])) });
    pidAt.push(f[5]);
  }
  /* ★ 닫힌 입체 표시 — 빌더는 한 덩이를 낯 여러 장으로 내므로(부품 하나 = 낯 하나), 닫힘은 부품이 아니라
     **뭉치(pid)** 단위로 잰다. 같은 pid 의 폴리를 모아 solidSigns9 에 넘기고, 나온 부호를 부품마다 나눠 준다. */
  {
    const byPid9 = new Map<number, number[]>();
    for (let i = 0; i < parts.length; i += 1) {
      const pid = pidAt[i];
      if (pid === undefined || parts[i].alpha < 0.98) continue;   // 반투명 뭉치는 속이 보여야 한다(유리·빛무리)
      (byPid9.get(pid) ?? byPid9.set(pid, []).get(pid))!.push(i);
    }
    for (const idx of byPid9.values()) {
      if (idx.length < 4) continue;
      const all: Poly3[] = [];
      for (const i of idx) all.push(...parts[i].polys);
      const sign = solidSigns9(all);
      if (!sign) continue;
      let at = 0;
      for (const i of idx) {
        /* ★ 감기는 **폴리마다** 싣는다 — 부품의 과반으로 하나만 실으면 소수 쪽 낯이 거꾸로 뒤집혀
           보이는 낯까지 걷혔다(실측: 케이번·아카데미에서 몇십 화소가 사라졌다). */
        const fl9: boolean[] = [];
        for (let k = 0; k < parts[i].polys.length; k += 1) fl9.push(sign[at + k] < 0);
        at += parts[i].polys.length;
        parts[i].solid = true;
        parts[i].flips = fl9;
        parts[i].flip = fl9.filter((v9) => v9).length * 2 > fl9.length;
      }
    }
  }
  MESH9.byD.clear();
  return { parts, faces: faces.length, covered, skipped, blank, missed, missPaths };
}
