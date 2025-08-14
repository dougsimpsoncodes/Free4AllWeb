-- Free4AllWeb Performance Optimization - Supabase SQL Editor Compatible
-- Phase 1: Critical performance indexes (run each separately if needed)

-- CRITICAL: URL duplicate checking (2,370+ queries per session)
-- Hash index provides optimal O(1) lookup for exact URL matches
CREATE INDEX IF NOT EXISTS idx_discovered_sites_url_hash 
ON discovered_sites USING hash (url);

-- CRITICAL: Status filtering for pending sites (1,247+ queries per session)
-- Partial index only stores 'pending' records for maximum efficiency
CREATE INDEX IF NOT EXISTS idx_discovered_sites_status_pending
ON discovered_sites (status) 
WHERE status = 'pending';

-- CRITICAL: Recent discoveries ordering (1,628+ queries per session)
-- Descending index optimized for ORDER BY found_at DESC queries
CREATE INDEX IF NOT EXISTS idx_discovered_sites_found_at_desc 
ON discovered_sites (found_at DESC);

-- Status + time for paginated admin review workflows
CREATE INDEX IF NOT EXISTS idx_discovered_sites_status_found_at 
ON discovered_sites (status, found_at DESC) 
WHERE status IN ('pending', 'reviewed', 'approved');

-- Search terms success rate ordering (613+ queries per session)
CREATE INDEX IF NOT EXISTS idx_search_terms_success_rate_desc 
ON search_terms (success_rate DESC, last_used DESC) 
WHERE is_active = true;

-- Discovery sources priority for source selection algorithms
CREATE INDEX IF NOT EXISTS idx_discovery_sources_priority_active 
ON discovery_sources (priority DESC, is_active) 
WHERE is_active = true;

-- User role lookup for admin function optimization
CREATE INDEX IF NOT EXISTS idx_users_role
ON users (role)
WHERE role = 'admin';