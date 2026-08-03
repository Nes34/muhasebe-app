import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile, Firm } from '../types';
import { Plus, Edit2, Trash2, Users, Shield, CheckCircle, XCircle, Lock, History } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Yönetici', description: 'Tüm yetkilere sahip', color: 'bg-red-100 text-red-700' },
  { value: 'accountant', label: 'Muhasebeci', description: 'İşlem ve raporlama yetkisi', color: 'bg-blue-100 text-blue-700' },
  { value: 'viewer', label: 'Görüntüleyici', description: 'Sadece görüntüleme', color: 'bg-slate-100 text-slate-700' },
];

const PERMISSIONS = {
  admin: [
    'Tüm sayfalara erişim',
    'Kullanıcı yönetimi',
    'Sistem ayarları',
    'Veri silme/düzenleme',
    'Raporları dışa aktarma',
  ],
  accountant: [
    'İşlem girişi',
    'Fatura/irsaliye oluşturma',
    'Stok yönetimi',
    'Çek/kasa/banka yönetimi',
    'Cari hesap ekstresi',
    'Raporları görüntüleme',
  ],
  viewer: [
    'Dashboard görüntüleme',
    'Raporları görüntüleme',
    'Cari hesap ekstresi görüntüleme',
  ],
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', role: 'viewer' as 'admin' | 'accountant' | 'viewer', firm_id: '' });
  
  // Şifre değişikliği geçmişi
  const [passwordChanges, setPasswordChanges] = useState<{ id: string; user_id: string; changed_at: string; user?: UserProfile }[]>([]);
  const [showPasswordHistory, setShowPasswordHistory] = useState(false);

  useEffect(() => { fetchUsers(); fetchFirms(); fetchPasswordChanges(); }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('full_name');
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchFirms = async () => {
    const { data } = await supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both');
    if (data) setFirms(data);
  };

  const fetchPasswordChanges = async () => {
    const { data } = await supabase
      .from('password_changes')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(50);
    if (data) setPasswordChanges(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await supabase.from('user_profiles').update({ full_name: formData.full_name, role: formData.role, firm_id: formData.firm_id || null }).eq('id', editingUser.id);
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
      if (authError) { alert('Hata: ' + authError.message); return; }
      if (authData.user) {
        await supabase.from('user_profiles').insert({ id: authData.user.id, email: formData.email, full_name: formData.full_name, role: formData.role, firm_id: formData.firm_id || null, is_active: true });
      }
    }
    setShowForm(false); setEditingUser(null);
    setFormData({ email: '', password: '', full_name: '', role: 'viewer', firm_id: '' });
    fetchUsers();
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({ email: user.email || '', password: '', full_name: user.full_name || '', role: user.role, firm_id: user.firm_id || '' });
    setShowForm(true);
  };

  const handleToggleActive = async (user: UserProfile) => {
    const newStatus = !user.is_active;
    const action = newStatus ? 'aktifleştirmek' : 'pasifleştirmek';
    
    if (confirm(`Bu kullanıcıyı ${action} istediğinizden emin misiniz?`)) {
      await supabase.from('user_profiles').update({ is_active: newStatus }).eq('id', user.id);
      fetchUsers();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu kullanıcıyı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
      await supabase.from('user_profiles').delete().eq('id', id);
      fetchUsers();
    }
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
        <button onClick={() => { setEditingUser(null); setFormData({ email: '', password: '', full_name: '', role: 'viewer', firm_id: '' }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus size={16} />Yeni Kullanıcı</button>
      </div>

      {/* Özet Bilgiler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600">Toplam Kullanıcı</p>
          <p className="text-2xl font-bold text-slate-800">{users.filter(u => u.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600">Yönetici</p>
          <p className="text-2xl font-bold text-red-600">{users.filter(u => u.is_active && u.role === 'admin').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600">Muhasebeci</p>
          <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.is_active && u.role === 'accountant').length}</p>
        </div>
      </div>

      {/* Kullanıcı Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4">Kullanıcı</th>
                <th className="text-left py-3 px-4">E-posta</th>
                <th className="text-left py-3 px-4">Rol</th>
                <th className="text-left py-3 px-4">Firma</th>
                <th className="text-center py-3 px-4">Durum</th>
                <th className="text-center py-3 px-4">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const roleInfo = getRoleInfo(user.role);
                return (
                  <tr key={user.id} className={`border-t border-slate-100 hover:bg-slate-50 ${!user.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Users size={16} className="text-slate-600" />
                        </div>
                        <span className="font-medium">{user.full_name || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{user.email || '-'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setShowPermissions(showPermissions === user.id ? null : user.id)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.color} hover:opacity-80 transition-opacity`}
                      >
                        {roleInfo.label}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{firms.find(f => f.id === user.firm_id)?.name || 'Tüm Firmalar'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {user.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(user)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Düzenle">
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-1 ${user.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'} rounded`}
                          title={user.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        >
                          {user.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <p className="text-center py-8 text-slate-500">Kullanıcı bulunamadı.</p>}
      </div>

      {/* Şifre Değişikliği Geçmişi (Admin) */}
      <div className="mt-6">
        <button
          onClick={() => setShowPasswordHistory(!showPasswordHistory)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <History size={16} />
          Şifre Değişikliği Geçmişi ({passwordChanges.length})
        </button>
        
        {showPasswordHistory && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-3 px-4">Kullanıcı</th>
                    <th className="text-left py-3 px-4">Değişiklik Tarihi</th>
                    <th className="text-left py-3 px-4">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {passwordChanges.map((change) => {
                    const changeUser = users.find(u => u.id === change.user_id);
                    return (
                      <tr key={change.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-orange-500" />
                            <span className="font-medium">{changeUser?.full_name || change.user_id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(change.changed_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            Şifre Değiştirildi
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {passwordChanges.length === 0 && <p className="text-center py-8 text-slate-500">Henüz şifre değişikliği yok.</p>}
          </div>
        )}
      </div>

      {/* Yetki Detayları Modal */}
      {showPermissions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Shield size={20} />
                Yetki Detayları
              </h3>
              <button onClick={() => setShowPermissions(null)} className="p-2 hover:bg-slate-100 rounded-lg">×</button>
            </div>
            {(() => {
              const user = users.find(u => u.id === showPermissions);
              if (!user) return null;
              const roleInfo = getRoleInfo(user.role);
              const permissions = PERMISSIONS[user.role as keyof typeof PERMISSIONS] || [];
              return (
                <div>
                  <div className={`p-4 rounded-lg mb-4 ${roleInfo.color}`}>
                    <p className="font-semibold">{roleInfo.label}</p>
                    <p className="text-sm opacity-80">{roleInfo.description}</p>
                  </div>
                  <div className="space-y-2">
                    {permissions.map((perm, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle size={14} className="text-green-600" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Kullanıcı Ekleme/Düzenleme Formu */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required disabled={!!editingUser} /></div>
              {!editingUser && (
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required minLength={6} /></div>
              )}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label><input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                <div className="space-y-2">
                  {ROLES.map(role => (
                    <label
                      key={role.value}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.role === role.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={formData.role === role.value}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-slate-800">{role.label}</p>
                        <p className="text-sm text-slate-500">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Firma</label><select value={formData.firm_id} onChange={(e) => setFormData({ ...formData, firm_id: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="">Tüm Firmalar</option>{firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
