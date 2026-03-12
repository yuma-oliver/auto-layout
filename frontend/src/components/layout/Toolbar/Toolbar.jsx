import React, { useEffect, useRef, useState } from "react";
import {
  AppBar,
  Toolbar as MuiToolbar,
  Button,
  Typography,
  Stack,
  Box,
  TextField,
  InputAdornment,
  Tooltip,
  IconButton,
  Divider,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import StraightenIcon from "@mui/icons-material/Straighten";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DescriptionIcon from "@mui/icons-material/Description";

import useAppStore from "../../../store/useAppStore";
import useLayoutStore from "../../../store/useLayoutStore";

const PRESETS = {
  A0: { w: 841, h: 1189 },
  A1: { w: 594, h: 841 },
  A2: { w: 420, h: 594 },
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
};

export default function Toolbar({
  onExportJson,
  onSendToBackend,
  onExportPng,
}) {
  const { setPdfFile, scaleDenom, setScaleDenom, paperSizeMm, setPaperSizeMm } = useAppStore();
  const { clearLayoutItems } = useLayoutStore();

  const [presetKey, setPresetKey] = useState("A3");
  const [orientation, setOrientation] = useState("portrait"); // portrait | landscape
  const [customW, setCustomW] = useState(paperSizeMm.w || PRESETS.A3.w);
  const [customH, setCustomH] = useState(paperSizeMm.h || PRESETS.A3.h);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("PDFを選択してください");
      return;
    }
    setPdfFile(URL.createObjectURL(file));
  };

  const applyPreset = (key, dir) => {
    const base = PRESETS[key];
    if (!base) return;
    const w = dir === "landscape" ? base.h : base.w;
    const h = dir === "landscape" ? base.w : base.h;
    setPresetKey(key);
    setOrientation(dir);
    setCustomW(w);
    setCustomH(h);
    setPaperSizeMm({ w, h });
  };

  // ✅ 初回だけプリセット適用（A3縦）: render中に setState しない
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    if (!paperSizeMm.w && !paperSizeMm.h) {
      applyPreset("A3", "portrait");
    } else {
      // 既にストアからサイズが与えられている場合はそれを反映
      setCustomW(paperSizeMm.w);
      setCustomH(paperSizeMm.h);
    }
    didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeCustomWidth = (v) => {
    const num = Number(v);
    if (!Number.isFinite(num) || num <= 0) return;
    setCustomW(num);
    setPaperSizeMm({ w: num, h: customH });
  };

  const onChangeCustomHeight = (v) => {
    const num = Number(v);
    if (!Number.isFinite(num) || num <= 0) return;
    setCustomH(num);
    setPaperSizeMm({ w: customW, h: num });
  };

  const resetScale = () => setScaleDenom(100);

  return (
    <>
       <AppBar
         position="fixed"
         color="default"
         elevation={1}
         sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <MuiToolbar sx={{ justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" noWrap>Car dealer Auto Layout</Typography>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="outlined" component="label" startIcon={<DescriptionIcon />}>
              PDFを選択
              <input hidden type="file" accept="application/pdf" onChange={handleFileChange} />
            </Button>
            <Button variant="outlined" onClick={onExportJson}>JSON出力</Button>
            <Button variant="outlined" color="success" onClick={onSendToBackend}>FASTAPI送信</Button>
            <Button variant="outlined" onClick={clearLayoutItems}>マーカー消去</Button>
            <Button variant="contained" color="primary" onClick={onExportPng}>PNG保存</Button>

            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />

            {/* 縮尺 1/N */}
            <TextField
              size="small"
              label="縮尺 1 / N"
              type="number"
              value={scaleDenom}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setScaleDenom(Math.floor(v));
              }}
              sx={{ width: 130 }}
              inputProps={{ step: 1, min: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StraightenIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="1/50"><span>
                <Button size="small" variant="outlined" onClick={() => setScaleDenom(50)}>1/50</Button>
              </span></Tooltip>
              <Tooltip title="1/75"><span>
                <Button size="small" variant="outlined" onClick={() => setScaleDenom(75)}>1/75</Button>
              </span></Tooltip>
              <Tooltip title="1/100"><span>
                <Button size="small" variant="outlined" onClick={() => setScaleDenom(100)}>1/100</Button>
              </span></Tooltip>
              <Tooltip title="リセット（1/100）">
                <IconButton size="small" onClick={resetScale}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />

            {/* 用紙サイズ（mm） */}
            <TextField
              select
              size="small"
              label="用紙"
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value, orientation)}
              sx={{ width: 100 }}
            >
              {Object.keys(PRESETS).map((k) => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </TextField>

            <ToggleButtonGroup
              value={orientation}
              exclusive
              size="small"
              onChange={(_, v) => v && applyPreset(presetKey, v)}
            >
              <ToggleButton value="portrait">縦</ToggleButton>
              <ToggleButton value="landscape">横</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              size="small"
              label="幅(mm)"
              type="number"
              value={customW}
              onChange={(e) => onChangeCustomWidth(e.target.value)}
              sx={{ width: 110 }}
              inputProps={{ step: 1, min: 1 }}
            />
            <TextField
              size="small"
              label="高さ(mm)"
              type="number"
              value={customH}
              onChange={(e) => onChangeCustomHeight(e.target.value)}
              sx={{ width: 110 }}
              inputProps={{ step: 1, min: 1 }}
            />
          </Stack>
        </MuiToolbar>
      </AppBar>

      {/* AppBar 高さ分のスペーサ */}
      <Box sx={(theme) => theme.mixins.toolbar} />
    </>
  );
}
