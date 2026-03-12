import React, { useRef, useState } from "react";
import {
  Drawer,
  Box,
  Button,
  Typography,
  Divider,
  Stack,
  TextField,
  IconButton,
  Tooltip,
} from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AppsIcon from "@mui/icons-material/Apps";
import ChairIcon from "@mui/icons-material/Chair";

// Furniture assets
import shodanTableA from "../../../shared/assets/furniture/shodan/table_A.png";
import machiaiSofaA from "../../../shared/assets/furniture/machiai/sofa_A.png";
import serviceTableA from "../../../shared/assets/furniture/service_machiai/bigtable_A.png";
import jimuDeskA from "../../../shared/assets/furniture/jimu/desk_A.png";

import useAppStore from "../../../store/useAppStore";
import useConditionStore from "../../../store/useConditionStore";
import useLayoutStore from "../../../store/useLayoutStore";

const drawerWidth = 360;

export default function LeftSidebar({ open = true, onToggle }) {
  const {
    showroomArea,
    requirements,
    setShowroomArea,
    setRequirements,
    setSelectedPdf,
    resetConditions,
  } = useConditionStore();

  const { setZones, clearLayoutItems } = useLayoutStore();
  const setPdfFile = useAppStore((state) => state.setPdfFile);
  const selectedPdf = useConditionStore((state) => state.selectedPdf);
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  const handleClickPdf = () => {
    console.log("PDF選択ボタン押下");
    fileInputRef.current?.click();
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    console.log("選択されたファイル:", file);

    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("PDFの読み込みに失敗しました。PDF形式を確認してください。");
      setSelectedPdf(null);
      setPdfFile(null);
      console.log("PDF解析失敗 (形式エラー)");
      return;
    }

    // 10MB以上はエラーの例
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズが大きすぎます。");
      setSelectedPdf(null);
      setPdfFile(null);
      console.log("PDF解析失敗 (サイズエラー)");
      return;
    }

    setError("");
    setSelectedPdf(file);
    setPdfFile(file); // PdfViewerにも反映するため

    console.log("PDF解析開始");
    // Mock extraction
    alert(`「${file.name}」を読み込んで要件を抽出しました（モック）`);
    console.log("PDF解析成功");

    setShowroomArea(200);
    setRequirements({
      receptionStaff: 2,
      waitingSeats: 8,
      serviceWaitingSeats: 5,
      meetingSeats: 6,
      officeSeats: 5,
    });
    
    // 次回同じファイルを選んでもonChangeが発火するようにクリアする
    e.target.value = "";
  };

  const handleGenerateZoning = () => {
    // ざっくりとしたキャンバスサイズから4エリアに分割する
    const area = Number(showroomArea) || 100;
    // 例えば 幅:高さ = 2:1 とする
    // W * H = area * 1000000 (mm^2)
    // 2H * H = area * 1000000 -> H = sqrt(area * 500000)
    const H = Math.sqrt(area * 500000);
    const W = H * 2; // mm

    const cx = W / 2;
    const cy = H / 2;

    const z1 = { id: `z-shodan-${Date.now()}`, label: "商談エリア", x: 0, y: 0, width: cx, height: cy, fill: "rgba(220,0,0,0.28)", stroke: "rgba(220,0,0,0.9)", furnitureAssets: [shodanTableA] };
    const z2 = { id: `z-machiai-${Date.now()}`, label: "待合エリア", x: cx, y: 0, width: cx, height: cy, fill: "rgba(0,170,80,0.28)", stroke: "rgba(0,170,80,0.9)", furnitureAssets: [machiaiSofaA] };
    const z3 = { id: `z-service-${Date.now()}`, label: "サービス待合エリア", x: 0, y: cy, width: cx, height: cy, fill: "rgba(0,120,215,0.28)", stroke: "rgba(0,120,215,0.9)", furnitureAssets: [serviceTableA] };
    const z4 = { id: `z-office-${Date.now()}`, label: "事務エリア", x: cx, y: cy, width: cx, height: cy, fill: "rgba(128,128,128,0.28)", stroke: "rgba(128,128,128,0.9)", furnitureAssets: [jimuDeskA] };

    setZones([z1, z2, z3, z4]);
    clearLayoutItems();
  };

  const handleGenerateFurniture = async () => {
    // バックエンドがない場合はフロントでモック配置するか、既存のAPIを叩く
    const zones = useLayoutStore.getState().zones;
    if (zones.length === 0) {
      alert("先にゾーニングを生成するか、ゾーンを作成してください。");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/generate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zones),
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      useLayoutStore.getState().setLayoutItems(data);
    } catch (err) {
      console.warn("API Error, falling back to mock", err);
      alert("バックエンド接続エラー。家具自動配置のデモ（モック）を実行します。");
      // mock items
      const mockItems = zones.map(z => {
        let imageUrl = shodanTableA;
        let w = 1800;
        let h = 900;
        
        if (z.label?.includes("商談")) {
           imageUrl = shodanTableA;
           w = 1800;
           h = 900;
        } else if (z.label?.includes("サービス")) {
           imageUrl = serviceTableA;
           w = 2900;
           h = 1200;
        } else if (z.label?.includes("待合")) {
           imageUrl = machiaiSofaA;
           w = 4440;
           h = 1400;
        } else if (z.label?.includes("事務")) {
           imageUrl = jimuDeskA;
           w = 5370;
           h = 1600;
        }

        // scale down dummy sizes simply if zone is too small to fit the real mm scale
        return {
          zone_id: z.id,
          items: [
            {
              image_url: imageUrl,
              x: z.x + (z.width * 0.5),
              y: z.y + (z.height * 0.5),
              width: w,
              height: h,
              rotation: 0
            }
          ]
        };
      });
      useLayoutStore.getState().setLayoutItems(mockItems);
    }
  };

  return (
    <Drawer
      anchor="left"
      variant="persistent"
      open={open}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
        },
      }}
    >
      <Box sx={(theme) => theme.mixins.toolbar} />
      <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>条件入力</Typography>
          {onToggle && (
            <IconButton size="small" onClick={onToggle} sx={{ ml: "auto" }}>
              <ChevronLeftRoundedIcon />
            </IconButton>
          )}
        </Box>

        {/* PDFアップロード */}
        <Box sx={{ mb: 3 }}>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handlePdfUpload}
          />
          <Button
            variant="outlined"
            fullWidth
            startIcon={<UploadFileIcon />}
            onClick={handleClickPdf}
          >
            PDFを選択
          </Button>

          {selectedPdf && (
            <Typography sx={{ mt: 1, wordBreak: "break-all" }} variant="body2" color="primary">
              選択ファイル: {selectedPdf.name} ({(selectedPdf.size / 1024 / 1024).toFixed(2)} MB)
            </Typography>
          )}

          {error && (
            <Typography sx={{ mt: 1 }} variant="body2" color="error">
              {error}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            ※ PDFをアップロードして手入力を省略できます。
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 面積入力 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
            ショールーム面積
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            placeholder="例: 200"
            value={showroomArea}
            onChange={(e) => setShowroomArea(e.target.value)}
            InputProps={{ endAdornment: <Typography variant="caption">㎡</Typography> }}
          />
        </Box>

        {/* ゾーニング生成 */}
        <Button
          variant="contained"
          color="primary"
          startIcon={<AppsIcon />}
          fullWidth
          sx={{ mb: 3 }}
          onClick={handleGenerateZoning}
        >
          ゾーニング生成
        </Button>

        <Divider sx={{ mb: 2 }} />

        {/* 必要情報 */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
          必要体制・席数 (任意)
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="受付人数"
            type="number"
            value={requirements.receptionStaff}
            onChange={(e) => setRequirements({ receptionStaff: e.target.value })}
          />
          <TextField
            size="small"
            label="商談席数"
            type="number"
            value={requirements.meetingSeats}
            onChange={(e) => setRequirements({ meetingSeats: e.target.value })}
          />
          <TextField
            size="small"
            label="待合席数"
            type="number"
            value={requirements.waitingSeats}
            onChange={(e) => setRequirements({ waitingSeats: e.target.value })}
          />
          <TextField
            size="small"
            label="サービス待合席数"
            type="number"
            value={requirements.serviceWaitingSeats}
            onChange={(e) => setRequirements({ serviceWaitingSeats: e.target.value })}
          />
          <TextField
            size="small"
            label="事務席数"
            type="number"
            value={requirements.officeSeats}
            onChange={(e) => setRequirements({ officeSeats: e.target.value })}
          />
        </Stack>

        {/* 家具自動配置 */}
        <Button
          variant="contained"
          color="secondary"
          startIcon={<ChairIcon />}
          fullWidth
          sx={{ mb: 2 }}
          onClick={handleGenerateFurniture}
        >
          家具自動配置
        </Button>

        <Divider sx={{ my: 2 }} />

        {/* リセット・別案 */}
        <Stack spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => { handleGenerateZoning(); handleGenerateFurniture(); }}
          >
            別案を生成 (ゾーニング + 家具)
          </Button>
          <Button
            variant="text"
            color="inherit"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={resetConditions}
          >
            すべてリセット
          </Button>
        </Stack>

      </Box>
    </Drawer>
  );
}
