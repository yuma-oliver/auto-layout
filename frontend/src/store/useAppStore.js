import { create } from 'zustand';

const useAppStore = create((set) => ({
  // ======== State ========
  pdfFile: null,
  scaleDenom: 100,
  paperSizeMm: { w: 0, h: 0 },
  isLeftOpen: true,

  // ======== Actions ========
  setPdfFile: (file) => set({ pdfFile: file }),
  setScaleDenom: (scale) => set({ scaleDenom: scale }),
  setPaperSizeMm: (size) => set({ paperSizeMm: size }),
  setIsLeftOpen: (isOpen) => set({ isLeftOpen: isOpen }),
}));

export default useAppStore;
