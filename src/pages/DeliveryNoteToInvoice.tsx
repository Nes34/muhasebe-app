import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useFirm } from '../hooks/useFirm';
import DateInput from '../components/DateInput';
import { formatInvoiceNumberOnSave } from '../lib/invoice';
import WithholdingTaxModal from '../components/WithholdingTaxModal';
import type { WithholdingTaxCode } from '../lib/withholdingTaxCodes';
import type { Product } from '../types';
import { Truck, ArrowRight, Search, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
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

interface InvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  vat_rate: number;
  vat_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_code?: string;
  withholding_description?: string;
  stopaj_rate: number;
  stopaj_amount: number;
  discount_rate: number;
  discount_amount: number;
  discount_rate_2: number;
  discount_amount_2: number;
  discount_rate_3: number;
  discount_amount_3: number;
}

export default function DeliveryNoteToInvoice() {
  const { selectedFirm } = useFirm();
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_date: '',
    invoice_number: '',
  });
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [discountCount, setDiscountCount] = useState(1);
  const [showWithholdingModal, setShowWithholdingModal] = useState(false);
  const [activeWithholdingIndex, setActiveWithholdingIndex] = useState(0);
  const [activeWithholdingFilterRate, setActiveWithholdingFilterRate] = useState<number | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [openProductDropdown, setOpenProductDropdown] = useState<number | null>(null);
  const [productHighlightIndex, setProductHighlightIndex] = useState(0);

  useEffect(() => { fetchDeliveryNotes(); fetchProducts(); }, [selectedFirm]);

  const fetchProducts = async () => {
    let query = supabase.from('products').select('*').eq('is_active', true).order('name');
    const { data } = await query;
    if (data) setProducts(data);
  };

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

  // Dönüştürme modalını aç
  const openConvertModal = async (note: DeliveryNote) => {
    setSelectedNote(note);

    // Fatura numarası oluştur
    const invoiceType = note.transaction_type === 'sale_delivery_note' ? 'sale_invoice' :
                        note.transaction_type === 'purchase_delivery_note' ? 'purchase_invoice' : 'invoice';
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

    setInvoiceForm({
      invoice_date: formatDateTR(new Date()),
      invoice_number: invoiceNumber,
    });

    // İrsaliye kalemlerini çek
    const { data: items } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', note.id);

    if (items && items.length > 0) {
      setInvoiceItems(items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        amount: item.amount,
        vat_rate: item.vat_rate || 20,
        vat_amount: item.vat_amount || 0,
        withholding_rate: item.withholding_rate || 0,
        withholding_amount: item.withholding_amount || 0,
        withholding_code: item.withholding_code || '',
        withholding_description: item.withholding_description || '',
        stopaj_rate: item.stopaj_rate || 0,
        stopaj_amount: item.stopaj_amount || 0,
        discount_rate: item.discount_rate || 0,
        discount_amount: item.discount_amount || 0,
        discount_rate_2: item.discount_rate_2 || 0,
        discount_amount_2: item.discount_amount_2 || 0,
        discount_rate_3: item.discount_rate_3 || 0,
        discount_amount_3: item.discount_amount_3 || 0,
      })));
    } else {
      setInvoiceItems([]);
    }

    setShowConvertModal(true);
  };

  // Kalem güncelle
  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price' || field === 'discount_rate' || field === 'discount_rate_2' || field === 'discount_rate_3') {
      const qty = field === 'quantity' ? value : updated[index].quantity;
      const price = field === 'unit_price' ? value : updated[index].unit_price;
      const dr1 = field === 'discount_rate' ? value : (updated[index].discount_rate || 0);
      const dr2 = field === 'discount_rate_2' ? value : (updated[index].discount_rate_2 || 0);
      const dr3 = field === 'discount_rate_3' ? value : (updated[index].discount_rate_3 || 0);
      
      const gross = (qty || 0) * (price || 0);
      const disc1 = gross * (dr1 / 100);
      const afterDisc1 = gross - disc1;
      const disc2 = afterDisc1 * (dr2 / 100);
      const afterDisc2 = afterDisc1 - disc2;
      const disc3 = afterDisc2 * (dr3 / 100);
      const netAmount = afterDisc2 - disc3;
      
      updated[index].discount_amount = disc1;
      updated[index].discount_amount_2 = disc2;
      updated[index].discount_amount_3 = disc3;
      updated[index].vat_amount = netAmount * ((updated[index].vat_rate || 0) / 100);
      updated[index].stopaj_amount = netAmount * ((updated[index].stopaj_rate || 0) / 100);
      updated[index].withholding_amount = netAmount * ((updated[index].withholding_rate || 0) / 100);
      updated[index].amount = netAmount + updated[index].vat_amount;
    }
    if (field === 'vat_rate') {
      const netAmount = updated[index].amount - updated[index].vat_amount;
      updated[index].vat_amount = netAmount * ((Number(value) || 0) / 100);
      updated[index].amount = netAmount + updated[index].vat_amount;
    }
    if (field === 'stopaj_rate') {
      const netAmount = updated[index].amount - updated[index].vat_amount;
      updated[index].stopaj_amount = netAmount * ((Number(value) || 0) / 100);
    }
    if (field === 'withholding_rate') {
      const netAmount = updated[index].amount - updated[index].vat_amount;
      updated[index].withholding_amount = netAmount * ((Number(value) || 0) / 100);
    }
    if (field === 'amount') {
      updated[index].vat_amount = (Number(value) || 0) * ((updated[index].vat_rate || 0) / 100);
      updated[index].stopaj_amount = (Number(value) || 0) * ((updated[index].stopaj_rate || 0) / 100);
      updated[index].withholding_amount = (Number(value) || 0) * ((updated[index].withholding_rate || 0) / 100);
    }
    setInvoiceItems(updated);
  };

  // Kalem sil
  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  // Yeni kalem ekle
  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, {
      description: '',
      quantity: 1,
      unit: 'adet',
      unit_price: 0,
      amount: 0,
      vat_rate: 20,
      vat_amount: 0,
      withholding_rate: 0,
      withholding_amount: 0,
      withholding_code: '',
      withholding_description: '',
      stopaj_rate: 0,
      stopaj_amount: 0,
      discount_rate: 0,
      discount_amount: 0,
      discount_rate_2: 0,
      discount_amount_2: 0,
      discount_rate_3: 0,
      discount_amount_3: 0,
    }]);
  };

  // Faturaya dönüştür (modal'dan)
  const handleConvert = async () => {
    if (!selectedNote) return;
    setConverting(selectedNote.id);
    try {
      const invoiceType = selectedNote.transaction_type === 'sale_delivery_note' ? 'sale_invoice' :
                          selectedNote.transaction_type === 'purchase_delivery_note' ? 'purchase_invoice' : 'invoice';

      const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

      const { data: newInvoice, error } = await supabase
        .from('transactions')
        .insert({
          transaction_date: invoiceForm.invoice_date,
          transaction_type: invoiceType,
          firm_id: selectedNote.firm_id,
          cari_id: selectedNote.cari_id,
          project_id: selectedNote.project_id,
          amount: totalAmount,
          invoice_number: invoiceForm.invoice_number,
          delivery_note_number: selectedNote.delivery_note_number || null,
          description: selectedNote.description ? `İrsaliye ${selectedNote.delivery_note_number || ''} - ${selectedNote.description}` : `İrsaliye ${selectedNote.delivery_note_number || ''} faturası`,
          currency: 'TRY',
          exchange_rate: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Kalemleri kaydet
      if (invoiceItems.length > 0) {
        const itemsToInsert = invoiceItems.map((item, idx) => ({
          transaction_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          withholding_rate: item.withholding_rate,
          withholding_amount: item.withholding_amount,
          withholding_code: item.withholding_code || null,
          withholding_description: item.withholding_description || null,
          stopaj_rate: item.stopaj_rate,
          stopaj_amount: item.stopaj_amount,
          discount_rate: item.discount_rate,
          discount_amount: item.discount_amount,
          discount_rate_2: item.discount_rate_2,
          discount_amount_2: item.discount_amount_2,
          discount_rate_3: item.discount_rate_3,
          discount_amount_3: item.discount_amount_3,
          sort_order: idx,
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      setMessage({ type: 'success', text: `İrsaliye faturaya dönüştürüldü! Fatura No: ${invoiceForm.invoice_number}` });
      setShowConvertModal(false);
      setSelectedNote(null);
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
                      onClick={() => openConvertModal(note)}
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

      {/* Faturaya Dönüştürme Modalı */}
      {showConvertModal && selectedNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => { setShowConvertModal(false); setSelectedNote(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">İrsaliyeyi Faturaya Dönüştür</h3>
              <button onClick={() => { setShowConvertModal(false); setSelectedNote(null); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* İrsaliye Bilgileri */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div><span className="text-slate-500">İrsaliye No:</span> <span className="font-mono font-bold">{selectedNote.delivery_note_number || '-'}</span></div>
                  <div><span className="text-slate-500">Tarih:</span> <span className="font-medium">{formatDateTR(selectedNote.transaction_date)}</span></div>
                  <div><span className="text-slate-500">Cari:</span> <span className="font-medium">{selectedNote.cari?.name || '-'}</span></div>
                  <div><span className="text-slate-500">Tür:</span> <span className="font-medium">{getTypeLabel(selectedNote.transaction_type)}</span></div>
                </div>
              </div>

              {/* Fatura Bilgileri */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fatura Tarihi</label>
                  <DateInput
                    value={invoiceForm.invoice_date}
                    onChange={(val) => setInvoiceForm({ ...invoiceForm, invoice_date: val })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fatura No</label>
                  <input
                    type="text"
                    value={invoiceForm.invoice_number}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9/]/g, '');
                      setInvoiceForm({ ...invoiceForm, invoice_number: val.toUpperCase() });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setInvoiceForm({ ...invoiceForm, invoice_number: formatInvoiceNumberOnSave(invoiceForm.invoice_number) });
                      }
                    }}
                    onBlur={() => {
                      setInvoiceForm({ ...invoiceForm, invoice_number: formatInvoiceNumberOnSave(invoiceForm.invoice_number) });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              {/* Kalemler */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">Fatura Kalemleri</h4>
                  <button onClick={addInvoiceItem} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                    <Plus size={12} /> Kalem Ekle <span className="text-[10px] text-slate-400 ml-1">(Alt+E)</span>
                  </button>
                </div>
                {invoiceItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="py-2 px-2 text-left min-w-[450px]">Açıklama</th>
                          <th className="py-2 px-2 text-right w-[100px]">Miktar</th>
                          <th className="py-2 px-2 text-left w-[100px]">Birim</th>
                          <th className="py-2 px-2 text-right w-[100px]">Birim Fiyat</th>
                          <th className="py-2 px-2 text-right w-[100px]">KDV %</th>
                          <th className="py-2 px-2 text-right w-[100px]">KDV Tutarı</th>
                          <th className="py-2 px-2 text-right w-20">
                            <div className="flex items-center justify-end gap-1">
                              <span>İskonto %</span>
                              {discountCount < 3 && (
                                <button type="button" onClick={() => setDiscountCount(discountCount + 1)}
                                  className="w-4 h-4 flex items-center justify-center bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-xs font-bold">+</button>
                              )}
                            </div>
                          </th>
                          {discountCount >= 2 && (
                            <th className="py-2 px-2 text-right w-20">
                              <div className="flex items-center justify-end gap-1">
                                <span>İsk.2 %</span>
                                {discountCount < 3 && (
                                  <button type="button" onClick={() => setDiscountCount(discountCount + 1)}
                                    className="w-4 h-4 flex items-center justify-center bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-xs font-bold">+</button>
                                )}
                                {discountCount === 2 && (
                                  <button type="button" onClick={() => setDiscountCount(1)}
                                    className="w-4 h-4 flex items-center justify-center bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold">-</button>
                                )}
                              </div>
                            </th>
                          )}
                          {discountCount >= 3 && (
                            <th className="py-2 px-2 text-right w-20">
                              <div className="flex items-center justify-end gap-1">
                                <span>İsk.3 %</span>
                                <button type="button" onClick={() => setDiscountCount(2)}
                                  className="w-4 h-4 flex items-center justify-center bg-red-100 text-red-600 rounded hover:bg-red-200 text-xs font-bold">-</button>
                              </div>
                            </th>
                          )}
                          <th className="py-2 px-2 text-right w-20">Stopaj %</th>
                          <th className="py-2 px-2 text-right w-20">Tavkifat %</th>
                          <th className="py-2 px-2 text-right w-24">Tutar</th>
                          <th className="py-2 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-1.5 px-1">
                              <div className="relative">
                                <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  data-product-input={idx}
                                  value={item.description}
                                  onChange={(e) => {
                                    updateInvoiceItem(idx, 'description', e.target.value);
                                    if (e.target.value.length > 0) {
                                      setOpenProductDropdown(idx);
                                      setProductHighlightIndex(0);
                                    } else {
                                      setOpenProductDropdown(null);
                                    }
                                  }}
                                  onFocus={() => {
                                    if (item.description.length > 0) {
                                      setOpenProductDropdown(idx);
                                      setProductHighlightIndex(0);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (openProductDropdown !== idx) return;
                                    const filtered = products.filter(p =>
                                      p.name.toLowerCase().includes(item.description.toLowerCase()) ||
                                      p.code?.toLowerCase().includes(item.description.toLowerCase())
                                    ).slice(0, 5);
                                    if (filtered.length === 0) return;
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setProductHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setProductHighlightIndex(prev => Math.max(prev - 1, 0));
                                    } else                                     if (e.key === 'Tab' || e.key === 'Enter') {
                                      e.preventDefault();
                                      const selected = filtered[productHighlightIndex];
                                      if (selected) {
                                        const qty = item.quantity || 1;
                                        const gross = qty * (selected.unit_price || 0);
                                        const dr1 = item.discount_rate || 0;
                                        const disc1 = gross * (dr1 / 100);
                                        const afterDisc1 = gross - disc1;
                                        const dr2 = item.discount_rate_2 || 0;
                                        const disc2 = afterDisc1 * (dr2 / 100);
                                        const afterDisc2 = afterDisc1 - disc2;
                                        const dr3 = item.discount_rate_3 || 0;
                                        const disc3 = afterDisc2 * (dr3 / 100);
                                        const netAmount = afterDisc2 - disc3;
                                        const vatAmount = netAmount * ((item.vat_rate || 0) / 100);
                                        const updated = [...invoiceItems];
                                        updated[idx] = {
                                          ...updated[idx],
                                          description: selected.name,
                                          unit: selected.unit || 'adet',
                                          unit_price: selected.unit_price || 0,
                                          discount_amount: disc1,
                                          discount_amount_2: disc2,
                                          discount_amount_3: disc3,
                                          vat_amount: vatAmount,
                                          stopaj_amount: netAmount * ((item.stopaj_rate || 0) / 100),
                                          withholding_amount: netAmount * ((item.withholding_rate || 0) / 100),
                                          amount: netAmount + vatAmount,
                                        };
                                        setInvoiceItems(updated);
                                        setOpenProductDropdown(null);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setOpenProductDropdown(null);
                                    }
                                  }}
                                  onBlur={() => setTimeout(() => setOpenProductDropdown(null), 200)}
                                  placeholder="Stok ara..."
                                  className="w-[450px] pl-6 pr-2 py-1.5 border border-slate-200 rounded text-xs"
                                />
                                {openProductDropdown === idx && (() => {
                                  const filtered = products.filter(p =>
                                    p.name.toLowerCase().includes(item.description.toLowerCase()) ||
                                    p.code?.toLowerCase().includes(item.description.toLowerCase())
                                  ).slice(0, 5);
                                  if (filtered.length === 0) return null;
                                  return (
                                    <div className="absolute left-0 top-full mt-1 w-[450px] bg-white border border-slate-200 rounded-lg shadow-lg z-[300] max-h-48 overflow-auto">
                                      {filtered.map((product, pIdx) => (
                                        <button
                                          key={product.id}
                                          type="button"
                                          onClick={() => {
                                            const qty = item.quantity || 1;
                                            const gross = qty * (product.unit_price || 0);
                                            const dr1 = item.discount_rate || 0;
                                            const disc1 = gross * (dr1 / 100);
                                            const afterDisc1 = gross - disc1;
                                            const dr2 = item.discount_rate_2 || 0;
                                            const disc2 = afterDisc1 * (dr2 / 100);
                                            const afterDisc2 = afterDisc1 - disc2;
                                            const dr3 = item.discount_rate_3 || 0;
                                            const disc3 = afterDisc2 * (dr3 / 100);
                                            const netAmount = afterDisc2 - disc3;
                                            const vatAmount = netAmount * ((item.vat_rate || 0) / 100);
                                            const updated = [...invoiceItems];
                                            updated[idx] = {
                                              ...updated[idx],
                                              description: product.name,
                                              unit: product.unit || 'adet',
                                              unit_price: product.unit_price || 0,
                                              discount_amount: disc1,
                                              discount_amount_2: disc2,
                                              discount_amount_3: disc3,
                                              vat_amount: vatAmount,
                                              stopaj_amount: netAmount * ((item.stopaj_rate || 0) / 100),
                                              withholding_amount: netAmount * ((item.withholding_rate || 0) / 100),
                                              amount: netAmount + vatAmount,
                                            };
                                            setInvoiceItems(updated);
                                            setOpenProductDropdown(null);
                                          }}
                                          className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 flex justify-between items-center ${pIdx === productHighlightIndex ? 'bg-blue-100' : ''}`}
                                          onMouseEnter={() => setProductHighlightIndex(pIdx)}
                                        >
                                          <span className="font-medium text-slate-800">{product.name}</span>
                                          <span className="text-slate-400 text-[10px]">{product.code} | {product.unit} | {formatCurrency(product.unit_price)}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-1.5 px-1">
                              <input type="number" value={item.quantity} onChange={(e) => updateInvoiceItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                            </td>
                            <td className="py-1.5 px-1">
                              <input type="text" value={item.unit} onChange={(e) => updateInvoiceItem(idx, 'unit', e.target.value)}
                                className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs" />
                            </td>
                            <td className="py-1.5 px-1">
                              <input type="number" value={item.unit_price} onChange={(e) => updateInvoiceItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                            </td>
                            <td className="py-1.5 px-1">
                              <select value={item.vat_rate} onChange={(e) => updateInvoiceItem(idx, 'vat_rate', parseFloat(e.target.value) || 0)}
                                className="w-[100px] px-1 py-1.5 border border-slate-200 rounded text-xs">
                                <option value={0}>%0</option>
                                <option value={1}>%1</option>
                                <option value={10}>%10</option>
                                <option value={20}>%20</option>
                              </select>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-600 w-[100px]">{formatCurrency(item.vat_amount)}</td>
                            <td className="py-1.5 px-1">
                              <input type="number" value={item.discount_rate} onChange={(e) => updateInvoiceItem(idx, 'discount_rate', parseFloat(e.target.value) || 0)}
                                className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                            </td>
                            {discountCount >= 2 && (
                              <td className="py-1.5 px-1">
                                <input type="number" value={item.discount_rate_2 || 0} onChange={(e) => updateInvoiceItem(idx, 'discount_rate_2', parseFloat(e.target.value) || 0)}
                                  className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                              </td>
                            )}
                            {discountCount >= 3 && (
                              <td className="py-1.5 px-1">
                                <input type="number" value={item.discount_rate_3 || 0} onChange={(e) => updateInvoiceItem(idx, 'discount_rate_3', parseFloat(e.target.value) || 0)}
                                  className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                              </td>
                            )}
                            <td className="py-1.5 px-1">
                              <input type="number" value={item.stopaj_rate} onChange={(e) => updateInvoiceItem(idx, 'stopaj_rate', parseFloat(e.target.value) || 0)}
                                className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                            </td>
                            <td className="py-1.5 px-1">
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <input type="number" value={item.withholding_rate} onChange={(e) => updateInvoiceItem(idx, 'withholding_rate', parseFloat(e.target.value) || 0)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'F10' && e.altKey) {
                                        e.preventDefault();
                                        setActiveWithholdingIndex(idx);
                                        setActiveWithholdingFilterRate(undefined);
                                        setShowWithholdingModal(true);
                                      }
                                    }}
                                    className="w-[100px] px-2 py-1.5 border border-slate-200 rounded text-xs text-right" />
                                  <button type="button" onClick={() => {
                                    setActiveWithholdingIndex(idx);
                                    setActiveWithholdingFilterRate(item.withholding_rate || undefined);
                                    setShowWithholdingModal(true);
                                  }} className="px-1.5 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 text-xs" title="Tevkifat kodu seç (Alt+F10)">
                                    ...
                                  </button>
                                </div>
                                {item.withholding_code && (
                                  <span className="text-[10px] text-blue-600 truncate" title={item.withholding_description}>
                                    {item.withholding_code} - {item.withholding_description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold">{formatCurrency(item.amount)}</td>
                            <td className="py-1.5 px-1">
                              {invoiceItems.length > 1 && (
                                <button onClick={() => removeInvoiceItem(idx)} className="text-red-500 hover:text-red-700">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold">
                          <td colSpan={5} className="py-2 px-2 text-right">Toplam:</td>
                          <td className="py-2 px-2 text-right">{formatCurrency(invoiceItems.reduce((s, i) => s + i.vat_amount, 0))}</td>
                          <td colSpan={discountCount} className="py-2 px-2 text-right"></td>
                          <td colSpan={2} className="py-2 px-2 text-right"></td>
                          <td className="py-2 px-2 text-right">{formatCurrency(invoiceItems.reduce((s, i) => s + i.amount, 0))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">İrsaliyede kalem bulunamadı</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <button onClick={() => { setShowConvertModal(false); setSelectedNote(null); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                İptal
              </button>
              <button onClick={handleConvert} disabled={converting === selectedNote.id} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                {converting === selectedNote.id ? 'Dönüştürülüyor...' : 'Faturaya Dönüştür'} <span className="text-xs text-green-200 ml-1">(Alt+S)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tevkifat Kodu Seçim Modal */}
      <WithholdingTaxModal
        isOpen={showWithholdingModal}
        onClose={() => setShowWithholdingModal(false)}
        onSelect={(code: WithholdingTaxCode) => {
          const updated = [...invoiceItems];
          updated[activeWithholdingIndex].withholding_rate = code.rate;
          updated[activeWithholdingIndex].withholding_code = code.code;
          updated[activeWithholdingIndex].withholding_description = code.description;
          updated[activeWithholdingIndex].withholding_amount = updated[activeWithholdingIndex].amount * (code.rate / 100);
          setInvoiceItems(updated);
          setShowWithholdingModal(false);
        }}
        filterRate={activeWithholdingFilterRate}
      />
    </div>
  );
}
