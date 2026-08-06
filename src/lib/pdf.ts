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

export function generateInvoicePDF(transaction: Transaction, companyName = 'Muhasebe', cariData?: { name?: string; tax_number?: string; tax_office?: string; address?: string } | null) {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fatura türü
  const isInvoice = ['sale_invoice', 'purchase_invoice', 'invoice'].includes(transaction.transaction_type);
  const isSale = ['sale_invoice', 'invoice'].includes(transaction.transaction_type);
  const invoiceType = isInvoice ? 'FATURA' : 'İRSALİYE';
  
  // Satıcı ve alıcı bilgileri
  const seller = isSale ? transaction.firm : (cariData || transaction.cari);
  const buyer = isSale ? (cariData || transaction.cari) : transaction.firm;

  let y = 46;

  // ══════════════════════════════════════════════════════════════
  // 3 SÜTUNLU ÜST KISIM: SOL | ORTA | SAĞ (ayırıcı çizgi yok)
  // ══════════════════════════════════════════════════════════════
  const colLeft = 15;
  const colCenter = 70;
  const colRight = 140;
  const colEnd = pageWidth - 15;

  // ── SOL: SATICI + ALICI (yukarıda, solY=25) ──────────────────
  const solY = 25;
  const solMaxW = colCenter - colLeft - 4;

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('SATICI', colLeft, solY);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  let sellerY = fitText(doc, seller?.name || companyName || '-', solMaxW, colLeft, solY + 5, 4);
  if (seller?.address) {
    setFont(doc, 'normal', 6);
    doc.setTextColor(100, 116, 139);
    sellerY = fitText(doc, `Adres: ${seller.address}`, solMaxW, colLeft, sellerY + 1, 3.5);
  }
  setFont(doc, 'normal', 6);
  doc.setTextColor(51, 65, 85);
  doc.text(`Vergi No: ${seller?.tax_number || '-'}`, colLeft, sellerY + 2);
  doc.text(`Vergi Dairesi: ${seller?.tax_office || '-'}`, colLeft, sellerY + 6);
  const sellerEndY = sellerY + 10;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);
  doc.line(colLeft, sellerEndY, colCenter - 4, sellerEndY);

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('ALICI', colLeft, sellerEndY + 4);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  let buyerY = fitText(doc, buyer?.name || '-', solMaxW, colLeft, sellerEndY + 9, 4);
  if (buyer?.address) {
    setFont(doc, 'normal', 6);
    doc.setTextColor(100, 116, 139);
    buyerY = fitText(doc, `Adres: ${buyer.address}`, solMaxW, colLeft, buyerY + 1, 3.5);
  }
  setFont(doc, 'normal', 6);
  doc.setTextColor(51, 65, 85);
  doc.text(`Vergi No: ${buyer?.tax_number || '-'}`, colLeft, buyerY + 2);
  doc.text(`Vergi Dairesi: ${buyer?.tax_office || '-'}`, colLeft, buyerY + 6);

  // ── ORTA: FATURA + GİB AMBLEMİ (y=46'da) ───────────────────
  const ortaX = (colCenter + colRight - 4) / 2;

  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 14);
  doc.text('FATURA', ortaX, y + 4, { align: 'center' });

  drawGibEmblem(doc, ortaX, y + 22, 28);

  // ── SAĞ: FATURA BİLGİLERİ (yumuşak kenarlık, dinamik) ────────
  const sagW = colEnd - colRight;
  const diagX = colRight;
  const hasIrsaliye = !isInvoice && transaction.delivery_note_number;
  const faturaSatirH = 7;
  const faturaBaslikH = 7;
  const faturaBoxH = faturaBaslikH + (hasIrsaliye ? 3 : 2) * faturaSatirH + 2;

  // Dış çerçeve (yumuşak gri, yuvarlak)
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.roundedRect(diagX - 1, y - 4, sagW + 2, faturaBoxH, 2, 2, 'S');

  // Başlık satırı (açık gri arka plan)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(diagX, y - 3, sagW, faturaBaslikH, 1, 1, 'F');
  doc.setTextColor(80, 90, 100);
  setFont(doc, 'bold', 7);
  doc.text('FATURA BİLGİLERİ', diagX + 2, y + 2);

  // Tarih satırı
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.15);
  doc.line(diagX + 1, y + 4, diagX + sagW - 1, y + 4);
  setFont(doc, 'bold', 7);
  doc.setTextColor(80, 90, 100);
  doc.text('Tarih:', diagX + 3, y + 9);
  setFont(doc, 'normal', 7);
  doc.setTextColor(30, 41, 59);
  doc.text(transaction.transaction_date, diagX + 18, y + 9);

  // No satırı
  doc.line(diagX + 1, y + 11, diagX + sagW - 1, y + 11);
  setFont(doc, 'bold', 7);
  doc.setTextColor(80, 90, 100);
  doc.text('No:', diagX + 3, y + 16);
  setFont(doc, 'normal', 7);
  doc.setTextColor(30, 41, 59);
  doc.text(transaction.invoice_number || transaction.delivery_note_number || '-', diagX + 18, y + 16);

  // İrsaliye satırı (varsa)
  if (hasIrsaliye) {
    doc.line(diagX + 1, y + 18, diagX + sagW - 1, y + 18);
    doc.setTextColor(59, 130, 246);
    setFont(doc, 'bold', 6);
    doc.text('İrsaliye:', diagX + 3, y + 23);
    setFont(doc, 'normal', 6);
    doc.text(formatDeliveryNoteNumber(transaction.delivery_note_number), diagX + 18, y + 23);
  }

  // Dikey çizgi (Tarih üstünden No/İrsaliye altına kadar)
  const dikeyCizgiBitis = hasIrsaliye ? y + 25 : y + 18;
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.15);
  doc.line(diagX + 16, y + 4, diagX + 16, dikeyCizgiBitis);

  y += faturaBoxH + 16;

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
      theme: 'striped',
      styles: {
        font: FONT_NAME,
        fontSize: 7,
        cellPadding: 2,
        textColor: [50, 60, 75],
        lineColor: [210, 215, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [60, 75, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
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
      theme: 'striped',
      styles: {
        font: FONT_NAME,
        fontSize: 7,
        cellPadding: 2,
        textColor: [50, 60, 75],
        lineColor: [210, 215, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [60, 75, 100],
        textColor: [255, 255, 255],
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

  // Toplamlar (yumuşak kenarlıklı tablo)
  const boxX = pageWidth - 85;
  const boxW = 70;
  let boxY = y;
  const boxStartY = y - 4;

  // Kutu yüksekliğini hesapla
  let rowCount = 1; // Ara toplam
  if (totals.vatTotal > 0) rowCount++;
  if (totals.discountTotal > 0) rowCount++;
  if (totals.stoppageTotal > 0) rowCount++;
  if (totals.withholdingTaxTotal > 0) rowCount++;
  const boxH = rowCount * 7 + 18; // satırlar + boşluk + genel toplam

  // Dış çerçeve (yumuşak gri, yuvarlak)
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX - 1, boxStartY - 1, boxW + 2, boxH, 2, 2, 'S');

  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.15);

  // Ara toplam satırı
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, boxY - 4, boxW, 7, 1, 1, 'F');
  setFont(doc, 'normal', 8);
  doc.setTextColor(80, 90, 100);
  doc.text('Ara Toplam:', boxX + 2, boxY);
  doc.setTextColor(30, 41, 59);
  doc.text(pdfCurrency(totals.subtotal + totals.discountTotal), boxX + boxW - 2, boxY, { align: 'right' });

  // KDV satırı
  if (totals.vatTotal > 0) {
    boxY += 7;
    doc.line(boxX + 1, boxY - 3, boxX + boxW - 1, boxY - 3);
    doc.setTextColor(80, 90, 100);
    doc.text('KDV Toplamı:', boxX + 2, boxY);
    doc.setTextColor(30, 41, 59);
    doc.text(pdfCurrency(totals.vatTotal), boxX + boxW - 2, boxY, { align: 'right' });
  }

  // İskonto satırı
  if (totals.discountTotal > 0) {
    boxY += 7;
    doc.line(boxX + 1, boxY - 3, boxX + boxW - 1, boxY - 3);
    doc.setTextColor(80, 90, 100);
    doc.text('İskonto:', boxX + 2, boxY);
    doc.setTextColor(30, 41, 59);
    doc.text(`-${pdfCurrency(totals.discountTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Stopaj satırı
  if (totals.stoppageTotal > 0) {
    boxY += 7;
    doc.line(boxX + 1, boxY - 3, boxX + boxW - 1, boxY - 3);
    doc.setTextColor(80, 90, 100);
    doc.text('Stopaj:', boxX + 2, boxY);
    doc.setTextColor(30, 41, 59);
    doc.text(`-${pdfCurrency(totals.stoppageTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Tevkifat satırı
  if (totals.withholdingTaxTotal > 0) {
    boxY += 7;
    doc.line(boxX + 1, boxY - 3, boxX + boxW - 1, boxY - 3);
    doc.setTextColor(80, 90, 100);
    doc.text('Tevkifat:', boxX + 2, boxY);
    doc.setTextColor(30, 41, 59);
    doc.text(`-${pdfCurrency(totals.withholdingTaxTotal)}`, boxX + boxW - 2, boxY, { align: 'right' });
  }

  // Boşluk

  // Genel toplam satırı (koyu arka plan)
  boxY += 10;
  doc.setFillColor(45, 55, 72);
  doc.roundedRect(boxX, boxY - 4, boxW, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  setFont(doc, 'bold', 10);
  doc.text('GENEL TOPLAM:', boxX + 2, boxY);
  doc.text(pdfCurrency(grandTotal, transaction.currency), boxX + boxW - 2, boxY, { align: 'right' });

  // Dikey çizgi (sadece üst kısım için)
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.15);
  doc.line(boxX + 35, boxStartY + 4, boxX + 35, boxY - 6);

  const boxEndY = boxY + 5;
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

export function generateDeliveryNotePDF(transaction: Transaction, companyName = 'Muhasebe', cariData?: { name?: string; tax_number?: string; tax_office?: string; address?: string } | null) {
  const doc = new jsPDF();
  initFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  // İrsaliye türü
  const isSale = ['sale_delivery_note', 'delivery_note'].includes(transaction.transaction_type);
  const seller = isSale ? transaction.firm : (cariData || transaction.cari);
  const buyer = isSale ? (cariData || transaction.cari) : transaction.firm;

  let y = 46;

  // ══════════════════════════════════════════════════════════════
  // 3 SÜTUNLU ÜST KISIM: SOL | ORTA | SAĞ (ayırıcı çizgi yok)
  // ══════════════════════════════════════════════════════════════
  const colLeft = 15;
  const colCenter = 70;
  const colRight = 140;
  const colEnd = pageWidth - 15;

  // ── SOL: SATICI + ALICI ──────────────────────────────────────
  const solY = 25;
  const solMaxW = colCenter - colLeft - 4;

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('SATICI', colLeft, solY);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  let sellerY = fitText(doc, seller?.name || companyName || '-', solMaxW, colLeft, solY + 5, 4);
  if (seller?.address) {
    setFont(doc, 'normal', 6);
    doc.setTextColor(100, 116, 139);
    sellerY = fitText(doc, `Adres: ${seller.address}`, solMaxW, colLeft, sellerY + 1, 3.5);
  }
  setFont(doc, 'normal', 6);
  doc.setTextColor(51, 65, 85);
  doc.text(`Vergi No: ${seller?.tax_number || '-'}`, colLeft, sellerY + 2);
  doc.text(`Vergi Dairesi: ${seller?.tax_office || '-'}`, colLeft, sellerY + 6);
  const sellerEndY = sellerY + 10;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);
  doc.line(colLeft, sellerEndY, colCenter - 4, sellerEndY);

  doc.setTextColor(100, 116, 139);
  setFont(doc, 'bold', 7);
  doc.text('ALICI', colLeft, sellerEndY + 4);
  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 8);
  let buyerY = fitText(doc, buyer?.name || '-', solMaxW, colLeft, sellerEndY + 9, 4);
  if (buyer?.address) {
    setFont(doc, 'normal', 6);
    doc.setTextColor(100, 116, 139);
    buyerY = fitText(doc, `Adres: ${buyer.address}`, solMaxW, colLeft, buyerY + 1, 3.5);
  }
  setFont(doc, 'normal', 6);
  doc.setTextColor(51, 65, 85);
  doc.text(`Vergi No: ${buyer?.tax_number || '-'}`, colLeft, buyerY + 2);
  doc.text(`Vergi Dairesi: ${buyer?.tax_office || '-'}`, colLeft, buyerY + 6);

  // ── ORTA: İRSALİYE + GİB AMBLEMİ ────────────────────────────
  const ortaX = (colCenter + colRight - 4) / 2;

  doc.setTextColor(30, 41, 59);
  setFont(doc, 'bold', 14);
  doc.text('İRSALİYE', ortaX, y + 4, { align: 'center' });

  drawGibEmblem(doc, ortaX, y + 22, 28);

  // ── SAĞ: İRSALİYE BİLGİLERİ (yumuşak kenarlık, dinamik) ─────
  const sagW = colEnd - colRight;
  const diagX = colRight;
  const hasSiparis = !!transaction.linked_order;
  const irsSatirH = 7;
  const irsBaslikH = 7;
  const irsBoxH = irsBaslikH + (hasSiparis ? 3 : 2) * irsSatirH + 2;

  // Dış çerçeve (yumuşak gri, yuvarlak)
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.roundedRect(diagX - 1, y - 4, sagW + 2, irsBoxH, 2, 2, 'S');

  // Başlık satırı (açık gri arka plan)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(diagX, y - 3, sagW, irsBaslikH, 1, 1, 'F');
  doc.setTextColor(80, 90, 100);
  setFont(doc, 'bold', 7);
  doc.text('İRSALİYE BİLGİLERİ', diagX + 2, y + 2);

  // Tarih satırı
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.15);
  doc.line(diagX + 1, y + 4, diagX + sagW - 1, y + 4);
  setFont(doc, 'bold', 7);
  doc.setTextColor(80, 90, 100);
  doc.text('Tarih:', diagX + 3, y + 9);
  setFont(doc, 'normal', 7);
  doc.setTextColor(30, 41, 59);
  doc.text(transaction.transaction_date, diagX + 18, y + 9);

  // No satırı
  doc.line(diagX + 1, y + 11, diagX + sagW - 1, y + 11);
  setFont(doc, 'bold', 7);
  doc.setTextColor(80, 90, 100);
  doc.text('No:', diagX + 3, y + 16);
  setFont(doc, 'normal', 7);
  doc.setTextColor(30, 41, 59);
  doc.text(transaction.delivery_note_number || transaction.invoice_number || '-', diagX + 18, y + 16);

  // Sipariş satırı (varsa)
  if (hasSiparis) {
    doc.line(diagX + 1, y + 18, diagX + sagW - 1, y + 18);
    setFont(doc, 'bold', 7);
    doc.setTextColor(80, 90, 100);
    doc.text('Sipariş:', diagX + 3, y + 23);
    setFont(doc, 'normal', 7);
    doc.setTextColor(30, 41, 59);
    doc.text(`${transaction.linked_order?.order_date || '-'} - ${formatDeliveryNoteNumber(transaction.linked_order?.order_number || '-')}`, diagX + 18, y + 23);
  }

  // Dikey çizgi (Tarih üstünden No/İrsaliye altına kadar)
  const dikeyCizgiBitis = hasSiparis ? y + 25 : y + 18;
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.15);
  doc.line(diagX + 16, y + 4, diagX + 16, dikeyCizgiBitis);

  y += irsBoxH + 16;

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
        lineColor: [200, 210, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
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
        lineColor: [200, 210, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4,
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
  }

  // ══════════════════════════════════════════════════════════════
  // AÇIKLAMA (varsa)
  // ══════════════════════════════════════════════════════════════
  if (transaction.description) {
    doc.setTextColor(100, 116, 139);
    setFont(doc, 'bold', 7);
    doc.text('Açıklama:', 15, y);
    doc.setTextColor(30, 41, 59);
    setFont(doc, 'normal', 7);
    const descLines = doc.splitTextToSize(transaction.description, pageWidth - 30);
    doc.text(descLines, 15, y + 5);
    y += 5 + descLines.length * 4 + 5;
  }

  // ══════════════════════════════════════════════════════════════
  // İMZA ALANI
  // ══════════════════════════════════════════════════════════════
  const signY = Math.max(y + 10, 250);

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);

  // Sol imza
  doc.line(15, signY, 75, signY);
  doc.setTextColor(100, 116, 139);
  setFont(doc, 'normal', 7);
  doc.text('Teslim Eden', 45, signY + 5, { align: 'center' });

  // Sağ imza
  doc.line(pageWidth - 75, signY, pageWidth - 15, signY);
  doc.text('Teslim Alan', pageWidth - 45, signY + 5, { align: 'center' });

  doc.save(`irsaliye-${transaction.delivery_note_number || transaction.id}.pdf`);
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
