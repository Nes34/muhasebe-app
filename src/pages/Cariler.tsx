import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { importFromExcel, exportCarilerToCSV } from '../lib/excel';
import { generateNextCode, findSimilar, formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Cari, Firm, Project } from '../types';
import { Plus, Edit2, Trash2, Users, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface CariWithBalance extends Cari {
  balance?: number;
  totalIncome?: number;
  totalExpense?: number;
  debt?: number;
  credit?: number;
  issuedInvoices?: number;
  pendingInvoices?: number;
  receivedChecks?: number;
  issuedChecks?: number;
}

export default function Cariler() {
  const { selectedFirm, selectedProject } = useFirm();
  const [cariler, setCariler] = useState<CariWithBalance[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFirmId, setFilterFirmId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [allFirms, setAllFirms] = useState<Firm[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCari, setEditingCari] = useState<CariWithBalance | null>(null);
  const [formData, setFormData] = useState({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' as 'customer' | 'supplier' | 'both' });
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [similarWarning, setSimilarWarning] = useState<CariWithBalance[]>([]);
  const [autoCode, setAutoCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchCariler(); }, [selectedFirm, selectedProject, filterFirmId, filterProjectId]);

  useEffect(() => {
    if (formData.name && !editingCari) {
      const codes = cariler.map(c => c.code || '').filter(Boolean);
      setAutoCode(generateNextCode(codes, formData.name));
      const similar = findSimilar(cariler, formData.name);
      setSimilarWarning(similar);
    } else {
      setAutoCode('');
      setSimilarWarning([]);
    }
  }, [formData.name, cariler, editingCari]);

  const fetchMeta = async () => {
    const [firmsRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code'),
      supabase.from('projects').select('*').order('name'),
    ]);
    if (firmsRes.data) setAllFirms(firmsRes.data);
    if (projectsRes.data) setAllProjects(projectsRes.data);
  };

  const fetchCariler = async () => {
    setLoading(true);
    const { data: cariData } = await supabase.from('cariler').select('*').eq('is_active', true).order('code');
    if (!cariData) { setLoading(false); return; }

    const cariIds = cariData.map(c => c.id);

    // İşlemleri çek - cari_id üzerinden
    let txQuery = supabase.from('transactions').select('cari_id, amount, transaction_type, invoice_number, project_id').in('cari_id', cariIds);
    if (filterFirmId) txQuery = txQuery.eq('firm_id', filterFirmId);
    else if (selectedFirm) txQuery = txQuery.eq('firm_id', selectedFirm.id);
    if (filterProjectId) txQuery = txQuery.eq('project_id', filterProjectId);
    const { data: transactions } = await txQuery;

    // Çekleri çek
    let checkQuery = supabase.from('checks').select('cari_id, amount, check_type, status').in('cari_id', cariIds);
    if (filterFirmId) checkQuery = checkQuery.eq('firm_id', filterFirmId);
    else if (selectedFirm) checkQuery = checkQuery.eq('firm_id', selectedFirm.id);
    const { data: checks } = await checkQuery;

    // Kasa hareketlerini çek (transaction_id olanlar transactions tablosunda zaten sayıldı)
    let cashQuery = supabase.from('cash_transactions').select('cari_id, amount, transaction_type, transaction_id').in('cari_id', cariIds);
    if (filterFirmId) cashQuery = cashQuery.eq('firm_id', filterFirmId);
    else if (selectedFirm) cashQuery = cashQuery.eq('firm_id', selectedFirm.id);
    const { data: cashTx } = await cashQuery;

    // Banka hareketlerini çek (transaction_id olanlar transactions tablosunda zaten sayıldı)
    let bankQuery = supabase.from('bank_transactions').select('cari_id, amount, transaction_type, transaction_id').in('cari_id', cariIds);
    if (filterFirmId) bankQuery = bankQuery.eq('firm_id', filterFirmId);
    else if (selectedFirm) bankQuery = bankQuery.eq('firm_id', selectedFirm.id);
    const { data: bankTx } = await bankQuery;

    // Her cari için verileri hesapla
    const withBalance: CariWithBalance[] = cariData.map(c => {
      const cariTransactions = transactions?.filter(t => t.cari_id === c.id) || [];
      const cariChecks = checks?.filter(ch => ch.cari_id === c.id) || [];
      // transaction_id olmayan kasa/banka hareketleri (bağımsız hareketler)
      const cariCashTx = cashTx?.filter(t => t.cari_id === c.id && !t.transaction_id) || [];
      const cariBankTx = bankTx?.filter(t => t.cari_id === c.id && !t.transaction_id) || [];

      // Hariç tutulacak tipler (para hareketi değil)
      const excludedTypes = ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note', 'transfer', 'stock_transfer', 'cash_transfer', 'bank_transfer'];

      const totalIncome = cariTransactions
        .filter(t => ['income', 'invoice', 'sale_invoice'].includes(t.transaction_type))
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = cariTransactions
        .filter(t => !['income', 'invoice', 'sale_invoice'].includes(t.transaction_type) && !excludedTypes.includes(t.transaction_type))
        .reduce((sum, t) => sum + t.amount, 0);

      const issuedInvoices = cariTransactions
        .filter(t => t.transaction_type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0);

      const pendingInvoices = cariTransactions
        .filter(t => t.transaction_type === 'expense' && !t.invoice_number)
        .reduce((sum, t) => sum + t.amount, 0);

      const receivedChecks = cariChecks
        .filter(ch => ch.check_type === 'received' && ch.status !== 'cancelled')
        .reduce((sum, ch) => sum + ch.amount, 0);

      const issuedChecks = cariChecks
        .filter(ch => ch.check_type === 'given' && ch.status !== 'cancelled')
        .reduce((sum, ch) => sum + ch.amount, 0);

      // Kasa hareketleri: giren para = alacak, çıkan para = borç
      const cashIn = cariCashTx.filter(t => t.transaction_type === 'in').reduce((sum, t) => sum + t.amount, 0);
      const cashOut = cariCashTx.filter(t => t.transaction_type === 'out').reduce((sum, t) => sum + t.amount, 0);

      // Banka hareketleri: giren para = alacak, çıkan para = borç
      const bankIn = cariBankTx.filter(t => t.transaction_type === 'in').reduce((sum, t) => sum + t.amount, 0);
      const bankOut = cariBankTx.filter(t => t.transaction_type === 'out').reduce((sum, t) => sum + t.amount, 0);

      // Borç = gider + verilen çekler + kasa çıkışı + banka çıkışı
      const debt = totalExpense + issuedChecks + cashOut + bankOut;
      // Alacak = gelir + alınan çekler + kasa girişi + banka girişi
      const credit = totalIncome + receivedChecks + cashIn + bankIn;
      // Bakiye = alacak - borç
      const balance = credit - debt;

      return {
        ...c,
        balance,
        totalIncome,
        totalExpense,
        debt,
        credit,
        issuedInvoices,
        pendingInvoices,
        receivedChecks,
        issuedChecks,
      };
    });

    setCariler(withBalance);
    setLoading(false);
  };

  // Form validasyonu
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Cari Adı - zorunlu, min 2 karakter
    if (!formData.name.trim()) {
      errors.name = 'Cari adı zorunludur';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Cari adı en az 2 karakter olmalıdır';
    }

    // Vergi No - verildiyse 10 veya 11 haneli rakamlardan oluşmalı
    if (formData.tax_number.trim()) {
      const taxClean = formData.tax_number.replace(/\s/g, '');
      if (!/^\d+$/.test(taxClean)) {
        errors.tax_number = 'Vergi numarası sadece rakamlardan oluşmalıdır';
      } else if (taxClean.length !== 10 && taxClean.length !== 11) {
        errors.tax_number = 'Vergi numarası 10 veya 11 haneli olmalıdır';
      }
    }

    // Telefon - verildiyse rakamlardan ve boşluklardan oluşmalı
    if (formData.phone.trim()) {
      const phoneClean = formData.phone.replace(/[\s()-]/g, '');
      if (!/^\d+$/.test(phoneClean)) {
        errors.phone = 'Telefon numarası sadece rakamlardan oluşmalıdır';
      } else if (phoneClean.length < 7) {
        errors.phone = 'Telefon numarası en az 7 haneli olmalıdır';
      }
    }

    // E-posta - verildiyse geçerli formatta olmalı
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Geçerli bir e-posta adresi giriniz';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (editingCari) {
      await supabase.from('cariler').update({ name: formData.name.trim(), tax_number: formData.tax_number.trim() || null, address: formData.address.trim() || null, phone: formData.phone.trim() || null, email: formData.email.trim() || null, type: formData.type }).eq('id', editingCari.id);
      setMessage({ type: 'success', text: 'Cari başarıyla güncellendi!' });
    } else {
      const codes = cariler.map(c => c.code || '').filter(Boolean);
      const newCode = generateNextCode(codes, formData.name);

      const { error } = await supabase.from('cariler').insert({
        code: newCode,
        name: formData.name,
        tax_number: formData.tax_number,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        type: formData.type,
        is_active: true,
      });

      if (!error) {
        setMessage({ type: 'success', text: `"${formData.name}" carisi "${newCode}" koduyla eklendi!` });
      }
    }
    setShowForm(false); setEditingCari(null);
    setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' });
    setSimilarWarning([]);
    fetchCariler();
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (cari: CariWithBalance) => {
    setEditingCari(cari);
    setFormData({ name: cari.name, tax_number: cari.tax_number || '', address: cari.address || '', phone: cari.phone || '', email: cari.email || '', type: cari.type });
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu cariyi silmek istediğinizden emin misiniz?')) {
      await supabase.from('cariler').update({ is_active: false }).eq('id', id);
      fetchCariler();
    }
  };

  const filtered = searchTerm
    ? cariler.filter(c => c.id === searchTerm)
    : cariler;

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
      const codes = cariler.map(c => c.code || '').filter(Boolean);
      let currentCodes = [...codes];

      for (const row of data) {
        const name = String(row['Cari Adı'] || row['cari_adi'] || row['Firma Adı'] || row['Name'] || row['name'] || '');
        const taxNumber = String(row['Vergi No'] || row['vergi_no'] || row['Tax'] || row['tax'] || '');
        const phone = String(row['Telefon'] || row['telefon'] || row['Phone'] || row['phone'] || '');
        const email = String(row['E-posta'] || row['eposta'] || row['Email'] || row['email'] || '');
        const address = String(row['Adres'] || row['adres'] || row['Address'] || row['address'] || '');
        const typeStr = String(row['Tür'] || row['tur'] || row['Type'] || row['type'] || 'both');
        
        let type: 'customer' | 'supplier' | 'both' = 'both';
        if (typeStr.toLowerCase() === 'alıcı' || typeStr.toLowerCase() === 'müşteri' || typeStr.toLowerCase() === 'customer') type = 'customer';
        else if (typeStr.toLowerCase() === 'satıcı' || typeStr.toLowerCase() === 'tedarikçi' || typeStr.toLowerCase() === 'supplier') type = 'supplier';

        if (!name) continue;

        const exists = cariler.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;

        const newCode = generateNextCode(currentCodes, name);
        currentCodes.push(newCode);

        const { error } = await supabase.from('cariler').insert({
          code: newCode,
          name: name.trim(),
          tax_number: taxNumber.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          type,
          is_active: true,
        });

        if (!error) importedCount++;
      }

      alert(`${importedCount} cari başarıyla içe aktarıldı!`);
      setShowExcelImport(false);
      fetchCariler();
    } catch (error) {
      console.error('Excel import hatası:', error);
      alert('Excel dosyası okunurken bir hata oluştu.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const filteredProjects = allProjects.filter(p => {
    const firmFilter = filterFirmId || selectedFirm?.id;
    return !firmFilter || p.firm_id === firmFilter;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cari Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <div className="flex gap-2">
          <button onClick={() => exportCarilerToCSV(cariler)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download size={16} />CSV İndir
          </button>
          <button onClick={() => setShowExcelImport(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FileSpreadsheet size={16} />Excel'den İçe Aktar
          </button>
          <button onClick={() => { setEditingCari(null); setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' }); setFormErrors({}); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"><Plus size={16} />Yeni Cari</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filtreleme</span>
          {(filterFirmId || filterProjectId || searchTerm) && (
            <button onClick={() => { setFilterFirmId(''); setFilterProjectId(''); setSearchTerm(''); }} className="text-xs text-blue-600 hover:text-blue-800 ml-2">Filtreleri Temizle</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cari Seç</label>
            <SearchableSelect
              options={cariler.map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
              }))}
              value={searchTerm}
              onChange={(id) => setSearchTerm(id)}
              placeholder="Cari seçin..."
              showCode={true}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Firma Filtresi</label>
            <select value={filterFirmId} onChange={(e) => { setFilterFirmId(e.target.value); setFilterProjectId(''); }} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Tüm Firmalar</option>
              {allFirms.map(f => <option key={f.id} value={f.id}>{f.code ? `${f.code} - ` : ''}{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Proje Filtresi</label>
            <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Tüm Projeler</option>
              {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="cari-kod" className="text-left py-3 px-2">Kod</ResizableTh>
                <ResizableTh columnId="cari-ad" className="text-left py-3 px-2">Cari Adı</ResizableTh>
                <ResizableTh columnId="cari-vergi" className="text-left py-3 px-2">Vergi No</ResizableTh>
                <ResizableTh columnId="cari-borc" className="text-right py-3 px-2">Borç</ResizableTh>
                <ResizableTh columnId="cari-alacak" className="text-right py-3 px-2">Alacak</ResizableTh>
                <ResizableTh columnId="cari-bakiye" className="text-right py-3 px-2">Bakiye</ResizableTh>
                <ResizableTh columnId="cari-kestiigi-fatura" className="text-right py-3 px-2">Kestiği Fatura</ResizableTh>
                <ResizableTh columnId="cari-kesmesi-gereken" className="text-right py-3 px-2">Kesmesi Gereken Fatura</ResizableTh>
                <ResizableTh columnId="cari-alinan-cek" className="text-right py-3 px-2">Alınan Çek</ResizableTh>
                <ResizableTh columnId="cari-verilen-cek" className="text-right py-3 px-2">Verilen Çek</ResizableTh>
                <ResizableTh columnId="cari-islem" className="text-center py-3 px-2">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cari => (
                <tr key={cari.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono text-xs font-bold">
                      {cari.code || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 rounded-lg">
                        <Users size={14} className="text-slate-600" />
                      </div>
                      <span className="font-medium">{cari.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-xs text-slate-600">{cari.tax_number || '-'}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-red-600">{formatCurrency(cari.debt || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-green-600">{formatCurrency(cari.credit || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={`font-mono font-bold ${(cari.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(cari.balance || 0)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-blue-600">{formatCurrency(cari.issuedInvoices || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-orange-600">{formatCurrency(cari.pendingInvoices || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-green-600">{formatCurrency(cari.receivedChecks || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-red-600">{formatCurrency(cari.issuedChecks || 0)}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(cari)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(cari.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center py-8 text-slate-500">Cari bulunamadı.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingCari ? 'Cari Düzenle' : 'Yeni Cari'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingCari && autoCode && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
                  <span className="text-sm text-blue-600">Otomatik Kod:</span>
                  <span className="font-mono font-bold text-blue-800 text-lg">{autoCode}</span>
                </div>
              )}

              {similarWarning.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Benzer cariler bulundu:</span>
                  </div>
                  <div className="space-y-1">
                    {similarWarning.map(c => (
                      <div key={c.id} className="text-sm text-amber-700 flex items-center gap-2">
                        <span className="font-mono text-xs bg-amber-100 px-1 rounded">{c.code}</span>
                        <span>{c.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600 mt-2">Yine de kaydetmek istiyor musunuz?</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cari Adı <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg ${formErrors.name ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} required />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vergi No</label>
                <input type="text" value={formData.tax_number} onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                  placeholder="10 veya 11 haneli"
                  className={`w-full px-4 py-2 border rounded-lg ${formErrors.tax_number ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                {formErrors.tax_number && <p className="text-xs text-red-600 mt-1">{formErrors.tax_number}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tür</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'customer' | 'supplier' | 'both' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                  <option value="customer">Alıcı</option>
                  <option value="supplier">Satıcı</option>
                  <option value="both">Alıcı/Satıcı</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0212 555 1234"
                    className={`w-full px-4 py-2 border rounded-lg ${formErrors.phone ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                  {formErrors.phone && <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ornek@mail.com"
                    className={`w-full px-4 py-2 border rounded-lg ${formErrors.email ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                  {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingCari(null); setSimilarWarning([]); setFormErrors({}); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExcelImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Excel'den Cari İçe Aktar</h3>
              <button onClick={() => setShowExcelImport(false)} className="p-2 hover:bg-slate-100 rounded-lg"><span className="text-xl">×</span></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Beklenen Sütunlar:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- <strong>Cari Adı</strong> (zorunlu) → Kod otomatik üretilir</li>
                  <li>- <strong>Vergi No</strong> (opsiyonel)</li>
                  <li>- <strong>Telefon</strong> (opsiyonel)</li>
                  <li>- <strong>E-posta</strong> (opsiyonel)</li>
                  <li>- <strong>Adres</strong> (opsiyonel)</li>
                  <li>- <strong>Tür</strong> (Alıcı/Satıcı/Her İkisi)</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  const csvContent = `Kod,Cari Adı,Vergi No,Telefon,E-posta,Adres,Tür
A.0001,ABC İnşaat,1234567890,0212 555 1234,info@abc.com,İstanbul,Alıcı
B.0001,XYZ Ticaret,9876543210,0216 444 5678,info@xyz.com,İstanbul,Satıcı
C.0001,DEF A.Ş.,5554443333,0312 333 1111,info@def.com,Ankara,Her İkisi`;
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'cari-ornek.csv';
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
                  ref={(input) => { if (input) input.setAttribute('id', 'cari-file-input'); }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelImport}
                  className="hidden"
                  disabled={importing}
                />
                <button type="button" onClick={() => document.getElementById('cari-file-input')?.click()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" disabled={importing}>
                  {importing ? 'İçe Aktarılıyor...' : 'Dosya Seç'}
                </button>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                  <strong>Not:</strong> Kodlar otomatik üretilir. Aynı isimde cari varsa atlanır.
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
