-- Runs inside every company database. {{CID}} = company id from the master DB.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role ENUM('company_admin','staff','user') NOT NULL DEFAULT 'user',
  permissions TEXT NULL,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  name VARCHAR(100) NOT NULL UNIQUE,
  image VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  brand_id INT NULL,
  category_id INT NULL,
  pack VARCHAR(50),
  mrp DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(mrp * (100 - discount_percent) / 100, 0)) STORED,
  stock INT NOT NULL DEFAULT 0,
  low_stock_level INT NOT NULL DEFAULT 10,
  description TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  product_id INT NOT NULL,
  path VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  product_id INT NOT NULL,
  type ENUM('IN','OUT','SET','ORDER','CANCEL') NOT NULL,
  qty INT NOT NULL,
  balance INT NOT NULL,
  reason VARCHAR(255),
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  order_no VARCHAR(30) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  status ENUM('unpaid','pending_verification','paid','delivered','cancelled') NOT NULL DEFAULT 'unpaid',
  payment_proof VARCHAR(255),
  payment_note VARCHAR(255),
  admin_note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  order_id INT NOT NULL,
  product_id INT NULL,
  code VARCHAR(50),
  name VARCHAR(200) NOT NULL,
  pack VARCHAR(50),
  mrp DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  qty INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(50) PRIMARY KEY,
  company_id INT NOT NULL DEFAULT {{CID}},
  v TEXT
);
