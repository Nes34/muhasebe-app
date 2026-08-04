import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Personnel, SeveranceCalculation } from '../types';
import { Calculator, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

const SEVERANCE_CEILING_2024 = 23418.52;

const NOTICE_WEEKS = [
  { maxYears: 0.5, weeks: 2 },
  { maxYears: 1.5, weeks: 4 },
  { maxYears: 3, weeks: 6 },
  { maxYears: Infinity, weeks: 8 },
];

export default function SeverancePage() {
  const { selectedFirm } = useFirm();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [calculations, setCalculations] = useState<SeveranceCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState('');
  const [calcType, setCalcType] = useState<'severance' | 'notice'>('severance');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [result, setResult] = useState<{
    years: number;
    dailyRate: number;
    totalDays: number;
    amount: number;
    ceiling: number;
  } | null>(null);

  useEffect(() => { fetchData(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    let personnelQuery = supabase.from('personnel').select('*').order('first_name');
    if (selectedFirm) personnelQuery = personnelQuery.eq('firm_id', selectedFirm.id);
    const { data: personnelData } = await personnelQuery;
    if (personnelData) setPersonnel(personnelData);

    const { data: calcData } = await supabase
      .from('severance_calculations')
      .select('*')
      .order('created_at', { ascending: false });
    if (calcData) setCalculations(calcData);

    setLoading(false);
  };

  const calculate = () => {
    const p = personnel.find(p => p.id === selectedPersonnel);
    if (!p) return;

    const startDate = new Date(p.start_date);
    const endDate = new Date();
    const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const grossSalary = p.gross_salary || 0;
    const dailyRate = grossSalary / 30;

    if (calcType === 'severance') {
      // Kıdem tazminatı: Her tam yıl için 30 günlük brüt ücret
      const fullYears = Math.floor(years);
      const totalDays = fullYears * 30;
      let amount = dailyRate * totalDays;

      // Tavan kontrolü
      const ceiling = SEVERANCE_CEILING_2024 * totalDays;
      const finalAmount = Math.min(amount, ceiling);

      setResult({
        years: fullYears,
        dailyRate,
        totalDays,
        amount: finalAmount,
        ceiling: amount > ceiling ? ceiling : 0,
      });
    } else {
      // İhbar tazminatı: Çalışma süresine göre 2-8 hafta
      let weeks = 8;
      for (const bracket of NOTICE_WEEKS) {
        if (years <= bracket.maxYears) {
          weeks = bracket.weeks;
          break;
        }
      }

      const totalDays = weeks * 7;
      const amount = dailyRate * totalDays;

      setResult({
        years,
        dailyRate,
        totalDays,
        amount,
        ceiling: 0,
      });
    }
  };

  const handleSave = async () => {
    if (!result || !selectedPersonnel) return;

    const p = personnel.find(p => p.id === selectedPersonnel);
    if (!p) return;

    try {
      const { error } = await supabase.from('severance_calculations').insert({
        personnel_id: selectedPersonnel,
        calculation_type: calcType,
        calculation_date: new Date().toISOString().split('T')[0],
        start_date: p.start_date,
        end_date: new Date().toISOString().split('T')[0],
        years_worked: result.years,
        gross_salary: p.gross_salary || 0,
        daily_rate: result.dailyRate,
        total_days: result.totalDays,
        total_amount: result.amount,
        ceiling_amount: result.ceiling > 0 ? result.ceiling : null,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Hesaplama kaydedildi!' });
      setShowForm(false);
      setResult(null);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Kaydetme hatası!' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const getCalcTypeLabel = (type: string) => ({
    severance: 'Kıdem Tazminatı',
    notice: 'İhbar Tazminatı',
  }[type] || type);

  const getYearsWorked = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    return ((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
  };

  // Yılını dolduran personeller
  const yearCompleted = personnel.filter(p => {
    const years = parseFloat(getYearsWorked(p.start_date));
    return years >= 1 && p.status === 'active';
  });

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
          <Calculator size={24} />
          Kıdem/İhbar Hesaplama{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <button
          onClick={() => { setResult(null); setSelectedPersonnel(''); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Calculator size={16} />Yeni Hesaplama
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Yılını Dolduran Personeller Uyarısı */}
      {yearCompleted.length > 0 && (
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-orange-600" />
            <h3 className="font-semibold text-orange-800">Yılını Dolduran Personeller</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {yearCompleted.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <div>
                  <p className="font-medium text-sm">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-slate-500">{getYearsWorked(p.start_date)} yıl</p>
                </div>
                <button
                  onClick={() => { setSelectedPersonnel(p.id); setCalcType('severance'); setShowForm(true); calculate(); }}
                  className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Hesapla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Son Hesaplamalar */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Son Hesaplamalar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="s-ad" className="text-left py-3 px-4">Personel</ResizableTh>
                <ResizableTh columnId="s-tur" className="text-left py-3 px-4">Tür</ResizableTh>
                <ResizableTh columnId="s-tarih" className="text-left py-3 px-4">Hesaplama Tarihi</ResizableTh>
                <ResizableTh columnId="s-yil" className="text-center py-3 px-4">Çalışma Yılı</ResizableTh>
                <ResizableTh columnId="s-gun" className="text-center py-3 px-4">Toplam Gün</ResizableTh>
                <ResizableTh columnId="s-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {calculations.map(c => {
                const p = personnel.find(p => p.id === c.personnel_id);
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{p ? `${p.first_name} ${p.last_name}` : '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.calculation_type === 'severance' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {getCalcTypeLabel(c.calculation_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{formatDateTR(c.calculation_date)}</td>
                    <td className="py-3 px-4 text-center">{c.years_worked}</td>
                    <td className="py-3 px-4 text-center">{c.total_days}</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">{formatCurrency(c.total_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {calculations.length === 0 && <p className="text-center py-8 text-slate-500">Henüz hesaplama yapılmadı.</p>}
      </div>

      {/* Hesaplama Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Kıdem/İhbar Hesaplama</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Personel *</label>
                <select
                  value={selectedPersonnel}
                  onChange={(e) => { setSelectedPersonnel(e.target.value); setResult(null); }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Personel Seçin</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({getYearsWorked(p.start_date)} yıl)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hesaplama Türü</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCalcType('severance'); setResult(null); }}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${calcType === 'severance' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    Kıdem Tazminatı
                  </button>
                  <button
                    onClick={() => { setCalcType('notice'); setResult(null); }}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${calcType === 'notice' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    İhbar Tazminatı
                  </button>
                </div>
              </div>
              <button
                onClick={calculate}
                disabled={!selectedPersonnel}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Calculator size={16} />Hesapla
              </button>

              {result && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Çalışma Süresi:</span>
                    <span className="font-medium">{result.years} {calcType === 'severance' ? 'tam yıl' : 'yıl'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Günlük Ücret:</span>
                    <span className="font-medium">{formatCurrency(result.dailyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Toplam Gün:</span>
                    <span className="font-medium">{result.totalDays} gün</span>
                  </div>
                  {result.ceiling > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Tavan Uygulandı:</span>
                      <span className="font-medium">{formatCurrency(result.ceiling)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-green-600 pt-2 border-t border-slate-200">
                    <span>Toplam Tutar:</span>
                    <span>{formatCurrency(result.amount)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setResult(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                {result && (
                  <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <Save size={16} />Kaydet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
