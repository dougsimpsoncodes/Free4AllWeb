import { db } from "../db";
import { promotions } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export interface DealMigrationReport {
  totalDeals: number;
  testDeals: number;
  discoveredDeals: number;
  manualDeals: number;
  pendingApproval: number;
}

export class DealMigrationService {
  
  /**
   * Get a comprehensive report of all deals by source
   */
  async getMigrationReport(): Promise<DealMigrationReport> {
    const allDeals = await db.select().from(promotions);
    
    const report: DealMigrationReport = {
      totalDeals: allDeals.length,
      testDeals: allDeals.filter(deal => deal.source === 'manual' && deal.createdAt && deal.createdAt < new Date('2025-07-18')).length,
      discoveredDeals: allDeals.filter(deal => deal.source === 'discovered' && deal.approvalStatus === 'approved').length,
      manualDeals: allDeals.filter(deal => deal.source === 'manual' && deal.createdAt && deal.createdAt >= new Date('2025-07-18')).length,
      pendingApproval: allDeals.filter(deal => deal.approvalStatus === 'pending').length,
    };
    
    return report;
  }

  /**
   * Mark all existing deals as test deals (pre-migration deals)
   */
  async markExistingDealsAsTest(): Promise<number> {
    const cutoffDate = new Date('2025-07-18'); // Today - everything before is test data
    
    const result = await db
      .update(promotions)
      .set({ 
        source: 'manual',
        discoveryData: { isTestData: true, migrationDate: new Date().toISOString() }
      })
      .where(eq(promotions.createdAt, null)); // Deals without explicit creation dates
    
    return result.length || 0;
  }

  /**
   * Get all test deals for review before deletion
   */
  async getTestDeals() {
    return await db
      .select()
      .from(promotions)
      .where(eq(promotions.source, 'manual'));
  }

  /**
   * Get all discovered deals (approved through the system)
   */
  async getDiscoveredDeals() {
    return await db
      .select()
      .from(promotions)
      .where(eq(promotions.source, 'discovered'));
  }

  /**
   * Safely remove test deals (with confirmation)
   */
  async removeTestDeals(dealIds: number[]): Promise<number> {
    if (dealIds.length === 0) return 0;
    
    // Double-check these are actually test deals
    const dealsToDelete = await db
      .select()
      .from(promotions)
      .where(inArray(promotions.id, dealIds));
    
    const testDealsOnly = dealsToDelete.filter(deal => 
      deal.source === 'manual' && 
      deal.discoveryData && 
      (deal.discoveryData as any).isTestData
    );
    
    if (testDealsOnly.length !== dealIds.length) {
      throw new Error('Some deals are not marked as test data and cannot be deleted');
    }
    
    const result = await db
      .delete(promotions)
      .where(inArray(promotions.id, dealIds));
    
    return result.length || 0;
  }

  /**
   * Create a backup of test deals before deletion
   */
  async backupTestDeals(): Promise<string> {
    const testDeals = await this.getTestDeals();
    const backup = {
      backupDate: new Date().toISOString(),
      deals: testDeals,
      totalCount: testDeals.length
    };
    
    // In a real system, you'd save this to a file or backup database
    // For now, return JSON string that can be saved
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Update deal approval status (for discovered deals)
   */
  async updateDealApproval(dealId: number, status: 'approved' | 'rejected', approvedBy: string): Promise<void> {
    await db
      .update(promotions)
      .set({
        approvalStatus: status,
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(promotions.id, dealId));
  }

  /**
   * Convert a discovered deal to an active promotion
   */
  async activateDiscoveredDeal(dealId: number, approvedBy: string): Promise<void> {
    await db
      .update(promotions)
      .set({
        approvalStatus: 'approved',
        approvedBy,
        approvedAt: new Date(),
        isActive: true,
      })
      .where(eq(promotions.id, dealId));
  }
}

export const dealMigrationService = new DealMigrationService();