# 🧪 **Real-Time Deal Discovery Testing Plan**

## **Overview**
This plan will guide you through testing the complete deal discovery system from database cleanup to live monitoring and admin review.

---

## **📋 Step-by-Step Testing Process**

### **Step 1: Check Current System State**
```bash
# Check current deals in database
curl -s http://localhost:5001/api/admin/discovery/sites | jq '{total: .sites | length, pending: [.sites[] | select(.status=="pending")] | length, high_confidence: [.sites[] | select((.confidence | tonumber) > 0.6)] | length}'

# Check agent system status
curl -s http://localhost:5001/api/agents/status | jq '.data | {totalAgents, activeWorkflows, mcpServersConnected}'
```

### **Step 2: Clear Database (Fresh Start)**
```bash
# Connect to your database and run:
psql -d free4allweb_development -f clear-deals.sql
```

**Or manually:**
```sql
-- Show current state
SELECT COUNT(*) as total_deals FROM discovered_sites;

-- Clear all deals
DELETE FROM discovered_sites;
ALTER SEQUENCE discovered_sites_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT COUNT(*) as remaining_deals FROM discovered_sites;
```

### **Step 3: Trigger Fresh Discovery**
```bash
# Run deal discovery manually
curl -X POST http://localhost:5001/api/admin/discovery/run -H "Content-Type: application/json" | jq '.'
```

**Expected Output:**
```json
{
  "success": true,
  "sitesDiscovered": 15,
  "summary": {
    "totalSearched": 8,
    "avgConfidence": 0.42,
    "bySource": {
      "reddit": 12,
      "google": 3,
      "news": 0
    }
  }
}
```

### **Step 4: Monitor Discovery Results**
```bash
# Check newly discovered deals
curl -s http://localhost:5001/api/admin/discovery/sites | jq '{
  total: .sites | length,
  by_confidence: {
    high: [.sites[] | select((.confidence | tonumber) >= 0.6)] | length,
    medium: [.sites[] | select((.confidence | tonumber) >= 0.4 and (.confidence | tonumber) < 0.6)] | length,
    low: [.sites[] | select((.confidence | tonumber) < 0.4)] | length
  },
  top_3: .sites | sort_by(.confidence | tonumber) | reverse | .[0:3] | map({title, confidence, url})
}'
```

### **Step 5: Review Deals in Admin Interface**

1. **Open Admin Panel:** http://localhost:5001/admin
2. **View Discovery Dashboard:** Look for "Live Discovery" tab
3. **Filter by Confidence:** Use the confidence filter buttons (20%, 30%, 40%, 50%, 60%)
4. **Review Individual Deals:** Click "View Source" to see original Reddit/social posts

### **Step 6: Test Continuous Monitoring**

The system automatically runs discovery every 15 minutes. Monitor in real-time:

```bash
# Watch for new discoveries (run in terminal)
watch -n 30 'curl -s http://localhost:5001/api/admin/discovery/sites | jq "{total: .sites | length, latest: .sites | sort_by(.foundAt) | reverse | .[0] | {title, confidence, foundAt}}"'
```

### **Step 7: Test Agent Workflow System**

Trigger a game-based workflow to see the full system in action:
```bash
curl -X POST http://localhost:5001/api/agents/workflows/game-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test_game_'$(date +%s)'",
    "teamId": "dodgers",
    "eventType": "win",
    "score": {"home": 8, "away": 3}
  }' | jq '.'
```

---

## **🎯 What You Should See**

### **Fresh Discovery Run:**
- 15-25 new deals discovered
- Mix of confidence levels (20%-80%)
- Deals from Reddit, Google, News sources
- Proper food/restaurant/sports filtering

### **Admin Interface:**
- Real-time deal count updates
- Confidence-based filtering working
- Clickable source links to original posts
- Auto-refresh every 30 seconds

### **Continuous Monitoring:**
- New deals appearing every 15 minutes
- Agent system logging activity
- MCP servers staying connected (6/6)

---

## **🔍 Quality Checks**

### **Good Indicators:**
- ✅ Confidence scores vary (not all the same)
- ✅ Mix of sources (Reddit, Google, News)
- ✅ Food/deal-related content
- ✅ Recent timestamps (within last hour)
- ✅ Real URLs to Reddit posts, news articles

### **Red Flags:**
- ❌ All deals have same confidence score
- ❌ No variation in sources
- ❌ Generic/unrelated content
- ❌ Old timestamps
- ❌ Broken or fake URLs

---

## **🛠️ Troubleshooting**

### **No Deals Found:**
```bash
# Check API keys are set
echo "Reddit: ${REDDIT_CLIENT_ID:+SET} / Google: ${GOOGLE_API_KEY:+SET} / News: ${NEWS_API_KEY:+SET}"

# Check discovery sources are active
curl -s http://localhost:5001/api/admin/discovery/sources | jq '.sources[] | {name, isActive}'
```

### **Low Quality Results:**
- Adjust confidence thresholds in admin interface
- Review search terms being used
- Check source priorities

### **System Errors:**
```bash
# Check agent status
curl -s http://localhost:5001/api/agents/health | jq '.'

# View server logs
# (Check your terminal running npm run dev)
```

---

## **📈 Success Metrics**

After running this test plan, you should have:

1. **Clean Database**: Started with 0 deals
2. **Fresh Discovery**: Found 15+ new deals
3. **Quality Results**: Mix of confidence levels and sources  
4. **Working Interface**: Admin panel shows real-time data
5. **Continuous Operation**: New deals appearing every 15 minutes
6. **Agent Integration**: Workflows executing with real data

---

## **🎉 Final Validation**

Open two browser tabs:
- **User View**: http://localhost:5001 (clean marketing page)
- **Admin View**: http://localhost:5001/admin (live discovery data)

The separation should be clear - users see marketing, admins see raw discovery feeds.

**Ready to begin? Run Step 1 to check your current system state!**