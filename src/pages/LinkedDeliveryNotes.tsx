import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import { Link2, Unlink, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';

interface LinkedDN {
  dn_id: string;
  dn_date: string;
  dn_type: string;
  dn_number: string;
  dn_amount: number;
  dn_description: string;
  dn_cari: string;
  invoice_id: string;
  invoice_date: string;
  invoice_type: string;
  invoice_number: string;
  invoice_amount: number;
  invoice_cari: string;
}

export default function LinkedDeliveryNotes() {
  const { selectedFirm } = useFirm();
  const [linkedItems, setLinkedItems] = useState<LinkedDN[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchLinked(); }, [selectedFirm]);

  const fetchLinked = async () => {
    setLoading(true);
    
    // Bağlı irsaliyeleri çek
    let query = supabase
      .from('transactions')
      .select('id, transaction_date, transaction_type, amount, description, invoice_number, delivery_note_number, linked_invoice_id, cari:cariler(name)')
      .not('linked_invoice_id', 'is', null)
      .in('transaction_type', ['delivery_note', 'sale_delivery_note', 'purchase_delivery_note'])
      .order('transaction_date', { ascending: false });
    
    if (selectedFirm) query = query.eq('firm_id', selectedFirm.id);
    const { data: dnData } = await query;

    if (!dnData || dnData.length === 0) {
      setLinkedItems([]);
      setLoading(false);
      return;
    }

    // İlgili faturaları çek
    const invoiceIds = [...new Set(dnData.map(dn => dn.linked_invoice_id))];
    const { data: invoiceData } = await supabase
      .from('transactions')
      .select('id, transaction_date, transaction_type, amount, invoice_number, cari:cariler(name)')
      .in('id', invoiceIds);

    const invoiceMap = new Map(invoiceData?.map(inv => [inv.id, inv]) || []);

    const items: LinkedDN[] = dnData.map(dn => {
      const inv = invoiceMap.get(dn.linked_invoice_id);
      return {
        dn_id: dn.id,
        dn_date: dn.transaction_date,
        dn_type: dn.transaction_type,
        dn_number: dn.delivery_note_number || '-',
        dn_amount: dn.amount,
        dn_description: dn.description || '-',
        dn_cari: Array.isArray(dn.cari) ? (dn.cari as any)[0]?.name || '-' : (dn.cari as any)?.name || '-',
        invoice_id: dn.linked_invoice_id,
        invoice_date: inv?.transaction_date || '-',
        invoice_type: inv?.transaction_type || '-',
        invoice_number: inv?.invoice_number || '-',
        invoice_amount: inv?.amount || 0,
        invoice_cari: inv?.cari ? (Array.isArray(inv.cari) ? (inv.cari as any)[0]?.name || '-' : (inv.cari as any)?.name || '-') : '-',
      };
    });

    setLinkedItems(items);
    setLoading(false);
  };

  const unlink = async (dnId: string) => {
    const { error } = await supabase
      .from('transactions')
      .update({ linked_invoice_id: null })
      .eq('id', dnId);

    if (error) {
      setMessage({ type: 'error', text: 'Bağlantı kaldırma hatası!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setMessage({ type: 'success', text: 'İrsaliye-fatura bağlantısı kaldırıldı!' });
    fetchLinked();
    setTimeout(() => setMessage(null), 3000);
  };

  const getTypeLabel = (type: string) => ({
    delivery_note: 'İrsaliye',
    sale_delivery_note: 'Satış İrsaliyesi',
    purchase_delivery_note: 'Alış İrsaliyesi',
    invoice: 'Fatura',
    sale_invoice: 'Satış Faturası',
    purchase_invoice: 'Alış Faturası',
  }[type] || type);

  const filtered = linkedItems.filter(item => {
    const search = searchTerm.toLowerCase();
    return item.dn_cari.toLowerCase().includes(search) ||
           item.invoice_cari.toLowerCase().includes(search) ||
           item.dn_number.toLowerCase().includes(search) ||
           item.invoice_number.toLowerCase().includes(search);
  });

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
          Bağlı İrsaliyeler{selectedFirm ? ` - ${selectedFirm.name}` : ''}
        </h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      {/* Arama */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari veya numara ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>

      {/* Bağlı İrsaliye Tablosu */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th colSpan={4} className="text-center py-2 px-4 bg-purple-50 text-purple-700">İrsaliye</th>
                <th colSpan={3} className="text-center py-2 px-4 bg-blue-50 text-blue-700">Fatura</th>
                <th className="text-center py-2 px-4">İşlem</th>
              </tr>
              <tr>
                <ResizableTh columnId="dn-tur" className="text-left py-2 px-2">Tür</ResizableTh>
                <ResizableTh columnId="dn-cari" className="text-left py-2 px-2">Cari</ResizableTh>
                <ResizableTh columnId="dn-tarih" className="text-left py-2 px-2">Tarih</ResizableTh>
                <ResizableTh columnId="dn-tutar" className="text-right py-2 px-2">Tutar</ResizableTh>
                <ResizableTh columnId="inv-tur" className="text-left py-2 px-2">Tür</ResizableTh>
                <ResizableTh columnId="inv-cari" className="text-left py-2 px-2">Cari</ResizableTh>
                <ResizableTh columnId="inv-tutar" className="text-right py-2 px-2">Tutar</ResizableTh>
                <ResizableTh columnId="islem2" className="text-center py-2 px-2">İşlem</ResizableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.dn_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{getTypeLabel(item.dn_type)}</span>
                  </td>
                  <td className="py-3 px-2">{item.dn_cari}</td>
                  <td className="py-3 px-2">{formatDateTR(item.dn_date)}</td>
                  <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.dn_amount)}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{getTypeLabel(item.invoice_type)}</span>
                  </td>
                  <td className="py-3 px-2">{item.invoice_cari}</td>
                  <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.invoice_amount)}</td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => unlink(item.dn_id)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs mx-auto"
                    >
                      <Unlink size={12} />
                      Ayır
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-500">Bağlı irsaliye bulunamadı.</p>
        )}
      </div>
    </div>
  );
}
