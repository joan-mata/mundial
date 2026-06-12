export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { recalculateAll } from '@/lib/recalculate';
import { writeAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await recalculateAll();
  await writeAudit(session.user.id, 'RECALCULATE_ALL', result);

  return NextResponse.json(result);
}
