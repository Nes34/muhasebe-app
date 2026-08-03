import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { CashRegister, CashTransaction, Firm, Project } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle, Building2 } from 'lucide-react';

interface CashRegisterWithFirms extends CashRegister {
  firms: Firm[];
}

export default function CashManagement() {
  const { selectedFirm } = useFirm();
  const [registers, setRegisters] = useState<CashRegisterWithFirms[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [formData, setFormData] = useState({ name: '', currency: 'TRY', opening_balance: 0, firm_ids: [] as string[] });
  const [transactionData, setTransactionData] = useState<{ transaction_type: 'in' | 'out'; amount: number; description: string; firm_id: string; project_id: string }>({ transaction_type: 'in', amount: 0, description: '', firm_id: '', project_id: '' });
  const [editModal, setEditModal] = useState<CashRegisterWithFirms | null>(null);
  const [editBalance, setEditBalance] = useState(0);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selectedFirm) {
      setTransactionData(prev => ({ ...prev, firm_id: selectedFirm.id }));
    }
  }, [selectedFirm]);

  useEffect(() => {
    fetchRegisters();
    setSelectedRegister('');
    setTransactions([]);
  }, [selectedFirm]);

  const fetchData = async () => {
    const [firmsRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).order('code'),
      supabase.from('projects').select('*').eq('status', 'active').order('name'),
    ]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const fetchRegisters = async () => {
    // Tüm kasaları çek
    const { data: regs } = await supabase.from('cash_registers').select('*').eq('is_active', true).order('name');
    if (!regs) { setRegisters([]); return; }

    // Her kasanın firmalarını çek
    const regIds = regs.map(r => r.id);
    const { data: crfLinks } = await supabase.from('cash_register_firms').select('cash_register_id, firm_id').in('cash_register_id', regIds);

    const enriched: CashRegisterWithFirms[] = regs.map(reg => {
      const firmIds = crfLinks?.filter(l => l.cash_register_id === reg.id).map(l => l.firm_id) || [];
      const regFirms = firms.filter(f => firmIds.includes(f.id));
      return { ...reg, firms: regFirms };
    });

    // Firma filtresi uygula
    if (selectedFirm) {
      setRegisters(enriched.filter(r => r.firms.some(f => f.id === selectedFirm.id)));
    } else {
      setRegisters(enriched);
    }
  };

  const fetchTransactions = async (registerId: string) => {
    const { data } = await supabase.from('cash_transactions').select('*').eq('cash_register_id', registerId).order('created_at', { ascending: false }).limit(50);
    if (data) setTransactions(data);
  };

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: newReg, error } = await supabase.from('cash_registers').insert({ name: formData.name, currency: formData.currency, opening_balance: formData.opening_balance, current_balance: formData.opening_balance, is_active: true }).select().single();
    if (error) {
      if (error.code === '23505') { alert('Bu isimde bir kasa zaten mevcut!'); return; }
      alert('Kasa oluşturulurken hata: ' + error.message); return;
    }
    // Firmaları bağla
    if (newReg && formData.firm_ids.length > 0) {
      const links = formData.firm_ids.map(fid => ({ cash_register_id: newReg.id, firm_id: fid }));
      await supabase.from('cash_register_firms').insert(links);
    }
    setShowForm(false); setFormData({ name: '', currency: 'TRY', opening_balance: 0, firm_ids: [] }); fetchRegisters();
  };

  const handleUpdateOpeningBalance = async () => {
    if (!editModal) return;
    await supabase.from('cash_registers').update({ opening_balance: editBalance, current_balance: editBalance }).eq('id', editModal.id);
    setEditModal(null);
    fetchRegisters();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionData.firm_id) { alert('Cari seçimi zorunludur!'); return; }
    if (!transactionData.project_id) { alert('Proje seçimi zorunludur!'); return; }

    await supabase.from('cash_transactions').insert({
      cash_register_id: selectedRegister,
      firm_id: transactionData.firm_id,
      project_id: transactionData.project_id,
      transaction_type: transactionData.transaction_type,
      amount: transactionData.amount,
      description: transactionData.description,
    });

    const register = registers.find(r => r.id === selectedRegister);
    if (register) {
      const newBalance = transactionData.transaction_type === 'in' ? register.current_balance + transactionData.amount : register.current_balance - transactionData.amount;
      await supabase.from('cash_registers').update({ current_balance: newBalance }).eq('id', selectedRegister);
    }
    setShowTransactionForm(false); setTransactionData({ transaction_type: 'in', amount: 0, description: '', firm_id: selectedFirm?.id || '', project_id: '' });
    fetchRegisters(); if (selectedRegister) fetchTransactions(selectedRegister);
  };

  const toggleFirmId = (fid: string) => {
    setFormData(prev => ({
      ...prev,
      firm_ids: prev.firm_ids.includes(fid) ? prev.firm_ids.filter(id => id !== fid) : [...prev.firm_ids, fid],
    }));
  };

  const filteredProjects = projects.filter(p => !transactionData.firm_id || p.firm_id === transactionData.firm_id);

  // Hareketleri çek
  useEffect(() => {
    const fetchTx = async () => {
      if (selectedFirm) {
        const regIds = registers.map(r => r.id);
        if (regIds.length === 0) { setTransactions([]); return; }
        const { data } = await supabase.from('cash_transactions').select('*').in('cash_register_id', regIds).order('created_at', { ascending: false }).limit(50);
        if (data) setTransactions(data);
      } else {
        const { data } = await supabase.from('cash_transactions').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) setTransactions(data);
      }
    };
    fetchTx();
  }, [selectedFirm, registers]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kasa Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Kasa</button>
      </div>

      {/* Kasa Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {registers.map(register => (
          <div key={register.id} onClick={() => { setSelectedRegister(register.id); fetchTransactions(register.id); }} className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${selectedRegister === register.id ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{register.name}</h3>
              <button onClick={(e) => { e.stopPropagation(); setEditModal(register); setEditBalance(register.opening_balance || 0); }} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Düzenle</button>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(register.current_balance, register.currency)}</p>
            <p className="text-sm text-slate-500 mt-1">{register.currency}</p>
            <p className="text-xs text-slate-400 mt-1">Açılış: {formatCurrency(register.opening_balance || 0)}</p>
            {register.firms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {register.firms.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    <Building2 size={10} />{f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {registers.length === 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
            <p className="text-slate-500">{selectedFirm ? 'Bu firmaya ait kasa bulunamadı.' : 'Henüz kasa bulunamadı.'}</p>
          </div>
        )}
      </div>

      {/* Hareketler Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {selectedFirm ? `${selectedFirm.name} - Kasa Hareketleri` : 'Tüm Kasa Hareketleri'}
          </h2>
          {selectedRegister && (
            <button onClick={() => setShowTransactionForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus size={16} />Hareket Ekle</button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Tarih</th><th className="text-left py-3 px-4">Tür</th><th className="text-left py-3 px-4">Kasa</th><th className="text-left py-3 px-4">Cari</th><th className="text-left py-3 px-4">Proje</th><th className="text-right py-3 px-4">Tutar</th><th className="text-left py-3 px-4">Açıklama</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-3 px-4">{formatDateTR(t.created_at)}</td>
                <td className="py-3 px-4"><span className={`flex items-center gap-1 ${t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}`}>{t.transaction_type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}{t.transaction_type === 'in' ? 'Giriş' : 'Çıkış'}</span></td>
                <td className="py-3 px-4 text-slate-600">{registers.find(r => r.id === t.cash_register_id)?.name || '-'}</td>
                <td className="py-3 px-4 text-slate-600">{firms.find(f => f.id === t.firm_id)?.name || '-'}</td>
                <td className="py-3 px-4 text-slate-600">{projects.find(p => p.id === t.project_id)?.name || '-'}</td>
                <td className="py-3 px-4 text-right font-medium"><span className={t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}>{t.transaction_type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}</span></td>
                <td className="py-3 px-4 text-slate-600">{t.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500">Henüz hareket yok.</p>
          </div>
        )}
      </div>

      {/* Yeni Kasa Formu */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yeni Kasa Oluştur</h2>
            <form onSubmit={handleCreateRegister} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Kasa Adı</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label><select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Açılış Bakiyesi</label><input type="number" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firmalar</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {firms.map(f => (
                    <label key={f.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input type="checkbox" checked={formData.firm_ids.includes(f.id)} onChange={() => toggleFirmId(f.id)} className="rounded text-blue-600" />
                      <span className="text-sm">{f.code ? `${f.code} - ` : ''}{f.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">Birden fazla firmaya bağlayabilirsiniz</p>
              </div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Oluştur</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Hareket Ekleme Formu */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Kasa Hareketi Ekle</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Hareket Türü</label><div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tt" value="in" checked={transactionData.transaction_type === 'in'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-green-600" /><span className="text-green-600 font-medium">Giriş</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tt" value="out" checked={transactionData.transaction_type === 'out'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-red-600" /><span className="text-red-600 font-medium">Çıkış</span></label>
              </div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Cari <span className="text-red-500">*</span></label>
                <select value={transactionData.firm_id} onChange={(e) => setTransactionData({ ...transactionData, firm_id: e.target.value, project_id: '' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                  <option value="">Cari Seçin</option>
                  {firms.map(f => <option key={f.id} value={f.id}>{f.code ? `${f.code} - ` : ''}{f.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Proje <span className="text-red-500">*</span></label>
                <select value={transactionData.project_id} onChange={(e) => setTransactionData({ ...transactionData, project_id: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                  <option value="">Proje Seçin</option>
                  {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label><input type="number" value={transactionData.amount} onChange={(e) => setTransactionData({ ...transactionData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label><input type="text" value={transactionData.description} onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowTransactionForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Açılış Bakiyesi Düzenleme */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Açılış Bakiyesi Düzenle</h2>
            <p className="text-sm text-slate-600 mb-4">{editModal.name}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Açılış Bakiyesi</label>
              <input type="number" value={editBalance} onChange={(e) => setEditBalance(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              <p className="text-xs text-slate-500 mt-1">Not: Bu değişiklik mevcut bakiyeyi de sıfırlar</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
              <button onClick={handleUpdateOpeningBalance} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
