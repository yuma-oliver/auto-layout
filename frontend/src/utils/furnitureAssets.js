import shodanTableA from "../shared/assets/furniture/shodan/table_A.png";
import machiaiSofaA from "../shared/assets/furniture/machiai/sofa_A.png";
import serviceTableA from "../shared/assets/furniture/service_machiai/bigtable_A.png";
import jimuDeskA from "../shared/assets/furniture/jimu/desk_A.png";

export function getAssetsForZoneLabel(label) {
  if (!label) return [];
  if (label.includes("商談")) return [shodanTableA];
  if (label.includes("サービス")) return [serviceTableA];
  if (label.includes("待合")) return [machiaiSofaA];
  if (label.includes("事務")) return [jimuDeskA];
  return [];
}
