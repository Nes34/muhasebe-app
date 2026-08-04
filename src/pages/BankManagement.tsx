import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { exportBankTransactionsToExcel } from '../lib/excel';
import { useFirm } from '../hooks/useFirm';
import type { BankAccount, BankTransaction, Firm, Cari, Project } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle, Building2, Download, Upload } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface BankAccountWithFirms extends BankAccount {
  firms: Firm[];
}

export default function BankManagement() {
  const { selectedFirm, selectedProject } = useFirm();
  const [accounts, setAccounts] = useState<BankAccountWithFirms[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [formData, setFormData] = useState({ bank_name: '', branch: '', account_number: '', iban: '', currency: 'TRY', opening_balance: 0, firm_ids: [] as string[] });
  const [transactionData, setTransactionData] = useState<{ transaction_type: 'in' | 'out'; amount: number; description: string; cari_id: string; project_id: string }>({ transaction_type: 'in', amount: 0, description: '', cari_id: '', project_id: '' });
  const [editModal, setEditModal] = useState<BankAccountWithFirms | null>(null);
  const [editBalance, setEditBalance] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAccountId, setImportAccountId] = useState('');

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    fetchAccounts();
    setSelectedAccount('');
    setTransactions([]);
  }, [selectedFirm, selectedProject]);

  const fetchData = async () => {
    const [firmsRes, carilerRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).order('code'),
      supabase.from('cariler').select('*').eq('is_active', true).order('code'),
      supabase.from('projects').select('*').eq('status', 'active').order('name'),
    ]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (carilerRes.data) setCariler(carilerRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const { data: accs } = await supabase.from('bank_accounts').select('*').eq('is_active', true).order('bank_name');
    if (!accs) { setAccounts([]); return; }

    const accIds = accs.map(a => a.id);
    const { data: bafLinks } = await supabase.from('bank_account_firms').select('bank_account_id, firm_id').in('bank_account_id', accIds);

    const enriched: BankAccountWithFirms[] = accs.map(acc => {
      const firmIds = bafLinks?.filter(l => l.bank_account_id === acc.id).map(l => l.firm_id) || [];
      const accFirms = firms.filter(f => firmIds.includes(f.id));
      return { ...acc, firms: accFirms };
    });

    if (selectedFirm) {
      setAccounts(enriched.filter(a => a.firms.some(f => f.id === selectedFirm.id)));
    } else {
      setAccounts(enriched);
    }
  };

  const fetchTransactions = async (accountId: string) => {
    const { data } = await supabase.from('bank_transactions').select('*').eq('bank_account_id', accountId).order('created_at', { ascending: false }).limit(50);
    if (!data) { setTransactions([]); return; }

    const filtered = data.filter((t: any) => !t.description?.includes('(Otomatik)'));

    // Firm isimlerini manuel çek
    const firmIds = [...new Set(filtered.map((t: any) => t.firm_id).filter(Boolean))];
    let firmMap: Record<string, string> = {};
    if (firmIds.length > 0) {
      const { data: firmRows } = await supabase.from('firms').select('id, name').in('id', firmIds);
      firmRows?.forEach((f: any) => { firmMap[f.id] = f.name; });
    }

    const enriched = filtered.map((t: any) => ({ ...t, firm_name: t.firm_id ? firmMap[t.firm_id] || '-' : '-' }));
    setTransactions(enriched);
  };

  const toggleFirmId = (fid: string) => {
    setFormData(prev => ({
      ...prev,
      firm_ids: prev.firm_ids.includes(fid)
        ? prev.firm_ids.filter(id => id !== fid)
        : [...prev.firm_ids, fid],
    }));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: newAcc, error } = await supabase.from('bank_accounts').insert({
      bank_name: formData.bank_name,
      branch: formData.branch,
      account_number: formData.account_number,
      iban: formData.iban,
      currency: formData.currency,
      opening_balance: formData.opening_balance,
      current_balance: formData.opening_balance,
      is_active: true,
    }).select().single();

    if (error) {
      if (error.code === '23505') { alert('Bu isimde bir banka hesabı zaten mevcut!'); return; }
      alert('Hesap oluşturulurken hata: ' + error.message); return;
    }

    if (newAcc && formData.firm_ids.length > 0) {
      const links = formData.firm_ids.map(fid => ({ bank_account_id: newAcc.id, firm_id: fid }));
      await supabase.from('bank_account_firms').insert(links);
    }

    setShowForm(false);
    setFormData({ bank_name: '', branch: '', account_number: '', iban: '', currency: 'TRY', opening_balance: 0, firm_ids: [] });
    fetchAccounts();
  };

  const handleUpdateOpeningBalance = async () => {
    if (!editModal) return;
    await supabase.from('bank_accounts').update({ opening_balance: editBalance, current_balance: editBalance }).eq('id', editModal.id);
    setEditModal(null);
    fetchAccounts();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionData.cari_id) { alert('Cari seçimi zorunludur!'); return; }
    if (!transactionData.project_id) { alert('Proje seçimi zorunludur!'); return; }

    await supabase.from('bank_transactions').insert({
      bank_account_id: selectedAccount,
      cari_id: transactionData.cari_id,
      project_id: transactionData.project_id,
      firm_id: selectedFirm?.id || null,
      transaction_type: transactionData.transaction_type,
      amount: transactionData.amount,
      description: transactionData.description,
    });

    const account = accounts.find(a => a.id === selectedAccount);
    if (account) {
      const newBalance = transactionData.transaction_type === 'in'
        ? account.current_balance + transactionData.amount
        : account.current_balance - transactionData.amount;
      await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', selectedAccount);
    }

    setShowTransactionForm(false);
    setTransactionData({ transaction_type: 'in', amount: 0, description: '', cari_id: '', project_id: '' });
    fetchAccounts();
    if (selectedAccount) fetchTransactions(selectedAccount);
  };

  const filteredProjects = projects.filter(p => !selectedFirm || p.firm_id === selectedFirm.id);

  const handleImport = async () => {
    if (!importFile || !importAccountId) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('Dosyada veri bulunamadı.'); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('tarih') || h.includes('date'));
      const typeIdx = headers.findIndex(h => h.includes('tip') || h.includes('type') || h.includes('işlem'));
      const amountIdx = headers.findIndex(h => h.includes('tutar') || h.includes('amount'));
      const descIdx = headers.findIndex(h => h.includes('açıklama') || h.includes('description') || h.includes('detay'));

      if (amountIdx === -1) { alert('Tutar sütunu bulunamadı. Sütun başlıklarını kontrol edin.'); return; }

      let successCount = 0;
      const account = accounts.find(a => a.id === importAccountId);
      let balance = account?.current_balance || 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const amount = parseFloat(cols[amountIdx]?.replace(/[^\d.-]/g, '') || '0');
        if (amount === 0) continue;

        const date = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
        const desc = descIdx >= 0 ? cols[descIdx] : 'Banka Ekstresi İçe Aktarma';
        const typeStr = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : '';
        const isIncome = typeStr.includes('gelen') || typeStr.includes('in') || typeStr.includes('giriş') || amount > 0;
        const txType = isIncome ? 'in' : 'out';
        const txAmount = Math.abs(amount);

        await supabase.from('bank_transactions').insert({
          bank_account_id: importAccountId,
          firm_id: selectedFirm?.id || null,
          transaction_type: txType,
          amount: txAmount,
          description: desc,
          created_at: date.includes('T') ? date : `${date}T00:00:00`,
        });

        balance = isIncome ? balance + txAmount : balance - txAmount;
        successCount++;
      }

      await supabase.from('bank_accounts').update({ current_balance: balance }).eq('id', importAccountId);
      alert(`${successCount} işlem başarıyla içe aktarıldı!`);
      setShowImportModal(false);
      setImportFile(null);
      setImportAccountId('');
      fetchAccounts();
      if (selectedAccount) fetchTransactions(selectedAccount);
    } catch (err) {
      alert('İçe aktarma hatası: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Banka Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Upload size={16} />Ekstre İçe Aktar</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Hesap</button>
        </div>
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
            {account.firms.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {account.firms.map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    <Building2 size={10} />{f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="col-span-full bg-white rounded-xl p-6 border border-slate-200 text-center">
            <p className="text-slate-500">{selectedFirm ? 'Bu firmaya ait banka hesabı bulunamadı.' : 'Henüz banka hesabı bulunamadı.'}</p>
          </div>
        )}
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Son Hareketler</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => exportBankTransactionsToExcel(transactions)} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"><Download size={16} /> Excel</button>
              <button onClick={() => setShowTransactionForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus size={16} />Hareket Ekle</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <ResizableTh columnId="bank-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
              <ResizableTh columnId="bank-tur" className="text-left py-3 px-4">Tür</ResizableTh>
              <ResizableTh columnId="bank-firma" className="text-left py-3 px-4">Firma</ResizableTh>
              <ResizableTh columnId="bank-cari" className="text-left py-3 px-4">Cari</ResizableTh>
              <ResizableTh columnId="bank-proje" className="text-left py-3 px-4">Proje</ResizableTh>
              <ResizableTh columnId="bank-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
              <ResizableTh columnId="bank-aciklama" className="text-left py-3 px-4">Açıklama</ResizableTh>
            </tr></thead>
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
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">{formatCurrency(openingBalance)}</td>
                      <td className="py-3 px-4 text-slate-500">Hesap açılış bakiyesi</td>
                    </tr>
                    {transactions.map(t => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="py-3 px-4">{formatDateTR(t.created_at)}</td>
                        <td className="py-3 px-4"><span className={`flex items-center gap-1 ${t.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'}`}>{t.transaction_type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}{t.transaction_type === 'in' ? 'Giriş' : 'Çıkış'}</span></td>
                        <td className="py-3 px-4 text-slate-600">{(t as any).firm_name || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{cariler.find(c => c.id === t.cari_id)?.name || '-'}</td>
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
                <select value={transactionData.cari_id} onChange={(e) => setTransactionData({ ...transactionData, cari_id: e.target.value, project_id: '' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                  <option value="">Cari Seçin</option>
                  {cariler.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ''}{c.name}</option>)}
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
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Yeni Açılış Bakiyesi</label><input type="number" value={editBalance} onChange={(e) => setEditBalance(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="button" onClick={handleUpdateOpeningBalance} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Ekstre İçe Aktarma Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Banka Ekstresi İçe Aktar</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hesap Seçin</label>
                <select value={importAccountId} onChange={(e) => setImportAccountId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                  <option value="">Hesap Seçin</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.branch || 'Ana Hesap'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CSV/Excel Dosyası</label>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                <p className="text-xs text-slate-500 mt-1">Sütun başlıkları: Tarih, İşlem Tipi, Tutar, Açıklama</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Örnek CSV Formatı:</p>
                <code className="text-xs text-slate-600">
                  Tarih,İşlem Tipi,Tutar,Açıklama<br />
                  2024-01-15,Gelen,5000,Müşteri ödemesi<br />
                  2024-01-16,Giden,2000,Fatura ödemesi
                </code>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowImportModal(false); setImportFile(null); setImportAccountId(''); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="button" onClick={handleImport} disabled={!importFile || !importAccountId || importing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {importing ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
