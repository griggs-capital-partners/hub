ALTER TABLE "user_notification_settings"
ALTER COLUMN "agentExecutionPush" SET DEFAULT true;

UPDATE "user_notification_settings"
SET "agentExecutionPush" = true
WHERE "agentExecutionPush" = false;
