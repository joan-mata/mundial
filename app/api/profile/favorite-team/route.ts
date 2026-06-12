export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (user.favoriteTeam) {
    return NextResponse.json({ error: 'El equipo favorito ya está establecido' }, { status: 400 });
  }

  const { teamId } = await req.json();
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

  await db.user.update({ where: { id: session.user.id }, data: { favoriteTeam: teamId } });
  return NextResponse.json({ ok: true });
}
