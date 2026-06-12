import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  const isAdmin = session.user.role === 'ADMIN';
  const firstName = session.user.name.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
            <span className="text-xl">⚽</span>
            <span className="hidden sm:inline font-bold text-base tracking-tight">
              Mundial <span className="text-primary">2026</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-0.5 text-sm">
            {[
              { href: '/matches',   label: 'Partidos' },
              { href: '/dashboard', label: 'Clasificación' },
              { href: '/grupos',    label: 'Grupos' },
              { href: '/cuadro',    label: 'Eliminatorias' },
              { href: '/extras',    label: 'Extras' },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent font-medium transition-all duration-100">
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin">
                <Badge variant="secondary" className="cursor-pointer ml-1">Admin</Badge>
              </Link>
            )}
            <div className="w-px h-5 bg-border mx-1" />
            <Link href="/profile" className="px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-100 text-xs font-medium">
              {firstName}
            </Link>
            <ThemeToggle />
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs">Salir</Button>
            </form>
          </nav>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <Badge variant="secondary" className="cursor-pointer text-xs">Admin</Badge>
              </Link>
            )}
            <ThemeToggle />
            <MobileNav
              firstName={firstName}
              isAdmin={isAdmin}
              signOutAction={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
