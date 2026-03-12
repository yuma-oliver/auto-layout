// FASTAPI送信トリガ依存のパターン切替（「FASTAPI押下のみ変化」）
// 「FASTAPI送信（=layoutItems変更）」時のみパターンが変わる制御
import { useMemo } from "react";

function stableHash(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0); // unsigned
}

/**
 * layoutItems が更新されたときだけ seed が変わる。
 * そこから派生させた startCorner / fillMode / spacingMul を返す。
 */
export default function useLayoutPattern({ layoutItems }) {
  const layoutSalt = useMemo(() => {
    const raw = JSON.stringify(layoutItems || []);
    return stableHash(raw);
  }, [layoutItems]);

  const pattern = useMemo(() => {
    const seed = layoutSalt >>> 0;
    return {
      seed,
      layoutSalt,
      startCorner: seed % 4,                       // 0=左上,1=右上,2=左下,3=右下
      fillMode: Math.floor(seed / 4) % 3,         // 0=行優先,1=列優先,2=蛇行
      spacingMul: 1 + ((Math.floor(seed / 16) % 4) * 0.05), // 1.00/1.05/1.10/1.15
    };
  }, [layoutSalt]);

  return pattern;
}
