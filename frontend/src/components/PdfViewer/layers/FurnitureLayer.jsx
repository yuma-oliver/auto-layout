// 家具配置ロジック＋KonvaImage描画（グリッド/クランプ/スナップ）
// src/components/PdfViewer/layers/FurnitureLayer.jsx
import { Image as KonvaImage, Circle } from "react-konva";
import { useMemo } from "react";
import { clampBBoxIntoZone, expandedBBox, intersects } from "../utils/geometry";
import { resolveMetaFactory } from "../utils/metaIndex";

export default function FurnitureLayer({
  zones, layoutItems, pxPerRealMm, fitBy, getImage, pattern, overridesApi
}) {
  const zoneMap = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  const resolveMeta = resolveMetaFactory(); // 画像名→meta

  const computeDrawSize = (img, meta) => {
    const ratio = img?.width > 0 && img?.height > 0 ? img.width / img.height : 1;
    const widthMm = Number(meta?.widthMm) || 600;
    if (fitBy === "depth" && meta?.depthMm) {
      const drawH = Number(meta.depthMm) * pxPerRealMm;
      return { drawWidth: drawH * ratio, drawHeight: drawH };
    }
    const drawW = widthMm * pxPerRealMm;
    return { drawWidth: drawW, drawHeight: drawW / ratio };
  };

  const clearancePxFromMeta = (meta) => {
    const c = meta?.clearanceMm || {};
    const mm = {
      left: +c.left || 0, right: +c.right || 0, front: +c.front || 0, back: +c.back || 0,
    };
    const mul = pxPerRealMm;
    return { left: mm.left*mul, right: mm.right*mul, front: mm.front*mul, back: mm.back*mul };
  };

  if (!Array.isArray(layoutItems) || pxPerRealMm <= 0) return null;

  const nodes = [];
  const placedByZone = new Map();
  const gridByKey = new Map();

  for (const res of layoutItems) {
    const z = zoneMap.get(res.zone_id);
    if (!z) continue;
    const assets = z.furnitureAssets || [];
    if (!assets.length) continue;

    const ensurePlacedList = () => {
      if (!placedByZone.has(z.id)) placedByZone.set(z.id, []);
      return placedByZone.get(z.id);
    };

    const pickUrl = (i) => {
      const mode = z.placementMode || "sequence";
      if (mode === "first") return assets[0];
      if (mode === "random") return assets[Math.floor(Math.random() * assets.length)];
      return assets[i % assets.length];
    };

    const baseOriginX = (needW, w, clr) => z.x + (clr.left ?? 0) + w/2;
    const baseOriginY = (needH, h, clr) => z.y + (clr.back ?? 0) + h/2;

    const items = res.items || [];
    items.forEach((pt, i) => {
      const url = pickUrl(i);
      const img = getImage(url);
      if (!img) {
        nodes.push(<Circle key={`${z.id}-mark-${i}`} x={pt.x} y={pt.y} radius={6} fill="orange" stroke="#444" listening={false} />);
        return;
      }

      const meta = resolveMeta(z, url);
      const { drawWidth, drawHeight } = computeDrawSize(img, meta);
      const clr = clearancePxFromMeta(meta);

      const needW = drawWidth + (clr.left ?? 0) + (clr.right ?? 0);
      const needH = drawHeight + (clr.front ?? 0) + (clr.back ?? 0);
      if (needW > z.width || needH > z.height) return;

      const k = `${z.id}|${url}`;
      if (!gridByKey.has(k)) {
        gridByKey.set(k, {
          originX: baseOriginX(needW, drawWidth, clr),
          originY: baseOriginY(needH, drawHeight, clr),
          stepX: Math.max(4, needW) * (pattern.spacingMul ?? 1),
          stepY: Math.max(4, needH) * (pattern.spacingMul ?? 1),
        });
      }
      const grid = gridByKey.get(k);
      const placedList = ensurePlacedList();

      // 既存のドラッグオーバーライド
      const itemKey = `${z.id}:${i}:${url}`;
      const ov = overridesApi.get(itemKey);

      // 近傍グリッドにスナップ＋クランプ
      const snap = (v, o, s) => o + Math.round((v - o) / s) * s;
      let cx = ov?.cx ?? snap(pt.x, grid.originX, grid.stepX);
      let cy = ov?.cy ?? snap(pt.y, grid.originY, grid.stepY);
      ({ cx, cy } = clampBBoxIntoZone(cx, cy, drawWidth, drawHeight, clr, z));

      // 重なり回避（近い候補を探索）
      const fits = (xx, yy) => {
        const bb = expandedBBox(xx, yy, drawWidth, drawHeight, clr);
        if (bb.x < z.x || bb.y < z.y || bb.x + bb.width > z.x + z.width || bb.y + bb.height > z.y + z.height) return false;
        for (const o of placedList) if (intersects(bb, o)) return false;
        return true;
      };

      // 周辺候補
      const candidates = [{ cx, cy }];
      const maxSteps = 8;
      for (let r=0; r<=maxSteps; r++) {
        for (let c=-r; c<=r; c++) {
          candidates.push({ cx: grid.originX + c*grid.stepX, cy: grid.originY + r*grid.stepY });
          candidates.push({ cx: grid.originX + c*grid.stepX, cy: grid.originY - r*grid.stepY });
        }
      }

      let pos = null;
      for (const p of candidates) {
        const cl = clampBBoxIntoZone(p.cx, p.cy, drawWidth, drawHeight, clr, z);
        if (fits(cl.cx, cl.cy)) { pos = cl; break; }
      }
      if (!pos) return;

      placedList.push(expandedBBox(pos.cx, pos.cy, drawWidth, drawHeight, clr));

      const dragBoundFunc = (p) => {
        const centerX = p.x + drawWidth/2;
        const centerY = p.y + drawHeight/2;
        const sx = snap(centerX, grid.originX, grid.stepX);
        const sy = snap(centerY, grid.originY, grid.stepY);
        const cl = clampBBoxIntoZone(sx, sy, drawWidth, drawHeight, clr, z);
        return { x: cl.cx - drawWidth/2, y: cl.cy - drawHeight/2 };
      };

      const onDragEnd = (e) => {
        const nx = e.target.x(), ny = e.target.y();
        const centerX = nx + drawWidth/2, centerY = ny + drawHeight/2;
        const sx = snap(centerX, grid.originX, grid.stepX);
        const sy = snap(centerY, grid.originY, grid.stepY);
        const cl = clampBBoxIntoZone(sx, sy, drawWidth, drawHeight, clr, z);
        overridesApi.set(itemKey, { cx: cl.cx, cy: cl.cy }); // 保存
      };

      nodes.push(
        <KonvaImage
          key={`${z.id}-${i}`}
          image={img}
          x={pos.cx - drawWidth/2}
          y={pos.cy - drawHeight/2}
          width={drawWidth}
          height={drawHeight}
          draggable
          dragBoundFunc={dragBoundFunc}
          onDragEnd={onDragEnd}
          listening
        />
      );
    });
  }

  return <>{nodes}</>;
}
