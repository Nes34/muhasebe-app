-- Mevcut politikaları kaldır
DROP POLICY IF EXISTS "Allow all for authenticated users" ON orders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_deliveries;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_delivery_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_invoices;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON order_invoice_items;

-- Herkes erişebilir (test)
CREATE POLICY "Allow all" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_deliveries FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_delivery_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_invoices FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_invoice_items FOR ALL USING (true);
