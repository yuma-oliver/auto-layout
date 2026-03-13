import { create } from 'zustand';

const useAppStore = create((set) => ({
  // ======== State ========
  pdfFile: null,
  scaleDenom: 100,
  paperSizeMm: { w: 0, h: 0 },
  activeTab: "PLAN", // PLAN, ZONE, AUTO, EXPORT
  activeZoneLabel: "商談エリア",
  drawMode: "zone", // "wall" | "zone"

  // ======== Actions ========
  setPdfFile: (file) => set({ pdfFile: file }),
  setScaleDenom: (scale) => set({ scaleDenom: scale }),
  setPaperSizeMm: (size) => set({ paperSizeMm: size }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveZoneLabel: (label) => set({ activeZoneLabel: label }),
  setDrawMode: (mode) => set({ drawMode: mode }),
}));

export default useAppStore;
