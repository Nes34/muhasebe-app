-- Temizleme ve yeniden olusturma
DELETE FROM order_delivery_items;
DELETE FROM order_invoices;
DELETE FROM order_deliveries;
DELETE FROM order_invoice_items;
DELETE FROM order_items;
DELETE FROM orders;

-- Tek siparis olustur
INSERT INTO orders (order_date, firm_id, cari_id, description, status, total_amount, currency)
VALUES (
  CURRENT_DATE,
  (SELECT id FROM firms WHERE name = 'Dere Insaat' LIMIT 1),
  (SELECT id FROM cariler WHERE name = 'Ahmet Metal' LIMIT 1),
  'Test siparis - 10 kalem 1000er adet',
  'pending',
  0,
  'TRY'
);

-- 10 kalem ekle
INSERT INTO order_items (order_id, product_id, description, quantity, unit, unit_price, amount, delivered_quantity, invoiced_quantity, sort_order)
SELECT 
  (SELECT id FROM orders ORDER BY created_at DESC LIMIT 1),
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
WHERE code LIKE 'URN%'
LIMIT 10;

-- Toplami guncelle
UPDATE orders 
SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM order_items WHERE order_id = orders.id)
WHERE description LIKE 'Test siparis%';
