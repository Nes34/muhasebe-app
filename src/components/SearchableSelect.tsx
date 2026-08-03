import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Option {
  id: string;
  code?: string;
  name: string;
  [key: string]: unknown;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string, option?: Option) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showCode?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Ara...',
  label,
  required = false,
  showCode = true,
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name);
    }
  }, [selectedOption]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const filtered = options.filter(o => {
    const search = searchTerm.toLowerCase();
    const nameMatch = o.name.toLowerCase().includes(search);
    const codeMatch = o.code?.toLowerCase().includes(search);
    const taxMatch = (o as Record<string, unknown>).tax_number?.toString().toLowerCase().includes(search);
    return nameMatch || codeMatch || taxMatch;
  });

  const handleSelect = (option: Option) => {
    onChange(option.id, option);
    setSearchTerm(option.code ? `${option.code} - ${option.name}` : option.name);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name);
        }
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {required && <span className="text-red-500">*</span>} {label}
        </label>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (selectedOption && e.target.value !== (selectedOption.code ? `${selectedOption.code} - ${selectedOption.name}` : selectedOption.name)) {
              onChange('', undefined);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          required={required}
        />
      </div>
      
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filtered.slice(0, 20).map((option, index) => (
            <div
              key={option.id}
              className={`px-4 py-2 cursor-pointer flex items-center gap-2 ${
                index === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
              }`}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {showCode && option.code && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-bold">
                  {option.code}
                </span>
              )}
              <span className="font-medium">{option.name}</span>
              {(option as Record<string, unknown>).tax_number && (
                <span className="text-xs text-slate-400 ml-auto">Vergi: {(option as Record<string, unknown>).tax_number as string}</span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && searchTerm && filtered.length === 0 && (
        <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500">
          Sonuç bulunamadı
        </div>
      )}
    </div>
  );
}
