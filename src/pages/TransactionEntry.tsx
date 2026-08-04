import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatInvoiceNumberOnSave } from '../lib/invoice';
import { checkDuplicateInvoice } from '../lib/validation';
import { formatDateTR } from '../lib/utils';
import { importFromExcel } from '../lib/excel';
import { useAuth } from '../hooks/useAuth';
import { useFirm } from '../hooks/useFirm';
import SearchableSelect from '../components/SearchableSelect';
import DescriptionAutocomplete from '../components/DescriptionAutocomplete';
import { Plus, Trash2, Save, AlertCircle, CheckCircle, X, Upload, FileSpreadsheet, Search, Package, Download, TrendingUp, TrendingDown, FileText, Truck, Receipt } from 'lucide-react';
import ResizableTh from '../components/tables/ResizableTh';
import ResizableCell from '../components/tables/ResizableCell';
import type { Firm, Cari, Project, ExpenseCategory, TransactionItemInput, TransactionType, CashRegister, BankAccount, Product, StockUnit } from '../types';

// İşlem tipine göre renk eşleme
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  income:         { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700', icon: 'text-emerald-500' },
  expense:        { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', icon: 'text-red-500' },
  invoice:        { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', icon: 'text-blue-500' },
  delivery_note:  { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', icon: 'text-purple-500' },
  sale_invoice:   { bg: 'bg-teal-50', border: 'border-teal-500', text: 'text-teal-700', icon: 'text-teal-500' },
  purchase_invoice: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', icon: 'text-orange-500' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-50', border: 'border-slate-500', text: 'text-slate-700', icon: 'text-slate-500' };

function getTypeColor(value: string) {
  return TYPE_COLORS[value] || DEFAULT_COLOR;
}

function getTypeIcon(value: string) {
  switch (value) {
    case 'income': return <TrendingUp size={16} />;
    case 'expense': return <TrendingDown size={16} />;
    case 'invoice': return <Receipt size={16} />;
    case 'delivery_note': return <Truck size={16} />;
    default: return <FileText size={16} />;
  }
}

export default function TransactionEntry() {
  const { user } = useAuth();
  const { selectedFirm } = useFirm();
  const [transactionType, setTransactionType] = useState<string>('invoice');
  const [transactionDate, setTransactionDate] = useState(formatDateTR(new Date()));
  const [firmId, setFirmId] = useState('');
  const [cariId, setCariId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [description, setDescription] = useState('');
  const [isException, setIsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  
  // Ödeme yöntemi (gelir/gider için)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'check' | ''>('');
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  
  // Çek alanları
  const [checkNumber, setCheckNumber] = useState('');
  const [checkType, setCheckType] = useState<'received' | 'given'>('received');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const [firms, setFirms] = useState<Firm[]>([]);
  const [cariler, setCariler] = useState<Cari[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([]);
  const [items, setItems] = useState<TransactionItemInput[]>([]);
  const [previousDescriptions, setPreviousDescriptions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Yeni işlem tipi ekleme modal
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeValue, setNewTypeValue] = useState('');
  const [addingType, setAddingType] = useState(false);
  
  // Yeni firma ekleme modal
  const [showAddFirmModal, setShowAddFirmModal] = useState(false);
  const [newFirmName, setNewFirmName] = useState('');
  const [newFirmTaxNumber, setNewFirmTaxNumber] = useState('');
  const [newFirmPhone, setNewFirmPhone] = useState('');
  const [newFirmType, setNewFirmType] = useState<'customer' | 'supplier' | 'both'>('customer');
  const [addingFirm, setAddingFirm] = useState(false);
  
  // Excel import
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedFirm]);

  const fetchData = async () => {
    let projectsQuery = supabase.from('projects').select('*').eq('status', 'active');
    let cashQuery = supabase.from('cash_registers').select('*').eq('is_active', true);
    let bankQuery = supabase.from('bank_accounts').select('*').eq('is_active', true);

    // Seçili firmaya göre filtrele
    if (selectedFirm) {
      projectsQuery = projectsQuery.eq('firm_id', selectedFirm.id);
      cashQuery = cashQuery.eq('firm_id', selectedFirm.id);
      bankQuery = bankQuery.eq('firm_id', selectedFirm.id);
    }

    const [firmsRes, carilerRes, projectsRes, categoriesRes, typesRes, cashRes, bankRes, productsRes, unitsRes, descriptionsRes] = await Promise.all([
      supabase.from('firms').select('*').eq('is_active', true).in('type', ['customer', 'supplier']),
      supabase.from('cariler').select('*').eq('is_active', true).order('code'),
      projectsQuery,
      supabase.from('expense_categories').select('*').eq('is_active', true),
      supabase.from('transaction_types').select('*').eq('is_active', true).order('sort_order'),
      cashQuery,
      bankQuery,
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('stock_units').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('transactions').select('description').not('description', 'is', null),
    ]);

    if (firmsRes.data) setFirms(firmsRes.data);
    if (carilerRes.data) setCariler(carilerRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (categoriesRes.data) setExpenseCategories(categoriesRes.data);
    if (typesRes.data) setTransactionTypes(typesRes.data);
    if (cashRes.data) setCashRegisters(cashRes.data);
    if (bankRes.data) setBankAccounts(bankRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (unitsRes.data) setStockUnits(unitsRes.data);
    
    // Benzersiz açıklamaları çek
    if (descriptionsRes.data) {
      const uniqueDescriptions = [...new Set(descriptionsRes.data.map(d => d.description).filter(Boolean))];
      setPreviousDescriptions(uniqueDescriptions);
    }
  };

  const handleInvoiceNumberChange = (value: string) => {
    // Sadece temizle, formatlamayı Enter'a bırak
    const clean = value.replace(/[^a-zA-Z0-9/]/g, '').toUpperCase();
    setInvoiceNumber(clean);
  };

  const handleInvoiceNumberKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const formatted = formatInvoiceNumberOnSave(invoiceNumber);
      setInvoiceNumber(formatted);
    }
  };

  // Otomatik numaralandırma için son numarayı çek
  const fetchNextNumber = async (prefix: string) => {
    const { data } = await supabase
      .from('transactions')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0 && data[0].invoice_number) {
      const lastNum = data[0].invoice_number;
      const match = lastNum.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return `${prefix}${String(nextNum).padStart(3, '0')}`;
      }
    }
    return `${prefix}001`;
  };

  // İşlem tipi değiştiğinde otomatik numara ata
  const handleTransactionTypeChange = async (newType: string) => {
    setTransactionType(newType);
    
    // Gelir veya gider ise ve numara boşsa otomatik ata
    if ((newType === 'income' || newType === 'expense') && !invoiceNumber) {
      const prefix = newType === 'income' ? 'GEL' : 'GID';
      const nextNum = await fetchNextNumber(prefix);
      setInvoiceNumber(nextNum);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit: 'adet',
        unit_price: 0,
        amount: 0,
        vat_rate: 20,
        vat_amount: 0,
        withholding_rate: 0,
        withholding_amount: 0,
        stopaj_rate: 0,
        stopaj_amount: 0,
        discount_rate: 0,
        discount_amount: 0,
        sort_order: items.length,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof TransactionItemInput, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const unitPrice = field === 'unit_price' ? Number(value) : newItems[index].unit_price;
      newItems[index].amount = quantity * unitPrice;
      newItems[index].vat_amount = newItems[index].amount * ((newItems[index].vat_rate || 20) / 100);
      newItems[index].withholding_amount = newItems[index].amount * ((newItems[index].withholding_rate || 0) / 100);
      newItems[index].stopaj_amount = newItems[index].amount * ((newItems[index].stopaj_rate || 0) / 100);
    }
    
    if (field === 'vat_rate') {
      newItems[index].vat_amount = (newItems[index].amount || 0) * (Number(value) / 100);
    }
    
    if (field === 'withholding_rate') {
      newItems[index].withholding_amount = (newItems[index].amount || 0) * (Number(value) / 100);
    }
    
    if (field === 'stopaj_rate') {
      newItems[index].stopaj_amount = (newItems[index].amount || 0) * (Number(value) / 100);
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddProduct = async (index: number) => {
    const itemName = items[index].description;
    if (!itemName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          code: itemName.substring(0, 10).toUpperCase(),
          name: itemName,
          stock_quantity: 0,
          unit: items[index].unit || 'adet',
          unit_price: items[index].unit_price || 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newItems = [...items];
        newItems[index].product_id = data.id;
        setItems(newItems);
        fetchData();
        setMessage({ type: 'success', text: `"${itemName}" ürün olarak eklendi!` });
      }
    } catch (error) {
      console.error('Ürün eklenirken hata:', error);
      setMessage({ type: 'error', text: 'Ürün eklenirken bir hata oluştu.' });
    }
  };

  const handleProductSelect = (index: number, productName: string) => {
    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: product.id,
        description: product.name,
        unit: product.unit,
      };
      setItems(newItems);
    }
  };

  const handleAddTransactionType = async () => {
    if (!newTypeName.trim() || !newTypeValue.trim()) {
      setMessage({ type: 'error', text: 'Tip adı ve değeri gereklidir.' });
      return;
    }

    setAddingType(true);
    try {
      const slug = newTypeValue.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const { error } = await supabase
        .from('transaction_types')
        .insert({
          name: newTypeName.trim(),
          value: slug,
          icon: 'file-text',
          color: 'blue',
          sort_order: transactionTypes.length + 1,
        });

      if (error) throw error;

      setMessage({ type: 'success', text: `"${newTypeName}" işlem tipi eklendi!` });
      setShowAddTypeModal(false);
      setNewTypeName('');
      setNewTypeValue('');
      fetchData();
    } catch (error) {
      console.error('İşlem tipi eklenirken hata:', error);
      setMessage({ type: 'error', text: 'İşlem tipi eklenirken bir hata oluştu.' });
    } finally {
      setAddingType(false);
    }
  };

  const handleAddFirm = async () => {
    if (!newFirmName.trim()) {
      setMessage({ type: 'error', text: 'Cari adı gereklidir.' });
      return;
    }

    setAddingFirm(true);
    try {
      const { data, error } = await supabase
        .from('firms')
        .insert({
          name: newFirmName.trim(),
          tax_number: newFirmTaxNumber.trim() || null,
          phone: newFirmPhone.trim() || null,
          type: newFirmType,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setMessage({ type: 'success', text: `"${newFirmName}" carisi eklendi!` });
      setShowAddFirmModal(false);
      setNewFirmName('');
      setNewFirmTaxNumber('');
      setNewFirmPhone('');
      setNewFirmType('customer');
      fetchData();
      
      // Yeni eklenen firmayı seç
      if (data) {
        setFirmId(data.id);
      }
    } catch (error) {
      console.error('Cari eklenirken hata:', error);
      setMessage({ type: 'error', text: 'Cari eklenirken bir hata oluştu.' });
    } finally {
      setAddingFirm(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await importFromExcel(file);
      
      if (!data || data.length === 0) {
        setMessage({ type: 'error', text: 'Excel dosyasında veri bulunamadı.' });
        return;
      }

      // Excel sütunlarını eşle
      let importedCount = 0;
      for (const row of data) {
        const transactionDate = String(row['Tarih'] || row['tarih'] || row['Date'] || formatDateTR(new Date()));
        const transactionType = String(row['İşlem Tipi'] || row['islem_tipi'] || row['Type'] || 'income');
        const firmName = String(row['Firma'] || row['firma'] || row['Firm'] || '');
        const amount = parseFloat(String(row['Tutar'] || row['tutar'] || row['Amount'] || '0'));
        const description = String(row['Açıklama'] || row['aciklama'] || row['Description'] || '');
        const invoiceNumber = String(row['Fatura No'] || row['fatura_no'] || row['Invoice'] || '');

        // Firmayı bul veya oluştur
        let resolvedFirmId = firmId;
        if (firmName && !firmId) {
          const existingFirm = firms.find(f => f.name.toLowerCase() === firmName.toLowerCase());
          if (existingFirm) {
            resolvedFirmId = existingFirm.id;
          } else {
            // Yeni firma oluştur
            const { data: newFirm } = await supabase
              .from('firms')
              .insert({ name: firmName, type: 'both', is_active: true })
              .select()
              .single();
            if (newFirm) {
              resolvedFirmId = newFirm.id;
              await fetchData();
            }
          }
        }

        // İşlemi kaydet
        const { error } = await supabase
          .from('transactions')
          .insert({
            transaction_date: transactionDate,
            transaction_type: transactionType,
            firm_id: resolvedFirmId || null,
            amount: amount,
            invoice_number: invoiceNumber || null,
            description: description || null,
            is_exception: false,
          });

        if (!error) importedCount++;
      }

      setMessage({ type: 'success', text: `${importedCount} işlem başarıyla içe aktarıldı!` });
      setShowExcelImport(false);
    } catch (error) {
      console.error('Excel import hatası:', error);
      setMessage({ type: 'error', text: 'Excel dosyası okunurken bir hata oluştu.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const calculateTotals = () => {
    const subTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalVat = items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    const totalWithholding = items.reduce((sum, item) => sum + (item.withholding_amount || 0), 0);
    const totalStopaj = items.reduce((sum, item) => sum + (item.stopaj_amount || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const grandTotal = subTotal + totalVat - totalWithholding - totalStopaj - totalDiscount;
    return { subTotal, totalVat, totalWithholding, totalStopaj, totalDiscount, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Validasyon: Proje zorunlu
      if (!projectId) {
        setMessage({ type: 'error', text: 'Proje seçimi zorunludur!' });
        setLoading(false);
        return;
      }

      // Validasyon: Firma zorunlu
      if (!firmId) {
        setMessage({ type: 'error', text: 'Firma seçimi zorunludur! Lütfen üstten bir firma seçin.' });
        setLoading(false);
        return;
      }

      // Fatura türünde stok seçilmediyse açıklama zorunlu
      if (isAnyInvoice && items.length === 0 && !description.trim()) {
        setMessage({ type: 'error', text: 'Stok kalemi eklenmediyse açıklama girmek zorunludur!' });
        setLoading(false);
        return;
      }

      // Gelir/Gider için numara yoksa otomatik ata
      let finalInvoiceNumber = invoiceNumber ? formatInvoiceNumberOnSave(invoiceNumber) : '';
      if ((isIncomeType || isExpenseType) && !finalInvoiceNumber) {
        const prefix = isIncomeType ? 'GEL' : 'GID';
        finalInvoiceNumber = await fetchNextNumber(prefix);
      }
      
      if (isAnyInvoice && finalInvoiceNumber && firmId) {
        const { isDuplicate, existing } = await checkDuplicateInvoice(
          firmId,
          transactionType,
          finalInvoiceNumber
        );
        
        if (isDuplicate && existing) {
          setMessage({
            type: 'error',
            text: `Bu firmaya ait bu numarada fatura zaten mevcut! (Tarih: ${existing.transaction_date}, Tutar: ${existing.amount})`,
          });
          setLoading(false);
          return;
        }
      }

      const totals = calculateTotals();
      
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          transaction_date: transactionDate,
          transaction_type: transactionType,
          firm_id: firmId || null,
          cari_id: cariId || null,
          expense_category_id: expenseCategoryId || null,
          project_id: projectId || null,
          amount: totals.grandTotal,
          invoice_number: (isAnyInvoice || isIncomeType || isExpenseType) && finalInvoiceNumber ? finalInvoiceNumber : null,
          delivery_note_number: transactionType === 'delivery_note' ? deliveryNoteNumber : null,
          is_exception: isException,
          exception_reason: isException ? exceptionReason : null,
          description,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Çek tipi seçildiyse çek kaydı oluştur
      if (transactionType === 'check' && checkNumber && firmId) {
        const { error: checkError } = await supabase
          .from('checks')
          .insert({
            check_number: checkNumber,
            check_type: checkType,
            firm_id: firmId,
            bank_name: bankName || null,
            bank_branch: bankBranch || null,
            amount: totals.grandTotal,
            issue_date: transactionDate,
            due_date: dueDate || transactionDate,
            status: 'pending',
            transaction_id: transaction.id,
            notes: description || null,
          });

        if (checkError) throw checkError;
      }

      // Gelir/Gider için ödeme yöntemi varsa ilgili kaydı oluştur
      if ((transactionType === 'income' || transactionType === 'expense') && paymentMethod) {
        const isIncome = transactionType === 'income';
        
        // Nakit ise kasa hareketi oluştur
        if (paymentMethod === 'cash' && cashRegisterId) {
          const { error: cashError } = await supabase
            .from('cash_transactions')
            .insert({
              cash_register_id: cashRegisterId,
              transaction_id: transaction.id,
              transaction_type: isIncome ? 'in' : 'out',
              firm_id: firmId || null,
              cari_id: cariId || null,
              project_id: projectId || null,
              amount: totals.grandTotal,
              description: description || `${isIncome ? 'Gelir' : 'Gider'} kaydı`,
            });

          if (cashError) throw cashError;

          // Kasa bakiyesini güncelle
          const register = cashRegisters.find(r => r.id === cashRegisterId);
          if (register) {
            const newBalance = isIncome
              ? register.current_balance + totals.grandTotal
              : register.current_balance - totals.grandTotal;
            await supabase.from('cash_registers').update({ current_balance: newBalance }).eq('id', cashRegisterId);
          }
        }

        // Banka ise banka hareketi oluştur
        if (paymentMethod === 'bank' && bankAccountId) {
          const { error: bankError } = await supabase
            .from('bank_transactions')
            .insert({
              bank_account_id: bankAccountId,
              transaction_id: transaction.id,
              transaction_type: isIncome ? 'in' : 'out',
              firm_id: firmId || null,
              cari_id: cariId || null,
              project_id: projectId || null,
              amount: totals.grandTotal,
              description: description || `${isIncome ? 'Gelir' : 'Gider'} kaydı`,
            });

          if (bankError) throw bankError;

          // Banka bakiyesini güncelle
          const account = bankAccounts.find(a => a.id === bankAccountId);
          if (account) {
            const newBalance = isIncome
              ? account.current_balance + totals.grandTotal
              : account.current_balance - totals.grandTotal;
            await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', bankAccountId);
          }
        }

        // Çek ise çek kaydı oluştur
        if (paymentMethod === 'check' && checkNumber && firmId) {
          const { error: checkError } = await supabase
            .from('checks')
            .insert({
              check_number: checkNumber,
              check_type: isIncome ? 'received' : 'given',
              firm_id: firmId,
              bank_name: bankName || null,
              bank_branch: bankBranch || null,
              amount: totals.grandTotal,
              issue_date: transactionDate,
              due_date: dueDate || transactionDate,
              status: 'pending',
              transaction_id: transaction.id,
              notes: description || null,
            });

          if (checkError) throw checkError;
        }
      }

      if ((isAnyInvoice || isDeliveryNoteType) && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          transaction_id: transaction.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate || 20,
          vat_amount: item.vat_amount || 0,
          discount_rate: item.discount_rate || 0,
          discount_amount: item.discount_amount || 0,
          sort_order: item.sort_order || 0,
        }));

        const { error: itemsError } = await supabase
          .from('transaction_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Alış faturası ise stok artır, satış faturası ise stok azalt
        if ((isPurchaseInvoice || isSaleInvoice) && items.length > 0) {
          for (const item of items) {
            if (item.product_id && item.quantity > 0) {
              const stockChange = isPurchaseInvoice ? item.quantity : -item.quantity;
              
              // Ürünün mevcut stokunu al
              const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();

              if (product) {
                const newQuantity = product.stock_quantity + stockChange;
                await supabase
                  .from('products')
                  .update({ stock_quantity: Math.max(0, newQuantity) })
                  .eq('id', item.product_id);
              }
            }
          }
        }
      }

      setMessage({ type: 'success', text: 'İşlem başarıyla kaydedildi!' });
      
      setFirmId('');
      setCariId('');
      setProjectId('');
      setExpenseCategoryId('');
      setInvoiceNumber('');
      setDeliveryNoteNumber('');
      setDescription('');
      setIsException(false);
      setExceptionReason('');
      setItems([]);
      setTransactionDate(formatDateTR(new Date()));
      setCheckNumber('');
      setBankName('');
      setBankBranch('');
      setDueDate('');
      setPaymentMethod('');
      setCashRegisterId('');
      setBankAccountId('');
    } catch (error) {
      console.error('İşlem kaydedilirken hata:', error);
      setMessage({ type: 'error', text: 'İşlem kaydedilirken bir hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const activeColors = getTypeColor(transactionType);

  const isIncomeType = transactionType === 'income';
  const isExpenseType = transactionType === 'expense';
  const isInvoiceType = transactionType === 'invoice';
  const isDeliveryNoteType = transactionType === 'delivery_note';
  const isPurchaseInvoice = transactionType === 'purchase_invoice';
  const isSaleInvoice = transactionType === 'sale_invoice';
  const isAnyInvoice = isInvoiceType || isPurchaseInvoice || isSaleInvoice;
  
  const showFirm = !isExpenseType;
  const showExpenseCategory = isExpenseType;
  const showInvoiceNumber = isAnyInvoice || isIncomeType || isExpenseType;
  const showDeliveryNoteNumber = isDeliveryNoteType;
  const showItems = isAnyInvoice || isDeliveryNoteType;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          İşlem Girişi
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${activeColors.bg} ${activeColors.text} ${activeColors.border} border`}>
            {transactionTypes.find(t => t.value === transactionType)?.name || transactionType}
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowExcelImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet size={16} />
            Excel'den İçe Aktar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">İşlem Tipi</label>
            <button
              type="button"
              onClick={() => setShowAddTypeModal(true)}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Yeni Tip Ekle
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {transactionTypes.map((type) => {
              const colors = getTypeColor(type.value);
              const isSelected = transactionType === type.value;
              return (
                <label
                  key={type.value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all font-medium ${
                    isSelected
                      ? `${colors.bg} ${colors.border} ${colors.text} shadow-md scale-[1.03]`
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="transactionType"
                    value={type.value}
                    checked={isSelected}
                    onChange={(e) => handleTransactionTypeChange(e.target.value)}
                    className="sr-only"
                  />
                  <span className={isSelected ? colors.icon : 'text-slate-400'}>
                    {getTypeIcon(type.value)}
                  </span>
                  {type.name}
                </label>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isException}
              onChange={(e) => setIsException(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              İstisna İşlem (gelir/gider hesaplamasına dahil değildir)
            </span>
          </label>
          
          {isException && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">İstisna Nedeni</label>
              <select
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Seçiniz...</option>
                <option value="return">İade</option>
                <option value="proforma">Proforma</option>
                <option value="temporary">Geçici Kayıt</option>
                <option value="trial">Deneme</option>
                <option value="offset">Mahsup</option>
                <option value="other">Diğer</option>
              </select>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
          <div className="flex flex-nowrap gap-0 border-t border-slate-300 overflow-x-auto bg-slate-100">
            {showFirm && (
              <ResizableCell cellId="giris-firma" className="bg-slate-100">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-sm font-medium text-slate-700">Firma</label>
                  <button
                    type="button"
                    onClick={() => setShowAddFirmModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={12} />
                    Yeni Ekle
                  </button>
                </div>
                <SearchableSelect
                  options={firms.map(f => ({ id: f.id, code: f.code, name: f.name }))}
                  value={firmId}
                  onChange={(id) => setFirmId(id)}
                  placeholder="Firma ara..."
                  required
                />
              </ResizableCell>
            )}

            <ResizableCell cellId="giris-proje" className="bg-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Proje <span className="text-red-500">*</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              >
                <option value="">Seçiniz...</option>
                {projects.filter(p => !firmId || p.firm_id === firmId).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              {firmId && projects.filter(p => p.firm_id === firmId).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Proje bulunamadı</p>
              )}
            </ResizableCell>

            <ResizableCell cellId="giris-tarih">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tarih</label>
              <input
                type="text"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                placeholder="gg.aa.yyyy"
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </ResizableCell>

            {showInvoiceNumber && (
              <ResizableCell cellId="giris-fatura-no">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isIncomeType ? 'Gelir No' : isExpenseType ? 'Gider No' : isPurchaseInvoice ? 'Alış Fatura No' : isSaleInvoice ? 'Satış Fatura No' : 'Fatura No'}
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                  onKeyDown={handleInvoiceNumberKeyDown}
                  placeholder={isIncomeType ? 'GEL2026/1' : isExpenseType ? 'GID2026/1' : 'aab2026/1'}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </ResizableCell>
            )}

            <ResizableCell cellId="giris-cari">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cari</label>
              <SearchableSelect
                options={cariler.map(c => ({ id: c.id, code: c.code, name: c.name }))}
                value={cariId}
                onChange={(id) => setCariId(id)}
                placeholder="Cari ara..."
              />
            </ResizableCell>

            {showExpenseCategory && (
              <ResizableCell cellId="giris-gider-turu">
                <label className="block text-sm font-medium text-slate-700 mb-1">Gider Türü</label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </ResizableCell>
            )}

            {showDeliveryNoteNumber && (
              <ResizableCell cellId="giris-irsaliye-no">
                <label className="block text-sm font-medium text-slate-700 mb-1">İrsaliye No</label>
                <input
                  type="text"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </ResizableCell>
            )}

            {(isIncomeType || isExpenseType) && (
              <ResizableCell cellId="giris-odeme-yontemi">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ödeme Yöntemi</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank' | 'check' | '')}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Seçiniz...</option>
                  <option value="cash">Nakit (Kasa)</option>
                  <option value="bank">Banka Havalesi</option>
                  <option value="check">Çek</option>
                </select>
              </ResizableCell>
            )}

            {(isIncomeType || isExpenseType) && paymentMethod === 'cash' && (
              <ResizableCell cellId="giris-kasa">
                <label className="block text-sm font-medium text-slate-700 mb-1">Kasa</label>
                <select
                  value={cashRegisterId}
                  onChange={(e) => setCashRegisterId(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>{register.name}</option>
                  ))}
                </select>
              </ResizableCell>
            )}

            {(isIncomeType || isExpenseType) && paymentMethod === 'bank' && (
              <ResizableCell cellId="giris-banka">
                <label className="block text-sm font-medium text-slate-700 mb-1">Banka Hesabı</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bank_name} - {account.iban || account.account_number}</option>
                  ))}
                </select>
              </ResizableCell>
            )}

            {(isIncomeType || isExpenseType) && paymentMethod === 'check' && (
              <>
                <ResizableCell cellId="giris-cek-no" minWidth={130}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Çek No</label>
                  <input
                    type="text"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    placeholder="Çek numarası"
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </ResizableCell>
                <ResizableCell cellId="giris-cek-turu" minWidth={110}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Çek Türü</label>
                  <select
                    value={checkType}
                    onChange={(e) => setCheckType(e.target.value as 'received' | 'given')}
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="received">Alınan</option>
                    <option value="given">Verilen</option>
                  </select>
                </ResizableCell>
                <ResizableCell cellId="giris-cek-banka">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banka</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </ResizableCell>
                <ResizableCell cellId="giris-cek-vade" minWidth={130}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vade</label>
                  <input
                    type="text"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="gg.aa.yyyy"
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </ResizableCell>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="mt-4">
            <DescriptionAutocomplete
              value={description}
              onChange={setDescription}
              suggestions={previousDescriptions}
              placeholder="Daha önce kullanılan açıklamalar otomatik gelecek..."
              rows={2}
            />
          </div>
        </div>

        {showItems && (
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Kalemler</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Kalem Ekle
              </button>
            </div>

            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <ResizableTh columnId="islem-kalem-sira" className="text-left py-3 px-2">#</ResizableTh>
                      <ResizableTh columnId="islem-kalem-urun" className="text-left py-3 px-2">Ürün / Açıklama</ResizableTh>
                      <ResizableTh columnId="islem-kalem-miktar" className="text-right py-3 px-2">Miktar</ResizableTh>
                      <ResizableTh columnId="islem-kalem-birim" className="text-left py-3 px-2">Birim</ResizableTh>
                      <ResizableTh columnId="islem-kalem-fiyat" className="text-right py-3 px-2">Birim Fiyat</ResizableTh>
                      <ResizableTh columnId="islem-kalem-tutar" className="text-right py-3 px-2">Tutar</ResizableTh>
                      <ResizableTh columnId="islem-kalem-kdv-oran" className="text-right py-3 px-2">KDV %</ResizableTh>
                      <ResizableTh columnId="islem-kalem-kdv" className="text-right py-3 px-2">KDV</ResizableTh>
                      <ResizableTh columnId="islem-kalem-tevkifat" className="text-right py-3 px-2">Tevkifat %</ResizableTh>
                      <ResizableTh columnId="islem-kalem-stopaj" className="text-right py-3 px-2">Stopaj %</ResizableTh>
                      <ResizableTh columnId="islem-kalem-islem" className="text-center py-3 px-2">İşlem</ResizableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="py-2 px-2">{index + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <div className="relative flex-1">
                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => {
                                    updateItem(index, 'description', e.target.value);
                                    handleProductSelect(index, e.target.value);
                                  }}
                                  placeholder="Ürün ara veya yaz..."
                                  className="w-full pl-7 pr-2 py-1 border border-slate-300 rounded text-sm"
                                  list={`products-${index}`}
                                />
                                <datalist id={`products-${index}`}>
                                  {products.map(product => (
                                    <option key={product.id} value={product.name}>
                                      {product.code} - {product.name} (Stok: {product.stock_quantity})
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                              {!item.product_id && item.description && (
                                <button
                                  type="button"
                                  onClick={() => handleAddProduct(index)}
                                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                  title="Stoğa ekle"
                                >
                                  <Package size={14} />
                                </button>
                              )}
                            </div>
                            {item.product_id && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <Package size={10} /> Stokta
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-sm"
                          >
                            {stockUnits.map(unit => (
                              <option key={unit.id} value={unit.symbol}>{unit.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {(item.amount || 0).toLocaleString('tr-TR')} ₺
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.vat_rate || 20}
                            onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          {(item.vat_amount || 0).toLocaleString('tr-TR')} ₺
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.withholding_rate || 0}
                            onChange={(e) => updateItem(index, 'withholding_rate', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.stopaj_rate || 0}
                            onChange={(e) => updateItem(index, 'stopaj_rate', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">
                Henüz kalem eklenmedi. "Kalem Ekle" butonuna tıklayın.
              </p>
            )}

            {items.length > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Ara Toplam:</span>
                    <span className="font-medium">{totals.subTotal.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">KDV:</span>
                    <span className="font-medium text-blue-600">+{totals.totalVat.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  {totals.totalWithholding > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tevkifat:</span>
                      <span className="font-medium text-orange-600">-{totals.totalWithholding.toLocaleString('tr-TR')} ₺</span>
                    </div>
                  )}
                  {totals.totalStopaj > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Stopaj:</span>
                      <span className="font-medium text-red-600">-{totals.totalStopaj.toLocaleString('tr-TR')} ₺</span>
                    </div>
                  )}
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">İskonto:</span>
                      <span className="font-medium text-purple-600">-{totals.totalDiscount.toLocaleString('tr-TR')} ₺</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                    <span>GENEL TOPLAM:</span>
                    <span className="text-blue-600">{totals.grandTotal.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <div
            className={`flex items-center gap-2 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>

      {/* Yeni İşlem Tipi Ekleme Modal */}
      {showAddTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Yeni İşlem Tipi Ekle</h3>
              <button
                onClick={() => setShowAddTypeModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tip Adı</label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => {
                    setNewTypeName(e.target.value);
                    setNewTypeValue(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }}
                  placeholder="Örn: Proforma Fatura"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sistem Değeri</label>
                <input
                  type="text"
                  value={newTypeValue}
                  onChange={(e) => setNewTypeValue(e.target.value)}
                  placeholder="proforma_fatura"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50"
                />
                <p className="mt-1 text-xs text-slate-500">Otomatik oluşturulur, gerekirse düzenleyin</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddTypeModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleAddTransactionType}
                disabled={addingType || !newTypeName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                {addingType ? 'Ekleniyor...' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Firma Ekleme Modal */}
      {showAddFirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Yeni Cari Ekle</h3>
              <button
                onClick={() => setShowAddFirmModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cari Adı *</label>
                <input
                  type="text"
                  value={newFirmName}
                  onChange={(e) => setNewFirmName(e.target.value)}
                  placeholder="Örn: ABC Ltd. Şti."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vergi Numarası</label>
                <input
                  type="text"
                  value={newFirmTaxNumber}
                  onChange={(e) => setNewFirmTaxNumber(e.target.value)}
                  placeholder="1234567890"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="text"
                  value={newFirmPhone}
                  onChange={(e) => setNewFirmPhone(e.target.value)}
                  placeholder="0212 555 1234"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tür</label>
                <select
                  value={newFirmType}
                  onChange={(e) => setNewFirmType(e.target.value as 'customer' | 'supplier' | 'both')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="customer">Müşteri</option>
                  <option value="supplier">Tedarikçi</option>
                  <option value="both">Müşteri/Tedarikçi</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddFirmModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleAddFirm}
                disabled={addingFirm || !newFirmName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                {addingFirm ? 'Ekleniyor...' : 'Ekle ve Seç'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel İçe Aktarma Modal */}
      {showExcelImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Excel'den İşlem İçe Aktar</h3>
              <button
                onClick={() => setShowExcelImport(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Beklenen Sütunlar:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- <strong>Tarih</strong> (gg.aa.yyyy formatında)</li>
                  <li>- <strong>İşlem Tipi</strong> (income, expense, invoice, delivery_note)</li>
                  <li>- <strong>Firma</strong> (firma adı)</li>
                  <li>- <strong>Tutar</strong> (sayı)</li>
                  <li>- <strong>Açıklama</strong> (opsiyonel)</li>
                  <li>- <strong>Fatura No</strong> (opsiyonel)</li>
                </ul>
              </div>

              {/* Örnek CSV İndirme */}
              <button
                type="button"
                onClick={() => {
                  const csvContent = `Tarih,İşlem Tipi,Cari,Tutar,Açıklama,Fatura No,Proje
01.01.2026,income,ABC İnşaat,5000,Mal satışı,FTR2026/1,Proje A
02.01.2026,expense,XYZ Ticaret,1200,Kira ödemesi,,Proje B
03.01.2026,invoice,DEF A.Ş.,8500,Hizmet bedeli,FTR2026/2,Proje A`;
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'islem-ornek.csv';
                  link.click();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={16} />
                Örnek CSV İndir
              </button>
              
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center relative">
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 mb-3">Excel dosyasını seçin</p>
                <input
                  ref={(input) => {
                    if (input) {
                      input.setAttribute('id', 'excel-file-input');
                    }
                  }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelImport}
                  className="hidden"
                  disabled={importing}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('excel-file-input')?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={importing}
                >
                  {importing ? 'İçe Aktarılıyor...' : 'Dosya Seç'}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowExcelImport(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}