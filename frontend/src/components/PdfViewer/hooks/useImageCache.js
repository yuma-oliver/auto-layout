// 家具画像キャッシュ（「家具画像の事前読み込み」）
// 家具画像キャッシュ（URL→HTMLImageElement）
import { useRef, useState } from "react";

export default function useImageCache() {
  const cacheRef = useRef(new Map());
  const [, force] = useState(0);

  const getImage = (url) => {
    if (!url) return null;
    const hit = cacheRef.current.get(url);
    if (hit === undefined) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        cacheRef.current.set(url, img);
        force((n) => n + 1);
      };
      img.onerror = () => {
        cacheRef.current.set(url, null);
        force((n) => n + 1);
      };
      cacheRef.current.set(url, null);
      img.src = url;
      return null;
    }
    return hit;
  };

  return { getImage };
}
