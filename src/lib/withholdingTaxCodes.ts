// Tevkifat Kodları ve Oranları
// Kaynak: Gelir İdaresi Başkanlığı Tevkifat Listesi

export interface WithholdingTaxCode {
  code: string;
  description: string;
  rate: number;
  category: string;
}

export const WITHHOLDING_TAX_CODES: WithholdingTaxCode[] = [
  // %1 Tevkifat
  { code: '600', description: 'İhraç kayıtlı mal satışı (teslim ve hizmet)', rate: 1, category: 'Genel' },
  
  // %2 Tevkifat
  { code: '601', description: 'Tevkifat uygulanmayan işlemler', rate: 2, category: 'Genel' },
  { code: '602', description: 'Gümrük muhafaza dairelerine verilen hizmetler', rate: 2, category: 'Hizmet' },
  { code: '603', description: 'Konut inşaatı teslimleri (1. el)', rate: 2, category: 'İnşaat' },
  
  // %3 Tevkifat
  { code: '610', description: 'Damga vergisi uygulanmayan kağıtlar', rate: 3, category: 'Finans' },
  
  // %5 Tevkifat
  { code: '611', description: 'Banka ve sigorta muameleleri vergisi', rate: 5, category: 'Finans' },
  { code: '612', description: 'Borsa tescil komisyonları', rate: 5, category: 'Finans' },
  { code: '613', description: 'Yatırım fonu katılma belgeleri', rate: 5, category: 'Finans' },
  
  // %7 Tevkifat
  { code: '620', description: 'Reklam hizmetleri', rate: 7, category: 'Hizmet' },
  { code: '621', description: 'Organizasyon ve etkinlik hizmetleri', rate: 7, category: 'Hizmet' },
  { code: '622', description: 'Danışmanlık hizmetleri', rate: 7, category: 'Hizmet' },
  { code: '623', description: 'Denetim hizmetleri', rate: 7, category: 'Hizmet' },
  
  // %10 Tevkifat
  { code: '630', description: 'İnşaat taahhüt hizmetleri (temel inşaat hariç)', rate: 10, category: 'İnşaat' },
  { code: '631', description: 'Tadilat ve onarım hizmetleri', rate: 10, category: 'İnşaat' },
  { code: '632', description: 'Montaj hizmetleri', rate: 10, category: 'Hizmet' },
  { code: '633', description: 'Nakliye ve lojistik hizmetleri', rate: 10, category: 'Lojistik' },
  { code: '634', description: 'Güvenlik hizmetleri', rate: 10, category: 'Hizmet' },
  
  // %15 Tevkifat
  { code: '640', description: 'Temel inşaat (konut, iş merkezi) taahhüt', rate: 15, category: 'İnşaat' },
  { code: '641', description: 'Yol, köprü, baraj inşaatı', rate: 15, category: 'İnşaat' },
  
  // %20 Tevkifat
  { code: '650', description: 'Serbest meslek kazançları', rate: 20, category: 'Serbest Meslek' },
  { code: '651', description: 'Avukatlık ücretleri', rate: 20, category: 'Serbest Meslek' },
  { code: '652', description: 'Mühendislik ve mimarlık hizmetleri', rate: 20, category: 'Serbest Meslek' },
  { code: '653', description: 'Mali müşavirlik hizmetleri', rate: 20, category: 'Serbest Meslek' },
  
  // %30 Tevkifat
  { code: '660', description: 'Kira ödemeleri (gayrimenkul)', rate: 30, category: 'Kira' },
  { code: '661', description: 'Kira ödemeleri (taşınır mal)', rate: 30, category: 'Kira' },
  { code: '662', description: 'İrtifak hakkı bedelleri', rate: 30, category: 'Kira' },
  
  // %50 Tevkifat
  { code: '670', description: 'Kâr payı ödemeleri', rate: 50, category: 'Finans' },
  { code: '671', description: 'Dar mükelleflere yapılan kâr payı ödemeleri', rate: 50, category: 'Finans' },
  
  // %100 Tevkifat
  { code: '680', description: 'Yurtdışı ödemeler (hizmet)', rate: 100, category: 'Yurtdışı' },
  { code: '681', description: 'Yurtdışı ödemeler (kur farkı)', rate: 100, category: 'Yurtdışı' },
];

// Tevkifat oranına göre kodları filtrele
export function getWithholdingCodesByRate(rate: number): WithholdingTaxCode[] {
  return WITHHOLDING_TAX_CODES.filter(code => code.rate === rate);
}

// Tevkifat kodunu bul
export function getWithholdingCode(code: string): WithholdingTaxCode | undefined {
  return WITHHOLDING_TAX_CODES.find(c => c.code === code);
}

// Tüm tevkifat oranlarını getir (benzersiz)
export function getUniqueWithholdingRates(): number[] {
  const rates = [...new Set(WITHHOLDING_TAX_CODES.map(c => c.rate))];
  return rates.sort((a, b) => a - b);
}

// Tevkifat kodunu formatla
export function formatWithholdingCode(code: string, description: string): string {
  return `${code} - ${description}`;
}
