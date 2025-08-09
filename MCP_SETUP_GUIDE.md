# MCP Server Implementation Guide

## Installed MCP Servers ✅

### Tier 1: Foundation Servers
- `@modelcontextprotocol/server-filesystem` - File system operations
- `@modelcontextprotocol/sdk` - Core MCP TypeScript SDK  
- `postgres-mcp` - PostgreSQL database access
- `reddit-mcp` - Reddit API integration

### Tier 2: Data Collection Servers  
- `@playwright/mcp` - Web scraping and browser automation
- `playwright` - Browser automation engine

### Tier 3: Communication Servers
- `@yiyang.1i/sms-mcp-server` - SMS via Twilio
- `slack-mcp-server` - Slack workspace integration

### Deprecated (Using alternatives)
- ~~`@modelcontextprotocol/server-postgres`~~ (deprecated - using `postgres-mcp`)
- ~~`@modelcontextprotocol/server-puppeteer`~~ (deprecated - using `@playwright/mcp`)

## Claude Code Configuration

To enable these MCP servers in Claude Code, add this to your Claude Code settings:

### Option 1: VS Code Integration
Add to your VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/dougsimpson/Projects/Free4AllWeb"]
      },
      "postgres": {
        "command": "npx",
        "args": ["postgres-mcp"],
        "env": {
          "DATABASE_URL": "postgresql://username:password@localhost:5432/free4allweb_development"
        }
      },
      "reddit": {
        "command": "npx", 
        "args": ["reddit-mcp"],
        "env": {
          "REDDIT_CLIENT_ID": "your_reddit_client_id",
          "REDDIT_CLIENT_SECRET": "your_reddit_client_secret",
          "REDDIT_USER_AGENT": "Free4AllWeb/1.0 by /u/yourusername"
        }
      }
    }
  }
}
```

### Option 2: Claude Desktop App Configuration
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/dougsimpson/Projects/Free4AllWeb"]
    },
    "postgres": {
      "command": "npx",
      "args": ["postgres-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://username:password@localhost:5432/free4allweb_development"
      }
    },
    "reddit": {
      "command": "npx",
      "args": ["reddit-mcp"],
      "env": {
        "REDDIT_CLIENT_ID": "your_reddit_client_id", 
        "REDDIT_CLIENT_SECRET": "your_reddit_client_secret",
        "REDDIT_USER_AGENT": "Free4AllWeb/1.0 by /u/yourusername"
      }
    }
  }
}
```

## Agent Integration Mapping

### Deal Discovery Agent
**MCP Servers**: Reddit, Filesystem, Postgres
**Benefits**: 
- Direct Reddit API access for deal hunting
- File system access for caching discovered deals
- Database queries for historical deal analysis

### Sports Data Agent
**MCP Servers**: Postgres, Filesystem
**Benefits**:
- Database queries for team schedules and game data
- File access for configuration and logs

### Database Architect Agent
**MCP Servers**: Postgres, Filesystem
**Benefits**:
- Direct database schema manipulation
- File system access for migration scripts

### Business Analytics Agent
**MCP Servers**: Postgres, Filesystem
**Benefits**:
- Complex analytical queries
- File access for reports and exports

## Setup Instructions

### 1. PostgreSQL Setup
```bash
# Update your environment variables
export DATABASE_URL="postgresql://username:password@localhost:5432/free4allweb_development"
```

### 2. Reddit API Setup
1. Go to https://www.reddit.com/prefs/apps
2. Create a new script application
3. Note your client_id and client_secret
4. Update environment variables:
```bash
export REDDIT_CLIENT_ID="your_client_id"
export REDDIT_CLIENT_SECRET="your_client_secret"
export REDDIT_USER_AGENT="Free4AllWeb/1.0 by /u/yourusername"
```

### 3. File System Permissions
The filesystem MCP server has access to `/Users/dougsimpson/Projects/Free4AllWeb` and can:
- Read/write files
- Create/list/delete directories  
- Move files/directories
- Search files
- Get file metadata

## Testing MCP Integration

Once configured, you can test by asking Claude to:

1. **Filesystem Operations**:
   - "List all files in the server directory"
   - "Read the package.json file"
   - "Create a new test file"

2. **Database Operations**:
   - "Show me the schema for the users table"
   - "Query active promotions"
   - "Analyze user engagement metrics"

3. **Reddit Operations**:
   - "Search for pizza deals in Los Angeles subreddits"
   - "Find food-related posts in r/LosAngeles"
   - "Monitor r/deals for restaurant promotions"

## Security Considerations

1. **Database Access**: The postgres MCP provides read/write access - use a restricted database user
2. **File System**: Limited to project directory only
3. **Reddit API**: Rate limited by Reddit's API policies
4. **Environment Variables**: Store credentials securely, never commit to git

## Troubleshooting

### Common Issues:
1. **MCP Server Not Found**: Ensure npx can find the package globally or install globally with `-g`
2. **Database Connection**: Verify DATABASE_URL is correct and database is running
3. **Reddit API**: Check credentials and user agent format
4. **Permissions**: Ensure Claude Code has necessary file system permissions

### Debug Commands:
```bash
# Test MCP server directly
npx @modelcontextprotocol/server-filesystem /Users/dougsimpson/Projects/Free4AllWeb

# Test database connection
npx postgres-mcp

# Test Reddit connection
npx reddit-mcp
```

## Next Steps

### Phase 2: Additional Servers to Install
- Web scraping MCP server for deal discovery
- Email MCP server for notifications
- SMS/Twilio MCP server for alerts
- Git MCP server for version control

### Phase 3: Custom MCP Development
- MLB API MCP server for game data
- Deal validation MCP server
- Notification orchestration MCP server

---

*Updated: August 2025*
*MCP Implementation Status: Phase 1 Complete*