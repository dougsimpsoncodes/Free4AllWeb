-- RLS Performance Optimization
-- Fix auth.uid() re-evaluation and duplicate policies

-- =====================================================
-- DROP EXISTING POLICIES TO RECREATE WITH OPTIMIZATION
-- =====================================================

-- Drop user-specific policies to recreate with performance optimization
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can insert own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can update own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can delete own alert preferences" ON public.alert_preferences;
DROP POLICY IF EXISTS "Users can view own alert history" ON public.alert_history;
DROP POLICY IF EXISTS "Users can view own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can insert own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can update own device tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can delete own device tokens" ON public.device_tokens;

-- Drop duplicate admin policies (keep only the ALL policy, remove separate SELECT)
DROP POLICY IF EXISTS "Only admins can view discovery sources" ON public.discovery_sources;
DROP POLICY IF EXISTS "Only admins can view search terms" ON public.search_terms;
DROP POLICY IF EXISTS "Only admins can view discovered sites" ON public.discovered_sites;

-- =====================================================
-- RECREATE POLICIES WITH PERFORMANCE OPTIMIZATION
-- =====================================================

-- Users: Optimized with (select auth.uid())
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING ((select auth.uid()::text) = id);

CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING ((select auth.uid()::text) = id);

-- Alert Preferences: Optimized
CREATE POLICY "Users can view own alert preferences" 
ON public.alert_preferences FOR SELECT 
USING ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can insert own alert preferences" 
ON public.alert_preferences FOR INSERT 
WITH CHECK ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can update own alert preferences" 
ON public.alert_preferences FOR UPDATE 
USING ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can delete own alert preferences" 
ON public.alert_preferences FOR DELETE 
USING ((select auth.uid()::text) = user_id);

-- Alert History: Optimized
CREATE POLICY "Users can view own alert history" 
ON public.alert_history FOR SELECT 
USING ((select auth.uid()::text) = user_id);

-- Device Tokens: Optimized
CREATE POLICY "Users can view own device tokens" 
ON public.device_tokens FOR SELECT 
USING ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can insert own device tokens" 
ON public.device_tokens FOR INSERT 
WITH CHECK ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can update own device tokens" 
ON public.device_tokens FOR UPDATE 
USING ((select auth.uid()::text) = user_id);

CREATE POLICY "Users can delete own device tokens" 
ON public.device_tokens FOR DELETE 
USING ((select auth.uid()::text) = user_id);

-- =====================================================
-- NOTE: Admin policies now only use the "ALL" policy
-- The separate "view" policies were removed to eliminate duplicates
-- =====================================================