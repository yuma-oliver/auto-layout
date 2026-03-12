// utils/sizeFromFilename.js
export function parseWidthMmFromFilename(urlOrPath) {
  const name = (urlOrPath.split('/').pop() || '').toLowerCase();

  // パターン例: w1200 / 1200w / w1200mm / 1200mmw / -w1800 / _w700
  let m = name.match(/(?:^|[^a-z])w\s*([0-9]{3,5})\s*(?:mm)?/i);
  if (m) return Number(m[1]);

  m = name.match(/([0-9]{3,5})\s*w\s*(?:mm)?/i);
  if (m) return Number(m[1]);

  return null; // 見つからなければ null
}
