-- RLS politikalarını düzelt
DROP POLICY IF EXISTS "Allow all for authenticated users" ON orders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_deliveries;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_delivery_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_invoices;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_invoice_items;

CREATE POLICY "Allow all" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_deliveries FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_delivery_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_invoices FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_invoice_items FOR ALL USING (true);

-- 10 test urunu
INSERT INTO products (code, name, stock_quantity, unit, unit_price, is_active) VALUES
('URN001', 'Celik Boru 2 Inc', 5000, 'adet', 150, true),
('URN002', 'Kablo 3x2.5mm', 3000, 'metre', 45, true),
('URN003', 'PVC Boru 4 Inc', 2000, 'adet', 85, true),
('URN004', 'Vida M8x30', 10000, 'adet', 2.5, true),
('URN005', 'Somun M8', 10000, 'adet', 1.5, true),
('URN006', 'Conta M8', 8000, 'adet', 0.8, true),
('URN007', 'Sac 2mm 1000x2000', 500, 'adet', 320, true),
('URN008', 'Profil 40x40', 1200, 'metre', 65, true),
('URN009', 'Kaynak Teli 1.2mm', 200, 'kg', 28, true),
('URN010', 'Elektrik Panosu', 50, 'adet', 2500, true);

-- Siparis olustur
INSERT INTO orders (order_date, firm_id, cari_id, description, status, total_amount, currency)
VALUES (
  CURRENT_DATE,
  (SELECT id FROM firms WHERE name = 'Dere Insaat' LIMIT 1),
  (SELECT id FROM cariler WHERE name = 'Ahmet Metal' LIMIT 1),
  'Test siparis - 10 kalem malzeme 1000er adet',
  'pending',
  0,
  'TRY'
);

-- 10 kalem ekle (her biri 1000 adet)
INSERT INTO order_items (order_id, product_id, description, quantity, unit, unit_price, amount, delivered_quantity, invoiced_quantity, sort_order)
SELECT 
  (SELECT id FROM orders WHERE description LIKE 'Test siparis%' ORDER BY created_at DESC LIMIT 1),
  id,
  name,
  1000,
  unit,
  unit_price,
  1000 * unit_price,
  0,
  0,
  ROW_NUMBER() OVER (ORDER BY code)
FROM products
WHERE code LIKE 'URN%';

-- Siparis toplamini guncelle
UPDATE orders 
SET total_amount = (
  SELECT COALESCE(SUM(amount), 0) 
  FROM order_items 
  WHERE order_id = orders.id
)
WHERE description LIKE 'Test siparis%';
