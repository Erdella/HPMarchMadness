CREATE TABLE "teams" (
	"id" text NOT NULL,
	"year" integer NOT NULL,
	"seed" integer NOT NULL,
	"region" text NOT NULL,
	"side" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_year_id_pk" PRIMARY KEY("year","id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "teams_year_region_seed_unique" ON "teams" USING btree ("year","region","seed");--> statement-breakpoint
CREATE INDEX "teams_year_idx" ON "teams" USING btree ("year");
