import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction } from '../types';
import { formatCurrency } from './utils';

export function generateInvoicePDF(transaction: Transaction, companyName = 'Muhasebe') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 15, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Muhasebe Uygulaması', 15, 28);

  // Invoice type
  const invoiceType = transaction.transaction_type === 'invoice' ? 'FATURA' : 'İRSALİYE';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceType, pageWidth - 15, 18, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`No: ${transaction.invoice_number || transaction.delivery_note_number || '-'}`, pageWidth - 15, 28, { align: 'right' });

  // Info section
  doc.setTextColor(0, 0, 0);
  let y = 55;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tarih:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(transaction.transaction_date, 55, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('İşlem No:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(transaction.transaction_number), 55, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Cari:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(transaction.cari?.name || transaction.firm?.name || '-', 55, y);

  if (transaction.cari?.tax_number || transaction.firm?.tax_number) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Vergi No:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.cari?.tax_number || transaction.firm?.tax_number || '-', 55, y);
  }

  if (transaction.cari?.address || transaction.firm?.address) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Adres:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.cari?.address || transaction.firm?.address || '-', 55, y);
  }

  if (transaction.project?.name) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Proje:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.project.name, 55, y);
  }

  // Items table
  y += 15;

  if (transaction.items && transaction.items.length > 0) {
    const tableData = transaction.items.map(item => [
      item.description,
      item.product?.name || '-',
      String(item.quantity),
      item.unit,
      formatCurrency(item.unit_price),
      `%${item.vat_rate}`,
      formatCurrency(item.vat_amount),
      `%${item.discount_rate}`,
      formatCurrency(item.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Açıklama', 'Ürün', 'Miktar', 'Birim', 'Birim Fiyat', 'KDV', 'KDV Tutarı', 'İndirim', 'Tutar']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // Single item
    autoTable(doc, {
      startY: y,
      head: [['Açıklama', 'Miktar', 'Tutar']],
      body: [[transaction.description || '-', '-', formatCurrency(transaction.amount)]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold' },
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  }

  // Totals
  const totals = transaction.items?.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.amount,
      vatTotal: acc.vatTotal + item.vat_amount,
      discountTotal: acc.discountTotal + item.discount_amount,
    }),
    { subtotal: 0, vatTotal: 0, discountTotal: 0 }
  ) || { subtotal: transaction.amount, vatTotal: 0, discountTotal: 0 };

  const grandTotal = transaction.amount;

  doc.setDrawColor(41, 98, 255);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 80, y, pageWidth - 15, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Ara Toplam:', pageWidth - 80, y);
  doc.text(formatCurrency(totals.subtotal + totals.discountTotal), pageWidth - 15, y, { align: 'right' });

  if (totals.discountTotal > 0) {
    y += 7;
    doc.setTextColor(220, 38, 38);
    doc.text('İndirim:', pageWidth - 80, y);
    doc.text(`-${formatCurrency(totals.discountTotal)}`, pageWidth - 15, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  if (totals.vatTotal > 0) {
    y += 7;
    doc.text('KDV Toplamı:', pageWidth - 80, y);
    doc.text(formatCurrency(totals.vatTotal), pageWidth - 15, y, { align: 'right' });
  }

  y += 7;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('GENEL TOPLAM:', pageWidth - 80, y);
  doc.setTextColor(41, 98, 255);
  doc.text(formatCurrency(grandTotal, transaction.currency), pageWidth - 15, y, { align: 'right' });

  // Footer
  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Bu belge Muhasebe Uygulaması tarafından otomatik olarak oluşturulmuştur.', 15, 280);
  doc.text(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`, 15, 285);

  if (transaction.description) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text('Açıklama:', 15, 270);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.description, 15, 275);
  }

  // Save
  const fileName = `${invoiceType.toLowerCase()}-${transaction.invoice_number || transaction.delivery_note_number || transaction.transaction_number}.pdf`;
  doc.save(fileName);
}
