import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X } from 'lucide-react';

const shortcuts = [
  { keys: ['Alt', 'A'], description: 'Arama kutusuna odaklan', action: 'search' },
  { keys: ['Alt', 'E'], description: 'Yeni İşlem / Kalem Ekle (modal açıksa)', action: 'newTransaction' },
  { keys: ['Alt', 'S'], description: 'Kaydet (İşlem Girişi)', action: 'save' },
  { keys: ['?'], description: 'Kısayolları Göster', action: 'showHelp' },
  { keys: ['Escape'], description: 'Popup Kapat', action: 'close' },
];

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input/textarea içindeyse kısayolları çalıştırma
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Alt+A: Arama
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Ara"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Alt+E: Kalem Ekle (modal açıksa) veya Yeni İşlem
      if (e.altKey && e.key === 'e') {
        // Önce modal içindeki kalem ekle butonunu ara
        const addButtons = Array.from(document.querySelectorAll('button'));
        for (const btn of addButtons) {
          if (btn.textContent?.includes('Kalem Ekle') && btn.offsetParent !== null) {
            e.preventDefault();
            btn.click();
            return;
          }
        }
        // Modal yoksa İşlem Girişi'ne git
        e.preventDefault();
        navigate('/islem-girisi');
      }

      // Alt+S: Kaydet
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const saveButtons = Array.from(document.querySelectorAll('button'));
        for (const btn of saveButtons) {
          if ((btn.textContent?.includes('Kaydet') || btn.textContent?.includes('ALT+S')) && btn.offsetParent !== null) {
            btn.click();
            return;
          }
        }
      }

      // ?: Kısayolları göster
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }

      // Escape: Yardım penceresini kapat
      if (e.key === 'Escape') {
        setShowHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <>
      {/* Kısayol Yardım Butonu */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-20 right-4 lg:bottom-4 lg:right-4 p-3 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-700 transition-colors z-40"
        title="Klavye Kısayolları (?)"
      >
        <Keyboard size={20} />
      </button>

      {/* Kısayol Yardım Penceresi */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Keyboard size={20} />
                Klavye Kısayolları
              </h2>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-mono">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && <span className="mx-0.5 text-slate-400">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Input alanlarındayken kısayollar çalışmaz
            </p>
          </div>
        </div>
      )}
    </>
  );
}
