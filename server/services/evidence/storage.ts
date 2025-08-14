/**
 * Evidence Storage Service
 * 
 * Provides Write-Once-Read-Many (WORM) storage for evidence with cryptographic integrity.
 * Uses Supabase Storage with additional DB constraints to ensure immutability.
 */

import { createClient } from '@supabase/supabase-js';
import { hashEvidence, verifyEvidenceHash, createEvidenceIntegrity, isValidHashFormat } from './hash.ts';
import { canonicalizeEvidence } from './canonicalize.ts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface StorageResult {
  /** Unique storage URI for the evidence */
  uri: string;
  /** SHA-256 hash of the stored evidence */
  hash: string;
  /** Version ID from object storage (if supported) */
  versionId?: string;
  /** Timestamp when evidence was stored */
  storedAt: string;
  /** Size of stored evidence in bytes */
  size: number;
}

export interface StorageVerificationResult {
  /** Whether the stored evidence matches the expected hash */
  isValid: boolean;
  /** The evidence retrieved from storage */
  evidence?: any;
  /** Hash verification details */
  hashVerification: {
    expected: string;
    actual: string;
    matches: boolean;
  };
  /** Storage metadata */
  metadata?: {
    storedAt: string;
    size: number;
    uri: string;
  };
  /** Error message if verification failed */
  error?: string;
}

export interface ImmutableEvidenceRecord {
  id: number;
  evidence_hash: string;
  storage_uri: string;
  canonical_form: string;
  stored_at: string;
  size_bytes: number;
  is_locked: boolean;
  created_at: string;
}

/**
 * Store evidence immutably with WORM semantics
 */
export async function putImmutable(evidence: any): Promise<StorageResult> {
  // Generate integrity data
  const integrity = createEvidenceIntegrity(evidence);
  const timestamp = new Date().toISOString();
  
  // Create storage path with hash for deduplication
  const storagePath = `evidence/${timestamp.slice(0, 10)}/${integrity.hash}.json`;
  
  try {
    // Store the canonical form in Supabase Storage
    const canonicalBlob = new Blob([integrity.canonical], { type: 'application/json' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(storagePath, canonicalBlob, {
        cacheControl: '31536000', // 1 year cache
        upsert: false, // Prevent overwriting
        duplex: 'half'
      });

    if (uploadError) {
      // If file already exists, that's okay for identical evidence
      if (uploadError.message.includes('already exists') || uploadError.message.includes('duplicate')) {
        // Verify it's the same evidence
        const existingVerification = await verifyStored(storagePath, integrity.hash);
        if (existingVerification.isValid) {
          return {
            uri: storagePath,
            hash: integrity.hash,
            storedAt: timestamp,
            size: canonicalBlob.size
          };
        }
      }
      throw new Error(`Failed to upload evidence: ${uploadError.message}`);
    }

    // Create immutable database record
    const dbRecord = await createImmutableRecord(
      integrity.hash,
      storagePath,
      integrity.canonical,
      canonicalBlob.size
    );

    return {
      uri: storagePath,
      hash: integrity.hash,
      versionId: uploadData?.id,
      storedAt: timestamp,
      size: canonicalBlob.size
    };

  } catch (error) {
    throw new Error(`Failed to store evidence immutably: ${error}`);
  }
}

/**
 * Verify stored evidence against expected hash
 */
export async function verifyStored(uri: string, expectedHash: string): Promise<StorageVerificationResult> {
  try {
    // Validate hash format
    if (!isValidHashFormat(expectedHash)) {
      return {
        isValid: false,
        hashVerification: { expected: expectedHash, actual: '', matches: false },
        error: 'Invalid hash format'
      };
    }

    // Download evidence from storage
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('evidence')
      .download(uri);

    if (downloadError) {
      return {
        isValid: false,
        hashVerification: { expected: expectedHash, actual: '', matches: false },
        error: `Failed to download evidence: ${downloadError.message}`
      };
    }

    // Parse the canonical form back to evidence object
    const canonicalText = await downloadData.text();
    const evidence = JSON.parse(canonicalText);

    // Verify hash
    const verification = verifyEvidenceHash(evidence, expectedHash);

    // Get storage metadata
    const metadata = await getStorageMetadata(uri);

    return {
      isValid: verification.isValid,
      evidence,
      hashVerification: {
        expected: expectedHash,
        actual: verification.actualHash,
        matches: verification.isValid
      },
      metadata,
      error: verification.error
    };

  } catch (error) {
    return {
      isValid: false,
      hashVerification: { expected: expectedHash, actual: '', matches: false },
      error: `Verification failed: ${error}`
    };
  }
}

/**
 * Get metadata about stored evidence
 */
async function getStorageMetadata(uri: string): Promise<{ storedAt: string; size: number; uri: string } | undefined> {
  try {
    const { data, error } = await supabase.storage
      .from('evidence')
      .list(uri.substring(0, uri.lastIndexOf('/')), {
        search: uri.substring(uri.lastIndexOf('/') + 1)
      });

    if (error || !data || data.length === 0) {
      return undefined;
    }

    const file = data[0];
    return {
      storedAt: file.created_at,
      size: file.metadata?.size || 0,
      uri
    };
  } catch {
    return undefined;
  }
}

/**
 * Create immutable database record with constraints
 */
async function createImmutableRecord(
  hash: string,
  uri: string,
  canonical: string,
  size: number
): Promise<ImmutableEvidenceRecord> {
  
  const { data, error } = await supabase
    .from('immutable_evidence')
    .insert({
      evidence_hash: hash,
      storage_uri: uri,
      canonical_form: canonical,
      size_bytes: size,
      is_locked: true,
      stored_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate hash (evidence already stored)
    if (error.code === '23505') { // Unique constraint violation
      const { data: existingData, error: selectError } = await supabase
        .from('immutable_evidence')
        .select('*')
        .eq('evidence_hash', hash)
        .single();

      if (selectError) {
        throw new Error(`Failed to retrieve existing evidence record: ${selectError.message}`);
      }

      return existingData;
    }
    throw new Error(`Failed to create immutable evidence record: ${error.message}`);
  }

  return data;
}

/**
 * List stored evidence with optional filtering
 */
export async function listStoredEvidence(options: {
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
} = {}): Promise<ImmutableEvidenceRecord[]> {
  let query = supabase
    .from('immutable_evidence')
    .select('*')
    .eq('is_locked', true)
    .order('stored_at', { ascending: false });

  if (options.fromDate) {
    query = query.gte('stored_at', options.fromDate);
  }

  if (options.toDate) {
    query = query.lte('stored_at', options.toDate);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, (options.offset || 0) + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list stored evidence: ${error.message}`);
  }

  return data || [];
}

/**
 * Get evidence by hash
 */
export async function getEvidenceByHash(hash: string): Promise<StorageVerificationResult> {
  if (!isValidHashFormat(hash)) {
    return {
      isValid: false,
      hashVerification: { expected: hash, actual: '', matches: false },
      error: 'Invalid hash format'
    };
  }

  try {
    // Find the record in database
    const { data: record, error: dbError } = await supabase
      .from('immutable_evidence')
      .select('*')
      .eq('evidence_hash', hash)
      .single();

    if (dbError || !record) {
      return {
        isValid: false,
        hashVerification: { expected: hash, actual: '', matches: false },
        error: 'Evidence not found in database'
      };
    }

    // Verify against storage
    return await verifyStored(record.storage_uri, hash);

  } catch (error) {
    return {
      isValid: false,
      hashVerification: { expected: hash, actual: '', matches: false },
      error: `Failed to retrieve evidence: ${error}`
    };
  }
}

/**
 * Check storage health and integrity
 */
export async function checkStorageHealth(): Promise<{
  isHealthy: boolean;
  statistics: {
    totalRecords: number;
    totalSize: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  };
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Get storage statistics
    const { data: stats, error: statsError } = await supabase
      .from('immutable_evidence')
      .select('evidence_hash, size_bytes, stored_at')
      .eq('is_locked', true);

    if (statsError) {
      issues.push(`Database query failed: ${statsError.message}`);
    }

    const totalRecords = stats?.length || 0;
    const totalSize = stats?.reduce((sum, record) => sum + (record.size_bytes || 0), 0) || 0;
    const oldestRecord = stats?.length ? stats[stats.length - 1].stored_at : null;
    const newestRecord = stats?.length ? stats[0].stored_at : null;

    // Sample verification of recent records
    if (stats && stats.length > 0) {
      const sampleSize = Math.min(5, stats.length);
      const sampleRecords = stats.slice(0, sampleSize);

      for (const record of sampleRecords) {
        const verification = await getEvidenceByHash(record.evidence_hash);
        if (!verification.isValid) {
          issues.push(`Integrity check failed for hash ${record.evidence_hash}: ${verification.error}`);
        }
      }
    }

    return {
      isHealthy: issues.length === 0,
      statistics: {
        totalRecords,
        totalSize,
        oldestRecord,
        newestRecord
      },
      issues
    };

  } catch (error) {
    return {
      isHealthy: false,
      statistics: { totalRecords: 0, totalSize: 0, oldestRecord: null, newestRecord: null },
      issues: [`Health check failed: ${error}`]
    };
  }
}

/**
 * Initialize storage service (create buckets, etc.)
 */
export async function initializeStorage(): Promise<void> {
  try {
    // Ensure evidence bucket exists
    const { error: bucketError } = await supabase.storage.createBucket('evidence', {
      public: false,
      allowedMimeTypes: ['application/json'],
      fileSizeLimit: 10 * 1024 * 1024 // 10MB limit
    });

    // Ignore error if bucket already exists
    if (bucketError && !bucketError.message.includes('already exists')) {
      throw new Error(`Failed to create evidence bucket: ${bucketError.message}`);
    }

    console.log('✅ Evidence storage initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize evidence storage:', error);
    throw error;
  }
}