import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * gg.aa.yyyy veya Date nesnesini yyyy-mm-dd formatına çevirir (veritabanı için)
 */
export function toISODate(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }
  // gg.aa.yyyy formatını parse et
  const parts = date.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Zaten yyyy-mm-dd ise
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  // Diğer formatları Date'e çevir
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * gg.aa.yyyy string'ini Date nesnesine çevirir
 */
export function parseDateTR(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Bugünün yyyy-mm-dd formatında tarihini döndür
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatCurrency(amount: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Benzerlik kontrolü - Levenshtein distance tabanlı
 */
export function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[bLower.length][aLower.length];
  const maxLen = Math.max(aLower.length, bLower.length);
  return 1 - distance / maxLen;
}

/**
 * Benzer kayıtları bul - %70 ve üzeri benzerlik
 */
export function findSimilar<T extends { id: string; name: string }>(
  items: T[],
  newName: string,
  excludeId?: string,
  threshold = 0.7
): T[] {
  return items.filter(item => {
    if (excludeId && item.id === excludeId) return false;
    return similarity(item.name, newName) >= threshold;
  });
}

/**
 * Adın ilk harfini al (Türkçe karakter desteği ile)
 */
export function getFirstLetter(name: string): string {
  const clean = name.trim();
  if (!clean) return 'X';

  const firstChar = clean[0];
  if (/[a-zA-ZçğıöşüÇĞIİÖŞÜ]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }

  const match = clean.match(/[a-zA-ZçğıöşüÇĞIİÖŞÜ]/);
  if (match) {
    return match[0].toUpperCase();
  }

  return 'X';
}

/**
 * Sıradaki kodu üret: A.0001, A.0002, ...
 */
export function generateNextCode(
  existingCodes: string[],
  firstName: string
): string {
  const prefix = getFirstLetter(firstName);

  const pattern = new RegExp(`^${prefix}\\.\\d{4}$`);
  const existing = existingCodes
    .filter(code => pattern.test(code))
    .map(code => parseInt(code.split('.')[1], 10))
    .filter(n => !isNaN(n));

  const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}.${String(nextNum).padStart(4, '0')}`;
}
