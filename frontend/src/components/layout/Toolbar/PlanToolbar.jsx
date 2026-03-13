import React from "react";
import { Stack, Button, TextField, InputAdornment, Tooltip, IconButton, Divider } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import StraightenIcon from "@mui/icons-material/Straighten";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import useAppStore from "../../../store/useAppStore";

export default function PlanToolbar() {
  const { setPdfFile, scaleDenom, setScaleDenom } = useAppStore();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("PDFを選択してください");
      return;
    }
    setPdfFile(URL.createObjectURL(file));
  };

  const resetScale = () => setScaleDenom(100);

  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="outlined" component="label" startIcon={<DescriptionIcon />}>
        PDFをアップロード
        <input hidden type="file" accept="application/pdf" onChange={handleFileChange} />
      </Button>

      <Divider flexItem orientation="vertical" />

      {/* 縮尺設定 */}
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          label="縮尺 1 / N"
          type="number"
          value={scaleDenom}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) setScaleDenom(Math.floor(v));
          }}
          sx={{ width: 140 }}
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
          <Tooltip title="1/50"><Button size="small" variant="outlined" onClick={() => setScaleDenom(50)}>1/50</Button></Tooltip>
          <Tooltip title="1/75"><Button size="small" variant="outlined" onClick={() => setScaleDenom(75)}>1/75</Button></Tooltip>
          <Tooltip title="1/100"><Button size="small" variant="outlined" onClick={() => setScaleDenom(100)}>1/100</Button></Tooltip>
          <Tooltip title="縮尺リセット"><IconButton onClick={resetScale}><RestartAltIcon /></IconButton></Tooltip>
        </Stack>
      </Stack>
    </Stack>
  );
}
