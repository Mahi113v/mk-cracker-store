-- Speeds up daily / weekly / monthly / yearly reports
CREATE INDEX idx_orders_created ON orders (created_at, status);
CREATE INDEX idx_movements_created ON stock_movements (created_at);
CREATE INDEX idx_movements_product_date ON stock_movements (product_id, created_at);
