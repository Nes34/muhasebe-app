import * as XLSX from 'xlsx';
import type { Transaction, Cari, Firm } from '../types';

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Sayfa1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    '\uFEFF' + headers.join(';'),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? '');
      return val.includes(';') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(';'))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export function importFromExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData as Record<string, unknown>[]);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportCarilerToCSV(cariler: Cari[]) {
  const data = cariler.map(c => ({
    'Kod': c.code || '',
    'Cari Adı': c.name,
    'Vergi No': c.tax_number || '',
    'Tür': c.type === 'customer' ? 'Alıcı' : c.type === 'supplier' ? 'Satıcı' : 'Alıcı/Satıcı',
    'Adres': c.address || '',
    'Telefon': c.phone || '',
    'E-posta': c.email || '',
  }));
  exportToCSV(data, 'cariler');
}

export function exportFirmsToCSV(firms: Firm[]) {
  const data = firms.map(f => ({
    'Kod': f.code || '',
    'Firma Adı': f.name,
    'Vergi No': f.tax_number || '',
    'Tür': f.type === 'both' ? 'Her İkisi' : f.type === 'customer' ? 'Alıcı' : 'Satıcı',
    'Adres': f.address || '',
    'Telefon': f.phone || '',
    'E-posta': f.email || '',
  }));
  exportToCSV(data, 'firmalar');
}

export function exportTransactionsToExcel(transactions: Transaction[]) {
  const data = transactions.map(t => ({
    'Tarih': t.transaction_date,
    'İşlem Tipi': getTransactionTypeLabel(t.transaction_type),
    'Firma': t.firm?.name || '-',
    'Proje': t.project?.name || '-',
    'Fatura No': t.invoice_number || '-',
    'Tutar': t.amount,
    'Açıklama': t.description || '-',
    'İstisna': t.is_exception ? 'Evet' : 'Hayır',
  }));
  
  exportToExcel(data, 'islemler', 'İşlemler');
}

export function exportAccountStatementToExcel(transactions: any[], cariName: string) {
  let running = 0;
  const data = transactions.map((t, i) => {
    const amount = Math.abs(t.amount);
    const isIncome = t.isIncome;
    running += isIncome ? amount : -amount;

    const typeLabels: Record<string, string> = {
      income: 'Gelir', expense: 'Gider', invoice: 'Fatura',
      sale_invoice: 'Satış Faturası', purchase_invoice: 'Alış Faturası',
      delivery_note: 'İrsaliye', sale_delivery_note: 'Satış İrsaliyesi',
      purchase_delivery_note: 'Alış İrsaliyesi',
      cash_in: 'Kasa Giriş', cash_out: 'Kasa Çıkış',
      bank_in: 'Banka Giriş', bank_out: 'Banka Çıkış',
      check_received: 'Alınan Çek', check_given: 'Verilen Çek',
    };
    const kaynakLabels: Record<string, string> = {
      transaction: 'İşlem', check: 'Çek', cash: 'Kasa', bank: 'Banka',
    };

    return {
      'Sıra': i + 1,
      'Tarih': t.date || t.transaction_date || '',
      'Kaynak': kaynakLabels[t.source] || t.source || '',
      'İşlem Türü': typeLabels[t.transaction_type] || t.transaction_type || '',
      'Firma': t.firm?.name || '',
      'Proje': t.project?.name || '',
      'Açıklama': t.description || '',
      'Fatura No': t.invoice_number || '',
      'İrsaliye No': t.delivery_note_number || '',
      'Borç (TL)': !isIncome ? amount : '',
      'Alacak (TL)': isIncome ? amount : '',
      'Bakiye (TL)': running,
      'İstisna': t.is_exception ? 'Evet' : '',
    };
  });

  exportToExcel(data, `cari-hesap-${cariName}`, 'Cari Hesap Ekstresi');
}

export function exportChecksToExcel(checks: any[]) {
  const data = checks.map(c => ({
    'Çek No': c.check_number,
    'Tür': c.check_type === 'received' ? 'Alınan' : 'Verilen',
    'Cari': c.cari?.name || c.firm?.name || '-',
    'Banka': c.bank_name || '-',
    'Şube': c.bank_branch || '-',
    'Tutar': c.amount,
    'Düzenleme Tarihi': c.issue_date,
    'Vade Tarihi': c.due_date,
    'Durum': getStatusLabel(c.status),
  }));
  exportToExcel(data, 'cekler', 'Çekler');
}

export function exportCashTransactionsToExcel(transactions: any[]) {
  const data = transactions.map(t => ({
    'Tarih': t.created_at,
    'Tür': t.transaction_type === 'in' ? 'Giriş' : 'Çıkış',
    'Tutar': t.amount,
    'Cari': t.cari?.name || '-',
    'Proje': t.project?.name || '-',
    'Açıklama': t.description || '-',
  }));
  exportToExcel(data, 'kasa-hareketleri', 'Kasa Hareketleri');
}

export function exportBankTransactionsToExcel(transactions: any[]) {
  const data = transactions.map(t => ({
    'Tarih': t.created_at,
    'Tür': t.transaction_type === 'in' ? 'Giriş' : 'Çıkış',
    'Tutar': t.amount,
    'Cari': t.cari?.name || '-',
    'Proje': t.project?.name || '-',
    'Açıklama': t.description || '-',
  }));
  exportToExcel(data, 'banka-hareketleri', 'Banka Hareketleri');
}

export function exportProjectsToExcel(projects: any[]) {
  const data = projects.map(p => ({
    'Proje Adı': p.name,
    'Firma': p.firm?.name || '-',
    'Durum': p.status === 'active' ? 'Aktif' : p.status === 'completed' ? 'Tamamlandı' : 'İptal',
    'Bütçe': p.budget || 0,
    'Gider': p.expense || 0,
    'Kalan': (p.budget || 0) - (p.expense || 0),
    'Tamamlanma': `%${p.completionRate || 0}`,
  }));
  exportToExcel(data, 'projeler', 'Projeler');
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Bekliyor', collected: 'Tahsil', paid: 'Ödendi', endorsed: 'Ciro', cancelled: 'İptal',
  };
  return labels[status] || status;
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    income: 'Gelir', expense: 'Gider', invoice: 'Fatura', delivery_note: 'İrsaliye',
  };
  return labels[type] || type;
}