import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR, formatCurrency } from '../lib/utils';
import { exportProjectsToExcel } from '../lib/excel';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import type { Project, Firm } from '../types';
import { Plus, Edit2, Trash2, FolderKanban, AlertTriangle, CheckCircle, Search, TrendingUp, TrendingDown, Wallet, DollarSign, Download } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface ProjectSummary {
  project: Project;
  income: number;
  expense: number;
  budget: number;
  checksGiven: number;
  checksPaid: number;
  profitLoss: number;
  completionRate: number;
}

export default function Projects() {
  const { selectedFirm } = useFirm();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
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

  useEffect(() => { fetchData(); }, [selectedFirm]);
  useEffect(() => { fetchProjectSummaries(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    let projectsQuery = supabase.from('projects').select('*, firm:firms(*)').order('created_at', { ascending: false });
    if (selectedFirm) projectsQuery = projectsQuery.eq('firm_id', selectedFirm.id);

    const [firmsRes, projectsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).eq('type', 'both').order('code'),
      projectsQuery,
    ]);
    if (firmsRes.data) setFirms(firmsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const fetchProjectSummaries = async () => {
    let projectQuery = supabase.from('projects').select('*').order('name');
    if (selectedFirm) projectQuery = projectQuery.eq('firm_id', selectedFirm.id);
    const { data: projectsData } = await projectQuery;
    if (!projectsData || projectsData.length === 0) { setProjectSummaries([]); return; }

    const projectIds = projectsData.map(p => p.id);

    const [txRes, checkRes, cashTxRes, bankTxRes, cashRegRes, bankAccRes] = await Promise.all([
      supabase.from('transactions').select('project_id, amount, transaction_type').in('project_id', projectIds).eq('is_exception', false),
      supabase.from('checks').select('project_id, amount, check_type, status').in('project_id', projectIds),
      supabase.from('cash_transactions').select('project_id, amount, transaction_type, transaction_id').in('project_id', projectIds),
      supabase.from('bank_transactions').select('project_id, amount, transaction_type, transaction_id').in('project_id', projectIds),
      supabase.from('cash_registers').select('opening_balance'),
      supabase.from('bank_accounts').select('opening_balance'),
    ]);

    const summaries: ProjectSummary[] = projectsData.map(project => {
      const txs = txRes.data?.filter(t => t.project_id === project.id) || [];
      const checks = checkRes.data?.filter(c => c.project_id === project.id) || [];
      // transaction_id olan kasa/banka hareketleri transactions tablosunda zaten sayıldı, hariç tut
      const cashTx = cashTxRes.data?.filter(t => t.project_id === project.id && !t.transaction_id) || [];
      const bankTx = bankTxRes.data?.filter(t => t.project_id === project.id && !t.transaction_id) || [];

      const income = txs.filter(t => t.transaction_type === 'income' || t.transaction_type === 'invoice').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.transaction_type !== 'income' && t.transaction_type !== 'invoice').reduce((s, t) => s + t.amount, 0);

      // Kasa ve banka hareketleri (transaction_id olmayanlar - mükerrer önlem)
      const cashIn = cashTx.filter(t => t.transaction_type === 'in').reduce((s, t) => s + t.amount, 0);
      const cashOut = cashTx.filter(t => t.transaction_type === 'out').reduce((s, t) => s + t.amount, 0);
      const bankIn = bankTx.filter(t => t.transaction_type === 'in').reduce((s, t) => s + t.amount, 0);
      const bankOut = bankTx.filter(t => t.transaction_type === 'out').reduce((s, t) => s + t.amount, 0);

      // Bekleyen çekler (tahsil/ödenmemiş)
      const pendingReceivedChecks = checks.filter(c => c.check_type === 'received' && c.status === 'pending').reduce((s, c) => s + c.amount, 0);
      const pendingGivenChecks = checks.filter(c => c.check_type === 'given' && c.status === 'pending').reduce((s, c) => s + c.amount, 0);
      const checksPaid = checks.filter(c => c.check_type === 'given' && c.status === 'collected').reduce((s, c) => s + c.amount, 0);

      // Dashboard ile tutarlı: gelire kasa/banka giriş, gidere kasa/banka çıkış ekle
      const totalInc = income + cashIn + bankIn;
      const totalExp = expense + cashOut + bankOut;

      // Kâr/Zarar = gelir - gider
      const profitLoss = totalInc - totalExp;
      const budget = project.budget || 0;
      const completionRate = budget > 0 ? Math.min((expense / budget) * 100, 100) : 0;

      return { project, income: totalInc, expense: totalExp, budget, checksGiven: pendingGivenChecks, checksPaid, profitLoss, completionRate };
    });

    setProjectSummaries(summaries);

    // Açılış bakiyeleri firma seviyesinde, toplama eklenir
    const cashOpeningIncome = (cashRegRes.data || []).reduce((s: number, c: any) => c.opening_balance > 0 ? s + c.opening_balance : s, 0);
    const cashOpeningExpense = (cashRegRes.data || []).reduce((s: number, c: any) => c.opening_balance < 0 ? s + Math.abs(c.opening_balance) : s, 0);
    const bankOpeningIncome = (bankAccRes.data || []).reduce((s: number, b: any) => b.opening_balance > 0 ? s + b.opening_balance : s, 0);
    const bankOpeningExpense = (bankAccRes.data || []).reduce((s: number, b: any) => b.opening_balance < 0 ? s + Math.abs(b.opening_balance) : s, 0);
    setOpeningBalances({ income: cashOpeningIncome + bankOpeningIncome, expense: cashOpeningExpense + bankOpeningExpense });
  };

  const [openingBalances, setOpeningBalances] = useState({ income: 0, expense: 0 });
  const totalIncome = projectSummaries.reduce((s, p) => s + p.income, 0) + openingBalances.income;
  const totalExpense = projectSummaries.reduce((s, p) => s + p.expense, 0) + openingBalances.expense;
  const totalBudget = projectSummaries.reduce((s, p) => s + p.budget, 0);
  const totalChecksGiven = projectSummaries.reduce((s, p) => s + p.checksGiven, 0);
  const totalChecksPaid = projectSummaries.reduce((s, p) => s + p.checksPaid, 0);
  const totalProfitLoss = totalIncome - totalExpense;
  const avgCompletionRate = totalBudget > 0 ? Math.min((totalExpense / totalBudget) * 100, 100) : 0;

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
    fetchProjectSummaries();
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
      fetchProjectSummaries();
    }
  };

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.firm?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFirm = !selectedFirm || p.firm_id === selectedFirm.id;
    return matchesSearch && matchesFirm;
  });

  const getStatusLabel = (status: string) => ({ active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' }[status] || status);
  const getStatusColor = (status: string) => ({ active: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-700' }[status] || 'bg-slate-100 text-slate-700');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Projeler</h1>
        <div className="flex items-center gap-2">
          {projectSummaries.length > 0 && (
            <button onClick={() => exportProjectsToExcel(projectSummaries)} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"><Download size={16} /> Excel</button>
          )}
          <button
            onClick={() => {
              setEditingProject(null);
              setFormData({ name: '', description: '', firm_id: selectedFirm?.id || '', start_date: formatDateTR(new Date()), end_date: '', budget: 0, status: 'active' });
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Yeni Proje
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Proje Özet Kartları */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            {selectedFirm ? `${selectedFirm.name} - Proje Özetleri` : 'Tüm Firmalar - Proje Özetleri'}
          </h2>
        </div>

        {projectSummaries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <FolderKanban size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">Henüz proje bulunamadı.</p>
          </div>
        ) : (
          <>
            {/* Toplam Özeti */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-600" />
                  <span className="text-xs text-green-700 font-medium">Proje Geliri</span>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-red-600" />
                  <span className="text-xs text-red-700 font-medium">Proje Gideri</span>
                </div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpense)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className="text-blue-600" />
                  <span className="text-xs text-blue-700 font-medium">Proje Bütçesi</span>
                </div>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-orange-600" />
                  <span className="text-xs text-orange-700 font-medium">Verilen Çekler</span>
                </div>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(totalChecksGiven)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-purple-600" />
                  <span className="text-xs text-purple-700 font-medium">Ödenen Çekler</span>
                </div>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(totalChecksPaid)}</p>
              </div>
              <div className={`rounded-xl p-4 border ${totalProfitLoss >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                  <span className={`text-xs font-medium ${totalProfitLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>Kar/Zarar</span>
                </div>
                <p className={`text-lg font-bold ${totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totalProfitLoss)}</p>
              </div>
            </div>

            {/* Proje Detayları Tablosu */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <ResizableTh columnId="proje-ad" className="text-left py-3 px-4">Proje</ResizableTh>
                      <ResizableTh columnId="proje-gelir" className="text-right py-3 px-4">Gelir</ResizableTh>
                      <ResizableTh columnId="proje-gider" className="text-right py-3 px-4">Gider</ResizableTh>
                      <ResizableTh columnId="proje-butce" className="text-right py-3 px-4">Bütçe</ResizableTh>
                      <ResizableTh columnId="proje-verilen-cek" className="text-right py-3 px-4">Verilen Çek</ResizableTh>
                      <ResizableTh columnId="proje-odenen-cek" className="text-right py-3 px-4">Ödenen Çek</ResizableTh>
                      <ResizableTh columnId="proje-kar" className="text-right py-3 px-4">Kar/Zarar</ResizableTh>
                      <ResizableTh columnId="proje-tamamlanma" className="text-center py-3 px-4">Tamamlanma</ResizableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {projectSummaries.map(ps => (
                      <tr key={ps.project.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <FolderKanban size={14} className="text-blue-500" />
                            <span className="font-medium">{ps.project.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-mono">{formatCurrency(ps.income)}</td>
                        <td className="py-3 px-4 text-right text-red-600 font-mono">{formatCurrency(ps.expense)}</td>
                        <td className="py-3 px-4 text-right text-blue-600 font-mono">{formatCurrency(ps.budget)}</td>
                        <td className="py-3 px-4 text-right text-orange-600 font-mono">{formatCurrency(ps.checksGiven)}</td>
                        <td className="py-3 px-4 text-right text-purple-600 font-mono">{formatCurrency(ps.checksPaid)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          <span className={ps.profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatCurrency(ps.profitLoss)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ps.completionRate >= 100 ? 'bg-red-500' : ps.completionRate >= 80 ? 'bg-amber-500' : ps.completionRate >= 50 ? 'bg-blue-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(ps.completionRate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-12 ${ps.completionRate >= 100 ? 'text-red-600' : ps.completionRate >= 80 ? 'text-amber-600' : ps.completionRate >= 50 ? 'text-blue-600' : 'text-green-600'}`}>
                              %{ps.completionRate.toFixed(0)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Toplam Satırı */}
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                      <td className="py-3 px-4">TOPLAM</td>
                      <td className="py-3 px-4 text-right text-green-600 font-mono">{formatCurrency(totalIncome)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-mono">{formatCurrency(totalExpense)}</td>
                      <td className="py-3 px-4 text-right text-blue-600 font-mono">{formatCurrency(totalBudget)}</td>
                      <td className="py-3 px-4 text-right text-orange-600 font-mono">{formatCurrency(totalChecksGiven)}</td>
                      <td className="py-3 px-4 text-right text-purple-600 font-mono">{formatCurrency(totalChecksPaid)}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatCurrency(totalProfitLoss)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-bold ${avgCompletionRate >= 100 ? 'text-red-600' : avgCompletionRate >= 80 ? 'text-amber-600' : avgCompletionRate >= 50 ? 'text-blue-600' : 'text-green-600'}`}>
                          %{avgCompletionRate.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Proje Kartları */}
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
        {filtered.map(project => {
          const summary = projectSummaries.find(ps => ps.project.id === project.id);
          return (
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
                {summary && <div>K/Z: <span className={summary.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(summary.profitLoss)}</span></div>}
              </div>

              {/* Tamamlanma Çubuğu */}
              {summary && summary.budget > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Tamamlanma</span>
                    <span className={`font-bold ${summary.completionRate >= 100 ? 'text-red-600' : summary.completionRate >= 80 ? 'text-amber-600' : summary.completionRate >= 50 ? 'text-blue-600' : 'text-green-600'}`}>
                      %{summary.completionRate.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${summary.completionRate >= 100 ? 'bg-red-500' : summary.completionRate >= 80 ? 'bg-amber-500' : summary.completionRate >= 50 ? 'bg-blue-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(summary.completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => handleEdit(project)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors">
                  <Edit2 size={14} />Düzenle
                </button>
                <button onClick={() => handleDelete(project.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
                  <Trash2 size={14} />Sil
                </button>
              </div>
            </div>
          );
        })}
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
