import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import type { CashRegister, CashTransaction } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function CashManagement() {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState('');
  
  const [formData, setFormData] = useState({ name: '', currency: 'TRY' });
  const [transactionData, setTransactionData] = useState({ transaction_type: 'in' as 'in' | 'out', amount: 0, description: '' });

  useEffect(() => { fetchRegisters(); }, []);

  const fetchRegisters = async () => {
    const { data } = await supabase.from('cash_registers').select('*').eq('is_active', true).order('name');
    if (data) setRegisters(data);
    setLoading(false);
  };

  const fetchTransactions = async (registerId: string) => {
    const { data } = await supabase.from('cash_transactions').select('*').eq('cash_register_id', registerId).order('created_at', { ascending: false }).limit(50);
    if (data) setTransactions(data);
  };

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('cash_registers').insert({ ...formData, current_balance: 0, is_active: true });
    setShowForm(false); setFormData({ name: '', currency: 'TRY' }); fetchRegisters();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('cash_transactions').insert({ cash_register_id: selectedRegister, ...transactionData });
    const register = registers.find(r => r.id === selectedRegister);
    if (register) {
      const newBalance = transactionData.transaction_type === 'in' ? register.current_balance + transactionData.amount : register.current_balance - transactionData.amount;
      await supabase.from('cash_registers').update({ current_balance: newBalance }).eq('id', selectedRegister);
    }
    setShowTransactionForm(false); setTransactionData({ transaction_type: 'in', amount: 0, description: '' });
    fetchRegisters(); if (selectedRegister) fetchTransactions(selectedRegister);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kasa Yönetimi</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Kasa</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {registers.map(register => (
          <div key={register.id} onClick={() => { setSelectedRegister(register.id); fetchTransactions(register.id); }} className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${selectedRegister === register.id ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}>
            <h3 className="font-semibold text-slate-800">{register.name}</h3>
            <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(register.current_balance, register.currency)}</p>
            <p className="text-sm text-slate-500 mt-1">{register.currency}</p>
          </div>
        ))}
      </div>

      {selectedRegister && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Son Hareketler</h2>
            <button onClick={() => setShowTransactionForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus size={16} />Hareket Ekle</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Tarih</th><th className="text-left py-3 px-4">Tür</th><th className="text-right py-3 px-4">Tutar</th><th className="text-left py-3 px-4">Açıklama</th></tr></thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-3 px-4">{formatDateTR(t.created_at)}</td>
                  <td className="py-3 px-4"><span className={`flex items-center gap-1 ${t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}`}>{t.transaction_type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}{t.transaction_type === 'in' ? 'Giriş' : 'Çıkış'}</span></td>
                  <td className="py-3 px-4 text-right font-medium"><span className={t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}>{t.transaction_type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}</span></td>
                  <td className="py-3 px-4 text-slate-600">{t.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="text-center py-8 text-slate-500">Henüz hareket yok.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yeni Kasa Oluştur</h2>
            <form onSubmit={handleCreateRegister} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Kasa Adı</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label><select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Oluştur</button></div>
            </form>
          </div>
        </div>
      )}

      {showTransactionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Kasa Hareketi Ekle</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Hareket Türü</label><div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tt" value="in" checked={transactionData.transaction_type === 'in'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-green-600" /><span className="text-green-600 font-medium">Giriş</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tt" value="out" checked={transactionData.transaction_type === 'out'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-red-600" /><span className="text-red-600 font-medium">Çıkış</span></label>
              </div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label><input type="number" value={transactionData.amount} onChange={(e) => setTransactionData({ ...transactionData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label><input type="text" value={transactionData.description} onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowTransactionForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}