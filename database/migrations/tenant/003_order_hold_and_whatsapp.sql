-- Unpaid orders keep stock reserved until hold_until (reminders + optional auto-cancel use it)
ALTER TABLE orders ADD COLUMN hold_until DATETIME NULL;
CREATE INDEX idx_orders_hold ON orders (status, hold_until);

-- Every WhatsApp message attempt (also used so a reminder is sent only once per order)
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  order_id INT NULL,
  event VARCHAR(30) NOT NULL,
  phone VARCHAR(20) NULL,
  status ENUM('sent','failed','skipped') NOT NULL,
  provider VARCHAR(20) NULL,
  error VARCHAR(255) NULL,
  message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_wa_order_event (order_id, event)
);
