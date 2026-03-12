// src/components/PdfViewer/layers/FurnitureLayoutLayer.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Image as KonvaImage, Circle, Group, Rect, Text } from "react-konva";

/* ========= 画像キャッシュ ========= */
function useImageCache() {
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

/* ========= 家具メタの自動解決 ========= */
const META_FILES = import.meta.glob("../../../shared/assets/furniture/**/*_meta.json", {
  eager: true,
  import: "default",
});
const META_INDEX = (() => {
  const m = new Map();
  const nameKey = (p) =>
    p
      .split("/")
      .pop()
      .replace(/\.[^.]+$/, "")
      .replace(/_meta$/i, "")
      .toLowerCase();
  Object.entries(META_FILES).forEach(([p, data]) => m.set(nameKey(p), data || {}));
  return m;
})();
const imageKey = (url = "") => {
  try {
    const last = url.split("?")[0].split("#")[0].split("/").pop() || "";
    return last.replace(/\.[^.]+$/, "").toLowerCase();
  } catch {
    return "";
  }
};

/* ========= ユーティリティ ========= */
const resolveMeta = (z, url) => {
  const byZone = z?.furnitureMetaMap?.[url];
  if (byZone && typeof byZone === "object") return byZone;
  const key = imageKey(url);
  if (META_INDEX.has(key)) return META_INDEX.get(key);
  const deSuffixed = key.replace(/[@_-]\d+(x|dpi)?$/i, "");
  return META_INDEX.get(deSuffixed) || {};
};

const clampBBoxIntoZone = (cx, cy, w, h, clr, z) => {
  const halfW = w / 2;
  const halfH = h / 2;
  const padL = clr?.left ?? 0;
  const padR = clr?.right ?? 0;
  const padF = clr?.front ?? 0;
  const padB = clr?.back ?? 0;

  const minCx = z.x + halfW + padL;
  const maxCx = z.x + z.width - halfW - padR;
  const minCy = z.y + halfH + padB; // 上=back
  const maxCy = z.y + z.height - halfH - padF;

  return {
    cx: Math.min(Math.max(cx, minCx), maxCx),
    cy: Math.min(Math.max(cy, minCy), maxCy),
  };
};

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

const stableHash = (str = "") => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i);
  return h >>> 0;
};

function makePRNG(seed) {
  // xorshift32
  let x = (seed || 1) >>> 0;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
}
const shuffleInPlace = (arr, rnd) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

const normalizeRotation = (deg) => {
  let r = deg % 360;
  if (r < 0) r += 360;
  return r;
};

/* ========= 本体 ========= */
export default function FurnitureLayoutLayer({
  zones = [],
  layoutItems = [],
  fitBy = "width",
  pxPerRealMm = 0,
  selectedIds = [], // ← 選択中ゾーンのみ再レイアウト
}) {
  const { getImage } = useImageCache();

  // 手動ドラッグ & 回転 の状態保持（ゾーン＋インデックス＋URL単位）
  // value: { cx, cy, rotation }
  const overridesRef = useRef(new Map());
  const [, force] = useState(0);
  const [selectedItemKey, setSelectedItemKey] = useState(null);

  // 並びパターンのシード（FASTAPI結果に依存）
  const layoutSalt = useMemo(
    () => stableHash(JSON.stringify(layoutItems || [])),
    [layoutItems]
  );

  // FASTAPI送信（layoutItems 変化）時に手動オーバーライドをリセット
  const layoutSaltRef = useRef(layoutSalt);
  useEffect(() => {
    if (layoutSaltRef.current !== layoutSalt) {
      // 新しいレイアウト結果が来たので、手動調整は一旦リセット
      overridesRef.current = new Map();
      setSelectedItemKey(null);
      layoutSaltRef.current = layoutSalt;
      force((n) => n + 1);
    }
  }, [layoutSalt]);

  // 位置更新用（rotation を壊さない）
  const setOverride = (key, pos) => {
    const prev = overridesRef.current.get(key) || {};
    overridesRef.current.set(key, { ...prev, ...pos });
    force((n) => n + 1);
  };

  // 回転更新用（位置を壊さない）
  const rotateOverride = (key, cx, cy, deltaDeg) => {
    const prev = overridesRef.current.get(key) || {};
    const next = {
      cx: prev.cx ?? cx,
      cy: prev.cy ?? cy,
      rotation: normalizeRotation((prev.rotation || 0) + deltaDeg),
    };
    overridesRef.current.set(key, next);
    force((n) => n + 1);
  };

  const computeDrawSize = (img, meta) => {
    const ratio =
      img?.width > 0 && img?.height > 0 ? img.width / img.height : 1;
    const widthMm = Number(meta?.widthMm) || 600;
    if (fitBy === "depth" && meta?.depthMm) {
      const drawH = Number(meta.depthMm) * pxPerRealMm;
      const drawW = drawH * ratio;
      return { drawWidth: drawW, drawHeight: drawH };
    }
    const drawW = widthMm * pxPerRealMm;
    const drawH = drawW / ratio;
    return { drawWidth: drawW, drawHeight: drawH };
  };

  const clearancePxFromMeta = (meta) => {
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
  };

  // ゾーンごとの“固定シード”を保持：
  // - 初回：layoutSalt を初期値にして保存
  // - 選択中ゾーン：layoutSalt 変化に追随して更新（= 配置が変わる）
  // - 未選択ゾーン：前回のシードを維持（= 見た目維持）
  const zoneSeedRef = useRef(new Map()); // zoneId -> seed
  const ensureZoneSeed = (zoneId, isSelectedZone) => {
    const has = zoneSeedRef.current.has(zoneId);
    const nextSeed = stableHash(`${layoutSalt}:${zoneId}`);
    if (!has) {
      zoneSeedRef.current.set(zoneId, nextSeed);
    } else if (isSelectedZone) {
      zoneSeedRef.current.set(zoneId, nextSeed);
    }
    return zoneSeedRef.current.get(zoneId);
  };

  if (!(Array.isArray(zones) && zones.length) || pxPerRealMm <= 0) return null;

  const nodes = [];

  for (const z of zones) {
    const isSelectedZone = selectedIds.includes(z.id);
    const zoneSeed = ensureZoneSeed(z.id, isSelectedZone);
    const rnd = makePRNG(zoneSeed);

    const assetsAll = z.furnitureAssets || [];
    const countsMap = z.furnitureCounts || {};

    // === 1) 使用対象URL＋数量（展開前）
    const urlsWithCount = Object.entries(countsMap)
      .filter(([, n]) => Math.max(0, Number(n) || 0) > 0)
      .map(([u, n]) => ({ url: u, count: Math.max(0, Number(n) || 0) }));
    const hasSpecified = urlsWithCount.length > 0;
    const baseUrls = hasSpecified ? urlsWithCount.map((v) => v.url) : assetsAll;

    // 画像ロード状態とサイズを先に収集
    const sizes = []; // {url, img, drawW, drawH, needW, needH, clr, meta, cluster}
    for (const url of baseUrls) {
      const img = getImage(url);
      if (!img) continue;
      const meta = resolveMeta(z, url);
      const { drawWidth, drawHeight } = computeDrawSize(img, meta);
      const clr = clearancePxFromMeta(meta);
      const cluster =
        meta?.clusterSimilar === true ||
        String(meta?.group).toLowerCase() === "together";
      sizes.push({
        url,
        img,
        drawW: drawWidth,
        drawH: drawHeight,
        needW: drawWidth + (clr.left ?? 0) + (clr.right ?? 0),
        needH: drawHeight + (clr.front ?? 0) + (clr.back ?? 0),
        clr,
        meta,
        cluster,
      });
    }

    // 未ロードのときはロード中マーカー
    if (!sizes.length) {
      nodes.push(
        <Circle
          key={`mark-${z.id}`}
          x={z.x + Math.min(40, z.width / 2)}
          y={z.y + Math.min(40, z.height / 2)}
          radius={6}
          fill="orange"
          stroke="#444"
          listening={false}
        />
      );
      continue;
    }

    // 並び順の多様化モード（シードから決定）
    // 0: ラウンドロビン / 1: シャッフル / 2: サイズ降順 / 3: 大小交互 / 4: クラスタ優先
    let orderMode = Math.floor(rnd() * 5);

    // URLのいずれかが clusterSimilar なら orderMode=4 を優先
    if (sizes.some((s) => s.cluster)) {
      orderMode = 4;
    }

    // 流し方（行方向のバリエーション）
    // 0: LTR, 1: RTL, 2: スネーク, 3: ブリック（半ピッチ）
    const flowMode = Math.floor(rnd() * 4);
    // スペーシング微調整（±12%）
    const spacingMul = 1 + (rnd() * 0.24 - 0.12);

    // メディアンから概算最大数（“おまかせ”時）
    const needWs = sizes.map((s) => s.needW);
    const needHs = sizes.map((s) => s.needH);
    const mW = median(needWs) * spacingMul;
    const mH = median(needHs) * spacingMul;

    // === 2) シーケンス生成
    let sequence = [];
    if (hasSpecified) {
      const specified = [];
      for (const { url, count } of urlsWithCount) {
        const sz = sizes.find((s) => s.url === url);
        if (!sz) continue;
        for (let k = 0; k < count; k++) specified.push(sz);
      }
      sequence = applyOrder(specified, orderMode, rnd);
    } else {
      const colsMax = Math.max(1, Math.floor(z.width / Math.max(mW, 1)));
      const rowsMax = Math.max(1, Math.floor(z.height / Math.max(mH, 1)));
      const approxCapacity = Math.max(1, colsMax * rowsMax);
      let pool = [...sizes];
      pool = applyOrder(pool, orderMode, rnd);
      for (let i = 0; i < approxCapacity; i++) sequence.push(pool[i % pool.length]);
    }

    // === 3) 棚詰め配置
    const placed = placeShelfPacked({
      z,
      sequence,
      flowMode,
      spacingMul,
      mW,
      clampBBoxIntoZone,
      overridesRef,
      setOverride,
      onRotate: rotateOverride,
      selectedItemKey,
      setSelectedItemKey,
      nodes,
    });

    // === 4) 余白の自動充填
    const fillerCandidates = (() => {
      const fullList = (z.furnitureAssets || []).length
        ? z.furnitureAssets
        : sizes.map((s) => s.url);
      const out = [];
      const seen = new Set();
      for (const u of fullList) {
        if (seen.has(u)) continue;
        const img = getImage(u);
        if (!img) continue;
        const meta = resolveMeta(z, u);
        const { drawWidth, drawHeight } = computeDrawSize(img, meta);
        const clr = clearancePxFromMeta(meta);
        out.push({
          url: u,
          img,
          drawW: drawWidth,
          drawH: drawHeight,
          needW:
            (drawWidth + (clr.left ?? 0) + (clr.right ?? 0)) * spacingMul,
          needH:
            (drawHeight + (clr.front ?? 0) + (clr.back ?? 0)) * spacingMul,
          clr,
          meta,
          cluster:
            meta?.clusterSimilar === true ||
            String(meta?.group).toLowerCase() === "together",
        });
        seen.add(u);
      }
      if (!out.length) return sizes;
      const grouped = groupByUrl(out);
      const blocks = Object.values(grouped);
      shuffleInPlace(blocks, rnd);
      return blocks.flat();
    })();

    autoFillRemaining({
      z,
      placed,
      flowMode,
      spacingMul,
      filler: fillerCandidates,
      clampBBoxIntoZone,
      overridesRef,
      setOverride,
      rnd,
      nodes,
      onRotate: rotateOverride,
      selectedItemKey,
      setSelectedItemKey,
    });
  }

  return <>{nodes}</>;
}

/* ===== 並び順パターン適用 ===== */
function applyOrder(arr, mode, rnd) {
  const a = [...arr];
  switch (mode) {
    case 1: {
      shuffleInPlace(a, rnd);
      return a;
    }
    case 2: {
      return a.sort((x, y) => y.needW * y.needH - x.needW * x.needH);
    }
    case 3: {
      const sorted = a.sort((x, y) => y.needW * y.needH - x.needW * x.needH);
      const out = [];
      let i = 0,
        j = sorted.length - 1;
      while (i <= j) {
        if (i <= j) out.push(sorted[i++]);
        if (i <= j) out.push(sorted[j--]);
      }
      return out;
    }
    case 4: {
      const grouped = groupByUrl(a);
      const blocks = Object.values(grouped);
      blocks.forEach((b) =>
        b.sort((x, y) => y.needW * y.needH - x.needW * x.needH)
      );
      shuffleInPlace(blocks, rnd);
      return blocks.flat();
    }
    case 0:
    default:
      return a;
  }
}

function groupByUrl(arr) {
  const m = {};
  for (const it of arr) {
    m[it.url] = m[it.url] || [];
    m[it.url].push(it);
  }
  return m;
}

/* ===== 棚詰め配置 ===== */
function placeShelfPacked({
  z,
  sequence,
  flowMode,
  spacingMul,
  mW,
  clampBBoxIntoZone,
  overridesRef,
  setOverride,
  onRotate,
  selectedItemKey,
  setSelectedItemKey,
  nodes,
}) {
  const placedRects = [];

  const zoneRight = z.x + z.width;
  const zoneBottom = z.y + z.height;

  let rowY = z.y;
  let rowH = 0;
  let dir = +1; // +1:LTR, -1:RTL
  if (flowMode === 1) dir = -1;
  const brickOffset = flowMode === 3 ? mW / 2 : 0;

  const startXForRow = (rowIndex) => {
    if (flowMode === 2) {
      return rowIndex % 2 === 0 ? z.x : z.x + z.width;
    }
    if (flowMode === 1) return z.x + z.width;
    if (flowMode === 3) return z.x + (rowIndex % 2 ? brickOffset : 0);
    return z.x;
  };

  let rowIndex = 0;
  let curX = startXForRow(rowIndex);

  for (let i = 0; i < sequence.length; i++) {
    const it = sequence[i];
    const needW = it.needW * spacingMul;
    const needH = it.needH * spacingMul;

    const fitsRow =
      dir > 0 ? curX + needW <= zoneRight : curX - needW >= z.x;

    if (!fitsRow) {
      rowY += Math.max(rowH, 1);
      if (rowY + needH > zoneBottom) break;
      rowIndex += 1;
      dir =
        flowMode === 2
          ? rowIndex % 2 === 0
            ? +1
            : -1
          : dir;
      curX = startXForRow(rowIndex);
      rowH = 0;
    }

    const left = dir > 0 ? curX : curX - needW;
    const top = rowY;
    const centerX = left + needW / 2;
    const centerY = top + needH / 2;

    const cl = clampBBoxIntoZone(
      centerX,
      centerY,
      it.drawW,
      it.drawH,
      it.clr,
      z
    );
    let cx = cl.cx,
      cy = cl.cy;

    const itemKey = `${z.id}:${i}:${it.url}`;
    const ov = overridesRef.current.get(itemKey);
    let rotation = ov?.rotation ?? 0;
    if (ov) {
      cx = ov.cx ?? cx;
      cy = ov.cy ?? cy;
    }

    // 家具本体
    nodes.push(
      <KonvaImage
        key={`${z.id}-${i}`}
        image={it.img}
        x={cx}
        y={cy}
        offsetX={it.drawW / 2}
        offsetY={it.drawH / 2}
        width={it.drawW}
        height={it.drawH}
        rotation={rotation}
        draggable
        dragBoundFunc={(p) => {
          const centerX2 = p.x;
          const centerY2 = p.y;
          const cl2 = clampBBoxIntoZone(
            centerX2,
            centerY2,
            it.drawW,
            it.drawH,
            it.clr,
            z
          );
          return { x: cl2.cx, y: cl2.cy };
        }}
        onDragEnd={(e) => {
          const nx = e.target.x();
          const ny = e.target.y();
          const cl2 = clampBBoxIntoZone(
            nx,
            ny,
            it.drawW,
            it.drawH,
            it.clr,
            z
          );
          setOverride(itemKey, { cx: cl2.cx, cy: cl2.cy });
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedItemKey(itemKey);
        }}
        listening
      />
    );

    // 選択中の家具に「回転アイコン」を表示
    if (selectedItemKey === itemKey) {
      const iconSize = 22;
      const gap = 4;
      const baseX = cx + it.drawW / 2 + gap;
      const baseY = cy - it.drawH / 2 - gap;

      nodes.push(
        <Group
          key={`rot-${itemKey}`}
          x={baseX}
          y={baseY}
          onClick={(e) => {
            e.cancelBubble = true;
            onRotate(itemKey, cx, cy, 45);
          }}
        >
          <Rect
            width={iconSize}
            height={iconSize}
            fill="rgba(0,0,0,0.8)"
            cornerRadius={6}
          />
          <Text
            x={4}
            y={2}
            width={iconSize - 8}
            height={iconSize - 4}
            align="center"
            verticalAlign="middle"
            text="⤾"
            fontSize={14}
            fill="#ffffff"
            listening={false}
          />
        </Group>
      );
    }

    placedRects.push({ left, top, width: needW, height: needH });
    rowH = Math.max(rowH, needH);
    curX = dir > 0 ? left + needW : left;
  }

  return { placedRects };
}

/* ===== 余白の自動充填 ===== */
function autoFillRemaining({
  z,
  placed,
  flowMode,
  spacingMul,
  filler,
  clampBBoxIntoZone,
  overridesRef,
  setOverride,
  rnd,
  nodes,
  onRotate,
  selectedItemKey,
  setSelectedItemKey,
}) {
  const zoneRight = z.x + z.width;
  const zoneBottom = z.y + z.height;

  const mW = median(filler.map((f) => f.needW)) || 1;
  const mH = median(filler.map((f) => f.needH)) || 1;

  let curY = placed.placedRects.length
    ? Math.max(...placed.placedRects.map((r) => r.top + r.height))
    : z.y;
  if (curY >= zoneBottom - 1) return;

  let rowH = 0;
  let rowIndex = 0;
  let dir = flowMode === 1 ? -1 : +1;
  if (flowMode === 2) dir = +1;

  const startXForRow = (rowIdx) => {
    if (flowMode === 2) return rowIdx % 2 === 0 ? z.x : z.x + z.width;
    if (flowMode === 1) return z.x + z.width;
    if (flowMode === 3) return z.x + (rowIdx % 2 ? mW / 2 : 0);
    return z.x;
  };
  let curX = startXForRow(rowIndex);

  const grouped = groupByUrl(filler);
  const blocks = Object.values(grouped);
  shuffleInPlace(blocks, rnd);
  const fillSeq = blocks.flat();

  let deadRowCount = 0;

  for (let i = 0; i < 4000; i++) {
    if (curY + Math.max(rowH, mH) > zoneBottom) break;

    let placedThisRow = false;

    for (let k = 0; k < fillSeq.length; k++) {
      const it = fillSeq[
        (k + Math.floor(rnd() * fillSeq.length)) % fillSeq.length
      ];
      const needW = it.needW * spacingMul;
      const needH = it.needH * spacingMul;

      const fitsRow =
        dir > 0 ? curX + needW <= zoneRight : curX - needW >= z.x;
      if (!fitsRow) continue;
      if (curY + needH > zoneBottom) continue;

      const left = dir > 0 ? curX : curX - needW;
      const top = curY;
      const centerX = left + needW / 2;
      const centerY = top + needH / 2;

      const cl = clampBBoxIntoZone(
        centerX,
        centerY,
        it.drawW,
        it.drawH,
        it.clr,
        z
      );
      let cx = cl.cx,
        cy = cl.cy;

      const itemKey = `${z.id}:autofill:${i}:${it.url}`;
      const ov = overridesRef.current.get(itemKey);
      let rotation = ov?.rotation ?? 0;
      if (ov) {
        cx = ov.cx ?? cx;
        cy = ov.cy ?? cy;
      }

      nodes.push(
        <KonvaImage
          key={`af-${z.id}-${i}-${k}`}
          image={it.img}
          x={cx}
          y={cy}
          offsetX={it.drawW / 2}
          offsetY={it.drawH / 2}
          width={it.drawW}
          height={it.drawH}
          rotation={rotation}
          draggable
          dragBoundFunc={(p) => {
            const centerX2 = p.x;
            const centerY2 = p.y;
            const cl2 = clampBBoxIntoZone(
              centerX2,
              centerY2,
              it.drawW,
              it.drawH,
              it.clr,
              z
            );
            return { x: cl2.cx, y: cl2.cy };
          }}
          onDragEnd={(e) => {
            const nx = e.target.x();
            const ny = e.target.y();
            const cl2 = clampBBoxIntoZone(
              nx,
              ny,
              it.drawW,
              it.drawH,
              it.clr,
              z
            );
            setOverride(itemKey, { cx: cl2.cx, cy: cl2.cy });
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            setSelectedItemKey(itemKey);
          }}
          listening
        />
      );

      if (selectedItemKey === itemKey) {
        const iconSize = 22;
        const gap = 4;
        const baseX = cx + it.drawW / 2 + gap;
        const baseY = cy - it.drawH / 2 - gap;

        nodes.push(
          <Group
            key={`rot-af-${itemKey}`}
            x={baseX}
            y={baseY}
            onClick={(e) => {
              e.cancelBubble = true;
              onRotate(itemKey, cx, cy, 45);
            }}
          >
            <Rect
              width={iconSize}
              height={iconSize}
              fill="rgba(0,0,0,0.8)"
              cornerRadius={6}
            />
            <Text
              x={4}
              y={2}
              width={iconSize - 8}
              height={iconSize - 4}
              align="center"
              verticalAlign="middle"
              text="⤾"
              fontSize={14}
              fill="#ffffff"
              listening={false}
            />
          </Group>
        );
      }

      rowH = Math.max(rowH, needH);
      curX = dir > 0 ? left + needW : left;
      placedThisRow = true;
      break;
    }

    if (!placedThisRow) {
      const newY = curY + Math.max(rowH, 1);
      if (newY >= zoneBottom - 1) break;
      curY = newY;
      rowH = 0;
      rowIndex += 1;
      if (flowMode === 2) dir = rowIndex % 2 === 0 ? +1 : -1;
      curX = startXForRow(rowIndex);

      deadRowCount += 1;
      if (deadRowCount >= 2) break;
    } else {
      deadRowCount = 0;
    }
  }
}
