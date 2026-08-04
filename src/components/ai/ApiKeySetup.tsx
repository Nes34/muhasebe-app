import { useState } from 'react';
import { setAIConfig, type Provider } from '../../lib/ai';
import { KeyRound, ExternalLink, Check } from 'lucide-react';

const PROVIDERS: { id: Provider; name: string; desc: string; url: string; steps: string }[] = [
  { id: 'gemini', name: 'Google Gemini', desc: 'Ücretsiz, günde 60 istek', url: 'https://aistudio.google.com/apikey', steps: 'Google hesabınla giriş yap → "Create API Key" tıkla → Key\'i kopyala' },
  { id: 'groq', name: 'Groq', desc: 'Ücretsiz, çok hızlı', url: 'https://console.groq.com/keys', steps: 'Hesap oluştur → "Create API Key" tıkla → Key\'i kopyala' },
  { id: 'huggingface', name: 'Hugging Face', desc: 'Ücretsiz, açık kaynak', url: 'https://huggingface.co/settings/tokens', steps: 'Hesap oluştur → "New token" tıkla → "Read" izni seç → Key\'i kopyala' },
  { id: 'openai', name: 'OpenAI', desc: 'Ücretli, en iyi performans', url: 'https://platform.openai.com/api-keys', steps: 'Hesap oluştur → "Create new secret key" tıkla → Key\'i kopyala' }
];

export function ApiKeySetup({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (selected && apiKey.trim()) {
      setAIConfig(selected, apiKey.trim());
      onComplete();
    }
  };

  if (!selected) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Yapay Zeka Sağlayıcısı Seçin</h3>
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="flex flex-col items-start p-3 border rounded-lg hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{p.desc}</span>
          </button>
        ))}
      </div>
    );
  }

  const provider = PROVIDERS.find(p => p.id === selected)!;

  return (
    <div className="flex flex-col gap-4 p-4">
      <button 
        onClick={() => setSelected(null)}
        className="text-xs text-blue-500 hover:underline self-start"
      >
        ← Sağlayıcı Değiştir
      </button>
      
      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
          <KeyRound size={14} /> Nasıl Alınır?
        </h4>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">{provider.steps}</p>
        <a 
          href={provider.url} 
          target="_blank" 
          rel="noreferrer"
          className="text-xs font-medium bg-white dark:bg-slate-800 px-3 py-1.5 rounded-md inline-flex items-center gap-1 border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {provider.name} Sitesine Git <ExternalLink size={12} />
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">API Key'inizi Girin</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors text-sm"
        >
          <Check size={16} /> Kaydet ve Başla
        </button>
      </div>
    </div>
  );
}
