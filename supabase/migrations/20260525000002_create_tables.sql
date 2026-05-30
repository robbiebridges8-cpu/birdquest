-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    display_name text,
    total_points bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_username ON profiles (username);

-- Species table (loaded from eBird taxonomy)
CREATE TABLE species (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    ebird_code text UNIQUE NOT NULL,
    common_name text NOT NULL,
    scientific_name text NOT NULL,
    taxonomic_order numeric,
    category text NOT NULL DEFAULT 'species',
    base_value smallint NOT NULL DEFAULT 1
);
CREATE INDEX idx_species_ebird_code ON species (ebird_code);

-- Sightings table
CREATE TABLE sightings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    species_id uuid NOT NULL REFERENCES species(id),
    location geography(POINT, 4326) NOT NULL,
    observed_at timestamptz NOT NULL,
    media_url text,
    media_type text CHECK (media_type IN ('audio', 'photo')),
    confidence real CHECK (confidence >= 0 AND confidence <= 1),
    verification_status text NOT NULL DEFAULT 'casual'
        CHECK (verification_status IN ('auto_verified', 'peer_review_pending', 'casual', 'rejected')),
    points_awarded integer NOT NULL DEFAULT 0,
    h3_cell_r6 text NOT NULL CHECK (h3_cell_r6 ~ '^[0-9a-f]{15}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sightings_user_id ON sightings (user_id);
CREATE INDEX idx_sightings_species_id ON sightings (species_id);
CREATE INDEX idx_sightings_h3_cell ON sightings (h3_cell_r6);
CREATE INDEX idx_sightings_observed_at ON sightings (observed_at DESC);

-- Rarity scores table (ETL output)
CREATE TABLE rarity_scores (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    species_id uuid NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    h3_cell text NOT NULL,
    h3_resolution smallint NOT NULL CHECK (h3_resolution BETWEEN 4 AND 6),
    month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
    frequency real NOT NULL CHECK (frequency >= 0 AND frequency <= 1),
    point_value integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (species_id, h3_cell, h3_resolution, month)
);
CREATE INDEX idx_rarity_scores_lookup ON rarity_scores (h3_cell, h3_resolution, month, species_id);

-- Friendships table
CREATE TABLE friendships (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_a, user_b),
    CHECK (user_a < user_b)
);
CREATE INDEX idx_friendships_user_a ON friendships (user_a);
CREATE INDEX idx_friendships_user_b ON friendships (user_b);

-- Patches table (birding patches)
CREATE TABLE patches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    area geography(POLYGON, 4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patches_user_id ON patches (user_id);
