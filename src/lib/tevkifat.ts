// Tevkifat Kodları ve Oranları
// Kaynak: Gelir İdaresi Başkanlığı Tebliğleri

export interface TevkifatKod {
  code: string;
  description: string;
  rate: number; // Yüzde oranı
}

// Tüm tevkifat kodları listesi
export const TEVKIFAT_KODLARI: TevkifatKod[] = [
  // %1 Tevkifat
  { code: '600', description: 'Mal ve hizmet teslimleri (Genel)', rate: 1 },
  
  // %2 Tevkifat
  { code: '601', description: 'Tevkifat uygulanmayan işlemler', rate: 2 },
  { code: '602', description: 'İhraç kayıtlı teslimler', rate: 2 },
  
  // %3 Tevkifat
  { code: '603', description: 'Özel bankacılık işlemleri', rate: 3 },
  
  // %5 Tevkifat
  { code: '604', description: 'Komisyon ve aracılık ücretleri', rate: 5 },
  { code: '605', description: 'Rödövans (madencilik)', rate: 5 },
  { code: '606', description: 'Yükseköğretim kurumlarına yapılan hizmetler', rate: 5 },
  
  // %7 Tevkifat
  { code: '607', description: 'Spor kulüplerine yapılan hizmetler', rate: 7 },
  
  // %10 Tevkifat
  { code: '608', description: 'İnşaat taahhüt işleri', rate: 10 },
  { code: '609', description: 'Danışmanlık hizmetleri', rate: 10 },
  { code: '610', description: 'Bilişim teknolojisi hizmetleri', rate: 10 },
  { code: '611', description: 'Özel güvenlik hizmetleri', rate: 10 },
  { code: '612', description: 'Temizlik hizmetleri', rate: 10 },
  { code: '613', description: 'Yemek ve catering hizmetleri', rate: 10 },
  { code: '614', description: 'Organizasyon hizmetleri', rate: 10 },
  { code: '615', description: 'Eğitim ve öğretim hizmetleri', rate: 10 },
  { code: '616', description: 'Sağlık hizmetleri', rate: 10 },
  { code: '617', description: 'Veteriner hizmetleri', rate: 10 },
  { code: '618', description: 'Hukuki hizmetler (avukatlık)', rate: 10 },
  { code: '619', description: 'Mühendislik ve mimarlık hizmetleri', rate: 10 },
  { code: '620', description: 'Denetim ve ekspertiz hizmetleri', rate: 10 },
  { code: '621', description: 'Tercüme hizmetleri', rate: 10 },
  { code: '622', description: 'Turizm ve seyahat acenteliği hizmetleri', rate: 10 },
  { code: '623', description: 'GAYRIMENKUL KİRALAMA HİZMETİ (6/10)', rate: 10 },
  { code: '624', description: 'Reklamcılık hizmetleri', rate: 10 },
  { code: '625', description: 'Tanıtım ve promosyon hizmetleri', rate: 10 },
  { code: '626', description: 'FOTOĞRAFÇILIK HİZMETLERİ (6/10)', rate: 10 },
  { code: '627', description: 'GÜVENLİK HİZMETLERİ (6/10)', rate: 10 },
  { code: '628', description: 'BASKI VE YAYINCILIK HİZMETLERİ (6/10)', rate: 10 },
  { code: '629', description: 'ETÜT, PROJE, MÜŞAVİRLİK VE DANIŞMANLIK HİZMETLERİ (6/10)', rate: 10 },
  { code: '630', description: 'İSTİHRACATLA İLGİLİ HİZMET BEDELİ (6/10)', rate: 10 },
  
  // %15 Tevkifat
  { code: '631', description: 'Ticari reklamcılık hizmetleri', rate: 15 },
  { code: '632', description: 'Faturalı mal teslimi', rate: 15 },
  
  // %20 Tevkifat
  { code: '633', description: 'Hisse senedi ve tahvil işlemleri', rate: 20 },
  
  // %50 Tevkifat
  { code: '634', description: 'Kira ödemeleri (Gayrimenkul)', rate: 50 },
  { code: '635', description: 'Kira ödemeleri (Gemiler hariç)', rate: 50 },
  
  // %100 Tevkifat
  { code: '636', description: 'Yurt dışı müteahhitlik hizmetleri', rate: 100 },
  { code: '637', description: 'Yurt dışı hizmet ihracı', rate: 100 },
];

// Orana göre tevkifat kodlarını filtrele
export function getTevkifatCodesByRate(rate: number): TevkifatKod[] {
  return TEVKIFAT_KODLARI.filter(kod => kod.rate === rate);
}

// Tüm tevkifat kodlarını getir
export function getAllTevkifatCodes(): TevkifatKod[] {
  return TEVKIFAT_KODLARI;
}

// Kod ile ara
export function searchTevkifatCodes(query: string): TevkifatKod[] {
  const lowerQuery = query.toLowerCase();
  return TEVKIFAT_KODLARI.filter(kod => 
    kod.code.includes(lowerQuery) || 
    kod.description.toLowerCase().includes(lowerQuery)
  );
}

// Tek kod getir
export function getTevkifatCode(code: string): TevkifatKod | undefined {
  return TEVKIFAT_KODLARI.find(kod => kod.code === code);
}
