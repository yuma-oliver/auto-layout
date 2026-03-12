import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Stack
} from "@mui/material";

// ZoneList と同じ順で
const LABEL_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "商談エリア", label: "商談エリア" },
  { value: "待合エリア", label: "待合エリア" },
  { value: "サービス待合エリア", label: "サービス待合エリア" },
  { value: "事務エリア", label: "事務エリア" },
];

export default function ZoneLabelDialog({ open, onClose, onSave }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) setLabel(""); // デフォルトは未設定
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>ゾーンのラベルを選択</DialogTitle>
      <DialogContent>
        <Stack sx={{ mt: 1, minWidth: 260 }}>
          <TextField
            select
            size="small"
            label="ラベル"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          >
            {LABEL_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>あとで</Button>
        <Button variant="contained" onClick={() => onSave?.(label)}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
