// 背景画像＋Konva Stageの器（幅/高さ/zoom反映）
// src/components/PdfViewer/PdfCanvas.jsx
import { Stage, Layer } from "react-konva";

export default function PdfCanvas({ pdfImageUrl, view, zoom, children }) {
  const wrapperStyle = {
    position: "relative",
    width: `${view.w}px`,
    height: `${view.h}px`,
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
    margin: "0 auto",
  };

  return (
    <div style={wrapperStyle}>
      {pdfImageUrl ? (
        <img src={pdfImageUrl} alt="PDF" style={{ width: view.w, height: view.h, display: "block" }} />
      ) : (
        <div style={{ width: view.w, height: view.h, backgroundColor: "white", display: "block", border: "1px solid #ddd" }} />
      )}
      <div style={{ position: "absolute", inset: 0 }}>
        <Stage width={view.w} height={view.h} style={{ pointerEvents: "auto" }}>
          <Layer>{children}</Layer>
        </Stage>
      </div>
    </div>
  );
}
