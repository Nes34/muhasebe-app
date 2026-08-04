import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Package,
  FileCheck,
  Wallet,
  Building2,
  FolderKanban,
  BarChart3,
  Users,
  Menu,
  X,
  ShoppingCart,
  Truck,
  Calendar,
  FileText,
  Receipt,
  CreditCard,
  UserCircle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

const mainMenuItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { to: '/islem-girisi', icon: ArrowRightLeft, label: 'İşlem' },
  { to: '/siparis-girisi', icon: ShoppingCart, label: 'Sipariş' },
  { to: '/stok', icon: Package, label: 'Stok' },
];

const financeMenuItems = [
  { to: '/kasalar', icon: Wallet, label: 'Kasa' },
  { to: '/bankalar', icon: CreditCard, label: 'Banka' },
  { to: '/cekler', icon: FileCheck, label: 'Çek' },
  { to: '/cari-hesap', icon: Receipt, label: 'Cari' },
];

const managementMenuItems = [
  { to: '/firmalar', icon: Building2, label: 'Firmalar' },
  { to: '/projeler', icon: FolderKanban, label: 'Projeler' },
  { to: '/cariler', icon: Users, label: 'Cariler' },
  { to: '/raporlar', icon: BarChart3, label: 'Raporlar' },
];

const personnelMenuItems = [
  { to: '/personel', icon: Users, label: 'Personel' },
  { to: '/puantaj', icon: Calendar, label: 'Puantaj' },
  { to: '/bordro', icon: FileText, label: 'Bordro' },
  { to: '/izin', icon: Calendar, label: 'İzin' },
];

const orderMenuItems = [
  { to: '/siparis-girisi', icon: ShoppingCart, label: 'Sipariş Girişi' },
  { to: '/siparis-takibi', icon: Truck, label: 'Sipariş Takibi' },
  { to: '/islem-takibi', icon: ArrowRightLeft, label: 'İşlem Takibi' },
  { to: '/kidem-ihbar', icon: FileText, label: 'Kıdem/İhbar' },
];

export function MobileNav() {
  const [showMenu, setShowMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { signOut } = useAuth();

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <>
      {/* Ana Alt Menü */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden z-50 safe-area-bottom shadow-lg">
        <div className="flex items-center justify-around py-1.5 px-1">
          {mainMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[60px] transition-all',
                  isActive
                    ? 'text-blue-600 bg-blue-50 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )
              }
            >
              <item.icon size={22} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[60px] transition-all',
              showMenu ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            {showMenu ? <X size={22} /> : <Menu size={22} />}
            <span className="text-[10px] font-semibold">Menü</span>
          </button>
        </div>
      </nav>

      {/* Tam Menü */}
      {showMenu && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-50" onClick={() => setShowMenu(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
            </div>

            {/* Kullanıcı Bilgisi */}
            <div className="px-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle size={28} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Kullanıcı</p>
                  <p className="text-sm text-slate-500">Yönetici</p>
                </div>
              </div>
            </div>

            {/* Menü Bölümleri */}
            <div className="p-4 space-y-2">
              {/* Finans */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => toggleSection('finance')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-green-600" />
                    <span className="font-semibold text-slate-700">Finans</span>
                  </div>
                  <Menu size={16} className={cn('text-slate-400 transition-transform', activeSection === 'finance' && 'rotate-90')} />
                </button>
                {activeSection === 'finance' && (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {financeMenuItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowMenu(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                            isActive
                              ? 'text-blue-600 bg-blue-50 shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50'
                          )
                        }
                      >
                        <item.icon size={24} />
                        <span className="text-[11px] font-medium text-center">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Yönetim */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => toggleSection('management')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-purple-600" />
                    <span className="font-semibold text-slate-700">Yönetim</span>
                  </div>
                  <Menu size={16} className={cn('text-slate-400 transition-transform', activeSection === 'management' && 'rotate-90')} />
                </button>
                {activeSection === 'management' && (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {managementMenuItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowMenu(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                            isActive
                              ? 'text-blue-600 bg-blue-50 shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50'
                          )
                        }
                      >
                        <item.icon size={24} />
                        <span className="text-[11px] font-medium text-center">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Siparişler */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => toggleSection('orders')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-orange-600" />
                    <span className="font-semibold text-slate-700">Siparişler</span>
                  </div>
                  <Menu size={16} className={cn('text-slate-400 transition-transform', activeSection === 'orders' && 'rotate-90')} />
                </button>
                {activeSection === 'orders' && (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {orderMenuItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowMenu(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                            isActive
                              ? 'text-blue-600 bg-blue-50 shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50'
                          )
                        }
                      >
                        <item.icon size={24} />
                        <span className="text-[11px] font-medium text-center">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Personel */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  onClick={() => toggleSection('personnel')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-teal-600" />
                    <span className="font-semibold text-slate-700">Personel</span>
                  </div>
                  <Menu size={16} className={cn('text-slate-400 transition-transform', activeSection === 'personnel' && 'rotate-90')} />
                </button>
                {activeSection === 'personnel' && (
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {personnelMenuItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowMenu(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                            isActive
                              ? 'text-blue-600 bg-blue-50 shadow-sm'
                              : 'text-slate-600 hover:bg-slate-50'
                          )
                        }
                      >
                        <item.icon size={24} />
                        <span className="text-[11px] font-medium text-center">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {/* Raporlar */}
              <NavLink
                to="/raporlar"
                onClick={() => setShowMenu(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 p-3 border border-slate-200 rounded-xl transition-all',
                    isActive
                      ? 'text-blue-600 bg-blue-50 border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <BarChart3 size={20} />
                <span className="font-semibold">Raporlar</span>
              </NavLink>
            </div>

            {/* Çıkış */}
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => { signOut(); setShowMenu(false); }}
                className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
              >
                <span className="font-semibold">Çıkış Yap</span>
              </button>
            </div>

            {/* Safe area bottom */}
            <div className="h-8 bg-white"></div>
          </div>
        </div>
      )}
    </>
  );
}
