export interface RarityInfo {
  label: string;
  color: string;
  bg: string;
}

export function getRarity(points: number): RarityInfo {
  if (points >= 40) return { label: "Very Rare", color: "#a78bfa", bg: "#1e1040" };
  if (points >= 20) return { label: "Rare",      color: "#f87171", bg: "#2d0707" };
  if (points >= 8)  return { label: "Uncommon",  color: "#fbbf24", bg: "#241100" };
  return              { label: "Common",     color: "#4ade80", bg: "#052d12" };
}
