import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { Personnel, PayrollPeriod } from '../types';
import { FileText, Save, AlertTriangle, CheckCircle, Calculator, RefreshCw } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

const MINIMUM_WAGE_2024 = 20002.50;
const SGK_EMPLOYEE_RATE = 0.14;
const STAMP_TAX_RATE = 0.00759;

const INCOME_TAX_BRACKETS = [
  { limit: 110000, rate: 0.15 },
  { limit: 230000, rate: 0.20 },
  { limit: 870000, rate: 0.27 },
  { limit: Infinity, rate: 0.35 },
];

interface PayrollRow {
  personnel: Personnel;
  overtime_pay: number;
  holiday_overtime_pay: number;
  missing_deduction: number;
  sgk_employee: number;
  income_tax: number;
  stamp_tax: number;
  total_deductions: number;
  net_pay: number;
}

export default function PayrollPage() {
  const { selectedFirm } = useFirm();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [minimumWage, setMinimumWage] = useState(MINIMUM_WAGE_2024);

  useEffect(() => { fetchData(); }, [selectedFirm, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    let personnelQuery = supabase.from('personnel').select('*').eq('status', 'active').order('first_name');
    if (selectedFirm) personnelQuery = personnelQuery.eq('firm_id', selectedFirm.id);
    const { data: personnelData } = await personnelQuery;
    if (personnelData) setPersonnel(personnelData);

    // Mevcut asgari ücreti kontrol et
    const { data: wageData } = await supabase
      .from('minimum_wage_history')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1);
    
    if (wageData && wageData.length > 0) {
      setMinimumWage(wageData[0].gross_amount);
    }

    setLoading(false);
  };

  const calculatePayroll = async () => {
    setCalculating(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).toISOString().split('T')[0];

      // Puantaj verilerini çek
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const rows: PayrollRow[] = personnel.map(p => {
        const records = (attendanceRecords || []).filter(a => a.personnel_id === p.id);
        const normalOvertime = records.filter(r => !r.is_holiday).reduce((s, r) => s + (r.overtime_hours || 0), 0);
        const holidayOvertime = records.filter(r => r.is_holiday).reduce((s, r) => s + (r.overtime_hours || 0), 0);
        const missingDays = records.reduce((s, r) => s + (r.missing_days || 0), 0);

        const grossSalary = p.gross_salary || 0;
        const dailyRate = grossSalary / 30;
        const hourlyRate = dailyRate / 8;

        // Mesai hesaplama
        const overtimePay = normalOvertime * hourlyRate * 1.5;
        const holidayOvertimePay = holidayOvertime * hourlyRate * 2;

        // Eksik gün kesintisi
        const missingDeduction = missingDays * dailyRate;

        // SGK kesintisi (%14)
        const sgkEmployee = grossSalary * SGK_EMPLOYEE_RATE;

        // Gelir vergisi matrahı
        const taxBase = grossSalary - sgkEmployee;

        // Gelir vergisi hesaplama (dilim bazlı)
        let incomeTax = 0;
        let remaining = taxBase;
        for (const bracket of INCOME_TAX_BRACKETS) {
          if (remaining <= 0) break;
          const taxable = Math.min(remaining, bracket.limit);
          incomeTax += taxable * bracket.rate;
          remaining -= taxable;
        }

        // Damga vergisi
        const stampTax = grossSalary * STAMP_TAX_RATE;

        // Toplam kesintiler
        const totalDeductions = sgkEmployee + incomeTax + stampTax + missingDeduction;

        // Net maaş
        const netPay = grossSalary + overtimePay + holidayOvertimePay - totalDeductions;

        return {
          personnel: p,
          overtime_pay: overtimePay,
          holiday_overtime_pay: holidayOvertimePay,
          missing_deduction: missingDeduction,
          sgk_employee: sgkEmployee,
          income_tax: incomeTax,
          stamp_tax: stampTax,
          total_deductions: totalDeductions,
          net_pay: netPay,
        };
      });

      setPayrollRows(rows);
    } catch (err) {
      setMessage({ type: 'error', text: 'Hesaplama hatası!' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Bordro dönemini oluştur veya bul
      const [year, month] = selectedMonth.split('-').map(Number);
      let period: PayrollPeriod;

      const { data: existingPeriod } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('firm_id', selectedFirm?.id || '')
        .eq('year', year)
        .eq('month', month)
        .single();

      if (existingPeriod) {
        period = existingPeriod;
      } else {
        const { data: newPeriod, error } = await supabase
          .from('payroll_periods')
          .insert({
            firm_id: selectedFirm?.id || null,
            year,
            month,
            minimum_wage: minimumWage,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;
        period = newPeriod;
      }

      // Bordro kayıtlarını kaydet
      for (const row of payrollRows) {
        await supabase.from('payrolls').upsert({
          personnel_id: row.personnel.id,
          period_id: period.id,
          firm_id: selectedFirm?.id || null,
          gross_salary: row.personnel.gross_salary || 0,
          net_salary: row.personnel.net_salary || 0,
          overtime_hours: 0,
          overtime_pay: row.overtime_pay,
          holiday_overtime_hours: 0,
          holiday_overtime_pay: row.holiday_overtime_pay,
          missing_days: 0,
          missing_deduction: row.missing_deduction,
          bonus: 0,
          advance_deduction: 0,
          sgk_employee: row.sgk_employee,
          income_tax: row.income_tax,
          stamp_tax: row.stamp_tax,
          total_deductions: row.total_deductions,
          net_pay: row.net_pay,
          status: 'draft',
        }, { onConflict: 'personnel_id,period_id' });
      }

      setMessage({ type: 'success', text: 'Bordro kaydedildi!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Kaydetme hatası!' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateMinimumWage = async () => {
    const newWage = prompt('Yeni asgari ücret tutarını girin (brüt):', minimumWage.toString());
    if (!newWage) return;

    const amount = parseFloat(newWage);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Geçersiz tutar!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    await supabase.from('minimum_wage_history').upsert({
      year,
      month,
      gross_amount: amount,
      net_amount: amount * 0.85, // Yaklaşık net
      effective_date: `${selectedMonth}-01`,
    }, { onConflict: 'year,month' });

    setMinimumWage(amount);
    setMessage({ type: 'success', text: 'Asgari ücret güncellendi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const totalGross = payrollRows.reduce((s, r) => s + (r.personnel.gross_salary || 0), 0);
  const totalOvertime = payrollRows.reduce((s, r) => s + r.overtime_pay + r.holiday_overtime_pay, 0);
  const totalMissing = payrollRows.reduce((s, r) => s + r.missing_deduction, 0);
  const totalSGK = payrollRows.reduce((s, r) => s + r.sgk_employee, 0);
  const totalIncomeTax = payrollRows.reduce((s, r) => s + r.income_tax, 0);
  const totalStampTax = payrollRows.reduce((s, r) => s + r.stamp_tax, 0);
  const totalDeductions = payrollRows.reduce((s, r) => s + r.total_deductions, 0);
  const totalNet = payrollRows.reduce((s, r) => s + r.net_pay, 0);

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
          <FileText size={24} />
          Bordro Hazırlama{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={updateMinimumWage}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <RefreshCw size={16} />
            Asgari Ücret: {formatCurrency(minimumWage)}
          </button>
          <button
            onClick={calculatePayroll}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Calculator size={16} />
            {calculating ? 'Hesaplanıyor...' : 'Hesapla'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || payrollRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
          <strong>Ay:</strong> {selectedMonth} |
          <strong> Asgari Ücret:</strong> {formatCurrency(minimumWage)} |
          <strong> SGK:</strong> %14 |
          <strong> Damga Vergisi:</strong> %0.759 |
          <strong> Mesai:</strong> Normal 1.5x, Bayram/Tatil 2x
        </p>
      </div>

      {payrollRows.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <ResizableTh columnId="b-ad" className="text-left py-3 px-4">Ad Soyad</ResizableTh>
                  <ResizableTh columnId="b-brut" className="text-right py-3 px-4">Brüt Maaş</ResizableTh>
                  <ResizableTh columnId="b-mesai" className="text-right py-3 px-4">Mesai</ResizableTh>
                  <ResizableTh columnId="b-bayram" className="text-right py-3 px-4">Bayram Mesai</ResizableTh>
                  <ResizableTh columnId="b-eksik" className="text-right py-3 px-4">Eksik Kesinti</ResizableTh>
                  <ResizableTh columnId="b-sgk" className="text-right py-3 px-4">SGK %14</ResizableTh>
                  <ResizableTh columnId="b-gv" className="text-right py-3 px-4">Gelir Vergisi</ResizableTh>
                  <ResizableTh columnId="b-dv" className="text-right py-3 px-4">Damga Vergisi</ResizableTh>
                  <ResizableTh columnId="b-toplam" className="text-right py-3 px-4">Toplam Kesinti</ResizableTh>
                  <ResizableTh columnId="b-net" className="text-right py-3 px-4 font-bold">Net Maaş</ResizableTh>
                </tr>
              </thead>
              <tbody>
                {payrollRows.map(row => (
                  <tr key={row.personnel.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{row.personnel.first_name} {row.personnel.last_name}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.personnel.gross_salary || 0)}</td>
                    <td className="py-3 px-4 text-right text-blue-600">{row.overtime_pay > 0 ? formatCurrency(row.overtime_pay) : '-'}</td>
                    <td className="py-3 px-4 text-right text-purple-600">{row.holiday_overtime_pay > 0 ? formatCurrency(row.holiday_overtime_pay) : '-'}</td>
                    <td className="py-3 px-4 text-right text-red-600">{row.missing_deduction > 0 ? formatCurrency(row.missing_deduction) : '-'}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.sgk_employee)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.income_tax)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.stamp_tax)}</td>
                    <td className="py-3 px-4 text-right text-red-600">{formatCurrency(row.total_deductions)}</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">{formatCurrency(row.net_pay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td className="py-3 px-4">TOPLAM</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totalGross)}</td>
                  <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(totalOvertime)}</td>
                  <td className="py-3 px-4 text-right"></td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(totalMissing)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totalSGK)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totalIncomeTax)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totalStampTax)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(totalDeductions)}</td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calculator size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Bordro hesaplamak için "Hesapla" butonuna tıklayın.</p>
        </div>
      )}
    </div>
  );
}
