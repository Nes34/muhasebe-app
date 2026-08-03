import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { StockUnit } from '../types';
import { Plus, Edit2, Trash2, Ruler } from 'lucide-react';

export default function StockUnitManagement() {
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StockUnit | null>(null);
  const [formData, setFormData] = useState({ name: '', symbol: '' });

  useEffect(() => { fetchUnits(); }, []);

  const fetchUnits = async () => {
    const { data } = await supabase.from('stock_units').select('*').order('sort_order');
    if (data) setUnits(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      await supabase.from('stock_units').update({ name: formData.name, symbol: formData.symbol.toLowerCase() }).eq('id', editingUnit.id);
    } else {
      const maxOrder = units.length > 0 ? Math.max(...units.map(u => u.sort_order)) + 1 : 1;
      await supabase.from('stock_units').insert({ name: formData.name, symbol: formData.symbol.toLowerCase(), sort_order: maxOrder, is_active: true });
    }
    setShowForm(false);
    setEditingUnit(null);
    setFormData({ name: '', symbol: '' });
    fetchUnits();
  };

  const handleEdit = (unit: StockUnit) => {
    setEditingUnit(unit);
    setFormData({ name: unit.name, symbol: unit.symbol });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu birimi silmek istediğinizden emin misiniz?')) {
      await supabase.from('stock_units').update({ is_active: false }).eq('id', id);
      fetchUnits();
    }
  };

  const activeUnits = units.filter(u => u.is_active);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Stok Birimleri</h1>
        <button onClick={() => { setEditingUnit(null); setFormData({ name: '', symbol: '' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} />Yeni Birim
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {activeUnits.map(unit => (
          <div key={unit.id} className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Ruler size={16} className="text-slate-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{unit.name}</p>
                  <p className="text-sm text-slate-500">{unit.symbol}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(unit)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(unit.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeUnits.length === 0 && (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
          <Ruler size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Henüz birim eklenmemiş.</p>
        </div>
      )}

      {/* Özet */}
      <div className="mt-6 bg-slate-50 rounded-xl p-4">
        <p className="text-sm text-slate-600">
          Toplam <span className="font-semibold">{activeUnits.length}</span> birim tanımlı
        </p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingUnit ? 'Birim Düzenle' : 'Yeni Birim'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Birim Adı</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (!editingUnit) {
                      setFormData(prev => ({ ...prev, symbol: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 10) }));
                    }
                  }}
                  placeholder="Örn: Kilogram"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sembol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="Örn: kg"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">Kısa kod olarak kullanılır (adet, kg, lt vb.)</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingUnit(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingUnit ? 'Güncelle' : 'Ekle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
