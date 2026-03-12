// src/components/AssetPickerDialog.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, ImageList, ImageListItem, Checkbox, Box, Stack, Typography, Chip,
  IconButton, TextField, Tooltip, Divider
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import DeselectRoundedIcon from "@mui/icons-material/DeselectRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { furnitureRegistry, zoneKeyFromLabel } from "../../../shared/assets/furnitureRegistry";

/** ミニステッパー（数量コントロール） */
function QtyStepper({ value, onChange }) {
  const safe = Math.max(0, Number(value || 0));
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <IconButton size="small" onClick={() => onChange(safe - 1)} aria-label="数量を減らす">
        <RemoveRoundedIcon fontSize="small" />
      </IconButton>
      <TextField
        size="small"
        type="number"
        value={safe}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        inputProps={{ min: 0, step: 1 }}
        sx={{ width: 64 }}
      />
      <IconButton size="small" onClick={() => onChange(safe + 1)} aria-label="数量を増やす">
        <AddRoundedIcon fontSize="small" />
      </IconButton>
      <Tooltip title="数量リセット（0=自動）">
        <IconButton size="small" onClick={() => onChange(0)} aria-label="数量を0にリセット">
          <RestartAltRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

/** 各サムネイルタイル：画像（上）＋フッター（下）で重なり回避 */
function ItemTile({ it, checked, qty, onToggle, onQty }) {
  const widthMm = it?.meta?.widthMm != null ? Number(it.meta.widthMm) : undefined;
  const rotationStep = it?.meta?.rotationStepDeg != null ? Number(it.meta.rotationStepDeg) : undefined;

  return (
    <ImageListItem
      sx={{
        borderRadius: 1.5,
        overflow: "hidden",
        border: checked ? "2px solid #1976d2" : "1px solid rgba(0,0,0,0.12)",
        bgcolor: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 画像エリア：固定高で被り無し */}
      <Box
        onClick={onToggle}
        sx={{
          height: 164,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          bgcolor: "#fafafa",
          "& img": { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" },
        }}
      >
        <img src={it.url} alt={it.name} loading="lazy" />
      </Box>

      {/* フッター（操作） */}
      <Stack spacing={0.75} sx={{ p: 1 }}>
        {/* 1段目：チェック＋名前＋メタチップ */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Checkbox size="small" checked={checked} onChange={onToggle} />
          <Tooltip title={it.name}>
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.name}
            </Typography>
          </Tooltip>
          {!!widthMm && <Chip size="small" label={`${widthMm}mm`} />}
          {!!rotationStep && <Chip size="small" label={`rot ${rotationStep}°`} />}
        </Stack>

        {/* 2段目：数量コントロール＋説明 */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <QtyStepper value={qty} onChange={onQty} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            0は「未指定」＝自動補完
          </Typography>
        </Stack>
      </Stack>
    </ImageListItem>
  );
}

/**
 * props:
 * - open: boolean
 * - zoneLabel: string
 * - initialSelected: string[]
 * - initialCounts?: Record<url, number>
 * - onClose: () => void
 * - onSave: (urls: string[], metaMap: Record<string, any>, counts: Record<string, number>) => void
 * - multi: boolean
 */
export default function AssetPickerDialog({
  open,
  zoneLabel,
  initialSelected = [],
  initialCounts = {},
  onClose,
  onSave,
  multi = true,
}) {
  const registryKey = useMemo(() => zoneKeyFromLabel(zoneLabel), [zoneLabel]);
  const items = furnitureRegistry[registryKey] || [];

  const [selected, setSelected] = useState(new Set(initialSelected));
  const [counts, setCounts] = useState(() => {
    const m = {};
    initialSelected.forEach((u) => (m[u] = Math.max(0, Number(initialCounts[u] ?? 0))));
    return m;
  });

  // --- レスポンシブ列数（TSの as any を使わずに数値で渡す） ---
  const theme = useTheme();
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const cols = upMd ? 4 : upSm ? 3 : 2;

  // 初回の「おまかせ選択」実行フラグ
  const [omakaseDone, setOmakaseDone] = useState(false);

  // 開くたびに同期＋初期おまかせ選択
  useEffect(() => {
    setSelected(new Set(initialSelected));
    setCounts((prev) => {
      const m = {};
      initialSelected.forEach((u) => (m[u] = Math.max(0, Number(initialCounts[u] ?? prev[u] ?? 0))));
      return m;
    });

    // 既存選択が無く、アイテムがあれば初回だけおまかせ選択
    if (open && !omakaseDone && initialSelected.length === 0 && items.length > 0) {
      omakasePick(); // デフォルトで数点選ぶ
      setOmakaseDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSelected, initialCounts, registryKey]);

  const setCount = (url, n) => {
    setCounts((prev) => ({ ...prev, [url]: Math.max(0, Math.floor(Number(n) || 0)) }));
  };

  const toggle = (url) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (multi) {
        next.has(url) ? next.delete(url) : next.add(url);
      } else {
        next.clear();
        next.add(url);
      }
      // 初回選択で数量未設定なら1
      setCounts((prevCounts) => {
        if (!next.has(url)) return prevCounts;
        const current = Math.max(0, Number(prevCounts[url] ?? 0));
        return { ...prevCounts, [url]: current > 0 ? current : 1 };
      });
      return next;
    });
  };

  const handleSave = () => {
    const urls = Array.from(selected);
    const metaMap = {};
    urls.forEach((u) => {
      const it = items.find((x) => x.url === u);
      if (it?.meta) metaMap[u] = it.meta;
    });
    const pickedCounts = {};
    urls.forEach((u) => (pickedCounts[u] = Math.max(0, Number(counts[u] ?? 0))));
    onSave?.(urls, metaMap, pickedCounts);
  };

  const handleClose = () => onClose?.();

  // --- クイック操作 ---
  const selectAll = () => {
    setSelected(new Set(items.map((it) => it.url)));
    setCounts((prev) => {
      const next = { ...prev };
      for (const it of items) if (!next[it.url] || next[it.url] === 0) next[it.url] = 1;
      return next;
    });
  };

  const clearAll = () => {
    setSelected(new Set());
    setCounts({});
  };

  // おまかせ選択：ランダムに数点を選び数量1に
  const omakasePick = (n) => {
    const target = Math.min(
      typeof n === "number" ? n : Math.max(2, Math.min(4, Math.ceil(items.length * 0.2))),
      items.length
    );
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, target);
    const urls = shuffled.map((it) => it.url);

    setSelected(new Set(urls));
    setCounts((prev) => {
      const next = { ...prev };
      for (const u of urls) next[u] = Math.max(1, Number(next[u] ?? 0));
      return next;
    });
  };

  const manualTotal = useMemo(
    () => Object.values(counts).reduce((a, b) => a + Math.max(0, Number(b || 0)), 0),
    [counts]
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        家具を選定（{zoneLabel || "未設定"}）
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Tooltip title="すべて選択（数量が未設定のものは1にします）">
            <Button size="small" onClick={selectAll} startIcon={<SelectAllRoundedIcon />}>
              すべて選択
            </Button>
          </Tooltip>
          <Tooltip title="すべて解除（数量もクリア）">
            <Button size="small" onClick={clearAll} startIcon={<DeselectRoundedIcon />}>
              すべて解除
            </Button>
          </Tooltip>
          <Tooltip title="ランダムに数点を選びます（数量1）">
            <Button size="small" onClick={() => omakasePick()} startIcon={<AutoAwesomeRoundedIcon />}>
              おまかせ選択
            </Button>
          </Tooltip>
          <Box flex={1} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            手動で指定した合計数量: {manualTotal}（数量0は自動に任せます）
          </Typography>
        </Stack>

        <Divider sx={{ mb: 1.5 }} />

        {!registryKey ? (
          <Typography color="text.secondary">
            まずゾーンのラベルを設定してください（商談エリア、待合エリア、サービス待合エリア、事務エリア）。
          </Typography>
        ) : items.length === 0 ? (
          <Typography color="text.secondary">
            該当フォルダに家具画像がありません。
            <Box component="span" sx={{ fontFamily: "monospace", ml: 0.5 }}>
              src/assets/furniture/{registryKey}/
            </Box>
            に画像を追加してください。
          </Typography>
        ) : (
          <ImageList
            cols={cols}
            gap={12}
            sx={{
              "&& .MuiImageListItem-root": {
                minHeight: 236, // 操作エリア確保で崩れ防止
              },
            }}
          >
            {items.map((it) => {
              const checked = selected.has(it.url);
              const qty = Math.max(0, Number(counts[it.url] ?? 0));
              return (
                <ItemTile
                  key={it.url}
                  it={it}
                  checked={checked}
                  qty={qty}
                  onToggle={() => toggle(it.url)}
                  onQty={(n) => setCount(it.url, n)}
                />
              );
            })}
          </ImageList>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave} disabled={!registryKey}>
          決定
        </Button>
      </DialogActions>
    </Dialog>
  );
}
