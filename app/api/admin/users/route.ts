export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name:     z.string().min(1).max(100),
  username: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });

  const { name, username, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: 'Usuario ya registrado' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({ data: { name, username, passwordHash, mustChangePassword: true } });

  await writeAudit(session.user.id, 'USER_CREATED', { name, username, userId: user.id });
  return NextResponse.json({ ok: true, id: user.id });
}
