import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency, todayISO } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Cari, OrderDelivery, OrderInvoice } from '../types';
import { Search, AlertTriangle, CheckCircle, Package, Truck, FileText, X, Save, ChevronDown, ChevronRight, CheckSquare, Square, Keyboard } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

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

interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  delivered_quantity: number;
  invoiced_quantity: number;
  sort_order: number;
  created_at: string;
  product?: { name: string; unit: string };
}

interface PendingItem {
  order_id: string;
  order_number: number;
  order_date: string;
  item_id: string;
  product_name: string;
  description: string;
  unit: string;
  total_quantity: number;
  delivered_quantity: number;
  invoiced_quantity: number;
  remaining_delivery: number;
  remaining_invoice: number;
  unit_price: number;
  selected: boolean;
  entry_quantity: number;
}

export default function OrderTracking() {
  const { selectedFirm, selectedProject } = useFirm();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // İrsaliye formu
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_number: '',
    delivery_date: todayISO(),
    notes: '',
    cari_id: '',
  });
  const [pendingDeliveryItems, setPendingDeliveryItems] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Fatura formu
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    invoice_date: todayISO(),
    notes: '',
    cari_id: '',
  });
  const [pendingInvoiceItems, setPendingInvoiceItems] = useState<PendingItem[]>([]);
  const [loadingPendingInvoice, setLoadingPendingInvoice] = useState(false);

  // Detay paneli
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<OrderDelivery[]>([]);
  const [invoices, setInvoices] = useState<OrderInvoice[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedFirm, selectedProject]);

  // F1 tuşu için全局 dinleyici
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (showDeliveryForm && deliveryForm.cari_id) {
          fetchPendingDeliveryItems(deliveryForm.cari_id);
        } else if (showInvoiceForm && invoiceForm.cari_id) {
          fetchPendingInvoiceItems(invoiceForm.cari_id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeliveryForm, showInvoiceForm, deliveryForm.cari_id, invoiceForm.cari_id]);

  async function fetchData() {
    setLoading(true);
    const [ordersRes, carilerRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, firm:firms(name), cari:cariler(name), project:projects(name), items:order_items(*, product:products(name, unit))')
        .order('created_at', { ascending: false }),
      supabase.from('cariler').select('*').eq('is_active', true).order('name'),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data as OrderWithDetails[]);
    if (carilerRes.data) setCariler(carilerRes.data);
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

  // Cari seçildiğinde tamamlanmamış irsaliye kalemlerini çek
  async function fetchPendingDeliveryItems(cariId: string) {
    setLoadingPending(true);
    try {
      // Bu cariye ait tüm aktif siparişleri çek
      const { data: cariOrders } = await supabase
        .from('orders')
        .select('id, order_number, order_date, items:order_items(*)')
        .eq('cari_id', cariId)
        .not('status', 'eq', 'cancelled')
        .order('order_date', { ascending: true });

      const pending: PendingItem[] = [];
      (cariOrders || []).forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          const remaining = item.quantity - item.delivered_quantity;
          if (remaining > 0) {
            pending.push({
              order_id: order.id,
              order_number: order.order_number,
              order_date: order.order_date,
              item_id: item.id,
              product_name: item.product?.name || item.description,
              description: item.description,
              unit: item.unit,
              total_quantity: item.quantity,
              delivered_quantity: item.delivered_quantity,
              invoiced_quantity: item.invoiced_quantity,
              remaining_delivery: remaining,
              remaining_invoice: item.quantity - item.invoiced_quantity,
              unit_price: item.unit_price,
              selected: false,
              entry_quantity: 0,
            });
          }
        });
      });

      setPendingDeliveryItems(pending);
    } catch (error) {
      console.error('Pending items fetch error:', error);
    }
    setLoadingPending(false);
  }

  // Cari seçildiğinde tamamlanmamış fatura kalemlerini çek
  async function fetchPendingInvoiceItems(cariId: string) {
    setLoadingPendingInvoice(true);
    try {
      const { data: cariOrders } = await supabase
        .from('orders')
        .select('id, order_number, order_date, items:order_items(*)')
        .eq('cari_id', cariId)
        .not('status', 'eq', 'cancelled')
        .order('order_date', { ascending: true });

      const pending: PendingItem[] = [];
      (cariOrders || []).forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          const remaining = item.quantity - item.invoiced_quantity;
          if (remaining > 0) {
            pending.push({
              order_id: order.id,
              order_number: order.order_number,
              order_date: order.order_date,
              item_id: item.id,
              product_name: item.product?.name || item.description,
              description: item.description,
              unit: item.unit,
              total_quantity: item.quantity,
              delivered_quantity: item.delivered_quantity,
              invoiced_quantity: item.invoiced_quantity,
              remaining_delivery: item.quantity - item.delivered_quantity,
              remaining_invoice: remaining,
              unit_price: item.unit_price,
              selected: false,
              entry_quantity: 0,
            });
          }
        });
      });

      setPendingInvoiceItems(pending);
    } catch (error) {
      console.error('Pending items fetch error:', error);
    }
    setLoadingPendingInvoice(false);
  }

  // Tümünü seç/kaldır (irsaliye)
  function toggleSelectAllDelivery() {
    const allSelected = pendingDeliveryItems.every(i => i.selected);
    setPendingDeliveryItems(pendingDeliveryItems.map(i => ({
      ...i,
      selected: !allSelected,
      entry_quantity: !allSelected ? i.remaining_delivery : 0,
    })));
  }

  // Tek kalem seç/kaldır (irsaliye)
  function toggleItemDelivery(index: number) {
    const newItems = [...pendingDeliveryItems];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      selected: !item.selected,
      entry_quantity: !item.selected ? item.remaining_delivery : 0,
    };
    setPendingDeliveryItems(newItems);
  }

  // Miktar değiştir (irsaliye)
  function updateEntryQuantityDelivery(index: number, qty: number) {
    const newItems = [...pendingDeliveryItems];
    const item = newItems[index];
    const maxQty = item.remaining_delivery;
    newItems[index] = {
      ...item,
      entry_quantity: Math.min(maxQty, Math.max(0, qty)),
      selected: qty > 0,
    };
    setPendingDeliveryItems(newItems);
  }

  // Tümünü seç/kaldır (fatura)
  function toggleSelectAllInvoice() {
    const allSelected = pendingInvoiceItems.every(i => i.selected);
    setPendingInvoiceItems(pendingInvoiceItems.map(i => ({
      ...i,
      selected: !allSelected,
      entry_quantity: !allSelected ? i.remaining_invoice : 0,
    })));
  }

  // Tek kalem seç/kaldır (fatura)
  function toggleItemInvoice(index: number) {
    const newItems = [...pendingInvoiceItems];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      selected: !item.selected,
      entry_quantity: !item.selected ? item.remaining_invoice : 0,
    };
    setPendingInvoiceItems(newItems);
  }

  // Miktar değiştir (fatura)
  function updateEntryQuantityInvoice(index: number, qty: number) {
    const newItems = [...pendingInvoiceItems];
    const item = newItems[index];
    const maxQty = item.remaining_invoice;
    newItems[index] = {
      ...item,
      entry_quantity: Math.min(maxQty, Math.max(0, qty)),
      selected: qty > 0,
    };
    setPendingInvoiceItems(newItems);
  }

  // İrsaliye formunu aç
  function openDeliveryForm() {
    setDeliveryForm({
      delivery_number: '',
      delivery_date: todayISO(),
      notes: '',
      cari_id: '',
    });
    setPendingDeliveryItems([]);
    setShowDeliveryForm(true);
  }

  // Fatura formunu aç
  function openInvoiceForm() {
    setInvoiceForm({
      invoice_number: '',
      invoice_date: todayISO(),
      notes: '',
      cari_id: '',
    });
    setPendingInvoiceItems([]);
    setShowInvoiceForm(true);
  }

  // İrsaliye kaydet
  async function handleDeliverySubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const selectedItems = pendingDeliveryItems.filter(i => i.selected && i.entry_quantity > 0);
      if (selectedItems.length === 0) {
        setMessage({ type: 'error', text: 'En az bir kalem seçin ve miktar girin' });
        return;
      }

      // Her sipariş için ayrı irsaliye oluştur
      const ordersGrouped = selectedItems.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {} as Record<string, PendingItem[]>);

      for (const [orderId, items] of Object.entries(ordersGrouped)) {
        const { data: delivery, error: delError } = await supabase.from('order_deliveries').insert({
          order_id: orderId,
          delivery_number: deliveryForm.delivery_number,
          delivery_date: deliveryForm.delivery_date,
          notes: deliveryForm.notes || null,
          status: 'pending',
        }).select().single();

        if (delError) throw delError;

        const itemsToInsert = items.map(item => ({
          delivery_id: delivery.id,
          order_item_id: item.item_id,
          quantity: item.entry_quantity,
        }));

        const { error: itemsError } = await supabase.from('order_delivery_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      setMessage({ type: 'success', text: `${selectedItems.length} kalem irsaliyeye eklendi` });
      setShowDeliveryForm(false);
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'İrsaliye oluşturulamadı' });
    }
  }

  // Fatura kaydet
  async function handleInvoiceSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const selectedItems = pendingInvoiceItems.filter(i => i.selected && i.entry_quantity > 0);
      if (selectedItems.length === 0) {
        setMessage({ type: 'error', text: 'En az bir kalem seçin ve miktar girin' });
        return;
      }

      const ordersGrouped = selectedItems.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {} as Record<string, PendingItem[]>);

      for (const [orderId, items] of Object.entries(ordersGrouped)) {
        const totalAmount = items.reduce((sum, i) => sum + i.entry_quantity * i.unit_price, 0);

        const { data: invoice, error: invError } = await supabase.from('order_invoices').insert({
          order_id: orderId,
          invoice_number: invoiceForm.invoice_number,
          invoice_date: invoiceForm.invoice_date,
          total_amount: totalAmount,
          notes: invoiceForm.notes || null,
          status: 'pending',
        }).select().single();

        if (invError) throw invError;

        const itemsToInsert = items.map(item => ({
          invoice_id: invoice.id,
          order_item_id: item.item_id,
          quantity: item.entry_quantity,
          unit_price: item.unit_price,
          amount: item.entry_quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase.from('order_invoice_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      setMessage({ type: 'success', text: `${selectedItems.length} kalem faturaya eklendi` });
      setShowInvoiceForm(false);
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Fatura oluşturulamadı' });
    }
  }

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

  const pendingInvoiceOrders = orders.filter(o => {
    const inv = getInvoiceProgress(o);
    return inv.percent < 100 && o.status !== 'cancelled';
  });

  const completedDeliveryOrders = orders.filter(o => {
    const del = getDeliveryProgress(o);
    return del.percent === 100 && o.status !== 'completed' && o.status !== 'cancelled';
  });

  // Seçili kalemlerin toplamı (irsaliye)
  const selectedDeliveryTotal = pendingDeliveryItems
    .filter(i => i.selected && i.entry_quantity > 0)
    .reduce((sum, i) => sum + i.entry_quantity * i.unit_price, 0);

  // Seçili kalemlerin toplamı (fatura)
  const selectedInvoiceTotal = pendingInvoiceItems
    .filter(i => i.selected && i.entry_quantity > 0)
    .reduce((sum, i) => sum + i.entry_quantity * i.unit_price, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Truck size={24} /> Sipariş Takibi
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openDeliveryForm}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Truck size={16} /> Yeni İrsaliye
          </button>
          <button
            onClick={openInvoiceForm}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText size={16} /> Yeni Fatura
          </button>
        </div>
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

          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                  </div>
                </div>
              </div>

              {/* Genişletilmiş Detay */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                        <Package size={14} /> Sipariş Kalemleri
                      </h4>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <ResizableTh columnId="siparis-takip-urun" className="text-left py-2 px-2">Ürün</ResizableTh>
                              <ResizableTh columnId="siparis-takip-siparis" className="text-right py-2 px-2">Sipariş</ResizableTh>
                              <ResizableTh columnId="siparis-takip-irsaliye" className="text-right py-2 px-2">İrsaliye</ResizableTh>
                              <ResizableTh columnId="siparis-takip-fatura" className="text-right py-2 px-2">Fatura</ResizableTh>
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

      {/* ============================================ */}
      {/* İRSALİYE FORMU */}
      {/* ============================================ */}
      {showDeliveryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck size={20} /> Yeni İrsaliye Oluştur
              </h2>
              <button onClick={() => setShowDeliveryForm(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            <form onSubmit={handleDeliverySubmit} className="space-y-4">
              {/* Temel Bilgiler */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">İrsaliye Numarası</label>
                  <input type="text" value={deliveryForm.delivery_number} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required placeholder="IRS-00001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={deliveryForm.delivery_date} onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cari *</label>
                  <SearchableSelect
                    options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                    value={deliveryForm.cari_id}
                    onChange={(id) => setDeliveryForm({ ...deliveryForm, cari_id: id })}
                    placeholder="Cari seçin..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                <input type="text" value={deliveryForm.notes} onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Opsiyonel not..." />
              </div>

              {/* F1 Bilgisi */}
              {deliveryForm.cari_id && pendingDeliveryItems.length === 0 && !loadingPending && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                  <Keyboard size={20} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">F1 tuşuna basın</p>
                    <p className="text-xs text-blue-600">Seçili cariye ait tamamlanmamış sipariş kalemleri yüklenecek</p>
                  </div>
                </div>
              )}

              {/* Yükleniyor */}
              {loadingPending && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-slate-500 mt-2">Tamamlanmamış kalemler yükleniyor...</p>
                </div>
              )}

              {/* Kalemler Tablosu */}
              {pendingDeliveryItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-800 flex items-center gap-2">
                      <Package size={16} /> Tamamlanmamış Sipariş Kalemleri ({pendingDeliveryItems.length})
                    </h3>
                    <button type="button" onClick={toggleSelectAllDelivery} className="flex items-center gap-1 px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                      {pendingDeliveryItems.every(i => i.selected) ? <CheckSquare size={14} /> : <Square size={14} />}
                      {pendingDeliveryItems.every(i => i.selected) ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-center py-2 px-2 w-10">
                            <input
                              type="checkbox"
                              checked={pendingDeliveryItems.every(i => i.selected)}
                              onChange={toggleSelectAllDelivery}
                              className="rounded"
                            />
                          </th>
                          <ResizableTh columnId="irsaliye-siparis" className="text-left py-2 px-2">Sipariş</ResizableTh>
                          <ResizableTh columnId="irsaliye-urun" className="text-left py-2 px-2">Ürün</ResizableTh>
                          <ResizableTh columnId="irsaliye-siparis-miktar" className="text-right py-2 px-2">Sipariş</ResizableTh>
                          <ResizableTh columnId="irsaliye-gonderilen" className="text-right py-2 px-2">Gönderilen</ResizableTh>
                          <ResizableTh columnId="irsaliye-kalan" className="text-right py-2 px-2 font-bold text-blue-700">Kalan</ResizableTh>
                          <ResizableTh columnId="irsaliye-girilecek" className="text-right py-2 px-2">Girilecek</ResizableTh>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingDeliveryItems.map((item, index) => (
                          <tr key={item.item_id} className={`border-t border-slate-100 ${item.selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleItemDelivery(index)}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-xs font-medium text-slate-600">#{item.order_number}</span>
                            </td>
                            <td className="py-2 px-2">{item.product_name}</td>
                            <td className="py-2 px-2 text-right">{item.total_quantity} {item.unit}</td>
                            <td className="py-2 px-2 text-right text-green-600">{item.delivered_quantity}</td>
                            <td className="py-2 px-2 text-right font-bold text-blue-700">{item.remaining_delivery} {item.unit}</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                value={item.entry_quantity || ''}
                                onChange={(e) => updateEntryQuantityDelivery(index, parseFloat(e.target.value) || 0)}
                                max={item.remaining_delivery}
                                min={0}
                                step="0.001"
                                placeholder="0"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-medium">
                          <td colSpan={6} className="py-2 px-3 text-right">
                            Seçilen Toplam Tutar:
                          </td>
                          <td className="py-2 px-3 text-right text-blue-700">
                            {formatCurrency(selectedDeliveryTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowDeliveryForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Save size={16} /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* FATURA FORMU */}
      {/* ============================================ */}
      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText size={20} /> Yeni Fatura Oluştur
              </h2>
              <button onClick={() => setShowInvoiceForm(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              {/* Temel Bilgiler */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fatura Numarası</label>
                  <input type="text" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required placeholder="FAT-00001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                  <input type="date" value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cari *</label>
                  <SearchableSelect
                    options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                    value={invoiceForm.cari_id}
                    onChange={(id) => setInvoiceForm({ ...invoiceForm, cari_id: id })}
                    placeholder="Cari seçin..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                <input type="text" value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Opsiyonel not..." />
              </div>

              {/* F1 Bilgisi */}
              {invoiceForm.cari_id && pendingInvoiceItems.length === 0 && !loadingPendingInvoice && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
                  <Keyboard size={20} className="text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">F1 tuşuna basın</p>
                    <p className="text-xs text-purple-600">Seçili cariye ait faturası kesilmemiş sipariş kalemleri yüklenecek</p>
                  </div>
                </div>
              )}

              {/* Yükleniyor */}
              {loadingPendingInvoice && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-sm text-slate-500 mt-2">Faturası kesilmemiş kalemler yükleniyor...</p>
                </div>
              )}

              {/* Kalemler Tablosu */}
              {pendingInvoiceItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-800 flex items-center gap-2">
                      <Package size={16} /> Faturası Kesilmemiş Sipariş Kalemleri ({pendingInvoiceItems.length})
                    </h3>
                    <button type="button" onClick={toggleSelectAllInvoice} className="flex items-center gap-1 px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                      {pendingInvoiceItems.every(i => i.selected) ? <CheckSquare size={14} /> : <Square size={14} />}
                      {pendingInvoiceItems.every(i => i.selected) ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-center py-2 px-2 w-10">
                            <input
                              type="checkbox"
                              checked={pendingInvoiceItems.every(i => i.selected)}
                              onChange={toggleSelectAllInvoice}
                              className="rounded"
                            />
                          </th>
                          <ResizableTh columnId="fatura-siparis" className="text-left py-2 px-2">Sipariş</ResizableTh>
                          <ResizableTh columnId="fatura-urun" className="text-left py-2 px-2">Ürün</ResizableTh>
                          <ResizableTh columnId="fatura-siparis-miktar" className="text-right py-2 px-2">Sipariş</ResizableTh>
                          <ResizableTh columnId="fatura-faturalanan" className="text-right py-2 px-2">Faturalanan</ResizableTh>
                          <ResizableTh columnId="fatura-kalan" className="text-right py-2 px-2 font-bold text-purple-700">Kalan</ResizableTh>
                          <ResizableTh columnId="fatura-birim-fiyat" className="text-right py-2 px-2">Birim Fiyat</ResizableTh>
                          <ResizableTh columnId="fatura-girilecek" className="text-right py-2 px-2">Girilecek</ResizableTh>
                          <ResizableTh columnId="fatura-tutar" className="text-right py-2 px-2">Tutar</ResizableTh>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingInvoiceItems.map((item, index) => (
                          <tr key={item.item_id} className={`border-t border-slate-100 ${item.selected ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleItemInvoice(index)}
                                className="rounded"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-xs font-medium text-slate-600">#{item.order_number}</span>
                            </td>
                            <td className="py-2 px-2">{item.product_name}</td>
                            <td className="py-2 px-2 text-right">{item.total_quantity} {item.unit}</td>
                            <td className="py-2 px-2 text-right text-purple-600">{item.invoiced_quantity}</td>
                            <td className="py-2 px-2 text-right font-bold text-purple-700">{item.remaining_invoice} {item.unit}</td>
                            <td className="py-2 px-2 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                value={item.entry_quantity || ''}
                                onChange={(e) => updateEntryQuantityInvoice(index, parseFloat(e.target.value) || 0)}
                                max={item.remaining_invoice}
                                min={0}
                                step="0.001"
                                placeholder="0"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {formatCurrency(item.entry_quantity * item.unit_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-medium">
                          <td colSpan={8} className="py-2 px-3 text-right">
                            Seçilen Toplam Tutar:
                          </td>
                          <td className="py-2 px-3 text-right text-purple-700">
                            {formatCurrency(selectedInvoiceTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
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
