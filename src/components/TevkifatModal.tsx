import { useState, useEffect, useRef } from 'react';
import { X, Search, Check } from 'lucide-react';
import { TEVKIFAT_KODLARI, getTevkifatCodesByRate, searchTevkifatCodes, type TevkifatKod } from '../lib/tevkifat';

interface TevkifatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: string, description: string, rate: number) => void;
  currentRate?: number;
  currentCode?: string;
  mode: 'rate' | 'all'; // rate: orana göre filtrele, all: tümünü göster
}

export default function TevkifatModal({ isOpen, onClose, onSelect, currentRate, currentCode, mode }: TevkifatModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCode, setSelectedCode] = useState<string>(currentCode || '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCode(currentCode || '');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, currentCode]);

  const getFilteredCodes = (): TevkifatKod[] => {
    if (searchTerm) {
      return searchTevkifatCodes(searchTerm);
    }
    if (mode === 'rate' && currentRate) {
      return getTevkifatCodesByRate(currentRate);
    }
    return TEVKIFAT_KODLARI;
  };

  const filteredCodes = getFilteredCodes();

  const handleSelect = (kod: TevkifatKod) => {
    setSelectedCode(kod.code);
    onSelect(kod.code, kod.description, kod.rate);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && selectedCode) {
      const kod = filteredCodes.find(k => k.code === selectedCode);
      if (kod) handleSelect(kod);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {mode === 'rate' && currentRate ? `%${currentRate} Tevkifat Kodları` : 'Tüm Tevkifat Kodları'}
            </h3>
            <p className="text-sm text-slate-500">
              {filteredCodes.length} kod bulundu
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Kod veya açıklama ara..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredCodes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Sonuç bulunamadı
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCodes.map((kod) => (
                <button
                  key={kod.code}
                  onClick={() => handleSelect(kod)}
                  className={`w-full flex items-center gap-4 p-3 hover:bg-blue-50 transition-colors text-left ${
                    selectedCode === kod.code ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-16">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm font-mono font-bold">
                      {kod.code}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{kod.description}</p>
                    <p className="text-xs text-slate-500">%{kod.rate} tevkifat</p>
                  </div>
                  {selectedCode === kod.code && (
                    <Check size={18} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Seçim yapmak için koda tıklayın veya Enter'a basın. Kapatmak için Esc tuşuna basın.
          </p>
        </div>
      </div>
    </div>
  );
}
