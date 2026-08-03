-- =============================================
-- TEST VERİLERİ
-- =============================================

-- CARİLER
INSERT INTO cariler (code, name, tax_number, address, phone, email, type, is_active) VALUES
('C.0001', 'Ahmet Metal', '1234567890', 'İstanbul, Kadıköy', '0216 555 1234', 'ahmet@metal.com', 'both', true),
('C.0002', 'Mehmet Gıda', '9876543210', 'İstanbul, Beşiktaş', '0212 444 5678', 'mehmet@gida.com', 'both', true),
('C.0003', 'Ayşe Tekstil', '5554443333', 'Ankara, Çankaya', '0312 333 1111', 'ayse@tekstil.com', 'customer', true),
('C.0004', 'Fatma İnşaat', '1112223333', 'İzmir, Alsancak', '0232 222 3333', 'fatma@insaat.com', 'supplier', true),
('C.0005', 'Ali Elektronik', '4445556666', 'Bursa, Nilüfer', '0224 111 2222', 'ali@elektronik.com', 'both', true),
('C.0006', 'Zeynep Otomotiv', '7778889999', 'Antalya, Muratpaşa', '0242 666 7777', 'zeynep@otomotiv.com', 'supplier', true);

-- KASA HAREKETLERİ (Ana Kasa - cari_id ile)
INSERT INTO cash_transactions (cash_register_id, cari_id, project_id, transaction_type, amount, description) VALUES
('bca2418d-5e77-4659-98d0-4259e62381a3', (SELECT id FROM cariler WHERE name='Ahmet Metal'), (SELECT id FROM projects WHERE name='Rezidans Projesi'), 'in', 50000, 'Ahmet Metal nakit ödeme'),
('bca2418d-5e77-4659-98d0-4259e62381a3', (SELECT id FROM cariler WHERE name='Mehmet Gıda'), (SELECT id FROM projects WHERE name='AVM Insaati'), 'out', 25000, 'Mehmet Gıda malzeme alımı'),
('bca2418d-5e77-4659-98d0-4259e62381a3', (SELECT id FROM cariler WHERE name='Ayşe Tekstil'), (SELECT id FROM projects WHERE name='Yazlik Koleksiyonu'), 'in', 35000, 'Ayşe Tekstil sipariş ödemesi'),
('bca2418d-5e77-4659-98d0-4259e62381a3', (SELECT id FROM cariler WHERE name='Fatma İnşaat'), (SELECT id FROM projects WHERE name='Rezidans Projesi'), 'out', 18000, 'Fatma İnşaat kira ödemesi'),
('bca2418d-5e77-4659-98d0-4259e62381a3', (SELECT id FROM cariler WHERE name='Ali Elektronik'), (SELECT id FROM projects WHERE name='Ihracat Siparisi'), 'in', 42000, 'Ali Elektronik ürün satışı');

-- BANKA HAREKETLERİ (cari_id ile)
INSERT INTO bank_transactions (bank_account_id, cari_id, project_id, transaction_type, amount, description) VALUES
('53f845ee-b474-4b01-962e-80f834c50471', (SELECT id FROM cariler WHERE name='Ahmet Metal'), (SELECT id FROM projects WHERE name='Rezidans Projesi'), 'in', 120000, 'Ahmet Metal havalesi'),
('53f845ee-b474-4b01-962e-80f834c50471', (SELECT id FROM cariler WHERE name='Fatma İnşaat'), (SELECT id FROM projects WHERE name='AVM Insaati'), 'out', 85000, 'Fatma İnşaat tedarik ödemesi'),
('0c3d1da5-d95a-4e84-93b9-f1e1d99ff11c', (SELECT id FROM cariler WHERE name='Mehmet Gıda'), (SELECT id FROM projects WHERE name='Yazlik Koleksiyonu'), 'in', 65000, 'Mehmet Gıda çek ödemesi'),
('0c3d1da5-d95a-4e84-93b9-f1e1d99ff11c', (SELECT id FROM cariler WHERE name='Zeynep Otomotiv'), (SELECT id FROM projects WHERE name='Ihracat Siparisi'), 'out', 95000, 'Zeynep Otomotiv araç alımı');

-- ÇEKLER (cari_id ile)
INSERT INTO checks (check_number, check_type, cari_id, firm_id, bank_name, amount, issue_date, due_date, status) VALUES
('ÇK-1001', 'received', (SELECT id FROM cariler WHERE name='Ahmet Metal'), '29018b77-ba9e-4e68-83a8-06ea0578cb18', 'Garanti Bankası', 75000, '2026-01-15', '2026-02-15', 'pending'),
('ÇK-1002', 'received', (SELECT id FROM cariler WHERE name='Ayşe Tekstil'), 'ec173d6e-8316-4b3f-b0c1-594250ef1151', 'İş Bankası', 45000, '2026-01-20', '2026-03-20', 'pending'),
('ÇK-1003', 'given', (SELECT id FROM cariler WHERE name='Fatma İnşaat'), '29018b77-ba9e-4e68-83a8-06ea0578cb18', 'Ziraat Bankası', 60000, '2026-01-10', '2026-04-10', 'pending'),
('ÇK-1004', 'given', (SELECT id FROM cariler WHERE name='Ali Elektronik'), 'ec173d6e-8316-4b3f-b0c1-594250ef1151', 'QNB Finansbank', 35000, '2026-02-01', '2026-05-01', 'pending'),
('ÇK-1005', 'received', (SELECT id FROM cariler WHERE name='Mehmet Gıda'), '29018b77-ba9e-4e68-83a8-06ea0578cb18', 'Yapı Kredi', 55000, '2026-01-25', '2026-02-25', 'pending');

-- İŞLEMLER (transactions - cari_id ile)
INSERT INTO transactions (transaction_date, transaction_type, firm_id, cari_id, project_id, amount, currency, exchange_rate, is_exception, description) VALUES
('2026-01-15', 'income', '29018b77-ba9e-4e68-83a8-06ea0578cb18', (SELECT id FROM cariler WHERE name='Ahmet Metal'), (SELECT id FROM projects WHERE name='Rezidans Projesi'), 50000, 'TRY', 1, false, 'Ahmet Metal mal satışı'),
('2026-01-18', 'expense', 'ec173d6e-8316-4b3f-b0c1-594250ef1151', (SELECT id FROM cariler WHERE name='Fatma İnşaat'), (SELECT id FROM projects WHERE name='AVM Insaati'), 32000, 'TRY', 1, false, 'Fatma İnşaat hizmet bedeli'),
('2026-01-20', 'income', '29018b77-ba9e-4e68-83a8-06ea0578cb18', (SELECT id FROM cariler WHERE name='Mehmet Gıda'), (SELECT id FROM projects WHERE name='Rezidans Projesi'), 28000, 'TRY', 1, false, 'Mehmet Gıda ürün satışı'),
('2026-01-22', 'expense', 'ec173d6e-8316-4b3f-b0c1-594250ef1151', (SELECT id FROM cariler WHERE name='Ayşe Tekstil'), (SELECT id FROM projects WHERE name='Yazlik Koleksiyonu'), 41000, 'TRY', 1, false, 'Ayşe Tekstil kumaş alımı'),
('2026-01-25', 'income', '29018b77-ba9e-4e68-83a8-06ea0578cb18', (SELECT id FROM cariler WHERE name='Ali Elektronik'), (SELECT id FROM projects WHERE name='Ihracat Siparisi'), 67000, 'TRY', 1, false, 'Ali Elektronik ekipman satışı'),
('2026-01-28', 'expense', 'ec173d6e-8316-4b3f-b0c1-594250ef1151', (SELECT id FROM cariler WHERE name='Zeynep Otomotiv'), (SELECT id FROM projects WHERE name='AVM Insaati'), 53000, 'TRY', 1, false, 'Zeynep Otomotiv nakliye');
