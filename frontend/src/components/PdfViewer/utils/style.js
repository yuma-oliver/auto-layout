// styleForLabel, withAlpha など見た目系
// 見た目系ユーティリティ
export function styleForLabel(label = "") {
  if (!label) return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
  if (label.includes("商談")) return { fill: "rgba(220,0,0,0.28)", stroke: "rgba(220,0,0,0.9)" };
  if (label.includes("サービス") && label.includes("待合"))
    return { fill: "rgba(0,120,215,0.28)", stroke: "rgba(0,120,215,0.9)" };
  if (label.includes("待合")) return { fill: "rgba(0,170,80,0.28)", stroke: "rgba(0,170,80,0.9)" };
  if (label.includes("事務")) return { fill: "rgba(128,128,128,0.28)", stroke: "rgba(128,128,128,0.9)" };
  return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
}

// 任意の color を指定αで返す（rgba/rgb/hex対応。その他は素通し）
export function withAlpha(color = "rgba(0,0,0,0)", alpha = 0.28) {
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  // rgba / rgb
  let m = String(color).match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    const r = Number(m[1]) | 0;
    const g = Number(m[2]) | 0;
    const b = Number(m[3]) | 0;
    return `rgba(${r},${g},${b},${a})`;
    }
  // #rgb / #rrggbb
  if (/^#([0-9a-f]{3}){1,2}$/i.test(color)) {
    let r, g, b;
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

// 現在色からαを推定（rgba のときのみ）
export function extractAlpha(color) {
  const m = String(color || "").match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i);
  return m ? Math.max(0, Math.min(1, Number(m[1]) || 0)) : undefined;
}
