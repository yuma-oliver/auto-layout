import React, { useRef, useCallback } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";

import Toolbar from "../components/layout/Toolbar/Toolbar";
import LeftSidebar from "../components/layout/LeftSidebar/LeftSidebar";
import ZoneList from "../components/layout/RightSidebar/ZoneList";
import BottomBar from "../components/layout/BottomBar/BottomBar";
import PdfViewer from "../components/PdfViewer/PdfViewer";

import useAppStore from "../store/useAppStore";
import useLayoutStore from "../store/useLayoutStore";

const LEFT_DRAWER_WIDTH = 330;
const RIGHT_DRAWER_WIDTH = 160;

export default function Dashboard() {
  const isLeftOpen = useAppStore((state) => state.isLeftOpen);
  const setIsLeftOpen = useAppStore((state) => state.setIsLeftOpen);

  const zones = useLayoutStore((state) => state.zones);
  const selectedIds = useLayoutStore((state) => state.selectedIds);
  const setLayoutItems = useLayoutStore((state) => state.setLayoutItems);

  const pdfViewerRef = useRef(null);

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
    if (selectedIds.length === 0) {
      alert("レイアウト生成するゾーンを選択してください。");
      return;
    }
    try {
      const selectedZones = zones.filter((z) => selectedIds.includes(z.id));
      if (selectedZones.length === 0) return;

      const res = await fetch("http://127.0.0.1:8000/generate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedZones),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setLayoutItems((prev) => {
        const map = new Map(prev.map((r) => [r.zone_id, r]));
        data.forEach((r) => map.set(r.zone_id, r));
        return Array.from(map.values());
      });
    } catch (e) {
      console.error(e);
      alert("バックエンドに接続できません。サーバーの起動状態を確認してください。");
    }
  }, [zones, selectedIds, setLayoutItems]);

  const handleExportPng = useCallback(() => {
    pdfViewerRef.current?.exportPNG();
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Toolbar
        onExportJson={handleExportJson}
        onSendToBackend={handleSendToBackend}
        onExportPng={handleExportPng}
      />

      {!isLeftOpen && (
        <Tooltip title="設定パネルを開く" arrow>
          <IconButton
            size="small"
            onClick={() => setIsLeftOpen(true)}
            sx={{
              position: "fixed",
              top: 72,
              left: 8,
              zIndex: (theme) => theme.zIndex.drawer + 1,
              bgcolor: "background.paper",
              boxShadow: 2,
            }}
          >
            <MenuRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <LeftSidebar
        open={isLeftOpen}
        onToggle={() => setIsLeftOpen(!isLeftOpen)}
      />

      <Box
        sx={(theme) => ({
          flex: 1,
          display: "flex",
          ml: isLeftOpen ? `${LEFT_DRAWER_WIDTH}px` : 0,
          transition: theme.transitions.create("margin-left", {
            duration: theme.transitions.duration.standard,
          }),
          mr: `${RIGHT_DRAWER_WIDTH}px`,
        })}
      >
        <PdfViewer
          ref={pdfViewerRef}
          rightPadding={RIGHT_DRAWER_WIDTH}
          fitBy="width"
        />
        <ZoneList />
      </Box>

      <BottomBar
        isLeftOpen={isLeftOpen}
        leftWidth={LEFT_DRAWER_WIDTH}
        rightWidth={RIGHT_DRAWER_WIDTH}
      />
    </Box>
  );
}
