import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency, toISODate, parseDateTR, todayISO } from '../lib/utils';
import { exportChecksToExcel } from '../lib/excel';
import { useFirm } from '../hooks/useFirm';
import DateInput from '../components/DateInput';
import type { Check, Cari, BankAccount, Firm } from '../types';
import { Plus, Edit2, Trash2, Search, AlertTriangle, Send, Download } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function CheckManagement() {
  const { selectedFirm, selectedProject } = useFirm();
  const [checks, setChecks] = useState<Check[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmBankAccounts, setFirmBankAccounts] = useState<BankAccount[]>([]);
  const [_bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'received' | 'given'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'endorsed' | 'collected' | 'paid'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  
  const [formData, setFormData] = useState({
    check_number: '', check_type: 'received' as 'received' | 'given', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '',
  });

  // Çoklu çek kalemleri
  interface CheckItem {
    check_number: string;
    cari_id: string;
    bank_name: string;
    bank_branch: string;
    amount: number;
    due_date: string;
  }
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);

  // İlk kalemi oluştur
  const initCheckItems = () => {
    setCheckItems([{
      check_number: '',
      cari_id: '',
      bank_name: '',
      bank_branch: '',
      amount: 0,
      due_date: '',
    }]);
  };

  // Yeni kalem ekle (son kalemi kopyala, çek no +1, vade +1 ay)
  const addCheckItem = () => {
    if (checkItems.length === 0) {
      initCheckItems();
      return;
    }
    const lastItem = checkItems[checkItems.length - 1];
    
    // Çek numarasını 1 artır
    let newCheckNumber = '';
    const lastNum = parseInt(lastItem.check_number);
    if (!isNaN(lastNum)) {
      newCheckNumber = String(lastNum + 1);
    } else {
      // Sayısal kısmı bul ve artır
      const match = lastItem.check_number.match(/(.*?)(\d+)(\D*)$/);
      if (match) {
        newCheckNumber = match[1] + String(parseInt(match[2]) + 1).padStart(match[2].length, '0') + match[3];
      } else {
        newCheckNumber = lastItem.check_number;
      }
    }

    // Vade tarihini 1 ay ileri al
    let newDueDate = '';
    if (lastItem.due_date) {
      const parts = lastItem.due_date.split('.');
      if (parts.length === 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        // Ay sonu kontrolü
        const daysInMonth = new Date(year, month, 0).getDate();
        if (day > daysInMonth) day = daysInMonth;
        newDueDate = String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0') + '.' + String(year);
      }
    }

    setCheckItems([...checkItems, {
      check_number: newCheckNumber,
      cari_id: lastItem.cari_id,
      bank_name: lastItem.bank_name,
      bank_branch: lastItem.bank_branch,
      amount: lastItem.amount,
      due_date: newDueDate,
    }]);
  };

  // Kalem güncelle
  const updateCheckItem = (index: number, field: keyof CheckItem, value: any) => {
    const updated = [...checkItems];
    updated[index] = { ...updated[index], [field]: value };
    setCheckItems(updated);
  };

  // Kalem sil
  const removeCheckItem = (index: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== index));
  };

  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorsingCheck, setEndorsingCheck] = useState<Check | null>(null);
  const [endorseData, setEndorseData] = useState({
    endorsed_to: '',
    endorsed_date: formatDateTR(new Date()),
    endorsed_by: '',
    notes: '',
  });

  useEffect(() => {
    (async () => {
      const [carilerRes, bankRes, firmsRes] = await Promise.all([
        supabase.from('cariler').select('*').eq('is_active', true).order('code'),
        supabase.from('bank_accounts').select('*').eq('is_active', true).order('bank_name'),
        supabase.from('firms').select('*').eq('is_active', true).order('name'),
      ]);
      const _cariler = carilerRes.data || [];
      const _bankAccounts = bankRes.data || [];
      if (carilerRes.data) setCariler(_cariler);
      if (bankRes.data) { setBankAccounts(_bankAccounts); setFirmBankAccounts(_bankAccounts); }
      if (firmsRes.data) setFirms(firmsRes.data);

      let query = supabase.from('checks').select('*').order('due_date', { ascending: true });
      if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
      const { data } = await query;
      if (!data) { setLoading(false); return; }

      // Otomatik vade ödeme
      const today = todayISO();
      const dueChecks = data.filter(c => {
        if (c.status !== 'pending') return false;
        const dueDate = toISODate(c.due_date);
        return dueDate && dueDate <= today;
      });

      for (const check of dueChecks) {
        const { data: freshCheck } = await supabase.from('checks').select('status').eq('id', check.id).single();
        if (freshCheck && freshCheck.status !== 'pending') continue;
        const newStatus = check.check_type === 'received' ? 'collected' : 'paid';
        const cariName = _cariler.find((c: any) => c.id === check.cari_id)?.name || '';
        await supabase.from('checks').update({ status: newStatus }).eq('id', check.id);
        const acc = _bankAccounts.find((a: any) => a.bank_name === check.bank_name);
        if (check.check_type === 'received' && acc) {
          const { data: freshAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', acc.id).single();
          const currentBalance = freshAcc?.current_balance ?? acc.current_balance;
          await supabase.from('bank_transactions').insert({ bank_account_id: acc.id, cari_id: check.cari_id, firm_id: check.firm_id, transaction_type: 'in', amount: check.amount, description: `Çek Tahsil (Otomatik): ${check.check_number} - ${cariName}` });
          await supabase.from('bank_accounts').update({ current_balance: currentBalance + check.amount }).eq('id', acc.id);
        } else if (check.check_type === 'given' && acc) {
          const { data: freshAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', acc.id).single();
          const currentBalance = freshAcc?.current_balance ?? acc.current_balance;
          await supabase.from('bank_transactions').insert({ bank_account_id: acc.id, cari_id: check.cari_id, firm_id: check.firm_id, transaction_type: 'out', amount: check.amount, description: `Çek Ödeme (Otomatik): ${check.check_number} - ${cariName}` });
          await supabase.from('bank_accounts').update({ current_balance: currentBalance - check.amount }).eq('id', acc.id);
        }
      }

      setChecks(data);
      setLoading(false);
    })();
  }, [selectedFirm, selectedProject]);

  const reload = async () => {
    setLoading(true);
    let query = supabase.from('checks').select('*').order('due_date', { ascending: true });
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    if (selectedProject) query = query.eq('project_id', selectedProject.id);
    const { data } = await query;
    if (data) setChecks(data);
    setLoading(false);
  };

  // Çoklu çek kaydetme
  const handleSubmitMultiple = async () => {
    if (checkItems.length === 0) return;
    
    const checksToInsert = checkItems
      .filter(item => item.cari_id && item.amount > 0)
      .map(item => ({
        check_number: item.check_number,
        check_type: formData.check_type,
        cari_id: item.cari_id,
        firm_id: selectedFirm?.id,
        bank_name: item.bank_name,
        bank_branch: item.bank_branch,
        amount: item.amount,
        issue_date: formData.issue_date,
        due_date: item.due_date,
        notes: '',
      }));

    if (checksToInsert.length === 0) {
      alert('Lütfen en az bir çek için cari ve tutar girin.');
      return;
    }

    await supabase.from('checks').insert(checksToInsert);
    setShowForm(false);
    setCheckItems([]);
    setFormData({ check_number: '', check_type: 'received', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '' });
    reload();
  };

  const handleEdit = (check: Check) => {
    setEditingCheck(check);
    setFormData({ check_number: check.check_number, check_type: check.check_type, cari_id: check.cari_id || '', bank_name: check.bank_name || '', bank_branch: check.bank_branch || '', amount: check.amount, issue_date: check.issue_date, due_date: check.due_date, notes: check.notes || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu çeki silmek istediğinizden emin misiniz?')) { await supabase.from('checks').delete().eq('id', id); reload(); }
  };

  const handleEndorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endorsingCheck) return;
    
    const { error } = await supabase
      .from('checks')
      .update({
        status: 'endorsed',
        endorsed_to: endorseData.endorsed_to,
        endorsed_date: endorseData.endorsed_date,
        endorsed_by: endorseData.endorsed_by,
        notes: endorseData.notes ? `${endorseData.notes} (Ciro edildi)` : 'Ciro edildi',
      })
      .eq('id', endorsingCheck.id);
    
    if (!error) {
      setShowEndorseModal(false);
      setEndorsingCheck(null);
      setEndorseData({ endorsed_to: '', endorsed_date: formatDateTR(new Date()), endorsed_by: '', notes: '' });
      reload();
    }
  };

  const openEndorseModal = (check: Check) => {
    const cari = cariler.find(c => c.id === check.cari_id);
    setEndorsingCheck(check);
    setEndorseData({
      endorsed_to: '',
      endorsed_date: formatDateTR(new Date()),
      endorsed_by: cari?.name || '',
      notes: '',
    });
    setShowEndorseModal(true);
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = parseDateTR(dueDate) || new Date(dueDate); due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDueStatus = (dueDate: string) => {
    const days = getDaysUntilDue(dueDate);
    if (days < 0) return { label: 'Vadesi Geçti', color: 'bg-red-100 text-red-700' };
    if (days === 0) return { label: 'Bugün', color: 'bg-red-500 text-white' };
    if (days <= 1) return { label: '1 Gün', color: 'bg-orange-500 text-white' };
    if (days <= 5) return { label: `${days} Gün`, color: 'bg-yellow-100 text-yellow-700' };
    return { label: `${days} Gün`, color: 'bg-green-100 text-green-700' };
  };

  const filteredChecks = checks.filter((check) => {
    const cariName = cariler.find(c => c.id === check.cari_id)?.name || '';
    const matchesSearch = check.check_number.toLowerCase().includes(searchTerm.toLowerCase()) || cariName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || check.check_type === filterType;
    const matchesStatus = filterStatus === 'all' || check.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const receivedTotal = filteredChecks.filter(c => c.check_type === 'received').reduce((sum, c) => sum + c.amount, 0);
  const givenTotal = filteredChecks.filter(c => c.check_type === 'given').reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Çek Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <button onClick={() => { setEditingCheck(null); setFormData({ check_number: '', check_type: 'received', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '' }); initCheckItems(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} />Yeni Çek
        </button>
      </div>

      {filteredChecks.some(c => { const d = getDaysUntilDue(c.due_date); return d >= 0 && d <= 5; }) && (
        <div className="mb-6 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 mb-2"><AlertTriangle size={20} /><span className="font-semibold">Vadesi Yaklaşan Çekler</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3"><p className="text-sm text-slate-600 dark:text-slate-400">5 Gün İçinde</p><p className="text-lg font-bold text-orange-600 dark:text-orange-400">{filteredChecks.filter(c => { const d = getDaysUntilDue(c.due_date); return d > 0 && d <= 5; }).length} Çek</p></div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3"><p className="text-sm text-slate-600 dark:text-slate-400">1 Gün İçinde</p><p className="text-lg font-bold text-orange-600 dark:text-orange-400">{filteredChecks.filter(c => getDaysUntilDue(c.due_date) === 1).length} Çek</p></div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3"><p className="text-sm text-slate-600 dark:text-slate-400">Bugün Vade</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{filteredChecks.filter(c => getDaysUntilDue(c.due_date) === 0).length} Çek</p></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Çek ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
        <div className="flex flex-wrap gap-2">
          {[{ value: 'all', label: 'Tümü' }, { value: 'received', label: 'Alınan' }, { value: 'given', label: 'Verilen' }].map((option) => (
            <button key={option.value} onClick={() => setFilterType(option.value as typeof filterType)} className={`px-4 py-2 rounded-lg transition-colors ${filterType === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{option.label}</button>
          ))}
          <div className="w-px bg-slate-300 mx-1" />
          {[{ value: 'all', label: 'Tüm Durum' }, { value: 'pending', label: 'Bekleyen' }, { value: 'collected', label: 'Tahsil' }, { value: 'paid', label: 'Ödenen' }, { value: 'endorsed', label: 'Ciro' }].map((option) => (
            <button key={option.value} onClick={() => setFilterStatus(option.value as typeof filterStatus)} className={`px-3 py-2 rounded-lg text-sm transition-colors ${filterStatus === option.value ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{option.label}</button>
          ))}
          <button onClick={() => exportChecksToExcel(filteredChecks)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={18} /> Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200"><p className="text-sm text-green-700">Alınan Çekler Toplamı</p><p className="text-2xl font-bold text-green-600">{formatCurrency(receivedTotal)}</p></div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-700">Verilen Çekler Toplamı</p><p className="text-2xl font-bold text-red-600">{formatCurrency(givenTotal)}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <ResizableTh columnId="cek-no" className="text-left py-3 px-4">Çek No</ResizableTh>
              <ResizableTh columnId="cek-tur" className="text-left py-3 px-4">Tür</ResizableTh>
              <ResizableTh columnId="cek-firma" className="text-left py-3 px-4">Firma</ResizableTh>
              <ResizableTh columnId="cek-cari" className="text-left py-3 px-4">Cari</ResizableTh>
              <ResizableTh columnId="cek-banka" className="text-left py-3 px-4">Banka</ResizableTh>
              <ResizableTh columnId="cek-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
              <ResizableTh columnId="cek-vade" className="text-left py-3 px-4">Vade</ResizableTh>
              <ResizableTh columnId="cek-kalan" className="text-center py-3 px-4">Kalan</ResizableTh>
              <ResizableTh columnId="cek-durum" className="text-center py-3 px-4">Durum</ResizableTh>
              <ResizableTh columnId="cek-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
            </tr></thead>
            <tbody>
              {filteredChecks.map((check) => {
                const dueStatus = getDueStatus(check.due_date);
                const cari = cariler.find(c => c.id === check.cari_id);
                return (
                  <tr key={check.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{check.check_number}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${check.check_type === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{check.check_type === 'received' ? 'Alınan' : 'Verilen'}</span></td>
                    <td className="py-3 px-4">{firms.find(f => f.id === check.firm_id)?.name || '-'}</td>
                    <td className="py-3 px-4">{cari?.name || '-'}</td>
                    <td className="py-3 px-4">{check.bank_name || '-'}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(check.amount)}</td>
                    <td className="py-3 px-4">{formatDateTR(check.due_date)}</td>
                    <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${dueStatus.color}`}>{dueStatus.label}</span></td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${check.status === 'endorsed' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                        {check.status === 'endorsed' ? 'Ciro Edildi' : 'Bekliyor'}
                      </span>
                      {check.status === 'endorsed' && check.endorsed_to && (
                        <p className="text-xs text-slate-500 mt-1">→ {check.endorsed_to}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {check.status === 'pending' && (
                          <button onClick={() => openEndorseModal(check)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Ciro Et"><Send size={16} /></button>
                        )}
                        <button onClick={() => handleEdit(check)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(check.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredChecks.length === 0 && <p className="text-center py-8 text-slate-500">Çek bulunamadı.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingCheck ? 'Çek Düzenle' : 'Yeni Çek'}</h2>
              <button onClick={() => { setShowForm(false); setEditingCheck(null); setCheckItems([]); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            {/* Üst Kısım: Sabit Bilgiler */}
            <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                <input type="text" value={firms.find(f => f.id === selectedFirm?.id)?.name || ''} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Çek Türü</label>
                <select value={formData.check_type} onChange={(e) => setFormData({ ...formData, check_type: e.target.value as 'received' | 'given' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="received">Alınan Çek</option>
                  <option value="given">Verilen Çek</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Düzenleme Tarihi</label>
                <DateInput value={formData.issue_date} onChange={(val) => setFormData({ ...formData, issue_date: val })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={addCheckItem} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  <Plus size={16} /> Kalem Ekle
                </button>
              </div>
            </div>

            {/* Kalemler Tablosu */}
            <div className="flex-1 overflow-auto">
              {checkItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="mb-2">Henüz kalem eklenmedi</p>
                  <button type="button" onClick={initCheckItems} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus size={16} className="inline mr-1" /> İlk Kalemi Ekle
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="py-2 px-2 text-left text-xs">#</th>
                      <th className="py-2 px-2 text-left text-xs">Çek No</th>
                      <th className="py-2 px-2 text-left text-xs">Cari</th>
                      <th className="py-2 px-2 text-left text-xs">Banka</th>
                      <th className="py-2 px-2 text-left text-xs">Şube</th>
                      <th className="py-2 px-2 text-left text-xs">Vade</th>
                      <th className="py-2 px-2 text-right text-xs">Tutar</th>
                      <th className="py-2 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkItems.map((item, idx) => (
                      <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-2 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <input type="text" value={item.check_number} onChange={(e) => updateCheckItem(idx, 'check_number', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                        </td>
                        <td className="py-2 px-2">
                          <select value={item.cari_id} onChange={(e) => updateCheckItem(idx, 'cari_id', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm">
                            <option value="">Cari seçin...</option>
                            {cariler.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ''}{c.name}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          {formData.check_type === 'given' && selectedFirm ? (
                            <select value={item.bank_name} onChange={(e) => updateCheckItem(idx, 'bank_name', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm">
                              <option value="">Banka seçin...</option>
                              {firmBankAccounts.map(ba => <option key={ba.id} value={ba.bank_name}>{ba.bank_name}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={item.bank_name} onChange={(e) => updateCheckItem(idx, 'bank_name', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <input type="text" value={item.bank_branch} onChange={(e) => updateCheckItem(idx, 'bank_branch', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                        </td>
                        <td className="py-2 px-2">
                          <DateInput value={item.due_date} onChange={(val) => updateCheckItem(idx, 'due_date', val)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" value={item.amount} onChange={(e) => updateCheckItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-right" />
                        </td>
                        <td className="py-2 px-2">
                          {checkItems.length > 1 && (
                            <button onClick={() => removeCheckItem(idx)} className="p-1 text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={6} className="py-2 px-2 text-right text-sm">Toplam:</td>
                      <td className="py-2 px-2 text-right text-sm">{formatCurrency(checkItems.reduce((s, i) => s + i.amount, 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Alt Butonlar */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
              <button type="button" onClick={addCheckItem} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus size={16} /> Kalem Ekle
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingCheck(null); setCheckItems([]); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">İptal</button>
                <button onClick={handleSubmitMultiple} disabled={checkItems.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                  {checkItems.length} Çek Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEndorseModal && endorsingCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Çek Ciro Et</h2>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-600">Çek No: <span className="font-medium">{endorsingCheck.check_number}</span></p>
              <p className="text-sm text-slate-600">Tutar: <span className="font-medium">{formatCurrency(endorsingCheck.amount)}</span></p>
              <p className="text-sm text-slate-600">Cari: <span className="font-medium">{cariler.find(c => c.id === endorsingCheck.cari_id)?.name || '-'}</span></p>
            </div>
            <form onSubmit={handleEndorse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ciro Edilen Firma/Şahıs</label>
                <input type="text" value={endorseData.endorsed_to} onChange={(e) => setEndorseData({ ...endorseData, endorsed_to: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ciro Eden (Kimden)</label>
                <input type="text" value={endorseData.endorsed_by} onChange={(e) => setEndorseData({ ...endorseData, endorsed_by: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                <DateInput value={endorseData.endorsed_date} onChange={(val) => setEndorseData({ ...endorseData, endorsed_date: val })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
                <input type="text" value={endorseData.notes} onChange={(e) => setEndorseData({ ...endorseData, notes: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowEndorseModal(false); setEndorsingCheck(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Ciro Et</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
