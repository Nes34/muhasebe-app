import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency, todayISO } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Order, OrderItem, Firm, Cari, Project, Product } from '../types';
import { Plus, Edit2, Trash2, Search, ShoppingCart, AlertTriangle, CheckCircle, Save, X, Package } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface OrderWithDetails extends Order {
  firm?: Firm;
  cari?: Cari;
  project?: Project;
  items?: OrderItem[];
}

export default function OrderEntry() {
  const { selectedFirm } = useFirm();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    order_date: todayISO(),
    firm_id: selectedFirm?.id || '',
    cari_id: '',
    project_id: '',
    description: '',
  });

  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedFirm]);

  useEffect(() => {
    if (selectedFirm) {
      setFormData(prev => ({ ...prev, firm_id: selectedFirm.id }));
    }
  }, [selectedFirm]);

  async function fetchData() {
    setLoading(true);
    const [ordersRes, firmsRes, carilerRes, projectsRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*, firm:firms(*), cari:cariler(*), project:projects(*), items:order_items(*, product:products(*))').order('created_at', { ascending: false }),
      supabase.from('firms').select('*').eq('is_active', true).order('name'),
      supabase.from('cariler').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('*, firm:firms(*)').eq('status', 'active').order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data as OrderWithDetails[]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (carilerRes.data) setCariler(carilerRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    setLoading(false);
  }

  function addItem() {
    setItems([...items, {
      id: crypto.randomUUID(),
      order_id: '',
      product_id: '',
      description: '',
      quantity: 1,
      unit: 'adet',
      unit_price: 0,
      amount: 0,
      delivered_quantity: 0,
      invoiced_quantity: 0,
      sort_order: items.length,
      created_at: new Date().toISOString(),
    }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...items];
    const item = { ...newItems[index] };
    (item as any)[field] = value;

    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        item.description = product.name;
        item.unit = product.unit;
        item.unit_price = product.unit_price;
      }
    }

    item.amount = item.quantity * item.unit_price;
    newItems[index] = item;
    setItems(newItems);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.firm_id) {
      setMessage({ type: 'error', text: 'Firma seçimi zorunludur' });
      return;
    }
    if (!formData.cari_id) {
      setMessage({ type: 'error', text: 'Cari seçimi zorunludur' });
      return;
    }
    if (!formData.project_id) {
      setMessage({ type: 'error', text: 'Proje seçimi zorunludur' });
      return;
    }
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'En az bir kalem ekleyin' });
      return;
    }

    try {
      const orderData = {
        order_date: formData.order_date,
        firm_id: formData.firm_id,
        cari_id: formData.cari_id,
        project_id: formData.project_id,
        description: formData.description || null,
        status: 'pending' as const,
        total_amount: totalAmount,
        currency: 'TRY',
      };

      let orderId: string;

      if (editingOrder) {
        const { error } = await supabase.from('orders').update(orderData).eq('id', editingOrder.id);
        if (error) throw error;
        orderId = editingOrder.id;

        // Eski kalemleri sil, yenisini ekle
        await supabase.from('order_items').delete().eq('order_id', orderId);
      } else {
        const { data, error } = await supabase.from('orders').insert(orderData).select().single();
        if (error) throw error;
        orderId = data.id;
      }

      // Kalemleri ekle
      const itemsToInsert = items.map((item, index) => ({
        order_id: orderId,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        amount: item.amount,
        delivered_quantity: 0,
        invoiced_quantity: 0,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      setMessage({ type: 'success', text: editingOrder ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu' });
      setShowForm(false);
      setEditingOrder(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'İşlem başarısız' });
    }
  }

  function handleEdit(order: OrderWithDetails) {
    setEditingOrder(order);
    setFormData({
      order_date: order.order_date,
      firm_id: order.firm_id || '',
      cari_id: order.cari_id || '',
      project_id: order.project_id || '',
      description: order.description || '',
    });
    setItems(order.items || []);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Sipariş silindi' });
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  function resetForm() {
    setFormData({
      order_date: todayISO(),
      firm_id: selectedFirm?.id || '',
      cari_id: '',
      project_id: '',
      description: '',
    });
    setItems([]);
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.order_number?.toString().includes(searchTerm) ||
      order.firm?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.cari?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesFirm = !selectedFirm || order.firm_id === selectedFirm.id;
    return matchesSearch && matchesStatus && matchesFirm;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { pending: 'Bekliyor', in_progress: 'Üretimde', completed: 'Tamamlandı', cancelled: 'İptal' };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getDeliveryProgress = (order: OrderWithDetails) => {
    if (!order.items || order.items.length === 0) return 0;
    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const deliveredQty = order.items.reduce((sum, item) => sum + item.delivered_quantity, 0);
    return totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;
  };

  const getInvoiceProgress = (order: OrderWithDetails) => {
    if (!order.items || order.items.length === 0) return 0;
    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const invoicedQty = order.items.reduce((sum, item) => sum + item.invoiced_quantity, 0);
    return totalQty > 0 ? Math.round((invoicedQty / totalQty) * 100) : 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart size={24} /> Sipariş Girişi
        </h1>
        <button
          onClick={() => { setEditingOrder(null); resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Yeni Sipariş
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600">Toplam Sipariş</p>
          <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-700">Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-700">Üretimde</p>
          <p className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === 'in_progress').length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-700">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'completed').length}</p>
        </div>
      </div>

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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="siparis-no" className="text-left py-3 px-4">Sipariş No</ResizableTh>
                <ResizableTh columnId="siparis-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
                <ResizableTh columnId="siparis-firma" className="text-left py-3 px-4">Firma</ResizableTh>
                <ResizableTh columnId="siparis-cari" className="text-left py-3 px-4">Cari</ResizableTh>
                <ResizableTh columnId="siparis-proje" className="text-left py-3 px-4">Proje</ResizableTh>
                <ResizableTh columnId="siparis-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
                <ResizableTh columnId="siparis-irsaliye" className="text-center py-3 px-4">İrsaliye</ResizableTh>
                <ResizableTh columnId="siparis-fatura" className="text-center py-3 px-4">Fatura</ResizableTh>
                <ResizableTh columnId="siparis-durum" className="text-center py-3 px-4">Durum</ResizableTh>
                <ResizableTh columnId="siparis-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const deliveryProgress = getDeliveryProgress(order);
                const invoiceProgress = getInvoiceProgress(order);
                return (
                  <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">#{order.order_number}</td>
                    <td className="py-3 px-4">{formatDateTR(order.order_date)}</td>
                    <td className="py-3 px-4">{order.firm?.name || '-'}</td>
                    <td className="py-3 px-4">{order.cari?.name || '-'}</td>
                    <td className="py-3 px-4">{order.project?.name || '-'}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(order.total_amount)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${deliveryProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${deliveryProgress}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-10 text-right">%{deliveryProgress}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${invoiceProgress === 100 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${invoiceProgress}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 w-10 text-right">%{invoiceProgress}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(order)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(order.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && (
          <div className="text-center py-8">
            <ShoppingCart size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">Henüz sipariş bulunamadı.</p>
          </div>
        )}
      </div>

      {/* Sipariş Formu */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingOrder ? 'Sipariş Düzenle' : 'Yeni Sipariş'}</h2>
              <button onClick={() => { setShowForm(false); setEditingOrder(null); }} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sipariş Tarihi</label>
                  <input type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Firma <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                    value={formData.firm_id}
                    onChange={(id) => setFormData({ ...formData, firm_id: id })}
                    placeholder="Firma seçin..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cari <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                    value={formData.cari_id}
                    onChange={(id) => setFormData({ ...formData, cari_id: id })}
                    placeholder="Cari seçin..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proje <span className="text-red-500">*</span></label>
                  <select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Proje Seçiniz...</option>
                    {projects.filter(p => !formData.firm_id || p.firm_id === formData.firm_id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {formData.firm_id && projects.filter(p => p.firm_id === formData.firm_id).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Bu firmaya ait proje bulunamadı</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Sipariş açıklaması..." />
              </div>

              {/* Sipariş Kalemleri */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-slate-800 flex items-center gap-2"><Package size={16} /> Sipariş Kalemleri</h3>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus size={14} /> Kalem Ekle <span className="text-[10px] text-blue-200 ml-1">(Alt+E)</span>
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <ResizableTh columnId="siparis-kalem-urun" className="text-left py-2 px-3">Ürün</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-aciklama" className="text-left py-2 px-3">Açıklama</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-miktar" className="text-right py-2 px-3">Miktar</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-birim" className="text-left py-2 px-3">Birim</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-fiyat" className="text-right py-2 px-3">Birim Fiyat</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-tutar" className="text-right py-2 px-3">Tutar</ResizableTh>
                          <ResizableTh columnId="siparis-kalem-sil" className="text-center py-2 px-3">Sil</ResizableTh>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="py-2 px-3">
                              <select value={item.product_id || ''} onChange={(e) => updateItem(index, 'product_id', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm">
                                <option value="">Seçiniz...</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input type="text" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right" step="0.001" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="text" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right" step="0.01" />
                            </td>
                            <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                            <td className="py-2 px-3 text-center">
                              <button type="button" onClick={() => removeItem(index)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-medium">
                          <td colSpan={5} className="py-2 px-3 text-right">Toplam:</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(totalAmount)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {items.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-slate-300 rounded-lg">
                    <Package size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500 text-sm">Henüz kalem eklenmedi</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button type="button" onClick={() => { setShowForm(false); setEditingOrder(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Save size={16} /> {editingOrder ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
