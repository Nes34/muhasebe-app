export type Provider = 'gemini' | 'groq' | 'huggingface' | 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `Sen bir muhasebe uygulaması asistanısın. Kullanıcının veritabanı şeması:
- transactions (amount, transaction_type, firm_id, project_id, cari_id, invoice_number, description)
- firms (name, code, type)
- projects (name, firm_id, budget, status)
- cariler (name, code)
- products (name, code, barcode, stock_quantity, unit_price, min_stock_level)
- checks (check_number, check_type, amount, due_date, status, firm_id, project_id)
- cash_transactions (amount, transaction_type, cash_register_id)
- bank_transactions (amount, transaction_type, bank_account_id)
- cash_registers (name, opening_balance, current_balance)
- bank_accounts (bank_name, opening_balance, current_balance)
- personnel (tc_number, first_name, last_name, taseron, gross_salary, net_salary, status)

İşlem Tipleri (transaction_type): income, expense, sale_invoice, purchase_invoice, sale_delivery_note, purchase_delivery_note.

Görevlerin:
1. Veritabanı sorguları sorulduğunda geçerli SQL sorguları üretmek.
2. Hesaplamalar yapmak (KDV, net maaş vb.).
3. Muhasebe terimlerini açıklamak.
Cevaplarını kısa ve net tut.`;

export const getAIConfig = () => {
  const provider = localStorage.getItem('ai_provider') as Provider | null;
  const apiKey = localStorage.getItem('ai_api_key');
  return { provider, apiKey };
};

export const setAIConfig = (provider: Provider, apiKey: string) => {
  localStorage.setItem('ai_provider', provider);
  localStorage.setItem('ai_api_key', apiKey);
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
      
      const model = provider === 'openai' ? 'gpt-4o-mini' : 'llama3-8b-8192';

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
