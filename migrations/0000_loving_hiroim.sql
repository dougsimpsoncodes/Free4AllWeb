CREATE TABLE "alert_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"triggered_deal_id" integer,
	"alert_type" varchar(20) NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"status" varchar(20) DEFAULT 'sent'
);
--> statement-breakpoint
CREATE TABLE "alert_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"team_id" integer,
	"restaurant_id" integer,
	"email_alerts" boolean DEFAULT true,
	"sms_alerts" boolean DEFAULT false,
	"alert_timing" varchar(50) DEFAULT 'immediate',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "deal_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(300) NOT NULL,
	"restaurant" varchar(100) NOT NULL,
	"offer_description" text NOT NULL,
	"trigger_condition" varchar(200) NOT NULL,
	"deal_value" varchar(100),
	"promo_code" varchar(50),
	"instructions" text,
	"terms" text,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true,
	"source_url" text,
	"image_url" text,
	"discovered_site_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deal_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"device_token" varchar(200) NOT NULL,
	"platform" varchar(10) NOT NULL,
	"device_info" jsonb,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "device_tokens_device_token_unique" UNIQUE("device_token")
);
--> statement-breakpoint
CREATE TABLE "discovered_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"source_id" integer,
	"search_term_id" integer,
	"title" text,
	"content" text,
	"raw_data" text,
	"found_at" timestamp DEFAULT now(),
	"confidence" numeric(3, 2),
	"status" varchar(20) DEFAULT 'pending',
	"deal_extracted" text,
	"restaurant_detected" varchar(100),
	"team_detected" varchar(100),
	"trigger_detected" varchar(200),
	"promo_code_detected" varchar(50),
	"image_extracted" text,
	"expiration_detected" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "discovery_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"base_url" varchar(200) NOT NULL,
	"search_endpoint" varchar(200),
	"api_key" varchar(200),
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 5,
	"rate_limit" integer DEFAULT 100,
	"last_checked" timestamp,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"opponent" varchar(100) NOT NULL,
	"game_date" timestamp NOT NULL,
	"is_home" boolean DEFAULT true,
	"team_score" integer,
	"opponent_score" integer,
	"is_complete" boolean DEFAULT false,
	"game_stats" jsonb,
	"external_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"api_provider" varchar(50),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "leagues_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "promotion_trigger_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"external_event_id" varchar(100),
	"occurred_at" timestamp NOT NULL,
	"redeem_window_start_at" timestamp NOT NULL,
	"redeem_window_end_at" timestamp NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"restaurant_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text,
	"offer_value" varchar(100),
	"trigger_condition" varchar(200) NOT NULL,
	"redemption_instructions" text,
	"promo_code" varchar(50),
	"valid_until" date,
	"is_active" boolean DEFAULT true,
	"is_seasonal" boolean DEFAULT false,
	"source" varchar(50) DEFAULT 'manual',
	"discovery_data" jsonb,
	"approval_status" varchar(20) DEFAULT 'approved',
	"approved_by" varchar(100),
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"state" varchar(20) DEFAULT 'approved',
	"source_fingerprint" varchar(64),
	"source_url" text,
	"discovered_site_id" integer,
	"trigger_conditions" jsonb,
	"redemption_details" jsonb,
	"validation_status" varchar(20) DEFAULT 'pending',
	"validation_data" jsonb,
	"notification_data" jsonb,
	CONSTRAINT "promotions_source_fingerprint_unique" UNIQUE("source_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"logo_url" varchar,
	"website" varchar,
	"app_store_url" varchar,
	"play_store_url" varchar,
	"primary_color" varchar(7),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "restaurants_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "search_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer,
	"team_id" integer,
	"term" varchar(200) NOT NULL,
	"category" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true,
	"success_rate" numeric(3, 2) DEFAULT '0.00',
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"city" varchar(100),
	"league_id" integer,
	"external_id" varchar(50),
	"logo_url" varchar,
	"primary_color" varchar(7),
	"sport" varchar(20) NOT NULL,
	"conference" varchar(50),
	"division" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "triggered_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer,
	"deal_page_id" integer,
	"game_id" integer,
	"triggered_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"city" varchar(100),
	"zip_code" varchar(10),
	"phone_number" varchar(20),
	"role" varchar(20) DEFAULT 'user',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_triggered_deal_id_triggered_deals_id_fk" FOREIGN KEY ("triggered_deal_id") REFERENCES "public"."triggered_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_pages" ADD CONSTRAINT "deal_pages_discovered_site_id_discovered_sites_id_fk" FOREIGN KEY ("discovered_site_id") REFERENCES "public"."discovered_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_sites" ADD CONSTRAINT "discovered_sites_source_id_discovery_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."discovery_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_sites" ADD CONSTRAINT "discovered_sites_search_term_id_search_terms_id_fk" FOREIGN KEY ("search_term_id") REFERENCES "public"."search_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_sites" ADD CONSTRAINT "discovered_sites_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_trigger_events" ADD CONSTRAINT "promotion_trigger_events_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_discovered_site_id_discovered_sites_id_fk" FOREIGN KEY ("discovered_site_id") REFERENCES "public"."discovered_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_terms" ADD CONSTRAINT "search_terms_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_terms" ADD CONSTRAINT "search_terms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggered_deals" ADD CONSTRAINT "triggered_deals_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggered_deals" ADD CONSTRAINT "triggered_deals_deal_page_id_deal_pages_id_fk" FOREIGN KEY ("deal_page_id") REFERENCES "public"."deal_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggered_deals" ADD CONSTRAINT "triggered_deals_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_tokens_user" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_active" ON "device_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_device_tokens_platform" ON "device_tokens" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_games_team_id" ON "games" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_games_game_date" ON "games" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "idx_games_is_complete" ON "games" USING btree ("is_complete");--> statement-breakpoint
CREATE INDEX "idx_games_team_date" ON "games" USING btree ("team_id","game_date");--> statement-breakpoint
CREATE INDEX "idx_trigger_events_promotion" ON "promotion_trigger_events" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "idx_trigger_events_window" ON "promotion_trigger_events" USING btree ("redeem_window_end_at");--> statement-breakpoint
CREATE INDEX "idx_trigger_events_external" ON "promotion_trigger_events" USING btree ("external_event_id");--> statement-breakpoint
CREATE INDEX "idx_trigger_events_unique" ON "promotion_trigger_events" USING btree ("promotion_id","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_promotions_active" ON "promotions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_promotions_state" ON "promotions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_promotions_validation_status" ON "promotions" USING btree ("validation_status");--> statement-breakpoint
CREATE INDEX "idx_restaurants_is_active" ON "restaurants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_teams_is_active" ON "teams" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_teams_league_id" ON "teams" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "idx_teams_sport" ON "teams" USING btree ("sport");--> statement-breakpoint
CREATE INDEX "idx_triggered_deals_is_active" ON "triggered_deals" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_triggered_deals_triggered_at" ON "triggered_deals" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_triggered_deals_promotion_id" ON "triggered_deals" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "idx_triggered_deals_game_id" ON "triggered_deals" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_triggered_deals_active_triggered" ON "triggered_deals" USING btree ("is_active","triggered_at");