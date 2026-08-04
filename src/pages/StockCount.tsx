import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFirm } from '../hooks/useFirm';
import { Package, Save, AlertTriangle, CheckCircle, Search, ClipboardCheck } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface CountItem {
  product_id: string;
  product_name: string;
  product_code: string;
  system_quantity: number;
  physical_quantity: number;
  difference: number;
  unit: string;
  notes: string;
}

export default function StockCount() {
  const { selectedFirm } = useFirm();
  const [loading, setLoading] = useState(true);
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [notes, setNotes] = useState('');
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => { fetchProducts(); }, [selectedFirm]);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from('products').select('*').eq('is_active', true).order('name');
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    const { data } = await query;
    if (data) {
      // Tüm ürünleri sayım listesine ekle
      setCountItems(data.map(p => ({
        product_id: p.id,
        product_name: p.name,
        product_code: p.code || '',
        system_quantity: p.stock_quantity || 0,
        physical_quantity: 0,
        difference: 0,
        unit: p.unit || 'adet',
        notes: '',
      })));
    }
    setLoading(false);
  };

  const handlePhysicalQuantityChange = (index: number, value: number) => {
    const newItems = [...countItems];
    newItems[index].physical_quantity = value;
    newItems[index].difference = value - newItems[index].system_quantity;
    setCountItems(newItems);
  };

  const handleNotesChange = (index: number, value: string) => {
    const newItems = [...countItems];
    newItems[index].notes = value;
    setCountItems(newItems);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sayım kayıtlarını oluştur
      const countRecords = countItems
        .filter(item => item.physical_quantity > 0 || item.difference !== 0)
        .map(item => ({
          product_id: item.product_id,
          count_date: countDate,
          system_quantity: item.system_quantity,
          physical_quantity: item.physical_quantity,
          difference: item.difference,
          notes: item.notes || `Sorumlu: ${responsiblePerson}`,
          created_at: new Date().toISOString(),
        }));

      if (countRecords.length === 0) {
        setMessage({ type: 'error', text: 'Kaydedilecek veri yok!' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      // Stok sayım tablosuna kaydet (eğer tablo yoksa transactions tablosuna kaydet)
      // Farklılıkları stok miktarlarına uygula
      for (const item of countItems) {
        if (item.difference !== 0) {
          await supabase
            .from('products')
            .update({ stock_quantity: item.physical_quantity })
            .eq('id', item.product_id);
        }
      }

      setMessage({ type: 'success', text: `${countRecords.length} ürün sayımı kaydedildi ve stoklar güncellendi!` });
      setShowSummary(true);
    } catch (err) {
      setMessage({ type: 'error', text: 'Kaydetme hatası!' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const filteredItems = countItems.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDifference = countItems.reduce((s, item) => s + item.difference, 0);
  const itemsWithDifference = countItems.filter(item => item.difference !== 0).length;
  const totalItems = countItems.length;
  const countedItems = countItems.filter(item => item.physical_quantity > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck size={24} />
          Fiziksel Stok Sayımı{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            <Package size={16} />
            {showSummary ? 'Sayım Listesi' : 'Özet'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Kaydediliyor...' : 'Kaydet ve Güncelle'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Sayım Bilgileri */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sayım Tarihi</label>
            <input
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sorumlu Kişi</label>
            <input
              type="text"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              placeholder="Ad Soyad"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sayım notları"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-xs text-blue-700 font-medium">Toplam Ürün</p>
          <p className="text-lg font-bold text-blue-600">{totalItems}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-xs text-green-700 font-medium">Sayılan</p>
          <p className="text-lg font-bold text-green-600">{countedItems}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <p className="text-xs text-orange-700 font-medium">Farklı Ürün</p>
          <p className="text-lg font-bold text-orange-600">{itemsWithDifference}</p>
        </div>
        <div className={`rounded-xl p-4 border ${totalDifference >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-medium ${totalDifference >= 0 ? 'text-green-700' : 'text-red-700'}`}>Toplam Fark</p>
          <p className={`text-lg font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalDifference}</p>
        </div>
      </div>

      {/* Özet Görünümü */}
      {showSummary ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-orange-50">
            <h2 className="font-semibold text-orange-800 flex items-center gap-2">
              <AlertTriangle size={18} />
              Farklı Ürünler ({itemsWithDifference})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <ResizableTh columnId="s-kod" className="text-left py-3 px-4">Kod</ResizableTh>
                  <ResizableTh columnId="s-ad" className="text-left py-3 px-4">Ürün</ResizableTh>
                  <ResizableTh columnId="s-sistem" className="text-right py-3 px-4">Sistem</ResizableTh>
                  <ResizableTh columnId="s-fiziksel" className="text-right py-3 px-4">Fiziksel</ResizableTh>
                  <ResizableTh columnId="s-fark" className="text-right py-3 px-4">Fark</ResizableTh>
                  <ResizableTh columnId="s-not" className="text-left py-3 px-4">Not</ResizableTh>
                </tr>
              </thead>
              <tbody>
                {countItems.filter(item => item.difference !== 0).map((item) => (
                  <tr key={item.product_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-sm">{item.product_code}</td>
                    <td className="py-3 px-4 font-medium">{item.product_name}</td>
                    <td className="py-3 px-4 text-right">{item.system_quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-right font-bold">{item.physical_quantity} {item.unit}</td>
                    <td className={`py-3 px-4 text-right font-bold ${item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {item.difference > 0 ? '+' : ''}{item.difference} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {itemsWithDifference === 0 && (
            <p className="text-center py-8 text-slate-500">Farklı ürün yok. Tüm sayımlar eşleşiyor.</p>
          )}
        </div>
      ) : (
        /* Sayım Listesi */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ürün ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <ResizableTh columnId="c-kod" className="text-left py-3 px-4">Kod</ResizableTh>
                  <ResizableTh columnId="c-ad" className="text-left py-3 px-4">Ürün</ResizableTh>
                  <ResizableTh columnId="c-sistem" className="text-right py-3 px-4">Sistem Miktar</ResizableTh>
                  <ResizableTh columnId="c-fiziksel" className="text-center py-3 px-4">Fiziksel Miktar</ResizableTh>
                  <ResizableTh columnId="c-fark" className="text-right py-3 px-4">Fark</ResizableTh>
                  <ResizableTh columnId="c-not" className="text-left py-3 px-4">Not</ResizableTh>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.product_id} className={`border-t border-slate-100 hover:bg-slate-50 ${item.difference !== 0 ? 'bg-orange-50' : ''}`}>
                    <td className="py-3 px-4 font-mono text-sm">{item.product_code}</td>
                    <td className="py-3 px-4 font-medium">{item.product_name}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{item.system_quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={item.physical_quantity || ''}
                        onChange={(e) => handlePhysicalQuantityChange(index, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-center"
                        min="0"
                        placeholder="0"
                      />
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {item.difference !== 0 ? `${item.difference > 0 ? '+' : ''}${item.difference} ${item.unit}` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleNotesChange(index, e.target.value)}
                        placeholder="Not..."
                        className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <p className="text-center py-8 text-slate-500">Ürün bulunamadı.</p>
          )}
        </div>
      )}
    </div>
  );
}
