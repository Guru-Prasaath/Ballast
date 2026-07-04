CREATE TYPE "public"."worker_status" AS ENUM('active', 'idle', 'draining', 'offline');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text NOT NULL,
	"pid" integer NOT NULL,
	"status" "worker_status" DEFAULT 'active' NOT NULL,
	"queues" text[] NOT NULL,
	"concurrency" integer NOT NULL,
	"in_flight" integer DEFAULT 0 NOT NULL,
	"version" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
