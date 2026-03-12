// src/components/PdfViewer/hooks/useWallsInteraction.js
import { useCallback, useState } from "react";

/** 壁を閉じるときの「始点判定半径」（px） */
export const WALL_CLOSE_RADIUS_PX = 12;

function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 壁作図用カスタムフック
 *
 * - 背景クリックで点を追加していき、最初の点の近くをクリックすると閉じた壁になる
 * - 壁が閉じたタイミングで onWallClosed(wall) をコールバック
 * - activePoints: 描画中の壁の点列 [x0, y0, x1, y1, ...]
 * - walls: 確定した壁（ポリゴン）の配列 [{ id, points }]
 */
export default function useWallsInteraction({ onWallClosed } = {}) {
  const [walls, setWalls] = useState([]); // 確定した壁
  const [activePoints, setActivePoints] = useState([]); // 描画中の壁
  const [isDrawingWall, setIsDrawingWall] = useState(false);

  /**
   * ステージ上をクリックしたときに呼ぶハンドラ
   * @param {{x:number, y:number}} pointer
   */
  const handleWallClick = useCallback(
    (pointer) => {
      if (!pointer) return;

      // まだ壁描画を開始していない → 最初の点を追加
      if (!isDrawingWall || activePoints.length === 0) {
        setIsDrawingWall(true);
        setActivePoints([pointer.x, pointer.y]);
        return;
      }

      // 開始済み：最初の点に近ければ閉じる
      if (activePoints.length >= 4) {
        const first = { x: activePoints[0], y: activePoints[1] };
        if (distance(pointer, first) <= WALL_CLOSE_RADIUS_PX) {
          // 壁を確定
          const finalPoints = [...activePoints];
          const wall = {
            id: Date.now(),
            points: finalPoints,
          };
          setWalls((prev) => [...prev, wall]);
          setIsDrawingWall(false);
          setActivePoints([]);

          // コールバック：枠内でゾーンを自動生成など
          if (typeof onWallClosed === "function") {
            onWallClosed(wall);
          }
          return;
        }
      }

      // それ以外は点を追加
      setActivePoints((prev) => [...prev, pointer.x, pointer.y]);
    },
    [activePoints, isDrawingWall, onWallClosed]
  );

  /** 描画中の壁の最後の点を1つ戻す（Backspace 用） */
  const undoLastPoint = useCallback(() => {
    setActivePoints((prev) => {
      if (prev.length <= 2) {
        // 残り1点以下ならキャンセル扱い
        setIsDrawingWall(false);
        return [];
      }
      // 最後の (x, y) を削除
      return prev.slice(0, -2);
    });
  }, []);

  /** 描画中の壁を完全にキャンセル（必要ならUIから使う想定） */
  const cancelActiveWall = useCallback(() => {
    setIsDrawingWall(false);
    setActivePoints([]);
  }, []);

  /** すべての壁をクリア（必要ならUIから使う想定） */
  const clearWalls = useCallback(() => {
    setWalls([]);
    setIsDrawingWall(false);
    setActivePoints([]);
  }, []);

  /**
   * 確定済みの壁の頂点（pointIndex）を移動
   * @param {number} wallId
   * @param {number} pointIndex 0始まりの頂点インデックス
   * @param {number} x
   * @param {number} y
   */
  const updateWallPoint = useCallback((wallId, pointIndex, x, y) => {
    setWalls((prev) =>
      prev.map((w) => {
        if (w.id !== wallId) return w;
        const pts = [...w.points];
        const base = pointIndex * 2;
        if (base >= 0 && base + 1 < pts.length) {
          pts[base] = x;
          pts[base + 1] = y;
        }
        return { ...w, points: pts };
      })
    );
  }, []);

  return {
    walls,
    activePoints,
    isDrawingWall,
    handleWallClick,
    undoLastPoint,
    cancelActiveWall,
    clearWalls,
    updateWallPoint,
  };
}
