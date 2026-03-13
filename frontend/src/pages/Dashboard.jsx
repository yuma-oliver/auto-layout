import React, { useRef, useCallback, useState } from "react";
import { Box, Typography, Button, IconButton, Tooltip, Stack, Paper, ToggleButtonGroup, ToggleButton, Divider, TextField, InputAdornment } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import MuiToolbar from "@mui/material/Toolbar";

import SettingsIcon from "@mui/icons-material/Settings";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StraightenIcon from "@mui/icons-material/Straighten";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ChairIcon from "@mui/icons-material/Chair";
import DescriptionIcon from "@mui/icons-material/Description";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import IosShareIcon from "@mui/icons-material/IosShare";

import PdfViewer from "../components/PdfViewer/PdfViewer";
import ZoneList from "../components/layout/RightSidebar/ZoneList";
import ExportToolbar from "../components/layout/Toolbar/ExportToolbar";

import useAppStore from "../store/useAppStore";
import useLayoutStore from "../store/useLayoutStore";
import { generateMockZoningFromArea, styleForLabel, getAssetsForZoneLabel } from "../utils/mockLayoutGenerator";
import { exportPptxFromZones } from "../shared/utils/exportPptxFromZones";

const LABEL_TYPES = [
  { value: "商談エリア", label: "商談", color: "error" },
  { value: "待合エリア", label: "待合", color: "success" },
  { value: "サービス待合エリア", label: "サービス", color: "info" },
  { value: "事務エリア", label: "事務", color: "secondary" },
];

export default function Dashboard() {
  const { pdfFile, setPdfFile, scaleDenom, setScaleDenom, activeZoneLabel, setActiveZoneLabel, drawMode, setDrawMode } = useAppStore();
  const { zones, selectedIds, setLayoutItems, updateZone, zoneSelections } = useLayoutStore();
  const pdfViewerRef = useRef(null);

  const selectedZone = zones.find(z => selectedIds.includes(z.id));
  const currentLabelValue = selectedZone ? selectedZone.label : activeZoneLabel;

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  // === Actions ===
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("PDFを選択してください");
      return;
    }
    setPdfFile(URL.createObjectURL(file));
  };

  const handleExportJson = useCallback(() => {
    const data = JSON.stringify(zones, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zones.json";
    a.click();
  }, [zones]);

  const handleSendToBackend = useCallback(async () => {
    if (zones.length === 0) {
      alert("レイアウト生成するゾーンを選択してください。");
      return;
    }
  }, [zones]);

  const handleExportPng = useCallback(() => {
    pdfViewerRef.current?.exportPNG();
  }, []);

  const handleGenerateZoning = () => {
    // デフォルトで200㎡相当のゾーンを生成
    const success = pdfViewerRef.current?.generateZoning(200);
    if (!success) {
      alert("PDFが正しく読み込まれていないか、縮尺が設定されていません。");
    }
  };

  const handleGenerateFurniture = async () => {
    if (zones.length === 0) {
      alert("先にゾーンを作成してください。");
      return;
    }
    
    // バックエンド連携を一時的にスキップして、画面上で多様なモックバリエーション（乱数配置）を見せるための対応
    import("../utils/mockLayoutGenerator").then((mod) => {
      mod.generateMockLayouts(zones, selectedIds);
    });
    
    /* try {
      const res = await fetch("http://127.0.0.1:8000/generate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zones), 
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      setLayoutItems(data);
    } catch (err) {
      console.warn("API Error, falling back to mock", err);
      // alert("バックエンド接続エラー。家具自動配置のデモ（モック）を実行します。");
      import("../utils/mockLayoutGenerator").then((mod) => {
        mod.generateMockLayouts(zones);
      });
    } */
  };

  const handleRandomizeSelectedZones = () => {
    if (selectedIds.length === 0) {
      alert("エリアを選択してください。");
      return;
    }
    import("../utils/mockLayoutGenerator").then((mod) => {
      // randomizeFurnitureForSelectedZones now correctly updates the z.layoutSeed to shuffle 
      // the arrangement of its own selected subset, without touching others.
      mod.randomizeFurnitureForSelectedZones(selectedIds);
    });
  };

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", bgcolor: "#f0f2f5" }}>
      {/* 1. App Header */}
      <AppBar position="static" color="inherit" elevation={1} sx={{ zIndex: (t) => t.zIndex.drawer + 2 }}>
        <MuiToolbar variant="dense" sx={{ minHeight: 56, gap: 2 }}>
          <IconButton onClick={() => setIsLeftOpen(!isLeftOpen)} color={isLeftOpen ? "primary" : "default"}>
            <MenuRoundedIcon />
          </IconButton>
          
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mr: 'auto', fontSize: 18 }}>
            Car Dealer Auto Layout
          </Typography>

          {/* Action Buttons in Header */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 2 }}>
            <Button
              size="small"
              startIcon={<AutoFixHighIcon />}
              sx={{ 
                fontWeight: 'bold', 
                px: 2, 
                borderRadius: 8, 
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e0efff 100%)',
                color: 'primary.dark',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'linear-gradient(135deg, #e0efff 0%, #d0e7ff 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0, 120, 215, 0.15)'
                }
              }}
              onClick={handleGenerateZoning}
            >
              空間を自動で仕切る
            </Button>

            <Button
              size="small"
              disabled={selectedIds.length === 0}
              startIcon={<AutoAwesomeIcon />}
              sx={{ 
                fontWeight: 'bold', 
                px: 2, 
                borderRadius: 8, 
                background: 'linear-gradient(135deg, #fff0f5 0%, #ffe0eb 100%)',
                color: 'secondary.dark',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ffe0eb 0%, #ffd0e0 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(216, 27, 96, 0.15)'
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.06)',
                }
              }}
              onClick={handleRandomizeSelectedZones}
            >
              家具をおまかせ選択
            </Button>

            <Button
              variant="contained"
              size="small"
              disabled={zones.length === 0}
              startIcon={<ChairIcon />}
              sx={{ 
                fontWeight: 'bold', 
                px: 2, 
                borderRadius: 8, 
                background: 'linear-gradient(135deg, #0078d7 0%, #005a9e 100%)',
                boxShadow: '0 4px 12px rgba(0, 120, 215, 0.3)',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0086f0 0%, #006abc 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 16px rgba(0, 120, 215, 0.4)'
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.12)',
                }
              }}
              onClick={handleGenerateFurniture}
            >
              家具を賢く配置
            </Button>

            <Divider orientation="vertical" variant="middle" flexItem sx={{ mx: 1, borderColor: "rgba(0,0,0,0.1)" }} />

            <Button 
              variant="contained" 
              size="small" 
              startIcon={<IosShareIcon />}
              onClick={handleExportPptx}
              disabled={zones.length === 0}
              sx={{ 
                fontWeight: "bold", 
                borderRadius: 8, 
                px: 2,
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#43a047' },
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
              }}
            >
              パワポ出力
            </Button>
          </Stack>

          <Tooltip title="出力・ゾーン一覧">
            <IconButton onClick={() => setIsRightOpen(!isRightOpen)} color={isRightOpen ? "primary" : "default"} sx={{ bgcolor: isRightOpen ? "primary.50" : "transparent" }}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </MuiToolbar>
      </AppBar>

      {/* 2. Main Workspace */}
      <Box sx={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>
        
        {/* Left Sidebar (Settings & Tools) */}
        <Box 
          sx={{ 
            width: isLeftOpen ? 280 : 0, 
            transition: 'width 0.3s', 
            bgcolor: 'background.paper', 
            borderRight: isLeftOpen ? 1 : 0, 
            borderColor: 'divider',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isLeftOpen && (
            <Box sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: 'text.secondary' }}>図面設定</Typography>
              <Button variant="outlined" component="label" fullWidth startIcon={<UploadFileIcon />} sx={{ mb: 2 }}>
                PDFを変更
                <input hidden type="file" accept="application/pdf" onChange={handleFileChange} />
              </Button>
              <TextField
                size="small"
                label="縮尺 1 / N"
                type="number"
                value={scaleDenom}
                fullWidth
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setScaleDenom(Math.floor(v));
                }}
                inputProps={{ step: 1, min: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><StraightenIcon fontSize="small" /></InputAdornment>,
                }}
              />
              <Stack direction="row" spacing={0.5} justifyContent="space-between" mt={1}>
                <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1.5 }} onClick={() => setScaleDenom(50)}>1/50</Button>
                <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1.5 }} onClick={() => setScaleDenom(75)}>1/75</Button>
                <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1.5 }} onClick={() => setScaleDenom(100)}>1/100</Button>
                <Tooltip title="縮尺リセット"><IconButton onClick={() => setScaleDenom(100)}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: 'text.secondary' }}>エリアツール</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.disabled' }}>
                任意の枠を選択して個別にエリアタイプを指定します。
              </Typography>
              <ToggleButtonGroup
                value={currentLabelValue}
                exclusive
                orientation="vertical"
                fullWidth
                onChange={(e, val) => {
                  if (val) {
                    setActiveZoneLabel(val);
                    if (selectedIds.length > 0) {
                       selectedIds.forEach(id => {
                          const { fill, stroke } = styleForLabel(val);
                          updateZone(id, { label: val, fill, stroke, furnitureAssets: getAssetsForZoneLabel(val) });
                       });
                    }
                  }
                }}
                size="medium"
                sx={{ '& .MuiToggleButton-root': { fontWeight: 'bold', justifyContent: 'flex-start', px: 2, py: 1 } }}
              >
                {LABEL_TYPES.map((t) => (
                  <ToggleButton key={t.value} value={t.value} color={t.color}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.color === 'error' ? 'error.main' : t.color === 'success' ? 'success.main' : t.color === 'info' ? 'info.main' : 'secondary.main', mr: 2 }} />
                    {t.label} エリア
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>

        {/* Center Canvas */}
        <Box sx={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
          
          {!pdfFile ? (
            // Upload Dropzone
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 6, 
                  textAlign: 'center', 
                  borderRadius: 4, 
                  bgcolor: 'transparent',
                  border: '2px dashed #ccc',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 3 
                }}
              >
                <DescriptionIcon sx={{ fontSize: 80, color: 'primary.light' }} />
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>PDF図面をアップロードして始める</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 400 }}>
                  営業提案・レイアウトシミュレーション用のツールです。手元のパソコンにあるPDF図面ファイルを指定してください。
                </Typography>
                <Button variant="contained" component="label" size="large" sx={{ px: 6, py: 1.5, borderRadius: 8, fontWeight: 'bold' }}>
                  ファイルを選択
                  <input hidden type="file" accept="application/pdf" onChange={handleFileChange} />
                </Button>
              </Paper>
            </Box>
          ) : (
            // PDF Viewer Area
            <Box sx={{ flex: 1, position: "relative" }}>
              <PdfViewer ref={pdfViewerRef} rightPadding={0} fitBy="width" />
            </Box>
          )}
        </Box>

        {/* Right Sidebar */}
        <Box 
          sx={{ 
            width: isRightOpen ? 320 : 0, 
            transition: 'width 0.3s', 
            bgcolor: 'background.paper', 
            borderLeft: isRightOpen ? 1 : 0, 
            borderColor: 'divider',
            position: 'relative',
            zIndex: 10,
            overflowY: 'auto'
          }}
        >
          {isRightOpen && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: 'text.secondary' }}>出力設定</Typography>
                <ExportToolbar onExportPng={handleExportPng} onExportJson={handleExportJson} onSendToBackend={handleSendToBackend} />
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <ZoneList open={true} width={320} />
              </Box>
            </Box>
          )}
        </Box>

      </Box>
    </Box>
  );
}
