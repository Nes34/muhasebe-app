import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../lib/ai';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isAI = message.role === 'assistant';

  return (
    <div className={`flex gap-3 text-sm ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAI ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
        {isAI ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
        isAI 
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm' 
          : 'bg-blue-600 text-white rounded-tr-sm'
      }`}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
