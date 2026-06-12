export const dynamic = 'force-dynamic';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { resolveMatch } from '@/lib/recalculate';
import { writeAudit } from '@/lib/audit';
import { notifyMatchResult } from '@/lib/telegram';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  homeScore:       z.number().int().min(0).max(30).nullable(),
  awayScore:       z.number().int().min(0).max(30).nullable(),
  status:          z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED']),
  knockoutWinnerId: z.string().nullable().optional(),
  knockoutMethod:  z.enum(['EXTRA_TIME', 'PENALTIES']).nullable().optional(),
  etHomeScore:     z.number().int().min(0).max(30).nullable().optional(),
  etAwayScore:     z.number().int().min(0).max(30).nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const before = await db.match.findUniqueOrThrow({ where: { id } });

  const updated = await db.match.update({
    where: { id },
    data: {
      homeScore:       parsed.data.homeScore,
      awayScore:       parsed.data.awayScore,
      status:          parsed.data.status,
      knockoutWinnerId: parsed.data.knockoutWinnerId ?? null,
      knockoutMethod:  parsed.data.knockoutMethod ?? null,
      etHomeScore:     parsed.data.etHomeScore ?? null,
      etAwayScore:     parsed.data.etAwayScore ?? null,
      resolved:        parsed.data.status === 'FINISHED' && parsed.data.homeScore !== null ? false : before.resolved,
    },
  });

  const action = parsed.data.homeScore !== null ? 'RESULT_SET' : 'RESULT_CLEARED';
  await writeAudit(session.user.id, action, { before: { homeScore: before.homeScore, awayScore: before.awayScore, status: before.status }, after: parsed.data }, id);

  let resolved = 0;
  if (updated.status === 'FINISHED' && updated.homeScore !== null && updated.awayScore !== null) {
    const r = await resolveMatch(id);
    resolved = r.updated;

    // Telegram notifications
    const predictions = await db.prediction.findMany({
      where: { matchId: id, points: { not: null } },
      include: { user: { select: { telegramChatId: true, telegramToken: true, id: true } } },
    });
    const matchDesc = `${updated.homeTeamId} ${updated.homeScore}–${updated.awayScore} ${updated.awayTeamId}`;
    for (const pred of predictions) {
      if (!pred.user.telegramChatId || !pred.user.telegramToken) continue;
      const totalPts = await db.prediction.aggregate({
        where: { userId: pred.user.id, points: { not: null } },
        _sum: { points: true },
      });
      await notifyMatchResult(pred.user.telegramChatId, pred.user.telegramToken, {
        matchDesc,
        predDesc: `Predijiste: ${pred.homeScore}–${pred.awayScore}`,
        basePoints:     pred.basePoints    ?? 0,
        knockoutPoints: pred.knockoutPoints ?? 0,
        favBonus:       (pred.points ?? 0) - (pred.basePoints ?? 0) - (pred.knockoutPoints ?? 0),
        totalPoints:    totalPts._sum.points ?? 0,
      }).catch(e => console.error('[telegram]', e));
    }
  }

  return NextResponse.json({ ok: true, resolved });
}
