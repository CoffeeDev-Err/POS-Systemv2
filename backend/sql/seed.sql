USE pos_system_v2;

INSERT INTO categories (id, name) VALUES
  (1, 'Eggs'),
  (2, 'Mantika'),
  (3, 'Daily Needs');

INSERT INTO users (id, name, username, password, role, active, created_at) VALUES
  (1, 'Carren Santos', 'owner', 'owner123', 'superadmin', 1, '2025-01-01'),
  (2, 'Maria Cruz', 'admin', 'admin123', 'admin', 1, '2025-01-05'),
  (3, 'Juan Dela Cruz', 'cashier1', 'cashier123', 'cashier', 1, '2025-01-10'),
  (4, 'Ana Reyes', 'cashier2', 'cashier456', 'cashier', 0, '2025-02-01');

INSERT INTO products (id, name, category_id, price, cost, unit, stock, low_stock_alert, active, created_at) VALUES
  (1, 'Itlog (per piraso)', 1, 8.00, 5.00, 'pc', 360, 50, 1, '2025-01-01'),
  (2, 'Itlog (per tray/30)', 1, 210.00, 150.00, 'tray', 20, 5, 1, '2025-01-01'),
  (3, 'Mantika 250ml', 2, 35.00, 22.00, 'btl', 48, 10, 1, '2025-01-01'),
  (4, 'Mantika 500ml', 2, 65.00, 40.00, 'btl', 24, 8, 1, '2025-01-01'),
  (5, 'Mantika 1L', 2, 120.00, 75.00, 'btl', 4, 5, 1, '2025-01-01'),
  (6, 'Asin', 3, 15.00, 9.00, 'pack', 30, 10, 1, '2025-01-01'),
  (7, 'Toyo (Marca Pina)', 3, 20.00, 12.00, 'btl', 25, 10, 1, '2025-01-01'),
  (8, 'Suka', 3, 18.00, 11.00, 'btl', 6, 8, 1, '2025-01-01'),
  (9, 'Lucky Me Noodles', 3, 12.00, 7.00, 'pack', 100, 20, 1, '2025-01-01'),
  (10, '3-in-1 Kape', 3, 8.00, 5.00, 'sachet', 200, 30, 1, '2025-01-01'),
  (11, 'Bigas (1kg)', 3, 52.00, 32.00, 'kg', 50, 10, 1, '2025-01-01'),
  (12, 'Sukang Maasim', 3, 22.00, 14.00, 'btl', 15, 5, 1, '2025-01-01');

INSERT INTO transactions (id, date, time, cashier_id, subtotal, cash, change_amount) VALUES
  ('TXN-20250415-0001', '2025-04-15', '08:30:00', 3, 111.00, 150.00, 39.00),
  ('TXN-20250415-0002', '2025-04-15', '09:15:00', 3, 130.00, 200.00, 70.00),
  ('TXN-20250415-0003', '2025-04-15', '10:45:00', 3, 299.00, 300.00, 1.00);

INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, price, cost, total, cost_total) VALUES
  ('TXN-20250415-0001', 1, 'Itlog (per piraso)', 12, 8.00, 5.00, 96.00, 60.00),
  ('TXN-20250415-0001', 6, 'Asin', 1, 15.00, 9.00, 15.00, 9.00),
  ('TXN-20250415-0002', 3, 'Mantika 250ml', 2, 35.00, 22.00, 70.00, 44.00),
  ('TXN-20250415-0002', 9, 'Lucky Me Noodles', 5, 12.00, 7.00, 60.00, 35.00),
  ('TXN-20250415-0003', 2, 'Itlog (per tray/30)', 1, 210.00, 150.00, 210.00, 150.00),
  ('TXN-20250415-0003', 4, 'Mantika 500ml', 1, 65.00, 40.00, 65.00, 40.00),
  ('TXN-20250415-0003', 10, '3-in-1 Kape', 3, 8.00, 5.00, 24.00, 15.00);

INSERT INTO stock_movements (product_id, type, qty, note, movement_date, movement_time, created_by) VALUES
  (1, 'stock-in', 200, 'Delivery', '2025-04-15', '07:30:00', 2),
  (3, 'stock-in', 24, 'Delivery', '2025-04-15', '07:45:00', 2);

INSERT INTO audit_logs (user_id, action) VALUES
  (1, 'Added product: Itlog (per piraso)'),
  (2, 'Stock-in: Itlog (per piraso) +200 pcs'),
  (3, 'Transaction TXN-20250415-0001 completed'),
  (3, 'Transaction TXN-20250415-0002 completed'),
  (2, 'Updated price: Mantika 500ml to PHP 65');

INSERT INTO expenses (expense_date, amount, category, note, created_by) VALUES
  ('2025-04-15', 300.00, 'Utilities', 'Electricity bill', 2);

INSERT INTO store_settings (id, store_name, address, phone, receipt_footer) VALUES
  (1, 'CARREN''S STORE', 'Urdaneta, Ilocos', '09XX-XXX-XXXX', 'Salamat sa inyong pagbili! Please come again :)');
