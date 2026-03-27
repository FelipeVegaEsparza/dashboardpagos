-- Migration v2: Add authentication tables
-- Run this if you have an existing database without the users table

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default admin user (password: admin123)
-- IMPORTANT: Change this password after first login!
-- Hash: php -r "echo password_hash('admin123', PASSWORD_BCRYPT, ['cost' => 12]);"
INSERT INTO users (username, password_hash, email, role) 
VALUES ('admin', '$2y$12$rvgurMxqt1cNXXeDCkV6IewhN2.oaglBSIYyh8THTeW89R/B9m1ZS', 'admin@example.com', 'admin')
ON DUPLICATE KEY UPDATE id=id;

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires (expires_at)
);

-- Application settings table
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type ENUM('string', 'text', 'image', 'boolean', 'number') DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Default settings
INSERT INTO settings (setting_key, setting_value, setting_type) VALUES
    ('app_name', 'Payments Dashboard', 'string'),
    ('app_description', 'Sistema de gestión de suscripciones y pagos', 'text'),
    ('app_logo', NULL, 'image'),
    ('app_favicon', NULL, 'image')
ON DUPLICATE KEY UPDATE id=id;

-- Add indexes to existing tables for better performance
ALTER TABLE subscriptions ADD INDEX idx_client_id (client_id);
ALTER TABLE subscriptions ADD INDEX idx_product_id (product_id);
ALTER TABLE subscriptions ADD INDEX idx_status (status);
ALTER TABLE subscriptions ADD INDEX idx_next_payment (next_payment_date);
ALTER TABLE products ADD INDEX idx_service_id (service_id);
ALTER TABLE payments ADD INDEX idx_subscription_id (subscription_id);
