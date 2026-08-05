import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { exportTransactionsToExcel } from '../lib/excel';
import { generateInvoicePDF, generateDeliveryNotePDF } from '../lib/pdf';
import { useFirm } from '../hooks/useFirm';
import type { Transaction, TransactionType, Firm, Project } from '../types';
import { Search, Edit2, Trash2, ArrowRightLeft, ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function TransactionTracking() {
  const { selectedFirm, selectedProject } = useFirm();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [carilerMap, setCarilerMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedFirm, selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    // Transaction'ları çek (join olmadan)
    let txQuery = supabase.from('transactions').select('id, transaction_date, transaction_type, amount, description, invoice_number, delivery_note_number, cari_id, project_id, firm_id, created_at').order('transaction_date', { ascending: false });
    
    if (selectedFirm) txQuery = txQuery.eq('firm_id', selectedFirm.id);
    if (selectedProject) txQuery = txQuery.eq('project_id', selectedProject.id);
    
    let projectsQuery = supabase.from('projects').select('*');
    if (selectedFirm) projectsQuery = projectsQuery.eq('firm_id', selectedFirm.id);

    let cashQuery = supabase.from('cash_transactions').select('id, amount, transaction_type, created_at, cash_register_id, cari_id, project_id').order('created_at', { ascending: false });
    let bankQuery = supabase.from('bank_transactions').select('id, amount, transaction_type, created_at, bank_account_id, cari_id, project_id').order('created_at', { ascending: false });
    let checkQuery = supabase.from('checks').select('id, amount, check_type, status, check_number, due_date, created_at, firm_id, project_id, cari_id').order('created_at', { ascending: false });

    if (selectedFirm) {
      cashQuery = cashQuery.eq('firm_id', selectedFirm.id);
      bankQuery = bankQuery.eq('firm_id', selectedFirm.id);
      checkQuery = checkQuery.eq('firm_id', selectedFirm.id);
    }
    if (selectedProject) {
      cashQuery = cashQuery.eq('project_id', selectedProject.id);
      bankQuery = bankQuery.eq('project_id', selectedProject.id);
      checkQuery = checkQuery.eq('project_id', selectedProject.id);
    }

    const [transactionsRes, typesRes, firmsRes, projectsRes, cashRes, bankRes, checkRes] = await Promise.all([
      txQuery,
      supabase.from('transaction_types').select('*').eq('is_active', true),
      supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both'),
      projectsQuery,
      cashQuery,
      bankQuery,
      checkQuery,
    ]);

    const txData = (transactionsRes.data || []) as Transaction[];
    if (transactionsRes.data) setTransactions(txData);
    if (typesRes.data) setTransactionTypes(typesRes.data);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (cashRes.data) setCashTransactions(cashRes.data);
    if (bankRes.data) setBankTransactions(bankRes.data);
    if (checkRes.data) setChecks(checkRes.data);

    // Tüm carileri çek (sadece ilgili olanları değil, hepsini - harita için)
    const { data: cariData } = await supabase.from('cariler').select('id, name');
    if (cariData) {
      const newMap = new Map<string, any>();
      cariData.forEach((c: any) => newMap.set(c.id, c));
      setCarilerMap(newMap);
    }

    if (cariData) {
      const newMap = new Map<string, any>();
      cariData.forEach((c: any) => newMap.set(c.id, c));
      setCarilerMap(newMap);
    }

    setLoading(false);
  };

  const typeLabels: Record<string, string> = {
    income: 'Gelir',
    expense: 'Gider',
    invoice: 'Fatura',
    sale_invoice: 'Satış Faturası',
    purchase_invoice: 'Alış Faturası',
    delivery_note: 'İrsaliye',
    sale_delivery_note: 'Satış İrsaliyesi',
    purchase_delivery_note: 'Alış İrsaliyesi',
    cash: 'Nakit',
    cash_in: 'Kasa Giriş',
    cash_out: 'Kasa Çıkış',
    bank: 'Banka',
    bank_in: 'Banka Giriş',
    bank_out: 'Banka Çıkış',
    check: 'Çek',
    check_received: 'Alınan Çek',
    check_given: 'Verilen Çek',
  };

  const typeColors: Record<string, string> = {
    income: 'bg-green-100 text-green-700 border-green-200',
    expense: 'bg-red-100 text-red-700 border-red-200',
    invoice: 'bg-blue-100 text-blue-700 border-blue-200',
    sale_invoice: 'bg-teal-100 text-teal-700 border-teal-200',
    purchase_invoice: 'bg-orange-100 text-orange-700 border-orange-200',
    delivery_note: 'bg-purple-100 text-purple-700 border-purple-200',
    sale_delivery_note: 'bg-violet-100 text-violet-700 border-violet-200',
    purchase_delivery_note: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    cash_in: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    cash_out: 'bg-amber-100 text-amber-700 border-amber-200',
    bank_in: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    bank_out: 'bg-blue-100 text-blue-700 border-blue-200',
    check_received: 'bg-pink-100 text-pink-700 border-pink-200',
    check_given: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  const getTypeLabel = (type: string) => {
    // Önce statik label'lardan kontrol et
    if (typeLabels[type]) return typeLabels[type];
    // Sonra veritabanından gelen türlerden kontrol et
    const dbType = transactionTypes.find(t => t.value === type);
    if (dbType) return dbType.name;
    // Hiçbiri yoksa type'ı olduğu gibi göster
    return type;
  };

  const getTypeColor = (type: string) => {
    return typeColors[type] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // İsim haritaları oluştur (state değişkenlerinden)
  const firmMap = new Map(firms.map((f: any) => [f.id, f.name]));
  const projMap = new Map(projects.map((p: any) => [p.id, p.name]));

  // Tüm işlemleri birleştir (transactions + nakit + banka + çek)
  const allItems = [
    ...transactions.map(t => ({
      id: t.id,
      type: t.transaction_type,
      date: t.transaction_date,
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: firmMap.get(t.firm_id) || '-',
      project: projMap.get(t.project_id) || '-',
      description: t.description || '-',
      amount: t.amount,
      invoice_number: t.invoice_number || '',
      created_at: t.created_at,
      _raw: t,
    })),
      ...cashTransactions.map(t => ({
      id: t.id,
      type: t.transaction_type === 'in' ? 'cash_in' : 'cash_out',
      date: t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: '-',
      project: projMap.get(t.project_id) || '-',
      description: 'Kasa hareketi',
      amount: t.amount,
      invoice_number: '',
      created_at: t.created_at,
      _raw: t,
    })),
    ...bankTransactions.map(t => ({
      id: t.id,
      type: t.transaction_type === 'in' ? 'bank_in' : 'bank_out',
      date: t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: '-',
      project: projMap.get(t.project_id) || '-',
      description: 'Banka hareketi',
      amount: t.amount,
      invoice_number: '',
      created_at: t.created_at,
      _raw: t,
    })),
      ...checks.map(t => ({
      id: t.id,
      type: t.check_type === 'received' ? 'check_received' : 'check_given',
      date: t.due_date || t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: firmMap.get(t.firm_id) || '-',
      project: projMap.get(t.project_id) || '-',
      description: `Çek No: ${t.check_number || '-'} (${t.status === 'pending' ? 'Bekleyen' : t.status === 'collected' ? 'Tahsil' : t.status === 'paid' ? 'Ödenen' : t.status})`,
      amount: t.amount,
      invoice_number: '',
      created_at: t.created_at,
      _raw: t,
    })),
  ].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

  // Her tür için işlemleri grupla
  const groupedTransactions = allItems.reduce((acc, item) => {
    const type = item.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof allItems>);

  // Filtrelenmiş işlemler
  const filteredGrouped = Object.entries(groupedTransactions).reduce((acc, [type, items]) => {
    if (filterType !== 'all' && type !== filterType) return acc;
    
    const filtered = items.filter(t =>
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.firm as string)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filtered.length > 0) acc[type] = filtered;
    return acc;
  }, {} as Record<string, typeof allItems>);

  const toggleType = (type: string) => {
    setExpandedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const expandAll = () => {
    setExpandedTypes(Object.keys(filteredGrouped));
  };

  const collapseAll = () => {
    setExpandedTypes([]);
  };

  const handleEdit = (transaction: Transaction) => {
    navigate('/islem-girisi', { state: { editTransaction: transaction } });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu işlemi silmek istediğinizden emin misiniz?')) {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    }
  };

  // İstatistikler
  const stats = Object.entries(groupedTransactions).map(([type, items]) => ({
    type,
    label: getTypeLabel(type),
    count: items.length,
    total: items.reduce((sum, t) => sum + (t.amount || 0), 0),
  }));

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
          <ArrowRightLeft size={24} />
          İşlem Takibi
        </h1>
        <div className="flex gap-2">
          <button onClick={() => exportTransactionsToExcel(transactions)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"><Download size={16} /> Excel</button>
          <button onClick={expandAll} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            Tümünü Aç
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            Tümünü Kapat
          </button>
        </div>
      </div>


      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {stats.map(stat => (
          <button
            key={stat.type}
            onClick={() => setFilterType(filterType === stat.type ? 'all' : stat.type)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${
              filterType === stat.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${getTypeColor(stat.type)}`}>
              {stat.label}
            </span>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(stat.total)}</p>
          </button>
        ))}
      </div>

      {/* Arama ve Filtre */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="İşlem ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg"
        >
          <option value="all">Tüm Türler</option>
          {transactionTypes.map(type => (
            <option key={type.value} value={type.value}>{type.name}</option>
          ))}
        </select>
      </div>

      {/* İşlem Grupları */}
      <div className="space-y-4">
        {Object.entries(filteredGrouped).map(([type, items]) => {
          const isExpanded = expandedTypes.includes(type);
          const typeTotal = items.reduce((sum, t) => sum + (t.amount || 0), 0);

          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Grup Başlığı */}
              <button
                onClick={() => toggleType(type)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(type)}`}>
                    {getTypeLabel(type)}
                  </span>
                  <span className="text-sm text-slate-500">{items.length} işlem</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{formatCurrency(typeTotal)}</p>
                  <p className="text-xs text-slate-500">Toplam Tutar</p>
                </div>
              </button>

              {/* İşlem Listesi */}
              {isExpanded && (
                <div className="border-t border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <ResizableTh columnId="islem-tarih" className="text-left py-2 px-4">Tarih</ResizableTh>
                        <ResizableTh columnId="islem-firma" className="text-left py-2 px-4">Cari</ResizableTh>
                        <ResizableTh columnId="islem-firma-adi" className="text-left py-2 px-4">Firma</ResizableTh>
                        <ResizableTh columnId="islem-proje" className="text-left py-2 px-4">Proje</ResizableTh>
                        <ResizableTh columnId="islem-aciklama" className="text-left py-2 px-4">Açıklama</ResizableTh>
                        <ResizableTh columnId="islem-tutar" className="text-right py-2 px-4">Tutar</ResizableTh>
                        <ResizableTh columnId="islem-islem" className="text-center py-2 px-4">İşlem</ResizableTh>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(t => (
                        <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">{formatDateTR(t.date)}</td>
                          <td className="py-3 px-4">{t.cari || '-'}</td>
                          <td className="py-3 px-4">{t.firm || '-'}</td>
                          <td className="py-3 px-4">{t.project || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">{t.description || '-'}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(t.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(t.type === 'invoice' || t.type === 'delivery_note' || t.type === 'sale_invoice' || t.type === 'purchase_invoice' || t.type === 'sale_delivery_note' || t.type === 'purchase_delivery_note') && (
                                <button onClick={() => {
                                  const isDeliveryNote = ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'].includes(t.type);
                                  if (isDeliveryNote) {
                                    generateDeliveryNotePDF(t._raw, t.firm || '', carilerMap.get(t._raw.cari_id) || null);
                                  } else {
                                    generateInvoicePDF(t._raw, t.firm || '', carilerMap.get(t._raw.cari_id) || null);
                                  }
                                }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="PDF İndir">
                                  <FileText size={14} />
                                </button>
                              )}
                              <button onClick={() => handleEdit(t._raw)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(t.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(filteredGrouped).length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <ArrowRightLeft size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Bu kriterlere uygun işlem bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}
