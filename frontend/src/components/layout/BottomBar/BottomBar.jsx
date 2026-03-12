// src/components/BottomBar.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import EmojiPeopleRoundedIcon from "@mui/icons-material/EmojiPeopleRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";

import NegotiationAreaPanel from "./NegotiationAreaPanel";
import WaitingAreaPanel from "./WaitingAreaPanel";
import ServiceWaitingAreaPanel from "./ServiceWaitingAreaPanel";
import OfficeAreaPanel from "./OfficeAreaPanel";

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 1.5, height: "100%" }}>{children}</Box>;
}

/**
 * 画面下部のツールバー（家具選定用）
 * 「商談エリア」「待合エリア」「サービス待合エリア」「事務エリア」でタブ切り替え
 *
 * ※ここで選んだ家具は「パワポ出力用」のみで、
 *   PdfViewer のゾーン表示やレイアウトには反映しません。
 */
import useAppStore from "../../../store/useAppStore";
import useLayoutStore from "../../../store/useLayoutStore";

export default function BottomBar({
  leftWidth = 330,   // 左サイドバー幅(px)
  rightWidth = 160,  // 右サイドバー幅(px)
}) {
  const isLeftOpen = useAppStore((state) => state.isLeftOpen);
  const { zones, zoneSelections, changeZoneSelections } = useLayoutStore();
  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState(true);

  // ★ リサイズ用の高さ状態
  const [panelHeight, setPanelHeight] = useState(380);
  const MIN_HEIGHT = 140;
  const MAX_HEIGHT = 600;

  const startYRef = useRef(0);
  const startHeightRef = useRef(panelHeight);
  const resizingRef = useRef(false);

  // ドラッグ開始（上端のつまみ）
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
  };

  // グローバルな mousemove / mouseup を監視
  useEffect(() => {
    const handleMove = (e) => {
      if (!resizingRef.current) return;
      const dy = startYRef.current - e.clientY; // 上にドラッグ => 正
      let next = startHeightRef.current + dy;
      if (next < MIN_HEIGHT) next = MIN_HEIGHT;
      if (next > MAX_HEIGHT) next = MAX_HEIGHT;
      setPanelHeight(next);
    };

    const handleUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
      }
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, []);

  return (
    <Box
      sx={(theme) => ({
        position: "fixed",
        left: isLeftOpen ? leftWidth : 0,
        right: rightWidth,
        bottom: 0,
        zIndex: theme.zIndex.drawer - 1,
        bgcolor: "transparent", // ★ 背景は透明
        pointerEvents: "none", // 中のパネル以外はクリックを通す
      })}
    >
      {/* トグルボタン行（パネルのすぐ上） */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pb: 0.5,
          pointerEvents: "auto",
        }}
      >
        <Tooltip
          title={expanded ? "下部ツールバーを閉じる" : "下部ツールバーを開く"}
          arrow
        >
          <IconButton
            size="small"
            onClick={() => setExpanded((prev) => !prev)}
            sx={{
              bgcolor: "background.paper",
              boxShadow: 1,
            }}
          >
            {expanded ? (
              <KeyboardArrowDownRoundedIcon fontSize="small" />
            ) : (
              <KeyboardArrowUpRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Paper
          elevation={6}
          square={false}
          sx={{
            pointerEvents: "auto",
            borderTop: 1,
            borderColor: "divider",
            height: `${panelHeight}px`, // ★ 可変
            bgcolor: "rgba(255,255,255,0.3)", // ★ 半透明
            backdropFilter: "blur(8px)",        // 図面がうっすら透ける
            display: "flex",
            flexDirection: "column",
            borderRadius: "12px 12px 0 0",
            overflow: "hidden",
          }}
        >
          {/* 上端リサイズハンドル */}
          <Box
            onMouseDown={handleResizeMouseDown}
            sx={{
              height: 8,
              cursor: "ns-resize",
              position: "relative",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 40,
                height: 3,
                borderRadius: 999,
                bgcolor: "text.disabled",
              }}
            />
          </Box>

          {/* 上段：タブ */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                fontSize: 12,
              },
            }}
          >
            <Tab
              icon={<ChairRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="商談エリア"
            />
            <Tab
              icon={<GroupRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="待合エリア"
            />
            <Tab
              icon={<EmojiPeopleRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="サービス待合エリア"
            />
            <Tab
              icon={<WorkRoundedIcon fontSize="small" />}
              iconPosition="start"
              label="事務エリア"
            />
          </Tabs>

          {/* 下段：各タブの中身（家具選定表示エリア） */}
          <Box sx={{ flex: 1, px: 2, py: 1, overflow: "hidden" }}>
            <TabPanel value={tab} index={0}>
              <NegotiationAreaPanel
                zones={zones}
                zoneSelections={zoneSelections}
                onChangeZoneSelections={changeZoneSelections}
              />
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <WaitingAreaPanel
                zones={zones}
                zoneSelections={zoneSelections}
                onChangeZoneSelections={changeZoneSelections}
              />
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <ServiceWaitingAreaPanel
                zones={zones}
                zoneSelections={zoneSelections}
                onChangeZoneSelections={changeZoneSelections}
              />
            </TabPanel>

            <TabPanel value={tab} index={3}>
              <OfficeAreaPanel
                zones={zones}
                zoneSelections={zoneSelections}
                onChangeZoneSelections={changeZoneSelections}
              />
            </TabPanel>
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
}
