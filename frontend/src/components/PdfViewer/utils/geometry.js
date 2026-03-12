// clamp/intersects/resizeFromEdge など純関数
// 幾何ユーティリティ（純関数のみ）
export const EDGE_TOL = 8;
export const MIN_SIZE = 5;

export function getHoverEdge(rect, pointer) {
  const { x, y, width, height } = rect;
  const px = pointer.x;
  const py = pointer.y;
  const left = Math.abs(px - x) <= EDGE_TOL;
  const right = Math.abs(px - (x + width)) <= EDGE_TOL;
  const top = Math.abs(py - y) <= EDGE_TOL;
  const bottom = Math.abs(py - (y + height)) <= EDGE_TOL;
  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (left) return "w";
  if (right) return "e";
  if (top) return "n";
  if (bottom) return "s";
  return null;
}

export function edgeToCursor(edge) {
  switch (edge) {
    case "e":
    case "w":
      return "ew-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "move";
  }
}

export function resizeFromEdge(startRect, edge, dx, dy) {
  let { x, y, width, height } = startRect;

  const applyWest = () => {
    const nw = width - dx;
    if (nw < MIN_SIZE) {
      x += width - MIN_SIZE;
      width = MIN_SIZE;
    } else {
      x += dx;
      width = nw;
    }
  };
  const applyEast = () => (width = Math.max(MIN_SIZE, width + dx));
  const applyNorth = () => {
    const nh = height - dy;
    if (nh < MIN_SIZE) {
      y += height - MIN_SIZE;
      height = MIN_SIZE;
    } else {
      y += dy;
      height = nh;
    }
  };
  const applySouth = () => (height = Math.max(MIN_SIZE, height + dy));

  switch (edge) {
    case "w":  applyWest(); break;
    case "e":  applyEast(); break;
    case "n":  applyNorth(); break;
    case "s":  applySouth(); break;
    case "nw": applyWest(); applyNorth(); break;
    case "ne": applyEast(); applyNorth(); break;
    case "sw": applyWest(); applySouth(); break;
    case "se": applyEast(); applySouth(); break;
    default: break;
  }
  return { x, y, width, height };
}

export function intersects(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function expandedBBox(cx, cy, w, h, clr) {
  const halfW = w / 2;
  const halfH = h / 2;
  const left = cx - halfW - (clr?.left ?? 0);
  const top = cy - halfH - (clr?.back ?? 0); // 上=back
  const width = w + (clr?.left ?? 0) + (clr?.right ?? 0);
  const height = h + (clr?.front ?? 0) + (clr?.back ?? 0);
  return { x: left, y: top, width, height };
}

export function clampBBoxIntoZone(cx, cy, w, h, clr, z) {
  const halfW = w / 2;
  const halfH = h / 2;
  const padL = clr?.left ?? 0;
  const padR = clr?.right ?? 0;
  const padF = clr?.front ?? 0;
  const padB = clr?.back ?? 0;

  const minCx = z.x + halfW + padL;
  const maxCx = z.x + z.width - halfW - padR;
  const minCy = z.y + halfH + padB; // 上=back
  const maxCy = z.y + z.height - halfH - padF;

  return {
    cx: Math.min(Math.max(cx, minCx), maxCx),
    cy: Math.min(Math.max(cy, minCy), maxCy),
  };
}
