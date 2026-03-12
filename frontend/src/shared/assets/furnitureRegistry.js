// src/assets/furnitureRegistry.js

// glob 結果 → [{ url, name, path, widthMm, depthMm }]
const mapGlobWithSize = (modules) =>
  Object.entries(modules).map(([path, url]) => {
    const name = path.split("/").pop() || "";
    const { widthMm, depthMm } = parseSizeFromName(name);
    return { url, name, path, widthMm, depthMm };
  });

/**
 * ファイル名から実寸（mm）を推定
 * 例:
 *   table_1800x900.png
 *   chair-600x600.webp
 *   sofa1800×900.jpg
 * いずれも width=1800mm, depth=900mm と解釈
 */
function parseSizeFromName(name = "") {
  // 1800x900 / 1800×900 のようなパターンを拾う
  const m = name.match(/(\d+)[x×](\d+)/i);
  if (!m) {
    // サイズ情報が無い場合のデフォルト（600mm角）
    return { widthMm: 600, depthMm: 600 };
  }
  return { widthMm: Number(m[1]), depthMm: Number(m[2]) };
}

/**
 * import.meta.glob の引数は “必ず” 文字列リテラル
 * 変数テンプレは不可
 */
const shodanModules = import.meta.glob(
  "./furniture/shodan/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: '?url', import: 'default' }
);
const machiaiModules = import.meta.glob(
  "./furniture/machiai/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: '?url', import: 'default' }
);
const serviceMachiaiModules = import.meta.glob(
  "./furniture/service_machiai/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: '?url', import: 'default' }
);
const jimuModules = import.meta.glob(
  "./furniture/jimu/*.{png,jpg,jpeg,webp,svg}",
  { eager: true, query: '?url', import: 'default' }
);

export const furnitureRegistry = {
  shodan: mapGlobWithSize(shodanModules),
  machiai: mapGlobWithSize(machiaiModules),
  service_machiai: mapGlobWithSize(serviceMachiaiModules),
  jimu: mapGlobWithSize(jimuModules),
};

// URL → 家具メタ（widthMm/depthMm含む）を即引きできる Map
const _byUrl = new Map();
Object.values(furnitureRegistry).forEach((arr) => {
  arr.forEach((it) => _byUrl.set(it.url, it));
});

/** URL から家具メタを取得（無ければデフォルト600mm角） */
export function findFurnitureMetaByUrl(url) {
  return _byUrl.get(url) || { url, name: "", path: "", widthMm: 600, depthMm: 600 };
}

// ラベル → レジストリキー
export function zoneKeyFromLabel(label = "") {
  if (!label) return null;
  if (label.includes("商談")) return "shodan";
  if (label.includes("サービス") && label.includes("待合")) return "service_machiai";
  if (label.includes("待合")) return "machiai";
  if (label.includes("事務")) return "jimu";
  return null;
}
