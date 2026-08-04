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
