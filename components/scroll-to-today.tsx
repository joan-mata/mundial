'use client';
import { useEffect } from 'react';

export function ScrollToToday() {
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const el = document.getElementById(today);
    if (el) el.scrollIntoView({ block: 'start' });
  }, []);
  return null;
}
