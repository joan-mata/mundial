export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  homeLabel: z.string().nullable(),
  awayLabel: z.string().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  await db.match.update({
    where: { id },
    data: {
      homeLabel: parsed.data.homeLabel || null,
      awayLabel: parsed.data.awayLabel || null,
    },
  });

  return NextResponse.json({ ok: true });
}
