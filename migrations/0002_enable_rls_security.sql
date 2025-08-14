-- Enable Row Level Security (RLS) on all public tables
-- This is CRITICAL for Supabase security to prevent unauthorized access via the anon key

-- Enable RLS on all tables
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggered_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_trigger_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PUBLIC READ POLICIES (data that should be public)
-- =====================================================

-- Teams: Everyone can read teams
CREATE POLICY "Teams are viewable by everyone" 
ON public.teams FOR SELECT 
USING (true);

-- Leagues: Everyone can read leagues
CREATE POLICY "Leagues are viewable by everyone" 
ON public.leagues FOR SELECT 
USING (true);

-- Restaurants: Everyone can read restaurants
CREATE POLICY "Restaurants are viewable by everyone" 
ON public.restaurants FOR SELECT 
USING (true);

-- Promotions: Everyone can read approved promotions
CREATE POLICY "Approved promotions are viewable by everyone" 
ON public.promotions FOR SELECT 
USING (state IN ('approved', 'validated', 'triggered', 'redeemed', 'expired'));

-- Deal Pages: Everyone can read active deal pages
CREATE POLICY "Active deal pages are viewable by everyone" 
ON public.deal_pages FOR SELECT 
USING (is_active = true);

-- Games: Everyone can read games
CREATE POLICY "Games are viewable by everyone" 
ON public.games FOR SELECT 
USING (true);

-- Triggered Deals: Everyone can read triggered deals
CREATE POLICY "Triggered deals are viewable by everyone" 
ON public.triggered_deals FOR SELECT 
USING (true);

-- =====================================================
-- USER-SPECIFIC POLICIES (authenticated users only)
-- =====================================================

-- Users: Users can only read their own profile
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid()::text = id);

-- Users: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (auth.uid()::text = id);

-- Alert Preferences: Users can manage their own preferences
CREATE POLICY "Users can view own alert preferences" 
ON public.alert_preferences FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own alert preferences" 
ON public.alert_preferences FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own alert preferences" 
ON public.alert_preferences FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own alert preferences" 
ON public.alert_preferences FOR DELETE 
USING (auth.uid()::text = user_id);

-- Alert History: Users can view their own alert history
CREATE POLICY "Users can view own alert history" 
ON public.alert_history FOR SELECT 
USING (auth.uid()::text = user_id);

-- Device Tokens: Users can manage their own device tokens
CREATE POLICY "Users can view own device tokens" 
ON public.device_tokens FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own device tokens" 
ON public.device_tokens FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own device tokens" 
ON public.device_tokens FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own device tokens" 
ON public.device_tokens FOR DELETE 
USING (auth.uid()::text = user_id);

-- =====================================================
-- ADMIN-ONLY POLICIES (requires admin role)
-- =====================================================

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid()::text IN (
    SELECT id FROM public.users WHERE role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Discovery Sources: Admin only
CREATE POLICY "Only admins can view discovery sources" 
ON public.discovery_sources FOR SELECT 
USING (is_admin());

CREATE POLICY "Only admins can manage discovery sources" 
ON public.discovery_sources FOR ALL 
USING (is_admin());

-- Search Terms: Admin only
CREATE POLICY "Only admins can view search terms" 
ON public.search_terms FOR SELECT 
USING (is_admin());

CREATE POLICY "Only admins can manage search terms" 
ON public.search_terms FOR ALL 
USING (is_admin());

-- Discovered Sites: Admin only
CREATE POLICY "Only admins can view discovered sites" 
ON public.discovered_sites FOR SELECT 
USING (is_admin());

CREATE POLICY "Only admins can manage discovered sites" 
ON public.discovered_sites FOR ALL 
USING (is_admin());

-- Promotion Trigger Events: Admin read, system write
CREATE POLICY "Admins can view promotion trigger events" 
ON public.promotion_trigger_events FOR SELECT 
USING (is_admin());

-- Sessions: No public access (handled by backend only)
-- No policies for sessions table - completely restricted

-- =====================================================
-- SERVICE ROLE POLICIES (for backend operations)
-- =====================================================

-- Allow service role to bypass RLS for all operations
-- This is automatically handled by Supabase service role key

-- =====================================================
-- NOTES
-- =====================================================
-- 1. The service role key bypasses RLS entirely
-- 2. The anon key respects these RLS policies
-- 3. Authenticated users get auth.uid() which maps to their Clerk ID
-- 4. Admin checks use the is_admin() function
-- 5. Sessions table has no policies - backend only access
