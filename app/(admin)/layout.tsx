import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-bold text-lg">⚽ Admin</Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/admin/users"   className="px-2 py-1 rounded hover:bg-accent transition-colors">Usuarios</Link>
              <Link href="/admin/matches" className="px-2 py-1 rounded hover:bg-accent transition-colors">Partidos</Link>
              <Link href="/admin/extras"  className="px-2 py-1 rounded hover:bg-accent transition-colors hidden sm:inline">Extras</Link>
              <Link href="/admin/audit"   className="px-2 py-1 rounded hover:bg-accent transition-colors hidden sm:inline">Audit</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Web pública</Link>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
              <Button type="submit" variant="ghost" size="sm">Salir</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
