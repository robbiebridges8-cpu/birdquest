export type { Database } from "./database.types";

export type VerificationStatus = "auto_verified" | "peer_reviewed" | "unverified";

export interface Sighting {
  id: string;
  userId: string;
  speciesId: string;
  location: { lat: number; lng: number };
  observedAt: string;
  mediaUrl?: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  pointsAwarded: number;
}

export interface RarityScore {
  speciesId: string;
  h3Cell: string;
  month: number;
  frequency: number;
  pointValue: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  tier: string;
}
