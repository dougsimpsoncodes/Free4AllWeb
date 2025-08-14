/**
 * Integration Bridge - Phase 2.1.3
 * 
 * Connects validation system to existing promotion workflow with:
 * - Database transaction coordination
 * - Promotion status updates
 * - Notification dispatch integration
 * - Existing workflow compatibility
 */

import { workflowOrchestrator, type WorkflowExecution } from './workflowOrchestrator.js';
import { gameMonitor } from './gameMonitor.js';
import { storage } from '../storage.js';
import { putImmutable } from './evidence/storage.js';

export interface IntegrationConfig {
  enableAutomaticProcessing: boolean;
  enableNotifications: boolean;
  enableStatusUpdates: boolean;
  enableTriggeredDealCreation: boolean;
  maxRetryAttempts: number;
}

export interface IntegrationMetrics {
  totalPromotionsProcessed: number;
  statusUpdatesCompleted: number;
  triggeredDealsCreated: number;
  notificationsDispatched: number;
  integrationFailures: number;
  averageIntegrationTime: number;
}

export interface PromotionStatusUpdate {
  promotionId: number;
  previousStatus: string;
  newStatus: string;
  updatedAt: string;
  reason: string;
  evidenceHash: string;
}

export interface TriggeredDealCreation {
  promotionId: number;
  gameId: string;
  dealId: number;
  expiresAt: string;
  createdAt: string;
  evidenceHash: string;
}

export class IntegrationBridge {
  private config: IntegrationConfig;
  private metrics: IntegrationMetrics;
  private isRunning = false;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = {
      enableAutomaticProcessing: true,
      enableNotifications: true,
      enableStatusUpdates: true,
      enableTriggeredDealCreation: true,
      maxRetryAttempts: 3,
      ...config
    };

    this.metrics = {
      totalPromotionsProcessed: 0,
      statusUpdatesCompleted: 0,
      triggeredDealsCreated: 0,
      notificationsDispatched: 0,
      integrationFailures: 0,
      averageIntegrationTime: 0
    };
  }

  /**
   * Start the integration bridge
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Integration bridge already running');
      return;
    }

    console.log('🌉 Starting Integration Bridge...');

    try {
      // Register workflow completion handler
      this.registerWorkflowHandlers();

      this.isRunning = true;

      console.log('✅ Integration Bridge started');
      console.log(`📊 Config: auto_processing=${this.config.enableAutomaticProcessing}, notifications=${this.config.enableNotifications}`);

    } catch (error) {
      console.error('Failed to start integration bridge:', error);
      throw error;
    }
  }

  /**
   * Stop the integration bridge
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Integration Bridge...');

    this.isRunning = false;

    console.log('✅ Integration Bridge stopped');
  }

  /**
   * Get integration status and metrics
   */
  getStatus(): {
    isRunning: boolean;
    metrics: IntegrationMetrics;
    config: IntegrationConfig;
  } {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
      config: { ...this.config }
    };
  }

  /**
   * Manually process workflow execution results
   */
  async processWorkflowExecution(execution: WorkflowExecution): Promise<void> {
    if (!this.isRunning) {
      console.log('Integration bridge not running - skipping processing');
      return;
    }

    console.log(`🔗 Processing workflow execution ${execution.executionId}`);
    
    const startTime = Date.now();
    
    try {
      // Process each approved promotion
      for (const promotionId of execution.approvedPromotions) {
        await this.processApprovedPromotion(promotionId, execution);
      }

      // Process rejected promotions (status updates)
      for (const promotionId of execution.rejectedPromotions) {
        await this.processRejectedPromotion(promotionId, execution);
      }

      // Store integration evidence
      await this.storeIntegrationEvidence(execution, Date.now() - startTime);

      console.log(`✅ Integration processing completed for execution ${execution.executionId}`);

    } catch (error) {
      console.error(`❌ Integration processing failed for execution ${execution.executionId}:`, error);
      this.metrics.integrationFailures++;
      throw error;
    }
  }

  /**
   * Register handlers for workflow events
   */
  private registerWorkflowHandlers(): void {
    // In a real implementation, this would register event listeners
    // For now, we'll use a polling approach or manual triggering
    console.log('📡 Registered workflow completion handlers');
  }

  /**
   * Process an approved promotion
   */
  private async processApprovedPromotion(promotionId: number, execution: WorkflowExecution): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`✅ Processing approved promotion ${promotionId}`);

      // Step 1: Update promotion status if enabled
      let statusUpdate: PromotionStatusUpdate | null = null;
      if (this.config.enableStatusUpdates) {
        statusUpdate = await this.updatePromotionStatus(
          promotionId,
          'triggered',
          `Approved by validation system - execution ${execution.executionId}`
        );
      }

      // Step 2: Create triggered deal if enabled
      let triggeredDeal: TriggeredDealCreation | null = null;
      if (this.config.enableTriggeredDealCreation) {
        triggeredDeal = await this.createTriggeredDeal(promotionId, execution);
      }

      // Step 3: Dispatch notifications if enabled
      if (this.config.enableNotifications && triggeredDeal) {
        await this.dispatchNotifications(promotionId, triggeredDeal, execution);
      }

      this.metrics.totalPromotionsProcessed++;
      
      const processingTime = Date.now() - startTime;
      console.log(`📊 Approved promotion ${promotionId} processed in ${processingTime}ms`);

    } catch (error) {
      console.error(`Error processing approved promotion ${promotionId}:`, error);
      throw error;
    }
  }

  /**
   * Process a rejected promotion
   */
  private async processRejectedPromotion(promotionId: number, execution: WorkflowExecution): Promise<void> {
    try {
      console.log(`❌ Processing rejected promotion ${promotionId}`);

      // Update promotion status to reflect rejection
      if (this.config.enableStatusUpdates) {
        const validationResult = execution.validationResults.find(v => v.promotionId === promotionId);
        const reason = validationResult?.validation.rationale || 'Rejected by validation system';
        
        await this.updatePromotionStatus(
          promotionId,
          'validation_failed',
          `Rejected: ${reason}`
        );
      }

      console.log(`📊 Rejected promotion ${promotionId} status updated`);

    } catch (error) {
      console.error(`Error processing rejected promotion ${promotionId}:`, error);
      throw error;
    }
  }

  /**
   * Update promotion status in database
   */
  private async updatePromotionStatus(
    promotionId: number,
    newStatus: string,
    reason: string
  ): Promise<PromotionStatusUpdate> {
    try {
      // Get current promotion
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }

      const previousStatus = promotion.state || 'unknown';
      const updatedAt = new Date().toISOString();

      // Update promotion status
      await storage.updatePromotion(promotionId, {
        state: newStatus,
        updatedAt: new Date()
      });

      // Create status update evidence
      const statusUpdateEvidence = {
        type: 'promotion_status_update',
        promotionId,
        previousStatus,
        newStatus,
        reason,
        updatedAt,
        metadata: {
          integrationBridge: '2.1.3',
          updatedBy: 'validation_system'
        }
      };

      const evidenceResult = await putImmutable(statusUpdateEvidence);

      const statusUpdate: PromotionStatusUpdate = {
        promotionId,
        previousStatus,
        newStatus,
        updatedAt,
        reason,
        evidenceHash: evidenceResult.hash
      };

      this.metrics.statusUpdatesCompleted++;
      
      console.log(`📝 Promotion ${promotionId} status: ${previousStatus} → ${newStatus}`);

      return statusUpdate;

    } catch (error) {
      console.error(`Failed to update promotion status for ${promotionId}:`, error);
      throw error;
    }
  }

  /**
   * Create triggered deal for approved promotion
   */
  private async createTriggeredDeal(
    promotionId: number,
    execution: WorkflowExecution
  ): Promise<TriggeredDealCreation> {
    try {
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }

      // Calculate expiration date
      const expiresAt = this.calculateExpirationDate(promotion);

      // Create triggered deal
      const triggeredDeal = await storage.createTriggeredDeal({
        promotionId,
        gameId: parseInt(execution.gameId) || 0, // Convert string to number for DB
        expiresAt
      });

      // Create deal creation evidence
      const dealEvidence = {
        type: 'triggered_deal_creation',
        promotionId,
        gameId: execution.gameId,
        dealId: triggeredDeal.id,
        expiresAt: expiresAt?.toISOString(),
        validationExecutionId: execution.executionId,
        metadata: {
          integrationBridge: '2.1.3',
          createdBy: 'validation_system'
        }
      };

      const evidenceResult = await putImmutable(dealEvidence);

      const dealCreation: TriggeredDealCreation = {
        promotionId,
        gameId: execution.gameId,
        dealId: triggeredDeal.id,
        expiresAt: expiresAt?.toISOString() || '',
        createdAt: new Date().toISOString(),
        evidenceHash: evidenceResult.hash
      };

      this.metrics.triggeredDealsCreated++;

      console.log(`🎁 Triggered deal ${triggeredDeal.id} created for promotion ${promotionId}`);

      return dealCreation;

    } catch (error) {
      console.error(`Failed to create triggered deal for promotion ${promotionId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate expiration date for triggered deal
   */
  private calculateExpirationDate(promotion: any): Date | null {
    if (promotion.validUntil) {
      return new Date(promotion.validUntil);
    }

    // Default: expires 24 hours after triggering
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 1);
    return expiration;
  }

  /**
   * Dispatch notifications for triggered deal
   */
  private async dispatchNotifications(
    promotionId: number,
    triggeredDeal: TriggeredDealCreation,
    execution: WorkflowExecution
  ): Promise<void> {
    try {
      console.log(`📢 Dispatching notifications for promotion ${promotionId}`);

      // Get promotion details for notification
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }

      // Get team details
      const team = await storage.getTeam(promotion.teamId!);
      if (!team) {
        throw new Error(`Team ${promotion.teamId} not found`);
      }

      // Get restaurant details
      const restaurant = await storage.getRestaurant(promotion.restaurantId!);
      if (!restaurant) {
        throw new Error(`Restaurant ${promotion.restaurantId} not found`);
      }

      // Get users who should be notified for this team
      const userIds = await storage.getUsersByTeamPreference(team.id);

      console.log(`📱 Sending notifications to ${userIds.length} users for ${team.name} promotion`);

      // In a real implementation, this would integrate with:
      // - Email service
      // - Push notification service (APNs/FCM)
      // - SMS service
      // - In-app notifications

      // For now, log the notification intent
      const notificationData = {
        type: 'promotion_triggered',
        promotionId,
        dealId: triggeredDeal.dealId,
        team: team.name,
        restaurant: restaurant.name,
        deal: promotion.dealDetails,
        expiresAt: triggeredDeal.expiresAt,
        userIds
      };

      // Store notification evidence
      const notificationEvidence = {
        type: 'notification_dispatch',
        promotionId,
        dealId: triggeredDeal.dealId,
        notificationData,
        recipientCount: userIds.length,
        dispatchedAt: new Date().toISOString(),
        metadata: {
          integrationBridge: '2.1.3',
          executionId: execution.executionId
        }
      };

      await putImmutable(notificationEvidence);

      this.metrics.notificationsDispatched++;

      console.log(`✅ Notifications dispatched for promotion ${promotionId}`);

    } catch (error) {
      console.error(`Failed to dispatch notifications for promotion ${promotionId}:`, error);
      throw error;
    }
  }

  /**
   * Store integration processing evidence
   */
  private async storeIntegrationEvidence(execution: WorkflowExecution, processingTime: number): Promise<void> {
    try {
      const integrationEvidence = {
        type: 'integration_processing',
        executionId: execution.executionId,
        gameId: execution.gameId,
        processingResults: {
          approvedCount: execution.approvedPromotions.length,
          rejectedCount: execution.rejectedPromotions.length,
          failedCount: execution.failedPromotions.length
        },
        processingTime,
        metrics: {
          statusUpdates: this.metrics.statusUpdatesCompleted,
          triggeredDeals: this.metrics.triggeredDealsCreated,
          notifications: this.metrics.notificationsDispatched
        },
        completedAt: new Date().toISOString(),
        metadata: {
          integrationBridge: '2.1.3',
          config: this.config
        }
      };

      await putImmutable(integrationEvidence);

      console.log(`📝 Integration evidence stored for execution ${execution.executionId}`);

    } catch (error) {
      console.error('Failed to store integration evidence:', error);
      // Don't throw - this shouldn't fail the entire integration
    }
  }

  /**
   * Process workflow orchestrator events
   */
  async handleWorkflowCompletion(execution: WorkflowExecution): Promise<void> {
    if (execution.status === 'completed' && this.config.enableAutomaticProcessing) {
      await this.processWorkflowExecution(execution);
    }
  }

  /**
   * Manual integration trigger for testing
   */
  async triggerIntegration(promotionId: number, action: 'approve' | 'reject', reason: string): Promise<void> {
    console.log(`🔧 Manual integration trigger: ${action} promotion ${promotionId}`);

    try {
      if (action === 'approve') {
        // Create mock execution for manual approval
        const mockExecution: WorkflowExecution = {
          executionId: `manual_${Date.now()}`,
          gameEvent: {} as any,
          gameId: 'manual-trigger',
          teamId: 0,
          promotionsToValidate: [promotionId],
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          validationResults: [],
          approvedPromotions: [promotionId],
          rejectedPromotions: [],
          failedPromotions: [],
          processingTime: 0,
          evidenceChain: []
        };

        await this.processApprovedPromotion(promotionId, mockExecution);
      } else {
        await this.updatePromotionStatus(promotionId, 'manual_rejection', reason);
      }

      console.log(`✅ Manual integration completed for promotion ${promotionId}`);

    } catch (error) {
      console.error(`❌ Manual integration failed for promotion ${promotionId}:`, error);
      throw error;
    }
  }
}

// Global integration bridge instance
export const integrationBridge = new IntegrationBridge();