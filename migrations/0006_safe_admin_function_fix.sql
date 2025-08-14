-- Safe fix for is_admin() function security
-- Use CREATE OR REPLACE instead of DROP to avoid breaking policy dependencies

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid()::text IN (
    SELECT id FROM public.users WHERE role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;