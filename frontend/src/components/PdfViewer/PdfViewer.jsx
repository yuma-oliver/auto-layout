// src/components/PdfViewer/PdfViewer.jsx
import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
} from "react";
import { Stage, Layer, Rect, Text, Line, Circle } from "react-konva";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Slider,
  IconButton,
  Box,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoneLabelDialog from "./dialogs/ZoneLabelDialog";
import FurnitureLayoutLayer from "./layers/FurnitureLayoutLayer";
import useWallsInteraction, {
  WALL_CLOSE_RADIUS_PX,
} from "./hooks/useWallsInteraction";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const { getDocument } = pdfjs;

/* =========================
   ユーティリティ（家具以外）
========================= */

/** ラベル → 既定スタイル（ゾーン色） */
const styleForLabel = (label = "") => {
  if (!label) return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
  if (label.includes("商談")) return { fill: "rgba(220,0,0,0.28)", stroke: "rgba(220,0,0,0.9)" };
  if (label.includes("サービス") && label.includes("待合"))
    return { fill: "rgba(0,120,215,0.28)", stroke: "rgba(0,120,215,0.9)" };
  if (label.includes("待合")) return { fill: "rgba(0,170,80,0.28)", stroke: "rgba(0,170,80,0.9)" };
  if (label.includes("事務")) return { fill: "rgba(128,128,128,0.28)", stroke: "rgba(128,128,128,0.9)" };
  return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
};

// ---------- リサイズ/選択系 ----------
const EDGE_TOL = 8;
function getHoverEdge(rect, pointer) {
  const { x, y, width, height } = rect;
  const px = pointer.x;
  const py = pointer.y;
  const left = Math.abs(px - x) <= EDGE_TOL;
  const right = Math.abs(px - (x + width)) <= EDGE_TOL;
  const top = Math.abs(py - y) <= EDGE_TOL;
  const bottom = Math.abs(py - (y + height)) <= EDGE_TOL;
  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (left) return "w";
  if (right) return "e";
  if (top) return "n";
  if (bottom) return "s";
  return null;
}
function edgeToCursor(edge) {
  switch (edge) {
    case "e":
    case "w":
      return "ew-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "move";
  }
}
const MIN_SIZE = 5;
function resizeFromEdge(startRect, edge, dx, dy) {
  let { x, y, width, height } = startRect;
  const applyWest = () => {
    const nw = width - dx;
    if (nw < MIN_SIZE) {
      x += width - MIN_SIZE;
      width = MIN_SIZE;
    } else {
      x += dx;
      width = nw;
    }
  };
  const applyEast = () => (width = Math.max(MIN_SIZE, width + dx));
  const applyNorth = () => {
    const nh = height - dy;
    if (nh < MIN_SIZE) {
      y += height - MIN_SIZE;
      height = MIN_SIZE;
    } else {
      y += dy;
      height = nh;
    }
  };
  const applySouth = () => (height = Math.max(MIN_SIZE, height + dy));
  switch (edge) {
    case "w":
      applyWest();
      break;
    case "e":
      applyEast();
      break;
    case "n":
      applyNorth();
      break;
    case "s":
      applySouth();
      break;
    case "nw":
      applyWest();
      applyNorth();
      break;
    case "ne":
      applyEast();
      applyNorth();
      break;
    case "sw":
      applyWest();
      applySouth();
      break;
    case "se":
      applyEast();
      applySouth();
      break;
    default:
      break;
  }
  return { x, y, width, height };
}
function intersects(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/** 壁ポリゴンの外接矩形を計算 */
function computeBoundingBox(points = []) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/* ====== 自動ゾーン生成設定 ====== */
const AUTO_ZONE_LABELS = ["商談エリア", "サービス待合エリア", "待合エリア"];
// 壁から内側にオフセット（大きめに取って「はみ出し感」を防ぐ）
const ZONE_MARGIN = 20;
const ZONE_PATTERNS_COUNT = 3;

/**
 * 壁とパターン番号からゾーン配列を生成（id 以外）
 * → 壁の枠からはみ出さないように、bounding box から margin を引いた中だけ使う
 */
function generateZonesForWall(wall, patternIndex) {
  const bbox = computeBoundingBox(wall.points);
  if (!bbox.width || !bbox.height) return [];

  let { x, y, width, height } = bbox;

  // 壁から少し内側にオフセット（視覚的にはみ出さないように）
  let margin = ZONE_MARGIN;
  const maxMargin = Math.min(width / 4, height / 4);
  if (maxMargin <= 0) {
    margin = 0;
  } else {
    margin = Math.min(margin, maxMargin);
  }
  if (margin > 0) {
    x += margin;
    y += margin;
    width -= margin * 2;
    height -= margin * 2;
  }
  if (width <= 0 || height <= 0) return [];

  const labels = AUTO_ZONE_LABELS;
  const p = ((patternIndex % ZONE_PATTERNS_COUNT) + ZONE_PATTERNS_COUNT) % ZONE_PATTERNS_COUNT;
  const wallId = wall.id;

  const innerPad = 4; // さらに1ゾーンごとに内側に少しだけ縮める

  const makeZone = (idx, zx, zy, zw, zh, label) => {
    let x2 = zx + innerPad;
    let y2 = zy + innerPad;
    let w2 = Math.max(0, zw - innerPad * 2);
    let h2 = Math.max(0, zh - innerPad * 2);

    const { fill, stroke } = styleForLabel(label);
    return {
      wallId,
      autoGenerated: true,
      x: x2,
      y: y2,
      width: w2,
      height: h2,
      label,
      fill,
      stroke,
      strokeWidth: 2,
      draggable: true,
      furnitureAssets: [],
      placementMode: "sequence",
      furnitureMetaMap: {},
      furnitureCounts: {},
    };
  };

  const zones = [];

  if (p === 0) {
    // パターン0：縦3分割
    const count = labels.length;
    const colW = width / count;
    labels.forEach((label, i) => {
      zones.push(makeZone(i, x + colW * i, y, colW, height, label));
    });
  } else if (p === 1) {
    // パターン1：横3分割
    const count = labels.length;
    const rowH = height / count;
    labels.forEach((label, i) => {
      zones.push(makeZone(i, x, y + rowH * i, width, rowH, label));
    });
  } else if (p === 2) {
    // パターン2：左半分 = 商談、右半分を上下2分割
    const leftW = width * 0.5;
    const rightW = width - leftW;
    const halfH = height / 2;
    zones.push(makeZone(0, x, y, leftW, height, labels[0])); // 商談
    zones.push(makeZone(1, x + leftW, y, rightW, halfH, labels[1])); // サービス待合
    zones.push(makeZone(2, x + leftW, y + halfH, rightW, halfH, labels[2])); // 待合
  }

  return zones;
}

import useAppStore from "../../store/useAppStore";
import useLayoutStore from "../../store/useLayoutStore";

/* ==========================================================
   本体（PDF表示／ゾーン管理／ズームUI）
========================================================== */
const PdfViewer = forwardRef(function PdfViewer(
  {
    rightPadding = 320,
    fitBy = "width", // "width" | "depth"
  },
  ref
) {
  const { pdfFile: file, scaleDenom, paperSizeMm } = useAppStore();
  const {
    zones, selectedIds, setSelectedIds: onChangeSelectedIds,
    addZone: onAddZone, updateZone: onUpdateZone, deleteZone: onDeleteZone,
    layoutItems
  } = useLayoutStore();
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [pdfImageUrl, setPdfImageUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [paperMmAuto, setPaperMmAuto] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ w: 0, h: 0, scale: 1 });
  const [zoom, setZoom] = useState(1);

  // 描画モード："zone" | "wall"
  const [drawMode, setDrawMode] = useState("zone");
  // 壁閉じ判定中のビジュアル強調フラグ
  const [isWallClosingHint, setIsWallClosingHint] = useState(false);
  // ゾーン自動生成パターン
  const [zonePatternIndex, setZonePatternIndex] = useState(0);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [previewRect, setPreviewRect] = useState(null);

  const [resizing, setResizing] = useState(null);
  const [selectBox, setSelectBox] = useState(null);
  const [selectStart, setSelectStart] = useState(null);

  const [labelDlgOpen, setLabelDlgOpen] = useState(false);
  const [pendingZoneId, setPendingZoneId] = useState(null);

  // ----- 壁が閉じたときのコールバック（ゾーン生成） -----
  const handleWallClosed = useCallback(
    (wall) => {
      const baseZones = generateZonesForWall(wall, zonePatternIndex);
      if (!baseZones.length) return;

      const createdZones = baseZones.map((z, idx) => {
        const id = Date.now() + idx + Math.floor(Math.random() * 1000);
        const zoneObj = { ...z, id };
        onAddZone?.(zoneObj);
        return zoneObj;
      });

      if (createdZones[0]) {
        onChangeSelectedIds?.([createdZones[0].id]);
      }
    },
    [zonePatternIndex, onAddZone, onChangeSelectedIds]
  );

  // ----- 壁作図フック -----
  const {
    walls,
    activePoints: activeWallPoints,
    isDrawingWall,
    handleWallClick,
    undoLastPoint,
    updateWallPoint,
  } = useWallsInteraction({
    onWallClosed: handleWallClosed,
  });

  // ----- PDF読み込み -----
  useEffect(() => {
    const load = async () => {
      if (!file) {
        setPdfImageUrl(null);
        setNatural({ w: 0, h: 0 });
        setPaperMmAuto({ w: 0, h: 0 });
        return;
      }
      try {
        const pdf = await getDocument(file).promise;
        const page = await pdf.getPage(1);

        // 用紙サイズ(mm)を自動推定（1pt=1/72in）
        const [x0, y0, x1, y1] = page.view;
        const pageWidthPt = x1 - x0;
        const pageHeightPt = y1 - y0;
        const MM_PER_INCH = 25.4;
        const autoW = (pageWidthPt / 72) * MM_PER_INCH;
        const autoH = (pageHeightPt / 72) * MM_PER_INCH;
        setPaperMmAuto({ w: autoW, h: autoH });

        // レンダリング
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;

        setPdfImageUrl(canvas.toDataURL("image/png"));
        setNatural({ w: viewport.width, h: viewport.height });
      } catch (error) {
        console.error("PDFの読み込みまたはレンダリングに失敗しました:", error);
      }
    };
    load();
  }, [file]);

  // ----- フィット -----
  useEffect(() => {
    const fit = () => {
      if (!containerRef.current || !natural.w || !natural.h) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
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
  }, [natural.w, natural.h]);

  // ----- PNG出力 -----
  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      if (!pdfImageUrl || !stageRef.current || view.w <= 0 || view.h <= 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = view.w;
      canvas.height = view.h;
      const ctx = canvas.getContext("2d");
      const bg = new Image();
      bg.onload = () => {
        ctx.drawImage(bg, 0, 0, view.w, view.h);
        const overlay = stageRef.current.toCanvas({ pixelRatio: 1 });
        ctx.drawImage(overlay, 0, 0);
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = "layout.png";
        a.click();
      };
      bg.src = pdfImageUrl;
    },
  }));

  // ----- Delete / Backspace / Z / W キー -----
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      const tag = (el?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (el && el.isContentEditable);
      if (typing) return;

      // 壁作図中の Backspace → 最後の点を削除
      if (e.key === "Backspace" && drawMode === "wall" && isDrawingWall) {
        e.preventDefault();
        undoLastPoint();
        return;
      }

      // ゾーン削除
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        if (drawMode === "wall" && isDrawingWall) return;
        e.preventDefault();
        selectedIds.forEach((id) => onDeleteZone?.(id));
        return;
      }

      // 描画モード切り替え：Z = ゾーン作図 / W = 壁作図
      if (e.key === "z" || e.key === "Z") {
        setDrawMode("zone");
      } else if (e.key === "w" || e.key === "W") {
        setDrawMode("wall");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, onDeleteZone, drawMode, isDrawingWall, undoLastPoint]);

  // ----- モード変更時のカーソルベース設定 + ヒントリセット -----
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    if (!container) return;

    if (drawMode === "zone") {
      container.style.cursor = "crosshair";
      setIsWallClosingHint(false);
    } else if (drawMode === "wall") {
      container.style.cursor = "cell";
      setIsWallClosingHint(false);
    }
  }, [drawMode]);

  // ----- ゾーン再生成ボタン -----
  const handleRegenerateZones = useCallback(() => {
    if (!walls.length) return;

    const nextPattern = (zonePatternIndex + 1) % ZONE_PATTERNS_COUNT;
    setZonePatternIndex(nextPattern);

    const wallIdSet = new Set(walls.map((w) => w.id));

    // 既存の自動生成ゾーンを削除
    zones
      .filter((z) => z.wallId && wallIdSet.has(z.wallId) && z.autoGenerated)
      .forEach((z) => onDeleteZone?.(z.id));

    // 各壁ごとに新しいパターンでゾーン生成
    const createdIds = [];
    walls.forEach((wall) => {
      const baseZones = generateZonesForWall(wall, nextPattern);
      baseZones.forEach((z, idx) => {
        const id = Date.now() + idx + Math.floor(Math.random() * 100000);
        const zoneObj = { ...z, id };
        onAddZone?.(zoneObj);
        createdIds.push(id);
      });
    });

    if (createdIds.length) {
      onChangeSelectedIds?.([createdIds[0]]);
    }
  }, [walls, zones, zonePatternIndex, onDeleteZone, onAddZone, onChangeSelectedIds]);

  // ----- ステージ操作（ゾーン作図/選択/リサイズ/壁作図） -----
  const handleStageMouseDown = (e) => {
    const stage = e.target.getStage();
    const isBg = e.target === stage;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // 壁作図モード
    if (drawMode === "wall") {
      if (isBg) {
        handleWallClick(pointer);
      }
      return;
    }

    // ゾーンモード
    if (isBg && e.evt.shiftKey) {
      setSelectStart(pointer);
      setSelectBox({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      return;
    }
    if (isBg) {
      setIsDrawing(true);
      setDrawStart(pointer);
      setPreviewRect({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      onChangeSelectedIds?.([]);
    }
  };

  const handleStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const container = stageRef.current?.container?.();

    // 壁作図モード：始点付近に来たらカーソルとヒントを変更
    if (drawMode === "wall") {
      if (!container) return;

      if (isDrawingWall && activeWallPoints.length >= 2) {
        const first = { x: activeWallPoints[0], y: activeWallPoints[1] };
        const dx = pointer.x - first.x;
        const dy = pointer.y - first.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= WALL_CLOSE_RADIUS_PX) {
          container.style.cursor = "pointer";
          if (!isWallClosingHint) setIsWallClosingHint(true);
        } else {
          container.style.cursor = "cell";
          if (isWallClosingHint) setIsWallClosingHint(false);
        }
      } else {
        container.style.cursor = "cell";
        if (isWallClosingHint) setIsWallClosingHint(false);
      }
      return;
    }

    // ゾーンモード
    if (selectStart) {
      const x = Math.min(selectStart.x, pointer.x);
      const y = Math.min(selectStart.y, pointer.y);
      const w = Math.abs(pointer.x - selectStart.x);
      const h = Math.abs(pointer.y - selectStart.y);
      setSelectBox({ x, y, width: w, height: h });
      return;
    }
    if (resizing) {
      const dx = pointer.x - resizing.startPointer.x;
      const dy = pointer.y - resizing.startPointer.y;
      const next = resizeFromEdge(resizing.startRect, resizing.edge, dx, dy);
      onUpdateZone?.(resizing.id, next);
      return;
    }
    if (isDrawing && drawStart) {
      const x = Math.min(drawStart.x, pointer.x);
      const y = Math.min(drawStart.y, pointer.y);
      const w = Math.abs(pointer.x - drawStart.x);
      const h = Math.abs(pointer.y - drawStart.y);
      setPreviewRect({ x, y, width: w, height: h });
    }
  };

  const handleStageMouseUp = () => {
    // 壁モードではドラッグアップ処理なし
    if (drawMode === "wall") return;

    if (selectBox && selectStart) {
      const picked = zones
        .filter((z) =>
          intersects(selectBox, { x: z.x, y: z.y, width: z.width, height: z.height })
        )
        .map((z) => z.id);
      onChangeSelectedIds?.(picked);
      setSelectStart(null);
      setSelectBox(null);
      return;
    }
    if (resizing) {
      setResizing(null);
      return;
    }
    if (!isDrawing || !previewRect) return;
    const { x, y, width: w, height: h } = previewRect;
    if (w > 3 && h > 3) {
      const newZone = {
        id: Date.now(),
        x,
        y,
        width: w,
        height: h,
        label: "",
        fill: "rgba(0,0,0,0)",
        stroke: "#000000",
        strokeWidth: 2,
        draggable: true,
        furnitureAssets: [],
        placementMode: "sequence",
        furnitureMetaMap: {},
        furnitureCounts: {},
      };
      onAddZone?.(newZone);
      onChangeSelectedIds?.([newZone.id]);
      setPendingZoneId(newZone.id);
      setLabelDlgOpen(true);
    }
    setIsDrawing(false);
    setPreviewRect(null);
  };

  const makeRectHandlers = (z, isSel, allowResize, drawMode) => {
    const onMouseMove = () => {
      const stage = stageRef.current;
      if (!stage || resizing) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      if (drawMode === "wall") {
        stage.container().style.cursor = "cell";
        return;
      }

      const edge = allowResize ? getHoverEdge(z, pointer) : null;
      stage.container().style.cursor = edge ? edgeToCursor(edge) : isSel ? "move" : "pointer";
    };
    const onMouseLeave = () => {
      const stage = stageRef.current;
      if (!stage || resizing) return;

      if (drawMode === "wall") {
        stage.container().style.cursor = "cell";
        return;
      }
      stage.container().style.cursor = "default";
    };
    const onMouseDown = (e) => {
      if (drawMode === "wall") return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      if (e.evt.shiftKey) {
        onChangeSelectedIds?.(
          isSel ? selectedIds.filter((id) => id !== z.id) : [...selectedIds, z.id]
        );
      } else {
        onChangeSelectedIds?.([z.id]);
      }
      const edge = allowResize ? getHoverEdge(z, pointer) : null;
      if (edge && !e.evt.shiftKey && selectedIds.length <= 1) {
        e.cancelBubble = true;
        setResizing({
          id: z.id,
          edge,
          startPointer: { x: pointer.x, y: pointer.y },
          startRect: { x: z.x, y: z.y, width: z.width, height: z.height },
        });
      }
    };
    const draggable = drawMode === "wall" ? false : !resizing && selectedIds.length <= 1;
    const onDragEnd = (e) => {
      if (drawMode === "wall") return;
      const { x, y } = e.target.position();
      onUpdateZone?.(z.id, { x, y });
    };
    return { onMouseMove, onMouseLeave, onMouseDown, draggable, onDragEnd };
  };

  const handleSaveLabel = (label) => {
    setLabelDlgOpen(false);
    if (!pendingZoneId) return;
    const { fill, stroke } = styleForLabel(label);
    onUpdateZone?.(pendingZoneId, { label, fill, stroke });
    onChangeSelectedIds?.([pendingZoneId]);
    setPendingZoneId(null);
  };
  const handleCloseLabel = () => {
    setLabelDlgOpen(false);
    setPendingZoneId(null);
  };

  // ====== スケール（px/mm） ======
  const paperW = paperSizeMm.w > 0 ? paperSizeMm.w : paperMmAuto.w;
  const paperH = paperSizeMm.h > 0 ? paperSizeMm.h : paperMmAuto.h;

  const pxPerPaperMmX = natural.w > 0 && paperW > 0 ? natural.w / paperW : 0;
  const pxPerPaperMmY = natural.h > 0 && paperH > 0 ? natural.h / paperH : 0;

  const pxPerPaperMm =
    pxPerPaperMmX && pxPerPaperMmY
      ? (pxPerPaperMmX + pxPerPaperMmY) / 2
      : pxPerPaperMmX || pxPerPaperMmY || 0;

  const pxPerRealMm = useMemo(() => {
    if (!pxPerPaperMm || !scaleDenom) return 0;
    return pxPerPaperMm / scaleDenom;
  }, [pxPerPaperMm, scaleDenom]);

  const wrapperStyle = useMemo(
    () => ({
      position: "relative",
      width: `${view.w}px`,
      height: `${view.h}px`,
      transform: `scale(${zoom})`,
      transformOrigin: "top left",
      margin: "0 auto",
    }),
    [view.w, view.h, zoom]
  );

  const canRenderStage = !!pdfImageUrl && view.w > 0 && view.h > 0;

  const modeLabel = drawMode === "wall" ? "壁作図モード (W)" : "ゾーン作図モード (Z)";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflow: "auto",
        background: "#f5f5f5",
        width: "100%",
        height: "100%",
        paddingRight: 0,
      }}
    >
      {canRenderStage ? (
        <div style={wrapperStyle}>
          <img
            src={pdfImageUrl}
            alt="PDF"
            style={{ width: `${view.w}px`, height: `${view.h}px`, display: "block" }}
          />

          {/* モード表示（左上） */}
          <Box
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: "rgba(0,0,0,0.6)",
              color: "#fff",
              borderRadius: 1,
              px: 1.2,
              py: 0.4,
              fontSize: 11,
              zIndex: 10,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              {modeLabel}
            </Typography>
          </Box>

          <div style={{ position: "absolute", inset: 0 }}>
            <Stage
              ref={stageRef}
              width={view.w}
              height={view.h}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              style={{ pointerEvents: "auto" }}
            >
              <Layer>
                {/* ====== 壁描画 ====== */}
                {walls.map((w) => (
                  <Line
                    key={w.id}
                    points={w.points}
                    closed
                    stroke="rgba(40,40,40,0.9)"
                    strokeWidth={2}
                    listening={drawMode === "wall"} // ★ ゾーンモードではクリックを透過
                  />
                ))}
                {/* 描画中の壁ライン */}
                {isDrawingWall && activeWallPoints.length >= 4 && (
                  <Line
                    points={activeWallPoints}
                    stroke="rgba(40,40,40,0.7)"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                  />
                )}
                {/* 描画中の各ポイント（小さな点） */}
                {isDrawingWall &&
                  activeWallPoints.length >= 2 &&
                  activeWallPoints.map((_, idx) => {
                    if (idx % 2 === 1) return null;
                    const x = activeWallPoints[idx];
                    const y = activeWallPoints[idx + 1];
                    return (
                      <Circle
                        key={`active-pt-${idx / 2}`}
                        x={x}
                        y={y}
                        radius={3}
                        fill="#ffffff"
                        stroke="rgba(0,0,0,0.6)"
                        strokeWidth={1}
                        listening={false}
                      />
                    );
                  })}
                {/* 壁の始点ガイドサークル */}
                {isDrawingWall && activeWallPoints.length >= 2 && (
                  <Circle
                    x={activeWallPoints[0]}
                    y={activeWallPoints[1]}
                    radius={WALL_CLOSE_RADIUS_PX}
                    fill={
                      isWallClosingHint
                        ? "rgba(0, 200, 0, 0.35)"
                        : "rgba(0, 0, 0, 0.12)"
                    }
                    stroke={
                      isWallClosingHint
                        ? "rgba(0, 140, 0, 0.9)"
                        : "rgba(0, 0, 0, 0.4)"
                    }
                    strokeWidth={1}
                    listening={false}
                  />
                )}

                {/* 確定した壁の頂点ハンドル（ドラッグで移動可能 / 壁モードのみ反応） */}
                {walls.map((w) =>
                  w.points.map((_, idx) => {
                    if (idx % 2 === 1) return null;
                    const pointIndex = idx / 2;
                    const x = w.points[idx];
                    const y = w.points[idx + 1];
                    return (
                      <Circle
                        key={`${w.id}-pt-${pointIndex}`}
                        x={x}
                        y={y}
                        radius={4}
                        fill="#ffffff"
                        stroke="rgba(0,0,0,0.8)"
                        strokeWidth={1}
                        draggable={drawMode === "wall"}
                        listening={drawMode === "wall"}
                        onDragMove={(evt) => {
                          if (drawMode !== "wall") return;
                          const node = evt.target;
                          const pos = node.position();
                          updateWallPoint(w.id, pointIndex, pos.x, pos.y);
                        }}
                      />
                    );
                  })
                )}

                {/* ====== ゾーン描画 ====== */}
                {zones.map((z) => {
                  const isSel = selectedIds.includes(z.id);
                  const isUnset = !z.label;
                  const allowResize = selectedIds.length <= 1 && isSel;
                  const handlers = makeRectHandlers(z, isSel, allowResize, drawMode);
                  return (
                    <React.Fragment key={z.id}>
                      <Rect
                        id={`zone-${z.id}`}
                        x={z.x}
                        y={z.y}
                        width={z.width}
                        height={z.height}
                        fill={isUnset ? "rgba(0,0,0,0)" : z.fill ?? "rgba(0,0,0,0)"}
                        stroke={isSel ? "#8fc7ffff" : isUnset ? "#000000" : z.stroke ?? "#000000"}
                        strokeWidth={
                          isSel ? Math.max(0.1, z.strokeWidth || 0.1) : z.strokeWidth || 0.1
                        }
                        shadowForStrokeEnabled
                        shadowBlur={isSel ? 3 : 0}
                        shadowColor={isSel ? "rgba(25,118,210,0.6)" : "transparent"}
                        onMouseMove={handlers.onMouseMove}
                        onMouseLeave={handlers.onMouseLeave}
                        onMouseDown={handlers.onMouseDown}
                        draggable={handlers.draggable}
                        onDragEnd={handlers.onDragEnd}
                      />
                      {z.label && (
                        <Text x={z.x + 6} y={z.y + 6} text={z.label} fontSize={14} fill="#003366" />
                      )}
                    </React.Fragment>
                  );
                })}

                {/* ====== 家具配置（選択ゾーンのみ再レイアウト） ====== */}
                {Array.isArray(layoutItems) && pxPerRealMm > 0 && (
                  <FurnitureLayoutLayer
                    zones={zones}
                    layoutItems={layoutItems}
                    fitBy={fitBy}
                    pxPerRealMm={pxPerRealMm}
                    selectedIds={selectedIds}
                  />
                )}

                {/* ゾーン作図プレビュー（矩形） */}
                {previewRect && drawMode === "zone" && (
                  <Rect
                    {...previewRect}
                    fill="rgba(0,128,255,0.16)"
                    stroke="rgba(0,128,255,0.9)"
                    dash={[6, 4]}
                    strokeWidth={2}
                  />
                )}

                {/* 範囲選択 */}
                {selectBox && drawMode === "zone" && (
                  <Rect
                    x={selectBox.x}
                    y={selectBox.y}
                    width={selectBox.width}
                    height={selectBox.height}
                    fill="rgba(100, 150, 255, 0.12)"
                    stroke="rgba(100, 150, 255, 0.9)"
                    dash={[4, 3]}
                    strokeWidth={1.5}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      ) : (
        <div style={{ padding: 24, color: "#666" }}>
          {pdfImageUrl ? "レイアウトを準備中..." : "PDFをアップロードしてください"}
        </div>
      )}

      {/* ズーム + モードスイッチ UI */}
      {pdfImageUrl && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8 + rightPadding,
            bgcolor: "rgba(255,255,255,0.9)",
            borderRadius: 2,
            px: 1,
            py: 0.75,
            boxShadow: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
          }}
        >
          {/* スイッチボタン（ゾーン / 壁） */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={drawMode}
            onChange={(e, value) => {
              if (!value) return;
              setDrawMode(value);
            }}
          >
            <ToggleButton value="zone">ゾーン</ToggleButton>
            <ToggleButton value="wall">壁</ToggleButton>
          </ToggleButtonGroup>

          {/* ゾーン再生成 */}
          <Button
            size="small"
            variant="outlined"
            onClick={handleRegenerateZones}
            sx={{ mt: 0.25, textTransform: "none" }}
          >
            ゾーン再生成
          </Button>

          {/* ズームスライダー */}
          <Box sx={{ display: "flex", alignItems: "center", mt: 0.25 }}>
            <Slider
              size="small"
              value={zoom}
              min={0.5}
              max={2}
              step={0.05}
              onChange={(e, val) => setZoom(val)}
              sx={{ width: 120, mr: 1 }}
            />
            <Tooltip title="リセット">
              <IconButton size="small" onClick={() => setZoom(1)}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      <ZoneLabelDialog open={labelDlgOpen} onClose={handleCloseLabel} onSave={handleSaveLabel} />
    </div>
  );
});

export default PdfViewer;
