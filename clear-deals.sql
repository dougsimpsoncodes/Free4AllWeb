-- Clear Discovered Deals Database Script
-- WARNING: This will delete all discovered deals!

-- First, show current state
SELECT COUNT(*) as total_deals, 
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
       COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
       COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM discovered_sites;

-- Delete all discovered deals
DELETE FROM discovered_sites;

-- Reset the auto-increment counter
ALTER SEQUENCE discovered_sites_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT COUNT(*) as remaining_deals FROM discovered_sites;

-- Optional: Clear search terms and sources if you want a complete reset
-- DELETE FROM search_terms;
-- DELETE FROM discovery_sources;
-- ALTER SEQUENCE search_terms_id_seq RESTART WITH 1;
-- ALTER SEQUENCE discovery_sources_id_seq RESTART WITH 1;