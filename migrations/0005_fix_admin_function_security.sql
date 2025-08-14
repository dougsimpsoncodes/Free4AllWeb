-- Fix is_admin() function security by setting search_path
-- This prevents potential schema confusion attacks

DROP FUNCTION IF EXISTS is_admin();

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid()::text IN (
    SELECT id FROM public.users WHERE role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;