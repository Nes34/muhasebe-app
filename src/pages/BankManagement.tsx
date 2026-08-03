import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { BankAccount, BankTransaction, Firm, Project } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle, Building2, AlertTriangle } from 'lucide-react';

export default function BankManagement() {
  const { selectedFirm } = useFirm();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  
  const [formData, setFormData] = useState({ bank_name: '', branch: '', account_number: '', iban: '', currency: 'TRY', opening_balance: 0 });
  const [transactionData, setTransactionData] = useState<{ transaction_type: 'in' | 'out'; amount: number; description: string; firm_id: string; project_id: string }>({ transaction_type: 'in', amount: 0, description: '', firm_id: '', project_id: '' });
  const [editModal, setEditModal] = useState<BankAccount | null>(null);
  const [editBalance, setEditBalance] = useState(0);

  useEffect(() => { fetchMeta(); }, []);

  useEffect(() => {
    if (selectedFirm) setTransactionData(prev => ({ ...prev, firm_id: selectedFirm.id }));
  }, [selectedFirm]);

  useEffect(() => { fetchAccounts(); }, [selectedFirm]);

  const fetchMeta = async () => {
    const [firmsRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code'),
      supabase.from('projects').select('*').eq('status', 'active').order('name'),
    ]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    let query = supabase.from('bank_accounts').select('*').eq('is_active', true).order('bank_name');
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    const { data } = await query;
    if (data) setAccounts(data);
  };

  const fetchTransactions = async (accountId: string) => {
    const { data } = await supabase.from('bank_transactions').select('*').eq('bank_account_id', accountId).order('created_at', { ascending: false }).limit(50);
    if (data) setTransactions(data);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('bank_accounts').insert({ ...formData, firm_id: selectedFirm?.id, current_balance: formData.opening_balance, is_active: true });
    setShowForm(false); setFormData({ bank_name: '', branch: '', account_number: '', iban: '', currency: 'TRY', opening_balance: 0 }); fetchAccounts();
  };

  const handleUpdateOpeningBalance = async () => {
    if (!editModal) return;
    await supabase.from('bank_accounts').update({ opening_balance: editBalance, current_balance: editBalance }).eq('id', editModal.id);
    setEditModal(null);
    fetchAccounts();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionData.firm_id) { alert('Cari seçimi zorunludur!'); return; }
    if (!transactionData.project_id) { alert('Proje seçimi zorunludur!'); return; }

    await supabase.from('bank_transactions').insert({
      bank_account_id: selectedAccount,
      firm_id: transactionData.firm_id,
      project_id: transactionData.project_id,
      transaction_type: transactionData.transaction_type,
      amount: transactionData.amount,
      description: transactionData.description,
    });
    const account = accounts.find(a => a.id === selectedAccount);
    if (account) {
      const newBalance = transactionData.transaction_type === 'in' ? account.current_balance + transactionData.amount : account.current_balance - transactionData.amount;
      await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', selectedAccount);
    }
    setShowTransactionForm(false); setTransactionData({ transaction_type: 'in', amount: 0, description: '', firm_id: selectedFirm?.id || '', project_id: '' });
    fetchAccounts(); if (selectedAccount) fetchTransactions(selectedAccount);
  };

  const filteredProjects = projects.filter(p => !transactionData.firm_id || p.firm_id === transactionData.firm_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Banka Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Hesap</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {accounts.map(account => (
          <div key={account.id} onClick={() => { setSelectedAccount(account.id); fetchTransactions(account.id); }} className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all ${selectedAccount === account.id ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg"><Building2 size={24} className="text-blue-600" /></div>
                <div><h3 className="font-semibold text-slate-800">{account.bank_name}</h3><p className="text-sm text-slate-500">{account.branch || '-'}</p></div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setEditModal(account); setEditBalance(account.opening_balance || 0); }} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Düzenle</button>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-4">{formatCurrency(account.current_balance, account.currency)}</p>
            <p className="text-sm text-slate-500 mt-1">{account.iban ? `****${account.iban.slice(-4)}` : account.account_number || '-'}</p>
            <p className="text-xs text-slate-400 mt-1">Açılış: {formatCurrency(account.opening_balance || 0)}</p>
          </div>
        ))}
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Son Hareketler</h2>
            <button onClick={() => setShowTransactionForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus size={16} />Hareket Ekle</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Tarih</th><th className="text-left py-3 px-4">Tür</th><th className="text-left py-3 px-4">Cari</th><th className="text-left py-3 px-4">Proje</th><th className="text-right py-3 px-4">Tutar</th><th className="text-left py-3 px-4">Açıklama</th></tr></thead>
            <tbody>
              {(() => {
                const account = accounts.find(a => a.id === selectedAccount);
                const openingBalance = account?.opening_balance || 0;
                return (
                  <>
                    <tr className="border-t border-slate-100 bg-blue-50">
                      <td className="py-3 px-4 text-blue-600 font-medium">-</td>
                      <td className="py-3 px-4"><span className="text-blue-600 font-medium">Açılış</span></td>
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">{formatCurrency(openingBalance)}</td>
                      <td className="py-3 px-4 text-blue-500 italic">Açılış Bakiyesi</td>
                    </tr>
                    {transactions.map(t => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="py-3 px-4">{formatDateTR(t.created_at)}</td>
                        <td className="py-3 px-4"><span className={`flex items-center gap-1 ${t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}`}>{t.transaction_type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}{t.transaction_type === 'in' ? 'Giriş' : 'Çıkış'}</span></td>
                        <td className="py-3 px-4 text-slate-600">{firms.find(f => f.id === t.firm_id)?.name || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{projects.find(p => p.id === t.project_id)?.name || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium"><span className={t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}>{t.transaction_type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}</span></td>
                        <td className="py-3 px-4 text-slate-600">{t.description || '-'}</td>
                      </tr>
                    ))}
                  </>
                );
              })()}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500">Henüz hareket yok.</p>
              <p className="text-sm text-blue-500 mt-2">Açılış Bakiyesi: {formatCurrency(accounts.find(a => a.id === selectedAccount)?.opening_balance || 0)}</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yeni Banka Hesabı</h2>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Banka Adı</label><input type="text" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Şube</label><input type="text" value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Hesap No</label><input type="text" value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label><input type="text" value={formData.iban} onChange={(e) => setFormData({ ...formData, iban: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="TR00 0000 0000 0000 0000 0000 00" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label><select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Açılış Bakiyesi</label><input type="number" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Oluştur</button></div>
            </form>
          </div>
        </div>
      )}

      {showTransactionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Banka Hareketi Ekle</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Hareket Türü</label><div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="bt" value="in" checked={transactionData.transaction_type === 'in'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-green-600" /><span className="text-green-600 font-medium">Giriş</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="bt" value="out" checked={transactionData.transaction_type === 'out'} onChange={(e) => setTransactionData({ ...transactionData, transaction_type: e.target.value as 'in' | 'out' })} className="text-red-600" /><span className="text-red-600 font-medium">Çıkış</span></label>
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

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Açılış Bakiyesi Düzenle</h2>
            <p className="text-sm text-slate-600 mb-4">{editModal.bank_name} - {editModal.branch || ''}</p>
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
