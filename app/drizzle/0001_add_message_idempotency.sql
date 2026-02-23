-- Add idempotency and status tracking columns to conversation_messages
-- This enables:
-- 1. Duplicate message detection via channel_message_id
-- 2. Processing status tracking to prevent retry loops
-- 3. Reply linking to connect assistant responses to user messages

-- Create the message status enum
DO $$ BEGIN
    CREATE TYPE "public"."message_status" AS ENUM('pending', 'processing', 'completed', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns
ALTER TABLE "conversation_messages"
ADD COLUMN IF NOT EXISTS "channel_message_id" text;

ALTER TABLE "conversation_messages"
ADD COLUMN IF NOT EXISTS "reply_to_message_id" uuid;

ALTER TABLE "conversation_messages"
ADD COLUMN IF NOT EXISTS "status" "message_status" DEFAULT 'completed';

ALTER TABLE "conversation_messages"
ADD COLUMN IF NOT EXISTS "error_message" text;

ALTER TABLE "conversation_messages"
ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;

-- Create index for idempotency lookups
CREATE INDEX IF NOT EXISTS "idx_conv_msg_channel_id"
ON "conversation_messages" ("agent_id", "chat_id", "channel_message_id");

-- Create index for finding messages by status
CREATE INDEX IF NOT EXISTS "idx_conv_msg_status"
ON "conversation_messages" ("agent_id", "status");
