import { useEffect, useRef } from "react";
import { cx } from "./cx";
import type { ReplayMapGrid } from "./mapGrid";
import { drawMapGrid } from "../../utils/mapTiles";
import { decodeMapTerrain, terrainFace } from "../../utils/mapTerrain";

// 리플레이의 타일 격자를 캔버스에 '개략도'로 그린다 — 게임과 같은 색의 미니맵이 아니다.
//
// 타일 번호를 픽셀로 바꾸는 그래픽(tileset의 cv5/vx4/vr4와 팔레트)은 게임 설치본에 있는
// 저작물이라 리플레이에 없다. 물·풀·땅·벽에 이름을 붙여 보려는 시도를 네 번 하고 접었다:
//   ① 빈도로 가르기 — 상위 6개 그룹이 맵의 23%만 덮었고 순서도 뒤집혔다.
//   ② 응집도로 면 찾기 — 같은 지형 안에서도 인접 타일이 다른 그룹이라 의미가 없었다
//      (투혼에서 '넓은 면'으로 잡힌 그룹 0개).
//   ③ '확실히 걸을 수 있는 자리'를 표본으로 삼기 — 본진·자원 옆·이동 명령 좌표로 마스크를
//      만들었더니 본진끼리 안 이어지거나(투혼 200덩어리) 마스크가 99%로 부풀었다.
//   ④ 그룹 덩어리별로 칠해 실제 미니맵과 대조 — 물·언덕이 갈리지 않았다.
// 그래서 실제와 같은 그림은 사람이 올린다(운영 메뉴의 미니맵 화면). 여기서 그리는 개략도는
// 그림이 없는 맵의 대체물이고, 그 화면에서 '어느 맵인지 알아보는' 미리보기로도 쓴다.
//
// 테마(라이트/다크)에 따라 바꾸지 않는다 — 이건 글이 아니라 지도 그림이라, 두 테마에서
// 같은 그림으로 보이는 편이 낫다.

// 타일 하나를 몇 픽셀로 그릴까(기본) — 목록 썸네일처럼 200~360px로 보이는 자리의 값이다.
const PX_PER_TILE = 4;
/* 캔버스 한 변의 상한(장치 픽셀) — 브라우저마다 캔버스 넓이 한도가 있고(크로뮴은 대략
   2억 6천만 화소), 이 값이면 8192² = 6천 7백만이라 넉넉히 들어간다. 메모리도 268MB가
   아니라 그 4분의 1이다. */
const MAX_SIDE = 8192;

/** 격자를 그린 캔버스 하나. 크기는 CSS가 정한다(부모를 꽉 채운다).
 *
 *  ★ targetSide — **화면에 실제로 그려질 한 변(장치 픽셀)**이다(지적: "지도를 16배 최대
 *    확대하면 맵이 흐려"). 여태 굽는 크기가 타일당 4px로 못 박혀 있어, 128타일 맵이면
 *    배킹이 512px이었다. 그걸 1024px 상자에 깔고 16배로 늘리면 **32배 확대한 그림**이라
 *    흐릴 수밖에 없다 — 배율을 아무리 올려도 화소가 안 는다.
 *    이 값을 주면 굽는 크기가 그 배율을 따라간다(상한 안에서). 안 주면 예전 그대로다. */
export default function ReplayMapCanvas({ grid, className, targetSide }: {
  grid: ReplayMapGrid; className?: string; targetSide?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* 굽는 배수는 **칸 단위로 죈다**(2·4·8·16…) — 배율이 조금 움직일 때마다 다시 구우면
     확대 손짓 내내 128×128 캔버스를 계속 다시 그린다. 칸으로 죄면 다시 굽는 횟수가
     손에 꼽고, 한 칸 안에서는 CSS가 늘려도 두 배를 안 넘어 눈에 안 띈다. */
  const px = (() => {
    if (!targetSide || !(grid.width > 0)) return PX_PER_TILE;
    const want = targetSide / grid.width;
    const stepped = 2 ** Math.ceil(Math.log2(Math.max(PX_PER_TILE, want)));
    return Math.max(PX_PER_TILE, Math.min(stepped, Math.floor(MAX_SIDE / grid.width)));
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    canvas.width = grid.width * px;
    canvas.height = grid.height * px;
    /* 그리는 자리는 **한 곳뿐**이다(mapTiles.drawMapGrid) — 썸네일과 내려받는 PNG가
       배율만 다르고 같은 그림이어야 한다(지적: "색깔이 왜 타일하고 달라"). */
    /* 지형이 있는 맵은 **풀릴 때까지 안 그린다**(지적: "처음 페이지 로딩시 초록색 맵
       정보 그림이 떠 그거 안뜨게 해줘") — 여태 그 사이를 옛 길(타일 그룹 램프)로
       메웠는데, 그 램프는 타일셋을 모르는 어림이라 우주 맵도 초록으로 나온다. 한 박자
       비는 것이 틀린 그림을 보여 주는 것보다 낫다. 지형이 아예 없는 옛 맵만 옛 길이다. */
    if (!grid.terrain) drawMapGrid(ctx, grid, null, px);
    let cancelled = false;
    void decodeMapTerrain(grid.terrain).then((mt) => {
      if (cancelled || !mt) return;
      drawMapGrid(ctx, grid, terrainFace(mt), px);
    });
    return () => { cancelled = true; };
  }, [grid, px]);

  /* 클래스 이름은 **scr-minimap-canvas**다(수리: 지도가 상자 일부만 덮고 나머지가
     빈 초록이었다) — 그리기를 공용으로 옮기며 이름을 바꿨는데, 그 이름에 걸린 CSS가
     없어 캔버스가 제 고유 픽셀 크기(512×512)로 고정돼 버렸다. width/height 100%를
     주는 규칙이 이 이름에 달려 있다(global.css의 .scr-motion-canvas-blank .scr-minimap-canvas). */
  return (
    <canvas
      ref={canvasRef} className={cx("scr-minimap-canvas", className)}
      aria-label={`${grid.name} 미니맵`}
    />
  );
}
