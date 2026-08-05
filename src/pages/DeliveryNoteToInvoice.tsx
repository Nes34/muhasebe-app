import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import { Truck, ArrowRight, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface DeliveryNote {
  id: string;
  transaction_date: string;
  transaction_type: string;
  cari_id: string;
  firm_id: string;
  project_id: string;
  amount: number;
  description: string;
  delivery_note_number: string;
  cari?: { name: string };
  firm?: { name: string };
  project?: { name: string };
  items?: any[];
}

export default function DeliveryNoteToInvoice() {
  const { selectedFirm } = useFirm();
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => { fetchDeliveryNotes(); }, [selectedFirm]);

  const fetchDeliveryNotes = async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, cari:cariler(*), firm:firms(*), project:projects(*)')
      .in('transaction_type', ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'])
      .order('transaction_date', { ascending: false });
    
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    
    const { data } = await query;
    if (data) setDeliveryNotes(data);
    setLoading(false);
  };

  const convertToInvoice = async (note: DeliveryNote) => {
    setConverting(note.id);
    try {
      // İrsaliye kalemlerini çek
      const { data: items } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', note.id);

      // Fatura türünü belirle
      const invoiceType = note.transaction_type === 'sale_delivery_note' ? 'sale_invoice' : 
                          note.transaction_type === 'purchase_delivery_note' ? 'purchase_invoice' : 'invoice';
      
      // Yeni fatura numarası oluştur
      const prefix = invoiceType === 'sale_invoice' ? 'SF' : 'AF';
      const { data: lastInvoice } = await supabase
        .from('transactions')
        .select('invoice_number')
        .like('invoice_number', `${prefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1);
      
      let nextNum = 1;
      if (lastInvoice && lastInvoice.length > 0) {
        const lastNum = parseInt(lastInvoice[0].invoice_number?.replace(prefix, '') || '0');
        nextNum = lastNum + 1;
      }
      const invoiceNumber = `${prefix}${String(nextNum).padStart(9, '0')}`;

      // Fatura oluştur
      const { data: newInvoice, error } = await supabase
        .from('transactions')
        .insert({
          transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: invoiceType,
          firm_id: note.firm_id,
          cari_id: note.cari_id,
          project_id: note.project_id,
          amount: note.amount,
          invoice_number: invoiceNumber,
          description: note.description ? `İrsaliye ${note.delivery_note_number || ''} - ${note.description}` : `İrsaliye ${note.delivery_note_number || ''} faturası`,
          currency: 'TRY',
          exchange_rate: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Kalemleri kopyala
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          transaction_id: newInvoice.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          discount_rate: item.discount_rate,
          discount_amount: item.discount_amount,
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      setMessage({ type: 'success', text: `İrsaliye faturaya dönüştürüldü! Fatura No: ${invoiceNumber}` });
      fetchDeliveryNotes();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Dönüştürme hatası: ' + (err.message || 'Bilinmeyen hata') });
    } finally {
      setConverting(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const filtered = deliveryNotes.filter(n => {
    const search = searchTerm.toLowerCase();
    return (
      n.cari?.name?.toLowerCase().includes(search) ||
      n.description?.toLowerCase().includes(search) ||
      n.delivery_note_number?.toLowerCase().includes(search)
    );
  });

  const getTypeLabel = (type: string) => ({
    delivery_note: 'İrsaliye',
    sale_delivery_note: 'Satış İrsaliyesi',
    purchase_delivery_note: 'Alış İrsaliyesi',
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
          <Truck size={24} />
          İrsaliyeden Fatura Oluştur
        </h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-4">
        <p className="text-sm text-blue-700">
          Bu sayfada kayıtlı irsaliyeleri faturaya dönüştürebilirsiniz. İrsaliye kalemleri otomatik olarak faturaya aktarılır.
        </p>
      </div>

      {/* Arama */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="İrsaliye ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* İrsaliye Listesi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <ResizableTh columnId="dn-tarih" className="text-left py-3 px-4">Tarih</ResizableTh>
                <ResizableTh columnId="dn-tip" className="text-left py-3 px-4">Tür</ResizableTh>
                <ResizableTh columnId="dn-no" className="text-left py-3 px-4">İrsaliye No</ResizableTh>
                <ResizableTh columnId="dn-cari" className="text-left py-3 px-4">Cari</ResizableTh>
                <ResizableTh columnId="dn-tutar" className="text-right py-3 px-4">Tutar</ResizableTh>
                <ResizableTh columnId="dn-islem" className="text-center py-3 px-4">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(note => (
                <tr key={note.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">{formatDateTR(note.transaction_date)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{getTypeLabel(note.transaction_type)}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">{note.delivery_note_number || '-'}</td>
                  <td className="py-3 px-4">{note.cari?.name || '-'}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(note.amount)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => convertToInvoice(note)}
                      disabled={converting === note.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      <ArrowRight size={14} />
                      {converting === note.id ? 'Dönüştürülüyor...' : 'Faturaya Dönüştür'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-500">İrsaliye bulunamadı.</p>
        )}
      </div>
    </div>
  );
}
