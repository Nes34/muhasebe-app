import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { exportAccountStatementToExcel } from '../lib/excel';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Cari } from '../types';
import { Search, Download, FileText } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function AccountStatement() {
  const { selectedFirm, selectedProject } = useFirm();
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [allCariler, setAllCariler] = useState<Cari[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCariId, setSelectedCariId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeException, setIncludeException] = useState(true);

  useEffect(() => { fetchCariler(); }, []);
  useEffect(() => {
    if (selectedFirm) {
      Promise.all([
        supabase.from('transactions').select('cari_id').eq('firm_id', selectedFirm.id),
        supabase.from('checks').select('cari_id').eq('firm_id', selectedFirm.id),
        supabase.from('cash_transactions').select('cari_id').eq('firm_id', selectedFirm.id),
        supabase.from('bank_transactions').select('cari_id').eq('firm_id', selectedFirm.id),
      ]).then(([txRes, checkRes, cashRes, bankRes]) => {
        const firmCariIds = new Set<string>();
        txRes.data?.forEach(t => t.cari_id && firmCariIds.add(t.cari_id));
        checkRes.data?.forEach(c => c.cari_id && firmCariIds.add(c.cari_id));
        cashRes.data?.forEach(c => c.cari_id && firmCariIds.add(c.cari_id));
        bankRes.data?.forEach(b => b.cari_id && firmCariIds.add(b.cari_id));
        if (firmCariIds.size > 0) {
          supabase.from('cariler').select('*').in('id', [...firmCariIds]).eq('is_active', true).order('code').then(({ data }) => {
            if (data) setCariler(data);
          });
        } else {
          setCariler([]);
        }
      });
    } else {
      setCariler(allCariler);
    }
    setSelectedCariId('');
    setTransactions([]);
  }, [selectedFirm, selectedProject]);
  useEffect(() => { if (selectedCariId) fetchStatement(); }, [selectedCariId, selectedProject, startDate, endDate, includeException]);

  const fetchCariler = async () => {
    const { data } = await supabase.from('cariler').select('*').eq('is_active', true).order('code');
    if (data) setAllCariler(data);
  };

  const fetchStatement = async () => {
    if (!selectedCariId) return;
    setLoading(true);

    const [txRes, checkRes, cashRes, bankRes] = await Promise.all([
      (async () => {
        let q = supabase.from('transactions').select('*, firm:firms(*), project:projects(*)').eq('cari_id', selectedCariId).order('transaction_date', { ascending: true });
        if (selectedProject) q = q.eq('project_id', selectedProject.id);
        if (startDate) q = q.gte('transaction_date', startDate);
        if (endDate) q = q.lte('transaction_date', endDate);
        if (!includeException) q = q.eq('is_exception', false);
        return q;
      })(),
      (async () => {
        let q = supabase.from('checks').select('*, firm:firms(*)').eq('cari_id', selectedCariId).order('created_at', { ascending: true });
        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate);
        return q;
      })(),
      (async () => {
        let q = supabase.from('cash_transactions').select('*, firm:firms(*)').eq('cari_id', selectedCariId).order('created_at', { ascending: true });
        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate);
        return q;
      })(),
      (async () => {
        let q = supabase.from('bank_transactions').select('*, firm:firms(*)').eq('cari_id', selectedCariId).order('created_at', { ascending: true });
        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate);
        return q;
      })(),
    ]);

    const allTransactions: any[] = [];

    txRes.data?.forEach(t => allTransactions.push({
      ...t,
      source: 'transaction',
      date: t.transaction_date,
      label: getLabel(t.transaction_type),
      isIncome: t.transaction_type === 'income' || t.transaction_type === 'invoice',
    }));

    checkRes.data?.forEach(c => allTransactions.push({
      ...c,
      source: 'check',
      date: c.created_at,
      label: c.check_type === 'received' ? `Çek Alındı (${c.status})` : `Çek Verildi (${c.status})`,
      isIncome: c.check_type === 'received',
      amount: c.check_type === 'received' ? c.amount : -c.amount,
    }));

    cashRes.data?.forEach(c => allTransactions.push({
      ...c,
      source: 'cash',
      date: c.created_at,
      label: c.transaction_type === 'in' ? 'Kasa Giriş' : 'Kasa Çıkış',
      isIncome: c.transaction_type === 'in',
      amount: c.transaction_type === 'in' ? c.amount : -c.amount,
    }));

    bankRes.data?.filter(b => !b.description?.includes('(Otomatik)')).forEach(b => allTransactions.push({
      ...b,
      source: 'bank',
      date: b.created_at,
      label: b.transaction_type === 'in' ? 'Banka Giriş' : 'Banka Çıkış',
      isIncome: b.transaction_type === 'in',
      amount: b.transaction_type === 'in' ? b.amount : -b.amount,
    }));

    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTransactions(allTransactions);
    setLoading(false);
  };

  const calculateTotals = () => {
    let totalDebt = 0, totalCredit = 0;
    transactions.forEach(t => {
      const amount = Math.abs(t.amount);
      if (t.isIncome) totalDebt += amount;
      else totalCredit += amount;
    });
    return { totalDebt, totalCredit, balance: totalDebt - totalCredit };
  };

  const getLabel = (type: string) => ({ income: 'Gelir', expense: 'Gider', invoice: 'Fatura', delivery_note: 'İrsaliye' }[type] || type);
  const totals = calculateTotals();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Cari Hesap Ekstresi</h1>
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cari</label>
            <SearchableSelect
              options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
              value={selectedCariId}
              onChange={(id) => setSelectedCariId(id)}
              placeholder="Cari seçin..."
              showCode={true}
            />
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç</label><input type="text" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Bitiş</label><input type="text" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeException} onChange={(e) => setIncludeException(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><span className="text-sm text-slate-700">İstisna işlemleri dahil et</span></label>
          <button onClick={fetchStatement} disabled={!selectedCariId || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"><Search size={16} />{loading ? 'Aranıyor...' : 'Filtrele'}</button>
        </div>
      </div>

      {transactions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200"><p className="text-sm text-green-700">Toplam Borç</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalDebt)}</p></div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-700">Toplam Alacak</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalCredit)}</p></div>
            <div className={`rounded-xl p-4 border ${totals.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}><p className={`text-sm ${totals.balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Bakiye</p><p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(Math.abs(totals.balance))}{totals.balance >= 0 ? ' (Alacaklı)' : ' (Borçlu)'}</p></div>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => { const cari = cariler.find(c => c.id === selectedCariId); exportAccountStatementToExcel(transactions, cari?.name || 'cari'); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Excel İndir</button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <ResizableTh columnId="ekstre-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
                  <ResizableTh columnId="ekstre-firma" className="text-left py-3 px-4">Firma</ResizableTh>
                  <ResizableTh columnId="ekstre-islem" className="text-left py-3 px-4">İşlem</ResizableTh>
                  <ResizableTh columnId="ekstre-proje" className="text-left py-3 px-4">Proje</ResizableTh>
                  <ResizableTh columnId="ekstre-aciklama" className="text-left py-3 px-4">Açıklama</ResizableTh>
                  <ResizableTh columnId="ekstre-borc" className="text-right py-3 px-4">Borç</ResizableTh>
                  <ResizableTh columnId="ekstre-alacak" className="text-right py-3 px-4">Alacak</ResizableTh>
                  <ResizableTh columnId="ekstre-bakiye" className="text-right py-3 px-4">Bakiye</ResizableTh>
                </tr></thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const amount = Math.abs(t.amount);
                    const running = transactions.slice(0, i + 1).reduce((acc, tr) => acc + (tr.isIncome ? Math.abs(tr.amount) : -Math.abs(tr.amount)), 0);
                    return (
                      <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">{formatDateTR(t.date || t.transaction_date)}</td>
                        <td className="py-3 px-4 text-slate-600">{(t as any).firm?.name || '-'}</td>
                        <td className="py-3 px-4"><div className="flex items-center gap-2"><span className={`px-2 py-1 rounded text-xs font-medium ${t.isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.label || getLabel(t.transaction_type)}</span>{t.is_exception && <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">İstisna</span>}</div></td>
                        <td className="py-3 px-4 text-slate-600">{t.project?.name || '-'}</td>
                        <td className="py-3 px-4">{t.description || t.invoice_number || t.check_number || '-'}</td>
                        <td className="py-3 px-4 text-right">{t.isIncome ? <span className="font-medium text-green-600">{formatCurrency(amount)}</span> : <span className="text-slate-400">-</span>}</td>
                        <td className="py-3 px-4 text-right">{!t.isIncome ? <span className="font-medium text-red-600">{formatCurrency(amount)}</span> : <span className="text-slate-400">-</span>}</td>
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

      {transactions.length === 0 && !loading && selectedCariId && <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><FileText size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500">Bu cari için işlem bulunamadı.</p></div>}
      {!selectedCariId && <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><Search size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-slate-500">Ekstre görmek için cari seçiniz.</p></div>}
    </div>
  );
}