CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  db_name VARCHAR(64) NOT NULL UNIQUE,
  design ENUM('default','normal','current') NOT NULL DEFAULT 'normal',
  brand_color VARCHAR(9) NOT NULL DEFAULT '#e11d48',
  features TEXT,
  status ENUM('active','blocked','provisioning') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
