import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDateTR } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useFirm } from '../hooks/useFirm';
import { addRequest, getPendingRequests, approveRequest, rejectRequest, getRequestLabel, type ApprovalRequest } from '../lib/approvals';
import SearchableSelect from '../components/SearchableSelect';
import type { Firm, Project, Transaction, Product, CashRegister, BankAccount } from '../types';
import { ArrowRightLeft, Building2, Package, Wallet, CreditCard, AlertCircle, CheckCircle, AlertTriangle, Send, Clock, Check, X, Shield } from 'lucide-react';

type TransferCategory = 'cari' | 'stok' | 'kasa' | 'banka';

export default function Transfer() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const { selectedFirm } = useFirm();
  const [cariler, setCariler] = useState<Firm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeCategory, setActiveCategory] = useState<TransferCategory>('cari');
  const [transferHistory, setTransferHistory] = useState<Transaction[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);

  // Cari aktarım
  const [cariFromFirmId, setCariFromFirmId] = useState('');
  const [cariToFirmId, setCariToFirmId] = useState('');

  // Stok aktarım
  const [stockProductId, setStockProductId] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);

  // Kasa aktarım
  const [kasaFromId, setKasaFromId] = useState('');
  const [kasaToId, setKasaToId] = useState('');

  // Banka aktarım
  const [bankaFromId, setBankaFromId] = useState('');
  const [bankaToId, setBankaToId] = useState('');

  // Ortak
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [transferDate, setTransferDate] = useState(formatDateTR(new Date()));

  // Admin onay
  const [rejectModal, setRejectModal] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (selectedFirm) {
      fetchData();
      setCariFromFirmId(selectedFirm.id);
    }
  }, [selectedFirm]);

  useEffect(() => {
    setPendingRequests(getPendingRequests());
  }, [message]);

  const fetchData = async () => {
    if (!selectedFirm) return;
    setLoading(true);

    const [projectsRes, productsRes, cashRes, bankRes, carilerRes] = await Promise.all([
      supabase.from('projects').select('*').eq('firm_id', selectedFirm.id),
      supabase.from('products').select('*').eq('is_active', true).eq('firm_id', selectedFirm.id),
      supabase.from('cash_registers').select('*').eq('is_active', true).eq('firm_id', selectedFirm.id),
      supabase.from('bank_accounts').select('*').eq('is_active', true).eq('firm_id', selectedFirm.id),
      supabase.from('firms').select('*').eq('is_active', true).in('type', ['customer', 'supplier']).order('code'),
    ]);

    if (projectsRes.data) setProjects(projectsRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (cashRes.data) setCashRegisters(cashRes.data);
    if (bankRes.data) setBankAccounts(bankRes.data);
    if (carilerRes.data) setCariler(carilerRes.data);

    await fetchTransferHistory();
    setLoading(false);
  };

  const fetchTransferHistory = async () => {
    if (!selectedFirm) return;
    const { data } = await supabase
      .from('transactions')
      .select('*, firm:firms(*), project:projects(*)')
      .eq('firm_id', selectedFirm.id)
      .in('transaction_type', ['transfer', 'stock_transfer', 'cash_transfer', 'bank_transfer'])
      .order('transaction_date', { ascending: false })
      .limit(50);
    if (data) setTransferHistory(data);
  };

  const resetForm = () => {
    setAmount(0);
    setDescription('');
    setStockQuantity(0);
    setStockProductId('');
    setKasaFromId('');
    setKasaToId('');
    setBankaFromId('');
    setBankaToId('');
  };

  const handleRevert = async (t: Transaction) => {
    if (!confirm('Bu aktarımı geri almak istediğinizden emin misiniz?')) return;

    try {
      switch (t.transaction_type) {
        case 'transfer': {
          const { data: relatedTx } = await supabase
            .from('transactions')
            .select('*')
            .eq('transaction_date', t.transaction_date)
            .eq('amount', t.amount)
            .eq('project_id', t.project_id || '')
            .in('transaction_type', ['income', 'expense'])
            .order('created_at');

          if (relatedTx && relatedTx.length >= 2) {
            await supabase.from('transactions').delete().in('id', relatedTx.map(r => r.id));
          }
          break;
        }

        case 'stock_transfer': {
          const stockMatch = t.description?.match(/×\s*(\d+)/);
          const qty = stockMatch ? parseInt(stockMatch[1]) : 0;
          const nameMatch = t.description?.match(/Stok Aktarım:\s*(.+?)\s*×/);

          if (nameMatch && qty > 0) {
            const productName = nameMatch[1].trim();
            const { data: product } = await supabase.from('products').select('*').eq('name', productName).single();
            if (product) {
              await supabase.from('products').update({ stock_quantity: product.stock_quantity + qty }).eq('id', product.id);
            }
          }
          await supabase.from('transactions').delete().eq('id', t.id);
          break;
        }

        case 'cash_transfer': {
          const { data: cashTx } = await supabase
            .from('cash_transactions')
            .select('*')
            .eq('firm_id', t.firm_id || '')
            .eq('transaction_date', t.transaction_date)
            .eq('amount', t.amount);

          if (cashTx && cashTx.length >= 2) {
            for (const ct of cashTx) {
              const { data: reg } = await supabase.from('cash_registers').select('*').eq('id', ct.cash_register_id).single();
              if (reg) {
                const newBalance = ct.transaction_type === 'out' ? reg.current_balance + ct.amount : reg.current_balance - ct.amount;
                await supabase.from('cash_registers').update({ current_balance: newBalance }).eq('id', reg.id);
              }
            }
            await supabase.from('cash_transactions').delete().in('id', cashTx.map(c => c.id));
          }
          await supabase.from('transactions').delete().eq('id', t.id);
          break;
        }

        case 'bank_transfer': {
          const { data: bankTx } = await supabase
            .from('bank_transactions')
            .select('*')
            .eq('firm_id', t.firm_id || '')
            .eq('transaction_date', t.transaction_date)
            .eq('amount', t.amount);

          if (bankTx && bankTx.length >= 2) {
            for (const bt of bankTx) {
              const { data: acc } = await supabase.from('bank_accounts').select('*').eq('id', bt.bank_account_id).single();
              if (acc) {
                const newBalance = bt.transaction_type === 'out' ? acc.current_balance + bt.amount : acc.current_balance - bt.amount;
                await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', acc.id);
              }
            }
            await supabase.from('bank_transactions').delete().in('id', bankTx.map(b => b.id));
          }
          await supabase.from('transactions').delete().eq('id', t.id);
          break;
        }
      }

      setMessage({ type: 'success', text: 'Aktarım başarıyla geri alındı!' });
      await fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Geri alma hatası:', err);
      setMessage({ type: 'error', text: 'Aktarım geri alınırken hata oluştu.' });
    }
  };

  // Admin onay/red
  const handleApprove = (req: ApprovalRequest) => {
    approveRequest(req.id, user?.id || '');
    setPendingRequests(getPendingRequests());
    setMessage({ type: 'success', text: `"${getRequestLabel(req.type)}" talebi onaylandı!` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReject = (req: ApprovalRequest) => {
    rejectRequest(req.id, user?.id || '', rejectReason);
    setPendingRequests(getPendingRequests());
    setRejectModal(null);
    setRejectReason('');
    setMessage({ type: 'success', text: `"${getRequestLabel(req.type)}" talebi reddedildi!` });
    setTimeout(() => setMessage(null), 3000);
  };

  // Talep oluştur (non-admin)
  const handleRequest = (reqType: ApprovalRequest['type'], data: Record<string, any>) => {
    addRequest({
      type: reqType,
      requested_by: user?.id || '',
      requested_by_name: user?.email || '',
      data,
    });
    setPendingRequests(getPendingRequests());
    setMessage({ type: 'success', text: 'Talebiniz admin onayına gönderildi!' });
    resetForm();
    setTimeout(() => setMessage(null), 3000);
  };

  const buildRequestData = () => {
    switch (activeCategory) {
      case 'cari':
        return {
          firm_id: selectedFirm?.id,
          from_firm: cariler.find(f => f.id === cariFromFirmId)?.name,
          to_firm: cariler.find(f => f.id === cariToFirmId)?.name,
          from_firm_id: cariFromFirmId,
          to_firm_id: cariToFirmId,
          amount, description, project_id: projectId, transfer_date: transferDate,
        };
      case 'stok':
        return {
          firm_id: selectedFirm?.id,
          product: products.find(p => p.id === stockProductId)?.name,
          product_id: stockProductId,
          quantity: stockQuantity,
          description, project_id: projectId, transfer_date: transferDate,
        };
      case 'kasa':
        return {
          firm_id: selectedFirm?.id,
          from_kasa: cashRegisters.find(k => k.id === kasaFromId)?.name,
          to_kasa: cashRegisters.find(k => k.id === kasaToId)?.name,
          from_kasa_id: kasaFromId,
          to_kasa_id: kasaToId,
          amount, description, project_id: projectId, transfer_date: transferDate,
        };
      case 'banka':
        return {
          firm_id: selectedFirm?.id,
          from_bank: bankAccounts.find(b => b.id === bankaFromId)?.bank_name,
          to_bank: bankAccounts.find(b => b.id === bankaToId)?.bank_name,
          from_bank_id: bankaFromId,
          to_bank_id: bankaToId,
          amount, description, project_id: projectId, transfer_date: transferDate,
        };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedFirm) { setMessage({ type: 'error', text: 'Firma seçimi zorunludur!' }); return; }
    if (!projectId) { setMessage({ type: 'error', text: 'Proje seçimi zorunludur!' }); return; }
    if (activeCategory !== 'stok' && amount <= 0) { setMessage({ type: 'error', text: 'Tutar sıfırdan büyük olmalıdır!' }); return; }

    // Validation
    if (activeCategory === 'cari' && (!cariFromFirmId || !cariToFirmId)) {
      setMessage({ type: 'error', text: 'Kaynak ve hedef firma seçimi zorunludur!' }); return;
    }
    if (activeCategory === 'stok' && !stockProductId) {
      setMessage({ type: 'error', text: 'Ürün seçimi zorunludur!' }); return;
    }
    if (activeCategory === 'kasa' && (!kasaFromId || !kasaToId)) {
      setMessage({ type: 'error', text: 'Kaynak ve hedef kasa seçimi zorunludur!' }); return;
    }
    if (activeCategory === 'banka' && (!bankaFromId || !bankaToId)) {
      setMessage({ type: 'error', text: 'Kaynak ve hedef hesap seçimi zorunludur!' }); return;
    }

    // Non-admin → talep gönder
    if (!isAdmin) {
      const reqType = `transfer_${activeCategory}` as ApprovalRequest['type'];
      handleRequest(reqType, buildRequestData());
      return;
    }

    // Admin → direkt uygula
    executeTransfer();
  };

  const executeTransfer = async () => {
    try {
      let transactionType = 'transfer';
      let desc = '';

      switch (activeCategory) {
        case 'cari':
          if (cariFromFirmId === cariToFirmId) { setMessage({ type: 'error', text: 'Kaynak ve hedef firma aynı olamaz!' }); return; }
          await supabase.from('transactions').insert({
            transaction_date: transferDate, transaction_type: 'expense', firm_id: cariFromFirmId, project_id: projectId, amount,
            description: `Aktarım → ${cariler.find(f => f.id === cariToFirmId)?.name}${description ? ` (${description})` : ''}`,
            created_by: user?.id,
          });
          await supabase.from('transactions').insert({
            transaction_date: transferDate, transaction_type: 'income', firm_id: cariToFirmId, project_id: projectId, amount,
            description: `${cariler.find(f => f.id === cariFromFirmId)?.name}'ndan aktarıldı${description ? ` (${description})` : ''}`,
            created_by: user?.id,
          });
          desc = 'Cari Aktarım';
          break;

        case 'stok':
          if (stockQuantity > (products.find(p => p.id === stockProductId)?.stock_quantity || 0)) {
            setMessage({ type: 'error', text: 'Mevcut stoktan fazla transfer edemezsiniz!' }); return;
          }
          transactionType = 'stock_transfer';
          const product = products.find(p => p.id === stockProductId);
          await supabase.from('products').update({ stock_quantity: (product?.stock_quantity || 0) - stockQuantity }).eq('id', stockProductId);
          desc = `Stok Aktarım: ${product?.name} × ${stockQuantity} ${product?.unit || 'adet'}`;
          break;

        case 'kasa':
          if (kasaFromId === kasaToId) { setMessage({ type: 'error', text: 'Kaynak ve hedef kasa aynı olamaz!' }); return; }
          transactionType = 'cash_transfer';
          const fromKasa = cashRegisters.find(k => k.id === kasaFromId);
          if ((fromKasa?.current_balance || 0) < amount) { setMessage({ type: 'error', text: `Kaynak kasada yeterli bakiye yok!` }); return; }
          await supabase.from('cash_registers').update({ current_balance: (fromKasa?.current_balance || 0) - amount }).eq('id', kasaFromId);
          const toKasa = cashRegisters.find(k => k.id === kasaToId);
          await supabase.from('cash_registers').update({ current_balance: (toKasa?.current_balance || 0) + amount }).eq('id', kasaToId);
          await supabase.from('cash_transactions').insert([
            { cash_register_id: kasaFromId, firm_id: selectedFirm!.id, transaction_date: transferDate, transaction_type: 'out', amount, description: `Kasa Aktarım → ${cashRegisters.find(k => k.id === kasaToId)?.name}`, created_by: user?.id },
            { cash_register_id: kasaToId, firm_id: selectedFirm!.id, transaction_date: transferDate, transaction_type: 'in', amount, description: `${cashRegisters.find(k => k.id === kasaFromId)?.name}'ndan aktarıldı`, created_by: user?.id },
          ]);
          desc = 'Kasa Aktarım';
          break;

        case 'banka':
          if (bankaFromId === bankaToId) { setMessage({ type: 'error', text: 'Kaynak ve hedef hesap aynı olamaz!' }); return; }
          transactionType = 'bank_transfer';
          const fromBank = bankAccounts.find(b => b.id === bankaFromId);
          if ((fromBank?.current_balance || 0) < amount) { setMessage({ type: 'error', text: `Kaynak hesapta yeterli bakiye yok!` }); return; }
          await supabase.from('bank_accounts').update({ current_balance: (fromBank?.current_balance || 0) - amount }).eq('id', bankaFromId);
          const toBank = bankAccounts.find(b => b.id === bankaToId);
          await supabase.from('bank_accounts').update({ current_balance: (toBank?.current_balance || 0) + amount }).eq('id', bankaToId);
          await supabase.from('bank_transactions').insert([
            { bank_account_id: bankaFromId, firm_id: selectedFirm!.id, transaction_date: transferDate, transaction_type: 'out', amount, description: `Banka Aktarım → ${bankAccounts.find(b => b.id === bankaToId)?.bank_name}`, created_by: user?.id },
            { bank_account_id: bankaToId, firm_id: selectedFirm!.id, transaction_date: transferDate, transaction_type: 'in', amount, description: `${bankAccounts.find(b => b.id === bankaFromId)?.bank_name}'ndan aktarıldı`, created_by: user?.id },
          ]);
          desc = 'Banka Aktarım';
          break;
      }

      if (activeCategory !== 'cari') {
        await supabase.from('transactions').insert({
          transaction_date: transferDate, transaction_type: transactionType as any, firm_id: selectedFirm!.id, project_id: projectId,
          amount: activeCategory === 'stok' ? stockQuantity * (products.find(p => p.id === stockProductId)?.unit_price || 0) : amount,
          description: desc + (description ? ` (${description})` : ''), created_by: user?.id,
        });
      }

      setMessage({ type: 'success', text: 'Aktarım başarıyla gerçekleştirildi!' });
      resetForm();
      await fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Aktarım hatası:', err);
      setMessage({ type: 'error', text: 'Aktarım sırasında hata oluştu.' });
    }
  };

  const categories = [
    { id: 'cari' as TransferCategory, label: 'Cari Aktarım', icon: Building2, color: 'blue' },
    { id: 'stok' as TransferCategory, label: 'Stok Aktarım', icon: Package, color: 'green' },
    { id: 'kasa' as TransferCategory, label: 'Kasa Aktarım', icon: Wallet, color: 'yellow' },
    { id: 'banka' as TransferCategory, label: 'Banka Aktarım', icon: CreditCard, color: 'purple' },
  ];

  if (!selectedFirm) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Building2 size={48} className="mb-3 text-slate-300" />
        <p className="text-lg">Aktarım yapmak için üst menüden bir firma seçin.</p>
      </div>
    );
  }

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
          <ArrowRightLeft size={24} />
          Aktarım
          {!isAdmin && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
              <Shield size={12} /> Talep Modu
            </span>
          )}
        </h1>
        <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm text-blue-600">Aktif Firma:</span>
          <span className="ml-2 font-bold text-blue-800">{selectedFirm.name}</span>
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700 flex items-center gap-2">
            <Shield size={16} />
            <span><strong>Admin onayı gerekiyor.</strong> Gönderdiğiniz talepler admin tarafından onaylandıktan sonra uygulanacaktır.</span>
          </p>
        </div>
      )}

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Bekleyen Talepler (Admin) */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-amber-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={18} className="text-amber-600" />
            Bekleyen Talepler ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{getRequestLabel(req.type)}</span>
                    <span className="ml-2 text-xs text-slate-500">- {req.requested_by_name}</span>
                    <span className="ml-2 text-xs text-slate-400">{formatDateTR(req.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleApprove(req)} className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1">
                      <Check size={14} /> Onayla
                    </button>
                    <button onClick={() => setRejectModal(req)} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-1">
                      <X size={14} /> Reddet
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {req.type.includes('cari') && (
                    <p>{req.data.from_firm} → {req.data.to_firm} | {formatCurrency(req.data.amount)}</p>
                  )}
                  {req.type.includes('stok') && (
                    <p>{req.data.product} × {req.data.quantity} adet</p>
                  )}
                  {req.type.includes('kasa') && (
                    <p>{req.data.from_kasa} → {req.data.to_kasa} | {formatCurrency(req.data.amount)}</p>
                  )}
                  {req.type.includes('banka') && (
                    <p>{req.data.from_bank} → {req.data.to_bank} | {formatCurrency(req.data.amount)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kategori Seçimi */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); resetForm(); }}
            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
              activeCategory === cat.id
                ? `border-${cat.color}-500 bg-${cat.color}-50`
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <cat.icon size={24} className={activeCategory === cat.id ? `text-${cat.color}-600` : 'text-slate-400'} />
            <span className={`text-sm font-medium ${activeCategory === cat.id ? `text-${cat.color}-700` : 'text-slate-600'}`}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aktarım Formu */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {categories.find(c => c.id === activeCategory)?.label}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
                <input type="text" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} placeholder="gg.aa.yyyy" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proje *</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                  <option value="">Proje Seçiniz...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {activeCategory === 'cari' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SearchableSelect
                  options={cariler.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                  value={cariFromFirmId}
                  onChange={(id) => setCariFromFirmId(id)}
                  label="Kaynak Cari"
                  placeholder="Kod veya isim ile cari ara..."
                  required
                />
                <SearchableSelect
                  options={cariler.filter(f => f.id !== cariFromFirmId).map(f => ({ id: f.id, code: f.code, name: f.name }))}
                  value={cariToFirmId}
                  onChange={(id) => setCariToFirmId(id)}
                  label="Hedef Cari"
                  placeholder="Kod veya isim ile cari ara..."
                  required
                />
              </div>
            )}

            {activeCategory === 'stok' && (
              <>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 flex items-center gap-2"><Package size={16} /><span className="font-medium">{selectedFirm.name}</span> firması içinde stok aktarımı</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ürün</label>
                  <select value={stockProductId} onChange={(e) => setStockProductId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                    <option value="">Ürün Seçiniz...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name} (Stok: {p.stock_quantity} {p.unit})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Miktar</label><input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" min="1" required /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Mevcut Stok</label><input type="text" value={`${products.find(p => p.id === stockProductId)?.stock_quantity || 0} ${products.find(p => p.id === stockProductId)?.unit || ''}`} className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50" disabled /></div>
                </div>
              </>
            )}

            {activeCategory === 'kasa' && (
              <>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-700 flex items-center gap-2"><Wallet size={16} /><span className="font-medium">{selectedFirm.name}</span> firması içinde kasa aktarımı</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Kaynak Kasa</label><select value={kasaFromId} onChange={(e) => setKasaFromId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required><option value="">Seçiniz...</option>{cashRegisters.map(k => <option key={k.id} value={k.id}>{k.name} ({formatCurrency(k.current_balance)})</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Hedef Kasa</label><select value={kasaToId} onChange={(e) => setKasaToId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required><option value="">Seçiniz...</option>{cashRegisters.filter(k => k.id !== kasaFromId).map(k => <option key={k.id} value={k.id}>{k.name} ({formatCurrency(k.current_balance)})</option>)}</select></div>
                </div>
              </>
            )}

            {activeCategory === 'banka' && (
              <>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-700 flex items-center gap-2"><CreditCard size={16} /><span className="font-medium">{selectedFirm.name}</span> firması içinde banka aktarımı</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Kaynak Hesap</label><select value={bankaFromId} onChange={(e) => setBankaFromId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required><option value="">Seçiniz...</option>{bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} ({formatCurrency(b.current_balance)})</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Hedef Hesap</label><select value={bankaToId} onChange={(e) => setBankaToId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required><option value="">Seçiniz...</option>{bankAccounts.filter(b => b.id !== bankaFromId).map(b => <option key={b.id} value={b.id}>{b.bank_name} ({formatCurrency(b.current_balance)})</option>)}</select></div>
                </div>
              </>
            )}

            {activeCategory !== 'stok' && (
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Tutar (₺) *</label><input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-lg font-bold" min="0" step="0.01" required /></div>
            )}

            <div><label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama (opsiyonel)" className="w-full px-4 py-2 border border-slate-300 rounded-lg" /></div>

            <button type="submit" className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${isAdmin ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
              {isAdmin ? <><ArrowRightLeft size={18} /> Aktarımı Gerçekleştir</> : <><Send size={18} /> Talep Gönder</>}
            </button>
          </form>
        </div>

        {/* Aktarım Geçmişi */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Son Aktarımlar</h2>
          {transferHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500"><ArrowRightLeft size={48} className="mx-auto mb-3 text-slate-300" /><p>Henüz aktarım yapılmamış.</p></div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {transferHistory.map(t => (
                <div key={t.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">{formatDateTR(t.transaction_date)}</span>
                    <span className="text-sm font-bold text-blue-600">{t.amount > 0 ? formatCurrency(t.amount) : '-'}</span>
                  </div>
                  <p className="text-sm text-slate-700">{t.description || '-'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.transaction_type === 'transfer' ? 'bg-blue-100 text-blue-600' : t.transaction_type === 'stock_transfer' ? 'bg-green-100 text-green-600' : t.transaction_type === 'cash_transfer' ? 'bg-yellow-100 text-yellow-600' : 'bg-purple-100 text-purple-600'}`}>
                        {t.transaction_type === 'transfer' ? 'Cari' : t.transaction_type === 'stock_transfer' ? 'Stok' : t.transaction_type === 'cash_transfer' ? 'Kasa' : 'Banka'}
                      </span>
                      {t.project?.name && <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{t.project.name}</span>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRevert(t)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors">Geri Al</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Red Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Talebi Reddet</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Red Nedeni</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg" placeholder="Red nedenini yazın..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
              <button onClick={() => handleReject(rejectModal)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reddet</button>
            </div>
          </div>
        </div>
      )}

      {confirmMessage && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-2 z-50 ${confirmMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {confirmMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="max-w-md">{confirmMessage.text}</span>
          <button onClick={() => setConfirmMessage(null)} className="ml-2 hover:opacity-80">✕</button>
        </div>
      )}
    </div>
  );
}
