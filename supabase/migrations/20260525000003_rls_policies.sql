-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE species ENABLE ROW LEVEL SECURITY;
ALTER TABLE sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rarity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE patches ENABLE ROW LEVEL SECURITY;

-- PROFILES: read all (for leaderboards), update own
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
    USING (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- SPECIES: read for authenticated, write only via service role
CREATE POLICY species_select ON species FOR SELECT TO authenticated
    USING (true);

-- SIGHTINGS: read own + friends'; write own
CREATE POLICY sightings_insert ON sightings FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY sightings_select ON sightings FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM friendships
            WHERE status = 'accepted'
            AND (
                (user_a = auth.uid() AND user_b = sightings.user_id)
                OR (user_b = auth.uid() AND user_a = sightings.user_id)
            )
        )
    );

-- RARITY_SCORES: read for authenticated, write only via service role
CREATE POLICY rarity_scores_select ON rarity_scores FOR SELECT TO authenticated
    USING (true);

-- FRIENDSHIPS: read rows involving self, insert where self is initiator
CREATE POLICY friendships_select ON friendships FOR SELECT TO authenticated
    USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY friendships_insert ON friendships FOR INSERT TO authenticated
    WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY friendships_update ON friendships FOR UPDATE TO authenticated
    USING (user_a = auth.uid() OR user_b = auth.uid());

-- PATCHES: read all (for patch leaderboard), write own
CREATE POLICY patches_select ON patches FOR SELECT TO authenticated
    USING (true);
CREATE POLICY patches_insert ON patches FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
CREATE POLICY patches_update ON patches FOR UPDATE TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY patches_delete ON patches FOR DELETE TO authenticated
    USING (user_id = auth.uid());
