import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency, todayISO } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { OrderItem, OrderDelivery, OrderInvoice } from '../types';
import { Search, AlertTriangle, CheckCircle, Package, Truck, FileText, X, Save, ChevronDown, ChevronRight } from 'lucide-react';

interface OrderWithDetails {
  id: string;
  order_number: number;
  order_date: string;
  firm_id?: string;
  cari_id?: string;
  project_id?: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  currency: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  firm?: { name: string };
  cari?: { name: string };
  project?: { name: string };
  items?: OrderItem[];
}

export default function OrderTracking() {
  const { selectedFirm } = useFirm();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // İrsaliye formu
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_number: '',
    delivery_date: todayISO(),
    notes: '',
  });
  const [deliveryItems, setDeliveryItems] = useState<{ order_item_id: string; quantity: number }[]>([]);

  // Fatura formu
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    invoice_date: todayISO(),
    notes: '',
    total_amount: 0,
  });
  const [invoiceItems, setInvoiceItems] = useState<{ order_item_id: string; quantity: number; unit_price: number; amount: number }[]>([]);

  // Detay paneli
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<OrderDelivery[]>([]);
  const [invoices, setInvoices] = useState<OrderInvoice[]>([]);

  useEffect(() => {
    fetchOrders();
  }, [selectedFirm]);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, firm:firms(name), cari:cariler(name), project:projects(name), items:order_items(*, product:products(name, unit))')
      .order('created_at', { ascending: false });

    if (data) setOrders(data as OrderWithDetails[]);
    setLoading(false);
  }

  async function fetchOrderDetails(orderId: string) {
    const [delRes, invRes] = await Promise.all([
      supabase.from('order_deliveries').select('*, items:order_delivery_items(*, order_item:order_items(*))').eq('order_id', orderId).order('delivery_date', { ascending: false }),
      supabase.from('order_invoices').select('*, items:order_invoice_items(*, order_item:order_items(*))').eq('order_id', orderId).order('invoice_date', { ascending: false }),
    ]);
    if (delRes.data) setDeliveries(delRes.data as OrderDelivery[]);
    if (invRes.data) setInvoices(invRes.data as OrderInvoice[]);
  }

  // İrsaliye formunu aç
  function openDeliveryForm(order: OrderWithDetails) {
    setSelectedOrder(order);
    setDeliveryForm({
      delivery_number: '',
      delivery_date: todayISO(),
      notes: '',
    });
    setDeliveryItems((order.items || []).map(item => ({
      order_item_id: item.id,
      quantity: Math.max(0, item.quantity - item.delivered_quantity),
    })));
    setShowDeliveryForm(true);
  }

  // Fatura formunu aç
  function openInvoiceForm(order: OrderWithDetails) {
    setSelectedOrder(order);
    setInvoiceForm({
      invoice_number: '',
      invoice_date: todayISO(),
      notes: '',
      total_amount: order.total_amount,
    });
    setInvoiceItems((order.items || []).map(item => ({
      order_item_id: item.id,
      quantity: Math.max(0, item.quantity - item.invoiced_quantity),
      unit_price: item.unit_price,
      amount: Math.max(0, item.quantity - item.invoiced_quantity) * item.unit_price,
    })));
    setShowInvoiceForm(true);
  }

  // İrsaliye kaydet
  async function handleDeliverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const validItems = deliveryItems.filter(item => item.quantity > 0);
      if (validItems.length === 0) {
        setMessage({ type: 'error', text: 'En az bir kaleme miktar girin' });
        return;
      }

      // İrsaliye oluştur
      const { data: delivery, error: delError } = await supabase.from('order_deliveries').insert({
        order_id: selectedOrder.id,
        delivery_number: deliveryForm.delivery_number,
        delivery_date: deliveryForm.delivery_date,
        notes: deliveryForm.notes || null,
        status: 'pending',
      }).select().single();

      if (delError) throw delError;

      // İrsaliye kalemlerini ekle
      const itemsToInsert = validItems.map(item => ({
        delivery_id: delivery.id,
        order_item_id: item.order_item_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase.from('order_delivery_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setMessage({ type: 'success', text: 'İrsaliye oluşturuldu' });
      setShowDeliveryForm(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'İrsaliye oluşturulamadı' });
    }
  }

  // Fatura kaydet
  async function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const validItems = invoiceItems.filter(item => item.quantity > 0);
      if (validItems.length === 0) {
        setMessage({ type: 'error', text: 'En az bir kaleme miktar girin' });
        return;
      }

      // Fatura oluştur
      const { data: invoice, error: invError } = await supabase.from('order_invoices').insert({
        order_id: selectedOrder.id,
        invoice_number: invoiceForm.invoice_number,
        invoice_date: invoiceForm.invoice_date,
        total_amount: validItems.reduce((sum, item) => sum + item.amount, 0),
        notes: invoiceForm.notes || null,
        status: 'pending',
      }).select().single();

      if (invError) throw invError;

      // Fatura kalemlerini ekle
      const itemsToInsert = validItems.map(item => ({
        invoice_id: invoice.id,
        order_item_id: item.order_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }));

      const { error: itemsError } = await supabase.from('order_invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setMessage({ type: 'success', text: 'Fatura oluşturuldu' });
      setShowInvoiceForm(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Fatura oluşturulamadı' });
    }
  }

  // Detayları göster
  async function toggleDetail(orderId: string) {
    if (showDetail === orderId) {
      setShowDetail(null);
    } else {
      setShowDetail(orderId);
      await fetchOrderDetails(orderId);
    }
  }

  function getDeliveryProgress(order: OrderWithDetails) {
    if (!order.items || order.items.length === 0) return { delivered: 0, total: 0, percent: 0 };
    const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const delivered = order.items.reduce((sum, item) => sum + item.delivered_quantity, 0);
    return { delivered, total, percent: total > 0 ? Math.round((delivered / total) * 100) : 0 };
  }

  function getInvoiceProgress(order: OrderWithDetails) {
    if (!order.items || order.items.length === 0) return { invoiced: 0, total: 0, percent: 0 };
    const total = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const invoiced = order.items.reduce((sum, item) => sum + item.invoiced_quantity, 0);
    return { invoiced, total, percent: total > 0 ? Math.round((invoiced / total) * 100) : 0 };
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.order_number?.toString().includes(searchTerm) ||
      order.firm?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.cari?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesFirm = !selectedFirm || order.firm_id === selectedFirm.id;
    return matchesSearch && matchesStatus && matchesFirm;
  });

  // Bilgilendirme hesaplamaları
  const pendingInvoiceOrders = orders.filter(o => {
    const inv = getInvoiceProgress(o);
    return inv.percent < 100 && o.status !== 'cancelled';
  });

  const completedDeliveryOrders = orders.filter(o => {
    const del = getDeliveryProgress(o);
    return del.percent === 100 && o.status !== 'completed' && o.status !== 'cancelled';
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Truck size={24} /> Sipariş Takibi
        </h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Uyarı Bildirimleri */}
      {completedDeliveryOrders.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-600" />
            <span className="font-semibold text-green-800">İrsaliyeleri Tamamlanan Siparişler ({completedDeliveryOrders.length})</span>
          </div>
          <p className="text-sm text-green-700 mb-2">Bu siparişlerin tüm malzeme irsaliyeleri tamamlanmış, faturalanabilir.</p>
          <div className="flex flex-wrap gap-2">
            {completedDeliveryOrders.map(order => (
              <button
                key={order.id}
                onClick={() => openInvoiceForm(order)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                #{order.order_number} Fatura Kes
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingInvoiceOrders.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-semibold text-amber-800">Faturası Kesilmeyen Siparişler ({pendingInvoiceOrders.length})</span>
          </div>
          <p className="text-sm text-amber-700">
            {pendingInvoiceOrders.length} siparişin faturası henüz kesilmemiş veya eksik kesilmiş.
            Toplam tutar: {formatCurrency(pendingInvoiceOrders.reduce((sum, o) => {
              const inv = getInvoiceProgress(o);
              return sum + o.total_amount * (1 - inv.percent / 100);
            }, 0))}
          </p>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Sipariş ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Tümü' },
            { value: 'pending', label: 'Bekliyor' },
            { value: 'in_progress', label: 'Üretimde' },
            { value: 'completed', label: 'Tamamlandı' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterStatus(option.value)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sipariş Listesi */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const delivery = getDeliveryProgress(order);
          const invoice = getInvoiceProgress(order);
          const isExpanded = showDetail === order.id;
          const hasPendingDelivery = delivery.percent < 100;
          const hasPendingInvoice = invoice.percent < 100;

          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Sipariş Başlığı */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleDetail(order.id)} className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">#{order.order_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {order.status === 'pending' ? 'Bekliyor' : order.status === 'in_progress' ? 'Üretimde' : order.status === 'completed' ? 'Tamamlandı' : 'İptal'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {order.firm?.name || order.cari?.name || '-'} | {formatDateTR(order.order_date)} | {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* İrsaliye Durumu */}
                    <div className="text-right min-w-[120px]">
                      <div className="flex items-center gap-2 mb-1">
                        <Truck size={14} className={delivery.percent === 100 ? 'text-green-600' : 'text-blue-600'} />
                        <span className="text-xs font-medium text-slate-600">İrsaliye</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${delivery.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${delivery.percent}%` }} />
                        </div>
                        <span className="text-xs font-bold w-10 text-right">%{delivery.percent}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{delivery.delivered}/{delivery.total}</p>
                    </div>

                    {/* Fatura Durumu */}
                    <div className="text-right min-w-[120px]">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={14} className={invoice.percent === 100 ? 'text-green-600' : 'text-purple-600'} />
                        <span className="text-xs font-medium text-slate-600">Fatura</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${invoice.percent === 100 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${invoice.percent}%` }} />
                        </div>
                        <span className="text-xs font-bold w-10 text-right">%{invoice.percent}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{invoice.invoiced}/{invoice.total}</p>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="flex gap-2">
                      {hasPendingDelivery && order.status !== 'cancelled' && (
                        <button
                          onClick={() => openDeliveryForm(order)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Truck size={14} /> İrsaliye
                        </button>
                      )}
                      {hasPendingInvoice && delivery.percent > 0 && order.status !== 'cancelled' && (
                        <button
                          onClick={() => openInvoiceForm(order)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <FileText size={14} /> Fatura
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Genişletilmiş Detay */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Sipariş Kalemleri */}
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                        <Package size={14} /> Sipariş Kalemleri
                      </h4>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left py-2 px-2">Ürün</th>
                              <th className="text-right py-2 px-2">Sipariş</th>
                              <th className="text-right py-2 px-2">İrsaliye</th>
                              <th className="text-right py-2 px-2">Fatura</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(order.items || []).map(item => (
                              <tr key={item.id} className="border-t border-slate-100">
                                <td className="py-2 px-2">{item.product?.name || item.description}</td>
                                <td className="py-2 px-2 text-right">{item.quantity} {item.unit}</td>
                                <td className="py-2 px-2 text-right">
                                  <span className={item.delivered_quantity >= item.quantity ? 'text-green-600 font-medium' : 'text-blue-600'}>
                                    {item.delivered_quantity}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <span className={item.invoiced_quantity >= item.quantity ? 'text-green-600 font-medium' : 'text-purple-600'}>
                                    {item.invoiced_quantity}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* İrsaliye ve Fatura Geçmişi */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                          <Truck size={14} /> İrsaliyeler ({deliveries.length})
                        </h4>
                        {deliveries.length === 0 ? (
                          <p className="text-xs text-slate-500">Henüz irsaliye yok</p>
                        ) : (
                          <div className="space-y-1">
                            {deliveries.map(del => (
                              <div key={del.id} className="bg-white rounded-lg border border-slate-200 p-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="font-medium">{del.delivery_number}</span>
                                  <span className="text-slate-500">{formatDateTR(del.delivery_date)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                          <FileText size={14} /> Faturalar ({invoices.length})
                        </h4>
                        {invoices.length === 0 ? (
                          <p className="text-xs text-slate-500">Henüz fatura yok</p>
                        ) : (
                          <div className="space-y-1">
                            {invoices.map(inv => (
                              <div key={inv.id} className="bg-white rounded-lg border border-slate-200 p-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="font-medium">{inv.invoice_number}</span>
                                  <span className="text-slate-500">{formatDateTR(inv.invoice_date)}</span>
                                </div>
                                <div className="text-slate-600">{formatCurrency(inv.total_amount)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredOrders.length === 0 && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Truck size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">Henüz sipariş bulunamadı.</p>
          </div>
        )}
      </div>

      {/* İrsaliye Formu */}
      {showDeliveryForm && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck size={20} /> İrsaliye Oluştur - #{selectedOrder.order_number}
              </h2>
              <button onClick={() => { setShowDeliveryForm(false); setSelectedOrder(null); }} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            <form onSubmit={handleDeliverySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">İrsaliye Numarası</label>
                  <input type="text" value={deliveryForm.delivery_number} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required placeholder="IRS-00001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={deliveryForm.delivery_date} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                <input type="text" value={deliveryForm.notes} onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Opsiyonel not..." />
              </div>

              <div>
                <h3 className="font-medium text-slate-800 mb-2">İrsaliye Kalemleri (Kalan miktar)</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left py-2 px-3">Ürün</th>
                        <th className="text-right py-2 px-3">Sipariş</th>
                        <th className="text-right py-2 px-3">Gönderilen</th>
                        <th className="text-right py-2 px-3">Kalan</th>
                        <th className="text-right py-2 px-3 w-28">İrsaliye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((item, index) => {
                        const remaining = item.quantity - item.delivered_quantity;
                        return (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="py-2 px-3">{item.product?.name || item.description}</td>
                            <td className="py-2 px-3 text-right">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-green-600">{item.delivered_quantity}</td>
                            <td className="py-2 px-3 text-right font-medium">{remaining}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={deliveryItems[index]?.quantity || 0}
                                onChange={(e) => {
                                  const newItems = [...deliveryItems];
                                  newItems[index] = { ...newItems[index], quantity: Math.min(remaining, parseFloat(e.target.value) || 0) };
                                  setDeliveryItems(newItems);
                                }}
                                max={remaining}
                                min={0}
                                step="0.001"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button type="button" onClick={() => { setShowDeliveryForm(false); setSelectedOrder(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Save size={16} /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fatura Formu */}
      {showInvoiceForm && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText size={20} /> Fatura Oluştur - #{selectedOrder.order_number}
              </h2>
              <button onClick={() => { setShowInvoiceForm(false); setSelectedOrder(null); }} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fatura Numarası</label>
                  <input type="text" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required placeholder="FAT-00001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                <input type="text" value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Opsiyonel not..." />
              </div>

              <div>
                <h3 className="font-medium text-slate-800 mb-2">Fatura Kalemleri (Kalan miktar)</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left py-2 px-3">Ürün</th>
                        <th className="text-right py-2 px-3">Sipariş</th>
                        <th className="text-right py-2 px-3">Faturalanan</th>
                        <th className="text-right py-2 px-3">Kalan</th>
                        <th className="text-right py-2 px-3 w-24">Fiyat</th>
                        <th className="text-right py-2 px-3 w-28">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((item, index) => {
                        const remaining = item.quantity - item.invoiced_quantity;
                        return (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="py-2 px-3">{item.product?.name || item.description}</td>
                            <td className="py-2 px-3 text-right">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-purple-600">{item.invoiced_quantity}</td>
                            <td className="py-2 px-3 text-right font-medium">{remaining}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                value={invoiceItems[index]?.quantity || 0}
                                onChange={(e) => {
                                  const newItems = [...invoiceItems];
                                  const qty = Math.min(remaining, parseFloat(e.target.value) || 0);
                                  newItems[index] = { ...newItems[index], quantity: qty, amount: qty * item.unit_price };
                                  setInvoiceItems(newItems);
                                  // Toplamı güncelle
                                  const newTotal = newItems.reduce((sum, i) => sum + i.amount, 0);
                                  setInvoiceForm(prev => ({ ...prev, total_amount: newTotal }));
                                }}
                                max={remaining}
                                min={0}
                                step="0.001"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-medium">
                        <td colSpan={5} className="py-2 px-3 text-right">Toplam Tutar:</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(invoiceForm.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button type="button" onClick={() => { setShowInvoiceForm(false); setSelectedOrder(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Save size={16} /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
