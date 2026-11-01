-- WhatsApp + unpaid-order hold settings per company (decided by the platform / super admin)
ALTER TABLE companies
  ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN wa_events TEXT NULL,
  ADD COLUMN payment_hold_hours INT NOT NULL DEFAULT 24,
  ADD COLUMN auto_cancel_unpaid TINYINT(1) NOT NULL DEFAULT 0;

-- Platform branding (name, logo, icon, colour) shown in the super admin panel
CREATE TABLE IF NOT EXISTS platform_settings (
  k VARCHAR(50) PRIMARY KEY,
  v TEXT
);

-- Year-end archives: one row per archived year, the full copy of the company database lives in db_name
CREATE TABLE IF NOT EXISTS year_archives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  label VARCHAR(30) NOT NULL,
  db_name VARCHAR(64) NOT NULL,
  orders_count INT NOT NULL DEFAULT 0,
  sales_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  first_order_at DATETIME NULL,
  last_order_at DATETIME NULL,
  created_by VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_year_archives_company (company_id)
);
