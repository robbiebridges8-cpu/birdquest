-- Auto-create a profiles row when a new user signs up.
-- The username is initially set to 'user_' + first 8 chars of their UUID.
-- The onboarding screen in the app will prompt them to choose a real username.

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        'user_' || substring(NEW.id::text from 1 for 8),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
