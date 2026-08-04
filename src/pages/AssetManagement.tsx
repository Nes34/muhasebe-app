import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import type { FixedAsset, VehicleDetail, Personnel } from '../types';
import { Package, Plus, Edit2, Trash2, Search, Car, AlertTriangle, CheckCircle, X, Fuel, Wrench, Calendar, User } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

const CATEGORIES = [
  { value: 'vehicle', label: 'Araç', icon: Car },
  { value: 'computer', label: 'Bilgisayar', icon: Package },
  { value: 'furniture', label: 'Mobilya', icon: Package },
  { value: 'machine', label: 'Makine', icon: Wrench },
  { value: 'other', label: 'Diğer', icon: Package },
];

const FUEL_TYPES = [
  { value: 'diesel', label: 'Dizel' },
  { value: 'gasoline', label: 'Benzin' },
  { value: 'lpg', label: 'LPG' },
  { value: 'electric', label: 'Elektrik' },
  { value: 'hybrid', label: 'Hibrit' },
];

export default function AssetManagement() {
  const { selectedFirm } = useFirm();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'vehicle', purchase_date: '', purchase_price: 0,
    useful_life: 5, location: '', department: '', firm_id: '', project_id: '', serial_number: '', barcode: '', notes: '',
    // Vehicle fields
    plate_number: '', brand: '', model: '', year: new Date().getFullYear(), color: '',
    engine_type: '', fuel_type: 'diesel',
  });

  // Vehicle detail state
  const [vehicleData, setVehicleData] = useState<VehicleDetail | null>(null);
  const [showKmForm, setShowKmForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [showMtvForm, setShowMtvForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // Sub-form states
  const [kmForm, setKmForm] = useState({ record_date: new Date().toISOString().split('T')[0], km_value: 0, notes: '' });
  const [fuelForm, setFuelForm] = useState({ fuel_date: new Date().toISOString().split('T')[0], fuel_type: 'diesel', liters: 0, amount: 0, km_at_fuel: 0, station: '', notes: '' });
  const [penaltyForm, setPenaltyForm] = useState({ penalty_date: new Date().toISOString().split('T')[0], penalty_type: '', amount: 0, points: 0, description: '' });
  const [mtvForm, setMtvForm] = useState({ year: new Date().getFullYear(), installment_1_amount: 0, installment_1_due: '', installment_2_amount: 0, installment_2_due: '' });
  const [assignForm, setAssignForm] = useState({ personnel_id: '', assignment_date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { fetchData(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    let assetsQuery = supabase.from('fixed_assets').select('*').order('name');
    if (selectedFirm) assetsQuery = assetsQuery.eq('firm_id', selectedFirm.id);
    const { data: assetsData } = await assetsQuery;
    if (assetsData) setAssets(assetsData);

    const { data: personnelData } = await supabase.from('personnel').select('*').eq('status', 'active').order('first_name');
    if (personnelData) setPersonnel(personnelData);
    setLoading(false);
  };

  const generateAssetCode = () => {
    const prefix = formData.category === 'vehicle' ? 'AR' : formData.category === 'computer' ? 'BL' : formData.category === 'furniture' ? 'MB' : 'MK';
    const lastCode = assets.filter(a => a.asset_code.startsWith(prefix)).sort((a, b) => b.asset_code.localeCompare(a.asset_code))[0]?.asset_code;
    const nextNum = lastCode ? parseInt(lastCode.slice(2)) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assetCode = editingAsset ? editingAsset.asset_code : generateAssetCode();
      const current_value = editingAsset ? editingAsset.current_value : formData.purchase_price;

      if (editingAsset) {
        await supabase.from('fixed_assets').update({
          name: formData.name, description: formData.description, category: formData.category,
          purchase_date: formData.purchase_date || null, purchase_price: formData.purchase_price,
          current_value, useful_life: formData.useful_life, location: formData.location,
          department: formData.department, firm_id: selectedFirm?.id || formData.firm_id || null,
          project_id: formData.project_id || null, serial_number: formData.serial_number,
          barcode: formData.barcode, notes: formData.notes,
        }).eq('id', editingAsset.id);
        setMessage({ type: 'success', text: 'Demirbaş güncellendi!' });
      } else {
        const { data: newAsset, error } = await supabase.from('fixed_assets').insert({
          asset_code: assetCode, name: formData.name, description: formData.description,
          category: formData.category, purchase_date: formData.purchase_date || null,
          purchase_price: formData.purchase_price, current_value, depreciation_rate: formData.useful_life > 0 ? 100 / formData.useful_life : 0,
          useful_life: formData.useful_life, location: formData.location, department: formData.department,
          firm_id: selectedFirm?.id || formData.firm_id || null, project_id: formData.project_id || null,
          status: 'active', serial_number: formData.serial_number, barcode: formData.barcode, notes: formData.notes,
        }).select().single();
        if (error) throw error;

        // Create vehicle detail if category is vehicle
        if (formData.category === 'vehicle' && newAsset) {
          await supabase.from('vehicle_details').insert({
            asset_id: newAsset.id, plate_number: formData.plate_number, brand: formData.brand,
            model: formData.model, year: formData.year, color: formData.color,
            engine_type: formData.engine_type, fuel_type: formData.fuel_type,
          });
        }
        setMessage({ type: 'success', text: 'Demirbaş eklendi!' });
      }
      setShowForm(false);
      setEditingAsset(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Hata oluştu!' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEdit = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name, description: asset.description || '', category: asset.category,
      purchase_date: asset.purchase_date || '', purchase_price: asset.purchase_price,
      useful_life: asset.useful_life, location: asset.location || '', department: asset.department || '',
      firm_id: asset.firm_id || '', project_id: asset.project_id || '',
      serial_number: asset.serial_number || '', barcode: asset.barcode || '', notes: asset.notes || '',
      plate_number: asset.vehicle?.plate_number || '', brand: asset.vehicle?.brand || '',
      model: asset.vehicle?.model || '', year: asset.vehicle?.year || new Date().getFullYear(),
      color: asset.vehicle?.color || '', engine_type: asset.vehicle?.engine_type || '',
      fuel_type: asset.vehicle?.fuel_type || 'diesel',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu demirbaşı silmek istediğinize emin misiniz?')) return;
    await supabase.from('fixed_assets').delete().eq('id', id);
    fetchData();
  };

  const handleViewDetail = async (asset: FixedAsset) => {
    setSelectedAsset(asset);
    if (asset.category === 'vehicle') {
      const { data } = await supabase.from('vehicle_details').select('*').eq('asset_id', asset.id).single();
      if (data) setVehicleData(data);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', category: 'vehicle', purchase_date: '', purchase_price: 0,
      useful_life: 5, location: '', department: '', firm_id: '', project_id: '', serial_number: '', barcode: '', notes: '',
      plate_number: '', brand: '', model: '', year: new Date().getFullYear(), color: '',
      engine_type: '', fuel_type: 'diesel',
    });
  };

  const handleAddKm = async () => {
    if (!selectedAsset) return;
    await supabase.from('vehicle_km_records').insert({ asset_id: selectedAsset.id, ...kmForm });
    await supabase.from('vehicle_details').update({ current_km: kmForm.km_value }).eq('asset_id', selectedAsset.id);
    setShowKmForm(false);
    setKmForm({ record_date: new Date().toISOString().split('T')[0], km_value: 0, notes: '' });
    handleViewDetail(selectedAsset);
    setMessage({ type: 'success', text: 'KM kaydı eklendi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddFuel = async () => {
    if (!selectedAsset) return;
    await supabase.from('vehicle_fuel_records').insert({ asset_id: selectedAsset.id, ...fuelForm });
    setShowFuelForm(false);
    setFuelForm({ fuel_date: new Date().toISOString().split('T')[0], fuel_type: 'diesel', liters: 0, amount: 0, km_at_fuel: 0, station: '', notes: '' });
    setMessage({ type: 'success', text: 'Yakıt kaydı eklendi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddPenalty = async () => {
    if (!selectedAsset) return;
    await supabase.from('vehicle_penalties').insert({ asset_id: selectedAsset.id, ...penaltyForm, status: 'unpaid' });
    setShowPenaltyForm(false);
    setPenaltyForm({ penalty_date: new Date().toISOString().split('T')[0], penalty_type: '', amount: 0, points: 0, description: '' });
    setMessage({ type: 'success', text: 'Ceza kaydı eklendi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddMtv = async () => {
    if (!selectedAsset) return;
    await supabase.from('vehicle_mtv').insert({ asset_id: selectedAsset.id, ...mtvForm });
    setShowMtvForm(false);
    setMtvForm({ year: new Date().getFullYear(), installment_1_amount: 0, installment_1_due: '', installment_2_amount: 0, installment_2_due: '' });
    setMessage({ type: 'success', text: 'MTV kaydı eklendi!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAssign = async () => {
    if (!selectedAsset) return;
    await supabase.from('vehicle_assignments').insert({ asset_id: selectedAsset.id, ...assignForm });
    await supabase.from('vehicle_details').update({ assigned_to: assignForm.personnel_id, assignment_date: assignForm.assignment_date }).eq('asset_id', selectedAsset.id);
    setShowAssignForm(false);
    setAssignForm({ personnel_id: '', assignment_date: new Date().toISOString().split('T')[0], notes: '' });
    handleViewDetail(selectedAsset);
    setMessage({ type: 'success', text: 'Zimmet atandı!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const filtered = assets.filter(a => {
    const matchesSearch = `${a.name} ${a.asset_code} ${a.serial_number} ${a.barcode} ${a.vehicle?.plate_number || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || a.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getCategoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getStatusColor = (status: string) => ({ active: 'bg-green-100 text-green-700', disposed: 'bg-red-100 text-red-700', maintenance: 'bg-yellow-100 text-yellow-700' }[status] || 'bg-slate-100 text-slate-700');
  const getStatusLabel = (status: string) => ({ active: 'Aktif', disposed: 'Satıldı', maintenance: 'Bakımda' }[status] || status);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package size={24} />Demirbaş Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}</h1>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setEditingAsset(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus size={16} />Yeni Demirbaş</button>
        </div>
      </div>

      {message && <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}{message.text}</div>}

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Demirbaş, kod, plaka ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">Tüm Kategoriler</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="disposed">Satıldı</option>
            <option value="maintenance">Bakımda</option>
          </select>
        </div>
      </div>

      {/* Demirbaş Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="a-kod" className="text-left py-3 px-4">Kod</ResizableTh>
                <ResizableTh columnId="a-ad" className="text-left py-3 px-4">Ad</ResizableTh>
                <ResizableTh columnId="a-kategori" className="text-left py-3 px-4">Kategori</ResizableTh>
                <ResizableTh columnId="a-plaka" className="text-left py-3 px-4">Plaka</ResizableTh>
                <ResizableTh columnId="a-alis" className="text-right py-3 px-4">Alış Fiyatı</ResizableTh>
                <ResizableTh columnId="a-guncel" className="text-right py-3 px-4">Güncel Değer</ResizableTh>
                <ResizableTh columnId="a-durum" className="text-center py-3 px-4">Durum</ResizableTh>
                <ResizableTh columnId="a-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => (
                <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{asset.asset_code}</td>
                  <td className="py-3 px-4 font-medium">{asset.name}</td>
                  <td className="py-3 px-4">{getCategoryLabel(asset.category)}</td>
                  <td className="py-3 px-4">{asset.vehicle?.plate_number || '-'}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(asset.purchase_price)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(asset.current_value)}</td>
                  <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>{getStatusLabel(asset.status)}</span></td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleViewDetail(asset)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Detay"><Car size={14} /></button>
                      <button onClick={() => handleEdit(asset)} className="p-1 text-slate-600 hover:bg-slate-50 rounded" title="Düzenle"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(asset.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center py-8 text-slate-500">Demirbaş bulunamadı.</p>}
      </div>

      {/* Yeni/Düzenleme Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingAsset ? 'Demirbaş Düzenle' : 'Yeni Demirbaş'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Ad *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Alış Tarihi</label><input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Alış Fiyatı</label><input type="number" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Faydalı Ömür (Yıl)</label><input type="number" value={formData.useful_life} onChange={(e) => setFormData({ ...formData, useful_life: parseInt(e.target.value) || 5 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Seri No</label><input type="text" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Konum</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Departman</label><input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              </div>

              {/* Araç alanları */}
              {formData.category === 'vehicle' && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Araç Bilgileri</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Plaka *</label><input type="text" value={formData.plate_number} onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required={formData.category === 'vehicle'} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Marka</label><input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Model</label><input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Yıl</label><input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Renk</label><input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Yakıt Tipi</label><select value={formData.fuel_type} onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">{FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditingAsset(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingAsset ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedAsset.name} - Detay</h2>
              <button onClick={() => { setSelectedAsset(null); setVehicleData(null); }} className="p-2 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>

            {/* Genel Bilgiler */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Kod</p><p className="font-medium">{selectedAsset.asset_code}</p></div>
              <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Kategori</p><p className="font-medium">{getCategoryLabel(selectedAsset.category)}</p></div>
              <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Alış Fiyatı</p><p className="font-medium">{formatCurrency(selectedAsset.purchase_price)}</p></div>
              <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Güncel Değer</p><p className="font-medium">{formatCurrency(selectedAsset.current_value)}</p></div>
            </div>

            {/* Araç Detayları */}
            {vehicleData && (
              <div className="border-t pt-4 mb-6">
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><Car size={18} />Araç Bilgileri</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Plaka</p><p className="font-bold text-blue-800">{vehicleData.plate_number}</p></div>
                  <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Marka/Model</p><p className="font-medium">{vehicleData.brand} {vehicleData.model}</p></div>
                  <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">Yıl</p><p className="font-medium">{vehicleData.year}</p></div>
                  <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600">KM</p><p className="font-bold">{vehicleData.current_km.toLocaleString()}</p></div>
                  <div className="bg-green-50 p-3 rounded-lg"><p className="text-xs text-green-600">Sigorta</p><p className="font-medium">{vehicleData.insurance_company || '-'}</p></div>
                  <div className="bg-green-50 p-3 rounded-lg"><p className="text-xs text-green-600">Sigorta Bitiş</p><p className="font-medium">{vehicleData.insurance_end ? formatDateTR(vehicleData.insurance_end) : '-'}</p></div>
                  <div className="bg-purple-50 p-3 rounded-lg"><p className="text-xs text-purple-600">Muayene</p><p className="font-medium">{vehicleData.next_inspection_date ? formatDateTR(vehicleData.next_inspection_date) : '-'}</p></div>
                  <div className="bg-orange-50 p-3 rounded-lg"><p className="text-xs text-orange-600">Sonraki Bakım</p><p className="font-medium">{vehicleData.next_maintenance_km.toLocaleString()} KM</p></div>
                </div>

                {/* Zimmetli Personel */}
                {vehicleData.assigned_to && (
                  <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-600 flex items-center gap-1"><User size={14} />Zimmetli Personel</p>
                    <p className="font-medium">{personnel.find(p => p.id === vehicleData.assigned_to)?.first_name} {personnel.find(p => p.id === vehicleData.assigned_to)?.last_name}</p>
                    <p className="text-xs text-slate-500">Zimmet Tarihi: {vehicleData.assignment_date ? formatDateTR(vehicleData.assignment_date) : '-'}</p>
                  </div>
                )}

                {/* Hızlı İşlem Butonları */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => setShowKmForm(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"><Wrench size={14} />KM Güncelle</button>
                  <button onClick={() => setShowFuelForm(true)} className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"><Fuel size={14} />Yakıt Ekle</button>
                  <button onClick={() => setShowPenaltyForm(true)} className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"><AlertTriangle size={14} />Ceza Ekle</button>
                  <button onClick={() => setShowMtvForm(true)} className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm"><Calendar size={14} />MTV Ekle</button>
                  <button onClick={() => setShowAssignForm(true)} className="flex items-center gap-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm"><User size={14} />Zimmetle</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KM Güncelleme Modal */}
      {showKmForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">KM Güncelle</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label><input type="date" value={kmForm.record_date} onChange={(e) => setKmForm({ ...kmForm, record_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">KM Değeri</label><input type="number" value={kmForm.km_value} onChange={(e) => setKmForm({ ...kmForm, km_value: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Not</label><input type="text" value={kmForm.notes} onChange={(e) => setKmForm({ ...kmForm, notes: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowKmForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button onClick={handleAddKm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yakıt Ekleme Modal */}
      {showFuelForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Yakıt Ekle</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label><input type="date" value={fuelForm.fuel_date} onChange={(e) => setFuelForm({ ...fuelForm, fuel_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Yakıt Tipi</label><select value={fuelForm.fuel_type} onChange={(e) => setFuelForm({ ...fuelForm, fuel_type: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">{FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Litre</label><input type="number" step="0.01" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label><input type="number" step="0.01" value={fuelForm.amount} onChange={(e) => setFuelForm({ ...fuelForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">KM</label><input type="number" value={fuelForm.km_at_fuel} onChange={(e) => setFuelForm({ ...fuelForm, km_at_fuel: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">İstasyon</label><input type="text" value={fuelForm.station} onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowFuelForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button onClick={handleAddFuel} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ceza Ekleme Modal */}
      {showPenaltyForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Ceza Ekle</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label><input type="date" value={penaltyForm.penalty_date} onChange={(e) => setPenaltyForm({ ...penaltyForm, penalty_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Ceza Türü</label><input type="text" value={penaltyForm.penalty_type} onChange={(e) => setPenaltyForm({ ...penaltyForm, penalty_type: e.target.value })} placeholder="Hız, Park, Kırmızı ışık..." className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar</label><input type="number" step="0.01" value={penaltyForm.amount} onChange={(e) => setPenaltyForm({ ...penaltyForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Ceza Puanı</label><input type="number" value={penaltyForm.points} onChange={(e) => setPenaltyForm({ ...penaltyForm, points: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label><input type="text" value={penaltyForm.description} onChange={(e) => setPenaltyForm({ ...penaltyForm, description: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowPenaltyForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button onClick={handleAddPenalty} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MTV Ekleme Modal */}
      {showMtvForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">MTV Ekle</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Yıl</label><input type="number" value={mtvForm.year} onChange={(e) => setMtvForm({ ...mtvForm, year: parseInt(e.target.value) || new Date().getFullYear() })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">1. Taksit Tutarı</label><input type="number" step="0.01" value={mtvForm.installment_1_amount} onChange={(e) => setMtvForm({ ...mtvForm, installment_1_amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">1. Taksit Vade</label><input type="date" value={mtvForm.installment_1_due} onChange={(e) => setMtvForm({ ...mtvForm, installment_1_due: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">2. Taksit Tutarı</label><input type="number" step="0.01" value={mtvForm.installment_2_amount} onChange={(e) => setMtvForm({ ...mtvForm, installment_2_amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">2. Taksit Vade</label><input type="date" value={mtvForm.installment_2_due} onChange={(e) => setMtvForm({ ...mtvForm, installment_2_due: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMtvForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button onClick={handleAddMtv} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zimmetleme Modal */}
      {showAssignForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Personel Zimmetle</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Personel</label><select value={assignForm.personnel_id} onChange={(e) => setAssignForm({ ...assignForm, personnel_id: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg"><option value="">Seçin...</option>{personnel.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Zimmet Tarihi</label><input type="date" value={assignForm.assignment_date} onChange={(e) => setAssignForm({ ...assignForm, assignment_date: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Not</label><input type="text" value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAssignForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
                <button onClick={handleAssign} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Zimmetle</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
