const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://csxpamrdcptrscnmgord.supabase.co', 'sb_publishable_rwo_oQz5pLu1LC_dWhZRlg_kkUSQyHd');

(async () => {
  const testProducts = [
    { code: 'URN001', name: 'Celik Boru 2"', stock_quantity: 5000, unit: 'adet', unit_price: 150, is_active: true },
    { code: 'URN002', name: 'Kablo 3x2.5mm', stock_quantity: 3000, unit: 'metre', unit_price: 45, is_active: true },
    { code: 'URN003', name: 'PVC Boru 4"', stock_quantity: 2000, unit: 'adet', unit_price: 85, is_active: true },
    { code: 'URN004', name: 'Vida M8x30', stock_quantity: 10000, unit: 'adet', unit_price: 2.5, is_active: true },
    { code: 'URN005', name: 'Somun M8', stock_quantity: 10000, unit: 'adet', unit_price: 1.5, is_active: true },
    { code: 'URN006', name: 'Conta M8', stock_quantity: 8000, unit: 'adet', unit_price: 0.8, is_active: true },
    { code: 'URN007', name: 'Sac 2mm 1000x2000', stock_quantity: 500, unit: 'adet', unit_price: 320, is_active: true },
    { code: 'URN008', name: 'Profil 40x40', stock_quantity: 1200, unit: 'metre', unit_price: 65, is_active: true },
    { code: 'URN009', name: 'Kaynak Teli 1.2mm', stock_quantity: 200, unit: 'kg', unit_price: 28, is_active: true },
    { code: 'URN010', name: 'Elektrik Panosu', stock_quantity: 50, unit: 'adet', unit_price: 2500, is_active: true },
  ];

  const { data: products, error: prodErr } = await supabase.from('products').insert(testProducts).select();
  if (prodErr) { console.log('Urun hatasi:', prodErr.message); return; }
  console.log(products.length + ' urun olusturuldu');

  const firmId = '29018b77-ba9e-4e68-83a8-06ea0578cb18';
  const cariId = 'f31457df-23d5-478f-a8ca-c9744c2b3869';

  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    order_date: new Date().toISOString().split('T')[0],
    firm_id: firmId,
    cari_id: cariId,
    description: 'Test siparis - 10 kalem malzeme 1000er adet',
    status: 'pending',
    total_amount: 0,
    currency: 'TRY',
  }).select().single();

  if (orderErr) { console.log('Siparis hatasi:', orderErr.message); return; }
  console.log('Siparis olusturuldu: #' + order.order_number);

  const orderItems = products.map((p, i) => ({
    order_id: order.id,
    product_id: p.id,
    description: p.name,
    quantity: 1000,
    unit: p.unit,
    unit_price: p.unit_price,
    amount: 1000 * p.unit_price,
    delivered_quantity: 0,
    invoiced_quantity: 0,
    sort_order: i,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
  if (itemsErr) { console.log('Kalem hatasi:', itemsErr.message); return; }
  console.log('10 kalem eklendi (her biri 1000 adet)');

  const totalAmount = orderItems.reduce((sum, item) => sum + item.amount, 0);
  await supabase.from('orders').update({ total_amount: totalAmount }).eq('id', order.id);
  console.log('Toplam tutar: ' + totalAmount.toLocaleString('tr-TR') + ' TL');
})();
