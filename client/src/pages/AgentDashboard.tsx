/**
 * Agent Dashboard - Real-time monitoring of the agent consultancy system
 * Displays agent status, workflow progress, and MCP server health
 */

import { useState, useEffect } from 'react';

interface AgentStatus {
  agentId: string;
  status: string;
  mcpServers: Array<{ serverId: string; status: string; health: string }>;
  capabilities: string[];
  priority: string;
  dependencies: string[];
}

interface WorkflowExecution {
  workflowId: string;
  triggerEvent: any;
  status: string;
  startTime: string;
  endTime?: string;
  results: Record<string, any>;
  error?: string;
}

interface SystemStatus {
  totalAgents: number;
  activeWorkflows: number;
  mcpServersConnected: number;
  agentStatuses: AgentStatus[];
  lastUpdate: string;
}

const AgentDashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);
  // const [socket, setSocket] = useState<Socket | null>(null); // Disabled for now
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/agents/status');
      const result = await response.json();
      
      if (result.success) {
        setSystemStatus(result.data);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(`Failed to fetch system status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/agents/workflows');
      const result = await response.json();
      
      if (result.success) {
        setWorkflows(result.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch workflows:', err);
    }
  };

  useEffect(() => {
    // Initial data fetch
    fetchSystemStatus();
    fetchWorkflows();

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchSystemStatus();
      fetchWorkflows();
    }, 30000); // Refresh every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const addRealtimeEvent = (type: string, data: any) => {
    const event = {
      id: Date.now(),
      type,
      data,
      timestamp: new Date()
    };
    
    setRealtimeEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events
  };

  const triggerGameWorkflow = async () => {
    try {
      const response = await fetch('/api/agents/workflows/game-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gameId: 'game_' + Date.now(),
          teamId: 'dodgers',
          eventType: 'win',
          score: { home: 8, away: 3 }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        addRealtimeEvent('manual_trigger', { 
          message: 'Game workflow triggered manually',
          workflowId: result.data.workflowId
        });
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(`Failed to trigger workflow: ${err.message}`);
    }
  };

  const triggerManualDiscovery = async () => {
    try {
      const response = await fetch('/api/agents/workflows/manual-discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          location: 'Los Angeles',
          categories: ['restaurants', 'food', 'pizza']
        })
      });

      const result = await response.json();
      
      if (result.success) {
        addRealtimeEvent('manual_discovery', { 
          message: 'Manual discovery triggered',
          workflowId: result.data.workflowId
        });
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(`Failed to trigger discovery: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'connected':
      case 'healthy':
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
      case 'disconnected':
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventType = (type: string) => {
    switch (type) {
      case 'workflow_started':
        return '🚀 Workflow Started';
      case 'workflow_completed':
        return '✅ Workflow Completed';
      case 'workflow_failed':
        return '❌ Workflow Failed';
      case 'step_completed':
        return '📋 Step Completed';
      case 'mcp_operation':
        return '🔌 MCP Operation';
      case 'mcp_connected':
        return '🔗 MCP Connected';
      case 'monitoring_error':
        return '⚠️ Monitoring Error';
      case 'manual_trigger':
        return '👆 Manual Trigger';
      case 'manual_discovery':
        return '🔍 Manual Discovery';
      default:
        return '📝 Event';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agent Consultancy Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time monitoring of the Free4AllWeb agent orchestration system</p>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* System Overview */}
        {systemStatus && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{systemStatus.totalAgents}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Agents</p>
                  <p className="text-2xl font-semibold text-gray-900">{systemStatus.totalAgents}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{systemStatus.mcpServersConnected}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">MCP Servers</p>
                  <p className="text-2xl font-semibold text-gray-900">{systemStatus.mcpServersConnected}/6</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{systemStatus.activeWorkflows}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Workflows</p>
                  <p className="text-2xl font-semibold text-gray-900">{systemStatus.activeWorkflows}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">📊</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">System Health</p>
                  <p className={`text-2xl font-semibold ${getStatusColor('healthy')}`}>Healthy</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Controls</h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={triggerGameWorkflow}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                🏀 Trigger Game Workflow
              </button>
              <button
                onClick={triggerManualDiscovery}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                🔍 Manual Deal Discovery
              </button>
              <button
                onClick={fetchSystemStatus}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                🔄 Refresh Status
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Agent Status */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Agent Status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {systemStatus?.agentStatuses.map((agent) => (
                  <div key={agent.agentId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 capitalize">
                        {agent.agentId.replace('-', ' ')}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(agent.priority)}`}>
                          {agent.priority}
                        </span>
                        <span className={`text-sm font-medium ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>MCP Servers:</strong> {agent.mcpServers.map(server => 
                        `${server.serverId} (${server.status})`
                      ).join(', ')}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <strong>Capabilities:</strong> {agent.capabilities.slice(0, 3).join(', ')}
                      {agent.capabilities.length > 3 && ` +${agent.capabilities.length - 3} more`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Events */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Real-time Events</h2>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {realtimeEvents.length > 0 ? (
                  realtimeEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <span className="text-sm">{formatEventType(event.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {event.data.message || event.data.workflowId || 'Event occurred'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center">No events yet. Events will appear here in real-time.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Workflows */}
        {workflows.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Active Workflows</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {workflows.map((workflow) => (
                  <div key={workflow.workflowId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{workflow.workflowId}</h3>
                      <span className={`text-sm font-medium ${getStatusColor(workflow.status)}`}>
                        {workflow.status}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Started:</strong> {new Date(workflow.startTime).toLocaleString()}
                      {workflow.endTime && (
                        <>
                          <br />
                          <strong>Ended:</strong> {new Date(workflow.endTime).toLocaleString()}
                        </>
                      )}
                    </div>
                    
                    {workflow.error && (
                      <div className="text-sm text-red-600 mt-2">
                        <strong>Error:</strong> {workflow.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;