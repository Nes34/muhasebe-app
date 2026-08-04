import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import { FolderOpen, Upload, Download, Trash2, Search, FileText, Image, File, AlertTriangle, CheckCircle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  firm_id?: string;
  project_id?: string;
  file_url: string;
  file_size: number;
  uploaded_by?: string;
  created_at: string;
  firm?: { name: string };
  project?: { name: string };
}

const CATEGORIES = [
  { value: 'invoice', label: 'Fatura' },
  { value: 'delivery_note', label: 'İrsaliye' },
  { value: 'contract', label: 'Sözleşme' },
  { value: 'receipt', label: 'Makbuz' },
  { value: 'report', label: 'Rapor' },
  { value: 'other', label: 'Diğer' },
];

export default function DocumentManagement() {
  const { selectedFirm } = useFirm();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [uploadData, setUploadData] = useState({
    name: '',
    category: 'invoice',
    firm_id: '',
    project_id: '',
  });

  useEffect(() => { fetchDocuments(); }, [selectedFirm]);

  const fetchDocuments = async () => {
    setLoading(true);
    // Supabase storage'dan dosyaları çek
    // Şimdilik boş liste göster, storage entegrasyonu sonrası dolacak
    setDocuments([]);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Supabase storage'a yükle
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (error) throw error;

      // Dosya bilgilerini kaydet
      const { error: insertError } = await supabase.from('documents').insert({
        name: uploadData.name || file.name,
        type: file.type,
        category: uploadData.category,
        firm_id: selectedFirm?.id || uploadData.firm_id || null,
        project_id: uploadData.project_id || null,
        file_url: data?.path || fileName,
        file_size: file.size,
      });

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Dosya yüklendi!' });
      setShowUpload(false);
      setUploadData({ name: '', category: 'invoice', firm_id: '', project_id: '' });
      fetchDocuments();
    } catch (err) {
      setMessage({ type: 'error', text: 'Yükleme hatası! Supabase storage yapılandırması gerekiyor.' });
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getFileIcon = (type: string) => {
    if (type?.includes('pdf')) return <FileText size={20} className="text-red-500" />;
    if (type?.includes('image')) return <Image size={20} className="text-blue-500" />;
    return <File size={20} className="text-slate-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryLabel = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

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
          <FolderOpen size={24} />
          Doküman Yönetimi{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload size={16} />
          Dosya Yükle
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Bilgi */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
        <p className="text-sm text-blue-700">
          <strong>Not:</strong> Doküman yönetimi için Supabase Storage yapılandırması gerekiyor.
          Storage bucket oluşturulduktan sonra dosya yükleme ve görüntüleme aktif olacaktır.
        </p>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Doküman ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Tüm Kategoriler</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Doküman Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="d-tip" className="text-left py-3 px-4">Tür</ResizableTh>
                <ResizableTh columnId="d-ad" className="text-left py-3 px-4">Dosya Adı</ResizableTh>
                <ResizableTh columnId="d-kategori" className="text-left py-3 px-4">Kategori</ResizableTh>
                <ResizableTh columnId="d-boyut" className="text-right py-3 px-4">Boyut</ResizableTh>
                <ResizableTh columnId="d-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
                <ResizableTh columnId="d-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <FolderOpen size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium">Henüz doküman yok</p>
                    <p className="text-sm mt-1">Supabase Storage yapılandırıldıktan sonra dosya yükleyebilirsiniz.</p>
                  </td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">{getFileIcon(doc.type)}</td>
                    <td className="py-3 px-4 font-medium">{doc.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">{getCategoryLabel(doc.category)}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatFileSize(doc.file_size)}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDateTR(doc.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="İndir">
                          <Download size={14} />
                        </button>
                        <button className="p-1 text-red-600 hover:bg-red-50 rounded" title="Sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yükleme Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Dosya Yükle</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dosya Adı</label>
                <input
                  type="text"
                  value={uploadData.name}
                  onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                  placeholder="Dosya açıklaması"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                <select
                  value={uploadData.category}
                  onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dosya Seç</label>
                <input
                  type="file"
                  onChange={handleUpload}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  disabled={uploading}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
