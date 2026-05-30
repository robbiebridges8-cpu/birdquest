-- Create storage bucket for sighting media
INSERT INTO storage.buckets (id, name, public)
VALUES ('sighting-media', 'sighting-media', false);

-- RLS: users can upload to their own path
CREATE POLICY storage_upload ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'sighting-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- RLS: users can read their own uploads
CREATE POLICY storage_read_own ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'sighting-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- RLS: users can delete their own uploads
CREATE POLICY storage_delete_own ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'sighting-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
