-- Test Verileri (Bu dosyayı Supabase SQL Editor'da çalıştırın)

-- 1. Test Firmaları
INSERT INTO firms (name, tax_number, address, phone, email, type) VALUES
('ABC Teknoloji Ltd.', '1234567890', 'İstanbul, Levent', '0212 555 1234', 'info@abcteknoloji.com', 'customer'),
('XYZ İnşaat A.Ş.', '9876543210', 'Ankara, Çankaya', '0312 444 5678', 'info@xyzinsaat.com', 'supplier'),
('DEF Ticaret Ltd.', '5554443333', 'İzmir, Bornova', '0232 333 1111', 'info@defticaret.com', 'both'),
('GHI Yazılım A.Ş.', '1112223334', 'İstanbul, Kadıköy', '0216 222 3344', 'info@ghiyazilim.com', 'customer'),
('JKL Lojistik Ltd.', '4445556667', 'Bursa, Nilüfer', '0224 111 2233', 'info@jkllistik.com', 'supplier');

-- 2. Test Projeleri (firm_id ile)
INSERT INTO projects (firm_id, name, description, start_date, end_date, budget, status) VALUES
((SELECT id FROM firms WHERE name = 'ABC Teknoloji Ltd.'), 'Web Sitesi Yenileme', 'Kurumsal web sitesinin yeniden tasarlanması', '2026-01-01', '2026-06-30', 150000, 'active'),
((SELECT id FROM firms WHERE name = 'XYZ İnşaat A.Ş.'), 'Mobil Uygulama', 'iOS ve Android mobil uygulama geliştirme', '2026-03-01', '2026-12-31', 300000, 'active'),
((SELECT id FROM firms WHERE name = 'DEF Ticaret Ltd.'), 'ERP Entegrasyonu', 'Muhasebe sistemi entegrasyonu', '2026-02-15', '2026-08-15', 200000, 'active'),
((SELECT id FROM firms WHERE name = 'GHI Yazılım A.Ş.'), 'Ofis Taşıma', 'Yeni ofise geçiş projesi', '2026-04-01', '2026-05-31', 50000, 'completed'),
((SELECT id FROM firms WHERE name = 'JKL Lojistik Ltd.'), 'Eğitim Programı', 'Personel eğitim programı', '2026-01-15', '2026-12-31', 75000, 'active');

-- 3. Test Ürünleri (Stok)
INSERT INTO products (name, code, description, unit, unit_price, quantity, min_quantity, category) VALUES
('Laptop Bilgisayar', 'LT001', '15.6" i7 İşlemci', 'adet', 25000, 50, 10, 'Bilgisayar'),
('Mouse', 'MS001', 'Kablosuz Mouse', 'adet', 250, 200, 50, 'Aksesuar'),
('Klavye', 'KL001', 'Mekanik Klavye', 'adet', 750, 150, 30, 'Aksesuar'),
('Monitor', 'MN001', '27" 4K Monitor', 'adet', 8000, 30, 5, 'Bilgisayar'),
('Yazıcı', 'YZ001', 'Lazer Yazıcı', 'adet', 3500, 20, 5, 'Ofis'),
('A4 Kağıt', 'KY001', '500 Sayfa A4 Kağıt', 'paket', 150, 500, 100, 'Kırtasiye'),
('Kalem Seti', 'KS001', '12'lık Kalem Seti', 'paket', 80, 300, 50, 'Kırtasiye'),
('Projeksiyon Cihazı', 'PJ001', 'Full HD Projeksiyon', 'adet', 12000, 10, 2, 'Bilgisayar');

-- 4. Test Stok Birimleri
INSERT INTO stock_units (name, symbol) VALUES
('Adet', 'adet'),
('Kilogram', 'kg'),
('Litre', 'lt'),
('Metre', 'm'),
('Metre Kare', 'm2'),
('Metre Küp', 'm3'),
('Paket', 'paket'),
('Kutu', 'kutu'),
('Set', 'set'),
('Takım', 'takım');

-- 5. Test Gider Kategorileri
INSERT INTO expense_categories (name, description) VALUES
('Kira', 'Ofis kira giderleri'),
('Maaş', 'Personel maaş ödemeleri'),
('Malzeme', 'Ofis malzeme alımları'),
('Hizmet', 'Dış hizmet alımları'),
('Vergi', 'Vergi ödemeleri'),
('Ulaşım', 'Ulaşım ve nakliye giderleri'),
('İletişim', 'Telefon ve internet giderleri'),
('Enerji', 'Elektrik ve su giderleri');

-- Not: İşlem girişi uygulama üzerinden yapılacaktır.
-- Bu script sadece referans tablolarını doldurur.
