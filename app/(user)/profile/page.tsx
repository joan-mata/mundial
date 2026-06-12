import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfileForm } from '@/components/profile-form';
import { ProfileSettingsForm } from '@/components/profile-settings-form';
import { ProfilePasswordForm } from '@/components/profile-password-form';

export default async function ProfilePage() {
  const session = await auth();
  const user    = await db.user.findUniqueOrThrow({ where: { id: session!.user.id } });
  const teams   = await db.team.findMany({ orderBy: { group: 'asc' } });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mi perfil</h1>

      {/* ── Información ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usuario</span>
            <span>@{user.username}</span>
          </div>
          <ProfileSettingsForm
            name={user.name}
            telegramChatId={user.telegramChatId}
            telegramToken={user.telegramToken}
          />
        </CardContent>
      </Card>

      {/* ── Contraseña ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contraseña</CardTitle>
          <CardDescription>Mínimo 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfilePasswordForm />
        </CardContent>
      </Card>

      {/* ── Equipo favorito ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipo favorito</CardTitle>
          <CardDescription>Una vez elegido no puedes cambiarlo. +1 pt por cada victoria de tu equipo que hayas acertado.</CardDescription>
        </CardHeader>
        <CardContent>
          {user.favoriteTeam ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{teams.find(t => t.id === user.favoriteTeam)?.flag ?? ''}</span>
              <span className="font-medium">{user.favoriteTeam}</span>
              <Badge variant="secondary">Bloqueado</Badge>
            </div>
          ) : (
            <ProfileForm teams={teams} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
