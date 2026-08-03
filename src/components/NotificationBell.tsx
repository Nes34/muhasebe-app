import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, type Notification } from '../hooks/useNotifications';
import { Bell, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export function NotificationBell() {
  const { notifications, loading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const dangerCount = notifications.filter(n => n.severity === 'danger').length;
  const totalCount = notifications.length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'overdue_check': return <AlertCircle size={16} className="text-red-500" />;
      case 'low_stock': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'budget_overrun': return <AlertCircle size={16} className="text-red-500" />;
      case 'low_balance': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'pending_invoice_order': return <AlertTriangle size={16} className="text-purple-500" />;
      case 'delivery_complete_order': return <Info size={16} className="text-green-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: Notification['severity']) => {
    switch (severity) {
      case 'danger': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  };

  if (loading) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 text-xs text-white rounded-full flex items-center justify-center ${
            dangerCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-[500px] overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Bildirimler ({totalCount})</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell size={32} className="mx-auto mb-2 text-slate-300" />
                  <p>Yeni bildirim yok</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${getSeverityColor(notification.severity)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{notification.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
