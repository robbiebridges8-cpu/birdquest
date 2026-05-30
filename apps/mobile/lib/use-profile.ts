import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  total_points: number;
  tier: string;
}

const TIER_MAP: Record<string, string> = {
  novice: "Novice Birder",
  beginner: "Beginner Birder",
  intermediate: "Keen Birder",
  advanced: "Advanced Birder",
  expert: "Expert Birder",
  legendary: "Legendary Birder",
};

export function getTierLabel(tier: string): string {
  return TIER_MAP[tier] ?? "Novice Birder";
}

function getTierFromPoints(points: number): string {
  if (points >= 10000) return "legendary";
  if (points >= 5000) return "expert";
  if (points >= 2000) return "advanced";
  if (points >= 500) return "intermediate";
  if (points >= 100) return "beginner";
  return "novice";
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery<Profile | null>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, total_points")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        total_points: data.total_points,
        tier: getTierFromPoints(data.total_points),
      };
    },
    enabled: !!user,
  });
}
