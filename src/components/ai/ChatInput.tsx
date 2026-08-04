import { useState, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
      // Input'ta kal
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-xl flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Uygulamaya bir soru sorun..."
        disabled={isLoading}
        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
      />
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0"
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
      </button>
    </form>
  );
}
