import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Personnel } from '../types';
import { Calendar, Save, AlertTriangle, CheckCircle, Clock, Moon } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

export default function AttendancePage() {
  const { selectedFirm } = useFirm();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [attendanceData, setAttendanceData] = useState<Record<string, { overtime: number; holiday: number; missing: number }>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [selectedFirm, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    let personnelQuery = supabase.from('personnel').select('*').eq('status', 'active').order('first_name');
    if (selectedFirm) personnelQuery = personnelQuery.eq('firm_id', selectedFirm.id);
    const { data: personnelData } = await personnelQuery;
    if (personnelData) setPersonnel(personnelData);

    // Mevcut puantaj verilerini çek
    const startDate = `${selectedMonth}-01`;
    const endDate = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];
    
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    // Puantaj verilerini personel bazında topla
    const data: Record<string, { overtime: number; holiday: number; missing: number }> = {};
    (personnelData || []).forEach(p => {
      const records = (attendanceRecords || []).filter(a => a.personnel_id === p.id);
      data[p.id] = {
        overtime: records.reduce((s, r) => s + (r.overtime_hours || 0), 0),
        holiday: records.filter(r => r.is_holiday).reduce((s, r) => s + (r.overtime_hours || 0), 0),
        missing: records.reduce((s, r) => s + (r.missing_days || 0), 0),
      };
    });
    setAttendanceData(data);
    setLoading(false);
  };

  const handleOvertimeChange = (personnelId: string, value: number) => {
    setAttendanceData(prev => ({
      ...prev,
      [personnelId]: { ...prev[personnelId], overtime: value },
    }));
  };

  const handleHolidayChange = (personnelId: string, value: number) => {
    setAttendanceData(prev => ({
      ...prev,
      [personnelId]: { ...prev[personnelId], holiday: value },
    }));
  };

  const handleMissingChange = (personnelId: string, value: number) => {
    setAttendanceData(prev => ({
      ...prev,
      [personnelId]: { ...prev[personnelId], missing: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];

      for (const [personnelId, data] of Object.entries(attendanceData)) {
        // Mevcut kayıtları sil
        await supabase.from('attendance')
          .delete()
          .eq('personnel_id', personnelId)
          .gte('date', startDate)
          .lte('date', endDate);

        // Yeni kayıt ekle
        const totalOvertime = data.overtime + data.holiday;
        if (totalOvertime > 0 || data.missing > 0) {
          await supabase.from('attendance').insert({
            personnel_id: personnelId,
            date: endDate,
            overtime_hours: data.overtime,
            is_holiday: false,
            missing_days: data.missing,
            notes: data.holiday > 0 ? `Bayram/tatil mesai: ${data.holiday} saat` : '',
          });

          // Bayram mesaisi ayrı kayıt
          if (data.holiday > 0) {
            await supabase.from('attendance').insert({
              personnel_id: personnelId,
              date: endDate,
              overtime_hours: data.holiday,
              is_holiday: true,
              missing_days: 0,
              notes: 'Bayram/Resmi tatil mesai',
            });
          }
        }
      }

      setMessage({ type: 'success', text: 'Puantaj kaydedildi!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Kaydetme hatası!' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getMonthDays = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

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
          Puantaj{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
        <p className="text-sm text-blue-700">
          <strong>Ay:</strong> {selectedMonth} ({getMonthDays()} gün) |
          <strong> Mesai:</strong> Normal mesai saatleri (1.5x) |
          <strong> Bayram/Tatil:</strong> Bayram ve resmi tatil mesai saatleri (2x) |
          <strong> Eksik Gün:</strong> Çalışılmayan gün sayısı
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="a-tc" className="text-left py-3 px-4">TC No</ResizableTh>
                <ResizableTh columnId="a-ad" className="text-left py-3 px-4">Ad Soyad</ResizableTh>
                <ResizableTh columnId="a-taseron" className="text-left py-3 px-4">Taşeron</ResizableTh>
                <ResizableTh columnId="a-maas" className="text-right py-3 px-4">Brüt Maaş</ResizableTh>
                <ResizableTh columnId="a-mesai" className="text-center py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    <Clock size={14} />
                    Normal Mesai (Saat)
                  </div>
                </ResizableTh>
                <ResizableTh columnId="a-bayram" className="text-center py-3 px-4">
                  <div className="flex items-center justify-center gap-1">
                    <Moon size={14} />
                    Bayram/Tatil (Saat)
                  </div>
                </ResizableTh>
                <ResizableTh columnId="a-eksik" className="text-center py-3 px-4">Eksik Gün</ResizableTh>
                <ResizableTh columnId="a-tutar" className="text-right py-3 px-4">Mesai Tutarı</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {personnel.map(p => {
                const data = attendanceData[p.id] || { overtime: 0, holiday: 0, missing: 0 };
                const dailyRate = (p.gross_salary || 0) / 30;
                const hourlyRate = dailyRate / 8;
                const overtimePay = data.overtime * hourlyRate * 1.5;
                const holidayPay = data.holiday * hourlyRate * 2;
                const totalOvertimePay = overtimePay + holidayPay;

                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono">{p.tc_number}</td>
                    <td className="py-3 px-4 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="py-3 px-4">{p.taseron}</td>
                    <td className="py-3 px-4 text-right">{p.gross_salary ? formatCurrency(p.gross_salary) : '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={data.overtime}
                        onChange={(e) => handleOvertimeChange(p.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                        min="0"
                        step="0.5"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={data.holiday}
                        onChange={(e) => handleHolidayChange(p.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                        min="0"
                        step="0.5"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={data.missing}
                        onChange={(e) => handleMissingChange(p.id, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                        min="0"
                        max="31"
                        step="1"
                      />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600">
                      {totalOvertimePay > 0 ? formatCurrency(totalOvertimePay) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={3} className="py-3 px-4">TOPLAM</td>
                <td className="py-3 px-4 text-right">{formatCurrency(personnel.reduce((s, p) => s + (p.gross_salary || 0), 0))}</td>
                <td className="py-3 px-4 text-center">{Object.values(attendanceData).reduce((s, d) => s + d.overtime, 0)}</td>
                <td className="py-3 px-4 text-center">{Object.values(attendanceData).reduce((s, d) => s + d.holiday, 0)}</td>
                <td className="py-3 px-4 text-center">{Object.values(attendanceData).reduce((s, d) => s + d.missing, 0)}</td>
                <td className="py-3 px-4 text-right text-blue-600">
                  {formatCurrency(personnel.reduce((s, p) => {
                    const data = attendanceData[p.id] || { overtime: 0, holiday: 0, missing: 0 };
                    const hourlyRate = ((p.gross_salary || 0) / 30 / 8);
                    return s + (data.overtime * hourlyRate * 1.5) + (data.holiday * hourlyRate * 2);
                  }, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {personnel.length === 0 && <p className="text-center py-8 text-slate-500">Personel bulunamadı.</p>}
      </div>
    </div>
  );
}
