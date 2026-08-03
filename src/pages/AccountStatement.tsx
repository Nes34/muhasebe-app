import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { exportAccountStatementToExcel } from '../lib/excel';
import SearchableSelect from '../components/SearchableSelect';
import type { Transaction, Firm, Project } from '../types';
import { Search, Download, FileText } from 'lucide-react';

export default function AccountStatement() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeException, setIncludeException] = useState(true);

  useEffect(() => { fetchFirms(); fetchProjects(); }, []);

  const fetchFirms = async () => {
    const { data } = await supabase.from('firms').select('*').eq('is_active', true).in('type', ['customer', 'supplier']).order('code');
    if (data) setFirms(data);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').eq('status', 'active').order('name');
    if (data) setProjects(data);
  };

  const fetchStatement = async () => {
    if (!selectedFirmId) return;
    setLoading(true);
    let query = supabase.from('transactions').select('*, firm:firms(*), project:projects(*)').eq('firm_id', selectedFirmId).order('transaction_date', { ascending: true });
    if (selectedProjectId) query = query.eq('project_id', selectedProjectId);
    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
    if (!includeException) query = query.eq('is_exception', false);
    const { data } = await query;
    if (data) setTransactions(data);
    setLoading(false);
  };

  const calculateTotals = () => {
    let totalDebt = 0, totalCredit = 0;
    transactions.forEach(t => {
      if (t.transaction_type === 'income' || t.transaction_type === 'invoice') totalDebt += t.amount;
      else totalCredit += t.amount;
    });
    return { totalDebt, totalCredit, balance: totalDebt - totalCredit };
  };

  const getLabel = (type: string) => ({ income: 'Gelir', expense: 'Gider', invoice: 'Fatura', delivery_note: 'İrsaliye' }[type] || type);
  const totals = calculateTotals();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Cari Hesap Ekstresi</h1>
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchableSelect
            options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
            value={selectedFirmId}
            onChange={(id) => setSelectedFirmId(id)}
            placeholder="Kod veya isim ile cari ara..."
            required
          />
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Proje</label><select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"><option value="">Tüm Projeler</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç</label><input type="text" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Bitiş</label><input type="text" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeException} onChange={(e) => setIncludeException(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><span className="text-sm text-slate-700">İstisna işlemleri dahil et</span></label>
          <button onClick={fetchStatement} disabled={!selectedFirmId || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"><Search size={16} />{loading ? 'Aranıyor...' : 'Filtrele'}</button>
        </div>
      </div>

      {transactions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-700">Toplam Borç</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalDebt)}</p></div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200"><p className="text-sm text-green-700">Toplam Alacak</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalCredit)}</p></div>
            <div className={`rounded-xl p-4 border ${totals.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}><p className={`text-sm ${totals.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Bakiye</p><p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(Math.abs(totals.balance))}{totals.balance >= 0 ? ' (Alacaklı)' : ' (Borçlu)'}</p></div>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => { const firm = firms.find(f => f.id === selectedFirmId); exportAccountStatementToExcel(transactions, firm?.name || 'firm'); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Excel İndir</button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Tarih</th><th className="text-left py-3 px-4">İşlem</th><th className="text-left py-3 px-4">Proje</th><th className="text-left py-3 px-4">Açıklama</th><th className="text-right py-3 px-4">Borç</th><th className="text-right py-3 px-4">Alacak</th><th className="text-right py-3 px-4">Bakiye</th></tr></thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const isDebit = t.transaction_type === 'income' || t.transaction_type === 'invoice';
                    const running = transactions.slice(0, i + 1).reduce((acc, tr) => acc + (tr.transaction_type === 'income' || tr.transaction_type === 'invoice' ? tr.amount : -tr.amount), 0);
                    return (
                      <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">{formatDateTR(t.transaction_date)}</td>
                        <td className="py-3 px-4"><div className="flex items-center gap-2"><span className={`px-2 py-1 rounded text-xs font-medium ${isDebit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{getLabel(t.transaction_type)}</span>{t.is_exception && <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">İstisna</span>}</div></td>
                        <td className="py-3 px-4 text-slate-600">{t.project?.name || '-'}</td>
                        <td className="py-3 px-4">{t.description || t.invoice_number || '-'}</td>
                        <td className="py-3 px-4 text-right">{isDebit ? <span className="font-medium text-red-600">{formatCurrency(t.amount)}</span> : <span className="text-slate-400">-</span>}</td>
                        <td className="py-3 px-4 text-right">{!isDebit ? <span className="font-medium text-green-600">{formatCurrency(t.amount)}</span> : <span className="text-slate-400">-</span>}</td>
                        <td className="py-3 px-4 text-right font-medium"><span className={running >= 0 ? 'text-blue-600' : 'text-orange-600'}>{formatCurrency(Math.abs(running))}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {transactions.length === 0 && !loading && selectedFirmId && <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><FileText size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500">Bu firma için işlem bulunamadı.</p></div>}
      {!selectedFirmId && <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><Search size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500">Ekstre görmek için firma seçiniz.</p></div>}
    </div>
  );
}