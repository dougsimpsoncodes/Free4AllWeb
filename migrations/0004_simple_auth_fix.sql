-- Simple fix for auth.uid() performance issues
-- Replace all existing policies with optimized versions

-- Users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING ((select auth.uid())::text = id);

CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING ((select auth.uid())::text = id);

-- Alert preferences table
DROP POLICY IF EXISTS "Users can view own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can update own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can delete own alert preferences" ON public.alert_preferences;

CREATE POLICY "Users can view own alert preferences" 
ON public.alert_preferences FOR SELECT 
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own alert preferences" 
ON public.alert_preferences FOR INSERT 
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can update own alert preferences" 
ON public.alert_preferences FOR UPDATE 
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can delete own alert preferences" 
ON public.alert_preferences FOR DELETE 
USING ((select auth.uid())::text = user_id);

-- Alert history table
DROP POLICY IF EXISTS "Users can view own alert history" ON public.alert_history;

CREATE POLICY "Users can view own alert history" 
ON public.alert_history FOR SELECT 
USING ((select auth.uid())::text = user_id);

-- Device tokens table
DROP POLICY IF EXISTS "Users can view own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can insert own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can update own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can delete own device tokens" ON public.device_tokens;

CREATE POLICY "Users can view own device tokens" 
ON public.device_tokens FOR SELECT 
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own device tokens" 
ON public.device_tokens FOR INSERT 
WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Users can update own device tokens" 
ON public.device_tokens FOR UPDATE 
USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can delete own device tokens" 
ON public.device_tokens FOR DELETE 
USING ((select auth.uid())::text = user_id);