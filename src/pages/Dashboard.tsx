import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import {
  TrendingUp, TrendingDown, Wallet, Building2, FileCheck, AlertTriangle,
  ArrowUpCircle, ArrowDownCircle, X,
} from 'lucide-react';

type FilterType = 'income' | 'expense' | 'cash' | 'bank' | 'pending_checks' | 'urgent_checks' | null;

interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  totalCash: number;
  totalBank: number;
  pendingChecks: number;
  urgentChecks: number;
}

interface DailyData {
  date: string;
  income: number;
  expense: number;
}

export default function Dashboard() {
  const { selectedFirm } = useFirm();
  const [stats, setStats] = useState<DashboardStats>({ totalIncome: 0, totalExpense: 0, totalCash: 0, totalBank: 0, pendingChecks: 0, urgentChecks: 0 });
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

  useEffect(() => { fetchDashboardStats(); }, [selectedFirm]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      // Tüm transactions
      let txQ = supabase.from('transactions').select('amount, transaction_type, transaction_date, is_exception, firm:firms(name)');
      if (selectedFirm) txQ = txQ.eq('firm_id', selectedFirm.id);
      const { data: allTx } = await txQ.eq('is_exception', false);

      // Son 7 gün transactions
      let weekTxQ = supabase
        .from('transactions')
        .select('amount, transaction_type, transaction_date, is_exception, firm:firms(name)')
        .gte('transaction_date', sevenDaysAgo.toISOString().split('T')[0])
        .eq('is_exception', false);
      if (selectedFirm) weekTxQ = weekTxQ.eq('firm_id', selectedFirm.id);
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
          } else if (['income', 'invoice'].includes(t.transaction_type)) {
            day.income += t.amount;
          } else {
            day.expense += t.amount;
          }
        }
      });

      setDailyData(Array.from(dailyMap.values()));

      // Toplam gelir/gider
      let totalIncome = 0;
      let totalExpense = 0;
      const incomeList: any[] = [];
      const expenseList: any[] = [];

      (allTx || []).forEach((t: any) => {
        if (transferTypes.includes(t.transaction_type)) {
          // Transferler gelir/gider olarak sayılmaz
        } else if (['income', 'invoice'].includes(t.transaction_type)) {
          totalIncome += t.amount;
          incomeList.push(t);
        } else {
          totalExpense += t.amount;
          expenseList.push(t);
        }
      });

      setIncomeData(incomeList);
      setExpenseData(expenseList);

      // Kasa
      let cashQ = supabase.from('cash_registers').select('*').eq('is_active', true);
      if (selectedFirm) cashQ = cashQ.eq('firm_id', selectedFirm.id);
      const { data: cash } = await cashQ;

      // Banka
      let bankQ = supabase.from('bank_accounts').select('*').eq('is_active', true);
      if (selectedFirm) bankQ = bankQ.eq('firm_id', selectedFirm.id);
      const { data: bank } = await bankQ;

      setCashData(cash || []);
      setBankData(bank || []);

      // Çekler
      let checkQ = supabase.from('checks').select('*, firm:firms(name)').eq('status', 'pending').order('due_date');
      if (selectedFirm) checkQ = checkQ.eq('firm_id', selectedFirm.id);
      const { data: pendingChecks } = await checkQ;

      const fiveDaysLater = new Date(today);
      fiveDaysLater.setDate(today.getDate() + 5);
      const urgent = (pendingChecks || []).filter((c: any) => new Date(c.due_date) <= fiveDaysLater);

      setPendingCheckData(pendingChecks || []);
      setUrgentCheckData(urgent);

      setStats({
        totalIncome,
        totalExpense,
        totalCash: (cash || []).reduce((sum: number, c: any) => sum + c.current_balance, 0),
        totalBank: (bank || []).reduce((sum: number, b: any) => sum + b.current_balance, 0),
        pendingChecks: (pendingChecks || []).length,
        urgentChecks: urgent.length,
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
      case 'cash': setFilterData(cashData); break;
      case 'bank': setFilterData(bankData); break;
      case 'pending_checks': setFilterData(pendingCheckData); break;
      case 'urgent_checks': setFilterData(urgentCheckData); break;
    }
    setFilterLoading(false);
  };

  const getFilterTitle = () => {
    const titles: Record<string, string> = {
      income: 'Gelir İşlemleri',
      expense: 'Gider İşlemleri',
      cash: 'Kasa Hesapları',
      bank: 'Banka Hesapları',
      pending_checks: 'Bekleyen Çekler',
      urgent_checks: 'Vadesi Yaklaşan Çekler',
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
    { id: 'cash' as FilterType, title: 'Kasa Toplamı', value: formatCurrency(stats.totalCash), icon: Wallet, color: 'bg-blue-500', bgColor: 'bg-blue-50' },
    { id: 'bank' as FilterType, title: 'Banka Toplamı', value: formatCurrency(stats.totalBank), icon: Building2, color: 'bg-purple-500', bgColor: 'bg-purple-50' },
    { id: 'pending_checks' as FilterType, title: 'Bekleyen Çek', value: `${stats.pendingChecks} adet`, icon: FileCheck, color: 'bg-orange-500', bgColor: 'bg-orange-50' },
    { id: 'urgent_checks' as FilterType, title: 'Vadesi Yaklaşan', value: `${stats.urgentChecks} adet`, icon: AlertTriangle, color: 'bg-yellow-500', bgColor: 'bg-yellow-50' },
  ];

  const maxAmount = Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);

  const getTypeLabel = (type: string) => ({
    income: 'Gelir', expense: 'Gider', invoice: 'Fatura', delivery_note: 'İrsaliye',
    purchase_invoice: 'Alış Faturası', sale_invoice: 'Satış Faturası',
  }[type] || type);

  const getTypeColor = (type: string) => {
    if (['income', 'invoice', 'sale_invoice'].includes(type)) return 'text-green-600';
    return 'text-red-600';
  };

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
              {(activeFilter === 'income' || activeFilter === 'expense') && filterData.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    {['income', 'invoice', 'sale_invoice'].includes(t.transaction_type) ? (
                      <ArrowUpCircle size={18} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={18} className="text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.firm?.name || t.description || '-'}</p>
                      <p className="text-xs text-slate-500">{getTypeLabel(t.transaction_type)} • {formatDateTR(t.transaction_date)}</p>
                    </div>
                  </div>
                  <p className={`font-semibold ${getTypeColor(t.transaction_type)}`}>
                    {['income', 'invoice', 'sale_invoice'].includes(t.transaction_type) ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}

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
              {(activeFilter === 'pending_checks' || activeFilter === 'urgent_checks') && filterData.map((c: any) => {
                const daysUntil = Math.ceil((new Date(c.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.check_number}</p>
                      <p className="text-xs text-slate-500">{c.firm?.name || '-'} • {formatDateTR(c.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">{formatCurrency(c.amount)}</p>
                      <p className={`text-xs ${daysUntil <= 1 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                        {daysUntil < 0 ? 'Vadesi geçti' : daysUntil === 0 ? 'Bugün' : `${daysUntil} gün`}
                      </p>
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
                .map((transaction: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {['income', 'invoice', 'sale_invoice'].includes(transaction.transaction_type) ? (
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
                    <p className={`font-semibold ${getTypeColor(transaction.transaction_type)}`}>
                      {['income', 'invoice', 'sale_invoice'].includes(transaction.transaction_type) ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTR(transaction.transaction_date)}</p>
                  </div>
                </div>
              ))}
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
