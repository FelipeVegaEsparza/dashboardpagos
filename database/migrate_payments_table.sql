-- Migration: Add missing columns to payments table
-- This fixes the 500 errors when fetching payments

-- Add receipt_url column if it doesn't exist
SET @exist := (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE()
    AND table_name = 'payments' 
    AND column_name = 'receipt_url'
);

SET @sql := IF(@exist = 0, 
    'ALTER TABLE payments ADD COLUMN receipt_url VARCHAR(500) NULL',
    'SELECT "Column receipt_url already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_at column if it doesn't exist
SET @exist2 := (
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = DATABASE()
    AND table_name = 'payments' 
    AND column_name = 'created_at'
);

SET @sql2 := IF(@exist2 = 0, 
    'ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'SELECT "Column created_at already exists" as message'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Add index on subscription_id if it doesn't exist
SET @exist3 := (
    SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE()
    AND table_name = 'payments' 
    AND index_name = 'idx_subscription_id'
);

SET @sql3 := IF(@exist3 = 0, 
    'ALTER TABLE payments ADD INDEX idx_subscription_id (subscription_id)',
    'SELECT "Index idx_subscription_id already exists" as message'
);

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SELECT 'Migration completed successfully' as result;
