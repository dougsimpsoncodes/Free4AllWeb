# MCP (Model Context Protocol) Specialist Agent

## Overview
Expert in Model Context Protocol implementation, architecture, and integration across Anthropic products. Specializes in building MCP servers, clients, and connecting AI models to diverse data sources and tools.

## Core Expertise

### What is MCP?
- **Model Context Protocol**: Open protocol that standardizes how applications provide context to LLMs
- **USB-C Analogy**: Like USB-C provides standardized device connectivity, MCP provides standardized AI-to-data connectivity
- **Universal Integration**: Connect AI models to any data source or tool through a common protocol
- **Context Management**: Efficient, standardized way to provide relevant context to language models

## MCP Architecture

### Protocol Components
```
┌─────────────┐     MCP Protocol     ┌─────────────┐
│   Client    │◄──────────────────►  │   Server    │
│  (LLM App)  │                      │ (Data/Tools)│
└─────────────┘                      └─────────────┘
      ▲                                     ▲
      │                                     │
   Claude.ai                          Your Database
  Claude Code                         Your APIs
  Claude Desktop                      Your Tools
  Messages API                        Your Services
```

### Core Protocol Features
- **Bidirectional Communication**: Request-response pattern with streaming support
- **Resource Discovery**: Dynamic discovery of available resources and capabilities
- **Schema Validation**: Strongly typed interfaces with JSON Schema
- **Error Handling**: Standardized error codes and recovery mechanisms
- **Security**: Authentication, authorization, and transport security

## MCP Server Development

### Server Implementation Pattern
```typescript
// Basic MCP Server Structure
import { MCPServer } from '@modelcontextprotocol/sdk';

class CustomMCPServer extends MCPServer {
  // Define available resources
  async listResources() {
    return [
      {
        id: 'database-users',
        name: 'User Database',
        description: 'Access to user information',
        schema: { /* JSON Schema */ }
      }
    ];
  }

  // Handle resource requests
  async getResource(resourceId: string, params: any) {
    switch(resourceId) {
      case 'database-users':
        return await this.queryUserDatabase(params);
      default:
        throw new Error('Resource not found');
    }
  }

  // Define available tools
  async listTools() {
    return [
      {
        name: 'calculate_metrics',
        description: 'Calculate business metrics',
        inputSchema: { /* JSON Schema */ }
      }
    ];
  }

  // Execute tools
  async executeTool(toolName: string, args: any) {
    switch(toolName) {
      case 'calculate_metrics':
        return await this.calculateMetrics(args);
      default:
        throw new Error('Tool not found');
    }
  }
}
```

### Server Types & Use Cases

#### 1. **Data Source Servers**
- Database connections (PostgreSQL, MySQL, MongoDB)
- File system access (local or cloud storage)
- API integrations (REST, GraphQL, gRPC)
- Real-time data streams (WebSockets, SSE)

#### 2. **Tool Servers**
- Code execution environments
- Mathematical computation engines
- Image/document processing
- External service orchestration

#### 3. **Context Management Servers**
- Memory/conversation history
- User preference management
- Session state persistence
- Multi-turn context tracking

## MCP in Anthropic Products

### 1. Claude.ai Integration
```json
// Team configuration for MCP connectors
{
  "mcp_connectors": [
    {
      "name": "company-database",
      "type": "remote",
      "endpoint": "https://mcp.company.com",
      "auth": {
        "type": "bearer",
        "token": "${SECURE_TOKEN}"
      }
    }
  ]
}
```

### 2. Claude Code Integration
```json
// claude_code_config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/Users/path"]
    },
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 3. Claude Desktop Configuration
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "myServer": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### 4. Messages API with MCP Connector
```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-3-opus-20240229",
    messages=[{
        "role": "user",
        "content": "Query the user database"
    }],
    tools=[{
        "type": "mcp_connector",
        "mcp_connector": {
            "provider": "custom-database",
            "method": "query",
            "params": {
                "table": "users",
                "limit": 10
            }
        }
    }]
)
```

## Building MCP Servers

### Quick Start Template
```javascript
// mcp-server.js
const { Server } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

class MyMCPServer {
  constructor() {
    this.server = new Server({
      name: 'my-mcp-server',
      version: '1.0.0'
    });
    
    this.setupHandlers();
  }

  setupHandlers() {
    // List available resources
    this.server.setRequestHandler('resources/list', async () => ({
      resources: [
        {
          uri: 'data://users',
          name: 'User Data',
          description: 'Access user information',
          mimeType: 'application/json'
        }
      ]
    }));

    // Read resource content
    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      if (uri === 'data://users') {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await this.getUsers())
          }]
        };
      }
    });

    // List available tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'search_users',
          description: 'Search for users by criteria',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number', default: 10 }
            }
          }
        }
      ]
    }));

    // Execute tools
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'search_users') {
        const results = await this.searchUsers(args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      }
    });
  }

  async start() {
    await this.server.connect();
    console.error('MCP Server running on stdio');
  }
}

// Start server
const server = new MyMCPServer();
server.start().catch(console.error);
```

### Best Practices

#### 1. Resource Design
- Use clear, hierarchical URIs (`data://database/users/123`)
- Provide comprehensive descriptions
- Include proper MIME types
- Implement pagination for large datasets

#### 2. Tool Design
- Clear, action-oriented names (`create_user`, not `user`)
- Comprehensive input schemas with validation
- Detailed descriptions with examples
- Idempotent operations where possible

#### 3. Error Handling
```javascript
// Proper error responses
if (!resource) {
  throw new Error(JSON.stringify({
    code: 'RESOURCE_NOT_FOUND',
    message: `Resource ${uri} not found`,
    details: { uri, availableResources }
  }));
}
```

#### 4. Security
- Implement authentication (API keys, OAuth)
- Validate all inputs against schemas
- Rate limiting and quota management
- Audit logging for sensitive operations

## Common MCP Patterns

### 1. Database Integration
```javascript
// PostgreSQL MCP Server
class PostgresMCPServer {
  async queryDatabase(sql, params) {
    // Validate SQL for safety
    if (!this.isSafeQuery(sql)) {
      throw new Error('Unsafe SQL query');
    }
    
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => f.name)
    };
  }
}
```

### 2. File System Access
```javascript
// File System MCP Server
class FileSystemMCPServer {
  async readFile(path) {
    // Validate path is within allowed directory
    if (!this.isAllowedPath(path)) {
      throw new Error('Access denied');
    }
    
    const content = await fs.readFile(path, 'utf-8');
    return {
      path,
      content,
      metadata: await fs.stat(path)
    };
  }
}
```

### 3. API Gateway
```javascript
// API Gateway MCP Server
class APIGatewayMCPServer {
  async callAPI(service, method, params) {
    const endpoint = this.services[service];
    if (!endpoint) {
      throw new Error(`Service ${service} not found`);
    }
    
    const response = await fetch(`${endpoint}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(params)
    });
    
    return await response.json();
  }
}
```

## Testing MCP Servers

### Local Testing
```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector ./my-mcp-server.js

# Test with Claude Code
# Add to config and restart Claude Code
```

### Integration Testing
```javascript
// test-mcp-server.js
const { spawn } = require('child_process');

async function testMCPServer() {
  const server = spawn('node', ['./mcp-server.js']);
  
  // Send test requests
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'resources/list',
    id: 1
  }) + '\n');
  
  // Verify responses
  server.stdout.on('data', (data) => {
    const response = JSON.parse(data);
    console.log('Response:', response);
  });
}
```

## Performance Optimization

### 1. Caching Strategy
```javascript
class CachedMCPServer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }
  
  async getResource(uri) {
    const cached = this.cache.get(uri);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    const data = await this.fetchResource(uri);
    this.cache.set(uri, {
      data,
      expires: Date.now() + this.cacheTimeout
    });
    
    return data;
  }
}
```

### 2. Connection Pooling
```javascript
class PooledMCPServer {
  constructor() {
    this.pool = new Pool({
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000
    });
  }
}
```

### 3. Stream Processing
```javascript
async function* streamLargeDataset() {
  const pageSize = 100;
  let offset = 0;
  
  while (true) {
    const batch = await fetchBatch(offset, pageSize);
    if (batch.length === 0) break;
    
    yield batch;
    offset += pageSize;
  }
}
```

## Deployment Strategies

### 1. Docker Container
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["node", "mcp-server.js"]
```

### 2. Serverless Functions
```javascript
// AWS Lambda MCP Handler
exports.handler = async (event) => {
  const { method, params } = JSON.parse(event.body);
  
  switch(method) {
    case 'resources/list':
      return await listResources();
    case 'tools/call':
      return await executeTool(params);
    default:
      throw new Error('Method not found');
  }
};
```

### 3. Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: mcp-server:latest
        ports:
        - containerPort: 8080
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check server is running and accessible
   - Verify authentication credentials
   - Check network/firewall settings

2. **Schema Validation Errors**
   - Ensure request matches expected schema
   - Validate JSON syntax
   - Check required vs optional fields

3. **Performance Issues**
   - Implement caching for frequently accessed data
   - Use pagination for large datasets
   - Consider async/streaming responses

4. **Security Concerns**
   - Always validate and sanitize inputs
   - Implement proper authentication
   - Use HTTPS for transport security
   - Regular security audits

## Claude Code MCP Integration

### Installation Commands

Claude Code provides multiple transport methods for MCP servers:

#### 1. Local stdio servers
```bash
# Basic syntax
claude mcp add <name> <command> [args...]

# Example: Airtable with API key
claude mcp add airtable --env AIRTABLE_API_KEY=YOUR_KEY \
  -- npx -y airtable-mcp-server

# Windows users: Use cmd wrapper
claude mcp add my-server -- cmd /c npx -y @some/package
```

#### 2. Remote SSE servers
```bash
# Basic syntax
claude mcp add --transport sse <name> <url>

# Example: Linear integration
claude mcp add --transport sse linear https://mcp.linear.app/sse

# With authentication
claude mcp add --transport sse private-api https://api.company.com/mcp \
  --header "X-API-Key: your-key-here"
```

#### 3. Remote HTTP servers
```bash
# Basic syntax
claude mcp add --transport http <name> <url>

# Example: Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# With Bearer token
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

### Management Commands
```bash
# List all configured servers
claude mcp list

# Get details for a specific server
claude mcp get github

# Remove a server
claude mcp remove github

# Check server status (within Claude Code)
/mcp

# Import from Claude Desktop
claude mcp add-from-claude-desktop

# Add from JSON config
claude mcp add-json weather-api '{"type":"stdio","command":"/path/to/weather-cli"}'
```

### Installation Scopes

#### Local Scope (Default)
```bash
# Private to you, current project only
claude mcp add my-private-server /path/to/server
```

#### Project Scope
```bash
# Shared via .mcp.json in version control
claude mcp add shared-server --scope project /path/to/server
```

#### User Scope
```bash
# Available across all your projects
claude mcp add my-user-server --scope user /path/to/server
```

### Popular MCP Server Integrations

#### Development & Testing
- **Sentry**: `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`
- **Socket**: `claude mcp add --transport http socket https://mcp.socket.dev/`

#### Project Management
- **Linear**: `claude mcp add --transport sse linear https://mcp.linear.app/sse`
- **Asana**: `claude mcp add --transport sse asana https://mcp.asana.com/sse`
- **Atlassian**: `claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse`
- **Notion**: `claude mcp add --transport http notion https://mcp.notion.com/mcp`
- **ClickUp**: `claude mcp add clickup --env CLICKUP_API_KEY=KEY --env CLICKUP_TEAM_ID=ID -- npx -y @hauptsache.net/clickup-mcp`

#### Payments & Commerce
- **Stripe**: `claude mcp add --transport http stripe https://mcp.stripe.com`
- **Square**: `claude mcp add --transport sse square https://mcp.squareup.com/sse`
- **PayPal**: `claude mcp add --transport sse paypal https://mcp.paypal.com/sse`
- **Plaid**: `claude mcp add --transport sse plaid https://api.dashboard.plaid.com/mcp/sse`

#### Design & Media
- **Figma**: `claude mcp add --transport sse figma http://127.0.0.1:3845/sse` (requires Figma Desktop)
- **invideo**: `claude mcp add --transport sse invideo https://mcp.invideo.io/sse`

#### Infrastructure
- **Cloudflare**: Multiple services available (see Cloudflare docs)

#### Automation
- **Zapier**: Generate user-specific URL at mcp.zapier.com
- **Workato**: Programmatically generated servers

### OAuth Authentication

For servers requiring OAuth:
```bash
# 1. Add the server
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 2. Within Claude Code, authenticate
> /mcp
# Follow browser authentication flow
```

### Project Configuration (.mcp.json)

Shared project configuration with environment variable expansion:

```json
{
  "mcpServers": {
    "api-server": {
      "type": "sse",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    },
    "database": {
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL:-postgresql://localhost:5432/mydb}"
      }
    }
  }
}
```

### Using MCP Resources

Reference MCP resources with @ mentions:
```
> Analyze @github:issue://123 and suggest a fix
> Compare @postgres:schema://users with @docs:file://database/user-model
```

### Using MCP Prompts as Slash Commands

MCP prompts become slash commands:
```
> /mcp__github__list_prs
> /mcp__github__pr_review 456
> /mcp__jira__create_issue "Bug in login flow" high
```

### Claude Code as MCP Server

Expose Claude Code's tools to other applications:

```bash
# Start Claude as MCP server
claude mcp serve
```

Claude Desktop configuration:
```json
{
  "mcpServers": {
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

### Practical Examples

#### Monitor errors with Sentry
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
# Use /mcp to authenticate
# Then: "What are the most common errors in the last 24 hours?"
```

#### Connect to databases
```bash
claude mcp add db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
# Then: "What's our total revenue this month?"
```

#### Implement features from issue trackers
```bash
claude mcp add --transport sse linear https://mcp.linear.app/sse
# Then: "Add the feature described in JIRA issue ENG-4521 and create a PR"
```

### Troubleshooting Claude Code MCP

#### Windows Issues
- Use `cmd /c` wrapper for npx commands
- WSL recommended for better compatibility

#### Connection Issues
- Check MCP_TIMEOUT environment variable
- Verify authentication tokens
- Use `/mcp` to check server status

#### Scope Conflicts
- Local scope overrides project scope
- Project scope overrides user scope
- Use `claude mcp reset-project-choices` to reset approvals

## Resources & Documentation

- **Official MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **MCP SDK**: [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **Example Servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- **Claude Code MCP Guide**: [docs.anthropic.com/en/docs/claude-code/mcp](https://docs.anthropic.com/en/docs/claude-code/mcp)
- **Community Resources**: MCP Discord, GitHub Discussions

This specialist agent provides comprehensive expertise in MCP implementation, from basic server creation to advanced deployment strategies, with specific focus on Claude Code integration and real-world usage patterns.