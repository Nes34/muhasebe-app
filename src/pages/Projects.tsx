import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import SearchableSelect from '../components/SearchableSelect';
import type { Project, Firm } from '../types';
import { Plus, Edit2, Trash2, FolderKanban, AlertTriangle, CheckCircle, Search } from 'lucide-react';

export default function Projects() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Proje form
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    firm_id: '',
    start_date: formatDateTR(new Date()),
    end_date: '',
    budget: 0,
    status: 'active' as 'active' | 'completed' | 'cancelled',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [firmsRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).order('code'),
      supabase.from('projects').select('*, firm:firms(*)').order('created_at', { ascending: false }),
    ]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firm_id) {
      setMessage({ type: 'error', text: 'Lütfen bir firma seçin.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (editingProject) {
      await supabase.from('projects').update({
        name: formData.name,
        description: formData.description,
        firm_id: formData.firm_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        budget: formData.budget,
        status: formData.status,
      }).eq('id', editingProject.id);
      setMessage({ type: 'success', text: 'Proje güncellendi!' });
    } else {
      await supabase.from('projects').insert({
        name: formData.name,
        description: formData.description,
        firm_id: formData.firm_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        budget: formData.budget,
        status: formData.status,
      });
      setMessage({ type: 'success', text: `"${formData.name}" projesi eklendi!` });
    }
    setShowForm(false);
    setEditingProject(null);
    setFormData({ name: '', description: '', firm_id: '', start_date: formatDateTR(new Date()), end_date: '', budget: 0, status: 'active' });
    fetchData();
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      firm_id: project.firm_id,
      start_date: project.start_date,
      end_date: project.end_date || '',
      budget: project.budget || 0,
      status: project.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu projeyi silmek istediğinizden emin misiniz?')) {
      await supabase.from('projects').delete().eq('id', id);
      fetchData();
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.firm?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusLabel = (status: string) => ({ active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' }[status] || status);
  const getStatusColor = (status: string) => ({ active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-700' }[status] || 'bg-slate-100 text-slate-700');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Projeler</h1>
        <button
          onClick={() => {
            setEditingProject(null);
            setFormData({ name: '', description: '', firm_id: '', start_date: formatDateTR(new Date()), end_date: '', budget: 0, status: 'active' });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />Yeni Proje
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Proje veya firma ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(project => (
          <div key={project.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FolderKanban size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{project.name}</h3>
                  <p className="text-xs text-slate-500">{project.firm?.name || '-'}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {getStatusLabel(project.status)}
              </span>
            </div>
            
            {project.description && (
              <p className="text-sm text-slate-600 mb-3 line-clamp-2">{project.description}</p>
            )}
            
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
              <div>Başlangıç: {project.start_date}</div>
              {project.end_date && <div>Bitiş: {project.end_date}</div>}
              {project.budget > 0 && <div>Bütçe: {formatCurrency(project.budget)}</div>}
            </div>
            
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => handleEdit(project)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors">
                <Edit2 size={14} />Düzenle
              </button>
              <button onClick={() => handleDelete(project.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
                <Trash2 size={14} />Sil
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FolderKanban size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">Proje bulunamadı</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingProject ? 'Proje Düzenle' : 'Yeni Proje'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <SearchableSelect
                options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                value={formData.firm_id}
                onChange={(id) => setFormData({ ...formData, firm_id: id })}
                label="Firma *"
                placeholder="Proje hangi firmaya ait?"
                required
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proje Adı *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç</label>
                  <input
                    type="text"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    placeholder="gg.aa.yyyy"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bitiş</label>
                  <input
                    type="text"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    placeholder="gg.aa.yyyy"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bütçe (₺)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'completed' | 'cancelled' })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="active">Aktif</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingProject(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
