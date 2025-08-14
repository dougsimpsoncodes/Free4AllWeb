/**
 * Evidence Hashing Utility
 * 
 * Provides cryptographically secure SHA-256 hashing for evidence integrity.
 * Ensures evidence tampering can be detected and provides audit trail.
 */

import crypto from 'crypto';
import { canonicalizeEvidence } from './canonicalize.ts';

export interface HashResult {
  /** SHA-256 hash in hexadecimal format */
  hash: string;
  /** The canonical string that was hashed */
  canonical: string;
  /** Timestamp when hash was computed */
  hashedAt: string;
  /** Algorithm used (always 'sha256') */
  algorithm: 'sha256';
}

export interface HashVerificationResult {
  /** Whether the hash is valid */
  isValid: boolean;
  /** Expected hash from the evidence */
  expectedHash: string;
  /** Actual hash computed from canonical form */
  actualHash: string;
  /** Any error message if verification failed */
  error?: string;
}

/**
 * Compute SHA-256 hash of evidence with canonical serialization
 */
export function hashEvidence(evidence: any): HashResult {
  const canonical = canonicalizeEvidence(evidence);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  
  return {
    hash,
    canonical,
    hashedAt: new Date().toISOString(),
    algorithm: 'sha256'
  };
}

/**
 * Verify that evidence matches the expected hash
 */
export function verifyEvidenceHash(evidence: any, expectedHash: string): HashVerificationResult {
  try {
    const result = hashEvidence(evidence);
    const isValid = result.hash === expectedHash;
    
    return {
      isValid,
      expectedHash,
      actualHash: result.hash,
      error: isValid ? undefined : 'Hash mismatch - evidence may have been tampered with'
    };
  } catch (error) {
    return {
      isValid: false,
      expectedHash,
      actualHash: '',
      error: `Hash verification failed: ${error}`
    };
  }
}

/**
 * Create a hash chain for multiple pieces of evidence
 * Useful for linking related evidence together
 */
export function createHashChain(evidenceList: any[]): string {
  const hashes = evidenceList.map(evidence => hashEvidence(evidence).hash);
  const chainString = hashes.join('|');
  return crypto.createHash('sha256').update(chainString, 'utf8').digest('hex');
}

/**
 * Verify an entire hash chain
 */
export function verifyHashChain(evidenceList: any[], expectedChainHash: string): HashVerificationResult {
  try {
    const actualChainHash = createHashChain(evidenceList);
    const isValid = actualChainHash === expectedChainHash;
    
    return {
      isValid,
      expectedHash: expectedChainHash,
      actualHash: actualChainHash,
      error: isValid ? undefined : 'Hash chain verification failed'
    };
  } catch (error) {
    return {
      isValid: false,
      expectedHash: expectedChainHash,
      actualHash: '',
      error: `Hash chain verification error: ${error}`
    };
  }
}

/**
 * Generate a cryptographically secure random salt
 * Used for additional security in sensitive evidence
 */
export function generateSalt(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash evidence with a salt for additional security
 * The salt should be stored separately from the hash
 */
export function hashEvidenceWithSalt(evidence: any, salt: string): HashResult {
  const canonical = canonicalizeEvidence(evidence);
  const saltedContent = canonical + salt;
  const hash = crypto.createHash('sha256').update(saltedContent, 'utf8').digest('hex');
  
  return {
    hash,
    canonical,
    hashedAt: new Date().toISOString(),
    algorithm: 'sha256'
  };
}

/**
 * Verify evidence with salt
 */
export function verifyEvidenceHashWithSalt(
  evidence: any, 
  expectedHash: string, 
  salt: string
): HashVerificationResult {
  try {
    const result = hashEvidenceWithSalt(evidence, salt);
    const isValid = result.hash === expectedHash;
    
    return {
      isValid,
      expectedHash,
      actualHash: result.hash,
      error: isValid ? undefined : 'Salted hash mismatch - evidence may have been tampered with'
    };
  } catch (error) {
    return {
      isValid: false,
      expectedHash,
      actualHash: '',
      error: `Salted hash verification failed: ${error}`
    };
  }
}

/**
 * Create a timestamped hash with monotonic guarantee
 * Includes high-resolution timestamp to prevent replay attacks
 */
export function createTimestampedHash(evidence: any): HashResult & { nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString();
  const hrTime = process.hrtime.bigint().toString();
  
  // Include nonce and high-res time in canonical form
  const enhancedEvidence = {
    ...evidence,
    _integrity: {
      nonce,
      timestamp,
      hrTime
    }
  };
  
  const result = hashEvidence(enhancedEvidence);
  
  return {
    ...result,
    nonce
  };
}

/**
 * Utility to extract hash from stored evidence format
 */
export function extractStoredHash(storedEvidence: any): string | null {
  // Handle different storage formats
  if (typeof storedEvidence === 'string') {
    try {
      const parsed = JSON.parse(storedEvidence);
      return parsed.integrity?.hash || parsed.hash || null;
    } catch {
      return null;
    }
  }
  
  if (typeof storedEvidence === 'object' && storedEvidence !== null) {
    return storedEvidence.integrity?.hash || storedEvidence.hash || null;
  }
  
  return null;
}

/**
 * Validate hash format (must be 64-character hex string for SHA-256)
 */
export function isValidHashFormat(hash: string): boolean {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Create evidence integrity metadata
 */
export function createEvidenceIntegrity(evidence: any): {
  hash: string;
  canonical: string;
  algorithm: string;
  hashedAt: string;
  version: string;
} {
  const result = hashEvidence(evidence);
  
  return {
    hash: result.hash,
    canonical: result.canonical,
    algorithm: result.algorithm,
    hashedAt: result.hashedAt,
    version: '1.0' // For future integrity format versioning
  };
}