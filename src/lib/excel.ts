import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Sayfa1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
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

export function exportAccountStatementToExcel(transactions: Transaction[], firmName: string) {
  const data = transactions.map(t => ({
    'Tarih': t.transaction_date,
    'İşlem': getTransactionTypeLabel(t.transaction_type),
    'Açıklama': t.description || t.invoice_number || '-',
    'Borç': t.transaction_type === 'income' || t.transaction_type === 'invoice' ? t.amount : 0,
    'Alacak': t.transaction_type === 'expense' ? t.amount : 0,
  }));
  
  exportToExcel(data, `cari-hesap-${firmName}`, 'Cari Hesap Ekstresi');
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    income: 'Gelir',
    expense: 'Gider',
    invoice: 'Fatura',
    delivery_note: 'İrsaliye',
  };
  return labels[type] || type;
}