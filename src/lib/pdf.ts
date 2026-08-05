import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction } from '../types';
import { DEJAVU_SANS_NORMAL, DEJAVU_SANS_BOLD } from './fonts/fontData';
import { GIB_LOGO_BASE64 } from './gibLogo';

function pdfCurrency(amount: number, _currency?: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const FONT_NAME = 'DejaVuSans';

function initFont(doc: jsPDF) {
  doc.addFileToVFS(`${FONT_NAME}.ttf`, DEJAVU_SANS_NORMAL);
  doc.addFileToVFS(`${FONT_NAME}-Bold.ttf`, DEJAVU_SANS_BOLD);
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, 'normal');
  doc.addFont(`${FONT_NAME}-Bold.ttf`, FONT_NAME, 'bold');
}

function setFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal', size: number = 10) {
  doc.setFont(FONT_NAME, style);
  doc.setFontSize(size);
}

// Uzun metni sığdır, gerekirse kaydır
function fitText(doc: jsPDF, text: string, maxWidth: number, x: number, y: number, lineHeight: number = 5): number {
  if (!text) return y;
  
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

// İrsaliye numarasını formatla (16 haneli, ilk 7 tam, sonra / ile)
function formatDeliveryNoteNumber(noteNumber: string): string {
  if (!noteNumber) return '-';
  
  // IRS2026/000000175 formatında ise
  if (noteNumber.includes('/')) {
    const parts = noteNumber.split('/');
    const prefix = parts[0]; // IRS2026
    const number = parseInt(parts[1]) || 0;
    return `${prefix}/${number}`;
  }
  
  // 16 haneli ise
  if (noteNumber.length === 16) {
    const prefix = noteNumber.substring(0, 7); // İlk 7 karakter
    const number = parseInt(noteNumber.substring(7)) || 0;
    return `${prefix}/${number}`;
  }
  
  return noteNumber;
}

// GİB amblemini çiz (logo base64)
function drawGibEmblem(doc: jsPDF, x: number, y: number, size = 16) {
  const half = size / 2;
  try {
    doc.addImage(GIB_LOGO_BASE64, 'PNG', x - half, y - half, size, size);
  } catch {
    // Fallback: basit daire + GİB yazısı
    doc.setFillColor(0, 51, 102);
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.8);
    doc.circle(x, y, half * 0.9, 'FD');
    doc.setTextColor(255, 255, 255);
    setFont(doc, 'bold', Math.max(5, half * 0.6));
    doc.text('GİB', x, y + 1.5, { align: 'center' });
  }
}

export function generateInvoicePDF(transaction: Transaction, companyName = 'Muhasebe') {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fatura türü
  const isInvoice = ['sale_invoice', 'purchase_invoice', 'invoice'].includes(transaction.transaction_type);
  const isSale = ['sale_invoice', 'invoice'].includes(transaction.transaction_type);
  const invoiceType = isInvoice ? 'FATURA' : 'İRSALİYE';
  
  // Satıcı ve alıcı bilgileri
  const seller = isSale ? transaction.firm : transaction.cari;
  const buyer = isSale ? transaction.cari : transaction.firm;

  let y = 15;

  // ══════════════════════════════════════════════════════════════
  // HEADER: Koyu arka plan + mavi accent
  // ══════════════════════════════════════════════════════════════
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 40, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 18);
  doc.text(seller?.name || companyName, 15, 18);
  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text('Muhasebe Uygulaması', 15, 28);

  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text(`No: ${transaction.invoice_number || transaction.delivery_note_number || '-'}`, pageWidth - 15, 28, { align: 'right' });

  y = 52;

  // ══════════════════════════════════════════════════════════════
  // SATICI BİLGİLERİ
  // ══════════════════════════════════════════════════════════════
  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 8);
  doc.text('SATICI', 15, y);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 9);
  doc.text(seller?.name || companyName, 15, y + 6);
  setFont(doc, 'normal', 8);
  doc.text(`Vergi No: ${seller?.tax_number || '-'}`, 15, y + 12);
  doc.text(`Vergi Dairesi: ${seller?.tax_office || '-'}`, 15, y + 18);

  y += 28;

  // ══════════════════════════════════════════════════════════════
  // İKİ AYRAÇ + FATURA YAZISI + GİB AMBLEMİ
  // ══════════════════════════════════════════════════════════════
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(15, y, 65, y);

  y += 5;

  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 14);
  doc.text('FATURA', pageWidth / 2, y, { align: 'center' });

  y += 5;

  doc.setDrawColor(0, 0, 0);
  doc.line(15, y, 65, y);

  drawGibEmblem(doc, pageWidth / 2, y + 7, 10);

  y += 16;

  // ══════════════════════════════════════════════════════════════
  // ALICI BİLGİLERİ + FATURA TARİHİ/NO (Sağ)
  // ══════════════════════════════════════════════════════════════
  const rightX = pageWidth - 15;

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 8);
  doc.text('ALICI', 15, y);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 9);
  doc.text(buyer?.name || '-', 15, y + 6);
  setFont(doc, 'normal', 8);
  doc.text(`Vergi No: ${buyer?.tax_number || '-'}`, 15, y + 12);
  doc.text(`Vergi Dairesi: ${buyer?.tax_office || '-'}`, 15, y + 18);
  if (buyer?.address) {
    doc.text(buyer.address, 15, y + 24);
  }

  // Sağ: Fatura tarihi ve no (tablo şeklinde çerçeve)
  const faturaBoxX = rightX - 55;
  const faturaBoxW = 55;
  const faturaBoxStartY = y - 4;

  // Satır satır çerçeve
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  // Başlık satırı
  doc.setFillColor(241, 245, 249);
  doc.rect(faturaBoxX, faturaBoxStartY, faturaBoxW, 7, 'FD');
  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('FATURA BİLGİLERİ', faturaBoxX + 2, y);

  // Tarih satırı
  doc.setFillColor(255, 255, 255);
  doc.rect(faturaBoxX, faturaBoxStartY + 7, faturaBoxW, 8, 'FD');
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 7);
  doc.text('Tarih:', faturaBoxX + 2, y + 7);
  setFont(doc, 'normal', 7);
  doc.text(transaction.transaction_date, faturaBoxX + 18, y + 7);

  // No satırı
  doc.rect(faturaBoxX, faturaBoxStartY + 15, faturaBoxW, 8, 'FD');
  setFont(doc, 'bold', 7);
  doc.text('No:', faturaBoxX + 2, y + 15);
  setFont(doc, 'normal', 7);
  doc.text(transaction.invoice_number || transaction.delivery_note_number || '-', faturaBoxX + 18, y + 15);

  // İrsaliye satırı (varsa)
  let irsaliyeRowH = 0;
  if (!isInvoice && transaction.delivery_note_number) {
    doc.rect(faturaBoxX, faturaBoxStartY + 23, faturaBoxW, 8, 'FD');
    doc.setTextColor(59, 130, 246);
    setFont(doc, 'bold', 6);
    doc.text('İrsaliye:', faturaBoxX + 2, y + 23);
    setFont(doc, 'normal', 6);
    doc.text(formatDeliveryNoteNumber(transaction.delivery_note_number), faturaBoxX + 18, y + 23);
    irsaliyeRowH = 8;
  }

  // Dış çerçeve
  const faturaBoxH = 23 + irsaliyeRowH + 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(faturaBoxX, faturaBoxStartY, faturaBoxW, faturaBoxH, 'S');

  // Dikey çizgi (başlık | değer)
  doc.setLineWidth(0.2);
  doc.line(faturaBoxX + 16, faturaBoxStartY + 7, faturaBoxX + 16, faturaBoxStartY + faturaBoxH);

  // Yatay çizgiler
  doc.line(faturaBoxX, faturaBoxStartY + 7, faturaBoxX + faturaBoxW, faturaBoxStartY + 7);
  doc.line(faturaBoxX, faturaBoxStartY + 15, faturaBoxX + faturaBoxW, faturaBoxStartY + 15);
  if (!isInvoice && transaction.delivery_note_number) {
    doc.line(faturaBoxX, faturaBoxStartY + 23, faturaBoxX + faturaBoxW, faturaBoxStartY + 23);
  }

  y += 36;

  // ══════════════════════════════════════════════════════════════
  // KALEMLER TABLOSU
  // ══════════════════════════════════════════════════════════════
  if (transaction.items && transaction.items.length > 0) {
    const tableData = transaction.items.map((item, index) => [
      String(index + 1),
      item.description || item.product?.name || '-',
      String(item.quantity),
      item.unit || 'Adet',
      pdfCurrency(item.unit_price),
      pdfCurrency(item.amount),
      `%${item.vat_rate}`,
      pdfCurrency(item.vat_amount),
      `%${item.withholding_tax_rate || 0}`,
      `%${item.stoppage_rate || 0}`,
      `%${item.discount_rate || 0}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Sıra', 'Ürün/Açıklama', 'Miktar', 'Birim', 'Birim Fiyat', 'Tutar', 'KDV %', 'KDV', 'Tevkifat %', 'Stopaj %', 'İskonto %']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: FONT_NAME,
        fontSize: 7,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 40 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 18, halign: 'center' },
        9: { cellWidth: 15, halign: 'center' },
        10: { cellWidth: 15, halign: 'center' },
      },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // Tek kalem
    autoTable(doc, {
      startY: y,
      head: [['Sıra', 'Ürün/Açıklama', 'Miktar', 'Birim', 'Birim Fiyat', 'Tutar', 'KDV %', 'KDV', 'Tevkifat %', 'Stopaj %', 'İskonto %']],
      body: [['1', transaction.description || '-', '-', 'Adet', pdfCurrency(transaction.amount), pdfCurrency(transaction.amount), '%0', '0,00 ₺', '%0', '%0', '%0']],
      theme: 'grid',
      styles: {
        font: FONT_NAME,
        fontSize: 7,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 3,
      },
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════
  // BÖLÜM 6: TOPLAMLAR (Sağ Alt)
  // ══════════════════════════════════════════════════════════════
  const totals = transaction.items?.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.amount,
      vatTotal: acc.vatTotal + item.vat_amount,
      discountTotal: acc.discountTotal + (item.discount_amount || 0),
      withholdingTaxTotal: acc.withholdingTaxTotal + (item.withholding_tax_amount || 0),
      stoppageTotal: acc.stoppageTotal + (item.stoppage_amount || 0),
    }),
    { subtotal: 0, vatTotal: 0, discountTotal: 0, withholdingTaxTotal: 0, stoppageTotal: 0 }
  ) || { 
    subtotal: transaction.amount, 
    vatTotal: 0, 
    discountTotal: 0, 
    withholdingTaxTotal: 0, 
    stoppageTotal: 0 
  };

  const grandTotal = transaction.amount;

  // Toplamlar kutusu (tablo şeklinde)
  const boxX = pageWidth - 75;
  const boxW = 60;
  let boxY = y;
  const boxStartY = y - 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  // Ara toplam satırı
  doc.setFillColor(241, 245, 249);
  doc.rect(boxX, boxY - 4, boxW, 8, 'FD');
  setFont(doc, 'normal', 8);
  doc.text('Ara Toplam:', boxX + 2, boxY);
  doc.text(pdfCurrency(totals.subtotal + totals.discountTotal), boxX + boxW - 2, boxY, { align: 'right' });

  // KDV satırı
  if (totals.vatTotal > 0) {
    boxY += 8;
    doc.rect(boxX, boxY - 4, boxW, 8, 'FD');
    doc.text('KDV Toplamı:', boxX + 2, boxY);
    doc.text(pdfCurrency(totals.vatTotal), boxX + boxW - 2, boxY, { align: 'right' });
  }

  // İskonto satırı
  if (totals.discountTotal > 0) {
    boxY += 8;
    doc.rect(boxX, boxY - 4, boxW, 8, 'FD');
    doc.text('İskonto:', boxX + 2, boxY);
    doc.text(`-${pdfCurrency(totals.discountTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Stopaj satırı
  if (totals.stoppageTotal > 0) {
    boxY += 8;
    doc.rect(boxX, boxY - 4, boxW, 8, 'FD');
    doc.text('Stopaj:', boxX + 2, boxY);
    doc.text(`-${pdfCurrency(totals.stoppageTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Tevkifat satırı
  if (totals.withholdingTaxTotal > 0) {
    boxY += 8;
    doc.rect(boxX, boxY - 4, boxW, 8, 'FD');
    doc.text('Tevkifat:', boxX + 2, boxY);
    doc.text(`-${pdfCurrency(totals.withholdingTaxTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Çizgi (kalın)
  boxY += 6;
  doc.setLineWidth(0.6);
  doc.line(boxX, boxY, boxX + boxW, boxY);

  // Genel toplam satırı
  boxY += 6;
  doc.setFillColor(30, 41, 59);
  doc.rect(boxX, boxY - 4, boxW, 9, 'F');
  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 10);
  doc.text('GENEL TOPLAM:', boxX + 2, boxY);
  doc.text(pdfCurrency(grandTotal, transaction.currency), boxX + boxW - 2, boxY, { align: 'right' });

  // Dış çerçeve
  const boxEndY = boxY + 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(boxX, boxStartY, boxW, boxEndY - boxStartY, 'S');

  // Yatay çizgiler
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  let lineY = boxStartY + 8;
  while (lineY < boxY - 2) {
    doc.line(boxX, lineY, boxX + boxW, lineY);
    lineY += 8;
  }

  // Dikey çizgi (başlık | tutar)
  doc.setLineWidth(0.2);
  doc.line(boxX + 35, boxStartY, boxX + 35, boxStartY + (boxEndY - boxStartY) - 9);

  doc.setTextColor(30, 41, 59);

  y = boxEndY + 12;

  // ══════════════════════════════════════════════════════════════
  // BÖLÜM 7: AÇIKLAMA VE NOT
  // ══════════════════════════════════════════════════════════════
  // AÇIKLAMA VE NOTLAR (çerçeve içinde)
  // ══════════════════════════════════════════════════════════════
  const descStartY = y;
  y += 8;

  setFont(doc, 'bold', 9);
  doc.text('AÇIKLAMA VE NOTLAR', 15, y);
  y += 7;

  setFont(doc, 'normal', 8);
  if (transaction.description) {
    y = fitText(doc, transaction.description, pageWidth - 30, 15, y, 5);
    y += 3;
  }

  // Birden fazla irsaliye notu
  if (isInvoice && transaction.linked_delivery_notes && transaction.linked_delivery_notes.length > 1) {
    const notesText = transaction.linked_delivery_notes
      .map((dn: any) => `${dn.delivery_note_date || '-'}-${formatDeliveryNoteNumber(dn.delivery_note_number)}`)
      .join(', ');
    const noteText = `${notesText} nolu irsaliyelere istinaden düzenlenmiştir.`;
    y = fitText(doc, noteText, pageWidth - 30, 15, y, 5);
    y += 3;
  }

  // Tevkifat kodu ve açıklaması
  if (transaction.withholding_tax_code) {
    setFont(doc, 'bold', 8);
    doc.text(`Tevkifat Kodu: ${transaction.withholding_tax_code}`, 15, y);
    y += 5;
    if (transaction.withholding_tax_description) {
      setFont(doc, 'normal', 8);
      y = fitText(doc, `Tevkifat Açıklaması: ${transaction.withholding_tax_description}`, pageWidth - 30, 15, y, 5);
    }
  }

  // Çerçeve çiz
  const descEndY = y + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.roundedRect(12, descStartY, pageWidth - 24, descEndY - descStartY, 2, 2, 'S');

  y = descEndY + 5;

  // ══════════════════════════════════════════════════════════════
  // BÖLÜM 8: FOOTER
  // ══════════════════════════════════════════════════════════════
  const footerY = pageHeight - 15;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, footerY - 10, pageWidth - 15, footerY - 10);

  doc.setTextColor(128, 128, 128);
  setFont(doc, 'normal', 7);
  doc.text('Bu belge Muhasebe Uygulaması tarafından otomatik olarak oluşturulmuştur.', 15, footerY);
  doc.text(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`, pageWidth - 15, footerY, { align: 'right' });

  // Save
  const fileName = `${invoiceType.toLowerCase()}-${transaction.invoice_number || transaction.delivery_note_number || transaction.transaction_number}.pdf`;
  doc.save(fileName);
}

export function generateDeliveryNotePDF(transaction: Transaction, companyName = 'Muhasebe') {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // İrsaliye türü
  const isSale = ['sale_delivery_note', 'delivery_note'].includes(transaction.transaction_type);
  const seller = isSale ? transaction.firm : transaction.cari;
  const buyer = isSale ? transaction.cari : transaction.firm;

  let y = 15;

  // ══════════════════════════════════════════════════════════════
  // HEADER: Koyu arka plan + mor accent
  // ══════════════════════════════════════════════════════════════
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 45, pageWidth, 2, 'F');

  // Firma adı
  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 18);
  doc.text(seller?.name || companyName, 15, 20);
  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text('Muhasebe Uygulaması', 15, 30);

  // İrsaliye badge
  doc.setFillColor(124, 58, 237);
  doc.roundedRect(pageWidth - 55, 10, 40, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 10);
  doc.text('İRSALİYE', pageWidth - 35, 18, { align: 'center' });

  // GİB amblemi
  drawGibEmblem(doc, pageWidth / 2, 22, 14);

  // GİB amblemi (header ortası)
  doc.setTextColor(200, 200, 200);
  setFont(doc, 'normal', 7);
  doc.text('GELİR İDARESİ BAŞKANLIĞI', pageWidth / 2, 14, { align: 'center' });
  doc.text('E-İRSALİYE', pageWidth / 2, 20, { align: 'center' });

  // İrsaliye numarası
  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text(`No: ${transaction.delivery_note_number || transaction.invoice_number || '-'}`, pageWidth - 15, 30, { align: 'right' });

  y = 55;

  // ══════════════════════════════════════════════════════════════
  // SATICI BİLGİLERİ
  // ══════════════════════════════════════════════════════════════
  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('SATICI', 15, y);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  doc.text(seller?.name || companyName, 15, y + 5);
  setFont(doc, 'normal', 7);
  doc.text(`Vergi No: ${seller?.tax_number || '-'}`, 15, y + 10);
  doc.text(`Vergi Dairesi: ${seller?.tax_office || '-'}`, 15, y + 15);

  y += 22;

  // ══════════════════════════════════════════════════════════════
  // İKİ AYRAÇ ÇİZGİSİ
  // ══════════════════════════════════════════════════════════════
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(15, y, pageWidth - 15, y);
  doc.line(15, y + 2, pageWidth - 15, y + 2);

  y += 4;

  // ══════════════════════════════════════════════════════════════
  // ALICI BİLGİLERİ + İRSALİYE TARİHİ/NO (Sağ)
  // ══════════════════════════════════════════════════════════════
  const rightX = pageWidth - 15;

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('ALICI', 15, y);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  doc.text(buyer?.name || '-', 15, y + 5);
  setFont(doc, 'normal', 7);
  doc.text(`Vergi No: ${buyer?.tax_number || '-'}`, 15, y + 10);
  doc.text(`Vergi Dairesi: ${buyer?.tax_office || '-'}`, 15, y + 15);
  if (buyer?.address) {
    doc.text(buyer.address, 15, y + 20);
  }

  // Sağ: İrsaliye tarihi ve no (tablo şeklinde çerçeve)
  const irsBoxX = rightX - 55;
  const irsBoxW = 55;
  const irsBoxStartY = y - 4;

  // Başlık satırı
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFillColor(241, 245, 249);
  doc.rect(irsBoxX, irsBoxStartY, irsBoxW, 7, 'FD');
  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('İRSALİYE BİLGİLERİ', irsBoxX + 2, y);

  // Tarih satırı
  doc.setFillColor(255, 255, 255);
  doc.rect(irsBoxX, irsBoxStartY + 7, irsBoxW, 8, 'FD');
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 7);
  doc.text('Tarih:', irsBoxX + 2, y + 7);
  setFont(doc, 'normal', 7);
  doc.text(transaction.transaction_date, irsBoxX + 18, y + 7);

  // No satırı
  doc.rect(irsBoxX, irsBoxStartY + 15, irsBoxW, 8, 'FD');
  setFont(doc, 'bold', 7);
  doc.text('No:', irsBoxX + 2, y + 15);
  setFont(doc, 'normal', 7);
  doc.text(transaction.delivery_note_number || transaction.invoice_number || '-', irsBoxX + 18, y + 15);

  // Sipariş satırı (varsa)
  let siparisRowH = 0;
  if (transaction.linked_order) {
    doc.rect(irsBoxX, irsBoxStartY + 23, irsBoxW, 8, 'FD');
    doc.setTextColor(124, 58, 237);
    setFont(doc, 'bold', 6);
    doc.text('Sipariş:', irsBoxX + 2, y + 23);
    setFont(doc, 'normal', 6);
    doc.text(`${transaction.linked_order.order_date || '-'} - ${formatDeliveryNoteNumber(transaction.linked_order.order_number || '-')}`, irsBoxX + 18, y + 23);
    siparisRowH = 8;
  }

  // Dış çerçeve
  const irsBoxH = 23 + siparisRowH + 7;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(irsBoxX, irsBoxStartY, irsBoxW, irsBoxH, 'S');

  // Dikey çizgi
  doc.setLineWidth(0.2);
  doc.line(irsBoxX + 16, irsBoxStartY + 7, irsBoxX + 16, irsBoxStartY + irsBoxH);

  // Yatay çizgiler
  doc.line(irsBoxX, irsBoxStartY + 7, irsBoxX + irsBoxW, irsBoxStartY + 7);
  doc.line(irsBoxX, irsBoxStartY + 15, irsBoxX + irsBoxW, irsBoxStartY + 15);
  if (transaction.linked_order) {
    doc.line(irsBoxX, irsBoxStartY + 23, irsBoxX + irsBoxW, irsBoxStartY + 23);
  }

  y += 27;

  // ══════════════════════════════════════════════════════════════
  // KALEMLER TABLOSU
  // ══════════════════════════════════════════════════════════════
  if (transaction.items && transaction.items.length > 0) {
    const tableData = transaction.items.map((item, index) => [
      String(index + 1),
      item.description || item.product?.name || '-',
      String(item.quantity),
      item.unit || 'Adet',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Sıra No', 'Ürün / Açıklama', 'Miktar', 'Birim']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: FONT_NAME,
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 110 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
      },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Sıra No', 'Ürün / Açıklama', 'Miktar', 'Birim']],
      body: [['1', transaction.description || '-', '-', 'Adet']],
      theme: 'grid',
      styles: {
        font: FONT_NAME,
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4,
      },
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  }

  // ══════════════════════════════════════════════════════════════
  // AÇIKLAMA VE NOT
  // ══════════════════════════════════════════════════════════════
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, y - 3, pageWidth - 20, 30, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, y - 3, pageWidth - 20, 30, 2, 2, 'S');

  setFont(doc, 'bold', 8);
  doc.setTextColor(100, 116, 139);
  doc.text('AÇIKLAMA VE NOTLAR', 15, y + 3);
  y += 8;

  setFont(doc, 'normal', 8);
  doc.setTextColor(30, 41, 59);
  if (transaction.description) {
    y = fitText(doc, transaction.description, pageWidth - 30, 15, y, 4);
    y += 2;
  }

  // Sipariş notu
  if (transaction.linked_order) {
    doc.setTextColor(124, 58, 237);
    setFont(doc, 'normal', 7);
    const orderNote = `${transaction.linked_order.order_date || '-'}-${formatDeliveryNoteNumber(transaction.linked_order.order_number || '-')} nolu siparişe istinaden düzenlenmiştir.`;
    y = fitText(doc, orderNote, pageWidth - 30, 15, y, 4);
  }

  // ══════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════
  const footerY = pageHeight - 15;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, footerY - 10, pageWidth - 15, footerY - 10);

  doc.setTextColor(148, 163, 184);
  setFont(doc, 'normal', 7);
  doc.text('Bu belge Muhasebe Uygulaması tarafından otomatik olarak oluşturulmuştur.', 15, footerY);
  doc.text(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`, pageWidth - 15, footerY, { align: 'right' });

  // Save
  const fileName = `irsaliye-${transaction.delivery_note_number || transaction.transaction_number}.pdf`;
  doc.save(fileName);
}

export function generateReportPDF(data: { name: string; income: number; expense: number; net: number }[], title: string, filename: string) {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 35, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 16);
  doc.text(title, 15, 18);

  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 15, 28);

  // Table
  const headers = [['Firma/Proje', 'Gelir', 'Gider', 'Net']];
  const rows = data.map(r => [
    r.name,
    pdfCurrency(r.income),
    pdfCurrency(r.expense),
    pdfCurrency(r.net)
  ]);

  // Total row
  const totalIncome = data.reduce((s, r) => s + r.income, 0);
  const totalExpense = data.reduce((s, r) => s + r.expense, 0);
  rows.push(['TOPLAM', pdfCurrency(totalIncome), pdfCurrency(totalExpense), pdfCurrency(totalIncome - totalExpense)]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 45,
    theme: 'grid',
    styles: {
      font: FONT_NAME,
      fontSize: 9,
      cellPadding: 4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: function(data) {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setTextColor(148, 163, 184);
  setFont(doc, 'normal', 7);
  doc.text('Bu belge Muhasebe Uygulaması tarafından otomatik olarak oluşturulmuştur.', 15, footerY);

  doc.save(`${filename}.pdf`);
}

export function generateLogPDF(logs: { transaction_date: string; transaction_type: string; firm?: { name: string }; amount: number; description?: string; created_by?: string }[]) {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 35, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 16);
  doc.text('İşlem Logları', 15, 18);

  setFont(doc, 'normal', 9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 15, 28);

  // Table
  const headers = [['Tarih', 'Tür', 'Firma', 'Tutar', 'Açıklama', 'Giren']];
  const rows = logs.map(l => [
    l.transaction_date,
    l.transaction_type,
    l.firm?.name || '-',
    pdfCurrency(l.amount),
    (l.description || '-').substring(0, 30),
    l.created_by
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 45,
    theme: 'grid',
    styles: {
      font: FONT_NAME,
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { halign: 'right', cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: 30 },
    },
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setTextColor(148, 163, 184);
  setFont(doc, 'normal', 7);
  doc.text('Bu belge Muhasebe Uygulaması tarafından otomatik olarak oluşturulmuştur.', 15, footerY);

  doc.save('islem-loglari.pdf');
}
