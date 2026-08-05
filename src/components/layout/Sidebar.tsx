import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Package,
  Ruler,
  FileCheck,
  Wallet,
  Building2,
  Users,
  ChevronLeft,
  ChevronDown,
  Receipt,
  CreditCard,
  PieChart,
  GitMerge,
  FolderKanban,
  ShoppingCart,
  Truck,
  Calendar,
  FileText,
  Clock,
  TrendingUp,
  ClipboardCheck,
  FolderOpen,
  Car,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MenuItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

interface MenuGroup {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  to?: string; // Direkt link varsa (örn: Dashboard)
  items?: MenuItem[]; // Alt menü varsa
}

const menuGroups: MenuGroup[] = [
  {
    title: 'GENEL',
    icon: LayoutDashboard,
    to: '/dashboard',
  },
  {
    title: 'FİRMALAR',
    icon: Building2,
    items: [
      { to: '/firmalar', icon: Building2, label: 'Firma Yönetimi' },
      { to: '/projeler', icon: FolderKanban, label: 'Projeler' },
    ],
  },
  {
    title: 'CARİLER',
    icon: Receipt,
    items: [
      { to: '/cariler', icon: Users, label: 'Cari Yönetimi' },
      { to: '/cari-hesap', icon: Receipt, label: 'Cari Hesap Ekstresi' },
      { to: '/firma-birlesme', icon: GitMerge, label: 'Birleştirme' },
    ],
  },
  {
    title: 'İŞLEMLER',
    icon: ArrowRightLeft,
    items: [
      { to: '/islem-girisi', icon: ArrowRightLeft, label: 'İşlem Girişi' },
      { to: '/islem-takibi', icon: ArrowRightLeft, label: 'İşlem Takibi' },
      { to: '/irsaliye-fatura', icon: Truck, label: 'İrsaliyeden Fatura' },
    ],
  },
  {
    title: 'SİPARİŞLER',
    icon: ShoppingCart,
    items: [
      { to: '/siparis-girisi', icon: ShoppingCart, label: 'Sipariş Girişi' },
      { to: '/siparis-takibi', icon: Truck, label: 'Sipariş Takibi' },
    ],
  },
  {
    title: 'PERSONEL',
    icon: Users,
    items: [
      { to: '/personel', icon: Users, label: 'Personel Yönetimi' },
      { to: '/puantaj', icon: Calendar, label: 'Puantaj' },
      { to: '/bordro', icon: FileText, label: 'Bordro Hazırlama' },
      { to: '/izin', icon: Clock, label: 'İzin Yönetimi' },
      { to: '/kidem-ihbar', icon: TrendingUp, label: 'Kıdem/İhbar' },
    ],
  },
  {
    title: 'STOK & ENVANTER',
    icon: Package,
    items: [
      { to: '/stok', icon: Package, label: 'Stok Yönetimi' },
      { to: '/stok-sayim', icon: ClipboardCheck, label: 'Stok Sayım' },
      { to: '/demirbaslar', icon: Car, label: 'Demirbaş Yönetimi' },
      { to: '/stok-birimleri', icon: Ruler, label: 'Stok Birimleri' },
      { to: '/stok-birlesme', icon: GitMerge, label: 'Stok Birleştirme' },
    ],
  },
  {
    title: 'FİNANSAL',
    icon: Wallet,
    items: [
      { to: '/kasalar', icon: Wallet, label: 'Kasa Yönetimi' },
      { to: '/bankalar', icon: CreditCard, label: 'Banka Yönetimi' },
      { to: '/cekler', icon: FileCheck, label: 'Çek Yönetimi' },
      { to: '/vade-takvimi', icon: Calendar, label: 'Vade Takvimi' },
    ],
  },
  {
    title: 'RAPOR & YÖNETİM',
    icon: PieChart,
    items: [
      { to: '/raporlar', icon: PieChart, label: 'Raporlar' },
      { to: '/dokumanlar', icon: FolderOpen, label: 'Dokümanlar' },
      { to: '/kullanici-yonetimi', icon: Users, label: 'Kullanıcılar' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(['İŞLEMLER']); // Varsayılan açık grup

  // Aktif sayfaya göre grubu otomatik aç
  useEffect(() => {
    const activeGroup = menuGroups.find(g => 
      g.items?.some(item => location.pathname === item.to)
    );
    if (activeGroup && !openGroups.includes(activeGroup.title)) {
      setOpenGroups(prev => [...prev, activeGroup.title]);
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    if (collapsed) return;
    setOpenGroups(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const isGroupOpen = (title: string) => openGroups.includes(title);

  const isItemActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700/50">
        {!collapsed ? (
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-white">Muhasebe</span>
          </NavLink>
        ) : (
          <NavLink to="/dashboard" className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">M</span>
          </NavLink>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Menü */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        {menuGroups.map((group) => {
          // Direkt link olan gruplar (Dashboard gibi)
          if (group.to) {
            return (
              <NavLink
                key={group.title}
                to={group.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  )
                }
                title={collapsed ? group.title : undefined}
              >
                <group.icon size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{group.title}</span>
                )}
              </NavLink>
            );
          }

          // Accordion menü olan gruplar
          const hasActiveChild = group.items?.some(item => isItemActive(item.to));
          
          return (
            <div key={group.title} className="mb-1">
              {/* Grup Başlığı (Tıklanabilir) */}
              <button
                onClick={() => toggleGroup(group.title)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  hasActiveChild && !isGroupOpen(group.title)
                    ? 'bg-slate-800/50 text-white'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                )}
                title={collapsed ? group.title : undefined}
              >
                <group.icon size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">{group.title}</span>
                    <ChevronDown 
                      size={14} 
                      className={cn(
                        'transition-transform duration-200',
                        isGroupOpen(group.title) ? 'rotate-180' : ''
                      )} 
                    />
                  </>
                )}
              </button>

              {/* Alt Menü Öğeleri */}
              {!collapsed && isGroupOpen(group.title) && group.items && (
                <div className="ml-4 mt-0.5 border-l border-slate-700/50 pl-3">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 transition-all duration-200 text-sm',
                          isActive
                            ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500 -ml-[13px] pl-[23px]'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        )
                      }
                    >
                      <item.icon size={14} className="flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}

              {/* Collapsed modda tooltip */}
              {collapsed && isGroupOpen(group.title) && group.items && (
                <div className="absolute left-16 top-0 bg-slate-800 rounded-lg shadow-xl py-2 min-w-[180px] z-50 hidden group-hover:block">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-3 py-2 text-sm',
                          isActive ? 'text-blue-400 bg-slate-700' : 'text-slate-300 hover:bg-slate-700'
                        )
                      }
                    >
                      <item.icon size={14} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Alt Bilgi */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-700/50">
          <div className="px-3 py-2 bg-slate-800/50 rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Proje Sahibi</p>
            <p className="text-sm font-medium text-slate-300">Enes Dere</p>
          </div>
        </div>
      )}
    </aside>
  );
}
