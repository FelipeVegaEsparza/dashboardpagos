-- Users table for authentication
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

-- Insert default admin (password: admin123 - change immediately!)
-- Hash generated with: php -r "echo password_hash('admin123', PASSWORD_BCRYPT, ['cost' => 12]);"
INSERT INTO users (username, password_hash, email, role) 
VALUES ('admin', '$2y$12$rvgurMxqt1cNXXeDCkV6IewhN2.oaglBSIYyh8THTeW89R/B9m1ZS', 'admin@example.com', 'admin')
ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    product_id INT NOT NULL,
    start_date DATE NOT NULL,
    next_payment_date DATE NOT NULL,
    status ENUM('active', 'cancelled', 'paused') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Token refresh table for secure token rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash
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

-- Indexes for better performance
ALTER TABLE subscriptions ADD INDEX idx_client_id (client_id);
ALTER TABLE subscriptions ADD INDEX idx_product_id (product_id);
ALTER TABLE subscriptions ADD INDEX idx_status (status);
ALTER TABLE subscriptions ADD INDEX idx_next_payment (next_payment_date);
ALTER TABLE products ADD INDEX idx_service_id (service_id);
ALTER TABLE payments ADD INDEX idx_subscription_id (subscription_id);
