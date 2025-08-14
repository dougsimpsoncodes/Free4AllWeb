/**
 * Job Queue Service
 * 
 * Provides durable job processing for validation workflows using BullMQ.
 * Handles task distribution, retries, and failure recovery for validation system.
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Job type definitions
export interface ValidationJob {
  type: 'validate_promotion';
  data: {
    promotionId: number;
    gameId: string;
    priority?: number;
  };
}

export interface SourceFetchJob {
  type: 'fetch_game_data';
  data: {
    gameId: string;
    sources: string[];
    promotionIds: number[];
  };
}

export interface ConsensusJob {
  type: 'consensus_evaluation';
  data: {
    gameId: string;
    sourceData: any[];
    promotionIds: number[];
  };
}

export interface NotificationJob {
  type: 'send_notification';
  data: {
    promotionId: number;
    triggerEventId: number;
    notificationType: 'push' | 'email' | 'sms';
  };
}

export type JobData = ValidationJob | SourceFetchJob | ConsensusJob | NotificationJob;

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  retryCount: number;
}

// Queue configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxLoadingTimeout: 1000,
};

const queueConfig: QueueOptions = {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Initialize queues
export const validationQueue = new Queue('validation', queueConfig);
export const sourceQueue = new Queue('source-fetch', queueConfig);
export const consensusQueue = new Queue('consensus', queueConfig);
export const notificationQueue = new Queue('notification', queueConfig);

/**
 * Job Queue Manager
 */
export class JobQueueManager {
  private workers: Worker[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test Redis connection
      const redis = new Redis(redisConfig);
      await redis.ping();
      await redis.quit();

      console.log('✅ Redis connection established');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw new Error('Redis connection failed - job queue unavailable');
    }
  }

  /**
   * Add validation job with priority
   */
  async addValidationJob(
    promotionId: number, 
    gameId: string, 
    options: { priority?: number; delay?: number } = {}
  ): Promise<Job> {
    await this.ensureInitialized();

    return validationQueue.add('validate_promotion', {
      type: 'validate_promotion',
      data: { promotionId, gameId, priority: options.priority || 0 }
    }, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      jobId: `validation_${promotionId}_${gameId}_${Date.now()}`
    });
  }

  /**
   * Add source fetch job for multiple sources
   */
  async addSourceFetchJob(
    gameId: string, 
    sources: string[], 
    promotionIds: number[],
    options: { priority?: number } = {}
  ): Promise<Job> {
    await this.ensureInitialized();

    return sourceQueue.add('fetch_game_data', {
      type: 'fetch_game_data',
      data: { gameId, sources, promotionIds }
    }, {
      priority: options.priority || 0,
      jobId: `source_fetch_${gameId}_${Date.now()}`
    });
  }

  /**
   * Add consensus evaluation job
   */
  async addConsensusJob(
    gameId: string,
    sourceData: any[],
    promotionIds: number[],
    options: { priority?: number } = {}
  ): Promise<Job> {
    await this.ensureInitialized();

    return consensusQueue.add('consensus_evaluation', {
      type: 'consensus_evaluation',
      data: { gameId, sourceData, promotionIds }
    }, {
      priority: options.priority || 5, // Higher priority for consensus
      jobId: `consensus_${gameId}_${Date.now()}`
    });
  }

  /**
   * Add notification job
   */
  async addNotificationJob(
    promotionId: number,
    triggerEventId: number,
    notificationType: 'push' | 'email' | 'sms',
    options: { delay?: number } = {}
  ): Promise<Job> {
    await this.ensureInitialized();

    return notificationQueue.add('send_notification', {
      type: 'send_notification',
      data: { promotionId, triggerEventId, notificationType }
    }, {
      priority: 10, // High priority for notifications
      delay: options.delay || 0,
      jobId: `notification_${triggerEventId}_${notificationType}_${Date.now()}`
    });
  }

  /**
   * Start worker processes
   */
  async startWorkers(): Promise<void> {
    await this.ensureInitialized();

    const workerConfig: WorkerOptions = {
      connection: redisConfig,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    };

    // Validation worker
    const validationWorker = new Worker('validation', async (job: Job) => {
      return this.processValidationJob(job);
    }, workerConfig);

    // Source fetch worker  
    const sourceWorker = new Worker('source-fetch', async (job: Job) => {
      return this.processSourceFetchJob(job);
    }, workerConfig);

    // Consensus worker
    const consensusWorker = new Worker('consensus', async (job: Job) => {
      return this.processConsensusJob(job);
    }, workerConfig);

    // Notification worker
    const notificationWorker = new Worker('notification', async (job: Job) => {
      return this.processNotificationJob(job);
    }, workerConfig);

    this.workers = [validationWorker, sourceWorker, consensusWorker, notificationWorker];

    // Set up error handling
    this.workers.forEach(worker => {
      worker.on('completed', (job, result) => {
        console.log(`✅ Job ${job.id} completed:`, result);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed:`, err.message);
      });

      worker.on('error', (err) => {
        console.error('❌ Worker error:', err);
      });
    });

    console.log('🔄 Job queue workers started');
  }

  /**
   * Stop all workers
   */
  async stopWorkers(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.close()));
    this.workers = [];
    console.log('⏹️ Job queue workers stopped');
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    validation: any;
    sourceFetch: any;
    consensus: any;
    notification: any;
  }> {
    await this.ensureInitialized();

    const [validationStats, sourceStats, consensusStats, notificationStats] = await Promise.all([
      validationQueue.getWaiting(),
      sourceQueue.getWaiting(),
      consensusQueue.getWaiting(),
      notificationQueue.getWaiting(),
    ]);

    return {
      validation: {
        waiting: validationStats.length,
        active: await validationQueue.getActive(),
        completed: await validationQueue.getCompleted(),
        failed: await validationQueue.getFailed(),
      },
      sourceFetch: {
        waiting: sourceStats.length,
        active: await sourceQueue.getActive(),
        completed: await sourceQueue.getCompleted(),
        failed: await sourceQueue.getFailed(),
      },
      consensus: {
        waiting: consensusStats.length,
        active: await consensusQueue.getActive(),
        completed: await consensusQueue.getCompleted(), 
        failed: await consensusQueue.getFailed(),
      },
      notification: {
        waiting: notificationStats.length,
        active: await notificationQueue.getActive(),
        completed: await notificationQueue.getCompleted(),
        failed: await notificationQueue.getFailed(),
      },
    };
  }

  // Job processors (to be implemented by validation system)
  private async processValidationJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      // Placeholder - will be implemented by validation engine
      console.log(`Processing validation job for promotion ${job.data.data.promotionId}`);
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        data: { promotionId: job.data.data.promotionId, validated: true },
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    }
  }

  private async processSourceFetchJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Fetching data for game ${job.data.data.gameId} from sources:`, job.data.data.sources);
      
      // Placeholder - will be implemented by source manager
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return {
        success: true,
        data: { gameId: job.data.data.gameId, sourcesQueried: job.data.data.sources.length },
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    }
  }

  private async processConsensusJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing consensus for game ${job.data.data.gameId}`);
      
      // Placeholder - will be implemented by consensus engine
      await new Promise(resolve => setTimeout(resolve, 150));
      
      return {
        success: true,
        data: { gameId: job.data.data.gameId, consensus: 'CONFIRMED' },
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    }
  }

  private async processNotificationJob(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Sending ${job.data.data.notificationType} notification for trigger ${job.data.data.triggerEventId}`);
      
      // Placeholder - will be implemented by notification service
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        data: { sent: true, type: job.data.data.notificationType },
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
        retryCount: job.attemptsMade
      };
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

// Global queue manager instance
export const queueManager = new JobQueueManager();