/**
 * Validation Service - Phase 1.3
 * 
 * Integrates ConsensusEngine with existing promotion workflow
 * Provides comprehensive validation with auditable evidence trails
 */

import { consensusEngine, type ConsensusResult } from './consensusEngine.js';
import { storage } from '../storage.js';
import { putImmutable } from './evidence/storage.js';
import { generateValidationIdempotencyKey } from '../middleware/idempotency.js';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  consensus?: ConsensusResult;
  evidenceChain: string[];
  validationId: string;
  timestamp: string;
  requiresManualReview: boolean;
  rationale: string;
}

export interface PromotionValidation {
  promotionId: number;
  gameId: string;
  validation: ValidationResult;
  triggerCondition: string;
  gameData: any;
  metadata: {
    teamId: number;
    restaurantId: number;
    validatedAt: string;
    validatedBy: 'consensus_engine';
  };
}

export class ValidationService {
  
  /**
   * Validate promotion trigger with comprehensive evidence
   */
  async validatePromotionTrigger(
    promotionId: number, 
    gameId: string,
    triggerCondition: string
  ): Promise<PromotionValidation> {
    const validationId = generateValidationIdempotencyKey(promotionId, gameId);
    const timestamp = new Date().toISOString();
    
    console.log(`🔍 Validating promotion ${promotionId} for game ${gameId}`);
    
    try {
      // Get consensus for game data with evidence trail
      const consensus = await consensusEngine.getConsensusForPromotion(promotionId, gameId);
      
      // Create validation evidence
      const validationEvidence = {
        type: 'promotion_validation',
        promotionId,
        gameId,
        triggerCondition,
        consensus: {
          status: consensus.status,
          confidence: consensus.confidence,
          evidenceHash: consensus.evidenceHash,
          decisionRationale: consensus.decisionRationale
        },
        validationId,
        timestamp,
        algorithm: 'promotion_consensus_v1.0'
      };
      
      // Store validation evidence immutably
      const evidenceResult = await putImmutable(validationEvidence);
      
      // Determine validation result based on consensus
      const isValid = this.shouldApprovePromotion(consensus);
      const requiresManualReview = consensus.status === 'NEEDS_REVIEW' || consensus.requiresReconciliation;
      
      const validation: ValidationResult = {
        isValid,
        confidence: consensus.confidence,
        consensus,
        evidenceChain: [consensus.evidenceHash, evidenceResult.hash],
        validationId,
        timestamp,
        requiresManualReview,
        rationale: this.generateValidationRationale(consensus, isValid)
      };
      
      // Get promotion and game metadata
      const promotion = await storage.getPromotion(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }
      
      return {
        promotionId,
        gameId,
        validation,
        triggerCondition,
        gameData: consensus.gameData,
        metadata: {
          teamId: promotion.teamId!,
          restaurantId: promotion.restaurantId!,
          validatedAt: timestamp,
          validatedBy: 'consensus_engine'
        }
      };
      
    } catch (error) {
      console.error(`Validation failed for promotion ${promotionId}:`, error);
      
      // Store failure evidence
      const failureEvidence = {
        type: 'validation_failure',
        promotionId,
        gameId,
        error: error instanceof Error ? error.message : 'Unknown error',
        validationId,
        timestamp
      };
      
      const failureEvidenceResult = await putImmutable(failureEvidence);
      
      // Return failed validation
      return {
        promotionId,
        gameId,
        validation: {
          isValid: false,
          confidence: 0,
          evidenceChain: [failureEvidenceResult.hash],
          validationId,
          timestamp,
          requiresManualReview: true,
          rationale: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        triggerCondition,
        gameData: null,
        metadata: {
          teamId: 0,
          restaurantId: 0,
          validatedAt: timestamp,
          validatedBy: 'consensus_engine'
        }
      };
    }
  }
  
  /**
   * Validate multiple promotions for a game efficiently
   */
  async validatePromotionsForGame(gameId: string): Promise<PromotionValidation[]> {
    console.log(`🎯 Validating all promotions for game ${gameId}`);
    
    try {
      // Get game first to find team
      const gameRecord = await storage.getGameByExternalId(gameId);
      if (!gameRecord) {
        console.log(`Game ${gameId} not found in database`);
        return [];
      }
      
      // Get all promotions for this team
      const promotions = await storage.getPromotionsByTeam(gameRecord.teamId || 0);
      if (promotions.length === 0) {
        console.log(`No promotions found for team ${gameRecord.teamId}`);
        return [];
      }
      
      // Validate each promotion
      const validationPromises = promotions.map(promotion => 
        this.validatePromotionTrigger(
          promotion.id, 
          gameId, 
          promotion.triggerCondition || 'win_home'
        )
      );
      
      const validations = await Promise.allSettled(validationPromises);
      
      return validations
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`Validation failed for promotion ${promotions[index].id}:`, result.reason);
            return null;
          }
        })
        .filter((validation): validation is PromotionValidation => validation !== null);
        
    } catch (error) {
      console.error(`Failed to validate promotions for game ${gameId}:`, error);
      return [];
    }
  }
  
  /**
   * Get validation history for a promotion
   */
  async getValidationHistory(promotionId: number, limit: number = 10): Promise<PromotionValidation[]> {
    // This would query the evidence storage for validation history
    // For now, return empty array as this requires evidence querying implementation
    return [];
  }
  
  /**
   * Determine if promotion should be approved based on consensus
   */
  private shouldApprovePromotion(consensus: ConsensusResult): boolean {
    switch (consensus.status) {
      case 'CONFIRMED':
        return true;
      case 'PROVISIONAL':
        // Approve provisional with high confidence
        return consensus.confidence >= 0.8;
      case 'NEEDS_REVIEW':
        // Don't auto-approve, requires manual review
        return false;
      default:
        return false;
    }
  }
  
  /**
   * Generate human-readable validation rationale
   */
  private generateValidationRationale(consensus: ConsensusResult, isValid: boolean): string {
    const confidencePercent = (consensus.confidence * 100).toFixed(1);
    
    if (isValid) {
      return `Approved: ${consensus.decisionRationale} (${confidencePercent}% confidence)`;
    } else {
      return `Requires review: ${consensus.decisionRationale} (${confidencePercent}% confidence)`;
    }
  }
  
  /**
   * Get validation statistics for monitoring
   */
  getValidationMetrics() {
    const consensusMetrics = consensusEngine.getMetrics();
    
    return {
      ...consensusMetrics,
      validationService: {
        version: '1.0',
        evidenceStorageEnabled: true,
        approvalThreshold: 0.8
      }
    };
  }
}

// Global validation service instance
export const validationService = new ValidationService();