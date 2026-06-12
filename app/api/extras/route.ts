export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  type:  z.enum(['WORLD_CUP_WINNER', 'TOP_SCORER', 'BEST_GOALKEEPER']),
  value: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.role === 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { type, value } = parsed.data;

  // Check per-type open flag and global deadline
  const [openSetting, deadlineSetting] = await Promise.all([
    db.setting.findUnique({ where: { key: `extra_open_${type}` } }),
    db.setting.findUnique({ where: { key: 'extra_bet_deadline' } }),
  ]);
  const isOpen    = openSetting?.value !== 'false';
  const deadline  = new Date(deadlineSetting?.value ?? '2026-07-19T21:00:00Z');
  if (!isOpen || new Date() >= deadline) {
    return NextResponse.json({ error: 'Apuesta cerrada' }, { status: 403 });
  }

  await db.extraBet.upsert({
    where:  { userId_type: { userId: session.user.id, type } },
    create: { userId: session.user.id, type, value },
    update: { value },
  });

  return NextResponse.json({ ok: true });
}
