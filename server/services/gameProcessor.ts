import { mlbApiService } from "./mlbApiService";

/**
 * Game Processing Service
 * Handles scheduled checking of game results and promotion triggers
 */
export class GameProcessor {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;

  /**
   * Start the game processing service
   * Checks for completed games every 5 minutes during baseball season
   */
  start(): void {
    console.log("Starting game processor...");
    
    // Run immediately on startup
    this.processGames();
    
    // Then run every 5 minutes
    this.processInterval = setInterval(() => {
      this.processGames();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the game processing service
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    console.log("Game processor stopped");
  }

  /**
   * Process completed games and check for triggered promotions
   */
  private async processGames(): Promise<void> {
    if (this.isProcessing) {
      console.log("Game processing already in progress, skipping...");
      return;
    }

    this.isProcessing = true;
    console.log("Processing games at:", new Date().toISOString());

    try {
      await mlbApiService.processCompletedGames();
      console.log("Game processing completed successfully");
    } catch (error) {
      console.error("Error during game processing:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual trigger for processing games (useful for testing)
   */
  async triggerManualProcess(): Promise<{ success: boolean; message: string }> {
    try {
      await this.processGames();
      return { success: true, message: "Game processing completed successfully" };
    } catch (error) {
      console.error("Manual game processing failed:", error);
      return { 
        success: false, 
        message: `Game processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Check if processor is currently running
   */
  isRunning(): boolean {
    return this.processInterval !== null;
  }

  /**
   * Get processing status
   */
  getStatus(): { 
    isRunning: boolean; 
    isProcessing: boolean; 
    lastCheck: string | null;
  } {
    return {
      isRunning: this.isRunning(),
      isProcessing: this.isProcessing,
      lastCheck: this.processInterval ? new Date().toISOString() : null
    };
  }
}

export const gameProcessor = new GameProcessor();