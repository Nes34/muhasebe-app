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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

const mobileMenuItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
  { to: '/islem-girisi', icon: ArrowRightLeft, label: 'İşlem' },
  { to: '/stok', icon: Package, label: 'Stok' },
  { to: '/cekler', icon: FileCheck, label: 'Çek' },
  { to: '/kasalar', icon: Wallet, label: 'Kasa' },
  { to: '/bankalar', icon: Building2, label: 'Banka' },
  { to: '/projeler', icon: FolderKanban, label: 'Projeler' },
];

const moreMenuItems = [
  { to: '/cari-hesap', icon: FileCheck, label: 'Cari Hesap' },
  { to: '/raporlar', icon: BarChart3, label: 'Raporlar' },
  { to: '/firmalar', icon: Building2, label: 'Firmalar' },
  { to: '/kullanici-yonetimi', icon: Users, label: 'Kullanıcılar' },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const { } = useAuth();

  return (
    <>
      {/* Ana Alt Menü */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden z-50 safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-1">
          {mobileMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-2 py-1 rounded-lg min-w-[56px]',
                  isActive
                    ? 'text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                )
              }
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-1 rounded-lg min-w-[56px]',
              showMore ? 'text-blue-600' : 'text-slate-500'
            )}
          >
            {showMore ? <X size={20} /> : <Menu size={20} />}
            <span className="text-[10px] font-medium">Daha Fazla</span>
          </button>
        </div>
      </nav>

      {/* Daha Fazla Menü */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 lg:hidden z-50 shadow-lg">
          <div className="grid grid-cols-4 gap-1 p-2">
            {moreMenuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg',
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  )
                }
              >
                <item.icon size={24} />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100">
            <NavLink
              to="/ayarlar"
              onClick={() => setShowMore(false)}
              className="flex items-center justify-center gap-2 p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              <span className="text-sm">Ayarlar</span>
            </NavLink>
          </div>
        </div>
      )}

      {/* Overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/30 lg:hidden z-40"
          onClick={() => setShowMore(false)}
        />
      )}
    </>
  );
}
