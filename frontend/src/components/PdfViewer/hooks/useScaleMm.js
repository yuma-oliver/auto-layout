// px/mm算出＋描画サイズ計算（「スケール変換」）
// px/mm の算出。おまけで描画サイズ計算 & クリアランスpx化のヘルパも提供
import { useMemo } from "react";

export default function useScaleMm({ natural, paperSizeMm, paperMmAuto, scaleDenom }) {
  const paperW = (paperSizeMm?.w > 0 ? paperSizeMm.w : paperMmAuto?.w) || 0;
  const paperH = (paperSizeMm?.h > 0 ? paperSizeMm.h : paperMmAuto?.h) || 0;

  const pxPerPaperMmX = natural?.w > 0 && paperW > 0 ? natural.w / paperW : 0;
  const pxPerPaperMmY = natural?.h > 0 && paperH > 0 ? natural.h / paperH : 0;

  const pxPerPaperMm =
    pxPerPaperMmX && pxPerPaperMmY
      ? (pxPerPaperMmX + pxPerPaperMmY) / 2
      : pxPerPaperMmX || pxPerPaperMmY || 0;

  const pxPerRealMm = useMemo(() => {
    if (!pxPerPaperMm || !scaleDenom) return 0;
    return pxPerPaperMm / scaleDenom;
  }, [pxPerPaperMm, scaleDenom]);

  return pxPerRealMm;
}

/** アスペクト比を維持した描画サイズ（fitBy: "width"|"depth"） */
export function computeDrawSize(img, meta, pxPerRealMm, fitBy = "width") {
  const ratio = img?.width > 0 && img?.height > 0 ? img.width / img.height : 1;
  const widthMm = Number(meta?.widthMm) || 600;
  if (fitBy === "depth" && meta?.depthMm) {
    const drawH = Number(meta.depthMm) * pxPerRealMm;
    return { drawWidth: drawH * ratio, drawHeight: drawH };
  }
  const drawW = widthMm * pxPerRealMm;
  return { drawWidth: drawW, drawHeight: drawW / ratio };
}

/** クリアランス(mm) → px 変換 */
export function clearancePxFromMeta(meta, pxPerRealMm) {
  const c = meta?.clearanceMm || {};
  const mm = {
    left: Number(c.left) || 0,
    right: Number(c.right) || 0,
    front: Number(c.front) || 0,
    back: Number(c.back) || 0,
  };
  return {
    left: mm.left * pxPerRealMm,
    right: mm.right * pxPerRealMm,
    front: mm.front * pxPerRealMm,
    back: mm.back * pxPerRealMm,
  };
}
