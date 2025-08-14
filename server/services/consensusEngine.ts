/**
 * Consensus Engine - Phase 1.2
 * 
 * Implements deterministic consensus algorithm with exact expert specifications:
 * - Source weights: ESPN=0.6, MLB=0.4
 * - Quality factors: (isFinal ? 1 : 0.8) * recencyFactor  
 * - Agreement rules: CONFIRMED/PROVISIONAL/NEEDS_REVIEW
 * - Evidence storage integration for audit trails
 */

import { enhancedSportsApi, type GameData, type SourceResponse } from './enhancedSportsApiService.ts';
import { putImmutable } from './evidence/storage.ts';
import { createEvidenceIntegrity } from './evidence/hash.ts';
import { generateValidationIdempotencyKey } from '../middleware/idempotency.ts';

export interface ConsensusResult {
  status: 'CONFIRMED' | 'PROVISIONAL' | 'NEEDS_REVIEW';
  gameData: GameData;
  confidence: number;
  sources: SourceContribution[];
  evidenceHash: string;
  decisionRationale: string;
  requiresReconciliation: boolean;
  timestamp: string;
}

export interface SourceContribution {
  source: 'ESPN' | 'MLB';
  data: GameData;
  weight: number;
  qualityFactor: number;
  recencyFactor: number;
  weightedScore: number;
  timestamp: string;
  responseTime: number;
  agrees: boolean;
}

export interface ConsensusMetrics {
  totalEvaluations: number;
  confirmedDecisions: number;
  provisionalDecisions: number;
  needsReviewDecisions: number;
  averageConfidence: number;
  sourceReliability: {
    espn: { uptime: number; averageResponseTime: number };
    mlb: { uptime: number; averageResponseTime: number };
  };
}

export class ConsensusEngine {
  // Expert-specified source weights
  private readonly ESPN_WEIGHT = 0.6;
  private readonly MLB_WEIGHT = 0.4;
  
  // Quality and confidence thresholds
  private readonly PROVISIONAL_CONFIDENCE_THRESHOLD = 0.8;
  private readonly RECENCY_WINDOW_SECONDS = 60;
  private readonly MIN_RECENCY_FACTOR = 0.6;

  // Metrics tracking
  private metrics: ConsensusMetrics = {
    totalEvaluations: 0,
    confirmedDecisions: 0,
    provisionalDecisions: 0,
    needsReviewDecisions: 0,
    averageConfidence: 0,
    sourceReliability: {
      espn: { uptime: 0, averageResponseTime: 0 },
      mlb: { uptime: 0, averageResponseTime: 0 }
    }
  };

  /**
   * Evaluate game consensus for promotion validation
   */
  async evaluateGameConsensus(gameId: string, promotionId?: number): Promise<ConsensusResult> {
    const startTime = Date.now();
    this.metrics.totalEvaluations++;

    try {
      // Get multi-source game data using Phase 1.1 infrastructure
      const sourceResult = await enhancedSportsApi.getGameData(gameId, {
        useConditionalRequest: true,
        timeout: 8000
      });

      if (!sourceResult.success || sourceResult.sources.length === 0) {
        throw new Error(`Failed to fetch game data: ${sourceResult.error}`);
      }

      // Calculate consensus using deterministic algorithm
      const consensus = this.calculateConsensus(sourceResult.sources, gameId);

      // Store consensus evidence for audit trail
      const consensusEvidence = {
        type: 'consensus_decision',
        gameId,
        promotionId,
        algorithm: 'deterministic_v1.0',
        sourceEvidenceHashes: sourceResult.sources.map(s => s.data.source + '_' + startTime),
        decision: {
          status: consensus.status,
          confidence: consensus.confidence,
          gameData: consensus.gameData,
          decisionRationale: consensus.decisionRationale
        },
        sources: consensus.sources,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      const evidenceResult = await putImmutable(consensusEvidence);

      // Update metrics
      this.updateMetrics(consensus);

      return {
        ...consensus,
        evidenceHash: evidenceResult.hash,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Consensus evaluation failed for game ${gameId}:`, error);
      
      // Store failure evidence
      const failureEvidence = {
        type: 'consensus_failure',
        gameId,
        promotionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };

      const failureEvidenceResult = await putImmutable(failureEvidence);

      throw new Error(`Consensus evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate consensus using deterministic algorithm with expert specifications
   */
  private calculateConsensus(sources: SourceResponse[], gameId: string): Omit<ConsensusResult, 'evidenceHash' | 'timestamp'> {
    if (sources.length === 0) {
      throw new Error('No sources available for consensus');
    }

    // Convert sources to contributions with calculated factors
    const contributions: SourceContribution[] = sources.map(source => {
      const weight = this.getSourceWeight(source.data.source);
      const qualityFactor = this.calculateQualityFactor(source.data);
      const recencyFactor = this.calculateRecencyFactor(source.fetchedAt);
      const weightedScore = weight * qualityFactor * recencyFactor;

      return {
        source: source.data.source,
        data: source.data,
        weight,
        qualityFactor,
        recencyFactor,
        weightedScore,
        timestamp: source.fetchedAt,
        responseTime: source.responseTime,
        agrees: true // Will be calculated in agreement analysis
      };
    });

    // Analyze agreement between sources
    const agreement = this.analyzeSourceAgreement(contributions);

    // Apply expert-specified agreement rules
    if (agreement.allAgree && contributions.length > 1) {
      return {
        status: 'CONFIRMED',
        gameData: this.selectPrimaryGameData(contributions),
        confidence: 1.0,
        sources: contributions,
        decisionRationale: `All ${contributions.length} sources agree on game state`,
        requiresReconciliation: false
      };
    }

    // Single source always requires validation - never CONFIRMED
    if (contributions.length === 1) {
      const singleSource = contributions[0];
      return {
        status: singleSource.qualityFactor >= 1.0 ? 'PROVISIONAL' : 'NEEDS_REVIEW',
        gameData: this.selectPrimaryGameData(contributions),
        confidence: singleSource.weightedScore,
        sources: contributions,
        decisionRationale: `Single source (${singleSource.source}) - requires additional validation`,
        requiresReconciliation: true
      };
    }

    // Calculate overall confidence using weighted scores
    const totalWeight = contributions.reduce((sum, c) => sum + c.weightedScore, 0);
    const confidence = totalWeight / contributions.length;

    // Check for contradictions
    if (agreement.hasContradictions) {
      return {
        status: 'NEEDS_REVIEW',
        gameData: this.selectPrimaryGameData(contributions),
        confidence,
        sources: contributions,
        decisionRationale: `Sources contradict on critical fields: ${agreement.contradictions.join(', ')}`,
        requiresReconciliation: true
      };
    }

    // Apply provisional confidence threshold
    if (confidence >= this.PROVISIONAL_CONFIDENCE_THRESHOLD) {
      return {
        status: 'PROVISIONAL',
        gameData: this.selectPrimaryGameData(contributions),
        confidence,
        sources: contributions,
        decisionRationale: `High confidence (${confidence.toFixed(3)}) with no contradictions`,
        requiresReconciliation: true
      };
    }

    // Low confidence - needs manual review
    return {
      status: 'NEEDS_REVIEW',
      gameData: this.selectPrimaryGameData(contributions),
      confidence,
      sources: contributions,
      decisionRationale: `Low confidence (${confidence.toFixed(3)}) below threshold ${this.PROVISIONAL_CONFIDENCE_THRESHOLD}`,
      requiresReconciliation: true
    };
  }

  /**
   * Get source weight per expert specifications
   */
  private getSourceWeight(source: 'ESPN' | 'MLB'): number {
    switch (source) {
      case 'ESPN': return this.ESPN_WEIGHT;
      case 'MLB': return this.MLB_WEIGHT;
      default: return 0.1; // Unknown sources get minimal weight
    }
  }

  /**
   * Calculate quality factor: (isFinal ? 1 : 0.8) per expert specifications
   */
  private calculateQualityFactor(gameData: GameData): number {
    return gameData.status.isFinal ? 1.0 : 0.8;
  }

  /**
   * Calculate recency factor: clamp(1 - age_seconds/60, 0.6, 1.0) per expert specifications
   */
  private calculateRecencyFactor(timestamp: string): number {
    const ageSeconds = (Date.now() - new Date(timestamp).getTime()) / 1000;
    const factor = 1 - (ageSeconds / this.RECENCY_WINDOW_SECONDS);
    return Math.max(this.MIN_RECENCY_FACTOR, Math.min(1.0, factor));
  }

  /**
   * Analyze agreement between sources
   */
  private analyzeSourceAgreement(contributions: SourceContribution[]): {
    allAgree: boolean;
    hasContradictions: boolean;
    contradictions: string[];
    agreementFields: string[];
  } {
    if (contributions.length < 2) {
      return { allAgree: true, hasContradictions: false, contradictions: [], agreementFields: ['single_source'] };
    }

    const contradictions: string[] = [];
    const agreementFields: string[] = [];

    // Check critical fields for agreement
    const criticalFields = ['teams.home.score', 'teams.away.score', 'status.isFinal'];
    
    for (const field of criticalFields) {
      const values = contributions.map(c => this.getNestedValue(c.data, field));
      const uniqueValues = [...new Set(values)];
      
      if (uniqueValues.length === 1) {
        agreementFields.push(field);
        // Mark all sources as agreeing on this field
        contributions.forEach(c => c.agrees = c.agrees && true);
      } else {
        contradictions.push(field);
        // Mark sources with minority values as not agreeing
        const majorityValue = this.getMajorityValue(values);
        contributions.forEach(c => {
          const value = this.getNestedValue(c.data, field);
          c.agrees = c.agrees && (value === majorityValue);
        });
      }
    }

    return {
      allAgree: contradictions.length === 0,
      hasContradictions: contradictions.length > 0,
      contradictions,
      agreementFields
    };
  }

  /**
   * Select primary game data using tie-break rules per expert specifications
   */
  private selectPrimaryGameData(contributions: SourceContribution[]): GameData {
    if (contributions.length === 0) {
      throw new Error('No contributions available for primary data selection');
    }

    // Expert tie-break rule: Prefer MLB when both final, else freshest timestamp
    const finalContributions = contributions.filter(c => c.data.status.isFinal);
    
    if (finalContributions.length > 1) {
      // Multiple final sources - prefer MLB per expert specifications
      const mlbFinal = finalContributions.find(c => c.source === 'MLB');
      if (mlbFinal) {
        return mlbFinal.data;
      }
    }

    // Use freshest timestamp (highest weighted score includes recency)
    const primary = contributions.reduce((best, current) => 
      current.weightedScore > best.weightedScore ? current : best
    );

    return primary.data;
  }

  /**
   * Helper to get nested object values
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Helper to get majority value from array
   */
  private getMajorityValue(values: any[]): any {
    const counts = new Map();
    values.forEach(val => counts.set(val, (counts.get(val) || 0) + 1));
    
    let majorityValue = values[0];
    let maxCount = 0;
    
    for (const [value, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        majorityValue = value;
      }
    }
    
    return majorityValue;
  }

  /**
   * Update consensus metrics
   */
  private updateMetrics(result: Omit<ConsensusResult, 'evidenceHash' | 'timestamp'>): void {
    switch (result.status) {
      case 'CONFIRMED':
        this.metrics.confirmedDecisions++;
        break;
      case 'PROVISIONAL':
        this.metrics.provisionalDecisions++;
        break;
      case 'NEEDS_REVIEW':
        this.metrics.needsReviewDecisions++;
        break;
    }

    // Update rolling average confidence
    const totalDecisions = this.metrics.confirmedDecisions + this.metrics.provisionalDecisions + this.metrics.needsReviewDecisions;
    this.metrics.averageConfidence = (
      (this.metrics.averageConfidence * (totalDecisions - 1)) + result.confidence
    ) / totalDecisions;
  }

  /**
   * Get consensus metrics for monitoring
   */
  getMetrics(): ConsensusMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics = {
      totalEvaluations: 0,
      confirmedDecisions: 0,
      provisionalDecisions: 0,
      needsReviewDecisions: 0,
      averageConfidence: 0,
      sourceReliability: {
        espn: { uptime: 0, averageResponseTime: 0 },
        mlb: { uptime: 0, averageResponseTime: 0 }
      }
    };
  }

  /**
   * Get consensus result for specific promotion validation
   */
  async getConsensusForPromotion(promotionId: number, gameId: string): Promise<ConsensusResult> {
    const idempotencyKey = generateValidationIdempotencyKey(promotionId, gameId);
    
    console.log(`🎯 Getting consensus for promotion ${promotionId}, game ${gameId}`);
    
    return this.evaluateGameConsensus(gameId, promotionId);
  }
}

// Global consensus engine instance
export const consensusEngine = new ConsensusEngine();