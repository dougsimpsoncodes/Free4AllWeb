CREATE TABLE "immutable_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"evidence_hash" varchar(64) NOT NULL,
	"storage_uri" varchar(500) NOT NULL,
	"canonical_form" text NOT NULL,
	"stored_at" timestamp DEFAULT now() NOT NULL,
	"size_bytes" integer NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "immutable_evidence_evidence_hash_unique" UNIQUE("evidence_hash")
);
--> statement-breakpoint
CREATE INDEX "idx_immutable_evidence_hash" ON "immutable_evidence" USING btree ("evidence_hash");--> statement-breakpoint
CREATE INDEX "idx_immutable_evidence_stored_at" ON "immutable_evidence" USING btree ("stored_at");