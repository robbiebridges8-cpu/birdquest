import { latLngToCell } from "h3-js";
import { supabase } from "./supabase";

export interface CreateSightingParams {
  userId: string;
  speciesId: string;
  latitude: number;
  longitude: number;
  observedAt: Date;
  confidence: number;
  mediaUrl?: string;
  mediaType?: "audio" | "photo";
  verificationStatus: "auto_verified" | "casual";
}

export interface SightingResult {
  id: string;
  points_awarded: number;
  species_common_name?: string;
}

export async function createSighting(
  params: CreateSightingParams
): Promise<SightingResult> {
  const h3Cell = latLngToCell(params.latitude, params.longitude, 6);

  // PostGIS point format
  const locationWkt = `POINT(${params.longitude} ${params.latitude})`;

  const { data, error } = await supabase
    .from("sightings")
    .insert({
      user_id: params.userId,
      species_id: params.speciesId,
      location: locationWkt,
      observed_at: params.observedAt.toISOString(),
      confidence: params.confidence,
      media_url: params.mediaUrl ?? null,
      media_type: params.mediaType ?? null,
      verification_status: params.verificationStatus,
      h3_cell_r6: h3Cell,
    })
    .select("id, points_awarded")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    points_awarded: data.points_awarded,
  };
}

/**
 * Look up a species UUID by common name (fuzzy match).
 * Falls back to exact match on ebird_code if available.
 */
export async function findSpeciesByName(
  commonName: string
): Promise<{ id: string; common_name: string; ebird_code: string } | null> {
  // Try exact match first
  const { data: exact } = await supabase
    .from("species")
    .select("id, common_name, ebird_code")
    .ilike("common_name", commonName)
    .limit(1)
    .single();

  if (exact) return exact;

  // Try partial match
  const { data: partial } = await supabase
    .from("species")
    .select("id, common_name, ebird_code")
    .ilike("common_name", `%${commonName}%`)
    .limit(1)
    .single();

  return partial ?? null;
}

/**
 * Look up a species by ebird_code.
 */
export async function findSpeciesByCode(
  ebirdCode: string
): Promise<{ id: string; common_name: string; ebird_code: string } | null> {
  const { data } = await supabase
    .from("species")
    .select("id, common_name, ebird_code")
    .eq("ebird_code", ebirdCode)
    .limit(1)
    .single();

  return data ?? null;
}
