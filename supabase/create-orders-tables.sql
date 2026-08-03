-- =============================================
-- SİPARİŞ YÖNETİMİ SİSTEMİ
-- =============================================

-- 1. orders tablosu - Siparişler
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  firm_id UUID REFERENCES firms(id),
  cari_id UUID REFERENCES cariler(id),
  project_id UUID REFERENCES projects(id),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. order_items tablosu - Sipariş Kalemleri
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'adet',
  unit_price NUMERIC(15,2) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  delivered_quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  invoiced_quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. order_deliveries tablosu - Sipariş İrsaliyeleri
CREATE TABLE IF NOT EXISTS order_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_number TEXT NOT NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. order_delivery_items tablosu - İrsaliye Kalemleri
CREATE TABLE IF NOT EXISTS order_delivery_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES order_deliveries(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity NUMERIC(15,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. order_invoices tablosu - Sipariş Faturaları
CREATE TABLE IF NOT EXISTS order_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. order_invoice_items tablosu - Fatura Kalemleri
CREATE TABLE IF NOT EXISTS order_invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES order_invoices(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity NUMERIC(15,3) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_orders_firm ON orders(firm_id);
CREATE INDEX IF NOT EXISTS idx_orders_cari ON orders(cari_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_order ON order_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_delivery_items_delivery ON order_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_order ON order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_order_invoice_items_invoice ON order_invoice_items(invoice_id);

-- RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Politikaları (authenticated users)
CREATE POLICY "Allow all for authenticated users" ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON order_deliveries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON order_delivery_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON order_invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON order_invoice_items FOR ALL USING (auth.role() = 'authenticated');

-- Trigger: order_items değişikliğinde order total_amount güncelle
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders 
  SET total_amount = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM order_items 
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_total
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_total();

-- Trigger: delivery_items eklendiğinde order_items delivered_quantity güncelle
CREATE OR REPLACE FUNCTION update_delivered_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE order_items 
    SET delivered_quantity = delivered_quantity + NEW.quantity
    WHERE id = NEW.order_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE order_items 
    SET delivered_quantity = delivered_quantity - OLD.quantity
    WHERE id = OLD.order_item_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE order_items 
    SET delivered_quantity = delivered_quantity - OLD.quantity + NEW.quantity
    WHERE id = NEW.order_item_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivered_quantity
  AFTER INSERT OR UPDATE OR DELETE ON order_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivered_quantity();

-- Trigger: invoice_items eklendiğinde order_items invoiced_quantity güncelle
CREATE OR REPLACE FUNCTION update_invoiced_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE order_items 
    SET invoiced_quantity = invoiced_quantity + NEW.quantity
    WHERE id = NEW.order_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE order_items 
    SET invoiced_quantity = invoiced_quantity - OLD.quantity
    WHERE id = OLD.order_item_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE order_items 
    SET invoiced_quantity = invoiced_quantity - OLD.quantity + NEW.quantity
    WHERE id = NEW.order_item_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoiced_quantity
  AFTER INSERT OR UPDATE OR DELETE ON order_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoiced_quantity();

-- Trigger: tüm irsaliye kalemleri tamamlandığında sipariş durumunu güncelle
CREATE OR REPLACE FUNCTION check_order_delivery_status()
RETURNS TRIGGER AS $$
DECLARE
  all_delivered BOOLEAN;
BEGIN
  SELECT BOOL_AND(delivered_quantity >= quantity) INTO all_delivered
  FROM order_items
  WHERE order_id = COALESCE(NEW.order_id, (
    SELECT order_id FROM order_deliveries WHERE id = NEW.delivery_id
  ));
  
  IF all_delivered THEN
    UPDATE orders 
    SET status = 'in_progress'
    WHERE id = COALESCE(NEW.order_id, (
      SELECT order_id FROM order_deliveries WHERE id = NEW.delivery_id
    ));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_order_delivery_status
  AFTER INSERT ON order_delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION check_order_delivery_status();
