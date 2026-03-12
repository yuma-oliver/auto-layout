// src/components/SitePhotos.jsx
import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Card,
  CardMedia,
  CardContent,
  Typography,
  IconButton,
} from "@mui/material";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

export default function SitePhotos({ initialPhotos = [] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const inputRef = useRef(null);

  // オブジェクトURLのクリーンアップ
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
      });
    };
  }, [photos]);

  const handleClickSelect = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos = files.map((file, idx) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        objectUrl,
      };
    });

    setPhotos((prev) => [...prev, ...newPhotos]);

    // 同じファイルを続けて選択できるように value をリセット
    e.target.value = "";
  };

  const handleDelete = (id) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* 追加ボタン＋hidden input */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddPhotoAlternateRoundedIcon />}
          onClick={handleClickSelect}
        >
          現場写真を追加する
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </Box>

      {/* カード一覧 */}
      {photos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          現場写真がまだ登録されていません。
          「現場写真を追加する」ボタンから画像ファイルを選択してください。
        </Typography>
      ) : (
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {photos.map((photo) => (
            <Card
              key={photo.id}
              sx={{
                width: 160,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardMedia
                component="img"
                image={photo.objectUrl}
                alt={photo.name}
                sx={{
                  height: 100,
                  objectFit: "cover",
                }}
              />
              <CardContent
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  p: 1,
                }}
              >
                <Typography
                  variant="caption"
                  noWrap
                  title={photo.name}
                  sx={{ mb: 0.5 }}
                >
                  {photo.name}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: "auto",
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(photo.id)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
