import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { exportToExcel } from '../lib/excel';
import { useAuth } from '../hooks/useAuth';
import { useFirm } from '../hooks/useFirm';
import { BarChart3, TrendingUp, TrendingDown, Download, Users, Search, FileText, AlertTriangle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';
import type { UserProfile } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Report { id: string; name: string; income: number; expense: number; net: number; }

interface TransactionLog {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description?: string;
  invoice_number?: string;
  firm?: { name: string };
  created_by?: string;
  created_at: string;
}

export default function Reports() {
  const { user } = useAuth();
  const { selectedFirm } = useFirm();
  const [firmReports, setFirmReports] = useState<Report[]>([]);
  const [projectReports, setProjectReports] = useState<Report[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<{ month: string; income: number; expense: number; net: number }[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'firm' | 'project' | 'logs' | 'comparison'>('firm');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('viewer');

  useEffect(() => { 
    fetchReports(); 
    fetchUserProfiles();
    fetchUserRole();
  }, [selectedFirm]);

  const fetchUserRole = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
    if (data) setUserRole(data.role);
  };

  const fetchUserProfiles = async () => {
    const { data } = await supabase.from('user_profiles').select('*');
    if (data) setUserProfiles(data);
  };

  const fetchReports = async () => {
    let query = supabase.from('transactions').select('*, firm:firms(*), project:projects(*)').eq('is_exception', false);
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    const { data: transactions } = await query;
    if (!transactions) { setLoading(false); return; }

    const firmMap = new Map<string, Report>();
    transactions.forEach(t => {
      if (!t.firm_id) return;
      const e = firmMap.get(t.firm_id) || { id: t.firm_id, name: t.firm?.name || '', income: 0, expense: 0, net: 0 };
      if (t.transaction_type === 'income' || t.transaction_type === 'invoice' || t.transaction_type === 'sale_invoice') e.income += t.amount; else e.expense += t.amount;
      e.net = e.income - e.expense; firmMap.set(t.firm_id, e);
    });
    setFirmReports(Array.from(firmMap.values()).sort((a, b) => b.net - a.net));

    const projectMap = new Map<string, Report>();
    transactions.forEach(t => {
      if (!t.project_id) return;
      const e = projectMap.get(t.project_id) || { id: t.project_id, name: t.project?.name || '', income: 0, expense: 0, net: 0 };
      if (t.transaction_type === 'income' || t.transaction_type === 'invoice' || t.transaction_type === 'sale_invoice') e.income += t.amount; else e.expense += t.amount;
      e.net = e.income - e.expense; projectMap.set(t.project_id, e);
    });
    setProjectReports(Array.from(projectMap.values()).sort((a, b) => b.net - a.net));

    // İşlem loglarını çek (admin için)
    setTransactionLogs(transactions as TransactionLog[]);

    // Aylık karşılaştırma
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const month = t.transaction_date?.substring(0, 7) || 'Bilinmeyen';
      const entry = monthlyMap.get(month) || { income: 0, expense: 0 };
      if (t.transaction_type === 'income' || t.transaction_type === 'invoice' || t.transaction_type === 'sale_invoice') {
        entry.income += t.amount;
      } else {
        entry.expense += t.amount;
      }
      monthlyMap.set(month, entry);
    });
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, income: data.income, expense: data.expense, net: data.income - data.expense }))
      .sort((a, b) => b.month.localeCompare(a.month));
    setMonthlyComparison(monthlyData);

    setLoading(false);
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '-';
    const profile = userProfiles.find(p => p.id === userId);
    return profile?.full_name || userId.substring(0, 8);
  };

  const totalIncome = firmReports.reduce((s, r) => s + r.income, 0);
  const totalExpense = firmReports.reduce((s, r) => s + r.expense, 0);

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      income: 'Gelir',
      expense: 'Gider',
      invoice: 'Fatura',
      delivery_note: 'İrsaliye',
      purchase_invoice: 'Alış Faturası',
      sale_invoice: 'Satış Faturası',
      cash: 'Nakit',
      bank: 'Banka',
      check: 'Çek',
    };
    return labels[type] || type;
  };

  const filteredLogs = transactionLogs.filter(log => 
    log.firm?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserName(log.created_by).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToPDF = (data: Report[], title: string, filename: string) => {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
    
    // Tablo başlıkları
    const headers = [['Firma/Proje', 'Gelir', 'Gider', 'Net']];
    
    // Satırlar
    const rows = data.map(r => [
      r.name,
      formatCurrency(r.income),
      formatCurrency(r.expense),
      formatCurrency(r.net)
    ]);
    
    // Toplam satırı
    const totalIncome = data.reduce((s, r) => s + r.income, 0);
    const totalExpense = data.reduce((s, r) => s + r.expense, 0);
    rows.push(['TOPLAM', formatCurrency(totalIncome), formatCurrency(totalExpense), formatCurrency(totalIncome - totalExpense)]);
    
    (doc as any).autoTable({
      head: headers,
      body: rows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
    
    doc.save(`${filename}.pdf`);
  };

  const exportLogsToPDF = () => {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(18);
    doc.text('İşlem Logları', 14, 22);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);
    
    // Tablo başlıkları
    const headers = [['Tarih', 'Tür', 'Firma', 'Tutar', 'Açıklama', 'Giren']];
    
    // Satırlar
    const rows = filteredLogs.map(l => [
      l.transaction_date,
      getTransactionTypeLabel(l.transaction_type),
      l.firm?.name || '-',
      formatCurrency(l.amount),
      (l.description || '-').substring(0, 30),
      getUserName(l.created_by)
    ]);
    
    (doc as any).autoTable({
      head: headers,
      body: rows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { halign: 'right', cellWidth: 25 },
        4: { cellWidth: 35 },
        5: { cellWidth: 30 },
      },
    });
    
    doc.save('islem-loglari.pdf');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  if (!selectedFirm) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Firma Seçimi Zorunlu</h2>
        <p className="text-slate-500">Lütfen üst kısımdan bir firma seçin.</p>
      </div>
    );
  }

  const data = activeTab === 'firm' ? firmReports : activeTab === 'project' ? projectReports : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Raporlar{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-6 border border-green-200"><div className="flex items-center gap-3"><div className="p-3 bg-green-500 rounded-lg"><TrendingUp size={24} className="text-white" /></div><div><p className="text-sm text-green-700">Toplam Gelir</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></div></div></div>
        <div className="bg-red-50 rounded-xl p-6 border border-red-200"><div className="flex items-center gap-3"><div className="p-3 bg-red-500 rounded-lg"><TrendingDown size={24} className="text-white" /></div><div><p className="text-sm text-red-700">Toplam Gider</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p></div></div></div>
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200"><div className="flex items-center gap-3"><div className="p-3 bg-blue-500 rounded-lg"><BarChart3 size={24} className="text-white" /></div><div><p className="text-sm text-blue-700">Net Kâr</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(totalIncome - totalExpense)}</p></div></div></div>
      </div>
      
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('firm')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'firm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Firma Bazlı</button>
        <button onClick={() => setActiveTab('project')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Proje Bazlı</button>
        <button onClick={() => setActiveTab('comparison')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'comparison' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Aylık Karşılaştırma</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            <span className="flex items-center gap-2"><Users size={16} />İşlem Logları</span>
          </button>
        )}
      </div>

      {activeTab === 'logs' && userRole === 'admin' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Tüm İşlemler (Kimin Girdiği Görünür)</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button onClick={() => exportToExcel(filteredLogs.map(l => ({ 'Tarih': l.transaction_date, 'Tür': getTransactionTypeLabel(l.transaction_type), 'Firma': l.firm?.name || '-', 'Tutar': l.amount, 'Açıklama': l.description || '-', 'Giren': getUserName(l.created_by) })), 'islem-loglari', 'İşlem Logları')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Excel</button>
              <button onClick={exportLogsToPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><FileText size={16} />PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <ResizableTh columnId="rapor-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
                  <ResizableTh columnId="rapor-tur" className="text-left py-3 px-4">Tür</ResizableTh>
                  <ResizableTh columnId="rapor-firma" className="text-left py-3 px-4">Firma</ResizableTh>
                  <ResizableTh columnId="rapor-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
                  <ResizableTh columnId="rapor-aciklama" className="text-left py-3 px-4">Açıklama</ResizableTh>
                  <ResizableTh columnId="rapor-kisi" className="text-left py-3 px-4">Giren Kişi</ResizableTh>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{formatDateTR(log.transaction_date)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {getTransactionTypeLabel(log.transaction_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{log.firm?.name || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(log.amount)}</td>
                    <td className="py-3 px-4 text-slate-600">{log.description || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-2">
                        <Users size={14} className="text-blue-600" />
                        <span className="font-medium text-blue-600">{getUserName(log.created_by)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLogs.length === 0 && <p className="text-center py-8 text-slate-500">İşlem bulunamadı.</p>}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Aylık Karşılaştırma</h2>
            <div className="flex gap-2">
              <button onClick={() => exportToExcel(monthlyComparison.map(r => ({ 'Ay': r.month, 'Gelir': r.income, 'Gider': r.expense, 'Net': r.net })), 'aylik-karsilastirma', 'Aylık Karşılaştırma')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Excel</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <ResizableTh columnId="karsilastirma-ay" className="text-left py-3 px-4">Ay</ResizableTh>
              <ResizableTh columnId="karsilastirma-gelir" className="text-right py-3 px-4">Gelir</ResizableTh>
              <ResizableTh columnId="karsilastirma-gider" className="text-right py-3 px-4">Gider</ResizableTh>
              <ResizableTh columnId="karsilastirma-net" className="text-right py-3 px-4">Net</ResizableTh>
            </tr></thead>
            <tbody>
              {monthlyComparison.map(r => (
                <tr key={r.month} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{r.month}</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(r.income)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(r.expense)}</td>
                  <td className="py-3 px-4 text-right font-medium"><span className={r.net >= 0 ? 'text-blue-600' : 'text-orange-600'}>{formatCurrency(r.net)}</span></td>
                </tr>
              ))}
              {monthlyComparison.length > 0 && (
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="py-3 px-4">TOPLAM</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(monthlyComparison.reduce((s, r) => s + r.income, 0))}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(monthlyComparison.reduce((s, r) => s + r.expense, 0))}</td>
                  <td className="py-3 px-4 text-right"><span className={monthlyComparison.reduce((s, r) => s + r.net, 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}>{formatCurrency(monthlyComparison.reduce((s, r) => s + r.net, 0))}</span></td>
                </tr>
              )}
            </tbody>
          </table>
          {monthlyComparison.length === 0 && <p className="text-center py-8 text-slate-500">Veri bulunamadı.</p>}
        </div>
      )}

      {activeTab !== 'logs' && activeTab !== 'comparison' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">{activeTab === 'firm' ? 'Firma Bazlı' : 'Proje Bazlı'} Gelir/Gider Raporu</h2>
            <div className="flex gap-2">
              <button onClick={() => exportToExcel(data.map(r => ({ 'Ad': r.name, 'Gelir': r.income, 'Gider': r.expense, 'Net': r.net })), activeTab === 'firm' ? 'firma-raporu' : 'proje-raporu', 'Rapor')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Excel</button>
              <button onClick={() => exportToPDF(data, activeTab === 'firm' ? 'Firma Bazlı Rapor' : 'Proje Bazlı Rapor', activeTab === 'firm' ? 'firma-raporu' : 'proje-raporu')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><FileText size={16} />PDF</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <ResizableTh columnId="rapor-ozet-baslik" className="text-left py-3 px-4">{activeTab === 'firm' ? 'Firma' : 'Proje'}</ResizableTh>
              <ResizableTh columnId="rapor-ozet-gelir" className="text-right py-3 px-4">Gelir</ResizableTh>
              <ResizableTh columnId="rapor-ozet-gider" className="text-right py-3 px-4">Gider</ResizableTh>
              <ResizableTh columnId="rapor-ozet-net" className="text-right py-3 px-4">Net</ResizableTh>
            </tr></thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{r.name}</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(r.income)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(r.expense)}</td>
                  <td className="py-3 px-4 text-right font-medium"><span className={r.net >= 0 ? 'text-blue-600' : 'text-orange-600'}>{formatCurrency(r.net)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="text-center py-8 text-slate-500">Veri bulunamadı.</p>}
        </div>
      )}
    </div>
  );
}
