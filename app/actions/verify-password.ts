'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const session = await auth();
  if (!session) return false;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}
