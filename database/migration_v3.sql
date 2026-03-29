-- Migration v3: Add project_name to subscriptions
-- Run this if you have an existing database without the project_name column

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) AFTER product_id;
