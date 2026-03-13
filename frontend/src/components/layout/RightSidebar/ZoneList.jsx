// ZoneList.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box, Drawer, List, ListItemButton, ListItemText, Divider, Typography,
  Collapse, Stack, TextField, IconButton, MenuItem, Tooltip, InputAdornment,
  Chip, Button, Avatar, Slider, Tabs, Tab
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
    saveAssetsForZone, zoneSelections, plans, currentPlanId, savePlan, loadPlan, deletePlan
  } = useLayoutStore();

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
  const [tabIndex, setTabIndex] = useState(0);
  const [newPlanName, setNewPlanName] = useState("");
  const [planPanelHeight, setPlanPanelHeight] = useState(250);

  const startDragPlanPanel = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = planPanelHeight;
    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY;
      setPlanPanelHeight(Math.max(100, Math.min(800, startH + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
            };
          },
        }}
        open={open}
      >
        <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} variant="fullWidth" sx={{ minHeight: 48, flexShrink: 0, '& .MuiTab-root': { py: 1, minHeight: 48 } }}>
          <Tab label="エリア設定" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }} />
          <Tab label="評価" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }} />
        </Tabs>
        <Divider />

        <Box sx={{ flex: 1, overflow: "auto" }}>
          {tabIndex === 1 && (
          <Box>
            <ConditionEvaluation />
          </Box>
        )}

        {tabIndex === 0 && (
          <Box>
            {/* ★ 全ゾーンの透明度（塗り & 枠線） */}
            <Box sx={{ px: 2, pt: 1, pb: 1 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: "bold" }}>
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
                  {globalAlphaPct}%
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
          </Box>
        )}
        </Box>

        {/* --- 保存プラン領域 (ドラッグで高さ可変) --- */}
        <Box 
          onMouseDown={startDragPlanPanel}
          sx={{ 
            height: 8, 
            cursor: "row-resize", 
            bgcolor: "divider", 
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            '&:hover': { bgcolor: "primary.main" },
            transition: 'background-color 0.2s',
          }} 
        >
          <Box sx={{ width: 40, height: 4, bgcolor: "rgba(0,0,0,0.2)", borderRadius: 2 }} />
        </Box>
        <Box sx={{ p: 2, bgcolor: "rgba(250,250,252,0.9)", height: planPanelHeight, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1.5 }}>現在の状態を保存 (プラン)</Typography>
          
          <Stack spacing={1} sx={{ mb: 2 }}>
            {currentPlanId && (
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => savePlan()}
                fullWidth
                size="small"
                sx={{ fontWeight: "bold" }}
              >
                現在読込中のプランを上書き保存
              </Button>
            )}
            
            <Stack direction="row" spacing={1}>
              <TextField 
                size="small" 
                placeholder="プラン名 (任意)" 
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                fullWidth 
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    savePlan(newPlanName, true);
                    setNewPlanName("");
                  }
                }}
              />
              <Button 
                variant="contained" 
                onClick={() => {
                  savePlan(newPlanName, true);
                  setNewPlanName("");
                }}
                sx={{ whiteSpace: "nowrap" }}
              >
                新規保存
              </Button>
            </Stack>
          </Stack>

          <Typography variant="caption" sx={{ fontWeight: "bold", mb: 1, display: "block", color: "text.secondary" }}>保存されたプラン</Typography>
          {plans.length === 0 && <Typography variant="caption" color="text.secondary">保存されたプランはありません</Typography>}
          <List dense sx={{ flex: 1, overflow: "auto", p: 0 }}>
            {plans.map((p) => {
              const isActive = p.id === currentPlanId;
              return (
                <Box 
                  key={p.id} 
                  sx={{ 
                    mb: 0.5, 
                    border: isActive ? '2px solid' : '1px solid', 
                    borderColor: isActive ? 'primary.main' : 'divider', 
                    borderRadius: 1, 
                    bgcolor: isActive ? 'primary.50' : 'background.paper', 
                    display: 'flex', 
                    alignItems: 'center',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <ListItemButton onClick={() => loadPlan(p.id)} sx={{ py: 0.5 }}>
                    <ListItemText 
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: isActive ? 'primary.main' : 'text.primary', display: 'flex', alignItems: 'center' }}>
                            {p.name}
                            {isActive && <Typography component="span" variant="caption" sx={{ ml: 1, px: 0.5, bgcolor: 'primary.main', color: 'white', borderRadius: 1, fontSize: '0.65rem' }}>読込中</Typography>}
                          </Typography>
                        }
                        secondary={new Date(p.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                        secondaryTypographyProps={{ variant: "caption", color: isActive ? 'primary.main' : 'text.secondary' }}
                    />
                  </ListItemButton>
                  <IconButton size="small" color="error" onClick={() => deletePlan(p.id)} sx={{ mr: 0.5 }}>
                      <DeleteOutline fontSize="small" />
                  </IconButton>
                </Box>
              )
            })}
          </List>
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
