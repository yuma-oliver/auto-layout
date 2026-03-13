import { create } from 'zustand';

const useLayoutStore = create((set) => ({
  // ======== State ========
  zones: [],
  layoutItems: [],    // [{ zone_id, items: [...] }]
  selectedIds: [],    // 複数選択対応
  zoneSelections: {}, // { [zoneId]: { [imageUrl]: qty } }
  plans: [],          // 保存されたプラン履歴 [{ id, name, timestamp, zones, layoutItems }]
  currentPlanId: null, // 現在ロード/保存中のプランID

  // ======== Actions ========

  // Zone CRUD
  addZone: (newZone) =>
    set((state) => ({ zones: [...state.zones, newZone] })),

  updateZone: (id, patch) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
    })),

  deleteZone: (id) =>
    set((state) => {
      const nextZoneSelections = { ...state.zoneSelections };
      delete nextZoneSelections[id];

      return {
        zones: state.zones.filter((z) => z.id !== id),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        layoutItems: state.layoutItems.filter((r) => r.zone_id !== id),
        zoneSelections: nextZoneSelections,
      };
    }),

  // Furniture Meta (ZoneData内包用)
  upsertFurnitureMeta: (zoneId, url, meta) =>
    set((state) => ({
      zones: state.zones.map((z) => {
        if (z.id !== zoneId) return z;
        return {
          ...z,
          furnitureMetaMap: {
            ...(z.furnitureMetaMap || {}),
            [url]: { ...(z.furnitureMetaMap?.[url] || {}), ...meta },
          },
        };
      }),
    })),

  saveAssetsForZone: (zoneId, urls, metaMap = {}, counts = {}) =>
    set((state) => ({
      zones: state.zones.map((z) => {
        if (z.id !== zoneId) return z;
        return {
          ...z,
          furnitureAssets: urls,
          furnitureMetaMap: {
            ...(z.furnitureMetaMap || {}),
            ...metaMap,
          },
          furnitureCounts: counts,
        };
      }),
    })),

  // Layout Items
  setLayoutItems: (newItemsOrUpdater) =>
    set((state) => ({
      layoutItems:
        typeof newItemsOrUpdater === 'function'
          ? newItemsOrUpdater(state.layoutItems)
          : newItemsOrUpdater,
    })),

  clearLayoutItems: () => set({ layoutItems: [] }),

  // Selection
  setSelectedIds: (newIdsOrUpdater) =>
    set((state) => ({
      selectedIds:
        typeof newIdsOrUpdater === 'function'
          ? newIdsOrUpdater(state.selectedIds)
          : newIdsOrUpdater,
    })),

  // ZoneSelections (パワポ用)
  setZoneSelections: (updaterOrNewSelections) =>
    set((state) => ({
      zoneSelections:
        typeof updaterOrNewSelections === 'function'
          ? updaterOrNewSelections(state.zoneSelections)
          : updaterOrNewSelections,
    })),

  changeZoneSelections: (zoneId, nextMap) =>
    set((state) => ({
      zoneSelections: {
        ...state.zoneSelections,
        [zoneId]: nextMap,
      },
    })),

  // Entire State Replacement (Export/Import用など)
  setZones: (newZones) => set({ zones: newZones }),

  // ======== Plan Management ========
  savePlan: (name, forceNew = false) => set((state) => {
    // If a plan is loaded and we're NOT forcing new and NO new name is provided, update the existing plan
    if (state.currentPlanId && !forceNew && !name) {
      return {
        plans: state.plans.map(p => p.id === state.currentPlanId ? {
          ...p,
          timestamp: new Date().toISOString(),
          zones: JSON.parse(JSON.stringify(state.zones)),
          layoutItems: JSON.parse(JSON.stringify(state.layoutItems))
        } : p)
      };
    }

    // Otherwise, create a new plan
    const newId = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9);
    const newPlan = {
      id: newId,
      name: name || `プラン ${state.plans.length + 1}`,
      timestamp: new Date().toISOString(),
      zones: JSON.parse(JSON.stringify(state.zones)),
      layoutItems: JSON.parse(JSON.stringify(state.layoutItems))
    };
    return { plans: [...state.plans, newPlan], currentPlanId: newId };
  }),

  loadPlan: (planId) => set((state) => {
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan) return {};
    return {
      zones: JSON.parse(JSON.stringify(plan.zones)),
      layoutItems: JSON.parse(JSON.stringify(plan.layoutItems)),
      selectedIds: [],
      currentPlanId: planId,
    };
  }),

  deletePlan: (planId) => set((state) => ({
    plans: state.plans.filter((p) => p.id !== planId),
    currentPlanId: state.currentPlanId === planId ? null : state.currentPlanId
  })),
}));

export default useLayoutStore;
