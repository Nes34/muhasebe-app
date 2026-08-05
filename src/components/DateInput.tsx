import { useState, useEffect } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DateInput({
  value,
  onChange,
  placeholder = 'gg.aa.yyyy',
  className = '',
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDate(value));
  }, [value]);

  const formatDate = (val: string): string => {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) return '';
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    } else {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4, 8);
    }
    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const digits = inputVal.replace(/\D/g, '');
    if (digits.length > 8) return;
    const formatted = formatDate(digits);
    setDisplayValue(formatted);
    if (digits.length === 8) {
      onChange(formatted);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  const handleBlur = () => {
    const digits = displayValue.replace(/\D/g, '');
    if (digits.length === 8) {
      onChange(displayValue);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      maxLength={10}
      className={className}
    />
  );
}
