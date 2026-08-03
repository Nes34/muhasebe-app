import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency, toISODate, parseDateTR, todayISO } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Check, Cari, BankAccount } from '../types';
import { Plus, Edit2, Trash2, Search, AlertTriangle, Send } from 'lucide-react';

export default function CheckManagement() {
  const { selectedFirm } = useFirm();
  const [checks, setChecks] = useState<Check[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [firmBankAccounts, setFirmBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'received' | 'given'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  
  const [formData, setFormData] = useState({
    check_number: '', check_type: 'received' as 'received' | 'given', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '',
  });

  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorsingCheck, setEndorsingCheck] = useState<Check | null>(null);
  const [endorseData, setEndorseData] = useState({
    endorsed_to: '',
    endorsed_date: formatDateTR(new Date()),
    endorsed_by: '',
    notes: '',
  });

  useEffect(() => { fetchMeta().then(() => fetchChecks()); }, [selectedFirm]);

  const fetchChecks = async () => {
    let query = supabase.from('checks').select('*').order('due_date', { ascending: true });
    if (selectedFirm) {
      query = query.eq('firm_id', selectedFirm.id);
    }
    const { data } = await query;
    if (!data) { setLoading(false); return; }

    // Vadesi dolan çekleri otomatik tahsil/öde
    const today = todayISO();
    const dueChecks = data.filter(c => {
      if (c.status !== 'pending') return false;
      // Tarih formatını normalize et ve karşılaştır
      const dueDate = toISODate(c.due_date);
      return dueDate && dueDate <= today;
    });

    for (const check of dueChecks) {
      // İdempotency: zaten işlendi mi kontrol et
      const { data: freshCheck } = await supabase.from('checks').select('status').eq('id', check.id).single();
      if (freshCheck && freshCheck.status !== 'pending') continue;

      const newStatus = check.check_type === 'received' ? 'collected' : 'paid';
      const cariName = cariler.find(c => c.id === check.cari_id)?.name || '';

      // Çek durumunu güncelle
      await supabase.from('checks').update({ status: newStatus }).eq('id', check.id);

      // Çekin banka hesabını bul (bank_name ile eşleştir)
      const acc = bankAccounts.find(a => a.bank_name === check.bank_name);

      if (check.check_type === 'received') {
        // Tahsil edilen çek → bankaya giriş
        if (acc) {
          // Güncel bakiyeyi oku (race condition önleme)
          const { data: freshAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', acc.id).single();
          const currentBalance = freshAcc?.current_balance ?? acc.current_balance;

          await supabase.from('bank_transactions').insert({
            bank_account_id: acc.id,
            cari_id: check.cari_id,
            firm_id: check.firm_id,
            transaction_type: 'in',
            amount: check.amount,
            description: `Çek Tahsil (Otomatik): ${check.check_number} - ${cariName}`,
          });
          await supabase.from('bank_accounts').update({ current_balance: currentBalance + check.amount }).eq('id', acc.id);
        }
      } else {
        // Ödenen çek → bankadan çıkış
        if (acc) {
          // Güncel bakiyeyi oku (race condition önleme)
          const { data: freshAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', acc.id).single();
          const currentBalance = freshAcc?.current_balance ?? acc.current_balance;

          await supabase.from('bank_transactions').insert({
            bank_account_id: acc.id,
            cari_id: check.cari_id,
            firm_id: check.firm_id,
            transaction_type: 'out',
            amount: check.amount,
            description: `Çek Ödeme (Otomatik): ${check.check_number} - ${cariName}`,
          });
          await supabase.from('bank_accounts').update({ current_balance: currentBalance - check.amount }).eq('id', acc.id);
        }
      }
    }

    // Güncel çekleri tekrar çek
    const { data: updated } = await query;
    if (updated) setChecks(updated);
    setLoading(false);
  };

  const fetchMeta = async () => {
    const [carilerRes, bankRes] = await Promise.all([
      supabase.from('cariler').select('*').eq('is_active', true).order('code'),
      supabase.from('bank_accounts').select('*').eq('is_active', true).order('bank_name'),
    ]);
    if (carilerRes.data) setCariler(carilerRes.data);
    if (bankRes.data) setBankAccounts(bankRes.data);
  };

  const fetchFirmBankAccounts = async (firmId: string) => {
    if (!firmId) { setFirmBankAccounts([]); return; }
    const { data } = await supabase.from('bank_accounts').select('*').eq('is_active', true).eq('firm_id', firmId).order('bank_name');
    if (data) setFirmBankAccounts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCheck) {
      await supabase.from('checks').update({ check_number: formData.check_number, check_type: formData.check_type, cari_id: formData.cari_id, bank_name: formData.bank_name, bank_branch: formData.bank_branch, amount: formData.amount, issue_date: formData.issue_date, due_date: formData.due_date, notes: formData.notes }).eq('id', editingCheck.id);
    } else {
      await supabase.from('checks').insert({ check_number: formData.check_number, check_type: formData.check_type, cari_id: formData.cari_id, firm_id: selectedFirm?.id, bank_name: formData.bank_name, bank_branch: formData.bank_branch, amount: formData.amount, issue_date: formData.issue_date, due_date: formData.due_date, notes: formData.notes });
    }
    setShowForm(false); setEditingCheck(null);
    setFormData({ check_number: '', check_type: 'received', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '' });
    fetchChecks();
  };

  const handleEdit = (check: Check) => {
    setEditingCheck(check);
    setFormData({ check_number: check.check_number, check_type: check.check_type, cari_id: check.cari_id || '', bank_name: check.bank_name || '', bank_branch: check.bank_branch || '', amount: check.amount, issue_date: check.issue_date, due_date: check.due_date, notes: check.notes || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu çeki silmek istediğinizden emin misiniz?')) { await supabase.from('checks').delete().eq('id', id); fetchChecks(); }
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
      fetchChecks();
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
    return matchesSearch && matchesType && (check.status === 'pending' || check.status === 'endorsed');
  });

  const receivedTotal = filteredChecks.filter(c => c.check_type === 'received').reduce((sum, c) => sum + c.amount, 0);
  const givenTotal = filteredChecks.filter(c => c.check_type === 'given').reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Çek Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <button onClick={() => { setEditingCheck(null); setFormData({ check_number: '', check_type: 'received', cari_id: '', bank_name: '', bank_branch: '', amount: 0, issue_date: formatDateTR(new Date()), due_date: '', notes: '' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} />Yeni Çek
        </button>
      </div>

      {filteredChecks.some(c => { const d = getDaysUntilDue(c.due_date); return d >= 0 && d <= 5; }) && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 mb-2"><AlertTriangle size={20} /><span className="font-semibold">Vadesi Yaklaşan Çekler</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3"><p className="text-sm text-slate-600">5 Gün İçinde</p><p className="text-lg font-bold text-orange-600">{filteredChecks.filter(c => { const d = getDaysUntilDue(c.due_date); return d > 0 && d <= 5; }).length} Çek</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-sm text-slate-600">1 Gün İçinde</p><p className="text-lg font-bold text-orange-600">{filteredChecks.filter(c => getDaysUntilDue(c.due_date) === 1).length} Çek</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-sm text-slate-600">Bugün Vade</p><p className="text-lg font-bold text-red-600">{filteredChecks.filter(c => getDaysUntilDue(c.due_date) === 0).length} Çek</p></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative flex-1 md:w-96"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Çek ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" /></div>
        <div className="flex gap-2">
          {[{ value: 'all', label: 'Tümü' }, { value: 'received', label: 'Alınan' }, { value: 'given', label: 'Verilen' }].map((option) => (
            <button key={option.value} onClick={() => setFilterType(option.value as typeof filterType)} className={`px-4 py-2 rounded-lg transition-colors ${filterType === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{option.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200"><p className="text-sm text-green-700">Alınan Çekler Toplamı</p><p className="text-2xl font-bold text-green-600">{formatCurrency(receivedTotal)}</p></div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200"><p className="text-sm text-red-700">Verilen Çekler Toplamı</p><p className="text-2xl font-bold text-red-600">{formatCurrency(givenTotal)}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left py-3 px-4">Çek No</th><th className="text-left py-3 px-4">Tür</th><th className="text-left py-3 px-4">Cari</th><th className="text-left py-3 px-4">Banka</th><th className="text-right py-3 px-4">Tutar</th><th className="text-left py-3 px-4">Vade</th><th className="text-center py-3 px-4">Kalan</th><th className="text-center py-3 px-4">Durum</th><th className="text-center py-3 px-4">İşlem</th></tr></thead>
            <tbody>
              {filteredChecks.map((check) => {
                const dueStatus = getDueStatus(check.due_date);
                const cari = cariler.find(c => c.id === check.cari_id);
                return (
                  <tr key={check.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{check.check_number}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${check.check_type === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{check.check_type === 'received' ? 'Alınan' : 'Verilen'}</span></td>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingCheck ? 'Çek Düzenle' : 'Yeni Çek'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Çek Numarası</label><input type="text" value={formData.check_number} onChange={(e) => setFormData({ ...formData, check_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Çek Türü</label><select value={formData.check_type} onChange={(e) => setFormData({ ...formData, check_type: e.target.value as 'received' | 'given', bank_name: '' })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="received">Alınan Çek</option><option value="given">Verilen Çek</option></select></div>
              <SearchableSelect
                options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                value={formData.cari_id}
                onChange={(id) => { setFormData({ ...formData, cari_id: id, bank_name: '' }); fetchFirmBankAccounts(selectedFirm?.id || ''); }}
                label="Cari"
                placeholder="Kod veya isim ile cari ara..."
                required
              />
              {formData.check_type === 'given' && selectedFirm ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banka Hesabı *</label>
                  <select
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    required
                  >
                    <option value="">Banka seçin...</option>
                    {firmBankAccounts.map(ba => (
                      <option key={ba.id} value={ba.bank_name}>{ba.bank_name} - {ba.account_number || ba.branch || ''}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Banka</label><input type="text" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Şube</label><input type="text" value={formData.bank_branch} onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div></div>
              )}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label><input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Düzenleme</label><input type="text" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Vade</label><input type="text" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingCheck(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
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
                <input type="text" value={endorseData.endorsed_date} onChange={(e) => setEndorseData({ ...endorseData, endorsed_date: e.target.value })} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
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
