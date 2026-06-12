export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  userId:      z.string().nullable(), // null = global
  newDeadline: z.string().datetime(),
  reason:      z.string().max(200).optional(),
});

const deleteSchema = z.object({
  userId: z.string().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: matchId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { userId, newDeadline, reason } = parsed.data;

  // upsert via findFirst + create/update because userId is nullable
  const existing = await db.predictionExtension.findFirst({ where: { matchId, userId: userId ?? null } });
  if (existing) {
    await db.predictionExtension.update({
      where: { id: existing.id },
      data: { newDeadline: new Date(newDeadline), reason, createdById: session.user.id },
    });
  } else {
    await db.predictionExtension.create({
      data: { matchId, userId: userId ?? null, newDeadline: new Date(newDeadline), reason, createdById: session.user.id },
    });
  }

  await writeAudit(session.user.id, 'EXTENSION_GRANTED', { userId, newDeadline, reason }, matchId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: matchId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { userId } = parsed.data;

  await db.predictionExtension.deleteMany({
    where: { matchId, userId: userId ?? null },
  });

  await writeAudit(session.user.id, 'EXTENSION_REVOKED', { userId }, matchId);
  return NextResponse.json({ ok: true });
}
