// RoiDemoModal.jsx
import React, { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid, TextField, Typography, Box, MenuItem, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

/**
 * props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onAdopt?: (payload) => void   // 採用ボタン押下時に結果を親へ返す
 */
// シナリオ（新築/改築 で内装の㎡単価を切替、FF&Eもシナリオ別に仮定）
const scenarios = [
  {
    key: "conservative",
    label: "保守的",
    conversion: 0.05,
    grossPerSale: 250_000,
    serviceAttachRate: 0.25,
    serviceGrossPerVisit: 10_000,
    opexPerEmp: 6_000_000,
    overheadPerSqm: 12_000,
    peakShare: 0.15,
    dwellShowroomH: 0.6,
    dwellNegotiationH: 1.0,
    dwellServiceH: 1.0,
    counterServRatePerHr: 20,
    // 内装工事 ㎡単価（新築/改築）
    buildCostPerSqmNew: 1_200_000,
    buildCostPerSqmRenov: 700_000,
    // 家具（FF&E） ㎡単価
    ffePerSqm: 60_000,
    targetPaybackYears: 8,
  },
  {
    key: "base",
    label: "基準",
    conversion: 0.08,
    grossPerSale: 300_000,
    serviceAttachRate: 0.30,
    serviceGrossPerVisit: 12_000,
    opexPerEmp: 6_500_000,
    overheadPerSqm: 13_500,
    peakShare: 0.18,
    dwellShowroomH: 0.7,
    dwellNegotiationH: 1.2,
    dwellServiceH: 1.2,
    counterServRatePerHr: 22,
    buildCostPerSqmNew: 1_300_000,
    buildCostPerSqmRenov: 800_000,
    ffePerSqm: 80_000,
    targetPaybackYears: 7,
  },
  {
    key: "aggressive",
    label: "攻め",
    conversion: 0.12,
    grossPerSale: 350_000,
    serviceAttachRate: 0.35,
    serviceGrossPerVisit: 15_000,
    opexPerEmp: 7_000_000,
    overheadPerSqm: 15_000,
    peakShare: 0.20,
    dwellShowroomH: 0.8,
    dwellNegotiationH: 1.4,
    dwellServiceH: 1.4,
    counterServRatePerHr: 24,
    buildCostPerSqmNew: 1_500_000,
    buildCostPerSqmRenov: 950_000,
    ffePerSqm: 100_000,
    targetPaybackYears: 6,
  },
];

export default function RoiDemoModal({ open, onClose, onAdopt }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  // 入力
  const [weekdayVisitors, setWeekdayVisitors] = useState(80);
  const [weekendVisitors, setWeekendVisitors] = useState(140);
  const [showroomArea, setShowroomArea] = useState(600);
  const [employees, setEmployees] = useState(18);
  const [buildType, setBuildType] = useState("new"); // "new" | "renovation"

  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);


  const annualVisitors = useMemo(() => {
    const DAYS = { WEEKDAY: 250, WEEKEND: 115 };
    return Math.max(0, weekdayVisitors * DAYS.WEEKDAY + weekendVisitors * DAYS.WEEKEND);
  }, [weekdayVisitors, weekendVisitors]);
  const designDayVisitors = useMemo(
    () => Math.max(weekdayVisitors, weekendVisitors),
    [weekdayVisitors, weekendVisitors]
  );

  const results = useMemo(() => {
    const compute = (sc) => {
      const buildCostPerSqm =
        buildType === "new" ? sc.buildCostPerSqmNew : sc.buildCostPerSqmRenov;

      // 売上・利益
      const annualSalesUnits = annualVisitors * sc.conversion;
      const annualSalesGross = annualSalesUnits * sc.grossPerSale;
      const annualServiceVisits = annualVisitors * sc.serviceAttachRate;
      const annualServiceGross = annualServiceVisits * sc.serviceGrossPerVisit;
      const grossProfit = annualSalesGross + annualServiceGross;

      const opex = employees * sc.opexPerEmp + showroomArea * sc.overheadPerSqm;
      const operatingProfit = Math.max(0, grossProfit - opex);

      // CAPEX（内装+FF&E+IT備品/人） ※建築本体は含めず“ショールーム内装”に寄せた想定
      const interiorCost = showroomArea * buildCostPerSqm; // 内装工事（新築/改築）
      const ffeCost = showroomArea * sc.ffePerSqm;         // 家具（FF&E）
      const itEquipCost = employees * 500_000;             // IT備品の簡易想定（固定）

      const capex = interiorCost + ffeCost + itEquipCost;

      // 回収年数/投資可能額（営業利益ベース）
      const paybackYears = operatingProfit > 0 ? capex / operatingProfit : Infinity;
      const investable = operatingProfit * sc.targetPaybackYears;

      // 席数
      const peakHourlyVisitors = designDayVisitors * sc.peakShare;
      const waitSeats = Math.ceil(peakHourlyVisitors * sc.dwellShowroomH);
      const negotiationSeats = Math.ceil(peakHourlyVisitors * sc.conversion * sc.dwellNegotiationH);
      const servicePeakHourly = peakHourlyVisitors * sc.serviceAttachRate;
      const serviceWaitSeats = Math.ceil(servicePeakHourly * sc.dwellServiceH);
      const receptionSeats = Math.max(1, Math.ceil(peakHourlyVisitors / sc.counterServRatePerHr));

      // 投資可能額の推奨配分（内装:家具 = 7:3 を初期ガイド、上書き自由に）
      const investInterior = investable * 0.7;
      const investFfe = investable * 0.3;

      return {
        sc,
        buildType,
        // 入力サマリ
        inputs: { weekdayVisitors, weekendVisitors, showroomArea, employees },
        // 損益
        operatingProfit,
        grossProfit,
        // CAPEXと内訳
        capex,
        interiorCost,
        ffeCost,
        itEquipCost,
        // 投資可能額と推奨配分
        investable,
        investInterior,
        investFfe,
        // 回収
        paybackYears,
        // 席数
        waitSeats,
        negotiationSeats,
        serviceWaitSeats,
        receptionSeats,
        // 参考
        peakHourlyVisitors,
      };
    };
    return scenarios.map(compute);
  }, [
    annualVisitors,
    designDayVisitors,
    showroomArea,
    employees,
    buildType,
    weekdayVisitors,
    weekendVisitors,
  ]);

  const yen = (v) => (isFinite(v) ? v.toLocaleString("ja-JP", { style: "currency", currency: "JPY" }) : "—");
  const num = (v) => (isFinite(v) ? v.toLocaleString("ja-JP") : "—");
  const yrs = (v) => (v === Infinity ? "—" : `${v.toFixed(1)} 年`);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={fullScreen}>
      <DialogTitle>カーディーラー ROI 査定（デモ）</DialogTitle>
      <Typography variant="body2" sx={{ color: "text.secondary", ml:3, mb:2 }}>※本番環境ではリアルなデータを基に入力、出力内容を検討したいです</Typography>

      <DialogContent dividers>
        {/* 入力 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, color: "text.secondary" }}>
            入力（最小限）
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="平日客数（組/日）" type="number" fullWidth
                value={weekdayVisitors} onChange={(e) => setWeekdayVisitors(n(e.target.value))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="休日客数（組/日）" type="number" fullWidth
                value={weekendVisitors} onChange={(e) => setWeekendVisitors(n(e.target.value))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="ショールーム面積（㎡）" type="number" fullWidth
                value={showroomArea} onChange={(e) => setShowroomArea(n(e.target.value))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField label="従業員数（人）" type="number" fullWidth
                value={employees} onChange={(e) => setEmployees(n(e.target.value))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth label="工事種別"
                value={buildType} onChange={(e) => setBuildType(e.target.value)}
              >
                <MenuItem value="new">新築（内装新設）</MenuItem>
                <MenuItem value="renovation">改築・改装（リノベ）</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Box sx={{ mt: 1, color: "text.secondary" }}>
            <Typography variant="caption">
              年間来店組数：{num(annualVisitors)} ／ 設計用ピーク日：{num(designDayVisitors)}（平日と休日の大きい方）
            </Typography>
          </Box>
        </Box>

        {/* 結果 3パターン */}
        <Grid container spacing={2}>
          {results.map((r) => (
            <Grid item xs={12} md={4} key={r.sc.key}>
              <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {r.sc.label}（{r.buildType === "new" ? "新築" : "改築"}）
                </Typography>

                <InfoRow label="投資可能金額（営業利益ベース）" value={yen(r.investable)} />
                <InfoRow label="推奨配分：内装" value={yen(r.investInterior)} />
                <InfoRow label="推奨配分：家具(FF&E)" value={yen(r.investFfe)} />

                <Box sx={{ my: 1, borderTop: "1px dashed", borderColor: "divider" }} />

                <InfoRow label="推定内装工事費" value={yen(r.interiorCost)} />
                <InfoRow label="推定家具費(FF&E)" value={yen(r.ffeCost)} />
                <InfoRow label="推定IT備品費" value={yen(r.itEquipCost)} />
                <InfoRow label="推定CAPEX合計" value={yen(r.capex)} />

                <Box sx={{ my: 1, borderTop: "1px dashed", borderColor: "divider" }} />

                <InfoRow label="推定営業利益/年" value={yen(r.operatingProfit)} />
                <InfoRow label="投資回収年数" value={yrs(r.paybackYears)} />

                <Box sx={{ my: 1, borderTop: "1px dashed", borderColor: "divider" }} />

                <InfoRow label="商談席数" value={`${num(r.negotiationSeats)} 席`} />
                <InfoRow label="サービス待合席数" value={`${num(r.serviceWaitSeats)} 席`} />
                <InfoRow label="待合席数（一般）" value={`${num(r.waitSeats)} 席`} />
                <InfoRow label="受付席数" value={`${num(r.receptionSeats)} 席`} />

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  ピーク来客：{num(r.peakHourlyVisitors)} 組/時
                </Typography>

                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <Button
                    fullWidth variant="contained"
                    onClick={() => {
                      onAdopt?.({
                        scenarioKey: r.sc.key,
                        scenarioLabel: r.sc.label,
                        buildType: r.buildType,
                        inputs: r.inputs,
                        investable: r.investable,
                        investInterior: r.investInterior,
                        investFfe: r.investFfe,
                        interiorCost: r.interiorCost,
                        ffeCost: r.ffeCost,
                        itEquipCost: r.itEquipCost,
                        capex: r.capex,
                        operatingProfit: r.operatingProfit,
                        paybackYears: r.paybackYears,
                        seats: {
                          negotiation: r.negotiationSeats,
                          serviceWait: r.serviceWaitSeats,
                          wait: r.waitSeats,
                          reception: r.receptionSeats,
                        },
                      });
                      onClose?.();
                    }}
                  >
                    採用
                  </Button>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            ※ デモ用の概算モデルです。現地データ・ブランド要件で調整してください。
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", my: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}
