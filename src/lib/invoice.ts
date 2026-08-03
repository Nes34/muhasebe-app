export function formatInvoiceNumber(input: string): string {
  // Sadece harf, rakam ve / karakterine izin ver
  const clean = input.replace(/[^a-zA-Z0-9/]/g, '').toUpperCase();
  return clean;
}

export function formatInvoiceNumberOnSave(input: string): string {
  // / sil, 16 haneye tamamla
  const clean = input.replace(/[^a-zA-Z0-9/]/g, '').toUpperCase();
  const withoutSlash = clean.replace(/\//g, '');
  return withoutSlash.padEnd(16, '0');
}

export function parseInvoiceNumber(formatted: string) {
  // ABC2026000000005 formatını eşle (16 karakter, / yok)
  const matchOld = formatted.match(/^([A-Z]{3})(\d{4})(\d{9})$/);
  if (matchOld) {
    return {
      firmCode: matchOld[1],
      year: matchOld[2],
      sequence: parseInt(matchOld[3]),
    };
  }
  return null;
}

export function getInvoiceDisplay(invoiceNumber: string): string {
  const parsed = parseInvoiceNumber(invoiceNumber);
  if (parsed) {
    return `${parsed.firmCode}${parsed.year}/${parsed.sequence}`;
  }
  return invoiceNumber;
}