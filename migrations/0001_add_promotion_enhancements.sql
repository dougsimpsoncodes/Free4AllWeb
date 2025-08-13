-- Add new columns to promotions table
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "state" varchar(20) DEFAULT 'approved';
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "source_fingerprint" varchar(64);
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "discovered_site_id" integer;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "trigger_conditions" jsonb;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "redemption_details" jsonb;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "validation_status" varchar(20) DEFAULT 'pending';
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "validation_data" jsonb;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "notification_data" jsonb;

-- Add constraints (skip if they already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_source_fingerprint_unique') THEN
        ALTER TABLE "promotions" ADD CONSTRAINT "promotions_source_fingerprint_unique" UNIQUE("source_fingerprint");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_discovered_site_id_discovered_sites_id_fk') THEN
        ALTER TABLE "promotions" ADD CONSTRAINT "promotions_discovered_site_id_discovered_sites_id_fk" FOREIGN KEY ("discovered_site_id") REFERENCES "public"."discovered_sites"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END
$$;

-- Add indexes  
CREATE INDEX IF NOT EXISTS "idx_promotions_state" ON "promotions" USING btree ("state");
CREATE INDEX IF NOT EXISTS "idx_promotions_validation_status" ON "promotions" USING btree ("validation_status");

-- Create promotion trigger events table
CREATE TABLE IF NOT EXISTS "promotion_trigger_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"external_event_id" varchar(100),
	"occurred_at" timestamp NOT NULL,
	"redeem_window_start_at" timestamp NOT NULL,
	"redeem_window_end_at" timestamp NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraint for trigger events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_trigger_events_promotion_id_promotions_id_fk') THEN
        ALTER TABLE "promotion_trigger_events" ADD CONSTRAINT "promotion_trigger_events_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END
$$;

-- Add indexes for trigger events
CREATE INDEX IF NOT EXISTS "idx_trigger_events_promotion" ON "promotion_trigger_events" USING btree ("promotion_id");
CREATE INDEX IF NOT EXISTS "idx_trigger_events_window" ON "promotion_trigger_events" USING btree ("redeem_window_end_at");
CREATE INDEX IF NOT EXISTS "idx_trigger_events_external" ON "promotion_trigger_events" USING btree ("external_event_id");
CREATE INDEX IF NOT EXISTS "idx_trigger_events_unique" ON "promotion_trigger_events" USING btree ("promotion_id","external_event_id");