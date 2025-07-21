-- PERFORMANCE: Add database indexes for faster queries
-- These indexes will dramatically speed up common queries

-- Index on foreign keys (most important)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_team_id ON games(team_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_team_id ON promotions(team_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_restaurant_id ON promotions(restaurant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggered_deals_promotion_id ON triggered_deals(promotion_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggered_deals_game_id ON triggered_deals(game_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_preferences_user_id ON alert_preferences(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_preferences_team_id ON alert_preferences(team_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_source_id ON discovered_sites(source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_search_term_id ON discovered_sites(search_term_id);

-- Index on commonly queried fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_game_date ON games(game_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_is_complete ON games(is_complete);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggered_deals_is_active ON triggered_deals(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggered_deals_triggered_at ON triggered_deals(triggered_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_is_active ON teams(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_status ON discovered_sites(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_found_at ON discovered_sites(found_at);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggered_deals_active_triggered_at ON triggered_deals(is_active, triggered_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_team_date ON games(team_id, game_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_team_active ON promotions(team_id, is_active);

-- Text search indexes for better search performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_title_gin ON discovered_sites USING gin(to_tsvector('english', title));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_sites_content_gin ON discovered_sites USING gin(to_tsvector('english', content));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_title_gin ON promotions USING gin(to_tsvector('english', title));