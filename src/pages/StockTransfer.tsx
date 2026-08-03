import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Product } from '../types';
import { Package, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

export default function StockTransfer() {
  const { selectedFirm } = useFirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [fromProductId, setFromProductId] = useState('');
  const [toProductId, setToProductId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedFirm]);

  const fetchData = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data);
  };

  const fromProduct = products.find(p => p.id === fromProductId);
  const toProduct = products.find(p => p.id === toProductId);

  const handleTransfer = async () => {
    if (!fromProductId || !toProductId || quantity <= 0) {
      setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (fromProductId === toProductId) {
      setMessage({ type: 'error', text: 'Kaynak ve hedef ürün aynı olamaz.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (fromProduct && fromProduct.stock_quantity < quantity) {
      setMessage({ type: 'error', text: `Yetersiz stok! Mevcut: ${fromProduct.stock_quantity}` });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setLoading(true);

    // Kaynak üründen düş
    await supabase.from('products').update({
      stock_quantity: (fromProduct?.stock_quantity || 0) - quantity,
    }).eq('id', fromProductId);

    // Hedef ürüne ekle
    await supabase.from('products').update({
      stock_quantity: (toProduct?.stock_quantity || 0) + quantity,
    }).eq('id', toProductId);

    setMessage({ type: 'success', text: `${quantity} adet stok başarıyla aktarıldı!` });
    setFromProductId('');
    setToProductId('');
    setQuantity(0);
    fetchData();
    setLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Stok Aktarımı</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kaynak Ürün */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Package size={18} className="text-red-500" />
              Kaynak Ürün
            </h3>
            <SearchableSelect
              options={products.map(p => ({ id: p.id, code: p.code, name: `${p.name} (Stok: ${p.stock_quantity})` }))}
              value={fromProductId}
              onChange={(id) => setFromProductId(id)}
              placeholder="Ürün seçin..."
            />
            {fromProduct && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">Mevcut Stok: <span className="font-bold">{fromProduct.stock_quantity} {fromProduct.unit}</span></p>
              </div>
            )}
          </div>

          {/* Hedef Ürün */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Package size={18} className="text-green-500" />
              Hedef Ürün
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

        {/* Miktar ve Transfer */}
        <div className="mt-6 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Aktarılacak Miktar</label>
            <input
              type="number"
              value={quantity || ''}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              max={fromProduct?.stock_quantity || 0}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Miktar girin"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <ArrowRight size={24} className="text-slate-400" />
          </div>
          <div className="flex-1 pt-6">
            <button
              onClick={handleTransfer}
              disabled={loading || !fromProductId || !toProductId || quantity <= 0}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Aktarılıyor...' : 'Stok Aktar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
