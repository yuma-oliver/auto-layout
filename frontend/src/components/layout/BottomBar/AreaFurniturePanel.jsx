// src/components/AreaFurniturePanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";

/* =========================
 * 設定
 * ========================= */

// エリア名 → カタログディレクトリ
const CATALOG_DIRS = {
  "商談エリア": "shodan",
  "サービス待合エリア": "service_machiai",
  "待合エリア": "machiai",
  "事務エリア": "office",
};

const PUBLIC_BASE = "/assets/selectFurniture"; // public/ 配下

/* =========================
 * URL / meta ユーティリティ
 * ========================= */

// 画像 → meta 候補（_meta.json を優先）
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

async function resolveMeta(url, cache) {
  if (cache.has(url)) return cache.get(url);
  for (const u of buildMetaCandidates(url)) {
    const j = await fetchJsonSafe(u);
    if (j) {
      cache.set(url, j);
      return j;
    }
  }
  cache.set(url, {});
  return {};
}

// 画像URL（日本語/・対応）
function joinCatalogPath(dir, file) {
  const encFile = encodeURIComponent(file).replace(/%2F/g, "/");
  return `${PUBLIC_BASE}/${dir}/${encFile}`;
}

/* =========================
 * メイン：エリア用パネル
 * ========================= */
/**
 * props:
 *  - areaLabel: "商談エリア" / "待合エリア" / "サービス待合エリア" / "事務エリア"
 *  - zones: PdfViewer の全ゾーン配列
 *      { id, label, width, height, ... }
 *  - zoneSelections: { [zoneId]: { [imageUrl]: qty } }   ← パワポ用選定状態
 *  - onChangeZoneSelections: (zoneId, nextMap) => void   ← zoneSelections を更新
 *
 * ※ここでは zones を読み取るだけで、zones 自体は変更しません。
 *   数量はすべて zoneSelections にのみ保持します。
 */
export default function AreaFurniturePanel({
  areaLabel,
  zones = [],
  zoneSelections = {},
  onChangeZoneSelections,
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // [{imageUrl, meta, displayName}]
  const metaCacheRef = useRef(new Map());

  // このエリアに属するゾーンだけ抽出
  const targetZones = useMemo(() => {
    const key = areaLabel;
    return zones.filter((z) => {
      const label = z.label || "";
      if (key === "商談エリア") return label.includes("商談");
      if (key === "サービス待合エリア")
        return label.includes("サービス") && label.includes("待合");
      if (key === "待合エリア")
        return label.includes("待合") && !label.includes("サービス");
      if (key === "事務エリア") return label.includes("事務") || label.includes("受付");
      return false;
    });
  }, [zones, areaLabel]);

  // アクティブゾーン
  const [activeZoneId, setActiveZoneId] = useState(null);

  useEffect(() => {
    if (targetZones.length === 0) {
      setActiveZoneId(null);
      return;
    }
    // まだ選択されていなければ先頭を選択
    if (!activeZoneId || !targetZones.some((z) => z.id === activeZoneId)) {
      setActiveZoneId(targetZones[0].id);
    }
  }, [targetZones, activeZoneId]);

  const activeZone = useMemo(
    () => targetZones.find((z) => z.id === activeZoneId) || null,
    [targetZones, activeZoneId]
  );

  // カタログ読込（エリアごとに1回）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dir = CATALOG_DIRS[areaLabel] || "misc";
      const indexUrl = `${PUBLIC_BASE}/${dir}/index.json`;
      setLoading(true);
      try {
        const list = (await fetchJsonSafe(indexUrl)) || [];
        const files = list
          .map((it) => (typeof it === "string" ? it : it.image))
          .filter(Boolean);

        const loaded = [];
        for (const file of files) {
          const imageUrl = joinCatalogPath(dir, file);
          const meta = await resolveMeta(imageUrl, metaCacheRef.current);
          const displayName =
            (typeof list[0] === "object" &&
              list.find((x) => x.image === file)?.displayName) ||
            meta.displayName ||
            "";
          loaded.push({ imageUrl, meta, displayName });
        }
        if (!cancelled) setItems(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [areaLabel]);

  // アクティブゾーンの席数サマリ（zoneSelections から計算）
  const activeSeatSum = useMemo(() => {
    if (!activeZone) return 0;
    const counts = zoneSelections[activeZone.id] || {};
    let sum = 0;
    for (const [url, qtyRaw] of Object.entries(counts)) {
      const qty = Math.max(0, Number(qtyRaw) || 0);
      if (!qty) continue;
      const item = items.find((it) => it.imageUrl === url);
      const meta = item?.meta || {};
      const per = Number.isFinite(meta.seats) ? Math.max(0, meta.seats) : 0;
      sum += per * qty;
    }
    return sum;
  }, [activeZone, items, zoneSelections]);



  // 数量操作 → zoneSelections のみ更新（zones は触らない）
  const updateZoneCounts = (zoneId, updater) => {
    const prevCounts = zoneSelections[zoneId] || {};
    const nextCounts = updater(prevCounts);

    // 0 のものは削除しておくと JSON もスッキリ
    const normalized = Object.fromEntries(
      Object.entries(nextCounts).filter(([, n]) => (n || 0) > 0)
    );

    onChangeZoneSelections?.(zoneId, normalized);
  };

  const changeQty = (url, updater) => {
    if (!activeZone) return;
    updateZoneCounts(activeZone.id, (prev) => {
      const prevQty = Math.max(0, Number(prev[url] || 0) || 0);
      const nextQty = Math.max(0, Math.floor(updater(prevQty)));
      return { ...prev, [url]: nextQty };
    });
  };

  const inc = (url) => changeQty(url, (v) => v + 1);
  const dec = (url) => changeQty(url, (v) => v - 1);
  const setQty = (url, v) => {
    const n = Math.max(0, Number(v) || 0);
    changeQty(url, () => n);
  };

  if (targetZones.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        このエリアに紐づくゾーンがまだ作成されていません。
        <br />
        PDF 上でゾーンを作成し、ラベルに「{areaLabel}」などを含めてください。
      </Typography>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", minHeight: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, px: 2, py: 2, overflow: "auto" }}>
        {/* アクティブゾーン概要 */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 1 }}
        >
          <Chip
            color="primary"
            variant="outlined"
            label={
              activeZone
                ? `${activeZone.label || "未設定"}（${Math.round(
                    activeZone.width || 0
                  )}×${Math.round(activeZone.height || 0)}）`
                : "ゾーン未選択"
            }
          />
          <Chip color="primary" label={`選定済み：${activeSeatSum} 席`} />
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {/* カタログ本体 */}
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            カタログが見つかりませんでした。
            <br />
            {`public${PUBLIC_BASE}/${CATALOG_DIRS[areaLabel] || "misc"}/index.json`}
            に画像ファイル名の配列を定義してください。
          </Typography>
        ) : !activeZone ? (
          <Typography variant="body2" color="text.secondary">
            ゾーンが選択されていません。
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {items.map((it) => {
              const countsForZone = zoneSelections[activeZone.id] || {};
              const qty = countsForZone[it.imageUrl] ?? 0;
              const per = Number.isFinite(it.meta?.seats)
                ? Math.max(0, it.meta.seats)
                : 0;
              return (
                <Grid key={it.imageUrl} item xs={12} sm={6} md={4} lg={3}>
                  <Card variant="outlined">
                    <CardActionArea onClick={() => inc(it.imageUrl)}>
                      <CardMedia
                        component="img"
                        image={it.imageUrl}
                        alt={it.displayName || ""}
                        sx={{
                          width: "100px",
                          aspectRatio: "4/3",
                          objectFit: "contain",
                          bgcolor: "rgba(0,0,0,0.03)",
                          mx: "auto",
                          mt: 1,
                        }}
                      />
                    </CardActionArea>
                    <CardContent sx={{ pt: 1.25 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        title={it.displayName || it.imageUrl}
                      >
                        {it.displayName || it.imageUrl.split("/").pop()}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mt: 0.5 }}
                      >
                        <Chip size="small" label={`seats: ${per}`} />
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title="減らす">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => dec(it.imageUrl)}
                            >
                              <RemoveRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <TextField
                          size="small"
                          type="number"
                          value={qty}
                          onChange={(e) => setQty(it.imageUrl, e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          sx={{ width: 68 }}
                        />
                        <Tooltip title="増やす">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => inc(it.imageUrl)}
                            >
                              <AddRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        小計：{per * (Number(qty) || 0)} 席
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
