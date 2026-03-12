// src/utils/exportPptxFromZones.js
import PptxGenJS from "pptxgenjs";

// ★ public/assets/selectFurniture 以下のみを対象
const PUBLIC_BASE = "/assets/selectFurniture";

/* ---------------- URL→meta 解決 ---------------- */

// 画像 → meta 候補（_meta.json / .json 両対応）
function buildMetaCandidates(imgUrl = "") {
  const urlNoQ = imgUrl.split(/[?#]/)[0];
  const lastSlash = urlNoQ.lastIndexOf("/");
  const dir = lastSlash >= 0 ? urlNoQ.slice(0, lastSlash) : "";
  const file = lastSlash >= 0 ? urlNoQ.slice(lastSlash + 1) : urlNoQ;

  const baseNoExt = file.replace(/\.[^.]+$/i, "");
  const base = baseNoExt.replace(/\.[a-f0-9]{5,10}$/i, ""); // .hash の除去
  const baseNoVariant = base.replace(/_[A-Z]$/i, ""); // _A → （無印）

  return Array.from(
    new Set([
      `${dir}/${base}_meta.json`,
      `${dir}/${baseNoVariant}_meta.json`,
      `${dir}/${base}.json`,
      `${dir}/${baseNoVariant}.json`,
    ])
  );
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// url → 正規化 meta
async function resolveMeta(url, cache) {
  if (cache.has(url)) return cache.get(url);

  let raw = {};
  for (const u of buildMetaCandidates(url)) {
    const j = await fetchJsonSafe(u);
    if (j) {
      raw = j;
      break;
    }
  }

  // ここで旧/新フォーマットを吸収
  // 例: { "name": "テーブル", "modelNumber": "...", "size": "..." }
  const normalized = {
    displayName: raw.displayName || raw.name || "",
    modelNumber: raw.modelNumber || raw.sku || "",
    size: raw.size || "",
    seats: Number.isFinite(raw.seats) ? Math.max(0, raw.seats) : 0,
    price: Number.isFinite(raw.price) ? Math.max(0, raw.price) : null,
  };

  cache.set(url, normalized);
  return normalized;
}

// 画像を dataURL 化（CORS 対策）
async function toDataUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch {
    // ダメなら URL のまま（同一オリジン想定）
    return url;
  }
}

// naturalWidth / naturalHeight 取得
const getImageSize = (urlOrData) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: img.naturalWidth || 1,
        h: img.naturalHeight || 1,
      });
    img.onerror = () => resolve({ w: 4, h: 3 }); // フォールバック 4:3
    img.src = urlOrData;
  });

/* ---------------- ユーティリティ ---------------- */

// /assets/selectFurniture を含む URL なら OK（origin 付き/なし両対応）
function isSelectFurnitureUrl(u) {
  return typeof u === "string" && u.includes(PUBLIC_BASE);
}

// zones 内の furnitureCounts / furnitureAssets からベース数量を作成
function normalizeCountsForZone(zone) {
  const rawCounts = zone.furnitureCounts || zone.counts || {};
  const assets = Array.isArray(zone.furnitureAssets) ? zone.furnitureAssets : [];
  const counts = { ...rawCounts };

  // counts がないが assets がある場合は 1 個扱いで補完
  for (const url of assets) {
    if (!counts[url]) {
      counts[url] = 1;
    }
  }

  return counts;
}

// ベース数量＋zoneSelections をマージ
function getCountsForZone(zone, zoneSelections) {
  const baseCounts = normalizeCountsForZone(zone);
  const sel = zoneSelections?.[zone.id] || null;
  if (!sel) return baseCounts;

  const merged = { ...baseCounts };
  for (const [url, val] of Object.entries(sel)) {
    const n = Math.max(0, Math.floor(Number(val) || 0));
    if (n > 0) merged[url] = n;
    else delete merged[url];
  }
  return merged;
}

/* ---------------- メイン：ゾーン配列 → PPTX 出力 ---------------- */

/**
 * zones: Array<{
 *   id,
 *   label,
 *   width,
 *   height,
 *   furnitureCounts?: { [url: string]: number },
 *   furnitureAssets?: string[]
 * }>
 *
 * zoneSelections: { [zoneId]: { [imageUrl]: qty } }
 *  - AreaFurniturePanel で管理している「パワポ用選定状態」
 */
export async function exportPptxFromZones(zones = [], zoneSelections = {}) {
  const pptx = new PptxGenJS();
  // 16:9 レイアウト安全設定
  try {
    pptx.layout = "LAYOUT_16x9";
  } catch {
    pptx.defineLayout({ name: "SAFE_16x9", width: 13.33, height: 7.5 });
    pptx.layout = "SAFE_16x9";
  }

  // ページ寸法（インチ）
  const PAGE_W = 13.33;
  const PAGE_H = 7.5;
  const MARGIN = { l: 0.6, r: 0.6, t: 0.8, b: 0.6 };
  const TITLE_H = 0.6;

  // ★ 固定：3 行 × 5 列
  const ROWS = 3;
  const COLS = 5;
  const GAP_X = 0.25;
  const GAP_Y = 0.45;

  const GRID_W = PAGE_W - MARGIN.l - MARGIN.r;
  const GRID_H = PAGE_H - MARGIN.t - TITLE_H - MARGIN.b;
  const CELL_W = (GRID_W - GAP_X * (COLS - 1)) / COLS;
  const CELL_H = (GRID_H - GAP_Y * (ROWS - 1)) / ROWS;

  // キャプション高さ固定 → 残りを画像エリアに
  const CAPTION_H = 0.8;
  const IMG_AREA_H = Math.max(0.5, CELL_H - CAPTION_H);

  const START_X = MARGIN.l;
  const START_Y = MARGIN.t + TITLE_H;

  const metaCache = new Map();

  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;

  // ゾーン情報を整形
  const zoneEntries = zones.map((z) => ({
    id: z.id,
    label: z.label || "未設定",
    width: Math.round(z.width || 0),
    height: Math.round(z.height || 0),
    counts: getCountsForZone(z, zoneSelections), // 👈 ここに zoneSelections を反映
  }));

  /* ---- 表紙 ---- */
  {
    const s = pptx.addSlide();
    s.addText("家具選定レポート", {
      x: MARGIN.l,
      y: 1.0,
      fontSize: 36,
      bold: true,
    });
    s.addText(ymd, {
      x: MARGIN.l,
      y: 1.8,
      fontSize: 18,
      color: "666666",
    });
    s.addText("出典：public/assets/selectFurniture", {
      x: MARGIN.l,
      y: 2.3,
      fontSize: 12,
      color: "888888",
    });
  }

  /* ---- 全体サマリ ---- */
  {
    const s = pptx.addSlide();
    s.addText("全体サマリ", {
      x: MARGIN.l,
      y: MARGIN.t,
      fontSize: 28,
      bold: true,
    });

    const summaryRows = [["ゾーン", "数量合計", "席数合計"]];

    for (const z of zoneEntries) {
      const counts = z.counts || {};
      // ✅ selectFurniture のみ出力
      const urls = Object.keys(counts).filter(
        (u) => (counts[u] || 0) > 0 && isSelectFurnitureUrl(u)
      );

      let qty = 0;
      let seats = 0;

      for (const url of urls) {
        const meta = await resolveMeta(url, metaCache);
        const per = Number.isFinite(meta.seats) ? Math.max(0, meta.seats) : 0;
        const n = Math.max(0, Number(counts[url] || 0));
        qty += n;
        seats += per * n;
      }

      summaryRows.push([
        `${z.label}（${z.width}×${z.height}）`,
        `${qty}`,
        `${seats}`,
      ]);
    }

    s.addTable(summaryRows, {
      x: MARGIN.l,
      y: MARGIN.t + 0.7,
      w: PAGE_W - MARGIN.l - MARGIN.r,
      fontSize: 14,
      colW: [6.2, 1.8, 1.8],
      border: { type: "solid", color: "CCCCCC", pt: 1 },
    });
  }

  /* ---- ゾーン別 3×5 マス張り ---- */
  for (const z of zoneEntries) {
    const counts = z.counts || {};
    const urls = Object.keys(counts).filter(
      (u) => (counts[u] || 0) > 0 && isSelectFurnitureUrl(u)
    );

    if (urls.length === 0) {
      const s = pptx.addSlide();
      s.addText(`${z.label}（${z.width}×${z.height}）`, {
        x: MARGIN.l,
        y: MARGIN.t,
        fontSize: 26,
        bold: true,
      });
      s.addText("選定なし", {
        x: MARGIN.l,
        y: MARGIN.t + 0.7,
        fontSize: 18,
        color: "888888",
      });
      continue;
    }

    const PER_PAGE = ROWS * COLS;

    for (let page = 0; page * PER_PAGE < urls.length; page++) {
      const s = pptx.addSlide();
      s.addText(`${z.label}（${z.width}×${z.height}）`, {
        x: MARGIN.l,
        y: MARGIN.t,
        fontSize: 26,
        bold: true,
      });

      for (let k = 0; k < PER_PAGE; k++) {
        const i = page * PER_PAGE + k;
        if (i >= urls.length) break;

        const url = urls[i];
        const meta = await resolveMeta(url, metaCache);
        const qty = Math.max(0, Number(counts[url] || 0));

        const row = Math.floor(k / COLS);
        const col = k % COLS;
        const x = START_X + col * (CELL_W + GAP_X);
        const y = START_Y + row * (CELL_H + GAP_Y);

        // 画像：比率維持で IMG_AREA に “contain”
        const dataUrl = await toDataUrl(url);
        const nat = await getImageSize(dataUrl);
        const scale = Math.min(CELL_W / nat.w, IMG_AREA_H / nat.h);
        const imgW = nat.w * scale;
        const imgH = nat.h * scale;
        const imgX = x + (CELL_W - imgW) / 2;
        const imgY = y + (IMG_AREA_H - imgH) / 2;

        s.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });

        // キャプション
        const displayName =
          meta.displayName || url.split("/").pop();
        const modelNumber = meta.modelNumber || "";
        const size = meta.size || "";
        const price = Number.isFinite(meta.price) ? meta.price : null;

        const lines = [
          displayName,
          modelNumber ? `品番：${modelNumber}` : null,
          size ? `サイズ：${size}` : null,
          `数量：${qty}`,
          price != null
            ? `単価：約¥${price.toLocaleString("ja-JP")}`
            : null,
        ].filter(Boolean);

        s.addText(lines.join("\n"), {
          x,
          y: y + IMG_AREA_H + 0.05,
          w: CELL_W,
          h: CAPTION_H - 0.05,
          fontSize: 11,
          lineSpacing: 12,
          valign: "top",
        });
      }
    }
  }

  await pptx.writeFile({ fileName: `家具選定_${ymd}.pptx` });
}
