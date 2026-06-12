'use server';
import { auth, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function changePasswordAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const password = (formData.get('password') as string) ?? '';
  const confirm  = (formData.get('confirm')  as string) ?? '';

  if (password !== confirm)  return { error: 'Las contraseñas no coinciden' };
  if (password.length < 8)   return { error: 'Mínimo 8 caracteres' };

  const session = await auth();
  if (!session) return { error: 'Sesión no válida' };

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { id: session.user.id },
    data:  { passwordHash, mustChangePassword: false },
  });

  await signOut({ redirectTo: '/login' });
  return { error: '' }; // unreachable — signOut redirige
}
