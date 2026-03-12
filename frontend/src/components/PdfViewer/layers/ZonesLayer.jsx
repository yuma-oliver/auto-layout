// ゾーンRectとラベルText（選択/リサイズ/ドラッグの受け口）
// src/components/PdfViewer/layers/ZonesLayer.jsx
import { Rect, Text } from "react-konva";

export default function ZonesLayer({ zones, selectedIds, handlers }) {
  return (
    <>
      {zones.map((z) => {
        const isSel = selectedIds.includes(z.id);
        const isUnset = !z.label;
        const h = handlers.makeRectHandlers(z, isSel);
        return (
          <g key={z.id}>
            <Rect
              id={`zone-${z.id}`}
              x={z.x} y={z.y} width={z.width} height={z.height}
              fill={isUnset ? "rgba(0,0,0,0)" : z.fill ?? "rgba(0,0,0,0)"}
              stroke={isSel ? "#8fc7ffff" : isUnset ? "#000000" : z.stroke ?? "#000000"}
              strokeWidth={isSel ? Math.max(0.1, z.strokeWidth || 0.1) : z.strokeWidth || 0.1}
              shadowForStrokeEnabled shadowBlur={isSel ? 3 : 0}
              shadowColor={isSel ? "rgba(25,118,210,0.6)" : "transparent"}
              onMouseMove={h.onMouseMove}
              onMouseLeave={h.onMouseLeave}
              onMouseDown={h.onMouseDown}
              draggable={h.draggable}
              onDragEnd={h.onDragEnd}
            />
            {z.label && (
              <Text x={z.x + 6} y={z.y + 6} text={z.label} fontSize={14} fill="#003366" />
            )}
          </g>
        );
      })}
    </>
  );
}
