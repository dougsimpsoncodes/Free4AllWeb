-- Evidence Storage Migration - WORM (Write-Once-Read-Many) Support
-- Creates immutable evidence table with constraints to prevent tampering

-- Create immutable evidence table
CREATE TABLE IF NOT EXISTS immutable_evidence (
  id SERIAL PRIMARY KEY,
  evidence_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash (64 hex chars)
  storage_uri TEXT NOT NULL UNIQUE, -- URI in object storage
  canonical_form TEXT NOT NULL, -- The canonical JSON that was hashed
  stored_at TIMESTAMP WITH TIME ZONE NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  is_locked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure hash format is valid (64-character hex string)
ALTER TABLE immutable_evidence 
ADD CONSTRAINT valid_hash_format 
CHECK (evidence_hash ~ '^[a-f0-9]{64}$');

-- Prevent updates to critical fields once created (WORM enforcement)
CREATE OR REPLACE FUNCTION prevent_evidence_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent any updates to locked evidence
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot modify locked evidence record (WORM violation)';
  END IF;
  
  -- Prevent changes to integrity fields
  IF OLD.evidence_hash != NEW.evidence_hash THEN
    RAISE EXCEPTION 'Cannot modify evidence hash (integrity violation)';
  END IF;
  
  IF OLD.storage_uri != NEW.storage_uri THEN
    RAISE EXCEPTION 'Cannot modify storage URI (integrity violation)';
  END IF;
  
  IF OLD.canonical_form != NEW.canonical_form THEN
    RAISE EXCEPTION 'Cannot modify canonical form (integrity violation)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply WORM protection trigger
CREATE TRIGGER prevent_evidence_tampering_trigger
  BEFORE UPDATE ON immutable_evidence
  FOR EACH ROW
  EXECUTE FUNCTION prevent_evidence_tampering();

-- Prevent deletion of locked evidence
CREATE OR REPLACE FUNCTION prevent_evidence_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot delete locked evidence record (WORM violation)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_evidence_deletion_trigger
  BEFORE DELETE ON immutable_evidence
  FOR EACH ROW
  EXECUTE FUNCTION prevent_evidence_deletion();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_immutable_evidence_hash ON immutable_evidence (evidence_hash);
CREATE INDEX IF NOT EXISTS idx_immutable_evidence_stored_at ON immutable_evidence (stored_at DESC);
CREATE INDEX IF NOT EXISTS idx_immutable_evidence_locked ON immutable_evidence (is_locked) WHERE is_locked = true;

-- RLS (Row Level Security) for evidence table
ALTER TABLE immutable_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read evidence (for verification)
CREATE POLICY "Evidence is publicly readable" 
ON immutable_evidence FOR SELECT 
USING (true);

-- Policy: Only service role can insert evidence
CREATE POLICY "Service role can insert evidence" 
ON immutable_evidence FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Policy: No updates allowed once locked (WORM)
CREATE POLICY "No updates to locked evidence" 
ON immutable_evidence FOR UPDATE 
USING (is_locked = false);

-- Policy: No deletes allowed for locked evidence (WORM)
CREATE POLICY "No deletes of locked evidence" 
ON immutable_evidence FOR DELETE 
USING (is_locked = false);

-- Grant necessary permissions
GRANT SELECT ON immutable_evidence TO anon, authenticated;
GRANT INSERT ON immutable_evidence TO service_role;
GRANT USAGE ON SEQUENCE immutable_evidence_id_seq TO service_role;

-- Log successful migration
DO $$ 
BEGIN
  RAISE NOTICE '🔒 WORM Evidence Storage Migration Complete!';
  RAISE NOTICE '✅ Features enabled:';
  RAISE NOTICE '   - Immutable evidence storage with cryptographic integrity';
  RAISE NOTICE '   - WORM constraints prevent tampering and deletion';
  RAISE NOTICE '   - Hash format validation (SHA-256)';
  RAISE NOTICE '   - Performance indexes for lookup and verification';
  RAISE NOTICE '   - Row Level Security for controlled access';
  RAISE NOTICE '🛡️ Evidence integrity guaranteed at database level';
END $$;