-- Firmalar (type: 'both')
INSERT INTO firms (name, tax_number, type, is_active, code) VALUES
('Dere İnşaat', '1234567890', 'both', true, 'D.0001'),
('Yıldız Tekstil', '9876543210', 'both', true, 'Y.0001');

-- Cariler (type: 'customer' veya 'supplier')
INSERT INTO firms (name, tax_number, type, is_active, code) VALUES
('Ahmet Metal', '5551112233', 'customer', true, 'A.0001'),
('Mehmet Gıda', '6663334455', 'supplier', true, 'M.0001');
