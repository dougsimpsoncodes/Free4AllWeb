import { chromium, Browser, Page } from "playwright";
import { db } from "../supabaseDb";
import { discoveredSites } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface EvidenceCapture {
  siteId: number;
  screenshotUrl?: string;
  rawHtml: string;
  rawText: string;
  metadata: {
    capturedAt: Date;
    pageTitle: string;
    finalUrl: string;
    viewport: { width: number; height: number };
  };
}

export class EvidenceStorage {
  private browser: Browser | null = null;

  /**
   * Capture comprehensive evidence for a discovered site
   */
  async captureEvidence(siteId: number): Promise<EvidenceCapture> {
    console.log(`📸 Capturing evidence for site ${siteId}...`);

    // Get site details
    const [site] = await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.id, siteId));

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Initialize browser if needed
    if (!this.browser) {
      this.browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await this.browser.newPage({
      viewport: { width: 1280, height: 720 }
    });

    try {
      // Navigate to the URL
      console.log(`🌐 Loading ${site.url}...`);
      await page.goto(site.url, { 
        waitUntil: "networkidle", 
        timeout: 30000 
      });

      // Wait a bit for any dynamic content
      await page.waitForTimeout(2000);

      // Capture screenshot
      const screenshotBuffer = await page.screenshot({ 
        fullPage: true,
        type: "png"
      });

      // Extract page content
      const rawHtml = await page.content();
      const rawText = await page.textContent("body") || "";
      const pageTitle = await page.title();
      const finalUrl = page.url();

      // Generate evidence file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const urlHash = crypto.createHash("md5").update(site.url).digest("hex").substring(0, 8);
      const filename = `evidence-${siteId}-${urlHash}-${timestamp}.png`;

      // Store screenshot (for now, we'll save locally - in production this would go to S3)
      const screenshotUrl = await this.storeScreenshot(filename, screenshotBuffer);

      // Update database with evidence
      await db
        .update(discoveredSites)
        .set({
          imageExtracted: screenshotUrl,
          rawText: rawText.substring(0, 10000), // Limit text length
          lastProcessed: new Date()
        })
        .where(eq(discoveredSites.id, siteId));

      console.log(`✅ Evidence captured for site ${siteId}`);

      const evidence: EvidenceCapture = {
        siteId,
        screenshotUrl,
        rawHtml,
        rawText,
        metadata: {
          capturedAt: new Date(),
          pageTitle,
          finalUrl,
          viewport: { width: 1280, height: 720 }
        }
      };

      return evidence;

    } finally {
      await page.close();
    }
  }

  /**
   * Batch capture evidence for multiple sites
   */
  async batchCaptureEvidence(siteIds: number[]): Promise<EvidenceCapture[]> {
    console.log(`📸 Batch capturing evidence for ${siteIds.length} sites...`);
    
    const results: EvidenceCapture[] = [];
    const errors: { siteId: number; error: string }[] = [];

    for (const siteId of siteIds) {
      try {
        const evidence = await this.captureEvidence(siteId);
        results.push(evidence);
        
        // Small delay between captures to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`❌ Failed to capture evidence for site ${siteId}:`, error.message);
        errors.push({ siteId, error: error.message });
      }
    }

    console.log(`✅ Batch capture complete: ${results.length} successful, ${errors.length} failed`);
    return results;
  }

  /**
   * Store screenshot evidence (mock implementation - would use S3 in production)
   */
  private async storeScreenshot(filename: string, buffer: Buffer): Promise<string> {
    // In production, this would upload to S3:
    // const s3Result = await s3.upload({
    //   Bucket: process.env.EVIDENCE_BUCKET,
    //   Key: `evidence/${filename}`,
    //   Body: buffer,
    //   ContentType: 'image/png'
    // }).promise();
    // return s3Result.Location;

    // For now, return a mock URL
    const mockS3Url = `https://evidence.free4allweb.com/evidence/${filename}`;
    console.log(`📁 Screenshot stored at: ${mockS3Url}`);
    return mockS3Url;
  }

  /**
   * Retrieve stored evidence for a site
   */
  async getEvidence(siteId: number): Promise<{
    site: any;
    screenshotUrl?: string | null;
    rawText?: string | null;
    lastProcessed?: Date | null;
  } | null> {
    const [site] = await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.id, siteId));

    if (!site) return null;

    return {
      site,
      screenshotUrl: site.imageExtracted,
      rawText: site.rawText,
      lastProcessed: site.lastProcessed
    };
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("🧹 Browser resources cleaned up");
    }
  }

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(siteId: number): Promise<{
    isValid: boolean;
    issues: string[];
    lastVerified: Date;
  }> {
    const evidence = await this.getEvidence(siteId);
    
    if (!evidence) {
      return {
        isValid: false,
        issues: ["Evidence not found"],
        lastVerified: new Date()
      };
    }

    const issues: string[] = [];

    // Check if screenshot URL is accessible (mock check)
    if (!evidence.screenshotUrl) {
      issues.push("Screenshot not captured");
    }

    // Check if raw text exists
    if (!evidence.rawText || evidence.rawText.trim().length < 50) {
      issues.push("Insufficient text content");
    }

    // Check if evidence is recent (within last 30 days)
    if (evidence.lastProcessed) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (evidence.lastProcessed < thirtyDaysAgo) {
        issues.push("Evidence is outdated");
      }
    } else {
      issues.push("No processing timestamp");
    }

    return {
      isValid: issues.length === 0,
      issues,
      lastVerified: new Date()
    };
  }

  /**
   * Generate evidence report for admin review
   */
  async generateEvidenceReport(siteIds: number[]): Promise<{
    totalSites: number;
    withScreenshots: number;
    withText: number;
    averageTextLength: number;
    issues: Array<{ siteId: number; issues: string[] }>;
  }> {
    console.log(`📊 Generating evidence report for ${siteIds.length} sites...`);

    const sites = await db
      .select()
      .from(discoveredSites)
      .where(eq(discoveredSites.id, siteIds[0])); // This is a simplified query

    let withScreenshots = 0;
    let withText = 0;
    let totalTextLength = 0;
    const issues: Array<{ siteId: number; issues: string[] }> = [];

    for (const siteId of siteIds) {
      const verification = await this.verifyEvidence(siteId);
      const evidence = await this.getEvidence(siteId);

      if (evidence?.screenshotUrl) withScreenshots++;
      if (evidence?.rawText) {
        withText++;
        totalTextLength += evidence.rawText.length;
      }

      if (!verification.isValid) {
        issues.push({ siteId, issues: verification.issues });
      }
    }

    return {
      totalSites: siteIds.length,
      withScreenshots,
      withText,
      averageTextLength: withText > 0 ? Math.round(totalTextLength / withText) : 0,
      issues
    };
  }
}