import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { type } = await params;
  const validTypes = ['WORLD_CUP_WINNER', 'TOP_SCORER', 'BEST_GOALKEEPER'];
  if (!validTypes.includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

  const { correctValue, awardPts } = await req.json();
  if (!correctValue || typeof awardPts !== 'number') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const bets = await db.extraBet.findMany({
    where: { type: type as 'WORLD_CUP_WINNER' | 'TOP_SCORER' | 'BEST_GOALKEEPER' },
  });

  let awarded = 0;
  for (const bet of bets) {
    const correct = bet.value.toLowerCase().trim() === correctValue.toLowerCase().trim();
    await db.extraBet.update({
      where: { id: bet.id },
      data: { resolved: true, points: correct ? awardPts : 0 },
    });
    if (correct) awarded++;
  }

  await writeAudit(session.user.id, 'EXTRA_BET_RESOLVED', { type, correctValue, awarded });
  return NextResponse.json({ ok: true, awarded });
}
