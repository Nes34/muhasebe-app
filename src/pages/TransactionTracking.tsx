import { useState, useEffect, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { exportTransactionsToExcel } from '../lib/excel';
import { generateInvoicePDF, generateDeliveryNotePDF } from '../lib/pdf';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import DateInput from '../components/DateInput';
import type { Transaction, TransactionType, Firm, Project } from '../types';
import { Search, Edit2, Trash2, ArrowRightLeft, ChevronDown, ChevronRight, Download, FileText, X, Save, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface EditFormData {
  id: string;
  transaction_date: string;
  transaction_type: string;
  firm_id: string;
  cari_id: string;
  project_id: string;
  amount: number;
  description: string;
  invoice_number: string;
  delivery_note_number: string;
  is_exception: boolean;
  exception_reason: string;
}

interface EditItem {
  id?: string;
  product_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  discount_rate: number;
  discount_amount: number;
  amount: number;
}

export default function TransactionTracking() {
  const { selectedFirm, selectedProject } = useFirm();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cariler, setCariler] = useState<any[]>([]);
  const [carilerMap, setCarilerMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);

  // Düzenleme modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    id: '', transaction_date: '', transaction_type: '', firm_id: '', cari_id: '', project_id: '',
    amount: 0, description: '', invoice_number: '', delivery_note_number: '',
    is_exception: false, exception_reason: '',
  });
  const [editItems, setEditItems] = useState<EditItem[]>([]);

  // İrsaliye seçim modal state (düzenleme için)
  const [editSaleDNs, setEditSaleDNs] = useState<any[]>([]);
  const [editSelectedDNIds, setEditSelectedDNIds] = useState<string[]>([]);
  const [editShowDNModal, setEditShowDNModal] = useState(false);
  const [editExpandedDNId, setEditExpandedDNId] = useState<string | null>(null);
  const [editDNItems, setEditDNItems] = useState<any[]>([]);
  const [editLoadingDN, setEditLoadingDN] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedFirm, selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    let txQuery = supabase.from('transactions').select('id, transaction_date, transaction_type, amount, description, invoice_number, delivery_note_number, cari_id, project_id, firm_id, created_at, is_exception, exception_reason, expense_category_id').order('transaction_date', { ascending: false });
    
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

    const [transactionsRes, typesRes, firmsRes, projectsRes, cashRes, bankRes, checkRes, cariRes] = await Promise.all([
      txQuery,
      supabase.from('transaction_types').select('*').eq('is_active', true),
      supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both'),
      projectsQuery,
      cashQuery,
      bankQuery,
      checkQuery,
      supabase.from('cariler').select('id, name, code').eq('is_active', true).order('code'),
    ]);

    const txData = (transactionsRes.data || []) as Transaction[];
    if (transactionsRes.data) setTransactions(txData);
    if (typesRes.data) setTransactionTypes(typesRes.data);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (cashRes.data) setCashTransactions(cashRes.data);
    if (bankRes.data) setBankTransactions(bankRes.data);
    if (checkRes.data) setChecks(checkRes.data);
    if (cariRes.data) setCariler(cariRes.data);

    if (cariRes.data) {
      const newMap = new Map<string, any>();
      cariRes.data.forEach((c: any) => newMap.set(c.id, c));
      setCarilerMap(newMap);
    }

    setLoading(false);
  };

  const typeLabels: Record<string, string> = {
    income: 'Gelir', expense: 'Gider', invoice: 'Fatura',
    sale_invoice: 'Satış Faturası', purchase_invoice: 'Alış Faturası',
    delivery_note: 'İrsaliye', sale_delivery_note: 'Satış İrsaliyesi', purchase_delivery_note: 'Alış İrsaliyesi',
    cash_in: 'Kasa Giriş', cash_out: 'Kasa Çıkış',
    bank_in: 'Banka Giriş', bank_out: 'Banka Çıkış',
    check_received: 'Alınan Çek', check_given: 'Verilen Çek',
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

  const getTypeLabel = (type: string) => typeLabels[type] || transactionTypes.find(t => t.value === type)?.name || type;
  const getTypeColor = (type: string) => typeColors[type] || 'bg-slate-100 text-slate-700 border-slate-200';

  const firmMap = new Map(firms.map((f: any) => [f.id, f.name]));
  const projMap = new Map(projects.map((p: any) => [p.id, p.name]));

  const allItems = [
    ...transactions.map(t => ({
      id: t.id, type: t.transaction_type, date: t.transaction_date,
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: firmMap.get(t.firm_id) || '-',
      project: projMap.get(t.project_id) || '-',
      description: t.description || '-', amount: t.amount,
      invoice_number: t.invoice_number || '', created_at: t.created_at, _raw: t,
    })),
    ...cashTransactions.map(t => ({
      id: t.id, type: t.transaction_type === 'in' ? 'cash_in' : 'cash_out',
      date: t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-', firm: '-',
      project: projMap.get(t.project_id) || '-',
      description: 'Kasa hareketi', amount: t.amount, invoice_number: '', created_at: t.created_at, _raw: t,
    })),
    ...bankTransactions.map(t => ({
      id: t.id, type: t.transaction_type === 'in' ? 'bank_in' : 'bank_out',
      date: t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-', firm: '-',
      project: projMap.get(t.project_id) || '-',
      description: 'Banka hareketi', amount: t.amount, invoice_number: '', created_at: t.created_at, _raw: t,
    })),
    ...checks.map(t => ({
      id: t.id, type: t.check_type === 'received' ? 'check_received' : 'check_given',
      date: t.due_date || t.created_at?.split('T')[0] || '',
      cari: carilerMap.get(t.cari_id)?.name || '-',
      firm: firmMap.get(t.firm_id) || '-',
      project: projMap.get(t.project_id) || '-',
      description: `Çek No: ${t.check_number || '-'} (${t.status === 'pending' ? 'Bekleyen' : t.status === 'collected' ? 'Tahsil' : t.status === 'paid' ? 'Ödenen' : t.status})`,
      amount: t.amount, invoice_number: '', created_at: t.created_at, _raw: t,
    })),
  ].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

  const groupedTransactions = allItems.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, typeof allItems>);

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

  const toggleType = (type: string) => setExpandedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  const expandAll = () => setExpandedTypes(Object.keys(filteredGrouped));
  const collapseAll = () => setExpandedTypes([]);

  // Fatura/irsaliye tipi mi?
  const isInvoiceType = (type: string) => ['invoice', 'sale_invoice', 'purchase_invoice', 'delivery_note', 'sale_delivery_note', 'purchase_delivery_note'].includes(type);
  const isDeliveryNote = (type: string) => ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'].includes(type);

  // Düzenleme modalı için irsaliye fonksiyonları
  const fetchEditDNs = async (firmId: string, transactionType: string) => {
    const dnType = transactionType === 'sale_invoice' ? 'sale_delivery_note' : 'purchase_delivery_note';
    const { data } = await supabase
      .from('transactions')
      .select('id, delivery_note_number, transaction_date, amount, description, firm_id, project_id, cari_id')
      .eq('transaction_type', dnType)
      .eq('firm_id', firmId)
      .order('transaction_date', { ascending: false });
    setEditSaleDNs(data || []);
  };

  const fetchEditDNItems = async (dnId: string) => {
    setEditLoadingDN(true);
    setEditExpandedDNId(editExpandedDNId === dnId ? null : dnId);
    if (editExpandedDNId === dnId) { setEditLoadingDN(false); return; }
    const { data } = await supabase.from('transaction_items').select('*').eq('transaction_id', dnId);
    setEditDNItems(data || []);
    setEditLoadingDN(false);
  };

  const toggleEditDNSelection = (dn: any) => {
    const isSelected = editSelectedDNIds.includes(dn.id);
    const newIds = isSelected ? editSelectedDNIds.filter(id => id !== dn.id) : [...editSelectedDNIds, dn.id];
    setEditSelectedDNIds(newIds);
    const selectedNotes = editSaleDNs.filter(dn => newIds.includes(dn.id));
    const dnNumbers = selectedNotes.map(d => d.delivery_note_number).filter(Boolean).join(', ');
    setEditFormData(prev => ({ ...prev, delivery_note_number: dnNumbers }));
  };

  const applyEditSelectedDNs = async () => {
    const selectedNotes = editSaleDNs.filter(dn => editSelectedDNIds.includes(dn.id));
    const allItems: any[] = [];
    for (const dn of selectedNotes) {
      const { data: items } = await supabase.from('transaction_items').select('*').eq('transaction_id', dn.id);
      if (items) allItems.push(...items);
    }
    if (allItems.length > 0) {
      setEditItems(allItems.map((item: any) => ({
        id: item.id, product_id: item.product_id || '', description: item.description || '',
        unit: item.unit || 'adet', quantity: item.quantity || 0, unit_price: item.unit_price || 0,
        vat_rate: item.vat_rate || 20, vat_amount: item.vat_amount || 0,
        discount_rate: item.discount_rate || 0, discount_amount: item.discount_amount || 0,
        amount: item.amount || 0,
      })));
    }
    setEditShowDNModal(false);
  };

  const clearEditDNSelection = () => {
    setEditSelectedDNIds([]);
    setEditFormData(prev => ({ ...prev, delivery_note_number: '' }));
  };

  // Düzenleme modalını aç
  const handleEdit = async (raw: Transaction) => {
    setEditModalOpen(true);
    setEditLoading(true);
    setEditMessage(null);

    setEditFormData({
      id: raw.id,
      transaction_date: raw.transaction_date || '',
      transaction_type: raw.transaction_type,
      firm_id: raw.firm_id || '',
      cari_id: raw.cari_id || '',
      project_id: raw.project_id || '',
      amount: raw.amount || 0,
      description: raw.description || '',
      invoice_number: raw.invoice_number || '',
      delivery_note_number: raw.delivery_note_number || '',
      is_exception: raw.is_exception || false,
      exception_reason: raw.exception_reason || '',
    });

    // Stok kalemlerini çek
    const { data: items } = await supabase.from('transaction_items').select('*').eq('transaction_id', raw.id);
    if (items && items.length > 0) {
      setEditItems(items.map((item: any) => ({
        id: item.id, product_id: item.product_id || '', description: item.description || '',
        unit: item.unit || 'adet', quantity: item.quantity || 0, unit_price: item.unit_price || 0,
        vat_rate: item.vat_rate || 20, vat_amount: item.vat_amount || 0,
        discount_rate: item.discount_rate || 0, discount_amount: item.discount_amount || 0,
        amount: item.amount || 0,
      })));
    } else {
      setEditItems([]);
    }

    // Satış/Alış faturası ise irsaliyeleri çek
    const txType = raw.transaction_type as string;
    if ((txType === 'sale_invoice' || txType === 'purchase_invoice') && raw.firm_id) {
      fetchEditDNs(raw.firm_id, txType);
    } else {
      setEditSaleDNs([]);
    }

    setEditLoading(false);
  };

  // Düzenlemeyi kaydet
  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditMessage(null);

    try {
      // Toplam tutarı hesapla (eğer kalem varsa ondan, yoksa formdan)
      const totalAmount = editItems.length > 0
        ? editItems.reduce((sum, item) => sum + (item.amount || 0), 0)
        : editFormData.amount;

      const { error } = await supabase
        .from('transactions')
        .update({
          transaction_date: editFormData.transaction_date,
          firm_id: editFormData.firm_id || null,
          cari_id: editFormData.cari_id || null,
          project_id: editFormData.project_id || null,
          amount: totalAmount,
          description: editFormData.description,
          invoice_number: editFormData.invoice_number || null,
          delivery_note_number: editFormData.delivery_note_number || null,
          is_exception: editFormData.is_exception,
          exception_reason: editFormData.is_exception ? editFormData.exception_reason : null,
        })
        .eq('id', editFormData.id);

      if (error) throw error;

      // Stok kalemlerini güncelle
      if (isInvoiceType(editFormData.transaction_type)) {
        // Eski kalemleri sil
        await supabase.from('transaction_items').delete().eq('transaction_id', editFormData.id);

        // Yeni kalemleri ekle
        if (editItems.length > 0) {
          const itemsToInsert = editItems.map((item, idx) => ({
            transaction_id: editFormData.id,
            product_id: item.product_id || null,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
            vat_amount: item.vat_amount,
            discount_rate: item.discount_rate,
            discount_amount: item.discount_amount,
            amount: item.amount,
            sort_order: idx,
          }));
          await supabase.from('transaction_items').insert(itemsToInsert);
        }
      }

      setEditMessage({ type: 'success', text: 'İşlem başarıyla güncellendi!' });
      setTimeout(() => {
        setEditModalOpen(false);
        setEditMessage(null);
        fetchData();
      }, 1000);
    } catch (err: any) {
      setEditMessage({ type: 'error', text: err.message || 'Güncelleme hatası!' });
    } finally {
      setEditSaving(false);
    }
  };

  // Stok kalemi ekle
  const addEditItem = () => {
    setEditItems([...editItems, {
      product_id: '', description: '', unit: 'adet', quantity: 0, unit_price: 0,
      vat_rate: 20, vat_amount: 0, discount_rate: 0, discount_amount: 0, amount: 0,
    }]);
  };

  // Stok kalemi sil
  const removeEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  // Stok kalemi güncelle
  const updateEditItem = (index: number, field: keyof EditItem, value: any) => {
    const updated = [...editItems];
    (updated[index] as any)[field] = value;

    // Tutar hesaplama
    if (['quantity', 'unit_price', 'discount_rate', 'vat_rate'].includes(field)) {
      const item = updated[index];
      const net = (item.quantity || 0) * (item.unit_price || 0);
      const discount = net * ((item.discount_rate || 0) / 100);
      const afterDiscount = net - discount;
      const vat = afterDiscount * ((item.vat_rate || 0) / 100);
      item.discount_amount = discount;
      item.vat_amount = vat;
      item.amount = afterDiscount + vat;
    }

    setEditItems(updated);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu işlemi silmek istediğinizden emin misiniz?')) {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    }
  };

  const stats = Object.entries(groupedTransactions).map(([type, items]) => ({
    type, label: getTypeLabel(type), count: items.length,
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
          <button onClick={expandAll} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Tümünü Aç</button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Tümünü Kapat</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {stats.map(stat => (
          <button key={stat.type} onClick={() => setFilterType(filterType === stat.type ? 'all' : stat.type)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${filterType === stat.type ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${getTypeColor(stat.type)}`}>{stat.label}</span>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(stat.total)}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="İşlem ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg">
          <option value="all">Tüm Türler</option>
          {transactionTypes.map(type => (
            <option key={type.value} value={type.value}>{type.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {Object.entries(filteredGrouped).map(([type, items]) => {
          const isExpanded = expandedTypes.includes(type);
          const typeTotal = items.reduce((sum, t) => sum + (t.amount || 0), 0);
          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => toggleType(type)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(type)}`}>{getTypeLabel(type)}</span>
                  <span className="text-sm text-slate-500">{items.length} işlem</span>
                </div>
                <p className="font-bold text-slate-800">{formatCurrency(typeTotal)}</p>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <ResizableTh columnId="islem-tarih" className="text-left py-2 px-4">Tarih</ResizableTh>
                        <ResizableTh columnId="islem-cari" className="text-left py-2 px-4">Cari</ResizableTh>
                        <ResizableTh columnId="islem-firma" className="text-left py-2 px-4">Firma</ResizableTh>
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
                              {isInvoiceType(t.type) && (
                                <button onClick={() => {
                                  if (isDeliveryNote(t.type)) {
                                    generateDeliveryNotePDF(t._raw, t.firm || '', carilerMap.get(t._raw.cari_id) || null);
                                  } else {
                                    generateInvoicePDF(t._raw, t.firm || '', carilerMap.get(t._raw.cari_id) || null);
                                  }
                                }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="PDF İndir">
                                  <FileText size={14} />
                                </button>
                              )}
                              {/* Yalnızca transactions tablosundaki kayıtları düzenleyebiliriz */}
                              {t._raw?.transaction_type && (
                                <button onClick={() => handleEdit(t._raw)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle">
                                  <Edit2 size={14} />
                                </button>
                              )}
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

      {/* ===== DÜZENLEME MODALI ===== */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-slate-800">İşlemi Düzenle</h2>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            {editLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Mesaj */}
                {editMessage && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 ${editMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {editMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {editMessage.text}
                  </div>
                )}

                {/* İlk satır: Tarih + Tür */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tarih <span className="text-red-500">*</span></label>
                    <DateInput value={editFormData.transaction_date}
                      onChange={(val) => setEditFormData({ ...editFormData, transaction_date: val })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">İşlem Türü</label>
                    <input type="text" value={getTypeLabel(editFormData.transaction_type)} disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
                  </div>
                </div>

                {/* İkinci satır: Firma + Cari */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Firma <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                      value={editFormData.firm_id}
                      onChange={(id) => setEditFormData({ ...editFormData, firm_id: id })}
                      placeholder="Firma ara..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cari <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                      value={editFormData.cari_id}
                      onChange={(id) => setEditFormData({ ...editFormData, cari_id: id })}
                      placeholder="Cari ara..." />
                  </div>
                </div>

                {/* Üçüncü satır: Proje */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proje <span className="text-red-500">*</span></label>
                  <select value={editFormData.project_id}
                    onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">Proje Seçiniz...</option>
                    {projects.filter(p => !editFormData.firm_id || p.firm_id === editFormData.firm_id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Dördüncü satır: Fatura No + İrsaliye No */}
                {isInvoiceType(editFormData.transaction_type) && (
                  <div className="grid grid-cols-2 gap-4">
                    {!isDeliveryNote(editFormData.transaction_type) && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fatura No</label>
                        <input type="text" value={editFormData.invoice_number}
                          onChange={(e) => setEditFormData({ ...editFormData, invoice_number: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">İrsaliye No</label>
                      {(editFormData.transaction_type === 'sale_invoice' || editFormData.transaction_type === 'purchase_invoice') ? (
                        <div className="flex gap-2">
                          <input type="text" value={editFormData.delivery_note_number} readOnly
                            placeholder={editSelectedDNIds.length > 0 ? `${editSelectedDNIds.length} irsaliye seçildi` : "İrsaliye seçin..."}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 cursor-default" />
                          <button type="button" onClick={() => setEditShowDNModal(true)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                            {editSelectedDNIds.length > 0 ? `${editSelectedDNIds.length} Seçili` : 'İrsaliye Seç'}
                          </button>
                        </div>
                      ) : (
                        <input type="text" value={editFormData.delivery_note_number}
                          onChange={(e) => setEditFormData({ ...editFormData, delivery_note_number: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      )}
                    </div>
                  </div>
                )}

                {/* Tutar (kalem yoksa) */}
                {editItems.length === 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label>
                    <input type="number" value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                )}

                {/* Açıklama */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <textarea value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>

                {/* Stok Kalemleri (fatura/irsaliye ise) */}
                {isInvoiceType(editFormData.transaction_type) && (
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">Stok Kalemleri</h3>
                      <button onClick={addEditItem} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                        <Plus size={12} /> Ekle
                      </button>
                    </div>
                    {editItems.length > 0 && (
                      <div className="space-y-2">
                        {editItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                            <input type="text" value={item.description} placeholder="Açıklama"
                              onChange={(e) => updateEditItem(idx, 'description', e.target.value)}
                              className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs" />
                            <input type="text" value={item.unit} placeholder="Birim"
                              onChange={(e) => updateEditItem(idx, 'unit', e.target.value)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded text-xs" />
                            <input type="number" value={item.quantity} placeholder="Miktar"
                              onChange={(e) => updateEditItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-xs" />
                            <input type="number" value={item.unit_price} placeholder="Birim Fiyat"
                              onChange={(e) => updateEditItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-xs" />
                            <input type="number" value={item.vat_rate} placeholder="KDV %"
                              onChange={(e) => updateEditItem(idx, 'vat_rate', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded text-xs" />
                            <span className="text-xs font-medium text-slate-600 w-24 text-right">{formatCurrency(item.amount)}</span>
                            <button onClick={() => removeEditItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        <div className="text-right text-sm font-bold text-slate-800 pt-2 border-t border-slate-200">
                          Toplam: {formatCurrency(editItems.reduce((sum, item) => sum + (item.amount || 0), 0))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Alt但onlar */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                İptal
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 disabled:opacity-50">
                <Save size={16} />
                {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İrsaliye Seçim Modalı (Düzenleme) */}
      {editShowDNModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setEditShowDNModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editFormData.transaction_type === 'sale_invoice' ? 'Satış İrsaliyeleri' : 'Alış İrsaliyeleri'}
              </h3>
              <button onClick={() => setEditShowDNModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {editSaleDNs.length === 0 ? (
                <p className="text-center text-slate-400 py-10">Bu firmaya ait irsaliye bulunamadı.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-2 text-left w-10"></th>
                      <th className="py-2 px-2 text-left">İrsaliye No</th>
                      <th className="py-2 px-2 text-left">Tarih</th>
                      <th className="py-2 px-2 text-left">Cari</th>
                      <th className="py-2 px-2 text-right">Tutar</th>
                      <th className="py-2 px-2 text-center">İçerik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editSaleDNs.map((dn) => {
                      const isSelected = editSelectedDNIds.includes(dn.id);
                      const isExpanded = editExpandedDNId === dn.id;
                      const cariName = cariler.find(c => c.id === dn.cari_id)?.name || '-';
                      return (
                        <Fragment key={dn.id}>
                          <tr className={`border-b border-slate-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 px-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleEditDNSelection(dn)} className="rounded text-blue-600" />
                            </td>
                            <td className="py-2 px-2 font-mono font-bold text-slate-800">{dn.delivery_note_number || 'Numarasız'}</td>
                            <td className="py-2 px-2 text-slate-600">{formatDateTR(dn.transaction_date)}</td>
                            <td className="py-2 px-2 text-slate-600">{cariName}</td>
                            <td className="py-2 px-2 text-right font-medium text-blue-700">{formatCurrency(dn.amount)}</td>
                            <td className="py-2 px-2 text-center">
                              <button onClick={() => fetchEditDNItems(dn.id)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
                                {isExpanded ? 'Kapat' : 'Görüntüle'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50 p-3">
                                {editLoadingDN ? (
                                  <p className="text-center text-slate-400 py-3">Yükleniyor...</p>
                                ) : editDNItems.length === 0 ? (
                                  <p className="text-center text-slate-400 py-3">Kalem bulunamadı</p>
                                ) : (
                                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                                    <thead>
                                      <tr className="bg-slate-100">
                                        <th className="py-1.5 px-2 text-left">Açıklama</th>
                                        <th className="py-1.5 px-2 text-right">Miktar</th>
                                        <th className="py-1.5 px-2 text-left">Birim</th>
                                        <th className="py-1.5 px-2 text-right">Birim Fiyat</th>
                                        <th className="py-1.5 px-2 text-right">KDV</th>
                                        <th className="py-1.5 px-2 text-right">Tutar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {editDNItems.map((item, idx) => (
                                        <tr key={idx} className="border-t border-slate-200">
                                          <td className="py-1.5 px-2 font-medium">{item.description}</td>
                                          <td className="py-1.5 px-2 text-right">{item.quantity}</td>
                                          <td className="py-1.5 px-2">{item.unit}</td>
                                          <td className="py-1.5 px-2 text-right">{formatCurrency(item.unit_price)}</td>
                                          <td className="py-1.5 px-2 text-right">%{item.vat_rate || 0}</td>
                                          <td className="py-1.5 px-2 text-right font-bold">{formatCurrency(item.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-slate-100 font-bold">
                                        <td colSpan={5} className="py-1.5 px-2 text-right">Toplam:</td>
                                        <td className="py-1.5 px-2 text-right">{formatCurrency(editDNItems.reduce((s, i) => s + (i.amount || 0), 0))}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <div className="flex gap-2">
                {editSelectedDNIds.length > 0 && (
                  <button onClick={clearEditDNSelection} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    Seçimi Temizle
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditShowDNModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm">
                  Kapat
                </button>
                <button onClick={applyEditSelectedDNs} disabled={editSelectedDNIds.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {editSelectedDNIds.length > 0 ? `${editSelectedDNIds.length} İrsaliyeyi Faturaya Aktar` : 'İrsaliye Seçin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
