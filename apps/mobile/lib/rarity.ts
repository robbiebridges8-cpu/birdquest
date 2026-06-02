export interface RarityInfo {
  label: string;
  color: string;
  bg: string;
}

export function getRarity(points: number): RarityInfo {
  if (points >= 40) return { label: "Very Rare", color: "#7c3aed", bg: "#ede9fe" };
  if (points >= 20) return { label: "Rare",      color: "#dc2626", bg: "#fee2e2" };
  if (points >= 8)  return { label: "Uncommon",  color: "#d97706", bg: "#fef3c7" };
  return              { label: "Common",     color: "#16a34a", bg: "#dcfce7" };
}
