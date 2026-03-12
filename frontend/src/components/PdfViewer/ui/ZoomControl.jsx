// ズームスライダー＋リセット
// src/components/PdfViewer/ui/ZoomControl.jsx
import { Box, Slider, IconButton, Tooltip } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

export default function ZoomControl({ zoom, onChange, rightPadding = 320 }) {
  return (
    <Box sx={{
      position:"absolute", top: 8, right: 8 + rightPadding,
      bgcolor:"rgba(255,255,255,0.9)", borderRadius:2, px:1, py:0.5, boxShadow:1
    }}>
      <Box sx={{ display:"flex", alignItems:"center" }}>
        <Slider size="small" value={zoom} min={0.5} max={2} step={0.05}
          onChange={(_, v) => onChange(v)} sx={{ width:120, mr:1 }} />
        <Tooltip title="リセット">
          <IconButton size="small" onClick={() => onChange(1)}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
