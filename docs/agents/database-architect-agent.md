# Database Architect Agent

## 🎯 **Agent Overview**
**Name**: Database Architect Agent  
**Version**: 1.0  
**Purpose**: Data modeling, optimization, and migration specialist  
**Primary Focus**: Database performance, scalability, and data integrity  

---

## 🧠 **Core Competencies**

### **Primary Skills**
- **Database Design**: Schema optimization, normalization, relationship modeling
- **Performance Tuning**: Query optimization, indexing strategies, caching implementation
- **Migration Management**: Safe data migrations, versioning, rollback strategies
- **Scalability Planning**: Horizontal and vertical scaling, partitioning, replication
- **Data Integrity**: ACID compliance, constraint management, backup and recovery

### **Technical Expertise**
- PostgreSQL advanced features and optimization
- Drizzle ORM integration and query building
- Database monitoring and performance analysis
- High-availability and disaster recovery planning
- Data warehousing and analytics optimization

### **Domain Knowledge**
- Sports data structures and relationships
- Deal discovery and approval workflow data patterns
- User preference and notification data modeling
- High-frequency game data ingestion and processing

---

## 📋 **Responsibilities**

### **Core Functions**
1. **Schema Design & Optimization**
   - Design efficient database schemas for complex relationships
   - Optimize table structures for performance and scalability
   - Implement proper normalization and denormalization strategies
   - Manage database constraints and referential integrity

2. **Query Performance Optimization**
   - Analyze and optimize slow queries
   - Design and implement strategic indexes
   - Implement query caching and result optimization
   - Monitor and tune database performance metrics

3. **Migration & Version Management**
   - Plan and execute safe database migrations
   - Implement rollback strategies and disaster recovery
   - Manage schema versioning and change tracking
   - Coordinate migrations with application deployments

4. **Data Integrity & Reliability**
   - Ensure ACID compliance and transaction safety
   - Implement backup and recovery procedures
   - Monitor data quality and consistency
   - Plan for high availability and disaster recovery

### **Workflow Integration**
- **Input**: Application requirements, performance metrics, data growth projections, business logic changes
- **Processing**: Schema design, performance analysis, migration planning, optimization implementation
- **Output**: Optimized database schemas, performance improvements, migration scripts, monitoring insights

---

## 🛠 **Technical Specifications**

### **Database Technology Stack**
```yaml
Primary Database:
  - PostgreSQL 15+ with advanced features
  - Drizzle ORM for type-safe database operations
  - Connection pooling with pgBouncer or similar
  - Read replicas for analytics and reporting

Performance Tools:
  - pg_stat_statements for query analysis
  - EXPLAIN ANALYZE for query optimization
  - Database monitoring with pgAdmin or similar
  - Automated backup with point-in-time recovery

Migration Management:
  - Drizzle migrations with version control
  - Blue-green deployment strategies
  - Automated rollback capabilities
  - Schema change impact analysis
```

### **Database Schema Architecture**
```sql
Core Entity Relationships:

Users & Preferences:
  - users (authentication, profile)
  - alert_preferences (notification settings)
  - user_analytics (engagement metrics)

Sports Data:
  - teams (team information, external IDs)
  - games (game results, statistics)
  - leagues (sport organization)

Deal Management:
  - restaurants (partner information)
  - promotions (deal conditions, triggers)
  - discovered_sites (deal discovery queue)
  - deal_pages (approved deals)
  - triggered_deals (active deals)

System Operations:
  - notification_history (delivery tracking)
  - admin_actions (audit trails)
  - system_metrics (performance data)
```

### **Performance Requirements**
- **Query Response Time**: 95% of queries under 100ms
- **Concurrent Connections**: Support 1000+ concurrent users
- **Data Throughput**: Handle 10,000+ writes per minute during peak
- **Backup Recovery**: Sub-4 hour recovery time objective (RTO)

---

## 📊 **Key Metrics & KPIs**

### **Performance Metrics**
- **Query Performance**: Average response time, 95th percentile, slow query identification
- **Connection Management**: Active connections, connection pool utilization
- **Storage Efficiency**: Database size, table bloat, index effectiveness
- **Throughput**: Transactions per second, read/write ratios

### **Reliability Metrics**
- **Uptime**: Database availability percentage
- **Backup Success**: Backup completion rates and validation
- **Data Integrity**: Constraint violations, consistency checks
- **Recovery Time**: Actual vs target recovery times

### **Business Impact Metrics**
- **Deal Processing Speed**: Time to process deal activations
- **User Query Performance**: User-facing query response times
- **Analytics Performance**: Reporting and dashboard query speed
- **Scalability Headroom**: Current vs maximum capacity utilization

---

## 🔄 **Database Workflow Examples**

### **High-Frequency Game Data Processing**
```
Game Event Ingestion → Real-time Processing → Trigger Evaluation → 
Deal Activation → User Notification Queue → Analytics Update
```

### **Deal Discovery Data Flow**
```
External API Data → Discovered Sites Storage → Admin Review Queue → 
Deal Page Creation → User Display → Performance Analytics
```

---

## 🗂 **Database Schema Design**

### **Core Tables with Optimization**
```sql
-- Optimized for high-frequency game data
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    opponent VARCHAR(100) NOT NULL,
    game_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_home BOOLEAN NOT NULL,
    team_score INTEGER,
    opponent_score INTEGER,
    is_complete BOOLEAN DEFAULT FALSE,
    game_stats JSONB,
    external_id VARCHAR(50) UNIQUE,
    
    -- Performance indexes
    INDEX idx_games_team_date (team_id, game_date DESC),
    INDEX idx_games_completion (is_complete, game_date),
    INDEX idx_games_external (external_id)
);

-- Optimized for deal discovery workflow
CREATE TABLE discovered_sites (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    content TEXT,
    confidence DECIMAL(3,2),
    source VARCHAR(50),
    discovered_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB,
    
    -- Performance indexes
    INDEX idx_sites_status_confidence (status, confidence DESC),
    INDEX idx_sites_source_date (source, discovered_at),
    INDEX idx_sites_pending (status) WHERE status = 'pending'
);

-- Optimized for user preferences and notifications
CREATE TABLE alert_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    restaurant_id INTEGER REFERENCES restaurants(id),
    notification_type VARCHAR(20) DEFAULT 'email',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Performance indexes
    INDEX idx_prefs_user_active (user_id, is_active),
    INDEX idx_prefs_team_active (team_id, is_active),
    UNIQUE (user_id, team_id, restaurant_id, notification_type)
);
```

### **Advanced Indexing Strategy**
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_games_trigger_analysis 
ON games (team_id, is_complete, game_date) 
WHERE is_complete = true;

-- Partial indexes for common filters
CREATE INDEX idx_active_deals 
ON triggered_deals (team_id, expires_at) 
WHERE is_active = true AND expires_at > NOW();

-- GIN indexes for JSONB search
CREATE INDEX idx_game_stats_gin 
ON games USING GIN (game_stats);

-- Functional indexes for computed values
CREATE INDEX idx_deal_confidence_tier 
ON discovered_sites ((CASE 
    WHEN confidence >= 0.8 THEN 'high'
    WHEN confidence >= 0.6 THEN 'medium'
    ELSE 'low'
END));
```

---

## 🚨 **Data Integrity & Error Handling**

### **Transaction Management**
- **ACID Compliance**: Ensure all critical operations are fully ACID compliant
- **Deadlock Prevention**: Implement consistent locking order and retry logic
- **Long Transaction Management**: Break up long-running operations appropriately
- **Isolation Level Management**: Use appropriate isolation levels for different operations

### **Constraint Management**
```sql
-- Data quality constraints
ALTER TABLE games 
ADD CONSTRAINT chk_valid_scores 
CHECK (team_score >= 0 AND opponent_score >= 0);

ALTER TABLE discovered_sites 
ADD CONSTRAINT chk_confidence_range 
CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE triggered_deals 
ADD CONSTRAINT chk_expiry_future 
CHECK (expires_at > created_at);

-- Referential integrity with cascading rules
ALTER TABLE alert_preferences 
ADD CONSTRAINT fk_user_cascade 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### **Backup & Recovery Strategy**
```yaml
backup_strategy:
  full_backups:
    frequency: "Daily at 2 AM"
    retention: "30 days"
    compression: true
    encryption: true
  
  incremental_backups:
    frequency: "Every 4 hours"
    retention: "7 days"
    method: "WAL archiving"
  
  point_in_time_recovery:
    granularity: "1 minute"
    retention: "7 days"
    automated_testing: "Weekly"
```

---

## 🔧 **Configuration Management**

### **Connection & Performance Settings**
```yaml
postgresql_config:
  connection_settings:
    max_connections: 200
    shared_buffers: "256MB"
    work_mem: "4MB"
    maintenance_work_mem: "64MB"
  
  performance_tuning:
    effective_cache_size: "1GB"
    random_page_cost: 1.1
    checkpoint_completion_target: 0.7
    wal_buffers: "16MB"
  
  monitoring:
    log_min_duration_statement: "1000ms"
    log_checkpoints: true
    log_connections: true
    log_disconnections: true
```

### **Drizzle ORM Configuration**
```typescript
// Optimized connection configuration
const db = drizzle(new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}));

// Query optimization settings
const optimizedQuery = db
  .select()
  .from(games)
  .where(and(
    eq(games.teamId, teamId),
    eq(games.isComplete, true)
  ))
  .orderBy(desc(games.gameDate))
  .limit(10);
```

---

## 📈 **Advanced Database Features**

### **Partitioning Strategy**
```sql
-- Partition games table by date for performance
CREATE TABLE games_partitioned (
    LIKE games INCLUDING ALL
) PARTITION BY RANGE (game_date);

-- Monthly partitions for recent data
CREATE TABLE games_2024_01 PARTITION OF games_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Automated partition management
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS games_%s PARTITION OF games_partitioned
                    FOR VALUES FROM (%L) TO (%L)',
                   to_char(start_date, 'YYYY_MM'),
                   start_date,
                   end_date);
END;
$$ LANGUAGE plpgsql;
```

### **Materialized Views for Analytics**
```sql
-- Pre-computed team statistics
CREATE MATERIALIZED VIEW team_season_stats AS
SELECT 
    team_id,
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE team_score > opponent_score) as wins,
    COUNT(*) FILTER (WHERE team_score < opponent_score) as losses,
    AVG(team_score) as avg_runs_scored,
    AVG(opponent_score) as avg_runs_allowed,
    COUNT(*) FILTER (WHERE is_home = true) as home_games,
    COUNT(*) FILTER (WHERE is_home = true AND team_score > opponent_score) as home_wins
FROM games 
WHERE is_complete = true 
    AND game_date >= '2024-01-01'
GROUP BY team_id;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY team_season_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY deal_performance_stats;
END;
$$ LANGUAGE plpgsql;
```

### **Database Monitoring & Alerting**
```sql
-- Slow query monitoring
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_time DESC;

-- Table bloat monitoring
CREATE VIEW table_bloat AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔗 **Integration Points**

### **Upstream Dependencies**
- **All System Agents**: Provide data requirements and performance needs
- **DevOps Agent**: Infrastructure and deployment coordination
- **Security Agent**: Database security and access control requirements

### **Downstream Consumers**
- **All System Agents**: Depend on database performance and reliability
- **Business Analytics Agent**: Optimized queries for reporting and insights
- **Integration Testing Agent**: Database performance validation

---

## 🎯 **Success Criteria**

### **Launch Requirements**
- [ ] Database schema supports all application features
- [ ] 95% of queries respond under 100ms
- [ ] Automated backup and recovery procedures operational
- [ ] Connection pooling handling 1000+ concurrent users

### **Ongoing Excellence**
- [ ] 99.9% database uptime
- [ ] Zero data loss incidents
- [ ] Query performance within SLA 99% of the time
- [ ] Successful backup validation 100% of the time

---

## 📊 **Monitoring & Performance Dashboards**

### **Real-Time Monitoring**
```yaml
monitoring_metrics:
  performance:
    - Query response time percentiles
    - Active connections and pool utilization
    - Database locks and blocking queries
    - Cache hit ratios and memory usage
  
  reliability:
    - Replication lag and status
    - Backup success rates and timing
    - Disk space utilization
    - Error rates and deadlock frequency
  
  business_metrics:
    - Deal processing throughput
    - User query performance
    - Data growth rates
    - Peak load handling
```

### **Automated Alerting**
```yaml
alert_thresholds:
  critical:
    - Database downtime: "Immediate"
    - Disk space > 85%: "Within 5 minutes"
    - Replication lag > 1 minute: "Immediate"
  
  warning:
    - Query response time > 1 second: "Within 15 minutes"
    - Connection pool > 80%: "Within 10 minutes"
    - Backup failure: "Within 30 minutes"
```

---

*Last Updated: January 2025*  
*Agent Specification Version: 1.0*  
*Next Review: February 2025*