import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateNextCode, findSimilar, formatCurrency } from '../lib/utils';
import { exportToExcel } from '../lib/excel';
import type { Product } from '../types';
import { Plus, Edit2, Trash2, Search, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function StockManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [similarWarning, setSimilarWarning] = useState<Product[]>([]);
  const [autoCode, setAutoCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    stock_quantity: 0,
    unit: 'adet',
    unit_price: 0,
    min_stock_level: 0,
    category: '',
    product_type: 'stock' as 'stock' | 'service' | 'expense',
    is_fixed_asset: false,
  });

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    if (formData.name && !editingProduct) {
      const codes = products.map(p => p.code || '').filter(Boolean);
      setAutoCode(generateNextCode(codes, formData.name));
      const similar = findSimilar(products, formData.name);
      setSimilarWarning(similar);
    } else {
      setAutoCode('');
      setSimilarWarning([]);
    }
  }, [formData.name, products, editingProduct]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      await supabase.from('products').update({
        name: formData.name, barcode: formData.barcode || null, stock_quantity: formData.stock_quantity,
        unit: formData.unit, unit_price: formData.unit_price, min_stock_level: formData.min_stock_level, 
        category: formData.category || null, product_type: formData.product_type, is_fixed_asset: formData.is_fixed_asset,
      }).eq('id', editingProduct.id);
      setMessage({ type: 'success', text: 'Ürün başarıyla güncellendi!' });
    } else {
      const codes = products.map(p => p.code || '').filter(Boolean);
      const newCode = generateNextCode(codes, formData.name);
      await supabase.from('products').insert({
        code: newCode, name: formData.name, barcode: formData.barcode || null,
        stock_quantity: formData.stock_quantity, unit: formData.unit, unit_price: formData.unit_price,
        min_stock_level: formData.min_stock_level, category: formData.category || null, 
        product_type: formData.product_type, is_fixed_asset: formData.is_fixed_asset, is_active: true,
      });
      setMessage({ type: 'success', text: `"${formData.name}" ürünü "${newCode}" koduyla eklendi!` });
    }
    setShowForm(false); setEditingProduct(null);
    setFormData({ name: '', barcode: '', stock_quantity: 0, unit: 'adet', unit_price: 0, min_stock_level: 0, category: '', product_type: 'stock', is_fixed_asset: false });
    setSimilarWarning([]);
    fetchProducts();
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name, barcode: product.barcode || '', stock_quantity: product.stock_quantity,
      unit: product.unit, unit_price: product.unit_price, min_stock_level: product.min_stock_level || 0, category: product.category || '',
      product_type: (product as any).product_type || 'stock', is_fixed_asset: (product as any).is_fixed_asset || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      await supabase.from('products').update({ is_active: false }).eq('id', id);
      fetchProducts();
    }
  };

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm);
    const matchesCategory = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => p.min_stock_level && p.stock_quantity <= p.min_stock_level);
  const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Stok Yönetimi</h1>
        <div className="flex gap-2">
          <button onClick={() => exportToExcel(products.map(p => ({ 'Kod': p.code, 'Ürün': p.name, 'Barkod': p.barcode || '', 'Kategori': p.category || '', 'Stok': p.stock_quantity, 'Birim': p.unit, 'Birim Fiyat': p.unit_price, 'Min Stok': p.min_stock_level || 0 })), 'stok-listesi')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download size={16} />Excel İndir
          </button>
          <button onClick={() => { setEditingProduct(null); setFormData({ name: '', barcode: '', stock_quantity: 0, unit: 'adet', unit_price: 0, min_stock_level: 0, category: '', product_type: 'stock', is_fixed_asset: false }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={16} />Yeni Ürün
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Uyarılar */}
      {lowStockProducts.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle size={20} />
            <span className="font-semibold">Düşük Stok Uyarısı ({lowStockProducts.length} ürün)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {lowStockProducts.map(p => (
              <div key={p.id} className="bg-white rounded-lg p-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-red-600 ml-2">{p.stock_quantity} {p.unit}</span>
                <span className="text-slate-400 ml-1">(min: {p.min_stock_level})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Toplam Ürün</p>
          <p className="text-2xl font-bold text-slate-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Toplam Stok Değeri</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Düşük Stok</p>
          <p className="text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-600">Kategori</p>
          <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Ürün, kod veya barkod ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">Tüm Kategoriler</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Ürün Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="stok-kod" className="text-left py-3 px-4">Kod</ResizableTh>
                <ResizableTh columnId="stok-barkod" className="text-left py-3 px-4">Barkod</ResizableTh>
                <ResizableTh columnId="stok-urun" className="text-left py-3 px-4">Ürün Adı</ResizableTh>
                <ResizableTh columnId="stok-tur" className="text-center py-3 px-4">Tür</ResizableTh>
                <ResizableTh columnId="stok-demirbas" className="text-center py-3 px-4">Demirbaş</ResizableTh>
                <ResizableTh columnId="stok-kategori" className="text-left py-3 px-4">Kategori</ResizableTh>
                <ResizableTh columnId="stok-stok" className="text-right py-3 px-4">Stok</ResizableTh>
                <ResizableTh columnId="stok-min" className="text-right py-3 px-4">Min. Stok</ResizableTh>
                <ResizableTh columnId="stok-fiyat" className="text-right py-3 px-4">Birim Fiyat</ResizableTh>
                <ResizableTh columnId="stok-toplam" className="text-right py-3 px-4">Toplam Değer</ResizableTh>
                <ResizableTh columnId="stok-durum" className="text-center py-3 px-4">Durum</ResizableTh>
                <ResizableTh columnId="stok-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const isLow = product.min_stock_level && product.stock_quantity <= product.min_stock_level;
                return (
                  <tr key={product.id} className={`border-t border-slate-100 hover:bg-slate-50 ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="py-3 px-4 font-mono text-xs font-bold text-blue-600">{product.code}</td>
                    <td className="py-3 px-4 font-mono text-xs">{product.barcode || '-'}</td>
                    <td className="py-3 px-4 font-medium">{product.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        product.product_type === 'stock' ? 'bg-blue-100 text-blue-700' :
                        product.product_type === 'service' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {product.product_type === 'stock' ? 'Stok' : product.product_type === 'service' ? 'Hizmet' : 'Masraf'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {product.is_fixed_asset ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Demirbaş</span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{product.category || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono">{product.stock_quantity} {product.unit}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{product.min_stock_level || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(product.unit_price)}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium">{formatCurrency(product.stock_quantity * product.unit_price)}</td>
                    <td className="py-3 px-4 text-center">
                      {isLow ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Düşük Stok</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Yeterli</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(product)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center py-8 text-slate-500">Ürün bulunamadı.</p>}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingProduct && autoCode && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                  <span className="text-sm text-blue-600">Otomatik Kod:</span>
                  <span className="font-mono font-bold text-blue-800 text-lg">{autoCode}</span>
                </div>
              )}
              {similarWarning.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-600" /><span className="text-sm font-medium text-amber-800">Benzer ürünler bulundu:</span></div>
                  <div className="space-y-1">{similarWarning.map(p => <div key={p.id} className="text-sm text-amber-700">{p.code} - {p.name}</div>)}</div>
                </div>
              )}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ürün Adı *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Barkod</label><input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="8690123456789" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Stok Miktarı *</label><input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Min. Stok</label><input type="number" value={formData.min_stock_level} onChange={(e) => setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Birim</label><select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="adet">Adet</option><option value="kg">Kg</option><option value="lt">Litre</option><option value="mt">Metre</option><option value="m2">m²</option><option value="m3">m³</option><option value="kutu">Kutu</option><option value="paket">Paket</option></select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Birim Fiyat *</label><input type="number" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label><input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Elektronik, Gıda, vb." /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tür</label>
                  <select value={formData.product_type} onChange={(e) => setFormData({ ...formData, product_type: e.target.value as 'stock' | 'service' | 'expense' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                    <option value="stock">Stok</option>
                    <option value="service">Hizmet</option>
                    <option value="expense">Masraf</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_fixed_asset" checked={formData.is_fixed_asset} onChange={(e) => setFormData({ ...formData, is_fixed_asset: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="is_fixed_asset" className="text-sm font-medium text-slate-700">Demirbaş</label>
                </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingProduct(null); setSimilarWarning([]); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
