import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Personnel } from '../types';
import { Plus, Edit2, Trash2, Search, Users, Upload, Download, AlertTriangle, CheckCircle, X, Shield, FileSpreadsheet } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function PersonnelManagement() {
  const { selectedFirm } = useFirm();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importMode, setImportMode] = useState<'add' | 'update'>('add');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitingPersonnel, setExitingPersonnel] = useState<Personnel | null>(null);
  const [exitDate, setExitDate] = useState('');
  const [showTransferWarning, setShowTransferWarning] = useState(false);
  const [transferWarnings, setTransferWarnings] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    tc_number: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    taseron: '',
    start_date: new Date().toISOString().split('T')[0],
    gross_salary: 0,
    net_salary: 0,
    bank_name: '',
    bank_iban: '',
    sgk_number: '',
    is_protected: false,
    firm_id: '',
  });

  useEffect(() => { fetchData(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    let personnelQuery = supabase.from('personnel').select('*').order('first_name');
    if (selectedFirm) personnelQuery = personnelQuery.eq('firm_id', selectedFirm.id);

    const { data: personnelData } = await personnelQuery;
    if (personnelData) setPersonnel(personnelData);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tc_number || !formData.first_name || !formData.last_name || !formData.taseron) {
      setMessage({ type: 'error', text: 'TC No, Ad, Soyad ve Taşeron zorunludur!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      if (editingPersonnel) {
        const { error } = await supabase.from('personnel').update({
          ...formData,
          firm_id: selectedFirm?.id || formData.firm_id || null,
        }).eq('id', editingPersonnel.id);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Personel güncellendi!' });
      } else {
        const { error } = await supabase.from('personnel').insert({
          ...formData,
          firm_id: selectedFirm?.id || formData.firm_id || null,
          status: 'active',
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Personel eklendi!' });
      }
      setShowForm(false);
      setEditingPersonnel(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Hata oluştu!' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (p: Personnel) => {
    setEditingPersonnel(p);
    setFormData({
      tc_number: p.tc_number,
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      position: p.position || '',
      taseron: p.taseron,
      start_date: p.start_date,
      gross_salary: p.gross_salary || 0,
      net_salary: p.net_salary || 0,
      bank_name: p.bank_name || '',
      bank_iban: p.bank_iban || '',
      sgk_number: p.sgk_number || '',
      is_protected: p.is_protected,
      firm_id: p.firm_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const p = personnel.find(p => p.id === id);
    if (p?.is_protected) {
      setMessage({ type: 'error', text: 'Bu personel korumalı, işten çıkarılamaz!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (!confirm('Bu personeli silmek istediğinize emin misiniz?')) return;
    await supabase.from('personnel').delete().eq('id', id);
    fetchData();
  };

  const handleExit = (p: Personnel) => {
    if (p.is_protected) {
      setMessage({ type: 'error', text: 'Bu personel korumalı, işten çıkarılamaz!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setExitingPersonnel(p);
    setExitDate(new Date().toISOString().split('T')[0]);
    setShowExitModal(true);
  };

  const confirmExit = async () => {
    if (!exitingPersonnel || !exitDate) return;
    await supabase.from('personnel').update({
      end_date: exitDate,
      status: 'resigned',
    }).eq('id', exitingPersonnel.id);
    setShowExitModal(false);
    setExitingPersonnel(null);
    setMessage({ type: 'success', text: 'Personel çıkışı yapıldı!' });
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      tc_number: '',
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      address: '',
      position: '',
      taseron: '',
      start_date: new Date().toISOString().split('T')[0],
      gross_salary: 0,
      net_salary: 0,
      bank_name: '',
      bank_iban: '',
      sgk_number: '',
      is_protected: false,
      firm_id: '',
    });
  };

  const downloadExampleCSV = () => {
    const csvContent = `TC No,Ad,Soyad,Taşeron,Pozisyon,Brüt Maaş,Net Maaş
12345678901,Ali,Yılmaz,ABC İnşaat,Mühendis,35000,25000
98765432102,Mehmet,Demir,XYZ Taahhüt,İşçi,20000,15000
11122233344,Ayşe,Kaya,ABC İnşaat,Muhasebeci,30000,22000`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'personel-ornek.csv';
    link.click();
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('Dosyada veri bulunamadı.'); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const tcIdx = headers.findIndex(h => h.includes('tc') || h.includes('tcno'));
      const nameIdx = headers.findIndex(h => h.includes('ad') && !h.includes('soyad'));
      const surnameIdx = headers.findIndex(h => h.includes('soyad'));
      const taseronIdx = headers.findIndex(h => h.includes('taşeron') || h.includes('taseron'));
      const posIdx = headers.findIndex(h => h.includes('pozisyon') || h.includes('görev'));
      const grossIdx = headers.findIndex(h => h.includes('brüt') || h.includes('gross'));
      const netIdx = headers.findIndex(h => h.includes('net'));

      if (tcIdx === -1 || nameIdx === -1 || surnameIdx === -1 || taseronIdx === -1) {
        alert('TC No, Ad, Soyad ve Taşeron sütunları zorunludur!');
        return;
      }

      let added = 0, updated = 0, skipped = 0, exited = 0;
      const warnings: any[] = [];
      const currentTcNumbers: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const tcNumber = cols[tcIdx];
        if (!tcNumber || tcNumber.length !== 11) continue;

        currentTcNumbers.push(tcNumber);
        const firstName = cols[nameIdx];
        const lastName = cols[surnameIdx];
        const taseron = cols[taseronIdx];
        const position = posIdx >= 0 ? cols[posIdx] : '';
        const grossSalary = grossIdx >= 0 ? parseFloat(cols[grossIdx]?.replace(/[^\d.-]/g, '') || '0') : 0;
        const netSalary = netIdx >= 0 ? parseFloat(cols[netIdx]?.replace(/[^\d.-]/g, '') || '0') : 0;

        // Mevcut personeli kontrol et
        const existing = personnel.find(p => p.tc_number === tcNumber);

        if (importMode === 'add') {
          if (existing) {
            skipped++;
            continue;
          }

          // Eski personel kontrolü (gelecekte implementasyon)
          // if (existing && existing.status === 'resigned') { ... }

          await supabase.from('personnel').insert({
            tc_number: tcNumber,
            first_name: firstName,
            last_name: lastName,
            taseron,
            position,
            gross_salary: grossSalary,
            net_salary: netSalary,
            firm_id: selectedFirm?.id || null,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          });
          added++;
        } else {
          // Maaş güncelleme modu
          if (!existing) {
            skipped++;
            continue;
          }

          await supabase.from('personnel').update({
            gross_salary: grossSalary || existing.gross_salary,
            net_salary: netSalary || existing.net_salary,
          }).eq('id', existing.id);
          updated++;
        }
      }

      // Taşeron değişikliği kontrolü
      if (importMode === 'add') {
        const activePersonnel = personnel.filter(p => p.status === 'active');
        for (const p of activePersonnel) {
          if (currentTcNumbers.includes(p.tc_number)) {
            const line = lines.find((l, idx) => idx > 0 && l.split(',')[tcIdx] === p.tc_number);
            if (line) {
              const cols = line.split(',').map(c => c.trim());
              const newTaseron = cols[taseronIdx];
              if (newTaseron && newTaseron !== p.taseron) {
                warnings.push({
                  tc: p.tc_number,
                  name: `${p.first_name} ${p.last_name}`,
                  oldTaseron: p.taseron,
                  newTaseron,
                });
              }
            }
          }
        }

        // Çıkan personelleri bul
        const exitedPersonnel = personnel.filter(p => p.status === 'active' && !currentTcNumbers.includes(p.tc_number));
        for (const p of exitedPersonnel) {
          setExitingPersonnel(p);
          setShowExitModal(true);
          exited++;
        }
      }

      if (warnings.length > 0) {
        setTransferWarnings(warnings);
        setShowTransferWarning(true);
      }

      setMessage({
        type: 'success',
        text: importMode === 'add'
          ? `${added} personel eklendi, ${skipped} atlandı, ${exited} çıkış bekleniyor`
          : `${updated} personel güncellendi, ${skipped} atlandı`,
      });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'İçe aktarma hatası: ' + (err as Error).message });
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const filtered = personnel.filter(p => {
    const matchesSearch = `${p.first_name} ${p.last_name} ${p.tc_number} ${p.taseron}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => ({
    active: 'Aktif',
    resigned: 'İstifa',
    on_leave: 'İzinli',
  }[status] || status);

  const getStatusColor = (status: string) => ({
    active: 'bg-green-100 text-green-700',
    resigned: 'bg-red-100 text-red-700',
    on_leave: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-slate-100 text-slate-700');

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
          <Users size={24} />
          Personel Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <div className="flex gap-2">
          <button onClick={downloadExampleCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors">
            <Download size={16} />Örnek CSV
          </button>
          <button onClick={() => { setImportMode('add'); setShowExcelImport(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Upload size={16} />Excel ile Ekle
          </button>
          <button onClick={() => { setImportMode('update'); setShowExcelImport(true); }} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            <FileSpreadsheet size={16} />Maaş Güncelle
          </button>
          <button onClick={() => { resetForm(); setEditingPersonnel(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={16} />Yeni Personel
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Arama ve Filtre */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Personel ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg">
          <option value="all">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="resigned">İstifa</option>
          <option value="on_leave">İzinli</option>
        </select>
      </div>

      {/* Personel Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="p-tc" className="text-left py-3 px-4">TC No</ResizableTh>
                <ResizableTh columnId="p-ad" className="text-left py-3 px-4">Ad Soyad</ResizableTh>
                <ResizableTh columnId="p-taseron" className="text-left py-3 px-4">Taşeron</ResizableTh>
                <ResizableTh columnId="p-pozisyon" className="text-left py-3 px-4">Pozisyon</ResizableTh>
                <ResizableTh columnId="p-maas" className="text-right py-3 px-4">Brüt Maaş</ResizableTh>
                <ResizableTh columnId="p-net" className="text-right py-3 px-4">Net Maaş</ResizableTh>
                <ResizableTh columnId="p-durum" className="text-center py-3 px-4">Durum</ResizableTh>
                <ResizableTh columnId="p-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono">{p.tc_number}</td>
                  <td className="py-3 px-4 font-medium">{p.first_name} {p.last_name}</td>
                  <td className="py-3 px-4">{p.taseron}</td>
                  <td className="py-3 px-4">{p.position || '-'}</td>
                  <td className="py-3 px-4 text-right">{p.gross_salary ? formatCurrency(p.gross_salary) : '-'}</td>
                  <td className="py-3 px-4 text-right">{p.net_salary ? formatCurrency(p.net_salary) : '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                      {p.is_protected && <Shield size={14} className="text-blue-500" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(p)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle"><Edit2 size={14} /></button>
                      {p.status === 'active' && (
                        <button onClick={() => handleExit(p)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Çıkış Yap"><X size={14} /></button>
                      )}
                      <button onClick={() => handleDelete(p.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center py-8 text-slate-500">Personel bulunamadı.</p>}
      </div>

      {/* Personel Ekleme/Düzenleme Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingPersonnel ? 'Personel Düzenle' : 'Yeni Personel'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">TC No *</label><input type="text" value={formData.tc_number} onChange={(e) => setFormData({ ...formData, tc_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" maxLength={11} required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Ad *</label><input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Soyad *</label><input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Taşeron *</label><input type="text" value={formData.taseron} onChange={(e) => setFormData({ ...formData, taseron: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Pozisyon</label><input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">İşe Giriş Tarihi</label><input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Brüt Maaş</label><input type="number" value={formData.gross_salary} onChange={(e) => setFormData({ ...formData, gross_salary: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Net Maaş</label><input type="number" value={formData.net_salary} onChange={(e) => setFormData({ ...formData, net_salary: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Banka</label><input type="text" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label><input type="text" value={formData.bank_iban} onChange={(e) => setFormData({ ...formData, bank_iban: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">SGK No</label><input type="text" value={formData.sgk_number} onChange={(e) => setFormData({ ...formData, sgk_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.is_protected} onChange={(e) => setFormData({ ...formData, is_protected: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <label className="text-sm font-medium text-slate-700">Korumalı Personel (İşten Çıkarılamaz)</label>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Adres</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" rows={2} /></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingPersonnel(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingPersonnel ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Çıkış Modal */}
      {showExitModal && exitingPersonnel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Personel Çıkışı</h2>
            <p className="mb-4">{exitingPersonnel.first_name} {exitingPersonnel.last_name} ({exitingPersonnel.tc_number})</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Çıkış Tarihi</label>
              <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowExitModal(false); setExitingPersonnel(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
              <button onClick={confirmExit} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Çıkış Yap</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {importMode === 'add' ? 'Personel Ekle (Excel)' : 'Maaş Güncelle (Excel)'}
            </h2>
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                {importMode === 'add'
                  ? 'TC No ile eşleştirilecek. Kayıtlı olanlar atlanacak.'
                  : 'TC No ile eşleştirilecek. Maaşlar güncellenecek.'}
              </p>
              <p className="text-xs text-slate-500">Zorunlu: TC No, Ad, Soyad, Taşeron</p>
              <p className="text-xs text-slate-500">Opsiyonel: Pozisyon, Brüt Maaş, Net Maaş</p>
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelImport} className="w-full px-4 py-2 border border-slate-300 rounded-lg" disabled={importing} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowExcelImport(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Taşeron Uyarı Modal */}
      {showTransferWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4 text-orange-600">Taşeron Değişikliği Uyarısı</h2>
            <p className="mb-4 text-sm text-slate-600">Bu personellerin taşeronu farklı girilmiş:</p>
            <div className="space-y-2 mb-4">
              {transferWarnings.map((w, i) => (
                <div key={i} className="p-3 bg-orange-50 rounded-lg">
                  <p className="font-medium">{w.name} ({w.tc})</p>
                  <p className="text-sm text-slate-600">Eski: {w.oldTaseron} → Yeni: {w.newTaseron}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTransferWarning(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
