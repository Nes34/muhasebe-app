import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR, parseDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import {
  TrendingUp, TrendingDown, Wallet, Building2, FileCheck, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, X, BarChart3, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

type FilterType = 'income' | 'expense' | 'profitLoss' | 'cash' | 'bank' | 'pending_given' | 'urgent_given' | 'paid_checks' | 'pending_received' | 'urgent_received' | 'collected_checks' | null;

interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  totalCash: number;
  totalBank: number;
  pendingGiven: number;
  urgentGiven: number;
  paidChecks: number;
  paidChecksAmount: number;
  pendingReceived: number;
  urgentReceived: number;
  collectedChecks: number;
  collectedChecksAmount: number;
  profitLoss: number;
}

interface DailyData {
  date: string;
  income: number;
  expense: number;
}

export default function Dashboard() {
  const { selectedFirm, selectedProject } = useFirm();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalIncome: 0, totalExpense: 0, totalCash: 0, totalBank: 0, pendingGiven: 0, urgentGiven: 0, paidChecks: 0, paidChecksAmount: 0, pendingReceived: 0, urgentReceived: 0, collectedChecks: 0, collectedChecksAmount: 0, profitLoss: 0 });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [filterData, setFilterData] = useState<any[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  // Filtre detayları için state'ler
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [cashData, setCashData] = useState<any[]>([]);
  const [bankData, setBankData] = useState<any[]>([]);
  const [pendingCheckData, setPendingCheckData] = useState<any[]>([]);
  const [urgentCheckData, setUrgentCheckData] = useState<any[]>([]);
  const [paidCheckData, setPaidCheckData] = useState<any[]>([]);
  const [pendingReceivedData, setPendingReceivedData] = useState<any[]>([]);
  const [urgentReceivedData, setUrgentReceivedData] = useState<any[]>([]);
  const [collectedCheckData, setCollectedCheckData] = useState<any[]>([]);

  useEffect(() => { fetchDashboardStats(); }, [selectedFirm, selectedProject]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      // Tüm transactions
      let txQ = supabase.from('transactions').select('amount, transaction_type, transaction_date, is_exception, firm:firms(name), project_id');
      if (selectedFirm) txQ = txQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) txQ = txQ.eq('project_id', selectedProject.id);
      const { data: allTx } = await txQ.eq('is_exception', false);

      // Son 7 gün transactions
      let weekTxQ = supabase
        .from('transactions')
        .select('amount, transaction_type, transaction_date, is_exception, firm:firms(name), project_id')
        .gte('transaction_date', sevenDaysAgo.toISOString().split('T')[0])
        .eq('is_exception', false);
      if (selectedFirm) weekTxQ = weekTxQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) weekTxQ = weekTxQ.eq('project_id', selectedProject.id);
      const { data: weekTx } = await weekTxQ;

      // Günlük veriler
      const dailyMap = new Map<string, DailyData>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { date: dateStr, income: 0, expense: 0 });
      }

      // Transfer tipleri gelir/gider olarak sayılmaz (iç transfer)
      const transferTypes = ['transfer', 'stock_transfer', 'cash_transfer', 'bank_transfer'];

      (weekTx as any[] || []).forEach((t: any) => {
        const day = dailyMap.get(t.transaction_date);
        if (day) {
          if (transferTypes.includes(t.transaction_type)) {
            // Transferler gelir/gider olarak sayılmaz
          } else if (['income', 'invoice', 'sale_invoice'].includes(t.transaction_type)) {
            day.income += t.amount;
          } else {
            day.expense += t.amount;
          }
        }
      });

      setDailyData(Array.from(dailyMap.values()));

      // Kasa (junction tablo ile)
      const { data: allCash } = await supabase.from('cash_registers').select('*').eq('is_active', true);
      let cash = allCash;
      if (selectedFirm && allCash && allCash.length > 0) {
        const { data: crfLinks } = await supabase.from('cash_register_firms').select('cash_register_id').eq('firm_id', selectedFirm.id);
        const allowedIds = (crfLinks || []).map((l: any) => l.cash_register_id);
        cash = allCash.filter((c: any) => allowedIds.includes(c.id));
      }

      // Banka (junction tablo ile)
      const { data: allBank } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
      let bank = allBank;
      if (selectedFirm && allBank && allBank.length > 0) {
        const { data: bafLinks } = await supabase.from('bank_account_firms').select('bank_account_id').eq('firm_id', selectedFirm.id);
        const allowedIds = (bafLinks || []).map((l: any) => l.bank_account_id);
        bank = allBank.filter((b: any) => allowedIds.includes(b.id));
      }

      // Banka bakiyelerini normal işlemlerden hesapla (otomatik çek ödemeleri hariç)
      if (bank && bank.length > 0) {
        const bIds = bank.map((b: any) => b.id);
        const { data: bankTx } = await supabase.from('bank_transactions').select('bank_account_id, amount, transaction_type, description').in('bank_account_id', bIds);
        bank = bank.map((b: any) => {
          const normalTx = (bankTx || []).filter((t: any) => t.bank_account_id === b.id && !t.description?.includes('(Otomatik)'));
          const txIn = normalTx.filter((t: any) => t.transaction_type === 'in').reduce((s: number, t: any) => s + t.amount, 0);
          const txOut = normalTx.filter((t: any) => t.transaction_type === 'out').reduce((s: number, t: any) => s + t.amount, 0);
          return { ...b, current_balance: (b.opening_balance || 0) + txIn - txOut };
        });
      }

      // Toplam gelir/gider (transactions + bağımsız kasa/banka)
      let totalIncome = 0;
      let totalExpense = 0;
      const incomeList: any[] = [];
      const expenseList: any[] = [];

      (allTx || []).forEach((t: any) => {
        if (transferTypes.includes(t.transaction_type)) {
          // Transferler gelir/gider olarak sayılmaz
        } else if (['income', 'invoice', 'sale_invoice'].includes(t.transaction_type)) {
          totalIncome += t.amount;
          incomeList.push({ ...t, _type: 'income' });
        } else {
          totalExpense += t.amount;
          expenseList.push({ ...t, _type: 'expense' });
        }
      });

      // Bağımsız kasa/banka işlemleri (transaction_id olmayanlar — mükerrer önlemek için)
      // Proje seçiliyse project_id ile filtrele, değilse register/bank ile filtrele
      let cashTxQuery = supabase.from('cash_transactions').select('amount, transaction_type, created_at, project_id, cari:cariler(name)').is('transaction_id', null);
      let bankTxQuery = supabase.from('bank_transactions').select('amount, transaction_type, created_at, project_id, cari:cariler(name)').is('transaction_id', null);

      if (selectedProject) {
        cashTxQuery = cashTxQuery.eq('project_id', selectedProject.id);
        bankTxQuery = bankTxQuery.eq('project_id', selectedProject.id);
      } else {
        const cashIds = (cash || []).map((c: any) => c.id);
        const bankIds = (bank || []).map((b: any) => b.id);
        if (cashIds.length > 0) cashTxQuery = cashTxQuery.in('cash_register_id', cashIds);
        if (bankIds.length > 0) bankTxQuery = bankTxQuery.in('bank_account_id', bankIds);
      }

      const [cashTxRes, bankTxRes] = await Promise.all([cashTxQuery, bankTxQuery]);

      (cashTxRes.data || []).forEach((t: any) => {
        const item = { ...t, transaction_date: t.created_at?.split('T')[0], description: `Kasa - ${t.cari?.name || ''}`, source: 'cash', _type: 'income' as const };
        if (t.transaction_type === 'in') { totalIncome += t.amount; incomeList.push(item); }
        else { totalExpense += t.amount; expenseList.push({ ...item, _type: 'expense' }); }
      });

      (bankTxRes.data || []).forEach((t: any) => {
        const item = { ...t, transaction_date: t.created_at?.split('T')[0], description: `Banka - ${t.cari?.name || ''}`, source: 'bank', _type: 'income' as const };
        if (t.transaction_type === 'in') { totalIncome += t.amount; incomeList.push(item); }
        else { totalExpense += t.amount; expenseList.push({ ...item, _type: 'expense' }); }
      });

      // Açılış bakiyelerini gelir/gidere ekle
      (cash || []).forEach((c: any) => {
        if (c.opening_balance > 0) { totalIncome += c.opening_balance; incomeList.push({ description: `Kasa Açılış - ${c.name}`, amount: c.opening_balance, transaction_date: '', source: 'cash_opening', _type: 'income' }); }
        else if (c.opening_balance < 0) { totalExpense += Math.abs(c.opening_balance); expenseList.push({ description: `Kasa Açılış - ${c.name}`, amount: Math.abs(c.opening_balance), transaction_date: '', source: 'cash_opening', _type: 'expense' }); }
      });
      (bank || []).forEach((b: any) => {
        if (b.opening_balance > 0) { totalIncome += b.opening_balance; incomeList.push({ description: `Banka Açılış - ${b.bank_name}`, amount: b.opening_balance, transaction_date: '', source: 'bank_opening', _type: 'income' }); }
        else if (b.opening_balance < 0) { totalExpense += Math.abs(b.opening_balance); expenseList.push({ description: `Banka Açılış - ${b.bank_name}`, amount: Math.abs(b.opening_balance), transaction_date: '', source: 'bank_opening', _type: 'expense' }); }
      });

      setIncomeData(incomeList);
      setExpenseData(expenseList);

      // Proje seçiliyse kasa/banka verilerini proje bazlı hesapla
      if (selectedProject) {
        const projCashIn = (cashTxRes.data || []).filter((t: any) => t.transaction_type === 'in').reduce((s: number, t: any) => s + t.amount, 0);
        const projCashOut = (cashTxRes.data || []).filter((t: any) => t.transaction_type === 'out').reduce((s: number, t: any) => s + t.amount, 0);
        const projBankIn = (bankTxRes.data || []).filter((t: any) => t.transaction_type === 'in').reduce((s: number, t: any) => s + t.amount, 0);
        const projBankOut = (bankTxRes.data || []).filter((t: any) => t.transaction_type === 'out').reduce((s: number, t: any) => s + t.amount, 0);
        setCashData([{ name: 'Proje Kasa', cash_in: projCashIn, cash_out: projCashOut, net: projCashIn - projCashOut }]);
        setBankData([{ name: 'Proje Banka', bank_in: projBankIn, bank_out: projBankOut, net: projBankIn - projBankOut }]);
      } else {
        setCashData(cash || []);
        setBankData(bank || []);
      }

      // Verilen çekler - bekleyen
      let givenPendingQ = supabase.from('checks').select('*').eq('status', 'pending').eq('check_type', 'given').order('due_date');
      if (selectedFirm) givenPendingQ = givenPendingQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) givenPendingQ = givenPendingQ.eq('project_id', selectedProject.id);
      const { data: pendingGivenRaw } = await givenPendingQ;

      const fiveDaysLater = new Date(today);
      fiveDaysLater.setDate(today.getDate() + 5);

      // Tüm çeklerden cari_id'leri topla ve carileri çek
      const allCheckData = [...(pendingGivenRaw || [])];
      let paidCheckQ = supabase.from('checks').select('*').eq('status', 'paid').eq('check_type', 'given').order('created_at', { ascending: false });
      if (selectedFirm) paidCheckQ = paidCheckQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) paidCheckQ = paidCheckQ.eq('project_id', selectedProject.id);
      const { data: paidChecksRaw } = await paidCheckQ;
      allCheckData.push(...(paidChecksRaw || []));

      let receivedPendingQ = supabase.from('checks').select('*').eq('status', 'pending').eq('check_type', 'received').order('due_date');
      if (selectedFirm) receivedPendingQ = receivedPendingQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) receivedPendingQ = receivedPendingQ.eq('project_id', selectedProject.id);
      const { data: pendingReceivedRaw } = await receivedPendingQ;
      allCheckData.push(...(pendingReceivedRaw || []));

      let collectedCheckQ = supabase.from('checks').select('*').eq('status', 'collected').eq('check_type', 'received').order('created_at', { ascending: false });
      if (selectedFirm) collectedCheckQ = collectedCheckQ.eq('firm_id', selectedFirm.id);
      if (selectedProject) collectedCheckQ = collectedCheckQ.eq('project_id', selectedProject.id);
      const { data: collectedChecksRaw } = await collectedCheckQ;
      allCheckData.push(...(collectedChecksRaw || []));

      // Cari ve firma isimlerini çek
      const cariIds = [...new Set(allCheckData.map(c => c.cari_id).filter(Boolean))];
      const firmIds = [...new Set(allCheckData.map(c => c.firm_id).filter(Boolean))];
      const [cariRes, firmRes] = await Promise.all([
        cariIds.length > 0 ? supabase.from('cariler').select('id, name, code').in('id', cariIds) : { data: [] },
        firmIds.length > 0 ? supabase.from('firms').select('id, name').in('id', firmIds) : { data: [] },
      ]);
      const cariMap: Record<string, any> = {};
      cariRes.data?.forEach((c: any) => { cariMap[c.id] = c; });
      const firmMap: Record<string, any> = {};
      firmRes.data?.forEach((f: any) => { firmMap[f.id] = f; });

      const enrichChecks = (data: any[]) => data.map(c => ({ ...c, cari: cariMap[c.cari_id] || null, firm: firmMap[c.firm_id] || null }));

      const pendingGiven = enrichChecks(pendingGivenRaw || []);
      const urgentGiven = pendingGiven.filter((c: any) => {
        const dueDate = parseDateTR(c.due_date) || new Date(c.due_date);
        return dueDate <= fiveDaysLater;
      });
      setPendingCheckData(pendingGiven);
      setUrgentCheckData(urgentGiven);

      setPaidCheckData(enrichChecks(paidChecksRaw || []));
      const paidAmount = (paidChecksRaw || []).reduce((sum: number, c: any) => sum + c.amount, 0);

      const pendingReceived = enrichChecks(pendingReceivedRaw || []);
      const urgentReceived = pendingReceived.filter((c: any) => {
        const dueDate = parseDateTR(c.due_date) || new Date(c.due_date);
        return dueDate <= fiveDaysLater;
      });
      setPendingReceivedData(pendingReceived);
      setUrgentReceivedData(urgentReceived);

      setCollectedCheckData(enrichChecks(collectedChecksRaw || []));
      const collectedAmount = (collectedChecksRaw || []).reduce((sum: number, c: any) => sum + c.amount, 0);

      // Proje bazlı kasa/banka toplamları
      const projCashIn = (cashTxRes.data || []).filter((t: any) => t.transaction_type === 'in').reduce((s: number, t: any) => s + t.amount, 0);
      const projBankIn = (bankTxRes.data || []).filter((t: any) => t.transaction_type === 'in').reduce((s: number, t: any) => s + t.amount, 0);

      setStats({
        totalIncome,
        totalExpense,
        totalCash: selectedProject ? projCashIn : (cash || []).reduce((sum: number, c: any) => sum + c.current_balance, 0),
        totalBank: selectedProject ? projBankIn : (bank || []).reduce((sum: number, b: any) => sum + b.current_balance, 0),
        pendingGiven: (pendingGiven || []).length,
        urgentGiven: urgentGiven.length,
        paidChecks: (paidChecksRaw || []).length,
        paidChecksAmount: paidAmount,
        pendingReceived: (pendingReceived || []).length,
        urgentReceived: urgentReceived.length,
        collectedChecks: (collectedChecksRaw || []).length,
        collectedChecksAmount: collectedAmount,
        profitLoss: totalIncome - totalExpense,
      });
    } catch (error) {
      console.error('Dashboard hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = (filter: FilterType) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
      setFilterData([]);
      return;
    }

    setActiveFilter(filter);
    setFilterLoading(true);

    switch (filter) {
      case 'income': setFilterData(incomeData); break;
      case 'expense': setFilterData(expenseData); break;
      case 'profitLoss': setFilterData([...incomeData, ...expenseData].sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())); break;
      case 'cash': setFilterData(cashData); break;
      case 'bank': setFilterData(bankData); break;
      case 'pending_given': setFilterData(pendingCheckData); break;
      case 'urgent_given': setFilterData(urgentCheckData); break;
      case 'paid_checks': setFilterData(paidCheckData); break;
      case 'pending_received': setFilterData(pendingReceivedData); break;
      case 'urgent_received': setFilterData(urgentReceivedData); break;
      case 'collected_checks': setFilterData(collectedCheckData); break;
    }
    setFilterLoading(false);
  };

  const getFilterTitle = () => {
    const titles: Record<string, string> = {
      income: 'Gelir İşlemleri',
      expense: 'Gider İşlemleri',
      profitLoss: 'Kâr/Zarar Detayı',
      cash: 'Kasa Hesapları',
      bank: 'Banka Hesapları',
      pending_given: 'Bekleyen Verilen Çekler',
      urgent_given: 'Vadesi Yaklaşan Verilen Çekler',
      paid_checks: 'Ödenen Çekler',
      pending_received: 'Bekleyen Alınan Çekler',
      urgent_received: 'Vadesi Yaklaşan Alınan Çekler',
      collected_checks: 'Tahsil Edilen Çekler',
    };
    return activeFilter ? titles[activeFilter] : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const cards = [
    { id: 'income' as FilterType, title: 'Toplam Gelir', value: formatCurrency(stats.totalIncome), icon: TrendingUp, color: 'bg-green-500', bgColor: 'bg-green-50' },
    { id: 'expense' as FilterType, title: 'Toplam Gider', value: formatCurrency(stats.totalExpense), icon: TrendingDown, color: 'bg-red-500', bgColor: 'bg-red-50' },
    { id: 'profitLoss' as FilterType, title: 'Kâr/Zarar', value: formatCurrency(stats.profitLoss), icon: stats.profitLoss >= 0 ? TrendingUp : TrendingDown, color: stats.profitLoss >= 0 ? 'bg-green-600' : 'bg-red-600', bgColor: stats.profitLoss >= 0 ? 'bg-green-50' : 'bg-red-50' },
    { id: 'cash' as FilterType, title: 'Kasa Bakiyesi', value: formatCurrency(stats.totalCash), icon: Wallet, color: 'bg-blue-500', bgColor: 'bg-blue-50' },
    { id: 'bank' as FilterType, title: 'Banka Bakiyesi', value: formatCurrency(stats.totalBank), icon: Building2, color: 'bg-purple-500', bgColor: 'bg-purple-50' },
    { id: 'pending_given' as FilterType, title: 'Bekleyen Verilen Çek', value: `${stats.pendingGiven} adet`, icon: FileCheck, color: 'bg-orange-500', bgColor: 'bg-orange-50' },
    { id: 'urgent_given' as FilterType, title: 'Vadesi Yaklaşan Verilen', value: `${stats.urgentGiven} adet`, icon: AlertTriangle, color: 'bg-yellow-500', bgColor: 'bg-yellow-50' },
    { id: 'paid_checks' as FilterType, title: 'Ödenen Çek', value: `${stats.paidChecks} adet / ${formatCurrency(stats.paidChecksAmount)}`, icon: FileCheck, color: 'bg-red-600', bgColor: 'bg-red-50' },
    { id: 'pending_received' as FilterType, title: 'Bekleyen Alınan Çek', value: `${stats.pendingReceived} adet`, icon: FileCheck, color: 'bg-teal-500', bgColor: 'bg-teal-50' },
    { id: 'urgent_received' as FilterType, title: 'Vadesi Yaklaşan Alınan', value: `${stats.urgentReceived} adet`, icon: AlertTriangle, color: 'bg-amber-500', bgColor: 'bg-amber-50' },
    { id: 'collected_checks' as FilterType, title: 'Tahsil Edilen Çek', value: `${stats.collectedChecks} adet / ${formatCurrency(stats.collectedChecksAmount)}`, icon: FileCheck, color: 'bg-green-600', bgColor: 'bg-green-50' },
  ];

  const maxAmount = Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);

  const getTypeLabel = (type: string) => ({
    income: 'Gelir', expense: 'Gider', invoice: 'Fatura', delivery_note: 'İrsaliye',
    purchase_invoice: 'Alış Faturası', sale_invoice: 'Satış Faturası',
    in: 'Giriş', out: 'Çıkış',
  }[type] || type);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* Özet Kartlar - Tıklanabilir */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleFilterClick(card.id)}
            className={`${card.bgColor} rounded-xl p-4 border-2 transition-all text-left ${
              activeFilter === card.id
                ? 'border-slate-800 shadow-lg scale-[1.02]'
                : 'border-transparent hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-600">{card.title}</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-2 rounded-lg`}>
                <card.icon size={20} className="text-white" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gelir/Gider Trend Grafiği */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-500" />
            Günlük Gelir/Gider Trendi
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Gelir" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" name="Gider" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gelir/Gider Pasta Grafiği */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PieChartIcon size={20} className="text-purple-500" />
            Gelir/Gider Dağılımı
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Gelir', value: stats.totalIncome },
                  { name: 'Gider', value: stats.totalExpense },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#22c55e" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Karşılaştırma Grafiği */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-green-500" />
          Gelir/Gider Karşılaştırması
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="income" name="Gelir" fill="#22c55e" />
            <Bar dataKey="expense" name="Gider" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Nakit Akış Projeksiyonu */}
      {dailyData.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-purple-500" />
            Nakit Akış Projeksiyonu (30 Gün)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              const avgIncome = dailyData.reduce((s, d) => s + d.income, 0) / dailyData.length;
              const avgExpense = dailyData.reduce((s, d) => s + d.expense, 0) / dailyData.length;
              const projectedIncome = avgIncome * 30;
              const projectedExpense = avgExpense * 30;
              const projectedNet = projectedIncome - projectedExpense;
              return (
                <>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 mb-1">Tahmini Gelir (30 gün)</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(projectedIncome)}</p>
                    <p className="text-xs text-green-500 mt-1">Günlük ort: {formatCurrency(avgIncome)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-red-700 mb-1">Tahmini Gider (30 gün)</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(projectedExpense)}</p>
                    <p className="text-xs text-red-500 mt-1">Günlük ort: {formatCurrency(avgExpense)}</p>
                  </div>
                  <div className={`rounded-lg p-4 border ${projectedNet >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-sm mb-1 ${projectedNet >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Tahmini Net (30 gün)</p>
                    <p className={`text-xl font-bold ${projectedNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(projectedNet)}</p>
                    <p className={`text-xs mt-1 ${projectedNet >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>Günlük ort: {formatCurrency(projectedNet / 30)}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Filtre Detayı */}
      {activeFilter && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {getFilterTitle()}
              <span className="text-sm font-normal text-slate-500">({filterData.length} kayıt)</span>
            </h2>
            <button onClick={() => { setActiveFilter(null); setFilterData([]); }} className="p-2 hover:bg-slate-100 rounded-lg">
              <X size={18} className="text-slate-500" />
            </button>
          </div>

          {filterLoading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
          ) : filterData.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Kayıt bulunamadı.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {/* Gelir/Gider Filtresi */}
              {(activeFilter === 'income' || activeFilter === 'expense' || activeFilter === 'profitLoss') && filterData.map((t: any, i: number) => {
                const isIncome = activeFilter === 'income' || (activeFilter === 'profitLoss' && t._type === 'income');
                return (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    {isIncome ? (
                      <ArrowUpCircle size={18} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={18} className="text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.firm?.name || t.description || '-'}</p>
                      <p className="text-xs text-slate-500">{getTypeLabel(t.transaction_type)} • {formatDateTR(t.transaction_date)}</p>
                    </div>
                  </div>
                  <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
                );
              })}

              {/* Kasa Filtresi */}
              {activeFilter === 'cash' && filterData.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.currency || 'TRY'}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-blue-600">{formatCurrency(c.current_balance)}</p>
                </div>
              ))}

              {/* Banka Filtresi */}
              {activeFilter === 'bank' && filterData.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 size={18} className="text-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{b.bank_name}</p>
                      <p className="text-xs text-slate-500">{b.branch || ''} {b.account_number ? `• ${b.account_number}` : ''}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-purple-600">{formatCurrency(b.current_balance)}</p>
                </div>
              ))}

              {/* Çek Filtresi */}
              {(activeFilter === 'pending_given' || activeFilter === 'urgent_given' || activeFilter === 'paid_checks' || activeFilter === 'pending_received' || activeFilter === 'urgent_received' || activeFilter === 'collected_checks') && filterData.map((c: any) => {
                const dueDate = parseDateTR(c.due_date) || new Date(c.due_date);
                const daysUntil = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                const isGiven = c.check_type === 'given';
                return (
                  <div key={c.id} onClick={() => navigate('/cekler')} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isGiven ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{isGiven ? 'Verilen' : 'Alınan'}</span>
                        <span className="text-sm font-bold text-slate-800">{c.check_number}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{c.firm?.name || '-'}</span>
                        <span>{c.cari?.name || '-'}</span>
                        <span>{c.bank_name || '-'}</span>
                        <span>Vade: {formatDateTR(c.due_date)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isGiven ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(c.amount)}</p>
                      {c.status === 'pending' && (
                        <p className={`text-xs ${daysUntil <= 1 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {daysUntil < 0 ? 'Vadesi geçti' : daysUntil === 0 ? 'Bugün' : `${daysUntil} gün`}
                        </p>
                      )}
                      {c.status === 'paid' && <p className="text-xs text-red-500">Ödendi</p>}
                      {c.status === 'collected' && <p className="text-xs text-green-500">Tahsil edildi</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Son 7 Günlük Grafik */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Son 7 Gün - Gelir/Gider</h2>
        <div className="flex items-end justify-between h-48 gap-2">
          {dailyData.map((day, index) => {
            const incomeHeight = (day.income / maxAmount) * 100;
            const expenseHeight = (day.expense / maxAmount) * 100;
            const date = new Date(day.date);
            const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full flex gap-1 justify-center items-end h-40">
                  <div className="w-5 bg-green-500 rounded-t transition-all duration-500" style={{ height: `${Math.max(incomeHeight, 2)}%` }} title={`Gelir: ${formatCurrency(day.income)}`} />
                  <div className="w-5 bg-red-500 rounded-t transition-all duration-500" style={{ height: `${Math.max(expenseHeight, 2)}%` }} title={`Gider: ${formatCurrency(day.expense)}`} />
                </div>
                <p className="text-xs text-slate-500 mt-2">{dayName}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded"></div><span className="text-sm text-slate-600">Gelir</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded"></div><span className="text-sm text-slate-600">Gider</span></div>
        </div>
      </div>

      {/* Alt Bölüm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Son İşlemler */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Son İşlemler</h2>
          {incomeData.length > 0 || expenseData.length > 0 ? (
            <div className="space-y-3">
              {[...incomeData, ...expenseData]
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                .slice(0, 5)
                .map((transaction: any, i: number) => {
                const isIncome = transaction._type === 'income';
                return (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {isIncome ? (
                      <ArrowUpCircle size={20} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={20} className="text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{transaction.firm?.name || transaction.description || '-'}</p>
                      <p className="text-xs text-slate-500">{getTypeLabel(transaction.transaction_type)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTR(transaction.transaction_date)}</p>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">Henüz işlem yok.</p>
          )}
        </div>

        {/* Yaklaşan Vadeler */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Yaklaşan Çek Vadeleri</h2>
          {urgentCheckData.length > 0 ? (
            <div className="space-y-3">
              {urgentCheckData.slice(0, 5).map((check: any) => {
                const daysUntil = Math.ceil((new Date(check.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={check.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{check.check_number}</p>
                      <p className="text-xs text-slate-500">{check.firm?.name || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{formatCurrency(check.amount)}</p>
                      <p className={`text-xs ${daysUntil <= 1 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        {daysUntil < 0 ? 'Vadesi geçti' : daysUntil === 0 ? 'Bugün' : `${daysUntil} gün kaldı`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">Yaklaşan vade yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
