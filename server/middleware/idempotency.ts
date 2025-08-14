/**
 * Idempotency Middleware
 * 
 * Ensures that duplicate requests (identified by Idempotency-Key header)
 * return the same response without re-executing side effects.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  isIdempotentRetry?: boolean;
}

export interface IdempotencyResult {
  key: string;
  statusCode: number;
  response: any;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * In-memory storage for idempotency results
 * In production, this should be Redis or another persistent store
 */
class IdempotencyStore {
  private store = new Map<string, IdempotencyResult>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Store idempotency result
   */
  set(key: string, statusCode: number, response: any): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL);
    
    this.store.set(key, {
      key,
      statusCode,
      response,
      createdAt: now,
      expiresAt
    });

    // Clean up expired entries periodically
    this.cleanup();
  }

  /**
   * Get idempotency result
   */
  get(key: string): IdempotencyResult | undefined {
    const result = this.store.get(key);
    
    if (!result) {
      return undefined;
    }

    // Check if expired
    if (new Date() > result.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return result;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = new Date();
    
    for (const [key, result] of this.store.entries()) {
      if (now > result.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get store statistics
   */
  getStats(): { total: number; expired: number } {
    const now = new Date();
    let expired = 0;
    
    for (const result of this.store.values()) {
      if (now > result.expiresAt) {
        expired++;
      }
    }

    return {
      total: this.store.size,
      expired
    };
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// Global idempotency store
const idempotencyStore = new IdempotencyStore();

/**
 * Generate idempotency key from request
 */
function generateIdempotencyKey(req: Request): string {
  const method = req.method;
  const path = req.path;
  const body = req.body ? JSON.stringify(req.body) : '';
  const query = JSON.stringify(req.query);
  
  const content = `${method}:${path}:${body}:${query}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validate idempotency key format
 */
function isValidIdempotencyKey(key: string): boolean {
  // Allow alphanumeric, hyphens, and underscores, 1-255 characters
  return /^[a-zA-Z0-9_-]{1,255}$/.test(key);
}

/**
 * Idempotency middleware for validation endpoints
 */
export function idempotency(options: {
  required?: boolean;
  autoGenerate?: boolean;
  methods?: string[];
} = {}) {
  const {
    required = false,
    autoGenerate = true,
    methods = ['POST', 'PUT', 'PATCH']
  } = options;

  return (req: IdempotentRequest, res: Response, next: NextFunction): void => {
    // Skip if method not in list
    if (!methods.includes(req.method)) {
      next();
      return;
    }

    let idempotencyKey = req.headers['idempotency-key'] as string;

    // Check if idempotency key is required
    if (required && !idempotencyKey) {
      res.status(400).json({
        success: false,
        error: 'Idempotency-Key header is required for this endpoint'
      });
      return;
    }

    // Auto-generate key if not provided
    if (!idempotencyKey && autoGenerate) {
      idempotencyKey = generateIdempotencyKey(req);
    }

    // Validate key format if provided
    if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Idempotency-Key format. Must be alphanumeric with hyphens/underscores, 1-255 characters.'
      });
      return;
    }

    // Check for existing result
    if (idempotencyKey) {
      const existingResult = idempotencyStore.get(idempotencyKey);
      
      if (existingResult) {
        // Return cached result
        req.isIdempotentRetry = true;
        res.status(existingResult.statusCode).json(existingResult.response);
        return;
      }

      // Store key in request for later use
      req.idempotencyKey = idempotencyKey;

      // Intercept response to store result
      const originalSend = res.json;
      res.json = function(body: any) {
        // Only store successful responses and client errors (not server errors)
        if (res.statusCode < 500) {
          idempotencyStore.set(idempotencyKey!, res.statusCode, body);
        }
        
        // Call original json method
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

/**
 * Middleware specifically for validation system endpoints
 */
export const validationIdempotency = idempotency({
  required: true, // Require idempotency keys for validation
  autoGenerate: false, // Don't auto-generate for validation (explicit required)
  methods: ['POST', 'PUT']
});

/**
 * Middleware for admin endpoints (optional idempotency)
 */
export const adminIdempotency = idempotency({
  required: false,
  autoGenerate: true,
  methods: ['POST', 'PUT', 'PATCH', 'DELETE']
});

/**
 * Get idempotency store statistics
 */
export function getIdempotencyStats(): { total: number; expired: number } {
  return idempotencyStore.getStats();
}

/**
 * Clear idempotency store (for testing)
 */
export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}

/**
 * Middleware to add idempotency key to response headers
 */
export function addIdempotencyHeaders(req: IdempotentRequest, res: Response, next: NextFunction): void {
  if (req.idempotencyKey) {
    res.setHeader('Idempotency-Key', req.idempotencyKey);
    
    if (req.isIdempotentRetry) {
      res.setHeader('Idempotent-Replay', 'true');
    }
  }

  next();
}

/**
 * Utility to generate idempotency key for validation operations
 */
export function generateValidationIdempotencyKey(promotionId: number, gameId: string, timestamp?: string): string {
  const ts = timestamp || new Date().toISOString();
  const content = `validation:${promotionId}:${gameId}:${ts}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

/**
 * Utility to generate idempotency key for evidence storage
 */
export function generateEvidenceIdempotencyKey(evidenceHash: string): string {
  return `evidence:${evidenceHash}`;
}

/**
 * Utility to generate idempotency key for notifications
 */
export function generateNotificationIdempotencyKey(
  triggerEventId: number, 
  notificationType: string, 
  userId?: string
): string {
  const userPart = userId ? `:${userId}` : '';
  const content = `notification:${triggerEventId}:${notificationType}${userPart}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

/**
 * Express middleware to log idempotency information
 */
export function logIdempotency(req: IdempotentRequest, res: Response, next: NextFunction): void {
  if (req.idempotencyKey) {
    console.log(`🔄 Idempotency: ${req.method} ${req.path} key=${req.idempotencyKey} retry=${req.isIdempotentRetry || false}`);
  }
  next();
}