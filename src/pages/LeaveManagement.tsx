import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Personnel, LeaveRequest } from '../types';
import { Calendar, Plus, AlertTriangle, CheckCircle, X } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

const LEAVE_TYPES = {
  annual: 'Yıllık İzin',
  sick: 'Hastalık İzni',
  unpaid: 'Ücretsiz İzin',
  maternity: 'Doğum İzni',
  other: 'Diğer',
};

const getAnnualLeaveDays = (startDate: string) => {
  const start = new Date(startDate);
  const now = new Date();
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (years < 5) return 14;
  if (years < 15) return 20;
  return 26;
};

export default function LeaveManagement() {
  const { selectedFirm } = useFirm();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    leave_type: 'annual' as 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  useEffect(() => { fetchData(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    let personnelQuery = supabase.from('personnel').select('*').eq('status', 'active').order('first_name');
    if (selectedFirm) personnelQuery = personnelQuery.eq('firm_id', selectedFirm.id);
    const { data: personnelData } = await personnelQuery;
    if (personnelData) setPersonnel(personnelData);

    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (leaveData) setLeaveRequests(leaveData);

    setLoading(false);
  };

  const calculateDays = () => {
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonnel) {
      setMessage({ type: 'error', text: 'Personel seçin!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const days = calculateDays();
    if (days <= 0) {
      setMessage({ type: 'error', text: 'Geçersiz tarih aralığı!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      const { error } = await supabase.from('leave_requests').insert({
        personnel_id: selectedPersonnel,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days,
        reason: formData.reason,
        status: 'pending',
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'İzin talebi oluşturuldu!' });
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Hata oluştu!' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleApprove = async (id: string) => {
    await supabase.from('leave_requests').update({ status: 'approved' }).eq('id', id);
    setMessage({ type: 'success', text: 'İzin onaylandı!' });
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const handleReject = async (id: string) => {
    await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', id);
    setMessage({ type: 'success', text: 'İzin reddedildi!' });
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      leave_type: 'annual',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: '',
    });
    setSelectedPersonnel('');
  };

  const getUsedLeaveDays = (personnelId: string) => {
    return leaveRequests
      .filter(l => l.personnel_id === personnelId && l.leave_type === 'annual' && l.status === 'approved')
      .reduce((s, l) => s + l.days, 0);
  };

  const getStatusLabel = (status: string) => ({
    pending: 'Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
  }[status] || status);

  const getStatusColor = (status: string) => ({
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
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
          <Calendar size={24} />
          İzin Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />İzin Talebi Oluştur
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Personel İzin Bakiyeleri */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Personel İzin Bakiyeleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="l-ad" className="text-left py-3 px-4">Ad Soyad</ResizableTh>
                <ResizableTh columnId="l-taseron" className="text-left py-3 px-4">Taşeron</ResizableTh>
                <ResizableTh columnId="l-giris" className="text-left py-3 px-4">İşe Giriş</ResizableTh>
                <ResizableTh columnId="l-hak" className="text-center py-3 px-4">Yıllık İzin Hakkı</ResizableTh>
                <ResizableTh columnId="l-kullanilan" className="text-center py-3 px-4">Kullanılan</ResizableTh>
                <ResizableTh columnId="l-kalan" className="text-center py-3 px-4">Kalan</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {personnel.map(p => {
                const annualDays = getAnnualLeaveDays(p.start_date);
                const usedDays = getUsedLeaveDays(p.id);
                const remaining = annualDays - usedDays;

                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="py-3 px-4">{p.taseron}</td>
                    <td className="py-3 px-4">{formatDateTR(p.start_date)}</td>
                    <td className="py-3 px-4 text-center">{annualDays} gün</td>
                    <td className="py-3 px-4 text-center">{usedDays} gün</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {remaining} gün
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* İzin Talepleri */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">İzin Talepleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="lt-ad" className="text-left py-3 px-4">Personel</ResizableTh>
                <ResizableTh columnId="lt-tur" className="text-left py-3 px-4">İzin Türü</ResizableTh>
                <ResizableTh columnId="lt-baslangic" className="text-left py-3 px-4">Başlangıç</ResizableTh>
                <ResizableTh columnId="lt-bitis" className="text-left py-3 px-4">Bitiş</ResizableTh>
                <ResizableTh columnId="lt-gun" className="text-center py-3 px-4">Gün</ResizableTh>
                <ResizableTh columnId="lt-sebep" className="text-left py-3 px-4">Sebep</ResizableTh>
                <ResizableTh columnId="lt-durum" className="text-center py-3 px-4">Durum</ResizableTh>
                <ResizableTh columnId="lt-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map(l => {
                const p = personnel.find(p => p.id === l.personnel_id);
                return (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{p ? `${p.first_name} ${p.last_name}` : '-'}</td>
                    <td className="py-3 px-4">{LEAVE_TYPES[l.leave_type]}</td>
                    <td className="py-3 px-4">{formatDateTR(l.start_date)}</td>
                    <td className="py-3 px-4">{formatDateTR(l.end_date)}</td>
                    <td className="py-3 px-4 text-center">{l.days}</td>
                    <td className="py-3 px-4 text-slate-600">{l.reason || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(l.status)}`}>
                        {getStatusLabel(l.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {l.status === 'pending' && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleApprove(l.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Onayla">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => handleReject(l.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reddet">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {leaveRequests.length === 0 && <p className="text-center py-8 text-slate-500">İzin talebi bulunamadı.</p>}
      </div>

      {/* İzin Talebi Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">İzin Talebi Oluştur</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Personel *</label>
                <select
                  value={selectedPersonnel}
                  onChange={(e) => setSelectedPersonnel(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Personel Seçin</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">İzin Türü</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  {Object.entries(LEAVE_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç</label>
                  <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bitiş</label>
                  <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gün Sayısı</label>
                <input type="text" value={`${calculateDays()} gün`} readOnly className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sebep</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
