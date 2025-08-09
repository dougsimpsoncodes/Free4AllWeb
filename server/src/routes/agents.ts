/**
 * Agent Management API Routes
 * Provides REST endpoints for agent orchestration and monitoring
 */

import express from 'express';
import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';

const router = express.Router();
const orchestrator = new AgentOrchestrator();

// Initialize MCP connections on startup
orchestrator.initializeMCPConnections();
orchestrator.startContinuousMonitoring();

/**
 * GET /api/agents/status
 * Get comprehensive system status
 */
router.get('/status', async (req, res) => {
  try {
    const status = orchestrator.getSystemStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/agents/workflows
 * Get all active workflows
 */
router.get('/workflows', async (req, res) => {
  try {
    const workflows = orchestrator.getActiveWorkflows();
    res.json({
      success: true,
      data: workflows,
      count: workflows.length,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/agents/workflows/:id
 * Get specific workflow by ID
 */
router.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = orchestrator.getWorkflow(id);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        workflowId: id,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: workflow,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/agents/workflows/game-trigger
 * Trigger game-based workflow
 */
router.post('/workflows/game-trigger', async (req, res) => {
  try {
    const { gameId, teamId, eventType, score } = req.body;

    if (!gameId || !teamId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: gameId, teamId, eventType',
        timestamp: new Date()
      });
    }

    const gameEvent = {
      gameId,
      teamId,
      eventType,
      score,
      timestamp: new Date()
    };

    console.log('🏀 Triggering game workflow:', gameEvent);
    
    const result = await orchestrator.executeGameTriggeredWorkflow(gameEvent);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date()
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/agents/workflows/manual-discovery
 * Manually trigger deal discovery
 */
router.post('/workflows/manual-discovery', async (req, res) => {
  try {
    const { location = 'Los Angeles', categories = ['restaurants', 'food'] } = req.body;
    
    const discoverWorkflow = {
      workflowId: `manual-discovery-${Date.now()}`,
      triggerEvent: { type: 'manual', location, categories, timestamp: new Date() },
      steps: [
        {
          agentId: 'deal-discovery',
          action: 'manual_deal_search',
          mcpOperations: [
            { 
              server: 'reddit', 
              operation: 'search_posts', 
              params: { 
                subreddits: ['deals', 'LosAngeles', 'food'],
                keywords: ['restaurant', 'food', 'delivery', 'discount'],
                location,
                limit: 100
              } 
            },
            { 
              server: 'playwright', 
              operation: 'scrape_deals', 
              params: { 
                sites: [
                  { url: 'groupon.com', categories },
                  { url: 'yelp.com', categories }
                ],
                location
              } 
            },
            { 
              server: 'postgres', 
              operation: 'insert', 
              params: { 
                table: 'discovered_deals', 
                data: {
                  source_type: 'manual_discovery',
                  location,
                  categories: categories.join(','),
                  discovered_at: new Date()
                }
              } 
            }
          ]
        },
        {
          agentId: 'admin-workflow',
          action: 'queue_manual_discoveries',
          mcpOperations: [
            { 
              server: 'slack', 
              operation: 'send_message', 
              params: { 
                channel: '#deal-discovery', 
                message: `🔍 Manual deal discovery completed for ${location}. Found potential deals in categories: ${categories.join(', ')}`
              } 
            }
          ]
        }
      ],
      status: 'pending' as const,
      startTime: new Date(),
      results: {}
    };

    // For demonstration, we'll simulate this workflow execution
    console.log('🔍 Starting manual discovery workflow:', discoverWorkflow);
    
    res.json({
      success: true,
      data: {
        workflowId: discoverWorkflow.workflowId,
        message: 'Manual discovery workflow started',
        estimatedCompletion: '2-3 minutes'
      },
      timestamp: new Date()
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date()
    });
  }
});


/**
 * GET /api/agents/health
 * Health check endpoint for agent system
 */
router.get('/health', async (req, res) => {
  try {
    const status = orchestrator.getSystemStatus();
    const isHealthy = status.mcpServersConnected > 0 && status.totalAgents > 0;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      agents: {
        total: status.totalAgents,
        active: status.totalAgents
      },
      mcpServers: {
        connected: status.mcpServersConnected,
        expected: 6 // filesystem, postgres, reddit, playwright, sms, slack
      },
      workflows: {
        active: status.activeWorkflows
      },
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * WebSocket events setup for real-time monitoring
 */
const setupWebSocketEvents = (io: any) => {
  // Listen for workflow events and broadcast to connected clients
  orchestrator.on('workflowStarted', (data) => {
    io.emit('workflow:started', data);
    console.log('📡 Broadcasting workflow started:', data.workflowId);
  });

  orchestrator.on('workflowCompleted', (data) => {
    io.emit('workflow:completed', data);
    console.log('📡 Broadcasting workflow completed:', data.workflowId);
  });

  orchestrator.on('workflowFailed', (data) => {
    io.emit('workflow:failed', data);
    console.log('📡 Broadcasting workflow failed:', data.workflowId);
  });

  orchestrator.on('stepStarted', (data) => {
    io.emit('workflow:step:started', data);
  });

  orchestrator.on('stepCompleted', (data) => {
    io.emit('workflow:step:completed', data);
  });

  orchestrator.on('mcpOperationCompleted', (data) => {
    io.emit('mcp:operation:completed', data);
  });

  orchestrator.on('mcpOperationFailed', (data) => {
    io.emit('mcp:operation:failed', data);
  });

  orchestrator.on('mcpServerConnected', (data) => {
    io.emit('mcp:server:connected', data);
  });

  orchestrator.on('monitoringError', (data) => {
    io.emit('monitoring:error', data);
    console.error('📡 Broadcasting monitoring error:', data);
  });
};

// Export both router and WebSocket setup function
export { router as agentsRouter, setupWebSocketEvents, orchestrator };
export default router;