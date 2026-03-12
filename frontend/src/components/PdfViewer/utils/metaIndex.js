// *_meta.json の収集＆キー解決（「メタデータ解決」）
// 画像名ベースで *_meta.json を自動集約 & 解決
const META_FILES = import.meta.glob("../../../shared/assets/furniture/**/*_meta.json", {
  eager: true,
  import: "default",
});

const META_INDEX = (() => {
  const m = new Map();
  const nameKey = (p) =>
    p.split("/").pop().replace(/\.[^.]+$/, "").replace(/_meta$/i, "").toLowerCase();
  Object.entries(META_FILES).forEach(([p, data]) => m.set(nameKey(p), data || {}));
  return m;
})();

export function imageKey(url = "") {
  try {
    const last = url.split("?")[0].split("#")[0].split("/").pop() || "";
    return last.replace(/\.[^.]+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

/** zone.furnitureMetaMap > 画像名キー照合 の順で解決するファクトリ */
export function resolveMetaFactory() {
  return (z, url) => {
    if (!url) return {};
    const byZone = z?.furnitureMetaMap?.[url];
    if (byZone && typeof byZone === "object") return byZone;

    const key = imageKey(url);
    if (META_INDEX.has(key)) return META_INDEX.get(key);

    const deSuffixed = key.replace(/[@_-]\d+(x|dpi)?$/i, "");
    return META_INDEX.get(deSuffixed) || {};
  };
}
