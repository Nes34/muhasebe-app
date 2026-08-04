import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { exportTransactionsToExcel } from '../lib/excel';
import { generateInvoicePDF } from '../lib/pdf';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Transaction, TransactionType, Firm, Project } from '../types';
import { Search, Edit2, Trash2, ArrowRightLeft, ChevronDown, ChevronRight, Save, X, AlertCircle, CheckCircle, Download, FileText } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function TransactionTracking() {
  const { selectedFirm, selectedProject } = useFirm();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState({
    transaction_date: '',
    transaction_type: '',
    firm_id: '',
    project_id: '',
    amount: 0,
    description: '',
    invoice_number: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedFirm, selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    let txQuery = supabase.from('transactions').select('*, firm:firms(*), project:projects(*), cari:cariler(*)').order('transaction_date', { ascending: false });
    
    // Header'da firma seçiliyse sadece o firmaya ait işlemleri göster
    if (selectedFirm) {
      txQuery = txQuery.eq('firm_id', selectedFirm.id);
    }
    if (selectedProject) {
      txQuery = txQuery.eq('project_id', selectedProject.id);
    }
    
    let projectsQuery = supabase.from('projects').select('*');
    if (selectedFirm) projectsQuery = projectsQuery.eq('firm_id', selectedFirm.id);

    let cashQuery = supabase.from('cash_transactions').select('*, cash_register:cash_registers(name), cari:cariler(name), project:projects(name)').order('created_at', { ascending: false });
    let bankQuery = supabase.from('bank_transactions').select('*, bank_account:bank_accounts(bank_name), cari:cariler(name), project:projects(name)').order('created_at', { ascending: false });
    let checkQuery = supabase.from('checks').select('*, firm:firms(name), project:projects(name)').order('created_at', { ascending: false });

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

    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (typesRes.data) setTransactionTypes(typesRes.data);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (cashRes.data) setCashTransactions(cashRes.data);
    if (bankRes.data) setBankTransactions(bankRes.data);
    if (checkRes.data) setChecks(checkRes.data);
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

  // Tüm işlemleri birleştir (transactions + nakit + banka + çek)
  const allItems = [
    ...transactions.map(t => ({
      id: t.id,
      type: t.transaction_type,
      date: t.transaction_date,
      firm: t.cari?.name || t.firm?.name || '-',
      project: t.project?.name || '-',
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
      firm: '-',
      project: t.project?.name || '-',
      description: `Kasa - ${t.cari?.name || t.cash_register?.name || '-'}`,
      amount: t.amount,
      invoice_number: '',
      created_at: t.created_at,
      _raw: t,
    })),
    ...bankTransactions.map(t => ({
      id: t.id,
      type: t.transaction_type === 'in' ? 'bank_in' : 'bank_out',
      date: t.created_at?.split('T')[0] || '',
      firm: '-',
      project: t.project?.name || '-',
      description: `Banka - ${t.cari?.name || t.bank_account?.bank_name || '-'}`,
      amount: t.amount,
      invoice_number: '',
      created_at: t.created_at,
      _raw: t,
    })),
    ...checks.map(t => ({
      id: t.id,
      type: t.check_type === 'received' ? 'check_received' : 'check_given',
      date: t.issue_date || t.created_at?.split('T')[0] || '',
      firm: t.firm?.name || '-',
      project: t.project?.name || '-',
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
      t.firm?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    setEditingTransaction(transaction);
    setEditFormData({
      transaction_date: transaction.transaction_date,
      transaction_type: transaction.transaction_type,
      firm_id: transaction.firm_id || '',
      project_id: transaction.project_id || '',
      amount: transaction.amount,
      description: transaction.description || '',
      invoice_number: transaction.invoice_number || '',
    });
    setMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          transaction_date: editFormData.transaction_date,
          transaction_type: editFormData.transaction_type,
          firm_id: editFormData.firm_id || null,
          project_id: editFormData.project_id || null,
          amount: editFormData.amount,
          description: editFormData.description,
          invoice_number: editFormData.invoice_number || null,
        })
        .eq('id', editingTransaction.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'İşlem başarıyla güncellendi!' });
      setEditingTransaction(null);
      fetchData();
      
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Güncelleme sırasında hata oluştu.' });
    }
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

      {/* Mesaj */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

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
                          <td className="py-3 px-4">{t.firm || '-'}</td>
                          <td className="py-3 px-4">{t.project || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">{t.description || '-'}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(t.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(t.type === 'invoice' || t.type === 'delivery_note' || t.type === 'sale_invoice' || t.type === 'purchase_invoice' || t.type === 'sale_delivery_note' || t.type === 'purchase_delivery_note') && (
                                <button onClick={() => generateInvoicePDF(t._raw)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="PDF İndir">
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

      {/* Düzenleme Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">İşlemi Düzenle</h2>
              <button onClick={() => setEditingTransaction(null)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                  <input
                    type="text"
                    value={editFormData.transaction_date}
                    onChange={(e) => setEditFormData({ ...editFormData, transaction_date: e.target.value })}
                    placeholder="gg.aa.yyyy"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">İşlem Türü</label>
                  <select
                    value={editFormData.transaction_type}
                    onChange={(e) => setEditFormData({ ...editFormData, transaction_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {transactionTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <SearchableSelect
                  options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                  value={editFormData.firm_id}
                  onChange={(id) => setEditFormData({ ...editFormData, firm_id: id })}
                  placeholder="Kod veya isim ile cari ara..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proje</label>
                <select
                  value={editFormData.project_id}
                  onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Proje Seçiniz...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label>
                  <input
                    type="number"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fatura No</label>
                  <input
                    type="text"
                    value={editFormData.invoice_number}
                    onChange={(e) => setEditFormData({ ...editFormData, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <input
                  type="text"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setEditingTransaction(null)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                İptal
              </button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
                <Save size={16} />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
