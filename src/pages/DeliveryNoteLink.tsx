import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import { Link2, Unlink, Search, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description: string;
  invoice_number: string;
  delivery_note_number: string;
  linked_invoice_id: string | null;
  cari?: { name: string };
  project?: { name: string };
}

export default function DeliveryNoteLink() {
  const { selectedFirm } = useFirm();
  const [deliveryNotes, setDeliveryNotes] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedDN, setSelectedDN] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [searchDN, setSearchDN] = useState('');
  const [searchInvoice, setSearchInvoice] = useState('');

  useEffect(() => { fetchData(); }, [selectedFirm]);

  const fetchData = async () => {
    setLoading(true);
    
    // Bağlı olmayan irsaliyeleri çek
    let dnQuery = supabase
      .from('transactions')
      .select('id, transaction_date, transaction_type, amount, description, delivery_note_number, linked_invoice_id, cari_id, project_id')
      .in('transaction_type', ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'])
      .is('linked_invoice_id', null)
      .order('transaction_date', { ascending: false });
    
    if (selectedFirm) dnQuery = dnQuery.eq('firm_id', selectedFirm.id);
    const { data: dnData } = await dnQuery;

    if (dnData && dnData.length > 0) {
      const dnCariIds = [...new Set(dnData.map(d => d.cari_id).filter(Boolean))];
      const dnProjIds = [...new Set(dnData.map(d => d.project_id).filter(Boolean))];
      
      const [dnCariRes, dnProjRes] = await Promise.all([
        dnCariIds.length > 0 ? supabase.from('cariler').select('id, name').in('id', dnCariIds) : { data: [] },
        dnProjIds.length > 0 ? supabase.from('projects').select('id, name').in('id', dnProjIds) : { data: [] },
      ]);
      
      const dnCariMap = new Map((dnCariRes.data || []).map(c => [c.id, c.name]));
      const dnProjMap = new Map((dnProjRes.data || []).map(p => [p.id, p.name]));
      
      const enrichedDN = dnData.map(dn => ({
        ...dn,
        cari: { name: dnCariMap.get(dn.cari_id) || '-' },
        project: { name: dnProjMap.get(dn.project_id) || '-' },
      }));
      setDeliveryNotes(enrichedDN);
    } else {
      setDeliveryNotes([]);
    }

    // Faturaları çek
    let invQuery = supabase
      .from('transactions')
      .select('id, transaction_date, transaction_type, amount, description, invoice_number, cari_id, project_id, firm_id')
      .in('transaction_type', ['invoice', 'sale_invoice', 'purchase_invoice'])
      .order('transaction_date', { ascending: false });
    
    if (selectedFirm) invQuery = invQuery.eq('firm_id', selectedFirm.id);
    const { data: invData } = await invQuery;

    // Cari ve proje bilgilerini ayrı çek
    if (invData && invData.length > 0) {
      const cariIds = [...new Set(invData.map(i => i.cari_id).filter(Boolean))];
      const projectIds = [...new Set(invData.map(i => i.project_id).filter(Boolean))];
      
      const [cariRes, projRes] = await Promise.all([
        cariIds.length > 0 ? supabase.from('cariler').select('id, name').in('id', cariIds) : { data: [] },
        projectIds.length > 0 ? supabase.from('projects').select('id, name').in('id', projectIds) : { data: [] },
      ]);
      
      const cariMap = new Map((cariRes.data || []).map(c => [c.id, c.name]));
      const projMap = new Map((projRes.data || []).map(p => [p.id, p.name]));
      
      const enriched = invData.map(inv => ({
        ...inv,
        cari: { name: cariMap.get(inv.cari_id) || '-' },
        project: { name: projMap.get(inv.project_id) || '-' },
      }));
      setInvoices(enriched);
    } else {
      setInvoices([]);
    }

    setLoading(false);
  };

  const linkDeliveryNote = async () => {
    if (!selectedDN || !selectedInvoice) {
      setMessage({ type: 'error', text: 'Lütfen irsaliye ve fatura seçin!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const dn = deliveryNotes.find(d => d.id === selectedDN);
    const inv = invoices.find(i => i.id === selectedInvoice);

    if (!dn || !inv) {
      setMessage({ type: 'error', text: 'İrsaliye veya fatura bulunamadı!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Kontrol: Aynı firma, proje, cari
    // (Basit kontrol - detaylı kontrol sonra eklenebilir)
    
    // Tarih kontrolü: ±7 gün
    const dnDate = new Date(dn.transaction_date);
    const invDate = new Date(inv.transaction_date);
    const diffDays = Math.abs((dnDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 7) {
      setMessage({ type: 'error', text: 'İrsaliye ve fatura tarihleri 7 günden fazla fark edemez!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Bağlantıyı kur
    const { error } = await supabase
      .from('transactions')
      .update({ linked_invoice_id: selectedInvoice })
      .eq('id', selectedDN);

    if (error) {
      setMessage({ type: 'error', text: 'Bağlantı hatası: ' + error.message });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setMessage({ type: 'success', text: 'İrsaliye faturaya bağlandı!' });
    setSelectedDN(null);
    setSelectedInvoice(null);
    fetchData();
    setTimeout(() => setMessage(null), 3000);
  };

  const unlinkDeliveryNote = async (dnId: string) => {
    const { error } = await supabase
      .from('transactions')
      .update({ linked_invoice_id: null })
      .eq('id', dnId);

    if (error) {
      setMessage({ type: 'error', text: 'Bağlantı kaldırma hatası: ' + error.message });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setMessage({ type: 'success', text: 'İrsaliye-fatura bağlantısı kaldırıldı!' });
    fetchData();
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredDN = deliveryNotes.filter(dn => {
    const search = searchDN.toLowerCase();
    return dn.cari?.name?.toLowerCase().includes(search) || 
           dn.description?.toLowerCase().includes(search) ||
           dn.delivery_note_number?.toLowerCase().includes(search);
  });

  const filteredInvoices = invoices.filter(inv => {
    const search = searchInvoice.toLowerCase();
    return inv.cari?.name?.toLowerCase().includes(search) || 
           inv.description?.toLowerCase().includes(search) ||
           inv.invoice_number?.toLowerCase().includes(search);
  });

  const getTypeLabel = (type: string) => ({
    delivery_note: 'İrsaliye',
    sale_delivery_note: 'Satış İrsaliyesi',
    purchase_delivery_note: 'Alış İrsaliyesi',
    invoice: 'Fatura',
    sale_invoice: 'Satış Faturası',
    purchase_invoice: 'Alış Faturası',
  }[type] || type);

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
          <Link2 size={24} />
          İrsaliye-Fatura Bağlantısı{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-6">
        <p className="text-sm text-blue-700">
          <strong>Nasıl çalışır:</strong> Sol taraftan irsaliye, sağ taraftan fatura seçin. 
          Aynı firma, proje ve cari olan, tarih farkı 7 günden az olan irsaliye ve faturaları bağlayabilirsiniz.
          Bağlı irsaliyeler listede görünmez.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: İrsaliyeler */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800 mb-2">Bağlı Olmayan İrsaliyeler</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="İrsaliye ara..." value={searchDN} onChange={(e) => setSearchDN(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filteredDN.map(dn => (
              <div
                key={dn.id}
                onClick={() => setSelectedDN(dn.id)}
                className={`p-3 border-b border-slate-100 cursor-pointer transition-colors ${
                  selectedDN === dn.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{getTypeLabel(dn.transaction_type)}</span>
                  <span className="text-xs text-slate-500">{formatDateTR(dn.transaction_date)}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">{dn.cari?.name || '-'}</p>
                <p className="text-xs text-slate-500 truncate">{dn.description || '-'}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{formatCurrency(dn.amount)}</p>
              </div>
            ))}
            {filteredDN.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Tüm irsaliyeler bağlı</p>}
          </div>
        </div>

        {/* Orta: Bağlantı butonu */}
        <div className="flex flex-col items-center justify-center gap-4">
          <button
            onClick={linkDeliveryNote}
            disabled={!selectedDN || !selectedInvoice}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Link2 size={18} />
            Bağla
            <ArrowRight size={18} />
          </button>
          {selectedDN && <p className="text-xs text-slate-500 text-center">İrsaliye seçildi</p>}
          {selectedInvoice && <p className="text-xs text-slate-500 text-center">Fatura seçildi</p>}
        </div>

        {/* Sağ: Faturalar */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800 mb-2">Faturalar</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Fatura ara..." value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filteredInvoices.map(inv => (
              <div
                key={inv.id}
                onClick={() => setSelectedInvoice(inv.id)}
                className={`p-3 border-b border-slate-100 cursor-pointer transition-colors ${
                  selectedInvoice === inv.id ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{getTypeLabel(inv.transaction_type)}</span>
                  <span className="text-xs text-slate-500">{formatDateTR(inv.transaction_date)}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">{inv.cari?.name || '-'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Firma: {inv.firm?.name || '-'}</span>
                  <span className="text-xs text-slate-500">Proje: {inv.project?.name || '-'}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">No: {inv.invoice_number || '-'}</span>
                  <span className="text-sm font-bold text-slate-700">{formatCurrency(inv.amount)}</span>
                </div>
              </div>
            ))}
            {filteredInvoices.length === 0 && <p className="text-center py-8 text-slate-500 text-sm">Fatura bulunamadı</p>}
          </div>
        </div>
      </div>
      {/* Seçili Faturaya Bağlı İrsaliyeler */}
      {selectedInvoice && (() => {
        const linkedDNs = deliveryNotes.filter(dn => dn.linked_invoice_id === selectedInvoice);
        if (linkedDNs.length === 0) return null;
        return (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-orange-50">
              <h3 className="font-semibold text-orange-800">Seçili Faturaya Bağlı İrsaliyeler ({linkedDNs.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {linkedDNs.map(dn => (
                <div key={dn.id} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded mr-2">{getTypeLabel(dn.transaction_type)}</span>
                    <span className="text-sm font-medium">{dn.cari?.name || '-'}</span>
                    <span className="text-xs text-slate-500 ml-2">{formatDateTR(dn.transaction_date)}</span>
                    <span className="text-sm font-bold ml-2">{formatCurrency(dn.amount)}</span>
                  </div>
                  <button
                    onClick={() => unlinkDeliveryNote(dn.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                  >
                    <Unlink size={14} />
                    Ayır
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
