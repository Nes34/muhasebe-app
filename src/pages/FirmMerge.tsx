import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { addRequest, getPendingRequests, approveRequest, rejectRequest, type ApprovalRequest } from '../lib/approvals';
import SearchableSelect from '../components/SearchableSelect';
import type { Firm } from '../types';
import { GitMerge, AlertTriangle, CheckCircle, AlertCircle, Shield, Send, Clock, Check, X } from 'lucide-react';

export default function FirmMerge() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [merging, setMerging] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);

  const [oldFirmId, setOldFirmId] = useState('');
  const [newFirmName, setNewFirmName] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [rejectModal, setRejectModal] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [stats, setStats] = useState({ transactions: 0, projects: 0, checks: 0, cashTransactions: 0, bankTransactions: 0, products: 0 });

  useEffect(() => { fetchFirms(); }, []);
  useEffect(() => { if (oldFirmId) fetchStats(oldFirmId); }, [oldFirmId]);
  useEffect(() => { setPendingRequests(getPendingRequests()); }, [message]);

  const fetchFirms = async () => {
    setLoading(true);
    const { data } = await supabase.from('firms').select('*').in('type', ['customer', 'supplier']).order('code');
    if (data) setFirms(data);
    setLoading(false);
  };

  const fetchStats = async (firmId: string) => {
    const [txRes, projRes, checkRes, cashRes, bankRes, prodRes] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
      supabase.from('checks').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
      supabase.from('cash_transactions').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
      supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
    ]);
    setStats({
      transactions: txRes.count || 0, projects: projRes.count || 0, checks: checkRes.count || 0,
      cashTransactions: cashRes.count || 0, bankTransactions: bankRes.count || 0, products: prodRes.count || 0,
    });
  };

  const oldFirm = firms.find(f => f.id === oldFirmId);

  const handleApprove = (req: ApprovalRequest) => {
    approveRequest(req.id, user?.id || '');
    setPendingRequests(getPendingRequests());
    setMessage({ type: 'success', text: 'Birleştirme talebi onaylandı!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReject = (req: ApprovalRequest) => {
    rejectRequest(req.id, user?.id || '', rejectReason);
    setPendingRequests(getPendingRequests());
    setRejectModal(null);
    setRejectReason('');
    setMessage({ type: 'success', text: 'Birleştirme talebi reddedildi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!oldFirmId) { setMessage({ type: 'error', text: 'Eski firmayı seçin!' }); return; }
    if (!createNew && !newFirmName) { setMessage({ type: 'error', text: 'Hedef firmayı seçin!' }); return; }
    if (createNew && newFirmName.length < 2) { setMessage({ type: 'error', text: 'Yeni firma adı en az 2 karakter olmalıdır!' }); return; }
    if (confirmText !== 'BİRLEŞTİR') { setMessage({ type: 'error', text: 'Onay için "BİRLEŞTİR" yazmalısınız!' }); return; }

    const targetName = createNew ? newFirmName : firms.find(f => f.id === newFirmName)?.name;

    // Non-admin → talep gönder
    if (!isAdmin) {
      addRequest({
        type: 'firm_merge',
        requested_by: user?.id || '',
        requested_by_name: user?.email || '',
        data: {
          old_firm_id: oldFirmId,
          old_firm_name: oldFirm?.name,
          new_firm_id: createNew ? null : newFirmName,
          new_firm_name: targetName,
          create_new: createNew,
          stats,
        },
      });
      setPendingRequests(getPendingRequests());
      setMessage({ type: 'success', text: 'Birleştirme talebiniz admin onayına gönderildi!' });
      setOldFirmId(''); setNewFirmName(''); setConfirmText(''); setCreateNew(false);
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Admin → direkt uygula
    setMerging(true);
    try {
      let targetFirmId: string;

      if (createNew) {
        const { data: newFirm, error: firmErr } = await supabase.from('firms').insert({
          name: newFirmName, tax_number: oldFirm?.tax_number || '', address: oldFirm?.address || '',
          phone: oldFirm?.phone || '', email: oldFirm?.email || '', type: oldFirm?.type || 'both', is_active: true,
        }).select().single();
        if (firmErr) throw firmErr;
        targetFirmId = newFirm.id;
      } else {
        targetFirmId = newFirmName;
      }

      await supabase.from('transactions').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('projects').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('checks').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('cash_transactions').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('bank_transactions').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('products').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('cash_registers').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('bank_accounts').update({ firm_id: targetFirmId }).eq('firm_id', oldFirmId);
      await supabase.from('firms').update({ is_active: false, name: `${oldFirm?.name} (BİRLEŞTİRİLDİ)` }).eq('id', oldFirmId);

      setMessage({ type: 'success', text: `"${oldFirm?.name}" → "${targetName}" başarıyla birleştirildi!` });
      setOldFirmId(''); setNewFirmName(''); setConfirmText(''); setCreateNew(false);
      await fetchFirms();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Birleştirme hatası: ${err.message || 'Bilinmeyen hata'}` });
    } finally {
      setMerging(false);
    }
  };

  const activeFirms = firms.filter(f => f.is_active);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GitMerge size={24} />
          Firma Birleştirme
          {!isAdmin && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1"><Shield size={12} /> Talep Modu</span>}
        </h1>
      </div>

      {!isAdmin && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700 flex items-center gap-2">
            <Shield size={16} />
            <span><strong>Admin onayı gerekiyor.</strong> Birleştirme talepleriniz admin tarafından onaylandıktan sonra uygulanacaktır.</span>
          </p>
        </div>
      )}

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Bekleyen Talepler (Admin) */}
      {isAdmin && pendingRequests.filter(r => r.type === 'firm_merge').length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-amber-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={18} className="text-amber-600" /> Bekleyen Birleştirme Talepleri
          </h2>
          <div className="space-y-3">
            {pendingRequests.filter(r => r.type === 'firm_merge').map(req => (
              <div key={req.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{req.data.old_firm_name} → {req.data.new_firm_name || 'Yeni Cari'}</span>
                    <span className="ml-2 text-xs text-slate-500">- {req.requested_by_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleApprove(req)} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"><Check size={14} /> Onayla</button>
                    <button onClick={() => setRejectModal(req)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-1"><X size={14} /> Reddet</button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  <p>{req.data.stats?.transactions || 0} işlem, {req.data.stats?.projects || 0} proje, {req.data.stats?.checks || 0} çek aktarılacak</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">Dikkat!</h3>
            <p className="text-sm text-amber-700 mt-1">Bu işlem geri alınamaz. Eski firmadaki tüm veriler hedef firmaya aktarılacaktır.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <SearchableSelect
              options={activeFirms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
              value={oldFirmId}
              onChange={(id) => { setOldFirmId(id); setConfirmText(''); }}
              label="Eski Cari"
              placeholder="Kod veya isim ile cari ara..."
              required
            />

            {oldFirm && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">{oldFirm.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-red-700">
                  <div>Vergi No: {oldFirm.tax_number || '-'}</div>
                  <div>Tip: {oldFirm.type === 'customer' ? 'Müşteri' : oldFirm.type === 'supplier' ? 'Tedarikçi' : 'Her İkisi'}</div>
                </div>
              </div>
            )}

            {oldFirmId && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-3">Aktarılacak Veriler:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-blue-600">{stats.transactions}</div><div className="text-xs text-slate-500">İşlem</div></div>
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-green-600">{stats.projects}</div><div className="text-xs text-slate-500">Proje</div></div>
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-purple-600">{stats.checks}</div><div className="text-xs text-slate-500">Çek</div></div>
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-yellow-600">{stats.cashTransactions}</div><div className="text-xs text-slate-500">Kasa</div></div>
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-cyan-600">{stats.bankTransactions}</div><div className="text-xs text-slate-500">Banka</div></div>
                  <div className="p-2 bg-white rounded border border-slate-200"><div className="text-lg font-bold text-orange-600">{stats.products}</div><div className="text-xs text-slate-500">Ürün</div></div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3"><span className="text-red-500">*</span> Hedef Cari</label>
              <div className="flex gap-4 mb-4">
                <button type="button" onClick={() => { setCreateNew(false); setNewFirmName(''); }} className={`flex-1 p-3 rounded-lg border-2 transition-all ${!createNew ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>Mevcut Carıya Aktar</button>
                <button type="button" onClick={() => { setCreateNew(true); setNewFirmName(oldFirm?.name || ''); }} className={`flex-1 p-3 rounded-lg border-2 transition-all ${createNew ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}>Yeni Cari Oluştur</button>
              </div>
              {!createNew ? (
                <SearchableSelect
                  options={activeFirms.filter(f => f.id !== oldFirmId).map(f => ({ id: f.id, code: f.code, name: f.name }))}
                  value={newFirmName}
                  onChange={(id) => setNewFirmName(id)}
                  label="Hedef Cari"
                  placeholder="Kod veya isim ile cari ara..."
                  required
                />
              ) : (
                <input type="text" value={newFirmName} onChange={(e) => setNewFirmName(e.target.value)} placeholder="Yeni cari adı" className="w-full px-4 py-3 border border-slate-300 rounded-lg" required />
              )}
            </div>

            {oldFirmId && newFirmName && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-300">
                <label className="block text-sm font-medium text-red-700 mb-2">Onay için <span className="font-bold text-red-800">BİRLEŞTİR</span> yazın:</label>
                <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="BİRLEŞTİR" className="w-full px-4 py-2 border border-red-300 rounded-lg" />
              </div>
            )}

            <button type="submit" disabled={merging || !oldFirmId || !newFirmName || confirmText !== 'BİRLEŞTİR'} className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${isAdmin ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
              {merging ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Birleştiriliyor...</> :
               isAdmin ? <><GitMerge size={18} /> Firmaları Birleştir</> : <><Send size={18} /> Talep Gönder</>}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Birleştirme Özeti</h2>
          {oldFirmId ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-500 mb-1">Eski Cari (Pasif)</p>
                <p className="font-bold text-red-700">{oldFirm?.name}</p>
              </div>
              <div className="flex justify-center"><ArrowRight size={24} className="text-slate-400" /></div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-500 mb-1">{createNew ? 'Yeni Cari' : 'Hedef Cari'}</p>
                <p className="font-bold text-green-700">{createNew ? newFirmName || '...' : firms.find(f => f.id === newFirmName)?.name || '...'}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500"><GitMerge size={48} className="mx-auto mb-3 text-slate-300" /><p>Eski firma seçerek başlayın</p></div>
          )}
        </div>
      </div>

      {/* Red Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Talebi Reddet</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Red Nedeni</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Red nedenini yazın..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
              <button onClick={() => handleReject(rejectModal)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reddet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
