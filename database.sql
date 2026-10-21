DROP DATABASE IF EXISTS inventory_management;
CREATE DATABASE inventory_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_management;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(20) UNIQUE NOT NULL,
  supplier_name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_code VARCHAR(20) UNIQUE NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  unit_cost DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  current_stock INT NOT NULL DEFAULT 0,
  opening_quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_no VARCHAR(20) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  recorded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_no VARCHAR(20) UNIQUE NOT NULL,
  sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10,2) DEFAULT 0,
  sold_by INT,
  customer_name VARCHAR(100)
);

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM('opening','purchase','sale','adjustment') NOT NULL,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reference_no VARCHAR(50),
  moved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id VARCHAR(50),
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone) VALUES ('SUP001','Kigezi General Suppliers','Mr. Mwesigye','0772123456');