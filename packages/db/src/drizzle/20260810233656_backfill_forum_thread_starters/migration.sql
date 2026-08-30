-- Discord forum starter messages share their ID with the thread channel ID.
UPDATE "db_message"
SET "starter_message" = true
WHERE "starter_message" = false
	AND "primary_channel_id" IS NOT NULL
	AND "id" = "primary_channel_id";
