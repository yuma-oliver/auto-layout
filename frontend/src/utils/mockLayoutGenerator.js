import useLayoutStore from "../store/useLayoutStore";

import shodanTableA from "../shared/assets/furniture/shodan/table_A.png";
import shodanTableB from "../shared/assets/furniture/shodan/table_B.png";
import shodanTableC from "../shared/assets/furniture/shodan/table_C.png";
import shodanTableD from "../shared/assets/furniture/shodan/table_D.png";

import machiaiSofaA from "../shared/assets/furniture/machiai/sofa_A.png";
import machiaiLoungeA from "../shared/assets/furniture/machiai/loungechair_A.png";
import machiaiKidsA from "../shared/assets/furniture/machiai/kids_A.png";

import serviceTableA from "../shared/assets/furniture/service_machiai/bigtable_A.png";
import serviceBrandA from "../shared/assets/furniture/service_machiai/brand_A.png";

import jimuDeskA from "../shared/assets/furniture/jimu/desk_A.png";
import jimuHighA from "../shared/assets/furniture/jimu/highcounter_A.png";
import jimuHighB from "../shared/assets/furniture/jimu/highcounter_B.png";

const shodanAssets = [shodanTableA, shodanTableB, shodanTableC, shodanTableD];
const machiaiAssets = [machiaiSofaA, machiaiLoungeA, machiaiKidsA];
const serviceAssets = [serviceTableA, serviceBrandA];
const jimuAssets = [jimuDeskA, jimuHighA, jimuHighB];

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const getAssetsForZoneLabel = (label) => {
  if (!label) return [];
  if (label.includes("商談")) return [shodanTableA];
  if (label.includes("サービス")) return [serviceTableA];
  if (label.includes("待合")) return [machiaiSofaA];
  if (label.includes("事務")) return [jimuDeskA];
  return [];
};

export const styleForLabel = (label = "") => {
  if (!label) return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
  if (label.includes("商談")) return { fill: "rgba(220,0,0,0.28)", stroke: "rgba(220,0,0,0.9)" };
  if (label.includes("サービス") && label.includes("待合"))
    return { fill: "rgba(0,120,215,0.28)", stroke: "rgba(0,120,215,0.9)" };
  if (label.includes("待合")) return { fill: "rgba(0,170,80,0.28)", stroke: "rgba(0,170,80,0.9)" };
  if (label.includes("事務")) return { fill: "rgba(128,128,128,0.28)", stroke: "rgba(128,128,128,0.9)" };
  return { fill: "rgba(0,0,0,0)", stroke: "#000000" };
};

export const generateMockZoningFromArea = (baseZone) => {
  if (!baseZone) return;
  const { x, y, width, height } = baseZone;
  const cx = width / 2;
  const cy = height / 2;

  const z1 = { id: `z-shodan-${Date.now()}`, label: "商談エリア", x: x, y: y, width: cx, height: cy, ...styleForLabel("商談エリア"), furnitureAssets: getAssetsForZoneLabel("商談エリア") };
  const z2 = { id: `z-machiai-${Date.now()+1}`, label: "待合エリア", x: x + cx, y: y, width: cx, height: cy, ...styleForLabel("待合エリア"), furnitureAssets: getAssetsForZoneLabel("待合エリア") };
  const z3 = { id: `z-service-${Date.now()+2}`, label: "サービス待合エリア", x: x, y: y + cy, width: cx, height: cy, ...styleForLabel("サービス待合エリア"), furnitureAssets: getAssetsForZoneLabel("サービス待合エリア") };
  const z4 = { id: `z-office-${Date.now()+3}`, label: "事務エリア", x: x + cx, y: y + cy, width: cx, height: cy, ...styleForLabel("事務エリア"), furnitureAssets: getAssetsForZoneLabel("事務エリア") };

  const store = useLayoutStore.getState();
  const resetZones = store.zones.filter(z => z.id !== baseZone.id).concat([z1, z2, z3, z4]);
  store.setZones(resetZones);
  store.clearLayoutItems();
  store.setSelectedIds([]);
};

export const randomizeFurnitureForSelectedZones = (selectedIds) => {
  const store = useLayoutStore.getState();
  store.zones.forEach(z => {
    if (selectedIds.includes(z.id)) {
      let assets = [];
      const getMultiRandom = (arr) => {
        const numToPick = Math.floor(Math.random() * 3) + 1; // 1 to 3 types
        const picked = [];
        for(let i=0; i<numToPick; i++) {
          picked.push(getRandom(arr));
        }
        return [...new Set(picked)];
      };

      if (z.label?.includes("商談")) assets = getMultiRandom(shodanAssets);
      else if (z.label?.includes("サービス")) assets = getMultiRandom(serviceAssets);
      else if (z.label?.includes("待合")) assets = getMultiRandom(machiaiAssets);
      else if (z.label?.includes("事務")) assets = getMultiRandom(jimuAssets);
      
      if (assets.length > 0) {
        store.updateZone(z.id, { furnitureAssets: assets, layoutSeed: Date.now() + Math.random() });
      }
    }
  });
};

export function generateMockLayouts(zones, selectedIds = []) {
  const mockItems = zones.map(z => {
    // If we only want to update selected zones, and this zone is not among them, just return empty items and ignore
    if (selectedIds && selectedIds.length > 0 && !selectedIds.includes(z.id)) {
      return { zone_id: z.id, items: [] };
    }

    let images = z.furnitureAssets || [];
    
    // Fallbacks just in case
    if (!images || images.length === 0) {
      if (z.label?.includes("商談")) {
         images = [getRandom(shodanAssets)];
      } else if (z.label?.includes("サービス")) {
         images = [getRandom(serviceAssets)];
      } else if (z.label?.includes("待合")) {
         images = [getRandom(machiaiAssets)];
      } else if (z.label?.includes("事務")) {
         images = [getRandom(jimuAssets)];
      } else {
         images = [shodanTableA];
      }
    }

    // Smart layout calculation based on zone dimensions, introducing random scattering factor
    const aspect = z.width / Math.max(z.height, 1);
    
    let cols = 2;
    let rows = 2;

    // Add some random variation to the base columns/rows
    const varianceX = Math.floor(Math.random() * 2);
    const varianceY = Math.floor(Math.random() * 2);

    if (aspect > 2.5) {
       cols = 4 + varianceX; rows = 1;
    } else if (aspect > 1.5) {
       cols = 3 + varianceX; rows = 1 + varianceY;
    } else if (aspect < 0.4) {
       cols = 1; rows = 4 + varianceY;
    } else if (aspect < 0.7) {
       cols = 1 + varianceX; rows = 3 + varianceY;
    }

    const area = z.width * z.height;
    if (area < 10000) { 
      cols = 1; rows = 1; 
    } else if (area < 25000) { 
      cols = Math.min(cols, 2); 
      rows = Math.min(rows, 1); 
    } else if (area > 80000) {
      cols = Math.max(cols, 3);
      rows = Math.max(rows, 3);
    }

    // Sometimes rotate the whole setup by 90 degrees if mostly square
    let baseRotation = 0;
    if (aspect >= 0.8 && aspect <= 1.2 && Math.random() > 0.5) {
      baseRotation = 90;
    }

    const items = [];
    const stepX = z.width / cols;
    const stepY = z.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Add tiny random jitter
        const jitterX = (Math.random() - 0.5) * (stepX * 0.1);
        const jitterY = (Math.random() - 0.5) * (stepY * 0.1);

        const img = images[(r * cols + c) % images.length];

        items.push({
          image_url: img,
          x: z.x + (stepX * c) + (stepX / 2) + jitterX,
          y: z.y + (stepY * r) + (stepY / 2) + jitterY,
          rotation: baseRotation
        });
      }
    }
    
    // Also explicitly update the zone's layoutSeed to force it to shuffle in PDF layer
    useLayoutStore.getState().updateZone(z.id, { layoutSeed: Date.now() + Math.random() });

    return {
      zone_id: z.id,
      items: items
    };
  });

  useLayoutStore.getState().setLayoutItems(mockItems);
}
