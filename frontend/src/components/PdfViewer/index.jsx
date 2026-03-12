// 司令塔（親）。各レイヤ/コントロールを組み合わせるだけ
// src/components/PdfViewer/index.jsx
import { useRef } from "react";
import PdfCanvas from "./PdfCanvas";
import ZonesLayer from "./layers/ZonesLayer";
import FurnitureLayer from "./layers/FurnitureLayer";
import OverlayLayer from "./layers/OverlayLayer";
import ZoomControl from "./ui/ZoomControl";
import ZoneLabelDialog from "./dialogs/ZoneLabelDialog";
import usePdfBackground from "./hooks/usePdfBackground";
import useFitView from "./hooks/useFitView";
import useScaleMm from "./hooks/useScaleMm";
import useImageCache from "./hooks/useImageCache";
import useZonesInteraction from "./hooks/useZonesInteraction";
import useLayoutPattern from "./hooks/useLayoutPattern";
import useConditionStore from "../../store/useConditionStore";
import { useMemo } from "react";

export default function PdfViewer(props) {
  const { file, zones, selectedIds, onChangeSelectedIds, onAddZone, onUpdateZone, onDeleteZone,
          layoutItems, rightPadding = 320, scaleDenom = 100, paperSizeMm = { w:0, h:0 }, fitBy = "width" } = props;

  // PDF→背景PNG
  const { pdfImageUrl, natural: pdfNatural, paperMmAuto } = usePdfBackground(file);

  const showroomArea = useConditionStore((s) => s.showroomArea);

  const natural = useMemo(() => {
    if (pdfNatural) return pdfNatural;
    const a = Number(showroomArea) || 0;
    if (a > 0) {
      // 面積(sqm) から 2:1 の仮想キャンバスを生成
      const h = Math.sqrt(a * 500000); // mm
      const w = h * 2;
      return { w, h };
    }
    return null;
  }, [pdfNatural, showroomArea]);

  // 表示サイズ＆ズーム
  const containerRef = useRef(null);
  const { view, zoom, setZoom } = useFitView(containerRef, natural);

  // mmスケール
  const pxPerRealMm = useScaleMm({ natural, paperSizeMm, paperMmAuto, scaleDenom });

  // 画像キャッシュ
  const { getImage } = useImageCache();

  // ゾーンの作図/選択/リサイズ/ドラッグ（OverlayLayer もここから状態取得）
  const zonesUx = useZonesInteraction({
    zones, selectedIds, onChangeSelectedIds, onAddZone, onUpdateZone, onDeleteZone
  });

  // FASTAPI押下時のみ変化するパターン
  const pattern = useLayoutPattern({ layoutItems }); // { corner, order, spacingMul, salt } など

  const canRender = !!natural && view.w > 0 && view.h > 0;

  return (
    <div ref={containerRef} style={{ position:"relative", overflow:"auto", background:"#f5f5f5", width:"100%", height:"100%" }}>
      {canRender ? (
        <>
          <PdfCanvas pdfImageUrl={pdfImageUrl} view={view} zoom={zoom}>
            <ZonesLayer
              zones={zones}
              selectedIds={selectedIds}
              handlers={zonesUx.zoneHandlers}
            />
            <FurnitureLayer
              zones={zones}
              layoutItems={layoutItems}
              pxPerRealMm={pxPerRealMm}
              fitBy={fitBy}
              getImage={getImage}
              pattern={pattern}
              overridesApi={zonesUx.overridesApi}
            />
            <OverlayLayer previewRect={zonesUx.previewRect} selectBox={zonesUx.selectBox} />
          </PdfCanvas>

          <ZoomControl
            zoom={zoom}
            onChange={setZoom}
            rightPadding={rightPadding}
          />

          <ZoneLabelDialog
            open={zonesUx.labelDlgOpen}
            onClose={zonesUx.closeLabelDialog}
            onSave={zonesUx.saveLabel}
          />
        </>
      ) : (
        <div style={{ padding: 24, color: "#666" }}>
          {file ? "レイアウトを準備中..." : "左パネルで面積を入力するか、PDFをアップロードしてください。"}
        </div>
      )}
    </div>
  );
}
