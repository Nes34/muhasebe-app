import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, findSimilar } from '../lib/utils';
import { importFromExcel, exportFirmsToCSV } from '../lib/excel';
import { useFirm } from '../hooks/useFirm';
import type { Firm } from '../types';
import { Plus, Edit2, Trash2, Search, Building2, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Wallet, FileCheck } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface FirmSummary {
  firm: Firm;
  income: number;
  expense: number;
  checksGiven: number;
  checksPaid: number;
  profitLoss: number;
}

export default function Firms() {
  const { selectedFirm, selectedProject } = useFirm();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmSummaries, setFirmSummaries] = useState<FirmSummary[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFirm, setEditingFirm] = useState<Firm | null>(null);
  const [formData, setFormData] = useState({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' as 'customer' | 'supplier' | 'both' });
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [similarWarning, setSimilarWarning] = useState<Firm[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Check istatistikleri
  const [checkStats, setCheckStats] = useState({
    totalCash: 0, totalBank: 0,
    pendingGiven: 0, urgentGiven: 0, paidChecks: 0, paidChecksAmount: 0,
    pendingReceived: 0, urgentReceived: 0, collectedChecks: 0, collectedChecksAmount: 0,
  });

  useEffect(() => { fetchFirms(); fetchFirmSummaries(); }, [selectedFirm, selectedProject]);

  useEffect(() => {
    if (formData.name && !editingFirm) {
      const similar = findSimilar(firms, formData.name);
      setSimilarWarning(similar);
    } else {
      setSimilarWarning([]);
    }
  }, [formData.name, firms, editingFirm]);

  const fetchFirms = async () => {
    const { data } = await supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code');
    if (data) setFirms(data);
    setLoading(false);
  };

  const fetchFirmSummaries = async () => {
    let firmsQuery = supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code');
    if (selectedFirm) firmsQuery = firmsQuery.eq('id', selectedFirm.id);
    const { data: firmsData } = await firmsQuery;
    if (!firmsData || firmsData.length === 0) { setFirmSummaries([]); return; }

    const transferTypes = ['transfer', 'stock_transfer', 'cash_transfer', 'bank_transfer'];

    // Dashboard ile aynı sorguları yap
    let txQ = supabase.from('transactions').select('firm_id, amount, transaction_type, is_exception, project_id');
    if (selectedFirm) txQ = txQ.eq('firm_id', selectedFirm.id);
    if (selectedProject) txQ = txQ.eq('project_id', selectedProject.id);
    const [txRes, checkRes] = await Promise.all([
      txQ,
      (() => {
        let q = supabase.from('checks').select('firm_id, amount, check_type, status');
        if (selectedFirm) q = q.eq('firm_id', selectedFirm.id);
        if (selectedProject) q = q.eq('project_id', selectedProject.id);
        return q;
      })(),
    ]);

    // Kasa/banka ve junction tabloları (Dashboard ile aynı)
    const { data: allCash } = await supabase.from('cash_registers').select('*').eq('is_active', true);
    const { data: allBank } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
    const { data: cashFirmLinks } = await supabase.from('cash_register_firms').select('cash_register_id, firm_id');
    const { data: bankFirmLinks } = await supabase.from('bank_account_firms').select('bank_account_id, firm_id');

    // Seçili firmaya göre kasa/banka filtresi (Dashboard ile aynı mantık)
    let cash = allCash;
    let bank = allBank;
    if (selectedFirm) {
      const allowedCashIds = (cashFirmLinks || []).filter((l: any) => l.firm_id === selectedFirm.id).map((l: any) => l.cash_register_id);
      const allowedBankIds = (bankFirmLinks || []).filter((l: any) => l.firm_id === selectedFirm.id).map((l: any) => l.bank_account_id);
      cash = (allCash || []).filter((c: any) => allowedCashIds.includes(c.id));
      bank = (allBank || []).filter((b: any) => allowedBankIds.includes(b.id));
    }

    const cashIds = (cash || []).map((c: any) => c.id);
    const bankIds = (bank || []).map((b: any) => b.id);

    const [cashTxRes, bankTxRes] = await Promise.all([
      (() => {
        let q = supabase.from('cash_transactions').select('cash_register_id, amount, transaction_type, transaction_id, project_id').is('transaction_id', null);
        if (selectedProject) q = q.eq('project_id', selectedProject.id);
        else if (cashIds.length > 0) q = q.in('cash_register_id', cashIds);
        return q;
      })(),
      (() => {
        let q = supabase.from('bank_transactions').select('bank_account_id, amount, transaction_type, transaction_id, project_id').is('transaction_id', null);
        if (selectedProject) q = q.eq('project_id', selectedProject.id);
        else if (bankIds.length > 0) q = q.in('bank_account_id', bankIds);
        return q;
      })(),
    ]);

    // Toplam gelir/gider hesapla (Dashboard ile birebir aynı formül)
    let totalIncome = 0;
    let totalExpense = 0;

    (txRes.data || []).forEach((t: any) => {
      if (transferTypes.includes(t.transaction_type)) return;
      if (t.is_exception) return;
      if (['income', 'invoice', 'sale_invoice'].includes(t.transaction_type)) totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    (cashTxRes.data || []).forEach((t: any) => {
      if (t.transaction_type === 'in') totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    (bankTxRes.data || []).forEach((t: any) => {
      if (t.transaction_type === 'in') totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    // Açılış bakiyeleri — Dashboard ile aynı mantık
    // Firma seçiliyse sadece bağlı kasalardan/bankalardan, değilse tümünden
    (cash || []).forEach((c: any) => {
      if (c.opening_balance > 0) totalIncome += c.opening_balance;
      else if (c.opening_balance < 0) totalExpense += Math.abs(c.opening_balance);
    });
    (bank || []).forEach((b: any) => {
      if (b.opening_balance > 0) totalIncome += b.opening_balance;
      else if (b.opening_balance < 0) totalExpense += Math.abs(b.opening_balance);
    });

    // Firma özetlerini hesapla (her firma için)
    const summaries: FirmSummary[] = firmsData.map(firm => {
      const txs = txRes.data?.filter(t => t.firm_id === firm.id && !t.is_exception) || [];
      const checks = checkRes.data?.filter(c => c.firm_id === firm.id) || [];

      // Firma özeli kasa/banka (junction tablo ile bağlı kasalardan gelen bağımsız işlemler)
      const firmCashIds = (cashFirmLinks || []).filter((l: any) => l.firm_id === firm.id).map((l: any) => l.cash_register_id);
      const firmBankIds = (bankFirmLinks || []).filter((l: any) => l.firm_id === firm.id).map((l: any) => l.bank_account_id);
      const firmCashTxs = (cashTxRes.data || []).filter((t: any) => firmCashIds.includes(t.cash_register_id));
      const firmBankTxs = (bankTxRes.data || []).filter((t: any) => firmBankIds.includes(t.bank_account_id));

      // Transactions: transfer ve irsaliye hariç gelir/gider
      const excludedTypes = ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'];
      let income = txs.filter(t => !transferTypes.includes(t.transaction_type) && !excludedTypes.includes(t.transaction_type) && ['income', 'invoice', 'sale_invoice'].includes(t.transaction_type)).reduce((s, t) => s + t.amount, 0);
      let expense = txs.filter(t => !transferTypes.includes(t.transaction_type) && !excludedTypes.includes(t.transaction_type) && !['income', 'invoice', 'sale_invoice'].includes(t.transaction_type)).reduce((s, t) => s + t.amount, 0);

      // Bağımsız kasa/banka işlemleri
      firmCashTxs.forEach((t: any) => {
        if (t.transaction_type === 'in') income += t.amount;
        else expense += t.amount;
      });
      firmBankTxs.forEach((t: any) => {
        if (t.transaction_type === 'in') income += t.amount;
        else expense += t.amount;
      });

      // Firma özeli açılış bakiyeleri
      firmCashIds.forEach((cashId: string) => {
        const c = (allCash || []).find((ca: any) => ca.id === cashId);
        if (c && c.opening_balance > 0) income += c.opening_balance;
        else if (c && c.opening_balance < 0) expense += Math.abs(c.opening_balance);
      });
      firmBankIds.forEach((bankId: string) => {
        const b = (allBank || []).find((ba: any) => ba.id === bankId);
        if (b && b.opening_balance > 0) income += b.opening_balance;
        else if (b && b.opening_balance < 0) expense += Math.abs(b.opening_balance);
      });

      // Bekleyen çekler
      const pendingGivenChecks = checks.filter(c => c.check_type === 'given' && c.status === 'pending').reduce((s, c) => s + c.amount, 0);
      const checksPaid = checks.filter(c => c.check_type === 'given' && c.status === 'collected').reduce((s, c) => s + c.amount, 0);

      const profitLoss = income - expense;

      return { firm, income, expense, checksGiven: pendingGivenChecks, checksPaid, profitLoss };
    });

    setFirmSummaries(summaries);

    // Sayfa toplamları — Dashboard ile birebir aynı formül (firma özetlerinin toplamı DEĞİL)
    setPageTotals({ income: totalIncome, expense: totalExpense, profitLoss: totalIncome - totalExpense });

    // Check istatistikleri (tüm firmalar veya seçili firma)
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let checkQuery = supabase.from('checks').select('*');
    if (selectedFirm) checkQuery = checkQuery.eq('firm_id', selectedFirm.id);
    const { data: allChecks } = await checkQuery;
    
    const pendingGiven = (allChecks || []).filter(c => c.check_type === 'given' && c.status === 'pending').length;
    const urgentGiven = (allChecks || []).filter(c => c.check_type === 'given' && c.status === 'pending' && c.due_date <= sevenDaysLater).length;
    const paidChecksRaw = (allChecks || []).filter(c => c.check_type === 'given' && c.status === 'collected');
    const paidAmount = paidChecksRaw.reduce((s, c) => s + c.amount, 0);
    const pendingReceived = (allChecks || []).filter(c => c.check_type === 'received' && c.status === 'pending').length;
    const urgentReceived = (allChecks || []).filter(c => c.check_type === 'received' && c.status === 'pending' && c.due_date <= sevenDaysLater).length;
    const collectedChecksRaw = (allChecks || []).filter(c => c.check_type === 'received' && c.status === 'collected');
    const collectedAmount = collectedChecksRaw.reduce((s, c) => s + c.amount, 0);

    // Kasa/banka bakiyeleri
    const { data: cashRegs } = await supabase.from('cash_registers').select('id, opening_balance').eq('is_active', true);
    const { data: bankAccs } = await supabase.from('bank_accounts').select('id, opening_balance').eq('is_active', true);
    
    let cashBalance = (cashRegs || []).reduce((s, c) => s + c.opening_balance, 0);
    let bankBalance = (bankAccs || []).reduce((s, b) => s + b.opening_balance, 0);
    
    // Kasa/banka hareketlerini ekle
    const cashRegIds = (cashRegs || []).map(c => c.id);
    const bankAccIds = (bankAccs || []).map(b => b.id);
    
    if (cashRegIds.length > 0) {
      const { data: cashTx } = await supabase.from('cash_transactions').select('amount, transaction_type').in('cash_register_id', cashRegIds).is('transaction_id', null);
      (cashTx || []).forEach(t => {
        cashBalance += t.transaction_type === 'in' ? t.amount : -t.amount;
      });
    }
    
    if (bankAccIds.length > 0) {
      const { data: bankTx } = await supabase.from('bank_transactions').select('amount, transaction_type').in('bank_account_id', bankAccIds).is('transaction_id', null);
      (bankTx || []).forEach(t => {
        bankBalance += t.transaction_type === 'in' ? t.amount : -t.amount;
      });
    }

    setCheckStats({
      totalCash: cashBalance, totalBank: bankBalance,
      pendingGiven, urgentGiven, paidChecks: paidChecksRaw.length, paidChecksAmount: paidAmount,
      pendingReceived, urgentReceived, collectedChecks: collectedChecksRaw.length, collectedChecksAmount: collectedAmount,
    });
  };

  const [pageTotals, setPageTotals] = useState<{ income: number; expense: number; profitLoss: number }>({ income: 0, expense: 0, profitLoss: 0 });

  const totalIncome = pageTotals.income;
  const totalExpense = pageTotals.expense;
  const totalProfitLoss = pageTotals.profitLoss;
  const totalChecksGiven = firmSummaries.reduce((s, f) => s + f.checksGiven, 0);
  const totalChecksPaid = firmSummaries.reduce((s, f) => s + f.checksPaid, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingFirm) {
      await supabase.from('firms').update({ name: formData.name, tax_number: formData.tax_number, address: formData.address, phone: formData.phone, email: formData.email, type: formData.type }).eq('id', editingFirm.id);
      setMessage({ type: 'success', text: 'Firma başarıyla güncellendi!' });
    } else {
      await supabase.from('firms').insert({
        name: formData.name,
        tax_number: formData.tax_number,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        type: formData.type,
        is_active: true,
      });
      setMessage({ type: 'success', text: `"${formData.name}" firması eklendi!` });
    }
    setShowForm(false); setEditingFirm(null);
    setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' });
    setSimilarWarning([]);
    fetchFirms();
    fetchFirmSummaries();
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (firm: Firm) => {
    setEditingFirm(firm);
    setFormData({ name: firm.name, tax_number: firm.tax_number || '', address: firm.address || '', phone: firm.phone || '', email: firm.email || '', type: firm.type });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu firmayı silmek istediğinizden emin misiniz?')) {
      await supabase.from('firms').update({ is_active: false }).eq('id', id);
      fetchFirms();
      fetchFirmSummaries();
    }
  };

  const filtered = firms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.tax_number?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await importFromExcel(file);
      
      if (!data || data.length === 0) {
        alert('Excel dosyasında veri bulunamadı.');
        return;
      }

      let importedCount = 0;

      for (const row of data) {
        const name = String(row['Firma Adı'] || row['firma_adi'] || row['Name'] || row['name'] || '');
        const taxNumber = String(row['Vergi No'] || row['vergi_no'] || row['Tax'] || row['tax'] || '');
        const phone = String(row['Telefon'] || row['telefon'] || row['Phone'] || row['phone'] || '');
        const email = String(row['E-posta'] || row['eposta'] || row['Email'] || row['email'] || '');
        const address = String(row['Adres'] || row['adres'] || row['Address'] || row['address'] || '');
        
        if (!name) continue;

        const exists = firms.some(f => f.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;

        const { error } = await supabase.from('firms').insert({
          name: name.trim(),
          tax_number: taxNumber.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          type: 'both',
          is_active: true,
        });

        if (!error) importedCount++;
      }

      alert(`${importedCount} firma başarıyla içe aktarıldı!`);
      setShowExcelImport(false);
      fetchFirms();
      fetchFirmSummaries();
    } catch (error) {
      console.error('Excel import hatası:', error);
      alert('Excel dosyası okunurken bir hata oluştu.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Firma Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <div className="flex gap-2">
          <button onClick={() => exportFirmsToCSV(firmSummaries.map(fs => fs.firm))} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download size={16} />CSV İndir
          </button>
          <button onClick={() => setShowExcelImport(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FileSpreadsheet size={16} />Excel'den İçe Aktar
          </button>
          <button onClick={() => { setEditingFirm(null); setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"><Plus size={16} />Yeni Firma</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Firma Özet Kartları */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            {selectedFirm ? `${selectedFirm.name} - Firma Özetleri` : 'Tüm Firmalar - Firma Özetleri'}
          </h2>
        </div>

        {firmSummaries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">Henüz firma bulunamadı.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-green-600" /><span className="text-xs text-green-700 font-medium">Toplam Gelir</span></div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2"><TrendingDown size={16} className="text-red-600" /><span className="text-xs text-red-700 font-medium">Toplam Gider</span></div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpense)}</p>
              </div>
              <div className={`rounded-xl p-4 border ${totalProfitLoss >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'} /><span className={`text-xs font-medium ${totalProfitLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Kâr/Zarar</span></div>
                <p className={`text-lg font-bold ${totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totalProfitLoss)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2"><Wallet size={16} className="text-blue-600" /><span className="text-xs text-blue-700 font-medium">Kasa Bakiyesi</span></div>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(checkStats.totalCash)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2"><Building2 size={16} className="text-purple-600" /><span className="text-xs text-purple-700 font-medium">Banka Bakiyesi</span></div>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(checkStats.totalBank)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-2"><FileCheck size={16} className="text-orange-600" /><span className="text-xs text-orange-700 font-medium">Bekleyen Verilen Çek</span></div>
                <p className="text-lg font-bold text-orange-600">{checkStats.pendingGiven} adet</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-yellow-600" /><span className="text-xs text-yellow-700 font-medium">Vadesi Yaklaşan Verilen</span></div>
                <p className="text-lg font-bold text-yellow-600">{checkStats.urgentGiven} adet</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2"><FileCheck size={16} className="text-red-600" /><span className="text-xs text-red-700 font-medium">Ödenen Çek</span></div>
                <p className="text-lg font-bold text-red-600">{checkStats.paidChecks} adet / {formatCurrency(checkStats.paidChecksAmount)}</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
                <div className="flex items-center gap-2 mb-2"><FileCheck size={16} className="text-teal-600" /><span className="text-xs text-teal-700 font-medium">Bekleyen Alınan Çek</span></div>
                <p className="text-lg font-bold text-teal-600">{checkStats.pendingReceived} adet</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-600" /><span className="text-xs text-amber-700 font-medium">Vadesi Yaklaşan Alınan</span></div>
                <p className="text-lg font-bold text-amber-600">{checkStats.urgentReceived} adet</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2"><FileCheck size={16} className="text-green-600" /><span className="text-xs text-green-700 font-medium">Tahsil Edilen Çek</span></div>
                <p className="text-lg font-bold text-green-600">{checkStats.collectedChecks} adet / {formatCurrency(checkStats.collectedChecksAmount)}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <ResizableTh columnId="firma-firma" className="text-left py-3 px-4">Firma</ResizableTh>
                      <ResizableTh columnId="firma-gelir" className="text-right py-3 px-4">Gelir</ResizableTh>
                      <ResizableTh columnId="firma-gider" className="text-right py-3 px-4">Gider</ResizableTh>
                      <ResizableTh columnId="firma-verilen-cek" className="text-right py-3 px-4">Verilen Çek</ResizableTh>
                      <ResizableTh columnId="firma-odencek" className="text-right py-3 px-4">Ödenen Çek</ResizableTh>
                      <ResizableTh columnId="firma-kar" className="text-right py-3 px-4">Kar/Zarar</ResizableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {firmSummaries.map(fs => (
                      <tr key={fs.firm.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4"><div className="flex items-center gap-2"><Building2 size={14} className="text-slate-500" /><span className="font-medium">{fs.firm.name}</span></div></td>
                        <td className="py-3 px-4 text-right text-green-600 font-mono">{formatCurrency(fs.income)}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-mono">{formatCurrency(fs.expense)}</td>
                        <td className="py-3 px-4 text-right text-orange-600 font-mono">{formatCurrency(fs.checksGiven)}</td>
                        <td className="py-3 px-4 text-right text-purple-600 font-mono">{formatCurrency(fs.checksPaid)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold"><span className={fs.profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(fs.profitLoss)}</span></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                      <td className="py-3 px-4">TOPLAM</td>
                      <td className="py-3 px-4 text-right text-green-600 font-mono">{formatCurrency(totalIncome)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-mono">{formatCurrency(totalExpense)}</td>
                      <td className="py-3 px-4 text-right text-orange-600 font-mono">{formatCurrency(totalChecksGiven)}</td>
                      <td className="py-3 px-4 text-right text-purple-600 font-mono">{formatCurrency(totalChecksPaid)}</td>
                      <td className="py-3 px-4 text-right font-mono"><span className={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(totalProfitLoss)}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Firma ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-96 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <ResizableTh columnId="firma-liste-ad" className="text-left py-3 px-4">Firma Adı</ResizableTh>
              <ResizableTh columnId="firma-liste-vergi" className="text-left py-3 px-4">Vergi No</ResizableTh>
              <ResizableTh columnId="firma-liste-tel" className="text-left py-3 px-4">Telefon</ResizableTh>
              <ResizableTh columnId="firma-liste-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
            </tr></thead>
            <tbody>
              {filtered.map(firm => (
                <tr key={firm.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg"><Building2 size={16} className="text-slate-600" /></div><span className="font-medium">{firm.name}</span></div></td>
                  <td className="py-3 px-4 text-slate-600">{firm.tax_number || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{firm.phone || '-'}</td>
                  <td className="py-3 px-4 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEdit(firm)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button><button onClick={() => handleDelete(firm.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center py-8 text-slate-500">Firma bulunamadı.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingFirm ? 'Firma Düzenle' : 'Yeni Firma'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {similarWarning.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Benzer firmalar bulundu:</span>
                  </div>
                  <div className="space-y-1">
                    {similarWarning.map(f => (
                      <div key={f.id} className="text-sm text-amber-700">
                        <span>{f.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">Yine de kaydetmek istiyor musunuz?</p>
                </div>
              )}

              <div><label className="block text-sm font-medium text-slate-700 mb-1">Firma Adı</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Vergi No</label><input type="text" value={formData.tax_number} onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Adres</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => { setShowForm(false); setEditingFirm(null); setSimilarWarning([]); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
            </form>
          </div>
        </div>
      )}

      {showExcelImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Excel'den Firma İçe Aktar</h3>
              <button onClick={() => setShowExcelImport(false)} className="p-2 hover:bg-slate-100 rounded-lg"><span className="text-xl">×</span></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Beklenen Sütunlar:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- <strong>Firma Adı</strong> (zorunlu)</li>
                  <li>- <strong>Vergi No</strong> (opsiyonel)</li>
                  <li>- <strong>Telefon</strong> (opsiyonel)</li>
                  <li>- <strong>E-posta</strong> (opsiyonel)</li>
                  <li>- <strong>Adres</strong> (opsiyonel)</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  const csvContent = `Kod,Firma Adı,Vergi No,Telefon,E-posta,Adres
A.0001,ABC İnşaat,1234567890,0212 555 1234,info@abc.com,İstanbul
B.0001,XYZ Ticaret,9876543210,0216 444 5678,info@xyz.com,İstanbul
C.0001,DEF A.Ş.,5554443333,0312 333 1111,info@def.com,Ankara`;
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'firma-ornek.csv';
                  link.click();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={16} />
                Örnek CSV İndir
              </button>
              
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center relative">
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 mb-3">Excel dosyasını seçin</p>
                <input
                  ref={(input) => { if (input) input.setAttribute('id', 'firm-file-input'); }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelImport}
                  className="hidden"
                  disabled={importing}
                />
                <button type="button" onClick={() => document.getElementById('firm-file-input')?.click()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" disabled={importing}>
                  {importing ? 'İçe Aktarılıyor...' : 'Dosya Seç'}
                </button>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  <strong>Not:</strong> Kodlar otomatik üretilir. Aynı isimde firma varsa atlanır.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowExcelImport(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
