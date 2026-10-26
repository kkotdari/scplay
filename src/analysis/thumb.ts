/* ★ 지도 썸네일(2026-10-26, 요청: "지도도 노드로") — 게임 목록 배치 칸의 맵 그림(한 타일 1px)을 서버가 한 번 굽는다.
   붓은 재생기 미니맵 · 내려받는 PNG 와 같은 한 곳(utils/mapTiles drawMapGrid)이다 — 옛 앱(sg-web)의 베낀 붓은 걷었다.
   캔버스는 부르는 쪽이 준다(노드 = @napi-rs/canvas · 분석기 cli.ts). 문서(document)가 없으니 램프 둘레는 덧판 대신 사분 칸 클립으로 판다
   (앱의 일꾼이 굽던 그림과 같은 길). */
import { drawMapGrid } from "../utils/mapTiles";
import { decodeMapTerrain, terrainFace } from "../utils/mapTerrain";

/** 썸네일 판 — 1 타일 = 1px. 판을 바꾸면 서버가 다시 굽는다(저장 열쇠 `map-thumbs/{hash}-{판}.png`). */
export const MAP_THUMB_VER = 1;

export interface MapThumbGrid {
  hash: string;
  width: number;
  height: number;
  palette: number[];
  tiles: string;
  terrain?: string | null;
  resources?: [number, number, 0 | 1][] | null;
}

/** 지도 격자 → 그 판에 그린다. ctx 는 grid.width × grid.height 캔버스의 2D 붓. */
export async function drawMapThumb(ctx: CanvasRenderingContext2D, grid: MapThumbGrid): Promise<void> {
  const mt = await decodeMapTerrain(grid.terrain);
  drawMapGrid(ctx, grid, mt ? terrainFace(mt) : null, 1);
}
