import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { importFromExcel } from '../lib/excel';
import { generateNextCode, findSimilar, formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Firm, Project } from '../types';
import { Plus, Edit2, Trash2, Search, Users, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, Filter } from 'lucide-react';

interface CariWithBalance extends Firm {
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
  const { selectedFirm } = useFirm();
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

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchCariler(); }, [selectedFirm, filterFirmId, filterProjectId]);

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
      supabase.from('firms').select('*').eq('is_active', true).in('type', ['customer', 'supplier']).order('code'),
      supabase.from('projects').select('*').order('name'),
    ]);
    if (firmsRes.data) setAllFirms(firmsRes.data);
    if (projectsRes.data) setAllProjects(projectsRes.data);
  };

  const fetchCariler = async () => {
    setLoading(true);
    const { data: firms } = await supabase.from('firms').select('*').eq('is_active', true).in('type', ['customer', 'supplier']).order('code');
    if (!firms) { setLoading(false); return; }

    const cariIds = firms.map(f => f.id);
    
    // İşlemleri çek - filtre uygula
    let txQuery = supabase.from('transactions').select('firm_id, amount, type, invoice_number, project_id').in('firm_id', cariIds);
    if (filterFirmId) txQuery = txQuery.eq('firm_id', filterFirmId);
    if (filterProjectId) txQuery = txQuery.eq('project_id', filterProjectId);
    const { data: transactions } = await txQuery;

    // Çekleri çek - filtre uygula
    let checkQuery = supabase.from('checks').select('firm_id, amount, check_type').in('firm_id', cariIds);
    if (filterFirmId) checkQuery = checkQuery.eq('firm_id', filterFirmId);
    const { data: checks } = await checkQuery;

    // Her cari için verileri hesapla
    const withBalance: CariWithBalance[] = firms.map(f => {
      const firmTransactions = transactions?.filter(t => t.firm_id === f.id) || [];
      const firmChecks = checks?.filter(c => c.firm_id === f.id) || [];

      const totalIncome = firmTransactions
        .filter(t => t.type === 'income' || t.type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = firmTransactions
        .filter(t => t.type !== 'income' && t.type !== 'invoice')
        .reduce((sum, t) => sum + t.amount, 0);

      const issuedInvoices = firmTransactions
        .filter(t => t.type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0);

      const pendingInvoices = firmTransactions
        .filter(t => t.type === 'expense' && !t.invoice_number)
        .reduce((sum, t) => sum + t.amount, 0);

      const debt = firmTransactions
        .filter(t => t.type === 'expense' || t.type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0);

      const credit = firmTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const receivedChecks = firmChecks
        .filter(c => c.check_type === 'received')
        .reduce((sum, c) => sum + c.amount, 0);

      const issuedChecks = firmChecks
        .filter(c => c.check_type === 'given')
        .reduce((sum, c) => sum + c.amount, 0);

      const balance = totalIncome - totalExpense;

      return {
        ...f,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCari) {
      await supabase.from('firms').update({ name: formData.name, tax_number: formData.tax_number, address: formData.address, phone: formData.phone, email: formData.email, type: formData.type }).eq('id', editingCari.id);
      setMessage({ type: 'success', text: 'Cari başarıyla güncellendi!' });
    } else {
      const codes = cariler.map(c => c.code || '').filter(Boolean);
      const newCode = generateNextCode(codes, formData.name);

      const { error } = await supabase.from('firms').insert({
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
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu cariyi silmek istediğinizden emin misiniz?')) {
      await supabase.from('firms').update({ is_active: false }).eq('id', id);
      fetchCariler();
    }
  };

  const filtered = cariler.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        const { error } = await supabase.from('firms').insert({
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

  const filteredProjects = allProjects.filter(p => !filterFirmId || p.firm_id === filterFirmId);

  const totalDebt = filtered.reduce((s, c) => s + (c.debt || 0), 0);
  const totalCredit = filtered.reduce((s, c) => s + (c.credit || 0), 0);
  const totalBalance = filtered.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cari Yönetimi</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowExcelImport(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <FileSpreadsheet size={16} />Excel'den İçe Aktar
          </button>
          <button onClick={() => { setEditingCari(null); setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Cari</button>
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
          {(filterFirmId || filterProjectId) && (
            <button onClick={() => { setFilterFirmId(''); setFilterProjectId(''); }} className="text-xs text-blue-600 hover:text-blue-800 ml-2">Filtreleri Temizle</button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cari Ara</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Kod, isim veya vergi no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Firma / Cari Filtresi</label>
            <select value={filterFirmId} onChange={(e) => { setFilterFirmId(e.target.value); setFilterProjectId(''); }} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Tüm Firmalar</option>
              {allFirms.filter(f => f.type === 'both').map(f => <option key={f.id} value={f.id}>{f.code ? `${f.code} - ` : ''}{f.name}</option>)}
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

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-700">Toplam Borç</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-700">Toplam Alacak</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-700">Net Bakiye</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-2">Kod</th>
                <th className="text-left py-3 px-2">Cari Adı</th>
                <th className="text-left py-3 px-2">Vergi No</th>
                <th className="text-right py-3 px-2">Borç</th>
                <th className="text-right py-3 px-2">Alacak</th>
                <th className="text-right py-3 px-2">Bakiye</th>
                <th className="text-right py-3 px-2">Kestiği Fatura</th>
                <th className="text-right py-3 px-2">Kesmesi Gereken Fatura</th>
                <th className="text-right py-3 px-2">Alınan Çek</th>
                <th className="text-right py-3 px-2">Verilen Çek</th>
                <th className="text-center py-3 px-2">İşlem</th>
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

              <div><label className="block text-sm font-medium text-slate-700 mb-1">Cari Adı</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Vergi No</label><input type="text" value={formData.tax_number} onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tür</label><select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'customer' | 'supplier' | 'both' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="customer">Alıcı</option><option value="supplier">Satıcı</option><option value="both">Alıcı/Satıcı</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Adres</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => { setShowForm(false); setEditingCari(null); setSimilarWarning([]); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
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
