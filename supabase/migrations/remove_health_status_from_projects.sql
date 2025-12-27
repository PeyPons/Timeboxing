-- Remove health_status column from projects table
-- This field is no longer used in the application

ALTER TABLE projects DROP COLUMN IF EXISTS health_status;
