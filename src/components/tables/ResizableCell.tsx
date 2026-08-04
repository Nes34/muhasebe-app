import { useState, useRef, useEffect } from 'react';

interface ResizableCellProps {
  cellId: string;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}

export default function ResizableCell({ cellId, children, className = '', minWidth = 130 }: ResizableCellProps) {
  const [width, setWidth] = useState<number | undefined>(() => {
    try {
      const saved = localStorage.getItem(`cell-width-${cellId}`);
      return saved ? Number(saved) : undefined;
    } catch { return undefined; }
  });

  const cellRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.max(minWidth, startW.current + e.clientX - startX.current);
      setWidth(w);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem(`cell-width-${cellId}`, String(cellRef.current?.offsetWidth || '')); } catch {}
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [cellId, minWidth]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = cellRef.current?.offsetWidth || 180;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      ref={cellRef}
      className={`border-r border-b border-slate-300 p-2 shrink-0 relative group ${className}`}
      style={{ width: width, minWidth }}
    >
      {children}
      <span
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 20,
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3b82f6'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
      />
    </div>
  );
}
