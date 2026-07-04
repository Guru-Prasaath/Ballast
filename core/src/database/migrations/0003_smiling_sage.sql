CREATE TYPE "public"."advisory_kind" AS ENUM('retry_tuning', 'flaky_detection', 'anomaly', 'capacity');--> statement-breakpoint
CREATE TYPE "public"."advisory_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "advisory_kind" NOT NULL,
	"severity" "advisory_severity" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"recommendation" text NOT NULL,
	"confidence" real NOT NULL,
	"job_id" uuid,
	"queue_id" uuid,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advisories" ADD CONSTRAINT "advisories_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advisories" ADD CONSTRAINT "advisories_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advisories" ADD CONSTRAINT "advisories_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
