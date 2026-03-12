// プレビュー矩形、範囲選択ボックス
// src/components/PdfViewer/layers/OverlayLayer.jsx
import { Rect } from "react-konva";

export default function OverlayLayer({ previewRect, selectBox }) {
  return (
    <>
      {previewRect && (
        <Rect {...previewRect} fill="rgba(0,128,255,0.16)" stroke="rgba(0,128,255,0.9)" dash={[6,4]} strokeWidth={2} />
      )}
      {selectBox && (
        <Rect x={selectBox.x} y={selectBox.y} width={selectBox.width} height={selectBox.height}
          fill="rgba(100,150,255,0.12)" stroke="rgba(100,150,255,0.9)" dash={[4,3]} strokeWidth={1.5} />
      )}
    </>
  );
}
