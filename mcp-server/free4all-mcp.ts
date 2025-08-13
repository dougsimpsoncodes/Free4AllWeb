#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Create the MCP server
const server = new Server(
  {
    name: "free4all-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "search_deals",
    description: "Search for restaurant deals based on team and criteria",
    inputSchema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          description: "Team name (e.g., 'Los Angeles Dodgers')"
        },
        restaurant: {
          type: "string",
          description: "Restaurant name (optional)"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to search for"
        }
      },
      required: ["team"]
    }
  },
  {
    name: "check_game_status",
    description: "Check the status of today's games for a team",
    inputSchema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          description: "Team name to check"
        }
      },
      required: ["team"]
    }
  },
  {
    name: "verify_deal",
    description: "Verify if a deal URL is still active",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL of the deal to verify"
        },
        expectedContent: {
          type: "string",
          description: "Expected content to find on the page"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "extract_deal_info",
    description: "Extract structured deal information from a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to extract deal information from"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "send_notification",
    description: "Send a notification about a deal",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID to send notification to"
        },
        dealTitle: {
          type: "string",
          description: "Title of the deal"
        },
        dealDetails: {
          type: "string",
          description: "Details about the deal"
        },
        promoCode: {
          type: "string",
          description: "Promo code if applicable"
        }
      },
      required: ["userId", "dealTitle", "dealDetails"]
    }
  },
  {
    name: "get_active_promotions",
    description: "Get all active promotions from the database",
    inputSchema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          description: "Filter by team (optional)"
        }
      }
    }
  }
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_deals": {
      const { team, restaurant, keywords } = args as any;
      
      // Search logic here - this is a simplified example
      const searchTerms = [team, restaurant, ...(keywords || [])].filter(Boolean).join(' ');
      
      // Search in database
      const { data, error } = await supabase
        .from('discoveredSites')
        .select('*')
        .ilike('content', `%${searchTerms}%`)
        .order('confidence', { ascending: false })
        .limit(10);
      
      if (error) {
        throw new Error(`Database search failed: ${error.message}`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              results: data || [],
              searchTerms
            }, null, 2)
          }
        ]
      };
    }

    case "check_game_status": {
      const { team } = args as any;
      
      // Simplified MLB API call
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?date=${today}&teamId=119&sportId=1`
      );
      
      const data = await response.json() as any;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              date: today,
              games: data.dates?.[0]?.games || [],
              team
            }, null, 2)
          }
        ]
      };
    }

    case "verify_deal": {
      const { url, expectedContent } = args as any;
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        const isActive = expectedContent ? html.includes(expectedContent) : response.ok;
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                url,
                active: isActive,
                statusCode: response.status
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                url,
                error: error.message
              }, null, 2)
            }
          ]
        };
      }
    }

    case "extract_deal_info": {
      const { url } = args as any;
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Simple extraction logic - would be more sophisticated in production
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1] : '';
        
        // Look for common deal patterns
        const dealPatterns = {
          restaurant: /(McDonald's|Panda Express|Jack in the Box|ampm|Subway)/gi,
          trigger: /(win|score|home run|strikeout|hit)/gi,
          discount: /(free|50% off|discount|BOGO|half price)/gi,
          promoCode: /code:?\s*([A-Z0-9]+)/gi
        };
        
        const extractedInfo = {
          title,
          url,
          restaurants: [...new Set(html.match(dealPatterns.restaurant) || [])],
          triggers: [...new Set(html.match(dealPatterns.trigger) || [])],
          discounts: [...new Set(html.match(dealPatterns.discount) || [])],
          promoCodes: [...html.matchAll(dealPatterns.promoCode)].map(m => m[1])
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                extractedInfo
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                url,
                error: error.message
              }, null, 2)
            }
          ]
        };
      }
    }

    case "send_notification": {
      const { userId, dealTitle, dealDetails, promoCode } = args as any;
      
      // Store notification in database
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: dealTitle,
          message: dealDetails,
          promo_code: promoCode,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        throw new Error(`Failed to send notification: ${error.message}`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              notification: {
                userId,
                dealTitle,
                dealDetails,
                promoCode,
                sent: true
              }
            }, null, 2)
          }
        ]
      };
    }

    case "get_active_promotions": {
      const { team } = args as any;
      
      let query = supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true);
      
      if (team) {
        query = query.eq('team', team);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to fetch promotions: ${error.message}`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              promotions: data || [],
              count: data?.length || 0
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Free4AllWeb MCP Server running...");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});