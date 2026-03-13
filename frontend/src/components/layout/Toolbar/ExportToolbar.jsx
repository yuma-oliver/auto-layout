import React from "react";
import { Stack, Button } from "@mui/material";

export default function ExportToolbar({ onExportPng, onExportJson, onSendToBackend }) {
  return (
    <Stack direction="column" spacing={2} sx={{ width: '100%' }}>
      <Button variant="contained" color="primary" fullWidth onClick={onExportPng}>
        PNG保存
      </Button>
      <Button variant="outlined" fullWidth onClick={onExportJson}>
        JSON出力
      </Button>
      <Button variant="outlined" color="success" fullWidth onClick={onSendToBackend}>
        FASTAPI送信
      </Button>
    </Stack>
  );
}
