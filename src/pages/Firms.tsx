import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { importFromExcel } from '../lib/excel';
import { findSimilar, formatCurrency } from '../lib/utils';
import type { Firm } from '../types';
import { Plus, Edit2, Trash2, Search, Building2, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface FirmWithBalance extends Firm {
  balance?: number;
}

export default function Firms() {
  const [firms, setFirms] = useState<FirmWithBalance[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFirm, setEditingFirm] = useState<FirmWithBalance | null>(null);
  const [formData, setFormData] = useState({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' as 'customer' | 'supplier' | 'both' });
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [similarWarning, setSimilarWarning] = useState<FirmWithBalance[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchFirms(); }, []);

  useEffect(() => {
    if (formData.name && !editingFirm) {
      const similar = findSimilar(firms, formData.name);
      setSimilarWarning(similar);
    } else {
      setSimilarWarning([]);
    }
  }, [formData.name, firms, editingFirm]);

  const fetchFirms = async () => {
    const { data } = await supabase.from('firms').select('*').eq('is_active', true).order('code');
    if (!data) { setLoading(false); return; }

    const firmIds = data.map(f => f.id);
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('firm_id, amount, type')
      .in('firm_id', firmIds);

    const balanceMap: Record<string, number> = {};
    for (const t of transactions || []) {
      if (!balanceMap[t.firm_id]) balanceMap[t.firm_id] = 0;
      if (t.type === 'income' || t.type === 'invoice') {
        balanceMap[t.firm_id] += t.amount;
      } else {
        balanceMap[t.firm_id] -= t.amount;
      }
    }

    const withBalance: FirmWithBalance[] = data.map(f => ({
      ...f,
      balance: balanceMap[f.id] || 0,
    }));

    setFirms(withBalance);
    setLoading(false);
  };

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
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (firm: FirmWithBalance) => {
    setEditingFirm(firm);
    setFormData({ name: firm.name, tax_number: firm.tax_number || '', address: firm.address || '', phone: firm.phone || '', email: firm.email || '', type: firm.type });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu firmayı silmek istediğinizden emin misiniz?')) {
      await supabase.from('firms').update({ is_active: false }).eq('id', id);
      fetchFirms();
    }
  };

  const filtered = firms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.tax_number?.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalAlacak = firms.reduce((sum, f) => sum + (f.balance && f.balance > 0 ? f.balance : 0), 0);
  const totalBorç = firms.reduce((sum, f) => sum + (f.balance && f.balance < 0 ? Math.abs(f.balance) : 0), 0);

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
        const typeStr = String(row['Tür'] || row['tur'] || row['Type'] || row['type'] || 'both');
        
        let type: 'customer' | 'supplier' | 'both' = 'both';
        if (typeStr.toLowerCase() === 'müşteri' || typeStr.toLowerCase() === 'customer') type = 'customer';
        else if (typeStr.toLowerCase() === 'tedarikçi' || typeStr.toLowerCase() === 'supplier') type = 'supplier';

        if (!name) continue;

        const exists = firms.some(f => f.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;

        const { error } = await supabase.from('firms').insert({
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

      alert(`${importedCount} firma başarıyla içe aktarıldı!`);
      setShowExcelImport(false);
      fetchFirms();
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
        <h1 className="text-2xl font-bold text-slate-800">Firma Yönetimi</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowExcelImport(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <FileSpreadsheet size={16} />Excel'den İçe Aktar
          </button>
          <button onClick={() => { setEditingFirm(null); setFormData({ name: '', tax_number: '', address: '', phone: '', email: '', type: 'both' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Firma</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Toplam Firma</p>
              <p className="text-2xl font-bold text-slate-800">{firms.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg"><Users size={24} className="text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Toplam Alacak</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAlacak)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg"><ArrowUpRight size={24} className="text-green-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Toplam Borç</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalBorç)}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg"><ArrowDownRight size={24} className="text-red-600" /></div>
          </div>
        </div>
      </div>

      <div className="mb-4 relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Firma ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-96 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Firma Adı</th><th className="text-left py-3 px-4">Vergi No</th><th className="text-right py-3 px-4">Bakiye</th><th className="text-left py-3 px-4">Telefon</th><th className="text-center py-3 px-4">İşlem</th></tr></thead>
            <tbody>
              {filtered.map(firm => (
                <tr key={firm.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg"><Building2 size={16} className="text-slate-600" /></div><span className="font-medium">{firm.name}</span></div></td>
                  <td className="py-3 px-4 text-slate-600">{firm.tax_number || '-'}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-mono font-bold ${(firm.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(firm.balance || 0)}</span></td>
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
                  <li>- <strong>Tür</strong> (Müşteri/Tedarikçi/Her İkisi)</li>
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
                  <strong>Not:</strong> Aynı isimde firma varsa atlanır.
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
