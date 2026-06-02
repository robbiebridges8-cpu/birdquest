-- Allow all authenticated users to read rare sightings (points >= 20) for community map
CREATE POLICY sightings_select_rare ON sightings FOR SELECT TO authenticated
    USING (points_awarded >= 20);
