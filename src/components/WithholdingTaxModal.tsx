import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { WITHHOLDING_TAX_CODES, type WithholdingTaxCode } from '../lib/withholdingTaxCodes';

interface WithholdingTaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (code: WithholdingTaxCode) => void;
  filterRate?: number;
}

export default function WithholdingTaxModal({ isOpen, onClose, onSelect, filterRate }: WithholdingTaxModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedCategory('Tümü');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Kategorileri al
  const categories = ['Tümü', ...new Set(WITHHOLDING_TAX_CODES.map(c => c.category))];

  // Filtrele
  const filtered = WITHHOLDING_TAX_CODES.filter(code => {
    const matchesSearch = search === '' || 
      code.code.includes(search) || 
      code.description.toLowerCase().includes(search.toLowerCase()) ||
      String(code.rate).includes(search);
    const matchesCategory = selectedCategory === 'Tümü' || code.category === selectedCategory;
    const matchesRate = filterRate === undefined || code.rate === filterRate;
    return matchesSearch && matchesCategory && matchesRate;
  });

  // Grupla (orana göre)
  const grouped = filtered.reduce((acc, code) => {
    if (!acc[code.rate]) acc[code.rate] = [];
    acc[code.rate].push(code);
    return acc;
  }, {} as Record<number, WithholdingTaxCode[]>);

  const handleSelect = (code: WithholdingTaxCode) => {
    onSelect(code);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Tevkifat Kodu Seç</h3>
            {filterRate !== undefined && (
              <p className="text-sm text-slate-500">%{filterRate} oranındaki kodlar</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Arama */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod veya açıklama ara... (Alt+F10 ile tüm listeyi aç)"
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          
          {/* Kategori filtreleri */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-center text-slate-500 py-8">Sonuç bulunamadı</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, codes]) => (
                <div key={rate}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-700">%{rate} Tevkifat</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>
                  <div className="space-y-1">
                    {codes.map(code => (
                      <button
                        key={code.code}
                        onClick={() => handleSelect(code)}
                        className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold min-w-[40px] text-center">
                            {code.code}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{code.description}</p>
                            <p className="text-xs text-slate-500">{code.category}</p>
                          </div>
                          <span className="text-sm font-bold text-blue-600">%{code.rate}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            {filtered.length} kod bulundu • Seçim yapmak için koda tıklayın
          </p>
        </div>
      </div>
    </div>
  );
}
