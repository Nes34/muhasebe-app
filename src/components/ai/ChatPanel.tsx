import { useState, useEffect, useRef } from 'react';
import { X, Bot, Settings2 } from 'lucide-react';
import { getAIConfig, generateAIResponse, clearAIConfig, type ChatMessage as ChatMessageType } from '../../lib/ai';
import { ApiKeySetup } from './ApiKeySetup';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [hasKey, setHasKey] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config = getAIConfig();
    setHasKey(!!config.apiKey);
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (content: string) => {
    const userMsg: ChatMessageType = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const responseText = await generateAIResponse(newMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      setMessages(prev => [...prev, { role: 'assistant', content: `Hata: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 sm:absolute sm:inset-auto sm:top-14 sm:right-4 z-50 flex flex-col w-full h-full sm:w-[400px] sm:h-[600px] bg-white dark:bg-slate-900 sm:rounded-xl shadow-2xl sm:border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Muhasebe Asistanı</h2>
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Aktif
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasKey && (
            <button 
              onClick={() => { clearAIConfig(); setHasKey(false); setMessages([]); }}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Ayarları Sıfırla"
            >
              <Settings2 size={18} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        {!hasKey ? (
          <ApiKeySetup onComplete={() => setHasKey(true)} />
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="text-center p-6 text-slate-500 dark:text-slate-400 text-sm">
                <Bot size={32} className="mx-auto mb-2 opacity-50" />
                <p>Merhaba! Size muhasebe işlemlerinizde nasıl yardımcı olabilirim?</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <button onClick={() => handleSend("Bu ay kaç fatura kestim?")} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">📊 Bu ayki faturalar</button>
                  <button onClick={() => handleSend("KDV oranları nelerdir?")} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">💡 KDV oranları</button>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-2 items-center text-slate-400 text-xs px-2">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      {hasKey && <ChatInput onSend={handleSend} isLoading={isLoading} />}
    </div>
  );
}
