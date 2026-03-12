// 表示サイズフィット＆zoom初期化（「表示サイズ＆ズーム制御」）
// 表示サイズフィット & ズーム
import { useEffect, useState } from "react";

export default function useFitView(containerRef, natural) {
  const [view, setView] = useState({ w: 0, h: 0, scale: 1 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const fit = () => {
      const cw = containerRef.current?.clientWidth || 0;
      const ch = containerRef.current?.clientHeight || 0;
      if (!cw || !ch || !natural.w || !natural.h) return;

      const scaleW = cw / natural.w;
      const scaleH = ch / natural.h;
      const base = Math.min(scaleW, scaleH, 1);
      setView({
        w: Math.round(natural.w * base),
        h: Math.round(natural.h * base),
        scale: base,
      });
      setZoom(1);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [containerRef, natural.w, natural.h]);

  return { view, zoom, setZoom };
}
