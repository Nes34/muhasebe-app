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
- Kullanıcı "nasıl yaparım" dediğinde asistan yeni özellikleri bilmeli

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
