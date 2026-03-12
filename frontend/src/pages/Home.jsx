import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Typography, Container, Stack } from "@mui/material";

export default function Home({ isAuthenticated, onLogout }) {
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        <Typography variant="h2" gutterBottom fontWeight="bold" color="primary">
          Auto Layout AI
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          ショールームの面積や必要席数から、AIがゾーニングと家具レイアウトを自動生成します。
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center" mt={4}>
          {!isAuthenticated ? (
            <>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/login"
              >
                ログイン
              </Button>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/register"
              >
                アカウント登録
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/dashboard"
                color="secondary"
              >
                ダッシュボードへ
              </Button>
              <Button variant="text" onClick={onLogout}>
                ログアウト
              </Button>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
