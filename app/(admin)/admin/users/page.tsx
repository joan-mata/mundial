import { db } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateUserForm } from '@/components/admin/create-user-form';

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    where: { role: 'USER' },
    include: {
      _count: { select: { predictions: true } },
      predictions: { where: { points: { not: null } }, select: { points: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      <CreateUserForm />

      <div className="divide-y rounded-lg border">
        {users.map(u => {
          const total = u.predictions.reduce((s, p) => s + (p.points ?? 0), 0);
          return (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.name}</span>
                  {!u.active && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                  {u.favoriteTeam && <span className="text-sm">{u.favoriteTeam}</span>}
                </div>
                <div className="text-sm text-muted-foreground">@{u.username}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{total} pts</div>
                <div className="text-muted-foreground">{u._count.predictions} predicciones</div>
                {!u.telegramChatId && <Badge variant="outline" className="text-xs">Sin Telegram</Badge>}
              </div>
            </Link>
          );
        })}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">No hay usuarios aún. Crea el primero.</p>
        )}
      </div>
    </div>
  );
}
