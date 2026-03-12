// ZoneList.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box, Drawer, List, ListItemButton, ListItemText, Divider, Typography,
  Collapse, Stack, TextField, IconButton, MenuItem, Tooltip, InputAdornment,
  Chip, Button, Avatar, Slider
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import ImageIcon from "@mui/icons-material/Image";
import AssetPickerDialog from "./AssetPickerDialog";
import ConditionEvaluation from "./ConditionEvaluation";

import useLayoutStore from "../../../store/useLayoutStore";
import { exportPptxFromZones } from "../../../shared/utils/exportPptxFromZones";

const LABEL_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "商談エリア", label: "商談エリア" },
  { value: "待合エリア", label: "待合エリア" },
  { value: "サービス待合エリア", label: "サービス待合エリア" },
  { value: "事務エリア", label: "事務エリア" },
];

const styleForLabel = (label = "") => {
  if (!label) return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
  if (label.includes("商談")) return { fill: "rgba(220,0,0,0.28)", stroke: "rgba(220,0,0,0.9)" };
  if (label.includes("サービス") && label.includes("待合"))
    return { fill: "rgba(0,120,215,0.28)", stroke: "rgba(0,120,215,0.9)" };
  if (label.includes("待合")) return { fill: "rgba(0,170,80,0.28)", stroke: "rgba(0,170,80,0.9)" };
  if (label.includes("事務")) return { fill: "rgba(128,128,128,0.28)", stroke: "rgba(128,128,128,0.9)" };
  return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
};

// 任意の color を指定αで返す（rgba/rgb/hex対応。その他はそのまま）
function withAlpha(color = "rgba(0,0,0,0)", alpha = 0.28) {
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  // rgba / rgb
  let m = color.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
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

// 現在色からαを推定（rgba のとき）→ なければ undefined
function extractAlpha(color) {
  const m = String(color || "").match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i);
  return m ? Math.max(0, Math.min(1, Number(m[1]) || 0)) : undefined;
}

export default function ZoneList({
  open = true,
  width = 320,
}) {
  const { 
    zones, selectedIds, setSelectedIds, updateZone, deleteZone, 
    saveAssetsForZone, zoneSelections
  } = useLayoutStore();

  const handleExportPptx = useCallback(() => {
    if (!zones.length) {
      alert("ゾーンがありません。先にゾーンを作成してください。");
      return;
    }
    exportPptxFromZones(zones, zoneSelections).catch((err) => {
      console.error(err);
      alert("PowerPoint 出力に失敗しました。コンソールを確認してください。");
    });
  }, [zones, zoneSelections]);

  const onSelect = (id, meta) => {
    if (meta?.shift) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const selected = useMemo(
    () => zones.find((z) => selectedIds.includes(z.id)) || null,
    [zones, selectedIds]
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  // === 全ゾーン共通の透明度（%）。fill も stroke も同じ値を適用 ===
  const [globalAlphaPct, setGlobalAlphaPct] = useState(28); // 既定 28%

  // 選択変更時：選択ゾーンの「fill α or stroke α」を拾って初期値に寄せる（任意）
  useEffect(() => {
    const z = selected;
    if (!z) return;
    const aFill = extractAlpha(z.fill);
    const aStroke = extractAlpha(z.stroke);
    const a = (aFill ?? aStroke);
    if (a != null) setGlobalAlphaPct(Math.round(a * 100));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // スライダー確定時に、全ゾーンへ fill/stroke とも同じαを適用
  const applyAlphaToAllZones = (pct) => {
    const a = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;
    zones.forEach((z) => {
      const base = styleForLabel(z.label);
      const baseFill = z.fill ?? base.fill;
      const baseStroke = z.stroke ?? base.stroke;

      const next = {};
      // 未設定ラベルの fill は透明のまま維持。ただし stroke はスライダー反映。
      if (z.label) next.fill = withAlpha(baseFill, a);
      next.stroke = withAlpha(baseStroke, a);

      updateZone(z.id, next);
    });
  };

  const handleChange = (key, value) => {
    if (!selected) return;
    if (key === "label") {
      const { fill, stroke } = styleForLabel(value);
      const a = globalAlphaPct / 100;
      // ラベル変更時、現在スライダー値を fill・stroke 両方に反映
      updateZone(selected.id, {
        label: value,
        fill: value ? withAlpha(fill, a) : "rgba(0,0,0,0)",
        stroke: withAlpha(stroke, a),
      });
      return;
    }
    updateZone(selected.id, { [key]: value });
  };

  const openPicker = () => setPickerOpen(true);
  const closePicker = () => setPickerOpen(false);

  const savePicker = (urls, metaMap, counts) => {
    if (!selected) return;
    saveAssetsForZone(selected.id, urls, metaMap, counts);
    setPickerOpen(false);
  };

  return (
    <>
      <Drawer
        variant="permanent"
        anchor="right"
        PaperProps={{
          sx: (theme) => {
            const toolbarH = theme.mixins.toolbar?.minHeight ?? 64;
            return {
              width,
              bgcolor: "rgba(250,250,252,0.9)",
              backdropFilter: "blur(6px)",
              position: "fixed",
              right: 0,
              top: toolbarH,
              height: `calc(100vh - ${toolbarH}px)`,
              overflow: "auto",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
            };
          },
        }}
        open={open}
      >
        {/* ヘッダー */}
        <Box sx={{ p: 2, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            ゾーンとレイアウト評価
          </Typography>
        </Box>

        {/* --- 評価コンポーネント --- */}
        <ConditionEvaluation />
        <Divider sx={{ my: 1 }} />


        {/* ★ 全ゾーンの透明度（塗り & 枠線） */}
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            全ゾーンの透明度（塗り & 枠線）
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Slider
              size="small"
              value={globalAlphaPct}
              min={0}
              max={100}
              step={1}
              onChange={(_, val) => setGlobalAlphaPct(val)}
              onChangeCommitted={(_, val) => applyAlphaToAllZones(val)}
              sx={{ flex: 1 }}
            />
            <Typography variant="body2" sx={{ width: 40, textAlign: "right" }}>
              {globalAlphaPct}
            </Typography>
          </Stack>
          <Divider sx={{ mt: 1.5 }} />
        </Box>

        <List dense disablePadding>
          {zones.map((z) => {
            const isSel = selectedIds.includes(z.id);
            const isUnset = !z.label;
            const assets = z.furnitureAssets || [];
            const counts = z.furnitureCounts || {};
            const totalSpecified = Object.values(counts).reduce((s, n) => s + Math.max(0, Number(n) || 0), 0);

            return (
              <Box key={z.id}>
                <ListItemButton
                  selected={isSel}
                  onClick={(e) => onSelect(z.id, { shift: e.shiftKey })}
                  sx={{ py: 1 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                          size="small"
                          variant={isSel ? "filled" : "outlined"}
                          color={isSel ? "primary" : "default"}
                          label={z.label || "未設定"}
                          sx={{ height: 22 }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {Math.round(z.width)}×{Math.round(z.height)}
                        </Typography>
                        <Box
                          sx={{
                            width: 14, height: 14, borderRadius: 0.5, ml: 1,
                            border: "1px solid rgba(0,0,0,0.6)",
                            bgcolor: isUnset ? "transparent" : (z.fill || "transparent"),
                          }}
                          title={isUnset ? "未設定（塗りなし）" : "現在の塗り色"}
                        />
                      </Stack>
                    }
                    secondary={
                      assets.length > 0
                        ? `家具: ${assets.length}件（数量指定: ${totalSpecified}）`
                        : "家具未選定：ゾーン種別に応じて“おまかせ選定”で配置します"
                    }
                  />
                  {isSel ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>

                <Collapse in={isSel} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2, pb: 1 }}>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        size="small"
                        label="ラベル"
                        value={z.label ?? ""}
                        onChange={(e) => handleChange("label", e.target.value)}
                      >
                        {LABEL_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      {/* 家具選定（数量も設定） */}
                      <Stack spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ShoppingBagIcon />}
                          onClick={openPicker}
                          disabled={!z.label}
                        >
                          家具を選定（数量設定可）
                        </Button>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                          {(assets || []).slice(0, 4).map((u) => (
                            <Stack key={u} alignItems="center" spacing={0.25}>
                              <Avatar variant="rounded" src={u} alt="" sx={{ width: 28, height: 28 }} />
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                ×{Math.max(0, Number((counts || {})[u] ?? 0))}
                              </Typography>
                            </Stack>
                          ))}
                          {assets.length > 4 && (
                            <Chip label={`+${assets.length - 4}`} size="small" />
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          家具を選ばない場合は、ゾーンのラベルに応じて“おまかせ”で自動選定・配置します。
                        </Typography>
                      </Stack>

                      {/* 表示オプション（将来用） */}
                      <TextField
                        size="small"
                        type="number"
                        label="画像サイズ（px）"
                        value={z.itemSize ?? 48}
                        onChange={(e) =>
                          handleChange("itemSize", Math.max(8, Math.floor(Number(e.target.value) || 48)))
                        }
                        InputProps={{
                          inputProps: { min: 8, step: 2 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <ImageIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />

                      <Stack direction="row" justifyContent="flex-end">
                        <Tooltip title="削除">
                          <IconButton color="error" size="small" onClick={() => deleteZone(z.id)}>
                            <DeleteOutline />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                  <Divider />
                </Collapse>
              </Box>
            );
          })}
        </List>

      {/* --- 右サイドバー下部（フッター領域） --- */}
        <Box sx={{
          position: "sticky",
          bottom: 0,
          p: 2,
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
        }}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleExportPptx}
            disabled={zones.length === 0}
          >
            パワポ出力
          </Button>
          <Typography
            variant="caption"
            sx={{ mt: 0.5, display: "block", color: "text.secondary" }}
          >
            下部バーで選定した家具を、ゾーンごとに 3×5 のマス張りで
            PowerPoint に出力します（public/assets/selectFurniture のみ対象）。
          </Typography>
        </Box>
      </Drawer>

      {/* 家具選定ダイアログ */}
      {selected && (
        <AssetPickerDialog
          open={pickerOpen}
          zoneLabel={selected.label}
          initialSelected={selected.furnitureAssets || []}
          initialCounts={selected.furnitureCounts || {}}
          onClose={closePicker}
          onSave={savePicker}
          multi
        />
      )}
    </>
  );
}
