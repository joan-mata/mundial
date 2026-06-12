'use client';
import { useRef, useEffect } from 'react';

/** Wraps the bracket and scales it to fit the container via CSS zoom. */
export function BracketScaler({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function apply() {
      const el = innerRef.current;
      if (!el || !el.parentElement) return;
      el.style.zoom = '1';
      // Read natural width after resetting zoom
      const nat = el.scrollWidth;
      const avail = el.parentElement.clientWidth - 2;
      if (nat > avail) el.style.zoom = String(avail / nat);
    }
    const id = requestAnimationFrame(apply);
    const ro = new ResizeObserver(apply);
    if (innerRef.current?.parentElement) ro.observe(innerRef.current.parentElement);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, []);

  return (
    <div ref={innerRef} className="inline-block min-w-0">
      {children}
    </div>
  );
}
