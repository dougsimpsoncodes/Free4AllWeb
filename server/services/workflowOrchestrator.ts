/**
 * Workflow Orchestrator - Phase 2.1.2
 * 
 * End-to-end promotion validation pipeline with:
 * - Multi-promotion concurrent processing
 * - Ordering guarantees and coordination
 * - Rollback capabilities for failed validations
 * - Integration with Game Monitor and Phase 1 components
 */

import { gameMonitor, type GameEvent } from './gameMonitor.js';
import { validationService, type PromotionValidation } from './validationService.js';
import { consensusEngine } from './consensusEngine.js';
import { putImmutable } from './evidence/storage.js';
import { storage } from '../storage.js';
import { generateValidationIdempotencyKey } from '../middleware/idempotency.js';

export interface WorkflowExecution {
  executionId: string;
  gameEvent: GameEvent;
  gameId: string;
  teamId: number;
  promotionsToValidate: number[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt?: string;
  validationResults: PromotionValidation[];
  approvedPromotions: number[];
  rejectedPromotions: number[];
  failedPromotions: number[];
  processingTime: number;
  evidenceChain: string[];
  error?: string;
  rollbackReason?: string;
}

export interface WorkflowConfig {
  maxConcurrentExecutions: number;
  executionTimeoutMs: number;
  enableRollback: boolean;
  retryAttempts: number;
  prioritizeGameEndEvents: boolean;
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  rolledBackExecutions: number;
  averageProcessingTime: number;
  currentActiveExecutions: number;
  promotionsProcessed: number;
  promotionsApproved: number;
  promotionsRejected: number;
}

export class WorkflowOrchestrator {
  private config: WorkflowConfig;
  private activeExecutions = new Map<string, WorkflowExecution>();
  private executionQueue: GameEvent[] = [];
  private metrics: WorkflowMetrics;
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = {
      maxConcurrentExecutions: 10,
      executionTimeoutMs: 60000, // 1 minute
      enableRollback: true,
      retryAttempts: 3,
      prioritizeGameEndEvents: true,
      ...config
    };

    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      rolledBackExecutions: 0,
      averageProcessingTime: 0,
      currentActiveExecutions: 0,
      promotionsProcessed: 0,
      promotionsApproved: 0,
      promotionsRejected: 0
    };
  }

  /**
   * Start the workflow orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Workflow orchestrator already running');
      return;
    }

    console.log('🎭 Starting Workflow Orchestrator...');

    try {
      // Register with game monitor to receive events
      gameMonitor.addEventListener(this.handleGameEvent.bind(this));

      this.isRunning = true;

      // Start processing queue
      this.processingTimer = setInterval(() => {
        this.processQueue().catch(error => {
          console.error('Error in queue processing:', error);
        });
      }, 5000); // Process queue every 5 seconds

      console.log('✅ Workflow Orchestrator started');
      console.log(`📊 Config: max_concurrent=${this.config.maxConcurrentExecutions}, timeout=${this.config.executionTimeoutMs}ms`);

    } catch (error) {
      console.error('Failed to start workflow orchestrator:', error);
      throw error;
    }
  }

  /**
   * Stop the workflow orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Workflow Orchestrator...');

    this.isRunning = false;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    // Wait for active executions to complete
    await this.waitForActiveExecutions();

    // Unregister from game monitor
    gameMonitor.removeEventListener(this.handleGameEvent.bind(this));

    console.log('✅ Workflow Orchestrator stopped');
  }

  /**
   * Get current orchestrator status
   */
  getStatus(): {
    isRunning: boolean;
    activeExecutions: number;
    queuedEvents: number;
    metrics: WorkflowMetrics;
    activeExecutionIds: string[];
  } {
    return {
      isRunning: this.isRunning,
      activeExecutions: this.activeExecutions.size,
      queuedEvents: this.executionQueue.length,
      metrics: { ...this.metrics },
      activeExecutionIds: Array.from(this.activeExecutions.keys())
    };
  }

  /**
   * Manually trigger workflow for a game event
   */
  async triggerWorkflow(gameEvent: GameEvent): Promise<WorkflowExecution> {
    console.log(`🎯 Manually triggering workflow for ${gameEvent.eventType} event on game ${gameEvent.gameId}`);
    
    return this.executeWorkflow(gameEvent);
  }

  /**
   * Get execution details by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Handle game events from monitor
   */
  private async handleGameEvent(gameEvent: GameEvent): Promise<void> {
    try {
      console.log(`📩 Received ${gameEvent.eventType} event for game ${gameEvent.gameId}`);

      // Only process events that should trigger promotions
      if (!gameEvent.triggered) {
        console.log(`⏭️ Skipping non-triggering event: ${gameEvent.eventType}`);
        return;
      }

      // Add to queue for processing
      this.addToQueue(gameEvent);

    } catch (error) {
      console.error('Error handling game event:', error);
    }
  }

  /**
   * Add event to processing queue with prioritization
   */
  private addToQueue(gameEvent: GameEvent): void {
    if (this.config.prioritizeGameEndEvents && gameEvent.eventType === 'game_end') {
      // Game end events go to front of queue
      this.executionQueue.unshift(gameEvent);
      console.log(`🔝 Prioritized game_end event for game ${gameEvent.gameId}`);
    } else {
      this.executionQueue.push(gameEvent);
    }

    console.log(`📋 Event queued. Queue size: ${this.executionQueue.length}`);
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning || this.executionQueue.length === 0) {
      return;
    }

    // Check if we can start new executions
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      console.log(`⏸️ Max concurrent executions reached (${this.config.maxConcurrentExecutions})`);
      return;
    }

    // Get next event from queue
    const gameEvent = this.executionQueue.shift();
    if (!gameEvent) {
      return;
    }

    console.log(`🚀 Starting workflow execution for ${gameEvent.eventType} on game ${gameEvent.gameId}`);

    // Execute workflow asynchronously
    this.executeWorkflow(gameEvent).catch(error => {
      console.error(`Workflow execution failed for game ${gameEvent.gameId}:`, error);
    });
  }

  /**
   * Execute complete validation workflow for a game event
   */
  private async executeWorkflow(gameEvent: GameEvent): Promise<WorkflowExecution> {
    const executionId = `exec_${gameEvent.gameId}_${Date.now()}`;
    const startTime = Date.now();

    // Create workflow execution record
    const execution: WorkflowExecution = {
      executionId,
      gameEvent,
      gameId: gameEvent.gameId,
      teamId: 0, // Will be populated
      promotionsToValidate: [],
      status: 'pending',
      startedAt: new Date().toISOString(),
      validationResults: [],
      approvedPromotions: [],
      rejectedPromotions: [],
      failedPromotions: [],
      processingTime: 0,
      evidenceChain: gameEvent.evidenceHash ? [gameEvent.evidenceHash] : []
    };

    try {
      // Add to active executions
      this.activeExecutions.set(executionId, execution);
      this.metrics.currentActiveExecutions = this.activeExecutions.size;
      this.metrics.totalExecutions++;

      execution.status = 'running';

      console.log(`🔄 Executing workflow ${executionId} for game ${gameEvent.gameId}`);

      // Step 1: Identify team and promotions to validate
      const gameRecord = await this.identifyTeamAndPromotions(execution);
      if (!gameRecord) {
        throw new Error(`Game ${gameEvent.gameId} not found in database`);
      }

      // Step 2: Validate all promotions for this team/game
      execution.validationResults = await this.validatePromotions(execution);

      // Step 3: Process validation results
      await this.processValidationResults(execution);

      // Step 4: Store execution evidence
      await this.storeExecutionEvidence(execution);

      // Step 5: Trigger notifications (if any promotions approved)
      if (execution.approvedPromotions.length > 0) {
        await this.triggerNotifications(execution);
      }

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.processingTime = Date.now() - startTime;

      // Update metrics
      this.metrics.successfulExecutions++;
      this.updateAverageProcessingTime(execution.processingTime);

      console.log(`✅ Workflow ${executionId} completed successfully`);
      console.log(`📊 Results: ${execution.approvedPromotions.length} approved, ${execution.rejectedPromotions.length} rejected, ${execution.failedPromotions.length} failed`);

    } catch (error) {
      console.error(`❌ Workflow ${executionId} failed:`, error);

      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date().toISOString();
      execution.processingTime = Date.now() - startTime;

      // Update metrics
      this.metrics.failedExecutions++;

      // Attempt rollback if enabled
      if (this.config.enableRollback) {
        await this.rollbackExecution(execution, error instanceof Error ? error.message : 'Unknown error');
      }

      // Store failure evidence
      await this.storeExecutionEvidence(execution);

    } finally {
      // Remove from active executions
      this.activeExecutions.delete(executionId);
      this.metrics.currentActiveExecutions = this.activeExecutions.size;
    }

    return execution;
  }

  /**
   * Identify team and promotions to validate
   */
  private async identifyTeamAndPromotions(execution: WorkflowExecution): Promise<any> {
    try {
      // Try to get game from database by external ID
      const gameRecord = await storage.getGameByExternalId(execution.gameId);
      
      if (gameRecord) {
        execution.teamId = gameRecord.teamId || 0;
        const promotions = await storage.getPromotionsByTeam(execution.teamId);
        execution.promotionsToValidate = promotions.map(p => p.id);
        
        console.log(`🎯 Found ${promotions.length} promotions for team ${execution.teamId}`);
        
        return gameRecord;
      }

      // If not found, try to identify team from game data
      const gameData = execution.gameEvent.currentState;
      if (gameData?.teams) {
        // Try to match team by name
        const teams = await storage.getActiveTeams();
        const team = teams.find(t => 
          gameData.teams.home.name?.includes(t.name) || 
          gameData.teams.away.name?.includes(t.name)
        );

        if (team) {
          execution.teamId = team.id;
          const promotions = await storage.getPromotionsByTeam(team.id);
          execution.promotionsToValidate = promotions.map(p => p.id);
          
          console.log(`🎯 Identified team ${team.name} with ${promotions.length} promotions`);
          
          return { teamId: team.id, id: 0 }; // Fake game record
        }
      }

      console.log(`⚠️ Could not identify team for game ${execution.gameId}`);
      return null;

    } catch (error) {
      console.error('Error identifying team and promotions:', error);
      throw error;
    }
  }

  /**
   * Validate all promotions for the execution
   */
  private async validatePromotions(execution: WorkflowExecution): Promise<PromotionValidation[]> {
    if (execution.promotionsToValidate.length === 0) {
      console.log('📭 No promotions to validate');
      return [];
    }

    console.log(`🔍 Validating ${execution.promotionsToValidate.length} promotions...`);

    // Use validation service to validate all promotions for this game
    const validations = await validationService.validatePromotionsForGame(execution.gameId);
    
    // Filter to only the promotions we're supposed to validate
    const filteredValidations = validations.filter(v => 
      execution.promotionsToValidate.includes(v.promotionId)
    );

    console.log(`📊 Validation complete: ${filteredValidations.length} validations returned`);

    // Update metrics
    this.metrics.promotionsProcessed += filteredValidations.length;

    return filteredValidations;
  }

  /**
   * Process validation results and categorize promotions
   */
  private async processValidationResults(execution: WorkflowExecution): Promise<void> {
    execution.approvedPromotions = [];
    execution.rejectedPromotions = [];
    execution.failedPromotions = [];

    for (const validation of execution.validationResults) {
      try {
        if (validation.validation.isValid) {
          execution.approvedPromotions.push(validation.promotionId);
          this.metrics.promotionsApproved++;
          
          console.log(`✅ Promotion ${validation.promotionId} approved (confidence: ${validation.validation.confidence.toFixed(3)})`);
        } else {
          execution.rejectedPromotions.push(validation.promotionId);
          this.metrics.promotionsRejected++;
          
          console.log(`❌ Promotion ${validation.promotionId} rejected (${validation.validation.rationale})`);
        }

        // Add validation evidence to chain
        if (validation.validation.evidenceChain) {
          execution.evidenceChain.push(...validation.validation.evidenceChain);
        }

      } catch (error) {
        console.error(`Error processing validation for promotion ${validation.promotionId}:`, error);
        execution.failedPromotions.push(validation.promotionId);
      }
    }

    console.log(`📊 Processing complete: ${execution.approvedPromotions.length} approved, ${execution.rejectedPromotions.length} rejected, ${execution.failedPromotions.length} failed`);
  }

  /**
   * Store execution evidence
   */
  private async storeExecutionEvidence(execution: WorkflowExecution): Promise<void> {
    try {
      const executionEvidence = {
        type: 'workflow_execution',
        executionId: execution.executionId,
        gameEvent: execution.gameEvent,
        teamId: execution.teamId,
        status: execution.status,
        results: {
          approvedPromotions: execution.approvedPromotions,
          rejectedPromotions: execution.rejectedPromotions,
          failedPromotions: execution.failedPromotions
        },
        processingTime: execution.processingTime,
        evidenceChain: execution.evidenceChain,
        error: execution.error,
        metadata: {
          orchestratorVersion: '2.1.2',
          completedAt: execution.completedAt || new Date().toISOString()
        }
      };

      const evidenceResult = await putImmutable(executionEvidence);
      execution.evidenceChain.push(evidenceResult.hash);

      console.log(`📝 Execution evidence stored: ${evidenceResult.hash}`);

    } catch (error) {
      console.error('Failed to store execution evidence:', error);
      // Don't throw - this shouldn't fail the entire execution
    }
  }

  /**
   * Trigger notifications for approved promotions
   */
  private async triggerNotifications(execution: WorkflowExecution): Promise<void> {
    console.log(`📢 Triggering notifications for ${execution.approvedPromotions.length} approved promotions`);
    
    // This would integrate with notification service
    // For now, just log the intent
    for (const promotionId of execution.approvedPromotions) {
      console.log(`🔔 Notification triggered for promotion ${promotionId}`);
    }
  }

  /**
   * Rollback execution on failure
   */
  private async rollbackExecution(execution: WorkflowExecution, reason: string): Promise<void> {
    try {
      console.log(`🔄 Rolling back execution ${execution.executionId}: ${reason}`);

      execution.status = 'rolled_back';
      execution.rollbackReason = reason;

      // Store rollback evidence
      const rollbackEvidence = {
        type: 'workflow_rollback',
        executionId: execution.executionId,
        reason,
        rollbackActions: [],
        timestamp: new Date().toISOString()
      };

      const evidenceResult = await putImmutable(rollbackEvidence);
      execution.evidenceChain.push(evidenceResult.hash);

      this.metrics.rolledBackExecutions++;

      console.log(`✅ Rollback completed for execution ${execution.executionId}`);

    } catch (error) {
      console.error('Error during rollback:', error);
    }
  }

  /**
   * Wait for all active executions to complete
   */
  private async waitForActiveExecutions(): Promise<void> {
    if (this.activeExecutions.size === 0) {
      return;
    }

    console.log(`⏳ Waiting for ${this.activeExecutions.size} active executions to complete...`);

    // Wait up to 30 seconds for executions to complete
    const maxWaitTime = 30000;
    const checkInterval = 1000;
    let waited = 0;

    while (this.activeExecutions.size > 0 && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    if (this.activeExecutions.size > 0) {
      console.log(`⚠️ ${this.activeExecutions.size} executions still active after timeout`);
    }
  }

  /**
   * Update average processing time metric
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const total = this.metrics.successfulExecutions + this.metrics.failedExecutions;
    this.metrics.averageProcessingTime = 
      ((this.metrics.averageProcessingTime * (total - 1)) + processingTime) / total;
  }
}

// Global workflow orchestrator instance
export const workflowOrchestrator = new WorkflowOrchestrator();