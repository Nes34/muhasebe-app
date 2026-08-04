import { Bell, Search, User, LogOut, Menu, Settings, Lock, X, CheckCircle, AlertTriangle, Building2, ChevronDown, Plus, FolderKanban, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useFirm } from '../../hooks/useFirm';
import { useDarkMode } from '../../hooks/useDarkMode';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDateTR } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import type { Check } from '../../types';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut, updatePassword } = useAuth();
  const { selectedFirm, firms, setSelectedFirm, selectedProject, projects, setSelectedProject } = useFirm();
  const { isDark, toggleDark } = useDarkMode();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFirmSelect, setShowFirmSelect] = useState(false);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [urgentChecks, setUrgentChecks] = useState<Check[]>([]);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const firmRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUrgentChecks();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (firmRef.current && !firmRef.current.contains(e.target as Node)) {
        setShowFirmSelect(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setShowProjectSelect(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUrgentChecks = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('checks')
      .select('*, firm:firms(*)')
      .eq('status', 'pending')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(10);
    if (data) setUrgentChecks(data);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Şifreler eşleşmiyor.' });
      return;
    }

    setChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setChangingPassword(false);

    if (error) {
      setPasswordMessage({ type: 'error', text: error.message || 'Şifre güncellenirken hata oluştu.' });
    } else {
      setPasswordMessage({ type: 'success', text: 'Şifre başarıyla güncellendi!' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowSettings(false);
        setPasswordMessage(null);
      }, 2000);
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Ara..."
            className="bg-transparent border-none outline-none w-40 lg:w-64 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Firma Seçici */}
        <div className="relative" ref={firmRef}>
          <button
            onClick={() => { setShowFirmSelect(!showFirmSelect); setShowSettings(false); setShowNotifications(false); }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-700 max-w-[80px] lg:max-w-[150px] truncate">
              {selectedFirm ? selectedFirm.name : 'Tüm Firmalar'}
            </span>
            <ChevronDown size={12} className="text-blue-500" />
          </button>

          {showFirmSelect && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase">Firma Seçin</p>
                <button
                  onClick={() => { setShowFirmSelect(false); navigate('/firmalar'); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus size={12} />
                  Yeni Ekle
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setSelectedFirm(null); setShowFirmSelect(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${!selectedFirm ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                    <Building2 size={14} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Tüm Firmalar</p>
                    <p className="text-xs text-slate-500">Genel görünüm</p>
                  </div>
                </button>
                {firms.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">Henüz firma eklenmemiş</p>
                    <button
                      onClick={() => { setShowFirmSelect(false); navigate('/firmalar'); }}
                      className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      + Firma Ekle
                    </button>
                  </div>
                )}
                {firms.map(firm => (
                  <button
                    key={firm.id}
                    onClick={() => { setSelectedFirm(firm); setShowFirmSelect(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedFirm?.id === firm.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{firm.name}</p>
                      <p className="text-xs text-slate-500">{firm.code || ''} {firm.tax_number ? `• ${firm.tax_number}` : ''}</p>
                    </div>
                    {selectedFirm?.id === firm.id && (
                      <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Proje Seçici */}
        {selectedFirm && projects.length > 0 && (
          <div className="relative" ref={projectRef}>
            <button
              onClick={() => { setShowProjectSelect(!showProjectSelect); setShowFirmSelect(false); setShowSettings(false); setShowNotifications(false); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <FolderKanban size={16} className="text-purple-600" />
              <span className="text-sm font-medium text-purple-700 max-w-[150px] truncate">
                {selectedProject ? selectedProject.name : 'Tüm Projeler'}
              </span>
              <ChevronDown size={14} className="text-purple-500" />
            </button>

            {showProjectSelect && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden">
                <div className="p-3 border-b border-slate-200 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Proje Seçin</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedProject(null); setShowProjectSelect(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${!selectedProject ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}
                  >
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                      <FolderKanban size={14} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">Tüm Projeler</p>
                      <p className="text-xs text-slate-500">Genel görünüm</p>
                    </div>
                  </button>
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProject(project); setShowProjectSelect(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedProject?.id === project.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}
                    >
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FolderKanban size={14} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                      </div>
                      {selectedProject?.id === project.id && (
                        <CheckCircle size={16} className="text-purple-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={isDark ? 'Aydınlık Mod' : 'Karanlık Mod'}
        >
          {isDark ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-slate-600" />}
        </button>

        {/* Bildirimler */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }}
            className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Bell size={20} className="text-slate-600" />
            {urgentChecks.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {urgentChecks.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Bell size={16} />
                    Bildirimler
                    {urgentChecks.length > 0 && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{urgentChecks.length}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {urgentChecks.length > 0 && (
                      <button
                        onClick={() => {
                          setUrgentChecks([]);
                          setShowNotifications(false);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded"
                      >
                        Tümünü Okundu İşaretle
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-slate-200 rounded">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {urgentChecks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    <p>Yeni bildirim yok</p>
                  </div>
                ) : (
                  urgentChecks.map(check => {
                    const days = getDaysUntilDue(check.due_date);
                    return (
                      <div key={check.id} className="p-3 border-b border-slate-100 hover:bg-slate-50 flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${days < 0 ? 'bg-red-100' : days === 0 ? 'bg-red-500' : 'bg-orange-100'}`}>
                          <AlertTriangle size={16} className={days < 0 ? 'text-red-600' : days === 0 ? 'text-white' : 'text-orange-600'} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">Çek Vadesi {days < 0 ? 'Geçti' : days === 0 ? 'Bugün' : `${days} Gün Kaldı`}</p>
                          <p className="text-xs text-slate-500">{check.check_number} - {check.firm?.name || '-'}</p>
                          <p className="text-xs font-medium text-slate-700 mt-1">{formatCurrency(check.amount)}</p>
                        </div>
                        <span className="text-xs text-slate-400">{formatDateTR(check.due_date)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ayarlar / Kullanıcı */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <span className="hidden md:block text-sm font-medium text-slate-700">
              {user?.email || 'Kullanıcı'}
            </span>
            <Settings size={16} className="text-slate-400" />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Settings size={16} />
                    Şifre Değiştir
                  </h3>
                  <button onClick={() => { setShowSettings(false); setPasswordMessage(null); }} className="p-1 hover:bg-slate-200 rounded">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <form onSubmit={handleChangePassword} className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="En az 6 karakter"
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şifre Tekrar</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifreyi tekrar girin"
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>
                {passwordMessage && (
                  <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {passwordMessage.type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
                    {passwordMessage.text}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {changingPassword ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </form>
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut size={16} />
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}