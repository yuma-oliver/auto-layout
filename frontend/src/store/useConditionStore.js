import { create } from 'zustand';

const useConditionStore = create((set) => ({
  showroomArea: "", // 初期値は空にして未入力を許容
  requirements: {
    receptionStaff: "",
    waitingSeats: "",
    serviceWaitingSeats: "",
    meetingSeats: "",
    officeSeats: "",
  },
  extractedRequirements: null,
  selectedPdf: null,

  zoningSeed: 1,
  furnitureSeed: 1,

  evaluation: {
    score: null, // number | null
    details: {},
  },

  setShowroomArea: (area) => set({ showroomArea: area }),
  setRequirements: (reqs) => set((state) => ({ requirements: { ...state.requirements, ...reqs } })),
  setExtractedRequirements: (reqs) => set({ extractedRequirements: reqs }),
  setSelectedPdf: (file) => set({ selectedPdf: file }),
  
  incrementZoningSeed: () => set((state) => ({ zoningSeed: state.zoningSeed + 1 })),
  incrementFurnitureSeed: () => set((state) => ({ furnitureSeed: state.furnitureSeed + 1 })),
  
  setEvaluation: (evalData) => set({ evaluation: evalData }),
  
  resetConditions: () => set({
    showroomArea: "",
    requirements: {
      receptionStaff: "",
      waitingSeats: "",
      serviceWaitingSeats: "",
      meetingSeats: "",
      officeSeats: "",
    },
    extractedRequirements: null,
    selectedPdf: null,
    evaluation: { score: null, details: {} },
    zoningSeed: 1,
    furnitureSeed: 1,
  }),
}));

export default useConditionStore;
