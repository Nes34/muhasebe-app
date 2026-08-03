import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateNextCode, findSimilar } from '../lib/utils';
import { exportToExcel, importFromExcel } from '../lib/excel';
import type { Product } from '../types';
import { Plus, Edit2, Trash2, Search, Upload, AlertTriangle, CheckCircle, Package } from 'lucide-react';

export default function StockManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [similarWarning, setSimilarWarning] = useState<Product[]>([]);
  const [autoCode, setAutoCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    stock_quantity: 0,
    unit: 'adet',
    unit_price: 0,
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
      await supabase.from('products').update({ name: formData.name, stock_quantity: formData.stock_quantity, unit: formData.unit, unit_price: formData.unit_price }).eq('id', editingProduct.id);
      setMessage({ type: 'success', text: 'Ürün başarıyla güncellendi!' });
    } else {
      const codes = products.map(p => p.code || '').filter(Boolean);
      const newCode = generateNextCode(codes, formData.name);

      await supabase.from('products').insert({
        code: newCode,
        name: formData.name,
        stock_quantity: formData.stock_quantity,
        unit: formData.unit,
        unit_price: formData.unit_price,
        is_active: true,
      });
      setMessage({ type: 'success', text: `"${formData.name}" ürünü "${newCode}" koduyla eklendi!` });
    }
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ name: '', stock_quantity: 0, unit: 'adet', unit_price: 0 });
    setSimilarWarning([]);
    fetchProducts();
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({ name: product.name, stock_quantity: product.stock_quantity, unit: product.unit, unit_price: product.unit_price });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      await supabase.from('products').update({ is_active: false }).eq('id', id);
      fetchProducts();
    }
  };

  const handleExport = () => {
    exportToExcel(products.map(p => ({ 'Kod': p.code, 'Ürün Adı': p.name, 'Stok': p.stock_quantity, 'Birim': p.unit, 'Birim Fiyat': p.unit_price })), 'stok-listesi', 'Stok');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromExcel(file);
      const codes = products.map(p => p.code || '').filter(Boolean);
      let currentCodes = [...codes];
      let importedCount = 0;

      for (const row of data) {
        const name = (row['Ürün Adı'] || row['ürün adı'] || row['name'] || '') as string;
        if (!name) continue;

        const exists = products.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;

        const newCode = generateNextCode(currentCodes, name);
        currentCodes.push(newCode);

        const { error } = await supabase.from('products').insert({
          code: newCode,
          name: name.trim(),
          stock_quantity: (row['Stok'] || row['stok'] || 0) as number,
          unit: (row['Birim'] || row['birim'] || 'adet') as string,
          unit_price: (row['Birim Fiyat'] || row['birim fiyat'] || 0) as number,
          is_active: true,
        });

        if (!error) importedCount++;
      }

      setMessage({ type: 'success', text: `${importedCount} ürün başarıyla içe aktarıldı!` });
      fetchProducts();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Excel import hatası:', error);
      setMessage({ type: 'error', text: 'Excel dosyası okunurken bir hata oluştu.' });
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Stok Yönetimi</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">
            <Upload size={16} />Excel İçe Aktar
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors">Excel İndir</button>
          <button onClick={() => { setEditingProduct(null); setFormData({ name: '', stock_quantity: 0, unit: 'adet', unit_price: 0 }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Ürün ara... (kod veya isim)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-96 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingProduct && autoCode && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                  <span className="text-sm text-green-600">Otomatik Kod:</span>
                  <span className="font-mono font-bold text-green-800 text-lg">{autoCode}</span>
                </div>
              )}

              {similarWarning.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Benzer ürünler bulundu:</span>
                  </div>
                  <div className="space-y-1">
                    {similarWarning.map(p => (
                      <div key={p.id} className="text-sm text-amber-700 flex items-center gap-2">
                        <span className="font-mono text-xs bg-amber-100 px-1 rounded">{p.code}</span>
                        <span>{p.name}</span>
                        <span className="text-xs text-amber-500">(Stok: {p.stock_quantity})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">Yine de kaydetmek istiyor musunuz?</p>
                </div>
              )}

              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ürün Adı</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Stok</label><input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Birim</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                    <option value="adet">Adet</option><option value="kg">Kg</option><option value="lt">Lt</option><option value="m">Metre</option><option value="m2">m²</option><option value="m3">m³</option><option value="paket">Paket</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Birim Fiyat</label><input type="number" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingProduct(null); setSimilarWarning([]); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Kod</th><th className="text-left py-3 px-4">Ürün Adı</th><th className="text-right py-3 px-4">Stok</th><th className="text-left py-3 px-4">Birim</th><th className="text-right py-3 px-4">Birim Fiyat</th><th className="text-center py-3 px-4">İşlemler</th></tr></thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded font-mono text-xs font-bold">{product.code || '-'}</span></td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Package size={16} className="text-slate-600" /></div>
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-medium">{product.stock_quantity}</td>
                <td className="py-3 px-4">{product.unit}</td>
                <td className="py-3 px-4 text-right">{product.unit_price.toLocaleString('tr-TR')} ₺</td>
                <td className="py-3 px-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEdit(product)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button><button onClick={() => handleDelete(product.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && <p className="text-center py-8 text-slate-500">Ürün bulunamadı.</p>}
      </div>
    </div>
  );
}
