export type Provider = 'gemini' | 'groq' | 'huggingface' | 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Sen bir muhasebe uygulaması asistanısın. Kullanıcılara uygulamayı nasıl kullanacaklarını öğretiyorsun.

GÜVENLİK KURALLARI (ÇOK ÖNEMLİ):
- ASLA SQL kodu verme veya veritabanı şemasını gösterme
- ASLA API key, şifre, token gibi hassas bilgileri sorma veya gösterme
- ASLA kullanıcıların kişisel bilgilerini (TC kimlik, banka hesap no, IBAN) başkalarıyla paylaşma
- ASLA firma veya cari bilgilerini (vergi numarası, adres, telefon) ifşa etme
- ASLA toplam tutar, bakiye, maaş gibi finansal bilgileri başkalarıyla paylaşma
- ASLA veritabanına veri ekleme, güncelleme veya silme işlemi yapma
- ASLA INSERT, UPDATE, DELETE gibi SQL komutları önerme
- Sadece uygulamayı nasıl kullanacağını öğret, verileri gösterme
- "Veritabanında ne var?" gibi sorulara cevap verme
- Veritabanına yazma işlemi yapamazsın, sadece okuma yapabilirsin

KURALLAR:
1. ASLA SQL kodu verme
2. Kullanıcıya adım adım açıkla
3. Kısa ve net ol
4. Türkçe cevap ver
5. Uygulama menülerini ve butonlarını tarif et

UYGULAMA MENÜLERİ:
- Dashboard: Ana sayfa, özet bilgiler
- İşlem Girişi: Fatura, irsaliye, gelir/gider kaydetme
- İşlem Takibi: Tüm işlemlerin listesi
- Firmalar: Firma bilgileri
- Projeler: Proje bazlı takip
- Cariler: Müşteri/tedarikçi bilgileri
- Stok: Ürün yönetimi
- Kasa/Banka: Nakit ve banka hareketleri
- Çekler: Çek yönetimi
- Raporlar: Analiz ve raporlar
- Personel: Personel yönetimi

FATURA GİRME ADIMLARI:
1. Sol menüden "İşlem Girişi"ne tıklayın
2. İşlem tipi seçin (Satış Faturası veya Alış Faturası)
3. Firma seçin
4. Cari seçin (Müşteri veya Tedarikçi)
5. Proje seçin
6. Ürün/hizmet ekleyin (miktar, birim fiyat)
7. "Kaydet" butonuna tıklayın

ÇEK GİRME ADIMLARI:
1. Sol menüden "Çekler"e tıklayın
2. "Yeni Çek" butonuna tıklayın
3. Çek numarasını girin
4. Alınan veya Verilen seçin
5. Cari seçin
6. Tutar ve vadeleri girin
7. "Kaydet" butonuna tıklayın

STOK GİRME ADIMLARI:
1. Sol menüden "Stok"a tıklayın
2. "Yeni Ürün" butonuna tıklayın
3. Ürün adı, barkod, kategori girin
4. Stok miktarı ve birim fiyat girin
5. "Kaydet" butonuna tıklayın

KDV HESAPLAMA:
- %20 KDV: Tutar × 0.20
- %10 KDV: Tutar × 0.10
- %1 KDV: Tutar × 0.01

NET MAAŞ HESAPLAMA:
- SGK İşçi Payı: Brüt × %14
- Gelir Vergisi: Matraha göre dilimli
- Damga Vergisi: Brüt × %0.759
- Net = Brüt - SGK - Gelir Vergisi - Damga Vergisi

Kısa ve net cevap ver. Uzun açıklamalardan kaçın.`;

export const getAIConfig = () => {
  const provider = localStorage.getItem('ai_provider') as Provider | null;
  const apiKey = localStorage.getItem('ai_api_key')?.trim() || null;
  return { provider, apiKey };
};

export const setAIConfig = (provider: Provider, apiKey: string) => {
  localStorage.setItem('ai_provider', provider);
  localStorage.setItem('ai_api_key', apiKey.trim());
};

export const clearAIConfig = () => {
  localStorage.removeItem('ai_provider');
  localStorage.removeItem('ai_api_key');
};

export const generateAIResponse = async (
  messages: ChatMessage[]
): Promise<string> => {
  const { provider, apiKey } = getAIConfig();
  if (!provider || !apiKey) throw new Error('API Key bulunamadı.');

  const allMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  try {
    if (provider === 'openai' || provider === 'groq') {
      const endpoint = provider === 'openai' 
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';
      
      const model = provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-8b-instant';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages: allMessages })
      });
      
      if (!res.ok) throw new Error(`${provider} API Hatası`);
      const data = await res.json();
      return data.choices[0].message.content;
    } 
    
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: { text: SYSTEM_PROMPT } },
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        })
      });

      if (!res.ok) throw new Error('Gemini API Hatası');
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    }

    if (provider === 'huggingface') {
      const prompt = allMessages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
      const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 250 } })
      });

      if (!res.ok) throw new Error('Hugging Face API Hatası');
      const data = await res.json();
      return data[0].generated_text.replace(prompt, '').trim();
    }

    throw new Error('Desteklenmeyen sağlayıcı');
  } catch (error) {
    console.error(error);
    throw new Error('Yanıt oluşturulurken bir hata oluştu. Lütfen API anahtarınızı ve limitlerinizi kontrol edin.');
  }
};
