'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';

const NAV_LINKS = [
  { href: '/matches',   label: 'Partidos' },
  { href: '/dashboard', label: 'Clasificación' },
  { href: '/grupos',    label: 'Grupos' },
  { href: '/cuadro',    label: 'Eliminatorias' },
  { href: '/extras',    label: 'Extras' },
];

interface Props { firstName: string; isAdmin: boolean; signOutAction: () => Promise<void>; }

export function MobileNav({ firstName, signOutAction }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex flex-col gap-1.5 p-2 rounded hover:bg-accent transition-colors"
        aria-label="Menú"
      >
        <span className={`block w-5 h-0.5 bg-foreground transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block w-5 h-0.5 bg-foreground transition-opacity ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-foreground transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 bg-card border-b shadow-md z-50 px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded hover:bg-accent transition-colors text-sm font-medium"
            >
              {l.label}
            </Link>
          ))}
          <div className="border-t my-1" />
          <Link href="/profile" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded hover:bg-accent transition-colors text-sm text-muted-foreground">
            {firstName} (perfil)
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start px-3">
              Salir
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
