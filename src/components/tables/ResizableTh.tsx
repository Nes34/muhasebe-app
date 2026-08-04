import { useState, useRef, useEffect } from 'react';

interface ResizableThProps {
  columnId: string;
  children: React.ReactNode;
  className?: string;
  initialWidth?: number;
}

export default function ResizableTh({ columnId, children, className = '', initialWidth }: ResizableThProps) {
  const [width, setWidth] = useState<number | undefined>(() => {
    if (initialWidth) return initialWidth;
    try {
      const saved = localStorage.getItem(`col-width-${columnId}`);
      return saved ? Number(saved) : undefined;
    } catch { return undefined; }
  });

  const thRef = useRef<HTMLTableCellElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.max(60, startW.current + e.clientX - startX.current);
      setWidth(w);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalW = thRef.current?.offsetWidth;
      if (finalW) {
        try { localStorage.setItem(`col-width-${columnId}`, String(finalW)); } catch {}
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [columnId]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = thRef.current?.offsetWidth || 150;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Use a wrapper approach: th contains a div, and the resize handle is
  // a sibling inside that div - no absolute positioning needed
  return (
    <th
      ref={thRef}
      className={className}
      style={{ width: width, minWidth: 60 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {children}
        </span>
        <span
          onMouseDown={onMouseDown}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 20,
            cursor: 'col-resize',
            color: '#cbd5e1',
            borderRadius: 2,
            flexShrink: 0,
            fontSize: 14,
            lineHeight: 1,
          }}
          title="Sütun genişliğini ayarla"
        >
          ❘❘
        </span>
      </div>
    </th>
  );
}
