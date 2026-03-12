// ゾーン作図/選択/リサイズ/ドラッグ & ラベルダイアログ制御 & ドラッグ後の座標Override
import { useEffect, useMemo, useRef, useState } from "react";
import { getHoverEdge, edgeToCursor, resizeFromEdge, intersects } from "../utils/geometry";
import { styleForLabel } from "../utils/style";

export default function useZonesInteraction({
  zones = [],
  selectedIds = [],
  onChangeSelectedIds,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
}) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [previewRect, setPreviewRect] = useState(null);

  const [resizing, setResizing] = useState(null);
  const [selectBox, setSelectBox] = useState(null);
  const [selectStart, setSelectStart] = useState(null);

  const [labelDlgOpen, setLabelDlgOpen] = useState(false);
  const [pendingZoneId, setPendingZoneId] = useState(null);

  // 家具ドラッグ後の手動配置
  const overridesRef = useRef(new Map()); // key: `${salt}:${zoneId}:${index}:${url}` → {cx, cy}
  const [, force] = useState(0);
  const overridesApi = useMemo(() => ({
    get: (k) => overridesRef.current.get(k),
    set: (k, v) => { overridesRef.current.set(k, v); force((n) => n + 1); },
    clearAll: () => { overridesRef.current.clear(); force((n) => n + 1); },
  }), []);

  // Delete/Backspace でゾーン削除
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      const tag = (el?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (el && el.isContentEditable);
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach((id) => onDeleteZone?.(id));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, onDeleteZone]);

  // === クリックしたノードが「背景（Stage or Layer）」かどうかを緩く判定 ===
  const isBackgroundNode = (node) => {
    if (!node) return false;
    const cls = node.getClassName?.();
    // Stage か Layer は背景扱い
    if (cls === "Stage" || cls === "Layer") return true;
    // 明示的に名前を付けた要素は背景ではない（下で Rect に name="zone-rect" を付ける）
    const name = node.name?.();
    if (name === "zone-rect" || name === "furniture-image") return false;
    // それ以外の素のノードは基本背景として扱う（空白クリック救済）
    return cls !== "Rect" && cls !== "Image" && cls !== "Text";
  };

  // ステージイベント
  const onStageMouseDown = (e) => {
    const node = e.target;
    const stage = node.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const clickedBackground = isBackgroundNode(node);

    if (clickedBackground && e.evt.shiftKey) {
      setSelectStart(pointer);
      setSelectBox({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      return;
    }

    if (clickedBackground) {
      setIsDrawing(true);
      setDrawStart(pointer);
      setPreviewRect({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      onChangeSelectedIds?.([]);
    }
  };

  const onStageMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

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

  const onStageMouseUp = () => {
    if (selectBox && selectStart) {
      const picked = zones
        .filter((z) => intersects(selectBox, { x: z.x, y: z.y, width: z.width, height: z.height }))
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
        x, y, width: w, height: h,
        label: "",
        fill: "rgba(0,0,0,0)",
        stroke: "#000000",
        strokeWidth: 2,
        draggable: true,
        itemCount: 3,
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

  // ゾーンRectに付与するハンドラ
  const makeRectHandlers = (z, isSel) => {
    const onMouseMove = (e) => {
      const stage = e.target.getStage();
      if (!stage || resizing) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const edge = getHoverEdge(z, pointer);
      stage.container().style.cursor = edge ? edgeToCursor(edge) : isSel ? "move" : "pointer";
    };
    const onMouseLeave = (e) => {
      const stage = e.target.getStage();
      if (!stage || resizing) return;
      stage.container().style.cursor = "default";
    };
    const onMouseDown = (e) => {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      if (e.evt.shiftKey) {
        onChangeSelectedIds?.(isSel ? selectedIds.filter((id) => id !== z.id) : [...selectedIds, z.id]);
      } else {
        onChangeSelectedIds?.([z.id]);
      }

      const edge = getHoverEdge(z, pointer);
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
    const draggable = !resizing && selectedIds.length <= 1;
    const onDragEnd = (e) => {
      const { x, y } = e.target.position();
      onUpdateZone?.(z.id, { x, y });
    };
    return { onMouseMove, onMouseLeave, onMouseDown, draggable, onDragEnd };
  };

  // ラベルダイアログ
  const saveLabel = (label) => {
    setLabelDlgOpen(false);
    if (!pendingZoneId) return;
    const { fill, stroke } = styleForLabel(label);
    onUpdateZone?.(pendingZoneId, { label, fill, stroke });
    onChangeSelectedIds?.([pendingZoneId]);
    setPendingZoneId(null);
  };
  const closeLabelDialog = () => {
    setLabelDlgOpen(false);
    setPendingZoneId(null);
  };

  return {
    // ステージ用
    onStageMouseDown,
    onStageMouseMove,
    onStageMouseUp,

    // ゾーン用
    makeRectHandlers,

    // オーバーレイ描画
    previewRect,
    selectBox,

    // ラベルダイアログ
    labelDlgOpen,
    saveLabel,
    closeLabelDialog,

    // 家具ドラッグ後の手動配置
    overridesApi,
  };
}
