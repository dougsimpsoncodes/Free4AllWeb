/**
 * Evidence Canonicalization Utility
 * 
 * Provides deterministic JSON serialization for evidence integrity.
 * Ensures identical objects always produce identical hashes regardless
 * of property order, whitespace, or formatting differences.
 */

export interface CanonicalOptions {
  /** Sort object keys alphabetically (default: true) */
  sortKeys?: boolean;
  /** Remove unnecessary whitespace (default: true) */
  compact?: boolean;
  /** Handle undefined values (default: 'omit') */
  undefinedBehavior?: 'omit' | 'null' | 'preserve';
}

/**
 * Canonicalize any JavaScript value into a deterministic string representation
 */
export function canonicalize(value: any, options: CanonicalOptions = {}): string {
  const opts = {
    sortKeys: true,
    compact: true,
    undefinedBehavior: 'omit' as const,
    ...options
  };

  return canonicalizeValue(value, opts);
}

function canonicalizeValue(value: any, options: CanonicalOptions): string {
  // Handle primitives
  if (value === null) return 'null';
  if (value === undefined) {
    switch (options.undefinedBehavior) {
      case 'null': return 'null';
      case 'preserve': return 'undefined';
      case 'omit': 
      default: return ''; // Will be filtered out in objects/arrays
    }
  }
  
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') {
    // Handle special numeric values consistently
    if (Number.isNaN(value)) return 'null';
    if (!Number.isFinite(value)) {
      return value === Infinity ? '"Infinity"' : '"-Infinity"';
    }
    return value.toString();
  }
  
  if (typeof value === 'string') {
    return JSON.stringify(value); // Handles escaping
  }
  
  // Handle dates consistently (ISO string)
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    const items = value
      .map(item => canonicalizeValue(item, options))
      .filter(item => item !== ''); // Remove undefined/omitted values
    
    if (options.compact) {
      return `[${items.join(',')}]`;
    } else {
      return `[\n${items.map(item => `  ${item}`).join(',\n')}\n]`;
    }
  }
  
  // Handle objects
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([_, val]) => {
        // Filter out undefined values if omitting
        if (options.undefinedBehavior === 'omit' && val === undefined) {
          return false;
        }
        return true;
      })
      .map(([key, val]) => [key, canonicalizeValue(val, options)])
      .filter(([_, canonicalVal]) => canonicalVal !== ''); // Remove omitted values
    
    // Sort keys if requested
    if (options.sortKeys) {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }
    
    const pairs = entries.map(([key, val]) => `${JSON.stringify(key)}:${val}`);
    
    if (options.compact) {
      return `{${pairs.join(',')}}`;
    } else {
      return `{\n${pairs.map(pair => `  ${pair}`).join(',\n')}\n}`;
    }
  }
  
  // Fallback for other types (functions, symbols, etc.)
  return 'null';
}

/**
 * Canonicalize an evidence object specifically for promotion validation
 * 
 * This enforces strict canonicalization rules for legal/audit requirements:
 * - Sorted keys for deterministic ordering
 * - Compact formatting to reduce storage
 * - Omit undefined values to prevent ambiguity
 * - Consistent timestamp formatting
 */
export function canonicalizeEvidence(evidence: any): string {
  // Pre-process to ensure timestamps are in ISO format
  const processedEvidence = normalizeTimestamps(evidence);
  
  return canonicalize(processedEvidence, {
    sortKeys: true,
    compact: true,
    undefinedBehavior: 'omit'
  });
}

/**
 * Recursively normalize all timestamp fields to ISO strings
 */
function normalizeTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(normalizeTimestamps);
  }
  
  if (typeof obj === 'object') {
    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Common timestamp field patterns
      if (typeof value === 'string' && isTimestampField(key) && isISODateString(value)) {
        normalized[key] = new Date(value).toISOString();
      } else {
        normalized[key] = normalizeTimestamps(value);
      }
    }
    return normalized;
  }
  
  return obj;
}

/**
 * Check if a field name suggests it contains a timestamp
 */
function isTimestampField(fieldName: string): boolean {
  const timestampPatterns = [
    /time/i, /date/i, /at$/i, /timestamp/i, 
    /created/i, /updated/i, /modified/i, /occurred/i
  ];
  return timestampPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Check if a string looks like an ISO date
 */
function isISODateString(str: string): boolean {
  if (typeof str !== 'string') return false;
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoRegex.test(str) && !isNaN(Date.parse(str));
}

/**
 * Validate that two canonicalized strings represent the same evidence
 */
export function validateCanonicalEvidence(canonical1: string, canonical2: string): boolean {
  return canonical1 === canonical2;
}

/**
 * Parse canonicalized evidence back to object (for verification)
 */
export function parseCanonicalEvidence(canonical: string): any {
  try {
    return JSON.parse(canonical);
  } catch (error) {
    throw new Error(`Invalid canonical evidence format: ${error}`);
  }
}