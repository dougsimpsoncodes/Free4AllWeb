import { enhancedDealDiscoveryService } from './enhancedDealDiscovery';
import { dealPatternMatcher } from './dealPatternMatcher';
import { storage } from '../storage';
import { EventEmitter } from 'events';

export interface MonitoringResult {
  timestamp: Date;
  newDeals: number;
  totalProcessed: number;
  averageConfidence: number;
  errors: string[];
  patternStats: any;
}

export class RealTimeDealMonitor extends EventEmitter {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private monitoringInterval = 30 * 60 * 1000; // 30 minutes
  private lastRunTime: Date | null = null;
  private stats = {
    totalRuns: 0,
    totalDealsFound: 0,
    averageRunTime: 0,
    lastErrors: [] as string[]
  };

  constructor() {
    super();
  }

  start(): void {
    if (this.isRunning) {
      console.log('Deal monitor is already running');
      return;
    }

    console.log('🔍 Starting real-time deal monitor...');
    this.isRunning = true;
    this.lastRunTime = new Date();

    // Run immediately
    this.runDiscovery();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runDiscovery();
    }, this.monitoringInterval);

    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('⏹️ Stopping deal monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('stopped');
  }

  private async runDiscovery(): Promise<MonitoringResult> {
    const startTime = Date.now();
    const result: MonitoringResult = {
      timestamp: new Date(),
      newDeals: 0,
      totalProcessed: 0,
      averageConfidence: 0,
      errors: [],
      patternStats: {}
    };

    try {
      console.log('\n🔍 Running scheduled deal discovery...');
      
      // Enhanced discovery
      const discoveredDeals = await enhancedDealDiscoveryService.discoverAllDeals();
      
      result.newDeals = discoveredDeals.length;
      result.totalProcessed = discoveredDeals.length;
      
      if (discoveredDeals.length > 0) {
        result.averageConfidence = discoveredDeals.reduce((sum, deal) => sum + deal.confidence, 0) / discoveredDeals.length;
        
        // Save discovered deals
        await enhancedDealDiscoveryService.saveDiscoveredDeals(discoveredDeals);
        
        console.log(`✅ Discovery complete: ${discoveredDeals.length} new deals found`);
        console.log(`   Average confidence: ${Math.round(result.averageConfidence * 100)}%`);
        
        // Emit event for high-confidence deals
        const highConfidenceDeals = discoveredDeals.filter(deal => deal.confidence > 0.8);
        if (highConfidenceDeals.length > 0) {
          this.emit('highConfidenceDeals', highConfidenceDeals);
        }
      } else {
        console.log('ℹ️ No new deals discovered in this run');
      }

      // Get pattern matching stats
      result.patternStats = dealPatternMatcher.getPatternStats();

    } catch (error) {
      const errorMsg = `Deal discovery failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌', errorMsg);
      result.errors.push(errorMsg);
      this.stats.lastErrors.push(errorMsg);
    }

    // Update stats
    const runTime = Date.now() - startTime;
    this.stats.totalRuns++;
    this.stats.totalDealsFound += result.newDeals;
    this.stats.averageRunTime = (this.stats.averageRunTime * (this.stats.totalRuns - 1) + runTime) / this.stats.totalRuns;
    this.lastRunTime = result.timestamp;

    // Keep only last 10 errors
    if (this.stats.lastErrors.length > 10) {
      this.stats.lastErrors = this.stats.lastErrors.slice(-10);
    }

    this.emit('discoveryComplete', result);
    return result;
  }

  getStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    nextRunTime: Date | null;
    stats: any;
  } {
    const nextRunTime = this.lastRunTime && this.isRunning 
      ? new Date(this.lastRunTime.getTime() + this.monitoringInterval)
      : null;

    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime,
      stats: { ...this.stats }
    };
  }

  // Manual discovery trigger
  async triggerDiscovery(): Promise<MonitoringResult> {
    console.log('🔄 Manual deal discovery triggered');
    return await this.runDiscovery();
  }

  // Update monitoring frequency
  setInterval(minutes: number): void {
    if (minutes < 5) {
      throw new Error('Minimum monitoring interval is 5 minutes');
    }

    this.monitoringInterval = minutes * 60 * 1000;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      setTimeout(() => this.start(), 1000);
    }

    console.log(`⏰ Monitoring interval updated to ${minutes} minutes`);
  }

  // Get recent monitoring results
  getRecentResults(count: number = 10): MonitoringResult[] {
    // In a real implementation, this would fetch from a database
    // For now, return mock data based on current stats
    return [];
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    averageRunTime: number;
    successRate: number;
    dealsPerHour: number;
    patternMatchAccuracy: number;
  } {
    const hoursRunning = this.stats.totalRuns * (this.monitoringInterval / (1000 * 60 * 60));
    const successRate = this.stats.totalRuns > 0 
      ? (this.stats.totalRuns - this.stats.lastErrors.length) / this.stats.totalRuns 
      : 0;

    return {
      averageRunTime: Math.round(this.stats.averageRunTime),
      successRate: Math.round(successRate * 100) / 100,
      dealsPerHour: hoursRunning > 0 ? Math.round(this.stats.totalDealsFound / hoursRunning * 100) / 100 : 0,
      patternMatchAccuracy: dealPatternMatcher.getPatternStats().avgConfidence
    };
  }
}

export const realTimeDealMonitor = new RealTimeDealMonitor();