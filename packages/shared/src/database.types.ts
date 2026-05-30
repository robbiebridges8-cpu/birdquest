export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          total_points: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          total_points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          total_points?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      species: {
        Row: {
          id: string;
          ebird_code: string;
          common_name: string;
          scientific_name: string;
          taxonomic_order: number | null;
          category: string;
          base_value: number;
        };
        Insert: {
          id?: string;
          ebird_code: string;
          common_name: string;
          scientific_name: string;
          taxonomic_order?: number | null;
          category?: string;
          base_value?: number;
        };
        Update: {
          id?: string;
          ebird_code?: string;
          common_name?: string;
          scientific_name?: string;
          taxonomic_order?: number | null;
          category?: string;
          base_value?: number;
        };
        Relationships: [];
      };
      sightings: {
        Row: {
          id: string;
          user_id: string;
          species_id: string;
          location: unknown;
          observed_at: string;
          media_url: string | null;
          media_type: "audio" | "photo" | null;
          confidence: number | null;
          verification_status: "auto_verified" | "peer_review_pending" | "casual" | "rejected";
          points_awarded: number;
          h3_cell_r6: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          species_id: string;
          location: unknown;
          observed_at: string;
          media_url?: string | null;
          media_type?: "audio" | "photo" | null;
          confidence?: number | null;
          verification_status?: "auto_verified" | "peer_review_pending" | "casual" | "rejected";
          points_awarded?: number;
          h3_cell_r6: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          species_id?: string;
          location?: unknown;
          observed_at?: string;
          media_url?: string | null;
          media_type?: "audio" | "photo" | null;
          confidence?: number | null;
          verification_status?: "auto_verified" | "peer_review_pending" | "casual" | "rejected";
          points_awarded?: number;
          h3_cell_r6?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sightings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sightings_species_id_fkey";
            columns: ["species_id"];
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
        ];
      };
      rarity_scores: {
        Row: {
          id: string;
          species_id: string;
          h3_cell: string;
          h3_resolution: number;
          month: number;
          frequency: number;
          point_value: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          species_id: string;
          h3_cell: string;
          h3_resolution: number;
          month: number;
          frequency: number;
          point_value: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          species_id?: string;
          h3_cell?: string;
          h3_resolution?: number;
          month?: number;
          frequency?: number;
          point_value?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rarity_scores_species_id_fkey";
            columns: ["species_id"];
            referencedRelation: "species";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          status: "pending" | "accepted" | "blocked";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          status?: "pending" | "accepted" | "blocked";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_a?: string;
          user_b?: string;
          status?: "pending" | "accepted" | "blocked";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_fkey";
            columns: ["user_a"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_user_b_fkey";
            columns: ["user_b"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      patches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          area: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          area: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          area?: unknown;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patches_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {};
    Functions: {
      compute_sighting_points: {
        Args: {
          p_species_id: string;
          p_h3_cell: string;
          p_month: number;
          p_verification_status: string;
        };
        Returns: number;
      };
      get_user_tier: {
        Args: {
          p_total_points: number;
        };
        Returns: string;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}
