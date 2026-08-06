# Muhasebe Uygulaması

## Proje Hakkında
- Web tabanlı muhasebe uygulaması (React + TypeScript + Vite + Tailwind CSS)
- Supabase backend (ücretsiz plan)
- Multi-firma, stok, çek, kasa, banka, proje bazlı maliyet takibi
- Mobile responsive tasarım

## Proje Konumu
`C:/Users/User/cod/muhasebe-app`

## Tech Stack
- Frontend: React 19 + TypeScript + Vite
- UI: Tailwind CSS v4
- Backend: Supabase (PostgreSQL + Auth + RLS)
- Hosting: Vercel (bedava plan)

## Supabase Bilgileri
- URL: `https://csxpamrdcptrscnmgord.supabase.co`
- Anon key: `.env` dosyasında

## Geliştirme
- Dev sunucusu: `npm run dev` → `http://localhost:5173`
- Build: `npm run build`
- Port: 5173 (ASLA 3000 veya 3500 değil)

## Önemli Dosyalar
- `src/pages/` → Tüm sayfalar
- `src/types/index.ts` → TypeScript arayüzleri
- `src/lib/` → Yardımcı fonksiyonlar
- `src/hooks/useAuth.tsx` → Giriş Yetkilendirme
- `src/components/layout/` → Sidebar, Header, MobileNav
- `src/lib/ai.ts` → AI Asistanı (sistem promptu burada)
- `src/components/ai/` → AI bileşenleri

## ⚠️ ÖNEMLİ: AI Asistanı
- Header'daki Bot butonu ile açılır
- Kullanıcı kendi API key'ini girer (Gemini, Groq, HF, OpenAI)
- **Yeni özellik eklendiğinde `src/lib/ai.ts` dosyasındaki SYSTEM_PROMPT'u güncelle!**
- **Her deploy'dan önce AI asistanına yeni özellikleriöğret!**
- Kullanıcı "nasıl yaparım" dediğinde asistan yeni özellikleri bilmeli
- **Nasıl yapılır:** `src/lib/ai.ts` dosyasındaki `SYSTEM_PROMPT` sabitini bul, yeni özellikleri Türkçe olarak ekle

## 🔧 Yeni Özellik Eklerken Kontrol Listesi

### Yeni Sayfa Eklerken:
1. `src/pages/YeniSayfa.tsx` → Sayfa bileşeni oluştur
2. `src/App.tsx` → Route ekle (`<Route path="/yeni-sayfa" element={<YeniSayfa />} />`)
3. `src/components/layout/Sidebar.tsx` → Menü linki ekle
4. `src/lib/ai.ts` → SYSTEM_PROMPT'a yeni sayfa bilgisi ekle

### Yeni Tablo Eklerken:
1. Supabase SQL Editor'da tablo oluştur
2. `src/types/index.ts` → TypeScript arayüzü ekle
3. İlgili sayfada CRUD işlemleri yaz
4. `src/lib/ai.ts` → SYSTEM_PROMPT'a tablo bilgisi ekle

### Mevcut Sayfa Değiştirirken:
1. İlgili `src/pages/Sayfa.tsx` dosyasını değiştir
2. `src/lib/ai.ts` → SYSTEM_PROMPT'u güncelle (yeni özellik bilgisi)

### Header/Sidebar Değiştirirken:
1. `src/components/layout/Header.tsx` → Header değişiklikleri
2. `src/components/layout/Sidebar.tsx` → Sidebar değişiklikleri
3. `src/components/layout/MobileNav.tsx` → Mobil menü değişiklikleri

### Yeni Hook/Context Eklerken:
1. `src/hooks/useYeniHook.tsx` → Hook oluştur
2. `src/App.tsx` → Provider ekle (gerekirse)

### Tip/Tür Eklerken:
1. `src/types/index.ts` → Yeni arayüz ekle
2. `src/lib/ai.ts` → SYSTEM_PROMPT'a yeni tip bilgisi ekle

### Raporlama/Analiz Eklerken:
1. `src/pages/Reports.tsx` → Mevcut raporlara ekle
2. `src/lib/ai.ts` → SYSTEM_PROMPT'a rapor bilgisi ekle

## 🚗 Demirbaş Yönetimi Modülü
- Sayfa: `src/pages/AssetManagement.tsx`
- SQL: `supabase/assets.sql`
- Tablolar: fixed_assets, vehicle_details, vehicle_km_records, vehicle_fuel_records, vehicle_assignments, vehicle_penalties, vehicle_mtv
- Özellikler: KM takibi, yakıt takibi, ceza takibi, MTV takibi, zimmetleme, hatırlatmalar
- Hatırlatmalar: Sigorta bitiş, muayene, 10.000 KM bakım
- Dashboard'da da araç hatırlatmaları linki var

## 📋 AI Asistanı SYSTEM_PROMPT İçeriği
AI asistanı aşağıdaki bilgileri bilmeli:
- Tüm sayfa isimleri ve ne işe yaradıkları
- Tüm tablo isimleri ve alanları
- İşlem tipleri (income, expense, sale_invoice, vb.)
- Hesaplama formülleri (KDV, net maaş, vb.)
- Adım adım kullanım kılavuzları

## Kullanıcı Bilgileri
- GitHub: Nes34
- E-posta: nes34444@gmail.com

## Özellikler
- İşlem Girişi (tek noktadan tüm veri girişi)
- Fatura ve İrsaliye (çoklu kalem, otomatik numara)
- Çek yönetimi (alınan/verilen, bildirimler)
- Cari hesap ekstresi (firma + proje filtresi)
- Proje bazlı maliyet takibi
- Excel import/export
- İstisna (mükerrer) kayıtlar
- Raporlar ve dashboard
- Kullanıcı yönetimi (admin, muhasebeci, izleyici)

## 🔽 Dropdown Kuralları (ÇOK ÖNEMLİ)
Yeni dropdown eklerken MUTLAKA şu özellikler olmalı:

### Zorunlu Özellikler:
1. **Klavye Navigasyonu:**
   - `↓` tuşu: Sonraki öğeye git
   - `↑` tuşu: Önceki öğeye git
   - `Enter` veya `Tab`: Seçili öğeyi seç
   - `Escape`: Dropdown'ı kapat

2. **Vurgulama (Highlight):**
   - Seçili öğe mavi arka plan ile vurgulanmalı (`bg-blue-100 text-blue-700`)
   - Mouse ile üzerine gelince de vurgulanmalı (`onMouseEnter`)

3. **Pozisyon:**
   - Dropdown, input'un hemen altında açılmalı
   - Tablo arkasında kalmamalı (`position: fixed` + `z-index: 999999`)
   - `getBoundingClientRect()` ile input pozisyonu alınmalı

4. **Kapanma:**
   - Dışarıya tıklayınca kapanmalı
   - Escape tuşu ile kapanmalı
   - Seçim yapıldıktan sonra kapanmalı

### Örnek Kod Yapısı:
```tsx
const [highlightIndex, setHighlightIndex] = useState(0);

// Input'ta:
onKeyDown={(e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setHighlightIndex(prev => Math.max(prev - 1, 0));
  } else if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    // Seçimi uygula
  } else if (e.key === 'Escape') {
    // Dropdown'ı kapat
  }
}}

// Dropdown öğesinde:
className={index === highlightIndex ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-50'}
onMouseEnter={() => setHighlightIndex(index)}
```

### Mevcut Dropdown Bileşenleri:
- `SearchableSelect` → Zaten klavye navigasyonu var
- `DescriptionAutocomplete` → Zaten klavye navigasyonu var
- Ürün dropdown'ı → Klavye navigasyonu eklendi

### Dropdown Kaydırma (ÖNEMLİ):
Yön tuşlarıyla gezinirken dropdown otomatik kaydırılmalı:
```tsx
// useEffect ile:
useEffect(() => {
  if (isOpen) {
    const el = document.querySelector(`[data-highlight="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}, [highlightedIndex, isOpen]);

// Dropdown öğesinde:
data-highlight={index}
```

## 📄 Fatura Numarası Mantığı

### Format:
- Genel: `{FIRMA_KODU}{YIL}{9_HANELI_NUMARA}` (örn: `AAB2026000000001`)
- Firma kodu: 3 harf (elle girilir, firmadan alınmaz)
- Yıl: 4 haneli (2026)
- Numara: 9 haneli (000000001'den başlar)

### Kurallar:
1. **Manuel giriş:** Kullanıcı firma kodunu, yılı ve numarayı kendisi girer
2. **Enter ile formatla:** Fatura no input'unda Enter'a basınca `formatInvoiceNumberOnSave()` çalışır
3. **Küçük harf → Büyük harf:** Kullanıcı küçük harf girse bile otomatik büyük harfe çevrilir
4. **Özel karakter engelleme:** Sadece harf, rakam ve `/` kabul edilir
5. **Her alanda uygulanır:** İşlem Girişi, İşlem Takibi düzenleme modalı, Cari Hesap Ekstresi düzenleme, İrsaliyeden Fatura Oluştur
6. **İrsaliyeden Fatura Oluştur:** Bu ekranda da aynı format geçerli, elle girilir

### Fonksiyonlar:
- `handleInvoiceNumberChange(value)` → onChange'de çağrılır, temizleme yapar
- `handleInvoiceNumberKeyDown(e)` → onKeyDown'de Enter ile format uygular
- `formatInvoiceNumberOnSave(number)` → Kaydetmeden önce format uygular

## 📦 İrsaliye Numarası Mantığı

### Format:
- Satış İrsaliyesi: `SI` + 9 haneli numara
- Alış İrsaliyesi: `AI` + 9 haneli numara

### Kurallar:
1. **Otomatik numara:** Yeni irsaliye oluşturulurken son numara +1 yapılır
2. **Enter ile formatla:** İrsaliye no input'unda Enter'a basınca `formatInvoiceNumberOnSave()` çalışır
3. **Küçük harf → Büyük harf:** Otomatik büyük harfe çevrilir
4. **Özel karakter engelleme:** Sadece harf, rakam ve `/` kabul edilir
5. **Fatura ile irsaliye bağlantısı:** Satış/Alış faturasında irsaliye seçimi yapılabilir (çoklu seçim desteklenir)

### İrsaliye Seçimi (Fatura Girişinde):
- Firma + Proje + Cari'ye göre filtrelenmiş irsaliyeler listelenir
- Birden fazla irsaliye seçilebilir (checkbox)
- Seçilen irsaliyelerin kalemleri otomatik faturaya aktarılır
- İrsaliye numaraları otomatik irsaliye no alanına yazılır

### İrsaliye Seçimi (İşlem Takibi Düzenleme):
- Satış/Alış faturası düzenlenirken "İrsaliye Seç" butonu görünür
- Aynı çoklu irsaliye seçimi yapılabilir

## 📊 Cari Hesap Formülü

### Formül:
```
Toplam Borç = Satış Faturaları + Tedarikçiye Yapılan Ödemeler (çek + nakit + banka)
Toplam Alacak = Alış Faturaları + Müşteriden Yapılan Tahsilatlar (çek + nakit + banka)
Net Bakiye = Toplam Borç - Toplam Alacak
```

### Sonuç:
- Pozitif (+) → Müşteri bize borçlu
- Negatif (-) → Biz tedarikçiye borçluyuz (Cari alacaklı)
- Sıfır (0) → Hesap kapanmış

### Çek Mantığı:
- Tüm çekler (bekleyen + tahsil edilen + ödenmiş) bakiyeye dahil
- Sadece iptal edilen çekler hariç
- Tahsil edilen çek → Alacak
- Ödenen çek → Borç

### Kasa/Banka Mantığı (Firma/Proje Sayfaları):
- Kasa/banka gelen → Alacak
- Kasa/banka giden → Borç

### Hariç Tutulan Tipler:
- `delivery_note`, `sale_delivery_note`, `purchase_delivery_note` → Para hareketi değil
- `transfer`, `stock_transfer`, `cash_transfer`, `bank_transfer` → Hesaplar arası transfer
