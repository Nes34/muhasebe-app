import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SearchableSelect from '../components/SearchableSelect';
import type { Product } from '../types';
import { Package, ArrowRight, CheckCircle, AlertTriangle, GitMerge } from 'lucide-react';

export default function StockMerge() {
  const [products, setProducts] = useState<Product[]>([]);
  const [fromProductId, setFromProductId] = useState('');
  const [toProductId, setToProductId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data);
  };

  const fromProduct = products.find(p => p.id === fromProductId);
  const toProduct = products.find(p => p.id === toProductId);

  const handleMerge = async () => {
    if (!fromProductId || !toProductId) {
      setMessage({ type: 'error', text: 'Lütfen kaynak ve hedef ürünü seçin.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (fromProductId === toProductId) {
      setMessage({ type: 'error', text: 'Kaynak ve hedef ürün aynı olamaz.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!confirm(`"${fromProduct?.name}" ürünündeki ${(fromProduct?.stock_quantity || 0)} adet stok, "${toProduct?.name}" ürününe aktarılacak ve "${fromProduct?.name}" pasife alınacak. Onaylıyor musunuz?`)) {
      return;
    }

    setLoading(true);

    // Hedef ürüne ekle
    await supabase.from('products').update({
      stock_quantity: (toProduct?.stock_quantity || 0) + (fromProduct?.stock_quantity || 0),
    }).eq('id', toProductId);

    // Kaynak ürünü pasifle
    await supabase.from('products').update({
      is_active: false,
    }).eq('id', fromProductId);

    setMessage({ type: 'success', text: `"${fromProduct?.name}" "${toProduct?.name}" ile birleştirildi!` });
    setFromProductId('');
    setToProductId('');
    fetchData();
    setLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Stok Birleştirme</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Dikkat!</h3>
              <p className="text-sm text-amber-700 mt-1">Bu işlem geri alınamaz. Kaynak ürünün stoku hedef ürüne aktarılacak ve kaynak ürün pasife alınacaktır.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kaynak Ürün */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Package size={18} className="text-red-500" />
              Birleştirilecek Ürün (Pasif Olacak)
            </h3>
            <SearchableSelect
              options={products.map(p => ({ id: p.id, code: p.code, name: `${p.name} (Stok: ${p.stock_quantity})` }))}
              value={fromProductId}
              onChange={(id) => setFromProductId(id)}
              placeholder="Ürün seçin..."
            />
            {fromProduct && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">Stok: <span className="font-bold">{fromProduct.stock_quantity} {fromProduct.unit}</span></p>
                <p className="text-xs text-red-600 mt-1">Bu ürün birleştirme sonrası pasife alınacak</p>
              </div>
            )}
          </div>

          {/* Hedef Ürün */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Package size={18} className="text-green-500" />
              Hedef Ürün (Birleştirilecek)
            </h3>
            <SearchableSelect
              options={products.filter(p => p.id !== fromProductId).map(p => ({ id: p.id, code: p.code, name: `${p.name} (Stok: ${p.stock_quantity})` }))}
              value={toProductId}
              onChange={(id) => setToProductId(id)}
              placeholder="Ürün seçin..."
            />
            {toProduct && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">Mevcut Stok: <span className="font-bold">{toProduct.stock_quantity} {toProduct.unit}</span></p>
              </div>
            )}
          </div>
        </div>

        {/* Birleştirme Özeti */}
        {fromProduct && toProduct && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-700 mb-3">Birleştirme Özeti:</h4>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-500">{fromProduct.name}</p>
                <p className="text-lg font-bold text-red-600">-{fromProduct.stock_quantity} {fromProduct.unit}</p>
              </div>
              <ArrowRight size={24} className="text-slate-400" />
              <div className="text-center">
                <p className="text-sm text-slate-500">{toProduct.name}</p>
                <p className="text-lg font-bold text-green-600">+{fromProduct.stock_quantity} {toProduct.unit}</p>
                <p className="text-xs text-slate-500">Toplam: {(toProduct.stock_quantity || 0) + (fromProduct.stock_quantity || 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Birleştir Butonu */}
        <div className="mt-6">
          <button
            onClick={handleMerge}
            disabled={loading || !fromProductId || !toProductId}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <GitMerge size={18} />
            {loading ? 'Birleştiriliyor...' : 'Stokları Birleştir'}
          </button>
        </div>
      </div>
    </div>
  );
}
