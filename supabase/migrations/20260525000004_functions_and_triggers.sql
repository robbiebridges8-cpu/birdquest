-- Function: compute sighting points from rarity_scores lookup
CREATE OR REPLACE FUNCTION compute_sighting_points(
    p_species_id uuid,
    p_h3_cell text,
    p_month smallint,
    p_verification_status text
) RETURNS integer AS $$
DECLARE
    v_point_value integer;
    v_verification_mult real;
BEGIN
    -- Look up pre-computed point value (tries res 6, then 5, then 4)
    SELECT point_value INTO v_point_value
    FROM rarity_scores
    WHERE species_id = p_species_id
      AND h3_cell = p_h3_cell
      AND h3_resolution = 6
      AND month = p_month;

    IF v_point_value IS NULL THEN
        -- Try parent cell at resolution 5 (first 14 chars of H3 index approximate parent)
        SELECT point_value INTO v_point_value
        FROM rarity_scores
        WHERE species_id = p_species_id
          AND h3_resolution = 5
          AND month = p_month
          AND h3_cell = substring(p_h3_cell from 1 for 14);

        IF v_point_value IS NULL THEN
            -- Try resolution 4
            SELECT point_value INTO v_point_value
            FROM rarity_scores
            WHERE species_id = p_species_id
              AND h3_resolution = 4
              AND month = p_month
            LIMIT 1;
        END IF;
    END IF;

    -- Fallback: use base_value from species table
    IF v_point_value IS NULL THEN
        SELECT base_value INTO v_point_value FROM species WHERE id = p_species_id;
        IF v_point_value IS NULL THEN
            v_point_value := 1;
        END IF;
    END IF;

    -- Apply verification multiplier
    v_verification_mult := CASE p_verification_status
        WHEN 'auto_verified' THEN 1.0
        WHEN 'casual' THEN 0.5
        WHEN 'peer_review_pending' THEN 0.5
        WHEN 'rejected' THEN 0.0
        ELSE 0.5
    END;

    RETURN round(v_point_value * v_verification_mult)::integer;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger: set points_awarded on sighting insert
CREATE OR REPLACE FUNCTION set_sighting_points() RETURNS trigger AS $$
BEGIN
    NEW.points_awarded := compute_sighting_points(
        NEW.species_id,
        NEW.h3_cell_r6,
        EXTRACT(MONTH FROM NEW.observed_at)::smallint,
        NEW.verification_status
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_sighting_points
    BEFORE INSERT ON sightings
    FOR EACH ROW
    EXECUTE FUNCTION set_sighting_points();

-- Trigger: update user total_points after sighting insert
CREATE OR REPLACE FUNCTION update_user_total_points() RETURNS trigger AS $$
BEGIN
    UPDATE profiles
    SET total_points = total_points + NEW.points_awarded
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_total_points
    AFTER INSERT ON sightings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_total_points();

-- Function: get user tier from total_points
CREATE OR REPLACE FUNCTION get_user_tier(p_total_points bigint) RETURNS text AS $$
BEGIN
    RETURN CASE
        WHEN p_total_points >= 10000 THEN 'legendary'
        WHEN p_total_points >= 5000 THEN 'expert'
        WHEN p_total_points >= 2000 THEN 'advanced'
        WHEN p_total_points >= 500 THEN 'intermediate'
        WHEN p_total_points >= 100 THEN 'beginner'
        ELSE 'novice'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
