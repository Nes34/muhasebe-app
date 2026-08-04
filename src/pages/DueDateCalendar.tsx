import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface DueItem {
  id: string;
  type: 'check_received' | 'check_given';
  date: string;
  amount: number;
  description: string;
  firm: string;
  status: string;
  daysUntil: number;
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function DueDateCalendar() {
  const { selectedFirm } = useFirm();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => { fetchDueItems(); }, [selectedFirm]);

  const fetchDueItems = async () => {
    setLoading(true);
    const items: DueItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Çekler
    let checkQuery = supabase.from('checks').select('*').eq('status', 'pending');
    if (selectedFirm) checkQuery = checkQuery.eq('firm_id', selectedFirm.id);
    const { data: checks } = await checkQuery;

    (checks || []).forEach(c => {
      const dueDate = new Date(c.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      items.push({
        id: c.id,
        type: c.check_type === 'received' ? 'check_received' : 'check_given',
        date: c.due_date,
        amount: c.amount,
        description: `Çek No: ${c.check_number}`,
        firm: c.firm_id || '-',
        status: c.status,
        daysUntil,
      });
    });

    // Tarihe göre sırala
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setDueItems(items);
    setLoading(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Pazartesi başlangıç
  };

  const getItemsForDate = (dateStr: string) => {
    return dueItems.filter(item => item.date === dateStr);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Boş günler (ayın başından önce)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-slate-100"></div>);
    }

    // Ayın günleri
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const items = getItemsForDate(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
          className={`h-24 border border-slate-100 p-1 cursor-pointer transition-all ${
            isToday ? 'bg-blue-50 border-blue-300' : ''
          } ${isSelected ? 'bg-blue-100 border-blue-400' : 'hover:bg-slate-50'}`}
        >
          <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
            {day}
          </div>
          <div className="space-y-0.5">
            {items.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className={`text-[10px] px-1 py-0.5 rounded truncate ${
                  item.type === 'check_received'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {item.type === 'check_received' ? '▲' : '▼'} {formatCurrency(item.amount)}
              </div>
            ))}
            {items.length > 3 && (
              <div className="text-[10px] text-slate-500">+{items.length - 3} daha</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const selectedDateItems = selectedDate ? getItemsForDate(selectedDate) : [];
  const upcomingItems = dueItems.filter(item => item.daysUntil >= 0 && item.daysUntil <= 7);
  const overdueItems = dueItems.filter(item => item.daysUntil < 0);

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
          Vade Takvimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
      </div>

      {/* Uyarılar */}
      {overdueItems.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertTriangle size={20} />
            <span className="font-semibold">Vadesi Geçen ({overdueItems.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {overdueItems.slice(0, 6).map(item => (
              <div key={item.id} className="bg-white rounded-lg p-2 text-sm">
                <span className="font-medium">{item.description}</span>
                <span className="text-red-600 ml-2">{formatCurrency(item.amount)}</span>
                <span className="text-red-500 ml-1">({item.daysUntil} gün geçti)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingItems.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 mb-2">
            <Clock size={20} />
            <span className="font-semibold">Yaklaşan Vadeler ({upcomingItems.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {upcomingItems.slice(0, 6).map(item => (
              <div key={item.id} className="bg-white rounded-lg p-2 text-sm">
                <span className="font-medium">{item.description}</span>
                <span className="text-orange-600 ml-2">{formatCurrency(item.amount)}</span>
                <span className="text-orange-500 ml-1">({item.daysUntil} gün)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Takvim */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold">
              {MONTHS_TR[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {DAYS_TR.map(day => (
              <div key={day} className="text-center py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">
                {day}
              </div>
            ))}
            {renderCalendarDays()}
          </div>
        </div>

        {/* Seçili Gün Detayı */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-4">
            {selectedDate ? formatDateTR(selectedDate) : 'Gün Seçin'}
          </h3>
          {selectedDate ? (
            selectedDateItems.length > 0 ? (
              <div className="space-y-3">
                {selectedDateItems.map(item => (
                  <div key={item.id} className={`p-3 rounded-lg border ${
                    item.type === 'check_received' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {item.type === 'check_received' ? (
                        <CheckCircle size={14} className="text-green-600" />
                      ) : (
                        <AlertTriangle size={14} className="text-red-600" />
                      )}
                      <span className="text-sm font-medium">
                        {item.type === 'check_received' ? 'Alınan Çek' : 'Verilen Çek'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{item.description}</p>
                    <p className={`text-lg font-bold ${item.type === 'check_received' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Bu tarihte vade yok.</p>
            )
          ) : (
            <p className="text-sm text-slate-500">Takvimden bir gün seçin.</p>
          )}

          {/* Özet */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Bu Ay</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Toplam Vade</span>
                <span className="font-medium">{dueItems.filter(i => i.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Alınan Çek</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(dueItems.filter(i => i.type === 'check_received' && i.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)).reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Verilen Çek</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(dueItems.filter(i => i.type === 'check_given' && i.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)).reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
