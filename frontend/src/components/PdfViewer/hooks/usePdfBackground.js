// PDF→PNG化＆paper(mm)推定（「PDFを画像化して背景に表示」）
// src/components/PdfViewer/hooks/usePdfBackground.js
// PDF → PNG化 & 用紙サイズ(mm)自動推定
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useState } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const { getDocument } = pdfjs;

export default function usePdfBackground(file) {
  const [pdfImageUrl, setPdfImageUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [paperMmAuto, setPaperMmAuto] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!file) {
        if (cancelled) return;
        setPdfImageUrl(null);
        setNatural({ w: 0, h: 0 });
        setPaperMmAuto({ w: 0, h: 0 });
        return;
      }
      const pdf = await getDocument(file).promise;
      const page = await pdf.getPage(1);

      // 1pt = 1/72 inch
      const [x0, y0, x1, y1] = page.view;
      const ptW = x1 - x0;
      const ptH = y1 - y0;
      const MM_PER_INCH = 25.4;
      const autoW = (ptW / 72) * MM_PER_INCH;
      const autoH = (ptH / 72) * MM_PER_INCH;
      if (!cancelled) setPaperMmAuto({ w: autoW, h: autoH });

      // 画像化
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (!cancelled) {
        setPdfImageUrl(canvas.toDataURL("image/png"));
        setNatural({ w: viewport.width, h: viewport.height });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [file]);

  return { pdfImageUrl, natural, paperMmAuto };
}
